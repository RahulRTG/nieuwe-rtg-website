/* Het boek van RTG in de kamer Financiën (besluit C8, 27 september 2026).

   Wat RTG zelf uitgeeft en verschuldigd is, per maand: vaste lasten, marketing
   per kanaal en korte verplichtingen. Elk bedrag met een bron en op naam van wie
   het invoert -- dat laatste zet de server, niet dit scherm. Er is met opzet geen
   veld per medewerker: personeel is een totaal.

   Leeft naast kantoren.html en krijgt de `api` van dat scherm mee, zodat er geen
   tweede weg naar de kantoorinlog ontstaat. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var DEEL = { vast: 'Vaste lasten deze maand', marketing: 'Marketing per kanaal deze maand', kort: 'Korte verplichtingen op de laatste dag' };
  var POST = { personeel: 'Personeel (totaal)', huisvesting: 'Huisvesting', diensten: 'Diensten en abonnementen', overig: 'Overig',
    werkgever: 'Via werkgevers', campagne: 'Advertenties', zoeken: 'Zoekmachines', sociaal: 'Sociale media', anders: 'Anders',
    crediteuren: 'Openstaande rekeningen', belasting: 'Belasting', loon: 'Loon' };
  var taal = function () { return document.documentElement.lang || undefined; };
  var euro = function (c) { return c == null ? 'niet ingevuld' : '€ ' + (c / 100).toLocaleString(taal(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  /* "1.234,56" en "1234.56" zijn allebei euro's; geen geldig bedrag is null, geen nul */
  var centenVan = function (t) {
    var s = String(t || '').trim().replace(/\s|€/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };

  function rij(deel, p) {
    var id = deel + '-' + p.post;
    return '<div class="rb-rij">' +
      '<div class="rb-post"><b>' + esc(POST[p.post] || p.post) + '</b>' +
        '<span class="stil">' + (p.centen == null ? 'nog niet ingevuld' : esc(euro(p.centen)) + ' · ' + esc(p.bron) + ' · ' + esc(p.gezetDoor || '')) + '</span></div>' +
      '<input class="veld rb-bedrag" id="rb-b-' + id + '" inputmode="decimal" placeholder="Bedrag in euro" aria-label="Bedrag ' + esc(POST[p.post] || p.post) + '">' +
      '<input class="veld rb-bron" id="rb-s-' + id + '" maxlength="300" placeholder="Bron (factuur, opgave)" aria-label="Bron ' + esc(POST[p.post] || p.post) + '">' +
      '<button class="knop stil" data-rbdeel="' + deel + '" data-rbpost="' + esc(p.post) + '">Bewaar</button></div>';
  }

  function teken(vak, boek) {
    vak.innerHTML = ['vast', 'marketing', 'kort'].map(function (deel) {
      var d = boek[deel];
      return '<div class="rb-deel"><h5>' + esc(DEEL[deel]) + '</h5>' +
        '<div class="stil">' + (d.compleet ? 'Totaal ' + esc(euro(d.totaalCenten)) : 'Nog leeg: ' + esc(d.ontbreekt.map(function (x) { return POST[x] || x; }).join(', ')) + '; zonder elke post geen totaal.') + '</div>' +
        d.posten.map(function (p) { return rij(deel, p); }).join('') + '</div>';
    }).join('');
  }

  function laad(api, meld) {
    var vak = document.getElementById('kRbDelen'), maand = document.getElementById('kRbMaand');
    if (!vak || !maand) return;
    if (!maand.value) maand.value = new Date().toISOString().slice(0, 7);
    var haal = function () {
      return api('rtgboek', { maand: maand.value }).then(function (r) { teken(vak, r.boek); })
        .catch(function (e) { vak.textContent = e.message; });
    };
    if (!vak.dataset.bedraad) {
      vak.dataset.bedraad = '1';
      maand.addEventListener('change', haal);
      vak.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-rbdeel]');
        if (!b) return;
        var id = b.dataset.rbdeel + '-' + b.dataset.rbpost;
        var centen = centenVan(document.getElementById('rb-b-' + id).value);
        if (centen == null) { meld('Vul een bedrag in euro in, nul mag ook.'); return; }
        b.disabled = true;
        api('rtgboek/zet', { maand: maand.value, deel: b.dataset.rbdeel, post: b.dataset.rbpost, centen: centen,
          bron: document.getElementById('rb-s-' + id).value })
          .then(function (r) { meld(r.ongewijzigd ? 'Stond er al zo.' : 'Bewaard, op uw naam.'); teken(vak, r.boek); })
          .catch(function (e) { meld(e.message); b.disabled = false; });
      });
    }
    return haal();
  }

  window.RTGBoekKamer = { laad: laad, centenVan: centenVan };
  /* te laat geladen: de kamer Financien staat al open (zie openKamer in kantoren.html) */
  if (window.RTGFinancien) laad(window.RTGFinancien.api, window.RTGFinancien.meld);
})();
