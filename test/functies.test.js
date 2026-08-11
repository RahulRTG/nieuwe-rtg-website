/* Tests voor de functieschakelaars (server/functies.js): de pad-matching
   (langste prefix wint), de standaard en de catalogus. Zuiver, geen server
   nodig. Draai: node --test test/functies.test.js

   OVER "DE STANDAARD". Deze toets zei ooit: zonder stand staat ALLES aan. Dat
   klopte zolang elke functie standaard aan was, en zo was het ook -- tot er
   een functie kwam die standaard UIT hoort te staan (het eigen domein buiten
   het RTG-web, dat een site publiek maakt). De belofte is daarom scherper
   geworden en niet zwakker: elke functie staat op ZIJN EIGEN standaard, en
   wie standaard uit is, is zonder stand ook echt dicht. */
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');

test('functies: zonder stand staat elke functie op zijn eigen standaard', () => {
  let aantalUit = 0;
  for (const f of functies.FUNCTIES) {
    for (const p of f.paden) {
      const dicht = functies.padGeblokkeerd(p + '/iets', {});
      if (f.standaard === false) {
        assert.ok(dicht && dicht.id === f.id, f.id + ' staat standaard UIT en hoort zonder stand dicht te zijn');
      } else {
        assert.equal(dicht, null, f.id + ' zou standaard aan moeten staan');
      }
    }
    if (f.standaard === false) aantalUit++;
  }
  /* Er is er minstens een, anders is de tak hierboven dode code en toetst deze
     toets stilletjes alleen nog de helft. */
  assert.ok(aantalUit >= 1, 'er is minstens een functie die standaard uit staat');
  assert.equal(functies.HEEFT_UIT_STANDAARD, true, 'en de middleware weet dat ook');
});

test('functies: een uitgezette functie blokkeert zijn pad', () => {
  const staat = { betalen: { aan: false } };
  const dicht = functies.padGeblokkeerd('/api/betaal/checkout', staat);
  assert.ok(dicht && dicht.id === 'betalen');
  // een ander pad blijft vrij
  assert.equal(functies.padGeblokkeerd('/api/foundation/mijn', staat), null);
});

test('functies: langste prefix wint, brede functie uit, deelfunctie aan', () => {
  const staat = { supplier: { aan: false }, 'supplier-pos': { aan: true } };
  // de kassa (specifieker) blijft aan
  assert.equal(functies.padGeblokkeerd('/api/supplier/pos/afrekenen', staat), null);
  // de rest van de partner-app is dicht
  const dicht = functies.padGeblokkeerd('/api/supplier/order/nieuw', staat);
  assert.ok(dicht && dicht.id === 'supplier');
});

test('functies: langste prefix wint, brede functie aan, deelfunctie uit', () => {
  const staat = { foundation: { aan: true }, 'foundation-school': { aan: false } };
  // RTF School dicht
  const dicht = functies.padGeblokkeerd('/api/foundation/school/klas', staat);
  assert.ok(dicht && dicht.id === 'foundation-school');
  // de rest van de onderwijs-app blijft open
  assert.equal(functies.padGeblokkeerd('/api/foundation/mijn', staat), null);
});

test('functies: office-school is specifieker dan office', () => {
  const staat = { 'office-school': { aan: false } };
  const dicht = functies.padGeblokkeerd('/api/office/school/decide', staat);
  assert.ok(dicht && dicht.id === 'office-school');
  assert.equal(functies.padGeblokkeerd('/api/office/state', staat), null);
});

test('functies: niet-bewaakte paden zijn altijd vrij', () => {
  assert.equal(functies.padGeblokkeerd('/api/techniek/status', { member: { aan: false } }), null);
  assert.equal(functies.padGeblokkeerd('/api/login', { member: { aan: false } }), null);
});

test('functies: prefix past alleen op een segmentgrens', () => {
  // /api/supplier mag /api/supplierx NIET blokkeren
  assert.equal(functies.padGeblokkeerd('/api/supplierx/iets', { supplier: { aan: false } }), null);
  // maar /api/supplier zelf en /api/supplier/... wel
  assert.ok(functies.padGeblokkeerd('/api/supplier', { supplier: { aan: false } }));
  assert.ok(functies.padGeblokkeerd('/api/supplier/order', { supplier: { aan: false } }));
});

test('functies: catalogus geeft categorieën met de juiste aan/uit-stand', () => {
  const cat = functies.catalogus({ betalen: { aan: false } });
  assert.ok(cat.length >= 1);
  const alle = cat.flatMap(g => g.functies);
  // elke functie uit FUNCTIES komt precies één keer terug
  assert.equal(alle.length, functies.FUNCTIES.length);
  assert.equal(alle.find(f => f.id === 'betalen').aan, false);
  assert.equal(alle.find(f => f.id === 'member').aan, true);
  // categorieën in de vaste volgorde
  assert.equal(cat[0].categorie, functies.CATEGORIEEN[0]);
});

test('doelgroep: een functie kan uit voor de ene doelgroep en aan voor de andere', () => {
  // de sociale laag uit voor Lifestyle, maar aan voor RTG
  const staat = { social: { perDoelgroep: { lifestyle: false } } };
  assert.equal(functies.functieAanVoor('social', 'lifestyle', staat), false);
  assert.equal(functies.functieAanVoor('social', 'rtg', staat), true);
  // het pad is dicht voor een Lifestyle-lid, vrij voor een RTG-lid
  assert.ok(functies.padGeblokkeerd('/api/rtf/social/zoek', staat, 'lifestyle'));
  assert.equal(functies.padGeblokkeerd('/api/rtf/social/zoek', staat, 'rtg'), null);
  // zonder doelgroep (achterwaarts compatibel) telt alleen de globale stand: vrij
  assert.equal(functies.padGeblokkeerd('/api/rtf/social/zoek', staat), null);
});

test('doelgroep: globaal uit wint van elke per-doelgroep-stand', () => {
  const staat = { social: { aan: false, perDoelgroep: { rtg: true } } };
  assert.equal(functies.functieAanVoor('social', 'rtg', staat), false);
  assert.ok(functies.padGeblokkeerd('/api/rtf/social/zoek', staat, 'rtg'));
});

test('doelgroep: de doelgroep van een verzoek volgt pad of pas', () => {
  assert.equal(functies.doelgroepVanVerzoek('/api/supplier/order', null), 'leverancier');
  assert.equal(functies.doelgroepVanVerzoek('/api/staff/rooster', null), 'personeel');
  assert.equal(functies.doelgroepVanVerzoek('/api/office/state', null), 'intern');
  assert.equal(functies.doelgroepVanVerzoek('/api/foundation/mijn', null), 'foundation');
  // gedeeld ledenpad: de pas bepaalt de doelgroep
  assert.equal(functies.doelgroepVanVerzoek('/api/member/dm', { tier: 'business' }), 'business');
  assert.equal(functies.doelgroepVanVerzoek('/api/member/dm', { tier: 'rtg' }), 'rtg');
  assert.equal(functies.doelgroepVanVerzoek('/api/member/dm', null), null);
});

test('AI-taalhulp: "zet de sociale laag uit voor lifestyle" levert een correct voorstel', () => {
  const { voorstel } = functies.duidVoorstel('zet de sociale laag uit voor lifestyle', {});
  assert.ok(voorstel.some(w => w.id === 'social' && w.doelgroep === 'lifestyle' && w.aan === false),
    'het voorstel zet social uit voor lifestyle');
  // niet voor andere doelgroepen
  assert.ok(!voorstel.some(w => w.doelgroep === 'rtg'));
});

test('AI-taalhulp: valideerVoorstel weert onbekende functies en verkeerde doelgroepen', () => {
  const uit = functies.valideerVoorstel([
    { id: 'social', doelgroep: 'lifestyle', aan: false }, // ok
    { id: 'bestaatniet', doelgroep: 'rtg', aan: false },  // onbekende functie
    { id: 'supplier', doelgroep: 'rtg', aan: false }       // rtg hoort niet bij supplier
  ]);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].id, 'social');
});
