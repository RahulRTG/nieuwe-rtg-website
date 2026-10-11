'use strict';
/* Audit P1-3d: het externe anker van het auditspoor is in publieke productie
   VERPLICHT, net als ERR_WEBHOOK_URL. Zonder adres, of met een adres dat de
   ankerpost weigert, start productie niet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { keurAnker } = require('../server/config/productie-anker');

const keur = (env, priveBeta) => { const f = [], w = []; keurAnker(env, f, w, priveBeta); return { f, w }; };

test('zonder RTG_ANKERPOST_URL: een fout in publieke productie, een waarschuwing in de besloten beta', () => {
  assert.match(keur({}, false).f.join(' '), /RTG_ANKERPOST_URL niet gezet/);
  const beta = keur({}, true);
  assert.equal(beta.f.length, 0); assert.match(beta.w.join(' '), /RTG_ANKERPOST_URL/);
});

test('een adres op deze machine of zonder versleuteling is geen bestemming', () => {
  assert.match(keur({ RTG_ANKERPOST_URL: 'https://localhost/' }, false).f.join(' '), /geweigerd/);
  assert.match(keur({ RTG_ANKERPOST_URL: 'file:///var/anker' }, false).f.join(' '), /geweigerd/);
});

test('een geldig adres met sleutel is in orde; zonder sleutel een waarschuwing', () => {
  const goed = keur({ RTG_ANKERPOST_URL: 'https://anker.voorbeeld.test/', RTG_ANKERPOST_SLEUTEL: 's' }, false);
  assert.deepEqual(goed, { f: [], w: [] });
  assert.match(keur({ RTG_ANKERPOST_URL: 'https://anker.voorbeeld.test/' }, false).w.join(' '), /RTG_ANKERPOST_SLEUTEL/);
});

test('de productiekeuring roept hem werkelijk aan', () => {
  const r = require('../server/config').valideer({ NODE_ENV: 'production' });
  assert.ok(r.fouten.some(f => /RTG_ANKERPOST_URL/.test(f)), JSON.stringify(r.fouten).slice(0, 300));
});
