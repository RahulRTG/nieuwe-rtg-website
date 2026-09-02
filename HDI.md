# RTG Human Development Infrastructure

*Richtingsdocument, zoals `PLATFORM.md`, `ECONOMIE.md` en `DEVELOPERCLOUD.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt** of
**jaren weg** is — zodat niemand die vier voor elkaar aanziet.*

`FOUNDATION.md` beschrijft de RTFoundation als platform en blijft gelden.
`LEVEN.md` beschrijft de mens zelf en blijft onverkort gelden. Dit document doet
geen van beide over. Het beantwoordt één vraag die daar niet in staat: **wat komt
er bóven de organisatiesoftware te staan, zodat een mens niet uit beeld
verdwijnt?**

---

## 0. De kern, in een zin

**Niemand mag uit beeld verdwijnen omdat zorg, gemeente, woningcorporatie,
werkgever, politie, onderwijs en stichting ieder maar één stukje van die persoon
zien.**

En daaruit volgt de zin die de architectuur stuurt, en die het duurste besluit
van dit hele document bevat:

> De fundamentele eenheid is niet meer de casus, maar de mens — **en precies
> daarom mag die mens nergens als rij bestaan.**

Waarom die tweede helft er staat, is paragraaf 5.1. Wie hem overslaat bouwt in
zes maanden het gevaarlijkste bestand van Nederland.

---

## 1. Dit is geen groen veld, en dat is het belangrijkste feit hier

De acht voorgestelde lagen zijn niet acht keer nieuw werk. Gemeten in de code
van 2 september 2026:

| voorgestelde laag | wat er al staat | stand |
|---|---|---|
| 1. Foundation Operations | `server/kern/rtfos/` — 49 modules: casus, meldcode, veld, integriteit, vrijwilligers-VOG, voorraad, geld, subsidies, projecten, gemeenteportaal, rapport, blauwdrukken, risico, beleid, bestuur, jaarverslag | **staat** |
| 2. Human Control | `kern/consent.js` (+ dekkingsregister met eigen toets), `kern/rtgid-regie.js` (inzagelog, `namens`, herroepbare machtiging), `kern/rtgid.js` (claim zonder gegeven) | **staat, één attribuut breed** |
| 3. Safety | `kern/rtfos/meldcode.js` (alleen huiselijk geweld/kindermishandeling, alleen kantoorkant), `kern/zorgniveau.js` (crisis als codegrens), `kern/rtfos/casus.js` urgentie `acuut` | **een stap weg voor de meldcode, een besluit voor de rest** |
| 4. Recovery | `casus.SOORTEN` dekt huisvesting, schulden, werk, zorgdoorverwijzing, noodhulp; `kern/opvang.js` doet de asielketen; `kern/rtfos/voorraad*.js` de goederen | **staat als registratie, niet als traject** |
| 5. Development | `kern/levensgraaf/` (18+ bronnen, vijf etiketten per knoop), `kern/levenslijn/fasen.js` (fasen zonder voortgangsbalk), `kern/doelen.js` | **staat als graaf, mist de motor** |
| 6. Opportunity | vacatures, opleidingen, kinderopvang en woningen bestaan als losse domeinen; er is geen keten die ze aan elkaar rijgt | **een besluit** |
| 7. Federation | `kern/rtfos/netwerk.js` (blauwdrukken tussen steden), `kern/rtfos/steden.js`, `kern/envelop.js` (acht velden per bericht, ketenverwijzing) | **staat federatief, mist het protocol naar buiten** |
| 8. Society Intelligence | `kern/livinglab/` — 21 modules met `graden.js` als causale rem, `bewijs.js`, `ethiek.js`, `cyclus.js`; `kern/rtfos/rapport.js` telt zonder te lezen | **staat als onderzoekscyclus, mist de populatiekant** |

Drie daarvan verdienen een aparte vermelding, omdat ze het voorgestelde werk niet
alleen dekken maar het al **beter oplossen dan het voorstel**:

**`kern/levensgraaf/graaf.js` is de Human Development Graph, en hij is een
PROJECTIE.** Hij slaat niets op: hij leest de apps die de waarheid beheren en
bouwt de knopen elke keer opnieuw. Wat hij toevoegt zijn vijf etiketten per stuk
informatie — `bron`, `eigenaar`, `deel`, `gevoelig` (0 open … 3 besloten) en
`vervalt` — en `deel` is geen etiket maar een POORT waar `graafVoor()` op
filtert. Dat is exact het `ProtectedLocation`-idee uit je punt 4, alleen
algemener en al gebouwd. Een opvangadres is in dit model geen nieuw datatype maar
een knoop met `gevoelig: BESLOTEN` en een leeg `deel`.

**`kern/livinglab/graden.js` is de Causal Evidence Engine.** Drie plafonds en het
laagste wint: wat er ligt, wat de methode kan dragen, en wat er tegenover staat.
Alleen een vergelijkende opzet kan `bewezen` dragen; zonder plan is het plafond
`waarneming`. Het bestand raakt geen opslag aan, juist zodat het zonder database
te toetsen is. Punt 30 en 31 hoeven niet gebouwd te worden — ze moeten worden
AANGESLOTEN.

**`kern/rtfos/gemeente.js` is de Outcomes Ledger in het klein.** Het portaal
roept `cijfersVan` aan en heeft eenvoudigweg geen toegang tot casusdossiers; er
is geen vinkje dat het aanzet. Buurten onder vijf hulpvragen worden samengevoegd.
Punt 29 is dat principe opschalen, niet uitvinden.

---

## 2. Vier namen zijn al bezet, en dat is gemeten en niet gevoeld

`SEMANTIEK.json`: van de <!--getal:semantiek.namen-->111<!--/getal--> namen die in
meer dan één domein staan, dragen er <!--getal:semantiek.betekenissen-->94<!--/getal-->
meer dan één betekenis. `SOORTEN` staat op 45. Dat is de prijskaart waar elk nieuw
kernbegrip langs moet.

Vier woorden uit het voorstel staan er al op, en drie ervan zijn de duurste soort
botsing — hetzelfde woord, andere macht:

| voorgesteld | al bezet door | wat er misgaat |
|---|---|---|
| **Capability** (`human/capabilities/`, skills met bewijsniveaus) | `OS.md`: *capability* = platformvermogen (mag deze aanroep?), *genre-cap* = domeinvermogen | Dit wordt de derde betekenis. Precies de `VERMOGENS`-fout uit `OS.md`: twee bestanden met hetzelfde woord en nul gedeelde leden. **Voorstel: `vaardigheid`.** |
| **Wallet** (`Human Wallet`, credentials) | `WAARDE.md`/`TOKEN.md`: wallet = geld, met `WALLET_SALDO` als bevoegdheid en een plafond dat een grond is | Een wallet die soms geld en soms een diploma draagt, laat de vraag "mag dit eruit?" twee antwoorden hebben. **Voorstel: `kluis` bestaat al (`accounts.js`) — dit is de `bewijsmap`.** |
| **NIVEAUS** (`bescherming/*niveau.js`, vijf uitkomsten) | draagt in deze code al **9** betekenissen | Zie 5.3: de vijf-tredige uitkomst is een goed idee dat onder deze naam onvindbaar wordt. |
| **FASEN** (`levensfase.js`) | draagt al **8** betekenissen, waaronder `kern/levenslijn/fasen.js` — dat precies dit doet | Niet hernoemen: **hergebruiken**. Er hoort geen tweede levensfase-lijst te komen. |

En één woord dat het voorstel goed kiest en dat ik zou vasthouden: **`human/` en
niet `slachtoffer/` of `client/`.** Iemand is niet zijn probleem, en een map
draagt dat over aan iedereen die er tien jaar lang in werkt.

---

## 3. Het werkwoord van deze laag

`FOUNDATION.md` par. 2: *openen en klaarzetten — bevestigen doet de mens.*
`LIFE.md`: *samenstellen en klaarzetten.* `REIZEN.md`: *vóór zijn.*

Deze laag voegt er één toe, en het is het werkwoord dat het verschil maakt tussen
hulpverlening en infrastructuur:

### Het werkwoord wordt: **in beeld houden. Handelen doet de mens, of niemand.**

"In beeld houden" is niet volgen. Het verschil is wie het beeld bezit:

- **volgen** = de organisatie houdt bij waar iemand is, en de persoon merkt dat
  niet;
- **in beeld houden** = de persoon houdt zijn eigen beeld bij elkaar, en geeft
  per instantie, per doel en per termijn een venster — precies wat
  `kern/consent.js` en `graafVoor()` al doen.

Wie deze twee door elkaar haalt, bouwt punt 16 (Development Autopilot) als
surveillance. De toets is simpel en hoort in elke module van deze laag te staan:
**kan de persoon dit uitzetten zonder iemand te bellen?** Kan hij dat niet, dan
is het volgen.

---

## 4. De acht lagen, per laag de stand

### Laag 1 — Foundation Operations · **staat**
`server/kern/rtfos/` verandert van positie, niet van inhoud. Wel één correctie:
het heet nu de institutionele kant, en dat betekent dat er geen burgeringang
doorheen wordt getrokken. Van de 154 rtfos-routes staan er 140 achter
`officeAuth` — alle zes de casusroutes daarbij — en de veertien die dat niet doen
zijn de code-deuren (vrijwilliger, hulpvrager) en de buurtpagina's. Dat blijft zo:
de voordeur van punt 4 in par. 7 komt ernáást en niet erdoorheen.

### Laag 2 — Human Control · **staat, moet breder**
De consent graph van punt 21 is `kern/consent.js` met `LAGEN` en `NIET_GEDEKT`,
en de toets `test/consent-dekking.test.js` bewaakt al dat elke gedekte laag
werkelijk intrekt (heen én terug). Wat ontbreekt is **doel en termijn per
venster** als eersteklas velden, en het scherm "wie weet wat over mij".
Once-only (punt 20) is hier hetzelfde besluit: feiten één keer verifiëren, per
gebruik toestemming, minimaal delen. **Een stap weg.**

### Laag 3 — Safety · **het echte gat, en het eerste werk**
Zie paragraaf 6 voor de volgorde. Kort: `meldcode.js` dekt huiselijk geweld en
kindermishandeling, professioneel en kantoorzijdig. De woorden *uitbuiting,
mensenhandel, seksueel geweld, stalking* en *dakloos* komen in de hele codebase
niet voor. `casus.SOORTEN` heeft geen categorie veiligheid — en dat is geen
ontbrekend label maar een ontbrekende KETEN: de bestaande keten wil koppelen aan
een lokale partner en zet bij afronding een bewaartermijn van 730 dagen. Bij een
geweldszaak zijn dat allebei risico's in plaats van functies.

### Laag 4 — Recovery · **staat als registratie, mist het traject**
Wonen, recht, gezondheid en inkomen zijn er als casussoorten. Wat er niet is, is
het besef dat ze op elkaar wachten. Dat is laag 5 en niet laag 4.

### Laag 5 — Development · **de graaf staat, de motor niet**
De Human Development Graph is `kern/levensgraaf/`. De **constraint solver** van
punt 13 is er niet, en dat is geen omissie maar een gemeten feit dat al
opgeschreven staat: `EXECUTIE.md` noemt hardop dat er GEEN constraint solver is
en dat `kern/agent.js` op weekdagfactoren roostert — een heuristiek. Dit is dus
het eerlijkste nieuwe stuk software in het hele voorstel. **Een besluit** (zie
5.5 voor de grens eromheen).

### Laag 6 — Opportunity · **een besluit**
De opportunity chain (opleiding → kinderopvang → vervoer → stage → werkgever) is
de eerste plek waar deze laag geld en instanties van derden raakt. `COMMERCE.md`
par. 3 en `APPSTORE.md` grens 5 gelden hier onverkort: alles wat een derde raakt
is maximaal klaarzetten.

### Laag 7 — Federation · **staat lokaal, mist het protocol**
Blauwdrukken tussen steden werken al, inclusief de regel dat een overgenomen
blauwdruk bij "idee" begint en zijn eigen goedkeuring loopt. Het Human Services
Protocol van punt 23 is de buitenkant daarvan. `kern/envelop.js` heeft de vorm al
— acht velden, keten, classificatie — en `OS.md` zegt er de beperking bij: **de
envelop zegt met opzet nooit WAT.** Een schemaregister (`human.safety.escalated`
met een vorm erachter) bestaat niet. Dat is het werk.

### Laag 8 — Society Intelligence · **de rem staat, het model niet**
`livinglab/graden.js` en `rtfos/rapport.js` doen de eerlijke helft. De Society
Twin (punt 32) en het National Command Center (punt 33) zijn **jaren weg**, en
paragraaf 5.6 zegt waarom dat geen tempo-uitspraak is maar een volgorde-uitspraak.

---

## 5. DE GRENZEN. Dit deel weegt zwaarder dan par. 1–4

`LEVEN.md` par. 2 en `FOUNDATION.md` par. 5 gelden onverkort en worden hier niet
herhaald. Wat hieronder staat is wat DEZE laag toevoegt, en elke regel komt uit
een botsing met een besluit dat hier al genomen is.

### 5.1 De mens bestaat, maar nergens als rij

Dit is de grens waar het hele project op staat of valt.

`FOUNDATION.md` par. 5.6 verbiedt een misbruikgraaf die over codenamen heen
kijkt. `CLAUDE.md` zegt dat klantdata op codenamen draait en dat dat ontwerp niet
wordt omzeild. `casus.js` heeft met opzet geen veld voor gezondheid, geloof,
schulden-in-detail of gezinssamenstelling — *"wat er geen veld voor is, komt ook
niet in een export, een rapportage of een gemeenteportaal terecht."*

Een `human/`-kern die veiligheid, rechten, doelen, ontwikkeling én geschiedenis
van één mens bij elkaar brengt, is per constructie het bestand waar al die
grenzen tegen beschermden. En het is niet theoretisch: `scripts/afleidbaar.js`
meet al hoeveel stappen een codenaam van een harde identificator af staat, en
vond er zes die er RECHTSTREEKS naast staan.

**De uitweg is niet minder ambitie maar de vorm die `graaf.js` al heeft
gevonden:**

> `human/` KRIJGT GEEN OPSLAG. Het is een projectie over lagen die de waarheid
> zelf beheren, opgebouwd per aanroep, gefilterd op wie kijkt — precies zoals
> `graafVoor()`. Er komt geen `humans`-tabel, geen `humanId` in een tweede
> domein, en geen enkele route die "alles over deze mens" teruggeeft zonder dat
> de mens zelf die aanroep doet.

Twee handhavingen die hierbij horen en die moeten kunnen zakken:
- `scripts/afleidbaar.js` draait over de nieuwe laag, en een pad dat korter wordt
  is rood — niet een waarschuwing;
- er is geen route waarin de VELDEN van laag 3 (safety) en laag 5 (development)
  in één antwoord samen reizen. Dat is de koppeling die een dossier van een
  slachtoffer in een re-integratie-export laat belanden.

### 5.2 Veiligheidsgegevens zijn een andere dataklasse, niet een gevoeliger veld

Een safety-case krijgt géén: automatische partnerkoppeling, gewoon adresveld,
standaard export, standaard bewaartermijn, gewone notificatie, gewone
zoekfunctie, gewone analytics. Dat is niet strenger afstellen — het is een
andere klasse, en de code hoort te WEIGEREN in plaats van te filteren. Het model
staat er: `gevoelig: BESLOTEN` in `levensgraaf/hulp.js` zet het bereik hoe dan
ook op het lid, ongeacht wat de aanroeper vraagt.

### 5.3 De vijf-tredige uitkomst is goed, en mag geen zesde gezagsschaal worden

`MAG` / `MAG_MET_TOESTEMMING` / `MAG_MET_MENSELIJKE_REVIEW` / `MAG_ALLEEN_NOOD` /
`MAG_NIET` is een betere formulering dan wat we hebben. Maar
`scripts/gezagsnoemer.js` registreert al **vijf** gezagsvocabulaires plus 22
losse niveaunamen, en `EXECUTIE.md` zegt dat de eerste opdracht semantische
consolidatie is en geen featurewerk. `CONTROLPLANE.md` heeft er al acht
uitkomsten waarin `ONBEKEND` met opzet géén synoniem van `WEIGEREN` is.

**Dus: deze trap wordt in de bestaande noemer verklaard, niet ernaast gezet.**
Een nieuwe schaal die niet in `gezagsnoemer.js` kan worden opgenomen, is de
zesde schaal en hoort er niet te komen.

### 5.4 De meeteenheid is nooit de mens

Punt 38 stelt "Sustainable Human Progress" voor als hoogste maatstaf. Als
COHORTMAAT is dat precies goed, en het corrigeert een echte fout in de sector.
Als getal PER PERSOON is het verboden, en niet een beetje:

- `LEVEN.md` par. 2.4: geen ranglijst, geen percentiel, geen cijfer dat mensen
  rangschikt, nooit invoer voor toegang, prijs, voorrang of aanname;
- `FOUNDATION.md` par. 5.4: de meeteenheid van een capaciteitsmotor is de TAAK
  en nooit de mens;
- `ONTMOETEN.md` par. 4: geen cijfer op een mens, **ook niet intern als
  sorteersleutel**;
- `levensgraaf/bronnen-leven-bijdrage.js` staat er al: *"hier staat nooit een
  som, en dat is de hele module"* — met de redenering erbij dat een optelsom twee
  schermen verder "u gaf minder dan gemiddeld" is en daarna een voorwaarde.

De maat mag dus bestaan over een cohort, met zijn noemer erbij, en `rapport.js`
laat al zien hoe: `gemeten: false` in plaats van nette nullen. **Op een persoon
komt hij niet, ook niet verstopt als volgorde van een wachtlijst.**

### 5.5 Een solver rekent paden uit; hij kiest er nooit een

De constraint solver van punt 13 is welkom, met drie voorwaarden die het verschil
zijn tussen gereedschap en orakel:

1. **Hij toont altijd meer dan één pad**, en de persoon kiest. Eén uitkomst is
   een besluit dat zich voordoet als een berekening.
2. **Zijn aannames staan in de uitslag**, zoals `command/transactie-poorten.js`
   dat al doet bij simulatie. Een pad zonder zijn aannames is niet na te rekenen
   en dus niet te weerleggen.
3. **Een pad dat niet is doorgerekend heet `ONBEPAALD` en geen nul.**
   `KOSTEN.md`: er staat nooit een getal waar er geen is.

En de scherpste, uit `FOUNDATION.md` par. 5.3: **een eligibility-motor mag alleen
tóevoegen.** De solver zegt nooit "dit is niets voor jou". Hij zegt wat er
bijkomt als een randvoorwaarde wegvalt — dat is hetzelfde rekenwerk met de
tegenovergestelde uitwerking op een mens.

### 5.6 De Personal AI Advocate staat op de zwakst bewezen laag van het huis

Dit is het beste idee in het voorstel en tegelijk het idee dat het langst moet
wachten, en de reden is een getal en geen gevoel.

`VERTROUWEN.json` staat op <!--getal:vertrouwen.bewezen-->0<!--/getal--> bewezen,
<!--getal:vertrouwen.geschorst-->0<!--/getal--> geschorst en
<!--getal:vertrouwen.routes-->4180<!--/getal--> verzwakt. De bewijspoort in
`kern/stuur/beleid.js` houdt vandaag dus niets tegen. `EXECUTIE.md` blok 4 meet
dat van 176 bereikbare paden er 96 een **onbekend** gevolg hebben — en "de proef
kwam er niet bij" is iets anders dan "er gebeurt niets".

Een Advocate die namens een mens in een geweldssituatie richting instanties
handelt, is de zwaarste denkbare aanroeper op die laag. `FABRIC.md` par. 5 geldt
onverkort: de AI kan nooit meer dan de persoon die hem iets vraagt, en wat een
tweede persoon bereikt bevestigt een mens.

**Wat wél nu kan, en veel waard is:** de Advocate als LEZER. Termijnen die
verlopen, een aanvraag die stilstaat, een toestemming die afloopt, een document
dat incompleet is. Dat is `levensgraaf/termijnen.js` met een andere stem, het
raakt niemand buiten de persoon zelf, en het is precies wat punt 10 belooft
zonder de helft die nog niet bewezen kan worden.

### 5.7 Duress mode wordt heel of niet gebouwd

Punt 8 zegt het zelf, en het is de enige plek in dit document waar ik zou zeggen:
niet beginnen tot de threat modelling er ligt. Een webapp kan de
app-switcher-thumbnail, de systeemnotificaties en de browsergeschiedenis van een
toestel niet garanderen. Een verborgen module die op één van die drie lekt, is
gevaarlijker dan geen verborgen module — want de persoon rekende erop.

**Wat er wél meteen kan en geen enkele belofte doet die niet waar is:** een
uitstapknop, een neutrale titel, geen voorvertoning in de deel-kaart, en een
scherm dat eerlijk uitlegt wat deze app op een meegekeken telefoon NIET kan
verbergen. Dat laatste hoort erbij. `TOEGANKELIJK.md` eindigt op dezelfde manier:
met wat er niet gemeten is.

---

## 6. Wat er bewust NIET komt

- **Geen `humans`-tabel.** Zie 5.1. Dit is de enige regel in dit document die
  geen uitzondering kent.
- **Geen individuele voorspelling.** Het voorstel sluit "voorspel wie crimineel
  wordt" zelf al uit, en dat is goed. Breder: geen risicoscore per persoon, in
  geen enkele laag, ook niet als tussenwaarde.
- **Geen tweede consent-knop.** `consent.js` bewaart niets en zet geen eigen
  vlaggetje om; een tweede plek die "mag dit nog" beantwoordt, is een tweede
  waarheid (LAT regel 4).
- **Geen tweede evidence-opslag.** `kern/bestanden-opslag.js`, `-poort.js`,
  `-delen.js`, `-vergeten.js`, `-stukken.js` en `drm.js` bestaan. De Evidence
  Vault van punt 9 is een KLASSE op die opslag, met hash en overdrachtsspoor —
  geen nieuwe bestandslaag.
- **Geen certificering die RTG zelf uitgeeft.** Punt 26 zegt het al: eerst
  publiceren, dan externe review. Een standaard waarvan de auteur ook de
  keurmeester is, is een folder. `APPSTORE.md`: de machinepoort keurt nooit goed.
- **Geen samengesteld voortgangscijfer op een dashboard.** `scripts/zekerheid.js`
  bestaat juist omdat losse eerlijke getallen samen een gevaarlijk gevoel geven.

---

## 7. De volgorde

De sprong van "software waarmee een foundation professioneel functioneert" naar
"software waarmee een mens zich jarenlang ontwikkelt" is de goede sprong. Hij
gaat alleen niet in die volgorde, want laag 5 op een ontbrekende laag 3 zetten
betekent dat we ontwikkelingspaden uitrekenen voor iemand die vannacht geen
veilige slaapplek heeft.

| # | wat | waarom nu | stand |
|---|---|---|---|
| 1 | **Uitstapknop, neutrale titel, geen voorvertoning** over de Foundation-schermen, plus het eerlijke scherm over wat we niet kunnen verbergen | maakt al het volgende pas veilig; belooft niets wat niet waar is (5.7) | een dag |
| 2 | **Hulpwijzer verbreden**: categorie "onveilig, misbruikt of uitgebuit", met de gespecialiseerde instanties erbij | pure tekst, geen gegevens, geen keten — en vandaag het enige wat een slachtoffer aan deze app heeft | een dag |
| 3 | **`kern/foundation/safety/`: de eigen keten** — veiligheid → minimale gegevens → toestemming → stabilisatie → gecontroleerde overdracht, als eigen dataklasse (5.2) | het gat dat par. 4 laag 3 beschrijft | weken |
| 4 | **De voordeur**: zelfingang zonder account, zonder BSN, zonder adres; eerst "ben je nu veilig" en "kan iemand meekijken" | keert de huidige richting om (office maakt casus → burger krijgt code) | weken |
| 5 | **Meldcode verbreden** naar volwassen slachtoffers buiten het gezin, of een tweede route ernaast | de vijf wettelijke stappen blijven; de reikwijdte niet | weken |
| 6 | **Consent: doel en termijn per venster** + het scherm "wie weet wat over mij" | laag 2 afmaken vóór er meer instanties bijkomen | weken |
| 7 | **De Advocate als lezer** op `levensgraaf/termijnen.js` | alle waarde van punt 10 zonder de onbewezen helft (5.6) | weken |
| 8 | **Constraint solver** met meerdere paden, aannames in de uitslag, `ONBEPAALD` waar niets gerekend is | het eerlijke nieuwe stuk software; `EXECUTIE.md` noemt de leemte al | maanden |
| 9 | **Human Services Protocol**: schemaregister op `kern/envelop.js` | pas zinvol als er iets is om te delen dat de moeite waard is | maanden |
| 10 | **Society Intelligence** op `livinglab/graden.js` | pas na 6 — een populatiemodel zonder consent-graaf is een dataverzameling met een grafiek erop | jaren |

Wat in deze volgorde opvalt: de eerste twee regels kosten samen twee dagen en
verzetten meer voor de mens uit de missie dan de zes eronder. Dat is geen
argument tegen de rest — het is het argument om ermee te beginnen.

---

## 8. Waar dit tegenover GovStack staat

Niet ertegenover. GovStack levert herbruikbare bouwblokken waarmee een overheid
digitale diensten bouwt. Deze laag doet iets wat GovStack niet probeert te zijn:
**de mensgerichte keten erboven, die een persoon van crisis naar duurzame
ontwikkeling begeleidt en die kan bewijzen dat hij dat doet.**

De interoperabele kant hoort daarom vanaf dag één in de vorm te zitten (laag 7,
en de EU-wallet-richting waar `kern/rtgid.js` met claim-zonder-gegeven al op
mikt), en niet als latere exportmodule.

Eén waarschuwing bij dat ambitieniveau, en hij komt uit `BEWIJSMACHINE.md`: een
register dat naast de code leeft, wordt binnen een jaar zelf de volgende
naambotsing. Een RTG Human Development Standard hoort te worden AFGELEID uit de
code, met bron én handhaver, zoals `WETTEN.json`. Anders is het over twee jaar
een document dat iets anders belooft dan de software doet — en dat is precies de
fout waarvoor de rest van dit huis zijn meters heeft gebouwd.
