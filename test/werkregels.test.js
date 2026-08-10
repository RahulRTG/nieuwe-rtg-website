/* BEDRIJFSREGELS: beleid dat iets tegenhoudt.

   "Contract boven 50.000 euro? Dan moet juridisch ernaar kijken en de CFO
   tekenen." Zeven beweringen, en ze komen allemaal uit de vraag hoe je hier
   onderuit zou komen:

   1. EEN REGEL VOOR EEN SOORT DIE NERGENS WORDT AFGEDWONGEN, BESTAAT NIET.
      Anders staat er beleid op een scherm dat niets doet, en dat leest als
      bewaking die er niet is.
   2. ONDER DE DREMPEL VERANDERT ER NIETS. Twee handtekeningen en klaar.
   3. BOVEN DE DREMPEL HOUDT DE REGEL HET TEGEN. Beide partijen getekend en
      tóch niet actief, met bij naam wat er ontbreekt.
   4. EEN MENS KEURT EEN KEER GOED. Wie twee rechten draagt, vinkt een
      vier-ogen-regel niet in zijn eentje af -- en het beheer-token keurt niet.
   5. MET DE VEREISTE GOEDKEURINGEN GAAT HIJ WEL ACTIEF.
   6. HET BEDRAG OPHOGEN IS DE UITWEG, EN DIE IS DICHT. Een goedkeuring geldt
      voor het bedrag waarop hij is gegeven; gaat de waarde omhoog, dan vervalt
      hij en valt het contract terug.
   7. GOEDKEUREN KAN ALLEEN WAAR EEN REGEL EROM VRAAGT.

   Draai los: node --experimental-sqlite --test test/werkregels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkregels-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Alleen de sleutels die de poort leest -- zie de kop van werkregister.test.js
   voor waarom `id` en `naam` hier niet in horen. */
async function lid(ruimte, beheer, naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: ruimte, naam })).body;
  await api('/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, rollen });
  return { werkruimte: ruimte, lidToken: a.lidToken };
}
const teken = (con, partij, naam, wie) =>
  api('/contract/teken', Object.assign({ contractId: con, partij, naam }, wie));

let W, B, JU, FI, DI;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  JU = await lid(W, B, 'Joris', ['jurist']);      // recht
  FI = await lid(W, B, 'Fien', ['financieel']);    // geld, cijfer, klant -- GEEN geld.goedkeuren
  DI = await lid(W, B, 'Dana', ['directie']);      // alles, inclusief geld.goedkeuren en recht

  const r = await api('/regel/zet', { werkruimte: W, beheerToken: B, soort: 'contract',
    boven: 50000, eist: ['recht', 'geld.goedkeuren'] });
  assert.equal(r.status, 200, 'de regel hoort te staan voordat de rest begint');
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een regel voor een soort die nergens wordt afgedwongen, bestaat niet', async () => {
  const uit = await api('/regel/zet', { werkruimte: W, beheerToken: B, soort: 'project',
    boven: 10000, eist: ['geld.goedkeuren'] });
  assert.equal(uit.status, 400, 'er is geen plek waar zo\'n regel iets tegenhoudt');
  assert.match(uit.body.let, /theater/i, 'en het antwoord zegt waarom');

  const lijst = (await api('/regels', { werkruimte: W, beheerToken: B })).body;
  assert.equal(lijst.regels.length, 1, 'alleen de contractregel staat er');
  assert.match(lijst.regels[0].afgedwongen, /activeren van een contract/i, 'elke regel noemt WAAR hij bijt');
});

test('2. onder de drempel verandert er niets', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Kantoorplanten',
    wederpartij: 'Groenhof', soort: 'leverancier', waarde: 4000 }, JU))).body.contract;
  await teken(c.id, 'wij', 'Joris', JU);
  const na = await teken(c.id, 'wederpartij', 'Groenhof BV', JU);
  assert.equal(na.body.contract.status, 'actief', 'twee handtekeningen en klaar');

  const k = (await api('/keuring', Object.assign({ soort: 'contract', id: c.id }, JU))).body;
  assert.deepEqual(k.regels, [], 'dit contract valt onder geen enkele regel');
});

test('3. boven de drempel houdt de regel het tegen', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Vervoer Fjordlijn',
    wederpartij: 'Fjordlijn Transport', soort: 'leverancier', waarde: 120000 }, JU))).body.contract;
  await teken(c.id, 'wij', 'Joris', JU);
  const na = await teken(c.id, 'wederpartij', 'Fjordlijn BV', JU);

  assert.equal(na.body.contract.status, 'wacht op goedkeuring', 'beide getekend en tóch niet actief');
  assert.deepEqual(na.body.ontbreekt.sort(), ['geld.goedkeuren', 'recht'], 'en er staat bij naam wat ontbreekt');
  assert.match(na.body.let, /bedrijfsregel eist goedkeuring/i);
});

test('4. een mens keurt een keer goed, en het beheer-token keurt niet', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Wagenpark',
    wederpartij: 'Kaap Lease', soort: 'leverancier', waarde: 200000 }, JU))).body.contract;
  await teken(c.id, 'wij', 'Joris', JU);
  await teken(c.id, 'wederpartij', 'Kaap Lease BV', JU);

  const beheer = await api('/keur', { werkruimte: W, beheerToken: B, soort: 'contract', id: c.id, recht: 'recht' });
  assert.equal(beheer.status, 403, 'het beheer-token keurt niet goed');

  const zonderRecht = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'geld.goedkeuren' }, FI));
  assert.equal(zonderRecht.status, 403, 'Fien heeft "geld" maar niet "geld.goedkeuren"');

  /* Dana is directie en draagt BEIDE vereiste rechten. Zij mag er één afvinken
     en daarna niet de tweede: anders is "vier ogen" één paar. */
  const eerste = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'recht' }, DI));
  assert.equal(eerste.status, 200);
  const tweede = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'geld.goedkeuren' }, DI));
  assert.equal(tweede.status, 409, 'dezelfde mens keurt niet twee keer goed');
  assert.match(tweede.body.error, /in zijn eentje/i);

  const k = (await api('/keuring', Object.assign({ soort: 'contract', id: c.id }, JU))).body;
  assert.equal(k.status, 'wacht op goedkeuring', 'en het contract wacht dus nog');
  assert.deepEqual(k.ontbreekt, ['geld.goedkeuren']);
});

test('5. met de vereiste goedkeuringen gaat hij wel actief', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Beveiliging',
    wederpartij: 'Nachtwacht', soort: 'leverancier', waarde: 90000 }, JU))).body.contract;
  await teken(c.id, 'wij', 'Joris', JU);
  await teken(c.id, 'wederpartij', 'Nachtwacht BV', JU);

  await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'recht' }, JU));
  const laatste = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'geld.goedkeuren' }, DI));
  assert.equal(laatste.body.status, 'actief', 'twee verschillende mensen, twee rechten, rond');
  assert.match(laatste.body.let, /staat op actief/i);
});

test('6. het bedrag ophogen is de uitweg, en die is dicht', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Schoonmaak',
    wederpartij: 'Helder', soort: 'leverancier', waarde: 60000 }, JU))).body.contract;
  await teken(c.id, 'wij', 'Joris', JU);
  await teken(c.id, 'wederpartij', 'Helder BV', JU);
  await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'recht' }, JU));
  const rond = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'geld.goedkeuren' }, DI));
  assert.equal(rond.body.status, 'actief');

  const op = await api('/contract/zet', Object.assign({ contractId: c.id, titel: 'Schoonmaak',
    wederpartij: 'Helder', soort: 'leverancier', waarde: 5000000 }, JU));
  assert.equal(op.body.contract.status, 'wacht op goedkeuring', 'ophogen zet het contract terug');
  assert.match(op.body.let, /vervallen/i, 'en zegt dat de oude goedkeuringen zijn vervallen');

  const k = (await api('/keuring', Object.assign({ soort: 'contract', id: c.id }, JU))).body;
  assert.equal(k.goedkeuringen.length, 0, 'geen enkele goedkeuring telt nog mee');
  assert.equal(k.vervallen.length, 2, 'maar ze staan er wel, met de reden');
  assert.match(k.vervallen[0].reden, /omhoog/i);
});

test('7. goedkeuren kan alleen waar een regel erom vraagt', async () => {
  const c = (await api('/contract/zet', Object.assign({ titel: 'Koffie',
    wederpartij: 'Bonenhuis', soort: 'leverancier', waarde: 900 }, JU))).body.contract;
  const uit = await api('/keur', Object.assign({ soort: 'contract', id: c.id, recht: 'recht' }, JU));
  assert.equal(uit.status, 409, 'onder de drempel vraagt geen regel om een goedkeuring');
  assert.match(uit.body.let, /alleen de twee handtekeningen/i);
});

/* HET TWEEDE AANGRIJPINGSPUNT. De laag was pas iets waard als hij niet één
   trucje voor contracten is: een besluit wordt niet vastgehouden maar
   GEWEIGERD, en dat verschil staat in het register zelf. */
test('8. een besluitregel weigert het sluiten van de stemronde', async () => {
  const r = await api('/regel/zet', { werkruimte: W, beheerToken: B, soort: 'besluit',
    besluitSoort: 'investering', eist: ['geld.goedkeuren'] });
  assert.equal(r.status, 200);
  assert.match(r.body.afgedwongen, /sluiten van de stemronde/i, 'en hij noemt hoe hij tegenhoudt');

  const b = (await api('/besluit/maak', Object.assign({ titel: 'Tweede vestiging',
    onderbouwing: 'De huidige hal zit vol.', soort: 'investering' }, JU))).body.besluit;
  await api('/besluit/stemronde', Object.assign({ besluitId: b.id }, JU));
  await api('/besluit/stem', Object.assign({ besluitId: b.id, stem: 'voor' }, JU));

  const dicht = await api('/besluit/sluit', Object.assign({ besluitId: b.id, evalueerOp: '2027-06-01' }, JU));
  assert.equal(dicht.status, 409, 'zonder de CFO gaat dit besluit niet dicht');
  assert.deepEqual(dicht.body.ontbreekt, ['geld.goedkeuren']);

  /* En een besluit van een ANDERE soort valt er niet onder: de voorwaarde van
     een besluitregel is de soort, niet het bestaan van een regel. */
  const ander = (await api('/besluit/maak', Object.assign({ titel: 'Nieuw logo',
    onderbouwing: 'Het oude is van 2012.', soort: 'product' }, JU))).body.besluit;
  await api('/besluit/stemronde', Object.assign({ besluitId: ander.id }, JU));
  await api('/besluit/stem', Object.assign({ besluitId: ander.id, stem: 'voor' }, JU));
  const los = await api('/besluit/sluit', Object.assign({ besluitId: ander.id, evalueerOp: '2027-06-01' }, JU));
  assert.equal(los.body.besluit.status, 'aangenomen', 'een productbesluit gaat gewoon dicht');

  // Met de goedkeuring erbij gaat de eerste alsnog dicht.
  await api('/keur', Object.assign({ soort: 'besluit', id: b.id, recht: 'geld.goedkeuren' }, DI));
  const alsnog = await api('/besluit/sluit', Object.assign({ besluitId: b.id, evalueerOp: '2027-06-01' }, JU));
  assert.equal(alsnog.body.besluit.status, 'aangenomen', 'met de CFO erbij wel');
});

test('9. een regel draagt alleen de voorwaarde die zijn soort kent', async () => {
  const metBedrag = await api('/regel/zet', { werkruimte: W, beheerToken: B, soort: 'besluit',
    besluitSoort: 'prijs', boven: 1000, eist: ['geld.goedkeuren'] });
  assert.equal(metBedrag.status, 400, 'een besluitregel leest nergens een bedrag');

  const metSoort = await api('/regel/zet', { werkruimte: W, beheerToken: B, soort: 'contract',
    besluitSoort: 'prijs', boven: 1000, eist: ['recht'] });
  assert.equal(metSoort.status, 400, 'en een contractregel drempelt niet op een besluitsoort');
});
