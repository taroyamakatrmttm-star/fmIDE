// JSON snapshots under tests/snapshots/. A difference fails the test and lists the changed
// cells. `npm run test:update-snapshots` (Playwright's --update-snapshots) rewrites them.
const fs = require('fs');
const path = require('path');
const { expect } = require('./apps');

const DIR = path.resolve(__dirname, '..', 'snapshots');

function diffSheets(expected, actual){
  const lines = [];
  const sheets = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for(const s of sheets){
    if(!(s in expected)){ lines.push(`+ sheet "${s}" (new)`); continue; }
    if(!(s in actual)){ lines.push(`- sheet "${s}" (missing)`); continue; }
    const e = expected[s], a = actual[s];
    for(const addr of new Set([...Object.keys(e), ...Object.keys(a)])){
      const x = JSON.stringify(e[addr]), y = JSON.stringify(a[addr]);
      if(x !== y) lines.push(`  ${s}!${addr}: ${x === undefined ? '(empty)' : x} -> ${y === undefined ? '(empty)' : y}`);
    }
  }
  return lines;
}

// One cell per line, so a changed cell is a one-line diff in Git too.
function serialize(sheets){
  const names = Object.keys(sheets);
  return '{\n' + names.map((s, i) => {
    const cells = Object.entries(sheets[s]).map(([addr, v]) => '  ' + JSON.stringify(addr) + ': ' + JSON.stringify(v));
    return ' ' + JSON.stringify(s) + ': {' + (cells.length ? '\n' + cells.join(',\n') + '\n }' : '}') + (i < names.length - 1 ? ',' : '');
  }).join('\n') + '\n}\n';
}

function matchSnapshot(testInfo, name, actual){
  const file = path.join(DIR, name + '.json');
  const text = serialize(actual);
  if(JSON.stringify(JSON.parse(text)) !== JSON.stringify(actual)) throw new Error('snapshot serializer lost data');
  const update = testInfo.config.updateSnapshots === 'all' || testInfo.config.updateSnapshots === 'changed';
  if(update || !fs.existsSync(file)){
    if(!update && process.env.CI) throw new Error(`Snapshot ${name}.json is missing. Run "npm run test:update-snapshots" and commit it.`);
    fs.mkdirSync(DIR, { recursive: true });
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if(old !== text) fs.writeFileSync(file, text);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  const changes = diffSheets(expected, actual);
  expect(changes, `Snapshot ${name}.json differs (${changes.length} cell(s)). If the change is deliberate, run "npm run test:update-snapshots".\n` + changes.slice(0, 200).join('\n')).toEqual([]);
}

module.exports = { matchSnapshot };
