/* RTG Zegel offline controleren (public/shared/zegelcheck.js): dezelfde WebCrypto-
   verificatie die de leverancier-app op het toestel draait. We maken een echt
   Zegel met de uitgevende kant (server/lib/zegel.js), en toetsen dat de losse
   controle geldig zegt, een gemanipuleerd token afwijst, en een verlopen token
   herkent -- allemaal met alleen de publieke sleutel, zonder server.
   Draai los: node --experimental-sqlite --test test/zegelcheck.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { maakZegel } = require('../server/lib/zegel');
const Check = require('../public/shared/zegelcheck');

function versZegel() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zg-'));
  return maakZegel({ dataDir: dir });
}

test('1. echt Zegel: offline geldig met de juiste claims', async () => {
  const z = versZegel();
  const token = z.zegel({ codenaam: 'CODE', partner: null, claims: { leeftijd18: true, lid: true, pas: 'business' }, geldigMin: 5 });
  const r = await Check.verifieer(token, z.publiekeSleutel());
  assert.equal(r.geldig, true, 'geldig');
  assert.equal(r.claims.leeftijd18, true);
  assert.equal(r.claims.lid, true);
  assert.equal(r.claims.pas, 'business');
  assert.ok(r.sub && r.sub.indexOf('pw_') === 0, 'onderwerp is een pseudoniem');
});

test('2. gemanipuleerd token wordt afgewezen (handtekening klopt niet)', async () => {
  const z = versZegel();
  const token = z.zegel({ codenaam: 'CODE', partner: null, claims: { leeftijd18: true }, geldigMin: 5 });
  const punt = token.indexOf('.');
  // knoei met een teken in de payload
  const p = token.slice(0, punt), s = token.slice(punt + 1);
  const kapot = (p.slice(0, -1) + (p.slice(-1) === 'A' ? 'B' : 'A')) + '.' + s;
  const r = await Check.verifieer(kapot, z.publiekeSleutel());
  assert.equal(r.geldig, false);
});

test('3. verlopen token: geldig nu, maar niet meer in de toekomst', async () => {
  const z = versZegel();
  const token = z.zegel({ codenaam: 'CODE', partner: null, claims: { leeftijd21: true }, geldigMin: 5 });
  assert.equal((await Check.verifieer(token, z.publiekeSleutel())).geldig, true, 'nu geldig');
  const later = Math.floor(Date.now() / 1000) + 3600;
  const r = await Check.verifieer(token, z.publiekeSleutel(), later);
  assert.equal(r.geldig, false);
  assert.equal(r.reden, 'verlopen');
});

test('4. verkeerde publieke sleutel wijst af', async () => {
  const z1 = versZegel(), z2 = versZegel();
  const token = z1.zegel({ codenaam: 'CODE', partner: null, claims: { lid: true }, geldigMin: 5 });
  assert.equal((await Check.verifieer(token, z2.publiekeSleutel())).geldig, false);
});
