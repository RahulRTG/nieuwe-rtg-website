/* DE PUNTEN VAN EEN RIT NA DE RIT (NAVIGATIE.md N16, kern/mobiliteit/ritpunten.js).

   Het besluit: de ritlijn (`trip.location_updated` met lat/lng, en
   `o.positie`) wordt gewist bij afronden of annuleren; afstand, duur en de
   begin- en eindplek zoals op de factuur blijven. Het ophaalpunt is TIJDENS de
   rit exact -- de chauffeur moet je kunnen vinden (N11) -- en wordt bij
   afronden het label van de factuur, zonder coordinaat.

   Deze toets draait tegen een ECHTE server en leest wat de lid- en de
   zaakkant terugkrijgen (/api/mob/volg en /api/supplier/mob/spoor), plus de
   opslag zelf zodra die op schijf staat. De tegenproef staat erbij: TIJDENS de
   rit moeten de punten er juist wel zijn, anders is "na afloop leeg" een
   toets die ook groen staat als er nooit iets werd gevolgd.

   Draai los: node --test test/ritpunten.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const VERVOERDER = 'ISLATR';
const BESTEMMING = 'KIKUNOI';
const OPHAAL = { lat: 38.91234, lng: 1.43456 };      // de live positie van het lid
const PRIK = [{ lat: 38.9131, lng: 1.4362 }, { lat: 38.9142, lng: 1.4388 }];
const FACTUUR_VAN = 'Lobby van het hotel';

let srv, base, M, S;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ritpunten-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// alles wat op een coordinaat lijkt, waar dan ook in een antwoord
function coordinaten(x, pad = '$', uit = []) {
  if (Array.isArray(x)) x.forEach((v, i) => coordinaten(v, pad + '[' + i + ']', uit));
  else if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      if ((k === 'lat' || k === 'lng') && v != null) uit.push(pad + '.' + k + '=' + v);
      else coordinaten(v, pad + '.' + k, uit);
    }
  return uit;
}

/* De opslag van de server zelf (store.db in de datamap, zonder RTG_ENC_KEY
   leesbaar). Zo leest de toets niet alleen wat een route TOONT maar ook wat er
   STAAT -- een wis die alleen in opdrachtBeeld zat, zou hier zakken. Geen
   leesbare opslag is `null` en de toets zegt dat hardop. */
async function opdrachtOpSchijf(ref) {
  const { DatabaseSync } = require('node:sqlite');
  const bestand = path.join(TMP, 'store.db');
  for (let i = 0; i < 30; i++) {
    try {
      const kv = new DatabaseSync(bestand, { readOnly: true });
      try {
        const rij = kv.prepare('SELECT val FROM kv WHERE key = ?').get('mobOpdrachten');
        const o = rij && (JSON.parse(rij.val) || []).find(x => x.ref === ref);
        if (o && o.ritpunten) return o;
      } finally { kv.close(); }
    } catch (e) { /* nog niet geschreven, of versleuteld: opnieuw */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1',
    DEMO_SUPPLIER: VERVOERDER, OFFICE_CODE: 'KANTOOR-RITPUNTEN' } });
  base = srv.base;
  M = (await api('/api/login', { tier: 'rtg' })).body.token;
  S = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(M && S, 'lid en vervoerder loggen in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een app-rit: tijdens de rit exact, na afronden alleen wat op de factuur staat', async (t) => {
  const staf = await api('/api/supplier/staff/add', { name: 'Chauffeur Punten', func: 'chauffeur' }, S);
  const staffId = staf.body.staff && staf.body.staff.id;
  assert.ok(staffId, 'er is een chauffeur (de seed geeft ' + VERVOERDER + ' geen personeel)');

  // het lid staat ergens; dat punt wordt het ophaalpunt (routes/member/onderweg.js)
  assert.equal((await api('/api/live/start', OPHAAL, M)).status, 200);
  const vraag = await api('/api/ride/request',
    { supplierCode: VERVOERDER, toCode: BESTEMMING, passengers: 1, from: FACTUUR_VAN }, M);
  assert.equal(vraag.status, 200, vraag.body.error || '');
  const ride = vraag.body.ride.ref, oref = vraag.body.opdrachtRef;
  assert.ok(oref, 'de rit kreeg een opdracht: ' + (vraag.body.opdrachtReden || ''));
  assert.equal((await api('/api/ride/pay', { ref: ride }, M)).status, 200);
  assert.equal((await api('/api/supplier/ride/assign', { ref: ride, staffId }, S)).status, 200);
  assert.equal((await api('/api/supplier/ride/status', { ref: ride, status: 'onderweg' }, S)).status, 200);
  for (const p of PRIK) assert.equal((await api('/api/staff/mob/positie', Object.assign({ ref: oref }, p), S)).status, 200);

  /* TEGENPROEF (N11): tijdens de rit is alles er. Zonder deze helft staat de
     toets ook groen als de punten nooit werden bewaard. */
  const tijdens = (await api('/api/mob/volg', { ref: oref }, M)).body;
  assert.equal(tijdens.opdracht.van.lat, OPHAAL.lat, 'tijdens de rit is het ophaalpunt exact');
  assert.equal(tijdens.opdracht.van.label, FACTUUR_VAN, 'het vertrekpunt draagt het label van de factuur');
  assert.deepEqual([tijdens.positie.lat, tijdens.positie.lng], [PRIK[1].lat, PRIK[1].lng], 'de live positie staat er');
  const spoorTijdens = (await api('/api/supplier/mob/spoor', { ref: oref }, S)).body.gebeurtenissen;
  assert.equal(spoorTijdens.filter(g => g.soort === 'trip.location_updated' && Number.isFinite(g.lat)).length, 2,
    'de ritlijn bestaat tijdens de rit');
  const km = tijdens.opdracht.km, minuten = tijdens.opdracht.minuten;
  assert.ok(km > 0 && minuten > 0, 'er is een afstand en een duur');

  for (const s of ['aangekomen', 'aan-boord', 'afgerond'])
    assert.equal((await api('/api/supplier/ride/status', { ref: ride, status: s }, S)).status, 200, s);

  const na = (await api('/api/mob/volg', { ref: oref }, M)).body;
  assert.equal(na.opdracht.status, 'voltooid');
  /* ZAKT OP (nagetrokken): de regel `if (VOORBIJ.has(status)) wisRitpunten(o, nu());`
     in voortgang.js weghalen, `delete o.positie;` of `o.van = zonderPunt(o.van);`
     in ritpunten.js weghalen -- alle drie laten hier een coordinaat staan. */
  assert.deepEqual(coordinaten(na), [], 'na afronden staat er nog een coordinaat van de rit bij het lid');
  assert.equal(na.positie, null, 'de laatste positie is na afronden weg');
  assert.equal(na.opdracht.van.lat, undefined, 'het ophaalpunt is na afronden geen coordinaat meer');
  // ZAKT OP (nagetrokken): `ride.from` weghalen uit het label in appbrug.js lijfVan
  assert.equal(na.opdracht.van.label, FACTUUR_VAN, 'het ophaalpunt is het adres van de factuur geworden');
  assert.ok(na.opdracht.naar.label && na.opdracht.naar.zaak === BESTEMMING, 'de eindplek staat er als tekst en zaak');
  // ZAKT OP (nagetrokken): een wisRitpunten die ook km en minuten weghaalt
  assert.equal(na.opdracht.km, km, 'de afstand blijft');
  assert.equal(na.opdracht.minuten, minuten, 'de duur blijft');

  const spoorNa = (await api('/api/supplier/mob/spoor', { ref: oref }, S)).body;
  assert.deepEqual(coordinaten(spoorNa), [], 'de vervoerder ziet na afronden nog ritpunten');
  /* De lijn gaat er als GEBEURTENIS uit, niet alleen als getal: zestig lege
     prikken met een tijdstempel zeggen nog steeds wanneer er gereden werd.
     ZAKT OP (nagetrokken): het `.filter(g => g && g.soort !== PUNT)` in
     ritpunten.js weghalen -- de lat/lng gaan dan wel weg, de prikken niet. */
  assert.equal(spoorNa.gebeurtenissen.filter(g => g.soort === 'trip.location_updated').length, 0,
    'de locatieprikken staan na afronden nog in het spoor');
  assert.ok(spoorNa.gebeurtenissen.some(g => g.soort === 'trip.completed'), 'het spoor van de standen blijft');

  // ZAKT OP (nagetrokken): `|| VOORBIJ.has(o.status)` in opdrachtPositie weghalen -- dan begint de lijn opnieuw
  const laat = await api('/api/staff/mob/positie', Object.assign({ ref: oref }, PRIK[0]), S);
  assert.equal(laat.status, 409, 'na afronden wordt er geen positie meer aangenomen');

  const opSchijf = await opdrachtOpSchijf(oref);
  if (opSchijf) {
    assert.deepEqual(coordinaten(opSchijf), [], 'in de opslag staat nog een coordinaat van deze rit');
    assert.equal(opSchijf.ritpunten.locatiepunten, 2, 'de opslag zegt DAT er twee punten gewist zijn');
  } else {
    t.diagnostic('geen leesbare store.db in de datamap: de opslag is hier alleen via de API gelezen');
  }
});

test('2. annuleren wist ook: een rit die niet doorging laat geen lijn achter', async () => {
  const vraag = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi', vervoerder: VERVOERDER,
    van: { lat: OPHAAL.lat, lng: OPHAAL.lng, label: 'Voordeur' }, naar: { zaak: BESTEMMING }, stad: 'Ibiza' }, M);
  assert.equal(vraag.status, 200, vraag.body.error || '');
  const oref = vraag.body.opdracht.ref;
  assert.equal((await api('/api/staff/mob/positie', Object.assign({ ref: oref }, PRIK[0]), S)).status, 200);
  const tijdens = (await api('/api/mob/volg', { ref: oref }, M)).body;
  assert.ok(coordinaten(tijdens).length >= 3, 'tegenproef: voor het annuleren zijn er punten');

  assert.equal((await api('/api/mob/annuleer', { ref: oref }, M)).status, 200);
  const na = (await api('/api/mob/volg', { ref: oref }, M)).body;
  assert.equal(na.opdracht.status, 'geannuleerd');
  // ZAKT OP (nagetrokken): 'geannuleerd' uit VOORBIJ in ritpunten.js halen
  assert.deepEqual(coordinaten(na), [], 'na annuleren staat er nog een coordinaat van de rit');
  assert.equal(na.opdracht.van.label, 'Voordeur', 'het vertrekpunt blijft als tekst');
});
