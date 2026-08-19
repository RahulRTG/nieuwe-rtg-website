/* Lokale modelprovider voor een OpenAI-compatibele server (bijvoorbeeld een
   lokaal inference-proces). Dit is nadrukkelijk GEEN vierde externe partij:
   de standaardgrens accepteert alleen loopback, gebruikt geen echte API-key
   en zet lokaal altijd vooraan in de uitwijkketen.

   Drie modellen mogen apart worden gekozen. Dat voorkomt dat een zwaar model
   wordt wakker gemaakt voor een ja/nee-vraag, of dat een tekstmodel een foto
   krijgt die het niet kan zien:
     LOCAL_AI_MODEL          gewone tekst
     LOCAL_AI_MODEL_KORT     classificatie en korte extractie
     LOCAL_AI_MODEL_TOOLS    tool-calling / Rahul aan het stuur
     LOCAL_AI_MODEL_VISION   beeld (leeg = lokaal geen beeld claimen)

   LOCAL_AI_TOOLS=0 zet tool-calling expliciet uit. Een ontbrekend vision-model
   betekent ook echt geen vision-capability; de keten slaat deze provider dan
   over in plaats van de foto stil te verwijderen. */
'use strict';
const OpenAI = require('./openai');
const { Poort } = require('./local-ai-poort');

function heeftBeeld(params) {
  return (params && params.messages || []).some(m => Array.isArray(m.content) &&
    m.content.some(b => b && b.type === 'image'));
}

function netwerkGrens(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') return 'op-dit-apparaat';
  const delen = host.split('.').map(Number);
  const geldigV4 = delen.length === 4 && delen.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  if (geldigV4 && delen[0] === 127) return 'op-dit-apparaat';
  const priveV4 = geldigV4 && (delen[0] === 10 || (delen[0] === 172 && delen[1] >= 16 && delen[1] <= 31) ||
      (delen[0] === 192 && delen[1] === 168) || (delen[0] === 169 && delen[1] === 254));
  const priveV6 = /^(?:fc|fd)[0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
  const lokaleNaam = !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal');
  return priveV4 || priveV6 || lokaleNaam ? 'eigen-netwerk' : null;
}

function normaliseerUrl(rauw, lanToestaan) {
  const s = String(rauw || '').trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
  if (!s) throw new Error('LOCAL_AI_URL ontbreekt.');
  let u;
  try { u = new URL(s); } catch (e) { throw new Error('LOCAL_AI_URL is geen geldige URL.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('LOCAL_AI_URL moet http of https gebruiken.');
  const grens = netwerkGrens(u);
  if (grens === 'eigen-netwerk' && !lanToestaan)
    throw new Error('LOCAL_AI_URL wijst niet naar dit apparaat. Zet LOCAL_AI_LAN_TOESTAAN=1 voor een eigen modelserver op het lokale netwerk.');
  if (!grens)
    throw new Error('LOCAL_AI_URL wijst naar een publieke host; lokale AI mag alleen op dit apparaat of het eigen netwerk draaien.');
  return s;
}

class LocalAI extends OpenAI {
  constructor(opts) {
    opts = opts || {};
    const model = opts.model || process.env.LOCAL_AI_MODEL || '';
    if (!model) throw new Error('LOCAL_AI_MODEL ontbreekt. Kies expliciet welk lokaal model RTG gebruikt.');
    const kort = opts.shortModel || process.env.LOCAL_AI_MODEL_KORT || model;
    const toolsModel = opts.toolsModel || process.env.LOCAL_AI_MODEL_TOOLS || model;
    const visionModel = opts.visionModel || process.env.LOCAL_AI_MODEL_VISION || '';
    const tools = opts.tools != null ? opts.tools !== false : process.env.LOCAL_AI_TOOLS !== '0';
    const gewoonRedeneren = opts.reasoningEffort || process.env.LOCAL_AI_REASONING || 'none';
    const toolRedeneren = opts.toolsReasoningEffort || process.env.LOCAL_AI_REASONING_TOOLS || 'none';
    const beeldRedeneren = opts.visionReasoningEffort || process.env.LOCAL_AI_REASONING_VISION || gewoonRedeneren;
    const baseURL = normaliseerUrl(opts.baseURL || process.env.LOCAL_AI_URL || process.env.LOCAL_AI_BASE_URL,
      opts.lanToestaan === true || process.env.LOCAL_AI_LAN_TOESTAAN === '1');
    const verwerking = netwerkGrens(new URL(baseURL));
    const modelVoor = (params) => {
      if (heeftBeeld(params)) return visionModel;
      if (params && Array.isArray(params.tools) && params.tools.length) return toolsModel;
      if (Number(params && params.max_tokens) > 0 && Number(params.max_tokens) <= 200) return kort;
      return model;
    };
    super({ apiKey: opts.apiKey || process.env.LOCAL_AI_KEY || 'local', baseURL,
      maxRetries: opts.maxRetries != null ? opts.maxRetries : 0,
      timeout: opts.timeout || Number(process.env.LOCAL_AI_TIMEOUT_MS) || 120000,
      reasoningEffort: params => params && Array.isArray(params.tools) && params.tools.length
        ? toolRedeneren : heeftBeeld(params) ? beeldRedeneren : gewoonRedeneren,
      modelVoor });
    this.naam = 'local';
    this.lokaal = true;
    this.verwerking = verwerking;
    this.modellen = { tekst: model, kort, tools: toolsModel, vision: visionModel || null };
    this.mogelijkheden = { tekst: true, hulpmiddelen: tools, beeld: !!visionModel };

    /* De poort: hoeveel er tegelijk naar de eigen modelserver mogen en wanneer
       we hem overslaan. Waarom die er is en hoe hij werkt staat in
       ./local-ai-poort.js -- dat is CAPACITEIT, en dit bestand gaat over
       modelkeuze en de netwerkgrens. */
    this.poort = new Poort(opts);

    const rauweCreate = this.messages.create;
    const zelf = this;
    this.messages = { create: (params) => zelf.poort.door(() => rauweCreate(params)) };
  }

  /* De stand van de poort, voor het luik op de meter. */
  staat(nu) { return this.poort.staat(nu); }

  kan(params) {
    // een open onderbreker betekent: sla deze aanbieder over, betaal geen timeout
    if (this.poort.onderbrokenTot()) return false;
    if (heeftBeeld(params)) return this.mogelijkheden.beeld;
    if (params && Array.isArray(params.tools) && params.tools.length) return this.mogelijkheden.hulpmiddelen;
    return true;
  }
}

module.exports = LocalAI;
module.exports.LocalAI = LocalAI;
module.exports._intern = { heeftBeeld, netwerkGrens, normaliseerUrl };
