/* INTENTIE EN CONTEXT UIT ELKAAR -- de relatieregel en de reiswens (EDGE.md par.
   14.4, de correctie op de eerste doorsnede).

   De aanleiding: een lid met een Ibiza-aanvraag open zei "ik wil met zes
   vrienden vier dagen naar Rome", en Rahul behandelde de Ibiza-aanvraag als het
   onderwerp. De expliciete vraag bepaalt de taak; het scherm helpt alleen lezen.

   Twee modules, allebei zonder model:
     kern/stuur/menscontext-relatie.js   over / wijzig / los / onduidelijk
     kern/fluister/reis/reiswens.js       een reiswens als concept, met wat
                                          bekend, aangenomen en ontbrekend is

   Elke toets noemt de mutatie waarop hij hoort te zakken.
   Draai los: node --test test/intentie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { relatieVan } = require('../server/kern/stuur/menscontext-relatie');
const { reiswens, zinVan, leesReiswens } = require('../server/kern/fluister/reis/reiswens');

const IBIZA = [{ soort: 'reisaanvraag', id: 'RTG-R-1', velden: { titel: 'Ibiza, jetset-week', bestemming: 'Ibiza',
  personen: 6, vertrek: '2026-11-03', stand: 'aangevraagd', prijsPerPersoon: 2200 } }];
const CATALOGUS = [{ id: 'ibiza-jetset', titel: 'Ibiza, jetset-week', bestemming: 'Ibiza' },
  { id: 'lissabon-nieuw', titel: 'Lissabon, nieuw in de catalogus', bestemming: 'Lissabon' }];

test('1. de relatie van een vraag met het aangewezen object', () => {
  /* MUTATIE: laat relatieVan altijd 'over' geven als er een object is (het
     oude gedrag) -- de los-rijen zakken. */
  const verwacht = {
    'Ik wil met zes vrienden vier dagen naar Rome, maximaal €800 per persoon.': 'los',
    'Ik wil met 6 personen naar Rome': 'los',
    'Plan een nieuwe reis naar Lissabon': 'los',
    'Wat is het weer morgen?': 'los',
    'Hoe staat mijn aanvraag ervoor?': 'over',
    'Wanneer vertrek ik naar Ibiza?': 'over',
    'Klopt de prijs?': 'over',
    'Wat kost deze reis per persoon?': 'over',
    'Wat is dit?': 'over',
    'Kun je deze aanvraag wijzigen naar vijf personen?': 'wijzig',
    'Zet de vertrekdatum van deze reis een week later': 'wijzig',
    'Verander mijn reis naar Rome': 'wijzig',
    'Kan deze reis ook naar Rome?': 'onduidelijk'
  };
  for (const [q, r] of Object.entries(verwacht)) assert.equal(relatieVan(q, IBIZA).relatie, r, q);
});

test('2. zonder object is er niets om over te gaan, en een uitkomst heeft altijd een reden', () => {
  for (const q of ['Hoe staat deze aanvraag ervoor?', 'Wijzig deze reis']) {
    const r = relatieVan(q, []);
    assert.equal(r.relatie, 'los', 'een wijswoord zonder gevonden object wijst nergens heen');
    assert.ok(r.reden);
  }
  assert.ok(relatieVan('Klopt de prijs?', IBIZA).reden);
});

test('3. een wijziging vraagt een verwijzing of de naam van het object', () => {
  /* De duurste vergissing is een bestaand object veranderen bij een vraag die
     er niet over ging. MUTATIE: controleer WIJZIG voor de los-tak. */
  assert.equal(relatieVan('Kun je iets wijzigen in mijn agenda?', IBIZA).relatie, 'los');
  assert.equal(relatieVan('Annuleer mijn sportschool', IBIZA).relatie, 'los');
});

test('4. de Rome-vraag wordt een concept met bekend, aangenomen en ontbrekend', () => {
  /* MUTATIE: tel "zes vrienden" als zes reizigers zonder aanname. */
  const c = reiswens('Ik wil met zes vrienden vier dagen naar Rome, maximaal €800 per persoon.', CATALOGUS);
  assert.equal(c.titel, 'Nieuwe reis naar Rome');
  const v = Object.fromEntries(c.velden.map((x) => [x.naam, x]));
  assert.equal(v.Bestemming.waarde, 'Rome');
  assert.equal(v.Reizigers.waarde, '7');
  assert.match(v.Reizigers.aanname, /u en zes vrienden/, 'zeven is een aanname en staat er zo bij');
  assert.equal(v.Duur.waarde, '4 dagen');
  assert.equal(v.Budget.waarde, 'maximaal € 800 per persoon');
  assert.deepEqual(c.ontbreekt, ['de reisdata', 'uw vertrekplaats']);
  assert.match(c.volgende, /Rome staat niet in onze reiscatalogus/);
  assert.equal(c.catalogusreis, null);
  assert.match(zinVan(c), /Er is niets ingediend of geboekt\.$/);
});

test('5. een bestemming uit de catalogus wordt genoemd, maar niet aangevraagd', () => {
  const c = reiswens('Met 4 personen drie dagen naar Lissabon in mei', CATALOGUS);
  assert.equal(c.catalogusreis, 'lissabon-nieuw');
  assert.match(c.volgende, /In onze catalogus staat/);
  assert.deepEqual(c.ontbreekt, ['uw vertrekplaats'], 'mei is een reisdatum; die wordt niet nog eens gevraagd');
});

test('6. geen reiswens zonder bestemming, bij een verwijzing of bij een wijziging', () => {
  /* MUTATIE: haal de WIJS/WIJZIG-grendel uit leesReiswens -- de laatste twee
     zakken, en dan maakt "deze reis ook naar Rome" stil een nieuwe reis. */
  /* De eerste regel kwam uit test/fluister.test.js: een taxi is geen reis.
     MUTATIE: haal de vervoersgrendel weg -- die zakt. */
  for (const q of ['regel een taxi naar Sal de Mar met 2 personen', 'Ik ga met 2 personen naar Sal de Mar eten',
    'Regel een taxi naar Schiphol voor onze vakantie, met 2 personen',
    'Ik ga naar huis', 'Wanneer vertrek ik naar Ibiza?', 'Ik wil vier dagen weg',
    'Kan deze reis ook naar Rome met 4 personen?', 'Verander mijn reis naar Rome met 4 personen'])
    assert.equal(leesReiswens(q), null, q);
});
