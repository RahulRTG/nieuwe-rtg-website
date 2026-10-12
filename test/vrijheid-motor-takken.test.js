'use strict';
/* VRIJHEID: de motor in server/kern/vrijheid/index.js, met een nagemaakte
   opslag. Hier de takken van vraag(): de poorten (organisatie, voor uzelf), de
   idempotentiesleutel, het dubbele verzoek, de saldi uit de rechten, de reden
   bij bijzonder verlof, elke uitkomst naar zijn stand, en welke eerder
   toegekende afwezigheid meetelt voor de dekking. Lezen schept niets. Het
   beleid is een PROEFBELEID, geen vastgesteld arbeidsvoorwaardenbesluit. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakVrijheid, ACTIEF, TOEGEKEND } = require('../server/kern/vrijheid');
const { maakBeleid } = require('../server/kern/vrijheid/beleid');

const w = (waarde) => ({ waarde, bron: 'proefbeleid' });
const beleid = maakBeleid({
  LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) },
  ORGANIZATION_POLICY: { 'vroegVertrek.autoTotMinuten': w(120), 'eerlijkheid.vensterDagen': w(28), 'eerlijkheid.maxExtraDekking': w(2) },
  RTG_ADDITIONAL_BENEFIT: { 'rtgDag.perJaar': w(3) }
});
const zonderRtg = maakBeleid({ LEGAL_BASELINE: { 'rust.minUurTussenDiensten': w(11) } });
const ORG = 'proefzaak';
const DAG = '2026-10-05';

function team(o = {}) {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    organisatie: o.organisatie || 'PROEFZAAK', managers: ['m'], rosterVersie: 'r1',
    mensen: ids.map(id => ({ id, inDienst: { van: '2024-01-01', tot: null } })),
    diensten: ids.map(p => ({ persoon: p, datum: DAG, van: '09:00', tot: '17:00' })),
    eisen: o.zonderEisen ? [] : [{ datum: DAG, van: '09:00', tot: '17:00', minBezetting: o.min != null ? o.min : 2 }],
    kwalificaties: [], verantwoordelijkheden: [], schaars: []
  };
}
function motor(o = {}) {
  const bak = {}; const events = []; let bewaard = 0;
  const opslag = { bak: (n) => bak[n] || (bak[n] = {}) };
  if (o.kijk) opslag.kijk = (n) => bak[n] || {};
  const m = maakVrijheid({ opslag, nu: o.zonderKlok ? undefined : () => '2026-10-01T08:00:00.000Z',
    save: o.zonderSave ? undefined : () => { bewaard++; }, meld: o.zonderMeld ? undefined : (type, data) => events.push({ type, ...data }), rooster: o.rooster });
  return { m, bak, events, bewaard: () => bewaard };
}
const verzoek = (x) => ({ soort: 'VRIJE_DAG', categorie: 'SCHEDULE_FLEXIBILITY', persoon: 'c', datum: DAG, ...x });
const opts = (x) => ({ door: 'c', beleid, rechten: { wettelijk: 160, contractueel: 8 }, ...x });

test('de standenlijsten: wat toegekend is, is grotendeels ook actief', () => {
  assert.ok(ACTIEF.includes('HUMAN_REVIEW'));
  assert.ok(!TOEGEKEND.includes('HUMAN_REVIEW'));
  assert.ok(TOEGEKEND.includes('COMPLETED'));
});

test('poorten: een vreemd teambeeld is 403, en een verzoek doet u alleen voor uzelf', () => {
  const { m, bak } = motor();
  assert.equal(m.vraag(ORG, team({ organisatie: 'ANDERE' }), verzoek(), opts()).status, 403);
  assert.equal(m.vraag(ORG, null, verzoek(), opts()).status, 403);
  assert.match(m.vraag(ORG, team(), verzoek(), opts({ door: 'b' })).error, /alleen voor uzelf/);
  assert.equal(m.vraag(ORG, team(), null, opts()).status, 403);
  assert.equal(m.vraag(ORG, team(), verzoek(), { beleid }).status, 403);
  assert.equal(bak.vrijheid, undefined, 'een geweigerde vraag schept geen opslag');
});

test('zonder organisatiecode weigert de opslag hardop', () => {
  const { m } = motor();
  assert.throws(() => m.vraag('', { organisatie: '' }, verzoek(), opts()), /Geen organisatie/);
});

test('een automatisch goedgekeurd verzoek wordt gepland, geboekt en gemeld', () => {
  const { m, bak, events, bewaard } = motor();
  const r = m.vraag(ORG, team(), verzoek(), opts());
  assert.equal(r.ok, true);
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  assert.equal(r.verzoek.rooster, 'NIET_AANGESLOTEN');
  const staat = bak.vrijheid.PROEFZAAK;
  assert.equal(staat.boekingen.length, 1);
  assert.equal(staat.boekingen[0].id, r.verzoek.id);
  assert.deepEqual(events.map(e => e.type), ['FREEDOM_REQUESTED', 'FREEDOM_APPROVED']);
  assert.equal(bewaard(), 1);
  assert.match(r.verzoek.id, /^vv_[0-9a-f]{12}$/);
});

test('dezelfde sleutel met dezelfde inhoud geeft het eerdere antwoord, andere inhoud is 409', () => {
  const { m } = motor();
  const eerst = m.vraag(ORG, team(), verzoek(), opts({ sleutel: 'k1' }));
  const weer = m.vraag(ORG, team(), verzoek(), opts({ sleutel: 'k1' }));
  assert.equal(weer.herhaling, true);
  assert.equal(weer.verzoek.id, eerst.verzoek.id);
  const anders = m.vraag(ORG, team(), verzoek({ datum: '2026-10-06' }), opts({ sleutel: 'k1' }));
  assert.equal(anders.status, 409);
  assert.match(anders.error, /al gebruikt voor een ander verzoek/);
});

test('een tweede gelijk verzoek terwijl het eerste nog loopt, is 409 met het lopende verzoek', () => {
  const { m } = motor();
  const eerst = m.vraag(ORG, team(), verzoek(), opts());
  const dubbel = m.vraag(ORG, team(), verzoek(), opts());
  assert.equal(dubbel.status, 409);
  assert.equal(dubbel.verzoek.id, eerst.verzoek.id);
});

test('onbekende dekking gaat naar een mens; bijzonder verlof bewaart de reden vertrouwelijk', () => {
  const { m, bak, events } = motor();
  const r = m.vraag(ORG, team({ zonderEisen: true }), verzoek(), opts());
  assert.equal(r.verzoek.stand, 'HUMAN_REVIEW');
  assert.equal(r.verzoek.uitkomst, 'HUMAN_REVIEW_REQUIRED');
  const lang = 'x'.repeat(600);
  const bijzonder = m.vraag(ORG, team(), verzoek({ categorie: 'SPECIAL_LEAVE', datum: DAG, reden: lang }), opts());
  assert.equal(bijzonder.verzoek.stand, 'HUMAN_REVIEW');
  assert.equal(bak.vrijheid.PROEFZAAK.vertrouwelijk[bijzonder.verzoek.id].length, 500);
  assert.equal(bijzonder.verzoek.reden, undefined, 'de reden staat niet op het verzoek zelf');
  /* bij gewone persoonlijke tijd wordt een reden niet bewaard */
  const gewoon = m.vraag(ORG, team({ zonderEisen: true }), verzoek({ categorie: 'UNPAID_LEAVE', reden: 'privé' }), opts());
  assert.equal(bak.vrijheid.PROEFZAAK.vertrouwelijk[gewoon.verzoek.id], undefined);
  assert.ok(!events.some(e => e.type === 'FREEDOM_DECLINED'));
});

test('een onbekend saldo wordt een menselijke beoordeling met de reden uit de rechten', () => {
  const { m } = motor();
  const r = m.vraag(ORG, team(), verzoek({ categorie: 'STATUTORY_LEAVE' }),
    opts({ rechten: { waarom: { wettelijk: 'Het contract is niet aangeleverd.' } } }));
  assert.equal(r.verzoek.uitkomst, 'UNKNOWN');
  assert.equal(r.verzoek.stand, 'HUMAN_REVIEW');
  assert.match(r.verzoek.stappen.find(s => s.stap === 'RIGHTS_POLICY').uitleg, /Het contract is niet aangeleverd\./);
  /* zonder rechten-object helemaal is het saldo ook onbekend, zonder reden */
  const kaal = m.vraag(ORG, team(), verzoek({ categorie: 'CONTRACTUAL_LEAVE' }), { door: 'c', beleid });
  assert.equal(kaal.verzoek.uitkomst, 'UNKNOWN');
});

test('geweigerd en geblokkeerd worden DECLINED en gemeld; een RTG Day zonder recht is geblokkeerd', () => {
  const { m, events } = motor();
  const geen = m.vraag(ORG, team(), verzoek({ datum: '2026-10-07' }), opts());
  assert.equal(geen.verzoek.stand, 'DECLINED');
  const rtg = m.vraag(ORG, team(), verzoek({ categorie: 'RTG_DAY' }), opts({ beleid: zonderRtg }));
  assert.equal(rtg.verzoek.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.equal(rtg.verzoek.stand, 'DECLINED');
  assert.equal(events.filter(e => e.type === 'FREEDOM_DECLINED').length, 2);
});

test('een gat met een alternatief: ALTERNATIVE_PROPOSED en een dekkingssignaal met de blokkades', () => {
  const { m, events } = motor();
  const t = team({ min: 4 });
  t.diensten.push(...['a', 'b', 'c', 'd'].map(p => ({ persoon: p, datum: '2026-10-06', van: '09:00', tot: '17:00' })));
  t.eisen.push({ datum: '2026-10-06', van: '09:00', tot: '17:00', minBezetting: 1 });
  const r = m.vraag(ORG, t, verzoek(), opts());
  assert.equal(r.verzoek.uitkomst, 'ALTERNATIVE_AVAILABLE');
  assert.equal(r.verzoek.stand, 'ALTERNATIVE_PROPOSED');
  const gat = events.find(e => e.type === 'COVERAGE_GAP_DETECTED');
  assert.deepEqual(gat.blokkades, ['bezetting']);
});

test('een RTG Day die wordt toegekend, meldt zich als RTG Day', () => {
  const { m, events } = motor();
  const r = m.vraag(ORG, team(), verzoek({ categorie: 'RTG_DAY' }), opts());
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  assert.ok(events.some(e => e.type === 'RTG_DAY_SCHEDULED'));
  assert.ok(!events.some(e => e.type === 'FREEDOM_APPROVED'));
});

test('eerder toegekende afwezigheid uit aanbod, verjaardag en hersteltijd telt mee voor de dekking', () => {
  const { m, bak } = motor();
  const DAGBEGIN = Date.UTC(2026, 9, 5) / 60000;
  const afw = (p) => ({ persoon: p, van: DAGBEGIN, tot: DAGBEGIN + 24 * 60 });
  /* eerst een gewoon verzoek, zodat de organisatie bestaat */
  m.vraag(ORG, team({ zonderEisen: true }), verzoek({ persoon: 'd', datum: '2026-10-09' }), opts({ door: 'd' }));
  const staat = bak.vrijheid.PROEFZAAK;
  staat.aanbiedingen.o1 = { id: 'o1', stand: 'ACCEPTED', afwezigheid: afw('a') };
  staat.aanbiedingen.o2 = { id: 'o2', stand: 'OFFERED', afwezigheid: afw('d') };
  staat.verjaardagen.j1 = { id: 'j1', stand: 'SCHEDULED', afwezigheid: afw('b') };
  staat.verjaardagen.j2 = { id: 'j2', stand: 'SCHEDULED' };
  staat.boekingen.push({ id: 'h1', categorie: 'RECOVERY_RELEASE', afwezigheid: afw('d'), persoon: 'd', datum: DAG });
  staat.boekingen.push({ id: 'h2', categorie: 'RTG_DAY', afwezigheid: afw('d'), persoon: 'd', datum: DAG });
  /* a, b en d zijn al weg; c erbij laat niemand over bij een minimum van 1 */
  const r = m.vraag(ORG, team({ min: 1 }), verzoek(), opts());
  assert.equal(r.verzoek.stand, 'DECLINED');
  assert.equal(r.verzoek.code, 'geen-alternatief');
  /* zonder die afwezigheid was het gewoon goed */
  const { m: m2 } = motor();
  assert.equal(m2.vraag(ORG, team({ min: 1 }), verzoek(), opts()).verzoek.stand, 'SCHEDULED');
});

test('zonder klok, opslagfunctie en melder werkt de motor met zijn eigen standaarden', () => {
  const { m, bak } = motor({ zonderKlok: true, zonderSave: true, zonderMeld: true });
  const r = m.vraag(ORG, team(), verzoek(), opts());
  assert.equal(r.verzoek.stand, 'SCHEDULED');
  assert.match(r.verzoek.aangevraagd, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(bak.vrijheid.PROEFZAAK.boekingen.length, 1);
});

test('lezen schept niets: een leeg beeld wordt niet teruggeschreven, met en zonder kijk()', () => {
  for (const kijk of [true, false]) {
    const { m, bak } = motor({ kijk });
    const beeld = m.teamBeeld(ORG, team());
    assert.deepEqual(beeld.afwezig, []);
    assert.equal((bak.vrijheid || {}).PROEFZAAK, undefined);
    m.vraag(ORG, team(), verzoek(), opts());
    assert.equal(m.teamBeeld(ORG, team()).afwezig.length, 1);
  }
});

test('een rooster dat faalt, laat ONBEKEND achter en vraagt om afstemmen', () => {
  const { m, events } = motor({ rooster: { pas: () => { throw new Error('rooster weg'); } } });
  const r = m.vraag(ORG, team(), verzoek(), opts());
  assert.equal(r.verzoek.rooster, 'ONBEKEND');
  assert.equal(r.verzoek.roosterFout, 'rooster weg');
  assert.ok(events.some(e => e.type === 'RECONCILE_REQUIRED'));
  const goed = motor({ rooster: { pas: () => ({ stand: 'BIJGEWERKT' }) } });
  assert.equal(goed.m.vraag(ORG, team(), verzoek(), opts()).verzoek.rooster, 'BIJGEWERKT');
});
