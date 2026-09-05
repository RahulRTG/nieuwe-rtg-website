'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  beproefMedia, beproefAlarm, beproefRedis,
  mediaBewijsGeldig, alarmBewijsGeldig, redisBewijsGeldig
} = require('../scripts/lib/golive-uitgangen');

function nepRedis(opties) {
  opties = opties || {};
  const waarden = new Map();
  const abonnees = new Map();
  let gemaakt = 0;
  return {
    aantal: () => gemaakt,
    createClient() {
      gemaakt++;
      return {
        async connect() {},
        async subscribe(kanaal, fn) {
          if (!abonnees.has(kanaal)) abonnees.set(kanaal, new Set());
          abonnees.get(kanaal).add(fn); return 1;
        },
        async unsubscribe(kanaal) { abonnees.delete(kanaal); },
        async publish(kanaal, bericht) {
          const lijst = [...(abonnees.get(kanaal) || [])];
          for (const fn of lijst) queueMicrotask(() => fn(bericht));
          return opties.geenLuisteraar ? 0 : lijst.length;
        },
        async eval(script, sleutels) {
          const k = sleutels[0];
          if (opties.nietAtomisch) return 1;
          const n = Number(waarden.get(k) || 0) + 1; waarden.set(k, String(n));
          return n > 1 ? -n : n;
        },
        async get(k) { return waarden.has(k) ? waarden.get(k) : null; },
        async del(k) { waarden.delete(k); return 1; },
        async quit() {}, disconnect() {}
      };
    }
  };
}

const MEDIA_ENV = {
  RTG_MEDIA_BACKEND: 's3', RTG_MEDIA_S3_BUCKET: 'rtg-productie-media',
  RTG_MEDIA_S3_REGION: 'eu-west-1', RTG_MEDIA_S3_KEY: 'sleutel',
  RTG_MEDIA_S3_SECRET: 'geheim'
};

test('mediabewijs vereist twee instanties, bytehash en verwijdering', async () => {
  const groen = await beproefMedia(MEDIA_ENV, { proef: async () => ({
    ok: true, tweeInstanties: true, verwijderd: true, bytes: 96, sha256: 'a'.repeat(64)
  }) });
  assert.equal(mediaBewijsGeldig(groen), true);
  for (const veld of ['tweeInstanties', 'verwijderd']) {
    const rood = await beproefMedia(MEDIA_ENV, { proef: async () => ({
      ok: true, tweeInstanties: true, verwijderd: true, bytes: 96,
      sha256: 'a'.repeat(64), [veld]: false
    }) });
    assert.equal(rood.ok, false, veld + ' mag niet ontbreken');
  }
});

test('mediaproef faalt gesloten bij ontbrekende config of providerfout', async () => {
  assert.equal((await beproefMedia({})).ok, false);
  const fout = await beproefMedia(MEDIA_ENV, { proef: async () => { throw new Error('provider 503'); } });
  assert.deepEqual(fout, { ok: false, reden: 'provider 503' });
});

test('alarmbewijs vraagt een werkelijk ontvangen 2xx-zelfproef', async () => {
  const maak = antwoord => () => ({ actief: true, zelfproef: async () => antwoord });
  const groen = await beproefAlarm({ ERR_WEBHOOK_URL: 'https://alarm.example.test/geheim' }, {
    maakFoutmelder: maak({ ok: true, status: 204 })
  });
  assert.equal(alarmBewijsGeldig(groen), true);
  assert.equal(Object.values(groen).join(' ').includes('geheim'), false, 'webhookpad blijft uit bewijs');

  const rood = await beproefAlarm({ ERR_WEBHOOK_URL: 'https://alarm.example.test' }, {
    maakFoutmelder: maak({ ok: false, status: 500, reden: 'ontvanger antwoordde 500' })
  });
  assert.equal(alarmBewijsGeldig(rood), false);
  assert.equal(rood.ok, false);
});

test('een geweigerde of ontbrekende alarmuitgang is nooit bewijs', async () => {
  assert.equal((await beproefAlarm({})).ok, false);
  const geweigerd = await beproefAlarm({ ERR_WEBHOOK_URL: 'https://alarm.example.test' }, {
    maakFoutmelder: () => ({ actief: false })
  });
  assert.equal(geweigerd.ok, false);
});

test('Redis-bewijs vereist echte pubsub en één atomisch geweigerd verzoek', async () => {
  const nep = nepRedis();
  const bewijs = await beproefRedis({ REDIS_URL:'redis://geheim@redis:6379/4' }, {
    createClient:nep.createClient
  });
  assert.equal(nep.aantal(), 3, 'aparte subscriber en twee opdrachtverbindingen');
  assert.equal(redisBewijsGeldig(bewijs), true);
  assert.equal(JSON.stringify(bewijs).includes('geheim'), false);
  assert.deepEqual({ toegestaan:bewijs.toegestaan, geweigerd:bewijs.geweigerd,
    teller:bewijs.teller, opgeruimd:bewijs.opgeruimd },
  { toegestaan:1, geweigerd:1, teller:2, opgeruimd:true });
});

test('Redis PING-achtig bereik zonder levering of atomiciteit blijft rood', async () => {
  assert.equal((await beproefRedis({})).ok, false);
  const geenLevering = nepRedis({ geenLuisteraar:true });
  assert.equal((await beproefRedis({ REDIS_URL:'redis://redis:6379' }, {
    createClient:geenLevering.createClient, timeout:25
  })).ok, false);
  const race = nepRedis({ nietAtomisch:true });
  const bewijs = await beproefRedis({ REDIS_URL:'redis://redis:6379' }, {
    createClient:race.createClient
  });
  assert.equal(bewijs.ok, false);
  assert.match(bewijs.reden, /atomische limiter/);
});
