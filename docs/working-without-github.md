# Working without GitHub

How to keep building, testing and publishing fmIDE while the GitHub account is unavailable, and how to bring the work back to GitHub afterwards.

**Why this exists.** On 21 October 2026 GitHub suspended the account that owns the two repositories (`taroyamakatrmttm-star/fmIDE` and `taroyamakatrmttm-star/fmide-library`). The owner has asked GitHub's support for the reason. Until it is back, the code lives on the owner's computer and on Codeberg, a free code host, as a backup. The owner chose this on 22 October 2026.

> **Don't open a new GitHub account in the meantime.** GitHub's terms forbid a new account made to get around a suspension, and one could spoil the appeal. Codeberg is the stand-in.

What changes, in short:

| GitHub did | Now |
|---|---|
| Kept the code | Your computer, with Codeberg as the copy elsewhere |
| Ran the tests on every pull request | You (or a Claude Code session on your computer) run them before merging |
| Published the site after a merge | `npm run deploy`, from your computer |
| Pull requests and review | A branch per change; the session summarises it and you approve before it is merged into `main` |
| Claude Code sessions in the cloud | Claude Code on your computer (the desktop app or the terminal), in the folder made below |

Nothing about the apps changes. The live site, `https://fmide.pages.dev`, is hosted by Cloudflare, not GitHub, so it keeps running.

---

## 1. Set up your computer (once)

You need the two backup files, `fmIDE.bundle` and `fmide-library.bundle`, from the session of 22 October 2026. A bundle is the whole repository, every commit and branch, in one file.

1. **Install the tools:**
   - **Git**: `winget install Git.Git` on Windows, or the installer from git-scm.com.
   - **Node.js LTS**: `winget install OpenJS.NodeJS.LTS`, or nodejs.org. Version 22.13 or later; 24, the current LTS, is what GitHub ran. Node 22.12 prints a warning ("CommonJS module … is loading ES Module … using require()") that fails test group 64. Check with `node --version`; a computer with the package `OpenJS.NodeJS.22` updates with `winget upgrade OpenJS.NodeJS.22`, since `winget upgrade OpenJS.NodeJS.LTS` only updates that other package.
   - **LibreOffice** (optional): the Excel recalculation tests need it. Without it they are skipped, which is fine for everyday work.
2. **On Windows, set Git's line endings first**, before cloning:
   ```
   git config --global core.autocrlf false
   git config --global core.eol lf
   ```
   Both are needed. The repository's `.gitattributes` says `* text=auto`, so Git converts line endings to `core.eol`, which on Windows is CRLF by default, even when `core.autocrlf` is false. (Git for Windows also sets `autocrlf=true` in `C:/Program Files/Git/etc/gitconfig`; the global setting overrides it.)

   **If you cloned already without them**, `git status` shows `apps/ExcelExporter.html` and `apps/fmGraph.html` as modified after `npm run build`. (Before 25 October 2026 the build also stopped at the manual, with *appendix-a-coverage.md: the link STYLE.md#videos leads to no anchor in STYLE.md*; the manual's builder now reads Windows line endings, branch `claude/manual-crlf`.) Set both settings, then in each of `fmIDE`, `fmIDE/library` and `fmide-library` (with nothing uncommitted) rewrite the files:
   ```
   git rm -r -q --cached . && git reset --hard
   ```
3. **Make a folder** for the work, for example `C:\code`, and put both bundle files in it. Keep it outside OneDrive (or any other synced folder): syncing a working repository while Git writes to it can damage it. Backups go to OneDrive as bundle files instead (section 5).
4. **Open a terminal there** (on Windows: Git Bash, or PowerShell), and unpack the two repositories next to each other:
   ```
   git clone fmIDE.bundle fmIDE
   git clone fmide-library.bundle fmide-library
   ```
5. **Put `main` on the latest work and connect the library.** The `fmIDE` repository uses the library as a "submodule" (a repository inside a repository, in the folder `library/`). Its address on record is GitHub's, so for now point it at your own copy:
   ```
   cd fmIDE
   git checkout main
   git config submodule.library.url "$(pwd)/../fmide-library"
   git -c protocol.file.allow=always submodule update --init
   ```
   This changes a setting on your computer only; the address written in the repository (`.gitmodules`) stays GitHub's, ready for later.
6. **Install the test tools:**
   ```
   npm install
   npx playwright install chromium
   ```
   `git status` should stay clean afterwards. (Older copies of `package-lock.json` lacked the `"license"` line that npm 10 adds; it has been committed since 25 October 2026. If `npm install` ever changes the lock file anyway, put it back with `git checkout -- package-lock.json`.)
7. **Check it works:** `npm run build`, then `npm run serve` and open `http://localhost:8080/`.
8. **Claude Code on Windows:** the Claude desktop app's **Code** tab works on `C:\code\fmIDE` directly; choose the folder when starting a session. The `claude` command in a terminal exists only if the Claude Code command-line tool is installed as well; it isn't needed.

## 2. Codeberg, the copy elsewhere (once)

1. Create an account at `https://codeberg.org`.
2. Create two **empty, private** repositories, `fmIDE` and `fmide-library`. Untick everything that would add files (README, licence, `.gitignore`).
3. Make an access token, which Git uses as its password: **Settings → Applications → Generate new token**. Give it read and write access to repositories, and keep it somewhere safe.
4. Send everything there, from each folder. Replace `YOU` with your Codeberg name:
   ```
   cd fmIDE
   git remote rename origin github-bundle
   git remote add origin https://codeberg.org/YOU/fmIDE.git
   git remote set-head github-bundle -d
   git push origin 'refs/remotes/github-bundle/*:refs/heads/*'
   git push origin --tags

   cd ../fmide-library
   git remote rename origin github-bundle
   git remote add origin https://codeberg.org/YOU/fmide-library.git
   git remote set-head github-bundle -d
   git push origin 'refs/remotes/github-bundle/*:refs/heads/*'
   ```
   The `push` line sends every branch in the bundle, not only the ones you have opened. When Git asks for a password, give the token. On Windows, Git Credential Manager may instead open the browser and sign in to Codeberg there, without asking for the token; either way works, and it remembers the sign-in.
5. **Make `main` follow Codeberg.** After the push, `main` still follows the bundle's copy (`github-bundle/main`). In each folder:
   ```
   git fetch origin
   git branch -u origin/main main
   ```
   Check: `git status -sb` should start with `## main...origin/main`. From now on `git push` sends to Codeberg.

## 3. Everyday work

The way of working in `CLAUDE.md` stays the same: plan, your approval, one change per branch, build, test, docs in step. Only the GitHub steps change.

1. **Start a change** from the latest `main`, on its own branch:
   ```
   git checkout main
   git checkout -b my-change
   ```
   A Claude Code session on your computer does this itself.
2. **Build and test** as `CLAUDE.md` says: `npm run build`, `npm run build:check`, group 0 and the related groups.
3. **Before merging, run the whole suite**: `npm test`. This is the check GitHub used to run. It takes about 18 minutes on a computer, against 5 on GitHub. Merge only when it is green.

   **When the whole run is red**, run only the tests that failed, alone:
   ```
   npx playwright test --last-failed
   ```
   A test that fails again is a real failure: fix it in the branch, as usual. A test that passes alone but failed in the whole run is not passed over, and not run again until it happens to pass: it is reported to the owner with its cause (usually a test that depends on how fast the computer is while every group runs at once — for example a time limit around the test's own steps), and merging waits for the owner's word. The fix belongs in the test, measuring by the page's own clock, never by raising a limit, skipping or retrying the whole test (as in `claude/reliable-timing-tests`, groups 27 and 52).
4. **Merge** once you have approved:
   ```
   git checkout main
   git merge --no-ff my-change
   git push origin main my-change
   ```
   Keep the branch: it can become a pull request on GitHub later (section 7).
5. **Record it.** Where a pull request number would go (a lesson's *Came in* line, Appendix A, What's new), write the branch name instead, for example `(branch my-change)`. It is changed to the pull request's number once the branch is on GitHub.

## 4. Publishing the site

`npm run deploy` builds the site with the library and uploads it to Cloudflare Pages: the same site, the same address.

Cloudflare's automatic build after each GitHub merge no longer runs, and Codeberg isn't connected to Cloudflare. That is deliberate: we chose not to automate publishing from Codeberg, so that publishing depends only on your computer and Cloudflare. The first time, sign in to Cloudflare:

```
npx --yes wrangler@4 login
```

A browser window opens; sign in with the account that holds the `fmide` project. Then, each time:

1. Be on `main`, with the whole suite green (section 3).
2. Bring the library to its latest `main` (the `fmide-library` folder's). The live site always shows the library's latest packs:
   ```
   git -C library fetch origin
   git -C library checkout --detach origin/main
   ```
   `git status` will then show `library` as changed: that is expected, and nothing to commit unless a change asks to move the library's pinned commit.
3. Publish:
   ```
   npm run deploy
   ```
   It stops, and publishes nothing, if the library fails fmIDE's checks; the message says why. People get the new version through the usual "a new version is ready" notice.

**A preview first** (what a pull request's preview link used to be): after `npm run build`, run `npx --yes wrangler@4 pages deploy site --project-name=fmide --branch=my-change`. It prints a preview address; the live site is not touched.

**The showcase gallery** (phase V6): `npm run build` and `npm run deploy` put `/gallery` on the site when `gallery/` holds made viewers (or give `node tools/build.js --site site --gallery DIR`). `gallery/` is meant to be a repository of its own on Codeberg, added as a submodule (`git submodule add <its address> gallery`); until then any folder works with `--gallery`.

**What no longer happens by itself:**
- The hourly rebuild that published newly merged library packs. Publish by hand after the library changes.
- Pull-request previews.

## 5. Backups that don't depend on any website

Codeberg is one copy elsewhere, but it is a website too. Keep a second copy that depends on none: a bundle of each repository in OneDrive. Refresh it regularly, for example once a week and after each merge, in Git Bash:

```
B="/c/Users/admin/OneDrive/Taro Yamaka/fmIDE/00 Working folder"
git -C /c/code/fmIDE bundle create "$B/fmIDE-$(date +%F).bundle" --all
git -C /c/code/fmide-library bundle create "$B/fmide-library-$(date +%F).bundle" --all
git bundle verify "$B/fmIDE-$(date +%F).bundle"
```

Each file holds every commit and branch, named by the day it was made; older ones can be deleted once a newer one verifies. To restore, clone from the bundle as in section 1.

`C:\code` itself is deliberately outside OneDrive: syncing a working repository while Git writes to it can damage it, so only the finished bundle files go there.

## 6. The community library meanwhile

- **Sharing packs is paused.** fmIDE's **Share in the Community Library…** opens GitHub's upload page, which won't work while the account is suspended. Packs already on the site can still be browsed and downloaded.
- **Your own packs:** add them to `fmide-library` yourself (its `packs/` folder) and check them with `npm run check-pack -- FILE` in `fmIDE`. Commit, push to Codeberg, then publish (section 4).

## 7. When GitHub is back

Git history moves between hosts unchanged, so nothing is redone.

1. **Add GitHub back** as a second place to push, in each folder:
   ```
   cd fmIDE
   git remote add github https://github.com/taroyamakatrmttm-star/fmIDE.git
   git fetch github
   ```
2. **Check nothing changed on GitHub meanwhile.** It shouldn't have, since nobody could reach it. `git log --oneline main..github/main` should print nothing.
3. **Send the work:**
   - **Simplest:** `git push github main`, and the same in `fmide-library`. Everything arrives as it is, without pull-request pages.
   - **Closer to the old record:** push the branches (`git push github my-change` for each), open a pull request for each on GitHub, and merge them in order, oldest first. GitHub's tests run on each, as before.
4. **Put the library's address back** to GitHub's on your computer:
   ```
   git config --unset submodule.library.url
   git submodule sync
   ```
5. **Pull-request numbers:** replace the `(branch …)` notes from section 3 with the numbers GitHub gave.
6. **Back to normal:** GitHub's tests, deploys and the hourly library rebuild start again by themselves. Keep Codeberg as a second copy (`git push origin` as well), or delete it.
7. **Claude Code in the cloud** works again once the GitHub connection on claude.ai is restored.

## 8. If GitHub never comes back

Codeberg then becomes the home. The project names GitHub in a few places, and a session can update them in one change once the new addresses are known:

- `.gitmodules` (the library's address)
- `src/fmide/js/11e-library-packs.js` (`LIBRARY_UPLOAD_URL`, where Share in the Community Library… sends people) and the `share-library-pack` Help topic in `src/help/fmide-help.js`
- `tools/build-library.js` and `tools/build-manual.js` (links on the site's catalogue and manual pages), and their tests (groups 22, 25 and 81)
- the manual's links to pull requests and files (`docs/manual/`), and `README.md`
- the library repository's own instructions and checker workflow
- the publishing workflow, `.github/workflows/`, which would become Codeberg's own (Forgejo Actions), or stay with `npm run deploy`
