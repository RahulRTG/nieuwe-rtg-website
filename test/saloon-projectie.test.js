'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/wereld/saloon');
const opslag = () => { const m = new Map(); return { haal: key => m.get(key), schrijf: (key, v) => m.set(key, v) }; };
const sess = { key: 'eigen', tier: 'rtg' };
test('bronstoring behoudt de andere bronnen en noemt het ontbrekende deel', async () => {
  const s = maak({ kern: {}, voorkeurOpslag: opslag(), lezers: {
    sociaal: () => { throw new Error('interne sleutel mag nooit naar de lezer'); },
    nieuws: () => ({ items: [{ id: 'nieuws:1', tekst: 'Nieuws', url: '/apps/krant.html' }] })
  } });
  const d = await s.lees(sess, { bronnen: ['sociaal', 'nieuws'] });
  assert.equal(d.items.length, 1); assert.equal(d.bronstatus[0].ok, false);
  assert.ok(!JSON.stringify(d).includes('interne sleutel'));
});
test('dezelfde onderwerpverbinding is zichtbaar; een filter verwijdert ook die verwijzing', async () => {
  const s = maak({ kern: {}, voorkeurOpslag: opslag(), lezers: {
    nieuws: () => ({ items: [
      { id: 'nieuws:1', titel: 'Haven', tekst: 'a', plaats: 'Amsterdam', onderwerpen: ['Stad'], url: '/apps/krant.html' },
      { id: 'nieuws:2', titel: 'Museum', tekst: 'b', plaats: 'Utrecht', onderwerpen: ['Stad'], url: '/apps/krant.html' }
    ] })
  } });
  assert.equal((await s.lees(sess, { bronnen: ['nieuws'] })).items[0].verbanden.length, 1);
  const d = await s.lees(sess, { bronnen: ['nieuws'], plaats: 'Amsterdam' });
  assert.equal(d.items.length, 1); assert.deepEqual(d.items[0].verbanden, []);
});
test('bronselectie kan leeg zijn; agenda en bewaren verzinnen geen objecten', async () => {
  const s = maak({ kern: {}, voorkeurOpslag: opslag(), lezers: {} });
  s.zetVoorkeuren(sess.key, { bronnen: [], bewaar: { id: 'nieuws:verdwenen', aan: true } });
  assert.deepEqual((await s.lees(sess)).items, []);
  assert.deepEqual((await s.lees(sess, { vorm: 'bewaard' })).items, []);
});
