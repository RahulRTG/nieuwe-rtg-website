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
  /* ------------------------------------------------------------------------
     ACHTENDERTIG LEESROUTES, MET TWEE ONAFHANKELIJKE LIJNEN ERONDER.

     NOT_APPLICABLE eist bewijs dat er niets verandert, en de opslagmeter alleen
     is daar te zwak voor: hij ziet de collecties in de database, en dus niet een
     bestand, een bericht of een teller daarbuiten. "Geen spoor" is uit die ene
     meter een gevolgtrekking uit AFWEZIG bewijs.

     Bij deze achtendertig zeggen twee methodes die niets van elkaar weten
     hetzelfde: de kale ronde mat twee geslaagde oproepen zonder enig spoor, EN
     scripts/schrijfanalyse.js heeft elke aanroep in de handler binnen zijn eigen
     bestand herleid en vond geen enkele schrijfvorm. Die tweede lijn is precies
     het gat dat de eerste laat.

     WAAROM HET ER MAAR ACHTENDERTIG ZIJN, van 1030 kandidaten: de statische
     analyse volgt geen aanroep naar een andere module, en dat is met opzet. Een
     resolver over 2861 bestanden die er ergens EEN mist, levert een 'nee' die
     niet klopt -- en die zou hier als bewijs onder een contract belanden. De
     overige 992 wachten dus op een mens of op een betere analyse, en dat is
     eerlijker dan ze nu binnenhalen.
     ---------------------------------------------------------------------- */
  'POST /api/aanmelding/contracten': {
    mutatieId: 'aanmelding.contracten',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/aanmeldingen.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/aanmelding/lijst': {
    mutatieId: 'aanmelding.lijst',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/aanmeldingen.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/boardroom/betalingen/status': {
    mutatieId: 'boardroom.betalingen.status',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/techniek/betalingen.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/command/overname': {
    mutatieId: 'command.overname',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/command/inrichten.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/command/runbooks': {
    mutatieId: 'command.runbooks',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/command/herstel.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/command/tijdlijn': {
    mutatieId: 'command.tijdlijn',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/command/bestuur.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/command/zandbak': {
    mutatieId: 'command.zandbak',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/command/meten.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/contracten/mijn': {
    mutatieId: 'contracten.mijn',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/member/handel/winkel.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/giftcards/mine': {
    mutatieId: 'giftcards.mine',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/member/cadeaukaart.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/member/huis/map': {
    mutatieId: 'member.huis.map',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/huis.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/notifications': {
    mutatieId: 'notifications',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/server.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/atelierweb/lijst': {
    mutatieId: 'office.atelierweb.lijst',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/atelierweb.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/bank/regels': {
    mutatieId: 'office.bank.regels',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/bankhart.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/bank/regels/zzp': {
    mutatieId: 'office.bank.regels.zzp',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/bankhart.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/boardroom/rahul': {
    mutatieId: 'office.boardroom.rahul',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/kantoren/regie.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/merk/lijst': {
    mutatieId: 'office.merk.lijst',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/webmerk.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/onderzoeker': {
    mutatieId: 'office.onderzoeker',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/rtgkantoor.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/partner/regels': {
    mutatieId: 'office.partner.regels',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/office/partneraanvragen.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/payroll/run/lijst': {
    mutatieId: 'office.payroll.run.lijst',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/payroll-os-run.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/rechtsvormwacht': {
    mutatieId: 'office.rechtsvormwacht',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/office/ondernemers.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/reisbureau/uitnodigingen': {
    mutatieId: 'office.reisbureau.uitnodigingen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/kantoren/reisbureau.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/rtgai': {
    mutatieId: 'office.rtgai',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/rtgkantoor.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/salon/belang': {
    mutatieId: 'office.salon.belang',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/kantoren/salon.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/trust': {
    mutatieId: 'office.trust',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/office/partners/kantoorlijsten.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/uitgifte': {
    mutatieId: 'office.uitgifte',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/uitgifte.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/office/zelfzorg': {
    mutatieId: 'office.zelfzorg',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/kantoren/zelfzorg.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/onboarding/status': {
    mutatieId: 'onboarding.status',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/onboarding.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/onderneming/ontwerp/opdrachten': {
    mutatieId: 'onderneming.ontwerp.opdrachten',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/member/onderneming-bestuur.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/reis/uitnodiging/mijn': {
    mutatieId: 'reis.uitnodiging.mijn',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/reis.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/contracten': {
    mutatieId: 'supplier.contracten',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/supplier/contract.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/payroll/runs': {
    mutatieId: 'supplier.payroll.runs',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/payroll-os-zaak.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/salon/stats': {
    mutatieId: 'supplier.salon.stats',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/supplier/salon/profiel.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/uitgifte': {
    mutatieId: 'supplier.uitgifte',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/uitgifte.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/werkmail/adressen': {
    mutatieId: 'supplier.werkmail.adressen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/werkmail.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/supplier/werkmail/overzicht': {
    mutatieId: 'supplier.werkmail.overzicht',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/werkmail.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/verify/status': {
    mutatieId: 'verify.status',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/auth/verificatie.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/vertaal/talen': {
    mutatieId: 'vertaal.talen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/vertaal.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  'POST /api/wallet': {
    mutatieId: 'wallet',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets ' +
      'achter in de gemeten collecties', op: '2026-08-29' },
    nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen server/routes/zorgwallet.js ' +
      'herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat ' +
      'sluit dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
  },
  /* ------------------------------------------------------------------------
     DRIE MET DE HAND, EN ELK OM EEN EIGEN REDEN.

     Deze drie kwamen als 'beschermd' uit de kale ronde en zijn NIET als zodanig
     overgenomen -- ze zijn nagelezen, en twee ervan bleken iets anders.
     ---------------------------------------------------------------------- */

  /* Deze route dedupliceert ZELF, en met een vierde mechanisme dat geen van de
     drie andere is: kern/dubbelemelding.js legt een venster van een minuut op de
     INHOUD (dezelfde melder, dezelfde soort, dezelfde tekst) en geeft dan de
     bestaande melding terug met `herhaald: true`. Dat is waarom deze route in de
     meting 'gemerkt' was zonder verklaring in idemsleutels.js -- daar leek een
     laag iets te doen dat niemand had opgeschreven, en het stond gewoon in de
     handler. Een idem-sleutel zou hier trouwens niet volstaan: twee losse tikken
     op dezelfde knop dragen twee verse sleutels. */
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

  /* Kwam binnen als grond `opslag`: bij de eerste kale oproep bewoog er iets en
     bij de tweede niet. Nagelezen is dat geen deduplicatie maar een REM: wat
     bewoog was `wacht`, en de handler roept metier.zoek() aan -- een zoekfunctie
     die filtert en teruggeeft. Was dit als PROTECTED overgenomen, dan stond er
     nu een zoekroute met de verkeerde semantiek en bewijs eronder. */
  'POST /api/metier/zoek': {
    mutatieId: 'metier.zoek',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde: het enige verschil zat in `wacht` (de emmer van een rem) en niet in ' +
      'een collectie van deze route', op: '2026-08-29' },
    nagekeken: 'met de hand, 2026-08-29: server/routes/member/metier.js regel 55 geeft metier.zoek() ' +
      'terug, en server/kern/metier/zoek.js filtert profielen en bouwt een antwoord -- geen save(), ' +
      'geen toewijzing'
  },

  /* Zelfde vorm, andere collectie: hier bewoog `kosten`, de kostenmeter die bij
     elk verzoek meetelt (KOSTEN.md). De handler zelf leest de apparatenlijst en
     telt er drie dingen in. */
  'POST /api/bedrijf/apparaten': {
    mutatieId: 'bedrijf.apparaten',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'kale ronde: het enige verschil zat in `kosten` (de kostenmeter, die bij elk ' +
      'verzoek meetelt) en niet in een collectie van deze route', op: '2026-08-29' },
    nagekeken: 'met de hand, 2026-08-29: server/bedrijf/it.js regel 77 leest Object.values(A(g.w)), ' +
      'filtert en telt -- geen save(), geen toewijzing'
  },

};

module.exports = { CONTRACTEN };
