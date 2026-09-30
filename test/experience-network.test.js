const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, supplier, request, choices } = require('./network-fixture');
const { compose, validate } = require('../server/kern/experience/network-compose');

test('de leveranciersprojectie draagt alleen verse beleidsvelden en behoudt ambigue codes', () => {
  const lees = require('../server/db/leveranciers-projectie');
  const db = { data: { suppliers: [{ code: 'A', password: 'GEHEIM', email: 'prive@example.test' },
    { code: 'A', partnerStatus: 'geschorst' }] } };
  const rows = lees(db);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['code', 'status', 'verborgen']);
  assert.equal(Object.isFrozen(rows[0]), true);
  db.data.suppliers[0].mall = { verborgen: true };
  assert.equal(lees(db)[0].verborgen, true);
  assert.equal(rows[0].verborgen, false, 'geen gedeeld mutable zaakobject');
});

test('nieuwe aanbieders vergroten automatisch alle vier wereldprojecties; geen nieuwe opslag', () => {
  const h = fixture([]);
  for (const world of ['living', 'travel', 'work', 'foundation']) {
    assert.equal(h.experience.network(request(world)).proposal.status, 'INCOMPLETE');
  }
  const before = JSON.stringify(h.db.data);
  h.experience.network(request()); assert.equal(JSON.stringify(h.db.data), before);
  h.db.data.suppliers.push(supplier('NIEUW'));
  for (const world of ['living', 'travel', 'work', 'foundation']) {
    const r = h.experience.network(request(world));
    assert.equal(r.proposal.status, 'PROPOSAL'); assert.equal(r.proposal.bookingStatus, 'NOT_BOOKED');
    assert.ok(r.graph.nodes.some(n => n.kind === 'organization'));
    assert.ok(r.graph.edges.every(e => e.grantsAuthority === false));
  }
  assert.equal(h.saves(), 0);
});
test('policy filtert vóór aantallen en graaf; schorsing en verborgen aanbod werken zonder cachevertraging', () => {
  const h = fixture([supplier('OPEN'), supplier('SECRET', { mall: { verborgen: true } }),
    supplier('SUSPENDED', { partnerStatus: 'geschorst' }), supplier('ENDED', { partnerStatus: 'beeindigd' })]);
  const r = h.experience.network(request());
  assert.equal(r.proposal.needs[0].matches, 1);
  assert.doesNotMatch(JSON.stringify(r), /SECRET|SUSPENDED|ENDED/);
  h.db.data.suppliers[0].mall = { verborgen: true };
  assert.equal(h.experience.network(request()).proposal.needs[0].matches, 0);
});
test('geen inkoopprijzen, adressen of tweede persoon via de aanbodgrens', () => {
  const h = fixture(); const orig = h.kern.mall.aanbodAlles;
  h.kern.mall.aanbodBezoek = null;
  h.kern.mall.aanbodAlles = () => {
    const s = orig(); s.aanbod.forEach(a => { a.zakelijkePrijs = { bedrag: 1234567 };
      a.secret = 'BEDRIJFSGEHEIM'; a.plek.label = 'PRIVEADRES'; }); return s;
  };
  const r = h.experience.network(request());
  assert.doesNotMatch(JSON.stringify(r), /1234567|BEDRIJFSGEHEIM|PRIVEADRES|zakelijkePrijs/);
  assert.equal(r.graph.nodes.some(n => n.kind === 'person'), false);
  const a = request(); a.body.includeContext = true;
  assert.match(JSON.stringify(h.experience.network(a)), /Taak van alice/);
  a.key = 'bob'; assert.doesNotMatch(JSON.stringify(h.experience.network(a)), /Taak van alice/);
  a.body.contextId = h.experience.bootstrap({ key: 'alice', world: 'work' }).currentContext.id;
  assert.equal(h.experience.network(a).status, 403);
});
test('onbekend is geen beschikbaarheid; onbeschikbaar is geen optie; bronuitval blijft expliciet', () => {
  const h = fixture([supplier('UNKNOWN', { artikelen: [{ id: 'x', naam: 'Onbekend', varianten: [] }] }),
    supplier('EMPTY', { artikelen: [{ id: 'y', naam: 'Leeg', varianten: [{ voorraad: 0 }] }] })]);
  const r = h.experience.network(request());
  assert.equal(r.proposal.needs[0].options[0].availability, 'UNKNOWN');
  assert.equal(r.proposal.needs[0].unavailable, 1);
  h.kern.mall.aanbodBezoek = null;
  h.kern.mall.aanbodAlles = () => { throw Error('SECRET stack /home/internal'); };
  const partial = h.experience.network(request());
  assert.equal(partial.completeness.status, 'PARTIAL');
  assert.equal(partial.proposal.needs[0].status, 'SOURCE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(partial), /SECRET|internal/);
});
test('plaats en land blijven samen; Unicode-steden werken; onbekende plaats verruimt nooit stil naar alles', () => {
  const h = fixture([supplier('JP', { city: '東京', country: 'JP' }), supplier('US', { city: 'Haarlem', country: 'US' })]);
  assert.equal(h.experience.network(request()).proposal.needs[0].matches, 0);
  assert.equal(h.experience.network(request('travel', { city: '東京', country: 'JP' })).proposal.needs[0].matches, 1);
  assert.equal(h.experience.network(request('travel', { city: 'Bestaat niet', country: '' })).proposal.needs[0].matches, 0);
});
test('input is begrensd; prototype-namen en vreemde werelden geven geen geldig contract', () => {
  const h = fixture();
  for (const needs of [[], ['__proto__'], ['product', 'product'], Array(9).fill('product')]) {
    assert.equal(validate({ goal: 'x', needs }).status, 400);
  }
  assert.equal(h.experience.network(request('__proto__')).status, 400);
  assert.equal(validate({ goal: 'x', needs: ['product'], city: {} }).status, 400);
});
test('handoff herleest prijs, zichtbaarheid en veilige bestemming', () => {
  const h = fixture(), r = h.experience.network(request()), o = r.proposal.needs[0].options[0];
  const req = { key: 'alice', body: { world: 'work', mode: 'handoff', offerId: o.id, revision: o.revision } };
  assert.equal(h.experience.network(req).destination, '/apps/mall.html');
  h.db.data.suppliers[0].artikelen[0].publiekePrijs++;
  assert.equal(h.experience.network(req).code, 'NETWORK_CHANGED');
  h.db.data.suppliers[0].mall = { verborgen: true };
  assert.equal(h.experience.network(req).code, 'NETWORK_CHANGED');
});
test('dubbele ids en leverancierscodes vallen veilig af', () => {
  const h = fixture([supplier('DUP'), supplier('DUP')]);
  assert.equal(h.experience.network(request()).proposal.needs[0].matches, 0);
});
test('samensteller bezoekt 100.000 aanbodregels eenmaal en begrenst antwoord zonder combinatorische groei', t => {
  const offers = Array.from({ length: 100000 }, (_, i) => ({ id: String(i), title: 'Aanbod ' + i,
    type: i % 2 ? 'product' : 'eten', locations: [{ city: 'Haarlem', country: 'NL' }], availability: 'UNKNOWN' }));
  const start = performance.now();
  const r = compose(validate({ goal: 'Proef', needs: ['product', 'eten'], city: 'Haarlem', country: 'NL' }), { offers, missing: [] });
  t.diagnostic('100000 synthetische aanbodregels, alleen samensteller: ' + (performance.now() - start).toFixed(1) + ' ms');
  assert.equal(r.measurements.examinedOffers, 100000);
  assert.equal(r.measurements.returnedOptions, 6);
  assert.equal(r.needs[0].matches, 50000);
});

test('bevestiging, hercontrole en gelijktijdige herhaling schrijven samen precies één eigen lijst', async () => {
  const h = fixture(), parameters = { title: 'Mijn plan', choices: choices(h.experience.network(request())) };
  const p = h.experience.preview('alice', { world: 'work', intent: 'network.plan.save', version: 1, parameters });
  assert.equal(p.ok, true, JSON.stringify(p));
  const body = { previewId: p.preview.id, idempotencyKey: 'world-plan-001', confirmed: true };
  assert.equal((await h.experience.execute('alice', { ...body, confirmed: false })).code, 'CONFIRMATION_REQUIRED');
  assert.equal((await h.experience.execute('bob', body)).code, 'PREVIEW_NOT_FOUND');
  const results = await Promise.all([h.experience.execute('alice', body), h.experience.execute('alice', body)]);
  assert.ok(results.every(r => r.ok), JSON.stringify(results));
  assert.equal(h.kern.mall.mallLijsten.mijn('alice').lijsten.length, 1);
  assert.equal(h.kern.mall.mallLijsten.mijn('bob').lijsten.length, 0);
  assert.equal(h.experience.evidence('alice').evidence.length, 1);
  assert.equal(results[0].bookingStatus, 'NOT_BOOKED');
});
test('wijziging of intrekking tussen preview en uitvoeren maakt geen lege of gedeeltelijke lijst', async () => {
  for (const change of [s => { s.mall = { verborgen: true }; }, s => { s.artikelen[0].publiekePrijs++; }]) {
    const h = fixture(), parameters = { title: 'Test', choices: choices(h.experience.network(request())) };
    const p = h.experience.preview('alice', { world: 'work', intent: 'network.plan.save', parameters });
    change(h.db.data.suppliers[0]);
    const r = await h.experience.execute('alice', { previewId: p.preview.id, idempotencyKey: 'world-revoke-1', confirmed: true });
    assert.equal(r.code, 'NETWORK_CHANGED');
    assert.equal(h.kern.mall.mallLijsten.mijn('alice').lijsten.length, 0);
    assert.equal(h.experience.evidence('alice').evidence.length, 0);
  }
});
