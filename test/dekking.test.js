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

test('bewijsherkomst: broncommit is expliciet, volledig en een bestaande commit; nooit stil HEAD', () => {
  const { broncommitUitArgv } = require('../scripts/dekking');
  const { execFileSync } = require('child_process');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  assert.equal(broncommitUitArgv(['--lees', 'een.log']), null);
  assert.equal(broncommitUitArgv(['--lees', 'een.log', '--broncommit=' + commit]), commit);
  assert.equal(broncommitUitArgv(['--lees', 'een.log', '--broncommit', commit]), commit);
  for (const waarde of ['', 'HEAD', commit.slice(0, 12), 'g'.repeat(40), '0'.repeat(40)]) {
    assert.throws(() => broncommitUitArgv(['--lees', 'een.log', '--broncommit=' + waarde]), /broncommit/);
  }
  assert.throws(() => broncommitUitArgv(['--broncommit=' + commit]), /alleen.*--lees/);
  assert.throws(() => broncommitUitArgv(['--lees', 'een.log', '--broncommit=' + commit, '--broncommit=' + commit]), /eenmaal/);
});

test('bewijsherkomst: hashes en aanroepunie komen uit dezelfde bytes, zonder schermregels als routes', () => {
  const { leesWaarnemingen } = require('../scripts/dekking');
  const { createHash } = require('crypto');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekking-herkomst-'));
  const een = path.join(map, 'een.log'), twee = path.join(map, 'twee.log');
  try {
    const bron = 'HEAD /api/voorbeeld\nPOST /api/ander\nSCHERM /apps/app.html\n';
    fs.writeFileSync(een, bron);
    fs.writeFileSync(twee, 'POST /api/ander\nTOETS POST /api/ander test/voorbeeld.test.js\n');
    const r = leesWaarnemingen([een, twee]);
    assert.deepEqual([...r.geraakt].sort(), ['GET /api/voorbeeld', 'POST /api/ander']);
    assert.equal(r.invoer.length, 2);
    assert.deepEqual(r.invoer[0], { pad: 'een.log', bytes: Buffer.byteLength(bron),
      sha256: createHash('sha256').update(bron).digest('hex') });
    fs.appendFileSync(een, 'POST /api/derde\n');
    const vers = leesWaarnemingen([een, twee]);
    assert.notEqual(vers.invoer[0].sha256, r.invoer[0].sha256);
    assert.equal(r.geraakt.has('POST /api/derde'), false, 'de vorige snapshot verandert niet achteraf');
    assert.equal(vers.geraakt.has('POST /api/derde'), true);
    assert.throws(() => leesWaarnemingen([path.join(map, 'ontbreekt.log')]), /ENOENT/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('bewijsherkomst: geïmporteerde100 procent is aanroepdekking, geen volledige of actuele kwalificatie', () => {
  const { bewijsVan } = require('../scripts/dekking');
  const dekking = require('../server/kern/routedekking');
  const kaart = [{ methode: 'GET', pad: '/api/voorbeeld' }, { methode: 'POST', pad: '/api/ander' }];
  const meting = dekking.meet(kaart, ['GET /api/voorbeeld', 'POST /api/ander']);
  assert.equal(meting.pct, 100);
  const invoer = [{ pad: 'oud-unit.log', sha256: 'a'.repeat(64), bytes: 123 },
    { pad: 'oud-scherm.log', sha256: 'b'.repeat(64), bytes: 456 }];
  const basis = { meetcommit: 'c'.repeat(40), broncommit: 'd'.repeat(40),
    geimporteerd: true, invoer, op: '2026-11-14T12:00:00.000Z', suiteStatus: null };
  const r = bewijsVan(meting, kaart, basis);
  assert.deepEqual(r.aangeraakt, ['POST /api/ander', 'GET /api/voorbeeld']);
  assert.equal(r.gemeten.commit, basis.meetcommit);
  assert.equal(r.gemeten.broncommit, basis.broncommit);
  assert.notEqual(r.gemeten.commit, r.gemeten.broncommit);
  assert.equal(r.herkomst.soort, 'geimporteerde-waarnemingsunie');
  assert.equal(r.herkomst.aantalBestanden, 2);
  assert.deepEqual(r.herkomst.bestanden, invoer);
  assert.equal(r.herkomst.broncommitStatus, 'opgegeven-niet-zelfstandig-gekoppeld');
  assert.equal(r.kwalificatie.status, 'NIET_VASTGESTELD');
  assert.doesNotMatch(r.uitleg, /tijdens de volledige testsuite/);
  assert.match(r.uitleg, /waarnemingsunie/);
  const onbekend = bewijsVan(meting, kaart, { ...basis, broncommit: null });
  assert.equal(onbekend.gemeten.broncommit, null);
  assert.equal(onbekend.herkomst.broncommitStatus, 'onbekend');
  assert.equal(onbekend.kwalificatie.status, 'NIET_VASTGESTELD');
  const lokaal = bewijsVan(meting, kaart, { ...basis, geimporteerd: false, broncommit: null, suiteStatus: 0 });
  assert.equal(lokaal.herkomst.soort, 'lokale-waarnemingsunie');
  assert.equal(lokaal.herkomst.suiteStatus, 0);
  assert.equal(lokaal.kwalificatie.status, 'NIET_VASTGESTELD', 'exit0 bewijst op zichzelf niet alle CI-/schermdelen');
});

test('bewijsherkomst: ongeldige CLI-broncommit stopt vóór meting of registerwrites', () => {
  const voor = ['NORM.json', 'DEKKING.json'].map(p => fs.readFileSync(path.join(WORTEL, p), 'utf8'));
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'scripts/dekking.js'),
    '--lees', '/bestaat-niet/oud.log', '--broncommit=HEAD', '--vastleggen'],
  { cwd: WORTEL, encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /broncommit/);
  assert.equal(r.stdout, '');
  assert.deepEqual(['NORM.json', 'DEKKING.json'].map(p => fs.readFileSync(path.join(WORTEL, p), 'utf8')), voor);
});

test('bewijsherkomst: het echte schrijfpad bewaart importbewijs, maar één gat blijft beide registerwrites weigeren', () => {
  const vm = require('node:vm'), { execFileSync } = require('child_process');
  const { createHash } = require('crypto');
  const script = path.join(WORTEL, 'scripts/dekking.js');
  const bron = fs.readFileSync(script, 'utf8');
  const broncommit = execFileSync('git', ['rev-parse', 'HEAD^'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekking-schrijfpad-'));
  const journaal = path.join(map, 'fixture.log');
  // Uitsluitend testinvoer: geen server/routekaartproces en geen repo-registerwrites.
  const kaart = Array.from({ length: 60 }, (_, i) => ({ methode: 'POST', pad: '/api/voorbeeld/' + i }));
  try {
    for (const aantal of [60, 59]) {
      const inhoud = kaart.slice(0, aantal).map(r => r.methode + ' ' + r.pad).join('\n') + '\n';
      fs.writeFileSync(journaal, inhoud);
      const writes = new Map(), fout = [], uitvoer = [];
      const fileSystem = Object.assign({}, fs, { writeFileSync(pad, tekst) {
        assert.ok(['NORM.json', 'DEKKING.json'].some(naam => pad === path.join(WORTEL, naam)));
        writes.set(path.basename(pad), JSON.parse(tekst));
      } });
      const kind = { execFileSync(cmd, args, opts) {
        if (cmd === 'git') return execFileSync(cmd, args, opts);
        assert.equal(cmd, process.execPath);
        assert.deepEqual(Array.from(args), [path.join(WORTEL, 'scripts/routekaart.js'), '--json']);
        return JSON.stringify({ routes: kaart });
      }, spawnSync() { assert.fail('de import mag geen suite starten'); } };
      const module = { exports: {} };
      const laden = naam => naam === 'fs' ? fileSystem : naam === 'child_process' ? kind : require(naam);
      laden.main = module;
      const proc = { argv: [process.execPath, script, '--json', '--vastleggen', '--lees', journaal,
        '--broncommit=' + broncommit], execPath: process.execPath, stdout: { write: tekst => uitvoer.push(tekst) } };
      vm.runInNewContext(bron, { require: laden, module, __dirname: path.dirname(script), process: proc, Set,
        console: { error: (...tekst) => fout.push(tekst.join(' ')), log() {} } });
      const rapport = JSON.parse(uitvoer.join(''));
      assert.equal(rapport.gaten, 60 - aantal);
      assert.equal(proc.exitCode, aantal === 60 ? 0 : 1);
      if (aantal === 59) {
        assert.equal(writes.size, 0, 'ook importbewijs met broncommit mag de100%-eis niet omzeilen');
        assert.match(fout.join('\n'), /DE DEKKING IS GEEN 100%/);
        continue;
      }
      assert.deepEqual([...writes.keys()].sort(), ['DEKKING.json', 'NORM.json']);
      const vast = writes.get('DEKKING.json');
      assert.equal(vast.aangeraakt.length, 60);
      assert.equal(vast.gemeten.commit, rapport.gemeten.commit);
      assert.equal(vast.gemeten.broncommit, broncommit);
      assert.equal(vast.herkomst.soort, 'geimporteerde-waarnemingsunie');
      assert.equal(vast.herkomst.aantalBestanden, 1);
      assert.deepEqual(vast.herkomst.bestanden, [{ pad: 'fixture.log', bytes: Buffer.byteLength(inhoud),
        sha256: createHash('sha256').update(inhoud).digest('hex') }]);
      assert.equal(vast.kwalificatie.status, 'NIET_VASTGESTELD');
      assert.doesNotMatch(vast.uitleg, /tijdens de volledige testsuite/);
      assert.equal(writes.get('NORM.json').meters.dekkingWaargenomenPct, 100);
      assert.equal(writes.get('NORM.json').meters.endpointsNooitAangeraakt, 0);
    }
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
