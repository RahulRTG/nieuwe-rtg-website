'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const antwoord = require('../server/lib/reisketen-antwoord');
const operatiepad = require('../server/lib/ontvangst-operatiepad');
const { lokaleInstallatie } = require('../server/kern/vrijgave/lokaal');

test('de nieuwe contractketen is geen productie- of openbare ontwikkeluitrol', async () => {
  const namen = ['NODE_ENV', 'APP_URL', 'RTG_HOST', 'HOST', 'RTG_CLUSTER_KEY', 'RTG_DOMAINS', 'RTG_TLS', 'RTG_ACME'];
  const oud = Object.fromEntries(namen.map(k => [k, process.env[k]]));
  try {
    for (const omgeving of [
      { NODE_ENV: 'production', APP_URL: 'http://127.0.0.1:3000' },
      { NODE_ENV: 'development', APP_URL: 'https://reizen.example.test' },
      { NODE_ENV: 'onbekend', APP_URL: 'http://127.0.0.1:3000' }
    ]) {
      for (const k of namen) delete process.env[k];
      Object.assign(process.env, omgeving);
      assert.equal(lokaleInstallatie(process.env).ja, false);
      let uitgevoerd = 0;
      const res = { status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
      await antwoord({}, res, { actorRef: 'user-1', org: 'rtg' }, () => { uitgevoerd++; return { ok: true }; });
      assert.equal(res.code, 503);
      assert.equal(res.body.code, 'reisketen-no-go');
      assert.equal(uitgevoerd, 0, 'geen actoruitzondering of handeling vóór de bestaande lokale grens');
    }
  } finally {
    for (const k of namen) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; }
  }
});

test('alle contractlezers en mutaties omzeilen transportreplay, niet hun actuele autorisatie', () => {
  const paden = [
    '/api/reisbureau/keten', '/api/reisbureau/keten/start', '/api/reisbureau/keten/akkoord', '/api/reisbureau/keten/betaal',
    '/api/reisbureau/keten/nazorg', '/api/office/reisbureau/keten/nazorg/antwoord',
    '/api/supplier/reisbureau/keten/nazorg/antwoord',
    '/api/office/reisbureau/keten', '/api/office/reisbureau/keten/offerte', '/api/office/reisbureau/keten/afronden',
    '/api/supplier/reisbureau/keten', '/api/supplier/reisbureau/keten/offerte', '/api/supplier/reisbureau/keten/afronden',
    '/api/supplier/reisbureau/opdrachten', '/api/supplier/reisbureau/opdracht/besluit'
  ];
  for (const pad of paden) {
    assert.equal(operatiepad(pad), true, pad);
    assert.equal(operatiepad(pad.toUpperCase() + '/'), true, pad + ' Express-variant');
    assert.equal(operatiepad(pad + '/onbekend'), false, 'geen onbeperkte prefixvrijstelling');
  }
});
