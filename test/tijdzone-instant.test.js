/* instantIn (server/kern/tijdzone.js): een lokale dag en een uur in een
   IANA-zone als tijdstip. "Om 10:00" bij een zaak is 10:00 op de klok van die
   zaak, ook in de zomertijd. Draai los: node --test test/tijdzone-instant.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { instantIn } = require('../server/kern/tijdzone');

test('zomer- en wintertijd in Europa, en een zone ver weg', () => {
  assert.equal(instantIn('Europe/Amsterdam', '2026-07-15', '10:00'), Date.parse('2026-07-15T08:00:00Z'), 'zomertijd: UTC+2');
  assert.equal(instantIn('Europe/Amsterdam', '2026-01-15', '10:00'), Date.parse('2026-01-15T09:00:00Z'), 'wintertijd: UTC+1');
  assert.equal(instantIn('Europe/Madrid', '2026-07-15', '13:00'), Date.parse('2026-07-15T11:00:00Z'), 'Ibiza heeft dezelfde offset');
  assert.equal(instantIn('Asia/Tokyo', '2026-07-15', '10:00'), Date.parse('2026-07-15T01:00:00Z'));
  assert.equal(instantIn('America/New_York', '2026-07-15', '23:30'), Date.parse('2026-07-16T03:30:00Z'), 'over de datumgrens');
});

test('zonder geldige dag of uur geen tijdstip, en een onbekende zone valt zichtbaar terug op UTC', () => {
  assert.equal(instantIn('Europe/Amsterdam', '2026-07-15', null), null);
  assert.equal(instantIn('Europe/Amsterdam', null, '10:00'), null);
  assert.equal(instantIn('Europe/Amsterdam', '2026-07-15', 'later'), null);
  assert.equal(instantIn('Nergens/Niets', '2026-07-15', '10:00'), Date.parse('2026-07-15T10:00:00Z'));
});
