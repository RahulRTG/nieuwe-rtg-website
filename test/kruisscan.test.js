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
