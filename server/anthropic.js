/* Eigen, dunne client voor de Claude Messages-API, i.p.v. het pakket
   @anthropic-ai/sdk. Het MODEL blijft bij Anthropic draaien -- we vervangen
   alleen de HTTP-omhulling. Draait op onze eigen uitgaande HTTP-client
   (./lib/http), geen dependency.

   Zelfde vorm als het pakket, zodat de rest niets merkt:
       const Anthropic = require('./anthropic');
       const anthropic = new Anthropic();                 // sleutel uit env
       const msg = await anthropic.messages.create({ model, max_tokens, ... });
       // msg.content, msg.stop_reason, msg.usage ... net als voorheen

   We gebruiken alleen niet-streamende messages.create (dat is alles wat de code
   nodig heeft, inclusief de tool-lus in kern/stuur.js). Herhaalt netjes bij 429
   en 5xx; bij een echte fout gooit hij (met .status), waarna de aanroeper op zijn
   demo-antwoord terugvalt -- exact het bestaande gedrag. */
'use strict';
const http = require('./lib/http');

const API_VERSIE = '2023-06-01';

/* ---- prompt caching: centraal, voor alle 97 aanroepplekken tegelijk ----

   De Claude-API cachet een prompt alleen als je er expliciet om vraagt
   (cache_control op een blok); zonder markering betaalt elke aanroep de
   volledige invoerprijs, ook voor het grote vaste karakterportret van Rahul
   dat in ELKE systeemprompt gelijk is, en ook voor de complete gespreks-
   geschiedenis die de doe-lus bij elke stap opnieuw meestuurt.

   Dit is de ene plek waar dat goed gezet wordt. Twee markeringen, allebei
   met een drempel, want een cache-SCHRIJF kost 1,25x de invoerprijs en een
   leesbeurt 0,1x -- markeren loont dus alleen als er echt herlezen wordt:

     1. de systeemprompt, als hij groot is (het karakterportret): elke
        vervolgvraag van hetzelfde lid leest hem dan voor een tiende;
     2. het laatste blok van het laatste bericht, als het gesprek lang is:
        de volgende beurt (of de volgende stap van de tool-lus) leest de
        hele voorgaande geschiedenis uit de cache.

   De functie KOPIEERT altijd en muteert nooit: de uitwijkketen (ai.js)
   geeft hetzelfde params-object daarna aan OpenAI of Gemini, en die moeten
   het onaangeraakte origineel zien. Heeft de aanroeper zelf al ergens een
   cache_control gezet, dan blijven we er helemaal vanaf. */
const CACHE_MIN_SYSTEM = 4000;   // tekens; ruim boven het 1024-token-minimum van de API
const CACHE_MIN_GESPREK = 8000;  // tekens totale geschiedenis voordat markeren loont
const CACHEBAAR = { text: 1, image: 1, tool_use: 1, tool_result: 1, document: 1 };
function verrijkMetCache(params) {
  try {
    if (!params || typeof params !== 'object') return params;
    if (JSON.stringify(params).indexOf('cache_control') !== -1) return params;
    let uit = params;
    const kopieer = () => { if (uit === params) uit = Object.assign({}, params); return uit; };

    // 1. de systeemprompt
    const sys = params.system;
    if (typeof sys === 'string' && sys.length >= CACHE_MIN_SYSTEM) {
      kopieer().system = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }];
    } else if (Array.isArray(sys) && sys.length && JSON.stringify(sys).length >= CACHE_MIN_SYSTEM) {
      const laatste = sys[sys.length - 1];
      if (laatste && laatste.type === 'text') {
        kopieer().system = sys.slice(0, -1)
          .concat([Object.assign({}, laatste, { cache_control: { type: 'ephemeral' } })]);
      }
    }

    // 2. de gespreksgeschiedenis
    const msgs = params.messages;
    if (Array.isArray(msgs) && msgs.length >= 2 && JSON.stringify(msgs).length >= CACHE_MIN_GESPREK) {
      const m = msgs[msgs.length - 1];
      let nieuwM = null;
      if (m && typeof m.content === 'string' && m.content) {
        nieuwM = Object.assign({}, m, { content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] });
      } else if (m && Array.isArray(m.content) && m.content.length) {
        const b = m.content[m.content.length - 1];
        if (b && CACHEBAAR[b.type]) {
          nieuwM = Object.assign({}, m, {
            content: m.content.slice(0, -1)
              .concat([Object.assign({}, b, { cache_control: { type: 'ephemeral' } })])
          });
        }
      }
      if (nieuwM) kopieer().messages = msgs.slice(0, -1).concat([nieuwM]);
    }
    return uit;
  } catch (e) { return params; } // bij twijfel: ongemarkeerd versturen, nooit blokkeren
}

class Anthropic {
  constructor(opts) {
    opts = opts || {};
    this.naam = 'claude';
    this.apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseURL = (opts.baseURL || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
    this.timeout = opts.timeout || 600000; // 10 min: modellen mogen lang nadenken
    const zelf = this;
    this.messages = { async create(params) {
      const r = await http.vraag({ url: zelf.baseURL + '/v1/messages', json: verrijkMetCache(params), maxRetries: zelf.maxRetries, timeout: zelf.timeout,
        headers: { 'x-api-key': zelf.apiKey, 'anthropic-version': API_VERSIE, 'user-agent': 'rtg-anthropic/1' } });
      if (r.status >= 200 && r.status < 300) {
        try { return r.json(); } catch (e) { throw new Error('Ongeldig JSON-antwoord van de Claude-API.'); }
      }
      const fout = new Error('Claude-API-fout ' + r.status + ': ' + r.tekst.slice(0, 300));
      fout.status = r.status; fout.body = r.tekst;
      throw fout;
    } };
  }
}

module.exports = Anthropic;
module.exports.Anthropic = Anthropic; // ook als named export, net als het pakket
module.exports.verrijkMetCache = verrijkMetCache; // los te toetsen (test/ai-cache.test.js)
