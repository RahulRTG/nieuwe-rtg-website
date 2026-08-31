/* ============================================================================
   MUTATIECONTRACTEN -- ACHT DIE OP TWEE STILLE METERS STONDEN, EN ER TWEE
   WAREN DIE DAT NIET VERDIENDEN.

   Deel van ./mutatiecontracten.js.

   Deze acht kwamen uit de kale ronde met een sterk ogend voorstel: geen spoor in
   de opslag EN de effectmeter telde op allebei de oproepen `geen`. Twee
   onafhankelijke meters die zwijgen -- de meter stelde daarom NOT_APPLICABLE
   voor.

   Zes keer klopt dat, en die staan hieronder als lezers. Twee keer niet, en die
   twee zijn de reden dat dit register nooit een stand uit bewijs afleidt:

     /api/foundation/school/personeel/inloglink  De handler SCHRIJFT (een verse
       eenmalige inloghash, save()) en STUURT MAIL -- maar alleen als het
       schoolaccount bestaat. In de kale ronde bestond het niet, en dan loopt de
       route met opzet door de anti-enumeratietak: hetzelfde antwoord, dezelfde
       antwoordtijd, geen effect. Beide meters zagen dus de tak die niets doet.
       Een tweede aanvraag geeft een NIEUWE link en maakt de vorige ongeldig; dat
       is werk en het hoort te gebeuren.

     /api/foundation/hulp/ai  Doet geen enkele schrijfhandeling, en toch is
       NOT_APPLICABLE hier onwaar. De tweede oproep stelt de vraag echt opnieuw
       aan het model: een tweede antwoord, en een tweede rekening. Dat effect
       valt in `NIET_GEMETEN` van server/effectmeter.js (externe aanroep), dus de
       meter zweeg over iets dat hij niet KAN zien -- en zwijgen is hier geen
       nul. Zelfde lezing als /api/member/lifestyle/concierge/vraag in
       ./idemsleutels-kaleronde-b.js: een tweede vraag is een tweede vraag.

   Twee zwijgende meters zijn dus geen bewijs van stilte. Ze zijn bewijs dat er
   niets gezien is, en het verschil daartussen is precies waar dit register voor
   bestaat.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gelezen handler naast de twee metingen; wijkt bij twee van de ' +
    'acht bewust af van het voorstel; niet door een mens nagelezen',
  op: '2026-08-30'
};

const LID = { klasse: 'AUTHENTICATED' };
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };

const GEMETEN = 'kale ronde: twee geslaagde oproepen zonder spoor in de gemeten collecties, en de ' +
  'effectmeter (server/effectmeter.js) telde op allebei `geen`';

const lezer = (route, mutatieId, toegang, bestand, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: GEMETEN, op: '2026-08-30' },
  nagekeken: 'handler gelezen in ' + bestand + ': ' + wat + ' -- geen schrijfvorm, geen bericht, geen ' +
    'externe aanroep. Hier dragen de twee zwijgende meters het voorstel wel, want de handler bevestigt ' +
    'wat zij niet zagen',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  lezer('POST /api/foundation/gezin/uitnodigingen', 'foundation.gezin.uitnodigingen', GEZIN,
    'server/foundation/gezinsuitnodiging.js (lijst())',
    'geeft de uitnodigingen van het gezin terug aan de beheerder; berekent hooguit `verlopen` in het antwoord'),
  lezer('POST /api/foundation/mail/inbox', 'foundation.mail.inbox', GEZIN,
    'server/foundation/leden-mail.js', 'geeft het postvak van het eigen adres terug'),
  lezer('POST /api/foundation/mail/overzicht', 'foundation.mail.overzicht', GEZIN,
    'server/foundation/leden-mail.js', 'geeft adres, publiek adres en het aantal ongelezen berichten terug'),
  lezer('POST /api/foundation/mail/verzonden', 'foundation.mail.verzonden', GEZIN,
    'server/foundation/leden-mail.js', 'geeft de verzonden berichten van het eigen adres terug'),
  lezer('POST /api/member/borden', 'member.borden', LID,
    'server/routes/borden.js', 'geeft de borden van het lid terug na de Business-controle'),
  lezer('POST /api/overheid/uitkeringen/mijn', 'overheid.uitkeringen.mijn', LID,
    'server/routes/member/overheid.js', 'geeft overheid.mijnUitkeringen(sessiesleutel) terug, een regel lang'),

  ['POST /api/foundation/school/personeel/inloglink', {
    mutatieId: 'foundation.school.personeel.inloglink', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: SCHOOL,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede aanvraag hoort een NIEUWE eenmalige link te geven en de vorige ongeldig te ' +
      'maken; wie de eerste mail niet kreeg, vraagt er nog een',
    bewijs: { gemeten: GEMETEN + ' -- maar het schoolaccount bestond niet, dus beide oproepen liepen ' +
      'door de anti-enumeratietak die met opzet niets doet', op: '2026-08-30' },
    nagekeken: 'handler gelezen in server/school/personeel-inlog.js: bij een BESTAAND actief account ' +
      'schrijft hij een verse inlogHash met een eigen vervaltijd (save()) en stuurt hij een mail. Een ' +
      'tweede aanvraag hoort een nieuwe link te geven en de vorige ongeldig te maken -- iemand die de ' +
      'eerste mail niet kreeg, vraagt er nog een. Een laag die de tweede opslikt, sluit hem buiten. De ' +
      'rem (teVaak/misluktePoging, 5 per 15 minuten per IP) begrenst dat en niet deze laag',
    afgetekend: AFGETEKEND
  }],

  ['POST /api/foundation/hulp/ai', {
    mutatieId: 'foundation.hulp.ai', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: GEZIN,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'een tweede vraag is een tweede vraag: de oproep gaat echt opnieuw naar het model, en een ' +
      'kind dat het niet snapte vraagt het opnieuw',
    bewijs: { gemeten: GEMETEN + ' -- en dat zwijgen is hier geen nul: een externe aanroep staat in ' +
      '`NIET_GEMETEN` van server/effectmeter.js', op: '2026-08-30' },
    nagekeken: 'handler gelezen in server/foundation/buddy.js: geen schrijfhandeling, maar de tweede ' +
      'oproep stelt de vraag echt opnieuw aan het model -- een tweede antwoord en een tweede rekening. ' +
      'Zelfde lezing als /api/member/lifestyle/concierge/vraag: een tweede vraag is een tweede vraag, ' +
      'en een kind dat het niet snapte vraagt het opnieuw',
    afgetekend: AFGETEKEND
  }]
]);

module.exports = CONTRACTEN;
