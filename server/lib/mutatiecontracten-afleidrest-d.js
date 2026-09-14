/* ============================================================================
   MUTATIECONTRACTEN -- DE VIJF DUBBELTIKKEN, NA DE REPARATIE.

   Deel van ./mutatiecontracten.js; zie de kop van ./mutatiecontracten-afleidrest.js
   voor waar de zevenenveertig vandaan komen.

   Deze vijf waren de enige van de zevenenveertig die GEMETEN onbeschermd waren.
   Het register zei het met zoveel woorden: "een woordelijk gelijke herhaling
   ZONDER sleutel deed het werk opnieuw -- dit is de dubbeltik". Dat is geen
   uitzondering die je vastlegt maar schuld die je betaalt, en daarom staan ze
   niet als INTENTIONALLY_NON_IDEMPOTENT in dit register: een tweede overstap van
   klas X naar klas X, een tweede klas met dezelfde naam en een tweede keer
   dezelfde bekendmaking zijn geen betekenisvolle tweede handelingen.

   DE REPARATIE is ./idemsleutels-afleidrest.js: vijf `zelfdeVerzoek`-verklaringen,
   per route met het lijfveld erbij dat bepaalt WAT er ontstaat.

   EN DE STAND KOMT PAS NA DE HERMETING. Een contract schrijven over een
   reparatie die alleen op papier bestaat is erger dan geen contract, dus is
   `npm run idemproef` opnieuw gedraaid over alle 4912 routes, op een schone boom
   (IDEMPROEF.json, stempel commit e1ca7557, boomVuil false).

   VIER DINGEN MOESTEN TEGELIJK WAAR ZIJN, en dat is strenger dan "geen tweede
   schrijfactie". Een poort die het tweede effect tegenhoudt maar daarna een
   fout, een leeg antwoord of een tweede id teruggeeft, is operationeel nog
   steeds stuk. Dus:

     1. de tweede kale oproep liet NIETS achter in de opslag   (opslag.e leeg)
     2. de proef noemt de route beschermd                      (stand)
     3. de grond is `gemerkt` en niet `gelijk`                 (grond)
     4. de tweede oproep gaf dezelfde HTTP-status als de eerste (statussen)

   Punt 3 is de scherpste. `gelijk` betekent dat het antwoord toevallig hetzelfde
   was; `gemerkt` betekent dat de idem-poort de herhaling zelf heeft onderschept,
   en server/lib/idem-poort.js:133 doet dan letterlijk
   `res.status(eerder.status).json(herhaal(eerder.lijf))` -- het OPGESLAGEN
   ORIGINELE antwoord, met `herhaald: true` erbij. Alleen die grond bewijst dat
   de aanroeper antwoord R terugkrijgt. En de poort bewaart alleen een GESLAAGD
   antwoord (2xx en niet `ok:false`), dus `gemerkt` kan nooit een fout herhalen.

   Alle vijf halen alle vier. test/afleidrest-dubbeltik.test.js houdt dat vast en
   is op alle vier de assertions met een mutatie nagetrokken.

   DE SEMANTIEK IS `sleutelVereist` EN NIET `idempotent`, en dat verschil is geen
   muggenzifterij: de handeling zelf is niet idempotent -- een tweede overstap IS
   een tweede regel in het dossier. Wat hem opvangt is de SLEUTEL, hier afgeleid
   uit de afdruk van het lijf in plaats van meegestuurd door de client. Dezelfde
   lezing als ./mutatiecontracten-kaleronde.js, waar het bewijs ook met zoveel
   woorden "na de reparatie" zegt.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), handler gelezen op 13 september 2026, gerepareerd in ' +
    './idemsleutels-afleidrest.js en daarna opnieuw gemeten; niet door een mens nagelezen',
  op: '2026-09-13'
};

const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
const LID = { klasse: 'AUTHENTICATED' };

const BEWIJS = {
  gemeten: 'kale ronde zonder sleutel NA de reparatie: de tweede oproep werd door de idem-poort ' +
    'opgevangen (herhaald: true) terwijl er geen sleutel was gestuurd -- dat kan alleen van de ' +
    'verklaring in lib/idemsleutels-afleidrest.js komen. Vier dingen tegelijk gemeten: de tweede ' +
    'oproep liet niets achter in de opslag, de stand is beschermd, de grond is `gemerkt` (en niet ' +
    '`gelijk`, dus het antwoord is HERHAALD en niet opnieuw berekend), en de status was bij allebei ' +
    'dezelfde. De eerste oproep veranderde wel degelijk iets -- de handeling gebeurt, alleen niet twee keer',
  op: '2026-09-13'
};

/* Wat er zonder de verklaring gebeurde staat per regel, want dat is waarop een
   volgende lezer moet controleren als de handler verandert. */
const gedicht = (route, toegang, veld, watTweeKeer) => [route, {
  mutatieId: route.replace(/^POST \/api\//, '').replace(/\//g, '.'),
  herkomst: 'mens',
  semantiek: { klasse: 'sleutelVereist' },
  toegang,
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  nagekeken: 'met de hand, 2026-09-13: zonder de verklaring ' + watTweeKeer + '. De identiteit van ' +
    'het verzoek zit in ' + veld + '; dat is het veld waarop een volgende lezer moet controleren als ' +
    'de handler verandert',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  gedicht('POST /api/foundation/school/leerling/overstap', SCHOOL, 'leerlingId + naarKlas',
    'kreeg l.overstappen er een regel bij die "van klas X naar klas X" leest, want de eerste oproep ' +
    'had de leerling al verplaatst -- een verzonnen regel in een overstapgeschiedenis is erger dan ' +
    'een ontbrekende (server/school/inschrijving-mutatie.js:40)'),
  gedicht('POST /api/foundation/school/leraar/klas/maak', SCHOOL, 'naam + fase',
    'gaf klasCode() elke aanroep een verse code, dus twee keer drukken was twee klassen met dezelfde ' +
    'naam (server/school/beheer.js:129)'),
  gedicht('POST /api/foundation/school/dossier/contact', SCHOOL, 'leerlingId + contact',
    'werden de contactgegevens HEEL overschreven -- op zichzelf idempotent -- maar zette log() elke ' +
    'keer een journaalregel "contact-gewijzigd": twee regels voor een wijziging die een keer gebeurde ' +
    '(server/school/dossier.js:68)'),
  gedicht('POST /api/foundation/school/zorg/zet', SCHOOL, 'leerlingId + doel/notitie',
    'liep log() altijd, en kwam er met `doel` of `notitie` erbij een verse id per aanroep in het plan: ' +
    'hetzelfde leerdoel twee keer (server/school/zorg.js:29)'),
  gedicht('POST /api/gemeente/bekendmaking', LID, 'titel + tekst',
    'groeide gemeenteBekend met een per aanroep via unshift met een verse id(): dezelfde bekendmaking ' +
    'twee keer gepubliceerd (server/kern/gemeente/info.js:109)')
]);

module.exports = { CONTRACTEN };
