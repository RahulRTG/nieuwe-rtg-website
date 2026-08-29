/* ============================================================================
   MUTATIECONTRACTEN -- DE ROUTES DIE NIETS VERANDEREN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels.

   NOT_APPLICABLE eist bewijs dat er niets verandert, en de opslagmeter alleen is
   daar te zwak voor: hij ziet de collecties in de database, dus niet een bestand,
   een bericht of een teller daarbuiten. "Geen spoor" is uit die ene meter een
   gevolgtrekking uit AFWEZIG bewijs.

   Bij deze zeggen twee methodes die niets van elkaar weten hetzelfde: de kale
   ronde mat twee geslaagde oproepen zonder enig spoor, EN scripts/schrijfanalyse.js
   heeft elke aanroep in de handler binnen zijn eigen bestand herleid en vond geen
   schrijfvorm. Die tweede lijn is precies het gat dat de eerste laat.

   WAAROM HET ER MAAR VEERTIG ZIJN, van 1030 kandidaten: de statische analyse
   volgt geen aanroep naar een andere module, en dat is met opzet. Een resolver
   over 2861 bestanden die er ergens EEN mist, levert een 'nee' die niet klopt --
   en die zou hier als bewijs onder een contract belanden.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
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
