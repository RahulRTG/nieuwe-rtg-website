/* PLAATSVORM (NAVIGATIE.md par. 14, A0a) -- wat verstaat RTG onder een plaats?

   De meter leent de lezer van scripts/objectmodel.js. Deze toets voert hem met
   verzonnen vormen waarvan de uitslag vaststaat (LAT-regel 10: een meter die je
   nooit hebt zien uitslaan is geen meter), en houdt het register tegen een
   verse meting.

   Draai los: node --test test/plaatsvorm.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { meet } = require('../scripts/plaatsvorm');

const V = (module, velden) => ({ module, velden: ['id'].concat(velden) });

test('1. een drempelveld telt nooit als gedeelde vorm', () => {
  /* ZAKT OP: DEFINITIE leeg maken -- dan staan lat en lng "in alle domeinen",
     precies de uitslag die de drempel zelf veroorzaakt. */
  const u = meet({ envelop: ['id'], vormen: [
    V('server/kern/a/x.js', ['lat', 'lng', 'titel']),
    V('server/kern/b/y.js', ['lat', 'lng', 'kamer'])
  ] });
  assert.deepEqual(u.rondes.smal.vorm.inAlleDomeinen, []);
  assert.equal(u.geenGedeeldeVorm, true);
});

test('2. een echt gedeeld veld slaat de conclusie om', () => {
  const u = meet({ envelop: ['id'], vormen: [
    V('server/kern/a/x.js', ['lat', 'lng', 'ingang']),
    V('server/kern/b/y.js', ['lat', 'lng', 'ingang'])
  ] });
  assert.deepEqual(u.rondes.smal.vorm.inAlleDomeinen, ['ingang']);
  assert.equal(u.geenGedeeldeVorm, false);
  assert.match(u.conclusie, /GEDEELDE VORM GEVONDEN/);
});

test('3. de schrijfwijzen van een punt worden apart geteld', () => {
  const u = meet({ envelop: ['id'], vormen: [
    V('server/kern/a/x.js', ['lat', 'lng', 'q']),
    V('server/kern/a/z.js', ['lat', 'lon', 'q']),
    V('server/kern/b/y.js', ['locatie', 'r'])
  ] });
  assert.equal(u.rondes.ruim.woordenschat.aantal, 3);
  assert.deepEqual(u.rondes.ruim.woordenschat.domeinenMetMeerdereSchrijfwijzen, ['kern/a']);
});

test('4. minder dan twee domeinen is niet vast te stellen, en geen "geen gedeelde vorm"', () => {
  const u = meet({ envelop: ['id'], vormen: [V('server/kern/a/x.js', ['lat', 'lng', 'q'])] });
  assert.match(u.conclusie, /NIET VAST TE STELLEN/);
});

test('5. het register loopt niet achter op een verse meting', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'PLAATSVORM.json'), 'utf8'));
  const u = meet();
  assert.deepEqual(reg.rondes, u.rondes, 'PLAATSVORM.json loopt achter -- draai npm run plaatsvorm:vast op een schone boom');
});
