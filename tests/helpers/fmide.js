// fmIDE helpers: open the app, import files through the real file chooser, answer the
// in-page dialogs (.modal-box), and catch downloads.
const fs = require('fs');
const { openApp, expect } = require('./apps');

async function openFmIDE(page){
  await openApp(page, 'fmIDE');
  await page.waitForFunction(() => window.fm && typeof window.fm.nodes === 'function');
}

// Run an fmIDE command that opens a file chooser, and answer it with `file`.
async function importViaCommand(page, command, file){
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.evaluate((c) => fm.command(c), command),
  ]);
  await chooser.setFiles(file);
}

// Open a dialog with `openCommand`, then click its import button (label) and pick `file`.
async function importViaDialog(page, openCommand, buttonLabel, file){
  await page.evaluate((c) => fm.command(c), openCommand);
  const button = page.locator('.modal-box button', { hasText: buttonLabel }).first();
  await expect(button).toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles(file);
}

// The topmost in-page dialog.
function topDialog(page){ return page.locator('.modal-box').last(); }

async function confirmDanger(page){
  const ok = topDialog(page).locator('button.danger');
  await expect(ok).toBeVisible();
  await ok.click();
}

async function cancelDialog(page){
  const cancel = topDialog(page).locator('button', { hasText: /^Cancel$/ });
  await expect(cancel).toBeVisible();
  await cancel.click();
}

// Text of the topmost dialog.
async function dialogText(page){
  await expect(topDialog(page)).toBeVisible();
  return (await topDialog(page).locator('p').first().textContent()) || '';
}

// Dismiss a message box (its single OK button).
async function dismissMessage(page){
  const ok = topDialog(page).locator('.modal-actions button', { hasText: /^OK$/ });
  await expect(ok).toBeVisible();
  await ok.click();
}

// Confirm every question (button.danger) and then dismiss the closing message, if any.
// Returns the texts of the dialogs seen, in order.
async function acceptAll(page, max = 5){
  const seen = [];
  for(let i = 0; i < max; i++){
    const box = topDialog(page);
    try{ await box.waitFor({ state: 'visible', timeout: 1500 }); }catch(e){ break; }
    seen.push(await dialogText(page));
    if(await box.locator('button.danger').count()) await box.locator('button.danger').click();
    else await dismissMessage(page);
    await page.waitForTimeout(100);
  }
  return seen;
}

// Run `action` and return the parsed JSON of the file it downloads.
async function downloadJson(page, action){
  const [download] = await Promise.all([page.waitForEvent('download'), action()]);
  const file = await download.path();
  return { name: download.suggestedFilename(), data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

module.exports = { openFmIDE, importViaCommand, importViaDialog, topDialog, dialogText, confirmDanger, cancelDialog, dismissMessage, acceptAll, downloadJson };
