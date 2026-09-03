/* ============================================================================
   DE VERSHEIDSPOORT -- welk verouderd register houdt de ronde tegen?

   scripts/versheid.js MELDDE, met een goede reden erbij: een register dat
   achterloopt op een commit die alleen een typefout repareerde, is geen defect.
   Die reden klopt voor de meeste registers en niet voor allemaal. Voor de
   registers die zeggen of iemand BINNENKOMT waar hij niet hoort, of dat er met
   GELD iets misgaat, is "waarschijnlijk nog goed" precies de redenering waarmee
   een achterstand jaren blijft liggen -- en een melding die niemand tegenhoudt
   heeft die achterstand ook nooit tegengehouden (TAKEN.md 7.3).

   WAT DEZE TOETS BEWAAKT, en het derde punt is het belangrijkste:

     1. de vier poortklassen zijn er nog, en zijn niet stilletjes verhuisd naar
        `overig` toen ze een keer in de weg zaten;
     2. een verouderd register in zo'n klasse komt in `poort` terecht, en een
        verouderd register daarbuiten juist NIET -- anders is het geen indeling
        maar een sirene die iedereen uitzet;
     3. een ONTBREKEND register telt net zo hard als een verouderde. "Er is niets
        gemeten" is geen betere uitgangspositie dan "er is iets ouds gemeten";
        het is een slechtere, en dat is precies de vorm waarin een poort stil
        opengaat.

   De poort zelf (process.exit(1)) zit in het uitvoerbare deel van dat script en
   wordt hier als PROCES gedraaid -- een exitcode die je niet hebt zien vallen,
   bewijst niets.

   Draai los: node --test test/versheidspoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const versheid = require('../scripts/versheid.js');

test('de vier poortklassen staan er, en de rest meldt alleen', () => {
  const klasse = new Map(versheid.REGISTERS.map(r => [r[0], r[3] || 'overig']));
  const poort = [...klasse.entries()].filter(([, k]) => k !== 'overig').map(([n]) => n).sort();
  assert.deepEqual(poort, [
    'OUTPUTPROEF.json', 'POORTWACHT.json', 'ROLPROEF.json', 'UITVOERPROEF.json'
  ], 'de poortklassen zijn smal gehouden; wie er een bijzet of weghaalt, doet dat met een reden');
  assert.equal(klasse.get('POORTWACHT.json'), 'beveiliging');

  /* DE VIER ZIJN NIET TOEVALLIG VIER, en deze toets houdt dat vast: het zijn
     precies de registers die `npm run meetronde` verst maakt. Een poort die iets
     eist wat de stap ervoor niet levert, staat per constructie rood -- en wordt
     dan met `|| true` uitgezet, met de vier die wel werken erbij. */
  const ronde = require('../scripts/meetronde.js');
  const uitDeRonde = new Set((ronde.STAPPEN || []).map(s => s.register));
  for (const naam of poort) {
    assert.ok(uitDeRonde.has(naam),
      naam + ' zit in de poort maar wordt niet door de meetronde ververst; dan staat de poort ' +
      'per constructie rood en gaat hij eruit');
  }

  /* Vier die er MET REDEN niet bij zitten, en de redenen verschillen. De suite
     loopt achter zodra iemand een regel code wijzigt; de matrix is een afgeleide
     van de tien eronder; de beproeving en de sabotage worden in ANDERE jobs
     gemaakt dan de job die deze poort draait, en de ronde legt met opzet niets
     vast -- dus komen ze daar altijd uit de checkout. */
  assert.equal(klasse.get('SUITE.json'), 'overig');
  assert.equal(klasse.get('BEWIJSMATRIX.json'), 'overig');
  assert.equal(klasse.get('BEPROEVING.json'), 'overig');
  assert.equal(klasse.get('SABOTAGE.json'), 'overig');
});

test('meet() zet alleen de poortklassen in poort, en telt ontbreken als niet-vers', () => {
  const uit = versheid.meet();
  assert.ok(Array.isArray(uit.rijen) && uit.rijen.length >= 15, 'er worden echt registers gewogen');
  for (const r of uit.rijen) {
    assert.ok(['beveiliging', 'geld', 'overig'].includes(r.klasse), r.register + ' heeft geen klasse');
  }
  for (const r of uit.poort) {
    assert.notEqual(r.klasse, 'overig', r.register + ' hoort niet in de poort te zitten');
    assert.notEqual(r.staat, 'vers', r.register + ' is vers en hoort dan niet in de poort te zitten');
  }
  /* De andere kant op: elk niet-vers register uit een poortklasse MOET erin
     zitten. Zonder deze helft zou een lege poort ook "we hebben niet gekeken"
     kunnen betekenen. */
  const hoort = uit.rijen.filter(r => r.klasse !== 'overig' && r.staat !== 'vers').map(r => r.register).sort();
  assert.deepEqual(uit.poort.map(r => r.register).sort(), hoort);
});

/* De regel die je aan de echte registers NIET kunt zien zolang ze allemaal
   bestaan, en juist daarom apart: een ontbrekend register in een poortklasse
   houdt net zo hard tegen als een verouderde. Ik heb dit eerst geprobeerd te
   toetsen op de echte stand, en die mutatie ('ontbreekt' als vers lezen) bleef
   groen -- omdat er vandaag toevallig niets ontbreekt. Een toets die alleen
   groen blijft omdat het geval zich niet voordoet, bewaakt niets. */
test('een ontbrekend register in een poortklasse houdt net zo hard tegen', () => {
  const rijen = [
    { register: 'A.json', klasse: 'beveiliging', staat: 'vers' },
    { register: 'B.json', klasse: 'beveiliging', staat: 'verouderd' },
    { register: 'C.json', klasse: 'beveiliging', staat: 'ontbreekt' },
    { register: 'D.json', klasse: 'geld', staat: 'ontbreekt' },
    { register: 'E.json', klasse: 'overig', staat: 'ontbreekt' },
    { register: 'F.json', klasse: 'overig', staat: 'verouderd' }
  ];
  const poort = versheid.poortRijen(rijen).map(r => r.register).sort();
  assert.deepEqual(poort, ['B.json', 'C.json', 'D.json'],
    '"er is niets gemeten" is geen betere uitgangspositie dan "er is iets ouds gemeten"');
  assert.deepEqual(versheid.poortRijen([]), []);
  assert.deepEqual(versheid.poortRijen(null), []);
});

/* De poort als PROCES. Draait het echte script en kijkt naar de exitcode; dat is
   wat CI ziet. Welke kant hij op valt hangt af van de stand van de registers op
   dit moment -- dus wordt hier de KOPPELING getoetst en niet een vaste uitkomst:
   is er iets in de poort, dan hoort de code 1 te zijn, en anders 0. Een toets
   die een vaste kant eist, zakt zodra iemand een geldige ronde draait. */
test('de exitcode volgt de poort, en de melding noemt de registers', () => {
  let code = 0, uitvoer = '';
  try {
    uitvoer = execFileSync(process.execPath, [path.join(WORTEL, 'scripts', 'versheid.js')],
      { cwd: WORTEL, encoding: 'utf8' });
  } catch (e) { code = e.status; uitvoer = String(e.stdout || ''); }

  const uit = versheid.meet();
  if (uit.poort.length) {
    assert.equal(code, 1, 'met ' + uit.poort.length + ' register(s) in de poort hoort de ronde te zakken');
    assert.match(uitvoer, /DE VERSHEIDSPOORT ZAKT/, 'en te zeggen dat hij zakt');
    for (const r of uit.poort) {
      assert.ok(uitvoer.includes(r.register), r.register + ' hoort in de melding te staan');
      assert.ok(uitvoer.includes(r.hoe), 'met erbij wat je moet draaien om het te herstellen');
    }
  } else {
    assert.equal(code, 0, 'zonder verouderde beveiligings- of geldregisters gaat de poort open');
    assert.doesNotMatch(uitvoer, /DE VERSHEIDSPOORT ZAKT/);
  }
});

/* En de ketting eromheen: de ronde in CI mag deze poort niet met `|| true`
   afdekken. Dat stond er tot 3 september 2026 wel, met een reden die klopte
   toen het script alleen meldde -- en die reden verviel op het moment dat hij
   ging tegenhouden. Een poort achter een `|| true` is geen poort. */
test('ronde.yml dekt de versheidspoort en de zekerheid niet af', () => {
  const fs = require('fs');
  const yml = fs.readFileSync(path.join(WORTEL, '.github', 'workflows', 'ronde.yml'), 'utf8');
  /* Twee stappen, dezelfde regel. `npm run zekerheid` stond om dezelfde reden
     achter een `|| true`, terwijl de kop van scripts/zekerheid.js die regel juist
     op zichzelf toepast: "geen oordeel is geen groen", met exitcode 1 als een
     bron ontbreekt. Die `|| true` maakte precies die exitcode onzichtbaar. */
  for (const opdracht of ['npm run versheid', 'npm run zekerheid']) {
    const regel = yml.split('\n').find(r => r.includes('run: ' + opdracht));
    assert.ok(regel, 'de ronde draait ' + opdracht);
    assert.doesNotMatch(regel, /\|\|\s*true/,
      opdracht + ' mag niet met || true worden afgedekt; dan houdt hij niets tegen: ' + regel.trim());
  }
});
