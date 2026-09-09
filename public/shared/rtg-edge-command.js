/* De ene mobiele menuknop verbindt Edge met de bestaande RTG Command-lade. */
(function (w) {
  'use strict';
  function koppel(d, venster) {
    var e = venster.RTGEdge && venster.RTGEdge.active;
    var menu = e && e.root.querySelector('.rtg-edge-menu');
    if (!menu || menu.getAttribute('data-rtg-command-brug') === 'true') return false;
    var oud = menu.onclick, label = menu.getAttribute('aria-label'), controls = menu.getAttribute('aria-controls');
    var media = venster.matchMedia('(max-width:999px)'), root = null, deur = null, rootKijker = null;
    var index = e.root.querySelector('.rtg-edge-index');
    if (index && !index.id) index.id = 'rtgEdgeFunctions';

    function bankOpen() {
      return !!(root && (root.classList.contains('bank-open') ||
        (root.dataset.rtgSecondScreen && root.dataset.rtgSecondScreen !== 'peek')));
    }
    function herstelDeur() {
      if (!deur) return;
      deur.removeAttribute('data-rtg-edge-owned');
      deur.removeAttribute('aria-hidden');
      deur.removeAttribute('tabindex');
    }
    function vindDeur() {
      var nieuw = d.getElementById('rtgCommand');
      var nieuweDeur = nieuw && nieuw.querySelector('.cmd-lade');
      if (nieuw === root && nieuweDeur === deur) return !!deur;
      herstelDeur();
      if (rootKijker) rootKijker.disconnect();
      root = nieuw; deur = nieuweDeur; rootKijker = null;
      if (root && venster.MutationObserver) {
        rootKijker = new venster.MutationObserver(sync);
        rootKijker.observe(root, { attributes: true, attributeFilter: ['class', 'data-rtg-second-screen'] });
      }
      return !!deur;
    }
    function indexOpen() { return !!(index && index.getAttribute('aria-hidden') === 'false'); }
    function slimMenu() { return !!(index && index.querySelector('.rtg-edge-faces')); }
    function sync() {
      vindDeur();
      if (!media.matches || !deur) {
        herstelDeur();
        menu.removeAttribute('data-rtg-command-owner');
        menu.setAttribute('aria-label', slimMenu() ? (indexOpen() ? 'Menu sluiten' : 'Menu openen') : label || 'Randen en alle functies');
        if (slimMenu()) menu.setAttribute('aria-controls', index.id);
        else if (controls == null) menu.removeAttribute('aria-controls'); else menu.setAttribute('aria-controls', controls);
        menu.setAttribute('aria-expanded', String(indexOpen()));
        return;
      }
      menu.setAttribute('data-rtg-command-owner', 'true');
      var bank = root.querySelector('.cmd-bank');
      if (bank && !bank.id) bank.id = 'rtgCommandBank';
      deur.setAttribute('data-rtg-edge-owned', 'true');
      deur.setAttribute('aria-hidden', 'true'); deur.tabIndex = -1;
      if (slimMenu()) {
        if (indexOpen() && bankOpen()) deur.click();
        menu.setAttribute('aria-label', indexOpen() ? 'Menu sluiten' : 'Menu openen');
        menu.setAttribute('aria-controls', index.id);
        menu.setAttribute('aria-expanded', String(indexOpen()));
        if (!bankOpen() && d.activeElement === deur) menu.focus();
        return;
      }
      menu.setAttribute('aria-label', 'Werelden en systeem');
      if (bank) menu.setAttribute('aria-controls', bank.id + (index ? ' ' + index.id : ''));
      if (indexOpen() && bankOpen()) deur.click();
      menu.setAttribute('aria-expanded', String(indexOpen() || bankOpen()));
      if (!bankOpen() && d.activeElement === deur) menu.focus();
    }
    function sluitAndereLagen() {
      ['.rtg-edge-ai', '.rtg-edge-state', '.rtg-edge-2-context-button'].forEach(function (q) {
        var knop = e.root.querySelector(q + '[aria-expanded="true"]'); if (knop) knop.click();
      });
    }
    menu.onclick = function (ev) {
      if (slimMenu() || !media.matches || !vindDeur()) { if (oud) oud.call(menu, ev); sync(); return; }
      ev.preventDefault();
      if (indexOpen()) { if (oud) oud.call(menu, ev); sync(); return; }
      sluitAndereLagen(); deur.click(); sync();
    };
    e.root.addEventListener('click', function (ev) {
      if (media.matches && !menu.contains(ev.target) && vindDeur() && bankOpen()) deur.click();
    }, true);
    if (venster.MutationObserver) {
      var boom = new venster.MutationObserver(sync);
      boom.observe(d.body, { childList: true, subtree: true });
      if (index) new venster.MutationObserver(sync).observe(index, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
    if (media.addEventListener) media.addEventListener('change', sync); else if (media.addListener) media.addListener(sync);
    menu.setAttribute('data-rtg-command-brug', 'true'); sync(); return true;
  }
  w.RTGEdgeCommand = { koppel: koppel };
}(window));
