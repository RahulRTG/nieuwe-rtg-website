/* De persoonlijke voorzijde van Dynamic Layer. Zij ordent bestaande modules
   en deuren, maar bewaart profiel, berichten en instellingen bij hun bron. */
(function (w, d) {
  'use strict';
  function el(tag, cls, tekst) {
    var n = d.createElement(tag); if (cls) n.className = cls;
    if (tekst != null) n.textContent = tekst; return n;
  }
  function glyf(naam) {
    var g = w.RTGGlyf && w.RTGGlyf.svg(naam);
    if (g) { g.classList.add('rtg-ss-quick-glyph'); g.setAttribute('aria-hidden', 'true'); }
    return g;
  }
  function deur(tag, naam, glyfnaam, href) {
    var n = el(tag, 'rtg-ss-quick-door');
    if (tag === 'a') n.href = href; else n.type = 'button';
    var g = glyf(glyfnaam); if (g) n.appendChild(g);
    n.appendChild(el('span', '', naam)); n.appendChild(el('i', '', '›'));
    return n;
  }
  function bouw(shell) {
    if (!shell || shell.dataset.personalSurface === 'true') return;
    var root = shell.closest('#rtgCommand'), scroll = shell.querySelector('.rtg-ss-scroll');
    var modules = shell.querySelector('.rtg-ss-modules'), acties = shell.querySelector('.rtg-ss-actions');
    if (!root || !scroll || !modules || !acties) return;
    shell.dataset.personalSurface = 'true';

    var intro = el('header', 'rtg-ss-personal-intro');
    intro.appendChild(el('p', '', 'VIER WERELDEN · ÉÉN RUIMTE'));
    intro.appendChild(el('h2', '', 'Uw ruimte'));
    scroll.insertBefore(intro, modules);

    var aanpassen = acties.querySelector('[data-ss-action="edit"]');
    var rahul = acties.querySelector('[data-ss-action="ask"]');
    if (rahul) { rahul.textContent = 'Open Rahul'; rahul.classList.add('rtg-ss-open-rahul'); acties.appendChild(rahul); }
    if (aanpassen) { aanpassen.textContent = 'Pas mijn ruimte aan'; aanpassen.classList.add('rtg-ss-personalize'); acties.appendChild(aanpassen); }
    scroll.appendChild(acties);

    var quick = el('nav', 'rtg-ss-quick'); quick.setAttribute('aria-label', 'Snelle instellingen');
    quick.appendChild(deur('a', 'Profiel', 'rtf-volw', '/apps/ik.html#persoonlijk'));
    quick.appendChild(deur('a', 'Privacy', 'slot', '/apps/juridisch/privacy.html'));
    quick.appendChild(deur('a', 'Meldingen', 'meldingen', '/apps/comm.html'));
    var weergave = deur('button', 'Weergave', 'thema'); weergave.dataset.personalAction = 'appearance'; quick.appendChild(weergave);
    scroll.appendChild(quick);
    var view = el('section', 'rtg-ss-view-menu'); view.id = 'rtgPersonalView'; view.hidden = true;
    view.appendChild(el('h3', '', 'Ruimteweergave'));
    ['panel', 'workspace', 'focus'].forEach(function (a) {
      var b = shell.querySelector('[data-ss-action="' + a + '"]'); if (b) view.appendChild(b);
    });
    var pagina = root.querySelector('[data-cmd="settings"]'); if (pagina) view.appendChild(pagina);
    var uitvoer = deur('button', 'Gegevens meenemen', 'logboek'); uitvoer.dataset.personalAction = 'export'; view.appendChild(uitvoer);
    weergave.setAttribute('aria-controls', view.id); weergave.setAttribute('aria-expanded', 'false'); scroll.appendChild(view);

    acties.addEventListener('click', function (ev) {
      var knop = ev.target.closest('.rtg-ss-open-rahul'); if (!knop) return;
      ev.preventDefault(); ev.stopPropagation();
      if (root.__rtgSecondScreen) root.__rtgSecondScreen.setState('peek');
      var open = root.querySelector('.cmd-console [data-open="ai"]'); if (open) open.click();
    }, true);
    weergave.addEventListener('click', function () {
      view.hidden = !view.hidden; weergave.setAttribute('aria-expanded', String(!view.hidden));
      if (!view.hidden) view.querySelector('button').focus();
    });
    uitvoer.addEventListener('click', function () {
      var open = shell.querySelector('.rtg-ss-header .rtguitvoer-knop'); if (open) open.click();
    });
  }
  function scan() {
    var shell = d.querySelector('#rtgCommand .rtg-ss-shell'); bouw(shell);
    var root = shell && shell.closest('#rtgCommand');
    var profiel = shell && shell.querySelector('.rtg-ss-profile-edit');
    if (profiel) {
      if (profiel.getAttribute('href') !== '/apps/ik.html#persoonlijk') profiel.href = '/apps/ik.html#persoonlijk';
      if (profiel.textContent !== 'Aanvullen') profiel.textContent = 'Aanvullen';
    }
    d.body.toggleAttribute('data-rtg-personal-surface', !!(root && root.dataset.rtgSecondScreen !== 'peek'));
  }
  var kijker = new MutationObserver(scan);
  function start() { kijker.observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-rtg-second-screen'] }); scan(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}(window, document));
