/* DE SUITE IN DELEN, EN DE VLOER DAAROVERHEEN.

   Sinds de CI de unit-suite en de schermtoetsen over vier runners verdeelt,
   hangen er twee nieuwe manieren aan waarop deze keten stil minder kan gaan
   toetsen dan hij belooft:

   1. EEN BESTAND DAT IN GEEN ENKEL DEEL VALT. Vier groene delen, en niemand die
      merkt dat toets 700 nergens meer draait. Daarom: de delen samen zijn de
      hele lijst, en ze overlappen nergens.
   2. EEN VLOER DIE PER DEEL REKENT. --test-coverage-lines rekent per proces; met
      vier delen haalt geen enkel deel de vloer, en wie hem dan verlaagt tot een
      kwart hem haalt, heeft een vloer die niets meer bewaakt.
      scripts/dekkingsvloer.js telt de delen eerst op. Hier staat dat hij dat
      echt doet -- en dat hij weigert te oordelen als er niets te tellen valt.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - `i % totaal === nr - 1` veranderd in `i % totaal === nr`
     -> "de delen samen zijn de hele lijst" ZAKT (RAAK)
   - in voegSamen() de DA-teller laten overschrijven in plaats van optellen
     -> "een regel die in het ene deel geraakt is, telt" ZAKT (RAAK)
   - de lege-invoer-controle uit dekkingsvloer.js gehaald
     -> "geen lcov is geen honderd procent" ZAKT (RAAK)

   Los: node --test test/delen.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ontleedDeel, verdeel, indeling, zetDuren } = require('../scripts/lib/delen');
const { IJKINGEN, KORT } = require('../scripts/lib/ijkingen');
const vloer = require('../scripts/dekkingsvloer');

test('--deel neemt alleen N/M met 1 <= N <= M', () => {
  assert.deepEqual(ontleedDeel('2/4'), { nr: 2, totaal: 4 });
  assert.equal(ontleedDeel('0/4'), null);
  assert.equal(ontleedDeel('5/4'), null);
  assert.equal(ontleedDeel('2'), null);
  assert.equal(ontleedDeel(''), null);
  assert.equal(ontleedDeel('2/4 '), null);
});

test('de delen samen zijn de hele lijst, en ze overlappen nergens', () => {
  for (const totaal of [2, 3, 4, 7]) {
    for (const lengte of [0, 1, 5, 139, 973]) {
      const lijst = Array.from({ length: lengte }, (_, i) => 'toets-' + i + '.test.js');
      const delen = [];
      for (let nr = 1; nr <= totaal; nr++) delen.push(verdeel(lijst, { nr, totaal }));
      const samen = delen.flat();
      assert.equal(samen.length, lengte, `${lengte} bestanden over ${totaal} delen: er raakt er een kwijt`);
      assert.equal(new Set(samen).size, lengte, 'geen enkel bestand hoort in twee delen');
      assert.deepEqual([...samen].sort(), [...lijst].sort());
      /* En evenwichtig: het grootste en het kleinste deel schelen hoogstens een. */
      const maten = delen.map(d => d.length);
      assert.ok(Math.max(...maten) - Math.min(...maten) <= 1, 'de delen lopen te ver uiteen: ' + maten.join('/'));
    }
  }
});

test('zonder --deel draait alles, en de lijst blijft ongemoeid', () => {
  const lijst = ['a', 'b', 'c'];
  assert.deepEqual(verdeel(lijst, null), lijst);
  assert.notEqual(verdeel(lijst, null), lijst, 'een kopie, zodat de aanroeper niet per ongeluk de bron sorteert');
});

/* Twee kleine lcov-bestanden die dezelfde bron uit twee delen beschrijven: in
   deel 1 is regel 10 geraakt en regel 11 niet, in deel 2 andersom. Samen is dat
   twee van de twee, en dat is precies wat er vroeger in een proces gebeurde. */
const DEEL_EEN = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:3,alfa', 'FNDA:0,beta', 'DA:10,3', 'DA:11,0',
  'BRDA:10,0,0,1', 'BRDA:10,0,1,-', 'end_of_record'].join('\n');
const DEEL_TWEE = ['TN:', 'SF:server/proef.js', 'FN:10,alfa', 'FN:20,beta',
  'FNDA:0,alfa', 'FNDA:5,beta', 'DA:10,0', 'DA:11,7',
  'BRDA:10,0,0,-', 'BRDA:10,0,1,2', 'end_of_record'].join('\n');

test('een regel die in het ene deel geraakt is, telt ook als het andere deel hem miste', () => {
  const kaart = vloer.voegSamen(new Map(), DEEL_EEN);
  vloer.voegSamen(kaart, DEEL_TWEE);
  const uit = vloer.tel(kaart);
  assert.equal(uit.bestanden, 1, 'hetzelfde bronbestand uit twee delen is een bestand');
  assert.deepEqual(uit.ruw.regels, [2, 2], 'beide regels geraakt, elk in een ander deel');
  assert.deepEqual(uit.ruw.functies, [2, 2], 'beide functies aangeroepen, elk in een ander deel');
  assert.deepEqual(uit.ruw.takken, [2, 2], 'beide takken genomen, elk in een ander deel');
  assert.equal(uit.regels, 100);
});

test('een deel alleen haalt de honderd niet -- dat is het hele punt', () => {
  const alleen = vloer.tel(vloer.voegSamen(new Map(), DEEL_EEN));
  assert.equal(alleen.regels, 50);
  assert.equal(alleen.functies, 50);
});

test('geen lcov is geen honderd procent maar een fout', () => {
  const leeg = fs.mkdtempSync(path.join(os.tmpdir(), 'vloer-leeg-'));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'dekkingsvloer.js'), leeg],
      { encoding: 'utf8' });
    assert.equal(r.status, 1, 'een lege map hoort te zakken, niet te slagen');
    assert.match(r.stderr, /Geen lcov-gegevens/);
  } finally {
    fs.rmSync(leeg, { recursive: true, force: true });
  }
});

test('de vloeren staan waar de meting ze zette', () => {
  assert.deepEqual(vloer.VLOER, { regels: 70, takken: 67, functies: 47 });
});

/* DE DERDE MANIER WAAROP DEZE KETEN STIL MINDER KAN TOETSEN, en de reden dat
   deze toets bestaat. De zes bronmuterende ijkingen worden sinds 27 augustus
   2026 UIT de delen gelaten (--zonder-ijkingen) en krijgen elk een eigen job in
   ci.yml. Dat zijn twee plekken die hetzelfde moeten zeggen. Loopt de matrix
   achter op de lijst, dan is de nieuwe ijking uit de delen gehaald zonder dat
   er een job voor is -- hij draait dan NERGENS, en alle jobs zijn groen.

   MUTATIE (LAT.md regel 2): een naam uit de matrix in ci.yml weggehaald
   -> "elke ijking heeft een eigen job in de keten" ZAKT (RAAK). */
test('elke ijking heeft een eigen job in de keten', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  const regel = /^\s*ijking:\s*\[([^\]]+)\]\s*$/m.exec(yml);
  assert.ok(regel, 'ci.yml heeft geen matrix `ijking: [...]`; dan draait geen enkele ijking meer');
  const inKeten = regel[1].split(',').map(x => x.trim()).filter(Boolean).sort();
  assert.deepEqual(inKeten, [...KORT].sort(),
    'de matrix in ci.yml en scripts/lib/ijkingen.js zeggen niet hetzelfde: ' +
    inKeten.join(', ') + '  vs  ' + KORT.join(', '));
  /* En de bestanden moeten ook echt bestaan -- een ijking die hernoemd is en in
     beide lijsten netjes meeverhuisde, maar niet op schijf staat, geeft een
     groene job over nul toetsen. */
  for (const naam of IJKINGEN) {
    assert.ok(fs.existsSync(path.join(__dirname, naam)), 'ijking ontbreekt op schijf: ' + naam);
  }
});

/* ---- DE GEWOGEN VERDELING (1 september 2026) ----

   De verdeling ging van "om en om over de gesorteerde lijst" naar "zwaarste
   eerst, naar het lichtste deel", op de gemeten duur uit TOETSDUUR.json. Dat
   maakt de verdeling afhankelijk van een REGISTER, en daarmee komen er twee
   nieuwe manieren bij waarop deze keten stil minder kan toetsen dan hij belooft:

   3. EEN BESTAND DAT NIET IN HET REGISTER STAAT. Elke nieuwe toets is dat, en
      als de weging hem overslaat draait hij nergens terwijl vier delen groen
      melden. Hij hoort om en om verdeeld te worden, nooit weggelaten.
   4. EEN ONTBREKEND OF KAPOT REGISTER. Dan is alles ongemeten, en dan hoort
      deze functie zich exact te gedragen zoals hij zich altijd heeft gedragen:
      trager, nooit stiller.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - de ongemeten-lus uit indeling() gehaald
     -> "een bestand zonder gewicht valt nooit buiten de boot" ZAKT (RAAK)
   - het lichtste deel gekozen met `>` in plaats van `<` (dus het zwaarste)
     -> "de zwaarste bestanden komen niet bij elkaar" ZAKT (RAAK) */

/* Een weging waarin een van de bestanden alles domineert: zonder weging komt
   hij samen met drie andere in deel 1 en is dat deel vier keer zo zwaar. */
const WEGING = {
  'zwaar.test.js': 100000,
  'middel-a.test.js': 20000, 'middel-b.test.js': 20000, 'middel-c.test.js': 20000,
  'licht-a.test.js': 1000, 'licht-b.test.js': 1000, 'licht-c.test.js': 1000, 'licht-d.test.js': 1000
};
const ALLE = Object.keys(WEGING).sort();

test('de zwaarste bestanden komen niet bij elkaar in een deel', () => {
  zetDuren(WEGING);
  try {
    const bakken = indeling(ALLE, 4);
    const last = bakken.map(b => b.reduce((s, n) => s + WEGING[n], 0));
    /* De som is 164.000, dus het ideaal is 41.000. Zonder weging zou het
       zwaarste deel 103.000 zijn (zwaar + drie lichte, op alfabet). */
    assert.equal(last.reduce((a, b) => a + b, 0), 164000);
    assert.ok(Math.max(...last) <= 100000 * 1.05,
      'het zwaarste deel draagt meer dan het zwaarste BESTAND: ' + last.join('/'));
    /* En het zwaarste bestand ligt alleen: er kan niets meer bij zonder het
       kritieke pad te verlengen. */
    const bakVanZwaar = bakken.find(b => b.includes('zwaar.test.js'));
    assert.deepEqual(bakVanZwaar, ['zwaar.test.js']);
  } finally { zetDuren(null); }
});

test('een bestand zonder gewicht valt nooit buiten de boot', () => {
  zetDuren(WEGING);
  try {
    /* Vier nieuwe toetsen die nog nooit hebben gedraaid, tussen de gemeten. */
    const nieuw = ['nieuw-1.test.js', 'nieuw-2.test.js', 'nieuw-3.test.js', 'nieuw-4.test.js'];
    const lijst = [...ALLE, ...nieuw].sort();
    const bakken = indeling(lijst, 4);
    const samen = bakken.flat();
    assert.equal(samen.length, lijst.length, 'er raakt er een kwijt');
    assert.equal(new Set(samen).size, lijst.length, 'geen enkel bestand in twee delen');
    for (const n of nieuw) {
      assert.equal(bakken.filter(b => b.includes(n)).length, 1, n + ' zit niet in precies een deel');
    }
    /* En ze liggen verspreid, niet allemaal op een hoop. */
    assert.equal(new Set(nieuw.map(n => bakken.findIndex(b => b.includes(n)))).size, 4,
      'vier ongemeten bestanden horen over vier delen, niet in een');
  } finally { zetDuren(null); }
});

test('zonder register gedraagt de verdeling zich als vroeger: om en om', () => {
  zetDuren({});
  try {
    const lijst = Array.from({ length: 9 }, (_, i) => 'toets-' + i + '.test.js');
    const bakken = indeling(lijst, 4);
    assert.deepEqual(bakken[0], ['toets-0.test.js', 'toets-4.test.js', 'toets-8.test.js']);
    assert.deepEqual(bakken[1], ['toets-1.test.js', 'toets-5.test.js']);
    assert.deepEqual(bakken.flat().length, 9);
  } finally { zetDuren(null); }
});

test('dezelfde invoer geeft altijd dezelfde verdeling, ook bij een gelijk gewicht', () => {
  zetDuren({ 'a.test.js': 500, 'b.test.js': 500, 'c.test.js': 500, 'd.test.js': 500 });
  try {
    const eerst = indeling(['a.test.js', 'b.test.js', 'c.test.js', 'd.test.js'], 2);
    const nogeens = indeling(['d.test.js', 'c.test.js', 'b.test.js', 'a.test.js'], 2);
    assert.deepEqual(eerst, nogeens,
      'de uitkomst hangt van de invoerVOLGORDE af; dan verdeelt de ene scherf anders dan de andere');
  } finally { zetDuren(null); }
});

/* scripts/a11y.js verdeelt SCHERMEN met dezelfde functie, en die staan per
   definitie niet in een toetsduurregister. Ze horen dus onveranderd om en om te
   worden verdeeld -- anders zou een weging voor de unit-suite stilletjes de
   a11y-ronde herschikken, en dat is precies het soort gevolg dat je pas ziet
   als een deel omvalt. */
test('een lijst die geen toetsbestanden bevat (a11y-schermen) blijft om en om', () => {
  const paginas = ['/apps/app.html', '/apps/bank.html', '/apps/cel.html',
    '/apps/dok.html', '/apps/eten.html'];
  const bakken = indeling(paginas, 2);
  assert.deepEqual(bakken[0], ['/apps/app.html', '/apps/cel.html', '/apps/eten.html']);
  assert.deepEqual(bakken[1], ['/apps/bank.html', '/apps/dok.html']);
});

/* DE ZWAARSTE SCHATTING VOOR EEN ONGEMETEN BESTAND (1 september 2026).

   Deze regel komt uit scripts/scherf.js, dat tot 28 augustus 2026 in ci.yml
   stond. Een nieuw toetsbestand heeft nog geen gewicht, en de gok die je dan
   maakt bepaalt de wandklok: nul of het gemiddelde laten de keten SNELLER
   lijken dan hij is, en dan staat er een scherf een half uur alleen na te
   hijgen. Het zwaarste bekende gewicht gokt de andere kant op -- onbekend telt
   als duur. Dat is de hoofdregel van KEURING.md in een regel code.

   MUTATIE (LAT.md regel 2): `gewicht.get(naam) || zwaarste` vervangen door
   `gewicht.get(naam) || 0`
   -> "een ongemeten bestand telt als het zwaarste" ZAKT (RAAK). */
test('een ongemeten bestand telt als het zwaarste, niet als nul', () => {
  zetDuren({ 'zwaar.test.js': 100000, 'licht.test.js': 1000 });
  try {
    /* Zou een ongemeten bestand als nul tellen, dan belandt hij bij het
       zwaarste bestand op dezelfde scherf en is die scherf twee keer zo lang
       bezig. Telt hij als het zwaarste, dan gaat hij juist apart. */
    const bakken = indeling(['zwaar.test.js', 'licht.test.js', 'nieuw.test.js'], 2);
    const metZwaar = bakken.find(b => b.includes('zwaar.test.js'));
    assert.ok(!metZwaar.includes('nieuw.test.js'),
      'een ongemeten bestand kruipt bij de zwaarste; dan is de gok naar beneden gedaan');
    assert.deepEqual(bakken.find(b => b.includes('nieuw.test.js')).sort(),
      ['licht.test.js', 'nieuw.test.js']);
  } finally { zetDuren(null); }
});
