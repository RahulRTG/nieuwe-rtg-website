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

  function vraag(pad, body) {
    return fetch('/api/member/magnaat/leven/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Magnaat kon dit niet doen.');
        return d;
      }); });
  }
  function meldFout(t) { var e = q('#vnFout'); e.textContent = t; e.hidden = !t; }
  function laad() { return vraag('staat').then(teken).catch(function (e) { meldFout(e.message); }); }
  function doe(body) {
    meldFout('');
    return vraag('actie', body).then(function (s) { KEUZE = null; teken(s); }).catch(function (e) { meldFout(e.message); });
  }

  function klok(s) {
    clearTimeout(KLOK);
    KLOK = setTimeout(laad, Math.max(1000, s.volgendeDagOver + 500));
    q('#vnKlok').textContent = 'Week ' + s.week + ' · nog ' + duur(s.vrijVandaag) + ' vrij vandaag · de dag loopt vanzelf af over ' +
      Math.ceil(s.volgendeDagOver / 60000) + ' min, of sluit hem zelf af';
  }

  /* Het invulveld van een handeling: vaste waarden gaan mee, markeringen worden velden. */
  function invoerVoor(a) {
    var i = a.invoer || {}, h = '<p>' + esc(a.waarom) + '</p><div class="vn-velden">';
    if (Array.isArray(i.aanbod)) h += '<label>Wat ga je maken <select id="vnF-aanbod">' + i.aanbod.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.naam) + '</option>'; }).join('') + '</select></label>';
    if (i.bedrag === 'euro') h += '<label>Bedrag in hele euro\'s <input id="vnF-bedrag" type="number" min="1" step="1" inputmode="numeric"></label>';
    if (Array.isArray(i.voorschot)) h += '<label>Vooraf <select id="vnF-voorschot">' + i.voorschot.map(function (p) { return '<option value="' + p + '">' + (p ? p + '%' : 'niets') + '</option>'; }).join('') + '</select></label>';
    if (i.minuten === 'minuten') {
      var opties = [];
      for (var m = 30; m <= LEVEN.vrijVandaag; m += 30) opties.push(m);
      h += '<label>Hoe lang <select id="vnF-minuten">' + opties.reverse().map(function (m) { return '<option value="' + m + '">' + duur(m) + '</option>'; }).join('') + '</select></label>';
    }
    if (i.procent === 'getal') h += '<label>Korting in procent <input id="vnF-procent" type="number" min="1" max="20" step="1" value="3"></label>';
    if (i.naam === 'tekst') h += '<label>Naam van je onderneming <input id="vnF-naam" maxlength="60"></label>';
    return h + '</div><button class="btn primary" type="button" data-vn-doe>' + esc(a.label) + '</button>';
  }
  function lichaam(a) {
    var b = { actie: a.actie }, i = a.invoer || {}, v = function (n) { var e = q('#vnF-' + n); return e ? e.value : undefined; };
    ['deal', 'wat', 'dag', 'post'].forEach(function (k) { if (i[k] != null && typeof i[k] !== 'object') b[k] = i[k]; });
    if (i.aanbod) b.aanbod = v('aanbod');
    if (i.bedrag) b.bedrag = Number(v('bedrag'));
    if (i.voorschot) b.voorschot = Number(v('voorschot'));
    if (i.minuten) b.minuten = Number(v('minuten'));
    if (i.procent) b.procent = Number(v('procent'));
    if (i.naam) b.naam = v('naam');
    return b;
  }
  var vrijeInvoer = function (a) { var i = a.invoer || {}; return !(i.aanbod || i.bedrag || i.minuten || i.procent || i.naam); };

  function tekenAgenda(s) {
    q('#vnAgenda').innerHTML = s.vandaag.agenda.map(function (d, n) {
      return '<div class="vn-dag' + (n === 0 ? ' vn-vandaag' : '') + '"><b>' + esc(d.naam) + '</b><small>dag ' + d.dag +
        (d.dienst ? ' · dienst' : '') + (d.loondag ? ' · loon' : '') + '</small>' +
        d.items.map(function (x) {
          return '<span class="vn-item vn-w-' + esc(x.wat) + '">' + esc(x.naam) + (x.klant ? ' · ' + esc(x.klant) : '') + ' <em>' + duur(x.minuten) + '</em>' +
            (x.wat !== 'gesprek' ? '<button type="button" class="vn-schrap" data-vn-schrap="' + d.dag + ':' + x.index + '" aria-label="Schrap ' + esc(x.naam) + '">×</button>' : '') + '</span>';
        }).join('') +
        d.betalingen.map(function (p) { return '<span class="vn-item vn-betaal' + (p.achterstand ? ' vn-open' : '') + '">' + esc(p.naam) + ' <em>' + euro(p.bedrag) + '</em></span>'; }).join('') +
        '<small class="vn-rest">' + duur(d.rest) + ' vrij</small></div>';
    }).join('');
  }

  function tekenVandaag(s) {
    var v = s.vandaag;
    q('#vnDag').textContent = s.dagNaam + ', dag ' + s.dag;
    q('#vnKas').textContent = euro(s.geld.bank);
    q('#vnAandacht').innerHTML = v.aandacht.map(function (x) { return '<li class="vn-a vn-s-' + esc(x.soort) + '">' + esc(x.tekst) + '</li>'; }).join('');
    var hoofd = q('#vnHoofd'), eerste = v.volgende[0];
    hoofd.hidden = !eerste;
    hoofd.textContent = eerste ? eerste.label : '';
    q('#vnActies').innerHTML = v.volgende.slice(1).map(function (a, n) {
      return '<button type="button" class="btn" data-vn-actie="' + (n + 1) + '">' + esc(a.label) + '</button>';
    }).join('');
    q('#vnWaarom').innerHTML = v.volgende.map(function (a) { return '<li><b>' + esc(a.label) + '</b> ' + esc(a.waarom) + '</li>'; }).join('');
    var a = KEUZE == null ? null : v.volgende[KEUZE];
    q('#vnInvoer').hidden = !a;
    q('#vnInvoer').innerHTML = a ? invoerVoor(a) : '';
    tekenAgenda(s);
    q('#vnMeldingen').innerHTML = v.meldingen.map(function (m) {
      return '<li class="vn-m vn-s-' + esc(m.soort) + '"><small>dag ' + esc(m.dag) + '</small>' + esc(m.tekst) + '</li>'; }).join('');
    q('#vnRtg').innerHTML = s.rtg.map(function (r) {
      return '<div class="vn-rtg"><b>' + esc(r.naam) + '</b><small>verscheen op dag ' + esc(r.dag) + ' · ' + esc(r.waarom) + '</small></div>'; }).join('');
  }

  function teken(s) {
    LEVEN = s;
    tekenVandaag(s);
    if (window.RTGMagnaatLevenSchermen) window.RTGMagnaatLevenSchermen.teken(s, { q: q, esc: esc, euro: euro, duur: duur });
    klok(s);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-vn-actie],[data-vn-doe],[data-vn-schrap]');
    if (!t || !LEVEN) return;
    if (t.dataset.vnSchrap) { var p = t.dataset.vnSchrap.split(':'); doe({ actie: 'schrap', dag: Number(p[0]), index: Number(p[1]) }); return; }
    if (t.dataset.vnActie != null) {
      var n = Number(t.dataset.vnActie), a = LEVEN.vandaag.volgende[n];
      if (!a) return;
      if (vrijeInvoer(a)) { doe(lichaam(a)); return; }
      KEUZE = n; tekenVandaag(LEVEN); return;
    }
    var gekozen = LEVEN.vandaag.volgende[KEUZE];
    if (gekozen) doe(lichaam(gekozen));
  });
  laad();
}());
