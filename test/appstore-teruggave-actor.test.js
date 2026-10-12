/* rechtDoe EIST ZELF EEN ACTOR (11 oktober 2026). De route zet de sessiesleutel
   al mee, maar een toekomstige aanroeper zonder `doorKey` mag geen besluit over
   andermans geld vastleggen -- ook niet met een naam als label.

   Draai los: node --test test/appstore-teruggave-actor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakTeruggave = require('../server/kern/appstore/teruggave');

function motor() {
  const staat = { teruggaven: [{ id: 'r1', status: 'open', sleutel: 'x', key: 'user-9', codenaam: 'Amber', zaak: 'Z', centen: 100 }] };
  const geboekt = [];
  const t = maakTeruggave({ S: () => staat, save() {}, nu: () => 'nu', boek: (...a) => geboekt.push(a), eigen: (o, k) => o[k],
    pay: { terugGave: async () => ({ centen: 100, delen: [] }) }, aankopen: () => [], noteer() {} });
  return { t, staat, geboekt };
}

test('zonder doorKey geen besluit, ook niet met een label', async () => {
  const { t, staat, geboekt } = motor();
  const r = await t.rechtDoe({ id: 'r1', besluit: 'afgewezen', reden: 'een reden van genoeg tekens', door: 'een medewerker van RTG' });
  assert.equal(r.status, 403, JSON.stringify(r));
  assert.equal(r.watNu, 'inloggen-op-naam');
  assert.equal(staat.teruggaven[0].status, 'open', 'het recht bleef open');
  assert.equal(geboekt.length, 0, 'en er staat niets in het journaal');
});

test('met doorKey wel, en de sleutel staat alleen intern', async () => {
  const { t, staat, geboekt } = motor();
  const r = await t.rechtDoe({ id: 'r1', besluit: 'afgewezen', reden: 'een reden van genoeg tekens', door: 'een medewerker van RTG', doorKey: 'user-3' });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(staat.teruggaven[0].besluit.doorKey, 'user-3');
  assert.equal(geboekt[0][2], 'een medewerker van RTG', 'het journaal draagt het label');
  assert.deepEqual(geboekt[0][3].intern, { doorKey: 'user-3' });
});
