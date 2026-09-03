/* ============================================================================
   MUTATIECONTRACT -- de correctie op een horecarekeningregel.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.
   Een eigen bestand voor één route, omdat de indeling ervan een AFWEGING draagt
   die anders in een lijst zou verdwijnen.

   ================== DE AFWEGING: IS DIT PROTECTED? ==================

   MUTATIECONTRACT.md par. 5 zegt met zoveel woorden dat een 409 op een
   herhaling een TOESTANDSCONTROLE is en geen idempotentie, en houdt
   `/api/pay/verzoek/betaal` daarom bewust buiten `PROTECTED`. Deze route geeft
   op een tweede aanroep ook een 409. Waarom valt zij dan wel binnen?

   Omdat het om twee verschillende dingen gaat, en het verschil zit in WELKE
   oproep de 409 kreeg. Bij `/api/pay/verzoek/betaal` gaf de EERSTE oproep al
   409 ("er is geen schuld meer"): er is dan nooit een eerste handeling geweest
   om te herhalen, dus over de dubbeltik is niets vastgesteld. Hier doet de
   eerste oproep het werk (200, de regel wordt gecorrigeerd) en wordt pas de
   TWEEDE geweigerd -- door een eigen afhandeling in de route, die bovendien de
   bestaande correctie meegeeft zodat de aanroeper weet wat er is gebeurd.

   Dat is precies de tweede tak die `PROTECTED` toestaat: "een duplicaatregel in
   lib/idemsleutels.js OF een eigen afhandeling in de route"
   (kern/mutatiecontract/klassen.js). De stand na twee aanroepen is dezelfde als
   na een, en dat is gemeten en niet aangenomen -- zie het bewijs hieronder.

   WAT DAT NIET BETEKENT: dat de aanroeper op een herhaling hetzelfde ANTWOORD
   krijgt. Dat doet een echte idempotentiesleutel wel en deze route niet. Wie
   hier ooit een sleutel bij bouwt, verandert dus het antwoord en niet de stand.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/supplier/horeca/rekening/regel/corrigeer': {
    mutatieId: 'horeca.rekening.regel.corrigeer',
    herkomst: 'mens',
    /* De stand na twee aanroepen is die na een: de regel draagt een correctie,
       de rekening is een keer gezakt. */
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'scripts/tafelproef.js storing 6 (over HTTP, tegen een wegwerpserver): de eerste ' +
        'oproep gaf 200 en de rekening zakte met het bedrag van de regel; de tweede met dezelfde ' +
        'regelId gaf 409 "Deze regel is al gecorrigeerd" en de rekening zakte NIET nog een keer. ' +
        'test/horeca-correctie.test.js toets 8 meet hetzelfde op de kern: bruto blijft na de ' +
        'tweede poging staan en er is een correctie, geen twee.',
      op: '2026-09-03'
    },
    afgetekend: {
      door: 'Claude (Opus 5), op grond van twee metingen (keten over HTTP en kern) plus de ' +
        'afweging hierboven tegen MUTATIECONTRACT.md par. 5; niet door een mens nagelezen',
      op: '2026-09-03'
    }
  }
};

module.exports = { CONTRACTEN };
