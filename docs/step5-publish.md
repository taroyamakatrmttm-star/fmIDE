# Build step 5 — publish the web app

**Goal:** fmIDE becomes an installable web app (PWA — progressive web app): it installs like a normal program (own window and icon), works offline, updates itself safely, and opens `.fmide` files by double-click where the browser allows. Then it is published at a public HTTPS address.

**Decisions already made:**

- **One app** (24 Sep 2026): fmIDE and ExcelExporter install as one app; ExcelExporter opens from inside fmIDE.
- `apps/*.html` stay single self-contained files that work opened straight from disk. The published site is built from the same `src/`.

**Decided for 5b (25 Sep 2026):** open core with two licences (`LICENSING.md`, decision 3 in `docs/decisions.md`); hosting on Cloudflare Pages, on its free address for now (both can change later — but a new address means reinstalling, and browser-stored data such as the autosave and Recent does not move with it, so a custom domain is best chosen before the app is shared widely).

## Phase 5a — make it a PWA (nothing published yet)

A PWA needs three things the single files can't carry: a **web app manifest** (name, icons, colours, file types it opens), a **service worker** (a script the browser keeps, which stores the app's files for offline use and fetches new versions), and HTTPS hosting. The manifest and service worker must be separate files, so:

- **`npm run build` also writes `site/`** (not committed; ignored by Git): `index.html` (fmIDE), `ExcelExporter.html`, `manifest.webmanifest`, `sw.js`, `icons/`. Its sources are `src/site/`. The fmIDE page in `site/` differs from `apps/fmIDE.html` only by the lines that link the manifest and icons (the `<!-- build:site-head -->` marker, which is empty in `apps/`).
- **Offline:** the service worker stores the site's own files and nothing else (still no requests to any other site); after the first visit everything works offline. Its cache name carries a version: a hash of the site's files, computed by the build.
- **Updates:** a new version downloads in the background; `#updateBanner` says "A new version of fmIDE is ready" with **Reload**. It never reloads by itself. Reload saves the autosave first (unsaved changes then come back through recovery), then switches to the new version. ExcelExporter shows the same notice ("A new version of ExcelExporter is ready"): Reload keeps the layout, and the model file is loaded again. A new version can only take over when a page asks, so once one tab has switched, every other open tab of the site gets the notice too (its Reload just reloads). The notice lives once in `src/shared/update-notice.js`; ExcelExporter never registers the service worker itself.
- **Install:** the browser's own install button, plus an **Install fmIDE** command, enabled only when the browser offers installing.
- **Opening `.fmide` by double-click:** the manifest declares `.fmide` files; fmIDE opens a file handed over by the operating system (the browser's `launchQueue`) like Open…, asking about unsaved changes first. Works in Chrome and Edge on desktop once installed; elsewhere Open… works as before.
- **ExcelExporter inside fmIDE:** an **Open ExcelExporter** command opens it in its own window, from the same place fmIDE was loaded (so it also works for `apps/`).
- The service worker is only registered where the page links a manifest (the `site/` build) and the browser allows it (HTTPS or `localhost`), so nothing changes for the files in `apps/`.

**Tests (group 12):** a small local web server (Node only) serves a freshly built site from `localhost`: valid manifest; the service worker installs; the app works offline after the server is stopped; the update notice appears when the version changes and Reload switches to it; `apps/fmIDE.html` registers no service worker; a `.fmide` handed over through a faked `launchQueue` opens as a document (asking first if there are unsaved changes); Open ExcelExporter opens it.

**Done (5a)** — how it turned out:

- `tools/build.js` exports `buildSite(dir)` and takes `--site DIR`; `npm run build` writes `site/`, `npm run serve` (`tools/serve.js`) shows it at `http://localhost:8080/`. The icons are a placeholder (`src/site/icons/icon.svg`, PNGs rendered from it).
- The mobile viewport line was left out of the site page: touch support comes later, and it would change the layout on phones.
- Code in `src/fmide/js/21-web-app.js` (the start-up piece is now `22-`). New commands **Open ExcelExporter** and **Install fmIDE** in an App group on the default File tab (customised ribbons reach them through the Command Launcher and Customize Ribbon).
- The manifest asks the browser to reuse the open window for a double-clicked file (`launch_handler: focus-existing`), so two windows don't compete for the same autosave.
- Tests: group 12 (`tests/12-web-app.spec.js`, `npm run test:web-app`), including Chrome's own installability check.

## Phase 5b — publish

**Part 1 — licences ✅:** `LICENSE` (Apache 2.0, official text), `NOTICE` (copyright), `src/excel-exporter/LICENSE` (proprietary, free to use), `docs/LICENSE-CC-BY-4.0.txt` (file-format docs), `LICENSING.md` (which covers what), `CONTRIBUTING.md` (no outside contributions until a CLA). Each app's `index.html` carries a licence comment; `tools/build.js` ships `LICENSE.txt`, `NOTICE.txt` and `ExcelExporter-LICENSE.txt` with the site (tested in group 12). The licence texts are drafts for a lawyer to review before the repository goes public.

**Part 2 — automatic publishing ✅:** the `deploy` job in `.github/workflows/tests.yml` runs after the tests pass. It builds the site (`node tools/build.js --site site`) and uploads it with Cloudflare's `wrangler` tool (version 4, fetched by `npx` on GitHub only — never part of the apps), creating the Pages project `fmide` the first time.

- **Merge into `main`** → the live site, `https://fmide.pages.dev` (Cloudflare shows the exact address in the project and in the job's summary). People get it through the update notice (5a): a new version downloads in the background and **Reload** switches to it.
- **Pull request** (from this repository) → a preview address of its own, posted as a comment on the pull request and updated on every push. The comment leads with the address of that exact version (new for every push, so no copy the browser saved earlier can stand in for it), then the branch address, which always shows the latest (after Reload on its notice, if the browser saved an older copy); the live site does not change until the merge. Preview addresses are public to anyone who has the link.
- **Secrets:** `CLOUDFLARE_API_TOKEN` (a Cloudflare token with only the Cloudflare Pages: Edit permission) and `CLOUDFLARE_ACCOUNT_ID`, in the repository's Settings → Secrets and variables → Actions. Without them the job notes "Not published" and succeeds, so the tests stay green. A leaked token: delete it in Cloudflare, create a new one, replace the secret.
- **How Cloudflare serves it** (copied locally by `tools/pages-server.js`, used by `npm run serve` and the tests): short page addresses (`/index.html` → `/`, `/ExcelExporter.html` → `/ExcelExporter`), and the `_headers` file the build writes. The service worker stores clean copies of redirected pages, because a browser refuses to show a page the service worker answers with a redirected response — without that, ExcelExporter did not open offline (found by the tests).
- **Security policy (`_headers`):** each page may run only its own inline scripts, identified by SHA-256 hashes the build computes, and may connect only to the site itself: nothing from another site can be loaded, sent to or embedded, and a script injected through a malicious file is refused. Also `nosniff`, no referrer, no camera/microphone/location, and `sw.js` never cached. The tests run both apps through a whole workflow under the policy with no violations, and check that an injected script is blocked (also in pages served from the offline copy).

## The community library's catalogue (step 8, phase 8c-3)

The site also carries `/library`, the catalogue of the community library's approved packs, built from the `library/` git submodule (`docs/step8-community-library.md`, "Phase 8c-3 — how it turned out"). It is plain HTML with no JavaScript, under its own security policy (no scripts at all; styles only from the site; pack files download). It is left out of the service worker's offline copy and of the app's version, so publishing a pack never shows "a new version is ready". The deploy job fetches the submodule at its pinned commit (the library repository is public, so no key or extra secret is needed) and builds with `--require-library`: a missing library, or a pack that fails the library checker, stops the deploy, and nothing is published.
