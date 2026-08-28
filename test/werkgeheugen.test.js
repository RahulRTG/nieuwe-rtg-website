/* HET GEHEUGEN VAN EEN BESLUIT: waarom hebben we dit gedaan, en wat raakte het.

   Zeven beweringen, en ze gaan allemaal over de vraag wat dit over drie jaar
   nog waard is:

   1. EEN KOPPELING WORDT BEWEZEN, NIET GELOOFD. Een id dat niet bestaat en een
      object dat de koppelaar niet mag zien geven HETZELFDE antwoord -- anders
      is dit veld een manier om te toetsen welke ids er in een gesloten module
      bestaan.
   2. DE TITEL VAN TOEN OVERLEEFT EEN HERNOEMING. Het besluit ging over wat het
      toen heette; dat de wederpartij later anders heet, verandert dat niet.
   3. EEN VERDWENEN OBJECT VERDAMPT NIET. Het staat er als verdwenen, met de
      titel van toen -- want het besluit ging er wel degelijk over.
   4. IEDERE LEZER LOST OP MET ZIJN EIGEN REGISTER. Wie het recht mist krijgt
      een TELLING en nergens de titel.
   5. INTREKKEN WIST NIETS, en kan niet zonder reden.
   6. DE OMGEKEERDE VRAAG STAAT IN HET DOSSIER: welke besluiten raken dit
      object? En `null` (geen recht) is iets anders dan `[]` (niets gevonden).
   7. EEN EVALUATIEDATUM ZONDER UITKOMST IS EEN AGENDAPUNT. De uitkomst is op
      te schrijven, stapelt, en vraagt een onderbouwing.

   Draai los: node --test test/werkgeheugen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkgeheugen-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* De helper geeft ALLEEN de sleutels terug die de poort leest. Zou hij ook
   `id` of `naam` teruggeven, dan schrijft Object.assign ze over de velden van
   het verzoek heen -- dat kostte in test/werkregister.test.js twee toetsen. */
async function lid(ruimte, beheer, naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: ruimte, naam })).body;
  await api('/lid/besluit', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: ruimte, beheerToken: beheer, lidId: a.lidId, rollen });
  return { werkruimte: ruimte, lidToken: a.lidToken };
}

let W, B, JU, BE, EN, VK, CONTRACT, BESLUIT;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'Noordkaap Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;

  JU = await lid(W, B, 'Joris', ['jurist']);          // recht, besluit, kennis
  BE = await lid(W, B, 'Bea', ['bestuur']);            // cijfer, besluit, journaal -- GEEN recht
  EN = await lid(W, B, 'Enno', ['bestuur', 'engineering']); // besluit EN bouw
  VK = await lid(W, B, 'Vera', ['verkoop']);           // klant, kennis -- GEEN besluit

  CONTRACT = (await api('/contract/zet', Object.assign({ titel: 'Raamovereenkomst Fjordlijn',
    wederpartij: 'Fjordlijn Transport', soort: 'leverancier', eindigt: '2027-01-01',
    opzegtermijnDagen: 60, waarde: 120000 }, JU))).body.contract;

  BESLUIT = (await api('/besluit/maak', Object.assign({ titel: 'Vervoer bij Fjordlijn onderbrengen',
    onderbouwing: 'Drie offertes vergeleken; Fjordlijn is 9% duurder maar levert binnen 24 uur.',
    soort: 'contract', alternatieven: ['Zelf rijden', 'Kaap Logistiek'] }, JU))).body.besluit;
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een koppeling wordt bewezen, en onbekend lijkt op onzichtbaar', async () => {
  const verzonnen = await api('/besluit/raakt', Object.assign({ besluitId: BESLUIT.id,
    type: 'contract', id: 'bestaatniet' }, JU));
  assert.equal(verzonnen.status, 404, 'een id dat niet bestaat wordt niet gekoppeld');

  /* Bea mag besluiten maken maar heeft geen recht "recht": voor haar bestaat
     de contractsoort niet. Het antwoord MOET gelijk zijn aan dat hierboven --
     verschil zou verraden dat dit contract bestaat. */
  const blind = await api('/besluit/raakt', Object.assign({ besluitId: BESLUIT.id,
    type: 'contract', id: CONTRACT.id }, BE));
  assert.equal(blind.status, 404, 'wie de soort niet mag zien, koppelt er niet aan');
  assert.equal(blind.body.error, verzonnen.body.error, 'en krijgt exact dezelfde melding');

  const goed = await api('/besluit/raakt', Object.assign({ besluitId: BESLUIT.id,
    type: 'contract', id: CONTRACT.id }, JU));
  assert.equal(goed.status, 200);
  assert.equal(goed.body.koppeling.titelToen, 'Raamovereenkomst Fjordlijn', 'de titel van nu wordt meebewaard');

  const nog = await api('/besluit/raakt', Object.assign({ besluitId: BESLUIT.id,
    type: 'contract', id: CONTRACT.id }, JU));
  assert.equal(nog.status, 409, 'twee keer dezelfde koppeling is geen twee koppelingen');
});

test('2. de titel van toen overleeft een hernoeming', async () => {
  await api('/contract/zet', Object.assign({ contractId: CONTRACT.id,
    titel: 'Raamovereenkomst Kaap Noord (voorheen Fjordlijn)',
    wederpartij: 'Kaap Noord Logistiek', soort: 'leverancier' }, JU));

  const g = (await api('/besluit/geheugen', Object.assign({ besluitId: BESLUIT.id }, JU))).body;
  const k = g.raakt.find(r => r.type === 'contract');
  assert.equal(k.stand, 'bestaat');
  assert.equal(k.titelToen, 'Raamovereenkomst Fjordlijn', 'waar het besluit over ging');
  assert.match(k.titelNu, /Kaap Noord/, 'en hoe het nu heet');
  assert.equal(k.hernoemd, true, 'het antwoord zegt zelf dat die twee uiteenlopen');
});

test('3. een verdwenen object verdampt niet', async () => {
  await api('/vlag/zet', Object.assign({ naam: 'fjord-tarief', opruimen: '2027-03-01',
    omschrijving: 'Nieuw tarief van de vervoerder' }, EN));
  const besluit = (await api('/besluit/maak', Object.assign({ titel: 'Tarief achter een vlag uitrollen',
    onderbouwing: 'Eerst op acceptatie, daarna productie.', soort: 'lancering' }, EN))).body.besluit;
  const koppel = await api('/besluit/raakt', Object.assign({ besluitId: besluit.id,
    type: 'vlag', id: 'fjord-tarief' }, EN));
  assert.equal(koppel.status, 200);

  const weg = await api('/vlag/weg', Object.assign({ naam: 'fjord-tarief' }, EN));
  assert.equal(weg.status, 200, 'de vlag staat nergens aan en mag dus opgeruimd worden');

  const g = (await api('/besluit/geheugen', Object.assign({ besluitId: besluit.id }, EN))).body;
  const k = g.raakt.find(r => r.type === 'vlag');
  assert.equal(k.stand, 'verdwenen', 'het object is weg');
  assert.equal(k.titelToen, 'fjord-tarief', 'maar waar het besluit over ging staat er nog');
  assert.match(g.let, /titel die het TOEN had/i, 'en het antwoord legt dat uit');
});

test('4. iedere lezer lost op met zijn eigen register: geteld, niet benoemd', async () => {
  const g = (await api('/besluit/geheugen', Object.assign({ besluitId: BESLUIT.id }, BE))).body;
  assert.equal(g.verborgen, 1, 'er hangt één object aan dat Bea niet mag zien');
  assert.equal(g.raakt.length, 0, 'en het staat niet als rij in haar antwoord');
  /* De canary is "Raamovereenkomst": dat woord staat ALLEEN in de titel van
     het contract en nergens in de tekst van het besluit zelf. Zoeken op
     "Fjordlijn" zou hier niets bewijzen -- dat staat in de titel en de
     onderbouwing van het besluit, en die leest Bea met recht. */
  assert.ok(!JSON.stringify(g).includes('Raamovereenkomst'), 'nergens in het antwoord staat de titel van het object');
  assert.match(g.let, /geteld en niet benoemd/i, 'de reden staat erbij');

  // En de onderbouwing van het besluit zelf leest zij WEL: dat is haar recht.
  assert.match(g.besluit.onderbouwing, /Drie offertes/);
});

test('5. intrekken wist niets, en kan niet zonder reden', async () => {
  const g1 = (await api('/besluit/geheugen', Object.assign({ besluitId: BESLUIT.id }, JU))).body;
  const koppelId = g1.raakt.find(r => r.type === 'contract').koppelId;

  const zonder = await api('/besluit/raakt-terug', Object.assign({ besluitId: BESLUIT.id, koppelId }, JU));
  assert.equal(zonder.status, 400, 'zonder reden verdwijnt er niets');

  const met = await api('/besluit/raakt-terug', Object.assign({ besluitId: BESLUIT.id, koppelId,
    reden: 'Het besluit ging over de vervoerder, niet over dit contract.' }, JU));
  assert.equal(met.status, 200);

  const g2 = (await api('/besluit/geheugen', Object.assign({ besluitId: BESLUIT.id }, JU))).body;
  const k = g2.raakt.find(r => r.koppelId === koppelId);
  assert.ok(k, 'de ingetrokken koppeling staat er nog');
  assert.match(k.terug.reden, /vervoerder/, 'met de reden');
  assert.equal(k.terug.door, 'Joris', 'en met wie hem introk');
});

test('6. de omgekeerde vraag staat in het dossier', async () => {
  /* Opnieuw koppelen (de vorige is ingetrokken), zodat de dossierkant een
     levende koppeling te zien krijgt. */
  await api('/besluit/raakt', Object.assign({ besluitId: BESLUIT.id, type: 'contract', id: CONTRACT.id }, JU));

  const joris = (await api('/dossier', Object.assign({ type: 'contract', id: CONTRACT.id }, JU))).body;
  assert.equal(joris.besluiten.length, 1, 'het dossier van het contract noemt het besluit');
  assert.match(joris.besluiten[0].titel, /Fjordlijn onderbrengen/);
  assert.equal(joris.besluiten[0].gekoppeldDoor, 'Joris');

  /* Vera heeft geen recht "besluit". Dan is het antwoord NULL en niet een lege
     lijst: "ik heb niet gekeken" is iets anders dan "er is niets". */
  const vera = await api('/dossier', Object.assign({ type: 'contract', id: CONTRACT.id }, VK));
  assert.equal(vera.status, 404, 'Vera mag de contractsoort sowieso niet zien');

  const enno = (await api('/dossier', Object.assign({ type: 'vlag', id: 'nietbestaand' }, EN)));
  assert.equal(enno.status, 404, 'een vlag die er niet is, heeft geen dossier');
});

test('7. een evaluatiedatum zonder uitkomst is een agendapunt', async () => {
  const vroeg = await api('/besluit/evaluatie', Object.assign({ besluitId: BESLUIT.id,
    uitkomst: 'klopte', tekst: 'Ging goed.' }, JU));
  assert.equal(vroeg.status, 409, 'een voorstel dat nog niet is aangenomen, valt niet te evalueren');

  await api('/besluit/stemronde', Object.assign({ besluitId: BESLUIT.id }, JU));
  await api('/besluit/stem', Object.assign({ besluitId: BESLUIT.id, stem: 'voor' }, JU));
  await api('/besluit/stem', Object.assign({ besluitId: BESLUIT.id, stem: 'voor' }, BE));
  const sluit = await api('/besluit/sluit', Object.assign({ besluitId: BESLUIT.id, evalueerOp: '2027-06-01' }, JU));
  assert.equal(sluit.body.besluit.status, 'aangenomen');

  const kaal = await api('/besluit/evaluatie', Object.assign({ besluitId: BESLUIT.id, uitkomst: 'klopte' }, JU));
  assert.equal(kaal.status, 400, 'een uitkomst zonder onderbouwing is een vinkje');

  await api('/besluit/evaluatie', Object.assign({ besluitId: BESLUIT.id, uitkomst: 'gemengd',
    tekst: 'Levertijd gehaald, de meerprijs viel hoger uit dan 9%.' }, JU));
  const tweede = await api('/besluit/evaluatie', Object.assign({ besluitId: BESLUIT.id, uitkomst: 'klopte niet',
    tekst: 'Een jaar later: de meerprijs liep op naar 17%.' }, JU));
  assert.equal(tweede.status, 200);

  const g = (await api('/besluit/geheugen', Object.assign({ besluitId: BESLUIT.id }, JU))).body;
  assert.equal(g.evaluaties.length, 2, 'evaluaties stapelen; de eerste blijft staan');
  assert.equal(g.evaluaties[0].uitkomst, 'gemengd');
  assert.equal(g.evaluaties[1].uitkomst, 'klopte niet');
});
