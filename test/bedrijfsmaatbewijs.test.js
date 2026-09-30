/* BEWIJS BIJ VIER BEDRIJFSMATEN -- groei.leden-per-pas, acquisitie.via-werkgever,
   campagnes.rtf-werving en geo.rtf-steden (AUTONOMIE.md par. 1: een maat bestaat
   pas als zijn antwoord zegt hoe hard het is en wanneer het gepeild werd).

   Vijf beweringen, en alle vijf kunnen ze zakken:
   1. het ledenregister draagt graad en peilmoment, en zegt dat het NIET afkapte;
   2. leest het register zijn maximum en zijn er meer leden, dan zegt het dat --
      en de marge per lid krijgt dan geen noemer (omzetPerPas geeft null);
   3. de RTF-campagnes zijn vermoed, met de reden (geboekt, niet van de bank);
   4. de stedenboom is gemeten, met een peilmoment;
   5. betalingen met een onbekende afloop komen uit de betaalwaarheid, of met een
      reden -- nooit een nul omdat niemand keek.

   Draai: node --test test/bedrijfsmaatbewijs.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function register(rijen, totaal) {
  return require('../server/kern/ledenregister')({ accounts: { ledenRegisterRijen: (n) => rijen.slice(0, n) },
    onboarding: { store: () => ({ profielen: {} }) }, geldPasprijzen: () => null,
    ledenAantal: () => totaal, db: { data: { contracten: [] } } }).ledenregister;
}
const lid = (i) => ({ id: i, key: 'user-' + i, tier: 'rtg', codename: 'Lid' + i });

test('1. het register draagt graad en peilmoment, en zegt dat het niet afkapte', () => {
  const r = register([lid(1), lid(2)], 2).register();
  assert.equal(r.graad, 'gemeten');
  assert.ok(!Number.isNaN(Date.parse(r.peilmoment)), 'een peilmoment dat een datum is');
  assert.equal(r.afgekapt, false);
  assert.equal(r.dektNiet.length, 1, 'alleen de zin over opgegeven land en stad (C16)');
  assert.match(r.dektNiet[0], /opgegeven/);
});

test('2. een register dat zijn maximum las, zegt dat, en levert geen noemer voor de marge', () => {
  const rijen = Array.from({ length: 20000 }, (_, i) => lid(i));
  const reg = register(rijen, 20001);
  const r = reg.register();
  assert.equal(r.afgekapt, true);
  assert.match(r.dektNiet.join(' '), /ondergrens/);
  assert.equal(reg.omzetPerPas(), null, 'een noemer die niet alle leden telt, is geen noemer');
  /* precies het maximum en niet meer leden: dan is er niets afgekapt */
  assert.equal(register(rijen, 20000).register().afgekapt, false);
});

test('5. betalingen met een onbekende afloop: de telling van de betaalwaarheid, of een reden', () => {
  const RISICO = require('../server/kern/bedrijfsmaat/stand-risico');
  const maat = (id, def, uit, dekt) => Object.assign({ id, definitie: def, dektNiet: dekt }, uit);
  const m = RISICO({ maat, betalingen: () => ({ onbekend: 2, onbekendeCenten: 1300, escalatie: 1, controleNodig: 3, oudsteAt: 'x' }) });
  assert.equal(m.stand, 'TOONBAAR');
  assert.equal(m.waarde, 2);
  assert.equal(m.onbekendeCenten, 1300);
  assert.equal(m.escalatie, 1);
  assert.equal(m.controleNodig, 3);
  for (const weg of [() => null, () => { throw new Error('stuk'); }, undefined]) {
    const n = RISICO({ maat, betalingen: weg });
    assert.equal(n.stand, 'NIET_UIT_TE_REKENEN');
    assert.equal(n.waarde, null, 'geen nul omdat niemand keek');
  }
});

let srv;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bmbewijs-'));
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });
async function api(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('3 en 4. de RTF-campagnes zijn vermoed met de reden, de stedenboom gemeten', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  /* op naam: de campagnes vragen wie er kijkt, en de gedeelde code is niemand */
  const kantoor = await kantoorAlsPersoon(srv.base);
  assert.ok(kantoor, 'het kantoor is binnen, op naam');
  const c = await api('/api/rtfos/campagnes', {}, kantoor);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.graad, 'vermoed');
  assert.ok(!Number.isNaN(Date.parse(c.body.peilmoment)));
  assert.match(c.body.dektNiet.join(' '), /niet tegen een bankafschrift/);
  const b = await api('/api/rtfos/boom', {}, kantoor);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.graad, 'gemeten');
  assert.ok(!Number.isNaN(Date.parse(b.body.peilmoment)));
  assert.ok(Array.isArray(b.body.dektNiet));
});
