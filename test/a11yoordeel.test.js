/* HET A11Y-OORDEEL OVER OPGEDEELDE METINGEN.

   De a11y-scan is opgedeeld over vier runners, en dat mocht alleen omdat zijn
   oordeel is losgemaakt van zijn meting (scripts/lib/a11yoordeel.js). Deze toets
   bewaakt de reden waarom dat nodig was, en hij doet dat zonder browser: het
   oordeel is een pure functie over tellingen.

   WAT ER FOUT KON GAAN, en dat is geen theorie maar de hele aanleiding: het
   budget in A11Y-INGELOGD.json geldt over de HELE ronde. Vier delen die elk hun
   eigen kwart tegen dat budget leggen, laten met z'n vieren vier keer zoveel
   door en melden alle vier groen. Daarom telt telOp() eerst op en velt veld()
   daarna een keer.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - telOp() de contrastfouten laten NEMEN (max) in plaats van optellen
     -> "vier delen met elk een fout zijn samen vier fouten" ZAKT (RAAK)
   - in a11y-oordeel.js de schermtelling-controle uitgezet
     -> "een deel dat niets aflevert is geen groene ronde" ZAKT (RAAK)
   - veld() de zaakronde bij ingelogd laten optellen
     -> "elke ronde heeft zijn eigen grens" ZAKT (RAAK)

   Los: node --test test/a11yoordeel.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const oordeel = require('../scripts/lib/a11yoordeel');

/* Het echte register, want de grens die hier telt is de grens die de CI gebruikt. */
const GRENS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'A11Y-INGELOGD.json'), 'utf8'));

const deel = (n, { struct = 0, uit = 0, in_ = 0, zaak = 0, raak = 0, paginas = 67 } = {}) => ({
  deel: n + '/4', paginas, totaal: struct, raakTotaal: raak,
  perRonde: [
    { naam: 'uitgelogd', struct: 0, contr: uit },
    { naam: 'ingelogd', struct: 0, contr: in_ },
    { naam: 'zaak', struct: 0, contr: zaak }
  ]
});

test('vier schone delen zijn samen een schone ronde', () => {
  const samen = oordeel.telOp([deel(1), deel(2), deel(3), deel(4)]);
  assert.equal(samen.paginas, 268);
  const uit = oordeel.veld(samen, GRENS);
  assert.deepEqual(uit.fouten, []);
});

/* DIT IS DE TOETS WAAR HET OM BEGONNEN IS. Vier delen met elk EEN contrastfout
   ingelogd: per deel is dat een tegen een budget van nul -- ook al fout, maar
   stel dat het budget ooit weer op 3 staat, dan komt elk deel er los doorheen en
   de ronde niet. Opgeteld zijn het er vier, en dat hoort het cijfer te zijn. */
test('vier delen met elk een fout zijn samen vier fouten, niet een', () => {
  const samen = oordeel.telOp([1, 2, 3, 4].map(n => deel(n, { in_: 1 })));
  const ingelogd = samen.perRonde.find(r => r.naam === 'ingelogd');
  assert.equal(ingelogd.contr, 4, 'de delen worden opgeteld en niet vergeleken');
  const ruim = JSON.parse(JSON.stringify(GRENS));
  ruim.ingelogd.contrast = 3;          // een budget waar EEN deel wel onder blijft
  const perDeel = oordeel.veld(oordeel.telOp([deel(1, { in_: 1 })]), ruim);
  assert.deepEqual(perDeel.fouten, [], 'een deel alleen komt onder dat budget door');
  const heleRonde = oordeel.veld(samen, ruim);
  assert.equal(heleRonde.fouten.length, 1, 'de hele ronde komt er niet doorheen -- en dat is het punt');
  assert.match(heleRonde.fouten[0], /4 contrastfouten ingelogd/);
});

test('elke ronde heeft zijn eigen grens', () => {
  /* Een fout in de zaakronde mag niet wegvallen tegen ruimte bij ingelogd, en
     andersom. Met alle grenzen op nul betekent dat: allebei apart gemeld. */
  const samen = oordeel.telOp([deel(1, { zaak: 2 }), deel(2, { in_: 1 }), deel(3), deel(4)]);
  const uit = oordeel.veld(samen, GRENS);
  assert.equal(uit.fouten.length, 2);
  assert.ok(uit.fouten.some(f => /contrastfouten ingelogd/.test(f)));
  assert.ok(uit.fouten.some(f => /in de zaakronde/.test(f)));
});

test('structuur en raakvlak tellen ook over de delen heen', () => {
  const struct = oordeel.veld(oordeel.telOp([deel(1, { struct: 1 }), deel(2), deel(3), deel(4)]), GRENS);
  assert.match(struct.fouten.join(' '), /1 structurele overtreding/);
  const raak = oordeel.veld(oordeel.telOp([deel(1), deel(2, { raak: 3 }), deel(3), deel(4)]), GRENS);
  assert.match(raak.fouten.join(' '), /3 raakvlak\(ken\)/);
});

/* En de andere kant: het oordeel over EEN hele ronde (zoals `npm run a11y`
   lokaal draait) moet exact hetzelfde zeggen als over vier delen die samen
   dezelfde tellingen dragen. Anders meten de twee wegen iets anders. */
test('vier delen zeggen hetzelfde als een hele ronde met dezelfde tellingen', () => {
  const samen = oordeel.veld(oordeel.telOp([deel(1, { in_: 2 }), deel(2, { zaak: 1 }), deel(3), deel(4)]), GRENS);
  const heel = oordeel.veld({
    paginas: 268, totaal: 0, raakTotaal: 0,
    perRonde: [{ naam: 'uitgelogd', struct: 0, contr: 0 },
      { naam: 'ingelogd', struct: 0, contr: 2 }, { naam: 'zaak', struct: 0, contr: 1 }]
  }, GRENS);
  assert.deepEqual(samen.fouten, heel.fouten);
  assert.equal(samen.samenvatting, heel.samenvatting);
});

/* De poort van scripts/a11y-oordeel.js zelf: hij weigert te oordelen over een
   ronde met een gat. Drie delen die samen 201 schermen zagen terwijl er 268
   zijn, is geen groene ronde maar een kapotte opstelling. */
test('een deel dat niets aflevert is geen groene ronde', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'a11ydeel-'));
  try {
    for (const n of [1, 2, 3]) fs.writeFileSync(path.join(map, 'deel-' + n + '.json'), JSON.stringify(deel(n)));
    const drie = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'a11y-oordeel.js'), map],
      { encoding: 'utf8' });
    assert.equal(drie.status, 1, 'drie van de vier delen hoort te zakken');
    assert.match(drie.stderr, /zagen 201 schermen/);

    const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'a11yleeg-'));
    const geen = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'a11y-oordeel.js'), leeg],
      { encoding: 'utf8' });
    assert.equal(geen.status, 1, 'nul metingen hoort te zakken');
    assert.match(geen.stderr, /geen metingen gevonden/);
    fs.rmSync(leeg, { recursive: true, force: true });
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});

/* En het aantal delen zelf, want een ronde waarin deel 4 nooit startte laat de
   schermtelling ook kloppen zodra iemand de delen anders verdeelt. */
test('minder metingen dan beloofde delen zakt', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'a11yaantal-'));
  try {
    for (const n of [1, 2, 3, 4]) fs.writeFileSync(path.join(map, 'deel-' + n + '.json'), JSON.stringify(deel(n)));
    fs.unlinkSync(path.join(map, 'deel-4.json'));
    const r = spawnSync(process.execPath,
      [path.join(__dirname, '..', 'scripts', 'a11y-oordeel.js'), map, '--delen=4'], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /3 meting\(en\) gevonden terwijl er 4 delen beloofd zijn/);
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});
