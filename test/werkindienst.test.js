/* HET INDIENSTPROCES: de stap die het systeem ziet, wordt gemeten.

   Vijf beweringen, en de eerste is de reden dat deze module bestaat naast zijn
   spiegel (het uitdienstproces):

   1. EEN GEMETEN STAP HEEFT GEEN VINKJE. Afvinken wordt geweigerd, ook als de
      stap al gedaan IS -- een vinkje naast een meting is dezelfde waarheid op
      twee plekken, en dan gelooft niemand er meer een van zodra ze uiteenlopen.
   2. EEN GEMETEN STAP GAAT VANZELF OP GROEN zodra de handeling ergens anders in
      dit huis echt is gedaan. Niemand start hier iets.
   3. "NOG NIET" HEEFT ALTIJD EEN REDEN, en die komt uit de meting zelf.
   4. MENSENWERK DRAAGT EEN NAAM, en gaat niet twee keer.
   5. HET DOSSIER ONTSTAAT VANZELF; eraan denken is precies wat er misgaat in de
      week dat iemand begint.

   Draai los: node --test test/werkindienst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkindienst-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, HR, IT, NIEUW;
const stand = async (lidId) =>
  (await api('/indienst', Object.assign({ lidId }, HR.cred))).body.indienst[0];

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;

  const mk = async (naam, rollen) => {
    const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
    await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
    if (rollen) await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
    /* De sleutels en het id STRIKT gescheiden. `/indienst` en `/apparaten`
       lezen allebei `lidId` als filter, dus een helper die hem meegeeft laat
       een toets stil naar één rij kijken terwijl hij denkt alles te zien. */
    return { cred: { werkruimte: W, lidToken: a.lidToken }, lidId: a.lidId };
  };
  HR = await mk('Hanna', ['hr']);
  IT = await mk('Ismail', ['it']);
  NIEUW = await mk('Nora', null);   // toegelaten, verder nog niets
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een gemeten stap heeft geen vinkje, ook niet als hij al gedaan is', async () => {
  const uit = await api('/indienst/stap', Object.assign({ lidId: NIEUW.lidId, stap: 'rollen toegekend' }, HR.cred));
  assert.equal(uit.status, 409, 'afvinken wordt geweigerd');
  assert.match(uit.body.error, /gemeten en niet afgevinkt/i);
  assert.match(uit.body.let, /tweede waarheid/i, 'met de reden erbij');

  /* En ook nadat de handeling ECHT is gedaan blijft het vinkje geweigerd: het
     gaat niet om "nog niet gebeurd" maar om wie de waarheid draagt. */
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: NIEUW.lidId, rollen: ['medewerker'] });
  const nogsteeds = await api('/indienst/stap', Object.assign({ lidId: NIEUW.lidId, stap: 'rollen toegekend' }, HR.cred));
  assert.equal(nogsteeds.status, 409);
  assert.equal(nogsteeds.body.gedaan, true, 'de stap staat wel op gedaan');
});

test('2. een gemeten stap gaat vanzelf op groen, en 3. "nog niet" heeft een reden', async () => {
  const voor = await stand(NIEUW.lidId);
  const werkplekVoor = voor.stappen.find(s => s.stap === 'werkplek uitgegeven');
  assert.equal(werkplekVoor.gedaan, false);
  assert.match(werkplekVoor.waarom, /nog geen apparaat/i, 'de reden komt uit de meting');

  const functieVoor = voor.stappen.find(s => s.stap === 'functie en afdeling ingevuld');
  assert.equal(functieVoor.gedaan, false);
  assert.match(functieVoor.waarom, /nog geen functie/i);

  /* De handeling gebeurt in een HEEL ANDERE module (IT geeft een laptop uit).
     Niemand raakt het instroomdossier aan. */
  await api('/apparaat/zet', Object.assign({ soort: 'laptop', nummer: 'NB-2291', model: 'X13' }, IT.cred));
  const app = (await api('/apparaten', IT.cred)).body.apparaten[0];
  const uit = await api('/apparaat/uitgeven', Object.assign({ apparaatId: app.id, lidId: NIEUW.lidId }, IT.cred));
  assert.equal(uit.status, 200, 'IT geeft de laptop uit');

  const na = await stand(NIEUW.lidId);
  const werkplekNa = na.stappen.find(s => s.stap === 'werkplek uitgegeven');
  assert.equal(werkplekNa.gedaan, true, 'de stap staat vanzelf op groen');
  assert.match(werkplekNa.waarom, /NB-2291/, 'met wat er gemeten is erbij');
  assert.equal(werkplekNa.aard, 'gemeten', 'en de aard staat erbij, apart van mensenwerk');
});

test('4. mensenwerk draagt een naam, en gaat niet twee keer', async () => {
  const eerste = await api('/indienst/stap', Object.assign({ lidId: NIEUW.lidId,
    stap: 'welkomstgesprek gevoerd', notitie: 'Rondleiding gedaan' }, HR.cred));
  assert.equal(eerste.status, 200);

  const s = (await stand(NIEUW.lidId)).stappen.find(x => x.stap === 'welkomstgesprek gevoerd');
  assert.equal(s.aard, 'mensenwerk');
  assert.equal(s.door, 'Hanna', 'de verklaring van een mens draagt zijn naam');
  assert.equal(s.notitie, 'Rondleiding gedaan');

  const nog = await api('/indienst/stap', Object.assign({ lidId: NIEUW.lidId,
    stap: 'welkomstgesprek gevoerd' }, HR.cred));
  assert.equal(nog.status, 409, 'en hij gaat niet twee keer');
});

test('5. het dossier ontstaat vanzelf, voor iedereen die is toegelaten', async () => {
  const alles = (await api('/indienst', HR.cred)).body;
  assert.equal(alles.aantal, 3, 'alle drie de toegelaten leden hebben een dossier');
  assert.ok(alles.nietKlaar >= 1, 'en wat nog niet af is, wordt geteld');
  assert.ok(alles.indienst.every(r => r.stappen.length === 6), 'zes stappen per mens');

  /* De aanmelding die nog niet is toegelaten hoort er NIET in te staan: een
     instroomproces voor iemand die misschien nooit begint, is ruis. */
  await api('/lid/aanmeld', { werkruimte: W, naam: 'Twijfel' });
  const na = (await api('/indienst', HR.cred)).body;
  assert.equal(na.aantal, 3, 'een openstaande aanmelding krijgt geen instroomdossier');
});
