/* ============================================================================
   DE MUTATIECONTRACTEN VAN HET VAKSCHEMA (kern/vakschema.js, RUGDEKKING.md 4.4).

   EERST HET BEWIJS, DAN HET CONTRACT. Er is een dubbeltik-ronde gedraaid over de
   vijf wegen -- elke weg twee keer met hetzelfde lijf, en tellen wat er in
   `db.data.vakschema` bij kwam.

   EN HIJ IS OP DE KERN GEDRAAID EN NIET OVER HTTP, met de reden erbij in plaats
   van stil: deze weg vraagt een zaak met het genre `fysiotherapie` of
   `sportarts` (allebei `status: 'bewijs'`, dus toegelaten door een mens) EN een
   medewerker met een AFGETEKENDE BIG-registratie. Die wereld zet de e2e-opzet
   vandaag niet op. De ronde loopt daarom langs exact dezelfde kernfuncties die
   de routes aanroepen -- de routes zelf doen niets anders dan het lijf doorgeven
   -- en dat is precies zo veel als het waard is. Het alternatief was niets meten
   en dat "gemeten" noemen.

   EN DIE RONDE VOND ER EEN, en het is dezelfde fout als bij de rugdekking en het
   ledger: `voorstel` liet na twee identieke aanroepen TWEE kaarten achter
   (0 -> 2). Hier weegt hij nog een slag anders, want het is de inbox van EEN
   ANDER die je volzet.

   DE OPLOSSING MOCHT HIER GEEN 409 ZIJN, en dat is het interessante van dit
   contract. "Deze stond er al" bestaat alleen als de codenaam bestaat, en deze
   route geeft met opzet hetzelfde antwoord of het lid bestaat of niet -- anders
   is hij een zoekmachine naar leden van RTG. De tweede oproep doet daarom NIETS
   en geeft een BYTE-VOOR-BYTE gelijk antwoord. Dat is dus echte idempotentie en
   geen toestandscontrole: de route weigert niet, hij antwoordt hetzelfde.
   ========================================================================== */
'use strict';

const OP = '2026-09-11';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van een gedraaide dubbeltik-ronde op kern/vakschema; ' +
    'niet door een mens nagelezen',
  op: OP
};

const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
/* `supplierAuth` stelt de ZAAK vast; wie de MENS is en of hij bevoegd is, weegt
   de kern met `persoonseis.magHandeling`. Dat is geen capability uit
   kern/bevoegdheid/lijst.js, dus `CAPABILITY_GATED` zou hier een naam beloven
   die niet bestaat -- zie ./mutatiecontracten-rugdekking.js voor dezelfde
   afweging aan de kantoorkant. */
const ZAAK = { klasse: 'AUTHENTICATED', deur: 'supplierAuth' };

const leest = (route, mutatieId, toegang, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ' (op de kern, zie de kop): twee keer 200 met een ' +
    'byte-voor-byte gelijk antwoord en geen groei in db.data.vakschema. ' + hoe, op: OP },
  nagekeken: 'de handler is herleid en leest via kijk(), dat een ontbrekende collectie niet aanmaakt',
  afgetekend: AFGETEKEND
}];

const toestand = (route, mutatieId, toegang, gemeten) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ' (op de kern): ' + gemeten + ' Een toestandscontrole ' +
    'en geen duplicaatlaag (MUTATIECONTRACT.md par. 5o).', op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/training/voorstellen', 'vakschema.mijn', LID,
    'De voorstellen die voor DIT lid openstaan, op de sleutel uit de sessie.'),
  leest('POST /api/supplier/vakschema/mijn', 'vakschema.mijnVoorstellen', ZAAK,
    'Wat DEZE zaak zelf heeft verstuurd -- met opzet zonder de stand en zonder het lid erbij, ' +
    'want dat is het dossier van het lid en niet het hare.'),

  ['POST /api/supplier/vakschema/voorstel', {
    mutatieId: 'vakschema.voorstel', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: ZAAK,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ' (op de kern): twee identieke aanroepen gaven een ' +
      'byte-voor-byte GELIJK antwoord en lieten EEN kaart achter (0 -> 1 -> 1). In de eerste ronde ' +
      'stond die onderdrukking er niet en waren het er TWEE -- twee identieke kaarten in de inbox ' +
      'van iemand anders. Dit is ECHTE idempotentie en geen toestandscontrole: de tweede oproep ' +
      'weigert niet, hij antwoordt hetzelfde. Dat moest ook wel -- een 409 ("deze stond er al") ' +
      'bestaat alleen als de codenaam bestaat, en deze route geeft met opzet hetzelfde antwoord of ' +
      'het lid bestaat of niet. Een voorstel dat ergens van afwijkt is een ander voorstel en gaat ' +
      'gewoon door; na beslissen mag dezelfde tekst opnieuw, want een herhaling na een half jaar ' +
      'is geen dubbelklik.', op: OP },
    afgetekend: AFGETEKEND
  }],

  toestand('POST /api/training/voorstel/aanvaard', 'vakschema.aanvaard', LID,
    'de tweede oproep kwam terug met 404 ("Dit voorstel staat niet voor u open") en er bleef EEN ' +
    'schema staan. Het voorstel gaat na de eerste keer op `aanvaard` en is dan geen open voorstel ' +
    'meer; een tweede schema met dezelfde inhoud kan daardoor niet ontstaan.'),
  toestand('POST /api/training/voorstel/weiger', 'vakschema.weiger', LID,
    'de tweede oproep kwam terug met 404 en de reden van de eerste bleef ongewijzigd staan -- dus ' +
    'ook geen tweede reden en geen tweede tijdstip. Er wordt niets weggeschreven naar het schema.')
]);

module.exports = { CONTRACTEN };
