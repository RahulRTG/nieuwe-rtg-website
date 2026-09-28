'use strict';
/* RTG Vrijheid en RTG zelf als werkgever, tegen een ECHTE server: de montage,
   de deuren en de duurzame weg -- wat een nagemaakte app niet bewijst (LAT.md,
   regel 17). De motor zelf staat in test/vrijheid.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijheid-'));
const CODE = 'KANTOOR-VRIJHEID';
let srv, base, baas, medewerker, kantoor, eigenaar;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => { let b = {}; try { b = JSON.parse(await r.text()); } catch (e) {} return { status: r.status, body: b }; });

async function inlog(code, rol, pin) {
  const rooster = await api('supplier/roster', { code });
  const m = (rooster.body.staff || []).find(x => x.role === rol);
  const r = await api('supplier/login', { code, staffId: m.id, pin });
  assert.ok(r.body.token, rol + ' van ' + code + ' is binnen');
  return { token: r.body.token, staffId: String(m.id) };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_OWNER_EMAIL: '' } });
  base = srv.base;
  baas = await inlog('KIKUNOI', 'manager', '1234');
  medewerker = await inlog('KIKUNOI', 'staff', '5678');
  kantoor = (await api('office/login', { code: CODE })).body.token;
  eigenaar = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(kantoor && eigenaar);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('Mijn tijd: de medewerker ziet zijn tijd en wat het systeem NIET weet', async () => {
  assert.equal((await api('staff/tijd', {})).status, 401);
  const r = await api('staff/tijd', {}, medewerker.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.verjaardag, null);
  assert.ok(r.body.ontbreekt.some(z => /verantwoordelijkheden/.test(z)), 'de werkstand is eerlijk onbekend');
  assert.ok(r.body.beleidOpen.includes('rtgDag.perJaar'), 'een gewone zaak leent het RTG-beleid niet');
});

test('de verjaardag geeft de medewerker zelf op, en hij bestaat na het antwoord', async () => {
  assert.equal((await api('staff/tijd/verjaardag', { mmdd: '14-40' }, medewerker.token)).status, 400);
  assert.equal((await api('staff/tijd/verjaardag', { mmdd: '10-06' }, medewerker.token)).status, 200);
  assert.equal((await api('staff/tijd', {}, medewerker.token)).body.verjaardag, '10-06');
  assert.equal((await api('staff/tijd/verjaardag', { mmdd: null }, medewerker.token)).status, 200);
  assert.equal((await api('staff/tijd', {}, medewerker.token)).body.verjaardag, null, 'en hij haalt hem weer weg');
});

test('een verzoek: de persoon komt uit de sessie, en zonder dienstverband is het BLOCKED met de reden', async () => {
  const datum = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  assert.equal((await api('staff/tijd/verzoek', { soort: 'OPSTAND', datum }, medewerker.token)).status, 400);
  const r = await api('staff/tijd/verzoek', { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', datum, persoon: baas.staffId }, medewerker.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.verzoek.persoon, medewerker.staffId, 'een persoon in het lichaam wordt genegeerd');
  assert.equal(r.body.verzoek.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.ok(r.body.verzoek.stappen[0].uitleg, 'de weigering draagt een zin');
  const u = await api('staff/tijd/uitleg', { id: r.body.verzoek.id }, medewerker.token);
  assert.equal(u.status, 200);
  assert.equal((await api('staff/tijd/uitleg', { id: r.body.verzoek.id }, baas.token)).status, 404, 'een ander leest je uitleg niet');
});

test('de leidinggevende: overzicht en bezetting op eigen naam, een medewerker komt er niet in', async () => {
  assert.equal((await api('supplier/tijd/overzicht', {}, medewerker.token)).status, 403);
  const o = await api('supplier/tijd/overzicht', {}, baas.token);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.ok(Array.isArray(o.body.wachtend));
  assert.equal(o.body.kamers, null, 'KIKUNOI is niet RTG zelf, dus er zijn geen kamers');
  assert.equal((await api('supplier/tijd/bezetting', { eisen: [{ weekdag: 9 }] }, baas.token)).status, 422);
  const eis = { weekdag: 1, van: '09:00', tot: '17:00', minBezetting: 2, vereist: { KASSA_L3: 1 } };
  assert.equal((await api('supplier/tijd/bezetting', { eisen: [eis] }, baas.token)).status, 200);
  assert.deepEqual((await api('supplier/tijd/overzicht', {}, baas.token)).body.eisen[0].vereist, { KASSA_L3: 1 });
  assert.equal((await api('supplier/tijd/feestdagen', { feestdagen: ['2026-12-25'] }, medewerker.token)).status, 403);
  assert.equal((await api('supplier/tijd/beoordeel', { id: 'bestaatniet', besluit: 'APPROVED' }, baas.token)).status, 404);
});

test('RTG zelf als werkgever: het kantoor ziet de stand, alleen de boardroom maakt hem, en er is er een', async () => {
  const stand = await api('office/rtghuis', {}, kantoor);
  assert.equal(stand.status, 200);
  assert.equal(stand.body.bestaat, false);
  assert.ok(stand.body.afdelingen.includes('financien'), 'de kamers komen uit het afdelingsregister');
  assert.equal((await api('office/rtghuis/maak', { beheerder: 'X' }, kantoor)).status, 403, 'het anonieme kantoor maakt geen werkgever');
  assert.equal((await api('office/rtghuis/maak', { beheerder: 'X' }, eigenaar)).status, 409, 'zonder bestaand account geen leidinggevende');
  const u = Date.now().toString().slice(-8);
  const lid = await api('auth/register', { name: 'Ria Kantoor', email: 'ria' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(lid.body.token);
  const r = await api('office/rtghuis/maak', { beheerder: 'Ria', beheerderLogin: 'ria' + u + '@x.nl' }, eigenaar);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.zaak.online, false);
  assert.equal(r.body.zaak.wereld, 'rtg-intern');
  assert.equal((await api('office/rtghuis/maak', { beheerder: 'Ria', beheerderLogin: 'ria' + u + '@x.nl' }, eigenaar)).status, 409);
  assert.equal((await api('office/rtghuis', {}, kantoor)).body.bestaat, true);
  assert.equal((await api('supplier/rtg/afdelingen', {}, baas.token)).status, 404, 'een restaurant heeft geen kamers');
  assert.equal((await api('supplier/rtg/afdeling', { staffId: medewerker.staffId, kamers: ['hr'] }, baas.token)).status, 404);
});

/* DE DUBBELTIK-RONDE waar de contracten in server/lib/mutatiecontracten-vrijheid.js
   op rusten: elke schrijfweg twee keer met hetzelfde lijf, en kijken wat er
   bleef staan. */
test('dubbeltik: toewijzingen blijven een, een verzoek met sleutel komt terug, zonder sleutel is het een nieuwe vraag', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await api('staff/tijd/verjaardag', { mmdd: '11-11' }, medewerker.token)).status, 200);
  assert.equal((await api('staff/tijd', {}, medewerker.token)).body.verjaardag, '11-11');
  const eis = { weekdag: 2, van: '10:00', tot: '18:00', minBezetting: 1 };
  for (let i = 0; i < 2; i++) assert.equal((await api('supplier/tijd/bezetting', { eisen: [eis] }, baas.token)).status, 200);
  assert.equal((await api('supplier/tijd/overzicht', {}, baas.token)).body.eisen.length, 1);
  for (let i = 0; i < 2; i++) assert.equal((await api('supplier/tijd/feestdagen', { feestdagen: ['2026-12-25'] }, baas.token)).status, 200);
  assert.deepEqual((await api('supplier/tijd/overzicht', {}, baas.token)).body.feestdagen, ['2026-12-25']);
  const datum = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const lijf = { soort: 'VRIJE_DAG', categorie: 'STATUTORY_LEAVE', datum, sleutel: 'dubbel-1' };
  const a = await api('staff/tijd/verzoek', lijf, medewerker.token);
  const b = await api('staff/tijd/verzoek', lijf, medewerker.token);
  assert.equal(b.body.herhaling, true);
  assert.equal(b.body.verzoek.id, a.body.verzoek.id, 'met sleutel: hetzelfde verzoek terug');
  const { sleutel, ...zonder } = lijf; void sleutel;
  const c = await api('staff/tijd/verzoek', zonder, medewerker.token);
  const d = await api('staff/tijd/verzoek', zonder, medewerker.token);
  assert.notEqual(c.body.verzoek.id, d.body.verzoek.id, 'zonder sleutel en na een weigering: een nieuwe vraag');
  assert.equal(d.body.verzoek.stand, 'DECLINED');
  assert.equal((await api('staff/tijd/intrekken', { id: d.body.verzoek.id }, medewerker.token)).status, 409, 'een weigering trek je niet in');
});
