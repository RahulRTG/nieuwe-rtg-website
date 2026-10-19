'use strict';
/* EEN REISBETALING VRAAGT EEN BEZITSBEWIJS (eigenaarsbesluit 19 oktober 2026:
   elk account mag een reis laten boeken en betalen, mits gekeurd).

   /api/reisbureau/betaal int de reissom uit de wallet van het lid (kern/
   reisbureau-betaling.js, pay.boekAsync naar rtg:reisbureau) en stond niet in
   de zware paden. Een gestolen token kon zo een reis afrekenen. Deze toets
   bewijst de bezitshelft; de keuring (payGate) bewijst test/reisbetaal-poorten
   van Geld, die de route zelf bezit:
     - een ongebonden sessie komt er niet door (403, met de weg erheen);
     - een gebonden sessie zonder bewijs ook niet (401);
     - met een geldig bewijs voor DIT pad komt hij langs de bezitspoort;
     - de browser tekent het pad, anders weigert de server stil. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop } = require('./helper');
const { zwaarPad } = require('../server/kern/identiteit/bezitsbewijs');

const PAD = '/api/reisbureau/betaal';
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbezit-'));
async function api(pad, body, token, kop) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (kop) h['rtg-bezitsbewijs'] = kop;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BEZITSBEWIJS: 'verplicht' } }); base = srv.base; });
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function lid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Reis ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren');
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const teken = async (methode, pad) => {
    const kop = Buffer.from(JSON.stringify({ methode, pad, tijd: Date.now(), jti: 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20) })).toString('base64url');
    return kop + '.' + await sign(kop);
  };
  return { token: reg.token, jwk, sign, teken };
}

test('de reisbetaling staat in de zware paden, in de server en in de browser', () => {
  assert.ok(zwaarPad(PAD), PAD + ' hoort zwaar te zijn: hij verplaatst geld');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'toestelsleutel.js'), 'utf8');
  assert.ok(bron.match(/var ZWAAR = \[([\s\S]*?)\];/)[1].includes("'" + PAD + "'"), 'de browser tekent het pad');
  assert.ok(!zwaarPad('/api/reisbureau/mijn'), 'lezen blijft licht: alleen wat geld verplaatst is zwaar');
});

test('zonder bezitsbewijs verplaatst een reisbetaling niets', async () => {
  const l = await lid();
  const los = await api(PAD, { ref: 'RB-ONBEKEND' }, l.token);
  assert.equal(los.status, 403, 'ongebonden: ' + JSON.stringify(los.body).slice(0, 160));
  assert.equal(los.body.bezitsbewijs, 'vereist');

  const u = (await api('/api/mijn/toestel/uitdaging', {}, l.token)).body;
  const b = await api('/api/mijn/toestel/bind', { jwk: l.jwk, handtekening: await l.sign(u.nonce), naam: 'Reistoestel' }, l.token);
  assert.equal(b.status, 200, 'binden: ' + JSON.stringify(b.body).slice(0, 160));
  const zonder = await api(PAD, { ref: 'RB-ONBEKEND' }, l.token);
  assert.equal(zonder.status, 401, 'gebonden zonder bewijs: ' + JSON.stringify(zonder.body).slice(0, 160));
  assert.equal(zonder.body.bezitsbewijs, 'vereist');

  const ander = await api(PAD, { ref: 'RB-ONBEKEND' }, l.token, await l.teken('POST', '/api/reisbureau/mijn'));
  assert.equal(ander.status, 401, 'een bewijs voor een ander pad dekt de betaling niet');

  const met = await api(PAD, { ref: 'RB-ONBEKEND' }, l.token, await l.teken('POST', PAD));
  assert.notEqual(met.body.bezitsbewijs, 'vereist', 'met een geldig bewijs komt hij langs de bezitspoort: ' + JSON.stringify(met.body).slice(0, 160));
});
