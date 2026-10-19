/* RTG Design System: de schil van een gemigreerd scherm.

   Een gemigreerd scherm laadt /ds/rtg-ds.css en dit script, en verder niets
   van de oude gedeelde laag. shared/basis.js laadt bij elke start zelf
   rtg-heritage.css, rtg-editorial-v4.css en via randen.js drie generaties
   Edge-CSS (samen ruim 150 kB en zo'n 700x !important); daarnaast kan geen
   gelaagd systeem bestaan (ONTWERPSYSTEEM.md par. 5). Deze schil levert het
   deel van die laag dat een scherm nodig heeft, zonder stijl in te spuiten:

   1. de Edge (/ds/edge.js voor de vorm en het wisselen, /ds/edge-modi.js
      voor wat er in een modus staat);
   2. offline: de service worker van het leden-OS en een melding;
   3. taal: shared/i18n.js, die de DOM vertaalt en `dir` zet. Dat script
      spuit voor zijn eigen taalkiezer nog een <style>; dat staat als open
      punt in TRAVELOS-MIGRATIE.md;
   4. het lid: alleen het token dat al in localStorage staat. Deze schil
      beslist nergens over toegang; de server doet dat bij elke aanroep. */
(function (w, d) {
  'use strict';
  if (w.RTGDs) return;
  d.documentElement.setAttribute('data-ds', '1');

  var ICONEN = {
    home: '<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9 20v-6h6v6"/>',
    werelden: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5Z"/>',
    acties: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    menu: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    stuur: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    sluit: '<path d="M6 6l12 12M18 6 6 18"/>',
    bericht: '<path d="M4 5h16v11H9l-5 4z"/>',
    pijl: '<path d="m9 18 6-6-6-6"/>'
  };
  /* De lippen: het gezicht van Rahul. Altijd met een zichtbaar of
     voorleesbaar woord erbij; het teken alleen is geen uitleg. */
  var LIPPEN = '<path d="M2 11c3-4.6 6.4-6.4 8.6-4.9.8.5 1.1.5 1.4.5s.6 0 1.4-.5C15.6 4.6 19 6.4 22 11c-1.6.4-3.1.9-4.4 1.1C15.4 16.7 13.6 18 12 18s-3.4-1.3-5.6-5.9C5.1 11.9 3.6 11.4 2 11Zm4.6 1.2c2 .4 3.6.6 5.4.6s3.4-.2 5.4-.6c-1.9 3.4-3.6 4.6-5.4 4.6s-3.5-1.2-5.4-4.6Z" fill-rule="evenodd"/>';

  function svg(pad) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + pad + '</svg>';
  }
  function el(tag, klasse, attrs) {
    var e = d.createElement(tag);
    if (klasse) e.className = klasse;
    for (var k in attrs || {}) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function token() {
    try { return w.localStorage.getItem('rtg_member_token'); } catch (e) { return null; }
  }
  function laad(src) {
    var s = d.createElement('script');
    s.src = src; s.async = false;
    (d.head || d.documentElement).appendChild(s);
  }

  /* offline */
  function meld(t) {
    var m = el('p', 'ds-verborgen', { role: 'status' });
    m.textContent = t;
    d.body.appendChild(m);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 4000);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    w.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  w.addEventListener('offline', function () { meld('Geen verbinding; de app werkt door waar dat kan.'); });
  w.addEventListener('online', function () { meld('De verbinding is terug.'); });

  /* RTGDs.hulp is voor de twee Edge-scripts hieronder, niet voor schermen. */
  w.RTGDs = { versie: 1, token: token, hulp: { ICONEN: ICONEN, LIPPEN: LIPPEN, svg: svg, el: el } };

  laad('/ds/edge.js');
  laad('/ds/edge-modi.js');
  if (!w.RTGi18n) laad('/shared/i18n.js');
}(window, document));
