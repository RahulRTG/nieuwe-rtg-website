/* De AI-uitwijk: onze eigen dunne clients voor Claude, OpenAI en Gemini
   (allemaal in de Claude-vorm: messages.create in, Claude-vormig antwoord
   uit) plus server/ai.js die naar de volgende aanbieder overstapt als er
   een uitvalt. Getest tegen nagemaakte provider-servers (geen echte API's,
   geen sleutels): de vertaling heen en terug klopt (ook voor tool_use), en
   de uitwijk pakt de tweede aanbieder als de eerste 500 geeft.
   Draai los: node --experimental-sqlite --test test/ai-uitwijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const Anthropic = require('../server/anthropic');
const OpenAI = require('../server/openai');
const Gemini = require('../server/gemini');
const { maakAI } = require('../server/ai');

// een nagemaakte provider-server: geeft per verzoek terug wat de test aandraagt
function nepServer(afhandelaar) {
  return new Promise((resolve) => {
    const laatste = { verzoeken: [] };
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', c => brok.push(c));
      req.on('end', () => {
        let body = {}; try { body = JSON.parse(Buffer.concat(brok).toString()); } catch (e) {}
        laatste.verzoeken.push({ pad: req.url, body, headers: req.headers });
        const uit = afhandelaar(body, req);
        res.statusCode = uit.status || 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(uit.json != null ? uit.json : {}));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, laatste, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}

test('1. OpenAI-client: Claude-vorm erin, Claude-vorm eruit (tekst en tool_use)', async () => {
  const server = await nepServer((body) => {
    // eerste ronde: vraag een tool aan; tweede ronde (na tool_result): tekst
    const heeftTool = (body.messages || []).some(m => m.role === 'tool');
    if (heeftTool) return { json: { choices: [{ message: { content: 'Klaar, drie tafels vrij.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 4 } } };
    return { json: { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'doe', arguments: '{"pad":"/api/x"}' } }] }, finish_reason: 'tool_calls' }] } };
  });
  try {
    const c = new OpenAI({ apiKey: 'sk-test', baseURL: server.base });
    const r1 = await c.messages.create({ model: 'claude-sonnet-5', max_tokens: 100, system: 'wees kort',
      tools: [{ name: 'doe', description: 'x', input_schema: { type: 'object', properties: {} } }],
      messages: [{ role: 'user', content: 'hoeveel tafels vrij?' }] });
    assert.equal(r1.stop_reason, 'tool_use');
    const tu = r1.content.find(c => c.type === 'tool_use');
    assert.ok(tu && tu.name === 'doe' && tu.input.pad === '/api/x', 'tool_use netjes vertaald');
    // het verzoek dat de server zag, is echte OpenAI-vorm
    const gezien = server.laatste.verzoeken[0].body;
    assert.equal(gezien.messages[0].role, 'system');
    assert.ok(gezien.tools[0].type === 'function' && gezien.tools[0].function.name === 'doe');
    // tweede ronde met een tool_result -> tekstantwoord
    const r2 = await c.messages.create({ model: 'claude-sonnet-5', max_tokens: 100,
      messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: r1.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: tu.id, content: '{"vrij":3}' }] }] });
    assert.equal(r2.stop_reason, 'end_turn');
    assert.equal(r2.content.filter(c => c.type === 'text').map(c => c.text).join(''), 'Klaar, drie tafels vrij.');
    // de server zag een role:tool-bericht met het juiste tool_call_id
    const tweede = server.laatste.verzoeken[1].body;
    const toolMsg = tweede.messages.find(m => m.role === 'tool');
    assert.ok(toolMsg && toolMsg.tool_call_id === tu.id, 'tool_result werd een tool-bericht');
  } finally { server.srv.close(); }
});

test('2. Gemini-client: Claude-vorm erin, Claude-vorm eruit (tekst en tool_use)', async () => {
  const server = await nepServer((body) => {
    const heeftAntwoord = (body.contents || []).some(c => (c.parts || []).some(p => p.functionResponse));
    if (heeftAntwoord) return { json: { candidates: [{ content: { parts: [{ text: 'Drie tafels vrij.' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } } };
    return { json: { candidates: [{ content: { parts: [{ functionCall: { name: 'doe', args: { pad: '/api/x' } } }] }, finishReason: 'STOP' }] } };
  });
  try {
    const c = new Gemini({ apiKey: 'g-test', baseURL: server.base });
    const r1 = await c.messages.create({ model: 'claude-opus-4-8', max_tokens: 100, system: 'wees kort',
      tools: [{ name: 'doe', description: 'x', input_schema: { type: 'object', properties: {} } }],
      messages: [{ role: 'user', content: 'hoeveel tafels vrij?' }] });
    assert.equal(r1.stop_reason, 'tool_use');
    const tu = r1.content.find(c => c.type === 'tool_use');
    assert.ok(tu && tu.name === 'doe' && tu.input.pad === '/api/x');
    // de server kreeg echte Gemini-vorm: system_instruction + functionDeclarations
    const gezien = server.laatste.verzoeken[0].body;
    assert.ok(gezien.system_instruction && gezien.tools[0].functionDeclarations[0].name === 'doe');
    // tweede ronde met tool_result -> functionResponse met de juiste functienaam
    const r2 = await c.messages.create({ model: 'claude-opus-4-8', max_tokens: 100,
      messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: r1.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: tu.id, content: '{"vrij":3}' }] }] });
    assert.equal(r2.content.filter(c => c.type === 'text').map(c => c.text).join(''), 'Drie tafels vrij.');
    const tweede = server.laatste.verzoeken[1].body;
    const fr = tweede.contents.flatMap(c => c.parts || []).find(p => p.functionResponse);
    assert.ok(fr && fr.functionResponse.name === 'doe', 'de functienaam is teruggevonden bij het tool_result');
  } finally { server.srv.close(); }
});

test('3. de uitwijk: valt Claude uit (500), dan neemt OpenAI het over', async () => {
  const claude = await nepServer(() => ({ status: 500, json: { error: { message: 'overbelast' } } }));
  const openai = await nepServer(() => ({ json: { choices: [{ message: { content: 'OpenAI sprong bij.' }, finish_reason: 'stop' }] } }));
  try {
    const ai = maakAI({
      anthropicKey: 'sk-a', openaiKey: 'sk-o',
      anthropic: { apiKey: 'sk-a', baseURL: claude.base, maxRetries: 0 },
      openai: { apiKey: 'sk-o', baseURL: openai.base, maxRetries: 0 }
    });
    assert.deepEqual(ai.aanbieders, ['claude', 'openai'], 'beide aanbieders in de ketting, Claude eerst');
    const r = await ai.messages.create({ model: 'claude-sonnet-5', max_tokens: 50, messages: [{ role: 'user', content: 'hallo' }] });
    assert.equal(r.content[0].text, 'OpenAI sprong bij.');
    assert.equal(ai.actief, 'openai', 'de actieve aanbieder is doorgeschoven naar openai');
    assert.ok(claude.laatste.verzoeken.length >= 1 && openai.laatste.verzoeken.length === 1, 'Claude is geprobeerd, daarna OpenAI');
  } finally { claude.srv.close(); openai.srv.close(); }
});

test('4. de uitwijk: alle aanbieders down -> de laatste fout borrelt op (aanroeper valt terug op demo)', async () => {
  const down = await nepServer(() => ({ status: 503, json: {} }));
  try {
    const ai = maakAI({ anthropicKey: 'sk-a', anthropic: { apiKey: 'sk-a', baseURL: down.base, maxRetries: 0 } });
    await assert.rejects(() => ai.messages.create({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }));
  } finally { down.srv.close(); }
});

test('5. geen enkele sleutel -> maakAI geeft null (demostand blijft)', () => {
  const oud = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY, gg: process.env.GOOGLE_API_KEY };
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY;
  try { assert.equal(maakAI({}), null); }
  finally { if (oud.a) process.env.ANTHROPIC_API_KEY = oud.a; if (oud.o) process.env.OPENAI_API_KEY = oud.o; if (oud.g) process.env.GEMINI_API_KEY = oud.g; if (oud.gg) process.env.GOOGLE_API_KEY = oud.gg; }
});

test('6. Claude-client blijft werken via de eigen HTTP-client', async () => {
  const server = await nepServer(() => ({ json: { content: [{ type: 'text', text: 'Hallo van Claude.' }], stop_reason: 'end_turn', usage: { input_tokens: 2, output_tokens: 3 } } }));
  try {
    const c = new Anthropic({ apiKey: 'sk-a', baseURL: server.base });
    const r = await c.messages.create({ model: 'claude-opus-4-8', max_tokens: 50, messages: [{ role: 'user', content: 'hoi' }] });
    assert.equal(r.content[0].text, 'Hallo van Claude.');
    // de juiste headers gingen mee
    assert.equal(server.laatste.verzoeken[0].headers['x-api-key'], 'sk-a');
    assert.equal(server.laatste.verzoeken[0].headers['anthropic-version'], '2023-06-01');
  } finally { server.srv.close(); }
});
