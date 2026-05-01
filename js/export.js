// ── Export PNG ───────────────────────────────────────────────────────────────

function exportPNG() {
  if (strokes.length === 0) { showToast('Нечего экспортировать'); return; }

  // Bounding box всех strokes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    const b = getStrokeBounds(s);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  const padding = 20;
  minX -= padding; minY -= padding; maxX += padding; maxY += padding;

  const w = Math.max(1, Math.ceil(maxX - minX));
  const h = Math.max(1, Math.ceil(maxY - minY));

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width  = w * dpr;
  exportCanvas.height = h * dpr;
  const ec = exportCanvas.getContext('2d');

  // Белый фон (всегда — для экспорта)
  ec.fillStyle = '#ffffff';
  ec.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Сдвигаем чтобы (minX, minY) → (0, 0)
  ec.setTransform(dpr, 0, 0, dpr, -minX * dpr, -minY * dpr);

  for (const s of strokes) {
    drawAnyStroke(ec, s);
  }

  exportCanvas.toBlob((blob) => {
    if (!blob) { showToast('Ошибка экспорта'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Сохранено как PNG');
  }, 'image/png');
}

document.getElementById('btn-export-png')?.addEventListener('click', exportPNG);
