/* De credentialkant van TURN: welke geheimen sterk genoeg zijn, wat publieke
   productie accepteert, en hoe een kortlevend TURN REST-credential eruitziet.
   Afgesplitst van config/turn.js (adresontleding) op de 10 KB-grens; beide
   helften worden via config/turn.js geëxporteerd, zodat er één ingang blijft. */
'use strict';

const crypto = require('node:crypto');

const PLAATSHOUDER = /(?:voorbeeld|example|placeholder|change-?me|your-?(?:domain|host)|vul-?in|dummy|test-?only)/i;

function sterkGeheim(waarde) {
  const s = String(waarde || '');
  if (s.length < 32 || s.length > 512 || /[\s\0-\x1f\x7f]/.test(s) || PLAATSHOUDER.test(s)) return false;
  if (new Set(s).size < 8) return false;
  return (s + s).indexOf(s, 1) === s.length;
}

function geldigeGebruiker(waarde) {
  const s = String(waarde || '');
  return s.length >= 3 && s.length <= 128 && !/[\s\0-\x1f\x7f:]/.test(s) && !PLAATSHOUDER.test(s);
}

function credentials(env, { publiekeProductie = false } = {}) {
  const secret = String(env.TURN_SECRET || '');
  if (sterkGeheim(secret)) return { soort:'tijdelijk', secret };
  /* Een vaste TURN_USER/TURN_PASS gaat ongewijzigd naar elke browser en verloopt
     nooit: dat is een permanente frontendcredential. Publieke productie kent
     daarom alleen de tijdelijke (TURN REST) route. */
  if (publiekeProductie) return null;
  const username = String(env.TURN_USER || ''), credential = String(env.TURN_PASS || '');
  if (geldigeGebruiker(username) && sterkGeheim(credential))
    return { soort:'vast', username, credential };
  return null;
}

/* De levensduur van een uitgegeven TURN-credential. coturn toetst de
   tijdstempel in de gebruikersnaam bij ELK geauthenticeerd verzoek, ook bij de
   Refresh en CreatePermission tijdens een lopend gesprek; korter dan een
   gesprek mag dus niet zonder dat de client vernieuwt. Een uur is de vaste
   standaard, TURN_CREDENTIAL_TTL mag hem binnen [5 min, 4 uur] zetten. */
const TTL_STANDAARD = 3600, TTL_MIN = 300, TTL_MAX = 4 * 3600;
function ttlVan(env) {
  const n = Number(env.TURN_CREDENTIAL_TTL);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return TTL_STANDAARD;
  return Math.min(TTL_MAX, Math.max(TTL_MIN, n));
}

/* De gebruikersnaam draagt het verloop plus een ONDOORZICHTIGE actorlabel:
   coturn kan per uitgifte loggen en tellen zonder dat er een codenaam of
   sessiesleutel in zijn log terechtkomt. Het label is een HMAC onder het
   TURN-geheim, dus niet terug te rekenen en niet te vervalsen. */
function actorLabel(secret, actor) {
  return crypto.createHmac('sha256', secret).update('rtg-turn-actor-v1\0' + String(actor || 'anoniem'))
    .digest('base64url').slice(0, 22);
}

function tijdelijk(secret, { actor, ttl = TTL_STANDAARD, nu = Date.now } = {}) {
  const verloopt = Math.floor(nu() / 1000) + ttl;
  const username = verloopt + ':' + actorLabel(secret, actor);
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential, verloopt };
}

module.exports = { sterkGeheim, geldigeGebruiker, credentials, ttlVan, actorLabel, tijdelijk,
  TTL_STANDAARD, TTL_MIN, TTL_MAX };
