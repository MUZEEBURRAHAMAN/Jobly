(function () {
  var cfg = window.JOBLY_SITE || {};
  document.querySelectorAll("[data-install]").forEach(function (a) {
    if (cfg.storeUrl) { a.href = cfg.storeUrl; a.rel = "noopener"; }
    else { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); a.textContent = "Coming soon to Chrome"; }
  });
  document.querySelectorAll("[data-contact]").forEach(function (el) {
    if (cfg.contactEmail) { el.innerHTML = ""; var a = document.createElement("a"); a.href = "mailto:" + cfg.contactEmail; a.textContent = cfg.contactEmail; el.appendChild(a); }
    else { el.textContent = "the support contact shown on the Jobly page in the Chrome Web Store"; }
  });
  var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
})();
