/* ============================================================================
   DE POORTWACHTERS VOOR DE ROUTERS (server/middleware/).

   Drie remmen, de functieschakelaars, de compressie en de voordeur. Ze staan in
   deze volgorde omdat elke laag werk bespaart voor de laag erna: eerst weigeren
   wat we sowieso weigeren, dan pas comprimeren en serveren.

   DE PLEK VAN HET SCAN-NET, en waarom hij hier staat en niet waar hij gebouwd
   wordt. Verderop in server.js (zoek op "Universeel scan-net") staat een
   middleware die elke schrijf-aanvraag door De Ontsmetter haalt, met de belofte
   dat ALLE upload-plekken "in een klap gedekt" zijn. Die belofte klopte niet:
   express draait middleware in REGISTRATIEVOLGORDE, en de RTFoundation-router
   hieronder wordt eerder gemount. Een verzoek dat die router afhandelt roept
   next() nooit aan en bereikte de scanner dus nooit -- inclusief de fotokant van
   het leerlingenschrift, dat een eigen express.json({limit:'4mb'}) heeft. De
   hele /api/foundation-tak stond buiten het "universele" net.

   De scanner zelf kan hier nog niet gebouwd worden: hij heeft `beveilig` en
   `wacht` nodig en die komen later in de bedrading. Daarom staat hier een dun
   doorgeefluik dat hem aanroept zodra hij er is (zetScanNet). Tijdens het
   opstarten is er nog geen luisterende poort, dus er glipt niets doorheen.
   ========================================================================== */
'use strict';

module.exports = function poortwachters(deps) {
  const { app, express, db, save, log, accounts, eigenaar, PUBLIC_DIR, PRODUCTION,
    opslagKlaar, sseToOffice, sessionFor, findSupplier, sendPushToUser, eigenWeb } = deps;

  const { remOpDeDeur, opslagPoort, hoofdzekering, inlogpauzePoort } = require('../middleware/remmen');
  const { schakelaars } = require('../middleware/functieschakelaars');
  const { jsonGzip, statischGzip } = require('../middleware/compressie');
  const { bureaublad, cspNonce } = require('../middleware/voordeur');
  const { stijlbundel, PAD: stijlbundelPad } = require('../middleware/stijlbundel');
const { scriptbundel, PAD: scriptbundelPad } = require('../middleware/scriptbundel');

  const CSP_NONCE = process.env.RTG_CSP_NONCE !== '0';
  const functies = require('../functies');

  remOpDeDeur(app, PRODUCTION || process.env.RTG_RATELIMIT === '1');
  app.use(opslagPoort(opslagKlaar));
  app.use(hoofdzekering({ db, accounts, eigenaar }));
  // de kleine degraded mode van de noodrem-ladder: alleen de inlogpaden
  app.use(inlogpauzePoort({ db }));
  // sessionFor en findSupplier staan in server.js; ze worden pas bij een echt
  // verzoek geraadpleegd, dus geven we ze lui door in plaats van hier hun
  // waarde te lezen (die er op dit punt nog niet is).
  /* De storingswachter: de automaat van de schakelkast. Meet elke API-respons
     via de schakelaars-middleware, gooit een functie dicht bij een golf echte
     serverfouten en opent hem op proef weer (server/functies/wachter.js). De
     sseToOffice is hoisted en bestaat pas bij het eerste verzoek; vandaar lui. */
  const functiewachter = require('../functies/wachter').maakWachter({
    db, save, log,
    sseToOffice: (ev, data) => sseToOffice(ev, data)
  });
  functiewachter.start();
  app.use(schakelaars({ db, accounts, functies,
    sessionFor: t => sessionFor(t),
    findSupplier: c => findSupplier(c),
    bevoegdVan: deps.bevoegdVan,
    wachter: functiewachter }));
  app.use(jsonGzip());

  let scanNet = null;
  app.use((req, res, next) => (scanNet ? scanNet(req, res, next) : next()));

  // RTFoundation-app: gratis, open onderwijs voor gezinnen met weinig geld
  // (live schoolbord + leerling-schrift + AI-bijles). Aparte router-module,
  // draait mee op dezelfde database en failover.
  const rtf = require('../foundation');
  app.use('/api/foundation', rtf.router);
  // een gezinsmelding voor een gekoppelde oppas/familie ook als telefoonmelding (web-push)
  rtf.setPushHook((userId, note) => { try { sendPushToUser(userId, note); } catch (e) {} });

  /* EEN EIGEN DOMEIN (standaard uit, boardroom-functie 'dom-eigendomein').
     Komt een verzoek binnen op een hostnaam die aan een site gekoppeld is, dan
     serveren we die site hier als gewone HTML -- voor een bezoeker zonder
     leden-app. Dit moet BOVEN het bureaublad staan: dat herschrijft '/' naar
     de leden-app, en op een eigen domein hoort '/' de site van het lid te zijn
     en niet de app van het huis.

     De haak wordt pas verderop in server.js gevuld (de webmaker bestaat hier
     nog niet); zolang hij leeg is verandert er niets aan de keten. */
  app.use((req, res, next) => {
    if (!eigenWeb || typeof eigenWeb.serveer !== 'function') return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // alleen echte paginapaden; assets (met punt) en de API lopen hun gewone weg
    if (req.path.startsWith('/api/') || req.path.indexOf('.') !== -1) return next();
    eigenWeb.serveer(req, res, next);
  });
  bureaublad(app);
  app.use(cspNonce(PUBLIC_DIR, CSP_NONCE));
  /* De gebundelde stijlbladen. Staat NA cspNonce: die laag schrijft de
     verwijzing in de pagina, deze laag levert hem uit. Zie
     ../middleware/stijlbundel.js voor waarom dit wel bij CSS mag en niet bij
     scripts. */
  app.get(stijlbundelPad, stijlbundel(PUBLIC_DIR));
  // en de gebundelde scripts, om dezelfde reden en op dezelfde plek
  app.get(scriptbundelPad, scriptbundel(PUBLIC_DIR));
  app.get(/\.(?:js|css|svg|json|webmanifest)$/, statischGzip(PUBLIC_DIR));
  /* Zelfde cache-regel als statischGzip (zie compressie.js): script en stijl
     altijd laten navragen (ETag/304), anders serveert een tussenlaag na een
     update urenlang oud script naast nieuwe html en breekt de app stil. */
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, p) => {
      if (/\.(?:js|css|json|webmanifest|svg)$/.test(p)) res.setHeader('Cache-Control', 'no-cache');
    }
  }));

  return { functies, functiewachter, rtf, CSP_NONCE, zetScanNet: (n) => { scanNet = n; } };
};
