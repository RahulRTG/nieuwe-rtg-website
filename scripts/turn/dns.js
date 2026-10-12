#!/usr/bin/env node
/* HET DNS-RECORD turn.<domein> BIJ CLOUDFLARE (docs/turn-server.md par. 2a/2b).

     CLOUDFLARE_API_TOKEN=... node scripts/turn/dns.js --naam=turn.<domein> \
       --ip=<openbaar IPv4 van het relais> [--uitvoeren]

   Het token heeft alleen "Zone - DNS - Edit" nodig op die ene zone, en komt
   uit de omgeving (nooit uit argv). Zonder --uitvoeren: droge run, alleen lezen.

   EEN HARDE REGEL: het record is "DNS only" (proxied: false). De oranje wolk
   van Cloudflare proxyt alleen HTTP(S); STUN, TURN en de relaypoorten komen
   er niet doorheen, en de relayproef zou dan terecht dicht blijven. Een
   bestaand record dat WEL geproxied staat wordt daarom omgezet, en dat staat
   in de uitvoer -- nooit stil. Een record dat naar een ander adres wijst wordt
   alleen met --uitvoeren overschreven, en ook dat wordt gemeld. */
'use strict';

const API = 'https://api.cloudflare.com/client/v4';

function args(argv) {
  const o = {};
  for (const a of argv) { const m = a.match(/^--([a-z-]+)(?:=(.*))?$/); if (m) o[m[1]] = m[2] === undefined ? true : m[2]; }
  return o;
}

/* De zone van een naam: de laatste twee labels (rahultravelgroup.com). Een
   tweedelige publieke suffix (co.uk) wordt hier niet geraden maar via
   --zone opgegeven. */
const zoneVan = (naam, zone) => zone || String(naam).split('.').slice(-2).join('.');

/* Wat moet er gebeuren, gegeven de bestaande A-records. Zuiver, dus te toetsen. */
function plan(bestaand, naam, ip) {
  const doel = { type: 'A', name: naam, content: ip, ttl: 300, proxied: false };
  if (!bestaand.length) return { actie: 'maak', doel, uitleg: 'nieuw A-record ' + naam + ' -> ' + ip + ' (DNS only)' };
  if (bestaand.length > 1) return { actie: 'weiger', uitleg: 'er staan ' + bestaand.length + ' A-records voor ' + naam + '; ruim die eerst met de hand op' };
  const r = bestaand[0];
  if (r.content === ip && r.proxied === false) return { actie: 'niets', uitleg: naam + ' wijst al naar ' + ip + ' (DNS only)' };
  const waarom = [];
  if (r.content !== ip) waarom.push('adres ' + r.content + ' -> ' + ip);
  if (r.proxied !== false) waarom.push('proxy UIT (TURN gaat niet door de Cloudflare-proxy)');
  return { actie: 'wijzig', id: r.id, doel, uitleg: 'bestaand record aanpassen: ' + waarom.join(', ') };
}

async function cf(token, methode, pad, lijf) {
  const r = await fetch(API + pad, { method: methode,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: lijf ? JSON.stringify(lijf) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false)
    throw new Error('Cloudflare ' + methode + ' ' + pad.split('?')[0] + ': ' + r.status + ' ' + ((d.errors || []).map(e => e.message).join('; ')));
  return d.result;
}

async function main() {
  const o = args(process.argv.slice(2));
  const naam = String(o.naam || '').toLowerCase(), ip = String(o.ip || '');
  if (!/^turn\.[a-z0-9.-]+\.[a-z]{2,}$/.test(naam)) { console.error('dns: --naam moet turn.<domein> zijn'); return 1; }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { console.error('dns: --ip moet een IPv4-adres zijn'); return 1; }
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) { console.error('dns: CLOUDFLARE_API_TOKEN ontbreekt in de omgeving (nooit als argument meegeven).'); return 1; }
  const zone = zoneVan(naam, o.zone);
  const zones = await cf(token, 'GET', '/zones?name=' + encodeURIComponent(zone));
  if (!zones.length) { console.error('dns: zone ' + zone + ' niet gevonden met dit token'); return 1; }
  const zid = zones[0].id;
  const bestaand = await cf(token, 'GET', '/zones/' + zid + '/dns_records?type=A&name=' + encodeURIComponent(naam));
  const p = plan(bestaand, naam, ip);
  console.log((o.uitvoeren ? '' : 'DROGE RUN -- ') + p.uitleg);
  if (p.actie === 'weiger') return 1;
  if (!o.uitvoeren || p.actie === 'niets') return 0;
  if (p.actie === 'maak') await cf(token, 'POST', '/zones/' + zid + '/dns_records', p.doel);
  else await cf(token, 'PUT', '/zones/' + zid + '/dns_records/' + p.id, p.doel);
  console.log('Klaar. Het kan een paar minuten duren voor de naam overal zo resolvet.');
  return 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }, e => { console.error('dns: ' + e.message); process.exitCode = 1; });

module.exports = { plan, zoneVan, args };
