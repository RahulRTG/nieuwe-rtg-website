'use strict';
/* ============================================================================
   PROCINFO -- DE RANDGEVALLEN VAN /proc EN VAN DE TERUGVAL

   procinfo.test.js beproeft beide wegen op het eigen, levende proces. Dit
   bestand geeft de module een NAGEMAAKTE procwortel (met een zombie, een
   ouderloos proces en een starttijd nul) en een nagemaakte `ps`, `pgrep` en
   `getconf` op het PATH. Zo krijgt elke ontleding een vaste invoer: dagen in
   `ps time`, een rss van nul, een lstart die geen datum is, een getconf die
   onzin zegt of ontbreekt. Steeds geldt: null is "niet vast te stellen",
   nooit een verzonnen nul.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const procinfo = require('../scripts/lib/procinfo');

const OUD_PATH = process.env.PATH;
const NEP_SLEUTELS = ['NEP_LSTART', 'NEP_PPID', 'NEP_STAT', 'NEP_RSS', 'NEP_TIME', 'NEP_EXIT', 'NEP_PGREP', 'NEP_PGREP_EXIT', 'NEP_CLK'];
let tmp, bin, wortel;

/* Een stat-regel met de procesnaam tussen haakjes (met spatie en haakje erin,
   zoals de kernel dat toestaat) en de velden die de module leest. */
function statRegel({ stand = 'S', ouder = 1, utime = 0, stime = 0, start = 0 }) {
  const velden = new Array(20).fill('0');
  velden[0] = stand; velden[1] = String(ouder); velden[11] = String(utime); velden[12] = String(stime); velden[19] = String(start);
  return '4242 (rare (naam) x) ' + velden.join(' ') + '\n';
}

test.before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-procinfo-'));
  bin = path.join(tmp, 'bin');
  wortel = path.join(tmp, 'proc');
  fs.mkdirSync(bin);
  const sh = (naam, inhoud) => { fs.writeFileSync(path.join(bin, naam), '#!/bin/sh\n' + inhoud + '\n', { mode: 0o755 }); };
  sh('ps', [
    'veld=${2%=}',
    'case "$veld" in',
    '  lstart) printf "%s\\n" "$NEP_LSTART";;',
    '  ppid) printf "%s\\n" "$NEP_PPID";;',
    '  stat) printf "%s\\n" "$NEP_STAT";;',
    '  rss) printf "%s\\n" "$NEP_RSS";;',
    '  time) printf "%s\\n" "$NEP_TIME";;',
    'esac',
    'exit ${NEP_EXIT:-0}'].join('\n'));
  sh('pgrep', 'printf "%s\\n" "$NEP_PGREP"\nexit ${NEP_PGREP_EXIT:-0}');
  sh('getconf', 'printf "%s\\n" "$NEP_CLK"');

  /* proces 10: zombie, ouder 7, rekentijd 150+50 ticks, starttijd 999 */
  fs.mkdirSync(path.join(wortel, '10', 'task', '10'), { recursive: true });
  fs.writeFileSync(path.join(wortel, '10', 'stat'), statRegel({ stand: 'Z', ouder: 7, utime: 150, stime: 50, start: 999 }));
  fs.writeFileSync(path.join(wortel, '10', 'task', '10', 'children'), '11 12 \n');
  fs.writeFileSync(path.join(wortel, '10', 'status'), 'Name:\tx\nVmRSS:\t   2048 kB\n');
  /* proces 20: ouder 0, starttijd 0, geen VmRSS-regel, geen kinderen */
  fs.mkdirSync(path.join(wortel, '20', 'task', '20'), { recursive: true });
  fs.writeFileSync(path.join(wortel, '20', 'stat'), statRegel({ ouder: 0, start: 0 }));
  fs.writeFileSync(path.join(wortel, '20', 'task', '20', 'children'), '');
  fs.writeFileSync(path.join(wortel, '20', 'status'), 'Name:\ty\n');
  /* self/stat, zodat heeftProc ja zegt */
  fs.mkdirSync(path.join(wortel, 'self'));
  fs.writeFileSync(path.join(wortel, 'self', 'stat'), statRegel({}));
});

test.after(() => {
  process.env.PATH = OUD_PATH;
  for (const k of NEP_SLEUTELS) delete process.env[k];
  fs.rmSync(tmp, { recursive: true, force: true });
});

/* Zet de nep-uitvoer en alleen de nep-map op het PATH, voor de duur van fn. */
function metNep(waarden, fn) {
  const oud = {};
  for (const k of NEP_SLEUTELS) { oud[k] = process.env[k]; delete process.env[k]; }
  Object.assign(process.env, waarden);
  process.env.PATH = bin;
  try { return fn(); } finally {
    process.env.PATH = OUD_PATH;
    for (const k of NEP_SLEUTELS) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; }
  }
}

test('een nagemaakte /proc: zombie, ouder, kinderen, geheugen en rekentijd uit de velden', () => {
  const p = metNep({ NEP_CLK: '100' }, () => procinfo.maak({ procWortel: wortel }));
  assert.equal(p.CLK, 100);
  assert.equal(p.heeftProc(), true);
  assert.equal(p.isZombie(10), true, 'stand Z is een zombie, ook met haakjes in de naam');
  assert.equal(p.ouderVan(10), 7);
  assert.equal(p.procesStart(10), 999);
  assert.deepEqual(p.kinderen(10), { viaProc: true, pids: [11, 12] });
  assert.equal(p.rssKB(10), 2048);
  assert.equal(p.cpuSeconden(10), 2, '(150 + 50) ticks / 100');
});

test('een starttijd of ouder van nul wordt null en 0, en een lege kinderlijst is leeg', () => {
  const p = metNep({ NEP_CLK: '250' }, () => procinfo.maak({ procWortel: wortel }));
  assert.equal(p.CLK, 250);
  assert.equal(p.procesStart(20), null, 'nul is geen starttijd');
  assert.equal(p.ouderVan(20), 0);
  assert.equal(p.isZombie(20), false);
  assert.deepEqual(p.kinderen(20), { viaProc: true, pids: [] });
});

test('zonder VmRSS-regel valt rssKB terug op ps, en een rss van nul is null', () => {
  const p = metNep({ NEP_CLK: '100' }, () => procinfo.maak({ procWortel: wortel }));
  assert.equal(metNep({ NEP_RSS: '512 extra' }, () => p.rssKB(20)), 512);
  assert.equal(metNep({ NEP_RSS: '0' }, () => p.rssKB(20)), null);
  assert.equal(metNep({ NEP_RSS: 'geen' }, () => p.rssKB(20)), null);
});

test('getconf met onzin of zonder getconf valt terug op 100 klokticks', () => {
  assert.equal(metNep({ NEP_CLK: 'onzin' }, () => procinfo.maak({ procWortel: wortel })).CLK, 100);
  const zonderGetconf = path.join(tmp, 'leeg');
  fs.mkdirSync(zonderGetconf, { recursive: true });
  process.env.PATH = zonderGetconf;
  try { assert.equal(procinfo.maak({ procWortel: wortel }).CLK, 100); }
  finally { process.env.PATH = OUD_PATH; }
});

test('terugval via ps: lstart, ppid en stat worden ontleed', () => {
  const p = metNep({ NEP_CLK: '100' }, () => procinfo.maak({ procWortel: path.join(tmp, 'geen-proc') }));
  assert.equal(p.heeftProc(), false);
  const t = metNep({ NEP_LSTART: 'Mon Jan  5 10:00:00 2026' }, () => p.procesStart(5));
  assert.equal(t, Date.parse('Mon Jan  5 10:00:00 2026'));
  assert.equal(metNep({ NEP_LSTART: 'geen datum' }, () => p.procesStart(5)), null);
  assert.equal(metNep({ NEP_PPID: '  33 ' }, () => p.ouderVan(5)), 33);
  assert.equal(metNep({ NEP_PPID: 'x' }, () => p.ouderVan(5)), 0);
  assert.equal(metNep({ NEP_STAT: 'Zs' }, () => p.isZombie(5)), true);
  assert.equal(metNep({ NEP_STAT: 'Ss' }, () => p.isZombie(5)), false);
  assert.equal(metNep({ NEP_EXIT: '1' }, () => p.isZombie(5)), null, 'ps die faalt zegt niets: null');
  assert.equal(metNep({ NEP_EXIT: '1' }, () => p.procesStart(5)), null);
  assert.equal(metNep({ NEP_EXIT: '1' }, () => p.ouderVan(5)), 0);
  assert.equal(metNep({ NEP_EXIT: '1' }, () => p.rssKB(5)), null);
});

test('terugval via ps time: seconden, minuten, uren en dagen', () => {
  const p = metNep({ NEP_CLK: '100' }, () => procinfo.maak({ procWortel: path.join(tmp, 'geen-proc') }));
  assert.equal(metNep({ NEP_TIME: '42' }, () => p.cpuSeconden(5)), 42);
  assert.equal(metNep({ NEP_TIME: '03:04' }, () => p.cpuSeconden(5)), 184);
  assert.equal(metNep({ NEP_TIME: '02:03:04' }, () => p.cpuSeconden(5)), 2 * 3600 + 3 * 60 + 4);
  assert.equal(metNep({ NEP_TIME: '1-00:00:10' }, () => p.cpuSeconden(5)), 86400 + 10);
  assert.equal(metNep({ NEP_TIME: 'x-00:00:10' }, () => p.cpuSeconden(5)), null, 'een onleesbaar dagdeel is null');
  assert.equal(metNep({ NEP_TIME: '' }, () => p.cpuSeconden(5)), 0, 'een leeg veld telt als nul seconden');
  assert.equal(metNep({ NEP_EXIT: '1' }, () => p.cpuSeconden(5)), null);
});

test('terugval via pgrep: treffers worden getallen, een exitcode 1 is geen kinderen', () => {
  const p = metNep({ NEP_CLK: '100' }, () => procinfo.maak({ procWortel: path.join(tmp, 'geen-proc') }));
  assert.deepEqual(metNep({ NEP_PGREP: '7\n8\n' }, () => p.kinderen(5)), { viaProc: false, pids: [7, 8] });
  assert.deepEqual(metNep({ NEP_PGREP_EXIT: '1' }, () => p.kinderen(5)), { viaProc: false, pids: [] });
});
