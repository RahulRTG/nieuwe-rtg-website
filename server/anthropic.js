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
      const r = await http.vraag({ url: zelf.baseURL + '/v1/messages', json: params, maxRetries: zelf.maxRetries, timeout: zelf.timeout,
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
