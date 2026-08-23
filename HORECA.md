# RTG Service Choreography OS

*Het diepte-document van de horecakant. Lees dit vóór je aan een horecascherm,
een keukenlaag of de PDA werkt. `CLAUDE.md` gaat over het merk, `LAT.md` over de
code, `ONTWERP.md` over de vorm — dit gaat over wat de horeca eigenlijk is.*

## De kern in één zin

**Een kassa registreert wat besteld is; RTG regisseert wat er nú moet gebeuren
om de hele tafel op het juiste moment een goede ervaring te geven.**

Dat is geen slogan maar een architectuurbesluit met gevolgen. Een systeem dat
registreert, heeft een order nodig. Een systeem dat regisseert, heeft een
*beloofd moment* nodig en rekent daar vanaf terug. Alles hieronder volgt uit dat
verschil.

## Wat dit NIET is

Geen mooiere KDS. Toast, Square en Lightspeed routeren tickets, tonen timers en
sturen wijzigingen realtime naar een keukenscherm; Oracle verbindt kassa,
voorraad, personeel en loyalty; SevenRooms bouwt gastprofielen. Op die lijst
winnen we niet, en we hoeven er ook niet op te staan. `MARKT.md` zegt het al
eerlijk: RTG wint niet op features maar op prijs, op één systeem in plaats van
vier, en op het eigen bestelkanaal tegen vaste prijs. **Dit document voegt daar
de enige categorie aan toe waarop we wél kunnen winnen: de choreografie van
gast, mens, keuken, bar, geld, veiligheid en tijd als één stroom.**

En het is uitdrukkelijk geen zesde losse app. Zie `PLATFORM.md`: samenvoegen is
stap één, niet de bedoeling. Dit is één capability met zes projecties.

## De zes werkstanden

Eén servicestroom, zes vensters erop. Iedereen ziet dezelfde order; alleen de
informatie en de acties die bij zijn rol horen.

| Werkstand | Gebruiker | De centrale vraag |
|---|---|---|
| **TAFEL** | gast | Wat kan ik kiezen, en wat gebeurt er nu? |
| **PDA SERVICE** | bediening, runner, host | Wat is mijn eerstvolgende handeling? |
| **VLOER** | maître, wijkhoofd | Wie heeft ons nú nodig, en hoe verdelen we dat? |
| **VUUR** | keuken | Wat moet op welk moment klaar zijn? |
| **BAR** | barteam | Welke drankgolf moet nu gemaakt worden? |
| **REGIE** | manager, expo | Waar breekt de belofte, en wat is de veiligste ingreep? |

**De PDA is de belangrijkste van de zes, en niet de kleinste.** De vaste
schermen informeren en regisseren; op de PDA wordt de service werkelijk
uitgevoerd — ontvangen, opnemen, gangen sturen, ophalen, oplossen, afrekenen.
Zonder PDA is dit een slim dashboardsysteem. Mét PDA is het een gesloten keten.
Een PDA is dus geen kleine kassa met diepere menu's, maar een persoonlijke
servicecockpit die drie dingen weet: waar deze medewerker verantwoordelijk voor
is, wat nú de belangrijkste actie is, en welke informatie nodig is om die actie
veilig af te ronden.

## Eén gedeelde werkelijkheid

Alle kanalen — kassa, tafel, QR, bar, terras, club, afhaal, bezorging, hotel,
roomservice, event, polsband, online — komen in één operationeel model:

```
bezoek → gezelschap → gast/stoel → bestelling → gang → gerecht/drank
       → bereidingsstappen → station → pass → runner → uitserveren
       → betaling → bewijs
```

Een bestelling is daarmee niet langer alleen een ticket. Het systeem kent ook:
voor wie, op welke stoel, bij welke gang, wanneer de gast het verwacht, wat er
tegelijk moet landen, welke stations eraan werken, welke allergenen gelden,
welke voorraadbatch gebruikt is, wie verantwoordelijk is, en hoe er betaald
wordt.

### Welke schakels er vandaag al zijn — en welke niet

Dit is geen wenslijst; het meeste staat er. Gemeten op 23 augustus 2026 tegen
`server/routes/supplier/horeca/` (92 endpoints) en `server/kern/horeca/`.

| Schakel | Stand | Waar |
|---|---|---|
| bezoek | **staat**, als `rekening` met `kanaal` en `geopendAt` | `kern/horeca.js` |
| gezelschap | **staat**, als `rekening.deelnemers` | `kern/horeca/gezelschap.js` |
| gast/stoel | **staat**, als `deelnemer.nr` ↔ `regel.gastNr` | idem, plus `kern/gast/sessie.js` |
| bestelling → gang | **staat**, met `gang/vrij` als expliciete vrijgave | `horeca/rekening.js` |
| bereidingsstappen | **half**: één norm per gerecht, geen stappen | `keukenlaag.js` |
| station | **staat** | `keuken/bord` |
| pass | **staat**, met claim per gang; geeft niets automatisch uit | `kern/horeca/pas.js` |
| runner | **half**: de claim staat, de rol nog niet | `kern/horeca/pas.js` |
| uitserveren | **staat** als stand `uitgegeven` | `keuken/stand` |
| betaling | **staat**, dertien wijzen, splitsen tot op de cent | `horeca/betalen.js` |
| bewijs | **half**: bon en logboek wel, action receipt niet | `horeca/bonnen.js` |

**De stoel was het ontbrekende scharnier — en hij bleek al te bestaan.** Bij het
bouwen ervan kwam iets anders boven tafel dan verwacht: een rekening kende al
`deelnemers` (nr, handle, lid, leeftijd) en een regel kende al `gastNr`, en
`kern/gast/verdeling.js` splitste daar al mee, inclusief de fles wijn die op
niemands naam staat. Wat ontbrak was niet het model maar **de tweede deur**: je
kwam er uitsluitend bij door zelf de QR te scannen. Wie de bestelling liet
opnemen door de gastvrouw — dus de meerderheid — zat aan een tafel zonder
stoelen.

`kern/horeca/gezelschap.js` is die deur, op dezelfde data. Drie dingen liggen
daar vast, en alle drie komen ze uit een toets die eerst zakte:

- **Een stoel is geen sessie.** Een stoel die de bediening aanmaakt krijgt nooit
  de `hash` waarmee een gastsessie zich legitimeert. Zonder die grens is "voeg
  een stoel toe" een achterdeur naar een vreemde rekening.
- **Een nummer wordt nooit hergebruikt**, ook niet als er iemand is opgestaan —
  daarvoor houdt de rekening een teller bij. Een bon die bij de pas "stoel 2"
  zegt, mag na een wisseling niet naar iemand anders wijzen. De `handle` draagt
  de betekenis ("bij het raam", "de jarige"), het nummer de identiteit.
- **Een stoel weghalen haalt nooit geld weg.** De regels vallen terug op de
  tafel, worden geteld en gemeld. En de invariant wordt hard getoetst: na
  afloop wijst geen enkele regel meer naar een stoel die niet bestaat.

## Wat er al staat en niet opnieuw gebouwd moet worden

Deze lijst bestaat omdat de grootste kostenpost bij een herontwerp is dat iemand
iets bouwt dat er al is:

- **De rekening is al één waarheid over alle kanalen.** `routes/gast.js` zegt
  het met zoveel woorden: de rekening waarop een gast via QR bestelt, is
  dezelfde rij die de bediening op haar scherm ziet. Er is geen tweede
  orderstaat, en die mag er ook niet komen.
- **Gangregie bestaat al.** Een regel draagt zijn gang; de zaal geeft een gang
  vrij; de keuken ziet niets van een gang die nog niet vrij is. Dat is de kiem
  van choreografie en hij is getoetst (`test/horeca-keuken.test.js`).
- **De drukterem toont zijn rekensom en sluit niets.** `openWerk()` in
  `kern/horeca/keukenlaag.js`: openstaande bereidingsminuten gedeeld door het
  aantal koks, navertelbaar, besluit bij de chef.
- **Splitsen en samenvoegen zijn verplaatsingen**, exact tot op de cent, ook bij
  10,00 door drie (`test/horeca-rekening.test.js`).
- **De offline-wachtrij is er aan de serverkant** en is idempotent op
  `clientId` — `POST /api/supplier/horeca/offline/sync`. Er is alleen nog geen
  enkele client die hem gebruikt. De KASSA heeft er sinds 23 augustus 2026 wel
  een (`apps/kassa/wachtrij.js`, op `pos/sale`); de zaal en de bar niet, want
  een rekening leeft over vele aanroepen en dat is meer dan opnieuw versturen.
- **De duwstroom draait**: elke standwijziging stuurt
  `sseToSupplier(code, 'sync', { scope: 'keuken' })` over `/api/supplier/stream`.
  VUUR, de zaal en de pas luisteren mee via `RTGHoreca.luister()`, met een trage
  terugval eronder — een keuken die stilstaat is erger dan een die traag is. De
  overige horecaschermen hangen er nog niet aan.
- **Servicegolf, guest recovery, dish twin, spatial venue, folio, event,
  polsband, HACCP, bezorgzone** — allemaal aanwezig met endpoint en scherm.
- **114 talen** staan in `public/shared/i18n.js`.
- **Een gastprofiel bewaart voorkeuren en géén waarde-per-gast**, en dat is een
  toets en geen belofte (`test/horeca-vloer.test.js`).
- **De werklijst van de PDA is er** (`kern/horeca/werklijst.js`,
  `/apps/horeca-pda.html`): wat is mijn eerstvolgende handeling, geordend op
  minuten over een grens die het huis zelf al had vastgelegd. Zie punt 4
  hieronder voor wat er wel en niet in zit.

## Wat er nieuw moet, in volgorde

**0. Eerst leesbaar en levend, dan pas slim.** *Gedaan.* Op 23 augustus 2026
gemeten op `/apps/horeca.html`: 73% van de zichtbare tekstelementen stond onder
12px, 39% onder 8px, de kleinste tekst was 5px, en 66–70% van de raakvlakken was
lager dan 44px. Het keukenbord ververste zichzelf niet — na twintig seconden met
een nieuw vrijgegeven gerecht stond het er nog niet op. Er valt niets te
choreograferen op een scherm dat een kok niet kan lezen en dat stilstaat.

De hele schil staat nu op de ondergrens uit *Vorm per werkplek* hieronder: 61
lettermaten in `horeca-command.css` opgehoogd van 5–11px naar 12–14px (plus 8 in
`horeca-enterprise-modules.css`), en elk raakvlak minstens 44px. Op dezelfde
schermen, met een echte dienst erin:

| Werkstand | kleinste tekst | onder 12px | raakvlakken onder 44px |
|---|---|---|---|
| VUUR | 5px → **11px** | 39% → **6%** | 66% → **0 van 27** |
| ZAAL / VLOER | 8px → **11px** | 73% → **10%** | 32 van 32 → **0 van 32** |
| journey-toren | 5px → **12px** | 64% → **0%** | — |
| spatial command | 5px → **12px** | 90% → **0%** | 3 van 9 → **0 van 9** |

En tien grijstinten die tussen 2,48:1 en 4,55:1 stonden, zijn opgehoogd tot
minstens 4,6:1 — gerekend tegen `#111`, de lichtste ondoorzichtige grond in de
schil. De eerste poging rekende tegen de donkerste grond en liet er zes staan op
4,36. De merkkleur `--burgundy-on-dark` is niet aangeraakt: die draagt hier een
rand en geen tekst.

  **Wat hier eerst ten onrechte stond, en waarom het hier blijft staan.** Deze
  regel meldde ook dat één tik op een bon de scrollpositie 5.182 pixels weggooit
  doordat het hele bord opnieuw wordt getekend. Dat is bij nameting onjuist
  gebleken: die verschuiving was de `scrollIntoView` van het meetscript zelf, en
  onder een zuivere meting schuift zowel de oude als de nieuwe versie 0 pixels —
  Chrome verankert de scroll zelf bij een DOM-wissel. Het bon-voor-bon bijwerken
  is er toch gekomen, maar op een ander argument: sinds het bord zichzelf
  ververst, zou een volledige `innerHTML`-wissel tachtig DOM-knopen slopen en
  herbouwen bij elke tik van elke collega. De les hoort erbij: een getal uit een
  meetscript is pas een feit als het script zelf ook is nagerekend.

**1. Cadans: terugrekenen vanaf het serveermoment.** Vandaag rekent de keuken
vooruit ("deze bon loopt 14 van 12 minuten"). Choreografie rekent terug: doel
19:42 → entrecote starten 19:26, zeebaars 19:31, risotto 19:32, passcontrole
19:40. Dit is de kleinste verandering die het verschil tussen registreren en
regisseren echt maakt, en hij kan bovenop `bereidingsMinuten()` zonder één
bestaand veld te breken.

**2. Stoel en gezelschap.** *Gedaan.* De bediening zet stoelen aan tafel, wijst
regels toe of terug naar de tafel, en de stoel reist mee tot op de bon bij de
pas — de runner leest een naam, geen nummer. De gastendeur en de bedieningsdeur
komen op dezelfde `deelnemers` uit; wie via de QR aanschuift staat op het
zaalscherm, en wat de bediening op zijn naam zet ziet hij op zijn telefoon.
**2b. De verdeling deelt nu één rekensom.** *Gedaan.* Die stond in
`kern/gast/verdeling.js` en was daarmee alleen bereikbaar voor wie zelf de QR
scande; de bediening had één knop (`perPersoon: n` — door drieën en klaar)
terwijl de gast op zijn telefoon al per product, per persoon of op percentage
kon verdelen. Eén tafel, twee antwoorden op "wie betaalt wat". De rekensom staat
nu in `kern/horeca/verdeling.js` en beide deuren gebruiken hem; een toets legt
de twee antwoorden naast elkaar en eist dat ze identiek zijn.

Wat daarbij uit elkaar is gehaald en uit elkaar moet blijven:

- **Splitsen** (`horeca/schuif.js`) knipt één rekening in twee rekeningen — de
  tafel gaat uit elkaar. **Verdelen** laat het er één en spreekt alleen af wie
  welk deel betaalt. Twee handelingen met bijna dezelfde naam; door elkaar halen
  levert een rekening op die twee keer bestaat. Beide blijven bestaan, want ze
  beantwoorden verschillende vragen.
- **Besteld** en **betaalt** zijn twee bedragen per stoel en staan allebei op
  het scherm, elk met hun eigen woord. Wie €46 bestelde kan €80,67 betalen omdat
  de fles voor de tafel over iedereen gaat. Dat door elkaar halen is precies
  waar een tafel ruzie over krijgt.
- **Het spoor draagt wie het deed.** Een verdeling van de bediening staat op
  haar naam en niet als "gast".

**3. Claim op uitgifte.** *Gedaan.* Een complete gang die bij de pas staat, is
een draagtaak met een mens eraan: oppakken, loslaten, overnemen, en de hele gang
in één tik uitgeven. Zonder die claim lopen er twee mensen naar tafel 8, of
geen — precies de fout die de gastverzoeken al eerder hebben opgelost, met
dezelfde twee knoppen. `kern/horeca/pas.js`, en op het scherm boven de
regielijst, want daar loopt de tijd doorheen: eten dat klaar staat wordt koud.

Vijf dingen liggen daar vast:

- **Alleen een complete gang staat op de pas.** Een halve gang is geen taak, en
  hem oppakken wordt geweigerd mét wat er nog in de keuken staat. Dat is de hele
  belofte van gangregie.
- **Een claim is van één mens.** De tweede hoort wie hem heeft en hoe lang al —
  de claim wordt nooit stilzwijgend afgepakt.
- **Claimen vinkt niets af.** De borden blijven op `klaar` tot een mens uitgeeft
  (grens 4 hieronder).
- **Overnemen is een eigen handeling**, met beide namen erin en in het logboek.
  Er staat géén tijdslimiet waarna het systeem een claim zelf laat vallen: dat
  zou een verzonnen getal zijn, en het zou de claim juist wegnemen wanneer het
  druk is. Wat er wél staat is hoe lang hij loopt — een feit waar een collega op
  mag handelen.
- **Loslaten kan alleen wat van jou is**, of door een manager die een tafel moet
  deblokkeren.

*Dat is inmiddels gedaan:* de bar heeft sinds 23 augustus 2026 een eigen
werkstand — zie punt 4b hieronder.

**3b. De rekening kan eindelijk ook terug.** *Gedaan.* Er waren achttien
endpoints zonder scherm; vijf daarvan heeft een bediening elk uur nodig, en het
scherpst was `rekening/regel/weg` — je kon iets op een rekening zetten en er
niets meer af halen. Nu staan `regel/weg`, `verplaats`, `voeg-samen`, `korting`,
`fooi` en `oninbaar` op het zaalscherm (`horeca/rekeningacties.js`), met de
regels van de kern zichtbaar in plaats van verborgen: korting vraagt zijn reden
vóóraf, fooi wordt nooit voorgevuld, samenvoegen zegt het bedrag hardop terug, en
oninbaar staat apart onderaan omdat het geen administratieve handeling is. Van
achttien naar twaalf endpoints zonder scherm.

**4. PDA SERVICE als eigen werkstand — af.**

`/apps/horeca-pda.html` beantwoordt de vraag van deze werkstand: *wat is mijn
eerstvolgende handeling?* Alle andere horecaschermen zijn per TAFEL of per
STATION geordend; dit is het enige dat per HANDELING is geordend, en dat is een
andere vraag — de stand is per tafel, de handeling is per mens.

**De hele kunst zit in de volgorde, en die is geen score.** Een lijst die
"urgentie 82" naast "urgentie 74" zet, verzint een weging tussen dingen die niet
in dezelfde eenheid staan — een mening die eruitziet als een meting (grens 7).
In plaats daarvan wordt elke taak vergeleken met een grens **die al bestond**:

| soort | grens | waar hij vandaan komt |
|---|---|---|
| verzoek | 3 tot 12 min, per soort | `SOORTEN[soort].oudNa` in `kern/gast/verzoek.js` |
| pas | 2 min | `PASMARGE` in `kern/horeca/cadans.js` |
| belofte | het serveermoment zelf | de afspraak met de gast |
| opnemen | **geen** | er is er nergens een |

De lijst is daarom **twee lijsten**, en dat is de belofte zelf. *Nu* bevat alleen
taken die over zo'n grens zijn, geordend op hoeveel minuten eroverheen — dus een
"er is iets niet goed" van tien minuten (grens 3) gaat vóór een "mag dit weg?"
van achttien (grens 12). *Ook open* bevat de rest, op minuten en zonder rangorde,
want daar is niets aan gemeten. Liever twee eerlijke lijsten dan één lijst met
een verzonnen getal erin.

De grenzen worden **geleend en niet nagemaakt**: een tweede tabel met dezelfde
getallen loopt uiteen op de dag dat iemand er een aanpast. `test/horeca-werklijst.test.js`
houdt dat vast, en ook dat er nergens een score op een taak of een telling per
medewerker staat (grenzen 5 en 7).

**De modus is een lens en geen recht.** Bediening, runner en alles filteren welke
soorten je ziet; ze veranderen niets aan wat je mag. Wie de PDA opent is al
ingelogd als medewerker van deze zaak, en daar zitten de rechten. Een modus die
iets zou afschermen, was een tweede rechtenmodel — precies wat `CONCERN.md`
verbiedt. Een onbekende modus valt daarom terug op *alles* en verbergt nooit
stilletjes werk.

**Er is geen wijk, en het scherm doet niet alsof.** Een sectie-indeling ("tafels
1 tot 8 zijn van Sanne") bestaat nergens in de data, dus toont de lijst de hele
zaak en zegt dat er ook bij. Wie hem per wijk wil, heeft eerst een wijk nodig —
dat is een ontwerpbesluit en geen veld. Datzelfde geldt voor de rolmodi *host* en
*wijkhoofd*: die vragen aankomst- en wijkgegevens, en zolang die er niet zijn,
komen ze er niet als lege knop bij.

**Twee vensters, één scherm.** De werklijst zegt WAT er moet gebeuren; de tafel
is waar het gebeurt. Ze wisselen elkaar af en staan niet naast elkaar: op een
telefoon in één hand is twee kolommen geen ontwerp maar een compromis. Daarmee
sluit de PDA de hele keten uit de brief — ontvangen, opnemen, gangen sturen,
ophalen, oplossen, afrekenen.

Vier dingen liggen in dat tweede venster vast:

- **De prijs komt van de kaart en niet van het scherm.** Elke bestelling gaat als
  `itemId` naar de server, die naam, prijs en station uit `kern/horeca/kaart.js`
  haalt — dezelfde kaart die de gast leest. Zou de PDA de prijs meesturen, dan
  bepaalt een telefoon wat een biertje kost. Vrij typen blijft kunnen: een
  special is echt werk, geen misbruik.
- **Uitverkocht wordt getoond en niet verborgen.** De gastdeur laat zulke items
  niet kiezen; de bediening hoort te zien dat iets op is en mag na overleg met de
  keuken alsnog aanslaan. Wegfilteren maakt van "op" een geheim.
- **De context wordt één keer gezet en daarna getikt.** Gang, stoel en allergie
  staan bóven de kaart, niet in een dialoog per gerecht. Wie voor elke tik drie
  schermen door moet, typt het straks op een blocnote — en dan weet het systeem
  niets meer.
- **Gang vrijgeven blijft een aparte handeling.** Er wordt niets automatisch
  doorgestuurd; de zaal bepaalt het tempo van het diner, de keuken dat van de
  bereiding.

**Splitsen en verdelen blijven op het zaalscherm.** Dat is een gesprek aan tafel
met meerdere mensen erbij, en dat hoort niet op een telefoon in een broekzak.

**De kaart is verhuisd naar de kern** (`kern/horeca/kaart.js`). Hij stond in
`routes/gast/tafel.js` en werd aan de kern gehangen; toen de bediening hem nodig
had, bleek hij aan de verkeerde kant van de domeingrens te staan. Niet de grens
opgerekt maar het begrip verplaatst: een kaart is een eigenschap van de ZAAK, en
beide deuren zijn lezers (`test/horeca-kaart.test.js`).

**4b. BAR als eigen werkstand — af.** Een drankgang was gewoon een gang met
station `bar`, dus stond hij tussen de gerechten op het keukenbord. Een barman
die soep op zijn bord ziet staan, gaat dat bord niet lezen.

**Een bar is geen keuken met andere gerechten.** Een keuken groepeert op GANG —
een gang gaat samen de deur uit. Een bar groepeert op twee assen tegelijk die
met elkaar vechten:

- **de ronde** — vier mensen proosten samen, dus een ronde moet samen landen;
- **de stapel** — drie gin-tonics over twee tafels zijn één handeling achter de
  bar: één keer de gin pakken, drie glazen naast elkaar.

`kern/horeca/bar.js` lost die botsing **niet** op met een algoritme, want dat zou
een volgorde verzinnen. Het toont ze allebei: de golven (per tafel, oudste eerst)
en de stapel (dezelfde drank over alle open golven, alleen wat nog gemaakt moet
worden). De barman ziet wat er moet en wat er samen kan, en beslist zelf —
dezelfde grens als de drukterem.

Wat er bewust **niet** in zit:

- **Geen grens op hoe lang een drankje mag staan.** IJs smelt en schuim zakt, dus
  die grens is echt — maar hij is nergens vastgelegd, en hem hier verzinnen zou
  een getal maken dat niemand gemeten heeft. Wat er wél staat is hoeveel minuten
  het eerste glas al op de rest van zijn ronde wacht (`staat`). Een complete
  ronde wacht op een drager en niet op zichzelf; die staat op de pas, zodat
  hetzelfde wachten nooit twee keer geteld wordt.
- **Geen alcoholcontrole.** De kaart weet welk item alcohol bevat, de regel niet;
  de leeftijdsregel woont in `kern/gast/beleid.js` en de controle aan tafel is een
  menselijke handeling. Een half vlaggetje op het barbord zou de indruk wekken
  dat de bar het bewaakt, en dat is erger dan niets.
- **Geen tweede orderstaat en geen tweede deur naar "klaar".** Aanzetten en klaar
  melden gaan over `/keuken/stand`, precies zoals bij de keuken.

Eén ding ging hier meteen mis en is de moeite waard om te onthouden: de teller
zei *"glazen te maken"* en telde **regels**. Een regel "2× gin-tonic" is één
regel en twee glazen. Een getal dat iets anders telt dan zijn label zegt, is
precies de fout die grens 7 verbiedt — en geen van de eerste toetsen zag het; de
browsertoets viel erover.

**5. Venue Edge**: de clientkant van offline. De serverkant ligt er, en de
kassa is de eerste die hem gebruikt — zie hieronder. De zaal, de bar en de PDA
volgen nog niet: die werken niet met één verzoek per handeling maar met een
rekening die over tientallen aanroepen leeft, en dan is opnieuw versturen niet
genoeg. Dat vraagt een lokale werkelijkheid die samengevoegd wordt, niet een rij.

**5a. De kassa zonder lijn — af.** Een bon die niet weg kon ging verloren; nu
staat hij in de wachtrij van dat toestel, zichtbaar in een strook boven het
werkvlak, en gaat hij vanzelf weg zodra de lijn terug is.

Het gevaarlijke deel zat niet in de wachtrij maar in de HERHALING, en dat is
eerst gerepareerd. `pos/sale` gaf de meegestuurde `idem`-sleutel alleen door aan
RTG Pay, en dan nog alleen bij method `rtgpay`: contant en pin kenden helemaal
geen herhaling. Twee keer versturen gaf twee bonnen, twee keer voorraadafboeking
en twee facturen. De kassa stuurde de sleutel al jaren mee en niemand keek ernaar.
Nu staat het HELE verzoek binnen `kern/kassa/herhaling.js`, op dezelfde
machinerie als het geld (`lib/idem.js`), inclusief de binding aan het verzoek:
dezelfde sleutel met een ander bedrag is een 409 en geen stille "gelukt".

Vier regels die de wachtrij dragen, elk met een mutatietoets erachter:

- **De sleutel wordt één keer gemaakt**, bij het afrekenen, en reist mee de rij
  in. Wie hem per poging ververst heeft geen vangnet maar een omzetverdubbelaar.
- **RTG Pay wacht nooit.** Contant ligt in de la en pin gaat buiten ons om; een
  betaalcode moet op het moment zelf gecontroleerd worden.
- **Een geweigerde bon loopt vast en gaat niet rond**, mét de reden in beeld.
  Een 502/503/504 van een tussenlaag telt daarbij als storing, niet als oordeel.
- **`at` blijft de tijd van aankomst.** Het moment van de kassa reist mee als
  `offlineVanaf` en staat op de bon, maar bepaalt niets — anders kiest een client
  op welke dag zijn omzet valt.
- **Een bon hoort bij de zaak waar hij is opgesteld.** De rij staat op het
  toestel, de zaak komt uit het token; wordt er tussendoor bij een andere zaak
  ingelogd, dan blijft de bon staan tot iemand weer bij de eigen zaak inlogt.

Bewezen in een echte browser (`test/kassawachtrij.e2e.js`), inclusief het geval
dat ertoe doet: het verzoek kwam aan, het antwoord verdween onderweg, de
wachtrij stuurde hem opnieuw — en er staat één bon.

**6. Action receipts en de rechtenlaag van Rahul.** Vandaag kent de horeca twee
rechten: `supplierAuth` en `managerOnly`. Dat is te grof voor wat hieronder
staat.

## De grenzen

*Zoals in elk diepte-document van dit huis: waar een functie botst met een
grens, vervalt de functie.*

1. **Generatieve AI bepaalt nooit of iets veilig is om te eten.** Allergenen,
   kruisbesmetting en dieet komen uit beheerde recept- en allergenendata, of ze
   komen er niet. Een model mag een concept opstellen; een mens bevestigt, en
   bij de pas een tweede keer. Spraak maakt een concept, nooit een verzonden
   handeling.
2. **Een gast is een codenaam.** Personalisatie loopt op de codenaam; de echte
   naam staat in de identiteitskluis (`server/accounts.js`). Geen labels als
   "grote spender", geen waarde-per-gast, geen scherm dat een mens rangschikt op
   wat hij uitgeeft. Dat is vandaag een toets en die blijft staan.
3. **Er komt geen ranglijst op medewerkers.** Een schenkafwijking is een signaal
   voor voorraad, training of materiaal — nooit een automatische beschuldiging
   en nooit een publieke score. Zelfde regel als de progressiegrens elders in
   dit huis: meten mag, afrekenen op mensen niet.
4. **Het systeem vinkt niets zelf af.** "Uitgegeven" is een handeling van een
   mens aan de pas. Een systeem dat zelf afvinkt, maakt van dat woord een lege
   huls. Staat al zo in `horeca/expeditie.js` en blijft zo.
5. **Geen betaling zonder bestaande menselijke controle.** De betaalgrens van
   `GELD.md` geldt hier onverkort: geld verlaat het huis nooit vanzelf.
6. **Een rem toont zijn rekensom en sluit niets.** De drukterem, het tijdslot,
   de bezorgzone: elk nee draagt zijn getal en zijn reden. Een rem die alleen
   "nee" zegt, stuurt de klant naar een ander.
7. **Wat niet gemeten is, wordt niet als getal getoond.** De journey-toren toonde
   een voortgangsring van 12/30/48/64/78% die uit een toestandslabel kwam; met
   zes tafels in beeld stond er zes keer 30%. Ernaast stond "course sync", een
   score van 0 tot 100 die via een verzonnen factor 8 uit een spreiding in
   minuten werd gerekend. Allebei weg. Er staat nu wat te tellen valt: hoeveel
   van de bestelde regels zijn uitgegeven (een breuk mét zijn noemer, en bij een
   tafel die niets bestelde een streepje in plaats van 0%), en hoeveel minuten de
   gerechten van een gang uit elkaar lopen. `test/horeca-journey.test.js` houdt
   het vast en weigert elk veld waarvan de naam op een score lijkt. Dezelfde eis
   geldt voor elke toekomstige "score" — en de gastkant (`kern/gast/order-beeld.js`,
   de servicebalk op `gast.html` en `bestellen.html`) draagt hem nog wél.
8. **Rush Mode mag nooit een veiligheidsgrendel verbergen.** Minder tonen
   betekent minder statistiek, minder instellingen, minder tekst — nooit minder
   allergie, minder bevestiging of minder noodbediening.
9. **Rahul verschijnt niet als chatvenster op elk scherm.** Drie vormen:
   voorspellen, adviseren, uitvoeren. Uitvoeren alleen binnen de rechtenlaag:
   laag risico automatisch en terugdraaibaar, middel bevestigt een medewerker,
   hoog vraagt een manager of vier ogen. Allergenen, voedselveiligheid,
   betalingen en arbeidsbesluiten zijn deterministisch en menselijk — nooit
   modelbesluiten.
10. **Elke uitgevoerde AI-actie draagt een bewijs**: wat is er veranderd,
    waarom, op basis van welke gegevens, wie mocht dit, welk effect werd
    verwacht, wat gebeurde er werkelijk, en kan het terug. Het patroon bestaat
    al in `server/kern/geldbeleid/actielog.js` en hoeft niet opnieuw bedacht.

## Vorm per werkplek

Eén stijl over alle zes werkstanden zou juist onprofessioneel zijn. Dezelfde
kern, ergonomie naar de werkplek — binnen de merkregels van `CLAUDE.md` en
`MATERIAAL.md`.

- **Gast (TAFEL)**: Pearl en Bordeaux, ruimte, rust, beeld uit De Salon.
- **Bediening en manager (PDA, VLOER, REGIE)**: Onyx, warme accenten, sterke
  hiërarchie, één-handbediening, informatie die geleidelijk verschijnt.
- **Keuken en bar (VUUR, BAR)**: maximaal functioneel contrast, grote letters en
  raakvlakken, kleur nooit als enige betekenis, handschoen- en vochtbestendig,
  automatische dag-, nacht- en rushweergave.

De harde ondergrenzen voor VUUR en BAR: **operationele tekst niet onder 13px,
bontekst niet onder 16px, elk raakvlak minstens 44px hoog.** WCAG 2.5.8 vraagt
24px; dat is de wet, niet de maat voor een natte vinger tijdens de spits.

## De meetlat

Niet vergelijken op het aantal functies, maar op de uitkomst van een echte
service. Draai dezelfde piekavond twee keer — gelijk menu, gelijke
bestellingen, gelijke bezetting, dezelfde storingen, dezelfde personeelssterkte
— één keer met het huidige scherm en één keer met de choreografielaag.

| Meetpunt | De lat |
|---|---|
| verloren orders bij netwerkverlies | 0 |
| dubbele financiële boekingen na herstel | 0 |
| onbevestigde allergiewijzigingen | 0 |
| kritieke AI-acties zonder geldig bewijs | 0 |
| bedieningshandelingen per bestelling | aantoonbaar lager dan nu |
| tijd tot eerste drank | per servicetype bewaakt |
| spreiding tussen gerechten van dezelfde gang | structureel kleiner |
| beloofde versus werkelijke gereedtijd | meetbare nauwkeurigheid |
| remakes en misroutes | meetbaar lager |
| dubbel geclaimde uitgiftes | 0 |
| herstelproeven offline→online | 100% gereconcilieerd |
| statische "enterprise"-beloften | 0 |

De laatste regel is de belangrijkste. Dit document is pas waar wanneer er een
meting naast staat, en tot die tijd is het een plan.

## De echte wauw

Voor de gast: *"Ze wisten wat wij nodig hadden, zonder dat het onpersoonlijk of
opdringerig werd."*
Voor de medewerker: *"Het scherm vertelde niet alles wat er gebeurde — alleen
wat ik nú moest doen."*
Voor de chef: *"De keuken werkte als één team, ook toen alle kanalen tegelijk
binnenkwamen."*
Voor de eigenaar: *"Ik zag een probleem ontstaan, kon de oplossing simuleren, en
kon achteraf precies bewijzen wat er is besloten."*
