// ── Selection / drag / resize / floating toolbar ─────────────────────────────

let selectedIdx     = -1;        // основной (для одиночного) — для совместимости
let selectedIndices = [];        // массив индексов для multi-select
let dragState       = null;      // { startX, startY, origStrokes: Map<idx, stroke> }
let resizeState     = null;      // single-resize: { handle, origStroke, origBounds }
let clipboard       = null;      // массив stroke-ов
let rubberBand      = null;      // { startWx, startWy, endWx, endWy }

function setSelection(indices) {
  selectedIndices = Array.isArray(indices) ? indices.filter(i => i >= 0 && i < strokes.length) : [];
  selectedIdx = selectedIndices.length === 1 ? selectedIndices[0] : -1;
}

function isSelected(idx) {
  return selectedIndices.includes(idx);
}

const HANDLE_SIZE = 8;

// ── Bounding box (world space) ────────────────────────────────────────────────

function getStrokeBounds(stroke) {
  if (stroke.type === 'line' || stroke.type === 'arrow') {
    const x = Math.min(stroke.x, stroke.x2);
    const y = Math.min(stroke.y, stroke.y2);
    return { x, y, w: Math.abs(stroke.x2 - stroke.x), h: Math.abs(stroke.y2 - stroke.y) };
  }
  if (stroke.pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (stroke.size || 2) / 2;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  let { x, y, w, h } = stroke;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  return { x, y, w, h };
}

function insideBounds(b, x, y, padWorld = 6) {
  return x >= b.x - padWorld && x <= b.x + b.w + padWorld &&
         y >= b.y - padWorld && y <= b.y + b.h + padWorld;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const old = document.getElementById('wb-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'wb-toast';
  el.className = 'wb-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('wb-toast-show'));
  setTimeout(() => {
    el.classList.remove('wb-toast-show');
    setTimeout(() => el.remove(), 300);
  }, 1800);
}

// ── Selection overlay (рисуется в screen space) ──────────────────────────────

function getHandleScreenPositions(stroke) {
  const b = getStrokeBounds(stroke);
  const pad = 6 / Viewport.getZoom();
  const x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;

  // Углы и середины в world space
  const corners = [
    { id: 'nw', x, y },
    { id: 'n',  x: x + w / 2, y },
    { id: 'ne', x: x + w, y },
    { id: 'e',  x: x + w, y: y + h / 2 },
    { id: 'se', x: x + w, y: y + h },
    { id: 's',  x: x + w / 2, y: y + h },
    { id: 'sw', x, y: y + h },
    { id: 'w',  x, y: y + h / 2 },
  ];
  return corners.map(c => {
    const s = Viewport.worldToScreen(c.x, c.y);
    return { id: c.id, sx: s.x, sy: s.y, wx: c.x, wy: c.y };
  });
}

function drawSelection(ctx, stroke) {
  const b = getStrokeBounds(stroke);
  const pad = 6 / Viewport.getZoom();
  const tl = Viewport.worldToScreen(b.x - pad, b.y - pad);
  const br = Viewport.worldToScreen(b.x + b.w + pad, b.y + b.h + pad);
  const sx = tl.x, sy = tl.y, sw = br.x - tl.x, sh = br.y - tl.y;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1a73e8';

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.setLineDash([]);

  const handles = getHandleScreenPositions(stroke);
  for (const h of handles) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(h.sx - HANDLE_SIZE/2, h.sy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(h.sx - HANDLE_SIZE/2, h.sy - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
  }


  ctx.restore();
}

function drawSelectionOverlay(ctx) {
  // Single selection — с ручками resize
  if (selectedIndices.length === 1) {
    drawSelection(ctx, strokes[selectedIndices[0]]);
  } else if (selectedIndices.length > 1) {
    // Multi-select — bounding box без ручек, рамка вокруг каждого + общая
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1a73e8';
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    for (const i of selectedIndices) {
      const b = getStrokeBounds(strokes[i]);
      const tl = Viewport.worldToScreen(b.x - 4 / Viewport.getZoom(), b.y - 4 / Viewport.getZoom());
      const br = Viewport.worldToScreen(b.x + b.w + 4 / Viewport.getZoom(), b.y + b.h + 4 / Viewport.getZoom());
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    // Общая рамка
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    const tl = Viewport.worldToScreen(minX - 8 / Viewport.getZoom(), minY - 8 / Viewport.getZoom());
    const br = Viewport.worldToScreen(maxX + 8 / Viewport.getZoom(), maxY + 8 / Viewport.getZoom());
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();
  }

  // Rubber band
  if (rubberBand) {
    const a = Viewport.worldToScreen(rubberBand.startWx, rubberBand.startWy);
    const b = Viewport.worldToScreen(rubberBand.endWx, rubberBand.endWy);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.save();
    ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

// ── Hit testing ручек ────────────────────────────────────────────────────────

function hitTestHandle(stroke, screenX, screenY) {
  const handles = getHandleScreenPositions(stroke);
  for (const h of handles) {
    if (Math.abs(screenX - h.sx) <= HANDLE_SIZE && Math.abs(screenY - h.sy) <= HANDLE_SIZE) {
      return h.id;
    }
  }
  return null;
}

const HANDLE_CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n:  'ns-resize',   s:  'ns-resize',
  e:  'ew-resize',   w:  'ew-resize',
};

// ── Floating toolbar ──────────────────────────────────────────────────────────

const TB_COLORS = ['#000000','#ffffff','#ff0000','#ff9900','#ffff00',
                   '#00cc44','#00ccff','#4a86e8','#9900ff','#ff00ff'];

function showFloatingToolbar(stroke, idx) {
  hideFloatingToolbar();

  const tb = document.createElement('div');
  tb.id = 'floating-toolbar';
  tb.className = 'floating-toolbar';

  const copyIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const delIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>`;
  const upIcon   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
  const downIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

  const zOrderBlock = `
    <button type="button" class="ft-btn ft-z-up"   title="На передний план">${upIcon}</button>
    <button type="button" class="ft-btn ft-z-down" title="На задний план">${downIcon}</button>
  `;

  const colorTrigger = `
    <button type="button" class="ft-btn ft-color-trigger" title="Цвет" id="ft-color-trigger">
      <span class="ft-color-dot" style="background:${stroke.color || '#000'}"></span>
    </button>
    <div class="ft-colors ft-colors-hidden" id="ft-colors"></div>
  `;

  tb.innerHTML = `
    ${colorTrigger}
    <div class="ft-divider"></div>
    ${zOrderBlock}
    <div class="ft-divider"></div>
    <button type="button" class="ft-btn ft-copy"   title="Копировать (Ctrl+C)">${copyIcon}</button>
    <button type="button" class="ft-btn ft-delete" title="Удалить">${delIcon}</button>
  `;

  document.body.appendChild(tb);
  positionToolbar(tb, stroke);

  // Цвета — раскрываются по клику на триггер
  const colorsEl = tb.querySelector('#ft-colors');
  const colorDot  = tb.querySelector('.ft-color-dot');
  TB_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'ft-color-swatch' + (isLight(color) ? ' light' : '');
    sw.style.background = color;
    sw.title = color;
    if (color === stroke.color) sw.classList.add('active');
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      colorsEl.querySelectorAll('.ft-color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      stroke.color = color;
      colorDot.style.background = color;
      updateStroke(idx, { color, fill: stroke.fill ? color : null });
    });
    colorsEl.appendChild(sw);
  });

  tb.querySelector('#ft-color-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    if (colorsEl.classList.contains('ft-colors-open')) {
      colorsEl.classList.replace('ft-colors-open', 'ft-colors-closing');
      colorsEl.addEventListener('animationend', () => {
        colorsEl.classList.remove('ft-colors-closing');
        colorsEl.classList.add('ft-colors-hidden');
      }, { once: true });
    } else {
      colorsEl.classList.remove('ft-colors-hidden');
      colorsEl.classList.add('ft-colors-open');
    }
  });

  tb.querySelector('.ft-z-up')?.addEventListener('click', (e) => {
    e.stopPropagation();
    bringToFront();
  });
  tb.querySelector('.ft-z-down')?.addEventListener('click', (e) => {
    e.stopPropagation();
    sendToBack();
  });
  tb.querySelector('.ft-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    copySelected();
  });
  tb.querySelector('.ft-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSelected();
  });

}

function positionToolbar(tb, stroke) {
  if (!tb) return;
  const b = getStrokeBounds(stroke);
  const padW = 6 / Viewport.getZoom();
  const tlScreen = Viewport.worldToScreen(b.x - padW, b.y - padW);
  const brScreen = Viewport.worldToScreen(b.x + b.w + padW, b.y + b.h + padW);
  const tbRect = tb.getBoundingClientRect();
  let left = tlScreen.x;
  let top  = tlScreen.y - tbRect.height - 8;
  if (top < 8) top = brScreen.y + 8; // снизу если не помещается
  // не за экран по горизонтали
  const maxLeft = window.innerWidth - tbRect.width - 8;
  if (left > maxLeft) left = maxLeft;
  if (left < 8) left = 8;
  tb.style.left = left + 'px';
  tb.style.top  = top + 'px';
}

function repositionToolbar() {
  const tb = document.getElementById('floating-toolbar');
  if (!tb) return;
  if (selectedIndices.length === 1) {
    positionToolbar(tb, strokes[selectedIndices[0]]);
  } else if (selectedIndices.length > 1) {
    let minX = Infinity, minY = Infinity;
    for (const i of selectedIndices) {
      const b = getStrokeBounds(strokes[i]);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
    }
    const tlScreen = Viewport.worldToScreen(minX, minY);
    const tbRect = tb.getBoundingClientRect();
    let top = tlScreen.y - tbRect.height - 8;
    if (top < 8) top = 8;
    tb.style.left = Math.min(tlScreen.x, window.innerWidth - tbRect.width - 8) + 'px';
    tb.style.top  = top + 'px';
  }
}

function hideFloatingToolbar() {
  const tb = document.getElementById('floating-toolbar');
  if (tb) tb.remove();
}

function deselectAll() {
  selectedIdx = -1;
  selectedIndices = [];
  rubberBand = null;
  hideFloatingToolbar();
  scheduleRender();
}

// ── Mousedown handler called from canvas.js ──────────────────────────────────

function handleSelectMousedown(wx, wy, screenPos, e) {
  const shiftHeld = e && e.shiftKey;

  // 1. Resize ручки (только при единственной выделенной фигуре)
  if (selectedIndices.length === 1) {
    const handle = hitTestHandle(strokes[selectedIndices[0]], screenPos.x, screenPos.y);
    if (handle) {
      resizeState = {
        handle,
        origStroke: JSON.parse(JSON.stringify(strokes[selectedIndices[0]])),
        origBounds: getStrokeBounds(strokes[selectedIndices[0]]),
      };
      return 'resize';
    }
  }

  // 2. Если кликнули внутри multi-выделения — drag всей группы
  if (selectedIndices.length > 0) {
    const insideAny = selectedIndices.some(i => insideBounds(getStrokeBounds(strokes[i]), wx, wy));
    if (insideAny) {
      const origStrokes = {};
      for (const i of selectedIndices) origStrokes[i] = JSON.parse(JSON.stringify(strokes[i]));
      dragState = { startX: wx, startY: wy, origStrokes };
      return 'drag';
    }
  }

  // 3. Клик по фигуре
  const idx = findShapeAt(wx, wy);
  if (idx >= 0) {
    if (shiftHeld) {
      // Toggle в выделении
      if (isSelected(idx)) {
        setSelection(selectedIndices.filter(i => i !== idx));
      } else {
        setSelection([...selectedIndices, idx]);
      }
    } else {
      setSelection([idx]);
    }
    refreshFloatingToolbar();
    scheduleRender();
    // Стартуем drag
    if (selectedIndices.length > 0) {
      const origStrokes = {};
      for (const i of selectedIndices) origStrokes[i] = JSON.parse(JSON.stringify(strokes[i]));
      dragState = { startX: wx, startY: wy, origStrokes };
      return 'drag';
    }
    return 'selected';
  }

  // 4. Пустое место — rubber band
  if (!shiftHeld) deselectAll();
  rubberBand = { startWx: wx, startWy: wy, endWx: wx, endWy: wy };
  return 'rubber';
}

function refreshFloatingToolbar() {
  hideFloatingToolbar();
  if (selectedIndices.length === 1) {
    showFloatingToolbar(strokes[selectedIndices[0]], selectedIndices[0]);
  } else if (selectedIndices.length > 1) {
    showMultiSelectToolbar();
  }
}

function showMultiSelectToolbar() {
  hideFloatingToolbar();
  const tb = document.createElement('div');
  tb.id = 'floating-toolbar';
  tb.className = 'floating-toolbar';
  tb.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted);padding:0 8px">Выделено: ${selectedIndices.length}</span>
    <div class="ft-divider"></div>
    <button type="button" class="ft-btn ft-copy" title="Копировать"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
    <button type="button" class="ft-btn ft-delete" title="Удалить"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg></button>
  `;
  document.body.appendChild(tb);

  // Позиционирование над общим bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity;
  for (const i of selectedIndices) {
    const b = getStrokeBounds(strokes[i]);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
  }
  const tlScreen = Viewport.worldToScreen(minX, minY);
  const tbRect = tb.getBoundingClientRect();
  let top = tlScreen.y - tbRect.height - 8;
  if (top < 8) top = 8;
  tb.style.left = Math.min(tlScreen.x, window.innerWidth - tbRect.width - 8) + 'px';
  tb.style.top  = top + 'px';

  tb.querySelector('.ft-copy').addEventListener('click', (e) => { e.stopPropagation(); copySelected(); });
  tb.querySelector('.ft-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSelected(); });
}

// ── Drag / resize ────────────────────────────────────────────────────────────

function applyTranslate(stroke, dx, dy, orig) {
  if (stroke.type === 'line' || stroke.type === 'arrow') {
    stroke.x  = orig.x  + dx; stroke.y  = orig.y  + dy;
    stroke.x2 = orig.x2 + dx; stroke.y2 = orig.y2 + dy;
  } else if (stroke.pts) {
    stroke.pts = orig.pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
  } else {
    stroke.x = orig.x + dx;
    stroke.y = orig.y + dy;
  }
}

function doDrag(wx, wy, sx, sy) {
  if (resizeState) {
    doResize(wx, wy);
    repositionToolbar();
    return;
  }
  if (rubberBand) {
    rubberBand.endWx = wx;
    rubberBand.endWy = wy;
    scheduleRender();
    return;
  }
  if (!dragState) return;
  const dx = wx - dragState.startX;
  const dy = wy - dragState.startY;
  for (const i of selectedIndices) {
    const orig = dragState.origStrokes[i];
    if (orig) applyTranslate(strokes[i], dx, dy, orig);
  }
  scheduleRender();
  repositionToolbar();
}

function commitRubberBand() {
  if (!rubberBand) return;
  const x1 = Math.min(rubberBand.startWx, rubberBand.endWx);
  const y1 = Math.min(rubberBand.startWy, rubberBand.endWy);
  const x2 = Math.max(rubberBand.startWx, rubberBand.endWx);
  const y2 = Math.max(rubberBand.startWy, rubberBand.endWy);
  rubberBand = null;
  // Минимальный размер чтобы не считать клик
  if (x2 - x1 < 4 && y2 - y1 < 4) { scheduleRender(); return; }
  // Все strokes чей bbox пересекается с rubber band
  const found = [];
  for (let i = 0; i < strokes.length; i++) {
    if (strokes[i].eraser) continue;
    const b = getStrokeBounds(strokes[i]);
    if (b.x + b.w >= x1 && b.x <= x2 && b.y + b.h >= y1 && b.y <= y2) {
      found.push(i);
    }
  }
  setSelection(found);
  refreshFloatingToolbar();
  scheduleRender();
}

function doResize(wx, wy) {
  const s = strokes[selectedIdx];
  const orig = resizeState.origStroke;
  const ob = resizeState.origBounds;
  const handle = resizeState.handle;

  // Новые границы по handle
  let nx = ob.x, ny = ob.y, nw = ob.w, nh = ob.h;
  if (handle.includes('w')) { nw = ob.w + (ob.x - wx); nx = wx; }
  if (handle.includes('e')) { nw = wx - ob.x; }
  if (handle.includes('n')) { nh = ob.h + (ob.y - wy); ny = wy; }
  if (handle.includes('s')) { nh = wy - ob.y; }

  // Минимальный размер
  if (nw < 4) { nw = 4; if (handle.includes('w')) nx = ob.x + ob.w - 4; }
  if (nh < 4) { nh = 4; if (handle.includes('n')) ny = ob.y + ob.h - 4; }

  if (s.type === 'line' || s.type === 'arrow') {
    // Масштаб концов относительно ob
    const scaleX = ob.w === 0 ? 1 : nw / ob.w;
    const scaleY = ob.h === 0 ? 1 : nh / ob.h;
    s.x  = nx + (orig.x  - ob.x) * scaleX;
    s.y  = ny + (orig.y  - ob.y) * scaleY;
    s.x2 = nx + (orig.x2 - ob.x) * scaleX;
    s.y2 = ny + (orig.y2 - ob.y) * scaleY;
  } else if (s.pts) {
    const scaleX = ob.w === 0 ? 1 : nw / ob.w;
    const scaleY = ob.h === 0 ? 1 : nh / ob.h;
    s.pts = orig.pts.map(p => ({
      x: nx + (p.x - ob.x) * scaleX,
      y: ny + (p.y - ob.y) * scaleY,
    }));
  } else {
    s.x = nx; s.y = ny; s.w = nw; s.h = nh;
  }
  scheduleRender();
}

function endDrag() {
  if (rubberBand) {
    commitRubberBand();
    return;
  }
  const moved = !!dragState || !!resizeState;
  dragState = null;
  resizeState = null;
  if (moved) saveToStorage();
}

// ── Z-order ──────────────────────────────────────────────────────────────────

function bringToFront() {
  if (selectedIdx < 0) return;
  const s = strokes.splice(selectedIdx, 1)[0];
  strokes.push(s);
  setSelection([strokes.length - 1]);
  saveToStorage();
  scheduleRender();
  repositionToolbar();
}

function sendToBack() {
  if (selectedIdx < 0) return;
  const s = strokes.splice(selectedIdx, 1)[0];
  strokes.unshift(s);
  setSelection([0]);
  saveToStorage();
  scheduleRender();
  repositionToolbar();
}

// ── Copy / Paste / Delete / Duplicate ────────────────────────────────────────

function copySelected() {
  if (selectedIndices.length === 0) { showToast('Выделите фигуру'); return; }
  clipboard = selectedIndices.map(i => JSON.parse(JSON.stringify(strokes[i])));
  showToast(`Скопировано: ${clipboard.length}`);
}

function pasteClipboard() {
  if (!clipboard || !clipboard.length) { showToast('Буфер пуст'); return; }
  const offset = 20;
  const newIndices = [];
  const cloned = clipboard.map(s => JSON.parse(JSON.stringify(s)));
  for (const copy of cloned) {
    if (copy.pts) {
      copy.pts = copy.pts.map(p => ({ x: p.x + offset, y: p.y + offset }));
    } else {
      copy.x = (copy.x || 0) + offset;
      copy.y = (copy.y || 0) + offset;
      if (copy.x2 !== undefined) { copy.x2 += offset; copy.y2 += offset; }
    }
    strokes.push(copy);
    newIndices.push(strokes.length - 1);
  }
  // Следующая вставка тоже сместится
  clipboard = cloned.map(c => JSON.parse(JSON.stringify(c)));
  setSelection(newIndices);
  redoStack = [];
  saveToStorage();
  updateEmptyHint(); updateStatus();
  refreshFloatingToolbar();
  scheduleRender();
  showToast(`Вставлено: ${newIndices.length}`);
}

function duplicateSelected() {
  if (selectedIndices.length === 0) return;
  copySelected();
  pasteClipboard();
}

function deleteSelected() {
  if (selectedIndices.length === 0) return;
  // Удаляем по убыванию индексов чтобы не сдвигать
  const sorted = [...selectedIndices].sort((a, b) => b - a);
  for (const i of sorted) {
    redoStack.push(strokes.splice(i, 1)[0]);
  }
  setSelection([]);
  hideFloatingToolbar();
  saveToStorage();
  updateEmptyHint(); updateStatus();
  scheduleRender();
}

function selectAll() {
  if (strokes.length === 0) return;
  const all = [];
  for (let i = 0; i < strokes.length; i++) {
    if (!strokes[i].eraser) all.push(i);
  }
  setSelection(all);
  refreshFloatingToolbar();
  scheduleRender();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLight(hex) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114)/1000 > 200;
}

// ── Cursor для resize-ручек при hover в select-режиме ────────────────────────

canvas.addEventListener('mousemove', (e) => {
  if (typeof getTool !== 'function' || getTool() !== 'select') return;
  if (dragState || resizeState || rubberBand) return;
  if (selectedIndices.length === 0) { canvas.style.cursor = 'default'; return; }
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  if (selectedIndices.length === 1) {
    const handle = hitTestHandle(strokes[selectedIndices[0]], sx, sy);
    if (handle) { canvas.style.cursor = HANDLE_CURSORS[handle] || 'default'; return; }
  }
  const wp = Viewport.screenToWorld(sx, sy);
  const inside = selectedIndices.some(i => insideBounds(getStrokeBounds(strokes[i]), wp.x, wp.y));
  canvas.style.cursor = inside ? 'move' : 'default';
});

// При любом изменении viewport — обновляем позицию floating-toolbar
window.addEventListener('wheel', () => repositionToolbar(), { passive: true });
