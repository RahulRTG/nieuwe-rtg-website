/* Contracten: elke zaak stelt een contract op (verhuur of personeel), gericht
   aan een lid (op codenaam) of een personeelslid. Beide partijen tekenen
   digitaal; pas als beide handtekeningen staan is het contract getekend, en
   de tekst verandert daarna niet meer.
   Draai: node --experimental-sqlite --test test/contract.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4790 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-con-'));
let child, lidToken, lidCodenaam, managerToken, balieId, balieToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  const reg = await json(await api('/api/auth/register', { name: 'Contract Lid', email: 'con@x.nl', phone: '0612345695',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }));
  lidToken = reg.token;
  // codenaam ophalen en het lid in de gids zetten (door iets te doen)
  const conn = await json(await api('/api/member/connections', {}, lidToken));
  lidCodenaam = conn.codename;
  const roster = await json(await api('/api/supplier/roster', { code: 'ISLAREN' }));
  const man = roster.staff.find(x => x.role === 'manager');
  const balie = roster.staff.find(x => x.role !== 'manager');
  balieId = balie.id;
  managerToken = (await json(await api('/api/supplier/login', { code: 'ISLAREN', staffId: man.id, pin: '1234' }))).token;
  balieToken = (await json(await api('/api/supplier/login', { code: 'ISLAREN', staffId: balie.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('verhuurcontract aan een lid op codenaam; personeel mag geen contract opstellen', async () => {
  assert.equal((await api('/api/supplier/contract/maak', { soort: 'verhuur', titel: 'X', tekst: 'x'.repeat(30), codenaam: lidCodenaam }, balieToken)).status, 403);
  // onbekende codenaam
  assert.equal((await api('/api/supplier/contract/maak', { soort: 'verhuur', titel: 'Huurcontract', tekst: 'De huurder is aansprakelijk conform de voorwaarden hieronder.', codenaam: 'Bestaat Niet 99' }, managerToken)).status, 404);
  const c = await json(await api('/api/supplier/contract/maak', {
    soort: 'verhuur', titel: 'Huurovereenkomst Fiat 500', codenaam: lidCodenaam,
    tekst: 'De huurder verklaart de auto in goede staat te ontvangen en conform de RTG-voorwaarden te gebruiken.',
    velden: [{ label: 'Auto', waarde: 'Fiat 500 Cabrio' }, { label: 'Borg', waarde: '300 euro' }]
  }, managerToken));
  assert.equal(c.contract.status, 'wacht');
  assert.equal(c.contract.partij.codename, lidCodenaam);
  assert.equal(c.contract.velden.length, 2);
  global.__con = c.contract.ref;
});

test('het lid ziet het contract en tekent digitaal; tekst blijft daarna gelijk', async () => {
  const mijn = await json(await api('/api/contracten/mijn', {}, lidToken));
  const c = mijn.contracten.find(x => x.ref === global.__con);
  assert.ok(c, 'het lid ziet het contract');
  assert.equal(c.status, 'wacht');
  const origineel = c.tekst;
  // tekenen vereist naam + akkoord
  assert.equal((await api('/api/contract/teken', { ref: global.__con, naam: '' }, lidToken)).status, 400);
  const t = await json(await api('/api/contract/teken', { ref: global.__con, naam: 'C. Lid', akkoord: true }, lidToken));
  assert.equal(t.status, 'wacht', 'de zaak moet nog tekenen');
  // nog een keer tekenen kan niet
  assert.equal((await api('/api/contract/teken', { ref: global.__con, naam: 'C. Lid', akkoord: true }, lidToken)).status, 409);
  const na = (await json(await api('/api/contracten/mijn', {}, lidToken))).contracten.find(x => x.ref === global.__con);
  assert.equal(na.tekst, origineel, 'de tekst is niet gewijzigd door het tekenen');
  assert.equal(na.getekendDoorMij, true);
});

test('de zaak tekent de andere kant; dan is het contract volledig getekend', async () => {
  const t = await json(await api('/api/supplier/contract/teken', { ref: global.__con, naam: 'Carmen Vidal', akkoord: true }, managerToken));
  assert.equal(t.contract.status, 'getekend');
  assert.ok(t.contract.tekenZaak && t.contract.tekenPartij);
  // dubbel tekenen door de zaak kan niet
  assert.equal((await api('/api/supplier/contract/teken', { ref: global.__con, naam: 'Carmen Vidal', akkoord: true }, managerToken)).status, 409);
});

test('personeelscontract: getekend door het personeelslid in de PDA, niet door een ander', async () => {
  const c = await json(await api('/api/supplier/contract/maak', {
    soort: 'personeel', titel: 'Arbeidsovereenkomst bepaalde tijd', staffId: balieId,
    tekst: 'Werknemer treedt in dienst als baliemedewerker voor het seizoen, conform de RTG-voorwaarden.',
    velden: [{ label: 'Functie', waarde: 'Balie' }, { label: 'Uurloon', waarde: '14 euro' }]
  }, managerToken));
  const ref = c.contract.ref;
  // het personeelslid ziet zijn eigen contract via de supplier-sessie (PDA)
  const mijn = await json(await api('/api/supplier/contracten', {}, balieToken));
  assert.ok(mijn.contracten.some(x => x.ref === ref), 'de medewerker ziet het eigen contract');
  // de zaak tekent
  await api('/api/supplier/contract/teken', { ref, naam: 'Carmen Vidal', akkoord: true }, managerToken);
  // het personeelslid tekent zijn kant in de PDA
  const t = await json(await api('/api/supplier/contract/teken', { ref, naam: 'Pau Riera', akkoord: true }, balieToken));
  assert.equal(t.contract.status, 'getekend');
});

test('weigeren kan, zolang je nog niet getekend hebt', async () => {
  const c = await json(await api('/api/supplier/contract/maak', {
    soort: 'algemeen', titel: 'Aanvullende afspraak', codenaam: lidCodenaam,
    tekst: 'Dit is een aanvullende afspraak tussen de partijen conform de voorwaarden.'
  }, managerToken));
  assert.equal((await api('/api/contract/weiger', { ref: c.contract.ref }, lidToken)).status, 200);
  const na = (await json(await api('/api/contracten/mijn', {}, lidToken))).contracten.find(x => x.ref === c.contract.ref);
  assert.equal(na.status, 'geweigerd');
  // een geweigerd contract kun je niet alsnog tekenen
  assert.equal((await api('/api/contract/teken', { ref: c.contract.ref, naam: 'C. Lid', akkoord: true }, lidToken)).status, 409);
});
