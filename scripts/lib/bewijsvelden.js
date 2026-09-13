/* WELK BEWIJSVELD DRAAGT WELKE RELATIE?

   LAT.md regel 14: een bewijsveld draagt EEN bewijsrelatie. Draagt een veld er
   meerdere, dan worden die afzonderlijk benoemd en gemeten.

   Dit bestand is de inventaris die dat naloopbaar maakt, en net als WETTEN.json
   en scripts/lib/ijking.js is het een BESLUIT en geen berekening: welke relatie
   een veld draagt, leest een mens uit wat het register ermee doet.

   DE DRIE BEREIKSOORTEN, want daar zit de gevaarlijkste verwarring:

     CLAIM   waar zegt de doctrine dat de regel geldt?
     DRAAG   waar wordt die regel geimplementeerd?
     WACHT   waar kan de wachter de overtreding werkelijk zien?

   CLAIM en WACHT lijken op elkaar en zijn elkaars tegendeel. Een wet die
   platformbreed geldt en waarvan de wachter drie mappen ziet, is niet gedekt --
   maar als beide getallen `bereik` heten, ziet die zin eruit als een optelsom.

   WAT ER HIER NIET IN HOORT. Dit is geen woordenlijst voor het hele huis.
   `route` betekent in zeventien registers een HTTP-pad, en dat is consistentie
   en geen overbelasting. Een veld hoort hier pas als het binnen dezelfde
   bewijsvraag twee verschillende RELATIES draagt, of als het bewust gesplitst
   is om dat te voorkomen. */
'use strict';

/* Een veld dat GESPLITST is: het draagt aantoonbaar meer dan een relatie, en de
   splitsing staat erbij. `waar` noemt per relatie waar hij gemeten wordt, zodat
   een lezer kan nagaan dat de twee niet stiekem worden opgeteld. */
const GESPLITST = {
  handhaver: {
    register: 'WETTEN.json',
    waarom: 'het veld noemt zowel de WACHTER die rood wordt als de IMPLEMENTATIE die de regel draagt. ' +
      'Een implementatiebestand kan de wet dragen zonder ooit rood te worden, en een toets kan rood worden ' +
      'zonder de implementatie te zijn.',
    relaties: {
      BEWAAKT_DOOR: { waar: 'WETTEN.json:bewaaktDoor', uitleg: 'een toets of script dat rood wordt bij overtreding' },
      DRAAGT: { waar: 'WETTEN.json:draagt', uitleg: 'de code waarin de regel in het product wordt uitgevoerd' },
    },
    /* DE BRON IS GESPLITST (13 september 2026, besluit van de eigenaar). Het
       veld heette `handhaver` en woont nu als `bewaaktDoor` en `draagt` in
       WETTEN.json zelf, niet meer alleen in de lezing.

       EN TWEE KOLOMMEN WAREN NIET GENOEG: scripts/lib/wetrelatie.js beslist
       mechanisch welke kant een pad op hoort, zodat een DRAGER onder
       `bewaaktDoor` of een WACHTER onder `draagt` wordt afgewezen. Zonder die
       controle zou de oude foutklasse er nog staan, alleen netter opgemaakt --
       met een getal eronder dat officieel "wachters" heet. */
    bronGesplitst: true,
  },

  bereik: {
    register: '(meerdere)',
    waarom: 'drie betekenissen in de bewijsregisters, waarvan er twee elkaars tegendeel zijn: wat een ' +
      'wachter RAAKT en waarover een oordeel GELDT. Wie die twee optelt, leest waargenomen reik als ' +
      'verklaarde gelding -- valse dekking.',
    relaties: {
      WACHT: { waar: 'MAGNAATLAB.json:bereik', uitleg: 'welke kernmodules de simulatielaag werkelijk raakt' },
      CLAIM: { waar: 'TAALOORDEEL.json:vorm.bereik', uitleg: 'waarover dit oordeel gaat' },
      BEVOEGDHEID: { waar: 'EXECUTION_MAP.json:capabilities[].bereik', uitleg: 'wat een rol via het AI-stuur mag' },
    },
    bronGesplitst: false,
  },
};

/* Velden die een bewijsrelatie dragen en waarvan is vastgesteld dat het er EEN
   is. Ze staan hier zodat een tweede betekenis opvalt in plaats van te groeien. */
const ENKELVOUDIG = {
  relatie: { relatie: 'zelf', uitleg: 'zegt WELKE relatie een rand is; de enige plek waar een relatienaam hoort' },
  bronrelatie: { relatie: 'herkomst', uitleg: 'uit welk bronveld een rand is gelezen, zodat de lezing naloopbaar blijft' },
  grondwaarheid: { relatie: 'ijking', uitleg: 'waartegen een meter is geijkt (scripts/lib/ijking.js)' },
  gezienDoor: { relatie: 'waarneming', uitleg: 'welke sensoren een rand hebben gezien -- nooit een zekerheidscijfer' },
};

/* De registers waarin een veldnaam uit GESPLITST voorkomt en die dus MOETEN
   zeggen welke relatie zij bedoelen. Een nieuw register dat zo'n naam gebruikt
   zonder hier te staan, laat test/bewijsveld.test.js zakken. */
const GEBRUIKERS = {
  /* Gemeten op 13 september 2026 en niet geraden -- de eerste versie hiervan
     noemde RESOLVERBEREIK.json en CODEWERELD.json erbij omdat hun NAAM ernaar
     klinkt, en geen van beide draagt het veld. Een verklaring die verder reikt
     dan de meting is precies zo fout als een meting zonder verklaring. */
  bereik: ['MAGNAATLAB.json', 'TAALOORDEEL.json', 'EXECUTION_MAP.json'],
  /* Sinds de splitsing draagt WETTEN.json het veld niet meer; wat overblijft is
     de LEGACY-terugval in de lezers, die test/wetrelatie.test.js leeg houdt. */
  handhaver: [],
};

module.exports = { GESPLITST, ENKELVOUDIG, GEBRUIKERS };
