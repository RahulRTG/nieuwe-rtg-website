/* Tests voor de kruis-slice-scan (scripts/kruisscan.js). Deze scan bewaakt dat een
   opgeknipte module-map (X/index.js + zusjes) geen slice bevat die kaal naar een
   top-level naam van een zuster-slice verwijst -- een ReferenceError die pas op
   runtime knalt. Hier bewaken we de bewaker: (1) de echte server-boom is schoon,
   (2) een echte kruis-slice-fout wordt gevangen, (3) correct bedrade slices niet.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan } = require('../scripts/kruisscan');

function maakGroep(bestanden) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kruis-'));
  const grp = path.join(dir, 'grp');
  fs.mkdirSync(grp);
  for (const [naam, inhoud] of Object.entries(bestanden)) fs.writeFileSync(path.join(grp, naam), inhoud);
  return dir;
}

test('de echte server-boom bevat geen kruis-slice-verwijzingen', () => {
  const bevindingen = scan(path.join(__dirname, '..', 'server'));
  assert.deepEqual(bevindingen, [], 'onverwachte kruis-slice-verwijzing(en): ' +
    bevindingen.map(b => b.bestand + ' -> ' + b.naam + ' (uit ' + b.zuster + ')').join('; '));
});

test('een bestand dat tijdens de scan verdwijnt, laat de scan niet omvallen', () => {
  /* DE WEDLOOP DIE DIT VANGT. De suite kent toetsen die tijdelijk een
     proefbestand in server/kern zetten en het weer weghalen
     (test/keuring.test.js). Draait er zo een tegelijk met deze scan -- wat
     gebeurt zodra de suite ZONDER scripts/test-runner.js start, en dat doet
     `npm run test:gate` in CI -- dan staat de naam nog in readdirSync en is het
     bestand bij de statSync al weg. De scan viel dan om met ENOENT, en een
     geldige build werd rood op een dobbelsteen.

     Een verdwijnend bestand is in een toets niet te timen; een DANGLING
     SYMLINK geeft exact dezelfde fout op exact dezelfde regel -- statSync op
     een naam die readdirSync wel teruggaf. Zonder de reparatie zakt deze toets
     met "ENOENT ... stat"; dat is hier ook echt zien gebeuren.

     En de tegenproef staat erbij: de zusters ERNAAST worden nog steeds
     gelezen. Een scan die bij het eerste gat stilletjes stopt, zou ook groen
     zijn -- en niets meer bewaken. */
  const dir = maakGroep({
    'index.js': "module.exports = (ctx) => { require('./a')(ctx); require('./b')(ctx); };\n",
    'a.js': "const SALON_BIO = { tekst: 'x' };\nmodule.exports = (ctx) => { const { db } = ctx; return { a() { return SALON_BIO.tekst + db.x; } }; };\n",
    'b.js': "module.exports = (ctx) => { const { db } = ctx; return { b() { return SALON_BIO.tekst + db.y; } }; };\n"
  });
  try {
    fs.symlinkSync(path.join(dir, 'bestaat-niet-meer.js'), path.join(dir, 'grp', 'weg.js'));
    const b = scan(dir);
    assert.equal(b.length, 1, 'de scan hoort gewoon door te lopen over wat er WEL is');
    assert.equal(b[0].naam, 'SALON_BIO');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('een kale verwijzing naar een top-level naam van een zuster-slice wordt gevangen', () => {
  const dir = maakGroep({
    'index.js': "module.exports = (ctx) => { require('./a')(ctx); require('./b')(ctx); };\n",
    // slice a definieert een top-level helper
    'a.js': "const SALON_BIO = { tekst: 'x' };\nmodule.exports = (ctx) => { const { db } = ctx; return { a() { return SALON_BIO.tekst + db.x; } }; };\n",
    // slice b verwijst kaal naar SALON_BIO zonder hem te ontvangen -> fout
    'b.js': "module.exports = (ctx) => { const { db } = ctx; return { b() { return SALON_BIO.tekst + db.y; } }; };\n"
  });
  try {
    const b = scan(dir);
    assert.equal(b.length, 1, 'verwacht precies 1 bevinding');
    assert.equal(b[0].naam, 'SALON_BIO');
    assert.ok(b[0].bestand.endsWith('b.js'), 'de fout hoort in b.js te zitten');
    assert.ok(b[0].zuster.endsWith('a.js'), 'de herkomst hoort a.js te zijn');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('een methode in de KORTE vorm is een sleutel en geen verwijzing', () => {
  /* `{ save() {}, boek() {} }` lijkt op twee aanroepen en is het niet: het zijn
     property-namen. Zonder die uitzondering meldde de scan kern/appstore/
     naslag.js -- dat de brug echt opbouwt met lege functies erin -- als een kale
     verwijzing naar `save` en `boek` uit brug.js.

     Wat NIET verdwijnt, staat er hieronder direct naast: een echte kale
     verwijzing en een echte AANROEP van dezelfde naam worden nog steeds
     gevangen. Een uitzondering die ook die twee wegneemt, zou de scan
     uitschakelen in plaats van hem scherper maken. */
  const bouw = (b) => maakGroep({ 'index.js': 'module.exports = () => {};\n',
    'a.js': "const boek = 1;\nmodule.exports = () => boek;\n", 'b.js': b });

  const sleutel = bouw("module.exports = () => { const x = { boek() {} }; return x; };\n");
  try { assert.deepEqual(scan(sleutel), [], 'een methode-sleutel hoort geen melding te geven'); }
  finally { fs.rmSync(sleutel, { recursive: true, force: true }); }

  const kaal = bouw("module.exports = () => { return boek + 1; };\n");
  try { assert.deepEqual(scan(kaal).map(b => b.naam), ['boek'], 'een kale verwijzing hoort nog steeds te knallen'); }
  finally { fs.rmSync(kaal, { recursive: true, force: true }); }

  const aanroep = bouw("module.exports = () => { boek('x', 1); };\n");
  try { assert.deepEqual(scan(aanroep).map(b => b.naam), ['boek'], 'en een echte aanroep ook'); }
  finally { fs.rmSync(aanroep, { recursive: true, force: true }); }
});

test('de parameters van een methode met een GEQUOTE sleutel gelden als binding', () => {
  /* Een actietabel met streepjes in de sleutels (`'veiling-start'(potje, h, z)`)
     is de gewone vorm in kern/spellen, en de scan zag die parameters NIET als
     binding: `strip` verving de hele stringliteraal door spaties, inclusief de
     aanhalingstekens, waarna er `           (potje, h, z) {` overbleef -- van een
     gewone haakjesgroep niet te onderscheiden. Gevolg: `h` gold als een vrije
     naam, en zodra een zuster-slice toevallig ook een top-level `h` had (een
     hash-accumulator, in dit huis echt gebeurd) kwam er vals alarm.

     Deze toets legt precies dat vast, en hij is er nadat de reparatie de
     bestaande drie toetsen ONGEMOEID liet -- een reparatie die je niet hebt zien
     zakken is niet getoetst. */
  const dir = maakGroep({
    'index.js': "module.exports = (ctx) => { require('./a')(ctx); require('./b')(ctx); };\n",
    // slice a heeft een top-level `h` (zoals een hashfunctie die er een gebruikt)
    'a.js': "let h = 21;\nfunction hash(t) { h = t.length; return h; }\nmodule.exports = () => ({ hash });\n",
    // slice b gebruikt `h` UITSLUITEND als parameter van een gequote methode
    'b.js': "module.exports = () => ({ acties: { 'doe-iets'(potje, h, z) { return potje[h] + z; } } });\n"
  });
  try {
    assert.deepEqual(scan(dir), [],
      'een parameter van een gequote methode is een binding en geen kale verwijzing');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('strip laat de aanhalingstekens staan en de inhoud niet', () => {
  /* De reparatie hierboven van onderaf: de lengte blijft gelijk (de scans
     rekenen op kolommen), er komt geen letter uit een string mee, en de
     delimiters blijven staan zodat een gequote sleutel herkenbaar blijft. */
  const { strip } = require('../scripts/kruisscan');
  const uit = strip("const a = 'geheimeNaam';\n");
  assert.equal(uit.length, "const a = 'geheimeNaam';\n".length, 'de kolommen blijven kloppen');
  assert.ok(!/geheimeNaam/.test(uit), 'er komt geen tekst uit een string mee');
  assert.equal(uit, "const a = '           ';\n");
});

test('correct bedrade slices geven geen vals alarm', () => {
  const dir = maakGroep({
    'index.js': "module.exports = (ctx) => { require('./a')(ctx); require('./b')(ctx); };\n",
    'a.js': "const HELPER = require('../util');\nconst GEDEELD = 3;\nmodule.exports = (ctx) => { const { db } = ctx; return { a() { return HELPER(db) + GEDEELD; } }; };\n",
    // b requiret HELPER zelf, declareert een eigen local, en raakt GEDEELD niet -> schoon
    'b.js': "const HELPER = require('../util');\nmodule.exports = (ctx) => { const { db } = ctx; const eigen = 5; return { b() { return HELPER(db) + eigen; } }; };\n"
  });
  try {
    assert.deepEqual(scan(dir), [], 'correct bedrade slices mogen niets opleveren');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('een naam die via require binnenkomt in het gebruikende bestand is geen fout', () => {
  const dir = maakGroep({
    'index.js': "module.exports = {};\n",
    'a.js': "const GEDEELD = 7;\nmodule.exports = { GEDEELD };\n",
    // b haalt GEDEELD nette via require op -> in scope, geen melding
    'b.js': "const { GEDEELD } = require('./a');\nmodule.exports = () => GEDEELD + 1;\n"
  });
  try {
    assert.deepEqual(scan(dir), [], 'een gerequirede naam mag niet als kruis-slice gelden');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
