# GEMEENSCHAP.md -- FoundationOS als Human & Social Infrastructure

Een richtingsdocument zoals `PLATFORM.md`, `ECONOMIE.md` en `HDI.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is. Aanleiding is het voorstel van de eigenaar (11 oktober 2026)
om FoundationOS te laten uitgroeien tot *"de sociale en maatschappelijke
infrastructuur van RTG: één platform waarmee mensen, gezinnen, vrienden, scholen,
verenigingen, buurten, religieuze gemeenschappen, bedrijven en maatschappelijke
organisaties elkaar kunnen vinden, communiceren, samenwerken, activiteiten
organiseren en elkaar ondersteunen."*

De naam van dit document volgt `SAMENLEVING.md` par. 9: daar is **Gemeenschap**
een van de RTF-functies (*fysieke plekken, vrijwilligers, lokale projecten,
mensen verbinden*). Dit document is die functie, uitgewerkt. Lees vóór dit
bestand `WERELDEN.md` (de contextvraag), `LIFE.md` (RTG Sociaal, het leven tussen
mensen), `FOUNDATION.md` (het werkwoord) en `CONNECT.md` (de kringladder).

Er is in deze ronde **niets aan de code of de productie veranderd**. Alles
hieronder is een voorstel met een volgorde; elke fase begint pas na een besluit
van de eigenaar.

**De eigenaar keurde de richting goed op 11 oktober 2026** en nam drie besluiten
(par. 7.1): het sociale leven blijft in LivingOS, Rahul stelt buiten de datingcontext
geen personen voor, en fase 0 begint -- meten en ontwerpen, zonder wijziging aan
productie.

---

## 0. De kern, in een zin -- en de verbetering op het voorstel

Het voorstel klopt in zijn doel en in zijn grenzen (geen sociaal krediet, geen
verborgen profilering, minderjarigen strenger, deelname vrijwillig, hergebruik
vóór nieuwbouw). Het klopt niet in zijn **vorm**: het tekent FoundationOS als de
plek waar het héle sociale leven woont. Dat botst met een besluit dat al genomen
is, en het zou elf werkende sociale apps naar een tweede ingang dwingen.

De kernzin, zoals de eigenaar hem op 11 oktober 2026 vaststelde:

> **FoundationOS organiseert maatschappelijke samenwerking zelf, op bestaande
> RTG-capabilities, zonder de sociale functies van LivingOS te dupliceren.**

Twee helften, en ze wegen even zwaar. **Zelf organiseren**: FoundationOS is geen
verzameling links naar andere apps en geen navigatielaag. Met de drager, het
verbond en het beraad (par. 3.2) kan een gemeenschap hier van begin tot eind
samenwerken. **Zonder dupliceren**: het sociale leven blijft waar de mens denkt
dat hij is (vrienden, daten en gezin in LivingOS, groepsreizen in TravelOS, werk
in WorkOS). FoundationOS gebruikt die functies voor maatschappelijke activiteiten
en bouwt ze niet opnieuw. Het is de verbindende infrastructuur, niet de eigenaar
van iedere sociale functie.

Drie gevolgen die het hele plan sturen:

1. **Eén infrastructuur, vier projecties.** Groepen, gesprekken, bijeenkomsten,
   toestemming en bewijs bestaan één keer (in Core en in de domeinen). Elke wereld
   toont ze in haar eigen context. Dat is exact de regel van `WERELDEN.md`: *de
   bouwer van een capability bepaalt niet in welke wereld hij hoort, de
   gebruikerscontext bepaalt dat.*
2. **Aansluiten, niet uitvinden.** Van de twaalf punten uit het voorstel staan er
   vijf grotendeels, vijf zijn een stap weg en twee vragen eerst een besluit
   (par. 2). Wat werkelijk ontbreekt is klein en precies te benoemen (par. 3).
3. **Het werkwoord blijft: openen en klaarzetten, bevestigen doet de mens**
   (`FOUNDATION.md` par. 2, `LIFE.md` par. 3). Alles wat een tweede persoon of
   een tweede gemeenschap bereikt, wordt klaargezet en nooit automatisch
   verstuurd.

---

## 1. Dit is geen groen veld -- de inventaris

Gemeten op `main` (8bd29185) op 11 oktober 2026. Twee lijsten: wat het voorstel
nodig heeft en al bestaat, en wat met opzet anders werkt dan het voorstel
aanneemt.

### 1.1 Er zijn minstens achttien groepsmodellen, en dat is geen fout

| model | kern | wat het is | wereld vandaag |
|---|---|---|---|
| **Het Genootschap** | `kern/genootschap/` | besloten groep van leden: rollen, prikbord met peilingen, bijeenkomsten met RSVP, drie zichtbaarheden, geen groeitruc | LivingOS (`/apps/genootschap.html`), alleen `LEDEN` |
| Objectlaag, Groep | `kern/objectlaag/groep.js` | projectie: "wat kan ik met dit genootschap?" Bezit niets | LivingOS (Sociaal) |
| Gesprekken | `kern/comm/` | één gesprekinfrastructuur, soorten `group`, `project`, `event`, max 256 | Core |
| Samen-kamer | `kern/samen.js` / `kern/samenrtf.js` | samen meekijken met deelcode; RTF-variant alleen gezin of bevestigde vriend | LivingOS / FoundationOS |
| Rendez-vous circles | `kern/rendezvous-circles.js` | kleine besloten kringen, met opzet zonder feed of ledenlijst | LivingOS |
| Cercle, Entourage | `kern/rechterhand/` | privédossier van eigen clubs en reisgezelschap, op echte naam | LivingOS |
| Sportclub, golf, fitclub | `kern/sportclub/`, `kern/clubs*` | club als PARTNERzaak | WorkOS |
| RTF-clubs | `kern/rtfclubs.js` | samenwerking RTF ↔ sportclub, met programma's | FoundationOS (kantoor) |
| Festivalgroep | `kern/festival/groep.js` | groep tussen gasten; organisator leest niet mee | TravelOS/LivingOS |
| Reisgezelschap | `kern/reisgezelschap*.js` | kring rond één reis, uitnodiging tot aanvaarding | TravelOS |
| Leren-projecten | `kern/leren/projecten.js` | kinderen samen aan een project | LivingOS (os:rtf) |
| Gezin | `server/foundation/gezin*.js` | rollen, leeftijdsgroepen, uitnodiging 48 uur | LivingOS |
| RTF-partners | `kern/rtfos/partners.js` | federatie lokale stichtingen, vier afspraakvelden | FoundationOS |
| Werkruimte, org | `server/bedrijf/werkruimte.js` | bedrijf als tenant | WorkOS |
| School | `server/school/` | klas, gezin, ouderportaal, schooljaar | LivingOS (os:rtf) |
| Living Lab, stadsraad | `kern/livinglab/`, `kern/stadsraad.js` | bewonersthema's, gedeeld besluit RTF + partner | FoundationOS |
| Klankwerk samen | `kern/muziek-samen.js` | co-productie, credits gescheiden | LivingOS |
| DemocratieOS | `kern/democratie/` | kwestie → eindstand met reden | FoundationOS |

**De les.** Het voorstel zegt *"één FoundationOS met gedeelde infrastructuur voor
communities"*. Dat klinkt als één `communities`-tabel. Dit huis heeft die vorm vijf
keer gemeten (`Asset`, `Koopbaar`, `Career`, `Moment`, `Manier`) en vijf keer
kwam er hetzelfde uit: de domeinen delen bijna geen velden, en een gedeeld type
eroverheen breekt ze. De achttien modellen hierboven verschillen ook echt:
een geheim genootschap, een club als betalende zaak, een gezin met een kind erin en
een federatie van stichtingen zijn vier rechtsvormen met vier soorten toegang.

Daarom is de eerste stap een **meting** en geen tabel (fase 0, de meter `groepvorm`). De
verwachting is dat hij uitkomt waar de andere vijf uitkwamen. Dan wordt
"community" geen objecttype maar een **projectie met etiketten** in de vorm van
`kern/levensgraaf/graaf.js`, met `deel` als poort, plus een **verklaring van
werkwoorden** (lid worden, spreken, bijeenkomen, besluiten, samenwerken). Komt de
meting anders uit, dan wint de meting.

### 1.2 Wat al vastligt en het voorstel corrigeert

| voorstel zegt | wat er staat | gevolg |
|---|---|---|
| vrienden, daten, gezin in FoundationOS | **besluit 19 augustus 2026** (`WERELDEN.md`): het gezin ging uit FoundationOS naar LivingOS, en `link:vrienden` stond verkeerd. Een lid dat een vriend appt, denkt niet dat het bij de stichting is | sociaal leven blijft LivingOS; FoundationOS krijgt de ingang voor gemeenschappen met een maatschappelijk doel |
| "RAHUL helpt passende mensen ontdekken" | Genootschap regel 2: *geen "leden die je misschien kent", geen suggesties*. CAR-05/INT-04: geen cijfer op een mens, ook niet als sorteersleutel. De Connect-mixer mengt **met opzet geen mensen** | Rahul helpt **activiteiten, groepen en plekken** vinden en nooit personen. Je leert iemand kennen omdat je ergens samen bent. Daten blijft achter `ontmoetpoort.js` (Vonk, Rendez-vous) en er komt geen derde datingweg |
| groepsbudgetten | geld verlaat het huis nooit vanzelf (`GELD.md` par. 3); `kern/wbw.js` deelt kosten na een tik van de eigenaar; de RTFoundation heeft **geen positie** om aan te betalen (`GIFT.md`) | een gemeenschapsbudget is een **oormerk** of een wbw-lijst van een mens, en geen gezamenlijke rekening. Geld óntvangen voor een Foundation-gemeenschap wacht op de besluiten van `GIFT.md` |
| religieuze gemeenschappen | lidmaatschap van een moskee of kerk **onthult een geloof**: bijzonder persoonsgegeven (AVG art. 9). Vandaag bestaat alleen de geloofsbibliotheek (`kern/geloofbieb*`) | aparte dataklasse (`gevoelig: 3`, `deel` alleen voor de leden), nooit in een AI-context, nooit in een aanbeveling, geen partnerkoppeling. Eerst een DPIA (fase 0) |
| conflictbegeleiding door RAHUL | er bestaat geen bemiddeling (alle treffers op `bemiddel` gaan over makelaardij). Begeleiding van een conflict is professioneel werk (`kern/zorgniveau.js`) | Rahul **ordent** een gesprek (standpunten met bron, open vragen) en **wijst de weg** naar een menselijke bemiddelaar. Hij bemiddelt niet en oordeelt niet |
| scholen met klassen, ouders, alumni, stages | `SCHOOL.md` is de eigenaar. Er is één leerlingenlijst (LAT-regel 4), geen privékanaal docent-kind, en geen tweede rechtenmodel naast `school/rollen.js` | een school als gemeenschap is een **projectie** van School Core, geen tweede school. Alumni zijn volwassenen en vallen buiten School Core |
| "volledige integratie met alle Worlds" | `WORLDNETWORK.md`: het paneel **Context en aandacht → Stel samen** staat al in alle vier werelden, als projectie zonder nieuwe database | plannen voor een gemeenschap (zaal, vervoer, verblijf) gaan door die bestaande samensteller |
| Trusted Execution | `EXECUTIE.md`, `CONTROLPLANE.md`, `kern/stuur/mandaat.js` (een mandaat versmalt, verleent nooit); de Edge **presenteert** bevoegdheid en verleent haar nooit (`EDGE.md`) | geen nieuwe executielaag; wel de eerste echte aanroeper van `mandaat.js` buiten de toetsen (fase 6) |

### 1.3 Namen die bezet zijn (gemeten, `server/` + `public/`)

| woord | stand | gebruik in dit plan |
|---|---|---|
| `community` | **bezet**: RTG Community is de gratis pas (`kern/pasladder.js`), en `community` is een trede van de kringladder (`kern/connect/kring.js:72`) | niet als identifier; op het scherm mag "gemeenschap" |
| `kring` | **zwaar bezet** (921 treffers, 214 bestanden) | niet gebruiken |
| `samenkomst` | **bezet, en dat is een fout in `SAMENLEVING.md`**: r. 267 meldt *"gemeten: 0 treffers -- genomen"*, maar `server/kern/markt/handel/samenkomst.js` (de overhandiging bij een marktdeal) draagt die naam | het besluit moet opnieuw (fase 0). Voorstel: de RTF-functie heet in code `gemeenschap` (21 treffers, alle lopende tekst) |
| `dialoog` | bezet als UI-dialoog (165 treffers) | niet gebruiken |
| `beraad` | **vrij** (0 treffers) | codenaam voor Foundation Dialogue |
| `verband` | 23 bestanden, losse tekst | `samenwerkingsverband` als schermwoord voor gemeenschappen die samenwerken; in code `verbond` na meting |
| `project` | 3047 treffers | geen nieuw `project`-type; hergebruik `kern/rtfos/projecten*.js` |

---

## 2. De twaalf punten, per stand

**Staat** = werkt en is getoetst. **Een stap weg** = de onderdelen staan, de
verbinding niet. **Besluit** = kan pas na een keuze van de eigenaar. **Jaren weg**
= er ontbreekt een fundament.

| # | punt | stand | wat er staat | wat ontbreekt |
|---|---|---|---|---|
| 1 | Communities voor iedereen | **een stap weg** | Genootschap (rollen, prikbord, peiling, bijeenkomst), comm-groepsgesprek, objectlaag-groep, rtfos-activiteiten met wachtlijst en VOG-slot | Genootschap staat alleen open voor `LEDEN` en kent geen **organisatie** als drager (buurt, vereniging). Het groepsgesprek hangt er niet aan. Documenten per groep bestaan niet |
| 2 | Mensen verbinden | **staat** (met correctie) | Sociaal + vriendenlaag met voogdgoedkeuring, Contact-PIN, RTG Link, Vonk, Rendez-vous, Ontmoeting, Salon, Pulse, Connect | niets bouwen. De correctie van par. 1.2: verbinden loopt via activiteiten en groepen en nooit via een personenlijst |
| 3 | Scholen | **staat** (kern) / **jaren weg** (internationaal) | RTF School, ouderportaal, schooljaarwissel, leerpaspoort, klas, schooladvies, `vertegenwoordiging/jeugd*` | alumni, buddy tussen leerlingen, school-tot-school, uitwisseling. Internationaal met minderjarigen = reizen + toezicht + een tweede rechtsorde |
| 4 | Gezinnen en generaties | **staat** (gezin) / **een stap weg** (mantelzorg) / **besluit** (generaties) | gezinscode + uitnodiging, gezinsagenda (`gezin:<code>`), gezinschat/-bellen, babyboek, levensband, mantelzorg-machtiging in `rtgid-regie.js` | een mantelzorgrooster voor meerdere helpers (taken, niet de zorginhoud). Kennisuitwisseling jong ↔ oud bestaat niet en raakt de grens volwassene-minderjarige |
| 5 | Buurten | **een stap weg** | Buurtruil, os-publiek, rtfos-activiteiten, vrijwilligersportaal, gemeenteportaal (alleen aantallen, buurten onder vijf samengevoegd), Living Lab-thema's, stadsweefsel-inspraak | een **buurt als gemeenschap** (Genootschap met een gebied) en "hulp vragen of aanbieden" tussen bewoners. Let op `VERDER.md` par. 7: celveilig is niet queryveilig |
| 6 | Foundation Dialogue | **besluit** | prikbord + peiling, `livinglab/vraagbesluit.js` (besluit met reden uit een gesloten lijst), DemocratieOS (kwestie → eindstand), `bedrijf/besluit.js` (bezwaar verdwijnt nooit), Decision Room | een **beraad** voor een gemeenschap: standpunten ordenen, voorstel, besluit door de leden. Het besluit is de vraag of Beraad en DemocratieOS gescheiden blijven (aanbeveling: ja, zie par. 4 grens G6) |
| 7 | Communities onderling verbinden | **een stap weg** | `rtfos/partners.js` (vier afspraakvelden: geld, vrijwilligers, gegevens, aansprakelijkheid), `rtfclubs.js`, `rtfos/netwerk.js` (blauwdrukken tussen steden), stadsraad (beide kanten stemmen) | een **samenwerkingsverband** tussen twee gemeenschappen die geen RTF-partner zijn. De vorm van `partners.js` is precies goed en hoort hergebruikt te worden, niet gekopieerd |
| 8 | Activiteiten, evenementen, projecten | **staat** (persoonlijk) / **een stap weg** (gemeenschap) | Life Command (`kern/socialecommand/`), avond-samensteller, genootschap-bijeenkomst, rtfos-projecten met vier ogen, Project Room, wbw, reisgezelschap, World Network-samensteller | een bijeenkomst van een gemeenschap die de samensteller van `WORLDNETWORK.md` aanroept (zaal, vervoer). `democratie/doe-bijeenkomst.js` is een **kopie** van de genootschapsregels: eerst samenvoegen |
| 9 | Praktische en maatschappelijke ondersteuning | **staat** | knelpuntmotor (ook via `/api/rtf/knelpunt`), rtfos-casus met versleutelde naam, hulpwijzer, zorg, gemeenteloket, onvervreemdbare bodem, RTG Service (zaak met tijdlijn) | de hulpwijzer is statisch (geen API). Een buurtbewoner die hulp **aanbiedt** heeft nog geen weg |
| 10 | Mentorschap en kansen | **een stap weg** | knelpunt-aanvoer (werk, opleiding, opvang), Carrièreledger (een ander bevestigt), Métier (aanbeveling als tekst, één mens één stem), vacatures incl. `stage`, beroepenbieb | **mensen als mentor**. Er bestaat geen menselijke mentorkoppeling, alleen de AI-levensmentor. Dit is meteen de **derde bron** voor de aanvoerprojectie die `MAATSTAF.md` par. 7h vraagt |
| 11 | RAHUL en EDGE | **staat** (fundament) / **besluit** (initiatief) | resolver (dekking 100%), PLAN-compiler, gevolgmeting, `mandaat.js`, Edge actiestaat + blikveld, genootschap-AI (aankondiging, samenvatting, datumraad) | Rahul die een **doel** ("meer mensen leren kennen in mijn buurt") vertaalt naar vondsten. Fase 4 van de knelpuntmotor heeft die vorm al |
| 12 | Integratie met alle Worlds | **staat** (mechanisme) | WorldNetwork-paneel in alle vier werelden, `MAPPEN`, functieregister met doelgroepen, Trusted Execution | per gemeenschapsfunctie bepalen in welke wereld hij verschijnt (par. 3.1) |

---

## 3. Het ontwerp

### 3.1 Waar elke gemeenschap verschijnt

Dit is de beslisprocedure van `WERELDEN.md`, ingevuld: *in welke context denkt de
mens dat hij zich bevindt?* De opslag is in alle gevallen dezelfde.

| gemeenschap | wereld | waarom |
|---|---|---|
| vriendengroep, familie, eigen genootschap | **LivingOS** | mijn dagelijks leven |
| date, ontmoeting | **LivingOS** (Vonk, Rendez-vous) | blijft achter `ontmoetpoort.js` |
| groepsvakantie, schoolreis, uitwisseling | **TravelOS** | ik ben onderweg |
| bedrijf, team, beroepsnetwerk, stage | **WorkOS** | mijn werk |
| buurt, vereniging, vrijwilligersgroep, maatschappelijke organisatie, religieuze gemeenschap, gezamenlijk project | **FoundationOS** | ik doe iets met en voor anderen |
| schoolklas, ouders van de klas | **LivingOS** (os:rtf), school als gemeenschap ook in **FoundationOS** | het kind en het gezin zijn LivingOS; de school als instelling die samenwerkt is FoundationOS |
| beraad, kwestie aankaarten | **FoundationOS** | wie iets aankaart, zit niet in zijn huishouden |

Een genootschap kan in twee werelden zichtbaar zijn. Er komt dan **geen tweede
genootschap**: een tegel in de tweede wereld opent hetzelfde object.

### 3.2 Vier bouwstenen, en verder niets

**B1. De drager.** Het Genootschap wordt de groepslaag van FoundationOS, met één
uitbreiding: een genootschap kan een **organisatie als drager** hebben (een
RTF-partner, een gemeenteteam, een club, een school, een werkruimte), naast de
leden die het nu draagt. De drager is een verwijzing naar het domein waar die
organisatie al bestaat, nooit een kopie. Daarmee kan een buurtvereniging dezelfde
rollen, dezelfde peilingen en dezelfde bijeenkomsten gebruiken als een
vriendengroep, en blijft haar juridische vorm in haar eigen domein.

**B2. Het verbond.** Twee gemeenschappen die samenwerken (moskee en kerk, school
en club, buurt en ondernemers) krijgen een afspraak in de vorm van
`kern/rtfos/partners.js`: de vier afspraakvelden (geld, vrijwilligers, gegevens,
aansprakelijkheid), beide kanten tekenen, beide kunnen opzeggen. Een verbond
**bezit niets**: geen gezamenlijke ledenlijst, en een lid van de ene
gemeenschap ziet de leden van de andere niet. Een gezamenlijk project loopt via
`kern/rtfos/projecten*.js` met twee eigenaren.

**B3. Het beraad.** Een gesprek binnen één gemeenschap of één verbond, met een
vaste vorm: vraag, standpunten (elk met wie het inbracht, op codenaam), open
punten, voorstel, besluit. Gebouwd op het prikbord en de peiling van het
genootschap en op de besluitvorm van `livinglab/vraagbesluit.js` (een reden uit
een gesloten lijst, ook "nee" is een antwoord). Rahul heeft drie taken en niet
meer: standpunten samenvatten **met de bron ernaast**, ontbrekende perspectieven
noemen als vraag ("niemand heeft nog gezegd wat dit kost"), en een voorstel
formuleren dat de leden kunnen wijzigen. Hij peilt geen stemming, weegt geen
standpunten en doet geen uitspraak over wie gelijk heeft.

**B4. De aanvoer van mensen.** Mentoren, vrijwilligers en mensen die hulp
aanbieden worden een **aanvoerbron** van de knelpuntmotor (`aanvoer-mentor.js`),
naast werk, opleiding en opvang. Wie mentor wil zijn, zet dat zelf aan en
omschrijft het zelf. De bron levert een **aanbod** (wat iemand aanbiedt), nooit
een profiel. Er wordt niet gerangschikt. Contact gaat via de bestaande weg
(Contact-PIN, comm) en pas als beide kanten ja zeggen. Voor een minderjarige
geldt het VOG-slot van `rtfos/vrijwilligers*.js`.

### 3.3 Wat Rahul en de Edge doen

De lus uit het voorstel, ingevuld met bestaande onderdelen:

```
"Ik wil meer mensen leren kennen in mijn buurt"
  → resolver.js        versmalt tot de paden die deze vraag raken
  → knelpuntmotor      vondsten: openbare genootschappen in het gebied,
                       rtfos-activiteiten, buurtruil, vrijwilligerswerk
                       (nooit een lijst mensen)
  → plan.js            stappen: "kom naar de buurtmaaltijd van donderdag"
  → Edge actiestaat    BESCHIKBAAR / GEBLOKKEERD met reden
  → de mens drukt      aanmelden gebeurt pas nu
```

En voor de school die een internationaal project wil, is de lus dezelfde. Alleen
de stappen raken meer domeinen: een verbond tussen scholen (B2), een beraad (B3),
een reisgezelschap in TravelOS, een afspraak in WorkOS. Elke stap die een tweede
partij bereikt, blijft op "klaarzetten" staan.

---

## 4. De grenzen. Dit deel weegt zwaarder dan par. 1-3

De grenzen van `LEVEN.md` par. 2, `LIFE.md` par. 4, `FOUNDATION.md` par. 5,
`ONTMOETEN.md` par. 4 en `SCHOOL.md` par. 11 blijven onverkort gelden. Waar een
functie hieronder botst met een grens, vervalt de functie. Wat dit document
toevoegt:

- **G1. Mensen zijn geen aanbod.** Rahul stelt groepen, activiteiten en plekken
  voor, nooit personen. Uitzondering zijn alleen de datingapps, achter
  `ontmoetpoort.js`, en het aanbod van een mentor (B4) dat die mentor zelf heeft
  geplaatst. Handhaving: een toets die zakt zodra een vondst een codenaam draagt
  die niet van de aanbieder zelf is.
- **G2. Geen cijfer op een gemeenschap of een lid.** Geen ranglijst van buurten,
  geen "actiefste lid", geen betrokkenheidsscore. `scripts/lib/cijferopmens.js`
  wordt uitgebreid naar gemeenschapsvelden.
- **G3. Geloof, gezondheid en kinderen zijn een dataklasse en geen veld.**
  Lidmaatschap van een religieuze gemeenschap, een mantelzorggroep of een
  schoolklas staat op `gevoelig: 3` en `deel` alleen voor de leden. Het komt
  nooit in een AI-context (AI-CONTEXT-01: alleen een positieve veldenlijst), nooit
  in een aanbeveling aan een ander en nooit in een partnerkoppeling.
- **G4. Een verbond deelt geen leden.** Samenwerken betekent niet dat de ene
  gemeenschap de leden van de andere ziet. Gegevens gaan alleen over met
  toestemming per persoon (`connection-consent.js`), nooit per verbond.
- **G5. Volwassene en kind.** Een volwassene buiten het gezin bereikt een
  minderjarige alleen in een context met een VOG-slot (school, rtfos-activiteit,
  mentorschap) en nooit in een privékanaal (`SCHOOL.md`: geen privékanaal
  docent-kind). Een kind komt niet voorbij de kringtrede `team`
  (`CONNECT.md` par. 5).
- **G6. Beraad is geen politiek.** Een beraad besluit binnen een gemeenschap.
  DemocratieOS (`POLITIEK.md`) is partijneutrale burgerinfrastructuur met eigen
  rechtspersoon en grondwet. Een beraad kan een kwestie **inbrengen** bij
  DemocratieOS, maar ze delen geen opslag en geen stemmen. Zo kan de partijvraag
  nooit via een buurtgroep binnenkomen.
- **G7. Rahul bemiddelt niet.** Hij ordent en wijst de weg naar een mens. Een
  bemiddelaar is een professional in het systeem (`persoonseis.js`,
  `vakbewijs.js`), geen modus van de AI.
- **G8. Groeien gebeurt door mensen en niet door het systeem.** Geen "nodig vijf
  vrienden uit", geen leden-die-je-kent, geen oneindige lijst. De bestaande
  Genootschap-regel 2 wordt huisbreed voor alle gemeenschappen.
- **G9. Elke gemeenschap kan weg, met haar inhoud.** `genootschap/uitvoer.js`
  ("neem je genootschap mee") geldt voor elke drager. Lock-in door kwaliteit mag,
  lock-in door gijzeling niet (`CARRIERE.md` par. 5).

---

## 5. Gefaseerde implementatie

Elke fase levert werkende, getoetste software op, en geen fase begint vóór de
vorige zijn toetsen heeft (`LAT.md`). Elke nieuwe HTTP-route krijgt minstens één
treffer op een echte server in een gewone CI-toets (LAT-regel 17). **Geen fase
raakt de productie zonder akkoord van de eigenaar.**

### Fase 0 -- meten en besluiten (geen productiecode)

| stap | wat | waarom eerst |
|---|---|---|
| 0.1 | een nieuwe meter `groepvorm` (`GROEPVORM.json`, nog te bouwen) op de lezer van `scripts/objectmodel.js`, over de achttien groepsmodellen van par. 1.1, ruim én smal gemeten | voordat iemand een `communities`-tabel bouwt; als de meting doorvalt zoals bij `Asset`, ligt de projectievorm vast |
| 0.2 | naamsbesluit: `samenkomst` opnieuw (fout in `SAMENLEVING.md` r. 267), `beraad`, `verbond` | het eerste identifier mag geen botsing zijn |
| 0.3 | DPIA voor geloofsgemeenschappen, mantelzorg en gemeenschappen met minderjarigen (naast `DPIA-GEZIN.md`) | G3 en G5 moeten vastliggen voordat er een veld bestaat |
| 0.4 | `democratie/doe-bijeenkomst.js` en `genootschap/bijeenkomst.js` naast elkaar leggen | twee kopieën van dezelfde regels; samenvoegen voordat er een derde bijkomt |
| 0.5 | de wereldtabel van par. 3.1 als besluit in `WERELDEN.md` | wie dat overslaat, krijgt een tweede vriendenscherm in FoundationOS |
| 0.6 | ontwerp en toetsstrategie van de **samenwerkingsketen** (hieronder) | dit is de belangrijkste acceptatietoets van FoundationOS; zonder ontwerp vooraf wordt hij achteraf passend gemaakt |
| 0.7 | open juridische vragen over minderjarigen, VOG, bijzondere persoonsgegevens en gegevensdeling tussen gemeenschappen, voor een privacyjurist of FG | de grenzen van par. 4 zijn een technisch minimum en geen juridisch oordeel; ze vervangen geen volledige veiligheids- en privacybeoordeling |

**De uitkomst van 0.1 bepaalt de architectuurkeuze.** Fase 0 neemt niet vooraf aan
dat de achttien groepsmodellen worden samengevoegd, en ook niet dat ze apart
blijven. Valt de meting door zoals bij `Asset`, dan wordt de gemeenschap een
projectie met etiketten. Haalt een deel van de modellen de drempel, dan worden
alleen die samengevoegd, en alleen zonder functieverlies.

**De samenwerkingsketen is de acceptatietoets:**

```
Drager → Verbond → Beraad → Besluit → Bijeenkomst → Terugkoppeling
```

Een buurtvereniging (drager) gaat een verbond aan met een tweede gemeenschap. Ze
voeren samen een beraad, de leden nemen een besluit, er volgt een bijeenkomst, en
de deelnemers krijgen terugkoppeling over wat er met het besluit is gebeurd. Elke
schakel wordt gemeten met een echte sessie (handelt actor A, en ziet actor B dat?),
en elke storing moet houden: een minderjarige deelnemer, een geweigerde
toestemming, een vol genootschap, een opgezegd verbond, en een beraad waarin Rahul
probeert te stemmen. Fase 0 levert het ontwerp en de toetsstrategie van deze keten
op. De end-to-end-implementatie volgt pas na goedkeuring van de eigenaar.

**Werkafspraak voor fase 0 (11 oktober 2026).** Fase 0 wordt op een eigen branch
uitgevoerd en in een afzonderlijke PR opgeleverd. PR #544 blijft voor de
documentwijzigingen aan dit bestand, zodat er niet door elkaar heen gewerkt wordt.
Na beoordeling worden de resultaten gecontroleerd samengebracht. Toegestaan zijn
alleen meetscripts, registers en documentatie. Geen wijzigingen in `server/` of
`public/`, geen merges en geen deployments.

Het resultaat van fase 0 bestaat uit vier delen: de definitieve
FoundationOS-architectuur, een overzicht van herbruikbare bestaande
functionaliteit, de noodzakelijke wijzigingen en een gefaseerd implementatieplan.

### Fase 1 -- FoundationOS toont wat er al is (klein, omkeerbaar)

- Een onderdeel **Gemeenschap** op het FoundationOS-huis (`MAPPEN`, `npm run
  wereldlijst`) dat bestaande dingen opent: rtfos-activiteiten, buurtruil,
  vrijwilligersportaal, kwesties, Living Lab-thema's, knelpunt (*ik zoek iets*).
  Er komt geen nieuw scherm met een eigen capability. Dat bewaakt
  `test/schermeigenaar.test.js` al.
- De `hulpwijzer.html` krijgt een bron in plaats van een statische lijst
  (`kern/rtfos/publiek.js`).
- Het open gat uit `WERELDLIJST.md`: `link:rtfwinkel` hangt in geen enkele map.
  Plaats hem of verwijder hem.
- Toetsen: `wereldregister`, `tikken` (binnen vijf tikken), `doelgroepbereik`
  (geen nieuwe registerleugen).

### Fase 2 -- de drager (B1)

- `kern/genootschap/` krijgt een `drager` (`lid` | `organisatie`), met de
  organisatie als verwijzing naar haar domein. Doelgroep in het functieregister
  van `LEDEN` naar `LEDEN_RTF` voor de soort `openbaar` en `besloten`. `geheim`
  blijft alleen voor leden.
- Het groepsgesprek wordt een cap op het object: `kern/comm` met soort `group`,
  gekoppeld aan het genootschap en niet erin gekopieerd.
- Een gebied (buurt) als optioneel etiket, met de groepsdrempel van
  `bedrijfsmaat/poort.js`: onder vijf geen aantal.
- Toetsen: één genootschap, twee werelden, hetzelfde object (byte voor byte);
  kind niet voorbij `team`; mutatietoets op G2.

### Fase 3 -- het verbond (B2)

- een nieuwe module `verbond.js` (nog te bouwen, naam na 0.2) hergebruikt de afspraakvelden en de
  tekenvorm van `rtfos/partners.js` en heeft geen eigen opslag van leden.
- Een gezamenlijk project = `rtfos/projecten*.js` met twee eigenaren.
- Toetsen: G4 als aanvalsproef. Een beheerder van gemeenschap A vraagt de leden van
  B op en krijgt 404, terwijl B's eigen beheerder 200 krijgt (de vorm van MN-01).

### Fase 4 -- het beraad (B3)

- `kern/beraad/` op prikbord, peiling en `vraagbesluit.js`. De eindstand verandert
  nooit achteraf, net als bij DemocratieOS.
- Rahul via `lib/lokale-taal` en `ai-kort`, met een positieve veldenlijst. Een
  besloten beraad gaat alleen naar een lokaal model (`LOCAL_AI_URL`).
- "Breng in bij DemocratieOS" is een klaargezette kwestie die een mens indient
  (G6).
- Toetsen: Rahul kan geen stem uitbrengen en geen standpunt verwijderen
  (mutatietoets); een standpunt zonder bron haalt de samenvatting niet.

### Fase 5 -- mensen die iets aanbieden (B4)

- een nieuwe aanvoerbron `aanvoer-mentor.js` (nog te bouwen) als derde, maximaal andere bron: mensen in
  plaats van een lijst of een generator. Dit is meteen de proef die
  `MAATSTAF.md` par. 7h vraagt: past het contract van `aanvoer.js` zonder één
  letter te veranderen?
- Hulp aanbieden in de buurt is dezelfde bron met een gebied.
- Een mantelzorgrooster als genootschap met drager `gezin`. Het toont taken
  (boodschappen, rijden), nooit de zorginhoud.
- Toetsen: G1 en G5; `vondsten()` krijgt nog steeds geen mens mee (de
  handtekening van par. 7g blijft).

### Fase 6 -- Rahul met een doel (par. 3.3)

- De lus van par. 3.3 over resolver, knelpunt, `plan.js` en Edge. `mandaat.js`
  krijgt zijn eerste productieaanroeper, met als speelruimte alleen
  **klaarzetten**.
- Een keten in de vorm van `scripts/tafelproef.js`: een nieuwe proef `gemeenschapsproef` (nog te bouwen),
  van "ik wil mensen leren kennen in mijn buurt" tot een bevestigde aanmelding
  bij een activiteit, met storingen (geen activiteit in het gebied, een kind,
  een vol genootschap, een geweigerde uitnodiging).

### Fase 7 -- scholen samen, en internationaal (jaren weg)

- School als gemeenschap (projectie van School Core) in een verbond met een club
  of een andere school.
- Uitwisseling met minderjarigen vraagt TravelOS-reisgezelschap, toezicht,
  toestemming van beide ouders én een rechtsorde in een ander land. Dit staat er
  met opzet als **jaren weg** en niet als lege functie.
- Alumni: een volwassen genootschap met de school als drager, buiten School Core.

---

## 6. Niets vergeten: wat blijft, en waar het in dit plan hangt

Elke bestaande functie houdt haar eigenaar. Dit plan voegt verbindingen toe en
haalt niets weg.

| bestaand | blijft eigenaar van | rol in dit plan |
|---|---|---|
| Sociaal, vriendenlaag, Contact-PIN, RTG Link | vrienden, contact | ingang voor uitnodigen, ongewijzigd |
| Vonk, Rendez-vous, Ontmoeting | daten, ontmoeten | ongewijzigd; geen derde datingweg |
| Salon, Pulse | publiceren | ongewijzigd; het open schermoordeel Pulse ↔ Salon staat los van dit plan |
| RTG Wereld, `sociaal.html` | sociaal overzicht | toont ook genootschappen met een organisatie als drager |
| Het Genootschap | groepen | wordt B1 |
| Gesprekken (`kern/comm`) | alle chats | groepsgesprek als cap |
| Samen-kamers (LivingOS, FoundationOS) | samen meekijken | ongewijzigd |
| Cercle, Entourage | privédossier (echte naam) | blijven met opzet buiten de objectlaag |
| wbw, oormerk | geld delen | gemeenschapsbudget = verwijzing hiernaar |
| Gezin, gezinsagenda, babyboek, levensband, mijnbanden | gezin, delen | mantelzorgrooster in fase 5 |
| RTF School, leerpaspoort, klas, schooladvies | onderwijs | fase 7, als projectie |
| Connect / Ontdekken | ontdekken, leerdossier | vondsten uit fase 6 kunnen een plek in de mixer krijgen |
| LibraryOS, geloofsbibliotheek, beroepenbieb | bibliotheken | ongewijzigd |
| Buurtruil, vrijwilligersportaal, rtfos-activiteiten, -projecten, -casus, -partners, -netwerk | buurt, hulp, federatie | fase 1 toont ze, fase 3 hergebruikt partners |
| Klimaatfonds, Living Lab, stadsraad, stadsweefsel | onderzoek, lokaal bestuur | beraad kan erin inbrengen |
| DemocratieOS (kwesties) | burgerlus | gescheiden van beraad (G6) |
| Geven | gift (zonder doneerknop) | ongewijzigd; geld ontvangen wacht op `GIFT.md` |
| Zorg, hulpwijzer, knelpunt, Service, gemeenteloket, onvervreemdbaar | hulp | hulpwijzer krijgt een bron, knelpunt een mentorbron |
| Carrièreledger, Métier, werk, stage-vacatures | loopbaan | mentorschap verwijst, bezit niets |
| Sportclub, RTF-clubs, festivalgroep, reisgezelschap, klankwerk samen | domeinen | kunnen drager zijn of een verbond aangaan |
| WorldNetwork-samensteller, Life Command, avond-samensteller | plannen | bijeenkomsten van gemeenschappen gebruiken ze |
| resolver, plan, gevolg, mandaat, Edge | Trusted Execution | fase 6 |

---

## 7. Besluiten

### 7.1 Genomen door de eigenaar (11 oktober 2026)

| # | besluit |
|---|---|
| 1 | **Vrienden, daten en gezin blijven in LivingOS.** FoundationOS wordt de maatschappelijke en gemeenschappelijke verbindingslaag en gebruikt die bestaande functies voor maatschappelijke activiteiten, zonder ze te dupliceren. |
| 2 | **Rahul stelt buiten de afgeschermde datingcontext geen individuele personen voor.** Hij helpt groepen, activiteiten, organisaties en mogelijkheden ontdekken. Bij vrijwillig mentorschap stellen mensen zichzelf beschikbaar, en contact ontstaat pas na wederzijdse toestemming (G1, B4). |
| 3 | **Fase 0 begint.** Eerst meten en onderzoeken, met de samenwerkingsketen als acceptatietoets (par. 5). Er verandert niets aan productie. |

Daarbij stelde de eigenaar één aanvullende eis: FoundationOS mag geen verzameling
links naar bestaande apps worden, maar organiseert maatschappelijke samenwerking
zelf (de kernzin in par. 0).

### 7.2 Nog open

| # | besluit | aanbeveling |
|---|---|---|
| 4 | Blijven Beraad en DemocratieOS gescheiden? | ja (G6) |
| 5 | Mogen religieuze gemeenschappen erin vóór de DPIA? | nee: eerst fase 0.3 |
| 6 | De RTF-functie Gemeenschap heet in code `gemeenschap` nu `samenkomst` bezet blijkt | ja |
| 7 | Volgorde na fase 0: fase 1 → 2, en 3 t/m 5 daarna parallel | ja, maar pas vast te stellen na de uitkomst van fase 0 |
