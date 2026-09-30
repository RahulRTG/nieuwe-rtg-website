/* ============================================================================
   DE NOEMERWAARHEID -- scripts/routenoemer.js deelt het verschil tussen een
   register en de router in als LEEFTIJD, DEFINITIE of ONVERKLAARD, en telt die
   drie nooit op.

   De echte meting (worktrees per meetcommit, ~30 s) draait met
   `npm run routenoemer`; hier staat de indeling zelf, op verzonnen routers.

   Draai los: node --test test/routenoemer.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deelIn, alleenToetsstand } = require('../scripts/routenoemer');

const S = (...a) => new Set(a);
const commit = S('POST /api/a', 'POST /api/b', 'GET /pagina');
const head = S('POST /api/a', 'POST /api/b', 'POST /api/c', 'GET /pagina');

test('1. een filterregister dat op zijn commit klopt, is gereproduceerd; de rest is leeftijd', () => {
  const u = deelIn({ register: 'X', telling: 2, sleutels: null, opCommit: commit, opHead: head, definitie: 'api' });
  assert.equal(u.gereproduceerd, true);
  assert.equal(u.leeftijd.nieuwSindsMeting, 1, 'POST /api/c kwam er na de meting bij');
  assert.equal(u.definitieVerschil, 1, 'GET /pagina telt deze definitie met opzet niet');
  assert.deepEqual(u.onverklaard, []);
});

test('2. een getal dat op zijn eigen commit NIET klopt, is onverklaard -- geen leeftijd', () => {
  const u = deelIn({ register: 'X', telling: 3, sleutels: null, opCommit: commit, opHead: head, definitie: 'api' });
  assert.equal(u.gereproduceerd, false);
  assert.equal(u.onverklaard.length, 1);
});

test('3. een route in het register die de router op die commit niet kende, is onverklaard', () => {
  const u = deelIn({ register: 'X', telling: 3, sleutels: ['POST /api/a', 'POST /api/b', 'POST /api/spook'],
    opCommit: commit, opHead: head, definitie: 'api' });
  assert.deepEqual(u.onverklaard, ['POST /api/spook']);
});

test('4. aangeroepen: elke ontbrekende route heeft een uitsluiting die de idemproef kent, of is onverklaard', () => {
  const opC = S('POST /api/a', 'POST /api/x/:id', 'GET /api/lees', 'POST /api/zonderreden');
  const u = deelIn({ register: 'I', telling: 1, sleutels: ['POST /api/a'], opCommit: opC, opHead: opC,
    definitie: 'aangeroepen', isSchakel: () => false });
  assert.equal(u.buitenDefinitie['pad met parameter'], 1);
  assert.equal(u.buitenDefinitie['geen POST'], 1);
  assert.deepEqual(u.onverklaard, ['POST /api/zonderreden'], 'geen reden wordt niet verzonnen');
});

test('5. routes die alleen onder NODE_ENV=test bestaan zijn definitie, niet onverklaard', () => {
  assert.equal(alleenToetsstand('POST /api/test/bug'), true);
  assert.equal(alleenToetsstand('POST /api/testament'), false);
  const u = deelIn({ register: 'O', telling: 3, sleutels: ['POST /api/a', 'POST /api/b', 'POST /api/test/bug'],
    opCommit: commit, opHead: head, definitie: 'waargenomen' });
  assert.equal(u.buitenDefinitie['alleen onder NODE_ENV=test'], 1);
  assert.equal(u.buitenDefinitie['niet waargenomen in de toetsronde'], 1);
  assert.deepEqual(u.onverklaard, []);
});

test('6. zonder router op de meetcommit is het niet vast te stellen, en dat is geen nul', () => {
  const u = deelIn({ register: 'X', telling: 2, opCommit: null, opHead: head, definitie: 'api' });
  assert.equal(u.vastTeStellen, false);
  assert.equal(u.onverklaard, undefined);
});
