/* ============================================================================
   MUTATIECONTRACTEN -- DE REST DIE UIT DE AFLEIDGANG VIEL (deel 2).

   Deel van ./mutatiecontracten.js; zie de kop van ./mutatiecontracten-afleidrest.js
   voor waar deze zevenenveertig vandaan komen en hoe ze gelezen zijn.

   Hier staan de achttien die GEEN lezer bleken. Ze vallen in drie soorten, en
   dat elk van de drie bestaat is precies waarom deze ronde met de hand moest.

   1. NEGEN LEZERS MET EEN LUIE SEEDER (PROTECTED, niet NOT_APPLICABLE).
      Vier gemeente- en vijf luchthaven-lijsten beginnen met seed(), en die
      schrijft bij de ALLEREERSTE aanroep op een verse database: hij legt de
      lege collecties aan, zet het genre, en maakt in demostand de partner aan
      -- met een save() erin. Daarna houdt een eenmalige vlag hem tegen
      (`db.data._gemeenteSeed`, en voor de luchthaven de aanwezigheid van de
      LUCHT-partner zelf).

      "Deze route verandert niets" is daarmee ONWAAR, en "een herhaling doet het
      werk niet nog een keer" is letterlijk waar. Dus PROTECTED. Dat is dezelfde
      valkuil die /api/office/mensdeur ooit had (zie ./mutatiecontracten-leest.js):
      een leesweg die de collectie AANLEGT is geen leesweg.

   2. TWEE ECHTE SCHRIJVERS DIE HUN HERHALING ZELF OPVANGEN (PROTECTED).
      Gemeten als `beschermd` in de kale ronde, en het lezen zegt waarom: ze
      ZETTEN een waarde in plaats van er een toe te voegen.

   3. VIER WAARVAN DE PROEF DE SCHRIJFTAK NOOIT BINNENGING
      (BLOCKED_BY_TEST_FIXTURE). Dit is de strengste stand van de vier: hij zegt
      niets over de route en alles over de PROEF. Zodra scripts/lib/idemwereld.js
      die tak bereikbaar maakt, hoort deze regel te vervallen of opnieuw
      beoordeeld te worden -- anders is het een parkeerplaats in plaats van een
      werkopdracht.

   4. DRIE WAARBIJ EEN TWEEDE AANROEP ECHT EEN TWEEDE HANDELING IS
      (INTENTIONALLY_NON_IDEMPOTENT). Twee daarvan roepen een MODEL aan, en daar
      zegt de opslagmeter niets over -- een externe aanroep staat in
      `NIET_GEMETEN` van server/effectmeter.js. Zwijgen is daar geen nul. Die
      lezing is niet nieuw: /api/foundation/hulp/ai en
      /api/member/lifestyle/concierge/vraag zijn op precies deze grond al eerder
      zo ingedeeld (./mutatiecontracten-effectmeter.js).
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 13 september 2026 naast de gemeten kale ronde; ' +
    'niet door een mens nagelezen',
  op: '2026-09-13'
};

const LID = { klasse: 'AUTHENTICATED' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
const KLAS = { klasse: 'OBJECT_SCOPED', objectVeld: 'klasCode' };

/* 1. De luie seeder. Een zin, negen keer, met het bestand als variabele. */
const SEED_BEWIJS = 'kale ronde zonder sleutel: twee geslaagde oproepen zonder spoor in de gemeten ' +
  'collecties en met `geen` op de effectmeter -- de seeder had zijn eenmalige werk toen al gedaan';
const seeder = (route, bestand, wat, vlag) => [route, {
  mutatieId: route.replace(/^POST \/api\//, '').replace(/\//g, '.'),
  herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: LID,
  stand: 'PROTECTED',
  bewijs: { gemeten: SEED_BEWIJS, op: '2026-09-12' },
  nagekeken: 'met de hand, 2026-09-13: ' + bestand + ' -- ' + wat + '. De route zelf leest alleen; ' +
    'de enige schrijfweg is de seeder ervoor, en die is eenmalig (' + vlag + ')',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  /* ---- 1. negen lezers met een luie seeder ---- */
  seeder('POST /api/gemeente/regie', 'server/kern/gemeente/info.js:121 regie()',
    'telt open meldingen, afspraken van vandaag en openstaande vergunningen',
    'db.data._gemeenteSeed in server/kern/gemeente/index.js:61'),
  seeder('POST /api/gemeente/meldingen', 'server/kern/gemeente/meldingen.js:64 meldingenLijst()',
    'filtert de meldingen op ploeg en status', 'db.data._gemeenteSeed'),
  seeder('POST /api/gemeente/afspraken', 'server/kern/gemeente/burgerzaken.js:93 afsprakenLijst()',
    'filtert de afspraken van een dag', 'db.data._gemeenteSeed'),
  seeder('POST /api/gemeente/vergunningen', 'server/kern/gemeente/vergunningen.js:43 vergunningenLijst()',
    'filtert de vergunningen op status', 'db.data._gemeenteSeed'),
  seeder('POST /api/lucht/cockpit', 'server/kern/luchthaven/cockpit.js:26 cockpit()',
    'leidt signalen af uit de vluchten van vandaag',
    'de aanwezigheid van de LUCHT-partner, server/kern/luchthaven/index.js:76'),
  seeder('POST /api/lucht/bagage', 'server/kern/luchthaven/grond.js:38 bagage()',
    'filtert de koffers; het zetten van een kofferstand is bagageZet(), een andere route',
    'de aanwezigheid van de LUCHT-partner'),
  seeder('POST /api/lucht/charters', 'server/kern/luchthaven/royaal.js:31 charterLijst()',
    'geeft de charteraanvragen terug; beslissen is een andere route',
    'de aanwezigheid van de LUCHT-partner'),
  seeder('POST /api/lucht/vip/lijst', 'server/kern/luchthaven/royaal.js:88 vipLijst()',
    'geeft de VIP-aanmeldingen terug', 'de aanwezigheid van de LUCHT-partner'),
  seeder('POST /api/lucht/lounge', 'server/kern/luchthaven/royaal.js:114 loungeStand()',
    'geeft de bezetting van de lounge terug; in- en uitchecken zijn andere routes',
    'de aanwezigheid van de LUCHT-partner'),

  /* ---- 2. twee schrijvers die ZETTEN in plaats van TOEVOEGEN ---- */
  ['POST /api/notifications/read', {
    mutatieId: 'notifications.read', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: LID,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder sleutel: beschermd. Het enige verschil zat in `wacht` (de ' +
      'emmer van een rem) en niet in een collectie van deze route', op: '2026-09-12' },
    nagekeken: 'met de hand, 2026-09-13: server/server.js:1133 zet `n.read = true` op de meldingen van ' +
      'de tier en van de sleutel, en roept save() aan. Bij de tweede oproep staat die vlag er al, dus de ' +
      'tweede keer verandert er niets. scripts/schrijfanalyse.js meldt hier terecht `ja` -- hij schrijft ' +
      'echt, en PROTECTED zegt niet dat hij dat niet doet',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/foundation/school/rooster/zet', {
    mutatieId: 'foundation.school.rooster.zet', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: KLAS,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder sleutel: beschermd. Het enige verschil zat in `wacht`, de ' +
      'emmer van een rem', op: '2026-09-12' },
    nagekeken: 'met de hand, 2026-09-13: server/school/klas.js:95 vervangt `k.rooster` HEEL (filter + ' +
      'map over het meegestuurde rooster) en slaat op. Hetzelfde rooster twee keer zetten laat dezelfde ' +
      'stand achter; er wordt niets aan toegevoegd',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
