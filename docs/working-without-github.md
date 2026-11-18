# Working on this computer

How fmIDE is built, tested, kept and published now: on the owner's computer, with GitHub as the main copy elsewhere and Codeberg as a second copy, and with GitHub's automatic runs switched off.

**How it came to this.** On 21 October 2026 GitHub suspended the account that owns the repositories. From 22 October the work moved to the owner's computer, with Codeberg (a free code host) as the copy elsewhere. The account came back about 14 November 2026, and on 18 November GitHub became the main copy again. The owner chose to keep **GitHub Actions** (GitHub's automatic test and publishing runs) **switched off**, since heavy use of them may have led to the suspension, so the tests and publishing stay on this computer. The file keeps its old name so the links to it still work.

| What | Where it happens now |
|---|---|
| The code | This computer (`C:\code\fmIDE`, `C:\code\fmide-library`); copies on GitHub (`origin`) and Codeberg (`codeberg`) |
| The tests | This computer: the related groups while working, the whole suite (`npm test`) before a merge and before publishing |
| Publishing the site | `npm run deploy`, from this computer |
| Pull requests | When the owner asks for one; otherwise a branch per change, approved by the owner, merged into `main` on this computer |
| The showcase gallery | Its own repository, on Codeberg only (`gallery/`, a submodule) |

> **Never switch GitHub Actions back on**, and never start the workflows in `.github/workflows/` (`tests.yml`, `record-videos.yml`) by hand. They stay in the repository, unused, in case the owner decides otherwise.

---

## 1. Set up a computer (once)

1. **Install the tools:**
   - **Git**: `winget install Git.Git` on Windows, or the installer from git-scm.com.
   - **Node.js LTS**: `winget install OpenJS.NodeJS.LTS`, or nodejs.org. Version 22.13 or later. Node 22.12 prints a warning ("CommonJS module … is loading ES Module … using require()") that fails test group 64. Check with `node --version`; a computer with the package `OpenJS.NodeJS.22` updates with `winget upgrade OpenJS.NodeJS.22`, since `winget upgrade OpenJS.NodeJS.LTS` only updates that other package.
   - **LibreOffice** (`winget install TheDocumentFoundation.LibreOffice`): the Excel recalculation tests need it. Without it they are skipped. Since nothing on GitHub runs them any more, it is worth having.
2. **On Windows, set Git's line endings first**, before cloning:
   ```
   git config --global core.autocrlf false
   git config --global core.eol lf
   ```
   Both are needed. The repository's `.gitattributes` says `* text=auto`, so Git converts line endings to `core.eol`, which on Windows is CRLF by default, even when `core.autocrlf` is false. (Git for Windows also sets `autocrlf=true` in `C:/Program Files/Git/etc/gitconfig`; the global setting overrides it.)

   **If you cloned already without them**, `git status` shows `apps/ExcelExporter.html` and `apps/fmGraph.html` as modified after `npm run build`. Set both settings, then in each of `fmIDE`, `fmIDE/library` and `fmide-library` (with nothing uncommitted) rewrite the files:
   ```
   git rm -r -q --cached . && git reset --hard
   ```
3. **Make a folder** for the work, for example `C:\code`. Keep it outside OneDrive (or any other synced folder): syncing a working repository while Git writes to it can damage it. Backups go to OneDrive as bundle files instead (section 4).
4. **Clone the two repositories next to each other** from GitHub (or, on a computer without GitHub access, from Codeberg or a bundle file: `git clone fmIDE.bundle fmIDE`):
   ```
   git clone https://github.com/<owner>/fmIDE.git
   git clone https://github.com/<owner>/fmide-library.git
   ```
5. **Add the second copy and connect the submodules.** In `fmIDE`:
   ```
   cd fmIDE
   git remote add codeberg https://codeberg.org/<owner>/fmIDE.git
   git config submodule.library.url "$(pwd)/../fmide-library"
   git -c protocol.file.allow=always submodule update --init
   ```
   The library setting points the submodule at the copy next door, on this computer only; `.gitmodules` keeps GitHub's address. The `gallery` submodule comes from Codeberg. Do the same `git remote add codeberg …` in `fmide-library`.
6. **Install the test tools:**
   ```
   npm install
   npx playwright install chromium
   ```
   `git status` should stay clean afterwards. If `npm install` ever changes `package-lock.json`, put it back with `git checkout -- package-lock.json`.
7. **Check it works:** `npm run build`, then `npm run serve` and open `http://localhost:8080/`.
8. **Claude Code on Windows:** the Claude desktop app's **Code** tab works on `C:\code\fmIDE` directly; choose the folder when starting a session.

## 2. Everyday work

The way of working in `CLAUDE.md` stays the same: plan, the owner's approval, one change per branch, build, test, docs in step.

1. **Start a change** from the latest `main`, on its own branch:
   ```
   git checkout main
   git checkout -b my-change
   ```
2. **Build and test** as `CLAUDE.md` says: `npm run build`, `npm run build:check`, group 0 and the related groups.
3. **Before merging, run the whole suite**: `npm test` (about 18 minutes). Merge only when it is green.

   **When the whole run is red**, run only the tests that failed, alone:
   ```
   npx playwright test --last-failed
   ```
   A test that fails again is a real failure: fix it in the branch, as usual. A test that passes alone but failed in the whole run is not passed over, and not run again until it happens to pass: it is reported to the owner with its cause (usually a test that depends on how fast the computer is while every group runs at once — for example a time limit around the test's own steps), and merging waits for the owner's word. The fix belongs in the test, measuring by the page's own clock, never by raising a limit, skipping or retrying the whole test (as in `claude/reliable-timing-tests`, groups 27 and 52).
4. **Merge** once the owner has approved, then send `main` and that one branch to both copies:
   ```
   git checkout main
   git merge --no-ff my-change
   git push origin main my-change
   git push codeberg main my-change
   ```
   Push only `main` and the branch just worked on: no pushes of every branch at once, and no bursts of pushes from several sessions together. If a push fails, wait and try once more later; never retry in a loop.
5. **Pull requests:** when the owner asks for one, push the branch and open it on GitHub as before (no tests run there: say in it which tests ran here). Otherwise, where a pull request number would go (a lesson's *Came in* line, Appendix A, What's new), write the branch name instead, for example `(branch my-change)`.

## 3. Publishing the site

`npm run deploy` builds the site with the library and uploads it to Cloudflare Pages (the project `fmide`, `https://fmide.pages.dev`). Cloudflare is not connected to GitHub or Codeberg, so a merge publishes nothing by itself; publishing depends only on this computer and Cloudflare. The first time, sign in to Cloudflare:

```
npx --yes wrangler@4 login
```

A browser window opens; sign in with the account that holds the `fmide` project. Then, each time:

1. Be on `main`, with the whole suite green (section 2).
2. Bring the library to its latest `main`. The live site always shows the library's latest packs:
   ```
   git -C library fetch origin
   git -C library checkout --detach origin/main
   ```
   `git status` will then show `library` as changed: that is expected, and nothing to commit unless a change asks to move the library's pinned commit.
3. Publish:
   ```
   npm run deploy
   ```
   It stops, and publishes nothing, if the library fails fmIDE's checks; the message says why. People get the new version through the usual "a new version is ready" notice. If the upload fails (a timeout, a dropped connection), try once more later, not in a loop.

**A preview first:** after `npm run build`, run `npx --yes wrangler@4 pages deploy site --project-name=fmide --branch=my-change`. It prints a preview address; the live site is not touched.

**The showcase gallery:** `npm run build` and `npm run deploy` put `/gallery` on the site from the made viewers in `gallery/` (or `node tools/build.js --site site --gallery DIR`).

**What no longer happens by itself**, with Actions off:
- the tests on every pull request (run them here, section 2);
- the hourly rebuild that published newly merged library packs: publish by hand after the library changes;
- pull-request previews (use the preview above).

## 4. Backups that don't depend on any website

GitHub and Codeberg are both websites. Keep a third copy that depends on neither: a bundle of each repository in OneDrive. Refresh it once a week and after a large merge, in Git Bash:

```
B="/c/Users/admin/OneDrive/<owner>/fmIDE/00 Working folder"
git -C /c/code/fmIDE bundle create "$B/fmIDE-$(date +%F).bundle" --all
git -C /c/code/fmide-library bundle create "$B/fmide-library-$(date +%F).bundle" --all
git -C /c/code/fmIDE/gallery bundle create "$B/fmide-gallery-$(date +%F).bundle" --all
git bundle verify "$B/fmIDE-$(date +%F).bundle"
```

Each file holds every commit and branch, named by the day it was made; older ones can be deleted once a newer one verifies. To restore, clone from the bundle as in section 1. These files are private: never commit them.

## 5. The community library

- **Sharing packs works again**: fmIDE's **Share in the Community Library…** opens GitHub's upload page for the library. With Actions off, the library's checker doesn't run on a shared pack by itself: check it here with `npm run check-pack -- FILE` (or `--library DIR`) before merging it, then publish (section 3).
- **Your own packs:** add them to `fmide-library` (its `packs/` folder), check them as above, commit, push to both copies, then publish.

## 6. If GitHub became unavailable again

Codeberg holds every commit too, so work carries on as in October 2026: make `codeberg` the place `main` follows (`git branch -u codeberg/main main`), push there only, and keep publishing with `npm run deploy`. Don't open a new GitHub account to get round a suspension: GitHub's terms forbid it. The places that name GitHub, should Codeberg ever become the home:

- `.gitmodules` (the library's address)
- `src/fmide/js/11e-library-packs.js` (`LIBRARY_UPLOAD_URL`, where Share in the Community Library… sends people) and the `share-library-pack` Help topic in `src/help/fmide-help.js`
- `tools/build-library.js` and `tools/build-manual.js` (links on the site's catalogue and manual pages), and their tests (groups 22, 25 and 81)
- the manual's links to pull requests and files (`docs/manual/`), and `README.md`
- the library repository's own instructions and checker workflow
