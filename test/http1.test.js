/* De eigen HTTP/1.1-motor (server/lib/http1.js): de pure parser en de echte
   socket-server. Twee lagen: (1) parseKop op losse tekstblokken (verzoekregel,
   headers, samenvoegen, set-cookie, afwijzen van rommel); (2) een draaiende
   server die een echte client bedient -- GET, POST met Content-Length, POST
   met chunked transfer-encoding, keep-alive met twee verzoeken op een
   verbinding, en een streaming (SSE-achtig) antwoord met losse writes.
   Draai los: node --experimental-sqlite --test test/http1.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { maakServer, parseKop } = require('../server/lib/http1');

test('1. parseKop: verzoekregel + headers, samenvoegen en rommel geweigerd', () => {
  const k = parseKop('POST /api/x?y=1 HTTP/1.1\r\nHost: a\r\nX-A: 1\r\nX-A: 2\r\nContent-Length: 5');
  assert.equal(k.method, 'POST');
  assert.equal(k.url, '/api/x?y=1');
  assert.equal(k.httpVersion, '1.1');
  assert.equal(k.headers['host'], 'a');
  assert.equal(k.headers['x-a'], '1, 2', 'dubbele header samengevoegd met komma');
  assert.equal(k.headers['content-length'], '5');
  const c = parseKop('GET / HTTP/1.1\r\nSet-Cookie: a=1\r\nSet-Cookie: b=2');
  assert.deepEqual(c.headers['set-cookie'], ['a=1', 'b=2'], 'set-cookie blijft een lijst');
  assert.equal(parseKop('GARBAGE'), null);
  assert.equal(parseKop('GET / HTTP/1.1\r\nkapotte-regel-zonder-dubbelepunt'), null);
});

// een minimale HTTP-client op een socket: stuurt ruwe bytes, leest tot de
// verbinding sluit of tot de opgegeven stopmelding, en ontleedt statuscode +
// body (dekt Content-Length en chunked af voor de test).
function ruweClient(port, ruw, { houdOpen } = {}) {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(ruw));
    let data = Buffer.alloc(0);
    s.on('data', (c) => { data = Buffer.concat([data, c]); if (houdOpen && houdOpen(data.toString())) { s.end(); } });
    s.on('error', reject);
    s.on('close', () => resolve(data.toString()));
    setTimeout(() => s.destroy(), 5000);
  });
}
function knipAntwoorden(tekst) {
  // splits opeenvolgende antwoorden op een keep-alive-verbinding grofweg op de statusregel
  return tekst.split(/(?=HTTP\/1\.1 )/).filter(Boolean);
}
function ontChunked(body) {
  let uit = '', i = 0;
  for (;;) {
    const nl = body.indexOf('\r\n', i); if (nl < 0) break;
    const n = parseInt(body.slice(i, nl), 16); if (!Number.isFinite(n) || n === 0) break;
    uit += body.slice(nl + 2, nl + 2 + n); i = nl + 2 + n + 2;
  }
  return uit;
}

test('2. een draaiende server: GET, POST (Content-Length), chunked, keep-alive en streaming', async () => {
  const server = maakServer((req, res) => {
    if (req.method === 'GET' && req.url === '/hallo') {
      res.statusCode = 200; res.setHeader('Content-Type', 'text/plain');
      return res.end('hoi ' + (req.headers['x-naam'] || ''));
    }
    if (req.method === 'POST' && req.url === '/echo') {
      const brok = []; req.on('data', c => brok.push(c));
      req.on('end', () => { const body = Buffer.concat(brok).toString(); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ontvangen: body, lengte: body.length })); });
      return;
    }
    if (req.method === 'GET' && req.url === '/stroom') {
      // streaming: drie losse writes, geen Content-Length -> chunked
      res.setHeader('Content-Type', 'text/event-stream');
      res.write('deel1;'); res.write('deel2;');
      setTimeout(() => { res.write('deel3'); res.end(); }, 10);
      return;
    }
    res.statusCode = 404; res.end('weg');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    // GET met een eigen header
    const a = await ruweClient(port, 'GET /hallo HTTP/1.1\r\nHost: t\r\nX-Naam: RTG\r\nConnection: close\r\n\r\n');
    assert.match(a, /^HTTP\/1\.1 200 OK/);
    assert.match(a, /hoi RTG$/);

    // POST met Content-Length
    const body = JSON.stringify({ a: 1, tekst: 'unicode €' });
    const lengte = Buffer.byteLength(body);
    const b = await ruweClient(port, 'POST /echo HTTP/1.1\r\nHost: t\r\nContent-Type: application/json\r\nContent-Length: ' + lengte + '\r\nConnection: close\r\n\r\n' + body);
    const bJson = JSON.parse(b.slice(b.indexOf('\r\n\r\n') + 4));
    assert.equal(bJson.ontvangen, body, 'de volledige body kwam aan');
    assert.equal(bJson.lengte, body.length, 'even lang (in tekens) als wat we stuurden');

    // POST met chunked transfer-encoding
    const chunkedBody = '5\r\nhallo\r\n6\r\n werld\r\n0\r\n\r\n'; // 6 tekens: ' werld'
    const c = await ruweClient(port, 'POST /echo HTTP/1.1\r\nHost: t\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n' + chunkedBody);
    const cJson = JSON.parse(c.slice(c.indexOf('\r\n\r\n') + 4));
    assert.equal(cJson.ontvangen, 'hallo werld', 'de chunks zijn correct aaneengeplakt');

    // keep-alive: twee verzoeken op een verbinding
    const dubbel = await ruweClient(port,
      'GET /hallo HTTP/1.1\r\nHost: t\r\nX-Naam: een\r\n\r\nGET /hallo HTTP/1.1\r\nHost: t\r\nX-Naam: twee\r\nConnection: close\r\n\r\n');
    const stukken = knipAntwoorden(dubbel);
    assert.equal(stukken.length, 2, 'twee antwoorden op een verbinding');
    assert.match(stukken[0], /hoi een/);
    assert.match(stukken[1], /hoi twee/);

    // streaming: chunked antwoord met de drie delen
    const s = await ruweClient(port, 'GET /stroom HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n');
    assert.match(s, /Transfer-Encoding: chunked/i, 'streaming wordt chunked verstuurd');
    const inhoud = ontChunked(s.slice(s.indexOf('\r\n\r\n') + 4));
    assert.equal(inhoud, 'deel1;deel2;deel3', 'alle streaming-delen kwamen door');
  } finally {
    await new Promise(r => server.close(r));
  }
});
