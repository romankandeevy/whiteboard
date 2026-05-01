// ── Hotkeys ──────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  // Modifier-aware shortcuts
  if (ctrl && k === 'c')      { copySelected(); return; }
  if (ctrl && k === 'v')      { e.preventDefault(); pasteClipboard(); return; }
  if (ctrl && k === 'd')      { e.preventDefault(); duplicateSelected(); return; }
  if (ctrl && k === 'a')      { e.preventDefault(); selectAll(); return; }
  if (ctrl && k === '0')      { e.preventDefault(); Viewport.reset(); updateStatus(); scheduleRender(); return; }
  if (ctrl && (k === '=' || k === '+')) {
    e.preventDefault();
    Viewport.setZoomAt(Viewport.getZoom() * 1.2, window.innerWidth/2, window.innerHeight/2);
    updateStatus(); scheduleRender();
    return;
  }
  if (ctrl && k === '-') {
    e.preventDefault();
    Viewport.setZoomAt(Viewport.getZoom() / 1.2, window.innerWidth/2, window.innerHeight/2);
    updateStatus(); scheduleRender();
    return;
  }

  // Skip remaining if any modifier
  if (ctrl || e.altKey) return;

  if (k === 'delete' || k === 'backspace') {
    if (selectedIndices.length > 0) { e.preventDefault(); deleteSelected(); }
    return;
  }

  if (k === 'escape') {
    deselectAll();
    document.getElementById('help-modal')?.classList.remove('open');
    document.getElementById('tool-popup')?.classList.remove('open');
    document.getElementById('shapes-popup')?.classList.remove('open');
    return;
  }

  // Tool shortcuts
  if (k === 'v') { document.getElementById('btn-select')?.click(); return; }
  if (k === 'p') { activatePenTool('pen'); return; }
  if (k === 'h') { activatePenTool('highlighter'); return; }
  if (k === 'e') { activatePenTool('eraser');  return; }
  if (k === 's') { document.getElementById('btn-shapes')?.click(); return; }
  if (k === 'i') { document.getElementById('btn-image')?.click(); return; }
  if (k === 'g') { e.preventDefault(); toggleGrid(); return; }
  if (k === '?') { document.getElementById('btn-help')?.click(); return; }

  // Brush size
  if (k === '[' || k === ']') {
    const popSize = document.getElementById('pop-size');
    if (!popSize) return;
    const cur = Number(popSize.value);
    const next = k === ']' ? Math.min(40, cur + 2) : Math.max(1, cur - 2);
    popSize.value = next;
    popSize.dispatchEvent(new Event('input'));
  }
});
