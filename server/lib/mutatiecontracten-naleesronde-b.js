/* ============================================================================
   MUTATIECONTRACTEN -- DE NALEESRONDE, DEEL B: EEN HERHALING DOET HET WERK NIET
   NOG EEN KEER.

   Deel van server/lib/mutatiecontracten.js; de kop van
   ./mutatiecontracten-naleesronde.js legt uit waarom deze 47 routes er opeens
   zijn.

   PROTECTED eist twee dingen: een gemeten ronde waarin de tweede oproep geen
   tweede effect had, EN een duplicaatregel of een eigen afhandeling in de code.
   Geen van deze routes draagt een duplicaatregel; alle zeventien dragen een
   eigen afhandeling, en die staat er per groep bij. Er zijn er drie soorten, en
   ze horen niet door elkaar te lopen:

   1. DE OPWARMING. Een lezer roept seed() aan, en seed() maakt bij de aller-
      eerste oproep de demowereld aan -- daarna nooit meer, want er staat een
      vlag op (`l._seed`, `db.data._gemeenteSeed`). Dat is precies de eenmalige
      opwarming die HERSTELPROEF.md ook tegenkwam: `exact` betekent daar exact
      bij een TWEEDE en volgende uitvoering. NOT_APPLICABLE zou hier een leugen
      zijn, want de eerste oproep verandert wel degelijk iets.
   2. DE EENMALIGE TOEKENNING. Vier schermen die er als lezer uitzien kennen bij
      de eerste oproep een persoonlijk mailadres toe (zorgAdres() in
      server/school/personeel-mail.js: `if (p.rtgMail) return p.rtgMail`).
      Dit is de vondst van de naleesronde -- alle vier stonden op het punt
      NOT_APPLICABLE te worden.
   3. HET VERVANGENDE SCHRIJVEN. De route zet een toestand op een waarde die uit
      het verzoek komt. Tweemaal dezelfde invoer geeft tweemaal dezelfde
      toestand; er groeit niets aan.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP, AUTH, SCHOOL } = require('./mutatiecontracten-naleesronde');

const beschermd = (route, mutatieId, toegang, soort, waar) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'PROTECTED',
  bewijs: {
    gemeten: 'IDEMPROEF-ronde van 12 september 2026: met sleutel `beschermd` -- de tweede oproep liet ' +
      'geen tweede spoor na in de gemeten collecties',
    op: OP
  },
  nagekeken: 'Claude, 2026-09-13. ' + soort + ' ' + waar,
  afgetekend: AFGETEKEND
}];

const OPWARMING = 'Eigen afhandeling: een eenmalige opwarming achter een vlag, daarna nul schrijfwerk.';
const TOEKENNING = 'Eigen afhandeling: een eenmalige toekenning met een guard ervoor.';
const VERVANGEND = 'Eigen afhandeling: vervangend schrijven -- dezelfde invoer geeft dezelfde toestand.';

const CONTRACTEN = Object.fromEntries([
  /* ---- 1. de opwarming: de luchthaven ---- */
  ...[['cockpit', 'lucht.cockpit'], ['bord', 'lucht.bord'], ['bagage', 'lucht.bagage'],
      ['charters', 'lucht.charters'], ['vip/lijst', 'lucht.vip.lijst'], ['lounge', 'lucht.lounge']]
    .map(([p, id]) => beschermd('POST /api/lucht/' + p, id, AUTH, OPWARMING,
      'De handler leest (cockpit(), bord(), bagage(), charterLijst(), vipLijst(), loungeStand() in ' +
      'server/kern/luchthaven/) en roept daarbij seed() aan. seed() schrijft alleen achter `if ' +
      '(!l._seed)` en alleen in demostand -- server/kern/luchthaven/index.js:71.')),

  /* ---- 1. de opwarming: de gemeente ---- */
  ...[['meldingen', 'gemeente.meldingen'], ['afspraken', 'gemeente.afspraken'],
      ['vergunningen', 'gemeente.vergunningen'], ['regie', 'gemeente.regie']]
    .map(([p, id]) => beschermd('POST /api/gemeente/' + p, id, AUTH, OPWARMING,
      'De handler leest (meldingenLijst(), afsprakenLijst(), vergunningenLijst(), regie() in ' +
      'server/kern/gemeente/) en roept daarbij seed() aan. Die keert terug bij ' +
      '`if (db.data._gemeenteSeed) return` -- server/kern/gemeente/index.js:53.')),

  /* ---- 2. de eenmalige toekenning: het personeelsmailadres ---- */
  ...[['personeel/status', 'school.personeel.status'],
      ['personeel/mail/overzicht', 'school.personeel.mail.overzicht'],
      ['personeel/mail/inbox', 'school.personeel.mail.inbox'],
      ['personeel/mail/verzonden', 'school.personeel.mail.verzonden']]
    .map(([p, id]) => beschermd('POST /api/foundation/school/' + p, id, SCHOOL, TOEKENNING,
      'Deze vier lezen, maar bereiken alle vier zorgAdres() -- /status rechtstreeks via ' +
      'sctx.zorgPersoneelsMail, de drie mailroutes via de helper mijn(). zorgAdres() kent bij de ' +
      'EERSTE oproep een *.rtg-adres toe (`p.rtgMail=adres; save()`) en keert daarna meteen terug op ' +
      '`if (p.rtgMail) return p.rtgMail` -- server/school/personeel-mail.js:54 en verder. Zonder die ' +
      'tweede lezing waren ze hier als NOT_APPLICABLE beland, en dat zou onwaar zijn geweest.')),

  /* ---- 3. het vervangende schrijven ---- */
  beschermd('POST /api/notifications/read', 'notifications.read', AUTH, VERVANGEND,
    'De handler zet `n.read = true` op elke melding in de twee bakken van deze sessie. De tweede ' +
    'oproep zet dezelfde waarde; er komt niets bij en er gaat niets weg. server/server.js:1133.'),
  beschermd('POST /api/foundation/school/rooster/zet', 'school.rooster.zet',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'klasCode',
      uitleg: 'de klas uit klasVan(), en alleen een klas van de eigen school' }, VERVANGEND,
    'De handler VERVANGT `k.rooster` in zijn geheel door wat er in het lijf staat -- geen push, geen ' +
    'unshift. Dezelfde invoer geeft dus hetzelfde rooster. server/school/klas.js:95.'),
  beschermd('POST /api/supplier/horeca/keuken/tijden', 'supplier.horeca.keuken.tijden', AUTH, VERVANGEND,
    'De handler zet per gerecht `h.instel.bereidingstijden[naam] = minuten` en eventueel ' +
    '`h.instel.kokken`. Toewijzing op een sleutel, geen lijst die aangroeit: dezelfde invoer geeft ' +
    'dezelfde instelling. server/routes/supplier/horeca/keuken-regie.js.')
]);

module.exports = { CONTRACTEN };
