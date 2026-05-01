// ── Online users UI ───────────────────────────────────────────────────────────

const USER_COLORS = [
  '#e53935','#d81b60','#8e24aa','#3949ab',
  '#1e88e5','#00897b','#43a047','#fb8c00',
];

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return USER_COLORS[h % USER_COLORS.length];
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// Заглушка — текущий пользователь (потом заменим на реальный auth)
const ME = { id: 'me', name: 'You' };

// Список онлайн-пользователей (заглушка, потом придёт с сервера)
let onlineUsers = [
  { id: 'me',   name: 'You' },
  { id: 'u2',   name: 'Alex' },
  { id: 'u3',   name: 'Maria' },
];

function renderUsers() {
  const container = document.getElementById('wb-users');
  if (!container) return;
  container.innerHTML = '';

  // Сначала все кроме меня, потом я сверху
  const sorted = [...onlineUsers.filter(u => u.id !== ME.id), { ...onlineUsers.find(u => u.id === ME.id) }].filter(Boolean);

  sorted.forEach(user => {
    const isMe = user.id === ME.id;
    const el = document.createElement('div');
    el.className = 'wb-avatar' + (isMe ? ' wb-avatar-you' : '');
    el.style.background = hashColor(user.name);
    el.title = isMe ? 'Вы' : user.name;
    el.innerHTML = `
      ${initials(user.name)}
      <span class="wb-avatar-tooltip">${isMe ? 'Вы' : user.name}</span>
    `;
    container.appendChild(el);
  });
}

document.addEventListener('DOMContentLoaded', renderUsers);
