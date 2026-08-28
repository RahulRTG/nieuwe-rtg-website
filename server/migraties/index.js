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
/* TWEE PROCESSEN DIE TEGELIJK OPSTARTEN, en waarom dat hier echt misging.

   RTG draait in groepen: server/vloot.js start leden, kantoor en rtf als aparte
   processen op DEZELFDE databasemap. Ze migreren dus allemaal bij het opstarten.

   Hier stond: lees welke migraties al gedraaid zijn, en draai daarna wat
   ontbreekt. Dat lezen en dat schrijven stonden NIET in dezelfde transactie.
   Twee processen zagen dus allebei "migratie 2 ontbreekt", allebei draaiden ze
   hem, en de tweede liep vast op UNIQUE constraint failed: schema_versie.n.
   Die fout was fataal, dus de kantoor-groep viel om, de poortwachter gaf 502,
   en test/vloot.test.js zakte op "de vloot komt op binnen 120s". Vier ronden op
   dezelfde code: twee keer rood, twee keer groen -- hij bijt alleen als de
   machine vol staat, en dat is precies wanneer je hem niet kunt gebruiken.

   DE REPARATIE IS EEN SLOT EN GEEN VANGNET. Elke migratie opent nu met
   BEGIN IMMEDIATE: SQLite geeft dan meteen een schrijfslot af, en een tweede
   proces WACHT (busy_timeout) in plaats van er blind naast te schrijven. En
   omdat wachten niet genoeg is -- na het wachten is de wereld veranderd --
   kijkt hij BINNEN de transactie opnieuw of het nummer er al staat. Staat het
   er, dan is een ander proces hem voor geweest: dat is geen fout maar een
   verloren race, en dan hoort hij door te lopen.

   Wat NIET verandert: elke migratie houdt zijn eigen transactie (faalt hij, dan
   is er niets half gebeurd en stopt de rij daar), en elke andere fout dan deze
   blijft fataal. Half doorgaan na een echte migratiefout is hoe je een schema
   krijgt dat nergens meer op lijkt.

   HET SLOT HEEFT GEDULD NODIG, EN DAT KOMT VAN DE AANROEPER. Zonder
   busy_timeout krijgt de verliezer meteen SQLITE_BUSY in plaats van te
   wachten. Dat geduld hoort bij het OPENEN van de database en staat daar ook,
   op alle drie de plekken die er een openen -- met de wachttijd VOOR het
   aanzetten van WAL, want dat aanzetten neemt zelf een exclusief slot. Daar
   zat de tweede helft van deze fout: twee van die drie zetten hem erna.
   test/migratierace.test.js bewaakt die volgorde nu.

   Hier stond eerst een eigen wachttijd-omhulsel dat de busy_timeout optilde
   voor de duur van de rij. Dat is eruit gehaald omdat het niet te laten zakken
   was: met die wachttijd op nul bleef de raceproef drie ronden groen. Tegen de
   tijd dat de rij begint, hebben de processen elkaar al gevonden bij het
   openen. Een tweede plek die dezelfde waarheid draagt en waarvan niemand kan
   aantonen dat hij iets doet, is geen veiligheidsnet maar ruis (LAT.md regel 4
   en 9). */
function draai(db, opties) {
  const o = opties || {};
  controleer(db);
  const al = new Set(gedraaid(db).map(r => r.n));
  const uit = [];
  const overgeslagen = [];
  for (const m of MIGRATIES.slice().sort((a, b) => a.n - b.n)) {
    if (al.has(m.n)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      /* Opnieuw kijken, nu MET het slot in de hand. Tussen het lezen hierboven
         en dit moment kan een ander proces hem hebben gedraaid; dan is er hier
         niets meer te doen. */
      const er = db.prepare('SELECT 1 AS x FROM schema_versie WHERE n = ?').get(m.n);
      if (er) {
        db.exec('COMMIT');
        al.add(m.n);
        overgeslagen.push(m.n);
        if (o.log) o.log('migratie ' + m.n + ' (' + m.naam + ') was al gedraaid door een ander proces');
        continue;
      }
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
  return { gedraaid: uit, overgeslagen, stand: stand(db) };
}

module.exports = { draai, stand, gedraaid, controleer, hoogsteBekend, MIGRATIES };
