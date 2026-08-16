/* Eigen, dunne client voor de OpenAI Chat Completions-API, in dezelfde vorm
   als onze Claude-client (./anthropic): messages.create(params) met een
   Claude-vormig verzoek erin en een Claude-vormig antwoord eruit. Zo is
   OpenAI een transparante uitwijk voor Claude -- de tool-lus in
   kern/stuur.js en alle AI-helpers merken geen verschil.

   Vertaalt heen: system-prompt -> een system-bericht; content-blokken
   (text/tool_use/tool_result) -> de chat-vorm (assistant.tool_calls en
   role:tool). En terug: choices[].message -> content-blokken met
   stop_reason. Draait op onze eigen HTTP-client, geen dependency. */
'use strict';
const http = require('./lib/http');

// Claude-modelnaam -> een passend OpenAI-model (klein voor snel, groot voor zwaar).
// Vast overschrijfbaar met OPENAI_MODEL; anders kiest de tier het model.
function kiesModel(claudeModel) {
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
  const m = String(claudeModel || '');
  if (/haiku|sonnet/.test(m)) return 'gpt-4o-mini';
  return 'gpt-4o';
}

/* Claude-berichten -> OpenAI-berichten.

   Prompt caching hoeft hier niets extra's: OpenAI cachet automatisch elke
   prompt vanaf ~1024 tokens op voorwaarde dat het vaste deel VOORAAN staat --
   en dat doet deze vertaling al (system eerst, dan de geschiedenis in
   volgorde). De cache_control-markeringen van de Claude-kant bestaan bij
   OpenAI niet; de uitwijkketen geeft ons het ongemarkeerde origineel (de
   verrijking gebeurt pas ín server/anthropic.js, op een kopie). Een
   systeemprompt kan behalve een tekst ook een lijst blokken zijn; die
   vouwen we hier terug tot tekst. */
function naarOpenAI(params) {
  const uit = [];
  if (params.system) {
    const sys = Array.isArray(params.system)
      ? params.system.map(b => (b && b.text) || '').filter(Boolean).join('\n')
      : String(params.system);
    if (sys) uit.push({ role: 'system', content: sys });
  }
  for (const b of params.messages || []) {
    if (typeof b.content === 'string') { uit.push({ role: b.role, content: b.content }); continue; }
    if (b.role === 'assistant') {
      const tekst = b.content.filter(c => c.type === 'text').map(c => c.text).join('');
      const calls = b.content.filter(c => c.type === 'tool_use')
        .map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input || {}) } }));
      const msg = { role: 'assistant', content: tekst || null };
      if (calls.length) msg.tool_calls = calls;
      uit.push(msg);
      continue;
    }
    // user-turn: gewone tekst mag een string blijven. Zodra er beeld in zit,
    // blijft de volgorde als multimodale blokkenlijst behouden. Beeld stil
    // weggooien is gevaarlijker dan een providerfout: het model zou dan doen
    // alsof het de foto zag terwijl het alleen de vraag kreeg.
    const multimodaal = [];
    for (const c of b.content) {
      if (c.type === 'text' && c.text) multimodaal.push({ type: 'text', text: String(c.text) });
      else if (c.type === 'image' && c.source && c.source.type === 'base64' && c.source.data) {
        const mime = /^image\/(?:jpeg|png|webp|gif)$/.test(c.source.media_type || '') ? c.source.media_type : 'image/jpeg';
        multimodaal.push({ type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + c.source.data } });
      }
    }
    if (multimodaal.some(c => c.type === 'image_url')) uit.push({ role: 'user', content: multimodaal });
    else {
      const tekst = multimodaal.filter(c => c.type === 'text').map(c => c.text).join('');
      if (tekst) uit.push({ role: 'user', content: tekst });
    }
    for (const c of b.content.filter(c => c.type === 'tool_result')) {
      uit.push({ role: 'tool', tool_call_id: c.tool_use_id, content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content) });
    }
  }
  return uit;
}
function toolsNaarOpenAI(tools) {
  return (tools || []).map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema || { type: 'object', properties: {} } } }));
}
// OpenAI-antwoord -> Claude-vormig antwoord
function naarClaude(data) {
  const keuze = (data.choices || [])[0] || {};
  const bericht = keuze.message || {};
  const content = [];
  if (bericht.content) content.push({ type: 'text', text: String(bericht.content) });
  for (const call of bericht.tool_calls || []) {
    let input = {}; try { input = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
    content.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
  }
  const heeftTool = (bericht.tool_calls || []).length > 0;
  return {
    content: content.length ? content : [{ type: 'text', text: '' }],
    stop_reason: heeftTool ? 'tool_use' : (keuze.finish_reason === 'length' ? 'max_tokens' : 'end_turn'),
    usage: { input_tokens: (data.usage || {}).prompt_tokens || 0, output_tokens: (data.usage || {}).completion_tokens || 0,
      // OpenAI cachet automatisch; dit maakt de treffers zichtbaar in dezelfde
      // Claude-vormige usage (cache_read_input_tokens) als bij de andere aanbieders
      cache_read_input_tokens: (((data.usage || {}).prompt_tokens_details || {}).cached_tokens) || 0 },
    model: data.model, _via: 'openai'
  };
}

class OpenAI {
  constructor(opts) {
    opts = opts || {};
    this.naam = 'openai';
    this.apiKey = opts.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = (opts.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, '');
    this.maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
    this.timeout = opts.timeout || 600000;
    this.modelVoor = typeof opts.modelVoor === 'function' ? opts.modelVoor : (params) => kiesModel(params && params.model);
    this.reasoningEffort = opts.reasoningEffort || '';
    const zelf = this;
    this.messages = { async create(params) {
      const body = {
        model: zelf.modelVoor(params), max_tokens: params.max_tokens || 1024,
        messages: naarOpenAI(params)
      };
      const redeneerstand = typeof zelf.reasoningEffort === 'function'
        ? zelf.reasoningEffort(params) : zelf.reasoningEffort;
      if (redeneerstand) body.reasoning_effort = redeneerstand;
      if (params.tools) body.tools = toolsNaarOpenAI(params.tools);
      const r = await http.vraag({ url: zelf.baseURL + '/v1/chat/completions', json: body, maxRetries: zelf.maxRetries, timeout: zelf.timeout,
        headers: { authorization: 'Bearer ' + zelf.apiKey, 'user-agent': 'rtg-openai/1' } });
      if (r.status >= 200 && r.status < 300) {
        try { return naarClaude(r.json()); } catch (e) { throw new Error('Ongeldig JSON-antwoord van de OpenAI-API.'); }
      }
      const fout = new Error('OpenAI-API-fout ' + r.status + ': ' + r.tekst.slice(0, 300));
      fout.status = r.status; fout.body = r.tekst;
      throw fout;
    } };
  }
}

module.exports = OpenAI;
module.exports.OpenAI = OpenAI;
module.exports._intern = { naarOpenAI, naarClaude, kiesModel };
