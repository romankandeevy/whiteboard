// ── Viewport (zoom + pan) ──────────────────────────────────────────────────

const Viewport = (() => {
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dpr  = window.devicePixelRatio || 1;

  const ZOOM_MIN = 0.1;
  const ZOOM_MAX = 5;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('wb-viewport'));
      if (saved) {
        zoom = saved.zoom || 1;
        panX = saved.panX || 0;
        panY = saved.panY || 0;
      }
    } catch {}
  }

  function save() {
    localStorage.setItem('wb-viewport', JSON.stringify({ zoom, panX, panY }));
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
  }

  function worldToScreen(wx, wy) {
    return { x: wx * zoom + panX, y: wy * zoom + panY };
  }

  function applyTransform(ctx) {
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr);
  }

  function resetTransform(ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setZoomAt(newZoom, screenX, screenY) {
    newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    // Keep the world point under cursor fixed
    const wx = (screenX - panX) / zoom;
    const wy = (screenY - panY) / zoom;
    zoom = newZoom;
    panX = screenX - wx * zoom;
    panY = screenY - wy * zoom;
    save();
  }

  function pan(dx, dy) {
    panX += dx;
    panY += dy;
    save();
  }

  function reset() {
    zoom = 1; panX = 0; panY = 0;
    save();
  }

  function getZoom()  { return zoom; }
  function getPanX()  { return panX; }
  function getPanY()  { return panY; }
  function getDPR()   { return dpr; }
  function setDPR(v)  { dpr = v; }

  load();

  return {
    screenToWorld, worldToScreen, applyTransform, resetTransform,
    setZoomAt, pan, reset, save,
    getZoom, getPanX, getPanY, getDPR, setDPR,
    ZOOM_MIN, ZOOM_MAX,
  };
})();
