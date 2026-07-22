/* De AI-regie van de boardroom: het kantoor vult Rahuls karakter en verhaal
   AAN (nooit vervangen: de vaste kern staat in de code en wordt door
   test/rahul-eerlijk.test.js bewaakt). De aanvulling komt live mee in elke
   assistent via de RAHUL_LEAD-getter en in de leden-AI via de prompt.
   Draai los: node --experimental-sqlite --test test/ai-regie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-airegie-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(office, 'het kantoor is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de deur zit dicht zonder kantoor-token', async () => {
  assert.equal((await api('/api/office/boardroom/rahul', {})).status, 401);
  assert.equal((await api('/api/office/boardroom/rahul/zet', { karakter: 'x' })).status, 401);
});

test('2. de boardroom zet een aanvulling en leest die terug', async () => {
  const leeg = await api('/api/office/boardroom/rahul', {}, office);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.profiel.karakter || '', '', 'begint leeg');
  const zet = await api('/api/office/boardroom/rahul/zet', {
    karakter: 'Je houdt van tuinieren en vertelt daar graag over.',
    verhaal: 'In 2026 opende RTG een kantoor in Ibiza.'
  }, office);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.profiel.karakter, 'Je houdt van tuinieren en vertelt daar graag over.');
  assert.ok(zet.body.profiel.at, 'met een tijdstip erbij');
  const terug = await api('/api/office/boardroom/rahul', {}, office);
  assert.equal(terug.body.profiel.verhaal, 'In 2026 opende RTG een kantoor in Ibiza.');
});

test('3. te lange teksten worden op 2000 tekens afgekapt, leeg zetten wist de aanvulling', async () => {
  const lang = 'a'.repeat(3000);
  const zet = await api('/api/office/boardroom/rahul/zet', { karakter: lang, verhaal: '' }, office);
  assert.equal(zet.body.profiel.karakter.length, 2000, 'afgekapt op 2000');
  const wis = await api('/api/office/boardroom/rahul/zet', { karakter: '', verhaal: '' }, office);
  assert.equal(wis.body.profiel.karakter, '');
  assert.equal(wis.body.profiel.verhaal, '');
});

test('4. de aanvulling komt live in RAHUL_LEAD mee, en verdwijnt als de bron leeg is', () => {
  const rahul = require('../server/kern/rahul');
  const basis = rahul.RAHUL_LEAD;
  assert.match(basis, /In je huidige rol: $/, 'de lead eindigt op de rol-overgang');
  rahul.zetRahulBron(() => ({ karakter: 'Je fluit graag oude liedjes.', verhaal: 'Ooit liep je de marathon.' }));
  const met = rahul.RAHUL_LEAD;
  assert.match(met, /Aanvulling op je karakter, vastgesteld door de RTG-boardroom: Je fluit graag oude liedjes\./);
  assert.match(met, /Aanvulling op je verhaal, vastgesteld door de RTG-boardroom: Ooit liep je de marathon\./);
  assert.match(met, /In je huidige rol: $/, 'de rol-overgang blijft het slot');
  assert.ok(met.startsWith(rahul.RAHUL_BASIS), 'de vaste kern blijft vooraan staan');
  rahul.zetRahulBron(() => null);
  assert.equal(rahul.RAHUL_LEAD, basis, 'zonder profiel is de lead weer de kale basis');
  // een bron die stukgaat mag de assistenten nooit meetrekken
  rahul.zetRahulBron(() => { throw new Error('kapot'); });
  assert.equal(rahul.RAHUL_LEAD, basis, 'een kapotte bron valt stil terug op de basis');
  rahul.zetRahulBron(null);
});
