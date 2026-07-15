/* Het vuurplan en de keukencoach: elke tafel gaat in een keer met warm eten
   uit. De kant met de langste resttijd bepaalt het doel; de andere kanten
   starten precies zo laat dat iedereen samen bij nul uitkomt.
   Draai: node --test test/vuurplan.test.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { maakEvents, SECTIE_MIN } = require('../server/kern/events');

// een kaart over drie keukenkanten plus de bar
const S = { menu: [
  { id: 'steak', name: 'Steak', station: 'keuken', sectie: 'warm' },
  { id: 'salade', name: 'Salade', station: 'keuken', sectie: 'koud' },
  { id: 'taart', name: 'Taart', station: 'keuken', sectie: 'dessert' },
  { id: 'gin', name: 'Gin-tonic', station: 'bar' }
] };
const sectiesForOrder = (s, o) => {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = s.menu.find(x => x.id === it.id);
    if (m && m.station !== 'bar') set.add(m.sectie || 'warm');
  }
  return [...set];
};
const { vuurplan, sectieTijd, coachRules } = maakEvents({ crypto, sectiesForOrder });

test('vuurplan: de koude kant wacht precies op de warme kant', () => {
  const o = { items: [{ id: 'steak', qty: 1 }, { id: 'salade', qty: 1 }], secties: {} };
  const { doel, plan } = vuurplan(S, o);
  assert.equal(doel, SECTIE_MIN.warm);
  assert.equal(plan.warm.doe, 'nu');
  assert.equal(plan.koud.doe, 'wacht');
  assert.equal(plan.koud.min, SECTIE_MIN.warm - SECTIE_MIN.koud);
});

test('vuurplan: een klare kant naast een bezige kant betekent warm houden', () => {
  const o = { items: [{ id: 'steak', qty: 1 }, { id: 'salade', qty: 1 }], secties: { koud: 'klaar', warm: 'bezig' } };
  const { doel, plan } = vuurplan(S, o);
  assert.equal(plan.koud.doe, 'warm');
  assert.equal(plan.warm.doe, 'bezig');
  assert.equal(doel, Math.ceil(SECTIE_MIN.warm / 2));  // bezig telt de halve tijd
});

test('vuurplan: alles klaar mag naar de pas', () => {
  const o = { items: [{ id: 'steak', qty: 1 }], secties: { warm: 'klaar' } };
  const { doel, plan } = vuurplan(S, o);
  assert.equal(doel, 0);
  assert.equal(plan.warm.doe, 'pas');
});

test('vuurplan: de bar telt mee en wacht op de warme kant', () => {
  const o = { items: [{ id: 'steak', qty: 1 }, { id: 'gin', qty: 2 }], secties: {}, stations: {} };
  const { doel, plan } = vuurplan(S, o);
  assert.equal(doel, SECTIE_MIN.warm);
  assert.equal(plan.bar.doe, 'wacht');                       // de gin-tonic komt pas vlak voor de steak
  assert.equal(plan.bar.min, SECTIE_MIN.warm - SECTIE_MIN.bar);
  assert.equal(plan.warm.doe, 'nu');
});

test('vuurplan: bar klaar terwijl de keuken nog bezig is betekent koud houden', () => {
  const o = { items: [{ id: 'steak', qty: 1 }, { id: 'gin', qty: 1 }], secties: { warm: 'bezig' }, stations: { bar: 'klaar' } };
  const { plan } = vuurplan(S, o);
  assert.equal(plan.bar.doe, 'warm');                        // advies: houd vast tot de keuken er is
  assert.equal(plan.warm.doe, 'bezig');
});

test('sectieTijd: prepMin op het gerecht wint van de nominale tijd', () => {
  const S2 = { menu: [{ id: 'wild', name: 'Wildragout', station: 'keuken', sectie: 'warm', prepMin: 25 }] };
  const o = { items: [{ id: 'wild', qty: 1 }] };
  assert.equal(sectieTijd(S2, o, 'warm'), 25);
});

test('coach: het vuurplan komt met concrete minuten in de aanwijzingen', () => {
  const open = [{
    ref: 'r1', pickup: 'A12', table: 'Tafel 3', at: new Date().toISOString(), status: 'nieuw',
    items: [{ id: 'steak', qty: 1, name: 'Steak' }, { id: 'salade', qty: 1, name: 'Salade' }], secties: {}
  }];
  const lines = coachRules(S, open, 'nl');
  const verwacht = SECTIE_MIN.warm - SECTIE_MIN.koud;
  assert.ok(lines.some(l => l.includes('over ~' + verwacht + ' min')), lines.join(' | '));
  assert.ok(lines.some(l => l.includes('warm uit')), lines.join(' | '));
});

test('coach: klaarliggend eten levert een houd-warm-aanwijzing op', () => {
  const open = [{
    ref: 'r2', pickup: 'B07', table: null, at: new Date().toISOString(), status: 'in bereiding',
    items: [{ id: 'steak', qty: 1, name: 'Steak' }, { id: 'salade', qty: 1, name: 'Salade' }],
    secties: { koud: 'klaar', warm: 'bezig' }
  }];
  const lines = coachRules(S, open, 'nl');
  assert.ok(lines.some(l => l.includes('houd warm')), lines.join(' | '));
});
