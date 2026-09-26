/* ============================================================================
   DE AI-KOSTENMETER BOEKT WAT ER GELEVERD WERD (ARBEID.md par. 4 punt 12).

   Drie telfouten, en ze gingen alle drie dezelfde kant op -- een rekening die
   niet klopt met wat er gebeurde:

     1. server/ai.js boekte de GEVRAAGDE Claude-naam tegen Claude-tarieven, ook
        als OpenAI of Gemini antwoordde.
     2. De kostenmeter telde een cache-leesbeurt als volle invoer en liet een
        cache-schrijfbeurt weg; en OpenAI telt cachetreffers al mee in
        prompt_tokens, dus die gingen er twee keer in.
     3. De bron (lokaal of extern) werd weggegooid, dus lokaal verbruik telde
        tegen het externe tarief -- en de verbruiksgrens sloot daarna ook het
        eigen model, dat geen euro kost.

   Tegen nagemaakte provider-servers: geen sleutels, geen echte API's.
   Draai los: node --test test/aikosten-bron.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const haak = require('../server/kern/kosten/haak');
const meter = require('../server/ai-meter');
const { maakAI, geleverdModel } = require('../server/ai');
const { usageVan } = require('../server/openai')._intern;

function nepServer(json) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(json)); });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const antwoord = (usage, model) => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage, model });
const vraag = { model: 'claude-sonnet-5', max_tokens: 20, messages: [{ role: 'user', content: 'hoi' }] };

function vang() {
  const gemeld = [];
  haak.zetMeter((r) => { gemeld.push(r); return true; });
  return gemeld;
}
test.afterEach(() => { haak.zetMeter(null); haak.zetGrenswacht(null); meter.nulstel(); });

test('1. het geleverde model, niet het gevraagde', () => {
  assert.equal(geleverdModel({ naam: 'openai' }, vraag, { model: 'gpt-5' }), 'gpt-5');
  assert.equal(geleverdModel({ naam: 'openai' }, vraag, {}), 'onbekend:openai',
    'een Claude-naam die bij OpenAI nooit draaide, wordt niet tegen Claude geboekt');
  assert.equal(geleverdModel({ naam: 'claude' }, vraag, {}), 'claude-sonnet-5');
  /* een gedateerde naam hoort bij zijn familie; een onbekende telt duur */
  assert.deepEqual(meter.tariefVan('claude-sonnet-5-20260101'), meter.PRIJZEN['claude-sonnet-5']);
  assert.deepEqual(meter.tariefVan('onbekend:openai'), meter.tariefVan('niemand-kent-mij'));
  assert.ok(meter.tariefVan('onbekend:openai').in >= meter.PRIJZEN['claude-sonnet-5'].in);
});

test('2. OpenAI telt cachetreffers niet dubbel', () => {
  const u = usageVan({ prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 800 } });
  assert.deepEqual(u, { input_tokens: 200, output_tokens: 10, cache_read_input_tokens: 800 });
});

test('3. de kostenmeter weegt cache zoals de dagmeter', () => {
  assert.equal(meter.gewogenInvoer({ input_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 400 }),
    100 + 100 + 500);
});

test('4. een externe aanroep wordt geboekt op het model dat antwoordde, gewogen', async () => {
  const ext = await nepServer(antwoord({ prompt_tokens: 1000, completion_tokens: 50,
    prompt_tokens_details: { cached_tokens: 900 } }, 'gpt-5'));
  const gemeld = vang();
  try {
    const ai = maakAI({ openaiKey: 'sk-o', volgorde: 'openai', openai: { apiKey: 'sk-o', baseURL: ext.base, maxRetries: 0 } });
    await ai.messages.create(vraag);
    const inv = gemeld.find(r => r.soort === 'ai-invoer');
    assert.equal(inv.aantal, 100 + 90, '100 ongecachet + 900 x 0,1');
    assert.equal(inv.bron, 'openai');
    assert.deepEqual(Object.keys(meter.stand().perModel || {}).filter(m => /claude/.test(m)), [],
      'geen Claude-tarief voor een OpenAI-antwoord');
  } finally { ext.srv.close(); }
});

test('5. lokaal verbruik telt niet tegen het externe tarief', async () => {
  const lok = await nepServer(antwoord({ prompt_tokens: 5000, completion_tokens: 500 }, 'rtg-local'));
  const gemeld = vang();
  try {
    const ai = maakAI({ localUrl: lok.base, local: { baseURL: lok.base, model: 'rtg-local', maxRetries: 0 }, externUit: true });
    await ai.messages.create(vraag);
    assert.deepEqual(gemeld.filter(r => /^ai-/.test(r.soort)), [], 'het eigen model kost capaciteit, geen geld');
  } finally { lok.srv.close(); }
});

test('6. een dichte verbruiksgrens sluit extern, niet het eigen model', async () => {
  const lok = await nepServer(antwoord({ prompt_tokens: 5, completion_tokens: 5 }, 'rtg-local'));
  const ext = await nepServer(antwoord({ prompt_tokens: 5, completion_tokens: 5 }, 'gpt-5'));
  haak.zetGrenswacht(() => ({ ok: false, uitleg: 'plafond bereikt' }));
  try {
    const lokaal = maakAI({ localUrl: lok.base, local: { baseURL: lok.base, model: 'rtg-local', maxRetries: 0 }, externUit: true });
    const r = await lokaal.messages.create(vraag);
    assert.equal(r.content[0].text, 'ok', 'het lokale model antwoordt gewoon');
    const extern = maakAI({ openaiKey: 'sk-o', volgorde: 'openai', openai: { apiKey: 'sk-o', baseURL: ext.base, maxRetries: 0 } });
    await assert.rejects(() => extern.messages.create(vraag), (e) => e.code === 'KOSTENGRENS');
  } finally { lok.srv.close(); ext.srv.close(); }
});
