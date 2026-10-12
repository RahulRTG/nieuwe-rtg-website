/* DE AFLOOP VAN EEN AFBOUW, TAK VOOR TAK (scripts/lib/afbouw-afloop.js).

   test/afbouwafloop.test.js bewijst de twee sabotages met echte wezen. Hier
   staan de andere uitslagen van dezelfde poort: een vorige ronde van een
   ANDERE taak, een RUNNING-stand met een levende of dode wortel, een
   FAILED-ronde die wel vrijgeeft maar niet als bewijs telt, de eigen controle
   binnen een releasepoort, de diagnose, herstel() met elk van zijn
   weigeringen, en begin() met hartslag, extra velden en de afloop bij exit of
   signaal (in een eigen kindproces, want dit proces mag niet stoppen).

   Het afloopbestand en het slot staan in een tijdelijke map (PROEFMAP), via
   RTG_AFLOOP_PAD en RTG_AFBOUW_SLOT; die worden na afloop teruggezet. Het
   enige proces dat ruimOp() mag doden is een kind dat deze toets zelf start.

   Los: node --test test/afbouw-afloop-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afloop-tak-'));
const AFLOOP_PAD = path.join(PROEFMAP, 'afloop.json');
const SLOT_PAD = path.join(PROEFMAP, 'slot');
const MODULE = path.join(__dirname, '..', 'scripts', 'lib', 'afbouw-afloop.js');
const OUD = {};
for (const k of ['RTG_AFLOOP_PAD', 'RTG_AFBOUW_SLOT', 'RTG_AFBOUW_SLOT_ACTIEF', 'RTG_AFBOUW_RUN_ID', 'RTG_AFLOOP_HARTSLAG']) OUD[k] = process.env[k];
process.env.RTG_AFLOOP_PAD = AFLOOP_PAD;
process.env.RTG_AFBOUW_SLOT = SLOT_PAD;
delete require.cache[require.resolve('../scripts/lib/afbouw-afloop')];
delete require.cache[require.resolve('../scripts/afbouw-slot')];
const A = require('../scripts/lib/afbouw-afloop');
test.after(() => {
  for (const [k, v] of Object.entries(OUD)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  fs.rmSync(PROEFMAP, { recursive: true, force: true });
});

const zet = (o) => fs.writeFileSync(AFLOOP_PAD, JSON.stringify(o));
const merk = (pid) => ({ pid, start: A.procesStart(pid) });
function dodePid() {
  const r = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  return Number(r.stdout.trim());
}
function wachtTotDood(pid, ms = 3000) {
  const eind = Date.now() + ms;
  while (Date.now() < eind && A.procesLeeft(pid)) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},25)']);
  return !A.procesLeeft(pid);
}

test('procesLeeft en zelfdeProces: ongeldige pids, een dood proces en een andere starttijd', () => {
  for (const p of [1, 0, -4, 2.5, NaN, 'x']) assert.equal(A.procesLeeft(p), false, String(p));
  assert.equal(A.procesLeeft(process.pid), true);
  assert.equal(A.procesLeeft(dodePid()), false);
  assert.equal(A.zelfdeProces(null), false);
  assert.equal(A.zelfdeProces({ pid: dodePid(), start: 1 }), false);
  assert.equal(A.zelfdeProces({ pid: process.pid, start: null }), true, 'zonder starttijd het voorzichtige oude gedrag');
  assert.equal(A.zelfdeProces(merk(process.pid)), true);
  if (A.procesStart(process.pid) != null) {
    assert.equal(A.zelfdeProces({ pid: process.pid, start: A.procesStart(process.pid) + 1 }), false,
      'een hergebruikt pid met een andere starttijd is niet hetzelfde proces');
  }
});

test('wezenVan: alleen de leden van de kring die nog dezelfde processen zijn', () => {
  assert.deepEqual(A.wezenVan(null), []);
  assert.deepEqual(A.wezenVan({}), []);
  const levend = merk(process.pid);
  assert.deepEqual(A.wezenVan({ kring: [levend, { pid: dodePid(), start: 5 }] }), [levend]);
});

test('magStarten: zonder afloop, bij een andere taak, en bij elke opgeslagen stand', () => {
  fs.rmSync(AFLOOP_PAD, { force: true });
  assert.deepEqual(A.magStarten('x'), { mag: true, reden: 'geen eerdere ronde vastgelegd' });
  fs.writeFileSync(AFLOOP_PAD, '{kapot');
  assert.equal(A.lees(), null);
  assert.equal(A.magStarten('x').mag, true);

  const ik = merk(process.pid);
  zet({ taak: 'ijking', stand: 'RUNNING', wortel: ik, kring: [] });
  const leegAnders = A.magStarten('meetronde');
  assert.equal(leegAnders.mag, true);
  assert.match(leegAnders.reden, /andere taak \(ijking\) en haar proceskring is leeg/);
  zet({ taak: 'ijking', stand: 'RUNNING', wortel: ik, kring: [ik] });
  const volAnders = A.magStarten('meetronde');
  assert.equal(volAnders.mag, false);
  assert.equal(volAnders.wezen.length, 1);
  assert.equal(volAnders.stand, 'RUNNING');

  const loopt = A.magStarten();
  assert.equal(loopt.oordeel, 'LOOPT');
  assert.match(loopt.reden, new RegExp('loopt nog \\(ijking, PID ' + process.pid + '\\)'));
  zet({ taak: 'ijking', stand: 'RUNNING', wortel: { pid: dodePid(), start: 1 }, kring: [] });
  const weg = A.magStarten('ijking');
  assert.equal(weg.oordeel, 'ONVOLTOOID');
  assert.equal(weg.mag, false);
  assert.match(weg.reden, /gestorven zonder eigen afloop/);

  zet({ taak: 'ijking', stand: 'PASSED', wortel: ik, kring: [ik] });
  const vuil = A.magStarten('ijking');
  assert.equal(vuil.oordeel, 'VUILE_RUNTIME');
  assert.match(vuil.reden, /is PASSED maar 1 proces/);
  zet({ taak: 'ijking', stand: 'FAILED', wortel: ik, kring: [] });
  const gefaald = A.magStarten('ijking');
  assert.equal(gefaald.mag, true);
  assert.equal(gefaald.resultaatBruikbaar, false);
  assert.match(gefaald.reden, /eindigde op FAILED.*UITKOMST telt niet als bewijs/);
  zet({ taak: 'ijking', stand: 'PASSED', wortel: ik, kring: [] });
  assert.equal(A.magStarten('ijking').resultaatBruikbaar, true);
});

test('magControleren: de eigen releasepoort mag controleren, iedereen anders volgt magStarten', () => {
  const ouder = merk(process.ppid);
  const runId = 'run-takproef';
  zet({ taak: 'releasepoort', stand: 'RUNNING', runId, wortel: ouder, kring: [] });
  fs.mkdirSync(SLOT_PAD, { recursive: true });
  fs.writeFileSync(path.join(SLOT_PAD, 'eigenaar.json'), JSON.stringify({ pid: ouder.pid, start: ouder.start, taak: 'releasepoort' }));
  try {
    process.env.RTG_AFBOUW_SLOT_ACTIEF = '1';
    process.env.RTG_AFBOUW_RUN_ID = runId;
    const eigen = A.magControleren();
    assert.equal(eigen.oordeel, 'EIGEN_CONTROLE');
    assert.equal(eigen.mag, true);
    assert.equal(eigen.resultaatBruikbaar, false);
    process.env.RTG_AFBOUW_RUN_ID = 'run-anders';
    assert.equal(A.magControleren().oordeel, 'LOOPT', 'een andere run is geen eigen controle');
    process.env.RTG_AFBOUW_RUN_ID = runId;
    /* Een wortel die geen voorouder is: deze toets zelf, met het slot op zijn naam. */
    const ik = merk(process.pid);
    zet({ taak: 'releasepoort', stand: 'RUNNING', runId, wortel: ik, kring: [] });
    fs.writeFileSync(path.join(SLOT_PAD, 'eigenaar.json'), JSON.stringify({ pid: ik.pid, start: ik.start, taak: 'releasepoort' }));
    assert.equal(A.magControleren().oordeel, 'LOOPT');
  } finally {
    delete process.env.RTG_AFBOUW_SLOT_ACTIEF;
    delete process.env.RTG_AFBOUW_RUN_ID;
    fs.rmSync(SLOT_PAD, { recursive: true, force: true });
  }
  zet({ taak: 'meetronde', stand: 'PASSED', wortel: merk(process.pid), kring: [] });
  assert.equal(A.magControleren().oordeel, 'PASSED', 'zonder slot gewoon de poort vooraf');
});

test('diagnose noemt run, stand, kinderen en de juiste vervolgstap', () => {
  const met = A.diagnose({ oordeel: 'VUILE_RUNTIME', reden: 'r1', wezen: [{ pid: 11, start: 22 }] },
    { runId: 'run-1', taak: 'ijking', stand: 'ABORTED', gestart: 'g', geeindigd: 'e' });
  assert.match(met, /vorige run: +run-1 +\(ijking\)/);
  assert.match(met, /opgeslagen stand: ABORTED  gestart g, geeindigd e/);
  assert.match(met, /levende kinderen: 1  ->  pid 11 \(start 22\)/);
  assert.match(met, /ruim eerst op met ruimOp\(\)/);
  const zonder = A.diagnose({ reden: 'r2' }, null);
  assert.match(zonder, /vorige run: +\? +\(onbenoemd\)/);
  assert.match(zonder, /opgeslagen stand: \?, nooit afgerond/);
  assert.match(zonder, /oordeel: +\?/);
  assert.match(zonder, /levende kinderen: 0\n/);
  assert.match(zonder, /herstel\(\{ stand: 'ABORTED'/);
});

test('herstel: alleen ABORTED of FAILED, met reden, op een ronde zonder levende kinderen', () => {
  assert.throws(() => A.herstel(), /als ABORTED of FAILED/);
  assert.throws(() => A.herstel({ stand: 'PASSED', reden: 'mag niet' }), /PASSED kan alleen de ronde zelf/);
  assert.throws(() => A.herstel({ stand: 'ABORTED', reden: ' kort ' }), /vraagt een reden/);
  assert.throws(() => A.herstel({ stand: 'ABORTED' }), /vraagt een reden/);
  fs.rmSync(AFLOOP_PAD, { force: true });
  assert.throws(() => A.herstel({ stand: 'ABORTED', reden: 'geen ronde' }), /geen ronde om te herstellen/);
  zet({ taak: 't', stand: 'RUNNING', wortel: { pid: dodePid(), start: 1 }, kring: [merk(process.pid)] });
  assert.throws(() => A.herstel({ stand: 'FAILED', reden: 'kind leeft' }), /er leven nog 1 proces/);
  zet({ taak: 't', stand: 'RUNNING', wortel: { pid: dodePid(), start: 1 }, kring: [] });
  const h = A.herstel({ stand: 'FAILED', reden: 'met de hand gesloten' });
  assert.equal(h.stand, 'FAILED');
  assert.equal(h.hersteld.door, 'onbekend');
  assert.equal(h.hersteld.wasStand, 'RUNNING');
  assert.ok(h.geeindigd);
  zet({ taak: 't', stand: 'ABORTED', geeindigd: 'toen', wortel: { pid: dodePid(), start: 1 } });
  const h2 = A.herstel({ stand: 'ABORTED', reden: 'nogmaals gesloten', door: 'Rahul' });
  assert.equal(h2.geeindigd, 'toen', 'een bestaande eindtijd blijft staan');
  assert.equal(h2.hersteld.door, 'Rahul');
});

test('ruimOp doodt alleen wat er van de kring nog leeft, en schrijft dat op', async () => {
  fs.rmSync(AFLOOP_PAD, { force: true });
  assert.deepEqual(A.ruimOp(), []);
  assert.equal(fs.existsSync(AFLOOP_PAD), false, 'zonder afloop wordt er niets geschreven');
  const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    await new Promise(r => setTimeout(r, 50));
    zet({ taak: 't', stand: 'ABORTED', wortel: { pid: dodePid(), start: 1 }, kring: [merk(kind.pid), { pid: dodePid(), start: 3 }] });
    const geraakt = A.ruimOp();
    assert.deepEqual(geraakt, [kind.pid]);
    assert.deepEqual(A.lees().opgeruimd.geraakt, [kind.pid]);
    await new Promise(r => kind.once('exit', r));
    assert.equal(kind.signalCode, 'SIGKILL');
  } finally { try { kind.kill('SIGKILL'); } catch (e) {} }
});

test('kringVan vindt een eigen kind, en een proces zonder kinderen heeft een lege kring', async () => {
  const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    await new Promise(r => setTimeout(r, 50));
    const kring = A.kringVan(process.pid);
    assert.ok(kring.some(k => k.pid === kind.pid), JSON.stringify(kring));
    assert.equal(A.kringVan(kind.pid).length, 0);
  } finally { kind.kill('SIGKILL'); }
  assert.ok(wachtTotDood(kind.pid));
});

test('begin: hartslag met kring, klaar met extra velden, en geen tweede afloop', async () => {
  process.env.RTG_AFLOOP_HARTSLAG = '15';
  let ronde;
  const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    ronde = A.begin({ taak: 'takproef', commit: 'abc', basis: 'http://127.0.0.1:1', verwachteUitvoer: ['X.json'], poorten: [1] });
    assert.match(ronde.runId, /^run-[a-z0-9]+-[a-z0-9]+$/);
    const begin = A.lees();
    assert.equal(begin.stand, 'RUNNING');
    assert.deepEqual(begin.verwachteUitvoer, ['X.json']);
    const eind = Date.now() + 3000;
    while (Date.now() < eind && !(A.lees().kringGepeild)) await new Promise(r => setTimeout(r, 10));
    assert.ok(A.lees().kringGepeild, 'de hartslag peilt de kring');
    assert.ok(A.lees().kring.some(k => k.pid === kind.pid), 'en vindt het levende kind');
    assert.throws(() => ronde.klaar('RUNNING'), /terminale stand/);
    assert.throws(() => ronde.klaar('KLAAR'), /terminale stand/);
    ronde.klaar('FAILED', { uitvoer: ['X.json'], forceerKill: true, extra: { reden: 'proef' } });
    const af = A.lees();
    assert.equal(af.stand, 'FAILED');
    assert.deepEqual(af.uitvoer, ['X.json']);
    assert.equal(af.forceerKill, true);
    assert.equal(af.reden, 'proef');
    ronde.klaar('PASSED');
    assert.equal(A.lees().stand, 'FAILED', 'een afgesloten ronde wordt niet opnieuw afgesloten');
  } finally { kind.kill('SIGKILL'); delete process.env.RTG_AFLOOP_HARTSLAG; }
  /* Zonder opties: standaardwaarden, en een hartslag die niets meer doet zodra
     het bestand van een andere ronde is. */
  const kaal = A.begin();
  const k = A.lees();
  assert.equal(k.taak, 'onbenoemd');
  assert.equal(k.commit, null);
  assert.deepEqual(k.poorten, []);
  kaal.klaar('ABORTED');
  assert.equal(A.lees().uitvoer, null);
  assert.equal(A.lees().forceerKill, false);
});

/* De afloop bij het einde van het proces: in een kind, met zijn eigen bestand. */
function kindRonde(regel, opties = {}) {
  const pad = path.join(PROEFMAP, 'kind-' + Math.random().toString(36).slice(2) + '.json');
  /* Het pad van de module gaat als argument mee en niet als tekst in de code. */
  const code = 'const A = require(process.argv[1]); ' + regel;
  return { pad, kind: spawn(process.execPath, ['-e', code, MODULE], { stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, RTG_AFLOOP_PAD: pad, RTG_AFLOOP_HARTSLAG: '', ...(opties.env || {}) } }) };
}
const afgelopen = (kind) => new Promise(r => kind.once('exit', (code, sig) => r({ code, sig })));
const lees = (pad) => JSON.parse(fs.readFileSync(pad, 'utf8'));

test('bij exit: uitExitcode maakt van 0 PASSED en van 1 FAILED, zonder wordt het ABORTED', async () => {
  const gevallen = [
    ["A.begin({ taak: 'k', uitExitcode: true }); process.exit(0);", 0, 'PASSED'],
    ["A.begin({ taak: 'k', uitExitcode: true }); process.exit(1);", 1, 'FAILED'],
    ["A.begin({ taak: 'k' }); process.exit(0);", 0, 'ABORTED']
  ];
  for (const [regel, code, stand] of gevallen) {
    const { pad, kind } = kindRonde(regel);
    const r = await afgelopen(kind);
    assert.equal(r.code, code, regel);
    assert.equal(lees(pad).stand, stand, regel);
    assert.ok(lees(pad).geeindigd);
  }
});

test('een signaal sluit de ronde als ABORTED en het proces met 128 + signaal', async () => {
  const { pad, kind } = kindRonde("A.begin({ taak: 'sig', uitExitcode: true }); console.log('klaar'); setInterval(() => {}, 1000);");
  await new Promise(r => kind.stdout.once('data', r));
  const einde = afgelopen(kind);
  kind.kill('SIGTERM');
  const r = await einde;
  assert.equal(r.code, 143);
  assert.equal(lees(pad).stand, 'ABORTED', 'een onderbroken ronde is nooit PASSED, ook niet met uitExitcode');
});
