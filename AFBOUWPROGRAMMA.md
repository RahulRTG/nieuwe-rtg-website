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
`npm run getallen`): over <!--getal:toezeg.documenten-->179<!--/getal-->
documenten zijn er <!--getal:toezeg.toegezegd-->898<!--/getal--> onderdelen
`toegezegd`, <!--getal:toezeg.afgewezen-->20<!--/getal-->
`afgewezen-met-grens`, <!--getal:toezeg.besluit-->89<!--/getal-->
`vraagt-besluit` en <!--getal:toezeg.extern-->10<!--/getal--> `extern`.
Daarnaast liggen er <!--getal:toezeg.proza-->221<!--/getal--> markeringen in
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
Na herijking van uitsluitend EDGEKAART.json op schone code `0c6b2fd787`
slagen alle 12 Edge-kaarttests. De vijf tegenproeven zijn daarin inbegrepen.

De Directpay-proef met twee processen is nog een niet-gekwalificeerde
testuitwerking: de aanvraag voor lokale uitvoering is geannuleerd, zodat
geen PG-run heeft plaatsgevonden. Zij telt niet als gesloten financieel
bewijs en is nog niet aangesloten op de bestaande PG-testlijst. Geen
productdefect of geslaagde crashproef claimen op grond van alleen deze code.
De uitwerking is bewaard buiten de reguliere testselectie in het lokale
uitvoerbewijs (`output/premium-ready-20261020/drafts/test/`), zodat een
onuitgevoerde nieuwe PG-proef geen ongemarkeerde suite-afhankelijkheid wordt.

Vier browsertestbestanden hebben een nog ongecommitteerde vervanging van
vaste wachttijden door observeerbare toestanden. Hun browserkwalificatie is
niet uitgevoerd: de lokale sandboxrun strandde op EPERM vóór serverstart
en de aanvraag om buiten de sandbox te draaien is geannuleerd. Syntax en
bronreview zijn geen vervanging voor deze ontbrekende browserproef. De
betrokken klokfailures blijven daarom open.

### Deep Green — ronde 2: herstel naar kwalificatie (20 oktober 2026)

Eigenaarsopdracht: werk door op `d14f1ae752cdb7d175569be41ff208e17e988c2d`,
zonder merge of productie-uitrol. Volledige kwalificatie vereist één vastgelegde
kandidaat, twee volledige suite-runs en afzonderlijke browser-, financiële,
autorisatie- en ketenbewijzen. Een hersteld register is geen hersteld product.

De nulmeting gebruikt een schone, detached kopie van die commit, Node 26.12.0,
PostgreSQL 16.14 op localhost:55439, Redis 7.4.11 op localhost:56389 en de
bestaande gepinde browser. Er ontstaat geen nieuwe ontwikkeltak. De eerste
sandboxstart is afgebroken omdat localhost-verzoeken op EPERM strandden;
die log blijft infrastructuurbewijs en is geen productnulmeting. De vervangende
run heeft localhost-toegang en eist PostgreSQL en Redis expliciet.

Open punten blijven met verantwoordelijkheid en vervolg zichtbaar:

| Punt | Eigenaar | Vervolg en sluitbewijs |
|---|---|---|
| Loopback 127.0.0.2 ontbreekt | Lokale machinebeheerder | Alias met beheerdersrechten activeren; dertien ankerproeven ongewijzigd uitvoeren. De toegestane `sudo -n`-poging vereist een wachtwoord. |
| Vier browserwijzigingen | Browserwerkstroom en onafhankelijke reviewer | Echte browsers plus negatieve scenario's; pas daarna accepteren. |
| Directpay met twee processen | Financiële bewijswerkstroom | Geïsoleerde PostgreSQL, synthetische rail, crash/retry/conflict en opslagcontrole. Geen bewijs voor echte provideruitvoering claimen. |
| Zorgschermen delen betaal- en annuleerbediening | Integrator en architectuurreviewer | Bronvergelijking van app-main-13 en foundation/zorg-hulp; een inhoudelijk eigenaarsbesluit of consolidatie, geen verhoging van de ratel. |
| Financiële herkomst | Integrator | De verse meting telt 181 niet-volgbare vormen tegenover 180 in het oude register; 39 blijven volgbaar. Verschil onderzoeken, niet als verbetering rapporteren. |
| APPWERKT en autorisatie | Integrator | Alle apps hermeten; verlopen of onbeslist bewijs blijft ongeldig. Historische 9/114 is geen actuele uitkomst. |

De statische architectuurmeting op de rondebasis telt 63 opwaartse koppelingen,
105 primitief-naar-domeinkoppelingen en 31 wederkerige paren. De eerste twee
zijn gelijk aan de aangeleverde nulmeting: nog geen aantoonbare schuldreductie.
Nul onverklaarde randen betekent alleen dat de randen geclassificeerd zijn,
niet dat alle koppelingen gewenst zijn.

Ronde-2-tussenstand (geen vrijgavebewijs): de normale Node-batches op de
rondebasis tellen 19.879 geslaagd, 41 gefaald en 6 overgeslagen. PostgreSQL
is daarin niet meegeteld: Redis bleek niet beschikbaar na een door de sandbox
geblokkeerde herstart. De infrastructuurcontrole vóór die run was dus
onvoldoende. De PostgreSQL-campagne wordt afzonderlijk herhaald met werkende
Redis; deze nulmeting mag niet als complete groene suite worden opgevoerd.
Coturn is tijdens deze diagnostische ronde lokaal geïnstalleerd. Een volgende
integrale kwalificatie moet daarom opnieuw in de vastgelegde omgeving draaien.

Aanvullende proeven sluiten eerdere uitvoeringsblokkades gedeeltelijk:

- Vier browserbestanden: zes echte browsertests geslaagd, nul skips.
- Coturn: dertien tests geslaagd, nul skips; de zes eerdere skips zijn daar
  uitgevoerd, niet achteraf uit de nulmeting verwijderd.
- Directpay: vier subproeven plus hoofdtest geslaagd, nul skips, met twee echte
  processen en synthetische betalingen. De proef is opgenomen in de bestaande
  PG-testlijst. Dit bewijst retries, conflicten en lokale opslaginvarianten bij
  de geteste procescrashes; geen externe charge-count, SQL-crash midden in een
  commit of isolatie tussen verschillende organisaties.
- Care-overlap: onafhankelijk beoordeeld als gedeeltelijke presentatie;
  de ledenapp bezit het gedeelde afspraakbeheer. Foundation behoudt zijn
  gezinsgezondheid en hulpwijzer. Elf eigenaarschapstests slagen zonder
  normwijziging.
- De inkomende paginaovergang van Berichten/Camera veroorzaakte bij expliciete
  annulering tien onbehandelde fouten in tien bezoeken. De gedeelde afhandeling
  plus vroeg laden op deze twee routes levert nul fouten in tien tegenproeven.
  Onverwachte fouten blijven zichtbaar.
- De bevoegdheidsmeter vereist nu ook een geslaagde eigen aanvraag van actor B.
  Oude groene gezinsrijen zonder die controle gelden niet als nieuw bewijs.

De schone APPWERKT-nulmeting op d14f1ae752 geeft nul volledig bewezen apps:
verlopen ketenbewijzen blijven ongeldig en twee browserdefecten zijn gevonden.
Dat is geen bewijs dat alle apps stuk zijn. Het is wel een kwalificatieblokkade.
Herstelproeven op de gewijzigde werkboom vervangen de vereiste volledige
hermeting op een exacte kandidaatcommit niet.

Herhaling en aangescherpte bewijsgrenzen:

- De PostgreSQL-herhaling op d14f1ae752 met herstelde Redis slaagt:
  46 bestanden, 119 tests, nul failures/skips. De nieuwe Directpay-proef
  staat afzonderlijk en is nog niet in deze oude toetslijst inbegrepen.
- Tussencommit 350743bfae bevat de geteste eerste reparaties. Dit is geen
  releasecommit. Op die bron sluiten de 110 aanwezige voltooiingsscenario's;
  de afgeleide menselijkheid is 107 gesloten en 3 niet beproefd.
- LIEGRONDE op dezelfde bron: 94 bewezen, 20 niet getest. Vier daarvan tonen
  fouten bij lege antwoorden (Magnaat, OV-routes, Rendez-vous, Verblijven),
  drie zitten achter een gesloten toegangsscherm en dertien hebben geen eigen
  adres in deze browsermeter. Eigenaar Experience/Test: echte bereikbare
  scenario's en foutafhandeling toevoegen, vervolgens opnieuw meten.
- DEKKING is opnieuw getoetst aan de actuele router: 5545 routes aangeraakt.
  Dit bewijst bereik van de route, niet succesvolle of bevoegde uitvoering.
- Zes aanvullende klokwachttests: 39 serverproeven geslaagd; de klokratel
  blijft ongewijzigd. Tijdafhankelijke Flits-semantiek blijft apart beproefd.

De onafhankelijke veiligheidsreview vond meetfouten, geen bewezen nieuwe
productdoorbraken. ROLPROEF telde onbesliste antwoorden en onvolledige
rolpogingen als gesloten; een afnemer kon oude of onvolledige bewijzen groen
houden. ROLRONDE miste positieve sessiecontroles van de vreemde rollen.
IDOR verstuurde ook niet-POST-routes als POST en mist bij veel routes positieve
eigenaar- en B-eigen-objectcontroles. Daarom geldt 1124 geobserveerde weigeringen
nadrukkelijk niet als 1124 bewezen objectgrenzen.

Eigenaar Security/Test: meters en afnemers eerst fail-closed corrigeren,
HTTP-methoden en ruwe controles behouden, fouten/lekken niet wegwerpen,
en vervolgens hermeten op een vaste bron. Ontbrekende positieve fixtures
blijven ontbrekend bewijs. Geen norm verlagen om de verwachte daling van
gekwalificeerde dekking te compenseren.


#### Ronde 2 — tweede meetstand op 21 oktober 2026

Broncommit: `87234eeb2871c725c572c23eab21b9369a5d1e65`, Node 26.12.0.
De volledige diagnostische Node-run telt 19.970 tests: 19.954 geslaagd,
16 gefaald, nul skips en nul annuleringen. Alle 47 PostgreSQL-testbestanden
slagen afzonderlijk binnen dezelfde campagne, inclusief de synthetische
Directpay-proef met twee processen. Deze run is geen schone eindkwalificatie:
de afgeleide bewijsregisters werden tijdens de campagne opnieuw gemeten.

Dertien failures horen bij de ontbrekende loopbackalias. De overige drie zijn
achterhaalde afgeleide verwijzingen na onze bronwijzigingen: BUNDELS-regeltelling,
STILLEZING-catchlocatie en de offline shell-inhoudsafdruk. Bestaande generators
herstellen deze; achttien betrokken tests slagen, zonder normverlaging.
Dat sluit die drie gerichte regressies, niet de nog te herhalen volledige suite.

Verse autorisatiemeting en onafhankelijke tegenlezing:

- ROLPROEF: 4.514 routes beproefd, vijf onbeslist; 92 niet te kruisen en
  836 zonder geclassificeerde rol blijven afzonderlijke dekkingsgrenzen.
- De vijf onbeslisten zijn Leerhuis doen/lezen/openen en de twee eigen-domeinroutes.
  Elf kruisverzoeken geven 503 met 22 levende voor/na-sessiecontroles.
  Uitgeschakelde functies zijn een bronverklaring, geen bewezen antwoordreden:
  de ruwe rolproef bewaart die antwoordtekst niet.
- ROLRONDE: 577 bewezen tegenover norm 1.444; 4.583 onbekende antwoorden en
  zes expliciet gedeelde routes. De norm blijft ongewijzigd rood.
- BEVOEGD: acht BEWEZEN en 106 NIET_GETEST. De acht zijn beperkte
  gezinslaadscenario's: vijftien kruisparen over acht unieke routes, met
  A/B-eigen 200 en vreemde/anonieme 401 of 403. Geen volledige appautorisatie,
  foutinhoudprivacy of afwezigheid van servermutaties bewezen. De registertests
  slagen alle veertien. Oude ruimere claims worden niet overgenomen.
- LIEGRONDE: 98 BEWEZEN, zestien NIET_GETEST, tegenover 94/20 vóór de vier
  UI-herstelstappen. De meting bewijst uitsluitend de beschreven browserstoringen.

Open vervolg blijft van eigenaar voorzien:

| Blokkade | Eigenaar | Vereist sluitbewijs |
|---|---|---|
| Loopbackalias | Lokale machinebeheerder | 127.0.0.2 activeren met beheerdersrechten; dertien ongewijzigde tests herhalen. |
| Academy en eigen domeinen | Security/test | Bestaande lokaal ingeschakelde fixtures, positieve eigen handelingen en negatieve rollen; geen productieschakelaars wijzigen. |
| Positieve object- en rolfixtures | Security/test | Geldige invoer en A/B-eigen objecten voor de ontbrekende routes; logout/delete in eigen geïsoleerde sessies. |
| Volledige appkwalificatie | Integrator | APPWERKT opnieuw op actuele bewijsbronnen; geen oude groene velden hergebruiken. |
| Integrale eindkwalificatie | Integrator | Definitieve bron en registers bevriezen; tweemaal volledige suite plus verplichte browser-, financiële en operationele controles. |

De 63 opwaartse en 105 primitief-naar-domeinkoppelingen zijn nog niet
verminderd. Financiële proeven blijven lokale synthetische scenario's;
externe providerduurzaamheid en alle SQL-crashvensters zijn niet bewezen.
Status ORANJE voor voortgang, releasepoort niet groen. Geen merge of uitrol.

#### Ronde 2 — herkwalificatie op c7accbc59b

De bewijsproducenten zijn opnieuw uitgevoerd nadat de offline-shellafdrukken
vastlagen. Op `c7accbc59bd2729a21a660e7a007c4cd32907ef4` telt APPWERKT
7 BEWEZEN, 102 NIET_GETEST, 1 GEBLOKKEERD_DOOR_DEFECT en 4 GEEN_FIXTURE.
Bereikbaar 99, bedienbaar 92, menselijk 106, voltooibaar 110,
waarheidsgetrouw 98, persistent 110, bevoegd 8 en herstelbaar 110.
Dit zijn aantallen binnen de scenario's van de meters, geen volledige
appveiligheids- of Premium Ready-verklaring. De historische 9/114 is niet
rechtstreeks vergelijkbaar met de aangescherpte autorisatiemeter.

Ontdekken heeft een native paginaovergangsfout. De browser berekent de
inkomende opt-in vóór de controller een overgangsobject ontvangt. De centrale
Heritage-uitrol wordt daarom beproefd met de bestaande controller na de
stijlen, renderblokkerend vóór de eerste weergave. Geen globale foutfilter,
geen tweede controller en geen uitschakeling van overgangsfunctionaliteit.
Iedere bronwijziging hierna maakt de betrokken c7acc-bewijzen historisch;
ze mogen niet als geldige eindkwalificatie van de gewijzigde boom tellen.

Een volledige run in de vaste c7acc-kopie is afgebroken toen bleek dat het
meegecommitteerde ROLPROEF-register nog van vóór de SW-wijziging stamde.
De versheidscontrole hield terecht alle ACL-rijen open. Na verse productie
slagen de 21 betrokken routedossier-/bevoegdheidstests zonder filterwijziging.
Deze afgebroken run heeft geen volledige suitescore.

Sluitvolgorde voor de resterende kwalificatie:

1. Browserreparatie laten slagen op normale navigatie, echte annuleringen en
   reduced motion; onafhankelijke review van bron én proef.
2. Alle afgeleide bronafdrukken verversen vóór de volgende bevriezing.
3. Bewijsproducenten afronden vóór APPWERKT start; een lopende VOLTOOIPROEF
   mag niet onderweg worden ingewisseld onder dezelfde samengestelde meting.
4. Lokale beheerder voltooit de reeds gevraagde loopbackconfiguratie; zonder
   127.0.0.2 blijven dertien infrastructuurproeven geblokkeerd.
5. Security/test sluit de positieve rol- en objectfixtures; 106 onbewezen
   apps en de onbesliste routes blijven zichtbaar, geen generiek groenlabel.
6. Integrator bevriest bron én bewijsinputs, draait tweemaal dezelfde volledige
   suite en de verplichte browser/financiële/operationele controles.

De VOLTOOIPROEF meldde bovendien een overschrijding van exit-cleanup-listeners.
Eigenaar testinfrastructuur: lifecycle onderzoeken en opruimen; waarschuwing
niet onderdrukken. Niet aangetoond als productfout. De financiële PG-proeven
bewijzen geen externe PSP/webhookvolgorde, tenantoverstijgende betalingen of
productiefailover. Die blijven afzonderlijke veiligheidsbewijzen.

De overgangsreparatie is daarna gericht geverifieerd: 27 bron-/afdruktests en
3 echte browsertests slagen op Node 26.12.0, zonder skips. De browserproef
bevat tien normale overgangen, tien werkelijk geannuleerde overgangen en tien
reduced-motion-navigaties zonder overgang. Alle paginafouten worden verzameld;
geen foutfilter. Een andere agent controleerde alle 300 HTML-diffs en herhaalde
negen centrale tests. De bestaande e2e-loper ontdekt de nieuwe proef via zijn
bestaande bestandsselectie. Afgeleide websitebeelden en beide SW-afdrukken zijn
ververst; de 114-appmeting blijft als historische c7acc-meting herkenbaar.

#### Ronde 2 — gesloten bronoorzaken op 21 oktober 2026

Werkstand vanaf `9d37f223caa110ae377133f3cc85c6c91772f2a4`; onderstaande
gerichte resultaten zijn geen integrale releasekwalificatie.

- De beheerder heeft de loopbackalias hersteld. Dertien eerder geblokkeerde
  tests slagen ongewijzigd op 9d37, zonder skips.
- De scenario-opruiming verwijdert nu haar eigen exit-listener. De tegenproef
  faalde eerst tweemaal; twaalf gerelateerde tests slagen na herstel. Een andere
  agent herhaalde de twee lifecycleproeven en controleerde de opruimgrens.
- De bestaande browserfoutcollector respecteert `eigenZeef` nu ook voor zijn
  vaste ruislijst. Acht echte overgangs-/UI-herstelproeven en 27 taal-/accounttests
  slagen zonder skips; paginafouten worden niet weggefilterd. De twee grote
  browserscripts zijn via de bestaande bundelaar gesplitst; beide uitvoerbestanden
  zijn byte-identiek. Onafhankelijke review bevestigt beide eigenschappen.
- Vijf standaard-uit rolroutes hebben echte lokale eigenaarbesluiten en positieve
  eigen handelingen als fixture. De afzonderlijke HTTP-proef slaagt: vijf eigen
  200-antwoorden, elf geweigerde kruisverzoeken en 22 levende sessiecontroles.
  De meter weigert deze vijf groen te noemen zonder de positieve routecontrole.
  Dit vervangt niet de nog benodigde volledige ROLPROEF-/APPWERKT-hermeting.
- Een echte assetfee-fout is gereproduceerd: twee rondes met dezelfde betaalidentiteit
  boekten de poolkas tweemaal. De ticketjaarcontrole gebeurt nu opnieuw binnen de
  bestaande vastlegging. Een afzonderlijke lege-toestandproef reproduceerde HTTP
  500 door initialisatie zonder save; ook dat is hersteld via de bestaande opslag.
  Vier pure proeven, de bestaande assettests en een echte PostgreSQL-proef met
  twee workers slagen. Die laatste controleert één huisbetaling, één poolbijschrijving,
  saldi, herhaling en herstart; hij bewijst geen willekeurig crashvenster of externe PSP.
- Directpay: zeven proeven slagen met twee echte workers en PostgreSQL, inclusief
  synthetische betaling, conflicterende retry, procescrash, accountafscherming en
  sessie-intrekking over workers. Dit is geen volledige organisatie-/mandaatmatrix.
- Een onafhankelijke commitbarriereproef vond vroeg succes in de gedeelde
  idem-kern: een tweede aanroeper las het geheugenantwoord voordat de eerste
  commit vaststond en hield succes na rollback. De bestaande in-vluchtcontrole
  staat nu voor de antwoordcache. Beide tegenproeven slagen na de reparatie,
  inclusief payloadconflict, beide aanroepers 503 bij rollback en precies een
  boeking bij een gezonde retry. Een andere agent beoordeelde de fix. Dit is
  bewijs van de gedeelde kern/bundel, niet van iedere buitenste requestcommit.
- Drie bestaande browserproeven voor video en clips slagen, waaronder werkelijk
  beeldtransport in beide richtingen en geweigerde oproepen. De vier ontbrekende
  APPWERKT-fixtures krijgen daardoor niet automatisch acht groene bewijzen.

De bestaande idem-/bank-/Pay-regressies slagen 536/536 zonder skips in hun
eigen lokale wegwerpdatabases. De eerste brede run erfde ten onrechte de
PostgreSQL-configuratie en gaf 53 failures; die ongeldige opstelling is bewaard
als diagnose, niet als productkwalificatie. PostgreSQL wordt afzonderlijk getoetst.
De broncontrole is na de laatste reparaties en documentafleiding groen.
De nieuwe PostgreSQL-proef staat in de bestaande verplichte PG-testlijst;
de commitbarriereproef is met reden geregistreerd als testaanroeper van de
bestaande duurzame bundel. Geen productaanroeper of kwaliteitsdrempel is toegevoegd
of versoepeld. Dit broncheckpoint is nog geen releasekandidaat met eindkwalificatie.
De 25 onverklaarde mutatiecontracten, onvoldoende objectautorisatiebewijzen en
ontbrekende integrale kwalificatie blijven releaseblokkades. De historische
appmeting blijft herkenbaar verlopen. Geen merge, productie-uitrol of echte betaling.

### Deep Green: hermeting en gedeelde intrekking (21 oktober 2026)

De zeven meters zijn opnieuw uitgevoerd op broncommit `521fdbdac2`, Node
26.12.0. APPWERKT meet 114 apps, nul browserdefecten en acht volledig bewezen
apps binnen de bestaande scenario's; 102 blijven niet volledig getest en vier
missen fixtures. Er zijn 718 van 945 gevonden knoppen aangetikt; zes schermen
blijven grotendeels ongemeten. ROLPROEF heeft nul onbesliste kruisproeven na de
vijf positieve eigenaarfixtures. ROLRONDE blijft 577 bewezen tegenover norm
1444. LIEGRONDE blijft 98/114. Geen van deze cijfers kwalificeert het platform.

De volledige PG-run op die commit vond alsnog een intrekkingsfout: een tweede
worker las na logout tijdelijk zijn oude sessiecache (200 in plaats van 401).
Dit vervangt de eerdere losse groene intrekkingsclaim hierboven. Zonder Redis
wordt nu voor bearer-verzoeken de bestaande gedeelde intrekkingsoutbox gericht
op tokenhash en geverifieerde sid gelezen. Bij opslagonzekerheid stopt het
verzoek met 503. Logout gebruikt de bestaande tokenhash in plaats van
objectidentiteit, zodat externe sessieherbouw de intrekking niet overslaat.

Bewijs op de gewijzigde werkboom: 16 gerichte unitproeven, 32 bestaande
sessie-/documentproeven en de volledige 48 PG-bestanden (128 tests) slagen,
zonder skips. De twee-workerproef houdt automatische sessiecache-invalidatie
expliciet tegen en eist direct 401. Een onafhankelijke agent beoordeelde de
reparatie. Een eerste nieuwe query bleek niet compatibel met de eigen
pgwire-arraycodering; de query gebruikt nu gewone gebonden scalairen. De
mislukte tussenmeting blijft als diagnose bewaard. Geen driverwijziging.

Reikwijdte: homogene PG-installatie zonder Redis, bearer-verzoeken die na
bevestigde intrekking beginnen. Dit bewijst geen intrekking tijdens een al
lopende mutatie, bestaande SSE-stroom, andere credentialdragers of gemengd
geconfigureerde clusters. Het bestaande Redis-pad is ongewijzigd en zijn
verplichte PG-proeven zijn opnieuw geslaagd. Een schone integrale herhaling
op een exacte nieuwe commit blijft nodig; de 521f-appbewijzen zijn historisch
en mogen niet automatisch naar de gewijzigde code worden overgenomen.

Zeven semantische productbesluiten zijn door de eigenaar goedgekeurd en vastgelegd in MUTATIECONTRACT.md:
vier creaties met een opdrachtidentiteit, twee telkens actuele analyses en
versiegebonden ondertekening met behoud van de eerste ontvangst. Er zijn nog
geen publieke contracten of bijbehorende clients gewijzigd. De overige
ontbrekende bevoegdheids-, keten- en operationele bewijzen blijven open.
Geen merge, publieke uitrol of echte financiële transactie uitgevoerd.

### Deep Green — mutatiecontracten, vervolgmeting 21 oktober 2026

Werkbasis: `8eb1101897`, met nog niet gecommitteerde wijzigingen. Dit vervolg
vervangt de voorgaande momentopname dat clients en routes nog ongewijzigd zijn;
het vervangt geen historische testuitslagen en kwalificeert geen release.

- Bankrekeningopening vereist een opdrachtidentiteit en serverbepaalde actor.
  Zaakhouder wordt gecontroleerd via de bestaande leveranciersbron. Conflicten
  binden de volledige inhoud; nieuwe opdrachten blijven mogelijk.
- Bureauzaken en werkplektaken bewaren ontvangstmetadata binnen hun bestaande
  collectietransactie. Archivering van het werkobject maakt dezelfde opdracht
  niet opnieuw uitvoerbaar. Oudere clients zonder sleutel worden geweigerd.
- Ondertekening vereist de gelezen contractversie. Ontvangstgeschiedenis en
  eerste tijdstip blijven bewaard. Nieuwe hashes binden ook titel, scope en
  profiel; ontbrekende historische gegevens worden niet achteraf verzonnen.
- Labfonds-advies en Magnaat-scan rekenen opnieuw. Een Labfonds-advies wacht
  nu via de bestaande duurzame bundel op opslagbevestiging. Tegenproef eerst
  rood, daarna groen; geen nieuwe financiële uitvoering.
- Lezen van onboardingstatus en het lege bankbord initialiseert niet langer
  stil collecties zonder opslagbevestiging. Beide fouten zijn eerst met rode
  tegenproeven gereproduceerd.

Gerichte lokale resultaten onder Node 26: 83 bestaande HTTP-regressies groen;
39 gerichte contract-/client-/leesproeven groen; 35 analyse- en bestaande
Magnaat/Labfonds-proeven groen. Deze verzamelingen overlappen gedeeltelijk en
worden niet opgeteld tot een platformtotaal. Echte geïsoleerde PG-workers:
ondertekening met rollbacktrigger en SIGKILL vóór/na commit, bankreplay en
herstart, bureauzaak en werkplektaak slagen in hun benoemde scenario's.
De nieuwe PG-bestanden zijn opgenomen in de bestaande verplichte toetslijst.
Dit bewijst geen hostuitval, alle autorisatie-intrekkingen of volledige ketens.

Onafhankelijke review vond daarna een clientrace: een laat antwoord kon de
opdrachtsleutel van een nieuwere opdracht wissen. Tegenproeven reproduceerden
dit in bureau, werkplek en bank. Wissen vergelijkt nu de verzonden sleutel met
de actuele sleutel; verlate successen overschrijven geen nieuwere opdracht.
Bij browseropslagfalen versturen bureau en bank niets. De centrale herhaling
van deze gerichte client- en contractproeven slaagt: 26/26, nul skips.
De aanvraagroute blijft open werk: gezamenlijke aanvraag/ontvangstopslag en
retentie vereisen het besluitvoorstel in MUTATIECONTRACT.md; geen nieuwe
opslagarchitectuur is goedgekeurd of ingevoerd.

De volledige suite op de schone `8eb1101897`-werkstand is geen kwalificatie:
bewijsmatrix liep vast en is afzonderlijk gestopt; native proefbinaries
ontbraken aanvankelijk in die werkstand en zijn daarna uit dezelfde bron
gebouwd. Beide omstandigheden blijven zichtbaar. De suite vervolgt overige
bestanden; een integrale herhaling in een complete omgeving blijft verplicht.
De zeven contracten blijven conservatief ongekwalificeerd in het register.
Geen productie-uitrol, merge of echte betaling uitgevoerd.

De geïsoleerde bewijsmatrixherhaling op dezelfde `8eb1101897` bron slaagt
31/31 binnen een externe deadline van 120 seconden. Dit verklaart de eerdere
hang niet en maakt de gestopte volledige run niet alsnog groen. Gerichte logs
en bronstatus staan in het bestaande externe evidencepad `round2`, met hashes
in `mutation-contract-progress.json`; geen tweede kwaliteitsregister.

**Vervolg na het eigenaarsbesluit voor de integrale afbouwronde.** De eigenaar
heeft de beperkte uitbreiding van de bestaande transactiepoort goedgekeurd en
de keuze van ontvangstbewaring en antwoordvorm gedelegeerd. De eerdere tekst
hierboven over een nog ontbrekend architectuurbesluit is daarmee historisch.
Het actuele productbesluit staat in MUTATIECONTRACT.md §9.3. Aanvraaginhoud
krijgt geen langere bewaartermijn door dit besluit; minimale ontvangstmetadata
blijft nodig zolang oude opdrachtkeys geldig blijven. Geen wettelijke
complianceclaim of onbeperkte bewaring van aanvraaginhoud.

De meervoudige PostgreSQL-poort is gericht beproefd: 8/8 geslaagd zonder skips,
inclusief gezamenlijk auditspoor en rollback bij de tweede write. De lokale
opslagregressies slagen 72/72; die telling omvat overlappende gerichte proeven
en mag niet bij eerdere tellingen worden opgeteld. Een gevonden verlies van
lokaal voorbereide inhoud bij een nog ontbrekende KV-rij is met een rode
tegenproef gerepareerd. Verdere bronwijzigingen vereisen nieuwe verificatie.

De historische volledige run op `8eb1101897` is afgerond met exitcode 1.
Alle 48 PostgreSQL-bestanden slaagden, maar de overige failures en de eerder
onderbroken bewijsmatrix blijven open bewijs. Na bouwen van de ontbrekende
motor slagen de 15 betreffende native tests op dezelfde bron. Dit is geen
retroactieve groenverklaring van de volledige run. De taal-/browserproef
slaagde 27/27 en vernieuwde uitsluitend haar bestaande, afgebakende rapporten.

De aanvraagmigratie is nog in uitvoering. De eerste integratieproef ontdekte
een nieuwe grensschending in de privacybedrading waardoor serverstart faalde.
Deze is hersteld met twee beperkte callbacks, zonder brede toegang tot de
aanmeldmodule; één echte intakeproef en 30 bestaande HTTP-proeven slagen.
De PostgreSQL-aanvraagproef heeft nog failures, waaronder accountwissing die
botst op het onveranderlijke auditspoor. Deze geldt niet als gesloten bewijs.
De aanvullende bankproef slaagt 3/3, inclusief echte procesuitval vóór en ná
COMMIT. Opruiming van oude bank-idempotentiesleutels blijft afzonderlijk te
onderzoeken. Status blijft ORANJE: geen exacte gekwalificeerde kandidaat, geen
twee groene runs en geen actuele volledige APPWERKT-kwalificatie.

**Vervolgmeting aanvraag en audit.** De hiervoor genoemde aanvraagfailures zijn
gericht hersteld. De echte PostgreSQL-aanvraagproef slaagt 7/7, inclusief
accountwissing en herhaling na opruiming. Procesuitval met SIGKILL vóór COMMIT
en na COMMIT maar vóór antwoord slaagt 3/3: geen tweede aanvraag. Dit zijn
proeven op de gewijzigde werkboom, geen exacte releasecommitkwalificatie.

De auditpoort accepteert nu een geldige actorwissing gevolgd door normale
nieuwe auditregels binnen dezelfde transactie. De keten, volledige wissing,
unieke log-identiteiten en teller blijven gecontroleerd. Een onafhankelijke
review ontdekte hergebruik van oude log-ID’s; de tegenproef is toegevoegd en
het probleem hersteld. De gerichte audit/requestregressies slagen 21/21 en de
onafhankelijke herbeoordeling is akkoord. De gecombineerde transportcontrole
houdt nog één open specialist-routing-failure; die wordt niet genegeerd.

Ontvangstbewaring en het compacte antwoord volgen MUTATIECONTRACT.md §9.3.
Na verwijdering van inhoud/vingerafdruk antwoordt een oude intentie met 410,
niet met een schijnbaar geslaagde herhaling. De broninventaris vindt geen
ongemigreerde productcaller van de externe aanvraagroute; dit vervangt geen
volledige gebruikersketenproef. Platformstatus blijft ORANJE.

De onafhankelijke bankreview heeft de crashproef aangescherpt: alle drie
bankcollecties moeten vóór de COMMIT-barrière geschreven zijn; ontvangst,
inhoudsafdruk en eerste openingstijdstip worden direct na de crash en na beide
worker-retries exact gecontroleerd. Na correctie van een verwachte
kantooridentiteit in de fixture slaagt de herhaling 3/3; review akkoord.
De aanvullende verificatie-isolatieproeven met echte HTTP-accounts slagen
2/2. Deze bewijzen sluiten uitsluitend hun benoemde scenario’s, niet alle
114 apps. De statische controle meldt nog verouderde afgeleide registers en
taalbewijs. Die worden pas na bronstabilisatie opnieuw gemeten.

### Deep Green — afsluiting gerichte mutatie- en regressiebronnen (22 oktober 2026)

Nog steeds werkbasis `8eb1101897` met niet-gecommitteerde integratiewijzigingen;
dit is geen releasecommit. De bestaande transactiepoort en idem-kern zijn verder
afgebakend, zonder tweede opslagvoorziening of nieuwe dependency.

- Kantoor-bankontvangsten blijven in de bestaande `bankIdem`-store maar vallen
  buiten de gewone 20.000-sleutelring. Migratie van een oude ringvermelding deelt
  dezelfde duurzame bundel en rollback. Een beschermde ontvangst zonder afdruk,
  geldig antwoord of IBAN stopt met 503. Onafhankelijke herhaling: 40/40 groen;
  extra opslagprobes bevestigen gesloten falen en identieke replay.
- De taakopdracht is nu actor + opdrachtsleutel; bedrijf en taakvelden zitten in
  de inhoudsafdruk. De eerder groene maar onjuiste verwachting dat dezelfde key
  in een ander bedrijf een nieuwe taak mocht maken is vervangen door het
  goedgekeurde conflictcontract. De echte PG-workerproef slaagt 4/4, inclusief
  twee SIGKILL-vensters en sessie-intrekking.
- De transportcache herkent de zeven mutatieroutes exact, zodat een generieke
  cache geen oud succes vóór autorisatie of domeincontrole teruggeeft. De
  gecombineerde aanvraagtransport-, bank- en ticketcontrole slaagt 33/33.
- De ticketdag gebruikt nu het einde van de lokale Amsterdamse dag. Wintertijd,
  zomertijdbegin en zomertijdeinde zijn afzonderlijk bewezen. Een gisteren
  uitgegeven ticket na lokale middernacht wordt geweigerd.
- De browserovergangsproef eist in de normale stand 10/10 overgangen, in reduced
  motion nul, en bij expliciete annulering ten minste één echte overgang plus
  `skipTransition()` voor iedere aangeboden overgang. Chromium slaagt 3/3; een
  onafhankelijke agent herhaalde dit tweemaal zonder skip of waargenomen
  instabiliteit. Browsers mogen na annulering volgende overgangen overslaan.
- De brede idem-/dubbeltik-/ontvangstselectie gaf 312/313 groen. De enige failure
  was een verouderd gegenereerd registernummer na bronverschuiving, geen
  productgedrag. De historische failureset gaf daarna 118/121: twee afgeleide
  registers en één meetadres. De echte meetvorm in `scripts/check.js` is
  leesbaar gemaakt en de gerichte stillezingcontrole slaagt 7/7.

De zes gerichte PostgreSQL-contractbestanden gaven vóór de taakcorrectie 22/23;
na de correctie slaagt de afzonderlijke ontbrekende werkplekset 4/4. Een nieuwe
gezamenlijke platformrun en registerverversing blijven verplicht. Status blijft
**ORANJE**: nog geen schone kandidaatcommit, geen actuele 114/114-APPWERKT-meting,
geen twee integrale groene runs en geen operationele vrijgaveproef. Geen merge,
publieke uitrol of echte betaling uitgevoerd.

### Deep Green — Ronde 3 actuele integrale nulmeting (22 oktober 2026)

De hiervoor openstaande registerverversing is uitgevoerd op opeenvolgende,
schone bronstanden. Dit is een nieuwe nulmeting voor Ronde 3 en geen
vrijgavekwalificatie.

- `VOLTOOIPROEF.json` is op commit `877e0459b6` volledig opnieuw gemeten met
  Node `v26.12.0`: 110 apps, 330/330 bewijsgroepen gesloten, 110/110 afgeleide
  menselijke bewijzen gesloten, nul open en nul niet beproefd. De proef gebruikt
  per scenario wegwerpopslag, een read-only opslaglezer, nette herstart en
  SIGKILL-crash; de vier niet gemodelleerde APPWERKT-ingangen vallen buiten dit
  register.
- `IDOR.json` en `ROLPROEF.json` zijn op de actuele bron opnieuw gemeten. IDOR
  vond over 2.630 schrijfroutevermeldingen 1.124 aantoonbaar gescheiden routes,
  nul nieuwe doorbraken en nul persoonslekken. De volledige rolproef vond 5.442
  schrijfroutes, voerde 4.514 routes uit in 9.369 pogingen en vond nul
  verkeerde-roltoegang, privacylek of blijvend ongeoorloofd zijeffect.
- `BEVOEGD.json` combineert die registers conservatief: 10/114 apps zijn
  volledig bewezen en 104/114 blijven `NIET_GETEST`. Een enkele geweigerde
  route, een publiek pad of een handmatig nagekeken niet-lek telt uitdrukkelijk
  niet als volledig autorisatiebewijs.
- `LIEGRONDE.json` bewijst 106/114 ingangen waarheidsgetrouw; drie
  RTFoundation-deuren en vijf interne OS-kiezers hebben nog geen uitvoerbaar
  declaratief contract.
- `APPWERKT.json` is op commit `b0a84886bc` volledig opnieuw gemeten: 114/114
  onderdelen bezocht en nul browserdefecten. De samengestelde stand is 10
  `BEWEZEN`, 100 `NIET_GETEST` en 4 `GEEN_FIXTURE`. Per dimensie: bereikbaar
  107, bedienbaar 96, menselijk 110, voltooibaar/persistent/herstelbaar elk 110,
  waarheidsgetrouw 106 en bevoegd 10. De vier fixturegaten zijn Juridisch,
  Camera, RTFoundation en Videobellen.
- `appwerkt-vers --controle` meldt 900 verse bewijzen, 10 rijen die als 8/8
  gelden en nul daarvan met vervallen bewijs.

De actuele status blijft **ORANJE**. De grootste blokkade is aantoonbaar
autorisatiebewijs voor 104 apps, gevolgd door 18 bedienbaarheidsgaten, acht
waarheidsgetrouwheidsgaten, zeven bereikbaarheidsgaten en vier toepasselijke
voltooiingsfixtures. Er zijn nog geen twee volledige groene kwalificatieruns,
geen geclassificeerde afbouw van de 63 opwaartse en 105
primitief-naar-domeinkoppelingen en geen afgeronde staging-, back-up-, rollback-
of incidentproef. Geen merge, productie-uitrol of echte financiële transactie
uitgevoerd.

### Deep Green — eerste afgesloten gedeelde oorzaak in Ronde 3 (22 oktober 2026)

De waarheidsgetrouwheidsproef verving ook de centrale Foundation-toegangspoort
door een leeg antwoord. Daardoor bleef de juiste gezinssessie kunstmatig voor
drie beschermde schermen staan en werd de deur gemeten in plaats van het
scherm. `/api/rtf/toegang` blijft nu, net als de andere sessiepoorten, echt;
alle functionele Foundation-antwoorden achter die deur blijven door de
liegpoort vervangen. De gerichte regressies slagen 10/10.

De volledige `LIEGRONDE.json` op commit `330b7921e7` ging hierdoor van 106 naar
107 bewezen ingangen, zonder nieuw defect. `Vrienden` opent nu en verzint bij
lege functionele antwoorden geen zekerheid. Bord en Schrift bereiken de
algemene deur maar blijven terecht achter hun afzonderlijke tijdelijke
Schoolpas; vijf interne OS-kiezers hebben nog geen functie-specifieke
meetadapter. Geen van deze zeven gaten is administratief groen gemaakt.

Omdat de bron wijzigde, zijn de bevoegdheidsronde en APPWERKT opnieuw uitgevoerd
in plaats van de oude bewijsstempels geldig te verklaren. `BEVOEGD.json` op
commit `bdbfa07329` blijft conservatief 10 `BEWEZEN` en 104 `NIET_GETEST`.
`APPWERKT.json` is daarna op dezelfde schone bronstand volledig samengesteld:
114/114 onderdelen bezocht, nul browserdefecten, 10 volledig bewezen apps,
waarheidsgetrouw 107/114 en bevoegd 10/114. `appwerkt-vers --controle` meldt 900
verse bewijzen en nul vervallen bewijs onder de tien 8/8-rijen.

Dit sluit één gedeelde meetfout en één aanvullend appbewijs. De platformstatus
blijft **ORANJE**: 104 autorisatiegaten, zeven waarheidsgetrouwheidsgaten, vier
voltooiingsfixtures, de architectuurclassificatie, twee integrale groene runs en
de operationele kwalificatie staan nog open. Geen merge, productie-uitrol of
echte betaling uitgevoerd.

### Deep Green — Foundation-klaslokalen eerlijk gemeten (22 oktober 2026)

De twee resterende Foundation-deuren voor Bord en Schrift zijn niet omzeild.
De liegronde maakt nu via de bestaande profiel- en lesroutes een echt gekozen
kinderprofiel, een echte les en een echte leerlingdeelname. De docent- en
leerlingensleutel zijn verschillend, blijven uitsluitend in `sessionStorage`,
verlopen volgens het bestaande Schoolpas-contract en worden bij elk verzoek
servermatig gecontroleerd. Een gerichte tegenproef bewijst dit 9/9.

De fixture staat bewust in `scripts/lib/schoolproefsessies.js` en niet in de
algemene sessiehelper. Daarmee verandert een waarheidsfixture niet langer het
raakvlak van de bevoegdheidsproef. De volledige `LIEGRONDE.json` op commit
`4ea4825c71` bewijst nu 109/114 ingangen: Bord kreeg negen lege functionele
antwoorden en Schrift tien, zonder verzonnen zekerheid, rommel, JS-fout of
toegangsdeur. De vijf resterende gaten zijn uitsluitend de interne OS-kiezers
Bellen, RTFoundation, Snaps, Videobellen en Werk; voor hen bestaat nog geen
uitvoerbaar functiecontract en er is geen URL geraden.

Na de verplichte herhaling van `BEVOEGD.json` op commit `db7391d693` bleef de
autorisatiestand 10 `BEWEZEN` en 104 `NIET_GETEST`. De daaropvolgende volledige
APPWERKT-meting op commit `6779d098f3` bezocht
114/114 onderdelen met nul browserdefecten. De actuele dimensies zijn:
bereikbaar 107, bedienbaar 96, voltooibaar 110, persistent 110, herstelbaar
110, menselijk 110, waarheidsgetrouw 109 en bevoegd 10. De samengestelde stand
blijft 10 `BEWEZEN`, 100 `NIET_GETEST` en 4 `GEEN_FIXTURE`; de nieuwe
waarheidsbewijzen maskeren de nog ontbrekende bereikbaarheid, bediening en
bevoegdheid van Bord en Schrift niet.

De platformstatus blijft **ORANJE**. Open blijven: 104 volledige
autorisatiebewijzen, vijf uitvoerbare OS-contracten, vier voltooifixtures, de
architectuurclassificatie, twee integrale groene kwalificatieruns en staging-,
back-up-, rollback- en incidentbewijs. Geen merge, productie-uitrol of echte
financiële transactie uitgevoerd.

### Deep Green — afsluiten op bronoorzaak (22 oktober 2026)

PR #697 blijft afbouwbasis. CI-run `39798849793` op `e54ef1cce1`
stopt bij negen preflightbevindingen; de overgeslagen afhankelijke jobs zijn
geen afzonderlijk bewezen productdefect. De negen bevindingen zijn twee
modulegroottegrenzen (`handlerpoorten/buiten-routes-b.js`,
`lidboard/werkbeleid.js`), een ontbrekende PostgreSQL-testregistratie en zes
verouderde afleidingen/bewijzen (ARCHITECTUUR, BEWIJS, BEWIJSSCHULD, FUNCTIES,
taalbewijs en websitebeelden). Eigenaar van deze afbouw: de integratiewerkstroom.
Afgeleide bestanden worden pas na hun bronreparaties in samenhang vernieuwd.

De vergeten `test/magnaat-besluit-workers.pg.test.js` is aangesloten op de
bestaande `scripts/lib/pg-toetslijst.js`. Daarmee nemen de suiteplanner,
geïsoleerde PostgreSQL-runner en releasecontrole dezelfde test mee. De echte
twee-workerproef plus `test/suite-pg.test.js` slagen met Node v26.12.0:
8/8, nul skips, exitcode 0. Command:
`DATABASE_URL=<lokale-testdatabase> node --test test/magnaat-besluit-workers.pg.test.js test/suite-pg.test.js`.
De proef maakt zelf een wegwerpdatabase en toetst herhaling, herstart,
inhoudsconflict en actorisolatie. De eerste sandboxpoging faalde op EPERM;
de toegestane loopbackrun is de geldige uitvoering. De nieuwe volledige
PostgreSQL-kwalificatie blijft vereist: een oudere telling kan deze uitbreiding
van de testlijst niet bewijzen.

De bestaande BEVOEGD-rijen groeperen de 104 open apps voorlopig als volgt:

| Bewijsgat | Apps | Volgende afsluitactie |
|---|---:|---|
| Routebewijs onvolledig | 89 | Gedeelde routes en werkelijke beveiligingspatronen bepalen; eigen positieve en negatieve controles behouden |
| Persona-adapter ontbreekt | 7 | Bestaande zaak-/kantoorsessies koppelen aan object- en rolproeven |
| Gezinskruisproef onvolledig | 5 | Eigen toegang van beide gezinnen aantonen vóór afscherming wordt beoordeeld |
| Interne ingang ontbreekt | 2 | Bestaande UI werkelijk openen; geen fictieve URL als bewijs |
| Statisch juridisch scherm | 1 | Toepasselijkheid onderbouwen; niet automatisch bevoegd verklaren |

Dit zijn groepen van ontbrekend bewijs, geen reeds bewezen beveiligingsfamilies.
De bestaande Evidence DAG (`plan.js`) en `bewijsraakvlak.js` bieden al gerichte
selectie en bewijsverval met conservatieve terugval. Eerst hun dekking toetsen;
geen nieuwe bewijsengine. APPWERKT is voor deze CI-aansluiting niet opnieuw
gemeten en geen appstatus is verhoogd. Status blijft ORANJE. Geen merge of uitrol.

### Deep Green — preflightpakket gesloten (22 oktober 2026)

De negen oorspronkelijke preflightbevindingen van CI-run 39798849793 zijn
hersteld. De Lab-routepoortgegevens zijn binnen hetzelfde register gesplitst;
alle 49 waarden uit de oorspronkelijke tweede routelijst zijn exact behouden.
Samenvoegen weigert dubbele routes in alle delen. Werkbeleidgedrag bleef gelijk;
alleen de herhalende historische toelichting is ingekort. Gerichte poort- en
werkbeleidproeven: 15/15. Taalbewijs opnieuw werkelijk gemeten: 27/27.
De bestaande bewijsraakvlak-proeven: 24/24. Geen skips in deze drie selecties.

ARCHITECTUUR, BEWIJS, BEWIJSSCHULD, FUNCTIES en de door het nieuwe bronbestand
getroffen OBJECTMODEL- en COMMERCE-tellingen zijn opnieuw afgeleid. De echte
websitebeelden en hun websitewaarheid zijn vernieuwd. De volledige
`node scripts/check.js` eindigt met "Alles in orde" (lokale log:
`/tmp/rtg-r3-check-final.log`). De sandboxrun kon de routekaart niet openen;
alleen de vervolgens toegestane loopbackrun telt als geldige preflight.

Aanvullend gevonden: `test/objectveld.test.js` mist bij acht Lab-routes de
handgelezen objectvelden. De waarden zijn aantoonbaar gelijk gebleven; dit is
een bestaande onvolledige bewijsafleiding, nog geen gesloten werkpakket.
De huidige routekoppelingen prioriteren stroomticket (20 appverwijzingen),
ledenstream (18) en Rechterhand-routes (17 per route). Dit zijn overlappende
verwijzingen en geen optelbare, reeds gekwalificeerde apps.

Het preflightpakket sluit geen APPWERKT- of autorisatiebewijs. Door de
bronwijzigingen moet bewijsverval volgens de bestaande regels blijven gelden.
Volgende stap: volledige Node-suite en de objectveldafleiding. Geen merge,
productie-uitrol of Deep Green-verklaring.

### Deep Green R3 — gedeelde meetoorzaken en actuele rode nulmeting (22 oktober 2026)

Volledige lokale Node-run op `816906a89bfe024e638e1b6f8f4c28f86924e982`,
Node v26.12.0, schone bron: 20.187 tests, 20.111 geslaagd, 21 mislukt,
55 overgeslagen. `SUITE.json` bewaart deze rode uitkomst. De run eindigde
zelfstandig; het latere stopverzoek vond geen actieve runner. PostgreSQL en
Redis waren niet meegegeven: de PG-proeven zijn daarom niet gekwalificeerd.
De Redis-geheimkanarie miste bovendien redis-server in PATH. Dit is geen
vergelijkbare verbetering/verslechtering tegenover een run mét infrastructuur.
Ruwe uitvoer: `/tmp/rtg-r3-full-suite.log`; foutselectie via de bestaande
`.release/unit-test-fouten.json`.

Gesloten gerichte oorzaken, nog geen integrale vrijgave:

- Objectveldafleiding: de generator en controle lezen nu dezelfde bestaande
  handpoorten op exacte HTTP-methode+route. Acht Lab-velden werden gemist;
  ook alle 17 historische veldloze uitzonderingen hadden al expliciete
  handvelden. 18/18 gerichte proeven en een negatieve handpoorttegenproef.
  Dit bewijst de veldafleiding, niet de runtime-isolatie van al die routes.
- Workercheckpoints: bureauzaak, office-bank en werkplektaak gebruiken de
  bestaande voorwaardewachter. 11/11 echte PostgreSQL-workerproeven groen,
  inclusief SIGKILL vóór/na commit en ingetrokken sessies; nul skips.
  De aparte klokwachtcontrole slaagt 6/6, zonder hogere schuldgrens.
- Magnaat: idem/idempotentieSleutel is in CODECREDENTIALS onderbouwd als
  opdrachtidentiteit, geen toegangscredential. Een werkelijk HTTP-verzoek
  bewijst dat dezelfde bekende sleutel zonder sessie 401 en als gast 403 geeft,
  terwijl de bevoegde herhaling geen extra lening oplevert. Samen met de
  credentialregister- en geheimkanarieproeven: 30/30 groen, nul skips, met de
  bestaande Redis-binary in PATH. Geen productiegeheimen of echte betalingen.
- Streambewijs: twee verse leden ontvangen elk hun eigen marker en barrière.
  De adapter wacht op events, controleert kruisinhoud en weigert anonieme en
  herhaalde tickets uitsluitend met 401/403. Raw bewijs bevat exacte methoden;
  500, ontbrekende positieve controle of alleen een groen label blijven open.
  Gerichte echte HTTP/SSE-proef plus tegenproeven: 7/7 groen. De aanvullende
  rolproef voor ticketuitgifte blijft vereist. APPWERKT is nog niet hergemeten.

Onafhankelijke architectuurlezing: 63 omhoog en 105 lekmarkeringen zijn
reproduceerbaar, maar 105 betekent niet 105 verboden primitief-domeinkoppelingen.
63 lekmarkeringen zijn bestaande EIGEN_DATA-familieknippen; de overige 42 hebben
verklaringen die nog inhoudelijk moeten worden beoordeeld. Opwaartse paren:
36 motor→domein, 16 ingang→opzet, 6 domein→opzet, 5 motor→opzet. Geen categorie
is stilzwijgend vrijgesteld; nul onbekend is niet hetzelfde als nul verboden.

De preflight op 816906 meldde 867 vervallen bewijzen, ook bij alle tien eerder
8/8-apps. 10/114 is dus historische stand. CI op dezelfde commit bevestigde
preflight, CodeQL en WebKit, maar norm, deltapoort en rolronde zijn rood.
De rolronde bewijst 577 endpoints tegenover de bestaande vloer 1444; 4583
antwoorden missen voldoende bewijs. Deze drempel blijft intact. Vuile
registermetingen worden na broncommit opnieuw uitgevoerd, niet omgestempeld.
Status blijft ORANJE. Geen merge of productie-uitrol.

Vervolgmeting 22 oktober op bronstand `cebe17ca76`:

- De volledige bestaande PostgreSQL-selectie haalt 55/56 bestanden. De
  ondertekenproef faalt: de tweede worker weigert een bij de eerste worker
  aangemaakte gezinssessie. Herhaling reproduceert dit. Het ontbrekende
  integrale PG-bewijs blijft open; de volgende subtestfouten zijn cascades.
- De volledige IDOR-ronde levert voor de twee streamroutes beide eigen
  markers en barrières, zonder kruismarkers in het geteste eventvenster.
  Anoniem en ticketreplay geven 401. Dit is geen volledige objectkwalificatie:
  de overige onbereikbare routes blijven als zodanig in IDOR.json staan.
- Een bestaande Lifestyle-aanvraag met werkelijk eigenaarsakkoord ontsluit
  23 Bureau/Rechterhand-leesroutes. Een afzonderlijk geldig RTG-account,
  anoniem, leverancier en kantoor blijven geweigerd. Het gerichte pakket
  haalt 16/16; de volledige rolronde moet dit nog integraal herhalen.
- De twee ontbrekende Move-regieroutes hebben nu HTTP-proeven voor vervalste
  pasrechten, eigen voorkeuren, herhaling en een tweede lid. Samen met de
  bestaande kern- en operatieproeven 7/7 groen, nul skips.
- APPWERKT-RAAKVLAK is gekoppeld aan de bestaande integriteitscontrole.
  Die vergelijkt ook de werkelijk vastgelegde registers en weigert een
  verwijderde hash of een andere meetcommit. 25/25 groen. Deze controle
  bewijst registerbinding; zij verklaart geen verlopen appbewijs opnieuw geldig.

Bewijslogs: `/tmp/rtg-r3-pg-full.log`, `/tmp/rtg-r3-onboarding-repro.log`,
`/tmp/rtg-r3-idor.log`, `/tmp/rtg-r3-ov-regie.log`,
`/tmp/rtg-r3-raakvlak-integrity.log`. De nieuwe bronwijzigingen zijn nog geen
bevroren releasekandidaat. Normgrenzen blijven ongewijzigd; twee integrale groene
runs, actuele appbewijzen en operationele kwalificatie ontbreken nog.

Onafhankelijke read-only review vond één beperking in de streammeter:
de kruismarkerstand werd vóór de laatste replay/anon-controles vastgezet.
De meter sluit nu eerst beide readers af en beoordeelt daarna alle ontvangen
events. Een tegenproef injecteert tijdens het afsluiten een kruismarker en
vereist `gebroken`. Gerichte herhaling inclusief echte HTTP/SSE: 8/8 groen,
nul skips (`/tmp/rtg-r3-stream-close.log`). De correctie is onafhankelijk
herbeoordeeld; de reviewer heeft geen eigen testrun uitgevoerd. Het eerder
vastgelegde IDOR-register is nog geen hermeting met deze strengere afsluitcontrole.

Vervolgafsluiting: de drie RTF-onboardingroutes verversen vóór de bestaande
sessiecontrole de gedeelde Foundation-stand. De echte PostgreSQL-proef haalt
6/6, inclusief twee workers, commitfouten, procesuitval en sessie-intrekking
vóór het volgende verzoek (`/tmp/rtg-r3-onboarding-current.log`). Gelijktijdige
intrekking tijdens de ondertekentransactie blijft een afzonderlijke open
bewijsgrens; dit pakket claimt daarvoor geen atomair autorisatiebewijs.
De bestaande verversvoorziening ververst de volledige projectie.

Aanvraagontvangsten en werkplekbezetting gebruiken nu hun bestaande
eigencollectiecontract. Aanwezigheid lezen maakt geen collectie aan; alleen
expliciet eigen namen worden toegelaten, ook bij JavaScript-prototypenamen.
De gerichte SQLite/HTTP-regressie haalt 49/49 zonder skips
(`/tmp/rtg-r3-ownership-sqlite.log`). Een voorafgaande gemengde run gaf
41/60 doordat gewone SQLite-fixtures een PostgreSQL-omgeving erfden;
die onjuiste proefopzet is geen productkwalificatie. De volledige geïsoleerde
PostgreSQL-selectie moet opnieuw worden uitgevoerd op de vastgelegde bronstand.
Status blijft ORANJE; geen merge of uitrol.

Hermeting op `4c0948c98a`: PostgreSQL opnieuw 55/56 bestanden. Onboarding
is nu groen; GRAND faalt bij leverancierslogin met 409. Dit is een nieuwe
waarneming, geen afgesloten volledige PG-kwalificatie
(`/tmp/rtg-r3-pg-repeat.log`). De rolronde bewijst 581 endpoints bij de
ongewijzigde vloer 1444. Alle 23 Lifestyle-fixtures slagen; 19 eerder getelde
routes missen nu toestelbewijs in de strengere testomgeving. De rolmeter
bindt daarom via de bestaande toestelprocedure een eigen sleutel aan ieder
nieuw testlid en tekent ieder verzoek afzonderlijk. Beveiliging blijft
verplicht. Gerichte HTTP- en tegenproeven: 21/21, nul skips
(`/tmp/rtg-r3-role-device.log`); brede hermeting volgt.

De afzonderlijke gluurronde (`/tmp/rtg-r3-idor-repeat.log`, instrument
`scripts/gluurronde.js`) ziet geen toegang van A tot B's herkenbare stukken:
5853 controles, 15582 verzoeken, 31 aangelegde stukken en 26 terugvindbaar.
Dit beperkte GLUURRONDE-bewijs is geen volledige IDOR- of streamkwalificatie.

Vervolg 23 oktober, vanaf `8b4e5c1429`: de rolmeter met echte toestelbinding
meet 600 endpoints (vloer ongewijzigd 1444), 4560 onbekend en geen waargenomen
gaten. Dit is een beperkte rolmeting, geen volledige autorisatiekwalificatie
(`/tmp/rtg-r3-role-device-full.log`, ROLRONDE.json).

RTF-ondertekening verifieert de gezinssessie opnieuw binnen dezelfde bestaande
transactie als Foundation en onboarding. De bronkopie publiceert alleen bij
geslaagde ondertekening; geweigerde invoer publiceert ook geen profielmigratie.
Gerichte HTTP/client-regressies 45/45 en ontvangstproeven 12/12; echte PG-proef
7/7 met identieke retries, inhoudsconflict, rollback, SIGKILL vóór/na commit en
intrekking na routecontrole maar vóór slotverkrijging. Een positieve tegenproef
gebruikt hetzelfde onderbrekingscheckpoint. Logs:
`/tmp/rtg-r3-signature-regression.log`, `/tmp/rtg-r3-signature-snapshot.log`,
`/tmp/rtg-r3-onboarding-race-qualified.log`. De twee voorafgaande mislukte
PG-runs blijven geregistreerd: de demo-bootstrap reset bewust het
eigenaarswachtwoord en verhoogt sessies_vanaf bij nieuwe workers. De fixture
vernieuwt de beheercredential nu uitsluitend na aantoonbare gedeelde
intrekking en eist dat de oude credential 401 geeft. De geteste gezinssessie
wordt niet vervangen. Externe volwassenaccount-intrekking en de omgekeerde
slotvolgorde zijn hiermee niet nieuw bewezen.

De bestaande requestcommit kan afzonderlijke toevoegingen aan securityLog en
supplierActivity nu conflictveilig samenvoegen. Sessie en beide logs blijven
één transactie. Ambigue gelijke inhoud, gewijzigde historie en gelijktijdige
cleanup/toevoegingen blijven conflicten; geen stille deduplicatie. Bestaand
retentiebeleid is één gedeelde policy met compatibele domeinexports, zonder
PG-naar-domeinimport. Gerichte pure regressies en echte PG-proeven bewijzen
disjuncte stale snapshots, ketenbehoud, medewerkersprivacy en rollback na de
sessieschrijfactie. PG 4/4, nul skips (`/tmp/rtg-r3-loginmerge-pg.log`). De
nieuwe proef staat in de bestaande verplichte PG-selectie. Dit bewijst het
onderliggende conflictpatroon, niet de oorspronkelijke collectieoorzaak van
de incidentele GRAND-409. Beide bronpatches zijn onafhankelijk read-only
beoordeeld; reviewers voerden geen eigen runtimeproeven uit.

Aanvullende regressie: 43/43 pure proeven en 21/21 HTTP-login/logboekproeven
(`/tmp/rtg-r3-atomic-regression.log`, `/tmp/rtg-r3-login-regression-fixed.log`).
De eerste HTTP-run had 20/21: de roosterfixture koos de UTC-datum terwijl de
PDA de zaakdatum gebruikt. De test gebruikt nu de serverbevestigde plandatum
en vereist exact die dienst; de terugval naar een willekeurige dienst is
verwijderd. Geen productrecht of retentiegrens veranderd.

Status blijft ORANJE. De volledige PG-selectie, actuele IDOR- en APPWERKT-
bewijzen, twee integrale groene runs en operationele kwalificatie blijven
verplicht. Geen merge of uitrol.

### Deep Green ronde 3 — gerichte afsluiting na meetstand f3e630f421

Op de vaste bronstand f3e630f421 is de volledige PG-selectie uitgevoerd:
56/57 bestanden geslaagd, ticketcodes.pg.test.js faalde (409 in plaats van
200). Geen volledig PG-bewijs afgegeven. Log: /tmp/rtg-r3-pg-qualified.log.
De eerder falende onboarding- en GRAND-proeven slagen in deze run (7 en 11).

De rollenhermeting is expliciet volledig uitgevoerd met --max=20000:
4514 routes, 9369 pogingen, nul verkeerde-roltoegang, privacylekken,
onbevoegde persistente wijzigingen of onbesliste uitkomsten. De eerdere
standaardrun met budget 600 is geen volledige kwalificatie. Bewijs:
ROLPROEF.json en /tmp/rtg-r3-roleproof-qualified.log. IDOR.json bevat de
actuele objectproeven, inclusief onbereikbare en publieke routes; geen
waargenomen lek is geen bewijs voor de onbereikbare routes. BEVOEGD.json
blijft 10 BEWEZEN / 104 NIET_GETEST. Dit zijn bevoegdheidsbewijzen, niet
114 volledig gekwalificeerde apps. Logs: /tmp/rtg-r3-idor-qualified.log en
/tmp/rtg-r3-authority-qualified.log. De geheimcanary slaagde met de juiste
Redis-binary in PATH: 5/5, /tmp/rtg-r3-secret-canary.log.

De ticketfixture gebruikte de UTC-dag terwijl de productcode de huiszone
Amsterdam controleert. Hersteld met één vaste geïnjecteerde klok voor beide
instances, expliciete lokale ticketdag en een negatieve gisterenproef.
De PG-proef krijgt via de bestaande helper een eigen wegwerpdatabase.
Geen productcode of toegangsgrens gewijzigd. Gerichte ticketproeven: 11/11,
nul skips, /tmp/rtg-r3-ticket-clock.log. Dit vervangt geen volledige PG-run.

Een gerichte selectie van elf eerder falende testbestanden leverde met
lokale servertoegang 90/94 op. De sandboxrun had daarnaast vijftien
listen-EPERM-hookfailures: infrastructuurfouten, geen productbevindingen.
Vier resterende fouten kwamen uit twee verouderde afgeleide registers en
één ontbrekende credentialclassificatie met twee bewakingstests. De bestaande
onboarding/teken-consumer is na broninspectie gekoppeld aan de bestaande
gezinstoken-deur, met verwijzing naar de PG-intrekkingsproef. Geen control
versoepeld en geen nieuwe credentialfamilie gemaakt. CAPABILITEIT en
LOOP-FABRIC-COVERAGE zijn opnieuw uit hun bestaande generators afgeleid;
de laatste blijft statische vindbaarheid, geen operationeel ketenbewijs.
Herhaling van dezelfde selectie: 94/94, nul skips of failures, log
/tmp/rtg-r3-remaining-regressions-fixed.log (Node 26.12.0).

Status ORANJE. Open blijven onder meer 104 ontbrekende bevoegdheidsbewijzen,
architectuurnormen, actuele integrale APPWERKT-kwalificatie, twee volledige
kwalificatieruns en operationeel herstel/staging. Geen merge of uitrol.

Vervolg op kandidaat e1544ee50f: volledige verplichte PostgreSQL-selectie
GESLAAGD, 57/57 bestanden, nul failures/skips, met eigen databases en lokale
Redis. Log /tmp/rtg-r3-pg-e1544ee.log; machinebewijs .release/pg-bewijs.json.
Dit is één databasekwalificatie, niet twee integrale platformruns. Onafhankelijke
read-only review van ticketfixture en credentialregistratie vond geen blocker;
de reviewer heeft geen eigen runtimekwalificatie uitgevoerd.

De volledige normmeting op dezelfde stand blijft ROOD: keuringScheef 11/10,
keuringOmvang 357/350, keuringTeGroot 9/8, keuringDubbeling 186/184,
dbDeuren 467/464, kernGedeeld 262/260 en toetsenNietGemeten 197/142.
Log /tmp/rtg-r3-norm-e1544ee-local.log. De eerste sandboxpoging kon geen
routekaart meten en telt niet als normuitkomst. De extra serveromvang zit
in foundation/gezinshulp.js (10360 bytes); geen commentaarstrip of normverlaging
om deze bevinding weg te rekenen. Platformstatus blijft ORANJE.

### Deep Green — eigenaarsgrenzen en Snaps-bewijs (23 oktober)

Drie directe opslagtoegangen in Clips/festival lopen via de bestaande
collectie-eigenaar: deurenmeting 467 naar 464, norm 464. Bestaande
collectietransacties blijven intact. De nieuwe interne festivallezer wordt
expliciet buiten de publieke kern-API gehouden. Media/festivalregressies
88/88; extra publieke-grenscontrole en festivalreeks 59/59. Corruptieweigering
van de losse Clips-lezer is geen nieuwe claim over de initialiserende fabriek.
PIN-hulpfuncties zijn inhoudelijk ongewijzigd uit gezinshulp naar gezinspin
verplaatst (10360 naar 9782 bytes), met dezelfde publieke exports en bestaande
hashcompatibiliteit. Pure compatibiliteitsproeven 23/23; gezins- en
bevoegdheidsregressies 25/25. Onafhankelijke review vond na API-correctie geen
blocker. Logs: /tmp/rtg-r3-owner-regression-local.log,
/tmp/rtg-r3-festival-boundary.log, /tmp/rtg-gezinspin-extract.log,
/tmp/rtg-r3-family-snaps-regression.log.

Snaps heeft een echte geïsoleerde HTTP/SQLite-proef met twee bevriende
accounts, een derde account en anonieme verzoeken. Positieve eigen controles,
verschillende foto-inhoud, volledige antwoordvorm, persistent snap/media-
verloop, sessie-identiteit en eenmalig openen worden gecontroleerd. Bestaand
negatief IDOR-bewijs wordt niet overschreven. Review vond aanvankelijk gaten
in payloadcontrole, verschillende fotofixtures en samenvoegen; die zijn
hersteld met tegenproeven. Herbeoordeling akkoord binnen deze beperkte scope;
18/18 gerichte proeven slagen (/tmp/rtg-r3-snaps-reviewed.log). Dit is geen
PostgreSQL-, crash- of productievrijgavebewijs. Appstatus volgt pas uit een
actuele geïntegreerde hermeting; geen handmatige groenverklaring.

De drie nieuwe tests zijn via de bestaande mutatiemotor op ingebouwde fouten
gezakt en dus aantoonbaar gevoelig. Bron is daarna hersteld, motor exit 0.
Log /tmp/rtg-r3-new-mutations.log. Dit bewijst niet dat iedere mogelijke fout
wordt ontdekt. Taalhermeting 27/27 geslaagd, expliciete beperkingen voor 114
talen behouden. CI op f79f081b56 faalde in preflight op verouderde afgeleide
artefacten; de betreffende generators zijn opnieuw uitgevoerd, niet de
kwaliteitsdrempels aangepast. Logs /tmp/rtg-r3-ci-f79-failed.log,
/tmp/rtg-r3-refresh-local.log en /tmp/rtg-r3-language-refresh.log.

Hermeting op b0733baac0: IDOR bevat nu voor alle drie Snaps-routes de
gekwalificeerde HTTP/SQLite-proef. De volledige rollenronde herhaalt
4514 routes / 9369 pogingen, nul verkeerde-roltoegang, lekken, persistente
onbevoegde wijzigingen of onbeslist bewijs. De bevoegdronde stijgt aantoonbaar
van 10 naar 11 BEWEZEN; 103 blijven NIET_GETEST. Dit is uitsluitend de dimensie
bevoegd, niet 11 apps met alle acht actuele bewijzen. Logs:
/tmp/rtg-r3-idor-b073.log, /tmp/rtg-r3-role-b073.log en
/tmp/rtg-r3-authority-b073.log. De bestaande harde preflight is lokaal groen
(/tmp/rtg-r3-check-b073.log); hij meldt tegelijk 900 verlopen APPWERKT-bewijzen.
Die melding is niet opgelost of genegeerd. Geen integrale vrijgaveclaim.

Volgende gedeelde oorzaken: de Foundation-desktop vraagt voor ouderprofielen
standaard een uitsluitend voor kinderen bevoegde leerlingwidget op (correcte
server-403). Bord/Schrift vereisen bovendien hun eigen schoolpersona's; een
widgetcorrectie kwalificeert die niet. Gegevens-start/zeg ontbreekt als
sessiegebonden isolatiebewijs bij 13 apps; die apps hebben ook andere open
routes. Beide pakketten worden binnen bestaande infrastructuur voorbereid.

23 oktober 2026 — Gedeelde widgetoorzaak hersteld: automatische leerlingpreview
alleen voor het passende bevestigde kindprofiel. Catalogus en handmatig gekozen
apps blijven bestaan; de serverpoort blijft ongewijzigd. De bestaande runtime-
sessiecontrole beschermt nu ook member-cacheantwoorden. Profielwissel en destroy
maken oude callbacks ongeldig; een oude finally kan geen nieuw verzoek wissen.
Gerichte Node 26-kwalificatie: 21/21, nul skips, inclusief echte browserwissel
ouder → kind → ouder, ouder-HTTP403, kind-HTTP200 en oorspronkelijke identity/
state-regressies. Log /tmp/rtg-r3-widget-complete.log. Onafhankelijke review van
het familiepad vond geen blocker; root beoordeelde de aanvullende memberguard.
Mutatieproef detecteert verwijderd browserexport (1/1); dit is beperkte
gevoeligheidsmeting, geen bewijs voor iedere mogelijke race. Log
/tmp/rtg-r3-widget-mutation.log. Geen APPWERKT-herkwalificatie geclaimd.

Diagnostische normmeting tijdens deze ongecommitteerde werkstand:
/tmp/rtg-r3-norm-current.log. Directe opslagdeuren vallen weer binnen 464 en
de te-grote-bestandengrens is hersteld. Nog rood: omvang 358/350, dubbeling
186/184, gedeelde kern 262/260, ongemeten mutatietoetsen 198/142 en drie
registers uit een vuile bronboom. Dit is geen kandidaatkwalificatie; registers
moeten na bronbevriezing opnieuw worden gemeten, niet handmatig groen gezet.

23 oktober — Gegevens-start/zeg krijgt een concrete telefoonflow-proef via de
bestaande IDOR- en bevoegdronde. Twee echt geregistreerde toestelgebonden
accounts: eigen gesprek, vervalste body-identiteit, wederzijdse overname vóór
afronding geweigerd, anoniem geweigerd, uitsluitend eigen kluisrij veranderd,
eigen identiteit en telefoon na herstart bevestigd. Alle users-kolommen worden
gehasht gecontroleerd; afwijkende antwoordstructuren en bestaande negatieve
bevindingen blijven blokkerend. Geen algemene adres/document/concurrencyclaim.
De eerste fixture miste het verplichte toestelbewijs; gecorrigeerd via de
bestaande binding en ondertekening, zonder serveruitzondering.

Onafhankelijke review vond geërfde opslagconfiguratie in de wegwerpwereld.
Gegevens- en Snaps-proeven kiezen nu expliciet lokale SQLite/disk en wissen
externe opslagconfiguratie. Tegenproeven erven opzettelijk onbereikbare
PG/Redis/S3-loopbackadressen en moeten nog steeds alle controles voltooien.
Gerichte eindrun: 24/24, nul skips, inclusief bestaande gegevenspoort en
bevoegd-consument. Log /tmp/rtg-r3-isolation-final.log. Geen echte betalingen,
productiegebruik, merge of uitrol. Nieuwe appaantallen vereisen hermeting.

Bounded normreview: de twee extra gedeelde namen projectieKoppel/projectieStand
komen uit expliciete doorgifte van spellen.js naar child-router spelprojectie.js;
de meter ziet aparte bestandsdomeinen. De extra namen grootboek (read-only
banklezer) en bereidVoor (contractvoorbereiding) hebben andere semantiek dan
hun naamgenoten. Geen veilige consolidatie aangetoond. Niet hernoemd of
verplaatst om aantallen te verlagen; deze normblokkades blijven open voor een
inhoudelijk onderbouwde oplossing, met ongewijzigde drempels.

Hermeting d8e1a45c21: de volledige rolproef herhaalt 4514 routes/9369 pogingen
zonder waargenomen verkeerde-roltoegang, lek, persistente onbevoegde wijziging
of onbesliste uitkomst. Gegevensroutes en Snaps staan nu in IDOR met hun ruwe
beperkte bewijs. Preflight groen na genereren van FUNCTIES.md; taalproeven
27/27. De drie vuile registerstempels zijn met echte hermetingen op de schone
bronstand hersteld. Norm blijft rood op vier grenzen: omvang 358/350,
dubbeling 186/184, gedeelde kern 262/260, ongemeten mutatietoetsen 197/142.
Logs /tmp/rtg-r3-role-d8e1.log, /tmp/rtg-r3-idor-d8e1.log,
/tmp/rtg-r3-check-d8e1-final.log, /tmp/rtg-r3-language-d8e1.log en
/tmp/rtg-r3-norm-d8e1.log. Nieuwe gegevensmutatie gedetecteerd; ongewijzigde
eerdere mutatieresultaten door bestaande motor hergebruikt.

De bevoegdronde meldde aanvankelijk 14 BEWEZEN. Deze uitkomst is inhoudelijk
afgekeurd: Bord/Schrift hadden alleen vier Foundation-schilroutes geraakt,
geen schoolobjecten of lessleutels. De bestaande appcontracten benoemen nu
expliciet de aanvullende docent-/leerlingcontext; gezinsbewijs kan die niet
meer als volledig kwalificeren. Concrete lekken blijven vóór dit ontbrekende
bewijs defect. 16/16 gerichte metertests slagen. Nieuwe runtimehermeting vereist;
de 14 mag niet als voortgang worden gebruikt. Zorg heeft wel vier geldige
gezinskruisparen; ook dat is uitsluitend bevoegdheid binnen de meetgrens.

De echte gecorrigeerde bevoegdronde op 0c4b12e4d7 levert 12 BEWEZEN en 102
NIET_GETEST. Bord/Schrift blijven open wegens de aanvullende schoolcontext;
Zorg is nieuw bevoegd binnen vier bestaande laad-kruisparen. IDOR/ROLPROEF
blijven volgens de bestaande bronafhankelijkheidscontrole geldig; geen nieuw
stempel zonder meting. Log /tmp/rtg-r3-authority-0c4b.log. De schoolguard is
onafhankelijk gelezen en zonder nieuwe blocker beoordeeld.

Volledige APPWERKT-browserhermeting gestart maar onderbroken vóór vastlegging:
een controle van de afhankelijkheden toont dat VOLTOOIPROEF (877e0459b6) en
LIEGRONDE (4ea4825c71) door gedeelde serverwijzigingen vervallen zijn. Eerst
die bestaande volledige bronmetingen vernieuwen, daarna APPWERKT samenstellen.
De onderbroken ronde /tmp/rtg-r3-appwerkt-0c4b.log is GEEN kwalificatieresultaat.
Lopende bronmetingen: /tmp/rtg-r3-completion-0c4b.log en
/tmp/rtg-r3-truth-0c4b.log; resultaat blijft open totdat deze werkelijk eindigen.

23 oktober — CI op 1053f97f3f blokkeerde op de achtergelopen BEWIJS-generator
(schoolguard kreeg een extra test) en vier gebouwde shellbestanden die
kwalificatie --uit-image niet terughaalde. De bestaande overdracht neemt nu
uitsluitend die vier expliciete buildoutputs mee; vóór vervanging moet lokale
inhoud HEAD of exact het image zijn. Serverdrift, ontbrekende imagebytes,
afwijzende commitcontrole en wijzigingen na de voorcontrole blijven rood.
29/29 gerichte kwalificatie-/ketentests, nul skips; onafhankelijke codereview
zonder blocker. Log /tmp/rtg-r3-image-transfer-final.log. Docker/Git zijn in de
nieuwe overdrachtfixture gesimuleerd, files en bytekwalificatie echt. Echte
Dockerkwalificatie moet CI nog bevestigen (lokaal geen Docker). Geen merge of
uitrol. De lopende voltooiproef leest dit kwalificatiescript niet; productbron
blijft ongewijzigd. LIEGRONDE wordt na deze scriptcommit opnieuw vernieuwd,
omdat haar afhankelijkheidssluiting niet volledig kan worden vastgesteld.

Hermeting na overdrachtsfix f17f3bc530: de echte GitHub Dockerkwalificatie
(bouw en byte-voorcontrole) slaagt, run 39877119961. Lokale preflight slaagt
na de bestaande FUNCTIES-/ARCHITECTUUR-generatie. De oorspronkelijke
shelloverdrachtsfout is als expliciete bronmutatie teruggebracht en door de
nieuwe regressieproef gedetecteerd; baseline en herstel groen, bewijs in
/tmp/rtg-r3-image-mutant-proof. Geen vrijstelling in de bytecontrole.
LIEGRONDE blijft 109 BEWEZEN/5 NIET_GETEST en BEVOEGD blijft 12/102, beide
op f17f3bc530 herhaald; geen stijging geclaimd door alleen registervernieuwing.
Logs /tmp/rtg-r3-check-f17-final.log, /tmp/rtg-r3-truth-f17.log en
/tmp/rtg-r3-authority-f17.log. De integrale apphermeting volgt nog na afloop
van VOLTOOIPROEF. Platform blijft ORANJE.

### Deep Green — actuele appmeting en gerichte CI-afsluiting (23 oktober)

De volledige VOLTOOIPROEF is zonder open scenario's afgerond: 110 apps met
330 gesloten bewijsschakels en nul open of onbewezen schakels. De vier
overige catalogusregels hebben geen voltooifixture en blijven daarom zichtbaar
als `GEEN_FIXTURE`; ze worden niet administratief groen gemaakt. De volledige
PostgreSQL-runner slaagt op dezelfde afbouwstand met **57/57 bestanden en 169
proeven**, zonder failures of skips. Logbestanden:
`/tmp/rtg-r3-completion-0c4b.log` en `/tmp/rtg-r3-pg-28bc.log`.

APPWERKT is daarna volledig herbouwd op `28bc8ef749`: **11/114 BEWEZEN,
99 NIET_GETEST en 4 GEEN_FIXTURE**, met nul gemeten browserdefecten. Zorg is de
nieuwe volledig bewezen app. Per bewijsdimensie: bereikbaar 107/114,
bedienbaar 95/114, menselijk 110/114, voltooibaar 110/114,
waarheidsgetrouw 109/114, persistent 110/114, bevoegd 12/114 en herstelbaar
110/114. Dit is een bronmeting, geen releaseoordeel. De vijf open
waarheidsgetrouwheidsregels zijn ingebedde OS-standen zonder zelfstandige
meetbare contractingang; de grootste kwalificatieachterstand blijft bevoegd
met 102 open apps. Log: `/tmp/rtg-r3-appwerkt-28bc.log`.

CI op `28bc8ef749` bevestigde preflight, lokale imagekwalificatie, CodeQL,
WebKit en de brede schermweergave, maar bracht ook concrete downstream-
regressies aan het licht. Die zijn bij de contractbron hersteld:

- `bevoegdContext` is begrensde appcontractmetadata en kan geen negende bewijs
  of uitslag worden; onbekende waarden sluiten.
- `actueleOnboarding` ververst alleen Foundation-opslag en geldt niet als
  identiteits- of autorisatiebewaker; de echte handlerpoort blijft leidend.
- Move houdt de chronologische eerstvolgende bestemming vast en beproeft een
  charter-luchthaven in een afzonderlijke reis, zonder een eerdere afspraak
  over te slaan.
- De horeca-PDA-proef schuift aan via het bestaande verplichte gratis account;
  anoniem aanschuiven blijft 401. De desktop-widgetproef herkent de retry via
  dezelfde locale-copybron die de knop tekent.
- De Foundation-melder op het lichte redactionele vlak gebruikt de bestaande
  leesbare Heritage-inktkleur; service-workerafdrukken zijn opnieuw opgebouwd.

Gerichte verificatie op Node 26.12.0: **95/95** contract-, register- en
generatorproeven, **15/15** gecombineerde horeca-PDA/wereld-desktop-
browserproeven, en **7/7** Move Design System-browserproeven. De volledige
statische preflight is groen; zij meldt terecht dat APPWERKT-bewijs door de
latere bronwijzigingen opnieuw vervalt en dus vóór kandidaatkwalificatie moet
worden herhaald. Geen kwaliteitsdrempel of autorisatiepoort is verlaagd.

De laatste drie schermscherfoorzaken zijn daarna bij hun contract gesloten.
De zelfstandige appdeur neemt een reeds aanwezige RTG- of gezinssessie mee
naar de beveiligde app-gids; zonder sessie blijft alleen de lokale titel en
toegangsweg zichtbaar. Acht kantoorapps lekken daardoor geen gidsinhoud en
houden hun terugkeerroute. De Foundation-livelesproef maakt een les via het
verplichte gratis account en houdt de gezins- en accountsleutels gescheiden.
Het handlerpoortregister benoemt `/api/foundation/les/maak` weer waarheidsgetrouw
als `AUTHENTICATED`. De gerichte deur-/lesstroomrun slaagt 4/4 en de relevante
contract- en autorisatieproeven slagen 53/53. Toegankelijkheidsmeting deel 3
meet 79 schermen met nul structurele en nul kwalificerende contrastfouten; de
afzonderlijke blinde-assenronde meldt vier notch-contrastsituaties als
werkvoorraad en telt die niet stilzwijgend als gekwalificeerd bewijs.
De volledige gewijzigde browserset is aansluitend samen herhaald: **28/28**
geslaagd, zonder skips (deur, kantoor, lesstroom, horeca-PDA, wereld-desktop en
beide Move-ronden).

Status blijft **ORANJE**. Open blijven de 102 appbevoegdheidsbewijzen, vier
voltooifixtures, vijf zelfstandige waarheidsgetrouwheidsingangen, vier rode
architectuurnormen, de adversarial rolvloer, twee volledige kandidaat-runs en
operationele staging-, herstel- en vrijgavekwalificatie. Geen merge of uitrol.
