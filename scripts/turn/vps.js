#!/usr/bin/env node
/* EEN TURN-VPS BIJ HETZNER CLOUD, in een opdracht (docs/turn-server.md par. 2a).

   Draai dit op een machine die api.hetzner.cloud mag bereiken (de Mac mini,
   je laptop) met het token in de omgeving -- nooit als argument:

     HCLOUD_TOKEN=... node scripts/turn/vps.js --domein=turn.<domein> \
       --email=<adres voor Let's Encrypt> --geheim-uit=$HOME/rtg-turn-secret \
       [--locatie=nbg1] [--type=cx22] [--ssh-sleutel=<naam bij Hetzner>] \
       [--beheer-ip=<jouw IPv4>] [--uitvoeren]

   Zonder --uitvoeren is het een DROGE RUN: er gaat niets naar Hetzner, er
   wordt geen geheim gemaakt, en je ziet precies wat er zou gebeuren.

   Wat er met --uitvoeren gebeurt, in deze volgorde:
   1. een openbaar IPv4-adres reserveren (eerst, want de coturn-configuratie
      moet zijn eigen adres kennen voordat de server bestaat);
   2. een vers geheim (256 bit) maken en ALLEEN naar --geheim-uit schrijven (0600);
   3. een firewall: 3478 udp+tcp, 5349/tcp, 49160-49999/udp, 80/tcp (alleen
      voor het certificaat) en SSH alleen vanaf --beheer-ip (zonder: geen SSH);
   4. de server (Ubuntu 24.04) met die firewall, dat adres en de cloud-init
      van scripts/turn/cloudinit.js.
   Daarna drukt hij af wat er nog moet: het DNS-record (scripts/turn/dns.js)
   en de twee regels voor de app-secret. Het geheim wordt nooit afgedrukt.

   Wat dit NIET bewijst: dat het relais werkt. Dat doet pas de relayproef van
   de app (GET /api/rtc/stand) en `npm run turnproef`. */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { maakConfig } = require('./maak-config');
const { bouwCloudInit, zonderGeheim } = require('./cloudinit');

const API = 'https://api.hetzner.cloud/v1';
/* Een primair IP hoort bij een datacenter; de server komt in HETZELFDE datacenter. */
const DATACENTER = Object.freeze({ nbg1: 'nbg1-dc3', fsn1: 'fsn1-dc14', hel1: 'hel1-dc2' });
const WORTEL = path.resolve(__dirname, '..', '..');
const CERT = '/etc/rtg-turn/tls/fullchain.pem', SLEUTEL = '/etc/rtg-turn/tls/privkey.pem';

function args(argv) {
  const o = {};
  for (const a of argv) { const m = a.match(/^--([a-z-]+)(?:=(.*))?$/); if (m) o[m[1]] = m[2] === undefined ? true : m[2]; }
  return o;
}

function firewallRegels(beheerIp) {
  const overal = ['0.0.0.0/0', '::/0'];
  const r = (protocol, port, description) => ({ direction: 'in', protocol, port, source_ips: overal, description });
  const regels = [r('udp', '3478', 'STUN/TURN udp'), r('tcp', '3478', 'STUN/TURN tcp'), r('tcp', '5349', 'TURN over TLS'),
    r('udp', '49160-49999', 'TURN-relaypoorten'), r('tcp', '80', 'alleen voor het Let\'s Encrypt-certificaat')];
  if (beheerIp) regels.push({ direction: 'in', protocol: 'tcp', port: '22', source_ips: [beheerIp + '/32'], description: 'SSH vanaf beheer' });
  return regels;
}

function controleer(o) {
  const fouten = [];
  if (!/^turn\.[a-z0-9.-]+\.[a-z]{2,}$/.test(String(o.domein || ''))) fouten.push('--domein moet turn.<domein> zijn');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(o.email || ''))) fouten.push('--email ontbreekt (Let\'s Encrypt)');
  const uit = String(o['geheim-uit'] || '');
  if (!path.isAbsolute(uit)) fouten.push('--geheim-uit moet een absoluut pad zijn');
  else if (path.resolve(uit).startsWith(WORTEL + path.sep)) fouten.push('--geheim-uit mag niet in de repository liggen');
  else if (o.uitvoeren && fs.existsSync(uit)) fouten.push('--geheim-uit bestaat al; kies een nieuw pad (een geheim wordt niet overschreven)');
  if (o['beheer-ip'] && !/^\d{1,3}(\.\d{1,3}){3}$/.test(o['beheer-ip'])) fouten.push('--beheer-ip moet een IPv4-adres zijn');
  return fouten;
}

async function hetzner(token, methode, pad, lijf) {
  const r = await fetch(API + pad, { method: methode,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: lijf ? JSON.stringify(lijf) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Hetzner ' + methode + ' ' + pad + ': ' + r.status + ' ' + ((d.error && d.error.message) || ''));
  return d;
}

async function main() {
  const o = args(process.argv.slice(2));
  const naam = 'rtg-turn', locatie = o.locatie || 'nbg1', type = o.type || 'cx22';
  const dc = DATACENTER[locatie];
  if (!dc) { console.error('vps: --locatie moet een van ' + Object.keys(DATACENTER).join(', ') + ' zijn'); return 1; }
  const fouten = controleer(o);
  if (fouten.length) { for (const f of fouten) console.error('vps: ' + f); return 1; }
  const compose = fs.readFileSync(path.join(WORTEL, 'docker-compose.turn.yml'), 'utf8');

  if (!o.uitvoeren) {
    const ip = '<adres van Hetzner>';
    const config = maakConfig({ realm: o.domein, 'extern-ip': '8.8.8.8', /* alleen om de vorm te tonen */ geheim: crypto.randomBytes(32).toString('hex') /* weggegooid, nooit getoond */, cert: CERT, sleutel: SLEUTEL });
    console.log('DROGE RUN -- er gaat niets naar Hetzner.\n');
    console.log('server   : ' + naam + ', ' + type + ', ubuntu-24.04, ' + dc);
    console.log('firewall :'); for (const r of firewallRegels(o['beheer-ip'])) console.log('  ' + r.protocol + ' ' + r.port + '  ' + r.description);
    console.log('\ncloud-init (geheim verborgen, voorbeeldadres):\n');
    console.log(zonderGeheim(bouwCloudInit({ domein: o.domein, email: o.email, ip: '8.8.8.8', config, compose }))
      .replace(/8\.8\.8\.8/g, ip));
    console.log('Voer uit met --uitvoeren en HCLOUD_TOKEN in de omgeving.');
    return 0;
  }

  const token = process.env.HCLOUD_TOKEN;
  if (!token) { console.error('vps: HCLOUD_TOKEN ontbreekt in de omgeving (nooit als argument meegeven).'); return 1; }
  const pip = (await hetzner(token, 'POST', '/primary_ips', { name: naam + '-ipv4', type: 'ipv4',
    assignee_type: 'server', datacenter: dc, auto_delete: false })).primary_ip;
  const ip = pip.ip;
  const geheim = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(o['geheim-uit'], geheim + '\n', { mode: 0o600, flag: 'wx' });
  const config = maakConfig({ realm: o.domein, 'extern-ip': ip, geheim, cert: CERT, sleutel: SLEUTEL });
  const fw = (await hetzner(token, 'POST', '/firewalls', { name: naam, rules: firewallRegels(o['beheer-ip']) })).firewall;
  const server = (await hetzner(token, 'POST', '/servers', { name: naam, server_type: type, image: 'ubuntu-24.04',
    datacenter: dc, firewalls: [{ firewall: fw.id }], ssh_keys: o['ssh-sleutel'] ? [o['ssh-sleutel']] : [],
    public_net: { ipv4: pip.id, enable_ipv4: true, enable_ipv6: false },
    user_data: bouwCloudInit({ domein: o.domein, email: o.email, ip, config, compose }) })).server;

  console.log('Aangemaakt: server ' + server.id + ' (' + type + ', ' + dc + '), adres ' + ip + '.');
  console.log('Het geheim staat in ' + o['geheim-uit'] + ' (0600) en is nergens afgedrukt.\n');
  console.log('Nog te doen:');
  console.log('1. DNS: CLOUDFLARE_API_TOKEN=... node scripts/turn/dns.js --naam=' + o.domein + ' --ip=' + ip + ' --uitvoeren');
  console.log('   De host wacht tot dit record er is en haalt dan zelf het certificaat (een paar minuten).');
  console.log('2. In de app-secret (deploy/live.env of rtg.env):');
  console.log('   TURN_URL=turns:' + o.domein + ':5349?transport=tcp,turn:' + o.domein + ':3478?transport=udp');
  console.log('   TURN_SECRET=<de inhoud van ' + o['geheim-uit'] + '>');
  console.log('3. App herstarten; binnen ~4 minuten zegt GET /api/rtc/stand geverifieerd: true.');
  return 0;
}

if (require.main === module) main().then(c => { process.exitCode = c; }, e => { console.error('vps: ' + e.message); process.exitCode = 1; });

module.exports = { firewallRegels, controleer, args };
