/* PROCESGEGEVENS OP ELK PLATFORM (scripts/lib/procinfo.js).

   Zes scripts lazen /proc rechtstreeks, en een toets sloeg zichzelf zonder /proc
   stil over. Deze toets beproeft BEIDE wegen op deze machine: de /proc-lezing
   (waar die er is) en de terugval via ps en pgrep, door de module een
   procwortel te geven die niet bestaat. Zo is de macOS-weg ook op een
   Linux-runner bewezen, in plaats van aangenomen.

   Draai los: node --test test/procinfo.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const procinfo = require('../scripts/lib/procinfo');

/* Geen overgeslagen toets: de /proc-weg bestaat alleen op Linux, en waar hij
   ontbreekt beweert de eerste toets dat EXPLICIET (heeftProc is nee, en de
   standaardmodule geeft dezelfde antwoorden als de terugvalweg) in plaats van
   stil groen te staan. De terugvalweg via ps en pgrep draait overal. */
const MET_PROC = fs.existsSync('/proc/self/stat');
const ZONDER = procinfo.maak({ procWortel: '/bestaat/bewust/niet' });
const WEGEN = [['via /proc', procinfo], ['via ps en pgrep (zonder /proc)', ZONDER]];

test('zonder /proc is dat een vastgestelde eigenschap, geen stille overslag', () => {
  assert.equal(procinfo.heeftProc(), MET_PROC, 'heeftProc zegt wat de schijf zegt');
  if (MET_PROC) return;   // Linux: de /proc-weg wordt hieronder volledig beproefd
  // geen /proc (macOS, BSD): de standaardmodule IS dan de terugvalweg
  assert.equal(procinfo.procesStart(process.pid), ZONDER.procesStart(process.pid));
  assert.equal(procinfo.ouderVan(process.pid), ZONDER.ouderVan(process.pid));
});

for (const [naam, p] of WEGEN) {
  test(naam + ': starttijd, ouder, zombie, geheugen en rekentijd van het eigen proces', () => {
    const s = p.procesStart(process.pid);
    assert.ok(Number.isFinite(s) && s > 0, 'een starttijd: ' + s);
    assert.equal(p.procesStart(process.pid), s, 'dezelfde instantie, dezelfde starttijd');
    assert.equal(p.ouderVan(process.pid), process.ppid, 'de ouder');
    assert.equal(p.isZombie(process.pid), false, 'een levend proces is geen zombie');
    const kb = p.rssKB(process.pid);
    assert.ok(Number.isFinite(kb) && kb > 1000, 'werkgeheugen in kB: ' + kb);
    const cpu = p.cpuSeconden(process.pid);
    assert.ok(Number.isFinite(cpu) && cpu >= 0, 'rekentijd in seconden: ' + cpu);
  });

  test(naam + ': een kind staat in de kinderlijst, een ander proces heeft een andere starttijd', async () => {
    const kind = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'ignore' });
    try {
      await new Promise(r => setTimeout(r, 150));
      const k = p.kinderen(process.pid);
      assert.ok(k.pids.includes(kind.pid), 'het kind ' + kind.pid + ' staat in ' + JSON.stringify(k.pids));
      assert.equal(p.ouderVan(kind.pid), process.pid);
      assert.ok(Number.isFinite(p.procesStart(kind.pid)), 'ook het kind heeft een starttijd');
    } finally { kind.kill('SIGKILL'); }
  });
}

test('zonder /proc zegt heeftProc nee, en een onbekend PID geeft null en geen verzonnen nul', () => {
  const zonder = procinfo.maak({ procWortel: '/bestaat/bewust/niet' });
  assert.equal(zonder.heeftProc(), false);
  const weg = 2 ** 22 + 12345;   // boven pid_max van elk gangbaar systeem
  for (const p of [procinfo, zonder]) {
    assert.equal(p.procesStart(weg), null);
    assert.equal(p.rssKB(weg), null);
    assert.equal(p.cpuSeconden(weg), null);
    assert.equal(p.ouderVan(weg), 0);
    assert.deepEqual(p.kinderen(weg).pids, []);
  }
});
