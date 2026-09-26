/* WIE MAG RECHTEN VERLENEN AAN DE LEDENBALIE -- de P0 van 23 september 2026.

   De route /api/office/balie/zetel hing alleen achter boardroomAuth. Die poort
   laat de eigenaar binnen EN iedereen die van hem een boardroomsleutel kreeg,
   en `baas` ging alleen naar het scherm om knoppen te tonen. Een vertrouweling
   kon dus zetels uitdelen: iemand die de kamer in mag, verleende rechten aan
   anderen. Het geven van boardroomtoegang zelf was wel goed geregeld (alleen de
   eigenaar, passkey-step-up, auditregel); deze toets houdt vast dat de balie
   nu hetzelfde doet, en dat het INTREKKEN van boardroomtoegang ook de vinger
   vraagt, met een eigen actienaam.

   DE BEWERINGEN, elk met de toestand erbij waarin hij hoort te zakken:
   1. een vertrouweling met een boardroomsleutel krijgt 403 op geven en op
      intrekken, en de lijst beweegt niet;
   2. met een passkey vraagt de eigenaar ZONDER ceremonie een 401 met
      `bevestigingNodig` en de actienaam -- voor de balie EN voor het intrekken
      van boardroomtoegang;
   3. een verse assertie voor die actie laat hem door;
   4. een assertie voor het GEVEN van boardroomtoegang maakt het INTREKKEN niet
      af: twee actienamen, twee bindingen;
   5. intrekken werkt meteen: wie zijn zetel kwijt is, komt bij het volgende
      verzoek niet meer aan de balie. Sinds AUTHORITY.md fase 3 sluit intrekken
      ook de open kantoorsessie, dus dat volgende verzoek krijgt 401 en geen 403.

   Draai los: node --test test/baliezetel-eigenaar.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-baliezetel-'));
let srv, base, origin, sleutel, baas, lid, lidKey, lidCodenaam, vertrouweling, tweede, tweedeKey;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function account(naam) {
  const u = (Date.now() + Math.floor(Math.random() * 1e6)).toString().slice(-8);
  const r = await api('/api/auth/register', { name: naam, email: 'bz' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1991-02-02', geslacht: 'v', tier: 'business', pasApp: 'business' });
  const me = await api('/api/auth/me', {}, r.body.token);
  return { token: r.body.token, key: 'user-' + me.body.user.id, codenaam: me.body.user.codename };
}
let teller = 10;
async function bevestig(actie) {
  const o = await api('/api/office/boardroom/bevestig/opties', { actie }, baas);
  assert.equal(o.status, 200, 'ceremonie voor ' + actie + ': ' + JSON.stringify(o.body).slice(0, 160));
  return { ceremonie: o.body.ceremonie, antwoord: sleutel.loginAntwoord(o.body.opties.challenge, origin, ++teller) };
}
const zetels = async () => (await api('/api/office/balie/zetels', {}, baas)).body.zetels.map(z => z.key);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  base = srv.base;
  origin = new URL(base).origin;
  sleutel = maakAuthenticator(new URL(base).hostname);
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(baas, 'de eigenaar is ingelogd');

  // de vertrouweling: boardroomsleutel van de eigenaar, kantoor-rol via het eigen account
  const v = await account('Vertrouweling Zetel');
  lid = v.token; lidKey = v.key; lidCodenaam = v.codenaam;
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: lidCodenaam }, baas)).status, 200,
    'de eigenaar geeft de sleutel (nog zonder passkey)');
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(base, lid), lid)).status, 200);
  vertrouweling = (await api('/api/account/start', { rol: 'kantoor' }, lid)).body.token;
  assert.equal((await api('/api/office/balie/zetels', {}, vertrouweling)).status, 200, 'de vertrouweling is binnen');

  const t = await account('Tweede Zetel');
  tweede = t.token; tweedeKey = t.key;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een vertrouweling met een boardroomsleutel verleent geen zetels', async () => {
  const voor = await zetels();
  const geef = await api('/api/office/balie/zetel', { key: tweedeKey }, vertrouweling);
  assert.equal(geef.status, 403, 'geven: ' + JSON.stringify(geef.body).slice(0, 160));
  const weg = await api('/api/office/balie/zetel', { key: tweedeKey, weg: true }, vertrouweling);
  assert.equal(weg.status, 403, 'intrekken');
  assert.deepEqual(await zetels(), voor, 'de lijst is niet bewogen');
});

test('2. met een passkey vraagt de eigenaar eerst de vinger', async () => {
  const opties = await api('/api/webauthn/registreer/opties', {}, baas);
  assert.equal(opties.status, 200, JSON.stringify(opties.body).slice(0, 160));
  const reg = await api('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(opties.body.opties.challenge, origin), naam: 'Toestel eigenaar' }, baas);
  assert.equal(reg.status, 200, 'passkey staat: ' + JSON.stringify(reg.body).slice(0, 160));

  const zetel = await api('/api/office/balie/zetel', { key: tweedeKey }, baas);
  assert.equal(zetel.status, 401);
  assert.equal(zetel.body.bevestigingNodig, true);
  assert.equal(zetel.body.actie, 'eigenaar-baliezetel');
  assert.equal((await zetels()).includes(tweedeKey), false, 'zonder vinger geen zetel');

  const weg = await api('/api/office/boardroom/toegang/weg', { codenaam: lidCodenaam }, baas);
  assert.equal(weg.status, 401, 'boardroomtoegang intrekken vraagt ook de vinger');
  assert.equal(weg.body.actie, 'eigenaar-boardroomtoegang-weg');
});

test('3. met een verse assertie gaat het wel door', async () => {
  const r = await api('/api/office/balie/zetel', { key: tweedeKey, ...(await bevestig('eigenaar-baliezetel')) }, baas);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.ok(r.body.zetels.some(z => z.key === tweedeKey), 'de zetel staat er');
});

test('4. een vinger voor GEVEN maakt INTREKKEN niet af', async () => {
  const b = await bevestig('eigenaar-boardroomtoegang');
  const r = await api('/api/office/boardroom/toegang/weg', { codenaam: lidCodenaam, ...b }, baas);
  assert.notEqual(r.status, 200, 'een andere actie, een andere binding');
  const ok = await api('/api/office/boardroom/toegang/weg',
    { codenaam: lidCodenaam, ...(await bevestig('eigenaar-boardroomtoegang-weg')) }, baas);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 160));
  /* 401 en geen 403: intrekken sluit sinds AUTHORITY.md fase 3 ook de open
     kantoorsessie (test/kantoorintrekking.test.js). Hij is er dus meteen uit,
     zonder te wachten tot zijn sessie verloopt -- en nu ook zonder sessie. */
  assert.equal((await api('/api/office/balie/zetels', {}, vertrouweling)).status, 401,
    'de vertrouweling is er meteen uit, zonder dat zijn sessie verloopt');
});

test('5. een ingetrokken zetel werkt bij het volgende verzoek niet meer', async () => {
  assert.equal((await api('/api/account/koppel', await kantoorKoppelBody(base, tweede, null,
    { eigenaar: baas, bevestig: () => bevestig('eigenaar-kantooruitnodiging') }), tweede)).status, 200);
  const sessie = (await api('/api/account/start', { rol: 'kantoor' }, tweede)).body.token;
  const binnen = await api('/api/office/balie/zoek', { codenaam: lidCodenaam }, sessie);
  assert.equal(binnen.status, 200, 'met zetel aan de balie: ' + JSON.stringify(binnen.body).slice(0, 160));
  const weg = await api('/api/office/balie/zetel',
    { key: tweedeKey, weg: true, ...(await bevestig('eigenaar-baliezetel')) }, baas);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.sessiesGesloten, 1, 'intrekken sluit de open kantoorsessie (AUTHORITY.md fase 3)');
  assert.equal((await api('/api/office/balie/zoek', { codenaam: lidCodenaam }, sessie)).status, 401,
    'dezelfde sessie, geen zetel meer -- en de sessie zelf is dicht');
});
