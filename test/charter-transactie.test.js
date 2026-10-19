/* Vluchten: het charterbesluit schreef de boeking van de aanvrager rechtstreeks
   in L().boekingen, buiten de collectietransactie van de boarding pass
   (kern/luchthaven/boarding-pass.js: "Iedere mutatie loopt door
   bewerkCollectie"). Met twee instances kon die schrijfactie verloren gaan.
   Nu loopt de boeking door boardingPass.boek; faalt die, dan blijft de
   aanvraag open en staat er geen vlucht op het bord. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function wereld(boekUitkomst) {
  let staat = { vluchten: [], boekingen: [], charters: [{ id: 'c1', code: 'CH1', key: 'user-1', codenaam: 'Zilveren Reiger', soort: 'privejet',
    bestemming: 'Nice', datum: '2026-12-01', tijd: '10:00', status: 'aangevraagd' }] };
  const L = () => staat;
  const geboekt = [];
  const boardingPass = {
    nieuwBoekingId: () => 'bk-direct',
    // zoals bewerkCollectie: werkt op een kopie en vervangt daarna de collectie
    boek: async ({ key, codenaam, vluchtId }) => {
      geboekt.push({ key, vluchtId });
      if (boekUitkomst) return boekUitkomst;
      const kopie = JSON.parse(JSON.stringify(staat));
      kopie.boekingen.unshift({ id: 'bk-tx', key, codenaam, vluchtId, status: 'geboekt' });
      staat = kopie;
      return { status: 200, ok: true, boekingId: 'bk-tx', vluchtId };
    } };
  const royaal = require('../server/kern/luchthaven/royaal')({
    save: () => {}, crypto, nu: () => '2026-11-01T00:00:00Z', id: (p) => p + '1', schoon: (v) => String(v || ''), vandaag: () => '2026-11-01',
    L, seed: () => {}, vluchten: () => L().vluchten, vind: (id) => L().vluchten.find((v) => v.id === id),
    actief: (v) => v.status !== 'geannuleerd', plekkenVoor: () => ['S1'], vipVan: () => null, vipRond: () => {}, publiek: (v) => ({ id: v.id, nummer: v.nummer }),
    _vluchtMaak: (d) => { const v = Object.assign({ id: 'v' + (L().vluchten.length + 1), status: 'gepland' }, d); L().vluchten.push(v); return v; },
    boardingPass, CATEGORIEEN: {}, LOUNGES: [], VIP_SOORTEN: [], VIP_PROTOCOL: {} });
  return { royaal, L, geboekt };
}

test('het charterbesluit boekt de aanvrager via de transactie van de boarding pass', async () => {
  const { royaal, L, geboekt } = wereld(null);
  const r = await royaal.charterBeslis('ops', 'c1', true);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(geboekt.length, 1, 'de boeking loopt door boardingPass.boek');
  assert.equal(r.boeking.id, 'bk-tx');
  assert.ok(!L().boekingen.some((b) => b.id === 'bk-direct'), 'geen rechtstreekse schrijfactie buiten de transactie');
  const ch = L().charters.find((c) => c.id === 'c1');
  assert.equal(ch.status, 'bevestigd', 'de stand staat in de collectie van NA de transactie');
  assert.equal(ch.vluchtId, r.vlucht.id);
});

test('faalt de boeking, dan blijft de aanvraag open en staat er geen actieve vlucht', async () => {
  const { royaal, L } = wereld({ status: 409, error: 'Je staat al op deze vlucht.' });
  const r = await royaal.charterBeslis('ops', 'c1', true);
  assert.equal(r.status, 409);
  assert.ok(r.error);
  assert.equal(L().charters[0].status, 'aangevraagd');
  assert.ok(!L().vluchten.some((v) => v.status !== 'geannuleerd'), 'de vlucht staat niet meer open op het bord');
});
