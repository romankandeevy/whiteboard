function applyShapeStyle(context, stroke) {
  context.strokeStyle = stroke.color || '#000';
  context.lineWidth   = stroke.size  || 2;
  context.lineCap     = 'round';
  context.lineJoin    = 'round';
}

function normalizeRect(stroke) {
  let { x, y, w, h } = stroke;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  return { x, y, w, h };
}

function applyFill(context, stroke) {
  if (stroke.fill) {
    context.fillStyle = stroke.fill;
    context.fill();
  }
}

// ── Прямоугольник ─────────────────────────────────────────────────────────
function drawRect(context, stroke) {
  const { x, y, w, h } = normalizeRect(stroke);
  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  context.rect(x, y, w, h);
  applyFill(context, stroke);
  context.stroke();
  context.restore();
}

// ── Эллипс ────────────────────────────────────────────────────────────────
function drawEllipse(context, stroke) {
  const { x, y, w, h } = normalizeRect(stroke);
  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  applyFill(context, stroke);
  context.stroke();
  context.restore();
}

// ── Треугольник ───────────────────────────────────────────────────────────
function drawTriangle(context, stroke) {
  const { x, y, w, h } = normalizeRect(stroke);
  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  context.moveTo(x + w / 2, y);
  context.lineTo(x + w, y + h);
  context.lineTo(x, y + h);
  context.closePath();
  applyFill(context, stroke);
  context.stroke();
  context.restore();
}

// ── Ромб ──────────────────────────────────────────────────────────────────
function drawDiamond(context, stroke) {
  const { x, y, w, h } = normalizeRect(stroke);
  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  context.moveTo(x + w / 2, y);
  context.lineTo(x + w, y + h / 2);
  context.lineTo(x + w / 2, y + h);
  context.lineTo(x, y + h / 2);
  context.closePath();
  applyFill(context, stroke);
  context.stroke();
  context.restore();
}

// ── Звезда ────────────────────────────────────────────────────────────────
function drawStar(context, stroke) {
  const { x, y, w, h } = normalizeRect(stroke);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.4;
  const points = 5;

  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    i === 0 ? context.moveTo(px, py) : context.lineTo(px, py);
  }
  context.closePath();
  applyFill(context, stroke);
  context.stroke();
  context.restore();
}

// ── Прямая линия ──────────────────────────────────────────────────────────
function drawLine(context, stroke) {
  context.save();
  applyShapeStyle(context, stroke);
  context.beginPath();
  context.moveTo(stroke.x, stroke.y);
  context.lineTo(stroke.x2, stroke.y2);
  context.stroke();
  context.restore();
}

// ── Стрелка ───────────────────────────────────────────────────────────────
function drawArrow(context, stroke) {
  const { x, y, x2, y2 } = stroke;
  const angle = Math.atan2(y2 - y, x2 - x);
  const headLen = Math.max(12, (stroke.size || 2) * 4);

  context.save();
  applyShapeStyle(context, stroke);

  // Линия
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x2, y2);
  context.stroke();

  // Наконечник
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6)
  );
  context.moveTo(x2, y2);
  context.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6)
  );
  context.stroke();
  context.restore();
}

// ── Image (импорт) ────────────────────────────────────────────────────────
const _imageCache = new Map();

function getCachedImage(src) {
  if (_imageCache.has(src)) return _imageCache.get(src);
  const img = new Image();
  img.onload = () => { if (typeof scheduleRender === 'function') scheduleRender(); };
  img.src = src;
  _imageCache.set(src, img);
  return img;
}

function invalidateImageCache(src) {
  _imageCache.delete(src);
}

function drawImageStroke(context, stroke) {
  const img = getCachedImage(stroke.src);
  const { x, y, w, h } = normalizeRect(stroke);
  if (img.complete && img.naturalWidth > 0) {
    context.save();
    context.drawImage(img, x, y, w, h);
    context.restore();
  } else {
    // placeholder
    context.save();
    context.fillStyle = '#f0f0f0';
    context.fillRect(x, y, w, h);
    context.strokeStyle = '#ccc';
    context.strokeRect(x, y, w, h);
    context.restore();
  }
}

function wrapText(context, text, maxWidth) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (context.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
      // Если слово не влезает — рвём по символам
      while (line.length > 1 && context.measureText(line).width > maxWidth) {
        let cut = line.length - 1;
        while (cut > 1 && context.measureText(line.slice(0, cut)).width > maxWidth) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

// ── Диспетчер ─────────────────────────────────────────────────────────────
function drawShape(context, stroke) {
  switch (stroke.type) {
    case 'rect':     return drawRect(context, stroke);
    case 'ellipse':  return drawEllipse(context, stroke);
    case 'triangle': return drawTriangle(context, stroke);
    case 'diamond':  return drawDiamond(context, stroke);
    case 'star':     return drawStar(context, stroke);
    case 'line':     return drawLine(context, stroke);
    case 'arrow':    return drawArrow(context, stroke);
    case 'image':    return drawImageStroke(context, stroke);
  }
}
