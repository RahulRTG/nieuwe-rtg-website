# DemocratieOS en de partij — twee projecten, één muur

*Werknamen. DemocratieOS is geen vijfde wereld maar een onderdeel van
**FoundationOS**. Het achtervoegsel "OS" dragen verder alleen de vier werelden,
dus de publieke naam is een besluit (par. 19).*

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

## 0. Wat er sinds versie 1 veranderde

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

## 1. Drie rechtspersonen, één muur

| | Wat het is | Wat het nooit is |
|---|---|---|
| **RTG** | commercieel bedrijf en technologische infrastructuur | politieke actor |
| **RTFoundation / DemocratieOS** | partijneutrale burgerinfrastructuur | campagne-instrument, leadgenerator |
| **De partij** | een zelfstandige vereniging | een afdeling van RTG of RTF |

De partij heeft alles zelf: bankrekening, boekhouding, ledenadministratie,
personeel, bestuur, contracten, data, domeinen, communicatie, AI-context,
authenticatie en analytics. Er is **geen gedeelde politieke dataset**. Koopt de
partij commerciële diensten van RTG, dan gebeurt dat tegen de voorwaarden die voor
elke vergelijkbare klant gelden (`TENANT.md`: *`org` IS de klant*).

### 1.1 De twee onafhankelijkheidsproeven

Neutraliteit is pas bewezen als deze twee proeven slagen:

| Proef | Wat hij vraagt | Machinaal te bewijzen? |
|---|---|---|
| **P1: de partij verdwijnt** | draait DemocratieOS volledig door zonder die ene partij? | **ja.** Alle DemocratieOS-toetsen draaien met een **leeg partijenregister** en met een register van drie willekeurige partijen, en de uitkomst is gelijk. Kent de code een partij bij naam, dan zakt hij (DO-03) |
| **P2: de oprichter verdwijnt uit RTG** | kan de partij doorgaan als de oprichter geen enkele functie in RTG meer heeft? | **alleen gedeeltelijk.** De partij draait buiten deze repository. Wat dit huis kan bewijzen: de uitgang van een tenant (export, opzegging, overdracht) werkt zonder medewerking van één persoon, en geen enkele bevoegdheid van de partij hangt aan de identiteit van de oprichter (MN-01 is daar de proefopzet voor). De rest is juridisch en organisatorisch, en dat staat er liever eerlijk bij dan als groen vinkje |

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

**Het partijenregister is zelf een machtspunt.** Wie bepaalt welke partij mag
aansluiten, bepaalt het speelveld. Toelating hangt daarom uitsluitend aan een
**objectief criterium** dat niemand per geval kan kiezen: een bij de Kiesraad
geregistreerde aanduiding, of een deelname aan een gemeenteraadsverkiezing. Welk
criterium precies, is een besluit (par. 19). "Wij vinden deze partij niet
democratisch genoeg" is geen criterium maar een oordeel, en een oordeel hoort bij
de rechter, niet bij de infrastructuur.

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
- **Een wijziging is een nieuwe regel** op `server/lib/keten.js`. Voor een openbaar
  register hoort het anker buiten de eigen database te liggen
  (`server/lib/keten-anker.js`; `AFSPRAAK.md`: *een anker in dezelfde database is
  geen anker*).
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
- **Volgorde is ook een rangorde.** Alfabetisch bevoordeelt de A, en "meeste
  zetels eerst" bevoordeelt de gevestigde partij. De volgorde is daarom de
  **officiële lijstvolgorde**, of een per bezoek wisselende volgorde waarvan de
  gebruikte volgorde zichtbaar is. Welke van de twee is een besluit.
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

**Wat code hier kan, en wat niet.** Wie beheerder is van de repository, kan
uiteindelijk elke toets verwijderen. Een toets beschermt dus tegen vergissingen,
niet tegen de eigenaar. Echte bescherming zit in drie lagen daarbuiten:

1. **Statuten.** Het toezichtsorgaan en zijn vetorecht staan in de statuten van
   de rechtspersoon die DemocratieOS draagt. Dan is omzeilen een schending van de
   statuten en geen commit.
2. **Een openbaar wijzigingslog** van de grondwet (par. 2 en 11), verankerd buiten
   de eigen database, zodat een stille wijziging achteraf aantoonbaar is.
3. **Verplichte review in de repository**: de grondwetbestanden krijgen een
   code-eigenaar uit het toezichtsorgaan, en de branchbescherming geldt ook voor
   beheerders.

De samenstelling (staatsrecht, privacy, cybersecurity, toegankelijkheid,
burgerparticipatie, technologie) en de procedure (technische review, juridische
review, onafhankelijke goedkeuring, openbaar log) zijn een besluit.

---

## 13. Het dreigingsmodel

| Wie of wat | Wat hij probeert | Tegenmaatregel |
|---|---|---|
| **de oprichter of RTG** | een voordeel voor de eigen partij | DO-03, DO-04, P1, par. 12 |
| **een partij** | het register bespelen: overvloed aan posts, strategisch leeg laten, andermans bron betwisten | dezelfde limieten voor iedereen, afwezigheid neutraal, betwisting als nieuwe regel met bron |
| **nepburgers** (astroturfing) | een kwestie groter laten lijken dan hij is | telling per kwestie en gebied met de remmen van `voordeur.js`; een vermoeden bevestigt een mens; dat een kwestie aandacht krijgt, beslist niets |
| **een buitenlandse actor** | invloed via inbreng of geld | geen geldweg naar partijen via dit domein; herkomstregels liggen bij de partij (Wfpp) |
| **een RTG-medewerker** | burgerdata inzien voor een partij | geen kantoorweg naar kwestiedata zonder reden en journaal (`MENSNETWERK.md` besluit 5) |
| **prompt injection** via bijdragen | Rahul laten overtuigen of rangschikken | de capability bestaat niet (par. 10); bijdragen zijn gegevens, nooit instructies |
| **de burger zelf, later** | "ik wil dat wat ik zei weg is" | intrekken mag; de kwestie blijft, zijn inbreng wordt als ingetrokken gemarkeerd zonder de geschiedenis te herschrijven |

---

## 14. De partij zelf, buiten dit huis

Wat hier staat is een **richting**, geen juridisch advies. De getallen zijn de
opgave van de eigenaar van 25 september 2026. Deze sessie heeft ze niet
nagetrokken, en een jurist bevestigt ze.

**Rechtsvorm.** Een vereniging met volledige rechtsbevoegdheid, met statuten in een
notariële akte. Daarin minimaal: ledenvergadering of congres, bestuur (voorzitter,
secretaris, penningmeester), toelating en beëindiging van lidmaatschap, de
kandidaatstellingsprocedure, interne besluitvorming, belangenconflicten, financieel
toezicht, statutenwijziging en opheffing. Vrijwillig daarbovenop, passend bij deze
opzet: **oprichter is niet eigenaar**. De leden vormen de partij.

**Registratie bij de Kiesraad** (opgave eigenaar): de aanduiding wordt geregistreerd
met notariële statuten, een waarborgsom (€ 450, terug bij een geldige lijst bij de
eerstvolgende verkiezing), een gemachtigde en een plaatsvervanger, uiterlijk 42
dagen vóór de kandidaatstelling. Een registratie voor de Tweede Kamer werkt door
naar Provinciale Staten, waterschappen en gemeenteraden.

**Deelname** is een aparte stap: voor een nieuwe partij ondersteuningsverklaringen
(30 per kieskring, 10 op Bonaire) en een eigen waarborgsom.

**Verkiezingsgereedheid** (statuten, registratie, gemachtigden,
kandidatenprocedure, instemmingsverklaringen, ondersteuningsverklaringen,
waarborgsom, termijnen, financiële en privacyverplichtingen) is een checklist die
administratieve fouten voorkomt en de Kiesraad niet vervangt. **Waar hij woont, is
een besluit** (par. 19): als gratis dienst van de stichting aan partijen is hij,
ook voor iedereen gelijk, mogelijk een gift in natura aan elke partij die hem
gebruikt.

### 14.1 Wetgeving als versie, nooit als constante

Er komen **geen bedragen in de constitutionele code**. Er komt een
`POLITICAL_LAW_PROFILE_NL` met versie, geldigheidsdatum en juridische bron. De vorm
bestaat al: `server/kern/fiscaal/regelwacht.js` bewaart regels per jaargang, en
`scripts/wetwacht.js` meldt dat een wetsbron veranderde, waarna een mens oordeelt.

De reden is concreet: volgens de opgave van de eigenaar ligt het wetsvoorstel Wet
op de politieke partijen (Wpp) nog bij de Tweede Kamer, met verdere behandeling
gepland voor december 2026. Het raakt financiering, interne organisatie,
transparantie en politieke advertenties.

---

## 15. Geld

**DemocratieOS verplaatst geen geld naar partijen.** Het toont wat partijen
openbaar maken, volgens dezelfde regels voor iedereen.

De Wfpp (opgave eigenaar, te bevestigen):
- giften vanaf € 1.000 openbaar maken;
- substantiële giften vanaf € 10.000 per donateur per jaar binnen drie dagen melden;
- giften boven € 100.000 verboden;
- buitenlandse financiële giften verboden.

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

| Fase | Wat | Stand | Waarom op deze plek |
|---|---|---|---|
| **A — Constitutie** | dit document, DemocratieOS gedefinieerd, de scheiding, de grondwet, het dreigingsmodel, **juridische review** | document staat; de review vraagt een mens | alles daarna leunt erop |
| **B — Minimale burgerlus** | kwestie → behandeling → eindstand → reden → bewezen terugkoppeling, plus NIEMAND_KWIJT | een stap weg | het eigen onderscheid, en het patroon staat al |
| **C — Neutraliteit** | de suite van par. 11, P1, owner isolation | een stap weg | de grenzen staan vóór de eerste partij en vóór de eerste AI-functie |
| **D — Menselijkheid** | B1 (lokaal), toegankelijkheid, meertaligheid, bijeenkomsten, offline inbreng | een stap weg | DO-11 en DO-12 |
| **E — DoeNetwerk** | een actie die bij de burger begint | een stap weg | leunt op B en D |
| **F — Politiek protocol** | aansluiting voor partijen, partijenregister, voorstellen, bronnen, stemmingen | vraagt een besluit (toelatingscriterium) | pas als C de gelijkheid bewijst |
| **G — Toezeggingen** | het register van par. 8, verankerd | vraagt een besluit (het anker) | leunt op F |
| **H — Rahul** | de democratische assistent | een stap weg | pas nu, omdat zijn grenzen dan al bestaan |
| **I — Partijorganisatie** | de vereniging en haar eigen software | **buiten dit huis** | los van DemocratieOS |
| **J — Verkiezingsgereedheid** | Kiesraad, kandidaten, verklaringen, waarborgsommen | vraagt een besluit (par. 14) | de laatste stap |
| jaren weg | beleidssimulatie, publieke verificatie van besluiten | — | zonder de aannamelijst en de keten zouden ze een orakel zijn |

---

## 19. Besluiten van de eigenaar

1. **Publieke naam.** "DemocratieOS" suggereert een vijfde wereld naast LivingOS,
   WorkOS, TravelOS en FoundationOS. Kies een naam zonder "OS" (aanbevolen), of
   houd hem als werknaam en besluit bij de lancering.
2. **Rechtspersoon van DemocratieOS.** Binnen de RTFoundation, strikt neutraal
   (sneller, maar dezelfde stichting als de oprichter), of een aparte stichting
   met het toezichtsorgaan in de statuten (aanbevolen voor proef P2 en par. 12,
   meer werk).
3. **Toelating tot het partijenregister.** Kiesraadregistratie (aanbevolen: het
   meest objectief), deelname aan een verkiezing op elk niveau, of beide.
4. **Volgorde bij vergelijken.** De officiële lijstvolgorde, of een per bezoek
   wisselende volgorde die zichtbaar is.
5. **Verkiezingsgereedheid.** Als dienst tegen kostprijs voor elke partij
   (aanbevolen), gratis voor iedereen (mogelijk een gift in natura), of helemaal
   buiten DemocratieOS.
6. **Het anker van het toezeggingsregister.** Buiten de eigen database (aanbevolen),
   of eerst intern met de keten en later extern.

---

## 20. Wat dit document niet zegt

- **Het is geen juridisch advies.** De Wfpp, de Wpp, de Kieswet, de ANBI-regels,
  de AVG en de EU-verordening over politieke reclame zijn hier genoemd als
  richting. Volgens de fiscale klassen van dit huis is dat `advies`: een jurist
  met kennis van partijfinanciering en kiesrecht beoordeelt het.
- **Niets hiervan is gebouwd.** Par. 3 zegt wat er in andere domeinen staat, niet
  dat het hier werkt.
- **Proef P2 is maar half machinaal.** Wie leest dat de scheiding "bewezen" is,
  moet weten dat de helft ervan in statuten en contracten staat en niet in code.
- **Er is nog nooit een burger door deze lus gelopen.** Of iemand zich gehoord
  voelt terwijl zijn voorstel werd afgewezen, is geen eigenschap van de code maar
  iets wat je aan mensen vraagt.
