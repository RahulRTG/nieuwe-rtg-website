/* ============================================================================
   LUISTEREN, EN WEER NETJES DICHTGAAN.

   Waar de server op gaat staan, wat er gebeurt als dat niet lukt, de poorten
   die er naast staan (STUN; IMAP en SMTP staan in ./luister-poorten.js), het
   eigen TLS-certificaat via ACME, en de afsluiter op SIGTERM/SIGINT.
   ========================================================================== */
'use strict';

module.exports = function luister(deps) {
  const { app, log, db, accounts, save, webpush, kern, DATA_DIR, flushBijAfsluiten } = deps;

  const PORT = process.env.PORT || 3000;
  /* Waar luisteren we? Draait deze server achter een poortwachter -- als kind
     van server/trio.js (RTG_CLUSTER_KEY) of van de vloot (RTG_DOMAINS) -- dan
     hoort hij ALLEEN op de loopback te staan. Twee redenen:

     1. Veiligheid. Zonder host bindt node op alle interfaces. Dan staat elke
        reserveserver open op het netwerk en kan iedereen in het pand de
        poortwachter overslaan: geen doorstuurregels, geen X-Forwarded-For,
        geen enkele laag ertussen. Alleen de poortwachter hoort naar buiten.

     2. Bereikbaarheid, en die kostte een avond. Zonder host luistert node op
        :: (IPv6). Op een macOS waar net.inet6.ip6.v6only aan staat komt een
        verbinding naar 127.0.0.1 daar nooit aan. De poortwachter gebruikt
        127.0.0.1 en concludeerde dus dat er geen enkele server leefde --
        terwijl alle drie keurig stonden te luisteren. lsof laat ze zien op
        *:3001 tot *:3003, en de site geeft ondertussen "alle servers zijn
        tijdelijk onbereikbaar".

     RTG_BIND overschrijft dit als iemand het bewust anders wil. Draait de
     server los (npm run single), dan blijft hij gewoon op alle interfaces --
     dan is hij zelf de voordeur. */
  const HOST = process.env.RTG_BIND ||
    ((process.env.RTG_CLUSTER_KEY || process.env.RTG_DOMAINS) ? '127.0.0.1' : '');
  function gestart() {
    /* Het protocol uit de werkelijkheid en niet uit een aanname. Met RTG_TLS=1
       termineert de app zelf TLS (web/index.js), en dan stond hier tot nu toe
       http:// -- juist in de stand die je zet omdat je https nodig hebt voor
       camera en microfoon. Een adres dat niet werkt is erger dan geen adres. */
    const schema = process.env.RTG_TLS === '1' ? 'https' : 'http';
    if (process.env.RTG_SERVER) {
      console.log(`klaar op poort ${PORT}, rol: ${db.writable ? 'actief' : 'standby'}`);
    } else {
      console.log(`RTG-portaal draait op ${schema}://localhost:${PORT}, open ${schema}://localhost:${PORT}/apps/app.html`);
    }
    console.log(`Live updates (SSE) actief${webpush ? ', web-push actief' : ' (web-push niet geladen)'}.`);
    // camera en microfoon werken op een telefoon alleen op https; opzet/
    // veiligadres.js waarschuwt op http en wijst op https de weg naar het toestel
    require('./veiligadres')({ PORT, HOST });
  }
  const server = HOST ? app.listen(PORT, HOST, gestart) : app.listen(PORT, gestart);

  /* De twee MAILPOORTEN die naast de site staan -- IMAP (meelezen) en SMTP
     (post aannemen). Ze staan in ./luister-poorten.js omdat dit bestand anders
     over de tien kilobyte gaat, en de knip loopt langs een echte grens: hier
     gaat het over de webserver, daar over twee losse deuren die allebei UIT
     staan tenzij iemand er een poort voor zet. */
  require('./luister-poorten')(kern);

  /* EEN BEZETTE POORT IS EEN STARTFOUT, GEEN SERVERFOUT.

     app.listen meldt een mislukking (EADDRINUSE als de poort bezet is, EACCES
     onder 1024 zonder rechten) via een 'error'-gebeurtenis op de server. Er
     luisterde niemand, dus viel hij door naar het uncaughtException-vangnet.

     Het proces STOPTE daar wel netjes op, met exitcode 1 -- ik had eerst
     opgeschreven dat het bleef hangen, en dat was niet waar; nagemeten doet de
     oude code precies wat hij hoort te doen. Wat er wel misging zit in de
     BENOEMING. De regel die er dan in het log verschijnt draagt
     "bron":"uncaughtException" en "fataal":true, en test/helper.js rekent
     uitgerekend dat patroon af als een serverfout die de hele testrun laat
     falen. De helper legt in zijn eigen commentaar uit dat een poort-race
     voorkomt en dat hij daarom opnieuw probeert -- maar de geslaagde herkansing
     nam de valse "server-uitzondering" niet meer weg. Een testrun kon zo rood
     worden door een poortbotsing die keurig was opgevangen.

     Een startfout hoort ook een startfout te heten. Deze luisteraar noemt hem bij
     naam ("poort ... is al in gebruik") onder bron "listen", en stopt meteen met
     een foutcode zodat een proces-manager ons herstart. */
  server.on('error', (err) => {
    const waar = (HOST || '0.0.0.0') + ':' + PORT;
    const uitleg = err && err.code === 'EADDRINUSE'
      ? 'poort ' + waar + ' is al in gebruik -- draait er al een RTG-server?'
      : (err && err.code === 'EACCES'
        ? 'geen rechten om op ' + waar + ' te luisteren (poorten onder 1024 vragen root of CAP_NET_BIND_SERVICE)'
        : 'kon niet op ' + waar + ' luisteren: ' + (err && err.message));
    console.error('[start] ' + uitleg);
    try { log.uitzondering(err instanceof Error ? err : new Error(String(err)), { bron: 'listen', fataal: true }); } catch (e) {}
    process.exit(1);
  });
  // Eigen STUN-server (RFC 5389) voor (video)bellen: geen leun meer op de publieke
  // STUN van Google. Draait op UDP (STUN_PORT, standaard 3478); STUN_UIT=1 zet uit.
  // De socket is unref'd, dus dit houdt het afsluiten nooit tegen.
  const stunServer = require('../stun').start({ log });
  /* Satellietvriendelijk: op hoge-latency verbindingen (satelliet, traag mobiel)
     duurt een nieuwe TLS-handshake al snel seconden. Houd bestaande verbindingen
     daarom ruim open, dan wordt hij hergebruikt in plaats van opnieuw opgezet.
     headersTimeout hoort boven keepAliveTimeout te blijven (Node-vereiste). */
  server.keepAliveTimeout = 75000;
  server.headersTimeout = 90000;

  /* Native TLS + eigen ACME: als de app zelf TLS termineert (RTG_TLS=1) EN ACME aan
     staat (RTG_ACME=1 + RTG_TLS_DOMAIN + RTG_TLS_EMAIL), haalt en vernieuwt ze zelf
     een echt Let's Encrypt-certificaat en laadt dat live in -- geen certbot, geen
     reverse proxy. Volledig gated; standaard uit, en het mag de app nooit laten
     vallen (mislukt de uitgifte, dan blijven we op het self-signed cert draaien).
     Zet RTG_ACME_STAGING=1 om eerst tegen de staging-CA te oefenen (geen rate-limit). */
  if (process.env.RTG_TLS === '1' && process.env.RTG_ACME === '1' && server && typeof server.herlaadCert === 'function') {
    const domeinen = String(process.env.RTG_TLS_DOMAIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const email = String(process.env.RTG_TLS_EMAIL || '').trim();
    if (domeinen.length && email) {
      require('../lib/tls-acme').startAcme({ server, domains: domeinen, email, dataDir: DATA_DIR, staging: process.env.RTG_ACME_STAGING === '1', log: (m) => log.info(m) })
        .then(() => log.info('[tls] ACME actief voor ' + domeinen.join(', ')))
        .catch((e) => log.warn('[tls] ACME-start mislukt; app draait door op het self-signed cert: ' + e.message));
    } else {
      log.warn('[tls] RTG_ACME=1 maar RTG_TLS_DOMAIN/RTG_TLS_EMAIL ontbreekt; ACME overgeslagen.');
    }
  }

  /* STERF MET DE POORTWACHTER -- alleen als het trio ons startte (clustersleutel
     EN IPC-lijn); wie met de hand start heeft geen ouder om mee te sterven.
     Zonder dit blijft een server na een harde dood van de poortwachter draaien
     met zijn poort vast, en krijgt de herstartende poortwachter zijn eigen
     servers niet aan de praat terwijl /api/health 200 geeft: de wees antwoordt.
     Via SIGTERM, zodat de data langs precies dezelfde afsluiter landt. */
  if (process.channel && process.env.RTG_CLUSTER_KEY) {
    process.on('disconnect', () => {
      console.log('[stop] de poortwachter is weg, deze server sluit');
      process.emit('SIGTERM');
    });
  }

  // Netjes afsluiten: data wegschrijven, verbindingen sluiten, dan pas stoppen.
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
    console.log(`[stop] ${sig} ontvangen, data wordt bewaard...`);
    try { save(); } catch (e) {}
    /* Het doorgeefjournaal spoelt per venster; wat nu nog in die stapel staat,
       staat nog nergens. Synchroon, want een asynchrone spoeling haalt
       process.exit() niet meer. */
    try { require('../kern/journaalbestand').spoelAlle(); } catch (e) {}
    // Bij Postgres: nog een laatste flush zodat niets in de write-behind hangt.
    Promise.allSettled([Promise.resolve(flushBijAfsluiten()), Promise.resolve(accounts.flushBijAfsluiten())]).finally(() => {
      server.close(() => process.exit(0));
    });
    // Vangnet als de flush hangt. Bij write-behind (Postgres) kan een laatste
    // flush op grote schaal seconden duren; 3 s kapte hem af en verloor de laatste
    // write-behind-staat. Ruimer nu, zodat een normale afsluit-flush kan afronden;
    // de klein-eerst-volgorde (server/pg/sync.js) borgt dat geld sowieso als eerste
    // landt, ook als dit vangnet toch nog vuurt.
    setTimeout(() => process.exit(0), Number(process.env.RTG_STOP_GRACE_MS || 20000)).unref();
  });

  return { server, stunServer, PORT, HOST };
};
