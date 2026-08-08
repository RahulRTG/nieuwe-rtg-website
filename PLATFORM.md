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
| 3 — Industry engines | hospitality, horeca, retail, zorg, mobility, bouw, overheid … | **niets als laag.** Genre-eigen logica hangt los in `kern/` | de laag zelf |
| 4 — Capabilities | `rooms`, `rides`, `menu`, `tickets` … | **ja, en dit werkt** | meer caps naarmate sectoren erbij komen |
| 5 — PDA | één adaptieve Work PDA | **ja**, `public/apps/personeel.html` | de tabs zitten hard in één bestand (zie breuklijn 3) |
| 6 — Business Network | vinden, RFQ, offerte, contract, order, intercompany, levering, factuur, betaling | fragmenten, per paar apart gebouwd | het protocol (zie breuklijn 2) |
| 7 — Consumer Network | de ledenkant | **ja**, het verst ontwikkeld | — |

De conclusie uit die tabel: laag 1, 4, 5 en 7 staan. Laag 2 ligt er als
onderdelen zonder samenhang. **Laag 3 en laag 6 bestaan niet**, en dat zijn
precies de twee die de visie dragen.

---

## 3. De drie breuklijnen

Dit zijn de plekken waar de huidige opzet de richting actief tegenwerkt. Ze zijn
alle drie nagemeten, niet aangenomen.

### Breuklijn 1 — een genre kent zijn sector niet

Een genre draagt een `label`, een `icon` en `caps`. Meer niet. Er is geen veld
dat zegt dat `hotel`, `apartment`, `villa` en `wintersport` dezelfde
hospitality-motor delen, of dat `restaurant`, `bar`, `club` en `beachclub`
dezelfde horeca-motor delen.

Het gevolg is dat gedeelde sectorlogica nergens kán wonen. Wie housekeeping
bouwt, bouwt het aan `rooms` vast of aan een genre. Wie het aan `rooms` hangt
krijgt het ook bij `wellness`, wie het aan `hotel` hangt moet het bij `villa`
overschrijven. Dat is de reden dat "een hotel voelt als hotelsoftware" nu alleen
bereikbaar is door per genre schermen bij te bouwen.

**Wat het wordt:** een genre krijgt een `industry`. Genres groeperen onder een
sector, de sector draagt de gedeelde motor, de caps blijven bepalen wat een
individuele zaak kan. Drie niveaus in plaats van twee: sector → genre → caps.

### Breuklijn 2 — B2B is paarsgewijs gebouwd, en dat is N²

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

**Wat het wordt:** één keten die elk genre spreekt, en die de veertien
collecties op termijn vervangt:

```
organisatie → locatie → persoon → product/dienst → aanvraag → offerte →
contract → order → planning → levering → bewijs → factuur → betaling → service
```

Eén protocol maakt van N² weer N: een genre hoeft alleen zijn catalogus te
publiceren en de keten te spreken, en kan dan met alle andere zaken doen.

### Breuklijn 3 — de PDA schaalt niet in zijn huidige vorm

Er is één PDA, en dat is goed. De bron staat ook al opgeknipt: `personeel.js`
wordt door `scripts/bundel.js` samengesteld uit 28 delen in
`public/apps/personeel/`. Maar die delen zijn geen modules — ze delen één
gesloten scope en worden rauw aaneengeplakt, dus ze zijn niet los te laden, niet
los te toetsen en niet per genre in of uit te schakelen. Het opknippen is
leesbaarheid, geen architectuur.

Daarbovenop zit de echte fout: de 16 tabs schakelen aan op `heeftX()`-controles
die aan de clientkant weten welke caps er bestaan. Dat is de dubbelvorm die
LAT-regel 4 verbiedt — de server weet welke caps een zaak heeft, en de PDA weet
nog eens apart welke caps een tab verdienen. Elk nieuw genre met een eigen
werkvloer vraagt een wijziging aan beide kanten, en die twee lopen uiteen.

**Wat het wordt:** de server levert bij de sessie welke modules deze medewerker
op deze plek mag zien; de PDA is een shell die ze laadt. Eén waarheid, aan de
serverkant, waar de rechten toch al wonen.

---

## 4. De volgorde

Klein en omkeerbaar eerst, en elke stap levert op zichzelf iets op. Niets
hieronder vraagt om het herschrijven van wat er staat.

1. **Genres krijgen een `industry`.** Puur additief: een veld erbij, niets dat
   breekt. Levert meteen wat op — de catalogus en de boardroom tonen nu allebei
   een platte lijst van 73 regels en kunnen dan per sector groeperen.
2. **Eén genre-register.** De 73 genres staan nu verspreid over tien
   `initdata`-delen. Ze horen op één plek te staan, met sector en caps erbij.
   Dit is LAT-regel 4 toegepast op de genres zelf, en het is dezelfde fout als
   de demozaken-lijst: een waarheid die over tien bestanden verspreid staat.
3. **De PDA vraagt zijn modules aan de server.** De server bepaalt bij de sessie
   welke modules deze medewerker op deze plek krijgt, de PDA schakelt daarop.
   Gedrag blijft gelijk; de dubbele waarheid over caps verdwijnt.
4. **Het B2B-protocol, op één paar.** De keten bouwen en er precies één echte
   stroom op zetten — beachclub → wasserij is een goede eerste, want die bestaat
   nog niet en is klein genoeg om af te maken.
5. **De bestaande veertien collecties migreren**, één per keer, elk met de
   toetsen die de oude vorm bewezen.
6. **Sectormotoren**, in volgorde van wat er al ligt: horeca en hospitality
   eerst (daar staat het meeste), daarna vakwerk/field service, daarna retail.

Stap 1 en 2 zijn samen een dag werk en maken stap 3 tot en met 6 mogelijk.
Zonder stap 1 en 2 is elke sectormotor opnieuw een eilandje.

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
