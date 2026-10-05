/* Payroll OS: EEN BRON KEUREN EN OPHALEN -- een plek, twee lezers.

   ./dekking-bronnen.js keurt een adres bij het REGISTREREN, ./bijwerken.js keurt
   het opnieuw bij het OPHALEN (een bron van voor deze regel kan al in de opslag
   staan). Twee kopieen van de keuring zouden uiteenlopen; daarom staat hij hier.

   Wat de herkeuring van RTG-V1-RELEASE C5 vond, en wat hier dus dichtzit:
   - ../ssrf.js veiligeExternalUrl keurt de VORM van de host. Een naam van EEN
     label (`redis`, `motor`, `postgres` uit docker-compose) is geen IP-literal
     en geen 'localhost', en kwam erdoor: de server riep zo zijn eigen diensten
     aan. Een loonbron is een publiek domein, dus er hoort een punt in te staan.
   - Een afsluitende punt ('localhost.', 'metadata.google.internal.') omzeilde de
     naamlijst. Die halen we eraf voordat er gekeurd wordt.
   - AbortSignal.timeout() inline aangemaakt wordt niet vastgehouden en hield het
     LEZEN van de body niet vast. Hier een eigen controller met een timer die we
     vasthouden tot het lijf binnen is.
   - Geen bovengrens op de grootte; ../../sso/haal.js had die wel. Nu MAX_BYTES.
   DNS-rebinding blijft buiten dit bestand: ../ssrf.js legt vast dat dat achter
   een egress-proxy hoort (ONBEPAALD_INFRA in ISOLATIEPROEF.json). */
'use strict';
const { veiligeExternalUrl } = require('../ssrf');

const TIJDSLIMIET_MS = 10000;
const MAX_BYTES = 2 * 1024 * 1024;
const NIET_PUBLIEK = new Set(['internal', 'local', 'localhost', 'localdomain', 'lan', 'home', 'corp', 'intranet', 'arpa']);

/* null als het adres mag, anders de reden in woorden. */
function keurBronUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return 'geen leesbaar adres'; }
  if (u.protocol !== 'https:') return 'alleen https';
  const host = u.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (!host.includes('.') && !host.includes(':')) return 'een naam zonder domein wijst naar het eigen netwerk';
  /* Een punt maakt een naam nog geen publiek domein: in de eigen compose-uitrol
     heten de diensten ook `redis.rtg_data` (de tweede herkeuring van C5). Het
     topdomein moet er dus uitzien als een publiek topdomein, en een paar bekende
     interne achtervoegsels tellen niet. */
  const top = host.split('.').pop();
  if (!host.includes(':') && !/^\d+$/.test(top) &&
    (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(top) || NIET_PUBLIEK.has(top)))
    return 'geen publiek topdomein: dit wijst naar een eigen netwerk';
  u.hostname = host;
  const keur = veiligeExternalUrl(u.toString());
  return keur.ok ? null : keur.reden;
}

/* Het LEZEN reageert zelf op het afbreeksignaal: zo hangt de tijdslimiet niet
   af van hoe een fetch-implementatie het signaal aan de stroom doorgeeft. */
async function leesBegrensd(r, signaal) {
  if (!r.body || typeof r.body.getReader !== 'function') return r.json(); // een nagebootst antwoord zonder stroom
  const lezer = r.body.getReader(), delen = [];
  const afgebroken = new Promise((_, nee) => {
    if (signaal.aborted) nee(signaal.reason);
    signaal.addEventListener('abort', () => nee(signaal.reason), { once: true });
  });
  afgebroken.catch(() => {});   // een timer die na het lezen afgaat, is geen onafgehandelde fout
  let lengte = 0;
  for (;;) {
    let stap;
    try { stap = await Promise.race([lezer.read(), afgebroken]); }
    catch (e) { try { await lezer.cancel(); } catch (x) { /* weg is weg */ } throw e; }
    const { done, value } = stap;
    if (done) break;
    lengte += value.length;
    if (lengte > MAX_BYTES) { try { await lezer.cancel(); } catch (e) { /* weg is weg */ } throw new Error('bron stuurde meer dan ' + MAX_BYTES + ' bytes'); }
    delen.push(value);
  }
  /* Een BOM vooraan las r.json() gewoon weg; Buffer.toString laat hem staan. */
  return JSON.parse(Buffer.concat(delen.map((d) => Buffer.from(d))).toString('utf8').replace(/^\uFEFF/, ''));
}

async function haalBron(url, haalOp, limietMs) {
  const reden = keurBronUrl(url);
  if (reden) throw new Error('bron geweigerd: ' + reden);
  const ms = limietMs || TIJDSLIMIET_MS;
  const controle = new AbortController();
  const wekker = setTimeout(() => controle.abort(new Error('bron antwoordde niet binnen ' + ms + ' ms')), ms);
  try {
    const r = await haalOp(url, { headers: { accept: 'application/json' }, redirect: 'error', signal: controle.signal });
    if (!r.ok) throw new Error('bron gaf status ' + r.status);
    return await leesBegrensd(r, controle.signal);
  } finally { clearTimeout(wekker); }
}

module.exports = { keurBronUrl, haalBron, TIJDSLIMIET_MS, MAX_BYTES };
