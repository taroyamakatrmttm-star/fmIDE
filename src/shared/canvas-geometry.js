// ---------- canvas geometry (shared: src/shared/canvas-geometry.js; fmIDE's canvas and the showcase viewer) ----------
// Where fmIDE's arrows meet a node's edge, and the sizes fmIDE gives the nodes whose size
// follows their ports. Moved out of fmIDE (07-rendering.js, 01-setup-commands-keys.js,
// 11d-function-nodes.js) unchanged for the showcase viewer's read-only drawing (phase V1 of
// docs/viewer-brief.md), so both draw a canvas alike. Plain functions on numbers: nothing here
// touches the page.

// A node's box with its middle.
export function rectOf(n){ return {x:n.x, y:n.y, w:n.w, h:n.h, cx:n.x+n.w/2, cy:n.y+n.h/2}; }

// Where the line from a box's middle towards (tx, ty) leaves the box.
export function borderPoint(rect, tx, ty){
  const dx = tx - rect.cx, dy = ty - rect.cy;
  if(dx === 0 && dy === 0) return {x:rect.cx, y:rect.cy};
  const hw = rect.w/2, hh = rect.h/2;
  const scaleX = hw / Math.abs(dx || 1e-6);
  const scaleY = hh / Math.abs(dy || 1e-6);
  const scale = Math.min(scaleX, scaleY);
  return { x: rect.cx + dx*scale, y: rect.cy + dy*scale };
}

// An arrow between two boxes: from edge to edge, along the line joining their middles.
export function edgePath(fromRect, toRect){
  const p1 = borderPoint(fromRect, toRect.cx, toRect.cy);
  const p2 = borderPoint(toRect, fromRect.cx, fromRect.cy);
  return {p1, p2, d:`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`};
}

// Nodes with a row per port: a header, then the rows.
export const PORT_HEADER_H = 26;
export const PORT_ROW_H = 20;

// An operator with named inputs (if, round, choose…): its height for `count` inputs.
export function operatorPortsHeight(count){ return 26 + count * 20 + 6; }
// A block instance with `rows` rows (the more of its inputs and outputs, at least 1).
export function blockInstanceHeight(rows){ return PORT_HEADER_H + rows * PORT_ROW_H + 8; }
// A function node with `inputs` input rows (and a warning row).
export function functionNodeHeight(inputs, warn){ return 26 + (warn ? 20 : 0) + Math.max(inputs, 2) * 20 + 8; }
// The width such a node keeps: its own, unless it has none or one narrower than `min`.
export function portNodeWidth(w, min, wide){ return (!w || w < min) ? wide : w; }
