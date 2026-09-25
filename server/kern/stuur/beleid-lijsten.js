/* DE DRIE ALLOWLISTS VAN HET AI-STUUR -- de gegevens, niet het besluit.

   Deze stonden in ./beleid.js, tot dat bestand over de tienkilobytegrens van
   keuringsregel 13 groeide. De naad zit hier en nergens anders: hieronder staat
   WELKE paden een niveau hebben, in beleid.js staat WAT dat niveau betekent en
   welke poorten er nog overheen gaan (de bodem, de bewijspoort). Wie een route
   toevoegt raakt dit bestand aan; wie het besluit verandert raakt beleid.js
   aan, en die twee horen niet in dezelfde bewerking thuis.

   De kop van ./beleid.js legt uit waarom het er drie zijn en niet twee; die
   uitleg gaat over het besluit en blijft daar staan. */
'use strict';

/* LEZEN: haalt op en verandert niets. Wie hier iets bij zet dat schrijft,
   verplaatst een bevoegdheid zonder het te merken -- daarom staat de scheiding
   met KLEIN hieronder, en niet in een commentaarregel. */
const LEZEN = Object.freeze({
  member: [
    /^\/api\/bestanden\/mijn$/,
    /^\/api\/kantoorpakket\/(mijn|open|versies|uitslag)$/,
    /^\/api\/onderwijs\/(advies|ladder|mijn)$/,
    /^\/api\/leerstof\/(vakken|les)$/,
    /^\/api\/bijles\/gesprek$/,
    /^\/api\/mediaos\/(wereld|stuk)$/,
    /^\/api\/agenda\/(mijn|mijn-lijst|bereik|ics)$/,
    /^\/api\/locatie\/mijn$/,
    /^\/api\/asset\/(document|mijn)$/,
    /^\/api\/site\/(mijn|haal|versies|spoor|cijfers|sjablonen|sjabloon|fotos)$/,
    /^\/api\/meet\/mijn$/,
    /^\/api\/pay\/(overzicht|tiks)$/,
    /^\/api\/bank\/(overzicht|rekening|afschrift|rente-voorbeeld|passen|krediet|terugkerend|advies|hart|inzichten|vastelasten)$/,
    /^\/api\/bookings\/mine$/
  ],
  supplier: [
    /^\/api\/supplier\/state$/,
    /^\/api\/supplier\/agenda\/lijst$/,
    /^\/api\/supplier\/rtmail\/(inbox|verzonden|ongelezen)$/,
    /^\/api\/supplier\/site\/(mijn|haal|versies|spoor|cijfers)$/,
    /^\/api\/supplier\/pay\/overzicht$/
  ],
  staff: [
    /^\/api\/staff\/fluister\/profiel$/,
    /^\/api\/staff\/ov\/(dienst|lijnen)$/,
    /^\/api\/staff\/mob\/kaart\/storingen$/
  ],
  /* HET KANTOOR, UITSLUITEND OP TONEN (besluit C2 van de eigenaar, 25 september
     2026). Geen nieuwe gezagstrede en geen muterende kantoormacht: `office`
     staat hier en in GEEN van de twee lijsten eronder, en daar staat hij met
     opzet als lege lijst zodat een toevoeging een zichtbare bewerking is.

     DRIE PADEN: ze schrijven niets (gemeten), tonen TOTALEN en geen mensen, en
     gaan over RTG als onderneming. Bewust NIET: /office/state en
     /payroll/overzicht (mensen), /kosten/overzicht en /kosten/vooruitblik (per
     drager), /command/gezondheid (zet alarmen) en /service/stand (verzet een zaak).

     De AI kan nooit meer dan de mens die hem aanroept: /economie/werelden en
     /kosten/periode hangen achter de boardroom, dus een medewerker op naam
     zonder boardroomtoegang krijgt daar gewoon de weigering van de route zelf. */
  /* /api/office/bedrijfsmaat hoort hier inhoudelijk bij, maar komt pas als de
     idempotentieproef hem gemeten heeft (anders stijgt onbekendeEffectpaden). */
  office: [
    /^\/api\/command\/puls$/,
    /^\/api\/office\/economie\/werelden$/,
    /^\/api\/office\/kosten\/periode$/
  ]
});

/* KLEIN: verandert iets, maar alleen bij de gebruiker zelf, omkeerbaar en
   zonder dat er iemand anders of geld aan te pas komt. Deze vijf stonden
   hierboven bij het lezen en doen dat aantoonbaar niet. */
const KLEIN = Object.freeze({
  member: [
    /^\/api\/mediaos\/(stuur|volg)$/,   // zet de smaak / het volgen van dit lid
    /^\/api\/leerstof\/(oefen|antwoord)$/, // schrijft de oefenstand van dit lid
    /^\/api\/bijles\/vraag$/,          // roept een model aan: omkeerbaar, maar niet gratis
    /* INTREKKEN van een eigen klaargezet voorstel (besluit van de eigenaar,
       13 september 2026). Hij hoort hier en niet bij `lezen`, want hij verandert
       toestand; en hij hoort niet bij `voorstel`, want een voorstel om een
       voorstel te laten vervallen is een cirkel.

       WAAROM DIT DE MINST GEVAARLIJKE `klein` VAN DE DRIE IS, ondanks dat hij de
       hoogste gezagstrede haalt: de andere drie hierboven LATEN iets gebeuren
       (een smaak wordt gezet, een model wordt betaald). Deze kan uitsluitend
       vermogen INLEVEREN. De trede zegt hoe zelfstandig de machine handelt, niet
       hoe erg het is als hij ernaast zit -- en die twee lopen hier uit elkaar. */
    /^\/api\/member\/voorstel\/intrek$/
  ],
  /* MET OPZET NIET VOOR supplier EN staff, en daar bestaat de ROUTE ook niet.
     Het besluit van de eigenaar ging over een LID. Een intrekpad voor een zaak
     openzetten is twee besluiten in een: dat de werkwerelden hun eerste `klein`
     krijgen, en dat een zaak zijn voorstel conversationeel mag terugtrekken.
     Die twee horen apart gesteld te worden, en tot dan staat het gat zichtbaar
     in plaats van half gebouwd (zie routes/stuur.js). */
  supplier: [],
  staff: [],
  office: [] // C2: tonen, en niets dat verandert
});

/* DE ZESDE DIE SCHRIJFT, en de eerste die GELD verplaatst: /api/pay/saldo stond in de
   LEZEN-lijst hierboven en betaalt de maandfactuur uit het eigen RTG Pay-saldo
   (server/routes/pay.js -> kern/factuursaldo.js: afschrijven via pay.huisIn, de factuur
   sluiten via settleFactuur, en de 30%-afdracht aan de RTFoundation). De meting bevestigt
   CORRECTIE VAN 13 SEPTEMBER 2026, en zij hoort hier te staan: als derde bron stond hier de
   MEETUITSLAG ("kern/stuur/gevolg.js ziet er negen collecties bewegen"). Die negen waren
   VOORWERK van de idempotentieproef, aan dit pad toegerekend -- na de herijking in
   scripts/lib/idemproef.js is `opslag.a` hier LEEG en is de stand wat hij altijd al was:
   `ongemeten`, want zonder openstaande factuur komt de proef niet bij de muterende code.
   De twee bronnen die overblijven (de route en de kop van de module) zijn broncode en
   dragen deze reparatie zelfstandig; de meting droeg nooit iets bij.

   Zijn twee lijstgenoten (overzicht, tiks) zijn wel echt gemeten en allebei
   `geen-effect-gemeten`.

   WAAROM DAT ERGER WAS DAN DE VIJF VAN 31 AUGUSTUS. `DIRECT` is de vereniging van LEZEN
   en KLEIN en betekent: de AI mag dit ZONDER bevestiging. Er stond geen frictiebodem op
   dit pad (bodemVoorPad geeft null), terwijl elk ander geldpad van een lid op `voorstel`
   staat en /api/bank/sepa er nog een bodem `assist` bovenop draagt. Dit was dus het enige
   geldpad van een lid dat het stuur stil kon uitvoeren.

   NIET NAAR KLEIN MAAR NAAR VOORSTEL, en dat volgt uit de kop van KLEIN zelf: die eist
   omkeerbaar EN zonder geld. Een betaalde factuur met een afdracht is geen van beide.
   Hij gaat daarom bij zijn eigen soort staan, in de pay-groep hieronder.

   Gevonden op 13 september 2026 bij het schrijven van de gevolgcontracten voor de
   pay-rail -- niet door een toets, want test/stuur-niveaus.test.js voerde dit pad juist
   AAN als voorbeeld van een leesroute. Die toets staat nu op de geldweg en niet meer op
   de aanname. */
const VOORSTEL = Object.freeze({
  member: [
    /^\/api\/bestanden\/actie$/, // only the two explicit document contracts; never purge
    /^\/api\/kantoorpakket\/(maak|bewaar|deel|weg|ster|terug|fase|vul)$/,
    /^\/api\/onderwijs\/(inschrijf|jaar-over|doel)$/,
    /^\/api\/leerstof\/(examen|examen-antwoord)$/,
    /^\/api\/agenda\/(toevoegen|wijzig|verwijder|bewaar|uitnodig|antwoord)$/,
    /^\/api\/locatie\/(deel|stop)$/,
    /^\/api\/asset\/(koop|herroep|wachtlijst|gebruik|uitstap)$/,
    /^\/api\/site\/(bewaar|verwijder|herstel|publiceer|live|offline|plan|domein|foto|foto-weg)$/,
    /^\/api\/meet\/(maak|kom|verlaat|weg|sein)$/,
    /^\/api\/booking\/(request|pay)$/,
    /^\/api\/reservering\/annuleer$/,
    /^\/api\/pay\/(oplaad|stuur|verzoek|verzoek\/betaal|verzoek\/intrek|tik|kascode|saldo)$/,
    /^\/api\/bank\/(akkoord|rekening\/open|bevries|storten|overboek|naar-wallet|van-wallet|sepa|spaardoel|veeg)$/,
    /^\/api\/bank\/pas\/(uitgeven|bevries|limiet|betaal|sluit)$/,
    /^\/api\/bank\/krediet\/(aanvraag|aflossing)$/,
    /^\/api\/bank\/terugkerend\/(zet|stop)$/,
    /^\/api\/bank\/(bulk|salaris)$/
  ],
  supplier: [
    /^\/api\/supplier\/agenda\/(toevoegen|wijzig|verwijder)$/,
    /^\/api\/supplier\/rtmail\/(lees|stuur|inkoop|btw-herinner)$/,
    /^\/api\/supplier\/site\/(team\/zet|genereer|bewaar|publiceer|live|offline|herstel|plan|domein)$/,
    /^\/api\/supplier\/pay\/(in|uitbetaal)$/,
    /^\/api\/supplier\/(room\/hk|door\/zet|ticket\/add)$/,
    /^\/api\/overheid\/(toeslag\/beslis|uitkering\/beslis|bezwaar\/beslis|subsidie\/beslis|water\/melding\/zet|verkiezing\/sluit)$/,
    /^\/api\/gemeente\/(melding\/zet|vergunning\/beslis)$/
  ],
  staff: [
    /^\/api\/staff\/ov\/(pos|checkin|stand|lijn\/zet)$/,
    /^\/api\/staff\/mob\/kaart\/(controle|storing)$/,
    /^\/api\/staff\/mob\/cdt\/(aanmelden|soort|afmelden)$/,
    /^\/api\/supplier\/(room\/hk|door\/zet|ticket\/add)$/
  ],
  /* C2: het kantoor krijgt geen voorstelrecht. Een voorstel bevestigen vraagt
     een identiteit die kern/stuur/goedkeuring.js voor een kantoorsessie niet
     kent, en muterende kantoormacht is precies wat het besluit uitsloot. */
  office: []
});

module.exports = { LEZEN, KLEIN, VOORSTEL };
