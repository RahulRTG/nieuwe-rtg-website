/* ============================================================================
   DE CHAUFFEUR MELDT, DE REIZIGER BEVESTIGT (kern/mobiliteit/ontvangst.js).

   Besluit van de eigenaar (12 oktober 2026): een chauffeur mag aankomst melden,
   maar dat is geen bevestiging door de reiziger. Hier loopt een echte rit door
   de keten -- reiziger vraagt, de taxizaak wijst toe, de chauffeur zet hem op
   onderweg en aangekomen -- en wordt vastgehouden:
   - de reiziger kan pas bevestigen NA de melding waar zijn bevestiging op slaat;
   - een melding van de chauffeur en een bevestiging van de reiziger staan naast
     elkaar, met elk hun eigen tijd, en worden nooit samengevoegd;
   - alleen de reiziger van DEZE rit zegt iets; een ander lid krijgt 403;
   - een probleem verandert niets aan de rit (geen incident, geen annulering) en
     de dispatch ziet het;
   - nog eens bevestigen of melden verandert niets.
   Draai los: node --test test/mob-ontvangst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mobontvangst-'));
const ZAAK = 'MKKX';
let srv, base, baas, chauffeur, lid, ander, RIT;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}
async function nieuwLid(naam) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 10);
  return (await api('/api/auth/register', { name: naam, email: naam.toLowerCase() + u + '@x.nl',
    phone: '06' + u.slice(-8), password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const beeld = async () => (await moet('/api/mob/volg', { ref: RIT }, lid, 'volgen')).opdracht;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await nieuwLid('Ontvangst'); ander = await nieuwLid('Ander');
  const roster = await api('/api/supplier/roster', { code: ZAAK });
  const mg = (roster.body.staff || []).find(x => x.role === 'manager');
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: mg.id, pin: '1234' })).body.token;
  chauffeur = (await api('/api/supplier/login', { code: ZAAK, staffId: ch.id, pin: '5678' })).body.token;
  assert.ok(lid && ander && baas && chauffeur);
  // een inzetbare wagen; zonder strandt de toewijzing al bij de matcher
  const wagen = await moet('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Ontvangstwagen',
    loc: { lat: 38.909, lng: 1.433 },
    papieren: { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
      taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' } }, baas, 'wagen');
  assert.equal(wagen.asset.inzetbaar, true);
  const vraag = await moet('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' }, naar: { zaak: 'KIKUNOI' }, reizigers: 1, stad: 'Ibiza' }, lid, 'rit aanvragen');
  RIT = vraag.opdracht.ref;
  await moet('/api/supplier/mob/toewijzen', { ref: RIT }, baas, 'toewijzen');
  await moet('/api/staff/mob/status', { ref: RIT, status: 'onderweg' }, chauffeur, 'onderweg');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. voor de chauffeur aankomst meldde, valt er niets te bevestigen', async () => {
  const r = await api('/api/mob/ontvangst', { ref: RIT, wat: 'aankomst' }, lid);
  assert.equal(r.status, 409); assert.match(r.body.error, /nog geen aankomst gemeld/);
  assert.equal((await api('/api/mob/ontvangst', { ref: RIT, wat: 'alles' }, lid)).status, 400);
});

test('2. de chauffeur meldt, de reiziger bevestigt: twee tijden, nooit een vinkje', async () => {
  await moet('/api/staff/mob/status', { ref: RIT, status: 'aangekomen' }, chauffeur, 'aangekomen');
  let o = await beeld();
  assert.ok(o.ontvangst.aankomst.gemeldDoorChauffeur, 'de melding van de chauffeur staat er');
  assert.equal(o.ontvangst.aankomst.bevestigdDoorReiziger, null, 'een melding van de chauffeur is geen bevestiging');
  assert.equal((await api('/api/mob/ontvangst', { ref: RIT, wat: 'aankomst' }, ander)).status, 403, 'een ander lid bevestigt niet');
  assert.equal((await api('/api/mob/ontvangst', { ref: RIT, wat: 'aankomst' })).status, 401);
  const een = await moet('/api/mob/ontvangst', { ref: RIT, wat: 'aankomst' }, lid, 'bevestigen');
  assert.equal(een.gewijzigd, true);
  const tijd = een.ontvangst.aankomst.bevestigdDoorReiziger;
  const twee = await moet('/api/mob/ontvangst', { ref: RIT, wat: 'aankomst' }, lid, 'nog eens');
  assert.equal(twee.gewijzigd, false); assert.equal(twee.ontvangst.aankomst.bevestigdDoorReiziger, tijd, 'de eerste tijd blijft');
  o = await beeld();
  assert.equal(o.status, 'aangekomen', 'de bevestiging schuift de rit niet door');
  assert.ok(o.gebeurtenissen.some(g => g.soort === 'passenger.confirmed_arrival' && g.door === 'reiziger'));
  assert.equal((await api('/api/mob/ontvangst', { ref: RIT, wat: 'aflevering' }, lid)).status, 409, 'aflevering pas na voltooid');
});

test('3. een probleem melden verandert niets aan de rit, en de dispatch ziet het', async () => {
  assert.equal((await api('/api/mob/ontvangst/probleem', { ref: RIT, soort: 'verzonnen' }, lid)).status, 400);
  const r = await moet('/api/mob/ontvangst/probleem', { ref: RIT, soort: 'ander-voertuig', toelichting: 'Een grijze bus in plaats van een sedan.' }, lid, 'melden');
  assert.equal(r.gewijzigd, true); assert.equal(r.ookNu, null);
  const nog = await moet('/api/mob/ontvangst/probleem', { ref: RIT, soort: 'ander-voertuig' }, lid, 'nog eens melden');
  assert.equal(nog.gewijzigd, false);
  const o = await beeld();
  assert.equal(o.status, 'aangekomen', 'geen incident, geen annulering: een mens beslist');
  assert.deepEqual(o.ontvangst.problemen.map(p => p.soort), ['ander-voertuig']);
  const dispatch = await moet('/api/supplier/mob/dispatch', {}, baas, 'dispatchbeeld');
  const tekst = JSON.stringify(dispatch);
  assert.ok(tekst.includes('ander-voertuig'), 'de dispatch ziet de melding van de reiziger');
  const onveilig = await moet('/api/mob/ontvangst/probleem', { ref: RIT, soort: 'onveilig' }, lid, 'onveilig');
  assert.match(onveilig.ookNu, /veiligheidsknop|112/, 'bij onveilig wijst het antwoord naar de snelle weg');
});

test('4. na voltooid bevestigt de reiziger de aflevering apart', async () => {
  for (const s of ['ingestapt', 'rijdt', 'voltooid']) await moet('/api/staff/mob/status', { ref: RIT, status: s }, chauffeur, s);
  let o = await beeld();
  assert.ok(o.ontvangst.aflevering.gemeldDoorChauffeur); assert.equal(o.ontvangst.aflevering.bevestigdDoorReiziger, null);
  await moet('/api/mob/ontvangst', { ref: RIT, wat: 'aflevering' }, lid, 'aflevering bevestigen');
  o = await beeld();
  assert.ok(o.ontvangst.aflevering.bevestigdDoorReiziger);
  assert.equal(o.status, 'voltooid');
});
