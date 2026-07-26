/* RTG Office: de formulemotor van het rekenblad.

   Dit is de test die de belofte "alle pro-functies, bij ons gewoon" hard maakt
   voor het rekenblad. Drie dingen staan hier bovenaan, want ze zijn geen
   details:

   - EEN FORMULE DRAAIT NOOIT ALS CODE. Er is geen eval en geen Function; een
     formule die niet in de grammatica past, rekent niet. Een gedeeld document
     is invoer van een vreemde.
   - EEN FOUT BLIJFT ZICHTBAAR. #DEEL/0! wordt geen nul, een kringverwijzing
     wordt geen stille 0. Een rekenblad waarin een fout verdwijnt is
     gevaarlijker dan een rekenblad dat niets kan.
   - NEDERLANDS EN ENGELS ZIJN DEZELFDE FUNCTIE. Wie een formule van een
     collega plakt, hoeft niets te vertalen.
   Draai: node --test test/rekenmotor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/shared/rekenmotor.js');

// Een klein blad om op te rekenen. Blad2 zit ernaast, voor de verwijzingen.
const BLAD = { A1: '10', A2: '20', A3: '30', A4: 'appel', A5: '',
  B1: '5', B2: '7', B3: '3', B4: 'peer',
  C1: '=A1*2', C2: '=SOM(A1:A3)', D1: '2026-07-26' };
const BLAD2 = { A1: '100' };
const motor = () => M.maak({ ruw: (blad, k, r) => ((blad === 'Blad2' ? BLAD2 : BLAD)[M.kolNaam(k) + (r + 1)] || '') });
const uit = (f) => motor().waarde(f);

test('kolommen tellen door na Z, want A tot en met H is geen grens die je kunt uitleggen', () => {
  assert.equal(M.kolNaam(0), 'A');
  assert.equal(M.kolNaam(25), 'Z');
  assert.equal(M.kolNaam(26), 'AA');
  assert.equal(M.kolNaam(701), 'ZZ');
  assert.equal(M.kolIndex('A'), 0);
  assert.equal(M.kolIndex('AA'), 26);
  assert.equal(M.kolIndex(M.kolNaam(500)), 500, 'heen en terug levert hetzelfde op');
});

test('rekenen met de gewone voorrang, haakjes, machten en procenten', () => {
  assert.equal(uit('1+2*3'), 7);
  assert.equal(uit('(1+2)*3'), 9);
  assert.equal(uit('2^10'), 1024);
  assert.equal(uit('-3+5'), 2);
  assert.equal(uit('21%*100'), 21, 'een procent is een honderdste, ook los');
  assert.equal(uit('A1+B1*2'), 20, 'verwijzingen rekenen mee');
  assert.equal(uit('1,5+2'), 3.5, 'de komma is hier het decimaalteken');
  assert.equal(uit('1.5+2'), 3.5, 'en de punt mag ook, want half Europa typt zo');
});

test('een formule die niet in de grammatica past, rekent niet', () => {
  // Dit is de veiligheidsregel, geen nette-invoer-regel: er is geen eval.
  const gevaar = ['1;2', 'alert(1)', 'this', 'A1]+1', '2+', '((1+2)', '"open'];
  for (const f of gevaar) {
    assert.equal(M.isFout(uit(f)), true, 'geweigerd: ' + f + ' gaf ' + JSON.stringify(uit(f)));
  }
  // en een naam die geen functie is levert #NAAM?, geen lege cel
  assert.equal(uit('ONZIN(1)'), M.FOUT.naam);
});

test('een fout reist omhoog en blijft zichtbaar', () => {
  assert.equal(uit('1/0'), '#DEEL/0!');
  assert.equal(uit('SOM(A1:A3)/0'), '#DEEL/0!');
  assert.equal(uit('ALS.FOUT(1/0;"n.v.t.")'), 'n.v.t.', 'opvangen kan, maar alleen als u het zelf zegt');
  // een kringverwijzing wordt geen 0 maar een melding
  const lus = M.maak({ ruw: (b, k, r) => ({ A1: '=A2', A2: '=A1' })[M.kolNaam(k) + (r + 1)] || '' });
  assert.equal(lus.waarde('A1'), '#LUS!');
  assert.equal(lus.waarde('1+1'), 2, 'en de motor rekent daarna gewoon door');

  /* Ook een fout MIDDEN IN een bereik reist omhoog. Zonder deze regel geeft
     =SOM(A1:A9) over een kolom met één kapotte cel een keurig getal dat niet
     klopt, en dat is de gevaarlijkste uitkomst die een rekenblad kan geven:
     eentje die je gelooft. */
  const kapot = M.maak({ ruw: (b, k, r) => ({ A1: '10', A2: '=1/0', A3: '30' })[M.kolNaam(k) + (r + 1)] || '' });
  assert.equal(kapot.waarde('SOM(A1:A3)'), '#DEEL/0!', 'de som verzwijgt de kapotte cel niet');
  assert.equal(kapot.waarde('GEM(A1:A3)'), '#DEEL/0!');
  assert.equal(kapot.waarde('SOM(A1:A1)+SOM(A3:A3)'), 40, 'zonder die cel telt hij gewoon op');
});

test('Nederlands en Engels zijn dezelfde functie', () => {
  const paren = [['SOM(A1:A3)', 'SUM(A1:A3)'], ['GEM(A1:A3)', 'AVERAGE(A1:A3)'],
    ['AANTAL(A1:A4)', 'COUNT(A1:A4)'], ['AFRONDEN(1,26;1)', 'ROUND(1,26;1)'],
    ['LINKS(A4;2)', 'LEFT(A4;2)'], ['ALS(1>0;1;2)', 'IF(1>0;1;2)']];
  for (const [nl, en] of paren) assert.deepEqual(uit(nl), uit(en), nl + ' <> ' + en);
});

test('optellen slaat tekst over, tellen kent het verschil', () => {
  assert.equal(uit('SOM(A1:A4)'), 60, 'de tekst "appel" is geen fout en telt niet mee');
  assert.equal(uit('AANTAL(A1:A4)'), 3, 'AANTAL telt getallen');
  assert.equal(uit('AANTALARG(A1:A4)'), 4, 'AANTALARG telt alles wat er staat');
  assert.equal(uit('MAX(A1:A3)'), 30);
  assert.equal(uit('MEDIAAN(B1:B3)'), 5);
});

test('voorwaarden: alleen optellen wat aan de eis voldoet', () => {
  assert.equal(uit('SOM.ALS(A1:A3;">15")'), 50);
  assert.equal(uit('AANTAL.ALS(A1:A3;">=20")'), 2);
  assert.equal(uit('SOM.ALS(A1:A4;"appel";B1:B4)'), 0, 'geen getal om op te tellen levert 0, geen fout');
  assert.equal(uit('SOMPRODUCT(A1:A3;B1:B3)'), 10 * 5 + 20 * 7 + 30 * 3);
});

/* ALS mag maar één tak aanraken. Zonder die regel zou =ALS(B?=0;0;1/B?) op een
   lege cel alsnog #DEEL/0! geven -- precies de formule die mensen schrijven om
   dat te voorkomen. */
test('ALS raakt alleen de tak aan die hij nodig heeft', () => {
  assert.equal(uit('ALS(A5=0;"leeg";1/A5)'), 'leeg');
  assert.equal(uit('ALS(A1>5;"boven";"onder")'), 'boven');
  assert.equal(uit('EN(A1>5;B1>1)'), true);
  assert.equal(uit('OF(A1>500;B1>1)'), true);
  assert.equal(uit('NIET(A1>500)'), true);
});

test('zoeken: standaard exact, want bij benadering is de bron van stille fouten', () => {
  assert.equal(uit('VERT.ZOEKEN("appel";A1:B4;2)'), 'peer');
  assert.equal(uit('VERT.ZOEKEN("banaan";A1:B4;2)'), '#LEEG!', 'niet gevonden is niet "de dichtstbijzijnde"');
  assert.equal(uit('VERGELIJKEN("appel";A1:A4)'), 4);
  assert.equal(uit('INDEX(A1:A4;2)'), 20);
});

test('tekst, datums en geld', () => {
  assert.equal(uit('"Hallo "&A4'), 'Hallo appel');
  assert.equal(uit('HOOFDLETTERS(A4)'), 'APPEL');
  assert.equal(uit('LENGTE(A4)'), 5);
  assert.equal(uit('DEEL("Rahul Travel";7;6)'), 'Travel', 'de eerste letter is 1, zoals een mens telt');
  assert.equal(uit('JAAR(D1)'), 2026);
  assert.equal(uit('MAAND(D1)'), 7);
  assert.equal(uit('DAGEN("2026-08-01";D1)'), 6);
  assert.equal(uit('WEEKDAG("2026-07-27")'), 1, 'maandag is 1, zoals elke agenda hier');
  assert.equal(uit('BTW(100)'), 21);
  assert.equal(Math.round(uit('BET(0,004;120;250000)')), -2627, 'een annuïteit, op de euro af');
});

test('afronden doet wat een boekhouder verwacht', () => {
  assert.equal(uit('AFRONDEN(2,675;2)'), 2.68, 'een halve cent gaat omhoog, ook met drijvende-kommaruis');
  assert.equal(uit('AFRONDEN(-2,5;0)'), -3, 'van nul af, niet naar beneden');
  assert.equal(uit('AFRONDEN.NAAR.BOVEN(1,01;0)'), 2);
  assert.equal(uit('AFRONDEN.NAAR.BENEDEN(1,99;0)'), 1);
  assert.equal(uit('AFRONDEN(1234;-2)'), 1200, 'negatieve decimalen ronden op honderdtallen');
});

test('een cel met een formule telt mee als zijn uitkomst, ook over bladen heen', () => {
  assert.equal(uit('C1'), 20, 'C1 is =A1*2');
  assert.equal(uit('C1+C2'), 20 + 60, 'formules die naar formules wijzen');
  assert.equal(uit('Blad2!A1'), 100);
  assert.equal(uit('Blad2!A1+A1'), 110, 'een verwijzing naar een ander blad rekent gewoon mee');
});
