/* RTG Horeca: DE WIJK -- welke tafels zijn van wie.

   De werklijst toonde de hele zaak, en dat stond er ook bij: een sectie-indeling
   bestond nergens, dus deed het scherm niet alsof. Eerlijk, maar op een avond
   met veertig tafels is "alles" geen werklijst maar een muur.

   Een wijk mag werk VERDELEN en nooit VERBERGEN. Dat is geen slogan maar vier
   toetsbare regels:

   1. EEN TAFEL ZONDER WIJK IS VAN IEDEREEN. Wie hem vergeet in te delen,
      verliest hem niet.
   2. EEN WIJK DIE NIEMAND DRAAGT IS VAN IEDEREEN. Iemand klokt uit en het werk
      valt terug naar de ploeg, niet in een gat.
   3. EEN TAFEL HOORT BIJ HOOGSTENS EEN WIJK, en verhuizen gebeurt zichtbaar.
   4. EEN LIJST DIE FILTERT, ZEGT HOEVEEL HIJ NIET TOONT. Een filter dat zwijgt
      over wat het wegliet, is een filter waarin werk verdwijnt.

   En twee over wie wat mag: indelen is manager-werk, nemen en loslaten doet de
   bediening zelf -- maar loslaten alleen wat van jou is.

   Draai: node --experimental-sqlite --test test/horeca-wijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

/* De demozaak heeft twee mensen: een manager en een vloermedewerker. Dat is
   precies genoeg voor wat hier bewezen moet worden -- een collega is een collega,
   ook als hij toevallig de baas is. Waar het om gaat is: draagt IEMAND ANDERS
   deze wijk. */
let BASE, child, tokM, tokA, naamM, naamA;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wijk-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body) => api('/api/supplier/horeca' + pad, body, tokM);
const A = (pad, body) => api('/api/supplier/horeca' + pad, body, tokA);


test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const vloer = roster.staff.find(x => x.id !== mgr.id);
  assert.ok(vloer, 'de demozaak heeft naast de manager nog iemand');
  naamM = mgr.name; naamA = vloer.name;
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokA = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: vloer.id, pin: '5678' })).body.token;
  assert.ok(tokM && tokA, 'beide inlogs');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function tafelMetVerzoek(naam) {
  const r = (await M('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  const qr = (await M('/gast/qr', { tafel: naam })).body;
  const aan = (await api('/api/gast/aanschuiven', { token: qr.token, naam: 'Gast' })).body;
  await api('/api/gast/verzoek', { sleutel: aan.sleutel, soort: 'hulp', tekst: 'iets met ' + naam });
  return r.id;
}
const lijst = async (fn, wijkOpt) => (await fn('/werklijst', Object.assign({ modus: 'alles' }, wijkOpt || {}))).body;
const taken = (d) => d.nu.concat(d.open);

test('1. indelen is manager-werk; nemen doet de bediening zelf', async () => {
  const nee = await A('/wijk/zet', { naam: 'Raamkant', tafels: ['W1'] });
  assert.ok(nee.status === 403 || nee.status === 401, 'de vloer deelt niet in: ' + nee.status);

  const w = await M('/wijk/zet', { naam: 'Raamkant', tafels: ['W1', 'W2'] });
  assert.equal(w.status, 200);
  assert.equal(w.body.wijk.tafels.length, 2);

  const genomen = await A('/wijk/neem', { wijkId: w.body.wijk.id });
  assert.equal(genomen.status, 200, 'de bediening neemt hem zelf');
  assert.equal(genomen.body.van.naam, naamA);
});

test('2. een tweede die dezelfde wijk neemt, hoort wie hem heeft', async () => {
  const w = (await M('/wijken', {})).body.wijken.find(x => x.naam === 'Raamkant');
  /* Ook een manager pakt een wijk niet stilzwijgend af: nemen is geen recht maar
     een handeling, en twee mensen die denken dat een tafel van hen is, is erger
     dan niemand. Vrijmaken is iets anders -- dat mag hij wel (zie onder). */
  const tweede = await M('/wijk/neem', { wijkId: w.id });
  assert.equal(tweede.status, 409);
  assert.equal(tweede.body.code, 'al-genomen');
  assert.match(tweede.body.error, new RegExp(naamA), 'met de naam erbij: ' + tweede.body.error);

  const magWel = await M('/wijk/laat', { wijkId: w.id });
  assert.equal(magWel.status, 200, 'een manager mag een wijk wel vrijmaken');
  await A('/wijk/neem', { wijkId: w.id });   // terug in de oude stand
});

test('2b. loslaten kan alleen wat van jou is', async () => {
  const t = await M('/wijk/zet', { naam: 'Bar', tafels: ['W7'] });
  await M('/wijk/neem', { wijkId: t.body.wijk.id });
  const nee = await A('/wijk/laat', { wijkId: t.body.wijk.id });
  assert.equal(nee.status, 409, 'de vloer laat de wijk van een ander niet los');
  assert.match(nee.body.error, new RegExp(naamM), 'en hoort wie hem draagt: ' + nee.body.error);
  await M('/wijk/laat', { wijkId: t.body.wijk.id });
  await M('/wijk/weg', { wijkId: t.body.wijk.id });
});

test('3. een tafel hoort bij hoogstens een wijk, en verhuizen is zichtbaar', async () => {
  const tweede = await M('/wijk/zet', { naam: 'Terras', tafels: ['W2', 'W3'] });
  assert.equal(tweede.status, 200);
  assert.equal(tweede.body.verhuisd.length, 1, 'W2 kwam uit een andere wijk');
  assert.equal(tweede.body.verhuisd[0].tafel, 'W2');
  assert.equal(tweede.body.verhuisd[0].van, 'Raamkant');
  assert.match(tweede.body.let, /hoogstens een wijk/);

  const wijken = (await M('/wijken', {})).body.wijken;
  assert.deepEqual(wijken.find(x => x.naam === 'Raamkant').tafels, ['W1'], 'en hij staat er niet meer in');
});

test('4. de wijklens toont mijn tafels, en zegt wat hij niet toont', async () => {
  await tafelMetVerzoek('W1');   // van Raamkant, dus van A
  await tafelMetVerzoek('W3');   // van Terras, en die draagt niemand
  await tafelMetVerzoek('W9');   // in geen enkele wijk

  const alles = await lijst(A, { wijk: 'alles' });
  const namen = taken(alles).map(t => t.tafel);
  assert.ok(namen.includes('W1') && namen.includes('W3') && namen.includes('W9'),
    'zonder lens staat alles er: ' + namen.join(', '));
  assert.equal(alles.verborgen, 0);

  const mijn = await lijst(A, { wijk: 'mijn' });
  const mijne = taken(mijn).map(t => t.tafel);
  assert.ok(mijne.includes('W1'), 'mijn eigen wijk staat er');
  assert.ok(mijne.includes('W3'), 'regel 2: een wijk die niemand draagt is van iedereen');
  assert.ok(mijne.includes('W9'), 'regel 1: een tafel zonder wijk is van iedereen');
  assert.deepEqual(mijn.mijnWijken, ['Raamkant']);
});

test('5. een tafel van een COLLEGA valt weg, en dat staat erbij', async () => {
  const terras = (await M('/wijken', {})).body.wijken.find(x => x.naam === 'Terras');
  await M('/wijk/neem', { wijkId: terras.id });   // nu draagt de collega het terras

  const mijn = await lijst(A, { wijk: 'mijn' });
  const mijne = taken(mijn).map(t => t.tafel);
  assert.ok(mijne.includes('W1'), 'mijn eigen tafel staat er nog');
  assert.ok(!mijne.includes('W3'), 'de tafel van de collega niet meer');
  assert.ok(mijne.includes('W9'), 'en de tafel zonder wijk nog steeds');
  assert.ok(mijn.verborgen >= 1, 'wat wegviel is geteld: ' + mijn.verborgen);
  assert.match(mijn.let, /buiten uw wijk/, 'en het staat er met zoveel woorden bij');

  const vanCollega = await lijst(M, { wijk: 'mijn' });
  assert.ok(taken(vanCollega).map(t => t.tafel).includes('W3'), 'bij de collega staat hij wel');
});

/* EERLIJK OVER WAT DEZE LAATSTE TOETS WEL EN NIET BEWIJST. Dat de tafels van
   een weggehaalde wijk bij iedereen terugkomen, VOLGT uit regel 1 -- een tafel
   in geen enkele wijk is van iedereen -- en die regel heeft zijn eigen toets
   hierboven. Er is dan ook geen mutatie in wijk.js gevonden die deze toets laat
   zakken zonder er een andere mee te nemen; drie pogingen bleven groen.

   Hij staat er toch, en met opzet: hij bewaakt de VOLGENDE versie van weg().
   Een weghaal-functie die de tafels "opruimt", de dienst laat staan of de
   tafels naar een restwijk verplaatst, is een voor de hand liggende
   verbetering die precies dit stukmaakt. Een toets die vandaag niets vangt maar
   morgen de enige is die iets zegt, is geen dode toets. */
test('6. een wijk weghalen laat de tafels bij iedereen, niet in een gat', async () => {
  const terras = (await M('/wijken', {})).body.wijken.find(x => x.naam === 'Terras');
  const weg = await M('/wijk/weg', { wijkId: terras.id });
  assert.equal(weg.status, 200);
  assert.match(weg.body.let, /bij iedereen/);

  for (const [wie, deur] of [['de vloer', A], ['de collega die hem droeg', M]]) {
    const mijn = await lijst(deur, { wijk: 'mijn' });
    assert.ok(taken(mijn).map(t => t.tafel).includes('W3'),
      'de tafel van de weggehaalde wijk staat weer bij ' + wie);
    assert.ok(!mijn.mijnWijken.includes('Terras'), 'en de wijk zelf is weg bij ' + wie);
  }
});
