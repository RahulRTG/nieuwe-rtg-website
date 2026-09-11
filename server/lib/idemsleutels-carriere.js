/* DE CARRIERELAAG: RTG Vertegenwoordiging, het jeugdbestuur, RTG Rugdekking en
   het carriere ledger.

   TIEN REGELS, EN ZEVENTIEN DIE HIER JUIST NIET STAAN. Die zeventien schrijfwegen
   weten het ZELF al -- ze weigeren een herhaling op grond van de toestand
   -- en staan daarom in ./idemsleutels-nooit-routes.js, elk met zijn eigen
   reden (elf in ./idemsleutels-nooit-carriere.js, zes in ./idemsleutels-nooit-ledger.js).

   DAT IS EEN CORRECTIE, en de fout hoort hier te blijven staan. Ze stonden
   eerst met `zelfdeVerzoek: true` in dit bestand, en dat deed twee dingen die
   allebei fout waren. Het INSTALLEERDE een duplicaatlaag op routes die er geen
   nodig hadden: een tweede identiek verzoek kreeg het AFGESPEELDE antwoord van
   de eerste in plaats van de weigering, dus de eigen dubbelklikcontrole van
   `rugdekking/stel` vuurde nooit -- juist de controle die voorkomt dat RTG stil
   het dubbele aan een mens belooft. En het sprak de mutatiecontracten tegen,
   die bij elk van deze routes met zoveel woorden zeggen: een TOESTANDSCONTROLE
   en geen duplicaatlaag (MUTATIECONTRACT.md par. 5o).

   De toetsen vonden het: test/rugdekking.e2e.test.js 12, 13 en 14 zakten zodra
   deze regels erbij kwamen, met een 200 waar een 409 hoorde. Een verklaring die
   het gedrag VERANDERT is geen verklaring.

   Wat hier overblijft zijn de acht leeswegen en de drie routes die met opzet WEL
   een tweede handeling uitvoeren. */
'use strict';

const SLEUTELS = {
  /* Acht leeswegen: geen van de acht raakt de opslag. Alle vijf gebruiken
     `kijk()` en niet `bak()`, zodat een blik geen lege rij achterlaat
     (kern/eigencollectie.js). `leest` en niet `zelfdeVerzoek`, om dezelfde
     reden als bij ./idemsleutels-kaarten.js: een tweede vraag hoort het
     antwoord van NU te krijgen. Bij `rugdekking/lijst` is dat concreet -- de
     beursstand kan tussen twee vragen zijn omgezet. */
  'POST /api/vertegenwoordiging/bevoegdheden': { leest: true },
  'POST /api/vertegenwoordiging/mijn': { leest: true },
  'POST /api/vertegenwoordiging/simulatie': { leest: true },
  'POST /api/rugdekking/lijst': { leest: true },
  'POST /api/rugdekking/mijn': { leest: true },
  'POST /api/office/rugdekking/alle': { leest: true },
  'POST /api/carriere/ledger/mijn': { leest: true },
  'POST /api/carriere/ledger/delen': { leest: true },

  /* DE ENIGE DIE MET OPZET EEN TWEEDE KEER IETS DOET. Elke aanroep zet een regel
     in het spoor van de client, en dat IS de bedoeling: twee keer namens iemand
     handelen zijn twee handelingen, en de client hoort ze allebei te zien -- ook
     als ze op elkaar lijken. Ze samenvouwen zou betekenen dat een tweede,
     latere handeling verdwijnt in de eerste, terwijl juist het AANTAL keren dat
     er namens u iets gebeurde is wat een client wil weten. Datzelfde geldt voor
     een GEWEIGERDE poging: die wordt bewust gelogd, want een vertegenwoordiger
     die drie keer iets probeerde wat hij niet mocht, is een gesprek waard. */
  'POST /api/vertegenwoordiging/handel': { nietIdempotent: true,
    waarom: 'elke aanroep is een eigen handeling in het spoor van de client; samenvouwen zou een ' +
      'tweede handeling laten verdwijnen in de eerste, en ook een geweigerde poging hoort zichtbaar te blijven' },

  /* EN TWEE IN HET LEDGER, allebei om een reden die niets met nalatigheid te
     maken heeft. `deel` SLAAT een geheim: twee oproepen horen twee codes te
     geven, want een code per ontvanger is de bedoeling -- elk stopt apart -- en
     hetzelfde geheim nog eens over de lijn sturen is erger dan een tweede rij.
     `toon` TELT een gebruik, en een teller die niet telt, telt niet: hoe vaak
     zijn bewijs is geopend, is de enige terugkoppeling die een lid over een
     uitgegeven code heeft. */
  'POST /api/carriere/ledger/deel': { nietIdempotent: true,
    waarom: 'elke aanroep slaat een nieuw geheim van 128 bits dat precies eenmaal wordt teruggegeven; ' +
      'een code per ontvanger is de bedoeling, want elk stopt apart' },
  'POST /api/carriere/regel/toon': { nietIdempotent: true,
    waarom: 'elke aanroep telt een gebruik op de deelcode; het lid hoort te kunnen zien hoe vaak zijn ' +
      'bewijs is geopend, en dat is de enige terugkoppeling die hij erover heeft' }
};

module.exports = { SLEUTELS };
