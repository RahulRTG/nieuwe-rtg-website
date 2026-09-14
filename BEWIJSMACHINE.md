# De bewijsmachine

> **No change is trusted because it looks correct. A change earns trust by
> surviving evidence.**

Dit bestand hoort bij `MAGNAATLAB.md` zoals `MAGNAATLAB.md` bij `GAMEHALL.md`
hoort, en het zet er een lat bovenop. `MAGNAATLAB.md` vraagt of Magnaat kan
bewijzen dat RTG **vandaag** klopt. Dit vraagt of hij kan voorspellen of RTG
**morgen** nog klopt — technisch, economisch, juridisch en architectonisch.

Vier bakken, net als in `OS.md` en `DEVELOPERCLOUD.md`: **staat**, **een stap
weg**, **een besluit nodig**, **jaren weg**.

En opnieuw begint het met een meting, want de opzet doet één bewering die dit
huis zelf heeft uitgelokt.

---

## 0. De aanleiding: een vondst die om een vervolg vroeg

`scripts/capabilities.js` stuitte op twee constanten die allebei `VERMOGENS`
heten en niets delen:

| | `kern/bevoegdheid/lijst.js` | `kern/command/vermogens.js` |
|---|---|---|
| Betekent | wat RTG juridisch **mag** | of een dienst het **doet** |
| Leden | `SEPA_UIT`, `KLANTGELD`, `WALLET_SALDO` | `bereikbaar`, `binnenkomen`, `betalen` |
| Gedeeld | **nul** | **nul** |

De opzet trekt daar de goede conclusie uit en vraagt een **Semantic Registry**.
De vraag die dáárvoor komt: was dat een incident of een patroon? Een register
voor één geval is een la; een register voor tachtig gevallen is infrastructuur.

Dat is gemeten. `scripts/semantiek.js`, vastgelegd in `SEMANTIEK.json`, bewaakt
door `test/semantiek.test.js`.

---

## 1. Wat er van de opzet vandaag al staat, gemeten

| uit de opzet | wat er staat | waar |
|---|---|---|
| **1** executable specifications (half) | 46 systeemwetten met per stuk een bron én een handhaver — en een motor die ze **echt overtreedt** in de bestanden om te zien of er iets rood wordt | `WETTEN.json`, `scripts/sabotage.js`, `SABOTAGE.json` |
| **3** counterfactual (kiem) | `wijzig()` op het wereldmodel schrijft een `counterfactual`-besluit weg | `kern/hospitality-universe/world-model.js` |
| **4** performance budgets | p99, doorvoer, event-loop en hersteltijd met een lat die alleen omlaag mag, en die weigert te oordelen op een gezakte ronde | `BEPROEVING.json`, `scripts/norm.js` |
| **7** incident → permanente wet | dit is letterlijk hoe `LAT.md` is ontstaan: elke regel komt uit een fout die hier écht is gemaakt, met de handhaver erbij | `LAT.md`, `NORM.json` |
| entropie-meting | 31 meters in `NORM.json` met een **ratel**: elke meter mag maar één kant op, en verlagen gaat met de hand en met een reden | `NORM.json`, `scripts/norm.js` |
| simplicity/complexity budget | koppeling gemeten en geratelt: `kernBreedte`, `kernGedeeld`, `kernBreedsteBestand` | `scripts/grenzen.js`, `GRENZEN.json` |
| duplication detection | twee modules met gelijkenis **1,00** gevonden en benoemd (`kern/command` en `kern/zaakcommand`) | `scripts/objectmodel.js` |
| observability als taal (half) | routejournaal, meting per route, servicedoelen als data | `server/routelog.js`, `server/meting.js`, `SLO.json` |
| impact-based testing (de eerlijke helft) | welke toets welke route werkelijk heeft aangeraakt, uit een **echt** journaal en niet uit een declaratie | `scripts/dekking.js` |
| de scorecard | **`scripts/zekerheid.js`** — en die bestaat juist om te voorkomen wat de opzet aan het eind voorstelt (zie par. 4.1) | `scripts/zekerheid.js` |

**Zeven van de voorstellen staan geheel of half.** Wat opvalt is dat het huis de
*houding* van deze opzet al heeft — meten, ratelen, en de meter zelf wantrouwen.
Wat het niet heeft is de **verbinding**: elk instrument beantwoordt zijn eigen
vraag, en niets legt ze op elkaar.

---

## 2. De zes bewijzen, langsgelopen

De opzet stelt zes bewijzen voor per release. Dat is een goede indeling, en het
is meteen de eerlijkste manier om te zien waar dit huis staat.

| bewijs | kan RTG dit vandaag? | waarop |
|---|---|---|
| **Correctness** — doet hij wat hij moet doen | **grotendeels**: 1115 toetsbestanden met 7482 beweringen (waarvan 976 servertoetsen), en per toets de vraag of hij ooit is zien zakken | `BEWIJS.md`, `MUTATIES.json` |
| **Safety** — kan hij wat hij niet mag | **deels**: aanvalsbatterij, rolproef, kruis-tenant, doelschending. Wat ontbreekt is de *gegenereerde* tegenvoorbeeldzoektocht | `scripts/aanval.js`, `test/scheiding.test.js`, `test/appstore-doel.test.js` |
| **Resilience** — blijft hij werken als de rest stukgaat | **ja, en gemeten**: failover echt omgegooid, hersteltijd geklokt | `scripts/chaos.js`, `scripts/hersteltijd.js` |
| **Economics** — blijven kosten gezond | **nauwelijks**: er is een kostenmeting voor de duurzame commit, geen kosten per journey en geen verschil per wijziging | `scripts/duurzaamheidskosten.js` |
| **Evolvability** — kunnen we dit later veranderen | **dit is het gat**, en de opzet heeft gelijk dat het meestal ontbreekt. Zie par. 3 | — |
| **Explainability** — kunnen we achteraf bewijzen waarom | **ja, en met een eigen begrip**: de bewijsgraad (onbekend / vermoed / gemeten / bewezen) met datum, en `niet vast te stellen` als eersteklas uitslag | `BESTUUR.md` |

Vier van de zes staan of half-staan. **Economics en Evolvability zijn de twee
lege plekken**, en dat is precies wat je zou verwachten: het zijn de twee die
pas pijn doen als een systeem oud wordt.

---

## 3. Evolvability, gemeten

Evolvability laat zich niet meten als "kunnen we dit veranderen". Wel als: **hoe
veel begrippen betekenen hier al meer dan één ding?** Want dat is wat
veranderen duur maakt — je verandert `SOORTEN` en raakt negenendertig plekken
die niets met elkaar te maken hebben.

### De uitkomst

```
2395 bestanden, 841 catalogi, 520 verschillende namen
  96 namen staan in meer dan een domein
  78 woorden dragen MEER DAN EEN betekenis   (samen 284 betekenissen)
  29 betekenissen wonen op MEER DAN EEN plek                    (LAT-regel 4)
 106 paren dragen dezelfde waarheid onder een ANDERE naam       (LAT-regel 4)
```

Van de 96 gedeelde namen dragen er **78 meer dan één betekenis**. Het was dus
geen incident.

De ergste, met het aantal betekenissen dat de meter na clustering overhoudt:

| woord | betekenissen | een greep uit wat het kan zijn |
|---|---|---|
| `SOORTEN` | **39** | contractsoorten, gebeurtenissen in een tijdlijn, avondplannen, rekeningsoorten |
| `STATUS` | 10 | ontwerpfases bij de architect, betaalstanden, ideeënstanden, subsidiestanden |
| `STANDEN` | 11 | voorkeursstanden, verzoekstanden, mediastanden, regiestanden |
| `NIVEAUS` | 9 | dreigingsniveaus, bijstandsniveaus, concern-scopes, geldbeleidsniveaus |
| `CATEGORIEEN` | 9 → **8** | app-categorieën, voertuigcategorieën, kledingcategorieën, risicocategorieën (atelier is eruit, zie par. 3) |
| `ROLLEN` | 8 | bedrijfsrollen, gezinsrollen, en zes andere |

### Twee bevindingen, en ze wijzen tegengesteld

Dit is waarom de meter twee uitslagen kent en niet één getal:

- **Botsing** — één woord, meerdere dingen. De reparatie is **hernoemen**.
- **Dubbeling** — één ding, meerdere plekken. De reparatie is **samenvoegen**,
  en het is `LAT.md` regel 4.

De dubbelingen worden op twee manieren gezocht, en de tweede vond het geval waar
het om ging:

| ronde | wat hij vindt | aantal |
|---|---|---|
| **op naam** | dezelfde naam, dezelfde inhoud, twee domeinen | **29** |
| **op inhoud** | dezelfde inhoud onder een **andere** naam | **106** |

Die tweede ronde bestaat omdat de eerste hem miste. Dat is geen detail: de
duurste dubbeling van allemaal draagt per definitie twee namen, want anders was
hij al opgevallen.

Een meter die die twee optelt, levert een getal waar niemand iets mee kan: de
ene helft moet uit elkaar, de andere naar elkaar toe.

### De convergentie: twee metingen wijzen naar dezelfde vier domeinen

De grootste dubbelingen zijn niet generiek maar heel specifiek:

```
PALET    4 plekken, 16 leden   architect · atelier · hardwarelab · studio
STATUS   4 plekken,  6 leden   architect · atelier · hardwarelab · studio
BUREAUS  0,83                  kern/ideeen.js  ·  routes/werkplek-bureaus.js
```

Dat zijn **precies de vier domeinen** die `DEVELOPERCLOUD.md` par. 2 aanwees als
de enige kandidaat die de drempel haalde: een **ontwerpopdracht**, gedeeld door
`architect`, `atelier`, `hardwarelab` en `studio`.

Die twee metingen hebben niets met elkaar te maken. `scripts/objectmodel.js`
vergelijkt de VORMEN die een module wegschrijft, na aftrek van de envelop;
`scripts/semantiek.js` vergelijkt de LEDEN van benoemde catalogi. Andere invoer,
andere methode, andere drempels — en ze komen op hetzelfde viertal uit.

> **Dat is het sterkste bewijs dat er in deze codebase te krijgen is voor een
> gedeeld type.** Niet omdat een van beide metingen overtuigend is, maar omdat
> twee onafhankelijke metingen elkaar niet hoorden te bevestigen en het toch doen.

Wie het eerste gedeelde objecttype van de Developer Cloud gaat bouwen, begint
hier — en niet bij een type dat iemand heeft bedacht.

### Het handwerk aan die vier domeinen, en wat het opleverde

De meting wijst aan; een mens beslist. Dat handwerk is gedaan, en het antwoord is
scherper dan "één type of niet":

| | uitvoering | oordeel |
|---|---|---|
| `hash`, `kies`, `palet` | **één**, vier keer gekopieerd | echte dubbeling — ✅ *samengevoegd in `kern/ontwerpbank.js`* |
| de opdrachtvorm `{ vakgebied, naam, brief }` | gedeeld, met `ontwerpen[]` en `collecties[]` | gedeeld type |
| `maakConcept` | **vier verschillende** | het domeinwerk zelf — moet blijven |
| `STATUS` | drie varianten | alle vier van `schets` naar `archief`, maar het midden is vakvocabulaire |
| `PALET` | vier eigen paletten | van de 16 kleuren delen er **2** over alle vier |

Drie van de vier noemden hun vakgebied `DISCIPLINES`, atelier `CATEGORIEEN` —
dezelfde rol, een andere naam. Dat is een botsing in het klein, binnen wat verder
één familie is.

**Opgelost (27 augustus 2026), en de meter bewoog mee.** Atelier noemt het nu ook
`DISCIPLINES`, en dat haalt het uit een botsing en zet het in een familie:
`CATEGORIEEN` droeg negen betekenissen en draagt er nu **acht**, terwijl
`DISCIPLINES` er één draagt op vier plekken. Precies het onderscheid uit de tabel
hierboven: hernoemen bij een botsing, samenvoegen bij een dubbeling.

Wat NIET is meegegaan is een keuze: het veld op een ontwerp heet nog steeds
`categorie` en het antwoord van de server `categorieLabel` en `categorieen`.
Daar hangt een scherm aan en er ligt data mee opgeslagen. Een naam in de code is
gratis te veranderen; een naam op de draad is dat niet.

**En het handwerk vond een gebrek in de meter zelf.** `PALET` werd als één
betekenis over vier plekken gemeld, door enkelvoudige koppeling: studio en
hardwarelab overlappen 0,60 en trekken architect en atelier het cluster in,
terwijl die onderling maar **0,14** delen. Een architect werkt met travertijn en
zichtbeton, een atelier met inkt-navy en kameel; die samenvoegen zou weghalen wat
ze onderscheidt — de `Asset`-fout in het klein.

Dat staat nu in de kop van `scripts/semantiek.js`: een cluster is een aanwijzing
dat er iets te bekijken valt, nooit een bewijs dat het één ding is.

**De samenvoeging is gedaan** (`server/kern/ontwerpbank.js`, 27 augustus 2026):
`hash`, `kies` en `palet` waren byte voor byte gelijk in vier bestanden en wonen
nu op één plek. Het gedrag is nagerekend en niet aangenomen — de vier oude
bestanden uit `HEAD` naast de vier nieuwe, 500 opdrachten per domein, 34.000
vergelijkingen, nul verschillen. `paletUit()` krijgt het palet MEE in plaats van
het te kennen, zodat de vier paletten uit de tabel hierboven gescheiden blijven.

**En de meter bewoog niet mee, wat hij ook niet hoort te doen.** Bij `passen.js`
ging `dubbelingenZonderNaam` van 111 naar 101; hier bleef hij op 101 staan. Dat
is geen falen maar de reikwijdte: `scripts/semantiek.js` leest *catalogi* —
gesloten woordenlijsten — en `hash` is een functie. Wie verwacht dat elke
opgeruimde dubbeling een meter laat zakken, verwacht dat één meter alles ziet.
Deze dubbeling kwam van `OBJECTMODEL.json`, langs gedeelde vormen, en dat is
precies waarom er twee metingen zijn.

**Hij staat inmiddels op 106, en dat is geen terugval.** De meter telt de hele
boom, en de kostprijslaag zette er negen kostensoorten, negen tarieven en een
beleidkaart bij — nieuwe catalogi paren met bestaande. Een meter die alleen mag
zakken meet niet de code maar de vlijt: wie hem stil wil houden, hoort geen
lijsten meer te schrijven. Wat hier telt is dat elke beweging een aanwijsbare
oorzaak heeft, omhoog zo goed als omlaag.

### Wat de meting al heeft opgeleverd: de paswaarheid stond op vier plekken

Bij het nalopen van de dubbelingen kwam er een boven die het document niet
alleen hoort te noemen maar ook op te lossen, want hij raakt een merkregel:
**welke passen bestaan er.**

```
kern/ledenbalie.js      const PASSEN           = ['gratis','rtg','lifestyle','business']
kern/ledenregister.js   const PAS_VOLGORDE     = ['gratis','rtg','lifestyle','business']
kern/ledenregister.js   PAS_NAAM               de weergavenamen
kern/assets.js          const BETALENDE_PASSEN = ['rtg','lifestyle','business']
```

De eerste twee droegen bovendien een **identieke** afgeleide functie (`pasVan`,
die een tier op een pas afbeeldt) — twee kopieën van de regel die bepaalt welke
pas een lid tóónt.

Dit is nu één module: `server/kern/passen.js`, met `BETALEND` **afgeleid** in
plaats van overgetypt, zodat wie een pas toevoegt dat op één plek doet. Zelfde
patroon en zelfde reden als `kern/pasprijs.js`, dat een paar maanden eerder om
exact dezelfde reden ontstond.

**Drie mutaties, alle drie raak**: `pasVan` een gast als `rtg` laten tonen
(2 toetsen), een gast laten kopen (3 toetsen), en `business` uit de lijst halen
(3 toetsen). Een vierde mutatie bleek **inert** — `'gratis'` aan de betalende
passen toevoegen verandert niets, want een gratis lid heeft tier `guest` en niet
`gratis`. Dat is opgeschreven omdat het bijna als een dekkingsgat werd gerapporteerd
terwijl het een fout in de mutatie was.

En de reparatie is te zien in de meter zelf: de naamloze dubbelingen zakten van
**111 naar 101**, want die ene lijst paarde met tien andere.

### Wat dit NIET zegt

**Een botsing is niet vanzelf fout.** `ACTIES` in twee spellen die allebei hun
eigen zetten opsommen, is precies goed. Wat de meting aanwijst is dat het woord
geen betekenis draagt buiten zijn eigen module — en dat wordt pas gevaarlijk
zodra iemand er een gedeelde laag op bouwt. Dat is exact het scenario van
`OS.md`: één capability-grammatica over alles heen.

> **De 77 zijn dus geen foutenlijst maar een prijskaart.** Ze zeggen wat het kost
> om die grammatica te bouwen, en waar hij het eerst zal schuren.

---

## 4. Waar de opzet en het huis botsen

### 4.1 De scorecard met `READY` erboven — dit huis heeft dat al afgewezen

De opzet eindigt met een scorecard van twintig regels en daarboven, "simpel":

```
READY
```

Dat is het enige voorstel uit alle drie de opzetten waar dit huis een
uitgeschreven besluit tegenover heeft staan — en dat besluit is niet alleen
opgeschreven maar ook afgedwongen.

`LAT.md` regel 11 — **bewijsgroen is geen go-live-groen**:

> Je kunt honderd procent bewijsdekking hebben en nog steeds niet mogen
> lanceren. (…) `npm run golive` staat dan nog steeds op rood om acht dingen die
> geen van allen in de code zitten — en dat is precies goed.

Die scheiding is bovendien machinaal afgedwongen: `scripts/check.js` regel 48
eist dat de go-live-keuring géén bewijsregister leest en dat de
bewijsinstrumenten géén go-live-oordeel vellen.

Daar hangt het hele bezwaar aan één vraag: **wat betekent `READY`?** Betekent het
"het bewijs is compleet", dan mag het — dan is het een samenvatting van de regels
eronder. Betekent het "dit mag de deur uit", dan velt een bewijsinstrument een
go-live-oordeel, en dat is precies wat regel 48 machinaal tegenhoudt. De
scorecard uit de opzet leest als het tweede: er staat `Release Provenance
VERIFIED` onder, en het woord staat boven een release.

**Een woord dat op twee manieren te lezen is, is bovenaan een bewijsstuk het
gevaarlijkst** — want de lezer kiest de ruime lezing en de bouwer bedoelde de
enge.

En `scripts/zekerheid.js` bestaat om precies de andere helft te vangen. Uit zijn
eigen kop: dit huis meet veel, elk getal is eerlijk, en *"bij elkaar geven ze een
gevoel dat gevaarlijker is dan elk getal apart"*.

**De aanbeveling is dus niet "geen scorecard" maar: de scorecard bestaat al, en
zijn bovenste regel hoort te zeggen wat er NIET is gemeten in plaats van
`READY`.** Wat de opzet toevoegt en wat wél ontbreekt is de doorklikbaarheid —
van elk vinkje naar het bewijs eronder. Dat is echt werk en het is de moeite
waard.

### 4.2 Het semantisch register wordt zelf de 78ste botsing

Een Semantic Registry is een catalogus van begrippen. De meting hierboven zegt
dat catalogi in dit huis uit elkaar lopen zodra niemand ze handhaaft — dat is de
hele bevinding.

Een register dat naast de code leeft, is dus binnen een jaar zelf een woord met
twee betekenissen: wat het register zegt, en wat de code doet.

De uitweg staat al in dit huis en heet `WETTEN.json`: elke wet draagt een **bron
in de code** en een **handhaver**, en `scripts/sabotage.js` overtreedt hem echt
om te zien of er iets rood wordt. Een semantisch register hoort zo te worden
gebouwd — **afgeleid uit de code, niet ernaast geschreven** — of het hoort er
niet te komen.

### 4.3 Future-scale certification veroudert het snelst van alles

"`Identity.Resolve` is gecertificeerd tot workload class G4" is een aantrekkelijke
zin en hij is precies het soort bewering waar `BESTUUR.md` een regel voor heeft:
elke bewering draagt een **bewijsgraad met een datum**, en **vervallen bewijs is
geen bewijs**.

Een schaalcertificaat veroudert sneller dan welke andere meting ook, want het
hangt aan de machine, de dataset én de code. Zonder houdbaarheidsdatum wordt het
binnen twee kwartalen een marketingclaim — precies wat de opzet zelf zegt te
willen vermijden.

Dus: ja, maar met een datum en een vervaltermijn, zoals `proefHoudbaarUren` dat
al doet in `kern/command/vermogens.js`.

### 4.4 Eén entropiegetal verbergt welke meter bewoog

`Architecture Entropy 2.7 / 10` is aantrekkelijk en het is een aggregaat. Dit
huis heeft al 31 geratelde meters die elk hun eigen ding zeggen, en `LAT.md`
regel 10 gaat er precies over dat een getal als een feit oogt.

Een samengesteld getal maakt de beweging **onzichtbaar**: van 2,7 naar 3,4 zegt
niet of er een begrip bij kwam, een afhankelijkheid dieper werd of een
uitzonderingsregel is toegevoegd — en dat zijn drie verschillende reparaties.

De veilige vorm: de entropie-onderdelen als **losse geratelde meters** in
`NORM.json` (zoals `kernGedeeld` er al staat), en een samenvatting die de
onderdelen NOEMT in plaats van ze op te tellen.

### 4.5 Organisatiegroei simuleren modelleert iets dat niet bestaat

"Simuleer 1 → 100 → 50.000 engineers" is een goed idee voor een bedrijf met
teams. Dit huis heeft er nul, en een simulatie van teamkoppeling zonder teams is
een model van een aanname.

Wat wél kan en al kan: `scripts/grenzen.js` meet de **echte** koppeling — 946
kern-eigenschappen, waarvan 85% door precies één domein wordt gebruikt en 26
door vijf of meer. Dat lijstje van 26 *is* het antwoord op "welke capability
wordt een bottleneck", en het is gemeten in plaats van gesimuleerd.

### 4.6 De AI die architectuur beoordeelt

"Deze nieuwe `HotelGuestCredits` lijkt voor 94% op `Money.CreditGrant`" is
precies de goede vraag, en dit huis heeft hem al één keer machinaal beantwoord:
`scripts/objectmodel.js` vond `kern/command` en `kern/zaakcommand` met gelijkenis
1,00 — zonder ernaar te zoeken.

Waar het botst is het woord *autonomous*. `CLAUDE.md`: de AI belooft of verleent
niets. Een architectuurpoort die een PR **weigert** op een AI-oordeel is een
bevoegdheid die de AI hier niet heeft. Een architectuurpoort die een PR
**markeert** met de meting erbij, is precies wat `scripts/check.js` al doet — en
die weigert op een *getal*, niet op een oordeel.

Het onderscheid dat de opzet zelf maakt is bruikbaar: *premature abstraction*
tegenhouden is te meten (één consument, geen tweede semantische toepassing), en
dat is een regel. "Lijkt op" is een oordeel, en dat is een melding.

---

## 5. Wat ontbreekt, en wat het kost

### 5.1 Release-provenance — nagekeken, en het is er niet

De opzet vraagt een `RTG Release Passport`: welke code → welke build → welke
toetsen → welke goedkeuring → dit artefact.

Nagemeten over de hele boom: **geen SLSA, geen SBOM, geen in-toto, geen sigstore,
geen build-attestatie.** (Wat de zoektocht wél oplevert is WebAuthn-attestatie,
en dat is iets anders: dat gaat over een sleutel van een lid.)

Dit is een echt gat en het is ook een eigen project — een supply-chain-laag, geen
Magnaat-functie. Het hoort een eigen document met een eigen bewijslast te
krijgen, zoals `GELD.md` en `TENANT.md` die hebben.

Wat de stap goedkoper maakt dan hij lijkt: de bestanddelen bestaan al los
(`MUTATIES.json`, `BEWIJS.md`, `CONTROLS.json`, `SABOTAGE.json`, `NORM.json`).
Wat ontbreekt is dat ze aan een **artefact** hangen in plaats van aan een
werkkopie.

### 5.2 De gegenereerde tegenvoorbeeldzoektocht

`scripts/sabotage.js` overtreedt elke wet **één keer, met opzet**. Dat is sterk
en het is niet hetzelfde als zoeken: de opzet wil dat de machine zelf duizenden
volgordes probeert om een invariant te breken.

Het verschil is precies benoemd in `MAGNAATLAB.md` par. 1: de mutatiemotor
muteert de **code** en vraagt "kan deze toets zakken"; property-based zoeken
muteert de **invoer** en vraagt "bestaat er een volgorde die deze wet breekt".
Verwant gereedschap, andere vraag.

Dit is de goedkoopste grote stap in dit document, want de wetten staan al
uitgeschreven en de invarianten van het geld staan al in `scripts/magnaat-pomp.js`
("kan een speler waarde maken uit niets?"). Wat ontbreekt is de zoeker.

### 5.3 Tijd als variabele

"10 jaar in 30 minuten" raakt iets dat dit huis al bijhoudt maar nooit heeft
beproefd: de wisregels van de identiteitskluis en de locatiesporen
(`server/bewaarveger.js`). Of een account na jaren mutaties nog volledig te
verwijderen is, is vandaag een belofte en geen meting.

Dat is de sterkste variant van dit voorstel en hij vraagt geen simulatiewereld —
hij vraagt een klok die je vooruit kunt zetten, en die staat er al
(`server/lib/klok.js`, en `test/onderhoud.test.js` roept de onderhoudsveger al aan
met een eigen klok).

### 5.4 Wat jaren weg is

- **De System Graph (punt 2).** `OS.md` par. 2 mat dat er geen capabilitylaag
  is maar twintig woordenlijsten. Een graaf over iets dat nog geen begrippen
  deelt, is een tekening.
- **De World Compiler.** Een wereldbeschrijving naar een uitvoerbare
  samenleving compileren, is een product op zich. `MAGNAATLAB.md` par. 2 zegt
  bovendien dat er al twee synthetische werelden zijn; een derde erbij zonder
  die vraag te beantwoorden is de fout die `PLATFORM.md` beschrijft.
- **Agent Passports.** Ze leunen op één actormodel voor mens, app en agent, en
  `OS.md` par. 4.4 stelde vast dat er vandaag drie zijn.

---

## 5a. De vier administraties — de checklist bij een nieuwe meter

Dit is het kleinste stuk van dit document en het voorkomt waarschijnlijk de
meeste verspilde CI-rondes. Het is **geen nieuwe architectuur**: alle vier de
administraties bestaan al, alle vier worden ze al afgedwongen, en alle vier
bestaan ze om een fout die hier echt is gemaakt. Wat ontbrak is dat ze van
elkaar wisten.

**De aanleiding (13 september 2026).** Eén nieuwe meter (`scripts/stagevorm.js`
+ `STAGEVORM.json`) en één nieuwe toets (`test/stagevorm.test.js`) moesten in
vier onafhankelijke administraties worden opgenomen voordat het huis tevreden
was. Elke administratie meldde zich pas nadat de vorige was opgelost, elk in een
eigen CI-ronde, en geen van de vier noemde de andere drie. Vier rondes voor één
meter.

**De checklist, in de volgorde waarin ze zich melden:**

| # | administratie | waar | wat hij tegenhoudt | wie hem afdwingt |
|---|---|---|---|---|
| 1 | **ratel** | `scripts/lib/metingen.js` (welke meting aan welke tand) + `METERS` in `scripts/norm.js` + de grondwaarde in `NORM.json` | een register dat aan niets hangt en dus stilletjes de verkeerde kant op kan groeien | normmeter `metingenZonderRatel`, richting omlaag |
| 2 | **ijking** | `test/meterijk.test.js` | een meter die niet aantoonbaar uitslaat op een bekend-foute invoer — groen omdat hij niets *kan* vinden | `scripts/check.js` regel 35 |
| 3 | **mutatie** | `node scripts/mutatie.js <toets>` → `MUTATIES.json` | een toets waarvan niemand heeft gezien dat hij kan zakken (`LAT.md` regel 2) | normmeter `toetsenNietGemeten`, richting omlaag |
| 4 | **versheid** | `REGISTERS` in `scripts/versheid.js`, of `BUITEN` mét de reden | een register dat veroudert zonder dat iemand het merkt | `test/versheidsdekking.test.js` |

Wie een meter toevoegt, loopt die vier af. Wie er een overslaat, ontdekt hem één
CI-ronde later — en dat is precies wat deze tabel bespaart.

### De vijfde, en die heeft geen huisbrede handhaver

Eén ronde later dan de vier hierboven meldde zich een vijfde, en hij past niet in
de tabel omdat er geen enkele meter over gaat. Vier registers lieten CI zakken op
een toets die **in het register zelf woont**: `CAPABILITEIT.json`,
`MAGNAATLAB.json`, `MUTATIESEMANTIEK.json` en `SEMANTIEK.json` dragen elk een
eigen toets die "loopt achter op de code" meldt zodra hun getal niet meer klopt
met een verse meting. Dat is precies goed — maar `scripts/check.js` kent ze niet,
`scripts/versheid.js` kent ze niet, en `metingenZonderRatel` telt ze niet, want ze
hángen aan een ratel. Ze liften mee op de OMVANG van de kern, dus elke tak die
code toevoegt laat ze zakken, en je vindt ze alleen door de scherf lokaal te
reproduceren of door `grep "loopt achter op" test/*.test.js` te draaien.

De vorm van die vijfde is dus: *een register dat door niemand wordt bewaakt
behalve door zijn eigen toets, en dat meebeweegt met iets waar het niet over
gaat.* Dat is hier alleen OPGEMERKT en niet opgelost; de vraag die eronder ligt
(welke registers lopen mee op de kernomvang, en hoort die groei bij hun
onderwerp?) hoort bij par. 6 en niet bij deze checklist.

### De regel eronder, en die is breder dan meters

De vierde administratie lijkt de saaiste en is de gevaarlijkste. `STAGEVORM.json`
maakte dat zichtbaar, want zijn uitslag is een **nul**: 0 van 136 velden gedeeld
over tien publieke domeinen. Op die nul rust in `STAGE.md` par. 0 het besluit dat
een Moment een projectie is en geen object.

> **Een nulmeting waarop een besluit rust, mag niet stil verouderen.**
> Afwezigheid van bevindingen is alleen bewijs als de meting aantoonbaar vers is.

Dat is scherper dan het klinkt, en het geldt overal in dit huis waar een meter
niets vindt. Een POSITIEVE uitslag die oud is, valt vaak vanzelf op: het getal
past niet meer bij wat iemand net heeft gebouwd. Een oude NUL blijft er precies
zo uitzien als een verse nul — geruststellend, en misschien onwaar. De faalvorm
is niet dat het getal verkeerd is, maar dat het van een andere vraag is: van
*"deze domeinen delen niets"* naar *"we hebben minder gekeken"*, zonder dat er
één teken op het scherm verandert.

Vandaar dat de ijking van zo'n meter **omlaag** gaat en niet omhoog (zie
`stageDomeinenGemeten` en `carriereDomeinenGemeten` in `test/meterijk.test.js`):
wat geratelde wordt is het BEREIK van de meting en niet haar uitkomst. De
uitkomst mag bewegen — dat is nieuws. Het aantal domeinen dat de meter ziet, mag
dat niet, want dan verandert de betekenis van de nul zonder dat de nul beweegt.

Dit is dezelfde familie als de zelfijking uit par. 3: *een scan die niets KAN
vinden staat groen om precies dezelfde reden als een scan die niets vindt, en
die twee zijn van buiten niet te onderscheiden.* Par. 5a voegt daar de tijd aan
toe: een scan die ooit iets kon vinden en nu over een andere boom gaat, óók.

---

## 6. De volgorde

| fase | wat | waarom nu |
|---|---|---|
| ~~**0. De semantiek meten**~~ ✅ | `scripts/semantiek.js` + `SEMANTIEK.json`; de uitkomst staat in par. 3 | zonder dit is een Semantic Registry een la of infrastructuur, en niemand die weet welke |
| ~~**1. De eerste dubbeling**~~ ✅ | de paswaarheid stond op vier plekken; nu één module (`kern/passen.js`), met `BETALEND` afgeleid. Drie mutaties raak | par. 3 — en de meter bewoog mee: 111 → 101 naamloze dubbelingen |
| **2. De rest van de 29 + 106** | per stuk de vraag stellen die `PLATFORM.md` bij Cercle en Entourage stelde: aan de CODE en niet aan de naam | een deel is terecht (weekdagen, maanden), een deel is overgetypt |
| ~~**3. De vier ontwerpdomeinen wegen**~~ ✅ | met de hand nagelopen: `hash`, `kies` en `palet` zijn één uitvoering in vier kopieën; `maakConcept`, `PALET` en `STATUS` zijn terecht verschillend | par. 3 — en het legde een ketenings­gebrek in de meter zelf bloot |
| **4. Het register uit de code afleiden** | niet ernaast schrijven; het patroon van `WETTEN.json` (bron + handhaver + sabotage) | par. 4.2 — anders wordt het register zelf de 78ste botsing |
| **5. De zoeker** | invoervolgordes genereren tegen de wetten die er al staan | par. 5.2 — de wetten staan, de zoeker niet |
| **6. Tijd vooruit** | kan een account na jaren mutaties nog volledig weg | par. 5.3 — een belofte die nooit is beproefd |
| **7. De scorecard doorklikbaar** | van elk vinkje naar het bewijs eronder, met `zekerheid.js` als bovenste regel | par. 4.1 — en zonder `READY` |
| **8. Release-provenance** | eigen document, eigen bewijslast | par. 5.1 |

Fase 1 t/m 4 zijn de kern: eerst opruimen wat aantoonbaar dubbel is, dan pas een
register — anders legt het register de rommel vast. Fase 1 staat en heeft meteen
laten zien dat het werkt: één samenvoeging haalde tien dubbelingen weg.

---

## 6a. Een proef kan een geldige uitslag geven en toch het verkeerde experiment zijn

> **Een bewijs draagt niet alleen zijn uitslag, maar ook zijn INDELING en zijn
> foutmodel -- en die twee zijn zelf aantoonbaar of ze zijn niet waar.**

Dit is geen nieuwe wet maar een klasse die dit huis in één week vijf keer heeft
gezien, elke keer in een andere gedaante en elke keer met een keurige groene
uitslag eroverheen. De uitslag was niet vals; het experiment was het.

| Waar | Wat er gemeten werd | Wat er gemeten had moeten worden |
|---|---|---|
| `scripts/mutatie.js` | `isServerToets()` herkende alleen `require('./helper')` en niet `require('./helper.js')` -- drie toetsen zaten daardoor stil in de verkeerde bewijsklasse en kregen een bronmutatie in plaats van de liegpoort | de vorm, niet één spelling ervan |
| `test/mutatiewacht.test.js` | de eerste wacht daarop matchte op zijn EIGEN commentaar en bleef groen met de bewaakte code weg | de code, met het commentaar eraf |
| `scripts/aicontext.js` | de ledenstaat heet ook `st`, en dat woord betekent huisbreed ook status, stand en state: 91 velden in plaats van 25 | een naam is alleen die ledenstaat in het bestand waar hij eraan gebonden is |
| `test/mn02ai-contextbesmetting.test.js` | een marker (`bewaarVerzoek.door`) die woordelijk in de vaste tekst van Rahuls karakter staat, wees een lek aan dat er niet was | alleen ONDERSCHEIDENDE markers: wat er vóór de handeling al stond, is er niet door gekomen |
| `scripts/stilspoor.js` | elke bevinding droeg een regelnummer uit de bron NÁ `zonderCommentaar()`, en die plet een blokcommentaar tot één spatie -- elk regelnummer erna schoof op, dus 42 bevindingen wezen naar regels die iets anders bevatten | `zonderCommentaar(bron, { regelsHeel: true })`, de derde stand die `scripts/lib/bron.js` in zijn eigen kop al noemt |

**De vijfde is de leerzaamste, want hij is gemaakt IN de handhaver van een regel
over stille fouten** -- LAT.md regel 13, op de dag dat hij werd geschreven. De
uitslag was op geen enkel punt verdacht: dezelfde tellingen (18 en 24), dezelfde
bestandsnamen, een plausibel regelnummer erachter. Alleen wees dat nummer naar de
verkeerde regel, en dat is precies zo onzichtbaar als de smoringen waar de meter
over gaat. Wat hem ving was niet een toets maar het NALOPEN: elke gemelde plek
met `sed` opgevraagd en gekeken of er een `catch` staat. **Een meter die een
PLAATS noemt, hoort op die plaats te worden nagekeken voordat zijn getal ergens
wordt geciteerd** -- het getal en de plaats zijn twee beweringen, en de eerste
kan waar zijn terwijl de tweede onzin is.

Vijf gedaanten, één vorm: **de proef draaide, gaf een geldige uitslag, en mat
iets anders dan waar hij over ging.** Daar helpt LAT.md regel 2 niet tegen -- die
eist dat je een toets hebt zien zakken, en deze toetsen zakten keurig, alleen op
de verkeerde vraag.

**Wat een proef daarom hoort te dragen, en waar het vandaag staat:**

| Eigenschap | Wat het betekent | Waar het wordt afgedwongen |
|---|---|---|
| **indeling** | in welke bewijsklasse valt deze proef, en is die indeling zelf beproefd | `test/mutatiewacht.test.js` (voor `isServerToets`) |
| **foutmodel** | welke storing wordt er ingespoten, en raakt die de bron waar het over gaat | `server/lib/verraad.js` + `scripts/faalproef.js` |
| **geraakte bron** | welk bestand of welke opslag verandert er werkelijk door die storing | `FAALPROEF.json`, per route |
| **verwachte waarneming** | wat zou er anders zijn als de bewering onwaar was | vandaag: **de toets zelf, en verder niemand** |
| **levendheid** | kan dit instrument überhaupt uitslaan | vandaag: **twee plekken, met de hand** |

De laatste twee rijen zijn de open kant. De levendheidscontrole is het goedkoopst
en het meest verwaarloosd: `test/mn02ai-contextbesmetting.test.js` toets 5 en 6,
en `scripts/herstelproef.js` met zijn opwarmronde, zijn vandaag de enige plekken
waar een instrument moet bewijzen dat het kán uitslaan. Toets 6 bestaat omdat de
proef zonder hem volledig groen bleef onder een cache-mutatie -- de gelijkheid
die hij bewaakt heeft een blinde vlek die er precies uitziet als succes.

### 6a.1 Code en commentaar zijn twee dingen, en een meter die dat niet scheidt meet zijn eigen toelichting

Dit is de goedkoopste helft van par. 6a en hij is machinaal te sluiten.
`scripts/lib/bron.js` draagt `zonderCommentaar()` al, in drie standen (weghalen,
platslaan met behoud van regelnummers, en per taal).

**De eerste telling was de verkeerde noemer, en dat is zelf een voorbeeld van
par. 6a.** Er stond hier "195 scripts lezen broncode, 19 scheiden code van
commentaar", en dat leest als 176 fouten. Dat is het niet: het merendeel van die
scripts telt bestanden of paden en raakt een regel commentaar nooit. De klasse
die ertoe doet is smaller, en `npm run meterklasse` (`METERKLASSE.json`) meet
haar apart:

| | |
|---|---|
| scripts die broncode lezen | **201** |
| daarvan: leiden SEMANTIEK af uit de VORM van die code | **73** |
| daarvan: scheiden code en commentaar | **13** |
| daarvan: doen dat niet | **60** |

Alleen die 73 hoeven door `zonderCommentaar()`, want juist een toelichting
beschrijft wat de code doet en bevat dus per definitie de woorden waar je op
zoekt. Dat is hier twee keer echt gebeurd: `test/mutatiewacht.test.js` bleef
groen met de bewaakte code weg omdat hij zijn eigen commentaar las, en de kop van
`server/kern/ai/prompt.js` bevat `...md` letterlijk als voorbeeld van wat NIET
mag -- een toets die zijn onderwerp met commentaar en al leest, zakt daar op de
uitleg van de regel die hij bewaakt.

### 6a.2 Een generator hoort zijn eigen klasse te kennen

Daar staat een tweede, even goedkope regel naast, en die is groter dan
proceshygiëne. `eisSchoneBoom()` in `scripts/lib/stempel.js` weigert een ronde
die toch `boomVuil: true` zou opleveren; `stempel()` MELDT het achteraf, als de
tijd al op is en de meter `registersUitVuileBoom` al omhoog is gerateld. Gemeten
door hetzelfde script:

| | |
|---|---|
| scripts die een artefact schrijven | **187** |
| daarvan: stempelen, en claimen dus repo-waarheid | **79** |
| daarvan: weigeren een vuile boom | **12** |
| daarvan: doen dat niet | **67** |
| grendelen zonder te stempelen | **0** |

**Die 67 zijn geen foutenlijst.** Uitvoer die bewust worktree-lokaal is, of een
tussenronde, hoort de grendel juist niet te hebben. Het punt is dat
`registersUitVuileBoom` daarmee ophoudt een incidentklasse te zijn en een
SYSTEMATISCH ONGEDEKT CONTRACT wordt: van de 79 artefacten die zich als
repo-waarheid gedragen, kan er bij 67 niemand zeggen of dat expliciet zo bedoeld
is. De laatste rij is het enige wat vandaag hard is -- er is er geen die grendelt
zonder te stempelen, dus de poort is een strikte deelverzameling van de claim en
niemand grendelt iets dat geen waarheid pretendeert.

**Wat er dus moet komen is geen regel voor alle 79 maar een VERKLARING per
generator**: dit artefact is repo-waarheid (en dan grendelt hij), of dit artefact
is worktree-lokaal (en dan zegt hij dat). Zolang die verklaring ontbreekt, is elk
getal over vuile bomen een meting van toeval. `scripts/aicontext.js` en
`scripts/meterklasse.js` zijn de eerste twee die de grendel meebrengen; de
verklaring per generator is een besluit dat nog openstaat.

**En daarom staat `METERKLASSE.json` bewust nog niet in de repo.** Een meetbestand
in de wortel hoort aan een ratel te hangen en die ratel hoort geijkt te zijn. Voor
de tweede vraag is de tand evident -- het aantal vormlezers zonder scheiding hoort
te dalen. Voor de eerste is hij dat niet: 67 kan alleen dalen door grendels toe te
voegen, en een deel van die 67 hoort er juist geen te hebben. Een ratel die daarop
duwt maakt het huis slechter en de meter groener, en dat is precies de faalvorm
waar dit hoofdstuk over gaat. Tot de verklaring per generator een besluit is, is
`npm run meterklasse` een commando dat je draait en geen getal dat meetelt.

## 7. Wat dit niet wordt

- **Geen enkel groen woord bovenaan.** `LAT.md` regel 11 en `check.js` regel 48
  houden bewijsgroen en go-live-groen uit elkaar, en dat blijft zo. Een
  bewijs-scorecard mag alles zeggen behalve of dit huis de deur open mag.
- **Geen register naast de code.** Zie par. 4.2. Afgeleid of niet.
- **Geen samengesteld entropiecijfer.** Losse geratelde meters, met namen.
  Zie par. 4.4.
- **Geen AI die een PR weigert.** Markeren met de meting erbij mag; weigeren
  gebeurt op een getal en niet op een oordeel. Zie par. 4.6.
- **Geen simulatie van een organisatie die niet bestaat.** Meten wat er is
  (`grenzen.js`) gaat vóór modelleren wat er ooit zou kunnen zijn.

De regel uit de kop is goed en hij hoort met één toevoeging te blijven staan,
want dit huis heeft die toevoeging duur geleerd:

> No change is trusted because it looks correct. A change earns trust by
> surviving evidence — **en bewijs dat niemand heeft zien zakken, is geen
> bewijs.**

Dat is `LAT.md` regel 2 en regel 10 in het Engels, en het is de reden dat elke
meting in dit document met een mutatie is nagetrokken voordat hij hier mocht
staan.
