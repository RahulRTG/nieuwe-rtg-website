/* De postbuswereld: vier dingen over twee domeinen die dezelfde postbus zijn.

   De kern van deze toets is dezelfde valkuil als bij het livinglab: `id`
   betekent per deelgebied iets anders. Ik ben er hier zelf in gelopen -- een
   generieke `id` in de bak liet de meting ZAKKEN van 1938 naar 1936, want elke
   rtmail-route kreeg het team-id, ook de routes die een bericht bedoelen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { KANTEN, lijfVoor, idSoortVoor } = require('../scripts/lib/wereld-rtmail');

test('elke kant draagt een voorvoegsel, een rol en een reden', () => {
  for (const k of KANTEN) {
    assert.ok(k.pre.startsWith('/api/'), k.pre);
    assert.ok(k.rol, k.naam);
    assert.equal(typeof k.team, 'boolean', 'of deze kant teams kent hoort vast te staan');
    assert.ok((k.waarom || '').length >= 25, 'de reden bij ' + k.naam);
  }
});

test('de twee voorvoegsels overlappen niet', () => {
  const [a, b] = KANTEN;
  assert.ok(!a.pre.startsWith(b.pre) && !b.pre.startsWith(a.pre));
});

test('elk deelgebied wijst naar zijn eigen soort ding', () => {
  const pre = '/api/member/rtmail';
  assert.equal(idSoortVoor(pre + '/team/koppel', pre), 'team');
  assert.equal(idSoortVoor(pre + '/concept/bewaar', pre), 'concept');
  assert.equal(idSoortVoor(pre + '/regel/weg', pre), 'regel');
  assert.equal(idSoortVoor(pre + '/antwoord', pre), 'bericht');
  assert.equal(idSoortVoor(pre + '/lees', pre), 'bericht');
});

test('het meegegeven id hoort bij het deelgebied', () => {
  const w = { lid: { team: 'T', concept: 'C', regel: 'R', bericht: 'B' } };
  assert.equal(lijfVoor(w, '/api/member/rtmail/team/koppel').id, 'T');
  assert.equal(lijfVoor(w, '/api/member/rtmail/concept/weg').id, 'C');
  assert.equal(lijfVoor(w, '/api/member/rtmail/regel/zet').id, 'R');
  assert.equal(lijfVoor(w, '/api/member/rtmail/antwoord').id, 'B');
});

/* Een ding dat de wereld niet heeft, wordt niet verzonnen: dan komt er geen
   `id` mee en is 404 het eerlijke antwoord. */
test('zonder het ding komt er geen id', () => {
  const w = { lid: { bericht: 'B' } };
  assert.equal(lijfVoor(w, '/api/member/rtmail/team/koppel').id, undefined);
  assert.equal(lijfVoor(w, '/api/member/rtmail/antwoord').id, 'B');
});

test('de twee kanten houden hun eigen dingen', () => {
  const w = { lid: { bericht: 'L' }, zaak: { bericht: 'Z' } };
  assert.equal(lijfVoor(w, '/api/member/rtmail/lees').id, 'L');
  assert.equal(lijfVoor(w, '/api/supplier/rtmail/lees').id, 'Z');
  assert.deepEqual(lijfVoor(w, '/api/mall/bestel'), {});
});
