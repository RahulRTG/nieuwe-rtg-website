/* DE WEGWERPSERVER, TAK VOOR TAK (scripts/lib/wegwerpserver.js).

   test/luisteraarlek.test.js toetst de opruiming en
   test/meetserver-schorspoort.test.js de volgorde van de omgeving. Hier staan
   de andere wensen die een instrument aan start() kan doorgeven -- een vaste
   poort, een eigen datamap die NIET wordt opgeruimd, een logbestand of een
   file descriptor, readiness in plaats van health, en `magSterven` -- plus de
   twee manieren waarop een server niet opkomt. Alles draait met kleine
   stubprogramma's op 127.0.0.1 in een tijdelijke map (PROEFMAP); er wordt geen
   echte server geboot en niets in de repository geschreven.

   Los: node --test test/wegwerpserver-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const wegwerp = require('../scripts/lib/wegwerpserver');

const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wegwerp-tak-'));
test.after(() => fs.rmSync(PROEFMAP, { recursive: true, force: true }));

function stub(naam, code) {
  const p = path.join(PROEFMAP, naam + '.js');
  fs.writeFileSync(p, code);
  return p;
}
/* Antwoordt alleen op het pad dat in de omgeving staat, en schrijft een regel
   naar stdout zodat een log iets te vangen heeft. */
const DIENT = stub('dient', "console.log('stub op ' + process.env.PORT + ' bind ' + process.env.RTG_BIND);" +
  "require('http').createServer((q, s) => { s.statusCode = q.url === '/api/ready' || q.url === '/api/health' ? 200 : 404; s.end('ok'); })" +
  ".listen(Number(process.env.PORT), '127.0.0.1');\n");
const STERFT = stub('sterft', 'process.exit(3);\n');
const HANGT = stub('hangt', 'setInterval(() => {}, 1000);\n');

const leeft = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function totDood(pid) {
  const eind = Date.now() + 5000;
  while (leeft(pid) && Date.now() < eind) await new Promise(r => setTimeout(r, 25));
  return !leeft(pid);
}

test('gereedschapsomgeving: loopback, meetstand, en de demo-vlag vertaald naar de testomgeving', () => {
  const env = wegwerp.gereedschapsomgeving({ poort: 1234, datamap: '/tmp/x' }, { RTG_DEMO: '1', NODE_ENV: 'production' });
  assert.equal(env.PORT, '1234');
  assert.equal(env.RTG_DATA_DIR, '/tmp/x');
  assert.equal(env.RTG_BIND, '127.0.0.1');
  assert.equal(env.SMTP_URL, '');
  assert.equal(env.RTG_SCHORSPOORT_UIT, '1');
  assert.equal(env.RTG_TIKKERS_UIT, '1');
  assert.equal(env.RTG_MAGNAAT_TEST, '1', 'om de demo-stand gevraagd, dus de testomgeving erbij');
  const alTest = wegwerp.gereedschapsomgeving({ poort: 1, datamap: 'm' }, { RTG_DEMO: '1', NODE_ENV: 'test', RTG_MAGNAAT_TEST: '0' });
  assert.equal(alTest.RTG_MAGNAAT_TEST, '0', 'de oude weg werkt al; er wordt niets bijgezet');
  const zonder = wegwerp.gereedschapsomgeving({ poort: 1, datamap: 'm' }, { RTG_DEMO: '0', RTG_MAGNAAT_TEST: '' });
  assert.equal(zonder.RTG_MAGNAAT_TEST, '', 'wie de demo-stand niet vraagt, krijgt hem niet');
  const eigen = wegwerp.gereedschapsomgeving({ poort: 1, datamap: 'm' }, { RTG_SCHORSPOORT_UIT: '0' });
  assert.equal(eigen.RTG_SCHORSPOORT_UIT, '0', 'de aanroeper wint');
  assert.equal(wegwerp.gereedschapsomgeving({ poort: 9, datamap: 'm' }).PORT, '9');
});

test('vrijePoort geeft een bruikbare poort op de loopback', async () => {
  const p = await wegwerp.vrijePoort();
  assert.ok(Number.isInteger(p) && p > 0 && p < 65536, String(p));
});

test('wachtTotOp: op zodra het pad 2xx geeft, en eerlijk nee bij een fout of een dichte poort', async () => {
  let teller = 0;
  const srv = http.createServer((q, s) => {
    if (q.url === '/eerst-fout') { teller++; s.statusCode = teller < 2 ? 503 : 200; return s.end(); }
    s.statusCode = q.url === '/api/health' ? 200 : 500; s.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const basis = 'http://127.0.0.1:' + srv.address().port;
  try {
    assert.equal(await wegwerp.wachtTotOp(basis, 2000), true, 'standaard /api/health');
    assert.equal(await wegwerp.wachtTotOp(basis, 3000, '/eerst-fout'), true, 'na een 503 opnieuw proberen');
    assert.equal(teller, 2);
    assert.equal(await wegwerp.wachtTotOp(basis, 300, '/stuk'), false, 'een 500 is niet op');
  } finally { await new Promise(r => srv.close(r)); }
  assert.equal(await wegwerp.wachtTotOp(basis, 300), false, 'een dichte poort is niet op');
});

test('een vaste poort, een eigen datamap, een logbestand en readiness', async () => {
  const poort = await wegwerp.vrijePoort();
  const datamap = fs.mkdtempSync(path.join(PROEFMAP, 'eigen-'));
  const s = await wegwerp.start({ programma: DIENT, poort, datamap, log: true, gereed: 'ready',
    nodeArgs: ['--no-warnings'], wachtMs: 20000 });
  try {
    assert.equal(s.poort, poort);
    assert.equal(s.basis, 'http://127.0.0.1:' + poort);
    assert.equal(s.datamap, datamap);
    assert.equal(s.dood, false);
    assert.equal((await fetch(s.basis + '/api/ready')).status, 200);
  } finally { s.klaar(); }
  assert.ok(await totDood(s.kind.pid), 'het kindproces is gestopt');
  assert.equal(fs.existsSync(datamap), true, 'wie de map aanlevert, ruimt hem zelf op');
  assert.match(fs.readFileSync(path.join(datamap, 'server.log'), 'utf8'), new RegExp('stub op ' + poort + ' bind 127\\.0\\.0\\.1'));
});

test('uitvoer naar een opgegeven file descriptor, en een eigen map met de naam erin', async () => {
  const logPad = path.join(PROEFMAP, 'fd.log');
  const fd = fs.openSync(logPad, 'a');
  let s;
  try {
    s = await wegwerp.start({ programma: DIENT, logFd: fd, naam: 'takproef', wachtMs: 20000 });
    assert.match(path.basename(s.datamap), /^rtg-takproef-/);
    assert.equal(fs.existsSync(s.datamap), true);
  } finally { if (s) s.klaar(); fs.closeSync(fd); }
  assert.equal(fs.existsSync(s.datamap), false, 'een eigen map gaat mee weg');
  assert.ok(await totDood(s.kind.pid));
  assert.match(fs.readFileSync(logPad, 'utf8'), /stub op \d+/);
});

test('magSterven: een server die sterft is { dood: true }, een die opkomt { dood: false }', async () => {
  const dood = await wegwerp.start({ programma: STERFT, magSterven: true, wachtMs: 10000 });
  try {
    assert.equal(dood.dood, true);
    assert.equal(dood.kind.exitCode, 3);
  } finally { dood.klaar(); }
  const levend = await wegwerp.start({ programma: DIENT, magSterven: true, gereed: 'ready', wachtMs: 20000 });
  try { assert.equal(levend.dood, false); } finally { levend.klaar(); }
  assert.ok(await totDood(levend.kind.pid));
});

test('een server die niet opkomt en ook niet sterft, is een fout -- en wordt opgeruimd', async () => {
  const datamap = fs.mkdtempSync(path.join(PROEFMAP, 'hangt-'));
  await assert.rejects(wegwerp.start({ programma: HANGT, magSterven: true, wachtMs: 500, datamap }),
    /kwam niet op en stierf ook niet binnen de wachttijd/);
  await assert.rejects(wegwerp.start({ programma: HANGT, wachtMs: 500, datamap }),
    /kwam niet op binnen de wachttijd/);
  assert.equal(fs.existsSync(datamap), true, 'ook bij een fout blijft een aangeleverde map staan');
});
