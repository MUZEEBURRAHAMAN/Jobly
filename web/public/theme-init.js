// Runs before first paint (render-blocking on purpose) so the page never flashes the wrong theme.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('jobly-theme'); } catch (e) {}
  var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.documentElement.classList.add('js'); // scroll animations only start hidden when scripts run

  // Home page: start the hero screenshot for the theme that is showing now, at the right size, before the page body is parsed.
  // (sizes says 1080px, a hair under the real 1118px, so a normal-density desktop gets the 1080w file and retina gets 1440w. Both hero images are lazy, so the other theme's copy never downloads.)
  if (location.pathname === '/' || location.pathname === '/index.html') {
    var n = 'dashboard-jobs-' + (dark ? 'dark' : 'light');
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/webp';
    link.setAttribute('fetchpriority', 'high');
    link.setAttribute('imagesrcset', '/img/' + n + '-720.webp 720w, /img/' + n + '-1080.webp 1080w, /img/' + n + '.webp 1440w');
    link.setAttribute('imagesizes', '(max-width: 1200px) calc(100vw - 32px), 1080px');
    document.head.appendChild(link);
  }
})();
