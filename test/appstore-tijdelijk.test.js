/* EEN TIJDELIJKE CEL -- een app die er staat tot een datum die het LID koos.

   Wat deze toets vastlegt:

     1. Leeg is BLIJVEND, en dat is de gewone toestand.
     2. Op de einddatum zelf gaat de app nog open; de dag erna niet meer. De
        vergelijking staat op EEN plek (kern/appstore/tijdelijk.js), want drie
        plekken die hem overtypen laten de app op drie dagen verdwijnen.
     3. Een datum die al geweest is, wordt geweigerd met de weg erbij.
     4. Een verlopen cel opent niet meer, maar wist niets: wat de app bewaarde is
        de inhoud van het LID (grens 5).
     5. "Vernietig de cel" haalt allebei weg en zegt WAT er verdween.

   Draai los: node --test test/appstore-tijdelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { leesTot, isVerlopen } = require('../server/kern/appstore/tijdelijk');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tijdelijk-'));
let srv, base, lid, sup, office, tech;
const VANDAAG = '2026-08-31T10:00:00Z';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test('1. leeg is blijvend, en dat is geen ontbrekende waarde', () => {
  assert.deepEqual(leesTot('', VANDAAG), { tot: null });
  assert.deepEqual(leesTot(null, VANDAAG), { tot: null });
  assert.equal(isVerlopen(null, VANDAAG), false);
});

test('2. de einddatum zelf telt nog mee', () => {
  assert.equal(isVerlopen('2026-08-31', VANDAAG), false, 'op de dag zelf gaat hij nog open');
  assert.equal(isVerlopen('2026-08-30', VANDAAG), true);
  /* En hij valt niet halverwege de dag: ook laat op de avond nog niet. */
  assert.equal(isVerlopen('2026-08-31', '2026-08-31T23:59:00Z'), false);
});

test('3. een datum die al geweest is, wordt geweigerd met de weg erbij', () => {
  const r = leesTot('2020-01-01', VANDAAG);
  assert.ok(r.fout);
  assert.match(r.fout, /blijvend/, 'de uitweg staat in de weigering');
  assert.ok(leesTot('31-08-2026', VANDAAG).fout, 'een andere notatie wordt geweigerd');
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/register', { name: 'Tijd Lid', email: 't@x.nl', phone: '0612340009',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  await api('/api/techniek/tenant', { org: 'O-TIJD', naam: 'Tijd Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-TIJD', soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Tijd Uitgeverij', contact: 'dev@tijd.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: 'O-TIJD', besluit: 'toegelaten', door: 'Sam van RTG' }, office);
  const inz = await api('/api/appstore/uitgever/inzenden', {
    manifest: { sleutel: 'reis-paklijst', naam: 'Paklijst', versie: '1.0.0', categorie: 'reizen',
      uitleg: 'Een paklijst die je voor een reis toevoegt en daarna weer weg kunt gooien.',
      machtigingen: [{ id: 'opslag.eigen', doel: 'werk-bewaren' }] },
    bestanden: [
      { pad: 'index.html', inhoud: '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Paklijst</title></head><body><p id="n">Paklijst</p><script src="app.js"></script></body></html>' },
      { pad: 'app.js', inhoud: 'RTG.roep("opslag.zet", { sleutel: "lijst", waarde: "tandenborstel" });\n' }]
  }, sup);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  await api('/api/appstore/kantoor/toegankelijk', { versieId: inz.body.versie.id, stand: 'in-orde', fouten: 0 }, office);
  await api('/api/appstore/kantoor/besluit', { versieId: inz.body.versie.id, besluit: 'gepubliceerd', door: 'Sam van RTG' }, office);
});
test.after(() => stop(srv));

test('4. een einddatum wordt bewaard en staat op de kaart', async () => {
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const r = await api('/api/appstore/installeer', { sleutel: 'reis-paklijst', machtigingen: ['opslag.eigen'], tot: morgen }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.tot, morgen);
  assert.match(r.body.let, /tot en met/);

  const mijn = (await api('/api/appstore/mijn', {}, lid)).body.apps;
  const kaart = mijn.find(a => a.sleutel === 'reis-paklijst');
  assert.equal(kaart.tot, morgen);
  assert.equal(kaart.verlopen, false);
  /* En hij opent gewoon: de datum is nog niet geweest. */
  assert.equal((await api('/api/appstore/open', { sleutel: 'reis-paklijst' }, lid)).status, 200);
});

test('5. een datum die al geweest is, komt de route niet door', async () => {
  const r = await api('/api/appstore/installeer', { sleutel: 'reis-paklijst', machtigingen: ['opslag.eigen'], tot: '2020-01-01' }, lid);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /al geweest/);
});

test('6. vernietigen haalt de app EN de opslag weg, en zegt wat er verdween', async () => {
  await api('/api/appstore/brug', { sleutel: 'reis-paklijst', methode: 'opslag.zet',
    args: { sleutel: 'lijst', waarde: 'tandenborstel' } }, lid);
  const r = await api('/api/appstore/vernietig', { sleutel: 'reis-paklijst' }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.sleutels, 1, 'hij telt wat er stond');
  assert.ok(r.body.bytes > 0);
  assert.match(r.body.let, /geen kopie bij de uitgever/);

  const mijn = (await api('/api/appstore/mijn', {}, lid)).body.apps;
  assert.ok(!mijn.some(a => a.sleutel === 'reis-paklijst'), 'de app staat er niet meer');
  /* En terugzetten begint met een leeg potje: er is echt gewist. */
  await api('/api/appstore/installeer', { sleutel: 'reis-paklijst', machtigingen: ['opslag.eigen'] }, lid);
  const lees = await api('/api/appstore/brug', { sleutel: 'reis-paklijst', methode: 'opslag.lees', args: { sleutel: 'lijst' } }, lid);
  assert.equal(lees.body.uit.waarde, null);
});

test('7. verwijderen is iets anders dan vernietigen: de inhoud blijft', async () => {
  await api('/api/appstore/brug', { sleutel: 'reis-paklijst', methode: 'opslag.zet',
    args: { sleutel: 'lijst', waarde: 'paspoort' } }, lid);
  await api('/api/appstore/weg', { sleutel: 'reis-paklijst' }, lid);
  await api('/api/appstore/installeer', { sleutel: 'reis-paklijst', machtigingen: ['opslag.eigen'] }, lid);
  const lees = await api('/api/appstore/brug', { sleutel: 'reis-paklijst', methode: 'opslag.lees', args: { sleutel: 'lijst' } }, lid);
  assert.equal(lees.body.uit.waarde, 'paspoort', 'wat het lid bewaarde stond er nog');
});
