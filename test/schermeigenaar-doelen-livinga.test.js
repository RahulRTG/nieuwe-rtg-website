/* SCHERMEIGENAAR: de doelen van drie LivingOS-A-schermen beloven niet meer dan
   de code doet (domeinkaart LivingOS-A, 19 oktober 2026).

   - thuis.html beschreef "woning-gerelateerde diensten en producten bestellen";
     de code is logeren bij leden (kern/thuis).
   - leven.html beschreef een avond samenstellen die Rahul combineert; die
     componist verhuisde naar avond.html, en leven.html is een projectie die
     alleen leest (routes/leven.js heeft geen schrijfroute).
   - onderhoud.html beloofde de status "tot een vakman is gepland en het is
     opgelost"; geen route zet 'gepland' of 'opgelost' (kern/woningonderhoud.js).
     Bouwt iemand die route (domeinkaart Wonen W3/W4), dan mag het doel weer.

   Draai los: node --test test/schermeigenaar-doelen-livinga.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../SCHERMEIGENAAR.json').schermen;
const lees = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('thuis.html is logeren bij leden', () => {
  assert.match(S['apps/thuis.html'].doel, /logeren|verblijf/i);
  assert.doesNotMatch(S['apps/thuis.html'].doel, /diensten en producten/);
});

test('leven.html is een projectie die leest, geen avondcomponist', () => {
  assert.doesNotMatch(S['apps/leven.html'].doel, /avond|combineren/i);
  assert.ok(!/app\.post\('[^']+',[^)]*\b(zet|maak|bewaar)\b/.test(lees('server/routes/leven.js')), 'routes/leven.js schrijft nog steeds niets');
});

test('onderhoud.html belooft geen opgelost zolang geen route het zet', () => {
  const kern = lees('server/kern/woningonderhoud.js');
  const zetOpgelost = /status\s*=\s*'opgelost'|status:\s*'opgelost'/.test(kern);
  if (!zetOpgelost) assert.doesNotMatch(S['apps/onderhoud.html'].doel, /opgelost|gepland/);
});
