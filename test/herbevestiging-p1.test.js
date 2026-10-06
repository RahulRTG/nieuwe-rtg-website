'use strict';
/* P1-1 en P1-2: een gestolen sessietoken mag geen blijvende sleutel aan het
   account hangen.

   P1-1. /api/mijn/toestel/bind vroeg alleen `auth`, en het sessieregister wees
   alleen een ZWAKKERE claim af. Een even sterke binding met een andere sleutel
   overschreef dus de sleutelbinding van het lid: wie het token had, bond zijn
   eigen sleutel en tekende daarna zelf elk bezitsbewijs (betalen, bank,
   wachtwoord, passkeys, export).

   P1-2. /api/webauthn/registreer/opties vroeg alleen `auth`. Wie het token had,
   zette een eigen passkey op het account, en die voldoet daarna blijvend aan de
   zware poort.

   Een oude sessie wordt hier echt oud gemaakt en niet gesimuleerd: server 1
   draait met RTG_KLOK=-20m, zodat het sessieregister het inlogmoment twintig
   minuten in het verleden vastlegt; server 2 draait op dezelfde datamap met de
   gewone klok en ziet dus een sessie van twintig minuten oud. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop, stopNet } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');
const { versGeopend, VERSE_INLOG_MS } = require('../server/kern/identiteit/herbevestiging');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herbevestig-'));
const WW = 'geheim123';
let srv, base, oud, oudPk;   // twee accounts met een sessie die twintig minuten geleden begon

async function api(pad, body, token, kop) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (kop) h['rtg-bezitsbewijs'] = kop;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const uniek = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function registreer() {
  const u = uniek();
  const email = 'hb' + u + '@x.nl';
  const r = await api('/api/auth/register', { name: 'Herbevestig ' + u, email, password: WW,
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren: ' + JSON.stringify(r.body).slice(0, 160));
  return { token: r.body.token, email };
}
async function sleutel() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const teken = async (methode, pad) => {
    const kop = Buffer.from(JSON.stringify({ methode, pad, tijd: Date.now(),
      jti: 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20) })).toString('base64url');
    return kop + '.' + await sign(kop);
  };
  return { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, sign, teken };
}
async function bind(token, k, extra) {
  const u = await api('/api/mijn/toestel/uitdaging', {}, token);
  assert.equal(u.status, 200, 'uitdaging: ' + JSON.stringify(u.body));
  return api('/api/mijn/toestel/bind', Object.assign({ jwk: k.jwk, handtekening: await k.sign(u.body.nonce), naam: 'T' }, extra || {}), token);
}

test.before(async () => {
  /* Server 1: het inlogmoment ligt twintig minuten terug. */
  const eerst = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_KLOK: '-20m' } });
  base = eerst.base;
  oud = await registreer();
  oudPk = await registreer();
  await stopNet(eerst.child);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------- de kern ---------------------------- */

test('kern: een sleutelbinding wordt aangevuld, nooit vervangen door een andere sleutel', () => {
  const sr = maakSessieregister({ db: { data: {} }, save() {} });
  const nu = new Date().toISOString();
  const hk = { bron: 'toestelsleutel', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'blok3' };
  sr.open('bbbbbbbbbbbb', 'user-1', {});
  const eerste = sr.vul('bbbbbbbbbbbb', { sleutelbinding: { keyRef: 'a'.repeat(32), schema: 'rtg-bezitsbewijs-v1', herkomst: hk },
    toestel: { toestelId: 'a'.repeat(32), bindingId: 'b'.repeat(32), bindingStand: 'bevestigd', herkomst: hk } });
  assert.equal(eerste.ok, true);
  const dief = sr.vul('bbbbbbbbbbbb', { sleutelbinding: { keyRef: 'c'.repeat(32), schema: 'rtg-bezitsbewijs-v1', herkomst: hk },
    toestel: { toestelId: 'c'.repeat(32), bindingId: 'd'.repeat(32), bindingStand: 'bevestigd', herkomst: hk } });
  assert.equal(dief.ok, false, 'een even sterke binding met een andere sleutel hoort te weigeren');
  assert.equal(dief.reden, 'herbinding');
  const rij = sr.lees('bbbbbbbbbbbb');
  assert.equal(rij.context.sleutelbinding.keyRef, 'a'.repeat(32), 'de sleutel van het lid staat er nog');
  assert.equal(rij.context.toestel.toestelId, 'a'.repeat(32), 'en er is niets half geschreven');
  const zelfde = sr.vul('bbbbbbbbbbbb', { sleutelbinding: { keyRef: 'a'.repeat(32), schema: 'rtg-bezitsbewijs-v1', herkomst: hk } });
  assert.equal(zelfde.ok, true, 'dezelfde sleutel nog een keer verandert niets en mag');
});

test('kern: het verse venster is tien minuten, en onbekend is niet vers', () => {
  const nu = Date.now();
  assert.equal(VERSE_INLOG_MS, 10 * 60 * 1000);
  assert.equal(versGeopend(new Date(nu - 60 * 1000).toISOString(), nu), true);
  assert.equal(versGeopend(new Date(nu - 11 * 60 * 1000).toISOString(), nu), false);
  assert.equal(versGeopend(null, nu), false);
  assert.equal(versGeopend('onzin', nu), false);
  assert.equal(versGeopend(new Date(nu + 3600 * 1000).toISOString(), nu), false, 'een inlog uit de toekomst veroudert nooit');
});

/* ---------------------------- P1-1 over HTTP ---------------------------- */

test('P1-1: een gestolen token kan de sleutelbinding niet overschrijven', async () => {
  const lid = await registreer();                 // verse sessie: binden mag zonder herbevestiging
  const vanLid = await sleutel();
  const b = await bind(lid.token, vanLid);
  assert.equal(b.status, 200, 'het lid bindt zijn toestel: ' + JSON.stringify(b.body).slice(0, 200));
  assert.equal(b.body.inSessie, true);

  const vanDief = await sleutel();
  const herbind = await bind(lid.token, vanDief);
  assert.equal(herbind.status, 409, 'met alleen het token bindt de dief zijn eigen sleutel: ' + JSON.stringify(herbind.body).slice(0, 200));
  assert.equal(herbind.body.opnieuwInloggen, true);
  /* Ook met het juiste wachtwoord niet: een sessie draagt EEN sleutel. */
  const metWw = await bind(lid.token, vanDief, { huidig: WW });
  assert.equal(metWw.status, 409, 'herbinden binnen dezelfde sessie blijft dicht');

  const metDief = await api('/api/privacy/inzage', {}, lid.token, await vanDief.teken('POST', '/api/privacy/inzage'));
  assert.equal(metDief.status, 401, 'een bewijs van de sleutel van de dief opent niets: ' + JSON.stringify(metDief.body).slice(0, 160));
  const metLid = await api('/api/privacy/inzage', {}, lid.token, await vanLid.teken('POST', '/api/privacy/inzage'));
  assert.notEqual(metLid.status, 401, 'het toestel van het lid blijft werken: ' + JSON.stringify(metLid.body).slice(0, 160));

  const zelfde = await bind(lid.token, vanLid);
  assert.equal(zelfde.status, 200, 'hetzelfde toestel opnieuw bevestigen blijft kunnen');
});

test('P1-1: de eerste binding van een oude sessie vraagt een herbevestiging', async () => {
  const k = await sleutel();
  const kaal = await bind(oud.token, k);
  assert.equal(kaal.status, 403, 'een sessie van twintig minuten bindt niet op het token alleen: ' + JSON.stringify(kaal.body).slice(0, 200));
  assert.equal(kaal.body.herbevestigingNodig, true);
  assert.deepEqual(kaal.body.wegen, ['wachtwoord', 'passkey']);

  const fout = await bind(oud.token, k, { huidig: 'niet-het-wachtwoord' });
  assert.equal(fout.status, 403, 'een fout wachtwoord bindt niets');

  const goed = await bind(oud.token, k, { huidig: WW });
  assert.equal(goed.status, 200, 'met het wachtwoord wel: ' + JSON.stringify(goed.body).slice(0, 200));
  assert.equal(goed.body.inSessie, true);
});

/* ---------------------------- P1-2 over HTTP ---------------------------- */

test('P1-2: een eerste passkey vraagt het huidige wachtwoord, een tweede een vinger op de eerste', async () => {
  const lid = await registreer();
  const origin = new URL(base).origin;
  const a = maakAuthenticator(new URL(base).hostname);

  const kaal = await api('/api/webauthn/registreer/opties', {}, lid.token);
  assert.equal(kaal.status, 403, 'op het token alleen geen registratie-uitdaging: ' + JSON.stringify(kaal.body).slice(0, 200));
  assert.equal(kaal.body.herbevestigingNodig, true);
  assert.equal(kaal.body.opties, undefined, 'en dus ook geen challenge om te tekenen');
  const fout = await api('/api/webauthn/registreer/opties', { huidig: 'niet-het-wachtwoord' }, lid.token);
  assert.equal(fout.status, 403);
  assert.equal(fout.body.opties, undefined);

  const o = await api('/api/webauthn/registreer/opties', { huidig: WW }, lid.token);
  assert.equal(o.status, 200, 'met het wachtwoord wel: ' + JSON.stringify(o.body).slice(0, 200));
  const r = await api('/api/webauthn/registreer', { antwoord: a.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Eerste' }, lid.token);
  assert.equal(r.status, 200, 'en de registratie lukt: ' + JSON.stringify(r.body).slice(0, 200));

  /* Nu staat er een passkey: het wachtwoord alleen is niet meer genoeg. */
  const ww = await api('/api/webauthn/registreer/opties', { huidig: WW }, lid.token);
  assert.equal(ww.status, 401, 'een tweede passkey op het wachtwoord alleen: ' + JSON.stringify(ww.body).slice(0, 200));
  assert.equal(ww.body.bevestigingNodig, true);
  assert.equal(ww.body.actie, 'passkey-nieuw');

  const c = await api('/api/webauthn/bevestig/opties', { actie: 'passkey-nieuw' }, lid.token);
  assert.equal(c.status, 200, 'het loket geeft de ceremonie: ' + JSON.stringify(c.body).slice(0, 200));
  const o2 = await api('/api/webauthn/registreer/opties',
    { ceremonie: c.body.ceremonie, antwoord: a.loginAntwoord(c.body.opties.challenge, origin, 1) }, lid.token);
  assert.equal(o2.status, 200, 'met een vinger op de eerste passkey wel: ' + JSON.stringify(o2.body).slice(0, 200));
  const b = maakAuthenticator(new URL(base).hostname);
  const r2 = await api('/api/webauthn/registreer', { antwoord: b.registratieAntwoord(o2.body.opties.challenge, origin), naam: 'Tweede' }, lid.token);
  assert.equal(r2.status, 200, JSON.stringify(r2.body).slice(0, 200));

  const vreemd = await api('/api/webauthn/bevestig/opties', { actie: 'eigenaar-overdracht' }, lid.token);
  assert.equal(vreemd.status, 400, 'het ledenloket geeft geen ceremonie voor een handeling van de eigenaar');
});

test('P1-2: een uitdaging die een andere sessie verdiende, is niet in te wisselen', async () => {
  const lid = await registreer();
  const tweede = await api('/api/auth/login', { login: lid.email, password: WW, pasApp: 'rtg' });
  assert.ok(tweede.body.token, 'tweede sessie: ' + JSON.stringify(tweede.body).slice(0, 160));
  const origin = new URL(base).origin;
  const a = maakAuthenticator(new URL(base).hostname);
  const o = await api('/api/webauthn/registreer/opties', { huidig: WW }, lid.token);
  assert.equal(o.status, 200);
  const r = await api('/api/webauthn/registreer', { antwoord: a.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Dief' }, tweede.body.token);
  assert.equal(r.status, 403, 'de uitdaging van sessie 1 is niet af te maken met sessie 2: ' + JSON.stringify(r.body).slice(0, 200));
  const lijst = await api('/api/webauthn/lijst', {}, lid.token);
  assert.equal((lijst.body.sleutels || []).length, 0, 'er staat geen passkey');
});

test('P1-1 met een passkey: een oude sessie bindt ook met een vinger, en niet zonder', async () => {
  const origin = new URL(base).origin;
  const a = maakAuthenticator(new URL(base).hostname);
  const o = await api('/api/webauthn/registreer/opties', { huidig: WW }, oudPk.token);
  assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 200));
  const r = await api('/api/webauthn/registreer', { antwoord: a.registratieAntwoord(o.body.opties.challenge, origin), naam: 'Oud' }, oudPk.token);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));

  const k = await sleutel();
  const kaal = await bind(oudPk.token, k);
  assert.equal(kaal.status, 403, 'zonder bevestiging bindt een oude sessie niet: ' + JSON.stringify(kaal.body).slice(0, 200));
  assert.equal(kaal.body.passkey, true, 'het antwoord zegt dat de passkeyweg openstaat');

  /* Een ceremonie voor een ANDERE handeling telt niet. */
  const anders = await api('/api/webauthn/bevestig/opties', { actie: 'passkey-weg' }, oudPk.token);
  const nep = await bind(oudPk.token, k, { ceremonie: anders.body.ceremonie, antwoord: a.loginAntwoord(anders.body.opties.challenge, origin, 1) });
  assert.notEqual(nep.status, 200, 'een ceremonie voor passkey-weg bindt geen toestel: ' + JSON.stringify(nep.body).slice(0, 200));

  const c = await api('/api/webauthn/bevestig/opties', { actie: 'toestel-binden' }, oudPk.token);
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  const goed = await bind(oudPk.token, k, { ceremonie: c.body.ceremonie, antwoord: a.loginAntwoord(c.body.opties.challenge, origin, 2) });
  assert.equal(goed.status, 200, 'met een vinger wel: ' + JSON.stringify(goed.body).slice(0, 200));
  assert.equal(goed.body.inSessie, true);
});
