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
   de zaak is het nog de omzetdag van de 15e. (Een bon van NU is hier niet te
   maken: de kassa stempelt met de echte klok, niet met RTG_KLOK -- klokschuld
   die KLOK.json telt, niet deze toets.) */
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
