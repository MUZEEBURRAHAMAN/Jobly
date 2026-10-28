// Set the theme before first paint, so a dark-mode user never sees a white flash. (A file, not inline, for the CSP.)
try {
  var t = localStorage.getItem('studio-theme') || 'system';
  document.documentElement.dataset.theme = t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
} catch (e) {}
