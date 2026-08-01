/* De Ghost Driver: de vooruitkijkende verkeersleider. Hij bouwt zijn
   voorspelling uit echte demo-data (evenement-uitloop van verkochte tickets,
   het vaste dagritme, de eigen rittenhistorie en het deterministische
   weerbeeld) en levert per waarschuwing een concreet vlootadvies plus een
   simulatie zonder/met advies. Draai los:
   node --experimental-sqlite --test test/ghost.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, sup, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ghost-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(sup && office);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de voorspelling staat op echte bouwstenen: knooppunten van de stad en de eigen vloot', async () => {
  const r = await api('/api/supplier/ghost', {}, sup);
  assert.equal(r.status, 200);
  assert.equal(r.body.horizonUren, 12);
  assert.ok(r.body.knooppunten.length >= 3, 'de knooppunten komen uit de echte partnerplekken van de stad');
  assert.ok(r.body.vloot.some(v => /Mercedes/.test(v.naam)), 'het advies kent de eigen vloot bij naam');
  assert.ok(/weerbeeld \(demo\)/.test(r.body.toelichting), 'het demo-weerbeeld heet eerlijk demo');
  assert.equal(r.body.uurbeeld.length, 12, 'er is altijd een beeld voor elk komend uur');
  for (const u of r.body.uurbeeld) assert.ok(u.kans >= 0 && u.kans <= 97, 'elk uur draagt een begrensde kans');
});

test('2. elke waarschuwing draagt kans, oorzaken, vlootadvies en een simulatie zonder/met', async () => {
  const r = await api('/api/supplier/ghost', {}, sup);

  /* EERST: MAG DEZE LIJST LEEG ZIJN? De voorspelling hangt aan de dag waarop je
     hem draait, dus op een rustige dag komt er terecht geen enkele
     waarschuwing. Zonder de twee beweringen hieronder zou de lus daaronder dan
     nul keer draaien en zou deze toets groen staan zonder ook maar iets te
     hebben gecontroleerd -- de vorm uit LAT.md regel 9. Nu koppelen we de
     leegte aan een narekenbare oorzaak: de server zegt zelf of het rustig is,
     en dat moet kloppen met het uurbeeld. Twee getallen die langs verschillende
     weg zijn uitgerekend, tegen elkaar aan gelegd. */
  assert.equal(r.body.rustig, r.body.waarschuwingen.length === 0,
    'het rustig-vlaggetje en de waarschuwingenlijst zeggen hetzelfde');
  assert.equal(r.body.uurbeeld.some(u => u.kans >= r.body.drempel), r.body.waarschuwingen.length > 0,
    'er staat een waarschuwing precies dan als een uur de drempel (' + r.body.drempel + '%) haalt');

  for (const w of r.body.waarschuwingen) {
    /* De ondergrens komt uit het antwoord en staat hier niet nog eens ingetikt:
       60 stond hier hard, terwijl de server zijn drempel gewoon meestuurt. Twee
       plekken met dezelfde waarheid lopen uiteen zodra iemand DREMPEL verzet
       (LAT.md regel 4) -- en dat is precies wat een mutatie hier liet zien. */
    assert.ok(w.kans >= r.body.drempel && w.kans <= 97, 'de kans ligt tussen de drempel en het plafond');
    assert.ok(/^\d{2}:00$/.test(w.tijd), 'de waarschuwing noemt het uur');
    assert.ok(w.knooppunt, 'de waarschuwing noemt het knooppunt');
    assert.ok(/Stuur .+ (voor|ruim)/.test(w.advies) && /route B/.test(w.advies), 'het advies zegt wat er nu moet gebeuren');
    assert.ok(/min/.test(w.simulatie.zonderAdvies) && /min/.test(w.simulatie.winst), 'de simulatie toont de winst van ingrijpen');
  }
});

test('3. het weerbeeld is deterministisch: zelfde dag en uur, zelfde weer (naspeelbaar)', async () => {
  const a = await api('/api/supplier/ghost', {}, sup);
  const b = await api('/api/supplier/ghost', {}, sup);
  assert.deepEqual(
    a.body.waarschuwingen.map(w => [w.tijd, w.knooppunt, w.kans]),
    b.body.waarschuwingen.map(w => [w.tijd, w.knooppunt, w.kans]),
    'twee keer kijken geeft dezelfde voorspelling: geen willekeur in het advies'
  );
});

test('4. de verkeersleider ziet dezelfde blik over alle vervoerszaken', async () => {
  const gast = await api('/api/office/ghost', {}, sup);
  assert.ok(gast.status === 401 || gast.status === 403, 'de kantoorblik is alleen voor kantoor');
  const r = await api('/api/office/ghost', {}, office);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.zaken), 'per vervoerszaak de belangrijkste waarschuwingen');
});
