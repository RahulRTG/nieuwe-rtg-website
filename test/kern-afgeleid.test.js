/* Tests voor de zuivere afgeleide berekeningen (server/kern/afgeleid.js).
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { publicPartner, weekdagFactor, cvReady, btwSplit } = require('../server/kern/afgeleid');

test('publicPartner geeft alleen de publieke velden en hasStaff als boolean', () => {
  const p = { code: 'KIKUNOI', name: 'Kikunoi', type: 'horeca', handle: '@kiku', staff: { code: 'X' }, geheim: 'nooit' };
  assert.deepEqual(publicPartner(p), { code: 'KIKUNOI', name: 'Kikunoi', type: 'horeca', handle: '@kiku', hasStaff: true });
  assert.equal(publicPartner({ code: 'A' }).hasStaff, false, 'geen staff -> hasStaff false');
});

test('weekdagFactor: weekend druk, zondag gemiddeld, doordeweeks rustiger', () => {
  assert.equal(weekdagFactor(new Date('2026-07-18'))[0], 1.25, 'zaterdag'); // za
  assert.equal(weekdagFactor(new Date('2026-07-17'))[0], 1.25, 'vrijdag'); // vr
  assert.equal(weekdagFactor(new Date('2026-07-19'))[0], 1.0, 'zondag');   // zo
  assert.equal(weekdagFactor(new Date('2026-07-15'))[0], 0.85, 'woensdag'); // wo
  assert.match(weekdagFactor(new Date('2026-07-18'))[1], /druk/);
});

test('cvReady: pas klaar met naam, contact en ervaring of vaardigheden', () => {
  assert.equal(cvReady(null), false);
  assert.equal(cvReady({ name: 'A', contact: 'b' }), false, 'zonder ervaring/skills niet klaar');
  assert.equal(cvReady({ name: 'A', contact: 'b', skills: ['koken'] }), true);
  assert.equal(cvReady({ name: 'A', contact: 'b', experience: [{}] }), true);
  assert.equal(cvReady({ name: '', contact: 'b', skills: ['x'] }), false, 'zonder naam niet klaar');
});

test('btwSplit: grondslag en btw, op centen, uit een bruto bedrag', () => {
  assert.deepEqual(btwSplit(121, 21), { omzet: 121, tarief: 21, grondslag: 100, btw: 21 });
  assert.deepEqual(btwSplit(109, 9), { omzet: 109, tarief: 9, grondslag: 100, btw: 9 });
  assert.deepEqual(btwSplit(100, 0), { omzet: 100, tarief: 0, grondslag: 100, btw: 0 }, '0%: alles grondslag');
  const r = btwSplit(0, 21);
  assert.equal(r.omzet + r.btw, 0, 'nul blijft nul');
});
