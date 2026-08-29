# Het Mutatiecontractregister

*Wat dit huis van elke schrijfroute weet — en hoe hard dat is.*

Dit document hoort bij `server/kern/mutatiecontract/klassen.js` (de twee
woordenlijsten) en `server/kern/mutatiecontract/index.js` (de keuring), `server/lib/mutatiecontracten.js` (de bedoeling per route — het enige
mensenwerk) en `scripts/mutatiecontract.js` (de afleiding). Lees het met
`CONTROLPLANE.md` ernaast: dat gaat over wie iets **mag**, dit over wat een
tweede aanroep **doet**.

---

## 0. De regel die alles stuurt

> **100% geclassificeerd, 100% meetbaar waar technisch zinvol, 0% schijnzekerheid
> — niet 100% idempotent.**

Dat onderscheid is niet cosmetisch. Een route die met opzet géén idempotente
handeling is — een dobbelworp, een teller, een bericht dat je twee keer
verstuurt — is **klaar** zodra dat is vastgesteld en bewezen. Wie dat omdraait
en op "alles idempotent" stuurt, verbouwt de architectuur om een percentage
mooi te krijgen, en dat kost meer dan het gat dat het dicht.

Daarom heeft precies **één** van de zes standen de plicht naar nul te gaan.

---

## 1. Vijf assen, vijf huizen

De duurste fout die in dit huis gemeten is (`SEMANTIEK.json`: 78 namen met meer
dan één betekenis, waarvan twee bestanden met allebei een `VERMOGENS` en nul
gedeelde leden) ontstaat door één begrip op twee plekken. Daarom staat van elke
as precies waar hij woont, en herhaalt het contract er geen enkele.

| | as | vraag | huis |
|---|---|---|---|
| 1 | **semantiek** | wat *is* deze mutatie? | `server/kern/mutatie.js` |
| 2 | **duplicaatgedrag** | wat is "hetzelfde verzoek"? | `server/lib/idemsleutels.js` |
| 3 | **bewijs** | wat is er gemeten? | `IDEMPROEF.json` |
| 4 | **toegang** | wie mag hier binnen? | `kern/mutatiecontract/klassen.js` — **nieuw** |
| 5 | **stand** | hoe hard is onze kennis? | `kern/mutatiecontract/klassen.js` — **nieuw** |

As 1 t/m 3 bestonden al. Het contract voegt er twee toe en brengt de vijf samen
in één afgeleid register.

**Waarom as 4 nieuw is.** `scripts/lib/bewakers.js` kent zeven *soorten* deur,
maar dat is een waarneming aan de router — "hier staat `officeAuth`". Het zegt
niets over wat de bedoeling was. Een route zonder bewakerslaag is daar een
restpost; hier is het een besluit: met opzet open (`PUBLIC`), bewaakt in de
handler (`CAPABILITY_GATED`), of een gat. Waarneming en bedoeling staan apart in
het register, en waar ze uiteenlopen is dat een **tegenspraak** — de enige manier
waarop een verkeerd bedoelde deur ooit opvalt.

---

## 2. De zes standen

Alleen de laatste moet naar nul.

| stand | betekenis | wat het contract eist | eind? |
|---|---|---|---|
| `PROTECTED` | een herhaling doet het werk niet nog eens | een **meting** waarin de tweede oproep geen tweede effect had | ✅ |
| `INTENTIONALLY_NON_IDEMPOTENT` | een herhaling ís een tweede handeling, en dat hoort zo | een **reden** én een **meting** | ✅ |
| `NOT_APPLICABLE` | deze route verandert niets | een meting zonder spoor **én** een mens die de handler nakeek | ✅ |
| `UNTESTABLE_WITH_JUSTIFIED_REASON` | van buiten niet te beproeven, structureel | de reden, en wat waar zou moeten worden om het wél te kunnen | ✅ |
| `BLOCKED_BY_TEST_FIXTURE` | beproefbaar, maar de opstelling kan de toestand nog niet bouwen | **wat er moet worden gebouwd** — een opdracht, geen wachtkamer | ⏳ |
| `LEGACY_PENDING_CLASSIFICATION` | nog niet ingedeeld | niets, en dat is het probleem | ❌ → 0 |

De middelste kolom is het hele verschil met een lijstje etiketten. **Een stand
zonder bewijseis is een etiket dat iedereen erop kan plakken, en dan zegt 100%
niets.** De strengste eisen staan op de twee standen die toestemming geven om
níéts te doen — `INTENTIONALLY_NON_IDEMPOTENT` en `NOT_APPLICABLE` — want dat is
de knop waarmee 4.653 routes anders in een middag "geclassificeerd" zijn.

Twee eisen die er in de praktijk het meest uithalen:

- `INTENTIONALLY_NON_IDEMPOTENT` eist een reden **én** een meting. "Het hoort zo"
  en "het gebeurt ook zo" zijn twee beweringen, en juist hier moeten ze allebei
  waar zijn.
- `NOT_APPLICABLE` eist `nagekeken`. De meter ziet alleen de collecties in de
  database; een schrijfactie naar een bestand, een externe dienst of een teller
  daarbuiten ziet hij niet. Zonder een mens die de handler heeft gelezen is
  "verandert niets" een gevolgtrekking uit afwezig bewijs.

---

## 3. De zes toegangsklassen

`PUBLIC` · `AUTHENTICATED` · `CAPABILITY_GATED` · `OBJECT_SCOPED` ·
`SERVICE_TO_SERVICE` · `SYSTEM_INTERNAL`

Drie ervan eisen een veld, en om dezelfde reden als hierboven:

- `CAPABILITY_GATED` noemt de **naam** van de bevoegdheid — anders praat het
  contract over iets anders dan `kern/bevoegdheid/lijst.js` en valt dat nooit op.
- `OBJECT_SCOPED` noemt het **veld** dat het object aanwijst — zonder dat kan geen
  proefopstelling de toestand bouwen, en is de route alleen te beproeven met een
  tweede eigenaar (een IDOR-proef, niet deze).
- `PUBLIC` noemt de **reden**. Open is een besluit; zonder reden is het een gat
  dat toevallig nog niemand heeft gedicht.

---

## 4. De vijf inventarissen

Er circuleerden vier getallen die alle vier "het aantal routes" heetten: 4.103,
3.074, 4.564 en 4.643. Geen van vieren fout, alle vier iets anders — en dat stond
nergens. Zolang dat zo is, is elk percentage onbruikbaar: *845 van 3.074* en
*845 van 4.643* zijn hetzelfde werk met tien procentpunt verschil.

`scripts/mutatieinventaris.js` leidt ze alle vijf af uit één bron en noemt elk
verschil als **regel**:

```
  4748  1. ROUTE INVENTORY -- alles wat de router kent
   -87     af: GET, en alles buiten /api/
  4661  2. MUTATION INVENTORY -- schrijfroutes onder /api/   <- noemer van IDEMSCHULD
    -8     af: de schakelkast
  4653     schrijfroutes buiten de schakelkast               <- noemer van het CONTRACT
   -10     af: paden met een parameter (/api/x/:id)
  4643  4. IDEMPOTENCY INVENTORY -- wat de idemproef kan aanroepen
  ....  5. EVIDENCE INVENTORY -- waarover werkelijk iets is vastgesteld
```

En het bewaakt de **kruisingen**: gemeten buiten de inventaris (hoort 0 te zijn)
en verklaringen voor een route die niet bestaat (die houden een schuldgetal
kunstmatig laag). Beide staan vandaag op 0.

---

## 5. Wat een machine hier nooit mag

**Een stand wordt nooit afgeleid uit bewijs.** Het bewijs draagt hooguit een
*voorstel*; de stand komt uit een verklaring van een mens in
`server/lib/mutatiecontracten.js`. Zou het afleidscript zelf mogen indelen, dan
stond het register binnen een uur op 100% en wist niemand meer wat dat betekende.

`test/mutatiecontract.test.js` dwingt dat af: elke rij met een andere stand dan
`LEGACY` moet een verklaring hebben.

Er is één plek waar dat pijnlijk concreet werd. Het eerste voorstelmechanisme las
`beschermd` uit de ronde **mét** idempotentiesleutel en stelde daar 1.087 keer een
verklaring op voor. Dat was waardeloos: de proef stuurt `idem` in het lijf, en
`server/middleware/idempotentie.js` is precies daarop opt-in voor élke
`/api`-POST. Die uitslag mat dus de platformlaag die de proef zelf voedde.
Nagemeten: van vijf routes die mét sleutel `herhaald: true` gaven, gaven er vier
zónder sleutel gewoon `herhaald: false`.

Sindsdien meet de idemproef een **tweede ronde zonder enige sleutel** — de echte
dubbeltik — en alleen díé telt voor het contract.

En binnen die ronde zijn er nog drie gronden waarvan er maar twee idempotentie
zijn:

| grond | betekenis | gemeten 29-08-2026 | voorstel |
|---|---|---|---|
| `opslag` | eerste oproep deed werk, herhaling niet | **2** | `PROTECTED` |
| `gemerkt` | de server zei zelf `herhaald: true` zonder sleutel — dat kan alleen de idem-poort zijn, op grond van een verklaring | **24** | `PROTECTED` |
| `geweigerd` | de herhaling kreeg een 409 of 403 | 0 | **geen** — dat is een toestandscontrole, geen herkende herhaling |

Die kolom is het scherpste getal in dit document. Van **4.653 schrijfroutes**
vangen er **26** een echte dubbeltik op, en **24 daarvan alleen omdat iemand een
verklaring heeft geschreven**. Het mechanisme werkt dus precies waar het is
verteld, en nergens anders. Zonder de grond stond hier "1.382 beschermd" — de
platformlaag die de proef zelf voedde.

Die laatste rij komt uit een fout die dit huis al eens 16 zakkende toetsen kostte:
een `zelfdeVerzoek` legt daar het eerste antwoord over een bewuste weigering heen.

---

## 6. De poort

Regel 64 van `scripts/check.js` meldt wanneer het register achterloopt op de
code; `test/mutatiecontract.test.js` houdt `LEGACY_PENDING_CLASSIFICATION` op een
grens die **alleen mag krimpen**. Samen: een nieuwe schrijfroute die geen contract
krijgt, laat de bouw zakken.

Met terugwerkende kracht 4.653 routes classificeren is een megaproject dat vooraf
moet slagen. Dit huis doet het andersom, precies zoals `kern/mutatie.js` dat aan
de rand van het platform al deed: **alles wat nieuw is, noemt zijn contract.** Zo
groeit de dekking mee met wat er bijkomt, terwijl de erfenis van achteren wordt
opgeruimd.

---

## 6b. De eerste drieëntwintig

Het register staat op **23 van 4.653 geclassificeerd (0,5%)**, en alle 23 op
`PROTECTED`. Ze zijn niet door een script ingedeeld: voor elk van hen stond de
*bedoeling* al in `idemsleutels.js` als `zelfdeVerzoek` — geschreven door iemand
die vond dat een woordelijk gelijk verzoek binnen vijf seconden een dubbeltik is.
Wat ontbrak was het **bewijs dat het ook zo gebeurt**, en dat is nu van de
scherpste soort die deze proef kent: de kale ronde stuurde geen sleutel mee en
kreeg toch `herhaald: true` terug. Dat kán alleen de idem-poort zijn, en die
handelt uitsluitend op een verklaring. Bedoeling en gedrag vallen aantoonbaar
samen.

**Drie routes zijn er met opzet niet bij**, en ze zijn leerzamer dan de 23:

- `POST /api/overheid/water/meld` gaf `herhaald: true` zonder sleutel én zonder
  verklaring. Dat hoort niet te kunnen. Ergens doet een laag iets dat niemand
  heeft opgeschreven — eerst uitzoeken welke.
- `POST /api/metier/zoek` en `POST /api/bedrijf/apparaten` kwamen als
  `grond: opslag` binnen: bij de eerste kale oproep bewoog er iets, bij de tweede
  niet. Maar `/api/metier/zoek` is een **zoekroute** — hij verandert niets. Wat
  daar bewoog was `wacht`, de emmer van een rem. Een voorstel `PROTECTED` zou daar
  de verkeerde semantiek vastleggen; de juiste stand is `NOT_APPLICABLE`.

Dat laatste is een echte zwakte van deze meetweg en staat sindsdien in het
voorstel zelf: de ruisijking vangt alleen wat bij *elke* oproep beweegt, dus een
rem die alleen de eerste keer aanslaat glipt er per definitie langs. Het voorstel
noemt daarom de collecties waarin het verschil zat, zodat de mens die bevestigt
kan zien of dat werk van de route was of van een meter.

---

## 7. Wat er vandaag níét is

Eerlijk, met de reden:

- **Bijna alles staat op `LEGACY`.** Dat is de stand van zaken en geen tegenvaller:
  dit huis wist van vrijwel geen enkele route formeel wat een tweede aanroep
  hoort te doen. Het register maakt dat zichtbaar in plaats van het te verhullen.
- **De 10 routes met een pad-parameter zijn niet gemeten.** Een verzonnen `:id`
  levert een 404 op die niets meet. Ze horen bij een proef die eerst een object
  aanmaakt en dan zijn eigen id invult — de lifecycle-opstelling uit par. 8.
- **Mutaties die niet over HTTP binnenkomen staan er niet in.** Een taak, een
  achtergrondlus, een migratie: niet geteld is niet veilig, en dat staat als
  grens in `MUTATIEINVENTARIS.json`.
- **`reviewed_by` en `reviewed_at` zijn nog geen verplicht veld.** Ze horen erbij
  zodra de eerste tientallen contracten er zijn; ze nu eisen levert lege velden
  op, en een leeg verplicht veld leert mensen het in te vullen zonder te kijken.

## 8. De volgende stap: lifecycle in plaats van twee HTTP-oproepen

Twee identieke oproepen zijn de zwakste vorm van deze proef. De sterke vorm bouwt
een echte levensloop op:

```
  eigenaar aanmaken
  vreemde actor aanmaken
  object aanmaken
  bevoegdheid geven / intrekken
  muteren
  nog eens muteren
  toestand + bewijs inspecteren
```

Dat beproeft in één gang de idempotentie **en** de objectgrens (IDOR) **en** de
intrekking van een bevoegdheid. `scripts/lib/idemwereld.js` zet vandaag de eerste
drie stappen (een gezin, een werkruimte met een toegelaten lid, een school via de
volledige registratieketen); de laatste vier bestaan nog niet.
