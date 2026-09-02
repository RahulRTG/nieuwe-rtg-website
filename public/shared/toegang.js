/* RTG ACCESS EXPERIENCE: een uniforme, pre-authenticatie systeemlaag voor
   inloggen, aanmelden, herstel, uitnodigingen en operationele toegang. */
(function (w, d) {
  'use strict';
  if (w.RTGAccessExperience) return;
  var gepland = false, selector = '[data-inlogkleur],[data-rtg-toegang],#gate,#login,#inlog,#vLogin,#vPoort,#dlgLogin,#lrInlog';

  function soort(root) {
    var eigen = root.getAttribute('data-rtg-toegang');
    if (eigen && eigen !== '1') return eigen;
    if (root.querySelector('input[autocomplete="new-password"]') || /registr|uitnodiging/i.test(d.title + ' ' + w.location.pathname)) return 'registratie';
    if (root.hasAttribute('data-inlogkleur')) return 'identiteit';
    return 'operationeel';
  }
  function hoofdactie(root) {
    var acties = root.querySelectorAll('button,input[type="submit"],input[type="button"],a[data-hoofdactie],[role="button"][data-hoofdactie]');
    for (var i = 0; i < acties.length; i++) {
      var actie = acties[i], tekst = String(actie.textContent || actie.value || '').trim();
      actie.setAttribute('data-rtg-toegang-actie', '1');
      if (actie.hasAttribute('data-hoofdactie') || actie.type === 'submit' || /^(inloggen|aanmelden|meld aan|veilig openen|naar binnen|verder|word lid|registratie indienen|gezin veilig starten)/i.test(tekst))
        actie.setAttribute('data-rtg-toegang-hoofd', '1');
    }
  }
  function velden(root) {
    var lijst = root.querySelectorAll('input,select,textarea');
    for (var i = 0; i < lijst.length; i++) {
      var veld = lijst[i]; veld.setAttribute('data-rtg-toegang-veld', '1');
      if (!veld.getAttribute('aria-label') && !(veld.labels && veld.labels.length) && veld.placeholder) veld.setAttribute('aria-label', veld.placeholder);
    }
  }
  function signatuur(root) {
    if (root.querySelector(':scope > .rtg-toegang-signatuur')) return;
    var balk = d.createElement('div'); balk.className = 'rtg-toegang-signatuur'; balk.setAttribute('aria-label', 'RTG beveiligde toegang');
    var id = d.createElement('span'); id.className = 'rtg-toegang-id'; id.textContent = 'RTG ID'; balk.appendChild(id);
    var status = d.createElement('span'); status.className = 'rtg-toegang-status'; status.textContent = 'Beveiligde toegang'; balk.appendChild(status);
    root.insertBefore(balk, root.firstChild);
  }
  function geschikt(root) {
    if (!root || root === d.body || root.nodeType !== 1 || root.closest('[data-rtg-toegang-uit]')) return false;
    return root.hasAttribute('data-inlogkleur') || root.hasAttribute('data-rtg-toegang') ||
      !!root.querySelector('input[type="password"],input[autocomplete="username"],input[autocomplete="one-time-code"]') ||
      /poort|login|inlog|gate/i.test(root.id || '');
  }
  function verrijk(root) {
    if (!geschikt(root)) return false;
    var type = soort(root); root.setAttribute('data-rtg-toegang', '1'); root.setAttribute('data-rtg-toegang-soort', type);
    signatuur(root); velden(root); hoofdactie(root); return true;
  }
  function scan() {
    gepland = false; var roots = d.querySelectorAll(selector);
    for (var i = 0; i < roots.length; i++) verrijk(roots[i]);
    var expliciet = d.body && d.body.getAttribute('data-rtg-toegang');
    if (expliciet) { var main = d.querySelector('main'); if (main) { main.setAttribute('data-rtg-toegang', expliciet); verrijk(main); } }
  }
  function plan() { if (gepland) return; gepland = true; (w.requestAnimationFrame || w.setTimeout)(scan); }
  function start() {
    if (!d.querySelector('link[href^="/shared/toegang.css"]')) {
      var css = d.createElement('link'); css.rel = 'stylesheet'; css.href = '/shared/toegang.css'; (d.head || d.documentElement).appendChild(css);
    }
    scan(); if (w.MutationObserver) new MutationObserver(plan).observe(d.body, { childList: true, subtree: true });
  }
  w.RTGAccessExperience = { scan: scan, enhance: verrijk };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);
