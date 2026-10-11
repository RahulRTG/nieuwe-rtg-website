#!/usr/bin/env node
/* Schrijft de productieconfiguratie van coturn voor de aparte TURN-host.

   Waarom een generator en geen ingecheckt bestand: het gedeelde geheim hoort
   uitsluitend in de secretstore van die host, en een sjabloon met een
   plaatshouder is precies wat de productiekeuring van de app weigert. Deze
   generator leest het geheim uit een BESTAND (nooit uit argv, dat in `ps`
   staat), toetst het met dezelfde regels als de app (config/turn.js
   sterkGeheim), en schrijft het resultaat met modus 0600 BUITEN de repository.

   Gebruik op de TURN-host:
     node scripts/turn/maak-config.js \
       --realm=turn.<domein> --extern-ip=<publiek IPv4>[/<privé IPv4 achter NAT>] \
       --geheim-bestand=/etc/rtg-turn/secret \
       --cert=/etc/rtg-turn/tls/fullchain.pem --sleutel=/etc/rtg-turn/tls/privkey.pem \
       --uit=/etc/rtg-turn/turnserver.conf

   Wat de configuratie afdwingt (en waarom):
   - use-auth-secret: alleen kortlevende TURN REST-credentials (HMAC), geen
     vaste gebruikers; zonder geldig credential geen allocatie -> geen open relais;
   - denied-peer-ip over alle private, loopback-, link-local-, CGNAT-, multicast-
     en documentatiebereiken: het relais kan niet als springplank naar het
     interne netwerk of de metadata-dienst van de hoster worden gebruikt;
   - een BEPERKT relaypoortbereik (standaard 49160-49999) dat ook in de firewall staat;
   - quota per credential en totaal, en een bandbreedteplafond per sessie;
   - geen CLI, geen versie in SOFTWARE, geen TLS 1.0/1.1. */
'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const turn = require('../../server/config/turn');

const GEWEIGERDE_PEERS = Object.freeze([
  '0.0.0.0-0.255.255.255', '10.0.0.0-10.255.255.255', '100.64.0.0-100.127.255.255',
  '127.0.0.0-127.255.255.255', '169.254.0.0-169.254.255.255', '172.16.0.0-172.31.255.255',
  '192.0.0.0-192.0.0.255', '192.0.2.0-192.0.2.255', '192.88.99.0-192.88.99.255',
  '192.168.0.0-192.168.255.255', '198.18.0.0-198.19.255.255', '198.51.100.0-198.51.100.255',
  '203.0.113.0-203.0.113.255', '224.0.0.0-255.255.255.255',
  '::1', '::ffff:0.0.0.0-::ffff:255.255.255.255', '64:ff9b::-64:ff9b::ffff:ffff',
  'fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', 'fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
  'ff00::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
]);

function args(argv) {
  const uit = {};
  for (const a of argv) { const m = a.match(/^--([a-z-]+)=(.*)$/); if (m) uit[m[1]] = m[2]; }
  return uit;
}

function fout(t) { const e = new Error(t); e.turnConfig = true; throw e; }

function maakConfig(o) {
  const realm = String(o.realm || '').toLowerCase();
  if (!turn.openbareHost(realm) || net.isIP(realm)) fout('--realm moet de openbare DNS-naam van de TURN-host zijn (bv. turn.<domein>).');
  const [publiek, prive] = String(o['extern-ip'] || '').split('/');
  if (net.isIP(publiek) !== 4 || !turn.openbareHost(publiek)) fout('--extern-ip moet een openbaar IPv4-adres zijn.');
  if (prive && net.isIP(prive) !== 4) fout('Het privé-adres achter --extern-ip/ moet IPv4 zijn.');
  const geheim = String(o.geheim || '').trim();
  if (!turn.sterkGeheim(geheim)) fout('Het TURN-geheim is te zwak of een plaatshouder (minstens 32 willekeurige tekens).');
  if (/[\r\n]/.test(geheim)) fout('Het TURN-geheim mag geen regeleinde bevatten.');
  const min = Number(o['min-poort'] || 49160), max = Number(o['max-poort'] || 49999);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1024 || max > 65535 || max - min < 100 || max - min > 16000)
    fout('Het relaypoortbereik moet een beperkt bereik boven 1024 zijn (100-16000 poorten).');
  for (const k of ['cert', 'sleutel']) if (!path.isAbsolute(String(o[k] || ''))) fout('--' + k + ' moet een absoluut pad zijn.');
  const tlsPoort = Number(o['tls-poort'] || 5349);
  const regels = [
    '# Gegenereerd door scripts/turn/maak-config.js -- niet met de hand wijzigen.',
    '# Bevat een geheim: modus 0600, nooit in een repository of ticket.',
    'listening-port=3478',
    'tls-listening-port=' + tlsPoort,
    ...(prive ? ['listening-ip=' + prive, 'relay-ip=' + prive, 'external-ip=' + publiek + '/' + prive]
      : ['listening-ip=' + publiek, 'relay-ip=' + publiek, 'external-ip=' + publiek]),
    'min-port=' + min,
    'max-port=' + max,
    'realm=' + realm,
    'server-name=' + realm,
    'fingerprint',
    'use-auth-secret',
    'static-auth-secret=' + geheim,
    'stale-nonce=600',
    'cert=' + o.cert,
    'pkey=' + o.sleutel,
    'no-tlsv1',
    'no-tlsv1_1',
    'no-cli',
    'no-software-attribute',
    'no-multicast-peers',
    'no-rfc5780',
    ...GEWEIGERDE_PEERS.map(r => 'denied-peer-ip=' + r),
    'user-quota=' + Number(o['user-quota'] || 12),
    'total-quota=' + Number(o['total-quota'] || 2000),
    'max-bps=' + Number(o['max-bps'] || 500000),
    'bps-capacity=' + Number(o['bps-capacity'] || 0),
    'max-allocate-lifetime=3600',
    'log-file=stdout',
    'simple-log',
    ''
  ];
  return regels.join('\n');
}

if (require.main === module) {
  try {
    const o = args(process.argv.slice(2));
    if (!o['geheim-bestand']) fout('--geheim-bestand ontbreekt (het geheim gaat nooit via de opdrachtregel).');
    o.geheim = fs.readFileSync(o['geheim-bestand'], 'utf8');
    const tekst = maakConfig(o);
    if (!o.uit) fout('--uit ontbreekt.');
    const doel = path.resolve(o.uit);
    if (doel.startsWith(path.resolve(__dirname, '..', '..') + path.sep)) fout('--uit mag niet binnen de repository liggen.');
    fs.writeFileSync(doel, tekst, { mode: 0o600 });
    fs.chmodSync(doel, 0o600);
    process.stdout.write('coturn-configuratie geschreven naar ' + doel + ' (0600). Het geheim is niet afgedrukt.\n');
  } catch (e) {
    process.stderr.write('maak-config: ' + (e.turnConfig ? e.message : 'mislukt: ' + (e.code || 'onbekend')) + '\n');
    process.exit(1);
  }
}

module.exports = { maakConfig, GEWEIGERDE_PEERS };
