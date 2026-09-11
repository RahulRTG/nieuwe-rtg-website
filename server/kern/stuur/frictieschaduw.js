/* WAT DE FRICTIEMOTOR ZOU HEBBEN VERZWAARD -- geteld, en nog zonder te bijten.

   WAAROM DIT ER IS. kern/stuur/beleid.js beantwoordt "mag de AI dit pad" uit een
   statische lijst plus de bodem (kern/frictie/bodem.js). Wat hij NIET doet is de
   frictieMOTOR raadplegen, die per GEVAL rekent met bedrag, aantal,
   omkeerbaarheid en zekerheid. EXECUTIE.md noemt dat de resterende dubbele
   waarheid in de gezagsvraag.

   CONTROLPLANE.md zegt hoe zo'n koppeling hoort te beginnen: een nieuwe
   handhavingsregel loopt eerst mee zonder te blokkeren -- je kunt niet
   afdwingen wat nooit in de schaduw heeft gelopen. Deze module IS die schaduw.
   Hij beslist niets; ./beleid.js blijft de enige die het antwoord geeft.

   WAT DE SCHADUW WEL EN NIET KAN ZIEN, gemeten en niet beredeneerd
   (npm run frictiestuur). Met de grondslag op `lezen` (0 punten) blijft alleen
   de context over, en die is smaller dan hij lijkt:

     BEDRAG ALLEEN VERZWAART NOOIT. De bedragfactor loopt vast op 25 punten en
     `hoge zekerheid` trekt er 8 af, dus 25.000 euro EN 250.000 euro scoren
     allebei 17 -- onder de autogrens van 30. Wie hier een bedragdrempel
     verwacht, krijgt hem niet.

     BEDRAG EN AANTAL SAMEN VERZWAREN WEL. 25.000 euro plus 500 objecten is
     25 + 25 - 8 = 42, en dat is `assist`. Dat is de enige vorm die deze schaduw
     uit een body kan halen, en het is een echte: een bulkhandeling met een groot
     bedrag hoort een mens te passeren.

   DE EERSTE VERSIE VAN DEZE KOP BEWEERDE DAT HIJ ALTIJD NUL ZOU METEN, en dat
   was fout -- de meting vond het geval hierboven. Dat staat er als waarschuwing:
   twee factoren die elk onder de grens blijven, kunnen er samen overheen.

   WAT ER ONTBREEKT EN DE UITSLAG BEPAALT. De motor heeft twee ingangen en het
   stuur kent er anderhalf. De GRONDSLAG bestaat niet: de tabel in
   kern/frictie/motor.js is met zoveel woorden "de acties die Command kent",
   zestien namen, en er is geen afbeelding van een AI-route op een daarvan. Er
   een verzinnen zou de fout van de cap `rooms` zijn. En drie contextvlaggen die
   zwaar wegen -- `onomkeerbaar`, `persoonsgegevens`, `klantImpact` -- zijn
   eigenschappen van de HANDELING en staan niet in een verzoek. Een lage telling
   hier is daarom geen geruststelling.

   WAAROM HIJ NIET kern/stuur/schaduwtelling.js HERGEBRUIKT. Die telt hetzelfde
   VORM (wereld|pad -> gewogen/zouSluiten) maar over een ander ONDERWERP: wat de
   herkomstpoort zou hebben gesloten. Zijn `stand()` draagt die uitleg in zijn
   tekst. Eén meter die twee vragen beantwoordt, vertelt over geen van beide de
   waarheid. Komt er een derde schaduw, dan hoort het tellen eruit getrokken te
   worden -- bij twee is dat nog geen laag.

   HIJ WORDT LUI GELADEN, EN DAT IS GEMETEN EN GEEN VOORKEUR. De aanroep in
   kern/stuur.js staat als `schaduw().noteer(...)` met een require BINNEN de
   functie. Stond die require bovenaan stuur.js, dan laadde kern/frictie/ bij het
   BEDRADEN van de server, en dat verschoof de opstarttiming genoeg om
   test/ledenschermen.e2e.js te laten zakken -- groen op main, rood op deze tak,
   in CI en lokaal allebei, en met de require eruit weer groen.

   Die toets is daar zelf broos: `toon()` WACHT tot de terugvaltekst
   "Magnaat Test" verschijnt en legt de paginatekst pas daarna vast, terwijl de
   pagina die terugval intussen vervangt door de naam van de actieve missie.
   Elke timingverandering kan hem kantelen, en hij is ook zonder deze module
   niet altijd groen. Dat is niet hier op te lossen; wat hier wel geldt is dat
   deze schaduw geen millimeter aan het opstarten hoort te verschuiven -- hij
   wordt alleen bij een AI-verzoek gebruikt, en een schermtoets komt daar nooit
   langs. test/frictieschaduw.test.js houdt vast dat de require niet terugkruipt.

   TELLERS EN GEEN JOURNAAL, zoals kern/kosten/: voor deze vraag is niet nodig
   wie wat vroeg, alleen hoe vaak. */
'use strict';

const { maakFrictie, NIVEAUS: FRICTIE } = require('../frictie');
const { NIVEAUS } = require('./beleid');

/* De vier beleidssleutels die de motor leest, hebben alle vier een
   standaardwaarde. Het stuur heeft het beleidsregister van de boardroom niet in
   zijn tas (maakStuur krijgt log, anthropic, app, crypto, isolatie), dus de
   schaduw rekent met die standaarden -- EN ZEGT DAT. Wie de grenzen in de
   boardroom aanscherpt, ziet dat hier niet terug; dan telt deze schaduw te laag.
   Een aanroeper die het echte register wel heeft, mag het meegeven. */
const STANDAARDGRENZEN = Object.freeze({ getal: (s, d) => d, waarde: (s, d) => d });

/* WELKE VELDEN EEN BEDRAG DRAGEN, EN WELKE NIET GELEZEN WORDEN.

   Alleen velden waarvan de EENHEID in de naam staat. `bedrag` en `amount` zijn
   met opzet uitgesloten: COMMERCE.md heeft precies daar een fout op gemeten --
   `bedrag` in kern/mall/aanbod.js staat in EURO'S en niet in centen. Een veld
   waarvan de eenheid onbekend is, wordt geteld als onbekend en NOOIT omgerekend;
   stilletjes maal honderd doen is de vorm die REIZEN.md verbiedt (een ingelezen
   waarde wordt nooit stilletjes verbeterd). */
const CENTVELDEN = Object.freeze(['centen', 'bedragCenten', 'amountCents', 'bedragInCenten']);
const EENHEIDLOOS = Object.freeze(['bedrag', 'amount', 'prijs', 'price', 'totaal']);

function contextUit(body) {
  const b = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
  const ctx = {};
  const gevonden = [];
  const eenheidOnbekend = [];

  for (const veld of CENTVELDEN) {
    const v = Number(b[veld]);
    if (Number.isFinite(v) && v > 0) { ctx.centen = v; gevonden.push(veld); break; }
  }
  for (const veld of EENHEIDLOOS) {
    if (b[veld] != null && Number.isFinite(Number(b[veld]))) eenheidOnbekend.push(veld);
  }

  /* Het aantal geraakte objecten: een expliciet veld, of de lengte van de
     langste lijst in de body. Dat tweede is een ONDERgrens en geen telling --
     een verzoek dat een bereik meegeeft ("alles van deze maand") raakt er meer
     dan er in de body staan. */
  const expliciet = Number(b.aantal);
  if (Number.isFinite(expliciet) && expliciet > 0) { ctx.aantal = expliciet; gevonden.push('aantal'); }
  else {
    let langste = 0;
    for (const w of Object.values(b)) if (Array.isArray(w) && w.length > langste) langste = w.length;
    if (langste > 1) { ctx.aantal = langste; gevonden.push('lijstlengte'); }
  }
  return { ctx, gevonden, eenheidOnbekend };
}

/* De afbeelding van de frictieschaal op die van het stuur. Hij staat al in
   ./beleid.js voor de BODEM en luidt daar hetzelfde; hier gaat het om de MOTOR.
   Alleen verzwaren: `auto` verandert nooit iets. */
function naarStuurniveau(frictieNiveau) {
  if (frictieNiveau === FRICTIE.hand) return NIVEAUS.verboden;
  if (frictieNiveau === FRICTIE.assist) return NIVEAUS.voorstel;
  return null;
}

const ZWAARTE = Object.freeze({ lezen: 1, klein: 2, voorstel: 3, verboden: 4 });

function maakSchaduw(opties) {
  const grenzen = (opties && opties.beleid) || STANDAARDGRENZEN;
  const eigenGrenzen = !!(opties && opties.beleid);
  const frictie = maakFrictie({ beleid: grenzen });

  /* Zou de motor dit zwaarder maken dan de allowlist al deed?

     DE GRONDSLAG WORDT NIET GERADEN. Het stuur kent een PAD, en de tabel in
     kern/frictie/motor.js kent zestien HANDELINGEN uit Command. Er is geen
     afbeelding, dus gaat er `lezen` in (0 punten) en meet dit uitsluitend wat de
     CONTEXT toevoegt. Dat is meteen het juiste onderscheid: het grondrisico van
     het pad zit al in de statische lijst van ./beleid.js, en er een geraden
     grondslag bovenop leggen zou het dubbel tellen. */
  function weeg(huidigNiveau, body) {
    const { ctx, gevonden, eenheidOnbekend } = contextUit(body);
    const oordeel = frictie.beoordeel('lezen', ctx);
    const zou = naarStuurniveau(oordeel.niveau);
    const zwaarder = zou != null && (ZWAARTE[zou] || 0) > (ZWAARTE[huidigNiveau] || 0);
    return {
      zouVerzwaren: zwaarder,
      van: huidigNiveau,
      naar: zwaarder ? zou : huidigNiveau,
      score: oordeel.score,
      opbouw: oordeel.opbouw,
      gevonden,
      eenheidOnbekend
    };
  }

  return { weeg };
}

/* ---- de telling woont ernaast ----

   ./frictieschaduw-telling.js draagt de tellers. Hij wordt hier doorgegeven en
   niet overgeschreven: één plek waar `noteer` woont, zodat een aanroeper deze
   module kan blijven gebruiken en er geen tweede teller ontstaat. */
const telling = require('./frictieschaduw-telling');

module.exports = { maakSchaduw, contextUit, naarStuurniveau,
  noteer: telling.noteer, stand: telling.stand, vergeet: telling.vergeet,
  meldGrenzen: telling.meldGrenzen,
  CENTVELDEN, EENHEIDLOOS, STANDAARDGRENZEN };
