'use strict';
/* DE BESTUURDER VAN EEN TAXI KAN AAN EEN TEAMLID HANGEN, EN DAN LEEST DE
   MATCHER VERZUIM (kern/mobiliteit/bestuurder.js, PLANNING.md par. 6).

   Tegen een echte server, met de taxizaak MKKX uit de zaaiset. Staat de
   bestuurder vandaag als afwezig gemeld, dan slaat de automatische toewijzing
   zijn voertuig over -- met de reden erbij -- maar blijft het voertuig
   inzetbaar: de centrale die toch met de hand toewijst mag dat, en krijgt een
   waarschuwing. Overal staat DAT hij afwezig is, nooit waarom. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const STAD = { lat: 38.908, lng: 1.432 };
const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };

test('een afwezige bestuurder: overgeslagen door de matcher, met de hand toe te wijzen met waarschuwing', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taxiverzuim-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const login = async (code, manager) => {
    const staff = (await api('supplier/roster', { code })).body.staff;
    const wie = staff.find(x => (x.role === 'manager') === manager);
    return { wie, tok: (await api('supplier/login', { code, staffId: wie.id, pin: manager ? '1234' : '5678' })).body.token };
  };
  try {
    const baas = await login('MKKX', true), ch = await login('MKKX', false), ander = await login('MACE', false);
    const u = String(Date.now()).slice(-8);
    const lid = (await api('auth/register', { name: 'Taxi Lid', email: 'taxiverzuim' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;

    const zet = await api('supplier/mob/voertuig', { categorie: 'taxi', naam: 'Verzuimtaxi', papieren: PAPIEREN_OK,
      loc: STAD, bestuurder: 'Een andere naam', bestuurderStaffId: ch.wie.id }, baas.tok);
    assert.equal(zet.status, 200, JSON.stringify(zet.body));
    const as = zet.body.asset;
    assert.equal(as.bestuurder, ch.wie.name, 'de naam komt uit het team, niet uit het veld');
    assert.equal(as.bestuurderStaffId, ch.wie.id);
    assert.equal(as.bestuurderAfwezig, undefined);

    assert.equal((await api('supplier/mob/voertuig', { id: as.id, bestuurderStaffId: 999999 }, baas.tok)).status, 404,
      'een onbekend teamlid wordt geweigerd');
    assert.equal((await api('supplier/mob/voertuig', { id: as.id, bestuurderStaffId: ander.wie.id }, baas.tok)).status, 404,
      'een medewerker van een ANDERE zaak is geen teamlid');

    const rit = async () => (await api('mob/vraag', { ritsoort: 'direct', categorie: 'taxi', van: STAD,
      naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid)).body.opdracht.ref;
    const afgewezenOp = (v) => (v.body.afgewezen || []).find(x => x.assetId === as.id);

    const ref1 = await rit();
    const voor = await api('supplier/mob/voorstel', { ref: ref1 }, baas.tok);
    assert.equal(voor.status, 200, JSON.stringify(voor.body));
    assert.ok(!afgewezenOp(voor), 'wie er gewoon is, wordt niet overgeslagen: ' + JSON.stringify(afgewezenOp(voor)));

    assert.equal((await api('staff/leave/request', { soort: 'ziek' }, ch.tok)).status, 200);

    const vloot = await api('supplier/mob/vloot', {}, baas.tok);
    const mijn = vloot.body.assets.find(a => a.id === as.id);
    assert.equal(mijn.bestuurderAfwezig, true, 'de vloot zegt DAT de bestuurder afwezig is');
    assert.equal(mijn.inzetbaar, true, 'het voertuig zelf blijft in orde');
    assert.ok(vloot.body.team.some(m => m.id === ch.wie.id), 'de manager krijgt het team om uit te kiezen');
    assert.doesNotMatch(JSON.stringify(vloot.body), /ziek/i, 'DAT, nooit waarom');
    assert.equal((await api('supplier/mob/vloot', {}, ch.tok)).body.team, undefined, 'een medewerker krijgt de teamlijst niet');

    const ref2 = await rit();
    const na = await api('supplier/mob/voorstel', { ref: ref2 }, baas.tok);
    const weg = afgewezenOp(na);
    assert.ok(weg, 'de matcher slaat het voertuig over');
    assert.match(weg.redenen.join(' '), /afwezig/);
    assert.doesNotMatch(JSON.stringify(na.body), /ziek/i);
    assert.ok(!(na.body.kandidaten || []).some(k => k.assetId === as.id));

    const hand = await api('supplier/mob/toewijzen', { ref: ref2, assetId: as.id }, baas.tok);
    assert.equal(hand.status, 200, 'een mens mag toch toewijzen: ' + JSON.stringify(hand.body));
    assert.match(hand.body.afwezigWaarschuwing || '', /als afwezig gemeld/);
    assert.doesNotMatch(hand.body.afwezigWaarschuwing, /ziek/i);

    const los = await api('supplier/mob/voertuig', { id: as.id, bestuurderStaffId: null }, baas.tok);
    assert.equal(los.body.asset.bestuurderStaffId, null);
    assert.equal(los.body.asset.bestuurder, null);
    assert.equal(los.body.asset.bestuurderAfwezig, undefined, 'zonder teamlid kent het register niemand');
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
