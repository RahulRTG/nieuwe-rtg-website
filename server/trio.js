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
const { koppelWerkers } = require('./trio-werkers');
const { maakSchaduw, startWerker } = require('./trio-schaduw');

/* DIT BESTAND DRAAIT IN TWEE GEDAANTEN. Zonder RTG_POORTWACHTERS is er er een:
   de voordeur die zelf luistert en tegelijk de drie servers bewaakt, precies
   zoals altijd. Met RTG_POORTWACHTERS=N wordt dit proces de HOOFD (bewaakt de
   servers, luistert zelf niet) en start het N kopieen van zichzelf als WERKER
   (luisteren op dezelfde poort met SO_REUSEPORT, bewaken niets). De reden staat
   in ./trio-werkers.js: de voordeur was gemeten het plafond, niet de servers. */
const WERKER = process.env.RTG_TRIO_WERKER === '1';
const WERKER_NR = process.env.RTG_TRIO_WERKER_NR || '1';

const LOKAAL_TLS = process.env.RTG_LOKAAL_TLS === '1';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.RTG_BIND || undefined;
const AANTAL = 3;
const BASISPOORT = Number(process.env.RTG_TRIO_BASIS || PORT + 1); // 3001, 3002, 3003
const SLEUTEL = crypto.randomBytes(24).toString('hex'); // deelt het trio onderling
const FAILBACK_MS = 10000;  // zo lang moet een herstelde server stabiel zijn
const CHECK_MS = 2000;      // hartslagcontrole

const log = m => console.log('[poortwachter' + (WERKER ? ' ' + WERKER_NR : '') + '] ' + m);
/* Een werker krijgt zijn stand van de hoofd in plaats van uit eigen hartslagen.
   Beide hebben dezelfde vorm, dus alles hieronder praat tegen `wacht` zonder te
   weten in welke gedaante het draait. */
const wacht = WERKER ? maakSchaduw({ log }) : maakWacht({ AANTAL, BASISPOORT, SLEUTEL, FAILBACK_MS, log });
const { servers } = wacht;

/* Hoeveel voordeurprocessen, en of ze mogen. Zie ./trio-werkers.js. */
const { VOORDEUREN, werkers } = koppelWerkers({ WERKER, wacht, servers, log, LOKAAL_TLS });

/* Het doorsturen zelf -- wat er met EEN verzoek gebeurt -- staat in
   ./trio-proxy.js. Hier blijft alleen het opzetten, starten en stoppen. */
const { stuurDoor, uitleg503 } = require('./trio-proxy').maakProxy({ wacht, servers, LOKAAL_TLS });

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

/* Het CA-loketje ernaast staat in ./trio-loket.js. */
const caLoket = LOKAAL_TLS ? require('./trio-loket').maakCaLoket({ tlsCert, PORT }) : null;
poort.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('Poort ' + PORT + ' is al in gebruik. Draait de site al?'); process.exit(1); }
  console.error('[poortwachter]', e.message);
});

/* ---------- netjes starten en stoppen ---------- */

(async () => {
  /* EEN WERKER LUISTERT ALLEEN. reusePort laat de kernel de verbindingen over de
     processen verdelen; zonder die vlag geeft de tweede listen een EADDRINUSE. */
  if (WERKER) return startWerker({ poort, PORT, HOST, log });
  const poortGestart = () => log('luistert op ' + (LOKAAL_TLS ? 'https' : 'http') + '://' + (HOST || 'localhost') + ':' + PORT);
  // Met voordeurprocessen luistert dit proces zelf NIET: zijn event-loop blijft
  // vrij voor de hartslag, en dat maakt de bewaking juist betrouwbaarder.
  if (!werkers) { if (HOST) poort.listen(PORT, HOST, poortGestart); else poort.listen(PORT, poortGestart); }
  if (VOORDEUREN > 0 && LOKAAL_TLS) log('RTG_POORTWACHTERS=' + VOORDEUREN + ' NIET aangezet: met RTG_LOKAAL_TLS geeft elk ' +
    'voordeurproces bij het starten zijn eigen certificaat uit, en dan ziet een telefoon per verbinding een ander ' +
    'certificaat van dezelfde site. Zet TLS ervoor (reverse proxy) als u meerdere voordeuren wilt.');
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
  if (werkers) werkers.startAlle();
  /* Na elke hartslag de stand delen. deel() stuurt alleen als er iets veranderd
     is, dus in rust gaat er niets over de lijn. */
  setInterval(async () => { await wacht.hartslag(); if (werkers) werkers.deel(); }, CHECK_MS);
  setTimeout(() => {
    console.log('');
    /* De stand hardop, en niet de standaardstand als er een andere draait: een
       opstartregel die "2 en 3 standby" zegt terwijl ze allebei verkeer aannemen,
       is precies de soort onwaarheid waar een storingsdienst uren op zoekt. */
    if (werkers) console.log('  ' + VOORDEUREN + ' voordeurprocessen delen poort ' + PORT + '; dit proces bewaakt alleen.');
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
  log(sig + ' ontvangen, ' + (WERKER ? 'deze voordeur sluit' : 'alle servers worden netjes gestopt'));
  wacht.stop();
  /* Eerst de voordeuren, dan de servers: andersom staan er nog processen
     verkeer aan te nemen naar backends die net gesloten zijn. */
  if (werkers) werkers.stop();
  try { poort.close(); } catch (e) {}
  if (caLoket) try { caLoket.close(); } catch (e) {}
  setTimeout(() => process.exit(0), WERKER ? 1000 : 3000);
});
