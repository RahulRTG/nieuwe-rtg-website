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
/* De tijd uit de klok van dit huis. Het herstelvenster van de onderbreker
   hieronder is tijdgedrag, en met server/lib/klok.js is dat te beproeven
   (RTG_KLOK) zonder een halve minuut te moeten wachten. */
const klok = require('./lib/klok');

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

    /* ---- DE POORT: EEN EIGEN MODELSERVER IS GEEN WOLK ----

       Een externe aanbieder schaalt mee; een eigen modelserver niet. Die doet
       er twee, misschien vier tegelijk, en daarboven wordt hij niet langzamer
       maar STUK: alles kruipt, alles loopt in de timeout, en de uitwijkketen
       stuurt vervolgens ALLES naar de betaalde aanbieder. Dat is de dure
       faalstand, en hij is stil -- de rekening ziet hem eerder dan een mens, en
       ondertussen verlaat de inhoud wel het huis.

       Twee kleppen daartegen, allebei hier en niet in de HTTP-laag eronder
       (die bedient ook de betaalprovider en weet niets van een GPU):

       1. HOEVEEL TEGELIJK. Standaard twee, met een wachtrij. Wie te lang moet
          wachten geeft op en de keten wijkt uit -- want een lid drie minuten
          laten wachten is erger dan de vraag naar buiten sturen. Waar die grens
          ligt is een keuze en geen natuurwet, dus hij staat in de env.

       2. WANNEER WE HET OPGEVEN. Blijft de server hangen (niet weigeren, maar
          hangen), dan betaalt ELK verzoek eerst de volle timeout voordat de
          uitwijk begint. Na een paar storingen op rij slaat de onderbreker aan
          en slaan we lokaal over -- meteen extern, geen minuten wachten. Daarna
          mag er weer een verzoek langs om te kijken of hij terug is; lukt dat,
          dan gaat de klep dicht.

       Beide standen zijn af te lezen (staat()), zodat het luik op de meter kan
       laten zien dat de eigen server aan het worstelen is. */
    /* NUL IS EEN ANTWOORD, GEEN LEEGTE. Hier stond `Number(x) || standaard`, en
       daarmee werd LOCAL_AI_WACHT_MS=0 stilletjes 20000 en
       LOCAL_AI_HERSTEL_MS=0 stilletjes 30000 -- terwijl nul juist iets zegt:
       "niet in de rij, meteen uitwijken" en "geen herstelvenster". Wie dat zet
       kreeg het tegenovergestelde van wat hij vroeg, zonder melding. */
    const getal = (uitOpts, uitEnv, standaard, minimum) => {
      const rauw = uitOpts != null ? uitOpts : uitEnv;
      const n = Number(rauw);
      return Math.max(minimum, (rauw != null && rauw !== '' && Number.isFinite(n)) ? n : standaard);
    };
    this.gelijktijdig = getal(opts.gelijktijdig, process.env.LOCAL_AI_GELIJKTIJDIG, 2, 1);
    this.wachtMs = getal(opts.wachtMs, process.env.LOCAL_AI_WACHT_MS, 20000, 0);
    this.storingsgrens = getal(opts.storingsgrens, process.env.LOCAL_AI_STORINGSGRENS, 3, 1);
    this.herstelMs = getal(opts.herstelMs, process.env.LOCAL_AI_HERSTEL_MS, 30000, 0);
    this._bezig = 0;
    this._rij = [];
    this._storingen = 0;
    this._openTot = 0;

    const rauweCreate = this.messages.create;
    const zelf = this;
    this.messages = { create: (params) => zelf._doorDePoort(() => rauweCreate(params)) };
  }

  /* Staat de onderbreker open? Zo ja, dan slaan we lokaal over in plaats van de
     timeout te betalen. Zodra het herstelvenster om is mag er weer een verzoek
     langs; faalt die, dan staat _storingen nog boven de grens en gaat de klep
     meteen weer open. Dat is het halfopen-gedrag, zonder een derde toestand. */
  _onderbrokenTot(nu) { return this._openTot > (nu || klok.nu()) ? this._openTot : 0; }

  staat(nu) {
    const open = this._onderbrokenTot(nu);
    return {
      bezig: this._bezig, wachtend: this._rij.length, gelijktijdig: this.gelijktijdig,
      storingen: this._storingen, onderbroken: !!open,
      onderbrokenNog: open ? Math.max(0, open - (nu || klok.nu())) : 0
    };
  }

  _neemSlot() {
    if (this._bezig < this.gelijktijdig) { this._bezig += 1; return Promise.resolve(true); }
    return new Promise((klaar) => {
      const plek = { klaar, klok: null, af: false };
      const geef = (ok) => { if (plek.af) return; plek.af = true; if (plek.klok) clearTimeout(plek.klok);
        const i = this._rij.indexOf(plek); if (i !== -1) this._rij.splice(i, 1); klaar(ok); };
      plek.geef = geef;
      /* Niet oneindig wachten: dan staat een lid naar een leeg scherm te kijken
         terwijl de uitwijk allang had kunnen antwoorden. */
      if (this.wachtMs > 0) { plek.klok = setTimeout(() => geef(false), this.wachtMs); if (plek.klok.unref) plek.klok.unref(); }
      else return geef(false);
      this._rij.push(plek);
    });
  }

  _geefSlotTerug() {
    const volgende = this._rij.shift();
    if (volgende) { volgende.af = true; if (volgende.klok) clearTimeout(volgende.klok); volgende.klaar(true); return; }
    this._bezig = Math.max(0, this._bezig - 1);
  }

  async _doorDePoort(werk) {
    const nu = klok.nu();
    if (this._onderbrokenTot(nu)) {
      throw Object.assign(new Error('De eigen modelserver is tijdelijk overgeslagen na herhaalde storingen.'),
        { code: 'LOKAAL_ONDERBROKEN' });
    }
    if (!(await this._neemSlot())) {
      throw Object.assign(new Error('De eigen modelserver is bezet; de wachttijd is verstreken.'),
        { code: 'LOKAAL_BEZET' });
    }
    try {
      const uit = await werk();
      this._storingen = 0;
      this._openTot = 0;
      return uit;
    } catch (e) {
      this._storingen += 1;
      if (this._storingen >= this.storingsgrens) this._openTot = klok.nu() + this.herstelMs;
      throw e;
    } finally {
      this._geefSlotTerug();
    }
  }

  kan(params) {
    // een open onderbreker betekent: sla deze aanbieder over, betaal geen timeout
    if (this._onderbrokenTot()) return false;
    if (heeftBeeld(params)) return this.mogelijkheden.beeld;
    if (params && Array.isArray(params.tools) && params.tools.length) return this.mogelijkheden.hulpmiddelen;
    return true;
  }
}

module.exports = LocalAI;
module.exports.LocalAI = LocalAI;
module.exports._intern = { heeftBeeld, netwerkGrens, normaliseerUrl };
