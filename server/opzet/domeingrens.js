/* ============================================================================
   DE DOMEINGRENS -- een doorkijk op de kern die alleen doorlaat wat een domein
   heeft opgeschreven.

   HET PROBLEEM. server.js bouwt een object `kern` met ruim negenhonderd
   eigenschappen en geeft dat aan elke router. Elk domein kan dus bij alles van
   elk ander domein. Het commentaar in opzet/routes.js belooft dat een domein
   later als eigen proces kan draaien; die belofte is niet na te komen zolang
   niemand kan zeggen wat een domein eigenlijk nodig heeft.

   De meting (scripts/grenzen.js) liet zien dat het oplosbaar is: van de 947
   aangeraakte namen wordt 85% door PRECIES EEN domein gebruikt. Vijfentwintig
   door vijf of meer -- app, auth, db, save, crypto. Dat lijstje is een echte
   interface. De zak is gedeeld, de inhoud niet.

   WAAROM EEN PROXY EN GEEN KOPIE, en dit is de kern van het ontwerp.

   Een gefilterde KOPIE lijkt eenvoudiger en is fout. server/routes/supplier/
   genrepuls.js zegt het zelf: "de motoren hangen pas NA deze routes aan de kern,
   dus we pakken ze op aanroepmoment via hun kern-sleutel". De zak wordt hier dus
   gebruikt als LATE BINDING: een router mag een naam noemen die er bij het
   ophangen nog niet is. Een kopie op mountmoment bevriest dat en levert
   undefined -- en dan neemt genrepuls stil de "geen motor"-tak. Precies de
   stille breuk waar dit huis voor bestaat.

   Een Proxy leest elke keer opnieuw uit de echte kern. Late binding blijft dus
   werken, en de grens geldt toch.

   EN HIJ GOOIT, HIJ ZWIJGT NIET. Een naam buiten de lijst geeft geen undefined
   maar een fout met het domein en de naam erin. Undefined is de gevaarlijkste
   uitkomst: `motor && motor.doeIets()` slaat er stil overheen en de route
   antwoordt vriendelijk het verkeerde. Een fout valt op, en in een toets zakt
   hij.

   WAT ER NIET TE ZIEN IS VOOR EEN SCANNER. Vier plekken lezen een naam die ze
   zelf uitrekenen (genrepuls, genreplan, genreblik, werkplek-bureaus). Die staan
   niet in de gemeten lijst en zullen de eerste keer door deze grens worden
   tegengehouden -- door een toets, met een fout die de naam noemt. Dat is de
   bedoeling: de lijst wordt compleet doordat hij ergens knelt, niet doordat
   iemand hem goed heeft geraden.
   ========================================================================== */
'use strict';

/* De namen die ELK domein mag, ongeacht wat er in zijn eigen lijst staat: de
   echte interface uit de meting, plus wat elke router nodig heeft om te kunnen
   bestaan. Los benoemd zodat je in GRENZEN.json alleen het domeineigene ziet. */
const INTERFACE = [
  'app', 'express', 'db', 'save', 'crypto', 'schoon',
  'auth', 'supplierAuth', 'officeAuth', 'staffAuth', 'techAuth',
  'accounts', 'keyVanCodenaam', 'codenaamVan', 'liveCodename',
  'logActivity', 'geenGast', 'tooManyTries', 'managerOnly', 'boardroomWie',
  'gegevensStop', 'talen', 'rtf', 'rtmail', 'anthropic',
  'sseToOffice', 'sseToSupplier', 'sseToCustomer', 'sseSend', 'sseClients'
];

/* Namen die geen domeingrens kennen omdat ze OVER domeinen gaan: de router
   hangt ze zelf op of geeft ze door. Zonder deze lijst zou opzet/routes.js zijn
   eigen bedrading niet meer kunnen doen. */
const DOORGEEF = ['kern', 'fs', 'path', 'DATA_DIR', 'UPLOAD_DIR'];

/* Een fout die zegt WAT er miste en WAAR, want daar gaat de hele grens over.
   De tekst noemt ook waar je het oplost: in GRENZEN.json en niet door de grens
   te verwijderen. */
function grensFout(domein, naam) {
  const e = new Error('domeingrens: het domein "' + domein + '" vraagt kern.' + naam +
    ' maar heeft die naam niet opgeschreven.\n' +
    '  Hoort hij daar? Zet hem in GRENZEN.json bij "' + domein + '".\n' +
    '  Hoort hij er NIET? Dan reikt dit domein te ver en is dit de grens die zijn werk doet.');
  e.domeingrens = { domein, naam };
  return e;
}

/* De doorkijk. Lezen van een toegestane naam gaat rechtstreeks naar de ECHTE
   kern (dus late binding blijft), lezen van iets anders gooit.

   Schrijven mag: routers hangen zelf dingen op (kern.zaakBoard = ...) en dat is
   hoe de lagen elkaar voeden. Een schrijfactie landt op de echte kern en wordt
   daarmee automatisch toegestaan -- wie iets neerzet, mag het ook lezen. */
/* Wat de meldstand heeft gezien, over alle domeinen samen. Buiten maakDoorkijk
   zodat een dumper er in een keer bij kan. */
const gemeld = new Set();

function maakDoorkijk(kern, domein, toegestaan) {
  const mag = new Set([].concat(INTERFACE, DOORGEEF, toegestaan || []));
  return new Proxy(kern, {
    get(doel, naam) {
      if (typeof naam !== 'string') return doel[naam];
      if (mag.has(naam)) return doel[naam];
      /* Wat er niet in de kern ZIT kan ook geen grensovertreding zijn: dan is
         het een gewone typefout of een optionele naam, en die hoort zijn eigen
         undefined te krijgen zoals altijd. De grens gaat over reiken naar iets
         van een ander, niet over iets wat niet bestaat. */
      if (!(naam in doel)) return undefined;
      /* DE MELDSTAND, en die bestaat om de LIJST te kunnen maken. Met
         RTG_GRENS_MELD=1 gooit de grens niet maar schrijft hij het overtreden
         paar weg en laat hij door. Zo vind je in EEN opstart alle gaten in
         GRENZEN.json in plaats van er een per keer, en dat is het verschil
         tussen een middag en een minuut.

         Dezelfde vorm als server/opzet/liegpoort.js: uit tenzij iemand hem
         aanzet, in de gewone keten en niet in een tweede opstartpad -- een pad
         dat je niet draait is een pad dat niet werkt. Hij hoort NOOIT in
         productie aan te staan, en daarom staat er ook een waarschuwing in de
         log zodra hij iets doorlaat. */
      if (process.env.RTG_GRENS_MELD === '1') {
        gemeld.add(domein + ' ' + naam);
        return doel[naam];
      }
      throw grensFout(domein, naam);
    },
    set(doel, naam, waarde) {
      doel[naam] = waarde;
      if (typeof naam === 'string') mag.add(naam);
      return true;
    },
    /* DE DOORKIJK MOET ZICH OOK VOORDOEN als een object dat alleen het
       toegestane bevat, en die eis komt uit een echte breuk bij het opstarten.

       server/routes/member/betalen.js doet `Object.assign({}, kern, {...})` om
       een submodule een aangevulde kern te geven. Object.assign LOOPT ALLE
       SLEUTELS LANGS en leest ze allemaal -- dus gooide de grens op
       `ordersVanZaak` (een supplier-naam) terwijl member die nergens gebruikt.
       De server kwam niet meer op.

       Met ownKeys en getOwnPropertyDescriptor eronder ziet zo'n kopie alleen wat
       dit domein mag, en dan is de kopie ook meteen correct begrensd in plaats
       van een gat in de grens. Enumereren is dus geen overtreding; RIJKEN naar
       een naam is dat wel. */
    has(doel, naam) { return typeof naam === 'string' ? (mag.has(naam) && naam in doel) : naam in doel; },
    ownKeys(doel) { return Reflect.ownKeys(doel).filter(n => typeof n !== 'string' || mag.has(n)); },
    getOwnPropertyDescriptor(doel, naam) {
      if (typeof naam === 'string' && !mag.has(naam)) return undefined;
      return Reflect.getOwnPropertyDescriptor(doel, naam);
    }
  });
}

module.exports = { maakDoorkijk, INTERFACE, DOORGEEF, grensFout,
  /* Voor scripts/grensmeld.js: wat de meldstand heeft opgevangen. */
  gemeld: () => [...gemeld].sort() };

/* De praktische ingang voor opzet/routes.js: laadt GRENZEN.json een keer en
   geeft een functie die per domein een doorkijk maakt.

   ONTBREEKT GRENZEN.json, dan gaat de grens NIET stilletjes open. Dan is de
   invoer van deze bewaker weg, en een bewaker zonder invoer die alles doorlaat
   is erger dan geen bewaker: hij staat er nog en niemand kijkt meer (LAT.md
   regel 3). Hij gooit bij het opstarten, met het commando erbij. */
module.exports.maakVoor = function maakVoor(kern, lezer) {
  const path2 = require('path');
  const fs2 = require('fs');
  const bestand = path2.join(__dirname, '..', '..', 'GRENZEN.json');
  let lijst;
  try { lijst = JSON.parse((lezer || fs2.readFileSync)(bestand, 'utf8')).domeinen; }
  catch (e) {
    throw new Error('domeingrens: GRENZEN.json is er niet of onleesbaar (' + e.message +
      '). Draai: npm run grenslijst. Zonder die lijst zou elke grens openstaan.');
  }
  if (!lijst || !Object.keys(lijst).length) {
    throw new Error('domeingrens: GRENZEN.json bevat geen enkel domein; dan houdt de grens niets tegen.');
  }
  /* Een domein dat niet in de lijst staat krijgt een LEGE eigen lijst en dus
     alleen de interface. Niet stilzwijgend alles: een nieuw routebestand hoort
     te knellen tot iemand opschrijft wat het nodig heeft. */
  return (domein) => maakDoorkijk(kern, domein, lijst[domein] || []);
};
