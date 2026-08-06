/* Test voor de eigen Claude-client (server/anthropic.js), die @anthropic-ai/sdk
   verving. We draaien tegen een lokale nep-API (geen echte sleutel/kosten) en
   controleren: de juiste headers + body gaan eruit, het antwoord komt als object
   terug (zoals messages.create), 429/5xx wordt herprobeerd, en een echte fout
   gooit met .status (waarop de aanroeper op zijn demo-antwoord terugvalt). */
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const Anthropic = require('../server/anthropic');

/* SLUITEN DAT OOK DE OPEN VERBINDINGEN MEENEEMT.

   Dit bestand stond als `vastgelopen` in MUTATIES.json, en het opruimen zat hier
   al netjes in een finally -- dus dat was niet het gat. `sluitServer(srv)` stopt alleen
   het AANNEMEN van nieuwe verbindingen; een socket die nog open staat houdt node
   in leven, en onder een mutatie blijft er een halfopen staan. Dan zakken de
   toetsen wel, maar het proces sluit niet af: de motor noteert `vastgelopen` en
   een echte fout kost een time-out in plaats van een rode regel.

   Sluiten mag nooit zelf gooien: een fout in het opruimen verdringt de assertie
   die de toets liet zakken. */
function sluitServer(srv) {
  if (!srv) return;
  try { if (typeof srv.closeAllConnections === 'function') srv.closeAllConnections(); } catch (e) { /* oudere node */ }
  try { sluitServer(srv); } catch (e) { /* al dicht */ }
  try { srv.unref(); } catch (e) { /* geen unref */ }
}

/* EN EEN DEADLINE OM ELKE AANROEP, want sluiten alleen was niet genoeg.

   Na de sluitreparatie hierboven bleef de diepe ronde van de mutatiemotor op EEN
   plek vastlopen (`return-weg#3`): een weggehaalde return laat de aanroep nooit
   settelen, en dan staat de toets vast BINNEN de try -- waar een finally nooit aan
   te pas komt. Sluiten helpt tegen een handle die openblijft, een deadline tegen
   een belofte die nooit antwoordt. Dat zijn twee verschillende lekken en ze hebben
   allebei een eigen reparatie nodig; ik heb ze in deze ronde in die volgorde
   gevonden, elk door de mutatie opnieuw te draaien.

   Vijftien seconden is ruim: de nepserver antwoordt in milliseconden, en de
   herprobeer-logica die hier wordt getoetst wacht bewust even. */
function metDeadline(belofte, wat) {
  let t = null;
  const klok = new Promise((_, af) => {
    t = setTimeout(() => af(new Error('geen antwoord binnen 15s: ' + wat +
      ' -- een aanroep die niet antwoordt hoort deze toets te laten zakken, niet te laten hangen')), 15000);
  });
  return Promise.race([belofte, klok]).finally(() => clearTimeout(t));
}

function nepApi(handler) {
  const srv = http.createServer((req, res) => {
    const brok = [];
    req.on('data', c => brok.push(c));
    req.on('end', () => handler(req, Buffer.concat(brok).toString(), res));
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, poort: srv.address().port })));
}
const client = (poort) => new Anthropic({ apiKey: 'sk-test-123', baseURL: 'http://127.0.0.1:' + poort, maxRetries: 3 });

test('messages.create stuurt de juiste headers + body en geeft het antwoord terug', async () => {
  let gezien = null;
  const { srv, poort } = await nepApi((req, body, res) => {
    gezien = { headers: req.headers, method: req.method, url: req.url, body: JSON.parse(body) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-4-8', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hallo' }], usage: { input_tokens: 5, output_tokens: 2 } }));
  });
  try {
    const a = client(poort);
    const msg = await metDeadline(a.messages.create({ model: 'claude-opus-4-8', max_tokens: 100, messages: [{ role: 'user', content: 'hoi' }] }), 'messages.create');
    assert.strictEqual(msg.content[0].text, 'Hallo');
    assert.strictEqual(msg.stop_reason, 'end_turn');
    assert.strictEqual(gezien.method, 'POST');
    assert.strictEqual(gezien.url, '/v1/messages');
    assert.strictEqual(gezien.headers['x-api-key'], 'sk-test-123');
    assert.strictEqual(gezien.headers['anthropic-version'], '2023-06-01');
    assert.strictEqual(gezien.headers['content-type'], 'application/json');
    assert.strictEqual(gezien.body.model, 'claude-opus-4-8');
    assert.strictEqual(gezien.body.messages[0].content, 'hoi');
  } finally { sluitServer(srv); }
});

test('429 wordt herprobeerd en daarna slaagt het', async () => {
  let n = 0;
  const { srv, poort } = await nepApi((req, body, res) => {
    n++;
    if (n < 3) { res.writeHead(429); res.end('{"error":"overloaded"}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: 'eindelijk' }], stop_reason: 'end_turn' }));
  });
  try {
    const msg = await metDeadline(client(poort).messages.create({ model: 'x', max_tokens: 10, messages: [] }), 'messages.create met herproberen');
    assert.strictEqual(msg.content[0].text, 'eindelijk');
    assert.strictEqual(n, 3, 'twee keer geprobeerd, derde keer raak');
  } finally { sluitServer(srv); }
});

test('een 400 gooit met .status (aanroeper valt terug op demo)', async () => {
  const { srv, poort } = await nepApi((req, body, res) => { res.writeHead(400); res.end('{"error":"bad request"}'); });
  try {
    await assert.rejects(
      () => metDeadline(client(poort).messages.create({ model: 'x', max_tokens: 10, messages: [] }), 'messages.create bij 400'),
      (e) => { assert.strictEqual(e.status, 400); return true; }
    );
  } finally { sluitServer(srv); }
});

test('apiKey en baseURL komen uit de omgeving als ze niet worden meegegeven', () => {
  const oudK = process.env.ANTHROPIC_API_KEY, oudB = process.env.ANTHROPIC_BASE_URL;
  process.env.ANTHROPIC_API_KEY = 'sk-env'; process.env.ANTHROPIC_BASE_URL = 'https://voorbeeld.test';
  try {
    const a = new Anthropic();
    assert.strictEqual(a.apiKey, 'sk-env');
    assert.strictEqual(a.baseURL, 'https://voorbeeld.test');
    assert.strictEqual(typeof a.messages.create, 'function');
  } finally {
    if (oudK === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = oudK;
    if (oudB === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = oudB;
  }
});
