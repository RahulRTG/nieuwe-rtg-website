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

const PORT = Number(process.env.RTG_POORT || 3000);
const DEFAULT_UP = (process.env.RTG_UP_DEFAULT || 'http://127.0.0.1:3010').replace(/\/$/, '');

// padprefix -> upstream. Alleen ingevulde upstreams wijken af van de default.
const ROUTES = [
  ['/api/supplier', process.env.RTG_UP_SUPPLIER],
  ['/api/office',   process.env.RTG_UP_OFFICE],
  ['/api/staff',    process.env.RTG_UP_STAFF],
  ['/api/auth',     process.env.RTG_UP_AUTH],
  ['/api/member',   process.env.RTG_UP_MEMBER],
  ['/api/live',     process.env.RTG_UP_MEMBER],
  ['/api/rtf/social', process.env.RTG_UP_SOCIAL],
  ['/api/foundation', process.env.RTG_UP_FOUNDATION]
].filter(([, up]) => up).map(([p, up]) => [p, up.replace(/\/$/, '')]);

function kiesUpstream(pad) {
  for (const [prefix, up] of ROUTES) if (pad === prefix || pad.startsWith(prefix + '/')) return up;
  return DEFAULT_UP;
}

const server = http.createServer((req, res) => {
  const up = new URL(kiesUpstream(req.url) + req.url);
  const opts = {
    protocol: up.protocol, hostname: up.hostname, port: up.port,
    method: req.method, path: up.pathname + up.search,
    headers: { ...req.headers, host: up.host }
  };
  const door = http.request(opts, upRes => {
    res.writeHead(upRes.statusCode || 502, upRes.headers);
    upRes.pipe(res); // pipe, niet bufferen: houdt SSE-streams live
  });
  door.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Gateway: upstream onbereikbaar.'); });
  req.pipe(door);
});

server.listen(PORT, () => {
  console.log(`[poortwachter] gateway op http://localhost:${PORT}`);
  console.log('[poortwachter] default upstream:', DEFAULT_UP);
  for (const [p, up] of ROUTES) console.log(`[poortwachter] ${p}  ->  ${up}`);
});
