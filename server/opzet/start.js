/* ============================================================================
   DE START: DE VOLGORDE WAARIN DEZE SERVER WAKKER WORDT.

   Dit bestand is de dirigent, niet de muziek. Elk onderdeel staat ernaast en
   heeft zijn eigen uitleg:

     ./afsluiters.js    de nette 404 en de centrale foutafhandeling
     ./opslagstart.js   realtime, Redis, SQLite-sync, Postgres (blijven proberen)
     ./backup.js        de dagelijkse back-up: wat erin hoort en hoe lang
     ./bewaarveger.js   wissen op termijn, en tot wanneer iemand lid is
     ./startcontrole.js de eerlijke waarschuwingen bij een productiestart
     ./luister.js       de poort, IMAP, STUN, ACME, en netjes dichtgaan

   WAAROM DIT UIT server.js IS GEHAALD. Dat bestand was 184 kB en daarmee het
   enige onderdeel dat de eigen lat (`npm run keuring`) niet haalde. Splitsen op
   een echte naad is dan beter dan de lat verhogen, en dit is de duidelijkste
   naad die er is: alles hierin draait EEN keer, bij de start, en niets ervan
   wordt door een route aangeroepen.

   TWEE DINGEN DIE OM DE VOLGORDE VRAGEN, en die dus niet zomaar mogen
   verschuiven:

   1. DE AFSLUITERS MOETEN ALS LAATSTE GEREGISTREERD WORDEN. Express loopt de
      handlers in volgorde af; wie eerder gaat staan, vangt routes af die nog
      moesten komen. Deze module wordt dus onderaan server.js aangeroepen, na
      alle routers -- en de afsluiters gaan hier als eerste.
   2. backupData KOMT HIER VANDAAN MAAR WORDT EERDER GEBRUIKT. De cluster-route
      roept hem aan direct na een overname. Dat mag: die route DRAAIT pas als de
      server luistert, en dan is deze module allang klaar. Daarom geeft hij
      backupData terug in plaats van hem zelf ergens te bewaren -- een tweede
      plek met dezelfde waarheid is precies wat we niet willen.
   ========================================================================== */
'use strict';

module.exports = function start(deps) {
  const {
    app, fs, path, PUBLIC_DIR, DATA_DIR, UPLOAD_DIR,
    log, db, accounts, save, eigenaar, webpush, kern,
    checkpointSqlite, checkpointGrootboek,
    initRealtime, startGedeeld, startSqliteSync, startPostgres, flushBijAfsluiten,
    DEMO, PRODUCTION, zetEigenaarsAccount, loginFails, pinSlot, ruimBuffer
  } = deps;

  require('./afsluiters')({ app, path, PUBLIC_DIR, log });

  const { backupData } = require('./backup')({
    fs, path, DATA_DIR, db, accounts, checkpointSqlite, checkpointGrootboek
  });

  require('./opslagstart')({ log, accounts, initRealtime, startGedeeld, startSqliteSync,
    startPostgres, DEMO, zetEigenaarsAccount });

  /* Periodiek onderhoud: verlopen snelheidslimiet-tellers en oude event-buffers
     opruimen, zodat het geheugen niet langzaam volloopt bij veel unieke
     bezoekers. De ronde zelf staat in ./onderhoud.js en niet hier, want in een
     `setInterval` van vijf minuten kan geen enkele toets erbij -- en juist deze
     veger heeft twee keer de inlogrem gelost. Hier blijft alleen de klok. */
  const { onderhoudsronde, RONDE_MS } = require('./onderhoud');
  setInterval(() => onderhoudsronde({ loginFails, pinSlot, ruimBuffer }), RONDE_MS).unref();

  backupData();
  setInterval(backupData, 24 * 60 * 60 * 1000);

  /* De bewaarveger en de regel eronder (tot wanneer iemand lid is) staan in
     ./bewaarveger.js. Die regel gaat over iemands gegevens en hoorde niet
     middenin een opstartblok te staan. */
  require('./bewaarveger')({ db, save, accounts, log, UPLOAD_DIR });

  require('./startcontrole')({ PRODUCTION, DEMO, accounts, eigenaar });

  const { server } = require('./luister')({ app, log, db, accounts, save, webpush, kern,
    DATA_DIR, flushBijAfsluiten });

  return { server, backupData };
};
