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
| 2. Human Control | `kern/consent.js` (+ dekkingsregister met eigen toets, en sinds 2 sep 2026 doel en termijn per venster), `public/apps/toestemming.html` (wat er openstaat én wie er keek), `kern/rtgid-regie.js` (inzagelog, `namens`, herroepbare machtiging), `kern/rtgid.js` (claim zonder gegeven) | **staat; RTG iD nog één attribuut breed** |
| 3. Safety | `server/kern/beschermzaak/` (de eigen dataklasse, sinds 2 sep 2026), `server/kern/veiligheid/` (de persoonlijke laag: dodemansknop, stil codewoord, kring — zie par. 7.2), `kern/rtfos/meldcode.js`, `kern/zorgniveau.js` | **staat** |
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

### Laag 2 — Human Control · **staat**
De consent graph van punt 21 is `kern/consent.js` met `LAGEN` en `NIET_GEDEKT`,
en de toets `test/consent-dekking.test.js` bewaakt al dat elke gedekte laag
werkelijk intrekt (heen én terug). Doel en termijn per venster staan er sinds
par. 7.6, en het scherm "wie weet wat over mij" bestond al
(`public/apps/toestemming.html`) — met beide helften: wat er openstaat, en wie
er heeft gekeken.

Wat hier nog OPEN staat: RTG iD deelt vandaag één attribuut (18-plus als claim
zonder geboortedatum). Once-only (punt 20) is de volgende stap en is een besluit
en geen bouwwerk: feiten één keer verifiëren, per gebruik toestemming, minimaal
delen — dat vraagt dat een tweede instantie een bestaand bewijs mag hergebruiken,
en dat is een afspraak met die instantie voordat het code is.

### Laag 3 — Safety · **staat, met twee open randen**
Dit was bij het schrijven van dit document het grootste gat: de woorden
*uitbuiting, mensenhandel, seksueel geweld, stalking* en *dakloos* kwamen in de
hele codebase niet voor, en `casus.SOORTEN` had geen categorie veiligheid. Dat
was geen ontbrekend label maar een ontbrekende KETEN: de casusketen wil koppelen
aan een lokale partner en zet bij afronding een bewaartermijn van 730 dagen, en
bij een geweldszaak zijn dat allebei risico's in plaats van functies.

`server/kern/beschermzaak/` is die keten, als eigen dataklasse (par. 7.2), met de
voordeur ervoor (par. 7.3). De meldcode draagt sinds par. 7.5 het afwegingskader
van stap 5 en zegt waarvoor hij is; wat er niet onder valt wordt naar de
beschermzaak gewezen in plaats van stil geaccepteerd. De persoonlijke laag
(`kern/veiligheid/`) is verbonden in par. 7.4.

De weg terug staat sinds par. 7.8: een beschermzaak die tijdens het werk toch
huiselijk geweld blijkt te zijn, wordt met een handeling een meldcode-dossier --
en alleen de codenaam reist mee.

Wat op deze laag nog OPEN staat, en eerlijk benoemd: de meldcode blijft een
instrument voor professionals achter de kantoordeur. Een mens die zelf zorgen
heeft over iemand anders, kan langs de voordeur wel een beschermzaak beginnen
maar geen meldcode-traject in gang zetten -- en dat hoort ook niet, want de vijf
stappen zijn beroepsstappen.

### Laag 4 — Recovery · **staat als registratie, mist het traject**
Wonen, recht, gezondheid en inkomen zijn er als casussoorten. Wat er niet is, is
het besef dat ze op elkaar wachten. Dat is laag 5 en niet laag 4.

### Laag 5 — Development · **de graaf staat, de motor niet**
*(De Advocate leest sinds par. 7.7 ook de aflopende toestemmingen mee; de motor
uit punt 13 -- de constraint solver -- staat er nog steeds niet.)*
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
| 1 | **Uitstapknop, neutrale titel, geen voorvertoning** over de Foundation-schermen, plus het eerlijke scherm over wat we niet kunnen verbergen | maakt al het volgende pas veilig; belooft niets wat niet waar is (5.7) | **staat** (2 sep 2026) |
| 2 | **Hulpwijzer verbreden**: categorie "onveilig, misbruikt of uitgebuit", met de gespecialiseerde instanties erbij | pure tekst, geen gegevens, geen keten — en vandaag het enige wat een slachtoffer aan deze app heeft | **staat** (2 sep 2026) |
| 3 | **De eigen keten** — veiligheid → minimale gegevens → toestemming → stabilisatie → gecontroleerde overdracht, als eigen dataklasse (5.2) | het gat dat par. 4 laag 3 beschrijft | **staat** als `server/kern/beschermzaak/` (2 sep 2026) |
| 4 | **De voordeur**: zelfingang zonder account, zonder BSN, zonder adres; eerst "ben je nu veilig" en "kan iemand meekijken" | keert de huidige richting om (office maakt casus → burger krijgt code) | **staat** (2 sep 2026) |
| 4b | **De persoonlijke veiligheidslaag verbinden** — `kern/veiligheid/` (dodemansknop, stil codewoord, kring, laatste plek) bestaat en is vanaf de Foundation-kant onzichtbaar | zie par. 7.2: gebouwd, eerlijk, en op de verkeerde plek voor de mens uit par. 0 | **staat** (2 sep 2026) |
| 5 | **Meldcode**: het afwegingskader van stap 5, en zeggen waarvoor hij is | zie par. 7.5 -- de vraag bleek een andere dan hij hier stond | **staat** (2 sep 2026) |
| 6 | **Consent: doel en termijn per venster** | het scherm bestond al; zie par. 7.6 | **staat** (2 sep 2026) |
| 7 | **De Advocate als lezer** op `levensgraaf/termijnen.js` | alle waarde van punt 10 zonder de onbewezen helft (5.6) | **staat** (2 sep 2026) |
| 8 | **Constraint solver** met meerdere paden, aannames in de uitslag, `ONBEPAALD` waar niets gerekend is | het eerlijke nieuwe stuk software; `EXECUTIE.md` noemt de leemte al | maanden |
| 9 | **Human Services Protocol**: schemaregister op `kern/envelop.js` | pas zinvol als er iets is om te delen dat de moeite waard is | maanden |
| 10 | **Society Intelligence** op `livinglab/graden.js` | pas na 6 — een populatiemodel zonder consent-graaf is een dataverzameling met een grafiek erop | jaren |

Wat in deze volgorde opvalt: de eerste twee regels kosten samen twee dagen en
verzetten meer voor de mens uit de missie dan de zes eronder. Dat is geen
argument tegen de rest — het is het argument om ermee te beginnen.

### 7.1 Wat regel 1 en 2 aan het licht brachten

Drie dingen die pas zichtbaar werden door het te bouwen en in een browser te
bekijken, en die de volgorde hierboven bevestigen:

**De hulpwijzer zit zelf achter de inlog.** `hulpwijzer` staat in
`BESCHERMDE_APPS` (`public/apps/foundation/sessie.js`), dus wie geen
gezinsaccount heeft krijgt de deur van `shared/deur.js` en niet de lijst. Het
verbreden van de hulpwijzer bereikt daarmee alleen wie al lid is. Daarom is het
nieuwe scherm `onveilig.html` er BUITEN gezet: geen `sessie.js`, geen
sessie-eis, en in de browser gemeten dat hij zonder inlog volledig laadt. Dat
maakt regel 4 (de voordeur) niet minder nodig — het maakt hem concreter: wat
`onveilig.html` nu is voor lezen, moet die voordeur worden voor handelen.

**De RTG-schil maakte de neutrale titel waardeloos.** `shared/randen.js` laadt
de edge-schil, en die zet bovenin het pad van de app: "RTFOUNDATION /
WEGWIJZER". Een neutrale `<title>` heeft dan geen betekenis meer, want wie
meekijkt leest de merknaam gewoon in de schil. `onveilig.html` laadt die laag
daarom met opzet niet, en dat staat als reden in het bestand — anders zet de
volgende die de pagina "consistent" maakt hem terug.

**Een pagina in delen knippen botst met een noodlijst.** `shared/deelmenu.js`
verdeelt een lange pagina over een keuzemenu. Op deze pagina zou 112 daarmee
achter een knop komen. De laag wordt hier dus niet geladen, en de eerder
bedachte `rtgdeel-vast`-markering is weggehaald in plaats van decoratief blijven
staan: een klas die niets afdwingt omdat zijn laag niet draait, leest als een
garantie die er niet is.

### 7.8 De weg terug, en waarom hij in de route staat

Par. 7.5 liet dit als het open gat achter: een beschermzaak die tijdens het werk
toch huiselijk geweld blijkt te zijn, moest met de hand een meldcode-dossier
worden. `POST /api/rtfos/bescherming/meldcode` doet dat nu, met drie grendels:

- **de AARD komt uit de zaak, niet uit het verzoek.** `kindveiligheid` wordt
  kindermishandeling, `huiselijk-geweld` en `eergerelateerd` worden huiselijk
  geweld, en de rest wordt niets. Een uitbuitingszaak kan er dus niet als
  "huiselijk geweld" doorheen, ook niet als de aanroeper dat meestuurt.
- **er reist een codenaam mee en verder niets.** Geen omschrijving, geen
  veiligheidsantwoord, geen toestemming, geen overdrachtenlijst. Dat is dezelfde
  regel die de meldcode al had voor de hulpvraag, en hij geldt hier onverkort.
- **de zaak onthoudt alleen het ID.** Wie het dossier wil lezen, opent het daar,
  en dat laat zijn eigen spoor na.

**En de brug staat in de ROUTE, niet in een van de twee modules.** Dat is geen
plaatsingsvraag maar het bewaren van twee zinnen die allebei waar moeten blijven:
`kern/beschermzaak/` is de enige die in de beschermzaken schrijft, en
`kern/rtfos/meldcode.js` is de enige die meldcode-dossiers maakt. Zou een van
beide de ander aanroepen, dan is een van die twee niet meer waar. In de route
zijn ze allebei bereikbaar zonder dat een van beide de ander hoeft te laden, en
`test/beschermzaak.test.js` toets 17 houdt vast dat er geen `require` tussen de
twee kanten ontstaat.

Er is met opzet **geen weg terug van de weg terug**: een meldcode wordt geen
beschermzaak. De vijf stappen hebben een wettelijke grond, en ze omzetten zou
betekenen dat een lopende meldcode kan verdwijnen in een dossier met een kortere
bewaartermijn.

De volgorde binnen de route is ook een besluit: eerst het dossier, dan de
notitie terug. Mislukt de notitie, dan is er een meldcode zonder verwijzing --
hinderlijk. Andersom zou er een verwijzing staan naar een dossier dat niet
bestaat, en dat is erger. Het antwoord zegt het als de notitie niet lukte.

### 7.7 Regel 7: de Advocate leest, en één poort is omgezet

**De lezer bestond al voor het grootste deel.** `routes/member/vooruit.js` geeft
de Control Tower aan ELK lid, ook een gratis account en een gast: achterstallig,
deze week, deze maand, dit kwartaal, dit jaar. Punt 10 van het voorstel ("je
schuldhulpdocument is incompleet", "je toestemming voor instantie X verloopt
volgende week") is dus geen nieuwe app maar een ontbrekende BRON.

Die bron staat er nu: `kern/levensgraaf/bronnen-toestemming.js`. Een toestemming
met een einddatum wordt een termijn, en daarmee komt "uw machtiging aan Zeearend
1193 verloopt over vijf dagen" in hetzelfde overzicht als een paspoort dat
afloopt. Dat kon pas sinds par. 7.6: vóór die ronde wist het Consent Center niet
welke vensters een datum hadden.

Twee dingen die de vorm bepalen:

- **er wordt geen datum verzonnen.** Vijf van de negen lagen lopen door tot u ze
  stopt; die worden geen termijn. Twee grendels dekken elkaar daar, en dat is
  geen dubbeling: een laag die zich `venster` noemt zonder datum, en een laag met
  een datum die zich niet zo noemt, zijn allebei fout en worden allebei
  geweigerd.
- **de knoop verlaat de kring van het lid nooit.** `deel: 'lid'` en
  `gevoelig: BESLOTEN`, want de NAAM van de ontvanger staat erin -- een concierge
  die leest "Huisartsenpraktijk De Linden, loopt af op de 14e" weet genoeg. "Een
  datum zonder naam" is hier geen troost, want de naam is het punt.

**En een poort is omgezet.** Toen de toets voor die derde zin eerst de kringnaam
`'bureau'` gebruikte, kreeg hij het volledige ledenbeeld terug -- inclusief de
BESLOTEN knopen. `'bureau'` staat niet in `KRING` (dat zijn `lid`, `rechterhand`
en `kantoor`), en de terugval bij een onbekende naam was `KRING.lid`: de RUIMSTE
stand. Op een poort is dat de verkeerde richting.

Nagemeten was er **geen lek**: de enige aanroeper die een kring meegeeft is
`routes/member/bureau.js`, met `'lid'` -- het lid dat zijn eigen graaf opvraagt.
De acht `voor('bureau')`-aanroepen die de grep opleverde zitten op
`kern/levensdossier`, een andere functie. Dat is nagelopen vóór er iets werd
beweerd, en het staat hier omdat een bijna-melding net zo goed opgeschreven hoort
te worden als een echte.

De terugval staat nu op `KRING.kantoor`, de verste kijker. Een typefout of een
hernoemde kring levert daarmee een LEGE graaf op, en dat valt op; het
omgekeerde viel niet op.

### 7.6 Regel 6, en de derde meetfout van deze reeks

**Het scherm bestond al.** `public/apps/toestemming.html` toont wat er openstaat
én wie er heeft gekeken, met een uitgeschreven reden waarom dat twee lijsten zijn
en niet één ("door elkaar gehaald ziet een afgeronde inzage eruit als een
openstaande toegang"). Ik had het gemist omdat ik greppte op `api/consent`
terwijl de route `/api/toestemming` heet, en ik heb het bestand daarna bijna
overschreven met een eigen versie die minder deed. Dat is in deze reeks de derde
keer dat een grep op de verkeerde naam tot "bestaat niet" leidde; de andere twee
staan in par. 7.1 en 7.4. **De les is niet "beter greppen" maar: een conclusie
dat iets ONTBREEKT is pas een meting als er ook op de andere naam is gezocht.**

**Wat er wel ontbrak, en gemeten is.** Per toestemming stond er wie en wat, maar
niet WAARVOOR -- en doelbinding is de kern van toestemming; een lijst zonder doel
is een inventaris. En de termijn was bij **vijf van de negen lagen** een kale
`tot: null`, die twee verschillende dingen betekende:

> "loopt door tot u hem stopt" (met opzet geen einddatum)
> "deze laag houdt geen datum bij" (een gat)

Op het scherm lazen die identiek, en erger: de regel verdween helemaal, want hij
stond onder `t.tot ? ... : ''`. Een venster waar niets bij staat leest als "dat
loopt wel af", en dat is het tegenovergestelde van waar. Dat is precies wat
`KOSTEN.md` verbiedt (nooit een getal waar er geen is) en wat `rapport.js`
oplost met `gemeten: false` in plaats van nette nullen.

Nu draagt elke laag in `kern/consent-register.js` een `doel` en een `termijn` met
twee standen (`venster` met datum, `zolang-het-staat` met een uitgeschreven
reden), en het scherm toont de termijn **altijd**. Er is met opzet geen derde
stand "onbekend": alle negen lagen zijn nagelopen, en een restpost is binnen een
jaar de plek waar een nieuwe laag stil in verdwijnt.

Eén vorm van schijnzekerheid is toegevoegd in plaats van weggepoetst: een laag
die zich `venster` noemt en geen datum meestuurt, krijgt de stand
`venster-zonder-datum` met de tekst dat dit gemeld hoort te worden. Dat is een
fout in de laag, geen stand op het scherm.

**Wat NIET mis bleek**, en dat is ook gemeten: alle vier de lagen met een
einddatum filteren verlopen vensters bij de bron. Er wordt nergens een dicht
venster als open getoond.

### 7.5 Regel 5 bleek een andere vraag, en een echte fout

**De vraag zoals hij hierboven stond was verkeerd.** "Meldcode verbreden naar
volwassen slachtoffers" gaat uit van de aanname dat de meldcode alleen over
kinderen gaat. Dat klopt niet: de wettelijke meldcode dekt *huiselijk geweld en
kindermishandeling*, en huiselijk geweld is niet leeftijdsgebonden --
partnergeweld, ouderenmishandeling en eergerelateerd geweld vallen eronder. In
de code stond ook nergens een leeftijdsgrens. Een volwassen slachtoffer van
huiselijk geweld paste er dus altijd al in, en "verbreden" zou de reikwijdte van
een wettelijk instrument hebben opgerekt op grond van een misvatting van mij.

**Wat er wél mis was, is ernstiger.** De meldcode vraagt sinds 2019 in stap 5 een
afwegingskader met TWEE beslissingen, in volgorde: is melden noodzakelijk, en is
hulp verlenen of organiseren (ook) mogelijk. En de regel die het geheel draagt:
**melden is altijd noodzakelijk bij acute of structurele onveiligheid, ook als
hulp mogelijk is.**

`meldcode.js` kende stap 5 als één keuze uit vier gelijkwaardige opties. Daarmee
kon een medewerker `hulp_georganiseerd` kiezen terwijl hij bij stap 4 acute
onveiligheid had vastgesteld, en niets hield hem tegen. Dat is precies de
uitkomst die het afwegingskader onmogelijk wil maken: hulp organiseren komt
ernaast en niet in de plaats. Een lijstje met vier gelijkwaardige opties
suggereert een keuze waar de wet er geen laat.

Wat er nu staat (`kern/rtfos/meldcode-afweging.js`):

- **stap 4 vraagt twee harde antwoorden** -- acute onveiligheid ja/nee,
  structurele onveiligheid ja/nee. "Weet niet" bestaat niet en weegt als ja,
  dezelfde keuze als bij de veiligheidsvraag van de beschermzaak: een derde
  stand zou de grendel laten wegvallen op precies de dossiers waar hij het
  hardst nodig is;
- **stap 5 weigert** een besluit waarin melden wordt overgeslagen terwijl er
  acute of structurele onveiligheid is vastgesteld, met de reden erbij en met de
  aanwijzing dat een weging die niet meer klopt hoort te worden herzien -- niet
  de beslissing;
- **"hulp mogelijk" vraagt waarom die hulp tot DUURZAME veiligheid leidt.** Dat
  is het criterium dat in de praktijk wordt overgeslagen: er wordt iets geregeld,
  het is even rustig, en het dossier gaat dicht;
- **de uitkomst wordt AFGELEID** uit de twee beslissingen in plaats van apart
  gekozen. Twee plekken die hetzelfde zeggen lopen uiteen (LAT.md regel 4), en
  hier zou dat betekenen dat een dossier een uitkomst draagt die niet volgt uit
  de afweging eronder. Het sluiten neemt hem over en negeert een meegestuurde
  waarde.

**En de rails.** Een meldcode-dossier draagt nu een `aard` (`huiselijk-geweld`
of `kindermishandeling`), en wie iets anders opgeeft -- uitbuiting, mensenhandel,
een stalker buiten de huiselijke kring -- krijgt geen dossier maar de aanwijzing
naar de beschermzaak. Dat is geen "dit is niets voor u" (FOUNDATION.md par. 5.3):
het weigert niet de mens maar de verkeerde rails, en het noemt de goede.

Vijf mutaties, alle vijf raak op precies één bewering. De vijfde kostte een extra
toets: de afleiding zat eerst als losse assert onderaan de hulptoelichting-toets,
en dan liet een mutatie op `uitkomstVan()` die toets zakken -- de suite meet dan
de afleiding onder de verkeerde naam. Dat is LAT.md regel 9, en de reparatie is
een eigen toets over alle vier de combinaties.

### 7.4 Wat regel 4b opleverde, en een correctie op mezelf

**Eerst de correctie.** Par. 7.2 zei dat de vier schermen van RTG Veilig de
eerlijkheidszin niet toonden. Dat was fout, en de fout is leerzaam: ik had
gegrepen in `codewoord.html`, `thuiswacht.html`, `vitaal.html` en
`thuisrust.html`, en die vier zijn geen schermen meer maar **omleidingen** naar
`/apps/veilig.html` — vier standen van één app. De zin staat er wel degelijk, in
`public/shared/veiligheid.js`, op elke stand en niet weg te klikken. Een meting
op de verkeerde bestanden is geen meting.

**Wat er wél mis was, kwam daardoor boven.** De grensregel stond in **twee**
versies: de server gaf in `veiligBeeld()` een korte mee ("er wordt niemand
gebeld en er kijkt geen mens mee"), de clientlaag toonde een langere die er twee
dingen bij zei — geen hulpdienst, en zonder internet gaat er niets af. Allebei
waar, allebei anders, en niemand die merkte welke een lezer te zien kreeg. Dat is
LAT.md regel 4 op de gevaarlijkste soort tekst die dit huis heeft: **een belofte
over wat er niet gebeurt als het misgaat.**

De bron staat nu op één plek (`server/kern/veiligheid/grens.js`, vier zinnen over
wat er niet gebeurt plus de enige die zegt wat je wél kunt doen), en omdat een
browser dat bestand niet kan laden houdt `test/veiligheidgrens.test.js` de twee
kopieën eraan vast. Alle vier de mutaties bijten, en de derde is de leerzaamste:
een vijfde belofte aan de bron toevoegen laat alle drie de plekken zakken — een
nieuwe belofte moet overal langs.

**En de verbinding zelf.** `onveilig.html` noemt RTG Veilig nu, met wat het doet,
wat het kost en wat het niet is. Drie dingen die eerst gemeten zijn en niet
aangenomen:

- **het werkt echt.** Codewoord zetten, proef raak en mis, de stille `check` die
  `{ok:true}` teruggeeft zonder iets op het scherm te doen, en het alarm dat
  aantoonbaar naar één ontvanger ging;
- **het kost niets.** Een vers account zonder enige pas kan de hele laag
  gebruiken;
- **er is geen vriend voor nodig.** De kring accepteert een gewoon e-mailadres
  (`kring/mail`), dus wie niemand in De Salon heeft, kan hem toch vullen.

Wat de verbinding NIET is: een brug tussen de Foundation-sessie en het
RTG-account. Die twee blijven gescheiden, en dat is par. 5.1 — de veiligheidskant
en de rest van een mens reizen niet in één antwoord. Wie hier klikt, komt in de
ledenapp en logt daar in als hij dat wil.

### 7.3 Wat regel 4 opleverde: de deur die niets belooft

`server/kern/beschermzaak/voordeur.js` plus `wegwijzer.html`: vier routes zonder
inlog, zes toetsen, en de omkering is er — een zaak ontstaat nu ook zonder dat
er eerst een medewerker aan te pas komt.

**De gevaarlijkste fout was een knop bouwen die eruitziet alsof er hulp komt.**
Er zit hier niemand klaar. Elk antwoord van deze laag draagt daarom het veld
`nietsKlaar` met die mededeling én de nummers die wél dag en nacht opnemen, en
het scherm zet dat blok bovenaan en niet onderaan. Toets 9 houdt vast dat alle
drie de antwoorden dat veld dragen; hetzelfde als `kern/veiligheid/alarm.js`
over zichzelf zegt ("dit is geen alarmcentrale") en om dezelfde reden.

Drie keuzes die er anders uitzagen toen ze eenmaal gebouwd werden:

**RTG belt niet terug, en dat is de moeilijkste van de drie.** De klasse weigert
`telefoon` en `email`, dus de deur kan ze niet doorlaten — ook niet als iemand
hem later "even handig" wil maken. Een nummer dat wij bewaren is een telefoon
waarop wij bellen, en precies op het toestel waarvan de mens net zei dat er
iemand kan meekijken, is dat de gevaarlijkste handeling die er is. De mens houdt
zijn eigen code en komt terug. Dat is trager, en het is het enige wat waar te
maken is.

**De code is geen wachtwoord.** Wie hem heeft, kan de stand zien — dus geeft de
stand het minimum: of er iets is klaargezet, nooit wat, nooit de aanleiding.
Iemand die de telefoon van een ander doorzoekt en de code vindt, hoort er niets
uit te kunnen aflezen (toets 11).

**Geen plaats is geen deur.** Staat in geen enkele afdeling de module aan, dan
verdwijnt het formulier en staat er een nummer dat het wel oppakt. Iemand zijn
verhaal laten typen om het daarna te weigeren, is de wreedste vorm van een
kapotte pagina. Toets 13 bewaakt de serverkant daarvan, want een schermregel die
niemand afdwingt is geen grendel.

En een verschil dat het contractregister zichtbaar maakte: `deur/intrekken` geeft
bij een tweede oproep 200 met "dit was al ingetrokken" in plaats van een fout.
Dat is echte idempotentie en geen toestandscontrole — en het is een keuze over de
mens: wie twijfelt en nog een keer drukt, hoort geen foutmelding te krijgen op
het moment dat hij het al zwaar heeft.

### 7.2 Wat regel 3 opleverde, en de zesde laag die al bestond

**`server/kern/beschermzaak/` staat**: vier bestanden, negen routes, zeven
toetsen. De vier grendels van par. 5.2 zijn code en geen instelling — en het
verschil met een strenger afgestelde casus zit hierin dat de klasse **weigert in
plaats van filtert**: een aanroeper die `adres` meestuurt krijgt geen zaak zonder
adres maar geen zaak, met de reden erbij. Filteren is stil, en stil betekent dat
de volgende versie het veld gewoon bewaart.

Alle zeven beweringen zijn met een mutatie zien zakken (LAT.md regel 2), elk op
precies één toets. De duurste vondst zat in de derde: de overdrachtstoets sloeg
eerst AF omdat de route al op de KETEN weigerde, dus de toets keurde een
ketenfout goed terwijl hij dacht de ontvanger te toetsen. Dezelfde val als in
`test/rtfos.test.js`, en de reden dat de toets de zaak nu eerst netjes op
`overdracht` zet.

**En er bleek een zesde laag al te bestaan.** Par. 1 telde er vijf; het zijn er
zes. `server/kern/veiligheid/` is een werkende **persoonlijke** veiligheidslaag:
een dodemansknop waarvan de klok op de SERVER loopt (`wacht.js` — geen
levensteken is zelf het signaal), een **stil codewoord** dat je in een gewoon
gesprek laat vallen en waarna er op je scherm met opzet níéts gebeurt
(`codewoord.js`, bewaard als HMAC zodat wij de zin niet kunnen teruglezen), een
kring van codenamen (`kring.js`) en een laatst bekende plek zonder spoor
(`plek.js`). Met vier schermen in `public/apps/`.

Dat verandert twee dingen aan dit document:

- **Par. 5.7 was te streng gesteld.** "Duress mode wordt heel of niet gebouwd"
  blijft gelden voor een verborgen modus met een tweede pincode. Maar het stille
  codewoord ís al een dwangfunctie, en een eerlijke: hij belooft niets over de
  app-wisselaar of de geschiedenis, hij doet één ding en dat doet hij goed. Dat
  is precies de vorm die par. 5.7 zoekt. *(Nagemeten bij regel 4b: hij werkt ook
  echt, en hij kost niets. Zie par. 7.4.)*
- **Het staat op de verkeerde plek voor de missie.** Die laag zit in de
  RTG-ledenapp, achter een inlog, en is vanuit de Foundation-kant en vanaf
  `onveilig.html` onzichtbaar. Voor de mens uit par. 0 — die vaak géén RTG-account
  heeft — bestaat hij dus niet. Dat is geen bouwwerk maar een verbinding, en het
  hoort in de volgorde hierboven vóór regel 5.

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
