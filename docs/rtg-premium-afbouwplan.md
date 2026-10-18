# RTG Premium Afbouwplan — alle apps in diepte, breedte en inhoud

*Onderzoeks- en uitvoeringsbijlage van 17 oktober 2026 bij
`AFBOUWPROGRAMMA.md`. Dit document bepaalt hoe de bestaande apps en functies
worden geprofessionaliseerd. Het is geen tweede completion-register, geen
productiebewijs en geen toestemming voor livegang.*

## 0. Het besluit dat dit document uitvoert

RTG heeft al een breed productfundament. Het werk is daarom niet: nog meer
losse apps bedenken. Het werk is iedere toegezegde capability als één complete,
vindbare, begrijpelijke en aantoonbaar betrouwbare gebruikerstaak laten werken.

Dit plan voert de bestaande grenzen uit:

- `AFBOUWPROGRAMMA.md` bepaalt wat toegezegd, geblokkeerd, extern of afgewezen
  is;
- `CONSOLIDATIE.md` bepaalt wat tot de lanceerbare kern hoort en welke
  architectuurgrenzen niet mogen verschuiven;
- `APPWERKT.json` en de ketenproeven blijven de bronnen voor werkend bewijs;
- Heritage, Edge, Rahul, Flow en Spatial blijven gedeelde presentaties boven op
  de bestaande domeinbronnen;
- er komt geen tweede appregister, router, sessiemotor, AI-agent, casebackend of
  betaalmotor.

Een merge van dit plan maakt het tot de uitvoeringsvolgorde voor de
productafbouw uit `AFBOUWPROGRAMMA.md`. Hij verklaart geen app voltooid en
verleent geen productie-, betaal-, autorisatie- of migratiegoedkeuring.

## 1. Onderzochte stand

De nulmeting is uitgevoerd op `main` commit
`dc91a23a921e70d3290b6aadc0377751cf21995b`. De afzonderlijke integratiestand
`81dbabf24ce81fb700a5a1f3fcb5e1db3a658436` is gebruikt om bestaand TravelOS-,
WorkOS-, Regie- en Rahul-werk niet opnieuw voor te stellen. Die integratiestand
is geen stabiele main en wordt afzonderlijk beoordeeld.

| doorsnede | gemeten omvang | betekenis en grens |
|---|---:|---|
| RTG-appcatalogus | 90 | vaste catalogusregels, geen negentig bewezen eindtaken |
| Foundation-catalogus | 58 | catalogusregels; deelt 18 bestemmingen met RTG |
| unieke catalogusbestemmingen | 130 URL's / 122 HTML-paden | acht Geld-ingangen zijn standen van één scherm |
| schermbronnen | 333 | 309 schermen, 20 redirects en 4 geïsoleerde apppakketten |
| functieschakelaars | 228 | beleids- en zichtbaarheidsgrenzen, geen telling van alle knoppen |
| werkruimte-ingangen | 116 | 114 geregistreerde ingangen plus Home en AI |
| zoeklabels | 584 op 77 bestemmingen | begrensde zoekindex, geen inventaris van elke dynamische handeling |
| serverrouter | 5.508 unieke paden | registratie; geen bewijs van uitvoering, bevoegdheid of providerwerking |

De aantallen zijn verschillende doorsneden en mogen niet bij elkaar worden
opgeteld. Bronaanwezigheid is evenmin bewijs dat de volledige taak werkt.

De volledige broninventaris is reproduceerbaar uit de bestaande bronnen:

- `server/kern/appcatalogus-data.js` en
  `server/kern/rtfappcatalogus-data.js`;
- `server/functies/register.js`;
- `scripts/lib/wereldregister.js`;
- de schermbronnen onder `public/apps/`, de publieke ingangen en de vier
  afzonderlijke apppakketten;
- `scripts/routekaart.js` voor de actuele routerstand;
- `SCHERMEIGENAAR.json`, `APPWERKT.json` en de bestaande ketenproeven voor
  eigenaarschap en bewijs.

## 2. Wat de nulmeting zegt

### 2.1 Eén stylesheet maakt nog geen passend scherm

Alle 309 schermen bereiken statisch de gedeelde editorial-stijl. Toch krijgen
veel schermen een generieke compositie. Een filmische wereldstart, een agenda,
een formulier, een gesprek en een meerpanelenwerkruimte hebben een andere
informatiehiërarchie nodig.

Het ontwerp wordt daarom niet per URL bedacht, maar uit zes bestaande
taakcomposities opgebouwd:

1. binnenkomst en wereldoriëntatie;
2. ontdekken en zoeken;
3. lijst en detail;
4. formulier en meerstappenwerk;
5. gesprek en liveactiviteit;
6. canvas en Spatial-werkruimte.

Filmisch betekent: beeld of materiaal loopt waar passend tot aan de
schermranden, terwijl tekst en bediening veilige leesmarges houden. Een compact
taakscherm krijgt geen grote hero enkel omdat de gedeelde laag er een kan
tekenen.

### 2.2 De aanbodbreedte is niet overal zichtbaar

De Living Mall-projectie vraagt momenteel de eerste 24 vaste bibliotheekitems
op en geeft de zoekterm niet door. Daardoor komt een deel van de vaste
catalogus niet in deze projectie terug, terwijl de volledige catalogus wel
bestaat. Dit is een voorbeeld van een huisbrede regel: een capability die in de
bron bestaat, moet via de juiste ingang vindbaar zijn of bewust en uitlegbaar
zijn afgeschermd.

### 2.3 Taxonomie en namen vragen één eigenaar

De twee catalogi delen bestemmingen, maar zeven van de achttien gedeelde
bestemmingen dragen verschillende namen. De RTG-categorie `leven` is leeg,
terwijl levensfuncties elders zijn ondergebracht. Dertien werkgerichte
catalogusregels staan onder `media`. Dit hoeft niet met een massale hernoeming
te worden opgelost: per capability wordt eerst de canonieke eigenaar, taaknaam,
wereld en doelgroep vastgesteld.

`PLATFORM.md` bevat daarnaast zowel LIFE/WORK/FOUNDATION/INSTELLINGEN als de
runtime-indeling LivingOS/WorkOS/TravelOS/FoundationOS. De runtime-indeling
blijft de werkbasis totdat de eigenaar expliciet een andere productnaam kiest.

### 2.4 De bewijsstand loopt niet gelijk met de code

Het opgeslagen APPWERKT-rapport is ouder dan een deel van de onderzochte code.
Ontbrekend bewijs betekent niet automatisch dat een app defect is. Het betekent
wel dat `voltooid` niet mag worden geclaimd. De actuele code moet via de
bestaande acht bewijzen en relevante ketenproeven opnieuw worden gemeten.

### 2.5 Inline maatwerk is een migratierisico, geen automatisch defect

Veel schermen bevatten eigen CSS of inline stijl. Dat kan een noodzakelijke
canvasafwijking zijn of historische duplicatie. Verwijderen gebeurt alleen na
een visuele en functionele vergelijking. Beschermde kaarten, editors, media- en
spelcanvassen behouden hun functionele ruimte.

## 3. Het premium contract per capability

Iedere canonieke capability krijgt vóór de brede migratie één taakcontract.
Routes, panelen, Edge en Rahul verwijzen daarna naar dezelfde taak en dezelfde
domeinbron.

| dimensie | verplicht contract | bewijs van gereedheid |
|---|---|---|
| diepte | starten, invoeren, valideren, voorbereiden, bevestigen, resultaat, wijzigen, onderbreken, hervatten, fout en herstel voor zover toepasselijk | de kernbelofte kan tot echte status worden voltooid zonder gegevensverlies |
| breedte | doelgroepen, rollen, organisaties, apparaten, ingangen, zoekwoorden en appverbindingen | iedere bedoelde gebruiker vindt de taak en ziet alleen toegestane gegevens en acties |
| inhoud | bron, redactieverantwoordelijke, taal, doelgroep, actualiteit, voorwaarden, mediarechten en alle relevante toestanden | inhoud helpt beslissen en uitvoeren zonder fictief aanbod of sterkere status dan de backend bevestigt |
| vormgeving | juiste taakcompositie, RTG-identiteit, veilige marges, mobiel/desktop en passende informatiedichtheid | visuele hiërarchie ondersteunt de taak en blijft herkenbaar over Flow en Spatial |
| bediening | toetsenbord, touch, focus, Edge-context, Rahul-ingang, terug/vooruit en open volledige app | dezelfde toegestane taak blijft voorspelbaar bedienbaar zonder parallelle navigatie |
| continuïteit | concept, sessie, account, route, panelen, offlinegrens en conflictgedrag | refresh, onderbreking en geldige overdracht herstellen de juiste context |

Het contract is klein genoeg om per capability te toetsen. Niet iedere app
krijgt geforceerd een betaling, chat, mediafunctie of Spatial-paneel. Alleen wat
bij de taak hoort wordt gebouwd.

## 4. Inhoudsstandaard

Ieder apppakket bevat ten minste:

- één duidelijke productbelofte en herkenbare taaknamen;
- informatie die nodig is vóór een besluit of bevestiging;
- de herkomst en actualiteit van operationele gegevens;
- gast-, lege, laad-, gedeeltelijke, fout-, geen-toegang- en hersteltoestanden
  waar die kunnen voorkomen;
- een concrete volgende stap wanneer niets beschikbaar is;
- uitleg van prijs, voorwaarden, toestemming en bewaargedrag waar relevant;
- taal- en doelgroepregels via de bestaande vertaal- en toonvoorzieningen;
- mediabron en gebruiksrechten;
- hulp en escalatie die werkelijk beschikbaar zijn.

Productie wordt niet gevuld met verzonnen activiteit om een leeg scherm rijker
te laten lijken. Een lege toestand moet juist uitleggen wat de gebruiker kan
doen en wat RTG nog niet weet.

## 5. Werkpakketten voor alle catalogusfamilies

Deze zeventien pakketten omvatten alle 148 catalogusregels. Gedeelde
bestemmingen worden één keer bij hun capability-eigenaar gebouwd en in beide
contexten gepresenteerd.

| familie | diepte en breedte | inhoudelijke afbouw |
|---|---|---|
| RTG Sociaal & contact (11) | volledige lus voor maken, antwoorden, delen, ontvanger, rechten en herstel; Pulse/Salon en wereld/Sociaal bij bestaande eigenaar beslissen | feed, club, reisgroep, introductie, lege kring en naamgeving feitelijk beschrijven |
| RTG Reizen & verblijf (13) | zoeken, samenstellen, boeken/aanvragen, bevestigen, wijzigen, annuleren, documenten en onderwegstatus verbinden | aanbodherkomst, prijsvoorwaarden, beschikbaarheid en boekingsstatus helder maken |
| RTG Eten & uitgaan (4) | reserveren, wijzigen, annuleren, gasten/dieet/tafel en eigen voorraad doorlopen | menu, allergenen, tijd, gastenlijst, drinkvenster en lege voorraad tonen |
| RTG Media & creatie (28) | per capability maken/openen/bewaren/delen/exporteren of afspelen/stoppen/hervatten; document- en bestandsduplicatie voorkomen | formaat, versie, opslag, makersrechten, netwerk- en apparaatgrenzen uitleggen |
| RTG Geld & werk (8) | één Geld-bestemming met herkenbare standen; herkomst, bevoegdheid, bevestiging, idempotentie, correctie en audit | onderscheid overzicht, administratie, verzoek en uitgevoerde betaling |
| RTG Spelen & sport (2) | starten, spelen, stoppen, hervatten en samen spelen; leeftijdsgrens voor blijvende competitie afdwingen | regels, deelnemers, sessiestatus en eindige selecties uitleggen |
| RTG Leven & gezondheid (0) | geen capability bijbouwen vanwege een leeg label; wonen, gezin, gezondheid en ritmes eerst mappen | categorieomschrijving en taaknamen expliciet besluiten |
| RTG Veiligheid & identiteit (4) | start/stop, ontvangerkring, timer, statusbewijs, accountherstel, toestemming en intrekking | zeggen wat echt actief is, wie wordt bereikt en waar de grens ligt |
| RTFoundation-ingangen (20) | overgang tussen lid, gezin, leerling, leeftijd en terug met uitlegbare weigering | ledeningang, gezinsprofiel en publieke stichting onderscheiden; gedeelde namen harmoniseren |
| RTF Leren & school (10) | doel, les, opgave, feedback, bewaren en verdergaan; leerling ziet geen begeleidersbord | concrete lessen en feedback; leerpaspoort blijft persoonlijk en geen ranglijst |
| RTF Maken & ontdekken (10) | leeftijdspassend maken, lezen, bewaren en binnen toegestane kring delen | echte verhalen/liedjes, voorbeelden, rechten en lege creatieve start |
| RTF Spelen & ondernemen (2) | Foundation-context, deep-link, hervatten en leeftijdsgrens toetsen | spel- en ondernemingsbegrippen in taal voor de doelgroep |
| RTF Samen in het gezin (12) | delen/toestemming, taken, agenda, berichten, ruilen en deelname van begin tot resultaat | concrete afspraken, recepten, routines, locaties en eerlijke lege gezinsstatus |
| RTF Gevoelens & steun (8) | geen-opslagbelofte, anonieme code, intrekking, echte hulproute en veilige afsluiting | actuele hulplijnen, leeftijdspassende toon en onderhoudseigenaar |
| RTF Geld & later (7) | rekenen/bewaren, cv meenemen, vacature/sollicitatiestatus en profielrechten | termen en voorbeelden; schatting duidelijk scheiden van vastgelegde toestand |
| RTF Veilig & gezond (6) | persoonlijke zichtrechten, intrekking/verval, afspraak-/medicatiestatus en hulproute | privacy in gewone taal en werkelijk zichtbare zorgcontacten |
| RTF Bibliotheken (3) | zoeken, filteren, lezen, installeren/verwijderen en leeftijdsniveau over gedeelde catalogusbediening | herkomst, licentie, actualiteit en gelijkwaardige beschrijving van tradities |

## 6. Schermen buiten de catalogi

De catalogus is niet het hele platform. Beheer, enterprise, kantoor,
leveranciers, partners, publieke pagina's en specialistische schermen vallen
onder hetzelfde taakcontract via hun bestaande capability-eigenaar.

- redirects krijgen context-, geschiedenis- en deep-linkcontrole;
- beheer en enterprise krijgen informatiedichtheid zonder de publieke
  filmische compositie te kopiëren;
- partner- en leveranciersschermen krijgen rol-, tenant- en overdrachtstoetsen;
- canvassen krijgen toetsenbordalternatieven voor kritieke handelingen;
- de vier geïsoleerde apppakketten blijven binnen hun eigen sandbox- en
  distributiegrenzen;
- publieke pagina's behouden één voordeur en gebruiken geen tweede
  marketingsite.

## 7. Uitvoeringsvolgorde

De door de eigenaar gekozen Full Build → Final Qualification-strategie wordt in
dit plan concreet gemaakt. Gerichte tests blijven tijdens de bouw verplicht; de
platformbrede kwalificatie volgt op de geïntegreerde kandidaat. De bestaande
werkstromen en hun grenzen blijven gelden totdat een afzonderlijk
integratiebesluit ze wijzigt.

### Fase 0 — plan en bronbasis vastzetten

- dit document beoordelen en mergen;
- vaststellen welke integratiewijzigingen veilig boven op de actuele main worden
  overgenomen;
- de runtime-productnamen, acht open eigenaarschapsbesluiten en lege/mengende
  categorieën expliciet sluiten;
- per eerste capability de eigenaar, bron en bestaande tests vastleggen.

**Uitkomst:** één goedgekeurde basis en geen werkpakket zonder eigenaar of
grens.

### Fase 1 — drie referentie-ervaringen

1. een filmische wereldstart voor oriëntatie en ontdekken;
2. een compacte operationele lijst/formulierervaring;
3. de bestaande TravelOS-keten in Flow en Spatial, met Edge en Rahul op dezelfde
   capability.

Deze drie referenties worden mobiel en desktop beoordeeld. Ze leveren de
gedeelde composities, componentvarianten, contentstructuur en testvorm voor de
rest van het huis.

**Uitkomst:** herbruikbare patronen die aantoonbaar bij drie verschillende
soorten werk passen.

### Fase 2 — lanceerbare kern compleet maken

- RTG Pass en identiteit;
- TravelOS;
- WorkOS en Regie;
- betalen en financiële terugkoppeling;
- Rahul en Edge;
- Flow ↔ Spatial, onderbreken, hervatten en foutisolatie.

Accountisolatie, autorisatie, gegevensbehoud en financiële veiligheid zijn
voorwaarden voordat afhankelijke bouw erop voortgaat.

**Uitkomst:** volledige kernreizen met echte status en dezelfde bron in Flow,
Spatial, Edge en Rahul.

### Fase 3 — alle families migreren

De zeventien catalogusfamilies en de niet-gecatalogiseerde schermgroepen worden
in kleine samenhangende PR's gemigreerd. Onafhankelijke families mogen
parallel. Een pakket bevat ontwerp, inhoud, relevante toestanden, gerichte tests
en een expliciete nog-te-kwalificeren grens.

**Uitkomst:** iedere inbegrepen capability heeft een taakcontract en geen route
valt stil tussen catalogus en schermregister.

### Fase 4 — ketens tussen apps

- contextoverdracht tussen domeinen;
- opdrachten, documenten, berichten en goedkeuringen;
- rollen, organisaties, delegatie en intrekking;
- vindbaarheid over catalogus, Command, Edge en Rahul;
- betaling, bewijs en herstel over de volledige taak.

**Uitkomst:** één canonieke eigenaar per capability en geen dubbele boeking,
betaling, sessie of berichtenbron.

### Fase 5 — gezamenlijke eindkwalificatie

De geïntegreerde kandidaat doorloopt:

- de acht bestaande APPWERKT-bewijzen;
- relevante keten-, contract-, beveiligings- en mutatieproeven;
- alle schermgroepen, redirects en geïsoleerde pakketten;
- mobiele en desktopmatrix;
- toetsenbord, focus, schermlezer, contrast, tekstvergroting, touch en reduced
  motion;
- LCP, INP, CLS, bundels, paneelinitialisatie en resource-opruiming;
- echte providergrenzen, back-up/herstel, monitoring en incidentprocedures;
- menselijke taakproeven met nieuwe en ervaren gebruikers;
- inhoudelijke, juridische en sectorspecifieke controles waar nodig.

**Uitkomst:** een reproduceerbaar release-oordeel. Livegang blijft een apart
eigenaarsbesluit.

## 8. PR- en werkpakketcontract

Iedere bouw-PR vermeldt:

1. het probleem en de gebruikerstaak;
2. wat al bestond en wordt hergebruikt;
3. het capability- en schermeigenaarschap;
4. de wijziging in diepte, breedte en inhoud;
5. behouden contracten en featureflag/terugval waar toepasselijk;
6. lokale tests en hun exacte bereik;
7. prestatie- en toegankelijkheidsimpact;
8. open eindkwalificatie, externe voorwaarden en risico's.

Een werkpakket wijzigt geen gegenereerde registers handmatig. Het mag alleen
`DEFINITIEF_GEDEKT` heten nadat de bestaande bewijsbronnen dat op de
geïntegreerde kandidaat bevestigen.

## 9. Acceptatie per capability

Een capability mag pas premium heten wanneer:

- kernbelofte, doelgroep, eigenaar en geldige ingangen vaststaan;
- de toepasselijke taaklus werkelijk kan worden voltooid en hersteld;
- serverautorisatie en object-/tenantgrenzen opnieuw worden gecontroleerd;
- gast-, lege, laad-, fout-, verlopen-, offline- en herstelsituaties waar
  toepasselijk begrijpelijk zijn;
- de inhoud een eigenaar, bron, actualiteit en taalbeleid heeft;
- mobiel en desktop dezelfde onderliggende mogelijkheid behouden;
- toetsenbord, focus, schermlezer, contrast, touchdoelen en reduced motion zijn
  gecontroleerd;
- Edge minimaal 44 × 44 px bedieningsruimte behoudt en invoer/livewerk niet
  hindert;
- Rahul alleen bestaande toegestane acties voorstelt en Trusted Execution niet
  omzeilt;
- Flow en Spatial dezelfde domeinbron gebruiken;
- de relevante APPWERKT-bewijzen en ketenproeven actueel en reproduceerbaar
  zijn.

De afgesproken prestatiedoelen blijven LCP maximaal 2,5 seconde, INP maximaal
200 milliseconde en CLS maximaal 0,1 op p75, afzonderlijk voor mobiel en
desktop. Ze worden pas geclaimd na meting in de bedoelde omgeving.

## 10. Volgorde binnen ieder familiepakket

Prioriteit wordt niet bepaald door welke pagina het makkelijkst opnieuw te
stylen is:

1. veiligheids-, privacy-, geld- en gegevensverliesrisico's;
2. gedeelde onderdelen met het grootste bereik;
3. primaire taakroutes met veel gebruikersimpact;
4. inhoud en lege/fout-/hersteltoestanden;
5. resterende schermvarianten en uitzonderlijke canvassen;
6. ketenbewijs en integratie met andere domeinen.

Een breed probleem krijgt een gedeelde reparatie als dezelfde oorzaak is
bewezen. Een taakscherm wordt niet onder een generieke laag gedwongen als dat de
taak verslechtert.

## 11. Wat dit plan bewust niet claimt

- De 333 bronnen zijn in de nulmeting geïnventariseerd, maar niet iedere rol,
  dynamische toestand en externe provider is opnieuw handmatig doorlopen.
- L0–L4 uit de Workspace Runtime beschrijft hostintegratie, geen algemene
  productkwaliteit.
- Een geregistreerde route, catalogustegel, zoekterm of stylesheet bewijst geen
  voltooibare functie.
- Een ontbrekende APPWERKT-fixture bewijst bewijsachterstand en niet zonder meer
  een defect.
- `RTG 9+` is geen huidige score. Een score volgt alleen uit vooraf vastgelegde
  criteria, metingen en menselijke beoordeling.
- Dit document verandert geen autorisatie, betaalcontract, database, provider
  of publieke beschikbaarheid.

## 12. Eerste bouwpakket na dit plan

Na merge begint één afzonderlijke PR met de drie referentie-ervaringen uit fase
1. Die PR onderzoekt eerst de reeds aanwezige Heritage-profielen, cinematic
laag, Edge-contracten en TravelOS-presentaties. Hij bouwt geen tweede shell of
router.

De referentie-PR levert:

- voor- en naweergaven op representatieve mobiele en desktopschermen;
- de definitieve regels voor rand-tot-rand materiaal en veilige inhoudsmarges;
- een compacte operationele compositie zonder onnodige herohoogte;
- Flow ↔ Spatial-continuïteit op dezelfde TravelOS-taak;
- gerichte visuele, functionele en toegankelijkheidstoetsen;
- een migratiehandleiding voor de volgende appfamilies.

Pas na beoordeling van deze referenties wordt hetzelfde patroon breed over de
schermen uitgerold.
