/* TWEE WERKWOORDEN VOOR EEN NIEUWE CODE (kern/bearercode-keten.js).

   roteer   zelfde termijn: de houder krijgt een verse code, het einde komt
            nooit later, het gebruik telt door;
   vernieuw een mens geeft een nieuwe termijn uit, met een verse teller.
   Beide trekken de oude in en dragen volgnummer en geschiedenis door. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const T0 = Date.parse('2026-10-01T12:00:00.000Z');
const DAG = 86400000;
function fabriek() {
  let klok = T0;
  const b = require('../server/kern/bearercode')({ crypto, namespace: 'proef', nu: () => new Date(klok).toISOString() });
  return { b, verder: (ms) => { klok += ms; } };
}
const spec = (extra) => Object.assign({ prefix: 'PR', issuer: 'proef', doel: 'proef.deur', scope: ['deur'],
  onderwerp: { deur: 'D1' }, geldigheid: { duurMs: 10 * DAG }, gebruik: { max: 5 }, afgeleid: 'geen' }, extra || {});
const open = (b, code, t) => b.reden(t, { doel: 'proef.deur', scope: ['deur'] });

test('vernieuw: een nieuwe termijn, een verse teller, en de oude is dicht', () => {
  const { b, verder } = fabriek();
  const oud = b.maak(spec());
  b.gebruik(oud.toegang); b.gebruik(oud.toegang);
  verder(8 * DAG);
  const nieuw = b.vernieuw(oud.toegang, spec({ geldigheid: { duurMs: 30 * DAG } }), 'mw-a');
  assert.ok(Date.parse(nieuw.toegang.expires_at) > Date.parse(oud.toegang.expires_at), 'de termijn werd niet nieuw');
  assert.equal(nieuw.toegang.gebruik, 0, 'de teller liep door');
  assert.equal(nieuw.toegang.rotatie, 2);
  assert.equal(nieuw.toegang.geschiedenis.at(-1).soort, 'vernieuwd');
  assert.equal(nieuw.toegang.geschiedenis.at(-1).door, 'mw-a');
  assert.equal(nieuw.toegang.geschiedenis.at(-1).einde_was, oud.toegang.expires_at);
  assert.equal(open(b, null, oud.toegang), 'ingetrokken');
  assert.equal(open(b, null, nieuw.toegang), null);
  assert.equal(oud.toegang.intrekreden, 'vernieuwd');
});

test('vernieuw: zonder mens, zonder termijn of met een ander doel of uitgever: nee', () => {
  const { b } = fabriek();
  const oud = b.maak(spec());
  assert.throws(() => b.vernieuw(oud.toegang, spec(), ''), { code: 'actor-ontbreekt' });
  assert.throws(() => b.vernieuw(oud.toegang, spec({ geldigheid: undefined }), 'mw-a'), { code: 'geldigheid-ontbreekt' });
  assert.throws(() => b.vernieuw(oud.toegang, spec({ doel: 'proef.andere-deur' }), 'mw-a'), { code: 'ander-doel' });
  assert.throws(() => b.vernieuw(oud.toegang, spec({ issuer: 'iemand-anders' }), 'mw-a'), { code: 'ander-issuer' });
  assert.equal(oud.toegang.ingetrokken_at, null, 'een geweigerde vernieuwing trok de oude toch in');
});

test('roteer: zelfde einde, teller loopt door, soort geroteerd', () => {
  const { b, verder } = fabriek();
  const oud = b.maak(spec());
  b.gebruik(oud.toegang);
  verder(DAG);
  const nieuw = b.roteer(oud.toegang, { actor: 'mw-a', prefix: 'PR' });
  assert.equal(nieuw.toegang.expires_at, oud.toegang.expires_at);
  assert.equal(nieuw.toegang.gebruik, 1);
  assert.equal(nieuw.toegang.geschiedenis.at(-1).soort, 'geroteerd');
  assert.equal(open(b, null, oud.toegang), 'ingetrokken');
});

test('de keten houdt hooguit twintig regels geschiedenis', () => {
  const { b } = fabriek();
  let t = b.maak(spec()).toegang;
  for (let i = 0; i < 25; i++) t = b.vernieuw(t, spec(), 'mw-a').toegang;
  assert.equal(t.rotatie, 26);
  assert.equal(t.geschiedenis.length, 20);
});
