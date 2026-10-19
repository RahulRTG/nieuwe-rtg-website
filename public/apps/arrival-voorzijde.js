(function () {
'use strict';
/* RTG Invisible Arrival op het RTG Design System (TRAVELOS-MIGRATIE.md,
   batch 4). Dezelfde vier aanroepen als ervoor: /api/arrival/interpret,
   /request, /pass en /pulse. De pass is anoniem (een accessToken, geen
   account) en staat met zijn vervaltijd in localStorage onder
   rtg_arrival_pass; shared/plaatsnadering.js leest die sleutel ook, dus de
   vorm { p, tot } blijft precies zo.

   Wat er veranderde: een fout kwam in een alert() van de browser en komt nu
   in de melding van het scherm, met dezelfde tekst; en wat de server
   teruggeeft (zaaknaam, stappen, beloften) gaat als tekst het scherm in en
   nooit als HTML. Datum volgt de taal van het lid via Intl. */
var P = null, plan = null, R = null;
var $ = function (x) { return document.getElementById(x); };
var taal = function () { return document.documentElement.lang || 'nl'; };
function nieuwToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
}
function bewaar(p, tot) {
  try {
    if (p) localStorage.setItem('rtg_arrival_pass', JSON.stringify({ p: p, tot: tot }));
    else localStorage.removeItem('rtg_arrival_pass');
  } catch (e) {}
}
function meld(t) {
  var m = $('melding'); m.textContent = t; m.classList.add('toon');
  clearTimeout(m._t); m._t = setTimeout(function () { m.classList.remove('toon'); }, 3600);
}
function api(p, b) {
  return fetch('/api/arrival/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 || r.status === 410) { P = null; bewaar(null); }
        if (!r.ok) throw new Error(j.error || 'Dit lukt nu niet.');
        return j;
      });
    });
}
function el(tag, klasse, tekst) {
  var e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
}
function datum(d) {
  if (!d) return '';
  var x = new Date(d + 'T12:00:00');
  if (!Number.isFinite(x.getTime())) return d;
  return new Intl.DateTimeFormat(taal(), { weekday: 'short', day: 'numeric', month: 'short' }).format(x);
}

/* Het gesprek: uw eigen woorden, en wat Rahul erin herkende. */
function gesprek(wens, herkend) {
  var s = $('stroom');
  s.textContent = '';
  s.appendChild(el('p', 'ds-gesprek__bericht ds-gesprek__bericht--eigen', wens));
  var antwoord = el('p', 'ds-gesprek__bericht', herkend);
  antwoord.id = 'flags';
  s.appendChild(antwoord);
}

$('interpret').addEventListener('click', function () {
  var wens = $('wish').value;
  api('interpret', { tekst: wens }).then(function (j) {
    plan = j.plan;
    $('date').value = plan.datum || ''; $('time').value = plan.tijd || '';
    $('people').value = plan.personen || ''; $('zone').value = plan.zone || 'zaal';
    gesprek(wens.trim(), [plan.toegankelijk ? 'toegankelijke route controleren' : '', plan.allergie ? 'allergiebriefing vereist' : '',
      plan.gelegenheid].filter(Boolean).join(' · ') || 'Geen bijzondere controles herkend.');
    $('plan').hidden = false;
    document.body.dataset.dsSchermtype = 'taak';
  }).catch(function (e) { meld(e.message); });
});

$('request').addEventListener('click', function () {
  R = R || nieuwToken();
  api('request', { requestToken: R, supplierCode: $('code').value, datum: $('date').value, tijd: $('time').value,
    personen: $('people').value, naam: $('name').value, zone: $('zone').value,
    toegankelijk: !!(plan && plan.toegankelijk), allergie: !!(plan && plan.allergie), gelegenheid: plan && plan.gelegenheid })
    .then(function (j) { P = j.pass.accessToken; R = null; teken(j.pass); bewaar(P, j.pass.vervaltAt); })
    .catch(function (e) { meld(e.message); });
});

var STATUS = { aangevraagd: 'Aangevraagd', bevestigd: 'Bevestigd' };
function teken(a) {
  $('pass').hidden = false;
  document.body.dataset.dsSchermtype = 'detail';
  $('passTitle').textContent = a.zaak.naam + ' · ' + datum(a.datum) + ' om ' + a.tijd;
  $('passStatus').textContent = STATUS[a.status] || a.status || '';
  var lijn = $('serviceLine'); lijn.textContent = '';
  (a.servicelijn || []).forEach(function (s) {
    var li = el('span', 'ds-chip', s.stap);
    li.setAttribute('role', 'listitem');
    if (s.status === 'actief') li.setAttribute('aria-current', 'step');
    if (s.status === 'klaar') li.appendChild(el('span', 'ds-verborgen', ' (klaar)'));
    lijn.appendChild(li);
  });
  var bel = $('promises'); bel.textContent = '';
  (a.beloften || []).forEach(function (p) {
    var li = el('li', 'ds-detail__gegeven');
    li.appendChild(el('span', null, p.label));
    li.appendChild(el('span', 'ds-meta', p.status));
    bel.appendChild(li);
  });
}

document.querySelectorAll('[data-pulse]').forEach(function (b) {
  b.addEventListener('click', function () {
    api('pulse', { pass: P, pulse: b.dataset.pulse }).then(function (j) { teken(j.pass); })
      .catch(function (e) { meld(e.message); });
  });
});

try {
  var w = JSON.parse(localStorage.getItem('rtg_arrival_pass') || 'null');
  P = w && w.p && Date.parse(w.tot) > Date.now() ? w.p : null;
  if (!P) bewaar(null);
} catch (e) { P = null; }
if (P) api('pass', { pass: P }).then(function (j) { teken(j.pass); }).catch(function () { P = null; });
})();
