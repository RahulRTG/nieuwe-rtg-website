/* Test voor de eigen STUN-server (server/stun.js): een Binding Request krijgt een
   Binding Success Response met een correct ge-XOR'd MAPPED-ADDRESS terug, en
   rommel wordt genegeerd (geen crash). Zo bellen leden zonder de STUN van Google. */
const { test } = require('node:test');
const assert = require('node:assert');
const dgram = require('dgram');
const stun = require('../server/stun');

const MAGIC = Buffer.from([0x21, 0x12, 0xA4, 0x42]);
function bindingRequest() {
  const b = Buffer.alloc(20);
  b.writeUInt16BE(0x0001, 0);            // Binding Request
  b.writeUInt16BE(0, 2);                 // geen attributen
  MAGIC.copy(b, 4);
  require('crypto').randomBytes(12).copy(b, 8);   // transactie-id
  return b;
}
function decodeXor(resp) {
  let off = 20;
  while (off + 4 <= resp.length) {
    const type = resp.readUInt16BE(off), len = resp.readUInt16BE(off + 2);
    const val = resp.subarray(off + 4, off + 4 + len);
    if (type === 0x0020 && val.readUInt8(1) === 0x01) {
      const port = val.readUInt16BE(2) ^ 0x2112;
      const ip = [];
      for (let i = 0; i < 4; i++) ip.push(val.readUInt8(4 + i) ^ MAGIC[i]);
      return { port, address: ip.join('.') };
    }
    off += 4 + len + ((4 - (len % 4)) % 4);
  }
  return null;
}

test('verwerk: Binding Request -> Success Response met juist XOR-adres', () => {
  const resp = stun.verwerk(bindingRequest(), { address: '203.0.113.7', port: 54321 });
  assert.ok(resp, 'er hoort een antwoord te komen');
  assert.strictEqual(resp.readUInt16BE(0), 0x0101, 'Binding Success Response');
  assert.ok(resp.subarray(4, 8).equals(MAGIC), 'magic cookie klopt');
  const a = decodeXor(resp);
  assert.strictEqual(a.port, 54321, 'poort komt terug uit het XOR-adres');
  assert.strictEqual(a.address, '203.0.113.7', 'IP komt terug uit het XOR-adres');
});

test('verwerk: IPv4-mapped IPv6-afzender wordt als IPv4 teruggegeven', () => {
  const resp = stun.verwerk(bindingRequest(), { address: '::ffff:192.0.2.9', port: 40000 });
  const a = decodeXor(resp);
  assert.strictEqual(a.address, '192.0.2.9');
  assert.strictEqual(a.port, 40000);
});

test('verwerk: rommel en verkeerde types worden genegeerd', () => {
  assert.strictEqual(stun.verwerk(Buffer.alloc(3), { address: '127.0.0.1', port: 1 }), null, 'te kort');
  const geenCookie = bindingRequest(); geenCookie.writeUInt32BE(0xdeadbeef, 4);
  assert.strictEqual(stun.verwerk(geenCookie, { address: '127.0.0.1', port: 1 }), null, 'geen magic cookie');
  const verkeerdType = bindingRequest(); verkeerdType.writeUInt16BE(0x0101, 0);
  assert.strictEqual(stun.verwerk(verkeerdType, { address: '127.0.0.1', port: 1 }), null, 'geen Binding Request');
});

test('live: echte UDP-round-trip tegen de draaiende STUN-server', async () => {
  const srv = stun.start({ port: 34791 });
  assert.ok(srv, 'de STUN-server hoort te starten');
  try {
    const client = dgram.createSocket('udp4');
    const antwoord = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('geen STUN-antwoord binnen 2s')), 2000);
      client.on('message', m => { clearTimeout(t); resolve(m); });
      client.on('error', reject);
      client.send(bindingRequest(), 34791, '127.0.0.1');
    });
    assert.strictEqual(antwoord.readUInt16BE(0), 0x0101, 'Success Response');
    const a = decodeXor(antwoord);
    assert.strictEqual(a.address, '127.0.0.1', 'server ziet de client op 127.0.0.1');
    assert.ok(a.port > 0, 'server ziet een bronpoort');
    client.close();
  } finally { srv.stop(); }
});
