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

/* HETZELFDE BEWIJS, ZEVENENDERTIG KEER -- dus EEN keer, met de bestandsnaam als
   enige variabele. Zie ./mutatiecontracten-beschermd.js voor waarom dat meer is
   dan een besparing: een reeks bijna-gelijke zinnen is de vorm waarin een
   verschil onopgemerkt insluipt. */
const leest = (route, mutatieId, bestand) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen, geen van beide liet iets achter in de ' +
      'gemeten collecties',
    op: '2026-08-29'
  },
  nagekeken: 'scripts/schrijfanalyse.js, 2026-08-29: elke aanroep in de handler is binnen ' + bestand +
    ' herleid en geen enkele bevat een schrijfvorm -- de tweede, onafhankelijke lijn die het gat sluit ' +
    'dat de opslagmeter laat (bestand, externe dienst, teller daarbuiten)'
}];

const CONTRACTEN = Object.assign(Object.fromEntries([
  leest('POST /api/aanmelding/contracten', 'aanmelding.contracten', 'server/routes/aanmeldingen.js'),
  leest('POST /api/aanmelding/lijst', 'aanmelding.lijst', 'server/routes/aanmeldingen.js'),
  leest('POST /api/boardroom/betalingen/status', 'boardroom.betalingen.status', 'server/routes/techniek/betalingen.js'),
  leest('POST /api/command/overname', 'command.overname', 'server/routes/command/inrichten.js'),
  leest('POST /api/command/runbooks', 'command.runbooks', 'server/routes/command/herstel.js'),
  leest('POST /api/command/tijdlijn', 'command.tijdlijn', 'server/routes/command/bestuur.js'),
  leest('POST /api/command/zandbak', 'command.zandbak', 'server/routes/command/meten.js'),
  leest('POST /api/contracten/mijn', 'contracten.mijn', 'server/routes/member/handel/winkel.js'),
  leest('POST /api/giftcards/mine', 'giftcards.mine', 'server/routes/member/cadeaukaart.js'),
  leest('POST /api/member/huis/map', 'member.huis.map', 'server/routes/huis.js'),
  leest('POST /api/notifications', 'notifications', 'server/server.js'),
  leest('POST /api/office/atelierweb/lijst', 'office.atelierweb.lijst', 'server/routes/atelierweb.js'),
  leest('POST /api/office/bank/regels', 'office.bank.regels', 'server/routes/bankhart.js'),
  leest('POST /api/office/bank/regels/zzp', 'office.bank.regels.zzp', 'server/routes/bankhart.js'),
  leest('POST /api/office/boardroom/rahul', 'office.boardroom.rahul', 'server/routes/kantoren/regie.js'),
  leest('POST /api/office/merk/lijst', 'office.merk.lijst', 'server/routes/webmerk.js'),
  leest('POST /api/office/onderzoeker', 'office.onderzoeker', 'server/routes/rtgkantoor.js'),
  leest('POST /api/office/partner/regels', 'office.partner.regels', 'server/routes/office/partneraanvragen.js'),
  leest('POST /api/office/payroll/run/lijst', 'office.payroll.run.lijst', 'server/routes/payroll-os-run.js'),
  leest('POST /api/office/rechtsvormwacht', 'office.rechtsvormwacht', 'server/routes/office/ondernemers.js'),
  leest('POST /api/office/reisbureau/uitnodigingen', 'office.reisbureau.uitnodigingen', 'server/routes/kantoren/reisbureau.js'),
  leest('POST /api/office/rtgai', 'office.rtgai', 'server/routes/rtgkantoor.js'),
  leest('POST /api/office/salon/belang', 'office.salon.belang', 'server/routes/kantoren/salon.js'),
  leest('POST /api/office/trust', 'office.trust', 'server/routes/office/partners/kantoorlijsten.js'),
  leest('POST /api/office/uitgifte', 'office.uitgifte', 'server/routes/uitgifte.js'),
  leest('POST /api/office/zelfzorg', 'office.zelfzorg', 'server/routes/kantoren/zelfzorg.js'),
  leest('POST /api/onboarding/status', 'onboarding.status', 'server/routes/onboarding.js'),
  leest('POST /api/onderneming/ontwerp/opdrachten', 'onderneming.ontwerp.opdrachten', 'server/routes/member/onderneming-bestuur.js'),
  leest('POST /api/reis/uitnodiging/mijn', 'reis.uitnodiging.mijn', 'server/routes/reis.js'),
  leest('POST /api/supplier/contracten', 'supplier.contracten', 'server/routes/supplier/contract.js'),
  leest('POST /api/supplier/payroll/runs', 'supplier.payroll.runs', 'server/routes/payroll-os-zaak.js'),
  leest('POST /api/supplier/salon/stats', 'supplier.salon.stats', 'server/routes/supplier/salon/profiel.js'),
  leest('POST /api/supplier/uitgifte', 'supplier.uitgifte', 'server/routes/uitgifte.js'),
  leest('POST /api/supplier/werkmail/adressen', 'supplier.werkmail.adressen', 'server/routes/werkmail.js'),
  leest('POST /api/supplier/werkmail/overzicht', 'supplier.werkmail.overzicht', 'server/routes/werkmail.js'),
  leest('POST /api/verify/status', 'verify.status', 'server/routes/auth/verificatie.js'),
  leest('POST /api/vertaal/talen', 'vertaal.talen', 'server/routes/vertaal.js'),
  leest('POST /api/wallet', 'wallet', 'server/routes/zorgwallet.js'),
]), {
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
});

module.exports = { CONTRACTEN };
