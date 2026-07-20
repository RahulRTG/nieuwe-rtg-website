/* Eigen Redis-client (server/redis.js), die het pakket `redis` verving. We
   starten een ECHTE redis-server op een vrije poort en toetsen: set/get,
   publish/subscribe, en kruisvalidatie met de nog geïnstalleerde npm-client
   (mijn publish -> npm ontvangt, en npm publish -> ik ontvang) zodat het
   wireprotocol echt klopt. Zonder redis-server worden de tests overgeslagen.
   Los: node --test test/redis.test.js */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const { spawnSync, spawn } = require('node:child_process');
const eigen = require('../server/redis');

const HEEFT_REDIS = spawnSync('sh', ['-c', 'command -v redis-server']).status === 0;
const wacht = ms => new Promise(r => setTimeout(r, ms));
function vrijePoort() {
  return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}

let server, POORT, URL;

before(async () => {
  if (!HEEFT_REDIS) return;
  POORT = await vrijePoort();
  URL = 'redis://127.0.0.1:' + POORT;
  server = spawn('redis-server', ['--port', String(POORT), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  // wachten tot hij luistert
  for (let i = 0; i < 60; i++) {
    const c = eigen.createClient({ url: URL }); c.on('error', () => {});
    try { await c.connect(); await c.set('probe', '1'); c.quit(); break; } catch (e) { c.disconnect(); await wacht(100); }
  }
});
after(() => { if (server) try { server.kill('SIGKILL'); } catch (e) {} });

test('set/get gaan over de eigen client', { skip: !HEEFT_REDIS }, async () => {
  const c = eigen.createClient({ url: URL }); c.on('error', () => {});
  await c.connect();
  assert.strictEqual(await c.set('rtg:test', 'hallo'), 'OK');
  assert.strictEqual(await c.get('rtg:test'), 'hallo');
  assert.strictEqual(await c.get('rtg:bestaat-niet'), null);
  await c.quit();
});

test('publish/subscribe binnen de eigen client', { skip: !HEEFT_REDIS }, async () => {
  const sub = eigen.createClient({ url: URL }); sub.on('error', () => {});
  const pub = eigen.createClient({ url: URL }); pub.on('error', () => {});
  await sub.connect(); await pub.connect();
  const ontvangen = [];
  await sub.subscribe('rtg:kanaal', m => ontvangen.push(m));
  await wacht(50);
  await pub.publish('rtg:kanaal', JSON.stringify({ hoi: 1 }));
  for (let i = 0; i < 50 && ontvangen.length === 0; i++) await wacht(20);
  assert.strictEqual(ontvangen.length, 1);
  assert.deepStrictEqual(JSON.parse(ontvangen[0]), { hoi: 1 });
  await Promise.all([sub.quit(), pub.quit()]);
});

test('kruisvalidatie met de npm-client: beide kanten op', { skip: !HEEFT_REDIS }, async () => {
  let npm; try { npm = require('redis'); } catch (e) { return; } // npm-client (nog) niet aanwezig: overslaan
  // mijn publish -> npm ontvangt
  const npmSub = npm.createClient({ url: URL }); npmSub.on('error', () => {});
  const mijnPub = eigen.createClient({ url: URL }); mijnPub.on('error', () => {});
  await npmSub.connect(); await mijnPub.connect();
  const naarNpm = [];
  await npmSub.subscribe('kruis:a', m => naarNpm.push(m));
  await wacht(50);
  await mijnPub.publish('kruis:a', 'van-mij');
  for (let i = 0; i < 50 && naarNpm.length === 0; i++) await wacht(20);
  assert.deepStrictEqual(naarNpm, ['van-mij'], 'npm-client ontvangt wat mijn client publiceert');

  // npm publish -> mijn client ontvangt
  const mijnSub = eigen.createClient({ url: URL }); mijnSub.on('error', () => {});
  const npmPub = npm.createClient({ url: URL }); npmPub.on('error', () => {});
  await mijnSub.connect(); await npmPub.connect();
  const naarMij = [];
  await mijnSub.subscribe('kruis:b', m => naarMij.push(m));
  await wacht(50);
  await npmPub.publish('kruis:b', 'van-npm');
  for (let i = 0; i < 50 && naarMij.length === 0; i++) await wacht(20);
  assert.deepStrictEqual(naarMij, ['van-npm'], 'mijn client ontvangt wat de npm-client publiceert');

  // en set via de een is leesbaar via de ander
  await npmPub.set('kruis:sleutel', 'gedeeld');
  assert.strictEqual(await mijnPub.get('kruis:sleutel'), 'gedeeld');

  await Promise.allSettled([npmSub.quit(), mijnPub.quit(), mijnSub.quit(), npmPub.quit()]);
  await wacht(100); // sockets rustig laten sluiten voor de test eindigt
});
