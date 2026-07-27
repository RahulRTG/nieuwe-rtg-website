/* Het bord (Trello) als kantoortool in RTG Office. Getoetst: een lid maakt
   een bord, bewaart lijsten met kaarten en leest ze terug (de sanitizer
   klemt labels en datums); de zaak heeft hetzelfde bord als team-drive;
   en de soortenlijst weigert nog steeds onzin.
   Draai los: node --experimental-sqlite --test test/officebord.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bord-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const BORD = { lijsten: [
  { id: 'l1', titel: 'Te doen', kaarten: [
    { id: 'k1', titel: 'Menukaart herzien', notitie: 'Met de chef', label: 'bordeaux', wie: 'Mara', voor: '2026-08-01', klaar: false },
    { id: 'k2', titel: 'Rare label', label: 'paars', voor: 'ooit', klaar: true }
  ] },
  { id: 'l2', titel: 'Klaar', kaarten: [] }
] };

test('1. een lid maakt een bord, bewaart en leest terug; de sanitizer klemt', async () => {
  const t = Date.now();
  const lid = (await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'b' + t + '@v.test', phone: '0687' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' }))).token;
  let r = await json(await raw('/kantoorpakket/maak', { soort: 'bord' }, lid));
  assert.equal(r.ok, true);
  assert.equal(r.soort, 'bord');
  assert.equal(r.titel, 'Nieuw bord');
  const id = r.id;
  r = await json(await raw('/kantoorpakket/bewaar', { id, titel: 'Weekbord', ...{}, inhoud: BORD }, lid));
  assert.ok(!r.error, 'bewaren lukt');
  r = await json(await raw('/kantoorpakket/open', { id }, lid));
  assert.equal(r.inhoud.lijsten.length, 2);
  const k = r.inhoud.lijsten[0].kaarten;
  assert.equal(k[0].label, 'bordeaux', 'een echt label blijft staan');
  assert.equal(k[0].voor, '2026-08-01');
  assert.equal(k[1].label, 'geen', 'een verzonnen label valt terug');
  assert.equal(k[1].voor, '', 'een rare datum valt weg');
  assert.equal(k[1].klaar, true, 'klaar blijft klaar');
  // het bord telt mee in de eigen lijst
  r = await json(await raw('/kantoorpakket/mijn', {}, lid));
  assert.ok(r.docs.some(d => d.id === id && d.soort === 'bord'));
});

test('2. de zaak heeft hetzelfde bord als team-drive; onzin-soorten blijven geweigerd', async () => {
  const roster = (await json(await raw('/supplier/roster', { code: 'KIKUNOI' }))).staff;
  const mgr = roster.find(x => x.role === 'manager');
  const sup = (await json(await raw('/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' }))).token;
  let r = await json(await raw('/supplier/kantoorpakket/maak', { soort: 'bord', titel: 'Teambord service' }, sup));
  assert.equal(r.ok, true, 'de zaak maakt een teambord');
  const id = r.id;
  r = await json(await raw('/supplier/kantoorpakket/bewaar', { id, titel: 'Teambord service', inhoud: BORD }, sup));
  assert.ok(!r.error);
  r = await json(await raw('/supplier/kantoorpakket/open', { id }, sup));
  assert.equal(r.inhoud.lijsten[0].kaarten[0].titel, 'Menukaart herzien');
  // een verzonnen soort wordt gewoon een tekstdocument, geen fout en geen rommel
  r = await json(await raw('/supplier/kantoorpakket/maak', { soort: 'toverstaf' }, sup));
  assert.equal(r.soort, 'tekst', 'onbekende soorten vallen terug op tekst');
});
