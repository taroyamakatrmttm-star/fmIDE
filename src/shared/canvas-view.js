// ---------- the read-only canvas (shared: src/shared/canvas-view.js; the showcase viewer) ----------
// Draws one canvas of an fmIDE model as SVG, read-only, looking like fmIDE's canvas (phase V1 of
// docs/viewer-brief.md): rectangles with name, value and unit, operators with their symbol and
// result, operators with named inputs, aliases, period shifts, block instances and function
// nodes with their ports, and every arrow. fmIDE's own render() can't be reused: it builds
// fmIDE's editing buttons into every node and reads fmIDE's editing state.
//
// In three parts, so most of it runs in Node:
//   viewModel(system, presets)        the model as drawn: cleaned canvases, the shared IR, the
//                                     calculation's results (setResults swaps them), styles;
//   canvasLayout(vm, canvasId)        every node's box, ports and texts' places, every arrow's
//                                     path, with fmIDE's geometry (canvas-geometry.js);
//   nodeTexts(vm, canvasId, period)   what each node says in one period;
//   drawCanvas(svg, layout, texts)    builds the SVG, with DOM calls and textContent only.
//
// Everything from the file is untrusted (models may come from anyone): positions and sizes are
// forced to numbers and kept within the canvas, colours go through safeColor, font names
// through a short pattern, every text is a text node. Ids are only compared and set as
// attribute values.
import { rectOf, edgePath, operatorPortsHeight, blockInstanceHeight, functionNodeHeight, portNodeWidth, PORT_HEADER_H, PORT_ROW_H } from './canvas-geometry.js';
import { formatNum, formatByNumberFormat, shiftLabel } from './number-format.js';
import { safeColor } from './escaping.js';
import { parseRectText, effectiveLiteral, plugsOf, compileModel, evaluateModel, unitOf } from './ir.js';
import { operatorForSymbol, operatorPortNames, chooseChoiceCount } from './operators.js';
import { formatUOM } from './uom.js';
import { isInputRectangle } from './input-rule.js';
import { FORMAT_ROLES } from './format-roles.js';

export const CANVAS_VIEW_LIMITS = { coord: 100000, size: 5000, minSize: 10, text: 200, canvases: 1000, nodes: 20000 };
// fmIDE's sizes for a node that doesn't say its own.
const DEFAULT_SIZE = { value: [170, 64], alias: [170, 64], operator: [56, 56], periodShift: [56, 56], blockInstance: [190, 54], function: [190, 74] };
const SVGNS = 'http://www.w3.org/2000/svg';

const clampNum = (v, lo, hi, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; };
const cvText = (v, max) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, max || CANVAS_VIEW_LIMITS.text) : '';
const cleanId = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, 200) : '';

// ---------- the model as drawn ----------
// system: an fmIDE system (already read and upgraded by the shared readers). presets: the
// format presets that style the roles (a workspace's formatPresets, else the system's).
export function viewModel(system, presets){
  const rawPeriods = Array.isArray(system && system.periods) && system.periods.length ? system.periods : ['Period 1'];
  const periods = rawPeriods.slice(0, 10000).map((p, i) => (typeof p === 'string' || typeof p === 'number') ? String(p).slice(0, 40) : 'Period ' + (i + 1));
  const source = Array.isArray(system && system.canvases) ? system.canvases.slice(0, CANVAS_VIEW_LIMITS.canvases) : [];
  const ir = compileModel({ periods, canvases: source, functions: system && system.functions });
  const canvases = [], byId = new Map();
  source.forEach((c, index) => {
    if(!c || typeof c !== 'object') return;
    const id = cleanId(c.id);
    if(!id || byId.has(id)) return; // a repeated canvas id: the first one counts, as in the calculation
    // The canvas as the calculation sees it: the plug-to-socket links worked out from the names,
    // with their automatic aliases where fmIDE puts them (plugLinks), as fmIDE draws them.
    const seen = ir.order[index] && ir.order[index].raw;
    const nodes = (Array.isArray(seen && seen.nodes) ? seen.nodes : []).filter(n => n && typeof n === 'object' && cleanId(n.id)).slice(0, CANVAS_VIEW_LIMITS.nodes);
    const edges = (Array.isArray(seen && seen.edges) ? seen.edges : []).filter(e => e && typeof e === 'object');
    const canvas = { id, name: cvText(c.name, 80) || 'Canvas', index, raw: { nodes, edges }, nodes, edges,
      nodeById: new Map() };
    nodes.forEach(n => { const k = cleanId(n.id); if(!canvas.nodeById.has(k)) canvas.nodeById.set(k, n); });
    canvases.push(canvas);
    byId.set(id, canvas);
  });
  const roleStyles = {};
  FORMAT_ROLES.forEach(r => {
    const own = Array.isArray(presets) ? presets.find(p => p && p.name === r.name && p.style && typeof p.style === 'object') : null;
    roleStyles[r.name] = own ? own.style : r.style;
  });
  const vm = { periods, ir, canvases, byId, roleStyles, results: null, units: new Map() };
  vm.results = evaluateModel(ir);
  return vm;
}

// The calculation's results to show (V2: with the sliders laid over the inputs).
export function setResults(vm, results){ vm.results = results; }

// A node's result in one period: { value } or { error } (or {} for none).
export function nodeResult(vm, canvasId, nodeId, period){
  const c = vm.byId.get(canvasId);
  const r = c && vm.results[c.index];
  if(!r) return {};
  const err = r.errors[period] && r.errors[period][nodeId];
  if(err) return { error: err };
  const v = r.values[period] && r.values[period][nodeId];
  return (typeof v === 'number' && isFinite(v)) ? { value: v } : {};
}
// A block instance's output in one period.
export function portResult(vm, canvasId, nodeId, port, period){
  const c = vm.byId.get(canvasId);
  const r = c && vm.results[c.index];
  if(!r) return {};
  const e = r.portErrors && r.portErrors[period] && r.portErrors[period][nodeId];
  if(e && e[port]) return { error: e[port] };
  const v = r.portValues && r.portValues[period] && r.portValues[period][nodeId];
  return v && typeof v[port] === 'number' && isFinite(v[port]) ? { value: v[port] } : {};
}

// A rectangle's name, typed number and unit (the shared parseRectText), cut to size.
export function rectParts(n){
  const p = parseRectText(typeof (n && n.text) === 'string' ? n.text : '');
  return { name: cvText(String(p.name || '').trim()), literal: p.literal, uom: cvText(p.uom || '', 40) };
}
export function cvHasIncoming(canvas, nodeId){ return canvas.edges.some(e => cleanId(e.to) === nodeId); }
export function cvIsInput(canvas, n){ return isInputRectangle(canvas.raw, n); }

// A value rectangle's look: its own 🎨 format, else its role's (Inputs or Calculations).
export function styleOf(vm, canvas, n){
  if(n.style && typeof n.style === 'object') return n.style;
  return vm.roleStyles[cvIsInput(canvas, n) ? 'Inputs' : 'Calculations'] || null;
}
// A number written as this rectangle writes it.
export function formatFor(vm, canvas, n, v){
  const st = n && n.type === 'value' ? styleOf(vm, canvas, n) : null;
  return formatByNumberFormat(v, st && st.numberFormat && typeof st.numberFormat === 'object' ? st.numberFormat : null);
}
// The unit worked out for a node ({ text, auto }).
export function unitText(vm, canvas, n){
  if(n.type === 'value'){
    const own = rectParts(n).uom;
    if(own) return { text: own, auto: false };
  }
  const key = canvas.id + '\u0000' + cleanId(n.id);
  if(!vm.units.has(key)){
    let t = '';
    try{ const u = unitOf(vm.ir, canvas.id, cleanId(n.id)); t = u ? cvText(formatUOM(u), 40) : ''; }catch(e){ t = ''; }
    vm.units.set(key, t);
  }
  return { text: vm.units.get(key), auto: true };
}

// ---------- ports ----------
// The named inputs of an operator (if, round, choose…) as fmIDE draws them: a choose has its
// index, a choice for each its arrows reach and one empty choice more.
export function operatorPorts(canvas, n){
  const op = n.type === 'operator' ? operatorForSymbol(n.text) : null;
  if(!op || !op.ports) return null;
  if(!op.choices) return op.ports.slice();
  const count = chooseChoiceCount(canvas.edges.filter(e => cleanId(e.to) === cleanId(n.id)).map(e => e.toPort));
  return operatorPortNames(op, count + 1);
}
// A block definition's ports: its Input and Output rectangles, left to right (fmIDE's order).
export function blockPorts(vm, defCanvasId){
  const def = vm.byId.get(cleanId(defCanvasId));
  if(!def) return { def: null, inputs: [], outputs: [] };
  const byPlace = (a, b) => (Number(a.x) || 0) - (Number(b.x) || 0) || (Number(a.y) || 0) - (Number(b.y) || 0);
  const pick = (role) => def.nodes.filter(x => x.type === 'value' && x.blockRole === role).sort(byPlace);
  return { def, inputs: pick('input'), outputs: pick('output') };
}
// A function node's inputs: its definition's (from the model), else one per port its arrows use.
export function functionPorts(vm, canvas, n){
  const compiledNode = vm.ir.canvases.get(canvas.id) && vm.ir.canvases.get(canvas.id).byId.get(n.id);
  const call = compiledNode && compiledNode.call;
  const problem = !call ? 'missing' : (call.parseError ? 'unreadable' : null);
  const name = cvText((call && typeof call.name === 'string' && call.name) || (n.fn && typeof n.fn.name === 'string' && n.fn.name.trim()) || '', 80) || '(unnamed)';
  const version = n.fn && Number.isInteger(n.fn.version) ? n.fn.version : '?';
  let params;
  if(!problem) params = call.params.map(p => cvText(p, 80));
  else {
    let count = 0;
    canvas.edges.forEach(e => { if(cleanId(e.to) === cleanId(n.id) && Number.isInteger(e.toPort) && e.toPort >= 0 && e.toPort < 50) count = Math.max(count, e.toPort + 1); });
    params = []; for(let i = 0; i < count; i++) params.push('#' + (i + 1));
  }
  return { title: 'ƒ ' + name + ' v' + version, name, params, problem };
}

// ---------- the layout ----------
// Every node's box and ports and every arrow's path on one canvas.
// Node: { id, type, x, y, w, h, node, ins: [{ name, x, y }], outs: [{ name, x, y }], header,
//         warn, inTop } — port points where fmIDE's dots sit: 8 in from the side, 11 down a row.
// Edge: { id, from, to, d, p1, p2, auto, badge: { x, y, n } | null }.
export function canvasLayout(vm, canvasId){
  const canvas = vm.byId.get(canvasId);
  if(!canvas) return null;
  const L = CANVAS_VIEW_LIMITS;
  const boxes = new Map(), list = [];
  canvas.nodes.forEach(n => {
    const id = cleanId(n.id);
    if(boxes.has(id)) return;
    const type = DEFAULT_SIZE[n.type] ? n.type : 'operator'; // any other type calculates, and draws, as an operator
    const [dw, dh] = DEFAULT_SIZE[type];
    const b = { id, type, node: n,
      x: clampNum(n.x, -L.coord, L.coord, 0), y: clampNum(n.y, -L.coord, L.coord, 0),
      w: clampNum(n.w, L.minSize, L.size, dw), h: clampNum(n.h, L.minSize, L.size, dh), ins: [], outs: [] };
    if(!(Number(n.w) > 0)) b.w = dw;
    if(!(Number(n.h) > 0)) b.h = dh;
    const inAt = (top) => ({ x: b.x + 8, y: b.y + top + 11 });
    const outAt = (top) => ({ x: b.x + b.w - 8, y: b.y + top + 11 });
    if(type === 'operator'){
      const ports = operatorPorts(canvas, n);
      if(ports){
        b.portop = true;
        b.h = operatorPortsHeight(ports.length);
        b.w = portNodeWidth(b.w, 100, 120);
        b.ins = ports.map((name, i) => Object.assign({ name }, inAt(PORT_HEADER_H + i * PORT_ROW_H)));
      }
    } else if(type === 'blockInstance'){
      const bp = blockPorts(vm, n.blockDefCanvasId);
      b.def = bp.def;
      b.header = (bp.def ? bp.def.name : '(missing block)') + (n.vertical ? ' ×' + vm.periods.length : '');
      b.h = blockInstanceHeight(Math.max(bp.inputs.length, bp.outputs.length, 1));
      b.w = portNodeWidth(b.w, 150, 190);
      b.ins = bp.inputs.map((p, i) => Object.assign({ name: rectParts(p).name || ('in' + i) }, inAt(PORT_HEADER_H + i * PORT_ROW_H)));
      b.outs = bp.outputs.map((p, i) => Object.assign({ name: rectParts(p).name || ('out' + i), nodeId: cleanId(p.id) }, outAt(PORT_HEADER_H + i * PORT_ROW_H)));
    } else if(type === 'function'){
      const fp = functionPorts(vm, canvas, n);
      b.header = fp.title; b.fnName = fp.name; b.warn = fp.problem;
      b.h = functionNodeHeight(fp.params.length, !!fp.problem);
      b.w = portNodeWidth(b.w, 150, 190);
      b.inTop = PORT_HEADER_H + (fp.problem ? PORT_ROW_H : 0);
      b.ins = fp.params.map((name, i) => Object.assign({ name }, inAt(b.inTop + i * PORT_ROW_H)));
      b.outs = [Object.assign({ name: '' }, outAt(b.inTop))];
    }
    boxes.set(id, b);
    list.push(b);
  });
  // The order an operator reads its inputs in (the calculation's, left to right), for the badges.
  const compiledCanvas = vm.ir.canvases.get(canvasId);
  const edges = [];
  canvas.edges.forEach((e, i) => {
    const a = boxes.get(cleanId(e.from)), b = boxes.get(cleanId(e.to));
    if(!a || !b) return;
    let { p1, p2, d } = edgePath(rectOf(a), rectOf(b));
    const fromPort = e.fromPort != null ? e.fromPort : (a.type === 'function' ? 0 : null);
    if(fromPort != null){
      const pp = Number.isInteger(Number(fromPort)) ? a.outs[Number(fromPort)] : null;
      if(pp) p1 = { x: pp.x, y: pp.y };
    }
    if(e.toPort != null){
      const pp = Number.isInteger(Number(e.toPort)) ? b.ins[Number(e.toPort)] : null;
      if(pp) p2 = { x: pp.x, y: pp.y };
    }
    if(e.fromPort != null || e.toPort != null || a.type === 'function') d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    let badge = null;
    if(b.type === 'operator' && !b.portop && compiledCanvas){
      const compiledNode = compiledCanvas.byId.get(b.id);
      const order = compiledNode && compiledNode.inputs ? compiledNode.inputs : [];
      if(order.length > 1){
        const idx = order.findIndex(x => x === e || (x.id != null && e.id != null && cleanId(x.id) === cleanId(e.id)));
        if(idx >= 0) badge = { x: p1.x + (p2.x - p1.x) * 0.78, y: p1.y + (p2.y - p1.y) * 0.78, n: idx + 1 };
      }
    }
    edges.push({ id: cleanId(e.id) || ('e' + i), from: a.id, to: b.id, d, p1, p2, auto: !!e.auto, badge, edge: e });
  });
  // The canvas's extent, for Fit.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  list.forEach(b => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y - 22); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h + 26); });
  const bounds = list.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 400, h: 300 };
  return { canvasId, nodes: list, byId: boxes, edges, bounds };
}

// ---------- what each node says ----------
// nodeTexts(vm, canvasId, period) → Map(node id → { lines: [{ text, cls }], result, chips, style })
// for one period: the numbers on the canvas follow `period`, so showing another one is only a
// matter of passing it.
export function nodeTexts(vm, canvasId, period, layout){
  const canvas = vm.byId.get(canvasId);
  const out = new Map();
  if(!canvas) return out;
  const lay = layout || canvasLayout(vm, canvasId);
  lay.nodes.forEach(b => {
    const n = b.node, t = { lines: [], result: null, chips: [], ports: null };
    const res = nodeResult(vm, canvasId, b.id, period);
    const resultText = () => res.value !== undefined ? '= ' + formatNum(res.value) : (res.error ? '?' : '');
    if(b.type === 'value'){
      const parts = rectParts(n);
      const plugs = plugsOf(n).map(p => cvText(p, 60));
      if(plugs.length) t.chips.push({ text: '🔌 ' + plugs.join(' · '), cls: 'plug', at: 'top' });
      if(n.blockRole === 'input') t.chips.push({ text: '→ IN', cls: 'role-in', at: 'bottom' });
      else if(n.blockRole === 'output') t.chips.push({ text: 'OUT →', cls: 'role-out', at: 'bottom' });
      else if(n.blockRole === 'index') t.chips.push({ text: '# IDX', cls: 'role-index', at: 'bottom' });
      if(parts.name) t.lines.push({ text: parts.name, cls: 'name' });
      if(!cvHasIncoming(canvas, b.id)){
        const lit = effectiveLiteral(n, period);
        t.lines.push({ text: (Array.isArray(n.periodValues) ? '📈 ' : '') + formatFor(vm, canvas, n, lit !== null ? lit : 0), cls: 'value literal' });
        t.input = true;
      } else if(res.value !== undefined){
        t.lines.push({ text: '= ' + formatFor(vm, canvas, n, res.value), cls: 'value computed' });
      } else if(res.error){
        t.lines.push({ text: '?', cls: 'value error' });
      }
      const u = unitText(vm, canvas, n);
      if(u.text) t.lines.push({ text: u.text, cls: 'unit' + (u.auto ? ' auto' : '') });
      t.style = styleOf(vm, canvas, n);
    } else if(b.type === 'alias'){
      const plugs = plugsOf(n).map(p => cvText(p, 60));
      if(plugs.length) t.chips.push({ text: '🔌 ' + plugs.join(' · '), cls: 'plug', at: 'top' });
      const src = vm.byId.get(cleanId(n.sourceCanvasId));
      const srcNode = src ? src.nodeById.get(cleanId(n.sourceNodeId)) : null;
      let label;
      if(!n.sourceCanvasId || !n.sourceNodeId) label = '🔗 (not linked)';
      else if(!src) label = '🔗 (canvas missing)';
      else if(!srcNode) label = '🔗 (rectangle missing)';
      else {
        const srcName = rectParts(srcNode).name || '(unnamed)';
        label = src.id === canvasId ? '🔗 ' + srcName : '🔗 ' + src.name + ' ▸ ' + srcName;
      }
      t.lines.push({ text: label, cls: 'name' });
      const rt = resultText();
      if(rt) t.lines.push({ text: rt, cls: 'value ' + (res.error ? 'error' : 'computed') });
      if(src && srcNode){ const u = unitText(vm, src, srcNode); if(u.text) t.lines.push({ text: u.text, cls: 'unit auto' }); }
    } else if(b.type === 'periodShift'){
      t.lines.push({ text: shiftLabel(typeof n.shift === 'number' && isFinite(n.shift) ? n.shift : -1), cls: 'shift' });
      t.result = resultText();
    } else if(b.type === 'operator'){
      t.lines.push({ text: cvText(n.text, 20), cls: 'opsym' + (operatorForSymbol(n.text) && operatorForSymbol(n.text).fn ? ' word' : '') });
      if(typeof n.socket === 'string' && n.socket.trim()) t.chips.push({ text: '⚡ ' + cvText(n.socket, 60), cls: 'socket', at: 'top' });
      t.result = resultText();
    } else if(b.type === 'blockInstance'){
      t.ports = b.outs.map((o, i) => { const r = portResult(vm, canvasId, b.id, i, period); return r.value !== undefined ? '=' + formatNum(r.value) : (r.error ? '?' : ''); });
    } else if(b.type === 'function'){
      t.result = res.value !== undefined ? '= ' + formatNum(res.value) : ((res.error || b.warn) ? '?' : '');
      const u = b.warn ? { text: '' } : unitText(vm, canvas, n);
      t.unit = u.text;
    }
    out.set(b.id, t);
  });
  return out;
}

// ---------- drawing ----------
const FONT_FAMILY = /^[A-Za-z0-9 ,'-]{1,80}$/;
const BORDER_STYLE = { solid: '', dashed: '6 4', dotted: '2 3' };
function el(name, attrs, text){
  const e = document.createElementNS(SVGNS, name);
  if(attrs) for(const k in attrs) if(attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, String(attrs[k]));
  if(text !== undefined) e.textContent = text;
  return e;
}
// Text cut to about `width` pixels at `size`, with an ellipsis.
function fit(text, width, size, mono){
  const per = size * (mono ? 0.62 : 0.56);
  const max = Math.max(1, Math.floor(width / per));
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;
}
// A name over at most two lines, broken between words.
function nameLines(text, width, size){
  const per = size * 0.56, max = Math.max(1, Math.floor(width / per));
  if(text.length <= max) return [text];
  const words = text.split(/\s+/);
  let first = '';
  while(words.length && (first ? first + ' ' + words[0] : words[0]).length <= max) first = first ? first + ' ' + words.shift() : words.shift();
  if(!first) return [fit(text, width, size)];
  return [first, fit(words.join(' '), width, size)];
}

// Draws `layout` into the SVG group `g` (emptied first). Each node is a <g class="cv-node">
// with data-id, for the caller's taps.
export function drawCanvas(g, layout, texts){
  while(g.firstChild) g.removeChild(g.firstChild);
  const edgesG = el('g', { class: 'cv-edges' });
  const nodesG = el('g', { class: 'cv-nodes' });
  g.appendChild(edgesG); g.appendChild(nodesG);
  layout.edges.forEach(e => {
    const eg = el('g', { class: 'cv-edge' + (e.auto ? ' auto' : ''), 'data-id': e.id, 'data-from': e.from, 'data-to': e.to });
    eg.appendChild(el('path', { class: 'line', d: e.d, 'marker-end': e.auto ? 'url(#cv-arrow-auto)' : 'url(#cv-arrow)' }));
    if(e.badge){
      const bg = el('g', { class: 'order-badge' });
      bg.appendChild(el('circle', { cx: e.badge.x, cy: e.badge.y, r: 8 }));
      bg.appendChild(el('text', { x: e.badge.x, y: e.badge.y + 3.5, 'text-anchor': 'middle' }, String(e.badge.n)));
      eg.appendChild(bg);
    }
    edgesG.appendChild(eg);
  });
  layout.nodes.forEach(b => nodesG.appendChild(drawNode(b, texts.get(b.id) || { lines: [], chips: [] })));
}

function drawNode(b, t){
  const g = el('g', { class: 'cv-node cv-' + b.type + (b.portop ? ' portop' : '') + (b.node.vertical ? ' vertical' : '') + (b.warn ? ' problem' : ''), 'data-id': b.id, transform: `translate(${b.x} ${b.y})` });
  const box = el('rect', { class: 'box', x: 0, y: 0, width: b.w, height: b.h, rx: b.type === 'operator' || b.type === 'periodShift' ? 10 : 8 });
  g.appendChild(box);
  const mid = b.w / 2;
  if(b.type === 'value' && t.style){
    const st = t.style;
    const fill = safeColor(st.fill, null);
    if(fill) box.style.fill = fill;
    if(st.border && typeof st.border === 'object'){
      const bc = safeColor(st.border.color, null);
      if(bc) box.style.stroke = bc;
      const bw = Number(st.border.width);
      if(Number.isFinite(bw) && bw >= 0 && bw <= 12) box.style.strokeWidth = String(bw);
      if(Object.prototype.hasOwnProperty.call(BORDER_STYLE, st.border.style) && BORDER_STYLE[st.border.style]) box.style.strokeDasharray = BORDER_STYLE[st.border.style];
    }
  }
  const font = b.type === 'value' && t.style && t.style.font && typeof t.style.font === 'object' ? t.style.font : null;
  const fontSize = font && Number(font.size) >= 6 && Number(font.size) <= 72 ? Number(font.size) : null;
  const styleText = (e, isName) => {
    if(!font) return;
    if(fontSize) e.style.fontSize = fontSize + 'px';
    if(font.weight === 'bold' || font.weight === 'normal') e.style.fontWeight = font.weight;
    if(typeof font.family === 'string' && FONT_FAMILY.test(font.family)) e.style.fontFamily = font.family;
    const c = isName ? safeColor(font.color, null) : null;
    if(c) e.style.fill = c;
  };
  if(b.type === 'value' || b.type === 'alias'){
    // Name (up to two lines), value, unit: centred as fmIDE's label.
    const rows = [];
    t.lines.forEach(line => {
      if(line.cls === 'name') nameLines(line.text, b.w - 20, fontSize || 14).forEach(x => rows.push({ text: x, cls: 'name', size: fontSize || 14 }));
      else if(line.cls.startsWith('value')) rows.push({ text: fit(line.text, b.w - 20, fontSize || 12, true), cls: line.cls, size: fontSize || 12 });
      else rows.push({ text: fit(line.text, b.w - 20, 10, true), cls: line.cls, size: 10 });
    });
    const gap = 2, total = rows.reduce((s, r) => s + r.size * 1.2, 0) + gap * Math.max(0, rows.length - 1);
    let y = b.h / 2 - total / 2;
    rows.forEach(r => {
      const tx = el('text', { class: r.cls, x: mid, y: y + r.size * 0.95, 'text-anchor': 'middle' }, r.text);
      styleText(tx, r.cls === 'name');
      g.appendChild(tx);
      y += r.size * 1.2 + gap;
    });
  } else if(b.type === 'operator' || b.type === 'periodShift'){
    const sym = t.lines[0] || { text: '', cls: '' };
    if(b.portop){
      g.appendChild(el('text', { class: 'opsym word', x: mid, y: 18, 'text-anchor': 'middle' }, fit(sym.text, b.w - 12, 13)));
      b.ins.forEach((p, i) => {
        g.appendChild(el('circle', { class: 'port', cx: p.x - b.x, cy: p.y - b.y, r: 5 }));
        g.appendChild(el('text', { class: 'io-label', x: 20, y: PORT_HEADER_H + i * PORT_ROW_H + 14 }, fit(p.name, b.w - 28, 11)));
      });
    } else {
      g.appendChild(el('text', { class: sym.cls, x: mid, y: b.h / 2 + (sym.cls.indexOf('word') >= 0 || b.type === 'periodShift' ? 5 : 8), 'text-anchor': 'middle' }, fit(sym.text, b.w - 6, sym.cls.indexOf('word') >= 0 ? 13 : 24, true)));
    }
    if(t.result){
      const rg = el('g', { class: 'result' + (t.result === '?' ? ' err' : '') });
      const w = Math.max(24, t.result.length * 6.8 + 12);
      rg.appendChild(el('rect', { x: mid - w / 2, y: b.h + 5, width: w, height: 16, rx: 4 }));
      rg.appendChild(el('text', { x: mid, y: b.h + 17, 'text-anchor': 'middle' }, t.result));
      g.appendChild(rg);
    }
  } else if(b.type === 'blockInstance' || b.type === 'function'){
    g.appendChild(el('rect', { class: 'header', x: 0, y: 0, width: b.w, height: PORT_HEADER_H, rx: 6 }));
    g.appendChild(el('text', { class: 'header-text', x: mid, y: 17, 'text-anchor': 'middle' }, fit(b.header || '', b.w - 24, 12)));
    if(b.warn){
      g.appendChild(el('text', { class: 'warning', x: 8, y: PORT_HEADER_H + 14 }, b.warn === 'unreadable' ? "⚠ Formula can't be read" : '⚠ Definition missing'));
    }
    const top = b.type === 'function' ? b.inTop : PORT_HEADER_H;
    b.ins.forEach((p, i) => {
      g.appendChild(el('circle', { class: 'port', cx: p.x - b.x, cy: p.y - b.y, r: 5 }));
      g.appendChild(el('text', { class: 'io-label', x: 16, y: top + i * PORT_ROW_H + 14 }, fit(p.name, (b.type === 'function' ? b.w * 0.5 : b.w / 2) - 16, 11)));
    });
    b.outs.forEach((p, i) => {
      g.appendChild(el('circle', { class: 'port', cx: p.x - b.x, cy: p.y - b.y, r: 5 }));
      if(b.type === 'blockInstance'){
        const v = t.ports && t.ports[i] ? ' ' + t.ports[i] : '';
        g.appendChild(el('text', { class: 'io-label out', x: b.w - 16, y: top + i * PORT_ROW_H + 14, 'text-anchor': 'end' }, fit(p.name + v, b.w / 2 - 16, 11)));
      } else {
        g.appendChild(el('text', { class: 'io-value' + (t.result === '?' ? ' err' : ''), x: b.w - 16, y: top + 14, 'text-anchor': 'end' }, fit(t.result || '', b.w * 0.45 - 16, 11, true)));
        if(t.unit) g.appendChild(el('text', { class: 'unit', x: b.w - 16, y: top + 30, 'text-anchor': 'end' }, fit(t.unit, b.w * 0.45 - 16, 10, true)));
      }
    });
  }
  (t.chips || []).forEach((c, i) => {
    const w = c.text.length * 6.2 + 14;
    const y = c.at === 'top' ? -20 : b.h + 5 + (i > 0 && c.at === 'bottom' ? 0 : 0);
    const cg = el('g', { class: 'chip ' + c.cls });
    cg.appendChild(el('rect', { x: mid - w / 2, y, width: w, height: 15, rx: 7.5 }));
    cg.appendChild(el('text', { x: mid, y: y + 11, 'text-anchor': 'middle' }, c.text));
    g.appendChild(cg);
  });
  return g;
}

// The arrow heads, once per SVG (fmIDE's markers).
export function canvasDefs(svg){
  if(svg.querySelector('defs.cv-defs')) return;
  const defs = el('defs', { class: 'cv-defs' });
  [['cv-arrow', '#64748b'], ['cv-arrow-auto', '#8b5cf6']].forEach(([id, colour]) => {
    const m = el('marker', { id, markerWidth: 9, markerHeight: 9, refX: 7, refY: 3.5, orient: 'auto' });
    m.appendChild(el('path', { d: 'M0,0 L7,3.5 L0,7 Z', fill: colour }));
    defs.appendChild(m);
  });
  svg.insertBefore(defs, svg.firstChild);
}
