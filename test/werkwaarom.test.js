/* WAAROM LOOPT DIT PROJECT ACHTER: de oorzaak wordt gemeten, niet geraden.

   Vijf beweringen:

   1. ELKE BEVINDING IS EEN GETELD GETAL met de rijen erbij.
   2. ALS ALLE LATE TAKEN IETS DELEN, STAAT DAT ER. Dat is het geval waar de
      gedeelde clustermodule bewust langsloopt (een veld met één waarde
      onderscheidt in zijn eigen context niets), en hier is het juist het
      sterkste signaal.
   3. ALS ZE NIETS DELEN, ZEGT HIJ DAT OOK -- liever geen oorzaak dan de
      verkeerde met gezag.
   4. WAT DIT HUIS NIET WEET, STAAT ALS NIET GEMETEN. "De leverancier wacht" is
      het standaardvoorbeeld bij deze vraag en is hier nergens vastgelegd; dat
      wordt gezegd in plaats van verzonnen.
   5. VOORTGANG WORDT NIET OPNIEUW UITGEREKEND maar overgenomen van de bron.

   Draai los: node --experimental-sqlite --test test/werkwaarom.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkwaarom-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const gister = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

let W, B, PL, EEN, TWEE;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam: 'Pia' })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen: ['projectleider'] });
  PL = { werkruimte: W, lidToken: a.lidToken };

  // Project 1: drie late taken, alle drie op naam van dezelfde persoon.
  EEN = (await api('/project/maak', Object.assign({ naam: 'Uitrol Rotterdam',
    budget: 1000, uurtarief: 100, eind: gister(3) }, PL))).body.project;
  for (const t of ['Locaties bezoeken', 'Contracten tekenen', 'Meters plaatsen']) {
    await api('/taak/maak', Object.assign({ titel: t, projectId: EEN.id, wie: 'Bram',
      deadline: gister(5) }, PL));
  }

  // Project 2: twee late taken van verschillende mensen, in verschillende kolommen.
  TWEE = (await api('/project/maak', Object.assign({ naam: 'Migratie', eind: gister(1) }, PL))).body.project;
  const t1 = (await api('/taak/maak', Object.assign({ titel: 'Export bouwen', projectId: TWEE.id,
    wie: 'Ada', deadline: gister(4), prioriteit: 'hoog' }, PL))).body.taak;
  await api('/taak/maak', Object.assign({ titel: 'Import draaien', projectId: TWEE.id,
    wie: 'Bo', deadline: gister(2), prioriteit: 'laag' }, PL));
  await api('/taak/kolom', Object.assign({ taakId: t1.id, kolom: 'bezig' }, PL));
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. elke bevinding is een geteld getal, met de rijen erbij', async () => {
  const r = (await api('/project/waarom', Object.assign({ projectId: EEN.id }, PL))).body;
  const late = r.bevindingen.find(b => /deadline/.test(b.wat));
  assert.equal(late.aantal, 3, 'drie taken over hun deadline');
  assert.equal(late.van, 3, 'van de drie taken in dit project');
  assert.equal(late.rijen.length, 3, 'met de rijen erbij, niet alleen een getal');
  assert.equal(r.project.eindVoorbij, true, 'en de einddatum van het project is voorbij');
});

test('2. als alle late taken iets delen, staat dat er', async () => {
  const r = (await api('/project/waarom', Object.assign({ projectId: EEN.id }, PL))).body;
  const late = r.bevindingen.find(b => /deadline/.test(b.wat));
  assert.match(late.patroon, /alle 3 delen dezelfde wie: "Bram"/,
    'een veld waar alles hetzelfde is, is hier het sterkste signaal');
});

test('3. als ze niets delen, zegt hij dat ook', async () => {
  const r = (await api('/project/waarom', Object.assign({ projectId: TWEE.id }, PL))).body;
  const late = r.bevindingen.find(b => /deadline/.test(b.wat));
  assert.equal(late.aantal, 2);
  assert.match(late.patroon, /geen gedeeld patroon/i,
    'liever geen oorzaak dan de verkeerde met gezag');
});

test('4. wat dit huis niet weet, staat als niet gemeten', async () => {
  const r = (await api('/project/waarom', Object.assign({ projectId: EEN.id }, PL))).body;
  const lev = r.nietGemeten.find(n => /leverancier/.test(n.wat));
  assert.ok(lev, 'het standaardvoorbeeld bij deze vraag staat er met naam');
  assert.match(lev.reden, /kent in deze laag geen leverancier/i, 'met waarom hij niet te meten is');
  assert.match(r.let, /werklijst/i, 'en dat is een werklijst, geen voorbehoud');
});

test('5. voortgang komt van de bron en wordt niet opnieuw uitgerekend', async () => {
  const w = (await api('/project/waarom', Object.assign({ projectId: EEN.id }, PL))).body;
  const p = (await api('/project', Object.assign({ projectId: EEN.id }, PL))).body;
  assert.equal(w.voortgang.deel, p.voortgang.deel, 'zelfde percentage als het project zelf zegt');
  assert.equal(w.voortgang.taken, p.voortgang.taken);
  assert.equal(w.voortgang.let, p.voortgang.let, 'inclusief dezelfde uitleg erbij');
});
