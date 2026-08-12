/* Magnaat: PDA RUSH -- de dienst van een hulpkracht, op de werkvloer.

   DIT IS DE WERKLAAG UIT VERHAAL.md par. 0f, en de eerste zin daar is de enige
   die telt: EEN DIENST IS GEEN MINI-GAME. De val is zes minuten taakjes met
   punten eromheen; dat is precies het soort laag dat CLAUDE.md uitsluit. Wat het
   wel is: een levende dienst in een echte organisatie, waarin je onmogelijk
   alles tegelijk kunt. Prioriteit onder druk, geen reflexen.

   ZES MOMENTEN EN ACHT VOORVALLEN. Dat verschil IS het spel. Twee dingen
   blijven liggen, en welke twee -- en hoe lang de rest wachtte -- is de hele
   beslissing. Er is geen goede volgorde, alleen een minst slechte.

   DE VIJF WETTEN (VERHAAL.md par. 0f), en waar ze staan:

   1. GEEN SCORE ALS DE WERKELIJKHEID HET ANTWOORD KAN ZIJN. Nergens een punt.
      Wat een dienst oplevert is DERVING IN EURO'S -- een kostenpost die al
      bestond (./sectoren.js, ./stap.js). Ervaring is geschiedenis en geen getal.

   2. IEDERE ROL SPEELT ALLEEN ZIJN EIGEN VERANTWOORDELIJKHEID. De `mag` van een
      voorval en van elke UITWEG wordt tegen de rol gelegd (./dienst-rollen.js).
      Geen tweede rechtenmodel: de grens die de rol al draagt is de grens.

   3. IEDERE UITKOMST LOOPT DOOR DE ECHTE ECONOMIE. Deze module maakt geen geld;
      hij geeft EEN FACTOR terug op een post die er al was. Bij factor 1 rekent
      ./stap.js tot op de cent zoals voordat deze laag bestond, en dat is wat
      scripts/magnaat-pomp.js natelt.

   4. NIET SPELEN IS NEUTRAAL, en dit is de wet met de scherpste definitie.
      "Neutraal" is geen gemiddelde maar een SIMULATIE: `opVolgorde()` laat de
      ploeg de voorvallen op VOLGORDE VAN BINNENKOMST afwerken -- letterlijk wat
      een werkvloer zonder sturing doet, en dezelfde regel waarmee de
      AI-concurrent aanneemt (par. 0d): wie op volgorde werkt, rangschikt niets.
      Wie niet speelt krijgt die uitkomst, en dus factor 1. Geen reeks, geen
      inhaalschuld -- en een dienst die je begint en niet afmaakt telt ook als
      neutraal, want anders is beginnen een risico.

   5. BETEKENISVOLLE UITZONDERINGEN WORDEN GESCHIEDENIS. Niet elke klik. Er
      wordt alleen een FEIT gestempeld (./rush-nalaten.js); of dat een moment
      wordt beslist ../loopbaan-noteren.js achteraf.

   EEN ROL, EEN SECTOR, EEN SCHERM -- zie ./rush-voorvallen.js.

   HET TOEVAL IS DETERMINISTISCH, om dezelfde reden als in ./risico.js: de
   wereld rekent BIJ wanneer iemand kijkt. Dezelfde dienst moet dezelfde avond
   geven, hoe vaak je hem ook opent. */
'use strict';

const { trek } = require('./risico');
const { magRol } = require('./dienst-rollen');
const { SECTOREN } = require('./sectoren');
const { SOORTEN, magRush } = require('./rush-voorvallen');
const STORING = require('./storing');

const rond = (n) => Math.round(n);
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* Hoeveel momenten een dienst heeft, en hoeveel voorvallen erin passen. Acht om
   zes: er blijft altijd iets liggen. Zou dat niet zo zijn, dan is het geen
   keuze maar een afvinklijst. */
const SLOTS = 6;
const VOORVALLEN_PER_DIENST = 8;

/* Waar de factor tussen ligt. BOVEN DE EEN, omdat een dienst die je aandacht
   krijgt en die je verkeerd stuurt echt slechter afloopt dan een die vanzelf
   loopt. Dat is geen straf voor afwezigheid (wet 4 gaat over NIET spelen, en
   dat blijft precies 1) maar het gevolg van kiezen -- zonder die kant is elke
   keuze gratis en is er niets te wegen. Onder de een een bodem, want een
   perfecte avond haalt geen bederf weg dat al in de keten zat. */
const FACTORBAND = [0.42, 1.55];

/* ------------------------------------------------------------------ */

function tafel(st) { return (st.rush = st.rush || { diensten: {}, log: [] }); }

/* WELKE VOORVALLEN DEZE DIENST HEEFT, en wanneer ze binnenkomen. Uit een hash
   van (partij, dienstverband, maand): dezelfde dienst geeft altijd dezelfde
   avond, hoe vaak je hem ook opent. */
function bouw(potjeId, d, maand, rol, v) {
  const zaad = potjeId + ':' + d.id + ':' + maand + ':';
  const stukNu = v ? STORING.openstaand(v).map(x => x.soort) : [];
  const mag = SOORTEN.filter(s => (!s.mag || magRol(rol, s.mag))
    /* EEN STORINGSVOORVAL BESTAAT ALLEEN ALS DIE STORING OPEN STAAT. Anders
       staat er "koeling B loopt op" op een avond waarop hij het prima doet, en
       is "repareren" een knop die niets repareert. */
    && (!s.storing || stukNu.includes(s.storing)));
  /* WAT ER STUK IS, KOMT ELKE DIENST TERUG. Dit is de continuiteit uit
     VERHAAL.md par. 0f punt 2, en hij is met opzet geen aparte machinerie: een
     voorval dat aan een OPEN storing hangt (./rush-voorvallen.js `storing`)
     wordt niet geloot maar staat er gewoon, elke avond, tot iemand hem oplost.

     De ochtendploeg begint dus niet in een schone wereld. En omdat hij ook in
     `opVolgorde()` hieronder meetelt, verschuift de LAT mee -- wie niet speelt
     krijgt de wereld zoals hij is en niet een schuld die hij zelf gemaakt heeft.
     Dat is hoe punt 2 en wet 4 naast elkaar kunnen bestaan (./storing.js). */
  const vast = mag.filter(s => s.storing);
  return vast.concat(mag
    .filter(s => !vast.includes(s))
    .map(s => ({ s, r: trek(zaad + 'k' + s.id) }))
    .sort((a, b) => a.r - b.r || (a.s.id < b.s.id ? -1 : 1))
    .map(({ s }) => s))
    .slice(0, VOORVALLEN_PER_DIENST)
    .map((s) => ({
      id: s.id, wat: s.wat, deed: s.deed, incident: !!s.incident,
      kost: s.kost, groei: s.groei, storing: s.storing || null,
      /* WAT JE ERMEE KUNT, en dat hangt aan je ROL en niet aan je leeftijd of je
         voortgang (par. 0f wet 2). Een voorval zonder opties heeft er impliciet
         een: pak het op. Zo hoeft de tabel alleen iets te zeggen waar het echt
         anders is -- en dat is vandaag alleen de koelstoring. */
      /* `alleenZaak` valt hier af: dat zijn de uitwegen die geld aan het pand
         uitgeven, en die kiest de zaak op zijn eigen scherm en niet iemand
         midden in de drukte (./rush-voorvallen.js bij `repareren`). */
      opties: (s.opties || []).filter(o => !o.alleenZaak && (!o.mag || magRol(rol, o.mag))),
      /* Wanneer het binnenkomt. Nooit in het laatste moment: een voorval dat
         pas op het einde verschijnt is geen keuze maar een fooi. */
      vanaf: Math.floor(trek(zaad + 't' + s.id) * (SLOTS - 1))
    }))
    .sort((a, b) => a.vanaf - b.vanaf || (a.id < b.id ? -1 : 1));
}

/* WAT EEN AVOND KOST, gegeven wie er wanneer is aangepakt. Alles wat blijft
   liggen kost zijn `kost`; alles wat wacht kost zijn `groei` maal het aantal
   momenten dat het wachtte -- afgehandeld of niet. Daarom is te laat aanpakken
   ook iets waard, en niet alleen wel of niet. */
function schade(voorvallen, gedaan) {
  let n = 0;
  for (const vv of voorvallen) {
    const af = gedaan.find(g => g.id === vv.id);
    const wacht = (af ? af.slot : SLOTS - 1) - vv.vanaf;
    n += (af ? 0 : vv.kost) + vv.groei * Math.max(0, wacht);
  }
  return n;
}

/* DE PLOEG ZONDER STURING: op volgorde van binnenkomst -- wet 4. Geen enkel
   voorval is hier "belangrijker", ze waren alleen eerder. Dit is de uitkomst
   die je krijgt als je de dienst niet speelt, en dus de lat waar een gespeelde
   dienst tegen afgemeten wordt.

   HIJ MAG NOOIT VAN DE SPELER AFHANGEN. Deze functie kijkt alleen naar de
   voorvallen, nooit naar wat er gekozen is -- zou de lat meebewegen met je
   keuzes, dan meet de factor niets meer. */
function opVolgorde(voorvallen) {
  const gedaan = [];
  for (let t = 0; t < SLOTS; t++) {
    const open = voorvallen.filter(vv => vv.vanaf <= t && !gedaan.some(g => g.id === vv.id));
    if (open.length) gedaan.push({ id: open[0].id, slot: t });
  }
  return schade(voorvallen, gedaan);
}

/* DE EURO'S WAARIN DEZE DIENST REKENT: wat er bij DEZE zaak in een maand
   bederft. Een raming uit de eigen omzetgeschiedenis, want een dienst in een
   zaak van veertig stoelen hoort niet dezelfde bedragen te tonen als een van
   vier. Een verse zaak heeft die geschiedenis niet en krijgt de sectormaat.

   HET IS EEN RAMING EN GEEN BOEKING. Wat de maand werkelijk afschrijft rekent
   ./stap.js uit over de echte omzet; dit getal staat alleen op het scherm, want
   een werkvloer toont euro's en geen gewichten. */
function raming(v) {
  const s = SECTOREN[v.sector];
  const omzet = v.maanden > 0 ? v.omzetTotaal / v.maanden
    : v.omvang * s.perMaand * (s.prijs[v.prijs] || s.prijs[1]);
  return Math.max(1, omzet * s.inkoop * (s.derving || 0));
}

/* WAT EEN GESPEELDE DIENST OPLEVERDE, tegen de ploeg zonder sturing afgemeten.
   Een FACTOR op een kostenpost die er al was; deze module maakt geen geld.

   HIJ REKENT MET DE BEVROREN RAMING VAN DE DIENST (`s.raming`, gezet toen de
   avond begon) en niet met een verse. Dat is geen zuinigheid maar een fout die
   de speeltest vond: `raming()` leest de omzetgeschiedenis van de zaak, en die
   verandert zodra de maand gedraaid heeft. Kwam hij hier vers binnen, dan stond
   er aan het eind van de dienst een ander bedrag op je scherm dan er later in
   het log belandde -- dezelfde avond, twee waarheden. */
function uitkomst(voorvallen, s, v) {
  const neutraal = opVolgorde(voorvallen);
  const geleden = schade(voorvallen, s.gedaan);
  const schaal = (s.raming || raming(v)) / Math.max(0.001, neutraal);
  return {
    factor: neutraal > 0 ? klem(geleden / neutraal, FACTORBAND[0], FACTORBAND[1]) : 1,
    derving: rond(geleden * schaal), zonderSturing: rond(neutraal * schaal),
    verschil: rond((neutraal - geleden) * schaal),
    /* Wat er bleef liggen, met zoveel woorden. Een avond waarin twee dingen niet
       gelukt zijn hoort dat te zeggen; anders leest een slechte dienst als een
       goede met een ander getal. */
    bleefLiggen: voorvallen.filter(x => !s.gedaan.some(g => g.id === x.id)).map(x => x.wat)
  };
}

module.exports = { SLOTS, VOORVALLEN_PER_DIENST, FACTORBAND, SOORTEN,
  magRush, tafel, bouw, schade, opVolgorde, raming, uitkomst, rond, klem };
