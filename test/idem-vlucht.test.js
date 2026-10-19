/* De vluchten van de idem-poort (server/lib/idem-vlucht.js): een tweede
   verzoek met dezelfde sleutel ziet de lopende vlucht, wacht op precies de
   uitkomst van de eerste, en een afronder werkt maar een keer. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakVluchten } = require('../server/lib/idem-vlucht');

test('1. een geopende vlucht is zichtbaar met zijn afdruk, en verdwijnt bij het afronden', async () => {
  const v = maakVluchten();
  assert.equal(v.bezig('a'), undefined);
  const rond = v.open('a', 'afdruk-1');
  const bezig = v.bezig('a');
  assert.equal(bezig.afdruk, 'afdruk-1');
  assert.equal(v.omvang(), 1);
  rond({ status: 201, lijf: { ok: true } });
  assert.equal(v.bezig('a'), undefined);
  assert.equal(v.omvang(), 0);
  assert.deepEqual(await bezig.belofte, { status: 201, lijf: { ok: true } });
});

test('2. de afronder werkt een keer: een latere close overschrijft de uitkomst niet', async () => {
  const v = maakVluchten();
  const rond = v.open('b', null);
  const belofte = v.bezig('b').belofte;
  rond({ status: 200, lijf: 'eerste' });
  rond(null);
  assert.deepEqual(await belofte, { status: 200, lijf: 'eerste' });
  /* en een nieuwe vlucht onder dezelfde sleutel is weer een eigen vlucht */
  const rond2 = v.open('b', 'tweede');
  assert.notEqual(v.bezig('b').belofte, belofte);
  /* Een late afronder van de EERSTE vlucht (een close die na het antwoord komt)
     mag de tweede niet uit de lijst halen: dan liep een gelijktijdige dubbeltik
     weer naast het werk in plaats van erop te wachten. */
  rond(null);
  assert.equal(v.bezig('b') && v.bezig('b').afdruk, 'tweede');
  rond2(null);
  assert.equal(v.bezig('b'), undefined);
});

test('3. vluchten onder verschillende sleutels lopen los van elkaar', async () => {
  const v = maakVluchten();
  const rondA = v.open('a', 'x');
  v.open('c', 'y');
  rondA(null);
  assert.equal(v.bezig('a'), undefined);
  assert.equal(v.bezig('c').afdruk, 'y');
  assert.equal(v.omvang(), 1);
});
