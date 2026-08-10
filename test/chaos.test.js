/* De meetkant van de chaosproef (scripts/lib/chaosmeet.js).

   HET OMLEGGEN ZELF IS EEN SCRIPT (scripts/chaos.js): dat start een eigen trio,
   schiet de ACTIEVE server met SIGKILL om en meet door. Dat hoort niet in de
   suite -- het start processen en duurt tientallen seconden. Wat hier WEL hoort
   is het rekenen over de monsters, want juist daar zit de verleiding om er een
   gunstig getal van te maken.

   DRIE DINGEN DIE DEZE TOETS VASTHOUDT:

   1. NOOIT HERSTELD IS NIET NUL. Als er na de klap geen enkel verzoek meer
      lukt, is de hersteltijd ONBEKEND en het oordeel 'niet hersteld'. Een nul
      of "de duur van de proef" invullen zou de ergste uitkomst tot de mooiste
      maken.
   2. GEEN ONDERBREKING GEMETEN IS GEEN BEWIJS. Tussen twee metingen kan een
      hele failover passen. De uitslag heet daarom 'geen onderbreking gemeten'
      en zegt er zelf bij wat dat wel en niet betekent.
   3. DE HERSTELTIJD LOOPT VANAF DE EERSTE MISLUKKING. Vanaf de klap rekenen
      maakt de uitslag afhankelijk van hoe vaak je meet; die meetafstand staat
      apart in de uitslag.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - bij 'niet hersteld' de hersteltijd op 0 zetten
     -> "nooit hersteld is geen hersteltijd van nul" ZAKT (RAAK)
   - de hersteltijd vanaf de klap rekenen in plaats van vanaf de eerste fout
     -> "de hersteltijd loopt vanaf de eerste mislukking" ZAKT (RAAK)
   - fouten van VOOR de klap meetellen voor het herstel
     -> "een storing van voor de klap telt niet als deze onderbreking" ZAKT (RAAK)

   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { meet } = require('../scripts/lib/chaosmeet');

/* Een reeks monsters bouwen: begin op t=0, elke stap 25 ms, en `patroon` zegt
   per stap of het verzoek lukte. */
function reeks(patroon, stap) {
  const s = stap || 25;
  return patroon.split('').map((c, i) => ({ at: i * s, ok: c === '.' }));
}

test('een onderbreking met herstel levert een hersteltijd op', () => {
  //            0    1    2    3    4    5    6    7    8
  const m = reeks('...xxx...');
  const u = meet(m, 3 * 25);          // de klap valt net voor het eerste kruis
  assert.equal(u.oordeel, 'hersteld');
  assert.equal(u.eersteFoutAt, 75);
  assert.equal(u.herstelAt, 150);
  assert.equal(u.hersteltijdMs, 75, 'van de eerste mislukking tot het eerste herstel');
  assert.equal(u.mislukt, 3);
  assert.equal(u.deelGelukt, 0.6667);
  assert.equal(u.let, null);
});

test('de hersteltijd loopt vanaf de eerste mislukking', () => {
  /* De klap valt hier ruim VOOR het eerste gemiste verzoek. Dat gat is de
     meetafstand en geen storing; hem meerekenen zou de uitslag afhankelijk
     maken van hoe vaak je meet. */
  const m = reeks('.....xx...');
  const u = meet(m, 0);
  assert.equal(u.hersteltijdMs, 50, 'twee gemiste metingen van 25 ms');
  assert.equal(u.meetvertragingMs, 125, 'en de afstand tot de klap staat er apart bij');
});

test('nooit hersteld is geen hersteltijd van nul', () => {
  /* DE KERN. Dit is de ernstigste uitslag die deze proef kent, en hij moet dat
     blijven. */
  const u = meet(reeks('...xxxxxx'), 50);
  assert.equal(u.oordeel, 'niet hersteld');
  assert.equal(u.hersteltijdMs, null, 'onbekend, en dus niet nul');
  assert.equal(u.herstelAt, null);
  assert.match(u.let, /ernstigste uitslag/);
});

test('geen onderbreking gemeten is een uitslag en geen bewijs', () => {
  const u = meet(reeks('........'), 50);
  assert.equal(u.oordeel, 'geen onderbreking gemeten');
  assert.equal(u.mislukt, 0);
  assert.equal(u.hersteltijdMs, null);
  assert.match(u.let, /geen bewijs/);
});

test('een storing van voor de klap telt niet als deze onderbreking', () => {
  /* Er ging al iets mis voordat er iets werd omgelegd. Dat hoort in het totaal
     mee te tellen, maar het is niet DEZE onderbreking -- anders meet de proef
     een storing die er al was en schrijft hij die op het conto van de failover. */
  const m = reeks('x..x......');
  const u = meet(m, 100);                 // klap na de twee eerdere kruisjes
  assert.equal(u.mislukt, 2, 'ze tellen wel mee in het totaal');
  assert.equal(u.oordeel, 'geen onderbreking gemeten', 'maar niet als onderbreking van deze klap');
  assert.equal(u.eersteFoutAt, null);
});

test('de monsters mogen door elkaar binnenkomen', () => {
  const m = reeks('...xx...');
  const doorElkaar = [m[4], m[0], m[7], m[3], m[1], m[6], m[2], m[5]];
  const u = meet(doorElkaar, 75);
  assert.equal(u.oordeel, 'hersteld');
  assert.equal(u.hersteltijdMs, 50);
});

test('zonder monsters komt er geen verzonnen uitslag uit', () => {
  const u = meet([], 0);
  assert.equal(u.verzoeken, 0);
  assert.equal(u.deelGelukt, null);
  assert.equal(u.oordeel, 'geen onderbreking gemeten');
});
