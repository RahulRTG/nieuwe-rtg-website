/* Redis is bij een geconfigureerd cluster geen versneller maar een deel van de
   bevoegdheidsketen. Een ongeldige verbinding en een vollopende wachtrij mogen
   daarom nooit als gezonde in-procesbus eindigen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const busPad = require.resolve('../server/bus');
const redisPad = require.resolve('../server/redis');

function herstel(oudUrl, oudMax, oudRedis) {
  if (oudUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oudUrl;
  if (oudMax === undefined) delete process.env.RTG_BUS_WACHTRIJ_MAX; else process.env.RTG_BUS_WACHTRIJ_MAX = oudMax;
  if (oudRedis) require.cache[redisPad] = oudRedis; else delete require.cache[redisPad];
  delete require.cache[busPad];
}

test('een ongeldige REDIS_URL valt niet terug naar een gezonde in-procesbus', () => {
  const oudUrl = process.env.REDIS_URL, oudMax = process.env.RTG_BUS_WACHTRIJ_MAX;
  try {
    process.env.REDIS_URL = 'geen-url';
    delete require.cache[busPad];
    const bus = require('../server/bus').maakBus();
    assert.equal(bus.soort, 'redis');
    assert.equal(bus.gereed(), false);
  } finally { herstel(oudUrl, oudMax, require.cache[redisPad]); }
});

test('de publicatiewachtrij is begrensd en laat readiness fail-closed', () => {
  const oudUrl = process.env.REDIS_URL, oudMax = process.env.RTG_BUS_WACHTRIJ_MAX;
  const oudRedis = require.cache[redisPad];
  const fouten = [], oudeError = console.error;
  try {
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    process.env.RTG_BUS_WACHTRIJ_MAX = '10';
    const stil = () => new Promise(() => {});
    require.cache[redisPad] = { id: redisPad, filename: redisPad, loaded: true,
      exports: { createClient: () => ({ on() { return this; }, connect: stil,
        publish: async () => 0, subscribe: async () => 1, scan: async () => ['0', []],
        get: async () => null, eval: async () => 1 }) } };
    delete require.cache[busPad];
    console.error = (...a) => fouten.push(a.join(' '));
    const bus = require('../server/bus').maakBus();
    for (let i = 0; i < 11; i++) bus.publish('toets', { i });
    assert.equal(bus.gereed(), false);
    assert.ok(fouten.some(x => /wachtrij vol.*fail-closed/.test(x)));
  } finally {
    console.error = oudeError;
    herstel(oudUrl, oudMax, oudRedis);
  }
});
