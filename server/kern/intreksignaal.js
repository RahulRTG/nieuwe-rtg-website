/* Het ene proces- en instancebrede signaal dat een sessiecredential zojuist is
   ingetrokken. In een cluster is Redis de gedeelde, vervallende autoriteit;
   lokaal blijft SQLite het herstelbewijs voor een enkele instance.

   Alleen een SHA-256-vingerafdruk van het token of de niet-geheime sessie-id
   reist over de interne bus. Lokaal leveren we eerst synchroon af. Met Redis
   komt dezelfde gebeurtenis daarna bij de andere processen; de eigen echo
   wordt aan de willekeurige procesbron herkend. */
'use strict';

const crypto = require('crypto');

const KANAAL = 'rtg:intrekking:v1';
const PREFIX = KANAAL + ':';
const BRON = crypto.randomBytes(12).toString('hex');
const luisteraars = new Set();
const standLuisteraars = new Set();
const ingetrokkenTokens = new Map();
const ingetrokkenSessies = new Map();
let bus = null;
let busStand = { gekoppeld: false, soort: 'geen', gereed: false };
let generatie = 0, duurzameFout = null;
const wachtend = new Set();
let outbox = null, herstelTimer = null;

const vingerVanToken = token => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const goedeVinger = waarde => /^[a-f0-9]{64}$/.test(String(waarde || ''));
const goedeSid = waarde => /^[A-Za-z0-9_-]{12}$/.test(String(waarde || ''));

function geldig(bericht) {
  if (!bericht || bericht.versie !== 1) return false;
  if (!Number.isFinite(Number(bericht.verloopt)) || Number(bericht.verloopt) <= Date.now()) return false;
  if (bericht.soort === 'token') return goedeVinger(bericht.waarde);
  if (bericht.soort === 'sessie') return goedeSid(bericht.waarde);
  return false;
}

function lever(bericht) {
  if (!geldig(bericht)) return false;
  const doel = bericht.soort === 'token' ? ingetrokkenTokens : ingetrokkenSessies;
  doel.set(bericht.waarde, Number(bericht.verloopt));
  for (const fn of [...luisteraars]) {
    try { fn({ soort: bericht.soort, waarde: bericht.waarde }); } catch (e) {}
  }
  return true;
}

function meldStand(volgende) {
  busStand = Object.assign({}, busStand, volgende);
  for (const fn of [...standLuisteraars]) {
    try { fn(Object.assign({}, busStand)); } catch (e) {}
  }
}

function meld(soort, waarde, verloopt) {
  const bericht = { versie: 1, bron: BRON, soort, waarde, verloopt: Number(verloopt) };
  if (!geldig(bericht)) return false;
  lever(bericht);                    // de huidige instance sluit meteen
  if (bus) {
    const uit = Object.assign({}, bericht, { envelop: { classificatie: 'intern' } });
    if (bus.soort === 'redis') {
      const sleutel = PREFIX + soort + ':' + waarde;
      const p = busStand.gereed && typeof bus.bewaar === 'function'
        ? Promise.resolve(bus.bewaar(KANAAL, sleutel, uit, Number(verloopt) - Date.now()))
          .then(async () => {
            const lokaal = soort + ':' + waarde;
            if (outbox && outbox.gedeeldVoltooi) await outbox.gedeeldVoltooi([lokaal]);
            if (outbox) outbox.voltooi([lokaal]);
          })
        : Promise.reject(new Error('de Redis-intrekkingsautoriteit is niet gereed'));
      const bewaakt = Promise.resolve(p).catch(e => {
        duurzameFout = e; meldStand({ gereed: false }); planHerstel(); throw e;
      });
      wachtend.add(bewaakt);
      bewaakt.finally(() => wachtend.delete(bewaakt)).catch(() => {});
    } else (bus.publishDirect || bus.publish)(KANAAL, uit);
  }
  return true;
}

function tokenVervalt(token) {
  try {
    const body = Buffer.from(String(token).split('.')[0], 'base64url').toString();
    const delen = body.split('.');
    return Number(delen.length > 3 ? delen[1] : delen[2]) || 0;
  } catch (e) { return 0; }
}
function meldToken(token, verloopt) {
  return typeof token === 'string' && token
    ? meld('token', vingerVanToken(token), Number(verloopt) || tokenVervalt(token) || Date.now() + 30 * 86400000) : false;
}
function meldVinger(vinger, verloopt) {
  return meld('token', String(vinger || ''), Number(verloopt) || Date.now() + 30 * 86400000);
}
function meldSessie(sid, verloopt) {
  return meld('sessie', String(sid || ''), Number(verloopt) || Date.now() + 30 * 86400000);
}

function staatIn(lijst, sleutel) {
  const exp = Number(lijst.get(sleutel) || 0);
  if (!exp) return false;
  if (exp >= Date.now()) return true;
  lijst.delete(sleutel);
  return false;
}
function tokenIngetrokken(token) { return staatIn(ingetrokkenTokens, vingerVanToken(token)); }
function sessieIngetrokken(sid) { return staatIn(ingetrokkenSessies, String(sid || '')); }

function koppelOutbox(bron) {
  if (!bron || typeof bron.lijst !== 'function' || typeof bron.voltooi !== 'function') return false;
  outbox = bron;
  return true;
}

async function bereid(rij) {
  const bericht = rij && { versie: 1, soort: rij.soort, waarde: rij.waarde,
    verloopt: Number(rij.verloopt) };
  if (!geldig(bericht)) throw new Error('ongeldige intrekking voor de outbox');
  if (outbox && typeof outbox.deel === 'function') await outbox.deel(rij);
  return true;
}

async function herhaalOutbox() {
  if (!outbox) return;
  const samen = new Map();
  for (const rij of outbox.lijst() || []) samen.set(rij.sleutel, rij);
  if (typeof outbox.gedeeld === 'function')
    for (const rij of await outbox.gedeeld() || []) samen.set(rij.sleutel, rij);
  const voltooid = [];
  for (const rij of samen.values()) {
      const bericht = { versie: 1, bron: BRON, soort: rij.soort,
        waarde: rij.waarde, verloopt: Number(rij.verloopt),
        envelop: { classificatie: 'intern' } };
      if (!geldig(bericht)) { voltooid.push(rij.sleutel); continue; }
      lever(bericht);
      await bus.bewaar(KANAAL, PREFIX + rij.soort + ':' + rij.waarde, bericht,
        Number(rij.verloopt) - Date.now());
      voltooid.push(rij.sleutel);
  }
  if (voltooid.length && outbox.gedeeldVoltooi) await outbox.gedeeldVoltooi(voltooid);
  if (voltooid.length) outbox.voltooi(voltooid);
}

async function hydrateer(huidig) {
  const berichten = await bus.herhaal(PREFIX);
  if (huidig !== generatie) return;
  for (const bericht of berichten || []) lever(bericht);
  await herhaalOutbox();
  if (huidig !== generatie) return;
  duurzameFout = null;
  meldStand({ gekoppeld: true, soort: 'redis', gereed: true });
}

function planHerstel() {
  if (herstelTimer || !bus || bus.soort !== 'redis') return;
  herstelTimer = setTimeout(() => {
    herstelTimer = null;
    if (!bus || typeof bus.gereed !== 'function' || !bus.gereed()) return planHerstel();
    const huidig = ++generatie;
    meldStand({ gekoppeld: true, soort: 'redis', gereed: false });
    hydrateer(huidig).catch(e => { duurzameFout = e; planHerstel(); });
  }, 500);
  if (herstelTimer.unref) herstelTimer.unref();
}

async function wachtDuurzaam() {
  if (wachtend.size) await Promise.all([...wachtend]);
  if (duurzameFout) throw duurzameFout;
  return true;
}

function koppelBus(nieuweBus) {
  if (bus === nieuweBus) return true;
  if (bus) throw new Error('intreksignaal: een tweede realtimebus zou twee waarheden maken');
  if (!nieuweBus || typeof nieuweBus.publish !== 'function' ||
      typeof nieuweBus.subscribe !== 'function') return false;
  bus = nieuweBus;
  bus.subscribe(KANAAL, bericht => {
    if (!bericht || bericht.bron === BRON) return;
    lever(bericht);
  });
  const soort = String(bus.soort || 'onbekend');
  const eerste = { gekoppeld: true, soort, gereed: soort !== 'redis' };
  meldStand(eerste);
  if (typeof bus.onStand === 'function') bus.onStand(s => {
    const huidig = ++generatie;
    const transport = !!(s && s.gereed);
    const soortNu = String((s && s.soort) || bus.soort || 'onbekend');
    if (soortNu !== 'redis') return meldStand({ gekoppeld: true, soort: soortNu, gereed: true });
    meldStand({ gekoppeld: true, soort: soortNu, gereed: false });
    if (!transport || typeof bus.herhaal !== 'function') return;
    hydrateer(huidig).catch(e => {
      if (huidig !== generatie) return;
      duurzameFout = e;
      meldStand({ gekoppeld: true, soort: 'redis', gereed: false });
      planHerstel();
    });
  });
  return true;
}

function abonneer(fn) {
  if (typeof fn !== 'function') return () => {};
  luisteraars.add(fn);
  return () => luisteraars.delete(fn);
}
function bewaakStand(fn) {
  if (typeof fn !== 'function') return () => {};
  standLuisteraars.add(fn);
  fn(Object.assign({}, busStand));
  return () => standLuisteraars.delete(fn);
}
function stand() { return Object.assign({}, busStand); }

function _wis() {
  generatie++;
  if (herstelTimer) clearTimeout(herstelTimer);
  luisteraars.clear(); standLuisteraars.clear(); bus = null;
  ingetrokkenTokens.clear(); ingetrokkenSessies.clear();
  wachtend.clear(); duurzameFout = null; outbox = null; herstelTimer = null;
  busStand = { gekoppeld: false, soort: 'geen', gereed: false };
}

module.exports = { KANAAL, PREFIX, vingerVanToken, meldToken, meldVinger, meldSessie,
  tokenIngetrokken, sessieIngetrokken, bereid, wachtDuurzaam,
  koppelBus, koppelOutbox, abonneer, bewaakStand, stand, _wis };
