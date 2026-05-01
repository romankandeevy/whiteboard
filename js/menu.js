// ── WB Header Menu ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const logoBtn  = document.getElementById('wb-logo');
  const moreBtn  = document.getElementById('wb-header-more');
  const logoMenu = document.getElementById('wb-logo-menu');
  const moreMenu = document.getElementById('wb-more-menu');

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
    return `hsl(${Math.abs(h) % 360},60%,50%)`;
  }

  function applyAuthState(user) {
    document.querySelectorAll('.wb-auth-only').forEach(el => el.classList.toggle('wb-hidden', !user));
    document.querySelectorAll('.wb-guest-only').forEach(el => el.classList.toggle('wb-hidden', !!user));

    const userBlock   = document.getElementById('wb-menu-user');
    const userDivider = document.getElementById('wb-menu-user-divider');

    if (user) {
      userBlock?.classList.remove('wb-hidden');
      userDivider?.classList.remove('wb-hidden');
      const av    = document.getElementById('wb-menu-avatar');
      const name  = document.getElementById('wb-menu-username');
      const email = document.getElementById('wb-menu-email');
      if (av)    { av.textContent = user.username ? user.username[0].toUpperCase() : '?'; av.style.background = strToColor(user.username || ''); }
      if (name)  name.textContent  = user.username || '';
      if (email) email.textContent = user.email || '';
    } else {
      userBlock?.classList.add('wb-hidden');
      userDivider?.classList.add('wb-hidden');
    }
  }

  // ── Open/close helpers ──────────────────────────────────────────────────────
  function openMenu(menu, anchor) {
    closeAll();
    menu.classList.add('open');
    anchor.classList.add('open');
    const rect = anchor.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top  = (rect.bottom + 4) + 'px';
  }

  function closeAll() {
    [logoMenu, moreMenu].forEach(m => m.classList.remove('open'));
    [logoBtn, moreBtn].forEach(b => b?.classList.remove('open'));
  }

  logoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    logoMenu.classList.contains('open') ? closeAll() : openMenu(logoMenu, logoBtn);
  });

  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.classList.contains('open') ? closeAll() : openMenu(moreMenu, moreBtn);
  });

  document.addEventListener('click', (e) => {
    if (!logoMenu.contains(e.target) && !moreMenu.contains(e.target)) closeAll();
  });

  // ── Logo menu actions ───────────────────────────────────────────────────────
  document.getElementById('menu-login')?.addEventListener('click', () => {
    closeAll();
    window.location.href = '/auth.html';
  });

  document.getElementById('menu-my-boards')?.addEventListener('click', () => {
    closeAll();
    window.location.href = '/dashboard.html';
  });

  document.getElementById('menu-new-board')?.addEventListener('click', async () => {
    closeAll();
    try {
      const board = await API.createBoard({ title: 'Untitled', data: '{"strokes":[]}' });
      window.location.href = '/?board=' + board.id;
    } catch (err) {
      console.error('Failed to create board', err);
    }
  });

  document.getElementById('menu-logout')?.addEventListener('click', () => {
    closeAll();
    API.clearToken();
    window.location.href = '/auth.html';
  });

  // ── Room ────────────────────────────────────────────────────────────────────
  const roomToggleBtn  = document.getElementById('menu-room-toggle');
  const roomToggleLbl  = document.getElementById('menu-room-toggle-label');
  const roomJoinBtn    = document.getElementById('menu-room-join');
  const roomDialog     = document.getElementById('wb-room-dialog');
  let roomOpen = false;

  // "Открыть для сети" / "Закрыть сеть" — только для владельца доски
  roomToggleBtn?.addEventListener('click', async () => {
    closeAll();
    if (roomOpen) {
      Room.disconnect();
      roomOpen = false;
      if (roomToggleLbl) roomToggleLbl.textContent = 'Открыть для сети';
      return;
    }
    const boardId = typeof getCurrentBoardId === 'function' ? getCurrentBoardId() : null;
    if (!boardId || !API.getToken()) return;
    try {
      const res = await fetch(`https://whiteboard-production-5ebf.up.railway.app/api/boards/${boardId}/room/open`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API.getToken()}` }
      });
      const data = await res.json();
      if (data.code) {
        const user = currentUser?.name || 'Гость';
        Room.connect(data.code, user);
        roomOpen = true;
        if (roomToggleLbl) roomToggleLbl.textContent = 'Закрыть сеть';
      }
    } catch (e) { console.error(e); }
  });

  // "Подключиться к комнате" — всегда показывает диалог ввода кода
  roomJoinBtn?.addEventListener('click', () => {
    closeAll();
    if (!roomDialog) return;
    document.getElementById('wb-room-code-input').value = '';
    roomDialog.classList.add('open');
    document.getElementById('wb-room-code-input')?.focus();
  });

  document.getElementById('wb-room-cancel-btn')?.addEventListener('click', () => {
    roomDialog?.classList.remove('open');
  });

  document.getElementById('wb-room-join-btn')?.addEventListener('click', () => {
    const code = document.getElementById('wb-room-code-input')?.value.trim().toUpperCase();
    if (!code || code.length !== 6) return;
    roomDialog?.classList.remove('open');
    const user = currentUser?.name || 'Гость';
    Room.connect(code, user);
  });

  roomDialog?.addEventListener('click', (e) => {
    if (e.target === roomDialog) roomDialog.classList.remove('open');
  });

  document.getElementById('wb-room-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('wb-room-join-btn')?.click();
    if (e.key === 'Escape') roomDialog?.classList.remove('open');
  });

  // ── More menu actions ───────────────────────────────────────────────────────
  document.getElementById('menu-save')?.addEventListener('click', () => {
    closeAll();
    document.getElementById('btn-export-png')?.click();
  });

  document.getElementById('menu-clear')?.addEventListener('click', () => {
    closeAll();
    document.getElementById('btn-clear')?.click();
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
