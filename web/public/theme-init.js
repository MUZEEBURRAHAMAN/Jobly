// Runs before first paint (render-blocking on purpose) so the page never flashes the wrong theme.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('jobly-theme'); } catch (e) {}
  var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
