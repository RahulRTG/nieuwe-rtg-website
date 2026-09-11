/* EEN FACTUUR LEEST NOOIT DE PRIJS VAN VANDAAG.

   DE FOUT DIE DIT VASTLEGT. kern/lid/facturen.js schreef bij het TONEN het
   bedrag van elke bijdragefactuur opnieuw, uit de huidige boardroomprijs:

       ...(bijdrageCenten == null ? {} : { netto: 0,
         bijdrage: btw.overNetto(bijdrageCenten, md.btwProfiel).brutoCenten / 100 })

   Dat is het tegenovergestelde van wat kern/commercie/contract.js belooft en van
   wat COMMERCIE.md 3b besloot: `afgesprokenCenten` is een MOMENTOPNAME en
   `prijsVastTot` zegt tot wanneer hij vaststaat. Zet de eigenaar de prijs van de
   RTG Pass van 65 op 99, dan stond er bij een lid met een lopend contract van 65
   de volgende seconde 99 op zijn eigen factuurscherm -- terwijl de OPGESLAGEN
   factuur, die de betaalwegen lezen, nog 65 droeg. Twee bedragen voor een
   verplichting, en het lid las degene die hij niet had afgesproken.

   WAAROM DIT GEEN LOSSE BUG IS. Het is dezelfde fout als de drie uiteengelopen
   pasprijzen uit de kop van ../server/kern/pasprijs.js, maar een trede hoger: daar
   liepen drie KOPIEEN van een prijs uiteen, hier lopen de prijs van het PRODUCT
   en de prijs van de VERPLICHTING door elkaar. Dat zijn twee verschillende
   dingen, en alleen het eerste mag bewegen.

   WAT DEZE TOETS NIET DOET. Hij raakt test/pasprijs.test.js toets 6 niet aan.
   Die bewaakt dat een wijziging in de boardroom overal doorkomt in de PRIJSLIJST
   -- dat blijft waar en hoort waar te blijven. Een nieuw lid betaalt 99; een
   lid dat 65 tekende betaalt 65. Dat is precies het onderscheid dat COMMERCIE.md
   vraagt en dat hiervoor niet bestond.

   Draai los: node --test test/factuurbevroren.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakFacturen = require('../server/kern/lid/facturen');

/* Een minimale i18n: deze toets gaat over bedragen en niet over taal. */
const i18n = { localize: (s) => s };

/* De prijslijst van de boardroom, als een knop die we kunnen omzetten. */
function prijslijst(centen) {
  let nu = centen;
  return { lees: () => ({ passen: { rtg: { maandCenten: nu } } }), zet: (c) => { nu = c; } };
}

test('1. een opgeslagen bijdragefactuur houdt zijn eigen bedrag als de boardroomprijs verandert', () => {
  const lijst = prijslijst(6500);
  const { facturenVoor } = maakFacturen({ i18n, deps: { geldPasprijzen: lijst.lees } });

  /* Het lid tekende voor 65 euro ex btw; de factuur die daaruit volgde draagt
     65 x 1,21 = 78,65 inclusief. */
  const md = { invoices: [{ id: 'RTG-2026-09-0042', desc: 'Maandbijdrage lidmaatschap',
    maand: '2026-09', netto: 0, bijdrage: 78.65, status: 'open', date: 'Vervalt 1 oktober 2026' }] };

  const voor = facturenVoor(md, 'rtg', 'nl');
  assert.equal(voor[0].bijdrage, 78.65, 'vooraf: de factuur draagt wat er is afgesproken');

  // de eigenaar zet de prijs van de RTG Pass op 99 euro
  lijst.zet(9900);

  const na = facturenVoor(md, 'rtg', 'nl');
  assert.equal(na[0].bijdrage, 78.65,
    'een prijswijziging in de boardroom mag een BESTAANDE factuur niet herschrijven');
});

test('2. de prijslijst beweegt wel, en een verse factuur volgt hem', () => {
  const lijst = prijslijst(6500);
  const { eersteBijdrageFactuur } = maakFacturen({ i18n, deps: { geldPasprijzen: lijst.lees } });

  const eerst = eersteBijdrageFactuur('rtg', 42, '2026-09-11T10:00:00.000Z');
  assert.equal(eerst.bijdrage, 78.65, 'een verse factuur rekent met de prijs van vandaag');

  lijst.zet(9900);
  const later = eersteBijdrageFactuur('rtg', 43, '2026-10-11T10:00:00.000Z');
  assert.equal(later.bijdrage, 119.79, 'en na de wijziging met de nieuwe prijs: 99 x 1,21');
});

test('3. een bijdragefactuur ZONDER bedrag krijgt er geen uit de prijslijst', () => {
  const lijst = prijslijst(6500);
  const { facturenVoor } = maakFacturen({ i18n, deps: { geldPasprijzen: lijst.lees } });

  /* Dit is het geval waarvoor het overschrijven er ooit kwam: een geseede of
     oude factuur zonder bedrag. Hem vullen uit de prijslijst is een bedrag
     VERZINNEN voor een verplichting die niemand heeft vastgelegd -- en dat is
     precies wat KOSTEN.md verbiedt: er staat nooit een getal waar er geen is.
     Nul is hier het eerlijke antwoord en niet 78,65. */
  const md = { invoices: [{ id: 'RTG-2026-07-0207', desc: 'Maandbijdrage lidmaatschap',
    netto: 0, bijdrage: 0, status: 'open', date: 'Vervalt 1 augustus 2026' }] };

  const uit = facturenVoor(md, 'rtg', 'nl');
  assert.equal(uit[0].bijdrage, 0,
    'geen vastgelegd bedrag blijft geen bedrag; de prijslijst vult hem niet aan');
});

test('4. de omschrijving mag wel meebewegen -- dat is taal en geen bedrag', () => {
  const lijst = prijslijst(6500);
  const { facturenVoor } = maakFacturen({ i18n, deps: { geldPasprijzen: lijst.lees } });
  const md = { invoices: [{ id: 'RTG-2026-09-0042', desc: 'Maandbijdrage lidmaatschap',
    maand: '2026-09', netto: 0, bijdrage: 78.65, status: 'open', date: 'x' }] };

  const nl = facturenVoor(md, 'rtg', 'nl')[0];
  assert.match(nl.desc, /RTG Pass/, 'de pasnaam staat erop');
  assert.match(nl.desc, /september 2026/, 'en de maand van DEZE factuur');
  const en = facturenVoor(md, 'rtg', 'en')[0];
  assert.match(en.desc, /Monthly contribution/, 'en in het Engels net zo');
  assert.equal(en.bijdrage, 78.65, 'het bedrag is in beide talen hetzelfde');
});
