// 8. Snapshots: every sheet's formulas and values (not styles) for each model fixture,
// Inputs tab off and on. Any difference fails and lists the changed cells.
// After a deliberate change: npm run test:update-snapshots
const { test } = require('./helpers/apps');
const X = require('./helpers/excel');
const { matchSnapshot } = require('./helpers/snapshot');
const { MODELS, INPUTS_MODES, variantName } = require('./helpers/models');

for(const model of MODELS){
  for(const inputsOn of INPUTS_MODES){
    test(`${model} — Inputs tab ${inputsOn ? 'on' : 'off'}`, async ({ page }, testInfo) => {
      await X.openExporter(page);
      await X.loadFixtureModel(page, model);
      await X.setInputsTab(page, inputsOn);
      await X.setSections(page, true); // the layout these snapshots pin (off is the default since phase A)
      const { wb } = await X.generate(page);
      matchSnapshot(testInfo, variantName(model, inputsOn), X.formulasAndValues(wb));
    });
  }
}
