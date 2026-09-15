/* DE MEEGELEVERDE WETSWIJZIGINGEN (server/kern/fiscaal/meegeleverd/).

   De basistabel van kern/fiscaal/landen.js draagt het PEILJAAR. Een wet die
   daarna veranderde hoort er als jaargang bovenop, met haar ingangsdatum -- want
   anders bestaat zo'n wijziging alleen in de database van wie hem ooit met de
   hand invoerde, en is hij na een verse seed weer weg.

   Het duurste geval van vandaag is Duitsland: tot 31 december 2025 viel een
   restaurantmaaltijd daar op 19%, sinds 1 januari 2026 op 7%. Wie dat als een
   plat getal in de basistabel zet, verplaatst OOK de omzet van 2025 -- en dat is
   precies de fout die de omzetproef bij de terugstorting al een keer vond.

   Draai los: node --test test/fiscaal-meegeleverd.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MAP = path.join(__dirname, '..', 'server', 'kern', 'fiscaal', 'meegeleverd');

/* Dezelfde opstelling als test/fiscaal-jaargangen.test.js: een verzette klok,
   want alles hier gaat over data. De basistabel is de ECHTE, want de bewering
   gaat juist over wat er in kern/fiscaal/landen.js staat. */
function opstelling(startDag) {
  let dag = startDag || '2026-09-14';
  const { LANDEN } = require('../server/kern/fiscaal/landen');
  const kopie = JSON.parse(JSON.stringify(LANDEN));
  const db = { data: {} };
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({
    db, save: () => {}, LANDEN: kopie, peiljaar: 2025, nu: () => dag + 'T09:00:00.000Z' });
  return { LANDEN: kopie, db, regelwacht, j: regelwacht.jaargangen, zetDag: (d) => { dag = d; } };
}

test('1. elke meegeleverde wijziging draagt land, ingangsdatum en rechtsgrond', () => {
  const namen = fs.readdirSync(MAP).filter(n => n.endsWith('.json'));
  assert.ok(namen.length, 'er is geen enkele meegeleverde wijziging meer');
  for (const naam of namen) {
    const j = JSON.parse(fs.readFileSync(path.join(MAP, naam), 'utf8'));
    assert.match(String(j.land), /^[A-Z]{2}$/, naam + ' noemt geen land');
    assert.match(String(j.geldigVanaf), /^\d{4}-\d{2}-\d{2}$/, naam + ' draagt geen ingangsdatum');
    assert.ok(String(j.rechtsgrond || '').trim().length >= 10, naam + ' draagt geen rechtsgrond');
    assert.ok(j.wijzigingen && Object.keys(j.wijzigingen).length, naam + ' wijzigt niets');
    /* Een meegeleverde wijziging is per definitie niet door een mens tegen de
       primaire tekst gelegd; staat die belofte er niet bij, dan leest hij als
       gecontroleerd. Zelfde afspraak als kern/payroll/jaargangen/nl-2026.json. */
    assert.match(String(j._let_op || ''), /ONGECONTROLEERD/,
      naam + ' zegt niet dat hij ongecontroleerd is');
  }
});

/* MUTATIE GEZIEN ZAKKEN: geldigVanaf op 2025-01-01 gezet; toets 2 zakte op de
   verkoop van 2025, precies zoals bedoeld. */
test('2. de Duitse wijziging verplaatst de omzet van 2025 NIET', () => {
  const o = opstelling('2026-09-14');
  o.regelwacht.laadMeegeleverd();

  assert.equal(o.j.tariefOp('DE', 'eten', '2025-06-15'), 19, 'een maaltijd van juni 2025 blijft op 19%');
  assert.equal(o.j.tariefOp('DE', 'eten', '2025-12-31'), 19, 'de dag voor de wetswijziging ook');
  assert.equal(o.j.tariefOp('DE', 'eten', '2026-01-01'), 7, 'vanaf de ingangsdatum 7%');
  assert.equal(o.j.tariefOp('DE', 'eten', '2026-09-14'), 7, 'en vandaag nog steeds');
  /* Dranken zijn NIET meeveranderd; wie dat wel doet, haalt de helft van de
     Duitse horeca-omzet naar het verlaagde tarief. */
  assert.equal(o.j.tariefOp('DE', 'drank', '2026-09-14'), 19, 'dranken blijven 19%');
});

test('3. hij komt binnen als ongecontroleerd, niet als goedgekeurd', () => {
  const o = opstelling('2026-09-14');
  o.regelwacht.laadMeegeleverd();
  const lijst = (o.db.data.fiscaalJaargangen || {}).DE || [];
  assert.equal(lijst.length, 1, 'de Duitse wijziging is niet opgenomen');
  const j = lijst[0];
  assert.equal(j.stand, 'ongecontroleerd',
    'een meegeleverde wijziging mag zichzelf niet goedkeuren -- er heeft geen mens naar gekeken');
  assert.equal(j.goedgekeurdDoor, null, 'en dus staat er ook niemand onder');
  assert.equal(j.bron.soort, 'meegeleverd', 'de herkomst hoort meegeleverd te heten');
  assert.equal(j.bron.gezag, 'indicatief',
    'het gezag is indicatief: de primaire tekst is vanaf de bouwmachine niet te lezen');
  assert.match(String(j.rechtsgrond), /UStG/, 'de rechtsgrond reist niet mee');
  assert.equal(j.vorige && j.vorige.tarieven && j.vorige.tarieven.eten, 19,
    'de jaargang weet niet meer wat hij verving');
});

/* MUTATIE GEZIEN ZAKKEN: de tweede laadMeegeleverd() weggehaald; de toets bleef
   groen en bewees dus niets. Met beide aanroepen zakt hij zodra pasToe niet meer
   op de LOPENDE waarde vergelijkt. */
test('4. twee keer laden levert geen tweede jaargang op', () => {
  const o = opstelling('2026-09-14');
  o.regelwacht.laadMeegeleverd();
  o.regelwacht.laadMeegeleverd();
  const lijst = (o.db.data.fiscaalJaargangen || {}).DE || [];
  assert.equal(lijst.length, 1,
    'elke herstart zou een jaargang opstapelen, en dan groeit de geschiedenis met gebeurtenissen die niet plaatsvonden');
});

test('5. Spanje is GEEN meegeleverde wijziging, want daar veranderde niets', () => {
  const namen = fs.readdirSync(MAP).filter(n => n.endsWith('.json'));
  for (const naam of namen) {
    const j = JSON.parse(fs.readFileSync(path.join(MAP, naam), 'utf8'));
    assert.notEqual(j.land, 'ES',
      'ES staat als meegeleverde wijziging. Het Spaanse tarief is niet veranderd -- wij hadden het mis ' +
      '(art. 91 Ley 37/1992: de dienst beslist, dus de horecadienst is 10%). Een correctie hoort in de ' +
      'basistabel; een jaargang zou beweren dat er op een datum iets veranderde wat nooit is gebeurd.');
  }
  const { LANDEN } = require('../server/kern/fiscaal/landen');
  assert.equal(LANDEN.ES.tarieven.drank, 10, 'de correctie in de basistabel is teruggedraaid');
});
