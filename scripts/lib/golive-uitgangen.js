/* Actieve uitgangen voor de go-live-keuring.

   Configuratie zegt alleen dat er een adres en credentials zijn. Voor media en
   externe alarmering is dat onvoldoende: de release moet bewijzen dat de
   ingestelde dienst op dit moment ook werkelijk schrijft, leest, verwijdert
   en ontvangt. Deze module houdt de netwerkproeven klein en injecteerbaar,
   zodat golive.js alleen de uitkomst hoeft vast te leggen. */
'use strict';

const crypto = require('crypto');
const { s3ConfigVanEnv } = require('../../server/media/s3');
const { proefGedeeldeMedia } = require('../../server/media/proef');
const { maakFoutmelder } = require('../../server/foutmelder');

const sha256 = waarde => crypto.createHash('sha256').update(String(waarde)).digest('hex');

const RATE_SCRIPT = [
  "local waarde = redis.call('INCR', KEYS[1])",
  "if waarde == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "if waarde > tonumber(ARGV[2]) then return -waarde end",
  'return waarde'
].join('\n');

function metTimeout(werk, ms, naam) {
  let timer;
  const teLaat = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(naam + ' gaf niet binnen de tijd antwoord')), ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([Promise.resolve(werk), teLaat]).finally(() => clearTimeout(timer));
}

function redisDoel(url) {
  const u = new URL(String(url || ''));
  if (!['redis:', 'rediss:'].includes(u.protocol)) throw new Error('REDIS_URL gebruikt geen redis- of rediss-protocol');
  const poort = u.port || (u.protocol === 'rediss:' ? '6380' : '6379');
  return sha256([u.protocol, u.hostname.toLowerCase(), poort, u.pathname || '/'].join('|'));
}

async function sluitRedis(client) {
  if (!client) return;
  try { await metTimeout(client.quit(), 750, 'Redis-afsluiting'); }
  catch (e) { try { client.disconnect(); } catch (e2) {} }
}

/* Bewijst meer dan bereikbaarheid. Een bericht moet van een afzonderlijke
   publicatieverbinding bij een abonnee aankomen en twee onafhankelijke
   opdrachtverbindingen moeten op dezelfde tijdelijke limiter exact één eerste
   verzoek toelaten en één tweede verzoek weigeren. Daarmee testen we precies
   de twee Redis-eigenschappen waarop intrekking en instancebrede rate limits
   in productie rusten. */
async function beproefRedis(env, opties) {
  opties = opties || {};
  const url = String(env && env.REDIS_URL || '');
  if (!url) return { ok: false, reden: 'REDIS_URL ontbreekt' };
  let doelSha256;
  try { doelSha256 = redisDoel(url); }
  catch (e) { return { ok: false, reden: String(e.message || e).slice(0, 240) }; }
  const maak = opties.createClient || require('../../server/redis').createClient;
  const clients = [];
  const ms = Number.isSafeInteger(opties.timeout) ? opties.timeout : 5000;
  const willekeurig = (opties.randomBytes || crypto.randomBytes)(24).toString('hex');
  const kanaal = 'rtg:golive:pubsub:' + willekeurig;
  const sleutel = 'rtg:golive:limiet:' + willekeurig;
  let sub, eerste, tweede;
  try {
    sub = maak({ url }); eerste = maak({ url }); tweede = maak({ url });
    clients.push(sub, eerste, tweede);
    await metTimeout(Promise.all(clients.map(c => c.connect())), ms, 'Redis-verbindingen');

    let ontvang;
    const bericht = new Promise(resolve => { ontvang = resolve; });
    await metTimeout(sub.subscribe(kanaal, waarde => ontvang(String(waarde))), ms, 'Redis-abonnement');
    const luisteraars = await metTimeout(eerste.publish(kanaal, willekeurig), ms, 'Redis-publicatie');
    const ontvangen = await metTimeout(bericht, ms, 'Redis pub/sub');
    if (ontvangen !== willekeurig || Number(luisteraars) < 1)
      throw new Error('pub/sub leverde het proefbericht niet aan een tweede verbinding');

    const antwoorden = await metTimeout(Promise.all([
      eerste.eval(RATE_SCRIPT, [sleutel], ['60000', '1']),
      tweede.eval(RATE_SCRIPT, [sleutel], ['60000', '1'])
    ]), ms, 'Redis atomische rate limit');
    const gesorteerd = antwoorden.map(Number).sort((a, b) => a - b);
    if (gesorteerd[0] !== -2 || gesorteerd[1] !== 1)
      throw new Error('de atomische limiter liet niet exact één van twee verzoeken toe');
    const teller = Number(await metTimeout(tweede.get(sleutel), ms, 'Redis gedeelde teller'));
    if (teller !== 2) throw new Error('de twee verbindingen delen niet dezelfde limietteller');
    await metTimeout(eerste.del(sleutel), ms, 'Redis proefopruiming');
    const weg = await metTimeout(tweede.get(sleutel), ms, 'Redis opruimcontrole');
    if (weg !== null) throw new Error('de tijdelijke Redis-limietteller kon niet worden verwijderd');

    return { ok: true, tweeInstanties: true, pubsub: true, atomischeRateLimit: true,
      toegestaan: 1, geweigerd: 1, teller, opgeruimd: true, doelSha256 };
  } catch (e) {
    return { ok: false, reden: String(e && e.message || e).slice(0, 240) };
  } finally {
    try { if (sub && typeof sub.unsubscribe === 'function') await metTimeout(sub.unsubscribe(kanaal), 750, 'Redis unsubscribe'); }
    catch (e) {}
    await Promise.all(clients.map(sluitRedis));
  }
}

function mediaDoel(cfg) {
  const endpoint = cfg.endpoint ? new URL(cfg.endpoint).origin : 'aws-s3';
  return sha256(['s3', endpoint, cfg.region, cfg.bucket, cfg.prefix].join('|'));
}

async function beproefMedia(env, opties) {
  opties = opties || {};
  let cfg;
  try { cfg = (opties.configVanEnv || s3ConfigVanEnv)({ ...env, NODE_ENV: 'production' }); }
  catch (e) { return { ok: false, reden: String(e && e.message || e).slice(0, 240) }; }
  if (!cfg) return { ok: false, reden: 'de gedeelde S3-mediastore is niet geconfigureerd' };
  try {
    const r = await (opties.proef || proefGedeeldeMedia)(cfg, opties.mediaOpties);
    const ok = !!r && r.ok === true && r.tweeInstanties === true &&
      r.verwijderd === true && Number.isSafeInteger(r.bytes) && r.bytes > 0 &&
      /^[a-f0-9]{64}$/.test(String(r.sha256 || ''));
    if (!ok) return { ok: false, reden: 'de mediaproef gaf geen volledige put/get/hash/delete-bevestiging' };
    return { ok: true, tweeInstanties: true, verwijderd: true, bytes: r.bytes,
      sha256: r.sha256, doelSha256: mediaDoel(cfg) };
  } catch (e) {
    return { ok: false, reden: String(e && e.message || e).slice(0, 240) };
  }
}

async function beproefAlarm(env, opties) {
  opties = opties || {};
  const url = String(env.ERR_WEBHOOK_URL || '');
  if (!url) return { ok: false, reden: 'ERR_WEBHOOK_URL ontbreekt' };
  try {
    const maak = opties.maakFoutmelder || maakFoutmelder;
    const melder = maak({ url, intern: String(env.ERR_WEBHOOK_INTERN || '') === '1',
      timeout: opties.timeout || 5000, log: opties.log });
    if (!melder || melder.actief !== true || typeof melder.zelfproef !== 'function')
      return { ok: false, reden: 'de foutmelder heeft het ingestelde doel geweigerd' };
    const r = await melder.zelfproef('golive');
    if (!r || r.ok !== true || !Number.isInteger(r.status) || r.status < 200 || r.status >= 300)
      return { ok: false, status: r && r.status, reden: String(r && r.reden || 'geen 2xx-bevestiging').slice(0, 240) };
    return { ok: true, status: r.status, doelSha256: sha256(url) };
  } catch (e) {
    return { ok: false, reden: String(e && e.message || e).slice(0, 240) };
  }
}

function mediaBewijsGeldig(r) {
  return !!r && r.ok === true && r.tweeInstanties === true && r.verwijderd === true &&
    Number.isSafeInteger(r.bytes) && r.bytes > 0 && /^[a-f0-9]{64}$/.test(String(r.sha256 || '')) &&
    /^[a-f0-9]{64}$/.test(String(r.doelSha256 || ''));
}

function alarmBewijsGeldig(r) {
  return !!r && r.ok === true && Number.isInteger(r.status) && r.status >= 200 && r.status < 300 &&
    /^[a-f0-9]{64}$/.test(String(r.doelSha256 || ''));
}

function redisBewijsGeldig(r) {
  return !!r && r.ok === true && r.tweeInstanties === true && r.pubsub === true &&
    r.atomischeRateLimit === true && r.toegestaan === 1 && r.geweigerd === 1 &&
    r.teller === 2 && r.opgeruimd === true &&
    /^[a-f0-9]{64}$/.test(String(r.doelSha256 || ''));
}

module.exports = { beproefMedia, beproefAlarm, beproefRedis,
  mediaBewijsGeldig, alarmBewijsGeldig, redisBewijsGeldig, _RATE_SCRIPT: RATE_SCRIPT };
