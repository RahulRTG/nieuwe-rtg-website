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

module.exports = { maakAI, bouwKetting };
