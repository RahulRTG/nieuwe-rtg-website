/* ============================================================================
   Versiebeheer op het databaseschema.

   Hiervoor gingen schemawijzigingen zo:

       try { db.exec('ALTER TABLE ... ADD COLUMN ...'); } catch (e) {}

   Dat werkt -- voor een kolom erbij, op een installatie. Wat het niet geeft:

   - EEN VERSIENUMMER. Je kunt van een database niet vragen waar hij staat. Bij
     een storing om drie uur 's nachts is "welke versie draait hier" de eerste
     vraag, en het antwoord was: kijk maar in de kolommen.
   - EEN WEG TERUG. Rol je de code terug naar gisteren, dan draait die code op
     het schema van vandaag. Meestal gaat dat goed. Meestal.
   - EEN VOLGORDE. Twee wijzigingen die van elkaar afhangen, hebben geen
     vastgelegde volgorde als ze allebei in een try/catch staan.

   WAT HIER STAAT, EN WAT ER MET OPZET NIET STAAT

   Wel: genummerde migraties die precies EEN KEER draaien, elk in een eigen
   transactie, met een grootboek van wat wanneer is gedraaid. En een weigering
   om te starten op een database die NIEUWER is dan de code -- dat is het geval
   waarin een terugrol stille schade maakt, en het enige geval waarin stoppen
   beter is dan doorgaan.

   Niet: een terugweg per migratie ("down"). Die belofte is meestal vals -- een
   kolom die je laat vallen, geeft de gegevens niet terug -- en een halve
   terugweg is gevaarlijker dan geen. Terug betekent hier: de back-up terugzetten
   (zie PRODUCTION.md), en dat is een weg die je kunt oefenen.
   ========================================================================== */
'use strict';
const { MIGRATIES } = require('./lijst');

function zorgLedger(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_versie (
    n INTEGER PRIMARY KEY,
    naam TEXT NOT NULL,
    gedraaid_op TEXT NOT NULL
  )`);
}

/* Waar staat deze database? Nul betekent: nog nooit een migratie gezien. Dat is
   zowel een verse database als een database van voor deze laag; het verschil
   maakt niet uit, want migratie 1 is idempotent. */
function stand(db) {
  zorgLedger(db);
  const r = db.prepare('SELECT MAX(n) AS n FROM schema_versie').get();
  return (r && r.n) || 0;
}

function gedraaid(db) {
  zorgLedger(db);
  return db.prepare('SELECT n, naam, gedraaid_op FROM schema_versie ORDER BY n').all();
}

const hoogsteBekend = () => MIGRATIES.reduce((m, x) => Math.max(m, x.n), 0);

/* De weigering. Draait de code van gisteren op de database van vandaag, dan
   ontbreken hier migraties die er wel in de database staan -- en dan schrijft
   die oude code in een schema dat hij niet kent. Dat is precies het moment om
   te stoppen, niet om te proberen.

   Andersom (database ouder dan de code) is geen fout maar de normale gang van
   zaken: dan is er werk te doen, en dat doet draai(). */
function controleer(db) {
  const inDb = stand(db);
  const inCode = hoogsteBekend();
  if (inDb > inCode) {
    throw new Error(
      'De database staat op schemaversie ' + inDb + ', deze code kent er maar ' + inCode + '. ' +
      'Dit is een oudere versie van de software dan waarmee de database is bijgewerkt. ' +
      'Start de nieuwere versie, of zet een back-up van voor de migratie terug (zie PRODUCTION.md).');
  }
  return { inDb, inCode, achter: inCode - inDb };
}

/* Draaien wat er nog te draaien valt.

   Elke migratie krijgt zijn eigen transactie: slaagt hij, dan staat hij in het
   grootboek; faalt hij, dan is er niets half gebeurd en stopt de rij daar. Half
   doorgaan na een mislukte migratie is hoe je een schema krijgt dat nergens
   meer op lijkt. */
function draai(db, opties) {
  const o = opties || {};
  controleer(db);
  const al = new Set(gedraaid(db).map(r => r.n));
  const uit = [];
  for (const m of MIGRATIES.slice().sort((a, b) => a.n - b.n)) {
    if (al.has(m.n)) continue;
    /* IMMEDIATE EN NIET ZOMAAR BEGIN. Een gewone BEGIN is `deferred`: het
       schrijfslot valt pas bij de eerste schrijfactie, dus twee verse processen
       zitten allebei IN de transactie voordat een van beiden iets doet. Dat
       gebeurt echt -- de failover-vloot start er vier tegelijk. Eentje commit,
       de ander loopt stuk op "UNIQUE constraint failed: users.username" en
       meldt dat als een mislukte migratie. IMMEDIATE neemt het slot meteen, dus
       de tweede wacht netjes zijn busy_timeout uit. */
    db.exec('BEGIN IMMEDIATE');
    try {
      /* En dan opnieuw kijken. `al` is gelezen VOOR het slot; wie stond te
         wachten, wacht op iemand die deze migratie net heeft gedraaid. Zonder
         deze tweede blik draait hij hem alsnog over de zojuist geschreven rijen
         heen -- en dat is precies de UNIQUE-fout hierboven. */
      if (gedraaid(db).some(r => r.n === m.n)) { db.exec('COMMIT'); continue; }
      m.op(db);
      db.prepare('INSERT INTO schema_versie (n, naam, gedraaid_op) VALUES (?, ?, ?)')
        .run(m.n, m.naam, new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch (e2) { /* de transactie was al weg */ }
      throw new Error('Migratie ' + m.n + ' (' + m.naam + ') is mislukt en is teruggedraaid: ' + e.message);
    }
    uit.push({ n: m.n, naam: m.naam });
    if (o.log) o.log('migratie ' + m.n + ' (' + m.naam + ') gedraaid');
  }
  return { gedraaid: uit, stand: stand(db) };
}

module.exports = { draai, stand, gedraaid, controleer, hoogsteBekend, MIGRATIES };
