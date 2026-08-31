/* ============================================================================
   MUTATIECONTRACTEN -- DE TWEEDE RONDE VAN DE KALE PROEF.

   Deel van server/lib/mutatiecontracten.js; zie ./mutatiecontracten-kaleronde.js
   voor de eerste vijftien en voor de volgorde die deze stand eist: eerst de
   verklaring, dan opnieuw meten, en pas daarna het contract.

   Deze negenendertig komen uit dezelfde kale ronde. Ze vallen in twee soorten,
   en het onderscheid zit in wat een tweede identieke oproep zou DOEN:

     AANMAAK       de body draagt een titel, een naam of een bedrag, en zonder
                   dedupliceren ontstaat er een tweede ding -- een tweede
                   ontwerp, een tweede uitnodiging, een tweede cadeaukaart.
     OVERSCHRIJVING  de tweede oproep zet dezelfde waarden. Het ding blijft een,
                   maar er komt wel een tweede regel in het auditspoor -- en dat
                   spoor hoort te zeggen hoe vaak een MENS op de knop drukte, niet
                   hoe vaak het verzoek aankwam.

   De verklaringen staan in ./idemsleutels-kaleronde.js, en de proef van 30
   augustus 2026 mat ze alle negenendertig als `beschermd`. Wat er per route in de
   body de identiteit draagt, staat achter elke regel -- dat is waar een volgende
   lezer op moet controleren als de handler verandert.

   DE ANDERE HELFT VAN DIE RONDE STAAT ER NIET IN. Drieendertig routes kregen met
   opzet GEEN duplicaatregel: een controleronde, een inzage die een journaalregel
   schrijft, een alarmknop. Die staan in ./idemsleutels-kaleronde-b.js met per
   stuk de reden, en hun contract hoort INTENTIONALLY_NON_IDEMPOTENT te zijn --
   zie ./mutatiecontracten-tweedehandeling.js.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 30 augustus 2026; niet door een mens nagelezen',
  op: '2026-08-30'
};

const BEWIJS = {
  gemeten: 'kale ronde zonder sleutel na de reparatie: de tweede oproep werd door de idem-poort ' +
    'opgevangen (herhaald: true) op grond van de verklaring in lib/idemsleutels-kaleronde.js',
  op: '2026-08-30'
};

const auth = { klasse: 'AUTHENTICATED' };
const gezin = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const school = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
/* huisAuth (server/routes/werkplek.js) sleutelt op `bedrijf` uit het lichaam:
   welk huis, en mag deze sessie daarin. */
const huis = { klasse: 'OBJECT_SCOPED', objectVeld: 'bedrijf' };

const dicht = (route, mutatieId, toegang) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'sleutelVereist' },
  toegang,
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  dicht('POST /api/foundation/gezin/oppasinfo', 'foundation.gezin.oppasinfo', gezin), // noodcontacten + gezinsinfo
  dicht('POST /api/foundation/school/calamiteit', 'foundation.school.calamiteit', school), // zet of heft het alarm
  dicht('POST /api/gedachten/zet', 'gedachten.zet', auth),                    // de gedachte zelf
  dicht('POST /api/metier/kaart', 'metier.kaart', auth),                      // de kaart
  dicht('POST /api/office/atelierweb/bewaar', 'office.atelierweb.bewaar', auth), // het ontwerp
  dicht('POST /api/office/boardroom/rahul/zet', 'office.boardroom.rahul.zet', auth), // karakter + verhaal
  dicht('POST /api/office/hardware/serie', 'office.hardware.serie', auth),    // de collectie
  dicht('POST /api/office/merk/sjabloon', 'office.merk.sjabloon', auth),      // code + ontwerp
  dicht('POST /api/office/rendezvous/tafel/maak', 'office.rendezvous.tafel.maak', auth), // genodigden + tijd
  dicht('POST /api/onboarding/paspoort', 'onboarding.paspoort', auth),        // het paspoort
  dicht('POST /api/pay/verzoek', 'pay.verzoek', auth),                        // aan + totaalCenten
  dicht('POST /api/rtgone/frictie', 'rtgone.frictie', auth),                  // de frictie
  dicht('POST /api/salon/bio', 'salon.bio', auth),                            // de bio
  dicht('POST /api/site/bewaar', 'site.bewaar', auth),                        // het ontwerp
  dicht('POST /api/supplier/aanwezig/leeg', 'supplier.aanwezig.leeg', auth),  // zet drie tellers op nul
  dicht('POST /api/supplier/betaalverzoek', 'supplier.betaalverzoek', auth),  // codename + bedrag
  dicht('POST /api/supplier/bezorg/terug', 'supplier.bezorg.terug', auth),    // verwijdert de eigen rit
  dicht('POST /api/supplier/gebouwpand/bhv', 'supplier.gebouwpand.bhv', auth), // dag + opkomst
  dicht('POST /api/supplier/gebouwplus/lead', 'supplier.gebouwplus.lead', auth), // naam + wens
  dicht('POST /api/supplier/giftcard/sell', 'supplier.giftcard.sell', auth),  // bedrag
  dicht('POST /api/supplier/horeca/rahul/grens', 'supplier.horeca.rahul.grens', auth), // de grens in centen
  dicht('POST /api/supplier/horeca/venue/concept', 'supplier.horeca.venue.concept', auth), // de posities
  dicht('POST /api/supplier/horeca/wijk/zet', 'supplier.horeca.wijk.zet', auth), // wijkId + tafels
  dicht('POST /api/supplier/salon/bio', 'supplier.salon.bio', auth),          // de bio
  dicht('POST /api/supplier/samenwerking/oproep', 'supplier.samenwerking.oproep', auth), // de oproep
  dicht('POST /api/supplier/site/bewaar', 'supplier.site.bewaar', auth),      // het ontwerp
  dicht('POST /api/supplier/staff/invite', 'supplier.staff.invite', auth),    // naam + rol + functie
  dicht('POST /api/techniek/fouten/wis', 'techniek.fouten.wis', auth),        // wist de storingslijst
  dicht('POST /api/toestellen/koppel', 'toestellen.koppel', auth),            // het toestel
  dicht('POST /api/werkplek/bureau/architect/maak', 'werkplek.bureau.architect.maak', huis), // de titel van het ontwerp
  dicht('POST /api/werkplek/bureau/architect/project', 'werkplek.bureau.architect.project', huis), // de titel van de collectie
  dicht('POST /api/werkplek/bureau/atelier/maak', 'werkplek.bureau.atelier.maak', huis), // de titel van het ontwerp
  dicht('POST /api/werkplek/bureau/atelier/collectie', 'werkplek.bureau.atelier.collectie', huis), // de titel van de collectie
  dicht('POST /api/werkplek/bureau/hardware/maak', 'werkplek.bureau.hardware.maak', huis), // de titel van het ontwerp
  dicht('POST /api/werkplek/bureau/hardware/serie', 'werkplek.bureau.hardware.serie', huis), // de titel van de serie
  dicht('POST /api/werkplek/bureau/ideeen/maak', 'werkplek.bureau.ideeen.maak', huis), // het idee
  dicht('POST /api/werkplek/bureau/redactie/artikel/maak', 'werkplek.bureau.redactie.artikel.maak', huis), // de titel van het artikel
  dicht('POST /api/werkplek/bureau/studio/maak', 'werkplek.bureau.studio.maak', huis), // de titel van het ontwerp
  dicht('POST /api/werkplek/bureau/studio/collectie', 'werkplek.bureau.studio.collectie', huis), // de titel van de collectie
]);

module.exports = { CONTRACTEN };
