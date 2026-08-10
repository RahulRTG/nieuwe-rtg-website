/* ================= RTG POORTWACHTER (gateway) =================
   Stuurt inkomend verkeer op padprefix naar het juiste domeinproces. Zo kun je
   elk domein (leden, leverancier, kantoor, personeel, auth, social) als een
   eigen server draaien en er toch een adres voor de buitenwereld overhouden.

   Elk domein draait dan als:  RTG_DOMAINS=<domein> PORT=<poort> node server/server.js
   en je wijst de gateway naar die poorten met omgevingsvariabelen, bijv.:
     RTG_UP_SUPPLIER=http://127.0.0.1:3003
     RTG_UP_OFFICE=http://127.0.0.1:3004
   Alles zonder eigen upstream valt terug op RTG_UP_DEFAULT (het hoofdproces).

   BELANGRIJK: zolang de domeinen nog het gedeelde geheugen van de kern delen
   (een db-bestand, een SSE-lijst), hoort er precies EEN proces naar de data te
   schrijven. Echt losse schrijvende processen kunnen pas veilig als de data- en
   realtime-laag gedeeld is (zie docs/architectuur.md). Standaard wijst alles
   daarom naar het hoofdproces; splits pas op als dat klaar is.            */

const http = require('http');
const https = require('https');

const PORT = Number(process.env.RTG_POORT || 3000);
const DEFAULT_UP = (process.env.RTG_UP_DEFAULT || 'http://127.0.0.1:3010').replace(/\/$/, '');

// padprefix -> upstream. Alleen ingevulde upstreams wijken af van de default.
const ROUTES = [
  ['/api/supplier', process.env.RTG_UP_SUPPLIER],
  ['/api/partner',  process.env.RTG_UP_SUPPLIER],
  ['/api/office',   process.env.RTG_UP_OFFICE],
  ['/api/staff',    process.env.RTG_UP_STAFF],
  ['/api/auth',     process.env.RTG_UP_AUTH],
  ['/api/member',   process.env.RTG_UP_MEMBER],
  ['/api/live',     process.env.RTG_UP_MEMBER],
  ['/api/rtf/social', process.env.RTG_UP_SOCIAL],
  ['/api/techniek', process.env.RTG_UP_TECHNIEK],
  ['/api/zakelijk', process.env.RTG_UP_ZAKELIJK],
  ['/api/foundation', process.env.RTG_UP_FOUNDATION]
].filter(([, up]) => up).map(([p, up]) => [p, up.replace(/\/$/, '')]);

function kiesUpstream(pad) {
  for (const [prefix, up] of ROUTES) if (pad === prefix || pad.startsWith(prefix + '/')) return up;
  return DEFAULT_UP;
}

/* EEN TYPFOUT IN EEN UPSTREAM HOORT BIJ HET STARTEN OP TE VALLEN, niet bij het
   eerste verzoek. Stond er `RTG_UP_SUPPLIER=127.0.0.1:3003` (zonder http://),
   dan gooide `new URL` pas als er iemand langskwam -- en dan gaf deze gateway
   een 502 op elk verzoek naar dat domein, zonder ergens te zeggen waarom. Nu
   weigert hij te starten en noemt hij de variabele en de waarde. Zelfde lijn als
   server/config.js voor de hoofdserver: een verkeerde opstelling is geen storing
   om te overleven maar een fout om te melden. */
for (const [naam, waarde] of [['RTG_UP_DEFAULT', DEFAULT_UP], ...ROUTES]) {
  try { new URL(waarde); }
  catch (e) {
    console.error('[poortwachter] ' + naam + ' is geen geldig adres: "' + waarde + '".' +
      ' Zet er een volledig adres met http:// of https:// ervoor.');
    process.exit(1);
  }
}

/* EEN VERZOEKREGEL IS GEEN URL, en dat verschil heeft deze gateway bijna
   gratis omvergetrokken.

   Hier stond `new URL(kiesUpstream(req.url) + req.url)` zonder meer. In HTTP mag
   een verzoekregel ook de ABSOLUTE vorm hebben -- `GET http://ergens/x HTTP/1.1`
   -- en dat is precies de vorm die je naar een proxy stuurt, dus die komt hier
   ook echt langs. Dan wordt de aanroep `new URL('http://127.0.0.1:3010' +
   'http://ergens/x')`, en die GOOIT. Een fout in de verzoekhandler van
   http.createServer is een uncaught exception, dus het PROCES stopt -- en met dit
   proces de voordeur van elk domein. Een curl van een regel, geen inlog nodig,
   en de hele gateway ligt plat.

   Drie dingen houden dat nu tegen, en ze doen elk iets anders:

   1. ALLEEN DE ORIGIN-VORM. Een pad moet met / beginnen. Alles anders is geen
      pad voor ons maar een verzoek om als open proxy te werken, en dat weigeren
      we met 400 in plaats van het te ontleden.
   2. DE JUISTE ONDERLAAG. `http.request` weigert een https-upstream met
      ERR_INVALID_PROTOCOL -- ook een uncaught exception, dus ook een dode
      gateway, en die stond te wachten op de eerste beheerder die
      RTG_UP_SUPPLIER op https zet. De noodserver koos zijn onderlaag al op
      protocol; hier gebeurde dat niet.
   3. EEN VANGNET OM DE HELE HANDLER. Wat we niet hebben voorzien, hoort een 502
      te geven en niet het proces te beeindigen. Een voordeur mag omvallen op
      EEN verzoek, niet op alle volgende.

      DIT VANGNET IS NIET MET EEN MUTATIE NAGETROKKEN, en dat hoort er te staan:
      na 1 en 2 en de controle op de upstreams bij het starten is er geen geval
      meer dat hier nog gooit, dus is er ook niets te meten. Het is een net voor
      het onvoorziene, en dat is per definitie niet te beproeven. Weghalen zou
      geen toets laten zakken -- zie de kop van test/voordeuren.test.js. */
const server = http.createServer((req, res) => {
  try {
    if (!String(req.url || '').startsWith('/')) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Gateway: alleen een pad, geen volledig adres. Deze poortwachter is geen open proxy.\n');
    }
    const up = new URL(kiesUpstream(req.url) + req.url);
    const laag = up.protocol === 'https:' ? https : http;
    const opts = {
      protocol: up.protocol, hostname: up.hostname, port: up.port,
      method: req.method, path: up.pathname + up.search,
      headers: { ...req.headers, host: up.host }
    };
    const door = laag.request(opts, upRes => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res); // pipe, niet bufferen: houdt SSE-streams live
    });
    door.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Gateway: upstream onbereikbaar.'); });
    req.pipe(door);
  } catch (e) {
    console.warn('[poortwachter] verzoek niet door te geven:', (e && e.message) || e);
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Gateway: dit verzoek kon niet worden doorgegeven.\n');
  }
});

/* En een verzoek dat al op HTTP-niveau niet klopt (een kapotte kop, een
   onmogelijke methode) komt nooit bij de handler hierboven. Zonder deze
   luisteraar sluit node zo'n verbinding zelf af, en dat is prima -- maar een
   fout op de SERVER (niet op een verbinding) zou anders alsnog naar boven
   borrelen. */
server.on('clientError', (err, sok) => {
  try { sok.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); } catch (e) {}
});
server.on('error', (e) => console.error('[poortwachter] serverfout:', (e && e.message) || e));

server.listen(PORT, () => {
  console.log(`[poortwachter] gateway op http://localhost:${PORT}`);
  console.log('[poortwachter] default upstream:', DEFAULT_UP);
  for (const [p, up] of ROUTES) console.log(`[poortwachter] ${p}  ->  ${up}`);
});
