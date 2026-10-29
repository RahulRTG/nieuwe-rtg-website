'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { menselijkUit } = require('../scripts/voltooiproef');
const antwoord = (status, extra = {}) => ({ pad: '/api/voorbeeld', status, lijf: true, ...extra });
const uitleg = { melding: 'Het wegennet is nog niet ingeladen.', hoe: 'Laad het wegennet via de beheeromgeving.' };

test('een expliciete 503 met reden en herstelrichting bewijst een menselijke melding', () => {
  const input = [antwoord(503, uitleg)];
  const result = menselijkUit(input, false);
  assert.equal(result.sluit, true);
  assert.equal(result.weigeringen, 1);
  assert.equal(input[0].status, 503, 'dit maakt de mislukte handeling niet succesvol');
});

test('503 zonder reden, herstelrichting of leesbaar lijf blijft open', () => {
  for (const extra of [{}, { melding: uitleg.melding }, { hoe: uitleg.hoe },
    { ...uitleg, lijf: false }, { ...uitleg, melding: 'TypeError: kapot' },
    { ...uitleg, hoe: 'Error: broken' }, { ...uitleg, hoe: '  ' }]) {
    assert.equal(menselijkUit([antwoord(503, extra)], false).sluit, false);
  }
});

test('500 en andere 5xx krijgen geen configuratie-uitzondering, ook niet met uitleg', () => {
  for (const status of [500, 502, 504]) {
    const result = menselijkUit([antwoord(status, uitleg)], false);
    assert.equal(result.sluit, false);
    assert.equal(result.schakels[0].stand, 'open');
  }
});

test('netwerkuitval en lege antwoorden blijven zichtbaar zonder voorafgaande 4xx', () => {
  for (const input of [[antwoord(0, { lijf: false })], [antwoord(200, { lijf: false })]]) {
    const result = menselijkUit(input, false);
    assert.equal(result.sluit, false);
    assert.ok(result.telling.open > 0);
    assert.equal(result.nietBeproefd, undefined);
  }
});

test('een kale weigering naast een goede configuratiemelding blijft een fout', () => {
  assert.equal(menselijkUit([antwoord(503, uitleg), antwoord(403)], false).sluit, false);
});

test('niets gemeten, alleen succes en een afgebroken scenario worden nooit bewezen', () => {
  for (const input of [[], [antwoord(200)]]) {
    const result = menselijkUit(input, false);
    assert.equal(result.sluit, false);
    assert.ok(result.nietBeproefd);
  }
  assert.equal(menselijkUit([antwoord(503, uitleg)], true).sluit, false);
});
