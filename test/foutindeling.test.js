/* DE FOUTINDELING VAN APPWERKT -- een weigering met reden is geen defect.

   scripts/lib/foutindeling.js deelt een foutantwoord in: deur, omgeving,
   weigering of stuk. De aanleiding: Mijn loopbaan gaf 400 "Schrijf op wat er
   gebeurde." op een leeg veld, en dat telde als defect. Elke regel hieronder
   kan zakken, en de tegenproeven houden de bak smal: een weigering zonder zin,
   een code in plaats van een zin, of een 500 met een nette zin blijft stuk. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deelFoutIn, isZin } = require('../scripts/lib/foutindeling');

const lijf = (o) => JSON.stringify(o);

test('een deur is een deur', () => {
  for (const s of [401, 403, 404]) assert.equal(deelFoutIn(s, lijf({ error: 'Niet ingelogd als lid.' })), 'deur');
});

test('een 503 die zichzelf uitlegt is de omgeving', () => {
  assert.equal(deelFoutIn(503, lijf({ error: 'x', hoe: 'zet RTG_X' })), 'config');
  assert.equal(deelFoutIn(503, 'de module is nog niet ingeladen'), 'config');
  assert.equal(deelFoutIn(503, lijf({ error: 'kapot' })), 'serverfout');
});

test('400, 409 en 422 met een zin zijn een weigering', () => {
  assert.equal(deelFoutIn(400, lijf({ error: 'Schrijf op wat er gebeurde.' })), 'weigering');
  assert.equal(deelFoutIn(409, lijf({ error: 'Dit staat er al, met dezelfde datum.' })), 'weigering');
  assert.equal(deelFoutIn(422, lijf({ error: 'Kies eerst een kapitaal.' })), 'weigering');
});

test('tegenproeven: zonder zin, met een code, of een 500 blijft stuk', () => {
  assert.equal(deelFoutIn(400, ''), 'serverfout', 'een kale 400 zegt niets');
  assert.equal(deelFoutIn(400, lijf({ error: 'BAD_REQUEST' })), 'serverfout', 'een code is geen reden');
  assert.equal(deelFoutIn(400, lijf({ error: 'invalid' })), 'serverfout');
  assert.equal(deelFoutIn(400, lijf({ fout: 'Schrijf op wat er gebeurde.' })), 'serverfout', 'alleen `error` telt');
  assert.equal(deelFoutIn(400, 'Schrijf op wat er gebeurde.'), 'serverfout', 'geen JSON, geen weigering');
  assert.equal(deelFoutIn(500, lijf({ error: 'Er ging iets mis bij het opslaan.' })), 'serverfout',
    'een 500 met een nette zin is nog steeds omgevallen');
  assert.equal(deelFoutIn(429, lijf({ error: 'Te veel verzoeken, wacht even.' })), 'serverfout');
});

test('een zin is minstens acht tekens en twee woorden', () => {
  assert.equal(isZin('Kies een dag.'), true);
  assert.equal(isZin('ongeldig'), false);
  assert.equal(isZin('a b'), false);
  assert.equal(isZin(null), false);
});
