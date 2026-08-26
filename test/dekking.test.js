/* ============================================================================
   DE DEKKINGSMETER LEEST ALLE JOURNALEN, NIET EEN (scripts/dekking.js).

   WAAROM DEZE TOETS ER IS. `npm test` en `npm run e2e` schrijven elk hun eigen
   routejournaal. Las de meter er maar een, dan stond een endpoint dat alleen
   vanuit de BROWSER wordt aangeroepen als "nooit aangeraakt" terwijl er een
   schermtoets voor is -- /api/fout/client is dat geval, en het stond als
   voetnoot in TAKEN.md 6.8 (b) in plaats van in de uitvoer van de meter zelf.

   TWEE BEWERINGEN, en de tweede is de belangrijkste:
     1  `--lees` mag herhaald worden en de meter telt de UNIE;
     2  hij zegt PER JOURNAAL of hij meetelde. Een cijfer dat stilzwijgend een
        hele suite overslaat, leest als een uitspraak over alles -- en dat is
        precies het soort stille onvolledigheid waar dit huis registers voor
        heeft.

   Draai los: node --experimental-sqlite --test test/dekking.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

/* De meter weigert een journaal met minder dan vijftig patronen -- dat is geen
   meting maar een kapotte opstelling. Deze vulling haalt die drempel met paden
   die met opzet NIET bestaan, zodat ze het cijfer niet beinvloeden. */
function vulling(n) {
  const uit = [];
  for (let i = 0; i < n; i++) uit.push('POST /api/zz-dekkingtoets/' + i);
  return uit.join('\n') + '\n';
}

/* De meter ZAKT hier met opzet: deze nepjournalen halen de norm bij lange na
   niet, dus hij komt terug met exit 1 en zijn klacht op stderr. Dat is precies
   goed gedrag; het cijfer op stdout is er gewoon. Vandaar de vangst -- zonder
   die zou deze toets meten dat de ratel werkt in plaats van dat de unie werkt. */
function meet(journalen) {
  const args = [path.join(WORTEL, 'scripts', 'dekking.js'), '--json'];
  for (const j of journalen) { args.push('--lees'); args.push(j); }
  const opties = { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600000, maxBuffer: 64 * 1024 * 1024 };
  /* spawnSync EN NIET execFileSync, want deze meter zakt hier met opzet (zie de
     opmerking bij vulling): dan GOOIT execFileSync, en in dat foutpad kapt Node
     de uitvoer af op de pijpbuffer van 64 kB -- ongeacht de maxBuffer die we
     hier meegeven. Met deze verzameling groeide het JSON daaroverheen en zakte
     de toets op "Unterminated string in JSON at position 65536": een meetfout
     die eruitziet als een kapotte meter. spawnSync gooit niet en houdt zich wel
     aan maxBuffer. */
  /* TWEE KEER PROBEREN, EN ALLEEN ALS DE METER NIET HEEFT GEMETEN.

     Op 27 augustus 2026 zakte deze toets een keer in CI met een lege uitvoer na
     tien seconden: geen JSON, geen cijfer, geen klacht. Een kindproces dat
     halverwege omvalt (een runner die krap zit, zes toetsen tegelijk die elk
     een meter starten) levert geen ANDERE uitslag op maar GEEN uitslag -- en
     dat is een meetfout en geen oordeel over de dekking. Vandaar een tweede
     poging, maar uitsluitend voor dat geval: komt er JSON, dan telt die JSON,
     ook als het cijfer laag is. Zakt de meter twee keer, dan zakt de toets met
     de volledige diagnose van allebei de pogingen erbij -- want de vorige
     melding ("de meter gaf geen JSON terug: ") liet je met lege handen achter:
     stderr ging naar /dev/null en de afloopcode werd niet genoemd. */
  const pogingen = [];
  for (let poging = 1; poging <= 2; poging++) {
    const r = spawnSync(process.execPath, args, opties);
    const uit = String(r.stdout || '');
    if (uit.trim().startsWith('{')) return JSON.parse(uit);
    pogingen.push('poging ' + poging + ': afloop=' + r.status + ' signaal=' + r.signal +
      (r.error ? ' fout=' + r.error.message : '') +
      ' stdout=' + JSON.stringify(uit.slice(0, 200)) +
      ' stderr=' + JSON.stringify(String(r.stderr || '').slice(-400)));
  }
  assert.fail('de meter gaf geen JSON terug, twee keer niet -- ' + pogingen.join(' | '));
}

test('twee journalen tellen samen, en een endpoint uit het tweede is niet meer "nooit aangeraakt"', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingtoets-'));
  const alleen = path.join(map, 'een.log');
  const scherm = path.join(map, 'twee.log');
  try {
    /* Het eerste journaal doet alsof het de servertoetsen zijn: genoeg patronen
       om de drempel te halen, maar zonder de route die alleen de browser raakt. */
    fs.writeFileSync(alleen, vulling(60));
    /* Het tweede is het schermjournaal: een echte route, plus een SCHERM-regel
       zoals de e2e-suite die schrijft (die hoort geen endpoint te worden). */
    fs.writeFileSync(scherm, 'POST /api/fout/client\nSCHERM /apps/app.html\n');

    const zonder = meet([alleen]);
    const met = meet([alleen, scherm]);

    /* MET DE METHODE ERVOOR. `ongeraakt` draagt sinds de routekaart per
       methode telt regels als "POST /api/fout/client"; op het kale pad zoeken
       vindt dan nooit iets, en dan is deze bewering altijd waar aan de ene kant
       en altijd onwaar aan de andere -- een toets die niets meet. */
    const REGEL = 'POST /api/fout/client';
    assert.ok(zonder.ongeraakt.includes(REGEL),
      'met alleen het toetsjournaal staat de foutmelder als nooit aangeraakt');
    assert.ok(!met.ongeraakt.includes(REGEL),
      'met het schermjournaal erbij niet meer -- de unie telt');
    assert.ok(met.geraakt > zonder.geraakt, 'en het cijfer gaat omhoog van een journaal erbij');
    assert.equal(met.routes, zonder.routes, 'de routekaart zelf verandert er niet van');
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});

test('de uitslag zegt PER JOURNAAL of hij meetelde', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekkingtoets2-'));
  const een = path.join(map, 'een.log');
  const twee = path.join(map, 'twee.log');
  try {
    fs.writeFileSync(een, vulling(60));
    fs.writeFileSync(twee, 'POST /api/fout/client\n');
    const r = meet([een, twee]);
    assert.ok(Array.isArray(r.journalen), 'de uitslag draagt een lijst journalen');
    assert.equal(r.journalen.length, 2, 'allebei genoemd');
    for (const h of r.journalen) {
      assert.equal(h.geteld, true);
      assert.ok(h.reden, h.pad + ' zonder reden opgenomen');
    }
  } finally {
    fs.rmSync(map, { recursive: true, force: true });
  }
});
