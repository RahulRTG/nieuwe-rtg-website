/* Eigen externe fout-melder (server/foutmelder.js), die @sentry/node verving.
   We draaien tegen een lokale nep-webhook en controleren: er gaat een nette
   JSON-POST uit met de fout + context, dezelfde fout wordt binnen het venster
   niet nog eens verstuurd (temperen), en zonder URL gebeurt er niets (en gooit
   het nooit). Los: node --test test/foutmelder.test.js */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { maakFoutmelder } = require('../server/foutmelder');

function nepWebhook() {
  const ontvangen = [];
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const b = []; req.on('data', c => b.push(c));
      req.on('end', () => { try { ontvangen.push(JSON.parse(Buffer.concat(b).toString())); } catch (e) {} res.writeHead(200); res.end('{}'); });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, poort: srv.address().port, ontvangen }));
  });
}
const wacht = ms => new Promise(r => setTimeout(r, ms));

test('stuurt een JSON-POST met de fout + context naar de webhook', async () => {
  const { srv, poort, ontvangen } = await nepWebhook();
  try {
    const m = maakFoutmelder({ url: 'http://127.0.0.1:' + poort + '/hook', app: 'rtg-test' });
    assert.strictEqual(m.actief, true);
    m.melden(new Error('kapot ding'), { p: '/api/x', id: 'abc' });
    for (let i = 0; i < 50 && ontvangen.length === 0; i++) await wacht(20);
    assert.strictEqual(ontvangen.length, 1);
    assert.strictEqual(ontvangen[0].app, 'rtg-test');
    assert.strictEqual(ontvangen[0].fout, 'kapot ding');
    assert.strictEqual(ontvangen[0].context.p, '/api/x');
    assert.ok(ontvangen[0].stack.includes('kapot ding'));
  } finally { srv.close(); }
});

test('tempert: dezelfde fout gaat binnen het venster maar één keer uit', async () => {
  const { srv, poort, ontvangen } = await nepWebhook();
  try {
    const m = maakFoutmelder({ url: 'http://127.0.0.1:' + poort + '/hook', vensterMs: 60000 });
    m.melden(new Error('zelfde'), { p: '/a' });
    m.melden(new Error('zelfde'), { p: '/a' });
    m.melden(new Error('zelfde'), { p: '/a' });
    for (let i = 0; i < 30 && ontvangen.length < 1; i++) await wacht(20);
    await wacht(120);
    assert.strictEqual(ontvangen.length, 1, 'drie keer gemeld, één keer verstuurd');
    // een ANDERE fout gaat wél door
    m.melden(new Error('anders'), { p: '/b' });
    for (let i = 0; i < 30 && ontvangen.length < 2; i++) await wacht(20);
    assert.strictEqual(ontvangen.length, 2);
  } finally { srv.close(); }
});

test('zonder URL: inert en gooit nooit', () => {
  const m = maakFoutmelder({ url: '' });
  assert.strictEqual(m.actief, false);
  assert.doesNotThrow(() => m.melden(new Error('x'), {}));
});
