// ── WB Logo Menu ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('wb-logo');
  const menu = document.getElementById('wb-menu');

  logo.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    logo.classList.toggle('open', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== logo) {
      menu.classList.remove('open');
      logo.classList.remove('open');
    }
  });

  document.getElementById('menu-new').addEventListener('click', () => {
    menu.classList.remove('open');
    logo.classList.remove('open');
    if (typeof strokes !== 'undefined' && strokes.length > 0) {
      if (!confirm('Очистить доску и начать новую?')) return;
    }
    if (typeof clearBoard === 'function') clearBoard();
  });

  document.getElementById('menu-save').addEventListener('click', () => {
    menu.classList.remove('open');
    logo.classList.remove('open');
    const btn = document.getElementById('btn-export-png');
    if (btn) btn.click();
  });

  document.getElementById('wb-header-export')?.addEventListener('click', () => {
    document.getElementById('btn-export-png')?.click();
  });

  document.getElementById('wb-header-more')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    logo.classList.toggle('open', isOpen);
  });

  document.getElementById('menu-clear').addEventListener('click', () => {
    menu.classList.remove('open');
    logo.classList.remove('open');
    const btn = document.getElementById('btn-clear');
    if (btn) btn.click();
  });
});
