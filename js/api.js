// ── API client ────────────────────────────────────────────────────────────────

const API = (() => {
  const BASE = '/api';

  function getToken() { return localStorage.getItem('wb-token'); }
  function saveToken(t) { localStorage.setItem('wb-token', t); }
  function clearToken() { localStorage.removeItem('wb-token'); }

  function headers() {
    const t = getToken();
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  }

  async function req(method, path, body) {
    const r = await fetch(BASE + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  }

  return {
    getToken, saveToken, clearToken,
    login:       (email, password)    => req('POST', '/auth/login',    { email, password }),
    register:    (name, email, password) => req('POST', '/auth/register', { name, email, password }),
    me:          ()                   => req('GET',  '/auth/me'),
    getBoards:   ()                   => req('GET',  '/boards'),
    createBoard: (title)              => req('POST', '/boards',         { title }),
    getBoard:    (id)                 => req('GET',  `/boards/${id}`),
    saveBoard:   (id, data)           => req('PUT',  `/boards/${id}`,   data),
    deleteBoard: (id)                 => req('DELETE', `/boards/${id}`),
  };
})();
