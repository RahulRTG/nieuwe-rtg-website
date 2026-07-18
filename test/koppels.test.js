/* Gekoppelde schakelaars (tegenhangers): twee functies die samen een dienst
   vormen volgen elkaar automatisch als de boardroom er een omzet, zodat er
   nooit een halve dienst overblijft (vacatures zonder sollicitanten, een
   Salon-feed zonder partner-marketing). De regel is de "nog publiek?"-vraag,
   en per-doelgroep fijnregeling triggert de tegenhanger pas als de bron
   helemaal geen publiek meer heeft. Draai los:
   node --experimental-sqlite --test test/koppels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-koppels-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function standVan(id) {
  const b = await api('/api/office/boardroom', {}, office);
  const f = b.body.functies.flatMap(g => g.functies).find(x => x.id === id);
  return f ? f.aan : null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'de backoffice is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de koppels staan op het bord en Salon uit neemt de partner-Salon mee', async () => {
  const b = await api('/api/office/boardroom', {}, office);
  assert.ok((b.body.koppels || []).some(k => k.a === 'salon' && k.b === 'supplier-salon'), 'de Salon-koppel staat erbij');
  const zet = await api('/api/office/boardroom/schakel', { functie: 'salon', aan: false }, office);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.ookGeschakeld.some(g => g.functie === 'supplier-salon' && g.aan === false), 'de tegenhanger ging mee uit');
  assert.equal(await standVan('supplier-salon'), false, 'partner-Salon staat nu ook uit');
  // en weer aan: de tegenhanger volgt terug
  const terug = await api('/api/office/boardroom/schakel', { functie: 'salon', aan: true }, office);
  assert.ok(terug.body.ookGeschakeld.some(g => g.functie === 'supplier-salon' && g.aan === true), 'de tegenhanger ging mee aan');
  assert.equal(await standVan('supplier-salon'), true);
});

test('2. andersom ook: de partner-kant uit neemt de leden-kant mee (en beide werk-kanten)', async () => {
  const zet = await api('/api/office/boardroom/schakel', { functie: 'supplier-apply', aan: false }, office);
  assert.equal(zet.status, 200);
  const ids = zet.body.ookGeschakeld.map(g => g.functie);
  assert.ok(ids.includes('member-werk') && ids.includes('werk-rtf'), 'solliciteren voor leden EN RTF ging mee uit');
  await api('/api/office/boardroom/schakel', { functie: 'supplier-apply', aan: true }, office);
  assert.equal(await standVan('member-werk'), true, 'en weer terug aan');
});

test('3. per-doelgroep fijnregeling: de tegenhanger volgt pas als het publiek helemaal weg is', async () => {
  // Salon dicht voor alleen de RTG Pass: er is nog publiek (lifestyle, business, gast)
  const een = await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'rtg', aan: false }, office);
  assert.equal(een.status, 200);
  assert.equal(een.body.ookGeschakeld.length, 0, 'nog publiek over: de tegenhanger blijft staan');
  assert.equal(await standVan('supplier-salon'), true);
  // ook de andere drie doelgroepen dicht: nu is het publiek weg en volgt de tegenhanger
  await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'lifestyle', aan: false }, office);
  await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'business', aan: false }, office);
  const laatste = await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'gast', aan: false }, office);
  assert.ok(laatste.body.ookGeschakeld.some(g => g.functie === 'supplier-salon' && g.aan === false), 'publiek weg: tegenhanger uit');
  // een doelgroep weer open: er is weer publiek, de tegenhanger komt terug
  const open = await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'rtg', aan: true }, office);
  assert.ok(open.body.ookGeschakeld.some(g => g.functie === 'supplier-salon' && g.aan === true), 'weer publiek: tegenhanger aan');
  // opruimen voor de volgende tests
  await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'lifestyle', aan: true }, office);
  await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'business', aan: true }, office);
  await api('/api/office/boardroom/schakel', { functie: 'salon', doelgroep: 'gast', aan: true }, office);
});

test('4. de RTG-eigenaarskast (techniek) volgt dezelfde koppelregel', async () => {
  const eigenaar = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(eigenaar, 'de eigenaar is ingelogd op het techniekbord');
  const zet = await api('/api/boardroom/zet', { id: 'verificatie', aan: false }, eigenaar);
  assert.equal(zet.status, 200);
  assert.ok((zet.body.ookGeschakeld || []).some(g => g.functie === 'paspoort' && g.aan === false), 'paspoort delen ging mee uit met KYC');
  assert.equal(await standVan('paspoort'), false, 'de kantoren-boardroom ziet dezelfde stand');
  const terug = await api('/api/boardroom/zet', { id: 'verificatie', aan: true }, eigenaar);
  assert.ok((terug.body.ookGeschakeld || []).some(g => g.functie === 'paspoort' && g.aan === true), 'en mee terug aan');
});
