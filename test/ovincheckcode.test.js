/* De OV-incheckcode (travelos.ov_incheckcode, server/kern/ov/incheckcode.js):
   een money-credential, want een geslaagde claim start een betaalde rit op
   naam van het lid. Elke control uit RELEASEKANDIDAAT.md B9 heeft hier een
   toets die zakt als de control weg is; de mutaties staan onderaan.
   Draai los: node --test test/ovincheckcode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* Een gedeelde opslag voor twee "instances": elk verzoek leest de collectie
   opnieuw uit de JSON, zoals bewerkCollectie in PostgreSQL doet. Staat er iets
   alleen in procesgeheugen, dan ziet de tweede instance het niet. */
function opslag() {
  const kv = {};
  return {
    kv,
    bewerk: (sleutel, werk) => {
      const waarde = JSON.parse(kv[sleutel] || '{}');
      const uit = werk(waarde);
      kv[sleutel] = JSON.stringify(waarde);
      return uit;
    }
  };
}
const maak = (o, extra = {}) => require('../server/kern/ov/incheckcode')(Object.assign({
  crypto: nodeCrypto, bewerkCollectie: o.bewerk, CODE_TTL_MS: 5 * 60 * 1000 }, extra));
const vrij = () => null;

test('1. 128 bits, issuer/doel/scope, vijf minuten, max_gebruik 1, en op schijf alleen de hash', () => {
  const o = opslag(), c = maak(o);
  const uit = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  assert.match(uit.code, /^OVI\.[0-9A-F]{32}$/);
  assert.equal(uit.toegang.issuer, 'rtg.lid.ov');
  assert.equal(uit.toegang.doel, 'ov-incheck');
  assert.deepEqual(uit.toegang.scope, ['ov.dienst.incheck']);
  assert.equal(Date.parse(uit.toegang.expires_at) - Date.parse(uit.toegang.issued_at), 5 * 60 * 1000);
  assert.equal(uit.toegang.max_gebruik, 1);
  assert.ok(!o.kv.ovIncheckToegang.includes(uit.code), 'de kale code staat niet in de opslag');
  assert.ok(!o.kv.ovIncheckToegang.includes(uit.code.slice(4)), 'ook het geheime deel niet');
  const codes = new Set(Array.from({ length: 300 }, (_, i) => c.uitgeven({ key: 'lid:x' + i, zaak: 'TRANSIT' }).code));
  assert.equal(codes.size, 300);
});

test('2. persistent: instance B verzilvert wat instance A uitgaf, en een tweede claim start niets', () => {
  const o = opslag(), a = maak(o), b = maak(o);
  const { code } = a.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  const eerste = b.claim({ code, zaak: 'TRANSIT', controleer: vrij });
  assert.equal(eerste.status, 200);
  assert.equal(eerste.key, 'lid:1', 'de rit start op naam van het lid dat de code maakte');
  assert.equal(a.claim({ code, zaak: 'TRANSIT', controleer: vrij }).status, 404, 'eenmalig');
});

test('3. gebonden aan de vervoerder: een andere OV-zaak verzilvert hem niet (en verbruikt hem niet)', () => {
  const o = opslag(), c = maak(o);
  const { code } = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  assert.equal(c.claim({ code, zaak: 'ANDERE', controleer: vrij }).status, 404);
  assert.equal(c.claim({ code, zaak: 'TRANSIT', controleer: vrij }).status, 200);
});

test('4. een weigering binnen het slot (al ingecheckt) verbruikt de code niet', () => {
  const o = opslag(), c = maak(o);
  const { code } = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  const al = c.claim({ code, zaak: 'TRANSIT', controleer: () => ({ status: 409, error: 'al ingecheckt' }) });
  assert.equal(al.status, 409);
  assert.equal(c.claim({ code, zaak: 'TRANSIT', controleer: vrij }).status, 200);
});

test('5. roteren en intrekken op de server: de vorige code opent niets meer', () => {
  const o = opslag(), c = maak(o);
  const eerste = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  const tweede = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  assert.equal(tweede.toegang.rotatie, 2);
  assert.equal(c.claim({ code: eerste.code, zaak: 'TRANSIT', controleer: vrij }).status, 404);
  c.intrekken({ key: 'lid:1' });
  assert.equal(c.claim({ code: tweede.code, zaak: 'TRANSIT', controleer: vrij }).status, 404);
});

test('6. verlopen na vijf minuten', () => {
  const o = opslag();
  let t = Date.parse('2026-09-27T10:00:00Z');
  const c = maak(o, { nu: () => new Date(t).toISOString() });
  const { code } = c.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
  t += 5 * 60 * 1000 + 1;
  assert.equal(c.claim({ code, zaak: 'TRANSIT', controleer: vrij }).status, 404);
});

test('7. constant-time: elke rij wordt vergeleken, ook na een treffer', () => {
  const o = opslag();
  let vergeleken = 0;
  const crypto = Object.assign(Object.create(nodeCrypto), {
    timingSafeEqual: (a, b) => { vergeleken++; return nodeCrypto.timingSafeEqual(a, b); } });
  const c = maak(o, { crypto });
  const eerste = c.uitgeven({ key: 'lid:0', zaak: 'TRANSIT' });
  for (let i = 1; i < 8; i++) c.uitgeven({ key: 'lid:' + i, zaak: 'TRANSIT' });
  vergeleken = 0;
  assert.equal(c.claim({ code: eerste.code, zaak: 'TRANSIT', controleer: vrij }).status, 200);
  assert.equal(vergeleken, 8, 'de treffer staat vooraan en toch worden alle acht vergeleken');
});

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ovi-'));
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('8. echte server: intrekken via de route, en een code start alleen bij de eigen vervoerder een rit', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const api = (pad, body, tok) => fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const u = Date.now().toString().slice(-8);
  const lid = (await api('/api/auth/register', { name: 'OV Lid', email: 'ovi' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api('/api/supplier/roster', { code: 'TRANSIT' });
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  const pda = (await api('/api/supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 9' }, pda)).status, 200);
  const onbekend = await api('/api/ov/code', { zaak: 'BESTAATNIET' }, lid);
  assert.equal(onbekend.status, 400, 'alleen een bestaande OV-vervoerder');
  const kaal = await fetch(base + '/api/ov/code', { method: 'POST', headers: { 'Content-Type': 'application/json',
    Authorization: 'Bearer ' + lid }, body: JSON.stringify({ zaak: 'TRANSIT' }) });
  assert.match(String(kaal.headers.get('cache-control')), /no-store/, 'de kale code staat buiten elke cache');
  const c = await api('/api/ov/code', { zaak: 'TRANSIT' }, lid);
  assert.equal(c.status, 200);
  const weg = await api('/api/ov/code/intrek', {}, lid);
  assert.equal(weg.status, 200);
  assert.equal((await api('/api/staff/ov/checkin', { code: c.body.code }, pda)).status, 404,
    'een ingetrokken code start geen betaalde rit');
  const nieuw = await api('/api/ov/code', { zaak: 'TRANSIT' }, lid);
  const inch = await api('/api/staff/ov/checkin', { code: nieuw.body.code }, pda);
  assert.equal(inch.status, 200);
  assert.equal(inch.body.rit.status, 'in');
});

/* MUTATIES (handmatig, op een schone boom; allemaal zakten ze):
   M1 incheckcode.js: `randomBytes(16)` in bearercode vervangen door een vaste
      prefix-code via een eigen `codeNieuw` met 3 bytes           -> toets 1
   M2 incheckcode.js: de controle `ow.zaak !== zaak` weghalen      -> toets 3
   M3 incheckcode.js: `bearer.gebruik(t)` + `opzij` weghalen       -> toets 2
   M4 incheckcode.js: `opzij(r, h, 'nieuwe incheckcode')` in uitgeven weghalen
                                                                   -> toets 5
   M5 incheckcode.js: `controleer(r.key)` NA `bearer.gebruik` zetten -> toets 4
   M6 incheckcode.js: in de zoeklus `break` na de eerste treffer   -> toets 7
   M7 routes/ov.js: /api/ov/code/intrek roept niets aan            -> toets 8 */
