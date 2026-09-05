/* ============================================================================
   DE VOORDEURKETEN: WAAR ELK VERZOEK DOORHEEN GAAT VOORDAT ER EEN ROUTE AAN TE
   PAS KOMT.

   In deze volgorde, en die volgorde is de inhoud:

     1. foutisolatie per verzoek  -- een bug in EEN route mag het proces niet raken
     2. proxy-vertrouwen          -- wiens X-Forwarded-For geloven we eigenlijk
     3. logboek, handeling, meting -- correlatie-id, wat dit verzoek verandert,
                                     verzoeklog en responstijden
     4. https + HSTS             -- ./httpspoort.js, met de interne kanalen uitgezonderd
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
const foutisolatie = require('../lib/foutisolatie');

module.exports = function verzoekketen(deps) {
  const { app, express, log, logboek, db, save, betaal, betaalWaarheid, muntbetaal, opslagKlaar,
    zaakdoos, PRODUCTION, beveiligVan, muntenVan, settleFactuurVan, opdrachtenVan,
    postgresVerzoekMiddleware } = deps;

  /* ---------- foutisolatie per verzoek ----------
     De wikkel zelf staat in lib/foutisolatie.js, en daar alleen. Hij stond hier
     EN woordelijk hetzelfde in foundation/basis.js (die wordt voor de hoofdkern
     gemount en kon deze omhulling niet lenen). Twee plekken die een waarheid
     vasthouden lopen uiteen, en dat bleek meteen toen de wikkel de NAAM van zijn
     functie moest gaan doorgeven -- zonder die naam is uit de router niet te
     lezen welke bewaker voor een route hangt. Zie de kop van die module. */
  foutisolatie.isoleer(app);
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
  /* DE EFFECTMETER, en met opzet als EERSTE laag van de keten.

     Hij hing eerst naast de staatmeter, halverwege, en meldde daar `geen` op een
     verzoek dat een account aanmaakte: de async-context ging tussen die plek en
     de route verloren (de body-lezer parkeert het verzoek, en het vervolg loopt
     dan buiten de context die halverwege is geopend). Een meter die zwijgt waar
     iets gebeurde is erger dan geen meter, dus staat hij nu boven alles wat
     parkeert. Zie server/effectmeter.js.

     Zonder RTG_STAATLOG hangt hij helemaal niet in de keten. */
  require('../effectmeter').haak(app);
  /* In PostgreSQL-modus is dit de antwoordgrens: de request krijgt een
     geisoleerde werkkopie en een 2xx passeert pas na zijn atomaire commit. Hij
     staat vóór bodylezers en dus ook vóór de rauwe betaalwebhooks. */
  if (typeof postgresVerzoekMiddleware === 'function') app.use(postgresVerzoekMiddleware());
  app.use(logboek.middleware()); // correlatie-id + verzoeklog (methode, pad, status, duur)
  // wat verandert dit verzoek: rijen per collectie voor en na (blast radius).
  // NA het logboek want hij leunt op req.id; bewust niet in save(). Zie de kop
  // van ./handeling.js voor de afweging en de gemeten kosten.
  /* En de handeling draagt sinds 3 september 2026 ook WAT VOOR handeling het
     was: risicoklasse en omkeerbaarheid, afgeleid uit vier bronnen die dit huis
     al heeft (TAKEN.md 4.71). De classificatie wordt HIER meegegeven en niet in
     ./handeling.js gerequired -- zo blijft die meting los te draaien zonder de
     registers, en blijft de classificatie een laag die je kunt weglaten. */
  app.use(require('./handeling').middleware({
    klasse: require('../kern/handelingsklasse').maakHandelingsklasse({}).klasseVoor
  }));
  /* De meting draait NA het logboek en VOOR de routes: hij hangt aan res.finish,
     dus hij ziet alles wat er daarna gebeurt, inclusief de 404's. */
  app.use(require('../meting').middleware());
  /* Het routejournaal staat ernaast en doet alleen iets met RTG_ROUTELOG gezet
     (de testrun). Het levert de dekkingsmeting waargenomen feiten in plaats van
     een tekstzoektocht door de tests -- zie server/routelog.js. */
  require('../routelog');   // zet de haak in de router (alleen met RTG_ROUTELOG)
  require('../staatlog').haak(app);  // idem: het tweede meetpunt van de idemproef

  /* De auditmeting (liet dit verzoek een spoor na) staat in ./auditmeting.js --
     een eigen onderwerp, en dit bestand ging er met dat blok erin over de 10 KB. */
  require('./auditmeting')({ app, db: deps && deps.db });

  // In productie: alles naar https, en HSTS zodat browsers het onthouden.
  // (De security-headers zelf, inclusief Referrer-Policy, staan verderop in het
  // gedeelde headerblok -- daar gelden ze voor elk antwoord, ook lokaal.)
  // stap 4: http -> https en HSTS, met de interne kanalen uitgezonderd.
  require('./httpspoort')({ app, PRODUCTION });

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

  /* Een installatie die bewust zonder betalen publiceert, mag nergens een
     betaling simuleren of alleen administratief als voldaan markeren. Deze
     routepoort staat voor de body-parser en dus ook voor alle webhooks. De
     grootboeken hebben verderop nog een tweede, interne stop voor taken die
     niet via HTTP lopen. */
  require('./betaalstop')({ app });

  /* De liegpoort (./liegpoort.js) doet niets zonder RTG_LIEG. Staat die wel,
     dan laat hij de gekozen endpoints een geldig maar LEEG antwoord geven --
     zodat scripts/leugendetector.js kan meten welke endpoints kunnen liegen
     zonder dat een toets rood wordt. Hij staat na de poortwachters (een leugen
     achter een dichte deur zegt niets) en voor de routes. */
  const lieg = require('./liegpoort')({ app, log });

  require('./lijfpoort')({ app, express, db, save, log, betaal, betaalWaarheid, muntbetaal,
    opslagKlaar, zaakdoos, muntenVan, settleFactuurVan, opdrachtenVan });
  /* NA de lijfpoort, want die leest de body -- en dat lezen breekt de
     handelingscontext van stap 3. Zonder deze regel is server/opzet/begroting.js
     blind voor elke POST met een body, en dat is elke mutatie. Het hele verhaal
     staat bij hervat() in ./handeling.js. */
  app.use(require('./handeling').hervat());

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
