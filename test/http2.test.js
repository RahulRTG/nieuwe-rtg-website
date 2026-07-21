/* De eigen HTTP/2-listener (server/lib/http2.js) op node:http2. We bouwen een
   klein web()-app'je (ons eigen framework), serveren het via maakServer (cleartext
   h2c, geen certificaat nodig) en doen er een echte HTTP/2-call op: de route komt
   op, de body/JSON klopt, en de verbinding is aantoonbaar HTTP/2. Zo staat vast
   dat ons framework ongewijzigd over HTTP/2 draait (compat-laag).
   Draai los: node --experimental-sqlite --test test/http2.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http2 = require('http2');
const web = require('../server/web');
const { maakServer } = require('../server/lib/http2');

function h2call(port, pad, { method = 'GET', body = null, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const client = http2.connect('http://127.0.0.1:' + port);
    client.on('error', reject);
    const req = client.request(Object.assign({ ':method': method, ':path': pad }, headers));
    let status, hdrs = {};
    req.on('response', (h) => { status = h[':status']; hdrs = h; });
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (c) => data += c);
    req.on('end', () => { client.close(); resolve({ status, headers: hdrs, body: data }); });
    req.on('error', reject);
    if (body != null) req.end(body); else req.end();
  });
}

test('1. ons web-framework draait over HTTP/2 (h2c): GET-route + JSON', async () => {
  const app = web();
  app.use(web.json());
  app.get('/hi', (req, res) => res.json({ ok: true, naam: req.query && req.query.naam }));
  app.post('/echo', (req, res) => res.json({ ontvangen: req.body }));

  const server = maakServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const a = await h2call(port, '/hi?naam=RTG');
    assert.equal(a.status, 200, 'route komt op over HTTP/2');
    const j = JSON.parse(a.body);
    assert.equal(j.ok, true);
    assert.equal(j.naam, 'RTG', 'querystring werd verwerkt');

    // POST met JSON-body over HTTP/2 (compat-body-parser)
    const b = await h2call(port, '/echo', { method: 'POST', body: JSON.stringify({ x: 1 }), headers: { 'content-type': 'application/json' } });
    assert.equal(b.status, 200);
    assert.deepEqual(JSON.parse(b.body).ontvangen, { x: 1 }, 'de body kwam heel aan over HTTP/2');

    // 404 valt netjes door onze eigen fallback
    const c = await h2call(port, '/bestaat-niet');
    assert.equal(c.status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('2. de verbinding is echt HTTP/2 (ALPN/settings-uitwisseling)', async () => {
  const app = web();
  app.get('/', (req, res) => res.json({ v: req.httpVersion }));
  const server = maakServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const client = http2.connect('http://127.0.0.1:' + port);
    const kreegSettings = await new Promise((resolve, reject) => {
      client.on('remoteSettings', () => resolve(true)); // alleen een HTTP/2-peer stuurt SETTINGS
      client.on('error', reject);
      setTimeout(() => resolve(false), 3000);
    });
    assert.equal(kreegSettings, true, 'de server sprak het HTTP/2-protocol (SETTINGS-frame)');
    client.close();
  } finally {
    await new Promise((r) => server.close(r));
  }
});
