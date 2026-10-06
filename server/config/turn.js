/* Een voorstelling van de TURN-configuratie voor productiekeuring en runtime.
   De browser mag nooit een lossere lijst krijgen dan de startpoort heeft
   gekeurd. Daarom delen beide paden deze parser en credentialcontrole. */
'use strict';

const net = require('node:net');
const crypto = require('node:crypto');

const PLAATSHOUDER = /(?:voorbeeld|example|placeholder|change-?me|your-?(?:domain|host)|vul-?in|dummy|test-?only)/i;
const GERESERVEERD_DOMEIN = /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/i;
const VOORBEELD_DOMEIN = /(?:^|\.)example\.(?:com|net|org)$/i;

function priveIpv4(host) {
  const p = host.split('.').map(Number);
  if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && (p[1] === 168 || p[1] === 0 || (p[1] === 0 && p[2] === 2))) ||
    (p[0] === 198 && (p[1] === 18 || p[1] === 19 || p[1] === 51 && p[2] === 100)) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113);
}

function priveIpv6(host) {
  const h = host.toLowerCase();
  if (h === '::' || h === '::1' || h.startsWith('2001:db8:') || h === '2001:db8::') return true;
  if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h) || /^ff/.test(h)) return true;
  const mapped = ipv4Mapped(h);
  return mapped ? priveIpv4(mapped) : false;
}

/* Node herkent zowel ::ffff:127.0.0.1 als ::ffff:7f00:1 als IPv6. Alleen de
   eerste tekstvorm controleren laat dezelfde private IPv4-bestemming dus via
   hex-notatie binnen. Normaliseer de acht groepen en haal de laatste 32 bits
   terug voordat de gewone IPv4-classificatie beslist. */
function ipv4Mapped(host) {
  let h = String(host || '').toLowerCase();
  if (net.isIP(h) !== 6) return null;
  const gestippeld = h.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (gestippeld) return gestippeld[1];
  const kanten = h.split('::');
  if (kanten.length > 2) return null;
  const links = kanten[0] ? kanten[0].split(':') : [];
  const rechts = kanten.length === 2 && kanten[1] ? kanten[1].split(':') : [];
  const ontbrekend = 8 - links.length - rechts.length;
  if (ontbrekend < 0 || (kanten.length === 1 && ontbrekend !== 0)) return null;
  const groepen = [...links, ...Array(ontbrekend).fill('0'), ...rechts]
    .map(x => Number.parseInt(x || '0', 16));
  if (groepen.length !== 8 || groepen.some(x => !Number.isInteger(x) || x < 0 || x > 0xffff)) return null;
  if (groepen.slice(0, 5).some(x => x !== 0) || groepen[5] !== 0xffff) return null;
  return [groepen[6] >> 8, groepen[6] & 255, groepen[7] >> 8, groepen[7] & 255].join('.');
}

function openbareHost(host) {
  const kaal = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  const ip = net.isIP(kaal);
  if (ip === 4) return !priveIpv4(kaal);
  if (ip === 6) return !priveIpv6(kaal);
  if (!kaal.includes('.') || kaal.length > 253 || PLAATSHOUDER.test(kaal) ||
      GERESERVEERD_DOMEIN.test(kaal) || VOORBEELD_DOMEIN.test(kaal)) return false;
  return kaal.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function ontleedUrl(waarde, { publiekeProductie = false } = {}) {
  const url = String(waarde || '').trim();
  const m = url.match(/^(turns?):(\[[0-9a-f:.]+\]|[^\s:/?#]+):(\d{1,5})(?:\?transport=(tcp|udp))?$/i);
  if (!m) return { ok:false, reden:'formaat-host-of-poort-ongeldig' };
  const schema = m[1].toLowerCase(), poort = Number(m[3]);
  if (publiekeProductie && schema !== 'turns') return { ok:false, reden:'plaintext-turn-niet-toegestaan' };
  if (publiekeProductie && m[4] && m[4].toLowerCase() !== 'tcp')
    return { ok:false, reden:'onveilig-transport' };
  if (!Number.isInteger(poort) || poort < 1 || poort > 65535) return { ok:false, reden:'poort-ongeldig' };
  const host = m[2].replace(/^\[|\]$/g, '');
  if (net.isIP(host) === 0 && !/^[a-z0-9.-]+$/i.test(host)) return { ok:false, reden:'host-ongeldig' };
  if (publiekeProductie && !openbareHost(host)) return { ok:false, reden:'host-niet-openbaar' };
  return { ok:true, url, schema, host, poort, transport:m[4] ? m[4].toLowerCase() : null };
}

function ontleedLijst(waarde, opties) {
  const bron = String(waarde || '');
  if (!bron.trim()) return { urls:[], fouten:[] };
  const urls = [], fouten = [];
  for (const [index, deel] of bron.split(',').entries()) {
    const tekst = deel.trim();
    if (!tekst) { fouten.push({ index, reden:'lege-url' }); continue; }
    const uit = ontleedUrl(tekst, opties);
    if (!uit.ok) fouten.push({ index, reden:uit.reden });
    else if (!urls.includes(uit.url)) urls.push(uit.url);
  }
  return { urls, fouten };
}

function ontleedStunUrl(waarde, { publiekeProductie = false } = {}) {
  const url = String(waarde || '').trim();
  const m = url.match(/^(stuns?):(\[[0-9a-f:.]+\]|[^\s:/?#]+):(\d{1,5})$/i);
  if (!m) return { ok:false, reden:'formaat-host-of-poort-ongeldig' };
  const schema = m[1].toLowerCase(), poort = Number(m[3]);
  if (!Number.isInteger(poort) || poort < 1 || poort > 65535) return { ok:false, reden:'poort-ongeldig' };
  const host = m[2].replace(/^\[|\]$/g, '');
  if (net.isIP(host) === 0 && !/^[a-z0-9.-]+$/i.test(host)) return { ok:false, reden:'host-ongeldig' };
  if (publiekeProductie && !openbareHost(host)) return { ok:false, reden:'host-niet-openbaar' };
  return { ok:true, url, schema, host, poort };
}

function ontleedStunLijst(waarde, opties) {
  const bron = String(waarde || '');
  if (!bron.trim()) return { urls:[], items:[], fouten:[] };
  const urls = [], items = [], fouten = [];
  for (const [index, deel] of bron.split(',').entries()) {
    const tekst = deel.trim();
    if (!tekst) { fouten.push({ index, reden:'lege-url' }); continue; }
    const uit = ontleedStunUrl(tekst, opties);
    if (!uit.ok) fouten.push({ index, reden:uit.reden });
    else if (!urls.includes(uit.url)) { urls.push(uit.url); items.push(uit); }
  }
  return { urls, items, fouten };
}

function appHost(env) {
  try {
    const u = new URL(String(env.APP_URL || ''));
    return u.hostname || null;
  } catch (e) { return null; }
}

function projecteerStun(env, { publiekeProductie = false, requestHost = null } = {}) {
  const expliciet = String(env.STUN_PUBLIC_HOST || '').trim().replace(/^\[|\]$/g, '');
  const verwacht = expliciet || appHost(env) || (!publiekeProductie ? String(requestHost || '') : '');
  const poort = String(env.STUN_PORT || 3478);
  const hostInUrl = net.isIP(verwacht) === 6 ? '[' + verwacht + ']' : verwacht;
  const bron = String(env.STUN_URL || '').trim() || (verwacht ? 'stun:' + hostInUrl + ':' + poort : '');
  const lijst = ontleedStunLijst(bron, { publiekeProductie });
  if (publiekeProductie) {
    if (!verwacht || !openbareHost(verwacht)) lijst.fouten.push({ index:-1, reden:'eigen-host-ontbreekt-of-is-onveilig' });
    for (const [index, item] of lijst.items.entries()) {
      if (item.host.toLowerCase() !== verwacht.toLowerCase())
        lijst.fouten.push({ index, reden:'host-niet-eigendom' });
    }
  }
  if (!lijst.urls.length || (publiekeProductie && lijst.fouten.length))
    return { urls:null, fouten:lijst.fouten };
  return { urls:lijst.urls, fouten:lijst.fouten };
}

const { sterkGeheim, geldigeGebruiker, credentials, ttlVan, actorLabel, tijdelijk,
  TTL_STANDAARD, TTL_MIN, TTL_MAX } = require('./turn-credential');

/* Een vingerafdruk van de relevante TURN-configuratie. Bewijs (de relayproef)
   geldt alleen zolang deze gelijk blijft: een andere URL-lijst of een ander
   geheim maakt eerder bewijs ongeldig. Het geheim zit er als HMAC in, niet als
   hash van zichzelf. */
function vingerafdruk(env, { publiekeProductie = false } = {}) {
  const lijst = ontleedLijst(env.TURN_URL, { publiekeProductie });
  const auth = credentials(env, { publiekeProductie });
  const sleutel = auth ? (auth.secret || auth.credential) : null;
  const geheim = sleutel ? crypto.createHmac('sha256', sleutel)
    .update('rtg-turn-config-vingerafdruk-v1').digest('hex') : 'geen';
  return crypto.createHash('sha256').update(['rtg-turn-config-v1', [...lijst.urls].sort().join(','),
    auth ? auth.soort : 'geen', geheim, String(ttlVan(env))].join('\0')).digest('hex');
}

function projecteerTurn(env, { publiekeProductie = false, nu = Date.now, actor = null } = {}) {
  const lijst = ontleedLijst(env.TURN_URL, { publiekeProductie });
  const auth = credentials(env, { publiekeProductie });
  if (!lijst.urls.length || !auth || (publiekeProductie && lijst.fouten.length))
    return { server:null, fouten:lijst.fouten };
  if (auth.soort === 'vast') return { server:{ urls:lijst.urls,
    username:auth.username, credential:auth.credential }, fouten:lijst.fouten };
  const c = tijdelijk(auth.secret, { actor, ttl:ttlVan(env), nu });
  return { server:{ urls:lijst.urls, username:c.username, credential:c.credential },
    verloopt:c.verloopt, fouten:lijst.fouten };
}

module.exports = { ontleedUrl, ontleedLijst, ontleedStunUrl, ontleedStunLijst,
  openbareHost, ipv4Mapped, sterkGeheim, geldigeGebruiker, credentials,
  projecteerTurn, projecteerStun, tijdelijk, actorLabel, ttlVan, vingerafdruk,
  TTL_STANDAARD, TTL_MIN, TTL_MAX };
