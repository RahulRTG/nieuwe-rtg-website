/* MEET NIEMAND TERWIJL EEN MOTOR DE BRON VERBOUWT?

   Twee motoren in dit huis muteren met opzet echte bestanden en zetten ze in
   een finally terug: scripts/mutatie.js (de mutatiemotor) en
   test/meterijk.test.js (de ijking, die een tijdelijk scherm onder public/apps/, een
   dependency in package.json en honderd /api/zzijkproef-routes neerzet). Ze
   nemen daarvoor het exclusieve slot uit scripts/afbouw-slot.js.

   WIE ER MIDDENIN MEET, MEET DIE AANBOUW MEE. Dat is hier gebeurd:
   scripts/kaart.js telde het extra scherm en schreef het in ARCHITECTUUR.md, en
   CI zag daarna een document dat achterliep op de code. Erger nog dan de fout is
   dat hij onzichtbaar was -- die generatoren schrijven een DOCUMENT en geen
   register, dus er is geen stempel waarin `boomVuil` het had kunnen verraden.

   `eisSchoneBoom` vangt dit maar bij toeval: git ziet de aanbouw wel, maar een
   meting die START in een schoon venster en er middenin belandt, komt er langs.

   Draai los: node --test test/afbouwpoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const slot = require('../scripts/afbouw-slot');

test('releasepoort geeft haar eigen slot door aan controles, maar niet aan buitenstaanders', (t) => {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'releasepoort-kind-'));
  t.after(() => fs.rmSync(map, { recursive: true, force: true }));
  fs.mkdirSync(path.join(map, 'scripts'));
  fs.copyFileSync(path.join(WORTEL, 'scripts/release-gate.js'), path.join(map, 'scripts/release-gate.js'));
  fs.symlinkSync(path.join(WORTEL, 'scripts/afbouw-slot.js'), path.join(map, 'scripts/afbouw-slot.js'));
  fs.symlinkSync(path.join(WORTEL, 'scripts/lib'), path.join(map, 'scripts/lib'));
  const probe = path.join(map, 'probe.cjs');
  fs.writeFileSync(probe, `
    const slot = require(${JSON.stringify(path.join(WORTEL, 'scripts/afbouw-slot.js'))});
    const afloop = require(${JSON.stringify(path.join(WORTEL, 'scripts/lib/afbouw-afloop.js'))});
    console.log(JSON.stringify({slot:slot.eisGeenAfbouw('controle'),
      controle:afloop.magControleren ? afloop.magControleren() : afloop.magStarten(),
      nieuweRonde:afloop.magStarten(), stand:afloop.lees().stand,
      run:process.env.RTG_AFBOUW_RUN_ID}));
  `);
  const hook = path.join(map, 'hook.cjs');
  fs.writeFileSync(hook, `
    const cp = require('node:child_process');
    const fs = require('node:fs');
    const echt = cp.spawnSync;
    cp.spawnSync = (cmd, args, opties) => {
      if (args[0] !== 'scripts/build.js') return echt(cmd, args, opties);
      const kind = echt(process.execPath, [${JSON.stringify(probe)}], {...opties, encoding:'utf8', stdio:'pipe'});
      const buitenEnv = {...process.env};
      delete buitenEnv.RTG_AFBOUW_SLOT_ACTIEF;
      const buiten = echt(process.execPath, [${JSON.stringify(probe)}], {...opties, env:buitenEnv, encoding:'utf8', stdio:'pipe'});
      const oud = echt(process.execPath, [${JSON.stringify(probe)}], {...opties,
        env:{...opties.env,RTG_AFBOUW_RUN_ID:'andere-ronde'}, encoding:'utf8', stdio:'pipe'});
      fs.writeFileSync(${JSON.stringify(path.join(map, 'observations.json'))}, JSON.stringify({
        kind:{status:kind.status,stdout:kind.stdout,stderr:kind.stderr},
        buiten:{status:buiten.status,stdout:buiten.stdout,stderr:buiten.stderr},
        oud:{status:oud.status,stdout:oud.stdout,stderr:oud.stderr}
      }));
      return {status:73}; // Opzettelijke stop: deze proef maakt nooit releasebewijs.
    };
  `);
  const env = {...process.env, RTG_AFBOUW_SLOT:path.join(map, 'slot'), RTG_AFLOOP_PAD:path.join(map, 'afloop.json')};
  delete env.RTG_AFBOUW_SLOT_ACTIEF;
  delete env.RTG_METEN_TIJDENS_AFBOUW;
  const r = spawnSync(process.execPath, ['--require', hook, path.join(map, 'scripts/release-gate.js')],
    { env, encoding:'utf8', timeout:20000 });
  assert.equal(r.status, 73, r.stderr);
  const o = JSON.parse(fs.readFileSync(path.join(map, 'observations.json')));
  assert.equal(o.kind.status, 0, o.kind.stderr);
  assert.equal(o.buiten.status, 0, o.buiten.stderr);
  const kind = JSON.parse(o.kind.stdout), buiten = JSON.parse(o.buiten.stdout);
  assert.equal(kind.slot.ok, true, 'de echte releasepoort moet haar eigen kind laten meten');
  assert.equal(kind.controle.mag, true, 'de controle is geen nieuwe afbouwronde: ' + JSON.stringify(kind));
  assert.equal(kind.nieuweRonde.mag, false, 'de lopende ronde mag niet als voltooid gelden');
  assert.equal(kind.stand, 'RUNNING');
  assert.equal(buiten.slot.ok, false, 'zonder overgedragen slot blijft de buitenstaander geweigerd');
  assert.equal(buiten.controle.mag, false);
  assert.equal(o.oud.status, 0, o.oud.stderr);
  assert.equal(JSON.parse(o.oud.stdout).controle.mag, false, 'een verkeerde run-id geeft geen vrijstelling');
  assert.equal(fs.existsSync(path.join(map, '.release/release-gate-bewijs.json')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(map, 'afloop.json'))).stand, 'FAILED');
  // Een vorige onafgeronde ronde mag niet verdwijnen achter de nieuwe claim.
  const onvoltooid = JSON.stringify({runId:'oude-run',taak:'releasepoort',stand:'RUNNING',
    wortel:{pid:process.pid,start:null},kring:[]});
  fs.writeFileSync(path.join(map, 'afloop.json'), onvoltooid);
  const geblokkeerd = spawnSync(process.execPath, [path.join(map, 'scripts/release-gate.js')],
    {env,encoding:'utf8',timeout:20000});
  assert.notEqual(geblokkeerd.status, 0);
  assert.match(geblokkeerd.stderr, /oude-run/);
  assert.equal(fs.readFileSync(path.join(map, 'afloop.json'),'utf8'), onvoltooid);
});

test('actief() leest het slot zonder het te pakken', () => {
  /* De hele reden dat deze functie naast pak() staat: twee LEZERS mogen naast
     elkaar draaien. Zou dit pak() gebruiken, dan sloten metingen elkaar uit. */
  const voor = slot.actief();
  const tweede = slot.actief();
  assert.deepEqual(tweede, voor, 'kijken verandert niets, ook niet twee keer');
});

/* HET ECHTE SLOT WORDT HIER NIET GEPAKT, en dat is geen omweg.
   scripts/test-runner.js HOUDT dat slot terwijl de suite draait, dus een toets
   die het zelf wil nemen zakt in CI op precies de plek waar hij hoort te
   slagen. eisSchoneBoom neemt daarom een lezer aan; wat er wordt meegegeven is
   de LEZER en niet de uitkomst, zodat de hele weg nog door de poort loopt. */
const alsAfbouw = (wat) => () => wat;

/* EN DE TWEEDE INVOER VAN DE POORT: de vlag die zegt dat het slot van je EIGEN
   proceslijn is. scripts/test-runner.js zet RTG_AFBOUW_SLOT_ACTIEF=1 voor de
   hele suite, dus binnen een toets staat hij AAN -- en dan laat de poort alles
   door. Elke bewering hieronder die over de WEIGERING gaat, moet hem dus zelf
   uitzetten, anders slaagt hij op de omgeving in plaats van op de logica.

   Dit is geen theorie: deze twee toetsen stonden groen toen ik ze los draaide
   (buiten de runner is de vlag niet gezet) en zakten in CI. Een toets die
   afhangt van hoe hij wordt gestart, meet zijn starter. */
function zonderEigenSlot(werk) {
  const oud = process.env.RTG_AFBOUW_SLOT_ACTIEF;
  delete process.env.RTG_AFBOUW_SLOT_ACTIEF;
  try { return werk(); }
  finally { if (oud !== undefined) process.env.RTG_AFBOUW_SLOT_ACTIEF = oud; }
}

test('eisGeenAfbouw weigert zolang er een motor draait, en zegt WELKE', () => {
  const r = zonderEigenSlot(() => slot.eisGeenAfbouw('een proefmeting',
    () => ({ taak: 'toets-afbouwpoort', pid: 4242, gestart: '2026-09-06T13:00:00Z' })));
  assert.equal(r.ok, false, 'een meting naast een motor is geen geldige meting');
  assert.match(r.reden, /toets-afbouwpoort/, 'de reden noemt WELKE motor draait');
  assert.match(r.reden, /4242/, 'en zijn pid, zodat je kunt kijken of hij vastzit');
  assert.ok(r.afbouw && r.afbouw.pid);
});

test('en laat hem door zodra het slot vrij is', () => {
  /* Zonder deze bewering zou een poort die ALTIJD weigert ook groen staan --
     en dat is de gevaarlijkste vorm: elke meting stil geblokkeerd. */
  const r = zonderEigenSlot(() => slot.eisGeenAfbouw('een proefmeting', () => null));
  assert.equal(r.ok, true, 'met een vrij slot mag de meting gewoon draaien');
});

test('RTG_METEN_TIJDENS_AFBOUW=1 opent hem met opzet', () => {
  /* Een ontsnapping die er ALTIJD hoort te zijn bij een harde poort, en die
     hier alleen mag omdat zo'n ronde daarmee zelf zegt dat hij niet als bewijs
     telt -- dezelfde afspraak als RTG_METEN_OP_VUILE_BOOM. */
  const oud = process.env.RTG_METEN_TIJDENS_AFBOUW;
  process.env.RTG_METEN_TIJDENS_AFBOUW = '1';
  try {
    const r = zonderEigenSlot(() => slot.eisGeenAfbouw('x', () => ({ taak: 'toets', pid: 1, gestart: 'x' })));
    assert.equal(r.ok, true);
    assert.match(r.reden, /telt niet als bewijs/, 'en zegt erbij wat die opening kost');
  } finally {
    if (oud === undefined) delete process.env.RTG_METEN_TIJDENS_AFBOUW;
    else process.env.RTG_METEN_TIJDENS_AFBOUW = oud;
  }
});

test('het slot van je EIGEN proceslijn is geen vreemde motor', () => {
  /* HIER IS DEZE POORT DE EERSTE KEER OMGEVALLEN, en niet op een meting maar op
     de toetsen zelf. scripts/test-runner.js pakt het slot voor de HELE suite
     (`pak('volledige Node-tests')`) en geeft RTG_AFBOUW_SLOT_ACTIEF=1 door aan
     elk kindproces. Zonder deze regel weigert de poort dus binnen elke toets,
     en dan valt alles om wat een gepoort script aanroept:
     test/functielijst.test.js eindigde op exitCode 2 (het script doet
     process.exit(2) bij een weigering) en test/schoneboom.test.js zakte twee
     keer, omdat eisSchoneBoom een weigering teruggaf zonder `bestanden` en met
     een reden die zijn eigen ontsnapping RTG_METEN_OP_VUILE_BOOM niet noemt.

     De vlag bestond al -- pak() gebruikt hem sinds de meterijking -- en betekent
     "het slot is van mijn eigen ouder". Die vraag is iets anders dan "er loopt
     een motor", en dit is de plek waar dat onderscheid hoort.

     WAT DEZE OPENING NIET WEGGEEFT: binnen een suite muteert alleen een IJKING
     de bron, en scripts/lib/ijkingen.js draait die een voor een en in CI zelfs
     in een eigen job. Die isolatie is de bescherming daar; deze poort beschermt
     tegen een motor in een ANDERE proceslijn (mijn eigen shell naast een
     draaiende meterijking -- precies het geval waarvoor hij gebouwd is). Haalt
     iemand een ijking uit die lijst zonder eigen job, dan is dat gat er wel;
     test/delen.test.js is de toets die daarover gaat. */
  const oud = process.env.RTG_AFBOUW_SLOT_ACTIEF;
  process.env.RTG_AFBOUW_SLOT_ACTIEF = '1';
  try {
    const r = slot.eisGeenAfbouw('een proefmeting',
      alsAfbouw({ taak: 'volledige Node-tests', pid: 4242, gestart: 'toen' }));
    assert.equal(r.ok, true, 'het slot van je eigen ouder mag je niet buitensluiten');
    assert.match(r.reden, /eigen proceslijn/, 'en de reden zegt waarom hij toch doorloopt');
  } finally {
    if (oud === undefined) delete process.env.RTG_AFBOUW_SLOT_ACTIEF;
    else process.env.RTG_AFBOUW_SLOT_ACTIEF = oud;
  }
});

test('eisSchoneBoom draagt dezelfde poort, dus de elf proeven krijgen hem gratis', () => {
  const { eisSchoneBoom } = require('../scripts/lib/stempel');
  const r = zonderEigenSlot(() => eisSchoneBoom('een proefmeting',
    { afbouw: () => ({ taak: 'motor-x', pid: 7, gestart: 'toen' }) }));
  assert.equal(r.ok, false);
  assert.match(r.reden, /motor-x/);
  const vrij = zonderEigenSlot(() => eisSchoneBoom('een proefmeting', { afbouw: () => null }));
  assert.equal(/afbouw loopt/.test(String(vrij.reden || '')), false,
    'met een vrij slot is de afbouw geen reden meer (de boom mag nog wel vuil zijn)');
});

test('de twee documentgeneratoren roepen de gedeelde poort ook echt aan', () => {
  /* Zij kunnen eisSchoneBoom niet gebruiken -- je draait ze juist OMDAT je net
     een bestand hebt toegevoegd, en dan is de boom per definitie vuil. Dit is
     met opzet de enige bewering die naar de BRON kijkt, en alleen naar het feit
     dat ze de helper aanroepen; wat die helper dan doet, staat hierboven. */
  const fs = require('fs');
  const path = require('path');
  for (const naam of ['kaart.js', 'functielijst.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'scripts', naam), 'utf8');
    const regels = bron.split('\n').filter(r => !r.trim().startsWith('//') && !r.trim().startsWith('*'));
    assert.ok(regels.some(r => r.includes("require('./afbouw-slot').eisGeenAfbouw(")),
      'scripts/' + naam + ' hoort de gedeelde poort aan te roepen (en niet in commentaar)');
  }
});

test('elk tijdelijk ijkbestand staat in .gitignore', () => {
  /* DE AANLEIDING, 13 september 2026. test/meterijk.test.js zet voor de ijking
     van `verstrengelingOnverklaard` `server/kern/zzijkbron.js` neer. Die naam
     mist met OPZET de koppeltekens van zijn acht broertjes (de meter groepeert
     op `familie` -- alles voor het eerste koppelteken -- dus `zz-ijk-bron` en
     `zz-ijk-doel` zouden allebei familie `zz` heten en de meter zou niet
     bewegen). Precies daardoor viel hij buiten elk patroon dat op de gewone
     ijkmarker staat (die naam staat hier niet voluit: regel 36 van de keuring
     grep't de hele boom inclusief dit bestand, dus wie hem in een uitleg
     uitschrijft, laat die regel over zijn eigen commentaar klagen)
     in .gitignore, en is hij met een `git add -A` meegecommit terwijl de ijking
     liep.

     .gitignore waarschuwt daar zelf al voor -- "`git add -A` genoeg om ze per
     ongeluk mee te committen, dat scheelde hier een keer een haar" -- maar die
     waarschuwing werd bewaakt door de patronen zelf, en een nieuw bestand met
     een naam die er niet op past, ontsnapt daar per definitie aan.

     Dit is dus de handhaver die ontbrak: niet de PATRONEN nalopen maar de
     LIJST BESTANDEN die de ijking werkelijk neerzet. Komt er een negende bij
     met weer een andere naam, dan zakt deze toets in plaats van dat het bestand
     stil in de repo belandt. */
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');
  const WORTEL = path.join(__dirname, '..');
  const bron = fs.readFileSync(path.join(__dirname, 'meterijk.test.js'), 'utf8');

  const paden = [...new Set([...bron.matchAll(/metTijdelijkBestand\(\s*'([^']+)'/g)].map(m => m[1]))];
  assert.ok(paden.length >= 8,
    'geen tijdelijke ijkpaden gevonden (' + paden.length + ') -- dan bewaakt deze toets niets');

  const nietGenegeerd = [];
  for (const p of paden) {
    /* `git check-ignore` geeft exitcode 1 als het pad NIET genegeerd wordt; dat
       is hier de uitslag en geen fout, dus de worp wordt gevangen. */
    let genegeerd = true;
    try { execFileSync('git', ['check-ignore', '-q', p], { cwd: WORTEL, stdio: 'ignore' }); }
    catch (e) { genegeerd = false; }
    if (!genegeerd) nietGenegeerd.push(p);
  }
  assert.deepEqual(nietGenegeerd, [],
    'deze tijdelijke ijkbestanden staan niet in .gitignore en kunnen dus met een ' +
    '`git add -A` in de repo belanden terwijl de ijking loopt:\n  ' + nietGenegeerd.join('\n  '));
});

/* EEN SLOTHOUDER DIE ZELF METINGEN START, MOET ZIJN KINDEREN VRIJ LATEN.
   De releasepoort pakte het slot en gaf `process.env` ongewijzigd door aan
   check.js; scripts/kaart.js zag daar het slot van zijn EIGEN grootouder en
   weigerde, en de poort zakte bij elke run op "Bron- en securityregels". Dit
   loopt met een echt slot in een eigen map (RTG_AFBOUW_SLOT), in een eigen
   proceslijn -- het slot van de lopende suite blijft onaangeroerd. */
test('een kind van de slothouder mag meten met kindOmgeving(), en zonder niet', () => {
  const cp = require('child_process');
  const os = require('os');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-slotkind-'));
  const env = { ...process.env, RTG_AFBOUW_SLOT: path.join(map, 'slot') };
  delete env.RTG_AFBOUW_SLOT_ACTIEF;
  delete env.RTG_METEN_TIJDENS_AFBOUW;
  const houder = `
    const cp = require('child_process');
    const slot = require(${JSON.stringify(path.join(WORTEL, 'scripts', 'afbouw-slot.js'))});
    const vrij = slot.pak('toets-slotkind');
    const kind = env => JSON.parse(cp.execFileSync(process.execPath, ['-e',
      'const s=require(' + JSON.stringify(${JSON.stringify(path.join(WORTEL, 'scripts', 'afbouw-slot.js'))}) + ');' +
      'process.stdout.write(JSON.stringify(s.eisGeenAfbouw("kaart.js")))'], { env }).toString());
    const kaal = { ...process.env }; delete kaal.RTG_AFBOUW_SLOT_ACTIEF;
    process.stdout.write(JSON.stringify({ met: kind(slot.kindOmgeving(kaal)), zonder: kind(kaal) }));
    vrij();`;
  try {
    const uit = JSON.parse(cp.execFileSync(process.execPath, ['-e', houder], { env }).toString());
    assert.equal(uit.met.ok, true, 'met de doorgegeven vlag meet het kind: ' + uit.met.reden);
    assert.equal(uit.zonder.ok, false, 'zonder de vlag ziet het kind het slot van zijn ouder als vreemd');
    assert.match(uit.zonder.reden, /toets-slotkind/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('de releasepoort geeft elke stap kindOmgeving() mee, niet de kale omgeving', () => {
  /* De gedragsproef hierboven bewijst de functie; deze houdt vast dat de poort
     hem gebruikt. Zonder deze regel kan iemand de spawn terugzetten op
     `env: process.env` en blijft de proef hierboven groen. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'release-gate.js'), 'utf8');
  const spawns = bron.match(/cp\.spawnSync\([^)]*\{[^}]*\}/g) || [];
  assert.ok(spawns.length >= 1, 'de poort start zijn stappen met spawnSync');
  for (const s of spawns) assert.match(s, /env:\s*kindOmgeving\(/, 'elke stap erft de slotvlag: ' + s);
});
