/* DE ONLINE TERUGGAVE OP EEN ECHTE SERVER (kern/horeca/teruggave.js).

   Waarom een eigen toets naast test/horeca-teruggave.test.js: de online weg
   loopt via de betaalwaarheid, en die moet het supplier-domein door de
   domeingrens (GRENZEN.json) kunnen bereiken. routes/supplier/horeca.js kopieert
   de kern met Object.assign, en dat neemt een naam die de grens niet toestaat
   STIL niet mee -- de route kreeg dan `undefined` en elke online teruggave
   mislukte, terwijl de kerntoets met een nagemaakte betaalwaarheid groen stond.
   Alleen een echte server ziet dat.

   De betaling loopt over de testprovider `magnaat-test`, zoals in
   test/gastbezorging.test.js.

   Draai los: node --test test/horeca-teruggave-online.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecateruggave-online-'));

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een online betaalde bestelling: de manager betaalt terug via de provider, en de rekening klopt weer', async () => {
  const u = String(Date.now()) + Math.floor(Math.random() * 1000);
  const lid = (await api('/api/auth/register', { name: 'Online teruggave', email: 'ot' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(-8), password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const start = await api('/api/gegevens/start', { soort: 'bezorging' }, lid);
  if (start.body && start.body.id) await api('/api/gegevens/zeg', { id: start.body.id, tekst: 'Damstraat 1, 1011AB Amsterdam' }, lid);

  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const MGR = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  await api('/api/supplier/horeca/bezorg/zone', { open: true, zones: [
    { id: 'z1', naam: 'Centrum', postcodes: ['1011'], kosten: 3.5, minimum: 15, gratisVanaf: 40, minuten: 30 }] }, MGR);
  await api('/api/supplier/horeca/bezorg/sloten', { sloten: { '18:00': 60, '19:00': 60 } }, MGR);

  const kaart = (await api('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, lid)).body.kaart;
  const item = kaart.filter(k => !k.alcohol && !k.uitverkocht).sort((a, b) => b.centen - a.centen)[0];
  const bestel = await api('/api/gast/bezorg/bestel', { zaak: 'KIKUNOI', postcode: '1011AB', adres: 'Damstraat 1',
    idem: 'ot-order', betalingWijze: 'online', items: [{ itemId: item.id, aantal: 2 }] }, lid);
  assert.equal(bestel.status, 200, JSON.stringify(bestel.body).slice(0, 200));
  const rekeningId = bestel.body.rekening.rekeningId;
  const betaal = await api('/api/gast/bezorg/betaling/start', { zaak: 'KIKUNOI', rekeningId, idem: 'ot-betaal', aanbieder: 'magnaat-test' }, lid);
  assert.equal(betaal.body.betaling.status, 'BEVESTIGD', JSON.stringify(betaal.body).slice(0, 200));

  const rek = (await api('/api/supplier/horeca/rekening', { rekeningId }, MGR)).body.rekening;
  const betaling = rek.betalingen.find(b => b.waarheidId);
  assert.ok(betaling, 'de online betaling staat op de rekening');
  const corr = await api('/api/supplier/horeca/rekening/regel/corrigeer',
    { rekeningId, regelId: rek.regels[0].id, grond: 'niet-gebracht', reden: 'de bezorger kwam niet aan' }, MGR);
  assert.equal(corr.status, 200, JSON.stringify(corr.body).slice(0, 200));
  const recht = corr.body.correctie.teruggave;
  assert.ok(recht && recht.centen > 0);

  const r = await api('/api/supplier/horeca/teruggave', { rekeningId, correctieId: corr.body.correctie.id,
    betalingId: betaling.id, reden: 'terug via de provider', idem: 'ot-terug' }, MGR);
  assert.equal(r.status, 200, 'de online teruggave mislukte: ' + JSON.stringify(r.body).slice(0, 220));
  assert.notEqual(r.body.terugbetaling.stand, 'mislukt');
  if (r.body.terugbetaling.stand === 'uitgevoerd') assert.equal(r.body.rekening.openstaand, 0);
  else assert.equal(r.body.rekening.openstaand, -recht.centen, 'wat nog bij de provider ligt, telt nog niet als terug');
});
