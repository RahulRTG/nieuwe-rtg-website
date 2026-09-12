/* De verticale geldproef -- de PURE helft ervan.

   De ronde zelf start drie servers en injecteert een crash; dat is een
   instrument en geen unittoets (`npm run factuurproef`). Wat hier wél thuishoort
   is de regel die bepaalt WAT als een economische mutatie telt, want daar hangt
   de hele uitslag aan: haalt `bakverschil` een bewegende geldbak niet op, dan
   meldt de proef stilletjes "nul waarde verplaatst" over een dubbele boeking.

   Elke toets hieronder is een MUTATIE op die regel: hij voedt de functie iets
   wat kapot is en eist dat ze het ziet. Een toets die je niet hebt zien zakken
   is geen toets (LAT.md regel 2). */
const test = require('node:test');
const assert = require('node:assert');
const fp = require('../scripts/factuurproef.js');

test('een verklaard herstelbewijs vervangt geen uitgevoerde compensatieproef', () => {
  const besluit = require('../HERSTELBESLUIT.json');
  const route = besluit.routes['POST /api/pay/saldo'];
  const bewaard = route.bewijs;
  try {
    route.bewijs = { stand: 'uitgevoerd' };
    const uit = { stappen: [] };
    fp.terugweg(uit);
    assert.equal(uit.stappen[0].stand, 'BLOCKED');
  } finally { route.bewijs = bewaard; }
});

const beeld = (zout, bakken) => ({ zoutId: zout, collecties: bakken });
const bak = (n, h) => ({ n, h });

test('een geldbak die in aantal groeit, komt eruit als geldbeweging', () => {
  const v = fp.bakverschil(
    beeld('a1', { payBoekingen: bak(2, 'hh') }),
    beeld('a1', { payBoekingen: bak(3, 'ii') }));
  assert.equal(v.geld.length, 1);
  assert.equal(v.geld[0].collectie, 'payBoekingen');
  assert.equal(v.geld[0].nVoor, 2);
  assert.equal(v.geld[0].nNa, 3);
});

/* DE GEMEENSTE VORM, en de reden dat de hash meedoet: een rij die WIJZIGT
   zonder dat het aantal verandert. Een factuur die van open naar betaald gaat,
   een saldo dat wordt overschreven -- dat is geld dat beweegt bij een gelijk
   aantal rijen. Zou deze functie alleen tellen, dan meldde ze hier niets. */
test('een geldbak die alleen van inhoud verandert, telt óók als geldbeweging', () => {
  const v = fp.bakverschil(
    beeld('a1', { paySaldi: bak(3, 'oud') }),
    beeld('a1', { paySaldi: bak(3, 'nieuw') }));
  assert.equal(v.geld.length, 1, 'een gelijk aantal met een andere hash is een wijziging');
  assert.equal(v.geld[0].hashGewijzigd, true);
});

/* NA EEN HERSTART IS HET ZOUT ANDERS EN ZIJN DE HASHES ONVERGELIJKBAAR. Zou de
   functie ze dan toch vergelijken, dan meldde ze ELKE geldbak als bewogen en
   zakte de crashfase altijd -- een proef die altijd rood is, wordt uitgezet.
   Hij valt dus terug op de AANTALLEN en zegt erbij dat hij dat doet. */
test('over een herstart heen vergelijkt hij aantallen en geen hashes', () => {
  const v = fp.bakverschil(
    beeld('voor-crash', { paySaldi: bak(3, 'oud') }),
    beeld('na-crash', { paySaldi: bak(3, 'anders-gezouten') }));
  assert.equal(v.hashVergelijkbaar, false);
  assert.equal(v.geld.length, 0, 'een ander zout is geen wijziging');

  const w = fp.bakverschil(
    beeld('voor-crash', { payBoekingen: bak(1, 'x') }),
    beeld('na-crash', { payBoekingen: bak(2, 'y') }));
  assert.equal(w.geld.length, 1, 'een groeiend aantal blijft wél zichtbaar na een herstart');
});

/* HET SPOOR MAG BEWEGEN EN WORDT NIET WEGGEFILTERD. Een geweigerde tweede
   poging schrijft een auditregel; dat hoort zo. Maar hij komt apart terug,
   want "we negeren de rest" is precies hoe een echte dubbele mutatie
   ongezien blijft. */
test('spoorbakken komen apart terug en tellen niet als geldbeweging', () => {
  const v = fp.bakverschil(
    beeld('a1', { apiSpoor: bak(4, 'p'), payBoekingen: bak(2, 'q') }),
    beeld('a1', { apiSpoor: bak(5, 'r'), payBoekingen: bak(2, 'q') }));
  assert.equal(v.geld.length, 0);
  assert.equal(v.spoor.length, 1);
  assert.equal(v.spoor[0].collectie, 'apiSpoor');
  assert.equal(v.overig.length, 0);
});

/* EEN BAK DIE IN GEEN VAN BEIDE LIJSTEN STAAT, VERDWIJNT NIET. Ongesorteerde
   beweging is een bevinding: er gebeurt iets op dit geldpad waarvan niemand
   heeft opgeschreven of het erbij hoort. */
test('een onbekende bak komt terug als `overig` en wordt niet weggelaten', () => {
  const v = fp.bakverschil(
    beeld('a1', { ietsNieuws: bak(0, 'z') }),
    beeld('a1', { ietsNieuws: bak(1, 'z2') }));
  assert.equal(v.overig.length, 1);
  assert.equal(v.overig[0].collectie, 'ietsNieuws');
});

/* DE GELDBAKKEN ZIJN DE VIJF VAN DIT PAD. Groeit die lijst ongemerkt naar alle
   tachtig uit effectcollecties.js, dan wordt de assertie slapper zonder dat
   iemand het merkt; krimpt hij, dan mist hij een dubbele mutatie. */
test('de vijf geldbakken van dit pad staan vast', () => {
  assert.deepEqual(fp.GELDBAKKEN.slice().sort(),
    ['fondsAfdrachten', 'invoices', 'payBoekingen', 'paySaldi', 'socialeAfdrachten']);
});

/* De uitslagwoorden zijn de vijf van het huis, en `PROVEN` draagt altijd een
   grond. Een stap zonder stand bestaat niet. */
test('een uitslag draagt een van de vijf standen en zijn meting', () => {
  const u = fp.uitslag(fp.stap(1, 'iets'), 'BLOCKED', 'geen wereld', { a: 1 });
  assert.equal(u.stand, 'BLOCKED');
  assert.equal(u.reden, 'geen wereld');
  assert.deepEqual(u.gemeten, { a: 1 });
});
