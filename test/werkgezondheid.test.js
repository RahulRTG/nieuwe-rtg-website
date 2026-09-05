/* GEZONDHEID EN DE DAGBRIEFING: één cijfer dat niet liegt.

   Vijf beweringen, en ze gaan allemaal over de manier waarop zo'n cijfer
   normaal gesproken onwaar wordt:

   1. EEN LEGE ORGANISATIE SCOORT GEEN 100%. Wat niet gemeten kan worden telt
      niet als gezond; anders is het cijfer het hoogst op de dag dat er nog
      niets is.
   2. HET CIJFER IS EEN BREUK MET EEN ZICHTBARE NOEMER. Groen van MEETBAAR, en
      wat niet meetbaar was staat er apart bij.
   3. EEN ROOD SIGNAAL DRUKT HET CIJFER, met het gemeten getal erbij.
   4. DE BRIEFING ZEGT HETZELFDE ALS HET BORD. Dezelfde signalen, dezelfde
      getallen -- geen tweede samenvatting.
   5. "NIET GEMETEN" STAAT NOOIT TUSSEN HET ADVIES. Geen signaal is geen goed
      nieuws.

   Draai los: node --test test/werkgezondheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkgezondheid-'));
const api = (pad, body) => fetch(BASE + (pad.startsWith('/api/') ? pad : '/api/bedrijf' + pad), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, CRED;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  CRED = { werkruimte: W, beheerToken: B };   // directie: draagt alle rechten
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een lege organisatie krijgt geen 100% maar geen cijfer', async () => {
  const g = (await api('/api/bedrijf/gezondheid', CRED)).body;
  assert.equal(g.cijfer, null, 'zonder enig meetbaar signaal staat er geen cijfer');
  assert.equal(g.gemeten.meetbaar, 0);
  assert.equal(g.nietGemeten.length, g.gemeten.van, 'alle signalen staan als niet gemeten');
  assert.match(g.let, /geen 100% en ook geen 0%/i, 'en dat wordt met zoveel woorden gezegd');
  assert.ok(g.nietGemeten.every(r => r.reden), 'elk niet-gemeten signaal draagt zijn reden');
});

test('2. het cijfer is een breuk met een zichtbare noemer', async () => {
  /* Eén blok meetbaar maken: een contract mét einddatum, dus een groen
     contractsignaal en een groen "zonder einddatum"-signaal. */
  await api('/contract/zet', Object.assign({ titel: 'Schoonmaak', wederpartij: 'Helder',
    soort: 'leverancier', eindigt: '2027-12-31', opzegtermijnDagen: 30 }, CRED));

  const g = (await api('/gezondheid', CRED)).body;
  assert.equal(g.gemeten.meetbaar, 2, 'het rechtblok levert twee signalen op');
  assert.equal(g.gemeten.groen, 2);
  assert.equal(g.cijfer, 100, 'twee van twee groen');
  assert.ok(g.gemeten.van > g.gemeten.meetbaar, 'en de rest is nog niet meetbaar');
  assert.match(g.let, /tellen in geen enkele noemer mee/i);
});

test('3. een rood signaal drukt het cijfer, met het gemeten getal erbij', async () => {
  await api('/contract/zet', Object.assign({ titel: 'Koffie', wederpartij: 'Bonenhuis',
    soort: 'leverancier' }, CRED));   // geen einddatum: dit signaal wordt rood

  const g = (await api('/gezondheid', CRED)).body;
  assert.equal(g.cijfer, 50, 'een van de twee meetbare signalen staat rood');
  const rood = g.rood.find(r => /zonder einddatum/.test(r.id));
  assert.ok(rood, 'het signaal staat bij rood');
  assert.equal(rood.aantal, 1, 'met het gemeten aantal');
  assert.ok(rood.doe, 'en met wat je eraan doet');
});

test('4. de briefing zegt hetzelfde als het bord', async () => {
  const g = (await api('/gezondheid', CRED)).body;
  const d = (await api('/dagbeeld', CRED)).body;

  assert.equal(d.cijfer, g.cijfer, 'zelfde cijfer');
  assert.deepEqual(d.gemeten, g.gemeten, 'zelfde noemer');
  assert.equal(d.advies.length, g.rood.length, 'evenveel adviespunten als rode signalen');
  assert.equal(d.advies[0].aantal, g.rood[0].aantal, 'en met dezelfde getallen');
  assert.match(d.advies[0].wat, /^1 contracten zonder einddatum$/);
  assert.match(d.rest, /op groen/i);
});

test('5. "niet gemeten" staat nooit tussen het advies', async () => {
  const d = (await api('/dagbeeld', CRED)).body;
  assert.ok(d.nietGemeten.length, 'er zijn nog niet-meetbare signalen');
  const namen = d.advies.map(a => a.wat).join(' | ');
  assert.ok(!d.nietGemeten.some(n => namen.includes(n.wat)),
    'geen enkel niet-gemeten signaal staat als advies');
  assert.match(d.let, /geen signaal.*geen goed nieuws/i, 'en het antwoord zegt waarom dat verschil telt');
});
