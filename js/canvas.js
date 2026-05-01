// ── Canvas core ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.setAttribute('tabindex', '0');

const SHAPE_TOOLS  = new Set(['rect','ellipse','triangle','diamond','star','line','arrow']);
const STROKE_TOOLS = new Set(['pen','eraser','highlighter']);

let drawing  = false;
let points   = [];
let strokes  = [];
let redoStack = [];

let brushSize    = 2;
let brushColor   = '#000000';
let tool         = 'pen';
let prevTool     = 'pen';
let eraserSize   = 20;
let eraserCursor  = null;
let penCursor     = null;

let shapeStart       = null;
let shapeShiftHeld   = false;
let shapeSize        = 2;
let shapeFill        = null;
let highlighterAlpha = 0.35;

let gridEnabled = localStorage.getItem('wb-grid') === '1';
const GRID_STEP = 40;

let panActive    = false;
let panStart     = null;
let spaceHeld    = false;

// ── Empty hint ────────────────────────────────────────────────────────────────

function updateEmptyHint() {
  const el = document.getElementById('empty-hint');
  if (!el) return;
  el.classList.toggle('hidden', strokes.length > 0);
}

// ── Status bar ────────────────────────────────────────────────────────────────

function updateStatus() {
  const objCount = document.getElementById('status-objects');
  if (objCount) objCount.textContent = `Объектов: ${strokes.length}`;
  const undo = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undo) undo.disabled = strokes.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  const zoomLabel = document.getElementById('btn-zoom-reset');
  if (zoomLabel) zoomLabel.textContent = Math.round(Viewport.getZoom() * 100) + '%';
}

function flashSavedIndicator() {
  const el = document.getElementById('status-saved');
  if (!el) return;
  el.classList.add('saving');
  el.textContent = 'Сохранение…';
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.remove('saving');
    el.textContent = 'Сохранено';
  }, 400);
}

// ── DPR / resize ──────────────────────────────────────────────────────────────

function applyCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  Viewport.setDPR(dpr);
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

// ── RAF render scheduler ─────────────────────────────────────────────────────

let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render();
  });
}

// ── Сетка ─────────────────────────────────────────────────────────────────────

function drawGrid() {
  if (!gridEnabled) return;
  const z = Viewport.getZoom();
  const px = Viewport.getPanX();
  const py = Viewport.getPanY();

  // Шаг сетки в screen space, адаптивный
  let step = GRID_STEP * z;
  while (step < 12) step *= 2;
  while (step > 200) step /= 2;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const offsetX = ((px % step) + step) % step;
  const offsetY = ((py % step) + step) % step;

  const styles = getComputedStyle(document.documentElement);
  const grid = styles.getPropertyValue('--grid').trim() || 'rgba(0,0,0,0.06)';

  ctx.save();
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x < w; x += step) {
    ctx.moveTo(x, 0); ctx.lineTo(x, h);
  }
  for (let y = offsetY; y < h; y += step) {
    ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Главный render ───────────────────────────────────────────────────────────

function render() {
  // 1. clear
  Viewport.resetTransform(ctx);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Сетка (в screen space)
  drawGrid();

  // 3. Контент в world-space через transform
  Viewport.applyTransform(ctx);

  for (const s of strokes) {
    drawAnyStroke(ctx, s);
  }

  // 4. Текущий рисуемый штрих (preview)
  if (drawing && STROKE_TOOLS.has(tool) && points.length > 1) {
    if (tool === 'eraser') {
      drawStrokeRaster(ctx, points, eraserSize, brushColor, true, 1);
    } else if (tool === 'highlighter') {
      drawStrokeRaster(ctx, points, brushSize, brushColor, false, highlighterAlpha);
    } else {
      drawStrokeRaster(ctx, points, brushSize, brushColor, false, 1);
    }
  }

  // 5. Превью фигуры
  if (drawing && SHAPE_TOOLS.has(tool) && shapeStart && shapePreviewEnd) {
    const preview = buildShapeStroke(shapeStart.x, shapeStart.y, shapePreviewEnd.x, shapePreviewEnd.y);
    drawShape(ctx, preview);
  }

  // 6. Cursors / overlays — в screen space
  Viewport.resetTransform(ctx);

  if (tool === 'eraser' && eraserCursor) {
    drawEraserCursor(eraserCursor.x, eraserCursor.y);
  }
  if ((tool === 'pen' || tool === 'highlighter') && penCursor) {
    drawPenIndicator(penCursor.x, penCursor.y);
  }
  if (typeof drawSelectionOverlay === 'function') {
    drawSelectionOverlay(ctx);
  }
}

// ── Cursors ──────────────────────────────────────────────────────────────────

function drawPenIndicator(sx, sy) {
  const r = Math.max(brushSize * Viewport.getZoom() / 2, 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  const alpha = tool === 'highlighter' ? '50' : '30';
  ctx.fillStyle = brushColor + alpha;
  ctx.fill();
  ctx.strokeStyle = brushColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawEraserCursor(sx, sy) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, eraserSize * Viewport.getZoom() / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.restore();
}

// ── Geometry / стартовые координаты ──────────────────────────────────────────

function getScreenPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length) {
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  }
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX - rect.left, y: e.changedTouches[0].clientY - rect.top };
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getWorldPos(e) {
  const s = getScreenPos(e);
  return Viewport.screenToWorld(s.x, s.y);
}

// ── Stroke smoothing & rasterization ─────────────────────────────────────────

function smoothPoints(pts, passes = 2) {
  let r = pts;
  for (let p = 0; p < passes; p++) {
    if (r.length < 3) break;
    const s = [r[0]];
    for (let i = 1; i < r.length - 1; i++) {
      s.push({
        x: (r[i - 1].x + r[i].x * 2 + r[i + 1].x) / 4,
        y: (r[i - 1].y + r[i].y * 2 + r[i + 1].y) / 4,
      });
    }
    s.push(r[r.length - 1]);
    r = s;
  }
  return r;
}

function drawStrokeRaster(context, pts, size, color, eraser = false, alpha = 1) {
  if (!pts || pts.length < 2) return;
  const s = smoothPoints(pts);
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = size;
  context.globalAlpha = alpha;
  context.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
  context.strokeStyle = eraser ? 'rgba(0,0,0,1)' : color;
  context.beginPath();
  context.moveTo(s[0].x, s[0].y);
  for (let i = 0; i < s.length - 1; i++) {
    const cp1x = s[i].x + (s[i + 1].x - (s[i - 1] ? s[i - 1].x : s[i].x)) / 6;
    const cp1y = s[i].y + (s[i + 1].y - (s[i - 1] ? s[i - 1].y : s[i].y)) / 6;
    const cp2x = s[i + 1].x - (s[i + 2] ? s[i + 2].x - s[i].x : s[i + 1].x - s[i].x) / 6;
    const cp2y = s[i + 1].y - (s[i + 2] ? s[i + 2].y - s[i].y : s[i + 1].y - s[i].y) / 6;
    context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, s[i + 1].x, s[i + 1].y);
  }
  context.stroke();
  context.restore();
}

function drawAnyStroke(context, stroke) {
  if (!stroke.type || stroke.type === 'pen' || stroke.type === 'eraser' || stroke.type === 'highlighter') {
    const alpha = stroke.type === 'highlighter' ? (stroke.alpha || 0.35) : 1;
    drawStrokeRaster(context, stroke.pts, stroke.size, stroke.color, !!stroke.eraser, alpha);
  } else {
    drawShape(context, stroke);
  }
}

// ── Shape stroke builder ─────────────────────────────────────────────────────

let shapePreviewEnd = null;

function buildShapeStroke(x1, y1, x2, y2) {
  let w = x2 - x1;
  let h = y2 - y1;

  if (shapeShiftHeld && (tool === 'rect' || tool === 'ellipse')) {
    const side = Math.sign(w || 1) * Math.min(Math.abs(w), Math.abs(h));
    w = side; h = side;
  }

  const base = { color: brushColor, size: shapeSize, fill: shapeFill };

  if (tool === 'line' || tool === 'arrow') {
    return { type: tool, x: x1, y: y1, x2: x2, y2: y2, ...base };
  }
  return { type: tool, x: x1, y: y1, w, h, ...base };
}

// ── Storage (debounced) ──────────────────────────────────────────────────────

let saveTimer = null;
function saveToStorage() {
  flashSavedIndicator();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('whiteboard', JSON.stringify(strokes));
    } catch (e) {
      showToast && showToast('Не удалось сохранить (хранилище переполнено)');
    }
  }, 400);
}

function saveImmediate() {
  clearTimeout(saveTimer);
  try { localStorage.setItem('whiteboard', JSON.stringify(strokes)); } catch {}
}

function loadFromStorage() {
  const saved = localStorage.getItem('whiteboard');
  if (saved) {
    try { strokes = JSON.parse(saved) || []; } catch { strokes = []; }
  }
}

// ── Hit testing ──────────────────────────────────────────────────────────────

function hitTestShape(stroke, x, y) {
  const margin = 8 / Viewport.getZoom();
  if (stroke.type === 'line' || stroke.type === 'arrow') {
    const dx = stroke.x2 - stroke.x, dy = stroke.y2 - stroke.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return false;
    const t = Math.max(0, Math.min(1, ((x - stroke.x) * dx + (y - stroke.y) * dy) / len2));
    const px = stroke.x + t * dx - x, py = stroke.y + t * dy - y;
    return Math.sqrt(px * px + py * py) < margin + (stroke.size || 2);
  }
  if (stroke.pts) {
    // Перо/маркер/ластик — проверяем расстояние до отрезков
    const r = (stroke.size || 4) / 2 + margin;
    for (let i = 0; i < stroke.pts.length - 1; i++) {
      const a = stroke.pts[i], b = stroke.pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const px = a.x + t * dx - x, py = a.y + t * dy - y;
      if (Math.sqrt(px * px + py * py) < r) return true;
    }
    return false;
  }
  let { x: sx, y: sy, w, h } = stroke;
  if (w < 0) { sx += w; w = -w; }
  if (h < 0) { sy += h; h = -h; }
  return x >= sx - margin && x <= sx + w + margin &&
         y >= sy - margin && y <= sy + h + margin;
}

function findShapeAt(x, y) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i];
    if (s.eraser) continue;
    if (hitTestShape(s, x, y)) return i;
  }
  return -1;
}

// ── Pointer events ───────────────────────────────────────────────────────────

function startDraw(e) {
  // Pan через middle button или space+drag
  if ((e.button === 1) || (spaceHeld && e.button === 0)) {
    e.preventDefault();
    panActive = true;
    panStart = getScreenPos(e);
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== undefined && e.button !== 0) return;

  drawing = true;
  const wp = getWorldPos(e);
  closeAllToolPopups();

  if (tool === 'select') {
    drawing = false;
    if (typeof handleSelectMousedown === 'function') {
      const r = handleSelectMousedown(wp.x, wp.y, getScreenPos(e), e);
      if (r === 'drag' || r === 'resize' || r === 'rubber') drawing = true;
    }
    return;
  }

  if (tool === 'shape-eraser') {
    drawing = false;
    const idx = findShapeAt(wp.x, wp.y);
    if (idx >= 0) {
      redoStack.push(strokes.splice(idx, 1)[0]);
      saveToStorage();
      updateEmptyHint();
      updateStatus();
      scheduleRender();
    }
    return;
  }

  if (SHAPE_TOOLS.has(tool)) {
    shapeStart = wp;
    shapePreviewEnd = wp;
    return;
  }

  if (STROKE_TOOLS.has(tool)) {
    points = [wp];
  }
}

function onMove(e) {
  const sp = getScreenPos(e);
  const wp = Viewport.screenToWorld(sp.x, sp.y);
  shapeShiftHeld = e.shiftKey;

  // Координаты в статусе
  const coords = document.getElementById('status-coords');
  if (coords) coords.textContent = `x: ${Math.round(wp.x)}, y: ${Math.round(wp.y)}`;

  // Pan
  if (panActive && panStart) {
    Viewport.pan(sp.x - panStart.x, sp.y - panStart.y);
    panStart = sp;
    scheduleRender();
    updateStatus();
    return;
  }

  if (tool === 'eraser')                             eraserCursor = sp;
  else if (tool === 'pen' || tool === 'highlighter') penCursor = sp;

  if (!drawing) {
    scheduleRender();
    return;
  }

  if (e.cancelable) e.preventDefault();

  if (tool === 'select') {
    if (typeof doDrag === 'function') doDrag(wp.x, wp.y, sp.x, sp.y);
    scheduleRender();
    return;
  }

  if (SHAPE_TOOLS.has(tool) && shapeStart) {
    shapePreviewEnd = wp;
    scheduleRender();
    return;
  }

  if (STROKE_TOOLS.has(tool)) {
    points.push(wp);
    scheduleRender();
  }
}

function stopDraw(e) {
  if (panActive) {
    panActive = false;
    panStart = null;
    canvas.style.cursor = spaceHeld ? 'grab' : '';
    setCursorForTool();
    return;
  }
  if (!drawing) return;
  drawing = false;

  let wp;
  try { wp = getWorldPos(e); } catch { wp = null; }

  if (tool === 'select') {
    if (typeof endDrag === 'function') endDrag();
    return;
  }

  if (SHAPE_TOOLS.has(tool) && shapeStart && wp) {
    const stroke = buildShapeStroke(shapeStart.x, shapeStart.y, wp.x, wp.y);
    shapeStart = null;
    shapePreviewEnd = null;
    const tooSmall = (stroke.w !== undefined && Math.abs(stroke.w) < 4 && Math.abs(stroke.h) < 4)
                  || (stroke.x2 !== undefined && Math.abs(stroke.x2 - stroke.x) < 4 && Math.abs(stroke.y2 - stroke.y) < 4);
    if (tooSmall) { scheduleRender(); return; }
    strokes.push(stroke);
    redoStack = [];
    saveToStorage();
    updateEmptyHint();
    updateStatus();
    setSelection([strokes.length - 1]);
    document.getElementById('btn-select')?.click();
    refreshFloatingToolbar();
    scheduleRender();
    return;
  }

  if (STROKE_TOOLS.has(tool) && points.length > 1) {
    const isEraser = tool === 'eraser';
    const stroke = {
      type: tool,
      pts: smoothPoints(points, 3),
      size: isEraser ? eraserSize : brushSize,
      color: brushColor,
      eraser: isEraser,
    };
    if (tool === 'highlighter') stroke.alpha = highlighterAlpha;
    strokes.push(stroke);
    redoStack = [];
    saveToStorage();
    updateEmptyHint();
    updateStatus();
    scheduleRender();
  }
  points = [];
}

// ── Image ────────────────────────────────────────────────────────────────────

function addImageFromDataURL(dataURL, wx, wy) {
  const img = new Image();
  img.onload = () => {
    const maxW = 400;
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxW) { h = h * (maxW / w); w = maxW; }
    const stroke = {
      type: 'image',
      x: (wx ?? window.innerWidth/2) - w/2,
      y: (wy ?? window.innerHeight/2) - h/2,
      w, h,
      src: dataURL,
    };
    // Если wx/wy не заданы — кладём в центр viewport
    if (wx === undefined) {
      const center = Viewport.screenToWorld(window.innerWidth/2, window.innerHeight/2);
      stroke.x = center.x - w/2;
      stroke.y = center.y - h/2;
    }
    strokes.push(stroke);
    redoStack = [];
    saveToStorage();
    updateEmptyHint();
    updateStatus();
    scheduleRender();
    showToast && showToast('Изображение добавлено');
  };
  img.onerror = () => showToast && showToast('Ошибка загрузки');
  img.src = dataURL;
}

function handleFile(file, wx, wy) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => addImageFromDataURL(e.target.result, wx, wy);
  reader.readAsDataURL(file);
}

// Paste из буфера обмена
window.addEventListener('paste', (e) => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      handleFile(item.getAsFile());
      return;
    }
  }
});

// Drag & drop
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!e.dataTransfer.files.length) return;
  const rect = canvas.getBoundingClientRect();
  const wp = Viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  for (const file of e.dataTransfer.files) {
    handleFile(file, wp.x, wp.y);
  }
});

// ── Public API ───────────────────────────────────────────────────────────────

function undo() {
  if (!strokes.length) return;
  redoStack.push(strokes.pop());
  saveToStorage();
  updateEmptyHint();
  updateStatus();
  if (typeof deselectAll === 'function') deselectAll();
  scheduleRender();
}

function redo() {
  if (!redoStack.length) return;
  strokes.push(redoStack.pop());
  saveToStorage();
  updateEmptyHint();
  updateStatus();
  scheduleRender();
}

function clearBoard() {
  if (strokes.length === 0) return;
  if (typeof deselectAll === 'function') deselectAll();
  // Сохраняем все strokes в redoStack для одного клика по redo (восстановит последнюю)
  // Простая стратегия: помещаем все, redo вернёт по одной
  redoStack = strokes.slice().reverse();
  strokes = [];
  saveImmediate();
  updateEmptyHint();
  updateStatus();
  scheduleRender();
  if (typeof showToast === 'function') showToast('Очищено');
}

function setBrush(size, color) {
  if (size  !== undefined) brushSize  = size;
  if (color !== undefined) brushColor = color;
}
function setEraserSize(size) { eraserSize = size; }
function setShapeSize(size)  { shapeSize  = size; }
function setShapeFill(color) { shapeFill  = color; }

function updateStroke(idx, changes) {
  if (idx < 0 || idx >= strokes.length) return;
  Object.assign(strokes[idx], changes);
  saveToStorage();
  scheduleRender();
}

function setCursorForTool() {
  if (panActive)         { canvas.style.cursor = 'grabbing'; return; }
  if (spaceHeld)         { canvas.style.cursor = 'grab';     return; }
  if (tool === 'select')             canvas.style.cursor = 'default';
  else if (SHAPE_TOOLS.has(tool))    canvas.style.cursor = 'crosshair';
  else if (tool === 'shape-eraser')  canvas.style.cursor = 'pointer';
  else                               canvas.style.cursor = 'none';
}

function setTool(t) {
  prevTool = tool;
  tool = t;
  shapeStart = null;
  shapePreviewEnd = null;
  points = [];
  drawing = false;
  setCursorForTool();
  if (t !== 'select' && typeof deselectAll === 'function') deselectAll();
  eraserCursor = null;
  penCursor = null;
  scheduleRender();
}

function getTool() { return tool; }

function toggleGrid() {
  gridEnabled = !gridEnabled;
  localStorage.setItem('wb-grid', gridEnabled ? '1' : '0');
  document.getElementById('btn-grid')?.classList.toggle('active', gridEnabled);
  scheduleRender();
}

// ── Popups helper ────────────────────────────────────────────────────────────

function closeAllToolPopups() {
  document.getElementById('tool-popup')?.classList.remove('open');
  document.getElementById('shapes-popup')?.classList.remove('open');
}

// ── Init ─────────────────────────────────────────────────────────────────────

applyCanvasSize();
loadFromStorage();
updateEmptyHint();
updateStatus();
setCursorForTool();
scheduleRender();

// Mouse
canvas.addEventListener('mousedown', (e) => { canvas.focus(); startDraw(e); });
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup',   stopDraw);
canvas.addEventListener('mouseleave', () => {
  eraserCursor = null;
  penCursor = null;
  scheduleRender();
});

// Touch
canvas.addEventListener('touchstart', (e) => { canvas.focus(); startDraw(e); }, { passive: false });
canvas.addEventListener('touchmove',  onMove,  { passive: false });
canvas.addEventListener('touchend',   stopDraw);
canvas.addEventListener('touchcancel', stopDraw);

// Wheel zoom + pan
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const sp = getScreenPos(e);
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 50) {
    // zoom
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    Viewport.setZoomAt(Viewport.getZoom() * factor, sp.x, sp.y);
  } else {
    Viewport.pan(-e.deltaX, -e.deltaY);
  }
  updateStatus();
  scheduleRender();
}, { passive: false });

// Right click — выделить для floating toolbar
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const wp = getWorldPos(e);
  const idx = findShapeAt(wp.x, wp.y);
  if (idx >= 0 && typeof showFloatingToolbar === 'function') {
    selectedIdx = idx;
    showFloatingToolbar(strokes[idx], idx);
    scheduleRender();
  } else if (typeof deselectAll === 'function') {
    deselectAll();
  }
});

// Resize окна
window.addEventListener('resize', () => {
  applyCanvasSize();
  scheduleRender();
});

// Сохранять перед уходом со страницы
window.addEventListener('beforeunload', saveImmediate);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveImmediate();
});

// Space-pan
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !spaceHeld && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
    spaceHeld = true;
    setCursorForTool();
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spaceHeld = false;
    setCursorForTool();
  }
});

// Undo/Redo через клавиатуру (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
    e.preventDefault();
    redo();
  }
});

// Init grid button state
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-grid')?.classList.toggle('active', gridEnabled);
});
