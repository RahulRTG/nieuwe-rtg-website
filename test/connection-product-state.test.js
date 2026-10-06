/* RONDE 3: PRODUCT STATE & EDGE CONTRACT

   Deze toetsen bewijzen dat producttoestand, capabilities, Edge-projecties en
   transities uitsluitend door de server worden bepaald. Ze beproeven vooral
   wat niet mag ontstaan: sprongen, stale clients, cross-productacties en
   capabilities die niet zijn geimplementeerd. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Consent = require('../server/kern/connection-consent');
const ProductState = require('../server/kern/connection-product-state');
const Vonk = require('../server/kern/connection-state-vonk');
const Rendezvous = require('../server/kern/connection-state-rendezvous');
const { startServer, stop, kantoorAlsPersoon, elevateTier } = require('./helper');

const toegang = { pass: 'lifestyle', verified: true, adult: true, blocked: false };

test('Vonk en Rendez-vous hebben afzonderlijke productstates', () => {
  assert.equal(Vonk.STATES.DISCOVERY, 'DISCOVERY');
  assert.equal(Rendezvous.STATES.TODAY, 'TODAY');
  assert.equal(Object.hasOwn(Vonk.STATES, 'TODAY'), false);
  assert.equal(Object.hasOwn(Rendezvous.STATES, 'CONVERSATION'), false);
});

test('DISCOVERY kan niet rechtstreeks naar DATE_ACTIVE', () => {
  const r = Vonk.transition(Vonk.STATES.DISCOVERY, Vonk.EVENTS.PLAN_MEET);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID_PRODUCT_TRANSITION');
});

test('een eerste Rendez-vous-ja kan de introductie niet openen', () => {
  const r = Rendezvous.transition(Rendezvous.STATES.INTRODUCTION_PENDING,
    Rendezvous.EVENTS.OPEN_INTRODUCTION, { mutual: false });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'MUTUAL_CONSENT_REQUIRED');
});

test('zonder wederzijdse call-consent en met implemented:false route ontstaan geen call- of routeacties', () => {
  const state = Vonk.match({ key: 'a', now: '2026-09-22T12:00:00.000Z', match: {
    id: 'm1', a: 'a', b: 'b', status: 'bevestigd', tafel: { datum: '2026-09-22' }, betaald: {}, halfweg: { keuzes: {} },
    reservationEvidence: { state: 'CONFIRMED', finality: 'SOURCE_ATTESTED', missing: ['operational-outcome'] }
  } });
  const edge = ProductState.resolve({ actor: 'member', product: 'vonk', productState: state,
    access: { pass: 'member', verified: true, adult: true }, subject: 'a', context: { id: 'm1' } });
  assert.equal(edge.surface, 'VONK_DATE_ACTIVE');
  assert.ok(!edge.availableCapabilities.includes('connection.voice'));
  assert.ok(!edge.availableCapabilities.includes('connection.route'));
  assert.ok(!edge.actions.some(a => a.id === 'route'));
  assert.equal(Object.hasOwn(edge, 'voice'), false);
});

test('een bevestigde toekomstige Vonk-date projecteert alleen Date en Safety', () => {
  const state = Vonk.match({ key: 'a', now: '2026-09-22T12:00:00.000Z', match: {
    id: 'm2', a: 'a', b: 'b', status: 'bevestigd', tafel: { datum: '2026-09-24' }, betaald: { a:true, b:true }, halfweg: { keuzes: {} },
    reservationEvidence: { state: 'CONFIRMED', finality: 'SOURCE_ATTESTED', missing: ['operational-outcome'] }
  } });
  const edge = ProductState.resolve({ actor: 'member', product: 'vonk', productState: state,
    access: { pass: 'member', verified: true, adult: true }, subject: 'a', context: { id: 'm2' } });
  assert.equal(edge.state, 'DATE_CONFIRMED');
  assert.deepEqual(edge.actions.map(a => a.id), ['date', 'safety']);
  assert.ok(!edge.actions.some(a => ['chat', 'meet', 'voice', 'route'].includes(a.id)));
});

test('een statusstring zonder providerbevestiging opent nooit de Date-surface', () => {
  for (const reservationEvidence of [
    { state: 'UNKNOWN', finality: 'UNKNOWN', missing: ['provider-confirmation'] },
    { state: 'CONFIRMED', finality: 'SOURCE_ATTESTED', missing: ['provider-confirmation'] }
  ]) {
    const state = Vonk.match({ key: 'a', now: '2026-09-22T12:00:00.000Z', match: {
      id: 'm-onzeker', a: 'a', b: 'b', status: 'bevestigd', tafel: { datum: '2026-09-22' },
      betaald: { a: true, b: true }, halfweg: { keuzes: {} }, reservationEvidence
    } });
    const edge = ProductState.resolve({ actor: 'member', product: 'vonk', productState: state,
      access: { pass: 'member', verified: true, adult: true }, subject: 'a', context: { id: 'm-onzeker' } });
    assert.equal(state.state, 'RESERVATION_UNKNOWN');
    assert.equal(edge.surface, 'VONK_MATCH');
    assert.ok(!edge.actions.some(action => action.id === 'date'));
  }
});

test('Rendez-vous projecteert een echte Concierge-service maar geen automatische reservering', () => {
  const edge = ProductState.resolve({ actor: 'member', product: 'rendezvous',
    productState: Rendezvous.root({ aan: true }), access: toegang, subject: 'a', context: { kind: 'root' } });
  assert.deepEqual(edge.actions.map(a => a.id), ['today', 'society', 'concierge']);
  assert.ok(edge.availableCapabilities.includes('connection.concierge.request'));
  assert.ok(!edge.availableCapabilities.includes('connection.concierge.reserve'));
});

test('een Vonk-capability verschijnt nooit op een Rendez-vous-surface', () => {
  const edge = ProductState.resolve({ actor: 'member', product: 'rendezvous',
    productState: { surface: 'RENDEZVOUS_ROOT', state: 'TODAY',
      candidates: ['connection.payment.confirm', 'connection.discover'], fingerprint: {} },
    access: toegang, subject: 'a', context: {} });
  assert.deepEqual(edge.availableCapabilities, ['connection.discover']);
});

test('Rahul kan via productstate geen extra capability maken', () => {
  const edge = ProductState.resolve({ actor: 'rahul', product: 'rendezvous',
    productState: { surface: 'RENDEZVOUS_ARRANGE', state: 'ARRANGE_DRAFT',
      candidates: ['connection.meet.plan', 'connection.message', 'connection.voice'], fingerprint: {} },
    access: toegang, subject: 'a', context: {} });
  assert.deepEqual(edge.availableCapabilities, ['connection.meet.plan']);
});

test('een gewijzigde state maakt een gecachete revision ongeldig', () => {
  const maak = versie => ProductState.resolve({ actor: 'member', product: 'vonk',
    productState: { surface: 'VONK_ROOT', state: 'DISCOVERY',
      candidates: ['connection.discover'], fingerprint: { versie } },
    access: { pass: 'member', verified: true, adult: true }, subject: 'a', context: {} });
  const oud = maak(1), actueel = maak(2);
  assert.notEqual(oud.stateRevision, actueel.stateRevision);
  assert.equal(ProductState.guard({ edge: actueel, expectedRevision: oud.stateRevision,
    capability: 'connection.discover' }).code, 'STALE_CONNECTION_STATE');
});

test('consent intrekken verwijdert de goedgekeurde Arrange-state onmiddellijk', () => {
  const voorstel = { id: 'a|b', setting: 'diner', akkoord: {}, toestemming: {} };
  const a = Rendezvous.arrangeBinding(voorstel, 'a', 'b');
  const b = Rendezvous.arrangeBinding(voorstel, 'b', 'a');
  Consent.grant(voorstel.toestemming, a, { at: '2026-09-22T10:00:00.000Z' });
  Consent.grant(voorstel.toestemming, b, { at: '2026-09-22T10:01:00.000Z' });
  const goed = Rendezvous.match({ proposal: voorstel, key: 'a', targetKey: 'b', now: '2026-09-22T10:02:00.000Z' });
  assert.equal(goed.state, 'ARRANGE_APPROVED');
  Consent.revoke(voorstel.toestemming, a, { at: '2026-09-22T10:03:00.000Z' });
  const terug = Rendezvous.match({ proposal: voorstel, key: 'a', targetKey: 'b', now: '2026-09-22T10:04:00.000Z' });
  assert.equal(terug.state, 'ARRANGE_AWAITING_BOTH');
  assert.notEqual(goed.fingerprint.ownConsent, terug.fingerprint.ownConsent);
});

test('onbekende context en ontbrekende capability zijn default-deny', () => {
  assert.equal(ProductState.resolve({ product: 'vonk', productState: null }).code, 'CONNECTION_CONTEXT_NOT_FOUND');
  const edge = ProductState.resolve({ actor: 'member', product: 'vonk', productState: Vonk.root(null),
    access: { pass: 'member', verified: true, adult: true }, subject: 'a', context: {} });
  assert.equal(ProductState.guard({ edge, capability: 'connection.video' }).code, 'CAPABILITY_NOT_AVAILABLE');
});

test('de server weigert een oude Edge-revision na iedere relevante mutatie', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-edge-state-'));
  let srv;
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_ENC_KEY: 'edge-state-test-key-123456789', SMTP_URL: '' } });
    const base = srv.base;
    const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
    let teller = 0;
    const api = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const lid = async () => {
      const n = Date.now() + '-' + (++teller);
      const reg = await api('/api/auth/register', { name: 'Edge ' + n, email: 'edge-' + n + '@test.invalid',
        phone: '062' + String(Date.now()).slice(-7) + teller, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' });
      await elevateTier(base, reg.body.token, 'lifestyle', office);
      let state = await api('/api/state', {}, reg.body.token);
      const codenaam = state.body.state.user.codename;
      await api('/api/verify/upload', { image: png }, reg.body.token);
      await api('/api/verify/selfie', { image: png }, reg.body.token);
      const pending = await api('/api/office/verifications', {}, office);
      const rij = pending.body.pending.find(x => x.codename === codenaam);
      await api('/api/office/verify', { userId: rij.id, decision: 'approve', faceMatch: true, geslacht: 'x' }, office);
      state = await api('/api/state', {}, reg.body.token);
      return { token: reg.body.token, codenaam: state.body.state.user.codename };
    };
    const a = await lid(), b = await lid();
    await api('/api/member/rendezvous/profiel/zet', { aan: true, over: 'edge-a' }, a.token);
    await api('/api/member/rendezvous/profiel/zet', { aan: true, over: 'edge-b' }, b.token);
    await api('/api/vonk/profiel', { over: 'edge-a', stad: 'Utrecht', lat: 52.09, lng: 5.12,
      leeftijdMin: 18, leeftijdMax: 99, maxKm: 500 }, a.token);
    await api('/api/vonk/profiel', { over: 'edge-b', stad: 'Utrecht', lat: 52.1, lng: 5.13,
      leeftijdMin: 18, leeftijdMax: 99, maxKm: 500 }, b.token);
    const va = await api('/api/vonk/selectie', {}, a.token);
    const vb = await api('/api/vonk/selectie', {}, b.token);
    assert.ok(va.body.mensen.some(x => x.codenaam === b.codenaam));
    assert.ok(vb.body.mensen.some(x => x.codenaam === a.codenaam));
    assert.equal((await api('/api/vonk/like', { codenaam: b.codenaam }, a.token)).status, 200);
    const vonkMatch = await api('/api/vonk/like', { codenaam: a.codenaam }, b.token);
    assert.equal(vonkMatch.body.match, true);
    const vonkEdge = await api('/api/vonk/edge', { id: vonkMatch.body.id }, a.token);
    const halfway = await api('/api/vonk/halfweg', { id: vonkMatch.body.id }, a.token);
    const optie = halfway.body.opties[0] && halfway.body.opties[0].id;
    assert.ok(optie, 'Meet Halfway heeft een concrete plaatskeuze voor de blokkadeproef');
    const ka = await api('/api/member/rendezvous/kandidaten', {}, a.token);
    const kb = await api('/api/member/rendezvous/kandidaten', {}, b.token);
    const bId = ka.body.kandidaten.find(x => x.codenaam === b.codenaam).id;
    const aId = kb.body.kandidaten.find(x => x.codenaam === a.codenaam).id;
    const edge1 = await api('/api/member/rendezvous/edge', { kind: 'candidate', id: bId }, a.token);
    assert.equal(edge1.body.state, 'INTRODUCTION_PENDING');
    assert.ok(!edge1.body.availableCapabilities.includes('connection.voice'));
    const eersteLike = await api('/api/member/rendezvous/like', { id: bId, stateRevision: edge1.body.stateRevision }, a.token);
    assert.equal(eersteLike.status, 200);
    assert.equal(eersteLike.body.match, false, 'een like is nog geen match');
    const staleLike = await api('/api/member/rendezvous/pas', { id: bId, stateRevision: edge1.body.stateRevision }, a.token);
    assert.equal(staleLike.status, 409);
    assert.equal(staleLike.body.code, 'STALE_CONNECTION_STATE');
    assert.equal((await api('/api/member/rendezvous/like', { id: aId }, b.token)).status, 200);
    const matchEdge = await api('/api/member/rendezvous/edge', { kind: 'match', id: bId }, a.token);
    assert.equal(matchEdge.body.state, 'ARRANGE_DRAFT');
    assert.equal((await api('/api/member/rendezvous/arrange', {
      id: bId, setting: 'diner', stateRevision: matchEdge.body.stateRevision
    }, a.token)).status, 200);
    const staleArrange = await api('/api/member/rendezvous/arrange', {
      id: bId, setting: 'borrel', stateRevision: matchEdge.body.stateRevision
    }, a.token);
    assert.equal(staleArrange.status, 409);
    assert.equal(staleArrange.body.code, 'STALE_CONNECTION_STATE');
    assert.equal((await api('/api/member/rendezvous/blokkeer', { id: bId }, a.token)).status, 200);
    assert.notEqual((await api('/api/member/rendezvous/arrange', {
      id: bId, stateRevision: matchEdge.body.stateRevision
    }, a.token)).status, 200, 'een block maakt ook een oude Edge-state machteloos');
    assert.notEqual((await api('/api/vonk/kies', {
      id: vonkMatch.body.id, optie, stateRevision: vonkEdge.body.stateRevision
    }, a.token)).status, 200, 'block tijdens Meet Halfway sluit iedere verdere plaatskeuze');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});
