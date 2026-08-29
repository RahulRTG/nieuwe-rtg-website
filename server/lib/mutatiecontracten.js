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

const CONTRACTEN = {};

module.exports = { CONTRACTEN };
