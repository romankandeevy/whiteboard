// ── Room / collaborative sync ─────────────────────────────────────────────────

const Room = (() => {
  const BACKEND = 'https://whiteboard-production-5ebf.up.railway.app';
  let socket = null;
  let activeCode = null;

  function isConnected() { return !!socket && socket.connected; }

  function connect(code, userName) {
    if (socket) socket.disconnect();

    socket = io(BACKEND, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join-room', { code, user: userName });
      activeCode = code;
      updateRoomUI(code);
    });

    socket.on('stroke', (stroke) => {
      if (typeof onRemoteStroke === 'function') onRemoteStroke(stroke);
    });

    socket.on('strokes-update', (strokes) => {
      if (typeof onRemoteStrokesUpdate === 'function') onRemoteStrokesUpdate(strokes);
    });

    socket.on('clear', () => {
      if (typeof onRemoteClear === 'function') onRemoteClear();
    });

    socket.on('room-users', (users) => {
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(users);
    });

    socket.on('disconnect', () => {
      if (activeCode) updateRoomUI(null);
    });
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    activeCode = null;
    updateRoomUI(null);
  }

  function sendStroke(stroke) {
    if (isConnected()) socket.emit('stroke', stroke);
  }

  function sendStrokesUpdate(strokes) {
    if (isConnected()) socket.emit('strokes-update', strokes);
  }

  function sendClear() {
    if (isConnected()) socket.emit('clear');
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

  return { connect, disconnect, sendStroke, sendStrokesUpdate, sendClear, isConnected, getCode: () => activeCode };
})();
