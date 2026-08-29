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

const CONTRACTEN = {
  /* ------------------------------------------------------------------------
     DE EERSTE DRIEENTWINTIG, EN WAAR HUN BEDOELING VANDAAN KOMT.

     Deze zijn NIET door een script ingedeeld. Voor elk van hen bestond al een
     `zelfdeVerzoek`-verklaring in ./idemsleutels.js -- geschreven door een mens
     die vond dat een woordelijk gelijk verzoek binnen vijf seconden een
     dubbeltik is en geen tweede handeling. Dat is de bedoeling, en die stond er
     dus al; wat ontbrak was het BEWIJS dat het ook zo gebeurt.

     Dat bewijs is er nu, en het is van de scherpste soort die deze proef kent:
     de kale ronde stuurde GEEN sleutel mee, en toch kwam de herhaling terug met
     `herhaald: true`. Dat kan alleen de idem-poort zijn (lib/idem-poort.js), en
     die handelt uitsluitend op een verklaring. Bedoeling en gedrag vallen hier
     dus aantoonbaar samen -- en dat is precies wat PROTECTED eist.

     Wat hier met opzet NIET bij staat: de drie routes waar de kale ronde wel
     'beschermd' zei maar zonder verklaring (POST /api/overheid/water/meld) of op
     grond van een verschil in de OPSLAG dat van een rem kan komen
     (POST /api/metier/zoek, POST /api/bedrijf/apparaten). Bij die eerste hoort
     eerst te worden uitgezocht welke laag daar iets doet dat niemand heeft
     opgeschreven; bij die andere twee is 'de eerste oproep bewoog iets' geen
     bewijs van deduplicatie -- /api/metier/zoek is een zoekroute en verandert
     niets, en de juiste stand is daar NOT_APPLICABLE.
     ---------------------------------------------------------------------- */
  'POST /api/agenda/toevoegen': {
    mutatieId: 'agenda.toevoegen',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/commerce/mand/leeg': {
    mutatieId: 'commerce.mand.leeg',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/concern/entiteit/nieuw': {
    mutatieId: 'concern.entiteit.nieuw',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/concern/nieuw': {
    mutatieId: 'concern.nieuw',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/gemeente/meld': {
    mutatieId: 'gemeente.meld',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/genootschap/richt-op': {
    mutatieId: 'genootschap.richt-op',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/gewoonten/maak': {
    mutatieId: 'gewoonten.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/kosten/grens/zet': {
    mutatieId: 'kosten.grens.zet',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/mall/lijst/nieuw': {
    mutatieId: 'mall.lijst.nieuw',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/mediaos/lijst/maak': {
    mutatieId: 'mediaos.lijst.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/member/leren/project-maak': {
    mutatieId: 'member.leren.project-maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/member/pin/uit': {
    mutatieId: 'member.pin.uit',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/architect/maak': {
    mutatieId: 'office.architect.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/atelier/maak': {
    mutatieId: 'office.atelier.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/hardware/maak': {
    mutatieId: 'office.hardware.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/ideeen/maak': {
    mutatieId: 'office.ideeen.maak',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/kosten/peil': {
    mutatieId: 'office.kosten.peil',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/kosten/vrijgeven': {
    mutatieId: 'office.kosten.vrijgeven',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/onboarding/bedrijf': {
    mutatieId: 'onboarding.bedrijf',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/onboarding/salonpost': {
    mutatieId: 'onboarding.salonpost',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/reis/invoer/lees': {
    mutatieId: 'reis.invoer.lees',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/supplier/activiteit/sluit': {
    mutatieId: 'supplier.activiteit.sluit',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/supplier/pay/treasury/zet': {
    mutatieId: 'supplier.pay.treasury.zet',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
};

module.exports = { CONTRACTEN };
