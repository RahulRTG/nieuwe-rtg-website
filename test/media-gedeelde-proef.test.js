'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { proefGedeeldeMedia } = require('../server/media/proef');

function opslag({ vervals = false, weigeren = null } = {}) {
  const data = new Map();
  let instanties = 0;
  return {
    data,
    maakBackend() {
      const nummer = ++instanties;
      return {
        async put(k, v) { if (weigeren === 'put') throw new Error('put dicht'); data.set(k, Buffer.from(v)); },
        async get(k) {
          if (weigeren === 'get') throw new Error('get dicht');
          const v = data.get(k);
          if (!v) throw new Error('niet gevonden');
          return vervals && nummer === 2 ? Buffer.from('andere bytes') : Buffer.from(v);
        },
        async del(k) { if (weigeren === 'del') throw new Error('delete dicht'); data.delete(k); },
        async has(k) { return data.has(k); }
      };
    }
  };
}

const vast = n => Buffer.alloc(n, n === 16 ? 7 : 9);

test('actieve mediaproef schrijft met A, leest met B, vergelijkt en verwijdert', async () => {
  const s = opslag();
  const uit = await proefGedeeldeMedia({}, { maakBackend: () => s.maakBackend(), randomBytes: vast });
  assert.deepEqual({ ok: uit.ok, bytes: uit.bytes, tweeInstanties: uit.tweeInstanties,
    verwijderd: uit.verwijderd }, { ok: true, bytes: 96, tweeInstanties: true, verwijderd: true });
  assert.match(uit.sha256, /^[a-f0-9]{64}$/);
  assert.equal(s.data.size, 0);
});

test('byteverschil kan niet groen worden en het proefobject wordt opgeruimd', async () => {
  const s = opslag({ vervals: true });
  await assert.rejects(
    proefGedeeldeMedia({}, { maakBackend: () => s.maakBackend(), randomBytes: vast }),
    /andere bytes/);
  assert.equal(s.data.size, 0);
});

test('put, get en delete-fouten blijven harde mislukking', async () => {
  for (const stap of ['put', 'get', 'del']) {
    const s = opslag({ weigeren: stap });
    await assert.rejects(
      proefGedeeldeMedia({}, { maakBackend: () => s.maakBackend(), randomBytes: vast }),
      new RegExp(stap === 'del' ? 'delete' : stap));
  }
});

test('een niet-effectieve delete blijft rood en krijgt nog een opruimpoging', async () => {
  const data = new Map(); let deletes = 0;
  const maakBackend = () => ({
    async put(k, v) { data.set(k, Buffer.from(v)); },
    async get(k) { return Buffer.from(data.get(k)); },
    async del(k) { deletes++; if (deletes > 1) data.delete(k); },
    async has(k) { return data.has(k); }
  });
  await assert.rejects(
    proefGedeeldeMedia({}, { maakBackend, randomBytes: vast }),
    /bleef na verwijderen bestaan/);
  assert.equal(deletes, 2, 'finally probeert het proefobject nogmaals te verwijderen');
  assert.equal(data.size, 0);
});
