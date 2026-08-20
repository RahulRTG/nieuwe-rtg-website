/* ============================================================================
   DE BETAALDIENSTVERGOEDING: verschuldigd is iets anders dan geboekt.

   In kern/pay/kassa.js stond:

       if (kb.error) kosten = 0;

   Mislukte de kostenboeking, dan werden de kosten NUL -- in de teruggave aan de
   kassa en dus op de bon. De vordering van RTG op de zaak verdween, en niemand
   kon achteraf zien dat hij ooit had bestaan: het grootboek sloot immers netjes,
   er was niets geboekt. Geen enkele sluitcontrole kan dit vinden.

   Dat is precies de fout die kern/betaalopdracht/ voor de uitgaande SEPA
   oploste, met een andere naam: daar was het verschil tussen "geboekt" en "echt
   weg", hier tussen "verschuldigd" en "geboekt".

   DE BEWERING DIE ERTOE DOET staat in toets 4: na een mislukte boeking is het
   bedrag nog steeds verschuldigd en staat het in de rij. Alle andere toetsen
   hier zijn er om die ene te kunnen vertrouwen.

   Draai los: node --experimental-sqlite --test test/betaaldienstfee.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakFees, STATUS, magOvergaan } = require('../server/kern/commercie/fee');

function verse() {
  const db = { data: {} };
  let bewaard = 0;
  const fees = maakFees({ db, save: () => { bewaard++; }, nu: () => 1000 });
  return { db, fees, saves: () => bewaard };
}

test('1. een geslaagde betaling legt de vergoeding vast VOOR er geboekt is', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'KIKUNOI', centen: 32, transactieCenten: 2200, ref: 'ABC123' });
  assert.ok(f, 'er komt een rij');
  assert.equal(f.status, STATUS.OPENSTAAND,
    'vastgelegd als vordering, nog niet geboekt -- dat is de hele reparatie');
  assert.equal(f.centen, 32);
  assert.equal(f.transactieCenten, 2200, 'de transactie waar hij bij hoort staat erbij');
  assert.equal(fees.openstaand('KIKUNOI').centen, 32);
});

test('2. een vergoeding van nul is geen vordering en krijgt geen rij', () => {
  const { fees } = verse();
  assert.equal(fees.incasseer({ supplierCode: 'X', centen: 0, transactieCenten: 500 }), null,
    'staat er geen tarief ingesteld, dan is er niets verschuldigd');
  assert.equal(fees.openstaand('X').aantal, 0, 'en dus ook geen open post');
});

test('3. een geslaagde boeking haalt de vergoeding uit de openstaande post', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.geboekt(f, 'boeking-1');
  assert.equal(f.status, STATUS.GEBOEKT);
  assert.equal(f.ledgerRef, 'boeking-1', 'met de grootboekregel erbij, zodat het na te lopen is');
  assert.equal(fees.openstaand('A').centen, 0, 'geboekt telt niet meer als verschuldigd');
});

/* DE BEWERING. Dit is wat er vroeger niet gebeurde. */
test('4. een MISLUKTE boeking laat de vordering staan, met de reden erbij', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.mislukt(f, { error: 'Motor onbereikbaar.' });

  assert.equal(f.status, STATUS.HERKANSING);
  assert.equal(f.centen, 32, 'het bedrag wordt NIET nul -- dat was de fout');
  assert.equal(fees.openstaand('A').centen, 32,
    'en het staat nog steeds open: een mislukte boeking maakt de vordering niet kleiner');
  assert.equal(fees.openstaand('A').herkansingen, 1, 'zichtbaar als iets dat aandacht vraagt');
  assert.match(f.laatsteFout, /Motor onbereikbaar/,
    '"het lukte niet" zonder reden is een rij waar niemand iets mee kan');
  assert.equal(f.pogingen, 1);
});

test('5. herkansen mag opnieuw mislukken, en dat wordt geteld', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.mislukt(f, 'eerst');
  fees.mislukt(f, 'nog eens');
  fees.mislukt(f, 'en nog eens');
  assert.equal(f.pogingen, 3, 'een tweede mislukking is geen fout in de machine maar een feit');
  assert.equal(f.status, STATUS.HERKANSING);
  assert.equal(fees.openstaand('A').centen, 32, 'nog altijd verschuldigd');

  // en een herkansing kan alsnog slagen
  fees.geboekt(f, 'boeking-9');
  assert.equal(f.status, STATUS.GEBOEKT);
  assert.equal(fees.openstaand('A').centen, 0);
});

/* Een status die achteruit kan lopen maakt elk getal eronder waardeloos --
   dezelfde regel als in kern/betaalopdracht/index.js, en met opzet dezelfde
   vorm. */
test('6. de statusmachine weigert een sprong die niet mag', () => {
  assert.equal(magOvergaan(STATUS.OPENSTAAND, STATUS.GEBOEKT), true);
  assert.equal(magOvergaan(STATUS.HERKANSING, STATUS.GEBOEKT), true);
  assert.equal(magOvergaan(STATUS.GEBOEKT, STATUS.OPENSTAAND), false, 'geboekt gaat niet terug naar openstaand');
  assert.equal(magOvergaan(STATUS.AFGESTEMD, STATUS.GEBOEKT), false, 'afgestemd is een eindstand');
  assert.equal(magOvergaan(STATUS.GEINCASSEERD, STATUS.GEBOEKT), false,
    'boeken zonder eerst vast te leggen kan niet -- dan bestaat de rij niet als het misgaat');

  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 10, transactieCenten: 100 });
  fees.geboekt(f, 'b');
  fees.stemAf(f);
  const weer = fees.geboekt(f, 'b2');
  assert.ok(weer.error, 'en de weigering komt als fout terug, niet stil');
  assert.equal(f.status, STATUS.AFGESTEMD, 'de stand is niet veranderd');
});

test('7. afstemmen is een tweede meting, na het boeken', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  assert.ok(fees.stemAf(f).error, 'afstemmen kan niet voordat er geboekt is');
  fees.geboekt(f, 'b');
  assert.ok(fees.stemAf(f).ok);
  assert.equal(f.status, STATUS.AFGESTEMD);
});

test('8. het verloop blijft bewaard, zodat een rij navertelbaar is', () => {
  const { fees } = verse();
  const f = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.mislukt(f, 'rail weg');
  fees.geboekt(f, 'b');
  fees.stemAf(f);
  assert.deepEqual(f.verloop.map(v => v.naar),
    [STATUS.GEINCASSEERD, STATUS.OPENSTAAND, STATUS.HERKANSING, STATUS.GEBOEKT, STATUS.AFGESTEMD]);
});

test('9. openstaand telt per zaak, en over alle zaken', () => {
  const { fees } = verse();
  const a = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.incasseer({ supplierCode: 'A', centen: 18, transactieCenten: 800 });
  fees.incasseer({ supplierCode: 'B', centen: 25, transactieCenten: 1500 });
  fees.geboekt(a, 'b');

  assert.equal(fees.openstaand('A').centen, 18, 'alleen wat bij A nog openstaat');
  assert.equal(fees.openstaand('B').centen, 25);
  assert.equal(fees.openstaand().centen, 43, 'en zonder zaak: het hele huis');
});

/* DE HERKANSINGSRONDE. Tot nu toe bleef een HERKANSING staan tot iemand keek:
   zichtbaar, maar niemand pakte hem op. Dat stond zo als open punt in
   PRIJZEN.md 4.3 -- en een openstaand punt dat je kunt sluiten, hoor je te
   sluiten. */
test('10. de herkansingsronde boekt alsnog wat eerder mislukte', async () => {
  const { fees } = verse();
  const a = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  const b = fees.incasseer({ supplierCode: 'B', centen: 18, transactieCenten: 900 });
  fees.mislukt(a, 'motor weg');
  fees.mislukt(b, 'motor weg');
  assert.equal(fees.openstaand().centen, 50);

  const r = await fees.herkans(async () => ({ boeking: { id: 'b-nieuw' } }));
  assert.equal(r.geprobeerd, 2);
  assert.equal(r.gelukt, 2);
  assert.equal(fees.openstaand().centen, 0, 'na een geslaagde ronde staat er niets meer open');
  assert.equal(a.status, STATUS.GEBOEKT);
});

test('11. een ronde die weer mislukt telt door en geeft niet op', async () => {
  const { fees } = verse();
  const a = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.mislukt(a, 'eerste keer');

  const r = await fees.herkans(async () => ({ error: 'nog steeds weg' }));
  assert.equal(r.mislukt, 1);
  assert.equal(a.pogingen, 2, 'de poging is geteld');
  assert.equal(a.status, STATUS.HERKANSING, 'en hij blijft verschuldigd');
  assert.equal(fees.openstaand().centen, 32, 'opgeven is geen optie: de vordering bestaat nog');
  assert.match(a.laatsteFout, /nog steeds weg/);
});

/* Na een aantal keer is het geen hapering maar een defect. De rij blijft staan
   -- maar hij valt buiten de ronde, en dan hoort dat GETELD te worden: een rij
   die stil buiten de ronde valt is net zo onzichtbaar als de nul die we hebben
   weggehaald. */
test('12. na te veel pogingen stopt de ronde ermee, zichtbaar', async () => {
  const { fees } = verse();
  const a = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  for (let i = 0; i < 5; i++) fees.mislukt(a, 'blijft stuk');
  assert.equal(a.pogingen, 5);

  const r = await fees.herkans(async () => ({ boeking: { id: 'x' } }), { maxPogingen: 5 });
  assert.equal(r.geprobeerd, 0, 'deze wordt niet meer geprobeerd');
  assert.equal(r.vastgelopen, 1, 'maar hij wordt wel geteld');
  assert.equal(r.vastgelopenCenten, 32, 'met het bedrag erbij, zodat het op een bord kan');
  assert.equal(fees.openstaand().centen, 32, 'en hij staat nog steeds open');
});

test('13. een ronde pakt niet meer dan haar maximum in een keer', async () => {
  const { fees } = verse();
  for (let i = 0; i < 10; i++) {
    const f = fees.incasseer({ supplierCode: 'A', centen: 10, transactieCenten: 100 });
    fees.mislukt(f, 'weg');
  }
  const r = await fees.herkans(async () => ({ boeking: { id: 'x' } }), { maxPerRonde: 3 });
  assert.equal(r.geprobeerd, 3, 'een ronde van duizend boekingen legt de motor om als hij al moeite heeft');
  assert.equal(fees.openstaand().aantal, 7);
});

test('14. een boekfunctie die gooit, laat de ronde niet omvallen', async () => {
  const { fees } = verse();
  const a = fees.incasseer({ supplierCode: 'A', centen: 32, transactieCenten: 2200 });
  fees.mislukt(a, 'eerste');
  const r = await fees.herkans(async () => { throw new Error('motor crasht'); });
  assert.equal(r.ok, true, 'de ronde loopt af');
  assert.equal(r.mislukt, 1);
  assert.match(a.laatsteFout, /motor crasht/, 'en de reden wordt bewaard');
});
