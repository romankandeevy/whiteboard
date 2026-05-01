// ── WB Header Menu ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const moreBtn = document.getElementById('wb-header-more');
  const menu    = document.getElementById('wb-menu');

  // ── Auth state ──────────────────────────────────────────────────────────────
  let currentUser = null;
  if (typeof API !== 'undefined' && API.getToken()) {
    try {
      const res = await API.me();
      currentUser = res.user || res;
    } catch {
      API.clearToken();
    }
  }
  applyAuthState(currentUser);

  function strToColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue},60%,50%)`;
  }

  function applyAuthState(user) {
    document.querySelectorAll('.wb-auth-only').forEach(el => el.style.display = user ? '' : 'none');
    document.querySelectorAll('.wb-guest-only').forEach(el => el.style.display = user ? 'none' : '');

    const userBlock = document.getElementById('wb-menu-user');
    const userDivider = document.getElementById('wb-menu-user-divider');

    if (user) {
      if (userBlock) {
        userBlock.style.display = 'flex';
        const av = document.getElementById('wb-menu-avatar');
        const name = document.getElementById('wb-menu-username');
        const email = document.getElementById('wb-menu-email');
        if (av) {
          av.textContent = user.username ? user.username[0].toUpperCase() : '?';
          av.style.background = strToColor(user.username || '');
        }
        if (name) name.textContent = user.username || '';
        if (email) email.textContent = user.email || '';
      }
      if (userDivider) userDivider.style.display = '';
    } else {
      if (userBlock) userBlock.style.display = 'none';
      if (userDivider) userDivider.style.display = 'none';
    }
  }

  // ── Menu open/close ─────────────────────────────────────────────────────────
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

  // ── Menu actions ────────────────────────────────────────────────────────────
  document.getElementById('menu-login')?.addEventListener('click', () => {
    closeMenu();
    window.location.href = '/auth.html';
  });

  document.getElementById('menu-my-boards')?.addEventListener('click', () => {
    closeMenu();
    window.location.href = '/dashboard.html';
  });

  document.getElementById('menu-new-board')?.addEventListener('click', async () => {
    closeMenu();
    try {
      const board = await API.createBoard({ title: 'Untitled', data: '{"strokes":[]}' });
      window.location.href = '/?board=' + board.id;
    } catch (err) {
      console.error('Failed to create board', err);
    }
  });

  document.getElementById('menu-save')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('btn-export-png')?.click();
  });

  document.getElementById('menu-clear')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('btn-clear')?.click();
  });

  document.getElementById('menu-logout')?.addEventListener('click', () => {
    closeMenu();
    API.clearToken();
    window.location.href = '/auth.html';
  });

  document.getElementById('wb-header-export')?.addEventListener('click', () => {
    document.getElementById('btn-export-png')?.click();
  });

  // ── Board title auto-resize ─────────────────────────────────────────────────
  const titleInput = document.getElementById('wb-board-title');

  function resizeTitle() {
    const tmp = document.createElement('span');
    tmp.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + getComputedStyle(titleInput).font;
    tmp.textContent = titleInput.value || ' ';
    document.body.appendChild(tmp);
    titleInput.style.width = (tmp.offsetWidth + 16) + 'px';
    tmp.remove();
  }

  if (titleInput) {
    titleInput.addEventListener('input', resizeTitle);
    titleInput.addEventListener('click', () => titleInput.select());
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') titleInput.blur();
    });
    resizeTitle();
  }
});
