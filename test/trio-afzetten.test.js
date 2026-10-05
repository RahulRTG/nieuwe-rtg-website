/* ============================================================================
   HET TRIO KENT NOOIT TWEE SCHRIJVERS -- regressie voor RTG-V1-RELEASE C6
   (gevonden door de onafhankelijke herkeuring).

   DE FOUT: server/trio-wacht.js nam de oude leider zijn rol "best effort" af en
   promoveerde de nieuwe ook als dat mislukte. Een leider die vastzit (geen
   antwoord op /api/health en niet op de demote) leeft nog en schrijft verder
   zodra hij loskomt; op SQLite verdwijnt dan stil een update.

   DE FIX: server/trio-afzetten.js. Bevestigt de oude leider zijn afzetting
   niet, dan wordt zijn proces gestopt en pas daarna gepromoveerd; lukt stoppen
   niet, dan wordt er niemand gepromoveerd.

   De toets draait tegen de ECHTE maakWacht: nep-HTTP-servers beantwoorden de
   gezondheids-, promote- en demote-aanroepen van de poortwachter, en een nep-
   kindproces legt vast of en wanneer het werd gestopt.

   Draai los: node --test test/trio-afzetten.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { EventEmitter } = require('events');
const { maakWacht } = require('../server/trio-wacht');

/* Twee opeenvolgende vrije poorten: maakWacht rekent BASISPOORT + i. */
async function tweePoorten() {
  for (let poging = 0; poging < 50; poging++) {
    const basis = 40000 + Math.floor(Math.random() * 20000);
    const vrij = await Promise.all([basis, basis + 1].map((p) => new Promise((klaar) => {
      const s = http.createServer().once('error', () => klaar(false))
        .listen(p, '127.0.0.1', () => s.close(() => klaar(true)));
    })));
    if (vrij.every(Boolean)) return basis;
  }
  throw new Error('geen twee opeenvolgende vrije poorten');
}

/* Een nepserver per poort; `stand` bepaalt wat hij antwoordt, `spoor` legt de
   volgorde van gebeurtenissen vast over alle servers heen. */
function nepServer(port, nr, stand, spoor) {
  const s = http.createServer((req, res) => {
    const pad = req.url.split('?')[0];
    let status = 404;
    if (pad === '/api/health') status = stand.gezond ? 200 : 503;
    else if (pad === '/api/cluster/promote') { status = stand.promote; spoor.push('promote:' + nr); }
    else if (pad === '/api/cluster/demote') { status = stand.demote; spoor.push('demote:' + nr); }
    res.writeHead(status); res.end();
  });
  return new Promise((klaar) => s.listen(port, '127.0.0.1', () => klaar(s)));
}

function nepKind(nr, spoor, sterft) {
  const k = new EventEmitter();
  k.exitCode = null; k.signalCode = null;
  k.kill = (sig) => {
    spoor.push('kill:' + nr + ':' + sig);
    if (sterft) process.nextTick(() => { k.signalCode = sig; k.emit('exit', null, sig); });
  };
  return k;
}

async function opstelling({ sterft }) {
  const basis = await tweePoorten();
  const spoor = [];
  const stand = [{ gezond: true, promote: 200, demote: 200 }, { gezond: false, promote: 200, demote: 200 }];
  const nep = [await nepServer(basis, 1, stand[0], spoor), await nepServer(basis + 1, 2, stand[1], spoor)];
  const w = maakWacht({ AANTAL: 2, BASISPOORT: basis, SLEUTEL: 'toets', FAILBACK_MS: 10000, log: () => {} });
  w.servers[0].child = nepKind(1, spoor, sterft);
  w.servers[1].child = nepKind(2, spoor, true);
  await w.kiesActieve('start');
  assert.equal(w.actieve(), 0, 'server 1 is eerst leider');
  spoor.length = 0;
  // server 1 loopt vast: geen gezondheid en geen bevestigde demote; server 2 staat klaar
  stand[0].gezond = false; stand[0].demote = 500;
  stand[1].gezond = true;
  return { w, spoor, stand, sluit: () => Promise.all(nep.map((s) => new Promise((r) => s.close(r)))) };
}

test('1. een vastgelopen leider wordt GESTOPT voordat een ander leider wordt', async () => {
  const { w, spoor, sluit } = await opstelling({ sterft: true });
  try {
    await w.kiesActieve('server 1 reageert niet meer');
    const kill = spoor.indexOf('kill:1:SIGKILL'), promote = spoor.indexOf('promote:2');
    assert.ok(kill >= 0, 'het proces van de oude leider hoort gestopt te worden: ' + spoor.join(', '));
    assert.ok(promote > kill, 'de nieuwe leider pas NA het stoppen van de oude: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1, 'server 2 is daarna leider');
  } finally { w.stop(); await sluit(); }
});

test('2. lukt het stoppen niet, dan wordt er NIEMAND gepromoveerd (liever geen leider dan twee)', { timeout: 20000 }, async () => {
  const { w, spoor, sluit } = await opstelling({ sterft: false });
  try {
    await w.kiesActieve('server 1 reageert niet meer');
    assert.ok(spoor.includes('kill:1:SIGKILL'), 'er is geprobeerd te stoppen: ' + spoor.join(', '));
    assert.ok(!spoor.includes('promote:2'), 'zonder bevestigd einde geen tweede leider: ' + spoor.join(', '));
    assert.equal(w.actieve(), 0, 'de rol blijft staan tot de volgende ronde');
  } finally { w.stop(); await sluit(); }
});

test('3. een bevestigde afzetting stopt niets, en dan volgt de promotie', async () => {
  const { w, spoor, stand, sluit } = await opstelling({ sterft: true });
  try {
    stand[0].demote = 200;   // de oude leider antwoordt nog op de demote
    await w.kiesActieve('server 1 reageert niet meer');
    assert.ok(!spoor.some((s) => s.startsWith('kill:')), 'wie zijn afzetting bevestigt, wordt niet gestopt: ' + spoor.join(', '));
    assert.ok(spoor.indexOf('demote:1') >= 0 && spoor.indexOf('promote:2') > spoor.indexOf('demote:1'),
      'eerst afzetten, dan promoveren: ' + spoor.join(', '));
    assert.equal(w.actieve(), 1);
  } finally { w.stop(); await sluit(); }
});
