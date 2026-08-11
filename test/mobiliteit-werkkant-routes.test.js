/* ============================================================================
   DE WERKKANT VAN DE MOBILITEIT -- dispatch, pendel, en de PDA van de chauffeur.

   test/mobiliteit.test.js loopt de reizigerskant en de toewijzing af. De acht
   deuren hieronder werden door geen enkele toets geopend, en het zijn juist de
   deuren waar de scheiding tussen twee vervoerders langs loopt: overboeken,
   positie doorgeven, het eigen dispatchbeeld. Een rit van een andere vervoerder
   hoort daar nooit doorheen te komen.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de vervoerder-controle uit ritVanZaak() in routes/mobiliteit.js gehaald
     -> "een vreemde rit is niet van jou" ZAKT (RAAK)
   - de managerOnly uit /api/supplier/mob/overboeken gehaald
     -> "overboeken is een besluit van de leiding" ZAKT (RAAK)
   - de naam-eis uit dispatchTelefoonboeking() gehaald
     -> "een telefonische rit draagt een naam" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/mobiliteit-werkkant-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mobwerk-'));
const OFFICE_CODE = 'KANTOOR-MOBWERK-1';
const ZAAK = 'MKKX';              // de taxizaak uit de demo
let srv, base, baas, chauffeur, lid, RIT;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function moet(pad, body, token, wat) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, wat + ' -- ' + (r.body.error || r.status));
  return r.body;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Mob Werkkant', email: 'mw' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;

  const roster = await api('/api/supplier/roster', { code: ZAAK });
  const mg = (roster.body.staff || []).find(x => x.role === 'manager');
  const ch = (roster.body.staff || []).find(x => x.role !== 'manager');
  baas = (await api('/api/supplier/login', { code: ZAAK, staffId: mg.id, pin: '1234' })).body.token;
  chauffeur = (await api('/api/supplier/login', { code: ZAAK, staffId: ch.id, pin: '5678' })).body.token;
  assert.ok(baas && chauffeur, 'de leiding en de vloer van de taxizaak zijn binnen');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. de dispatcher kiest een bestemming uit onze eigen zaken', async () => {
  const p = await moet('/api/supplier/mob/plekken', { bij: 'Ibiza' }, baas, 'de plekkenlijst');
  assert.ok(Array.isArray(p.plekken) && p.plekken.length > 0, 'er staan plekken in');
  assert.ok(p.plekken.every(x => x.naam), 'elke plek draagt een naam');

  /* Bewust GEEN favorieten: die zijn van het lid en horen niet op het scherm
     van een dispatcher te staan. */
  assert.equal('favorieten' in p, false, 'de dispatcher krijgt geen favorieten van een lid');
});

test('2. een telefonische rit draagt een naam, en komt op naam van deze zaak', async () => {
  const zonder = await api('/api/supplier/mob/telefoon', { van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' },
    naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, baas);
  assert.equal(zonder.status, 400, 'zonder naam wordt de boeking geweigerd');
  assert.match(String(zonder.body.error || ''), /naam/i, zonder.body.error);

  const r = await moet('/api/supplier/mob/telefoon', { naamOpDeRit: 'Mevrouw Blanco',
    telefoon: '0612345678', van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' },
    naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza', reizigers: 2 }, baas, 'een telefonische boeking');
  RIT = (r.opdracht || r.rit || {}).ref;
  assert.ok(RIT, 'de rit krijgt een ref: ' + JSON.stringify(r).slice(0, 200));
  assert.equal((r.opdracht || r.rit).vervoerder, ZAAK, 'en staat meteen op naam van deze zaak');
});

test('3. het eigen dispatchbeeld toont alleen ritten van deze vervoerder', async () => {
  const mijn = await moet('/api/staff/mob/mijn', {}, chauffeur, 'het beeld van de chauffeur');
  const alles = JSON.stringify(mijn);
  assert.ok(alles.includes(RIT), 'de rit van deze zaak staat erin');

  const ritten = []
    .concat(mijn.open || [], mijn.mijn || [], mijn.opdrachten || [], mijn.ritten || []);
  for (const o of ritten) {
    if (o && o.vervoerder) assert.equal(o.vervoerder, ZAAK,
      'geen enkele rit van een andere vervoerder in dit beeld: ' + o.ref);
  }
});

test('4. een vreemde rit is niet van jou', async () => {
  const spook = await api('/api/staff/mob/positie', { ref: 'BESTAAT-NIET', lat: 38.9, lng: 1.4 }, chauffeur);
  assert.equal(spook.status, 404, 'een rit die er niet is, is 404');

  /* Een rit die een REIZIGER aanvraagt heeft nog geen vervoerder; die is dus
     niet van ons, en de PDA hoort er niet aan te kunnen zitten. */
  const vrij = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: { lat: 38.908, lng: 1.432, label: 'Vara de Rey' }, naar: { zaak: 'KIKUNOI' },
    reizigers: 1, stad: 'Ibiza' }, lid);
  assert.equal(vrij.status, 200, JSON.stringify(vrij.body).slice(0, 200));
  const vreemde = await api('/api/staff/mob/positie', { ref: vrij.body.opdracht.ref,
    lat: 38.9, lng: 1.4 }, chauffeur);
  assert.equal(vreemde.status, 403, 'een rit zonder onze naam erop is niet van ons');

  await moet('/api/staff/mob/positie', { ref: RIT, lat: 38.907, lng: 1.431 }, chauffeur,
    'de eigen rit mag wel');
});

test('5. overboeken is een besluit van de leiding, en gaat naar een bestaande partner', async () => {
  const doorDeVloer = await api('/api/supplier/mob/overboeken', { ref: RIT, naar: 'TRANSIT' }, chauffeur);
  assert.equal(doorDeVloer.status, 403, 'de chauffeur boekt geen ritten over');

  const spook = await api('/api/supplier/mob/overboeken', { ref: RIT, naar: 'BESTAATNIET' }, baas);
  assert.equal(spook.status, 404, 'een partner die niet bestaat, krijgt geen rit');

  const uit = await moet('/api/supplier/mob/overboeken', { ref: RIT, naar: 'TRANSIT' }, baas, 'overboeken');
  const o = uit.opdracht || uit.rit || {};
  assert.equal(o.vervoerder, 'TRANSIT', 'de rit staat nu op naam van de partner');
  assert.equal(o.voertuig, null, 'en het voertuig van de vorige vervoerder is eraf');

  const nietMeer = await api('/api/staff/mob/positie', { ref: RIT, lat: 38.9, lng: 1.4 }, chauffeur);
  assert.equal(nietMeer.status, 403, 'na het overboeken komt onze eigen PDA er niet meer bij');
});

test('6. de bedrijfspendel: een lijst per werkgever, en een no-show telt en straft niet', async () => {
  const leeg = await moet('/api/supplier/mob/pendel', {}, baas, 'de pendellijst');
  assert.ok(Array.isArray(leeg.pendels || leeg.diensten || leeg.lijst || []),
    'er komt een lijst terug: ' + Object.keys(leeg).join(', '));

  const spook = await api('/api/supplier/mob/pendel/noshow', { id: 'bestaat-niet',
    reservering: 'x', nietVerschenen: true }, baas);
  assert.equal(spook.status, 404, 'een pendeldienst die er niet is, is 404');
});
