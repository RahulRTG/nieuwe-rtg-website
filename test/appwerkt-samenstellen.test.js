'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { eindstand, vernieuw } = require('../scripts/appwerkt-samenstellen');

const bewijs = (status) => ({ status, reden: status });

test('samenstellen bewaart browserbewijs en vernieuwt alleen externe helften', () => {
  const browser = bewijs('BEWEZEN');
  const reg = { regels: [{ app: 'A', functie: 'link:a', ingang: '/apps/a.html',
    bewijzen: { bereikbaar: browser, bedienbaar: bewijs('BEWEZEN'), menselijk: bewijs('BEWEZEN'),
      voltooibaar: bewijs('NIET_GETEST'), waarheidsgetrouw: bewijs('NIET_GETEST'),
      persistent: bewijs('NIET_GETEST'), bevoegd: bewijs('NIET_GETEST'), herstelbaar: bewijs('NIET_GETEST') } }] };
  vernieuw(reg, { stelSamen(r) {
    for (const naam of ['voltooibaar', 'waarheidsgetrouw', 'persistent', 'bevoegd', 'herstelbaar']) r.bewijzen[naam] = bewijs('BEWEZEN');
    return ['voltooibaar', 'waarheidsgetrouw', 'persistent', 'bevoegd', 'herstelbaar'];
  } });
  assert.equal(reg.regels[0].bewijzen.bereikbaar, browser, 'de browserwaarneming wordt niet vervangen');
  assert.equal(reg.regels[0].status, 'BEWEZEN');
  assert.deepEqual(reg.telling, { BEWEZEN: 1 });
  assert.deepEqual(reg.perBewijs.waarheidsgetrouw, { BEWEZEN: 1 });
});

test('een ontbrekende of geblokkeerde helft blijft fail-closed', () => {
  assert.equal(eindstand({ bewijzen: { a: bewijs('BEWEZEN') } }), 'NIET_GETEST');
  assert.equal(eindstand({ bewijzen: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i, bewijs(i === 4 ? 'NIET_GETEST' : 'BEWEZEN')])) }), 'NIET_GETEST');
  assert.equal(eindstand({ bewijzen: { a: bewijs('GEBLOKKEERD_DOOR_DEFECT') } }), 'GEBLOKKEERD_DOOR_DEFECT');
});
