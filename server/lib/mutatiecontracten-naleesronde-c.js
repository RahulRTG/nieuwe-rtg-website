/* ============================================================================
   MUTATIECONTRACTEN -- DE NALEESRONDE, DEEL C: EEN TWEEDE OPROEP IS EEN TWEEDE
   HANDELING, OF WE WETEN HET NIET.

   Deel van server/lib/mutatiecontracten.js; de kop van
   ./mutatiecontracten-naleesronde.js legt uit waarom deze 47 routes er opeens
   zijn.

   TWEE STANDEN, EN DE GRENS ERTUSSEN IS DE METING -- niet mijn lezing van de
   code. INTENTIONALLY_NON_IDEMPOTENT geeft toestemming om GEEN bescherming te
   bouwen, en de keuring eist daarom terecht dat "het hoort zo" en "het gebeurt
   ook zo" allebei waar zijn. Alleen de zes routes waarvan IDEMPROEF zonder
   sleutel `onbeschermd` MAT staan daarom op die stand.

   De andere vijf staan op BLOCKED_BY_TEST_FIXTURE, en dat is geen nette manier
   om "ik denk het wel" te zeggen: de proef deed zonder sleutel geen uitspraak
   (`ongemeten`), dus is er niets gemeten dat anders had kunnen uitvallen. Ik heb
   de handlers gelezen en vermoed bij alle vijf een tweede handeling -- maar een
   vermoeden onder deze stand zou precies de ontsnapping zijn waar de keuring
   voor waarschuwt. Wat er moet worden gebouwd om er wel een uitspraak over te
   doen, staat per route in `watErMoetKomen`.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP, AUTH, SCHOOL } = require('./mutatiecontracten-naleesronde');

/* GEMETEN ONBESCHERMD: de tweede oproep deed aantoonbaar iets. */
const tweede = (route, mutatieId, toegang, waarom, waar) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' },
  toegang,
  stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom,
  bewijs: {
    gemeten: 'IDEMPROEF-ronde van 12 september 2026: ZONDER idempotentiesleutel `onbeschermd` -- de ' +
      'tweede oproep liet een tweede spoor na in de gemeten collecties. Met sleutel is hij beschermd, ' +
      'dus de bestaande sleutellaag vangt de dubbelklik al af; deze stand gaat over wat de route ' +
      'ZELF doet',
    op: OP
  },
  nagekeken: 'Claude, 2026-09-13: ' + waar,
  afgetekend: AFGETEKEND
}];

/* NIET GEMETEN: de proef deed zonder sleutel geen uitspraak. */
const onbekend = (route, mutatieId, toegang, waar, watErMoetKomen) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'onbekend' },
  toegang,
  stand: 'BLOCKED_BY_TEST_FIXTURE',
  bewijs: {
    gemeten: 'IDEMPROEF-ronde van 12 september 2026: met sleutel `beschermd`, ZONDER sleutel ' +
      '`ongemeten` -- over het eigen duplicaatgedrag van deze route is dus niets vastgesteld',
    op: OP
  },
  nagekeken: 'Claude, 2026-09-13: ' + waar,
  watErMoetKomen,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  tweede('POST /api/gemeente/bekendmaking', 'gemeente.bekendmaking', AUTH,
    'Een bekendmaking is een PUBLICATIE. Twee keer publiceren is twee berichten aan de inwoners, en ' +
    'dat is precies wat een tweede oproep hoort te doen -- de gemeente die een tekst corrigeert, ' +
    'publiceert een tweede bekendmaking en herschrijft de eerste niet.',
    'bekendmakingMaak() doet `db.data.gemeenteBekend.unshift(b)` met een nieuw id en daarna save(). ' +
    'server/kern/gemeente/info.js:109'),
  tweede('POST /api/office/rtgai/train', 'office.rtgai.train', AUTH,
    'Een trainingsronde IS een gebeurtenis. Twee keer trainen is twee rondes, en de tweede bouwt ' +
    'voort op de eerste -- hem overslaan omdat er al een ronde was, zou de knop betekenisloos maken.',
    'rtgai.train() bewaart de ronde duurzaam; de foutafhandeling van de route zegt dat met zoveel ' +
    'woorden ("kon niet duurzaam worden bewaard"). server/routes/rtgkantoor.js'),
  tweede('POST /api/foundation/school/leraar/klas/maak', 'school.leraar.klas.maak', SCHOOL,
    'Twee klassen met dezelfde naam zijn twee klassen. Een school mag twee groepen 3B hebben op twee ' +
    'vestigingen, dus de naam is geen sleutel en de route weigert een tweede terecht niet.',
    'de handler maakt een klas aan met een eigen code en bewaart hem. server/school/beheer.js:129'),
  tweede('POST /api/foundation/school/zorg/zet', 'school.zorg.zet', SCHOOL,
    'Een leerdoel is een REGEL in een zorgplan, geen veld. Twee keer hetzelfde doel indienen zet twee ' +
    'doelen -- ook dat is wat een zorgcoordinator bedoelt als zij een doel herhaalt voor een nieuwe ' +
    'periode. De velden `behoefte` en `plan` in dezelfde route zijn wel vervangend.',
    'z.doelen.unshift(...) met een nieuw id; behoefte en plan zijn toewijzingen. server/school/zorg.js:29'),
  tweede('POST /api/foundation/school/leerling/overstap', 'school.leerling.overstap', SCHOOL,
    'Een overstap is een GEBEURTENIS in de schoolloopbaan van een kind. Twee keer overstappen naar ' +
    'dezelfde klas legt twee regels vast, en dat hoort: de geschiedenis zegt wat er is gebeurd, niet ' +
    'wat de eindstand is. De klaslijst zelf is wel beschermd (er staat een `some()`-guard voor de push).',
    'l.overstappen.concat([...]) plus log() in het schooljournaal plus meld(); alleen k.leerlingen.push ' +
    'staat achter een guard. server/school/inschrijving-mutatie.js:40'),
  tweede('POST /api/foundation/school/dossier/contact', 'school.dossier.contact', SCHOOL,
    'De contactgegevens zelf worden VERVANGEN, maar de route legt elke wijziging vast in het ' +
    'schooljournaal -- ook een die niets verandert. Dat is de bedoeling van een journaal: het zegt wie ' +
    'wanneer aan het dossier van een kind heeft gezeten, en een tweede keer kijken is een tweede keer ' +
    'kijken.',
    'l.contact wordt in zijn geheel vervangen, en daarna log(sch, p, "contact-gewijzigd", ...). ' +
    'server/school/dossier.js:68'),

  onbekend('POST /api/lucht/vlucht/maak', 'lucht.vlucht.maak', AUTH,
    'vluchtMaak() maakt een vlucht aan en bewaart hem, maar weigert eerst met 409 als de gate op dat ' +
    'moment al bezet is. Een tweede identieke oproep loopt dus vermoedelijk op die controle vast -- en ' +
    'MUTATIECONTRACT.md is daar duidelijk over: een herhaling die wordt GEWEIGERD is een ' +
    'toestandscontrole en geen idempotentie. Welke van de twee het is, staat niet vast. ' +
    'server/kern/luchthaven/vluchten.js:13',
    'een geldig vluchtlijf in scripts/lib/idemwereld.js (nummer, datum, tijd, een vrije gate), zodat ' +
    'de eerste oproep slaagt en de tweede iets te herhalen heeft'),
  onbekend('POST /api/lucht/ai', 'lucht.ai', AUTH,
    'luchtAI() stelt een vraag aan een model. Er gaat niets naar de opslag, maar er gaat wel een ' +
    'aanroep naar buiten die kern/kosten telt -- en dat is precies de teller BUITEN de gemeten ' +
    'collecties waar NOT_APPLICABLE zijn tweede lijn voor eist. server/routes/luchthaven.js:56',
    'een proefwereld met een model of een bewezen regelterugval, zodat de route een 2xx geeft en er ' +
    'iets te vergelijken valt; plus een lezing van de kostenteller voor en na'),
  onbekend('POST /api/gemeente/triage', 'gemeente.triage', AUTH,
    'triage() beantwoordt eerst op trefwoorden en gaat alleen bij de restcategorie naar een model. ' +
    'De uitkomst is dezelfde, maar een tweede modelaanroep telt wel mee in kern/kosten -- zie ' +
    '/api/lucht/ai hierboven. server/kern/gemeente/meldingen.js:116',
    'een meldingstekst die de restcategorie raakt EN een geconfigureerd model, want alleen dan loopt ' +
    'de tak die iets buiten de collecties doet'),
  onbekend('POST /api/foundation/school/dossier', 'school.dossier', SCHOOL,
    'de route LEEST het dossier, behalve met `zorg: true`: dan eist hij een reden en schrijft hij ' +
    '"zorgdossier-geopend" in het schooljournaal. Welke van de twee takken de proef liep, is niet ' +
    'vastgelegd. server/school/dossier.js',
    'twee proeflijven in scripts/lib/idemwereld.js -- een zonder `zorg` en een met `zorg: true` plus ' +
    'een reden -- want dit zijn twee routes in een jas'),
  onbekend('POST /api/foundation/school/hr/uren', 'school.hr.uren', SCHOOL,
    'ook dit zijn twee takken in een jas: zonder `uren` in het lijf leest de route alleen de ' +
    'maandstand, met `uren` doet hij d.uren.unshift(...) en save(). server/school/hr-verlof.js:83',
    'een proeflijf MET `uren`, want zonder dat veld raakt de proef de schrijftak nooit en meet hij de ' +
    'lezer terwijl hij denkt de schrijver te meten')
]);

module.exports = { CONTRACTEN };
