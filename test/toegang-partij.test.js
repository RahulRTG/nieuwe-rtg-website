/* WIE NAMENS EEN PARTIJ HANDELT, HEEFT EEN ACCOUNT MET DIE ROL
   (eigenaarsbesluit 19 oktober 2026; vervangt het besluit van 29 september
   2026 "de partij hangt niet aan een RTG-account", en daarmee vervalt proef P3).

   De partijsleutel was de geloofsbrief van de partijdeur. Nu:
     - een nieuwe partij krijgt een EENMALIGE koppelcode: een mens van de partij
       koppelt er zijn (gratis) account mee, en daarna werkt de code niet meer;
     - de partijdeur kent alleen een account met de partijrol; een sleutel
       zonder account opent niets, een account zonder rol ook niet (403);
     - het kantoor maakt een account weer los;
     - MIGRATIE: een partij van voor dit besluit, zonder gekoppeld account, komt
       met haar oude sleutel nog binnen tot er een account aan hangt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakDemocratie } = require('../server/kern/democratie');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const OFFICE_CODE = 'TOEGANG-PARTIJ';
const inschrijving = (aanduiding) => ({ aanduiding, niveau: 'gemeente', categorie: 'geregistreerd',
  bron: 'Register gemeentelijke aanduidingen, besluit 2026-12', gecontroleerd: '2026-10-19' });
let srv, api;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  api = (pad, body, token, kop) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, kop || {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
});
test.after(() => { stop(srv && srv.child); });

test('de partijdeur: een account met de partijrol, de code koppelt een keer', async () => {
  const kantoor = await kantoorAlsPersoon(srv.base, OFFICE_CODE);
  const reg = await api('/api/office/democratie/partij/registreer', inschrijving('Partij Account'), kantoor);
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  const code = reg.body.sleutel;
  const kop = { 'x-partij-sleutel': code };

  assert.equal((await api('/api/democratie/partij/wie', {}, null, kop)).status, 401,
    'een nieuwe partij komt met haar code alleen niet binnen: de code is geen geloofsbrief');
  const a = await registreerGratis(srv.base);
  assert.equal((await api('/api/democratie/partij/wie', {}, a.token)).status, 403, 'een account zonder partijrol');
  assert.equal((await api('/api/democratie/partij/koppel', {}, null, kop)).status, 401, 'koppelen vraagt een account');

  const k = await api('/api/democratie/partij/koppel', {}, a.token, kop);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const wie = await api('/api/democratie/partij/wie', {}, a.token);
  assert.equal(wie.status, 200, JSON.stringify(wie.body));
  assert.equal(wie.body.partij.id, reg.body.partij.id);

  const b = await registreerGratis(srv.base);
  assert.equal((await api('/api/democratie/partij/koppel', {}, b.token, kop)).status, 401, 'de koppelcode werkt een keer');
  assert.equal((await api('/api/democratie/partij/wie', {}, b.token)).status, 403, 'en B heeft dus geen rol');

  const lijst = (await api('/api/office/democratie/partij/lijst', {}, kantoor)).body.partijen.find(p => p.id === reg.body.partij.id);
  assert.equal((lijst.gekoppeld || []).length, 1, 'het kantoor ziet dat er een account aan de partij hangt');
  const los = await api('/api/office/democratie/partij/ontkoppel', { id: reg.body.partij.id, codenaam: lijst.gekoppeld[0].codenaam }, kantoor);
  assert.equal(los.status, 200, JSON.stringify(los.body));
  assert.equal((await api('/api/democratie/partij/wie', {}, a.token)).status, 403, 'na ontkoppelen heeft A geen rol meer');
});

test('migratie: een partij van voor het besluit komt met haar oude sleutel binnen tot er een account aan hangt', async () => {
  const db = { data: {} };
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k, meldLid: (k, n) => n });
  const r = await d.register.registreer('user-kantoor', inschrijving('Partij Oud'));
  // zo stond een partij van voor 19 oktober 2026 in het register: zonder model
  delete db.data.democratiePartijen[r.partij.id].model;
  assert.equal(d.partijVanOudeSleutel(r.sleutel).id, r.partij.id, 'de oude sleutel werkt nog');
  const k = await d.partijKoppel(r.sleutel, 'user-7');
  assert.equal(k.ok, true, JSON.stringify(k));
  assert.equal(d.partijVanOudeSleutel(r.sleutel), null, 'na het koppelen werkt de oude sleutel niet meer');
  assert.equal(d.partijVanAccount('user-7').id, r.partij.id);

  const nieuw = await d.register.registreer('user-kantoor', inschrijving('Partij Nieuw'));
  assert.equal(d.partijVanOudeSleutel(nieuw.sleutel), null, 'een nieuwe partij heeft geen oude sleutel, alleen een koppelcode');
});

/* De koppelingen staan per partij in een hashketen (machinedekking, keuze (a)
   van de integrator, 19 oktober 2026): wie er namens een partij handelde, en
   sinds wanneer niet meer, is niet stil te herschrijven. */
test('koppelen en losmaken staan in de bewijsketen van de partij', async () => {
  const keten = require('../server/lib/keten');
  const db = { data: {} };
  const d = maakDemocratie({ db, save: () => {}, bijeen: async (fn) => fn(), inBundel: () => true, crypto,
    codenaamVan: (k) => 'Codenaam-' + k, meldLid: (k, n) => n });
  const r = await d.register.registreer('user-kantoor', inschrijving('Partij Keten'));
  assert.equal((await d.partijKoppel(r.sleutel, 'user-9')).ok, true);
  assert.equal((await d.register.ontkoppel('user-kantoor', { id: r.partij.id, codenaam: 'Codenaam-user-9' })).ok, true);
  const p = db.data.democratiePartijen[r.partij.id];
  assert.deepEqual(p.rolketen.map(x => x.wat), ['account-los', 'account-gekoppeld'], 'nieuwste eerst, allebei geketend');
  assert.equal(keten.verifieer(p.rolketen).ok, true, 'de keten klopt');
  p.rolketen[1].codenaam = 'Iemand Anders';
  assert.equal(keten.verifieer(p.rolketen).ok, false, 'wie een koppeling achteraf herschrijft, breekt de keten');
});
