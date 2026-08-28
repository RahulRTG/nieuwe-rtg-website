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
  const { maakDubbeltik } = require('../lib/dubbeltik');
  const geldwegen = require('./geldwegen');
  const { maakAuditspoor } = require('./auditspoor');
  const { bureaublad, cspNonce } = require('../middleware/voordeur');
  const { stijlbundel, PAD: stijlbundelPad } = require('../middleware/stijlbundel');
const { scriptbundel, PAD: scriptbundelPad } = require('../middleware/scriptbundel');
  const { stijlafsplitsing, PAD: stijlafsplitsingPad } = require('../middleware/stijlafsplitsing');
  const { scriptafsplitsing, PAD: scriptafsplitsingPad } = require('../middleware/scriptafsplitsing');

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
  /* De beschermstand wordt HIER gemaakt en niet in de middleware zelf: hij valt
     bij het laden om als een categorie niet is ingedeeld of een uitzondering
     niet meer bestaat (kern/beschermstand.js), en dat hoort te gebeuren bij het
     starten van de server -- niet bij het eerste verzoek dat binnenkomt terwijl
     er een incident loopt. */
  const beschermstand = require('../kern/beschermstand').maakBeschermstand({ functies });
  app.use(schakelaars({ db, accounts, functies,
    sessionFor: t => sessionFor(t),
    findSupplier: c => findSupplier(c),
    bevoegdVan: deps.bevoegdVan,
    beschermstand,
    wachter: functiewachter }));
  app.use(jsonGzip());

  /* DE DUBBELTIK, en zijn plek was eerst fout. Hij moet NA express.json()
     (de sleutel mag in het lijf) en VOOR elke route (een herhaling die de route
     bereikte heeft het werk al gedaan). De eerste versie stond in lijfpoort.js,
     achter de body-parser -- toetsen groen, maar de meting liet negentien
     routes onbeschermd, precies die met een GROOT antwoord.

     Oorzaak: jsonGzip() vervangt res.json OOK, en NA de dubbeltik; boven de
     kilobyte stuurt hij via res.send, buiten de res.json waar de dubbeltik aan
     hing. Die zag zo'n antwoord dus nooit en liet de herhaling het werk opnieuw
     doen. Nergens zichtbaar: klein werd keurig herhaald, en curl (zonder
     compressie) deed het altijd goed.

     Wie het laatst om res.json heen gaat, ziet het antwoord het eerst -- de
     dubbeltik hoort de BUITENSTE wikkel te zijn: na de compressie, voor alle
     routers. test/dubbeltikgzip.test.js eist die volgorde met een herhaling op
     een antwoord boven de kilobyte; mist hij er een, dan zegt hij dat hardop
     (zie dubbeltik.js). */
  /* WELKE WEGEN OM DE DUBBELTIK HEEN GAAN staat in ./geldwegen.js, met het
     verhaal erbij: de geldwegen hebben een sterkere, duurzame laag
     (server/lib/idem.js) en twee wegen onder /api/pay verplaatsen geen geld en
     horen er juist wel langs. Dat is een beleidsregel en geen bedrading, en hij
     hoort niet tussen het monteren van middleware te staan. */
  const dubbeltik = maakDubbeltik({ log, overslaan: (req) => geldwegen.slaOver(req.path) });
  app.use(dubbeltik.middleware());

  /* HET API-SPOOR. Staat naast de dubbeltik en om dezelfde reden hier: hij moet
     voor alle routers hangen, zodat er geen route is die er langs kan. Hij
     noteert NA het antwoord (res.finish), dus hij weet dan wie de route heeft
     ingelogd en hij houdt de bezoeker nergens mee op. Zie de kop van
     ./auditspoor.js voor wat er wel en niet in een regel staat. */
  const auditspoor = maakAuditspoor({ db, save, sessionFor: (t) => sessionFor(t) });
  app.use(auditspoor.middleware());

  let scanNet = null;
  app.use((req, res, next) => (scanNet ? scanNet(req, res, next) : next()));

  /* De idempotentielaag: een POST die zelf een sleutel draagt (idem of
     idempotentieSleutel) wordt bij herhaling niet opnieuw uitgevoerd maar
     krijgt zijn eerste antwoord terug. Opt-in en op EEN plek, in plaats van
     128 route-pleisters -- zie de kop van server/middleware/idempotentie.js.
     Na de body-ontleding (lijfpoort) en de ontsmetter, voor elke router. */
  app.use(require('../middleware/idempotentie')());

  /* De schorspoort (PROOF.md fase 3): schrijvende aanroepen op routes waarvan
     de vervalstaat GESCHORST is (VERTROUWEN.json) krijgen een 503 met de
     reden; lezen blijft open, en alleen een geslaagde hermeting heropent.
     Zie de kop van server/middleware/schorspoort.js voor de grenzen. */
  app.use(require('../middleware/schorspoort')({ log }));

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
  /* En het afgesplitste inline <style>-blok, om dezelfde reden en op dezelfde
     plek. Zie ../middleware/stijlafsplitsing.js. */
  app.get(stijlafsplitsingPad, stijlafsplitsing(PUBLIC_DIR));
  // en het afgesplitste inline <script>-blok, om dezelfde reden
  app.get(scriptafsplitsingPad, scriptafsplitsing(PUBLIC_DIR));
  app.get(/\.(?:js|css|svg|json|webmanifest)$/, statischGzip(PUBLIC_DIR));
  /* Zelfde cache-regel als statischGzip (zie compressie.js): script en stijl
     altijd laten navragen (ETag/304), anders serveert een tussenlaag na een
     update urenlang oud script naast nieuwe html en breekt de app stil. */
  app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, p) => {
      if (/\.(?:js|css|json|webmanifest|svg)$/.test(p)) res.setHeader('Cache-Control', 'no-cache');
    }
  }));

  return { functies, functiewachter, rtf, CSP_NONCE, dubbeltik, auditspoor, zetScanNet: (n) => { scanNet = n; } };
};
