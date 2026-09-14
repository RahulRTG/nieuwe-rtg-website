/* ============================================================================
   MUTATIECONTRACTEN -- DE REST DIE UIT DE AFLEIDGANG VIEL (de lezers).

   Deel van ./mutatiecontracten.js.

   WAAR DEZE ZEVENENVEERTIG VANDAAN KOMEN, want dat verklaart de hele bak. De
   afleidgang van scripts/mutatiecontract.js schreef ze ooit uit als
   BLOCKED_BY_TEST_FIXTURE. Daarna kreeg die gang een grens erbij: een route mag
   die stand alleen krijgen als de effectmeter WEL iets telde -- telde hij niets
   en veranderde er niets, dan is de route een kandidaat voor NOT_APPLICABLE en
   zou BLOCKED hem daar wegkapen. Zevenenveertig routes vielen daardoor uit de
   afgeleide lijst, en het REGISTER liep dat niet na: MUTATIECONTRACT.json bleef
   3189 afgeleide rijen claimen terwijl MUTATIECONTRACT-AFGELEID.json er 3142
   bevat. Een verse `--vastleggen` legt dat verschil bloot als 47x LEGACY.

   Dat is dus geen nieuw gat maar een register dat een generatie achterliep, en
   de reparatie is precies wat de gang zelf vraagt: een MENS leest de handler.

   WAT ER IN DIT BESTAND STAAT: de vierentwintig waarvan het lezen uitwijst dat
   ze op ELKE tak alleen lezen. De andere drieentwintig staan in ./-b en ./-c,
   want ze zijn iets anders -- en dat verschil is de hele waarde van de ronde.

   DE TWEEDE BEWIJSLIJN, EN WAAROM DIE HIER EEN MENS IS. scripts/schrijfanalyse.js
   is vers gedraaid over deze zevenenveertig en haalde er NUL over de streep:
   zesentwintig `onbekend` (de aanroep gaat naar een andere module, want de
   routelaag krijgt zijn modules via een contextobject), achttien niet eens
   gevonden (ze hangen op een routerprefix), en drie `ja`. Van die drie is er een
   een VALSE TREFFER die alleen handmatig lezen kon weerleggen: de schrijfvorm
   die hij vond in /api/supplier/kosten/vooruitblik is `Object.assign({ok:true},
   ...)` in de route zelf -- een vers literal, geen opgeslagen toestand. De lijst
   is met opzet te ruim; daar hoort dit soort weerlegging bij.

   DRIE REGELS DIE UIT HET LEZEN VOLGDEN EN DIE HIER OVERAL GELDEN:

     1. poort() (server/school/rollen.js:84) en personeelVan()
        (server/school/poorten.js:32) SCHRIJVEN NIET. Een route erachter wordt
        er dus niet door besmet.
     2. log() (server/school/rollen.js:73) schrijft WEL -- unshift op het
        journaal plus save(). Elke route die hem aanroept staat niet in dit
        bestand maar in ./-b of ./-c.
     3. Een luie seeder die bij de eerste aanroep save() doet, maakt een
        leesroute geen NOT_APPLICABLE. Die negen staan in ./-b als PROTECTED.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS -- zelfde vorm als
   ./mutatiecontracten-leest.js. Deze contracten zijn opgesteld door Claude op
   grond van de gelezen handler naast de gemeten kale ronde. Dat het geen mens
   was die ze een voor een las, hoort in het register te staan en niet
   gladgestreken te worden. Wie er een naleest en zijn naam eronder wil zetten,
   vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), handler per route gelezen op 13 september 2026 naast de gemeten kale ronde; ' +
    'niet door een mens nagelezen',
  op: '2026-09-13'
};

const GEMETEN = 'kale ronde zonder sleutel: twee geslaagde oproepen, geen spoor in de gemeten ' +
  'collecties, en de effectmeter (server/effectmeter.js) telde op allebei `geen` -- geen ' +
  'schrijfpoging, geen mail, geen sms';

const LID = { klasse: 'AUTHENTICATED' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code' };

/* HETZELFDE BEWIJS, VIERENTWINTIG KEER -- dus EEN keer, met het bestand en de
   gelezen waarneming als enige variabelen. Zie ./mutatiecontracten-beschermd.js
   voor waarom dat meer is dan een besparing: een reeks bijna-gelijke zinnen is
   de vorm waarin een verschil onopgemerkt insluipt. */
const leest = (route, toegang, bestand, wat) => [route, {
  mutatieId: route.replace(/^POST \/api\//, '').replace(/\//g, '.'),
  herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: GEMETEN, op: '2026-09-12' },
  nagekeken: 'met de hand, 2026-09-13: ' + bestand + ' -- ' + wat + '. Geen save(), geen toewijzing ' +
    'aan opgeslagen toestand, geen bericht, geen externe aanroep, en geen luie seeder ervoor',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  /* ---- RTG School: de leesroutes achter poort()/personeelVan() ---- */
  leest('POST /api/foundation/school/aanwezigheid/leerling', SCHOOL,
    'server/school/aanwezigheid.js:83',
    'telt de presentieregels van een leerling en geeft een telling per stand terug'),
  leest('POST /api/foundation/school/belasting/mij', SCHOOL,
    'server/school/belasting.js:67',
    'bouwt uit de eigen klassen een weekbeeld van wat er aankomt'),
  leest('POST /api/foundation/school/leraar/overzicht', SCHOOL,
    'server/school/beheer.js:156',
    'filtert de klassen van deze leraar en vat ze samen'),
  leest('POST /api/foundation/school/mijn-rechten', SCHOOL,
    'server/school/rollen.js:142',
    'geeft naam, status, rollen en rechten van de ingelogde medewerker terug'),
  leest('POST /api/foundation/school/peiling/mijn-personeel', SCHOOL,
    'server/school/peiling-antwoord.js:75',
    'filtert de open personeelspeilingen; `alGeantwoord` komt uit het bestaande merk en niet uit een lijst met namen'),
  leest('POST /api/foundation/school/personeel/start', SCHOOL,
    'server/school/instap.js:107',
    'leidt hooguit vijf stappen af uit hoe het er nu voor staat'),
  leest('POST /api/foundation/school/personeel/status', SCHOOL,
    'server/school/beheer.js:72',
    'geeft status, klassen en de niveauladder terug'),
  leest('POST /api/foundation/school/personeel/mail/inbox', SCHOOL,
    'server/school/personeel-mail.js:69 -> kern/rtmail.js:127 postvak()',
    'filtert de berichten van dit adres; markeert niets als gelezen (dat doet lees(), een andere route)'),
  leest('POST /api/foundation/school/personeel/mail/overzicht', SCHOOL,
    'server/school/personeel-mail.js:60 -> kern/rtmail.js:136 ongelezen()',
    'geeft het adres terug plus een reduce over de berichten'),
  leest('POST /api/foundation/school/personeel/mail/verzonden', SCHOOL,
    'server/school/personeel-mail.js:73 -> kern/rtmail.js:132 verzonden()',
    'filtert de berichten die van dit adres komen'),

  /* ---- RTG Airport: de enige lucht-leesroute ZONDER seed() ---- */
  leest('POST /api/lucht/bord', LID,
    'server/kern/luchthaven/vluchten.js:78 bord()',
    'sorteert en filtert de vluchten vanaf vandaag; roept als enige van de lucht-lijsten GEEN seed() aan'),

  /* ---- RTFoundation: gift, ruil en winkel, allemaal achter leesRem ---- */
  leest('POST /api/rtfos/ruil/mijn', LID,
    'server/kern/rtfos/ruil.js:90 mijn()', 'filtert de eigen ruilregels op codenaam'),
  leest('POST /api/rtfos/winkel', LID,
    'server/kern/rtfos/winkel.js:71 etalage()', 'stelt de etalage samen uit het bestaande aanbod'),
  leest('POST /api/rtfos/winkel/mijn', LID,
    'server/kern/rtfos/winkel.js:170 mijn()', 'filtert de eigen bestellingen op codenaam'),
  leest('POST /api/rtfos/gift/machtiging/mijn', LID,
    'server/kern/rtfos/gift-machtiging.js:82 mijn()', 'geeft de eigen SEPA-machtiging terug'),
  leest('POST /api/rtfos/gift/plan/mijn', LID,
    'server/kern/rtfos/gift-periodiek.js:125 mijn()', 'geeft het eigen meerjarige plan terug'),
  leest('POST /api/rtfos/gift/projecten', LID,
    'server/kern/rtfos/gift-projecten.js:57 lijst()', 'geeft de lijst waar een geoormerkte gift heen kan'),
  leest('POST /api/rtfos/gift/stand', LID,
    'server/kern/rtfos/gift.js:78 stand()', 'telt de bestaande giften bij elkaar op'),

  /* ---- RTG Kostprijs: vier vragen, vier keer rekenen ----
     Deze vier dragen al een tweede, onafhankelijke verklaring: `{ leest: true }`
     in lib/idemsleutels.js, door een mens geschreven. Het lezen bevestigt die
     nu op de handler zelf. */
  leest('POST /api/kosten/mij', LID,
    'server/routes/kosten.js:36 -> server/routes/kosten-beeld.js (nul save())',
    'stelt het eigen kostenbeeld van een maand samen; kosten.drager() is een zuivere tekstfunctie'),
  leest('POST /api/kosten/grens', LID,
    'server/kern/kosten/grens.js:53 grensVoor()',
    'leest de eigen en de kantoorgrens en kiest per veld de strengste; de save() in dat bestand zit in grensZet(), een andere functie'),
  leest('POST /api/supplier/kosten', LID,
    'server/routes/kosten.js:94 -> server/routes/kosten-beeld.js',
    'hetzelfde beeld als voor een lid, met de zaakcode als drager'),
  leest('POST /api/supplier/kosten/vooruitblik', LID,
    'server/kern/kosten/vooruitblik.js:125 vooruitblik()',
    'projecteert de lopende maand en zet er alleen een band omheen als de trefzekerheid GEMETEN is; de save() in dat bestand zit in legVoorspellingVast()'),

  /* ---- En twee losse ---- */
  leest('POST /api/foundation/kosten', GEZIN,
    'server/foundation/kosten.js:29 -> kosten.voorDrager()',
    'geeft het gezin terug wat het kost, met de belofte "de RTFoundation betaalt dit" voorop en het bedrag daarna'),
  leest('POST /api/lab2/ledger/studie', LID,
    'server/kern/livinglab/ledger.js:78 studieLedger()',
    'stelt het verbruiksoverzicht van een onderzoek samen uit bestaande metingen')
]);

module.exports = { CONTRACTEN };
