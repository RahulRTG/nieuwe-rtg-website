/* DE UITGIFTE VAN ICE-SERVERS: wie krijgt een TURN-credential, en wanneer.

   Vóór deze module gaf GET /api/ice aan IEDEREEN, ook zonder sessie, een
   geldig coturn-credential. Een credential van een uur dat iedereen kan halen
   maakt van het relais een open relais met een omweg. De regels nu:

   - een TURN-credential gaat alleen naar een GEAUTHENTICEERDE actor (de
     aanroeper bewijst zelf wie hij is; deze module beslist niet over sessies,
     ze krijgt een actor of null);
   - in publieke productie gaat hij alleen mee als de relaystand gereed is --
     een credential voor een relais dat niet aantoonbaar werkt is een belofte
     die het scherm niet kan waarmaken;
   - het credential is kortlevend (config/turn.js ttlVan) en draagt een
     ondoorzichtig actorlabel, nooit een codenaam;
   - per actor een plafond op het aantal uitgiftes, zodat één gestolen sessie
     geen bandbreedtekraan wordt;
   - STUN blijft voor iedereen: het verraadt niets en relayt niets. */
'use strict';

const turn = require('../../config/turn');
const relaystand = require('./relaystand');

const LIMIET = 30, VENSTER_MS = 60 * 1000, MAX_ACTOREN = 50000;
const uitgiftes = new Map();

function binnenLimiet(actor, nu = Date.now()) {
  const xs = (uitgiftes.get(actor) || []).filter(t => nu - t < VENSTER_MS);
  if (xs.length >= LIMIET) { uitgiftes.set(actor, xs); return false; }
  xs.push(nu); uitgiftes.delete(actor); uitgiftes.set(actor, xs);
  if (uitgiftes.size > MAX_ACTOREN) uitgiftes.delete(uitgiftes.keys().next().value);
  return true;
}

const publiekeProductie = env => env.NODE_ENV === 'production' && env.RTG_PRIVATE_BETA !== '1';

function stunLijst(hostname, env) {
  const pub = publiekeProductie(env);
  const p = turn.projecteerStun({ APP_URL: env.APP_URL, STUN_URL: env.STUN_URL,
    STUN_PUBLIC_HOST: env.STUN_PUBLIC_HOST, STUN_PORT: env.STUN_PORT }, { publiekeProductie: pub, requestHost: hostname });
  const stun = p.urls ? [...p.urls] : [];
  if (!pub && env.STUN_FALLBACK_GOOGLE === '1') stun.push('stun:stun.l.google.com:19302');
  return stun.length ? [{ urls: stun }] : [];
}

/* Bouw het antwoord. `actor` is een stabiele, server-side bepaalde sleutel
   (nooit uit het verzoeklichaam) of null. */
function antwoord(actor, { hostname = null, env = process.env, nu = Date.now } = {}) {
  const st = relaystand.stand(env, nu());
  const relay = { vereist: st.relayVereist, beschikbaar: st.beschikbaar, geverifieerd: st.geverifieerd, reden: st.reden };
  const iceServers = env.RTG_RTC_UIT === '1' ? [] : stunLijst(hostname, env);
  if (!actor) return { status: 401, body: { error: 'Log in om te bellen.', iceServers, relay } };
  if (st.reden === 'RTC_KILL_SWITCH') return { status: 503, body: { error: 'Bellen staat tijdelijk uit.', iceServers: [], relay } };
  if (!binnenLimiet(String(actor))) return { status: 429, body: { error: 'Te veel verzoeken om belgegevens.', iceServers, relay } };
  const pub = publiekeProductie(env);
  if (pub && !st.geverifieerd) return { status: 200, body: { iceServers, relay } };
  const t = turn.projecteerTurn({ TURN_URL: env.TURN_URL, TURN_SECRET: env.TURN_SECRET,
    TURN_USER: env.TURN_USER, TURN_PASS: env.TURN_PASS, TURN_CREDENTIAL_TTL: env.TURN_CREDENTIAL_TTL },
  { publiekeProductie: pub, actor: String(actor), nu });
  if (t.server) iceServers.push(t.server);
  return { status: 200, body: { iceServers, relay, ...(t.verloopt ? { verloopt: t.verloopt } : {}) } };
}

/* De actor achter een Bearer-token, via dezelfde resolveSession als auth():
   leden, personeel, zaken en kantoor. Een stabiele sleutel als die er is,
   anders een hash van het token (nooit het token zelf). */
function bearerActor(req, resolveSession) {
  const header = (req && typeof req.get === 'function' && req.get('authorization')) || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const sess = token && typeof resolveSession === 'function' ? resolveSession(token) : null;
  if (!sess) return null;
  return sess.key ? 'sessie:' + sess.key
    : 'token:' + require('node:crypto').createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function stuur(res, uit) {
  res.set('Cache-Control', 'no-store');
  return res.status(uit.status).json(uit.body);
}

function vergeetLimieten() { uitgiftes.clear(); }

module.exports = { antwoord, stuur, bearerActor, stunLijst, binnenLimiet, vergeetLimieten, LIMIET, VENSTER_MS };
