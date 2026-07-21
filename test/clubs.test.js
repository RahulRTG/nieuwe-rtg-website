/* RTG Clubs: de golf- en countryclub (Sa Roca) en de sport- en fitnessclub
   (Fortia). Bewaakt de tee sheet zonder dubbele flights, de lessen van de
   pro's, de maandbeker met vol-is-vol, de baanstatus, de ledenpas met
   check-in, groepslessen met capaciteit, baanboekingen zonder overlap,
   personal training en de cap-poorten.
   Draai los: node --experimental-sqlite --test test/clubs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, golf, fit, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-club-'));
const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  golf = await supLogin('SAROCA');
  fit = await supLogin('FORTIA');
  resto = await supLogin('KIKUNOI');
  assert.ok(golf && fit && resto, 'de club-secretaris, de clubmanager en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de golfclub op een scherm: baan, pro\'s, wedstrijdkalender en KPI\'s', async () => {
  const r = await api('supplier/golf', {}, golf);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, 'Club de Golf Sa Roca');
  assert.ok(r.body.holes === 18 && r.body.par === 72 && r.body.baanStatus === 'open');
  assert.ok(r.body.pros.length >= 2 && r.body.wedstrijden.length >= 1);
});

test('2. de tee sheet: boeken kan, dezelfde starttijd twee keer niet', async () => {
  const boek = await api('supplier/golf/tee', { naam: 'Flight Vermeer', datum: morgen, tijd: '09:10', spelers: 3 }, golf);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.teetime.prijs, 3 * 95, 'drie spelers maal de greenfee');
  const dubbel = await api('supplier/golf/tee', { naam: 'Flight Kuipers', datum: morgen, tijd: '09:10', spelers: 2 }, golf);
  assert.equal(dubbel.status, 409, 'een vergeven tee wordt geweigerd');
  assert.match(dubbel.body.error, /al vergeven/);
  assert.equal((await api('supplier/golf/tee', { naam: 'Vijf man', datum: morgen, tijd: '09:20', spelers: 5 }, golf)).status, 400, 'een flight is maximaal 4');
});

test('3. de pro geeft les, maar staat niet op twee plekken tegelijk', async () => {
  const o = await api('supplier/golf', {}, golf);
  const pro = o.body.pros[0];
  const les = await api('supplier/golf/les', { proId: pro.id, naam: 'Julia Berg', datum: morgen, tijd: '14:00' }, golf);
  assert.equal(les.status, 200);
  assert.equal(les.body.les.prijs, pro.prijs);
  assert.equal((await api('supplier/golf/les', { proId: pro.id, naam: 'Daan Kuipers', datum: morgen, tijd: '14:00' }, golf)).status, 409);
  const klaar = await api('supplier/golf/les/klaar', { id: les.body.les.id }, golf);
  assert.equal(klaar.body.les.status, 'gegeven');
});

test('4. de maandbeker: inschrijven, dubbel niet, en de greenkeeper sluit de baan', async () => {
  const o = await api('supplier/golf', {}, golf);
  const w = o.body.wedstrijden[0];
  const inschr = await api('supplier/golf/wedstrijd/in', { wedstrijdId: w.id, naam: 'Lotte Vermeer', handicap: 12.4 }, golf);
  assert.equal(inschr.status, 200);
  assert.equal(inschr.body.wedstrijd.inschrijvingen[0].handicap, 12.4);
  assert.equal((await api('supplier/golf/wedstrijd/in', { wedstrijdId: w.id, naam: 'lotte vermeer' }, golf)).status, 409, 'dezelfde speler maar een keer');
  assert.equal((await api('supplier/golf/baan', { status: 'onderhoud' }, golf)).body.baanStatus, 'onderhoud');
  assert.equal((await api('supplier/golf/tee', { naam: 'X', datum: morgen, tijd: '10:00', spelers: 2 }, golf)).status, 409, 'geen teetimes op een dichte baan');
  await api('supplier/golf/baan', { status: 'open' }, golf);
});

test('5. de fitnessclub: lid met clubpas, check-in en check-uit', async () => {
  const r = await api('supplier/fitclub', {}, fit);
  assert.equal(r.body.naam, 'Fortia Club');
  assert.ok(r.body.kpi.leden >= 3 && r.body.lessen.length >= 3);
  const lid = await api('supplier/fitclub/lid', { naam: 'Julia Berg', soort: 'maand' }, fit);
  assert.equal(lid.status, 200);
  assert.match(lid.body.lid.pas, /^F-[0-9A-F]{4}$/, 'elke inschrijving krijgt een clubpas');
  assert.equal(lid.body.prijs, 89);
  assert.equal((await api('supplier/fitclub/lid', { naam: 'julia berg', soort: 'dag' }, fit)).status, 409, 'niet twee keer lid');
  const id = lid.body.lid.id;
  assert.equal((await api('supplier/fitclub/checkin', { id }, fit)).body.lid.binnen, true);
  assert.equal((await api('supplier/fitclub/checkin', { id }, fit)).status, 409, 'wie binnen is checkt niet nog eens in');
  assert.equal((await api('supplier/fitclub/checkout', { id }, fit)).body.lid.binnen, false);
});

test('6. groepslessen met vol-is-vol en banen zonder overlap', async () => {
  const o = await api('supplier/fitclub', {}, fit);
  const spin = o.body.lessen.find(l => l.naam === 'Spinning');
  for (let i = 0; i < spin.capaciteit; i++) {
    assert.equal((await api('supplier/fitclub/les/in', { lesId: spin.id, naam: 'Deelnemer ' + i }, fit)).status, 200);
  }
  assert.equal((await api('supplier/fitclub/les/in', { lesId: spin.id, naam: 'Te laat' }, fit)).status, 409, 'de les zit vol');
  const baan = await api('supplier/fitclub/baan', { baanId: 'b1', naam: 'Amira Sol', datum: morgen, van: '17:00', tot: '18:30' }, fit);
  assert.equal(baan.status, 200);
  assert.equal(baan.body.boeking.prijs, 36, 'anderhalf uur maal de baanprijs');
  assert.equal((await api('supplier/fitclub/baan', { baanId: 'b1', naam: 'Daan', datum: morgen, van: '18:00', tot: '19:00' }, fit)).status, 409, 'overlap wordt geweigerd');
  assert.equal((await api('supplier/fitclub/baan', { baanId: 'b2', naam: 'Daan', datum: morgen, van: '18:00', tot: '19:00' }, fit)).status, 200, 'de andere baan kan wel');
});

test('7. personal training: aanvraag, ingepland, afgerond', async () => {
  const p = await api('supplier/fitclub/pt', { naam: 'Daan Kuipers', doel: 'Marathon in oktober.' }, fit);
  assert.equal(p.status, 200);
  assert.equal(p.body.aanvraag.status, 'aangevraagd');
  assert.equal((await api('supplier/fitclub/pt/status', { id: p.body.aanvraag.id, status: 'ingepland' }, fit)).body.aanvraag.status, 'ingepland');
  assert.equal((await api('supplier/fitclub/pt/status', { id: p.body.aanvraag.id, status: 'afgerond' }, fit)).body.aanvraag.status, 'afgerond');
});

test('8. de poorten: zonder de juiste cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/golf', {}, resto)).status, 403, 'een restaurant heeft geen tee sheet');
  assert.equal((await api('supplier/fitclub', {}, golf)).status, 403, 'de golfclub is geen fitnessclub');
  assert.equal((await api('supplier/golf')).status, 401);
  assert.equal((await api('supplier/fitclub')).status, 401);
});
