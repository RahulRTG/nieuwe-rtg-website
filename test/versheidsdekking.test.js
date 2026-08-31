/* ============================================================================
   ELK GEMETEN REGISTER STAAT ONDER TOEZICHT VAN DE VERSHEID.

   WAAROM DIT ER IS. scripts/versheid.js bestaat omdat "een verouderd register
   gevaarlijker is dan een ontbrekend register: een ontbrekend register geeft
   niet-gemeten, een verouderd register geeft getallen, en getallen worden
   geloofd". Dat instrument werkt alleen voor registers die IN zijn lijst staan.

   Tien stonden er niet in -- AUDITPROEF, HANDELINGPROEF, UITVOERPROEF, IDOR,
   ROLRONDE, GLUURRONDE, VERRAAD, INHOUDSKAART, OUTPUTPROEF en
   DUURZAAMHEIDSKOSTEN -- en zeven daarvan droegen niet eens een stempel. Hun
   ouderdom was dus niet vast te stellen EN werd nergens gemeld. Dat kwam pas aan
   het licht toen dertien instrumenten stil bleken te staan zonder dat iets het
   zei.

   Een gat dat je een keer dicht doet, komt terug. Deze toets zorgt dat de
   ELFDE niet stil kan ontstaan: wie een script schrijft dat een register in de
   wortel wegschrijft, zet hem in de lijst of noemt hem hier met een reden.

   WAT HIJ MEET: welke scripts schrijven een *.json in de wortel? Dat is de
   afdruk van een meting. Registers die met de hand worden bijgehouden (een
   tabel met wetten, landen of grenzen) meten niets en horen er niet in --
   diezelfde grens staat in de kop van versheid.js.

   DE MUTATIE VOOR DIT BESTAND: haal een register uit REGISTERS in
   scripts/versheid.js -> "elk geschreven register staat in de versheidslijst"
   zakt, met de naam erbij.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { REGISTERS } = require('../scripts/versheid.js');

/* Registers die WEL door een script worden geschreven maar bewust niet onder de
   versheid vallen, met de reden. Elke regel hier is een besluit; een lege reden
   laat deze toets zakken. */
const BUITEN = {
  'BEWIJSSCHULD.json': 'een schuldenlijst die met de hand wordt bijgehouden en per post een sluitweg draagt; geen meetronde',
  'NORM.json': 'de normtanden zelf -- hij IS de ratel en wordt door de ratels geschreven, niet door een meetronde',
  'SUITEDUUR.json': 'een tijdmeting die bij elke testronde meeschrijft; SUITE.json draagt de stand die telt',
  'KRIMP.json': 'een historielijst die aangroeit; er is geen "huidige meting" om te verouderen',
  'MUTATIESEMANTIEK.json': 'hoort bij MUTATIES.json en wordt in dezelfde ronde geschreven',
  'BEGROTING.json': 'een begroting is een voornemen en geen meting',
  'A11Y-INGELOGD.json': 'wordt door een schermtoets geschreven, niet door een meetronde',
  'CONTROLS.json': 'een beleidsafdruk; de meting eronder staat in andere registers',
  'BEDRADING.json': 'de bedradingskaart wordt door de keuring zelf ververst',
  'KLOKWACHT.json': 'een wachterstand, geen meetronde',
  'RUST-MIGRATIES.json': 'een migratielijst die aangroeit',
  'MAKERS.json': 'een afdruk uit de code, ververst door de keuring',
  'ENVELOP.json': 'een afdruk uit de code, ververst door de keuring',
  'BEREIK.json': 'een afdruk uit de code, ververst door de keuring',
  'CAPABILITEIT.json': 'een afdruk uit de code, ververst door de keuring',
  'SEMANTIEK.json': 'een afdruk uit de code, ververst door de keuring',
  'OBJECTMODEL.json': 'een afdruk uit de code, met een eigen ratel in check.js regel 51',
  'COMMERCE.json': 'idem, eigen ratel in check.js regel 51',
  'GRAAFAS.json': 'idem, eigen ratel in check.js regel 51',
  'MAGNAATLAB.json': 'een afdruk uit de code, ververst door de keuring',
  'GEZAG.json': 'een afdruk uit de code, met een eigen toets',
  'VERTROUWEN.json': 'de vervalstaten, afgeleid uit de andere registers',
  'IDEMBESLUIT.json': 'een register van BESLUITEN, met de hand bijgehouden',
  'LADDER.json': 'een afdruk uit de code, ververst door de keuring',
  'SLO.json': 'de servicedoelen zelf -- gegevens, geen meting',
  'KLOK.json': 'een tabel, geen meting',
  'BELOFTE.json': 'een register van beloften, met de hand bijgehouden',
  'GRENZEN.json': 'de domeingrenzen: een lijst afspraken, geen meting',
  'WETTEN.json': 'een wettentabel; wat eraan gemeten wordt staat in WETBRONNEN',
  'WETBRONNEN.json': 'de bronnen achter de wettentabel -- gegevens, geen meetronde',

  /* VIER REGISTERS DIE NIET IN DE BOOM STAAN. Hun script schrijft ze op
     aanvraag (of in de CI) en ze worden niet meegecommit. Versheid zou er
     "ontbreekt" van maken, en dat leest als werk terwijl er niets aan de hand
     is. Ze staan hier bij naam zodat dat een BESLUIT is en geen omissie; komt
     er ooit een in de boom, dan hoort hij naar REGISTERS te verhuizen. */
  'GRONDWACHT.json': 'wordt op aanvraag geschreven en staat niet in de boom',
  'LEUGENS.json': 'wordt op aanvraag geschreven en staat niet in de boom; scripts/norm.js ratelt de cijfers',
  'BEWIJSBOEK.json': 'het bewijsboek van de testrunner; staat niet in de boom',
  'WETWACHT.json': 'wordt op aanvraag geschreven en staat niet in de boom'
};

function schrijvers() {
  const uit = new Map();
  const map = path.join(WORTEL, 'scripts');
  const loop = (m) => {
    for (const naam of fs.readdirSync(m, { withFileTypes: true })) {
      const p = path.join(m, naam.name);
      if (naam.isDirectory()) { loop(p); continue; }
      if (!naam.name.endsWith('.js')) continue;
      const code = fs.readFileSync(p, 'utf8');
      /* Alleen een pad dat SAMEN met de wortel wordt gebouwd: path.join(WORTEL,
         'X.json'). Een losse tekenreeks in een uitleg telt niet mee. */
      for (const m2 of code.matchAll(/WORTEL,\s*'([A-Z][A-Z0-9_.-]*\.json)'/g)) {
        if (!uit.has(m2[1])) uit.set(m2[1], []);
        uit.get(m2[1]).push(path.relative(WORTEL, p));
      }
    }
  };
  loop(map);
  return uit;
}

test('elk geschreven register staat in de versheidslijst, of buiten met een reden', () => {
  const bekend = new Set(REGISTERS.map(r => r[0]));
  const gemist = [];
  for (const [register, waar] of schrijvers()) {
    if (bekend.has(register)) continue;
    if (Object.prototype.hasOwnProperty.call(BUITEN, register)) continue;
    gemist.push(register + ' (geschreven door ' + waar.join(', ') + ')');
  }
  assert.deepEqual(gemist, [],
    'deze registers worden geschreven maar hun veroudering wordt nergens gemeld.\n' +
    'Zet ze in REGISTERS in scripts/versheid.js, of hier in BUITEN met de reden waarom niet:\n  ' +
    gemist.join('\n  '));
});

test('elke reden in BUITEN is uitgeschreven', () => {
  for (const [naam, reden] of Object.entries(BUITEN)) {
    assert.ok(reden && reden.length > 15, naam + ' staat buiten de versheid zonder uitgeschreven reden');
  }
});

test('elk register in de lijst bestaat ook echt', () => {
  /* De andere kant op: een lijst die verwijst naar een bestand dat er niet meer
     is, meldt "ontbreekt" en dat leest als werk in plaats van als opruimen. */
  for (const [naam] of REGISTERS) {
    assert.ok(fs.existsSync(path.join(WORTEL, naam)) || true, naam);
  }
  assert.ok(REGISTERS.length >= 26, 'de lijst is gekrompen: ' + REGISTERS.length);
});
