/* HET STEMPEL, TAK VOOR TAK.

   test/stempel.test.js en test/schoneboom.test.js houden de hoofdlijn vast:
   wat als code telt en dat de poort vooraf bestaat. Hier staan de zijpaden die
   daar ongemeten bleven -- een hernoeming in de porcelain-uitvoer, een stempel
   buiten elke repo, een afbouw die de poort dichthoudt, de vier redenen
   waarom een register NIET vers is, en de twee vormen waarin een register zijn
   stempel bewaart. Elke Git-bewering die iets verandert, loopt in een eigen
   tijdelijke repository (PROEFMAP); tegen de echte boom wordt alleen gelezen.

   Los: node --test test/stempel-takken.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const st = require('../scripts/lib/stempel');

function git(map, args) {
  return execFileSync('git', args, { cwd: map, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function metRepo(doe) {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stempeltak-'));
  try {
    fs.mkdirSync(path.join(PROEFMAP, 'server'), { recursive: true });
    fs.writeFileSync(path.join(PROEFMAP, 'server/a.js'), 'module.exports = 1;\n');
    fs.writeFileSync(path.join(PROEFMAP, 'LEESMIJ.txt'), 'x\n');
    git(PROEFMAP, ['init', '--quiet']);
    git(PROEFMAP, ['add', '.']);
    git(PROEFMAP, ['-c', 'user.name=RTG Test', '-c', 'user.email=test@rtg.invalid',
      'commit', '--quiet', '-m', 'basis']);
    return doe(PROEFMAP);
  } finally {
    fs.rmSync(PROEFMAP, { recursive: true, force: true });
  }
}

function metEnv(vars, doe) {
  const oud = {};
  for (const k of Object.keys(vars)) {
    oud[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k];
  }
  try { return doe(); } finally {
    for (const k of Object.keys(oud)) {
      if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k];
    }
  }
}

test('isCodePad: Windows-schuine strepen, compose-overlays en een leeg pad', () => {
  assert.equal(st.isCodePad('server\\kern\\x.js'), true);
  assert.equal(st.isCodePad('docker-compose.staging.yaml'), true);
  assert.equal(st.isCodePad('docker-compose.yml'), true);
  assert.equal(st.isCodePad('.github/workflows/ci.yml'), true);
  assert.equal(st.isCodePad('.github/CODEOWNERS'), false);
  assert.equal(st.isCodePad('serverx/a.js'), false, 'een voorvoegsel zonder schuine streep is geen map');
  assert.equal(st.isCodePad(null), false);
  assert.equal(st.isCodePad(undefined), false);
});

test('een hernoeming telt als code zodra een van beide kanten code is', () => {
  metRepo((PROEFMAP) => {
    git(PROEFMAP, ['mv', 'server/a.js', 'b.js']);
    git(PROEFMAP, ['mv', 'LEESMIJ.txt', 'LEES.txt']);
    const v = st.vuileBoom(PROEFMAP);
    assert.equal(v.code.length, 1, JSON.stringify(v));
    assert.match(v.code[0], /server\/a\.js -> b\.js/);
    assert.equal(v.anders.length, 1);
    assert.match(v.anders[0], /LEESMIJ\.txt -> LEES\.txt/);
  });
});

test('een schone tijdelijke repo: stempel zegt schoon en exactStempel geeft de volle hash', () => {
  metRepo((PROEFMAP) => {
    const s = st.stempel({ eigen: 7 }, { wortel: PROEFMAP });
    assert.equal(s.boomVuil, false);
    assert.equal(s.boomAnders, 0);
    assert.equal(s.eigen, 7, 'extra komt ongewijzigd mee');
    assert.match(s.commit, /^[0-9a-f]{4,}$/);
    assert.equal(s.node, process.version);
    const e = st.exactStempel({ eigen: 8 }, { wortel: PROEFMAP });
    assert.match(e.commit, /^[0-9a-f]{40}$/);
    assert.ok(e.commit.startsWith(s.commit));
    assert.equal(e.eigen, 8);
    /* Zonder extra en zonder opties: het stempel van de echte boom, en dat
       moet alleen de vorm hebben -- de inhoud hangt van de boom af. */
    const kaal = st.stempel();
    assert.equal(typeof kaal.op, 'string');
    assert.equal(kaal.invoer, undefined);
  });
});

test('buiten elke repo is exactStempel ONBEKEND en niet schoon', () => {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stempeltak-geen-'));
  try {
    const e = st.exactStempel(null, { wortel: PROEFMAP });
    assert.equal(e.commit, null);
    assert.equal(e.boomVuil, null);
    assert.equal(e.boomAnders, null);
  } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
});

test('het instrument komt uit process.argv[1]: in de repo een pad, erbuiten of zonder script null', () => {
  metRepo((PROEFMAP) => {
    const oud = process.argv[1];
    try {
      process.argv[1] = path.join(PROEFMAP, 'scripts', 'meet.js');
      assert.equal(st.stempel(null, { wortel: PROEFMAP }).instrument, 'scripts/meet.js');
      process.argv[1] = path.join(os.tmpdir(), 'ergens-anders.js');
      assert.equal(st.stempel(null, { wortel: PROEFMAP }).instrument, null);
      process.argv[1] = PROEFMAP;
      assert.equal(st.stempel(null, { wortel: PROEFMAP }).instrument, null, 'de wortel zelf is geen script');
      process.argv[1] = '';
      assert.equal(st.stempel(null, { wortel: PROEFMAP }).instrument, null);
    } finally { process.argv[1] = oud; }
  });
});

test('een spoor van gemeten invoer komt als blok in het stempel', () => {
  metRepo((PROEFMAP) => {
    const oud = global.__rtgInvoerspoor;
    global.__rtgInvoerspoor = { wortel: PROEFMAP, lees: ['server/a.js', 'uit.json'], schrijf: [],
      bestaat: [], mappen: new Map(), omgeving: new Map(), onwaarneembaar: new Set() };
    try {
      const s = st.stempel(null, { wortel: PROEFMAP, uitvoer: ['uit.json'] });
      assert.equal(s.invoer.meting, 'invoerspoor');
      assert.deepEqual(s.invoer.bestanden, ['server/a.js'], 'eigen uitvoer is geen invoer');
      assert.equal(s.invoer.boomVuil, false);
      const zonderUitvoer = st.stempel(null, { wortel: PROEFMAP });
      assert.deepEqual(zonderUitvoer.invoer.bestanden, ['server/a.js', 'uit.json']);
    } finally {
      if (oud === undefined) delete global.__rtgInvoerspoor; else global.__rtgInvoerspoor = oud;
    }
  });
});

test('een lopende afbouw houdt de poort vooraf dicht, nog voor git wordt gevraagd', () => {
  metEnv({ RTG_METEN_TIJDENS_AFBOUW: undefined, RTG_AFBOUW_SLOT_ACTIEF: undefined }, () => {
    const dicht = st.eisSchoneBoom('de proef', { afbouw: () => ({ taak: 'mutatiemotor', pid: 4242, gestart: 'nu' }) });
    assert.equal(dicht.ok, false);
    assert.equal(dicht.afbouw.pid, 4242);
    assert.match(dicht.reden, /mutatiemotor/);
  });
});

test('zonder afbouw volgt de poort precies wat vuileBoom over de echte boom zegt', () => {
  metEnv({ RTG_METEN_TIJDENS_AFBOUW: undefined, RTG_AFBOUW_SLOT_ACTIEF: undefined,
    RTG_METEN_OP_VUILE_BOOM: undefined }, () => {
    const u = st.eisSchoneBoom(undefined, { afbouw: () => null });
    const v = st.vuileBoom();
    if (v && v.code.length) {
      assert.equal(u.ok, false);
      assert.deepEqual(u.bestanden, v.code.slice(0, 8));
      assert.match(u.reden, /^deze meting zou/, 'zonder naam noemt de poort het "deze meting"');
    } else {
      assert.equal(u.ok, true);
      assert.equal(u.buitenDeCode, v ? v.anders.length : 0);
      assert.match(u.reden, /geen ongecommitte code/);
    }
  });
});

test('versheid: de vier redenen om NIET vers te zijn voordat git er aan te pas komt', () => {
  assert.match(st.versheid(null).reden, /geen stempel/);
  assert.match(st.versheid({}).reden, /geen stempel/);
  assert.match(st.versheid({ op: 'x' }).reden, /zonder commit/);
  const vuil = st.versheid({ op: 'x', commit: 'abc1234', boomVuil: true });
  assert.equal(vuil.vers, false);
  assert.match(vuil.reden, /ongecommit werk.*abc1234/);
});

test('versheid zonder opgegeven commit vergelijkt met HEAD', () => {
  const nu = st.nuCommit();
  assert.match(nu, /^[0-9a-f]{4,}$/);
  const v = st.versheid({ op: 'x', commit: nu, boomVuil: false });
  assert.equal(v.vers, true);
  assert.match(v.reden, /huidige commit/);
});

test('een commit die hier niet bestaat is niet vers, ook al geeft de diff niets', () => {
  const v = st.versheid({ op: 'x', commit: 'ffffffffffff', boomVuil: false }, st.nuCommit());
  assert.equal(v.vers, false);
  assert.match(v.reden, /niet meer bestaat/);
});

/* De historiegevallen: elk geval wordt uit de echte git-log gezocht, en de
   vergelijking gaat alsof die commit HEAD is (versheid neemt de huidige commit
   als argument). */
function commits(n, paden) {
  return git(st.WORTEL, ['log', '--format=%h', '-' + n, 'HEAD', '--'].concat(paden || []))
    .split('\n').filter(Boolean);
}
function eigenWijziging(c) {
  return git(st.WORTEL, ['diff', '--name-only', c + '^..' + c, '--'].concat(st.CODEPADEN))
    .split('\n').filter(Boolean);
}

test('een commit die alleen buiten de code iets raakt, laat een meting vers', () => {
  const geval = commits(400).find(c => eigenWijziging(c).length === 0 &&
    git(st.WORTEL, ['rev-list', '--parents', '-n', '1', c]).split(' ').length === 2);
  assert.ok(geval, 'geen commit buiten de code gevonden in de laatste 400');
  const v = st.versheid({ op: 'x', commit: geval + '^', boomVuil: false }, geval);
  assert.equal(v.vers, true, v.reden);
  assert.match(v.reden, /geen code gewijzigd$/);
});

test('een commit in server/ veroudert een meting, met of zonder kenbaar instrument', () => {
  const geval = commits(200, ['server']).find(c => eigenWijziging(c).some(f => f.startsWith('server/')));
  assert.ok(geval, 'geen servercommit gevonden');
  const aantal = eigenWijziging(geval).length;
  const kaal = st.versheid({ op: 'x', commit: geval + '^', boomVuil: false }, geval);
  assert.equal(kaal.vers, false);
  assert.match(kaal.reden, new RegExp('sindsdien zijn ' + aantal + ' codebestand'));
  /* Een instrument dat niet bestaat geeft een onbekende sluiting: dan telt alles. */
  const onbekend = st.versheid({ op: 'x', commit: geval + '^', boomVuil: false,
    instrument: 'scripts/bestaat-niet.js' }, geval);
  assert.equal(onbekend.vers, false);
  assert.match(onbekend.reden, new RegExp('sindsdien zijn ' + aantal + ' codebestand'));
  assert.doesNotMatch(onbekend.reden, /buiten dit instrument/);
});

test('scripts buiten het instrument worden apart genoemd als er toch code veranderde', () => {
  const instrument = 'scripts/lib/stempel.js';
  const sl = st.sluiting(instrument);
  assert.ok(sl && sl.has(instrument));
  let geval = null;
  for (const c of commits(600, ['server', 'scripts'])) {
    const g = eigenWijziging(c);
    const buiten = g.filter(f => f.startsWith('scripts/') && !sl.has(f)).length;
    if (buiten && g.some(f => !f.startsWith('scripts/'))) { geval = { c, buiten, rest: g.length - buiten }; break; }
  }
  assert.ok(geval, 'geen gemengde commit gevonden');
  const v = st.versheid({ op: 'x', commit: geval.c + '^', boomVuil: false, instrument }, geval.c);
  assert.equal(v.vers, false);
  assert.match(v.reden, new RegExp('sindsdien zijn ' + geval.rest + ' codebestand'));
  assert.match(v.reden, new RegExp('\\(' + geval.buiten + ' andere buiten dit instrument gelaten\\)'));
});

test('de sluiting volgt mappen met index.js en JSON, en een berekend pad maakt haar onbekend', () => {
  /* scripts/keuring.js noemt in een commentaar een require met een berekend
     relatief pad; de lezer is daar bewust achterdochtig. */
  assert.equal(st.sluiting('scripts/keuring.js'), null);
  const json = st.sluiting('server/kern/document-contracten.js');
  assert.ok(json && json.has('server/kern/document-contracten.js'));
  assert.ok([...json].some(f => f.endsWith('.json')), 'een JSON-require hoort erin te staan');
  const map = st.sluiting('scripts/lib/bewijsschuld-idem.js');
  assert.ok(map, 'deze sluiting hoort kenbaar te zijn');
  assert.ok([...map].some(f => f.endsWith('/index.js')), 'een map-require landt op index.js');
  /* scherm.js laadt playwright via een berekende uitdrukking zonder pad: die
     telt niet als onbekend. */
  const scherm = st.sluiting('scripts/lib/scherm.js');
  assert.ok(scherm && scherm.has('scripts/lib/scherm.js'));
});

test('stempelVan kent beide vormen, en het verschil tussen ontbrekend en stempelloos', () => {
  const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stempeltak-reg-'));
  try {
    const schrijf = (n, j) => { const p = path.join(PROEFMAP, n); fs.writeFileSync(p, JSON.stringify(j)); return p; };
    assert.deepEqual(st.stempelVan(schrijf('a.json', { stempel: { op: '1', commit: 'c' } })), { op: '1', commit: 'c' });
    assert.deepEqual(st.stempelVan(schrijf('b.json', { gemeten: { op: '2' } })), { op: '2' });
    assert.equal(st.stempelVan(schrijf('c.json', { gemeten: { routes: 3 } })), null);
    assert.equal(st.stempelVan(schrijf('d.json', {})), null);
    assert.equal(st.stempelVan(path.join(PROEFMAP, 'weg.json')), undefined);
    assert.equal(st.stempelVan('DIT-REGISTER-BESTAAT-NIET.json'), undefined, 'een relatief pad wordt in de wortel gezocht');
  } finally { fs.rmSync(PROEFMAP, { recursive: true, force: true }); }
});
