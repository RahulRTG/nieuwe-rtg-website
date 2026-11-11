/* Contractregister voor de bedoeling van iedere schrijfroute. De meetlaag mag
   een voorstel leveren, maar alleen een benoemd besluit bepaalt semantiek,
   toegang en bewijs. Het contract gaat altijd vóór de route. */
'use strict';

const CONTRACTEN = Object.assign({},
  /* Eerste domeinen; Object.assign bewaart de bestaande overschrijfvolgorde. */
  require('./mutatiecontracten-eerste').CONTRACTEN,
  /* RTG Vrijheid en RTG zelf als werkgever (VRIJHEID.md). */
  require('./mutatiecontracten-vrijheid').CONTRACTEN,
  require('./mutatiecontracten-magnaatleven').CONTRACTEN,
  require('./mutatiecontracten-democratie').CONTRACTEN,
  require('./mutatiecontracten-verbond').CONTRACTEN,
  require('./mutatiecontracten-beraad').CONTRACTEN,
  require('./mutatiecontracten-eigengezin').CONTRACTEN,
  require('./mutatiecontracten-toestemming').CONTRACTEN,
  require('./mutatiecontracten-leerhuis').CONTRACTEN,
  require('./mutatiecontracten-carriereledger').CONTRACTEN,
  require('./mutatiecontracten-vakschema').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling').CONTRACTEN,
  require('./mutatiecontracten-padparameter').CONTRACTEN,
  require('./mutatiecontracten-kaleronde').CONTRACTEN,
  require('./mutatiecontracten-kaleronde-b').CONTRACTEN,
  require('./mutatiecontracten-tweedehandeling-b').CONTRACTEN,
  require('./mutatiecontracten-voorstelintrek').CONTRACTEN,
  require('./mutatiecontracten-isolatie').CONTRACTEN,
  require('./mutatiecontracten-isolatie-lid').CONTRACTEN,
  require('./mutatiecontracten-samenvoeging').CONTRACTEN,
  /* De publieke laag: volgen op een aanwezigheid, en de redactiehandeling van
     De Salon (STAGE.md par. 5a). */
  require('./mutatiecontracten-stage').CONTRACTEN,
  require('./mutatiecontracten-reisconcept').CONTRACTEN,
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
  require('./mutatiecontracten-rtflabfonds').CONTRACTEN,
  require('./mutatiecontracten-vracht').CONTRACTEN,
  require('./mutatiecontracten-rtgid').CONTRACTEN,
  require('./mutatiecontracten-salon').CONTRACTEN,
  require('./mutatiecontracten-codefamilie').CONTRACTEN, // B9, B11, B12, B14
  require('./mutatiecontracten-restdeuren').CONTRACTEN,
  require('./mutatiecontracten-codedeuren').CONTRACTEN,
  require('./mutatiecontracten-lesfamilie').CONTRACTEN,
  require('./mutatiecontracten-lesstroom').CONTRACTEN,
  require('./mutatiecontracten-ijs').CONTRACTEN, // TURN-credentials, docs/turn-server.md
  require('./mutatiecontracten-sessiestroom').CONTRACTEN,
  require('./mutatiecontracten-werksleutels').CONTRACTEN,
  require('./mutatiecontracten-machinesleutels').CONTRACTEN,
  require('./mutatiecontracten-ssogeheim').CONTRACTEN,
  require('./mutatiecontracten-muziekfeed').CONTRACTEN,
  require('./mutatiecontracten-hardening-checkpoint').CONTRACTEN,
  require('./mutatiecontracten-beschermzaak').CONTRACTEN,
  require('./mutatiecontracten-civilis-opvang').CONTRACTEN,
  require('./mutatiecontracten-personalisatie'),
  require('./mutatiecontracten-rtf-onboarding').CONTRACTEN,
  require('./mutatiecontracten-knelpunt').CONTRACTEN,
  require('./mutatiecontracten-drager').CONTRACTEN,
  require('./mutatiecontracten-connectdelen').CONTRACTEN,
  /* De naleesronde van 13 september 2026 -- zie de kop van het eerste bestand. */
  require('./mutatiecontracten-naleesronde').CONTRACTEN,
  require('./mutatiecontracten-naleesronde-b').CONTRACTEN,
  require('./mutatiecontracten-naleesronde-c').CONTRACTEN,
  require('./mutatiecontracten-opvangwijzer').CONTRACTEN,
  require('./mutatiecontracten-inhaal').CONTRACTEN,
  // horecacorrectie en de twee teruggaveloketten
  require('./mutatiecontracten-teruggave').CONTRACTEN,
  /* De nazorg van een reisaanvraag: vier routes die samen de weg terug uit een
     toezegging zijn. Eigen bestand omdat ze een afweging delen -- zie de kop. */
  require('./mutatiecontracten-reisnazorg').CONTRACTEN,
  require('./mutatiecontracten-reisherkomst').CONTRACTEN,
  require('./mutatiecontracten-conciergelus').CONTRACTEN,
  require('./mutatiecontracten-partnernetwerk').CONTRACTEN,
  /* Een lid en zijn eigen lidmaatschap: twee lezers en een opzegging. Eigen
     bestand omdat het indelen er een defect uit haalde -- zie de kop. */
  require('./mutatiecontracten-lidabonnement').CONTRACTEN,
  require('./mutatiecontracten-integratie').CONTRACTEN,
  /* RTG Move: drie routes die alle drie lezen, met de BOUW als grond in plaats
     van een meting. Eigen bestand om dat verschil te bewaren -- zie de kop. */
  require('./mutatiecontracten-move').CONTRACTEN,
  require('./mutatiecontracten-network').CONTRACTEN,
  require('./mutatiecontracten-praktijk').CONTRACTEN,
  require('./mutatiecontracten-zaakregie').CONTRACTEN,
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
  require('./mutatiecontracten-afstemming').CONTRACTEN,
  require('./mutatiecontracten-wonen').CONTRACTEN,
  require('./mutatiecontracten-project-room').CONTRACTEN,
  // de zware poort: drie ceremonieloketten, met opzet niet herhaalbaar
  require('./mutatiecontracten-zwaar').CONTRACTEN,
  // het eigenaarsherstel: zeven routes, zie de kop daar
  require('./mutatiecontracten-herstel').CONTRACTEN,
  require('./mutatiecontracten-kantoorstuur').CONTRACTEN,
  require('./mutatiecontracten-rtgboek').CONTRACTEN,
  require('./mutatiecontracten-vrijgave').CONTRACTEN,
  require('./mutatiecontracten-naargast').CONTRACTEN,
  require('./mutatiecontracten-leidingtermijn').CONTRACTEN,
  /* De levende Mall-etaleerder leest en verbindt bestaande bronnen. Hij maakt
     zelf geen product, recht, bestelling of betaling. */
  require('./mutatiecontracten-mall-living').CONTRACTEN,
  /* De zevenenveertig die uit de afleidgang vielen toen die een grens erbij
     kreeg, met de hand gelezen op 13 september 2026 (zie de kop van de eerste). */
  require('./mutatiecontracten-afleidrest').CONTRACTEN,
  require('./mutatiecontracten-afleidrest-b').CONTRACTEN,
  require('./mutatiecontracten-afleidrest-c').CONTRACTEN,
  require('./mutatiecontracten-afleidrest-d').CONTRACTEN,
  require('./mutatiecontracten-afleidrest-e').CONTRACTEN,
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
  require('./mutatiecontracten-werkruimterechten'),
  require('./mutatiecontracten-reisopgave'),
  require('./mutatiecontracten-ritontvangst'),
  require('./mutatiecontracten-proefronde-lijst'),
  require('./mutatiecontracten-ovronde'),
  require('./mutatiecontracten-objectronde'),
  require('./mutatiecontracten-effect'),
  require('./mutatiecontracten-premium-opdrachten').CONTRACTEN,
  require('./mutatiecontracten-deepgreen-r3').CONTRACTEN);


require('./mutatiecontracten-effectguard');

module.exports = { CONTRACTEN };
