/* Pure componentproef zonder server of browser. De echte UI-scripts draaien
   met een minimale DOM-poort; dit is geen visuele of browserkwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const BASIS = '/api/mijn/abonnement/automatisch/';
const OPSLAG = 'rtg-abonnement-opdracht-v1-' + '00'.repeat(32);
const klaar = () => new Promise(resolve => setImmediate(resolve));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function contract(status = 'AANGEBODEN') {
  return { id: 'contract-eigen', status, aanbod: {
    pas: 'rtg', hash: 'versie-eigen', scope: { soort: 'persoon' }, frequentie: 'maand',
    prijs: { maand: { brutoCenten: 12100, nettoCenten: 10000, btwCenten: 2100 }, termijn: { brutoCenten: 12100 } },
    verrekening: { creditCenten: 0, teBetalenCenten: 12100 },
    voorwaarden: { jaarVervolg: 'maand', mandaatTekst: 'Expliciet betaalmandaat' }, tekst: 'Eigen overeenkomst' } };
}
function stand(instroomBeschikbaar, c = contract()) {
  return { beschikbaar: true, instroomBeschikbaar, contracten: [c], intake: { bedrijfstypes: [{ id: 'vakwerk', label: 'Vakwerk' }] } };
}
function omgeving(eerste, { opgeslagen, digest } = {}) {
  const nodes = new Map(), listeners = new Map(), calls = [], intakes = [], opslag = new Map();
  if (opgeslagen) opslag.set(OPSLAG, JSON.stringify(opgeslagen));
  const f = { stand: eerste, calls, intakes, opslag, gestopt: 0 };
  let html = '';
  const vak = {
    isConnected: true,
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value; nodes.clear();
      for (const m of value.matchAll(/\bid="([^"]+)"/g)) nodes.set('#' + m[1], { value: '', innerHTML: '', textContent: '' });
    },
    querySelector: s => nodes.get(s) || null,
    querySelectorAll: () => [], contains: b => b.vak === vak,
    addEventListener: (n, fn) => listeners.set(n, fn),
    removeEventListener: (n, fn) => { if (listeners.get(n) === fn) listeners.delete(n); }
  };
  const w = {
    location: { origin: 'https://rtg.example.test' }, confirm: () => true,
    crypto: { subtle: { digest: digest || (async () => new Uint8Array(32).buffer) }, randomUUID: () => 'fixture-opdracht' },
    sessionStorage: { getItem: k => opslag.get(k) || null, setItem: (k, v) => opslag.set(k, v), removeItem: k => opslag.delete(k) },
    Geld: { esc, euro: x => String(x / 100), token: () => 'fixture-sessie',
      api: async (pad, body) => { calls.push({ pad, body }); return pad === BASIS + 'stand' ? f.stand : { ok: true }; } },
    RTGGeldAbonnementIntake: {
      html: () => '<form id="lmLiteIntake"></form>',
      start: (_vak, ctx) => { intakes.push(ctx); return () => { f.gestopt++; }; }
    }
  };
  const context = vm.createContext({ window: w, document: {}, URL, TextEncoder });
  for (const name of ['lidmaatschap-aanbod-beeld', 'lidmaatschap-aanbod'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/apps/geld', name + '.js'), 'utf8'), context);
  Object.assign(f, { vak, w, start: () => w.RTGGeldAbonnement.start(vak),
    kaart: () => vak.querySelector('#lmAutoContracten')?.innerHTML || '',
    klik: actie => { const b = { vak, dataset: { aboActie: actie, aboId: 'contract-eigen' } };
      listeners.get('click')({ target: { closest: () => b } }); },
    submit: form => listeners.get('submit')({ target: form, preventDefault() {} }) });
  return f;
}

test('beeld: gesloten of onbekende instroom heeft geen aanbod, intake of handtekening; bediening blijft', () => {
  const f = omgeving(stand(false)), b = f.w.RTGGeldAbonnementBeeld;
  for (const open of [false, undefined]) {
    const html = b.formulier(f.stand.intake, open, '<img src=x>');
    assert.doesNotMatch(html, /<form|lmAanbodVraag|lmLiteIntake|<img/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /id="lmAutoContracten"/); assert.match(html, /data-abo-actie="ververs"/);
    const aangeboden = b.contract(contract(), 0, open);
    assert.doesNotMatch(aangeboden, /data-abo-teken/);
    assert.match(aangeboden, /Eigen overeenkomst/); assert.match(aangeboden, /data-abo-actie="intrekken"/);
    assert.doesNotMatch(aangeboden, /offerte is verlopen/);
    const actief = contract('ACTIEF'); actief.ondertekening = { at: '2026-11-14' };
    assert.match(b.contract(actief, 0, open), /data-abo-actie="opzeggen"/);
    assert.match(b.contract(actief, 0, open), /data-abo-actie="herstel"/);
    assert.match(b.contract(contract('GEACCEPTEERD'), 0, open), /data-abo-actie="betalen"/);
  }
  assert.match(b.formulier(f.stand.intake, true), /id="lmAanbodVraag"/);
  assert.match(b.formulier(f.stand.intake, true), /id="lmLiteIntake"/);
  assert.match(b.contract(contract(), 0, true), /data-abo-teken/);
});

test('controller: gesloten instroom toont bestaande contracten zonder een intake te starten', async () => {
  for (const open of [false, undefined]) {
    const f = omgeving(stand(open)); f.start(); await klaar();
    assert.equal(f.vak.querySelector('#lmAanbodVraag'), null);
    assert.equal(f.intakes.length, 0); assert.match(f.kaart(), /Eigen overeenkomst/);
    assert.doesNotMatch(f.kaart(), /data-abo-teken/);
    assert.deepEqual(f.calls.map(c => c.pad), [BASIS + 'stand']);
  }
});

test('controller: live sluiten verwijdert formulieren, stopt intake en weigert oude submit-events', async () => {
  const f = omgeving(stand(true)); f.start(); await klaar();
  assert.ok(f.vak.querySelector('#lmAanbodVraag')); assert.match(f.kaart(), /data-abo-teken/);
  const oud = f.intakes[0]; assert.equal(oud.levend(), true);
  f.stand = stand(false); f.klik('ververs'); await klaar();
  assert.equal(f.gestopt, 1); assert.equal(oud.levend(), false);
  assert.equal(f.vak.querySelector('#lmAanbodVraag'), null);
  assert.equal(f.vak.querySelector('#lmLiteIntake'), null); assert.doesNotMatch(f.kaart(), /data-abo-teken/);
  oud.ontvangen('oude-aanvraag', true);
  f.submit({ id: 'lmAanbodVraag', dataset: {} }); await klaar();
  f.submit({ id: '', dataset: { aboTeken: 'contract-eigen' } }); await klaar();
  assert.equal(f.calls.some(c => [BASIS + 'aanbod', BASIS + 'teken'].includes(c.pad)), false);
  assert.match(f.vak.querySelector('#lmAutoMelding').textContent, /gesloten/);
  for (const actie of ['betalen', 'herstel', 'intrekken']) {
    f.klik(actie); await klaar();
    assert.ok(f.calls.some(c => c.pad === BASIS + actie), actie + ' blijft bereikbaar');
  }
  f.stand = stand(true); f.klik('ververs'); await klaar();
  assert.ok(f.vak.querySelector('#lmAanbodVraag')); assert.equal(f.intakes.length, 2);
  assert.equal(oud.levend(), false, 'oud async-intakeantwoord krijgt na heropening geen nieuw gezag');
});

test('controller: vertraagd opdrachtherstel na sluiten is null-safe en bewaart dezelfde opdracht', async () => {
  let hervat;
  const wacht = new Promise(resolve => { hervat = resolve; });
  const opdracht = { pas: 'business-lite', frequentie: 'jaar', aanmeldingId: 'eigen-aanvraag', idempotencyKey: 'eigen-onzekere-opdracht' };
  const f = omgeving(stand(true), { opgeslagen: opdracht, digest: () => wacht });
  f.start(); await klaar();
  assert.ok(f.vak.querySelector('#lmAanbodVraag'));
  f.stand = stand(false); f.klik('ververs'); await klaar();
  hervat(new Uint8Array(32).buffer); await klaar();
  assert.equal(f.vak.querySelector('#lmAanbodVraag'), null);
  assert.match(f.kaart(), /Eigen overeenkomst/);
  assert.equal(f.opslag.get(OPSLAG), JSON.stringify(opdracht));
  assert.equal(f.calls.some(c => c.pad !== BASIS + 'stand'), false);
  f.stand = stand(true); f.klik('ververs'); await klaar();
  assert.equal(f.vak.querySelector('#lmAanbodPas').value, 'business-lite');
  assert.equal(f.vak.querySelector('#lmAanbodFrequentie').value, 'jaar');
  assert.equal(f.vak.querySelector('#lmAanbodAanvraag').value, 'eigen-aanvraag');
  assert.equal(f.opslag.get(OPSLAG), JSON.stringify(opdracht));
});

function intakeOmgeving({ sleutel = async () => OPSLAG, antwoord = async () => ({ ontvangst: { aanvraagId: 'ontvangst-eigen' } }) } = {}) {
  const opslag = new Map(), listeners = new Map(), calls = [], ontvangen = [];
  const f = { levend: true, opslag, calls, ontvangen, resets: 0 };
  const form = { elements: Object.fromEntries(Object.entries({ naam: 'Eigen Ondernemer', contact: 'eigen@fixture.test',
    bedrijf: 'Eigen Atelier', type: 'vakwerk', plaats: 'Utrecht', behoeften: '' }).map(([k, value]) => [k, { value }])),
  querySelector: () => ({ disabled: false }), reset: () => { f.resets++; },
  addEventListener: (n, fn) => listeners.set(n, fn),
  removeEventListener: (n, fn) => { if (listeners.get(n) === fn) listeners.delete(n); } };
  const w = { crypto: { randomUUID: () => 'uuid-eigen-intake' },
    sessionStorage: { getItem: k => opslag.get(k) || null, setItem: (k, v) => opslag.set(k, v), removeItem: k => opslag.delete(k) },
    Geld: { esc, api: async (pad, body) => { calls.push({ pad, body }); return antwoord(); } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/apps/geld/lidmaatschap-aanbod-intake.js'), 'utf8'), { window: w });
  f.stop = w.RTGGeldAbonnementIntake.start({ querySelector: () => form }, {
    sleutel, levend: () => f.levend, meld: tekst => { f.melding = tekst; },
    ontvangen: (...args) => ontvangen.push(args) });
  f.submit = () => listeners.get('submit')({ preventDefault() {} });
  return f;
}

test('echte intake: sluiten tijdens sleutelherstel verstuurt geen aanvraag en bewaart geen nieuwe opdracht', async () => {
  let hervat;
  const wacht = new Promise(resolve => { hervat = resolve; });
  const f = intakeOmgeving({ sleutel: () => wacht });
  const verzending = f.submit();
  f.levend = false; f.stop(); hervat(OPSLAG);
  await verzending; await klaar();
  assert.equal(f.calls.length, 0); assert.equal(f.opslag.size, 0);
  assert.equal(f.resets, 0); assert.equal(f.ontvangen.length, 0);
});

test('echte intake: sluiten tijdens antwoord bewaart dezelfde onzekere UUID zonder oude ontvangst te verwerken', async () => {
  let hervat;
  const wacht = new Promise(resolve => { hervat = resolve; });
  const f = intakeOmgeving({ antwoord: () => wacht }); await klaar();
  const verzending = f.submit(), key = OPSLAG + ':lite-intake';
  assert.equal(f.calls.length, 1);
  const bewaard = f.opslag.get(key); assert.equal(JSON.parse(bewaard).idem, 'uuid-eigen-intake');
  f.levend = false; f.stop(); hervat({ ontvangst: { aanvraagId: 'oude-ontvangst' } });
  await verzending;
  assert.equal(f.opslag.get(key), bewaard); assert.equal(f.opslag.has(key + ':ontvangst'), false);
  assert.equal(f.resets, 0); assert.equal(f.ontvangen.length, 0);
});

test('echte intake: levende bediening bewaart bevestigde ontvangst en ruimt alleen de eigen opdracht op', async () => {
  const f = intakeOmgeving(); await klaar(); await f.submit();
  const key = OPSLAG + ':lite-intake';
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].pad, '/api/aanmelding/aanvraag');
  assert.equal(f.calls[0].body.idem, 'uuid-eigen-intake');
  assert.equal(f.opslag.has(key), false); assert.equal(f.opslag.get(key + ':ontvangst'), 'ontvangst-eigen');
  assert.equal(f.resets, 1); assert.deepEqual(f.ontvangen, [['ontvangst-eigen', true]]);
  f.stop();
});
