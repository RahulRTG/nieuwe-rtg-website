/* Verrekenen in Wie betaalt wat verplaatst geld, dus het komt langs dezelfde
   poorten als RTG Pay (server/routes/wbw.js, kern/identiteit/bezitspaden.js).

   /api/wbw/verreken betaalt via pay.stuur de eigen schuld aan een vriend,
   en had geen paspoortpoort en geen bezitsbewijs: met een gestolen token, of
   als lid dat zijn paspoort nooit liet zien, ging het geld gewoon. Gemeten in
   de wegwerpwereld van de voltooiproef, waar het bezitsbewijs op 'verplicht'
   staat (scripts/lib/voltooiwereld.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakWereld, nieuwLid, geverifieerdLid, gebondenToestel, verbind, KANTOORWERELD } = require('../scripts/lib/voltooiwereld');
const simulatiebank = require('../server/betaal/synthetisch');

const VERREKEN = '/api/wbw/verreken';
const bank = simulatiebank({ crypto, env: {}, echteRail: null });
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
function betaaldeSleutel({ gid, van, aan, codenaam }) {
  for (let i = 0; i < 10000; i++) {
    const idem = 'poort-' + i;
    const id = 'BW-' + sha('pay:' + codenaam + '|pay-oplaad:' + codenaam + ':wbw:' + gid + ':' + van + ':' + aan + ':' + idem + ':autolaad').slice(0, 20).toUpperCase();
    if (bank.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen sleutel');
}

let w;
test.before(async () => { w = await maakWereld('wbwpoort', Object.assign({ RTG_SIMULATIEBANK: '1' }, KANTOORWERELD)); });
test.after(() => w && w.klaar());

async function schuld(A, B) {
  const v = await verbind(w, A, B);
  const g = (await w.post('/api/wbw/maak', { naam: 'Poort', leden: [v.b.key] }, A.token)).data.groep;
  await w.post('/api/wbw/uitgave', { id: g.id, oms: 'Etentje', centen: 4000, voor: [v.a.key, v.b.key] }, A.token);
  return { v, gid: g.id };
}

test('zonder paspoort verrekent een RTG-lid niet, ook niet met een gebonden toestel', async () => {
  const A = await geverifieerdLid(w, 'wpa');
  const B = await nieuwLid(w, 'wpb');
  const { gid } = await schuld(A, B);
  const t = await gebondenToestel(w, B.token);
  const r = await w.post(VERREKEN, { id: gid, idem: 'zonder-paspoort' }, B.token, await t.bewijs('POST', VERREKEN));
  assert.equal(r.status, 403, JSON.stringify(r.data));
  assert.equal(r.data.kyc, true);
});

test('met een gebonden toestel maar zonder bezitsbewijs wordt verrekenen geweigerd; met bewijs gaat het', async () => {
  const A = await geverifieerdLid(w, 'wpc');
  const B = await geverifieerdLid(w, 'wpd');
  const { v, gid } = await schuld(A, B);
  const t = await gebondenToestel(w, B.token);
  const kaal = await w.post(VERREKEN, { id: gid, idem: 'kaal' }, B.token);
  assert.equal(kaal.status, 401, 'een gestolen token alleen verrekent niet: ' + JSON.stringify(kaal.data));
  const idem = betaaldeSleutel({ gid, van: v.b.key, aan: v.a.key, codenaam: v.b.codenaam });
  const r = await w.post(VERREKEN, { id: gid, idem }, B.token, await t.bewijs('POST', VERREKEN));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.groep.mijnSaldo, 0);
});
