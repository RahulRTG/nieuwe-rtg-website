'use strict';
/* VRIJHEID: het teambeeld uit de bestaande bronnen, en de instellingen die
   nergens anders wonen. De nepbronnen hebben de VORM van de echte (een rij uit
   supplier_staff, een employmentBeeld, een vestiging, scheduleFor, een getoond
   vakbewijs) -- een fixture die de vorm aanneemt die de code verwacht, bewijst
   niets (CLAUDE.md over keyVanCodenaam). De montage zelf wordt bij het
   opstarten nagelopen in server/opzet/kernlaag5g.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakEigen = require('../server/kern/eigencollectie');
const huisVan = require('../server/kern/vrijheid/huis');

const VANDAAG = '2026-10-05'; // maandag
const plus = (n) => new Date(Date.parse(VANDAAG) + n * 86400000).toISOString().slice(0, 10);

function bronnen(extra) {
  const staff = [
    { id: 1, role: 'manager', member_id: 101, supplier_code: 'KIKUNOI' },
    { id: 2, role: 'staff', member_id: 102, supplier_code: 'KIKUNOI' },
    { id: 3, role: 'staff', member_id: 103, supplier_code: 'KIKUNOI' },
    { id: 4, role: 'staff', member_id: null, supplier_code: 'KIKUNOI' },  // geen eigen account
    { id: 5, role: 'staff', member_id: 105, supplier_code: 'KIKUNOI' }    // geen dienstverband
  ];
  const dienstverband = { 'user-101': 'ENT1', 'user-102': 'ENT1', 'user-103': 'ENT1', 'user-105': 'ANDERE' };
  return Object.assign({
    accounts: { listStaff: (code) => code === 'KIKUNOI' ? staff : [] },
    findSupplier: () => ({ roosterVast: { [VANDAAG]: { 2: 'Ochtend 07:00-15:00' } } }),
    vestigingVanUnit: (code) => code === 'KIKUNOI' ? { id: 'V1', entiteit: 'ENT1', units: ['KIKUNOI'] } : null,
    employmentVanPersoon: (p) => dienstverband[p] ? [{ id: 'e-' + p, persoon: p, entiteit: dienstverband[p], van: '2025-01-01', tot: null, actief: true }] : [],
    scheduleFor: () => ({ days: [0, 1, 2].map(n => ({ date: plus(n), staff: staff.map(s => ({ id: s.id, shift: n === 2 && s.id === 3 ? 'Vrij' : 'Ochtend 07:00-15:00' })) })) }),
    vakbewijzenVan: (sleutel) => sleutel === 'lid:103'
      ? [{ wat: 'kassa_l3', tot: '2027-01-01', geldig: true, afgetekend: { door: 'Kantoor RTG' } }] : []
  }, extra || {});
}

function huis(extra) {
  const db = { data: {} };
  return { h: huisVan({ db, save: () => {}, kern: () => bronnen(extra) }), db };
}

test('het teambeeld komt uit de bronnen, en zegt wat ontbreekt', () => {
  const { h } = huis();
  const t = h.teambeeld('KIKUNOI');
  assert.equal(t.organisatie, 'KIKUNOI');
  assert.deepEqual(t.managers, ['1']);
  const dienst = (id) => t.mensen.find(m => m.id === id).inDienst;
  assert.deepEqual(dienst('2'), { van: '2025-01-01', tot: null });
  assert.equal(dienst('4'), null, 'zonder account geen dienstverband');
  assert.equal(dienst('5'), null, 'een dienstverband bij een andere entiteit telt niet');
  assert.ok(t.mensen.every(m => !('lid' in m)), 'het ledennummer gaat niet mee in het beeld');
  const d = t.diensten.find(x => x.persoon === '2' && x.datum === VANDAAG);
  assert.deepEqual([d.van, d.tot, d.bron], ['07:00', '15:00', 'vastgesteld']);
  assert.equal(t.diensten.find(x => x.persoon === '1').bron, 'patroon');
  assert.ok(!t.diensten.some(x => x.persoon === '3' && x.datum === plus(2)), 'Vrij is geen dienst');
  assert.deepEqual(t.kwalificaties, [{ persoon: '3', code: 'KASSA_L3', geldigTot: '2027-01-01', afgetekendDoor: 'rtg:Kantoor RTG' }]);
  const velden = t.ontbreekt.map(o => o.veld);
  for (const v of ['inDienst', 'diensten', 'eisen', 'feestdagen', 'verantwoordelijkheden']) assert.ok(velden.includes(v), v);
  assert.equal(t.verantwoordelijkheden.length, 0, 'niets verzonnen');
});

test('een zaak zonder entiteit heeft niemand in dienst, met de reden', () => {
  const { h } = huis({ vestigingVanUnit: () => null });
  const t = h.teambeeld('KIKUNOI');
  assert.ok(t.mensen.every(m => m.inDienst === null));
  assert.match(t.ontbreekt[0].reden, /geen vestiging van een entiteit/);
});

test('instellingen: de verjaardag geeft alleen de mens zelf op, de bezetting alleen een leidinggevende', () => {
  const { h, db } = huis();
  const i = h.instellingen;
  assert.deepEqual(i.lees('KIKUNOI').eisen, []);
  assert.equal(db.data.vrijheidInstellingen, undefined, 'lezen schept niets');
  assert.equal(i.zetVerjaardag('KIKUNOI', '2', '10-06', '1').status, 403, 'de manager zet geen verjaardag van een ander');
  assert.equal(i.zetVerjaardag('KIKUNOI', '2', '13-40', '2').status, 400);
  assert.ok(i.zetVerjaardag('KIKUNOI', '2', '10-06', '2').ok);
  assert.equal(h.teambeeld('KIKUNOI').mensen.find(m => m.id === '2').verjaardag, '10-06');
  assert.ok(i.zetVerjaardag('KIKUNOI', '2', null, '2').ok, 'en hij haalt hem ook weer weg');
  assert.equal(h.teambeeld('KIKUNOI').mensen.find(m => m.id === '2').verjaardag, undefined);
  const eis = { weekdag: 1, van: '07:00', tot: '15:00', minBezetting: 2, vereist: { KASSA_L3: 1 } };
  assert.equal(i.zetEisen('KIKUNOI', [eis], { door: '2', leidinggevende: false }).status, 403);
  assert.equal(i.zetEisen('KIKUNOI', [{ ...eis, weekdag: 9 }], { door: '1', leidinggevende: true }).status, 422);
  assert.ok(i.zetEisen('KIKUNOI', [eis], { door: '1', leidinggevende: true }).ok);
  assert.equal(i.zetFeestdagen('KIKUNOI', ['2026-12-25'], { leidinggevende: false }).status, 403);
  assert.ok(i.zetFeestdagen('KIKUNOI', ['2026-12-25', '2026-12-25'], { leidinggevende: true }).ok);
  assert.deepEqual(i.lees('KIKUNOI').feestdagen, ['2026-12-25']);
});

test('van teambeeld tot besluit: wie geen dienstverband heeft krijgt BLOCKED, een ander kan', () => {
  const { h } = huis();
  h.instellingen.zetEisen('KIKUNOI', [{ weekdag: 1, van: '07:00', tot: '15:00', minBezetting: 2, vereist: { KASSA_L3: 1 } }], { door: '1', leidinggevende: true });
  const t = h.teambeeld('KIKUNOI');
  const beleid = h.beleidVoor('KIKUNOI', true);
  const vraag = (p) => h.motor.vraag('KIKUNOI', t, { soort: 'VRIJE_DAG', categorie: 'RTG_DAY', persoon: p, datum: VANDAAG }, { door: p, beleid });
  assert.equal(vraag('5').verzoek.uitkomst, 'BLOCKED_BY_LAW_OR_POLICY');
  assert.equal(vraag('2').verzoek.uitkomst, 'AUTO_APPROVED', 'drie in dienst, minimum twee, de kassa blijft gedekt');
  const specialist = vraag('3').verzoek;
  assert.notEqual(specialist.uitkomst, 'AUTO_APPROVED', 'de enige met KASSA_L3 kan niet zomaar weg');
  assert.match(specialist.stappen.find(s => s.stap === 'QUALIFICATION_COVERAGE').uitleg, /KASSA_L3/);
});

test('een andere zaak leent het beleid van RTG niet', () => {
  const { h } = huis();
  assert.equal(h.beleidVoor('KIKUNOI', true).waarde('rtgDag.perJaar').waarde, 10);
  assert.ok(h.beleidVoor('KIKUNOI', false).waarde('rtgDag.perJaar').open);
});

test('de opslag is een eigen collectie en geen losse db.data-schrijver', () => {
  const db = { data: {} };
  const eigen = maakEigen({ db, domein: 'toets', bezit: { iets: 'kaart' } });
  assert.throws(() => eigen.bak('vrijheid'), /staat niet in wat dit domein/);
  const { h, db: echt } = huis();
  h.motor.planVerjaardagen('KIKUNOI', h.teambeeld('KIKUNOI'), 2026, { beleid: h.beleidVoor('KIKUNOI', true) });
  assert.ok(echt.data.vrijheid && echt.data.vrijheid.KIKUNOI, 'de motor schrijft in de collectie vrijheid');
});
