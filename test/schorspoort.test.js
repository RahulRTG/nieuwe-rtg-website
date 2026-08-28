/* DE SCHORSPOORT, NAGETROKKEN. Een route waarvan het register zegt "geschorst"
   trekt zich terug voor schrijven, en voor niets anders: lezen blijft open,
   andere routes blijven open, en de poort kan alleen dichthouden -- nooit
   openen. Gemeten tegen een echte app met het eigen webframework en een
   verzonnen register op een tijdelijk pad, zodat elk geval precies een ding
   verandert (LAT.md regel 10).

   Draai los: node --experimental-sqlite --test test/schorspoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('../server/web');
const maakSchorspoort = require('../server/middleware/schorspoort');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schors-'));
const REG = path.join(TMP, 'vertrouwen.json');
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

function schrijfRegister(perRoute) {
  fs.writeFileSync(REG, JSON.stringify({ perRoute }));
}

/* Een app met de poort ervoor en tellende handlers erachter: elke ECHTE
   uitvoering telt, want een poort die de handler doorlaat en daarna 503 zegt
   zou hier onzichtbaar zijn. ttlMs 0: elke aanroep leest het register vers. */
async function metApp(doe) {
  const app = express();
  app.use(express.json());
  app.use(maakSchorspoort({ pad: REG, ttlMs: 0 }));
  let teller = 0;
  app.post('/api/geld/boek', (req, res) => { teller++; res.json({ ok: true, geboekt: true }); });
  app.get('/api/geld/boek', (req, res) => { teller++; res.json({ ok: true, saldo: 7 }); });
  app.post('/api/iets/anders', (req, res) => { teller++; res.json({ ok: true }); });
  app.post('/api/gezin/ABC123/mij', (req, res) => { teller++; res.json({ ok: true }); });
  const server = await new Promise(z => { const s = app.listen(0, () => z(s)); });
  const basis = 'http://127.0.0.1:' + server.address().port;
  const doe2 = async (methode, pad) => {
    const r = await fetch(basis + pad, { method: methode,
      headers: { 'Content-Type': 'application/json' }, body: methode === 'GET' ? undefined : '{}' });
    return { status: r.status, kop: r.headers.get('x-vervalstaat'), data: await r.json().catch(() => null) };
  };
  try { return await doe(doe2, () => teller); } finally { server.close(); }
}

test('een geschorste route gaat dicht voor schrijven, met de reden erbij', () => metApp(async (doe, telling) => {
  schrijfRegister({ 'POST /api/geld/boek': { staat: 'geschorst', reden: 'gezakt op ROLLBACK' } });
  const uit = await doe('POST', '/api/geld/boek');
  assert.equal(uit.status, 503);
  assert.equal(uit.kop, 'geschorst');
  assert.match(uit.data.reden, /ROLLBACK/);
  assert.equal(telling(), 0, 'de handler draait niet: dichthouden is dichthouden');
}));

test('lezen blijft open op dezelfde route: de veiligste toestand die nog bewezen is', () => metApp(async (doe, telling) => {
  schrijfRegister({ 'POST /api/geld/boek': { staat: 'geschorst', reden: 'gezakt' } });
  const uit = await doe('GET', '/api/geld/boek');
  assert.equal(uit.status, 200);
  assert.equal(uit.data.saldo, 7);
  assert.equal(telling(), 1);

  /* En de scherpe kant: zelfs als het register een LEESROUTE schorst, blijft
     lezen open. De poort degradeert naar de veiligste toestand die nog
     bewezen is; kijken hoort daar altijd bij (PROOF.md par. 9.4), en wie een
     leesweg wil sluiten doet dat bij de gewone poorten, niet hier. */
  schrijfRegister({ 'GET /api/geld/boek': { staat: 'geschorst', reden: 'gezakt' } });
  assert.equal((await doe('GET', '/api/geld/boek')).status, 200,
    'een geschorste leesroute blijft leesbaar; de schorspoort raakt alleen schrijven');
  assert.equal(telling(), 2);
}));

test('elke andere staat en elke andere route blijft ongemoeid', () => metApp(async (doe, telling) => {
  schrijfRegister({
    'POST /api/geld/boek': { staat: 'verzwakt', reden: 'schakels missen' },
    'POST /api/iets/anders': { staat: 'bewezen', reden: 'alles staat' }
  });
  assert.equal((await doe('POST', '/api/geld/boek')).status, 200, 'verzwakt is geen schorsing');
  assert.equal((await doe('POST', '/api/iets/anders')).status, 200);
  assert.equal(telling(), 2);
}));

test('een geschorste parameterroute matcht op vorm, per segment', () => metApp(async (doe, telling) => {
  schrijfRegister({ 'POST /api/gezin/:code/mij': { staat: 'geschorst', reden: 'gezakt' } });
  assert.equal((await doe('POST', '/api/gezin/ABC123/mij')).status, 503);
  assert.equal(telling(), 0);
}));

test('zonder register is er geen signaal: het huis draait gewoon', () => metApp(async (doe, telling) => {
  try { fs.unlinkSync(REG); } catch (e) {}
  assert.equal((await doe('POST', '/api/geld/boek')).status, 200);
  assert.equal(telling(), 1);
}));

test('de noodrem RTG_SCHORSPOORT_UIT=1 opent, en is daarmee per definitie luid', () => metApp(async (doe, telling) => {
  schrijfRegister({ 'POST /api/geld/boek': { staat: 'geschorst', reden: 'gezakt' } });
  process.env.RTG_SCHORSPOORT_UIT = '1';
  try {
    assert.equal((await doe('POST', '/api/geld/boek')).status, 200);
    assert.equal(telling(), 1);
  } finally { delete process.env.RTG_SCHORSPOORT_UIT; }
  assert.equal((await doe('POST', '/api/geld/boek')).status, 503, 'rem los is meteen weer dicht');
}));

test('het ECHTE register kent op dit moment geen enkele schorsing, en dat hoort zo', () => {
  /* De poort staat vandaag in de keten zonder iets te blokkeren: geschorst is
     nul sinds het front is leeggemaakt. Zakt er ooit weer bewijs, dan gaat
     precies die route dicht -- en deze toets herinnert eraan dat een schorsing
     in het register vanaf nu GEDRAG is, geen dashboardkleur. */
  const echt = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'VERTROUWEN.json'), 'utf8'));
  const geschorst = Object.entries(echt.perRoute || {}).filter(([, u]) => u.staat === 'geschorst');
  assert.deepEqual(geschorst.map(([k]) => k), [],
    'er staan routes geschorst; sinds de schorspoort betekent dat: dicht voor schrijven. ' +
    'Repareer en hermeet ze, of schors bewust met deze wetenschap.');
});
