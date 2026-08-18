/* DE MEETLAAG WORDT ZELF GEMETEN.

   Draai los: node --experimental-sqlite --test test/meetkeuring.test.js

   WAAROM DIT BESTAAT. Dit huis meet zijn product uitputtend. Wat er niet was, is
   een meting op de INSTRUMENTEN, en juist daar zijn deze maand de duurste fouten
   gevonden -- niet in het product maar in wat erover rapporteert:

     de poortwacht printte 484 KB en riep process.exit aan; door een pipe kwam er
       146 KB uit. Geldige tekst, kapotte JSON, exitcode 0.
     een laadcontrole startte de rolproef en schreef ROLPROEF.json van 3377
       beproefde routes terug naar 292.
     de outputproef had een toerekeningsregel die nooit kon vuren: nul bewezen op
       4185 routes, en de suite bleef groen.
     21 van de 24 registers droegen geen tijdstempel.

   Vier fouten, vier keer dezelfde vorm: een meter die iets beweert wat hij niet
   heeft gemeten. Elk ervan stond achteraf in commentaar, en commentaar handhaaft
   niets.

   DE RATEL: het aantal overtredingen mag alleen krimpen. Acht bij het schrijven,
   nu een.

   EN TOEN MAAKTE DEZE KEURING ZIJN EIGEN FOUT. Hij keurde het REGISTER en trok
   daaruit een conclusie over het INSTRUMENT. Een instrument dat de regel nooit
   heeft geleerd en een instrument dat hem vanmorgen leerde maar sindsdien niet
   heeft gedraaid, zien er in het register identiek uit -- precies dezelfde
   verwisseling als bij het schermjournaal (test/schermronde.test.js): een
   opstelling die niet heeft gedraaid, gepresenteerd als een slechte uitslag.
   Sindsdien is er een derde uitslag, `oud register`, met een eigen teller.

   En hij kon drie van zijn twaalf instrumenten niet vinden: `--alleen=poortwacht`
   werd onvoorwaardelijk scripts/poortwacht-route.js, dat niet bestaat. Die twee
   regels telden daar als "niet van toepassing" -- een keurige uitslag voor een
   blinde vlek. Nu vindt hij ze, en meteen twee echte fouten: ketenronde.js
   startte een volle ronde bij het requiren, en de pipe-regel sloeg aan op een
   COMMENTAAR waarin poortwacht.js uitlegt waarom er juist geen process.exit staat.

   DE MUTATIES (LAT.md regel 2 en 10). Vier keer gebroken; dit is wat er
   WERKELIJK omviel, niet wat ik verwachtte:

     de wacht-regel weer alleen de negatieve schrijfwijze     -> 3 (en 4)
     een regel zijn `waarom` afnemen                          -> 2
     het commentaar niet meer strippen                        -> 4 en 6
     `oud register` weer als gewone overtreding tellen        -> 4
     instrumenten() weer blind voor scripts/<naam>.js         -> 4 en 5

   Dat toets 4 bij alles meevalt is geen ruis maar het ontwerp: de ratel telt de
   uitkomst, de andere toetsen zeggen WAAROM hij beweegt. En dat toets 5 zakt bij
   de blinde instrumentenlijst is de nuttigste van de vijf -- die vangt niet een
   verkeerde uitslag maar een keuring die drie instrumenten niet eens BEKEEK. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const keuring = require('../scripts/meetkeuring');

/* De stand op het moment van schrijven. MAG ALLEEN KRIMPEN.

   Alleen ECHTE overtredingen, dus niet de registers die achterlopen op een
   instrument dat de regel inmiddels wel draagt: die verdwijnen vanzelf bij de
   volgende ronde en zouden deze ratel laten meebewegen met wanneer er toevallig
   is gemeten. Wat hier telt, is code die de regel niet kent. */
const OPEN_MAX = 1;

test('1. elke regel komt uit een echte fout en is na te trekken', () => {
  assert.ok(keuring.REGELS.length >= 4, 'er zijn regels');
  for (const r of keuring.REGELS) {
    assert.ok(r.id && r.wat && typeof r.keur === 'function', r.id + ' is geen bruikbare regel');
  }
});

test('2. elke regel zegt WAAROM hij bestaat, met het geval erbij', () => {
  /* Een regel zonder herkomst wordt bij de eerste hindernis weggeklikt. Elke
     regel hier hoort te kunnen zeggen welke fout hem heeft veroorzaakt. */
  for (const r of keuring.REGELS) {
    assert.ok(r.waarom && r.waarom.length > 60,
      r.id + ' zegt niet waarom hij bestaat; dan is het een stijlvoorkeur');
  }
});

test('3. de keuring geeft geen vals alarm op een bestaande wacht', () => {
  /* Dit ging echt mis: de regel herkende alleen `require.main !== module` en
     meldde mutatie.js en sabotage.js als overtreding, terwijl die de wacht
     dragen als `if (require.main === module) { ... }`. Een keuring die onterecht
     aanslaat wordt binnen een week genegeerd, en handhaaft dan niets meer. */
  const uit = keuring.meet();
  const vals = uit.bevindingen.filter(b => b.regel === 'wacht' &&
    /mutatie|sabotage|bewijsmatrix|rolproef|staatproef|invoerproef|idemproef/.test(String(b.script)));
  assert.deepEqual(vals.map(b => b.script), [],
    'deze scripts dragen de wacht wel, in de vorm `if (require.main === module)`: ' +
    vals.map(b => b.script).join(', '));
});

test('4. het aantal overtredingen mag alleen krimpen', () => {
  const uit = keuring.meet();
  assert.ok(uit.telling.gezakt <= OPEN_MAX,
    'de meetlaag houdt zich op ' + uit.telling.gezakt + ' punten niet aan zijn eigen regels ' +
    '(was ' + OPEN_MAX + '). Repareer ze, of verlaag OPEN_MAX met de hand en zet in de ' +
    'commit waarom dat een bewuste keuze is. Open nu: ' +
    uit.bevindingen.map(b => b.register + '/' + b.regel).join(', '));
});

test('5. elk oordeel valt in precies een bak', () => {
  /* Niet-van-toepassing is geen goedkeuring. Een register dat nog niet bestaat
     mag niet als "in orde" tellen -- dat is precies de stilte waar deze hele
     laag tegen is gebouwd. */
  const uit = keuring.meet();
  assert.equal(uit.telling.ok + uit.telling.gezakt + uit.telling.oud + uit.telling.nvt,
    uit.telling.gekeurd, 'elk oordeel valt in precies een bak; er verdwijnt niets');
  /* NIET-VAN-TOEPASSING IS GEEN GOEDKEURING, en het hoort zeldzaam te zijn. Het
     stond op zes omdat de keuring drie van zijn instrumenten niet kon vinden --
     blindheid die zich voordeed als een nette uitslag. Boven de helft van de
     instrumenten is dat geen uitzondering meer maar een gat. */
  assert.ok(uit.telling.nvt <= uit.instrumenten,
    uit.telling.nvt + ' van de ' + uit.telling.gekeurd + ' keuringen is "niet van toepassing"; ' +
    'controleer of instrumenten() zijn scripts nog wel vindt');
});

test('6. de bronregels lezen CODE en geen commentaar', () => {
  /* scripts/poortwacht.js legt in een commentaarblok uit waarom er GEEN
     process.exit() vlak na de grote uitvoer staat, en werd daar precies op
     aangewezen. Een keuring die je leert dat zijn meldingen soms onzin zijn,
     handhaaft binnen een week niets meer. */
  const uit = keuring.meet();
  const vals = uit.bevindingen.filter(b => b.regel === 'pipe' && /poortwacht/.test(String(b.script)));
  assert.deepEqual(vals.map(b => b.reden), [],
    'poortwacht.js gebruikt process.exitCode; wat hier wordt gevonden staat in commentaar');
});

test('7. een oud register is geen overtreding van de code', () => {
  /* HET ONDERSCHEID DAT DEZE KEURING ZELF MISTE. Een register zonder stempel
     terwijl het instrument er wel een schrijft, vraagt om een RONDE. Een
     register zonder stempel terwijl het instrument er geen schrijft, vraagt om
     CODE. Dezelfde melding, twee reparaties -- en zolang ze in een bak zaten,
     stuurde deze keuring mensen naar de verkeerde. */
  const uit = keuring.meet();
  for (const b of uit.bevindingen) {
    assert.ok(b.soort === 'de code' || b.soort === 'oud register',
      b.register + '/' + b.regel + ' heeft geen soort');
    if (b.soort === 'oud register') {
      assert.ok(b.hoe, 'een oud register hoort te zeggen HOE je het ververst');
      assert.match(b.reden, /schrijft het inmiddels wel/);
    }
  }
  assert.ok(uit.telling.oud >= 0 && uit.telling.gezakt >= 0);
});
