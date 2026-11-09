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

### Definitieve afbouw — vier browsercontracten en broncoherentie (30 oktober)

De eigenaarsopdracht omvat het volledige Deep Green- en Experience-plan:
APPWERKT, Experience Signatures en schermen, consolidatie van de bestaande
Design System-/Heritage-/Cinematic-uitvoering, Edge/Rahul/Spotlight, eigen
wereld- en appidentiteit, gecontroleerde verwijdering van legacy-stijlen,
toegankelijkheid, prestaties, veiligheid, menselijke en operationele proeven
en twee onafhankelijke eindruns op één kandidaat. Geen nieuw parallel register
of platform; productie blijft ongewijzigd zonder afzonderlijke vrijgave.

**Nulmeting, niet herhaald bewijs:** het opgeslagen APPWERKT-resultaat van
30 oktober 07:06 UTC op `336d8b60f5`, Node 26.12.1, meldde 110/114 volledig
bewezen apps en vier ontbrekende fixtures. De huidige reparaties vertrekken
van `2fa713559727e15b4743f8e837a9580050290140`. Wijzigingen aan meetinstrument
en gedeelde browserbron maken betrokken oud bewijs ongeldig. Daarom wordt
114/114 niet uit vier losse groene tests afgeleid.

De vier ontbrekende taken gebruiken nu het browserkanaal van de BESTAANDE
VOLTOOIPROEF en dezelfde APPWERKT-bronbinding:

- Juridisch: documenten openen, inhoud lezen en terugkeren, ook na herladen,
  nette serverherstart en crash. Geen kunstmatige mutatie van openbare tekst.
- Camera: echte browserframes met synthetische camerabron, lokale JPEG-export
  en decodevergelijking, export na nieuw browsercontext en serverherstel,
  annulering, geweigerde toestemming en een herstelbare camerafout. Geen claim
  over fysieke camera's of onbeproefde externe overdrachtsvormen.
- RTFoundation-keuze: vijf leeftijdscontexten via de canonieke RTG-ingang,
  zichtbare bediening, terug/vooruit, bewaarde keuze, herstart en crash.
- Videobellen: twee afzonderlijke leden via Rahul en Edge, voortlopende
  gedecodeerde video EN ontvangen audio in beide richtingen, dezelfde peer na
  signalingherstart/-crash, gesloten verbindingen en tracks na ophangen,
  geen herleving na herladen en een bewust nieuw gesprek. Synthetische media
  bewijzen geen fysieke microfoon, luidspreker, TURN of echt mobiel apparaat.

De browserbinding weigert verkeerde ingangen, ontbrekende bestemmingen of
zichtbare toestanden, paginafouten, te weinig schakels, tegenstrijdige tellingen
en niet-uitgevoerde herstelproeven. De runner stopt de afhankelijke keten bij
de eerste mislukte stap en bewaart die oorspronkelijke fout. Browserversie,
Node-versie en platform worden vastgelegd. Door onvolledig aantoonbare
dynamische afhankelijkheden blijft de bronafdruk voorlopig conservatief breed;
dit is geen claim van voltooide fijnmazige bewijsvernieuwing.

De RTFoundation-proef ontdekte een productfout in de bestaande Heritage-
overgang: `pageswap` probeerde een ontbrekend of ongeldig doeladres te lezen.
De animatie wordt nu alleen in die situatie overgeslagen; echte navigatie
blijft functioneren. Gerichte historie-, normale, geannuleerde en reduced-
motion-proeven bewaken dit. De Experience-inventaris koppelt een query-ingang
aan het fysieke document en behoudt query en fragment in de eigen appcontext.

**Gericht uitgevoerd op de werkstand, geen kandidaatkwalificatie:**
129/129 contract-/bewijs-/lifecycle-/Heritage-unittests, RTFoundation 1/1,
Heritage-browser 3/3, Videobellen met audio 1/1 en bundelbrowserregressies
13/13, zonder skips. Camera- en Juridisch-taken en de negatieve bel-/Clips-
proeven slaagden eveneens gericht. Bewijslogboeken:
`/tmp/rtg-completion-contract-final.log`, `/tmp/rtg-rtf-repaired.log`,
`/tmp/rtg-heritage-history-browser.log`, `/tmp/rtg-video-audio-final.log`,
`/tmp/rtg-bundle-browser-final.log` en `/tmp/rtg-four-completion.log`.
Het laatste log bevat ook de oorspronkelijke twee failures; de gerichte
herstelruns vervangen die niet stilzwijgend in de auditgeschiedenis.

De preflight vond vier reeds in HEAD aanwezige bundelproblemen. De bestaande
generator herstelt de verouderde app-main-uitvoer uit de nieuwere Zorg-bron;
drie te grote bronstukken zijn langs bestaande verantwoordelijkheden gesplitst.
Zakelijk- en Uitvoer-browserbundels bleven byte-identiek. Geen nieuwe dependency,
controller, stijlarchitectuur of normuitzondering. De vervangen monolithische
bronstukken zijn opgedeeld, niet als parallelle implementatie behouden.

**Restlijst blijft blokkerend:** volledige actuele VOLTOOIPROEF/APPWERKT-
samenstelling; Experience-contracten en 286 gerapporteerde schermmigraties
(nog actueel te bevestigen); echte Experience-artefactvalidatie en complete
bronafdruk; menselijke beoordelingen; kritieke financiële/autoriteitsketens;
PWA, echte apparaten, staging, monitoring, back-upherstel, rollback en twee
onafhankelijke eindruns. De Experience-nulstand blijft 0/114 apps, 0/316
schermen en 0/3.368 dimensiecellen. Die 3.368 zijn GEEN individuele
proefvoorwaarden: het bestaande register bevat 53.206 vereiste combinaties
vóór app-specifieke interacties. De oude vergelijking met 3.368 uitgevoerde
tests mag dus geen voltooiingsclaim worden.

Onafhankelijke bronreview vond dat de Experience-coveragelezer nog losse
artefactnamen accepteert en DS-stijlen/beeldassets niet volledig hasht.
Die gaten worden binnen de bestaande motor gesloten vóór bewijzen worden
gevuld. Ontbrekende menselijke en externe controles blijven expliciet open;
een AI-beoordeling sluit die niet. Status: **ORANJE, geen vrijgave**.

Afsluitcontrole van hetzelfde werkpakket: de vier browsercontracten sluiten nu
ook via `scripts/voltooiproef.js --alleen=...`, met herstartepoch per stap. De
onafhankelijke review vond dat RTF de na-herstartcontroles ten onrechte onder
herstelbaar boekte. Dat is gecorrigeerd én de gedeelde browserpoort vereist nu
een werkelijk geslaagde controle ná de relevante herstart/crash. De logs
`/tmp/rtg-browser-contract-{juridisch,camera,rtfoundation-keuze,videobellen}.log`
zijn gerichte werkstandmetingen; ze schrijven geen gedeeltelijk register.

De Experience-bewijslezer controleert nu echte artefactbytes, hashes,
configuratie, kandidaat, proeflog en exact gebonden waarnemingsdiagnostic.
Afbeeldingen, fonts, SVG, DS-CSS en gedeelde scripts vallen onder dezelfde
conservatieve bronhash. Tegenstrijdige dubbele bewijsrecords worden geweigerd.
De kandidaatpoort weigert ongecommitte Experience-invoer. Een integer lokaal
artefact betekent echter uitsluitend `VALID` voor inhoudscontrole: het krijgt
nog steeds `BLOCKED` voor kwalificatie zolang de koppeling aan de bestaande
vertrouwde bewijsuitvoering en getypepte apparaat-/methodevoorwaarden ontbreekt.
Menselijke zelfdeclaraties blijven eveneens geblokkeerd. Dit pakket bouwt
geen tweede bewijsmotor en claimt geen ervaringskwalificatie.

PR #702 is afzonderlijk alleen gelezen: nog open op
`8da28119e7bad72ed43dc93362d41468349d3809`, alle teruggegeven controles afgerond
met succes of expliciet overgeslagen. Dit is de bestaande Experience-branch,
niet de huidige `codex/deep-green-unified`-werkstand. Geen merge, push of
productie-uitrol uitgevoerd als onderdeel van deze controle.

De gezamenlijke afsluitset op Node 26.12.1 slaagt **191/191**, zonder failures
of skips (`/tmp/rtg-afbouw-source-final.log`). De bestaande preflight sluit
zonder fouten na herleiding van de bestaande kaarten, taalbewijzen en echte
websitebeelden (`/tmp/rtg-fixture-preflight-closed.log`). Haar waarschuwing over
318 vervallen APPWERKT-bewijzen blijft zichtbaar; dat is reden voor actuele
samenstelling op de vastgelegde bron, geen reden om de waarschuwing uit te zetten.

De aansluitende read-only DS-inventaris bevestigt **30/316** DS-routes. De
286 overige routes zijn **268 interfaces plus 18 redirects**; redirects worden
gekwalificeerd op overdracht, niet kunstmatig opnieuw vormgegeven. Er zijn
zeven bestaande schermpatronen en 21 gedeelde DS-componenten. Hotels is al een
gemigreerde referentie. RTDocs en Magnaat laden nog eigen stijlbronnen en
voorzijdes die de oude app verbergen en extra vaste navigatie tekenen. De
volgende echte consolidatie moet zo'n volledige route omvatten en vervangen
stijlcode verwijderen; alleen de voorzijde mooier maken voldoet niet. Er zijn
nog geen Experience Signatures of menselijke kwalificaties ingevuld.

#### Actuele deelkwalificatie op `39f5705b6e` (30 oktober)

De broncode blijft gedurende de voltooiingsmeting vast. De bestaande registers
worden opnieuw door hun eigen instrumenten geschreven; oude uitslagen worden
niet administratief opgewaardeerd. Node: **26.12.1**, lokale wegwerpservers,
synthetische accounts. Dit is nog geen bevroren vrijgavekandidaat.

- `ROLPROEF.json`: **4.514 routes, 9.369 pogingen**, nul open ACL's,
  privacylekken, onbesliste resultaten of blijvende wijzigingen. De 92 niet te
  kruisen en 836 niet beproefbare routes vallen niet onder dit bewijs.
- `IDOR.json`: geen nieuwe doorbraak of lek en geen verlies van eerder bewezen
  routestatus. De hoofdgang houdt **898 onbereikbare gevallen** en twee bekende
  fixture-409's zichtbaar. Gangtellingen mogen niet als volledige objectdekking
  worden gepresenteerd; financiële routes vragen hun eigen bereikbare proeven.
- Een andere agent vergeleek beide nieuwe registers onafhankelijk met de
  HEAD-versies, rekende alle rolrijen opnieuw na en controleerde bronversheid.
  Geen nieuwe regressie in die vergelijking; geen platformbrede groenverklaring.
- De bestaande `directpay-workers.pg.test.js` en
  `office-bank-open-workers.pg.test.js` slagen samen **10/10**, nul skips.
  Twee werkelijke workers, een eigen tijdelijke PostgreSQL 16-cluster op
  loopback, synthetisch geld, retries, conflicterende inhoud en procescrashes
  rond de commit. De cluster is na afloop gestopt. Geen productiegegevens,
  echte betaling, externe betaalrail of productiecapaciteit beproefd.

Logs: `/tmp/rtg-role-39f5705.log`, `/tmp/rtg-idor-39f5705.log` en
`/tmp/rtg-financial-workers-39f5705.log`. Tijdelijke logs zijn lokale
bewijsbronnen en vervangen geen overdraagbaar einddossier op de definitieve
kandidaat. De operationele vrijgavepoort meldt op deze commit **ONBEWEZEN**:
de volledige suite, schermsuite, releasepoort en stagingrepetitie zijn hier
nog niet integraal gekwalificeerd.

De read-only Hotels-contractvoorbereiding vond een belangrijke inventarisgrens:
`/apps/hotels.html` is een zelfstandig Travel-scherm met eigenaar
`verblijf.hotel`, maar de logische MAPPEN-functie Verblijven verwijst naar
`/apps/residentie.html`. De 67 Residence-interacties zijn geen Hotels-bewijs.
Een Hotels-schermsignature mag worden gedeclareerd; een appsignature mag geen
app-ID verzinnen, Residence overschrijven of diens bewijs lenen. Dit is geen
aanleiding om de afgesproken appcatalogus stilzwijgend uit te breiden.

De volledige `VOLTOOIPROEF` is vervolgens ononderbroken afgerond op dezelfde
broncommit: **114 scenario's, 342/342 taak-/opslag-/herstelbewijzen gesloten,
114/114 antwoord- of schermstapbewijzen menselijk**, nul open. De expliciete
vreemde-actorproeven sluiten voor 107 scenario's; zeven hebben die niet en
vragen de afzonderlijke bevoegdheidsbron. Dit is geen menselijke Experience-
beoordeling en nog geen APPWERKT-8/8-totaal. Het volledige log staat in
`/tmp/rtg-completion-39f5705.log`; het bestaande `VOLTOOIPROEF.json` bevat de
stappen en meetstempel.

De aansluitende waarheidsronde vond 112 bewezen ingangen en twee niet gemeten
querycontracten. Eén meetoorzaak: de observer verwijderde `?pas=rtg` uit de
landing terwijl het verwachte contract deze query behield. De kleine correctie
bewaart een expliciet gecontracteerde query, laat fysieke document-/tabcontracten
intact en weigert een vreemde origin. Verkeerde, ontbrekende, extra of dubbele
pasparameters krijgen geen passend bewijs. De bestaande beslisregel is niet
versoepeld. **27/27** liegronde- en appcontracttests slagen zonder skips
(`/tmp/rtg-truth-query-contract.log`). Het oude waarheidsresultaat wordt niet
handmatig opgewaardeerd: het geraakte instrument moet opnieuw meten. Deze
wijziging raakt de eerder gemeten voltooiings-, rol- en objectproeven niet.

#### APPWERKT-samenstelling op `0afc8afa15` (30 oktober)

De ononderbroken lokale browserronde is afgerond: **112/114** rijen met alle
acht bewijzen, **1.960/1.960** geïnventariseerde knoppen aangeraakt, nul niet
klikbare knoppen. De twee resterende defectoordelen zijn van de meter: voor
RTFoundation en Videobellen wordt `/apps/app.html?pas=rtg` ten onrechte als
letterlijke bestandsnaam gecontroleerd. Hun daadwerkelijke query-ingang en
bronbinding moeten behouden blijven; alleen de fysieke bestandscontrole moet
het documentpad gebruiken. De volledige uitslag blijft bewaard, zonder de twee
rijen handmatig groen te maken. Log: `/tmp/rtg-appwerkt-0afc8afa.log`.

De nieuwe LIEGRONDE sluit **114/114** binnen de lege-antwoordproef. BEVOEGD
sluit **114/114** binnen de eigen appcontracten. Onafhankelijke herafleiding
bevestigt de bronhashes en scenarioaansluiting. De verdeling is 99 expliciete
workflow-/tegenactorscenario's, drie routeprojecties, negen gezinsapps met
19 gescheiden ruwe paren, één cameraproef en twee statische/lokale contracten.
De open brede routeprojecties van die 99 scenario's worden daarmee niet
volledig gekwalificeerd. Lege-backendgedrag is evenmin bewijs van semantisch
juiste antwoorden gedurende alle bedrijfsprocessen.

Een reparatie aan de gedeelde APPWERKT-meter laat bestaande browserbewijzen
volgens hun huidige bronhashes vervallen. Eerst worden de twee geraakte
ingangen gericht getoetst. De oude 112 resultaten krijgen geen nieuwe
meetcommit. Een nieuwe integrale browserafleiding wordt pas op een volgende
stabiele meetstand uitgevoerd; de overige platform- en Experience-poorten
blijven afzonderlijk open. De twee onafhankelijke volledige eindruns zijn nog
niet gestart.

#### Gerichte Experience-uitvoering — Hotels (30 oktober)

De bestaande Experience-subprocessuitvoering is hergebruikt voor één getypeerd
bestemmingsbewijs: Hotels, aangemeld RTG-lid, normale toestand, Chromium op
390 × 844. De runner controleert de werkelijke bestemming, zichtbare en niet
bedekte kop, collectie, ingelogde eigenaar, documentantwoorden en browserfouten.
Een geldige uitvoering kan uitsluitend `PROVEN_IN_SCOPE` opleveren; de volledige
bestemmingsvoorwaarde blijft geblokkeerd zolang andere verplichte configuraties
ontbreken. Import van lokale artefacten levert geen nieuw uitvoeringsgezag op.
Menselijke kwaliteit blijft expliciet onbewezen.

De Hotels-signatuur benoemt bestaande handelingen en aanvullende toestanden;
die declaratie is geen kwalificatie. Hotels en de logische app Verblijven
(`/apps/residentie.html`) krijgen geen bewijs van elkaar. De uitgebreide
Edge-inhoud en volledigheid van dynamische bediening blijven te controleren.
De eerste 63 gerichte artefact-, dekkings- en uitvoeringscontroles slagen lokaal;
de oorspronkelijke registeractualiteitsfout is door herafleiding opgelost,
zonder een bewijsstatus op te waarderen. De echte browseruitvoering volgt pas
op een schone vastgelegde codeversie.

Scopeprecisering APPWERKT: 1.960 aangeraakte knoppen zijn de aangetroffen
bediening van de 112 bezochte apps. De twee query-ingangen vielen vóór
browserontdekking uit; hun bediening zit niet in die noemer.

#### Resultaten gerichte afsluiting (30 oktober)

- Hotels: **6/6** echte Chromium-browsertests op schone broncommit
  `af9ae5f8efceafb41d406824faf4720fa399535d`, nul skips. De bestaande
  Experience-runner produceert één getypeerd bestemmingsbewijs
  `PROVEN_IN_SCOPE`; het geheel blijft `INCOMPLETE`. Artefacten:
  `artifacts/experience/hotels-destination.{json,log,coverage.json}` en
  `artifacts/experience/report.json`. Dit is geen volledige schermkwalificatie.
- APPWERKT query-ingangen: op `4dcfe71fdc` bereikt de echte geselecteerde runner
  RTFoundation en Videobellen en raakt **5/5** respectievelijk **1/1** eigen
  knoppen. Het testcontract bewaakt dat APPWERKT en RAAKVLAK bytegelijk blijven.
  Log `/tmp/rtg-appwerkt-query-browser.log`. Deze proef kwalificeert de twee
  gemeten bereikbaarheid-/bedienbaarheidscontracten, geen nieuwe 114/114-afleiding.
- **18/18** gerichte query-/bestemmingscontroles en **30/30** bestaande
  bronafhankelijkheidscontroles slagen. Een aanvullende regressie verbindt de
  werkelijke virtuele query-ingang met `versheidVoor → controleer` in een
  afzonderlijke testrepository: vers bij de oorspronkelijke bron, vervallen
  bij gewijzigd document of meterhelper. Die gerichte proef slaagt ook.
- Drie bestaande Experience-integratieproeven slagen tegen de lokale server.
  De eerste sandboxpoging kon loopback niet openen (`EPERM`); na uitvoering
  met lokale loopbacktoestemming slagen 3/3, zonder code- of normwijziging.
- Onafhankelijke technische lezing vindt geen bewijsversoepeling. Metingen
  voor eindkwalificatie blijven afzonderlijke processen; `meet()` heeft nog
  gedeelde procescache en mag niet als twee onafhankelijke runs worden gebruikt.

De oudere 112/114-uitslag en het Hotels-deelbewijs blijven historische,
commitgebonden resultaten. Nieuwe bronwijzigingen krijgen geen terugwerkend
groen. Actuele integrale samenstelling, alle Experience-dimensies, menselijke
beoordeling, staging/herstel en twee schone eindruns blijven open. Geen merge
of productie-uitrol uitgevoerd.

#### Consolidatie documentfamilie — 30 oktober

Juridisch en de drie gepubliceerde documenten gebruiken nu de bestaande
DS-shell, lijst en lezer. Vier eigen stijlblokken (13.924 tekens) zijn verwijderd;
de gedeelde lezer krijgt uitsluitend een paginavariant voor documentritme.
Documenttekst en de twee scripts voor actuele prijzen/tarieven zijn behouden.
Geen nieuwe dependency, controller, opslag of autorisatiepad is toegevoegd.
De statische DS-inventaris telt nu 34 gemigreerde routes, tegenover 30 vóór dit
pakket. De 330 bestanden in die inventaris zijn niet dezelfde noemer als de
316 Experience-schermen; migratie is geen schermkwalificatie.

De gerichte browser- en inhoudscontroles slagen 11/11, zonder skips, op de
werkstand gebaseerd op `2bfbe1b2a1`. Log: `/tmp/rtg-legal-ds-final.log`.
Ze toetsen 390/820/1440 px, geladen DS, één titel/Edge, automatische
toegankelijkheid, 200% tekst, natuurlijke Tabvolgorde, documentterugkeer,
herladen, actuele prijsgegevens en de cookiemelding bij het eerste bezoek.
De bestaande VOLTOOIPROEF voor Juridisch sluit daarnaast de documenttaak,
publicatie na herladen/herstart en herstel na een echte servercrash.
Log: `/tmp/rtg-legal-completion-current.log`. Dit scenario levert geen
vreemde-actorbewijs of menselijke Experience-beoordeling.

Onafhankelijke codecontrole bevestigt behouden documentinhoud en prijsscripts.
De aanvullende controles uit die review zijn uitgevoerd. Eén fout in de nieuwe
test verwees naar `business` in plaats van het bestaande `business-lite`; de
test is gecorrigeerd naar de werkelijke API en veldbinding, zonder productprijs
of kwaliteitsgrens te wijzigen. De eerste mislukte run blijft bewaard in
`/tmp/rtg-legal-ds-browser-expanded.log`.

Open afsluitpunten: APPWERKT telt eigen knoppen; deze documentinterface werkt
via links. De gerichte hermeting bevestigt bereikbaarheid, maar geeft bij nul
eigen knoppen terecht `NIET_GETEST` voor bedienbaarheid. De drie documentlinks
zijn wel werkelijk getoetst door de taakproef. Een expliciete, afzonderlijk
geteste aansluiting voor linkbediening ontbreekt nog; het taakbewijs wordt
niet automatisch opgewaardeerd. Log: `/tmp/rtg-legal-appwerkt-scoped.log`.
Geen historisch register is door de gerichte runner overschreven.
De nieuwe Experience-signaturen zijn
contractdeclaraties, geen groene kwalificaties. Er zijn nog gedeelde
stijlinjecties; alleen de route-eigen CSS en legacy-stijlbladkoppelingen zijn
hier geconsolideerd. De globale DS-poort blijft geblokkeerd door de bestaande
31-byte groei in `public/apps/browser.html` (`scroll-margin-block-start:8rem`).
Die norm is niet verruimd en de focusverbetering niet verwijderd. De ratel kan
pas na een inhoudelijke oplossing opnieuw worden vastgelegd.

#### Uitvoeringsbesluit — bouwen vóór eindkwalificatie (30 oktober)

De eigenaar wil eerst de afgesproken functionaliteit en consolidatie bouwen
en integreren. De afzonderlijke menselijke pakketproeven worden uitgesteld;
de eigenaar test daarna samen met de integrator tijdens de gezamenlijke
eindkwalificatie. Ook de twee volledige onafhankelijke eindruns komen pas na
een gesloten bouwrestlijst op één schone kandidaat. Een gedeeltelijk pakket
of een historische registeruitslag wordt niet gebruikt als releasegroen.

Tijdens de bouw blijven gerichte ontwikkelcontroles nodig voor het gewijzigde
gedrag, broncontracten en veiligheidsgrenzen. Zij zijn geen volledige
kwalificatiecampagne en blokkeren onafhankelijke bouwwerkzaamheden niet.
Tests en scenario's worden met de implementatie meegebouwd; de volledige
browser-, menselijke, operationele en platformkwalificatie volgt gezamenlijk.
Geen productie-uitrol, merge of wijzigingen aan bewijsdrempels zijn hiermee
goedgekeurd. APPWERKT en EXPERIENCEWERKT blijven de bestaande bewijsbronnen;
deze afbouwadministratie beschrijft gebouwd/geïntegreerd en nog te kwalificeren.

De volgende bouwbatch combineert drie niet-overlappende wijzigingen: expliciete
documentlinkbediening in de bestaande APPWERKT-meter, de twee bestaande
leverancierswerkbladen op public/ds en concrete Experience-signaturen voor vijf
reeds gemigreerde schermen. Daarnaast gebruikt de terugvaltekst van vijftien
oude doorverwijsadressen het bestaande DS-statuspatroon. De omleidingsscripts,
query-overdracht en oorspronkelijke bestemmingen blijven behouden. Een
gemigreerde redirect is geen nieuwe app en kwalificeert zijn bestemming niet.

#### Bouwbatch — centrale patronen en herstelgedrag (30 oktober)

- Vijftien aliasdocumenten gebruiken het bestaande DS-statuspatroon. De
  bestemmingen, meta-refresh en omleidingsscripts zijn behouden. Vijftien
  route-eigen stijlblokken (10.200 tekens) zijn verwijderd. De snelle
  bron-/navigatiecontrole sluit 15/15; de voorbereide browserproef wacht op de
  latere kwalificatie. Dit zegt niets over de doelapps zelf.
- De leveranciersbladen Aanvragen en Service zijn op bestaande DS-elementen
  aangesloten, met dezelfde IDs, tokens, API's en bestaande actiehandlers.
  De aanvraagrenderer ondersteunt optioneel de bestaande DS-klassen; oudere
  callers behouden hun gedrag. Nog niet gesloten: de bestaande `metgezel.js`
  biedt leveranciers-Rahul via `/api/supplier/ai`, handenvrij en Samen, terwijl
  de DS-shell niet al die functies vervangt. Het script is daarom behouden.
  De twee routes zijn **in bouw**, niet volledig DS-gemigreerd of gekwalificeerd.
  Hun resterende stijlinjectie is geen uitzondering op de norm. De gerichte
  browserproef is voorbereid; loopbackstart gaf EPERM en de escalatie is
  afgebroken. Er is voor deze proef geen geslaagde browseruitslag.
- Ghost onderscheidt ontbrekende inlog, geweigerde toegang, netwerkfalen en
  onvolledige voorspellingen; de gebruiker krijgt waar passend een herprobeeractie.
  Voertuig bewaart de gekozen wagen tijdens verversen en meldt bij een mislukte
  laadactie geen succes. De bijbehorende browserscenario's zijn meegebouwd,
  niet als uitgevoerde kwalificatie geregistreerd.
- Routedekking bewaart de nieuwste zoek-/paginakeuze wanneer oudere antwoorden
  later binnenkomen. Drie gerichte controllerproeven sluiten; daadwerkelijke
  browser-/Experience-kwalificatie blijft een afzonderlijke verplichting.
- Vijf bestaande DS-schermen krijgen concrete Experience-signaturen: Boeken,
  Ghost, Voertuig, Hangar en Routedekking. Dit zijn ontwerp- en taakcontracten,
  geen menselijke beoordelingen of uitgevoerde ervaringsbewijzen.
- APPWERKT krijgt expliciete linkbediening naast knopbediening. EXPERIENCEWERKT
  neemt beide soorten bediening in zijn inventaris op, zonder een succesvolle
  klik als volledig ervaringsbewijs te behandelen. Ontbrekende of ongeldige
  navigatiegegevens blijven open. Historische APPWERKT-uitslagen worden hierdoor
  niet opnieuw groen verklaard; de geselecteerde browserproeven zijn voorbereid
  voor de kwalificatiefase.

De bouwstand is geen releasekandidaat. De bestaande DS-ratelbevinding in
`browser.html`, de leveranciersbegeleidingslaag, overige schermmigraties,
actuele APPWERKT-afleiding, volledige Experience-bewijzen, menselijke taken en
operationele kwalificatie blijven zichtbaar open. Geen merge of deployment.

Bouwcontrole van deze werkstand: 19 gewijzigde/nieuwe JavaScript-bestanden
parsen zonder syntaxfout; de bron-diff bevat geen whitespacefouten. De
DS-controle meldt drie open punten: de bestaande groei in `browser.html` en
de behouden metgezel-injectie op elk van de twee leveranciersroutes. Een
ontbrekende letterlijke routemontage in de voorbereide browsertoets is
gecorrigeerd naar expliciete routeconstanten; de toets is daarmee niet als
uitgevoerd aangemerkt. De onafhankelijke bronreview van de redirects en
zoekvolgordereparatie vindt geen nieuwe blocker binnen die beperkte scope.
Een verlopen kantoorsessie blijft bij HTTP 401 naar de bestaande inlogdeur
gaan; de zoekvolgorderegel vervangt die autorisatieafhandeling niet.


#### Bouwbatch — één eigenaar per verantwoordelijkheid (30 oktober)

De eigenaar vraagt de volledige code onderhoudbaar en uitbreidbaar te
consolideren. Dat betekent één actieve implementatie per gedeelde
verantwoordelijkheid, niet blind alle gelijknamige functies samenvoegen.
Gegenereerde bundels blijven afgeleide distributieartefacten; bronparts zijn
hun enige bewerkbron. Verschillende productcontracten houden hun verschillen.
Geen nieuwe apps, registratiesysteem, dependency of uitvoeringscontroller is
voor deze batch toegevoegd.

Gebouwd en geïntegreerd in de werkboom vanaf `3b07587407ff9123dd8678dba0c63611d649d64b`:

- **CSV-celveiligheid:** `server/lib/csvcel.js` vervangt dubbele
  prefixneutralisatie en quote-escaping in facturen en Office. De publieke
  factuurexports blijven behouden. Facturen houden numerieke waarden/selectieve
  quotes; Office houdt tekstbehandeling/altijd quotes. Drie pure regressies
  controleren 23 letterlijke gevallen, echte Office-export en afwijzing zonder
  opslag of auditmutatie. De onafhankelijke review vergelijkt bovendien 5.000
  deterministische invoerwaarden met beide oude uitvoercontracten.
- **Metgezel:** de oude Rahul-controller stond achter de constante
  `eigenRahul=true`. Die onbereikbare request-, render-, polling- en
  observercode is verwijderd uit de bronparts. Exclusief bijbehorende
  balk-/seintjesstijlen zijn na consumentencontrole verwijderd. Het geleverde
  metgezelbestand is 28.747 bytes kleiner; dit is niet nogmaals opgeteld bij
  de bronparts. Actieve Samen, Rahul-tab en handenvrij blijven behouden.
  De eerdere formulering over leveranciers-Rahul in metgezel is hiermee
  verfijnd: de actieve requestweg zit in Rahul-tab/handenvrij, de verwijderde
  leveranciersaanroep in metgezel was al onbereikbaar.
- **Edge → bestaande Rahul:** waar de bestaande publieke hook aanwezig is,
  kiest de DS Edge geen tweede actor of transport. De hook meldt nu awaitbaar
  of een vraag is overgenomen. Niet-gereedheid, bezetting en openfouten laten
  de Edge-invoer behouden. De bestaande vraagfunctie reserveert de lopende
  vraag vóór haar eerste await; een externe vraag overschrijft geen lokale
  werkbladdraft. Negen gerichte controles draaien ook de werkelijke Rahul-tab
  met de bestaande sessieopslag, inclusief leverancier/lid, gelijktijdige
  ingangen, herstel en onderdrukking van een laat antwoord van de vorige actor.
  De onafhankelijke P2-bevinding over een niet-waarneembare overdracht is
  hiermee hersteld en opnieuw beoordeeld. Dit is geen complete autorisatie-
  of browserkwalificatie.
- **Wonen-familie:** Mijn thuis, Onderhoud en Woningdossier hergebruiken
  bestaande DS-kaarten, velden, lijsten en dialoog. De exclusieve
  `rtg-wonen-2026.css` is verwijderd: 7.520 bytes en vier `!important`.
  IDs, API's, authenticatie, opslag en acties blijven behouden. Alle benodigde
  gedeelde scripts blijven beschikbaar. De review vond dat `ios.js` de
  header nog naar `ios-*` ombouwt; daarom blijft het bestaande `ios.css`
  tijdelijk geladen. Die afhankelijkheid krijgt geen uitzondering of
  groenstatus. Vier browserproeven staan klaar en zijn niet uitgevoerd.

De drie Wonen-routes en twee leveranciersroutes blijven **in bouw**. De
statische DS-poort noemt 21 bevindingen: de bestaande 31-byte browserratel,
twee leveranciersafhankelijkheden en zes gedeelde presentatieafhankelijkheden
op elk van de drie Wonen-routes. Dit zijn geen 21 onafhankelijke productbugs;
ze sluiten grotendeels op dezelfde gedeelde presentaties aan. Geen norm is
verruimd. De volgende gedeelde bouwsnede moet Rahul-tab/Samen/handenvrij en
bestaande scherm-/desktopbediening onder het DS brengen met behoud van hun
hooks, context en acties, voordat meer families op diezelfde blokkade landen.
De eerdere voorraad van 49/316 statisch gemigreerde Experience-routes blijft
49/316: vijftien redirects en 34 overige schermen. Dat is geen bewijs voor
49 gekwalificeerde gebruikerservaringen.

Gerichte ontwikkelbewijzen staan in `/tmp/rtg-consolidatie-bouwcontrole.log`,
`/tmp/rtg-consolidation-independent.log`, `/tmp/rtg-rahul-rereview.log` en
`/tmp/rtg-metgezel-css-cleanup.log`. Twee historische randen-bronasserties
wezen naar de onbereikbare controller; hun vervanging toetst actieve
open/sluit-/aansluitpaden. Overlap, focus, safe areas, tekstvergroting en
compacte-standpersistentie zijn daardoor niet ineens bewezen en blijven
expliciete eindproeven. De volledige suite, browserkwalificatie, menselijke
beoordeling en operationele proeven zijn in deze bouwbatch niet uitgevoerd.

De afhankelijkheidsmeting vóór deze consolidatie telde 63 opwaartse en 107
primitief-naar-domeinkoppelingen (de oudere 105 is geen actuele stand), nul
onverklaarde randen en 260 gedeelde kernnamen. Verklaard is niet hetzelfde
als wenselijk; autorisatie- en auditverbindingen worden niet losgemaakt om
alleen een teller te verlagen. De CSV-verplaatsing verlaagt onderhoudsduplicatie,
maar er wordt geen daling van de koppelingsteller geclaimd.

Nog te sluiten: de gedeelde presentatieafhankelijkheden, resterende
scherm-/Experience-signaturen en migraties, actuele APPWERKT-afleiding,
alle toepasselijke Experience-dimensies, volledige veiligheidsketens,
menselijke/operationele kwalificatie en twee onafhankelijke eindruns op één
schone kandidaat. De werkboom is geen releasekandidaat. Geen merge of uitrol.

#### Doorlopende afbouw — gedeelde bediening en bewijsgrenzen (30 oktober, vervolg)

Werkstand blijft de integratiewerkboom boven
`3b07587407ff9123dd8678dba0c63611d649d64b`, Node `26.12.1` op macOS arm64.
Dit zijn gerichte ontwikkelresultaten, geen kwalificatie van een schone
kandidaat. De historische APPWERKT-afleiding noemt **112/114** op
`0afc8afa15`; de laatste twee queryroute-meterreparaties bestaan al in de
latere bron. Er wordt geen actuele 114/114-afleiding uit oudere resultaten
geconstrueerd. EXPERIENCEWERKT blijft **0/114 apps, 0/316 routes en
0/3.368 voorwaarden** met geldig integraal bewijs. De huidige wijzigingen
vragen vernieuwing van de daadwerkelijk getroffen bewijzen.

Afgebakende oorzaken afgesloten met gerichte regressies:

- **Eén presentatie per host:** volledige DS-hosts gebruiken de canonieke
  componenten voor Rahul, Samen, handenvrij, conceptwerk, de inlogdeur,
  export en iOS-gebaren. De bestaande owners, API's en autorisatie blijven
  leidend. Legacy-hosts behouden hun oorspronkelijke presentatie totdat hun
  eigen migratie klaar is; die bron is niet globaal verdwenen. Rahul gebruikt
  op DS een expliciete eigenaarstaat en geen geïnjecteerde verbergstijl.
  De drie PDA's behouden na review hun bestaande Workspace Runtime en iOS-
  gedrag. Hun oude lokale opmaak is vervangen, niet hun functionaliteit.
- **Rahul-resultaat en akkoord blijven bij actor én selectie:** de request-
  context is een onafhankelijke kopie. Een laat resultaat voor een ander
  object krijgt geen concept, uitvoeringsclaim of goedkeuring. Actorwisseling
  wist ook zichtbare oude concepten en invoer. Een nieuwe vraag trekt het oude
  voorstel in vóór transport. HTTP-fouten en negatieve productantwoorden
  worden niet als uitvoering gepubliceerd. De bestaande approval-owner
  controleert dezelfde context vóór verzending en na het antwoord; een oude
  bevestigingsronde mag een nieuw voorstel niet verwijderen. Onafhankelijke
  review vond en hielp deze twee laatste gaten sluiten. Geen tweede agent,
  uitvoeringsketen of serverautorisatiemodel toegevoegd.
- **Werkelijke bediening:** leveranciersflows zijn in Chromium uitgevoerd
  met echte geïsoleerde testserverdata: melding, antwoord, herladen, reactie,
  status en accountdeur. Zes proeven slagen, inclusief Rahul op DS en twee
  legacy-hosts. Een gevonden legacy-headerregel kneep de Rahul-ingang tot
  40 px; de bestaande regel is hersteld naar 44 px. De drie PDA's doorlopen
  aanmaak, conceptgeneratie, filtering, CSV/JSON-download, focus, Tab en
  Escape op 390/820/1440 px. Dat bewijst deze taken, niet menselijke premium-
  kwaliteit. De verdere canonieke wereldwerkruimtepresentatie wordt daarna
  afzonderlijk gecontroleerd.
- **APPWERKT-navigatieguard:** de onafhankelijke tegenproef vond dat een
  ongeoorloofde redirect wel werd afgekeurd maar toch bezocht. Alleen de
  daadwerkelijk aangeklikte documentrespons wordt nu zonder automatische
  redirects opgehaald. Iedere 30x blijft expliciet onbewezen in dit directe
  navigatiecontract; aliasgedrag heeft zijn eigen proef. De 15 browserproeven
  slagen, inclusief externe bestemming, lus en meerstapsredirect, zonder
  verboden bezoek. De aparte aliasdocumentproeven slagen 16/16 en
  Ghost/Voertuig-herstel 5/5. Aliasproeven zijn geen domeinketenkwalificatie.

De stijlscanner maakt nu onderscheid tussen bewezen DOM-laadpaden,
mogelijk geladen bronnen en worker/precachevermeldingen. De bestaande
AST-infrastructuur wordt gebruikt, zonder nieuwe parser of interpreter.
Onzekerheid blokkeert migratiegroen. Onafhankelijke review vond ontbrekende
tegenproeven voor gewijzigde DS-aliases, relatieve adressen en overschaduwde
workerbindings; die zijn hersteld, inclusief overschreven DS-testmethoden.
De bronratels blijven intact. De tussenmeting in
`/tmp/rtg-ds-bronmeting-20261030.json` telt 330 HTML-bestanden over het hele
publieke oppervlak, **niet** een nieuwe Experience-noemer. Met de aangescherpte
laadgraaf kwalificeert zij voorlopig nul statisch schone routes: gedeelde
laadfuncties zijn nog niet volledig herleid. Dit is geen vergelijkbare
terugval van de oude 49/316 en ook geen groenverklaring. De 316 Experience-
routes, hun redirects en menselijke bewijsverplichtingen blijven ongewijzigd.

Meetbare bronopruiming tegenover deze HEAD, vóór de volgende browsermigratie:
23 lokale stijlblokken verwijderd, samen 26.579 bytes. Daarnaast is de eerder
genoemde exclusieve Wonen-CSS van 7.520 bytes verwijderd. Afgeleide bundels
worden niet nogmaals als verwijderde broncode geteld. De gedeelde legacy-
fallbacks hebben nog consumenten en blijven dus zichtbaar in de restlijst.

`/tmp/rtg-gedeelde-consolidatie-20261030.log` bevat de gecombineerde gerichte
ontwikkelcontrole: **120 geslaagd, 0 gefaald, 0 overgeslagen**. Dat resultaat
dekt de genoemde geselecteerde tests; het is geen platformbrede run.
De actuele PR #702-status is apart gelezen: head
`8da28119e7bad72ed43dc93362d41468349d3809`, open en niet gemerged, 37
succesvolle en vijf overgeslagen checks. Die CI hoort niet bij deze gewijzigde
lokale werkstand; de overgeslagen controles zijn geen lokaal eindbewijs.

Directe voortzetting: bestaande appmenu-owner toegankelijk onder DS afbouwen;
canonieke presentatie van de bestaande zelfstandige wereldwerkruimte inclusief
beeldeditor en widgets afronden; browserchrome met behoud van de gedeelde
ledenwebsite-renderer consolideren; daarna de bronafhankelijke inventarissen
eenmaal bijwerken. Geen oude werkruimte of besturing verwijderen om een
stijlpoort te passeren. De onbesliste laadpaden, overige schermfamilies,
menselijke taken, financiële/operationele poorten en twee onafhankelijke
eindruns blijven open. Er is niets gemerged of uitgerold.

#### Doorlopende afbouw — gedeelde eigenaren en werkelijke opslag (30 oktober, avond)

Vervolg op dezelfde gewijzigde werkboom boven `3b07587407ff9123dd8678dba0c63611d649d64b`,
Node `26.12.1`. Geen nieuwe kandidaat, merge of uitrol. Onderstaande controles
zijn ontwikkelbewijs; APPWERKT en EXPERIENCEWERKT zijn hiermee niet opnieuw
integraal gekwalificeerd. De historische APPWERKT-stand blijft 112/114;
Experience blijft 0/114 apps, 0/316 routes en 0/3.368 voorwaarden.

Gedeelde oorzaken die nu technisch zijn aangepakt:

- **Instellingen en basis:** dezelfde RTGBediening-/RTGGids-eigenaren gebruiken
  op DS native dialogen en centrale componenten. Oude basis-, springlink- en
  instellingenstijlen worden op DS niet meer geïnjecteerd. Focus, tekstvergroting,
  verbindingsmeldingen en bestaande toegankelijkheidsvoorkeuren blijven werken.
  Heropening leest de actuele voorkeuren bij hun bestaande eigenaren; de oude
  lege Widgets-helper is verwijderd. Twee instellingenbrowserproeven slagen,
  inclusief legacy-CSS die bytegelijk blijft, 390/820/1440 px en 200% tekst.
  Twee echte Wonen-basisproeven slagen, inclusief vertraagde en negatieve
  gidsantwoorden. De mobiele werkruimte-springlink focust nu de werkelijke
  inhoud; een `display:contents`-container kan zelf geen focus ontvangen.
- **Waarheidsgetrouwe hulplaag:** HTTP-fouten, negatieve productantwoorden en
  antwoorden voor een andere sessie geven geen onterechte bevestiging. De
  oorspronkelijke sheet en actor blijven aan het verzoek gekoppeld. Drie
  gerichte helperproeven slagen; actieklikken via de echte hulplaag worden
  aanvullend gecontroleerd. Geen autorisatie- of servercontract gewijzigd.
- **Taal en beweging:** de bestaande i18n-owner gebruikt `taalkeuze.css` en
  een native DS-dialoog. Alle 114 registercodes blijven bij dezelfde matcher.
  De oude globale reduced-motion-regel creëerde ongewenste overgangen op
  flex-afmetingen en veroorzaakte tijdelijk ingeklapte werkruimteframes.
  Die legacy-stijl wordt op DS niet meer geladen. Drie browserproeven slagen
  voor DS, RTL, grote tekst, zoeken, snelle keuzes, een expliciete spraakfixture
  en legacy. Dit is geen kwalificatie van een externe vertaal- of spraakdienst.
- **Universele zoekingang:** Sprong behoudt zijn index, appmenu-handelingen en
  API. Op DS komt de vorm uit `sprong.css`; native modaliteit sluit de
  achtergrond af. Een laat catalogusantwoord na sluiten steelt geen focus.
  Vier gerichte DS/bodyproeven en de tien bestaande legacy-browserproeven
  slagen. Geen tweede zoekmotor of aparte bestemmingenlijst toegevoegd.
- **Werkruimteopslag:** A → B → A zijn drie bewuste wijzigingen, geen retry
  van de eerste A. Cards gebruikt de bestaande RTGIdem-sleutelgenerator;
  People geeft die door via het bestaande contract. Een retry na verloren
  antwoord behoudt sleutel en inhoud. Een gewijzigde sessie blokkeert vóór
  verzending en vóór de succesweergave; `ok:false` en ongeldige antwoorden
  leveren geen opslagclaim. Zes gerichte ownerproeven en de echte
  opslag/teruglees-/antwoordverliesproef slagen. De mobiele beeldeditor is
  via de bestaande Edge-actie weer vanuit gesloten toestand bereikbaar.
- **Browserapp:** twee eigen stijlblokken vervangen door de centrale
  browsercomponent. Zes gerichte proeven slagen; een oud gidsantwoord schrijft
  niet meer naar een losgeraakt rooster. De gedeelde `webblok.css`-renderer
  blijft een expliciet volgend pakket en is niet stil verwijderd.

De centrale sequentiële browsercontrole op de geïntegreerde taalbron is
vastgelegd in `/tmp/rtg-gedeelde-browser-vervolg.log`: 6 geslaagd, 1 gefaald,
0 overgeslagen. Basis 2/2, taal 3/3 en de werkruimteproef over de zes betrokken
routes slagen. De aparte appmenu-headercontrole faalt nog bij Studio en grote
tekst; deze concrete geometriefout wordt gericht gesloten. Een geslaagde
deelproef verandert dit samengestelde resultaat niet in groen.

De bestaande DS-compiler controleert nu ook verplichte tokennamen. Een
daadwerkelijk gevonden fout `--ds-radius-veld` is vervangen door het bestaande
inhoudstoken. De tegenproeven controleren ontbrekende namen, commentaar,
tekenreeksen en deels overeenkomende namen. Een expliciete fallback mag.
Dit bewijst naamgeldigheid, geen cascadebereik of contrast. Samen met de
begrensde laadgraafproeven: 21 geslaagd, 0 gefaald, 0 overgeslagen in
`/tmp/rtg-ds-broncontract.log`. Onopgeloste laadpaden blijven fail-closed.

Meetbare opruiming tegenover HEAD: **25 lokale stijlblokken, 34.474 bronbytes**
verwijderd, over 21 gewijzigde HTML-bestanden. Daarnaast blijft de exclusieve
Wonen-stijlbron van 7.520 bytes verwijderd. Bundeluitvoer wordt niet dubbel
geteld. Gedeelde legacy-fallbacks met resterende consumenten zijn niet globaal
verwijderd; minder DS-injecties is dus niet hetzelfde als nul legacy in RTG.

Direct verder: appmenu-geometrie afronden; negatieve serviceactieproeven
afronden; renders inspecteren; bronafhankelijke kaarten en cacheafdrukken
eenmaal coherent bijwerken. Daarna de volgende gedeelde legacy-presentatie
en onbesliste laadpaden sluiten. Alle overige schermfamilies, actuele
APPWERKT-afleiding, menselijke Experience-proeven, financiële/operationele
kwalificatie en twee onafhankelijke eindruns blijven zichtbaar open.

#### Doorlopende afbouw — bereikbare bediening en behoud van werk (31 oktober)

Vervolg op de gewijzigde werkboom boven
`3b07587407ff9123dd8678dba0c63611d649d64b`, met Node `26.12.1` op Darwin arm64.
Dit is nog geen bevroren kandidaat. De onderstaande gerichte browserproeven
gebruiken eigen loopbackservers, geïsoleerde testgegevens en Chromium; zij zijn
geen bewijs van staging, echte betalingen, menselijke beoordeling of alle apps.

- **Juridisch:** de echte APPWERKT-meter opent de drie juridische documenten
  en keert terug naar de werkelijk zichtbare Command-inhoud. De oude titel- en
  shellverwachting beschreef het huidige product niet. Titel, toegestane URL,
  succesvolle documentrespons en niet-afgedekte inhoud blijven verplicht;
  foutieve redirects en overlays blijven rood. De echte navigatieproef sluit
  4/4 links, één geslaagde test in `/tmp/rtg-juridisch-echte-route.log`.
  Onafhankelijke review bevestigt deze beperkte navigatiescope.
- **Hulp en overdracht:** de eerder open appmenu-geometrie is hersteld. De
  bestaande eigenaren behouden hun diensten en acties, met gecontroleerde
  negatieve HTTP-/productantwoorden en actorwisseling. De serviceproeven
  slagen 16/16 (`/tmp/rtg-basis-service-browser.log`), overdracht 3/3
  (`/tmp/rtg-overdracht-browser.log`). De eerste samengestelde 6/7-run blijft
  historische rode informatie; een latere afzonderlijke proef heeft het
  appmenu gecontroleerd, niet dat oude resultaat herschreven.
- **Rahul-kop:** een volledige DS-host met zichtbare Edge gebruikt diens
  bestaande Rahul-ingang. De headerfallback blijft voor hosts zonder Edge en
  de berichtmodus; de actie heropent het bestaande werk en bewaart concepten.
  Zeven browserproeven slagen (`/tmp/rtg-rahul-header-browser.log`), inclusief
  echte leveranciersacties en twee legacy-hosts. Geen tweede Rahul-owner.
- **Glyf, knoppen en focus:** de bestaande glyf krijgt centrale afmetingen,
  kleine knoppen en chips behouden het DS-aanraakdoel. De coverfocus gebruikt
  een contrasterende ring met donkere onderrand; een lichte dialoog boven een
  cover behoudt zijn eigen contrast. De eerste contrastproef vond een echte
  tekortkoming, waarna deze gericht is hersteld. Acht gecombineerde
  bediening-/leveranciersproeven slagen zonder skips in
  `/tmp/rtg-bediening-geometrie-browser.log`; de drie PDA-taken inclusief echte
  downloads slagen in `/tmp/rtg-pda-icoon-browser.log`. Dit omvat
  390/820/1440 px en waar aangegeven 200% tekst, geen claim over alle apparaten.
- **Gepubliceerde webinhoud:** de bestaande renderer gebruikt nu
  `componenten/webblok.css`; de dertien bloktypen, ontsmette makerskleuren,
  beeldinhoud en bestaande berichtenroute blijven behouden. Formulieren
  behouden dezelfde DOM, selectie, invoer en herhaalsleutel bij formaatwisseling.
  Onafhankelijke tegenproeven vonden twee oude racecondities: overlappende
  submits konden een nieuwe sleutel wissen, en een oud pagina-antwoord kon
  nieuwere navigatie overschrijven. Beide zijn centraal hersteld met één
  lopend verzoek per formulier en een navigatiegeneratie. Geen tweede
  formulieropslag of router. Achttien gerichte pure browser-/webblokproeven
  slagen; de onafhankelijke herreview herhaalde de zestien webblokproeven.
  De browserherproef blijft vereist voor sluiting van dit pakket.
- **Werkelijke canvas-owner:** de bestaande Heritage-canvasregistratie en
  Workspace Runtime blijven actief. DS geeft hun bestaande werkvlak een
  passende flex- en scrollpresentatie; de browser is niet uit het register
  verwijderd om een controle te laten slagen. De eerste echte herproef vond
  mobiele menu-overlap en een verzenddoel van 39,375 px. De menu-owner herkent
  nu ook de verplaatste werkbalk en het formulier gebruikt het bestaande
  DS-doel van 48 px. De rode 4/6-run staat in
  `/tmp/rtg-webblok-canvas-browser-voor-herstel.log`; sluiting volgt uitsluitend
  uit de gerichte herproef.

De laadgraafscanner bewijst nu ook de echte serverkopvolgorde en begrensde
native-documentaliases/ankerdownloads. Onbekende setters, prototypewijzigingen,
bindingmutaties en niet-herleide loaders blijven blokkerend. De laatste
scanner-/webblokselectie slaagt 35/35 in `/tmp/rtg-scanner-webblok-pure.log`;
dat is geen vrijbrief om alle mogelijke legacybronnen als inactief te behandelen.
De onafhankelijke bronreview vond juist nog echte oude stijlinjecties in
cookie, sneltoets en volscherm. Deze worden als gedeelde productpakketten
opgepakt, zonder verdere parseruitbreiding als vervanging voor consolidatie.

De actuele integrale tellers worden hiermee niet verhoogd: APPWERKT blijft
historisch 112/114 op zijn eigen bron; EXPERIENCEWERKT heeft nog 0/114 apps,
0/316 routes en 0/3.368 dimensieverplichtingen volledig geldig. Een signature,
verwijderd stijlblok of geslaagde ontwikkelproef is geen volledige kwalificatie.
Menselijke taken, overige schermfamilies, operationele en financiële poorten,
bewijsactualiteit en de twee onafhankelijke eindruns blijven open. Geen merge
of uitrol uitgevoerd.

#### Gesloten gedeelde ontwikkelpakketten — vervolg 31 oktober

Nog steeds de gewijzigde werkboom boven `3b07587407ff9123dd8678dba0c63611d649d64b`;
geen releasekandidaat. De eerder genoemde browserherproeven zijn nu uitgevoerd:

- **Webblok en browsercanvas:** echte makersinhoud met dertien bloktypen,
  navigatie/tabs, behouden formulierinvoer bij formaatwisseling en precies één
  opgeslagen aanvraag bij antwoordverlies/herhaling zijn gericht bewezen.
  Een HTTP 200 alleen betekent geen ontvangen aanvraag: de formulierowner
  verlangt nu de bestaande positieve bevestiging met de juiste soort en
  bestemming. Ongeldig JSON, `ok:false` en een onbekende bestemming houden
  invoer en herhaalsleutel vast. De daadwerkelijke herhaalproef slaagt 1/1
  in `/tmp/rtg-webblok-ontvangst-browser.log`. De eerdere samengestelde
  7/10-run bevatte daarnaast twee inmiddels afzonderlijk herstelde
  testfixturefouten en blijft als rood historisch resultaat geregistreerd.
- **Opslagmelding:** de bestaande cookie-owner gebruikt op DS de centrale
  component in de normale documentstroom. De melding blijft daardoor boven
  het canvas bereikbaar zonder tweede hoogteberekening of oude stijlinjectie.
  Twee browserproeven slagen voor de echte Browser-host en een expliciet als
  zodanig gemarkeerde Wonen-componentfixture, bij 390/820/1440 px en 100/200%
  tekst. De eerste fout was een Engelse browserlocale bij een Nederlandstalige
  verwachting; de fixture kiest nu expliciet Nederlands. De samengestelde log
  `/tmp/rtg-cookie-sneltoets-browser.log` is niet geheel groen: de toen nog
  falende sneltoetsproef heeft een afzonderlijke geslaagde herproef.
- **Sneltoetsen:** DS gebruikt een native dialoog met sluiten en focusherstel;
  de bestaande toetsen pauzeren ook onder native dialogen zonder overbodige
  ARIA-rollen. Een oud `close`-event verbergt geen inmiddels heropende dialoog.
  De gerichte DS-browserproef slaagt 1/1 in `/tmp/rtg-sneltoets-browser.log`.
  De twee geselecteerde bestaande legacy-browserproeven slagen 2/2 in
  `/tmp/rtg-sneltoets-legacy-browser.log`; de overige premiumtests waren niet
  geselecteerd en zijn hiermee niet opnieuw gekwalificeerd.
- **Rand tot rand:** dezelfde `RTGVol`-owner, API en toestelvoorkeur bedienen
  nu de bestaande DS-werkruimte. Het hoofdwerkvlak kan verbreden; ondersteuning
  blijft bereikbaar. Er is geen remount bij schakelen, geen tweede controller
  en geen verwarring met native browserfullscreen. De initiële DS-DOM-volgorde
  zet hoofdinhoud/focus vóór ondersteuning, terwijl legacy zijn volgorde houdt.
  Vier centrale browserproeven slagen in
  `/tmp/rtg-volscherm-werkruimte-browser.log`: Wonen, Studio, een expliciete
  standalone-componentfixture en de bestaande proef over zes domeinroutes.
  Hetzelfde iframe, dezelfde hoofdinhoud en onbewaarde invoer blijven behouden,
  ook na formaatwisseling. De eerste rode proef verwachtte zoeken in een lege
  Notities-app; de correcte fixture maakt nu vooraf via de echte API een
  notitie. Geen productcode aangepast om die fixture kunstmatig te laten slagen.
- **Randen-loader:** actuele lokale DS-grenzen verhinderen dat vertraagde
  legacy-callbacks alsnog een tweede visuele Edge laden. Legacy laden en
  bestaande DS-randbediening blijven werken. De 34 gerichte bron-/scannerproeven
  slagen in `/tmp/rtg-randen-broncontract.log`. Uitvoer en Sprong krijgen
  dezelfde lokale actuele grens; hun oorspronkelijke CSS blijft bytegelijk.

Opruiming blijft aantoonbaar: 25 verwijderde lokale stijlblokken, 34.474 bytes
stijl-inhoud over 21 HTML-bestanden tegenover HEAD, plus de verwijderde
exclusieve Wonen-stijlbron. Stijlen verplaatst naar centrale DS-componenten
zijn consolidatie, geen claim dat alle CSS verdwenen is. Legacy-fallbacks voor
werkelijke resterende consumenten blijven zichtbaar werk.

De onafhankelijke bronreview en echte browserproeven vervangen geen menselijke
schermlezertaak, beoordeling van filmische kwaliteit of integrale
EXPERIENCEWERKT-kwalificatie. De integrale tellers blijven daarom ongewijzigd.
Het gegevensgesprek is vervolgens gericht afgerond; zie de aanvullende
bewijsafbakening hieronder.

#### Gegevensgesprek en strengere laadgraafproef — 31 oktober

- **Gegevensgesprek:** dezelfde `RTGGegevensPoort` gebruikt op DS een native
  dialoog in de bestaande gesprekseigenaar. De negen DS-ingangen laden de
  DS-markering vóór deze owner. Een geldige gegevensvraag staat boven het
  bestaande Hotels-boekingsvenster; annuleren behoudt het boekingsconcept.
  Antwoorden zijn gebonden aan hun gesprek. Dubbele invoer, oude antwoorden,
  `ok:false`, verkeerde antwoordvormen en een losgekoppelde dialoog kunnen
  geen verlate zakelijke herhaling veroorzaken. Legacy-CSS, bestaande API en
  serverbevoegdheden blijven behouden. De laatste bron is 10.217 bytes.
  De 21 gerichte pure proeven slagen in `/tmp/rtg-poortgesprek-pure.log`.
- **Echte browserroute:** de laatste twee proeven slagen in
  `/tmp/rtg-poort-definitieve-browser.log`. Hotels doorloopt zeven echte
  428-gegevensvragen en daarna precies één aanvraag; zes annuleringen leveren
  geen aanvraag op. Ongeldige telefooninvoer en de uitlegactie behouden invoer.
  Foodcourt controleert de bestaande legacy-consument. De DS-beelden op
  390/820/1440 px met 100/200% tekst zijn opgeslagen onder
  `../output/wereldwerkruimte-review-20261030/gegevenspoort-*.png`.
  Dit is lokale browser- en bronverificatie, geen menselijke UX-goedkeuring.
- **Geen verborgen laadgraaf:** de bestaande DS-browserhelper leest nu ook
  echte `/scriptbundel.js`-inhoud via de bestaande serverdecoder. Een geladen
  bundelnaam telt niet langer als bewijs dat Basis aanwezig is, en verborgen
  legacy-scripts worden daadwerkelijk beoordeeld. Zeven negatieve/positieve
  helperproeven bewaken dit. De eerdere gerichte browserselectie slaagt 4/4
  in `/tmp/rtg-poort-en-bundel-browser.log`, inclusief Webblok en de bestaande
  werkruimteproef over zes domeinroutes.
- **Vijf uitzonderingen verwijderd:** I18n, Cookie, Uitvoer, Sprong en
  Poortgesprek staan niet meer in `contract.json.overgangsscripts`. Hun
  DS-stijlinjectiepad is gesloten en wordt expliciet bewaakt. Plek, Basis,
  Magnaat-sandbox en Plaatsnadering blijven open overgangseigenaren. Deze
  reductie betreft actieve uitzonderingen; niet alle legacy-consumenten zijn
  daarmee gemigreerd.

De onafhankelijke bronreview controleerde ook losgekoppelde dialoog-DOM en
verlate antwoorden. Actorwisseling zonder nieuw gesprek is hiermee niet als
volledig scenario gekwalificeerd. De actuele PR #702 is nog open op
`8da28119e7bad72ed43dc93362d41468349d3809`: 37 succesvolle en vijf overgeslagen
checks volgens `/tmp/rtg-pr702-status-20261031.json`. Die andere bronstand
kwalificeert deze gewijzigde werkboom niet. Geen merge of uitrol uitgevoerd.

APPWERKT- en EXPERIENCEWERKT-integrale tellers blijven ongewijzigd. Na het
bijwerken van afgeleide registers volgt de volgende gedeelde overgangseigenaar;
de overige schermfamilies, menselijke beoordelingen, veiligheids-/operationele
poorten en twee onafhankelijke eindruns blijven open.

#### Locatie-intrekking, centrale bediening en bronherkomst — 31 oktober

Werkstand: `codex/deep-green-unified`, HEAD
`3b07587407ff9123dd8678dba0c63611d649d64b` plus de expliciet nog niet
gecommitteerde consolidatiewijzigingen. Runtime van de onderstaande lokale
proeven: Node 26.12.1. Dit is ontwikkelbewijs, geen bevroren releasebewijs.

- **Toestemming sluit de hele bestaande locatieketen.** `RTGPlek` stopt
  alle eigen vragen, get-verzoeken en watchers bij intrekking. Late callbacks,
  watch-id nul, uit→aan en een opslagwijziging uit een andere tab kunnen oud
  werk niet hervatten. Een lokale stop blijft lokaal. De bestaande Plaats- en
  Nadering-eigenaren vergelijken dezelfde read-only toestemmingsversie vóór
  en na hun awaits; geen tweede controller of opslag toegevoegd. De Stop
  delen-knop annuleert de automatische poging voordat de handmatige puls
  wordt verzonden. Oude pass-, venster- en hekkenantwoorden blijven inert.
  De drie clientbestanden moeten samen worden geleverd: ontbrekende actuele
  Plek-versie blokkeert veilig en start geen GPS.
- **Onafhankelijke controle ontdekte en sloot twee aanvullende races.**
  Eerst intrekking tijdens een passantwoord, daarna intrekking vóór de
  watcher bestond. Positieve tegenproeven tonen dat een nieuwe bewuste start
  en de normale aankomstpuls blijven werken. De centrale selectie slaagt
  75/75 in `/tmp/rtg-gedeelde-eigenaars-pure.log` en omvat ook bundelherkomst,
  de shell, Basis en de scriptbundel-browserhelper.
- **Browserbewijs met echte lokale API-antwoorden.**
  `/tmp/rtg-locatie-intrekking-browser-lokaal.log` bevat twaalf geslaagde
  proeven en één foutieve testverwachting: de bestaande server noemt de
  verwerkte stop `delen-gestopt`, niet `stop`. Alleen die verwachting is na
  controle van het servercontract gecorrigeerd; de gerichte herhaling slaagt
  1/1 in `/tmp/rtg-arrival-stop-herproef.log`. Hiermee zijn vier intrekkings-
  scenario's, twee bestaande aankomstscenario's en zeven Plek-schermstanden
  gericht bewezen. GPS is in de Arrival-races een bestuurbare toestelgrens;
  de HTTP-antwoorden komen ongewijzigd van de echte testserver. Een unieke
  antwoordmarkering en JSON-verwerkingsbarrière voorkomen dat een willekeurig
  ander antwoord het negatieve bewijs kan laten slagen.
- **Plek-presentatie hergebruikt centrale CSS.** Ook Plaatsnadering gebruikt
  `componenten/plek.css`. De niet-modale vraag laat zoeken bereikbaar;
  390/820/1440 px, 100/200% tekst en 390×480 px met 200% zijn gericht getest.
  De korte schermhoogte veroorzaakte aanvankelijk overlap; een begrensde
  scrollbare kaart herstelt de bediening. Magnaat-sandbox krijgt zijn
  bestaande keurmerk via `componenten/magnaatproef.css`; de vroege
  netwerkonderschepping en legacy-vorm blijven behouden.
- **Negen overgangsuitzonderingen zijn nul geworden.** Plek, Basis,
  Plaatsnadering en Magnaat-sandbox sluiten aan op de eerder gesloten vijf
  eigenaren. `overgangsscripts` is leeg. Dit bewijst hun bewaakte DS-pad,
  niet dat alle legacy-consumenten of schermen verdwenen zijn.
- **Bronbestanden en browserowners blijven één implementatie.** Voertuig,
  Randen en Rahul's bestaande basisstijl zijn via de bestaande bundelaar
  bytegelijk gesplitst om de modulegrens te behouden. De drie nieuwe
  deelbestandmeldingen worden uitsluitend aan het bestaande ownerbudget
  toegerekend wanneer actuele bytes, metingen en unieke herkomst overeenkomen.
  Ruwe tellingen blijven zichtbaar; extra injectie, mismatch of rechtstreeks
  geladen parts blijven fout. Een berekend laadpad blijft daarnaast rood
  in de afzonderlijke laadgraafcontrole. Geen norm is verhoogd.
- **Geen dubbele herstelbouw voor APPWERKT.** De querypadcorrectie voor
  RTFoundation/Videobellen bestond al. De bestaande runner controleert nu
  uitsluitend deze twee ingangen: respectievelijk 5/5 en 1/1 eigen knoppen,
  bereikbaar en bedienbaar, in `/tmp/rtg-appwerkt-os-query-browser.log`.
  APPWERKT en zijn raakvlakregister blijven bytegelijk. Dit vervangt niet
  de acht-dimensiekwalificatie, de volledige videoverbinding of de
  kwalificatie van bestemmingsschermen.

De strengere bronmeting rapporteerde na de herkomstcorrectie nog 163
DS-contractfouten, waaronder 59 onbesliste laadgrafen. De negen verwijderde
uitzonderingen en de gerichte browserresultaten mogen die restlijst niet
verbergen. De statische teller is daarmee nog niet volledig gekwalificeerd.
De daaropvolgende shell- en identiteitsloaderreparaties verminderen concrete
berekende laadpaden; de volgende bronmeting moet de actuele rest bepalen.

De historische APPWERKT-stand is 112/114 op `0afc8afa15`. De broncontrole
markeert 912 bijbehorende bewijsdimensies als verlopen voor deze gewijzigde
werkboom; 112/114 wordt dus **niet** als actuele kwalificatie gepresenteerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 volledig gekwalificeerde routes en
0/3.368 volledig bewezen voorwaarden. De inventaris wordt niet verkleind.
Menselijke taakproeven, resterende schermfamilies, financiële/operationele
kwalificatie en twee onafhankelijke eindruns blijven open. Geen merge of
productie-uitrol uitgevoerd.

#### Redirects, werkdocumenten, Partner Network en Library — 31 oktober

Deze aanvullende snede gebruikt dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b`
plus de gewijzigde werkboom en Node 26.12.1. Het is lokaal ontwikkelbewijs;
er is nog geen schone, bevroren kandidaat of menselijke Experience-goedkeuring.

- **Alle twintig bestaande redirects zijn afzonderlijk gecontroleerd.** De
  laatste vijf ingangen behouden hun oorspronkelijke bestemming, query- en
  fragmentregels, meta-refresh en vervangende geschiedenis. Bron- en echte
  browsercontrole slagen 22/22 in `/tmp/rtg-redirect-volledig-browser.log`.
  De bestemmingspagina's in die proef zijn expliciete read-only fixtures;
  de proef bewijst niet hun bedrijfsprocessen. Kantoorpda en Zorgbalie waren
  al aliases in SCHERMEIGENAAR; de bestaande wereldclassificatie is daarop
  aangesloten. De inventaris blijft **316 routes: 296 interfaces en 20
  redirects**, zonder routes weg te laten. Daardoor leidt dezelfde compiler
  nu 3.360 toepasselijke voorwaarden af in plaats van 3.368; de acht vervallen
  voorwaarden horen uitsluitend bij de twee correct geclassificeerde aliases.
  Dit levert geen enkel nieuw geslaagd bewijs op.
- **Project Room en Decision Room delen één DS-presentatiecomponent.** De
  bestaande controllers, RTG/RTF-huizen, API's en rollen blijven leidend.
  Native dialogen behouden invoer bij serverfouten en tonen de fout binnen de
  modal. De review vond die aanvankelijk onbereikbare foutmelding; die is
  hersteld. Grote tekst liep in het besluitregister aanvankelijk over; tekst
  mag nu binnen de beschikbare ruimte afbreken. Echte lokale API-fixtures
  gebruiken een persoonlijke kantooruitnodiging en RTMail naar project en
  voorstel, zonder besluit of betaling. De browserproeven slagen 2/2 in
  `/tmp/rtg-werkdocument-herstel-browser.log`: zeven panelen op 390/820/1440 px
  bij 100/200% tekst, huiswisseling, native modaliteit, toetsenbord, focusherstel,
  echte 400-antwoorden en behoud van invoer. De latere menuregessie behoudt
  beide groene Room-proeven in `/tmp/rtg-room-partner-menu-browser.log`.
- **Gedeelde menuplaatsing is expliciet gemaakt.** De bestaande Appmenu-owner
  gebruikt op DS een zichtbaar `header[data-rtg-menu-host]`; Room, Partner en
  Library verklaren hun eigen host. Het menu zweeft daardoor niet over het
  Room-merk. Onzichtbare hosts houden hun fallback; geen nieuwe controller.
  De bestaande PDA-menuproef slaagt in de laatste genoemde browserselectie.
  Native browserchrome mag focus krijgen; achterliggende appbediening niet.
  De gedeelde testhelper controleert ook terugkeer naar hetzelfde dialoogveld
  en hervatting van de Tab-cyclus, zonder productfocus te simuleren.
- **Partner Network behoudt echte cijferbronnen en de bestaande reactie-API.**
  Reacties vereisen het werkelijke `ok:true`-contract en dezelfde aanvraag-ID.
  Fouten blijven in de dialoog, en een verlaat antwoord kan na actorwisseling
  of een nieuwe opening geen ander concept sluiten. Layout op viewportbreedte
  faalde in een smalle werkruimte met 200% tekst; intrinsieke flex-wrap maakt
  de indeling nu ook zonder bruikbare containerquery veilig. De laatste
  browserselectie slaagt 4/4 in `/tmp/rtg-partner-intrinsiek-browser.log`.
  Login en overzicht zijn echt lokaal; de aanvullende vraag en negatieve
  submitantwoorden zijn expliciete UI-fixtures. Dit is geen verzend- of
  volledige partnerautorisatiekwalificatie.
- **Library blijft FoundationOS en behoudt de volledige bestaande keten.**
  Eén DS-component vervangt de exclusieve stylesheet. Alle drie panelen blijven
  bereikbaar op mobiel en tablet; het eerdere tussenformaat kon Publicatie
  verbergen. De bestaande controller is uitsluitend voor DS-klassen en
  statuspresentatie aangepast en via de bestaande bundelaar gesplitst; de API
  is behouden. `/tmp/rtg-library-ds-browser.log` slaagt 1/1 met zes formaat/
  tekststanden, conceptbehoud, springlink, Foundation-identiteit en echte
  Work → Edition 1 → lezen/notitie/feedback → correctie → Edition 2. De
  HTTP-nacontrole bewijst behoud van de oorspronkelijke editie. Geen menselijke
  beoordeling of productie-isolatie wordt hiermee geclaimd.
- **Vervangen code is daadwerkelijk verwijderd.** De twee Room-stijlbladen
  (28.177 bytes), Partner Network (18.027 bytes) en Library (4.396 bytes)
  hebben geen actieve consument meer en zijn verwijderd: samen **50.600 bytes
  exclusieve legacy-CSS**. Gedeelde legacy-bladen met overige consumenten blijven
  staan en blijven open migratiewerk. De gerichte pure selectie slaagt 56/56
  in `/tmp/rtg-schermfamilies-pure.log`.

Beelden voor technische review staan onder
`../output/werkdocument-review-20261031/` en `../output/library-review-20261031/`.
Dit is geen menselijke vrijgave. De bronherkomstcontrole slaagde onafhankelijk
87/87 in `/tmp/rtg-herkomst-onafhankelijk-herproef.log`; gecodeerde of niet
herleidbare scriptpaden blijven fail-closed. De DS-laadgraaf bevat nog open
gedeelde bewijsgrenzen. Nieuwe statische migratietellingen worden pas na een
actuele bronmeting gerapporteerd. APPWERKT blijft opnieuw te kwalificeren;
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 actuele voorwaarden.
Geen merge, productie-uitrol of volledige eindrun uitgevoerd.

#### Gedeelde presentatieowners en Horeca — 31 oktober, vervolg

De bron blijft HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom, lokaal onder Node 26.12.1. De volgende
resultaten zijn gerichte ontwikkelproeven, geen nieuwe kandidaatkwalificatie.

- **Appmenu, Randen en Bediening lezen de actuele DS-context.** Appmenu neemt
  de oorspronkelijke context direct bij uitvoering vast; onzekere laadpaden
  blijven door de bronanalyse geblokkeerd. De bronownerproeven slagen 105/105
  (`/tmp/rtg-bronowners-definitief-pure.log`) en de gerichte browserselectie
  7/7 (`/tmp/rtg-sharedowners-final-browser.log`). Randen is in zijn canonieke
  bundelpart hersteld, niet uitsluitend in de gegenereerde bundel. De late
  DS-regressie faalde eerst en slaagt daarna in de 26/26 selectie
  (`/tmp/rtg-randen-bronparts-na.log`). Bediening behoudt een geopend venster
  en gebruikt na sluiten/heropenen de actuele native DS-dialoog. De vier
  Instellingen-browserproeven bewijzen behoud van invoer, focus en bestaande
  instellingen; oude presentatie wordt bij de overgang verwijderd.
- **Lettertypen en broncontrole zijn behouden.** Room en Partner laden de
  bestaande eigen fonts. De browser controleert werkelijk geladen FontFaces;
  alleen een geslaagde CSS-fontnaamcontrole zou onvoldoende zijn. De twee
  Room-proeven en vier Instellingen-proeven slagen samen 6/6 in
  `/tmp/rtg-instellingen-room-browser.log`. De actieve stylesheetgraaf mag
  uitsluitend DS en eigen fonts bevatten, ook wanneer de server ze bundelt.
  Basis is op de bestaande themagrens in bronparts verdeeld; de uitvoerbytes
  zijn identiek (`/tmp/rtg-basis-modulegrens-bewijs.json`).
- **Negen bestaande horecaschermen delen DS-presentatie.** HACCP, Club,
  Events, Hotel, Expeditie, Bezorg en Beheer behouden hun enterpriseowner;
  Bar en Vloer behouden hun operationele controllers. De profielcontrole
  volgt het echte antwoordcontract en aanvaardt een managerrol alleen als
  boolean. Het bestaande Appmenu wordt expliciet geladen waar de
  iOS-uitschakeling anders ook het menu tegenhield. De familieproef slaagde
  10/10 (`/tmp/rtg-horeca9-browser.log`), met echte lokale actor- en
  werkstromen en formaat/tekstcontroles. De exclusieve, niet meer geladen
  `horeca-enterprise-modules.css` is verwijderd: 4.316 bytes, bovenop de
  eerder gemelde 50.600 bytes exclusieve legacy-CSS.
- **Strengere Vloer-controle blijft zichtbaar.** De aanvullende proef klikt
  werkelijk op het gekoppelde 44px-label buiten het kleine checkboxvakje en
  herstelt de oorspronkelijke keuze. Zij vond een bedekkende toast. Alle
  negen horecameldingen gebruiken nu de bestaande `ds-melding`; de dubbele
  vormgeving is verwijderd, tekst en levensduur blijven bij dezelfde owner.
  Gerichte meldingsproeven slagen 11/11. De daaropvolgende kleine-viewportproef
  vond nog een raakvlak met de vaste Edge; bereikbaarheid via normaal scrollen
  en toetsenbord is nog te sluiten. De oude 10/10 vervangt dit strengere
  open bewijs niet.

Notities, Agenda, Bestanden en Pulse zijn het volgende gedeelde bouwpakket;
hun bronmigratie is in uitvoering en nog niet afgesloten. De Experience-
pipeline ondersteunt nog geen volledige getypeerde configuratiematrix met
onafhankelijke bewijsaggregatie. Een normale viewportproef mag daardoor niet
alle voorgeschreven toestanden of apparaten groen verklaren. Dit blijft
werk binnen de bestaande compiler en Observatory, zonder tweede register.

APPWERKT moet op de gewijzigde bron opnieuw worden gekwalificeerd; de
historische 112/114 is geen actuele uitslag. EXPERIENCEWERKT blijft 0/114
apps, 0/316 routes en 0/3.360 volledig gekwalificeerde dimensieverplichtingen.
De onderliggende toestand- en apparaatcontroles zijn uitgebreider dan deze
dimensieteller. Menselijke proeven, veiligheids- en operationele kwalificatie
en twee onafhankelijke volledige eindruns blijven open.

#### Daily, invoercontinuïteit en configuratiematrix — 31 oktober, vervolg

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Geen kandidaat-, merge- of
productievrijgave. Onderstaande resultaten zijn ontwikkelbewijs.

- **Daily-presentatie geconsolideerd.** Notities, Agenda, Bestanden en Pulse
  gebruiken bestaande domeinowners met drie centrale DS-componenten.
  Beide uitsluitend door deze familie gebruikte oude stijlbestanden zijn na
  consumentencontrole verwijderd: **12.460 bytes**. Met de eerder beschreven
  vijf verwijderde bladen is dat 67.376 bytes exclusieve legacy-CSS in deze
  afbouwreeks; dit is geen claim over netto platformomvang.
  Bestanden is op de bestaande grens tussen overzicht en uploadbediening
  in canonieke bronparts verdeeld, met één bestaande browserbundel.
- **Gevulde toestanden en fouten zijn werkelijk beproefd.** De lokale
  browser gebruikt een echt account en echte notities, upload, map,
  afspraak, bericht en uitvoerfunctie. De selectie slaagt 9/9 inclusief
  drie echte Notities-ownerproeven. Een vertraagde verwijderfout van A mag
  niet verschijnen in editor B; een late succesvolle verwijdering ververst
  wel het bord. Onafhankelijke review bevestigt deze begrenzing.
  Weekacties blijven minimaal 44px en horizontaal bereikbaar binnen de
  kalender, ook bij grote tekst. De gevulde mappennavigatie is eveneens
  44px. Schermafbeeldingen staan in `../output/daily-review-20261031/`;
  technische beeldcontrole is geen menselijke Experience-vrijgave.
- **Vloer en Edge-vervolg gesloten binnen de geteste bediening.** De
  strengere Vloer-labelproef slaagt 1/1 na gewoon gebruikersscrollen, zonder
  forceclick, verborgen overlay of rechtstreekse statuswijziging
  (`/tmp/rtg-vloer-label-eindresultaat.log`). De vaste Edge reserveert via
  bestaande DS-CSS documentruimte voor toetsenbordscrollen; de drie Basis-
  browserproeven slagen. Dit bewijst deze pointer- en focusgevallen, niet
  ieder platformscherm.
- **Meetmatrix kan niet meer door één normale weergave groen worden.**
  De bestaande Experience-compiler leidt voor destination toestanden,
  apparaten en netwerken af, met vier expliciete Chromium-profielen.
  Ontbrekende configuraties blokkeren zowel requirement als dimensie.
  Exacte configuratiehashes, afzonderlijke runbestanden en levende
  procesreceipts verhinderen samenvoegen van losse runs of import als
  uitvoeringsgezag. Pure integratie: 141/141 in
  `/tmp/rtg-experience-multi-config-pure.log`. Hotels-browser: 10/10 in
  `/tmp/rtg-hotels-multi-config-browser.log`, inclusief bestaande aanvraag.
  Vier normale matrixcellen zijn maximaal 4/180; andere toestanden en
  netwerken blijven open. Deze vuile ontwikkelwerkboom produceert daarmee
  geen nieuwe kandidaatgebonden PROVEN-claim.

Foundation Studie/Hulpwijzer/Steun en de gedeelde Connection-/Deelmenu-
presentatie worden aansluitend afgewerkt. Bronreviews sloten twee echte
coachproblemen: expliciete foutantwoorden worden niet als antwoord getoond,
en late antwoorden van een vorig gezinsprofiel worden niet gepubliceerd.
De browsercontrole vond daarnaast gedeelde sectiebediening en layoutgrenzen;
die blijven open tot de gerichte tegenproeven slagen.

APPWERKT blijft op deze bron opnieuw te kwalificeren; 112/114 is historisch.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Broninventaris, menselijke beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven afzonderlijke poorten.

#### Foundation-kindroutes, Uitstap en Sprong — 4 november

Bron: HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Vier Foundation-routes gebruiken de centrale presentatie.** Gevoel,
  Pesten, Opvoeden en Mediawijs gebruiken de bestaande Foundation-, coach-,
  sessie-, Samen- en wereldnavigatie-eigenaren. Acht eigen stijlblokken,
  vierentwintig verwijzingen naar vervangen erfenisbladen en vier
  Levendekleur-loaders zijn uit deze routes verwijderd. Gevoel en Mediawijs
  hebben alleen hun bestaande routebediening in canonieke bronbestanden
  gekregen; Mediawijs blijft één gegenereerde browserbundel.
- **Bestaande profielraces zijn gesloten.** Gevoel bindt dagboek-, toestemmings-
  en opslagantwoorden aan code, token en profiel. Alleen de nieuwste dagboekread
  mag publiceren; opslag van keuze A kan keuze B niet als opgeslagen tonen.
  Pesten serialiseert de gezinsmelding, controleert het werkelijke
  serverontvangstbewijs en laat een nieuw of geweigerd concept staan. Gerichte
  bronproeven slagen 15/15 voor deze twee eigenaars binnen de gecombineerde
  Foundation-selectie.
- **Echte Foundation-browserstroom slaagt 6/6.** De proef gebruikt echte
  ouder- en kindsessies, oudertoestemming onder 16, eigen toestemming vanaf 16,
  dagboekopslag en wissen, een werkelijk bericht in de ouderinbox, alle zes
  opvoedonderwerpen, Mediawijs-keuzes en een echte leeftijdsweigering.
  De vier routes zijn tevens gecontroleerd op 390/820/1440 px en 100/200%
  tekst. Een eventwacht die onder zware parallelle broncontrole kon missen is
  vervangen door observatie van het werkelijk herladen document.
- **Uitstap blijft onmiddellijk bereikbaar.** Dezelfde bestaande vluchtknop
  volgt de werkelijke bovenste native dialoog of Foundation-toegangsdeur,
  zonder home-inertheid, sessie, opslag of navigatiecontract te wijzigen.
  Zes gerichte proeven, waaronder een echte Chromium-proef met omgekeerde
  dialoogvolgorde en 200% tekst, slagen.
- **Sprong is veiliger en statisch bewijsbaar.** De bestaande DS-stijlgrens is
  vóór eigen documentaliassen vastgelegd en blijft ook een later gezette
  marker controleren. Beide gegenereerde indexen mogen uitsluitend interne
  `/apps/`-routes openen; externe, script- en padtraversaladressen worden
  geweigerd. De laadgraaf houdt onbekende routes fail-closed. De gerichte
  Sprong- en indexselectie slaagt 12/12; de handelingindex is opnieuw uit de
  actuele schermbediening gegenereerd.
- **Statische waarheid blijft rood waar bewijs ontbreekt.** De actuele
  broninventaris `/tmp/rtg-ds-actuele-consolidatie-20261104.json` bevat 88
  DS-gemarkeerde documenten, 159 legacy-stijlbladen, 218 eigen stijlblokeigenaren
  en 125 stijlinjecterende scripts. Nul documenten zijn volledig statisch
  gekwalificeerd doordat de transitieve laadgraaf nog open paden bevat. De
  productnoemer blijft 316 routes; de broninventaris telt daarnaast overige
  HTML-documenten en verlaagt die noemer niet.

APPWERKT-bewijs is door deze bronwijzigingen opnieuw te kwalificeren.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke beoordeling, operationele proeven en twee
schone onafhankelijke eindruns blijven open.

#### Gedeelde laadowners en begrensde navigatie — 4 november, vervolg

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit zijn gerichte bouwproeven,
geen volledige herkwalificatie. De laadgraafmeting telt gepropageerde
onzekerheden per document; de eigenaarstelling telt unieke actieve of mogelijke
injectiebronnen die die documenten werkelijk bereiken.

- **De bestaande iOS-laag heeft één presentatiegrens.** De vier canonieke
  bronparts en hun ene browserbundel gebruiken een begrensde CSS-loader voor
  de legacyfallback; runtime-stijlinjecties en berekende navigatie zijn
  verwijderd. De gedeelde fallback staat in `public/ds/componenten/ios.css`.
  Gerichte bronproeven slagen 61/61 en de iOS-browserproef 3/3. Hierdoor daalde
  het aantal actieve of mogelijke injectie-eigenaren in de laadgraaf van 123
  naar 72; dit verwijdert een gedeelde oorzaak in plaats van routes uit de
  productnoemer te halen.
- **World Desktop gebruikt begrensde productroutes en beelden.** De bestaande
  presentatieowner verklaart lokale appbestemmingen en bestaande lokale
  fotografie via twee expliciete helpers. Zes echte wereldroutes blijven in
  één werkruimte bruikbaar. Bronselectie 43/43 en browserselectie 1/1 slagen.
- **Metgezel en Gebaar delen controleerbare laadcontracten.** Metgezel gebruikt
  één begrensde loader voor Wauw, Stroom, Rahul-tab en Handenvrij; zijn
  waarheidsproef onderscheidt bronvermeldingen van uitgevoerde acties.
  Gebaar gebruikt twee begrensde loaders en native documentnavigatie. De
  gerichte Metgezel-selectie slaagt 28/28; Gebaar 57/57 en zijn vijf
  muis-, touch-, toetsenbord-, herstel- en gebaarbrowserproeven 5/5. De
  bestaande service-worker-vingerafdrukken zijn na bronwijzigingen via de
  eigen generator vernieuwd.
- **Editorial V4 bouwt geen willekeurige fragmentadressen meer.** Alle drie
  springlinkpaden lopen door één helper die uitsluitend een bestaand DOM-doel
  accepteert en zo nodig de vaste inhouds-ID zet. De actuele basis-tests zijn
  aangepast aan de reeds aanwezige begrensde stylesheet- en controllerloaders;
  de bewijsnorm bleef gelijk. Broncontracten slagen 63/63, de gerichte
  browsertoegankelijkheidsproef 1/1 en de offline-vingerafdrukcontrole 6/6.
- **Adaptive Edge gebruikt één begrensde routepoort.** Home- en contextacties
  accepteren uitsluitend lokale `/apps/`-bestemmingen en lopen door dezelfde
  corehelper. Externe protocollen, padtraversal en ongeldige adressen falen
  dicht. De bronselectie slaagt 62/62 en de werkelijke LivingOS-browserselectie
  10/10. De verouderde Notities-fixture is vervangen omdat Notities aantoonbaar
  al de centrale DS-Edge gebruikt; het product is niet teruggezet naar de
  oude Adaptive Edge om de toets passend te maken. De laadgraaf daalde hierdoor
  van 10.366 naar 9.578 onzekerheden.
- **Palet is geen tweede Spotlight meer.** `RTGPalet` is nu uitsluitend een
  bevroren compatibiliteitsingang naar de bestaande Sprong-owner. De historische
  Ctrl/Cmd+Spatie-sneltoets blijft werken, maar de tweede dialoog, eigen recents,
  losse catalogus en eigen route-uitvoering zijn verwijderd. Bron- en
  laadgraafselectie slagen 42/42. Een echte DS-browserproef bewijst 2/2 dat de
  sneltoets dezelfde toegankelijke Sprong-dialoog opent, zonder `rosPalet` of
  tweede owner. De offline-ID-controle blijft 6/6 groen.
- **Beeldbronnen worden bewezen als beeld, niet als documentloader.** De
  laadgraaf herkent uitsluitend een native, niet-ontsnapte `img`-bron; aliassen,
  setters, gewijzigde DOM-bindings en onbekende ontvangers blijven door nieuwe
  tegenproeven geblokkeerd. Handenvrij Oog, de persoonlijke beeldeditor en de
  People-widget gebruiken aantoonbare elementidentiteiten. People kiest zijn
  gevalideerde gespreksroute vóór het bouwen van de link en heeft niet langer
  twee routeowners. Bronselectie 61/61 en de relevante Handenvrij-, beelden-
  en World Desktop-browserstromen 5/5 slagen. De laadgraaf daalde via 8.529
  naar 7.485 onzekerheden.
- **Heritage-volgorde en Uurwerk hebben vaste eigenaren.** Heritage-order zoekt
  uitsluitend de IDs die de bestaande basisloader en statische Heritage-routes
  al vastleggen; twee URL-heuristieken zijn verwijderd. Uurwerk bewaart alleen
  tijd en toestand in JavaScript en laadt één statisch presentatieblad; de twee
  runtime-stijlinjecties zijn verwijderd. De bronselectie slaagt 41/41 en een
  echte reduced-motion-browserproef 1/1. De offline schillen zijn met hun eigen
  generator vernieuwd en de ID-controle blijft 6/6 groen. Dit bracht de
  laadgraaf naar 6.565 onzekerheden en de actieve of mogelijke injectieowners
  van 72 naar 71.
- **De laadgraaf is meetbaar kleiner.** Vanaf de actuele meting van 29.187
  gepropageerde onzekerheden daalde de reeks na iOS naar 13.312, na World
  Desktop naar 12.529, na Metgezel naar 11.746, na Gebaar naar 11.056 en na
  Editorial V4 naar 10.366, na Adaptive Edge naar 9.578 en na de
  Palet-consolidatie naar 9.054, na Handenvrij Oog naar 8.529, na de gedeelde
  beeld- en linkcontracten naar 7.485 en na Heritage/Uurwerk naar **6.565**.
  De snapshots staan onder `/tmp/` met prefix
  `rtg-ds-na-*-20261104.json`. Tussentijdse blootlegging van voorheen niet
  bereikbare owners bleef zichtbaar; de reeks is dus geen cosmetische
  noemerverlaging.

De laadgraaf bevat nog 71 actieve of mogelijke injectie-eigenaren en 6.565
gepropageerde onzekerheden. De volgende pakketten worden op gedeelde impact
gekozen. APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd;
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Geen volledige eindrun, menselijke Experience-vrijgave,
merge of productie-uitrol is uitgevoerd.

#### RTG Geld — een presentatieowner en gesloten laadgraaf — 5 november

Bron: HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Veertien Geld-standen delen één presentatiecontract.** De bestaande
  standidentiteiten en productlogica zijn behouden, maar hun veertien runtime-
  stijleigenaren zijn verwijderd. `public/ds/componenten/geld.css` is nu het
  ene, onder `.ds-geld` begrensde componentblad dat `geld.html` vóór de
  standen laadt. De overbodige tweede overzichtseigenaar
  Het voormalige script `overzicht-a.js` is verwijderd. Het component is bewust
  alleen op Geld geladen en vergroot dus niet de globale DS-payload.
- **De echte laadpaden zijn statisch bewijsbaar.** Balans laadt de bestaande
  toestelkluis via één begrensde native scriptloader; RTG Code verklaart zijn
  vier letterlijke bestaande scriptbestemmingen; de CSV-export gebruikt een
  aantoonbaar lokaal downloadanker. De laadgraaf accepteert zo'n anker nu ook
  binnen hetzelfde lexicale `try`-blok, maar aliassen, setters, gewijzigde
  DOM-bindings en escapes blijven fail-closed.
- **Gerichte bron- en browserproeven zijn groen.** De Geld- en laadgraafselectie
  slaagt 83/83. De echte Geld-browserproef opent vier hoofdingangen en twaalf
  vertrouwde standen: 1/1. `git diff --check` is voor dit pakket schoon.
- **Meetbare schuldreductie, zonder groenverklaring.** De gepropageerde
  laadgraaf daalde in dit sluitstuk van 147 naar 139 onzekerheden. Geld zelf
  daalde van zeven naar nul; de lexicale ankerverbetering sloot tevens één
  bewezen downloadpad in Werk. Snapshot:
  `/tmp/rtg-ds-na-geld-compleet-20261105.json`. De afzonderlijke
  ontwerpsysteemcontrole blijft terecht rood met 159 bestaande
  platformschendingen; Geld voegt daar geen nieuwe schending aan toe.

APPWERKT blijft op deze gewijzigde bron opnieuw te kwalificeren.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### WorkOS-communicatie, Zaakregie, Ondernemerpoort en Uurwerk — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit zijn gerichte bouwproeven,
geen kandidaat-, merge- of productievrijgave.

- **CollegaChat heeft één presentatie-eigenaar.** Dialoog, berichten en
  ongelezenstatus blijven in de bestaande gedeelde gedragsmodule; beide
  werkhosts gebruiken nu `ds-collegachat`. Het losse stylesheet is verwijderd.
  Focus bij openen en sluiten, Escape, safe areas, reduced motion en 44px-
  bediening slagen in de echte Chromiumproef. De functionele bericht- en
  ongelezenproeven blijven groen.
- **Zaak Command deelt één DS-contract voor manager en PDA.** De bestaande
  serverautorisatie en vijf werkplekken zijn behouden. Het losse stylesheet en
  zes inline-presentatieuitzonderingen zijn verwijderd; velden en linkknoppen
  gebruiken expliciete componentklassen. De mobiele duimstand slaagt in een
  echte browser en de gedeelde bron-/laadgraafselectie blijft groen.
- **De Ondernemerpoort blijft dezelfde onboarding uitvoeren.** Band, modal en
  toast gebruiken nu `ds-ondernemerpoort`; het losse stylesheet is verwijderd.
  De servergestuurde stappen, grandfathered online-status en rondleidingen zijn
  ongewijzigd. Focusherstel, Escape, modaliteit en 44px-bediening zijn in de
  mobiele browser tegenbeproefd.
- **Uurwerk behoort aan het Design System zonder een tweede runtime.** De
  bestaande controller bewaart tijd, gangreserve en lokale toestand. Alleen
  het statische presentatiestijlblad verhuisde naar `public/ds/uurwerk.css` en
  gebruikt nu semantische tokens. Reduced motion en de decoratieve,
  niet-interactieve ganglijn zijn in een echte browser bewezen.
- **De actieve visuele schuld is kleiner.** De afdwingbare restlijst daalde in
  dit pakket van 16 naar **12** expliciete legacy-stijlowners. Alle betrokken
  gerichte bron-, architectuur-, functionele en browserselecties zijn groen;
  `git diff --check` is schoon.

Het commitgebonden Experience-register is opnieuw exact afgeleid uit 114 apps
en 316 schermen. EXPERIENCEWERKT blijft terecht 0/114 apps, 0/316 schermen en
0/3.360 dimensieverplichtingen omdat de volledige geautomatiseerde en
menselijke kwalificatie nog niet is uitgevoerd. APPWERKT moet op de uiteindelijke
kandidaat opnieuw worden gekwalificeerd; dit pakket is geen Deep Green-claim.

#### Deep Green-vrijgavecontract, Spraak en Borden — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge-, bèta- of productievrijgave.

- **Acht aanvullende vrijgavepoorten staan fail-closed in de bestaande
  Experience-afleiding.** `coverage-contract.json` en `EXPERIENCEWERKT.json`
  dragen nu bewijsafhankelijkheden, negatieve contracten, data- en
  clientmigratie, productieachtige concurrency en belasting, externe
  afhankelijkheden, meetbare Experience-budgetten, operationeel
  incidentherstel en twee onafhankelijk opgebouwde bewijsruns. Zij beginnen
  alle acht op `NOT_TESTED`. Daardoor kunnen volledige app- en schermtellers
  de integrale status niet zelfstandig op groen zetten.
- **De bestaande bewijsgrens blijft gezaghebbend.** Commit, volledige
  bronvingerafdruk, testconfiguratie, artefacthash, proceslog, geldigheidsduur
  en nul skips waren al verplicht en zijn niet vervangen. De globale
  bronvingerafdruk blijft voorlopig bewust de veilige bovengrens: iedere
  relevante bronwijziging laat oud bewijs verlopen. Selectieve vernieuwing
  mag die reikwijdte pas verkleinen wanneer de afhankelijkheidsgraaf zelf is
  bewezen; onzekerheid blijft breder meten.
- **Experience-budgetten zijn machineleesbaar.** LCP p75 maximaal 2.500 ms,
  INP p75 maximaal 200 ms, CLS p75 maximaal 0,1, minimaal 44 px interactieve
  bediening, nul onverklaarde visuele regressies en nul kritieke menselijke
  bevindingen zijn onderdeel van hetzelfde contract. Menselijke kwaliteit
  blijft door de bestaande artefactpoort geblokkeerd totdat een
  gezaghebbende menselijke beoordeling bestaat.
- **Spraak gebruikt één centrale presentatie.** De vier bestaande hosts
  houden hun ene gedragsowner; legacy-hosts laden begrensd de bestaande
  DS-root en de knop krijgt `.ds-spraakknop`. Het verwijderde
  `shared/spraak.css` is vervangen door `ds/componenten/spraak.css`, met
  centrale focus- en doelmaten. De echte browserproef bewijst rusticoon,
  luistertoestand, resultaat, herstel, toetsenbordfocus en minimaal 44 px op
  zowel DS als legacy.
- **Borden gebruikt eveneens één centrale presentatie.** Leden,
  leveranciers en medewerkers houden dezelfde `BordenUI`-logica en API-
  acties. `shared/borden.css` is verwijderd; het bestaande Design System
  draagt nu werkbord, lijsten, kaarten, deadlines, teamleden en bediening.
  De browserproef bewijst dezelfde DS-root, focus, 44 px-bediening en
  foutvrije actie-uitvoering op beide hosttypen. De bestaande domeinproeven
  voor maken, verplaatsen, groepen, rollen en Business Pass blijven groen.
- **TeamCall consolideert zonder de verbinding opnieuw te bouwen.** Camera,
  microfoon, WebRTC-peers, signaling, TURN/STUN-verkrijging, meelezen en de
  gesprekslevenscyclus blijven bij de bestaande owner. Alleen
  `shared/teamcall.css` is vervangen door `ds/componenten/teamcall.css`.
  Overlay en wachtruimte krijgen centraal contrast, safe areas, focus en
  48 px-bediening; een echte browserproef bewijst starten, microfoon uit,
  ophangen, mediastop en foutvrije afbouw.
- **Kostenbeeld houdt financiële waarheid en presentatie gescheiden.** De
  centrale kostenkern, herkomstketen, autorisatie en centenafronding zijn
  ongewijzigd. Drie lezers gebruiken nu `ds/componenten/kostenbeeld.css`; het
  oude `shared/kostenbeeld.css` is verwijderd. De bestaande echte
  klantproeven bewijzen voor lid en zaak nog steeds: geen verzonnen nul zonder
  tarief, wel een herleidbaar bedrag met tarief, een openende herkomstketen,
  de juiste aanspreekvorm en server-side bewaarde verbruiksgrenzen. Daarbij
  bewijzen zij nu ook centrale DS-eigendom en minimaal 44 px bediening.
- **Gerichte verificatie is groen.** Experience-integriteit, afleiding,
  laadgraaf en Spraak slagen 126/126. Bordenpresentatie, domeincontract en
  laadgraaf slagen 88/88. Spraak en Borden slagen in de browser elk 1/1;
  TeamCallpresentatie en meelezen slagen 13/13 plus 1/1 in de browser.
  Kostenbeeld en laadgraaf slagen 84/84; de twee echte kostenketens slagen
  2/2 in de browser.
  `EXPERIENCEWERKT.json` is opnieuw exact uit 114 apps, 316 schermen en het
  actuele contract afgeleid. `git diff --check` is schoon.
- **De actieve visuele restlijst daalde van 20 naar 16 owners.** De
  ontwerpsysteemcontrole noemt uitsluitend die zestien bestaande owners;
  de poort blijft daarom terecht open. Er is geen vrijstelling, lagere norm
  of administratieve groenverklaring toegevoegd.

APPWERKT is op deze gewijzigde bron verlopen en moet na de bouwfase opnieuw
worden gekwalificeerd. EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en
0/3.360 volledig bewezen dimensieverplichtingen; ook de acht nieuwe
vrijgavepoorten zijn `NOT_TESTED`. Externe providers, migratie, belasting,
menselijke beoordeling, incidentrepetitie en twee schone onafhankelijke
eindruns blijven echte open voorwaarden.

#### Focus-, Inlogkleur- en Ondertitelbandconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **FocusUI houdt één gedragsowner en één presentatieowner.** De bestaande
  leergeschiedenis, privacyarme tellers en dynamische kaartherschikking zijn
  behouden. Vier grote hosts gebruiken nu `ds-focus`; het losse
  `shared/focus.css` met prioriteitsescalatie is verwijderd. De owner bewaart
  en herstelt uitsluitend tijdens sluiten de oorspronkelijke displaywaarde.
  Daardoor blijven oude ongelegerde kaartregels onder controle, later
  toegevoegde inhoud gesloten en domein-`hidden` fail-closed.
- **De levende inlogkleur blijft een rekenmotor.** Tijd, seizoen en dag
  bepalen nog steeds uitsluitend de vier levende variabelen en het bestaande
  onyx-vlak. De presentatie staat nu in `ds-inlogkleur`; vier hosts laden geen
  afzonderlijk `inlogkleur.css` meer en er is geen nieuwe thema- of
  stijllaag ontstaan.
- **Media delen één ondertitelcontract.** Clips, Media, Salon, Theater en
  Wereld gebruiken nu `ds-ondertitelband`. Tijdsprongen, einde, lege regels,
  tekstveiligheid en paginaspecifieke positievarianten blijven intact; het
  vervangen `shared/ondertitelband.css` is verwijderd.
- **Gerichte bewijzen zijn groen.** FocusUI slaagt 88/88 statische owner- en
  laadgraaftests plus 1/1 echte Chromiumproef op DS en bestaande hosts, met
  toetsenbord, dynamische inhoud, 200% tekst en domeingrens. Inlogkleur
  slaagt 85/85 inclusief 1/1 echte browserproef. Ondertitelband slaagt zijn
  drie gedragsproeven, de gerichte laadgraafproef en 1/1 echte browserproef.
- **De visuele erfenis is verder gekrompen.** De afdwingbare restlijst daalde
  over deze drie pakketten van 24 naar **21** actieve legacy-stylesheetowners.
  De controle blijft terecht rood zolang deze expliciete restlijst bestaat;
  de norm of noemer is niet verlaagd.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Scannerpresentatieconsolidatie — 5 november

De bestaande `RTGScanknop` blijft eigenaar van camera, BarcodeDetector,
eigen-QR-terugval en handmatige invoer. Alleen de presentatie is naar het
bestaande `ds-scanknop`-component verplaatst. Vier echte hosts gebruiken de
DS-root via de begrensde runtime-ingang; het losse `shared/scanknop.css` is
verwijderd. De overlay verklaart modaliteit, bewaakt veilige schermranden en
houdt iedere essentiële bediening minimaal 44 bij 44 pixels. Zonder camera of
scannermodule blijft de handmatige route direct bruikbaar.

De statische presentatie- en laadgraafselectie slaagt 84/84. De echte
Chromiumproef slaagt 1/1 en bewijst de handmatige uitweg, toegankelijk
dialoogcontract, minimale doelen, resultaat en gecontroleerd sluiten. De
ontwerpsysteemrestlijst daalde daarmee van 21 naar **20** actieve
legacy-stylesheetowners; de poort blijft terecht rood totdat ook die owners
zijn geconsolideerd.

#### Plek-, Gegevenspoort-, Overdracht- en Appmenuconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Drie gedeelde overlays gebruiken één presentatiecontract.** Plek,
  Poortgesprek en Commerce Overdracht blijven hun bestaande toestemming,
  opslag, lifecycle, autorisatie en uitvoeringscontract bezitten. Zij tekenen
  op beide hosttypen dezelfde DS-componenten; de vervangen
  `plek-legacy.css`, `poortgesprek-legacy.css` en `overdracht-legacy.css` zijn
  verwijderd. De gerichte statische selecties slagen respectievelijk 127/127,
  103/103 en 88/88. De echte browserproeven slagen 7/7, 1/1 en 3/3, inclusief
  200% tekst, lage viewport, toestemming, HTTP 428/503, hervatten en
  actorwisseling.
- **Appmenu blijft de functie-owner; DS Edge is de ene zichtbare systeemdeur.**
  De oude hamburger blijft alleen als bestaande controllerhook gemonteerd en
  wordt verborgen zodra de canonieke DS Edge werkelijk aanwezig is. De Edge
  leest de actuele `RTGAppMenu.functies()` en capability-gebonden
  `systeemfuncties()` uit, dedupliceert labels en voert exact dezelfde knop-,
  spring- of functiehandler uit. Daardoor blijven appfilters, Instellingen,
  Rahul, delen, rand-tot-rand en uitloggen via de bestaande owners bereikbaar,
  zonder tweede actieregister of controller.
- **De integratie is op echte schermen en de volledige appinventaris
  tegenbeproefd.** De contractselectie slaagt 32/32. De PDA-browserproef is
  groen op Studio, Hardware en Architect bij 390, 820 en 1440 px en bij 100%
  en 200% tekst. De brede appcensus slaagt 2/2 na 209 seconden en bevestigt dat
  iedere app-pagina een veilige systeemdeur houdt en geen dubbele Appmenu/Edge
  meer toont.
- **De actieve visuele erfenis daalde verder.** De afdwingbare
  ontwerpsysteemrestlijst ging door deze vier owners van 31 naar **27**. De
  volledige ontwerpsysteemcontrole blijft terecht rood op die expliciete
  resterende owners; er is geen drempel verlaagd en geen schending verborgen.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Kaartuitwijkconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **De privacyvriendelijke geo-uitwijk houdt één presentatie.** De bestaande
  `geo:`-parser, Android-systeemoverdracht, lokale kopieeractie en focusweg zijn
  ongewijzigd. Volledige DS- en oudere hosts gebruiken dezelfde
  `ds-kaartuitwijk` binnen het bestaande kaartcomponent. Een oudere host laadt
  alleen de bestaande DS-root; `kaart-legacy.css` is verwijderd.
- **De component gebruikt uitsluitend semantische DS-tokens.** Overlay,
  dialoog, waarde, uitleg en beide 44px-acties hebben een begrensd contract in
  `public/ds/componenten/kaart.css`; er is geen kaartprovider, tracker of
  tweede modaliteitscontroller toegevoegd.
- **Gerichte bewijzen zijn groen.** De negen parser-, laadgraaf- en
  presentatieproeven slagen 9/9. De nieuwe echte Chromiumproef slaagt 1/1 op
  zowel volledige DS als een oudere host bij 100% en 200% tekst, inclusief
  focusherstel, viewportgrenzen, achterliggend concept en afwezigheid van
  clientfouten. De afdwingbare visuele restlijst daalde van 25 naar **24**.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Deelmenuconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Eén sectieowner gebruikt op iedere host hetzelfde DS-component.** De
  bestaande `RTGDeel`-API, deep links, lokale stand, herscan en dynamische
  appdetectie zijn behouden. Alle hosts gebruiken nu `ds-tabs` en
  `ds-deelmenu`; oudere hosts laden alleen de bestaande DS-root. Het vervangen
  `deelmenu-legacy.css` is verwijderd.
- **Menuzichtbaarheid en domeinbevoegdheid blijven gescheiden.** Deelmenu
  beheert alleen zijn tijdelijke eigen weergave en herstelt per bestaande node
  exact de vorige inlinewaarde. Het verwijdert of verleent nooit het
  domein-`hidden`-attribuut. Daardoor kunnen bestaande ongelegeerde
  grid/flex-regels gesloten secties niet heropenen en blijven onbevoegde delen
  fail-closed, zonder verboden prioriteitsregel of cascadelaaguitzondering.
- **Gerichte bewijzen zijn groen.** De owner- en laadgraafselectie slaagt
  86/86 en `shared/deelmenu.js` is bytegelijk aan zijn bronmodules. De echte
  Chromiumproef is groen bij 390, 820 en 1440 px en 100%/200% tekst, en bevat
  nu ook een oudere host met conflicterende `.kaart { display:grid }`-CSS.
  Concept, node-identiteit, hash, domein-hidden en één menubalk blijven intact.
- **De guardian bepaalde de geldige oplossing.** Een eerste ongelegerde
  compatibiliteitsselector werd expliciet afgewezen en verwijderd; er is geen
  uitzondering of lagere drempel toegevoegd. De afdwingbare restlijst daalde
  van 26 naar **25** echte legacy-stijlowners.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Bedieningconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Alle hosts gebruiken dezelfde instellingenowner en -presentatie.** De
  bestaande `RTGBediening`-API, instellingseigenaren en focusherstel zijn
  behouden. Zowel een volledige DS-host als een oudere host opent nu dezelfde
  native dialoog met het bestaande `ds-instellingen`-component. Een oudere
  host laadt uitsluitend de bestaande DS-root; het vervangen
  `bediening-legacy.css` is verwijderd.
- **De native lifecycle behoudt actuele toestand.** Een herhaalde openactie
  bouwt alleen de gesloten weergave opnieuw op, zodat externe thema- en
  bewegingskeuzes actueel zijn. Een reeds geopende dialoog behoudt identiteit,
  focus en onopgeslagen achterliggende invoer. Taal, thema, beweging, draaien,
  volledig scherm, rand-tot-rand en gids blijven bij hun bestaande eigenaar.
- **Gerichte bewijzen zijn groen.** De owner-, bundel- en laadgraafselectie
  slaagt 93/93; de vier echte Chromiumproeven slagen 4/4 bij mobiel, desktop,
  100% en 200% tekst, inclusief native modaliteit, 44px-doelen, late
  hostmarkering en conceptbehoud. `shared/bediening.js` is bytegelijk aan zijn
  bronmodules en `git diff --check` is voor het pakket schoon.
- **De architectuurmeter bepaalde de grens.** Een eerste dubbele
  stylesheetdetectie werd als gegroeid injectiepad afgewezen en daarna bij de
  bron vereenvoudigd. Er is geen uitzondering toegevoegd. De afdwingbare
  restlijst daalde daardoor van 27 naar **26** echte legacy-stijlowners.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Redirectgrens, Conceptwerk en Foundation-presentatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit zijn gerichte bouwproeven,
geen kandidaat-, merge- of productievrijgave.

- **Twintig historische aliassen verklaren hun DS-grens.** De bestaande
  redirectdocumenten dragen nu expliciet `data-ds=1`. Daardoor laadt de
  gedeelde Sprong-owner op deze documenten geen legacy-presentatie meer. Hun
  bestemmingen, redirects en terugvalgedrag zijn niet gewijzigd. De gerichte
  bron- en echte browserselectie slaagt 107/107. De contractschendingen daalden
  van 159 naar 139 en de statisch schone inventaris van 26 naar 46. Die twintig
  documenten zijn redirects en tellen daarom niet als twintig nieuw
  gekwalificeerde productschermen.
- **Conceptwerk heeft een aantoonbare DS-grens.** De bestaande owner leest de
  native documentmarkering rechtstreeks. DS-hosts sluiten daarmee
  `conceptwerk-legacy.css` uit; oudere hosts behouden dezelfde fallback.
  De gerichte selectie slaagt 85/85. De contractschendingen daalden van 139
  naar 137, de gepropageerde erfenis van 11.526 naar 11.493 en de twee
  leverancierflows werden statisch schoon. Snapshot:
  `/tmp/rtg-ds-na-conceptwerk-grens-20261105.json`.
- **Foundation houdt gedrag en verwijdert twee vervangen presentatielagen.**
  `palet.js` blijft groep en seizoen verzorgen maar sluit `dagkleur.css` uit op
  DS. Zowel de gezinsbundel als de professionele OS-schil blijven dezelfde
  `wereldschil.js`, handvoorkeur, iconen en split view gebruiken, terwijl DS
  het bestaande `wereldnavigatie.css` bezit en `wereldschil.css` uitsluit. De
  bronbundel `foundation/sessie.js` is aantoonbaar gelijk aan zijn losse delen.
  De gerichte bronselectie slaagt 103/103; de echte Studie-browserstroom
  slaagt. De gepropageerde erfenis daalde van 11.493 naar 11.479 en de
  laadgraaf bleef op 139 expliciete onzekerheden. Snapshot:
  `/tmp/rtg-ds-na-foundation-presentatiegrens-20261105.json`.
- **De blootgelegde browseroorzaken zijn gesloten.** De Samen- en Rahulvensters
  reserveren op steunroutes nu het volledige 44px-raakvlak van de onmiddellijke
  Uitstap; de veiligheidsactie kan de verzendknop niet meer bedekken. De
  browserproef behandelt de afzonderlijk bewezen dubbele-Escape-uitstap niet
  langer als twee toevallige venstersluitingen. Antwoordbodies worden vóór een
  bewuste herlaadnavigatie gelezen. De gerichte statische selectie slaagt 24/24
  en tien echte Foundation-, profiel-, Rahul-, Samen- en Uitstap-browserflows
  slagen 10/10. De algemene bundelcontrole meldt nog de reeds bestaande
  afwijking in `shared/zaakcommand.js`; de gewijzigde Foundation-bundel zelf is
  coherent.

De ontwerpsysteemcontrole blijft terecht rood met 137 bestaande schendingen.
APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke beoordeling, operationele proeven en twee
schone onafhankelijke eindruns blijven open.

#### World Desktop-projectiegrens — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is een gericht bouwbewijs,
geen kandidaat-, merge- of productievrijgave.

- **De legacy-projectie blijft legacy; DS-routes erven haar Edge-presentatie
  niet meer.** `rtg-world-desktop.js` legt bij scriptstart één onveranderlijke
  DS-grens vast. Alleen de bestaande niet-DS-projectie laadt daardoor nog
  `rtg-edge-system.css` en `rtg-adaptive-edge.css`; de gewone DS-werkruimte
  behoudt dezelfde scripts en bestaande canonieke Edge-presentatie uit
  `public/ds`.
- **Het gedeelde effect is gemeten.** De gepropageerde erfenis daalde van
  11.479 naar 11.417, het aantal statisch schone pagina's van 56 naar 87 en de
  als gemigreerd herkende documenten van 48 naar 77. De laadgraaf bleef op
  139 expliciete onzekerheden. Snapshot:
  `/tmp/rtg-ds-na-world-desktop-projectiegrens-20261105.json`.
- **Gedrag en terugval zijn bewezen.** De gerichte laadgraaf-, DS-,
  projectie- en serverselectie slaagt 108/108. De echte Chromiumproef voor het
  gedeelde 30-Seconden-scherm slaagt 1/1 en bewijst dat de bestaande
  projectiepresentatie, schermcredential en privacygrens intact blijven.

De ontwerpsysteemcontrole blijft terecht rood, maar daalde van 137 naar 106
bestaande schendingen. APPWERKT en EXPERIENCEWERKT zijn op deze gewijzigde
bron nog niet integraal opnieuw gekwalificeerd; menselijke beoordeling,
operationele proeven en twee schone onafhankelijke eindruns blijven open.

#### Basis-, iOS-, Randen-, Kantoorgesprek- en URL-consolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **De centrale componenten hebben opnieuw één presentatieowner.** De dubbele
  Sprongregels zijn uit Basis verwijderd. iOS gebruikt op legacy-hosts het
  bestaande canonieke `shared/ios.css` en op DS-hosts uitsluitend het
  DS-component. Randen genereert voortaan zowel de compatibiliteitsklasse als
  de canonieke DS-klasse en heeft zijn dubbele `.rnd-*`-presentatie uit het
  DS-blad verwijderd. Kantoorgesprek is onder `.ds-kantoorgesprek` begrensd en
  gebruikt semantische tokens; het kreeg geen tweede token- of stijllader.
  De losse bronbundels van iOS en Randen zijn na de wijziging aantoonbaar exact
  opnieuw samengesteld.
- **Browserbewijs is aan de echte testowners gebonden.** De Foundation-kind-
  en Horecaroutes staan nu letterlijk in hun daadwerkelijke browserrunners in
  plaats van in een helper die zelf geen browser opent. Het DS-voorbeeld draagt
  zijn expliciete documentgrens. Hierdoor wordt ontbrekend bewijs niet langer
  administratief aan een verkeerd bestand toegeschreven.
- **Alle berekende adressen hebben een betekeniscontract.** Downloads gebruiken
  een aantoonbaar eigen anker; appnavigatie is tot dezelfde origin en `/apps/`
  begrensd; TravelOS-frames accepteren uitsluitend lokale appdocumenten;
  telefoon en e-mail hebben hun eigen schema; beelden komen uit vaste lokale
  collecties of uit de reeds gevalideerde persoonlijke beeldkluis. Living
  World begrenst alle servergeleverde stappen en bronlinks opnieuw in de
  client. De statische laadgraaf bevat daardoor voor geen enkele actieve
  DS-route nog een onbesliste laadbron. De schonere graaf legde eerst drie
  onderliggende bronnen bloot; ook die zijn via dezelfde productcontracten
  gesloten, niet met een whitelist of een lagere bewijsnorm.
- **De testbediening volgt de geconsolideerde Edge.** Volledige DS-schermen
  gebruiken de centrale `.ds-edge__balk`; legacy-hosts houden Adaptive Edge.
  De gedeelde browserhelper bedient nu beide bestaande presentaties via
  dezelfde zichtbare actie, zonder een oude Edge op DS-schermen terug te
  brengen. Agenda declareert haar twee contextacties expliciet als `Nieuwe
  afspraak` en `Agenda exporteren`.
- **Gerichte regressies zijn groen.** De statische bron-, laadgraaf-, agenda-,
  sandbox-, Living World-, Reisprogramma- en registerselectie slaagt 118/118.
  Veertig unieke echte browserflows slagen 40/40: Agenda, Hotels, Reisbureau,
  Living World, Reisprogramma, Reizen en Reizen & Veilig, inclusief mobiel,
  desktop, RTL, aanvragen, contextacties, eigen beeld, delen en ICS-export.
  `git diff --check` is voor dit pakket schoon.
- **De resterende schuld is exact.** De afdwingbare ontwerpsysteemcontrole is
  over deze consolidatiereeks van 106 naar **37** schendingen gedaald. Die 37
  bestaan uit 33 nog actieve legacy-stijlowners, drie gegroeide historische
  stijlinjectieowners en de ene nog niet geconsolideerde `!important`-regel in
  Levendekleur. Geen onbesliste DS-laadgraaf is meer onderdeel van die restlijst.
  Snapshot: `/tmp/rtg-ds-na-urlcontracten-20261105.json`.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. De menselijke beoordeling, operationele proeven en
twee schone onafhankelijke eindruns blijven open; daarom is dit geen Deep
Green-verklaring.

#### Edge-, School-, Levendekleur- en Sneltoetsconsolidatie — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **World Desktop en Adaptive Edge bezitten hun presentatie statisch.** Het
  gedeelde 30-Seconden-scherm verklaart de twee bestaande projectiebladen in
  het document. De runtime laadt alleen gedrag en de Adaptive Edge-loader
  gebruikt vaste stylesheetidentiteiten. Daardoor bestaan er geen gegroeide
  stijlinjectieowners meer in dit pakket en blijft de projectiepresentatie
  statisch herleidbaar.
- **De schoolsessie gebruikt het bestaande accountdeurcontract.** Vijf
  Foundation- en partnerschermen laden dezelfde tokens en accountdeur. De
  schoolsessie gebruikt native `dialog`, `inert`, `aria-hidden`, focusherstel
  en een begrensde MutationObserver voor laat toegevoegde documentdelen. Het
  vervangen `shared/rtg-school-session.css` is verwijderd; de Foundation-
  serviceworker bewaart de canonieke DS-bronnen en geen dubbele CSS-literals.
- **De levende kleurlaag en DS-root zijn coherent.** `rtg-ds.css` importeert
  nu elk DS-component exact eenmaal, inclusief Geld en Levendekleur. De enige
  verboden `!important` is verwijderd. De levende achtergrond gebruikt een
  geïsoleerde pseudo-laag, zodat wereldkleur onder de inhoud blijft zonder
  de toegankelijkheids- of cascadegrens te omzeilen.
- **Sneltoets heeft één presentatie voor DS en legacy.** Beide hosttypen
  gebruiken het bestaande `ds-sneltoets`-component; oudere hosts krijgen
  alleen de begrensde overlayvariant via de bestaande DS-root. Het vervangen
  `shared/sneltoets-legacy.css` is verwijderd. De acties, focus, grote tekst,
  modaliteit en onderdrukking tijdens een open venster zijn behouden.
- **Gerichte bewijzen zijn groen.** De laadgraafselectie slaagt 82/82. De
  schoolsessie- en Foundationselectie, inclusief echte browserflows, is groen;
  de gerepareerde late-DOM-toestand is afzonderlijk tegenbeproefd. De
  World Desktop-browserproef slaagt 1/1. Sneltoets slaagt 1/1 op de volledige
  DS-host en 2/2 op bestaande premium legacy-appflows. `git diff --check` is
  voor de betrokken bestanden schoon.
- **De actieve visuele erfenis krimpt aantoonbaar.** De afdwingbare
  ontwerpsysteemrestlijst daalde in deze reeks van 37 naar **31** bestaande
  stylesheetowners. Er zijn geen resterende stijlinjectieratels en geen
  verboden `!important`-regels in `public/ds`. De ene ontwerpsysteemtest die
  de volledige werkboom bewaakt blijft daarom terecht rood totdat ook deze
  31 expliciete owners geconsolideerd zijn; de interne contracttests zijn
  groen.

APPWERKT moet op deze gewijzigde bron opnieuw worden gekwalificeerd.
EXPERIENCEWERKT blijft 0/114 apps, 0/316 routes en 0/3.360 volledig bewezen
dimensieverplichtingen. Menselijke Experience-beoordeling, operationele
proeven en twee schone onafhankelijke eindruns blijven open.

#### Laatste actieve presentatieowners en APPWERKT-ingang — 5 november

Bron: dezelfde HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **De resterende gedeelde presentatieowners zijn geconsolideerd.** Split,
  taalkeuze, Rahul-mond, Rahulpoort, Uitvoer, Sprong, Conceptwerk,
  Foundation-sessie, Deur, Leverancier-overlays, WerkOS en Volscherm gebruiken
  op DS-hosts hun bestaande centrale component onder `public/ds/`. De
  vervangen losse legacybladen zijn verwijderd. WerkOS plaatst zijn vaste
  contextbalk buiten de getransformeerde topbalk, zodat zijn
  viewportgeometrie ook werkelijk vast blijft.
- **Volscherm behoudt gedrag zonder een nieuwe legacyowner.** Een DS-scherm
  gebruikt uitsluitend `public/ds/componenten/volscherm.css`. Nog niet
  gemigreerde hosts behouden tijdelijk hun reeds bestaande lokale
  compatibiliteitsregel; die regel kan pas verdwijnen wanneer de betreffende
  hosts zelf hun ongelayerde shell-CSS hebben verlaten. Er is geen nieuw
  stylesheet of tweede controller toegevoegd.
- **De afdwingbare architectuurpoort is nu schoon.** De controle meldt
  `geen schendingen`, **87 formeel gemigreerde schermen** en 71 nog vast te
  leggen verbeteringen. Dit betekent dat de actuele werkboom geen nieuwe of
  actieve contractschending in de Design-System-laadgraaf bevat; het betekent
  niet dat alle 316 schermen al gemigreerd of gekwalificeerd zijn.
- **Gerichte regressies zijn groen.** De Volscherm-owner- en laadgraafselectie
  slaagt 90/90. De echte browserproef slaagt 3/3 voor Wonen, Studio PDA en een
  losse DS-main, inclusief mobiel, focus, onbewaarde invoer, appvensters,
  herladen en toestelvoorkeur. WerkOS slaagt 2/2 in zijn echte desktop- en
  mobiele shellproef; de Foundation-toegangsproef slaagt 2/2; Deur slaagt 2/2;
  de Leverancier-ketens slagen 3/3. De bronbundels zijn coherent.
- **De APPWERKT-rest deelt één bronoorzaak.** Het bewaarde register staat op
  112/114. RTFoundation en Videobellen waren beide geblokkeerd doordat de
  preflight `/apps/app.html?pas=rtg` als letterlijke bestandsnaam behandelde.
  De actuele meter normaliseert querycontext naar het fysieke document en
  behoudt de query voor de browser. De gerichte contract- en meterproeven
  slagen 24/24, inclusief de negatieve proef voor een werkelijk ontbrekend
  querydocument. De volledige 114-app-browsermeting is bewust nog niet opnieuw
  gestart tijdens deze bouwfase; 114/114 wordt pas na die run geclaimd.

EXPERIENCEWERKT is opnieuw deterministisch afgeleid en klopt met 100% van de
inventaris: 114 apps en 316 schermen. De vrijgavestatus blijft terecht
0/114 apps, 0/316 schermen en 0/3.360 volledig bewezen
dimensieverplichtingen. De volgende gedeelde bouwoorzaak is het ontbreken van
onderhoudsarme Experience Signatures: de motor mag APPWERKT-interacties en het
bestaande appcontract hergebruiken, maar moet unieke wereld- en appidentiteit
blijven afdwingen zonder 114 kopieen van dezelfde metadata te onderhouden.


#### Experience-broncontract en Foundation Samen-owner — 5 november

Bron: HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Experience kan canonieke productbronnen hergebruiken zonder groen te
  erven.** Een app-signature kan haar bestaande productbelofte uit
  `appcontract` en haar volledige bedieningsnoemer uit APPWERKT projecteren.
  Identiteit, compositie, beweging, dichtheid en menselijke taken blijven
  expliciet. Een ontbrekende, incomplete, onaangeraakte of ongeldige bron
  blokkeert de signature; een scherm mag deze appbronnen niet lenen. De
  gerichte Experience-contractsuite slaagt 54/54.
- **Foundation Samen en gezins-Rahul hebben nog maar één presentatieowner.**
  Alle 56 bestaande Foundation-hosts laden de centrale tokens en
  `public/ds/componenten/samen.css` of de volledige DS-root. De bestaande
  browsercontroller bezit geen CSS-literals of runtime-stijlinjectie meer.
  Focusherstel, Escape, minimaal 44 x 44 px, conceptbehoud, profielcontinuiteit
  en dubbele-verzendbescherming gelden nu ook op de oudere Foundation-hosts.
- **De reductie is meetbaar en vastgerateld.** Het aantal door de
  ontwerpinventaris gevonden injecterende bronbestanden daalde van 101 naar
  **98**; de twee injecties van `foundation/samen.js` en het bereik over 49
  legacy-schermen daalden naar **0**. De 71 reeds gerealiseerde
  ontwerpnormverbeteringen zijn vastgelegd; de controle is daarna opnieuw
  schoon. Dit verandert de formele schermmigratiestand nog niet: die blijft
  87, omdat de overige presentatie van deze legacy-hosts nog niet volledig op
  de centrale DS-laag staat.
- **Gerichte regressies zijn groen.** De Foundation-, laadgraaf-, credential-,
  offline- en componentselectie slaagt 120/120. De echte browserproef slaagt
  4/4: drie volledige DS-routes plus de oudere Beheer-host, inclusief sessie,
  Samen, Rahul, focusherstel, 44px-doelen, fout-/concepthestel en horizontale
  stabiliteit. De Foundation-serviceworker bewaart de centrale Samen-component
  voor offline herstel. Bundels zijn coherent en de betrokken diff is schoon.

EXPERIENCEWERKT is opnieuw afgeleid en blijft eerlijk 0/114 apps, 0/316
schermen en 0/3.360 bewezen dimensieverplichtingen. APPWERKT blijft op het
bewaarde register 112/114 tot de volledige kandidaatmeting wordt uitgevoerd.


#### Centrale Cookie-, Samen- en Handenvrijowners — 5 november

Bron: HEAD `3b07587407ff9123dd8678dba0c63611d649d64b` plus de
gewijzigde integratiewerkboom; Node 26.12.1. Dit is gericht ontwikkelbewijs,
geen kandidaat-, merge- of productievrijgave.

- **Cookie heeft een centrale owner op alle 255 hosts.** 60 hosts gebruiken de
  volledige DS-root; 195 oudere hosts laden expliciet alleen tokens plus de
  bestaande cookiecomponent. De controller injecteert geen CSS meer. De
  tijdelijke legacyvariant bewaakt uitsluitend de centrale 48px-geometrie
  inline omdat ongelayerde host-CSS anders boven een DS-cascadelaag wint; deze
  overgangswaarborg blijft open tot de laatste legacyhost volledig is
  gemigreerd. De werkelijke browserproef slaagt 3/3, inclusief 320 px, 200%
  tekst, veilige ruimte, focus, opslag en herstel. De gerichte statische en
  architectuurselectie slaagt 134/134.
- **Samen en Handenvrij hebben eveneens een centrale owner.** Alle 261 directe
  Metgezel-hosts laden de volledige DS-root of expliciet tokens, Samen en
  Handenvrij. Zes Handenvrij-payloads en de Metgezel-payload zijn verwijderd;
  de controllers, geldpoort, sessies en API-contracten zijn behouden. Een oude
  Command-positieoverride die de balk op desktop buiten beeld zette, is bij de
  bron verwijderd. De gerichte contract- en gedragsselectie slaagt 73/73; de
  bestaande volledige Handenvrij-browserketen slaagt 1/1, inclusief typen,
  navigatie, scrollen, gesprek, geldbevestiging en herstel.
- **De reductie is gemeten en vastgerateld.** Het aantal injecterende
  bronbestanden daalde binnen deze twee pakketten van 98 naar **85**. Cookie
  ging van twee injecties en 195 geraakte hosts naar nul. De zeven actieve
  Samen-/Handenvrijowners hebben ieder nul injecties en nul resterend
  injectiebereik. De ontwerppoort meldt geen schendingen; formeel volledig
  gemigreerde schermen blijven 87 omdat centrale componenten op een legacyhost
  die host niet administratief tot volledig DS-scherm maken.
- **De minimale DS-ingangen zijn nu expliciet.** `rtg-ds.css`,
  `taalkeuze-standalone.css` en `uurwerk.css` zijn in het bestaande DS-contract
  benoemd. De hoofdroot moet nog steeds ieder niet-zelfstandig DS-bestand exact
  eenmaal laden; een vergeten of dubbel bestand blijft blokkerend.

EXPERIENCEWERKT is na de bronwijzigingen opnieuw afgeleid en blijft eerlijk
`INCOMPLETE`: 114 apps en 316 schermen zijn geinventariseerd, maar geen
volledige Experience-kwalificatie wordt geclaimd. APPWERKT blijft op het
bewaarde register 112/114 tot de volledige kandidaatmeting wordt uitgevoerd.

#### Integrale CI-foutanalyse — 7 november

Bron: commit `db3323e84e808a9eb2f5088f71ad727861017aef`, PR #706,
Node volgens `.nvmrc`. Dit is de centrale blokkadelijst voor deze afbouwronde;
er wordt geen tweede register naast dit afbouwprogramma gemaakt.

**Verplichte GitHub-poorten.** `main` is strict beschermd door vier
eindcontroles: `Tests, checks en build`, `Kwetsbare dependencies (npm audit)`,
`CodeQL (JavaScript)` en `Toegankelijkheid - het oordeel over alle delen`.
Op de genoemde commit waren CodeQL en npm-audit groen. De twee samengestelde
oordelen waren nog niet uitgevoerd: de brede CI draaide nog en de statische
keuring was al gezakt. De overige PR-workflows blijven verplicht onderdeel van
de kwalificatie, ook wanneer hun naam niet rechtstreeks in branch protection
staat.

| workflow / job | stand op de broncommit | foutklasse | gevolg |
|---|---|---|---|
| Bewijs-preflight | groen | geen fout | volledige bewijsroute gekozen |
| Toetsscherven 1–4 | bezig | nog niet beoordeeld | volledig toetsoordeel wacht |
| Ijkingen boot-smoke, grens-sweep, keuring, klok en zaakdoos | groen | geen fout | gesloten voor deze commit |
| IJking meterijk | bezig | nog niet beoordeeld | volledig toetsoordeel wacht |
| Zware toets ast-grens | groen | geen fout | gesloten voor deze commit |
| Keuringen (statisch) en PostgreSQL | rood | architectuurschending | 166 Design System-schendingen; PostgreSQL zelf is niet de foutbron |
| Norm, instroom en build | groen | geen fout | build en normratels gesloten voor deze commit |
| npm audit | groen | geen fout | beschermde poort gesloten |
| Nieuwe dependencies | groen | geen fout | geen nieuwe dependencyblokkade |
| Adversarial rollen en isolatie | groen | geen fout | gerichte beveiligingspoort gesloten |
| Containerproef | groen | geen fout | containerstart gesloten |
| Toegankelijkheid delen 1–4 | bezig | nog niet beoordeeld | toegankelijkheidsoordeel wacht |
| Toegankelijkheidsoordeel | nog niet uitgevoerd | afhankelijk geblokkeerd | wacht op alle vier delen |
| Schermtoetsen delen 1–4 | bezig | nog niet beoordeeld | schermdekkingsoordeel wacht |
| Schermdekkingsoordeel | nog niet uitgevoerd | afhankelijk geblokkeerd | wacht op alle vier delen |
| Volledige tests, checks en build | nog niet uitgevoerd | afhankelijk geblokkeerd | kan door de rode statische keuring niet groen worden |
| Tests, checks en build | nog niet uitgevoerd | afhankelijk geblokkeerd | beschermde eindpoort wacht op alle risicopoorten |
| Incrementeel bewijs unit/browser/oordeel | overgeslagen | verklaarde routekeuze | correct: preflight koos de volledige route |
| Endpointdekking en bewijspublicatie | nog niet uitgevoerd / niet van toepassing op PR | afhankelijk / trigger | endpointdekking wacht op volledige route; publiceren gebeurt niet vanuit deze PR |
| Alle schermen 1440 px | groen, 309/309 | eerdere functionele regressie hersteld | definitieve rerun blijft nodig na de structurele reparatie |
| Alle schermen 390 px | bezig | nog niet beoordeeld | mobiele kwalificatie wacht |
| WebKit-kernroutes | groen | geen fout | Safari-motor gesloten voor deze commit |
| Lokale kwalificatie | groen | geen fout | bouw en voorcontrole gesloten |
| CodeQL | groen | geen fout | beschermde poort gesloten |

**De 166 Design System-meldingen zijn vijf gedeelde oorzaken.** De aantallen
hieronder zijn meldingen van de poort, niet aantallen onafhankelijke bugs.

| bronoorzaak | meldingen | eigenaar | herstelstatus |
|---|---:|---|---|
| Commit `78238509e0` voegde schermcorrecties toe aan vijftien legacy-CSS/HTML-owners en liet 28 bytes/`!important`/hex-ratels groeien | 28 | Experience / Design System-consolidatie | open; correcties naar de juiste centrale owner brengen of de legacyowner aantoonbaar laten krimpen, nooit de norm verruimen |
| `gebaar.js` laadt op DS-schermen het legacyblad `shared/gebaar.css`; daardoor erven 67 schermen een tweede presentatieowner | 67 | Gebaarcontract + Design System | open; gedrag hergebruiken, DS-presentatie centraal bezitten en legacy-CSS uitsluitend op legacyhosts laden |
| Dezelfde 67 schermen hebben een onbesliste scriptlaadweg voor `gebaar.js`; `public/ds/voorbeeld.html` deelt daarnaast de i18n-onzekerheid | onderdeel van 68 laadgraafmeldingen | Design System-laadgraaf | open; de DS-poort en letterlijke laadbeslissing lokaal bewijsbaar maken |
| `i18n.js` maakt de reeds centrale `taalkeuze-standalone.css` via een niet statisch bewijsbare URL; dit raakt alle 68 laadgraafmeldingen | onderdeel van 68 laadgraafmeldingen | I18n + Design System-laadgraaf | open; bestaande centrale asset behouden en de conditionele DOM-load rechtstreeks bewijsbaar maken |
| `randen.css` bevat één ruwe kleur buiten tokens; `uitvoer.css` bevat acht `!important`s en één selector die niet bij de eigen `.ds-`-klasse begint | 3 | Design System-componentowners | open; tokens en cascade-eigenaarschap herstellen zonder uitzonderingen |

De telling sluit exact: 28 ratelmeldingen + 3 directe DS-contractmeldingen +
67 geladen legacybladen + 68 onbesliste laadgraven = 166.

**Bewijsverval.** EXPERIENCEWERKT bindt bewijs aan de volledige relevante
bronvingerafdruk, configuratie en kandidaatcommit. De scherm-, Edge- en
runtimewijzigingen maakten de vorige `sourceHash` daarom terecht ongeldig. De
registervernieuwing in `db3323e84e` veranderde uitsluitend die hash; zij heeft
geen bewijs als geslaagd gemarkeerd. De stand blijft eerlijk `NOT_TESTED`:
0/114 apps, 0/316 schermen en 0/3.360 toepasselijke dimensievoorwaarden. De
912 door de statische controle gemelde verlopen APPWERKT-bewijzen blijven
eveneens open tot de bron stabiel is en de vereiste producenten opnieuw zijn
uitgevoerd. Verlopen bewijs wordt niet gekopieerd, geaccepteerd of administratief
groen gemaakt.

**Foutklassen en afsluitvolgorde.** De eerder gevonden ene-DS-schilregressie
was een functionele regressie en is gericht hersteld; desktop 309/309 en de
Edge-/taalregressies zijn daarop groen. De open harde fout is architecturaal:
de vijf oorzaken hierboven. Er is op deze commit geen bewezen
infrastructuurfout en geen bewezen flake; PostgreSQL, Redis, container en de
reeds afgeronde browserpoorten functioneren. Na structureel herstel draaien
eerst de Design System-, laadgraaf-, gebaar-, i18n-, Edge- en betrokken
schermregressies. Pas daarna worden alle verplichte CI-controles op één nieuwe,
schone commit uitgevoerd. APPWERKT- en Experience-bewijzen worden pas op die
stabiele bron opnieuw geproduceerd.

**Actuele herstelstand — 8 november.** De tabel hierboven bewaart de feitelijke
uitgangssituatie van run `42421188441`; de herstelstand hieronder vervangt die
niet en voorkomt daardoor dat een oude rode run administratief groen wordt.

| gedeelde bronoorzaak | klasse | eigenaar | structureel herstel | lokale tegenproef | status |
|---|---|---|---|---|---|
| legacy presentatieowners groeiden terwijl de centrale DS-owner dezelfde verantwoordelijkheid al droeg | architectuur | Experience / Design System | vervangen regels naar de bestaande componentowners verplaatst en de actieve legacyregels verwijderd | `ontwerpsysteem.js --controle`: 0 schendingen | gesloten, definitieve CI-rerun vereist |
| `gebaar.js` kon op 67 DS-hosts een tweede stylesheetowner laden | architectuur / laadgraaf | Gebaar + Design System | presentatie naar `public/ds/componenten/gebaar.css`; de bestaande loader kiest nu expliciet DS of legacy | gebaar-, laadgraaf- en DS-contracttoetsen groen | gesloten, definitieve CI-rerun vereist |
| berekende i18n-, randen- en uitvoerloads waren niet statisch bewijsbaar | architectuur / laadgraaf | I18n + componentowners | letterlijke centrale assets en begrensde loaders; tokens en cascade-eigendom hersteld | volledige laadgraaf- en tokentoetsen groen | gesloten, definitieve CI-rerun vereist |
| de generieke World Desktop-projectie werd ten onrechte als vereiste Spatial-runtime op alle DS-hosts geactiveerd | functionele regressie / architectuurgrens | Workspace Runtime / World Desktop | DS-schermen houden hun eigen centrale schil; Workspace Runtime blijft beschikbaar via expliciete modulecontracten en wordt niet als globale legacy `wd-shell` geprojecteerd | permanente toets bewijst dat een DS-host geen legacy-runtime of tweede Edge laadt; 1440px-inventaris 309/309 groen | gesloten, definitieve CI-rerun vereist |
| browsertoetsen bedienden verborgen legacy-menu's in plaats van de centrale DS Edge | verlopen toetsverwachting | schermtoetsen | selectors gemigreerd naar de werkelijke centrale eigenaar; productgedrag niet nagebouwd | horeca- en Edge-browserregressies groen | gesloten, definitieve CI-rerun vereist |
| uitgeschakelde `Verder`-knoppen erfden op twee hosts een lichte achtergrond uit een globale `button`-owner | toegankelijkheidsregressie | Kantoorgesprek + Merken + Platformregister | hostselectors begrensd en disabled-presentatie volledig door het centrale component bezeten | permanente contrastasserties in de reeds mutatiegemeten kantoorgesprekcontracttoets plus a11y-deel 4: 0 structuur, 0 contrast, 0 touch | gesloten, alle vier delen op definitieve commit vereist |
| Foundation-deurtest mat tussen het toevoegen van de Workspace-schil en de MutationObserver die haar fail-closed maakt | instabiele toets | Foundation-toegangstoets | de toets wacht nu op het bestaande waarneembare inert- en `aria-hidden`-contract en meldt elke overtredende node | dezelfde volledige Foundation-browsertoets tweemaal op dezelfde bron | gesloten, definitieve CI-rerun vereist |
| afgeleide architectuur-, bewijs-, bundel-, functie-, taal- en websitevingerafdrukken liepen achter na bronwijzigingen | verlopen afleiding | registereigenaren | uitsluitend de bestaande generators opnieuw uitgevoerd; geen uitkomst handmatig aangepast | `scripts/check.js`: alles in orde | gesloten, definitieve CI-rerun vereist |

De Design System-telling is daarmee **166 naar 0** gegaan. De poort rapporteert
87 gemigreerde schermen en zeven niet-blokkerende verbeterkandidaten. Er is geen
uitzondering, normverlaging of nieuwe presentatiecontroller toegevoegd. De
blijvende regressietoetsen bewaken nu ook de twee fouten die de oorspronkelijke
statische telling alleen niet kon zien: behoud van Spatial op DS-hosts en
contrast van uitgeschakelde kantoorgesprekacties.

#### Onveranderlijke volledige nulmeting — 8 november

De nulmeting is commit
`070ffb83a214166e5dd6259a72b51d718e8356bf` op PR #706. De vier workflows
`CI` (`42496432623`), `Desktop- en mobielstandaard` (`42496432728`), `CodeQL`
(`42496432622`) en `Kwalificatie lokaal` (`42496432730`) zijn allemaal volledig
afgerond. De lokale reparatiewerkboom na deze commit telt niet mee als bewijs
voor deze meting.

**Alle 41 jobs.** Er zijn 24 geslaagde jobs, 8 mislukte jobs, 1 afgebroken job
en 8 verklaard overgeslagen jobs. De overgeslagen incrementele route is correct
omdat preflight de volledige route koos; bewijspublicatie en nachtelijke
kalibratie zijn op een PR geen vrijgavebewijs.

| uitslag | jobs |
|---|---|
| groen (20 in CI) | Bewijs-preflight; zware toets ast-grens; nieuwe dependencies; statisch + PostgreSQL; container; npm-audit; toetsscherven 1, 3 en 4; toegankelijkheidsdelen 1–4; ijkingen keuring, klok, boot-smoke, grens-sweep, meterijk en zaakdoos; adversarial rollen en isolatie |
| groen (4 overige workflows) | WebKit-kernroutes; alle schermen 390 px; CodeQL; kwalificatie lokaal |
| rood, primair | norm/instroom/build; toetsscherf 2; schermtoetsen 1, 2 en 3; alle schermen 1440 px; toegankelijkheidsoordeel |
| rood, afgeleid | eindpoort `Tests, checks en build`: de gekozen volledige bewijsroute was niet groen |
| afgebroken | schermtoetsen deel 4: de browserstap raakte na 45 minuten de jobgrens en had voordien drie concrete fouten gemeld |
| correct overgeslagen | incrementeel bewijs unit; incrementeel bewijs browser; incrementeel totaaloordeel; vertrouwd bewijsboek publiceren; nachtelijke Evidence Control Plane-kalibratie |
| verplicht maar door rode afhankelijkheid niet uitgevoerd | volledige tests/checks/build-samenstelling; schermdekkingsoordeel; waargenomen endpointdekking |

De vier nog niet beschikbare verplichte uitkomsten zijn dus: een voltooide
schermshard 4, het schermdekkingsoordeel, de volledige
tests/checks/build-samenstelling en de endpointdekking. Zij worden niet als
groen, foutloos of niet van toepassing behandeld.

**Primaire fouten en afgeleide gevolgen.** De vier toegankelijkheidsdelen zijn
als meetjobs groen, maar het totaaloordeel is terecht primair rood: samen
melden zij 21 contrastfouten. Zeven Foundation-schermen tonen in drie
authenticatierondes witte toegangstekst op `#faf7f2`: `pesten`, `steun`,
`hulpwijzer`, `opvoeden`, `studie`, `gevoel` en `mediawijs`. Het eindtoetsoordeel
is daarentegen uitsluitend afgeleid rood. Schermdekking en endpointdekking
hebben geen uitslag, omdat een onvolledige ronde geen dekkingscijfer mag
produceren.

**Acht unieke open bronoorzaken.** Concrete fouten worden hieronder slechts
een keer geteld, ook wanneer zij tientallen routes of drie authenticatierondes
raken.

| id | gedeelde bronoorzaak | klasse en herkomst | zichtbare gevolgen in de nulmeting | eigenaar | status / herstelvolgorde |
|---|---|---|---|---|---|
| DG-CI-01 | de generieke World Desktop-projectie overschrijdt op DS-hosts het centrale schileigendom | bevestigde recente functionele en architectuurregressie | 29 keer `legacy-shell-on-ds-screen`; de zeven Foundation-toegangsschermen leveren samen 21 blokkerende contrastfouten; Foundation-mediawijs meet een verkeerde toestand | World Desktop / DS-shell | **open, eerst**: DS-hosts begrenzen; daarna 1440 px, zeven a11y-routes en Foundation opnieuw meten |
| DG-CI-02 | twee nieuwe regressietoetsen sloten niet aan op de bestaande toetskwaliteitscontracten | bevestigde recente toetsregressie | los contrastbestand verhoogt `toetsenNietGemeten` van 141 naar 142; `world-desktop-ds.test.js` voegt de 33e klokwacht toe | toetsarchitectuur | **open, tweede**: bewering in gemeten contract onderbrengen en op waarneembare toestand wachten; norm + klokwacht opnieuw draaien |
| DG-CI-03 | browsertests bedienen na de DS-ownerwissel nog het verborgen legacy-menu en wachten op legacy `rtgDesktopState` | verlopen toetsverwachting door recente consolidatie, geen reden om het product terug te bouwen | 16 basis-service-timeouts; browserchrome 390/1280; twee `basis-ds`-fouten in shard 4; mogelijk een deel van de blikveldproef | centrale Edge / schermtoetsen | **open, na DG-CI-01**: dezelfde zichtbare centrale Edge-owner en bestaande `wachtOpSchil` gebruiken; productcontract behouden |
| DG-CI-04 | de Rahul-ingang wordt niet als contextactie in het centrale DS Edge-blad geprojecteerd | functionele regressie, herkomst nog aan bronverschil te binden | leverancier op drie formaten en Wonen/Studio op 390/1440 vinden `Rahul openen` niet | Rahul + Edge-actieregister | **open**: actiepublicatie en focuscontract herstellen; beide echte browserketens herhalen |
| DG-CI-05 | de centrale cookie-owner reserveert op de oudere 404-host minder documentruimte dan de werkelijke balkhoogte | functionele geometrie-/laadvolgorderegressie | `cookie centrale owner op oudere 404-host` | Cookie-componentowner | **open**: actuele geometrie na centrale ownerinitialisatie bewijzen, zonder tolerantie te verruimen |
| DG-CI-06 | de statisch bewijsbare i18n-load gebruikt een root-absoluut CSS-adres en breekt daardoor een projectprefix | bevestigde recente compatibiliteitsregressie | `/ds/taalkeuze-standalone.css` faalt onder een statisch projectpad | i18n + DS-laadgraaf | **open**: base-aware centrale asset-URL die ook statisch bewijsbaar blijft; JS-aan/uit en projectprefix herhalen |
| DG-CI-07 | de Foundation-gevoelstroom bereikt na bewaren niet de verwachte herzienbare toestand | functionele regressie, precieze bron nog niet bewezen | `Gevoelsdagboek: aantikken is vluchtig, bewaren is een keuze, herzien kan` loopt vast | Foundation Welzijn | **open**: sessie-, API- en DOM-overgang afzonderlijk vastleggen en herstellen |
| DG-CI-08 | schermshard 4 overschrijdt 45 minuten en verliest daardoor zijn samenvatting en journaal | infrastructuur-/toetsorchestratieprobleem met echte verborgen fouten | shard 4 afgebroken; vóór afbreken: twee basis-DS-fouten en één Edge-blikveldfout; de daaropvolgende tests zijn niet uitgevoerd | CI-verdeling + schermtoetsen | **open, na functionele oorzaken**: drie zichtbare fouten gericht sluiten, gewichten/verdeling actualiseren en shard volledig laten eindigen zonder timeout te verhogen als vervanging voor herstel |

De Rahul-, cookie- en Foundation-Welzijnfouten reproduceren ook buiten de
GitHub-samenvatting en zijn daarom geen administratieve ruis. Voor hun precieze
introductiecommit blijft de herkomstattributie open; zij tellen tot die tijd
volledig als productfout. Lokale sandboxbeperkingen (`EPERM` op loopback en
`ENOTFOUND` bij een Node-download) kwamen niet voor in GitHub en verklaren geen
enkele nulmetingsfout.

**Voortgang tegenover de vorige meetbare bronstand.** De 166 Design
System-schendingen uit commit `db3323e84e808a9eb2f5088f71ad727861017aef`
zijn op deze nulmeting 0: de statische + PostgreSQL-job is groen. Vier van de
vijf oorspronkelijke gedeelde DS-oorzaken zijn volledig gesloten. De
i18n-laadgraaf is statisch gesloten maar introduceerde DG-CI-06 en telt daarom
niet als integraal afgerond. De volledige run maakte acht eerder niet volledig
zichtbare oorzaken meetbaar; vier daarvan zijn aantoonbaar recente regressies
(DG-CI-01, DG-CI-02 en DG-CI-06, waarbij DG-CI-02 twee onafhankelijke
toetscontractschendingen bevat).

**Bewijs blijft fail-closed.** EXPERIENCEWERKT blijft `NOT_TESTED`: 0/114 apps,
0/316 schermen en 0/3.360 dimensieverplichtingen. APPWERKT meldt 342 fijnmazig
vervallen plus 570 grof verlopen bewijzen; alle 114 rijen blijven daarom
`NIET_GETEST`. Geen van deze registers wordt door de CI-reparatie opnieuw groen
verklaard. Herkwalificatie volgt pas op de stabiele kandidaatbron.

**Meetstand nulmeting.** Openstaande unieke oorzaken: **8**. Opgelost sinds de
vorige meetbare bronstand: **4 volledig**. Nieuwe regressies: **4 bevestigd**.
Eerder verborgen fouten ontdekt: **8 unieke oorzaken**. Niet-uitgevoerde
verplichte controles: **4 uitkomsten**. Deep Green: **GEBLOKKEERD**.

De herstelvolgorde is DG-CI-01, DG-CI-02, DG-CI-03, daarna de onafhankelijke
DG-CI-04 t/m DG-CI-07 en ten slotte DG-CI-08. Na elke groep draaien uitsluitend
de gerichte tegenproeven plus alle eerder gesloten regressies die dezelfde
owner raken. Een oorzaak sluit pas wanneer zij uit deze tabel verdwijnt. Pas
bij nul bekende oorzaken wordt een nieuwe exacte kandidaatcommit gemaakt en
loopt de volledige verplichte CI opnieuw.

#### Herstelronde 1 — acht oorzaken gericht gesloten

De nulmeting hierboven blijft ongewijzigd als historische bronwaarheid. Op de
reparatiewerkboom zijn de acht oorzaken in afhankelijkheidsvolgorde behandeld;
geen register is administratief groen gemaakt.

| id | structureel herstel | tegenbewijs op de reparatiewerkboom | status voor kandidaat-CI |
|---|---|---|---|
| DG-CI-01 | de globale legacy World Desktop-projectie stopt op `data-ds`; expliciete Workspace Runtime-contracten blijven beschikbaar | 1440px desktop-audit 309/309; zeven eerdere Foundation-a11y-routes in uitgelogd, ingelogd, zaak, telefoon, tablet, drie thema's en notch: 0 structuur, 0 contrast | gericht gesloten |
| DG-CI-02 | contrastbeweringen ondergebracht in de bestaande mutatiegemeten contracttoets; de nieuwe klokwacht verwijderd | `norm`: `toetsenNietGemeten=141`; gerichte unitcontracten groen | gericht gesloten |
| DG-CI-03 | browsertoetsen bedienen de zichtbare centrale DS Edge en wachten op `wachtOpSchil`, niet op verborgen legacy-staat | basis-service, basis-DS, browserchrome en Edge-blikveld groen | gericht gesloten |
| DG-CI-04 | de bestaande Rahul-gedragshaak declareert zijn contextactie aan de centrale Edge zonder tweede controller | leverancier op drie formaten en Wonen/Studio op 390/1440 groen | gericht gesloten |
| DG-CI-05 | de bestaande centrale cookie-owner en zijn waarneembare ResizeObserver-contract bleken intact; diagnostiek is aangescherpt | de volledige cookieproef eenmaal in de geconsolideerde ronde plus vijf opeenvolgende zelfstandige rondes groen | gericht gesloten; volledige CI bewaakt herhaling |
| DG-CI-06 | de i18n-component gebruikt de bestaande projectbasis voor zijn centrale stylesheet; de gegenereerde bundel is herbouwd | statisch projectpad met JavaScript aan en uit, alle publieke formaten en bundelgelijkheid: 10/10 groen | gericht gesloten |
| DG-CI-07 | de echte Foundation-sessiefixture draagt nu de al vereiste profielidentiteit; de eerste opslag moet aantoonbaar HTTP 200 antwoorden | volledige privé-dagboekstroom inclusief bewaren, herzien en wissen groen | gericht gesloten |
| DG-CI-08 | de vier CI-duurartefacten uit nulmeting `42496432623` voeden nu de bestaande normale-modusverdeler; de schermsuite telt vijf volledig meetellende delen | projectie per deel circa 34 minuten in plaats van circa 42; uitvoering, samenvoeging en bewijsverzameling zijn door een regressietoets aan dezelfde vijf delen gebonden | gericht gesloten; volledige vijfdelige CI vereist |

De geconsolideerde regressieronde over alle geraakte eigenaars telt 65/65
geslaagde toetsen. De verdeler- en bewijscontractronde telt 51/51 geslaagde
toetsen. De norm, de Design System-poort en de desktop-audit zijn groen. Twee
eerder afgeschermde concrete verwachtingen kwamen tijdens herstel vrij: de
Rahul-header verwachtte nog een legacy `wd-home`, en Edge-blikveld verwachtte
nog een dubbele legacy-hoofdactie. Beide horen bij de reeds bekende oorzaken
DG-CI-01/DG-CI-03 en vormen daarom geen nieuwe unieke bronoorzaak.

**Meetstand herstelronde 1.** Openstaande unieke oorzaken: **0 bekend vóór de
integrale tegenproef**. Opgelost sinds de nulmeting: **8**. Nieuwe regressies:
**0**. Eerder verborgen fouten ontdekt: **2 concrete fouten, 0 nieuwe unieke
oorzaken**. Niet-uitgevoerde verplichte controles: **4 uitkomsten** (de
vijfdelige schermronde, het schermdekkingsoordeel, de volledige
tests/checks/build-samenstelling en de endpointdekking zijn nog niet opnieuw op
de kandidaat uitgevoerd). Deep Green: **GEBLOKKEERD**.

De volgende stap is uitsluitend de integrale tegenproef: één schone
kandidaatcommit, alle verplichte CI-jobs laten eindigen en de volledige uitslag
opnieuw als foutboom classificeren. Een rode uitkomst heropent alleen de
bijbehorende oorzaak; een groene deeljob maakt Deep Green niet zelfstandig
bewezen.

#### Integrale tegenproef 1 — 8 november

De onveranderlijke kandidaat was commit
`69c1189764e0a3ad1d615a7bfe95e77342944d80`. De workflows `CI`
(`42513207005`), `Desktop- en mobielstandaard` (`42513206944`), `CodeQL`
(`42513206943`) en `Kwalificatie lokaal` (`42513206941`) zijn volledig
afgerond voordat aan deze werkboom verder is gewijzigd. Over alle vier
workflows eindigden 43 jobs: 28 geslaagd, 7 mislukt en 8 overgeslagen. De vijf
schermdelen eindigden alle vijf binnen hun bestaande 45-minutengrens; de
vijfdelige verdeling heeft DG-CI-08 dus aantoonbaar gesloten.

De zeven rode jobs vallen terug op drie unieke bronoorzaken. De afhankelijke
job `Tests, checks en build` is een afgeleid rood oordeel en geen vierde
oorzaak.

| id | gedeelde bronoorzaak | klasse en herkomst | zichtbare gevolgen | eigenaar | status / herstelvolgorde |
|---|---|---|---|---|---|
| DG-CI-09 | `EXPERIENCEWERKT.json` loopt na bron- en interactiewijzigingen terecht achter op zijn afleiding | verlopen afgeleid register; geen productbewijs en geen reden om bewijs groen te maken | mobiele inventariscontrole en `Toetsscherf 4` wijzen dezelfde exacte registerafwijking af | Experience-bewijsregister | **open, eerst**: uitsluitend de bestaande coverage-generator draaien; daarna `--check` en de unitcontracttoets, met 0 bewezen resultaten behouden |
| DG-CI-10 | de DS-audit telde ook de canonieke `body.ds-wereldwerkruimte > .wd-shell` als legacy; de eerste reparatie zette daarom de volledige bestaande werkruimteruntime uit | nieuwe functionele regressie door herstelronde 1, blootgelegd door de volledige schermronde | 11 browserfouten in LibraryOS, beeldeditor, Bureau-PDA, Volscherm, Foundation-toegang en World Desktop; favorieten, appvensters, persoonlijke beelden en fouttoestand initialiseren niet | World Desktop + DS-audit | **open, tweede**: bestaande runtime herstellen en de audit uitsluitend niet-canonieke shells of oude Edges laten afwijzen; alle geraakte werkruimtestromen herhalen |
| DG-CI-03 | de gedeelde Horeca-werkvloertoets wacht nog op verborgen `#osMenuBtn` naast de centrale DS Edge | eerder verborgen, onvolledig gesloten toetsverwachting; geen productreden om het legacy-menu terug te bouwen | Bar en Vloer wachten elk 30 seconden op een ingang die een DS-scherm niet hoort te tonen | centrale Edge / Horeca-schermtoets | **heropend, derde**: wachten op de zichtbare centrale menu-ingang en beide volledige werkvloermatrices herhalen |

Drie verplichte uitkomsten konden door deze fouten niet worden samengesteld:
`Volledige tests, checks en build`, `Waargenomen endpoint-dekking` en
`Schermdekking - het oordeel over alle delen`. De drie incrementele jobs waren
correct overgeslagen omdat preflight de volledige route koos; publicatie en
nachtelijke kalibratie zijn op een pull request geen kandidaatbewijs.

De overige poorten geven belangrijk negatief bewijs: CodeQL, de lokale
kwalificatie, alle vier toegankelijkheidsdelen plus hun oordeel, adversarial
rollen en isolatie, PostgreSQL, architectuur, norm, dependency-audit en drie
van de vier unitscherven zijn groen. Geen van deze deeluitkomsten heft de drie
open oorzaken op.

**Meetstand integrale tegenproef 1.** Openstaande unieke oorzaken: **3**.
Opgelost sinds de nulmeting: **6 van de oorspronkelijke 8**. Nieuwe regressies:
**1 unieke oorzaak** (11 concrete browserfouten). Eerder verborgen fouten
ontdekt: **1 heropende oorzaak** (2 concrete Horeca-fouten). Niet-uitgevoerde
verplichte controles: **3 uitkomsten**. Deep Green: **GEBLOKKEERD**.

De herstelvolgorde is DG-CI-09, DG-CI-10 en DG-CI-03. Daarna draaien eerst de
gerichte contract- en browserproeven en pas op een nieuwe schone commit opnieuw
alle verplichte workflows. De historische nulmeting en deze rode tegenproef
blijven ongewijzigd als bewijs van de foutontwikkeling.

#### Herstelronde 2 — 8 november

De drie oorzaken uit integrale tegenproef 1 zijn in afhankelijkheidsvolgorde
gesloten. Het Experience-register is opnieuw uitsluitend uit de actuele
inventaris afgeleid en blijft fail-closed: 114 apps en 316 schermen staan in de
noemer, zonder dat ontbrekend ervaringsbewijs als geslaagd is ingevuld. De
bestaande World Desktop-runtime is hersteld; de DS-audit accepteert alleen de
canonieke directe wereldwerkruimte en blijft oude of dubbele Edges afwijzen.
Ingebedde DS-schermen houden hun levende actiebronnen, waarna uitsluitend hun
expliciete `data-ds-actie`-contract via de bestaande ouder-Edge beschikbaar
wordt. De Horeca-proeven wachten nu op de centrale DS-menu-ingang in plaats van
op het verborgen legacy-menu.

De gerichte contractset sloot met **88/88** geslaagde toetsen. De acht eerder
geraakte browserbestanden sloten gezamenlijk met **23/23** geslaagde scenario's,
waaronder **14/14** World Desktop-scenario's. Twee gelijktijdig gestarte brede
schermmetingen controleerden elk alle **309** routes en hadden ieder een
eenmalige timeout op een andere route. Dezelfde routes zijn daarna sequentieel
in hun oorspronkelijke viewport herhaald: `/apps/office.html` op 1440 px en
`/apps/pay.html` op 390 px sloten beide zonder fout. Daarmee is resource-
concurrentie van twee volledige lokale audits onderscheiden van een
reproduceerbare productfout; de verplichte CI-schermdelen moeten dit nog op de
nieuwe kandidaatcommit bevestigen.

De verder gekomen bouw- en statische poorten maakten één gedeelde, eerder
verborgen coherentieoorzaak zichtbaar: afgeleide registers waren vóór de
definitieve buildvolgorde vernieuwd en liepen daarna terecht achter. De
bestaande generatoren voor `BEWIJS.md`, `BUNDELS.md`, taalbewijs, websitebeelden
en websitewaarheid zijn na de bronbuild uitgevoerd; daarna sloten
`experience:coverage:check`, `scripts/check.js`, `scripts/build.js` en
`scripts/norm.js` zonder fout. De sandbox kon de routekaart eenmaal niet op
loopback openen (`EPERM`); exact dezelfde statische controle is buiten die
beperking herhaald en sloot groen. Geen testregel, norm of bewijsstatus is
versoepeld.

**Meetstand herstelronde 2.** Openstaande unieke oorzaken: **0 binnen de lokaal
uitgevoerde herstelset**. Opgelost sinds de vorige meting: **4** (de drie open
CI-oorzaken plus één verborgen afleidingsvolgorde). Nieuwe regressies: **0**.
Eerder verborgen fouten ontdekt: **1 unieke oorzaak** (vier afgeleide
registermanifestaties). Niet-uitgevoerde verplichte controles: **3
samengestelde CI-uitkomsten** die pas op de nieuwe kandidaatcommit kunnen
worden gevormd. Deep Green: **GEBLOKKEERD**.

De volgende onveranderlijke stap is deze werkboom als één kandidaatcommit vast
te leggen, de vier verplichte workflows volledig te laten eindigen en alle
rode, afgebroken, geblokkeerde en overgeslagen jobs opnieuw als één foutboom te
classificeren. Alleen die tegenproef kan de drie nog ontbrekende samengestelde
uitkomsten sluiten.

#### Integrale tegenproef 2 — 8 en 9 november

De onveranderlijke kandidaat was commit
`00915695906acb02821e497649df0e6d53a72c4a`. De workflows `CI`
(`42520404092`), `CodeQL` (`42520404162`), `Kwalificatie lokaal`
(`42520404205`) en `Desktop- en mobielstandaard` (`42520404463`) zijn volledig
afgerond voordat de herstelwerkboom is gewijzigd. Over de vier workflows
eindigden 42 jobs: 28 geslaagd, 6 mislukt en 8 overgeslagen. CodeQL, de lokale
Slotsuite-route, WebKit en de volledige scherminventaris op 390 en 1440 px zijn
groen. In de hoofd-CI zijn 23 jobs groen, waaronder PostgreSQL, container,
architectuur, norm/build, drie unitscherven, twee schermscherven, vier
toegankelijkheidsdelen en alle ijkingen.

De zes rode jobs bestaan uit vijf primaire meetjobs en het afgeleide oordeel
`Tests, checks en build`. De drie incrementele jobs zijn correct overgeslagen
omdat preflight de volledige route koos. De volledige samenstelling,
schermdekking en endpointdekking konden door de rode primaire jobs niet worden
gevormd; bewijspublicatie en nachtelijke kalibratie zijn op deze pull request
evenmin vrijgavebewijs.

De concrete fouten vallen terug op vier gedeelde oorzaken. Een gevolg wordt
hier maar eenmaal geteld, ook wanneer het in meerdere schermscherven of drie
toegankelijkheidsrondes zichtbaar is.

| id | gedeelde bronoorzaak | klasse en herkomst | zichtbare gevolgen | eigenaar | herstelvolgorde |
|---|---|---|---|---|---|
| DG-CI-11 | schermtoetsen verwarden bewust behouden, verborgen DS-actiebronnen en de canonieke Workspace-schil met een zichtbare tweede eigenaar | verlopen toetscontract na de recente eigenaarsconsolidatie | Foundation-selectorcontract, Foundation-kindpoort, Reizen & Veilig, Wonen, Home en Luchthaven wezen geldig centraal gedrag af | schermtoetsen / DS-ownercontract | zichtbaarheid en directe eigenaar meten, niet DOM-afwezigheid of het oude elementtype |
| DG-CI-12 | `world-desktop-ds.test.js` wachtte met een nieuwe kale kloktimer | bevestigde recente toetsregressie | de klokschuld steeg van 32 naar 33 en maakte twee klokcontracttoetsen rood | toetsarchitectuur | wachten op microtaken/waarneembare toestand zonder tijdsvertraging |
| DG-CI-13 | de Foundation-toegangslaag kreeg de lichte generieke dialoogachtergrond boven haar donkere toegangstokens | bevestigde recente presentatieregressie | zeven Foundation-routes leverden in uitgelogd, ingelogd en zaak samen 21 contrastfouten per ronde | Foundation-componentowner | het bestaande beveiligde dialoogcontract specifieker eigenaar maken en alle betrokken a11y-toestanden herhalen |
| DG-CI-14 | brede legacy Editorial-regels lekten in donkere mobiele navigatie en de Foundation World Home-oppervlakken | eerder verborgen cascade- en eigenaarschapsfout, zichtbaar in de blinde/notch-as van de volledige a11y-meting | onleesbare mobiele navigatie en een transparant/onjuiste leeg- en operationeel oppervlak zonder hoofdcontrastfout in de gewone as | legacy Editorial + bestaande DS-componentowners | legacy selectors begrenzen en semantische DS-kleuren gebruiken; geen nieuwe stijlowner |

**Meetstand integrale tegenproef 2.** Openstaande unieke oorzaken: **4**.
Opgelost sinds de vorige meetbare bronstand: **0 in deze tegenproef**. Nieuwe
regressies: **2 bevestigd** (DG-CI-12 en DG-CI-13). Eerder verborgen fouten
ontdekt: **2 unieke oorzaken** (DG-CI-11 en DG-CI-14). Niet-uitgevoerde
verplichte controles: **3 samengestelde uitkomsten**. Deep Green:
**GEBLOKKEERD**.

#### Herstelronde 3 — 9 november

De vier oorzaken uit integrale tegenproef 2 zijn in afhankelijkheidsvolgorde
behandeld. Verborgen DS-koppen blijven als bestaande actiebron in de DOM, maar
de regressies meten nu uitsluitend zichtbare chrome. De canonieke
`body.ds-wereldwerkruimte > .wd-shell` blijft de bestaande Workspace Runtime;
Home wordt via zijn werkelijke DS-knop bewezen. Alle zichtbaarheid van elementen
uit een kindframe wordt voortaan door de `defaultView` van dat kinddocument
berekend, zodat een buitenvenster geen verborgen kindbediening als zichtbaar
kan tellen. De kale kloktimer is vervangen door een deterministische
microtask-wacht.

De Foundation-poort gebruikt dezelfde bestaande donkere beveiligde dialoog,
maar bezit haar achtergrond nu met voldoende selectorspecificiteit tegenover
de generieke dialoog. De legacy Editorial-laag is begrensd rond donkere
media-/veiligheidsnavigatie en `data-world-home`; de bestaande mobiele
navigatie gebruikt semantische DS-kleuren en de bestaande Foundation
World Home-kaart behoudt haar papieroppervlak en leesbare labels. Er is geen
nieuwe component, controller, stylesheet of dependency toegevoegd en de
legacybestanden zijn kleiner geworden.

Gericht tegenbewijs op de herstelwerkboom:

* de Foundation- en World Desktop-contractset sluit met **25/25** toetsen;
* de vier betrokken Edge/Foundation/Luchthaven-browserbestanden sluiten samen
  met **15/15** scenario's;
* de volledige appmenu-keten sluit met **11/11** scenario's, inclusief Reizen
  & Veilig en de contextvaste zichtbaarheidstoets;
* de Design System-poort meldt **0 schendingen** en 87 centraal gemigreerde
  schermen;
* toegankelijkheidsdelen 1, 2 en 3 sluiten met 0 structurele en 0
  hoofdcontrastfouten; deel 3 mat bovendien telefoon, tablet, drie thema's en
  alle blinde assen, inclusief notch, zonder contrast- of raakvlakfout. De al
  bekende niet-blokkerende duimbereikwaarneming bij `Berichten` blijft zichtbaar
  voor de latere Experience-kwalificatie. De volledige CI moet alle vier delen
  en het totaaloordeel nog bevestigen;
* `scripts/check.js` is inhoudelijk groen en houdt de 912 verlopen
  APPWERKT-bewijzen terecht fail-closed.

De brede appmenu-tegenproef maakte nog één concrete, eerder verborgen
meetfout zichtbaar: `getComputedStyle` uit het bovenvenster werd gebruikt voor
een element in een kindframe. Dit is geen vijfde productoorzaak maar een extra
manifestatie van DG-CI-11. Na de contextvaste reparatie bleef de volledige
11-scenario-keten groen.

**Meetstand herstelronde 3.** Openstaande unieke oorzaken: **0 binnen de lokaal
uitgevoerde herstelset**. Opgelost sinds de vorige meting: **4**. Nieuwe
regressies: **0**. Eerder verborgen fouten ontdekt: **1 concrete
testmanifestatie, 0 nieuwe unieke oorzaken**. Niet-uitgevoerde verplichte
controles: **3 samengestelde CI-uitkomsten**. Deep Green: **GEBLOKKEERD**.

De volgende stap blijft onveranderd: rond de lopende gerichte meting af, voer
de statische en afgeleide controles op dezelfde werkboom uit, leg daarna één
schone kandidaatcommit vast en laat alle vier verplichte workflows volledig
eindigen. Alleen die integrale tegenproef kan de drie samengestelde uitkomsten
en de actuele bewijsstatus sluiten.

#### Integrale tegenproef 3 — 9 november

De onveranderlijke kandidaat was commit
`ab50f14f4e03ad12af8ed054b281f9faa0926b94`. De workflows `CI`
(`42565992757`), `CodeQL` (`42565992679`), `Kwalificatie lokaal`
(`42565992760`) en `Desktop- en mobielstandaard` (`42565992514`) zijn volledig
afgerond voordat deze herstelwerkboom is gewijzigd. Over de vier workflows
eindigden 42 jobs: 30 geslaagd, 4 mislukt en 8 overgeslagen. CodeQL, de lokale
Slotsuite-route, WebKit en de volledige scherminventaris op 390 en 1440 px zijn
groen. De hoofd-CI telt 25 groene jobs. Alle vier toegankelijkheidsscherven,
vier van de vijf schermscherven en drie van de vier unitscherven hebben hun
primaire meting volledig uitgevoerd.

De vier rode jobs bestaan uit drie primaire oorzaken en het afgeleide oordeel
`Tests, checks en build`. Het toegankelijkheidsoordeel is wel een primaire
meetuitkomst: de vier geslaagde meetscherven rapporteerden samen 175
contrastmanifestaties. De drie incrementele jobs zijn correct overgeslagen
omdat preflight de volledige route koos. De volledige samenstelling,
schermdekking en endpointdekking konden door de rode primaire jobs niet worden
gevormd; bewijspublicatie en nachtelijke kalibratie zijn op deze pull request
geen kandidaatbewijs.

| id | gedeelde bronoorzaak | klasse en herkomst | zichtbare gevolgen | eigenaar | herstelvolgorde |
|---|---|---|---|---|---|
| DG-CI-14 | de brede Editorial-regel die alle links op papier het accent geeft heeft meer specificiteit dan de bestaande donkere componentowners | eerder bekende cascade-oorzaak, in herstelronde 3 onvolledig begrensd | dezelfde bordeauxkleur overschrijft het toegangsmerk, Sociaal-menu, Mall-partners en -poort en de Game Night-springlink; 175 contrastmanifestaties vallen op deze ene ownerfout terug | legacy Editorial / bestaande componentowners | de globale linkowner verwijderen en de al aanwezige componentowners laten beslissen; de betrokken a11y-scherven en het totaaloordeel herhalen |
| DG-CI-15 | een Rendez-vous-voorstel op een gedeelde locatie zonder actueel aanwezigheidsvenster wordt wel aangemaakt maar direct daarna als ongeldig afgewezen | bestaande tijdgebonden productinconsistentie, op 9 november voor het eerst zichtbaar doordat de vaste novemberfixture verliep | `arrange` antwoordt 200 en het onmiddellijk volgende akkoord 409 | Rendez-vous Arrange | geldigheid laten aansluiten op de oorsprong van het voorstel: gedateerde voorstellen vereisen nog dezelfde gedateerde overlap, ongedateerde voorstellen vereisen nog dezelfde gedeelde locatie; beide takken gericht bewijzen |
| DG-CI-16 | de Horeca-browserproef beoordeelt de conceptreden na slechts twee seconden en negeert eerst de mislukte toestandswacht | instabiele toets onder volledige runnerbelasting; de productassertie blijft vereist | een eenmalige lege DOM-stand wordt direct als definitief verlies beoordeeld, terwijl twee zelfstandige herhalingen op dezelfde bron groen sloten | Horeca-conceptcontinuiteit / schermtoets | wachten op de vereiste eindtoestand zonder de timeout te negeren; daarna de proef herhaald en onder de volledige schermshard uitvoeren |

**Meetstand integrale tegenproef 3.** Openstaande unieke oorzaken: **3**.
Opgelost sinds de vorige meetbare bronstand: **0 in deze tegenproef**. Nieuwe
regressies: **0 bevestigd**. Eerder verborgen fouten ontdekt: **3 unieke
oorzaken** (177 concrete manifestaties). Niet-uitgevoerde verplichte controles:
**3 samengestelde uitkomsten**. Deep Green: **GEBLOKKEERD**.

De herstelvolgorde is DG-CI-14, DG-CI-15 en DG-CI-16. Na iedere groep volgen
de gerichte regressies; pas wanneer alle drie aantoonbaar gesloten zijn wordt
een nieuwe kandidaat vastgelegd en de volledige verplichte CI opnieuw gestart.

#### Herstelronde 4 — drie primaire oorzaken gericht gesloten

DG-CI-14 is bij de eigenaar hersteld: de globale Editorial-regel eigent niet
langer alle links toe, zodat donkere componenten weer hun bestaande kleurregel
toepassen. De volledige toegankelijkheidsscherven 2/4 en 4/4 zijn lokaal op
elk 79 schermen uitgevoerd, inclusief uitgelogde, ingelogde, zaak-, beide
telefoonhanden, tablet-, champagne-, bordeaux-, royal- en blinde-asrondes.
Beide scherven sloten met 0 structurele, 0 contrast- en 0
raakvlakmanifestaties; de eerdere 175 contrastmanifestaties zijn daarmee op de
oorspronkelijke meetroute tot nul teruggebracht.

DG-CI-15 is als productcontract hersteld. Een gedateerd Rendez-vous-voorstel
vereist nog steeds de volledige oorspronkelijke aanwezigheidsdoorsnede; een
ongedateerd voorstel dat uit gedeelde voorkeurslocaties ontstond vereist dat
beide profielen die locatie nog delen. De bestaande vervalproef blijft groen en
een nieuwe tegenproef bewijst dat beide leden het zojuist ontvangen
ongedateerde voorstel kunnen aanvaarden. `rendezvous.test.js` en
`connection-final-routes.test.js` sloten samen met 34/34 geslaagde toetsen.

DG-CI-16 is in de toetswaarneming hersteld zonder de productbewering te
verzwakken. De proef wacht nu verplicht en begrensd op exact de teruggezette
conceptwaarde en negeert een timeout niet meer. Drie gelijktijdige zelfstandige
uitvoeringen van `horeca-vloer.e2e.js` sloten 3/3 groen onder runnerbelasting.

De brongebonden registers zijn uitsluitend met hun bestaande generators
bijgewerkt: `BEWIJS.md` telt de toegevoegde regressie en
`EXPERIENCEWERKT.json` blijft eerlijk `NOT_TESTED` met 0/3360 bewezen
voorwaarden. `npm run check`, `npm run norm`, Design System-controle, build,
service-workercontrole en Experience-inventariscontrole zijn groen. De
APPWERKT-versheidsmelding blijft 912 verlopen bewijzen rapporteren en wordt
niet als groen gepresenteerd. De drie samengestelde CI-uitkomsten blijven open
totdat een onveranderlijke kandidaat de volledige verplichte CI heeft doorlopen.

**Meetstand herstelronde 4.** Openstaande unieke oorzaken: **0 van de 3 in de
vastgelegde CI-nulmeting**. Opgelost sinds vorige meting: **3**. Nieuwe
regressies: **0 in de gerichte tegenproeven**. Eerder verborgen fouten ontdekt:
**0 extra**. Niet-uitgevoerde verplichte controles: **3 samengestelde
uitkomsten**. Deep Green: **GEBLOKKEERD**.

#### Integrale tegenproef 4 — volledige foutboom op kandidaat 243ddd0eea

De vier verplichte workflows zijn volledig geëindigd op commit
`243ddd0eea8d99c9111b3eab7db8db868e513c41`: CI `42577499659`, CodeQL
`42577499614`, Kwalificatie lokaal `42577499492` en Desktop- en
mobielstandaard `42577499506`. Over de vier workflows sloten 42 jobs: 31
geslaagd, 3 mislukt en 8 overgeslagen. CodeQL, lokale kwalificatie, beide
volledige scherminventarissen, WebKit, alle vier toegankelijkheidsscherven en
hun totaaloordeel zijn groen. De eerdere drie oorzaken DG-CI-14 tot en met
DG-CI-16 zijn niet teruggekomen.

Van de drie rode jobs is `Tests, checks en build` afgeleid: de gekozen volledige
route kon door twee rode primaire scherven niet samenstellen. De complete logs
van beide primaire jobs zijn verzameld voordat nieuw herstelwerk begon.

| id | gedeelde bronoorzaak | klasse en herkomst | zichtbare gevolgen | eigenaar | herstelvolgorde |
|---|---|---|---|---|---|
| DG-CI-17 | de constitutionele producttestteller bleef op 32 Rendez-vous-tests staan nadat de nieuwe geldigheidsregressie de aantoonbare baseline naar 33 bracht | nieuwe registerregressie uit herstelronde 4; productgedrag en alle 33 tests zijn groen | unitscherf 2 vergelijkt 33 met de oude exacte 32 en faalt als enige van dat bestand | Connection Constitution / testbaseline | de exacte baseline naar 59 producttests (26 Vonk + 33 Rendez-vous) brengen en de constitutionele proef gericht herhalen |
| DG-CI-18 | de documentequivalentieproef geeft een echte UI/Edge-handeling onder volledige schijfbelasting slechts de Playwright-standaard van 30 seconden om het verplichte antwoord waar te nemen | instabiele toetswaarneming; dezelfde volledige proef sloot daarna driemaal parallel groen in circa 28 seconden per uitvoering | schermscherf 5 ziet eenmaal geen `/api/bestanden/actie`-antwoord binnen 30 seconden; 255 overige toetsen in de scherf slagen | document-equivalentie / browserwaarneming | de vereiste response met een expliciete begrensde 60-secondenlasttermijn blijven eisen en de mislukking aan caller en case binden; daarna herhaald en in de volledige scherf bewijzen |

**Meetstand integrale tegenproef 4.** Openstaande unieke oorzaken: **2**.
Opgelost sinds vorige integrale meting: **3**. Nieuwe regressies: **1**
(DG-CI-17). Eerder verborgen fouten ontdekt: **1** (DG-CI-18).
Niet-uitgevoerde verplichte controles: **3 samengestelde uitkomsten**. Deep
Green: **GEBLOKKEERD**.

#### Herstelronde 5 — testbaseline en belastingswaarneming gesloten

DG-CI-17 is bij de constitutionele eigenaar gesloten. De bestaande exacte
producttestbaseline is bijgewerkt naar 59 aantoonbare producttests: 26 Vonk en
33 Rendez-vous. De norm blijft exact en de nieuwe geldigheidsregressie wordt
niet uitgezonderd. `connection-constitution.test.js` sloot gericht groen.

DG-CI-18 is bij de documentequivalentieproef gesloten zonder de producteis te
versoepelen. De proef vereist nog steeds exact het POST-antwoord van
`/api/bestanden/actie`, maar gebruikt daarvoor een expliciet begrensd
60-secondenlastbudget en rapporteert bij uitval de aanroeper en fixture. Drie
afzonderlijke uitvoeringen van `document-equivalence.e2e.js` sloten achter
elkaar groen; afwezigheid van de handeling blijft een harde fout.

De twee reparaties worden pas integraal gesloten wanneer een onveranderlijke
nieuwe kandidaat alle verplichte CI heeft doorlopen. Tot dat moment blijven de
drie samengestelde uitkomsten uit de vorige meting open.

**Meetstand herstelronde 5.** Openstaande unieke oorzaken: **0 van de 2 in de
laatste integrale tegenproef**. Opgelost sinds vorige meting: **2**. Nieuwe
regressies: **0 in de gerichte tegenproeven**. Eerder verborgen fouten ontdekt:
**0 extra**. Niet-uitgevoerde verplichte controles: **3 samengestelde
uitkomsten**. Deep Green: **GEBLOKKEERD**.

#### Integrale tegenproef 5 — verplichte CI volledig groen

De vier verplichte workflows zijn volledig geëindigd op commit
`0e18812ec8e070db10c8c47ba814206551e33ca0`: CI `42583567918`, CodeQL
`42583567815`, Kwalificatie lokaal `42583567640` en Desktop- en
mobielstandaard `42583567720`. Over de vier workflows sloten 42 jobs: 37
geslaagd, 0 mislukt en 5 conditioneel overgeslagen.

Alle vier unitscherven, vijf schermscherven, vier toegankelijkheidsscherven,
hun samengestelde oordelen, de volledige test-, check- en buildroute,
endpointdekking, adversarial beveiliging, PostgreSQL, CodeQL, WebKit en beide
volledige schermformaten zijn groen. DG-CI-17 en DG-CI-18 zijn onder de echte
matrixbelasting niet teruggekomen.

De vijf overgeslagen jobs zijn geen ontbrekende PR-controles: drie
incrementele bewijsroutes zijn door de gekozen volledige route vervangen,
publicatie van het vertrouwde bewijsboek is aan de publicatiecontext gebonden
en kalibratie aan de nachtelijke planning. Geen rode job is door een groene
afgeleide job gemaskeerd.

Deze tegenproef sluit de actuele verplichte CI-foutboom. Zij verklaart RTG nog
niet Deep Green: `npm run check` meldt 912 verlopen APPWERKT-bewijzen en
EXPERIENCEWERKT blijft eerlijk `NOT_TESTED` met 0/3360 bewezen voorwaarden.
Die twee kwalificatiedomeinen volgen als afzonderlijke verplichte metingen.

**Meetstand integrale tegenproef 5.** Openstaande unieke oorzaken: **0 in de
verplichte CI-foutboom**. Opgelost sinds vorige meting: **2**. Nieuwe
regressies: **0**. Eerder verborgen fouten ontdekt: **0**. Niet-uitgevoerde
verplichte controles: **2 kwalificatiedomeinen** (actuele APPWERKT- en
EXPERIENCEWERKT-bewijzen). Deep Green: **GEBLOKKEERD**.

#### APPWERKT-herstelronde — één beeldactie en semantische browsertabs

De volledige browsermeting op `e2144bfb5e` vond geen productdefect, maar hield
zeven onderdelen terecht op `NIET_GETEST`: LibraryOS, Pulse, Wonen, Decision
Room, Partner Network, Project Room en Web droegen naast de centrale Edge nog
een bedekte bronactie voor dezelfde beeldeditor. De bronactie blijft het
modulecontract voor Edge, maar heeft nu dezelfde toegankelijke identiteit en
wordt in de werkruimte niet als tweede zichtbare of focusbare knop
gepresenteerd. De bestaande Edge is de enige presentatie-eigenaar.

Gerichte APPWERKT-tegenproeven sloten daarop LibraryOS 4/4, Pulse 25/25,
Wonen 4/4, Decision Room 15/15, Partner Network 4/4 en Project Room 9/9.
Web bracht daarna een afzonderlijke, eerder verborgen semantische oorzaak aan
het licht: de tabsluitknop stond binnen een element met `role=button`. Tab
kiezen en tab sluiten zijn nu twee nevengeschikte echte knoppen. Web sloot
daarna 9/9 eigen acties en 22/22 gedeelde schilacties, zonder onaangeraakte,
onklikbare of onderschepte bediening.

De gerichte Browser-, beeldeditor- en muisregressies zijn groen; een eerste
samengestelde run telde 8/9 doordat de Design System-keuring terecht
`border-radius: inherit` weigerde. Na gebruik van het bestaande radiustoken
sloot ook die keuring groen. De volledige APPWERKT-registerherbouw en de
overige verlopen bewijsbronnen volgen uitsluitend op een schone commit; de
gerichte uitkomst wordt niet als vervanging daarvoor gepresenteerd.

**Meetstand APPWERKT-herstelronde.** Openstaande unieke oorzaken: **0 binnen
het pakket van zeven bedieningsgaten**. Opgelost sinds vorige meting: **2**.
Nieuwe regressies: **0 in de gerichte tegenproeven**. Eerder verborgen fouten
ontdekt: **1** (geneste tabbediening in Web). Niet-uitgevoerde verplichte
controles: **2 kwalificatiedomeinen** (integrale APPWERKT-herbouw inclusief de
overige bewijsbronnen, en EXPERIENCEWERKT). Deep Green: **GEBLOKKEERD**.

#### Proof-Bound Engineering fase 1 — Evidence-Aware Code Architect

Dit werkpakket bouwt geen Agent OS, register, releaseketen of nieuwe
bewijsbron. De bestaande Code Architect heeft één adviserende `preflight`-
projectie gekregen. Het vluchtige contract `rtg-proof-envelope-v1` bindt een
taak aan de exacte HEAD/base-commit, agent, toegestane bestanden, schermowners,
letterlijke runtimeverwijzingen, risicoklasse, gerichte en integrale toetsen,
bewijsimpact, kennisgaten, werkboom- en PR-conflicten en expliciete tijd-,
token- en CI-budgetten. Een afzonderlijke deterministische validator leidt
`VALID`, `INSUFFICIENT_CONTEXT` of `CONFLICT` af.

De projectie hergebruikt `SCHERMEIGENAAR.json`, de Code Architect-registers,
het bestaande evidence-plan, Git-worktrees en regressiehistorie. Zij schrijft
niets, voert geen shelltekst uit repositoryinhoud uit, promoveert geen bewijs
en kan niet pushen, mergen, locken of releasen. Een ontbrekende actuele
PR-snapshot, vuile werkboom, achterlopende basis of onbekende testrelatie houdt
de context onvoldoende. Bij een kennisgat blijven volledige CI en gerichte
APPWERKT-/EXPERIENCEWERKT-herkwalificatie verplicht.

Historische regressietoetsen dekken de vijf gedeelde oorzaken achter de eerdere
166 Design System-meldingen, de desktop-/mobiele schermlaag, de zeven recent
herstelde APPWERKT-gaten, een overlappende PR, een verouderde base-commit,
testversmalling bij onbekende afhankelijkheden en administratief groen ondanks
een conflict. Samen met de bestaande Code Architect-toetsen sluiten 17/17.

**Vergelijkbare nulmeting.** Op dezelfde lokale Node 26-werkboom gaf de oude
`context` voor `public/apps/browser.html` in 204 ms 4.338 bytes, maar geen
schermowner, gerichte test of conflictanalyse. De eerste volledige preflight
deed dit in 2.268 ms en 11.708 bytes; na begrenzing en compacte uitvoer in circa
2.053 ms en 9.768 bytes, met één owner, elf gerichte toetsen en elf gecontroleerde
werkbomen. Voor de gedeelde World-presentatie ging de preflight van de eerste
3.405 ms en 108.086 bytes naar circa 2.095 ms en 42.397 bytes, terwijl 261
geraakte schermowners en 83 gerichte of historische toetsen zichtbaar bleven.
De gerapporteerde tokens zijn uitsluitend een transparante bytes/4-proxy;
werkelijk modelverbruik en end-to-end kostenbesparing zijn nog niet bewezen.

De technische volledigheid is verbeterd, maar fase 1 is nog geen vrijgegeven
CI-poort. De huidige ontwikkelboom is bewust vuil tijdens de implementatie, er
is in de lokale proef geen actuele commitgebonden PR-snapshot aangeleverd en
`TOETSROUTES.json` ontbreekt. De preflight meldt daarom terecht
`INSUFFICIENT_CONTEXT`; deze blokkades zijn niet als succes behandeld.

**Volgende gecontroleerde stap.** Na een schone commit worden dezelfde
acceptatiecasussen opnieuw uitgevoerd met een actuele PR-snapshot. Pas wanneer
nul verplichte tests worden gemist en de gemeten contextwinst de extra
preflightkosten rechtvaardigt, volgt een afzonderlijk voorstel voor fase 2,
Collision Guard. Die fase mag werkgebieden reserveren, maar begint niet in dit
werkpakket en wordt niet automatisch een blokkerende poort.

**Meetstand Proof-Bound fase 1.** Openstaande unieke implementatieoorzaken:
**0 in de gerichte code- en validatietoetsen**. Opgelost: **de ontbrekende
verbinding tussen context, eigenaar, Git-conflict en bewijsplan**. Nieuwe
regressies: **0 in 17 gerichte toetsen**. Niet-uitgevoerde verplichte controles:
**schone commit-herproef met actuele PR-snapshot, volledige CI en een echte
end-to-end kostenmeting**. Deep Green: **GEBLOKKEERD**.
