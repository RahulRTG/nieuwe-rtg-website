'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const signaal = require('../server/kern/intreksignaal');

test('gerichte PG-intrekking sluit token en sid, niet andere credentials', async () => {
  signaal._wis();
  try {
    const token = 'ingetrokken-token', sid = 'abcdefghijkl';
    const hash = signaal.vingerVanToken(token);
    let gevraagd;
    signaal.koppelOutbox({ lijst: () => [], voltooi() {}, gedeeld: async sleutels => {
      gevraagd = sleutels;
      return [
        { soort: 'token', waarde: hash, verloopt: Date.now() + 60000 },
        { soort: 'sessie', waarde: sid, verloopt: Date.now() + 60000 }
      ];
    } });
    await signaal.controleerGedeeld(token, sid);
    assert.deepEqual(gevraagd, ['token:' + hash, 'sessie:' + sid]);
    assert.equal(signaal.tokenIngetrokken(token), true);
    assert.equal(signaal.sessieIngetrokken(sid), true);
    assert.equal(signaal.tokenIngetrokken('andere-geldige-sessie'), false);
  } finally { signaal._wis(); }
});

test('ontbrekende of falende PG-intrekkingsbron is geen geslaagde controle', async () => {
  signaal._wis();
  try {
    await assert.rejects(signaal.controleerGedeeld('token'), { code: 'INTREKOPSLAG_ONZEKER' });
    signaal.koppelOutbox({ lijst: () => [], voltooi() {}, gedeeld: async () => { throw new Error('database weg'); } });
    await assert.rejects(signaal.controleerGedeeld('token'), /database weg/);
  } finally { signaal._wis(); }
});

test('gerichte opslaglezing is geparametriseerd en verwijdert geen outboxregels', async () => {
  const queries = [];
  const opslag = require('../server/pgaccounts-intrekking')({ query: async (sql, waarden) => {
    queries.push({ sql, waarden });
    return { rows: [{ soort: 'token', waarde: 'vinger', verloopt: '42' }] };
  } });
  const rows = await opslag.lijst(20, ['token:vinger']);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /sleutel IN \(\$1\) AND verloopt >= \$2/);
  assert.deepEqual(queries[0].waarden, ['token:vinger', 20]);
  assert.equal(rows[0].verloopt, 42);
});
