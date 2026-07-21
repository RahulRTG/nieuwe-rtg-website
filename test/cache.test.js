/* De eigen in-memory cache (server/lib/cache.js): TTL-verval, LRU-uitzetting,
   treffer/misser-telling, en de response-cache-middleware die een publiek JSON-
   antwoord memoiseert (miss -> hit) en een niet-200 juist NIET bewaart.
   Draai los: node --experimental-sqlite --test test/cache.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Cache, memo, antwoordCache } = require('../server/lib/cache');

test('1. TTL: een waarde vervalt na de tijd', () => {
  const c = new Cache({ ttl: 20 });
  c.zet('a', 1);
  assert.equal(c.haal('a'), 1, 'vers erin, meteen eruit');
  return new Promise((r) => setTimeout(r, 30)).then(() => {
    assert.equal(c.haal('a'), undefined, 'na de TTL is hij weg');
  });
});

test('2. LRU: boven max wordt de minst recent gebruikte eruit gezet', () => {
  const c = new Cache({ ttl: 10000, max: 3 });
  c.zet('a', 1); c.zet('b', 2); c.zet('c', 3);
  assert.equal(c.haal('a'), 1);           // a is nu net gebruikt -> jongste
  c.zet('d', 4);                          // over max: de oudste (b) valt af
  assert.equal(c.grootte, 3);
  assert.equal(c.haal('b'), undefined, 'b (minst recent) is eruit');
  assert.equal(c.haal('a'), 1, 'a bleef (was recent gebruikt)');
  assert.equal(c.haal('d'), 4);
});

test('3. stats: treffers en missers worden geteld', () => {
  const c = new Cache({ ttl: 10000 });
  c.zet('x', 9);
  c.haal('x'); c.haal('x'); c.haal('weg');
  const s = c.stats();
  assert.equal(s.treffers, 2);
  assert.equal(s.missers, 1);
  assert.ok(s.ratio > 0.6 && s.ratio < 0.7);
});

test('4. memo: berekent eenmaal, daarna uit de cache', () => {
  const c = new Cache({ ttl: 10000 });
  let keer = 0;
  const maak = () => { keer++; return { n: keer }; };
  const a = memo(c, 'k', maak);
  const b = memo(c, 'k', maak);
  assert.equal(keer, 1, 'maker maar een keer aangeroepen');
  assert.deepEqual(a, b);
});

// een minimale req/res die de middleware kan bedienen (res.json zoals verrijk.js)
function nepReqRes(method, url) {
  const headers = {};
  const res = {
    statusCode: 200, _body: null, ended: false,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    end(b) { this.ended = true; this._body = b == null ? this._body : b; return this; },
    json(obj) {
      if (!this.getHeader('Content-Type')) this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this._body = JSON.stringify(obj); this.end(this._body); return this;
    }
  };
  return { req: { method, url }, res, headers };
}

test('5. middleware: eerste keer miss + bewaren, tweede keer hit uit de cache', () => {
  const mw = antwoordCache({ ttl: 10000 });
  let handlerKeer = 0;
  const handler = (req, res) => { handlerKeer++; res.json({ talen: ['nl', 'en'], n: handlerKeer }); };

  const een = nepReqRes('POST', '/api/talen');
  mw(een.req, een.res, () => handler(een.req, een.res));
  assert.equal(een.res.getHeader('X-RTG-Cache'), 'miss');
  assert.match(een.res._body, /"talen"/);
  assert.equal(handlerKeer, 1);

  const twee = nepReqRes('POST', '/api/talen');
  let volgendeAangeroepen = false;
  mw(twee.req, twee.res, () => { volgendeAangeroepen = true; handler(twee.req, twee.res); });
  assert.equal(twee.res.getHeader('X-RTG-Cache'), 'hit', 'tweede keer uit de cache');
  assert.equal(volgendeAangeroepen, false, 'de handler werd overgeslagen');
  assert.equal(handlerKeer, 1, 'de dure handler draaide maar een keer');
  assert.equal(twee.res._body, een.res._body, 'exact hetzelfde antwoord');
});

test('6. middleware: een niet-200-antwoord wordt NIET bewaard', () => {
  const mw = antwoordCache({ ttl: 10000 });
  const een = nepReqRes('GET', '/api/iets');
  mw(een.req, een.res, () => { een.res.statusCode = 500; een.res.json({ error: 'stuk' }); });
  assert.equal(een.res.getHeader('X-RTG-Cache'), 'miss');

  const twee = nepReqRes('GET', '/api/iets');
  let volgende = false;
  mw(twee.req, twee.res, () => { volgende = true; twee.res.json({ ok: true }); });
  assert.equal(volgende, true, 'geen hit: de fout werd niet gecachet, dus de handler draait weer');
  assert.equal(twee.res.getHeader('X-RTG-Cache'), 'miss');
});
