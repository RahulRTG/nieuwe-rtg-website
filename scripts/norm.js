#!/usr/bin/env node
/* ============================================================================
   DE NORM -- een ratel, geen rapportcijfer.

   Het probleem met een kwaliteitsronde is dat hij verdampt. Je haalt de lat,
   je gaat verder, en een half jaar later is de helft weer weggezakt zonder dat
   iemand een beslissing heeft genomen. Niemand heeft het stukgemaakt; het is
   gewoon gebeurd.

   Dit script maakt daar een grens van. In NORM.json staat waar de code NU
   staat. Bij elke draai wordt de huidige stand daarmee vergeleken:

     - slechter dan de norm -> de poort gaat dicht (exit 1)
     - beter dan de norm    -> geen fout, maar wel de melding dat de norm
                               strakker gezet kan worden

   De norm kan dus alleen omlaag (strenger). Dat is de hele truc: wat een keer
   goed is, kan niet meer stilletjes slechter worden. `--vastleggen` schrijft de
   verbetering weg, en weigert een verslechtering vast te leggen -- wie de lat
   toch wil verlagen moet NORM.json met de hand wijzigen, en dan staat het als
   bewuste keuze in de git-historie in plaats van als sluipende erosie.

   WAAROM DIT ER IS EN NIET ALLEEN DE SUITE

   De slotsuite meet en meldt. Hij zakt op wat STUK is, maar niet op wat is
   WEGGEZAKT: gaat de dekking van 60% naar 51%, dan blijft alles groen en staat
   het als "kan beter" in een lijst van 127 punten die niemand meer leest. Deze
   ratel is precies dat verschil.

   Draai:  node scripts/norm.js
           node scripts/norm.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { zonderCommentaar } = require('./lib/bron');
const { vuileRegisters } = require('./lib/paspoort');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');

/* Elke meter met de richting waarin hij mag bewegen. `omlaag` betekent: een
   lager getal is beter (minder ongedekte endpoints). `omhoog`: hoger is beter. */
const METERS = [
  /* De ratel op regel 10 zelf. check.js regel 35 eist dat ELKE meter in de
     registratie van test/meterijk.test.js staat; deze meter telt hoeveel er
     daar met alleen een REDEN staan in plaats van een proef. Dat is het
     eerlijke gat: meters die we niet hebben zien uitslaan. Hij mag alleen
     omlaag, dus het gat kan niet groeien en wordt over de tijd kleiner. */
  { sleutel: 'metersOngeijkt', richting: 'omlaag', wat: 'meters met alleen een reden, zonder proef die ze laat uitslaan' },
  { sleutel: 'endpointsZonderTest', richting: 'omlaag', wat: 'endpoints die in geen enkele test voorkomen' },
  { sleutel: 'dekkingPct', richting: 'omhoog', wat: 'percentage endpoints dat in een test voorkomt' },
  /* De 100%-richting: bewijs mag alleen groeien en schuld mag alleen krimpen.
     Niet als ambitie maar als tand -- een gezakte cel of een gegroeide post
     gaat vanaf nu langs een mens met een reden in NORM.json. */
  { sleutel: 'bewijsCellenBewezen', richting: 'omhoog', wat: 'cellen (route x schakel) in de bewijsmatrix met bewijs' },
  { sleutel: 'bewijsAchterstand', richting: 'omlaag', wat: 'openstaande bewijsschuld (meetwerk + instrument; de grens telt niet mee)' },
  { sleutel: 'keuringStuk', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "stuk"' },
  { sleutel: 'keuringScheef', richting: 'omlaag', wat: 'bevindingen van de keuring met soort "scheef"' },
  /* keuringBeter WAS EEN GEBLENDE TELLER, en daarmee de enige meter in deze
     lijst die niet kon ratelen. Hij telde drie onvergelijkbare dingen bij
     elkaar op: bestanden die vlak onder de 10 kB-grens zitten, functienamen
     die in meer dan twee kernmodules voorkomen, en domeinen met endpoints
     zonder toets. Dat getal loopt op zodra je een legitiem bestand toevoegt,
     en -- erger -- een daling in de ene groep maskeerde een stijging in de
     andere. Precies zo dook de dubbeling van teVaak() onder in het totaal.

     Drie losse meters is niet losser maar STRAKKER: elke groep moet nu op
     zichzelf de goede kant op, en verrekenen kan niet meer. Voor de eerlijkheid:
     de som stond op 126 toen de norm werd vastgelegd en staat nu op 130, dus
     over die vier is geen ratel meer die klaagt. Ze zijn ontstaan door bestanden
     toe te voegen, niet door iets te laten verslechteren; de enige inhoudelijke
     van de vijf (teVaak in drie kernmodules) is opgelost. */
  { sleutel: 'keuringOmvang', richting: 'omlaag', wat: 'bestanden die vlak onder de 10 kB-grens zitten' },
  /* DE TAND DIE ER NOOIT WAS. De omvangregel in scripts/keuring.js meldde
     alleen bestanden VLAK ONDER de grens, en alles erboven viel stilzwijgend
     buiten de keuring -- server/server.js van 212 kB voorop. Er was dus een
     meter voor de bijna-overtreders en geen voor de overtreders.

     Apart van keuringOmvang en niet erbij opgeteld: dan zou een bestand dat
     over de grens gaat kunnen wegvallen tegen een bestand dat er net onder
     duikt, en dat is precies de verrekening waar de drie losse keuringmeters
     hierboven al een keer voor zijn gesplitst. */
  { sleutel: 'keuringTeGroot', richting: 'omlaag', wat: 'servermodules die ECHT over de 10 kB-grens zijn' },
  { sleutel: 'keuringDubbeling', richting: 'omlaag', wat: 'functienamen die in meer dan twee kernmodules staan' },
  { sleutel: 'keuringDekkingAdvies', richting: 'omlaag', wat: 'domeinen met endpoints zonder toets' },
  { sleutel: 'dependencies', richting: 'omlaag', wat: 'externe pakketten in de RUNTIME (de nul is een principe, geen toeval)' },
  { sleutel: 'devPakketten', richting: 'omlaag', wat: 'externe pakketten om te METEN (gereedschap, draait nooit mee voor een bezoeker)' },
  { sleutel: 'testbestanden', richting: 'omhoog', wat: 'testbestanden' },
  /* DE TWEE METERS OVER TOETSEN DIE ER WEL ZIJN MAAR NIET DRAAIEN.

     Aanleiding: acht Postgres-toetsbestanden poortten zichzelf op DATABASE_URL,
     `npm test` geeft die bewust niet mee, en de enige draaier die dat wel deed
     had een handgeschreven lijst waar ze niet in stonden. Ze telden maandenlang
     mee als dekking zonder ooit uitgevoerd te zijn.

     `zelfpoortendeToetsen` telt de toetsen die zichzelf kunnen overslaan. Elke
     nieuwe is een toets die op de standaardmachine NIET draait, dus dit getal
     mag alleen omlaag. Het staat niet op nul en dat hoeft ook niet -- een toets
     die een echte database vraagt hoort zich over te slaan als die er niet is.
     Wat niet mag, is dat het er stilletjes meer worden.

     `e2eBestanden` telt de schermtoetsen. Die draaien niet mee in `npm test`
     (eigen glob, eigen CI-baan) en zijn daardoor het makkelijkst te vergeten
     hoekje van de suite: verdwijnt er een, dan merkt de hoofdsuite niets. */
  /* Staat elke functie in de boardroom? Een route die door geen enkele functie
     wordt bewaakt is vanuit de schakelkast onzichtbaar: niet uit te zetten,
     niet per stad te sluiten, en de storingswachter komt er nooit aan. Dat gat
     groeit vanzelf (routes schrijven is stap een, de catalogus bijwerken stap
     twee), dus het hoort aan een ratel. scripts/schakelbaar.js meet het. */
  { sleutel: 'routesNietSchakelbaar', richting: 'omlaag', wat: 'API-routes die niet vanuit de boardroom te schakelen zijn' },
  /* DE DEUREN NAAR db.data (scripts/deuren.js).

     De contractlaag is de enige weg naar een andere opslag, en de afbouw die
     daarvoor nodig is duurt langer dan wie dan ook onthoudt. 706 bestanden
     buiten server/db/ raken db.data rechtstreeks aan; er is dus geen doorgang
     waar een Data Fabric onder past. Zonder ratel komt er stilletjes een deur
     bij zodra iemand haast heeft, en dan is de afbouw geen afbouw meer.

     TWEE METERS EN GEEN EEN. Een schrijver bepaalt of de invarianten van een
     domein kloppen; een lezer bepaalt of je de opslag kunt vervangen. Opgeteld
     zou een opgeruimde lezer een nieuwe schrijver maskeren -- dezelfde
     verrekening waarvoor keuringOmvang en keuringTeGroot al zijn gesplitst. */
  { sleutel: 'dbDeuren', richting: 'omlaag', wat: 'bestanden buiten server/db/ die db.data rechtstreeks aanraken' },
  { sleutel: 'dbDeurenSchrijvend', richting: 'omlaag', wat: 'bestanden buiten server/db/ die rechtstreeks IN db.data schrijven' },
  /* DE GRENZEN TUSSEN DE DOMEINEN (scripts/grenzen.js).

     server.js geeft elke router hetzelfde object `kern` met ruim driehonderd
     eigenschappen. Er is dus geen grens: elk domein kan bij alles van elk ander.
     Dat is niet op te lossen door code te verplaatsen -- server.js ging van 183
     naar 103 kB en de verstrengeling bleef exact gelijk. Wat ontbrak was een
     getal.

     Wat de meting liet zien, en waarom dit oplosbaar is: van de 951 aangeraakte
     eigenschappen wordt 85% door PRECIES EEN domein gebruikt. Slechts 26 door
     vijf of meer -- app, auth, supplierAuth, db, save, crypto. Dat laatste
     lijstje is een echte interface. De zak is gedeeld, de inhoud niet.

     `kernGedeeld` is de meter die telt: eigenschappen die meer dan een domein
     aanraakt. Omlaag brengen betekent dat een domein iets van zichzelf
     terugneemt, en dat is precies wat "een domein kan als eigen proces draaien"
     waar moet maken. `kernBreedsteBestand` pakt de andere kant: een routebestand
     dat honderdnegenendertig namen nodig heeft, weet niet wat het is. */
  { sleutel: 'kernBreedte', richting: 'omlaag', wat: 'kern-eigenschappen die routes aanraken' },
  { sleutel: 'kernGedeeld', richting: 'omlaag', wat: 'kern-eigenschappen die MEER dan een domein aanraakt (de echte koppeling)' },
  { sleutel: 'kernBreedsteBestand', richting: 'omlaag', wat: 'namen die het breedste enkele routebestand uit kern haalt' },
  /* EN TOEN BLEEK DE HELFT VAN DIE BREEDTE NEP. De twaalf breedste
     routebestanden reikten alle twaalf naar 134-139 namen. Dat waren geen twaalf
     brede domeinen: het was EEN destructurering die twaalf keer was overgenomen.
     server/routes/supplier/kamers.js pakte honderdvierendertig namen uit de kern,
     gebruikte er NUL van, en riep daarna twee submodules aan -- twintig regels
     bestand, negen regels kop.

     Over server/routes samen: 3929 namen gepakt en nergens gebruikt, over 62
     bestanden. Zo'n kop zegt niet wat een bestand nodig heeft maar wat een
     broertje ooit nodig had, en dan is er geen grens meer, ook niet op papier.
     Ze zijn alle 3929 weg; wat er nu in een kop staat, wordt ook echt gebruikt.

     Deze meter houdt dat vast, en regel 39 in scripts/check.js weigert een
     nieuwe. Hij hoort op nul te blijven staan: elke stijging is een kop die
     opnieuw breder is dan het bestand. */
  { sleutel: 'kernOngebruikt', richting: 'omlaag', wat: 'namen die een routebestand uit kern PAKT en nergens gebruikt' },
  /* KAN DEZE TOETS EIGENLIJK ZAKKEN? (scripts/mutatie.js -> MUTATIES.json)

     LAT.md regel 9 zegt dat een toets die niet kan zakken erger is dan geen
     toets. BEWIJS.md liet zien hoe groot dat gat hier was: van de 612
     toetsbestanden noemden er 586 geen enkele mutatie. Dat is geen bewijs dat ze
     niets waard zijn -- het is bewijs dat niemand het WEET, en dat is precies wat
     een meter moet oplossen.

     De motor probeert het per bestand. Pure toetsen krijgen een mechanische
     mutatie in de module die ze laden; servertoetsen krijgen de liegpoort over
     alle /api/-paden. Zakt de toets: bewezen gevoelig. Blijft hij groen: hij legt
     het gedrag dat de motor kan raken niet vast.

     TWEE METERS EN GEEN EEN, want dat zijn twee verschillende dingen:

       toetsenOngevoeligPct  van de GEMETEN toetsen: welk deel bleef groen. Dit is
                             de echte schuld.
       toetsenNietGemeten    de motor is er nog niet langs geweest. Dit is de
                             dekking van het INSTRUMENT, niet van de code.

     Ze samentellen zou de tweede voor de eerste laten doorgaan -- dezelfde fout
     als de geblende teller hieronder, die om die reden is opgeknipt.

     EN WAAROM DE EERSTE EEN PERCENTAGE IS EN GEEN AANTAL. Hij stond eerst als
     `toetsenOverleefdeMutatie`, een absoluut getal, met een grondwaarde van 6 na
     de eerste zestig metingen. Vier metingen later stond hij op 8 en was de ratel
     rood -- terwijl er niets slechter was geworden: er was alleen MEER gemeten.
     Een meter die rood wordt omdat je hem gebruikt, leert iedereen om te stoppen
     met meten. Als aandeel van wat er gemeten is, is hij onafhankelijk van hoe
     ver de motor gekomen is, en dan betekent een stijging wat hij zegt. */
  { sleutel: 'toetsenOngevoeligPct', richting: 'omlaag', wat: 'aandeel van de GEMETEN toetsen dat een mutatie in eigen bron overleefde (%)' },
  { sleutel: 'toetsenNietGemeten', richting: 'omlaag', wat: 'toetsen waar de mutatiemotor nog niet langs is geweest' },
  /* DE DERDE VOORRAAD, en hij stond als enige NIET op de ratel.
     scripts/tandeloos.js telt beweringen die op een LEGE verzameling vanzelf
     slagen: `assert.deepEqual(r.body.dingen, [])` bewijst niets als `dingen`
     altijd leeg is. Dat was een CLI-only leeslijst -- je moest hem draaien om te
     weten hoe hij ervoor stond, en dus wist niemand het. Zijn twee zusters
     (endpointsZonderTest en toetsenNietGemeten) staan hier wel, en konden dus
     niet stil groeien; deze wel.

     Hij blijft een LEESLIJST en geen poort: soms is "er staat niets" precies wat
     je toetst, en daar heeft dat script zijn eigen beoordeelde vrijstellingen
     voor. De ratel zegt alleen dat het er niet MEER mogen worden zonder dat
     iemand het opschrijft. */
  { sleutel: 'beweringenZonderVulcontrole', richting: 'omlaag', wat: 'beweringen die op een lege verzameling vanzelf slagen (scripts/tandeloos.js)' },
  /* DEZE METER WAS EEN GEBLENDE TELLER, precies zoals keuringBeter dat was, en
     hij liep om dezelfde reden vast: hij telde twee onvergelijkbare dingen bij
     elkaar op, en de ene groep botste met een ANDERE meter in deze lijst.

     Een toets kan zichzelf om twee heel verschillende redenen overslaan:

     1. ER MIST EEN DIENST (Postgres, Redis, openssl). Dat is het gat waar deze
        meter voor is gemaakt: acht pg-toetsbestanden telden maandenlang mee als
        dekking zonder ooit te draaien. Zeventien aanroepen, allemaal in
        *.test.js, en dit getal mag alleen omlaag.
     2. ER MIST EEN BROWSER. Elke *.e2e.js begint met `{ skip: pw ? false : ... }`.
        Honderdeen aanroepen. Die staan er niet uit slordigheid maar zodat wie
        de suite zonder Playwright draait geen muur van rood krijgt -- en het
        risico dat daarbij hoort is AL gedekt: test/browserpoort.e2e.js slaat
        zichzelf nooit over en zakt hard zodra RTG_E2E_STRICT=1 staat en er geen
        browser is. Dat staat in CI aan.

     Samen geteld werkte de ratel tegen zichzelf: een schermtoets toevoegen liet
     e2eBestanden stijgen (goed, want die moet omhoog) EN zelfpoortendeToetsen
     stijgen (fout, want die moet omlaag). Twee tanden die tegengesteld
     reageren op dezelfde verbetering.

     Apart geteld is dit niet losser maar STRAKKER: de dienstgroep ratelt nu op
     17 in plaats van te mogen wegvallen tegen de honderdeen browsergevallen. */
  { sleutel: 'zelfpoortendeToetsen', richting: 'omlaag', wat: 'toetsen die zichzelf overslaan omdat een DIENST ontbreekt (Postgres, Redis, openssl)' },
  { sleutel: 'browserpoortToetsen', richting: 'omhoog', wat: 'schermtoetsen achter de browserpoort (bewaakt door test/browserpoort.e2e.js)' },
  { sleutel: 'e2eBestanden', richting: 'omhoog', wat: 'schermtoetsen (*.e2e.js, draaien niet mee in npm test)' },
  /* DE LAATSTE unsafe-inline IN DE CSP, geteld in plaats van beschreven.

     script-src en style-src draaien op een nonce. style-src-attr niet: daar
     staat nog 'unsafe-inline', en dat is geen vergetelheid maar een openstaande
     post -- er staan duizenden style="..."-attributen in public/, en CSP kent
     geen stempel voor een attribuut. Zolang dat getal niet nul is, kan die
     richtlijn niet dicht.

     Waarom dit aan een RATEL hangt en niet in een zin in de README: een schuld
     die je opschrijft groeit, een schuld die je telt niet. Elke nieuwe
     style="..." in een sjabloon zou de dag verlengen waarop die richtlijn dicht
     kan, zonder dat iemand er een besluit over neemt. Nu kan het getal alleen
     omlaag.

     Wat NIET meetelt: el.style.kleur = '...' en andere CSSOM-schrijfacties. Die
     gaan buiten de ontleder om en worden door CSP niet gecontroleerd -- ze zijn
     dus geen schuld maar juist de uitweg. */
  /* DE VORMTAAL IS GESPECIFICEERD EN WORDT NIET GEDRAGEN, en dat was tot deze
     meter nergens te zien. ONTWERP.md legt de visuele laag van de RTG
     Interface Operating Standard vast,
     public/shared/rtg-ontwerp.css is de tokenlaag en test/ontwerp.test.js houdt
     hem streng -- maar die toets meet de tokenlaag TEGEN ZICHZELF. Van de
     app-pagina's laadde er precies EEN hem, en rtg-materiaal.css laadde er nul.
     Een ontwerpsysteem dat nergens wordt ingesloten is geen systeem maar een
     document, en zonder teller kan dat jaren zo blijven zonder dat er iets rood
     wordt. Deze meter mag dus alleen omlaag. */
  { sleutel: 'schermenZonderVormtaal', richting: 'omlaag', wat: 'app-pagina\'s die de tokenlaag van ONTWERP.md niet insluiten' },
  { sleutel: 'inlineStijlAttributen', richting: 'omlaag', wat: 'style="..."-attributen in public/ (houden style-src-attr open)' },
  /* DE TWEE METERS DIE OVER DE RATEL ZELF GAAN.

     Alles hierboven bewaakt de code. Deze twee bewaken de BEWAKER, en ze staan
     er omdat een ratel een eigenschap heeft die makkelijk over het hoofd wordt
     gezien: hij kan alleen tegenhouden wat hij meet. Wat er niet in staat, kan
     ongestraft alle kanten op -- niet omdat er een tand brak, maar omdat er
     nooit een tand was. Een ratel die niet groeit, dekt over de tijd een steeds
     kleiner deel van een steeds grotere codebase.

     `ratelTanden` telt hoeveel meters er geratelde zijn en mag alleen OMHOOG.
     Daarmee is de dekking van de ratel zelf niet meer stilzwijgend te
     verkleinen: twee meters samenvoegen tot een (wat een keer legitiem is
     gebeurd, zie de notitie over keuringBeter) is voortaan een handmatige
     verlaging, met notitie en al -- en dat is precies de goede prijs. Niet
     verboden, wel een besluit.

     `metingenZonderRatel` telt de meetbestanden in de wortel die aan geen
     enkele ratel hangen. Er wordt in dit huis veel meer gemeten dan geratelde:
     21 meetbestanden, en bij zes ervan houdt niets de getallen tegen als ze de
     verkeerde kant op lopen. Dat getal mag alleen omlaag, en het daalt door er
     een ratel bij te zetten -- niet door er een regel bij te schrijven; zie de
     kop van scripts/lib/metingen.js. */
  { sleutel: 'ratelTanden', richting: 'omhoog', wat: 'meters die aan een ratel hangen (de ratel mag niet krimpen)' },
  { sleutel: 'bronBlindeBestanden', richting: 'omlaag', wat: '.js-bestanden waar de commentaar-verwijderaar code kwijtraakt of niet gelezen kan worden' },
  { sleutel: 'delenZonderOnderwerp', richting: 'omlaag', wat: 'bundeldelen zonder onderwerpregel bovenin (zie BUNDELS.md)' },
  { sleutel: 'metingenZonderRatel', richting: 'omlaag', wat: 'meetbestanden in de wortel die aan geen enkele ratel hangen' },
  /* DE METER DIE OVER HET BEWIJS ZELF GAAT (STANDAARD.md par. 5).

     Alles hierboven meet de code of de ratel. Deze meet of de UITSLAGEN
     herhaalbaar zijn. Een register dat zijn meting uit een vuile boom haalt, is
     niet te reproduceren -- niet moeilijk, maar principieel niet: er bestaat
     geen commit om naar terug te keren. De uitslag mag bestaan; bewijs is hij
     niet.

     Hij stond bij het toevoegen op 18 van de 25 registers met een stempel,
     waaronder VERTROUWEN.json -- waarop de bewijspoort van kern/stuur/beleid.js
     zijn oordeel baseert. Alleen omlaag, en nul is haalbaar: het kost een
     meetronde vanaf een schone boom. De telling staat in scripts/lib/paspoort.js
     zodat de deltapoort met dezelfde functie telt als deze meter. */
  { sleutel: 'registersUitVuileBoom', richting: 'omlaag', wat: 'registers waarvan de meting uit een vuile werkboom komt (dus niet te herhalen)' }
];

/* De telling zelf, als losse functie met de bestandslijst als invoer -- zodat
   test/meterijk.test.js hem met een verzonnen bestand kan voeden en de meter
   echt kan zien uitslaan. Een meter die alleen zijn eigen repo kan lezen, is
   niet te ijken.

   WAT ER NIET IN DE LIJST HOORT, en dat is hier twee keer misgegaan voordat het
   klopte:

   1. public/dist/ -- geminificeerde bouwuitvoer.
   2. DE BUNDELS. public/apps/leverancier.js is de aaneengeplakte som van
      public/apps/leverancier/*.js. Tel je allebei, dan staat elk attribuut er
      twee keer in. Dat viel op omdat een veegbeurt van 491 attributen de meter
      982 liet dalen: precies twee keer zoveel. Een meter die een verbetering
      dubbel beloont, liegt net zo hard als een die hem mist -- en het getal
      8957 dat ik in de CSP-uitleg en de README heb gezet, was daarmee ook te
      hoog. De echte stand staat in NORM.json, met een notitie erover.

      De lijst van bundels komt uit scripts/bundel.js, dezelfde bron die
      check.js regel 13 gebruikt. Een tweede lijst zou binnen een week
      uiteenlopen (LAT.md regel 4). */
/* DOOR DE WRINGER, en dat is de vierde keer dat dit huis dezelfde val vindt
   (LAT.md regel 10): een meter die tekst voor code aanziet. Deze telde
   `style="` ook in COMMENTAAR mee, dus een regel uitleg die het attribuut
   noemt -- bijvoorbeeld om te zeggen dat er hier juist geen inline stijl mag
   staan -- duwde het getal omhoog. Dat straft het opschrijven van de regel af,
   en het is bovendien geen schuld: een attribuut in commentaar houdt geen
   style-src-attr open, want de ontleder ziet het nooit.

   Dezelfde wringer als check.js gebruikt, en met opzet niet een eigen
   afgeleide: een tweede stripper zou binnen een week uiteenlopen met de eerste
   (LAT.md regel 4). */
function telInlineStijl(lees, bestanden) {
  let n = 0;
  for (const b of bestanden) n += (zonderCommentaar(String(lees(b))).match(/style="/g) || []).length;
  return n;
}

/* ============================================================================
   DE PRESTATIEMETERS -- de tweede helft van de ratel.

   De meters hierboven komen uit de keuring: ze zijn statisch en altijd te
   berekenen. Prestatie is dat niet. p99, doorvoer, event-loopvertraging en
   hersteltijd komen uit De Beproeving, die een kwartier draait -- die kun je
   niet bij elke `npm run norm` opnieuw meten.

   Daarom schrijft scripts/beproeving.js zijn cijfers naar BEPROEVING.json en
   leest deze ratel ze daar. Drie dingen die daarbij misgaan als je er niet op
   let, en die hier alle drie zijn dichtgezet:

   1. HET BESTAND ONTBREEKT. Zonder maatregel zou de ratel dan vrolijk groen
      geven: geen invoer, geen oordeel, geen probleem. Dat is LAT.md regel 3.
      Staat er een grondwaarde in NORM.json, dan is een ontbrekend BEPROEVING.json
      een FOUT -- je hebt een lat gezet en die moet je blijven meten.
   2. EEN ANDERE MACHINE. 144 ms p99 op vier kernen is een ander getal dan
      144 ms op zestien; ze vergelijken zou de lat laten dansen op de vraag op
      welke laptop iemand toevallig draaide. Verschilt de vingerafdruk, dan
      vergelijkt de ratel NIET en zegt hij dat hardop -- en hij legt ook niets
      vast, want een grondwaarde van een andere machine is geen grondwaarde.
   3. EEN ANDERE MODUS. sqlite en Postgres meten niet hetzelfde platform.
      Zelfde behandeling.
   ========================================================================== */
const PRESTATIEBESTAND = path.join(WORTEL, 'BEPROEVING.json');
const PRESTATIEMETERS = [
  { sleutel: 'p99Ms', richting: 'omlaag', wat: 'latentie p99 onder de storm (ms)' },
  { sleutel: 'doorvoerPerSec', richting: 'omhoog', wat: 'afgehandelde verzoeken per seconde onder de storm' },
  { sleutel: 'eventLoopP99Ms', richting: 'omlaag', wat: 'event-loopvertraging p99 onder de storm (ms)' },
  { sleutel: 'herstelSeconden', richting: 'omlaag', wat: 'seconden tot een gewone aanroep weer normaal was' },
  { sleutel: 'verhalenSlaagPctStorm', richting: 'omhoog', wat: 'percentage goede verhalen dat de storm doorkwam' },
  { sleutel: 'geheugenHellingMBPerMin', richting: 'omlaag', wat: 'geheugengroei per minuut onder herhaalde last' }
];

/* De drie groepen van de keuring, apart geteld. Een groep die de keuring niet
   meer kent geeft 0 -- en dat is bewust GEEN stille nul: 0 is beter dan de
   grondwaarde, dus de ratel meldt het als een verbetering en dan hoort iemand
   te kijken of dat klopt of dat de groep gewoon verdwenen is. */
function telPerGroep(k) {
  const uit = { keuringOmvang: 0, keuringDubbeling: 0, keuringDekkingAdvies: 0 };
  const naar = { omvang: 'keuringOmvang', dubbeling: 'keuringDubbeling' };
  for (const b of (k.bevindingen || [])) {
    if (b.soort !== 'beter') continue;
    const sleutel = naar[b.groep];
    if (sleutel) uit[sleutel]++;
  }
  /* DE DEKKINGSMETER LEEST EEN GETAL EN GEEN MELDINGEN, en dat is de reparatie.

     Hij telde de dekking-meldingen van de keuring, en die zijn afgekapt op acht
     zodat het rapport leesbaar blijft. Er waren acht domeinen met gaten, dus
     stond de meter op zijn plafond en kon hij niet stijgen -- en dat stond in
     test/meterijk.test.js als REDEN waarom hij niet te ijken viel. Een meter die
     niet kan bewegen is geen meter; hij mat de slice.

     scripts/keuring.js geeft nu cijfers.dekking.domeinenMetGaten terug: alle
     domeinen, niet de eerste acht. Ontbreekt dat getal (een oudere keuring), dan
     vallen we terug op de oude telling en niet op nul -- nul zou als de beste
     score ooit gelden en de ratel zou dat vastleggen (LAT.md regel 3). */
  const echt = k.cijfers && k.cijfers.dekking && k.cijfers.dekking.domeinenMetGaten;
  if (typeof echt === 'number') uit.keuringDekkingAdvies = echt;
  else uit.keuringDekkingAdvies = (k.bevindingen || []).filter(b => b.soort === 'beter' && b.groep === 'dekking').length;
  return uit;
}

/* Hoeveel van ONZE meters staan in de ijk-registratie met alleen een reden?

   Losse functie met de bron als invoer, en niet een leesactie diep in meet():
   zo kan deze meter zelf geijkt worden (test/meterijk.test.js voert hem een
   verzonnen registratie met een bekend aantal redenen). Een meter die zijn
   eigen bron leest en nergens te voeden is, zou precies het soort meter zijn
   waar regel 10 over gaat.

   Hij telt alleen sleutels die ECHT in METERS of PRESTATIEMETERS staan. Een
   eerdere versie telde elke `reden:` in het bestand en kwam op 16 waar
   check.js op 13 uitkwam -- twee tellingen van hetzelfde ding die uiteenlopen
   is hoe een meter begint te liegen. */
function telOngeijkt(ijkBron, extraSleutels) {
  /* De meters die een JOURNAAL nodig hebben (waargenomen dekking, schermdekking,
     samenhang) wonen niet hier maar in hun eigen script, met hun sleutel in een
     METER-constante. Ze horen wel bij dit gat, dus meet() geeft ze mee -- en
     omdat ze binnenkomen als parameter blijft deze functie te voeden met een
     verzonnen registratie, en dus zelf te ijken. */
  const sleutels = METERS.concat(PRESTATIEMETERS).map(m => m.sleutel)
    .concat(Array.isArray(extraSleutels) ? extraSleutels : []);
  const blok = /const IJKINGEN = \{([\s\S]*?)\n\};/.exec(ijkBron);
  if (!blok) throw new Error('de IJKINGEN-registratie is niet te lezen; een meter zonder invoer is geen meter');
  /* Een regel staat op EEN regel ({ reden: '...' }) of over meerdere; het
     patroon mag dus geen regeleinde eisen. Een eerdere versie deed dat wel en
     telde nul, terwijl er dertien stonden -- een meter die nul teruggeeft
     omdat zijn patroon niet past, is precies de vorm waar deze meter over
     gaat. Redenen bevatten nooit geneste accolades, dus [^{}] volstaat. */
  /* EN DE TEKENREEKSEN ERUIT, want anders telt deze meter zijn EIGEN IJKING mee.

     Dat is precies wat er gebeurde. In de registratie staat bij `metersOngeijkt`
     een proef die telOngeijkt een VERZONNEN registratie voedt, en die verzonnen
     tekst bevat letterlijk `p99Ms: { reden: '...' }`. Die staat in het bestand
     vóór de echte regel `p99Ms: { proef: ... }`, en .exec() pakt de eerste
     treffer -- dus meldde de meter p99Ms als ongeijkt terwijl hij een proef
     heeft. Uitkomst: 2 in plaats van 1, en de echte proef werd nooit gezien.

     Het is de derde keer dat een teller in dit huis over zijn eigen ijking
     struikelt (zie de kop van de skip-teller hierboven: eerst commentaar, toen
     een tekenreeks). De oplossing is dezelfde en staat hier daarom niet als
     uitzondering maar als dezelfde wringer: wat tussen aanhalingstekens staat is
     TEKST en geen code, en een teller die code telt hoort er niet in te kijken. */
  const zonderTekst = String(blok[1])
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, m => m.replace(/[^\n]/g, ' '));
  return sleutels.filter(s => {
    const m = new RegExp('(^|[^a-zA-Z0-9])' + s + '\\s*:\\s*\\{([^{}]*)\\}').exec(zonderTekst);
    return m && /reden:/.test(m[2]);
  }).length;
}

/* De skips geteld en meteen in twee bakken gesorteerd. Losse functie met de
   bestandslijst en een lezer als invoer, zodat test/meterijk.test.js hem met een
   verzonnen bestand kan voeden -- een meter die alleen zijn eigen testmap kan
   lezen, is niet te ijken.

   De sortering gaat op BESTANDSSOORT en niet op de tekst van de reden, en dat is
   geen luiheid: de reden staat in een tekenreeks, en die is er bij het tellen al
   uitgewassen (zie zonderTekst hieronder -- dat moest, anders telde de ijking
   zijn eigen voorbeeldregel mee). Nagemeten over de hele testmap: alle
   honderdeen browsergevallen staan in *.e2e.js en alle zeventien dienstgevallen
   in *.test.js. De grens loopt daar dus precies. */
const zonderBlokCommentaar = (b) => String(b)
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
/* De tekenreeks-wringer woont sinds de vierde herhaling van deze fout in
   scripts/lib/bron.js. De derde keer was hier: test/meterijk.test.js zet als
   ijking een toets-met-skip in een TIJDELIJK bestand, en die regel staat dus
   als letterlijke tekst in de ijking zelf -- waarop deze meter hem meetelde
   als een echte zelfpoortende toets. Dezelfde fout als bij het commentaar, een
   laag dieper. Een toets die zichzelf werkelijk overslaat schrijft
   `{ skip: ... }` nooit binnen aanhalingstekens, dus dit kost geen enkele
   echte melding (nagemeten over de hele testmap: alleen meterijk.test.js
   verandert, 78 -> 77). De vierde keer trof keuring 25 in check.js, en die
   gebruikt nu dezelfde functie. */
const { zonderTekst } = require('./lib/bron');

/* De twee wringers samen, en de enige vorm die naar buiten gaat. Zowel deze
   meter als scripts/deltapoort.js moet een testbestand op dezelfde manier
   schoonvegen voordat er skips geteld worden -- doet de poort dat anders dan de
   ratel, dan houdt hij iets tegen wat de meter niet ziet, of andersom. */
function schoon(bron) { return zonderTekst(zonderBlokCommentaar(bron)); }
/* DE 100%-RICHTING, MECHANISCH. Twee tanden op de bewijslaag zelf: het aantal
   bewezen cellen in de matrix mag alleen stijgen (richting omhoog), en de
   openstaande bewijsschuld mag alleen dalen (richting omlaag). De soort
   `grens` telt niet mee in de achterstand: dat is de rand van de methode, en
   wie die als achterstand telt jaagt op een getal dat niet bestaat (zie de kop
   van scripts/bewijsschuld.js).

   Losse functie met de lezer als invoer, zodat de ijking hem nep-registers kan
   voeren en hem echt ziet uitslaan -- zelfde snit als telSkips en
   telInlineStijl, en om dezelfde reden (LAT.md regel 10). Kapotte of
   ontbrekende invoer is een gezakte meting, geen nul (regel 3). */
function telBewijslaag(lees) {
  let matrix, schuld;
  try { matrix = JSON.parse(lees('BEWIJSMATRIX.json')); } catch (e) {
    throw new Error('BEWIJSMATRIX.json is niet leesbaar (' + e.message + '); draai npm run ' +
      'bewijsmatrix:vast -- een meter zonder invoer is geen meter');
  }
  try { schuld = JSON.parse(lees('BEWIJSSCHULD.json')); } catch (e) {
    throw new Error('BEWIJSSCHULD.json is niet leesbaar (' + e.message + '); draai node ' +
      'scripts/bewijsschuld.js --vastleggen -- een meter zonder invoer is geen meter');
  }
  const bewezen = matrix.telling && matrix.telling.bewezen;
  if (typeof bewezen !== 'number') {
    throw new Error('BEWIJSMATRIX.json draagt geen telling.bewezen; dan is bewijsCellenBewezen niet gemeten');
  }
  const t = schuld.telling || {};
  if (typeof t.meetwerk !== 'number' || typeof t.instrument !== 'number') {
    throw new Error('BEWIJSSCHULD.json draagt geen telling.meetwerk/instrument; dan is bewijsAchterstand niet gemeten');
  }
  return { bewijsCellenBewezen: bewezen, bewijsAchterstand: t.meetwerk + t.instrument };
}

function telSkips(bestanden, lees) {
  const uit = { dienst: 0, browser: 0 };
  for (const f of bestanden) {
    const bron = String(lees(f));
    let n = 0;
    for (const m of bron.matchAll(/\{\s*skip\s*:\s*([^}]+)\}/g)) if (!/^false\s*$/.test(m[1])) n++;
    // test.skip(...) / it.skip(...): de harde vorm, altijd overgeslagen
    n += (bron.match(/\b(?:test|it)\.skip\s*\(/g) || []).length;
    if (f.endsWith('.e2e.js')) uit.browser += n; else uit.dienst += n;
  }
  return uit;
}

/* `bronnen` is er alleen voor de IJKING (test/meterijk.test.js) en is optioneel:
   zonder argument leest deze meter alles van schijf zoals altijd. Zie de uitleg
   bij `mutaties` hieronder voor waarom dat er is. */
function meet(bronnen) {
  /* DE KEURING GEEFT EXITCODE 1 ZODRA HIJ IETS VINDT, en dat is precies zijn
     werk. execFileSync gooit daar standaard op, dus meet() klapte om op het
     moment dat er iets te meten viel -- de meetketen brak als de meting niet
     nul was. Dat kwam aan het licht bij het ijken van keuringStuk: een
     tijdelijk bestand met een echte fout erin gaf geen hoger cijfer maar een
     onleesbare stapel.

     Daarom lezen we de uitvoer en niet de exitcode. Een keuring die IETS
     teruggeeft is geslaagd; een keuring die niets teruggeeft (of onleesbaars)
     is een echte storing en die gooit alsnog, met de eerste regels van zijn
     eigen foutstroom erbij -- LAT-regel 3: een meter zonder invoer zakt. */
  const r = spawnSync(process.execPath,
    [path.join(__dirname, 'keuring.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 });
  let k = null;
  try { k = JSON.parse(r.stdout); } catch (e) { k = null; }
  if (!k || !k.cijfers) {
    throw new Error('de keuring gaf geen leesbaar rapport (exit ' + r.status + '): ' +
      String(r.stderr || r.stdout || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 300));
  }

  /* De dependencies tellen we uit package.json zelf en niet uit een rapport:
     dit is de meter waar je bij twijfel de bron van wilt zien.

     TWEE METERS EN GEEN EEN, om dezelfde reden als bij de mutatiemotor en de
     geblende teller hieronder: dit waren twee onvergelijkbare dingen op een
     hoop. Het principe is "de RUNTIME draait zonder npm-pakketten" -- dat is
     wat een bezoeker raakt en wat de aanvalsoppervlakte bepaalt. Gereedschap
     om te METEN valt daar niet onder.

     Hij liep hierop vast: op 11 augustus kwam playwright er als devDependency
     bij, en dat was geen verslapping maar de reparatie van een gat waar niets
     anders voor bestond -- 114 van de 119 schermtoetsbestanden sloegen zichzelf
     over bij gebrek aan browser, en node meldde dat als groen (commit 483b1cfd).
     Met een opgetelde teller kon die verbetering alleen als verslechtering
     binnenkomen, en dan leert een ratel je om hem te omzeilen.

     `dependencies` blijft dus de harde nul, en `devPakketten` staat apart met
     zijn eigen norm. Ook die kan alleen omlaag: een tweede devDependency erbij
     is nog steeds een besluit dat je moet verantwoorden. */
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).length;
  const devPakketten = Object.keys(pkg.devDependencies || {}).length;

  const testMap = path.join(WORTEL, 'test');
  const inMap = fs.readdirSync(testMap);
  const testbestanden = inMap.filter(f => f.endsWith('.test.js')).length;
  const e2eBestanden = inMap.filter(f => f.endsWith('.e2e.js')).length;

  /* Hoeveel app-pagina's dragen de vormtaal nog niet? Geteld op de INSLUITING
     en niet op het gebruik: een pagina die rtg-ontwerp.css laadt kan er nog
     weinig mee doen, maar een pagina die hem niet laadt kan er zeker niets mee.
     Dit is de goedkope, eerlijke ondergrens van adoptie. */
  const appMap = path.join(WORTEL, 'public', 'apps');
  const appPaginas = fs.readdirSync(appMap).filter(f => f.endsWith('.html'));
  const schermenZonderVormtaal = appPaginas.filter(f =>
    !fs.readFileSync(path.join(appMap, f), 'utf8').includes('rtg-ontwerp.css')).length;

  /* Tel de toetsen die zichzelf kunnen overslaan. We tellen de AANROEP, niet
     het bestand: een bestand met acht toetsen achter een poort is acht toetsen
     die niet draaien. Zowel `{ skip: X }` als `{ skip: X ? .. : .. }` telt mee,
     en `skip: false` juist niet -- dat is een poort die openstaat.

     COMMENTAAR TELT NIET MEE, en dat is hier een geleerde les en geen detail.
     Deze teller las de RUWE bron, dus een toets die in zijn kop uitlegt hoe die
     skip-regel eruitziet, telde als een extra overgeslagen toets. Precies dat
     gebeurde bij test/browserpoort.e2e.js -- een bestand dat juist bestaat OM
     die poort te bewaken en zichzelf nooit overslaat. Dezelfde fout is op
     2026-08-01 al een keer uit scripts/keuring.js gehaald (zie de eerste
     notitie in NORM.json); een meter die tekst leest in plaats van code komt
     kennelijk twee keer terug. Nu gaat de bron eerst door de wringer. */
  const skips = telSkips(inMap.filter(n => /\.(test|e2e)\.js$/.test(n)),
    (f) => schoon(fs.readFileSync(path.join(testMap, f), 'utf8')));
  const zelfpoortendeToetsen = skips.dienst;
  const browserpoortToetsen = skips.browser;

  /* De mutatie-uitslag. Ontbreekt MUTATIES.json, dan hoort dit te ZAKKEN en niet
     stilzwijgend nul te melden (LAT.md regel 3): nul overlevers zou dan als
     perfect scoren terwijl er niets is gemeten. */
  /* DE BRON IS INJECTEERBAAR, EN DAT IS EEN REPARATIE EN GEEN NETHEID.

     test/meterijk.test.js ijkte deze twee meters door een verzonnen uitslag in
     het ECHTE MUTATIES.json te schrijven en het in een finally terug te zetten.
     Dat werkte, en het was een val met twee monden. (1) Wie in dat venster van
     een paar seconden `git add -A` doet, commit een uitslag waarin toetsen
     "overleefd" staan en alle details weg zijn -- eerlijkheidspunt 6.4, voor de
     derde keer. (2) Een kill in dat venster laat de finally NIET lopen, en dat
     is hier geen theorie: deze sessie bleef server/lokaal-tls.js zo gemuteerd
     staan. Dan is de uitslag van een campagne van 540 toetsen weg en vervangen
     door "alles overleefd" -- het slechtst mogelijke verlies, want het ziet
     eruit als een meting.

     Wat er wordt meegegeven is de LEZER en niet de uitkomst. Zou de ijking een
     kant-en-klaar geteld resultaat mogen aanleveren, dan bewijst ze dat het
     tellen werkt en niet dat DEZE meter het leest -- precies het onderscheid uit
     de kop van deze functie ("meet of hij draait en niet of hij ziet"). Nu loopt
     de hele weg (lezen, parsen, tellen, drempels) nog steeds door de meter.

     Wat hiermee NIET is bewezen: dat de standaardlezer naar het juiste pad
     wijst. Dat is die ene regel hieronder, en die staat er onbedekt bij. */
  const mutaties = (() => {
    const p = path.join(WORTEL, 'MUTATIES.json');
    const lees = (bronnen && bronnen.leesMutaties) || (() => fs.readFileSync(p, 'utf8'));
    let rauw;
    try { rauw = JSON.parse(lees()).toetsen || {}; }
    catch (e) { throw new Error('MUTATIES.json is er niet of onleesbaar (' + e.message + '); draai npm run mutatie -- twee meters hebben hem als invoer'); }
    const alle = inMap.filter(n => /\.(test|e2e)\.js$/.test(n));
    let overleefd = 0, gezakt = 0, nietGemeten = 0;
    for (const n of alle) {
      const m = rauw[n];
      if (!m) { nietGemeten++; continue; }
      if (m.staat === 'overleefd') overleefd++;
      else if (m.staat === 'gezakt') gezakt++;
      /* 'geen bronmutatie mogelijk' is GEEN niet-gemeten: de motor is er wel
         degelijk langs geweest en het oordeel staat gedocumenteerd in
         GEEN_BRONMUTATIE, elk met zijn foutklasse met de hand nagetrokken.
         Toen deze staat hier nog als niet-gemeten telde, werd de meter rood
         van precies het eerlijke werk -- dertien overlevers herklasseren
         duwde hem van 150 naar 158, terwijl er alleen MEER bekend was
         geworden. Een meter die eerlijkheid bestraft, leert iedereen om
         vaag te blijven (zelfde les als bij toetsenOngevoeligPct hierboven). */
      else if (m.staat === 'geen bronmutatie mogelijk') { /* gekend, eigen categorie */ }
      else nietGemeten++;      // 'al rood', 'geen module gevonden', 'slaat zichzelf over', ...
    }
    const gemeten = overleefd + gezakt;
    /* Een percentage over nul metingen is geen nul maar ONBEKEND, en dat mag geen
       perfecte score worden (LAT.md regel 3). Zonder metingen hoort de meter niet
       te bestaan; norm.js noemt hem dan als nieuw zonder grondwaarde. */
    if (!gemeten) throw new Error('MUTATIES.json bevat geen enkele gemeten toets; draai npm run mutatie voordat deze meter iets kan zeggen');
    return { ongevoeligPct: Math.round(1000 * overleefd / gemeten) / 10, nietGemeten, overleefd, gezakt };
  })();

  /* De derde voorraad: beweringen die op een lege verzameling vanzelf slagen.
     scripts/tandeloos.js doet de meting; hier komt alleen het getal binnen. Hij
     leest de toetsmap zelf, dus hij zakt vanzelf als die er niet is -- en dat
     hoort (LAT.md regel 3). */
  const tandeloos = (() => {
    const eigen = bronnen && bronnen.meetTandeloos;
    /* ONTHOUDEN, MAAR ALLEEN DE ECHTE METING. Deze telling leest en scant elk
       toetsbestand; test/meterijk.test.js roept norm.meet() tientallen keren aan
       (een keer per ijking) en zonder dit betaalt elke ijking die scan opnieuw --
       een suite die daardoor minuten langer duurt, is een suite die iemand gaat
       overslaan. Een INGEBRACHTE lezer wordt nooit onthouden: die is er juist om
       een ANDER getal te geven, en een cache zou de ijking dan naar nul brengen
       en hem stilletjes tandeloos maken. */
    if (eigen) return keur(eigen());
    if (tandeloosOnthouden === null) tandeloosOnthouden = keur(require('./tandeloos').meet({ stil: true }));
    return tandeloosOnthouden;
    function keur(r) {
      if (!r || !Number.isFinite(r.meldingen) || !r.bekeken)
        throw new Error('scripts/tandeloos.js gaf geen telling terug; dan is beweringenZonderVulcontrole niet gemeten');
      return r.meldingen;
    }
  })();

  /* De style="..."-attributen in public/, buiten de bouwuitvoer en de bundels om. */
  const PUB = path.join(WORTEL, 'public');
  const bundelPaden = new Set(Object.keys(require('./bundel').bundels).map(k => path.join(PUB, k)));
  const stijlBestanden = [];
  (function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { if (naam !== 'dist') loop(p); continue; }
      if (/\.(html|js)$/.test(naam) && !bundelPaden.has(p)) stijlBestanden.push(p);
    }
  })(PUB);
  const inlineStijlAttributen = telInlineStijl(p => fs.readFileSync(p, 'utf8'), stijlBestanden);

  /* De kruisproef op de commentaar-verwijderaar, uit dezelfde bron als de toets
     die hem bewaakt (regel 4: geen tweede implementatie). Faalt hij, dan zakt de
     meter in plaats van stil nul te geven -- juist bij een meter die over
     blindheid gaat is een stille nul de ergste uitkomst. */
  let bronBlindeBestanden;
  try { bronBlindeBestanden = require('./lib/bronblind').meetBlind({ wortel: WORTEL }).ongedekt; }
  catch (e) { throw new Error('de kruisproef op de commentaar-verwijderaar kon niet draaien (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* De delen zonder onderwerpregel, uit dezelfde bron als BUNDELS.md zelf
     (regel 4: geen tweede implementatie). */
  let delenZonderOnderwerp;
  try {
    const { delenVan } = require('./deelindex');
    delenZonderOnderwerp = Object.values(require('./bundel').bundels)
      .reduce((som, map) => som + delenVan(map).filter(d => !d.onderwerp).length, 0);
  } catch (e) { throw new Error('de bundeldelen konden niet worden gelezen (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* De grenzen uit dezelfde bron als het losse script (regel 4: geen tweede
     implementatie). Faalt hij, dan zakt de meter in plaats van stil nul te geven. */
  let grenzen;
  try { grenzen = require('./grenzen').meet(); }
  catch (e) { throw new Error('de grenzen konden niet worden gemeten (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* De schakelbaarheid uit dezelfde bron als het losse script: een tweede
     implementatie zou binnen een week uiteenlopen (regel 4). */
  let routesNietSchakelbaar = 0;
  try { routesNietSchakelbaar = require('./schakelbaar').meet().ongedekt.length; }
  catch (e) { throw new Error('schakelbaarheid kon niet worden gemeten (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* De deuren naar db.data uit dezelfde bron als het losse script, om dezelfde
     reden als hierboven: een tweede implementatie loopt binnen een week uiteen. */
  let deuren = null;
  try { deuren = require('./deuren').meet(); }
  catch (e) { throw new Error('de deuren naar db.data konden niet worden geteld (' + e.message + '); een meter zonder invoer is geen meter'); }

  /* Hoeveel meters staan er in de ijk-registratie met alleen een REDEN? Die
     hebben we dus NIET zien uitslaan. De teller leest het registratiebestand
     zelf, want een getal dat je hier hardcodeert is precies het soort meter
     waar regel 10 over gaat. Ontbreekt het bestand, dan is niets geijkt en
     hoort deze meter dat te zeggen in plaats van stil nul te geven. */
  const ijkPad = path.join(WORTEL, 'test/meterijk.test.js');
  if (!fs.existsSync(ijkPad)) {
    throw new Error('test/meterijk.test.js ontbreekt; dan is geen enkele meter geijkt en kan deze meter niet meten');
  }
  /* Ook de meters die in een eigen script wonen tellen mee (zie telOngeijkt).
     Zelfde vindwijze als check.js regel 35, zodat de twee tellingen niet
     uiteen kunnen lopen -- dat is eerder gebeurd en zo begint een meter te
     liegen. */
  const losseSleutels = [];
  for (const b of fs.readdirSync(path.join(WORTEL, 'scripts')).filter(f => f.endsWith('.js') && f !== 'norm.js')) {
    const bron = fs.readFileSync(path.join(WORTEL, 'scripts', b), 'utf8');
    for (const m of bron.matchAll(/^const METER[A-Z_]*\s*=\s*'([a-zA-Z0-9]+)'/gm)) losseSleutels.push(m[1]);
  }
  const metersOngeijkt = telOngeijkt(fs.readFileSync(ijkPad, 'utf8'), losseSleutels);

  /* DE RATEL OVER ZICHZELF. `losseSleutels` is hierboven al verzameld voor
     metersOngeijkt; dezelfde verzameling is precies wat hier geteld moet
     worden, dus hij wordt niet opnieuw opgehaald (regel 4 geldt ook binnen een
     functie). De prestatiemeters tellen mee: ook zij hangen aan een ratel, hij
     staat alleen onder een andere sleutel in NORM.json. */
  const geratelde = new Set(METERS.concat(PRESTATIEMETERS).map(m => m.sleutel).concat(losseSleutels));
  const ratelTanden = geratelde.size;

  /* En de meetbestanden waar GEEN ratel achter staat. Een regel in het register
     telt alleen mee als hij na te trekken is: een `meter`-regel moet sleutels
     noemen die werkelijk geratelde zijn, en een `eigenRatel`-regel moet naar een
     bestaand bestand wijzen dat deze meting ook echt noemt. Een register vol
     beweringen zou deze meter tot nul kunnen praten, en dan meet hij het
     tegenovergestelde van wat hij moet meten. */
  const { REGISTER, GEEN_METING } = require('./lib/metingen');
  const metingen = fs.readdirSync(WORTEL).filter(f => f.endsWith('.json') && !GEEN_METING.has(f));
  const metingenZonderRatel = metingen.filter(bestand => {
    const regel = REGISTER[bestand];
    if (!regel) return true;
    if (Array.isArray(regel.meter)) return !regel.meter.every(sleutel => geratelde.has(sleutel));
    if (regel.eigenRatel) {
      const pad = path.join(WORTEL, regel.eigenRatel);
      if (!fs.existsSync(pad)) return true;
      return !fs.readFileSync(pad, 'utf8').includes(bestand);
    }
    return true;
  }).length;

  /* EEN MISLUKTE METING IS GEEN NUL, en hier was dat de duurste vorm ervan.

     scripts/keuring.js start scripts/routekaart.js om de routes te krijgen.
     Lukt dat niet, dan meldt hij dat netjes en geeft `{ routes: 0, gedekt: 0 }`
     terug -- zonder `ongedekt`. En dan wordt endpointsZonderTest 0 en dekkingPct
     0. Voor de eerste is nul de allerbeste stand die er is, dus de ratel juicht;
     voor de tweede is nul de allerslechtste, dus de ratel klaagt. Twee tanden
     die tegengesteld reageren op DEZELFDE storing, en geen van beide zegt wat er
     werkelijk aan de hand is.

     Dat is niet theoretisch: de routekaart kapte tot vandaag zijn eigen uitvoer
     af zodra hij door een pijp ging (zie de kop van scripts/routekaart.js), en
     dat gebeurde vanzelf toen de kaart over de 146 kilobyte kwam. LAT.md regel 3
     zegt wat er dan hoort te gebeuren: een meter zakt als zijn invoer ontbreekt.
     Dus zakt hij, net als hierboven bij een ontbrekende ijkregistratie. */
  if (!k.cijfers.dekking || !k.cijfers.dekking.routes) {
    throw new Error('de routekaart gaf geen routes; dan zijn endpointsZonderTest en dekkingPct niet gemeten ' +
      '(draai: node scripts/routekaart.js --json)');
  }

  /* De bewijslaag zelf aan de ratel; het hele verhaal staat bij telBewijslaag. */
  const { bewijsCellenBewezen, bewijsAchterstand } = telBewijslaag(
    (naam) => fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

  return {
    bewijsCellenBewezen, bewijsAchterstand,
    metersOngeijkt,
    routesNietSchakelbaar,
    bronBlindeBestanden,
    delenZonderOnderwerp,
    dbDeuren: deuren.deuren,
    dbDeurenSchrijvend: deuren.schrijvendeDeuren,
    endpointsZonderTest: (k.cijfers.dekking.ongedekt || []).length,
    dekkingPct: k.cijfers.dekking.pct || 0,
    keuringStuk: k.stuk, keuringScheef: k.scheef,
    keuringTeGroot: (k.cijfers.uitschieters || {}).teGroot || 0,
    ...telPerGroep(k),
    kernBreedte: grenzen.kernBreedte, kernGedeeld: grenzen.kernGedeeld,
    kernBreedsteBestand: grenzen.kernBreedsteBestand,
    kernOngebruikt: grenzen.kernOngebruikt,
    toetsenOngevoeligPct: mutaties.ongevoeligPct,
    toetsenNietGemeten: mutaties.nietGemeten,
    beweringenZonderVulcontrole: tandeloos,
    dependencies: deps, devPakketten, testbestanden, zelfpoortendeToetsen, browserpoortToetsen, e2eBestanden,
    schermenZonderVormtaal,
    inlineStijlAttributen,
    ratelTanden, metingenZonderRatel,
    /* Het bewijspaspoort. De wortel is de invoer en niet een vaste lijst: een
       register dat er morgen bijkomt, telt vanzelf mee. */
    registersUitVuileBoom: vuileRegisters(WORTEL).length
  };
}

/* ONTBREEKT HIJ, OF IS HIJ KAPOT? DAT IS NIET HETZELFDE.

   Deze functie gaf voor allebei `null`, en de aanroeper maakte daar "nog niet
   vastgelegd" van: hij schreef een verse NORM.json weg op basis van waar de code
   NU staat, en gaf exitcode 0. Eén onleesbaar bestand -- een half geschreven
   commit, een verkeerde merge, een afgekapte schrijfactie -- en de hele lat was
   weg. Stilzwijgend, en met een groen vinkje.

   Dat is precies LAT.md regel 3 (een meter zakt als zijn invoer ontbreekt), in
   de ratel die daar zelf over gaat. Nu: ontbreken mag (dat is de eerste keer),
   maar onleesbaar is een fout en die overschrijft niets. */
/* De onthouden telling van scripts/tandeloos.js; zie de reden bij het gebruik. */
let tandeloosOnthouden = null;

function leesNorm() {
  if (!fs.existsSync(NORMBESTAND)) return null;                 // eerste keer: mag
  const ruw = fs.readFileSync(NORMBESTAND, 'utf8');
  try { return JSON.parse(ruw); }
  catch (e) { throw new Error('NORM.json staat er wel maar is onleesbaar (' + e.message +
    '). Herstel hem uit de git-historie; ik overschrijf de lat niet met de huidige stand.'); }
}

/* De vingerafdruk waar een prestatiecijfer alleen binnen geldig is. Bewust grof:
   kernen, geheugen, platform en modus. De node-versie zit er NIET in -- die
   wisselt vaker dan de machine en zou de lat elke upgrade wissen, terwijl het
   effect op deze cijfers klein is vergeleken met het aantal kernen. */
function bron(c) {
  if (!c || !c.machine) return null;
  return c.machine.kernen + 'k/' + c.machine.geheugenGB + 'g/' + c.machine.platform + '/' + (c.modus || '?');
}

/* Geeft altijd hetzelfde soort antwoord: { cijfers, bron, reden }. `reden`
   ingevuld = niet bruikbaar, en dan zegt de aanroeper WAAROM. Nooit stil null. */
function leesPrestatie(bestand) {
  const pad = bestand || PRESTATIEBESTAND;   // parameter zodat een toets hem echt kan beproeven
  if (!fs.existsSync(pad)) return { reden: 'BEPROEVING.json ontbreekt (draai: npm run beproeving)' };
  let c;
  try { c = JSON.parse(fs.readFileSync(pad, 'utf8')); }
  catch (e) { return { reden: 'BEPROEVING.json is onleesbaar (' + e.message + ')' }; }
  if (!c || !c.meters) return { reden: 'BEPROEVING.json heeft geen meters' };
  /* Een GEZAKTE ronde levert geen grondwaarde. De cijfers van een run die zijn
     eigen drempels niet haalde zijn geen norm om aan vast te houden. */
  if (c.oordeel !== 'PASS') return { reden: 'de laatste beproeving is GEZAKT (' + c.gezakteDrempels + ' drempel(s)); die cijfers zijn geen lat' };
  return { cijfers: c.meters, bron: bron(c), gedraaid: c.gedraaid,
    kalibratie: c.machine && c.machine.kalibratieBasisMs || null };
}

/* Beweegt de meter de goede kant op, de verkeerde kant op, of staat hij stil? */
function oordeel(m, nu, norm) {
  if (nu === norm) return 'gelijk';
  const beter = m.richting === 'omlaag' ? nu < norm : nu > norm;
  return beter ? 'beter' : 'slechter';
}

/* ---------------------------- DE VEER -------------------------------------

   Een ratel houdt tegen dat het slechter wordt. Over STILSTAND zegt hij niets,
   en stilstand is groen: bij de laatste ronde stonden negentien van de
   drieentwintig meters op "gelijk", en dat mag zo blijven tot in lengte van
   dagen zonder dat er iets klaagt. inlineStijlAttributen mag eeuwig op 5863
   blijven staan; de poort gaat gewoon open.

   Dit is geen tand maar een veer. Hij verandert geen exitcode en houdt niets
   tegen -- hij stelt alleen de vraag die de ratel niet stelt: welke meter staat
   het langst stil terwijl er nog werk aan is?

   WAAROM HIJ NIET ZAKT, EN DAT IS EEN KEUZE EN GEEN ZWAKTE. Een poort die op
   stilstand zou zakken, koopt cosmetische winst: dan wordt er een attribuut
   verplaatst om de datum te verzetten, en dat is precies het soort beweging dat
   deze codebase al een keer heeft afgeleerd bij de dekkingsteller (op te poetsen
   met een zoek-en-vervang). Voor "wat is het langst blijven liggen" werkt wijzen
   beter dan dwingen: het antwoord is zelden oncomfortabel, alleen vergeten.

   WELKE METERS MEEDOEN: alleen die met een BEKEND einde. Een meter die omlaag
   moet en boven nul staat, of een percentage dat omhoog moet en onder de honderd.
   `testbestanden` en `e2eBestanden` hebben geen plafond -- meer toetsen is altijd
   beter en nooit af -- dus die zouden hier eeuwig bovenaan staan en de lijst
   onbruikbaar maken. De prestatiemeters doen niet mee omdat ze alleen binnen
   dezelfde machine vergelijkbaar zijn: een p99 die stilstaat op een andere runner
   zegt niets. */
function heeftEinde(m, waarde) {
  if (typeof waarde !== 'number') return false;
  if (m.richting === 'omlaag') return waarde > 0;
  return /Pct$/.test(m.sleutel) && waarde < 100;
}

function dagenTussen(a, b) {
  const ms = Date.parse(String(a) + 'T00:00:00Z') - 0;
  const bs = Date.parse(String(b) + 'T00:00:00Z');
  if (!Number.isFinite(ms) || !Number.isFinite(bs)) return null;
  return Math.max(0, Math.round((bs - ms) / 86400000));
}

/* De meters die nog werk hebben, langste stilstand eerst. `sinds` staat in
   NORM.json en wordt gezet op het moment dat een meter WERKELIJK verbetert.
   Ontbreekt hij, dan geldt de dag waarop de norm is vastgelegd -- dat is de
   eerste dag waarop we van deze meter iets weten, en het staat er als GESCHAT
   bij zodat niemand die datum voor een meting aanziet. */
function traagsteTanden(norm, vandaag) {
  const sinds = (norm && norm.sinds) || {};
  const grond = (norm && norm.vastgelegd) || null;
  const uit = [];
  for (const m of METERS) {
    const waarde = norm && norm.meters ? norm.meters[m.sleutel] : undefined;
    if (!heeftEinde(m, waarde)) continue;
    const vanaf = sinds[m.sleutel] || grond;
    if (!vanaf) continue;
    const dagen = dagenTussen(vanaf, vandaag);
    if (dagen === null) continue;
    uit.push({ sleutel: m.sleutel, waarde, sinds: vanaf, geschat: !sinds[m.sleutel], dagen, wat: m.wat });
  }
  return uit.sort((a, b) => b.dagen - a.dagen || String(a.sleutel).localeCompare(b.sleutel));
}

function toonVeer(norm, vandaag) {
  const traag = traagsteTanden(norm, vandaag);
  if (!traag.length) return;
  console.log('\n  \x1b[1mde veer\x1b[0m \x1b[2m(geen poort: welke meter staat het langst stil terwijl er nog werk aan is)\x1b[0m');
  for (const t of traag.slice(0, 3))
    console.log('  \x1b[2m' + String(t.dagen).padStart(4) + ' dagen  \x1b[0m' + t.sleutel.padEnd(22) +
      String(t.waarde).padStart(6) + '\x1b[2m  sinds ' + t.sinds + (t.geschat ? ' (geschat: de dag van de grondwaarde)' : '') + '\x1b[0m');
  if (traag.length > 3) console.log('  \x1b[2m' + (traag.length - 3) + ' meter(s) met minder stilstand niet getoond\x1b[0m');
}

function main() {
  const nu = meet();
  let norm;
  try { norm = leesNorm(); }
  catch (e) { console.error('\n  \x1b[31m' + e.message + '\x1b[0m\n'); return 2; }
  const vastleggen = process.argv.includes('--vastleggen');

  if (!norm) {
    console.log('\n\x1b[1mDE NORM\x1b[0m -- nog niet vastgelegd.\n');
    for (const m of METERS) console.log('  ' + m.sleutel.padEnd(22) + String(nu[m.sleutel]).padStart(6) + '   ' + m.wat);
    fs.writeFileSync(NORMBESTAND, JSON.stringify({ vastgelegd: new Date().toISOString().slice(0, 10), meters: nu }, null, 2) + '\n');
    console.log('\n  \x1b[32mNORM.json aangemaakt.\x1b[0m Vanaf nu mag geen van deze meters nog slechter worden.\n');
    return 0;
  }

  console.log('\n\x1b[1mDE NORM\x1b[0m\x1b[2m -- vastgelegd op ' + (norm.vastgelegd || '?') + '\x1b[0m\n');
  const slechter = [], beterDan = [], nieuw = [];
  for (const m of METERS) {
    const n = norm.meters[m.sleutel];
    /* HIER STOND EEN STIL `continue`. Een meter die je toevoegt maar nog niet
       vastlegt, deed dus helemaal niets en zei er ook niets over -- precies de
       vorm die deze hele ratel moet vangen. Nu staat hij er, elke run, tot
       iemand hem met --vastleggen een grondwaarde geeft. Zakken doet hij niet:
       zonder grondwaarde valt er niets te vergelijken, en een meter die faalt
       omdat hij nieuw is leert je niets. */
    if (n === undefined) { nieuw.push({ m, nu: nu[m.sleutel] }); continue; }
    const v = nu[m.sleutel];
    const o = oordeel(m, v, n);
    const merk = o === 'slechter' ? '\x1b[31mSLECHTER\x1b[0m' : o === 'beter' ? '\x1b[32mbeter   \x1b[0m' : '\x1b[2mgelijk  \x1b[0m';
    console.log('  ' + merk + '  ' + m.sleutel.padEnd(22) + String(v).padStart(6) +
      '\x1b[2m  (norm: ' + n + ')\x1b[0m');
    if (o === 'slechter') slechter.push({ m, nu: v, norm: n });
    if (o === 'beter') beterDan.push({ m, nu: v, norm: n });
  }

  for (const n of nieuw)
    console.log('  \x1b[36mNIEUW   \x1b[0m  ' + n.m.sleutel.padEnd(22) + String(n.nu).padStart(6) +
      '\x1b[2m  (nog geen grondwaarde -- leg vast met npm run norm:vast)\x1b[0m');

  /* ---------- de prestatiehelft ---------- */
  const pres = leesPrestatie();
  const presNorm = norm.prestatie || {};
  const heeftGrond = Object.keys(presNorm).length > 0;
  const presNieuw = [], presBeter = [];
  let presFout = null;

  console.log('\n  \x1b[1mprestatie\x1b[0m \x1b[2m(uit BEPROEVING.json)\x1b[0m');
  if (pres.reden) {
    /* Ontbrekende invoer terwijl er een lat staat: dat is een fout en geen
       stilte. Staat er nog geen lat, dan is het een mededeling. */
    if (heeftGrond) { presFout = pres.reden; console.log('  \x1b[31mGEEN CIJFERS\x1b[0m ' + pres.reden); }
    else console.log('  \x1b[2m' + pres.reden + ' -- nog geen prestatielat gezet\x1b[0m');
  } else if (heeftGrond && norm.prestatieBron && norm.prestatieBron !== pres.bron) {
    console.log('  \x1b[33mNIET VERGELEKEN\x1b[0m: deze ronde draaide op ' + pres.bron
      + ', de lat staat op ' + norm.prestatieBron + '.');
    console.log('  \x1b[2mEen p99 van een andere machine of modus is geen betere of slechtere p99, maar een andere.\x1b[0m');
  } else if (heeftGrond && norm.prestatieKalibratie && pres.kalibratie &&
      (pres.kalibratie / norm.prestatieKalibratie > 1.4 || norm.prestatieKalibratie / pres.kalibratie > 1.4)) {
    /* DEZELFDE VORM IS NOG NIET DEZELFDE MACHINE. Twee cloudcontainers met
       "4k/17g/linux/sqlite" bleken op ander silicium te draaien: de een
       haalde p99 144, de ander consistent 233 -- en de kalibratie (dezelfde
       vaste spin-werklast, in rust) verschilde navenant. Latenties vergelijken
       tussen die twee is dezelfde fout als darwin met linux vergelijken,
       alleen onzichtbaarder. De vorm-sleutel hierboven vangt dat niet; deze
       gemeten snelheid wel. Factor 1,4 en niet strakker: de kalibratie zelf
       heeft ruis (gemeten ruisfactor ~1,1-1,2 op een rustige machine). */
    console.log('  \x1b[33mNIET VERGELEKEN\x1b[0m: zelfde vorm (' + pres.bron + '), andere snelheid -- ' +
      'kalibratie nu ' + pres.kalibratie + ' ms, bij de lat ' + norm.prestatieKalibratie + ' ms.');
    console.log('  \x1b[2mEen p99 van trager silicium is geen slechtere p99, maar een andere. De lat verzet\x1b[0m');
    console.log('  \x1b[2malleen wie op vergelijkbare snelheid meet, of met de hand (met reden, in de historie).\x1b[0m');
  } else if (heeftGrond && norm.prestatieKalibratie && !pres.kalibratie) {
    console.log('  \x1b[33mNIET VERGELEKEN\x1b[0m: deze BEPROEVING.json draagt geen kalibratie; draai npm run beproeving opnieuw.');
  } else if (heeftGrond && pres.kalibratie && !norm.prestatieKalibratie) {
    /* De lat komt uit een tijd dat de snelheid niet werd meegemeten. Tegen
       zo'n lat is elke vergelijking een gok -- misschien zelfde silicium,
       misschien niet, en dat verschil is precies wat hier fout ging. */
    console.log('  \x1b[33mNIET VERGELEKEN\x1b[0m: de lat draagt geen kalibratie (hij is gezet voordat de snelheid werd meegemeten).');
    console.log('  \x1b[2mZet de lat met de hand op de cijfers van een ronde MET kalibratie (met reden, in de historie);\x1b[0m');
    console.log('  \x1b[2mvanaf dan vergelijkt hij alleen nog metingen van vergelijkbaar silicium.\x1b[0m');
  } else {
    for (const m of PRESTATIEMETERS) {
      const v = pres.cijfers[m.sleutel];
      if (v == null) { console.log('  \x1b[2mniet gemeten\x1b[0m ' + m.sleutel); continue; }
      const n = presNorm[m.sleutel];
      if (n === undefined) { presNieuw.push({ m, nu: v }); continue; }
      const o = oordeel(m, v, n);
      const merk = o === 'slechter' ? '\x1b[31mSLECHTER\x1b[0m' : o === 'beter' ? '\x1b[32mbeter   \x1b[0m' : '\x1b[2mgelijk  \x1b[0m';
      console.log('  ' + merk + '  ' + m.sleutel.padEnd(22) + String(v).padStart(6) + '\x1b[2m  (norm: ' + n + ')\x1b[0m');
      if (o === 'slechter') slechter.push({ m, nu: v, norm: n });
      if (o === 'beter') presBeter.push({ m, nu: v, norm: n });
    }
    for (const n of presNieuw)
      console.log('  \x1b[36mNIEUW   \x1b[0m  ' + n.m.sleutel.padEnd(22) + String(n.nu).padStart(6) +
        '\x1b[2m  (nog geen grondwaarde)\x1b[0m');
    console.log('  \x1b[2mgemeten op ' + (pres.gedraaid || '?').slice(0, 16).replace('T', ' ') + ' op ' + pres.bron + '\x1b[0m');
  }

  if (presFout) {
    console.log('\n\x1b[31m  DE PRESTATIELAT KAN NIET WORDEN GECONTROLEERD.\x1b[0m\n');
    console.log('    ' + presFout);
    console.log('\n  Er staat een prestatielat in NORM.json, dus deze cijfers horen er te zijn.');
    console.log('  Een ratel zonder invoer is geen ratel; hij zwijgt dan precies wanneer het ertoe doet.\n');
    return 1;
  }

  if (slechter.length) {
    console.log('\n\x1b[31m  DE NORM IS NIET GEHAALD.\x1b[0m\n');
    for (const s of slechter)
      console.log('    ' + s.m.sleutel + ': ' + s.nu + ' terwijl de norm ' + s.norm + ' is  -- ' + s.m.wat);
    console.log('\n  Dit is geen advies. Wat een keer goed was, hoort niet stilletjes slechter te');
    console.log('  worden. Herstel het, of verlaag de norm met de hand in NORM.json -- dan staat');
    console.log('  het als bewuste keuze in de historie.\n');
    return 1;
  }

  /* De veer komt NA het oordeel en voor de schrijfactie: hij hoort bij een
     gehaalde ronde ("en wat ligt er dan nog?") en niet bij een gezakte, want dan
     is de gezakte meter het onderwerp en niet de traagste. */
  toonVeer(norm, new Date().toISOString().slice(0, 10));

  const teSchrijven = beterDan.length + nieuw.length + presBeter.length + presNieuw.length;
  if (teSchrijven && !vastleggen) {
    console.log('\n\x1b[32m  De norm is gehaald\x1b[0m' +
      (beterDan.length + presBeter.length ? ', en op ' + (beterDan.length + presBeter.length) + ' punt(en) ruim' : '') +
      (nieuw.length + presNieuw.length ? '; ' + (nieuw.length + presNieuw.length) + ' meter(s) wachten nog op een grondwaarde' : '') + '.');
    console.log('  \x1b[2mLeg dat vast met: node scripts/norm.js --vastleggen\x1b[0m\n');
    return 0;
  }
  /* HIER STOND `if (beterDan.length && vastleggen)`. Een meter die je toevoegt
     terwijl er verder niets verbeterde, viel dus door naar "de norm is gehaald"
     en werd NOOIT vastgelegd -- hij bleef eeuwig zonder grondwaarde en dus
     eeuwig tandeloos. Nieuwe meters zijn nu op zichzelf reden om te schrijven. */
  if (teSchrijven) {
    /* Alleen de verbeterde meters opschuiven. Een meter die gelijk bleef of
       (onmogelijk, want dan waren we hierboven al gestopt) slechter werd, raken
       we niet aan.
       De overige velden van NORM.json blijven staan: `notities` draagt de reden
       van een met de hand verlaagde norm, en die mag niet bij de eerstvolgende
       --vastleggen stilzwijgend verdwijnen. */
    const vandaag = new Date().toISOString().slice(0, 10);
    const uit = { ...norm, vastgelegd: vandaag, meters: { ...norm.meters }, sinds: { ...(norm.sinds || {}) } };
    /* DE DATUM HOORT BIJ DE METER EN NIET BIJ HET BESTAND. `vastgelegd` staat op
       de dag waarop er voor het LAATST iets is opgeschoven, welke meter dan ook.
       Daaruit is niet af te lezen dat inlineStijlAttributen sinds april niet is
       bewogen terwijl de dekking wekelijks stijgt -- en juist dat verschil is wat
       de veer hierboven laat zien. Vandaar een datum per meter, gezet op het
       moment dat hij werkelijk verbetert. */
    for (const b of beterDan) { uit.meters[b.m.sleutel] = b.nu; uit.sinds[b.m.sleutel] = vandaag; }
    for (const m of METERS) if (uit.meters[m.sleutel] === undefined) {
      uit.meters[m.sleutel] = nu[m.sleutel];
      uit.sinds[m.sleutel] = vandaag;                 // een nieuwe meter begint vandaag stil te staan
    }
    /* De prestatielat schrijven we alleen als er cijfers ZIJN en ze van dezelfde
       machine en modus komen. Anders zou een ronde op een andere machine de lat
       stilletjes verzetten -- omhoog of omlaag, allebei fout. */
    if (presBeter.length || presNieuw.length) {
      uit.prestatie = { ...(norm.prestatie || {}) };
      for (const b of presBeter) uit.prestatie[b.m.sleutel] = b.nu;
      for (const n of presNieuw) uit.prestatie[n.m.sleutel] = n.nu;
      uit.prestatieBron = pres.bron;
      if (pres.kalibratie) uit.prestatieKalibratie = pres.kalibratie;
      uit.prestatieGemeten = pres.gedraaid;
    }
    fs.writeFileSync(NORMBESTAND, JSON.stringify(uit, null, 2) + '\n');
    if (beterDan.length) {
      console.log('\n  \x1b[32mNorm strakker gezet op ' + beterDan.length + ' punt(en).\x1b[0m');
      for (const b of beterDan) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    }
    if (nieuw.length) {
      console.log('  \x1b[36m' + nieuw.length + ' nieuwe meter(s) vastgelegd.\x1b[0m');
      for (const n of nieuw) console.log('    ' + n.m.sleutel + ': ' + n.nu);
    }
    if (presBeter.length) {
      console.log('  \x1b[32mPrestatielat strakker gezet op ' + presBeter.length + ' punt(en).\x1b[0m');
      for (const b of presBeter) console.log('    ' + b.m.sleutel + ': ' + b.norm + ' -> ' + b.nu);
    }
    if (presNieuw.length) {
      console.log('  \x1b[36m' + presNieuw.length + ' prestatiemeter(s) vastgelegd\x1b[0m \x1b[2m(geldig op ' + pres.bron + ')\x1b[0m');
      for (const n of presNieuw) console.log('    ' + n.m.sleutel + ': ' + n.nu);
    }
    console.log('');
    return 0;
  }

  console.log('\n  \x1b[32mDe norm is gehaald.\x1b[0m\n');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, leesNorm, METERS, schoon, traagsteTanden, heeftEinde, dagenTussen, oordeel,
  PRESTATIEMETERS, leesPrestatie, bron, PRESTATIEBESTAND, telOngeijkt, telInlineStijl, telSkips,
  telBewijslaag };
