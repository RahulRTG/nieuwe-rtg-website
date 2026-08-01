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
   2. De Business Pass is volgens de regie nadrukkelijk `opMaat: true` en heeft
      dus GEEN maandprijs. De factuur zette er 7500 x 1,21 = 9.075 euro op. Een
      bedrag dat nergens is afgesproken.

   En een derde die pas opviel bij het samenvoegen: het ledenregister viel terug
   op `|| 0`. Op een verse installatie (nog niets ingesteld) toonde de omzetstaat
   dus NUL euro per lid, terwijl het betaalschema 65 euro in rekening bracht.
   Twee kopieen, twee antwoorden op dezelfde vraag.

   Draai los: node --experimental-sqlite --test test/pasprijs.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maandCentenVoor, maandCentenUit, STANDAARD } = require('../server/kern/pasprijs');

test('1. zonder ingestelde prijs geldt de standaard, niet nul', () => {
  assert.equal(maandCentenVoor(null, 'rtg'), 6500, 'RTG valt terug op 65 euro');
  assert.equal(maandCentenVoor({}, 'lifestyle'), 2000000, 'Lifestyle op 20.000 euro');
  assert.equal(maandCentenVoor(null, 'gratis'), 0, 'de gratis app is echt gratis');
  /* Dit is de bewering die het ledenregister miste: `|| 0` als terugval maakt
     van "nog niet ingesteld" stilzwijgend "gratis". */
  assert.notEqual(maandCentenVoor(null, 'rtg'), 0, 'niet-ingesteld is geen nul');
});

test('2. een ingestelde prijs wint van de standaard', () => {
  const lijst = { rtg: { maandCenten: 9900 }, lifestyle: { maandCenten: 1500000 } };
  assert.equal(maandCentenVoor(lijst, 'rtg'), 9900);
  assert.equal(maandCentenVoor(lijst, 'lifestyle'), 1500000);
  // en nul is een geldige keuze, geen "niet ingesteld"
  assert.equal(maandCentenVoor({ rtg: { maandCenten: 0 } }, 'rtg'), 0,
    'wie de RTG Pass op nul zet, bedoelt nul');
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
  assert.equal(passen.lifestyle.maandCenten, STANDAARD.lifestyle,
    'idem Lifestyle');
  assert.equal(passen.business.opMaat, true, 'en de regie noemt Business zelf op maat');
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
