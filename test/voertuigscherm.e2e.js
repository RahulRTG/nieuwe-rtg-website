/* HET VOERTUIGSCHERM: het adres dat een verwijzing nodig had.

   De verwijsvorm van dit huis kon nergens heen voor een voertuig -- er was geen
   app die er EEN opende. Vier beweringen, en de eerste twee gaan over de reden
   dat dit scherm bestaat:

   1. DE VERWIJZING HEEFT NU EEN BESTEMMING. `rtg://voertuig/<id>` lost op naar
      dit scherm met het id in de URL, en de werkruimtelaag toont dat ook.
   2. HET WIJST NAAR HET DUURZAME VOERTUIG EN NIET NAAR EEN LIVE POSITIE. Die
      laatste (db.data.ovVoertuigen) heeft een houdbaarheid van twee minuten;
      daarheen verwijzen zou een link opleveren die vrijwel altijd dood is.
   3. ZONDER SLEUTEL IS HET EEN GESLOTEN DEUR EN GEEN LEEG SCHERM.
   4. EEN ID DAT ER NIET STAAT, WORDT NIET GERADEN -- en het scherm zegt niet of
      het bij een andere vervoerder hoort of niet bestaat, want dat verschil
      verraadt of een voertuig ergens anders bestaat.

   Draai los: node --experimental-sqlite --test test/voertuigscherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const koppel = require('../server/kern/wereld/koppel');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voertuigscherm-'));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(async () => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. rtg://voertuig/<id> heeft een bestemming, met het id in de URL', () => {
  const open = koppel.open('rtg://voertuig/a12');
  assert.ok(open, 'de soort staat in de kaart');
  assert.equal(open.url, '/apps/voertuig.html?voertuig=a12');
  assert.equal(open.titel, 'Voertuig');
});

test('1b. rtg://rit/<ref> heeft ook een bestemming', () => {
  const open = koppel.open('rtg://rit/RTG-R-AB12');
  assert.ok(open, 'de soort staat in de kaart');
  assert.equal(open.url, '/apps/rit.html?rit=RTG-R-AB12');
  assert.equal(koppel.KAART.rit.deel, false,
    'een rit is van EEN reiziger; een link erheen opent bij een ander niets');
});

test('2. de live OV-positie krijgt GEEN bestemming', () => {
  /* Er is bewust geen tweede soort voor db.data.ovVoertuigen: die rij verdwijnt
     na twee minuten. Deze toets legt vast dat de kaart precies EEN voertuigsoort
     kent, zodat er niet stilletjes een tweede bijkomt die naar een vluchtige rij
     wijst. */
  const soorten = Object.keys(koppel.KAART).filter(k => /voertuig|positie|dienst/.test(k));
  assert.deepEqual(soorten, ['voertuig'], 'één voertuigsoort, en dat is de duurzame');
  const ritsoorten = Object.keys(koppel.KAART).filter(k => /^rit|opdracht/.test(k));
  assert.deepEqual(ritsoorten, ['rit'], 'en één ritsoort, en dat is de verwijsbare opdracht');
  assert.equal(koppel.KAART.voertuig.deel, false,
    'een vlootscherm hangt achter de vervoerderdeur; zo\'n link hoort niet in een gesprek');
});

/* WAT HIER NIET GETOETST WORDT, EN DAT HOORT ERBIJ TE STAAN. Deze omgeving
   heeft geen browser, dus het RENDEREN van dit scherm is hier niet te meten. De
   eerste versie van deze twee toetsen startte playwright en sloeg zichzelf
   stilletjes over als die ontbrak -- ze slaagden dan zonder iets te doen, en een
   mutatie op de tekst sloeg dan ook af (LAT-regel 3 en 9). Wat er nu staat toetst
   wat hier WEL te meten valt: dat de uitgeserveerde code die zinnen draagt, en
   dat ze niet stilletjes vervangen kunnen worden door "geen gegevens". Dat het
   scherm ze ook echt TOONT, moet uit een e2e-ronde met een browser komen;
   scripts/schermen.js meldt dit scherm tot die tijd als nooit-geopend. */
const haal = (pad) => fetch(BASE + pad).then(async r => ({ status: r.status, tekst: await r.text() }));

test('3. zonder sleutel zegt het scherm WAAROM er niets staat', async () => {
  const html = await haal('/apps/voertuig.html');
  assert.equal(html.status, 200, 'het scherm wordt uitgeserveerd');
  assert.match(html.tekst, /id="geenTekst"/, 'met het vak waar de reden in komt');

  const js = await haal('/apps/voertuig.js');
  assert.equal(js.status, 200);
  assert.match(js.tekst, /gesloten deur/i, 'de code zegt dat het een gesloten deur is');
  assert.match(js.tekst, /personeelssleutel/i, 'en wat er nodig is');
});

test('5. het ritscherm zegt hetzelfde over een ref die niet van u is', async () => {
  const html = await haal('/apps/rit.html');
  assert.equal(html.status, 200, 'het ritscherm wordt uitgeserveerd');
  const js = await haal('/apps/rit.js');
  assert.equal(js.status, 200);
  assert.match(js.tekst, /gesloten deur/i, 'zonder sessie is het een gesloten deur');
  assert.match(js.tekst, /welke van de twee zegt dit scherm bewust niet/i,
    'en er wordt niet verklapt of een ref van een ander is of niet bestaat');
  assert.match(js.tekst, /nog niet toegewezen/i,
    '"nog niet toegewezen" is een stand en geen ontbrekend gegeven');
});

test('4. een onbekend id wordt niet geraden, en het verschil wordt niet verklapt', async () => {
  const js = await haal('/apps/voertuig.js');
  assert.match(js.tekst, /staat niet in deze vloot/i, 'een onbekend id krijgt een uitleg');
  assert.match(js.tekst, /welke van de twee zegt dit scherm bewust niet/i,
    'en er wordt niet verklapt of het bij een andere vervoerder hoort of niet bestaat');
  assert.ok(!/localStorage\.setItem/.test(js.tekst),
    'dit scherm schrijft niets in de opslag van de browser: het leest alleen');
});
