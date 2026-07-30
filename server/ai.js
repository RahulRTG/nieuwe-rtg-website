/* De AI-uitwijk: één messages.create die achter de schermen meerdere
   aanbieders kent (Claude, OpenAI, Gemini) en automatisch naar de volgende
   overstapt als er een uitvalt. Zo blijft de persoonlijke AI overeind als
   een aanbieder een storing of een 429/5xx heeft -- de rest van de code
   (kern/stuur.js, translate.js, alle helpers) roept gewoon
   anthropic.messages.create(...) aan en merkt van de uitwijk niets.

   De volgorde is Claude eerst (ons hoofdmodel), dan OpenAI, dan Gemini;
   alleen aanbieders met een sleutel doen mee. maakAI() geeft null terug als
   er helemaal geen sleutel staat -- dan draait de demostand, net als nu. */
'use strict';
const Anthropic = require('./anthropic');
const OpenAI = require('./openai');
const Gemini = require('./gemini');

// welke aanbieders in welke volgorde; env kan de volgorde overschrijven
function bouwKetting(opts) {
  opts = opts || {};
  const beschikbaar = {
    claude: () => (opts.anthropicKey || process.env.ANTHROPIC_API_KEY) ? new Anthropic(opts.anthropic) : null,
    openai: () => (opts.openaiKey || process.env.OPENAI_API_KEY) ? new OpenAI(opts.openai) : null,
    gemini: () => (opts.geminiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? new Gemini(opts.gemini) : null
  };
  const volgorde = (opts.volgorde || (process.env.AI_VOLGORDE || 'claude,openai,gemini').split(','))
    .map(s => s.trim().toLowerCase()).filter(n => beschikbaar[n]);
  const ketting = [];
  for (const naam of volgorde) { const c = beschikbaar[naam](); if (c) ketting.push(c); }
  return ketting;
}

function maakAI(opts) {
  const ketting = bouwKetting(opts);
  if (!ketting.length) return null; // geen enkele sleutel: demostand
  const log = opts && opts.log;
  const client = {
    aanbieders: ketting.map(c => c.naam),
    actief: ketting[0].naam,
    messages: {
      async create(params) {
        let laatste = null;
        for (const aanbieder of ketting) {
          try {
            const uit = await aanbieder.messages.create(params);
            client.actief = aanbieder.naam;
            return uit;
          } catch (e) {
            laatste = e;
            try { log && log.warn && log.warn('ai-uitwijk', { van: aanbieder.naam, fout: (e && e.message || '').slice(0, 120) }); } catch (e2) {}
            // door naar de volgende aanbieder
          }
        }
        throw laatste || new Error('Geen enkele AI-aanbieder beschikbaar.');
      }
    }
  };
  return client;
}

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
