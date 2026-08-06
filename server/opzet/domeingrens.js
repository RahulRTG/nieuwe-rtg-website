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
      throw grensFout(domein, naam);
    },
    set(doel, naam, waarde) {
      doel[naam] = waarde;
      if (typeof naam === 'string') mag.add(naam);
      return true;
    },
    has(doel, naam) { return naam in doel; },
    ownKeys(doel) { return Reflect.ownKeys(doel); },
    getOwnPropertyDescriptor(doel, naam) { return Reflect.getOwnPropertyDescriptor(doel, naam); }
  });
}

module.exports = { maakDoorkijk, INTERFACE, DOORGEEF, grensFout };
