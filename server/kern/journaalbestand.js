/* ============================================================================
   HET JOURNAAL OP SCHIJF -- append-only, want een logboek is geen toestand.

   WAAROM DIT ER IS. Het doorgeefjournaal woonde in db.data.doorgeefjournaal:
   een array van 20.000 regels, dus een blob in een rij van de opslag. Elke save()
   ergens in de applicatie serialiseerde die hele lijst opnieuw om er een regel
   bij te zetten -- gemiddeld 32,9 ms met een piek van 101 ms, synchroon op de
   event-loop. De meting staat in PRESTATIES.md.

   Het probleem is niet de omvang maar de VORM. Verandering opsporen gebeurt door
   te serialiseren en te vergelijken; voor een lijst die alleen aangroeit is dat
   elke keer hetzelfde werk voor dezelfde 19.999 regels. Een logboek hoort in een
   bestand waar je achteraan schrijft -- en dat geeft bovendien MEER geschiedenis
   (vijf bestanden van 2 MB tegen een blob van 20.000 regels) voor minder kosten.

   VIJF KEUZES DIE ERTOE DOEN

   1. NOOIT SYNCHROON OP HET VERZOEKPAD. server/routelog.js mag appendFileSync
      gebruiken (alleen in een testrun, eens per routepatroon); hier komt er een
      regel per verzoek. Regels worden verzameld en asynchroon gespoeld.
   2. EEN KAPOT JOURNAAL RAAKT NOOIT EEN VERZOEK. Elke fout wordt opgevangen en
      een keer gemeld. Een logboek dat de server omtrekt is zelf de storing.
   3. GEROTEERD EN BEGRENSD (./journaalrotatie.js), zodat de schijf begrensd is
      zonder een tweede opruimmechanisme naast server/bewaarveger.js.
   4. VERSLEUTELD PER REGEL, niet per bestand -- anders kun je er niet meer
      achteraan schrijven zonder het geheel opnieuw te versleutelen.
   5. EEN VERMINKTE REGEL WORDT OVERGESLAGEN EN GETELD, niet gegooid. Meerdere
      processen mogen in hetzelfde bestand schrijven (O_APPEND).

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

  /* Een regel noteren: een push, de schijf komt later. Hij heette voegToe(), en
     die naam staat ook in kern/mall/lijsten.js en kern/wereld/lijsten.js -- drie
     keer dezelfde naam voor iets anders is waar de keuringsregel over dubbeling
     voor waarschuwt. Een journaal NOTEERT; een lijst voegt toe. */
  function noteerRegel(regel) {
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

  const { lees, aantal } = require('./journaallezen').maakLezer({
    pad, huidig: HUIDIG, oudeBestanden, klok,
    stapel: () => stapel, telOvergeslagen: () => { overgeslagen++; } });

  const stand = () => ({ geschreven, overgeslagen, wachtend: stapel.length, stuk, map });

  return { noteerRegel, lees, aantal, spoelNu, stand, maxBytes: GRENS_BYTES, maxBestanden: GRENS_BESTANDEN };
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
