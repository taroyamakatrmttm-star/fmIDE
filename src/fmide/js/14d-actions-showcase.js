  // ---------------------------------- Showcase viewers (phase V3 of docs/viewer-brief.md) ----------------------------------
  // Making a viewer (11g-showcase-maker.js) answers later — unpacking the viewer's page waits for
  // the browser — so, like browsing the library, it returns a Promise and a macro can't run it
  // (macro: false): not offered in the Macro Builder, never recorded. It makes a file, not a node
  // or a canvas: what it gives back is a value.
  const SHOWCASE_NOT_IN_MACROS = 'A showcase viewer can\'t be made in a macro: making one waits for the browser. Use File → Make showcase viewer….';

  defineAction({ name:'makeShowcaseViewer', label:'Make Showcase Viewer', category:'File', icon:'🖼', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'Makes a showcase viewer of the open model: one web page showing it read-only, with the chosen canvases, periods and fmGraph boards. Each choice left out is as the Make showcase viewer… window would start (the choices kept in the document, else every canvas and board). canvases: a list of canvas ids; periods: { from, to } counted from 0; boards: places in the document\'s board list (from 0); play: { from, to }, "Base" or a scenario\'s name. Keeps the showcase in the document and returns a Promise of { fileName, bytes, text, showcase, problems }; downloads it only when download is true. Not in macros.',
    params:[ P('title','string',{ optional:true }), P('description','text',{ optional:true }), P('author','string',{ optional:true }),
      P('licence','string',{ optional:true }), P('id','string',{ optional:true, help:'the file name, letters, digits and dashes' }),
      P('canvases','json',{ optional:true, help:'a list of canvas ids' }), P('start','string',{ optional:true, help:'the canvas it opens on' }),
      P('periods','json',{ optional:true, help:'{ "from": 0, "to": 4 }' }), P('boards','json',{ optional:true, help:'a list like [0, 2]' }),
      P('play','json',{ optional:true, help:'{ "from": "Base", "to": "High price" }' }), P('mark','bool',{ optional:true }),
      P('excel','json',{ optional:true, help:'true, or { "file": "Loan basics.xlsx" }: ExcelExporter makes the workbook (phase V4); false: none' }),
      P('download','bool',{ def:false }) ],
    run(a){
      if(runCtx) fail(SHOWCASE_NOT_IN_MACROS);
      const choices = showcaseStartChoices().choices;
      ['title', 'description', 'author', 'licence', 'id', 'canvases', 'start', 'periods', 'boards', 'play', 'mark']
        .forEach(k => { if(a[k] !== null && a[k] !== undefined) choices[k] = a[k]; });
      if(a.excel === true) choices.excel = choices.excel || { file: showcaseFileName(choices.title || 'Model') };
      else if(a.excel === false) choices.excel = null;
      else if(a.excel && typeof a.excel === 'object') choices.excel = { file: a.excel.file };
      return makeShowcaseViewerFile(choices).then(async made => {
        if(a.download) await giveViewerFile(made);
        return made;
      });
    } });

  defineAction({ name:'showcaseChooseForMe', label:'Choose Boards for Me', category:'File', icon:'🖼', returns:'value', mutates:false, tx:false, record:false, macro:false,
    desc:'For a model with no fmGraph boards: adds one, "Chosen for me", to the document\'s boards — a slider on each input that moves a calculated rectangle and a bar on each result, at most 12 of each (phase V5) — as Choose for me in Make showcase viewer… does. Returns { sliders, bars, notes }, each slider and bar by name. Not in macros.',
    params:[],
    run(){
      if(runCtx) fail('Choosing boards isn\'t a macro step: use File → Make showcase viewer… → Choose for me.');
      return chooseShowcaseBoards();
    } });

  defineAction({ name:'showcase', label:'Showcase Kept', category:'File', icon:'🖼', returns:'value', mutates:false, tx:false, record:false,
    desc:'The showcase the document keeps (what its showcase viewer shows, workspace v14), or null.',
    run(){ return docShowcase ? cloneData(docShowcase) : null; } });
