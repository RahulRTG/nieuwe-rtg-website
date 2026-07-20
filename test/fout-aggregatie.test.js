/* Test voor de eigen in-memory fout-aggregatie in server/log.js. Storingen
   worden gegroepeerd op een vingerafdruk (bericht met cijfers weggenormaliseerd
   + plaats), met een teller; foutenSamenvatting() geeft de recentste bovenaan;
   foutenReset() zet alles terug. Dit verving een externe tracker (Sentry). */
const { test } = require('node:test');
const assert = require('node:assert');
const { log } = require('../server/log');

// De error-log naar stderr even dempen tijdens deze test (scheelt ruis).
function stil(fn) {
  const echt = process.stderr.write.bind(process.stderr);
  process.stderr.write = () => true;
  try { return fn(); } finally { process.stderr.write = echt; }
}

// Fouten die vanaf dezelfde plek ontstaan (zelfde stackframe): zo groepeert
// het net als in productie, waar dezelfde route-regel de fout gooit.
function boem(msg) { return new Error(msg); }

test('gelijksoortige storingen vallen samen tot een groep met een teller', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(boem('order 123 mislukt'), { p: '/api/order' });
    log.uitzondering(boem('order 456 mislukt'), { p: '/api/order' });
    log.uitzondering(boem('vertaling stuk'), { p: '/api/ai' });
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 3, 'drie storingen in totaal');
  assert.strictEqual(s.distinct, 2, 'twee soorten (order-# en vertaling)');
  const order = s.recent.find(g => g.aantal === 2);
  assert.ok(order, 'de order-groep bestaat');
  assert.match(order.bericht, /order/, 'het is inderdaad de order-fout');
  assert.strictEqual(order.aantal, 2, 'de twee order-fouten met verschillende id vallen samen');
});

test('de recentste groep staat bovenaan', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(new Error('eerste soort'), {});
    log.uitzondering(new Error('tweede soort'), {});
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.recent[0].bericht, 'tweede soort', 'laatst gezien = bovenaan');
});

test('een string-fout (geen Error) crasht de aggregatie niet', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering('kapot zonder Error-object', { bron: 'test' });
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 1);
  assert.strictEqual(s.recent[0].bericht, 'kapot zonder Error-object');
});

test('foutenReset() zet alles terug op nul', () => {
  stil(() => {
    log.foutenReset();
    log.uitzondering(new Error('iets'), {});
    log.foutenReset();
  });
  const s = log.foutenSamenvatting();
  assert.strictEqual(s.totaal, 0);
  assert.strictEqual(s.distinct, 0);
  assert.strictEqual(s.recent.length, 0);
});
