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
  /* TOETSDUUR.json draagt hoe lang elk toetsbestand duurde. Dat is een
     PLANNINGSgetal en geen kwaliteitsgetal: een toets die langzamer wordt is
     niet slechter, en een die sneller wordt niet beter. Het bestand voedt de
     verdeling over de scherven (scripts/lib/delen.js); wordt het gewist, dan is
     de verdeling een ronde lang onhandig en verder niets.

     HIER STOND SUITEDUUR.json, met scripts/scherf.js als lezer. Dat script
     stond tot 28 augustus 2026 in ci.yml en is toen vervangen door
     `npm run test:deel`; de weging bleef daarbij liggen en het script en zijn
     register bleven als dode tak achter. Ze zijn op 1 september 2026 opgeruimd
     en de weging is in delen.js hersteld -- twee verdelers met elk een eigen
     duurregister is LAT.md regel 4 op de plek waar hij het duurst is. */
  'TOETSDUUR.json',
  /* BEWIJSKOSTEN.json is een MOMENTOPNAME over een BEREIK (zie EIGENAAR in
     scripts/lib/registereigenaar.js). Een ratel eroverheen zou verbeteren door
     het bereik te verkleinen -- meet een tak van drie commits en elk getal is
     laag -- en dat is exact de faalvorm waar `afgeleidMetEigenaar` en
     `stilLezingBereik` voor bestaan. Wat hem wel bewaakt is
     test/bewijskosten.test.js: dat de twee helften (gemeten, verklaard) elkaar
     nooit raken, en dat een versterkingsfactor zonder noemer ONBEPAALD blijft.

     De tand die hier WEL hoort te komen -- mensVersterking naar nul -- vraagt
     eerst een STABIEL bereik, en dat is een besluit en geen bouwtaak. */
  'BEWIJSKOSTEN.json',
  /* SCHERFMETER.json rapporteert vier getallen over de scherfverdeling (balans,
     churn, ongemeten, prijsbron). Drie ervan HOREN geen ratel te hebben: churn
     hangt af van hoeveel toetsen er sinds de vorige vastlegging bij kwamen,
     balans beweegt met de echte duren mee, en prijsbron is een indeling en geen
     getal. Een ratel daarop staat rood van gewoon werk.

     Het vierde, `ongemeten`, is wel een goede kandidaat en staat er met opzet
     nog niet aan: dat zou elke tak die een toetsbestand toevoegt rood zetten tot
     de auteur de volle suite heeft gedraaid, en dat is een beleidsbesluit over
     andermans werk. De stand staat in SCHERFMETER.json zelf onder
     `meters.ongemeten` en niet hier -- een getal in een commentaar veroudert
     stiller dan waar ook. Zie de kop van scripts/scherfmeter.js voor het besluit
     dat daarover openstaat. */
  'SCHERFMETER.json',
  /* CORRECTIES.json zet getallen recht die in een PERMANENT artefact staan --
     een commitboodschap, een PR-bericht. Geen meting en geen kwaliteitsgetal: het
     hoort te GROEIEN naarmate er meer wordt rechtgezet, en een ratel erop zou
     precies het rechtzetten bestraffen. */
  'CORRECTIES.json',
  /* HERREKENBAAR.json is een register van BESLUITEN en geen meting: het zegt per
     route waarom een verloren schrijfactie zichzelf herstelt. Daar zit geen getal
     in dat beter of slechter kan worden -- het aantal verklaringen hoort te
     groeien naarmate er meer is uitgezocht, en een ratel zou juist het uitzoeken
     bestraffen. De METING ernaast (FAALPROEF.json) hangt wel aan een tand
     (faalproefGezakt), en die blijft onverkort tellen: het besluit drukt de
     meting niet weg.

     IDEMBESLUIT.json is hetzelfde soort bestand en staat vandaag in GEEN van
     beide lijsten, en telt dus mee in `metingenZonderRatel`. Dat hier rechtzetten
     zou die tand verschuiven, en dat is een apart besluit -- het staat genoteerd
     en niet stilletjes meegenomen. */
  'HERREKENBAAR.json'
]);

const REGISTER = {
  'LANGUAGECAPABILITY.json': { eigenRatel: 'scripts/language-proof.js' },
  'MEANINGPARITY.json': { eigenRatel: 'scripts/language-proof.js' },
  'LANGUAGEFAILOVER.json': { eigenRatel: 'scripts/language-proof.js' },
  'LAATSPOOR.json': { meter: ['laatSpoorVerdacht'] },
  'ROLLBACKBESLUIT.json': { meter: ['rollbackUitzonderingen'] },
  'FAALPROEF.json': { meter: ['faalproefGezakt'] },
  'LUSSEN.json': { meter: ['lussenGeenUitweg', 'lussenKritiek', 'lussenZonderOverlapRem'] },
  /* CARRIEREVORM.json meet of de talentdomeinen een datavorm delen (CARRIERE.md
     par. 0). De geratelde waarde is met opzet NIET de uitkomst maar het BEREIK:
     hoeveel domeinen de meter werkelijk heeft gezien. Een uitkomst die beweegt
     is nieuws en geen achteruitgang -- maar een meter die stil minder domeinen
     ziet (iemand hernoemt een map, de regex matcht niet meer) rapporteert
     dezelfde conclusie over minder bewijs, en dat is precies de faalvorm waar
     een ratel voor is. */
  'CARRIEREVORM.json': { meter: ['carriereDomeinenGemeten'] },
  /* AICONTEXT.json meet waar Rahul zijn ledencontext samenstelt en wat daar
     samenkomt (MENSNETWERK.md par. 4c). Twee tanden, en ze doen iets anders.

     `aiContextLek` is de INVARIANT: velden die een kantoorroute schrijft en die
     de samensteller ook leest. Nul, en dat hoort nul te blijven -- wat het
     kantoor over een lid vastlegt, gaat niet naar een modelaanbieder.

     `aiContextVeldenGezien` is het BEREIK, om dezelfde reden als bij
     CARRIEREVORM.json hierboven: de veldinventaris is lexicaal, dus een meter
     die stil minder velden ziet (iemand bindt de ledenstaat aan een nieuwe
     naam) meldt diezelfde nul over minder bewijs. Een lek van nul uit een meter
     die niets meer ziet, is de gevaarlijkste vorm van groen. */
  'AICONTEXT.json': { meter: ['aiContextLek', 'aiContextVeldenGezien'] },
  /* Het stilspoorregister draagt twee schulden en een bereikmeter. */
  'STILSPOOR.json': { meter: ['stilSpoor', 'stilleOpslag', 'stilSpoorAanroepen'] },
  /* MAGNAATGRONDWET.json (npm run magnaat:grondwet -- --vastleggen) is de
     bevroren nulstand van de Magnaat-grondwet (MAGNAAT.md). De ratel woont in
     de toets en is vierledig: niet meer schendingen, niet minder PASS of
     afgedwongen, en geen enkele regel die zakt. */
  'MAGNAATGRONDWET.json': { eigenRatel: 'test/magnaatgrondwet.test.js' },
  /* STEMPELVEILIGHEID.json (npm run stempelveiligheid) telt welke generatoren
     repo-waarheid kunnen wegschrijven die niemand heeft gevraagd. Twee schulden
     omlaag en een bereikmeter omhoog, om exact de reden die bij STILSPOOR.json
     en AICONTEXT.json hierboven staat: deze meter is LEXICAAL, dus wie hem stil
     minder laat zien, ziet zijn schuld dalen zonder dat er iets is gerepareerd.
     Een risicoklasse van nul uit een meter die geen schrijvers meer vindt, is de
     gevaarlijkste vorm van groen.

     `stempelInPoort` is de scherpste van de twee schulden en niet de grootste:
     hij telt alleen de doorsnede -- stempelt, grendelt niet, schrijft ongevraagd
     EN loopt mee in een commando dat een mens als controle leest. Dat is het
     incident van 15 september; de bredere klasse is een werklijst. */
  'STEMPELVEILIGHEID.json': { meter: ['stempelOngevraagd', 'stempelInPoort', 'stempelSchrijversGezien'] },
  /* ONLEESBAAR IS NIET AFWEZIG (STILLEZING.json, npm run stillezing) -- de
     spiegel van STILSPOOR hierboven. Die meet SCHRIJVERS wier falen wordt
     opgegeten; deze meet LEZERS die een kapot bewijs als een leeg bewijs
     behandelen, en alleen die tweede kan een poort laten opengaan. Vier tanden:
     twee schulden omlaag (en die worden NOOIT opgeteld -- in server/ staat er
     een handeling tegenover, in scripts/ een meting), het bereik omhoog, en het
     aantal lezers dat het onderscheid wel maakt omhoog. */
  'STILLEZING.json': { meter: ['stilLezing', 'stilLezingMeters', 'stilLezingBereik', 'bewijsOnderscheidt'] },
  /* WIE MAG DIT ARTEFACT OPNIEUW AFLEIDEN (AFGELEID.json, npm run afgeleid).
     Drie tanden: geen enkel AFGELEID artefact zonder canonieke eigenaar, de
     onbesliste stand omlaag, en de dekking omhoog. Die derde is niet optioneel:
     `onbeslist` daalt ook als het BEREIK krimpt, en dan leest een verdwenen
     generator als vooruitgang. */
  'AFGELEID.json': { meter: ['afgeleidZonderEigenaar', 'afgeleidOnbeslist', 'afgeleidMetEigenaar'] },
  /* DRAAIT DIE EIGENAAR OOK WERKELIJK HETZELFDE UIT (HERBOUWPROEF.json, npm run
     herbouwproef)? AFGELEID.json zegt wie de sleutel heeft; deze zegt of hij
     past. Twee tanden, en ze meten twee verschillende dingen: `herbouwVerschilt`
     is een DEFECT (de inhoud kwam anders terug -- of de generator is niet
     deterministisch, of het ingecheckte artefact loopt achter) en hoort op nul
     te blijven; `herbouwBewezen` is DEKKING en mag alleen groeien, anders leest
     een krimpende proef als vooruitgang. Wat er NIET komt is een tand op
     `nietGedraaid`: dat is een oordeel over de machine waarop de proef liep. */
  'HERBOUWPROEF.json': { meter: ['herbouwVerschilt', 'herbouwBewezen'] },
  /* IDEMIDENTITEIT.json (npm run idemidentiteit) beantwoordt wat na #269/#270
     overbleef: waar is de identiteit van een verzoek nog te smal? Drie tanden,
     een omhoog en twee omlaag -- zie de kop bij die tanden in ../norm.js. */
  'IDEMIDENTITEIT.json': { meter: ['idemVerklaard', 'idemAfdrukVoegtNietsToe', 'idemHandwerkGeenVergelijking'] },
  /* STAGEVORM.json meet of de publieke domeinen een datavorm delen (STAGE.md
     par. 0). Om dezelfde reden als bij CARRIEREVORM.json hierboven is de
     geratelde waarde het BEREIK en niet de uitkomst: dat er 0 velden gedeeld
     worden is de bevinding waar het document op staat, en een bevinding die
     beweegt is nieuws. Wat NIET mag bewegen is hoeveel publieke domeinen de
     meter heeft gezien -- zakt dat stil, dan daalt de gedeeldheid door een
     hernoemde map in plaats van door een feit, en leest de nul plotseling als
     bevestiging terwijl hij een blinde vlek is. */
  'STAGEVORM.json': { meter: ['stageDomeinenGemeten'] },
  /* PLANVORM.json meet of de plandomeinen een datavorm delen, en of ze de negen
     stations van de voorgestelde planningsketen uitvoeren. Om dezelfde reden
     als bij CARRIEREVORM.json en STAGEVORM.json hierboven is de geratelde
     waarde het BEREIK en niet de uitkomst: dat er 0 velden gedeeld worden is de
     bevinding waar het besluit op staat, en een bevinding die beweegt is nieuws.
     Wat NIET mag bewegen is hoeveel plandomeinen de meter heeft gezien -- zakt
     dat stil (iemand hernoemt kern/beveiliging/rooster/), dan daalt de
     gedeeldheid door een regex in plaats van door een feit, en leest de nul als
     bevestiging terwijl hij een blinde vlek is. */
  'PLANVORM.json': { meter: ['planDomeinenGemeten'] },
  /* OFFICEVORM.json meet of de elf objectdomeinen onder het voorgestelde
     `RTGObject` (OFFICE.md par. 0) een datavorm delen. Geratelde waarde: het
     BEREIK, om exact de reden van PLANVORM.json hierboven -- de uitkomst is een
     nul, en een nul over minder domeinen leest als bevestiging terwijl hij een
     blinde vlek is. */
  'OFFICEVORM.json': { meter: ['officeDomeinenGemeten'] },
  /* NEIGINGVORM.json meet of er een persoonlijke laag bij mag en in welke vorm
     (NEIGING.md par. 0). Twee geratelde waarden, en met opzet geen derde over de
     NAAMmeting: die telt sinds server/kern/neiging/ bestaat zijn eigen bestanden
     mee, dus een ratel daarop zou alleen maar meegroeien met het werk en niets
     bewaken.

     `neigingVerwijzingRot` bewaakt meting C: elk punt van het voorstel draagt
     een nagetrokken verwijzing naar bestaande code. Rot er een, dan is het
     document een bewering over het verleden geworden.

     `neigingVoorkeurBlind` bewaakt meting B, en hij gaat de andere kant op dan je
     zou verwachten: hij telt de BESTAANDE affiniteitsvormen zonder grond,
     zekerheid of verval. Deze laag slikt die veertien met opzet niet in (de
     Asset-les), dus het getal hoort te dalen doordat een domein zijn eigen
     voorkeuren etiketteert -- en nooit te stijgen doordat er ergens een
     ongeetiketteerde voorkeur bij komt. */
  'NEIGINGVORM.json': { meter: ['neigingVerwijzingRot', 'neigingVoorkeurBlind'] },
  /* NAMENSVORM.json meet of de manieren van namens-iemand-handelen een machine
     delen (REPRESENTATIE.md par. 0). Zelfde soort als STAGEVORM.json hierboven
     en om dezelfde reden is de geratelde waarde het BEREIK: de nullen zijn de
     bevinding waar het document op staat, en een bevinding die beweegt is
     nieuws -- maar hoeveel mechanismen de meter heeft NAGELOPEN mag niet stil
     dalen, want dan zakt de gedeeldheid door een hernoemd bestand in plaats van
     door een feit. */
  'NAMENSVORM.json': { meter: ['namensMechanismenGemeten'] },
  'SPOORVORM.json': { meter: ['spoorConvergent'] },
  /* Geen richting maar een ANKER: test/bedrijfsmaat.test.js eist nul verworpen
     citaten en nul vormfouten, en dat het register gelijk is aan een verse meting.
     Een maat die stil verdwijnt of een citaat dat niet meer klopt, laat hem zakken. */
  'BEDRIJFSMAAT.json': { eigenRatel: 'test/bedrijfsmaat.test.js' },
  /* CONNECTLUS.json meet of de ontdekkingsdomeinen de lus DELEN (CONNECT.md
     par. 1). Zelfde soort als CARRIEREVORM, STAGEVORM en NAMENSVORM hierboven,
     en om exact dezelfde reden is de geratelde waarde het BEREIK: dat er 0 van
     de acht werkwoorden in alle domeinen staan en dat maar twee domeinen de lus
     rond krijgen, is de bevinding waar kern/connect/ op rust -- en een bevinding
     die beweegt is nieuws. Wat niet stil mag bewegen is hoeveel domeinen de
     meter heeft gezien. Die faalvorm is hier geen theorie: scripts/carrierevorm.js
     sloeg bij een versmalling tot twee domeinen om van 0 naar 8 gedeelde velden,
     dus een meter die minder domeinen ziet meldt niet dezelfde nul maar een
     andere werkelijkheid, onder dezelfde naam. */
  'CONNECTLUS.json': { meter: ['connectDomeinenGemeten'] },
  /* WEKDEKKING.json zet het BESLUIT (welke brongebeurtenis mag de publieke rail
     op, scripts/lib/wekbesluit.js) naast de METING. Geratelde is
     `wekZonderUitspraak`: publieke domeinen waarover het besluitregister
     zwijgt. Die hoort op nul te staan en te blijven -- hij stijgt zodra er een
     publiek domein bijkomt waar niemand over heeft nagedacht, en dat is precies
     de stille groei die deze tand moet vangen. */
  'WEKDEKKING.json': { meter: ['wekZonderUitspraak'] },
  'BEPROEVING.json': { meter: ['p99Ms', 'doorvoerPerSec', 'eventLoopP99Ms', 'herstelSeconden', 'geheugenHellingMBPerMin'] },
  /* De ACTUELE meting naast de geaccepteerde basislijn hierboven: scripts/
     beproeving.js schrijft hem na ELKE ronde, ook een gezakte, zodat rood
     bewijs kan blijven staan. Hij voedt dezelfde prestatiemeters -- norm.js
     leest hem via prestatiePad() zodra hij bestaat -- en hangt dus aan
     dezelfde ratel, niet aan geen enkele. */
  'LAATSTE_METING.json': { meter: ['p99Ms', 'doorvoerPerSec', 'eventLoopP99Ms', 'herstelSeconden', 'geheugenHellingMBPerMin'] },
  'MUTATIES.json': { meter: ['toetsenOngevoeligPct', 'toetsenNietGemeten'] },
  'TAALKWALITEIT.json': { meter: ['taalPoortHoudtTegen', 'taalCellenVerkeerdSchrift', 'taalBetekenisOngemeten'] },
  'TAALSCHIL.json': { meter: ['taalSchilOffline'] },
  /* Het sprekersregister is de INVOER van taalBetekenisOngemeten: die meter
     daalt alleen doordat hier een oordeel bij komt. Het hangt dus aan dezelfde
     ratel, en niet aan geen enkele. */
  'TAALOORDEEL.json': { meter: ['taalBetekenisOngemeten'] },
  'GRENZEN.json': { meter: ['kernBreedte', 'kernGedeeld', 'kernBreedsteBestand', 'kernOngebruikt'] },
  'WETTEN.json': { meter: ['wettenOnbewezen'] },
  'LADDER.json': { meter: ['ladderRaak', 'ladderNietGeprobeerd'] },
  'ROLRONDE.json': { meter: ['rolscheidingGaten', 'rolscheidingGemeten'] },
  'GLUURRONDE.json': { meter: ['gluurGaten', 'gluurGecontroleerd'] },
  'VERSTRENGELING.json': { meter: ['verstrengelingOnverklaard'] },
  'BEWIJSLADDER.json': { meter: ['bewijsAlleenKeten'] },
  /* TWEE BESTANDEN, TWEE SOORTEN WAARHEID. De schuld is een WAARNEMING en hangt
     dus aan de ronde; de kennis volgt uit de code alleen en heeft zijn eigen
     tand, zodat een krimpende statische as niet ongemerkt kan wegzakken. */
  'VERANDERBEREIK-RONDE.json': { meter: ['veranderbereikZonderBereik'] },
  'VERANDERBEREIK-KENNIS.json': { meter: ['veranderbereikStatisch'] },
  'ACTIVERING.json': { meter: ['activeringOndergrens'] },
  'TREDEPROEF.json': { meter: ['tredeLekken', 'tredeRondgangGezakt', 'tredeIngangLekken'] },
  'WEKKERS.json': { meter: ['wekkersOnverklaard', 'wekkersFunctieUitToch', 'wekkersZonderTrede'] },
  'ZAAKWIG.json': { meter: ['zaakwigGezakt'] },
  /* DE EDGE (EDGE.md par. 7). De kaart draagt twee schulden; de dekking een
     schuld die op nul hoort te staan en negen veldtanden die alleen omhoog
     mogen. De vergelijking per scherm zit daarnaast in edgedekking.js zelf. */
  'EDGEKAART.json': { meter: ['edgeDubbeleEigenaars', 'rtgDodeKanalen'] },
  'EDGEDEKKING.json': { meter: ['edgeGeblokkeerdZonderWaarom', 'edgeVeldIdentiteit', 'edgeVeldWereld', 'edgeVeldContext',
    'edgeVeldObject', 'edgeVeldActiviteit', 'edgeVeldPresence', 'edgeVeldVoortzetting', 'edgeVeldHoofdactie', 'edgeVeldTrust'] },
  'MEETLEER.json': { meter: ['meetleerBlind'] },

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
  /* De twee isolatieregisters. De tand op ISOLATIESCHADUW.json is smal met
     opzet: `gewogen` mag nooit nul zijn. Dat is exact de regressie die hier is
     gevonden -- de poort woog NUL verzoeken van een lid met een stand, en er was
     niets dat klaagde. `zouSluiten` staat er bewust NIET in: dat beweegt mee met
     elke nieuwe route, en een tand die om vreemde redenen rammelt wordt
     weggeklikt. */
  'ISOLATIESCHADUW.json': { eigenRatel: 'test/isolatieregisters.test.js' },
  'ISOLATIEPROEF.json': { eigenRatel: 'test/isolatieregisters.test.js' },
  'RESOLVERBEREIK.json': { eigenRatel: 'test/resolverbereik.test.js' },
  /* De consolidatieronde (CLAUDE.md, SCHERMEIGENAAR.json). De toets meet VERS
     met scripts/schermfunctie.js en zakt op een overlappaar zonder oordeel, een
     menu-ingang op een alias en een link naar een alias; het aantal open
     oordelen mag er alleen dalen (OPEN_MAX). */
  'SCHERMFUNCTIE.json': { eigenRatel: 'test/schermeigenaar.test.js' },
  'SCHERMEIGENAAR.json': { eigenRatel: 'test/schermeigenaar.test.js' },
  'GEZAGSNOEMER.json': { eigenRatel: 'test/gezagsnoemer.test.js' },
  /* De Business Proof Map en de vierde gouden keten. Beide hangen aan
     test/ondernemerbewijs.test.js, en dat is geen regel-om-de-regel: die toets
     draagt twee echte tanden. De ene eist dat de ketenproef blijft SLUITEN
     (negen schakels dicht, geen gebroken storing); de andere legt een VLOER
     onder de route-dekking per bewijslaag, zodat een laag niet stilletjes
     terugzakt doordat een bron verouderde. Zonder die twee zou dit register
     een bewering zijn, en dat is precies wat de kop hierboven verbiedt. */
  'ONDERNEMERBEWIJS.json': { eigenRatel: 'test/ondernemerbewijs.test.js' },
  'ZAAKLIVEPROEF.json': { eigenRatel: 'test/ondernemerbewijs.test.js' },
  /* De geldketen heeft een EIGEN ratelbestand en niet die van de projectie.
     Reden: zijn twee tanden gaan over dingen die ONDERNEMERBEWIJS.json niet
     kent -- of het verkochte bedrag ongeschonden in de maand landt, en of de
     twee bevindingen (btw-categorie uit de werkplek, terugstorting die de
     verkoop wist) nog steeds als bevinding in het register staan. Een bevinding
     die verdwijnt zonder besluit is precies de stille faalvorm die deze laag
     moet vangen. */
  'OMZETPROEF.json': { eigenRatel: 'test/omzetproef.test.js' },

  /* De landdekking heeft twee tanden die de TEGENOVERGESTELDE kant op staan, en
     dat is met opzet: `landenVolledig` mag alleen omhoog en `landenZonderEnige`
     alleen omlaag. Met een tand zou het getal te verbeteren zijn door een land
     uit kern/fiscaal/landen.js te halen -- minder landen zonder dekking, zonder
     dat er iets bijkwam. De toets bewaakt daarnaast de INDELING van de meting
     (welke as ondergrens is, wordt geteld en niet ingetikt), want een meter die
     kennis als dekking telt, meet het tegenovergestelde van wat hij moet meten. */
  'LANDDEKKING.json': { eigenRatel: 'test/landdekking.test.js' },

  /* De soevereiniteitsmeter heeft twee tanden die allebei OMHOOG moeten, en dat
     is anders dan de landdekking ernaast: daar is de schuld het aantal landen
     zonder dekking, hier is er geen schuldgetal maar alleen bereik. Wat hij
     bewaakt is dat de isolatielaag niet stil KRIMPT -- een drager die zijn
     sleutel verliest of een poort die req.session niet meer zet, maakt de
     isolatie zwakker zonder dat er een toets zakt, en dat is precies wat
     SEC-LOCK-003 verbiedt. De toets bewaakt daarnaast dat de vier delen nooit
     tot een cijfer worden opgeteld. */
  'SOEVEREIN.json': { eigenRatel: 'test/soeverein.test.js' },

  /* De doorbelasting heeft twee tanden die elkaars spiegelbeeld zijn: het aantal
     geldvormen MET een herkomst mag alleen omhoog, het aantal ZONDER alleen
     omlaag. Met een tand zou het getal te verbeteren zijn door geldvormen weg te
     halen. De toets bewaakt daarnaast de regel waar de hele meter op staat --
     `onbekend` is een uitkomst en nooit een aanname -- en dat er geen
     bijdragebasis wordt berekend zolang de noemer grotendeels onbekend is. */
  'DOORBELASTING.json': { eigenRatel: 'test/doorbelasting.test.js' },

  /* De adressen die de documenten noemen. De toets bevriest het register NIET --
     ADRESSEN.json beweegt bij elke documentregel die een pad noemt, en een tand
     op gelijkheid zou zakken om een reden die niets met adressen te maken heeft.
     Geratelde wordt het getal dat ertoe doet: `kapot` mag niet boven de
     grondwaarde in scripts/adressen.js komen. Toets 1 is zien zakken (een
     verzonnen adres in TIKKEN.md bracht hem op 24), dus deze regel is geen
     bewering -- zie de kop over de helft die mensenwerk blijft. */
  'ADRESSEN.json': { eigenRatel: 'test/adressen.test.js' },

  /* APPWERKT.json hangt aan de NORM-ratel en niet aan een eigen toets, want een
     verse meting vraagt een browser en een kwartier -- dat hoort niet in
     `npm test`. Wat er wel aan hangt is het getal dat ertoe doet:
     `appwerktDefecten` mag alleen omlaag, en dat wordt bij elke bouw
     nagerekend. De volle ronde (`npm run appwerkt:controle`) is de tweede tand
     en die is met een mutatie zien zakken; zie BETROUWBAARHEID.md par. 5. */
  'APPWERKT.json': { meter: ['appwerktDefecten'] },

  /* EERSTEMINUUT.json hangt om dezelfde reden aan de NORM-ratel als APPWERKT:
     een verse meting vraagt een browser en een registratie, en dat hoort niet
     in `npm test`. Wat eraan hangt is het getal dat ertoe doet --
     `eersteMinuutGezakt` mag alleen omlaag. */
  'EERSTEMINUUT.json': { meter: ['eersteMinuutGezakt'] },
  'PAKTE.json': { meter: ['pakteMisgelopen'] },
  'MENSTAALPROEF.json': { meter: ['menstaalTeVer', 'goudenPlakGebreken', 'samenhangGebreken', 'referentGebreken', 'geldGebreken', 'bevestigGebreken', 'verwijzingGebreken'] },
  /* MENSMUTATIE.json hangt om dezelfde reden aan de NORM-ratel: een verse ronde
     muteert de bron twaalf keer en draait zeven wachten, en dat hoort niet in
     `npm test`. Wat eraan hangt is het getal dat ertoe doet -- het aantal
     garanties dat je kunt weghalen zonder dat iemand het merkt. */
  'MENSMUTATIE.json': { meter: ['mensmutatieZonderWacht'] },

  /* DE ZEVEN REGISTERS VAN MAATSTAF.md, en waarom ze hier mogen staan. Elk van
     deze toetsen doet HETZELFDE: hij meet vers en vergelijkt met wat er in het
     register staat, zodat een achterlopend register de bouw laat zakken in
     plaats van stil verkeerd te blijven. Dat is precies de `eigenRatel`-vorm.

     Wat hier NIET staat zijn de registers waarvan ik de ratel niet ken. De kop
     van dit bestand is daar duidelijk over: een gok hoort hier niet in, want
     dan daalt het getal doordat er regels bijkomen in plaats van ratels. */
  'DOODSPOOR.json': { eigenRatel: 'test/doodspoor.test.js' },
  /* De kantoormacht (KANTOOR.md par. 1, blok 0 van KANTOORMACHT.md). Toets 6
     van dat bestand vergelijkt het vastgelegde register met een VERSE meting en
     zakt zodra `anoniemUitvoerbaar` stijgt -- de normtandvorm uit PROOF.md:
     schuld mag alleen krimpen. Die toets is zien zakken, dus deze regel is geen
     bewering (zie de kop over de helft die mensenwerk blijft). */
  'KANTOORMACHT.json': { eigenRatel: 'test/kantoormacht.test.js' },
  'OVERLEVING.json': { eigenRatel: 'test/overleving.test.js' },
  'TAFELPROEF.json': { eigenRatel: 'test/tafelproef.test.js' },
  /* Het tekstoppervlak hangt aan keuringsregel 68 en niet aan een toets: die
     regel IS de ratel (twee harde tanden, een schaduw) en hij moet elke PR
     tegenhouden, dus hij woont in de keuring die CI draait. Hij noemt het
     register bij naam en vergelijkt de verse meting ertegen. */
  'TEKSTOPPERVLAK.json': { eigenRatel: 'scripts/check.js' },
  'RITPROEF.json': { eigenRatel: 'test/ritproef.test.js' },
  'TOELATINGSPROEF.json': { eigenRatel: 'test/toelatingsproef.test.js' },
  'ADAMPROEF.json': { eigenRatel: 'test/adamproef.test.js' },
  'DOELGROEPBEREIK.json': { eigenRatel: 'test/doelgroepbereik.test.js' },
  'AANVOERVORM.json': { eigenRatel: 'test/aanvoer.test.js' },
  'MOMENTPROEF.json': { eigenRatel: 'test/momentproef.test.js' },
  /* LUSPROEF.json (sinds 24 september 2026) levert voltooibaar voor Ontdekken
     via scripts/lib/appcontract.js. De toets houdt het woordgebruik vast dat
     scripts/lib/bewijsbron.js leest, en dat de telling de rijen niet overstemt. */
  'LUSPROEF.json': { eigenRatel: 'test/lusproef.test.js' },
  /* LIEGRONDE.json (sinds 24 september 2026) levert waarheidsgetrouw voor elke
     rij van APPWERKT.json. De toets houdt vast dat een BEWEZEN rij iets gelogen
     kreeg en dat een DEFECT een verzonnen zekerheid draagt. */
  'LIEGRONDE.json': { eigenRatel: 'test/liegronde.test.js' },
  /* BEVOEGD.json (sinds 25 september 2026) levert bevoegd voor elke rij van
     APPWERKT.json. De toets houdt vast dat een ledenscherm alleen BEWEZEN is als
     ELKE route gemeten is, en dat een gezinspaar zonder A binnen niets bewijst. */
  'BEVOEGD.json': { eigenRatel: 'test/bevoegdronde.test.js' },
  'NAVIGATIEPROEF.json': { eigenRatel: 'test/navigatieproef.test.js' },
  'MOVEPROEF.json': { eigenRatel: 'test/moveproef.test.js' },
  'KETENVORM.json': { eigenRatel: 'test/toelatingsproef.test.js' },
  /* KETENBEREIK.json meet welke schakel van de keten mens -> effect een echte
     mensenzin aanraakt (EXECUTIE.md blok 6/9). De geratelde waarde is met opzet
     NIET de uitslag maar het BEREIK VAN DE METER -- hetzelfde besluit als bij
     CARRIEREVORM.json hierboven, en om dezelfde reden. De uitslag HOORT te
     bewegen zodra er wordt bedraad; dat is nieuws en geen achteruitgang. Maar
     een haak die stil minder schakels kan wikkelen (iemand hernoemt
     kern/stuur/mandaat.js, een export wordt bevroren) meldt exact dezelfde
     conclusie -- "mandaat wordt door geen enkele zin geraakt" -- over minder
     bewijs, en dat is de faalvorm waar een ratel voor bestaat. */
  'KETENBEREIK.json': { eigenRatel: 'test/ketenbereik.test.js' },
  /* PAKTEBETEKENIS.json meet hoeveel ONDERSCHEIDEN uitkomsten er onder dezelfde
     boolean `pakte` vallen (kern/fluister/gesprek.js). Zelfde besluit als bij
     KETENBEREIK.json hierboven: de geratelde waarde is het BEREIK van de meter
     en niet de uitslag. Die uitslag hoort te dalen zodra `pakte` wordt
     gesplitst -- dat is de bedoeling van de meting. Maar een corpus dat stil
     minder standen of minder gevallen ziet, meldt "minder betekenissen" terwijl
     er alleen minder is gekeken, en dat is de faalvorm waar een ratel voor is. */
  'PAKTEBETEKENIS.json': { eigenRatel: 'test/paktebetekenis.test.js' },
  /* MANDAATPROEF.json is een PROEF en geen meting, dus hier hoort de ratel wel
     op de uitslag: een schakel die gesloten was en opengaat, is een regressie en
     geen nieuws. De uitzondering is `openBekend` -- die telt apart en draagt
     zijn reden mee, zodat een bevinding niet hoeft te worden weggepoetst om
     groen te blijven. Zelfde vorm als RITPROEF.json en MOMENTPROEF.json. */
  'MANDAATPROEF.json': { eigenRatel: 'test/mandaatproef.test.js' },
  'REFUNDMIGRATIE.json': { eigenRatel: 'test/refundmigratie.test.js' },
  'RITMIGRATIE.json': { eigenRatel: 'test/ritmigratie.test.js' },
  /* ONDERNEMERSLUS.json meet of de ondernemerslus EEN onderwerp draagt
     (ONDERNEMEN.md par. 1). Drie tanden die verschillende kanten op staan --
     `zaakZietOnderneming` alleen omhoog, de twee schulden alleen omlaag -- plus
     twee besturingsproeven, want deze meter kan blind worden en zou dat dan als
     bevinding melden. Zie de kop van test/ondernemerslus.test.js. */
  'ONDERNEMERSLUS.json': { eigenRatel: 'test/ondernemerslus.test.js' },
  'HEAPPROEF.json': { eigenRatel: 'test/heapproef.test.js' },
  'DOORWERKING.json': { eigenRatel: 'test/doorwerking.test.js' },
  /* De gedeelde namespace van handelingen (TAKEN.md 4.54). Drie getallen, en
     ze lopen niet dezelfde kant op: gedeelde onderwerpen mogen alleen OMHOOG
     (meer vergelijkbaarheid), schalen die alleen staan en tegenspraken alleen
     omlaag. Dat past niet als een enkelvoudig getal in NORM.json, dus draagt
     het register zijn eigen grondwaarde en houdt de toets hem vast. */
  'GEZAGSHANDELINGEN.json': { eigenRatel: 'test/gezagshandelingen.test.js' },
  'WACHTWIJZE.json': { eigenRatel: 'test/wachtwijze.test.js' },
  'HANDELINGSKLASSE.json': { eigenRatel: 'test/handelingsklasse.test.js' },
  'EXECUTION_MAP.json': { eigenRatel: 'test/executionmap.test.js' },
  /* De machinedekking (MACHINE.md par. 0): raken de zestien motoren dezelfde
     handeling? Twee getallen dragen de ratel en beide mogen alleen DALEN --
     `mutatiesZonderEnigeAs` (muterende routes die geen enkele as raken) en
     `motorenZonderRouteBereik`. Ze staan hier en niet in NORM.json omdat het er
     twee zijn met een eigen grondwaarde in het register zelf; toets 8 van het
     genoemde bestand vergelijkt de VERSE meting met die grondwaarde. Die toets
     is zien zakken (het vastgelegde getal op 2000 gezet, waarna hij de stijging
     naar 2818 meldde), dus deze regel is geen bewering -- zie de kop over de
     helft die mensenwerk blijft. */
  'MACHINEDEKKING.json': { eigenRatel: 'test/machinedekking.test.js' },
  /* Drie tanden in NORM.json, geen eigenRatel: de gevraagde meter is "onbekende
     gevolgpaden mag alleen dalen", en dat is precies wat een ratel doet. */
  'GEVOLGDEKKING.json': { meter: ['gevolgPadenOnbekend', 'gevolgContractVolledig', 'gevolgContractenGezakt'] },
  /* MENSELIJKE_UITVOERING.json is net als EXECUTION_MAP.json een PROJECTIE
     zonder tijdstempel: hij draagt vingerafdrukken van zijn bronnen in plaats
     van een klok, en test/menselijkeuitvoering.test.js hercompileert hem byte
     voor byte. Dat is strenger dan een ouderdomscontrole -- een projectie die
     achterloopt op zijn bron zakt meteen. */
  'MENSELIJKE_UITVOERING.json': { eigenRatel: 'test/menselijkeuitvoering.test.js' },
  'HERSTEL.json': { eigenRatel: 'test/herstel.test.js' },
  'HERSTELPROEF.json': { eigenRatel: 'test/herstelproef.test.js' },
  'DROOGLOOP.json': { eigenRatel: 'test/droogloop.test.js' },
  /* De scherpe bewering van de geldkaart is geen getal dat mag dalen maar een NUL
     die nul moet blijven: geen kernbak buiten zijn eigen poort. Die ratel woont
     daarom in de toets en niet in NORM.json. */
  'GELDKAART.json': { eigenRatel: 'test/geldkaart.test.js' },
  /* GELDDEKKING.json hangt WEL aan NORM.json -- vier tanden, zie de kop daar.
     Anders dan de geldkaart draagt hij voorraden die mogen dalen in plaats van
     een nul die nul moet blijven, en dat is precies wat een ratel meet. */
  /* `geldRoutesMeldOnbesloten` hoort HIER en niet alleen bij MELDBESLUIT.json.
     De VERKLARING woont daar, maar het GETAL komt uit de `ratel` van dit
     register -- en test/gelddekking.test.js eist terecht dat elke sleutel in die
     ratel ook in deze meterlijst staat. Anders draait de meter nog en bewaakt
     hij niets meer, precies het gat dat die toets beschrijft. */
  'GELDDEKKING.json': { meter: ['geldRoutesPubliek', 'geldRoutesZonderSemantiek',
    'geldRoutesZonderIdemBewijs', 'geldRoutesZonderTerugweg',
    'geldRoutesHerstelOnbesloten', 'geldRoutesHerstelTegenspraak',
    'geldRoutesMeldOnbesloten'] },
  /* FACTUURPROEF.json hangt aan TWEE tanden en niet aan een, en dat is een
     besluit en geen slordigheid: `geldpadGezakt` is een defect dat naar nul
     moet, `geldpadOnbewezen` is werk dat nog niet gedaan is. Een tand die die
     twee optelt, laat een crashbevinding wegvallen tegen een stap die iemand
     nog moet meten. Zie de kop van NORM's METERS. */
  'FACTUURPROEF.json': { meter: ['geldpadGezakt', 'geldpadOnbewezen'] },
  /* CRASHAS.json volgt diezelfde tweedeling, een niveau breder: de factuurproef
     meet EEN route diep, dit classificeert ALLE geldroutes over de zes
     crashgrenzen. `crashasOnbekend` is een open vraag, `crashasNietMeetbaar` is
     een ontbrekend injectiepunt -- en die twee gaan nooit in een tand samen,
     want de eerste los je op door te kijken en de tweede door gereedschap te
     bouwen. */
  'CRASHAS.json': { meter: ['crashasOnbekend', 'crashasNietMeetbaar'] },
  /* CRASHPROEF.json volgt dezelfde tweedeling nog een niveau verder: CRASHAS
     classificeert, dit VOERT UIT. `crashproefGezakt` is een gebroken
     overlevingscontract en dus een defect; `crashproefOnbereikt` is bereik van
     het instrument. GEEN_DUURZAME_WEG hangt met opzet aan geen van beide -- dat
     is een gemeten niet-van-toepassing en geen schuld. */
  'CRASHPROEF.json': { meter: ['crashproefGezakt', 'crashproefGeenLijf', 'crashproefGeenWereld',
    'crashproefGeenRol', 'crashproefOnbepaald'] },
  /* HERSTELBESLUIT.json is een VERKLARING en geen meting -- dezelfde vorm als
     ROLLBACKBESLUIT.json hierboven, dat ook aan een geteld gevolg hangt. Wie
     hier een regel bijzet of weghaalt, beweegt een van deze twee tellers: een
     ontbrekende verklaring zit in `onbesloten`, een verkeerde in `tegenspraak`. */
  'HERSTELBESLUIT.json': { meter: ['geldRoutesHerstelOnbesloten', 'geldRoutesHerstelTegenspraak'] },
  /* MELDBESLUIT.json is net zo'n VERKLARING: hij hangt aan het aantal geldroutes
     waarvan niemand heeft gezegd of er bericht hoort te gaan. Leeg is hier geen
     nul maar 45 -- de teller telt wat er NIET verklaard is. */
  'MELDBESLUIT.json': { meter: ['geldRoutesMeldOnbesloten'] },
  /* SCHRIJFPROEF.json meet iets ANDERS dan CRASHPROEF.json en hangt daarom aan
     een eigen tand: niet wat er van een uitkomst overblijft na een crash, maar
     of de aanroeper een succes te zien krijgt over een schrijfactie die is
     verdwenen. `ONBEREIKT` krijgt met opzet geen tand -- dat is bereik van het
     instrument en geen defect van een route, dezelfde grond waarop
     GEEN_DUURZAME_WEG er ook geen heeft. */
  'SCHRIJFPROEF.json': { meter: ['geldRoutesValsSucces'] },

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

  /* De credentialinventaris blijft bewust BLOCKED zolang een bekende deur of
     bronkandidaat niet is geclassificeerd. scripts/codecredentials.js leest
     dit register zelf en eindigt dan met een niet-nul status; release-gate.js
     maakt die uitkomst bovendien onderdeel van iedere kandidaatkeuring. */
  'CODECREDENTIALS.json': { eigenRatel: 'scripts/codecredentials.js' },

  'BEDRADING.json': { eigenRatel: 'scripts/check.js' },
  'UITVOERPROEF.json': { eigenRatel: 'scripts/bewijsmatrix.js' },
  'KLOK.json': { eigenRatel: 'scripts/klok.js' },
  /* De a11y-grens draagt zijn eigen nul: scripts/a11y.js LEEST de grens hieruit
     en zakt erop (exit 1), en scripts/raakvlakkeuring.js hangt zijn getal aan
     hetzelfde register. Twee metingen, een ratel. */
  'A11Y-INGELOGD.json': { eigenRatel: 'scripts/a11y.js' },
  'SABOTAGE.json': { eigenRatel: 'scripts/wetten.js' },
  /* DOCTRINE.json draagt GEEN getal dat naar nul of naar honderd moet, en dat is
     een ontwerpbesluit en geen tekort: het aantal kandidaten stijgt zodra er een
     document bijkomt, en dat is gewoon werk en geen verslechtering. Een ratel in
     NORM.json zou daar rood van staan. Wat wel kan zakken is de compiler zelf --
     zijn zelfijking, zijn zinsherkenning en de graad op zijn uitslag -- en dat
     bewaakt test/doctrine.test.js. */
  'DOCTRINE.json': { eigenRatel: 'test/doctrine.test.js' },
  /* VERBAND.json draagt WEL een getal dat niet mag zakken (de unie-recall), maar
     dat getal hangt aan het AANTAL wetten: komt er een wet bij met een wachter die
     nog geen sensor ziet, dan daalt het percentage door gewoon werk. De vloer
     staat daarom in de toets en niet in NORM.json, met de reden erbij. */
  'VERBAND.json': { eigenRatel: 'test/verband.test.js' },
  /* BEREIK.json draagt met opzet GEEN percentage en dus geen getal dat een kant
     op moet: het aantal cellen per uitslag verschuift zodra de projectieruimte
     verandert, en dat is een besluit en geen verslechtering. Wat wel kan zakken
     is de ONAFHANKELIJKHEID van de drie assen, en dat bewaakt test/bereik.test.js. */
  'GELDING.json': { eigenRatel: 'test/gelding.test.js' },

  /* En twee die door een TOETS worden vastgehouden in plaats van door een
     script. Allebei zeggen het in hun eigen uitleg met zoveel woorden: "MAG
     ALLEEN KRIMPEN". Dat is een ratel, ook al staat hij niet in NORM.json. */
  'BEREIK.json': { eigenRatel: 'test/bereikbaar.test.js' },
  'SCHERMLEUGEN.json': { eigenRatel: 'test/liegend-scherm.e2e.js' }
};

module.exports = { REGISTER, GEEN_METING };
