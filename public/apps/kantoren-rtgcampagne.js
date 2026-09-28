/* De campagnes van RTG in de kamer Financiën (besluit C12, 28 september 2026).

   Een campagne is een linkcode (?c=) met een begin en een einde, onder precies
   een kanaal. Hier maakt Financien er een aan en boekt per maand wat hij kostte;
   wie het deed zet de server, niet dit scherm. Tellen de campagnes van een kanaal
   op tot meer dan het kanaal zelf, dan staat dat er als tegenspraak -- en rekent
   de maat voor dat kanaal geen getal per campagne.

   Leeft naast kantoren.html en kantoren-rtgboek.js: dezelfde `api`, dezelfde
   maandkeuze en dezelfde bedragomzetting, zodat er geen tweede van ontstaat. */
(function () {
  'use strict';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var KANAAL = { werkgever: 'Via werkgevers', campagne: 'Advertenties', zoeken: 'Zoekmachines', sociaal: 'Sociale media', anders: 'Anders' };
  var taal = function () { return document.documentElement.lang || undefined; };
  var euro = function (c) { return c == null ? 'niet ingevuld' : '€ ' + (c / 100).toLocaleString(taal(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  function formulier(kanalen) {
    return '<div class="rb-rij">' +
      '<input class="veld" id="rbc-code" maxlength="32" placeholder="code, bijv. herfst-26" aria-label="Campagnecode">' +
      '<input class="veld" id="rbc-naam" maxlength="80" placeholder="Naam" aria-label="Naam van de campagne">' +
      '<select class="veld" id="rbc-kanaal" aria-label="Kanaal">' + kanalen.map(function (k) { return '<option value="' + esc(k) + '">' + esc(KANAAL[k] || k) + '</option>'; }).join('') + '</select>' +
      '<input class="veld" type="date" id="rbc-van" aria-label="Begin">' +
      '<input class="veld" type="date" id="rbc-tot" aria-label="Einde">' +
      '<button class="knop stil" data-rbcmaak="1">Maak campagne</button></div>';
  }

  function rij(r) {
    return '<div class="rb-rij">' +
      '<div class="rb-post"><b>' + esc(r.naam) + '</b><span class="stil">' + esc(r.code) + ' · ' + esc(KANAAL[r.kanaal] || r.kanaal) + ' · ' +
        (r.centen == null ? 'nog niet ingevuld' : esc(euro(r.centen)) + ' · ' + esc(r.bron) + ' · ' + esc(r.gezetDoor || '')) + '</span></div>' +
      '<input class="veld rb-bedrag" id="rbc-b-' + esc(r.code) + '" inputmode="decimal" placeholder="Bedrag in euro" aria-label="Bedrag ' + esc(r.naam) + '">' +
      '<input class="veld rb-bron" id="rbc-s-' + esc(r.code) + '" maxlength="300" placeholder="Bron (factuur, opgave)" aria-label="Bron ' + esc(r.naam) + '">' +
      '<button class="knop stil" data-rbccode="' + esc(r.code) + '">Bewaar</button></div>';
  }

  function teken(vak, kanalen, c) {
    vak.innerHTML = c.tegenspraak.map(function (t) { return '<div class="rb-tegen">' + esc(KANAAL[t.kanaal] || t.kanaal) + ': ' + esc(t.reden) + '</div>'; }).join('') +
      (c.rijen.length ? c.rijen.map(rij).join('') : '<div class="stil">In deze maand liep geen campagne.</div>') + formulier(kanalen);
  }

  function laad(api, meld) {
    var vak = document.getElementById('kRbCampagnes'), maand = document.getElementById('kRbMaand');
    if (!vak || !maand) return;
    if (!maand.value) maand.value = new Date().toISOString().slice(0, 7);
    var kanalen = [];
    var haal = function () {
      return Promise.all([api('rtgcampagne', {}), api('rtgboek', { maand: maand.value })])
        .then(function (u) { kanalen = u[0].kanalen || []; teken(vak, kanalen, u[1].boek.campagnes); })
        .catch(function (e) { vak.textContent = e.message; });
    };
    if (!vak.dataset.bedraad) {
      vak.dataset.bedraad = '1';
      maand.addEventListener('change', haal);
      vak.addEventListener('click', function (ev) {
        var waarde = function (id) { return document.getElementById(id).value; };
        var maak = ev.target.closest('[data-rbcmaak]'), boek = ev.target.closest('[data-rbccode]');
        if (maak) {
          maak.disabled = true;
          api('rtgcampagne/maak', { code: waarde('rbc-code'), naam: waarde('rbc-naam'), kanaal: waarde('rbc-kanaal'), van: waarde('rbc-van'), tot: waarde('rbc-tot') })
            .then(function (r) { meld(r.ongewijzigd ? 'Die campagne stond er al zo.' : 'Campagne gemaakt, op uw naam.'); return haal(); })
            .catch(function (e) { meld(e.message); maak.disabled = false; });
        } else if (boek) {
          var code = boek.dataset.rbccode;
          var centen = window.RTGBoekKamer ? RTGBoekKamer.centenVan(waarde('rbc-b-' + code)) : null;
          if (centen == null) { meld('Vul een bedrag in euro in, nul mag ook.'); return; }
          boek.disabled = true;
          api('rtgboek/campagne', { maand: maand.value, code: code, centen: centen, bron: waarde('rbc-s-' + code) })
            .then(function (r) { meld(r.ongewijzigd ? 'Stond er al zo.' : 'Bewaard, op uw naam.'); teken(vak, kanalen, r.boek.campagnes); })
            .catch(function (e) { meld(e.message); boek.disabled = false; });
        }
      });
    }
    return haal();
  }

  window.RTGCampagneKamer = { laad: laad };
  /* te laat geladen: de kamer Financien staat al open (zie openKamer in kantoren.html) */
  if (window.RTGFinancien) laad(window.RTGFinancien.api, window.RTGFinancien.meld);
})();
