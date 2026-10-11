/* ============================================================================
   MUTATIECONTRACT -- DE VRIJGAVEPOORT EN STRIPE CONNECT (6 oktober 2026).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. De
   routes staan in server/routes/kantoren/vrijgave.js, server/routes/kantoren/
   connect.js en server/opzet/connectwebhook.js; het bewijs in
   test/vrijgave-routes.test.js (echte server) en test/connect-afrekening.test.js
   (nagemaakte Stripe).
   ========================================================================== */
'use strict';

const AF = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-10-06' };
const CONTRACTEN = {};

CONTRACTEN['POST /api/office/vrijgave'] = {
  mutatieId: 'office.vrijgave', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/vrijgave-routes.test.js: een lid krijgt 401/403, de eigenaar het overzicht', op: '2026-10-06' },
  nagekeken: 'met de hand, 2026-10-06: de handler roept alleen overzicht() en schaduwTelling() aan; ' +
    'overzicht leest het standbestand en schrijft niets (de schaduwteller loopt alleen bij stand shadow, in het geheugen)',
  afgetekend: AF
};
CONTRACTEN['POST /api/office/vrijgave/stand'] = {
  mutatieId: 'office.vrijgave.stand', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth + verse passkey bij aanzetten van geld' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'kern/vrijgave/schakelen.js zet(): dezelfde stand nog eens geeft ongewijzigd: true zonder versie, ' +
    'geschiedenis of auditregel; met een oude versie een botsing (test/vrijgave.test.js "gelijktijdig schakelen")', op: '2026-10-06' },
  afgetekend: AF
};
CONTRACTEN['POST /api/office/vrijgave/besluit'] = {
  mutatieId: 'office.vrijgave.besluit', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth + verse passkey bij vastleggen' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'kern/vrijgave/schakelen.js: vastleggen van hetzelfde besluit overschrijft dezelfde sleutel; ' +
    'intrekken van een ingetrokken besluit geeft ongewijzigd: true (test/vrijgave-routes.test.js)', op: '2026-10-06' },
  afgetekend: AF
};
CONTRACTEN['POST /api/office/connect/afrekeningen'] = {
  mutatieId: 'office.connect.afrekeningen', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/vrijgave-routes.test.js: 200 voor de eigenaar, 401/403 voor een lid', op: '2026-10-06' },
  nagekeken: 'met de hand, 2026-10-06: de handler roept alleen lijst() aan; standaard() maakt bij de eerste aanroep ' +
    'het exemplaar, en de opslag maakt de lege bak pas bij een schrijfactie vast (save)',
  afgetekend: AF
};
CONTRACTEN['POST /api/office/connect/afrekening'] = {
  mutatieId: 'office.connect.afrekening', herkomst: 'mens', semantiek: { klasse: 'sleutelVereist' },
  toegang: { klasse: 'CAPABILITY_GATED', bevoegdheid: 'PARTNER_UITBETALING (via vrijgave geld.partnerafrekening en geld.provider.stripe_connect)' },
  stand: 'PROTECTED',
  bewijs: { gemeten: 'test/connect-afrekening.test.js: hetzelfde afrekening-id geeft herhaald: true en geen tweede transfer; ' +
    'hetzelfde id met andere gegevens 409; bij Stripe afgeleide Idempotency-Keys per transfer en payout', op: '2026-10-06' },
  afgetekend: AF
};
CONTRACTEN['POST /api/office/connect/veeg'] = {
  mutatieId: 'office.connect.veeg', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/connect-afrekening.test.js "crash na het versturen" en "noodstop": een tweede veeg maakt ' +
    'geen tweede transfer en geen tweede effect; de reconciliatie corrigeert niets en schrijft alleen bevindingen', op: '2026-10-06' },
  afgetekend: AF
};
CONTRACTEN['POST /api/betaal/webhook/connect'] = {
  mutatieId: 'betaal.webhook.connect', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'SERVICE_TO_SERVICE', geheim: 'STRIPE_CONNECT_WEBHOOK_SECRET, te roteren in het Stripe-dashboard en de omgeving' },
  stand: 'PROTECTED',
  bewijs: { gemeten: 'test/vrijgave-routes.test.js: dezelfde ondertekende melding twee keer geeft een bevinding, niet twee; ' +
    'test/connect-afrekening.test.js: een herhaalde payout.paid boekt het effect een keer', op: '2026-10-06' },
  afgetekend: AF
};

module.exports = { CONTRACTEN };
