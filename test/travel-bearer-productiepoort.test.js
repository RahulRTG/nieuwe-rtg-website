'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const maakPoort = require('../server/middleware/travel-bearer-productiepoort');

function roep(pad, { productie = true, methode = 'POST' } = {}) {
  let status = 200, body = null, door = 0;
  const koppen = {};
  const req = { method:methode, path:new URL(pad, 'https://rtg.test').pathname };
  const res = {
    set(naam, waarde) { koppen[String(naam).toLowerCase()] = String(waarde); return this; },
    status(code) { status = code; return this; },
    json(waarde) { body = waarde; return waarde; }
  };
  maakPoort({ productie })(req, res, () => { door++; });
  return { status, body, door, koppen };
}

test('iedere bekende Travel-bearerissuer, redisclosure en consumer is in productie dicht', () => {
  const gezien = new Set();
  for (const [pad, feature] of maakPoort.PER_ROUTE) {
    const uit = roep(pad + '?code=GEHEIM');
    assert.equal(uit.status, 503, pad);
    assert.equal(uit.door, 0, pad);
    assert.equal(uit.body.code, maakPoort.CODE, pad);
    assert.equal(uit.body.feature, feature, pad);
    assert.doesNotMatch(JSON.stringify(uit.body), /GEHEIM/, pad);
    assert.equal(uit.koppen['cache-control'], 'no-store', pad);
    gezien.add(feature);
  }
  assert.deepEqual([...gezien].sort(), [
    'livingos.invisible_arrival_pass'
  ]);
});

test('de gemigreerde boarding-passketen is in productie selectief vrijgegeven', () => {
  for (const pad of [
    '/api/member/vluchten/boek',
    '/api/member/vluchten/incheck',
    '/api/member/vluchten/mijn',
    '/api/member/vluchten/pass/roteer',
    '/api/member/vluchten/pass/intrek',
    '/api/supplier/lucht/pass',
    '/api/lucht/lounge/in'
  ]) {
    const uit = roep(pad);
    assert.equal(uit.status, 200, pad);
    assert.equal(uit.door, 1, pad);
  }
  assert.equal(roep('/api/arrival/request').status, 503,
    'vrijgeven van boardingpassen opent geen aankomstbewijs');
});

test('de gemigreerde activiteitenkaart en het OV-vervoerbewijs zijn in productie vrijgegeven', () => {
  for (const pad of [
    '/api/ticket/koop', '/api/tickets/mijn', '/api/ticket/toon',
    '/api/supplier/programma', '/api/supplier/ticket/checkin',
    '/api/supplier/ticket/deurverkoop', '/api/supplier/ticket/toon',
    '/api/mob/kaart/koop', '/api/mob/kaart/mijn', '/api/mob/kaart/toon',
    '/api/mob/abo/koop', '/api/mob/abo/mijn', '/api/mob/reis/boek',
    '/api/staff/mob/kaart/controle'
  ]) {
    const uit = roep(pad);
    assert.equal(uit.status, 200, pad);
    assert.equal(uit.door, 1, pad);
  }
  assert.equal(roep('/api/arrival/request').status, 503,
    'vrijgeven van tickets en vervoerbewijzen opent geen aankomstbewijs');
});

test('veilige aangrenzende lezers, intrekkingen en operationele routes blijven open', () => {
  for (const pad of [
    '/api/arrival/interpret',
    '/api/tickets/aanbod',
    '/api/transfer/aanvraag',
    '/api/lucht/lounge/uit',
    '/api/member/vluchten/bord',
    '/api/mob/kaart/aanbod',
    '/api/mob/reis/annuleer',
    '/api/staff/mob/kaart/storing'
  ]) assert.equal(roep(pad).door, 1, pad);
});

test('ontwikkeling, niet-POST en onbekende paden worden niet door deze poort geraakt', () => {
  for (const pad of maakPoort.PER_ROUTE.keys())
    assert.equal(roep(pad, { productie:false }).door, 1, pad);
  assert.equal(roep('/api/arrival/request', { methode:'GET' }).door, 1);
  assert.equal(roep('/api/onbekend').door, 1);
});

test('Express-equivalente hoofdletters, encoding en eindslash omzeilen de poort niet', () => {
  for (const pad of [
    '/API/ARRIVAL/REQUEST/',
    '/api/supplier/horeca/%61rrivals',
    '/api/arrival/%70ass/?x=1',
    '/api/arrival/pulse/'
  ]) assert.equal(roep(pad).status, 503, pad);
});

test('de productierem staat eenmalig vóór idemopslag en domeinhandlers', () => {
  const lijf = fs.readFileSync(path.join(__dirname, '..', 'server/opzet/lijfpoort.js'), 'utf8');
  const regel = "require('../middleware/travel-bearer-productiepoort')()";
  const plek = lijf.indexOf(regel);
  assert.ok(plek > lijf.indexOf("express.json({ limit: '8mb' })"));
  assert.ok(plek < lijf.indexOf("require('../lib/idem-poort')()"));
  assert.equal(lijf.split(regel).length - 1, 1);
});

test('hard sluiten wordt niet als gemigreerde lifecycle verkocht', () => {
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'CODECREDENTIALS.json'), 'utf8'));
  for (const id of [
    'livingos.invisible_arrival_pass'
  ]) {
    const deur = register.deuren.find(x => x.id === id);
    assert.ok(deur, id);
    assert.equal(deur.status, 'remaining', id);
    assert.equal(deur.release_blocker, true, id);
  }
  for (const id of ['travelos.airport_boarding_pass', 'travelos.activity_ticket_entry',
    'travelos.mobility_transport_ticket']) {
    const deur = register.deuren.find(x => x.id === id);
    assert.ok(deur, id);
    assert.equal(deur.status, 'migrated', id);
    assert.equal(deur.release_blocker, false, id);
  }
});
