'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/site/start/experience-core');
const parse = require('../public/shared/experience-handoff');

test('a changed departure resolves the visible conflict and invalidates earlier confirmation', () => {
  const s = C.state();
  assert.equal(C.proposal(s).conflict, true);
  s.confirmed = true;
  assert.equal(C.option(s, 'late'), true);
  assert.equal(C.proposal(s).conflict, false);
  assert.equal(s.confirmed, false);
  assert.match(C.proposal(s).rows[1].text, /Avondvertrek/);
  assert.equal(C.option(s, 'book-and-pay'), false);
  assert.equal(s.option, 'late');
});

test('withheld data produces open questions, never a claim it was checked', () => {
  const s = C.state();
  for (const id of Object.keys(C.SCENARIOS)) {
    C.choose(s, id);
    for (const permission of ['calendar', 'work', 'location']) C.permission(s, permission, false);
    const p = C.proposal(s);
    assert.match(p.rows.map(r => r.text).join(' '), /niet gedeeld|Geen .*gedeeld/);
    assert.match(p.result, /open vraag/);
    assert.equal(s.confirmed, false);
  }
  assert.equal(C.permission(s, '__proto__', true), false);
  C.permission(s, 'calendar', 'true');
  assert.equal(s.permissions.calendar, false);
});

test('only explicit choices reorder worlds; resetting creates a clean session', () => {
  const s = C.state();
  assert.equal(C.handoff(s), '');
  assert.equal(C.choose(s, '__proto__'), false);
  assert.equal(C.choose(s, 'work'), true);
  C.interest(s, 'foundation'); C.interest(s, 'constructor');
  assert.deepEqual(C.ordered(s), ['work', 'foundation', 'living', 'travel']);
  assert.equal(C.handoff(s), 'work,foundation');
  assert.deepEqual(C.state().interests, {});
  assert.equal(C.recognise('Ik heb een strandtent met 40 medewerkers'), 'work');
  assert.equal(C.recognise('Ik wil met mijn gezin naar Parijs'), 'travel');
  assert.equal(C.recognise('onbekende wens'), null);
  assert.equal(C.recognise('x'.repeat(240) + ' reis'), null);
});

test('the welcome handoff accepts only bounded world IDs, never free text or prototype keys', () => {
  assert.deepEqual(parse('travel,work'), ['TravelOS', 'WorkOS']);
  assert.deepEqual(parse('foundation,foundation'), ['FoundationOS']);
  for (const value of ['', null, 'travel,', 'travel,admin', '__proto__', 'constructor', '<script>alert(1)</script>', 'work,'.repeat(40)]) {
    assert.deepEqual(parse(value), [], String(value));
  }
});
