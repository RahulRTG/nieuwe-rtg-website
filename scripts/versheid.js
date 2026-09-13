#!/usr/bin/env node
/* ============================================================================
   DE VERSHEID -- WELK REGISTER LOOPT ACHTER OP DE CODE?

   WAAROM DIT ER IS. Dit huis houdt vierentwintig registers bij, en tot voor kort
   droeg er EEN (DEKKING.json) de commit waarop hij is gemeten. De rest zag er bij
   elke blik identiek uit, of hij nu van vanochtend was of van drie maanden
   geleden. Dat is geen theoretisch bezwaar: POORTWACHT.json liep 196 routes
   achter en dat was alleen te ontdekken door het te vermoeden en na te tellen.

   Een verouderd register is gevaarlijker dan een ontbrekend register. Een
   ontbrekend register geeft "niet gemeten"; een verouderd register geeft
   getallen, en getallen worden geloofd.

   WAT DIT SCRIPT WEL EN NIET ZEGT:

     WEL   dit register is gemeten op een andere commit dan HEAD, of met vuile
           boom, of zonder stempel -- en dus niet na te lopen.
     NIET  of de meting nog KLOPT. Een register van een oudere commit kan best
           nog kloppen als er sindsdien alleen documentatie is gewijzigd. Dat is
           met opzet: "waarschijnlijk nog goed" is precies de redenering waarmee
           een achterstand jaren blijft liggen. Verouderd is verouderd; of het
           erg is, beslist een mens.

   Draai:  node scripts/versheid.js
           node scripts/versheid.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { versheid, nuCommit, stempelVan, WORTEL } = require('./lib/stempel');

/* De registers die een instrument bijhoudt, met het instrument erbij -- zodat
   de uitslag niet alleen zegt DAT iets achterloopt maar ook wat je moet draaien.
   Alleen registers die een MEETRONDE hebben; een tabel met wetten of landen
   heeft geen stempel nodig omdat er niets aan gemeten wordt. */
/* De herstelopdracht wijst naar de MEETRONDE en niet naar het losse instrument.
   Dat is geen voorkeur: de losse proeven draaien met hun STANDAARDbegrenzing, en
   die is kleiner dan een volle ronde. `npm run rolproef` schreef ROLPROEF.json
   een keer van 3377 beproefde routes terug naar 292 -- zonder dat het register
   er anders uitzag. De meetronde geeft de goede vlaggen mee. */
/* WELKE REGISTERS EEN POORT ZIJN, EN WELKE EEN MELDING.

   Dit script MELDDE alleen, met de reden erbij: een register dat achterloopt op
   een commit die een typefout repareerde, is geen defect. Dat klopt nog steeds
   voor de meeste. Het klopt niet voor de registers die zeggen of iemand ergens
   BINNENKOMT waar hij niet hoort, of dat er iets met GELD misgaat. Daar is
   "waarschijnlijk nog goed" precies de redenering waarmee een achterstand jaren
   blijft liggen (TAKEN.md 7.3).

   Vandaar een derde kolom. `beveiliging` en `geld` laten de poort zakken;
   `overig` blijft melden. De indeling is smal gehouden: wie hier een register
   bijzet dat elke week verandert, maakt de poort tot een sirene die iedereen
   uitzet -- en dan houdt hij niets meer tegen.

   Wat er NIET bij zit en waarom:
     SUITE.json    de volle testronde is de bodem onder alles, maar hij loopt
                   achter zodra iemand een regel code wijzigt. Als poort zou hij
                   elke tak rood zetten tot er een ronde van drie kwartier is
                   gedraaid; dan wordt hij weggeklikt in plaats van gerespecteerd.
     BEWIJSMATRIX  een afgeleide van de tien registers eronder. Zakt er een van
                   die tien, dan is dat de melding die je wilt; de matrix erbij
                   zou hetzelfde nog een keer zeggen.
     BEPROEVING    en SABOTAGE.json. Deze twee zaten er eerst WEL bij -- de een
     SABOTAGE      draagt de geldketen, de ander vraagt of elke handhaver echt
                   aanstaat, en inhoudelijk horen ze er dus in. Ze zijn er weer
                   uitgehaald op een MECHANISCHE grond, en die is beslissend:
                   ze worden gemaakt in andere jobs van .github/workflows/ronde.yml
                   dan de job die deze poort draait, en de ronde legt met opzet
                   niets vast ("een ronde die zichzelf vastlegt, legt ook een
                   verslechtering vast"). In de job van de poort komen ze dus
                   altijd uit de checkout, en die is verouderd zodra er sinds de
                   laatste handmatige commit een regel code is gewijzigd.

                   Een poort die per constructie rood staat, wordt binnen twee
                   weken met `|| true` uitgezet -- en neemt dan de vier mee die
                   wel werken. Ze melden daarom, tot iemand besluit dat de ronde
                   ze wel vastlegt. Dat is een besluit van de eigenaar over de
                   werkwijze en niet iets om hier stil in te bouwen.

   DE VIER DIE OVERBLIJVEN zijn niet toevallig vier: het zijn precies de
   registers die `npm run meetronde` in DEZELFDE job verst maakt, vlak voordat
   deze poort draait. Wat de poort eist, levert de stap ervoor. */
const BEVEILIGING = 'beveiliging', GELD = 'geld', OVERIG = 'overig';

const REGISTERS = [
  /* DE SUITE ZELF STAAT BOVENAAN, en dat is de duurste les van dit huis over
     veroudering. Zestien toetsen zakten aan de geldkant zonder dat iemand het
     wist: de losse toetsen die erlangs gingen waren groen, de registers waren
     vers en de keuring was schoon. Nergens was te zien dat de laatste VOLLE
     ronde van dertig commits geleden was. Sinds scripts/test-runner.js een
     stempel achterlaat, veroudert de suite hier net zo zichtbaar als elk
     register -- en hij hoort vooraan, want een register dat verser is dan de
     suite eronder meet een huis waarvan niemand weet of het nog werkt. */
  ['SUITE.json', 'npm test', 'de laatste VOLLE testronde: wanneer, waartegen, en of hij groen was'],
  ['DEKKING.json', 'npm run dekking:vast', 'welke routes een toets echt heeft aangeroepen'],
  /* De taalkwaliteit veroudert met de CODE en niet met de klok: de poort telt
     welke faalvormen zij aantoonbaar tegenhoudt, en die telling is niets waard
     zodra de keuring is veranderd zonder hem opnieuw te draaien. */
  ['TAALKWALITEIT.json', 'npm run taalkwaliteit', 'wat er per taal over de VORM van een vertaling is vastgesteld, en wat de keuring tegenhoudt'],
  ['TAALSCHIL.json', 'npm run taalschil', 'wat er per taal offline klaarstaat: de tekst van de app-schil die sw.js voorcachet'],
  ['POORTWACHT.json', 'npm run meetronde -- --alleen=poortwacht', 'welke routes zonder token opengaan', BEVEILIGING],
  ['ROLPROEF.json', 'npm run meetronde -- --alleen=rolproef', 'of een verkeerde rol binnenkomt', BEVEILIGING],
  ['INVOERPROEF.json', 'npm run meetronde -- --alleen=invoerproef', 'of rommel netjes wordt geweigerd'],
  ['IDEMPROEF.json', 'npm run meetronde -- --alleen=idemproef', 'of een herhaalde oproep niets dubbel doet'],
  ['STAATPROEF.json', 'npm run meetronde -- --alleen=staatproef', 'of de toestand na afloop klopt'],
  ['KETENS.json', 'npm run meetronde -- --alleen=ketenronde', 'of een keten netjes faalt onder sabotage'],
  /* DE VIER DIE HIER NIET STONDEN, en dat is geen kleinigheid: de bewijsmatrix
     LEEST ze alle vier, en geen enkele versheidsmeter keek ernaar. Een register
     dat de matrix voedt en dat niemand op ouderdom nakijkt, veroudert stil --
     precies waarvoor deze lijst bestaat. */
  ['OUTPUTPROEF.json', 'npm run meetronde -- --alleen=outputproef', 'of een antwoord meer prijsgeeft dan het hoort', BEVEILIGING],
  ['AUDITPROEF.json', 'npm run meetronde -- --alleen=auditproef', 'of een geslaagde handeling een spoor nalaat'],
  ['HANDELINGPROEF.json', 'npm run meetronde -- --alleen=handelingproef', 'of dat spoor geketend is'],
  ['UITVOERPROEF.json', 'npm run meetronde -- --alleen=uitvoerproef', 'of een antwoord gegevens van een ander bevat', BEVEILIGING],
  ['BEWIJSMATRIX.json', 'npm run bewijsmatrix:vast', 'de elf schakels per route, uit de vijf registers hierboven'],
  ['MUTATIES.json', 'npm run mutatie', 'welke toetsen kunnen zakken'],
  ['LAATSTE_METING.json', 'npm run beproeving', 'de laatste stormproef, ook wanneer hij zakt'],
  ['HEAPPROEF.json', 'npm run heapproef', 'geheugengedrag onder herhaalde verzoeken'],
  ['BEPROEVING.json', 'npm run beproeving', 'storm, geld, misbruik en herstel'],
  ['SCHERMLEUGEN.json', 'node --test test/liegend-scherm.e2e.js', 'of een scherm iets toont dat er niet is'],
  ['SABOTAGE.json', 'node scripts/sabotage.js', 'of elke handhaver echt aan staat'],
  /* DE EERSTE MINUUT. Hij hoort hier en niet in BUITEN, want hij is geen afdruk
     uit de code maar een METING VAN GEDRAG: een vers lid, de echte registratie,
     een echte browser op 390x844. Verandert de onboarding, het menu of het
     beginscherm zonder dat deze ronde opnieuw draait, dan beweert het register
     iets over een app die niet meer bestaat -- en juist bij dit register is dat
     gevaarlijk, omdat hij gaat over wat een mens ZIET.

     Melding en geen poort, om de reden uit de kop van dit bestand: hij vraagt
     een Chromium en een paar minuten, en een poort die per constructie rood
     staat op een machine zonder browser wordt met `|| true` uitgezet. Wat hem
     vandaag tegenhoudt is zijn eigen tand in NORM.json (eersteMinuutGezakt,
     richting omlaag, nu 0) -- die staat los van zijn ouderdom, en dit is
     precies het gat ertussen. */
  ['EERSTEMINUUT.json', 'npm run eersteminuut', 'wat een mens die RTG niet kent in de eerste minuut krijgt'],
  /* DE MENSTAALPROEF. Ook een METING VAN GEDRAG: hij start een server, stelt
     elke zin uit het contract en leest uit het stuurspoor hoe ver hij kwam.
     Verandert het corpus, het beleid of een poort zonder dat deze ronde
     opnieuw draait, dan beweert het register iets over een keten die er niet
     meer is. */
  ['MENSTAALPROEF.json', 'npm run menstaalproef', 'hoe ver elke menselijke zin werkelijk komt'],
  /* DE TIEN MUTATIES. Ook een METING VAN GEDRAG, en de duurste soort: hij
     verbouwt de echte bron twaalf keer en draait er zeven wachten tegenaan.
     Komt er een poort bij of valt er een toets weg zonder dat deze ronde
     opnieuw draait, dan beweert het register dat een garantie bewaakt wordt
     terwijl de wacht die hem zag er niet meer is. */
  ['MENSMUTATIE.json', 'npm run mensmutatie', 'welke garanties je kunt weghalen zonder dat een wacht afgaat'],
  /* DE RAILVERGELIJKING. Hij legt twee MENSTAALPROEF-rondes naast elkaar, dus
     hij veroudert met allebei: verandert het corpus, het beleid of een poort,
     dan gaat hij over rails die niet meer zo werken. Hij draagt daarom wel een
     stempel (anders dan MENSELIJKE_UITVOERING.json, die uit vingerafdrukken
     leeft). */
  ['RAILVERGELIJK.json', 'npm run railvergelijk', 'komt een tweede interpretatierail tot dezelfde veilige uitkomsten'],
  /* DE NULMETING OP DE ROUTER. Ook dit is een METING VAN GEDRAG en geen afdruk
     uit de code: hij start een server, registreert per geval een vers lid en
     kijkt wie de vraag claimt. Verandert de antwoordrail of het corpus zonder
     dat deze ronde opnieuw draait, dan beweert het register iets over een
     routing die niet meer bestaat -- en juist dit getal is de grond onder de
     vraag of `r.pakte` aangeraakt mag worden. Melding en geen poort, om
     dezelfde reden als hierboven: hij vraagt een server en een paar minuten. */
  ['PAKTE.json', 'node scripts/pakte.js', 'wie claimt een menselijke vraag: de antwoordrail of het stuur'],
  ['WAAROM.json', 'node scripts/waarom.js --vastleggen', 'waarom een route niet te bewijzen valt, in zijn eigen woorden'],
  /* EN DE SCHULDENLIJST. Hij leest de registers hierboven en is dus per
     definitie zo oud als de oudste daarvan -- maar hij droeg zijn eigen
     ouderdom niet uit. Gevonden op 31 augustus 2026: tien dagen stil, 126
     commits achter, en gemeten op een vuile boom. Precies het gat waar dit
     instrument voor bestaat, en het stond er zelf niet in. */
  ['BEWIJSSCHULD.json', 'node scripts/bewijsschuld.js --vastleggen', 'wat er nog niet gemeten is, en waarom niet'],
  /* DE KANTOORMACHT (blok 0 van KANTOORMACHT.md). Hij telt of er een MENS achter
     een kantoorhandeling staat, en dat is inhoudelijk een beveiligingsvraag --
     toch staat hij hier als MELDING en niet als poort, om de reden die in de kop
     van dit bestand staat: hij verandert bij elke nieuwe kantoorroute, en een
     register dat vaak beweegt maakt van een poort een sirene die iedereen uitzet.
     Wat hem vandaag tegenhoudt is zijn EIGEN tand (npm run kantoormacht:controle,
     via test/kantoormacht.test.js): het aantal anoniem uitvoerbare routes mag
     alleen dalen. Die tand bijt op de INHOUD en niet op de ouderdom.
     Hij hoort BEVEILIGING te worden zodra de mens-eis werkelijk wordt afgedwongen
     (KANTOOR.md par. 14, blok 1) -- vanaf dat moment is een verouderd getal wel
     een uitspraak over wie er binnenkomt. Dat is een besluit en geen automatisme. */
  ['KANTOORMACHT.json', 'npm run kantoormacht:vast', 'of er een mens achter een kantoorhandeling staat'],
  /* DE MACHINEDEKKING (MACHINE.md). Hij hoort hier om dezelfde reden als de
     kantoormacht ernaast: zijn getallen zijn afgeleid uit de ROUTER en uit
     registers, dus ze verouderen met elke route die erbij komt zonder dat er iets
     aan de meter verandert. En hij hoort op `overig` en niet op BEVEILIGING, met
     de lezing die de overleving hieronder uitschrijft: een poortklasse zegt hier
     niet WAAROVER een register gaat maar dat een verouderd exemplaar de RONDE
     tegenhoudt, en dat is voorbehouden aan de vier die `npm run meetronde` ook
     werkelijk ververst.

     Zijn tanden zitten waar ze horen, op de INHOUD en niet op de ouderdom
     (test/machinedekking.test.js, via npm run machinedekking:controle): twee
     schulden die alleen mogen dalen, en `volledigeKetens` die alleen mag stijgen. */
  ['MACHINEDEKKING.json', 'npm run machinedekking:vastleggen', 'of de motoren van dit huis bij dezelfde handeling langskomen'],
  /* DE OVERLEVING STAAT MET OPZET OP `overig` EN NIET OP BEVEILIGING, en dat is
     de correctie op een eerste versie die hem die vlag wel gaf -- "hij gaat over
     beveiliging, dus hij hoort in de beveiligingsklasse". Dat is de verkeerde
     lezing: een poortklasse betekent hier niet WAAROVER een register gaat maar
     dat een verouderd exemplaar de RONDE TEGENHOUDT, en die eer is voorbehouden
     aan de vier registers die `npm run meetronde` ook werkelijk ververst.
     test/versheidspoort.test.js zegt precies waarom: een poort die iets eist wat
     de stap ervoor niet levert, staat per constructie rood -- en wordt dan met
     `|| true` uitgezet, met de vier die wel werken erbij. Zijn veroudering wordt
     dus GEMELD, en zijn ratel zit waar hij hoort: in test/overleving.test.js. */
  ['OVERLEVING.json', 'npm run overleving:vast', 'of RTG een enkel compromis overleeft'],
  /* DE SCHADUWPROEF VAN DE ISOLATIEPOORT. Hij hoort hier omdat hij het enige is
     dat zegt wat die poort ZOU doen -- en dat getal veroudert sneller dan de
     meeste: elke nieuwe route in de member-allowlist verandert het, zonder dat
     iemand de proef opnieuw draait. Een oude uitslag leest als een uitspraak
     over het huis van vandaag. */
  ['ISOLATIESCHADUW.json', 'npm run isolatieschaduw:vast', 'wat de isolatiepoort zou sluiten, gemeten met echt verkeer'],
  /* TIEN REGISTERS DIE HIER NIET IN STONDEN, en dat was het gat waar dit
     instrument juist voor is. Zeven ervan droegen zelfs helemaal geen stempel:
     hun ouderdom was niet vast te stellen, en ze zeiden dat ook niet -- ze
     toonden gewoon getallen. Gevonden bij de vraag "wat staat er nog open",
     nadat dertien instrumenten bleken stil te staan zonder dat iets het meldde.

     Ze staan hier in de volgorde waarin ze iets over de code zeggen: eerst de
     vier route-proeven, dan de rondes, dan de meters die over de machine gaan. */
  /* Het API-spoor in journaalvorm: de derde, lichtste AUDIT-bron van de
     bewijsmatrix (#176 splitste hem af van AUDITPROEF.json). Zelfde ronde als
     de auditproef, dus dezelfde ouderdom. */
  ['AUDITPROEF-JOURNAAL.json', 'npm run auditproef', 'het API-spoor per schrijfroute in journaalvorm'],
  /* Het laatspoor (#176): schrijfroutes die de opslag aanraken voordat ze de
     invoer keuren. Statisch gemeten, maar een register dat wordt geschreven
     hoort hier te staan of buiten met een reden (test/versheidsdekking). */
  ['LAATSPOOR.json', 'node scripts/laatspoor.js', 'schrijfroutes die de opslag aanraken voordat ze de invoer keuren'],
  ['IDOR.json', 'node scripts/idorproef.js', 'of het object van een ander te openen is'],
  ['ROLRONDE.json', 'node scripts/rolronde.js', 'welke rol waar binnenkomt, gevraagd aan een echte server'],
  ['GLUURRONDE.json', 'node scripts/gluurronde.js', 'de horizontale scheiding tussen twee leden'],
  ['VERRAAD.json', 'node scripts/verraadronde.js', 'wat een verraden seed of zegel doet'],
  ['INHOUDSKAART.json', 'node scripts/inhoudskaart.js', 'wat elke route werkelijk teruggeeft'],
  ['DUURZAAMHEIDSKOSTEN.json', 'node scripts/duurzaamheidskosten.js', 'wat een commit aan machine en opslag kost'],
  /* DE SCHERFMETER, EN WAAROM HIJ HIER STAAT EN NIET IN BUITEN. Zijn `churn`
     wordt gemeten TEGEN de vorige vastlegging: hoeveel bestanden zijn sinds die
     opname van scherf gewisseld. Een oude opname maakt dat getal dus niet
     onnauwkeurig maar betekenisloos -- je vergelijkt met een indeling die
     niemand meer draait. Van alle registers hier is dit er een waar veroudering
     de meting niet vertraagt maar ONGELDIG maakt. */
  ['SCHERFMETER.json', 'npm run scherfmeter:vast',
    'de balans en de churn van de scherfverdeling, en wat een ongemeten bestand kostte'],

  /* De twee boekhoudkundige registers. Ze meten geen gedrag maar TELLINGEN, en
     juist daar doet veroudering pijn: een schuldgetal van vorige maand naast een
     routelijst van vandaag leest als vooruitgang. */
  ['IDEMSCHULD.json', 'npm run idemschuld:vast', 'welke schrijfroutes nog geen besluit over duplicaatgedrag dragen'],
  ['MUTATIEBOEK.json', 'npm run mutatieboek:vast', 'in welke bak elke route valt, en of de optelling sluit'],
  ['ONBEWEZEN.json', 'npm run onbewezen:vast', 'waarom een mutatie geen geldig bewijs heeft, van goedkoop naar duur'],
  ['HANDLERWACHT.json', 'npm run handlerwacht:vast', 'wie de routes bewaakt waar de router geen bewakerslaag ziet'],

  /* ACHT METERS DIE MET DE SAMENVOEGING BINNENKWAMEN.

     Ze stonden nergens onder toezicht, en dat is precies het gat dat
     test/versheidsdekking.test.js dicht hoort te houden: een verouderd register
     geeft getallen, en getallen worden geloofd. Bij deze acht is dat geen
     theorie -- vier ervan meten in een ECHTE browser of tegen een DRAAIENDE
     server, en zo'n meting hoort bij de code van die dag en bij geen andere.

     Vijf van de acht dragen (nog) geen stempel. Dat wordt hier niet weggepoetst:
     versheid meldt ze dan als "ouderdom niet vast te stellen", en dat is de
     eerlijke uitslag en tevens de aansporing om er een te zetten. Ze hier
     WEGLATEN omdat ze geen stempel hebben, zou de meter stil maken over precies
     de registers waarover het minst bekend is. */
  ['TIKKEN.json', 'npm run tikken', 'hoeveel tikken elke functie van het beginscherm af ligt, in een echte browser'],
  ['VINDBAAR.json', 'npm run vindbaar', 'of je een functie terugvindt met het woord dat erop staat'],
  ['WERELDSTIJL.json', 'npm run wereldstijl', 'of elk scherm de vormtaal van zijn wereld draagt'],
  ['SCHERMMUTATIES.json', 'npm run mutatie:scherm', 'of een schermtoets het merkt als er iets van het scherm verdwijnt'],
  ['RESOLVERBEREIK.json', 'npm run resolverbereik', 'de dekking van de resolver over elke toegestane route'],
  ['HERSTELPROEF.json', 'npm run herstelproef', 'of de tegenhanger werkelijk ongedaan maakt wat de heenweg deed'],
  ['DROOGLOOP.json', 'npm run droogloop', 'een plan werkelijk laten lopen, maar nergens waar het telt'],
  ['ONDERZOEKSKETEN.json', 'npm run onderzoeksketen', 'welke stations van het onderzoek van elkaar weten'],
  /* DE GELDKAART MELDT EN IS GEEN POORT, en dat is tegen de intuitie: hij gaat
     over geld, en de kolom GELD bestaat juist daarvoor. De grond is mechanisch
     en staat hierboven bij BEPROEVING en SABOTAGE -- alleen de registers die
     `npm run meetronde` in DEZELFDE job vers maakt mogen een poort zijn. Deze
     komt uit `npm run geldkaart`, die daar niet in zit en die veertien
     toetsbestanden aandrijft; als poort zou hij rood staan zodra iemand een
     regel code wijzigt, en een poort die per constructie rood staat wordt binnen
     twee weken uitgezet -- en neemt dan de vier mee die wel werken.

     Wat de HARDE kant van deze meting bewaakt, hangt niet hier maar in
     test/geldkaart.test.js: geen kernbak buiten zijn eigen poort. Dat is een nul
     die nul moet blijven en die zakt gewoon, ook als dit register oud is. */
  ['GELDKAART.json', 'npm run geldkaart', 'of elke waardemutatie door haar eigen poort ging (RTG Pay en RTG Bank)'],
  ['GELDDEKKING.json', 'npm run gelddekking', 'wat er van elke waardebewegende route bewezen is'],
  /* OOK EEN MELDER EN GEEN POORT, om exact dezelfde mechanische grond als de
     geldkaart hierboven: hij komt niet uit `npm run meetronde`. En er is hier
     een tweede reden die zwaarder weegt dan de eerste -- deze proef start drie
     servers, doodt er een met een crashverraad en kost een paar minuten. Een
     poort die dat bij elke commit afdwingt, staat binnen twee weken uit.

     Wat deze meting HARD maakt, hangt net als bij de geldkaart niet hier maar
     in een toets: test/factuurproef.test.js bewaakt de regel die bepaalt wat
     als een economische mutatie telt, en die zakt gewoon. */
  ['FACTUURPROEF.json', 'npm run factuurproef:vast', 'of een geldpad van begin tot eind heel blijft: tweede aanroep, crash, herhaling'],
  /* HERSTELBESLUIT.json STAAT HIER BEWUST NIET, en dat is geen vergetelheid.
     Deze lijst is de INSTRUMENTENlijst: scripts/meetkeuring.js leest hem om te
     bepalen welk script welk register vult, en eist van elk instrument een
     stempel. Een met de hand bijgehouden VERKLARING wordt door geen script
     geschreven; een stempel erop zou beweren dat er gemeten is waar een mens
     heeft besloten. IDEMBESLUIT.json en ROLLBACKBESLUIT.json staan er om
     dezelfde reden niet in.

     Zijn veroudering wordt wel bewaakt, maar langs de andere weg: hij hangt in
     scripts/lib/metingen.js aan geldRoutesHerstelOnbesloten en
     geldRoutesHerstelTegenspraak. Komt er een geldroute bij waarover niemand
     iets heeft gezegd, dan stijgt de eerste en zakt de ratel. */

  /* DE BEWIJSLADDER (KEURING.md par. 7): welke soorten bewijs dit huis levert,
     waar ze draaien en wat ze achterlaten. Hij hoort hier omdat hij veroudert
     zonder dat iemand hem aanraakt: zijn invoer zijn .github/workflows en de
     lagen van scripts/slotsuite.js, dus een poort die er in de keten bij komt
     maakt dit register stil onvolledig. Melding en geen poort -- de tand die op
     zijn INHOUD bijt is `bewijsAlleenKeten` in NORM.json. */
  ['BEWIJSLADDER.json', 'npm run bewijsladder:vast', 'welke soorten bewijs er draaien, lokaal en in de keten'],

  /* DE VIJF VAN DE BESTURINGSLAAG (MODULAIR.md).

     Ze horen hier om precies de reden die hierboven al twee keer is opgeschreven,
     en bij deze vijf weegt hij zwaarder dan gemiddeld: DRIE ervan meten tegen een
     DRAAIENDE server (de tredeproef klopt elke trede aan, de zaakwig loopt een
     hele bestelling, en de activering leest de kern-tas uit een echte boot). Zo'n
     meting hoort bij de code van die dag en bij geen andere. Een verouderde
     TREDEPROEF.json die "0 lekken" meldt terwijl er sindsdien routes bij kwamen,
     is erger dan geen meting: hij geeft een getal, en getallen worden geloofd.

     Ze staan in de volgorde waarin ze iets zeggen: eerst de structuur (wat hangt
     waaraan), dan wat een schakelaar werkelijk aanzet, dan de treden zelf, dan de
     ingangen die geen route zijn, en tot slot de ene keten van begin tot eind. */
  ['VERSTRENGELING.json', 'npm run verstrengeling:vast', 'de require-graaf als laag+domein, en welke rand niemand verklaard heeft'],
  ['ACTIVERING.json', 'npm run activering:vast', 'wat een functie aanzetten werkelijk aanzet, met de graad van zekerheid erbij'],
  ['TREDEPROEF.json', 'node scripts/tredeproef.js --alle --vastleggen', 'of een trede lekt: zuiver, beproefd, de rondgang en de ingangen buiten HTTP'],
  ['WEKKERS.json', 'npm run wekkers:vast', 'de ingangen die geen route zijn (klok, bus, luisteraar, werker) en welke functie ze doen'],
  ['ZAAKWIG.json', 'npm run zaakwig:vast', 'een bestelling van het lid tot in de kassa, op drie treden, op de bedrijfsinvarianten'],

  /* EN DE MEETLEER, die over deze registers zelf gaat.

     Hij hoort hier om de reden die hij zelf handhaaft, en dat is geen woordspel:
     een verouderde meetleer meldt hoeveel registers hun lezer remmen, gemeten op
     een boom die er niet meer is. Een instrument dat over eerlijkheid van
     metingen gaat en zelf niet onder toezicht staat, is het eerste dat niemand
     serieus neemt. */
  ['MEETLEER.json', 'npm run meetleer:vast', 'of een register de lezer er meer uit laat concluderen dan het aantoont'],

  /* ZESTIEN METERS DIE MET DE SAMENVOEGING VAN #180, #181 EN #182 BINNENKWAMEN.

     Dezelfde vorm als de acht hierboven, en dezelfde les: elke tak zette zijn
     eigen registers neer en geen van de drie kwam eraan toe ze onder toezicht te
     stellen -- dat valt pas op als je ze bij elkaar legt.
     test/versheidsdekking.test.js legde ze alle zestien op tafel.

     Vier ervan meten tegen een DRAAIENDE server (de drie ketenproeven en de
     contextproef), en daar weegt veroudering het zwaarst: zo'n uitslag hoort bij
     de code van die dag en bij geen andere. Een verouderde TAFELPROEF.json die
     "de keten sluit" meldt terwijl er sindsdien een schakel is verlegd, is erger
     dan geen meting.

     Ze staan in de volgorde waarin ze iets zeggen: eerst de drie gouden ketens
     en wat ze delen, dan de metingen over de code zelf, dan de twee kaarten. */
  ['TAFELPROEF.json', 'npm run tafelproef:vast', 'of de horecaketen sluit, van tafel tot correctie'],
  ['RITPROEF.json', 'npm run ritproef:vast', 'of de ritketen sluit, van aanvraag tot afronding'],
  ['TOELATINGSPROEF.json', 'npm run toelatingsproef:vast', 'of de toelatingsketen sluit, van aanvraag tot zaak'],
  /* De navigatieproef staat NAAST de drie gouden ketens en niet ertussen: hij
     meet geen keten tussen actoren maar de belofte van EEN scherm, in een echte
     browser (BETROUWBAARHEID.md par. 1). Daarom telt scripts/ketenvorm.js hem
     ook niet mee -- wat drie ketens delen, wordt vertroebeld door een vierde die
     iets anders is. Veroudering weegt hier even zwaar: hij draait tegen een
     draaiende server EN een browser, dus zijn uitslag hoort bij de code van die
     dag en bij geen andere. */
  ['NAVIGATIEPROEF.json', 'npm run navigatieproef:vast', 'of RTG Navigatie zijn belofte houdt: van waar ik sta naar mijn bestemming'],
  ['MOVEPROEF.json', 'npm run moveproef:vast', 'of een lid RTG Move werkelijk kan gebruiken: van een boeking naar een oordeel op het scherm'],
  ['KETENVORM.json', 'npm run ketenvorm:vast', 'wat de drie gouden ketens werkelijk delen (actoren, beloften)'],
  ['DOODSPOOR.json', 'npm run doodspoor:vast', 'of een handeling ergens AANKOMT, of een verklaring draagt waarom niet'],
  ['DOORWERKING.json', 'npm run doorwerking:vast', 'of een gegeven dat een keer is opgegeven doorwerkt, met doel en actualiteit'],
  ['RITMIGRATIE.json', 'npm run ritmigratie:vast', 'welke lezers van db.data.rides wanneer naar de opdrachtwereld kunnen'],
  ['CODEWERELD.json', 'node scripts/codewereld.js --vastleggen', 'wat de registers samen over deze code beweren'],
  /* Het tekstoppervlak veroudert bij elke merge die schermen meebrengt, en
     dat is precies wat er op 7 september gebeurde: main bracht twaalf
     schermen mee, het register bleef op 24.110 staan en keuringsregel 68
     meldde de +290 alleen in de schaduw. Wie hier niet kijkt, ratelt tegen
     een verouderde basislijn. */
  ['TEKSTOPPERVLAK.json', 'npm run tekstoppervlak', 'waar gebruikerszichtbare tekst ontstaat, en de basislijn van keuringsregel 68'],
  ['APPWERKT.json', 'npm run appwerkt', 'welke apps werkelijk werken, en de defecten die de meter vond'],
  ['AANROEPGRAAF.json', 'node scripts/aanroepgraaf.js --vastleggen', 'wie wie aanroept in server/ en scripts/'],
  ['KERNHERKOMST.json', 'node scripts/kernherkomst.js --vastleggen', 'waar een kernnaam vandaan komt en wie hem doorgeeft'],
  ['SYMBOLEN.json', 'node scripts/symbolen.js --vastleggen', 'welke functies waar wonen'],
  ['SCHERMGEDRAG.json', 'node scripts/schermgedrag.js --vastleggen', 'wat een scherm werkelijk doet, gelezen uit zijn eigen script'],
  ['SCHERMROUTES.json', 'node scripts/schermroutes.js --vastleggen', 'welk bestand in public/ welk API-pad noemt, en welke daarvan dood zijn'],
  ['ROUTEBRON.json', 'node scripts/routebron.js --vastleggen', 'de routelijst waar SCHERMROUTES tegen meet -- veroudert hij, dan verzint de dode-padenteller er'],
  ['CONTEXTPROEF.json', 'node scripts/contextproef.js --vastleggen', 'of de async-context blijft staan waar hij moet blijven staan'],
  ['FAALPROEF.json', 'node scripts/faalproef.js --vastleggen', 'wat er gebeurt als een afhankelijkheid wegvalt'],
  /* LUSSEN.json veroudert sneller dan de meeste registers, want elke lus die
     erbij komt is een lus die er niet in staat. Een verouderde lusindex ziet er
     identiek uit aan een verse en zegt dan dat er nul altijd-ware lussen zonder
     uitweg zijn, terwijl er sindsdien drie bij kunnen zijn gekomen -- en aan dat
     getal hangt sinds 11 september 2026 een normtand. */
  ['LUSSEN.json', 'npm run lussen', 'elke cyclische gedraging met zijn terminatiegraad, en de drie schulden waar NORM.json op ratelt'],
  ['CARRIEREVORM.json', 'node scripts/carrierevorm.js --vastleggen', 'of de talentdomeinen een datavorm delen -- CARRIERE.md par. 0 rust erop, dus een verouderde uitslag draagt daar een conclusie die niemand nog heeft nagerekend']
];

/* De lezer van beide stempelvormen woont in ./lib/stempel.js -- hij stond hier
   als tweede kopie, en scripts/vertrouwen.js had er een DERDE die een van de
   twee vormen miste. Zie de uitleg bij stempelVan() daar. De kopie die hier
   stond is weg: hij werd nergens meer aangeroepen, en een dode kopie van een
   waarheid is de kopie die als eerste uit de pas gaat lopen. */

/* HET REGISTER ZEGT ZELF HOE HET WORDT VERVERST, en dat wint van de tabel
   hierboven. Hier stond alleen die tabel, en hij liep uiteen: SCHERMLEUGEN.json
   droeg `"hoe": "node --test test/liegend-scherm.e2e.js"`
   terwijl de tabel `node scripts/schermleugen.js` beloofde -- een bestand dat
   niet bestaat. Twee plekken met een antwoord op dezelfde vraag, en de ene had
   ongelijk (LAT.md regel 4). De tabel blijft staan voor registers die het zelf
   niet zeggen; wie het wel zegt, wordt geloofd. */
function hoeVan(naam, uitTabel) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));
    if (j && typeof j.hoe === 'string' && j.hoe.trim()) return j.hoe.trim();
  } catch (e) { /* dan de tabel */ }
  return uitTabel;
}

/* WELKE RIJEN DE POORT LATEN ZAKKEN. Een losse functie en geen filter in meet(),
   omdat er precies een regel in zit die je niet aan de echte registers kunt zien
   zolang ze allemaal bestaan: een ONTBREKEND register in een poortklasse telt
   net zo hard als een verouderde. "Er is niets gemeten" is geen betere
   uitgangspositie dan "er is iets ouds gemeten" -- het is een slechtere, en het
   is precies de vorm waarin een poort stil opengaat. Zo kan test/versheidspoort
   die regel voeren met een verzonnen rij en hem echt zien zakken. */
function poortRijen(rijen) {
  return (rijen || []).filter(r => r && r.klasse !== OVERIG && r.staat !== 'vers');
}

function meet() {
  const nu = nuCommit();
  const rijen = REGISTERS.map(([naam, tabelHoe, wat, klasse]) => {
    const hoe = hoeVan(naam, tabelHoe);
    const s = stempelVan(naam);
    const k = klasse || OVERIG;
    if (s === undefined) {
      return { register: naam, hoe, wat, klasse: k, staat: 'ontbreekt',
        reden: 'dit register bestaat niet; er is dus niets gemeten' };
    }
    const v = versheid(s, nu);
    return { register: naam, hoe, wat, klasse: k, staat: v.vers ? 'vers' : 'verouderd', reden: v.reden,
      op: s && s.op ? s.op : null, commit: s && s.commit ? s.commit : null };
  });
  const poort = poortRijen(rijen);
  return { nu, rijen, poort,
    vers: rijen.filter(r => r.staat === 'vers').length,
    verouderd: rijen.filter(r => r.staat === 'verouderd').length,
    ontbreekt: rijen.filter(r => r.staat === 'ontbreekt').length };
}

module.exports = { meet, poortRijen, REGISTERS, stempelVan };

if (require.main !== module) return;

const uit = meet();
/* GEEN process.exit() NA EEN console.log -- ZIE DE UITLEG ONDERAAN. Met --json
   is het gevaar het grootst: een afgekapte JSON is geen foutmelding maar
   ongeldige invoer voor wie hem uitleest. */
if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); return; }

console.log('\n=== DE VERSHEID VAN DE REGISTERS ===\n');
console.log('  de code staat op commit ' + (uit.nu || 'onbekend') + '\n');
for (const r of uit.rijen) {
  const merk = r.staat === 'vers' ? '  ok  ' : r.staat === 'ontbreekt' ? '  --  ' : '  !!  ';
  console.log(merk + r.register.padEnd(20) + r.staat);
  if (r.staat !== 'vers') {
    console.log('        ' + r.reden);
    console.log('        herstel: ' + r.hoe);
  }
}
console.log('\n  vers ' + uit.vers + '   verouderd ' + uit.verouderd + '   ontbreekt ' + uit.ontbreekt);

/* WEL EEN POORT, MAAR ALLEEN WAAR HET MOET.

   Hier stond "GEEN POORT: dit script meldt en oordeelt niet", met als reden dat
   een register dat achterloopt op een typefout-commit geen defect is. Die reden
   klopt nog steeds -- voor de meeste registers. Hij klopt niet voor de registers
   die zeggen of iemand binnenkomt waar hij niet hoort, of dat er met geld iets
   misgaat. Daar is "waarschijnlijk nog goed" precies de redenering waarmee een
   achterstand jaren blijft liggen, en een melding die niemand tegenhoudt heeft
   die achterstand ook nooit tegengehouden (TAKEN.md 7.3).

   De rest blijft melden. Een poort die op alle achttien registers zakt, is
   binnen een week een poort die iedereen met `|| true` uitzet -- en dan houdt
   hij ook de zes tegen die er wel toe deden. */
if (uit.poort.length) {
  console.log('\n\x1b[31mDE VERSHEIDSPOORT ZAKT: ' + uit.poort.length +
    ' register(s) over beveiliging of geld zijn niet vers.\x1b[0m');
  for (const r of uit.poort) {
    console.log('  - ' + r.register + ' (' + r.klasse + '): ' + r.reden);
    console.log('      herstel: ' + r.hoe);
  }
  console.log('\n  Deze vier melden niet alleen, ze houden tegen. Wat ze zeggen -- wie er');
  console.log('  binnenkomt en wat er met geld gebeurt -- is niet iets om op een oude meting te');
  console.log('  geloven. De andere registers hierboven melden alleen.\n');
  process.exitCode = 1;
}

/* WAAROM HIER GEEN process.exit() STAAT, en dat is geen stijlkwestie.

   Hier stond `process.exit(1)` direct na de regels hierboven. Zodra stdout een
   PIJP is -- en dat is hij onder execFileSync, in de CI en achter elke `| tee`
   -- schrijft Node asynchroon. process.exit() wacht daar niet op: wat nog in de
   buffer staat, gaat verloren.

   GEMETEN, en niet bedacht: in een volle suite (12.377 toetsen, de machine vol)
   zakte test/versheidspoort.test.js op regel 123. De exitcode was keurig 1, maar
   de opgevangen uitvoer HIELD OP na het laatste register -- de samenvattingsregel
   en het hele blok "DE VERSHEIDSPOORT ZAKT" waren weg. Los gedraaid haalde
   dezelfde toets het wel. Dat is precies het gedrag waar "flaky" op geplakt
   wordt, en het was een echte fout: een poort die met 1 afsluit zonder te zeggen
   WAAROM, laat een mens in de CI achter met een afgekapt rapport.

   Dit script is volledig synchroon (fs, path, en lib/stempel), dus met een lege
   gebeurtenislus stopt Node vanzelf zodra stdout leeg is. `process.exitCode`
   levert dezelfde afsluitcode en wacht wel. */
