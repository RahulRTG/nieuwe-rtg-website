/* TWEE GELIJKTIJDIGE EERSTE BINDINGEN -- en geen toestel zonder sessiebinding.

   /api/mijn/toestel/bind (server/routes/member/toestellen.js) controleerde
   eerst of de sessie al gebonden was, wachtte dan op de handtekening, schreef
   het TOESTEL op het account en bond pas daarna de SESSIE (sessieregister.vul).
   Twee eerste bindingen met verschillende sleutels kwamen allebei langs de
   eerste controle; de kern weigerde de tweede sessiebinding terecht (409),
   maar zijn toestel stond dan al in de toestellenlijst van het account -- een
   toestel dat aan geen enkele sessie vastzit en dat het lid nooit heeft
   bevestigd. Nu is het toestel registreren en de sessie binden een stap.

   De toets speelt de race precies na: twee uitdagingen, twee bindingen die
   allebei op hun handtekeningcontrole wachten, en dan samen verder. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakToestellen } = require('../server/kern/identiteit/toestellen');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');
const routes = require('../server/routes/member/toestellen');

/* Een toestel met een SYNCHRONE handtekening (node:crypto, ieee-p1363 = de
   r||s-vorm van WebCrypto). Synchroon met opzet: zo valt er tussen de twee
   uitdagingen en bindingen hieronder geen enkele beurt van de event loop, en
   wachten beide bindingen ECHT tegelijk op hun handtekeningcontrole -- de race
   wordt afgedwongen in plaats van gehoopt. */
function toestel() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const j = publicKey.export({ format: 'jwk' });
  return { jwk: { kty: j.kty, crv: j.crv, x: j.x, y: j.y },
    teken: (t) => crypto.sign('sha256', Buffer.from(String(t), 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' })
      .toString('base64url') };
}

function huis() {
  const db = { data: {} };
  const save = () => {};
  const toestellen = maakToestellen({ db, save });
  const sessieregister = maakSessieregister({ db, save });
  const routesVan = {};
  const app = { post: (pad, ...h) => { routesVan[pad] = h[h.length - 1]; }, get() {} };
  routes({ app, auth: (q, s, n) => n(), accounts: {}, sessieregister, toestellen, handelingsspoor: null,
    tooManyTries: () => false, noteFailedTry: () => {} });
  const sid = 'abcdefABCDEF';
  sessieregister.open(sid, 'user-7', {});
  /* De sessie zoals auth() hem levert: de context wordt per verzoek uit het
     register gelezen, dus beide verzoeken zien bij hun start nog geen binding. */
  const sessie = () => ({ key: 'user-7', sid, tier: 'rtg', account: { id: 7 },
    sessieContext: JSON.parse(JSON.stringify((sessieregister.lees(sid) || {}).context || {})) });
  const roep = (pad, body) => new Promise((klaar, fout) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { klaar({ status: this.code, body: b }); return this; },
      set() { return this; } };
    Promise.resolve(routesVan[pad]({ session: sessie(), body: body || {}, get: () => '' }, res, fout)).catch(fout);
  });
  return { toestellen, sessieregister, sid, roep };
}

test('twee gelijktijdige eerste bindingen: een wint, en de verliezer laat geen toestel achter', async () => {
  const h = huis();
  const a = toestel(), b = toestel();
  /* Alles hieronder tot Promise.all draait zonder dat de event loop een beurt
     krijgt: A pakt zijn uitdaging en wacht op zijn controle, de tweede
     uitdaging wordt uitgegeven, B pakt haar en wacht ook. Beide zagen bij hun
     start een ongebonden sessie. */
  let ua, ub;
  h.roep('/api/mijn/toestel/uitdaging').then(r => { ua = r; });
  await null;
  const bindA = h.roep('/api/mijn/toestel/bind', { jwk: a.jwk, handtekening: a.teken(ua.body.nonce), naam: 'A' });
  h.roep('/api/mijn/toestel/uitdaging').then(r => { ub = r; });
  await null;
  const bindB = h.roep('/api/mijn/toestel/bind', { jwk: b.jwk, handtekening: b.teken(ub.body.nonce), naam: 'B' });
  const [ra, rb] = await Promise.all([bindA, bindB]);
  const statussen = [ra.status, rb.status].sort();
  assert.deepEqual(statussen, [200, 409], 'een binding wint en de andere krijgt 409: ' + JSON.stringify([ra, rb]));
  const winnaar = ra.status === 200 ? ra.body.toestelId : rb.body.toestelId;
  const keyRef = h.sessieregister.lees(h.sid).context.sleutelbinding.keyRef;
  assert.equal(keyRef, winnaar, 'de sessie draagt de sleutel van de winnaar');
  assert.deepEqual(h.toestellen.lijst('user-7').map(t => t.toestelId), [winnaar],
    'op het account staat alleen het toestel dat werkelijk aan de sessie vastzit');
});

test('een gewone eerste binding schrijft nog steeds toestel en sessie samen', async () => {
  const h = huis();
  const a = toestel();
  const u = await h.roep('/api/mijn/toestel/uitdaging');
  const r = await h.roep('/api/mijn/toestel/bind', { jwk: a.jwk, handtekening: a.teken(u.body.nonce), naam: 'A' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.inSessie, true);
  assert.equal(h.toestellen.lijst('user-7').length, 1);
  assert.equal(h.sessieregister.lees(h.sid).context.toestel.toestelId, r.body.toestelId);
  /* Dezelfde sleutel nog een keer: mag, verandert niets. */
  const u2 = await h.roep('/api/mijn/toestel/uitdaging');
  const r2 = await h.roep('/api/mijn/toestel/bind', { jwk: a.jwk, handtekening: a.teken(u2.body.nonce) });
  assert.equal(r2.status, 200);
  assert.equal(h.toestellen.lijst('user-7').length, 1);
});
