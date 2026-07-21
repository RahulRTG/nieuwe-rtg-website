/* Eigen uitgaande HTTP(S)-client, in huis gecodeerd op Node's http/https
   (geen fetch, geen dependency). Eén functie: vraag(opties) -> Promise van
   { status, headers, tekst, json() }. Doet precies wat wij naar buiten toe
   nodig hebben (de AI-providers en de betaalprovider): JSON of form-body
   sturen, headers zetten, een timeout bewaken en bij 429/5xx of een
   netwerkfout netjes herhalen met exponentiele back-off.

   Bewust klein en expliciet: geen redirect-volgen, geen cookies, geen
   streaming -- die hebben wij niet nodig en elke regel minder is een regel
   minder aanvalsvlak. */
'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Eigen keep-alive Agents: houd de TCP/TLS-verbinding naar dezelfde host warm
// tussen (vaak bursty) calls, zodat een volgende call naar de AI- of betaal-
// provider geen nieuwe handshake (1-2 rondjes over het net, en bij TLS extra)
// hoeft te betalen. Node's globalAgent doet dit op Node 22 ook, maar ruimt een
// stille socket al na 1s op; wij houden hem langer aan (30s) en plannen LIFO,
// zodat de meest recent warme socket wordt hergebruikt. Uit te zetten per call
// met opties.agent === false.
const AGENT_OPTIES = { keepAlive: true, keepAliveMsecs: 30000, maxSockets: 64, maxFreeSockets: 16, scheduling: 'lifo', timeout: 60000 };
const httpAgent = new http.Agent(AGENT_OPTIES);
const httpsAgent = new https.Agent(AGENT_OPTIES);

// een form-urlencoded body bouwen (voor de betaalprovider), met geneste
// sleutels als a[b]=c, precies zoals die API's het verwachten
function formBody(obj, voorvoegsel) {
  const delen = [];
  for (const sleutel of Object.keys(obj || {})) {
    const naam = voorvoegsel ? voorvoegsel + '[' + sleutel + ']' : sleutel;
    const w = obj[sleutel];
    if (w == null) continue;
    if (typeof w === 'object' && !Array.isArray(w)) delen.push(formBody(w, naam));
    else if (Array.isArray(w)) w.forEach((el, i) => delen.push(encodeURIComponent(naam + '[' + i + ']') + '=' + encodeURIComponent(String(el))));
    else delen.push(encodeURIComponent(naam) + '=' + encodeURIComponent(String(w)));
  }
  return delen.filter(Boolean).join('&');
}

function vraag(opties) {
  opties = opties || {};
  const maxPogingen = opties.maxRetries != null ? opties.maxRetries : 2;
  const timeout = opties.timeout || 60000;
  let resolve, reject;
  const belofte = new Promise((res, rej) => { resolve = res; reject = rej; });
  probeer(0);
  return belofte;

  function probeer(poging) {
    const u = new URL(opties.url);
    const mod = u.protocol === 'http:' ? http : https;
    const headers = Object.assign({}, opties.headers);
    let data = null;
    if (opties.json !== undefined) {
      data = Buffer.from(JSON.stringify(opties.json));
      if (!headers['content-type']) headers['content-type'] = 'application/json';
    } else if (opties.form !== undefined) {
      data = Buffer.from(typeof opties.form === 'string' ? opties.form : formBody(opties.form));
      if (!headers['content-type']) headers['content-type'] = 'application/x-www-form-urlencoded';
    } else if (opties.body != null) {
      data = Buffer.isBuffer(opties.body) ? opties.body : Buffer.from(String(opties.body));
    }
    if (data) headers['content-length'] = data.length;

    const agent = opties.agent === false ? undefined : (opties.agent || (u.protocol === 'http:' ? httpAgent : httpsAgent));
    const req = mod.request({
      method: opties.method || (data ? 'POST' : 'GET'),
      hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, headers, agent
    }, (res) => {
      const brok = [];
      res.on('data', (c) => brok.push(c));
      res.on('end', () => {
        const status = res.statusCode;
        const tekst = Buffer.concat(brok).toString('utf8');
        if ((status === 429 || status >= 500) && poging < maxPogingen) return nogmaals(poging);
        resolve({ status, headers: res.headers, tekst, json() { return JSON.parse(tekst); } });
      });
    });
    req.on('error', (e) => { if (poging < maxPogingen) nogmaals(poging); else reject(e); });
    req.setTimeout(timeout, () => req.destroy(Object.assign(new Error('HTTP: tijd verstreken'), { code: 'ETIMEDOUT' })));
    if (data) req.write(data);
    req.end();
  }
  function nogmaals(poging) { setTimeout(() => probeer(poging + 1), 500 * Math.pow(2, poging)); }
}

module.exports = { vraag, formBody };
