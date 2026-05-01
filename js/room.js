// ── Room / collaborative sync (Pusher) ───────────────────────────────────────

const Room = (() => {
  const BACKEND  = 'https://whiteboard-production-5ebf.up.railway.app';
  const PUSHER_KEY     = '23028e580390fb730357';
  const PUSHER_CLUSTER = 'eu';

  let pusher    = null;
  let channel   = null;
  let socketId  = null;
  let activeCode = null;
  let myName    = 'Гость';
  let myColor   = '#888';

  function strToColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return `hsl(${Math.abs(h) % 360},70%,50%)`;
  }

  function isConnected() { return !!channel; }

  function connect(code, userName) {
    disconnect();
    activeCode = code.toUpperCase();
    myName     = userName || 'Гость';
    myColor    = strToColor(myName + activeCode);

    pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      channelAuthorization: {
        endpoint: BACKEND + '/api/pusher/auth',
        transport: 'ajax',
        params: { username: myName, color: myColor },
      },
    });

    pusher.connection.bind('connected', () => {
      socketId = pusher.connection.socket_id;
    });

    channel = pusher.subscribe('presence-room-' + activeCode);

    channel.bind('pusher:subscription_succeeded', (members) => {
      updateRoomUI(activeCode);
      const names = [];
      members.each(m => names.push(m.info.name));
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(names);
    });

    channel.bind('pusher:member_added', () => {
      const names = [];
      channel.members.each(m => names.push(m.info.name));
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(names);
    });

    channel.bind('pusher:member_removed', (member) => {
      removeRemoteCursor(member.id);
      const names = [];
      channel.members.each(m => names.push(m.info.name));
      if (typeof renderOnlineUsers === 'function') renderOnlineUsers(names);
    });

    channel.bind('stroke', (stroke) => {
      if (typeof onRemoteStroke === 'function') onRemoteStroke(stroke);
    });

    channel.bind('delete-strokes', ({ ids }) => {
      if (typeof onRemoteDeleteStrokes === 'function') onRemoteDeleteStrokes(ids);
    });

    channel.bind('clear', () => {
      if (typeof onRemoteClear === 'function') onRemoteClear();
    });

    channel.bind('cursor', ({ id, x, y, name, color }) => {
      const sp = (typeof Viewport !== 'undefined') ? Viewport.worldToScreen(x, y) : { x, y };
      renderRemoteCursor(id, sp.x, sp.y, name, color);
    });

    channel.bind('cursor-leave', ({ id }) => {
      removeRemoteCursor(id);
    });
  }

  function disconnect() {
    if (pusher) { pusher.disconnect(); pusher = null; }
    channel   = null;
    socketId  = null;
    activeCode = null;
    updateRoomUI(null);
    clearRemoteCursors();
  }

  async function trigger(event, data) {
    if (!channel) return;
    try {
      await fetch(BACKEND + '/api/room/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'presence-room-' + activeCode,
          event,
          data,
          socketId: pusher?.connection?.socket_id,
        }),
      });
    } catch (e) { console.error(e); }
  }

  function sendStroke(stroke) { trigger('stroke', stroke); }
  function sendDeleteStrokes(ids) { trigger('delete-strokes', { ids }); }
  function sendClear() { trigger('clear', {}); }

  let cursorThrottle = 0;
  function sendCursor(wx, wy) {
    const now = Date.now();
    if (now - cursorThrottle < 50) return;
    cursorThrottle = now;
    trigger('cursor', { id: pusher?.connection?.socket_id, x: wx, y: wy, name: myName, color: myColor });
  }

  function sendCursorLeave() {
    trigger('cursor-leave', { id: pusher?.connection?.socket_id });
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
