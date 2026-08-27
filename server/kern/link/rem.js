/* RTG Link: DE DEURREM -- het huisbrede budget aan MISSERS per minuut.

   Deze rem stond in server/kern/sociaal/pin-deur.js, en dat was de goede
   redenering op de verkeerde plek. De redenering (die daar staat, en die blijft
   gelden): wie de pin van NIEMAND IN HET BIJZONDER zoekt, raadt niet een pin
   maar vist naar wie er ergens achter zit. Een teller per vrager kost hem dan
   niets -- een tweede account kost een e-mailadres. Dus hangt de teller aan de
   DEUR en niet aan de aanvrager (LAT.md regel 7).

   Waarom hij is verhuisd: zodra er een tweede ingang komt die een code oplost,
   is een rem die bij de contactpin woont geen huisbrede rem meer maar de rem van
   een van de twee deuren. LINK.md par. 3.7 zegt het andersom: de rem hoort bij
   de LAAG, en elke nieuwe ingang gebruikt deze. Wie er een eigen teller naast
   zet, heeft de rem uitgezet zonder het op te schrijven.

   EEN SINGLETON, EN DAT IS DE HELE FUNCTIE. Geen fabriek, geen instantie per
   laag: het budget is van het huis, dus is er precies een teller. De
   require-cache van Node maakt daar een van; wie hier een `module.exports = () =>`
   van maakt, geeft elke aanroeper zijn eigen budget terug en dan telt niemand
   meer iets.

   ALLEEN MISSERS TELLEN. Een lid dat een pin overtypt of een QR scant, mist
   vrijwel nooit: hij kreeg de code net. Een raadster mist per definitie bijna
   altijd. Daarom staat het budget laag genoeg om te bijten en hoog genoeg dat
   normaal gebruik er nooit aan komt -- getoetst in test/contactpin.test.js, met
   tweehonderd treffers die er niet aan raken.

   DE PRIJS, EERLIJK: een huisbrede teller is een huisbrede knop. Wie bereid is
   MIS_PER_MINUUT missers per minuut te produceren, zet het oplossen van codes
   voor iedereen een minuut lang dicht. Dat is een bewuste ruil -- zoeken op
   codenaam werkt door, bestaande vrienden merken niets -- en het alternatief is
   een deur die alleen per bezoeker telt en dus bij genoeg bezoekers niet telt.

   OVER MEER DAN EEN PROCES. Hij woonde in het geheugen en telde PER PROCES --
   dezelfde bekende beperking als elke rem in dit huis (zie server/pinslot.js).
   Bij een vloot (server/vloot.js) betekende dat: vier processen, vier budgetten,
   dus vier keer zoveel missers voordat er iets dichtgaat. Precies de fout die
   deze rem bij de contactpin al een keer had -- tellen op een plek die de
   aanvaller kan vermenigvuldigen.

   Nu deelt hij zijn missers over de REALTIME-BUS (server/bus.js). Die bestond al
   en is de enige gedeelde leiding die dit huis heeft: zonder REDIS_URL is hij
   in-proces (en dan is dit precies het oude gedrag), met REDIS_URL loopt hij over
   pub/sub en telt elk proces ook de missers van de andere.

   DRIE KEUZES DIE ERTOE DOEN:

   1. LOKAAL TELLEN GEBEURT ALTIJD, ook als er geen bus is aangesloten of hij
      stuk is. De bus maakt de rem breder, nooit smaller. Een rem die uitvalt
      omdat een leiding hapert, is een rem die precies dan weg is wanneer je hem
      nodig hebt (LAT.md regel 5).
   2. DE EIGEN ECHO WORDT GENEGEERD. Bij Redis krijgt het publicerende proces
      zijn eigen bericht terug; zonder afzenderstempel zou elke misser hier
      dubbel tellen en beet de rem twee keer zo vroeg.
   3. HET IS BIJ BENADERING, EN DAT MAG. Dit is een budget over een minuut, geen
      harde teller: dat een bericht een fractie later aankomt, verschuift hooguit
      het moment. Een echte atomaire teller (Redis INCR) zou nauwkeuriger zijn en
      een tweede verbinding en een tweede faalwijze kosten, voor een precisie die
      dit budget niet vraagt. */
'use strict';

const VENSTER = 60 * 1000;
const MIS_PER_MINUUT = 120;

const KANAAL = 'link-rem';
const budget = { vanaf: 0, n: 0 };

/* Wie DIT proces is. Alleen om de eigen echo te herkennen; hij staat nergens
   anders en zegt niets over een mens. */
const IK = process.pid + ':' + Math.random().toString(36).slice(2, 8);
let bus = null;
/* Een abonnement is bij geen enkele bushouder op te zeggen (server/bus.js kent
   alleen subscribe). Daarom draagt elk abonnement het nummer van de aansluiting
   waarbij het hoort: wordt er losgekoppeld, dan blijft de oude luisteraar wel
   hangen maar telt hij niets meer. Zonder dat zou een toets die twee keer
   aansluit, elke misser twee keer tellen -- en de rem dus twee keer zo vroeg
   laten bijten dan wat er in productie gebeurt. */
let aansluiting = 0;

function tel() {
  const nu = Date.now();
  if (nu - budget.vanaf > VENSTER) { budget.vanaf = nu; budget.n = 0; }
  budget.n++;
}

function misserGeteld() {
  tel();
  /* Eerst tellen, dan pas melden -- en het melden mag stuk zijn. */
  /* De envelop zegt hoe gevoelig dit bericht is (regel van main, 27 augustus
     2026: elke plek die zelf een bericht samenstelt, classificeert het).
     Dit is een instance-naam en een teller -- intern, geen persoonsgegeven. */
  if (bus) { try { bus.publish(KANAAL, { van: IK, envelop: { classificatie: 'intern' } }); } catch (e) { /* de rem staat al */ } }
}

/* Eenmalig aansluiten bij het opstarten (server/opzet/diensten.js). Een tweede
   aanroep met dezelfde bus verandert niets; een tweede bus zou twee leidingen
   op een teller zetten en wordt daarom geweigerd. */
function remBus(nieuweBus) {
  if (!nieuweBus || bus === nieuweBus) return;
  if (bus) throw new Error('De deurrem heeft al een bus; een tweede zou dezelfde misser dubbel tellen.');
  bus = nieuweBus;
  const mijn = ++aansluiting;
  bus.subscribe(KANAAL, (bericht) => {
    if (mijn !== aansluiting) return;                 // een losgekoppelde leiding telt niet meer
    if (!bericht || bericht.van !== IK) tel();        // en de eigen echo ook niet
  });
}

const deurDicht = () => (Date.now() - budget.vanaf <= VENSTER) && budget.n >= MIS_PER_MINUUT;

// alleen voor de toetsen: het budget terugzetten zonder een minuut te wachten
function remReset() { budget.vanaf = 0; budget.n = 0; bus = null; aansluiting++; }

module.exports = { misserGeteld, deurDicht, remReset, remBus, MIS_PER_MINUUT, VENSTER, KANAAL };
