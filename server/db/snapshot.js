/* Opslag, deel "snapshot": het write-behind wegschrijven van de VOLLEDIGE
   datastore naar een bestand. Gebruikt door de JSON-opslag, en in Postgres-modus
   voor de lokale warme-cache-snapshot.

   Het serialiseren van de HELE datastore is O(alle data): bij een grote kast
   (honderdduizenden tickets) kostte elke mutatie tientallen tot honderden ms
   synchroon, en onder spitsdruk stapelde dat op tot seconden wachtrij voor de
   hele server. Daarom: de eerste save schrijft nog steeds DIRECT (zelfde
   duurzaamheid voor losse acties), maar een burst wordt gecoalesceerd tot een
   flush per venster. Het venster reguleert zichzelf: nooit vaker dan eens per
   RTG_SAVE_MS en nooit meer dan ~25% van de tijd aan het schrijven (4x de laatst
   gemeten flushduur). Bij een harde crash kan zo hooguit een venster aan mutaties
   verloren gaan; SIGTERM/SIGINT flushen altijd eerst (zie flushBijAfsluiten).
   Voor echt grote datasets is Postgres of RTG_STORE=sqlite de juiste opslag; dit
   houdt de JSON-modus eerlijk overeind. */
const rtgjson = require('../lib/rtgjson');
const kluis = require('../kluis');
const state = require('./state');
const opslag = require('./opslag');
const redis = require('./redis');
const db = state.db;
const { DATA_DIR, DB_FILE, STORE, besloten, beslotenMap, schrijfDuurzaam } = opslag;

const SAVE_MS = Number(process.env.RTG_SAVE_MS || 250);
// Duur, geen moment: monotone klok. Waarom en de -Infinity: sinds() in lib/klok.js.
const { sinds, verstreken } = require('../lib/klok');
let saveTimer = null, saveVuil = false, saveDuur = 0, saveKlaar = -Infinity;
// Boven ~512 MB serialiseert V8 geen string meer ("Invalid string length"): dan
// is de JSON-snapshotopslag vol. We proberen 'm dan niet bij ELKE save opnieuw
// (dat blokkeert de event-loop telkens seconden op een zinloze poging), maar
// koelen 60 s af en waarschuwen luid dat de Postgres-opslag nodig is voor deze
// omvang. Zodra de data weer past, herstelt het zichzelf.
let snapshotVol = false, snapshotWaarschuwing = -Infinity;

function schrijfSnapshotNu() {
  saveVuil = false;
  if (snapshotVol && verstreken(snapshotWaarschuwing) < 60000) { saveKlaar = sinds(); return; }
  const t0 = sinds();
  try {
    beslotenMap(DATA_DIR);
    // compact (geen pretty-print): bij grote data scheelt dat ~40% tijd en ruimte
    const uit = kluis.AAN ? kluis.versleutel(rtgjson.stringify(db.data)) : rtgjson.stringify(db.data);
    schrijfDuurzaam(DB_FILE, uit, 0o600);
    besloten(DB_FILE);
    if (STORE !== 'postgres') redis.spiegelNaarRedis(); // alleen de JSON-opslag deelt via Redis
    snapshotVol = false;
  } catch (e) {
    if (/Invalid string length|string longer than|Cannot create a string/i.test(e.message || '')) {
      snapshotVol = true; snapshotWaarschuwing = sinds();
      console.error('[db] datastore te groot voor een JSON-snapshot (' + e.message +
        '). Schakel voor deze omvang over op STORE=postgres; snapshots worden 60 s overgeslagen.');
    } else {
      console.warn('[db] snapshot schrijven mislukt:', e.message);
    }
  }
  saveDuur = verstreken(t0);
  saveKlaar = sinds();
}
function planSnapshot() {
  saveVuil = true;
  if (saveTimer) return;
  const venster = Math.max(SAVE_MS, saveDuur * 4);
  const sindsdien = verstreken(saveKlaar);
  if (sindsdien >= venster) return schrijfSnapshotNu(); // losse actie: meteen, net als vroeger
  saveTimer = setTimeout(() => { saveTimer = null; if (saveVuil) schrijfSnapshotNu(); }, venster - sindsdien);
  if (saveTimer.unref) saveTimer.unref();
}
// Staat er nog iets in de write-behind? (het afsluiten schrijft dan eerst.)
const snapshotVuil = () => saveVuil;

/* TERUG NAAR VERS -- de naad waar een toets deze module op zijn beginstand zet.
   Dezelfde naam als in db/voorcheck.js, en om dezelfde reden: een gedeelde
   server die straks tussen twee toetsen wordt schoongemaakt hoeft niet per
   module te weten hoe die naad daar toevallig heet.

   EERST SCHRIJVEN, DAN VERGETEN. Een reset die saveVuil op false zet terwijl er
   nog een write-behind openstaat gooit gegevens weg -- dat is geen schone lei
   maar dataverlies, en juist in een gedeelde server zou het lijken alsof de
   VORIGE toets niets had opgeslagen. Dus: timer afzeggen, openstaand werk
   afmaken, en pas daarna de merken terug op hun beginwaarde.

   Waarom de merken meemoeten: saveKlaar en saveDuur bepalen of planSnapshot()
   METEEN schrijft of een venster inplant. Blijven ze staan, dan gedraagt een
   hergebruikte module zich anders dan een verse -- en dat is precies wat een
   toets die na een andere draait niet mag merken. Zie het resetcontract in
   test/opslag-voorcheck.test.js.

   Wat hier niet met gedrag te bewijzen is: snapshotVol en snapshotWaarschuwing
   komen alleen in beeld boven ~512 MB aan data. Die twee worden gedekt door de
   bronpoort in scripts/staat.js, die nakijkt of deze functie ze echt aanraakt. */
function terugNaarVers() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (saveVuil) schrijfSnapshotNu();
  saveVuil = false; saveDuur = 0; saveKlaar = -Infinity;
  snapshotVol = false; snapshotWaarschuwing = -Infinity;
}

module.exports = { schrijfSnapshotNu, planSnapshot, snapshotVuil, terugNaarVers };
