/* ============================================================================
   DE KNELPUNTMOTOR: WAT ER OPEN LIGT, WAT BLOKKEERT, EN WAT NIET IS NAGEGAAN

   HDI.md par. 7 regel 8. Par. 5.5 zet vier grenzen om die motor heen, en dit
   bestand is de plek waar ze kunnen zakken. Zes zinnen:

     1. een geblokkeerde weg gaat NOOIT uit de lijst -- hij staat er met wat hem
        zou openen ("dit is niets voor jou" bestaat niet);
     2. niet nagegaan is niet vervuld: een weg zonder blokkade maar met
        onbekenden heet `onbepaald` en niet `open`;
     3. de aannames staan in de uitslag, en groeien mee met wat er ontbreekt;
     4. er wordt niets gerangschikt, en het antwoord zegt dat zelf;
     5. een knelpunt is een eigenschap van een RANDVOORWAARDE en telt wegen --
        nooit een getal op een mens;
     6. de motor rekent niets uit wat hij niet weet: geen duur, geen tarief.

   MET EEN MUTATIE NAGETROKKEN:
     - geblokkeerde manieren uit `uit` filteren: RAAK op 1;
     - een onbekende voorwaarde als vervuld tellen: RAAK op 2;
     - de aannames leegmaken: RAAK op 3;
     - `ordening` uit het antwoord halen: RAAK op 4;
     - de knelpunten op manier-id laten tellen in plaats van op voorwaarde:
       RAAK op 5.

   WAAROM DIT EEN ZUIVERE TOETS IS EN GEEN SERVERRONDE. De motor raakt geen
   opslag aan en krijgt alles als argument -- precies zoals
   kern/livinglab/graden.js, en om dezelfde reden: een regel die je zonder
   database kunt uitrekenen, kun je ook zonder database toetsen. De route
   eromheen (routes/knelpunt.js) doet niets anders dan hem aanroepen.

   Draai los: node --test test/knelpunt.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

const K = require('../server/kern/knelpunt');

/* Het voorbeeld uit het voorstel: het doel is verpleegkundige, en de vraag is
   niet of ze gemotiveerd is maar wat er in de weg staat. */
const SARAH = {
  doel: 'verpleegkundige worden',
  randvoorwaarden: [
    { id: 'opvang', wat: 'opvang voor de kinderen tijdens lesuren', stand: 'ontbreekt' },
    { id: 'vervoer', wat: 'kunnen reizen naar de opleiding', stand: 'vervuld' },
    { id: 'inkomen', wat: 'genoeg inkomen tijdens de opleiding', stand: 'onbekend' }
  ],
  manieren: [
    { id: 'voltijd', wat: 'voltijd opleiding', nodig: ['opvang', 'vervoer', 'inkomen'] },
    { id: 'deeltijd', wat: 'deeltijd naast mijn werk', nodig: ['opvang', 'vervoer'] },
    { id: 'avond', wat: 'avondopleiding', nodig: ['vervoer'] }
  ]
};

test('1. een geblokkeerde weg blijft staan, met wat hem zou openen', () => {
  const r = K.reken(SARAH);
  assert.equal(r.manieren.length, 3, 'alle drie de manieren horen in het antwoord te staan');
  const v = r.manieren.find(m => m.id === 'voltijd');
  assert.equal(v.stand, 'geblokkeerd');
  assert.deepEqual(v.zouOpenenAls, ['opvang voor de kinderen tijdens lesuren'],
    'een geblokkeerde weg hoort te zeggen wat hem zou openen, niet te verdwijnen');
  assert.match(v.uitleg, /blijft in de lijst staan/,
    'en de uitleg hoort te zeggen dat hij blijft staan, want dat kan veranderen');
});

test('2. niet nagegaan is niet vervuld', () => {
  const r = K.reken({
    doel: 'iets bereiken',
    randvoorwaarden: [{ id: 'a', wat: 'A', stand: 'vervuld' }, { id: 'b', wat: 'B', stand: 'onbekend' }],
    manieren: [{ id: 'x', wat: 'X', nodig: ['a', 'b'] }, { id: 'y', wat: 'Y', nodig: ['a'] }]
  });
  const x = r.manieren.find(m => m.id === 'x');
  assert.equal(x.stand, 'onbepaald', 'een onbekende voorwaarde maakt een weg NIET open');
  assert.deepEqual(x.nietNagegaan, ['B']);
  assert.equal(r.manieren.find(m => m.id === 'y').stand, 'open');

  // een voorwaarde zonder stand is onbekend en niet vervuld
  const geen = K.reken({ doel: 'd', randvoorwaarden: [{ id: 'a', wat: 'A' }],
    manieren: [{ id: 'x', wat: 'X', nodig: ['a'] }] });
  assert.equal(geen.manieren[0].stand, 'onbepaald', 'geen stand betekent onbekend, niet vervuld');
});

test('3. de aannames staan in de uitslag en groeien mee', () => {
  const r = K.reken(SARAH);
  assert.ok(r.aannames.length >= 2, 'de vaste aannames horen er altijd te staan');
  assert.ok(r.aannames.some(a => /niet nagegaan/i.test(a)),
    'dat een lege voorwaarde als niet-nagegaan telt, hoort er te staan');

  // een manier die een niet-beschreven voorwaarde noemt, levert een EXTRA aanname
  const slordig = K.reken({ doel: 'd', randvoorwaarden: [],
    manieren: [{ id: 'x', wat: 'X', nodig: ['bestaatniet'] }, { id: 'y', wat: 'Y', nodig: [] }] });
  assert.ok(slordig.aannames.some(a => /bestaatniet/.test(a)),
    'een voorwaarde die nergens is beschreven hoort als aanname te worden gemeld, niet stil te verdwijnen');

  // en bij EEN manier hoort erbij te staan dat dit geen keuze is
  const een = K.reken({ doel: 'd', randvoorwaarden: [], manieren: [{ id: 'x', wat: 'X', nodig: [] }] });
  assert.ok(een.aannames.some(a => /maar EEN manier/i.test(a)),
    'een lijst van een leest anders als een advies');
});

test('4. er wordt niets gerangschikt, en het antwoord zegt dat', () => {
  const r = K.reken(SARAH);
  assert.deepEqual(r.manieren.map(m => m.id), ['voltijd', 'deeltijd', 'avond'],
    'de volgorde hoort die van de invoer te zijn, en niet die van de uitkomst');
  assert.match(r.ordening, /niets gerangschikt/,
    'het antwoord hoort zelf te zeggen dat er niets is gerangschikt');
  assert.ok(!('beste' in r) && !('aanbevolen' in r),
    'er hoort geen beste of aanbevolen weg uit te komen');
});

test('5. een knelpunt telt wegen, niet mensen', () => {
  const r = K.reken(SARAH);
  assert.deepEqual(r.knelpunten, [
    { id: 'opvang', wat: 'opvang voor de kinderen tijdens lesuren', blokkeertWegen: 2 }
  ], 'het knelpunt hoort de VOORWAARDE te zijn die de meeste wegen blokkeert');

  // en er staat nergens een getal op de mens of op een manier
  for (const m of r.manieren) {
    for (const sleutel of Object.keys(m)) {
      assert.ok(!/score|cijfer|rang|kans/i.test(sleutel),
        'een manier draagt een score-achtig veld (' + sleutel + '); dat hoort hier niet te bestaan');
    }
  }
});

test('6. de motor rekent niets uit wat hij niet weet', () => {
  const r = K.reken(SARAH);
  assert.match(r.grens, /zegt niets over hoe lang iets duurt/,
    'het antwoord hoort te zeggen dat het niets over duur of kosten zegt');
  const heel = JSON.stringify(r);
  assert.ok(!/maanden|weken|euro|kosten|€/i.test(heel),
    'er hoort geen duur en geen bedrag in het antwoord te staan; die getallen heeft dit huis niet');

  // en zonder doel of zonder manieren komt er een reden en geen leeg antwoord
  assert.equal(K.reken({ manieren: [{ id: 'x' }] }).status, 400);
  assert.equal(K.reken({ doel: 'd', manieren: [] }).status, 400);
  const dubbel = K.reken({ doel: 'd', randvoorwaarden: [{ id: 'a' }, { id: 'a' }], manieren: [{ id: 'x' }] });
  assert.equal(dubbel.status, 400, 'een dubbele randvoorwaarde hoort te weigeren in plaats van stil de eerste te overschrijven');
});
