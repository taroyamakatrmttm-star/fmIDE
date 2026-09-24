# Build step 5 — publish the web app

**Goal:** fmIDE becomes an installable web app (PWA — progressive web app): it installs like a normal program (own window and icon), works offline, updates itself safely, and opens `.fmide` files by double-click where the browser allows. Then it is published at a public HTTPS address.

**Decisions already made:**

- **One app** (24 Sep 2026): fmIDE and ExcelExporter install as one app; ExcelExporter opens from inside fmIDE.
- `apps/*.html` stay single self-contained files that work opened straight from disk. The published site is built from the same `src/`.

**Still open (needed for 5b, not 5a):** open source or not (`docs/decisions.md`, decision 3 — publishing is the first public release); where to host (recommendation: Cloudflare Pages, which keeps the repository private); which web address.

## Phase 5a — make it a PWA (nothing published yet)

A PWA needs three things the single files can't carry: a **web app manifest** (name, icons, colours, file types it opens), a **service worker** (a script the browser keeps, which stores the app's files for offline use and fetches new versions), and HTTPS hosting. The manifest and service worker must be separate files, so:

- **`npm run build` also writes `site/`** (not committed; ignored by Git): `index.html` (fmIDE), `ExcelExporter.html`, `manifest.webmanifest`, `sw.js`, `icons/`. Its sources are `src/site/`. The fmIDE page in `site/` differs from `apps/fmIDE.html` only by the lines that link the manifest and icons (the `<!-- build:site-head -->` marker, which is empty in `apps/`).
- **Offline:** the service worker stores the site's own files and nothing else (still no requests to any other site); after the first visit everything works offline. Its cache name carries a version: a hash of the site's files, computed by the build.
- **Updates:** a new version downloads in the background; `#updateBanner` says "A new version of fmIDE is ready" with **Reload**. It never reloads by itself. Reload saves the autosave first (unsaved changes then come back through recovery), then switches to the new version.
- **Install:** the browser's own install button, plus an **Install fmIDE** command, enabled only when the browser offers installing.
- **Opening `.fmide` by double-click:** the manifest declares `.fmide` files; fmIDE opens a file handed over by the operating system (the browser's `launchQueue`) like Open…, asking about unsaved changes first. Works in Chrome and Edge on desktop once installed; elsewhere Open… works as before.
- **ExcelExporter inside fmIDE:** an **Open ExcelExporter** command opens it in its own window, from the same place fmIDE was loaded (so it also works for `apps/`).
- The service worker is only registered where the page links a manifest (the `site/` build) and the browser allows it (HTTPS or `localhost`), so nothing changes for the files in `apps/`.

**Tests (group 12):** a small local web server (Node only) serves a freshly built site from `localhost`: valid manifest; the service worker installs; the app works offline after the server is stopped; the update notice appears when the version changes and Reload switches to it; `apps/fmIDE.html` registers no service worker; a `.fmide` handed over through a faked `launchQueue` opens as a document (asking first if there are unsaved changes); Open ExcelExporter opens it.

## Phase 5b — publish (after the open decisions)

Deploy `site/` to the chosen host automatically when `main` changes; document the address and how updates reach people.
