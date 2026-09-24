/* ============================================================================
   DE MUTATIECONTRACTEN VAN MAGNAAT VAN NUL (kern/magnaat-leven, V1).

   EERST GEMETEN, DAN VERKLAARD. Een dubbeltik-ronde op de kern: elke route twee
   keer met hetzelfde lijf, en tellen wat er in `magnaatLeven` en in het
   grootboek bij kwam.

   `staat` is echte idempotentie: de eerste aanraking maakt het leven aan, elke
   volgende op hetzelfde moment geeft byte voor byte hetzelfde beeld. De klok
   rekent alleen bij voor tijd die ECHT verstreek.

   `actie` is met opzet geen idempotente route: het is een zet in een spel.
   Twee keer netwerken is twee gesprekken, twee keer twee uur werken is vier uur
   werk. Wat maar een keer mag -- een project kiezen, je inschrijven, een
   factuur, een lening, een extra dienst per dag -- weigert de TOESTAND met een
   reden. En het geld kan niet dubbel: elke overdracht draagt een
   grootboeksleutel, en een sleutel die al geboekt is beweegt de kas niet. */
'use strict';

const OP = '2026-09-24';
const AFGETEKEND = {
  door: 'Claude (Opus 5.5), op grond van een gedraaide dubbeltik-ronde op kern/magnaat-leven; ' +
    'niet door een mens nagelezen',
  op: OP
};
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };

const CONTRACTEN = Object.fromEntries([
  ['POST /api/member/magnaat/leven/staat', {
    mutatieId: 'magnaat.leven.staat', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': twee keer staat op hetzelfde moment gaf byte voor ' +
      'byte hetzelfde beeld; het leven ontstaat bij de eerste aanraking en een tweede maakt er geen ' +
      'tweede. Echte idempotentie, geen toestandscontrole.', op: OP },
    afgetekend: AFGETEKEND
  }],
  ['POST /api/member/magnaat/leven/actie', {
    mutatieId: 'magnaat.leven.actie', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een handeling in Van Nul is een zet in een spel: nog een keer netwerken of werken is een ' +
      'tweede zet en hoort zo te tellen. Eenmalige zetten weigert de toestand met een reden.',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': netwerk twee keer gaf 1 -> 2 contacten (bedoeld); ' +
      'project twee keer gaf de tweede keer een weigering en een ongewijzigde staat; overwerk twee ' +
      'keer op dezelfde dag gaf de tweede keer een weigering en de kas bleef op 10400 (4400 -> 10400 ' +
      '-> 10400), gelijk aan het grootboek.', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
