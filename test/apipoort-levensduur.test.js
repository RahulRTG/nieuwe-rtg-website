/* De machinesleutel van de API-poort als gemigreerde credential
   (CODECREDENTIALS.json, command.api_machinesleutel).

   Wat hier moet kunnen zakken:
   1. ELKE SLEUTEL VERVALT: zonder `dagen` de standaard (90), nooit meer dan 365,
      en een ongeldige dagtelling wordt geweigerd in plaats van afgekapt.
   2. UITGEVEN OP NAAM: een lege of gedeelde uitgever krijgt geen sleutel; over
      HTTP geeft de gedeelde kantoorcode 403 en een kantoormens op naam 200.
   3. ROTEREN trekt de vorige in dezelfde ronde in, en een tweede rotatie op
      dezelfde id is 409 -- het geheim komt nooit twee keer.
   4. EEN SLEUTEL VAN VOOR DE REGEL (vervalt null) geldt tot LEGACY_TOT en niet
      langer; "nooit" bestaat niet meer.
   5. GEBRUIK WORDT GETELD (niet begrensd -- dat doen quotum en vervaldatum).

   MUTATIES (LAT.md regel 2), elk gedraaid en gezakt:
   - apipoort-levensduur.js geldigheid(): DAGEN_MAX-controle weg -> toets 1 zakt
   - uitgifteFout(): de controle op de gedeelde code weg -> toets 2 zakt
   - apipoort-controle.js: `if (!(Date.parse(vervaltVan(s)) > t))` terug naar
     `if (s.vervalt && ...)` -> toets 4 zakt
   - maakRoteer(): `oud.ingetrokken = ...` weg -> toets 3 zakt
   - inrichten.js: naamAuth op /sleutel terug naar officeAuth -> toets 6 zakt
   - apipoort-controle.js: `s.gebruik = ...` weg -> toets 5 zakt

   Draai los: node --test test/apipoort-levensduur.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { maakApiPoort } = require('../server/kern/command/apipoort');
const L = require('../server/kern/command/apipoort-levensduur');
const maakCmdOpslag = require('../server/kern/command/opslag');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const DAG = 86400000;
function maak() {
  const db = { data: {} };
  const poort = maakApiPoort({ db, opslag: maakCmdOpslag({ db }), save: () => {}, crypto, journaal: null });
  poort.laatToe('/api/extern/aanbod', { versie: 'v1' }, 'ik');
  return { db, poort };
}
const SCOPE = [{ pad: '/api/extern/aanbod', methoden: ['GET'] }];

test('1. elke sleutel vervalt: standaard 90 dagen, hoogstens 365, en een ongeldige telling wordt geweigerd', () => {
  const { poort } = maak();
  const t0 = Date.now();
  const r = poort.maak('K', SCOPE, { door: 'user-1' });
  const tot = Date.parse(r.sleutel.vervalt);
  assert.ok(Math.abs(tot - (t0 + L.DAGEN_STANDAARD * DAG)) < 60000, 'zonder dagen de standaard');
  assert.equal(r.sleutel.legacy, false);
  assert.equal(r.sleutel.issuer, 'rtg.command.apipoort');
  assert.equal(r.sleutel.doel, 'api-koppeling');
  for (const fout of [0, -3, 1.5, 366, 'altijd', 100000])
    assert.equal(poort.maak('K', SCOPE, { door: 'user-1', dagen: fout }).status, 400, 'dagen ' + fout + ' hoort te weigeren');
  const max = poort.maak('K', SCOPE, { door: 'user-1', dagen: 365 });
  assert.ok(max.geheim, '365 dagen mag');
  assert.equal(poort.apiSleutelOk(max.geheim, '/api/extern/aanbod', 'GET', t0 + 366 * DAG).status, 401,
    'na de vervaldatum komt hij er niet meer in');
});

test('2. uitgeven gebeurt op naam: een lege of gedeelde uitgever krijgt niets', () => {
  const { poort } = maak();
  assert.equal(poort.maak('K', SCOPE, {}).status, 403);
  assert.equal(poort.maak('K', SCOPE, { door: 'kantoor (gedeelde code)' }).status, 403);
  assert.equal(poort.stand().sleutels.length, 0, 'er is geen sleutel gemaakt');
});

test('3. roteren trekt de vorige in dezelfde ronde in, en het geheim komt nooit twee keer', () => {
  const { poort } = maak();
  const r = poort.maak('K', SCOPE, { door: 'user-1', eigenaar: 'partner', quotaPerUur: 7 });
  const n = poort.roteer(r.sleutel.id, { door: 'user-2' });
  assert.ok(n.geheim && n.geheim !== r.geheim, 'een nieuw geheim');
  assert.deepEqual(n.sleutel.scopes, r.sleutel.scopes, 'zelfde scope');
  assert.equal(n.sleutel.quotaPerUur, 7);
  assert.match(n.vorige.ingetrokken.reden, /geroteerd/);
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').status, 401, 'de oude opent niets meer');
  assert.equal(poort.apiSleutelOk(n.geheim, '/api/extern/aanbod', 'GET').ok, true, 'de nieuwe wel');
  const nogEens = poort.roteer(r.sleutel.id, { door: 'user-2' });
  assert.equal(nogEens.status, 409);
  assert.equal(nogEens.geheim, undefined);
  assert.equal(poort.roteer('bestaatniet', { door: 'user-2' }).status, 404);
  assert.equal(poort.roteer(n.sleutel.id, { door: 'kantoor (gedeelde code)' }).status, 403,
    'ook roteren doet een mens op naam');
});

test('4. een sleutel van voor de regel geldt tot de legacydatum, niet langer', () => {
  const { db, poort } = maak();
  const r = poort.maak('Oud', SCOPE, { door: 'user-1' });
  db.data.apiPoort.sleutels[r.sleutel.id].vervalt = null;   // zo stond hij er voor de migratie
  const st = poort.stand().sleutels[0];
  assert.equal(st.legacy, true);
  assert.equal(st.vervalt, L.LEGACY_TOT);
  const voor = Date.parse(L.LEGACY_TOT) - DAG, na = Date.parse(L.LEGACY_TOT) + 1000;
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET', voor).ok, true, 'hij werkt nog: de koppeling breekt niet vandaag');
  assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET', na).status, 401, 'maar niet meer na de legacydatum');
});

test('5. gebruik wordt geteld', () => {
  const { poort } = maak();
  const r = poort.maak('K', SCOPE, { door: 'user-1' });
  for (let i = 0; i < 3; i++) assert.equal(poort.apiSleutelOk(r.geheim, '/api/extern/aanbod', 'GET').ok, true);
  poort.apiSleutelOk(r.geheim.slice(0, -2) + 'xx', '/api/extern/aanbod', 'GET');
  assert.equal(poort.stand().sleutels[0].gebruik, 3, 'drie geslaagde verzoeken, een geweigerd telt niet');
});

test('6. over HTTP: de gedeelde kantoorcode geeft niets uit, een kantoormens op naam wel, en roteren sluit de oude', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-apisl-'));
  const CODE = 'KANTOOR-APISL-1';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  const post = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {}) })
    .then(async x => ({ status: x.status, koppen: x.headers, body: await x.json().catch(() => ({})) }));
  try {
    const gedeeld = (await post('/api/office/login', { code: CODE })).body.token;
    assert.ok(gedeeld);
    const naam = await kantoorAlsPersoon(srv.base, CODE);
    assert.ok(naam, 'een kantoorsessie op naam');
    assert.equal((await post('/api/command/apipoort/toelaten', { pad: '/api/extern/levensduur' }, gedeeld)).status, 200);
    const scopes = [{ pad: '/api/extern/levensduur', methoden: ['GET'] }];
    const geweigerd = await post('/api/command/apipoort/sleutel', { naam: 'X', scopes }, gedeeld);
    assert.equal(geweigerd.status, 403, 'de gedeelde code geeft geen machinesleutel uit');
    assert.equal(geweigerd.body.watNu, 'inloggen-op-naam');
    assert.equal((await post('/api/command/apipoort/sleutel', { naam: 'X', scopes, dagen: 400 }, naam)).status, 400);
    const s = await post('/api/command/apipoort/sleutel', { naam: 'X', scopes, dagen: 30 }, naam);
    assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 200));
    assert.match(s.koppen.get('cache-control') || '', /no-store/, 'een eenmalig geheim gaat nooit een cache in');
    assert.ok(Date.parse(s.body.sleutel.vervalt) < Date.now() + 31 * DAG);
    assert.equal((await post('/api/command/apipoort/roteer', { id: s.body.sleutel.id }, gedeeld)).status, 403);
    const n = await post('/api/command/apipoort/roteer', { id: s.body.sleutel.id }, naam);
    assert.equal(n.status, 200, JSON.stringify(n.body).slice(0, 200));
    const extern = (geheim) => fetch(srv.base + '/api/extern/levensduur', { headers: { authorization: 'Bearer ' + geheim } }).then(x => x.status);
    assert.equal(await extern(s.body.geheim), 401, 'de oude sleutel is na het roteren dicht');
    assert.notEqual(await extern(n.body.geheim), 401, 'de nieuwe komt langs de poort');
    assert.equal((await post('/api/command/apipoort/roteer', { id: s.body.sleutel.id }, naam)).status, 409);
    assert.equal((await post('/api/command/apipoort/intrekken', { id: n.body.sleutel.id, reden: 'klaar' }, gedeeld)).status, 200,
      'intrekken blijft bij elke kantoorsessie: dichtdoen is de makkelijke kant op');
  } finally { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
