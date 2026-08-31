/* Een veldnaam, meer betekenissen. De vorm die vier keer terugkwam, en de
   grens eromheen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { idVoor, ongedekteSoorten } = require('../scripts/lib/idperdeel');

const TABEL = { '/api/x/team': 'team', '/api/x/concept': 'concept', '/api/x': 'bericht' };
const BAK = { team: 'T', concept: 'C', bericht: 'B' };

test('elk deelgebied krijgt zijn eigen ding', () => {
  assert.deepEqual(idVoor(TABEL, BAK, '/api/x/team/koppel'), { id: 'T' });
  assert.deepEqual(idVoor(TABEL, BAK, '/api/x/concept/weg'), { id: 'C' });
  assert.deepEqual(idVoor(TABEL, BAK, '/api/x/antwoord'), { id: 'B' });
});

/* Het langste deelgebied wint -- anders valt /api/x/team onder /api/x en
   krijgt het team-pad een bericht-id. Dat is precies de fout die deze module
   bestaat om te voorkomen. */
test('het langste deelgebied wint', () => {
  const t = { '/api/x': 'bericht', '/api/x/team': 'team' };
  assert.deepEqual(idVoor(t, BAK, '/api/x/team/koppel'), { id: 'T' });
});

test('een pad buiten de tabel krijgt niets', () => {
  assert.deepEqual(idVoor(TABEL, BAK, '/api/anders/iets'), {});
});

/* Een ding dat de wereld niet heeft, wordt niet verzonnen. */
test('zonder het ding komt er geen id', () => {
  assert.deepEqual(idVoor(TABEL, { bericht: 'B' }, '/api/x/team/koppel'), {});
});

test('de veldnaam is te kiezen -- bij het gezin heet hij token', () => {
  assert.deepEqual(idVoor({ '/api/y': 'kind' }, { kind: 'K' }, '/api/y/les', 'token'), { token: 'K' });
});

/* Een tabel die naar een ding wijst dat nergens ontstaat, is een stille
   404-fabriek. */
test('een tabel wijst alleen naar dingen die de wereld kan maken', () => {
  assert.deepEqual(ongedekteSoorten(TABEL, ['team', 'concept', 'bericht']), []);
  assert.deepEqual(ongedekteSoorten(TABEL, ['team']), ['concept', 'bericht']);
});
