/* De Redis-URL draagt vaak gebruikersnaam en wachtwoord. bus.js schreef hem
   letterlijk naar stdout (audit A-P1-01), langs de centrale redactie heen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { urlZonderGeheim } = require('../server/log-redactie');

test('urlZonderGeheim laat schema, host en poort over en niets van de inloggegevens', () => {
  assert.equal(urlZonderGeheim('redis://audit-user:FAKE-AUDIT-SECRET@127.0.0.1:6379'), 'redis://127.0.0.1:6379');
  assert.equal(urlZonderGeheim('rediss://:alleen-wachtwoord@cache.intern:6380/2'), 'rediss://cache.intern:6380/2');
  assert.equal(urlZonderGeheim('geen url met geheim-123'), '[onleesbare url]');
});

test('maakBus schrijft geen Redis-credential naar stdout of stderr', () => {
  const r = spawnSync(process.execPath, ['-e',
    "require('./server/bus').maakBus(); setTimeout(() => process.exit(0), 300)"], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { REDIS_URL: 'redis://audit-user:FAKE-AUDIT-SECRET@127.0.0.1:1' }),
    encoding: 'utf8', timeout: 20000
  });
  const uit = (r.stdout || '') + (r.stderr || '');
  assert.match(uit, /realtime via Redis: redis:\/\/127\.0\.0\.1:1/, 'de bus meldt zijn stand niet meer: ' + uit.slice(0, 300));
  assert.ok(!uit.includes('FAKE-AUDIT-SECRET'), 'het wachtwoord staat in de uitvoer: ' + uit.slice(0, 300));
  assert.ok(!uit.includes('audit-user'), 'de gebruikersnaam staat in de uitvoer');
});
