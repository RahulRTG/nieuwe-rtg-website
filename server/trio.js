/* RTG failover-trio: drie identieke servers met een poortwachter ervoor.

   Start: npm start (of node server/trio.js). De site blijft gewoon op
   http://localhost:3000 draaien; daarachter staan drie servers:

     server 1 op poort 3001 (actief)
     server 2 op poort 3002 (standby)
     server 3 op poort 3003 (standby)

   De poortwachter controleert elke twee seconden of de actieve server nog
   leeft. Valt hij uit, dan neemt de volgende gezonde server het direct over:
   die laadt eerst de laatste data van schijf (promote) en krijgt dan al het
   verkeer. De gevallen server wordt automatisch herstart en zodra hij tien
   seconden stabiel draait, krijgt hij het werk weer terug.

   Het bewakingsdeel (starten, hartslag, wie is actief) staat in
   ./trio-wacht.js; dit bestand is de poortwachter zelf. */
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { maakWacht } = require('./trio-wacht');

const LOKAAL_TLS = process.env.RTG_LOKAAL_TLS === '1';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.RTG_BIND || undefined;
const AANTAL = 3;
const BASISPOORT = Number(process.env.RTG_TRIO_BASIS || PORT + 1); // 3001, 3002, 3003
const SLEUTEL = crypto.randomBytes(24).toString('hex'); // deelt het trio onderling
const FAILBACK_MS = 10000;  // zo lang moet een herstelde server stabiel zijn
const CHECK_MS = 2000;      // hartslagcontrole

const log = m => console.log('[poortwachter] ' + m);
const wacht = maakWacht({ AANTAL, BASISPOORT, SLEUTEL, FAILBACK_MS, log });
const { servers } = wacht;

/* ---------- de poortwachter: al het verkeer naar de actieve server ---------- */

function stuurDoor(req, res, body, idx, magOpnieuw) {
  const s = servers[idx];
  const headers = { ...req.headers };
  headers['x-forwarded-for'] = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '') + (req.socket.remoteAddress || '');
  if (!headers['x-forwarded-proto']) headers['x-forwarded-proto'] = LOKAAL_TLS ? 'https' : 'http';
  const proxy = http.request({ host: '127.0.0.1', port: s.port, path: req.url, method: req.method, headers }, pres => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res); // streamt ook SSE gewoon door
  });
  proxy.on('error', async () => {
    /* Ook s.rol, en niet alleen s.healthy: 'onbereikbaar betekent rol uit' is de
       invariant waar trio-wacht.js op leunt, en een invariant die op een van de
       twee plekken niet wordt gezet, is er geen. kleefDoel() filtert toevallig
       ook op healthy, dus het gedrag klopte -- maar dan hangt het aan een detail
       in een andere module in plaats van aan de regel zelf. */
    s.healthy = false; s.healthySince = 0; s.rol = 'uit';
    if (res.headersSent || !magOpnieuw) { try { res.destroy(); } catch (e) {} return; }
    await wacht.kiesActieve('server ' + s.nr + ' liet een verzoek vallen');
    const actief = wacht.actieve();
    if (actief < 0) return uitleg503(res);
    /* Opnieuw kleven en niet blind naar de leider: de gevallen server staat nu
       op rol 'uit' (hierboven), dus kleefDoel wijst dit lid vanzelf een ANDERE
       meeloper toe -- en de rest van de leden blijft staan waar hij stond. Dat
       is de hele reden dat er rendezvous-hashing onder zit. */
    const opnieuw = wacht.kleefDoel(req, actief);
    if (opnieuw !== idx) stuurDoor(req, res, body, opnieuw, false);
    else uitleg503(res);
  });
  if (body && body.length) proxy.end(body); else proxy.end();
}
function uitleg503(res) {
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Alle servers zijn tijdelijk onbereikbaar; ze worden automatisch herstart. Probeer het over een paar seconden opnieuw.' }));
}

/* Het certificaat wordt bij elke start opnieuw uitgegeven voor de adressen die
   deze computer nu heeft; de CA eronder blijft dezelfde, dus wat u eenmaal op
   uw telefoon vertrouwt blijft goed. */
let tlsCert = null;
if (LOKAAL_TLS) {
  try { tlsCert = require('./lokaal-tls').certVoorDezeMachine(); }
  catch (e) { console.error('[poortwachter] lokale https lukte niet: ' + e.message); process.exit(1); }
}

const afhandelen = (req, res) => {
  // Het certificaat en de uitlegpagina hangen ook aan de beveiligde kant, zodat
  // een telefoon die alleen https accepteert er nog steeds bij kan.
  if (LOKAAL_TLS && require('./lokaal-tls').loketAntwoord(req, res, tlsCert, PORT)) return;
  // Het verzoek eerst binnenhalen (verzoeken zijn klein: JSON en foto's tot
  // ruwweg een megabyte); dan kan het bij een uitval veilig opnieuw naar de
  // volgende server, ook halverwege een POST.
  const delen = [];
  let groot = 0;
  req.on('data', d => { groot += d.length; if (groot <= 20 * 1024 * 1024) delen.push(d); });
  req.on('end', async () => {
    if (groot > 20 * 1024 * 1024) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Verzoek te groot.' })); return; }
    const idx = await wacht.wachtOpActieve(15000);
    if (idx < 0) return uitleg503(res);
    /* De leider is de TERUGVAL, niet automatisch de bestemming. Staat spreiding
       aan, dan kiest de kleefroutering (./trio-kleef.js) welke meelopende server
       dit lid krijgt -- steeds dezelfde, zodat een lid zijn eigen zojuist
       opgeslagen gegevens terugziet. Staat spreiding uit, dan geeft kleefDoel de
       terugval ongewijzigd terug en gaat er niets anders dan voorheen. */
    stuurDoor(req, res, Buffer.concat(delen), wacht.kleefDoel(req, idx), true);
  });
};
const poort = LOKAAL_TLS ? https.createServer({ key: tlsCert.key, cert: tlsCert.cert }, afhandelen)
  : http.createServer(afhandelen);

/* Een klein http-loketje ernaast, alleen om het CA-bestand op te halen. Uw
   telefoon vertrouwt onze certificaten nog niet, dus dat bestand moet langs een
   gewone verbinding binnenkomen; alle andere adressen sturen we door naar de
   beveiligde site. Verder staat er niets op dit loket. */
let caLoket = null;
if (LOKAAL_TLS) {
  caLoket = http.createServer((req, res) => {
    if (require('./lokaal-tls').loketAntwoord(req, res, tlsCert, PORT)) return;
    const gastheer = String(req.headers.host || '').split(':')[0] || 'localhost';
    // de voorpagina vertelt een mens of hij binnen is en wat er nog moet gebeuren
    if ((req.url || '/').split('?')[0] === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(require('./lokaal-tls').loketPagina(PORT, gastheer));
    }
    res.writeHead(302, { Location: 'https://' + gastheer + ':' + PORT + (req.url || '/') });
    res.end();
  });
  caLoket.on('error', e => console.error('[poortwachter] CA-loket: ' + e.message));
}
poort.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('Poort ' + PORT + ' is al in gebruik. Draait de site al?'); process.exit(1); }
  console.error('[poortwachter]', e.message);
});

/* ---------- netjes starten en stoppen ---------- */

(async () => {
  const poortGestart = () => log('luistert op ' + (LOKAAL_TLS ? 'https' : 'http') + '://' + (HOST || 'localhost') + ':' + PORT);
  if (HOST) poort.listen(PORT, HOST, poortGestart); else poort.listen(PORT, poortGestart);
  if (caLoket) {
    const loketGestart = () => log('CA-loket op http://' + (HOST || 'localhost') + ':' + (PORT + 10) + '/rtg-ca.crt');
    if (HOST) caLoket.listen(PORT + 10, HOST, loketGestart); else caLoket.listen(PORT + 10, loketGestart);
  }
  // Server 1 eerst, zodat een verse database maar door een server wordt
  // aangemaakt; daarna de twee standby-servers.
  wacht.startServer(0);
  for (let w = 0; w < 60 && !(await wacht.isGezond(servers[0].port)); w++) await new Promise(r => setTimeout(r, 500));
  await wacht.kiesActieve(null);
  wacht.startServer(1);
  wacht.startServer(2);
  setInterval(wacht.hartslag, CHECK_MS);
  setTimeout(() => {
    console.log('');
    /* De stand hardop, en niet de standaardstand als er een andere draait: een
       opstartregel die "2 en 3 standby" zegt terwijl ze allebei verkeer aannemen,
       is precies de soort onwaarheid waar een storingsdienst uren op zoekt. */
    if (wacht.spreiding.aan()) {
      console.log('  Drie servers draaien en nemen ALLE DRIE verkeer aan (poorten ' + servers.map(s => s.port).join(', ') + '),');
      console.log('  met server 1 als leider. Een lid gaat steeds naar hetzelfde proces (kleefroutering op de sessie).');
    } else {
      console.log('  Drie servers draaien: 1 actief (poort ' + servers[0].port + '), 2 en 3 standby (' + servers[1].port + ', ' + servers[2].port + ').');
    }
    console.log('  De site staat op ' + (LOKAAL_TLS ? 'https' : 'http') + '://localhost:' + PORT + '. Valt een server uit, dan neemt de volgende het direct over');
    console.log('  en wordt de gevallen server automatisch herstart.');
    if (LOKAAL_TLS) console.log(require('./lokaal-tls').startUitleg(tlsCert, PORT));
    else console.log('');
  }, 2500);
})();

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  if (wacht.gestopt()) return;
  log(sig + ' ontvangen, alle servers worden netjes gestopt');
  wacht.stop();
  poort.close();
  if (caLoket) try { caLoket.close(); } catch (e) {}
  setTimeout(() => process.exit(0), 3000);
});
