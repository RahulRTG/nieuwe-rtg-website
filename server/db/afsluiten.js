/* NETJES STOPPEN, EN KLAAR ZIJN OM VERKEER TE DRAGEN.

   Twee vragen die allebei over de RANDEN van een proceslevensduur gaan en niet
   over het werk ertussenin: is er nog iets onderweg dat eerst binnen moet
   (flushBijAfsluiten), en mag deze instance al verkeer krijgen (opslagKlaar,
   via /api/ready).

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 23911 byte, ruim twee
   keer de grens uit keuringsregel 13. Dit hoorde bij de duurzaamheidsnaad maar
   niet in ./duurzaam.js: daar staat hoe EEN schrijfactie vaststaat, hier staat
   wat er met ALLES gebeurt als het proces begint of eindigt. Twee onderwerpen
   die elkaar raken en niet hetzelfde zijn.

   WAT ER BINNENKOMT. Niets. Alle opslagsoorten die hier worden afgerond zijn
   modules die dit bestand zelf ophaalt; er wordt hier niets geschreven dat niet
   al door save() is gegaan.
   ========================================================================== */
'use strict';
const state = require('./state');
const db = state.db;
const opslag = require('./opslag');
const snapshot = require('./snapshot');
const sqlite = require('./sqlite');
const geheugen = require('./geheugen');
const postgres = require('./postgres');
const tx = require('./tx');
const { STORE } = opslag;
const { schrijfSnapshotNu, snapshotVuil } = snapshot;

/* DEZE REGEL STOND BOVEN DE VERKEERDE FUNCTIE. In index.js hing hij als
   bijschrift boven de kop van saveDuurzaam(), honderdvijftig regels van de
   functie waar hij over gaat. Hier staat hij weer op zijn plek. */
// Laatste flush bij het afsluiten, zodat niets in de write-behind blijft hangen.
async function flushBijAfsluiten() {
  if (db.writable && snapshotVuil()) { try { schrijfSnapshotNu(); } catch (e) {} }
  geheugen.flushGeheugen();   // no-op buiten de geheugen-modus
  // SQLite commit elke save al synchroon, maar de goedkope voorcheck kan een
  // GROTE collectie met een gelijk aantal items even hebben overgeslagen. Bij
  // het afsluiten kijkt afrondSqlite() daarom alles na en vouwt daarna de WAL
  // dicht, zodat een nette stop nooit een wijziging-op-zijn-plaats achterlaat.
  if (db.writable && STORE === 'sqlite') { try { sqlite.afrondSqlite(); } catch (e) {} }
  try { tx.afrondLedger(); } catch (e) {}   // WAL van grootboek.db dichtvouwen
  await postgres.flushBijAfsluiten();
}

// Is de duurzame opslag echt klaar om verkeer te dragen? json/sqlite laden
// synchroon bij de start; Postgres is pas klaar als de gedeelde data geladen is
// EN het RAM-venster (orders/boekingen) uit het grootboek is bijgewerkt (klaar()).
// De load balancer gebruikt dit (via /api/ready) om een koud-opstartende of nog
// warmdraaiende instance over te slaan i.p.v. er verkeer op te zetten.
function opslagKlaar() {
  if (!db.data || typeof db.data !== 'object') return false;
  if (STORE === 'postgres') return postgres.klaar();
  return true;
}

module.exports = { flushBijAfsluiten, opslagKlaar };
