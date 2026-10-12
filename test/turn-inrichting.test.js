/* De inrichting van de TURN-host: de VPS-route (scripts/turn/vps.js +
   cloudinit.js), het DNS-record (scripts/turn/dns.js) en de Mac mini-route
   (scripts/mac/turn.sh). Geen netwerk: wat hier bewezen wordt is de VORM --
   welke poorten, welke rechten, dat het geheim nergens wordt afgedrukt, en dat
   een geproxied DNS-record nooit blijft staan. Dat het relais werkt bewijst
   alleen de relayproef (test/rtc-relay.test.js, GET /api/rtc/stand). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { maakConfig } = require('../scripts/turn/maak-config');
const { bouwCloudInit, zonderGeheim } = require('../scripts/turn/cloudinit');
const { firewallRegels, controleer } = require('../scripts/turn/vps');
const { plan, zoneVan } = require('../scripts/turn/dns');

const WORTEL = path.join(__dirname, '..');
const DOMEIN = 'turn.rahultravelgroup.com', IP = '8.8.4.4';
const GEHEIM = crypto.randomBytes(32).toString('hex');
const compose = fs.readFileSync(path.join(WORTEL, 'docker-compose.turn.yml'), 'utf8');
const config = maakConfig({ realm: DOMEIN, 'extern-ip': IP, geheim: GEHEIM,
  cert: '/etc/rtg-turn/tls/fullchain.pem', sleutel: '/etc/rtg-turn/tls/privkey.pem' });

test('cloud-init draagt de configuratie ongeschonden, leesbaar voor coturn en voor niemand anders', () => {
  const ci = bouwCloudInit({ domein: DOMEIN, email: 'beheer@rahultravelgroup.com', ip: IP, config, compose });
  assert.match(ci, /^#cloud-config\n/);
  // elke regel van de configuratie staat er, zes spaties ingesprongen (YAML-blok)
  for (const regel of config.trim().split('\n')) assert.ok(ci.includes('\n      ' + regel + '\n'), regel);
  const blok = ci.slice(ci.indexOf('/etc/rtg-turn/turnserver.conf'), ci.indexOf('/opt/rtg-turn/'));
  assert.match(blok, /permissions: "0640"/);
  assert.match(blok, /owner: root:nogroup/, 'de coturn-image draait als nobody:nogroup');
  // de host wacht op DNS naar ZIJN adres voordat hij een certificaat vraagt
  const wacht = ci.indexOf(IP + '\\" ] && break'), cert = ci.indexOf('certbot, certonly');
  assert.ok(wacht > 0 && cert > wacht, 'eerst DNS, dan het certificaat');
  assert.ok(ci.indexOf('docker, compose') > cert, 'coturn start na het certificaat');
  assert.match(ci, /kill -s SIGUSR2 turn/, 'een vernieuwd certificaat wordt herladen');
  assert.ok(ci.includes(GEHEIM), 'het geheim zit in de user-data (en dat staat in de kop van cloudinit.js)');
  assert.equal(zonderGeheim(ci).includes(GEHEIM), false, 'maar nooit in wat er wordt afgedrukt');
  assert.throws(() => bouwCloudInit({ domein: DOMEIN, email: 'x', ip: IP, config, compose }), /e-mail/);
  assert.throws(() => bouwCloudInit({ domein: DOMEIN, email: 'a@b.nl', ip: IP, config: 'leeg', compose }), /coturn-config/);
});

test('de firewall van de VPS: precies de relaypoorten, en SSH alleen vanaf beheer', () => {
  const sleutel = r => r.protocol + ' ' + r.port;
  assert.deepEqual(firewallRegels().map(sleutel), ['udp 3478', 'tcp 3478', 'tcp 5349', 'udp 49160-49999', 'tcp 80']);
  const metBeheer = firewallRegels('203.0.113.7');
  assert.deepEqual(metBeheer.at(-1), { direction: 'in', protocol: 'tcp', port: '22', source_ips: ['203.0.113.7/32'],
    description: 'SSH vanaf beheer' });
  assert.equal(firewallRegels().some(r => r.port === '22'), false, 'zonder beheer-ip geen SSH van buiten');
  // het relaypoortbereik in de firewall is hetzelfde als in de configuratie
  assert.match(config, /^min-port=49160$/m); assert.match(config, /^max-port=49999$/m);
});

test('vps.js weigert een geheim in de repository, een relatief pad en een ongeldig domein', () => {
  const goed = { domein: DOMEIN, email: 'a@b.nl', 'geheim-uit': '/root/rtg-turn-secret' };
  assert.deepEqual(controleer(goed), []);
  assert.ok(controleer({ ...goed, 'geheim-uit': path.join(WORTEL, 'secret') }).some(f => /repository/.test(f)));
  assert.ok(controleer({ ...goed, 'geheim-uit': 'secret' }).some(f => /absoluut/.test(f)));
  assert.ok(controleer({ ...goed, domein: 'rahultravelgroup.com' }).some(f => /turn\./.test(f)));
});

test('de droge run van vps.js raakt geen netwerk en drukt geen geheim af', () => {
  const r = spawnSync(process.execPath, ['scripts/turn/vps.js', '--domein=' + DOMEIN, '--email=a@b.nl',
    '--geheim-uit=/root/rtg-turn-secret'], { cwd: WORTEL, encoding: 'utf8',
    env: { ...process.env, HCLOUD_TOKEN: '', HTTPS_PROXY: 'http://127.0.0.1:9', https_proxy: 'http://127.0.0.1:9' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /DROGE RUN/);
  // de enige 64-hex die er mag staan is de vastgepinde image-digest van coturn
  assert.doesNotMatch(r.stdout.replace(/sha256:[a-f0-9]{64}/g, ''), /[a-f0-9]{64}/, 'geen geheim in de uitvoer');
  assert.match(r.stdout, /static-auth-secret=<verborgen>/);
  const zonder = spawnSync(process.execPath, ['scripts/turn/vps.js', '--domein=' + DOMEIN, '--email=a@b.nl',
    '--geheim-uit=/root/rtg-turn-secret-x', '--uitvoeren'], { cwd: WORTEL, encoding: 'utf8', env: { ...process.env, HCLOUD_TOKEN: '' } });
  assert.equal(zonder.status, 1);
  assert.match(zonder.stderr, /HCLOUD_TOKEN ontbreekt/);
});

test('DNS: een geproxied of verkeerd record wordt rechtgezet, nooit stil gelaten', () => {
  assert.equal(zoneVan(DOMEIN), 'rahultravelgroup.com');
  assert.equal(plan([], DOMEIN, IP).actie, 'maak');
  assert.equal(plan([], DOMEIN, IP).doel.proxied, false, 'TURN gaat niet door de Cloudflare-proxy');
  assert.equal(plan([{ id: 'a', content: IP, proxied: false }], DOMEIN, IP).actie, 'niets');
  const proxy = plan([{ id: 'a', content: IP, proxied: true }], DOMEIN, IP);
  assert.equal(proxy.actie, 'wijzig'); assert.match(proxy.uitleg, /proxy UIT/); assert.equal(proxy.doel.proxied, false);
  assert.match(plan([{ id: 'a', content: '1.1.1.1', proxied: false }], DOMEIN, IP).uitleg, /adres 1\.1\.1\.1 -> /);
  assert.equal(plan([{ id: 'a' }, { id: 'b' }], DOMEIN, IP).actie, 'weiger');
});

test('scripts/mac/turn.sh: geldige bash, weigert zonder domein, en schrijft het geheim nooit naar de uitvoer', () => {
  const sh = path.join(WORTEL, 'scripts/mac/turn.sh');
  assert.equal(spawnSync('bash', ['-n', sh]).status, 0);
  const r = spawnSync('bash', [sh], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /--domein=turn\./);
  const bron = fs.readFileSync(sh, 'utf8');
  assert.doesNotMatch(bron, /(cat|echo|zeg)[^\n]*\$MAP\/secret\)/, 'het geheim wordt nooit afgedrukt');
  assert.match(bron, /CGNAT/, 'achter CGNAT stopt het script in plaats van een relais te beloven');
  assert.match(bron, /<string>nobody<\/string>/, 'coturn draait niet als root');
  assert.match(bron, /maak-config\.js/, 'dezelfde generator als de VPS-route');
});
