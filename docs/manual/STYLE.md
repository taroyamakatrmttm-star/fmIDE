# How the lessons are written

For anyone writing, checking or recording a lesson of [the manual](README.md). The aim: every lesson looks the same, so a reader knows where to find things, a lesson can be read aloud as a video script, and a web page can be built from it later without rewriting.

## The shape of a lesson

```markdown
<a id="timing-conditions"></a>
## Lesson 2.5 — Timing, conditions and rounding

> **Goal:** one sentence: what you can do after this lesson.
> **You need:** the app(s), and a starting point (a new document, a sample file, or the result of an earlier lesson).
> **Time:** about N minutes.
> **In the app:** fmIDE Help → *Timing, conditions and rounding* (`timing-conditions`) · Tutorial *Time: periods and last period* (`time`)
> **Came in:** step 7 (E1a, E1b, E2b) · [#33](…/pull/33), [#34](…/pull/34), [#69](…/pull/69)

One or two sentences: what the feature is and why you would use it.

### Steps
1. One action per step, written as it would be said aloud.
2. …

### Check it
What you should see: the exact numbers, a table when there are several periods.

### Good to know
- Rules, limits, what happens in Excel, what to do when it goes wrong.

### From a script (optional)
A short `window.fm` or `window.fmGraph` version of the same steps.
```

A lesson may have several numbered **sections** (`### 2.5.1 A corkscrew with if`) when it teaches a few small things; each section keeps the Steps / Check it order.

## The fields

| Field | What goes in it |
|---|---|
| **The anchor** (`<a id>`) | A short, lasting name in lower case with dashes, unique in the whole manual. Links use it, not the lesson number, so lessons can be renumbered. Use the Help topic's id when there is one obvious topic. |
| **Goal** | What the reader can do afterwards, in one sentence starting with a verb. |
| **You need** | The app, a starting point, and an earlier lesson if it builds on one. Sample files are named by their path in the repository, such as `tests/fixtures/excel-import/03-two-sheets.xlsx`. |
| **Time** | An honest guess for a first reading with the app open. |
| **In the app** | The matching Help topic, by its title and id (`src/help/fmide-help.js`, `src/help/fmgraph-help.js`, `src/excel-exporter/help/excel-help.js`), and the in-app tutorial, if there is one (`src/help/fmide-tutorials.js`, `src/help/fmgraph-tutorials.js`). A later check may test that every id named here exists. |
| **Came in** | The build step (and phase) and the pull requests that built what the lesson teaches, linked. [Appendix A](appendix-a-coverage.md) lists the same the other way round. |
| **Steps** | Numbered. One action each. Name the button exactly as the app shows it, in bold, with the path to it (**Insert → Excel Functions → if**). Give the keyboard way after the click way. |
| **Check it** | Exact numbers, checked against the apps on `main` before the lesson goes in. Say how they were checked in the pull request. |
| **Good to know** | Short bullets. Limits, the Excel side, what an error means. |
| **From a script** | Only where it helps; the same model as the steps, so the numbers match. |

## Writing

- **Plain words.** Write for someone who knows Excel but not fmIDE. Spell out an abbreviation the first time a lesson uses it.
- **One idea per sentence.** Short sentences read aloud well.
- **Say what the reader will see,** not how the code works.
- **The words of the app.** Copy button names, window titles and messages exactly from the app (search `src/` for the text). Never describe a button by its colour or position alone.
- **Same model throughout a part** where possible, so the numbers build on each other.
- **No claim without a check.** A number in *Check it* is one you saw. A behaviour in *Good to know* is one you tried or one a test pins (name the test group in the pull request).
- **Up to date.** When a feature changes, its lesson changes in the same pull request, as its Help topic and What's new entry do (the rule is in `CLAUDE.md`, *How we work*, item 4): its steps and *Check it* numbers checked again, the pull request added to its *Came in* line, and a row for the pull request in [Appendix A](appendix-a-coverage.md). A feature whose lesson is still *(to come)* gets its Appendix A row only.
- **Text from files is shown as it is.** Lessons never suggest pasting text from someone else's file into a formula or a macro without reading it first.

## Licences

- `README.md`, this file, Parts 1–4 and 6, and the appendices: [CC BY 4.0](../LICENSE-CC-BY-4.0.txt), like fmIDE's and fmGraph's help text, so the manual can be reused in courses, videos and translations.
- Parts 5 and 7 (ExcelExporter): [Apache License 2.0](../../LICENSE), like the rest of `docs/`.
- Write every lesson in its own words. Never copy ExcelExporter's help text (`src/excel-exporter/help/`, under ExcelExporter's own licence) into the manual.

## Videos

Each lesson is meant to become a short video: the *Goal* is the opening line, each step is one spoken line, *Check it* is the closing shot. The in-app tutorials already have scripts and screen recordings (`npm run video-scripts`, `npm run record-tutorials`, `docs/step10-help.md`); a lesson that has an in-app tutorial uses that tutorial's video.

---

*Licensed under [CC BY 4.0](../LICENSE-CC-BY-4.0.txt).*
