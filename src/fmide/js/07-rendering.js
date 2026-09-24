  // ---------- rendering ----------
  function render(){
    if(tx.depth > 0) return; // batched: rendered once when the transaction finishes
    const existing = new Map();
    canvas.querySelectorAll('.node').forEach(el => existing.set(el.dataset.id, el));
    const uomVisiting = new Set();
    const uomMemo = {};

    nodes.forEach(n => {
      let el = existing.get(n.id);
      const isOperator = n.type === 'operator';
      const isAlias = n.type === 'alias';
      const isBlockInstance = n.type === 'blockInstance';
      const isPeriodShift = n.type === 'periodShift';
      if(!el){
        el = document.createElement('div');
        el.dataset.id = n.id;
        canvas.appendChild(el);
        attachNodeEvents(el);
        el._built = null;
      } else {
        existing.delete(n.id);
      }
      el.className = 'node' + (isOperator ? ' operator' : '') + (isAlias ? ' alias' : '') + (isBlockInstance ? ' blockInstance' : '') + (isBlockInstance && n.vertical ? ' vertical' : '') + (isPeriodShift ? ' periodshift' : '') + (isOperator && WORD_OPS.includes(n.text) ? ' wordop' : '');

      if(isBlockInstance){
        renderBlockInstanceBody(el, n);
      } else if(el._built !== n.type){
        if(isOperator){
          el.innerHTML = '<div class="port n" data-side="n"></div><div class="port s" data-side="s"></div><div class="port e" data-side="e"></div><div class="port w" data-side="w"></div><button type="button" class="tag-btn socket-btn" title="Set socket">⚡</button><div class="socket-chip"></div><div class="opsym"></div><div class="op-result"></div>';
        } else if(isPeriodShift){
          el.innerHTML = '<div class="port n" data-side="n"></div><div class="port s" data-side="s"></div><div class="port e" data-side="e"></div><div class="port w" data-side="w"></div><div class="ps-label"></div><div class="op-result"></div>';
        } else if(isAlias){
          el.innerHTML = '<div class="port n" data-side="n"></div><div class="port s" data-side="s"></div><div class="port e" data-side="e"></div><div class="port w" data-side="w"></div><button type="button" class="tag-btn plug-btn" title="Set plug">🔌</button><div class="plug-chip"></div><button type="button" class="tag-btn relink-btn" title="Change linked rectangle">🔗</button><div class="label"><div class="line-name"></div><div class="line-value"></div><div class="line-uom"></div></div><div class="resize-handle"></div>';
        } else {
          el.innerHTML = '<div class="port n" data-side="n"></div><div class="port s" data-side="s"></div><div class="port e" data-side="e"></div><div class="port w" data-side="w"></div><button type="button" class="tag-btn plug-btn" title="Set plug">🔌</button><div class="plug-chip"></div><button type="button" class="tag-btn io-btn" title="Mark as block input/output">⇄</button><div class="io-role-chip"></div><button type="button" class="tag-btn props-btn" title="Format rectangle (number/border/font/fill)">🎨</button><button type="button" class="tag-btn period-btn" title="Choose which periods use this rectangle\'s own number">🕒</button><button type="button" class="tag-btn curve-btn" title="Draw this rectangle\'s value across periods">📈</button><div class="label"><div class="line-name"></div><div class="line-value"></div><div class="line-uom"></div></div><div class="resize-handle"></div>';
        }
        el._built = n.type;
      }

      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.style.width = n.w + 'px';
      el.style.height = n.h + 'px';
      el.classList.toggle('selected', selectedNodeIds.has(n.id));

      if(isBlockInstance){
        // content fully handled by renderBlockInstanceBody() above
      } else if(isOperator){
        const sym = el.querySelector('.opsym');
        if(sym) sym.textContent = n.text;
        const chip = el.querySelector('.socket-chip');
        if(chip){
          if(n.socket){ chip.textContent = '⚡ ' + n.socket; chip.style.display = 'block'; }
          else chip.style.display = 'none';
        }
        const res = el.querySelector('.op-result');
        if(res){
          res.classList.remove('show','err');
          res.title = '';
          if(computedValues[n.id] !== undefined && computedValues[n.id] !== null){
            res.textContent = '= ' + formatNum(computedValues[n.id]);
            res.classList.add('show');
          } else if(computeErrors[n.id]){
            res.textContent = '?';
            res.classList.add('show','err');
            res.title = errorTitle(computeErrors[n.id]);
          } else {
            res.textContent = '';
          }
        }
      } else if(isPeriodShift){
        const lab = el.querySelector('.ps-label');
        if(lab) lab.textContent = shiftLabel(typeof n.shift === 'number' ? n.shift : -1);
        const res = el.querySelector('.op-result');
        if(res){
          res.classList.remove('show','err');
          res.title = '';
          if(computedValues[n.id] !== undefined && computedValues[n.id] !== null){
            res.textContent = '= ' + formatNum(computedValues[n.id]);
            res.classList.add('show');
          } else if(computeErrors[n.id]){
            res.textContent = '?';
            res.classList.add('show','err');
            res.title = errorTitle(computeErrors[n.id]);
          } else {
            res.textContent = '';
          }
        }
      } else if(isAlias){
        const chip = el.querySelector('.plug-chip');
        if(chip){
          if(n.plug){ chip.textContent = '🔌 ' + n.plug; chip.style.display = 'block'; }
          else chip.style.display = 'none';
        }
        const lbl = el.querySelector('.label');
        if(lbl){
          const nameEl = lbl.querySelector('.line-name');
          const valEl = lbl.querySelector('.line-value');
          const srcCanvas = canvases.find(c => c.id === n.sourceCanvasId);
          const srcNode = srcCanvas
            ? (srcCanvas.id === activeCanvasId ? nodes : srcCanvas.nodes).find(x => x.id === n.sourceNodeId)
            : null;
          let label;
          if(!n.sourceCanvasId || !n.sourceNodeId) label = '🔗 (not linked)';
          else if(!srcCanvas) label = '🔗 (canvas missing)';
          else if(!srcNode) label = '🔗 (rectangle missing)';
          else {
            const srcName = parseNode(srcNode).name || '(unnamed)';
            label = srcCanvas.id === activeCanvasId ? ('🔗 ' + srcName) : ('🔗 ' + srcCanvas.name + ' ▸ ' + srcName);
          }
          if(nameEl) nameEl.textContent = label;
          const uomEl = lbl.querySelector('.line-uom');
          if(uomEl){
            let uomStr = '', isAuto = false;
            if(srcNode && srcCanvas){
              const auto = computeNodeUOM(srcCanvas.id, srcNode.id, uomVisiting, uomMemo);
              if(auto){ uomStr = formatUOM(auto); isAuto = true; }
            }
            uomEl.textContent = uomStr;
            uomEl.classList.toggle('auto', isAuto);
          }
          if(valEl){
            valEl.classList.remove('literal','computed','error');
            valEl.title = '';
            if(computedValues[n.id] !== undefined && computedValues[n.id] !== null){
              valEl.textContent = '= ' + formatNum(computedValues[n.id]);
              valEl.classList.add('computed');
            } else if(computeErrors[n.id]){
              valEl.textContent = '?';
              valEl.classList.add('error');
              valEl.title = errorTitle(computeErrors[n.id]);
            } else {
              valEl.textContent = '';
            }
          }
        }
      } else {
        const chip = el.querySelector('.plug-chip');
        if(chip){
          if(n.plug){ chip.textContent = '🔌 ' + n.plug; chip.style.display = 'block'; }
          else chip.style.display = 'none';
        }
        const roleChip = el.querySelector('.io-role-chip');
        if(roleChip){
          roleChip.classList.remove('input','output','index');
          if(n.blockRole === 'input'){ roleChip.textContent = '→ IN'; roleChip.classList.add('input'); }
          else if(n.blockRole === 'output'){ roleChip.textContent = 'OUT →'; roleChip.classList.add('output'); }
          else if(n.blockRole === 'index'){ roleChip.textContent = '# IDX'; roleChip.classList.add('index'); }
          else { roleChip.textContent = ''; }
        }
        let reducerChip = el.querySelector('.reducer-chip');
        if(n.blockRole === 'output'){
          if(!reducerChip){
            reducerChip = document.createElement('div');
            reducerChip.className = 'reducer-chip';
            reducerChip.title = "Used only when a Block instance of this canvas is marked Vertical: how this output's per-instance values are combined into one.";
            el.appendChild(reducerChip);
          }
          reducerChip.textContent = 'Σ ' + (n.verticalReducer || 'sum');
          reducerChip.style.display = 'block';
        } else if(reducerChip){
          reducerChip.style.display = 'none';
        }
        const hasIncoming = edges.some(e => e.to === n.id);
        const curveBtn = el.querySelector('.curve-btn');
        if(curveBtn){
          curveBtn.style.display = hasIncoming ? 'none' : '';
          curveBtn.classList.toggle('active', Array.isArray(n.periodValues));
        }
        const lbl = el.querySelector('.label');
        if(lbl && !el.querySelector('textarea')){
          const nameEl = lbl.querySelector('.line-name');
          const valEl = lbl.querySelector('.line-value');
          const uomEl = lbl.querySelector('.line-uom');
          const parsed = parseNode(n);
          const {name} = parsed;
          const literal = effectiveLiteral(n, currentPeriod);
          if(nameEl){ nameEl.textContent = name; nameEl.style.display = name ? '' : 'none'; }
          if(uomEl){
            let uomStr = '', isAuto = false;
            if(parsed.uom){
              uomStr = parsed.uom;
            } else {
              const auto = computeNodeUOM(activeCanvasId, n.id, uomVisiting, uomMemo);
              if(auto){ uomStr = formatUOM(auto); isAuto = true; }
            }
            uomEl.textContent = uomStr;
            uomEl.classList.toggle('auto', isAuto);
          }
          if(valEl){
            valEl.classList.remove('literal','computed','error');
            valEl.title = '';
            if(!hasIncoming){
              // True input: always has a value now — its own number, or zero by default.
              const shown = (literal !== null) ? literal : 0;
              valEl.textContent = (Array.isArray(n.periodValues) ? '📈 ' : '') + formatNumForNode(shown, n);
              valEl.classList.add('literal');
            } else if(computedValues[n.id] !== undefined && computedValues[n.id] !== null){
              valEl.textContent = '= ' + formatNumForNode(computedValues[n.id], n);
              valEl.classList.add('computed');
            } else if(computeErrors[n.id]){
              valEl.textContent = '?';
              valEl.classList.add('error');
              valEl.title = errorTitle(computeErrors[n.id]);
            } else {
              valEl.textContent = '';
            }
          }
        }
        applyNodeStyle(el, n);
      }
    });
    existing.forEach(el => el.remove());

    renderEdges();
    refreshCommandStates();
  }

  function blockPortsOf(defCanvas){
    if(!defCanvas) return { inputs: [], outputs: [], indexNode: null };
    const pool = defCanvas.id === activeCanvasId ? nodes : defCanvas.nodes;
    const inputs = pool.filter(x => x.type === 'value' && x.blockRole === 'input').sort((a,b) => a.x - b.x || a.y - b.y);
    const outputs = pool.filter(x => x.type === 'value' && x.blockRole === 'output').sort((a,b) => a.x - b.x || a.y - b.y);
    // At most one: a rectangle marked as the block's Vertical Index — only meaningful when
    // an instance of this block is used vertically (see computeVerticalBlockInstanceOutput),
    // where it resolves to the current instance's 1-based index instead of being wired in.
    const indexNode = pool.find(x => x.type === 'value' && x.blockRole === 'index') || null;
    return { inputs, outputs, indexNode };
  }

  function renderBlockInstanceBody(el, n){
    const def = canvases.find(c => c.id === n.blockDefCanvasId);
    const { inputs, outputs } = blockPortsOf(def);
    const rows = Math.max(inputs.length, outputs.length, 1);
    const rowH = 20;
    const headerH = 26;
    n.h = headerH + rows * rowH + 8;
    if(!n.w || n.w < 150) n.w = 190;

    el.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'block-header';
    header.textContent = (def ? def.name : '(missing block)') + (n.vertical ? ' ×' + periods.length : '');
    if(n.vertical) header.title = 'Vertical: runs ' + periods.length + ' instances (one per period), reduced into each output.';
    el.appendChild(header);

    const relinkBtn = document.createElement('button');
    relinkBtn.type = 'button';
    relinkBtn.className = 'tag-btn block-relink';
    relinkBtn.title = 'Change block';
    relinkBtn.textContent = '⋯';
    el.appendChild(relinkBtn);

    if(n.vertical){
      const rowsBtn = document.createElement('button');
      rowsBtn.type = 'button';
      rowsBtn.className = 'tag-btn vrows-btn';
      rowsBtn.title = 'View each instance’s own row, not just the combined total';
      rowsBtn.textContent = '▤';
      el.appendChild(rowsBtn);
    }

    const portValsForInstance = portValues[n.id] || [];
    const portErrsForInstance = portErrors[n.id] || [];

    inputs.forEach((inp, i) => {
      const row = document.createElement('div');
      row.className = 'io-row io-row-in';
      row.style.top = (headerH + i * rowH) + 'px';
      const dot = document.createElement('div');
      dot.className = 'io-port';
      dot.dataset.portIndex = i;
      dot.dataset.portDir = 'in';
      const label = document.createElement('span');
      label.className = 'io-label';
      label.textContent = parseNode(inp).name || ('in' + i);
      row.appendChild(dot);
      row.appendChild(label);
      if(n.vertical){
        const inEdge = edges.find(e => e.to === n.id && e.toPort === i);
        const toggle = document.createElement('span');
        toggle.className = 'vindex-toggle' + (inEdge && inEdge.verticalIndexed ? ' on' : '');
        toggle.dataset.portIndex = i;
        toggle.title = inEdge
          ? "Click to switch between 'broadcast' (every instance sees the same value) and 'indexed' (instance i reads this source's value at period i — e.g. a per-period Capex row becoming that vintage's own Capex)."
          : 'Wire an edge into this port first to choose broadcast vs. indexed.';
        toggle.textContent = (inEdge && inEdge.verticalIndexed) ? 'indexed' : 'broadcast';
        row.appendChild(toggle);
      }
      el.appendChild(row);
    });

    outputs.forEach((out, i) => {
      const row = document.createElement('div');
      row.className = 'io-row io-row-out';
      row.style.top = (headerH + i * rowH) + 'px';
      const label = document.createElement('span');
      label.className = 'io-label';
      label.textContent = parseNode(out).name || ('out' + i);
      const valSpan = document.createElement('span');
      valSpan.className = 'io-value';
      const pv = portValsForInstance[i];
      const pe = portErrsForInstance[i];
      if(pv !== undefined && pv !== null){ valSpan.textContent = '=' + formatNum(pv); valSpan.classList.add('computed'); }
      else if(pe){ valSpan.textContent = '?'; valSpan.classList.add('error'); valSpan.title = errorTitle(pe); }
      const dot = document.createElement('div');
      dot.className = 'io-port';
      dot.dataset.portIndex = i;
      dot.dataset.portDir = 'out';
      row.appendChild(label);
      row.appendChild(valSpan);
      row.appendChild(dot);
      el.appendChild(row);
    });
  }

  function rectOf(n){ return {x:n.x, y:n.y, w:n.w, h:n.h, cx:n.x+n.w/2, cy:n.y+n.h/2}; }

  function borderPoint(rect, tx, ty){
    const dx = tx - rect.cx, dy = ty - rect.cy;
    if(dx === 0 && dy === 0) return {x:rect.cx, y:rect.cy};
    const hw = rect.w/2, hh = rect.h/2;
    const scaleX = hw / Math.abs(dx || 1e-6);
    const scaleY = hh / Math.abs(dy || 1e-6);
    const scale = Math.min(scaleX, scaleY);
    return { x: rect.cx + dx*scale, y: rect.cy + dy*scale };
  }

  function edgePath(fromRect, toRect){
    const p1 = borderPoint(fromRect, toRect.cx, toRect.cy);
    const p2 = borderPoint(toRect, fromRect.cx, fromRect.cy);
    return {p1, p2, d:`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`};
  }

  function getPortCanvasPos(nodeId, portIndex, dir){
    const sel = `.node[data-id="${nodeId}"] .io-port[data-port-index="${portIndex}"][data-port-dir="${dir}"]`;
    const portEl = canvas.querySelector(sel);
    if(!portEl) return null;
    const portRect = portEl.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return { x: portRect.left + portRect.width/2 - canvasRect.left, y: portRect.top + portRect.height/2 - canvasRect.top };
  }

  function renderEdges(){
    let defs = svg.querySelector('defs');
    if(!defs){
      defs = document.createElementNS(SVGNS,'defs');
      defs.innerHTML =
        '<marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#64748b"/></marker>' +
        '<marker id="arrow-sel" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#ef4444"/></marker>' +
        '<marker id="arrow-auto" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#8b5cf6"/></marker>';
      svg.appendChild(defs);
    }
    svg.querySelectorAll('g.edge').forEach(g => g.remove());

    edges.forEach(e => {
      const a = getNode(e.from), b = getNode(e.to);
      if(!a || !b) return;
      let {p1, p2, d} = edgePath(rectOf(a), rectOf(b));
      if(e.fromPort != null){
        const pp = getPortCanvasPos(e.from, e.fromPort, 'out');
        if(pp) p1 = pp;
      }
      if(e.toPort != null){
        const pp = getPortCanvasPos(e.to, e.toPort, 'in');
        if(pp) p2 = pp;
      }
      if(e.fromPort != null || e.toPort != null) d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      const isSel = selectedEdgeId === e.id;
      const isAuto = !!e.auto;
      const g = document.createElementNS(SVGNS,'g');
      g.setAttribute('class','edge' + (isSel ? ' selected':'') + (isAuto ? ' auto':''));
      g.dataset.id = e.id;
      const marker = isAuto ? 'arrow-auto' : (isSel ? 'arrow-sel' : 'arrow');
      // DOM calls, not a markup string: d is built from node coordinates, which come
      // from files (possibly shared ones) and must never be parsed as markup.
      const hitPath = document.createElementNS(SVGNS, 'path');
      hitPath.setAttribute('class', 'hit'); hitPath.setAttribute('d', d);
      const linePath = document.createElementNS(SVGNS, 'path');
      linePath.setAttribute('class', 'line'); linePath.setAttribute('d', d); linePath.setAttribute('marker-end', `url(#${marker})`);
      g.appendChild(hitPath); g.appendChild(linePath);
      if(isAuto) g.setAttribute('title', 'Auto-connected via plug/socket match');

      if(b.type === 'operator'){
        const siblings = sortedIncoming(b.id);
        if(siblings.length > 1){
          const idx = siblings.findIndex(s => s.id === e.id) + 1;
          const bx = p1.x + (p2.x - p1.x) * 0.78;
          const by = p1.y + (p2.y - p1.y) * 0.78;
          const badge = document.createElementNS(SVGNS,'g');
          badge.setAttribute('class','order-badge');
          const circ = document.createElementNS(SVGNS, 'circle');
          [['cx', bx], ['cy', by], ['r', 8], ['stroke', isSel ? '#ef4444' : (isAuto ? '#8b5cf6' : '#94a3b8')], ['stroke-width', 1.5]].forEach(([k, v]) => circ.setAttribute(k, v));
          const txt = document.createElementNS(SVGNS, 'text');
          [['x', bx], ['y', by + 3.5], ['text-anchor', 'middle'], ['font-size', 10], ['fill', '#334155']].forEach(([k, v]) => txt.setAttribute(k, v));
          txt.textContent = String(idx);
          badge.appendChild(circ); badge.appendChild(txt);
          g.appendChild(badge);
        }
      }

      if(!isAuto){
        g.addEventListener('mousedown', (ev) => { ev.stopPropagation(); selectEdgeOnly(e.id); });
      }
      svg.appendChild(g);
    });
  }

