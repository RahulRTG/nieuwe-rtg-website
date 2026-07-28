/* Merkregel-poort: de Lifestyle- en Business Pass komen UITSLUITEND na een
   menselijk besluit. Zelf-registreren mag ze nooit geven -- eerder gaf het
   tier-veld bij /api/auth/register direct een Business Pass (gevonden met
   scripts/aanval.js). Deze test bewaakt beide kanten van de poort:
     1. zelf-registreren als Business/Lifestyle levert gewoon een RTG Pass;
     2. het menselijke akkoord op een aanvraag tilt het gekoppelde account op.
   Draai los: node --experimental-sqlite --test test/pas-escalatie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-escalatie-'));
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const uniek = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const tierVan = async token => ((await api('/api/state', {}, token)).body.state || {}).user.tier;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function nieuwLid(tier, pasApp) {
  const u = uniek();
  const r = await api('/api/auth/register', {
    name: 'Proef ' + u, email: 'esc-' + u + '@proef.test', phone: '0612345678',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier, pasApp });
  return { r, token: r.body.token, u };
}

test('1. zelf-registreren als Business levert een RTG Pass, geen Business', async () => {
  const { r, token } = await nieuwLid('business', 'business');
  assert.equal(r.status, 200, 'de registratie zelf slaagt (geen weigering)');
  assert.ok(token, 'er komt een token terug');
  assert.equal(await tierVan(token), 'rtg', 'de pas is RTG, niet business');
});

test('2. ook als Lifestyle: zelf-registreren geeft nooit meer dan RTG', async () => {
  const { token } = await nieuwLid('lifestyle', 'lifestyle');
  assert.equal(await tierVan(token), 'rtg', 'de pas is RTG, niet lifestyle');
});

test('3. in de gewone RTG-app blijft RTG gewoon RTG', async () => {
  const { token } = await nieuwLid('rtg', 'rtg');
  assert.equal(await tierVan(token), 'rtg');
});

test('4. het menselijke akkoord tilt het gekoppelde account op naar Business', async () => {
  // een gewoon lid (RTG), daarna een Business-aanvraag MET zijn token: dat
  // koppelt zijn account aan de aanvraag.
  const { token } = await nieuwLid('rtg', 'rtg');
  assert.equal(await tierVan(token), 'rtg', 'begint als RTG');
  const aanvraag = await api('/api/aanmelding/aanvraag',
    { pas: 'business', naam: 'Zaak Proef', contact: 'zaak@proef.test' }, token);
  assert.equal(aanvraag.status, 200);
  const id = aanvraag.body.aanmelding.id;
  assert.equal(aanvraag.body.aanmelding.gekoppeld, true, 'de aanvraag is aan het account gekoppeld');

  // het menselijke besluit: RTG-personeel accepteert
  const besluit = await api('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd', notitie: 'akkoord' }, office);
  assert.equal(besluit.status, 200);
  assert.equal(besluit.body.aanmelding.status, 'geaccepteerd');

  // en nu draait hetzelfde account op een Business Pass
  assert.equal(await tierVan(token), 'business', 'na akkoord is het account opgetild naar business');
});

test('5. een aanvraag zonder ingelogd account kan niets optillen', async () => {
  const aanvraag = await api('/api/aanmelding/aanvraag',
    { pas: 'business', naam: 'Anoniem', contact: 'anon@proef.test' }, null);
  assert.equal(aanvraag.status, 200);
  assert.equal(aanvraag.body.aanmelding.gekoppeld, false, 'geen account gekoppeld');
  // accepteren mag, maar er is geen account om op te tillen (geen crash)
  const besluit = await api('/api/aanmelding/beslis', { id: aanvraag.body.aanmelding.id, besluit: 'geaccepteerd' }, office);
  assert.equal(besluit.status, 200);
});
