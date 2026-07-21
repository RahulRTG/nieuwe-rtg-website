/* Eigen, dunne client voor de Google Gemini (generateContent)-API, in
   dezelfde vorm als onze Claude-client: messages.create(params) met een
   Claude-vormig verzoek erin en een Claude-vormig antwoord eruit. Zo is
   Gemini een transparante uitwijk voor Claude en OpenAI.

   Vertaalt heen: system -> system_instruction; content-blokken -> contents
   met parts (text / functionCall / functionResponse; assistant heet bij
   Gemini 'model'). En terug: candidates[0].content.parts -> content-blokken
   met stop_reason. Draait op onze eigen HTTP-client, geen dependency. */
'use strict';
const http = require('./lib/http');
const crypto = require('crypto');

function kiesModel(claudeModel) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  const m = String(claudeModel || '');
  if (/haiku|sonnet/.test(m)) return 'gemini-1.5-flash';
  return 'gemini-1.5-pro';
}

// Claude-berichten -> Gemini "contents". Gemini's functionResponse heeft de
// naam van de functie nodig, niet het tool_use_id; we onthouden per id de naam
// uit de voorafgaande tool_use-blokken.
function naarGemini(params) {
  const naamVanId = {};
  const contents = [];
  for (const b of params.messages || []) {
    const rol = b.role === 'assistant' ? 'model' : 'user';
    if (typeof b.content === 'string') { contents.push({ role: rol, parts: [{ text: b.content }] }); continue; }
    const parts = [];
    for (const c of b.content) {
      if (c.type === 'text' && c.text) parts.push({ text: c.text });
      else if (c.type === 'tool_use') { naamVanId[c.id] = c.name; parts.push({ functionCall: { name: c.name, args: c.input || {} } }); }
      else if (c.type === 'tool_result') {
        const naam = naamVanId[c.tool_use_id] || c.tool_use_id;
        let inhoud = c.content; if (typeof inhoud === 'string') { try { inhoud = JSON.parse(inhoud); } catch (e) { inhoud = { result: inhoud }; } }
        parts.push({ functionResponse: { name: naam, response: (inhoud && typeof inhoud === 'object' && !Array.isArray(inhoud)) ? inhoud : { result: inhoud } } });
      }
    }
    if (parts.length) contents.push({ role: rol, parts });
  }
  return contents;
}
function toolsNaarGemini(tools) {
  return [{ functionDeclarations: (tools || []).map(t => ({ name: t.name, description: t.description, parameters: t.input_schema || { type: 'object', properties: {} } })) }];
}
function naarClaude(data) {
  const kandidaat = (data.candidates || [])[0] || {};
  const parts = ((kandidaat.content || {}).parts) || [];
  const content = [];
  for (const p of parts) {
    if (p.text) content.push({ type: 'text', text: String(p.text) });
    else if (p.functionCall) content.push({ type: 'tool_use', id: 'call_' + crypto.randomBytes(6).toString('hex'), name: p.functionCall.name, input: p.functionCall.args || {} });
  }
  const heeftTool = content.some(c => c.type === 'tool_use');
  const um = data.usageMetadata || {};
  return {
    content: content.length ? content : [{ type: 'text', text: '' }],
    stop_reason: heeftTool ? 'tool_use' : (kandidaat.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn'),
    usage: { input_tokens: um.promptTokenCount || 0, output_tokens: um.candidatesTokenCount || 0 },
    model: data.modelVersion, _via: 'gemini'
  };
}

class Gemini {
  constructor(opts) {
    opts = opts || {};
    this.naam = 'gemini';
    this.apiKey = opts.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.baseURL = (opts.baseURL || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    this.maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
    this.timeout = opts.timeout || 600000;
    const zelf = this;
    this.messages = { async create(params) {
      const model = kiesModel(params.model);
      const body = { contents: naarGemini(params), generationConfig: { maxOutputTokens: params.max_tokens || 1024 } };
      if (params.system) body.system_instruction = { parts: [{ text: String(params.system) }] };
      if (params.tools) body.tools = toolsNaarGemini(params.tools);
      const r = await http.vraag({
        url: zelf.baseURL + '/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
        json: body, maxRetries: zelf.maxRetries, timeout: zelf.timeout,
        headers: { 'x-goog-api-key': zelf.apiKey, 'user-agent': 'rtg-gemini/1' }
      });
      if (r.status >= 200 && r.status < 300) {
        try { return naarClaude(r.json()); } catch (e) { throw new Error('Ongeldig JSON-antwoord van de Gemini-API.'); }
      }
      const fout = new Error('Gemini-API-fout ' + r.status + ': ' + r.tekst.slice(0, 300));
      fout.status = r.status; fout.body = r.tekst;
      throw fout;
    } };
  }
}

module.exports = Gemini;
module.exports.Gemini = Gemini;
module.exports._intern = { naarGemini, naarClaude, kiesModel };
