// The model fixtures every Excel test runs over.
const fs = require('fs');
const path = require('path');
const { FIXTURES } = require('./apps');

const MODELS = fs.readdirSync(path.join(FIXTURES, 'models')).filter(f => f.endsWith('.json')).sort();
const INPUTS_MODES = [false, true];
const variantName = (model, inputsOn) => model.replace(/\.json$/, '') + (inputsOn ? '--inputs-tab' : '');

module.exports = { MODELS, INPUTS_MODES, variantName };
