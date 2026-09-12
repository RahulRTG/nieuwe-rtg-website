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
  require('./mutatiecontracten-storingen').CONTRACTEN,
  /* Opgesplitst omdat scripts/check.js een bestandsgrens kent en die terecht
     aansloeg: een lijst die naar duizenden regels groeit, hoort niet in een
     bestand dat ook nog de vorm en de regels uitlegt. Dezelfde vorm als
     ./idemsleutels.js, die om precies dezelfde reden vier zijbestanden heeft. */
  require('./mutatiecontracten-beschermd').CONTRACTEN,
  require('./mutatiecontracten-leest').CONTRACTEN,
  require('./mutatiecontracten-vertegenwoordiging').CONTRACTEN,
  require('./mutatiecontracten-rugdekking').CONTRACTEN,
  require('./mutatiecontracten-carriereledger').CONTRACTEN,
  require('./mutatiecontracten-vakschema').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling').CONTRACTEN,
  require('./mutatiecontracten-padparameter').CONTRACTEN,
  require('./mutatiecontracten-kaleronde').CONTRACTEN,
  require('./mutatiecontracten-kaleronde-b').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling-b').CONTRACTEN,
  require('./mutatiecontracten-isolatie').CONTRACTEN,
  require('./mutatiecontracten-isolatie-lid').CONTRACTEN,
  require('./mutatiecontracten-samenvoeging').CONTRACTEN,
  /* De zestien waardebewegende routes die nog op `onbekend` stonden
     (GELDDEKKING.json). Eigen bestand om dezelfde reden als hierboven, en omdat
     ze een gedeelde herkomst hebben: ze zijn alle zestien gelezen in een ronde,
     met de meting ernaast als bevestiging en nooit als reden. */
  require('./mutatiecontracten-geld').CONTRACTEN,
  require('./mutatiecontracten-geld-b').CONTRACTEN,
  require('./mutatiecontracten-gelduit').CONTRACTEN,
  require('./mutatiecontracten-geld-lees').CONTRACTEN,
  /* RTG Service: eenentwintig nieuwe schrijfroutes, en dus eenentwintig
     contracten VOORAF -- MUTATIECONTRACT.md verbiedt `onbekend` voor wat nieuw
     publiek aanroepbaar wordt. Eigen bestand om de reden hierboven. */
  require('./mutatiecontracten-service').CONTRACTEN,
  require('./mutatiecontracten-service-kantoor').CONTRACTEN,
  require('./mutatiecontracten-service-zaak').CONTRACTEN,
  require('./mutatiecontracten-service-bel').CONTRACTEN,
  require('./mutatiecontracten-supplier-notificaties').CONTRACTEN,
  require('./mutatiecontracten-credential').CONTRACTEN,
  require('./mutatiecontracten-rtfsamen').CONTRACTEN,
  require('./mutatiecontracten-vracht').CONTRACTEN,
  require('./mutatiecontracten-rtgid').CONTRACTEN,
  require('./mutatiecontracten-salon').CONTRACTEN,
  require('./mutatiecontracten-hardening-checkpoint').CONTRACTEN,
  require('./mutatiecontracten-beschermzaak').CONTRACTEN,
  require('./mutatiecontracten-knelpunt').CONTRACTEN,
  require('./mutatiecontracten-opvangwijzer').CONTRACTEN,
  require('./mutatiecontracten-horeca-correctie').CONTRACTEN,
  /* De nazorg van een reisaanvraag: vier routes die samen de weg terug uit een
     toezegging zijn. Eigen bestand omdat ze een afweging delen -- zie de kop. */
  require('./mutatiecontracten-reisnazorg').CONTRACTEN,
  /* Een lid en zijn eigen lidmaatschap: twee lezers en een opzegging. Eigen
     bestand omdat het indelen er een defect uit haalde -- zie de kop. */
  require('./mutatiecontracten-lidabonnement').CONTRACTEN,
  require('./mutatiecontracten-integratie').CONTRACTEN,
  /* RTG Move: drie routes die alle drie lezen, met de BOUW als grond in plaats
     van een meting. Eigen bestand om dat verschil te bewaren -- zie de kop. */
  require('./mutatiecontracten-move').CONTRACTEN,
  /* De kaartkeuze van een lid. Eigen bestand omdat de grond de BOUW is (de
     keuze is een verzameling) en niet een kale meetronde. */
  require('./mutatiecontracten-kaarten').CONTRACTEN,
  /* De leesweg naar de schaduwtelling van de herkomstpoort. Eigen bestand omdat
     het bewijs er van een andere soort is dan in ./mutatiecontracten-leest.js --
     een lezing van de handler in plaats van een gemeten kale ronde. Zie de kop. */
  require('./mutatiecontracten-schaduwtelling').CONTRACTEN,
  /* De tweede handtekening: twee routes die een aanvraag maken en drie die het
     loket zijn. Eigen bestand omdat het interessante in het VERSCHIL tussen die
     twee helften zit -- zie de kop. */
  require('./mutatiecontracten-tweedehand').CONTRACTEN,
  require('./mutatiecontracten-wonen').CONTRACTEN,
  require('./mutatiecontracten-project-room').CONTRACTEN,
  /* De zware poort: drie ceremonieloketten, alle drie met opzet niet
     herhaalbaar. Eigen bestand, zie de kop daar. */
  require('./mutatiecontracten-zwaar').CONTRACTEN,
  /* Het eigenaarsherstel: zeven routes, per stuk beantwoord of een herhaling
     een ander antwoord krijgt. Eigen bestand, zie de kop daar. */
  require('./mutatiecontracten-herstel').CONTRACTEN,
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
    require('./mutatiecontracten-samenvoeging').CONTRACTEN,
    require('./mutatiecontracten-wonen').CONTRACTEN,
    require('./mutatiecontracten-lidabonnement').CONTRACTEN);   // ook hier: de guard moet hem kennen
  const overschreven = Object.keys(effect).filter(k => k in eerder);
  if (overschreven.length) {
    throw new Error('mutatiecontracten: ./mutatiecontracten-effect overschrijft een specifieker ' +
      'contract: ' + overschreven.slice(0, 5).join(', ') + (overschreven.length > 5 ? ' (+' +
      (overschreven.length - 5) + ')' : '') + '. Haal die route uit scripts/effectcontracten.js zijn ' +
      'uitkomst -- een besluit over een standaard mag nooit over een gelezen contract heen.');
  }
}

module.exports = { CONTRACTEN };
