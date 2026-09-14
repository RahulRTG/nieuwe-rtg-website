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
  'CORRECTIES.json'
]);

const REGISTER = {
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
  /* STAGEVORM.json meet of de publieke domeinen een datavorm delen (STAGE.md
     par. 0). Om dezelfde reden als bij CARRIEREVORM.json hierboven is de
     geratelde waarde het BEREIK en niet de uitkomst: dat er 0 velden gedeeld
     worden is de bevinding waar het document op staat, en een bevinding die
     beweegt is nieuws. Wat NIET mag bewegen is hoeveel publieke domeinen de
     meter heeft gezien -- zakt dat stil, dan daalt de gedeeldheid door een
     hernoemde map in plaats van door een feit, en leest de nul plotseling als
     bevestiging terwijl hij een blinde vlek is. */
  'STAGEVORM.json': { meter: ['stageDomeinenGemeten'] },
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
  'ACTIVERING.json': { meter: ['activeringOndergrens'] },
  'TREDEPROEF.json': { meter: ['tredeLekken', 'tredeRondgangGezakt', 'tredeIngangLekken'] },
  'WEKKERS.json': { meter: ['wekkersOnverklaard', 'wekkersFunctieUitToch', 'wekkersZonderTrede'] },
  'ZAAKWIG.json': { meter: ['zaakwigGezakt'] },
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
  'NAVIGATIEPROEF.json': { eigenRatel: 'test/navigatieproef.test.js' },
  'MOVEPROEF.json': { eigenRatel: 'test/moveproef.test.js' },
  'KETENVORM.json': { eigenRatel: 'test/toelatingsproef.test.js' },
  'REFUNDMIGRATIE.json': { eigenRatel: 'test/refundmigratie.test.js' },
  'RITMIGRATIE.json': { eigenRatel: 'test/ritmigratie.test.js' },
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
