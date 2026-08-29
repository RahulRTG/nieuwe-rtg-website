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

const CONTRACTEN = {
  'POST /api/agenda/toevoegen': {
    mutatieId: 'agenda.toevoegen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/commerce/mand/leeg': {
    mutatieId: 'commerce.mand.leeg',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/concern/entiteit/nieuw': {
    mutatieId: 'concern.entiteit.nieuw',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/concern/nieuw': {
    mutatieId: 'concern.nieuw',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/gemeente/meld': {
    mutatieId: 'gemeente.meld',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/genootschap/richt-op': {
    mutatieId: 'genootschap.richt-op',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/gewoonten/maak': {
    mutatieId: 'gewoonten.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/kosten/grens/zet': {
    mutatieId: 'kosten.grens.zet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/mall/lijst/nieuw': {
    mutatieId: 'mall.lijst.nieuw',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/mediaos/lijst/maak': {
    mutatieId: 'mediaos.lijst.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/member/leren/project-maak': {
    mutatieId: 'member.leren.project-maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/member/pin/uit': {
    mutatieId: 'member.pin.uit',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/architect/maak': {
    mutatieId: 'office.architect.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/atelier/maak': {
    mutatieId: 'office.atelier.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/hardware/maak': {
    mutatieId: 'office.hardware.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/ideeen/maak': {
    mutatieId: 'office.ideeen.maak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/kosten/peil': {
    mutatieId: 'office.kosten.peil',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/office/kosten/vrijgeven': {
    mutatieId: 'office.kosten.vrijgeven',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/onboarding/bedrijf': {
    mutatieId: 'onboarding.bedrijf',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/onboarding/salonpost': {
    mutatieId: 'onboarding.salonpost',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/reis/invoer/lees': {
    mutatieId: 'reis.invoer.lees',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/supplier/activiteit/sluit': {
    mutatieId: 'supplier.activiteit.sluit',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/supplier/pay/treasury/zet': {
    mutatieId: 'supplier.pay.treasury.zet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder enige sleutel: de herhaling kwam terug met `herhaald: true`, ' +
      'wat alleen de idem-poort kan zijn -- die handelt op de zelfdeVerzoek-verklaring hierboven', op: '2026-08-29' }
  },
  'POST /api/overheid/water/meld': {
    mutatieId: 'overheid.water.meld',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder sleutel: de herhaling kwam terug met `herhaald: true` en de ' +
      'bestaande melding; nagelezen in server/kern/overheid/regio.js -- zelfdeMeldingKortGeleden() uit ' +
      'kern/dubbelemelding.js, venster van een minuut op melder + soort + tekst', op: '2026-08-29' }
  },
};

module.exports = { CONTRACTEN };
