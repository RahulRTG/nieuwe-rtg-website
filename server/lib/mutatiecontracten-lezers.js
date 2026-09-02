/* ============================================================================
   MUTATIECONTRACTEN -- DE DERTIEN LEZERS UIT DE SAMENVOEGING VAN 1 SEPTEMBER 2026.

   Deel van ./mutatiecontracten-samenvoeging.js; zie de kop daar voor waarom deze
   achttien contracten bestaan en wie ze heeft afgetekend.

   Waarom deze dertien apart staan: ze delen ALLE DERTIEN dezelfde grond en
   dezelfde vorm -- twee meters die zeggen dat de route niets doet, en een
   handler die dat bevestigt. Ze zijn daarmee een LIJST, terwijl de vijf in het
   andere bestand elk een eigen uitspraak over gedrag dragen. De knip loopt
   precies daar, en niet op een regelnummer: regel 13 van scripts/keuring.js
   meldde het bestand vlak onder de tienkilobytegrens, en dit is de naad die er
   al lag.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude, in opdracht van de eigenaar (1 september 2026); per route de handler gelezen naast ' +
    'de kale ronde -- de eigenaar heeft de uitkomst niet zelf per route nagelezen',
  op: '2026-09-01'
};

const OP = '2026-09-01';

/* A. DERTIEN DIE ALLEEN LEZEN. Twee onafhankelijke meters: geen spoor in de
   opslag en de effectmeter op `geen` (geen schrijfpoging, geen mail, geen sms).
   Wat geen van beide ziet -- een bestand of een externe aanroep -- is per handler
   nagelezen; de vindplaats staat erbij zodat wie het overdoet weet waar te kijken. */
const leest = (route, mutatieId, toegang, bestand, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: {
    gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen zonder spoor in de gemeten collecties, ' +
      'en de effectmeter telde op allebei `geen`',
    op: OP
  },
  nagekeken: 'handler gelezen in ' + bestand + ' op ' + OP + ': ' + wat +
    ' -- geen bestand, geen externe aanroep, geen teller buiten de gemeten collecties',
  afgetekend: AFGETEKEND
}];

const office = { klasse: 'AUTHENTICATED' };
const auth = { klasse: 'AUTHENTICATED' };
const manager = { klasse: 'AUTHENTICATED' };

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/command/bezitsbewijs', 'command.bezitsbewijs', office, 'server/routes/command/schaduwmeters.js',
    'geeft bezitsbewijs.stand() terug of de melding dat de laag niet draait'),
  leest('POST /api/experience/bootstrap', 'experience.bootstrap', auth, 'server/kern/experience/index.js',
    'leest resume en contexten en bouwt een projectie; de enige schrijver in die module is resumeZet en die hangt aan /resume'),
  leest('POST /api/experience/evidence', 'experience.evidence', auth, 'server/kern/experience/index.js',
    'opslag.bewijsVoor(key, limit) is een lezer'),
  leest('POST /api/lab2/capsule', 'lab2.capsule', office, 'server/kern/livinglab/capsule.js',
    'zoekt de studie op en geeft het bevroren dossier terug'),
  leest('POST /api/lab2/metingen', 'lab2.metingen', office, 'server/kern/livinglab/instrument.js',
    'filtert en pagineert d.metingen'),
  leest('POST /api/office/rtfwallet', 'office.rtfwallet', office, 'server/routes/office/instellingen.js',
    'kern.rtfWallet.stand(); maken zit op een eigen boardroomroute /maak'),
  leest('POST /api/reis/gezelschap/kring', 'reis.gezelschap.kring', auth, 'server/kern/reisgezelschap.js',
    'mijnKring filtert leden() op de sleutel van de lezer'),
  leest('POST /api/rtfos/gift/plan/lijst', 'rtfos.gift.plan.lijst', office, 'server/kern/rtfos/gift-periodiek.js',
    'lijst() geeft de eerste 500 plannen als beeld terug'),
  leest('POST /api/rtfos/gift/stand/kantoor', 'rtfos.gift.stand.kantoor', office, 'server/kern/rtfos/gift.js',
    'stand() leest de giftstand; zetten is /stand/zet hieronder'),
  leest('POST /api/rtfos/winkel/artikelen', 'rtfos.winkel.artikelen', office, 'server/kern/rtfos/winkel.js',
    'etalage() filtert en beeldt de artikelen af'),
  leest('POST /api/rtfos/winkel/bestellingen', 'rtfos.winkel.bestellingen', office, 'server/kern/rtfos/winkel.js',
    'bestellingen() geeft de laatste 200 terug; de stand zet een mens via /winkel/stand'),
  leest('POST /api/supplier/horeca/werklijst', 'supplier.horeca.werklijst', auth, 'server/routes/supplier/horeca/werklijst.js',
    'werk.werklijst en over.lijst lezen de horecastand en merken wat van de lezer is'),
  leest('POST /api/supplier/pay/rekening/stand', 'supplier.pay.rekening.stand', manager, 'server/routes/pay-zaak.js',
    'pay.zaakRekening(code) gelezen en tot de laatste vier cijfers teruggebracht'),
  leest('POST /api/toestemming/relaties', 'toestemming.relaties', auth, 'server/kern/consent-relaties.js',
    'relatiesVan groepeert de toestemmingen van de lezer per partij'),
]);

module.exports = { CONTRACTEN };
