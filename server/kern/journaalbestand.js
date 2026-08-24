/* ============================================================================
   HET JOURNAAL OP SCHIJF -- append-only, want een logboek is geen toestand.

   WAAROM DIT ER IS. Het doorgeefjournaal woonde in db.data.doorgeefjournaal:
   een array van 20.000 regels, dus een blob in een rij van de opslag. Elke save()
   ergens in de applicatie serialiseerde die hele lijst opnieuw om er een regel
   bij te zetten -- 3,6 MB voor 200 byte nieuwe gegevens, gemiddeld 32,9 ms met
   een piek van 101 ms, synchroon op de event-loop. De meting staat voluit in
   PRESTATIES.md.

   Het probleem is niet de omvang maar de VORM. Verandering opsporen in de
   opslaglaag gebeurt door te serialiseren en te vergelijken; voor een lijst die
   alleen aangroeit is dat elke keer hetzelfde werk voor dezelfde 19.999 regels.
   Een logboek hoort niet in een toestandscollectie maar in een bestand waar je
   achteraan schrijft -- en dat levert bovendien MEER geschiedenis op (vijf
   bestanden van 2 MB tegen een blob van 20.000 regels), voor minder kosten.

   VIJF KEUZES DIE ERTOE DOEN

   1. NOOIT SYNCHROON SCHRIJVEN OP HET VERZOEKPAD. server/routelog.js mag
      appendFileSync gebruiken: die draait alleen in een testrun, hooguit eens
      per routepatroon. Hier komt er een regel per verzoek, dus een synchrone
      schrijfactie zou het middel erger maken dan de kwaal. Regels worden
      verzameld en asynchroon gespoeld.

   2. EEN KAPOT JOURNAAL MAG NOOIT EEN VERZOEK RAKEN. Elke fout wordt opgevangen
      en een keer gemeld. Een logboek dat de server omtrekt is zelf de storing.

   3. GEROTEERD EN BEGRENSD. Over MAX_BYTES schuift het actieve bestand weg;
      er blijven hooguit MAX_BESTANDEN staan. Zo is de schijf begrensd zonder een
      tweede opruimmechanisme naast server/bewaarveger.js.

   4. VERSLEUTELD PER REGEL. Met RTG_ENC_KEY apart per regel (kluis.versleutel
      levert "RTGENC1:<base64>", dus zonder nieuwe regels) -- niet per bestand,
      want dan kun je er niet meer achteraan schrijven zonder het geheel opnieuw
      te versleutelen, en dan ben je terug bij het probleem hierboven.

   5. EEN VERMINKTE REGEL IS GEEN RAMP. Een halve regel na een stroomstoring
      wordt bij het lezen overgeslagen en geteld, niet gegooid. Meerdere
      processen mogen in hetzelfde bestand schrijven (O_APPEND), dezelfde
      afweging als in server/routelog.js.

   WAT HIER NIET IN STAAT: hetzelfde als in het journaal zelf -- geen naam, geen
   e-mailadres, geen telefoonnummer, geen token. Wie er iets deed staat op
   codenaam. Dat wordt bewaakt door test/loghygiene.test.js en
   test/doorgeefjournaal.test.js; deze module bewaart alleen wat zij aanleveren.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis');
const rtgKlok = require('../lib/klok');

const MAX_BYTES = Number(process.env.RTG_JOURNAAL_BYTES || 2 * 1024 * 1024);
const MAX_BESTANDEN = Number(process.env.RTG_JOURNAAL_BESTANDEN || 5);
const VENSTER_MS = Number(process.env.RTG_JOURNAAL_SPOEL_MS || 1000);
const STAPEL_MAX = Number(process.env.RTG_JOURNAAL_STAPEL || 500);
const HUIDIG = 'huidig.log';

/* De maten zijn per journaal instelbaar en niet alleen via de omgeving: een
   toets die rotatie wil zien, moet dat kunnen zonder 2 MB weg te schrijven. */
function maakJournaalbestand({ dir, nu, maxBytes, maxBestanden, vensterMs, stapelMax } = {}) {
  const map = dir;
  /* De tijd komt uit server/lib/klok.js en niet rechtstreeks van het
     besturingssysteem: dan kan een toets hem verzetten, en telt deze module niet
     mee in de klokschuld (scripts/klok.js ratelt daarop). */
  const klok = nu || rtgKlok.nu;
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

  const { oudeBestanden, roteerIndienNodig } = require('./journaalrotatie').maakRotatie({
    map, pad, klok, huidig: HUIDIG, grensBytes: GRENS_BYTES, grensBestanden: GRENS_BESTANDEN, meld: meldEens });

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

/* HET STANDAARDJOURNAAL. Staat hier en niet bij de aanroeper, om twee redenen:
   de kern hoeft dan niets van paden te weten, en het REGISTER hieronder kan
   alles wat er open staat in een keer spoelen bij het afsluiten -- anders moet
   elke aanroeper zijn eigen boek doorgeven aan de afsluiter. */
const geopend = [];
function standaard() {
  const b = maakJournaalbestand({ dir: path.join(require('../db').DATA_DIR, 'journaal') });
  geopend.push(b);
  return b;
}
/* Alles wat nog in een stapel staat synchroon wegschrijven. Alleen bij het
   afsluiten: daar is blokkeren juist goed, want anders is het weg. */
function spoelAlle() { let n = 0; for (const b of geopend) { try { n += b.spoelNu(); } catch (e) {} } return n; }

/* DE GEWONE SAMENSTELLING voor de kern: het doorgeefjournaal met zijn
   standaardbestand erbij. Hier en niet bij de aanroeper, zodat opzet/kernlaag1.js
   een regel blijft -- en nadrukkelijk NIET als stille standaard binnen
   maakDoorgeefjournaal() zelf. Dat stond er even, en het leverde verborgen
   gedeelde staat op: toetsen die geen bestand meegaven schreven allemaal in
   dezelfde map en zagen elkaars regels. Wie samenstelt, kiest expliciet. */
function metBestand(opties) {
  return require('./doorgeefjournaal').maakDoorgeefjournaal(
    Object.assign({}, opties, { bestand: standaard() }));
}

module.exports = { maakJournaalbestand, standaard, spoelAlle, metBestand };
