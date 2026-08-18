/* De doelenmotor (kern/doelen.js). Het punt van deze motor is dat mijlpalen
   worden AFGELEID en niet bewaard: een gemiste week is dan geen mislukking maar
   een ander pad. Dat is ook wat hier het zwaarst getoetst wordt.

   Verder: geen meting is niet nul (LAT regel 3), een doel van een ander lid
   bestaat niet voor jou, en een meting draagt haar herkomst.
   Draai los: node --test test/doelen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const motor = require('../server/kern/doelen');

let srv, base, lid, lid2;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doelen-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  lid = await login('rtg');
  lid2 = await login('business');
  assert.ok(lid && lid2);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---- de rekenkern, zonder server: hier zit het gedrag dat ertoe doet ---- */

const doel = (over = {}) => ({
  titel: '10 km hardlopen', reden: 'ik wil het gewoon kunnen', eenheid: 'km',
  nulmeting: { waarde: 2, op: '2026-08-01' },
  streef: { waarde: 10, op: '2026-10-01' },
  metingen: [], status: 'loopt', ...over
});

test('zonder meting is de stand niet nul maar "nog niets gemeten"', () => {
  const p = motor.planVan(doel(), new Date('2026-08-01T12:00:00Z'));
  assert.equal(p.stand.gemeten, false);
  assert.equal(p.aandeel, null, 'geen meting geeft geen percentage; nul zou een leugen zijn');
  assert.match(p.bericht, /nog niets gemeten/i);
  assert.ok(p.mijlpalen.length > 0, 'er is wel al een pad te zien');
});

test('een gemiste periode maakt het pad steiler, en begint niet opnieuw', () => {
  /* Twee keer hetzelfde doel, dezelfde meting van 4 km. In het ene geval is er
     nog acht weken; in het andere nog twee, want er zijn zes weken voorbij
     zonder vooruitgang. Het beginpunt blijft 2 km -- niemand wordt teruggezet
     -- maar de eerstvolgende stap hoort in het tweede geval groter te zijn. */
  const met = (op, nu) => motor.planVan(
    doel({ metingen: [{ waarde: 4, op, bron: 'zelf' }] }), new Date(nu));

  const ruim = met('2026-08-05', '2026-08-06T12:00:00Z');
  const krap = met('2026-09-17', '2026-09-18T12:00:00Z');

  assert.equal(ruim.stand.waarde, 4);
  assert.equal(krap.stand.waarde, 4);
  assert.equal(ruim.nulmeting.waarde, 2, 'het beginpunt schuift niet mee');
  assert.equal(krap.nulmeting.waarde, 2, 'ook niet als het tegenzit');

  /* De harde bewering, en die moest scherper. Eerst stond hier alleen dat de
     eerstvolgende stap in het krappe geval groter is dan in het ruime -- en dat
     bleef waar toen het pad vanaf de NULMETING werd gerekend in plaats van
     vanaf de meting. Een pad dat bij 3 km begint terwijl je 4 km loopt is
     precies "opnieuw beginnen", en de toets zag het niet.

     Dit ziet het wel: elke mijlpaal ligt VOOR je uit, nooit achter je. */
  for (const p of [ruim, krap]) {
    assert.ok(p.mijlpalen[0].waarde > p.stand.waarde,
      'de eerstvolgende mijlpaal ligt voor je, niet achter je (' + p.stand.waarde + ' -> ' + p.mijlpalen[0].waarde + ')');
  }
  const stapRuim = ruim.mijlpalen[0].waarde - 4;
  const stapKrap = krap.mijlpalen[0].waarde - 4;
  assert.ok(stapKrap > stapRuim,
    'met minder tijd over hoort de volgende stap groter te zijn (' + stapRuim + ' vs ' + stapKrap + ')');
  assert.ok(krap.mijlpalen.length < ruim.mijlpalen.length, 'en er zijn minder stappen over');
  assert.equal(krap.mijlpalen[krap.mijlpalen.length - 1].waarde, 10, 'het eindpunt blijft het doel');
});

test('een doel dat de verkeerde kant op wijst (afvallen) telt ook goed', () => {
  const af = doel({ titel: 'vijf kilo eraf', eenheid: 'kg',
    nulmeting: { waarde: 90, op: '2026-08-01' }, streef: { waarde: 85, op: '2026-10-01' },
    metingen: [{ waarde: 87.5, op: '2026-09-01', bron: 'zelf' }] });
  const p = motor.planVan(af, new Date('2026-09-02T12:00:00Z'));
  assert.equal(p.aandeel, 0.5, 'halverwege is halverwege, ook als het getal daalt');
  assert.equal(p.gehaald, false);
  assert.ok(p.mijlpalen[0].waarde < 87.5, 'de volgende mijlpaal ligt lager, niet hoger');

  const klaar = motor.planVan({ ...af, metingen: [{ waarde: 84, op: '2026-09-01', bron: 'zelf' }] },
    new Date('2026-09-02T12:00:00Z'));
  assert.equal(klaar.gehaald, true, 'voorbij het doel is gehaald, niet mislukt');
});

test('na de streefdatum verzint de motor geen pad maar zegt wat er is', () => {
  const p = motor.planVan(doel({ metingen: [{ waarde: 6, op: '2026-09-30', bron: 'zelf' }] }),
    new Date('2026-10-15T12:00:00Z'));
  assert.deepEqual(p.mijlpalen, [], 'geen mijlpalen in het verleden');
  assert.ok(p.dagenOver < 0);
  assert.match(p.bericht, /streefdatum is voorbij/i);
  assert.match(p.bericht, /nieuwe datum/i, 'en er staat bij wat je eraan kunt doen');
});

/* ---- de route-kant ---- */

test('een doel maken vraagt om een reden, en niet alleen om een getal', async () => {
  const zonder = await api('doelen/maak', { titel: '10 km hardlopen', eenheid: 'km',
    nulmeting: 2, streef: 10, streefOp: overDagen(60) }, lid);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /waarom/i);

  const gelijk = await api('doelen/maak', { titel: 'niets', reden: 'x', eenheid: 'km',
    nulmeting: 5, streef: 5, streefOp: overDagen(60) }, lid);
  assert.equal(gelijk.status, 400, 'begin en doel gelijk is geen doel');

  const verleden = await api('doelen/maak', { titel: 'te laat', reden: 'x', eenheid: 'km',
    nulmeting: 2, streef: 10, streefOp: overDagen(-1) }, lid);
  assert.equal(verleden.status, 400, 'een streefdatum in het verleden is geen streven');

  const goed = await api('doelen/maak', { titel: '10 km hardlopen', reden: 'ik wil het kunnen',
    eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) }, lid);
  assert.equal(goed.status, 200, JSON.stringify(goed.body));
  assert.equal(goed.body.doel.stand.gemeten, false);
  assert.equal(goed.body.doel.reden, 'ik wil het kunnen');
});

test('meten draagt een herkomst, en een verzonnen herkomst wordt geweigerd', async () => {
  const id = (await api('doelen', {}, lid)).body.doelen[0].id;

  /* De herkomst komt uit de DEUR. Wie via deze route meet, vult zelf in, en
     een meegestuurde bron verandert daar niets aan. Dat werd scherp toen
     'apparaat' een echte herkomst werd: body.bron lezen zou betekenen dat een
     lid zijn eigen schatting als apparaatmeting kan boeken. */
  const geclaimd = await api('doelen/meet', { id, waarde: 4, bron: 'apparaat' }, lid);
  assert.equal(geclaimd.status, 200, 'de meting gaat gewoon door');
  assert.equal(geclaimd.body.doel.stand.bron, 'zelf', 'maar hij staat als zelf ingevuld, niet als apparaat');
  assert.equal((await api('doelen/meet', { id, waarde: 4, bron: 'horoscoop' }, lid)).body.doel.stand.bron, 'zelf',
    'en onzin in het veld verandert er ook niets aan');

  const morgen = await api('doelen/meet', { id, waarde: 4, op: overDagen(1) }, lid);
  assert.equal(morgen.status, 400, 'een meting van morgen bestaat nog niet');

  const ok = await api('doelen/meet', { id, waarde: 4 }, lid);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.doel.stand.gemeten, true);
  assert.equal(ok.body.doel.stand.waarde, 4);
  assert.equal(ok.body.doel.stand.bron, 'zelf');
  assert.equal(ok.body.doel.aandeel, 0.25);
});

test('de streefdatum verzetten rekent het pad opnieuw uit vanaf nu', async () => {
  const voor = (await api('doelen', {}, lid)).body.doelen[0];
  const stapVoor = voor.mijlpalen[0].waarde - voor.stand.waarde;

  const r = await api('doelen/verzet', { id: voor.id, streefOp: overDagen(240) }, lid);
  assert.equal(r.status, 200);
  const stapNa = r.body.doel.mijlpalen[0].waarde - r.body.doel.stand.waarde;
  assert.ok(stapNa < stapVoor, 'meer tijd betekent een kleinere eerstvolgende stap');
  assert.equal(r.body.doel.stand.waarde, voor.stand.waarde, 'de meting blijft staan');
  assert.equal(r.body.doel.nulmeting.waarde, voor.nulmeting.waarde, 'en het beginpunt ook');

  const terug = await api('doelen/verzet', { id: voor.id, streefOp: overDagen(-5) }, lid);
  assert.equal(terug.status, 400, 'terugzetten naar het verleden mag niet');
});

test('het doel van een ander lid bestaat niet voor jou', async () => {
  const id = (await api('doelen', {}, lid)).body.doelen[0].id;
  assert.equal((await api('doelen', {}, lid2)).body.doelen.length, 0, 'lid2 heeft eigen doelen: geen');

  assert.equal((await api('doelen/meet', { id, waarde: 9 }, lid2)).status, 404);
  assert.equal((await api('doelen/verzet', { id, streefOp: overDagen(30) }, lid2)).status, 404);
  assert.equal((await api('doelen/stop', { id }, lid2)).status, 404);

  const na = (await api('doelen', {}, lid)).body.doelen[0];
  assert.equal(na.stand.waarde, 4, 'na drie pogingen van een ander staat het doel er onaangeroerd bij');

  assert.equal((await api('doelen/stop', { id }, lid)).status, 200);
  assert.equal((await api('doelen', {}, lid)).body.doelen.length, 0, 'gestopt is weg uit de lijst');
});
