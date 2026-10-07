/* Een ECHTE coturn voor de RTC-toetsen (test/rtc-relay.test.js en
   test/rtc-relay.e2e.js). Geen nagemaakte TURN-server: de toetsen moeten
   kunnen zakken op wat coturn werkelijk doet.

   Ontbreekt het pakket, dan GOOIT dit bestand in CI (daar hoort coturn
   geïnstalleerd te zijn, zie .github/workflows/ci.yml) en geeft het lokaal een
   skip-reden terug -- nooit stil. */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { vrijePoortReeks } = require('../helper');
const relayproef = require('../../server/kern/rtc/relayproef');
const turn = require('../../server/config/turn');

const HEEFT_COTURN = spawnSync('turnserver', ['--version'], { encoding: 'utf8' }).status === 0;
if (!HEEFT_COTURN && process.env.CI) throw new Error('coturn (turnserver) ontbreekt in CI; installeer het pakket coturn');
const opts = HEEFT_COTURN ? {} : { skip: 'coturn (turnserver) is op deze machine niet geïnstalleerd' };

function maakCert(TMP) {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(TMP, 'key.pem'),
    '-out', path.join(TMP, 'cert.pem'), '-days', '1', '-subj', '/CN=turn.rtg-proef.lokaal',
    '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  return fs.readFileSync(path.join(TMP, 'cert.pem'));
}

async function startCoturn(TMP, geheim) {
  const [poort] = await vrijePoortReeks(1), [tls] = await vrijePoortReeks(1);
  const relay = await vrijePoortReeks(40);
  const conf = path.join(TMP, 'turn-' + poort + '.conf');
  /* TOETSCONFIG, geen productieconfig: loopback mag hier als peer, want beide
     proefkanten zitten op deze machine. De productieconfig (maak-config.js)
     verbiedt juist dat, en test/rtc-relay.test.js bewijst die weigering. */
  fs.writeFileSync(conf, ['listening-ip=127.0.0.1', 'relay-ip=127.0.0.1', 'listening-port=' + poort,
    'tls-listening-port=' + tls, 'min-port=' + relay[0], 'max-port=' + relay[relay.length - 1],
    'realm=turn.rtg-proef.lokaal', 'use-auth-secret', 'static-auth-secret=' + geheim, 'fingerprint',
    'cert=' + path.join(TMP, 'cert.pem'), 'pkey=' + path.join(TMP, 'key.pem'), 'no-cli', 'allow-loopback-peers',
    'no-multicast-peers', 'userdb=' + path.join(TMP, 'turndb-' + poort), 'log-file=stdout', 'simple-log', ''].join('\n'));
  const kind = spawn('turnserver', ['-c', conf], { stdio: ['ignore', 'pipe', 'pipe'] });
  kind.stdout.resume(); kind.stderr.resume();
  const env = { TURN_URL: 'turn:127.0.0.1:' + poort + '?transport=udp', TURN_SECRET: geheim };
  for (let i = 0; i < 50; i++) {
    const u = await relayproef.proefUrl(turn.ontleedUrl(env.TURN_URL), () => turn.projecteerTurn(env).server, { timeoutMs: 800 });
    if (u.ok) return { kind, poort, tls };
    await new Promise(r => setTimeout(r, 100));
  }
  kind.kill('SIGKILL');
  throw new Error('coturn kwam niet op');
}

const nieuwGeheim = () => crypto.randomBytes(32).toString('hex');

module.exports = { HEEFT_COTURN, opts, maakCert, startCoturn, nieuwGeheim };
