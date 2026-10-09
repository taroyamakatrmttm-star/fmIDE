// ============================================================
// Sharing from a phone (step 17, phase P1b): ☰ → Share a picture of the board or the board
// file, and ⇪ Share in Show (the chart shown), through the phone's own share sheet (shared
// shareFiles: the person picks where it goes; where a browser can't share files, it
// downloads). The picture is drawn here, on the page: each widget's SVG with its look written
// into it, drawn on a canvas under the board's and model's names, the widgets' names, a chart's
// key, and where the sliders are. Names reach the picture only as canvas text, and an SVG drawn
// as an image runs nothing.
// ============================================================
const PICTURE_W = 1080;           // pixels across
const PICTURE_PAD = 44;
const PICTURE_MAX_H = 16000;
const PICTURE_ZOOM = 1.8;         // a widget's drawing at most this much larger than its own size      // a browser's canvas stops somewhere beyond this
const PICTURE_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SVG_LOOK = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor'];

// An SVG on the page as an image: its look (from the style sheet) written into each element.
function svgPicture(el){
  const copy = el.cloneNode(true);
  const from = el.querySelectorAll('*'), to = copy.querySelectorAll('*');
  from.forEach((e, i) => {
    const cs = getComputedStyle(e);
    to[i].setAttribute('style', SVG_LOOK.map(p => p + ':' + cs.getPropertyValue(p)).join(';'));
  });
  copy.querySelectorAll('title').forEach(t => t.remove());
  const vb = el.viewBox && el.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : 300, h = vb && vb.height ? vb.height : 150;
  copy.setAttribute('xmlns', SVG_NS);
  copy.setAttribute('width', String(w));
  copy.setAttribute('height', String(h));
  copy.removeAttribute('class');
  const text = new XMLSerializer().serializeToString(copy);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, w, h });
    img.onerror = () => reject(new Error('The chart could not be drawn.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  });
}

// Lines of text no wider than width.
function wrapText(ctx, text, width){
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  words.forEach(w => {
    const next = line ? line + ' ' + w : w;
    if(line && ctx.measureText(next).width > width){ lines.push(line); line = w; } else line = next;
  });
  if(line) lines.push(line);
  return lines.length ? lines : [''];
}

// The widgets (their elements on the page, and names) drawn as one PNG. Resolves a Blob.
async function drawPicture(title, widgets){
  const inner = PICTURE_W - 2 * PICTURE_PAD;
  const parts = [];
  for(const w of widgets){
    const images = [];
    for(const s of w.el.querySelectorAll('.bar-chart-host svg')) images.push(await svgPicture(s));
    // A chart's key, a line per group: "Assets: Closing cash, Equipment".
    const key = [...w.el.querySelectorAll('.chart-key .key-line')].map(l => {
      const group = l.querySelector('.key-group'), items = [...l.querySelectorAll('.key-item')].map(i => i.textContent.trim()).filter(Boolean);
      return ((group ? group.textContent.trim() + ' ' : '') + items.join(', ')).trim();
    }).filter(Boolean);
    const problems = [...w.el.querySelectorAll('.bar-errors li')].map(l => l.textContent);
    parts.push({ name: w.name, images, key, problems });
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = (size, weight) => { ctx.font = (weight || 400) + ' ' + size + 'px ' + PICTURE_FONT; };
  const settings = (pinA ? 'Compared with ' + pinA.label + '. ' : '') + 'Sliders: ' + settingsLabel(board.sliders.map(sliderSetting)) + '.';
  // Measured first (the canvas's size), then drawn.
  const layout = () => {
    const ops = [];
    let y = PICTURE_PAD;
    const text = (t, size, weight, colour, gap) => {
      font(size, weight);
      wrapText(ctx, t, inner).forEach(line => { ops.push({ t: line, y: y + size, size, weight, colour }); y += Math.round(size * 1.3); });
      y += gap || 0;
    };
    text(title, 44, 700, '#1b2333', 4);
    text(model.name, 26, 400, '#5f6b7d', 10);
    text(settings, 24, 400, '#5f6b7d', 26);
    parts.forEach(p => {
      if(p.name) text(p.name, 32, 700, '#1b2333', 8);
      // At most PICTURE_ZOOM times its own size, so a bar's small drawing keeps the charts' text size.
      p.images.forEach(im => {
        const w = Math.min(inner, im.w * PICTURE_ZOOM), h = Math.round(w * im.h / im.w);
        ops.push({ im: im.img, x: PICTURE_PAD + (inner - w) / 2, y, w, h });
        y += h + 10;
      });
      p.key.forEach(k => text(k, 22, 400, '#5f6b7d', 0));
      p.problems.forEach(k => text(k, 22, 400, '#b42318', 0));
      y += 30;
    });
    text('Made with fmGraph', 20, 400, '#94a3b8', 0);
    return { ops, h: Math.min(PICTURE_MAX_H, y + PICTURE_PAD) };
  };
  const { ops, h } = layout();
  canvas.width = PICTURE_W;
  canvas.height = h;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PICTURE_W, h);
  ops.forEach(op => {
    if(op.y > h) return;
    if(op.im){ ctx.drawImage(op.im, op.x, op.y, op.w, op.h); return; }
    font(op.size, op.weight);
    ctx.fillStyle = op.colour;
    ctx.fillText(op.t, PICTURE_PAD, op.y);
  });
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('The picture could not be made.')), 'image/png'));
}

const widgetName = (w) => w.kind === 'chart' ? (w.title || ({ columns: 'Columns', flow: 'Waterfall', scenarios: 'Scenario waterfall' }[w.layout] || 'Chart')) : model.byKey.get(w.key).name;

async function sharePicture(title, widgets, fileName){
  try{
    const blob = await drawPicture(title, widgets);
    const file = new File([blob], safeFileName(fileName) + '.png', { type: 'image/png' });
    const how = await shareFiles([file], title);
    if(how === 'downloaded') notify('Saved the picture: ' + file.name + '.', 'ok', 'share');
    return how;
  }catch(e){
    notify('The picture could not be made: ' + String(e && e.message || e).slice(0, 200), 'err', 'share');
    return 'failed';
  }
}
function shareBoardPicture(){
  if(!model || !board) return Promise.resolve(null);
  const widgets = board.items.map(w => ({ el: document.querySelector('#barList .widget[data-id="' + w.id + '"]'), name: widgetName(w) })).filter(w => w.el);
  return sharePicture(board.name, widgets, model.name + ' - ' + board.name);
}
function shareWidgetPicture(w){
  const el = $('showBody').querySelector('.show-widget');
  if(!model || !el) return Promise.resolve(null);
  return sharePicture(widgetName(w), [{ el, name: '' }], model.name + ' - ' + widgetName(w));
}
async function shareBoardFile(){
  if(!model || !board) return null;
  const text = JSON.stringify(boardsData([board]), null, 2);
  const file = new File([text], safeFileName(model.name + ' - ' + board.name) + '.board.json', { type: 'application/json' });
  const how = await shareFiles([file], board.name);
  if(how === 'downloaded') notify('Saved the board file: ' + file.name + '.', 'ok', 'share');
  return how;
}
