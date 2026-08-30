/* ============================================================================
   MUTATIECONTRACTEN -- DE BESCHERMDE ROUTES.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Hier staan de routes waarvan is VASTGESTELD dat een herhaling het werk
   niet nog een keer doet.

   HUN BEDOELING KOMT NIET UIT EEN METING. Voor bijna alle stond die al in
   ./idemsleutels.js als `zelfdeVerzoek` -- geschreven door iemand die vond dat
   een woordelijk gelijk verzoek binnen vijf seconden een dubbeltik is en geen
   tweede handeling. Wat ontbrak was het BEWIJS dat het ook zo gebeurt, en dat is
   nu van de scherpste soort die deze proef kent: de kale ronde stuurde GEEN
   sleutel mee en kreeg toch `herhaald: true` terug. Dat kan alleen de idem-poort
   zijn (lib/idem-poort.js), en die handelt uitsluitend op een verklaring.
   Bedoeling en gedrag vallen hier dus aantoonbaar samen.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS. Deze contracten zijn opgesteld
   door Claude op grond van een MEETING plus een bestaand besluit -- niet door een
   mens die ze een voor een heeft gelezen. Dat verschil hoort in het register te
   staan en niet gladgestreken te worden: "gemeten en voorgesteld" is iets anders
   dan "door een mens beoordeeld", en dat onderscheid houdt de rest van dit
   register overeind.

   Wie er een naleest en er zijn naam onder wil zetten, vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gemeten kale ronde plus het bestaande besluit; ' +
    'niet door een mens nagelezen',
  op: '2026-08-30'
};


/* HET BEWIJS IS VOOR ALLE VIERENTWINTIG HETZELFDE, dus staat het EEN keer.

   Vierentwintig keer dezelfde zin overtypen is niet alleen lang -- het is de
   vorm waarin een verschil onopgemerkt insluipt. Wie er straks een toevoegt met
   een net andere formulering, suggereert een ander soort bewijs dan er is. */
const BEWIJS = {
  gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, wat alleen de ' +
    'idem-poort kan zijn -- en die handelt op de zelfdeVerzoek-verklaring in ./idemsleutels.js',
  op: '2026-08-29'
};

/* De vorm is voor alle vierentwintig gelijk: een ingelogde identiteit, een
   herhaling die wordt herkend, en een mens die dat eerder al vond. */
const beschermd = (route, mutatieId) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  beschermd('POST /api/agenda/toevoegen', 'agenda.toevoegen'),
  beschermd('POST /api/commerce/mand/leeg', 'commerce.mand.leeg'),
  beschermd('POST /api/concern/entiteit/nieuw', 'concern.entiteit.nieuw'),
  beschermd('POST /api/concern/nieuw', 'concern.nieuw'),
  beschermd('POST /api/gemeente/meld', 'gemeente.meld'),
  beschermd('POST /api/genootschap/richt-op', 'genootschap.richt-op'),
  beschermd('POST /api/gewoonten/maak', 'gewoonten.maak'),
  beschermd('POST /api/kosten/grens/zet', 'kosten.grens.zet'),
  beschermd('POST /api/mall/lijst/nieuw', 'mall.lijst.nieuw'),
  beschermd('POST /api/mediaos/lijst/maak', 'mediaos.lijst.maak'),
  beschermd('POST /api/member/leren/project-maak', 'member.leren.project-maak'),
  beschermd('POST /api/member/pin/uit', 'member.pin.uit'),
  beschermd('POST /api/office/architect/maak', 'office.architect.maak'),
  beschermd('POST /api/office/atelier/maak', 'office.atelier.maak'),
  beschermd('POST /api/office/hardware/maak', 'office.hardware.maak'),
  beschermd('POST /api/office/ideeen/maak', 'office.ideeen.maak'),
  beschermd('POST /api/office/kosten/peil', 'office.kosten.peil'),
  beschermd('POST /api/office/kosten/vrijgeven', 'office.kosten.vrijgeven'),
  beschermd('POST /api/onboarding/bedrijf', 'onboarding.bedrijf'),
  beschermd('POST /api/onboarding/salonpost', 'onboarding.salonpost'),
  beschermd('POST /api/reis/invoer/lees', 'reis.invoer.lees'),
  beschermd('POST /api/supplier/activiteit/sluit', 'supplier.activiteit.sluit'),
  beschermd('POST /api/supplier/pay/treasury/zet', 'supplier.pay.treasury.zet'),
  beschermd('POST /api/overheid/water/meld', 'overheid.water.meld'),
]);

module.exports = { CONTRACTEN };
