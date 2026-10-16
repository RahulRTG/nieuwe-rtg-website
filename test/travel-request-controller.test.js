/* De Travel-aanvraagkern deelt alleen toestand en bronregels. Flow en Spatial
   mogen hun eigen presentatie houden zonder antwoordverlies anders uit te leggen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const travel = require('../public/shared/travel-request-controller');

const REIS = { id: 'ibiza-jetset', titel: 'Ibiza', prijs: 2200 };
const INVOER = { date: '2026-11-14', participants: 3, note: '  Rust <en> ruimte  ' };

function gereed(api, sameSession) {
  const gebeurtenissen = [];
  const controller = travel.create({ api, sameSession, onChange: (state, reason) => gebeurtenissen.push([reason, state.phase, state.busy]) });
  assert.equal(controller.open(REIS).ok, true);
  const review = controller.review(INVOER);
  assert.equal(review.ok, true);
  return { controller, review, gebeurtenissen };
}

test('review blijft lokaal en maakt een geschoonde, presentatieneutrale aanvraag', () => {
  let calls = 0;
  const { controller, review } = gereed(async () => { calls++; });
  assert.deepEqual(review.request, {
    tripId: 'ibiza-jetset', personen: 3, vertrek: '2026-11-14', notitie: 'Rust en ruimte'
  });
  assert.equal(controller.state().phase, 'review');
  assert.equal(calls, 0, 'controleren heeft geen extern gevolg');
});

test('een bronreceipt is de enige directe overgang naar ontvangen', async () => {
  const receipt = { ref: 'reis-1', tripId: REIS.id, personen: 3, vertrek: INVOER.date, notitie: 'Rust en ruimte', status: 'aangevraagd' };
  const routes = [];
  const { controller, gebeurtenissen } = gereed(async (route, body) => {
    routes.push([route, body]);
    if (route.endsWith('/mijn')) return { aanvragen: [] };
    return { aanvraag: receipt };
  });
  const result = await controller.submit(INVOER);
  assert.equal(result.type, 'received');
  assert.equal(result.application, receipt);
  assert.equal(controller.state().phase, 'received');
  assert.deepEqual(routes.map(x => x[0]), ['/api/reisbureau/mijn', '/api/reisbureau/boek']);
  assert.ok(gebeurtenissen.some(x => x[0] === 'submitting'));
});

test('een bestaande open aanvraag blokkeert een tweede verzending', async () => {
  let sends = 0;
  const bestaand = { ref: 'reis-open', tripId: REIS.id, status: 'aangevraagd' };
  const { controller } = gereed(async route => {
    if (route.endsWith('/mijn')) return { aanvragen: [bestaand] };
    sends++; return {};
  });
  const result = await controller.submit(INVOER);
  assert.equal(result.type, 'existing');
  assert.equal(result.application.ref, 'reis-open');
  assert.equal(sends, 0);
  assert.equal(controller.state().phase, 'review');
});

test('een duidelijke serverweigering blijft een fout en geen onzeker succes', async () => {
  const fout = Object.assign(new Error('Datum niet beschikbaar.'), { status: 422 });
  const { controller } = gereed(async route => {
    if (route.endsWith('/mijn')) return { aanvragen: [] };
    throw fout;
  });
  const result = await controller.submit(INVOER);
  assert.equal(result.type, 'rejected');
  assert.equal(result.sent, true);
  assert.equal(result.error, fout);
  assert.equal(controller.state().phase, 'review');
});

test('antwoordverlies controleert bij de bron en verstuurt nooit automatisch opnieuw', async () => {
  let sends = 0, checks = 0, opgeslagen = null;
  const oud = { ref: 'oud', tripId: 'rome', status: 'bevestigd' };
  const { controller } = gereed(async (route, body) => {
    if (route.endsWith('/boek')) {
      sends++;
      opgeslagen = Object.assign({ ref: 'reis-2', status: 'aangevraagd' }, body);
      throw new TypeError('verbinding verbroken');
    }
    checks++;
    return { aanvragen: checks === 1 ? [oud] : [oud, opgeslagen] };
  });
  const submit = await controller.submit(INVOER);
  assert.equal(submit.type, 'uncertain');
  assert.equal(controller.state().phase, 'uncertain');
  assert.equal(controller.open({ id: 'rome' }).reason, 'uncertain');
  const found = await controller.check();
  assert.equal(found.type, 'received');
  assert.equal(found.matched, true);
  assert.equal(found.application.ref, 'reis-2');
  assert.equal(sends, 1, 'broncontrole herhaalt de mutatie niet');
  assert.equal(controller.state().phase, 'received');
});

test('geen unieke nieuwe bronmatch houdt de aanvraag eerlijk onzeker', async () => {
  let checks = 0;
  const { controller } = gereed(async (route, body) => {
    if (route.endsWith('/boek')) throw new TypeError('antwoord verloren');
    checks++;
    if (checks === 1) return { aanvragen: [] };
    const basis = Object.assign({ tripId: body && body.tripId || REIS.id, personen: 3, vertrek: INVOER.date, notitie: 'Rust en ruimte', status: 'aangevraagd' });
    return { aanvragen: [Object.assign({ ref: 'dubbel-1' }, basis), Object.assign({ ref: 'dubbel-2' }, basis)] };
  });
  assert.equal((await controller.submit(INVOER)).type, 'uncertain');
  assert.equal((await controller.check()).type, 'unmatched');
  assert.equal(controller.state().phase, 'uncertain');
});

test('een gewijzigde sessie blokkeert review of submit vóór ieder bronverzoek', async () => {
  let geldig = false, calls = 0;
  const controller = travel.create({ api: async () => { calls++; }, sameSession: () => geldig });
  controller.open(REIS);
  assert.equal(controller.review(INVOER).reason, 'session');
  assert.equal(calls, 0);
  geldig = true;
  assert.equal(controller.review(INVOER).ok, true);
  geldig = false;
  assert.equal((await controller.submit(INVOER)).reason, 'session');
  assert.equal(calls, 0);
});

test('een sessiewissel tijdens de broncontrole blokkeert de mutatie', async () => {
  let geldig = true, sends = 0;
  const { controller, gebeurtenissen } = gereed(async route => {
    if (route.endsWith('/mijn')) { geldig = false; return { aanvragen: [
      { ref: 'verborgen-andere-sessie', tripId: REIS.id, status: 'aangevraagd' }
    ] }; }
    sends++; return {};
  }, () => geldig);
  const result = await controller.submit(INVOER);
  assert.equal(result.type, 'ignored');
  assert.equal(result.reason, 'session');
  assert.equal(result.application, undefined, 'brondata uit de oude sessie bleef afgeschermd');
  assert.equal(sends, 0, 'de nieuwe sessie ontving geen mutatie uit de oude werkruimte');
  assert.equal(controller.state().phase, 'review');
  assert.ok(gebeurtenissen.some(x => x[0] === 'session-changed'));
});
