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

  var css = '.rtgdeur{max-width:34rem;margin:2rem auto;padding:1.6rem 1.5rem;text-align:left;' +
      'border:1px solid var(--line,var(--lijn,#2A2724));border-radius:0;' +
      'background:var(--paneel,rgba(255,255,255,.02));}' +
    '.rtgdeur h2{font-family:var(--serif),Georgia,serif;font-size:1.35rem;font-weight:500;margin:0 0 .4rem;}' +
    '.rtgdeur .rtgdeur-wat{color:var(--muted,var(--zacht,#8A8680));line-height:1.6;font-size:.92rem;margin-bottom:1.1rem;}' +
    '.rtgdeur .rtgdeur-kop{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;' +
      'color:var(--muted,var(--zacht,#8A8680));margin:0 0 .5rem;}' +
    '.rtgdeur ul{list-style:none;margin:0 0 1.2rem;padding:0;}' +
    '.rtgdeur li{padding:.45rem 0 .45rem .95rem;position:relative;font-size:.92rem;line-height:1.5;' +
      'border-bottom:1px solid var(--line,var(--lijn,#2A2724));}' +
    '.rtgdeur li:last-child{border-bottom:none;}' +
    '.rtgdeur li::before{content:"";position:absolute;left:0;top:1.05rem;width:4px;height:4px;border-radius:50%;' +
      'background:var(--gold,var(--goud,#857007));}' +
    '.rtgdeur .rtgdeur-weg{border-top:1px solid var(--line,var(--lijn,#2A2724));padding-top:1rem;' +
      'font-size:.88rem;line-height:1.65;color:var(--muted,var(--zacht,#8A8680));}' +
    '.rtgdeur .rtgdeur-weg a{color:var(--txt,#F7F5F1);}';

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

  function teken(doel, o, gids) {
    var titel = (gids && gids.wat ? String(gids.wat).split(':')[0] : '') ||
      (document.title || 'Deze app').split(/[-·|]/)[0].trim();
    var h = '<section class="rtgdeur" aria-label="Deze app is nog niet voor u geopend">' +
      '<h2>' + esc(titel) + '</h2>';
    if (gids && gids.wat) h += '<div class="rtgdeur-wat">' + esc(gids.wat) + '</div>';
    if (gids && gids.doe && gids.doe.length) {
      h += '<p class="rtgdeur-kop">Wat u hier straks doet</p><ul>' +
        gids.doe.slice(0, 5).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>';
    }
    h += '<div class="rtgdeur-weg">' + weg(o) + '</div></section>';
    doel.innerHTML = h;
  }

  function toon(doel, opties) {
    if (!doel) return;
    var o = opties || {};
    if (!document.getElementById('rtgdeur-stijl')) {
      var st = document.createElement('style');
      st.id = 'rtgdeur-stijl'; st.textContent = css;
      document.head.appendChild(st);
    }
    // eerst zonder gids tekenen: de weg naar binnen is het belangrijkste en
    // mag niet op een netwerkverzoek wachten
    teken(doel, o, null);
    try {
      fetch('/api/gids/app', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pad: location.pathname }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.gids) teken(doel, o, d.gids); })
        .catch(function () { /* zonder gids blijft de poort staan zoals hij is */ });
    } catch (e) { /* idem */ }
  }

  window.RTGDeur = { toon: toon };
})();
