/* DE DAGBAKKEN VAN DE DASHBOARDS, rond middernacht.

   Twee dashboards telden omzet per dag op de UTC-datum van de container:
     - de backoffice van een zaak (routes/supplier/backoffice.js): sinds het
       eigenaarsbesluit van 19 oktober 2026 de OMZETDAG tot 05:00 lokaal, in de
       zone van de zaak -- dezelfde dag als de kasopmaak (HORECA.md);
     - het kantooroverzicht van RTG zelf over alle zaken
       (kern/kantoor/metrics-week.js): de kalenderdag van het huis.
   Beide toetsen draaien met TZ=UTC, zoals in productie.

   Draai los: node --test test/dashboard-dagen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { startServer } = require('./helper');

const WORTEL = path.join(__dirname, '..');

test('kantooroverzicht om 00:30 in Amsterdam: vandaag is de nieuwe dag, 23:30 hoort bij gisteren', () => {
  const uit = execFileSync(process.execPath, ['-e', `
    const m = require('./server/kern/kantoor/metrics-week')({ invoices: () => [], fondsAfdrachten: () => [], muntOntvangsten: () => [] });
    // vijf zaken per dag, zodat de groepspoort de bedragen niet dichtzet
    const zaken = ['A', 'B', 'C', 'D', 'E'];
    const orders = zaken.map(z => ({ supplierCode: z, total: 10, paidAt: '2026-07-15T21:30:00Z' }))  // 23:30 lokaal
      .concat(zaken.map(z => ({ supplierCode: z, total: 10, paidAt: '2026-07-15T22:10:00Z' })));     // 00:10 lokaal
    const { week } = m.weekEnStats(orders, [], [], Date.parse('2026-07-15T22:30:00Z'));  // 00:30 lokaal
    console.log(JSON.stringify(week.slice(5).map(d => [d.date, d.aantal])));`],
  { encoding: 'utf8', cwd: WORTEL, env: { ...process.env, TZ: 'UTC', NODE_ENV: 'test' } });
  assert.deepEqual(JSON.parse(uit.trim().split('\n').pop()), [['2026-07-15', 5], ['2026-07-16', 5]]);
});

/* De backoffice draait op een echte server met de klok op 01:30 lokale
   wintertijd (00:30 UTC). Volgens de oude regel was het dan al de 16e; voor
   de zaak is het nog de omzetdag van de 15e. De kassa stempelt met lib/klok,
   dus een bon van NU draagt het verzette moment en telt in die omzetdag. */
let srv, baas;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dashdag-'));
async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', TZ: 'UTC', RTG_KLOK: '2026-01-16T00:30:00Z' } });
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const m = roster.staff.find(x => x.role === 'manager');
  baas = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: m.id, pin: '1234' })).body.token;
});
test.after(() => {
  if (srv && srv.child) try { srv.child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('backoffice om 01:30 lokaal: de omzetdag is nog gisteren, en de week eindigt daar', async () => {
  const b = await api('/api/supplier/backoffice', {}, baas);
  assert.equal(b.status, 200);
  const week = b.body.week;
  assert.equal(week.length, 7);
  assert.equal(week[6].date, '2026-01-15', 'de omzetdag loopt tot 05:00');
  assert.equal(week[0].date, '2026-01-09', 'en de week telt zeven omzetdagen terug');
});

test('een bon van nu op de verzette klok draagt dat moment en telt in de omzetdag', async () => {
  const bon = await api('/api/supplier/pos/sale', { total: 17, method: 'contant', kassa: 'Kassa bar',
    items: [{ name: 'Nachtcava', qty: 1, price: 17 }] }, baas);
  assert.equal(bon.status, 200);
  assert.match(bon.body.sale.at, /^2026-01-16T00:3/, 'de kassa stempelt met de klok van het huis (RTG_KLOK)');
  const b = await api('/api/supplier/backoffice', {}, baas);
  assert.equal(b.body.stats.kassaVandaag, 17, 'en de bon van 01:30 lokaal telt bij de omzetdag van gisteren');
  const x = await api('/api/supplier/kassa/kasopmaak', { geteld: 17, kassa: 'Kassa bar' }, baas);
  assert.equal(x.status, 200);
  assert.equal(x.body.opmaak.verwacht, 17, 'de kasopmaak telt hem ook');
});

/* De hotelreceptie (kern/verblijf/receptie.js) en het beveiligingsrooster
   (kern/beveiliging/rooster/planning.js) bouwen een reeks dagen vanaf vandaag.
   Om 00:30 lokale tijd is vandaag al de nieuwe dag, in de zone van de zaak. */
function zaakDagen(klok) {
  const uit = execFileSync(process.execPath, ['-e', `
    const crypto = require('crypto');
    const v = require('./server/kern/verblijf')({ db: { data: {} }, save() {}, crypto,
      schoon: (x, n) => String(x || '').slice(0, n), findSupplier: () => null,
      notify() {}, notifySupplier() {}, sseToSupplier() {}, sseToCustomer() {} });
    const { maakBeveiliging } = require('./server/kern/beveiliging');
    const b = maakBeveiliging({ db: { data: {} }, save() {}, crypto, accounts: { listStaff: () => [] },
      findSupplier: () => null, notify() {}, notifySupplier() {}, sseToSupplier() {}, sseToOffice() {},
      logActivity() {}, haversine: () => 0, afwezigOp: () => null });
    console.log(JSON.stringify({
      hotel: v.kamerplanning({ code: 'H', country: 'ES', rooms: [] }, 7).dagen[0],
      tokio: v.kamerplanning({ code: 'T', tijdzone: 'Asia/Tokyo', rooms: [] }, 7).dagen[0],
      rooster: b.bevRooster({ code: 'B', country: 'NL' }).dagen[0].datum }));`],
  { encoding: 'utf8', cwd: WORTEL, env: { ...process.env, TZ: 'UTC', RTG_KLOK: klok, NODE_ENV: 'test' } });
  return JSON.parse(uit.trim().split('\n').pop());
}

test('receptie en beveiligingsrooster om 00:30 lokale tijd beginnen op de nieuwe dag van de zaak', () => {
  // 22:30 UTC = 00:30 in Madrid en Amsterdam (zomer), 07:30 in Tokio
  assert.deepEqual(zaakDagen('2026-07-15T22:30:00Z'),
    { hotel: '2026-07-16', tokio: '2026-07-16', rooster: '2026-07-16' });
  // 14:30 UTC = 23:30 in Tokio: daar is het nog de 15e, in Europa ook
  assert.deepEqual(zaakDagen('2026-07-15T14:30:00Z'),
    { hotel: '2026-07-15', tokio: '2026-07-15', rooster: '2026-07-15' });
});
