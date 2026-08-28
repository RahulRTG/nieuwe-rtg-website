/* De merkstatus van een lid is geen afgeleide marketingtekst in een scherm.
   Deze toets bewaakt de indeling zelf én houdt de memberclass los van de echte
   identiteitscontrole. Draai: node --test test/lidmaatschap.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lidmaatschap = require('../server/kern/lidmaatschap');

test('RTG Pass en Business Lite zijn Verified-memberships', () => {
  for (const tier of ['rtg', 'business_lite', 'Business Lite', 'business-lite', 'businesslite']) {
    const lid = lidmaatschap.voor({ tier, verified: 'verified' });
    assert.ok(lid, tier + ' hoort als pas bekend te zijn');
    assert.equal(lid.status.id, 'verified', tier + ' hoort Verified te zijn');
    assert.equal(lid.member.id, 'member');
  }
  assert.equal(lidmaatschap.voor({ tier: 'rtg' }).pas.naam, 'RTG Pass');
  assert.equal(lidmaatschap.voor({ tier: 'business_lite' }).pas.naam, 'Business Lite');
});

test('Lifestyle en Business zijn Signature-memberships', () => {
  for (const tier of ['lifestyle', 'business']) {
    const lid = lidmaatschap.voor({ tier, verified: 'verified' });
    assert.equal(lid.status.id, 'signature', tier + ' hoort Signature te zijn');
  }
});

test('memberclass en identiteitscontrole blijven twee verschillende waarheden', () => {
  const wacht = lidmaatschap.voor({ tier: 'rtg', verified: 'unverified' });
  assert.equal(wacht.status.id, 'verified', 'de memberclass verandert niet tijdens onboarding');
  assert.equal(wacht.identiteit.id, 'pending', 'de app mag niet doen alsof KYC al rond is');

  const rond = lidmaatschap.voor({ tier: 'business', verified: 'verified' });
  assert.equal(rond.status.id, 'signature');
  assert.equal(rond.identiteit.id, 'verified');

  assert.equal(lidmaatschap.voor({ tier: 'guest' }), null, 'een gast is geen Member');
});

test('de vijf lenzen volgen de memberclass', () => {
  const verified = lidmaatschap.lenzenVoor('rtg');
  assert.deepEqual(verified.filter(l => l.open).map(l => l.id), ['friends', 'travel', 'events']);
  assert.deepEqual(verified.filter(l => !l.open).map(l => l.id), ['dating', 'business']);
  assert.ok(verified.filter(l => !l.open).every(l => /Signature/.test(l.reden)));

  const signature = lidmaatschap.lenzenVoor('lifestyle');
  assert.equal(signature.length, 5);
  assert.ok(signature.every(l => l.open), 'Signature krijgt alle vijf de lenzen');
});
