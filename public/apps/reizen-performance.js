(function (w, d) {
  'use strict';
  var R = {};
  R.$ = function (s, r) { return (r || d).querySelector(s); };
  R.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  try { R.token = localStorage.getItem('rtg_member_token'); } catch (e) { R.token = null; }
  R.plekken = [
    { naam: 'Schiphol Airport', sub: 'Luchthaven · Amsterdam', lat: 52.3105, lng: 4.7683, stad: 'Amsterdam' },
    { naam: 'Amsterdam Centraal', sub: 'Station · Amsterdam', lat: 52.3791, lng: 4.9003, stad: 'Amsterdam' },
    { naam: 'Rotterdam The Hague Airport', sub: 'Luchthaven · Rotterdam', lat: 51.9569, lng: 4.4372, stad: 'Rotterdam' },
    { naam: 'Utrecht Centraal', sub: 'Station · Utrecht', lat: 52.0894, lng: 5.1101, stad: 'Utrecht' },
    { naam: 'Ibiza Airport', sub: 'Luchthaven · Ibiza', lat: 38.8729, lng: 1.3731, stad: 'Ibiza' },
    { naam: 'Ibiza Marina', sub: 'Haven · Ibiza', lat: 38.9144, lng: 1.4432, stad: 'Ibiza' }
  ];
  R.staat = { blad: 'vandaag', reizen: null, bestemming: R.plekken[0], vertrek: null,
    moment: 'nu', voertuig: 'limousine', voertuigLabel: 'EXECUTIVE', indicatie: 68,
    personen: 2, koffers: 2, zoekTimer: null };

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
    if (!['vandaag', 'reizen', 'taxi', 'rahul'].includes(naam)) naam = 'vandaag';
    R.staat.blad = naam;
    R.$$('[data-blad]').forEach(function (blad) { var aan = blad.dataset.blad === naam; blad.hidden = !aan; blad.classList.toggle('actief', aan); });
    R.$$('[data-tab]').forEach(function (knop) { var aan = knop.dataset.tab === naam; knop.classList.toggle('actief', aan);
      if (aan) knop.setAttribute('aria-current', 'page'); else knop.removeAttribute('aria-current'); });
    if (schrijfHash !== false) history.replaceState(null, '', '#' + naam);
    d.title = 'RTG Reizen · ' + naam.charAt(0).toUpperCase() + naam.slice(1);
    w.scrollTo({ top: 0, behavior: 'smooth' });
    if (naam === 'taxi' && R.laadMobiliteit) R.laadMobiliteit();
  };

  R.$$('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { R.wisselBlad(b.dataset.tab); }); });
  R.$$('[data-naar-blad]').forEach(function (b) { b.addEventListener('click', function () { R.wisselBlad(b.dataset.naarBlad); }); });
  R.$('[data-open-veilig]').addEventListener('click', function () { R.dialogOpen(R.$('#veiligDialoog')); });
  R.$$('[data-statusactie]').forEach(function (b) { b.addEventListener('click', function () {
    R.toast(b.dataset.statusactie === 'betaling' ? 'De veilige betaalflow wordt geopend vanuit uw reis.' : b.querySelector('b').textContent);
  }); });

  w.RTGReizen = R;
})(window, document);
