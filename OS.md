# RTG Universal OS

> **Eén besturingssysteem van gestandaardiseerde capabilities, waarop iedere app,
> organisatie, ontwikkelaar en AI-agent bouwt.**

Dit bestand hoort bij `PLATFORM.md` en `DEVELOPERCLOUD.md` zoals die bij elkaar
horen, en het staat er bovenop: `PLATFORM.md` zegt hoe een sector erbij komt
zonder dat er een app bij komt, `DEVELOPERCLOUD.md` hoe een ontwikkelaar erop
bouwt, en dit zegt wat de laag daaronder dan precies IS.

Het is een richtingsdocument, geen toezegging. Net als `DEVELOPERCLOUD.md` staat
alles hieronder in vier bakken — **staat**, **een stap weg**, **een besluit
nodig**, **jaren weg** — zodat niemand ze voor elkaar aanziet. Wat in de laatste
twee bakken staat, hoort nergens als knop op een scherm te verschijnen.

En net als daar begint het met een meting, want de eerste wet van deze opzet is
ook haar grootste aanname.

---

## 0. De opzet in één zin, en wat eraan getoetst is

De opzet stelt 52 punten voor. Ze hangen allemaal aan één wet:

> **Everything is a Capability.** `Person.Verify`, `Payment.Authorize`,
> `Document.Sign`, `AI.Reason`, `Policy.Evaluate` — en iedere capability krijgt
> exact hetzelfde contract, zodat wie er één begrijpt ze allemaal begrijpt.

Dat is een goede wet. Hij is ook een aanname: hij gaat ervan uit dat "capability"
hier al één ding is dat je kunt standaardiseren. Dit huis heeft die aanname twee
keer eerder gedaan en twee keer betaald — Cercle en Entourage klonken identiek en
deelden niets (`PLATFORM.md`), en `Asset` klonk als vier domeinen die een vorm
delen en bleek niet te bestaan (`DEVELOPERCLOUD.md` par. 2).

Dus is het gemeten voordat het een wet werd. `scripts/capabilities.js` telt het,
`CAPABILITEIT.json` legt het vast, `test/capabilities.test.js` bewaakt dat de
meter meet wat hij zegt te meten — en dat hij ook uitslaat als er wél overlap is,
want een meter die altijd nul zegt is de gevaarlijkste van allemaal.

---

## 1. Wat er van de opzet vandaag al staat, gemeten

Geen inschatting. Per punt het bestand dat het doet; wie het niet gelooft, opent
het.

| uit de opzet | wat er staat | waar |
|---|---|---|
| **11** purpose-aware permissions | **volledig, en strenger dan gevraagd**: een gesloten lijst doelen, een machtiging kent haar toegestane doelen, en de vergunningsdiff ziet "zelfde machtiging, ánder doel" | `kern/appstore/machtigingen.js` (`DOELEN`, `doelMag`), `kern/appstore/besluit.js` |
| **42** Platform Constitution | **staat, en harder dan de opzet vraagt**: 41 wetten in 9 soorten, elk met een bron én een handhaver, plus een motor die ze ECHT overtreedt om te zien of er iets rood wordt | `WETTEN.json`, `scripts/sabotage.js`, `SABOTAGE.json` |
| **8/9** bindings i.p.v. API-sleutels | de brug leest wat het lid VERLEENDE, niet wat het manifest vroeg; de app krijgt nooit een sleutel | `kern/appstore/brug.js` |
| **47** security sandbox | de **cel**: derdencode in een naamloze herkomst, eigen CSP, integriteit per lezing, `connect-src 'none'` | `routes/appstore/cel.js` |
| **12** één policy engine | drie beleidslagen van hard naar zacht, en één poort waar elke betaling langs gaat | `kern/waarde/policy.js`, `kern/pay/poort.js` |
| **13** trust automatisch | bevoegdheid als eersteklas begrip: 16 vermogens met een rang, en een gezicht per stand | `kern/bevoegdheid/lijst.js`, `WAARDE.md` |
| **40** explain everything | de **bewijsgraad**: onbekend / vermoed / gemeten / bewezen, met datum, en `niet vast te stellen` als eersteklas uitslag | `BESTUUR.md`, `kern/command/gezondheid.js` |
| **39** time travel (half) | het actielog groeit aan en wordt nooit herschreven; de tijdlijn van het lid ook | `PLATFORM.md` wereldpatroon, `kern/appstore/dossier.js` |
| **16** extension points | het manifest vraagt, het lid geeft, de keuring leest per regel | `kern/appstore/manifest.js`, `kern/appstore/verboden.js` |
| **18** developer sandbox (een kwart) | de **proefkeuring**: dezelfde poort, niets bewaard, geen rem — maar geen synthetische wereld en geen lokaal draaien | `kern/appstore/versies.js` |
| **31** design system | vormtaal, drie modi, eigen componenten, materialenleer | `ONTWERP.md`, `MATERIAAL.md`, `test/ontwerp.test.js` |
| **49** offline | service worker en eigen offline-lagen | `public/sw.js` |
| **27** de agent aan banden | de AI-agent doet voorstellen; de gemachtigde keurt goed. Niets gaat vanzelf de deur uit | `kern/agent.js`, `GELD.md` par. 3 |
| **48** sovereignty (het fundament) | `org` IS de klant: contract, merk, levensloop, uitgang, herkomstregel niet uit te zetten — het datamodel is klaar, het draaien in meerdere regio's niet (par. 5.4) | `kern/tenant/`, `TENANT.md` |

**Veertien van de tweeënvijftig punten, en het is het moeilijke deel.** Auth,
geld, rechten, bewijs, meting en de sandbox zijn waar een platform jaren op
vastloopt; die staan. Twee
dingen springen eruit omdat ze in de opzet als toekomst staan en hier als code:

- **Punt 11 (purpose) is af.** De opzet noemt "Purpose-Aware Permission System"
  een lange-termijnvoordeel. Hier is het een gesloten lijst van acht doelen, met
  de reden erbij waarom het geen vrij tekstveld is: vrije tekst levert "om u beter
  van dienst te zijn" op, en dat is niet te vergelijken, niet te doorzoeken en
  niet te diffen bij een update.
- **Punt 42 (grondwet) is af én strenger.** De opzet stelt twaalf regels voor.
  `WETTEN.json` draagt er 41, elk met de plek waar hij gehandhaafd wordt — en
  `scripts/sabotage.js` overtreedt ze stuk voor stuk in de echte bestanden om te
  zien of er werkelijk iets rood wordt. Een grondwet zonder die motor is een
  verlanglijst met genummerde regels.

---

## 2. De eerste wet, gemeten

### De vraag

Als "Everything is a Capability" een hernoeming is, is het goedkoop. Als het een
nieuwe laag over bestaande, verschillende dingen is, is het duur. Het verschil is
te meten: **noemt het woord vandaag één ding?**

`scripts/capabilities.js` zoekt onder `server/` elke gesloten woordenlijst die
over mogen-en-kunnen gaat, en kijkt of de leden elkaar kennen.

### De uitkomst

```
2388 bestanden, 841 woordenlijsten gevonden, 20 gaan over mogen-en-kunnen
 241 verschillende leden in die 20 lijsten
 220 van 241 leden (91%) staan in PRECIES EEN lijst
   0 lijstparen lijken op elkaar   (hoogste gelijkenis tussen twee lijsten: 0,22)
```

**Er is geen capabilitylaag in deze code. Er zijn er twintig.** Eenennegentig
procent van de leden woont in één lijst, en geen twee lijsten lijken op elkaar —
de hoogste gelijkenis die er überhaupt is, is 0,22.

Het duidelijkste geval staat niet eens in de cijfers maar in de namen. Twee
bestanden dragen allebei een constante die `VERMOGENS` heet:

| | `kern/bevoegdheid/lijst.js` | `kern/command/vermogens.js` |
|---|---|---|
| Wat het is | wat RTG juridisch MAG | of een dienst het DOET |
| Leden | `SEPA_UIT`, `KLANTGELD`, `WALLET_SALDO`, `PAS_UITGIFTE` (16) | `bereikbaar`, `binnenkomen`, `betalen`, `sporen` (12) |
| Gedeelde leden | **nul** | **nul** |

Zelfde woord, geen enkel gedeeld lid. Dat is de les uit `PLATFORM.md` — *een
gedeeld routevoorvoegsel is geen gedeelde kern* — nog een keer, nu op een woord
in plaats van op een route.

### Wat dat betekent, en wat het NIET betekent

Het betekent **niet** dat de opzet fout is. Het betekent dat "één grammatica"
hier een **nieuwe laag** is en geen hernoeming, en dat is de prijs die op tafel
hoort te liggen voordat iemand hem betaalt.

En het wijst precies aan waar die laag wel en niet mag komen. De twintig lijsten
vallen in twee soorten, en de meting laat het verschil zien:

| | **platformvermogen** | **domeinvermogen** |
|---|---|---|
| Voorbeeld | `betalen`, `binnenkomen`, `bewaren`, `SEPA_UIT` | `rooms`, `rides`, `menu`, `tickets` |
| Waar | `kern/command/vermogens.js`, `kern/bevoegdheid/lijst.js`, `kern/appstore/machtigingen.js` | het genre-register, `kern/zaak.js`, `kern/pda/modules.js` |
| Vraag die het beantwoordt | mag deze aanroep, en doet hij het? | wat voor zaak is dit, en wat hoort daarbij? |
| Delen ze iets met elkaar? | ja — het zijn allemaal "een aanroep die lukt of niet" | nee, en dat is gemeten |
| Mag er één grammatica over? | **ja, en daar zit de hele winst** | **nee, en dat is dezelfde fout als `Asset`** |

Eén nuance bij de linkerkolom, want hij is niet homogeen: `SEPA_UIT` is geen
technische maar een **juridische** uitspraak — mag RTG dit überhaupt. Hij staat
links omdat hij een aanroep afgrendelt en niet een zaak typeert, maar hij houdt
zijn eigen rang: een grammatica die "bevoegd" en "beschikbaar" tot hetzelfde veld
maakt, verliest precies het onderscheid waar `WAARDE.md` op gebouwd is.

De opzet zegt dit zelf, in punt 37 en in wet 12: *"No experience owns
infrastructure that belongs in the platform."* Dat is precies goed — en de
omkering hoort er even hard bij te staan, want die staat er nu niet:

> **En het platform bezit geen betekenis die aan een domein toebehoort.**

Een hotelkamer heeft een schoonmaakstatus en een folio, een tafel heeft een
couvert en een bediening. Dat zijn geen twee invullingen van `Asset`, en `rooms`
en `rides` zijn geen twee invullingen van één capability-grammatica. Ze staan in
het genre-register omdat ze een ZAAK typeren, niet omdat ze een aanroep zijn.

**De aanbeveling is dus niet "voer de wet in" en ook niet "laat hem vallen", maar:
laat hem gelden voor het platformvermogen en houd hem weg bij het domeinvermogen.**
Dat is één wet met één grens, en de grens is meetbaar in plaats van een kwestie
van smaak.

---

## 3. Het contract (punt 7), en hoe ver het nog is

De opzet vraagt dat elke capability dezelfde eigenschappen draagt: input, output,
rechten, beleid, idempotentie, events, audit, kosten, limieten, SLA,
dataclassificatie, regio, versie, eigenaar, uitfasering, sandbox.

Gemeten over acht van die eigenschappen die in dit huis een woord hebben:

| lijst | draagt | van 8 |
|---|---|---|
| `kern/appstore/machtigingen.js` :: `MACHTIGINGEN` | label, risico, **doel**, **grens** | 4 |
| `kern/objectlaag/caps.js` :: `CAPS` | label, uitleg, bestemming | 3 |
| `kern/bevoegdheid/lijst.js` :: `VERMOGENS` | label, rang | 2 |
| `kern/command/vermogens.js` :: `VERMOGENS` | label, bron | 2 |
| het genre-register | label | 1 |
| `bedrijf/rollen-register.js` :: `RECHTEN` | — | 0 |

**Geen enkele lijst draagt het volle contract, en de volste draagt er vier van
acht.** Dat is de eerlijke afstand tot punt 7.

Maar het interessante is wélke vier. `MACHTIGINGEN` draagt als enige een **doel**
(waarvoor mag dit) en een **grens** (wat dit nooit geeft) — en dat zijn precies de
twee die geen enkel ander platform standaard heeft. Het is ook de kortste lijst
van allemaal: drie leden, met opzet.

> **Het model voor punt 7 bestaat dus al. Het staat alleen in het jongste en
> kleinste hoekje van het huis, en het is daar met de meeste zorg gebouwd.**

Dat is de goedkoopste route die er is: niet twintig lijsten optrekken naar een
verzonnen contract, maar het contract dat in de App Store werkt naar buiten
brengen — te beginnen bij de lijsten die er het dichtst bij staan.

Eén waarschuwing bij die tabel, want een 0 leest harder dan hij is: een lijst
zonder contractvelden is niet vanzelf slecht gebouwd. `bedrijf/rollen-register.js`
draagt rollen, en een rol heeft geen risicoclassificatie nodig om te deugen. Wat
de tabel meet is de afstand tot punt 7, niet de kwaliteit van de module.

---

## 4. Waar de opzet en het huis botsen

Zeven punten kunnen niet zomaar. Ze horen alle zeven een besluit van de eigenaar
te krijgen in plaats van stilletjes de ene of de andere kant op te vallen.

### 4.1 Punt 23 — `Asset` staat er weer in

De opzet noemt bij de canonieke objecten: `Person`, `Organization`,
`Relationship`, `Location`, **`Asset`**, `Product`, `Order`, `Payment`,
`Contract`, `Document`, `Message`, `Event`, `Account`, `Entitlement`.

`Asset` is in dit huis al gemeten en bestaat niet. `OBJECTMODEL.json`: een tafel
komt in 4 domeinen voor, een kamer in 15, een voertuig in 11, een podium in 1 —
en géén van die vier vormt met een van de andere een gelijkend paar. Ze delen
niets buiten hun verpakking.

Dit is geen muggenzifterij over één woord. Het is de enige plek in de hele opzet
waar een punt terugkomt dat hier al met een meting is beantwoord, en juist die
horen niet stilletjes opnieuw in een lijst te belanden (LAT-regel 6). De andere
dertien zijn niet gemeten en kunnen best kloppen; wat hier hoort te gebeuren is
`scripts/objectmodel.js` op die dertien loslaten, niet ze overnemen.

**Wat er wél uit de meting kwam** en dus het eerste echte objecttype is: een
**ontwerpopdracht**, gedeeld door `architect`, `atelier`, `hardwarelab` en
`studio`. Niet wat iemand had geraden — en dat is precies waarom er is gemeten.

### 4.2 Punt 3 — een derde lagenmodel

De opzet stelt vijf lagen voor: Experiences, Journeys, Capabilities, Control
Plane, Runtime. Dit huis deelt zichzelf al twee keer in, en langs verschillende
assen:

| | waar | de as | de lagen |
|---|---|---|---|
| A | `PLATFORM.md` par. 2 | platformzorgen, van binnen naar buiten | Core, Enterprise engines, Industry engines, Capabilities, PDA, Business Network, Consumer Network |
| B | `PLATFORM.md` par. 0b | hoe apps zich tot elkaar verhouden | specialistische apps, genre-superapps, RTG-hoofdlaag |
| C | deze opzet | uitvoering, van boven naar beneden | Experiences, Journeys, Capabilities, Control Plane, Runtime |

Twee assen naast elkaar is werkbaar; ze beantwoorden verschillende vragen. Drie is
het niet, en het probleem is aanwijsbaar in plaats van principieel: **"Capabilities"
staat in A én in C, en betekent er niet hetzelfde.** In A is het laag 4, de `caps`
van een genre (`rooms`, `rides`) — domeinvermogen, precies het soort dat par. 2
hierboven buiten de grammatica houdt. In C is het de herbruikbare bedrijfsfunctie
`Payment.Authorize` — platformvermogen. Wie die twee onder één woord in twee
documenten laat staan, krijgt binnen een jaar twee antwoorden op "hoort dit in de
capabilitylaag".

De vijf lagen zijn niet slechter dan de zeven — **Journeys** is een echte
toevoeging die in geen van beide bestaande modellen zit. Maar ze horen A te
VERVANGEN of eraan te worden opgehangen, en het woord dat botst hoort in één van
de twee een andere naam te krijgen.

Dit is het goedkoopste besluit in dit hele document en het duurste om uit te
stellen: één laagmodel kiezen kost een middag nu, en drie laagmodellen uit elkaar
trekken kost een maand over twee jaar.

### 4.3 Punten 25, 45 — de AI die capabilities uitvoert en apps schrijft

`CLAUDE.md`: *de AI mag nooit zelf toegang beloven of verlenen.* `GELD.md` par. 3:
*geld verlaat het huis nooit autonoom.* `LIFE.md`: *samenstellen en klaarzetten —
bevestigen doet de mens.*

De opzet loopt daar in punt 25 naartoe ("Plan drie gesprekken, reserveer ruimtes
en stuur uitnodigingen") en lost het in punt 27 zelf op: een agent met een budget,
een lijst mag-wel en een lijst mag-niet. Dat is dezelfde vorm die
`DEVELOPERCLOUD.md` par. 3.2 al uitschreef, en de vertaling is één op één:

| dit huis | de opzet | mag een agent dit? |
|---|---|---|
| kijken | observe | ja |
| voorstellen | observe | ja |
| klaarzetten | assisted | ja — dit is de bovengrens vandaag |
| automatisch | autonomous | alleen binnen het eigen tegoed, nooit voor een derde |

Punt 25 hoort dus te eindigen op **klaarzetten**: drie gesprekken voorgesteld,
ruimtes vastgehouden, uitnodigingen geschreven en klaar — en een mens die op
verzenden drukt. Dat is geen afgezwakte versie van het idee; het is het idee met
de regel die dit huis al heeft.

### 4.4 Punt 26 — Human = App = Agent

Dit is architectonisch het sterkste punt van de hele opzet, en het is vandaag
**niet** waar: mensen lopen via `accounts.js` en de identiteitskluis, apps via
`kern/appstore/brug.js`, en agents via `kern/agent.js` met een eigen goedkeuring.
Drie modellen.

Ze samenbrengen is goed en het is werk. Wat er níét mag gebeuren is het
omgekeerde: de drie samenvatten in één actor-tabel op een scherm terwijl er
onderin drie modellen blijven staan. Dan bestaat het gedeelde trustmodel alleen in
de documentatie, en dat is de duurste soort belofte (LAT-regel 6).

### 4.5 Punt 36 — Zero Re-entry tegenover de codenamen

"RTG vraagt informatie maar één keer" botst niet met de codenaam-opzet, maar het
raakt er wel aan. `APPSTORE.md` grens 3: een uitgever krijgt niet eens de codenaam
van wie zijn app kocht, en `test/appstore-geld.test.js` toets 7 zakt als dat
verandert.

Binnen RTG is Zero Re-entry gewoon goed. Over de grens naar een derde is het een
besluit met een prijs, en `DEVELOPERCLOUD.md` par. 3.3 beschrijft de tussenvorm:
een klant die zichzelf bekend maakt, met een spoor en een intrekknop.

### 4.6 Punt 33 — "Leave at 17:21?"

Het voorbeeld is aantrekkelijk en het loopt langs twee lijnen tegelijk. `LEVEN.md`
par. 2: *nooit sturen maar openen.* `CLAUDE.md`: geen kunstmatige urgentie.

Het verschil zit in de vorm en niet in de functie. "Vertrek om 17:21" is sturen.
"Uw reservering is om 18:00; de reis duurt nu 39 minuten" is openen — dezelfde
gegevens, en de mens trekt de conclusie. Dat onderscheid hoort in het
capability-contract terecht te komen en niet in de smaak van wie het scherm bouwt.

### 4.7 Punt 43 — de organisatie omgooien

De opzet stelt platformteams naast experience-teams voor. Dat is een goed model
voor een bedrijf met dertigduizend engineers en het is geen codebesluit; het staat
hier alleen zodat niemand het voor een technische stap aanziet. Wat er vandaag wél
uit volgt is punt 41 (elke capability heeft een eigenaar) — en dát is te bouwen,
want `WETTEN.json` doet het al voor wetten.

---

## 5. Wat er ontbreekt, en wat het kost

### 5.1 De eventtaal (punt 14) — de bus staat, de taal niet

`server/bus.js` bestaat en doet zijn werk: in-proces zonder Redis, pub/sub ermee,
precies één aflevering per proces. Wat hij NIET draagt, nagekeken in de bron: geen
`event_id`, geen `actor`, geen `correlation_id`, geen `causation_id`, geen
`schema_version`, geen `classification`.

Dat is dus geen half punt maar twee verschillende dingen waarvan er één af is.
**Vervoer is er. Taal niet.** En de taal is het hele punt van punt 14: zonder
envelop is `payment.authorized.v1` een string die iemand heeft afgesproken, en
loopt de tweede consument binnen een maand op een veld dat er soms is.

Dit is de goedkoopste grote stap in het document: de envelop is een module en een
toets, en hij kan naast het bestaande verkeer meelopen.

### 5.2 Idempotentie (punt 38) — gemeten, en het is niet best

De opzet wil retry-veiligheid als platformstandaard. Dit huis meet het al per
route (`scripts/idemproef-route.js`, `IDEMPROEF.json`), en de uitslag:

```
3074 routes met een rol
 115 beoordeeld
  15 beschermd
 100 onbeschermd
2959 ongemeten
```

**Van de 115 muterende routes die werkelijk zijn beproefd, zijn er 15 retry-veilig
en 100 niet.** Dat is geen reden tot paniek en wel het echte startpunt: punt 38 is
hier niet "iets bouwen dat er niet is" maar "een bestaande meting van 13% naar
boven brengen", en de meting bestaat al.

Let op het derde getal. 2959 routes zijn ongemeten, en ongemeten is geen groen.

### 5.3 De schil (punten 19–21, 30, 44) — SDK, CLI, emulator, console

Onveranderd sinds `DEVELOPERCLOUD.md`: dit is het deel waar een ontwikkelaar naar
kijkt, en er staat nul van. `rtg create` bestaat niet. Wat er wel is, is de reden
dat het nu pas zin heeft: fase 1 (het objectmodel meten), 2 (capabilities met een
doel) en 3 (de vergunningsdiff) staan, en een SDK die daarop wordt gebouwd
codificeert een meting in plaats van een gok.

### 5.4 Wat jaren weg is

- **Punt 17 (RTG Functions).** De cel van punt 47 staat (par. 1), maar hij staat in
  de BROWSER van het lid: `DEVELOPERCLOUD.md` par. 3.4 legt vast dat derdencode
  vandaag nooit op onze machines draait. `calculateCustomDiscount()` bij ons laten
  draaien is niet een feature erbij maar RTG dat een hostingbedrijf wordt — ander
  dreigingsmodel, 24 uur per dag aan. Dat hoort een eigen document met een eigen
  bewijslast te krijgen, zoals `GELD.md` en `TENANT.md` die hebben.
- **Punt 29 (industriepakketten).** Ze hangen aan de sectormotoren, en die zijn
  stap 6 van `PLATFORM.md` — het ophangpunt (`industry` per genre) ligt er, de
  motoren niet.
- **Punt 48, de tweede helft (meerdere regio's echt draaien).** Het datamodel staat
  (par. 1); regio, jurisdictie, valuta en beleidsset per klant zijn er. Wat jaren
  weg is, is werkelijk gescheiden verwerking per regio. `TENANT.md` weigert de modus
  `sovereign` vandaag met de reden erbij, en dat is de juiste vorm.

---

## 6. De volgorde

Niet op volgorde van aantrekkelijkheid. Wat eerst moet, is wat de rest mogelijk
maakt — en wat het goedkoopst terug te draaien is.

| fase | wat | waarom nu |
|---|---|---|
| ~~**0. De wet meten**~~ ✅ | `scripts/capabilities.js` + `CAPABILITEIT.json`; de uitkomst staat in par. 2 | zonder dit is "Everything is a Capability" een aanname, en aannames over gedeelde vorm zijn hier twee keer fout geweest |
| **1. Eén lagenmodel kiezen** | de vijf van de opzet, de zeven van `PLATFORM.md`, of één samenvoeging | par. 4.2 — een middag nu, een maand over twee jaar |
| **2. De eventenvelop** | `event_id`, actor, `correlation_id`, `causation_id`, versie, classificatie op `server/bus.js` | par. 5.1 — kan naast het bestaande verkeer meelopen, en elke volgende stap leunt erop |
| **3. Het contract naar buiten** | het model van `MACHTIGINGEN` (doel + grens) op de lijsten die er het dichtst bij staan | par. 3 — het model bestaat al en is beproefd |
| **4. Idempotentie van 13% omhoog** | de 100 onbeschermde routes eerst, daarna de 2959 ongemeten | par. 5.2 — de meting staat er al |
| **5. Eén actormodel** | mens, app en agent onder één trustlaag | par. 4.4 — hoe langer dit wacht, hoe duurder |
| **6. De SDK en de CLI** | `rtg create`, `rtg dev`, typings, één foutmodel | pas zinvol als 1 t/m 3 staan; anders codificeert hij het verkeerde |

Fase 1 is een besluit en geen bouwwerk, en staat daarom vooraan: elke fase
daarna moet weten in welke laag hij landt.

---

## 7. Wat dit document niet is

Het is geen toezegging dat er 52 dingen komen. Het is de plek waar staat welke er
al zijn, welke één stap weg liggen, welke een besluit vragen en welke jaren weg
zijn.

Twee dingen die er met opzet NIET in staan:

- **Geen belofte dat de capabilitylaag er komt.** Par. 2 laat zien wat hij kost:
  een nieuwe laag over twintig woordenlijsten, niet een hernoeming. Dat is een
  besluit van de eigenaar en geen vanzelfsprekendheid.
- **Geen getal over hoeveel capabilities RTG heeft.** De opzet noemt "duizenden".
  Er zijn er vandaag 241 die zo heten, in twintig lijsten die elkaar niet kennen.
  Een getal dat die twintig optelt alsof het er één is, is precies de bewering die
  dit document probeert te voorkomen.

En de vraag die de opzet zelf voorstelt om bij elk nieuw product te stellen, is de
beste zin uit het hele stuk. Hij hoort hier te staan met één toevoeging in vet:

> Welke nieuwe capability voegen we toe waardoor niet alleen dit product, maar de
> volgende honderd producten makkelijker worden — **en is het een platformvermogen
> of een domeinvermogen?**

Zonder die tweede helft levert de vraag op termijn een `Asset` op.
