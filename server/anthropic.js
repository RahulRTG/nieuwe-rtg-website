/* Eigen, dunne client voor de Claude Messages-API, i.p.v. het pakket
   @anthropic-ai/sdk. Het MODEL blijft bij Anthropic draaien -- we vervangen
   alleen de HTTP-omhulling. Puur Node (https), geen dependency.

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
const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_VERSIE = '2023-06-01';

class Anthropic {
  constructor(opts) {
    opts = opts || {};
    this.apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseURL = (opts.baseURL || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
    this.maxRetries = opts.maxRetries != null ? opts.maxRetries : 2;
    this.timeout = opts.timeout || 600000; // 10 min: modellen mogen lang nadenken
    const zelf = this;
    this.messages = { create(params) { return zelf._post('/v1/messages', params); } };
  }

  _post(pad, body) { return new Promise((resolve, reject) => this._probeer(pad, body, 0, resolve, reject)); }

  _probeer(pad, body, poging, resolve, reject) {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(this.baseURL + pad);
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request({
      method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
      headers: {
        'content-type': 'application/json',
        'content-length': data.length,
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSIE,
        'user-agent': 'rtg-anthropic/1'
      }
    }, (res) => {
      const brok = [];
      res.on('data', (c) => brok.push(c));
      res.on('end', () => {
        const tekst = Buffer.concat(brok).toString();
        const status = res.statusCode;
        if (status >= 200 && status < 300) {
          try { resolve(JSON.parse(tekst)); }
          catch (e) { reject(new Error('Ongeldig JSON-antwoord van de Claude-API.')); }
          return;
        }
        if ((status === 429 || status >= 500) && poging < this.maxRetries) { this._nogmaals(pad, body, poging, resolve, reject); return; }
        const fout = new Error('Claude-API-fout ' + status + ': ' + tekst.slice(0, 300));
        fout.status = status; fout.body = tekst;
        reject(fout);
      });
    });
    req.on('error', (e) => { if (poging < this.maxRetries) this._nogmaals(pad, body, poging, resolve, reject); else reject(e); });
    req.setTimeout(this.timeout, () => req.destroy(new Error('Claude-API: tijd verstreken')));
    req.write(data); req.end();
  }
  _nogmaals(pad, body, poging, resolve, reject) {
    setTimeout(() => this._probeer(pad, body, poging + 1, resolve, reject), 500 * Math.pow(2, poging));
  }
}

module.exports = Anthropic;
module.exports.Anthropic = Anthropic; // ook als named export, net als het pakket
