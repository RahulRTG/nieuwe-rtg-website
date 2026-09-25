# DemocratieOS en de partij — twee projecten, één muur

*DemocratieOS is de interne architectuurnaam, en blijft dat. Het is geen vijfde
wereld: het is voor gebruikers bereikbaar in FoundationOS en krijgt een eigen
rechtspersoon (par. 19).
Naar buiten komt later een menselijke naam die niet naar technologie klinkt,
want mensen moeten het ervaren als een plek om mee te doen, niet als software.
Die naam is niet nodig om fase B en C te bouwen.*

**Fase A is gesloten (25 september 2026).** Dat betekent niet dat dit document
niet meer verandert. Het betekent dat er genoeg constitutionele besluiten zijn
genomen om verantwoord te gaan bouwen.

Dit document beschrijft **twee projecten die bewust uit elkaar worden gehouden**:

1. **DemocratieOS**: neutrale infrastructuur voor burgers, maatschappelijke
   organisaties, overheden en **álle** democratische partijen.
2. **Een toekomstige politieke partij**: één gewone deelnemer aan dat systeem,
   met exact dezelfde rechten als elke andere partij. Dat moet **technisch**
   gelden, ook als de oprichter RTG bezit.

De zin die boven alles staat:

> **DemocratieOS stelt mensen beter in staat zelf politieke keuzes te maken. Het
> systeem maakt die keuzes niet voor hen.**

Lees dit vóór je iets bouwt waarmee een mens een maatschappelijke kwestie
inbrengt, een bijeenkomst organiseert, een politiek voorstel volgt of een besluit
terugkrijgt. `LEVEN.md` par. 2, `LIFE.md` par. 4, `FOUNDATION.md` par. 5, `HDI.md`
par. 5 en `MENSNETWERK.md` (MN-01 t/m MN-03) staan er onverkort boven.

Zoals `HDI.md` en `ECONOMIE.md` is dit een richtingsdocument: per onderdeel staat
er of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren weg**
is.

---

## 0. Wat er veranderde

**Versie 3 (fase A gesloten):** de zes besluiten zijn genomen (par. 19), de
grondwet kreeg drie wijzigingsniveaus en een noodprocedure (par. 12), het
dreigingsmodel kreeg macht over tijd (par. 13), er kwam een derde
onafhankelijkheidsproef (P3: RTG verdwijnt), het wettelijk profiel draagt nu
toepassingsbereik en controledatum (par. 14.1), en fase B en C zijn afgebakend
met drie synthetische partijen (par. 18).

**Versie 2:**

- **Het plan is groter dan één partij.** Versie 1 splitste een burgerlaag van een
  partijlaag. Nu is die burgerlaag een eigen project (DemocratieOS) met een eigen
  grondwet, en is de partij een klant zoals elke andere.
- **Een correctie op versie 1: `toezegging` is bezet.** Het woord draagt in 69
  bestanden een *financiële* belofte: de open giften van het mecenaat in
  `server/kern/geldgraaf/bronnen.js`, `server/kern/geldwereld.js` en
  `server/kern/levensgraaf/bronnen2.js`, met `soort: 'toezegging'`. Een politieke
  belofte onder dezelfde naam is precies de `VERMOGENS`-botsing. De code heet
  daarom **`politiekeToezegging`** (nul treffers). Op het scherm mag het gewoon
  "toezegging" heten, want een codenaam en een schermnaam hoeven niet gelijk te
  zijn.
- **`partij` is ook bezet**: het woord staat in 283 bestanden, vooral als partij
  bij een contract en als potje in een spel (`kern/spellen/partij.js`). In de code
  heet het daarom `politiekePartij`.

---

## 1. Vier rechtspersonen, één muur

| | Wat het is | Wat het nooit is |
|---|---|---|
| **RTG** | commercieel bedrijf en technologische infrastructuur | politieke actor |
| **RTFoundation** | initiatiefnemer; mag technologie leveren | eigenaar of bestuurder van DemocratieOS |
| **DemocratieOS** (eigen rechtspersoon, besluit 2) | partijneutrale burgerinfrastructuur met een onafhankelijk toezichtsorgaan | campagne-instrument, leadgenerator |
| **De partij** | een zelfstandige vereniging | een afdeling van RTG of RTF |

De partij heeft alles zelf: bankrekening, boekhouding, ledenadministratie,
personeel, bestuur, contracten, data, domeinen, communicatie, AI-context,
authenticatie en analytics. Er is **geen gedeelde politieke dataset**. Koopt de
partij commerciële diensten van RTG, dan gebeurt dat tegen de voorwaarden die voor
elke vergelijkbare klant gelden (`TENANT.md`: *`org` IS de klant*).

### 1.1 De drie onafhankelijkheidsproeven

Neutraliteit is pas bewezen als deze drie proeven slagen:

| Proef | Wat hij vraagt | Machinaal te bewijzen? |
|---|---|---|
| **P1: de partij verdwijnt** | draait DemocratieOS volledig door zonder die ene partij? | **ja.** Alle DemocratieOS-toetsen draaien met een **leeg partijenregister** en met drie synthetische partijen (par. 18), en de burgerlus geeft dezelfde uitkomst. Kent de code een partij bij naam, dan zakt hij (DO-03) |
| **P2: de oprichter verdwijnt uit RTG** | kan de partij doorgaan als de oprichter geen enkele functie in RTG meer heeft? | **alleen gedeeltelijk.** De partij draait buiten deze repository. Wat dit huis kan bewijzen: de uitgang van een tenant (export, opzegging, overdracht) werkt zonder medewerking van één persoon, en geen enkele bevoegdheid van de partij hangt aan de identiteit van de oprichter (MN-01 is daar de proefopzet voor). De rest is juridisch en organisatorisch |
| **P3: RTG verdwijnt** | kan de onafhankelijke organisatie DemocratieOS technisch elders voortzetten, zonder toestemming van RTG en zonder toestemming van welke partij dan ook? | **vandaag nee, en dat staat hier eerlijk.** DemocratieOS zou nu in het RTG-monoliet draaien, op de identiteitskluis, de hosting en de code van RTG. P3 wordt pas haalbaar met drie dingen die **vanaf de eerste regel** moeten gelden: (1) de code van DemocratieOS woont in een eigen map met een **verklaarde, kleine lijst van wat hij uit RTG gebruikt** (de vorm van `GRENZEN.json`, zodat de afhankelijkheid gemeten en niet geschat wordt); (2) alle gegevens zijn **exporteerbaar in een open formaat**; (3) een **licentie of escrow** die de onafhankelijke organisatie het recht geeft de code mee te nemen. Het derde is een besluit en een contract, geen code |

P3 is de ultieme proef. Als het antwoord ooit ja is, is onafhankelijkheid niet
alleen organisatorisch beloofd maar architectonisch mogelijk gemaakt.

---

## 2. De grondwet van DemocratieOS

Elke regel draagt wie hem vandaag handhaaft. Een regel zonder handhaver is een
zin, geen regel (`LAT.md` regel 13). Waar een functie botst met een regel,
vervalt de functie.

| Code | Regel | Wat er al staat | Handhaver vandaag |
|---|---|---|---|
| **DO-01 Menselijke waardigheid** | geen mens wordt score, doelgroep of politiek profiel | CAR-05, `scripts/lib/cijferopmens.js` | **gedeeltelijk**: de scan dekt deze map nog niet |
| **DO-02 Niemand kwijt** | elke kwestie heeft een aantoonbaar vervolg of een gemotiveerde eindstand | `server/kern/livinglab/vraagbesluit.js` voor één domein | **niemand**: de meter komt in fase B |
| **DO-03 Gelijke partijrechten** | de infrastructuur kent geen favoriete partij | — | **niemand**: fase C |
| **DO-04 Geen eigenaarprivilege** | RTG, de oprichter en zijn partij krijgen geen bijzondere politieke capability | MN-01 (`test/mn01-bevoegdheidsvoordeel.test.js`) als vorm | **niemand** voor dit domein |
| **DO-05 Geen politieke microtargeting** | Foundation-, Living-, Service-, RTG- en kwestiedata worden nooit gebruikt om politieke overtuigbaarheid te voorspellen | `server/kern/bureau/relaties.js` en `server/kern/vonk/selectie.js` weigeren politieke voorkeur lokaal | **gedeeltelijk** |
| **DO-06 AI adviseert, mensen besluiten** | Rahul stelt voor, een mens besluit | `FABRIC.md`, `server/kern/stuur/beleid.js` | **staat** voor het huis, niet voor dit domein |
| **DO-07 Geen algoritmische winnaar** | geen partijscore, geen betrouwbaarheidsranglijst, geen stemadvies | — | **niemand** |
| **DO-08 Herleidbaar bewijs** | een publieke feitelijke bewering gaat waar mogelijk terug naar bron, berekening en aanname | `server/kern/livinglab/graden.js`, `server/kern/fiscaal/herkomst.js` als vorm | een stap weg |
| **DO-09 Macht is zichtbaar** | wie besloot, met welke bevoegdheid en wanneer | `server/kern/stadsweefsel/besluitvorming.js` | **staat** voor de stad |
| **DO-10 Geschiedenis wordt niet herschreven** | een correctie is een nieuwe gebeurtenis | `server/lib/keten.js` | **staat** als primitief, niet aangesloten |
| **DO-11 Toegankelijkheid is fundamenteel** | B1, meertaligheid, screenreader, grote tekst | `TOEGANKELIJK.md`: er is **geen B1-laag** | poorten voor contrast en structuur, niet voor taal |
| **DO-12 Offline telt even zwaar** | een gesprek in het buurthuis is geen tweederangs inbreng | — | **niemand** |
| **DO-13 Zelf kiezen** | het systeem levert informatie, de burger neemt de politieke beslissing | — | draagt DO-07 en par. 9 |

Een bijzonder punt bij DO-12: offline inbreng wordt door een **mens** ingevoerd
(een gastheer, een vrijwilliger). Hij krijgt de herkomst `ter-plaatse` en weegt in
elke telling exact even zwaar. De herkomst is er om te kunnen nagaan, niet om te
wegen.

---

## 3. De universele lus

> WELKOM → KWESTIE → LUISTEREN → BIJEENKOMST → BEWIJS → MOGELIJKHEDEN → VOORSTEL →
> BESLUIT → ACTIE → RESULTAAT → TERUGKOPPELING → HEROPENEN

Bijna elke stap bestaat al in een ander domein. **Het werk is aansluiten, niet
uitvinden** (dezelfde conclusie als `HDI.md` par. 1).

| Stap | Wat er al staat | Stand |
|---|---|---|
| Welkom | `server/kern/rtfos/publiek.js` (zonder inlog), `server/routes/rtfos/voordeur.js` (zonder account, met twee remmen) | een stap weg |
| Kwestie | niets; de dunne laag van par. 4 | te bouwen, fase B |
| Luisteren | `server/kern/stadsweefsel/inspraak.js` (*"nooit wie wat vond"*), `server/kern/rtfos/gemeente.js` (ondergrens van vijf), `server/kern/service/patroon.js` (vermoeden, een mens bevestigt) | staat, verspreid |
| Bijeenkomst | `server/kern/genootschap/bijeenkomst.js`, `server/kern/rtfos/activiteiten.js`, `server/translate/`, `server/kern/toegankelijk.js` | een stap weg |
| Bewijs | `server/kern/livinglab/graden.js` (laagste plafond wint), `server/kern/livinglab/conclusielijn.js` | staat als vorm |
| Mogelijkheden | `server/kern/livinglab/werkplaats.js`, `server/kern/knelpunt/` (vondsten bij een randvoorwaarde, nooit bij een mens) | een stap weg |
| Voorstel | de aannamelijst (par. 7.2) | te bouwen |
| Besluit | `server/kern/stadsweefsel/besluitvorming.js`, `server/kern/rtfos/bestuur.js` | staat, per orgaan |
| Actie | `server/kern/rtfos/vrijwilligers-inzet.js`, `server/kern/rtfos/projecten.js` | een stap weg (DoeNetwerk, par. 6) |
| Resultaat | `server/kern/stadsweefsel/rekenkamer.js` (*"geen cijfer en geen stoplicht"*) | staat als vorm |
| Terugkoppeling | `server/kern/ontvanger.js` (pas bezorgd met een bewezen leespad) | staat |
| Heropenen | — | te bouwen: een nieuwe behandelronde, de oude blijft staan |

---

## 4. De kwestie: de dunne laag

**Een kwestie bezit niets. Hij verwijst.**

| Waarnaar | Waar het woont |
|---|---|
| mens | identiteit en kluis (codenaam, nooit een naam) |
| bewijs | het bewijsdomein |
| geld | de geldlaag (`kern/pay/poort.js`) |
| bijeenkomst | `genootschap/bijeenkomst.js` |
| besluit | het besluitdomein van het bevoegde orgaan |
| actie | het DoeNetwerk |
| toezegging | het register van par. 8 |

Zo ontstaat er geen monsterdatabase: dat is de `journeys`-fout uit
`TRAVELCOMMERCE.md` en de `humans`-grens uit `HDI.md` par. 5.1. De vorm staat al
in `server/kern/service/zaak.js` (*een zaak weet waarover het gaat en opent
niets*).

Een kwestie heeft een tijdlijn met één schrijver, zoals `service/loop.js`:

> KW-000184 — Onveilige oversteek bij school
> ingebracht → vergelijkbare signalen gevonden → menselijke bevestiging →
> bijeenkomst gehouden → gemeente reageerde → drie mogelijkheden onderzocht →
> partijen koppelden voorstellen → besluit → uitvoering → resultaat onderzocht →
> inwoners geïnformeerd

**Niets verdwijnt, en niets wordt eeuwige waarheid.** Een gesloten kwestie kan
door nieuwe feiten een nieuwe **behandelronde** krijgen. Die komt als nieuwe regel
op dezelfde tijdlijn; de vorige ronde blijft ongewijzigd staan.

Eindstanden, als gesloten lijst naar het voorbeeld van `vraagbesluit.js`:

| Eindstand | Wat de inbrenger terugkrijgt |
|---|---|
| `uitgevoerd` | wat er is gedaan en wat we over het resultaat weten |
| `afgewezen` | wie, met welke bevoegdheid, waarom, en de argumenten voor en tegen |
| `samengevoegd` | de nieuwe kwestie; hij blijft inbrenger |
| `doorgestuurd` | naar wie, en hoe hij het daar volgt |
| `onhaalbaar` | de reden uit de lijst |
| `samen-opgelost` | wat het DoeNetwerk deed; er kwam geen politicus aan te pas |
| `ingetrokken` | niets meer, want dat is zijn eigen keuze |

---

## 5. De burgerkant: warm, niet als overheidsportaal

De eerste vraag is niet *"Selecteer beleidscategorie"* maar:

> **Welkom. Wat speelt er bij jou?**
> Ik wil iets vertellen · Ik heb een idee · Ik wil helpen · Ik wil iets begrijpen ·
> Wat gebeurt er bij mij in de buurt? · Ik wil mensen ontmoeten

Drie regels daaronder:
- **Luisteren en kijken kan zonder account.** Inbrengen kan met elk account, en
  een betaalde pas geeft nooit meer gewicht (`WERELDEN.md`: passen bepalen
  commerciële rechten, en deelnemen is geen commercieel recht).
- **Geen politieke profilering bij binnenkomst.** Het gebied kiest de mens zelf,
  zoals in `inspraak.js`. Er wordt geen adres opgezocht.
- **Een jongere mag meedoen** (`LEVEN.md` par. 2). Stemmen in een formeel besluit
  gaat langs `volwassen()` in `server/kern/volwassen.js` en krijgt geen eigen
  kopie van die regel.

---

## 6. DoeNetwerk

Het werkelijk nieuwe onderdeel. De eerste vraag is niet *"welke wet moet
veranderen?"* maar **"kunnen mensen dit samen oplossen?"**

> mensen vinden → bijeenkomst → rollen → benodigdheden → toestemming →
> financiering → actie → resultaat → terugkoppeling

Wat er al staat: vrijwilligersinzet, projecten, Buurtruil
(`server/kern/rtfos/ruil.js`) en de bijeenkomst. Wat ontbreekt: **een actie die bij
een burger begint** in plaats van bij de organisatie van de stichting. Twee grenzen
blijven gelden:
- **Samenstellen en klaarzetten, bevestigen doet de mens** (`LIFE.md`): een
  uitnodiging aan een ander gaat nooit automatisch.
- **Geld verlaat het huis nooit vanzelf** (`GELD.md`): financiering wordt
  klaargezet en een mens voert uit.

Sommige kwesties eindigen nooit bij een politicus. Daar is de eindstand
`samen-opgelost` voor.

---

## 7. Het politieke protocol

### 7.1 Eén aansluiting voor alle partijen

Elke deelnemende partij publiceert via **hetzelfde schema, dezelfde API-versie en
dezelfde limieten**. Het schema kent tien soorten: standpunt, voorstel,
amendement, onderbouwing, dekking, toezegging, stemming, wijziging, uitvoering en
toelichting.

Er komt geen `if (partij === X) extra()`, en **de build zakt daarop** (DO-03).
Een partij is gegevens in een register en nooit een tak in de code.

**Het partijenregister is zelf een machtspunt**, dus toelating hangt uitsluitend
aan een **officiële registratie**, nooit aan verkiezingssucces en nooit aan een
oordeel van dit systeem. DemocratieOS beoordeelt niet of een partij goed, redelijk
of democratisch genoeg is. Dat doet de Kiesraad ook niet: die beoordeelt bij
registratie de aanduiding en gaat na of er sprake is van een politieke partij,
maar keurt geen politieke doelstellingen (opgave van de eigenaar, par. 14).

Er zijn **twee categorieën**, want registratie en deelname zijn juridisch niet
hetzelfde:

| Categorie | Wanneer | Waarom apart |
|---|---|---|
| `geregistreerd` | de partij heeft een geregistreerde aanduiding voor dat verkiezingsniveau | het officiële register is de bron |
| `deelnemer` | de partij neemt aan een verkiezing deel, ook als blanco lijst zonder geregistreerde aanduiding | anders sluit het systeem een lijst uit die de wet wel toelaat |

Beide categorieën krijgen **dezelfde deur**. De categorie zegt waar de toelating
vandaan komt, niet hoeveel een partij mag.

### 7.2 De aannamelijst onder een voorstel

Voordat een partij roept dat iets gaat werken, draagt een voorstel een vaste lijst:
wat kost het, wie betaalt het, wie profiteert, wie heeft er nadeel van, welke
regel moet veranderen, wie voert het uit, en welke aannames zijn onzeker. **Elk veld
staat op `onbekend` tot iemand het met een bron invult.** Een leeg veld is een
vaststelling en geen oordeel, en het staat voor elke partij op dezelfde plek.

Een echte beleidssimulatiemotor is **jaren weg**. Zonder deze lijst eronder zou hij
een orakel zijn.

---

## 8. Het toezeggingsregister

Los van partijprogramma's. Een `politiekeToezegging` draagt: wie hem deed,
wanneer, waar, de **letterlijke bron**, het onderwerp, het bestuursniveau, de
beoogde termijn, een meetbare formulering (als die er is), latere wijzigingen,
relevante besluiten en stemmingen, en de toelichting van de partij.

- **Geen score.** Nooit *"betrouwbaarheid partij: 74%"*. De feiten staan er, de
  burger oordeelt.
- **Een partij mag uitleggen** waarom iets niet uitvoerbaar bleek. Die toelichting
  staat naast het feit en vervangt het nooit.
- **Een wijziging is een nieuwe regel** op `server/lib/keten.js`.
- **Externe verankering vanaf versie 1, niet "later als we groot zijn"** (besluit
  6). De eigen database blijft de operationele bron. Periodiek wordt een
  cryptografisch controleerbare toestand van het register (een samenvattende
  hash over de keten) buiten de eigen beheergrens vastgelegd
  (`server/lib/keten-anker.js`; `AFSPRAAK.md`: *een anker in dezelfde database is
  geen anker*). Zo is achteraf te bewijzen dat een historische toezegging niet
  ongemerkt is herschreven. **In het anker staan nooit persoonsgegevens**, alleen
  de hash. Waar het anker komt te liggen, is een uitvoeringskeuze binnen dit
  besluit.
- **Wie de stand zet**, is een besluit. De partij zelf zet nooit "nagekomen"
  (geen eigen voldoende). Dat vraagt een bron of een besluit van het bevoegde
  orgaan.

---

## 9. Vergelijken zonder stemadvies

De burger kiest een onderwerp (bijvoorbeeld Wonen). Daarna verschijnen de
geregistreerde voorstellen van alle partijen, volgens dezelfde presentatieregels.
De burger kiest zelf waarop hij vergelijkt: kosten, tijdlijn, juridische
verandering, belastingeffect, uitvoering, onderbouwing, tegenargumenten, eerdere
stemmingen en toezeggingen.

Drie presentatieregels die makkelijk over het hoofd worden gezien:
- **Volgorde is ook een rangorde** (besluit 4). Niet alfabetisch, niet op
  zetelaantal, niet op populariteit, en ook **geen verborgen persoonlijke
  randomisering**. De volgorde **wisselt zichtbaar en voor iedereen gelijk**:
  een openbare, voorspelbare rotatie ("vandaag begint de lijst bij partij X"),
  zodat iedereen dezelfde volgorde ziet en kan nagaan dat niemand een vaste
  voorsprong heeft. Daarnaast kan de gebruiker **zelf sorteren** op objectieve
  kenmerken (kosten, termijn, bestuursniveau).
- **Er wordt niet geoptimaliseerd op volgorde.** Het systeem registreert nooit
  welke volgorde tot meer politieke klikken leidt. Een systeem dat dat meet, gaat
  er vroeg of laat op sturen (`NO_ORDER_OPTIMIZATION`, par. 11).
- **Afwezigheid is neutraal.** "Deze partij heeft hierover niets aangeleverd"
  staat bij elke partij op dezelfde plek en in dezelfde vorm. Het is geen rood
  vakje.
- **Geen betaalde plek.** Er is geen manier om hoger, groter of eerder te staan.

Rahul mag zeggen: *"Leg het verschil tussen deze twee voorstellen uit op B1."*
Rahul zegt nooit: *"Welke partij past het beste bij mij?"*

---

## 10. Rahul als democratische assistent

Rahul krijgt in dit domein een **`kwestieProjectie`**, en nooit automatisch een
burgerprofiel. Dit is dezelfde vorm als `vondsten(voorwaarde)` in
`server/kern/knelpunt/`: de functie **kan** geen mens ontvangen, in plaats van dat
het verboden is.

Toegestaan: B1 maken, vertalen, ontbrekende dekking aanwijzen, ontbrekende
tegenargumenten aanwijzen, feitelijke verschillen tussen voorstellen uitleggen,
beweringen zonder bron aanwijzen en uitvoeringsafhankelijkheden noemen.

**Er is geen overtuigings-API, en dat is geen promptfilter: de capability bestaat
niet.** Een toets zakt zodra in dit domein een route, tool of functie verschijnt
die een doelgroep, segment of overtuigbaarheid als invoer of uitvoer draagt (de
woordenlijst op één plek, zoals `scripts/lib/cijferopmens.js`).

B1 gaat alleen via een **lokaal** model (`LOCAL_AI_URL`). De originele tekst blijft
leidend en de B1-versie draagt het label "vereenvoudigd".

Buiten de code: de EU-verordening over politieke reclame (2024/900) is volgens de
opgave van de eigenaar sinds 10 oktober 2025 van toepassing, en de AP wijst op de
transparantie- en privacyverplichtingen. Een jurist bevestigt wat dat voor dit
domein betekent (par. 20).

---

## 11. De constitutionele suite

Neutraliteit wordt code. De namen hieronder komen van de eigenaar. Elke toets
krijgt een zelfijking (een met opzet foute invoer die hij moet vinden), want een
toets die niet kan zakken, meet niets.

| Toets | Wat hij bewijst | Vorm die al bestaat |
|---|---|---|
| `PARTY_CAPABILITY_PARITY` | elke partij heeft exact dezelfde routes, limieten en API-versie | — |
| `PARTY_DATA_PARITY` | elke partij ziet exact dezelfde gegevens | MN-02-proef (byte voor byte) |
| `PARTY_AI_PARITY` | Rahul geeft voor verwisselde partijnamen een gelijkwaardig antwoord | `test/aicontext-allowlist.test.js` |
| `PARTY_PRESENTATION_PARITY` | zelfde velden, zelfde afwezigheidsvorm, volgorde volgens par. 9 | — |
| `PARTY_PRICE_PARITY` | een partij betaalt wat elke vergelijkbare klant betaalt | `kern/pasladder.js` |
| `OWNER_NO_ADVANTAGE` | de oprichter en zijn partij krijgen 404 waar ze geen recht hebben | `test/mn01-bevoegdheidsvoordeel.test.js` |
| `FOUNDATION_PARTY_NEUTRALITY` | de code van dit domein kent geen partij bij naam (proef P1) | — |
| `NO_POLITICAL_PROFILE` | er bestaat geen veld of afleiding voor politieke voorkeur | `bureau/relaties.js` |
| `NO_CROSS_WORLD_TARGETING` | geen lezer van andere werelden in dit domein | `server/kern/economie/firewall.js` |
| `NO_PERSUASION_CAPABILITY` | par. 10 | `scripts/lib/cijferopmens.js` |
| `NO_PAID_RANKING` | er is geen betaalpad naar zichtbaarheid | — |
| `NO_ORDER_OPTIMIZATION` | er wordt geen klikgedrag per volgorde vastgelegd | — |
| `EMERGENCY_ONLY_RESTRICTS` | een noodmaatregel kan alleen uitzetten, nooit toevoegen (par. 12.2) | — |
| `CONSTITUTION_CHANGE_PROCEDURE` | een wijziging aan de grondwet heeft een voorstel, een wachttijd en een verankering (par. 12.1) | — |
| `ISSUE_PARTY_NEUTRALITY` | een kwestie is van niemand; een partij koppelt, ze eigent zich niets toe | — |
| `HISTORY_IMMUTABLE` | een correctie is een nieuwe regel | `server/lib/keten.js` |
| `HUMAN_DECIDES` | geen besluit zonder mens met bevoegdheid | `stadsweefsel/besluitvorming.js` |
| `NIEMAND_KWIJT` | **0 onverklaard verdwenen** | `vraagbesluit.js`, `scripts/doodspoor.js` |

**NIEMAND_KWIJT wordt huisbreed, en dan als invariant en niet als score.** Hij telt
kwesties zonder eindstand voorbij hun termijn, eindstanden zonder bewezen leespad
naar de inbrenger (de fout uit `MAATSTAF.md` par. 7f) en samenvoegingen waarbij
een inbrenger zoekraakte. De uitkomst is een ratel die alleen omlaag mag. Hij is
nooit een ranglijst van kwesties, wijken of medewerkers.

Let op de verhouding met `scripts/doodspoor.js`. Die vraagt of een *handeling*
ergens aankomt, en is een triagelijst. NIEMAND_KWIJT vraagt of een *mens* een
antwoord kreeg, en is een invariant. Ze delen een vraag, niet een meter.

---

## 12. Onafhankelijk toezicht

Het doel: de oprichter kan de neutraliteitsregels **niet alleen** wijzigen. Dat
beschermt de andere partijen, en de oprichter zelf tegen de verdenking dat hij de
spelregels stil heeft veranderd.

**Wat code hier kan, en wat niet.** Code kan gedrag afdwingen zolang de grondwet
van de code zelf niet eenzijdig gewijzigd kan worden. Wie beheerder is van de
repository, kan uiteindelijk elke toets verwijderen. Een toets beschermt dus tegen
vergissingen, niet tegen de eigenaar. Daarom hoort **governance buiten de
repository bij het systeem**:

1. **Statuten.** Het toezichtsorgaan en zijn vetorecht staan in de statuten van
   de eigen rechtspersoon van DemocratieOS (besluit 2). Dan is omzeilen een
   schending van de statuten en geen commit.
2. **Een openbaar wijzigingslog** van de grondwet, verankerd buiten de eigen
   database, zodat een stille wijziging achteraf aantoonbaar is.
3. **Verplichte review in de repository**: de beschermde en grondwetbestanden
   krijgen een code-eigenaar uit het toezichtsorgaan, en de branchbescherming
   geldt ook voor beheerders.

De samenstelling (staatsrecht, privacy, cybersecurity, toegankelijkheid,
burgerparticipatie, technologie) is een besluit van de oprichtende partijen van
die rechtspersoon.

### 12.1 Drie wijzigingsniveaus

Niet elke wijziging weegt even zwaar. Het doel is niet dat de grondwet
onveranderlijk is, maar dat **niemand 's nachts DO-07 kan wijzigen en 's ochtends
nieuwe software uitrolt**.

| Niveau | Wat eronder valt | Procedure |
|---|---|---|
| **NORMAAL** | productfuncties, schermen, teksten | gewone review |
| **BESCHERMD** | de contracten van kwestie, bewijs en neutraliteit, en de suite van par. 11 | constitutionele review: een code-eigenaar uit het toezichtsorgaan tekent mee |
| **GRONDWET** | DO-01 t/m DO-13 | verzwaarde procedure: openbaar wijzigingsvoorstel, wachttijd, goedkeuring door het toezichtsorgaan, externe verankering van de nieuwe tekst |

Wat de code daarvan kan afdwingen: de grondwet komt in een eigen,
machineleesbaar bestand, en een toets zakt als dat bestand verandert zonder een
bijbehorende regel in het wijzigingslog met een voorsteldatum die langer dan de
wachttijd geleden is. Een beheerder kan die toets weghalen, maar dan staat dat
openbaar in de geschiedenis. De eigenlijke bescherming blijft de statuten plus
de externe verankering. De lengte van de wachttijd is een besluit van het
toezichtsorgaan.

### 12.2 De noodprocedure, en haar asymmetrie

Een ernstig privacy- of beveiligingslek moet **direct** kunnen worden stilgelegd,
zonder drie weken op een grondwetsprocedure te wachten. Daarvoor is er een
noodprocedure met één harde grens:

> **Een noodmaatregel mag democratische functionaliteit tijdelijk beperken om
> schade te stoppen, maar mag nooit partijprivileges creëren.**

In de code betekent dat drie dingen:
- **Alleen uitzetten.** Een noodmaatregel is een lijst van capabilities die uit
  gaan. Een maatregel die iets aanzet, verruimt of aan één partij geeft, wordt
  geweigerd (`EMERGENCY_ONLY_RESTRICTS`).
- **Voor iedereen gelijk.** Een capability gaat voor alle partijen en burgers
  tegelijk uit, nooit voor één partij.
- **Van tijdelijke aard.** Een maatregel vervalt vanzelf na een vaste termijn,
  tenzij het toezichtsorgaan hem bekrachtigt. Hij komt direct in het openbare
  log, met de reden.

---

## 13. Het dreigingsmodel

De gevaarlijkste aanvaller hoeft geen hacker te zijn. Het kan over twintig jaar
een rechtmatig benoemd bestuur zijn dat denkt: *"die neutraliteitsregel zit ons
eigenlijk in de weg."* Het model gaat daarom ook over **macht over tijd**.

**Aanvallen van buiten en binnen:**

| Wie of wat | Wat hij probeert | Tegenmaatregel |
|---|---|---|
| **de oprichter of RTG** | een voordeel voor de eigen partij | DO-03, DO-04, P1, par. 12 |
| **een partij** | het register bespelen: overvloed aan posts, strategisch leeg laten, andermans bron betwisten | dezelfde limieten voor iedereen, afwezigheid neutraal, betwisting als nieuwe regel met bron |
| **nepburgers** (astroturfing) | een kwestie groter laten lijken dan hij is | telling per kwestie en gebied met de remmen van `voordeur.js`; een vermoeden bevestigt een mens; veel reacties is geen waarheid |
| **een buitenlandse actor** | invloed via inbreng of geld | geen geldweg naar partijen via dit domein; herkomstregels liggen bij de partij (Wfpp) |
| **een RTG-medewerker** | burgerdata inzien voor een partij | geen kantoorweg naar kwestiedata zonder reden en journaal (`MENSNETWERK.md` besluit 5) |
| **prompt injection** via bijdragen | Rahul laten overtuigen of rangschikken | de capability bestaat niet (par. 10); een bijdrage is een gegeven, nooit een instructie |
| **de burger zelf, later** | "ik wil dat wat ik zei weg is" | intrekken mag; de kwestie blijft, zijn inbreng wordt als ingetrokken gemarkeerd zonder de geschiedenis te herschrijven |

**Macht over tijd:**

| Dreiging | Hoe het eruitziet | Tegenmaatregel |
|---|---|---|
| **institutionele overname** | de rechtspersoon wordt van binnenuit overgenomen | statuten met toezichtsorgaan en vetorecht; GRONDWET-niveau (par. 12.1) |
| **bestuurscapture** | een rechtmatig bestuur vindt de neutraliteit hinderlijk | het bestuur kan de grondwet niet alleen wijzigen; wachttijd plus openbaar voorstel |
| **toezichthouder-capture** | het toezichtsorgaan zelf raakt eenzijdig samengesteld | samenstelling over meerdere disciplines, benoemingstermijnen, openbare benoeming (besluit bij de oprichting) |
| **stille grondwetswijziging** | een regel verandert zonder dat iemand het ziet | extern verankerd wijzigingslog; de toets van par. 12.1 |
| **afhankelijkheid van één leverancier** | RTG kan DemocratieOS gijzelen door te stoppen of te dreigen | proef P3: eigen map met verklaarde afhankelijkheden, open export, licentie of escrow |
| **selectieve dienstverlening** | een partij krijgt stilletjes een tragere of kleinere deur | `PARTY_CAPABILITY_PARITY` en gelijke limieten; noodmaatregelen gelden voor iedereen |
| **historische herschrijving** | een oude toezegging of besluit wordt aangepast | keten plus extern anker vanaf versie 1 |
| **financiële afhankelijkheid** | één grote financier krijgt feitelijk zeggenschap | een financieringsbeleid in de statuten met een plafond per financier en openbare herkomst (besluit bij de oprichting) |

---

## 14. De partij zelf, buiten dit huis

Wat hier staat is een **richting**, geen juridisch advies.

**Rechtsvorm.** Een vereniging met volledige rechtsbevoegdheid, met statuten in een
notariële akte. Daarin minimaal: ledenvergadering of congres, bestuur (voorzitter,
secretaris, penningmeester), toelating en beëindiging van lidmaatschap, de
kandidaatstellingsprocedure, interne besluitvorming, belangenconflicten, financieel
toezicht, statutenwijziging en opheffing. Vrijwillig daarbovenop, passend bij deze
opzet: **oprichter is niet eigenaar**. De leden vormen de partij.

**Registratie en deelname** zijn twee stappen: eerst de aanduiding registreren bij
de Kiesraad, daarna deelnemen met ondersteuningsverklaringen en een waarborgsom.
De getallen staan in het profiel hieronder en niet in lopende tekst, zodat ze op
één plek verouderen.

**Verkiezingsgereedheid hoort niet in DemocratieOS** (besluit 5). Het is
dienstverlening aan een partij, geen democratische infrastructuur voor een
burger. Als RTG later zo'n complianceproduct aanbiedt, kan elke vergelijkbare
partij het onder dezelfde voorwaarden afnemen. Zo hoeft DemocratieOS geen
indirecte partijsteun te waarderen. De juridische kwalificatie van die
dienstverlening wordt apart getoetst.

### 14.1 Wetgeving als versie, nooit als constante

Er komen **geen bedragen in de constitutionele code**. Er komt een
`POLITICAL_LAW_PROFILE_NL` waarin elke waarde zes velden draagt:

`waarde` · `rechtsgrond` · `toepassingsbereik` · `bron` · `geldigVanaf` ·
`laatstGecontroleerd`

Het **toepassingsbereik** is net zo belangrijk als het bedrag: een regel die
alleen geldt voor partijen met een zetel, mag niet stil op elke partij worden
toegepast. De vorm bestaat al: `server/kern/fiscaal/regelwacht.js` bewaart regels
per jaargang, en `scripts/wetwacht.js` meldt dat een wetsbron veranderde, waarna
een mens oordeelt.

**De nulmeting.** De eigenaar heeft deze waarden op 25 september 2026 tegen
officiële bronnen (Kiesraad en Rijksoverheid) gecontroleerd. Deze sessie heeft de
bronnen zelf niet geopend.

| Waarde | Toepassingsbereik | Bron volgens de eigenaar |
|---|---|---|
| registratieverzoek uiterlijk 42 dagen vóór de kandidaatstelling | registratie van een aanduiding voor de Tweede Kamer; vereniging met volledige rechtsbevoegdheid, notariële statuten | Kiesraad |
| waarborgsom registratie € 450 | registratie van een aanduiding | Kiesraad |
| ondersteuningsverklaringen: 30 per kieskring, 10 op Bonaire (580 voor alle twintig kieskringen) | deelname aan de Tweede Kamerverkiezing door een nieuwe partij | Kiesraad |
| openbaarmaking van giften vanaf € 1.000 | **specifiek voor partijen met een zetel in de Eerste of Tweede Kamer** | Rijksoverheid (Wfpp) |
| snelle meldplicht vanaf € 10.000 per donateur per jaar | Wfpp | Rijksoverheid |
| verbod op giften boven € 100.000 | Wfpp | Rijksoverheid |

De registratie voor de Tweede Kamer werkt volgens de eigenaar door naar
Provinciale Staten, waterschappen en gemeenteraden.

Wat er aankomt: het wetsvoorstel Wet op de politieke partijen (Wpp) ligt volgens
de eigenaar nog bij de Tweede Kamer, met verdere behandeling in december 2026.
Het raakt financiering, interne organisatie, transparantie en politieke
advertenties. Het profiel krijgt dan een nieuwe versie; de code verandert niet.

---

## 15. Geld

**DemocratieOS verplaatst geen geld naar partijen.** Het toont wat partijen
openbaar maken, volgens dezelfde regels voor iedereen.

De Wfpp-waarden staan in het profiel van par. 14.1, met hun toepassingsbereik.
Volgens de eigenaar zijn buitenlandse financiële giften aan partijen verboden;
dat hoort er als zevende rij bij zodra de bron is vastgelegd.

De eigen partij kan vrijwillig strenger zijn. DemocratieOS blijft neutraal en legt
geen strengere regel op aan andere partijen dan de wet doet.

---

## 16. Wat DemocratieOS níét bouwt

Deze afwezigheid is onderdeel van de architectuur. De lijst gaat de toets van
`NO_PERSUASION_CAPABILITY` in, zodat een van deze dingen niet stil kan ontstaan:

kiezersscore · politieke persoonlijkheidsscore · detectie van zwevende kiezers ·
emotionele kwetsbaarheidsscore · politieke lookalike-doelgroepen uit RTG-data ·
automatische propaganda · AI-stemadvies · partijranglijst · betaalde politieke
ranglijst · Foundation-naar-partij-leadgenerator · eigenaarsexport · geheime
campagne-API

---

## 17. De fysieke wereld

Lokale ontmoetingsplekken, niet uitsluitend van een partij: koffie drinken, een
kwestie bespreken, een bijeenkomst organiseren, digitale hulp krijgen, iets leren,
vrijwilligers vinden of gewoon binnenlopen. DemocratieOS doet de administratie
erachter, met `server/kern/rtfos/activiteiten.js` als bestaande basis (wachtlijst,
check-in, ouderlijke toestemming, VOG).

Let op de naam: **"Huis" is in dit repository het woord voor het hele systeem**
("dit huis"). Een fysieke plek heet dus anders, bijvoorbeeld ontmoetingsplek.

*Door en voor mensen. Dingen samen doen.* De techniek is daar bijna onzichtbaar.

---

## 18. Bouwvolgorde

| Fase | Wat | Stand |
|---|---|---|
| **A — Constitutie** | dit document, de scheiding, de grondwet, de wijzigingsniveaus, het dreigingsmodel, de besluiten | **gesloten** (25 september 2026); de juridische en fiscale toetsing vóór oprichting van de rechtspersoon loopt apart |
| **B — Minimale burgerlus** | zie hieronder | volgende stap |
| **C — Neutraliteit** | zie hieronder | na B |
| **D — Menselijkheid** | B1 (lokaal), toegankelijkheid, meertaligheid, bijeenkomsten, offline inbreng | een stap weg |
| **E — DoeNetwerk** | een actie die bij de burger begint | een stap weg |
| **F — Politiek protocol** | aansluiting voor partijen, register met twee categorieën, voorstellen, bronnen, stemmingen | **pas als B én C groen zijn** |
| **G — Toezeggingen** | het register van par. 8, extern verankerd vanaf versie 1 | na F |
| **H — Rahul** | de democratische assistent | pas nu, omdat zijn grenzen dan al bestaan |
| **I — Partijorganisatie** | de vereniging en haar eigen software | **buiten dit huis** |
| **J — Verkiezingsgereedheid** | een eventueel RTG-product voor elke partij onder gelijke voorwaarden | **buiten DemocratieOS** (besluit 5) |
| jaren weg | beleidssimulatie, publieke verificatie van besluiten | — |

### 18.1 Fase B bouwt alleen dit

> kwestie → behandeling → gemotiveerde eindstand → terugkoppeling → NIEMAND_KWIJT

- de kwestie als dunne laag (par. 4), met een tijdlijn met één schrijver;
- de gesloten lijst eindstanden, met **`samen-opgelost` als volwaardige
  eindstand** en niet als restcategorie;
- terugkoppeling over een bewezen leespad (`server/kern/ontvanger.js`);
- heropenen als nieuwe behandelronde;
- de meter NIEMAND_KWIJT met zelfijking en een ratel die alleen omlaag mag;
- de code in een **eigen map met een verklaarde lijst van wat hij uit RTG
  gebruikt** (voorwaarde voor P3; later afdwingen kost veel meer dan nu).

Fase B kent **geen partij**. Er is geen register, geen voorstel van een partij en
geen AI.

### 18.1a Wat fase B nu is (25 september 2026)

**Gebouwd**, in `server/kern/democratie/` en `server/routes/democratie/`:

| Onderdeel | Waar | Wat vaststaat |
|---|---|---|
| gesloten eindstanden | `eindstanden.js` | zeven, met `samen-opgelost`; geen "anders" |
| de kwestie met één schrijver | `kwestie.js` | tijdlijn en journaal zijn een hashketen en worden nooit ingekort; een eindstand verandert niet achteraf, heropenen is een nieuwe ronde |
| de koppeling naar de mens | `koppeling.js` | de enige plek met een RTG-sleutel; elke kwestie een eigen inbrengersnummer; vergeten laat de kwestie staan |
| terugkoppeling in drie treden | `index.js`, `lid.js` | `klaargezet` (te lezen via de eigen lijst, in dezelfde vastlegging als de eindstand), `gewekt` (melding), `gezien` |
| NIEMAND_KWIJT | `meter.js` | tellingen per stand plus zeven soorten breuk; nooit een percentage |
| verklaarde afhankelijkheden | `afhankelijkheden.js` | elke module en naam uit RTG, met wat hij doet en hoe vervangbaar hij is |
| tien routes | `/api/member/democratie/...`, `/api/office/democratie/...` | het kantoor alleen op naam; een demosessie brengt niets in |

**Bewezen** door drie toetsbestanden, elk met mutaties die hem lieten zakken:
- `test/democratie.test.js`: de lus, de eisen per eindstand, geen RTG-sleutel in een kwestie, en een zelfijking die elke soort breuk een keer maakt;
- `test/democratie-afhankelijk.test.js`: `UNDECLARED_RTG_DEPENDENCY = 0`, plus DO-03 in zijn kleinste vorm (fase B kent het woord partij niet);
- `test/democratie-verlies.test.js`: honderd kwesties door een storm van crashes (voor de mutatie, na de commit, voor de wek), met een herstart na elke dood. In de eerste ronde: 95 geaccepteerd, 27 keer gestorven, 33 eindstanden, **nul kwijt en nul onverklaard**. Een mutatie die de koppeling naar de mens in een tweede vastlegging zet, laat deze proef zakken: dat is precies de mens die tussen twee systemen verdwijnt.

**Wat de verliesproef niet bewijst.** Hij draait op sqlite, waar gewoon wegschrijven al synchroon is. Hij bewijst dus de samenhang van de keten onder crashes, niet dat de duurzame vastlegging op PostgreSQL even streng is. En wie geen 200 kreeg, weet dat hij het opnieuw moet doen; daarbij kan een tweede kwestie ontstaan. Die is niet kwijt, maar hij is wel dubbel, en dat lost `samengevoegd` op.

### 18.2 Fase C probeert B kapot te maken

Elke regel hieronder wordt een toets die kan zakken, met een zelfijking:

| Bewering | Wat de proef doet |
|---|---|
| partij A ≠ partij B | twee partijen krijgen byte voor byte dezelfde deur |
| de partij van de oprichter ≠ partij A | geen enkele route, limiet of tekst kent de ene partij anders dan de andere |
| eigenaar ≠ privilege | de eigenaar van RTG krijgt 404 waar hij geen recht heeft (vorm van MN-01) |
| rijk ≠ voorrang | er is geen betaald pad naar plek, snelheid of zichtbaarheid |
| veel reacties ≠ waarheid | een massa gelijke reacties maakt een vermoeden en geen besluit; een mens bevestigt |
| burger ≠ politiek profiel | geen veld, afleiding of export van politieke voorkeur |
| kwestie ≠ targetinginvoer | geen lezer die kwestiedata aan een partij of segment koppelt |
| bijdrage ≠ instructie aan Rahul | een bijdrage die een instructie bevat, verandert niets aan het gedrag |
| partij verdwijnt ≠ burgerlus verandert | proef P1: dezelfde uitkomst met leeg register en met drie partijen |

### 18.3 De eerste partij is synthetisch

De eerste partijen die DemocratieOS technisch leert kennen zijn **Partij Noord,
Partij Midden en Partij Zuid**: synthetische organisaties in de testwereld,
zonder ideologie en zonder echte namen. De volledige pariteitssuite draait met
die drie.

**Pas als B én C groen zijn, wordt de eerste echte `politiekePartij` aan de
runtime gekoppeld, en dat is niet de partij van de oprichter.** Zo is het systeem
gebouwd vanuit één aanname:

> **Wij weten niet wie u bent. Wij hoeven niet te weten wat u vindt. U krijgt
> dezelfde deur als ieder ander.**

---

## 19. Genomen besluiten (25 september 2026)

1. **Publieke naam.** Nog niet vastgelegd. DemocratieOS blijft de interne
   architectuurnaam. Later komt een menselijke naam die klinkt als een plek om
   mee te doen, niet als software.
2. **Rechtspersoon.** Een **afzonderlijke rechtspersoon** voor de neutrale
   burgerlaag. De RTFoundation kan initiatiefnemer zijn en technologie leveren,
   maar de governance valt niet samen met de stichting van de oprichter.
   Rechtsvorm, statuten en fiscale gevolgen worden vóór oprichting getoetst door
   Nederlandse juridische en fiscale deskundigen.
3. **Partijenregister.** Een **officiële registratie**, niet verkiezingssucces,
   met twee categorieën: `geregistreerd` en `deelnemer` (par. 7.1). Het systeem
   oordeelt niet over partijen.
4. **Volgorde.** Geen vaste volgorde en geen verborgen persoonlijke
   randomisering, maar een **zichtbaar wisselende volgorde die voor iedereen
   gelijk is**, plus zelf sorteren op objectieve kenmerken. Er wordt niet
   geoptimaliseerd op klikken (par. 9).
5. **Verkiezingsgereedheid.** **Buiten** de gratis burgerkern. Als RTG het later
   aanbiedt, dan voor elke vergelijkbare partij onder dezelfde voorwaarden
   (par. 14).
6. **Toezeggingsregister.** **Externe verankering vanaf versie 1**, zonder
   persoonsgegevens in het anker (par. 8).

Toegevoegd bij het sluiten van fase A: de drie wijzigingsniveaus en de
noodprocedure (par. 12.1 en 12.2), het dreigingsmodel over tijd (par. 13) en
proef P3 (par. 1.1).

---

## 20. Wat dit document niet zegt

- **Het is geen juridisch advies.** De Wfpp, de Wpp, de Kieswet, de ANBI-regels,
  de AVG en de EU-verordening over politieke reclame zijn hier genoemd als
  richting. Volgens de fiscale klassen van dit huis is dat `advies`: een jurist
  met kennis van partijfinanciering en kiesrecht beoordeelt het.
- **Niets hiervan is gebouwd.** Par. 3 zegt wat er in andere domeinen staat, niet
  dat het hier werkt.
- **Proef P2 is maar half machinaal, en P3 is vandaag niet haalbaar.** Wie leest
  dat de scheiding "bewezen" is, moet weten dat een deel ervan in statuten en
  contracten staat en niet in code.
- **De wettelijke nulmeting is door de eigenaar gecontroleerd, niet door deze
  sessie.** Het profiel van par. 14.1 draagt daarom per waarde een bron en een
  controledatum, en een jurist bevestigt het vóór het iets afdwingt.
- **Er is nog nooit een burger door deze lus gelopen.** Of iemand zich gehoord
  voelt terwijl zijn voorstel werd afgewezen, is geen eigenschap van de code maar
  iets wat je aan mensen vraagt.
