/* De coturn-generator (scripts/turn/maak-config.js), alle weigeringen en
   standaardwaarden: een IP als realm, een privé-adres achter NAT, een geheim
   met regeleinde, een relatief certificaatpad, de quota en poorten die je kunt
   meegeven, en de opdrachtregel zelf (geheim alleen uit een bestand, nooit
   binnen de repository schrijven, modus 0600). De opdrachtregel draait in een
   kindproces en schrijft alleen in een tijdelijke map. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { maakConfig, GEWEIGERDE_PEERS } = require('../scripts/turn/maak-config');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'turn', 'maak-config.js');
const GEHEIM = crypto.randomBytes(32).toString('hex');
const BASIS = { realm: 'TURN.rtg-proef.nl', 'extern-ip': '8.8.8.8', geheim: GEHEIM, cert: '/c.pem', sleutel: '/k.pem' };
const regel = (tekst, sleutel) => (tekst.split('\n').find(r => r.startsWith(sleutel + '=')) || '').slice(sleutel.length + 1);
const weigert = (o, patroon) => assert.throws(() => maakConfig(o), e => e.turnConfig === true && patroon.test(e.message));

test('standaardwaarden: realm in kleine letters, eigen IP als luister- en relayadres, vaste quota', () => {
  const t = maakConfig(BASIS);
  assert.equal(regel(t, 'realm'), 'turn.rtg-proef.nl');
  assert.equal(regel(t, 'listening-ip'), '8.8.8.8');
  assert.equal(regel(t, 'external-ip'), '8.8.8.8');
  assert.equal(regel(t, 'tls-listening-port'), '5349');
  assert.equal(regel(t, 'min-port'), '49160');
  assert.equal(regel(t, 'max-port'), '49999');
  assert.equal(regel(t, 'user-quota'), '12');
  assert.equal(regel(t, 'total-quota'), '2000');
  assert.equal(regel(t, 'max-bps'), '500000');
  assert.equal(regel(t, 'bps-capacity'), '0');
  assert.equal(t.split('\n').filter(r => r.startsWith('denied-peer-ip=')).length, GEWEIGERDE_PEERS.length);
  assert.ok(t.endsWith('\n'));
});

test('achter NAT: het privé-adres luistert, extern-ip draagt beide; eigen poorten en quota tellen', () => {
  const t = maakConfig({ ...BASIS, 'extern-ip': '8.8.8.8/10.0.0.5', 'min-poort': '50000', 'max-poort': '50200', 'tls-poort': '443',
    'user-quota': '3', 'total-quota': '30', 'max-bps': '1000', 'bps-capacity': '9' });
  assert.equal(regel(t, 'listening-ip'), '10.0.0.5');
  assert.equal(regel(t, 'relay-ip'), '10.0.0.5');
  assert.equal(regel(t, 'external-ip'), '8.8.8.8/10.0.0.5');
  assert.equal(regel(t, 'min-port'), '50000');
  assert.equal(regel(t, 'max-port'), '50200');
  assert.equal(regel(t, 'tls-listening-port'), '443');
  assert.equal(regel(t, 'user-quota'), '3');
  assert.equal(regel(t, 'total-quota'), '30');
  assert.equal(regel(t, 'max-bps'), '1000');
  assert.equal(regel(t, 'bps-capacity'), '9');
});

test('weigeringen: realm, extern IP, privé-adres, geheim, poortbereik en paden', () => {
  weigert({ ...BASIS, realm: undefined }, /--realm/);
  weigert({ ...BASIS, realm: '8.8.4.4' }, /--realm/);
  weigert({ ...BASIS, 'extern-ip': undefined }, /--extern-ip/);
  weigert({ ...BASIS, 'extern-ip': '2001:4860::8888' }, /--extern-ip/);
  weigert({ ...BASIS, 'extern-ip': '8.8.8.8/fe80::1' }, /privé-adres/);
  weigert({ ...BASIS, geheim: undefined }, /te zwak/);
  weigert({ ...BASIS, geheim: GEHEIM.slice(0, 20) + '\n' + GEHEIM.slice(20) }, /te zwak/); // sterkGeheim vangt een regeleinde al af
  weigert({ ...BASIS, 'min-poort': '1000', 'max-poort': '1200' }, /poortbereik/);
  weigert({ ...BASIS, 'min-poort': '50000', 'max-poort': '50050' }, /poortbereik/);
  weigert({ ...BASIS, 'min-poort': '2000', 'max-poort': '30000' }, /poortbereik/);
  weigert({ ...BASIS, 'min-poort': 'x' }, /poortbereik/);
  weigert({ ...BASIS, 'max-poort': '70000', 'min-poort': '60000' }, /poortbereik/);
  weigert({ ...BASIS, cert: 'relatief.pem' }, /--cert moet een absoluut pad/);
  weigert({ ...BASIS, sleutel: undefined }, /--sleutel moet een absoluut pad/);
});

function draai(argv) {
  return spawnSync(process.execPath, [SCRIPT, ...argv], { encoding: 'utf8', timeout: 15000 });
}

test('opdrachtregel: schrijft met modus 0600 en drukt het geheim niet af', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-turn-'));
  try {
    const geheimBestand = path.join(map, 'secret');
    fs.writeFileSync(geheimBestand, GEHEIM + '\n');
    const uit = path.join(map, 'turnserver.conf');
    const r = draai(['--realm=turn.rtg-proef.nl', '--extern-ip=8.8.8.8', '--geheim-bestand=' + geheimBestand,
      '--cert=/c.pem', '--sleutel=/k.pem', '--uit=' + uit, 'los-argument']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /geschreven naar .*\(0600\)/);
    assert.ok(!r.stdout.includes(GEHEIM), 'het geheim staat niet in de uitvoer');
    assert.equal(fs.statSync(uit).mode & 0o777, 0o600);
    assert.equal(regel(fs.readFileSync(uit, 'utf8'), 'static-auth-secret'), GEHEIM, 'het geheim is bijgesneden');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('opdrachtregel: zonder geheimbestand, zonder --uit, binnen de repository of onleesbaar bestand faalt met code 1', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-turn-'));
  try {
    const geheimBestand = path.join(map, 'secret');
    fs.writeFileSync(geheimBestand, GEHEIM);
    const goed = ['--realm=turn.rtg-proef.nl', '--extern-ip=8.8.8.8', '--cert=/c.pem', '--sleutel=/k.pem'];
    const a = draai([...goed, '--uit=' + path.join(map, 'x.conf')]);
    assert.equal(a.status, 1);
    assert.match(a.stderr, /--geheim-bestand ontbreekt/);
    const b = draai([...goed, '--geheim-bestand=' + geheimBestand]);
    assert.equal(b.status, 1);
    assert.match(b.stderr, /--uit ontbreekt/);
    const binnen = path.join(__dirname, '..', 'nooit-hier.conf');
    const c = draai([...goed, '--geheim-bestand=' + geheimBestand, '--uit=' + binnen]);
    assert.equal(c.status, 1);
    assert.match(c.stderr, /niet binnen de repository/);
    assert.equal(fs.existsSync(binnen), false);
    const d = draai([...goed, '--geheim-bestand=' + path.join(map, 'bestaat-niet'), '--uit=' + path.join(map, 'y.conf')]);
    assert.equal(d.status, 1);
    assert.match(d.stderr, /mislukt: ENOENT/, 'een systeemfout noemt alleen de code');
    const e = draai([...goed.slice(1), '--geheim-bestand=' + geheimBestand, '--uit=' + path.join(map, 'z.conf')]);
    assert.match(e.stderr, /--realm/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
