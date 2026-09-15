# RTG Neiging

*Eén RTG. Voor iedereen anders.*

Richtingsdocument, zoals `PLATFORM.md`, `HDI.md` en `ECONOMIE.md`: per onderdeel
staat er of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren
weg** is — zodat niemand die vier voor elkaar aanziet.

Lees dit vóór je iets bouwt dat zich aanpast aan wie er kijkt: een intake, een
voorkeur, een aanbeveling, een persoonlijke volgorde.

De kern in één zin: **RTG bewaart niet wie je bent maar waar je naartoe neigt, en
hij kan van elk stuk zeggen hoe hij eraan komt, hoe hard het is en wanneer het
ophoudt te gelden.**

---

## 0. De meting gaat voor

Het voorstel voor RTG Neiging rust op een bewering die aantrekkelijk klinkt:

> *Bouw geen profiel. Bouw een Personal Context Graph.*

Dat kán waar zijn. Of het waar ís, is een meting — en dit huis heeft die vraag al
vier keer verkeerd zien beantwoorden. `Asset` klonk net zo vanzelfsprekend over
tafel, kamer, podium en leaseauto (`OBJECTMODEL.json`). De carrièrelus klonk
vanzelfsprekend over vijftien talentdomeinen (`CARRIEREVORM.json`). `Moment` over
acht publieke domeinen (`STAGEVORM.json`), `Manier` over vijf terreinen
(`AANVOERVORM.json`). Alle vier sneuvelden ze toen iemand ze tegen de code hield.

`npm run neigingvorm` (`NEIGINGVORM.json`) draait daarom op de lezer van
`scripts/objectmodel.js` — een tweede parser zou de vergelijking met die vier
metingen waardeloos maken. Drie metingen die niet hetzelfde zeggen.

### A. De naam — alle vijftien begrippen waren bezet

Gemeten over de hele boom: bestanden die het woord noemen, domeinen waarin ze
vallen, en het aantal plekken waar het al een **veldnaam** is.

| begrip | bestanden | domeinen | als veldnaam |
|---|---|---|---|
| `moment` | 1615 | 384 | 97 |
| `context` | 1206 | 268 | 122 |
| `groep` | 1169 | 254 | 242 |
| `profiel` | 1051 | 253 | 178 |
| `verval` | 681 | 223 | 115 |
| … | | | |
| `adaptief` | 95 | 34 | 1 |
| `relevantie` | 17 | 11 | 1 |

En de naam die het geworden is, met een ANDERE meting en dat hoort erbij te
staan: `neiging` is geteld op de commit **vóór** deze tak, want sinds
`server/kern/neiging/` bestaat telt de meter zijn eigen laag mee. Toen: **4
bestanden, 4 domeinen, 0 veldnamen** — en alle vier gewone Nederlandse tekst in
een toelichting ("de neiging om toch maar iets te doen is nu juist het
probleem"). Na te rekenen met `git grep -lIi neiging <commit>`. Wie de twee
getallen naast elkaar legt zonder dat verschil te kennen, leest een botsing waar
er geen is; de `grens` van het register zegt het daarom ook.

Dat is geen trivia. `context` betekent in dit huis **situatie** —
`kern/experience/contexts.js` gebruikt het voor *welke reis, welke werkruimte*,
server-afgeleid en first-class. Een "Personal Context Graph" die datzelfde woord
overneemt voor *wat iemand leuk vindt*, is exact de `VERMOGENS`-botsing uit
`OS.md` en de `moment`-botsing uit `STAGE.md`: twee betekenissen op de centrale
naam van een hele laag.

Het woord is bovendien preciezer: een profiel klinkt als iets wat iemand *is*, een
neiging is wat iemand *neigt te doen*. Dat verschil bepaalt of je het durft te
laten zien aan degene over wie het gaat — en deze laag is gebouwd om precies dat
te doen.

> **Deze tabel is de TWEEDE meting, en de eerste was fout op een manier die
> eruitzag als een uitslag.** Zie par. 7.

### B. De voorkeurslaag — er wordt al op gestuurd, en niemand weet hoe hard

Van **1403** gelezen vormen dragen er **14** een affiniteitsveld, verspreid over
**10 domeinen**: de wensen van RTG Vonk, het zorgprofiel, die van een marina, een
sportclub, de RTFoundation, een onderneming, een school.

Van die veertien dragen er:

- **0** een **grond** (waar weten we dit vandaan),
- **0** een **zekerheid** (hoe hard is het),
- **0** een **verval** (wanneer houdt het op te gelden).

Dat is de dragende uitslag van dit document, en hij is ongemakkelijker dan "er is
niets". Er wordt al op voorkeuren gestuurd, en er is geen enkele plek waar staat
of zo'n voorkeur één keer is aangeklikt of tien keer bevestigd.

> **De meter heeft hier een blinde vlek die eruitziet als succes.** De gedeelde
> lezer `vormenVan()` ziet alleen expliciete velden (`wens: '...'`) en geen
> verkorte eigenschappen (`{ wens }`). De eerste mutatie die deze meting hoorde
> te laten uitslaan, deed dat niet — niet omdat er niets gebeurde, maar omdat hij
> niet keek; op een expliciete vorm sloeg hij wel uit (0 → 1 op alle vier de
> tellers). Dat is hier niet gerepareerd, want een eigen parser maakt de
> vergelijking met de vier eerdere vormmetingen waardeloos. Het betekent wel dat
> **14 een ondergrens is die harder onderschat dan je zou denken**: shorthand is
> de gewone schrijfwijze zodra een waarde uit een variabele komt, en dat is juist
> bij geschreven rijen zo.

### C. Het voorstel tegen de code — vijftien van de vijftien bestonden al

Elk van de vijftien punten uit het voorstel draagt in `NEIGINGVORM.json` een
**verwijzing naar bestaande code**, en die verwijzing wordt **nagetrokken**:
bestaat het bestand, en staat het genoemde symbool erin? Een punt waarvan de
verwijzing rot, zakt naar `verwijzing-rot`. De meter verdiende zich meteen terug:
punt 14 wees naar een `gezin`-module onder `server/kern/` die niet bestaat — de
werkelijke onderbouw is `kern/levensband/inzage.js`.

**Stand: 15 dragen, 0 rot.** Net als bij `HDI.md` par. 1 en `STAGE.md` par. 3 is
het werk dus **aansluiten en niet uitvinden**.

---

## 1. Wat er al stond, en waar het ophield

| # | punt uit het voorstel | bestaat als | wat ontbrak |
|---|---|---|---|
| 1 | Passkey als eerste route | `server/webauthn/` | de voordeur toont hem als instelling achteraf, niet als eerste route |
| 2 | Adaptieve onboarding | `kern/onboarding.js` | de veldenlijst is VAST: iedereen dezelfde vragen, dezelfde volgorde |
| 3 | Progressive profiling | `kern/gegevenspoort.js` | bestaat, maar alleen voor NOODZAKELIJKE gegevens; niet voor voorkeuren |
| 4 | Personal Context Graph | `kern/levensgraaf/graaf.js` | de graafVORM staat, maar projecteert bezittingen — voorkeuren staan nergens |
| 5 | Tijd als dimensie | `kern/experience/contexts.js` | de SITUATIE is first-class; de andere vijf assen bestaan niet |
| 6 | Adaptive content, stable controls | `kern/experience/projections.js` | geen weging: de volgorde is de volgorde waarin domeinen toevallig antwoorden |
| 7 | De interface anticipeert | `kern/experience/attention.js` | reageert op wat er IS, voorspelt niets |
| 8 | Rahul als ingang | `kern/stuur/beleid.js` | de keten taal → intent → pad staat; er is geen intent die een voorkeur wijzigt |
| 9 | AI-geheugen zichtbaar | `kern/consent-register.js` | gaat over wat een DERDE krijgt, niet over wat RTG zelf denkt te weten |
| 10 | Doelbinding | `kern/gastzorg-profiel.js` `zorgMee()` | bestaat AL en is streng — maar voor één domein, niet als platformvorm |
| 11 | Zero-knowledge-achtig bewijs | `kern/volwassen.js` | de vorm staat (een eigenschap in plaats van een geboortedatum); geen uitgifte naar buiten |
| 12 | Edge + realtime | `kern/ai/router.js` | staat in de schaduw, beslist nog niets |
| 13 | Confidence met decay | `kern/levensgraaf/termijnen.js` | verval op een TERMIJN bestaat; verval als afnemend GEWICHT nergens |
| 14 | Groepspersonalisatie | `kern/levensband/inzage.js` | de band is wederzijds bevestigd en weet per stuk wat de ander mag zien; er is geen gezamenlijke uitkomst |
| 15 | Het onboarding-einde | `MAPPEN` → `sprongindex.json` | de overgang bestaat; er was niets persoonlijks om erin te tonen |

---

## 2. Wat deze laag toevoegt, en wat hij nadrukkelijk niet is

**Wat hij is.** Eén ding: een **neiging** — wat iemand leuk vindt of naartoe
neigt, met een grond eronder, een graad erboven en een termijn eraan. Dat stond
nergens.

**Wat hij niet is, en dat is de helft van het ontwerp.** Hij slikt de veertien
bestaande affiniteitsvormen níét in. Een dieetwens die in `kern/gastzorg.js`
hoort, hoort daar — inclusief de doorwerking die `zorgMee()` er al omheen heeft
gezet. Een laag eroverheen die dezelfde waarheid nóg een keer opslaat, loopt
uiteen met het origineel, en meestal zonder dat iets klaagt (LAT-regel 4).

Daarom is RTG Neiging **geen projectie van de domeinen** en ook **geen tweede
Experience Plane**. Het spiegelbeeld is precies:

- `kern/experience/` **projecteert** domeinwaarheid en bezit niets;
- `kern/neiging/` **bewaart** als enige het ene ding dat geen domein bezit.

Hij krijgt de kern dan ook niet mee (`opzet/kernlaag3w.js`): deze laag leest geen
enkel ander domein, en dat is een eigenschap van de bedrading en niet van de
discipline van wie hem aanroept.

---

## 3. De vorm

### 3.1 De ladder — geen zesde, en geen kommagetal

Het voorstel vraagt `confidence → 0.94`. Dat komt er niet, om twee redenen die
allebei al vastlagen.

`AFSPRAAK.md` verbiedt **een zesde uitkomst- of zekerheidsladder**: er zijn er al
vijf (`GEZAGSNOEMER.json` telt 5 schalen op 21 treden, `CONTROLPLANE.md` acht
uitkomsten, `kern/identiteit/vertrouwen.js` vijf assurance-standen, de
vervalstaten, de schaduwmodi). En INT-04 verbiedt een **samengesteld cijfer**:
`confidence` is hier niet meetbaar, en vermenigvuldigen met een verzonnen getal
is erger dan het weglaten. 0,94 tegenover 0,91 is een verschil dat nergens
vandaan komt.

`kern/neiging/ladder.js` hergebruikt daarom de bestaande vier van `BESTUUR.md`:

```
onbekend  ->  vermoed  ->  gemeten  ->  bewezen
```

Elke trede volgt uit een **grond** die je kunt navertellen:

| grond | wat het is | trede |
|---|---|---|
| `gezegd` | het lid heeft het zelf gezegd of aangetikt | `bewezen` |
| `gekozen` | meermaals gekozen, geteld gedrag | `gemeten` vanaf 3×, daaronder `vermoed` |
| `afgeleid` | één gebeurtenis of een gevolgtrekking | `vermoed` |

Een onbekende grond levert `onbekend` en nooit een middenklasse — anders laat een
tikfout in een aanroeper een bewering vanzelf sterker worden.

### 3.2 Verval raakt niet alles, en dat is het scherpste besluit hier

Het voorstel wijst terecht aan dat je verleden je toekomst niet eeuwig moet
bepalen. Maar verval mag níét over de hele linie:

> **RTG vergeet niet wat je hem verteld hebt omdat er een half jaar voorbij is.
> Hij vergeet wat hij zelf heeft geráden.**

`gezegd` vervalt dus nooit door tijd — alleen het lid haalt een uitspraak weg.
Draai je dat om, dan krijg je het gedrag waar mensen terecht boos van worden: je
vertelt een systeem eenmalig dat je geen alcohol drinkt, en een half jaar later
staat de wijnsuggestie er weer omdat een teller is afgelopen.

Wat wél vervalt, met de reden als besluit en niet als schijnmeting:

- `afgeleid` — **90 dagen**. Eén gebeurtenis is het dunste wat we hebben. Komt hij
  een kwartaal niet terug, dan was het een voorval en geen patroon.
- `gekozen` — **180 dagen**. Geteld gedrag mag een seizoenswisseling overleven:
  wie 's winters niet naar het strand gaat, houdt in maart nog steeds van het
  strand.

### 3.3 De vraagmotor — winst is een rekensom, geen leus

Het probleem met een intake van veertig velden is niet dat hij lang is, maar dat
niemand kan zeggen wat een antwoord oplevert. `kern/neiging/vraag.js` stelt per
keer één vraag:

> *verandert het antwoord op deze vraag iets aan wat RTG voor jou opendoet?*

Elke optie wijst naar **bestemmingen**: onderdelen van dit huis die door dat
antwoord relevant worden. De **winst** van een vraag is het aantal bestemmingen
dat hij nog kan opendoen. Winst nul betekent: welk antwoord je ook geeft, er
verandert niets — dus stellen we hem niet. **Daarmee kapt de intake zichzelf af**,
niet na een afgesproken aantal stappen maar op het moment dat er niets meer te
winnen valt. Gemeten in de proef: drie vragen, zeven bestemmingen open.

De bestemmingen komen uit `public/shared/sprongindex.json` — de lijst die uit
`MAPPEN` wordt afgeleid, en de enige lijst apps die dit huis heeft. Ze worden
**nagetrokken** door `controle()`; verdwijnt een onderdeel, dan zakt
`test/neiging.test.js` in plaats van dat een lid stil een vraag krijgt die
nergens meer toe leidt.

De **indeling** (welke onderdelen samen "eten" heten) is mensenwerk en staat
nergens in de code — precies zoals `WERELDLIJST.md` dat al vaststelt over de laag
tussen wereld en onderdeel. De grens loopt tussen de indeling (besluit) en de
bestemmingen (nagetrokken), en niet ertussenin.

### 3.4 Doelbinding — twee doelen, en wat er met opzet niet is

Een neiging wordt gelezen **mét een doel**, en een neiging die dat doel niet
draagt komt er niet uit — geweigerd bij het lezen en niet gefilterd erna, want een
filter achteraf kan iemand vergeten.

| doel | wat het betekent |
|---|---|
| `tonen` | hiermee bepaalt RTG wat hij je laat zien |
| `helpen` | hiermee helpt RTG je met iets wat je zelf vraagt |

**Wat er met opzet niet is** (`server/kern/neiging/besluiten.js`):

- **`delen`** — een neiging gaat nooit naar een derde partij. Wie een voorkeur aan
  een zaak wil meegeven gebruikt `zorgMee()`, dat al een zaak, een reden en een
  intrekbaar spoor eist.
- **`adverteren`** — er is geen advertentiedoel en er komt er geen. Dat is geen
  instelling die uitstaat: het woord komt in de gesloten lijst niet voor, dus een
  aanroeper die erom vraagt krijgt een weigering.
- **`verbeteren`** of **`onderzoek`** — klinkt onschuldig en betekent in de
  praktijk alles. Een doel dat je niet kunt uitleggen aan degene over wie het
  gaat, is geen doel.

### 3.5 Waar het aan hangt

Aan een **actor**: een hash van de sessiesleutel, dezelfde vorm als
`kern/experience/opslag.js`. Niet aan de codenaam, en dat is bewust strenger dan
INT-03 vraagt — `scripts/afleidbaar.js` mat dat een codenaam met genoeg ernaast
terugleidt naar een mens. Het lid komt bij zijn eigen neigingen omdat hij de
sleutel *heeft*, niet omdat er een koppeling ligt.

En er staat een **bewaartermijn** op vanaf de eerste regel (730 dagen): precies
dát ontbrak bij de vondst van `scripts/afleidbaar.js`, en een termijn die je er
later bij doet, geldt niet voor wat er al ligt.

---

## 4. Stand per onderdeel

### Staat

- **De neiging met grond, graad, doel, deel en termijn** — `kern/neiging/`,
  negen bestanden, 29 unittoetsen, 7 e2e-toetsen tegen een echte server en 6
  schermtoetsen in een echte browser.
- **Eén naam op de kern** (`kern.neiging`), de vorm van `kern/socialewereld.js`
  en `kern/geldwereld.js` — en `GRENZEN.json` laat voor het domein precies die
  ene naam door.
- **Een schakelaar in de boardroom** (`neiging` in de functiecatalogus), zodat de
  laag als geheel uit kan. Eén pad en niet zeven: intake en geheugenkaart zijn
  twee helften van dezelfde functie.
- **Twee ratels** op `NEIGINGVORM.json` (`neigingVerwijzingRot`,
  `neigingVoorkeurBlind`), allebei geijkt in `test/meterijk.test.js` — een meter
  die niet kan uitslaan is geen meter.
- **De vraagmotor die zichzelf afkapt** — winst als telling, bestemmingen
  nagetrokken tegen `sprongindex.json`.
- **Verval dat `gezegd` met rust laat.**
- **Zeven ledenroutes**, alle zeven met een mutatiecontract op een gemeten ronde.
- **Het scherm** `/apps/mijn-neigingen.html` ("Mijn neigingen"), met per neiging *wijzigen*,
  *vergeet dit* en *niet hiervoor gebruiken*, en met de eigen rand erbij.
- **De intake is nooit verplicht** — "ik doe dit later" bestaat, en wie hem nooit
  doet houdt exact het huis dat hij vandaag heeft.

### Een stap weg

- **Neigingen in de projectie laten wegen.** `kern/experience/projections.js`
  levert items met bron en versheid, maar zonder volgorde. De weging hoort dáár
  en niet hier (zie grens ADAPT-05).
- **`merkOp()` een aanroeper geven.** De progressive-profiling kant bestaat
  (`neigingMerkOp`) en wordt vandaag door niemand aangeroepen: er is nog geen
  plek waar gedrag wordt opgemerkt. Dat is bewust één besluit en niet twintig
  losse haakjes.
- **De microvraag op het moment zelf** ("Vegetarisch belangrijk voor jou?"). De
  motor kan het al; wat ontbreekt is een plek in de flow die hem aanroept.

### Vraagt een besluit

- **Wordt dit de voordeur?** Het voorstel wil de intake bij binnenkomst. Vandaag
  hangt hij onder *Instellingen → Mijn neigingen*. De voordeur veranderen raakt
  `server/middleware/voordeur.js` en de inlogpoort, en dat is geen bijvangst van
  deze laag. Klein en omkeerbaar zou zijn: na de eerste inlog één keer aanbieden,
  met "later" even groot.
- **Mag een neiging de AI-context in?** Vandaag niet, en dat is geen
  vergeetachtigheid maar AI-CONTEXT-01: die context komt uit een POSITIEVE lijst
  velden (`LEDENVELDEN`, vandaag `trip` en `invoices`). Iets toevoegen is een
  besluit met een eigen toets (`test/aicontext-allowlist.test.js`). Zodra het
  valt, is `neigingLees(key, 'helpen')` de weg — met een doel, en nooit met
  een spread.
- **Mag het kantoor er ooit bij?** Vandaag is er geen kantoorroute en dat is met
  opzet. `KANTOORMACHT.md` mat dat 422 van de 590 kantoorroutes achter een
  gedeelde code hangen, en dat een spoor dat daar eindigt een alibi is. Wil het
  kantoor erbij, dan langs `kern/ledenbalie-inzage.js`: een reden, een
  journaalregel en bericht aan de betrokkene.
- **Groepspersonalisatie.** Zie par. 6.

### Jaren weg

- **Anticiperen** (punt 7 in zijn volle vorm: "je avond staat bijna klaar").
  `kern/experience/attention.js` reageert op wat er ís. Voorspellen vraagt de
  laag uit `INTELLIGENTIE.md`, en die noemt zelf het getal dat hem blokkeert.
- **Zero-knowledge-uitgifte naar een externe partij.** De vorm staat binnenshuis
  (`volwassen()` geeft een eigenschap door, geen geboortedatum); een uitgiftepad
  naar buiten is een heel ander project.

---

## 5. De grenzen

Zeven regels, met per regel wie hem handhaaft — en waar dat niemand is, staat dat
er liever dan een schijnbewaker.

**ADAPT-01 — De meeteenheid is de neiging en nooit de mens.** Er komt geen score
op een persoon, ook niet intern als sorteersleutel. Een graad hangt aan een
neiging (*hoe hard weten we dít*), nooit aan iemand (*hoe waardevol is deze*).
*Handhaver: vandaag niemand. Deze regel staat al in vier documenten
(`KANTOORMACHT.md`, `HDI.md`, `ONTMOETEN.md`, INT-04) met nul handhavers; dit is
niet de laag die dat oplost, maar wel een die hem niet breekt.*

**ADAPT-02 — De uitkomst voegt alleen toe.** `opent()` geeft bestemmingen die
opengaan. Er is geen functie die iets dichtdoet, en dat kán ook niet — er is geen
veld waarin dat zou passen. `FOUNDATION.md` par. 5: zo'n motor mag alleen
tóevoegen en nooit zeggen "dit is niets voor jou".
*Handhaver: `test/neiging.test.js` — een extra antwoord mag nooit iets sluiten
wat open stond.*

**ADAPT-03 — Personalisatie is nooit een voorwaarde.** Er is geen route die de
intake afdwingt en geen antwoord dat een andere functie opent of sluit. Wie hem
overslaat houdt exact het huis dat hij had. Personalisatie die je moet ondergaan
om normaal te kunnen werken, is een tolpoort.
*Handhaver: `test/neiging.test.js` en `test/neiging.e2e.js`.*

**ADAPT-04 — Wat het lid zei vervalt niet vanzelf; wat RTG raadde wel.**
*Handhaver: `test/neiging.test.js`, met een mutatie gezien zakken.*

**ADAPT-05 — Deze laag beslist niet wat er op een scherm komt.** De volgorde van
kaarten blijft van `kern/experience/projections.js`. Zou deze laag die overnemen,
dan zeggen twee lagen iets over hetzelfde en lopen ze uiteen (`BESTUUR.md`: de
laag die iets toont, meet het niet).
*Handhaver: de bedrading — deze laag krijgt de kern niet mee en kan er niet bij.*

**ADAPT-06 — Een neiging verlaat het huis nooit.** Geen `delen`, geen
`adverteren`, geen kantoorroute. Delen met een zaak loopt langs `zorgMee()`, dat
al een reden en een intrekbaar spoor eist.
*Handhaver: `test/neiging.test.js` (de gesloten doellijst weigert), en de
afwezigheid van een route.*

**ADAPT-07 — Het lid ziet alles, ook wat niet meer meetelt.** Een geheugenkaart
die alleen het geldige toont, verzwijgt wat er is opgeslagen — en klopt dan precies
op het moment dat iemand hem controleert. Wat stil staat, staat er mét de reden.
*Handhaver: `test/neiging.test.js`.*

---

## 6. Wat er met opzet niet is: de groepsuitkomst

Het voorstel vraagt om *"Onze RTG"*: vier gezinsleden willen eten, RTG rekent
"Italiaans past bij 4/4" zonder hun profielen aan elkaar bloot te geven.

De onderbouw ligt er en is goed: `kern/levensband/` kent banden die **beide
kanten hebben bevestigd**, en `inzage.js` weet per STUK wat de ander mag zien. De
rekensom zelf is er niet, en hij is niet te maken zonder een besluit dat nog niet
is genomen: **wat mag een deelnemer uit de uitslag afleiden?**

Vier mensen en een uitkomst *"één persoon heeft een dieetwens"* is een
profieluitdraai met een omweg — bij vier mensen is dat vaak genoeg te herleiden.
Dat is geen implementatiedetail maar de hele vraag. Daarom staat hier een
afwezigheid met een reden, en geen lege functie.

---

## 7. Wat het bouwen blootlegde

Zes dingen die geen enkele bestaande toets zag, en die je nergens anders moet
herhalen. De eerste is de duurste, en hij gaat over deze meter zelf.

**De naammeting gaf een naam vrij die niet vrij was, en twee bestaande toetsen
zijn daardoor overschreven.** De eerste versie las alleen `server/kern` en drie
broers — de bronnenlijst van `scripts/objectmodel.js`. Voor een VORMmeting klopt
die zeef (een scherm heeft daar niets te zoeken); voor een NAAM niet. `adaptief`
kwam er als enige vrije naam uit, en de hele laag is zo gedoopt. In werkelijkheid
draagt `ADAPTIEF.md` een bestaande laag van **95 bestanden**, met
`public/shared/adaptief/` (elf modules), een eigen stylesheet, en —
`test/adaptief.test.js` en `test/adaptief.e2e.js`. Die twee zijn bij het bouwen
prompt overschreven, en niets klaagde: de nieuwe toetsen stonden groen, de oude
waren weg.

Dat is precies `BEWIJSMACHINE.md` par. 6a: *een proef kan een geldige uitslag
geven en toch het verkeerde experiment zijn uitgevoerd.* De uitslag "0 bestanden"
was waar binnen zijn eigen zeef en onwaar over het huis. Drie dingen zijn
gerepareerd, en alle drie horen ze hier te blijven staan: de meter leest nu de
hele boom, `vrij` betekent **nergens genoemd** (de oude marge van twee bestanden
was precies groot genoeg om een laag te missen), en de laag heet `neiging`.

*De les generaliseert: een zeef die je overneemt van een andere meting, neem je
over mét zijn aannames. `BRONNEN` in objectmodel.js is een antwoord op de vraag
"waar wonen domeinvormen", niet op "waar kan een naam bezet zijn".*


**De openingsvraag bleef eeuwig terugkomen — want niet kiezen is ook een
antwoord.** De eerste vraagmotor rekende winst alleen uit gekozen onderwerpen.
Wie "reizen" en "eten" aantikte liet vijf opties liggen, en die vijf droegen samen
nog winst 5: acht keer dezelfde vraag, en geen enkele vervolgvraag. De rekensom
klopte en het gedrag was onzinnig. Wie sport níét aantikt, heeft gezegd dat sport
het niet is — en zonder dat is er geen intake die ooit eindigt. Gevonden door hem
te draaien, niet door hem te lezen.

**Een tweede identiek antwoord werd geboekt als een tweede gebeurtenis.** Een
dubbelklik op "Verder" hoogde de teller van een `gezegd` neiging op. Voor
`gekozen` en `afgeleid` is tellen juist de bedoeling — de teller ís het verschil
tussen `vermoed` en `gemeten` — maar voor `gezegd` betekent hij niets en doet hij
wel kwaad. **Twee keer hetzelfde zeggen is een uitspraak; twee keer hetzelfde doen
zijn twee keren.**

**De eerste idempotentiemeting mat niets, en zag er geslaagd uit.** Hij las
`db.json` uit de testmap en meldde voor alle zeven routes "er verandert niets" —
ook voor de route die aantoonbaar schrijft. De opslag is SQLite; dat bestand
bestond niet, dus de lezer gaf zeven keer dezelfde foutstring en de vergelijking
was altijd waar. Daarom staat er nu een **besturingsproef** naast: de eerste
aanroep van een schrijfroute móét het beeld veranderen. Zonder die tweede helft is
"de tweede veranderde niets" geen bevinding maar een blinde vlek
(`BEWIJSMACHINE.md` par. 6a).

**Een bestemming wees naar dode tekst terwijl er een adres bestond — en alleen
een browser kon dat zien.** De server geeft aan het eind van de intake een lijst
SLEUTELS, en het scherm zoekt daar een naam en een adres bij in
`sprongindex.json`. Dat deed het met *wie het eerst komt wint* — en `reizen` staat
twee keer in die index: eerst als **tab** (zonder url) en daarna als **link** naar
`/apps/reizen-veilig.html`. Het lid zag dus grijze tekst waar een knop hoorde,
terwijl elke servertoets groen stond: de route gaf keurig `["reizen","stad"]`
terug.

Twee dingen zitten eronder. Een `sleutel` in de sprongindex is **niet uniek**, dus
"zoek hem op" is een lossy aanname; de keuze is nu inhoudelijk (een rij mét adres
verslaat een rij zonder) in plaats van op volgorde — dezelfde fout die
`KAARTEN.md` bij `gebiedkeuze.js` beschrijft, waar de sortering iets besliste waar
zij niets van wist. En de index werd **asynchroon** geladen terwijl de slotkaart
al kon tekenen: een wedloop die zich als "soms werkt het" voordoet.
`test/neiging-scherm.e2e.js` bewaakt nu beide, en vergelijkt met wat de SERVER
zegt in plaats van met een getal.

En de reparatie vond er meteen **vijf meer**, die de browsertoets zelf niet zag
omdat hij toevallig langs `reizen`/`stad` liep — twee bestemmingen die wél een
eigen url hebben. `werk`, `bestellen`, `salon`, `videobellen` en `zorg` zijn een
**tab** of een **os-app**: die wonen ín de leden-app en hebben geen eigen adres.
Ze stonden alle vijf als dode tekst op het slotscherm. De vorm om ze te openen
bestond al en staat in `public/shared/sprong.js`
(`/apps/app.html#tab=<sleutel>`); het scherm neemt die nu over in plaats van er
een tweede te verzinnen, en `controle()` in de laag kent het verschil tussen
*bestaat* en *is te adresseren*. Een toets die één pad loopt, bewijst dat pad —
en een pad kiezen dat toevallig de makkelijke helft raakt, is hoe dit soort
gebreken blijft staan.

**`public/apps/app-main.js` is bouwuitvoer.** De eerste registratie van het scherm
ging naar het gebundelde bestand in plaats van naar
`public/apps/app-main/app-main-23a.js` en `-24a2.js`. De index bleef stil op 114
bestemmingen staan — geen fout, geen waarschuwing, alleen een scherm dat nergens
vandaan bereikbaar was. Een zichtbare ingang naar een onbereikbare functie is een
productdefect (`BETROUWBAARHEID.md`); een onzichtbare ingang is er ook een.

---

## 8. Waar het staat

| onderdeel | bestand |
|---|---|
| de meting | `scripts/neigingvorm.js`, `NEIGINGVORM.json`, `npm run neigingvorm` |
| de ladder | `server/kern/neiging/ladder.js` |
| de besluiten (doelen, kring, termijn, uitlegteksten) | `server/kern/neiging/besluiten.js` |
| de opslag (bak, actor, schoonmaak) | `server/kern/neiging/opslag.js` |
| onthouden en lezen | `server/kern/neiging/bewaren.js` |
| wat het lid met zijn geheugen doet | `server/kern/neiging/beheer.js` |
| de vragenlijst | `server/kern/neiging/vraag-lijst.js` |
| de vraagmotor | `server/kern/neiging/vraag.js` |
| de geheugenkaart | `server/kern/neiging/geheugen.js` |
| de laag zelf | `server/kern/neiging/index.js` |
| de routes | `server/routes/neiging.js` |
| het scherm | `public/apps/mijn-neigingen.html` ("Mijn neigingen") |
| de contracten | `server/lib/mutatiecontracten-neiging.js` |
| de toetsen | `test/neiging.test.js`, `test/neiging.e2e.js`, `test/neiging-scherm.e2e.js` |
| de boardroomschakelaar | `server/functies/register/cat-leden.js` (`neiging`) |
| de ratels en hun ijking | `NORM.json`, `scripts/lib/metingen.js`, `test/meterijk.test.js` |

> Niet te verwarren met **`ADAPTIEF.md`** en `public/shared/adaptief/`: die laag
> gaat over de VORM waarin een capability verschijnt (bureau, tablet, telefoon,
> stem). Deze gaat over de MENS. Zie par. 7 voor wat het kostte om dat verschil
> te leren.
