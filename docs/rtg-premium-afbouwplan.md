# RTG Premium Afbouwplan — alle apps in diepte, breedte en inhoud

*Onderzoeks- en uitvoeringsbijlage van 17 oktober 2026 bij
`AFBOUWPROGRAMMA.md`. Dit document bepaalt hoe de bestaande apps en functies
worden geprofessionaliseerd. Het is geen tweede completion-register, geen
productiebewijs en geen toestemming voor livegang.*

**Uitvoeringsaanvulling 11 november 2026 — RTG NEXT / The Living System.**
Het programma in [§13–19](#13-rtg-next--de-uitvoerbare-bouwbasis) concretiseert
de volledige afbouw op de huidige repository. Het vervangt de eerdere keuze
voor drie referenties door twaalf. Het [werkboek voor alle ingangen](rtg-next/werkboek.md)
koppelt bestaande broncode en productbeloften aan gewenste eindtoestand,
wijzigingen, afhankelijkheden en acceptatiescenario's. De machineleesbare
[programma-overlay](rtg-next/programma.json) bevat werkpakketten, architectuur-
verwijzingen, poorten en budgetvoorstellen; zij verleent geen runtimegezag.
De nulmeting in §1–2 blijft historische context van 17 oktober.

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

### Fase 1 — twaalf referentie-ervaringen

Reistab, Vluchten, Geld, Passkeys, Berichten, Mall, Vandaag, RTG Veilig,
RTDocs, Decision Room, Horeca en Foundation Zorg vormen de vaste eerste
doorsnede. Hun precieze functie-id's, taken, storingen en vereiste uitkomsten
staan in `rtg-next/programma.json` onder `referenceCohort`.

Zij omvatten wereldoriëntatie, compacte taken, transacties, langdurig werk,
communicatie, gevoelige gegevens en menselijke besluitvorming. Iedere taak
doorloopt de toepasselijke mobiele/desktop-, rol-, netwerk- en herstelmatrix.
Flow en Spatial delen dezelfde canonieke bron waar beide van toepassing zijn.

**Uitkomst:** poort G1 uit §15. De gedeelde Living Runtime wordt pas over de
overige ingangen uitgerold nadat deze twaalf referenties zijn gekwalificeerd.
Onafhankelijke inventarisatie, ontwerp en noodzakelijke veiligheidsreparaties
aan de overige ingangen mogen ondertussen doorgaan.

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

De eerste integratie-eenheid is P0: actuele bronbaseline, eigenaarschap,
scopebesluiten en twaalf bevroren taakcontracten. Daarna kunnen P1, P4 en P6
parallel beginnen. De twaalf referenties worden in kleine, toetsbare PR's
gebouwd en komen samen op één kandidaat voor G1. Een merge, release of externe
handeling volgt niet automatisch uit dit plan.

## 13. RTG NEXT — de uitvoerbare bouwbasis

Bronbaseline: `abd1eafdccd6865631d634d5899676c1c1e7fa68`, onderzocht op
11 november 2026. MAPPEN bevat 114 ingangen: LivingOS 59, TravelOS 15,
WorkOS 17, FoundationOS 13 en Instellingen 10. Dat zijn niet noodzakelijk
114 afzonderlijke domeinimplementaties. Geldstanden, tabs en keuzeschermen
delen bronnen en eigenaars. Er komt geen app 115 door dit programma.

De productnavigatie LIFE / WORK / FOUNDATION / INSTELLINGEN is het gewenste
presentatiemodel. TravelOS blijft daarbinnen herkenbaar. De runtimewerelden,
autorisatie en gegevensgrenzen worden daardoor niet samengevoegd. P0 legt de
naammapping expliciet vast bij de bestaande eigenaar.

De opgeslagen APPWERKT-ronde is van 5 november, commit `c970100004`:
114 ingangen bezocht, nul browserdefecten in die ronde, zeven ingangen zonder
volledige bediening; de samengestelde telling is 114 `NIET_GETEST`.
EXPERIENCEWERKT heeft geen kandidaatcommit en vermeldt 0/114, 0/316 en
0/3.360 bewezen. In de actuele signaturebron staan wél één appdeclaratie en
tien schermdeclaraties. Declaratieve aanwezigheid, historisch testresultaat
en actuele kwalificatie worden afzonderlijk gerapporteerd.

Het werkboek wordt afgeleid uit de bestaande MAPPEN-lezer, het appcontract,
SCHERMEIGENAAR, APPWERKT en EXPERIENCEWERKT. Alleen de voorgenomen delta wordt
handmatig onderhouden in twee werkpakketbestanden. Iedere rij bevat een
statische implementatieobservatie met bronpaden, de canonieke belofte,
premiumdoel, concrete wijzigingen, P0–P7-afhankelijkheden, ontwerpfamilie,
budgetprofiel, specifieke acceptatie en externe beslispunten.

De P0-aanvulling van 12 november koppelt alle 316 ontdekte schermen via
`SCHERMEIGENAAR.schermen[route].afbouw`: canonieke eigenaar, P0–P7,
toepasselijke capabilitydossiers, scènefamilie, risicoklasse en taakfamilies.
Daaruit worden criteria, scenario's, apparaatbudgetten en bewijscontracten
afgeleid bij de bestaande Experience-controle. De 203 open toewijzingen zijn
opgelost. 132 ondersteunende schermen behouden hun eigen domeintaak zonder
kunstmatige koppeling aan een menu-ingang; zij blijven volledig binnen G2.
De twaalf bestaande publieke/DS-records buiten de apps-inventaris blijven
ongewijzigd in het bestaande eigenaarsregister.

Nieuwe ideeën in die premiumdoelen zijn ontwerpvoorstellen binnen de bestaande
ingang. Ze worden pas toegezegde scope nadat hun eigenaar ze bij de bestaande
scopebron heeft geaccepteerd. Vergunningen, leveranciers, mediarechten,
medische claims of productiebetalingen worden daardoor nooit impliciet
goedgekeurd. RTFoundation Winkel is als bestaand scherm met eigenaar
`rtf.winkel` binnen de 316 opgenomen, zonder een 115e menu-ingang. Een nieuwe
zelfstandige productbelofte of menu-ingang blijft een expliciet scopebesluit.
De hash in `programma.scopeLock` bewaakt alle 114 canonieke beloften en hun
premiumdoelen, wijzigingen en specifieke acceptatie-uitkomsten. Die hash mag
uitsluitend na een expliciet scopebesluit opnieuw worden vastgezet.

Enkele bronbetekenissen vragen bijzondere zorg: Verblijven is nu een virtuele
Maison-suite, Routedossier een kantoorinspectie, en de reistab combineert
dagprogramma en autoshowroom. Een nieuw ontwerp bewaart die taken of migreert
ze expliciet naar hun bestaande eigenaar, met redirects en acceptatiebewijs.

## 14. Eén Living Runtime boven bestaande eigenaars

| Gebruikersmechanisme | Bestaand fundament | Te realiseren integratie |
|---|---|---|
| Plan Dossier | `stuur/plan.js`, Experience broker, intentregister, PersonalOS | versieerbaar doel, stappen, besluiten en scoped domeinverwijzingen; pauze, deelresultaten en hervatten |
| Consequence Graph | `stuur/gevolgcontract`, `levensgraaf` | geautoriseerde gevolgen met herkomst, onzekerheid, bronversie en gemeten herstelbaarheid |
| Provider Truth Gateway | reservering/providerbewijs, betaalwaarheid, Pay | consistente ontvangstbewijzen en statusprojecties per echte provider, reconciliatie en storingsproeven |
| Adaptive Experience | DS, workspace composer, signatures | negen taakfamilies, rustige contextuele prioritering en vaste bediening |
| Trust Lens | Authority, connection-consent, bewijsvlak | begrijpelijke toegang en delegatie; actuele controle vóór ieder effect |
| Continuity | workspace-continuity, travel-continuity, intentopslag | toegestane concepten en conflictherstel per dataklasse; online bevestiging voor externe effecten |
| Constitution | bestaande experience-, connection-, loop-fabric- en trustregels | één verwijzende architectuurcontractlaag met eigenaar, handhaver en negatieve proef |
| Proof en Change Impact | veranderbereik, aanroepgraaf, bewijs-DAG, Experience, Magnaat | wijzigingsdossier, conservatieve bewijsonvalidatie en onafhankelijke acceptatie |

Public Projection wordt binnen P4 uitgewerkt in de bestaande publieke
voordeur (`index.html`, `server/middleware/landing.js` en `public/site/start`).
De bestaande pijplijn `scripts/websitewaarheid.js` →
`public/site/website-truth.json` blijft de bron; MAPPEN, appgids en brongebonden
beelden worden niet vervangen door een planningscatalogus.
Dezelfde gecontroleerde contracten leveren uitleg en beschikbaarheid.
Demonstraties gebruiken herkenbaar fictieve, geïsoleerde gegevens en kunnen
geen echte boekingen, berichten of betalingen uitvoeren. De landing blijft
één bron voor GitHub Pages en Node; er komt geen tweede marketingsite.

De plancompiler bestaat al en voert zelf niets uit. De broker ondersteunt een
beperkte set adapters; uitbreiding naar de catalogus wordt per taak gebouwd en
bewezen. Het dossier bezit geen tweede boeking, saldo, document, sessie of
toestemming. Het bevat de bedoeling, orkestratiemetadata en beperkte verwijzingen
naar domeinbronnen met actor, doelbinding en bewaartermijn.

Per stap zijn minimaal vastgelegd: canonieke capability, invoerversie,
afhankelijkheden, actuele bevoegdheid, verwachte domeinuitkomst,
bevestigingsgrens, idempotentiesleutel, ontvangstbewijs en herstelklasse.
Bronstatussen blijven canoniek; gebruikerslabels zijn projecties daarop.
`aangevraagd`, `gereserveerd`, `betaald` en `bevestigd` worden nooit uit elkaar
afgeleid zonder geldig domeinbewijs. Ook reserveren kan toestemming vereisen.

Een nieuwe prijs, ingetrokken rol of wezenlijk gewijzigd gevolg maakt een
voorbereid akkoord ongeldig. Onzekere provideruitkomsten worden gereconcilieerd
vóór herhaling. Een keten met drie bevestigde stappen en één onbekende stap
blijft gedeeltelijk uitgevoerd; er is geen fictieve atomaire rollback over
onafhankelijke leveranciers. Herstel onderscheidt `exact`, `compensatie`,
`geen-herstel`, `nietBeproefd` en `wereldOntbreekt`.

De Constitution-crosswalk in `programma.json` verwijst naar bestaande regels
en controles. De nieuwe programmatoets bewaakt de planningstructuur en
bronkoppelingen. Runtimehandhaving van alle architectuurregels blijft
afzonderlijk werk in P0/P1/P6, met mutatietests die verboden duplicatie en
ongeoorloofde koppelingen daadwerkelijk laten falen.

## 15. Werkpakketten, afhankelijkheden en beslispoorten

| Pakket | Verantwoordelijke rol | Vereist | Eerste concrete oplevering |
|---|---|---|---|
| P0 Scope en Constitution | integrator + domeineigenaren | — | besluitenlog, bevroren twaalf taakcontracten, architectuur-crosswalk |
| P1 Authority en Trust | security/privacy | P0 | intrekking tijdens uitvoering en kruisproeven op object/rol/organisatie |
| P2 Plan Dossier en gevolgen | Experience Kernel + domeinen | P1 | één complete voorbereiden–bevestigen–uitvoeren–herstellen-keten |
| P3 Providerwaarheid | reizen/geld + operations | P2 | ontvangstverlies, replay, gedeeltelijke bevestiging en restitutie |
| P4 Signatures en eenvoud | ontwerp/a11y/frontend | P0 | twaalf taakontwerpen met gemeten budgetten in bestaande DS |
| P5 Continuity | Workspace + opslag/security | P2, P4 | dataklassen, veilige concepten, versieconflict en crashherstel |
| P6 Proof en impact | testinfrastructuur + onafhankelijke QA | P0 | diff→getroffen taken→verplichte proeven, met onbekend bereik zichtbaar |
| P7 Acceptatie en kwalificatie | onafhankelijke reviewers + integrator | P1–P6 | bevoegde menselijke reviewketen, G1 en later G2/G3/G4 |

P0 is de afzonderlijke structurele bouwvoorwaarde, geen productkwalificatiepoort.
G1 kwalificeert alle twaalf referenties op één kandidaat. G2 kwalificeert de
volledige actuele catalogus en alle ontdekte schermen. G3 vereist onafhankelijke
kwalificatie, herstel, staging, externe rapporten en twee onafhankelijke runs.
G4 verlangt vervolgens bestaande productiegereedheid en het afzonderlijke
getekende eigenaar-go/no-go. G1 is geen productievrijgave.
P7 is een herhaalbaar kwalificatiepakket met een eigen exit per poort: de
eerste toepassing beoordeelt de twaalf referenties, de tweede alle taken en
de derde onafhankelijke kwalificatie en de vierde productie. De pilot hoeft daardoor niet op de volledige
114-afbouw te wachten. Gate-ID's, volgorde, scopes en noodzakelijke
pakketafhankelijkheden worden door de planningvalidator gecontroleerd.
`qualification-gates.js` herbeoordeelt alle voorlopers, de schone kandidaat,
actuele APPWERKT-bewijzen, opnieuw opgebouwde Experience-dekking en bevoegd
menselijk bewijs. Een zelf ingevuld groen veld geeft geen gezag.
De bestaande release-gate vraagt G3 bij productie; OCI-vrijgave en native
activatie vragen G4 vóór hun effect. De afzonderlijk geautoriseerde rollback
blijft bereikbaar. Deze wijziging voert zelf geen vrijgave of activatie uit.

De uitvoeringsvolgorde van de overige ingangen volgt canonieke eigenaars:
eerst gedeelde veiligheid en geld, vervolgens reis/commerce en werkprocessen,
dan relaties/media/leven en maatschappelijke taken. Families mogen na G1
parallel werken binnen hun bron- en gegevensgrenzen. Een gevoelige
Foundation-taak wordt hierdoor niet versoepeld of overgeslagen.

Iedere PR bevat de bronfunctie-id's, beoogde taakdelta, behouden gedrag,
eigenaar, vereiste besluiten, gewijzigde contracten, gerichte regressies,
negatieve proef, privacy-/prestatie-impact, featureflag en herstelpad.
Elke PR heeft een onafhankelijke reviewer. Grote gedeelde wijzigingen worden
eerst met één referentietaak beproefd voordat afhankelijke schermen migreren.

Een kalender- of capaciteitsbelofte volgt pas na P0 en de eerste gemeten
referentieketen. Leg dan werkelijke doorlooptijd, reviewlast, testduur en
providerwachttijd vast; herplan op die gegevens in plaats van 114 gelijke
appschattingen. Externe wachttijd blijft afzonderlijk zichtbaar.

## 16. Eenvoud als acceptatievoorwaarde

De negen ontwerpfamilies zijn Horizon (oriëntatie), Journey (verloop), Atelier
(maken), Ledger (geld/administratie), Command (operatie), Salon (contact),
Library (lezen/zoeken), Ceremony (bewust besluit) en Spatial (ruimtelijk werk).
Dit zijn voorstellen voor signatures binnen de bestaande composities, geen
negen nieuwe shells. Een taak kan een primaire familie en aanvullende standen
hebben. De werkpakketten leggen de primaire ontwerpkeuze vast.

Op elk taakscherm moet de gebruiker kunnen herkennen: waar ben ik, wat vraagt
aandacht, wat kan ik nu doen, wat is werkelijk bevestigd en hoe kom ik terug?
Progressieve onthulling houdt verdieping bereikbaar. Verandering van context
mag geen primaire actie verplaatsen terwijl iemand invoert of bevestigt.
Rahul is optioneel; elke kernbelofte houdt een gelijkwaardige handmatige route.

De bestaande `experience/*.json`-journeys hebben al `effortBudget` en de
coveragecontracten hebben releasebudgetten. P4 voegt echte taakmetingen toe;
de aanwezigheid van een getal bewijst geen eenvoudige ervaring. De vijf
profielnamen in `programma.json` verwijzen nu uitsluitend naar
`coverage-contract.qualificationPlanning`; zij bezitten geen tweede norm.
Die bron legt twaalf taakfamilies en twaalf budgetcellen vast: drie
risicoklassen × vier bestaande apparaatprofielen. Alle budgetten zijn
`CONTRACT_DEFINED`, niet gemeten:

- browse, compose, transaction, sensitive en realtime krijgen een eigen
  meetprotocol en herstelgrens;
- lokale zichtbare feedback heeft p95 ≤200 ms; dit is een apart
  labdoel, geen claim over providerdoorlooptijd en geen vervanging van INP;
- nul onnodige contextwissels of dubbele invoer; standaard één duidelijke
  primaire actie. Noodzakelijke veiligheidsbevestigingen tellen als betekenisvolle
  stappen en verdwijnen niet om een klikbudget te halen;
- betekenisvolle stappen krijgen per taak een vastgestelde grens. De bestaande
  reistaak heeft bijvoorbeeld acht; die waarde wordt niet op iedere app geplakt;
- bij wachten zijn voortgang, bronstatus, behoud van invoer, annuleren waar
  mogelijk en volgende stap zichtbaar. Provider-SLA en reconciliatietermijn
  komen uit het echte providercontract;
- herstel meet verlies van beloofde opgeslagen invoer, dubbele effecten en
  onbevoegde heropening; elk van deze ongewenste uitkomsten moet nul zijn.

De bestaande algemene normen blijven LCP p75 ≤2,5 s, INP p75 ≤200 ms,
CLS p75 ≤0,1 en minimaal 44 px interactieve doelen waar het contract dat eist.
Meet afzonderlijk per doelapparaat, netwerkprofiel en relevante rol.
Realtime transport, grote documenten en gevoelige bevestigingen hebben
aanvullende taakbudgetten; een gemiddelde over snelle en trage taken is geen
acceptatiebewijs.

Menselijke taakproeven meten zonder hulp kunnen starten, de juiste keuze
begrijpen, voltooien en herstellen. Het contract legt per risicofamilie
taaksteekproef en succesdrempel vast; echte representatieve deelnemers en
bevoegde reviewers blijven te organiseren. Alle canonieke taken krijgen beoordeling.
Rapporteer aantallen en spreiding, geen onbewezen populatiepercentage. Een
kritieke misvatting over ontvanger, bedrag, gegevensdeling of onomkeerbaarheid
blokkeert acceptatie, ook als de taak technisch slaagt.

## 17. Bewijs en onafhankelijke premiumacceptatie

Iedere werkpakketdelta doorloopt de volledige toepasselijke levensloop:
starten, wijzigen, voorbereiden, bevestigen, voltooien, annuleren, onderbreken,
hervatten, fout en herstel. Kruis deze met toegestane/verboden rollen,
organisaties, accountwissel, apparaat, netwerk, tijd/expiry en toegankelijkheid.
Een gemotiveerde niet-toepasselijkheid vereist een eigenaarsbesluit; onbekend
en niet getest blijven open.

De acht APPWERKT-bewijzen blijven canoniek. Experience voegt identiteit,
compositie, continuïteit, terughoudendheid, adaptiviteit, toegankelijkheid,
vloeiendheid en menselijke kwaliteit toe. De 316 schermen en 3.360 voorwaarden
zijn een opgeslagen meetbasis. De 3.360 zijn toepasselijke dimensiegroepen,
niet alle losse scenario-, apparaat- en netwerkproeven. De 228 specifieke
capabilityscenario's blijven behouden en krijgen 48 aanvullende gedeelde
scenario's. Hun concrete bewijseisen vergroten de vereisten binnen die groepen;
nieuwe schermen en dimensies laten ook de groepsnoemer groeien. Geen norm wordt
verwijderd om 100% te bereiken.

P7 bevat een concrete technische blokkade: `scripts/lib/experience/artifact.js`
weigert momenteel `human-quality`, omdat een zelf ingevulde reviewer geen
bevoegde bevestigingsbron is. Bouw hiervoor de koppeling aan de bestaande
reviewvoorziening: geauthenticeerde reviewer, onafhankelijkheid ten opzichte
van de bouwer, kandidaat-/scope-/configuratie-/artefactbinding, ondertekend of
anders aantoonbaar bevoegd ontvangstbewijs, audit, intrekking en verval bij
relevante bronwijziging. Verwijder de blokkade pas met positieve én negatieve
proeven; een naamveld in JSON is onvoldoende.

De Premium Acceptance Council is een gescheiden acceptatieproces met vijf
oordelen: techniek, beveiliging/privacy, toegankelijkheid, visueel ontwerp en
echte taakervaring. Reviewerrollen mogen praktisch gecombineerd worden als
bekwaamheid en onafhankelijkheid aantoonbaar blijven. De auteur kan zijn eigen
werk niet definitief accepteren. Een kritieke bevinding heeft vetorecht; een
meerderheid kan een ontbrekend veiligheidsbewijs niet wegstemmen.

### Premium Experience Gate — aanvullende eigenaarseis van 12 november

Deze afzonderlijke kwaliteitscontrole telt mee binnen G1 en G2 en daardoor
ook binnen G3/G4. Er komt geen vijfde beslispoort of extra bewijsregister.
De vijf voorwaarden zijn conjunctief: één ontbrekend of onvoldoende oordeel
blokkeert de volledige toepasselijke ervaring.

| Vraag | Verplicht bewijs |
|---|---|
| Kan een nieuwe gebruiker zonder uitleg de belangrijkste taak uitvoeren? | Afzonderlijke novice-taakproef zonder coaching; succesdrempel uit de risicoklasse, nul kritieke fouten. |
| Kan een ervaren gebruiker dezelfde taak efficiënt uitvoeren? | Afzonderlijke ervaren groep; betekenisvolle handelingen, herhaalde invoer, contextwissels en wachttijd binnen het taak-/apparaatbudget. |
| Begrijpt de gebruiker de gevolgen vóór een belangrijk besluit? | Terugvertellen van ontvanger, gegevens, bedrag/voorwaarden en herstelbaarheid vóór bevestiging; nul kritieke misverstanden. |
| Kan de gebruiker na fout of onderbreking veilig verder? | Werkelijke onderbrekings-/herstelproef, verse bronlezing en herautorisatie; nul dubbele effecten, stil gegevensverlies of ongeoorloofde heropening. |
| Voelt de ervaring coherent, verzorgd en betrouwbaar? | Onafhankelijke menselijke ontwerpbeoordeling met vastgelegde rubric en concrete waarnemingen; ieder onderdeel voldoende, geen compensatie door gemiddelde cijfers. |

De norm en procedures staan in
`coverage-contract.qualificationPlanning.premiumExperienceGate`. De vereisten
zijn onderdeel van de bestaande Experience-dimensies, waaronder human-quality.
Technische snelheid of een automatische scan kan de menselijke beoordeling
niet vervangen. Redirects houden hun bestaande gemotiveerde profiel; de
werkelijke bestemming krijgt de volledige Premium Experience Gate. Alle
scores en uitspraken blijven onbewezen totdat bevoegde kandidaatgebonden
waarnemingen bestaan.

Magnaat levert scenario's en tegenvoorbeelden. Uitvoerbewijs komt van de
betrokken domeinproeven en onafhankelijke metingen. Voor G3 gelden twee schone,
onafhankelijke evidence-builds op dezelfde kandidaat, met opnieuw ingerichte
testwerelden en zonder de eerste logs als tweede uitvoering te importeren.
Securityonderzoek, menselijke acceptatie, providerkwalificatie en operationele
rollback blijven afzonderlijke vereisten.

## 18. Change Impact als werkbaar wijzigingsdossier

P6 breidt `veranderbereik`, de bestaande aanroepgraaf, routes en bewijs-DAG uit.
Per diff levert het: gewijzigde bron → canonieke domeineigenaren → getroffen
capabilities en schermen → rechten/providercontracten → gebruikersketens →
verplicht bewijs en onafhankelijke reviews.

De P0-projectie leest werkpakketten, scènes, risico en scenariofamilies
rechtstreeks uit SCHERMEIGENAAR.afbouw. Zij verandert de bestaande testring
niet. Onbekende dynamische of gedeelde afhankelijkheden behouden conservatieve
volledige schermscope; dit is PLANNING_IMPACT en geen bewijs van foutloosheid.
De bestaande Experience-bronfingerprint omvat ook de drie handmatige
programmabronnen; gewijzigde acceptatie maakt oud bewijs ongeldig.

Statische imports missen soms dynamische HTTP-, subprocess- en
configuratiekoppelingen. Daarom toont het dossier ook onbekend bereik. Bij
onzekerheid geldt de volledige betrokken testronde. Gerichte testselectie kan
feedback versnellen; zij vervangt nooit de volledige releasekwalificatie.
Valideer de simulator met opzettelijk gezaaide wijzigingen in toestemming,
prijsstatus, gedeelde UI, provideradapter en schema/migratie.

## 19. Eerste uitvoerbare opdrachten

De planning kan lokaal worden gecontroleerd zonder providerverzoeken,
productdata of bewijsregisters te wijzigen:

```sh
node scripts/rtg-next-programma.js
node scripts/rtg-next-programma.js --check
node scripts/rtg-next-programma.js --gate=G1
node --test test/rtg-next-programma.test.js
```

Na een wijziging van de werkpakketbestanden genereert
`node scripts/rtg-next-programma.js --write` uitsluitend het planningwerkboek.
De validator eist exacte dekking van de actuele MAPPEN-ingangen, bestaande
bronpaden, twaalf unieke referenties, geldige afhankelijkheden zonder cycli,
acceptatiescenario's en expliciete ontwerp-/beslisgrenzen. Het resultaat
`CONSISTENT` betekent alleen dat de planning structureel klopt. Productkwaliteit
blijft `NOT_ASSESSED`; releasegoedkeuring is altijd `false`.

De structurele schermdekking is gesloten; algemene P0-sluiting blijft begrensd
door de bestaande besluiten. SCHERMEIGENAAR bevat nog acht open oordelen:
drie productkeuzes (Pulse/Salon, Wereld/Sociaal, Commerce/Mall) en vijf
component-/consolidatieopdrachten. Geen daarvan is met deze metadata afgesloten.
Commerce/Mall raakt G1; het toepasselijke open oordeel blokkeert kwalificatie.
Onafhankelijke P1/P4/P6-bouw kan binnen de bestaande scope wel beginnen.
Menselijke bewijsautoriteit, providertermijnen, gevoelige conceptopslag en
representatieve deelnemers staan als vier afhankelijkheden in het bestaande
coveragecontract. Onbevoegde externe effecten blijven geblokkeerd.

Alle wijzigingen blijven lokaal tot expliciete integratiegoedkeuring.

### 19.1 Echte uitvoering aan een NEXT-poort aanbieden

De bestaande Experience-uitvoerder kan zijn eigen resultaten onmiddellijk
aan de NEXT-beoordelaar doorgeven, op een schone kandidaat:

```sh
node scripts/experience.js --prove --proof=experience-signatures --next-gate=G1
```

`--next-gate=G1`, `G2`, `G3` of `G4` mag uitsluitend eenmaal samen met
`--prove`. De originele uitvoerobjecten blijven in hetzelfde proces; een
opgeslagen of gekopieerd rapport krijgt geen uitvoeringsgezag. De snapshot in
`artifacts/experience/report.json` is uitsluitend ter inzage. Exitcode nul
vereist zowel geslaagde geselecteerde proeven als een geslaagde gevraagde
poort op dezelfde schone kandidaat. Een geslaagde deelproef kan dus terecht
eindigen met een geblokkeerde G1.

De signatureproef controleert de bestaande app-/scherminventaris, geen
werkende gebruikersketen, premiumkwaliteit of menselijke acceptatie. De
voorwaarden voor volledige onafhankelijke builds, providerbewijs en productie
blijven ongewijzigd. Dit commando is geen deploymentopdracht.

## 20. RTG NEXT — aantrekkingskracht en snelle zakelijke waarde

**Uitgewerkt productconcept, 12 november 2026.** Gebaseerd op het voorstel van
de eigenaar en een nieuwe broninspectie van de zes betrokken capabilities.
Dit hoofdstuk specificeert de aanbevolen keuzes; het is geen stilzwijgende
scope-uitbreiding, implementatiebewijs, prijsbesluit of productiegoedkeuring.
De 114 bevroren premiumbeloften blijven intact. De overige 108 capabilities
zijn in deze ronde niet opnieuw afzonderlijk functioneel geaudit.

### 20.1 De productbelofte: zelfstandig goed, samen merkbaar beter

RTG moet niet beginnen met vertellen hoeveel het kan. Het moet een mens laten
ervaren dat iets belangrijks makkelijk lukt. De commerciële belofte wordt:
**één plek om iets te bereiken, met overzicht over wat geregeld is, wat nog
moet en wat een keuze betekent.** Dat geldt voor een etentje én voor een zaak.

Iedere capability krijgt drie bewijsbare waardelagen:

1. **Zelfstandig aantrekkelijk.** De kerntaak is volwaardig zonder onnodige
   appwissels of een verplichte vraag aan Rahul; de eerste waarde vereist geen
   groot netwerk. Bestaande domeineigenaren blijven onderliggend uitvoeren.
   Een taak met andere mensen vraagt uiteraard hun rechtmatige deelname.
2. **Samen aantoonbaar beter.** Een relevante overdracht behoudt context en
   bespaart invoer of controlewerk, zonder rechten of verantwoordelijkheden te
   vermengen. Integratie is een voordeel, geen verplichte omweg.
3. **Veilig om te kiezen.** Prijs, bron, gevolgen, ondersteuning, herstel en
   meenemen van eigen gegevens zijn begrijpelijk. Gebruikers blijven omdat het
   helpt, niet omdat vertrekken moeilijk is gemaakt.

De 114 capabilities blijven bestaan binnen LIFE, WORK, FOUNDATION en
INSTELLINGEN. Er komen geen zes extra hoofdingangen en geen nieuwe zakelijke
catalogus. PersonalOS ordent bestaande ingangen; Heel RTG blijft bereikbaar.
Niet iedere persoonlijke capability krijgt kunstmatig een zakelijke variant:
gezondheid, kinderen, vertrouwelijke relaties en Foundation zijn geen bronnen
voor acquisitie, werkgeversinzage of commerciële persoonsprofilering.

### 20.2 Wat deze audit aan het voorstel verandert

| Onderwerp | Gecontroleerde bron | Gevolg voor het ontwerp |
|---|---|---|
| Salon en Pulse zijn werkelijk verschillend opgeslagen | `server/kern/salon/`, `server/kern/pulse/`, `server/kern/wereld/feed.js` | Twee productervaringen behouden; gemeenschappelijke publicatie-/rechtencontracten consolideren met migratiebewijs, niet alleen dezelfde feedcomponent aanbrengen. |
| Pulse toont niet de volledige vervolgroute | `server/kern/pulse/index.js` levert een cursor; `public/apps/pulse.html` gebruikt die in `laad()` niet | Eindige paginering met een bewuste volgende pagina; een afgekapt resultaat mag niet worden voorgesteld als het einde van alle inhoud. Bronbevinding, nog geen browserreproductie in deze ronde. |
| Salon heeft verschillende reactie-ingangen | `server/routes/member/salon.js` en `server/kern/salon/reacties.js` | Pas-/contactregels en door de maker gekozen reactiegrenzen moeten op beide ingangen gelijk afdwingen. Centrale idempotentie bestaat al; niet opnieuw ontwerpen of als ontbrekend presenteren. |
| Wereld publiceert al via Salon | `scripts/lib/voltooi/wereldlaag.js`, `public/apps/wereld.html`, `public/apps/saloon/saloon.js` | Publiceren, reageren en verwijderen blijven bereikbaar vanuit Wereld; het zijn handelingen van de Salon-eigenaar. Wereld is dus niet uitsluitend een read-only gebruikerservaring. |
| Wereld bewaart meer dan alleen sortering | `server/kern/wereld/opslag.js`, `server/routes/wereld/vermogens.js` | Profielzichtbaarheid, bezoekregistratie, lijsten, modi en feedvoorkeuren bestaan. Geen ervan stil verwijderen; behouden of expliciet naar de passende bestaande eigenaar migreren, met privacybeoordeling. |
| Sociaal kent al voorbereiding en bevestiging | `server/routes/sociaal.js`, `server/kern/socialecommand/`, `LIFE.md` | De sociale begeleider verdiept bestaande regie; geen nieuwe relatiebackend of autonome berichtenagent. |
| Commerce bereidt voor en draagt over | `server/kern/commerce/overdracht.js`, `scripts/lib/voltooi/commerce.js`, `COMMERCE.md` | Een complete transactie-ervaring is een uitbreiding. Commerce wordt niet de nieuwe eigenaar van alle domeinorders; bestaande order-, reserverings-, voorraad- en betaalbronnen blijven leidend. |
| Een overdracht levert nog geen gesloten orderlus | `server/kern/commerce/overdracht.js`, `server/kern/mall/bestellingen.js` | Koppel de terugweg naar het echte domeinobject. Het bestellingenoverzicht leest vijf bronnen, mist onder meer `winkelBestellingen` en zet bij reis/Thuis `betaald:false` vast; bewijs expliciet bevestigd/onbetaald/onbekend in plaats van die waarden gelijk te stellen. |
| De levende etalage is nog een beperkte selectie | `server/routes/member/winkel-bieb.js`, `server/kern/mall/levende-etalage.js` | De selectie van maximaal 24 aanbodregels en 24 bibliotheekapps bewijst geen volledige zoekdekking. Een aanbod zonder voorraadmeting is niet automatisch actueel beschikbaar. |
| Retour heeft nog menselijke ordercontrole nodig | `server/kern/commerce/retour.js`, `server/kern/commerce/retourstand.js` | Verbind retourbedrag en fiscale grondslag met oorspronkelijke bon/order en betaalbewijs; een aangevraagd bedrag is geen bewezen terugbetalingsrecht. |
| Mall omvat ook appontdekking | `public/apps/mall-experience.js`, `scripts/lib/voltooi/mall.js` | Aanbod, diensten, RTG-capabilities en externe apps blijven herkenbaar verschillende soorten resultaten, met hun eigen toegang en voorwaarden. |
| Zakelijke publicatie en planning bestaan al | `server/routes/supplier/salon.js`, `server/routes/supplier/prplus.js` | Verbeter deze ondernemersroute. Een organisatie als afzender op Pulse is nog een afzonderlijke product-/autorisatie-uitbreiding. |
| Zakelijke toegang is geen gratis demo-recht | `server/kern/commercie/capaciteiten.js`, `AUTHORITY.md` §7a | Business Lite/Business en zakelijke keuring blijven gelden. Een openbare fictieve preview verleent geen ondernemersbevoegdheid; werkelijk gebruik vraagt een account. |
| PersonalOS koppelt nog niet de hele catalogus | `server/kern/personalos/catalog.js` | De adapter heeft 16 expliciete bindings. Volledige persoonlijke compositie is afbouwwerk, geen bestaande dekking van alle 114. |

Daarnaast vragen duurzame sociale concepten, mediaherstel, de volledige
melding–besluit–bezwaar–herstelketen en een gevulde Pulse-export-/wisproef
gerichte kwalificatie. De inspectie vond onder meer een in-memory Pulse-concept
en verschillende opslagpaden; dat is geen bewijs dat alle bestaande
privacy-/continuïteitsintegraties ontbreken. Test eerst de complete keten.

Dit is een broninspectie, geen nieuwe gebruikerstest, securityverklaring of
bewijs dat een exploit op productie werkt. Oude documentteksten over anonieme
kooproutes zijn geen uitzondering op het latere accountbesluit in AUTHORITY.

### 20.3 Zes eigen premiumidentiteiten

| Capability en bestaand functie-id | Belofte aan een consument | Relevante waarde voor een ondernemer | Gewenste ervaring |
|---|---|---|---|
| Salon — `tab:salon` | Mijn mensen, verhalen en gemeenschappen op één verzorgde plek. | Een herkenbare organisatie, goede inhoud en vrijwillige klantgemeenschappen; een aanbod of activiteit leidt naar de bevoegde dienst. | Salon-scène: rijk beeld, duidelijke auteur en kring, rustige redactionele hiërarchie. |
| Pulse — `link:pulse` | Snel weten wat er speelt en makkelijk deelnemen aan een gesprek. | Vakgesprekken en actuele informatie volgen; organisatiepublicatie pas na expliciete afzender-/rechtenuitbreiding. | Salon-scène: compacte tekst, onderwerp en gesprek voorop; eigen feed en zoekroute. |
| Wereld — `link:wereldlaag` | Weten wat voor mij relevant is en wat ik ermee kan doen. | Een persoonlijke werkcontext met eigen afspraken en toegestane zakelijke signalen, geen privéprofiel voor de werkgever. | Horizon-scène: Vandaag, Komt eraan en Lopende plannen; bron en reden per kaart. |
| Sociaal — `link:sociaal` | Een ontmoeting of gezamenlijke activiteit werkelijk kunnen voorbereiden. | Een gekozen zakelijke ontmoeting of evenement voorbereiden binnen de werkcontext, zonder sociale dossiers als CRM te misbruiken. | Begeleide Journey met Salon-context; bestaande Command-functies blijven bereikbaar. |
| Mall — `link:mall` | Rustig ontdekken, eerlijk vergelijken en passend kiezen. | Vindbaar aanbod voor bevoegde klanten; zakelijke inkoop met herleidbare verkoper en voorwaarden. | Library-scène: collecties, zoeken, vergelijking en bewaarde keuzes. |
| Commerce — `link:commerce` | Weten wat ik koop, wat bevestigd is en hoe ik verder kan. | Samenhangende verkoop-/inkoopafhandeling met eigen rollen en een werkvoorraad voor uitzonderingen. | Ledger/Ceremony: controle, bevestiging, resultaat en nazorg. Geen tweede etalage. |

De onderstaande verdieping én de volledige functionele lijst uit het voorstel
van de eigenaar vormen de te beoordelen productdelta. Deze compacte tabel
vervangt die lijst niet door zes kleinere producten.

**Salon.** Begin met Volgend en Kringen, een afzonderlijke optionele
ontdekweergave en een zichtbare keuze van publiek vóór publicatie. Albums,
bijschriften, mediabeschrijvingen, drafts, planning, bewerking, historie en
verwijdering horen bij één volledige makersroute. Profielen krijgen
veldprivacy en controle over tags/reacties. Gemeenschappen gebruiken bestaande
Genootschap-rollen, lidmaatschap, regels, uitnodigingen en evenementen waar die
dezelfde verantwoordelijkheid bezitten; Salon presenteert ze zonder de
zelfstandige Genootschap-capability te schrappen. Melden, menselijke
moderatie, beslissing, bezwaar en herstel zijn onderdeel van het product.

**Pulse.** Volgend, Onderwerpen en Bewaard zijn eigen routes, geen filters in
de Salon-composer. Korte berichten, media, antwoorden, citaten en broncontext
blijven snel te lezen. Een thread opent met zijn oorsprong en kan worden
gedempt of verlaten. Pagina-einde betekent bewust verder kunnen of echt klaar
zijn, niet na 40 items onzichtbaar aanbod verliezen. Dagstemming en Mijn week
verdwijnen niet ongemerkt: deze bestaande functies blijven privé en krijgen
een passende rustige plaats; zij voeden geen marketing of rangschikking.

**Wereld.** Geen tweede beginscherm en geen tweede sociale backend. Het is een
bereikbare persoonlijke contextweergave binnen LIFE/WORK. Een kaart zegt
waarom hij er is, uit welke bron hij komt, hoe actueel hij is en welke volgende
stap mogelijk is. Privé en Werk blijven expliciete contexten, met zichtbare
organisatie. Werkkaarten zijn niet automatisch privé zichtbaar of andersom.
Eigen publiceren opent de gedeelde composer en behoudt terugkeer naar Wereld.
De nieuwe Horizon-signatuur vervangt de huidige geplande Salon-signatuur pas
na het vastleggen en toetsen van alle behouden publicatie- en profielroutes.

**Sociaal.** De eerste vraag is bijvoorbeeld: “Wat wilt u samen regelen?”
Daarna verschijnen doel, deelnemers, nog ontbrekende keuzes en voorbereide
stappen. Gebruik bestaande relatie- en aantekeningeigenaren; introduceer geen
eenzijdig sociaal dossier of schaduwprofielen van niet-leden. Beschikbaarheid
betekent alleen wat de gedeelde agenda werkelijk mag tonen, niet het uitlezen
van andermans afspraken. Een conceptuitnodiging kan per ontvanger worden
bekeken. Verandering van ontvangers, rechten of voorwaarden vraagt een nieuwe
controle en zo nodig nieuw akkoord. Handmatige bediening blijft gelijkwaardig.

**Mall.** Begin met een concrete zoekvraag of redactionele collectie, niet met
alles door elkaar. Vergelijken toont ook verschillen in voorwaarden en
onzekerheid. Gesponsorde plaatsing is herkenbaar indien ooit goedgekeurd;
geen verborgen commerciële rangschikking. Een capability heeft “Openen” of
een uitleg over toegang, niet automatisch “Kopen”. Een externe app toont haar
bestaande machtigingsdossier. Een gedeelde wensenlijst geeft geen toestemming
om namens een ander te bestellen. Privévoorkeuren worden geen leveranciersdata.

**Commerce.** De gebruiker krijgt één overzicht van afzonderlijke
verplichtingen, niet de fictie van één transactie. Mandjes, prijs-/voorraad-
hercontrole, voorwaarden, betaling, aflevering, retouren, refunds en geschillen
krijgen een complete begeleide route. De toepasselijke domeinen blijven hun
eigen levenscyclus uitvoeren. Een dienst krijgt geen verzonnen voorraad of
goederenretour. Bij drie verkopers kan A bevestigd zijn, B wachten en C
herstel vragen. Een refundaanvraag is niet een terugbetaling; een lokale
bevestiging is niet het providerbewijs. Een zakelijke koper krijgt waar
toegestaan organisatierol, budget, inkoopreferentie en goedkeuringsroute;
zulke regels horen bij bestaande Authority/Commercial Core, niet in de UI.

**Eén gedeelde grammatica, zes composities.** Mobiel toont de actuele taak en
een vaste terugweg; desktop kan lijst, detail en context naast elkaar tonen.
Toetsenbord en schermlezer volgen dezelfde taakvolgorde. Een hogere dichtheid
voor ervaren gebruikers is een bewuste voorkeur, geen onvoorspelbare
schermverbouwing. Hoogwaardige fotografie hoort bij verhalen en ontdekken;
prijzen, rechten en bevestigingen krijgen rustige functionele presentatie.
Alle vormgeving blijft in `public/ds/`, met de bestaande kleuren, lettertypen,
Heritage-tokens, Edge en zeven schermtypen. Geen nieuw stylesheet per product.

### 20.4 Vernieuwing zonder nieuwe architectuurlagen

Vier zichtbare productverbeteringen maken de samenhang bijzonder. Het zijn
composities van bestaande systemen, geen extra engines of catalogusapps.

1. **Van inhoud naar een gekozen plan.** Een Salon-evenement of Pulse-gesprek
   kan op verzoek aanleiding zijn voor een Plan Dossier. Alleen geselecteerde,
   bevoegde context gaat mee. Een sociale relatie is nooit een verkoopfunnel.
2. **Vóór akkoord zien wat verandert.** De beoogde Consequence-weergave op
   bestaande gevolgcontracten en levensgraaf moet ontvangers, geld,
   verplichtingen, gedeelde gegevens en herstelbaarheid tonen.
   Bevestigd, afgeleid en onbekend blijven afzonderlijk zichtbaar.
3. **Verdergaan waar de taak bleef.** Continuity bewaart taakstand en toegestane
   concepten, niet nieuwe bevoegdheid. Bij hervatten worden bron, prijs,
   ontvanger en toegang opnieuw gecontroleerd. Offline betekent bij gevoelige
   acties “bewaard/wacht op verbinding”, nooit “uitgevoerd”.
4. **Dezelfde zaak, passende blik.** Klant, medewerker, manager en organisatie
   zien bevoegde projecties van dezelfde domeinuitkomst. Geen totaalprofiel en
   geen centrale kopie van gesprekken, betalingen of gezondheidsgegevens.

“Social Context Layer”, “Personal Context View” en “Purchase Consequence View”
zijn daarmee namen voor deze bestaande projecties en presentaties. Ze krijgen
geen eigen opslag-, rechten-, relatie- of uitvoeringsmotor.

**Zo moet het voelen:** iemand kiest in Salon een gezamenlijke avond. Sociaal
zet een voorstel klaar; de gebruiker kiest wie meegaat en welke gegevens
gedeeld mogen worden. Mall helpt een passende mogelijkheid vergelijken.
Commerce begeleidt het bevoegde reserverings-/betaalpad. Wereld toont daarna
alleen de echte status en de eerstvolgende stap. De ondernemer ontvangt
uitsluitend de noodzakelijke aanvraaggegevens in zijn bestaande werkproces,
niet het privégesprek van de vriendengroep. Verandert het tijdstip, dan toont
RTG welke bevestigingen en gevolgen opnieuw aandacht vragen. De gebruiker
ervaart één taak; de zes capabilities behouden elk hun eigen vak.

### 20.5 Voor alle 114: aantrekkelijker wordt een productopdracht

Elk bestaand capabilitywerkpakket krijgt bij de volgende expliciete
scopeverwerking een onderbouwde waardebeschrijving in zijn bestaande velden:
doelgroep, kerntaak, huidige frictie, zelfstandig voordeel, relevante
ketenwinst, behoud van bestaande beloftes en een vergelijkbare taakproef.
Geen tweede productregister of algemene marketingscore.

| Bestaande taakfamilies uit §5 | Consument: reden om terug te komen | Ondernemer/operator: reden om ermee te werken |
|---|---|---|
| Sociaal en contact | Betekenisvol contact, controle over publiek, een activiteit geregeld. | Goede vrijwillige klantrelaties, bevoegde publicatie, opvolging zonder dubbele invoer. |
| Reizen en verblijf | Eén begrijpelijk reisverloop, ook als iets wijzigt. | Aanvraag, voorstel, bevestiging en nazorg traceerbaar; geen beloofde voorraad zonder bron. |
| Eten en uitgaan | Een passend plan en duidelijke reserveringsstatus. | Gastvraag, capaciteit en personeelsopvolging sluiten op elkaar aan. |
| Media, creatie en bibliotheken | Iets maken, vinden, gebruiken en meenemen met behoud van context. | Goedkeuren, samenwerken, rechten en versies binnen de organisatie. |
| Geld en werk | Herleidbare bedragen en begrijpelijke acties, zonder verrassingen. | Minder overtypen en herstelwerk; rollen, audit en brongebonden administratie. |
| Spelen en sport | Goed spelen en veilig samen plezier hebben. | Alleen relevante organisatie-/exploitatieprocessen; geen verkoop van deelnameprofielen. |
| Veiligheid en identiteit | Weten wat beschermd is en zelfstandig toegang kunnen herstellen. | Betrouwbare rolverlening en intrekking; niet meer controle over privélevens. |
| Foundation, leren, gezin, steun en gezondheid | Leeftijdspassende eenvoud, bescherming en daadwerkelijke hulp. | Alleen bevoegde uitvoerders zien hun taak; geen commerciële exploitatie van kwetsbaarheid. |
| Beheer, partners, enterprise en specialistische schermen | Begrijpelijke overdracht en status van een verzoek. | Dagelijkse uitzonderingen oplossen met voldoende dichtheid, rollen en betrouwbare bulkbediening. |

Deze gegroepeerde waardetoets verandert de 17 bestaande catalogusfamilies of
114 unieke functie-id's niet. “Voor consumenten én ondernemers” betekent
passend voor hun echte rollen, niet ieder scherm dubbel bouwen.

### 20.6 Zakelijke markt: snel waarde leveren vóór breed uitrollen

Een ondernemer koopt geen inventaris van 114 apps. Hij wil bijvoorbeeld
aanvragen sneller verwerken, minder administratie of een betere klantervaring.
De aanbevolen entree is daarom: **kies één bedrijfsresultaat; begin klein;
breid uit wanneer de eerste keten aantoonbaar werkt.** Geen verplichte
volledige ERP-migratie, klantendatabase-import of personeelsovergang vooraf.

**Aanbevolen eerste segment: bestaande of toegelaten horeca-/hospitalityzaken
in het RTG-netwerk.** Hier komen consument, medewerker, reservering, aanbod en
nazorg al samen. Dat is een producthypothese op basis van aanwezige code, geen
bewezen marktvraag. RTG's eigen reisbedrijf is de operationele demonstrator.
Een extern reisbureau is niet zonder meer hetzelfde tenantgenre en wordt niet
verkocht alsof dat al is gekwalificeerd. Daarna volgen toegelaten
dienstverleners met één aanvraag/offerte-/afspraakproces; retail volgt zodra
prijs, voorraad, levering en retour integraal bewezen zijn.

Drie zakelijke instaproutes zijn configuraties van bestaande capabilities,
geen nieuwe apps, passen of prijzen:

- **Ontvangen en bedienen:** aanbod → klantvraag/reservering → bevoegd
  medewerker → bevestigde uitkomst → nazorg. Eerste voorstel voor hospitality.
- **Van aanvraag naar opdracht:** aanvraag → dossier/offerte → akkoord →
  planning → uitgevoerde taak → factuur-/betaalbron. Voor een passend bestaand
  dienstverleningsgenre, pas na domeinspecifieke kwalificatie.
- **Van keuze naar levering:** Mall → Commerce → verkoper/orderbron →
  Pay/provider → levering → retour/refund. Voor retail, inclusief deeluitval.

Het eerste eigen resultaat is tastbaar: bij hospitality een eigen dienst en
tijdvak met klantpreview; bij dienstverlening een volledig offerteconcept;
bij retail één artikel/variant met lever- en retourvoorwaarden. Controleer de
voorwaarden en vraag vóór publicatie bevoegd akkoord. Deze voorbereiding is
iets anders dan een al bevestigde reservering, aanvaarde offerte of verkoop.
Hergebruik `server/kern/onderneming/eersteklant.js` en `mallprofiel.js` voor de
bestaande noodzakelijke aanbodstappen, en de partneraanvraag met haar status
en ontbrekende stukken. Geen tweede onboardingchecklist naast die bronnen.

**Een overstap zonder sprong in het diepe.** Begin met voorbeeldgegevens en
toon welke bestaande middelen worden gebruikt. Een import is optioneel en
begint met veldmapping, foutlijst, externe sleutel, duplicaatcontrole en
preview van rechten/gegevens. Pas na akkoord wordt bij de bestaande eigenaar
geschreven. Herhalen mag geen duplicaten maken. Per objecttype is bekend wie
tijdens de overgang de bron is. Geen ongecontroleerde tweerichtingssynchronisatie
en geen “alles ongedaan”-belofte voor reeds verstuurde of betaalde handelingen.
Dit import-/overgangscomfort is te bouwen en te bewijzen, niet al aanwezig voor
elk systeem. Ondersteun alleen werkelijk gekwalificeerde connectoren.

Een klant of leverancier kan zonder betaald abonnement deelnemen **uitsluitend
waar het huidige productprofiel die concrete handeling al toestaat**. Elders
blijft de geldende pasvoorwaarde staan; een vrijstelling vraagt een besluit.
Er ontstaat ook geen automatische anonieme toegang: het bestaande account-
en pasbeleid blijft leidend. Een contextbehoudende accountdeur kan doorgaan na
registratie. Een link of code is geen recht; Authority beslist opnieuw.

### 20.7 Onboarding: snelheid én aantoonbare toelating

Onderstaande tijden zijn **voorgestelde pilotdoelen**, nog geen SLA,
meetresultaat of verkoopclaim. Meet p75 per geselecteerd eenvoudig taaktype,
apparaat en doelgroep; toon ook uitval en spreiding. Complexe migraties,
gereguleerde beroepen en providergoedkeuringen krijgen hun eigen planning.

| Moment | Ontwerpdoel | Wat telt, en wat uitdrukkelijk niet |
|---|---|---|
| Eerste kennismaking | Binnen 3 minuten een relevant bedrijfsresultaat begrijpen en in fictieve preview doorlopen. | Alleen de bestaande publieke voordeur, geïsoleerde demonstratie en echte beschikbaarheidsinformatie. Geen nepklanten of gesimuleerde omzet als resultaat. |
| Eerste voorbereiding | Binnen 15 minuten na bevoegde toegang de eerste eenvoudige eigen taak klaarzetten. | Bijvoorbeeld een complete aanvraag-/reserveringsroute of offerteconcept met juiste rollen. Een concept telt nog niet als eerste zakelijke uitkomst. |
| Eerste werkelijke waarde | Voor een vooraf toegelaten eenvoudige pilotzaak streven naar één werkdag tot de eerste aantoonbaar afgeronde echte kerntaak. | Bijvoorbeeld een bevestigde reservering met correcte personeelsopvolging. Voorbereiding, aanvraag, ontvangst en bevestiging worden apart geteld. Alleen binnen vrijgegeven product-/providerscope. |
| Eerste week | Hetzelfde proces opnieuw zelfstandig voltooien, door de relevante tweede rol indien nodig. | Herhaalwaarde en succesvolle overdracht; niet alleen inloggen, klikken of een collega uitnodigen. |

Leg **twee klokken** vast: totale tijd vanaf interesse en actieve insteltijd
vanaf bevoegde toegang. Wachttijd op RTG, documenten, review of provider wordt
niet uit de eerste klok weggelaten om een snelheidsclaim te halen. Toon wie
aan zet is en welke gegevens echt ontbreken. Vraag niet alles vooraf; vraag
het noodzakelijke vóór de handeling waarvoor het nodig is.

Scheid bovendien “RTG klaar om de taak te verwerken” van wachten op een echte
klant, leverancier of medewerker. Organiseer de pilot rond vrijwillige echte
taakbehoefte; een gunstige onboarding maakt geen klantvraag. Beide wachttijden
blijven zichtbaar in de totale klok. Geen gesimuleerde vraag als activatie.

Een preview is geen vrijgestelde sandbox voor echte transacties. Experimentele
proeven draaien geïsoleerd met fictieve gegevens. Nieuwe livefunctionaliteit
krijgt geen pilot-uitzondering op Deep Green. Business/Lifestyle-toelating
blijft waar vereist menselijk; gereguleerde zaak- én persoonseisen blijven
van kracht. Onboarding zet geen keuring automatisch groen.

### 20.8 Acquisitie, binding en commerciële haalbaarheid

**Begin met een beperkte begeleide pilot**, bijvoorbeeld tien vrijwillige
zaken uit één passend segment. Dat is een voorgestelde wervingsomvang, geen
statistisch bewijs. Geen brede advertentiecampagne voordat het eerste
herhaalbare resultaat, de ondersteuning en de kosten bekend zijn. Deze
opdracht benadert nog geen bedrijven en verstuurt geen uitnodigingen.

De demonstratie toont één klantketen met een normale én mislukte uitkomst.
Daarna kiest de ondernemer een eigen resultaat, krijgt een concreet
overgangsplan en weet wie helpt bij problemen. Zelfservice is geschikt voor
eenvoudige toegelaten zaken; complexe organisaties krijgen begeleide
inrichting en expliciete verantwoordelijkheid. Een omzet- of klantengarantie
hoort hier niet bij. Salon en Mall kunnen alleen bijdragen aan bereik als er
werkelijk relevant publiek en aanbod is.

Los het lege-netwerkprobleem op met waarde die niet afhankelijk is van een
massaal publiek: een eigen reis-/activiteitsdossier, eigen collectie, eigen
klantproces en een vrijwillig gevormde kring. Bestaande klanten/groepen kunnen
zelf kiezen mee te doen; geen automatische adresboekupload, gefingeerde
populariteit, ongevraagde acquisitie of verborgen kruispublicatie.

Binding ontstaat uit bewezen gemak: minder overdrachtsfouten, sneller
terugvinden, betrouwbare nazorg en een proces dat morgen opnieuw werkt.
Uitbreiding wordt voorgesteld wanneer een werkelijk knelpunt daarom vraagt,
niet doordat belangrijke functies opzettelijk ontbreken. Bewaar export,
opzegbaarheid en rechtmatige gegevensterugname. Een bedrijfsopzegging geeft
de werkgever geen recht om het persoonlijke RTG-account over te nemen.

De bestaande pasladder en Commercial Core blijven de prijsbron. Business Lite
en Business zijn geen uitwisselbare namen; een nieuw proefabonnement, korting,
garantie of implementatievergoeding vereist een prijs-/scopebesluit. De
publieke belofte kan pas worden gedaan nadat kosten en marges zijn gemeten:
inrichtingstijd, ondersteuning per actieve zaak, AI/providerkosten, moderatie,
incidenten en migratiewerk. Geen goedkope instap met onverwachte variabele
kosten. De eerste pilot onderzoekt ook betalingsbereidheid en de reden om
te vertrekken; gebruik geen engagementtijd als succesmaat.

### 20.9 Aantrekkelijker dan alternatieven: te bewijzen, niet te verklaren

De actuele marktcheck ondersteunt een nuchtere keuze. Keuze uit feeds en
gemeenschappen is niet op zichzelf uniek: Bluesky beschrijft eigen feeds en
starter packs voor gemeenschappen. [Primaire bron, geraadpleegd 12 november
2026](https://bsky.social/about/blog/06-26-2024-starter-packs).
Shopify biedt onder meer bedrijfsprofielen, klantgebonden catalogi en prijzen,
hoeveelheidsregels en betaaltermijnen. [Shopify B2B](https://www.shopify.com/solutions/b2b).
Odoo documenteert importproeven en externe sleutels voor relaties en
herhaalde imports. [Odoo import/export](https://www.odoo.com/documentation/20.0/applications/essentials/export_import_data.html).
Dit zijn featurebronnen, geen onafhankelijke vergelijking van hun kwaliteit.

**Onze ontwerpconclusie:** RTG onderscheidt zich mogelijk met de complete
overgang van bedoeling naar bevestigde uitkomst, over persoonlijke én
zakelijke contexten, met zichtbare gevolgen en herstel. Geen van deze bronnen
bewijst dat concurrenten dit nergens kunnen of dat RTG al beter is.

Gebruik de bestaande Premium Experience Gate, aangevuld met een
vergelijkingsprotocol in de taakproef, geen extra releasepoort of zesde
ervaringsvraag:

- vergelijk de huidige RTG-route, het nieuwe ontwerp en een daadwerkelijk
  relevant alternatief op dezelfde representatieve taak en dezelfde gegevens;
- toets nieuwe en ervaren gebruikers afzonderlijk; wissel de volgorde om
  leereffect te beperken en noteer ondersteuning en eerdere ervaring;
- meet geslaagde taak, kritieke fouten, actieve tijd, totale wachttijd,
  overtypen, contextwissels, begrip van gevolgen, herstel en ervaren kwaliteit;
- leg vóór de proef de minimale betekenisvolle verbetering vast. Voor een
  administratieve taak kan de hypothese 25% minder actieve afhandeltijd zijn;
  dat is geen norm voor alle 114 en geen reden om veiligheidsstappen te schrappen;
- rapporteer aantallen, spreiding, uitval en onzekerheid. Een snellere taak met
  een kritieke privacyfout faalt. Een gemiddelde verhult geen mislukte risicogroep;
- meet voor bedrijven herhaalde succesvolle kerntaken en behoud na bijvoorbeeld
  30/90 dagen, naast kosten en redenen voor vertrek. Dit is vrijwillig en
  doelgebonden productonderzoek, geen verborgen persoons- of werknemersscore.

“Beter dan de markt” mag pas een specifieke claim worden nadat een passende
vergelijking dat ondersteunt. Voor alle apps is de eerste harde norm: geen
verlies van bestaande taken, alle premiumcriteria gehaald en aantoonbaar
minder frictie op de kerntaak.

### 20.10 Eigenaarschap, toestemming en migratie

| Object of verantwoordelijkheid | Canonieke richting; geen nieuwe parallelle waarheid |
|---|---|
| Publicatie, media, reactie, distributie | Consolideer bestaande Salon/Pulse-contracten onder één aangewezen schrijver per object. Een canonieke identiteit bevat herkomst, maker, zichtbaarheid, versie, levenscyclus en toegestane kanalen. Opslagmigratie pas na concrete schema-/writerkeuze. |
| Volgen, vriendschap, blokkade, kring, groep | Bestaande sociale relatie-/levensband-/Genootschap-eigenaars volgens hun eigen betekenis; vriendschap, volgen en groepslidmaatschap zijn niet hetzelfde object. Gedeelde blokkade moet iedere relevante lezing en handeling begrenzen. |
| Privébericht en bezorgstatus | Bestaande Berichten-/comm-eigenaar; geen inbox in Sociaal of Wereld. |
| Persoonlijke compositie | PersonalOS en bestaande voorkeuren; Wereld projecteert geautoriseerde bronnen. Nieuwe taakplannen verwijzen naar bronnen in plaats van ze te kopiëren. |
| Aanbod, prijs, voorraad, order en reservering | Bestaand bevoegd verkopers-/productdomein. Mall ontsluit, Commerce regisseert en projecteert; Commerce bezit uitsluitend zijn bestaande mand-/overdrachts-/retourdossier waar dat al zijn taak is. |
| Betalingsuitkomst | RTG Pay en bevoegde provider met bestaand betalingsbewijs. Geen tweede saldo, betaalpoort of refundwaarheid. |
| Organisatie, lid, rol en toestemming | Eén account, identiteitskluis, Authority en bestaande tenant-/zaakgrenzen. Een zakelijke presentatie verleent geen extra recht. |

Kruispublicatie vraagt keuze van bestemming en publiek. Een verwijzing neemt
geen ruimer leesrecht mee; een zelfstandig gedeelde kopie is een nieuwe
distributie die afzonderlijk toestemming en verwijder-/intrekkingsregels
vereist. **Aanbevolen begin: brongebonden delen**, niet automatisch kopiëren.
Vooraf is duidelijk wat na intrekking uit RTG verdwijnt en wat niet kan worden
teruggehaald, zoals eerder rechtmatig geëxporteerde inhoud. Citaten, caches,
zoekresultaten, meldingen en aanbevelingen horen bij dezelfde negatieve proef.

Een gedeelde schrijfmotor ontstaat stapsgewijs: oude ids en permalinks
herleidbaar houden; schema's en doelgroepregels vergelijken; compatibele
adapters; een aantoonbaar schrijfpad per object; gecontroleerde backfill;
vergelijking zonder publiekbereik te verruimen; omschakeling en terugval met
controle op inhoud, tellers, media, moderatie en privacy. Geen onbeperkte
dual-write en geen oude database terugzetten waardoor intrekkingen verdwijnen.
Sommige grensverschillen zijn productregels, geen duplicatie die weg mag.

### 20.11 Van concept naar het bestaande bouwprogramma

De drie aanbevolen ontwerpbesluiten zijn inhoudelijk geformuleerd: twee
volwaardige sociale ervaringen; Wereld als persoonlijke samenhang naast
Sociaal als voorbereiding; Mall als ontdekking naast Commerce als
transactieregie. **Technische P0-sluiting wordt hier niet geclaimd.** De
bestaande oordelen blijven open totdat scope, concrete schrijvers, behoud en
migratie expliciet zijn vastgesteld én de vereiste consolidatie daadwerkelijk
is uitgevoerd en bewezen. “Productkeuze vastgesteld” en
“consolidatie uitgevoerd” zijn verschillende gebeurtenissen.

| Volgende stap | Bestaande plek | Bewijs/exit |
|---|---|---|
| Productdelta laten vaststellen | `AFBOUWPROGRAMMA.md`, bestaande `SCHERMEIGENAAR.oordelen`, bestaande toezegklassen | Per zes functie-id's behouden, verdiept, nieuw, extern en afgewezen-met-grens onderscheiden. Geen verdwenen profiel-, stemming-, partner- of publicatiebelofte. |
| Dossiers en taakcontracten uitbreiden | De twee bestaande `*-werkpakketten.json`, Capability-/Intent-/Action-/Proof-contracten | Specifieke taken en negatieve routes, concrete domeineigenaar, afhankelijkheden en expliciet herzien scopebesluit; scope-lock nooit automatisch verversen. |
| UX en schermbinding bijwerken | Bestaande signatures, `SCHERMEIGENAAR.afbouw`, coveragecontract, gegenereerd werkboek | Gewenste Horizon/Journey-composities én behouden bediening; app-/schermnoemer groeit wanneer echte schermen bijkomen. Een signature is geen kwalificatie. |
| Gedeelde oorzaken en adapters bouwen | P1–P6; bestaande sociale, commerce-, broker-, continuity- en DS-eigenaars | Geen tweede catalogus, graaf, rechten- of betaalweg; doelgerichte regressie en geteste migratie/rollback. |
| Referenties kwalificeren, daarna portfolio | Bestaande twaalf referenties, G1 en G2 | Mall-keten blijft referentie; de vijf onderstaande ketens leveren aanvullend bereik, niet een vervangende lijst van twaalf. Alle 114 blijven in scope. |
| Onafhankelijk en operationeel aanvaarden | P7, APPWERKT, EXPERIENCEWERKT, G3/G4 | Alle vijf menselijke kwaliteitsvragen, security/toegankelijkheid/providerbewijs, twee onafhankelijke runs en bevoegde productieacceptatie. |

Minimaal te realiseren en te bewijzen ketens:

1. Salon publiceren → reageren → delen → publiek wijzigen → intrekken.
   Test beide reactie-ingangen, blokkeerrechten en oud geopende projecties.
2. Pulse publiceren → expliciet delen naar Salon → bron wijzigen/verwijderen.
   Test zelfstandige feeds, paginering, citaten, moderatie en publieksgrenzen.
3. Wereldgebeurtenis → Sociaal-plan → menselijke bevestiging → domeinresultaat.
   Test gewijzigde ontvangers, account-/organisatiewissel, intrekking en hervatten.
4. Mall-keuze → Commerce → domeinorder → Pay/provider → levering → retour/refund.
   Test prijs/voorraad, fouten vóór en ná externe acceptatie en werkelijke nazorg.
5. Drie verkopers → twee bevestigingen en één onbekende/mislukte uitkomst →
   gerichte reconciliatie/herstel. Test dat herhalen geen dubbele order maakt,
   dat A/B niet onterecht teruggedraaid lijken en dat C niet vals bevestigd is.

Voeg daaraan voor de gekozen zakelijke pilot één volledige rolketen toe:
account → juiste zaak-/persoonstoegang → eerste voorbereiding → klantactie →
medewerkersopvolging → bevestigde uitkomst → herhaling → export/beëindiging.
Meet wachttijd op toelating, niet alleen de mooie eerste schermen.

### 20.12 Besluiten die nog echt nodig zijn

Aanbevolen keuzes, met hun consequenties; geen van deze keuzes mag als
impliciete livegoedkeuring worden gelezen:

- **Eerste zakelijke doelgroep:** horeca/hospitality in het bestaande netwerk
  (aanbevolen: sluit aan op aanwezige gast-/personeelsketens); dienstverleners
  (meer offerte-/planningverdieping); retail (meer voorraad-/fulfilmentafhankelijkheden).
- **Sociale distributie:** eerst brongebonden, expliciet delen (aanbevolen:
  beter beheersbare intrekking); zelfstandige kopieën per kanaal (meer
  publicatie-, versie-, rechten- en verwijdercomplexiteit).
- **Organisaties op Pulse:** later expliciet kwalificeren (aanbevolen:
  eerste zakelijke publicatie via bestaande leveranciers-Salon); direct
  meenemen (grotere scope voor afzenderrollen, moderatie en bevoegdheden).
- **Onboardingaanbod:** bestaande passen en begeleide proef zonder nieuw
  prijsrecht (aanbevolen); een nieuw commercieel proefaanbod vraagt vooraf
  prijs, gebruiksgrenzen, kostenplafond, beëindiging en verantwoordelijkheid.

Daarnaast moeten bestaande owners de concrete sociale schema-/schrijfmigratie,
de bestemming van Wereld-profiel-/bezoek-/lijstfuncties, moderatie-/bezwaar-
capaciteit, providercontracten en bevoegde menselijke reviewers vaststellen.
Juridische rolverdeling en toepasselijke retour-/privacyregels vragen
deskundige beoordeling per verkoopvorm en markt; deze producttekst is geen
juridische kwalificatie.

**Resultaat van deze conceptfase:** een toetsbare product- en marktstrategie,
een brongebonden lijst verschillen en een uitvoeringsroute in het bestaande
programma. Geen runtime gewijzigd, geen contract groen verklaard, geen scope-
lock omgeschreven en geen release gestart. De lokale documentwijzigingen zijn
te beoordelen vóór het overnemen in de machineleesbare premiumcontracten.
Per nieuw stuk runtime volgen gerichte tests op geïsoleerde
fixtures. Brede generators, providerproeven, staging en productiecommando's
worden uitsluitend binnen hun afzonderlijke bouw- en kwalificatieopdracht
uitgevoerd. De Node-versie voor dat traject volgt `.nvmrc` (26).
