'use strict';
/* De scenariofixture mag C niet al liken om B te identificeren. Test beide
   daglot-volgordes en ontbrekende/ambigue deelnemers vóór de eerste mutatie. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const bestand = path.resolve(__dirname, '../scripts/lib/voltooi/vonk.js');
const echtRequire = createRequire(bestand);
function scenario() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(bestand, 'utf8'), { module, Date, require(id) {
    if (id !== '../voltooiwereld') return echtRequire(id);
    return { nieuwLid: async (_w, merk) => ({ email: merk, token: merk }),
      inloggen: async (_w, lid) => lid.token, eigenaarSessie: async () => 'office', KANTOORWERELD: {} };
  } }, { filename: bestand });
  return module.exports;
}
const persoon = (codenaam, stad) => ({ codenaam, stad, gemeen: ['sushi'] });
const A = persoon('gids-a', 'Sant Antoni');
const B = persoon('gids-b', 'Cala Jondal');
const C = persoon('gids-c', 'Santa Eulalia');
async function matching(selectie) {
  const likes = [];
  const stop = new Error('matching gecontroleerd');
  const w = { async post(route, body, token) {
    if (route === '/api/office/verifications') return { data: { pending: ['vka', 'vkb', 'vkc'].map(email => ({ email, id: email })) } };
    if (route === '/api/vonk/selectie') return { data: { mensen: token === 'vka' ? selectie : [C, A] } };
    if (route === '/api/vonk/like') {
      likes.push([token, body.codenaam]);
      return { status: 200, data: token === 'vka' ? { match: false } : { match: true, id: 'match-ab', tafel: { supplierName: 'Testzaak' } } };
    }
    if (route === '/api/vonk/mijn') return { data: { matches: [{ status: 'wacht-op-betaling' }] } };
    return { status: 200, data: {} };
  } };
  try {
    await scenario().loop(w, async (_as, omschrijving, doe) => {
      if (!omschrijving.startsWith('een kant interesse')) return;
      const resultaat = await doe();
      assert.equal(resultaat.klopt, true, resultaat.ziet);
      throw stop;
    });
  } catch (error) {
    if (error !== stop) return { likes, error };
    return { likes };
  }
  throw new Error('matchingstap niet uitgevoerd');
}
for (const [naam, selectie] of [['C eerst', [C, B]], ['B eerst', [B, C]]]) {
  test('Vonk-fixture: ' + naam + ' geeft uitsluitend wederzijdse likes A/B', async () => {
    const r = await matching(selectie);
    assert.ifError(r.error);
    assert.deepEqual(r.likes, [['vka', 'gids-b'], ['vkb', 'gids-a']]);
  });
}
for (const [naam, selectie] of [['B ontbreekt', [C]], ['B ambigu', [B, B, C]], ['C ontbreekt', [B]]]) {
  test('Vonk-fixture: ' + naam + ' stopt vóór mutaties', async () => {
    const r = await matching(selectie);
    assert.match(r.error && r.error.message, /Vonk-fixture: verwacht precies één/);
    assert.deepEqual(r.likes, []);
  });
}
