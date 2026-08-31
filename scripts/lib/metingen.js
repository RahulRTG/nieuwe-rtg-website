/* WELKE METING HANGT AAN WELKE RATEL.

   De ratel in NORM.json bewaakt 28 meters. Dat klinkt als veel tot je telt hoe
   veel er in dit huis GEMETEN wordt: 22 meetbestanden in de wortel, elk met
   getallen erin, en het merendeel daarvan hangt aan niets. Zo'n bestand groeit
   dan stilletjes de verkeerde kant op zonder dat er iemand klaagt -- niet omdat
   er een tand brak, maar omdat er nooit een tand was.

   Dit register is de inventaris die dat zichtbaar maakt. Elk meetbestand zegt
   hier waar zijn ratel woont, in een van twee vormen:

     meter: [...]        de getallen komen terecht in NORM.json onder deze
                         sleutels. NA TE TREKKEN: die sleutels moeten bestaan in
                         de geratelde verzameling, anders telt de regel niet mee.

     eigenRatel: '...'   het bestand draagt zijn eigen grondwaarde en het
                         genoemde bestand vergelijkt ertegen. NA TE TREKKEN: dat
                         bestand moet bestaan en dit meetbestand noemen.

   WAT HIER NIET MACHINAAL TE CONTROLEREN IS, en dat hoort erbij te staan: of
   een `eigenRatel` bij een verslechtering ook werkelijk ZAKT. Dat het genoemde
   bestand de meting noemt is te zien; dat het er ook op afketst is mensenwerk
   (LAT.md regel 2 -- draai de verbetering terug en kijk of de juiste toets
   zakt). Een regel zonder handhaver is een voornemen, en deze helft is er een.

   WAT ER BEWUST NIET IN STAAT. Het register is niet bedoeld om vol te raken met
   beweringen. Een meetbestand waarvan je niet weet welke ratel hem vasthoudt,
   hoort hier NIET met een gok in te komen -- dan telt hij mee in
   `metingenZonderRatel`, en dat is precies wat die meter moet laten zien. Het
   getal hoort te dalen doordat er ratels bijkomen, niet doordat er regels
   bijkomen. */
'use strict';

/* Gegevens, geen meting. Deze bestanden dragen geen getal dat beter of slechter
   kan worden; ze staan hier zodat niemand ze per ongeluk als gat telt. */
const GEEN_METING = new Set([
  'package.json', 'package-lock.json',
  'NORM.json',              // de ratel zelf; die wordt door normverval.js bewaakt
  'LANDEN.json',            // landpakketten: welke munt, welke voertaal -- gegevens
  /* SUITEDUUR.json draagt hoe lang elk toetsbestand duurde. Dat is een
     PLANNINGSgetal en geen kwaliteitsgetal: een toets die langzamer wordt is
     niet slechter, en een die sneller wordt niet beter. Het bestand voedt de
     verdeling over de scherven (scripts/scherf.js); wordt het gewist, dan is de
     verdeling een ronde lang onhandig en verder niets. */
  'SUITEDUUR.json'
]);

const REGISTER = {
  'BEPROEVING.json': { meter: ['p99Ms', 'doorvoerPerSec', 'eventLoopP99Ms', 'herstelSeconden', 'geheugenHellingMBPerMin'] },
  'MUTATIES.json': { meter: ['toetsenOngevoeligPct', 'toetsenNietGemeten'] },
  'GRENZEN.json': { meter: ['kernBreedte', 'kernGedeeld', 'kernBreedsteBestand', 'kernOngebruikt'] },
  'WETTEN.json': { meter: ['wettenOnbewezen'] },
  'LADDER.json': { meter: ['ladderRaak', 'ladderNietGeprobeerd'] },
  'ROLRONDE.json': { meter: ['rolscheidingGaten', 'rolscheidingGemeten'] },
  'GLUURRONDE.json': { meter: ['gluurGaten', 'gluurGecontroleerd'] },

  /* Deze vier dragen hun eigen grondwaarde. De ratel staat in het genoemde
     bestand en niet in NORM.json -- dat is geen tekortkoming maar een keuze:
     een matrix met honderden vakjes hoort niet als een getal in de norm. */
  /* De twee metingen van de tikkenronde (TIKKEN.md). Allebei dragen ze hun
     grondwaarde zelf -- vijf tikken en een uitgeschreven reden voor wat er
     buiten valt, en een vloer van 60% voor de vindbaarheid -- en allebei worden
     ze door test/sprongindex.test.js in controlestand gedraaid. Die toets noemt
     ze bij naam, dus de bewering is na te trekken en niet alleen opgeschreven. */
  /* DE REGISTERS VAN DE UITVOERINGSLAAG (EXECUTIE.md). Zij hingen aan geen
     enkele ratel, en dat was geen detail: zes metingen waarvan niemand zou zien
     dat ze zakken. Elk draagt nu zijn grondwaarde in de genoemde toets --
     dekking, bewezen paren, besloten treden -- en niet in NORM.json, want dit
     zijn lijsten en geen enkelvoudige getallen. */
  'RESOLVERBEREIK.json': { eigenRatel: 'test/resolverbereik.test.js' },
  'GEZAGSNOEMER.json': { eigenRatel: 'test/gezagsnoemer.test.js' },
  'EXECUTION_MAP.json': { eigenRatel: 'test/executionmap.test.js' },
  'HERSTEL.json': { eigenRatel: 'test/herstel.test.js' },
  'HERSTELPROEF.json': { eigenRatel: 'test/herstelproef.test.js' },
  'DROOGLOOP.json': { eigenRatel: 'test/droogloop.test.js' },

  'TIKKEN.json': { eigenRatel: 'test/sprongindex.test.js' },
  'VINDBAAR.json': { eigenRatel: 'test/sprongindex.test.js' },
  'BEWIJSMATRIX.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'IDEMPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'INVOERPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'KETENS.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'POORTWACHT.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'ROLPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'STAATPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },

  /* De bedradingsgraaf draagt zijn eigen grondwaarde en wordt door
     keuringsregel 59 vastgehouden: het aantal ONBEKENDE kanten mag alleen
     krimpen, en voor identity, money en security is de eis nul. Dat getal hoort
     niet in NORM.json thuis -- het is geen kwaliteitscijfer over de code maar de
     grens van wat deze graaf op dit moment veilig kan bewijzen. */
  /* DE MUTATIECONTRACTRONDE (augustus 2026), vier meetbestanden met een ratel.

     Alle vier worden ze bij naam gelezen door de toets die ze vasthoudt, en die
     toets zakt ook echt: de LEGACY-grens staat op NUL (test/mutatiecontract.test.js
     regel 185), de afgeleide lijst mag geen route delen met de menselijke, en de
     twee inventarissen moeten hetzelfde totaal tellen. Keuringsregel 64 van
     scripts/check.js houdt MUTATIECONTRACT.json daarnaast tegen de code aan. */
  'MUTATIECONTRACT.json': { eigenRatel: 'test/mutatiecontract.test.js' },
  'MUTATIECONTRACT-AFGELEID.json': { eigenRatel: 'test/mutatiecontract.test.js' },
  'MUTATIEINVENTARIS.json': { eigenRatel: 'test/mutatiecontract.test.js' },
  'HANDLERBEWAKERS.json': { eigenRatel: 'test/handlerpoorten.test.js' },

  'BEDRADING.json': { eigenRatel: 'scripts/check.js' },
  'UITVOERPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'KLOK.json': { eigenRatel: 'scripts/klok.js' },
  /* De a11y-grens draagt zijn eigen nul: scripts/a11y.js LEEST de grens hieruit
     en zakt erop (exit 1), en scripts/raakvlakkeuring.js hangt zijn getal aan
     hetzelfde register. Twee metingen, een ratel. */
  'A11Y-INGELOGD.json': { eigenRatel: 'scripts/a11y.js' },
  'SABOTAGE.json': { eigenRatel: 'scripts/wetten.js' },

  /* En twee die door een TOETS worden vastgehouden in plaats van door een
     script. Allebei zeggen het in hun eigen uitleg met zoveel woorden: "MAG
     ALLEEN KRIMPEN". Dat is een ratel, ook al staat hij niet in NORM.json. */
  'BEREIK.json': { eigenRatel: 'test/bereikbaar.test.js' },
  'SCHERMLEUGEN.json': { eigenRatel: 'test/liegend-scherm.e2e.js' }
};

module.exports = { REGISTER, GEEN_METING };
