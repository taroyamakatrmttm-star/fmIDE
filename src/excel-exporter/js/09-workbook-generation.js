// ============================================================
// Workbook generation
// ============================================================
function periodLabels(){
  const n = model.periods.length;
  const labels = [];
  const start = mapping.cfg.startLabel.trim();
  const freq = mapping.cfg.frequency;
  const startYearMatch = /^\d{4}$/.test(start) ? parseInt(start, 10) : null;
  for(let i = 0; i < n; i++){
    if(startYearMatch !== null){
      if(freq === 'annual') labels.push(String(startYearMatch + i));
      else if(freq === 'quarterly') labels.push((startYearMatch + Math.floor(i / 4)) + ' Q' + ((i % 4) + 1));
      else labels.push((startYearMatch + Math.floor(i / 12)) + '-' + String((i % 12) + 1).padStart(2, '0'));
    } else {
      labels.push(start + (n > 1 ? ' +' + i : ''));
    }
  }
  return labels;
}

function buildCtx(){
  const canvasById = {}; model.canvases.forEach(c => { if(!canvasById[c.id]) canvasById[c.id] = c; });
  const tabById = {}; mapping.tabs.forEach(t => tabById[t.id] = t);
  // Row ids (canvasId|nodeId, same key shape operandRef uses) flagged to be spliced
  // directly into referencing formulas as a literal instead of getting their own row.
  const inlineConstantIds = new Set(mapping.rows.filter(r => r.inlineConstant).map(r => r.id));
  const cellPos = {};
  const rowsByTabOrdered = {}; // tabId -> [{row, excelRow, section, isCustom}] in the order they'll be written
  mapping.tabs.forEach(t => rowsByTabOrdered[t.id] = []);
  const sectioned = sectionsEnabled();
  const scenarioBlocks = {}; // Inputs-tab variable row id -> { first, n } (its scenario rows)
  // Sensitivity (09g-sensitivity.js): each input it moves, by its Inputs-tab row id. One
  // without scenarios gets a base row above it (sensBase: row id -> that row's number).
  const plan = sensitivityPlan();
  const sens = plan && !plan.problem ? plan : null;
  const sensMoved = new Map(sens ? sens.variables.map((v, i) => [v.mirror.id, i]) : []);
  const sensBase = {};
  const reserveRows = (row, r) => {
    r = reserveScenarioRows(row, r, scenarioBlocks);
    if(sensMoved.has(row.id) && !scenarioBlocks[row.id]){ sensBase[row.id] = r; r++; }
    return r;
  };
  const blankAfter = (row) => scenarioBlocks[row.id] || sensBase[row.id] !== undefined;
  mapping.tabs.forEach(t => {
    let r = 4; // row 1: tab title, row 2: period header, row 3: blank
    if(sectioned){
      ['input', 'calc', 'output'].forEach(sec => {
        const combined = combinedRowsFor(t.id, sec);
        if(combined.length === 0) return;
        r++; // section header row
        combined.forEach(row => {
          r = reserveRows(row, r);
          if(!row.isCustom) cellPos[row.id] = { tabName: tabById[row.tabId].name, row: r };
          rowsByTabOrdered[t.id].push({ row, excelRow: r, section: sec, isCustom: !!row.isCustom });
          r++;
          if(blankAfter(row)) r++; // blank row after each scenario block (or base row)
        });
        r++; // blank spacer row after section
      });
    } else {
      // Flat mode: one continuous list, no section header/spacer rows at all — section
      // is still carried through on each entry (it's what a row's own tag reads from
      // elsewhere), it just no longer drives physical row placement here.
      combinedRowsForTab(t.id).forEach(row => {
        r = reserveRows(row, r);
        if(!row.isCustom) cellPos[row.id] = { tabName: tabById[row.tabId].name, row: r };
        rowsByTabOrdered[t.id].push({ row, excelRow: r, section: row.section, isCustom: !!row.isCustom });
        r++;
        if(blankAfter(row)) r++; // blank row after each scenario block (or base row)
      });
    }
  });
  return { canvasById, cellPos, periodCount: model.periods.length, rowsByTabOrdered, tabById, inlineConstantIds, scenarioBlocks, sens, sensMoved, sensBase };
}

// Scenario rows sit directly above their variable's own row on the Inputs tab.
function reserveScenarioRows(row, r, scenarioBlocks){
  const n = scenarioCountOf(row);
  if(!n) return r;
  scenarioBlocks[row.id] = { first: r, n };
  return r + n;
}

// Builds the workbook and downloads it.
function generateWorkbook(){
  const built = buildWorkbook();
  XLSX.writeFile(built.wb, (mapping.cfg.fileName || 'fmIDE-export').replace(/\.xlsx$/i, '') + '.xlsx');
}

// Builds the workbook without downloading it: { wb, tooLong }, where `tooLong` lists the
// cells whose formula (with a function call written out in full) goes past Excel's limits
// and is written as NA() instead: [{ row, tabName, periods: [1-based], problem }] (the
// check before download reads it too).
function buildWorkbook(){
  if(typeof XLSX === 'undefined'){
    throw new Error('The built-in Excel writer is missing — this copy of ExcelExporter looks damaged.');
  }
  const ctx = buildCtx();
  const tooLong = [];
  // Function versions whose calls are written out: key -> { fn, rows: Set of "label (tab)" }.
  const functionUses = new Map();
  let functionUseRow = null;
  ctx.onFunction = (fn) => {
    const key = fn.family + '@' + fn.version;
    if(!functionUses.has(key)) functionUses.set(key, { fn, rows: new Set() });
    if(functionUseRow) functionUses.get(key).rows.add(functionUseRow);
  };
  const labels = periodLabels();
  // Helper-column plan: one slot per indexed input of each vertical instance whose
  // vintage rows are written; the workbook gets as many helper columns as the widest
  // instance needs, on every tab. Each tab's headers name its own instance's inputs
  // (generic "Helper n" if a tab mixes instances with different inputs).
  const helperPlanByHop = {};
  const helperHeadersByTab = {};
  let maxSlots = 0;
  Object.keys(ctx.rowsByTabOrdered).forEach(tabId => {
    ctx.rowsByTabOrdered[tabId].forEach(({ row, isCustom }) => {
      if(isCustom || !row.path || !row.path.length) return;
      const hop = row.path[row.path.length - 1];
      if(typeof hop.vIndex !== 'number') return;
      const hk = hop.canvasId + '|' + hop.nodeId;
      if(!helperPlanByHop[hk]){
        const ports = indexedPortsOf(ctx, hop.canvasId, hop.nodeId);
        helperPlanByHop[hk] = { hopCanvasId: hop.canvasId, hopNodeId: hop.nodeId, ports, slotByPort: Object.fromEntries(ports.map((pt, i) => [pt.portIndex, i])) };
      }
      const plan = helperPlanByHop[hk];
      maxSlots = Math.max(maxSlots, plan.ports.length);
      const names = plan.ports.map(pt => pt.name + ' @ vintage');
      const prev = helperHeadersByTab[tabId];
      if(!prev) helperHeadersByTab[tabId] = names;
      else if(prev.join('\u0000') !== names.join('\u0000')) helperHeadersByTab[tabId] = prev.map((x, i) => 'Helper ' + (i + 1));
    });
  });
  useHelperColumns(maxSlots);
  // Scenarios plan: every scenario variable written on the Inputs tab, in that tab's
  // order, gets one row on the Scenarios tab (from row 4).
  const scenarioVars = inputsEnabled() ? (ctx.rowsByTabOrdered[INPUTS_TAB_ID] || []).filter(e => ctx.scenarioBlocks[e.row.id]) : [];
  const scenarioSheetName = scenarioVars.length ? uniqueTabName('Scenarios', null).name : null;
  const scenarioRowOf = {};
  const nCases = scenarioVars.length ? globalCaseCount() : 0;
  const SCN_FIRST_ROW = nCases ? 8 : 4; // with global cases: case block rows 2-3, "Scenarios" section from row 5
  scenarioVars.forEach((e, i) => { scenarioRowOf[e.row.id] = SCN_FIRST_ROW + i; });
  const HDR = (extra) => roleCellStyle('Headers', extra);
  // Sensitivity: its tab's name and where everything on it sits, known before the Inputs tab
  // (whose moved inputs read it) is written.
  const sensLay = ctx.sens ? sensitivityLayout(ctx.sens, addedTabName('Sensitivity', [scenarioSheetName || ''])) : null;
  try{
  const nPeriods = model.periods.length;
  const fallbackFmt = mapping.cfg.fallbackFormat || 'General';
  const wb = XLSX.utils.book_new();

  const sortedTabs = mapping.tabs.slice().sort((a, b) => a.order - b.order);
  sortedTabs.forEach(tab => {
    const rows = ctx.rowsByTabOrdered[tab.id];
    if(!rows || rows.length === 0) return; // skip empty tabs entirely
    const aoa = [];
    aoa[0] = [tab.name];
    aoa[1] = ['Line item', 'UOM'].concat(labels);
    const ws = {};
    const merges = [];

    function setCell(addr, cell){ ws[addr] = cell; }
    // Sheet title: the Headers role's font, a little larger, without the header-row fill.
    setCell('A1', { t: 's', v: tab.name, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) });
    setCell('A2', { t: 's', v: 'Line item', s: HDR() });
    setCell('B2', { t: 's', v: 'UOM', s: HDR() });
    // Column C's header names what it holds on this tab: "Variable Scenario" on the Inputs
    // tab, "Vintage" on a tab with vertical-block vintage rows, blank anywhere else.
    const tabHasVintage = rows.some(e => !e.isCustom && e.row.path && e.row.path.length && typeof e.row.path[e.row.path.length - 1].vIndex === 'number');
    const cHeader = tab.id === INPUTS_TAB_ID ? 'Variable Scenario' : (tabHasVintage ? 'Vintage' : '');
    setCell(VINTAGE_COL + '2', textCell(cHeader, HDR({ alignment: { horizontal: 'center', wrapText: true } })));
    const tabHelperHeaders = helperHeadersByTab[tab.id] || [];
    for(let k = 0; k < helperColCount; k++){
      setCell(helperCol(k) + '2', textCell(tabHelperHeaders[k] || '', HDR({ alignment: { horizontal: 'center', wrapText: true } })));
    }
    // Row 3: period counter 1..N over the period columns — a labelled reference for
    // timing logic instead of typed period numbers.
    setCell('A3', { t: 's', v: 'Period #', s: roleCellStyle('Notes') });
    labels.forEach((lab, i) => {
      setCell(colLetter(periodCol(i)) + '3', { t: 'n', v: i + 1, s: roleCellStyle('Notes', { alignment: { horizontal: 'right' } }) });
    });
    labels.forEach((lab, i) => {
      setCell(colLetter(periodCol(i)) + '2', { t: 's', v: lab, s: HDR() });
    });
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: periodCol(nPeriods - 1) - 1 } });

    let lastRow = 2;
    let currentSection = null;
    const sectioned = sectionsEnabled();
    rows.forEach(({ row, excelRow, section, isCustom }) => {
      if(sectioned && section !== currentSection){
        currentSection = section;
        const headerRow = excelRow - 1;
        const label = { input: 'INPUTS', calc: 'CALCULATIONS', output: 'OUTPUTS' }[section];
        setCell('A' + headerRow, { t: 's', v: label, s: roleCellStyle('Section Headers') });
        lastRow = Math.max(lastRow, headerRow);
      }

      if(isCustom){
        // A custom/label row: no fmIDE rectangle behind it, so no UOM/formula — just a
        // styled label, optionally with the period/timeline headers repeated across it.
        // A custom row's own format (set in this tool) is its whole look — it has no
        // semantic colour to protect; otherwise the Labels role.
        const cellStyle = nodeStyleToExcelCellStyle(row.style) || roleCellStyle('Labels');
        setCell('A' + excelRow, textCell(row.label, withIndent(cellStyle, row)));
        setCell('B' + excelRow, blankCell(cellStyle));
        setCell(VINTAGE_COL + excelRow, blankCell(cellStyle));
        for(let k = 0; k < helperColCount; k++) setCell(helperCol(k) + excelRow, blankCell(cellStyle));
        if(row.showPeriodLabels){
          labels.forEach((lab, i) => {
            setCell(colLetter(periodCol(i)) + excelRow, { t: 's', v: lab, s: cellStyle });
          });
        } else {
          // No period data on this row (e.g. a plain blank/divider row) — give every
          // period cell the same style as the label instead of merging cells across the
          // row. Merged cells break copy/paste, autofill, and cell navigation in Excel,
          // so this reads as a clean, coherent band without any of that friction.
          labels.forEach((lab, i) => {
            setCell(colLetter(periodCol(i)) + excelRow, blankCell(cellStyle));
          });
        }
        lastRow = Math.max(lastRow, excelRow);
        return;
      }

      const canvas = ctx.canvasById[row.canvasId];
      const node = irNode(row.canvasId, row.nodeId).node;
      const modelFmt = modelNumberFormat(canvas, node); // fmIDE's number format: the one part of its look that goes to Excel
      // An input row whose numbers live on the Inputs tab becomes a link to it.
      const linkPos = (!row.isInputMirror && ctx.cellPos[mirrorIdFor(row.id)]) || null;
      // A scenario variable (Inputs tab): N scenario rows above this row, then this row
      // picking one of them.
      const scnBlock = row.isInputMirror ? ctx.scenarioBlocks[row.id] : null;
      // An input the Sensitivity tab moves: its base (the scenario it picks, or the base row
      // above it) × (1 + the % change) + the amount change, both 0 unless it is being moved.
      const sensIndex = row.isInputMirror && sensLay && ctx.sensMoved.has(row.id) ? ctx.sensMoved.get(row.id) : null;
      const sensBaseRow = sensIndex !== null ? ctx.sensBase[row.id] : undefined;
      const moved = (base) => '(' + base + ')*(1+' + sensLay.pctRef(sensIndex, tab.name) + ')+' + sensLay.amtRef(sensIndex, tab.name);

      const lastHop = row.path && row.path.length ? row.path[row.path.length - 1] : null;
      const rowVintage = (lastHop && typeof lastHop.vIndex === 'number') ? lastHop.vIndex : null;
      const plan = rowVintage !== null ? helperPlanByHop[lastHop.canvasId + '|' + lastHop.nodeId] : null;
      ctx.currentRow = excelRow;
      ctx.currentRowVintage = rowVintage;
      ctx.currentRowHopsKey = pathKey(row.path || [], '', '');
      ctx.currentHelper = plan;
      functionUseRow = '“' + row.label + '” (' + tab.name + ')';
      // A cell's content, or NA() where a function call written out in full makes its
      // formula too long or too deeply nested for Excel (listed in `tooLong`). Formulas
      // without a call are written as before.
      const rowTooLong = [];
      const fitted = (build, p) => {
        const before = ctx.fnWrites || 0;
        const saved = [ctx.currentRow, ctx.currentRowVintage, ctx.currentHelper, ctx.currentRowHopsKey];
        let content, problem = null;
        try{
          content = build();
          if(content && content.isFormula) content = { isFormula: true, formula: formulaTop(content.formula) };
        }
        catch(err){
          if(!err || !err.excelTooLong) throw err;
          [ctx.currentRow, ctx.currentRowVintage, ctx.currentHelper, ctx.currentRowHopsKey] = saved;
          problem = { kind: 'length', size: null };
        }
        if(!problem && content.isFormula && (ctx.fnWrites || 0) !== before) problem = excelFormulaProblem(content.formula);
        if(!problem) return content;
        rowTooLong.push({ period: p, problem });
        return { isFormula: true, formula: 'NA()' };
      };

      // Period contents first — the row's role depends on what it holds.
      const contents = [];
      for(let p = 0; p < nPeriods; p++){
        const col = colLetter(periodCol(p));
        // A vertical block instance's combined/reduced output row doesn't compute like
        // an ordinary rectangle (it's the reducer across every vintage's copy of this same
        // node); build its formula separately instead of going through buildCellContent.
        const picked = scnBlock ? 'INDEX(' + col + scnBlock.first + ':' + col + (scnBlock.first + scnBlock.n - 1) + ',MIN(MAX($' + VINTAGE_COL + excelRow + ',1),' + scnBlock.n + '))' : null;
        contents.push(sensIndex !== null
          ? { isFormula: true, formula: moved(picked || (col + sensBaseRow)) }
          : scnBlock
          ? { isFormula: true, formula: picked }
          : linkPos
          ? { isFormula: true, formula: sheetRef(linkPos.tabName, col, linkPos.row, tab.name) }
          : row.verticalCombined
            ? fitted(() => ({ isFormula: true, formula: buildVerticalCombinedFormula(row.canvasId, node, p, ctx, tab.name, row.path) }), p)
            : fitted(() => buildCellContent(row.canvasId, node, p, ctx, tab.name, row.path), p));
      }
      // Role of the row: Inputs (typed numbers) · Links (every cell only pulls one cell
      // from another sheet) · Calculations (any other formula).
      const PURE_LINK = /^(?:'(?:[^']|'')+'|[A-Za-z0-9_.]+)!\$?[A-Z]{1,3}\$?\d+$/;
      const rowRole = scnBlock || sensIndex !== null ? 'Calculations'
        : row.isInputMirror ? 'Inputs'
        : linkPos ? 'Links'
        : isInputNode(canvas, node) ? 'Inputs'
        : (contents.length && contents.every(c => c.isFormula && PURE_LINK.test(c.formula))) ? 'Links'
        : 'Calculations';
      // The row's own format (Tree view 🎨) goes over the role's look and fmIDE's number format.
      const rowStyleObj = withRowFormat(composeStyle(rowRole, modelFmt), row.style);
      const cellStyle = nodeStyleToExcelCellStyle(rowStyleObj);
      const numFmt = numberFormatToExcel(rowStyleObj, fallbackFmt);

      if(scnBlock){
        // Scenario rows: the hard-coded numbers (Inputs role); numbering in C (Notes).
        const inObj = withRowFormat(composeStyle('Inputs', modelFmt), row.style);
        const inStyle = nodeStyleToExcelCellStyle(inObj);
        const inFmt = numberFormatToExcel(inObj, fallbackFmt);
        const numStyle = roleCellStyle('Notes', CENTER);
        for(let k = 1; k <= scnBlock.n; k++){
          const r = scnBlock.first + k - 1;
          setCell('A' + r, textCell('Scenario ' + k, inStyle));   // rename freely in Excel
          setCell('B' + r, blankCell(inStyle));
          setCell(VINTAGE_COL + r, k === 1 ? { t: 'n', v: 1, s: numStyle } : { t: 'n', f: VINTAGE_COL + (r - 1) + '+1', v: k, s: numStyle });
          for(let h = 0; h < helperColCount; h++) setCell(helperCol(h) + r, blankCell(inStyle));
          for(let p = 0; p < nPeriods; p++){
            const col = colLetter(periodCol(p));
            let cell;
            if(k === 1){
              const content = fitted(() => buildCellContent(row.canvasId, node, p, ctx, tab.name, row.path), p);
              cell = content.isFormula ? { t: 'n', f: content.formula, v: 0, z: inFmt }
                : content.value !== null ? { t: 'n', v: content.value, z: inFmt } : blankCell(null, inFmt);
            } else {
              cell = blankCell(null, inFmt); // empty = 0 until you type a value
            }
            if(inStyle) cell.s = inStyle;
            setCell(col + r, cell);
          }
          lastRow = Math.max(lastRow, r);
        }
      }

      if(sensBaseRow !== undefined){
        // The base row: the typed numbers the Sensitivity tab moves (Inputs role).
        const inObj = withRowFormat(composeStyle('Inputs', modelFmt), row.style);
        const inStyle = nodeStyleToExcelCellStyle(inObj);
        const inFmt = numberFormatToExcel(inObj, fallbackFmt);
        const r = sensBaseRow;
        setCell('A' + r, textCell('Base (before sensitivity)', inStyle));
        setCell('B' + r, blankCell(inStyle));
        setCell(VINTAGE_COL + r, blankCell(inStyle));
        for(let h = 0; h < helperColCount; h++) setCell(helperCol(h) + r, blankCell(inStyle));
        for(let p = 0; p < nPeriods; p++){
          const content = fitted(() => buildCellContent(row.canvasId, node, p, ctx, tab.name, row.path), p);
          const cell = content.isFormula ? { t: 'n', f: content.formula, v: 0, z: inFmt }
            : content.value !== null ? { t: 'n', v: content.value, z: inFmt } : blankCell(null, inFmt);
          if(inStyle) cell.s = inStyle;
          setCell(colLetter(periodCol(p)) + r, cell);
        }
        lastRow = Math.max(lastRow, r);
      }

      setCell('A' + excelRow, textCell(row.label, withIndent(cellStyle, row)));
      const uom = rowUnit(canvas, node, row.path);
      setCell('B' + excelRow, textCell(uom || '', cellStyle));

      // Column C: the vintage number of a vertical-block vintage row; for a scenario
      // variable, a link to its "Applied" cell on the Scenarios tab; blank otherwise.
      if(scnBlock){
        setCell(VINTAGE_COL + excelRow, { t: 'n', f: sheetRef(scenarioSheetName, VINTAGE_COL, scenarioRowOf[row.id], tab.name), v: 1,
          s: roleCellStyle('Links', CENTER) });
      } else {
        const vStyle = mergeXlStyle(cellStyle, CENTER);
        setCell(VINTAGE_COL + excelRow, rowVintage !== null ? { t: 'n', v: rowVintage, s: vStyle } : blankCell(vStyle));
      }
      // Helper cells: this vintage's value of each indexed input of the row's own instance.
      for(let k = 0; k < helperColCount; k++){
        const port = plan && plan.ports[k];
        const hc = port
          ? { t: 'n', f: fitted(() => ({ isFormula: true, formula: helperCellFormula(ctx, lastHop, row.path.slice(0, -1), port, excelRow, tab.name) }), null).formula, v: 0, z: numFmt }
          : blankCell(null);
        if(cellStyle) hc.s = cellStyle;
        setCell(helperCol(k) + excelRow, hc);
      }

      contents.forEach((content, p) => {
        const col = colLetter(periodCol(p));
        let cell;
        if(content.isFormula) cell = { t: 'n', f: content.formula, v: 0, z: numFmt };
        else if(content.value !== null) cell = { t: 'n', v: content.value, z: numFmt };
        else cell = blankCell(null, numFmt);
        if(cellStyle) cell.s = cellStyle;
        setCell(col + excelRow, cell);
      });

      ctx.currentRow = null; ctx.currentRowVintage = null; ctx.currentHelper = null; ctx.currentRowHopsKey = null;
      functionUseRow = null;
      if(rowTooLong.length){
        // The scenario row repeats period 1..N of the same formula: each period once.
        const periods = [...new Set(rowTooLong.filter(t => t.period !== null).map(t => t.period + 1))].sort((a, b) => a - b);
        tooLong.push({ row, tabName: tab.name, periods, problem: rowTooLong[0].problem });
      }
      lastRow = Math.max(lastRow, excelRow);
    });

    ws['!ref'] = 'A1:' + colLetter(periodCol(nPeriods - 1)) + lastRow;
    // Key columns (label, UOM, Vintage, helpers) then the periods — same widths on every tab.
    ws['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 8 }].concat(Array.from({ length: helperColCount }, () => ({ wch: 14 })), [{ wch: 2 }], labels.map(() => ({ wch: 13 })));
    ws['!merges'] = merges;

    XLSX.utils.book_append_sheet(wb, ws, tab.name);
  });

  if(wb.SheetNames.length === 0){
    throw new Error('Nothing to export — every row is excluded, or every tab is empty.');
  }

  // Functions tab (last): every function version whose calls the formulas write out.
  if(functionUses.size) appendFunctionsSheet(wb, functionUses, HDR);

  // Sensitivity tab, after the model's tabs (09g-sensitivity.js).
  if(sensLay) appendSensitivitySheet(wb, ctx.sens, sensLay, ctx, labels);

  // Scenarios tab (first sheet).
  // With global cases (nCases > 0), following the layout of the workbook it was designed from:
  //   row 2: "Global Case" · C2 the case to run (you type it) · D2 its name ·
  //          H2… case numbers 1..K;   row 3: H3… case names (rename freely)
  //   row 5: "Scenarios" section · row 6 headers · row 7 note · rows 8+: one per variable:
  //   A variable (linked) · B UOM · C Applied = that variable's scenario in the global case
  //   (INDEX over its own case columns) · D scenario name · E scenario count · F check ·
  //   H… the scenario number each case uses (you type them).
  // Without global cases, rows 1-3 title/headers/note and rows 4+ as before, with Applied
  // typed directly in C. Column C is always "which one", like every other sheet.
  if(scenarioVars.length){
    const ws = {};
    const inputsTabName = inputsTab().name;
    // Roles: typed cells = Inputs, pulled-in names = Links, formulas = Calculations.
    const hdr = HDR();
    const inputStyle = roleCellStyle('Inputs', CENTER);
    const linkStyle = roleCellStyle('Links');
    const noteStyle = roleCellStyle('Notes');
    const calcStyle = roleCellStyle('Calculations');
    const calcCenter = roleCellStyle('Calculations', CENTER);
    const caseCol = (k) => colLetter(8 + k - 1);          // case k in column H, I, …
    const firstCaseCol = caseCol(1), lastCaseCol = caseCol(Math.max(nCases, 1));
    let hdrRow, noteRow;
    if(nCases){
      ws.A2 = { t: 's', v: 'Global Case', s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 12 } }) };
      ws.C2 = { t: 'n', v: 1, s: mergeXlStyle(inputStyle, { font: { bold: true } }) };
      ws.D2 = { t: 's', f: 'INDEX($' + firstCaseCol + '$3:$' + lastCaseCol + '$3,MIN(MAX($C$2,1),' + nCases + '))', v: 'Case 1', s: mergeXlStyle(calcStyle, { font: { bold: true } }) };
      ws.F2 = { t: 's', f: 'IF(ISNUMBER(C2),IF(AND(C2=INT(C2),C2>=1,C2<=' + nCases + '),"OK","Out of range - using "&MIN(MAX(INT(C2),1),' + nCases + ')),"Not a number - using 1")', v: 'OK', s: calcStyle };
      for(let k = 1; k <= nCases; k++){
        const c = caseCol(k);
        ws[c + '2'] = k === 1 ? { t: 'n', v: 1, s: HDR(CENTER) }
                              : { t: 'n', f: caseCol(k - 1) + '2+1', v: k, s: HDR(CENTER) };
        ws[c + '3'] = { t: 's', v: 'Case ' + k, s: mergeXlStyle(inputStyle, { font: { bold: true } }) };
      }
      ws.A4 = { t: 's', v: 'Type the case to run in C2. Rename cases in row 3; set each case\'s scenario per variable in columns ' + firstCaseCol + '-' + lastCaseCol + '.', s: noteStyle };
      ws.A5 = { t: 's', v: scenarioSheetName, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) };
      hdrRow = 6; noteRow = 7;
    } else {
      ws.A1 = { t: 's', v: scenarioSheetName, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) };
      hdrRow = 2; noteRow = 3;
    }
    [['A', 'Input variable'], ['B', 'UOM'], ['C', 'Applied'], ['D', 'Scenario name'], ['E', 'Scenarios'], ['F', 'Check']]
      .forEach(([c, v]) => { ws[c + hdrRow] = { t: 's', v, s: HDR(c === 'C' || c === 'E' ? CENTER : null) }; });
    if(nCases){
      for(let k = 1; k <= nCases; k++) ws[caseCol(k) + hdrRow] = { t: 's', f: caseCol(k) + '$3', v: 'Case ' + k, s: HDR(CENTER) };
    }
    ws['A' + noteRow] = { t: 's', v: nCases
      ? 'Applied (C) follows the global case. Rename scenarios in column A of the ' + inputsTabName + ' tab.'
      : 'Type the scenario number to apply in column C. Rename scenarios in column A of the ' + inputsTabName + ' tab.', s: noteStyle };
    scenarioVars.forEach(({ row, excelRow }) => {
      const r = scenarioRowOf[row.id];
      const blk = ctx.scenarioBlocks[row.id];
      const inRef = (col, rr) => sheetRef(inputsTabName, col, rr, scenarioSheetName);
      const nameRange = sheetRef(inputsTabName, '$A', '$' + blk.first, scenarioSheetName) + ':$A$' + (blk.first + blk.n - 1);
      ws['A' + r] = { t: 's', f: inRef('A', excelRow), v: row.label || '', s: linkStyle };
      ws['B' + r] = { t: 's', f: inRef('B', excelRow) + '&""', v: '', s: linkStyle };
      if(nCases){
        // Applied = this variable's scenario in the global case (a formula now, so plain style).
        ws['C' + r] = { t: 'n', f: 'INDEX($' + firstCaseCol + r + ':$' + lastCaseCol + r + ',MIN(MAX($C$2,1),' + nCases + '))', v: 1, s: calcCenter };
        // Case matrix default: case k uses scenario k (or the last one) — edit freely.
        for(let k = 1; k <= nCases; k++) ws[caseCol(k) + r] = { t: 'n', v: Math.min(k, blk.n), s: inputStyle };
      } else {
        ws['C' + r] = { t: 'n', v: 1, s: inputStyle };
      }
      ws['D' + r] = { t: 's', f: 'INDEX(' + nameRange + ',MIN(MAX(C' + r + ',1),E' + r + '))', v: 'Scenario 1', s: calcStyle };
      ws['E' + r] = { t: 'n', v: blk.n, s: roleCellStyle('Notes', CENTER) };
      ws['F' + r] = { t: 's', f: 'IF(ISNUMBER(C' + r + '),IF(AND(C' + r + '=INT(C' + r + '),C' + r + '>=1,C' + r + '<=E' + r + '),"OK","Out of range - using "&MIN(MAX(INT(C' + r + '),1),E' + r + ')),"Not a number - using 1")', v: 'OK', s: calcStyle };
    });
    const last = scenarioRowOf[scenarioVars[scenarioVars.length - 1].row.id];
    ws['!ref'] = 'A1:' + (nCases ? lastCaseCol : 'F') + last;
    // G stays an empty spacer column before the case columns.
    ws['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 9 }, { wch: 22 }, { wch: 10 }, { wch: 26 }, { wch: 2 }].concat(Array.from({ length: nCases }, () => ({ wch: 10 })));
    XLSX.utils.book_append_sheet(wb, ws, scenarioSheetName);
    wb.SheetNames.unshift(wb.SheetNames.pop()); // Scenarios first
  }
  return { wb, tooLong };
  }finally{ useHelperColumns(0); }
}

// The Functions tab: one row per function version the formulas write out, so a reader can
// see what each written-out call is — name, version, its definition, description and note
// (all from the file, written as plain text) and the rows that use it.
function appendFunctionsSheet(wb, functionUses, HDR){
  const ws = {};
  const name = uniqueTabName('Functions', null).name;
  const cap = (s) => { s = String(s == null ? '' : s); return s.length > 32000 ? s.slice(0, 32000) + '…' : s; };
  const noteStyle = roleCellStyle('Notes');
  const labelStyle = roleCellStyle('Labels');
  ws.A1 = { t: 's', v: name, s: mergeXlStyle({ font: (roleCellStyle('Headers') || {}).font || {} }, { font: { sz: 13 } }) };
  ws.A2 = textCell('Each call to one of these functions is written out in full inside the formulas that use it.', noteStyle);
  const heads = ['Function', 'Version', 'Definition', 'Description', 'Note', 'Used in'];
  heads.forEach((h, i) => { ws[colLetter(i + 1) + '4'] = { t: 's', v: h, s: HDR() }; });
  const list = [...functionUses.values()].sort((a, b) =>
    String(a.fn.name).localeCompare(String(b.fn.name)) || (a.fn.version - b.fn.version));
  list.forEach((u, i) => {
    const r = 5 + i;
    const def = u.fn.def || {};
    ws['A' + r] = textCell(cap(u.fn.name || '(unnamed)'), labelStyle);
    ws['B' + r] = { t: 'n', v: u.fn.version };
    ws['C' + r] = textCell(cap(def.text));
    ws['D' + r] = textCell(cap(def.description));
    ws['E' + r] = textCell(cap(def.note));
    ws['F' + r] = textCell(cap([...u.rows].join(', ')));
  });
  ws['!ref'] = 'A1:F' + Math.max(4, 4 + list.length);
  ws['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 50 }, { wch: 40 }, { wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// A row's unit: the rectangle's own typed unit, else the one the IR works out for it in
// this row's block instance (unitOf — the unit fmIDE shows).
function rowUnit(canvas, node, path){
  if(!node) return '';
  const parsed = parseRectText(node.text);
  if(parsed.uom) return parsed.uom;
  const auto = unitOf(modelIR, canvas.id, node.id, irPath(path));
  return auto ? formatUOM(auto) : '';
}

