/* De deur: wat een gesloten app laat zien aan wie er (nog) niet in mag.

   Hier stond per app een zin en verder niets: "Alleen met de Lifestyle
   Pass." Geen knop, geen uitleg, geen weg vooruit -- veertien apps die als
   leeg scherm aanvoelen terwijl er een hele app achter zit. Dit is de ene
   poort voor al die deuren.

   Hij verzint niets. Wat er achter de deur ligt komt uit de app-gids die
   elke pagina al heeft (/api/gids/app: "wat" en drie "doe"-punten), dus de
   poort blijft vanzelf kloppen als de app verandert. Zonder gids toont hij
   alleen de reden en de weg -- nooit een verzonnen belofte.

   En de belangrijkste regel, die hier in code staat en niet alleen in een
   merkdocument: de Lifestyle- en Business Pass gaan uitsluitend op
   uitnodiging of na goedkeuring door een mens. Deze poort zegt dus wat er
   is en waar het besluit valt; hij belooft nooit toegang, en er zit geen
   knop op die zelf iets verleent.

   Gebruik (in de 403-tak van een app):
     RTGDeur.toon(document.getElementById('main'), { soort: 'pas', pas: 'Lifestyle' });
     RTGDeur.toon(el, { soort: 'gezin' });
     RTGDeur.toon(el, { soort: 'personeel', naar: '/apps/personeel.html' }); */
(function () {
  'use strict';
  if (window.RTGDeur) return;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Per soort deur: waarom hij dicht is, en waar het besluit valt. Bewust
     geen knop die toegang geeft -- bij een pas beslist een mens, en dat
     staat er ook zo. */
  function weg(o) {
    if (o.soort === 'gezin') {
      return 'Deze app hoort bij een gezin in de RTFoundation. ' +
        '<a href="/apps/foundation/index.html">Maak een gezin aan of sluit je aan bij het jouwe</a>.';
    }
    if (o.soort === 'personeel') {
      return 'Deze app werkt met uw personeelsinlog. ' +
        '<a href="' + esc(o.naar || '/apps/personeel.html') + '">Ga naar de personeels-app</a> en meld u daar aan; ' +
        'uw werkgever geeft u de code.';
    }
    var pas = o.pas === 'Business' ? 'Business Pass' : 'Lifestyle Pass';
    return 'De ' + pas + ' gaat uitsluitend op uitnodiging of na goedkeuring, en dat besluit nemen mensen bij RTG -- ' +
      'niet deze app en niet Rahul. ' +
      '<a href="/apps/rtg.html">Lees de toegangsregels in Het Huis</a>. ' +
      'Hebt u de pas al? Dan opent deze app zodra hij op uw account staat.';
  }

  function laadDeurPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var presentatie = document.createElement('link');
    presentatie.id = 'rtgDsRuntimeCss';
    presentatie.rel = 'stylesheet';
    presentatie.href = pad;
    document.head.appendChild(presentatie);
  }

  function teken(doel, o, gids) {
    var titel = (gids && gids.wat ? String(gids.wat).split(':')[0] : '') ||
      (document.title || 'Deze app').split(/[-·|]/)[0].trim();
    var h = '<section class="rtgdeur ds-accountdeur ds-accountdeur--poort ds-lezer ds-lezer--pagina" aria-label="Deze app is nog niet voor u geopend">' +
      '<h2>' + esc(titel) + '</h2>';
    if (gids && gids.wat) h += '<div class="rtgdeur-wat ds-meta">' + esc(gids.wat) + '</div>';
    if (gids && gids.doe && gids.doe.length) {
      h += '<p class="rtgdeur-kop ds-label">Wat u hier straks doet</p><ul>' +
        gids.doe.slice(0, 5).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
    }
    h += '<div class="rtgdeur-weg ds-sectie">' + weg(o) + '</div></section>';
    doel.innerHTML = h;
  }

  /* De app-gids is sinds het eigenaarsbesluit van 19 oktober alleen met een
     geldige RTG-sessie beschikbaar. De deur wordt juist vroeg en zelfstandig
     geladen, vaak voordat basis.js klaar is. Neem daarom uitsluitend een al
     bestaande sessie mee; de server blijft beslissen of die sessie deze gids
     mag lezen. Zonder sessie blijft de eerlijke lokale deur zichtbaar. */
  function gidsSessie() {
    var t = '', g = {};
    try {
      t = localStorage.getItem('rtg_member_token') || localStorage.getItem('rtg_sup_token') ||
        localStorage.getItem('rtg_office_token') || localStorage.getItem('rtg_pda_token') || '';
      g = JSON.parse(localStorage.getItem('rtf_sessie') || 'null') || {};
    } catch (e) { /* privévenster: zonder sessie */ }
    var kop = { 'Content-Type': 'application/json' };
    if (t) kop.Authorization = 'Bearer ' + t;
    return { kop: kop, code: g.code, token: g.token };
  }

  function toon(doel, opties) {
    if (!doel) return;
    var o = opties || {};
    // Ook oudere hosts laden dezelfde bestaande accountdeur/lezer-componenten.
    laadDeurPresentatie('/ds/rtg-ds.css');
    // eerst zonder gids tekenen: de weg naar binnen is het belangrijkste en
    // mag niet op een netwerkverzoek wachten
    teken(doel, o, null);
    try {
      var gs = gidsSessie();
      fetch('/api/gids/app', { method: 'POST', headers: gs.kop,
        body: JSON.stringify({ pad: location.pathname, code: gs.code, token: gs.token }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.gids) teken(doel, o, d.gids); })
        .catch(function () { /* zonder gids blijft de poort staan zoals hij is */ });
    } catch (e) { /* idem */ }
  }

  window.RTGDeur = { toon: toon };
})();
