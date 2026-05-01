// ── Theme switcher ───────────────────────────────────────────────────────────

(function() {
  const KEY = 'wb-theme';
  let theme = localStorage.getItem(KEY);
  if (!theme) {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    theme = t;
    localStorage.setItem(KEY, t);
    if (typeof scheduleRender === 'function') scheduleRender();
  }

  apply(theme);

  document.getElementById('btn-theme')?.addEventListener('click', () => {
    apply(theme === 'dark' ? 'light' : 'dark');
  });
})();
