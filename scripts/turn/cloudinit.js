/* De cloud-init voor een TURN-VPS (docs/turn-server.md par. 2a).

   Een ZUIVERE functie: krijgt de al gegenereerde coturn-configuratie
   (scripts/turn/maak-config.js) en de compose-file, en geeft het #cloud-config
   dat de nieuwe host bij zijn eerste start uitvoert:

   1. docker en certbot installeren;
   2. de configuratie (0640, groep nogroup: de coturn-image draait als
      nobody) en de compose-file neerzetten;
   3. WACHTEN tot turn.<domein> in de DNS naar het eigen adres wijst -- een
      certificaat aanvragen voor een naam die nog nergens heen wijst mislukt,
      en dan start coturn zonder TLS (turns: kan dan niet slagen, dus de
      relayproef blijft dicht: fail-closed, maar wel een onnodige ronde);
   4. een certificaat halen (HTTP-01 op poort 80, alleen daarvoor open) en
      bij elke vernieuwing coturn met SIGUSR2 de nieuwe TLS laten lezen;
   5. coturn starten.

   Het geheim staat IN de configuratie en dus in de user-data van de hoster.
   Dat staat er hardop: de hoster kan het lezen (hij kan ook de schijf lezen),
   en de metadata-dienst (169.254.169.254) is alleen vanaf de host zelf
   bereikbaar -- het relais weigert dat bereik als peer (denied-peer-ip). Wie
   dat niet wil, roteert na de eerste start (docs/turn-server.md par. 3). */
'use strict';

const yaml = s => JSON.stringify(String(s)); // een JSON-string is geldige YAML
const inspring = (tekst, n) => String(tekst).split('\n').map(r => ' '.repeat(n) + r).join('\n');

function bouwCloudInit({ domein, email, ip, config, compose }) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(String(domein || ''))) throw new Error('cloudinit: domein ongeldig');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(email || ''))) throw new Error('cloudinit: e-mail voor ACME ongeldig');
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || ''))) throw new Error('cloudinit: IPv4 ongeldig');
  if (!/use-auth-secret/.test(config) || !/static-auth-secret=/.test(config)) throw new Error('cloudinit: geen coturn-config');
  const herlaad = '#!/bin/sh\nset -e\ninstall -m 0644 /etc/letsencrypt/live/' + domein + '/fullchain.pem /etc/rtg-turn/tls/fullchain.pem\n' +
    'install -m 0640 -g 65534 /etc/letsencrypt/live/' + domein + '/privkey.pem /etc/rtg-turn/tls/privkey.pem\n' +
    'docker compose -f /opt/rtg-turn/docker-compose.turn.yml kill -s SIGUSR2 turn 2>/dev/null || true\n';
  const wachtDns = 'for i in $(seq 1 360); do [ "$(getent ahostsv4 ' + domein + " | awk 'NR==1{print $1}')\" = \"" + ip +
    '" ] && break; sleep 10; done';
  return [
    '#cloud-config',
    'package_update: true',
    'packages: [docker.io, docker-compose-v2, certbot, ufw]',
    'write_files:',
    '  - path: /etc/rtg-turn/turnserver.conf',
    '    permissions: "0640"',
    '    owner: root:nogroup',
    '    content: |',
    inspring(config.replace(/\n+$/, ''), 6),
    '  - path: /opt/rtg-turn/docker-compose.turn.yml',
    '    permissions: "0644"',
    '    content: |',
    inspring(compose.replace(/\n+$/, ''), 6),
    '  - path: /etc/letsencrypt/renewal-hooks/deploy/rtg-turn.sh',
    '    permissions: "0755"',
    '    content: |',
    inspring(herlaad.replace(/\n+$/, ''), 6),
    'runcmd:',
    // tweede laag naast de firewall van de hoster: hetzelfde, op de host zelf
    '  - [sh, -c, "ufw default deny incoming && ufw allow 3478 && ufw allow 5349/tcp && ufw allow 49160:49999/udp && ufw allow 80/tcp && ufw allow 22/tcp && ufw --force enable"]',
    '  - [install, -d, -m, "0750", -g, "65534", /etc/rtg-turn/tls]',
    // coturn draait in de image als nobody:nogroup (65534): alleen die groep leest mee
    '  - [chown, "root:65534", /etc/rtg-turn/turnserver.conf]',
    '  - [sh, -c, ' + yaml(wachtDns) + ']',
    '  - [certbot, certonly, --standalone, --non-interactive, --agree-tos, -m, ' + yaml(email) + ', -d, ' + yaml(domein) + ']',
    '  - [sh, /etc/letsencrypt/renewal-hooks/deploy/rtg-turn.sh]',
    '  - [docker, compose, -f, /opt/rtg-turn/docker-compose.turn.yml, up, -d]',
    ''
  ].join('\n');
}

/* Voor een droge run en voor logs: het geheim eruit, de rest zichtbaar. */
const zonderGeheim = tekst => String(tekst).replace(/static-auth-secret=\S+/g, 'static-auth-secret=<verborgen>');

module.exports = { bouwCloudInit, zonderGeheim };
