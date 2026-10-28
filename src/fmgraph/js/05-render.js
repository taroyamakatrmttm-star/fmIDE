// ============================================================
// Drawing the board. renderBoard() builds every widget; updateValues() redraws only the
// numbers and bars (it runs on every slider move). Everything from the model (names, canvas
// and period labels) goes in as text — textContent, or SVG text nodes — never as markup.
// ============================================================
const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, text){
  const el = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(k => el.setAttribute(k, String(attrs[k])));
  if(text !== undefined) el.textContent = String(text);
  return el;
}

// What a slider shows: its value, or where the model's own number sits.
function sliderShown(s){
  if(s.value !== null) return s.value;
  if(s.mode === 'shift') return 0;
  return baseValue(model.byKey.get(s.key), periodsOf(s.periods)[0] || 0);
}

// "Model's number: 10", or the first and last when the periods it covers differ.
function sliderBaseText(s){
  const rect = model.byKey.get(s.key);
  const ps = periodsOf(s.periods);
  const first = ps[0] || 0, last = ps[ps.length - 1] || 0;
  const same = ps.every(p => baseValue(rect, p) === baseValue(rect, first));
  return same
    ? 'Model\'s number: ' + fmtNum(baseValue(rect, first))
    : 'Model\'s numbers: ' + fmtNum(baseValue(rect, first)) + ' (' + model.periods[first] + ') to ' + fmtNum(baseValue(rect, last)) + ' (' + model.periods[last] + ')';
}

// One bar per period, the model's own value as a dashed outline behind it.
function drawBars(el, b, results){
  const rect = model.byKey.get(b.key);
  const ps = periodsOf(b.periods);
  const now = ps.map(p => resultOf(results, rect, p));
  const base = ps.map(p => resultOf(compareResults(), rect, p)); // A, or the model's own numbers (05e-compare.js)
  const nums = [];
  now.concat(base).forEach(r => { if(!r.error) nums.push(r.value); });
  let lo = Math.min(0, ...nums), hi = Math.max(0, ...nums);
  if(hi === lo) hi = lo + 1;
  const sc = scaleFor(b, lo, hi); // Auto, or the bar's fixed scale (04d-scale.js)
  // Room above for the labels of bars going up, and below for those of bars going down.
  const n = Math.max(1, ps.length), labels = n <= 8;
  const W = 300, top = sc.hi > 0 && labels ? 34 : 12, bottom = 22 + (sc.lo < 0 && labels ? 30 : 0), H = 130 + top + bottom;
  const plotH = H - top - bottom;
  const y = scaleY(top, plotH, sc);
  const slot = (W - 8) / n, bw = Math.max(3, Math.min(46, slot * 0.62));
  const chart = svg('svg', { class: 'bar-chart' + (sc.fixed ? ' fixed-scale' : ''), viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
  chart.setAttribute('aria-label', rect.name);
  drawScaleAxis(chart, sc, y, W, top, plotH);
  const problems = new Map();
  ps.forEach((p, i) => {
    const cx = 4 + slot * i + slot / 2, x = cx - bw / 2;
    const g = svg('g', { class: 'b-period', 'data-period': p });
    const r = now[i], was = base[i];
    if(r.error){
      g.appendChild(svg('rect', { class: 'b-err', x, y: top, width: bw, height: plotH }));
      g.appendChild(svg('text', { class: 't-err', x: cx, y: top + plotH / 2, 'text-anchor': 'middle' }, '!'));
      problems.set(r.error, (problems.get(r.error) || []).concat([model.periods[p]]));
      g.appendChild(svg('title', {}, model.periods[p] + ': ' + errorText(r.error)));
    } else {
      const y0 = y(0), y1 = y(r.value);
      const bar = animKey(svg('rect', { class: 'b-now' + (r.value < 0 ? ' neg' : ''), x, y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)) }), b.id + '|' + p);
      if(rectColour(b.key)) bar.style.fill = rectColour(b.key); // a style, so the page's usual bar colour doesn't paint over it
      g.appendChild(bar);
      if(!was.error && was.value !== r.value){
        const yb = y(was.value);
        g.appendChild(svg('rect', { class: 'b-base', x, y: Math.min(y0, yb), width: bw, height: Math.max(1, Math.abs(yb - y0)) }));
      }
      drawOverMarks(g, sc, cx, top, plotH, r.value, r.value);
      const diff = was.error ? '' : fmtDiff(r.value, was.value);
      const textY = r.value >= 0 ? Math.min(y0, y1) - 4 : Math.max(y0, y1) + 12;
      if(labels){
        g.appendChild(svg('text', { class: 't-value', x: cx, y: textY, 'text-anchor': 'middle' }, fmtNum(r.value)));
        if(diff) g.appendChild(svg('text', { class: 't-diff ' + (r.value > was.value ? 'up' : 'down'), x: cx, y: r.value >= 0 ? textY - 13 : textY + 13, 'text-anchor': 'middle' }, diff.split(' ')[0]));
      }
      g.appendChild(svg('title', {}, model.periods[p] + ': ' + fmtNum(r.value) + (diff ? ' — was ' + fmtNum(was.value) + ', ' + diff : '')));
    }
    if(labels || i === 0 || i === n - 1) g.appendChild(svg('text', { class: 't-period', x: cx, y: H - 6, 'text-anchor': 'middle' }, model.periods[p]));
    chart.appendChild(g);
  });
  raiseScaleLabels(chart);
  const host = el.querySelector('.bar-chart-host');
  host.textContent = '';
  host.appendChild(chart);
  glide(host);
  const list = el.querySelector('.bar-errors');
  list.textContent = '';
  problems.forEach((periods, code) => list.appendChild(make('li', null, periods.join(', ') + ': ' + errorText(code))));
}
