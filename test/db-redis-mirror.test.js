'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

test('de gedeelde db-mirror laadt de centrale Redis-client en start twee verbindingen', async () => {
  const vorig = { REDIS_URL: process.env.REDIS_URL, RTG_STORE: process.env.RTG_STORE };
  process.env.REDIS_URL = 'redis://bewijs.invalid:6379';
  process.env.RTG_STORE = 'json';

  const origineel = Module._load;
  let moduleLadingen = 0, verbindingen = 0, abonnementen = 0;
  const nepClient = () => ({
    on() { return this; },
    async connect() { verbindingen++; },
    async subscribe() { abonnementen++; },
    async set() { return 'OK'; },
    async publish() { return 1; },
    async get() { return null; }
  });

  Module._load = function (request, parent, isMain) {
    if (request === '../redis' && parent && /server\/db\/redis\.js$/.test(parent.filename)) {
      moduleLadingen++;
      return { createClient: nepClient };
    }
    return origineel.call(this, request, parent, isMain);
  };

  const pad = require.resolve('../server/db/redis');
  const opslagPad = require.resolve('../server/db/opslag');
  try {
    delete require.cache[pad];
    delete require.cache[opslagPad];
    const state = require('../server/db/state');
    state.db.data = { bewijs: true };
    const spiegel = require('../server/db/redis');
    assert.strictEqual(await spiegel.startGedeeld(), true);
    assert.strictEqual(moduleLadingen, 1, 'exact de centrale clientmodule wordt geladen');
    assert.strictEqual(verbindingen, 2, 'publicatie en abonnement hebben elk een verbinding');
    assert.strictEqual(abonnementen, 1, 'de lezer abonneert op databasewijzigingen');
  } finally {
    Module._load = origineel;
    delete require.cache[pad];
    delete require.cache[opslagPad];
    if (vorig.REDIS_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = vorig.REDIS_URL;
    if (vorig.RTG_STORE === undefined) delete process.env.RTG_STORE;
    else process.env.RTG_STORE = vorig.RTG_STORE;
  }
});
