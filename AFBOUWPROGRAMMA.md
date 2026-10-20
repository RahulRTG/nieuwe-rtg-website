# Het afbouwprogramma — wat RTG heeft toegezegd, afbouwen en bewijzen

*Eigenaarsbesluit van 11 oktober 2026. Dit document legt het besluit vast, de
grenzen die eruit volgen, de vier werkstromen die het uitvoeren, en de
inventaris die zegt wat er binnen de scope valt. Het is LEIDEND voor de verdere
ontwikkeling van RTG.*

Let op de naam. `afbouw` is in dit huis al bezet door de releaseketen
(`npm run afbouw:software`, `scripts/afbouwoordeel.js`: *is deze commit
bewezen?*). Dit document gaat over iets anders, namelijk over de SCOPE van wat
er nog gebouwd en bewezen wordt, en heet daarom het afbouwPROGRAMMA. Het woord
`toezegging` is ook bezet (een financiële belofte van het mecenaat in de
geldgraaf, `POLITIEK.md` par. 0), dus in code heet de inventaris
`toezegklassen`.

## 0. Het besluit

> **Het doel: alles wat RTG daadwerkelijk heeft toegezegd volledig ontwikkelen,
> integreren en bewijzen. Niet alles wat ooit in een document is genoemd.**

De eigenaar koos optie D: het volledige ontwikkelprogramma, met meerdere agents
en parallelle werkstromen waar dat technisch verantwoord is, en met een
gecontroleerde uitvoering van A, B en C naast elkaar. Na het vastleggen begint
de uitvoering. Dit is geen nieuwe audit- of documentatiefase; elke ronde levert
een meetbare softwareverbetering op.

## 1. De drie grenzen, definitief

Dit zijn harde architectuur- en productgrenzen. Ze gaan voor elke functie: waar
een functie botst met een grens, vervalt de functie (de regel van `LEVEN.md`
par. 2, hier huisbreed).

1. **Scope.** Alleen toegezegde functionaliteit wordt gebouwd. Wat afgewezen is
   blijft afgewezen, met de grens die het afwees (het `Asset`-, `Moment`- en
   `Career`-object, de `humans`-tabel, een score of ranglijst op een mens, de
   fanladder, `EXECUTE_LOW_RISK`, de overtuigings-API, een token op een publieke
   chain). Wat een besluit of een externe voorwaarde vraagt, blijft geblokkeerd
   tot die voorwaarde AANTOONBAAR vervuld is. `LEVEN.md` en de huisregels uit
   `CLAUDE.md` blijven leidend.
2. **Integratie.** De vier werelden (LivingOS, WorkOS, TravelOS, FoundationOS)
   houden hun eigen domeingrenzen en gegevensverantwoordelijkheid. Integratie
   gebeurt via projecties (de vorm van `kern/levensgraaf/graaf.js`) en via
   platformvermogen (identiteit, bevoegdheid, envelop, uitvoering, bewijs), nooit
   via één gedeeld datamodel. Privacy, toestemming, bevoegdheid en bewijs blijven
   verplicht.
3. **Menselijke regie.** Geen stilzwijgende overdracht van werkgegevens,
   privébudgetten of andere gevoelige informatie. Wat een tweede persoon bereikt
   (uitnodiging, bericht, boeking, betaling) wordt klaargezet en een mens
   bevestigt. Geld verlaat het huis nooit automatisch.

## 2. De bewijsregel, en wat er niet mag

**Geen enkele agent markeert een product als voltooid op basis van alleen eigen
toetsen of documentatie.** Het bewijs moet reproduceerbaar zijn via de bestaande
meetinfrastructuur: `APPWERKT.json` (`scripts/appwerkt.js`, de acht bewijzen uit
`BETROUWBAARHEID.md`) en de ketenproeven (`tafelproef`, `ritproef`,
`toelatingsproef`, `adamproef`, `lusproef`, `momentproef` en wat erbij komt).
Een bewijs dat je weglaat leest als een bewijs dat je haalt; daarom staat wat
niet gemeten is er met de reden (`GEEN_FIXTURE`, `NIET_GETEST`, `openBekend`,
`nietGebouwd`).

Er komt geen schijnfunctionaliteit: geen knop die niets doet, geen mockresultaat
op een echt scherm, geen backend die niet is aangesloten, en geen AI die beweert
iets gedaan te hebben. En er wordt niets herbouwd wat er al is: aansluiten, niet
uitvinden — en een nieuwe naam wordt eerst tegen de code gehouden.

## 3. Wat dit besluit sluit: de testwereld wordt gebouwd

`BETROUWBAARHEID.md` par. 4 en par. 7 stap 4 zeiden dat de gecontroleerde
testwereld *een besluit vraagt*. **Dat besluit is hiermee genomen: bouwen.**
De vorm ligt al vast en verandert niet: een simulatie-adapter vervangt de rail,
nooit de poort (`MAGNAATLAB.md`); elke adapter heeft een grendel die fail-closed
is; geen vlag in de productieweg; en een simulatie mag nooit een handeling laten
slagen die in het echt niet zou slagen. Daarmee gaan bewijs 3, 5 en 7
(voltooibaar, persistent, herstelbaar) open. Werkstroom B voert het uit.

In de inventaris staat dat als correctie in `TOEZEGKLASSEN.json`: de regel van
par. 7 stap 4 is daar `toegezegd`, met dit besluit als reden. Andere open punten
in `BETROUWBAARHEID.md` (bellen/video in een headless browser, de acht bewijzen
per belofte) blijven wat ze waren.

## 4. De vier werkstromen

| werkstroom | wat | werkterrein |
|---|---|---|
| A — besluit en inventaris | dit document, en de klassering van de toezeggingen in het bestaande completion-register | `AFBOUWPROGRAMMA.md`, `TOEZEGKLASSEN.json`, `scripts/lib/toezegklassen.js`, het blok `toezegklassen` in `APPWERKT.json` |
| B — testwereld | de ontbrekende testinfrastructuur uit `BETROUWBAARHEID.md` par. 4, zodat alle acht bewijzen meetbaar worden; eerst een kleine representatieve keten, dan breder; alleen geïsoleerde testdata en veilige simulaties voor externe effecten | adapters naast de echte rails, `scripts/` |
| C — integratieproef | de Rome-keten als echte ketenproef over FoundationOS, WorkOS, TravelOS en LivingOS; elke open schakel met oorzaak, eigenaar en benodigde oplossing; schakels sluiten zodra de voorziening er is | een ketenproef in de vorm van `scripts/tafelproef.js` |
| D — productafbouw | bestaande, onafhankelijke producten afmaken waarvoor geen nieuw architectuurbesluit en geen ontbrekende testvoorziening nodig is; voorrang voor werk dat bestaande gebruikersketens werkelijk sluit | per product |

## 5. Coördinatie

- Eén bestaande architectuur en één completion-register: `APPWERKT.json`. De
  inventaris staat daarin als blok, niet ernaast.
- Geen conflicterende wijzigingen tussen agents: elke werkstroom blijft binnen
  zijn werkterrein en hergenereert geen registers die niet van hem zijn.
- Geen omzeiling van veiligheidsgrenzen, en geen automatische merges zonder de
  vereiste controles. Mergen blijft mensenwerk (`ONDERHOUD.md`).
- Elke ronde rapporteert bewezen voortgang (een meting die bewoog), niet alleen
  ontwikkelactiviteit, en registreert de resterende afhankelijkheden en
  blokkades.
- Een poort bewijst alleen zijn eigen bereik (`LAT.md` regel 17): zeg welke poort
  groen staat en wat niet bevestigd is.

## 6. De inventaris: vier klassen

| klasse | wat het betekent |
|---|---|
| `toegezegd` | het huis heeft het beloofd; het wordt gebouwd, geïntegreerd en bewezen met de acht bewijzen |
| `afgewezen-met-grens` | het komt er niet, en de grens die dat zegt staat erbij |
| `vraagt-besluit` | geblokkeerd tot een besluit van de eigenaar aantoonbaar genomen is |
| `extern` | geblokkeerd tot een voorwaarde buiten de code aantoonbaar vervuld is (juridisch, vergunning, certificering, leverancier, netwerk, sleutel) |

De klassen zijn gesloten; `scripts/lib/toezegklassen.js` weigert elke andere.

**Hoe hij gelezen wordt.** Deterministisch waar het kan. De richtingsdocumenten
dragen per onderdeel al een stand (staat, een stap weg, vraagt een besluit,
jaren weg), in een tabel met een stand-kolom, als vetgedrukte cel in een
tabelrij, of achter een kop. Die worden gelezen met de letterlijke regel als
citaat, plus bestand en regelnummer. De stand bepaalt de klasse: staat, een stap
weg en jaren weg zijn `toegezegd` (de stand blijft erbij als tweede as, want
"jaren weg" is toegezegd maar afhankelijk), vraagt een besluit is
`vraagt-besluit`. Een markering in lopende tekst wordt NIET gelezen, omdat daar
niet af te lezen is over welk onderdeel hij gaat; die worden geteld en niet
geraden.

**Wat een oordeel vraagt, staat in `TOEZEGKLASSEN.json`.** Afgewezen en extern
zijn geen markering maar een oordeel. Dat bestand is met de hand en met opzet
klein, en elk item draagt een citaat dat LETTERLIJK op een regel van zijn
document moet staan. Staat het er niet meer, dan is het item rot: het telt niet
stil mee, het staat in `rot`, en `test/toezegklassen.test.js` zakt. Een
geblokkeerd item zegt welke voorwaarde aantoonbaar vervuld moet zijn. Valt een
item op dezelfde regel als een gelezen markering, dan wint het besluitbestand.

**De stand bij lezing** (levende getallen uit `APPWERKT.json`, bijgehouden door
`npm run getallen`): over <!--getal:toezeg.documenten-->177<!--/getal-->
documenten zijn er <!--getal:toezeg.toegezegd-->898<!--/getal--> onderdelen
`toegezegd`, <!--getal:toezeg.afgewezen-->20<!--/getal-->
`afgewezen-met-grens`, <!--getal:toezeg.besluit-->89<!--/getal-->
`vraagt-besluit` en <!--getal:toezeg.extern-->10<!--/getal--> `extern`.
Daarnaast liggen er <!--getal:toezeg.proza-->220<!--/getal--> markeringen in
lopende tekst die bewust niet zijn gelezen.

**Wat hij niet is.** Geen tweede belofteregister: `BELOFTE.json` zegt of de
BESTANDEN achter een belofte bestaan, deze inventaris in welke KLASSE een
onderdeel valt. En geen bewijs: `toegezegd` met stand "staat" is wat het
document beweert. Bewezen is het pas via de acht bewijzen of een ketenproef.

Draaien: `npm run appwerkt:inventaris` werkt alleen het blok bij, zonder
browser, en laat elk ander veld van `APPWERKT.json` byte voor byte staan;
`npm run appwerkt:inventaris:controle` zakt als het blok achterloopt op de
documenten, een citaat rot is of een klasse buiten de vier valt. Een volle
meting (`npm run appwerkt`) schrijft het blok gewoon mee.

## 7. Wat geblokkeerd is

De volledige lijst staat in `APPWERKT.json` onder
`toezegklassen.geblokkeerd`, per item met citaat, reden en voorwaarde. De
geblokkeerde items uit het besluitbestand:

| onderdeel | klasse | voorwaarde |
|---|---|---|
| doneerknop en incasso (`GIFT.md`) | vraagt-besluit | besluit 2 van GIFT.md genomen en de giftstand open met wallet en vorm |
| verborgen dwangmodus met tweede pincode (`HDI.md` par. 5.7) | vraagt-besluit | threat model, en het besluit om hem heel te bouwen |
| B7, vergeten tegenover collectieve kennis (`VERDER.md`) | vraagt-besluit | de eigenaar kiest een van de twee opties |
| uitbetalen aan een mens, CAR-01 (`MENSNETWERK.md`) | vraagt-besluit | het juridische besluit, na GIFT.md |
| de acht bewijzen per belofte (`BETROUWBAARHEID.md` par. 7 stap 6) | vraagt-besluit | welke ingangen samen een belofte vormen |
| ANBI-status van de RTFoundation (`GIFT.md`) | extern | beschikking van de Belastingdienst |
| juridische toets machtigingstekst (`GIFT.md`) | extern | een jurist |
| eigen betaaltoken buiten het gesloten circuit (`TOKEN.md`) | extern | EMI-vergunning bij DNB of een vergunninghoudende EMI |
| externe security-audit en pentest (`PRODUCTION.md`) | extern | rapport van een externe auditor |
| echte betaalcertificering (`PRODUCTION.md`) | extern | betaalprovider en PCI-scope |
| juridische validatie van het tijdbeleid (`VRIJHEID.md`) | extern | een arbeidsjurist |
| rechtspersoon en statuten DemocratieOS (`POLITIEK.md`) | extern | notaris en jurist; een echte partij pas na groene fase B en C, en niet die van de oprichter |
| OSM-bouwer buiten Nederland (`KAARTEN.md`) | extern | een bouwomgeving die de bron mag ophalen |
| vertrouwde sleutellijst op het toestel (`TOESTEL.md`) | extern | een ondertekeningssleutel bij een mens |
| ondertekende modelbytes uit de bron (`TOESTEL.md`) | extern | toegang tot de oorspronkelijke bron |

Daarnaast draagt de inventaris de onderdelen die een document zelf als "vraagt
een besluit" markeert. Een deel daarvan is inmiddels besloten in een ander
document, en dat is een eerlijke beperking van deze meting: het document dat de
markering draagt, is de bron. Een correctie hoort in dat document of als item in
`TOEZEGKLASSEN.json`, nooit stil in de telling. Een voorbeeld dat al bekend is:
`CLAUDE.md` zei dat het genre voor een extern reisbureau niet bestond, terwijl
`TRAVELCOMMERCE.md` par. 9b het op 10 september 2026 bouwde. Daarom staat het
niet bij de geblokkeerde items.

## 8. De eindtoestand

**<!--getal:toezeg.onderdelen-->114<!--/getal--> onderdelen in `APPWERKT.json`
is de huidige registerbasis, niet het definitieve aantal.** Het register meet per
onderdeel uit `MAPPEN`, en die lijst groeit wanneer er een toegezegd onderdeel
bij komt. Het programma is af wanneer:

1. elk onderdeel in de klasse `toegezegd` gebouwd en geïntegreerd is;
2. elk onderdeel uit `MAPPEN` alle acht bewijzen haalt op BEWEZEN, gemeten door
   de bestaande infrastructuur en niet door een eigen toets;
3. elke relevante keten gesloten is in een ketenproef, of een open schakel
   draagt met oorzaak, eigenaar en voorwaarde;
4. elk `vraagt-besluit`- en `extern`-onderdeel er nog staat met zijn voorwaarde,
   tot die aantoonbaar vervuld is, en elk `afgewezen-met-grens`-onderdeel
   afgewezen blijft.

## 9. Wat deze inventaris (nog) niet kan

- Een onderdeel uit een document is nog niet gekoppeld aan een rij van
  `MAPPEN`. Welke documentonderdelen samen één functie vormen, staat nergens in
  de code; dat verzinnen zou een lijst opleveren die stelliger is dan wat het
  huis weet (dezelfde reden als `BETROUWBAARHEID.md` par. 7 stap 6).
- Markeringen in lopende tekst en standwaarden buiten de vier (gedekt, proven,
  half) worden geteld en niet gelezen.
- "toegezegd" komt uit het document. Of het onderdeel er werkelijk is, zeggen de
  acht bewijzen en `BELOFTE.json`, niet deze inventaris.

## 10. Het integrale V1-concept (18 oktober 2026)

De eigenaar legde op 18 oktober 2026 een integraal bedrijfs- en technologieconcept
voor ("RTG · Het soevereine digitale bedrijf"). Het is een ontwerp, geen nieuw
register: wat eruit vastligt staat hier, de werkwijze staat in `CONSOLIDATIE.md`
(één integratiebranch, geen merges naar main tot V1), en wat het voor later
noemt staat in `TOEZEGKLASSEN.json`. Er komt geen apart document naast dit
programma.

**Einddefinitie van V1.** RTG V1 is niet af wanneer alle code aanwezig is, maar
wanneer een onafhankelijke beoordelaar aan de hand van reproduceerbaar bewijs kan
vaststellen dat de afgesproken taken veilig, bevoegd, betrouwbaar, herstelbaar en
operationeel beheersbaar zijn, en de onderneming de verantwoordelijkheid
daadwerkelijk kan dragen. In de code betekent dat: `npm run productie:status`
geeft `READY` (of, na besluit B2, het afzonderlijke `READY_ZONDER_RAIL`) op één
ondertekende kandidaat, met een geslaagde staging-repetitie en rollbackproef.

**Stopcriteria.** Geen go-live bij ontbrekende kritieke bewijzen, onbeheerde
secrets, een ongeteste rollback, een onduidelijke geldstroom of een onrechtmatige
gegevensverwerking.

**Productgrens.** De 114 onderdelen in `APPWERKT.json` zijn de toetsbare baseline
van V1. Er komen geen nieuwe domeinen bij tot de V1-gaten gesloten zijn.

**Wat het concept voor na V1 noemt.** Het Zaakdoos-netwerk met nodeklassen en federatie (fase B), multi-regio (fase C) en het ecosysteem voor derden (fase D) zijn geen V1-werk.
Ze staan als `vraagt-besluit` in `TOEZEGKLASSEN.json` en blijven dicht tot de
eigenaar ze na een bewezen V1 openzet.

**Open besluiten voor V1** (de bron per punt is `RELEASEKANDIDAAT.md` par. 1):
V1 met of zonder geld (B2/B3), SMS of bewust uit (B5), de image-scanner (B6), het
IBAN van de RTFoundation (B7), het e-mailadres van de eigenaar, de oude
kaartcodes (cadeaukaart 24 bits, opwaardeerkaart 96 bits), PR #661, en de scope
van de overlappende productwerk-PR's #672 tot en met #677.

## 11. Premium Ready (eigenaarsbesluit 20 oktober 2026)

De afbouw richt zich op professioneel bruikbare taken, niet op een grotere
catalogus. De nulmeting op `48623e2020015aa6cfaa93b4b41f365c6decc5aa`
beoordeelt de integratiewerkstand als **ORANJE, niet vrijgaveklaar**. Binnen de
onderzochte scenario's hebben 9 van 114 onderdelen acht bewijzen; 12 hebben
geldig gekoppeld bevoegdheidsbewijs. Dit is een historische meting en geen
automatische status van latere commits. De auditbestanden blijven behouden.

Zes verplichte poorten, in afhankelijkheidsvolgorde:

| poort | sluitvoorwaarde | bestaande bewijsbron / voorziening |
|---|---|---|
| Architectuur | nul verboden koppelingen, geen nieuwe schendingen, aantoonbare reductie van geprioriteerde schuld | architectuurgraaf, normcontrole, CONSOLIDATIE |
| Functionaliteit | alle onderdelen met realistische complete taakscenario's en acht geldige bewijzen | APPWERKT, voltooiproef, AFBOUWPROGRAMMA |
| Veiligheid | object-, rol-, organisatie- en accountisolatie, privacy-overdracht, geld onder retries/crashes/meerdere workers bewezen | IDOR, ROLPROEF, BEVOEGD, financiële contract- en herstelproeven |
| Premium UX | inhoudelijke taakdiepte, Heritage, mobiel/PWA, toegankelijkheid en menselijke taakbeoordeling | bestaande ontwerpcontroles, browser/a11y-proeven en gebruikersbewijs |
| Betrouwbaarheid | herhaalbare fixtures en tijdgrenzen, volledige groene regressie op dezelfde kandidaat | bestaande testrunner, CI en herstelproeven |
| Productiekwalificatie | exacte kandidaat, staging/rollback, operationele repetitie en eigenaar-go/no-go | bestaande releaseketen en productie:status |

**Gebouwd, bewezen en vrijgaveklaar zijn verschillende uitspraken.** Aanwezige
code is geen bewijs. Een scenario met een synthetische provider is geen bewijs
voor de echte externe rail. Acht appbewijzen vervangen geen premium UX-review
of platformkwalificatie. Niet-toepasselijk vereist een gemotiveerde scope;
ontbrekend bewijs is nooit niet-toepasselijk of geslaagd.

Uitvoering: eerst meetfouten en niet-determinisme, daarna kritieke
veiligheidsgrenzen, architectuurschuld, appkwaliteit, wereldketens en volledige
kwalificatie. Onafhankelijke werkzaamheden mogen naast elkaar; onveilige
financiële of autorisatieafhankelijkheden worden niet doorgeschoven.

De permanente kwaliteitsweergave wordt een projectie op de bestaande
platformregister-/bewijsvoorzieningen. APPWERKT blijft de appbewijsbron;
er komt geen tweede appinventaris of handmatig groen register. Toon de
onderzochte commit, versheid, scope, geslaagd/gefaald/ontbrekend/niet-toepasselijk
en afzonderlijk de lanceerbare kern en het volledige platform. Premium UX en
operationele proeven zonder bron staan expliciet als ontbrekend bewijs.

### Eerste herstelronde — in uitvoering

- Menselijke foutbeoordeling: verklaarde configuratie-503 onderscheiden van
  kale serveruitval; netwerkuitval niet verbergen achter ontbrekende weigeringen.
- Vluchten: zichtbare gegevensdialoog aan de geweigerde handeling koppelen;
  geen algemene uitzondering voor 428.
- Vonk: identiteiten in de fixture deterministisch kiezen en bewijzen dat
  blokkeren werkelijk slaagt vóór het crashherstel wordt beoordeeld.
- Verblijf: bestaande klokvoorziening en bedrijfstijdzone gebruiken, met
  middernacht- en zomertijdtegenproeven.

Deze ronde is niet de volledige determinismekwalificatie. Testuitslagen worden
pas geldig verklaard met hun exacte codeversie en uitvoer; de historische
9/114 wordt niet handmatig verhoogd. Geen normverlaging, merge naar main of
productie-uitrol volgt automatisch uit dit besluit.

### Gemeten voortgang en resterende grenzen

De lokale volledige Node-ronde op
`498c5f8fdc29de7c8af80c170f2da330e3a58402` is voltooid: **19.946 tests,
19.810 geslaagd, 85 mislukt, 51 overgeslagen**, geen annuleringen.
`SUITE.json` bewaart de exacte commit en uitslag. Dit is geen CI-equivalente
kwalificatie: de omgeving gebruikte Node 24.18 op Darwin arm64 terwijl
`.nvmrc` Node 26 voorschrijft; benodigde Rust-, PostgreSQL-, Redis- en
loopbackvoorzieningen waren niet volledig aanwezig. Geen skip telt als bewijs.

De vervolgreparatie maakt bevoegdheidsbewijs methodegebonden: een GET kan
geen POST op hetzelfde pad bewijzen. Iedere bekende niet-GET-methode vraagt
eigen IDOR- en rolbewijs. Methoden die in beide bronregisters ontbreken blijven
een expliciete inventarisatiegrens. De suiteplanner laat zijn volledige
JSON-uitvoer uitlezen voordat hij afsluit; afgebroken uitvoer op 64 KiB was
een gereproduceerde meetmotorfout. De gecombineerde gerichte contractproeven
slagen lokaal (27 tests, geen skips); een andere agent heeft deze diff beoordeeld.

De padaliasfout in de versheidsmeter is vervolgens hersteld: dezelfde fysieke
wortel wordt consequent herkend, ontbrekende paden blijven invoer, en een
onoplosbaar pad of een externe/directorysymlink kan geen vals actueel bewijs
geven. De gecombineerde onafhankelijke herhaling van meter-, planner- en
versheidsproeven slaagt lokaal: **63 tests, geen fouten of skips**. Dit is
gericht herstelbewijs op de werkstand na bovenstaande volledige ronde,
geen nieuwe volledige suiteuitslag.

Vervolgvolgorde binnen deze fase: de voorgeschreven testomgeving reproduceren;
overige failures inhoudelijk
classificeren en reproduceren; daarna dezelfde volledige kandidaat herhalen.
Vervallen registers worden niet blind herstempeld. De 102 historische
bevoegdheidsbewijsgaten, premium UX, complete ketens en operationele
kwalificatie zijn hiermee nog niet gesloten. Productievrijgave blijft apart.

### Vervolgmeting met voorgeschreven runtime

De geïsoleerde lokale testomgeving gebruikt nu Node 26.12.0, de bestaande
gepinde Rust 1.97.1-toolchain, PostgreSQL 16.14 en Redis 7.4.11. Downloads zijn
tegen de officiële hashes gecontroleerd; de projectdependencies en de
systeeminstallatie zijn niet gewijzigd. De native motor is uit de bestaande
bron gebouwd. PostgreSQL en Redis draaien uitsluitend op lokale testpoorten,
met een afzonderlijke wegwerpdatabase per PostgreSQL-testbestand.

Op de schone kopie van `4961acbcc9618f0385b8c2230875d0333b882736`:

- PostgreSQL: alle 46 bestanden, **119 tests geslaagd, nul skips**; bewijs via
  de bestaande `scripts/pgtoetsen.js` en zijn `pg-bewijs.json`.
- Native geld-, Capability Graph-, Sentinel- en Redis-kanarieproeven:
  **28 tests geslaagd, nul skips**.
- De bestaande 63 meterregressies slagen ook onder Node 26.

De volgende gerichte reparaties zijn op de integratiewerkstand uitgevoerd:

- De V8-meter vergelijkt fysieke bronpaden; een padalias mag geen echte
  takken laten verdwijnen. Een lege takkenmeting levert nooit 100% op.
  Bestaande drempels blijven intact; referentie-uitkomsten 5/6 en 15/18 zijn
  opnieuw bewezen.
- Sport-, Media- en Vluchten-tests volgen de bestaande absolute API-paden.
  Echte helpers bewijzen methode, actor, body, gegevenspoort en hervatten;
  prefix- en autorisatiemutaties worden afgewezen. Dit is geen browserbewijs.
- Consent-bronverwijzingen volgen de bestaande modulesplitsing. Arrival
  vermeldt zichtbaar dat statusdeling én opgegeven reserveringswensen nog
  buiten centrale intrekking vallen. Stop delen is geen passintrekking;
  ontbrekende centrale consentintegratie blijft open werk.
- Het registervoorstel behoudt bestandsvalidatie, draft-PR en menselijke
  mergecontrole, maar werkt ook met lege arrays op de lokale Bash. De
  lowercase-tegenproef botst niet meer met een uppercase-bestand op macOS.

Deze reparaties slagen gezamenlijk in **93 Node 26-tests, nul skips**.
De consent-/Arrival-serverregressie slaagt met 20 tests. Een afzonderlijke
routeproef slaagt met 37 tests en observeert alle 14 eerder ontbrekende
routeverwijzingen. Het oude DEKKING-register was achterhaald; het wordt niet
vervangen door een als volledig gepresenteerde deelmeting. De routeproef bevat
nu ook succesvolle menselijke terugbetalingsafhandeling, 401/403, gelijktijdige
herhaling en herstart zonder dubbele financiële verwerking. Die laatste proef
gebruikt één server en synthetische JSON-opslag, en bewijst dus niet de nog
vereiste volledige Directpay-providerketen over meerdere workers.

Open omgevingsgrens: de bestaande auditankerproeven vereisen 127.0.0.2; die
loopbackalias ontbreekt lokaal en toevoegen vereist macOS-beheerdersrechten.
Er is geen alternatief in productcode gezet en geen proef overgeslagen om dit
groen te maken. De complete Node-suite is nog niet opnieuw op deze nieuwste
werkstand gekwalificeerd; de oudere rode SUITE.json blijft zichtbaar. De
overige registerafwijkingen, appbewijzen, UX en releasepoorten blijven open.

### Deep Green — uitvoering vanaf 20 oktober 2026

Het eigenaarsbesluit is uitvoeren: eerst de volledige herhaalmeting, daarna
gedeelde oorzaken in risicovolgorde herstellen. De bestaande registers blijven
leidend; er komt geen tweede afbouwadministratie. Veiligheid en transacties,
appketens, meetbetrouwbaarheid/architectuur en premium UX kunnen onafhankelijk
voortgaan. Publieke uitrol en merges vallen niet onder deze uitvoering.

De volledige Node 26-ronde draait op de afzonderlijke, vastgelegde werkboom
`c10c930cb801cd84b7e13ce6d7c0382ffdf509d3`, met de bestaande runner en
geïsoleerde PostgreSQL-databases. Reparaties tijdens die ronde veranderen zijn
meetbasis niet. Een lopende ronde is geen groene uitslag.

De eerste onafhankelijke controle vond twee fouten in de gezinsbevoegdheidsmeter:
een serverfout kon als afscherming tellen en één gescheiden paar kon een
onbeslist of anoniem toegankelijk paar laten meeliften. De meter eist nu voor
ieder paar een succesvolle eigenaar en expliciete 401/403 voor beide andere
actoren; redirects worden niet gevolgd. Anonieme toegang is een defectkandidaat
voor inhoudelijke beoordeling, niet automatisch bewijs van een privacylek.
Een verhullende 404 zonder eigen contract blijft onbewezen. B's toegang tot
zijn eigen object wordt nog niet afzonderlijk gecontroleerd; die beperking
staat expliciet in de bron en het register.

De browserhermeting op de gewijzigde werkstand levert 8 BEWEZEN en 106
NIET_GETEST op. Herhaling op een schone kopie van commit `3452188104` geeft
dezelfde telling, nu met `boomVuil: false`. Dit is deelbewijs, geen
releasekwalificatie. Vier eerdere gezinsbewijzen vallen terecht terug;
IDOR.json en ROLPROEF.json zijn bovendien vervallen en moeten op een schone
codeversie opnieuw worden gemeten. De auditwaarde 12/114, het oude opgeslagen
register (15/114) en deze werkstandmeting zijn verschillende meetbronnen.
APPWERKT wordt niet met deze telling handmatig bijgewerkt.

De volledige ronde ontdekte ook een regressie van de vorige herstelset:
de lokale CI-ontleder herkende Bash-arrayaanvulling (`+=`) niet. De bestaande
toewijzingsherkenning ondersteunt die syntax nu; volgende testopdrachten en
onbekende opdrachten blijven afzonderlijk zichtbaar. De gerichte CI-/Bash-proef
slaagt met 23 tests. De aangescherpte bevoegdheidsproef slaagt met 8 tests.

De 17 eerdere registerfailures betreffen 15 bronfamilies. Herdruk is niet
automatisch herstel: EDGEKAART mist indirecte fetchpaden en DOORBELASTING toont
een extra niet-volgbare geldvorm. Eerst de inhoudelijke oorzaak beoordelen,
dan alleen betrokken afdrukken hernieuwen. Websitebeelden vragen echte nieuwe
browserbeelden. Documentgetallen volgen als laatste hun bronregisters.

Volgende afhankelijkheden: de volledige suite afmaken en classificeren,
Directpay met twee echte processen en crashvensters bewijzen, de rol- en
objectproeven vernieuwen, daarna APPWERKT en kritieke ketens opnieuw meten.
Premium UX, architectuurreductie en operationele kwalificatie blijven
afzonderlijke vereisten. Geen totaalscore of groene platformstatus zonder
volledige, reproduceerbare bewijzen op de releasekandidaat.

#### Uitkomst van de volledige herhaalmeting

De ronde op `c10c930cb8` is afgerond: **20.036 tests, 19.987 geslaagd,
43 mislukt, 6 overgeslagen, 0 geannuleerd**. De 46 PostgreSQL-bestanden
slagen volledig. SUITE.json bewaart deze rode uitslag met schone bronstempel.
De eerdere Node 24-ronde had 85 failures en 51 skips; verschillen in omgeving
en testset maken dit geen bewijs dat precies 42 productfouten zijn opgelost.
Van de 43 failures betreffen 13 de ontbrekende loopbackalias, twee de inmiddels
herstelde CI-ontleder en drie vaste wachttijden in browsertests. De overige
bevindingen omvatten registeractualiteit, broncitaten en schermeigenaarschap;
hun inhoudelijke beoordeling blijft nodig.

De bestaande rolproef is op schone code `3452188104` opnieuw uitgevoerd:
4.514 routes, 9.369 pogingen, geen verkeerde rol binnengelaten en geen gevonden
gegevenslek in de weigeringen. Mechanismen die deze proef niet kan toetsen
(zoals objecteigenaarschap en lichaamssleutels) blijven expliciet buiten het
bewijs. De objectproef heeft afzonderlijk 2.630 ledenroutes, 1.273 zaakroutes,
84 werkplekroutes en 130 werkruimteroutes gemeten, met onbereikbare routes
zichtbaar in IDOR.json.

Eén walletbevinding uit die objectproef is met twee echte HTTP-testaccounts
onderzocht. De 409 bij de tegenpoging was een gewijzigde body onder dezelfde
herhaalsleutel. Met een verse sleutel werken verzonnen objectvelden eveneens:
B koopt voor zijn eigen wallet, A blijft ongewijzigd, en een echte
inwisselhandeling op A's munt-id geeft B 404. De bestaande idempotentiepoort
weigert ook dezelfde betaling voor een andere zaak. Dit specifieke oordeel
is onafhankelijk gecontroleerd en in de bestaande NAGEKEKEN-lijst gekoppeld
aan `test/zorgwallet.test.js`. De oorspronkelijke verdachte meting blijft
bewaard; zij wordt niet handmatig groen geschreven.

De Edge-scanner herkent nu ook eenduidige directe fetch-helpers. De vijf
nieuwe tegenproeven bewaken onder meer shadowing, generatorbindings,
scriptgrenzen en inerte scriptblokken. Het is een begrensde statische
meting, geen algemene callgraph of bewijs van succesvolle netwerkuitvoering.

De Directpay-proef met twee processen is nog een niet-gekwalificeerde
testuitwerking: de aanvraag voor lokale uitvoering is geannuleerd, zodat
geen PG-run heeft plaatsgevonden. Zij telt niet als gesloten financieel
bewijs en is nog niet aangesloten op de bestaande PG-testlijst. Geen
productdefect of geslaagde crashproef claimen op grond van alleen deze code.
