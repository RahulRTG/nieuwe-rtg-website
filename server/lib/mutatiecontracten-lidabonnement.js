/* ============================================================================
   MUTATIECONTRACT -- een lid en zijn eigen lidmaatschap (drie routes).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand omdat deze drie samen EEN weg zijn: lezen wat er loopt, lezen
   wat opzeggen gaat doen, en opzeggen. Twee lezen en een schrijft, en dat
   verschil is hier juist het onderwerp.

   ================== DE AFWEGING BIJ DE TWEE LEZERS ==================

   MUTATIECONTRACT.md eist voor NOT_APPLICABLE niet alleen een gemeten ronde maar
   ook een TWEEDE, onafhankelijke afdekking van wat die meter niet ziet -- een
   bestand, een externe dienst, een teller. Dat is hier geen formaliteit geweest:
   het indelen van `/opzegvoorbeeld` bracht een echt defect aan het licht.

   De einddatum van het voorbeeld kwam eerst uit een PROEF: een `zegOp` op een
   wegwerpkopie van het contract. Geen rij veranderde, dus de opslagmeter zag
   niets. Maar `zet()` in kern/commercie/contract.js roept `save()` aan -- dus een
   route die alleen VERTELT wat opzeggen gaat doen, schreef de hele database naar
   schijf, met elke andere mutatie die op dat moment nog in het geheugen stond.

   Dat is precies het gat waar die tweede afdekking voor bestaat, en het is niet
   door een toets gevonden maar door deze indeling. De reparatie zit aan de
   oorzaak: `contracten.opzegEinde()` is nu een eigen functie die de datum
   uitrekent zonder hem te zetten, en `zegOp` gebruikt dezelfde. Een kopie van de
   som bij de vrager zou de andere fout zijn (LAT regel 4): dan leest het lid
   vooraf een andere datum dan hij krijgt zodra iemand een van de twee aanpast.

   De afdekking is daarom hier niet alleen een mens die de handler las, maar een
   MEETBARE: test/lidabonnement.test.js toets 10 telt de `save()`-aanroepen en
   eist dat het voorbeeld er nul doet EN dat het echte opzeggen er wel een doet --
   want anders bewijst die toets niets.

   ================== DE AFWEGING BIJ DE SCHRIJVER ==================

   `/opzeggen` is PROTECTED en niet INTENTIONALLY_NON_IDEMPOTENT, en de grond is
   dezelfde als bij ./mutatiecontracten-reisnazorg.js: het gaat erom WELKE oproep
   wat krijgt. De eerste doet het werk; de tweede vindt een contract dat al
   OPZEGGEND is en geeft dezelfde einddatum terug.

   Let op het verschil met die reisroutes: daar krijgt de tweede oproep een 409.
   Hier met opzet NIET -- hij krijgt 200 met `alOpgezegd: true`. Twee tikken op een
   telefoon zijn geen twee opzeggingen, en een foutmelding op de tweede laat een
   lid denken dat de eerste niet is aangekomen. Dat maakt het geen zwakkere
   idempotentie: de STAND na twee oproepen is exact die na een, inclusief de
   einddatum en het aantal openstaande termijnen.

   ================== HOE HET GEMETEN IS ==================

   Een vers lid over HTTP tegen een wegwerpserver: registreren, een RTG-aanvraag,
   het kantoor keurt goed (de enige weg waarlangs een contract ontstaat), en daarna
   elke route twee keer. Na elke oproep is de stand van het lid opgehaald: stand,
   maandbedrag, openstaande termijnen en de einddatum. Uitslagen hieronder
   letterlijk overgenomen.

   EEN UITKOMST DIE HIER HOORT TE STAAN, want hij verbaast: na opzeggen op dag 1
   vallen er NUL termijnen weg en blijven er 11 staan. Dat is geen fout maar de
   minimumtermijn -- `opzegEinde` neemt nooit een datum voor het einde van de
   twaalf maanden. Het lid leest dat ook zo (`nogTeBetalen: 11`), en dat moet, want
   een opzegknop die de resterende verplichting verzwijgt is zelf een dark pattern.
   ========================================================================== */
'use strict';

const GEMETEN_OP = '2026-09-11';
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gemeten ronde hieronder plus de afweging in de kop ' +
    'tegen MUTATIECONTRACT.md; niet door een mens nagelezen',
  op: GEMETEN_OP
};
const lid = { klasse: 'AUTHENTICATED' };

const CONTRACTEN = {
  /* Het lid leest zijn eigen lidmaatschap. Het accountId komt uit het
     geverifieerde token en er wordt niets uit het lijf gelezen -- vandaar
     AUTHENTICATED en niet OBJECT_SCOPED: er IS geen object in het verzoek. */
  'POST /api/mijn/abonnement': {
    mutatieId: 'lidabonnement.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: lid,
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: '1e: 200 -> ACTIEF | 65 | 11 termijnen te gaan. ' +
        '2e: 200 -> ACTIEF | 65 | 11. Geen spoor in de opslag.',
      op: GEMETEN_OP
    },
    nagekeken: 'handler gelezen in server/routes/aanmeldingen.js en de kern in ' +
      'server/kern/aanmeldingen/lidabonnement.js op ' + GEMETEN_OP + ': hij zoekt de aanmelding ' +
      'bij het accountId, leest het contract en de termijnen en stelt een beeld samen. Die module ' +
      'bevat nul keer het woord `save` (machinaal na te gaan met grep) -- geen bestand, geen ' +
      'externe aanroep, geen teller buiten de gemeten collecties.',
    afgetekend: AFGETEKEND
  },

  /* Wat opzeggen gaat doen, zonder dat het gebeurt. De route die het defect in
     de kop opleverde. */
  'POST /api/mijn/abonnement/opzegvoorbeeld': {
    mutatieId: 'lidabonnement.opzegvoorbeeld',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: lid,
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: '1e: 200 -> eindigtOp 2027-09-11 | 0 vervallen | 11 nog te betalen. ' +
        '2e: 200 -> identiek. En de stand van het lid daarna: nog steeds ACTIEF met 11 ' +
        'termijnen te gaan -- het voorbeeld heeft niets opgezegd.',
      op: GEMETEN_OP
    },
    nagekeken: 'handler gelezen in server/kern/aanmeldingen/lidabonnement-opzeg.js op ' +
      GEMETEN_OP + ': hij vraagt `contracten.opzegEinde()` om de datum en zet niets. Daar ' +
      'bovenop een MEETBARE afdekking voor wat de opslagmeter niet ziet: ' +
      'test/lidabonnement.test.js toets 10 telt de save()-aanroepen en eist nul voor het ' +
      'voorbeeld en minstens een voor het echte opzeggen. Die toets bestaat omdat het hier ' +
      'eerst WEL een save deed (zie de kop) -- geen bestand, geen externe aanroep.',
    afgetekend: AFGETEKEND
  },

  /* Opzeggen. De enige van de drie die iets verandert. */
  'POST /api/mijn/abonnement/opzeggen': {
    mutatieId: 'lidabonnement.opzeggen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: lid,
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 {alOpgezegd:false, eindigtOp 2027-09-11, vervallen 0} -> OPZEGGEND | ' +
        'eindigtOp 2027-09-11 | 11 te gaan. ' +
        '2e: 200 {alOpgezegd:true, eindigtOp 2027-09-11} -> OPZEGGEND | eindigtOp 2027-09-11 | ' +
        '11 te gaan. Dezelfde einddatum, dezelfde termijnen: de tweede oproep rekent niet ' +
        'opnieuw en verschuift het einde dus niet. Het contractverloop bij het kantoor draagt ' +
        'een overgang naar OPZEGGEND, geen tweede.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
