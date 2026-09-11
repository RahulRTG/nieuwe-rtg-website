/* ============================================================================
   MUTATIECONTRACTEN -- DE KAARTKEUZE VAN EEN LID (kern/navigatie/mijnkaarten.js).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   MUTATIECONTRACT.md verbiedt `onbekend` voor wat nieuw publiek aanroepbaar
   wordt, dus staan deze drie er vooraf -- eerst het contract, dan de route.

   VIER ROUTES, TWEE SOORTEN. `gebieden` en `pakket` LEZEN en hebben niets te
   herhalen. `kies` en `weg` schrijven in EEN collectie (`navKaarten`, van deze
   laag zelf via kern/eigencollectie.js) en zijn idempotent omdat de keuze een
   VERZAMELING is: hetzelfde gebied twee keer kiezen geeft een keuze.

   `pakket` staat er met POST en niet met GET, en dat is geen slordigheid: het
   is een LEESroute die een lichaam met een gebiedscode aanneemt, zoals alle
   nav-routes in dit huis. Hij verandert niets -- hij leest de catalogus, kijkt
   in RTG_DATA_DIR en rekent controlegetallen. De BYTES gaan met GET (dat is een
   bestand achter een adres, en de browser bewaart het op dat adres); een GET
   telt niet als schrijfroute en heeft hier dus geen eigen regel.

   DE GROND IS DE BOUW EN NIET EEN KALE MEETRONDE, en dat verschil hoort hier te
   staan: de idempotentie volgt uit de vorm van de handeling (een set) en is
   afgedwongen door test/navigatiemijnkaarten.test.js toets 6, die zowel het
   beeld als de KANTOORTELLING nakijkt. Die tweede helft is er omdat de eerste
   een dubbeling niet kan zien -- het beeld bouwt een Set. Een toets die de
   dubbeling niet kan zien, is geen bewijs van idempotentie.

   WAT DIT CONTRACT NIET DEKT: de dag dat RTG een pakket op verzoek gaat BOUWEN.
   Dat is een handeling met kosten (bandbreedte, rekentijd) en die hoort niet
   idempotent te heten omdat de keuze dat is. Komt hij er, dan krijgt hij zijn
   eigen regel.
   ========================================================================== */
'use strict';

/* De aftekening is een OBJECT met `door` en `op`: de keuring leest die twee
   velden apart (server/kern/mutatiecontract/keuring.js). `door` zegt de
   METHODE en niet een mens die het niet heeft gelezen. */
const AFGETEKEND = { door: 'Claude, opgesteld bij het bouwen van de laag zelf; de grond is de ' +
  'BOUW en niet een meting -- test/navigatiemijnkaarten.test.js toets 6 is de grendel', op: '2026-09-10' };

const CONTRACTEN = {
  /* De catalogus met de keuze van dit lid ernaast. Leest; verandert niets. */
  'POST /api/nav/gebieden': {
    mutatieId: 'nav.gebieden', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'de route roept alleen navKaartenBeeld() aan; die leest de catalogus en de eigen ' +
        'collectie met kijk() -- de leesweg van kern/eigencollectie.js die niets aanlegt',
      op: '2026-09-10'
    },
    nagekeken: 'test/navigatiemijnkaarten.test.js toets 1 en 9, 2026-09-10: het beeld bij een lege ' +
      'datamap levert een lijst met een REDEN en legt geen collectie aan',
    afgetekend: AFGETEKEND
  },
  /* Het manifest van een gebouwd pakket: wat er te halen is, hoe groot en met
     welk controlegetal. Leest; verandert niets. Twee keer vragen geeft
     hetzelfde antwoord zolang het pakket niet opnieuw is gebouwd -- en juist
     DAN hoort het te verschillen, want dan is de kaart anders. */
  'POST /api/nav/gebied/pakket': {
    mutatieId: 'nav.gebied.pakket', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'de route roept navKaartPakket() aan; die leest de catalogus, doet statSync op de acht ' +
        'delen en hasht ze stromend. Er is geen db, geen save en geen collectie in ' +
        'kern/navigatie/toestelpakket.js -- de laag krijgt ze ook niet mee',
      op: '2026-09-10'
    },
    nagekeken: 'test/navigatietoestelpakket.test.js toets 1 en 9, 2026-09-10: hetzelfde manifest bij ' +
      'een tweede aanroep, en een ANDER controlegetal zodra het bestand verandert -- die tweede is de ' +
      'scherpe, want een som die op een cache blijft staan laat het toestel denken dat het de nieuwe ' +
      'kaart heeft',
    afgetekend: AFGETEKEND
  },
  /* Een gebied kiezen. Schrijft in navKaarten; idempotent omdat de keuze een
     verzameling is en geen teller. */
  'POST /api/nav/gebied/kies': {
    mutatieId: 'nav.gebied.kies', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'tweemaal hetzelfde gebied kiezen levert EEN keuze in de lijst van het lid en EEN ' +
        'in de kantoortelling -- die tweede is de scherpe, want het beeld bouwt een Set en zou een ' +
        'dubbele rij in de opslag niet zien',
      op: '2026-09-10'
    },
    nagekeken: 'test/navigatiemijnkaarten.test.js toets 6, 2026-09-10; de mutatie `if (true)` in ' +
      'plaats van `if (!rij.includes(c))` laat die toets zakken',
    afgetekend: AFGETEKEND
  },
  /* Een gebied weghalen. Weghalen wat er niet staat is geen fout -- de knop is
     per gebied en twee tikken horen geen foutmelding te geven -- maar het
     antwoord zegt wel of er iets af ging. */
  'POST /api/nav/gebied/weg': {
    mutatieId: 'nav.gebied.weg', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'tweemaal weghalen laat het gebied weg; de tweede aanroep geeft 200 met ' +
        '`verwijderd: false`, dus de herhaling is zichtbaar zonder een fout te zijn',
      op: '2026-09-10'
    },
    nagekeken: 'test/navigatiemijnkaarten.test.js toets 6, 2026-09-10',
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
