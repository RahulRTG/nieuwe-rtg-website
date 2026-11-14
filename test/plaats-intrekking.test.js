'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { fixture, fix, weiger, tick } = require('./lib/plek-fixture');
const hek = { id: 'leverancier:Z', soort: 'punt', punten: [{ lat: 52.37, lng: 4.9 }], straalM: 100 };
const pass = () => ({ ok: true, pass: { zaak: { code: 'Z', naam: 'Zaak' }, vervaltAt: '2099-01-01', pulse: 'nog-niet-onderweg' } });

/* Drie echte eigenaars, met uitsluitend DOM/GPS en HTTP als testgrenzen.
   Een gestopte GPS-watcher alleen bewijst niet dat zijn al lopende Arrival-
   controle is afgebroken. Daarom blijft het passantwoord hier onderweg. */
function keten() {
  const e = fixture({ key: '1' }), requests = [];
  const opslag = { rtg_member_token: 'A', rtg_arrival_pass: JSON.stringify({ p: 'P', tot: '2099-01-01' }) };
  const window = { RTGPlek: e.api, addEventListener() {} };
  e.document.readyState = 'loading'; e.document.addEventListener = () => {};
  const context = vm.createContext({ window, document: e.document, Date, Promise,
    localStorage: { getItem: k => opslag[k] || null },
    fetch: (url, opt) => new Promise(resolve => requests.push({ url, body: JSON.parse(opt.body),
      reply: body => resolve({ ok: true, json: async () => body }) }))
  });
  for (const naam of ['plaats', 'plaatsnadering'])
    vm.runInContext(fs.readFileSync('public/shared/' + naam + '.js', 'utf8'), context);
  return { ...e, window, requests };
}
async function onderweg(e) {
  const gestart = e.window.RTGPlaatsNadering.ronde();
  e.requests[0].reply(pass()); await tick(); e.node('.ja').click(); await tick();
  e.requests[1].reply(pass()); await tick(); e.requests[2].reply({ status: 200 }); await tick();
  e.requests[3].reply({ status: 200, hekken: [hek] }); await gestart;
  assert.equal(e.watches.length, 1);
  fix(e.watches[0]); await tick();
  assert.equal(e.requests[4].url, '/api/plaats/waarneem');
  assert.equal(e.requests[5].url, '/api/arrival/pass');
  e.requests[4].reply({ status: 200 });
}

test('echte Plek → Plaats → Nadering blijft zonder intrekking één puls leveren', async () => {
  const e = keten(); await onderweg(e);
  e.requests[5].reply(pass()); await tick();
  assert.equal(e.requests[6].url, '/api/arrival/pulse');
  assert.deepEqual(e.requests[6].body, { pass: 'P', pulse: 'in-de-buurt' });
  e.requests[6].reply({ ok: true }); await tick();
  assert.deepEqual(e.clears, [0]);
});

for (const variant of ['uit', 'uit-en-weer-aan', 'toestel-weigert']) {
  test('oude Arrival-controle blijft geannuleerd na ' + variant, async () => {
    const e = keten(); await onderweg(e);
    if (variant === 'toestel-weigert') weiger(e.watches[0]);
    else await e.api.zetAan(false);
    assert.deepEqual(e.clears, [0]);
    assert.equal(e.window.RTGPlaats.stand().doel, null);
    if (variant === 'uit-en-weer-aan') {
      const aan = e.api.zetAan(true); assert.equal(e.gets.length, 1);
      fix(e.gets[0]); assert.equal(await aan, true);
      assert.equal(e.api.aan(), true, 'oude poging blijft ongeldig bij opnieuw geldige GPS');
    }
    fix(e.watches[0]); e.requests[5].reply(pass()); await tick();
    assert.equal(e.requests.length, 6, 'geen oude waarneming of automatische puls na intrekking');
    assert.equal(e.requests.some(r => r.url === '/api/arrival/pulse'), false);
    assert.deepEqual(e.clears, [0], 'één opruiming van de bestaande watcher');
  });
}

test('laat intrekkingssignaal van oude plaatsgeneratie stopt de nieuwe niet', async () => {
  const e = keten(), handlers = []; let oud = 0, nieuw = 0;
  e.window.RTGPlek = { toestemmingVersie: () => 0, volg(cb, opties) { handlers.push(opties.bijIntrekken); return () => {}; } };
  const a = e.window.RTGPlaats.start('nadering', { bijIntrekken: () => oud++ });
  e.requests[0].reply({ hekken: [hek] }); await a;
  const b = e.window.RTGPlaats.start('dienst', { bijIntrekken: () => nieuw++ });
  e.requests[1].reply({ hekken: [hek] }); await b;
  handlers[0]();
  assert.equal(e.window.RTGPlaats.stand().doel, 'dienst');
  assert.equal(oud, 0); assert.equal(nieuw, 0);
  handlers[1](); handlers[1]();
  assert.equal(e.window.RTGPlaats.stand().doel, null);
  assert.equal(nieuw, 1, 'alleen de actuele eigenaar ontvangt de intrekking, eenmaal');
});

test('intrekking tijdens ophalen hekken blijft definitief; nieuwe bewuste start werkt', async () => {
  const e = keten(); let ingetrokken = 0;
  const oud = e.window.RTGPlaats.start('nadering', { bijIntrekken: () => ingetrokken++ });
  assert.equal(e.requests[0].url, '/api/plaats/hekken');
  await e.api.zetAan(false);
  const aan = e.api.zetAan(true); fix(e.gets[0]); assert.equal(await aan, true);
  e.requests[0].reply({ hekken: [hek] });
  assert.equal((await oud).ok, false);
  assert.equal(e.watches.length, 0, 'oude hekkenrespons krijgt geen nieuwe GPS-toestemming');
  assert.equal(e.window.RTGPlaats.stand().doel, null); assert.equal(ingetrokken, 1);
  const nieuw = e.window.RTGPlaats.start('nadering');
  e.requests[1].reply({ hekken: [hek] }); assert.equal((await nieuw).ok, true);
  assert.equal(e.watches.length, 1);
  fix(e.watches[0]); await tick();
  assert.equal(e.requests[2].url, '/api/plaats/waarneem');
  e.requests[2].reply({ status: 200 });
  e.window.RTGPlaats.stop(); assert.deepEqual(e.clears, [0]);
});

test('plaats zonder aantoonbare toestemmingsversie start fail-closed geen GPS of verzoek', async () => {
  const e = keten();
  delete e.api.toestemmingVersie;
  assert.equal((await e.window.RTGPlaats.start('nadering')).ok, false);
  await e.window.RTGPlaatsNadering.ronde();
  assert.equal(e.requests.length, 0); assert.equal(e.watches.length, 0);
});

for (const stap of ['pass', 'hercontrole', 'venster']) {
  test('Arrival vóór motorstart bindt ook pending ' + stap + ' aan de oorspronkelijke toestemming', async () => {
    const e = keten(), ronde = e.window.RTGPlaatsNadering.ronde();
    if (stap !== 'pass') {
      e.requests[0].reply(pass()); await tick(); e.node('.ja').click(); await tick();
    }
    if (stap === 'venster') { e.requests[1].reply(pass()); await tick(); }
    const verwacht = stap === 'pass' ? 1 : stap === 'hercontrole' ? 2 : 3;
    assert.equal(e.requests.length, verwacht);
    await e.api.zetAan(false);
    const aan = e.api.zetAan(true); fix(e.gets[0]); assert.equal(await aan, true);
    e.requests.at(-1).reply(stap === 'venster' ? { status: 200 } : pass()); await ronde;
    assert.equal(e.requests.length, verwacht, 'geen vervolgverzoek uit de oude poging');
    assert.equal(e.watches.length, 0); assert.equal(e.node('.rtgnader'), null);
    assert.equal(e.window.RTGPlaats.stand().doel, null);
  });
}
