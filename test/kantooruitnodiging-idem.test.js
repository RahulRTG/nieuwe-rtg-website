/* De herhaalde kantooruitnodiging op een ECHTE server (11 oktober 2026, besluit van
   de eigenaar na de volle idemronde).

   Tot deze reparatie maakte POST /api/office/kantoor/uitnodiging bij een herhaling
   met DEZELFDE idempotentiesleutel gewoon een tweede uitnodiging: de code die de
   eigenaar net had doorgegeven werd ingetrokken, en de retry gaf een code waarvan
   hij niet wist dat het de tweede was. Nu bindt kern/kantoor/uitnodiging.js de
   sleutel als hash aan de uitgifte, in dezelfde collectietransactie. Dezelfde
   sleutel: 409 met `herhaald`, geen tweede uitnodiging en geen kale code (die
   bestaat alleen als hash, en een herhaling heronthult hem niet --
   lib/eenmalig-geheim-routes.js). Een verse sleutel maakt wel een nieuwe, en dan
   koppelt de vorige niet meer. Zonder sleutel blijft elke oproep een nieuwe
   uitnodiging, zoals test/kantooruitnodiging.test.js vasthoudt.

   Draai los: node --test test/kantooruitnodiging-idem.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const CODE = 'UITNODIG-IDEM';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitnodiging-idem-'));
let srv, eig;
async function api(pad, body, token, extra) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}, extra || {}), body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst };
}
const KU = /^KU\.[0-9A-F]{32}$/;
const nodig = (codenaam, idem, extra) => api('/api/office/kantoor/uitnodiging', Object.assign({ codenaam }, idem ? { idem } : {}), eig, extra);
const koppelProef = (tok, uitnodiging) => api('/api/account/koppel', { soort: 'kantoor', uitnodiging }, tok);
const overzicht = async () => (await api('/api/office/kantoor/uitnodigingen', {}, eig)).body.uitnodigingen;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  eig = await kantoorAlsPersoon(srv.base, CODE);
  assert.ok(eig);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function lid(n) {
  const reg = (await api('/api/auth/register', { name: 'Uitnodiging Idem ' + n, email: 'uitnidem' + n + Date.now() + '@voorbeeld.test',
    password: 'geheim123', geboortedatum: '1985-05-05', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren lukt');
  await api('/api/auth/me', {}, reg.token);
  return { token: reg.token, codenaam: ((reg.state && reg.state.user) || {}).codename };
}

test('dezelfde sleutel maakt een uitnodiging, een verse sleutel een nieuwe, en de vorige koppelt niet meer', async () => {
  const a = await lid(1);
  const sleutel = 'kantooruitnodiging-' + Date.now() + '-a';

  /* 1. Twee keer met dezelfde sleutel: een uitnodiging, en de code van de eerste blijft gelden. */
  const een = await nodig(a.codenaam, sleutel);
  assert.equal(een.status, 200, een.tekst);
  assert.match(een.body.code, KU);
  const twee = await nodig(a.codenaam, sleutel);
  assert.equal(twee.status, 409, 'dezelfde sleutel is een herhaling: ' + twee.tekst);
  assert.equal(twee.body.herhaald, true);
  assert.equal(twee.body.id, een.body.id, 'de herhaling wijst de eerste uitnodiging aan');
  assert.equal(twee.body.code, undefined);
  assert.equal(twee.tekst.includes('KU.'), false, 'een herhaling heronthult geen kale code');
  /* ook via de standaardkop is het dezelfde sleutel */
  const kopje = await nodig(a.codenaam, null, { 'Idempotency-Key': sleutel });
  assert.equal(kopje.status, 409, kopje.tekst);
  const lijst = (await overzicht()).filter(u => u.codenaam === a.codenaam);
  assert.equal(lijst.length, 1, 'er staat precies een uitnodiging voor deze mens');
  assert.equal(lijst[0].stand, 'open', 'en die is niet ingetrokken door de herhaling');

  /* 2. Een verse sleutel maakt wel een nieuwe uitnodiging. */
  const vers = await nodig(a.codenaam, 'kantooruitnodiging-' + Date.now() + '-b');
  assert.equal(vers.status, 200, vers.tekst);
  assert.match(vers.body.code, KU);
  assert.notEqual(vers.body.code, een.body.code);
  const na = (await overzicht()).filter(u => u.codenaam === a.codenaam);
  assert.equal(na.length, 2);
  assert.equal(na.find(u => u.id === een.body.id).stand, 'ingetrokken', 'de vorige is ingetrokken -- dat is de rotatie');

  /* 3. De oude sleutel na een verse uitgifte is een nieuwe opdracht, en de vorige code koppelt niets. */
  const oudeSleutel = await nodig(a.codenaam, sleutel);
  assert.equal(oudeSleutel.status, 200, 'alleen de laatste uitgifte telt als herhaling: ' + oudeSleutel.tekst);
  assert.equal((await koppelProef(a.token, een.body.code)).status, 401, 'de eerste code koppelt niet meer');
  assert.equal((await koppelProef(a.token, vers.body.code)).status, 401, 'de tweede ook niet');
  const k = await koppelProef(a.token, oudeSleutel.body.code);
  assert.equal(k.status, 200, 'de nieuwste wel: ' + k.tekst);
});

test('dezelfde sleutel voor een ANDERE mens is geen herhaling', async () => {
  const b = await lid(2);
  const c = await lid(3);
  const sleutel = 'kantooruitnodiging-' + Date.now() + '-c';
  const voorB = await nodig(b.codenaam, sleutel);
  assert.equal(voorB.status, 200, voorB.tekst);
  const voorC = await nodig(c.codenaam, sleutel);
  assert.equal(voorC.status, 200, 'de sleutel hoort bij een mens, niet bij de eigenaar alleen: ' + voorC.tekst);
  assert.match(voorC.body.code, KU);
  assert.notEqual(voorC.body.id, voorB.body.id);
});
