'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const SOURCE = fs.readFileSync(path.join(__dirname, '../public/shared/interface/world-widget-data.js'), 'utf8');
const child = (id = 'a', token = 'ta') => ({ code: 'family-' + id, token,
  profiel: { id, rol: 'kind', leeftijdBevestigd: true, gast: false } });
function fixture(initial = child()) {
  const events = new EventTarget(), requests = [];
  let sessie = initial, memberUnchanged = true;
  const w = { Sessie: { huidig: () => sessie },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    RTGModuleSDK: { define: (_, factory) => factory } };
  vm.runInNewContext(SOURCE, { window: w, AbortController, Date, Error, Promise, Object, JSON, Math });
  const run = (_, body) => new Promise((resolve, reject) => requests.push({ body, resolve, reject }));
  const session = { unchanged: () => memberUnchanged };
  const module = w.RTGWidgetData.definition()({ services: { familyRequest: run }, request: run, session });
  const read = (id = 'foundation-leren', fresh = false) => module.actions['desktop.widget.read'].run({ id, fresh });
  return { w, module, requests, read, session, memberChanged() { memberUnchanged = false; }, set(s, notify = true) { sessie = s; if (notify) events.dispatchEvent(new Event('rtf-session-changed')); },
    storage(key) { const e = new Event('storage'); e.key = key; events.dispatchEvent(e); } };
}
const denied = p => assert.rejects(p, e => e.status === 403);
const changed = p => assert.rejects(p, e => e.status === 401);
test('leerlingpreview: ouder, gast, ontbrekende en onbevestigde leeftijd doen geen leerlingverzoek', async () => {
  for (const sessie of [null, { code: 'g', token: 't', profiel: { id: 'p', rol: 'ouder', beheerder: true } },
    { ...child(), profiel: { ...child().profiel, leeftijdBevestigd: false } },
    { ...child(), profiel: { id: 'p', rol: 'kind' } },
    { ...child(), profiel: { ...child().profiel, gast: true } }, { ...child(), token: '' }]) {
    const f = fixture(sessie);
    assert.equal(f.w.RTGWidgetData.previewAvailable('foundation-leren'), false);
    assert.equal(f.w.RTGWidgetData.supports('foundation-leren'), true, 'functie blijft in catalogus');
    await denied(f.read()); assert.equal(f.requests.length, 0);
    f.module.destroy();
  }
});
test('passende leerling vraagt echte bron; server403 wordt niet omgezet in lege succesvolle inhoud', async () => {
  const f = fixture();
  assert.equal(f.w.RTGWidgetData.previewAvailable('foundation-leren'), true);
  const p = f.read(); f.requests[0].resolve({ stukken: [{ naam: 'Eigen les' }] });
  assert.equal((await p).stukken[0].naam, 'Eigen les');
  assert.equal((await f.read()).stukken[0].naam, 'Eigen les'); assert.equal(f.requests.length, 1);
  const q = f.read('foundation-leren', true), e = new Error('Leerlingpas ingetrokken'); e.status = 403;
  f.requests[1].reject(e); await assert.rejects(q, x => x === e);
  f.module.destroy();
});
test('ouderagenda blijft beschikbaar; alleen leerlingpreview wordt automatisch geweerd', async () => {
  const f = fixture({ code: 'g', token: 't', profiel: { id: 'p', rol: 'ouder' } });
  assert.equal(f.w.RTGWidgetData.previewAvailable('foundation-agenda'), true);
  const p = f.read('foundation-agenda'); f.requests[0].resolve({ afspraken: [] }); await p;
  assert.equal(f.requests.length, 1); f.module.destroy();
});
test('profielwisseling houdt oude pending, cache en callbacks buiten nieuwe sessie', async () => {
  const f = fixture();
  const a = f.read(); const aRejected = changed(a);
  f.set(child('b', 'tb'));
  const b = f.read(); assert.equal(f.requests.length, 2);
  f.requests[0].resolve({ stukken: [{ naam: 'Privé A' }] }); await aRejected;
  // Oude finally mag de nieuwe pending niet wissen.
  assert.equal(f.read(), b); assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ stukken: [{ naam: 'Privé B' }] });
  assert.equal((await b).stukken[0].naam, 'Privé B');
  f.set(child('a', 'ta')); const opnieuw = f.read();
  assert.equal(f.requests.length, 3); f.requests[2].resolve({ stukken: [] }); await opnieuw;
  f.module.destroy();
});
test('profielmetadata zonder event, storage en destroy maken ook late antwoorden ongeldig', async () => {
  const f = fixture();
  const a = f.read(), pa = changed(a);
  f.set({ ...child(), profiel: { ...child().profiel, leeftijdBevestigd: false } }, false);
  f.requests[0].resolve({ stukken: [{ naam: 'Te laat' }] }); await pa;
  await denied(f.read());
  f.set(child()); const b = f.read(), pb = changed(b);
  f.storage('rtf_sessie'); f.requests[1].resolve({ stukken: [] }); await pb;
  const c = f.read(), pc = changed(c); f.module.destroy();
  f.requests[2].resolve({ stukken: [] }); await pc; await changed(f.read());
});
test('cacheantwoord wordt niet na een synchrone profielwissel alsnog geleverd', async () => {
  const f = fixture(); const p = f.read(); f.requests[0].resolve({ stukken: [{ naam: 'A' }] }); await p;
  const cache = f.read(), rejected = changed(cache); f.set(child('b', 'tb')); await rejected;
  f.module.destroy();
});

test('memberwisseling weigert verse aanvraag, cache en late callback via runtimecontract', async () => {
  const f = fixture(null);
  const eerste = f.read('notities'); f.requests[0].resolve({ lijsten: ['Privé A'] }); await eerste;
  const cache = f.read('notities'), cacheNee = changed(cache);
  const bezig = f.read('agenda'), bezigNee = changed(bezig);
  f.memberChanged();
  await cacheNee;
  f.requests[1].resolve({ afspraken: ['Privé A'] }); await bezigNee;
  await changed(f.read('notities')); await changed(f.read('agenda', true));
  assert.equal(f.requests.length, 2); f.module.destroy();
});
test('ontbrekend member-sessioncontract faalt gesloten; familie blijft eigen grens gebruiken', async () => {
  const f = fixture(); delete f.session.unchanged;
  await changed(f.read('notities')); assert.equal(f.requests.length, 0);
  const familie = f.read('foundation-agenda');
  f.requests[0].resolve({ afspraken: [] }); await familie;
  f.module.destroy();
});
