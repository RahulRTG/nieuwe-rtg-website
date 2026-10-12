/* Een voorstelling van de TURN-configuratie voor productiekeuring en runtime.
   De browser mag nooit een lossere lijst krijgen dan de startpoort heeft
   gekeurd. Daarom delen beide paden deze parser en credentialcontrole. */
'use strict';

const net = require('node:net');
const crypto = require('node:crypto');

const { ipv4Mapped, openbareHost } = require('./turn-adres');

function ontleedUrl(waarde, { publiekeProductie = false } = {}) {
  const url = String(waarde || '').trim();
  const m = url.match(/^(turns?):(\[[0-9a-f:.]+\]|[^\s:/?#]+):(\d{1,5})(?:\?transport=(tcp|udp))?$/i);
  if (!m) return { ok:false, reden:'formaat-host-of-poort-ongeldig' };
  const schema = m[1].toLowerCase(), poort = Number(m[3]);
  /* Publieke productie (besluit eigenaar, 6 oktober 2026): `turns:` over TCP,
     en daarnaast `turn:` UITSLUITEND met expliciet ?transport=udp. Media blijft
     DTLS-SRTP-versleuteld en de TURN-berichten dragen een HMAC; UDP geeft
     betere gesprekskwaliteit. Een kale `turn:` (de browser probeert dan ook
     TCP zonder TLS) en `turns:` over UDP blijven geweigerd. */
  const transport = m[4] ? m[4].toLowerCase() : null;
  if (publiekeProductie && schema === 'turn' && transport !== 'udp')
    return { ok:false, reden:'plaintext-turn-niet-toegestaan' };
  if (publiekeProductie && schema === 'turns' && transport && transport !== 'tcp')
    return { ok:false, reden:'onveilig-transport' };
  if (!Number.isInteger(poort) || poort < 1 || poort > 65535) return { ok:false, reden:'poort-ongeldig' };
  const host = m[2].replace(/^\[|\]$/g, '');
  if (net.isIP(host) === 0 && !/^[a-z0-9.-]+$/i.test(host)) return { ok:false, reden:'host-ongeldig' };
  if (publiekeProductie && !openbareHost(host)) return { ok:false, reden:'host-niet-openbaar' };
  return { ok:true, url, schema, host, poort, transport:m[4] ? m[4].toLowerCase() : null };
}

/* Een lijst moet in publieke productie minstens EEN turns:-adres dragen: UDP
   komt niet door elke bedrijfsfirewall, TLS over TCP vrijwel altijd. */
function ontleedLijst(waarde, opties) {
  const uit = ontleedLijstKaal(waarde, opties);
  if (opties && opties.publiekeProductie && uit.urls.length && !uit.urls.some(u => /^turns:/i.test(u)))
    uit.fouten.push({ index:-1, reden:'turns-adres-ontbreekt' });
  return uit;
}

function ontleedLijstKaal(waarde, opties) {
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
