/* ============================================================================
   MUTATIECONTRACTEN -- DE LAATSTE TWAALF VAN DE KALE RONDE.

   Deel van ./mutatiecontracten.js. ./mutatiecontracten-kaleronde.js draagt wat er
   uit die ronde beschermd werd; dit bestand draagt de rest van de laatste twaalf,
   in twee standen tegelijk -- en dat is met opzet zo.

   DRIE OVERSCHRIJVINGEN werden na hun duplicaatregel gemeten als `beschermd`:
   een bewaartermijn zetten, en een verse sudoku die het lopende potje overschrijft.

   NEGEN KREGEN MET OPZET GEEN REGEL, en die staan hier als
   INTENTIONALLY_NON_IDEMPOTENT. Die stand eist een REDEN en een METING -- "het
   hoort zo" en "het gebeurt ook zo" zijn twee beweringen, en allebei moeten ze
   waar zijn. De meting is de kale ronde (alle negen: de herhaling deed het werk
   opnieuw); de reden staat in ./idemsleutels-kaleronde-b.js.

   DE REDEN WORDT DAAR OPGEHAALD EN NIET OVERGETYPT. Zij stuurt daar de idem-poort;
   hier verantwoordt zij een stand. Twee kopieen van een reden lopen uiteen, en dan
   staat er in het register iets anders dan wat de poort werkelijk doet. Ontbreekt
   de reden, dan GOOIT dit bestand -- een contract met een lege waarom is precies
   het vinkje waar deze stand voor waarschuwt.

   WAT DEZE NEGEN GEMEEN HEBBEN, en waarom dedupliceren hier schade zou doen: een
   imap-sleutel die elke keer vers is (de tweede opslikken laat een sleutel
   verdwijnen die het lid net kreeg), een export die een reden vastlegt (twee keer
   exporteren is twee keer gegevens meenemen), een bankknop die een SLAG verder
   gaat, en een alarm dat twee keer hoort af te gaan.
   ========================================================================== */
'use strict';

/* DE SAMENGEVOEGDE LIJST EN NIET EEN BESTAND, en dat wees deze controle zelf aan
   bij de eerste run: /api/command/sonde/draai staat al sinds langer in het
   hoofdbestand, niet in de kale ronde. Een reden ophalen uit het bestand waar je
   HOOPT dat hij staat, is een tweede aanname. */
const { SLEUTELS } = require('./idemsleutels');

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 30 augustus 2026; niet door een mens nagelezen',
  op: '2026-08-30'
};

const auth = { klasse: 'AUTHENTICATED' };
const gezin = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };

/* Met opzet niet-idempotent: de reden komt uit de sleutellijst. */
const open = (route, mutatieId, toegang) => {
  const v = SLEUTELS[route];
  if (!v || !v.waarom) {
    throw new Error('mutatiecontracten-kaleronde-c: ' + route + ' heeft geen `waarom` in de ' +
      'sleutellijst. INTENTIONALLY_NON_IDEMPOTENT zonder reden is een vinkje.');
  }
  return [route, {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: v.waarom,
    bewijs: {
      gemeten: 'kale ronde zonder sleutel: de herhaling deed het werk opnieuw -- het gedrag is ook ' +
        'werkelijk zoals de reden zegt',
      op: '2026-08-30'
    },
    afgetekend: AFGETEKEND
  }];
};

/* Beschermd na de reparatie; de verklaring staat in ./idemsleutels-kaleronde.js. */
const dicht = (route, mutatieId, toegang) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'sleutelVereist' },
  toegang,
  stand: 'PROTECTED',
  bewijs: {
    gemeten: 'kale ronde zonder sleutel na de reparatie: de tweede oproep werd door de idem-poort ' +
      'opgevangen op grond van de verklaring in lib/idemsleutels-kaleronde.js',
    op: '2026-08-30'
  },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  dicht('POST /api/member/rtmail/bewaartermijn', 'member.rtmail.bewaartermijn', auth),
  dicht('POST /api/supplier/rtmail/bewaartermijn', 'supplier.rtmail.bewaartermijn', auth),
  dicht('POST /api/member/spel/sudoku-nieuw', 'member.spel.sudoku-nieuw', auth),

  open('POST /api/member/rtmail/export', 'member.rtmail.export', auth),
  open('POST /api/member/rtmail/imap/sleutel', 'member.rtmail.imap.sleutel', auth),
  open('POST /api/supplier/rtmail/imap/sleutel', 'supplier.rtmail.imap.sleutel', auth),
  open('POST /api/member/spel/team-nieuw', 'member.spel.team-nieuw', auth),
  open('POST /api/command/sonde/draai', 'command.sonde.draai', auth),
  open('POST /api/foundation/gezin/bericht', 'foundation.gezin.bericht', gezin),
  open('POST /api/office/bank/draai', 'office.bank.draai', auth),
  open('POST /api/overheid/rijbewijs/verleng', 'overheid.rijbewijs.verleng', auth),
  open('POST /api/supplier/horeca/rahul/doe', 'supplier.horeca.rahul.doe', auth)
]);

module.exports = CONTRACTEN;
