/* De AI-uitwijk: onze eigen dunne clients voor Claude, OpenAI en Gemini
   (allemaal in de Claude-vorm: messages.create in, Claude-vormig antwoord
   uit) plus server/ai.js die naar de volgende aanbieder overstapt als er
   een uitvalt. Getest tegen nagemaakte provider-servers (geen echte API's,
   geen sleutels): de vertaling heen en terug klopt (ook voor tool_use), en
   de uitwijk pakt de tweede aanbieder als de eerste 500 geeft.
   Draai los: node --test test/ai-uitwijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const Anthropic = require('../server/anthropic');
const OpenAI = require('../server/openai');
const Gemini = require('../server/gemini');
const LocalAI = require('../server/local-ai');
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

test('3. beeld blijft bij OpenAI en Gemini echt beeld, nooit alleen de vraag', async () => {
  const openai = await nepServer(() => ({ json: { choices: [{ message: { content: 'Een kopje.' }, finish_reason: 'stop' }] } }));
  const gemini = await nepServer(() => ({ json: { candidates: [{ content: { parts: [{ text: 'Een kopje.' }] }, finishReason: 'STOP' }] } }));
  const beeld = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
  const vraag = { type: 'text', text: 'Wat is dit?' };
  try {
    const o = new OpenAI({ apiKey: 'sk-test', baseURL: openai.base });
    await o.messages.create({ model: 'claude-opus-4-8', messages: [{ role: 'user', content: [beeld, vraag] }] });
    const om = openai.laatste.verzoeken[0].body.messages.find(m => m.role === 'user');
    assert.ok(Array.isArray(om.content), 'multimodale OpenAI-inhoud blijft een blokkenlijst');
    assert.match(om.content.find(b => b.type === 'image_url').image_url.url, /^data:image\/png;base64,iVBOR/);
    assert.equal(om.content.find(b => b.type === 'text').text, 'Wat is dit?');

    const g = new Gemini({ apiKey: 'g-test', baseURL: gemini.base });
    await g.messages.create({ model: 'claude-opus-4-8', messages: [{ role: 'user', content: [beeld, vraag] }] });
    const delen = gemini.laatste.verzoeken[0].body.contents.flatMap(c => c.parts || []);
    assert.deepEqual(delen.find(p => p.inlineData).inlineData, { mimeType: 'image/png', data: 'iVBORw0KGgo=' });
    assert.equal(delen.find(p => p.text).text, 'Wat is dit?');
  } finally { openai.srv.close(); gemini.srv.close(); }
});

test('4. lokale provider kiest per capability een lokaal model', async () => {
  const server = await nepServer(() => ({ json: { choices: [{ message: { content: 'Lokaal.' }, finish_reason: 'stop' }] } }));
  try {
    const c = new LocalAI({ baseURL: server.base, model: 'rtg-tekst', shortModel: 'rtg-kort',
      toolsModel: 'rtg-tools', visionModel: 'rtg-vision', maxRetries: 0 });
    await c.messages.create({ model: 'claude-sonnet-5', max_tokens: 80, messages: [{ role: 'user', content: 'kort' }] });
    await c.messages.create({ model: 'claude-sonnet-5', max_tokens: 800, tools: [{ name: 'doe', input_schema: { type: 'object' } }], messages: [{ role: 'user', content: 'doe iets' }] });
    await c.messages.create({ model: 'claude-opus-4-8', max_tokens: 200, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA==' } }, { type: 'text', text: 'kijk' }
    ] }] });
    assert.deepEqual(server.laatste.verzoeken.map(v => v.body.model), ['rtg-kort', 'rtg-tools', 'rtg-vision']);
    assert.deepEqual(server.laatste.verzoeken.map(v => v.body.reasoning_effort), ['none', 'none', 'none'],
      'tekst, tools en beeld antwoorden direct zonder verborgen redeneertekst');
    assert.equal(c.lokaal, true);
    assert.equal(c.kan({ tools: [{}] }), true);
    assert.equal(c.kan({ messages: [{ role: 'user', content: [{ type: 'image' }] }] }), true);
  } finally { server.srv.close(); }
});

test('4b. de LAN-optie kan nooit een publieke host als lokaal vermommen', () => {
  assert.throws(() => new LocalAI({ baseURL: 'https://api.example.com', model: 'rtg-local', lanToestaan: true }),
    /publieke|eigen netwerk/i);
});

test('5. lokaal gaat voor extern; pas bij uitval neemt extern over', async () => {
  const local = await nepServer(() => ({ status: 500, json: { error: 'uit' } }));
  const claude = await nepServer(() => ({ status: 500, json: { error: { message: 'overbelast' } } }));
  const openai = await nepServer(() => ({ json: { choices: [{ message: { content: 'OpenAI sprong bij.' }, finish_reason: 'stop' }] } }));
  try {
    const ai = maakAI({
      localUrl: local.base,
      anthropicKey: 'sk-a', openaiKey: 'sk-o',
      local: { baseURL: local.base, model: 'rtg-local', maxRetries: 0 },
      anthropic: { apiKey: 'sk-a', baseURL: claude.base, maxRetries: 0 },
      openai: { apiKey: 'sk-o', baseURL: openai.base, maxRetries: 0 }
    });
    assert.deepEqual(ai.aanbieders, ['local', 'claude', 'openai'], 'lokaal staat voor de externe aanbieders');
    const r = await ai.messages.create({ model: 'claude-sonnet-5', max_tokens: 50, messages: [{ role: 'user', content: 'hallo' }] });
    assert.equal(r.content[0].text, 'OpenAI sprong bij.');
    assert.equal(ai.actief, 'openai', 'de actieve aanbieder is doorgeschoven naar openai');
    assert.ok(local.laatste.verzoeken.length >= 1 && claude.laatste.verzoeken.length >= 1 && openai.laatste.verzoeken.length === 1,
      'lokaal is geprobeerd, daarna pas de externe aanbieders');
  } finally { local.srv.close(); claude.srv.close(); openai.srv.close(); }
});

test('6. externe uitwijk kan hard uit terwijl lokale AI beschikbaar blijft', () => {
  const ai = maakAI({ localUrl: 'http://127.0.0.1:11434', local: { model: 'rtg-local' },
    anthropicKey: 'sk-a', openaiKey: 'sk-o', externUit: true });
  assert.deepEqual(ai.aanbieders, ['local']);
  assert.equal(ai.bron, 'lokaal');
});

test('7. de uitwijk: alle aanbieders down -> de laatste fout borrelt op (aanroeper valt terug op demo)', async () => {
  const down = await nepServer(() => ({ status: 503, json: {} }));
  try {
    const ai = maakAI({ anthropicKey: 'sk-a', anthropic: { apiKey: 'sk-a', baseURL: down.base, maxRetries: 0 } });
    await assert.rejects(() => ai.messages.create({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'x' }] }));
  } finally { down.srv.close(); }
});

test('8. geen enkele sleutel of lokale url -> maakAI geeft null (regelstand blijft)', () => {
  const oud = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY, g: process.env.GEMINI_API_KEY, gg: process.env.GOOGLE_API_KEY };
  const lokaal = process.env.LOCAL_AI_URL;
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY; delete process.env.LOCAL_AI_URL;
  try { assert.equal(maakAI({}), null); }
  finally { if (oud.a) process.env.ANTHROPIC_API_KEY = oud.a; if (oud.o) process.env.OPENAI_API_KEY = oud.o; if (oud.g) process.env.GEMINI_API_KEY = oud.g; if (oud.gg) process.env.GOOGLE_API_KEY = oud.gg; if (lokaal) process.env.LOCAL_AI_URL = lokaal; }
});

test('9. Claude-client blijft werken via de eigen HTTP-client', async () => {
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
