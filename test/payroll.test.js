/* RTG Payroll: het loonkantoor draait de personeelsbetalingen op de data
   die het platform al heeft (klok, rollen, fiscale landtabellen), en de
   matchtafel linkt medewerkers en bedrijven -- maar alleen wie zichzelf
   "open voor werk" zet, is vindbaar.
   Draai: node --test test/payroll.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

/* ---------- 1. de rekensom, puur (kern-fabriek met een stub-db) ---------- */
test('de loonrun rekent: geklokte uren x uurloon + vakantiegeld - loonheffing, nooit onder het minimumloon', () => {
  const periode = '2026-07';
  const db = { data: {
    klok: { ZAAK: [
      { staffId: 1, in: '2026-07-03T09:00:00.000Z', out: '2026-07-03T19:00:00.000Z' }, // 10 uur
      { staffId: 1, in: '2026-06-30T09:00:00.000Z', out: '2026-06-30T12:00:00.000Z' }, // andere periode
      { staffId: 2, in: '2026-07-04T09:00:00.000Z', out: null }                        // nog open: telt niet
    ] },
    suppliers: [{ code: 'ZAAK', name: 'Testzaak', city: 'Ibiza', type: 'restaurant', settings: { land: 'NL' } }],
    supplierTypes: { restaurant: { label: 'Restaurant' } }
  } };
  const { payroll } = require('../server/kern/payroll')({
    db, save: () => {}, crypto: require('crypto'),
    accounts: { listStaff: () => [{ id: 1, name: 'Mees Manager', role: 'manager' }, { id: 2, name: 'Sam Bediening', role: 'staff' }] },
    LANDEN: { NL: { naam: 'Nederland', lasten: 0.25, vakantiegeld: 0.08, uurloonMin: 14 } },
    klokVan: () => ({ weekUren: 20 }), openVacatures: () => [], findSupplier: c => db.data.suppliers.find(s => s.code === c)
  });
  const r = payroll.loonrun('ZAAK', periode, 'test');
  assert.equal(r.ok, true);
  const mees = r.run.regels.find(x => x.staffId === 1);
  assert.equal(mees.uren, 10, 'alleen de afgesloten uren van juli tellen');
  assert.equal(mees.uurloon, 22.4, 'manager: 1,6x het minimumloon van het land');
  assert.equal(mees.bruto, 224);
  assert.equal(mees.vakantiegeld, 17.92);
  assert.equal(mees.loonheffing, 89.51);
  assert.equal(mees.netto, 152.41, 'netto = bruto + vakantiegeld - loonheffing');
  const sam = r.run.regels.find(x => x.staffId === 2);
  assert.equal(sam.uren, 0, 'een open klokrit telt nog niet mee');
  assert.equal(sam.uurloon, 16.1, 'staf: 1,15x het minimumloon, nooit eronder');
  // dezelfde periode twee keer draaien kan niet
  assert.equal(payroll.loonrun('ZAAK', periode, 'test').status, 409);
  assert.equal(payroll.loonrun('ZAAK', 'kwartaal-3', 'test').status, 400);
  // de loonstrook van Mees is terug te vinden
  const stroken = payroll.strokenVan('ZAAK', 1);
  assert.equal(stroken[0].regel.netto, 152.41);
});

/* ---------- 2. het kantoor en de matchtafel, end-to-end ---------- */
let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-payr-'));
let child, officeToken, esvedraManager, kikunoiStaf;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  officeToken = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  const rosterE = await json(await api('/api/supplier/roster', { code: 'ESVEDRA' }));
  const manE = rosterE.staff.find(x => x.role === 'manager');
  esvedraManager = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: manE.id, pin: '1234' }))).token;
  const rosterK = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const stafK = rosterK.staff.find(x => x.role !== 'manager');
  kikunoiStaf = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: stafK.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het kantoor ziet wie waar werkt (met past-signaal) en draait een loonrun per zaak', async () => {
  const o = await json(await api('/api/office/payroll/overzicht', {}, officeToken));
  assert.ok(o.mensen.length > 10, 'alle medewerkers over alle zaken');
  assert.ok(o.mensen.every(m => ['overbelast', 'rustig', 'in balans'].includes(m.past)), 'elk een past-signaal');
  assert.ok(o.zaken.some(z => z.code === 'KIKUNOI'));
  const periode = new Date().toISOString().slice(0, 7);
  const run = await json(await api('/api/office/payroll/loonrun', { code: 'KIKUNOI', periode }, officeToken));
  assert.ok(run.run.regels.length > 0, 'elke medewerker een loonstrook-regel');
  assert.match(run.run.status, /RTG Pay/);
  assert.equal((await api('/api/office/payroll/loonrun', { code: 'KIKUNOI', periode }, officeToken)).status, 409);
  // de medewerker ziet zijn eigen strook in de personeels-app
  const stroken = await json(await api('/api/supplier/payroll/stroken', {}, kikunoiStaf));
  assert.equal(stroken.stroken[0].periode, periode);
});

test('de matchtafel: onvindbaar tot je jezelf open voor werk zet, daarna gelinkt aan passende bedrijven', async () => {
  // Es Vedra zoekt een gids; niemand staat nog open voor werk
  await api('/api/supplier/vacature', { func: 'Gastheer rondvaart', omschrijving: 'Gasten ontvangen op de boot, service en bediening aan boord.',
    plaats: 'Ibiza', uren: '16-24 u/w', soort: 'parttime' }, esvedraManager);
  const dicht = await json(await api('/api/office/payroll/match', {}, officeToken));
  assert.ok(dicht.vacatures.every(v => !v.kandidaten.length), 'niemand is vindbaar zonder eigen keuze');
  // de Sal de Mar-medewerker zet zichzelf open voor werk, met een wens
  await api('/api/supplier/payroll/openvoorwerk', { aan: true, wens: 'service en bediening op het water' }, kikunoiStaf);
  const kansen = await json(await api('/api/supplier/payroll/kansen', {}, kikunoiStaf));
  assert.equal(kansen.open, true);
  assert.ok(kansen.kansen.some(k => k.func === 'Gastheer rondvaart'), 'de matchlaag suggereert het passende bedrijf');
  const open = await json(await api('/api/office/payroll/match', {}, officeToken));
  const vac = open.vacatures.find(v => v.vacature.func === 'Gastheer rondvaart');
  assert.ok(vac.kandidaten.length >= 1, 'de vacature krijgt nu een kandidaat-suggestie');
  assert.ok(!vac.kandidaten[0].naam.includes(' '), 'op de matchtafel alleen de voornaam');
  // schakelaar weer uit: meteen weer onvindbaar
  await api('/api/supplier/payroll/openvoorwerk', { aan: false }, kikunoiStaf);
  const weer = await json(await api('/api/office/payroll/match', {}, officeToken));
  const vac2 = weer.vacatures.find(v => v.vacature.func === 'Gastheer rondvaart');
  assert.equal(vac2.kandidaten.length, 0, 'uit = uit');
});
