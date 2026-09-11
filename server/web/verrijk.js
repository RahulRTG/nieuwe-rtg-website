/* web, deel "verrijk": de req/res-objecten optuigen met de express-vorm die de
   app gebruikt -- req.body/params/query/path/ip/protocol, res.status/json/send/
   set/type/redirect/sendFile. Leunt op ./bestanden voor sendFile en de MIME-tabel. */
'use strict';
const fs = require('fs');
const { padNaar } = require('./routing');
const { stuurBestand, MIME } = require('./bestanden');
const rtgjson = require('../lib/rtgjson');

/* WIE MAG ER EIGENLIJK EEN X-FORWARDED-KOP STUREN?

   "trust proxy: 1" zegt hoeveel hops we vertrouwen, maar niet WIE. Dat is het
   gat dat overbleef: leest de app de kop van iedereen, dan kan een bezoeker die
   RECHTSTREEKS verbinding maakt (geen proxy ertussen) nog steeds zijn eigen
   adres verzinnen -- en dus elke snelheidslimiet omzeilen. Van rechts lezen
   helpt daar niet tegen: zonder proxy IS hij de rechtse.

   De enige waarneming die niemand kan vervalsen is het adres van de verbinding
   zelf. Dus: geloof de kop alleen als de verbinding van een vertrouwde proxy
   komt. Dat klopt in beide opstellingen, zonder dat iemand iets hoeft in te
   stellen:

     - reverse proxy op dezelfde machine of in hetzelfde netwerk -> loopback of
       een privaat adres -> vertrouwd -> de kop telt, per bezoeker geremd;
     - app hangt rechtstreeks aan het internet -> de bezoeker komt van een
       publiek adres -> niet vertrouwd -> zijn kop wordt genegeerd en we tellen
       op de verbinding. Onvervalsbaar.

   Staat de proxy op een publiek adres, zet dan RTG_PROXY_IPS. */
const PRIVATE_IP = /^(::1|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|f[cd])/i;
function vertrouwdeProxy(adres, extra) {
  const a = String(adres || '');
  if (!a) return false;
  if (extra && extra.length) return extra.some(x => a === x || a === '::ffff:' + x);
  return PRIVATE_IP.test(a);
}

function verrijk(req, res, instellingen) {
  const aanZet = !!(instellingen && instellingen['trust proxy']);
  const eigenLijst = (instellingen && instellingen['proxy ips']) || null;
  // vertrouwen = de instelling staat aan EN de verbinding komt van een proxy
  const trustProxy = aanZet && vertrouwdeProxy(req.socket && req.socket.remoteAddress, eigenLijst);
  req.originalUrl = req.originalUrl || req.url;
  const vraag = padNaar(req.url);
  req.path = vraag;
  req.params = req.params || {};
  const qi = req.url.indexOf('?');
  req.query = {};
  if (qi !== -1) { const sp = new URLSearchParams(req.url.slice(qi + 1)); for (const [k, v] of sp) { if (k in req.query) { if (!Array.isArray(req.query[k])) req.query[k] = [req.query[k]]; req.query[k].push(v); } else req.query[k] = v; } }
  req.get = (naam) => {
    const n = String(naam).toLowerCase();
    if (n === 'referer' || n === 'referrer') return req.headers.referer || req.headers.referrer;
    return req.headers[n];
  };
  req.header = req.get;
  /* DE X-FORWARDED-KOP: VAN RECHTS LEZEN, NIET VAN LINKS.

     Hier stond .split(',')[0] -- het LINKSE adres. Dat is precies het stuk dat
     de bezoeker zelf mag verzinnen: een proxy plakt zijn waarneming er rechts
     achter, hij wist links nooit. Met "trust proxy: 1" en een linkse lezing
     kon iedereen dus zelf zeggen wie hij was:

         X-Forwarded-For: 9.9.9.9

     en daarmee bij elk verzoek een vers IP tonen. De rem (server/rem.js) telt
     op req.ip, dus alle snelheidslimieten -- ook de brute-force-grens op de
     inlog -- waren met één kop te omzeilen. En het beveiligingslogboek en de
     quarantaine van De Wacht wezen dan naar een IP van andermans keuze.

     Goed is: van de N hops die we vertrouwen (trust proxy = N) is de meest
     rechtse N onze eigen keten; de eerste daarvoor is de echte aanroeper. Met
     één proxy en één waarde verandert er niets -- alleen het geval waarin
     iemand er zelf iets vóór plakt wordt nu genegeerd. */
  const hops = Math.max(1, Number(instellingen && instellingen['trust proxy']) || 1);
  const vanRechts = (kop) => {
    const lijst = String(req.headers[kop] || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!lijst.length) return '';
    return lijst[Math.max(0, lijst.length - hops)] || '';
  };

  const xfProto = trustProxy ? vanRechts('x-forwarded-proto') : '';
  req.protocol = xfProto || ((req.socket && req.socket.encrypted) ? 'https' : 'http');
  req.secure = req.protocol === 'https';
  const xfHost = trustProxy ? vanRechts('x-forwarded-host') : '';
  req.hostname = String(xfHost || req.headers.host || '').replace(/:\d+$/, '') || undefined;
  req.ip = (trustProxy && vanRechts('x-forwarded-for')) || (req.socket && req.socket.remoteAddress);

  res.status = (code) => { res.statusCode = code; return res; };
  res.set = res.header = function (veld, waarde) {
    if (veld && typeof veld === 'object') { for (const k of Object.keys(veld)) res.setHeader(k, veld[k]); }
    else res.setHeader(veld, waarde);
    return res;
  };
  /* APPEND EN NIET OVERSCHRIJVEN, voor een kop waar MEERDERE lagen iets op kwijt
     willen. `res.set` hierboven is de juiste standaard -- een Content-Type hoort
     geen tweede waarde te krijgen -- maar er zijn koppen waar dat juist fout is.

     DE AANLEIDING, 11 september 2026. `RTG-Niet-Afgedwongen` zegt welke regel dit
     antwoord heeft doorgelaten zonder af te dwingen, en sinds AFSPRAAK.md stap 3
     zijn er twee lagen die hem zetten: het bezitsbewijs en de ledencontractstand
     (opzet/diensten2.js). Met `set` gooit de tweede de eerste weg, en dan staat er
     een kop die bewéért volledig te zijn en dat niet is -- dezelfde fout als twee
     uitkomsten op een hoop gooien.

     EN DE REDEN DAT DIT HIER MOET EN NIET BIJ DE AANROEPER. Deze laag is een eigen
     Express-achtige schil en geen Express: `res.set` bestaat, `res.append` bestond
     niet. Een aanroeper die hem toch gebruikt krijgt geen foutmelding die iemand
     ziet -- binnen een `try/catch` (en auth() heeft er een, want een storing in de
     bewijslaag mag geen overtreding worden) verdwijnt de TypeError volledig, en de
     kop blijft gewoon leeg. Dat is precies zo gebeurd. Twee aanroepers die het
     met de hand samenvoegen zouden daarnaast de samenvoegregel twee keer dragen
     (LAT regel 4); dus staat hij hier, een keer, naast `set`.

     Dezelfde betekenis als in Express: bestaat de kop al, dan wordt het een lijst,
     en node stuurt daar meerdere regels met dezelfde naam voor. */
  res.append = function (veld, waarde) {
    const vorige = res.getHeader(veld);
    if (vorige === undefined) return res.set(veld, waarde);
    const samen = (Array.isArray(vorige) ? vorige : [vorige])
      .concat(Array.isArray(waarde) ? waarde : [waarde]);
    return res.set(veld, samen);
  };
  res.get = (veld) => res.getHeader(veld);
  res.type = (t) => { res.setHeader('Content-Type', t.indexOf('/') === -1 ? (MIME['.' + t.replace(/^\./, '')] || t) : t); return res; };
  res.json = function (obj) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(rtgjson.stringify(obj));
    return res;
  };
  res.send = function (body) {
    if (body == null) { res.end(); return res; }
    if (Buffer.isBuffer(body)) { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream'); res.end(body); return res; }
    if (typeof body === 'object') return res.json(body);
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(String(body));
    return res;
  };
  res.redirect = function (a, b) {
    const code = typeof a === 'number' ? a : 302;
    const url = typeof a === 'number' ? b : a;
    res.statusCode = code; res.setHeader('Location', url); res.end();
    return res;
  };
  res.sendFile = function (fp, cb) {
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { if (cb) return cb(err || new Error('geen bestand')); res.statusCode = res.statusCode >= 400 ? res.statusCode : 404; return res.end(); }
      stuurBestand(req, res, fp, st, () => { res.end(); });
    });
    return res;
  };
}

module.exports = { verrijk };
