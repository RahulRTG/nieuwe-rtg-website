/* Dezelfde bronacties voor beide werkplekken. Geen lokale status→rechten-tabel. */
(function (w) {
  'use strict';
  w.RTGAanvraagActies = function (el, a, o) {
    var acties = a.acties || [], formulier;
    function veld(naam, label, waarde) {
      var l = document.createElement('label'); l.textContent = label;
      var v = document.createElement('input'); v.className = 'veld'; v.name = naam;
      v.value = waarde == null ? '' : waarde; v.maxLength = naam === 'wat' ? 300 : naam === 'tekst' ? 400 : 60;
      if (naam === 'wanneer') v.type = 'date';
      if (naam === 'budget') { v.type = 'number'; v.min = '0'; }
      l.appendChild(v); formulier.appendChild(l);
    }
    function verstuur(actie, extra, knop) {
      knop.disabled = true;
      var body = Object.assign({ id: a.id, versie: a.versie }, extra || {});
      var pad = '/api/mall/aanvraag/' + actie;
      if (o.zaak) { pad = '/api/supplier/mall/aanvraag/behandel'; body.actie = actie; }
      o.api(pad, body).then(function (d) { o.meld(d.opmerking || 'De aanvraag is bijgewerkt.'); return o.ververs(); })
        .catch(function (e) { o.meld(e.message); }).finally(function () { knop.disabled = false; });
    }
    acties.filter(function (x) { return !['kies', 'reageer'].includes(x.id); }).forEach(function (x) {
      var b = document.createElement('button'); b.className = 'knop stil'; b.type = 'button'; b.textContent = x.label;
      b.dataset.aanvraagActie = x.id; el.appendChild(b);
      b.onclick = function () {
        if (!['wijzig', 'afronden', 'teruggeven'].includes(x.id)) return verstuur(x.id, {}, b);
        if (formulier) formulier.remove();
        formulier = document.createElement('form'); formulier.className = 'rij ruim';
        formulier.setAttribute('aria-label', x.label);
        if (x.id === 'wijzig') {
          veld('wat', 'Uw vraag', a.wat); veld('plek', 'Plaats', a.plek);
          veld('wanneer', 'Datum', a.wanneer); veld('budget', 'Budget in euro', a.budget);
        } else veld('tekst', 'Toelichting voor het lid', '');
        var stuur = document.createElement('button'); stuur.type = 'submit'; stuur.className = 'knop'; stuur.textContent = 'Opslaan';
        formulier.appendChild(stuur); el.appendChild(formulier); formulier.querySelector('input').focus();
        formulier.onsubmit = function (ev) {
          ev.preventDefault(); var data = Object.fromEntries(new FormData(formulier));
          if (x.id === 'wijzig') data.verdieping = a.verdieping;
          verstuur(x.id, data, stuur);
        };
      };
    });
    if ((a.verloop || []).length) {
      var historie = document.createElement('details'), kop = document.createElement('summary');
      kop.textContent = 'Verloop van deze aanvraag'; historie.appendChild(kop);
      a.verloop.forEach(function (v) {
        var regel = document.createElement('p');
        regel.textContent = new Date(v.at).toLocaleString() + ' · ' + v.actie + (v.tekst ? ': ' + v.tekst : '');
        historie.appendChild(regel);
      });
      el.appendChild(historie);
    }
    var kaart = el.closest('[data-aanvraag]');
    w.RTGAanvraagEdge(kaart, a, function (id) {
      var knop = kaart.querySelector('[data-aanvraag-actie="' + id + '"]') || kaart.querySelector('.' + id);
      if (!knop || knop.disabled) return;
      if (id === 'kies') { knop.scrollIntoView({ block: 'center' }); knop.focus(); }
      else knop.click();
    });
  };
}(window));
