// fmIDE documents: fake File System Access pickers and small helpers.
// The test origin is not a secure context, so Chromium offers no showOpenFilePicker /
// showSaveFilePicker there: by default fmIDE takes the fallback path (file input and
// downloads). installFakePickers() adds fakes that behave like the real API and record
// what was written:
//   window.__files[name]    the fake disk: file name → text
//   window.__nextOpen       the name showOpenFilePicker returns next
//   window.__nextSaveName   the name showSaveFilePicker returns next (default: suggested)
//   window.__saveAsCalls    suggestedName of every showSaveFilePicker call
//   window.__writes         [{ name, text }] in order
const fs = require('fs');

function installFakePickers(page){
  return page.addInitScript(() => {
    window.__files = {};
    window.__saveAsCalls = [];
    window.__writes = [];
    const handleFor = (name) => ({
      kind: 'file', name,
      async getFile(){ return new File([window.__files[name] || ''], name); },
      async createWritable(){
        let text = '';
        return {
          async write(t){ text += String(t); },
          async close(){ window.__files[name] = text; window.__writes.push({ name, text }); }
        };
      },
      async queryPermission(){ return 'granted'; },
      async requestPermission(){ return 'granted'; },
      async isSameEntry(other){ return !!other && other.name === name; }
    });
    window.showOpenFilePicker = async () => [handleFor(window.__nextOpen)];
    window.showSaveFilePicker = async (opts) => {
      window.__saveAsCalls.push(opts && opts.suggestedName);
      const name = window.__nextSaveName || (opts && opts.suggestedName) || 'Untitled.fmide';
      window.__nextSaveName = null;
      return handleFor(name);
    };
  });
}

// Puts a file on the fake disk.
function putFakeFile(page, name, text){
  return page.evaluate(({ name, text }) => { window.__files[name] = text; }, { name, text });
}

// Writes `text` to a real temporary file called `name` (for the file input path).
function tempFile(testInfo, name, text){
  const p = testInfo.outputPath(name);
  fs.writeFileSync(p, text);
  return p;
}

// Runs an fmIDE command that opens the document file input, and answers it with `file`.
async function openViaInput(page, command, file){
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate((c) => fm.command(c), command),
  ]);
  await chooser.setFiles(file);
}

const title = (page) => page.evaluate(() => document.title);

module.exports = { installFakePickers, putFakeFile, tempFile, openViaInput, title };
