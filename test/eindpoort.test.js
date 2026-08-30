/* ============================================================================
   WAT AF IS, BLIJFT AF -- de eindpoort op de bakken die op nul staan.

   De eigenaar wil uiteindelijk een build die alleen groen wordt als ELKE bak
   van scripts/onbewezen.js op nul staat. Zover is het niet: de fixture-bakken
   zijn nog vol. Maar vijf bakken staan er wel, en die kunnen vanaf nu niet meer
   ongemerkt teruglopen.

   WAAROM DIT NU AL MOET. Een nul die niet bewaakt wordt, groeit terug zodra
   iemand een route toevoegt of een sleutel weghaalt. Dat is deze sessie al twee
   keer bijna gebeurd: de gezinsfamilie liep stuk op twee veldnamen (en de
   trechter meldde toch 250 in plaats van 505), en tien routes belandden op een
   uitzonderingslijst waar ze niet horen. Beide keren ving een toets of de
   keuring het -- niet een mens die het toevallig zag.

   WAT ER MET OPZET NIET IN STAAT: de fixture-bakken. Die zijn nog vol, en een
   poort die eist wat nog niet waar is, wordt weggeklikt in plaats van gelezen.
   Ze komen erbij zodra ze leeg zijn, en dat is dan een REGEL erbij en niet een
   drempel die iemand omlaag schuift.

   ECHT_DEFECT staat er wel bij, en dat verdient uitleg: hij stond deze ronde
   op 1, en die ene was VALS -- het opslag-meetpunt schreef asynchroon werk van
   andere routes toe aan /api/bank/pas/bevries. Geisoleerd nagemeten is die
   route gewoon idempotent. De reparatie zit in scripts/lib/idemproef.js (een
   herhaling moet dezelfde collectie raken), en de nul die daaruit volgt hoort
   bewaakt te worden -- juist omdat hij eerder ten onrechte niet nul was.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meet } = require('../scripts/onbewezen');

const u = meet();

/* De bakken die op nul STAAN en daar moeten blijven. Elke regel noemt waarom
   die nul betekenisvol is -- een nul zonder betekenis is een drempel. */
const MOET_NUL = [
  ['STALE_BEWIJS', 'de meting hoort bij deze code; anders is elke andere bak onbetrouwbaar'],
  ['GEEN_PROEFSLEUTEL', 'elke deur heeft een sleutel of een uitgeschreven reden waarom niet'],
  ['STAAT_NIET_ZICHTBAAR', 'het waarnemingsvlak ziet wat er beweegt'],
  ['BIJWERKING_ALLEEN', 'geen route waarvan alleen een journaal groeit zonder besluit daarover'],
  ['SEMANTIEK_NODIG', 'geen route waar een mens de bron nog moet lezen'],
  ['ECHT_DEFECT', 'geen route waarvan bewezen is dat een herhaling het werk overdoet']
];

test('de bakken die af zijn, staan nog steeds op nul', () => {
  if (!u.metingGebruikt) {
    assert.ok(u.metingReden && u.metingReden.length > 20,
      'een gesloten poort hoort te zeggen waarom; groen zonder meting is niet te lezen');
    return;
  }
  const gezakt = [];
  for (const [id, waarom] of MOET_NUL) {
    const b = u.bakken.find(x => x.id === id);
    assert.ok(b, 'de bak ' + id + ' hoort te bestaan');
    if (b.aantal !== 0) gezakt.push(id + ' = ' + b.aantal + ' (' + waarom + '): ' + b.voorbeelden.join(', '));
  }
  assert.deepEqual(gezakt, [], 'deze bakken stonden op nul en staan dat niet meer:\n  ' + gezakt.join('\n  '));
});

test('de eindpoort noemt alleen bakken die werkelijk bestaan', () => {
  /* Een poort die een bak bewaakt die niet meer bestaat, staat groen zonder
     iets te meten -- dezelfde fout als een openbaar-lijst met dode paden. */
  for (const [id] of MOET_NUL) {
    assert.ok(u.bakken.some(b => b.id === id),
      id + ' staat in de eindpoort maar niet in scripts/onbewezen.js');
  }
});
