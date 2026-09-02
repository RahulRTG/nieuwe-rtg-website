(function (w, d) {
  'use strict';
  var R = {};
  R.$ = function (s, r) { return (r || d).querySelector(s); };
  R.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  if (new URLSearchParams(w.location.search).get('embed') === '1') {
    d.documentElement.classList.add('tos-ingebed');
  }
  try { R.token = localStorage.getItem('rtg_member_token'); } catch (e) { R.token = null; }
  /* Bestemmingen en aanbod komen uit Mobility OS. Geen ingebouwde plaatsenlijst:
     als de bron niet antwoordt, werkt het scherm niet overtuigend door met een
     oud voorbeeld. */
  R.plekken = [];
  R.staat = { blad: 'vandaag', reizen: null, bestemming: null, vertrek: null,
    moment: 'nu', voertuig: 'limousine', voertuigLabel: 'EXECUTIVE', indicatie: null,
    personen: 2, koffers: 2, zoekTimer: null };
  R.meldAdaptief = function () {};

  var toastTimer;
  R.toast = function (tekst) {
    var el = R.$('#toast'); el.textContent = tekst; el.classList.add('zichtbaar');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('zichtbaar'); }, 3200);
  };
  R.dialogOpen = function (el) {
    if (!el) return;
    if (typeof el.showModal === 'function') el.showModal(); else el.setAttribute('open', '');
  };
  R.dialogSluit = function (el) {
    if (!el) return;
    if (typeof el.close === 'function') el.close(); else el.removeAttribute('open');
  };
  R.api = function (pad, body) {
    var koppen = { 'Content-Type': 'application/json' };
    if (R.token) koppen.Authorization = 'Bearer ' + R.token;
    return fetch(pad, { method: 'POST', headers: koppen, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) { var fout = new Error(data.error || 'De verbinding met RTG lukte niet.'); fout.status = r.status; throw fout; }
        return data;
      }); });
  };
  R.vandaagISO = function (sprong) { return new Date(Date.now() + (sprong || 0) * 86400000).toISOString().slice(0, 10); };
  R.maak = function (tag, klasse, tekst) {
    var el = d.createElement(tag); if (klasse) el.className = klasse; if (tekst != null) el.textContent = tekst; return el;
  };
  R.eur = function (centen) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format((Number(centen) || 0) / 100);
  };
  R.wisselBlad = function (naam, schrijfHash) {
    /* De lijst bladen staat hier EEN keer; wie er een toevoegt aan het scherm
       moet hem hier ook noemen, anders valt de tab stil terug op Vandaag. */
    if (!['vandaag', 'reizen', 'taxi', 'samen', 'rahul'].includes(naam)) naam = 'vandaag';
    R.staat.blad = naam;
    R.$$('[data-blad]').forEach(function (blad) { var aan = blad.dataset.blad === naam; blad.hidden = !aan; blad.classList.toggle('actief', aan); });
    R.$$('[data-tab]').forEach(function (knop) { var aan = knop.dataset.tab === naam; knop.classList.toggle('actief', aan);
      if (aan) knop.setAttribute('aria-current', 'page'); else knop.removeAttribute('aria-current'); });
    if (schrijfHash !== false) history.replaceState(null, '', '#' + naam);
    var bladNaam = naam.charAt(0).toUpperCase() + naam.slice(1);
    d.title = 'RTG Reizen · ' + bladNaam;
    /* HET KRUIMELPAD VOLGT HET BLAD. De schil van het huis zet zijn pad bij het
       openen van de pagina; deze vier bladen zijn geen aparte pagina's, dus
       bleef er "VANDAAG" staan terwijl je op Samen keek. Een pad dat iets
       anders zegt dan het scherm is erger dan geen pad. */
    if (w.RTGEdge && w.RTGEdge.setContext) w.RTGEdge.setContext({ title: bladNaam });
    w.scrollTo({ top: 0, behavior: 'smooth' });
    if (naam === 'taxi' && R.laadMobiliteit) R.laadMobiliteit();
    R.meldAdaptief();
  };

  R.$$('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { R.wisselBlad(b.dataset.tab); }); });
  R.$$('[data-naar-blad]').forEach(function (b) { b.addEventListener('click', function () { R.wisselBlad(b.dataset.naarBlad); }); });
  R.$('[data-open-veilig]').addEventListener('click', function () { R.dialogOpen(R.$('#veiligDialoog')); });
  R.$$('[data-statusactie]').forEach(function (b) { b.addEventListener('click', function () {
    R.toast(b.dataset.statusactie === 'betaling' ? 'De veilige betaalflow wordt geopend vanuit uw reis.' : b.querySelector('b').textContent);
  }); });

  w.RTGReizen = R;

  /* IN DE MOBIELE WERKTAFEL IS ER ÉÉN ONDERBALK. TravelOS implementeert de
     vier bladen hierboven precies één keer; deze adapter biedt die bestaande
     wissel aan de RTG Command-balk aan. shared/adaptief/brug.js brengt alleen
     ids over de framegrens en stuurt een tik weer hierheen terug. Rechtstreeks
     geopend blijft .hoofdtabs dus gewoon de bediening, op desktop eveneens. */
  function startAdaptief() {
    var A = w.RTGAdaptief;
    if (!A || w.parent === w) return;
    var tabs = [
      { id: 'reizen.vandaag', naam: 'Vandaag', tab: 'vandaag' },
      { id: 'reizen.reizen', naam: 'Reizen', tab: 'reizen' },
      { id: 'reizen.taxi', naam: 'Taxi', tab: 'taxi' },
      { id: 'reizen.rahul', naam: 'Rahul', tab: 'rahul' }
    ];
    tabs.forEach(function (item) {
      A.declareer({ id: item.id, naam: item.naam, label: item.naam, groep: 'TravelOS',
        telefoon: ['balk', 'lade'], tablet: ['balk', 'lade'], bureau: ['werkbalk'],
        doe: function () { R.wisselBlad(item.tab); } });
    });
    R.meldAdaptief = function () {
      var staat = {};
      tabs.forEach(function (item) { staat[item.id] = { aan: R.staat.blad === item.tab }; });
      A.context({ bron: 'reizen.tabs', titel: 'TravelOS',
        acties: tabs.map(function (item) { return item.id; }), selectie: false, staat: staat });
    };
    R.meldAdaptief();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', startAdaptief);
  else startAdaptief();
})(window, document);
