/* ============================================================================
   DE VOORDEURKETEN: WAAR ELK VERZOEK DOORHEEN GAAT VOORDAT ER EEN ROUTE AAN TE
   PAS KOMT.

   In deze volgorde, en die volgorde is de inhoud:

     1. foutisolatie per verzoek  -- een bug in EEN route mag het proces niet raken
     2. proxy-vertrouwen          -- wiens X-Forwarded-For geloven we eigenlijk
     3. logboek + meting          -- correlatie-id, verzoeklog, responstijden
     4. https + HSTS (productie)  -- met de interne kanalen uitgezonderd
     5. het schild en De Wacht    -- ./schildwacht.js
     6. security-headers          -- ./koppen.js, inclusief de terugval-CSP
     7. de AI-meelezer            -- telt mee, doet niets
     8. de lijfpoort              -- ./lijfpoort.js: de webhooks (VOOR
                                     express.json(), want rauwe body), express.json
                                     zelf, de dieptewacht en het zaakdoos-journaal

   TWEE DINGEN DIE HIER LAAT GEBONDEN ZIJN, en dat is geen slordigheid maar de
   enige volgorde die kan: het schild raadpleegt De Wacht, en de meelezer is de
   RTG AI. Allebei worden ze verderop in server.js gebouwd, na de database.
   Daarom nemen ze hier een zetter (zetWacht/zetRtgai) in plaats van een waarde.
   Tijdens het opstarten luistert er nog geen poort, dus er glipt niets langs
   een schild dat nog niets weet.
   ========================================================================== */
'use strict';
const { lokaalAdres } = require('../lib/lokaaladres');

module.exports = function verzoekketen(deps) {
  const { app, express, log, logboek, db, save, betaal, betaalWaarheid, muntbetaal, opslagKlaar,
    zaakdoos, PRODUCTION, beveiligVan, muntenVan, settleFactuurVan, opdrachtenVan } = deps;

  /* ---------- foutisolatie per verzoek ----------
     Een bug in EEN route mag nooit het proces (en dus alle andere apps) raken.
     Express 4 vangt een gegooide fout in een async handler niet zelf op: het
     verzoek blijft hangen en de fout wordt een unhandledRejection. Daarom
     omhullen we elke route-handler: een (async) fout wordt netjes next(err),
     de centrale foutafhandelaar geeft die ENE aanvraag een 500, en de rest
     van het systeem merkt er niets van. */
  for (const methode of ['get', 'post', 'put', 'delete', 'patch', 'all']) {
    const orig = app[methode].bind(app);
    app[methode] = (...args) => orig(...args.map(f => {
      if (typeof f !== 'function') return f; // paden en opties ongemoeid laten
      return (req, res, next) => {
        try {
          const r = f(req, res, next);
          if (r && typeof r.catch === 'function') r.catch(next);
        } catch (e) { next(e); }
      };
    }));
  }
  app.disable('x-powered-by');
  /* Hoeveel proxy-hops staan er ECHT voor deze app?

     Dit stond vast op 1. Dat klopt achter een reverse proxy, maar is gevaarlijk
     zodra de app rechtstreeks bereikbaar is: dan IS de bezoeker de eerste hop en
     mag hij zijn eigen X-Forwarded-For verzinnen -- waarmee elke snelheidslimiet
     (die op req.ip telt) met één kop te omzeilen is. Zie test/proxykop.test.js.

     RTG_PROXY_HOPS=0 zet het vertrouwen helemaal uit: dan telt alleen het adres
     van de verbinding zelf. Dat is de juiste stand voor een app die zonder proxy
     aan het internet hangt. */
  app.set('trust proxy', Number(process.env.RTG_PROXY_HOPS != null ? process.env.RTG_PROXY_HOPS : 1));
  /* WIE die proxy is. Zonder opgave vertrouwen we alleen loopback en private
     adressen -- de gebruikelijke plek voor een reverse proxy. Een bezoeker die
     rechtstreeks vanaf het internet binnenkomt valt daar nooit onder, dus zijn
     X-Forwarded-For wordt genegeerd in plaats van geloofd. Staat de proxy op een
     publiek adres, zet die dan hier (komma-gescheiden). */
  app.set('proxy ips', String(process.env.RTG_PROXY_IPS || '').split(',').map(s => s.trim()).filter(Boolean));
  app.use(logboek.middleware()); // correlatie-id + verzoeklog (methode, pad, status, duur)
  /* De meting draait NA het logboek en VOOR de routes: hij hangt aan res.finish,
     dus hij ziet alles wat er daarna gebeurt, inclusief de 404's. */
  app.use(require('../meting').middleware());
  /* Het routejournaal staat ernaast en doet alleen iets met RTG_ROUTELOG gezet
     (de testrun). Het levert de dekkingsmeting waargenomen feiten in plaats van
     een tekstzoektocht door de tests -- zie server/routelog.js. */
  require('../routelog');   // zet de haak in de router (alleen met RTG_ROUTELOG)

  // In productie: alles naar https, en HSTS zodat browsers het onthouden.
  // (De security-headers zelf, inclusief Referrer-Policy, staan verderop in het
  // gedeelde headerblok -- daar gelden ze voor elk antwoord, ook lokaal.)
  app.use((req, res, next) => {
    if (PRODUCTION) {
      /* De gezondheidsprikken gaan hier NIET doorheen. De poortwachter
         (server/trio.js) controleert zijn drie servers op /api/health over
         gewone http op de loopback -- daar hoort geen TLS bij, en er komt dus
         ook geen X-Forwarded-Proto mee. Kreeg die prik een 301, dan zag de
         poortwachter nooit een 200, concludeerde hij dat geen enkele server
         leefde, en gaf de site 503 terwijl alle drie de servers kerngezond
         stonden te draaien. De failover-opstelling kon in productie dus nooit
         gezond worden. Dat gebeurde op de eerste echte productiemachine, en het
         is van buitenaf niet te zien: lsof laat drie luisterende servers zien
         en de browser krijgt "alle servers zijn tijdelijk onbereikbaar".
         Hetzelfde geldt voor /api/ready en voor de healthcheck in de Dockerfile. */
      /* Hetzelfde geldt voor het hele /api/cluster-kanaal. Dat is het interne
         gesprek tussen poortwachter en servers: promote (word actief), de
         hartslag, het doorgeven van wie de baas is. Ook http, ook loopback.
         Alleen /api/health vrijstellen was half werk: de prik lukte daarna wel,
         maar promote kreeg nog een 301, er werd dus nooit iemand actief, en de
         site bleef 503 geven. Dit kanaal is niet van buiten te misbruiken: het
         eist de gedeelde x-rtg-cluster-sleutel en luistert alleen op 127.0.0.1
         (zie de HOST-keuze in ./luister.js). */
      const intern = req.path === '/api/health' || req.path === '/api/ready' ||
        req.path.indexOf('/api/cluster/') === 0;
      if (!req.secure && !intern) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
      if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    /* EN OOK ZONDER DIE VLAG, als de bezoeker van een ECHT DOMEIN komt.

       Dit hing alleen aan PRODUCTION, en die vlag was op de echte server nooit
       gezet. Van buiten gemeten: http://app.rahultravelgroup.com/apps/app.html
       gaf gewoon 200 met de hele app, geen 301, en op https ontbrak HSTS. Elk
       sessietoken, elk wachtwoord en de backoffice-code gingen daarmee leesbaar
       over de lijn voor wie op http binnenkwam.

       Een slot dat opengaat als iemand een vlag vergeet, is geen slot -- dat is
       vandaag de vierde keer dat diezelfde vorm bovenkomt. Daarom hangt het nu
       aan iets wat niet te vergeten valt: KOMT DIT VAN EEN ECHT DOMEIN? Wie op
       localhost of een adres in het eigen netwerk ontwikkelt, merkt niets (daar
       is ook geen certificaat); wie via een domeinnaam binnenkomt, wordt
       doorgestuurd en krijgt HSTS mee -- ook als NODE_ENV nergens staat. */
    if (!PRODUCTION) {
      /* Welke adressen tellen als lokaal, en waarom, staat in
         ../lib/lokaaladres.js. Kort: adressen waarvoor niemand een certificaat
         kan krijgen -- doorsturen naar https is daar doorsturen naar niets. */
      const lokaal = lokaalAdres(req.get('host'));
      if (!lokaal) {
        const intern2 = req.path === '/api/health' || req.path === '/api/ready' ||
          req.path.indexOf('/api/cluster/') === 0;
        if (!req.secure && !intern2) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
        if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
    }
    next();
  });

  // Het schild en De Wacht staan in ./schildwacht.js: twee lagen die een
  // verzoek kunnen weigeren voordat er een route naar kijkt.
  const { schild, zetWacht } = require('./schildwacht')({ app, log, beveiligVan });

  require('./koppen')({ app });

  /* De meelees-laag van de RTG AI (kern/rtgai.js): telt alleen mee met het
     verkeer en doet verder niets; de kern wordt verderop aangesloten. */
  let rtgaiMeelezer = null;
  app.use((req, res, next) => {
    res.on('finish', () => { try { if (rtgaiMeelezer) rtgaiMeelezer.lees(req.method, req.path, res.statusCode); } catch (e) {} });
    next();
  });

  /* De liegpoort (./liegpoort.js) doet niets zonder RTG_LIEG. Staat die wel,
     dan laat hij de gekozen endpoints een geldig maar LEEG antwoord geven --
     zodat scripts/leugendetector.js kan meten welke endpoints kunnen liegen
     zonder dat een toets rood wordt. Hij staat na de poortwachters (een leugen
     achter een dichte deur zegt niets) en voor de routes. */
  const lieg = require('./liegpoort')({ app, log });

  require('./lijfpoort')({ app, express, db, save, log, betaal, betaalWaarheid, muntbetaal,
    opslagKlaar, zaakdoos, muntenVan, settleFactuurVan, opdrachtenVan });

  return {
    schild, zetWacht, lieg,
    ssrf: require('../kern/ssrf'), // SSRF-afweer voor client-bepaalde uitgaande doelen
    zetRtgai: (r) => { rtgaiMeelezer = r; }
  };
};
// de dieptewacht woont in ./lijfpoort.js; hier alleen doorgegeven voor wie hem
// als losse functie wil toetsen
module.exports.teDiep = require('./lijfpoort').teDiep;
module.exports.MAX_DIEPTE = require('./lijfpoort').MAX_DIEPTE;
