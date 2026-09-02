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

/* ============================================================================
   EN DE WERELDEN, want een bak op nul zegt niets als de opstelling waarop
   gemeten is halverwege is ingestort.

   Dit is de tweede helft van dezelfde belofte. De bakken hierboven bewaken de
   UITSLAG; deze twee bewaken de OPSTELLING waarop die uitslag rust. Ze staan
   allebei op nul en horen daar te blijven:

     gesneuveld = 0   geen wereld die aan het eind niet meer overeind staat
     omslagen   = 0   en ook niet TUSSENDOOR omgevallen en weer opgekrabbeld

   Die tweede is er omdat de eerste hem niet ziet: een route die op plek 800
   iets sloopt en op plek 2000 een andere die het herstelt, laat aan het eind
   niets zien terwijl er 1200 routes op een kapotte wereld zijn gemeten. Zo is
   /api/privacy/delete ontdekt -- die wiste het lid waarmee de proef zelf meet,
   en 1491 ledenroutes daarna maten een leeg account zonder dat er iets
   klaagde.

   `niet gecontroleerd` telt hier met opzet NIET als fout: niet gekeken is geen
   uitslag (LAT.md regel 3). Maar het mag ook niet alles zijn -- dan zou de
   poort dichtgaan door weg te kijken. */
const proef = require('../IDEMPROEF.json');

test('elke wereld staat na afloop nog overeind', () => {
  const w = (proef.gemeten || {}).werelden;
  assert.ok(Array.isArray(w) && w.length,
    'de meting hoort per wereld te melden of hij er na afloop nog staat');
  const stuk = w.filter(x => x.gecontroleerd && x.ok === false);
  assert.equal(stuk.length, 0,
    'gesneuveld: ' + stuk.map(x => x.wereld + ' (' + x.waarom + ')').join('; '));
  assert.ok(w.some(x => x.gecontroleerd),
    'geen enkele wereld is gecontroleerd; dan zegt deze poort niets');
});

test('geen wereld sloeg tussendoor om', () => {
  const v = (proef.gemeten || {}).wereldwacht;
  assert.ok(v && Number.isInteger(v.peilingen),
    'de meting hoort een verslag van de wereldwacht te dragen');
  assert.ok(v.peilingen > 0, 'er is onderweg geen enkele keer gepeild');
  assert.equal((v.gebeurtenissen || []).length, 0,
    'omslagen onderweg: ' + (v.gebeurtenissen || [])
      .map(g => g.wereld + ' ' + g.van + '->' + g.naar + ' tussen ' + g.vanafRoute + ' en ' + g.totRoute)
      .join('; '));
});

/* ============================================================================
   EN DE REM DIE NIET MAG SPRINGEN.

   /api/supplier/roster laat dertig opvragingen per kwartier per IP toe, en dat
   is een echte poort met een reden: zonder hem is het personeelsbestand van
   elke partner in een paar minuten uit te lezen. De proef zat op 29 van de 30
   omdat er TWEE implementaties van rooster+login stonden; dat is opgelost door
   ze samen te voegen (scripts/lib/zaakinlog.js).

   Deze poort kijkt naar wat er GEMETEN is opgevraagd en niet naar hoe lang de
   lijst in genrezaken.js is. Een tweede plek die alsnog zelf gaat aankloppen,
   valt daarmee op -- de lijst zou dan namelijk nog steeds kloppen. */
test('de proef blijft onder de roster-rem, gemeten', () => {
  const n = (proef.gemeten || {}).roosteropvragingen;
  const rem = (proef.gemeten || {}).roosterRem;
  assert.ok(Number.isInteger(n), 'de meting hoort te melden hoeveel roosteropvragingen zij deed');
  assert.ok(Number.isInteger(rem) && rem > 0, 'en tegen welke rem');
  assert.ok(n <= rem, n + ' roosteropvragingen tegen een rem van ' + rem +
    '; de staart van de genrelijst meet dan niets');
  /* En hij hoort ook niet op nul te staan: dan is er geen enkele zaak
     ingelogd en zegt deze poort niets. */
  assert.ok(n > 0, 'er is geen enkele roosteropvraging gedaan; dan staat er geen genrewereld');
});
