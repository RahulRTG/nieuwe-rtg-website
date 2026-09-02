/* ============================================================================
   DE DIENSTENLAAG: live updates, meldingen, en de diensten die daarop leunen.

   Dit is de laag die niemand ziet en iedereen gebruikt: de SSE-bus, de meldingen
   en web-push, de afstand- en ETA-rekenaars, het archief, de beveiliging, de
   Wacht, RTmail, de naamlaag, de antivirus, en de twee poortwachters waar bijna
   elke route achter staat (resolveSession en auth).

   HOE DEZE SNEE TOT STAND KWAM. De eerste poging ging op het oog: knippen,
   draaien, de foutmelding lezen, een naam toevoegen, opnieuw. Dat liep vast --
   dit blok gebruikt tweeendertig namen die het niet zelf maakt en levert er
   eenenvijftig op, en elke serverstart kost veertig seconden. Erger nog: op het
   oog zie je de derde soort niet, een naam die dit blok TOEWIJST terwijl hij
   buiten gedeclareerd staat.

   Daarom is er scripts/blokscan.js gekomen: die rekent met de AST-gereedschappen
   van dit huis in een keer uit wat een regelbereik nodig heeft, wat eruit moet,
   en welke draden er terug lopen. De lijsten hieronder komen daar rechtstreeks
   vandaan en zijn niet met de hand bijgehouden.

   DE TWEE DRADEN. scanNet en wacht staan in server.js als een `let`, omdat
   middleware ze per verzoek raadpleegt. Ze worden HIER gebouwd en DAAR gezet --
   niet andersom, want een toewijzing aan een binding uit een ander bestand is
   een verborgen draad die pas breekt als iemand verplaatst.
   ========================================================================== */
'use strict';

module.exports = function maakDiensten(deps) {
  const {
    DATA_DIR, DEMO, PERSONAS, accounts, crypto, db, eigenaar, findSupplier, i18n, 
    ledenGidsAantal, ledenGidsActief, ledenGidsExact, ledenGidsHaal, ledenGidsHaalWacht, ledenGidsWeg,
    ledenGidsZet, ledenGidsZoek, ledenPrijs, maakLive, mail,
    onExternalChange, ordersVanKlant, rtf, save, schild, schoon, sessionFor, sessions, herbouwSessions,
    sseToOffice, sseToSupplier, tokenHash
  } = deps;
  /* TWEE NAMEN DIE ER NOG NIET ZIJN als dit blok draait: lidBoardUit en
     lidPadFunctie worden verderop in server.js gebouwd, terwijl deze laag daar
     al boven staat. Dat werkte omdat de handlers ze pas bij een VERZOEK lezen --
     een afspraak die nergens stond en die bij het verplaatsen meteen omviel.
     scripts/blokscan.js ziet dit niet: volgorde is een looptijd-eigenschap, geen
     eigenschap van de boom. Daarom staat het hier met de hand, expliciet. */
  const lidBoardUit = (...a) => deps.lidBoardUitVan()(...a);
  const lidPadFunctie = (...a) => deps.lidPadFunctieVan()(...a);
  /* ---------- live updates (SSE) + notificaties + web-push ----------
     Elk open scherm (website-portaal of app) houdt een SSE-verbinding open.
     Bij elke wijziging sturen we:
     - 'sync'   → betrokken schermen herladen hun data zonder page-refresh
     - 'notify' → een notificatie voor de eigenaar van een post/betaling,
       ook als web-push wanneer het scherm dicht is. */

  // Onze eigen web-push (server/webpush.js): VAPID + RFC 8291-payloadversleuteling
  // op Node's crypto, i.p.v. het pakket `web-push`. Zelfde API, geen dependency.
  let webpush = null;
  try { webpush = require('../webpush'); } catch (e) { /* zonder push: alleen SSE */ }

  // welke persona hoort bij een auteursnaam (voor gerichte notificaties)
  const AUTHOR_TIER = {
    'Katja Kiss': 'rtg',
    'Fleur Johanna': 'lifestyle',
    'Rahul Imran': 'business'
  };

  /* Realtime-bus: zonder REDIS_URL in-proces (huidig gedrag), met REDIS_URL via
     Redis pub/sub zodat live-events ook gebruikers op een ander domeinproces
     bereiken. Elke sseTo*-functie publiceert; elk proces levert de events af aan
     zijn eigen open verbindingen. */
  const bus = require('../bus').maakBus();
  /* De huisbrede deurrem van RTG Link deelt zijn missers over dezelfde leiding
     (kern/link/rem.js, LINK.md par. 3.7). Hier en niet in de linklaag zelf: de
     bus wordt hier gemaakt, en de rem is een singleton die maar EEN keer mag
     worden aangesloten. Zonder REDIS_URL verandert er niets -- dan is deze bus
     in-proces en telt hij precies zoals hij altijd telde. */
  require('../kern/link/rem').remBus(bus);

  /* De realtime-afleverlaag (open verbindingen + terugspeelbuffer + id-teller)
     zit in een maak…(state)-fabriek; de fabriek abonneert leverSse zelf op de bus
     en geeft dezelfde clients-array/buffer-Map terug, zodat de routes en het
     onderhoudslus er ongewijzigd op werken. */
  const { maakSse } = require('../kern/sse');
  const { sseClients, sseBuffer, nextSseId, bufferEvent, speelOpnieuw, leverSse, sseSend, ruimBuffer, SSE_BUFFER_TTL } =
    maakSse({ bus });

  // Geo-rekenhulp zit in een eigen, zuivere module (server/lib/geo.js).
  const geo = require('../lib/geo');
  const toRad = geo.toRad;
  const haversine = geo.haversine;
  const etaMinutes = geo.etaMinutes;

  /* De live-/geo-laag (sseToCustomer, liveCodename, connectedSupplierCodes,
     pushLive, liveStateFor, guestsFor) staat in server/kern/live.js. Vroeg
     opgezet omdat de sociale kern hieronder al sseToCustomer nodig heeft. De
     functies dragen db, de bus, de SSE-routers, geo-helpers en i18n;
     sseToSupplier, sseToOffice en findSupplier zijn hoisted functies. */
  const { sseToCustomer, liveCodename, connectedSupplierCodes, pushLive, liveStateFor, guestsFor } =
    maakLive({ db, bus, nextSseId, PERSONAS, sseToSupplier, sseToOffice, findSupplier, haversine, etaMinutes, i18n, ordersVanKlant });
  /* De ledengids (sleutel -> codenaam + pas) staat in server/kern/gids.js:
     dirTouch, ledental, opzoeken en zoeken op codenaam, met of zonder Postgres. */
  const { GIDS_SEED_TIERS, dirTouch, ledenAantal, ledenAantalVerversen, gidsHaal, gidsHaalWacht, gidsZoekCodenaam, keyVanCodenaam, gidsWeg } =
    require('../kern/gids')({ db, save, liveCodename, ledenGidsActief, ledenGidsHaal, ledenGidsHaalWacht, ledenGidsZet, ledenGidsWeg, ledenGidsExact, ledenGidsZoek, ledenGidsAantal });
  // Bij gedeelde data (Redis): na een externe wijziging de sessie-index opnieuw
  // vullen, zodat een lezersproces tokens kent die de schrijver net aanmaakte.
  onExternalChange(() => {
    ledenAantalVerversen(); // externe wijziging: ledental opnieuw bepalen
    if (!db.data || !db.data.sessions) return;
    herbouwSessions();
  });

  /* Alles wat elk partnerbedrijf standaard nodig heeft; wordt gebruikt voor
     bestaande bedrijven (migratie bij opstarten) en voor nieuwe partners die
     via de onboarding worden goedgekeurd. */
  /* Ledenprijsgarantie (partnervoorwaarden): een lid betaalt bij een partner nooit
     meer dan de eigen publieke prijs van die partner. De publieke prijs is de
     referentie (het plafond); de ledenprijs wordt daar altijd op afgekapt. Dit
     wordt op drie plekken afgedwongen: bij het normaliseren van een menukaart,
     bij het opslaan ervan, en nog eens bij het plaatsen van een bestelling. */

  const ensureSupplierDefaults = require('../kern/supplierdefaults')({ db, ledenPrijs });

  /* De Salon-regel -- wanneer een partner zichtbaar is voor leden -- staat in
     ./salonregel.js. Geen infrastructuur maar een regel over wie er in de
     leden-app verschijnt; een naam erdoor, vier terug, nul draden. */
  const { ondernemerpoort, salonItemsVan, salonProfielCompleet, salonZichtbaar } =
    require('./salonregel')({ db });

  /* De meldingenlaag -- welke meldingen er zijn, wie ze krijgt en langs welke weg
     -- staat in ./meldingen.js. Naad nagemeten: dertien namen erdoor, zes terug,
     nul draden. */
  const {
    broadcastSync, eigenaarAccount, initRealtime, notify, sendPush, sendPushToUser
  } = require('./meldingen')(Object.assign({}, deps, {
    DEMO, GIDS_SEED_TIERS, PERSONAS, accounts, bus, crypto, db, eigenaar, 
    ensureSupplierDefaults, save, sessions, tokenHash, webpush
  }));
  /* De diensten en de twee poortwachters staan in ./diensten2.js. De naad is
     nagemeten met scripts/blokscan.js: zeventien namen erdoor, vijftien terug,
     nul draden. */
  const {
    aiPoort, antivirus, archief, atelierweb, auth, automatisering, beveilig, naamlaag, 
    resolveSession, sessieregister, toestellen, bezitsbewijs, tweefactor, commercieel, commercieelStand, commercieelZet, mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, mailAanname, scanNet, wacht, werkmail
  } = require('./diensten2')(Object.assign({}, deps, {
    DATA_DIR, PERSONAS, accounts, crypto, db, dirTouch, eigenaarAccount, findSupplier, 
    lidBoardUit, lidPadFunctie, mail, rtf, save, schild, schoon, sendPushToUser, sessionFor
  }));


  return {
    AUTHOR_TIER, SSE_BUFFER_TTL, aiPoort, antivirus, archief, atelierweb, auth, automatisering, 
    beveilig, broadcastSync, bufferEvent, bus, connectedSupplierCodes, dirTouch, 
    ensureSupplierDefaults, etaMinutes, gidsHaal, gidsHaalWacht, gidsWeg, gidsZoekCodenaam, guestsFor,
    haversine, initRealtime, keyVanCodenaam, ledenAantal, leverSse, liveCodename, liveStateFor, 
    mailQ, mailIn, mailAuth, mailBijlage, mailSleutel, rtmailAi, naamlaag, nextSseId, notify, ondernemerpoort, pushLive, resolveSession, sessieregister, toestellen, bezitsbewijs, tweefactor, commercieel, commercieelStand, commercieelZet, rtmail, rtmailTeam, 
    rtmailVak, rtmailDraad, rtmailSchrijf, rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar, mailAanname, 
    ruimBuffer, salonItemsVan, salonProfielCompleet, salonZichtbaar, scanNet, sendPush, 
    sendPushToUser, speelOpnieuw, sseBuffer, sseClients, sseSend, sseToCustomer, toRad, wacht, 
    webpush, werkmail
  };
};
