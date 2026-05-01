// ── WB Header Menu ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const moreBtn = document.getElementById('wb-header-more');
  const menu    = document.getElementById('wb-menu');

  function closeMenu() {
    menu.classList.remove('open');
    moreBtn?.classList.remove('open');
  }

  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    moreBtn.classList.toggle('open', isOpen);
    if (isOpen) {
      const rect = moreBtn.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top  = (rect.bottom + 4) + 'px';
    }
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== moreBtn) closeMenu();
  });

  document.getElementById('menu-new').addEventListener('click', () => {
    closeMenu();
    if (typeof strokes !== 'undefined' && strokes.length > 0) {
      if (!confirm('Очистить доску и начать новую?')) return;
    }
    if (typeof clearBoard === 'function') clearBoard();
  });

  document.getElementById('menu-save').addEventListener('click', () => {
    closeMenu();
    document.getElementById('btn-export-png')?.click();
  });

  document.getElementById('menu-clear').addEventListener('click', () => {
    closeMenu();
    document.getElementById('btn-clear')?.click();
  });

  document.getElementById('wb-header-export')?.addEventListener('click', () => {
    document.getElementById('btn-export-png')?.click();
  });

  // Название доски — inline редактирование по клику
  const titleInput = document.getElementById('wb-board-title');
  titleInput?.addEventListener('click', () => titleInput.select());
  titleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') titleInput.blur();
  });
});
