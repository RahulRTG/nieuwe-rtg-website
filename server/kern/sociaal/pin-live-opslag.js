/* Opslag voor de levende contactcode.

   De QR bevat een verse verwijzing, maar die verwijzing wordt nooit als
   Redis-sleutel of waarde bewaard. Een domeingescheiden HMAC maakt er een
   onomkeerbare sleutel van. De korte record bevat alleen de uitgever en het
   lifecyclecontract; Redis verwijdert hem na de TTL.

   Uitgifte roteert atomair: per uitgever kan maar een levende code tegelijk
   bestaan. Innemen is eveneens een enkel Lua-commando (GET + DEL), zodat twee
   processen nooit allebei dezelfde code kunnen gebruiken. Zonder Redis is er
   alleen een synchrone geheugenvariant voor ontwikkeling en unittoetsen. */
'use strict';

module.exports = ({ crypto, ttlMs, maxOpen }) => {
  const redisUrl = String(process.env.REDIS_URL || '');
  const gedeeld = String(process.env.RTG_SECRET_KEY || process.env.RTG_CLUSTER_KEY || '');
  const lokaalGeheim = crypto.randomBytes(32);
  const open = new Map();
  const perUitgever = new Map();
  let client = null, verbinding = null;

  const UITGIFTE = [
    "local oud=redis.call('GET',KEYS[1])",
    "if oud then redis.call('DEL',oud) end",
    "redis.call('PSETEX',KEYS[2],ARGV[1],ARGV[2])",
    "redis.call('PSETEX',KEYS[1],ARGV[1],KEYS[2])",
    'return 1'
  ].join(';');
  const INNEMEN = [
    "local v=redis.call('GET',KEYS[1])",
    'if not v then return nil end',
    "redis.call('DEL',KEYS[1])",
    'return v'
  ].join(';');
  const INTREKKEN = [
    "local oud=redis.call('GET',KEYS[1])",
    "if oud then redis.call('DEL',oud) end",
    "redis.call('DEL',KEYS[1])",
    'return 1'
  ].join(';');

  function hmac(soort, waarde) {
    const sleutel = gedeeld ? Buffer.from(gedeeld) : lokaalGeheim;
    return crypto.createHmac('sha256', sleutel)
      .update('rtg-contact-live-v1\0' + soort + '\0' + String(waarde)).digest('hex');
  }
  const codeSleutel = ref => 'rtg:pin:live:' + hmac('code', ref);
  const eigenaarSleutel = handle => 'rtg:pin:live-eigenaar:' + hmac('eigenaar', handle);

  function record(handle, gemaakt, vervalt) {
    return { uitgever: String(handle), doel: 'contact', gemaaktOp: gemaakt,
      vervaltOp: vervalt, maxGebruik: 1 };
  }
  function lees(ruw, nu) {
    try {
      const v = typeof ruw === 'string' ? JSON.parse(ruw) : ruw;
      if (!v || typeof v.uitgever !== 'string' || v.doel !== 'contact' ||
          !Number.isFinite(v.gemaaktOp) || !Number.isFinite(v.vervaltOp) ||
          v.maxGebruik !== 1 || v.vervaltOp < nu) return null;
      return v;
    } catch (e) { return null; }
  }
  function ruim(nu) {
    for (const [ref, v] of open) {
      if (v.vervaltOp >= nu && open.size <= maxOpen) continue;
      open.delete(ref);
      if (perUitgever.get(v.uitgever) === ref) perUitgever.delete(v.uitgever);
    }
  }
  async function redis() {
    if (!redisUrl) return null;
    if (gedeeld.length < 32)
      throw new Error('contact-live: Redis vereist een gedeeld geheim van minstens 32 tekens');
    if (client) return client;
    if (!verbinding) {
      const c = require('../../redis').createClient({ url: redisUrl });
      c.on('error', () => {});
      verbinding = c.connect().then(() => { client = c; return c; })
        .catch(e => { verbinding = null; throw e; });
    }
    return verbinding;
  }

  function plaats(handle, ref, nu) {
    const vervalt = nu + ttlMs, v = record(handle, nu, vervalt);
    if (!redisUrl) {
      ruim(nu);
      const oud = perUitgever.get(String(handle));
      if (oud) open.delete(oud);
      if (open.size >= maxOpen) throw new Error('contact-live: te veel open codes');
      open.set(ref, v); perUitgever.set(String(handle), ref);
      return v;
    }
    return redis().then(c => c.eval(UITGIFTE,
      [eigenaarSleutel(handle), codeSleutel(ref)], [ttlMs, JSON.stringify(v)]))
      .then(() => v);
  }
  function kijk(ref, nu) {
    if (!redisUrl) {
      const v = lees(open.get(ref), nu);
      if (!v) open.delete(ref);
      return v;
    }
    return redis().then(c => c.get(codeSleutel(ref))).then(v => lees(v, nu));
  }
  function neem(ref, nu) {
    if (!redisUrl) {
      const v = lees(open.get(ref), nu);
      open.delete(ref);
      if (v && perUitgever.get(v.uitgever) === ref) perUitgever.delete(v.uitgever);
      return v;
    }
    return redis().then(c => c.eval(INNEMEN, [codeSleutel(ref)], []))
      .then(v => lees(v, nu));
  }
  function trekIn(handle) {
    if (!redisUrl) {
      const ref = perUitgever.get(String(handle));
      if (ref) open.delete(ref);
      perUitgever.delete(String(handle));
      return true;
    }
    return redis().then(c => c.eval(INTREKKEN, [eigenaarSleutel(handle)], []))
      .then(() => true);
  }
  async function sluit() {
    const c = client;
    client = null; verbinding = null;
    if (c) await c.quit();
  }

  return { plaats, kijk, neem, trekIn, sluit, open, redisActief: !!redisUrl };
};
