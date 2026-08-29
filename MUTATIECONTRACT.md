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

## 5. Wat een machine hier wel en niet mag

**Een uitspraak over gedrag wordt nooit door een script gezet.** Vijf van de zes
standen doen zo'n uitspraak — hij is beschermd, hij verandert niets, hij hoort
een tweede handeling te zijn — en geen enkele meting leest de *bedoeling* van een
handeling af. Twee keer `{}` naar een dobbelworp zijn twee legitieme worpen.

`BLOCKED_BY_TEST_FIXTURE` doet precies de omgekeerde uitspraak: **wij weten het
niet, en dit is waarom de proef er niet bij kwam.** Dat is een werkopdracht met
een adres, en de grond ervoor is hard — de route gaf zijn eigen hindernis terug
("Dit gezin kennen we niet. Klopt de gezinscode?"). Die mag een script schrijven.

Daarom draagt elk contract een **`herkomst`**: `'mens'` of `'afgeleid'`, en
`'afgeleid'` is alleen toegestaan bij die ene stand. De twee wonen ook in
verschillende bestanden — `mutatiecontracten.js` tegenover
`mutatiecontracten-afgeleid.js` — zodat wie er een opent meteen ziet of er iemand
over heeft nagedacht. Een mens wint altijd van een script; de afleidgang slaat
over wat al een menselijk contract heeft.

Het dashboard telt ze apart, en dat is geen detail: 2.722 afgeleide regels
meetellen als "vastgesteld" zou van dit register precies de schijnzekerheid maken
die het moet voorkomen.

**Eén valstrik die de afleidgang bijna stil leegmaakte.** De eerste versie
filterde op `stand === LEGACY`. Na de eerste gang staan die 2.722 routes op
`BLOCKED`, dus een tweede gang sloeg ze allemaal over, schreef nul regels en
overschreef het bestand met een lege lijst — 2.722 regels weg zonder dat er iets
veranderde, en de volgende meting had dat als vooruitgang gelezen. De juiste vraag
is niet "staat hij nog op LEGACY" maar "heeft een **mens** hem al vastgesteld".

---

## 5b. De tweede bewijslijn, en waarom hij alleen mag weerleggen

`NOT_APPLICABLE` eist bewijs dat er niets verandert, en de opslagmeter alleen is
daar te zwak voor: hij ziet de collecties in de database, dus niet een bestand,
een bericht of een teller daarbuiten. "Geen spoor" is uit die ene meter een
gevolgtrekking uit *afwezig* bewijs.

`scripts/schrijfanalyse.js` kijkt uit de andere richting: niet wat er gebeurde,
maar wat er in de code *kan* gebeuren. De uitkomst over 4.441 routes:

| | |
|---|---|
| schrijft aantoonbaar | 938 |
| leest aantoonbaar | 62 |
| **onbekend** | **3.441** |

Die 3.441 is geen meetfout maar de vorm van dit huis: bijna elke handler
verwijst door naar de kern, en `res.json(metier.zoek(...))` zegt in zichzelf
niets. Volgen over modulegrenzen zou dat oplossen, maar een resolver over 2.861
bestanden die er ergens één mist, levert een `nee` die niet klopt — en die zou
hier als bewijs onder een contract belanden.

**Dus wordt de analyse alleen als veto gebruikt.** Zijn schrijfvormenlijst is met
opzet te ruim, wat hem waardeloos maakt om iets te bewijzen en uitstekend om iets
te weerleggen. Resultaat: **185 routes** waar de opslagmeter niets zag maar de
code wél kan schrijven. Die zijn geen `NOT_APPLICABLE`-kandidaat meer — er
verandert iets dat de meter niet ziet, en dat is exact het gat waarvoor die stand
om `nagekeken` vraagt.

Waar beide methodes hetzelfde zeggen (39 routes) is het bewijs juist sterker dan
één mens die één keer keek, want het is herhaalbaar. Daarom mag `nagekeken` ook
een **noembare methode** zijn in plaats van een persoon — maar nooit leeg, en
nooit "gecontroleerd": het veld moet zeggen wie of wát er heeft gekeken, en de
keuring weigert een waarde onder de vijftien tekens.

**Een gat in die analyse, gevonden door drie treffers met de hand na te kijken.**
Een pijlfunctie zonder accolades kreeg een leeg lichaam:

```js
const aiStatus = () => require('../../ai-stand').beschikbaarheid(anthropic);
```

Leeg betekent geen schrijfvorm en geen aanroep, dus kwam er *bewezen leesroute*
uit — terwijl de functie een andere module aanroept. `POST /api/ai/status` stond
zo als bewijs in de uitslag. Geen enkele meter had dat gevonden;
`test/schrijfanalyse.test.js` doet het nu wel.

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

## 6b. De stand

```
Mutation inventory                4.653
Classified                        3.017   64,8%
  vastgesteld door een mens          64   (een uitspraak over gedrag)
  afgeleid door een script        2.953   (alleen: wij weten het niet, en waarom)

  PROTECTED                          24
  NOT_APPLICABLE                     40
  INTENTIONALLY_NON_IDEMPOTENT        0
  UNTESTABLE_WITH_JUSTIFIED_REASON    0
  BLOCKED_BY_TEST_FIXTURE         2.953   hoort te slinken
LEGACY_PENDING_CLASSIFICATION     1.636   moet naar nul
```

Die 59,9% is met opzet niet het getal om trots op te zijn — de 64 is dat. Wat de
2.722 waard zijn is dit: ze zijn niet meer *onbekend*, ze zijn *geblokkeerd, met
per stuk de reden en het adres van het werk*. Dat is het verschil tussen een hoop
en een wachtrij.

## 6c. De eerste vierenzestig

**Drieëntwintig op `PROTECTED`.** Ze zijn niet door een script ingedeeld: voor elk van hen stond de
*bedoeling* al in `idemsleutels.js` als `zelfdeVerzoek` — geschreven door iemand
die vond dat een woordelijk gelijk verzoek binnen vijf seconden een dubbeltik is.
Wat ontbrak was het **bewijs dat het ook zo gebeurt**, en dat is nu van de
scherpste soort die deze proef kent: de kale ronde stuurde geen sleutel mee en
kreeg toch `herhaald: true` terug. Dat kán alleen de idem-poort zijn, en die
handelt uitsluitend op een verklaring. Bedoeling en gedrag vallen aantoonbaar
samen.

**Veertig op `NOT_APPLICABLE`**, elk met twee onafhankelijke lijnen eronder: de
kale ronde mat twee geslaagde oproepen zonder spoor, én de statische analyse
herleidde elke aanroep in de handler en vond geen schrijfvorm. Het zijn er maar
veertig van 1.030 kandidaten, en dat is de eerlijke prijs van de regel dat de
analyse geen modulegrens oversteekt.

**Drie routes zijn er met opzet niet bij**, en ze zijn leerzamer dan de rest:

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

## 6d. De 1.867 die nog open staan, in vier bakken

Elke bak heeft een eigen remedie, en dat is de hele reden om ze te scheiden:

| | wat | remedie |
|---|---|---|
| 1.194 | twee geslaagde kale oproepen die **niets** achterlieten — `NOT_APPLICABLE`-kandidaten die op bevestiging wachten | een tweede bewijslijn, of een mens |
| 271 | hindernis wél, maar de **toegang** is niet af te leiden | de bewaking zit in de handler — zie par. 7.2 |
| 161 | de dubbeltik **deed het werk opnieuw** | een menselijk besluit: dubbeltik of tweede handeling? |
| 10 | niet gemeten (pad-parameter) | de lifecycle-opstelling uit par. 8 |

**Waarom die 1.194 niet machinaal te bevestigen zijn, en dat is een uitspraak
over de architectuur en niet over de meter.** De statische analyse is uitgebreid
met een resolver die één hop over de modulegrens gaat. Gemeten resultaat: `ja`
ging van 938 naar 979, `onbekend` van 3.441 naar 3.413 — **achtentwintig routes
van vierenveertighonderd**. De reden is structureel: de routelaag krijgt zijn
modules niet via `require` maar via één contextobject dat in `server/opzet/`
wordt samengesteld (`module.exports = (kern) => { const { bank, save } = kern; … }`).
Een resolver die requires volgt, kán `bank.bankOverboek()` daar niet vinden.

Dat is de prijs van injectie via een gedeelde context: soepele code, blinde
statische analyse. Wie deze bak wil legen, doet dat met een **runtime**-meting —
tellen wat een verzoek werkelijk aanraakt buiten de gemeten collecties (een
bestand, een bericht, een externe aanroep) — en niet met meer statisch turen. De
choke points daarvoor bestaan al, want de kostenlaag hangt er zijn meters aan.

Die 161 zijn de irreducibele kern: geen meting beantwoordt of twee identieke
overboekingen één dubbeltik zijn of twee betalingen. Maar het zijn er 161 en geen
4.653, en elk draagt zijn gemeten opslagverschil — dat is een middag werk voor
iemand die de domeinen kent, geen jarenlang project.

---

## 7.2 De bewaking die in de handler zit

Van de 660 routes zonder af te leiden toegang draagt een deel zijn poort níét in
de router maar in het lichaam:

```js
app.post('/api/rtf/samen/maak', (req, res) => {
  const s = samenSess(req, res); if (!s) return;
  ...
});
```

Voor de router is dat een route zonder enige bewaking.
`scripts/handlerbewakers.js` meet die vorm — een aanroep met `(req, res)` waarvan
de uitkomst meteen tot een `return` leidt — en de uitkomst is:

- over alle handlers: **60 verschillende poortvormen**, samen **1.220 routes**;
- binnen de 660 die vastzitten: **9 vormen**, samen **97 routes**.

**Die zestig zijn gelezen.** `server/kern/handlerpoorten/` draagt per poort wat
hij werkelijk doet: 30 `OBJECT_SCOPED` (met het veld dat het object aanwijst),
27 `AUTHENTICATED` (identiteitsversmallingen: geen gast, echt account, manager,
personeel) en 2 die **geen deur** zijn maar alleen een rem. Resultaat: de routes
zonder af te leiden toegang gingen van **660 naar 366**, en `OBJECT_SCOPED` van
215 naar 474.

**De sleutel was eerst fout, en dat is leerzaam.** Om de drie homoniemen uit
elkaar te houden leek `bestand:naam` veilig. Het werkte precies verkeerd om: een
poort wordt *gedefinieerd* in één bestand en *gebruikt* in tientallen —
`familieVan` staat in `server/foundation.js` en wordt in negen andere aangeroepen.
Van de 300 herkende poortvormen matchten er nog 41. De juiste lezing is dat geen
van de drie homoniemen in een **routebestand** staat: `bankprofiel.js`,
`office/samen.js` en `agenda-pro.js` registreren geen enkele route. De sleutel mag
dus de naam zijn, met `NIET_IN` voor de uitzondering — en een toets die zakt zodra
een van die drie bestanden alsnog een route krijgt.

**En drie van die negen dragen een naam die in dit huis ook iets anders
betekent.** `profiel` is in `routes/rtfschool.js` een gezinsprofiel-poort en in
`kern/spellen/magnaat/bankprofiel.js` een functie die cijfers uitrekent.
`beheerVan` is in `server/bedrijf/` een poort op een beheertoken en in
`kern/office/samen.js` een helper die een classificatie normaliseert. `lidVan` is
in `bedrijf/deuren.js` een poort en in `kern/agenda-pro.js` een functie die een
prefix van een string knipt.

Een map van naam naar toegangsklasse zou die drie verkeerd indelen, en het ergste
geval is stil: **een rekenfunctie die als bewaker wordt geteld, maakt van een open
route een `AUTHENTICATED`-route in het register.** Dat is dezelfde fout die
`SEMANTIEK.json` 78 keer vond, nu in de beveiligingslaag. Wie deze routes
indeelt, doet dat daarom per **bestand én naam**. Het script levert die lijst en
vult zelf niets in.

Dat is meteen het antwoord op de vraag of hier een uniform authority contract
moet komen: zolang de bewaking alleen uit handlercode te lezen is, kan geen
statische verificatie er iets hards over zeggen — en 60 vormen over 1.220 routes
is de prijskaart van die keuze.

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
