/* Magnaat FROM ZERO (V1) in de Magnaat-app: Vandaag, met de agenda en de Edge.
   De andere schermen tekent ./magnaat-leven-schermen.js.

   Dit scherm REKENT NIETS. Elk bedrag, elke dag, elke vrije minuut en elke
   mogelijke handeling komt van de server (/api/member/magnaat/leven/*), en een
   weigering komt met haar reden terug. De handeling die nu het meest zin heeft
   is de hoofdactie van de Edge: EEN vaste knop waarvan alleen tekst en doel
   wisselen, want de Edge neemt hem over en een nieuwe knop per beurt bleef
   daar staan. De klok rekent op de server; dit scherm vraagt pas opnieuw als
   er volgens de server een nieuwe dag is. */
(function () {
  'use strict';
  var TOKEN = localStorage.getItem('rtg_member_token');
  if (!TOKEN) return;
  var q = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: 'EUR' });
  var euro = function (c) { return fmt.format((Number(c) || 0) / 100); };
  var duur = function (m) { var u = Math.floor(m / 60), r = m % 60; return (u ? u + 'u' : '') + (r ? (u ? ' ' : '') + r + 'm' : u ? '' : '0m'); };
  var LEVEN = null, KEUZE = null, KLOK = null;

  /* Loopt er een gedeelde stad (./magnaat-leven-stad.js), dan gaat alles naar de stad, en komt het leven terug naast de stand van de stad. */
  var STAD = function () { return !!(window.RTGMagnaatStad && window.RTGMagnaatStad.loopt()); };
  function vraag(pad, body) {
    var stad = STAD();
    return fetch('/api/member/magnaat/' + (stad ? 'stad/' : 'leven/') + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Magnaat kon dit niet doen.');
        if (!stad) return d;
        window.RTGMagnaatStad.zet(d.stad);
        return d.leven || vraag('staat');
      }); });
  }
  function meldFout(t) { var e = q('#vnFout'); e.textContent = t; e.hidden = !t; }
  var herstel = document.createElement('button'); herstel.id = 'vnHerstel'; herstel.type = 'button';
  herstel.textContent = 'Opnieuw proberen'; herstel.hidden = true; herstel.className = 'btn';
  q('#vnFout').after(herstel); herstel.addEventListener('click', laad);
  var eigenBlokkades = new Set();
  function nietBeschikbaar() {
    LEVEN = null; clearTimeout(KLOK); herstel.hidden = false;
    document.querySelectorAll('[data-vn-actie],[data-vn-doe],[data-vn-schrap],[data-vn-opnieuw],#vnTempo').forEach(function(b){ if (!b.disabled) { eigenBlokkades.add(b); b.disabled=true; } });
    meldFout('De levensgegevens zijn niet beschikbaar. Probeer opnieuw; de uitkomst is niet bevestigd.');
  }
  function laad() { return vraag('staat').then(teken).catch(nietBeschikbaar); }
  /* Elke handeling draagt een eigen sleutel. Valt de verbinding weg, dan gaat
     dezelfde handeling met dezelfde sleutel nog een keer: de server voert hem
     hooguit een keer uit, dus je sluit geen dag twee keer af (V5). */
  function doe(body) {
    if (!LEVEN) return;
    meldFout('');
    body.verzoek = window.RTGId('vn');
    var klaar = function (s) { KEUZE = null; teken(s); };
    return vraag('actie', body).then(klaar).catch(function (e) {
      if (!(e instanceof TypeError)) { meldFout(e.message); return; }
      meldFout('De verbinding viel weg. Nog een keer proberen…');
      return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return vraag('actie', body); })
        .then(function (s) { meldFout(''); klaar(s); }).catch(function (e2) { meldFout(e2 instanceof TypeError ? 'Geen verbinding. Je handeling is niet verstuurd; probeer het zo nog eens.' : e2.message); });
    });
  }

  function klok(s) {
    clearTimeout(KLOK);
    if (STAD()) { q('#vnKlok').textContent = 'Week ' + s.week + ' · nog ' + duur(s.vrijVandaag) + ' vrij vandaag · de dag gaat door als iedereen hem heeft afgesloten'; return; }
    KLOK = setTimeout(laad, Math.max(1000, s.volgendeDagOver + 500));
    var t = q('#vnTempo');
    if (t && !t.options.length) t.innerHTML = s.tempo.standen.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
    if (t) t.value = s.tempo.stand;
    var k = s.kalender;
    q('#vnKlok').textContent = (k ? k.maand + ', ' + k.seizoen + ', ' + k.weer + ' · ' : '') + 'Week ' + s.week + ' · nog ' + duur(s.vrijVandaag) + ' vrij vandaag · de dag loopt vanzelf af over ' +
      Math.ceil(s.volgendeDagOver / 60000) + ' min, of sluit hem zelf af';
  }

  /* De velden van een handeling bouwt en leest ./magnaat-leven-invoer.js. */
  var INVOER = window.RTGMagnaatLevenInvoer;
  var invoerVoor = function (a) { return INVOER.html(a, { esc: esc, duur: duur, vrij: LEVEN.vrijVandaag }); };
  var lichaam = function (a) { return INVOER.lichaam(a, q); };
  var vrijeInvoer = function (a) { return INVOER.zonderVelden(a); };

  function tekenAgenda(s) {
    q('#vnAgenda').innerHTML = s.vandaag.agenda.map(function (d, n) {
      return '<div class="vn-dag' + (n === 0 ? ' vn-vandaag' : '') + '"><b>' + esc(d.naam) + '</b><small>dag ' + d.dag +
        (d.dienst ? ' · dienst' : '') + (d.loondag ? ' · loon' : '') + '</small>' +
        d.items.map(function (x) {
          return '<span class="vn-item vn-w-' + esc(x.wat) + '">' + (x.door ? esc(x.door) + ': ' : '') + esc(x.naam) + (x.klant ? ' · ' + esc(x.klant) : '') + ' <em>' + duur(x.minuten) + '</em>' +
            (x.wat !== 'gesprek' ? '<button type="button" class="vn-schrap" data-vn-schrap="' + d.dag + ':' + x.index + '" aria-label="Schrap ' + esc(x.naam) + '">×</button>' : '') + '</span>';
        }).join('') +
        d.betalingen.map(function (p) { return '<span class="vn-item vn-betaal' + (p.achterstand ? ' vn-open' : '') + '">' + esc(p.naam) + ' <em>' + euro(p.bedrag) + '</em></span>'; }).join('') +
        '<small class="vn-rest">' + duur(d.rest) + ' vrij</small></div>';
    }).join('');
  }

