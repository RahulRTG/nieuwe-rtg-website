/* De federatieve keten deelt een collectie met klassieke RTG-aanvragen.
   Een nieuwe ketenrij mag via geen van de oude projecties bij het kantoor,
   een ongeschikte ledenprojectie of een klassieke schrijver terechtkomen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maakOpslag = require('../server/kern/reisbureau-opslag');

function wereld() {
  const klassiek = { ref: 'RTG-R-EIGEN', tripId: 'reis-1', customerKey: 'user-7', codename: 'Gast',
    titel: 'RTG-reis', bestemming: 'Proefstad', personen: 1, vertrek: '2030-05-01',
    status: 'aangevraagd', at: '2030-04-01T12:00:00Z', prijs: { totaal: 100 } };
  const federatief = { ...klassiek, ref: 'RTG-R-PARTNER', titel: 'VERTROUWELIJKE PARTNERREIS',
    keten: { org: 'ORG-ANDER', versie: 1 }, besluit: { door: 'user-99' } };
  const db = { data: { reisAanvragen: [federatief, klassiek], partnerTrips: [
    { id: 'reis-1', title: 'RTG-reis', dest: 'Proefstad', netto: 100 }
  ] } };
  return { db, klassiek, federatief, opslag: maakOpslag({ db }) };
}

test('de bestaande opslagdeur geeft alleen klassieke rijen en houdt hun mutaties werkend', () => {
  const w = wereld();
  assert.deepEqual(w.opslag.aanvragen().map(a => a.ref), [w.klassiek.ref]);
  assert.deepEqual(w.opslag.pakAanvragen().map(a => a.ref), [w.klassiek.ref]);
  w.opslag.aanvragen()[0].status = 'bevestigd';
  assert.equal(w.klassiek.status, 'bevestigd', 'dezelfde klassieke rij blijft de eigenaar');
  assert.equal(w.federatief.status, 'aangevraagd');
});

test('vervangen, begrenzen en terugzetten van klassieke aanvragen behoudt actuele ketenrijen', () => {
  const w = wereld();
  const oud = structuredClone(w.opslag.aanvragen());
  const nieuw = { ...w.klassiek, ref: 'RTG-R-NIEUW' };
  const latereKeten = { ...w.federatief, ref: 'RTG-R-LATER' };
  w.db.data.reisAanvragen.unshift(latereKeten);
  const uit = w.opslag.zetAanvragen([nieuw, { ...w.federatief, ref: 'INGESMOKKELD' }]);
  assert.deepEqual(uit, [nieuw], 'ook het antwoord lekt de andere contractfamilie niet');
  assert.deepEqual(w.db.data.reisAanvragen.map(a => a.ref), [nieuw.ref, latereKeten.ref, w.federatief.ref]);
  assert.equal(w.db.data.reisAanvragen[2], w.federatief, 'bewaart het oorspronkelijke contractobject');
  w.opslag.zetAanvragen(oud);
  assert.deepEqual(w.db.data.reisAanvragen.map(a => a.ref), [w.klassiek.ref, latereKeten.ref, w.federatief.ref]);
  w.opslag.zetAanvragen([]);
  assert.deepEqual(w.db.data.reisAanvragen.map(a => a.ref), [latereKeten.ref, w.federatief.ref]);
  assert.throws(() => w.opslag.zetAanvragen({}), TypeError);
  assert.equal(w.db.data.reisAanvragen.length, 2);
});

test('lezen van een nog lege installatie maakt geen collectie, schrijven maakt alleen de klassieke lijst', () => {
  const db = { data: {} }, opslag = maakOpslag({ db });
  assert.deepEqual(opslag.aanvragen(), []);
  assert.equal(Object.hasOwn(db.data, 'reisAanvragen'), false);
  assert.deepEqual(opslag.pakAanvragen(), []);
  assert.deepEqual(db.data.reisAanvragen, []);
});

test('de RTG-reisbalie telt en toont geen partnerketen, ook niet in weektotalen', () => {
  const w = wereld();
  const kamer = require('../server/kern/afdelingen/register2/reisbalie')({ d: () => w.db.data,
    lijst: x => x || [], tel: x => (x || []).length, recent: x => (x || []).length }).reisbureau;
  const cijfers = Object.fromEntries(kamer.kpis());
  assert.equal(cijfers['Aanvragen open'], 1);
  assert.equal(cijfers['Aanvragen deze week'], 1);
  const lijsten = kamer.lijsten();
  assert.match(JSON.stringify(lijsten), /RTG-R-EIGEN/);
  assert.doesNotMatch(JSON.stringify(lijsten), /RTG-R-PARTNER|VERTROUWELIJKE|user-99/);
});

test('de klassieke Mall- en reisagendaweergave sluiten federatieve rijen uit, ook voor hetzelfde lid', () => {
  const w = wereld();
  const mall = require('../server/kern/mall/bestellingen')({ db: w.db }).mallBestellingen;
  assert.deepEqual(mall.mijn('user-7', 'Gast').bestellingen.map(x => x.id), [w.klassiek.ref]);
  const agenda = require('../server/kern/ervaring/leden/spaarpot')({ db: w.db,
    boekingenVanKlant: () => [], vandaag: () => '2030-01-01' });
  assert.deepEqual(agenda.agendaVoor('user-7').dagen.flatMap(d => d.items.map(i => i.ref)), [w.klassiek.ref]);
});

test('een partnerketen wordt geen RTG-aanbodblokkade of openbaar aanvraagcijfer', () => {
  const w = wereld();
  w.klassiek.status = 'afgewezen';
  const aanbod = require('../server/kern/reisaanbod').maakReisaanbod({ db: w.db, save() {}, crypto }).reisaanbod;
  assert.equal(aanbod.reisAanbodKantoor().reizen[0].openAanvragen, 0);
  assert.equal(aanbod.reisAanbodWeg('reis-1', 'user-7').ok, true);
  assert.equal(w.db.data.reisAanvragen.find(a => a.keten), w.federatief);
});

function routes(wie) {
  const w = wereld(), handlers = new Map();
  const officeAuth = () => {};
  const app = { post(pad, poort, fn) { assert.equal(poort, officeAuth); handlers.set(pad, fn); } };
  const save = () => {};
  const besluit = require('../server/kern/reisbureau-besluit')({ rij: w.opslag.aanvragen, save,
    nu: () => '2030-04-01T12:00:00Z', visum: () => null });
  const kern = { reisbureau: besluit, boardroomWie: () => wie,
    reisaanbod: require('../server/kern/reisaanbod').maakReisaanbod({ db: w.db, save, crypto }).reisaanbod };
  const veilig = (res, fn) => res.json(fn());
  const stuur = (res, value) => res.json(value);
  require('../server/routes/kantoren/reisbureau')({ app, officeAuth, veilig, stuur, afdelingen: {}, kern });
  require('../server/routes/kantoren/reizen')({ app, officeAuth, veilig, kern });
  async function doe(pad, body) {
    let uit;
    await handlers.get(pad)({ body }, { json(value) { uit = value; }, status() { return this; } });
    return uit;
  }
  return { ...w, doe };
}

test('bevestigen en afwijzen schrijven de sessieactor, nooit body.door', async () => {
  for (const [route, status] of [['bevestig', 'bevestigd'], ['afwijzen', 'afgewezen']]) {
    const w = routes('user-7');
    const uit = await w.doe('/api/office/reisbureau/' + route,
      { ref: w.klassiek.ref, door: 'VERVALSTE BESLISSER', reden: 'Niet beschikbaar.' });
    assert.equal(uit.ok, true);
    assert.equal(w.klassiek.status, status);
    assert.equal(w.klassiek.besluit.door, 'user-7');
    assert.equal(w.klassiek.geschiedenis[0].door, 'user-7');
  }
});

test('aanbod wijzigen en verwijderen schrijven de sessieactor; gedeelde sessies krijgen geen verzonnen naam', async () => {
  for (const identiteit of ['user-7', null]) {
    const w = routes(identiteit);
    const actor = identiteit || 'backoffice (gedeelde code)';
    const gezet = await w.doe('/api/office/reisaanbod/zet',
      { id: 'reis-1', titel: 'Gewijzigde RTG-reis', door: 'VERVALSTE BESLISSER' });
    assert.equal(gezet.ok, true);
    assert.equal(w.db.data.partnerTrips[0].gezetDoor, actor);
    w.klassiek.status = 'afgewezen';
    const weg = await w.doe('/api/office/reisaanbod/weg', { id: 'reis-1', door: 'VERVALSTE BESLISSER' });
    assert.equal(weg.door, actor);
  }
});
