(function(){
'use strict';

// ============================================================
// Core translation: the model's calculation comes from the shared IR (src/shared/ir.js,
// compileModel — the same one fmIDE calculates on), with the shared operator catalogue and
// units; this file turns it into Excel formulas.
// ============================================================

// build:include shared/operators.js
// build:include shared/uom.js
// build:include shared/input-rule.js
// build:include shared/functions.js
// build:include shared/ir.js
// The formulas themselves are modules (step 3c-4), in src/excel-exporter/formulas/.
// build:include excel-exporter/formulas/core-translation.js
// build:include excel-exporter/formulas/operator-spellings.js
// build:include excel-exporter/formulas/function-calls.js
