/* HET AANMELDKANAAL -- server/kern/aanmeldkanaal.js (besluit C6).

   Wat hier vastligt, en het kan allemaal zakken:
   1. een aanmelding met een kanaal en een campagnecode wordt geteld, en onder de
      groepsgrens staat er geen getal;
   2. vanaf tien staat het getal er wel;
   3. een onbekend kanaal of een code met een vreemde vorm telt niet, en wordt ook
      niet stil "anders";
   4. er staat NIETS per lid: de opslag bevat geen account, geen codenaam en geen
      sleutel -- alleen tellingen per maand;
   5. na dertien maanden valt een maand weg.

   Draai: node --test test/aanmeldkanaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, eig;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanmeldkanaal-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function meldAan(extra) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const r = await api('/api/auth/register', Object.assign({ name: 'Kanaal ' + u, email: u + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' }, extra));
  assert.ok(r.body.token, 'registreren lukt: ' + JSON.stringify(r.body).slice(0, 120));
  return r.body;
}
const stand = async () => (await api('/api/office/aanmeldkanaal', {}, eig)).body;
const kanaal = (s, naam) => s.kanalen.find(k => k.naam === naam);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eig);
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('1, 2 en 3. geteld langs de groepspoort, en wat niet klopt telt niet', async () => {
  assert.equal((await api('/api/office/aanmeldkanaal', {})).status, 401);
  await meldAan({ aanmeldkanaal: 'vriend', campagne: 'najaar-26' });
  let s = await stand();
  assert.equal(kanaal(s, 'vriend').stand, 'TE_KLEINE_GROEP');
  assert.equal(kanaal(s, 'vriend').aantal, null, 'onder de grens geen getal');
  await meldAan({ aanmeldkanaal: 'nergens' });
  await meldAan({ campagne: 'Jan@Voorbeeld.nl' });
  for (let i = 0; i < 9; i++) await meldAan({ aanmeldkanaal: 'vriend' });
  s = await stand();
  assert.equal(kanaal(s, 'vriend').aantal, 10, 'vanaf tien staat het getal er');
  assert.equal(s.kanalen.find(k => k.naam === 'anders').aantal || 0, 0, 'een onbekend kanaal wordt geen anders');
  assert.ok(!JSON.stringify(s).includes('jan@voorbeeld'), 'een code met een vreemde vorm telt niet');
  assert.ok(Array.isArray(s.dektNiet) && s.dektNiet.length > 0);
});

test('4 en 5. er staat niets per lid, en na dertien maanden valt een maand weg', () => {
  let klok = '2026-01-15T10:00:00Z';
  const db = { data: {} };
  const k = require('../server/kern/aanmeldkanaal')({ db, save: () => {}, nu: () => klok });
  k.aanmeldkanaalTel({ kanaal: 'werkgever', campagne: 'beurs' });
  const plat = JSON.stringify(db.data.aanmeldkanaalTelling);
  assert.deepEqual(Object.keys(db.data.aanmeldkanaalTelling['2026-01']).sort(), ['campagnes', 'kanalen', 'totaal']);
  assert.ok(!/user-|codenaam|key|account/i.test(plat), 'geen spoor van een lid: ' + plat);
  klok = '2027-02-15T10:00:00Z';
  k.aanmeldkanaalTel({ kanaal: 'zoeken' });
  assert.ok(db.data.aanmeldkanaalTelling['2026-01'] === undefined, 'januari 2026 is meer dan dertien maanden oud');
  klok = '2027-02-16T10:00:00Z';
  k.aanmeldkanaalTel({ kanaal: 'zoeken' });
  assert.equal(db.data.aanmeldkanaalTelling['2027-02'].kanalen.zoeken, 2);
});
