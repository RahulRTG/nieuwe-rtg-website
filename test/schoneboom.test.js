/* ============================================================================
   EEN MEETRONDE DIE TOCH NIET MEETELT, HOORT NIET TE BEGINNEN.

   HET PROBLEEM. `stempel()` wordt aan het EIND van een ronde genomen. Staat er
   dan ongecommit werk in de boom, dan draagt het register `boomVuil: true` en
   telt de hele meting nergens mee: hij hoort bij een stand die nergens is
   vastgelegd. Dat is precies wat dat veld moet melden -- en het meldt het te
   laat, want de tien minuten zijn dan al op.

   Gemeten in EEN zitting: drie rondes verspild. Twee keer omdat er tijdens de
   ronde een script werd bewerkt, een keer omdat een ander instrument
   ondertussen een register wegschreef. Aan de uitvoer was tot het einde niets
   te zien.

   DE TWEEDE HELFT VAN DE FOUT, en die is bekend: de poort schrijven is niet
   hetzelfde als hem aanroepen. Bij de openbaar-tak stond de code er een meting
   lang in zonder ooit af te gaan (rolVan gaf het pad niet door). Daarom kijkt
   de tweede toets hieronder of elke proef de poort ook werkelijk AANROEPT, en
   niet alleen of hij hem heeft staan.

   DE ONTSNAPPING IS EEN UITGESCHREVEN BESLUIT. RTG_METEN_OP_VUILE_BOOM=1 zegt
   "ik weet dat deze uitslag niet telt" -- bijvoorbeeld bij het uitproberen van
   een nieuwe fixture, waar de vorige meting toch al wordt weggegooid. Een vlag
   met een naam die de gevolgen noemt, is iets anders dan een stille --force.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { eisSchoneBoom, vuileBoom, sluiting, versheid, CODEPADEN } = require('../scripts/lib/stempel');

const PROEVEN = ['idemproef-route', 'rolproef-route', 'handelingproef-route',
  'auditproef-route', 'uitvoerproef-route', 'invoerproef-route'];

test('de poort geeft een reden en de bestanden, niet alleen een nee', () => {
  const u = eisSchoneBoom('de proef');
  assert.equal(typeof u.ok, 'boolean');
  assert.ok(u.reden && u.reden.length > 20, 'een weigering zonder reden is niet na te lopen');
  if (!u.ok) {
    assert.ok(Array.isArray(u.bestanden) && u.bestanden.length,
      'zeg WELKE bestanden in de weg staan; anders moet iemand zelf gaan zoeken');
    assert.match(u.reden, /RTG_METEN_OP_VUILE_BOOM/,
      'een verhindering hoort te zeggen hoe het wel kan (GRAMMATICA.md)');
  }
});

test('elke proef die een register overschrijft, roept de poort ook AAN', () => {
  /* Hem hebben staan is niet hetzelfde als hem aanroepen: bij de openbaar-tak
     stond de code een hele meting lang in het bestand zonder ooit af te gaan. */
  for (const naam of PROEVEN) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', naam + '.js'), 'utf8');
    assert.match(bron, /eisSchoneBoom/, naam + ': kent de poort niet');
    const aanroepen = (bron.match(/^\s*wachtOpSchoneBoom\(\);/gm) || []).length;
    assert.ok(aanroepen >= 1,
      naam + ': de poort staat er wel maar wordt nergens aangeroepen -- dat is geen poort');
  }
});

test('de ontsnapping bestaat, en zegt met haar naam wat ze kost', () => {
  const oud = process.env.RTG_METEN_OP_VUILE_BOOM;
  process.env.RTG_METEN_OP_VUILE_BOOM = '1';
  try {
    const u = eisSchoneBoom('de proef');
    assert.equal(u.ok, true, 'met de vlag hoort de ronde te mogen starten');
    assert.match(u.reden, /telt niet als bewijs/,
      'de vlag hoort te zeggen wat je opgeeft, niet alleen dat het mag');
  } finally {
    if (oud === undefined) delete process.env.RTG_METEN_OP_VUILE_BOOM;
    else process.env.RTG_METEN_OP_VUILE_BOOM = oud;
  }
});

/* ============================================================================
   DE GRENS: WAT MAAKT EEN METING ONREPRODUCEERBAAR?

   Dit is de toets bij de fout die de volle meetronde onmogelijk maakte. De
   poort weigerde op ELK ongecommit bestand; de meetronde schrijft in stap 1
   POORTWACHT.json, en daarna weigerden stap 2 tot en met 7 op de uitvoer van
   hun eigen ronde. Zes van de negen registers zijn zo nooit in een volle ronde
   bijgewerkt, en aan de uitvoer was alleen "GESTRUIKELD" te zien.

   De grens ligt nu waar `versheid()` hem altijd al legde: alleen server/,
   scripts/ en public/. Twee mutaties gedaan, allebei beten ze:
     - het pad een teken laten verschuiven (de trim-fout die er echt in zat)
       -> een codebestand belandt bij "buiten de code", toets 10 zakt
     - CODEPADEN leegmaken -> toets 10 zakt
   ========================================================================== */
const WORTEL2 = path.join(__dirname, '..');
test('10. alleen ongecommitte CODE maakt een meting onreproduceerbaar', () => {
  const inCode = path.join(WORTEL2, 'scripts', '.meetgrens-proef.tmp');
  const erbuiten = path.join(WORTEL2, '.meetgrens-proef.json');
  fs.writeFileSync(inCode, 'proef\n');
  fs.writeFileSync(erbuiten, '{}\n');
  try {
    const v = vuileBoom();
    const noem = rij => rij.map(r => r.slice(3));
    assert.ok(noem(v.code).includes('scripts/.meetgrens-proef.tmp'),
      'een bestand onder scripts/ hoort bij de code; gezien: ' + JSON.stringify(v.code));
    assert.ok(noem(v.anders).includes('.meetgrens-proef.json'),
      'een register in de wortel is uitvoer en geen invoer; gezien: ' + JSON.stringify(v.anders));
    assert.ok(!noem(v.code).includes('.meetgrens-proef.json'),
      'een register mag de poort niet dichthouden -- dat is precies wat de meetronde brak');
  } finally {
    fs.unlinkSync(inCode); fs.unlinkSync(erbuiten);
  }
});

test('11. de grens staat op EEN plek', () => {
  assert.deepEqual(CODEPADEN, ['server', 'scripts', 'public'],
    'versheid() en de poort vooraf horen dezelfde drie mappen te bedoelen');
});

/* ============================================================================
   DE SLUITING: WELKE WIJZIGING RAAKT WELK REGISTER?

   De versheid rekende elke wijziging onder scripts/ aan elk register toe. Een
   reparatie aan de staatproef verklaarde daarmee ook de poortwacht en de
   sabotageronde verouderd; alle registers tegelijk vers was onbereikbaar, en
   een meter die nooit groen kan worden meet niets (LAT.md regel 9).

   Twee mutaties gedaan, allebei beten ze:
     - een berekende require ONGEZIEN overslaan -> toets 13 zakt (dan is een
       onbekende sluiting ineens een lege, en dat is de gevaarlijke kant op)
     - de filter op scripts/ weghalen in versheid() -> toets 14 zakt
   ========================================================================== */
test('12. de sluiting van een instrument bevat wat het inleest, en niet meer', () => {
  const s = sluiting('scripts/poortwacht.js');
  assert.ok(s, 'de sluiting van de poortwacht hoort te lukken');
  assert.ok(s.has('scripts/poortwacht.js'), 'het instrument zelf hoort erbij');
  assert.ok(s.has('scripts/lib/publiek.js'), 'de publieke lijst leest hij in');
  assert.ok(!s.has('scripts/sabotage.js'), 'een ander instrument hoort er niet bij');
});

test('13. een pad dat niet bestaat geeft ONBEKEND en geen lege sluiting', () => {
  assert.equal(sluiting('scripts/dit-bestaat-niet.js'), null,
    'onbekend als "raakt mij niets" lezen is precies de verkeerde kant op');
});

test('14. een wijziging buiten het instrument veroudert het register niet', () => {
  /* Er wordt hier niets verzonnen: de vergelijking loopt over de echte
     git-historie. Wel wordt het GEVAL gekozen -- een commit die alleen scripts
     raakt die het instrument NIET inleest. Zonder die keuze hing de toets aan
     wat er toevallig in de laatste commit stond, en toen beet de mutatie
     "haal de filter weg" niet. */
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'],
    { cwd: WORTEL2, encoding: 'utf8' }).stdout.trim();
  if (!head) return;   // een ondiepe kloon; dan valt er niets te vergelijken

  const instrumenten = ['scripts/poortwacht.js', 'scripts/sabotage.js',
    'scripts/bewijsschuld.js', 'scripts/staatproef-route.js'];
  const commits = spawnSync('git', ['log', '--format=%h', '-40', 'HEAD'],
    { cwd: WORTEL2, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

  /* Per commit zijn EIGEN wijziging (ouder..commit), en niet de opgetelde
     afstand tot HEAD. De eerste versie nam commit..HEAD, en dan is het geval er
     alleen zolang de nieuwste commits allemaal scripts-only zijn: een commit
     in public/ erbovenop maakte het geval onvindbaar en de toets rood, terwijl
     er aan versheid() niets veranderd was. Het register wordt daarom
     vergeleken alsof die commit HEAD is -- versheid() neemt de huidige commit
     als argument, dus dat vraagt geen verzonnen historie. */
  let bewijs = null;
  for (const c of commits) {
    const gewijzigd = spawnSync('git', ['diff', '--name-only', c + '^..' + c, '--',
      'server', 'scripts', 'public'], { cwd: WORTEL2, encoding: 'utf8' })
      .stdout.split('\n').filter(Boolean);
    if (!gewijzigd.length || gewijzigd.some(f => !f.startsWith('scripts/'))) continue;
    for (const i of instrumenten) {
      const sl = sluiting(i);
      if (sl && !gewijzigd.some(f => sl.has(f))) { bewijs = { c, i, gewijzigd }; break; }
    }
    if (bewijs) break;
  }
  /* Geen geval in veertig commits? Dan zegt deze toets niets, en dat hoort hij
     te ZEGGEN in plaats van groen te kleuren. */
  assert.ok(bewijs, 'geen commit gevonden die alleen scripts buiten een instrument raakt; ' +
    'deze toets meet dan niets -- verruim het venster of voeg een geval toe');

  const met = versheid({ op: 'x', commit: bewijs.c + '^', boomVuil: false, instrument: bewijs.i }, bewijs.c);
  assert.equal(met.vers, true, bewijs.i + ' leest geen van ' + bewijs.gewijzigd.join(', ') +
    ' in, en hoort dus vers te blijven -- gezien: ' + met.reden);

  /* En zonder `instrument` blijft de oude, strengste regel gelden: een bestaand
     register mag niet ineens vers heten omdat de regel is bijgesteld. */
  const zonder = versheid({ op: 'x', commit: bewijs.c + '^', boomVuil: false }, bewijs.c);
  assert.equal(zonder.vers, false, 'een stempel zonder instrument valt terug op de strengste regel');
});
