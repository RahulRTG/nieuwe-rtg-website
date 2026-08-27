# Magnaat Lab

> **Nothing critical reaches RTG production without first surviving RTG itself.**

Dit bestand hoort bij `GAMEHALL.md` zoals `OS.md` bij `PLATFORM.md` hoort.
`GAMEHALL.md` beschrijft Magnaat als **product** — een spel met een economie, een
kaart en spelers. Dit beschrijft de rol die de opzet er bovenop wil zetten:
Magnaat als de permanente simulatieomgeving waarin RTG-capabilities bewijzen dat
ze werken voordat ze productie halen.

Het is een richtingsdocument, geen toezegging. Net als `OS.md` en
`DEVELOPERCLOUD.md` staat alles hieronder in vier bakken — **staat**, **een stap
weg**, **een besluit nodig**, **jaren weg**.

En net als daar begint het met een meting, want de opzet doet één bewering
waarop de hele constructie rust, en die is toetsbaar.

---

## 0. De opzet in één zin, en wat eraan getoetst is

De opzet stelt 50 punten voor. De belangrijkste is punt 4, want zonder dat punt
bewijst geen van de andere 49 iets:

> **Magnaat mag geen eigen kopieën krijgen van RTG-functionaliteit.** Dus
> absoluut niet `MagnaatPaymentEngine` naast RTG Payment Engine. Dat vernietigt
> de waarde van de testhal.

Dat is geen mening maar een meetbare uitspraak, en hij heeft twee helften: raakt
de simulatielaag RTG werkelijk aan, en heeft zij ondertussen haar eigen
uitvoering van dezelfde onderwerpen? `scripts/magnaatlab.js` meet ze allebei,
`MAGNAATLAB.json` legt het vast, `test/magnaatlab.test.js` bewaakt dat de meter
meet wat hij zegt te meten — inclusief de tegenproef, want de uitkomst hieronder
is een nul en een meter die altijd nul zegt is hier de gevaarlijkste die er is.

---

## 1. Wat er van de opzet vandaag al staat, gemeten

Dit is de verrassing van dit document, en hij gaat de andere kant op dan bij
`OS.md`. Daar stond een derde van de opzet. Hier staat **het grootste deel van
het gereedschap al** — het staat alleen ergens anders dan de opzet denkt.

| uit de opzet | wat er staat | waar |
|---|---|---|
| **18** chaos engine | het failover-trio wordt echt omgegooid en moet zichzelf herstellen | `scripts/chaos.js`, `scripts/hersteltijd.js` |
| **20** security attack simulation | een batterij aanvallen tegen een DRAAIENDE server | `scripts/aanval.js`, `test/hack.test.js` |
| **21** tenant isolation arena | kruis-tenant en verkeerde-rol proeven, met IDOR-pogingen als bewering | `test/scheiding.test.js`, `test/rollenmatrix.test.js`, `scripts/lib/rolproef.js` |
| **23** purpose violation testing | een machtiging zonder doel komt de poort niet door; verleende doelen worden bevroren | `test/appstore-doel.test.js`, `kern/appstore/machtigingen.js` |
| **30** counterexample generation | **niet dit** — de mutatiemotor muteert de CODE en vraagt "kan deze toets zakken", niet "bestaat er een volgorde die deze invariant breekt". Verwant gereedschap, andere vraag; punt 30 zelf staat er niet | `scripts/mutatie.js`, `MUTATIES.json` |
| **31** business invariants (in het spel) | **"kan een speler waarde maken uit niets?"** — zes harde pomproutes | `scripts/magnaat-pomp.js` |
| **6** behaviour engine (in het spel) | synthetische segmenten met gedrag naar dag, weer, seizoen, prijs, reputatie | `GAMEHALL.md` §12.2, `kern/spellen/magnaat/vraag.js` |
| **7** scenario engine (in het spel) | honderden partijen uitspelen en kijken of één strategie altijd wint | `scripts/magnaat-strateeg.js` |
| **5/8** synthetic world + seed | een tweede wereld, met `seed`, fases en counterfactuals | `kern/hospitality-universe/` |
| **15** performance budgets | servicedoelen met venster, streefwaarde en dekking; een prestatielat met een ratel | `SLO.json`, `BEPROEVING.json`, `scripts/norm.js` |
| **34** shadow execution | de motor draait naast de bestaande en de uitkomsten worden vergeleken | `scripts/motor-pariteit.js`, `kern/pay/schaduw.js` |
| **35/36** progressive deployment + rollback | een functie gaat open voor tien procent en draait automatisch dicht bij een golf serverfouten | `kern/command/canary.js`, `server/functies/wachter.js` |
| **37/38** evidence ledger | claim → control → test → bewijs, per bewering een bron, en een weigering als het bewijs ontbreekt | `BEWIJS.md`, `CONTROLS.json`, `scripts/bewijsmatrix.js` |
| **44** duplication detection | twee modules met gelijkenis 1,00 zijn gevonden en benoemd (`kern/command` en `kern/zaakcommand`) | `scripts/objectmodel.js`, `DEVELOPERCLOUD.md` par. 2 |
| **45** architectuurpolitie | 52 codeafspraken binair, plus een motor die de wetten ECHT overtreedt | `scripts/check.js`, `scripts/sabotage.js` |

**Dat is veertien van de vijftig plus een bijna-treffer, en het is niet het
makkelijke deel.** Chaos, aanvallen, isolatie, bewijs, canary en shadow execution
zijn precies waar een platform jaren op vastloopt.

Maar ze delen alle veertien één eigenschap, en die is de kern van dit document:

> **Ze draaien tegen de echte server met testdata. Geen van hen draait in een
> wereld.**

En omgekeerd: Magnaat *heeft* een wereld met gedrag, een seed, en zelfs zijn
eigen invariantcontrole — maar die controleert het spel, niet RTG.

---

## 2. De testhal, gemeten

### De uitkomst

```
64 simulatiemodules tegenover 1398 kernmodules in 410 domeinen
   magnaat        61 modules
   hospitality     3 modules

1. HET BEREIK
   113 requires in de simulatielaag
     1 kernmodule geraakt, in 1 van 410 domeinen        (0%)
     0 modules doen een netwerkaanroep                  (de ontsnapping wordt niet gebruikt)
     3 aanroepen van de ene synthetische wereld naar de andere

2. DE DUBBELING
    10 onderwerpen komen aan beide kanten voor (29 paren)
     0 daarvan delen ook werkelijk een VORM
```

De enige kernmodule die de simulatielaag aanraakt is `kern/bestuursroutes`.
Niet `kern/pay`, niet `kern/waarde`, niet `kern/bevoegdheid`, niet
`kern/facturatie`, niet `kern/appstore`, niet `kern/tenant`.

> **Als testhal bewijst Magnaat vandaag niets over RTG, en de reden is niet
> subtiel: hij roept RTG niet aan.**

### En de tweede helft zegt iets anders dan verwacht

Punt 4 waarschuwt voor `MagnaatPaymentEngine` naast RTG Payment Engine. Die
zorg is gemeten en **er is geen enkel geval van**. Tien onderwerpen komen aan
beide kanten voor — `bank`, `handel`, `kaart`, `acties`, `economie` — maar geen
van de 29 paren deelt een vorm. `magnaat/bank.js` gaat over rente, termijn en
onderpand van een speler; `kern/bank/` gaat over IBAN, saldo en tenaamstelling.

Dat is precies de uitslag die `PLATFORM.md` bij Cercle en Entourage ook kreeg,
alleen dan geruststellend in plaats van verrassend: **een gedeelde naam is geen
gedeelde kern.**

**Het probleem is dus niet dubbeling maar afwezigheid.** Magnaat heeft RTG niet
nagebouwd — Magnaat en RTG hebben elkaar nooit ontmoet. Dat is een ander
probleem, en het is goedkoper: er hoeft niets te worden afgebroken.

### De pijp bestaat wel, en hij loopt de verkeerde kant op

Dit is het scherpste deel van de uitkomst, en het is geen nul.

`server/kern/magnaat-capabilities.js` heet in zijn eigen kop *"Automatische
Capability Graph voor Magnaat"*, en hij doet precies wat punt 11 vraagt — alleen
gespiegeld. Hij **leest RTG's echte code** (routes, functieschakelaars,
kantoorkamers), classificeert elke route op risico (`rood` bij bank, pay,
paspoort, kluis) en bouwt daar speelbare werkproces-families van. Er is ook een
`magnaat-dekkingsmatrix.js` met elf dimensies, waaronder `gameplay`, `economie`
en `volledige werkroute`.

Dus:

```
wat er is:     RTG-routes  ──►  Magnaat        (echte code wordt gameplay)
wat de opzet wil:  Magnaat  ──►  RTG-capabilities   (gameplay bewijst code)
```

De verbinding tussen de twee werelden is dus al een keer gebouwd, met zorg, en
met een risicoclassificatie die punt 39 bijna letterlijk beschrijft. Wat
ontbreekt is de retourrichting: RTG's routes komen Magnaat binnen als
*onderwerp*, niet als *aanroep*. Een partij Magnaat spelen raakt geen enkele van
die routes werkelijk aan.

Dat is goed nieuws voor de begroting: de moeilijkste helft van punt 11 — weten
welke capabilities er zijn en hoe zwaar ze wegen — staat er al.

### De bevinding die niemand vroeg: er zijn twee synthetische werelden

De meter telde drie aanroepen van `magnaat/economie.js` naar
`kern/hospitality-universe/` — een tweede wereld met locaties (Amsterdam, Ibiza,
Dubai), mensen, gasten, leveranciers, reserveringen, betalingen, een `seed`, acht
fases en een `wijzig()` die een **counterfactual** wegschrijft.

Dat is niet fout, en het is wel een vraag die vóór punt 5 hoort te worden
beantwoord in plaats van erna. De toetsvraag van `PLATFORM.md` par. 0b geldt hier
onverkort: *is dit een zelfstandige capability, of een tweede ingang naar
dezelfde?* Twee synthetische werelden die allebei mensen, vraag en gebeurtenissen
modelleren, en waarvan de ene de andere aanroept, zijn een samenvoegingskandidaat
— of twee dingen met een goede reden. Wat er niet mag gebeuren is dat er een
derde bij komt omdat "de Simulation Cloud" een nieuw project is.

---

## 3. Waarom het 0% is, en waarom dat niet lui is

Het zou makkelijk zijn hier "technische schuld" te schrijven. Dat is het niet, en
de reden staat in de code van de betaalkant.

`server/kern/pay/poort.js` is de poort waar elke boeking langs gaat. Nagemeten:
**hij kent geen enkele demo-, test-, spel- of simulatiestand.** Geen vlag, geen
omweg, geen `if (test)`. Dat is geen toeval maar de hardste regel van
`WAARDE.md`: waarde heeft een grond, en geld ontstaat nooit uit niets.

En een spelbank *moet* geld uit niets maken — dat is het spel. `scripts/magnaat-pomp.js`
bestaat juist om te controleren dat een spéler dat niet kan, maar de bank van
Magnaat zelf doet niets anders.

> **Het schoonste aan RTG Pay is vandaag precies de reden dat Magnaat er niet bij
> kan.**

Dat is de echte vraag achter punt 4, en de opzet stelt hem goed maar beantwoordt
hem op de gevaarlijkste plek:

```
de opzet:                          wat dat zou vragen:
Payment.Settle                     een schakelaar IN de poort
  → Adyen (productie)              die kiest welke rail eronder hangt
  → SyntheticBank (Magnaat)
```

Een schakelaar in de poort is een vlag die op een dag in productie aan staat. Dat
is niet paranoia: `LAT.md` regel 5 en regel 9 komen allebei uit gevallen waarin
precies dat gebeurde.

**Maar de naad die de opzet wil, bestaat al — één laag lager.** `server/betaal.js`
is letterlijk *"één naad waarachter de echte provider zit"*, met Stripe, Mollie en
een **demo-provider** die alleen draait als de installatie hem bewust heeft
aangezet en anders weigert met een fout.

Dus:

```
wat het moet worden:
kern/pay/poort.js        onveranderd, geen vlag, geen stand
  ↓
server/betaal.js         de naad die er al is
  ↓ Stripe / Mollie      productie
  ↓ demo                 bestaat al
  ↓ SyntheticBank        de vierde, met dezelfde discipline
```

Een `SyntheticBank` naast de demo-provider vraagt **nul wijzigingen aan de
waardepoort** en erft de bewaking die er al ligt. Dat is geen detail maar het
verschil tussen "Magnaat mag bij RTG Pay" en "RTG Pay heeft een spelstand".

En het is goedkoper dan het klinkt, want de naad is al een **injectiepunt** en
geen import: `kern/pay/index.js` krijgt `betaal` binnen als argument
(`module.exports = ({ db, save, ..., betaal, ... })`) en zegt in zijn eigen kop
*"De naad (server/betaal.js) is er al."* Een andere rail meegeven is dus een
ander argument, niet een andere tak in de code — en dat is precies waarom er geen
vlag nodig is. Wat er wel bij hoort is de discipline van de demo-provider: hij
draait alleen als de installatie hem bewust aanzet en weigert anders met een
fout, in plaats van stil terug te vallen.

---

## 4. Waar de opzet en het huis botsen

Zes punten vragen een besluit van de eigenaar.

### 4.1 Punt 2 — Magnaat als verplichte deployment gate

De opzet zet Magnaat tussen capability tests en canary in, met een
`Magnaat Certification` van tien regels die allemaal PASS moeten zijn.

Dat kan niet vóór par. 2 is opgelost: een poort die 0% van de domeinen aanraakt,
keurt goed op grond van niets — en dat is erger dan geen poort, want hij koopt
vertrouwen dat er niet is (`LAT.md` regel 9).

Er staat bovendien al een poort op die plek, en die is streng: `npm run check`
(52 regels), de mutatiemotor, `scripts/sabotage.js` en de bewijsmatrix. **Magnaat
hoort daar niet naast maar áchter**: eerst bewijzen dat één capability via
Magnaat aantoonbaar bereikt wordt, dan pas een regel in de poort.

De opzet zegt dit zelf met "risk-based gates" (punt 39), en dat is de goede vorm.
De valkuil is de volgorde: eerst de certificering opschrijven en dan hopen dat de
simulatie hem waarmaakt.

### 4.2 Punt 4 — de adapter, en waar hij woont

Zie par. 3. **De aanbeveling is: ja, maar de naad zit in `server/betaal.js` en
nooit in `kern/pay/poort.js`.** Dat is een besluit dat het opschrijven waard is,
want de verleiding gaat de andere kant op — een vlag in de poort is drie regels
en een provider is een module.

Dezelfde vraag komt terug bij elke andere capability die Magnaat wil aanroepen.
De regel die eruit volgt is algemeen:

> Een simulatie-adapter vervangt de **rail**, nooit de **poort**. Wat beslist of
> iets mag, draait in de simulatie ongewijzigd mee — anders test je een ander
> systeem.

### 4.3 Punt 24 en 25 — de Agent Arena

Een agent met €100.000 virtueel budget in een arena zetten, en andere agents hem
laten misleiden, is een goed idee en het past bij `DEVELOPERCLOUD.md` par. 3.2.

Waar het botst is de uitkomst. `CLAUDE.md`: *de AI mag nooit zelf toegang beloven
of verlenen.* `GELD.md` par. 3: geld verlaat het huis nooit autonoom. Een arena
die meet of een agent "winst maximaliseert binnen de regels" veronderstelt dat de
agent zelfstandig handelt — en dat is vandaag de bovengrens niet.

Dat maakt de arena niet zinloos, integendeel: hij is de enige plek waar
autonomie *veilig* te meten is. Maar de uitslag hoort te zijn "deze agent zou
binnen de grenzen zijn gebleven", niet "deze agent is nu vrijgegeven". Een
Magnaat-PASS mag geen bevoegdheid verlenen die het huis buiten Magnaat niet geeft.

### 4.4 Punt 26, 27 en 41 — scores

`RTG Readiness Score 96/100`, `App Store Certification` per dimensie, en een
`Platform Heatmap` met balkjes per domein.

Voor **apps** is dat gewoon goed, en het is beter dan "App rejected" — punt 28
(automatische verbetervoorstellen) is een van de sterkste punten in de hele
opzet.

Voor **mensen** ligt er een harde huisregel overheen: `HORECA.md` — er komt geen
ranglijst op medewerkers; `CLAUDE.md` — de progressielaag met ranglijsten stopt
bij 18+; RTG School — *leren is geen wedstrijd*, en daar geen ranglijsten buiten de sessie. Een heatmap per platformdomein
is een heatmap per team zodra er teams zijn (punt 43 van `OS.md`). Dat hoeft geen
bezwaar te zijn, maar het hoort een besluit te zijn en geen bijvangst van een
dashboard.

De veilige vorm bestaat al en staat in `BESTUUR.md`: een **bewijsgraad**
(onbekend, vermoed, gemeten, bewezen) met een datum, en `niet vast te stellen`
als eersteklas uitslag. Dat zegt hetzelfde als een score zonder een rangorde te
suggereren die er niet is.

### 4.5 Punt 43 — dependency fitness kan nog niet

De opzet wil dat een PR faalt als `Identity → RTG Food` wordt geïmporteerd.
Prachtig, en niet te bouwen zolang `OS.md` par. 4.2 openstaat: er liggen twee
lagenmodellen in dit huis en de opzet stelt een derde voor, en het woord
"Capabilities" betekent in twee ervan niet hetzelfde.

Een handhaver op een laagregel vraagt eerst één laagmodel. Wat er wél al is, is
de meting eronder: `scripts/grenzen.js` meet hoe breed een domein in de gedeelde
kern reikt, en vond dat 85% van de kernnamen door precies één domein wordt
gebruikt. De richting-regel kan daarbovenop, ná het besluit.

### 4.6 Punt 22 — privacy attack simulation

Dit is het meest onderscheidende punt van de vijftig en het staat er terecht:
kunnen twee capabilities samen iets afleiden wat afzonderlijk niet toegankelijk
was?

Het botst nergens, en het is bijna nieuw. Bijna, want er staat één echte
koppelingscontrole: `test/zegel.test.js` toets 5 eist dat het pseudoniem van een
lid **per partner verschilt** — zelfde lid bij twee partners levert twee
verschillende sleutels, dus de twee partners kunnen hun gegevens niet naast
elkaar leggen. Dat is precies de goede soort maatregel, en hij is er maar voor
één mechanisme.

Wat er niet is, is de vraag die punt 22 stelt: kunnen twee capabilities die
allebei mogen wat ze doen, samen iets opleveren dat geen van beide mag? Dat is
geen theoretisch risico in dit huis — `CLAUDE.md` schrijft zelf een geval uit
(een BIG-nummer naast een codenaam voert die codenaam terug naar een echte naam,
want een BIG-registratie staat in een openbaar register). Dat geval is met de
hand gevonden en met de hand opgelost; er is geen meter die het volgende vindt.

**Van de vijftig punten is dit degene die het meest oplevert per bestede dag**,
en hij vraagt geen simulatiewereld — hij vraagt een lijst van wat er niet
afleidbaar mag zijn, en dan de combinaties daartegen houden.

---

## 5. Wat ontbreekt, en wat het kost

### 5.1 De verbinding (par. 2) — 0%, en dat is de hele opgave

Alles hierboven hangt hieraan. De goedkoopste eerste stap is niet een
Simulation Cloud maar **één capability, één invariant, één keer bewezen**: laat
Magnaat een boeking door `kern/pay/poort.js` doen via een `SyntheticBank` in
`server/betaal.js`, en laat `scripts/magnaat-pomp.js` zijn geldpompvraag stellen
aan díé keten in plaats van aan de spelbank.

Slaagt dat, dan is de meting hierboven niet meer 0% en is er iets bewezen dat
vandaag niet bewezen is. Slaagt het niet, dan is dát de bevinding, en die is meer
waard dan een architectuurplaat.

### 5.2 Impact-based testing (punt 12) — de graaf ontbreekt

De opzet wil dat een wijziging in `Money.Payment.Authorize` automatisch de 83
relevante scenario's kiest. Daarvoor is een capability-graaf nodig, en `OS.md`
par. 2 heeft net gemeten dat die er niet is: twintig woordenlijsten die elkaar
niet kennen.

Wat er wél is, is de meting eronder: `scripts/dekking.js` weet uit een echt
routejournaal welke toetsen welke route hebben aangeraakt. Dat is de helft van
een impactgraaf, gebouwd op waarneming in plaats van op declaratie — en dat is de
betere helft.

### 5.3 Kostenregressie per wijziging (punten 16, 17)

`scripts/duurzaamheidskosten.js` rekent wat de duurzame commit kost, maar er is
geen cost-per-journey en geen kostenverschil per PR. Dit is een stap weg zodra de
eventenvelop uit `OS.md` par. 5.1 er ligt: zonder `correlation_id` is een journey
niet als geheel te beprijzen.

### 5.4 Wat jaren weg is

- **Punt 14 (RTG 2030/2035-schaal).** Statistisch gegenereerde workloads kunnen;
  een miljard identiteiten simuleren is een andere orde en hoort niet als
  vinkje in een pijplijn te staan.
- **Punt 32 (permanente universes).** Vijf universes die continu draaien is een
  exploitatiekostenpost, geen feature. Eerst par. 5.1.
- **Punt 48 (world marketplace).** Simulatiepakketten per land leunen op de
  regio-laag van `TENANT.md`, en die weigert de modus `sovereign` vandaag met
  reden.
- **Punt 49 (regulatory simulation).** Aantrekkelijk en het leunt op
  geversioneerd beleid; `WETTEN.json` en `CONTROLS.json` zijn het begin, een
  `PolicySet EU-2027` is het nog niet.

---

## 6. De volgorde

| fase | wat | waarom nu |
|---|---|---|
| ~~**0. De testhal meten**~~ ✅ | `scripts/magnaatlab.js` + `MAGNAATLAB.json`; de uitkomst staat in par. 2 | zonder dit is "Magnaat is onze testhal" een intentie, en de meting zegt 0% |
| **1. Eén capability erdoorheen** | Magnaat boekt via `kern/pay/poort.js` met een `SyntheticBank` in `server/betaal.js` | par. 5.1 — het bewijst de hele constructie of het weerlegt hem, en het raakt de poort niet aan |
| **2. Eén invariant verplaatsen** | `magnaat-pomp.js` stelt zijn geldpompvraag aan die keten in plaats van aan de spelbank | de meter bestaat al; alleen zijn onderwerp verandert |
| **3. De twee werelden wegen** | is `hospitality-universe` een tweede wereld of een tweede ingang? | par. 2 — vóór er een derde bij komt, niet erna |
| **4. Afleidbaarheid meten** | punt 22: wat mag uit combinaties NIET afleidbaar zijn | par. 4.6 — het meeste rendement per dag, en geen wereld voor nodig |
| **5. Pas dan een poort** | een risicoklasse-gebonden regel in `npm run check` | par. 4.1 — een poort die niets aanraakt keurt goed op grond van niets |
| **6. De wereld opschalen** | tiers, scenario-ID's, permanente universes | pas zinvol als 1 t/m 5 staan |

Fase 1 en 2 zijn samen klein. Dat is met opzet: ze maken de bewering uit de kop
van dit document voor het eerst waar voor precies één ding, en daarna is de vraag
niet meer *of* dit werkt maar *hoe ver het reikt*.

---

## 7. Wat dit niet wordt

- **Magnaat blijft een spel.** Alles hierboven gaat over een tweede gebruik van
  dezelfde motor. Waar de testhal iets vraagt dat het spel slechter maakt, wint
  het spel — `GAMEHALL.md` §12.6 staat er niet voor niets.
- **Geen certificering die bevoegdheid verleent.** Een Magnaat-PASS is bewijs,
  geen vergunning. Wat het huis buiten Magnaat niet toestaat, staat een groene
  simulatie niet toe (par. 4.3).
- **Geen tweede bewijsstelsel.** `BEWIJS.md`, `CONTROLS.json` en `NORM.json`
  bestaan. Een `Magnaat Evidence Ledger` ernaast is `LAT.md` regel 4 op
  registerniveau — het hoort een kolom te worden, geen kast.
- **Geen scores op mensen.** Zie par. 4.4. Op apps en capabilities mag het; op
  wie eraan werkt niet.

En de regel uit de kop hoort met één toevoeging te blijven staan, want zonder die
toevoeging is hij vandaag niet waar:

> Nothing critical reaches RTG production without first surviving RTG itself —
> **en wat Magnaat niet aanroept, heeft Magnaat niet overleefd.**

Vandaag is dat 0% van 410 domeinen. Dat getal is de opgave, en het is ook de
enige eerlijke maat voor de voortgang.
