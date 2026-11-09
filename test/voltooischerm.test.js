'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toets } = require('../scripts/lib/voltooischerm');
const { sluitDeel, controleerBrowserResultaat, scenarios } = require('../scripts/voltooiproef');

const drie = () => [1, 2, 3].map(nr => ({ nr, wat: 'testschakel ' + nr, stand: 'gesloten' }));
const drieBrowser = () => drie().map((s, i) => ({ ...s,
  herstartsVoor: i ? { netjes: 1, crash: 1 } : { netjes: 0, crash: 0 } }));
test('de runner weigert te weinig schakels en niet-uitgevoerde herstelproeven', () => {
  for (const b of ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk']) {
    assert.equal(sluitDeel(b, drie(), { netjes: 1, crash: 1 }, null).sluit, true);
    assert.equal(sluitDeel(b, drie().slice(0, 1), { netjes: 1, crash: 1 }, null).sluit, false);
    assert.equal(sluitDeel(b, drie(), { netjes: 1, crash: 1 }, 'afgebroken').sluit, false);
  }
  assert.equal(sluitDeel('persistent', drie(), { netjes: 0, crash: 1 }, null).sluit, false);
  assert.equal(sluitDeel('herstelbaar', drie(), { netjes: 1, crash: 0 }, null).sluit, false);
  assert.equal(sluitDeel('voltooibaar', [...drie(), { stand: 'stuk' }], {}, null).sluit, false);
});

test('browserbewijs koppelt een geslaagde schakel aan het werkelijke herstartepoch', () => {
  assert.equal(sluitDeel('persistent', drieBrowser(), { netjes: 1, crash: 1 }, null, true).sluit, true);
  assert.equal(sluitDeel('herstelbaar', drieBrowser(), { netjes: 1, crash: 1 }, null, true).sluit, true);

  const alleenVoorHerstart = drieBrowser();
  for (const s of alleenVoorHerstart) s.herstartsVoor.netjes = 0;
  assert.equal(sluitDeel('persistent', alleenVoorHerstart, { netjes: 1, crash: 1 }, null, true).sluit, false);

  const toekomst = drieBrowser();
  toekomst[1].herstartsVoor.crash = 2;
  assert.equal(sluitDeel('herstelbaar', toekomst, { netjes: 1, crash: 1 }, null, true).sluit, false);

  const ontbreekt = drieBrowser();
  delete ontbreekt[1].herstartsVoor;
  assert.equal(sluitDeel('persistent', ontbreekt, { netjes: 1, crash: 1 }, null, true).sluit, false);
});

function browserFixture() {
  const sc = scenarios('juridisch')[0];
  const scherm = require('../scripts/lib/appcontract').CONTRACT[sc.functie].persistent.scherm;
  const uit = { scenario: sc.bestand, ingang: sc.ingang, kanaal: 'browser', afgebroken: null,
    herstarts: { netjes: 1, crash: 1 },
    browser: { ingang: sc.ingang, bezocht: [sc.ingang, ...scherm.bestemmingen],
      toestanden: [{ pad: sc.ingang, selector: scherm.toestand, zichtbaar: true }], fouten: [], documentfouten: [] } };
  for (const b of ['voltooibaar', 'persistent', 'herstelbaar', 'menselijk'])
    uit[b] = sluitDeel(b, drieBrowser(), uit.herstarts, null, true);
  uit.menselijk.kanaal = 'browser';
  return { sc, uit };
}
test('de runner gebruikt dezelfde browserbinding vóór vastleggen als de APPWERKT-lezer', () => {
  const { sc, uit } = browserFixture();
  assert.equal(controleerBrowserResultaat(sc, uit), null);
  for (const wijzig of [
    a => { a.browser = null; },
    a => { a.browser.ingang = '/apps/ander.html'; },
    a => { a.browser.bezocht.pop(); },
    a => { a.browser.toestanden = []; },
    a => { a.browser.fouten.push('TypeError'); },
    a => { a.browser.documentfouten.push({ pad: '/apps/juridisch.html', status: 500 }); },
    a => { a.herstarts.crash = 0; },
    a => { a.menselijk.schakels = []; }
  ]) {
    const f = browserFixture(); wijzig(f.uit);
    assert.ok(controleerBrowserResultaat(f.sc, f.uit));
  }
});

test('browserketen legt de oorspronkelijke fout vast en stopt vóór afhankelijke vervolgacties', async () => {
  const fout = new Error('de verwachte schermtoestand ontbreekt');
  const boek = [];
  let vervolg = false;
  const stap = async (bewijs, wat, fn) => {
    try { boek.push({ bewijs, wat, uit: await fn() }); }
    catch (e) { boek.push({ bewijs, wat, fout: e }); }
  };
  await assert.rejects(async () => {
    await toets(stap, 'persistent', 'heropenen', async () => { throw fout; });
    vervolg = true;
  }, e => e === fout);
  assert.equal(vervolg, false);
  assert.deepEqual(boek, [{ bewijs: 'persistent', wat: 'heropenen', fout }]);
});

test('geslaagde browserstap behoudt de daadwerkelijk geobserveerde uitkomst', async () => {
  let opgeslagen;
  const resultaat = { resolutie: [640, 480] };
  await toets(async (_bewijs, _wat, fn) => { opgeslagen = await fn(); },
    'voltooibaar', 'export', async () => resultaat);
  assert.deepEqual(opgeslagen, { klopt: true, ziet: resultaat });
});
