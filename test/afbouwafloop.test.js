/* GEEN WERK ZONDER EIGENAAR, GEEN OPVOLGER ZOLANG WERK VAN DE VOORGANGER LEEFT.

   scripts/lib/afbouw-afloop.js legt vast wat er van een meetronde overblijft.
   Deze toets bewijst dat die poort werkelijk dichtgaat -- met ECHTE processen,
   want de faalvorm die hem nodig maakte ging juist over processen die er nog
   waren terwijl niemand dat toetste.

   DE FOUT DIE HIERONDER LIGT. Op 13 september 2026 brak ik een ijkronde af die
   146 bestanden gesaboteerd had staan. Een wachtketting toetste "draait het
   proces nog?", las de afwezigheid als "klaar", en startte de volgende stap.
   Er bleven bovendien drie processen achter -- een toets met twee servers eraan
   -- die negentien minuten poorten vasthielden zonder eigenaar.

   TWEE BEGRIPPEN DIE DOOR ELKAAR LIEPEN, en die deze toets uit elkaar houdt:

     WERKSTATUS    is de ronde af?          PASSED / FAILED / ABORTED
     PROCESBEZIT   is de runtime schoon?    leeft er nog iets van die ronde?

   Een ronde kan ABORTED zijn terwijl haar kinderen nog draaien. Dan is een
   volgende meting formeel nieuw en materieel vervuild. Daarom twee sabotages:
   een waarin de ouder sterft en een kind blijft leven, en een waarin de ronde
   NETJES ABORTED schrijft maar bewust een kind laat staan. Allebei moeten ze
   blokkeren -- de tweede is de scherpste, want daar is de werkstatus correct.

   Draai los: node --test test/afbouwafloop.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const MODULE = path.join(WORTEL, 'scripts/lib/afbouw-afloop.js');

/* Elke toets zijn eigen afloopbestand: ze draaien met opzet met echte
   processen, en een gedeeld bestand maakt de uitslag van de volgorde
   afhankelijk. */
function verse() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'afloop-'));
  const pad = path.join(map, 'afloop.json');
  process.env.RTG_AFLOOP_PAD = pad;
  delete require.cache[require.resolve(MODULE)];
  return { A: require(MODULE), pad, map };
}
/* Een kind dat blijft leven tot iemand het opruimt. `detached` zodat het niet
   met de toets meesterft -- precies de wees die we willen nabootsen. */
function langLevendKind() {
  const k = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
    { detached: true, stdio: 'ignore' });
  k.unref();
  return k.pid;
}
/* DE TOETS VRAAGT WAT DE WET ZIET, en niet wat de kernel adresseerbaar noemt.
   `process.kill(pid, 0)` slaagt ook op een zombie -- een gedood kind dat nog
   niet door zijn ouder is geoogst. De eerste versie van deze toets ging daarop
   af en zag een aantoonbaar opgeruimd kind eeuwig "leven". De module weet dat
   verschil (procesLeeft leest de Z-stand uit /proc), dus de toets hoort hem te
   gebruiken in plaats van hem te overrulen. */
const leeft = (pid) => require(MODULE).procesLeeft(pid);
/* WACHTEN TOT HET PROCES ECHT WEG IS, en dat is geen kosmetiek. `process.kill`
   STUURT een signaal; het proces is daarna niet op datzelfde moment al
   opgeruimd. De eerste versie van deze toets keek meteen en zag het kind nog
   leven -- een asynchroon gevolg synchroon getoetst, en de meter kreeg de schuld
   van iets wat de toets zelf deed. Bewust met een grens en een uitslag: blijft
   hij leven, dan zegt de toets dat, in plaats van eeuwig te wachten. */
function wachtTotDood(pid, ms = 3000) {
  const eind = Date.now() + ms;
  while (Date.now() < eind) {
    if (!leeft(pid)) return true;
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},25)']);   // ~25ms pauze zonder busy-wait
  }
  return !leeft(pid);
}
function doodMaken(pid) { try { process.kill(pid, 'SIGKILL'); } catch (e) { /* al weg */ } }

test('0. een verse machine laat gewoon door', () => {
  const { A, map } = verse();
  const r = A.magStarten('proefronde');
  assert.equal(r.mag, true, r.reden);
  fs.rmSync(map, { recursive: true, force: true });
});

test('1. een ronde die PASSED schrijft en niets achterlaat, geeft de volgende vrij', () => {
  const { A, map } = verse();
  const r = A.begin({ taak: 'proefronde', commit: 'abc1234' });
  assert.equal(A.lees().stand, 'RUNNING', 'begin() hoort meteen RUNNING te schrijven');
  r.klaar('PASSED', { uitvoer: ['PROEF.json'] });
  const g = A.magStarten('proefronde');
  assert.equal(g.mag, true, g.reden);
  assert.equal(A.lees().stand, 'PASSED');
  fs.rmSync(map, { recursive: true, force: true });
});

test('2. SABOTAGE A -- de ouder sterft zonder iets te schrijven, en een kind leeft door', () => {
  /* Dit is letterlijk wat er op 13 september gebeurde: het proces was weg, dus
     "klaar" volgens de oude wachtconditie. Er staat nu RUNNING op schijf, en een
     RUNNING waarvan de wortel dood is, is geen geslaagde afronding. */
  const { A, pad, map } = verse();
  const kind = langLevendKind();
  const a = {
    runId: 'run-sabotage-a', taak: 'proefronde', stand: 'RUNNING',
    gestart: new Date().toISOString(), geeindigd: null,
    /* Een wortel-PID die aantoonbaar niet meer bestaat: een hoog nummer met een
       starttijd die nooit klopt. */
    wortel: { pid: 999999, start: 12345 },
    kring: [{ pid: kind, start: null }]
  };
  fs.writeFileSync(pad, JSON.stringify(a));
  delete require.cache[require.resolve(MODULE)];
  const B = require(MODULE);

  const g = B.magStarten('proefronde');
  assert.equal(g.mag, false, 'een gestorven RUNNING-ronde hoort de volgende te blokkeren');
  assert.match(g.reden, /geen terminale toestand|gestorven|afgebroken/);

  /* En na opruimen gaat hij nog steeds NIET open: de werkstatus is nog altijd
     niet terminaal. Procesbezit en werkstatus zijn twee eisen, geen een. */
  B.ruimOp();
  assert.equal(wachtTotDood(kind), true, 'ruimOp() hoort het kind te beeindigen');
  const na = B.magStarten('proefronde');
  assert.equal(na.mag, false, 'een lege proceskring maakt een niet-afgemaakte ronde niet alsnog geslaagd');

  doodMaken(kind);
  fs.rmSync(map, { recursive: true, force: true });
});

test('3. SABOTAGE B -- de ronde schrijft NETJES ABORTED maar laat een kind staan', () => {
  /* De scherpste van de twee: de werkstatus klopt en is eerlijk. Toch mag er
     niets starten, want het kind houdt poorten en bestanden vast en de volgende
     meting zou daar langs meten. */
  const { A, pad, map } = verse();
  const kind = langLevendKind();
  fs.writeFileSync(pad, JSON.stringify({
    runId: 'run-sabotage-b', taak: 'proefronde', stand: 'ABORTED',
    gestart: new Date().toISOString(), geeindigd: new Date().toISOString(),
    wortel: { pid: 999998, start: 12345 },
    kring: [{ pid: kind, start: null }]
  }));
  delete require.cache[require.resolve(MODULE)];
  const B = require(MODULE);

  const g = B.magStarten('proefronde');
  assert.equal(g.mag, false, 'een terminale ronde met een levend kind hoort te blokkeren');
  assert.match(g.reden, /leven nog|proces\(sen\)/);
  assert.ok(g.wezen.some(w => w.pid === kind), 'de weigering hoort het kind bij naam te noemen');

  doodMaken(kind);
  fs.rmSync(map, { recursive: true, force: true });
});

test('4. na opruimen slaat de poort wel om -- anders bewijst hij alleen dat hij dicht zit', () => {
  const { pad, map } = verse();
  const kind = langLevendKind();
  fs.writeFileSync(pad, JSON.stringify({
    runId: 'run-omslag', taak: 'proefronde', stand: 'PASSED',
    gestart: new Date().toISOString(), geeindigd: new Date().toISOString(),
    wortel: { pid: 999997, start: 12345 },
    kring: [{ pid: kind, start: null }]
  }));
  delete require.cache[require.resolve(MODULE)];
  const B = require(MODULE);

  assert.equal(B.magStarten('proefronde').mag, false, 'met een levend kind nog dicht');
  const geraakt = B.ruimOp();
  assert.ok(geraakt.includes(kind), 'ruimOp() hoort te melden wat hij raakte');
  assert.equal(wachtTotDood(kind), true, 'en het kind hoort daarna werkelijk weg te zijn');
  const na = B.magStarten('proefronde');
  assert.equal(na.mag, true, 'PASSED met een lege proceskring hoort door te laten: ' + na.reden);

  fs.rmSync(map, { recursive: true, force: true });
});

test('5. een hergebruikt PID wordt niet voor een oud kind aangezien', () => {
  /* Zonder deze regel ruimt de opvolger een wildvreemd proces op dat toevallig
     hetzelfde nummer erfde. Het onderscheid is de STARTTIJD uit /proc. */
  const { pad, map } = verse();
  const kind = langLevendKind();
  const echteStart = (() => {
    const stat = fs.readFileSync('/proc/' + kind + '/stat', 'utf8');
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
  })();
  fs.writeFileSync(pad, JSON.stringify({
    runId: 'run-hergebruik', taak: 'proefronde', stand: 'PASSED',
    gestart: new Date().toISOString(), geeindigd: new Date().toISOString(),
    wortel: { pid: 999996, start: 12345 },
    // hetzelfde PID, maar een starttijd die NIET klopt: dus een ander proces
    kring: [{ pid: kind, start: echteStart + 100000 }]
  }));
  delete require.cache[require.resolve(MODULE)];
  const B = require(MODULE);

  assert.deepEqual(B.wezenVan(B.lees()), [],
    'een PID met een andere starttijd is een ander proces en telt niet als wees');
  assert.equal(B.magStarten('proefronde').mag, true, 'en blokkeert dus ook niet');
  assert.deepEqual(B.ruimOp(), [], 'en wordt vooral NIET opgeruimd');
  assert.equal(leeft(kind), true, 'het vreemde proces hoort ongemoeid te blijven');

  doodMaken(kind);
  fs.rmSync(map, { recursive: true, force: true });
});

test('6. klaar() weigert een niet-terminale stand', () => {
  const { A, map } = verse();
  const r = A.begin({ taak: 'proefronde' });
  assert.throws(() => r.klaar('RUNNING'), /terminale stand/);
  r.klaar('FAILED');
  fs.rmSync(map, { recursive: true, force: true });
});
