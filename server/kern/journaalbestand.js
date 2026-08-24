/* ============================================================================
   HET JOURNAAL OP SCHIJF -- append-only, want een logboek is geen toestand.

   WAAROM DIT ER IS. Het doorgeefjournaal woonde in `db.data.doorgeefjournaal`:
   één array van 20.000 regels, en dus één blob in één rij van de opslag. Elke
   keer dat er ergens in de applicatie iets werd opgeslagen, werd die hele lijst
   opnieuw geserialiseerd, versleuteld en weggeschreven -- 3,6 MB voor het
   toevoegen van één regel.

   Gemeten op 24 augustus 2026 onder last: `saveSqlite` kostte daardoor
   gemiddeld 32,9 ms met een piek van 101 ms, synchroon op de event-loop, en
   over 25 seconden stond de lus 3,98 seconden stil in die ene functie. Een
   tijdvenster in de voorcheck bracht dat terug tot hooguit eens per twee
   seconden, maar niet weg: bij normaal verkeer betekende het dat een lid dat
   iets opslaat ~33 ms extra wacht omdat het journaal toevallig aan de beurt is.
   Dat is honderd keer de duur van het verzoek zelf.

   Het probleem is niet de omvang maar de VORM. Verandering opsporen in de
   opslaglaag gebeurt door te serialiseren en te vergelijken; voor een lijst die
   alleen maar aangroeit is dat elke keer opnieuw hetzelfde werk voor dezelfde
   19.999 regels. Een logboek hoort niet in een toestandscollectie. Het hoort in
   een bestand waar je achteraan schrijft.

   WAT DIT OPLEVERT, behalve snelheid: MEER geschiedenis. De oude bovengrens van
   20.000 regels is ongeveer 3,6 MB; hieronder staan vijf bestanden van 2 MB, dus
   ruwweg 55.000 regels. Bij 7.000 verzoeken per seconde is dat nog steeds kort
   -- zie de eerlijke kanttekening in PRESTATIES.md -- maar het is meer dan het
   was, en het kost niets meer.

   VIJF KEUZES DIE ERTOE DOEN

   1. NOOIT SYNCHROON SCHRIJVEN OP HET VERZOEKPAD. server/routelog.js gebruikt
      appendFileSync, en dat mag daar: die draait alleen in een testrun en
      hooguit eens per routepatroon. Hier komt er een regel per verzoek, dus een
      synchrone schrijfactie zou het middel erger maken dan de kwaal. Regels
      worden verzameld en asynchroon gespoeld -- per venster of zodra de stapel
      groot genoeg is.

   2. EEN KAPOT JOURNAAL MAG NOOIT EEN VERZOEK RAKEN. Elke fout hier wordt
      opgevangen en gemeld, één keer. Een logboek dat de server omtrekt is zelf
      de storing geworden.

   3. GEROTEERD EN BEGRENSD. Loopt het actieve bestand over MAX_BYTES, dan wordt
      het weggeschoven en begint er een nieuw. Er blijven hooguit MAX_BESTANDEN
      staan; de oudste gaat weg. Zo is de schijf begrensd zonder dat er een
      tweede opruimmechanisme naast server/bewaarveger.js hoeft te bestaan.

   4. VERSLEUTELD PER REGEL. Met RTG_ENC_KEY wordt elke regel apart versleuteld
      (kluis.versleutel levert "RTGENC1:<base64>", dus zonder nieuwe regels).
      Per regel en niet per bestand, want anders kun je er niet meer achteraan
      schrijven zonder het geheel opnieuw te versleutelen -- en dan ben je terug
      bij het probleem waar dit bestand voor bestaat.

   5. EEN VERMINKTE REGEL IS GEEN RAMP. Valt de stroom uit middenin een
      schrijfactie, dan staat er een halve regel. Bij het lezen wordt zo'n regel
      overgeslagen en geteld, niet gegooid. Meerdere serverprocessen mogen in
      hetzelfde bestand schrijven (O_APPEND zet elke schrijfactie aan het eind);
      dat is dezelfde afweging als in server/routelog.js, en het missen van een
      regel is de goede kant om te missen.

   WAT HIER NIET IN STAAT: hetzelfde als in het journaal zelf -- geen naam, geen
   e-mailadres, geen telefoonnummer, geen token. Wie er iets deed staat op
   codenaam. Dat wordt bewaakt door test/loghygiene.test.js en
   test/doorgeefjournaal.test.js; deze module bewaart alleen wat zij aanleveren.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis');

const MAX_BYTES = Number(process.env.RTG_JOURNAAL_BYTES || 2 * 1024 * 1024);
const MAX_BESTANDEN = Number(process.env.RTG_JOURNAAL_BESTANDEN || 5);
const VENSTER_MS = Number(process.env.RTG_JOURNAAL_SPOEL_MS || 1000);
const STAPEL_MAX = Number(process.env.RTG_JOURNAAL_STAPEL || 500);
const HUIDIG = 'huidig.log';

/* De maten zijn per journaal instelbaar en niet alleen via de omgeving: een
   toets die rotatie wil zien, moet dat kunnen zonder 2 MB weg te schrijven. */
function maakJournaalbestand({ dir, nu, maxBytes, maxBestanden, vensterMs, stapelMax } = {}) {
  const map = dir;
  const klok = nu || (() => Date.now());
  const GRENS_BYTES = Number(maxBytes || MAX_BYTES);
  const GRENS_BESTANDEN = Number(maxBestanden || MAX_BESTANDEN);
  const SPOEL_MS = Number(vensterMs || VENSTER_MS);
  const STAPEL = Number(stapelMax || STAPEL_MAX);
  let stapel = [];            // regels die nog niet op schijf staan
  let spoelt = null;          // lopende timer
  let bezig = false;          // er is een schrijfactie onderweg
  let stuk = null;            // eerste fout, één keer gemeld
  let geschreven = 0;         // regels die deze module wegschreef
  let overgeslagen = 0;       // verminkte regels bij het lezen

  const pad = (naam) => path.join(map, naam);
  function zorgMap() {
    try { fs.mkdirSync(map, { recursive: true, mode: 0o700 }); fs.chmodSync(map, 0o700); }
    catch (e) { try { fs.mkdirSync(map, { recursive: true }); } catch (x) {} }
  }
  function meldEens(e) {
    if (stuk) return;
    stuk = e && e.message ? e.message : String(e);
    console.warn('[journaal] wegschrijven mislukt, en dat blijft zo tot een herstart:', stuk);
  }

  /* De geroteerde bestanden, nieuwste eerst. De naam is de tijd in ms, dus
     lexicografisch sorteren is chronologisch sorteren (13 cijfers, geen
     overgang binnen deze eeuw). */
  function oudeBestanden() {
    try {
      return fs.readdirSync(map).filter(n => /^\d{13}\.log$/.test(n)).sort().reverse();
    } catch (e) { return []; }
  }

  /* EEN VERSE NAAM VOOR EEN GEROTEERD BESTAND, en die moet twee dingen doen:
     uniek zijn en oplopen.

     Hier stond kortweg `klok() + '.log'`. Roteren twee bestanden binnen dezelfde
     milliseconde, dan wijst die naam naar het bestand dat er al staat en gooit
     renameSync() het vorige er stilzwijgend overheen -- een heel journaalbestand
     weg, zonder fout. Dat is geen theorie: de rotatietoets in
     test/journaalbestand.test.js viel er meteen over.

     De stempel loopt daarom altijd door: nooit lager dan de vorige, en nooit op
     een naam die al bestaat (een klok die terugloopt mag ook niets overschrijven).
     Dertien cijfers blijft dertien cijfers, dus lexicografisch sorteren blijft
     chronologisch sorteren. */
  let laatsteStempel = 0;
  function verseNaam() {
    let s = Math.max(klok(), laatsteStempel + 1);
    while (fs.existsSync(pad(s + '.log'))) s++;
    laatsteStempel = s;
    return s + '.log';
  }

  /* Rotatie: het actieve bestand wegschuiven en de oudste opruimen. Alleen
     aangeroepen vanuit de spoeling, dus nooit vanaf het verzoekpad. */
  function roteerIndienNodig() {
    let groot = 0;
    try { groot = fs.statSync(pad(HUIDIG)).size; } catch (e) { return; }
    if (groot < GRENS_BYTES) return;
    try { fs.renameSync(pad(HUIDIG), pad(verseNaam())); } catch (e) { meldEens(e); return; }
    const oud = oudeBestanden();
    for (const n of oud.slice(GRENS_BESTANDEN)) { try { fs.unlinkSync(pad(n)); } catch (e) {} }
  }

  function regelTekst(r) {
    const j = JSON.stringify(r);
    return (kluis.AAN ? kluis.versleutel(j) : j) + '\n';
  }

  /* Spoelen. Pakt de hele stapel in één schrijfactie; komt er tijdens het
     schrijven meer bij, dan volgt er meteen een tweede ronde. */
  function spoel() {
    if (bezig || !stapel.length) return;
    bezig = true;
    const nu = stapel;
    stapel = [];
    let blok;
    try { blok = nu.map(regelTekst).join(''); }
    catch (e) { bezig = false; meldEens(e); return; }
    zorgMap();
    fs.appendFile(pad(HUIDIG), blok, { mode: 0o600 }, (e) => {
      bezig = false;
      if (e) meldEens(e);
      else { geschreven += nu.length; try { roteerIndienNodig(); } catch (x) { meldEens(x); } }
      if (stapel.length) spoel();
    });
  }
  function plan() {
    if (spoelt || !stapel.length) return;
    spoelt = setTimeout(() => { spoelt = null; spoel(); }, SPOEL_MS);
    if (spoelt.unref) spoelt.unref();
  }

  /* Een regel toevoegen. Kost een push; de schijf komt later. */
  function voegToe(regel) {
    if (stuk) return false;
    stapel.push(regel);
    if (stapel.length >= STAPEL) spoel(); else plan();
    return true;
  }

  /* Alles wat nog in de stapel staat nu wegschrijven, synchroon. Alleen voor
     het afsluiten: daar is blokkeren juist goed, want anders is het weg. */
  function spoelNu() {
    if (!stapel.length) return 0;
    const nu = stapel;
    stapel = [];
    try {
      zorgMap();
      fs.appendFileSync(pad(HUIDIG), nu.map(regelTekst).join(''), { mode: 0o600 });
      geschreven += nu.length;
      roteerIndienNodig();
      return nu.length;
    } catch (e) { meldEens(e); return 0; }
  }

  /* Regels uit één bestand. Een regel die niet te lezen is (halve schrijfactie
     bij stroomuitval, of een sleutel die niet past) wordt overgeslagen en
     geteld -- niet gegooid. */
  function uitBestand(naam) {
    let tekst;
    try { tekst = fs.readFileSync(pad(naam), 'utf8'); } catch (e) { return []; }
    const uit = [];
    for (const regel of tekst.split('\n')) {
      if (!regel) continue;
      try { uit.push(JSON.parse(kluis.ontsleutel(regel))); }
      catch (e) { overgeslagen++; }
    }
    return uit;
  }

  /* De laatste `max` regels, oudste eerst -- dezelfde volgorde als de array die
     hier vroeger stond, zodat het leespad erboven niet hoeft te weten dat dit
     veranderd is. Er wordt van nieuw naar oud gelezen en gestopt zodra er
     genoeg is, dus een vol journaal kost niet meer dan een leeg. */
  function lees(max) {
    const grens = Math.max(1, Number(max) || 1000);
    let uit = stapel.slice();                       // wat nog niet gespoeld is
    if (uit.length < grens) {
      const bestanden = [HUIDIG].concat(oudeBestanden());
      for (const n of bestanden) {
        uit = uitBestand(n).concat(uit);
        if (uit.length >= grens) break;
      }
    }
    return uit.slice(-grens);
  }

  /* Hoeveel regels staan er? Nieuwe regels tellen kost een leesronde, dus het
     antwoord wordt kort vastgehouden: dit voedt een scherm, geen beslissing. */
  let telWaarde = null, telTijd = 0;
  function aantal() {
    if (telWaarde !== null && klok() - telTijd < 10000) return telWaarde + stapel.length;
    let n = 0;
    for (const naam of [HUIDIG].concat(oudeBestanden())) {
      try {
        const t = fs.readFileSync(pad(naam), 'utf8');
        for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) === 10) n++;
      } catch (e) { /* weg is nul */ }
    }
    telWaarde = n; telTijd = klok();
    return n + stapel.length;
  }

  const stand = () => ({ geschreven, overgeslagen, wachtend: stapel.length, stuk, map });

  return { voegToe, lees, aantal, spoelNu, stand, maxBytes: GRENS_BYTES, maxBestanden: GRENS_BESTANDEN };
}

module.exports = { maakJournaalbestand };
