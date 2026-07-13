/* Tests voor de event-/keukenlaag (server/kern/events.js).
   De functies dragen crypto + sectiesForOrder; we voeren echte stubs op.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RUN_STATIONS, ALT_IDEE, coachCache, maakEvents } = require('../server/kern/events');

// sectiesForOrder zoals in server.js: welke keukensecties heeft een bon nodig.
function sectiesForOrder(s, o) {
  const set = new Set();
  for (const it of (o.items || [])) {
    const m = (s.menu || []).find(x => x.id === it.id);
    if (m && m.station !== 'bar') set.add(m.sectie || 'warm');
  }
  return [...set];
}
const ev = maakEvents({ crypto, sectiesForOrder });

test('pure exports zijn aanwezig', () => {
  assert.ok(RUN_STATIONS.includes('keuken') && RUN_STATIONS.includes('party'));
  assert.ok(ALT_IDEE.noten && ALT_IDEE.gluten, 'allergeen-alternatieven');
  assert.ok(coachCache instanceof Map);
});

test('runItem: normaliseert tijd, station en daysBefore', () => {
  const geldig = ev.runItem('18:30', 'keuken', '  Mise en place  ', 3, true);
  assert.equal(geldig.time, '18:30');
  assert.equal(geldig.station, 'keuken');
  assert.equal(geldig.text, 'Mise en place');
  assert.equal(geldig.daysBefore, 3);
  assert.equal(geldig.mep, true);
  assert.equal(geldig.done, false);
  const raar = ev.runItem('kwart voor acht', 'onzin', 'x', 99);
  assert.equal(raar.time, '00:00', 'niet-hh:mm -> 00:00');
  assert.equal(raar.station, 'alle', 'onbekend station -> alle');
  assert.equal(raar.daysBefore, 14, 'daysBefore geplafonneerd op 14');
});

test('sortRunsheet: dagen vooruit eerst, nacht-uren achteraan', () => {
  const e = { runsheet: [
    ev.runItem('01:00', 'alle', 'afbouw', 0),
    ev.runItem('20:00', 'keuken', 'start', 0),
    ev.runItem('10:00', 'keuken', 'inkoop', 2)
  ] };
  ev.sortRunsheet(e);
  assert.deepEqual(e.runsheet.map(r => r.text), ['inkoop', 'start', 'afbouw'],
    'twee dagen vooruit eerst, daarna 20:00, daarna 01:00 (na middernacht)');
});

test('parseRunsheetText: leidt tijd en station uit vrije regels af', () => {
  const items = ev.parseRunsheetText('18:00 keuken mise en place\n19.30 - Bar - koeling vullen\nonzin zonder tijd toch tekst');
  assert.equal(items[0].station, 'keuken');
  assert.equal(items[0].time, '18:00');
  assert.equal(items[1].station, 'bar');
  assert.equal(items[1].time, '19:30');
  assert.ok(items.length >= 2);
});

test('cateringDishes en eventCovers', () => {
  const s = { menu: [{ id: 'a', name: 'Sushi', station: 'keuken' }, { id: 'b', name: 'Sake', station: 'bar' }] };
  assert.deepEqual(ev.cateringDishes(s, { catering: { mode: 'menu', itemIds: ['a'] } }).map(d => d.name), ['Sushi']);
  assert.deepEqual(ev.cateringDishes(s, { catering: { mode: 'alacarte' } }).map(d => d.name), ['Sushi'], 'a la carte laat bar weg');
  assert.equal(ev.eventCovers({ guests: [{ qty: 40 }], capacity: 100 }), 60, 'minstens 60% van capaciteit');
  assert.equal(ev.eventCovers({ guests: [{ qty: 90 }], capacity: 100 }), 90, 'aanmeldingen boven de ondergrens tellen');
});

test('coachRules: signaleert een oude bon en batcht dezelfde gerechten', () => {
  const s = { menu: [{ id: 'a', name: 'Ramen', station: 'keuken', sectie: 'warm' }] };
  const oud = new Date(Date.now() - 20 * 60000).toISOString();
  const open = [
    { pickup: 'RTG-1', at: oud, status: 'nieuw', items: [{ id: 'a', name: 'Ramen', qty: 1 }], secties: {} },
    { pickup: 'RTG-2', at: oud, status: 'nieuw', items: [{ id: 'a', name: 'Ramen', qty: 2 }], secties: {} }
  ];
  const lines = ev.coachRules(s, open, 'nl');
  assert.ok(lines.some(l => /wacht al/.test(l)), 'te-laat-melding');
  assert.ok(lines.some(l => /in .*keer|Ramen/.test(l)), 'batch-advies voor hetzelfde gerecht');
  const en = ev.coachRules(s, open, 'en');
  assert.ok(en.some(l => /waiting|one go/.test(l)), 'Engelse variant');
});
