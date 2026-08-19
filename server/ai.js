/* De AI-uitwijk: één messages.create die achter de schermen meerdere
   aanbieders kent (lokaal, Claude, OpenAI, Gemini) en automatisch naar de volgende
   overstapt als er een uitvalt. Zo blijft de persoonlijke AI overeind als
   een aanbieder een storing of een 429/5xx heeft -- de rest van de code
   (kern/stuur.js, translate.js, alle helpers) roept gewoon
   anthropic.messages.create(...) aan en merkt van de uitwijk niets.

   De volgorde is LOCAL FIRST: een eigen modelserver, dan pas de expliciet
   ingestelde externe aanbieders. RTG_EXTERNE_AI_UIT=1 houdt de lokale laag
   actief en sluit de rest hard. Zonder model draait RTG in de ingebouwde,
   regelgestuurde werkmodus. */
'use strict';
const Anthropic = require('./anthropic');
const OpenAI = require('./openai');
const Gemini = require('./gemini');
const LocalAI = require('./local-ai');
const meter = require('./ai-meter');
const rem = require('./ai-rem');

// welke aanbieders in welke volgorde; env kan de volgorde overschrijven
function bouwKetting(opts) {
  opts = opts || {};
  if (opts.uit === true || process.env.RTG_AI_UIT === '1') return [];
  const externUit = opts.externUit === true || process.env.RTG_EXTERNE_AI_UIT === '1';
  const localUrl = opts.localUrl || (opts.local && opts.local.baseURL) || process.env.LOCAL_AI_URL || process.env.LOCAL_AI_BASE_URL;
  const beschikbaar = {
    local: () => localUrl ? new LocalAI(Object.assign({}, opts.local, { baseURL: localUrl })) : null,
    claude: () => !externUit && (opts.anthropicKey || process.env.ANTHROPIC_API_KEY) ? new Anthropic(opts.anthropic) : null,
    openai: () => !externUit && (opts.openaiKey || process.env.OPENAI_API_KEY) ? new OpenAI(opts.openai) : null,
    gemini: () => !externUit && (opts.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? new Gemini(opts.gemini) : null
  };
  beschikbaar.lokaal = beschikbaar.local;
  const gekozen = opts.volgorde || process.env.AI_VOLGORDE || 'local,claude,openai,gemini';
  const volgorde = (Array.isArray(gekozen) ? gekozen : String(gekozen).split(','))
    .map(s => s.trim().toLowerCase()).map(n => n === 'lokaal' ? 'local' : n).filter(n => beschikbaar[n]);
  const ketting = [];
  for (const naam of [...new Set(volgorde)]) { const c = beschikbaar[naam](); if (c) ketting.push(c); }
  return ketting;
}

function maakAI(opts) {
  const ketting = bouwKetting(opts);
  if (!ketting.length) return null; // geen sleutel: kern blijft handmatig draaien
  const log = opts && opts.log;
  const client = {
    aanbieders: ketting.map(c => c.naam),
    providerInfo: ketting.map(c => ({ naam: c.naam, lokaal: !!c.lokaal,
      verwerking: c.lokaal ? (c.verwerking || 'op-dit-apparaat') : 'externe-provider' })),
    actief: ketting[0].naam,
    bron: ketting[0].lokaal ? 'lokaal' : 'extern',
    kan(params) { return ketting.some(a => typeof a.kan !== 'function' || a.kan(params)); },
    /* De staat van de EIGEN modelserver: hoeveel er tegelijk loopt, hoeveel er
       wacht, en of de onderbreker aanstaat. Zonder dit is een worstelende eigen
       server onzichtbaar -- je ziet alleen dat het aandeel extern oploopt, maar
       niet waarom. Zie server/local-ai.js. */
    lokaleStaat() {
      const l = ketting.find(a => a.lokaal && typeof a.staat === 'function');
      return l ? Object.assign({ modellen: l.modellen, verwerking: l.verwerking }, l.staat()) : null;
    },
    routes(params) { return ketting.filter(a => typeof a.kan !== 'function' || a.kan(params)).map(a => a.naam); },
    messages: {
      async create(params) {
        let laatste = null;
        for (const aanbieder of ketting) {
          if (typeof aanbieder.kan === 'function' && !aanbieder.kan(params)) continue;
          /* De hoofdkraan. Alleen voor aanbieders die geld kosten: een eigen
             modelserver draait door, en is die er niet dan valt de keten terug
             op geen-model -- de handmatige werkmodus die dit huis al draagt.
             Zie ./ai-meter.js voor waarom dit hier staat en niet per route. */
          if (!aanbieder.lokaal && !meter.magNog()) {
            laatste = laatste || Object.assign(new Error('Het dagplafond voor externe modellen is bereikt.'), { code: 'AI_DAGPLAFOND' });
            try { log && log.warn && log.warn('ai-dagplafond', meter.stand()); } catch (e2) {}
            continue;
          }
          /* En de rem per aanroeper. Telt modelaanroepen en geen routes, zodat
             een nieuwe route er automatisch onder valt; zie ./ai-rem.js. */
          if (!aanbieder.lokaal && !rem.magNogVoor()) {
            laatste = laatste || Object.assign(new Error('Te veel modelaanroepen achter elkaar. Probeer het over een minuut opnieuw.'), { code: 'AI_TE_SNEL' });
            continue;
          }
          try {
            const uit = await aanbieder.messages.create(params);
            client.actief = aanbieder.naam;
            client.bron = aanbieder.lokaal ? 'lokaal' : 'extern';
            /* Beide tellen, maar in hun eigen emmer: extern kost geld, intern
               kost capaciteit. De verhouding tussen die twee is het signaal dat
               je wilt zien -- de keten is lokaal-eerst, dus loopt het aandeel
               extern op, dan haakt de eigen modelserver af. Zie ./ai-meter.js. */
            try {
              if (aanbieder.lokaal) meter.boekLokaal(
                (typeof aanbieder.modelVoor === 'function' ? aanbieder.modelVoor(params) : null)
                  || (aanbieder.modellen && aanbieder.modellen.tekst), uit && uit.usage);
              else meter.boek(params && params.model, uit && uit.usage);
            } catch (e2) {}
            return uit;
          } catch (e) {
            try { if (aanbieder.lokaal) meter.boekLokaalFout(); else meter.boekFout(); } catch (e2) {}
            laatste = e;
            try { log && log.warn && log.warn('ai-uitwijk', { van: aanbieder.naam, fout: (e && e.message || '').slice(0, 120) }); } catch (e2) {}
            // door naar de volgende aanbieder
          }
        }
        if (laatste) throw laatste;
        const fout = new Error('Geen ingestelde modelprovider ondersteunt deze capability.');
        fout.code = 'AI_CAPABILITY_NIET_BESCHIKBAAR';
        throw fout;
      }
    }
  };
  return client;
}

/* Wat we hierover aan SCHERMEN vertellen -- modus, verwerking, privacy, welke
   capability via welke aanbieder loopt -- staat in ./ai-stand.js. Dat is een
   andere vraag dan deze: hier wordt uitgeweken, daar wordt verantwoord. */

/* Een kort ja/nee-oordeel, via dezelfde uitwijkketen. Losse modules die maar
   een classificatie nodig hebben (is dit maatschappelijk belangrijk? hoort dit
   bij die categorie?) bouwden daar elk hun eigen aanroep voor, met hun eigen
   modelnaam erin. Dat is precies de plek waar een hardcoded afhankelijkheid
   ontstaat: zo'n module zit stil vast aan Claude en mist de uitwijk.

   Hier staat het een keer: het lichte model (MODEL_KORT, overschrijfbaar met
   AI_MODEL_KORT) en het lezen van het antwoord. Geeft true, false, of null --
   null betekent "geen oordeel" (geen sleutel, geen enkele aanbieder haalde
   het, of een onleesbaar antwoord). De aanroeper valt dan terug op zijn eigen
   heuristiek; een AI-storing mag nooit een besluit forceren. */
const MODEL_KORT = process.env.AI_MODEL_KORT || 'claude-sonnet-5';
async function jaNee(ai, system, tekst) {
  if (!ai || !ai.messages) return null;
  try {
    const r = await ai.messages.create({
      model: MODEL_KORT, max_tokens: 8, system: String(system || ''),
      messages: [{ role: 'user', content: String(tekst || '').slice(0, 500) }]
    });
    const t = ((r && r.content) || []).map(b => (b && b.text) || '').join(' ').toLowerCase();
    if (/\b(ja|yes)\b/.test(t)) return true;
    if (/\b(nee|no)\b/.test(t)) return false;
    return null;
  } catch (e) { return null; }
}

/* Een kort STUK TEKST, via dezelfde uitwijkketen. Zelfde reden als jaNee: zodra
   een app zijn eigen messages.create schrijft, staat de modelnaam in die app en
   mist hij de uitwijk. Apps die de AI iets laten samenvatten, opstellen of
   uitpluizen roepen dit aan.

   Geeft null bij geen sleutel of als geen enkele aanbieder het haalde -- nooit
   een verzonnen antwoord, zodat de aanroeper eerlijk "de AI is even niet
   bereikbaar" kan tonen in plaats van iets te doen alsof. */
async function tekst(ai, system, prompt, opties) {
  if (!ai || !ai.messages) return null;
  const o = opties || {};
  try {
    const r = await ai.messages.create({
      model: o.model || MODEL_KORT,
      max_tokens: Math.min(2000, Number(o.max) || 400),
      system: String(system || ''),
      messages: [{ role: 'user', content: String(prompt || '').slice(0, o.invoerMax || 12000) }]
    });
    const t = ((r && r.content) || []).map(b => (b && b.text) || '').join('').trim();
    return t || null;
  } catch (e) { return null; }
}

module.exports = { maakAI, bouwKetting, jaNee, tekst, MODEL_KORT };
