/* EEN 503 MET EEN CONFIGZIN IS EEN CONFIGBLOKKADE, GEEN KALE FOUT -- op EEN plek.

   Dezelfde 503 kreeg in twee instrumenten twee oordelen: scripts/appwerkt.js las
   een 503 met een configzin of een veld "hoe" als GEBLOKKEERD_DOOR_CONFIG,
   scripts/voltooiproef.js telde elke status vanaf 500 als kaal, en dus kwam
   Navigatie ("Het Nederlandse wegennet is nog niet ingeladen", hoe: npm run
   navigatie:nederland) op menselijk = GEBLOKKEERD_DOOR_DEFECT. De regel woont
   nu in scripts/lib/configweigering.js, en beide lezen hem.

   Geen versoepeling, en dat staat hier in beide richtingen vast: een 503
   ZONDER configzin of "hoe" blijft kaal, en een configzin op een 500 telt niet.

   Los: node --test test/configweigering.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/lib/configweigering');
const { menselijkUit } = require('../scripts/voltooiproef');
const B = require('../scripts/lib/bewijsbron');

const NAV = { error: 'Het Nederlandse wegennet is nog niet ingeladen.', hoe: 'npm run navigatie:nederland' };

test('de regel: alleen een 503, en alleen met een configzin of een "hoe"', () => {
  assert.equal(C.isConfigWeigering(503, NAV), true);
  assert.equal(C.isConfigWeigering(503, { error: 'Dienst even weg.', hoe: 'npm run x' }), true, 'hoe alleen is genoeg');
  assert.equal(C.isConfigWeigering(503, { error: 'De kaartdienst is niet gemount.' }), true, 'een configzin alleen ook');
  assert.equal(C.isConfigWeigering(503, JSON.stringify(NAV)), true, 'ook als tekst');
  assert.equal(C.isConfigWeigering(503, { error: 'Er ging iets mis.' }), false, 'een 503 zonder configzin of hoe blijft kaal');
  assert.equal(C.isConfigWeigering(503, { error: 'x', hoe: '' }), false, 'een lege hoe zegt niets');
  assert.equal(C.isConfigWeigering(500, NAV), false, 'een configzin op een 500 telt niet');
  assert.equal(C.isConfigWeigering(502, NAV), false);
  assert.equal(C.isConfigWeigering(503, null), false);
});

const weigering = { pad: '/api/x', status: 409, lijf: true, melding: 'Dat kan nu niet, de reis is al geboekt.' };
test('de voltooiproef: een configweigering maakt menselijk een configblokkade, geen defect', () => {
  const config = { pad: '/api/navigatie/route', status: 503, lijf: true, melding: null, config: true };
  const u = menselijkUit([weigering, config], false);
  assert.equal(u.schakels.find((s) => s.nr === 1).stand, 'gesloten', 'een eerlijke configweigering is geen kale 5xx');
  assert.match(String(u.configBlokkade || ''), /navigatie\/route/);
  const st = B.ketenUitslag('V.json', { lees: () => JSON.stringify({ stempel: { op: 'nu', commit: 'abc' }, d: u }),
    versheid: () => ({ vers: true, reden: 'nu' }), deel: ['d'] });
  assert.equal(st.status, 'GEBLOKKEERD_DOOR_CONFIG', st.reden);
});

test('de voltooiproef: een 503 zonder configzin blijft kaal, en een echte kale fout wint van een configblokkade', () => {
  const kaal503 = { pad: '/api/y', status: 503, lijf: true, melding: null, config: false };
  const u = menselijkUit([weigering, kaal503], false);
  assert.equal(u.schakels.find((s) => s.nr === 1).stand, 'open');
  assert.equal(u.configBlokkade, undefined);
  const beide = menselijkUit([weigering, kaal503, { pad: '/api/navigatie/route', status: 503, lijf: true, melding: null, config: true }], false);
  const st = B.ketenUitslag('V.json', { lees: () => JSON.stringify({ stempel: { op: 'nu', commit: 'abc' }, d: beide }),
    versheid: () => ({ vers: true, reden: 'nu' }), deel: ['d'] });
  assert.equal(st.status, 'GEBLOKKEERD_DOOR_DEFECT', 'een defect naast een configblokkade blijft een defect');
});
