/* ============================================================================
   MUTATIECONTRACTEN -- DE REST DIE UIT DE AFLEIDGANG VIEL (deel 3).

   Deel van ./mutatiecontracten.js; zie de kop van ./mutatiecontracten-afleidrest.js
   voor waar deze zevenenveertig vandaan komen, en die van ./-b voor de negen
   lezers met een luie seeder.

   Hier staan de zeven die iets ANDERS zijn dan een lezer, in twee soorten.

   VIER WAARVAN DE PROEF DE SCHRIJFTAK NOOIT BINNENGING
   (BLOCKED_BY_TEST_FIXTURE). Dit is de strengste stand van de vier: hij zegt
   niets over de route en alles over de PROEF. Zodra scripts/lib/idemwereld.js
   die tak bereikbaar maakt, hoort de regel te vervallen of opnieuw beoordeeld
   te worden -- anders is het een parkeerplaats in plaats van een werkopdracht.
   Vandaar dat `watErMoetKomen` hier per route het ONTBREKENDE LIJF of de
   ontbrekende toestand noemt, en niet "nog niet aan toegekomen".

   DRIE WAARBIJ EEN TWEEDE AANROEP ECHT EEN TWEEDE HANDELING IS
   (INTENTIONALLY_NON_IDEMPOTENT). Twee daarvan roepen een MODEL aan, en daar
   zegt de opslagmeter niets over: een externe aanroep staat in `NIET_GEMETEN`
   van server/effectmeter.js. ZWIJGEN IS DAAR GEEN NUL -- dat is de kern, en het
   is de reden dat idempotentie niet alleen over lokale writes gaat. Die lezing
   is niet nieuw: /api/foundation/hulp/ai en /api/member/lifestyle/concierge/vraag
   zijn op precies deze grond al eerder zo ingedeeld
   (./mutatiecontracten-effectmeter.js).
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 13 september 2026 naast de gemeten kale ronde; ' +
    'niet door een mens nagelezen',
  op: '2026-09-13'
};

const LID = { klasse: 'AUTHENTICATED' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };

const CONTRACTEN = Object.fromEntries([
  /* ---- 3. vier waar de proef de schrijftak nooit binnenging ---- */
  ['POST /api/foundation/school/dossier', {
    mutatieId: 'foundation.school.dossier', herkomst: 'mens',
    semantiek: { klasse: 'onbekend' },
    toegang: SCHOOL,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'een leerling MET een zorgdossier, plus een lijf met `zorg: true` en een `reden`. ' +
      'Zonder die twee velden neemt server/school/dossier.js:27 de tak die alleen het gewone dossier ' +
      'teruggeeft; met die twee schrijft hij een journaalregel (log(), en die doet unshift + save()). De ' +
      'proef ging alleen door de eerste tak, dus wat een herhaling van de TWEEDE doet is ongemeten',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/foundation/school/hr/uren', {
    mutatieId: 'foundation.school.hr.uren', herkomst: 'mens',
    semantiek: { klasse: 'onbekend' },
    toegang: SCHOOL,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'een lijf met `uren`. server/school/hr-verlof.js:83 schrijft alleen binnen ' +
      '`if (req.body.uren != null)`; zonder dat veld is het een maandoverzicht en verder niets. De proef ' +
      'stuurde het niet, dus de schrijftak is nooit uitgevoerd',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/supplier/horeca/keuken/tijden', {
    mutatieId: 'supplier.horeca.keuken.tijden', herkomst: 'mens',
    semantiek: { klasse: 'onbekend' },
    toegang: LID,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'een lijf met `tijden`. server/routes/supplier/horeca/keuken-regie.js:81 loopt ' +
      'zonder dat veld over een lege lijst en schrijft nul regels. Het LEZEN wijst uit dat de schrijfvorm ' +
      'een toewijzing op een sleutel is (bereidingstijden[naam] = m) en dus idempotent zou zijn -- maar ' +
      'dat is gelezen en niet gemeten, en deze stand is er juist om dat verschil vast te houden',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/lucht/vlucht/maak', {
    mutatieId: 'lucht.vlucht.maak', herkomst: 'mens',
    semantiek: { klasse: 'onbekend' },
    toegang: LID,
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    watErMoetKomen: 'een VRIJE gate en een vrij tijdslot. In de ronde MET sleutel is deze route gemeten ' +
      'als beschermd ("de server merkte de herhaling zelf, herhaald: true") en zag de opslagmeter de ' +
      'collectie `luchthaven` veranderen. De kale ronde erna kreeg twee keer 409, want de gate uit die ' +
      'eerste ronde was nog bezet -- server/kern/luchthaven/vluchten.js:19 weigert dan. Dat is een ' +
      'volgorde-artefact van de proefopstelling en geen uitspraak over de route',
    afgetekend: AFGETEKEND
  }],

  /* ---- 4. drie waarbij een tweede aanroep een tweede handeling IS ---- */
  ['POST /api/gemeente/triage', {
    mutatieId: 'gemeente.triage', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede triage is een tweede lezing: bij een melding die de trefwoorden niet dekken gaat ' +
      'de oproep echt opnieuw naar het model, met een tweede antwoord en een tweede rekening',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen zonder spoor in de gemeten ' +
      'collecties -- en dat zwijgen is hier geen nul, want een externe aanroep staat in `NIET_GEMETEN` ' +
      'van server/effectmeter.js', op: '2026-09-12' },
    nagekeken: 'met de hand, 2026-09-13: server/kern/gemeente/meldingen.js:116 beantwoordt een eenduidige ' +
      'trefwoordmatch met een regel en zonder model; alleen de restcategorie gaat naar anthropic.messages.' +
      'create(). Geen enkele schrijfhandeling -- en toch geen NOT_APPLICABLE. Zelfde lezing als ' +
      '/api/foundation/hulp/ai in ./mutatiecontracten-effectmeter.js',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/lucht/ai', {
    mutatieId: 'lucht.ai', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede vraag aan de AI-operations is een tweede vraag: de vluchtleiding die het antwoord ' +
      'niet vertrouwde, vraagt het opnieuw en hoort een vers antwoord te krijgen',
    bewijs: { gemeten: 'kale ronde zonder sleutel: twee geslaagde oproepen zonder spoor in de gemeten ' +
      'collecties -- en een externe aanroep staat in `NIET_GEMETEN` van server/effectmeter.js', op: '2026-09-12' },
    nagekeken: 'met de hand, 2026-09-13: server/kern/luchthaven/cockpit.js:66 bouwt het beeld uit ' +
      'cockpit() en stuurt de vraag naar de anthropic-client (messages/create). Hij adviseert alleen: elke ' +
      'schakeling doet een mens langs een andere route, dus er wordt niets weggeschreven',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/office/rtgai/train', {
    mutatieId: 'office.rtgai.train', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: LID,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een trainingsronde draaien is een MEETHANDELING: twee keer trainen hoort twee ronden op te ' +
      'leveren, anders traint de tweede op de uitkomst van de eerste. Dezelfde lezing als ' +
      '/api/command/sonde/draai in ./idemsleutels-basis.js',
    bewijs: { gemeten: 'kale ronde zonder sleutel: onbeschermd -- een woordelijk gelijke herhaling deed ' +
      'het werk opnieuw, en de collectie `rtgai` veranderde bij allebei', op: '2026-09-12' },
    nagekeken: 'met de hand, 2026-09-13: server/routes/rtgkantoor.js:11 roept rtgai.train(wie(req)) aan ' +
      'en faalt met 503 als de ronde niet duurzaam kon worden bewaard -- de ronde is het product',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
