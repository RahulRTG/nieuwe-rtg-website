/* ============================================================================
   DE BEDOELING PER SCHRIJFROUTE -- het enige mensenwerk in het contractregister.

   scripts/mutatiecontract.js leidt vier van de vijf assen af uit een bron: de
   routes en hun deur uit de draaiende router, het duplicaatgedrag uit
   ./idemsleutels.js, het bewijs uit IDEMPROEF.json. Wat een machine niet kan
   waarnemen is de BEDOELING: of een tweede aanroep een dubbeltik is of een
   tweede handeling, en of een open deur open HOORT te staan.

   Dat staat hier, per route, met de reden erbij.

   DE VOLGORDE IS EEN GRENS EN GEEN GEWOONTE. Eerst het contract, dan de route.
   Een schrijfroute zonder contract laat de keuring zakken (regel in
   scripts/check.js), en dat is de hele reden dat dit bestand bestaat: zo kan het
   gat niet stil weer groeien terwijl iemand aan de achterkant aan het opruimen
   is.

   WAT HIER NIET MAG. Een stand invullen omdat de meter iets liet zien. De meter
   levert een VOORSTEL; hier staat een besluit. Het verschil is dat een besluit
   een naam en een datum draagt, en dat iemand het kan terugdraaien omdat hij
   ziet wie het nam.

   VORM (zie server/kern/mutatiecontract.js voor de keuring):

     'POST /api/pad': {
       mutatieId: 'domein.handeling',
       semantiek: { klasse: '<uit kern/mutatie.js>' },
       toegang:   { klasse: '<uit kern/mutatiecontract.js>', ... },
       stand:     '<uit kern/mutatiecontract.js>',
       waarom:    '...',            // verplicht bij NON_IDEMPOTENT en UNTESTABLE
       nagekeken: 'wie, wanneer',   // verplicht bij NOT_APPLICABLE
       bewijs:    { gemeten: '...', op: '...' }
     }

   HIJ IS MET OPZET BIJNA LEEG. Er staan 4653 schrijfroutes tegenover, en dat
   verschil is de eerlijke stand van zaken: dit huis weet van bijna geen enkele
   route formeel wat een tweede aanroep hoort te doen. Elke regel die hier
   bijkomt, is er een die iemand heeft nagekeken -- niet een die een script heeft
   geraden. Het register vult zich dus langzaam, en dat is de bedoeling.
   ========================================================================== */
'use strict';

const CONTRACTEN = Object.assign({},
  /* Opgesplitst omdat scripts/check.js een bestandsgrens kent en die terecht
     aansloeg: een lijst die naar duizenden regels groeit, hoort niet in een
     bestand dat ook nog de vorm en de regels uitlegt. Dezelfde vorm als
     ./idemsleutels.js, die om precies dezelfde reden vier zijbestanden heeft. */
  require('./mutatiecontracten-beschermd').CONTRACTEN,
  require('./mutatiecontracten-leest').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling').CONTRACTEN,
  require('./mutatiecontracten-padparameter').CONTRACTEN,
  require('./mutatiecontracten-kaleronde').CONTRACTEN,
  require('./mutatiecontracten-kaleronde-b').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling-b').CONTRACTEN,
  require('./mutatiecontracten-isolatie').CONTRACTEN,
  require('./mutatiecontracten-isolatie-lid').CONTRACTEN,
  require('./mutatiecontracten-samenvoeging').CONTRACTEN,
  /* RTG Service: eenentwintig nieuwe schrijfroutes, en dus eenentwintig
     contracten VOORAF -- MUTATIECONTRACT.md verbiedt `onbekend` voor wat nieuw
     publiek aanroepbaar wordt. Eigen bestand om de reden hierboven. */
  require('./mutatiecontracten-service').CONTRACTEN,
  require('./mutatiecontracten-service-kantoor').CONTRACTEN,
  require('./mutatiecontracten-service-zaak').CONTRACTEN,
  require('./mutatiecontracten-service-bel').CONTRACTEN,
  require('./mutatiecontracten-beschermzaak').CONTRACTEN,
  require('./mutatiecontracten-knelpunt').CONTRACTEN,
  require('./mutatiecontracten-opvangwijzer').CONTRACTEN,
  require('./mutatiecontracten-horeca-correctie').CONTRACTEN,
  require('./mutatiecontracten-integratie').CONTRACTEN,
  /* ALS LAATSTE, en dat is geen willekeur. Deze 788 vallen onder een BESLUIT
     over de bewijsstandaard en niet onder een mens die ze een voor een las. De
     vier hierboven zijn specifieker; Object.assign laat de laatste winnen, dus
     zou deze een van hen overschrijven -- vandaar de controle eronder, want
     "zou niet moeten" is geen handhaving. */
  require('./mutatiecontracten-kaleronde-c'),
  require('./mutatiecontracten-geldgrens'),
  require('./mutatiecontracten-wachtrij'),
  require('./mutatiecontracten-effectmeter'),
  require('./mutatiecontracten-uitvoer'),
  require('./mutatiecontracten-hindernis'),
  require('./mutatiecontracten-reis'),
  require('./mutatiecontracten-proefronde-lijst'),
  require('./mutatiecontracten-ovronde'),
  require('./mutatiecontracten-objectronde'),
  require('./mutatiecontracten-effect'));

{
  const effect = require('./mutatiecontracten-effect');
  const eerder = Object.assign({},
    require('./mutatiecontracten-beschermd').CONTRACTEN,
    require('./mutatiecontracten-leest').CONTRACTEN,
    require('./mutatiecontracten-tweedehandeling').CONTRACTEN,
    require('./mutatiecontracten-padparameter').CONTRACTEN,
    require('./mutatiecontracten-kaleronde').CONTRACTEN,
    require('./mutatiecontracten-kaleronde-b').CONTRACTEN,
    require('./mutatiecontracten-tweedehandeling-b').CONTRACTEN,
    require('./mutatiecontracten-isolatie').CONTRACTEN,
    require('./mutatiecontracten-isolatie-lid').CONTRACTEN,
    require('./mutatiecontracten-samenvoeging').CONTRACTEN);
  const overschreven = Object.keys(effect).filter(k => k in eerder);
  if (overschreven.length) {
    throw new Error('mutatiecontracten: ./mutatiecontracten-effect overschrijft een specifieker ' +
      'contract: ' + overschreven.slice(0, 5).join(', ') + (overschreven.length > 5 ? ' (+' +
      (overschreven.length - 5) + ')' : '') + '. Haal die route uit scripts/effectcontracten.js zijn ' +
      'uitkomst -- een besluit over een standaard mag nooit over een gelezen contract heen.');
  }
}

module.exports = { CONTRACTEN };
