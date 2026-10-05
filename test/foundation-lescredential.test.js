/* De lescredentials van RTFoundation-onderwijs (B17, CODECREDENTIALS.json
   foundation.onderwijs_les_tokens) op moduleniveau: vorm, hash-only, verval,
   de claim met zijn plafond, intrekken en roteren, en dat een kind geen profiel
   is. De echte server staat in test/foundation-lescredential-server.test.js, de
   race over twee PostgreSQL-instances in test/foundation-lescredential.pg.test.js.

   Draai los: node --test test/foundation-lescredential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const T = require('../server/foundation/onderwijs/toegang');
/* De sleutels zijn bearercode v2: wie een beveiligingsveld met de hand zet, krijgt
   `gemanipuleerd`. Om de doel-, verval- en plafondcontrole ZELF te raken, tekent
   de proef de contracthash na zo'n ingreep opnieuw. */
const herteken = t => { t.contracthash = require('../server/kern/bearercode')({ crypto, namespace: 'foundation-les' }).contracthash(t); };

function wereld() {
  let klok = Date.parse('2026-09-29T08:00:00Z');
  const db = { data: {} };
  const bewerkCollectie = (k, werk) => {
    const w = JSON.parse(JSON.stringify(db.data[k] || {}));
    const r = werk(w); db.data[k] = w; return r;
  };
  const t = T({ db, crypto, bewerkCollectie, nu: () => new Date(klok).toISOString() });
  return { db, t, schuif: ms => { klok += ms; }, rij: id => db.data[T.COLLECTIE][id] };
}

test('128 bits, hash-only, met issuer, doel, scope, onderwerp en verval; geen naam in de sleutel', async () => {
  const { db, t, rij } = wereld();
  const les = await t.nieuweLes();
  assert.match(les.lescode, /^LES\.[0-9A-F]{32}$/);
  assert.match(les.token, /^LESLR\.[0-9A-F]{32}$/);
  const mee = await t.claim(les.lescode);
  assert.match(mee.token, /^LESLL\.[0-9A-F]{32}$/);
  const json = JSON.stringify(db.data);
  for (const kaal of [les.lescode, les.token, mee.token])
    assert.equal(json.includes(kaal.split('.')[1]), false, 'een kale code staat op schijf');
  const r = rij(les.lesId);
  assert.equal(r.lescode.doel, T.DOEL.lescode);
  assert.deepEqual(r.leraar.scope, T.SCOPE.leraar);
  assert.equal(r.leraar.issuer, 'rtfoundation-onderwijs');
  assert.equal(Date.parse(r.expires_at) - Date.parse(r.issued_at), T.GELDIG_MS);
  assert.deepEqual(Object.keys(r.leerlingen[mee.studentId].onderwerp).sort(), ['leerling', 'les', 'rol', 'soort']);
  assert.equal(r.lescode.gebruik, 1, 'de claim telt');
});

test('vanSleutel: de sleutel van DEZE les en DEZE rol, en verder niets', async () => {
  const { t } = wereld();
  const a = await t.nieuweLes(), b = await t.nieuweLes();
  const ka = await t.claim(a.lescode);
  assert.deepEqual(t.vanSleutel(a.lesId, a.token), { rol: 'leraar', studentId: null, lesId: a.lesId });
  assert.equal(t.vanSleutel(a.lesId, ka.token).rol, 'leerling');
  assert.equal(t.vanSleutel(b.lesId, a.token).reden, 'sleutel', 'een sleutel van een andere les');
  assert.equal(t.vanSleutel(a.lesId, a.lescode).reden, 'sleutel', 'de lescode is geen leraarssleutel');
  assert.equal(t.vanSleutel(a.lesId, '').reden, 'sleutel');
  assert.equal(t.vanSleutel('les-bestaat-niet', a.token).reden, 'onbekend');
  assert.equal(t.vanSleutel('__proto__', a.token).reden, 'onbekend');
});

test('een sleutel met het verkeerde doel of een eigen verval opent niets, ook als de hash klopt', async () => {
  const { t, rij } = wereld();
  const les = await t.nieuweLes();
  const k = await t.claim(les.lescode);
  rij(les.lesId).leerlingen[k.studentId].doel = T.DOEL.lescode;
  assert.equal(t.vanSleutel(les.lesId, k.token).reden, 'gemanipuleerd', 'een overschreven doel is dicht');
  herteken(rij(les.lesId).leerlingen[k.studentId]);
  assert.equal(t.vanSleutel(les.lesId, k.token).reden, 'verkeerd-doel');
  rij(les.lesId).leraar.expires_at = '2020-01-01T00:00:00.000Z';
  herteken(rij(les.lesId).leraar);
  assert.equal(t.vanSleutel(les.lesId, les.token).reden, 'verlopen');
});

test('verval: na twaalf uur opent geen van de drie nog iets', async () => {
  const { t, schuif } = wereld();
  const les = await t.nieuweLes();
  const k = await t.claim(les.lescode);
  schuif(T.GELDIG_MS + 1000);
  assert.equal(t.vanSleutel(les.lesId, les.token).reden, 'afgelopen');
  assert.equal(t.vanSleutel(les.lesId, k.token).reden, 'afgelopen');
  assert.equal((await t.claim(les.lescode)).status, 410);
});

test('het plafond: meer dan max_gebruik komt er niet in, en een bezwaar verbruikt niets', async () => {
  const { db, t, rij } = wereld();
  const les = await t.nieuweLes();
  db.data[T.COLLECTIE][les.lesId].lescode.max_gebruik = 2;
  herteken(db.data[T.COLLECTIE][les.lesId].lescode);
  const bezwaar = await t.claim(les.lescode, () => 'naam bezet');
  assert.equal(bezwaar.status, 409);
  assert.equal(rij(les.lesId).lescode.gebruik, 0, 'een geweigerde claim telt niet');
  assert.ok((await t.claim(les.lescode)).ok);
  assert.ok((await t.claim(les.lescode)).ok);
  const derde = await t.claim(les.lescode);
  assert.equal(derde.status, 409);
  assert.equal(derde.token, undefined);
  assert.equal(rij(les.lesId).lescode.gebruik, 2);
});

test('roteren, intrekken en sluiten doet alleen de leraar, en het werkt', async () => {
  const { t } = wereld();
  const les = await t.nieuweLes();
  const k = await t.claim(les.lescode);
  assert.equal((await t.roteerLescode(les.lesId, k.token)).status, 403, 'een leerling roteert niet');
  const r = await t.roteerLescode(les.lesId, les.token);
  assert.match(r.lescode, /^LES\.[0-9A-F]{32}$/);
  assert.equal((await t.claim(les.lescode)).status, 410, 'de oude lescode is vervangen');
  assert.ok((await t.claim(r.lescode)).ok, 'de nieuwe werkt');
  assert.equal(t.vanSleutel(les.lesId, k.token).rol, 'leerling', 'wie al meedeed houdt zijn sleutel');
  assert.ok((await t.intrekLescode(les.lesId, les.token)).ok);
  assert.equal((await t.claim(r.lescode)).status, 410);
  assert.ok((await t.intrekLeerling(les.lesId, les.token, k.studentId)).ok);
  assert.equal(t.vanSleutel(les.lesId, k.token).reden, 'ingetrokken');
  assert.ok((await t.sluit(les.lesId, les.token)).ok);
  assert.equal(t.vanSleutel(les.lesId, les.token).reden, 'afgelopen');
  assert.equal((await t.sluit(les.lesId, les.token)).status, 410);
});

test('dezelfde idem maakt geen tweede les en toont niets opnieuw', async () => {
  const { t } = wereld();
  const een = await t.nieuweLes({ idem: 'klik-1' });
  const twee = await t.nieuweLes({ idem: 'klik-1' });
  assert.ok(een.ok);
  assert.equal(twee.status, 409);
  assert.equal(twee.lescode, undefined);
  assert.equal(twee.token, undefined);
});

test('in productie zonder collectietransactie weigert de laag in plaats van terug te vallen', async () => {
  const t = T({ db: { data: {} }, crypto, productie: true });
  await assert.rejects(() => t.claim('LES.' + '0'.repeat(32)), /geen collectietransactie/);
});

/* OUDE LESSEN (van voor B17) OPENEN NIETS MEER, en hun kale tokens gaan van
   schijf. Hier op de echte module foundation/onderwijs.js met een nagebouwde
   router, omdat een les van voor de migratie niet langs een route te maken is. */
test('een les van voor de migratie: de oude code en tokens openen niets, en ze gaan van schijf', async () => {
  const h = {};
  const data = { foundation: { lessen: { OUDECODE: { code: 'OUDECODE', vak: 'Oud', teacherToken: 'a'.repeat(48),
    leerlingen: { s1: { studentId: 's1', naam: 'Oud', token: 'b'.repeat(48), schrift: { pages: [] } } },
    bord: { strokes: [] }, opgaven: [], agenda: [] } } } };
  const db = { data };
  require('../server/foundation/onderwijs')({ db, crypto, save() {}, F: () => data.foundation,
    router: { post: (p, f) => { h['POST ' + p] = f; }, get: (p, f) => { h['GET ' + p] = f; } },
    bewerkCollectie: (k, werk) => { const w = JSON.parse(JSON.stringify(db.data[k] || {})); const r = werk(w); db.data[k] = w; return r; },
    nu: () => new Date().toISOString(), rid: n => crypto.randomBytes(n || 3).toString('hex'),
    schoon: (v, n = 200) => String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, n).trim(),
    anthropic: null, SYSTEM: '', DEMO: ['x'], TIPS: ['t'], teVaak: () => false, misluktePoging() {},
    goedePoging() {}, ipVan: () => '10.0.0.1' });
  const roep = (sleutel, req) => new Promise(resolve => {
    const res = { statusCode: 200, set() { return res; }, status(s) { res.statusCode = s; return res; },
      json(b) { res.body = b; resolve(res); return res; }, end() { resolve(res); } };
    Promise.resolve(h[sleutel](Object.assign({ body: {}, params: {}, query: {}, get: () => '' }, req), res));
  });
  const oud = await roep('GET /bord/:code', { params: { code: 'OUDECODE' }, query: { token: 'a'.repeat(48) } });
  assert.equal(oud.statusCode, 404, 'het oude leraarstoken opent het bord niet meer: de les heeft geen credential');
  assert.equal((await roep('POST /les/join', { body: { lescode: 'OUDECODE', naam: 'X' } })).statusCode, 404);
  const nieuw = await roep('POST /les/maak', { body: { vak: 'Nieuw', naam: 'Juf' } });
  assert.equal(nieuw.statusCode, 200);
  const json = JSON.stringify(data.foundation);
  assert.equal(json.includes('a'.repeat(48)) || json.includes('b'.repeat(48)), false, 'kale oude tokens op schijf');
  assert.equal(Object.keys(data.foundation.lessen).includes('OUDECODE'), false, 'de oude code is geen sleutel meer');
});

/* De leraar ROTEERT de lescode (kern/bearercode-keten.js): de nieuwe eindigt met
   de les zoals de oude, de toetredingen tellen door tegen het plafond, de oude
   opent niets meer, het volgnummer gaat een omhoog en de geschiedenis zegt
   `geroteerd`. Ook een v1-lescode van voor bearercode v2. */
test('roteren: zelfde einde, oude dicht, teller loopt door, rotatie +1, soort geroteerd', async () => {
  const { t, rij, schuif } = wereld();
  const les = await t.nieuweLes();
  const oud = rij(les.lesId).lescode;
  assert.equal(oud.contractversie, 2, 'de uitgifte is bearercode v2');
  assert.equal(oud.expires_at, rij(les.lesId).expires_at);
  assert.ok((await t.claim(les.lescode)).ok);
  schuif(3600000);
  const r = await t.roteerLescode(les.lesId, les.token);
  const nieuw = rij(les.lesId).lescode;
  assert.equal(nieuw.expires_at, rij(les.lesId).expires_at, 'het einde verschoof');
  assert.equal(nieuw.rotatie, 2);
  assert.equal(nieuw.gebruik, 1, 'de toetreding van voor de rotatie telt niet meer mee');
  assert.equal(nieuw.geschiedenis.at(-1).soort, 'geroteerd');
  assert.equal(nieuw.geschiedenis.at(-1).door, 'leraar');
  assert.equal(nieuw.geschiedenis.at(-1).einde_was, nieuw.expires_at);
  assert.equal(rij(les.lesId).lescode_historie.at(-1).code_hash, oud.code_hash, 'de oude hash staat niet in de historie');
  assert.equal((await t.claim(les.lescode)).status, 410, 'de oude lescode opent nog iets');
  assert.ok((await t.claim(r.lescode)).ok, 'de nieuwe opent niets');
  assert.equal(rij(les.lesId).lescode.gebruik, 2);

  // een v1-lescode (van voor deze wijziging) roteert ook, en wordt daarbij v2
  const les2 = await t.nieuweLes();
  const b = require('../server/kern/bearercode')({ crypto, namespace: 'foundation-les', nu: () => rij(les2.lesId).issued_at });
  const v1 = b.maak({ prefix: 'LES', issuer: 'rtfoundation-onderwijs', doel: T.DOEL.lescode, scope: T.SCOPE.lescode,
    onderwerp: { soort: 'foundation-les', les: les2.lesId, rol: 'lescode' }, geldigMs: T.GELDIG_MS, maxGebruik: T.MAX_LEERLINGEN });
  rij(les2.lesId).lescode = v1.toegang;
  assert.ok((await t.claim(v1.code)).ok, 'de v1-lescode werkt eerst');
  const r2 = await t.roteerLescode(les2.lesId, les2.token);
  assert.equal(rij(les2.lesId).lescode.contractversie, 2);
  assert.equal(rij(les2.lesId).lescode.expires_at, v1.toegang.expires_at);
  assert.equal(rij(les2.lesId).lescode.rotatie, 2);
  assert.equal((await t.claim(v1.code)).status, 410);
  assert.ok((await t.claim(r2.lescode)).ok);
});
