/* ============================================================================
   HET CARRIERE LEDGER -- de regels, zonder opslag.

   CARRIERE.md par. 4.1 wijst deze vorm aan, en wijst er een af. Afgewezen is de
   Career Independence Score: een samengesteld cijfer op een mens, dat botst met
   vier documenten tegelijk (zie scripts/lib/cijferopmens.js voor welke). De vorm
   die WEL overleeft staat in het voorstel zelf:

     "Nederlands kampioen junior 2027, geverifieerd door bond X" zegt meer dan
     87 %, en het veroudert niet stilletjes.

   Dus: chronologisch, per regel bewijsbaar, met herkomst. Geen getal.

   DIT BESTAND KENT GEEN DB, met dezelfde reden als kern/rugdekking/soorten.js
   en kern/economie/firewall.js: het BESLUIT of iets een carrierefeit mag zijn,
   is dan te beproeven zonder server. Een grens die alleen achter een draaiende
   server te toetsen is, wordt getoetst zolang iemand de moeite neemt.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. DE HERKOMST ZEGT OOK WAT ZIJ NIET ZEGT, en dat blok is even groot. Een
      leverancierspak dat overal ja zegt is niets waard (APPSTORE.md), en
      `gezien` is precies zo'n stempel: RTG legt vast dat een MENS het stuk heeft
      gezien, en valideert niets inhoudelijk. Wij bellen de bond niet en doen
      niet alsof (kern/vakbewijs.js regel 2).

   2. EEN BEDRAG IS GEEN CARRIEREFEIT. Financieel kapitaal bestaat in dit
      ledger als FEIT ("driejarig contract getekend") en nooit als getal. Geld
      woont in WAARDE.md en kern/rugdekking; een bedrag hier zou de tweede
      boekhouding maken die WAARDE.md nergens wil, en meteen de gevoeligste
      sorteersleutel op mensen opleveren die dit huis kent.

   3. GEZONDHEID HOORT HIER NIET, PUNT. RUGDEKKING.md grens 8: de betaler leest
      de gezondheid nooit. Een blessure is een medisch gegeven en geen prestatie,
      en het ledger is juist de plek die een mens DEELT.
   ========================================================================== */
'use strict';

/* De zeven kapitalen uit CARRIERE.md punt 30, hier als zeven APARTE voorraden
   met hun opbouw -- nooit als een getal en nooit als sorteersleutel over
   mensen. Een voorraad is in dit ledger niets anders dan "de regels van deze
   soort": je telt ze niet op tot een cijfer, je LEEST ze. */
const KAPITALEN = {
  vermogen: 'wat deze mens aantoonbaar kan: titels, diplomas, uitslagen, rollen',
  netwerk: 'met wie er gewerkt is: clubs, labels, gezelschappen, opdrachtgevers',
  publiek: 'wie er is komen kijken of luisteren, als FEIT en nooit als trechter',
  financieel: 'dat er een contract, beurs of opdracht was -- nooit het bedrag',
  eigendom: 'werk waarvan deze mens de rechten heeft: opnames, ontwerpen, merken',
  bewijs: 'stukken die het bovenstaande staven: certificaten, uitslagenlijsten',
  reputatie: 'wat anderen op naam hebben verklaard: prijzen, nominaties, juryoordelen'
};

/* De drie herkomsten. Per stuk WAT RTG VASTSTELT en WAT HET NIET ZEGT -- dat
   tweede is geen slag om de arm maar de helft van de betekenis. */
const HERKOMST = {
  zelf: {
    stelt: 'dat dit lid dit zelf heeft opgeschreven, op deze datum',
    nietZegt: 'dat het gebeurd is; niemand buiten het lid heeft hier iets van gezien',
    doorWie: 'het lid'
  },
  gezien: {
    stelt: 'dat een met naam genoemde medewerker van RTG een stuk heeft INGEZIEN',
    nietZegt: 'dat het stuk echt is of dat de uitgever het nog erkent; RTG belt geen bond en valideert niets inhoudelijk',
    doorWie: 'een mens van RTG, op naam'
  },
  bevestigd: {
    stelt: 'dat DEZE partij, vanaf haar eigen account, deze regel heeft bevestigd',
    nietZegt: 'dat die partij bevoegd is om dit te bevestigen; wie zij is staat erbij, wat haar woord waard is beoordeelt de lezer',
    doorWie: 'een zaak: een club, bond, label of organisator'
  }
};

/* Wat nooit een regel wordt. Elk met de grens waar hij vandaan komt, zodat
   niemand hem als vergetelheid kan aanzien en even toevoegen. */
const NOOIT = {
  cijfer: 'een maat op deze mens -- CAR-05, en er is geen versie hiervan die wel mag',
  bedrag: 'een som geld; die woont in WAARDE.md en kern/rugdekking, nooit hier',
  gezondheid: 'een blessure, diagnose of belastbaarheid -- RUGDEKKING.md grens 8',
  ander: 'een feit over iemand anders; een regel gaat over de mens wiens ledger dit is',
  toekomst: 'iets dat nog moet gebeuren -- een voornemen is geen prestatie'
};

const KAPITAALNAMEN = Object.keys(KAPITALEN);
const HERKOMSTNAMEN = Object.keys(HERKOMST);

/* Een datum die een MENS heeft meegemaakt: een dag, geen tijdstip. Het ledger
   bewaart wanneer iets GEBEURDE, en dat is iets anders dan wanneer het werd
   opgeschreven -- die tweede staat als `at` op de regel. Wie die twee samenneemt,
   maakt van een titel uit 2019 een prestatie van vandaag. */
function dagGeldig(op, nu) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(op || ''))) return 'Zet er een datum bij, als jjjj-mm-dd.';
  const t = Date.parse(op + 'T12:00:00Z');
  if (!Number.isFinite(t)) return 'Deze datum bestaat niet.';
  if (t > (nu || Date.now())) return 'NOOIT.toekomst: ' + NOOIT.toekomst;
  return null;
}

/* Het besluit. Geeft `null` als de regel mag, of een uitleg waarom niet -- nooit
   een kale false: een weigering die niet zegt hoe het wel kan, stuurt iemand op
   zoek in de code (CONTROLPLANE.md). */
function toets(regel, nu) {
  const r = regel || {};
  if (!KAPITAALNAMEN.includes(r.kapitaal)) {
    return 'Kies waar dit bij hoort: ' + KAPITAALNAMEN.join(', ') + '.';
  }
  if (!HERKOMSTNAMEN.includes(r.herkomst)) {
    return 'Een feit zonder herkomst is een half feit. Kies: ' + HERKOMSTNAMEN.join(', ') + '.';
  }
  const wat = String(r.wat || '').trim();
  if (wat.length < 3) return 'Schrijf op wat er gebeurde.';
  const dag = dagGeldig(r.op, nu);
  if (dag) return dag;
  if (r.bedragCenten != null || r.bedrag != null) return 'NOOIT.bedrag: ' + NOOIT.bedrag;
  if (r.cijfer != null || r.punten != null) return 'NOOIT.cijfer: ' + NOOIT.cijfer;
  return null;
}

module.exports = { KAPITALEN, HERKOMST, NOOIT, KAPITAALNAMEN, HERKOMSTNAMEN, toets, dagGeldig };
