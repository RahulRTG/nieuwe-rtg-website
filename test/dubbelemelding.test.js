/* DE ZEEF ONDER DE MELDINGEN: hoe lang is "kort geleden"? (TAKEN.md 4.56)

   `zelfdeMeldingKortGeleden` bepaalt of een melding van een inwoner dezelfde is
   als eentje van een paar tellen terug. De route-toetsen (gemeente, overheid)
   meten dat de ontdubbeling WERKT; wat ze niet meten is dat het venster een
   BOVENGRENS heeft -- en dat is de gevaarlijke kant.

   Dat bleek bij het namuteren: het venster op oneindig zetten liet alle
   route-toetsen groen, want die melden binnen dezelfde seconde. Maar met een
   oneindig venster kan een inwoner hetzelfde probleem NOOIT MEER melden -- de
   put die vorig jaar verstopt zat en nu weer, krijgt zijn oude meldnummer
   terug en niemand komt kijken. Een zeef die te veel wegvangt is erger dan
   een die niets doet, want hij ziet eruit als bescherming.

   Vandaar deze toetsen: ze geven de klok zelf mee, zodat ze het venster aan
   beide kanten kunnen aanwijzen.

   Draai los: node --experimental-sqlite --test test/dubbelemelding.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { zelfdeMeldingKortGeleden, VENSTER_MS } = require('../server/kern/dubbelemelding');

const NU = 1700000000000;
const melding = (min, extra) => Object.assign({
  melderKey: 'lid-1', categorie: 'verlichting', tekst: 'Paal 12 is stuk',
  at: new Date(NU - min * 60000).toISOString()
}, extra || {});
const zoek = (lijst, nieuw) => zelfdeMeldingKortGeleden(lijst, nieuw, ['categorie', 'tekst'], NU);

test('binnen het venster: dezelfde melder, categorie en tekst is dezelfde melding', () => {
  const eerder = melding(0.5);                       // dertig tellen geleden
  assert.equal(zoek([eerder], melding(0)), eerder);
});

test('BUITEN het venster is het een nieuwe melding -- hetzelfde probleem mag terugkomen', () => {
  assert.equal(zoek([melding(5)], melding(0)), null, 'vijf minuten later is een nieuwe melding');
  assert.equal(zoek([melding(60 * 24 * 365)], melding(0)), null, 'en een jaar later zeker');
  // precies op de rand telt niet meer mee: het venster is inclusief aan de nieuwe kant
  assert.equal(zoek([melding(VENSTER_MS / 60000 + 0.1)], melding(0)), null, 'net buiten de rand');
});

test('een andere melder is een andere melding -- twee buren, twee meldingen', () => {
  assert.equal(zoek([melding(0.2)], melding(0, { melderKey: 'lid-2' })), null);
});

test('een ander veld is een andere melding', () => {
  assert.equal(zoek([melding(0.2)], melding(0, { tekst: 'Paal 13 is stuk' })), null, 'andere tekst');
  assert.equal(zoek([melding(0.2)], melding(0, { categorie: 'wegdek' })), null, 'andere categorie');
});

test('de zeef stopt bij de eerste melding buiten het venster (nieuwste-eerst)', () => {
  /* De lijst staat nieuwste-eerst, dus verder zoeken is per definitie ouder.
     Zonder die stop zou dit een scan over veertigduizend meldingen zijn, bij
     ELKE melding. Deze toets legt het gedrag vast: wat achter een oude staat,
     wordt niet meer bekeken -- ook niet als het toevallig zou passen. */
  const lijst = [melding(5), melding(0.2)];          // een oude VOOR een verse
  assert.equal(zoek(lijst, melding(0)), null, 'de zeef kijkt niet voorbij de eerste oude');
});

test('een lege of ontbrekende lijst geeft null en niet een fout', () => {
  assert.equal(zoek([], melding(0)), null);
  assert.equal(zoek(null, melding(0)), null);
  assert.equal(zoek(undefined, melding(0)), null);
});
