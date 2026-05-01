// ── Toolbar wiring ───────────────────────────────────────────────────────────

const ALL_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#ffffff',
  '#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00',
  '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#c9daf8',
  '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a4c2f4',
  '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#6d9eeb',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#1155cc',
  '#660000', '#783f04', '#7f6000', '#274e13', '#1c4587',
];

function buildColorGrid(containerId, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;
  ALL_COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch' + (isLight(color) ? ' light' : '');
    btn.title = color;
    btn.dataset.color = color;
    btn.style.background = color;
    btn.addEventListener('click', () => onSelect(color, el));
    el.appendChild(btn);
  });
}

function syncColorGrid(containerEl, hex) {
  if (!containerEl) return;
  containerEl.querySelectorAll('.color-swatch').forEach(b => {
    b.classList.toggle('active', b.dataset.color === hex);
  });
}

// ── Пресеты кисти ────────────────────────────────────────────────────────────
const DEFAULT_PRESETS = [
  { color: '#000000', size: 2  },
  { color: '#e53935', size: 6  },
  { color: '#1a73e8', size: 12 },
];

function loadPresets() {
  try {
    const saved = localStorage.getItem('wb-presets');
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_PRESETS.map(p => ({ ...p }));
}

function savePresets() {
  localStorage.setItem('wb-presets', JSON.stringify(presets));
}

const presets = loadPresets();
let activeSlot = Number(localStorage.getItem('wb-active-slot') || 0);

// ── Undo / Redo / Clear ──────────────────────────────────────────────────────
document.getElementById('btn-undo').addEventListener('click', () => undo());
document.getElementById('btn-redo').addEventListener('click', () => redo());
document.getElementById('btn-clear').addEventListener('click', () => {
  if (strokes.length === 0) return;
  if (!confirm('Очистить доску?')) return;
  clearBoard();
});

// ── Элементы тулбара ─────────────────────────────────────────────────────────
const btnSelect       = document.getElementById('btn-select');
const btnPen          = document.getElementById('btn-pen');
const btnShapes       = document.getElementById('btn-shapes');
const btnShapesOrigHTML = document.getElementById('btn-shapes').innerHTML;
const toolPopup       = document.getElementById('tool-popup');
const shapesPopup     = document.getElementById('shapes-popup');
const popPen          = document.getElementById('pop-pen');
const popHighlighter  = document.getElementById('pop-highlighter');
const popEraser       = document.getElementById('pop-eraser');

function setPopupOrigin(popup, anchorBtn) {
  const btnRect = anchorBtn.getBoundingClientRect();
  const btnCenterY = btnRect.top + btnRect.height / 2;
  popup.style.top = btnCenterY + 'px';
}

function closeAllPopups() {
  toolPopup.classList.remove('open');
  shapesPopup.classList.remove('open');
}

function deactivateAllToolBtns() {
  btnSelect.classList.remove('active');
  btnPen.classList.remove('active', 'eraser-active', 'hl-active');
  btnShapes.classList.remove('active');
  btnShapes.innerHTML = btnShapesOrigHTML;
  popPen.classList.remove('active');
  popHighlighter?.classList.remove('active');
  popEraser.classList.remove('active');
  document.querySelectorAll('.shapes-grid .popup-tool-btn').forEach(b => b.classList.remove('active'));
}

btnSelect.addEventListener('click', () => {
  closeAllPopups();
  deactivateAllToolBtns();
  setTool('select');
  btnSelect.classList.add('active');
});

btnPen.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = !toolPopup.classList.contains('open');
  closeAllPopups();
  if (willOpen) {
    setPopupOrigin(toolPopup, btnPen);
    toolPopup.classList.add('open');
    const t = (getTool() === 'eraser' || getTool() === 'highlighter') ? getTool() : 'pen';
    activatePenTool(t);
  } else {
    activatePenTool('pen');
  }
});

btnShapes.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = !shapesPopup.classList.contains('open');
  closeAllPopups();
  if (willOpen) {
    setPopupOrigin(shapesPopup, btnShapes);
    shapesPopup.classList.add('open');
  }
});

document.addEventListener('click', (e) => {
  if (!toolPopup.contains(e.target) && e.target !== btnPen && !btnPen.contains(e.target) &&
      !shapesPopup.contains(e.target) && e.target !== btnShapes && !btnShapes.contains(e.target)) {
    closeAllPopups();
  }
});

// ── Кисть / Маркер / Ластик ──────────────────────────────────────────────────
function activatePenTool(t) {
  setTool(t);
  deactivateAllToolBtns();
  if (t !== 'eraser') selectSlot(activeSlot);
  popPen.classList.toggle('active', t === 'pen');
  popHighlighter?.classList.toggle('active', t === 'highlighter');
  popEraser.classList.toggle('active', t === 'eraser');
  toolPopup.classList.toggle('eraser-mode', t === 'eraser');
  btnPen.classList.toggle('eraser-active', t === 'eraser');
  btnPen.classList.toggle('hl-active', t === 'highlighter');
  btnPen.classList.add('active');
}

popPen.addEventListener('click',          () => activatePenTool('pen'));
popHighlighter?.addEventListener('click', () => activatePenTool('highlighter'));
popEraser.addEventListener('click',       () => activatePenTool('eraser'));

// ── Слоты пресетов кисти ─────────────────────────────────────────────────────
const slotBtns = document.querySelectorAll('.brush-preset-slot');

function renderSlots() {
  slotBtns.forEach((btn, i) => {
    btn.style.background = presets[i].color;
    btn.classList.toggle('active', i === activeSlot);
    const size = presets[i].size;
    btn.dataset.dot = size <= 3 ? 'sm' : size <= 8 ? 'md' : size <= 16 ? 'lg' : 'xl';
  });
}

function selectSlot(i) {
  activeSlot = i;
  localStorage.setItem('wb-active-slot', i);
  renderSlots();
  const p = presets[i];
  setBrush(p.size, p.color);
  document.getElementById('pop-size').value = p.size;
  document.getElementById('size-value').textContent = p.size;
  syncSizeDots(p.size);
  syncColorGrid(document.getElementById('color-grid'), p.color);
  document.getElementById('hex-input').value = p.color;
  document.getElementById('custom-color').value = p.color;
}

slotBtns.forEach((btn, i) => btn.addEventListener('click', () => selectSlot(i)));

// ── Размер кисти ─────────────────────────────────────────────────────────────
const popSize = document.getElementById('pop-size');
const sizeValue = document.getElementById('size-value');

function applyBrushSize(size) {
  presets[activeSlot].size = size;
  setBrush(size);
  setEraserSize(size);
  sizeValue.textContent = size;
  renderSlots();
  savePresets();
}

function syncSizeDots(size) {
  document.querySelectorAll('.size-dot-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.size) === size);
  });
}

popSize.addEventListener('input', () => {
  const size = Number(popSize.value);
  applyBrushSize(size);
  syncSizeDots(size);
});

document.querySelectorAll('.size-dot-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = Number(btn.dataset.size);
    applyBrushSize(size);
    popSize.value = size;
    syncSizeDots(size);
  });
});

// ── Цвет кисти ───────────────────────────────────────────────────────────────
buildColorGrid('color-grid', (hex, el) => {
  applyBrushColor(hex);
  syncColorGrid(el, hex);
});

function applyBrushColor(hex) {
  presets[activeSlot].color = hex;
  setBrush(undefined, hex);
  renderSlots();
  document.getElementById('hex-input').value = hex;
  document.getElementById('custom-color').value = hex;
  savePresets();
}

// Custom color picker
const customColor = document.getElementById('custom-color');
const hexInput    = document.getElementById('hex-input');

customColor.addEventListener('input', (e) => {
  applyBrushColor(e.target.value);
  syncColorGrid(document.getElementById('color-grid'), e.target.value);
});

hexInput.addEventListener('change', (e) => {
  let v = e.target.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    applyBrushColor(v.toLowerCase());
    syncColorGrid(document.getElementById('color-grid'), v.toLowerCase());
  } else {
    e.target.value = presets[activeSlot].color;
  }
});

// ── Фигуры ───────────────────────────────────────────────────────────────────
const SHAPE_TOOL_IDS = ['shape-eraser', 'rect', 'ellipse', 'triangle', 'diamond', 'star', 'line', 'arrow'];
document.getElementById('pop-square').addEventListener('click', () => {
  activateShapeTool('rect');
  const svg = document.getElementById('pop-square').querySelector('svg');
  if (svg) btnShapes.innerHTML = svg.outerHTML;
});

SHAPE_TOOL_IDS.forEach(name => {
  const btn = document.getElementById(`pop-${name}`);
  if (btn) btn.addEventListener('click', () => activateShapeTool(name));
});

function activateShapeTool(name) {
  setTool(name);
  deactivateAllToolBtns();
  btnShapes.classList.add('active');
  const target = document.getElementById(`pop-${name}`);
  if (target) {
    target.classList.add('active');
    const svg = target.querySelector('svg');
    if (svg) btnShapes.innerHTML = svg.outerHTML;
  }
  if (name !== 'shape-eraser') setBrush(undefined, shapeCurrentColor);
}

document.querySelectorAll('.shape-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const size = Number(btn.dataset.size);
    setShapeSize(size);
    document.querySelectorAll('.shape-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

let shapeCurrentColor = '#000000';
let shapeFillEnabled  = false;

buildColorGrid('shape-color-grid', (hex, el) => {
  shapeCurrentColor = hex;
  setBrush(undefined, hex);
  syncColorGrid(el, hex);
  if (shapeFillEnabled) setShapeFill(hex);
});

document.getElementById('shape-fill-toggle').addEventListener('change', (e) => {
  shapeFillEnabled = e.target.checked;
  setShapeFill(shapeFillEnabled ? shapeCurrentColor : null);
});

// ── Изображение ─────────────────────────────────────────────────────────────
document.getElementById('btn-image')?.addEventListener('click', () => {
  document.getElementById('image-file-input').click();
});

document.getElementById('image-file-input')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
  e.target.value = ''; // reset чтобы можно было выбрать то же изображение снова
});

// ── Сетка / Тема / Help / Zoom ──────────────────────────────────────────────
document.getElementById('btn-grid').addEventListener('click', toggleGrid);

document.getElementById('btn-help').addEventListener('click', () => {
  document.getElementById('help-modal').classList.add('open');
});
document.getElementById('help-close').addEventListener('click', () => {
  document.getElementById('help-modal').classList.remove('open');
});
document.getElementById('help-modal').addEventListener('click', (e) => {
  if (e.target.id === 'help-modal') e.currentTarget.classList.remove('open');
});

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  Viewport.setZoomAt(Viewport.getZoom() * 1.2, window.innerWidth / 2, window.innerHeight / 2);
  updateStatus(); scheduleRender();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  Viewport.setZoomAt(Viewport.getZoom() / 1.2, window.innerWidth / 2, window.innerHeight / 2);
  updateStatus(); scheduleRender();
});
document.getElementById('btn-zoom-reset').addEventListener('click', () => {
  Viewport.reset(); updateStatus(); scheduleRender();
});

// ── Init ─────────────────────────────────────────────────────────────────────
renderSlots();
selectSlot(activeSlot);
btnSelect.click();
syncColorGrid(document.getElementById('shape-color-grid'), '#000000');
