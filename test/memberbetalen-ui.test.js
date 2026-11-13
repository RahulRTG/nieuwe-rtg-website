/* De echte betaalfuncties uit de ledenapp: een pending providerantwoord mag
   geen groen vinkje, "Betaald" of afgeronde after-callback opleveren. Dit is
   een DOM-adaptertest, geen browser- of providerintegratiebewijs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app(antwoord, fout) {
  const bron = fs.readFileSync(path.join(__dirname, '../public/apps/app-main/app-main-45.js'), 'utf8');
  const code = bron.slice(bron.indexOf('  const FID ='), bron.indexOf('  /* ---------- betalen met munten'));
  const elementen = new Map(), timers = [], meldingen = [], staten = [], verzoeken = [];
  let renders = 0;
  const element = id => {
    if (!elementen.has(id)) {
      const klassen = new Set();
      elementen.set(id, { textContent: '', innerHTML: '', klassen,
        classList: { add: x => klassen.add(x), remove: x => klassen.delete(x) },
        querySelector: x => element(id + ' ' + x) });
    }
    return elementen.get(id);
  };
  const context = vm.createContext({
    $: element, T: (k, tekst) => tekst, eur: x => 'EUR ' + x,
    API: { live: true, call: async (pad, body) => {
      verzoeken.push({ pad, body }); if (fout) throw fout; return antwoord;
    } },
    applyState: x => staten.push(x), toast: x => meldingen.push(x),
    setTimeout: f => timers.push(f),
    renderPay: () => renders++, renderHome: () => renders++, renderTrip: () => renders++
  });
  vm.runInContext(code + '\nthis.betaal = (opties) => payWithFaceId("EUR 12.10", () => executePay("eigen"), opties);', context);
  return { context, element, meldingen, staten, verzoeken,
    renders: () => renders,
    afwachten: async () => { while (timers.length) await timers.shift()(); } };
}

for (const antwoord of [
  { ok: true, pending: true, foundation: 0, state: { invoices: [{ id: 'eigen', status: 'open' }] } },
  { ok: true, intents: [{ status: 'requires_action' }], foundation: 0, state: { invoices: [{ id: 'eigen', status: 'open' }] } }
]) test('pending betaling blijft open, zonder succesmelding of afrondcallback', async () => {
  const a = app(antwoord); let afgerond = 0;
  a.context.betaal({ after: () => afgerond++ });
  assert.equal(a.element('#payLbl').textContent, 'Betaling verwerken…');
  await a.afwachten();
  assert.equal(a.staten[0], antwoord.state);
  assert.equal(a.staten[0].invoices[0].status, 'open');
  assert.equal(a.element('#paywait .paycard').klassen.has('done'), false);
  assert.equal(a.element('#paywait').klassen.has('open'), false);
  assert.equal(a.meldingen.length, 1);
  assert.match(a.meldingen[0], /^Nog niet betaald:/);
  assert.equal(afgerond, 0);
  assert.equal(a.renders(), 3);
  a.context.betaal(); await a.afwachten();
  assert.equal(a.verzoeken.length, 2, 'geen achtergebleven busy-slot');
});

test('afgehandelde betaling toont pas succes na serverantwoord', async () => {
  const a = app({ ok: true, foundation: 3, state: { invoices: [{ id: 'eigen', status: 'paid' }] } });
  a.context.betaal();
  assert.equal(a.element('#paywait .paycard').klassen.has('done'), false);
  await a.afwachten();
  assert.equal(a.element('#paywait .paycard').klassen.has('done'), true);
  assert.equal(a.element('#payLbl').textContent, 'Bevestigd');
  assert.match(a.meldingen[0], /^Betaald\. EUR 3 gereserveerd/);
});

test('providerfout bevestigt niets en laat opnieuw bedienen toe', async () => {
  const a = app(null, new Error('Geen uitsluitsel; RTG zoekt het na.'));
  a.context.betaal(); await a.afwachten();
  assert.equal(a.element('#paywait .paycard').klassen.has('done'), false);
  assert.deepEqual(a.meldingen, ['Geen uitsluitsel; RTG zoekt het na.']);
  assert.equal(a.staten.length, 0);
  a.context.betaal(); await a.afwachten();
  assert.equal(a.verzoeken.length, 2);
});
