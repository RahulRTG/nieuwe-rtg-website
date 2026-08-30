/* ============================================================================
   MUTATIECONTRACTEN -- DE DUBBELTIKKEN DIE ZIJN DICHTGEZET.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels.

   WAT HIER GEBEURD IS, EN IN WELKE VOLGORDE. De kale ronde van de idemproef
   (twee woordelijk gelijke oproepen, geen sleutel, geen header -- de dubbeltik
   van een ongeduldige gebruiker op een trage verbinding) vond honderdzestien
   routes die het werk gewoon opnieuw deden. Van deze vijftien is de handler
   nagelezen, en bij elk stond er een veld in de body dat bepaalt WAT er
   ontstaat: een naam, een titel, een IBAN.

   Toen is er EERST gerepareerd en pas daarna geclassificeerd. De verklaringen
   staan in ./idemsleutels-kaleronde.js, de idem-poort vangt de herhaling nu op,
   en de proef van 30 augustus 2026 mat alle vijftien als `beschermd`. Dat is de
   volgorde die deze stand eist: PROTECTED betekent "een herhaling doet het werk
   niet nog een keer, vastgesteld en niet aangenomen".

   WAT ER ZONDER DIE REPARATIE GEBEURDE, want dat is wat het waard maakt: een
   tweede project, een tweede leerling, een tweede werkruimte, een tweede
   bankpas. Geen van die dingen is een tweede bedoeling; het zijn allemaal
   dezelfde handeling die twee keer aankwam.

   WIE ER NIET IN STAAT. /api/foundation/les/maak is met dezelfde verklaring
   gerepareerd en meet ook als beschermd, maar hij heeft geen waargenomen
   toegangsklasse -- een contract zonder deur bestaat niet. En
   /api/supplier/bezorg/overzicht meet als beschermd zonder dat ik zijn handler
   heb gelezen; die hoort hier dus niet, want dan zou de aftekening hieronder
   niet kloppen.
   ========================================================================== */
'use strict';

/* DE AFTEKENING. Anders dan bij ./mutatiecontracten-effect.js is dit GEEN
   besluit over een bewijsstandaard: van elk van deze vijftien routes is de
   handler regel voor regel gelezen, en dat is wat er staat. Dat het door een
   model is gedaan en niet door een mens, staat er ook -- wie het naleest en zijn
   eigen naam eronder wil zetten, vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 30 augustus 2026; niet door een mens nagelezen',
  op: '2026-08-30'
};

const BEWIJS = {
  gemeten: 'kale ronde zonder sleutel na de reparatie: de tweede oproep werd door de idem-poort ' +
    'opgevangen (herhaald: true) op grond van de verklaring in lib/idemsleutels-kaleronde.js',
  op: '2026-08-30'
};

/* Het veld dat de identiteit draagt staat per regel achter de route -- dat is
   waar een volgende lezer op moet controleren als de handler verandert. */
const dicht = (route, mutatieId, toegang) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'sleutelVereist' },
  toegang,
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  afgetekend: AFGETEKEND
}];

const werkruimte = { klasse: 'OBJECT_SCOPED', objectVeld: 'werkruimte' };
const gezin = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const school = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
/* De bewaker staat op de router (officeAuth, boardroomAuth, auth, supplierAuth);
   de identiteit staat dus al vast als de handler begint. */
const kantoor = { klasse: 'AUTHENTICATED' };

const CONTRACTEN = Object.fromEntries([
  dicht('POST /api/bank/pas/uitgeven', 'bank.pas.uitgeven',
    { klasse: 'AUTHENTICATED' }),                                   // iban + soort + naam
  dicht('POST /api/festival/nieuw', 'festival.nieuw',
    { klasse: 'AUTHENTICATED' }),                                   // de naam van het festival

  dicht('POST /api/bedrijf/klant/zet', 'bedrijf.klant.zet', werkruimte),      // klantId, of de naam
  dicht('POST /api/bedrijf/project/maak', 'bedrijf.project.maak', werkruimte), // naam + werkvorm
  dicht('POST /api/bedrijf/repo/zet', 'bedrijf.repo.zet', werkruimte),        // repoId, of de naam
  dicht('POST /api/bedrijf/taak/maak', 'bedrijf.taak.maak', werkruimte),      // titel + projectId

  dicht('POST /api/foundation/gezin/agenda', 'foundation.gezin.agenda', gezin),   // titel + datum + tijd
  dicht('POST /api/foundation/gezin/droom/maak', 'foundation.gezin.droom.maak', gezin), // de tekst
  dicht('POST /api/foundation/gezin/gezondheid/medicijn', 'foundation.gezin.gezondheid.medicijn', gezin), // naam
  dicht('POST /api/foundation/gezin/klus', 'foundation.gezin.klus', gezin),   // titel + sterren + voor

  dicht('POST /api/foundation/school/bezoeker/aanmeld', 'foundation.school.bezoeker.aanmeld', school), // naam
  dicht('POST /api/foundation/school/leerling/aanmeld', 'foundation.school.leerling.aanmeld', school), // naam
  dicht('POST /api/foundation/school/subsidie/zet', 'foundation.school.subsidie.zet', school),         // naam

  /* De twee publieke: er is nog geen sleutel omdat je er juist een KRIJGT. De
     reden komt uit scripts/lib/publiekeroutes.js, waar een mens hem schreef. */
  dicht('POST /api/bedrijf/lid/aanmeld', 'bedrijf.lid.aanmeld', { klasse: 'PUBLIC',
    waarom: 'aanmelden bij een werkruimte kan zonder sleutel -- het token dat je krijgt werkt pas na ' +
      'toelating (test/bedrijfkern.test.js)' }),
  dicht('POST /api/bedrijf/werkruimte/maak', 'bedrijf.werkruimte.maak', { klasse: 'PUBLIC',
    waarom: 'een organisatie die nog geen werkruimte heeft, heeft ook nog geen sleutel; de maker ' +
      'krijgt het beheer-token' }),

  /* ---- de tweede ronde: het kantoorbord en wat erop lijkt ----

     Schakelaars die een STAND zetten en een auditregel schrijven. Hier was de
     dubbele tik geen dubbel DING maar een dubbele regel in het auditspoor van de
     afdelingen, en dat spoor hoort te zeggen hoe vaak een MENS op de knop drukte.

     LET OP WAT DEZE ROUTES ZIJN: de noodstop van de bank, de leden-bank live
     zetten, een rekening bevriezen, een agent stoppen. Juist bij zulke knoppen is
     "hoe vaak drukte iemand" geen boekhoudkundig detail. */
  dicht('POST /api/office/bank/nood', 'office.bank.nood', kantoor),
  dicht('POST /api/office/bank/herstel', 'office.bank.herstel', kantoor),
  dicht('POST /api/office/bank/leden', 'office.bank.leden', kantoor),
  dicht('POST /api/office/bank/operationeel', 'office.bank.operationeel', kantoor),
  dicht('POST /api/office/bank/instellingen', 'office.bank.instellingen', kantoor),
  dicht('POST /api/office/bank/autoriseer/annuleer', 'office.bank.autoriseer.annuleer', kantoor),
  dicht('POST /api/office/bank/rekening/bevries', 'office.bank.rekening.bevries', kantoor),
  dicht('POST /api/office/bank/mislukking', 'office.bank.mislukking', kantoor),
  dicht('POST /api/command/agent/stop', 'command.agent.stop', kantoor),
  dicht('POST /api/command/agent/hervat', 'command.agent.hervat', kantoor),
  dicht('POST /api/command/agent/rechten', 'command.agent.rechten', kantoor),
  dicht('POST /api/appstore/wis-opslag', 'appstore.wis-opslag', kantoor),
  dicht('POST /api/supplier/mall/sync', 'supplier.mall.sync', kantoor),
  dicht('POST /api/supplier/horeca/folio/nacht', 'supplier.horeca.folio.nacht', kantoor),
  dicht('POST /api/member/lifestyle/gezondheid/dossier', 'member.lifestyle.gezondheid.dossier', kantoor),
  dicht('POST /api/member/rechterhand/maison/log', 'member.rechterhand.maison.log', kantoor)
]);

module.exports = { CONTRACTEN };
