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
const { kompasStatus } = require('./ai-kompas');
const kostenhaak = require('./kern/kosten/haak'); // begint leeg; KOSTEN.md par. 6
const meter = require('./ai-meter');
const rem = require('./ai-rem');
const budget = require('./ai-budget');

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

/* Welk model werd er geleverd. Het antwoord zegt het zelf (`model`); zegt het
   niets, dan is alleen bij Claude het gevraagde model ook het geleverde. Bij een
   andere aanbieder is de gevraagde naam een Claude-naam die daar nooit draaide,
   en dan boeken we de aanbieder -- die staat niet in de prijstabel en telt dus
   duur, liever te vroeg dicht dan te laat (ARBEID.md par. 4 punt 12). */
function geleverdModel(aanbieder, params, uit) {
  if (uit && typeof uit.model === 'string' && uit.model) return uit.model;
  if (aanbieder && aanbieder.naam === 'claude') return params && params.model;
  return 'onbekend:' + ((aanbieder && aanbieder.naam) || 'aanbieder');
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
        /* DE VERBRUIKSGRENS (kern/kosten/grens.js), vlak voor het geld. Dicht:
           dan geen aanroep, en valt de app terug op de regelgestuurde werkmodus
           die er toch al is voor als er geen model is -- het verschil tussen een
           grens en een storing. Zonder grens kost dit een kaartopzoeking. */
        /* De grens gaat over GELD, dus hij sluit alleen de aanbieders die geld
           kosten. Hier stond een throw vóór de hele keten: dan ging ook de eigen
           modelserver dicht, terwijl die geen euro kost (ARBEID.md par. 4 punt
           12). Dicht is nu: extern overslaan, lokaal gewoon laten antwoorden. */
        const grens = kostenhaak.magUitgeven();
        const grensDicht = !!(grens && grens.ok === false);
        let laatste = null;
        for (const aanbieder of ketting) {
          if (typeof aanbieder.kan === 'function' && !aanbieder.kan(params)) continue;
          if (grensDicht && !aanbieder.lokaal) {
            laatste = laatste || Object.assign(new Error(grens.uitleg || 'De verbruiksgrens voor deze gebruiker is bereikt.'), { code: 'KOSTENGRENS' });
            continue;
          }
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
          /* En het budget van deze PERSOON. Alleen extern, om dezelfde reden
             als hierboven: de eigen modelserver kost geen geld. Een oppervlak
             van de RTFoundation sluit hier nooit -- zie ./ai-budget.js. */
          if (!aanbieder.lokaal) {
            let ruimte = null;
            try { ruimte = budget.magNog(); } catch (e2) {}
            if (ruimte && !ruimte.mag) {
              laatste = laatste || Object.assign(new Error(budget.BERICHT), { code: 'AI_BUDGET_OP' });
              continue;
            }
          }
          try {
            const uit = await aanbieder.messages.create(params);
            client.actief = aanbieder.naam;
            client.bron = aanbieder.lokaal ? 'lokaal' : 'extern';
            /* DE KOSTENMETER (kern/kosten/haak.js), op de enige plek waar elke
               modelaanroep langskomt. Geen usage: dan melden we niets.

               NAAST ./ai-meter.js hieronder en niet in plaats daarvan: die telt
               wat het HUIS uitgeeft en hoeveel capaciteit de eigen modelserver
               draagt, deze telt aan WELKE gebruiker de tokens toe te rekenen
               zijn (KOSTEN.md par. 6). Twee vragen, twee tellers. */
            /* Alleen EXTERN: het tarief van ai-invoer is een prijs per token bij
               een aanbieder, en de eigen modelserver kost capaciteit en geen geld
               (die telt ./ai-meter.js in zijn lokale emmer). Hier stond ook het
               lokale verbruik, tegen het externe tarief -- en daarmee ging de
               verbruiksgrens ook voor het lokale model dicht. De invoer is
               GEWOGEN zoals ./ai-meter.js weegt: een cache-leesbeurt een tiende,
               een cache-schrijfbeurt 1,25 keer (die laatste ontbrak hier). */
            const u = uit && uit.usage;
            if (u && !aanbieder.lokaal) {
              const inv = Math.round(meter.gewogenInvoer(u));
              const uitv = Number(u.output_tokens) || 0;
              if (inv > 0) kostenhaak.meld('ai-invoer', inv, { bron: aanbieder.naam });
              if (uitv > 0) kostenhaak.meld('ai-uitvoer', uitv, { bron: aanbieder.naam });
            }
            /* Beide tellen, maar in hun eigen emmer: extern kost geld, intern
               kost capaciteit. De verhouding tussen die twee is het signaal dat
               je wilt zien -- de keten is lokaal-eerst, dus loopt het aandeel
               extern op, dan haakt de eigen modelserver af. Zie ./ai-meter.js. */
            try {
              if (aanbieder.lokaal) meter.boekLokaal(
                (typeof aanbieder.modelVoor === 'function' ? aanbieder.modelVoor(params) : null)
                  || (aanbieder.modellen && aanbieder.modellen.tekst), uit && uit.usage);
              else {
                /* Het model dat ANTWOORDDE, niet het gevraagde: wie om een
                   Claude-naam vraagt en bij OpenAI uitkomt, betaalt OpenAI.
                   Onbekend valt in ./ai-meter.js op het duurste tarief. */
                const kosten = meter.boek(geleverdModel(aanbieder, params, uit), uit && uit.usage);
                /* Het budget telt in euro en de meter in dollar; de omrekening
                   staat in ./ai-budget-beleid.js. Ook een vrijgestelde aanroep
                   wordt geboekt -- je wilt zien wat de Foundation kost, hij
                   wordt er alleen niet op afgesloten. */
                budget.boek(kosten);
              }
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

/* De twee korte aanroepen (jaNee, tekst) en het lichte model dat ze gebruiken
   staan in ./ai-kort.js: dat is een gemakslaag OP deze keten, geen deel ervan. */
module.exports = { geleverdModel, maakAI, bouwKetting };
