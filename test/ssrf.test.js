/* Tests voor de SSRF-afweer (server/kern/ssrf.js). Het scherpst getoetste geval
   is het web-push-endpoint: dat komt van de client en de server POST daar later
   naartoe. We weigeren metadata-adressen, interne hosts en IP-literals, en laten
   echte push-dienst-hosts door.
   Draai: node --test test/ssrf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const ssrf = require('../server/kern/ssrf');

test('pushEndpointOk laat echte push-dienst-endpoints door', () => {
  assert.equal(ssrf.pushEndpointOk('https://fcm.googleapis.com/fcm/send/abc123'), true);
  assert.equal(ssrf.pushEndpointOk('https://updates.push.services.mozilla.com/wpush/v2/xyz'), true);
  assert.equal(ssrf.pushEndpointOk('https://web.push.apple.com/QABC'), true);
  assert.equal(ssrf.pushEndpointOk('https://xxx.notify.windows.com/w/?token=1'), true);
});

test('pushEndpointOk weigert het cloud-metadata-adres', () => {
  assert.equal(ssrf.pushEndpointOk('https://169.254.169.254/latest/meta-data/'), false);
  assert.equal(ssrf.pushEndpointOk('http://169.254.169.254/latest/meta-data/'), false);
});

test('pushEndpointOk weigert interne/private hosts en IP-literals', () => {
  assert.equal(ssrf.pushEndpointOk('https://127.0.0.1/x'), false);
  assert.equal(ssrf.pushEndpointOk('https://10.0.0.5/x'), false);
  assert.equal(ssrf.pushEndpointOk('https://192.168.1.1/x'), false);
  assert.equal(ssrf.pushEndpointOk('https://[::1]/x'), false);
  assert.equal(ssrf.pushEndpointOk('https://localhost/x'), false);
});

test('pushEndpointOk weigert http en onbekende hosts', () => {
  assert.equal(ssrf.pushEndpointOk('http://fcm.googleapis.com/x'), false, 'alleen https');
  assert.equal(ssrf.pushEndpointOk('https://aanvaller.example.com/x'), false, 'geen push-host');
  assert.equal(ssrf.pushEndpointOk('https://googleapis.com.aanvaller.net/x'), false, 'suffix-truc');
  assert.equal(ssrf.pushEndpointOk(''), false);
  assert.equal(ssrf.pushEndpointOk('geen url'), false);
});

test('onveiligIpLiteral herkent private/gereserveerde/metadata-ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255',
    '192.168.0.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1']) {
    assert.equal(ssrf.onveiligIpLiteral(ip), true, ip + ' moet onveilig zijn');
  }
  assert.equal(ssrf.onveiligIpLiteral('::1'), true);
  assert.equal(ssrf.onveiligIpLiteral('fe80::1'), true);
  assert.equal(ssrf.onveiligIpLiteral('fd00::1'), true);
  assert.equal(ssrf.onveiligIpLiteral('::ffff:127.0.0.1'), true, 'IPv4-mapped loopback');
});

test('onveiligIpLiteral laat publieke IPs met rust', () => {
  assert.equal(ssrf.onveiligIpLiteral('8.8.8.8'), false);
  assert.equal(ssrf.onveiligIpLiteral('172.15.0.1'), false, 'net buiten 172.16/12');
  assert.equal(ssrf.onveiligIpLiteral('172.32.0.1'), false);
  assert.equal(ssrf.onveiligIpLiteral('93.184.216.34'), false);
});

test('veiligeExternalUrl weigert metadata, interne hosts en niet-http(s)', () => {
  assert.equal(ssrf.veiligeExternalUrl('http://169.254.169.254/').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('https://10.0.0.1/').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('https://localhost/').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('https://db.internal/').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('https://kluis.local/').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('file:///etc/passwd').ok, false);
  assert.equal(ssrf.veiligeExternalUrl('gopher://x/').ok, false);
});

test('veiligeExternalUrl laat een gewone publieke https-URL door', () => {
  assert.equal(ssrf.veiligeExternalUrl('https://example.com/pad').ok, true);
  assert.equal(ssrf.veiligeExternalUrl('https://api.stripe.com/v1/charges').ok, true);
});

test('metadataDoel herkent alleen cloud-metadata/link-local, niet gewoon lokaal', () => {
  assert.equal(ssrf.metadataDoel('169.254.169.254'), true, 'IMDS');
  assert.equal(ssrf.metadataDoel('169.254.1.1'), true, 'link-local');
  assert.equal(ssrf.metadataDoel('fe80::1'), true, 'IPv6 link-local');
  assert.equal(ssrf.metadataDoel('fd00:ec2::254'), true, 'AWS IPv6 IMDS');
  // gewoon lokaal is GEEN metadata-doel (localhost-collector mag)
  assert.equal(ssrf.metadataDoel('127.0.0.1'), false);
  assert.equal(ssrf.metadataDoel('10.0.0.1'), false);
  assert.equal(ssrf.metadataDoel('localhost'), false);
  assert.equal(ssrf.metadataDoel('8.8.8.8'), false);
});

test('veiligeWebhookUrl is standaard streng maar met intern:true alleen metadata-blok', () => {
  // standaard: net als veiligeExternalUrl (privé + metadata weg)
  assert.equal(ssrf.veiligeWebhookUrl('http://10.0.0.5/hook').ok, false);
  assert.equal(ssrf.veiligeWebhookUrl('http://169.254.169.254/x').ok, false);
  assert.equal(ssrf.veiligeWebhookUrl('https://hooks.slack.com/services/x').ok, true);
  // intern:true (bewuste collector-sidecar): lokaal mag, metadata NOOIT
  assert.equal(ssrf.veiligeWebhookUrl('http://127.0.0.1:9000/collect', { intern: true }).ok, true);
  assert.equal(ssrf.veiligeWebhookUrl('http://10.0.0.5/hook', { intern: true }).ok, true);
  assert.equal(ssrf.veiligeWebhookUrl('http://169.254.169.254/x', { intern: true }).ok, false, 'metadata blijft geblokkeerd');
  assert.equal(ssrf.veiligeWebhookUrl('ftp://x/y', { intern: true }).ok, false, 'alleen http(s)');
});
