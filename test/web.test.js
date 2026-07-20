/* Eigen web-framework (server/web.js), dat express verving. We toetsen de
   deelverzameling die de server echt gebruikt, tegen een echte http-server:
   routing + :params + RegExp-pad, middleware-keten + next(err) naar de
   foutafhandelaar, web.json (limiet -> 413, kapot -> 400) + web.raw, web.static
   (Range/206, 416, 304, pad-traversal), en het mounten van een sub-router met
   het strippen van het mount-pad. Los: node --test test/web.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const web = require('../server/web');

function start(app) {
  return new Promise(res => { const s = app.listen(0, '127.0.0.1', () => res({ s, poort: s.address().port })); });
}
function vraag(poort, pad, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: poort, path: pad, method: opts.method || 'GET', headers: opts.headers || {} }, r => {
      const b = []; r.on('data', c => b.push(c)); r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(b) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

test('routing: string-pad, :param, RegExp-pad en 404', async () => {
  const app = web();
  app.get('/hoi', (req, res) => res.json({ waar: 'hoi' }));
  app.get('/lid/:id/kaart', (req, res) => res.json({ id: req.params.id }));
  app.get(/\.txt$/, (req, res) => res.type('text/plain').send('regexraak'));
  const { s, poort } = await start(app);
  try {
    assert.equal(JSON.parse((await vraag(poort, '/hoi')).body).waar, 'hoi');
    assert.equal(JSON.parse((await vraag(poort, '/lid/42/kaart')).body).id, '42');
    assert.equal((await vraag(poort, '/ergens/iets.txt')).body.toString(), 'regexraak');
    assert.equal((await vraag(poort, '/bestaat-niet')).status, 404);
  } finally { s.close(); }
});

test('middleware-keten + next(err) belandt bij de foutafhandelaar', async () => {
  const app = web();
  let volgorde = [];
  const mw = (req, res, next) => { volgorde.push('mw'); next(); };
  app.get('/stuk', mw, (req, res, next) => { next(new Error('kapot')); });
  app.use((err, req, res, next) => { res.status(500).json({ fout: err.message, volgorde }); });
  const { s, poort } = await start(app);
  try {
    const r = await vraag(poort, '/stuk');
    assert.equal(r.status, 500);
    assert.equal(JSON.parse(r.body).fout, 'kapot');
    assert.deepEqual(JSON.parse(r.body).volgorde, ['mw']);
  } finally { s.close(); }
});

test('json: parse, limiet -> 413 (entity.too.large), kapotte json -> 400', async () => {
  const app = web();
  app.use(web.json({ limit: '1kb' }));
  app.post('/echo', (req, res) => res.json({ ontvangen: req.body }));
  app.use((err, req, res, next) => { res.status(err.type === 'entity.too.large' ? 413 : (err.status || 500)).json({ type: err.type }); });
  const { s, poort } = await start(app);
  try {
    const goed = await vraag(poort, '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 1 }) });
    assert.deepEqual(JSON.parse(goed.body).ontvangen, { a: 1 });
    const teGroot = await vraag(poort, '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(2000) }) });
    assert.equal(teGroot.status, 413);
    const kapot = await vraag(poort, '/echo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{niet: geldig' });
    assert.equal(kapot.status, 400);
  } finally { s.close(); }
});

test('raw: body komt als Buffer, alleen bij passend type', async () => {
  const app = web();
  app.post('/hook', web.raw({ type: '*/*', limit: '1mb' }), (req, res) => res.json({ isBuffer: Buffer.isBuffer(req.body), len: req.body.length }));
  const { s, poort } = await start(app);
  try {
    const r = await vraag(poort, '/hook', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from([1, 2, 3, 4]) });
    assert.deepEqual(JSON.parse(r.body), { isBuffer: true, len: 4 });
  } finally { s.close(); }
});

test('static: Range/206, onbevredigbaar/416, voorwaardelijk/304, pad-traversal geweigerd', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-web-'));
  fs.writeFileSync(path.join(dir, 'data.bin'), Buffer.from('0123456789'));
  const app = web();
  app.use(web.static(dir));
  app.use((req, res) => res.status(404).end('nope'));
  const { s, poort } = await start(app);
  try {
    const vol = await vraag(poort, '/data.bin');
    assert.equal(vol.status, 200); assert.equal(vol.body.toString(), '0123456789');
    const etag = vol.headers.etag;
    const deel = await vraag(poort, '/data.bin', { headers: { range: 'bytes=2-5' } });
    assert.equal(deel.status, 206); assert.equal(deel.body.toString(), '2345');
    assert.equal(deel.headers['content-range'], 'bytes 2-5/10');
    const mis = await vraag(poort, '/data.bin', { headers: { range: 'bytes=999-' } });
    assert.equal(mis.status, 416);
    const nietGewijzigd = await vraag(poort, '/data.bin', { headers: { 'if-none-match': etag } });
    assert.equal(nietGewijzigd.status, 304);
    const traversal = await vraag(poort, '/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    assert.equal(traversal.status, 404);
  } finally { s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('sub-router mounten op een prefix met het strippen van het mount-pad', async () => {
  const app = web();
  const r = web.Router();
  r.post('/lijst', (req, res) => res.json({ pad: req.path, params: req.params }));
  r.get('/item/:code', (req, res) => res.json({ code: req.params.code }));
  app.use('/api/foundation', r);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Onbekend eindpunt.' }));
  const { s, poort } = await start(app);
  try {
    const lijst = await vraag(poort, '/api/foundation/lijst', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(lijst.status, 200);
    const item = await vraag(poort, '/api/foundation/item/AB12');
    assert.equal(JSON.parse(item.body).code, 'AB12');
    const onbekend = await vraag(poort, '/api/foundation/bestaat-niet', { method: 'POST' });
    assert.equal(onbekend.status, 404);
  } finally { s.close(); }
});

test('_router.stack geeft de express-vorm (path + methods) voor introspectie', () => {
  const app = web();
  app.post('/api/x', (req, res) => res.end());
  app.get('/api/y', (req, res) => res.end());
  const posts = app._router.stack.filter(l => l.route && l.route.methods.post).map(l => l.route.path);
  assert.ok(posts.includes('/api/x'));
  assert.ok(!posts.includes('/api/y'));
});
