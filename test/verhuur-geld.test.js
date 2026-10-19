/* Een boeking betalen via /api/booking/pay (server/kern/lidacties/boekingen.js):
   huur, charter, tickets en diensten uit Ter plaatse.

   Gevonden door TravelOS, gebouwd door Geld. Het pad zette `paid = true` en
   maakte een factuur, maar boekte geen cent via RTG Pay en zette
   `payBetaaldCenten` niet. Een lid kreeg dus een betaalde huur zonder te
   betalen, en annuleren sloeg de teruggave over (kern/ervaring/leden/
   annuleren.js: "paden die nog niet via RTG Pay lopen"). Nu loopt het zoals de
   bestelling en de rit: eerst het geld (lidacties/afrekenen.js), dan `paid`,
   de marker en de factuur.

   De huurtoets is van TravelOS (hun Ter plaatse-scenario); de factuur- en
   paspoortcontrole kwamen er bij Geld bij. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');
/* de afloop die de simulatiebank voor een bijlading kiest, uit de sleutel
   (dezelfde afleiding als de zorgscenario's) */
const { afloop } = require('../scripts/lib/voltooizorggeld');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verhuur-geld-'));
let srv;
const D = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
let teller = 0;
async function lid() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Huurder', email: 'huurgeld' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}
function betaaldeIdem(codenaam, merk) {
  const b = bank({ crypto, env: { RTG_SIMULATIEBANK: '1' } });
  for (let i = 0; i < 2000; i++) {
    const idem = merk + i;
    const id = 'BW-' + crypto.createHash('sha256').update('pay:' + codenaam + '|' + 'pay-oplaad:' + codenaam + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
    if (b.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen sleutel');
}
const saldo = async (l) => (await api('/api/pay/overzicht', {}, l.token)).body.saldo;
const facturenVoor = async (l, ref) => {
  const f = (await api('/api/facturen/mijn', {}, l.token)).body || {};
  return JSON.stringify(f).split(ref).length - 1;
};

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } }); });
test.after(async () => { await stop(srv); });

test('een huur betalen boekt het geld een keer, en annuleren geeft het terug', async () => {
  const A = await lid();
  await keurLidGoed(srv.base, A.token, A.codenaam);
  assert.equal((await api('/api/pay/oplaad', { centen: 50000, idem: betaaldeIdem(A.codenaam, 'h-') }, A.token)).status, 200);
  const h = await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c1', van: D(5), tot: D(7), idem: 'huurgeld-' + Date.now() }, A.token);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  const ref = h.body.huur.ref, prijs = Math.round(h.body.huur.price * 100);
  const voor = await saldo(A);
  const [p, q] = await Promise.all([api('/api/booking/pay', { ref }, A.token), api('/api/booking/pay', { ref }, A.token)]);
  assert.ok([p.status, q.status].includes(200), JSON.stringify([p.body, q.body]));
  const af = voor - (await saldo(A));
  assert.ok(af > 0 && af <= prijs, 'het geld is een keer van het saldo af (prijs na voordeel): ' + af + ' van ' + prijs);
  assert.ok(await facturenVoor(A, ref) >= 1, 'en er is een factuur');
  const an = await api('/api/annuleer', { soort: 'boeking', ref }, A.token);
  assert.equal(an.status, 200, JSON.stringify(an.body));
  assert.equal(await saldo(A), voor, 'annuleren geeft het betaalde bedrag terug');
});

/* GAAT DE BETALING NIET DOOR. "Zonder saldo" alleen is geen weigering in dit
   huis: RTG Pay laadt een tekort zelf bij (kern/pay/dekking.js, "een knop"),
   en in de toetsomgeving lukt dat. Een eigen server met de betaalstop aan
   (RTG_BETALEN_UIT) maakt de weigering zeker, en dan geldt de eis van TravelOS:
   de huur heet nergens betaald en er is geen factuur. */
test('gaat de betaling niet door, dan heet de huur niet betaald en staat er geen factuur', async () => {
  const hoofd = srv;
  srv = await startServer({ env: { SMTP_URL: '', RTG_BETALEN_UIT: '1',
    RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verhuur-geld-stop-')) } });
  try {
  const B = await lid();
  await keurLidGoed(srv.base, B.token, B.codenaam);
  const h = await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c2', van: D(9), tot: D(10), idem: 'huurgeld-b-' + Date.now() }, B.token);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  const p = await api('/api/booking/pay', { ref: h.body.huur.ref }, B.token);
  assert.ok(p.status === 402 || p.status === 503, 'geen geld, geen betaling: ' + p.status + ' ' + JSON.stringify(p.body));
  const mijn = (await api('/api/huur/mijn', {}, B.token)).body.huren || [];
  assert.ok(!mijn.some((x) => x.ref === h.body.huur.ref), 'Mijn huur toont alleen betaalde huren');
  assert.equal(await facturenVoor(B, h.body.huur.ref), 0, 'en er is geen factuur');
  } finally { await stop(srv); srv = hoofd; }
});

test('een ongekeurd lid betaalt geen boeking en krijgt de paspoortweg', async () => {
  const C = await lid();
  const h = await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c3', van: D(12), tot: D(13), idem: 'huurgeld-c-' + Date.now() }, C.token);
  assert.equal(h.status, 200, JSON.stringify(h.body));
  const p = await api('/api/booking/pay', { ref: h.body.huur.ref }, C.token);
  assert.equal(p.status, 403, JSON.stringify(p.body));
  assert.equal(p.body.kyc, true);
});

/* DE AFLOOP VOORAF GEKOZEN. Een lid met een lege wallet betaalt; RTG Pay laadt
   het tekort bij met de sleutel 'boeking:<ref>:autolaad' (kern/pay/opladen.js),
   en de simulatiebank kiest de afloop uit die sleutel. De toets boekt dus tot
   hij een huur heeft waarvan hij de afloop van tevoren weet -- nooit een
   afloop die per run verschilt (eis van de eigenaar, 19 oktober 2026). */
async function huurMetAfloop(L, gewenst, start) {
  for (let i = 0; i < 80; i++) {
    const h = await api('/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c' + (1 + i % 3), van: D(start + 2 * i), tot: D(start + 2 * i + 1),
      idem: 'afloop-' + gewenst + '-' + i + '-' + Date.now() }, L.token);
    if (h.status !== 200) continue;
    const ref = h.body.huur.ref;
    if (afloop(L.codenaam, 'boeking:' + ref + ':autolaad') === gewenst) return ref;
    await api('/api/annuleer', { soort: 'boeking', ref }, L.token);
  }
  throw new Error('geen huur gevonden waarvan de bijlading "' + gewenst + '" geeft');
}
const betaald = async (L, ref) => ((await api('/api/huur/mijn', {}, L.token)).body.huren || []).some((x) => x.ref === ref);

test('WEIGERING: de bank zegt nee -- niets afgeschreven, niet betaald, en de zin zegt dat', async () => {
  const L = await lid();
  await keurLidGoed(srv.base, L.token, L.codenaam);
  const ref = await huurMetAfloop(L, 'geweigerd', 40);
  const voor = await saldo(L);
  const p = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(p.status, 402, JSON.stringify(p.body));
  assert.match(p.body.error, /niets afgeschreven/);
  assert.equal(await saldo(L), voor, 'er ging niets af');
  assert.equal(await betaald(L, ref), false, 'de huur heet nergens betaald');
  assert.equal(await facturenVoor(L, ref), 0, 'en er is geen factuur');
});

test('HERSTEL: blijft de bank hangen, dan wacht de betaling en heet de huur niet betaald', async () => {
  const L = await lid();
  await keurLidGoed(srv.base, L.token, L.codenaam);
  const ref = await huurMetAfloop(L, 'traag', 200);
  const p = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(p.status, 402, JSON.stringify(p.body));
  assert.match(p.body.error, /wacht op bevestiging/, 'het lid hoort dat het wacht, niet dat het mislukt of gelukt is');
  assert.equal(await betaald(L, ref), false, 'nooit betaald voor de bank bevestigt');
  assert.equal(await facturenVoor(L, ref), 0);
  const weer = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(weer.status, 402, 'een tweede tik maakt van wachten geen betaling: ' + JSON.stringify(weer.body));
  assert.equal(await betaald(L, ref), false);
});

test('HERSTEL: een bijlading die de bank terugboekt, betaalt de huur niet', async () => {
  const L = await lid();
  await keurLidGoed(srv.base, L.token, L.codenaam);
  const ref = await huurMetAfloop(L, 'terugboeking', 360);
  const voor = await saldo(L);
  const p = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(p.status, 402, JSON.stringify(p.body));
  assert.equal(await saldo(L), voor, 'er ging niets af');
  assert.equal(await betaald(L, ref), false);
  assert.equal(await facturenVoor(L, ref), 0);
});

test('HERHALING: een betaalde huur nog eens betalen boekt niets en zegt dat hij betaald is', async () => {
  const L = await lid();
  await keurLidGoed(srv.base, L.token, L.codenaam);
  const ref = await huurMetAfloop(L, 'betaald', 520);
  const eerst = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body));
  const na = await saldo(L);
  const weer = await api('/api/booking/pay', { ref }, L.token);
  assert.equal(weer.status, 409, JSON.stringify(weer.body));
  assert.match(weer.body.error, /betaald/i);
  assert.equal(await saldo(L), na, 'de herhaling boekte niets');
  assert.equal(await facturenVoor(L, ref), 1, 'een factuur, niet twee');
});
