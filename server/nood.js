/* ================= RTG NOODSERVER =================
   Draait volledig los van de hoofdservers (trio.js) en is bedoeld voor een
   ANDERE machine bij een ANDERE hoster, zodat er altijd een tweede adres is
   waar alle apps en pagina's het doen, ook als de hoofdservers of hun
   datacenter uitvallen.

   Wat hij doet:
   - Serveert de complete public/-map (website, leden-app, partner-apps,
     PDA, backoffice) als statische pagina's.
   - Stuurt alle /api/-verkeer door naar de hoofdingang (RTG_HOOFD_URL).
   - Zijn de hoofdservers onbereikbaar, dan blijven de pagina's gewoon
     laden en antwoordt de API met een nette 503; de apps vallen dan
     zelf terug op hun demoweergave.

   Starten:  RTG_HOOFD_URL=https://rahultravelgroup.example node server/nood.js
   Poort:    RTG_NOOD_POORT (standaard 3100)                              */

const express = require('./web');
const http = require('http');
const https = require('https');
const path = require('path');

const POORT = Number(process.env.RTG_NOOD_POORT || 3100);
const HOOFD = (process.env.RTG_HOOFD_URL || 'http://localhost:3000').replace(/\/$/, '');
const hoofdUrl = new URL(HOOFD);
const agent = hoofdUrl.protocol === 'https:' ? https : http;

const app = express();
app.disable('x-powered-by');

// dezelfde basisveiligheid als de hoofdserver
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// eigen status, los van de hoofdservers: zijn wij er, en is de hoofdingang er?
app.get('/nood/health', (req, res) => {
  const probe = agent.request({
    hostname: hoofdUrl.hostname, port: hoofdUrl.port || (hoofdUrl.protocol === 'https:' ? 443 : 80),
    path: '/api/health', method: 'GET', timeout: 3000
  }, up => {
    up.resume();
    res.json({ ok: true, nood: true, poort: POORT, hoofd: up.statusCode === 200, hoofdUrl: HOOFD });
  });
  probe.on('timeout', () => probe.destroy(new Error('timeout')));
  probe.on('error', () => res.json({ ok: true, nood: true, poort: POORT, hoofd: false, hoofdUrl: HOOFD }));
  probe.end();
});

/* API-doorgifte naar de hoofdingang. Streaming in beide richtingen, zodat
   ook SSE (realtime meldingen) en CSV-downloads gewoon werken. */
app.use('/api', (req, res) => {
  const doorgifte = agent.request({
    hostname: hoofdUrl.hostname,
    port: hoofdUrl.port || (hoofdUrl.protocol === 'https:' ? 443 : 80),
    path: '/api' + req.url,
    method: req.method,
    headers: { ...req.headers, host: hoofdUrl.host },
    timeout: 15000
  }, antwoord => {
    res.writeHead(antwoord.statusCode, antwoord.headers);
    antwoord.pipe(res);
  });
  const nietBereikbaar = () => {
    if (res.headersSent) return res.end();
    res.status(503).json({
      error: 'De hoofdservers zijn op dit moment niet bereikbaar. U zit op de noodserver: de apps en pagina’s blijven werken, en zodra de hoofdservers terug zijn doet ook inloggen en boeken het hier direct weer.',
      nood: true
    });
  };
  doorgifte.on('timeout', () => doorgifte.destroy(new Error('timeout')));
  doorgifte.on('error', nietBereikbaar);
  req.pipe(doorgifte);
});

// alle apps en pagina's, identiek aan de hoofdserver
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(POORT, () => {
  console.log('[nood] RTG-noodserver luistert op poort ' + POORT + ' · hoofdingang: ' + HOOFD);
  console.log('[nood] bedoeld voor een andere machine/hoster dan de hoofdservers');
});
