/* PostgreSQL-transport: de productiepoort en de echte pgwire-handshake moeten
   dezelfde grens trekken. Extern betekent verify-full + expliciete CA;
   plaintext bestaat alleen op loopback en de vaste Compose-servicenamen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const tls = require('tls');
const { keurOpslag } = require('../server/config/productie-opslag');
const { Pool, Client } = require('../server/pgwire');
const ca = require('../server/lib/ca');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pgtransport-'));
const vertrouwd = ca.maakCA({ dataDir: path.join(TMP, 'vertrouwd'), naam: 'RTG PostgreSQL Test CA' });
const aanvaller = ca.maakCA({ dataDir: path.join(TMP, 'aanvaller'), naam: 'Niet vertrouwde CA' });
const CA_PAD = path.join(TMP, 'pg-root-ca.pem');
fs.writeFileSync(CA_PAD, vertrouwd.caCertPem, { mode: 0o600 });

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

function url(host, extra) {
  return 'postgresql://rtg@' + host + '/rtg' + (extra || '');
}

function keur(databaseUrl, extra) {
  const fouten = [], waarschuwingen = [];
  keurOpslag(Object.assign({ DATABASE_URL: databaseUrl }, extra || {}), fouten, waarschuwingen);
  return { fouten, waarschuwingen };
}

test('config: externe plaintext, require en verify-ca worden hard geweigerd', () => {
  const kaal = keur(url('db.example.test'));
  assert.ok(kaal.fouten.some(f => /externe PostgreSQL-host.*verify-full/i.test(f)), kaal.fouten.join('; '));

  const requireTls = keur(url('db.example.test', '?sslmode=require&sslrootcert=' + encodeURIComponent(CA_PAD)));
  assert.ok(requireTls.fouten.some(f => /sslmode=require.*nooit productiegoed/i.test(f)), requireTls.fouten.join('; '));

  const alleenCa = keur(url('db.example.test', '?sslmode=verify-ca&sslrootcert=' + encodeURIComponent(CA_PAD)));
  assert.ok(alleenCa.fouten.some(f => /verify-ca.*hostnaam.*niet productiegoed/i.test(f)), alleenCa.fouten.join('; '));
});

test('config: verify-full vereist een absolute, leesbare en geldige CA', () => {
  const ontbreekt = keur(url('db.example.test', '?sslmode=verify-full'));
  assert.ok(ontbreekt.fouten.some(f => /sslrootcert|PGSSLROOTCERT/i.test(f)), ontbreekt.fouten.join('; '));
  const losEnvPad = keur(url('db.example.test', '?sslmode=verify-full'), { PGSSLROOTCERT: CA_PAD });
  assert.ok(losEnvPad.fouten.some(f => /sslrootcert.*DATABASE_URL/i.test(f)),
    'de CA-verwijzing reist in dezelfde URL mee naar config, Pool en directe Client');

  const relatief = keur(url('db.example.test', '?sslmode=verify-full&sslrootcert=ca.pem'));
  assert.ok(relatief.fouten.some(f => /CA-pad.*absoluut/i.test(f)), relatief.fouten.join('; '));

  const geenCaPad = path.join(TMP, 'leaf-geen-ca.pem');
  const leaf = vertrouwd.geefUitServer({ names: ['db.example.test'] });
  fs.writeFileSync(geenCaPad, leaf.certPem);
  const geenCa = keur(url('db.example.test', '?sslmode=verify-full&sslrootcert=' + encodeURIComponent(geenCaPad)));
  assert.ok(geenCa.fouten.some(f => /geen momenteel geldige CA trust anchor/i.test(f)), geenCa.fouten.join('; '));

  const goed = keur(url('db.example.test', '?sslmode=verify-full&sslrootcert=' + encodeURIComponent(CA_PAD)));
  assert.deepEqual(goed.fouten, [], 'verify-full met expliciete geldige CA hoort groen te zijn');
});

test('config: plaintext is alleen lokaal of op de vaste Compose-hosts toegestaan', () => {
  for (const host of ['localhost', '127.0.0.1', 'postgres', 'keurpostgres']) {
    assert.deepEqual(keur(url(host)).fouten, [], host + ' hoort binnen de gesloten interne policy');
  }
  for (const host of ['db', 'postgres.internal', '10.0.0.8', '192.168.1.8']) {
    assert.ok(keur(url(host)).fouten.some(f => /externe PostgreSQL-host/i.test(f)), host + ' mag niet stil intern heten');
  }
});

test('driver: require en rejectUnauthorized=false zijn ook buiten de centrale config nooit productiegoed', () => {
  const oud = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => new Pool({ connectionString: url('postgres', '?sslmode=require') }), /rejectUnauthorized=false|sslmode=require/i);
    assert.throws(() => new Pool({ host: 'postgres', ssl: { rejectUnauthorized: false } }), /rejectUnauthorized=false/i);
    assert.throws(() => new Client({ host: 'db.example.test', ssl: { rejectUnauthorized: false } }), /rejectUnauthorized=false/i);
  } finally {
    if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud;
  }
});

test('driver: losse ssl-opties kunnen verify-full niet stil verzwakken', () => {
  const p = new Pool({
    connectionString: url('db.example.test', '?sslmode=verify-full&sslrootcert=' + encodeURIComponent(CA_PAD)),
    ssl: { rejectUnauthorized: false, servername: 'aanvaller.example', ca: aanvaller.caCertPem }
  });
  assert.equal(p._cfg.ssl.rejectUnauthorized, true);
  assert.equal(p._cfg.ssl.servername, 'db.example.test');
  assert.equal(p._cfg.ssl.ca, vertrouwd.caCertPem);
});

function pgBericht(type, payload) {
  const kop = Buffer.alloc(5);
  kop[0] = type.charCodeAt(0);
  kop.writeInt32BE(payload.length + 4, 1);
  return Buffer.concat([kop, payload]);
}

/* Minimale echte PostgreSQL-TLS-voordeur: SSLRequest accepteren en na de
   handshake AuthenticationOk + ReadyForQuery teruggeven. Genoeg om te bewijzen
   dat pgwire de keten en hostnaam controleert, zonder een externe database. */
async function pgTlsServer(cert, key) {
  const context = tls.createSecureContext({ cert, key });
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.once('data', eerste => {
      if (eerste.length !== 8 || eerste.readInt32BE(0) !== 8 || eerste.readInt32BE(4) !== 80877103) {
        socket.destroy(); return;
      }
      socket.write(Buffer.from('S'), () => {
        const veilig = new tls.TLSSocket(socket, { isServer: true, secureContext: context });
        sockets.add(veilig);
        veilig.on('close', () => sockets.delete(veilig));
        veilig.on('error', () => {});
        veilig.once('data', () => {
          const authOk = Buffer.alloc(4); authOk.writeInt32BE(0);
          veilig.write(Buffer.concat([pgBericht('R', authOk), pgBericht('Z', Buffer.from('I'))]));
        });
      });
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    async sluit() {
      for (const socket of sockets) { try { socket.destroy(); } catch (e) {} }
      await new Promise(resolve => server.close(resolve));
    }
  };
}

async function verbindMet(server, caPad) {
  const p = new Pool({ connectionString: url('127.0.0.1:' + server.port,
    '?sslmode=verify-full&sslrootcert=' + encodeURIComponent(caPad)), max: 1, connectionTimeoutMillis: 2000 });
  p.on('error', () => {});
  try {
    const client = await p.connect();
    client.release();
  } finally { await p.end(); }
}

async function verbindDirect(server, caPad) {
  const client = new Client({ connectionString: url('127.0.0.1:' + server.port,
    '?sslmode=verify-full&sslrootcert=' + encodeURIComponent(caPad)) });
  client.on('error', () => {});
  try { await client.connect(); }
  finally { client.einde(); }
}

test('driver: ook een directe Client gebruikt de URL en maakt verify-full verbinding met passende CA/IP-SAN', async () => {
  const leaf = vertrouwd.geefUitServer({ names: ['127.0.0.1'], cn: 'rtg-pg-test' });
  const server = await pgTlsServer(leaf.chainPem, leaf.keyPem);
  try { await verbindDirect(server, CA_PAD); }
  finally { await server.sluit(); }
});

test('driver: een zelf-signed/MITM-keten buiten de gekozen CA wordt geweigerd', async () => {
  const leaf = aanvaller.geefUitServer({ names: ['127.0.0.1'], cn: 'mitm-pg' });
  const server = await pgTlsServer(leaf.chainPem, leaf.keyPem);
  try {
    await assert.rejects(() => verbindMet(server, CA_PAD), /unable to verify|self-signed|certificate|issuer|TLS/i);
  } finally { await server.sluit(); }
});

test('driver: een vertrouwde keten met verkeerde hostnaam wordt geweigerd', async () => {
  const leaf = vertrouwd.geefUitServer({ names: ['andere-db.example.test'], cn: 'andere-db.example.test' });
  const server = await pgTlsServer(leaf.chainPem, leaf.keyPem);
  try {
    await assert.rejects(() => verbindMet(server, CA_PAD), /IP address|altnames|certificate|hostname|TLS/i);
  } finally { await server.sluit(); }
});
