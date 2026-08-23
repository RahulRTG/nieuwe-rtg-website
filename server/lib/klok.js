/* ============================================================================
   DE KLOK -- één plek waar dit huis weet hoe laat het is.

   WAAROM DIT ER IS. Tijd veroorzaakt een fout die geen enkele toets hier kan
   vinden, en de reden is simpel: er is niets om aan te draaien. Op de dag dat
   dit bestand werd geschreven stonden er 1313 directe tijdsaanroepen in
   server/ -- 736 keer `new Date()` en 577 keer `Date.now()` -- verspreid over
   667 bestanden. Elk daarvan vraagt het aan het besturingssysteem, en het
   besturingssysteem zegt altijd de waarheid.

   Daardoor is een hele klasse vragen onbeantwoordbaar:

     wat gebeurt er op 29 februari?
     wat doet een reservering die middernacht passeert?
     wat ziet iemand die vandaag precies 18 wordt?
     wat doet een betaalmandaat dat gisteren verliep?
     loopt de boekhouding goed over de jaarwisseling?

   Die vragen zijn niet te stellen zolang tijd overal apart wordt opgehaald. Dus
   komt er één plek, en die is te verzetten.

   HOE. Zonder RTG_KLOK doet deze module exact wat de standaardaanroepen doen --
   dezelfde waarde, geen omweg, geen kosten. Met RTG_KLOK verschuift hij:

     RTG_KLOK=2028-02-29T12:00:00Z    een vast moment (schrikkeldag)
     RTG_KLOK=+17m                     zeventien minuten vooruit
     RTG_KLOK=-1u                      een uur terug (zomertijd achteruit)
     RTG_KLOK=+10j                     tien jaar vooruit (de 2038-proef)

   Eenheden zijn Nederlands en eenletterig: s, m, u, d, j. Een vast moment
   BEVRIEST de tijd niet -- hij loopt door vanaf dat punt. Bevriezen zou een heel
   andere proef zijn: dan kun je niet meten of iets een timeout haalt.

   WAAROM HIJ IN PRODUCTIE WEIGERT. Een verzette klok in productie is geen proef
   maar een storing: sessies verlopen te vroeg of nooit, facturen krijgen een
   verkeerde datum, en het auditlog liegt over wanneer iets gebeurde. Deze module
   gooit daarom bij het laden als RTG_KLOK gezet is terwijl NODE_ENV production
   is. Hard en meteen, want een klok die pas bij de eerste factuur opvalt, is de
   duurste variant.

   WAT DIT NOG NIET IS, en dat hoort erbij: de 1313 aanroepen zijn hiermee niet
   verplaatst. Dit bestand maakt het MOGELIJK; scripts/klok.js telt wat er nog
   staat en KLOK.json houdt dat getal een kant op. Een module die de klok niet
   gebruikt, is met RTG_KLOK gewoon niet te verzetten -- dat is geen verborgen
   fout maar een gemeten schuld.
   ========================================================================== */
'use strict';

const EENHEDEN = { s: 1000, m: 60000, u: 3600000, d: 86400000, j: 31536000000 };

/* De verschuiving in milliseconden, of een absoluut beginpunt. Losse functie,
   want een instelling die je alleen via een draaiende server kunt nakijken,
   kijkt niemand na. */
function lees(ruw) {
  const tekst = String(ruw == null ? '' : ruw).trim();
  if (!tekst) return { soort: 'uit', ms: 0 };

  /* Relatief: +17m, -1u, +10j. Het teken is verplicht -- "17m" laat in het
     midden of je vooruit of achteruit wilt, en raden hoort hier niet. */
  const rel = tekst.match(/^([+-])(\d+)([smudj])$/);
  if (rel) {
    const ms = Number(rel[2]) * EENHEDEN[rel[3]];
    return { soort: 'verschoven', ms: rel[1] === '-' ? -ms : ms };
  }

  /* Absoluut: een moment waar Date iets van maakt. De tijd loopt daarna gewoon
     door; we onthouden het VERSCHIL en niet het moment zelf. */
  const t = Date.parse(tekst);
  if (!Number.isNaN(t)) return { soort: 'gezet', ms: t - Date.now(), naar: tekst };

  return { soort: 'onleesbaar', ms: 0, ruw: tekst };
}

/* Eenmalig bij het laden, zodat een verzette klok niet halverwege een verzoek
   van waarde verandert -- dat zou een fout opleveren die niemand kan navertellen. */
const INSTELLING = lees(process.env.RTG_KLOK);

if (INSTELLING.soort === 'onleesbaar') {
  throw new Error('RTG_KLOK is niet te lezen: "' + INSTELLING.ruw +
    '". Gebruik een moment (2028-02-29T12:00:00Z) of een verschuiving (+17m, -1u, +10j; s/m/u/d/j).');
}
if (INSTELLING.soort !== 'uit' && process.env.NODE_ENV === 'production') {
  throw new Error('RTG_KLOK staat aan in productie. Een verzette klok is daar geen proef ' +
    'maar een storing: sessies, facturen en het auditlog gaan er allemaal op af. Zet hem uit.');
}

const VERSCHUIVING = INSTELLING.ms;

/* De twee die alles vervangen. Bewust twee en niet één: een aanroeper die een
   getal wil, hoort geen Date te krijgen die hij daarna weer omrekent. */
const nu = VERSCHUIVING === 0 ? () => Date.now() : () => Date.now() + VERSCHUIVING;
const datum = VERSCHUIVING === 0 ? () => new Date() : () => new Date(Date.now() + VERSCHUIVING);

/* ---------- DE MONOTONE KLOK: voor DUUR, niet voor DATUM ----------

   TWEE KLOKKEN, EN DAT IS GEEN LUXE. `nu()` en `datum()` hierboven zeggen HOE
   LAAT het is. Deze zegt HOE LANG iets duurt. Dat lijkt hetzelfde en is het niet,
   en het verschil is een foutklasse die met de wandklok niet te vermijden is.

   De wandklok kan namelijk ACHTERUIT. Bij een NTP-correctie, bij de overgang
   naar wintertijd, en hier ook bij RTG_KLOK=-1u. Elke duur die als
   `Date.now() - t0` is uitgerekend wordt op dat moment kleiner, of negatief:

     een timeout van 30 seconden verloopt nooit meer, of meteen
     een failback-venster van vijf minuten springt open of dicht
     een uptime van drie dagen wordt min een uur
     een rate limiter geeft iedereen weer een volle emmer

   Er staan op dit moment 101 plekken in server/ die een duur op de wandklok
   uitrekenen. Niet allemaal fout -- "zeven dagen geleden" hoort juist een DATUM
   te zijn -- maar wie een timeout of een venster meet, hoort hier te zijn.

   `sinds()` telt milliseconden vanaf het begin van dit proces en kan per
   definitie niet achteruit. Hij is met opzet NIET door RTG_KLOK te verzetten:
   dat is geen omissie maar de hele eigenschap. Een verzette wandklok hoort een
   verlopen mandaat te kunnen laten zien; hij hoort een timeout van dertig
   seconden niet stiekem te veranderen. Wie beide verzet, toetst niets meer --
   dan meet de proef zijn eigen instelling.

   Waarom performance.now() en niet process.hrtime(): dezelfde monotone bron,
   maar meteen in milliseconden als getal. hrtime geeft bigint-nanoseconden en
   die moeten overal weer omgerekend worden -- drie omrekeningen verderop staat
   er dan alsnog een afrondingsfout in een venster.

   Handhaver: test/klok.test.js -- met RTG_KLOK=-1u loopt de wandklok een uur
   terug terwijl deze gewoon dooretelt. */
const sinds = () => performance.now();

/* Hoeveel tijd is er verstreken sinds een eerder `sinds()`-merk. Bestaat apart
   zodat een aanroeper niet zelf hoeft af te trekken: `Date.now() - t0` is
   precies de vorm die we hier weg willen hebben, en `sinds() - t0` leest er nog
   steeds als. `verstreken(t0)` zegt wat het is. */
const verstreken = (merk) => performance.now() - merk;

/* Voor logs en voor de schermtoets: staat er iets scheef, en hoeveel. */
const verschoven = () => VERSCHUIVING !== 0;
const uitleg = () => (VERSCHUIVING === 0 ? 'de klok loopt gelijk'
  : 'de klok staat ' + (VERSCHUIVING > 0 ? 'vooruit' : 'achter') + ' met ' +
    Math.abs(Math.round(VERSCHUIVING / 1000)) + ' seconden' +
    (INSTELLING.naar ? ' (gezet op ' + INSTELLING.naar + ')' : ''));

const CONTROL = {
  control: 'TIJD-KLOK',
  wat: 'tijdgebonden beslissingen zijn te beproeven op een verzette klok',
  eigenaar: 'Techniek',
  bewijs: ['test/klok.test.js'],
  bewijsstuk: 'KLOK.json -- hoeveel code nog buiten de tijdmachine staat',
  dekking: { register: 'KLOK.json', beproefd: 'gemeten.modulesOpDeKlok',
    totaal: 'gemeten.bestanden', eenheid: 'modules die de tijd vragen',
    tellers: { directeTijdsaanroepen: 'gemeten.totaal' } },
  grens: 'alleen code die DEZE klok gebruikt is te verzetten. KLOK.json staat op 1294 ' +
    'directe tijdsaanroepen: een tijdproef bewijst dus iets over de modules op de klok, ' +
    'niet over de hele server.'
};

module.exports = { nu, datum, sinds, verstreken, verschoven, uitleg, lees, EENHEDEN, CONTROL };
