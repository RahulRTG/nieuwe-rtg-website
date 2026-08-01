/* De configuratiekeuring, OPSLAGDEEL: draait deze productiestand op een opslag
   met een rij-voor-rij grootboek?

   Afgesplitst uit ./productie.js zoals ./productie-geld.js dat is: dat bestand
   zegt in zijn eigen kop dat het bij elke doorlichting groeit, en het stond op
   10,2 kB toen deze keuring erbij kwam.

   WAT HIER STOND EN WAAROM HET NIET DEUGDE. Er stond een waarschuwing:
   "DATABASE_URL niet gezet: de gedeelde data draait op een lokaal bestand."
   Twee dingen klopten daar niet aan.

   Ten eerste de VOORWAARDE. Die luidde `!DATABASE_URL && RTG_STORE !== 'sqlite'`,
   maar de opslag kiest json alleen als er OOK een db.json ligt; is die er niet,
   dan wordt het sqlite en is er wel degelijk een grootboek. De waarschuwing wees
   dus een verse installatie ten onrechte aan en liet een bestaande installatie
   met een achtergebleven db.json juist lopen. Nu wordt de stand bepaald met
   dezelfde functie waarmee de opslag hem bepaalt (../db/keuze.js), zodat er maar
   een regel is en de keuring niet iets kan beweren wat de opslag anders invult.

   Ten tweede het GEWICHT. Zonder rij-voor-rij grootboek is er maar een vangnet
   voor een collectie die haar grens raakt: db/tx/index.js schrijft de staart
   naar archief/ en kapt pas als dat gelukt is. Dat is beter dan verlies, maar er
   is geen index, geen paginering, en herstel is handwerk met een jsonl-bestand.
   Voor betalingen en boekingen is dat te mager, dus dit blokkeert de start. Een
   waarschuwing die je kunt negeren beschermt niemand -- dat is de regel bovenaan
   ./productie.js, en hij geldt hier net zo goed.

   Dat het zelden voorkomt is geen reden om het te laten lopen: het treft juist
   de installatie die ooit met een db.json is begonnen en waar DATABASE_URL later
   wegvalt. Dat gebeurt stil. */
'use strict';

const fs = require('fs');
const path = require('path');
const keuze = require('../db/keuze');

/* Ligt er een db.json? Dat bepaalt mee welke stand de opslag kiest, en het is
   het enige wat deze keuring van de schijf hoeft te weten. Faalt de vraag, dan
   gaan we uit van NIET aanwezig: dan valt de keuze op sqlite, en dat is de
   veilige kant om te missen -- hooguit keuren we een stand goed die we niet
   hoefden te keuren, nooit andersom. */
function bestaatDbJson(env) {
  try {
    const map = (env && env.RTG_DATA_DIR) || process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
    return fs.existsSync(path.join(map, 'db.json'));
  } catch (e) { return false; }
}

function keurOpslag(env, fouten, waarschuwingen) {
  const store = keuze.kiesStore(env, bestaatDbJson(env));
  if (!keuze.heeftGrootboek(env, store)) {
    fouten.push('De opslagstand "' + store + '" heeft geen transactie-grootboek: betalingen en boekingen ' +
      'buiten de grens belanden dan in archief/ in plaats van in een geindexeerd grootboek. ' +
      'Zet DATABASE_URL (PostgreSQL) of RTG_STORE=sqlite' +
      (env.TX_LEDGER_SQLITE === '0' ? ' en haal TX_LEDGER_SQLITE=0 weg' : '') + '.');
  }
  /* Sqlite mag, maar deelt niet tussen instances. Dat is een aanbeveling en geen
     blokkade: een enkele bak met sqlite is een geldige productiestand. */
  if (!env.DATABASE_URL && store === 'sqlite')
    waarschuwingen.push('DATABASE_URL niet gezet: de gedeelde data draait op een lokaal SQLite-bestand. Voor meerdere instances wordt PostgreSQL aangeraden.');
  return store;
}

module.exports = { keurOpslag, bestaatDbJson };
