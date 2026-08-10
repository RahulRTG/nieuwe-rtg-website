# Eén Enterprise Society OS

Dit bestand legt de richting vast waar de code naartoe gebouwd wordt. `LAT.md`
zegt hoe er geschreven wordt, `CLAUDE.md` wat het merk is, `ARCHITECTUUR.md`
waar de dingen nu staan. Dit zegt waar het heen gaat, en net zo belangrijk: wat
er vandaag in de weg staat.

Het is geen inventarislijst van branches. Een lijst van veertig sectoren is
makkelijk te schrijven en onmogelijk te bouwen. Wat hieronder staat is de
mechaniek waarmee een sector erbij komt zonder dat er een app bij komt.

---

## Het principe

> Iedere organisatie kan iedere andere organisatie vinden, vertrouwen,
> contracteren, plannen, laten uitvoeren, factureren en betalen vanuit hetzelfde
> systeem — en iedere werknemer kan zijn deel daarvan uitvoeren vanuit één PDA.

Alles hieronder is daarvan afgeleid. Wat er niet uit volgt, hoort hier niet.

---

## 0. De super-app-regel — HERZIEN

> **Acht apps. Niet drieëntachtig.**

Dit is een besluit van de eigenaar, en het vervangt de regel die hier stond.
Wat er stond, en waarom het veranderde, staat er met opzet onder: een regel die
stilletjes wordt vervangen is een regel die niemand meer vertrouwt.

### Wat er nu geldt

Een lid opent **acht** apps, en niet meer:

| Wereld | Bevat |
|---|---|
| **RTG Reizen** | vluchten, verblijven, reisbureau, vervoer, navigatie, reisboek, hangar |
| **RTG Media** | muziek, theater, clips, podium, camera, galerij, krant, spelen, sport |
| **RTG Kantoor** | documenten, agenda, notities, bestanden, gereedschap, browser, werk |
| **RTG Sociaal** | berichten, De Salon, genootschap, pulse, vonk, meet, vrienden |
| **RTG Geld** | wallet, bank, balans, wie betaalt wat, métier, mecenaat, nalatenschap |
| **RTG Veilig** | wie ben ik, passkeys, thuiswacht, codewoord, vitaal, juridisch |
| **RTG Leven** | het huis, maison, table, cellier, garde-robe, zorg, gezin, cercle |
| **RTFoundation** | de stichting, met haar eigen zeventien onderdelen |

Wat vandaag 83 losse pagina's zijn, worden **onderdelen binnen** die acht. Geen
eigen tegel, geen eigen adres in de bibliotheek, geen eigen kopbalk: een sectie
in de app waar hij hoort.

### Wat "app" hier betekent, en wat níét meegaat

**Een app is wat een lid opent.** De 83 HTML-pagina's worden er acht.

De **domeinkernen op de server** blijven staan — `kern/agenda.js`,
`kern/bestanden.js`, `kern/office/`, `kern/luchthaven.js` en de rest. Dat is de
diepte waar dit besluit juist om vraagt, en niemand noemt `kern/agenda.js` een
app. Ze verhuizen niet en ze smelten niet samen; alleen wie ze aanroept
verandert.

### Wat er hiervoor stond, en wat het kostte om het te vervangen

> *RTG Super Apps vervangen geen domeinsoftware. Ze orkestreren domeinsoftware.
> Alleen apps die feitelijk dezelfde kern, dezelfde data én dezelfde workflow
> dupliceren, mogen samensmelten tot één product.*

Die regel is niet fout gebleken. Hij beschermde tegen samenvoegen op een
vermoeden, en dat werkte: het onderzoek naar Cercle en Entourage verderop in
dit document liet zien dat twee apps die identiek KLONKEN totaal verschillende
data en werkstromen hadden.

Wat hij niet oploste is het probleem waar dit besluit over gaat: **drieëntachtig
ingangen zijn er drieëntachtig, ook als ze stuk voor stuk verdedigbaar zijn.**
Een lid dat "waar stond dat ook alweer" moet denken, heeft geen baat bij een
architectuur die per app uitlegt waarom hij bestaat.

De eigenaar is op de gevolgen gewezen voordat hij koos: samenvoegen tot acht
codebases raakt werkende software, kost maanden, en de oude regel verbood het.
Dat is afgewogen en het besluit staat. Wat de oude regel wél blijft doen is
het werk *sturen*: waar twee onderdelen binnen een wereld dezelfde kern en
dezelfde workflow blijken te delen, worden het er één; waar ze dat niet doen,
blijven het twee secties in dezelfde app. Samenvoegen van de SCHIL is besloten;
samenvoegen van de LOGICA blijft bewijs vragen.

### De volgorde

Niet alles tegelijk. Per wereld: de schil, dan de secties erin, dan de oude
pagina's als omleiding, en pas als een wereld af is de volgende. Zo is er nooit
een moment waarop de helft werkt.

| Wereld | Stand |
|---|---|
| **RTG Geld** | ✅ samengevoegd: tien pagina's werden tien standen van `apps/geld.html` (veilig-patroon: `apps/geld/schil.js` + een module per stand); de oude paden leiden om |
| RTG Veilig | ✅ was al samengevoegd (vier standen) |
| de overige zes | voordeur staat; het samenvoegen van de secties volgt per wereld |

---

## 0b. De oude super-app-regel (nog geldig binnen een wereld)

De toetsvraag bij elke app die "erbij" of "eraf" moet, is daarom niet *"kan dit
in een super-app?"* maar:

> **Is dit een zelfstandige professionele capability, of is dit slechts een
> andere ingang naar dezelfde capability?**

Alleen in het tweede geval samenvoegen. In het eerste geval een laag erboven.

### Drie lagen

| Laag | Wat het is | Voorbeelden die er nu staan |
|---|---|---|
| **1 — Specialistische apps** | Echte software per genre, met eigen kern, eigen data en eigen diepte | Sound, Theater, Clips, Podium, Agenda, Notities, Bestanden, dispatch, ovroutes, horeca, payroll, school |
| **2 — Genre-superapps** | De ontdek-, identiteits-, distributie- en samenhanglaag over één wereld | RTG Media, RTG Mobiliteit, het Privékantoor |
| **3 — RTG-hoofdlaag** | Identiteit, zoeken, AI, betalen, meldingen, vrienden, rechten, bestanden, locatie en workflows dwars over apps heen | het OS zelf (`apps/app.html`), `kern/comm`, RTG Pay, de kluis |

De gebruiker ervaart één wereld; de professional houdt gespecialiseerde
software. Mobiliteit is één Uber-achtige ervaring waarin iemand zegt "breng mij
naar Parijs", terwijl daaronder afzonderlijke serieuze systemen blijven bestaan
voor rijden, fietsen, OV, chauffeurs, verkeersleiding, routebeheer en dispatch.
Media laat iemand een artiest ontdekken, een nummer luisteren in Sound, een
concert boeken via Podium en een documentaire kijken in Video — zonder die vier
producten in één scherm te persen.

### Waarom deze regel er staat

Twee samenvoegingen in dit huis zijn allebei goed afgelopen, om
tegengestelde redenen — en juist dat verschil is de regel:

- **`comm.html` mócht vier apps vervangen.** Er waren zes berichtenvoorraden en
  vier voordeuren naar hetzelfde: één gespreksmodel, één poort, één leesstand.
  Vier verschijningsvormen van dezelfde capability.
- **`veilig.html` mócht vier apps vervangen.** Thuiswacht, Codewoord, Vitaal en
  Thuisrust deelden `kern/veiligheid/`, `shared/veiligheid.js`, dezelfde kring en
  dezelfde grens. Ze verschilden alleen in de vraag die ze stelden.
- **`media.html` mócht dat juist NIET.** Klankwerk, Theater, Clips en Podium
  hebben elk een eigen catalogus, eigen makers en een eigen vak. Ze samenpersen
  zou identiteit en functie vernietigen. De Media OS bezit die vier domeinen
  daarom niet: elke rij wordt bij het opvragen uit het domein zelf gehaald.
  Dat staat als ontwerpbesluit ook in `apps/app-main/app-main-24.js`: *naast, en
  niet in plaats daarvan.*

De verleiding gaat altijd één kant op — alles samenvoegen tot er nog één scherm
over is. Dat levert geen super-app maar een monsterapp met vijfduizend functies.
Het doel is een ecosysteem: **de superapps zijn de steden, de gespecialiseerde
apps de gebouwen.**

### Wat dit betekent voor het aantal apps

Het aantal tegels is geen doel op zich, in geen van beide richtingen. Een tegel
minder is winst als hij een tweede voordeur naar dezelfde kern was, en verlies
als hij een eigen vak was. De maat is de toetsvraag hierboven, niet het getal.

### Welke laag-2-superapps er staan, en welke ontbreken

Gemeten en niet aangenomen: per catalogus-app zijn de `/api/`-routes uit de
pagina en haar eigen scripts gehaald, en daarna gegroepeerd op de kern die ze
aanroepen. Wat dat opleverde:

| Wereld | Laag 2 | Stand |
|---|---|---|
| Media | `apps/media.html` | **staat** — haalt elke rij uit het domein zelf op |
| Mobiliteit | `apps/ov.html` + `dispatch` + `zakelijk` | **staat** — 25 vervoersmodules op één kern |
| Privékantoor | `apps/lifestyle.html` op `kern/bureau/` | **staat** — 20 kamers naar 23 apps |
| Communicatie | `apps/comm.html` | **staat** (was een terechte samensmelting) |
| Veiligheid | `apps/veilig.html` | **staat** (was een terechte samensmelting) |
| Werk | `apps/werk.html` | **staat** — voor organisaties |
| Office | `apps/kantoor.html` op `kern/kantoorwereld.js` | **staat** — agenda, taken, documenten en gedeelde bestanden |
| Reizen | `apps/reizen.html` op `kern/reiswereld.js` | **staat** — vlucht, verblijf, reis en charter |
| Social | `apps/sociaal.html` op `kern/socialewereld.js` | **staat** — gesprekken, bijeenkomsten, de kring |
| Games | — | **met opzet niet gebouwd**, zie hieronder |
| Mall | — | **ontbreekt** (`apps/mall.html` bestaat en staat niet in de bibliotheek) |

### Games krijgt géén superapp, en dat is de regel die werkt

Bij het bouwen van de drie werelden hierboven kwam Games ook aan de beurt, en
daar bleef de teller op **één** staan: `apps/spelen.html`, op `kern/spellen/`.
Eén specialist.

Een genre-superapp bestaat om meerdere specialisten te verbinden. Boven één
app is er niets te verbinden: dan bouw je een scherm dat een lijst met één
regel toont en doorlinkt naar de app die de gebruiker toch al open had. Dat is
geen laag maar een omweg — en precies het soort scherm waar de super-app-regel
tegen beschermt, alleen dan van de andere kant.

Dus: geen `apps/games.html` tot er een tweede zelfstandige spel-capability
staat. Komt die er (een eigen arcade-kern naast de bordspellen bijvoorbeeld),
dan is dit het moment om de vraag opnieuw te stellen. Opgeschreven als besluit
en niet als achterstand, zodat niemand het later voor vergeten aanziet.

### Cercle en Entourage: onderzocht, en NIET samenvoegen

Deze twee stonden hier als verdacht. Cercle heette in de catalogus "je besloten
kring: de mensen die dichtbij staan" en Entourage "je vaste mensen en hun rol om
je heen" — twee beschrijvingen van hetzelfde, dus precies het geval waarin
samenvoegen wél mag.

In de kernen kijken gaf het omgekeerde antwoord.

| | Cercle | Entourage |
|---|---|---|
| Data | **clubs**: stad, lidnummer, sinds, dresscode, reciprociteit, gastpassen | **mensen**: band, voorkeuren, dieet, documenten met vervaldatum |
| Kernvraag | "waar kan ik in Milaan terecht, en op welk lidmaatschap?" | "wat ontbreekt er aan dit gezelschap voordat we vertrekken?" |
| Werkstroom | reciprociteit opzoeken, een gastpas afboeken | een gezelschap samenstellen, verlopende documenten signaleren |
| Module | `kern/rechterhand/cercle.js` | `kern/rechterhand/entourage.js` |

Geen gedeelde data, geen gedeelde workflow. Wat ze wél delen is een
routevoorvoegsel (`/api/member/rechterhand/`) en een opslaghelper — en dat is
letterlijk de val waar dit document al voor waarschuwt: **een gedeeld
routevoorvoegsel is geen gedeelde kern.**

**Wat er dus fout was, was de beschrijving en niet de architectuur.** Vier
teksten klopten niet met de code: Cercle heette "de mensen die dichtbij staan"
terwijl het clubs bijhoudt, en de app-gids beloofde bij Entourage zelfs "betaal
en verantwoord netjes via de app" — een functie die niet bestaat. Die vier zijn
herschreven naar wat de modules werkelijk doen.

De les is de moeite van het opschrijven waard: ik had deze twee bijna
samengevoegd op grond van hun *omschrijving*. De toetsvraag stellen is niet
genoeg — je moet hem aan de **code** stellen.

### En het bleek geen incident

Als twee beschrijvingen zó mis konden zijn, hoeveel dan nog? De twaalf apps met
het `rechterhand`-voorvoegsel zijn samen gebouwd, dus daar was dezelfde drift
het waarschijnlijkst. Van de tien die daarnaast nog gecontroleerd zijn, klopten
er **zeven** niet:

| App | Stond er | Doet het |
|---|---|---|
| Logboek | "je acties en bevestigingen, netjes vastgelegd" | onderhoudsboek van jacht/jet/oldtimer, met keuringen en vervaldata |
| Maison | "je vaste verblijven en tweede huizen" | huishoudelijk personeel, taken en een huislogboek |
| Table | "je tafelreserveringen" | de diners die u ZELF geeft: gastenlijst, tafelindeling, menu |
| Reisboek | "worden vanzelf een mooi verslag" | een draaiboek dat u zelf invult; niets gaat vanzelf |
| Garde-robe | "je kledingkast en looks" | kleding en vaklui; "looks" bestaat niet |
| Cellier | "proefnotities" | één notitieveld per fles |
| Mecenaat | "steun projecten en goede doelen" | een administratie van toezeggingen; er wordt niets betaald |

De **app-gids** was erger dan de catalogus, en die is wat Rahul een lid
vertelt. Daar stond onder meer "open deuren op afstand waar dat kan" (Maison),
"laat de sommelier alvast kiezen" (Table), "laat een maat naar de paskamer
brengen" (Garde-robe), "wij verzorgen inpakken en bezorgen" (Attenties) en
"exporteer voor uw administratie" (Logboek). Geen van die dingen bestaat als
route; nagerekend per pagina.

Dat is dezelfde soort belofte die `CLAUDE.md` verbiedt bij boekingen en
toegang, alleen dan over functies. Alle zeventien teksten zijn herschreven naar
wat de modules werkelijk doen, mét de eerlijkheidsregels die al in de code
stonden maar niet in de gids — dat RTG geen clubgids bijhoudt, dat Cellier
niets adviseert bij te kopen, dat Hangar geen live tracking doet.

Wat hier NIET aan gedaan is: een toets die dit machinaal vangt. Een
beschrijving vergelijken met wat een module doet, is een oordeel en geen
meting; wie daar een regel van maakt, krijgt vals alarm of vals vertrouwen.
Voor deze twaalf is het met de hand nagelopen en dat staat hier opgeschreven,
zodat de volgende die iets toevoegt weet dat de tekst óók bij de code hoort.

Twee waarschuwingen bij die meting, zodat niemand haar sterker leest dan ze is.
Ze kijkt naar **links en routes**, dus een laag die zijn domeinen via de server
ophaalt in plaats van via een link (precies wat de Media OS doet, en goed doet)
lijkt minder te dekken dan hij dekt. En een app zonder eigen route is niet
vanzelf leeg: hij kan op de gedeelde laag draaien.

Wat de meting wél hard maakte: `/api/member/rechterhand` wordt door **twaalf**
catalogus-apps aangeroepen — Cercle, Entourage, Attenties, Reisboek, Hangar,
Maison, Table, Cellier, Garde-robe, Logboek, Mecenaat en Nalatenschap. Dat ziet
eruit als twaalf ingangen naar één kern, en dus als een samensmelting. Het is
het niet: elk van de twaalf heeft een eigen module in `kern/rechterhand/` met
eigen data en een eigen workflow (een wijnkelder met drinkvenster is geen
nalatenschap met versleutelde velden). Ze delen een routenaam en een dossier,
niet een capability. **Een gedeeld routevoorvoegsel is geen gedeelde kern** — en
dat is precies de fout die de toetsvraag hierboven moet voorkomen.

---

## 1. Wat er vandaag al staat

Dit is geen groen veld, en dat is het belangrijkste feit in dit document. De
mechaniek die de visie vraagt, bestaat hier al in aanleg:

| Wat | Nu |
|---|---|
| genres (`supplierTypes`) | 73 |
| API-endpoints | 2745 |
| kernmodules (`server/kern/**`) | 806 |
| leverancier-app | **één** app die zich naar het genre voegt |
| personeels-PDA | **één** app, 16 tabs die op caps/type aanschakelen |

Eén leverancier-app voor 73 genres, en één PDA die zich naar functie en zaak
voegt. Dat is precies het model dat 130 losse apps voorkomt — het staat er al,
het heet alleen nog niet zo, en het houdt bij de huidige opzet niet vol tot 130.

De genres dragen **capabilities** (`caps`): `rooms`, `rides`, `menu`, `tickets`,
`retail`, `charter`, `marina`, `gebouw`, `boerderij`, `polis`, `beveiliging`,
`vastgoed`, `groothandel`, `ov`, `luchthaven`, `gemeente`. De app en de PDA
kijken naar die caps en niet naar het genre. Dat is laag 4 uit het plan, en die
laag werkt.

---

## 2. De zeven lagen, en wat er per laag ligt

| Laag | Wat het is | Staat er | Ontbreekt |
|---|---|---|---|
| 1 — Core | identiteit, organisaties, locaties, personen, rechten, documenten, geld, communicatie, workflow, audit | grotendeels: kluis met codenamen, SSO/SCIM, passkeys, betalen, grootboek, bestanden, auditlog | een expliciete organisatie-entiteit; een zaak is nu een rij in `suppliers` |
| 2 — Enterprise engines | CRM, ERP, HR, finance, procurement, inventory, assets, projecten, planning, service, BI, AI | veel, verspreid: payroll, roosters, voorraad, agenda, facturatie, boardroom, AI | ze staan naast elkaar, niet als aanroepbare motoren onder de genres |
| 3 — Industry engines | hospitality, horeca, retail, zorg, mobility, bouw, overheid … | **het aanknopingspunt**: elk genre draagt een `industry`, 73 genres in 26 sectoren; de sector doet zijn eerste echte werk in de handelsketen (de keuzelijst groepeert erop) | de motoren zelf — er hangt nog geen gedeelde sectorlogica aan |
| 4 — Capabilities | `rooms`, `rides`, `menu`, `tickets` … | **ja, en dit werkt** | meer caps naarmate sectoren erbij komen |
| 5 — PDA | één adaptieve Work PDA | **ja**, en de server bepaalt sinds kort welke modules een zaak krijgt (`server/kern/pda/modules.js`) | de PDA-delen zijn nog geen echte modules (één gesloten scope) |
| 6 — Business Network | vinden, RFQ, offerte, contract, order, intercompany, levering, factuur, betaling | **de keten staat** (`server/kern/handelsketen.js`) en draait op één paar: beachclub → wasserij | de veertien oude collecties migreren; koppeling naar het grootboek |
| 7 — Consumer Network | de ledenkant | **ja**, het verst ontwikkeld | — |

De conclusie uit die tabel: laag 1, 4, 5 en 7 staan. Laag 3 heeft sinds het
genre-register zijn ophangpunt maar nog geen motoren. Laag 2 ligt er als
onderdelen zonder samenhang. **Laag 6 bestaat niet**, en dat is de laag waar de
visie op staat of valt.

---

## 3. De drie breuklijnen

Dit zijn de plekken waar de huidige opzet de richting actief tegenwerkt. Ze zijn
alle drie nagemeten, niet aangenomen.

### Breuklijn 1 — een genre kende zijn sector niet ✅ *gedicht*

Een genre droeg een `label`, een `icon` en `caps`. Meer niet. Er was geen veld
dat zei dat `hotel`, `apartment`, `villa` en `wintersport` dezelfde
hospitality-motor delen. Gedeelde sectorlogica kon daardoor nergens wonen: aan
`rooms` gehangen lekte housekeeping naar `wellness`, aan `hotel` gehangen moest
het bij `villa` opnieuw.

**Wat er nu staat.** Het genre-register (`server/seed/genres.js` +
`genres-lijst.js`) draagt alle 73 genres met hun sector en caps op één plek —
26 sectoren, drie niveaus: **sector → genre → caps**. Ze stonden verspreid over
tien `initdata`-delen en zes kernmodules, elk met een eigen
`if (!supplierTypes.x)`-regel: dezelfde waarheid op zestien plekken.
`test/genreregister.test.js` zakt zodra iemand een genre buiten het register
definieert, dus de verspreiding kan niet terugkomen.

**Wat er nog niet is:** de sectormotoren zelf. Het veld is er, het ophangpunt is
er, maar er hangt nog geen gedeelde logica aan. Dat is stap 6 hieronder.

### Breuklijn 2 — B2B was paarsgewijs gebouwd ✅ *de weg ligt er*

Zaak-naar-zaak werkt vandaag, maar elk paar heeft zijn eigen uitvinding. Geteld
in de code staan er **veertien** verschillende aanvraag-/ordercollecties naast
elkaar:

```
bevAanvragen        groothandelOrders   mobOpdrachten      vakOffertes
winkelBestellingen  reisAanvragen       koppelVerzoeken    paskamerVerzoeken
orders              contracten          payrollContracten  betaalVerzoeken
identiteitVerzoeken paspoortVerzoeken
```

Elk met een eigen vorm, eigen statuswoorden en eigen endpoints. `groothandel`
heeft een volwaardige inkoopstroom, maar alleen naar groothandels. `samenwerking`
koppelt creators aan leveranciers, maar alleen die twee. Een beachclub die linnen
bij een wasserij wil bestellen kan dat niet, niet omdat het moeilijk is maar
omdat dat paar nog niet gebouwd is.

Dat is de N²-val: 73 genres die onderling zaken doen zijn 5329 paren. Bij 130
genres 16.900. Zo komt het er nooit.

**Wat er nu staat.** `server/kern/handelsketen.js` is die ene keten:

```
aanvraag → offerte → gunning → planning → levering (met bewijs) → factuur → betaling
```

Het vinden is het kernpunt en het was gratis dankzij stap 1: **een aanvraag gaat
naar een GENRE, niet naar een adres.** "Ik zoek een wasserij" bereikt elke
wasserij op het net, ook een die zich gisteren heeft aangemeld. Dat werkt voor
alle 73 genres tegelijk — dát is wat van N² weer N maakt. De beachclub die geen
linnen bij een wasserij kon bestellen, kan dat nu; en dezelfde weg draagt elk
ander paar zonder een regel extra.

Bewaakt door `test/handelsketen.test.js` (7) en `test/handelscherm.e2e.js`, met
het scherm op `/apps/handel.html`.

De factuur gaat de **centrale facturatielaag** in (`kern/facturatie.js`) en
krijgt daar zijn nummer: een handelsfactuur staat gewoon bij de leverancier
onder "verkocht" en bij de koper onder "gekocht", met de aanvraagreferentie
eraan. Een eigen nummerreeks zou twee soorten facturen in huis geven die elkaar
niet kennen.

**Wat er nog niet is:** de veertien oude collecties draaien er nog naast, en
"betaald" is een vaststelling door de koper — de factuur staat in het grootboek,
maar er wordt geen geld verplaatst.

### Breuklijn 3 — de PDA schaalde niet ✅ *half gedicht*

Er is één PDA, en dat is goed. De bron staat ook al opgeknipt: `personeel.js`
wordt door `scripts/bundel.js` samengesteld uit 28 delen in
`public/apps/personeel/`. Maar die delen zijn geen modules — ze delen één
gesloten scope en worden rauw aaneengeplakt, dus ze zijn niet los te laden, niet
los te toetsen en niet per genre in of uit te schakelen. Het opknippen is
leesbaarheid, geen architectuur.

Daarbovenop zat de echte fout: de tabs schakelden aan op `heeftX()`-controles die
aan de clientkant wisten welke caps er bestaan. De server wist welke caps een
zaak heeft, en de PDA wist nóg eens apart welke caps een tab verdienen —
LAT-regel 4, over de lijn heen. Een nieuw genre kreeg zijn caps op de server en
bleef in de PDA onzichtbaar, zonder dat iets klaagde.

**Wat er nu staat.** `server/kern/pda/modules.js` bepaalt welke modules een zaak
aanzet; de lijst komt mee in `/api/supplier/state` en de PDA schakelt daarop.
`test/pdamodules.test.js` bewaakt de lijn zelf: het zakt zodra de PDA een module
opvraagt die de server niet kent. Tabs die volgen uit wat een zaak feitelijk
heeft (kamers, een barstation op de kaart, een bezorgdienst die aanstaat) blijven
bewust in de PDA — dat is een gevolgtrekking uit eigen inhoud, geen tweede kopie
van de afbeelding.

**Wat er nog niet is:** de 28 delen van `personeel.js` zijn nog geen echte
modules. Ze delen één gesloten scope en worden rauw aaneengeplakt, dus ze zijn
niet los te laden of los te toetsen. Dat is de volgende stap voor deze laag.

---

### Correctie op stap 5: de veertien migreren niet allemaal

In een eerdere versie van dit bestand stond dat de handelsketen "de veertien
collecties op termijn vervangt". Dat is nagemeten en het klopt niet, en het
hoort hier te staan in plaats van stilletjes te verdwijnen (LAT-regel 6).

Wat de meting liet zien toen de eerste migratie werd voorbereid:

| collectie | wat het werkelijk is |
|---|---|
| `groothandelOrders` | koper kan een LID, een zaak of een groothandel zijn; met voorraadreservering en contractprijzen |
| `vakOffertes` | lid → zaak (`klant` is een codenaam), dus consument en geen B2B |
| `reisAanvragen`, `winkelBestellingen`, `orders` | lid → zaak |
| `bevAanvragen` | intern inzetverzoek dat in een ROOSTER eindigt; geen offerte, geen prijs, geen factuur |
| `identiteitVerzoeken`, `paspoortVerzoeken` | identiteit en privacy, geen handel |
| `payrollContracten` | arbeidsvoorwaarden |
| `betaalVerzoeken` | de betaalrail zelf |

Van de veertien is er dus geen enkele die ongeschonden in de keten past zoals
die er nu staat. `bevAanvragen` erin persen zou de roosterkoppeling weggooien;
`groothandelOrders` zou de voorraadreservering, de contractprijzen en de
consumentenkant kosten. **Een migratie die functies kost, is geen migratie maar
een achteruitgang.**

Wat er wél gedeeld hoort te worden, is niet de hele stroom maar de **staart**:

```
kop (verschilt)                          staart (gedeeld)
─────────────────────────────────────    ───────────────────────────────────────
aanvraag → offertes → gunning        ┐
rechtstreekse bestelling             ├─→ planning → levering (bewijs)
catalogus-order (voorraad, contract) ┘   → factuur → betaling
```

Daarom heeft de keten sinds deze ronde een **tweede ingang**: een rechtstreekse
bestelling bij een bekende zaak tegen een afgesproken prijs, die meteen op
"gegund" binnenkomt en daarna woordelijk dezelfde staart doorloopt. Dat is de
voorwaarde om `groothandelOrders` later zijn eigen kop te laten houden
(voorraad, contractprijzen) terwijl de afhandeling gedeeld wordt — zonder verlies.

De herziene stap 5 is dus niet "veertien migreren" maar: **de staart delen waar
hij hetzelfde is, en de kop laten waar hij verschilt.**

---

## 4. De volgorde

Klein en omkeerbaar eerst, en elke stap levert op zichzelf iets op. Niets
hieronder vraagt om het herschrijven van wat er staat.

1. ✅ **Eén genre-register, met een `industry` per genre.** Stap 1 en 2 uit de
   eerste opzet zijn samen gedaan, want ze raakten dezelfde regels.
   `server/seed/genres-lijst.js` draagt de 73 genres in 26 sectoren; de tien
   `initdata`-delen en zes kernmodules die hun eigen kopie hielden, wijzen nu
   hierheen. Bewaakt door `test/genreregister.test.js`.
2. ✅ **De PDA vraagt zijn modules aan de server.** `server/kern/pda/modules.js`
   bepaalt de lijst, `/api/supplier/state` levert hem, de PDA schakelt erop.
   Bewaakt door `test/pdamodules.test.js`, dat ook de lijn zelf toetst.
3. **De PDA-delen echte modules maken.** Nu nog 28 stukken in één gesloten
   scope. Zolang dat zo is, kan een sector geen eigen PDA-module meebrengen
   zonder in de gedeelde bron te snijden. Dit is de laatste stap voordat laag 5
   op eigen benen staat.
4. ✅ **Het B2B-protocol, op één paar.** De keten staat en beachclub → wasserij
   loopt er helemaal overheen, van aanvraag tot betaling, inclusief scherm.
   Omdat het vinden op genre gaat, draagt diezelfde weg meteen elk ander paar.
5. **De staart delen waar hij hetzelfde is** — niet "de veertien migreren", zie
   de correctie hierboven. De tweede ingang (rechtstreeks bestellen) staat er;
   de volgende stap is `groothandelOrders` zijn eigen kop laten houden
   (voorraad, contractprijzen, de consumentenkant) en alleen de afhandeling aan
   de keten geven. En de factuur aan
   ~~de factuur aan `kern/facturatie.js` hangen~~ ✅ *gedaan* — de handelsfactuur
   krijgt haar nummer uit de centrale laag en staat bij beide zaken in de
   boekhouding. Wat rest: de veertien migreren, en van "betaald" een echte
   betaling maken in plaats van een vaststelling. **Dit is nu het grootste
   openstaande stuk.**
6. **Sectormotoren**, in volgorde van wat er al ligt: horeca en hospitality
   eerst (daar staat het meeste), daarna vakwerk/field service, daarna retail.
   Pas hier wordt "een hotel voelt als hotelsoftware" echt waar; het
   ophangpunt (`industry`) ligt er sinds stap 1.

Stap 1 en 2 zijn gedaan en waren de voorwaarde voor de rest: zonder één register
en zonder een serverzijdige modulelijst is elke sectormotor opnieuw een eilandje.
Stap 4 is geen dag werk maar een feature op zichzelf, en hoort als zodanig
gepland te worden — niet ertussendoor.

---

## 5. Wat dit niet wordt

Eerlijkheid hoort hier net zo goed als ambitie, en dit deel staat er zodat
niemand later een belofte aantreft die nooit waar was (LAT-regel 6).

- **Geen zorgsysteem dat medische zorg draagt.** Planning, dossiervoering,
  facturatie en communicatie kunnen; behandelbeslissingen, medicatiebewaking en
  wettelijke zorgregistratie niet zonder de certificering die daarbij hoort.
  Attribute-based access control is daarvoor de ondergrens, niet het antwoord.
- **Geen vluchtveiligheidskritieke software.** De bedrijfs- en operationele
  workflows eromheen wel.
- **Geen 112-vervanging.** De hulpdienst-genres staan er als RTG-net en zeggen
  dat zelf ook, in hun eigen omschrijving.
- **Geen bank.** Banksoftware leveren is iets anders dan een bank zijn.
- **Niet in één release.** Veertig sectormotoren met elk tien tot dertig modules
  is jaren werk. De lagen zijn zo gekozen dat elke sector die erbij komt
  goedkoper is dan de vorige; dat is de enige manier waarop het aantal ooit
  klopt.

---

## 6. Wat de lat hier betekent

Alles in dit document valt onder `LAT.md`. Twee regels wegen het zwaarst:

- **Regel 4 (nooit twee plekken die een waarheid vasthouden)** is de reden dat
  het genre-register en de PDA-modulelijst vooraan in de volgorde staan. De
  demozaken-opruiming van augustus was precies deze fout: een handmatige lijst
  naast de seed, vijftien zaken uit elkaar gelopen.
- **Regel 2 (elke bewering met een mutatie nagetrokken)** geldt ook voor de
  stappen hierboven. Een migratie van een van de veertien collecties is pas
  klaar als de toets die de oude vorm bewees, op de nieuwe vorm is zien zakken.
