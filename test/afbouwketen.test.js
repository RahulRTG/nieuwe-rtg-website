/* DE VOLLEDIGE LEVENSLOOP VAN EEN BRONMUTERENDE RONDE -- met echte processen.

   test/afbouwafloop.test.js beproeft de module op zichzelf. Deze toets beproeft
   de KETEN: van een vrij slot, via een echte claim en een echte SIGKILL, tot een
   herstelde poort waar de volgende ronde weer door mag.

   WAAROM ECHTE PROCESSEN EN GEEN NABOOTSING. De vorige ronde corrigeerde deze
   wet drie keer, en alle drie de correcties zaten in PROCESsemantiek: de wortel
   is geen wees, een zombie is geen levend werk, en kill is niet hetzelfde als
   meteen dood. Een nagebouwde procestabel had precies de aannames bevestigd die
   fout waren.

   DE KETEN DIE HIER WORDT BEWEZEN:

     slot vrij -> geslaagde claim -> RUNNING -> kindproces -> root door SIGKILL
     weg -> opgeslagen stand blijft byte-voor-byte RUNNING -> oordeel wordt
     ONVOLTOOID -> de poort weigert -> de diagnose wijst run EN levend kind aan
     -> herstel() weigert zolang het kind leeft -> ruimOp() beeindigt echt werk
     -> herstel(door, reden) sluit af ZONDER PASSED -> de poort opent -> de
     volgende ronde kan claimen.

   En de negatieve kant, die er even hard bij hoort: een MISLUKTE claim mag geen
   ronde registreren. "Ik probeerde eigenaar te worden" is niet hetzelfde als
   "ik was eigenaar".

   Draai los: node --test test/afbouwketen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const AFLOOP_MOD = path.join(WORTEL, 'scripts/lib/afbouw-afloop.js');

/* Een wegwerpwereld: eigen slotmap en eigen afloopbestand, zodat deze proef het
   productieslot nooit aanraakt. */
function wereld() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'afbouwketen-'));
  return { map, slot: path.join(map, 'slot'), afloop: path.join(map, 'afloop.json'),
    env: (extra) => Object.assign({}, process.env,
      { RTG_AFBOUW_SLOT: path.join(map, 'slot'), RTG_AFLOOP_PAD: path.join(map, 'afloop.json'),
        /* De hartslag legt de proceskring vast TIJDENS de ronde. In productie
           staat hij op vijf seconden -- een bronmuterende ronde duurt uren, dus
           dat venster is verwaarloosbaar. Hier op 100 ms, want deze proef wil
           het mechanisme beproeven en niet erop wachten. */
        RTG_AFLOOP_HARTSLAG: '100' }, extra || {}) };
}
function laadAfloop(pad) {
  process.env.RTG_AFLOOP_PAD = pad;
  delete require.cache[require.resolve(AFLOOP_MOD)];
  return require(AFLOOP_MOD);
}
const leesRauw = (pad) => fs.readFileSync(pad, 'utf8');

/* DE OPRUIMER, EN WAAROM HIJ ER IS -- deze toets maakte precies de fout waar hij
   over gaat.

   De eerste versie kilde haar processen aan het EIND van de test. Zakte er een
   bewering daarvoor, dan gooide node er meteen uit en bleven de ronde en haar
   kind draaien. Erger: `spawn` houdt de event loop van de OUDER open, dus het
   toetsproces kon zelf niet afsluiten en de hele suite hing zonder uitslag. Ik
   heb dat vandaag zien gebeuren: een handmutatie liet toets 1 zakken en de
   opdracht liep in een tijdslimiet in plaats van in een foutmelding.

   Een toets die bij een defect HANGT in plaats van zakt, is erger dan geen
   toets: een timeout in de CI draagt geen diagnose, en het gedrag lijkt op een
   flake. Vandaar: elk gespawned proces gaat meteen in `tekil`, de handles
   worden ge-unreft zodat ze de ouder nooit openhouden, en t.after() ruimt op
   ongeacht de uitslag. */
function opruimer(t) {
  const tekil = [];
  const pidBestanden = [];
  t.after(() => {
    /* OOK WAT DE TOETS NOOIT HEEFT GELEZEN. Zakt een bewering vóór de regel die
       kind.pid uitleest, dan staat dat kleinkind in geen enkele lijst -- en dan
       leeft het door. Gezien gebeuren tijdens de handmutaties van deze ronde:
       twee ronden bleven achter omdat hun kind nooit was genoteerd. De opruimer
       leest die bestanden daarom zelf, in plaats van te vertrouwen op hoe ver de
       toets is gekomen. */
    for (const b of pidBestanden) {
      try { tekil.push(Number(fs.readFileSync(b, 'utf8'))); } catch (e) { /* nooit geschreven */ }
    }
    for (const pid of tekil) { try { process.kill(pid, 'SIGKILL'); } catch (e) { /* al weg */ } }
  });
  return {
    pidBestand: (b) => { pidBestanden.push(b); return b; },
    volg: (pid) => { if (pid) tekil.push(Number(pid)); return pid; },
    start: (argv, env) => {
      const p = spawn(process.execPath, argv, { env, stdio: 'ignore' });
      tekil.push(p.pid);
      p.unref();          // de ouder mag hier nooit op wachten
      return p;
    }
  };
}
function wachtOp(fn, ms = 5000) {
  const eind = Date.now() + ms;
  while (Date.now() < eind) {
    if (fn()) return true;
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},25)']);
  }
  return fn();
}

/* Een ronde die het ECHTE pak() gebruikt, een kind maakt en dan blijft hangen.
   Hij schrijft het PID van zijn kind naar een bestand zodat de toets het kent. */
const RONDE = `
  const { pak } = require(process.argv[1]);
  const { spawn } = require('child_process');
  const fs = require('fs');
  pak('proefronde');
  const kind = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  fs.writeFileSync(process.argv[2], String(kind.pid));
  setInterval(() => {}, 1000);
`;

test('DE KETEN: van claim tot herstel, met echte processen', (t) => {
  const op = opruimer(t);
  const w = wereld();
  const kindPad = op.pidBestand(path.join(w.map, 'kind.pid'));

  // --- slot vrij, en er is nog geen ronde ---
  const A0 = laadAfloop(w.afloop);
  assert.equal(A0.lees(), null, 'een verse wereld draagt geen afloop');
  assert.equal(A0.magStarten().mag, true, 'en laat dus door');

  // --- geslaagde claim -> RUNNING, met een kind ---
  const ronde = op.start(['-e', RONDE, path.join(WORTEL, 'scripts/afbouw-slot.js'), kindPad], w.env());
  assert.ok(wachtOp(() => fs.existsSync(kindPad) && fs.existsSync(w.afloop)),
    'de ronde hoort een afloop en een kind te hebben aangemaakt');
  const kind = op.volg(Number(fs.readFileSync(kindPad, 'utf8')));
  const A = laadAfloop(w.afloop);
  const tijdensLoop = A.lees();
  assert.equal(tijdensLoop.stand, 'RUNNING', 'pak() hoort de ronde als RUNNING te publiceren');
  assert.equal(tijdensLoop.taak, 'proefronde');
  assert.ok(tijdensLoop.runId, 'een ronde draagt een run-id');
  assert.ok(A.procesLeeft(kind), 'het kind leeft');

  /* WACHTEN OP DE HARTSLAG, en niet op de klok. De kring wordt tijdens de ronde
     vastgelegd; pas als het kind erin staat, heeft het zin om de wortel te
     vellen. Wie hier een vaste pauze zou nemen, toetst zijn eigen timing. */
  assert.ok(wachtOp(() => (A.lees().kring || []).some(k => k.pid === kind)),
    'de hartslag hoort het kind in de kring te zetten TERWIJL de ronde loopt -- ' +
    'alleen bij leg() vastleggen betekent dat juist een gekilde ronde geen enkel kind meldt');

  // --- de root wordt hard geveld: SIGKILL kan niets schrijven ---
  const rauwVoor = leesRauw(w.afloop);
  process.kill(ronde.pid, 'SIGKILL');
  assert.ok(wachtOp(() => !A.procesLeeft(ronde.pid)), 'de wortel hoort weg te zijn');

  // --- de opgeslagen stand is NIET herschreven ---
  assert.equal(leesRauw(w.afloop), rauwVoor,
    'een SIGKILL hoort geen letter aan het afloopbestand te veranderen -- dit is de invariant: ' +
    'een terminale toestand komt van de eigenaar of van een expliciete herstel(), nooit van een waarnemer');

  // --- het OORDEEL is ONVOLTOOID, en de poort weigert ---
  const g1 = A.magStarten('proefronde');
  assert.equal(g1.mag, false);
  assert.equal(g1.oordeel, 'ONVOLTOOID',
    'een RUNNING met een dode wortel is ONVOLTOOID, en dat is een oordeel en geen opgeslagen stand');
  assert.equal(A.lees().stand, 'RUNNING', 'en de opgeslagen stand blijft RUNNING');

  // --- de diagnose noemt de run EN het levende kind ---
  const d = A.diagnose(g1, A.lees());
  assert.match(d, /afbouwslot: GEWEIGERD/);
  assert.ok(d.includes(tijdensLoop.runId), 'de diagnose hoort de run bij naam te noemen');
  assert.match(d, /opgeslagen stand: *RUNNING/);
  assert.match(d, /oordeel: *ONVOLTOOID/);
  assert.ok(d.includes('pid ' + kind), 'de diagnose hoort het levende kind bij PID te noemen: ' + d);
  assert.match(d, /actie:/, 'en te zeggen wat een mens moet doen');

  // --- herstel() weigert zolang het kind leeft ---
  assert.throws(() => A.herstel({ stand: 'ABORTED', reden: 'ronde is gekild tijdens de proef', door: 'toets' }),
    /leven nog/, 'afsluiten terwijl er werk doorloopt, zou de runtime vuil achterlaten');

  // --- ruimOp() beeindigt werkelijk werk ---
  const geraakt = A.ruimOp();
  assert.ok(geraakt.includes(kind), 'ruimOp() hoort te melden wat hij raakte');
  assert.ok(wachtOp(() => !A.procesLeeft(kind)), 'en het kind hoort werkelijk weg te zijn');

  // --- maar de poort blijft dicht: de werkstatus is nog niet terminaal ---
  const g2 = A.magStarten('proefronde');
  assert.equal(g2.mag, false, 'een schone proceskring maakt een onvoltooide ronde niet alsnog geslaagd');
  assert.equal(g2.oordeel, 'ONVOLTOOID');

  // --- herstel() kan nooit PASSED schrijven ---
  assert.throws(() => A.herstel({ stand: 'PASSED', reden: 'zou de achterdeur zijn', door: 'toets' }),
    /alleen de ronde zelf/, 'een herstelhandeling mag een afgebroken meting nooit tot bewijs promoveren');
  assert.throws(() => A.herstel({ stand: 'ABORTED', door: 'toets' }), /reden/,
    'een terminale toestand zonder reden is een vinkje');

  // --- de expliciete afsluiting, met naam en reden ---
  const na = A.herstel({ stand: 'ABORTED', reden: 'de ronde is tijdens de proef gekild', door: 'afbouwketen.test.js' });
  assert.equal(na.stand, 'ABORTED');
  assert.equal(na.hersteld.wasStand, 'RUNNING', 'de geschiedenis blijft staan: hij WAS RUNNING');
  assert.equal(na.hersteld.door, 'afbouwketen.test.js');
  assert.match(na.hersteld.reden, /gekild/);

  // --- en nu mag de volgende ronde claimen ---
  const g3 = A.magStarten('proefronde');
  assert.equal(g3.mag, true, 'na een expliciete afsluiting en een schone kring hoort de poort te openen: ' + g3.reden);

  fs.rmSync(w.map, { recursive: true, force: true });
});

test('NEGATIEF: een mislukte claim registreert geen ronde', (t) => {
  const op = opruimer(t);
  /* "Ik probeerde eigenaar te worden" is niet hetzelfde als "ik was eigenaar".
     Zou pak() de afloop schrijven voordat het slot binnen is, dan ziet een
     mislukte claim eruit als een gestorven meetronde -- en blokkeert hij de
     machine om werk dat nooit is begonnen. */
  const w = wereld();
  const kindPad = op.pidBestand(path.join(w.map, 'kind.pid'));

  const eerste = op.start(['-e', RONDE, path.join(WORTEL, 'scripts/afbouw-slot.js'), kindPad], w.env());
  assert.ok(wachtOp(() => fs.existsSync(w.afloop)), 'de eerste ronde draait');
  const A = laadAfloop(w.afloop);
  /* WAT EEN CLAIM KAN VERANDEREN, EN WAT DE EIGENAAR ZELF SCHRIJFT.

     Hier stond een vergelijking byte voor byte, en die zakte -- terecht, maar
     niet om de reden die de melding gaf. De EERSTE ronde leeft, en een levende
     ronde schrijft elke hartslag haar eigen proceskring bij (hier elke 100 ms,
     zie w.env). Tussen de twee lezingen ging `kring` dus van leeg naar een
     kind, en dat had niets met de mislukte claim te maken.

     Een levend dossier byte voor byte vergelijken meet de klok en niet de
     claim. Wat bewezen moet worden is smaller en scherper: de claim schrijft
     GEEN tweede ronde en raakt niets aan dat over eigendom of afloop gaat. De
     hartslagvelden horen daar niet bij -- die zijn van de eigenaar, en dat de
     eigenaar ze mag schrijven staat als eigen toets in test/afbouwafloop. */
  const eigendom = (rauw) => {
    const j = JSON.parse(rauw);
    for (const veld of ['kring', 'kringGepeild']) delete j[veld];
    return JSON.stringify(j);
  };
  const vanEerste = eigendom(leesRauw(w.afloop));
  const kind = op.volg(Number(fs.readFileSync(kindPad, 'utf8')));

  /* De tweede claim MOET stuklopen: het slot is bezet door een levend proces. */
  const tweede = spawnSync(process.execPath,
    ['-e', "require(process.argv[1]).pak('proefronde-twee')", path.join(WORTEL, 'scripts/afbouw-slot.js')],
    { env: w.env(), encoding: 'utf8' });
  assert.notEqual(tweede.status, 0, 'een tweede claim op een bezet slot hoort te falen');
  assert.match(String(tweede.stderr || ''), /al actief/i, 'en te zeggen waarom');

  assert.equal(eigendom(leesRauw(w.afloop)), vanEerste,
    'de mislukte claim hoort niets aan het EIGENDOM of de AFLOOP te veranderen -- anders lijkt een ' +
    'niet-begonnen ronde op een gestorven meetronde en blokkeert hij de machine om werk dat nooit bestond');
  assert.equal(A.lees().taak, 'proefronde', 'de afloop hoort nog van de EERSTE ronde te zijn');
  assert.equal(A.lees().stand, 'RUNNING', 'en de eerste ronde hoort gewoon door te draaien');

  fs.rmSync(w.map, { recursive: true, force: true });   // de processen ruimt t.after() op
});
