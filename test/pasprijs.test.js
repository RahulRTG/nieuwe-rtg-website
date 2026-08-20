/* ============================================================================
   WAT KOST EEN PAS PER MAAND? EEN ANTWOORD.

   De eigenaar zet de pasprijs in de boardroom. Drie plekken hadden die vraag
   nodig en losten hem elk apart op: het betaalschema van een aanmelding, de
   omzetstaat in het ledenregister, en de factuur van het lid. Die laatste las
   de regie helemaal niet en had { rtg: 65, lifestyle: 20000, business: 7500 }
   hard in euro's staan.

   Twee gevolgen, allebei echt:

   1. Wie de prijs in de boardroom veranderde, zag het lid nog de OUDE prijs op
      zijn factuur -- terwijl het betaalschema wel met de nieuwe rekende.
   2. De Business Pass is volgens de regie nadrukkelijk contractueel en heeft
      dus GEEN maandprijs. De factuur zette er 7500 x 1,21 = 9.075 euro op. Een
      bedrag dat nergens is afgesproken. (Sinds de ladder van 20 augustus 2026
      geldt hetzelfde voor de Lifestyle Pass, en heeft elke trede bovendien een
      BODEM -- die keurt invoer en is nadrukkelijk geen prijs; zie
      test/pasladder.test.js toets 5.)

   En een derde die pas opviel bij het samenvoegen: het ledenregister viel terug
   op `|| 0`. Op een verse installatie (nog niets ingesteld) toonde de omzetstaat
   dus NUL euro per lid, terwijl het betaalschema 65 euro in rekening bracht.
   Twee kopieen, twee antwoorden op dezelfde vraag.

   Draai los: node --test test/pasprijs.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maandCentenVoor, maandCentenUit, STANDAARD } = require('../server/kern/pasprijs');

test('1. zonder ingestelde prijs geldt de standaard, niet nul', () => {
  assert.equal(maandCentenVoor(null, 'rtg'), 6500, 'RTG valt terug op 65 euro');
  assert.equal(maandCentenVoor({}, 'business-lite'), 15000, 'Business Lite op 150 euro');
  assert.equal(maandCentenVoor(null, 'gratis'), 0, 'de gratis app is echt gratis');
  /* Dit is de bewering die het ledenregister miste: `|| 0` als terugval maakt
     van "nog niet ingesteld" stilzwijgend "gratis". */
  assert.notEqual(maandCentenVoor(null, 'rtg'), 0, 'niet-ingesteld is geen nul');
});

test('2. een ingestelde prijs wint van de standaard', () => {
  const lijst = { rtg: { maandCenten: 9900 }, 'business-lite': { maandCenten: 25000 } };
  assert.equal(maandCentenVoor(lijst, 'rtg'), 9900);
  assert.equal(maandCentenVoor(lijst, 'business-lite'), 25000);
  /* Deze functie LEEST de prijslijst en keurt hem niet: de bodem wordt bewaakt
     waar een bedrag binnenkomt (geldregie -> pasladder.keurCenten), niet hier.
     Zou hij hier ook keuren, dan bestonden er twee plekken die "mag dit bedrag"
     beantwoorden -- precies de kopie-fout waar dit bestand voor gemaakt is. Een
     bedrag dat toch onder de bodem in de opslag staat, wordt getoond zoals het
     er staat; het wordt niet stilzwijgend opgehoogd. */
  assert.equal(maandCentenVoor({ rtg: { maandCenten: 0 } }, 'rtg'), 0,
    'wat er staat, staat er -- deze laag verzint niets bij');
});

/* DE BEWERING DIE ERTOE DOET. Business is prijs op maat: er IS geen bedrag, en
   null is hier een antwoord en geen ontbrekende waarde. Nul zou "gratis"
   betekenen, en dat is precies verkeerd. */
test('3. de Business Pass heeft geen maandprijs, en dat is null en niet nul', () => {
  assert.equal(maandCentenVoor(null, 'business'), null);
  assert.equal(maandCentenVoor({ business: { maandCenten: 7500 } }, 'business'), null,
    'zelfs als iemand er toch een bedrag in zet, blijft Business op maat');
});

test('4. een kapotte regie laat de factuur niet omvallen', () => {
  const stuk = () => { throw new Error('regie nog niet gemount'); };
  assert.equal(maandCentenUit(stuk, 'rtg'), 6500, 'terugval op de standaard');
  assert.equal(maandCentenUit(null, 'rtg'), 6500, 'en zonder regie ook');
  assert.equal(maandCentenUit(stuk, 'business'), null, 'business blijft op maat');
});

/* De naad die dit bestand rechtvaardigt: de regie en de gedeelde helper moeten
   HETZELFDE zeggen. Liepen ze uiteen, dan zou een verse installatie andere
   bedragen tonen dan hij berekent -- en dat is precies de klasse fout waar deze
   samenvoeging voor is. */
test('5. de standaard hier is dezelfde als die van de geld-regie zelf', () => {
  const db = { data: {} };
  const { geldPasprijzen } = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });
  const passen = geldPasprijzen().passen;
  assert.equal(passen.rtg.maandCenten, STANDAARD.rtg,
    'de regie en pasprijs.js vallen op hetzelfde bedrag terug (RTG)');
  assert.equal(passen['business-lite'].maandCenten, STANDAARD['business-lite'],
    'idem Business Lite');
  /* De contractuele treden horen aan BEIDE kanten geen bedrag te hebben. Stond
     er hier een getal en daar null (of andersom), dan zou een verse installatie
     iets anders tonen dan ze berekent. */
  for (const pas of ['business', 'lifestyle']) {
    assert.equal(STANDAARD[pas], null, pas + ' heeft geen standaardbedrag');
    assert.equal(passen[pas].opMaat, true, 'en de regie noemt ' + pas + ' zelf contractueel');
    assert.equal(passen[pas].maandCenten, undefined, pas + ' draagt geen maandbedrag in de prijslijst');
  }
  // en de helper leest de regie ook echt
  assert.equal(maandCentenUit(geldPasprijzen, 'rtg'), STANDAARD.rtg);
});

test('6. een prijswijziging in de boardroom komt overal door', () => {
  const db = { data: {} };
  const g = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {}, crypto });
  const voor = maandCentenUit(g.geldPasprijzen, 'rtg');
  assert.equal(voor, 6500);

  const r = g.geldPasprijsZet({ pas: 'rtg', euro: 99 });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(maandCentenUit(g.geldPasprijzen, 'rtg'), 9900,
    'wie de prijs in de boardroom zet, verandert hem overal -- ook op de factuur');
});
