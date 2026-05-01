// ── Room / collaborative sync ─────────────────────────────────────────────────

const Room = (() => {
  const BACKEND = 'https://whiteboard-production-5ebf.up.railway.app';
  let socket = null;
  let activeCode = null;
  let myColor = null;

  function strToColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360},70%,50%)`;
  }

  function isConnected() { return !!socket && socket.connected; }

  function connect(code, userName) {
    if (socket) socket.disconnect();
    clearRemoteCursors();

    myColor = strToColor(userName + code);
    socket = io(BACKEND, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      activeCode = code.toUpperCase();
      socket.emit('join-room', { code: activeCode, name: userName, color: myColor });
      updateRoomUI(activeCode);
    });

    socket.on('stroke', (stroke) => {
      if (typeof onRemoteStroke === 'function') onRemoteStroke(stroke);
    });

    socket.on('delete-strokes', (ids) => {
      if (typeof onRemoteDeleteStrokes === 'function') onRemoteDeleteStrokes(ids);
    });

    socket.on('clear', () => {
      if (typeof onRemoteClear === 'function') onRemoteClear();
    });

    socket.on('room-users', (users) => {
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(users.map(u => u.name));
    });

    socket.on('cursor', ({ id, x, y }) => {
      const u = roomUsers.get(id);
      const sp = (typeof Viewport !== 'undefined') ? Viewport.worldToScreen(x, y) : { x, y };
      renderRemoteCursor(id, sp.x, sp.y, u?.name, u?.color);
    });

    socket.on('cursor-leave', ({ id }) => {
      removeRemoteCursor(id);
    });

    socket.on('room-users', (users) => {
      roomUsers.clear();
      users.forEach(u => roomUsers.set(u.id, u));
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(users.map(u => u.name));
    });

    socket.on('disconnect', () => {
      if (activeCode) updateRoomUI(null);
      clearRemoteCursors();
    });
  }

  // track remote users for cursor labels
  const roomUsers = new Map();

  function disconnect() {
    socket?.disconnect();
    socket = null;
    activeCode = null;
    updateRoomUI(null);
    clearRemoteCursors();
  }

  function sendStroke(stroke) {
    if (isConnected()) socket.emit('stroke', stroke);
  }

  function sendDeleteStrokes(ids) {
    if (isConnected()) socket.emit('delete-strokes', ids);
  }

  function sendClear() {
    if (isConnected()) socket.emit('clear');
  }

  function sendCursor(x, y) {
    if (isConnected()) socket.emit('cursor', { x, y });
  }

  function sendCursorLeave() {
    if (isConnected()) socket.emit('cursor-leave');
  }

  // ── Remote cursors ──────────────────────────────────────────────────────────
  const cursors = new Map();

  function renderRemoteCursor(id, x, y, name, color) {
    let el = cursors.get(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'wb-remote-cursor';
      el.innerHTML = `<svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M0 0L0 16L4.5 12L7 18L9 17L6.5 11L12 11Z" fill="currentColor"/></svg><span class="wb-remote-cursor-label"></span>`;
      document.body.appendChild(el);
      cursors.set(id, el);
    }
    el.style.color = color || '#888';
    el.style.left  = x + 'px';
    el.style.top   = y + 'px';
    el.querySelector('.wb-remote-cursor-label').textContent = name || 'Гость';
    el.querySelector('.wb-remote-cursor-label').style.background = color || '#888';
  }

  function removeRemoteCursor(id) {
    const el = cursors.get(id);
    if (el) { el.remove(); cursors.delete(id); }
  }

  function clearRemoteCursors() {
    cursors.forEach(el => el.remove());
    cursors.clear();
  }

  function updateRoomUI(code) {
    const badge = document.getElementById('wb-room-badge');
    if (!badge) return;
    if (code) {
      badge.textContent = '#' + code;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  return { connect, disconnect, sendStroke, sendDeleteStrokes, sendClear, sendCursor, sendCursorLeave, isConnected, getCode: () => activeCode };
})();
