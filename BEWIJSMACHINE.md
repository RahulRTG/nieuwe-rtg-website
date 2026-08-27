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
| **1** executable specifications (half) | 41 systeemwetten met per stuk een bron én een handhaver — en een motor die ze **echt overtreedt** in de bestanden om te zien of er iets rood wordt | `WETTEN.json`, `scripts/sabotage.js`, `SABOTAGE.json` |
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
2356 bestanden, 831 catalogi, 516 verschillende namen
  94 namen staan in meer dan een domein
  77 woorden dragen MEER DAN EEN betekenis   (samen 279 betekenissen)
  28 betekenissen wonen op MEER DAN EEN plek                    (LAT-regel 4)
 101 paren dragen dezelfde waarheid onder een ANDERE naam       (LAT-regel 4)
```

Van de 94 gedeelde namen dragen er **77 meer dan één betekenis**. Het was dus
geen incident.

De ergste, met het aantal betekenissen dat de meter na clustering overhoudt:

| woord | betekenissen | een greep uit wat het kan zijn |
|---|---|---|
| `SOORTEN` | **38** | contractsoorten, gebeurtenissen in een tijdlijn, avondplannen, rekeningsoorten |
| `STATUS` | 10 | ontwerpfases bij de architect, betaalstanden, ideeënstanden, subsidiestanden |
| `STANDEN` | 10 | voorkeursstanden, verzoekstanden, mediastanden, regiestanden |
| `NIVEAUS` | 9 | dreigingsniveaus, bijstandsniveaus, concern-scopes, geldbeleidsniveaus |
| `CATEGORIEEN` | 9 | app-categorieën, voertuigcategorieën, kledingcategorieën, risicocategorieën |
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
| **op naam** | dezelfde naam, dezelfde inhoud, twee domeinen | **28** |
| **op inhoud** | dezelfde inhoud onder een **andere** naam | **101** |

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
| `hash`, `kies`, `palet` | **één**, vier keer gekopieerd | echte dubbeling — samenvoegen |
| de opdrachtvorm `{ vakgebied, naam, brief }` | gedeeld, met `ontwerpen[]` en `collecties[]` | gedeeld type |
| `maakConcept` | **vier verschillende** | het domeinwerk zelf — moet blijven |
| `STATUS` | drie varianten | alle vier van `schets` naar `archief`, maar het midden is vakvocabulaire |
| `PALET` | vier eigen paletten | van de 16 kleuren delen er **2** over alle vier |

Drie van de vier noemen hun vakgebied `DISCIPLINES`, atelier `CATEGORIEEN` —
dezelfde rol, een andere naam. Dat is een botsing in het klein, binnen wat verder
één familie is.

**En het handwerk vond een gebrek in de meter zelf.** `PALET` werd als één
betekenis over vier plekken gemeld, door enkelvoudige koppeling: studio en
hardwarelab overlappen 0,60 en trekken architect en atelier het cluster in,
terwijl die onderling maar **0,14** delen. Een architect werkt met travertijn en
zichtbeton, een atelier met inkt-navy en kameel; die samenvoegen zou weghalen wat
ze onderscheidt — de `Asset`-fout in het klein.

Dat staat nu in de kop van `scripts/semantiek.js`: een cluster is een aanwijzing
dat er iets te bekijken valt, nooit een bewijs dat het één ding is.

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

**Bijgewerkt 27 augustus 2026 — de eerste helft staat, en heeft een eigen
document: `SBOM.md`.** Wat er sindsdien is: een materiaallijst (`npm run sbom` →
`SBOM.json`) met de basis-images, de crates en een reproduceerbare afdruk over de
eigen code; een **bouwstempel** dat `GET /api/health` laat zeggen wélke build er
draait (commit + bronafdruk, en `vastgelegd: false` mét de reden als het geen
release-image is); en een releasepijplijn die met `--provenance=mode=max
--sbom=true` bouwt, zodat BuildKit een SLSA-provenance-attestatie naast het image
publiceert. `test/sbom.test.js` handhaaft de eigenschappen die waar moeten
blijven — negen toetsen, drie mutaties raak.

Eén meting daaruit is het opschrijven waard, want ze maakt de opzet hierboven
scherper: **er zit nul npm in de release.** De derdenlaag van dit huis zijn niet
de pakketten maar de basis-images. Een SBOM die alleen npm telt, zou hier een
verkeerd beeld geven.

Wat er in par. 5.1 nog steeds NIET staat, en dat is met opzet geen voetnoot: geen
**handtekening** (de provenance komt van onze eigen builder, dus een
buitenstaander moet ons nog steeds vertrouwen), geen **digest-pinning** van de
basis-images, geen kwetsbaarheidsscan, en geen **verificatie bij het uitrollen**
— de gegevens zijn er nu wel, de controle nog niet. Zie de slotparagraaf van
`SBOM.md`.

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

## 6. De volgorde

| fase | wat | waarom nu |
|---|---|---|
| ~~**0. De semantiek meten**~~ ✅ | `scripts/semantiek.js` + `SEMANTIEK.json`; de uitkomst staat in par. 3 | zonder dit is een Semantic Registry een la of infrastructuur, en niemand die weet welke |
| ~~**1. De eerste dubbeling**~~ ✅ | de paswaarheid stond op vier plekken; nu één module (`kern/passen.js`), met `BETALEND` afgeleid. Drie mutaties raak | par. 3 — en de meter bewoog mee: 111 → 101 naamloze dubbelingen |
| **2. De rest van de 28 + 101** | per stuk de vraag stellen die `PLATFORM.md` bij Cercle en Entourage stelde: aan de CODE en niet aan de naam | een deel is terecht (weekdagen, maanden), een deel is overgetypt |
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
