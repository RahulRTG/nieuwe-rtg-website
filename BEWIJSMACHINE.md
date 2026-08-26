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
2355 bestanden, 833 catalogi, 518 verschillende namen
  94 namen staan in meer dan een domein
  77 woorden dragen MEER DAN EEN betekenis   (samen 279 betekenissen)
  19 namen dragen juist EEN betekenis op twee plekken   (LAT-regel 4)
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
  en het is `LAT.md` regel 4. Er zijn er **19**, waaronder `ERNST` (`hoog /
  midden / laag`) die identiek in `kern/command/alarm.js` en
  `kern/payroll/controles.js` staat.

Een meter die die twee optelt, levert een getal waar niemand iets mee kan: de
ene helft moet uit elkaar, de andere naar elkaar toe.

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

## 6. De volgorde

| fase | wat | waarom nu |
|---|---|---|
| ~~**0. De semantiek meten**~~ ✅ | `scripts/semantiek.js` + `SEMANTIEK.json`; de uitkomst staat in par. 3 | zonder dit is een Semantic Registry een la of infrastructuur, en niemand die weet welke |
| **1. De 19 dubbelingen** | één betekenis op twee plekken — `LAT.md` regel 4, en het is de helft die naar elkaar toe moet | klein, af te vinken, en het verkleint de 77 |
| **2. Het register uit de code afleiden** | niet ernaast schrijven; het patroon van `WETTEN.json` (bron + handhaver + sabotage) | par. 4.2 — anders wordt het register zelf de 78ste botsing |
| **3. De zoeker** | invoervolgordes genereren tegen de wetten die er al staan | par. 5.2 — de wetten staan, de zoeker niet |
| **4. Tijd vooruit** | kan een account na jaren mutaties nog volledig weg | par. 5.3 — een belofte die nooit is beproefd |
| **5. De scorecard doorklikbaar** | van elk vinkje naar het bewijs eronder, met `zekerheid.js` als bovenste regel | par. 4.1 — en zonder `READY` |
| **6. Release-provenance** | eigen document, eigen bewijslast | par. 5.1 |

Fase 1 en 2 samen zijn de kern: eerst opruimen wat aantoonbaar dubbel is, dan
pas een register — anders legt het register de rommel vast.

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
