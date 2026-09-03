/* ============================================================================
   DE NIEUWE FOUNDATIONOS-ROUTES, OVER HTTP.

   test/routedekking.test.js is duidelijk: wie een route toevoegt zonder toets,
   ziet die poort zakken -- en er is geen norm om de eis mee te verlagen. Dat is
   terecht, en het wees precies aan wat er ontbrak: ik had de winkel, de
   machtiging en de projectkeuze wel als KERNfuncties getoetst en met de hand in
   een browser doorlopen, maar niet als route. Dat verschil is niet klein: een
   route draagt de deur (auth, geenGast), de rem en de vorm van het antwoord, en
   dat is precies waar ik deze sessie al twee keer op ben gestruikeld (een
   leeskant die op de verkeerde sessie stond, en een route die 404 gaf omdat de
   server nog draaide van voor de wijziging).

   Deze toets loopt ze alle langs met een echte server, in de volgorde waarin een
   mens ze zou tegenkomen.

   Draai los: node --test test/rtfos-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, board, lid, WCODE, PLAN;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer(); base = srv.base;
  board = await kantoorAlsPersoon(base);
  assert.ok(board, 'geen boardroom-sessie');
  const reg = await api('/api/auth/register', { name: 'Route Lid',
    email: 'rtfroute-' + Date.now() + '@toets.example', password: 'geheim123',
    geboortedatum: '1980-01-01', tier: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, JSON.stringify(reg.body).slice(0, 160));

  const w = await api('/api/office/rtfwallet', {}, board);
  if (!w.body.bestaat) {
    const m = await api('/api/office/rtfwallet/maak', { naam: 'RTFoundation', beheerder: 'Nadia' }, board);
    WCODE = m.body.code;
  } else WCODE = w.body.wallet.code;
  assert.ok(WCODE, 'geen positie in RTG Pay');
});
test.after(() => stop(srv));

test('de winkel: etalage, kopen, mijn bestellingen -- en het kantoor erachter', async () => {
  const art = await api('/api/rtfos/winkel/artikel/zet',
    { naam: 'Katoenen tas', euro: 12.5, voorraad: 2, doel: 'Taalcafe' }, board);
  assert.equal(art.status, 200, JSON.stringify(art.body));

  /* DE DEUR: zonder sessie komt er niets uit. Dit is wat een kernfunctie-toets
     per definitie niet ziet. */
  assert.equal((await api('/api/rtfos/winkel', {})).status, 401);

  const et = await api('/api/rtfos/winkel', {}, lid);
  assert.equal(et.status, 200);
  assert.match(et.body.uitleg, /geen collectebus/);
  assert.ok(et.body.artikelen.some(a => a.naam === 'Katoenen tas'));

  const koop = await api('/api/rtfos/winkel/koop',
    { artikelId: et.body.artikelen.find(a => a.naam === 'Katoenen tas').id, aantal: 1, euro: 1 }, lid);
  assert.equal(koop.status, 200, JSON.stringify(koop.body).slice(0, 240));
  /* De prijs komt van de server, en het meegestuurde bedrag wordt GEMELD. */
  assert.equal(koop.body.bestelling.euro, 12.5);
  assert.match(koop.body.meegestuurd, /genegeerd/);
  assert.ok(koop.body.zegt.some(z => /geen gift/.test(z)));

  const mijn = await api('/api/rtfos/winkel/mijn', {}, lid);
  assert.equal(mijn.body.bestellingen.length, 1);

  const best = await api('/api/rtfos/winkel/bestellingen', {}, board);
  assert.equal(best.status, 200);
  const rij = best.body.bestellingen[0];
  assert.equal(rij.stand, 'klaar');
  /* De koper staat er als CODENAAM en niet als naam. */
  assert.notEqual(rij.koper, 'Route Lid');
  const zet = await api('/api/rtfos/winkel/stand', { id: rij.id, stand: 'opgehaald' }, board);
  assert.equal(zet.status, 200);
  assert.equal((await api('/api/rtfos/winkel/mijn', {}, lid)).body.bestellingen[0].stand, 'opgehaald');
});

test('de projectkeuze en de machtiging lopen langs hun eigen deur', async () => {
  assert.equal((await api('/api/rtfos/gift/projecten', {})).status, 401);
  const pr = await api('/api/rtfos/gift/projecten', {}, lid);
  assert.equal(pr.status, 200);
  assert.ok(Array.isArray(pr.body.projecten));
  /* Zonder lopende projecten een LEGE lijst met een zin, en geen stilte. */
  if (!pr.body.projecten.length) assert.match(pr.body.uitleg, /geen project/);

  await api('/api/rtfos/gift/stand/zet',
    { vormen: ['eenmalig', 'geoormerkt', 'periodiek'], anbi: 'aangevraagd' }, board);
  await api('/api/rtfos/gift/stand/zet', { stand: 'open' }, board);

  const plan = await api('/api/rtfos/gift/plan/voorstel', { euroPerJaar: 120, jaren: 5 }, lid);
  assert.equal(plan.status, 200, JSON.stringify(plan.body));
  PLAN = plan.body.plan.id;

  assert.equal((await api('/api/rtfos/gift/machtiging/mijn', {})).status, 401);
  const leeg = await api('/api/rtfos/gift/machtiging/mijn', {}, lid);
  assert.equal(leeg.body.geindNu, false, 'de route zei niet dat er niets wordt geind');

  const laag = await api('/api/rtfos/gift/machtiging/teken',
    { planId: PLAN, houder: 'A. Gever', ibanEinde: '4300', max: 50 }, lid);
  assert.equal(laag.status, 400);
  assert.match(laag.body.error, /onder het jaarbedrag/);

  const m = await api('/api/rtfos/gift/machtiging/teken',
    { planId: PLAN, houder: 'A. Gever', ibanEinde: '4300', max: 150, kanaal: 'app' }, lid);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.equal(m.body.machtiging.stornoWeken, 8);

  const weg = await api('/api/rtfos/gift/machtiging/intrek', { id: m.body.machtiging.id }, lid);
  assert.equal(weg.status, 200);
  assert.ok(weg.body.zegt.some(z => /loopt hiermee NIET af/.test(z)));
});

test('de bankrekening van een zaak heeft een eigen leeskant', async () => {
  const roster = (await api('/api/supplier/roster', { code: WCODE })).body;
  const beheer = (roster.staff || []).find(x => x.role === 'manager');
  assert.ok(beheer, JSON.stringify(roster).slice(0, 160));
});
