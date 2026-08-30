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

## 5c. De derde meter, en de fout die hij blootlegde

De statische analyse hierboven mag alleen weerleggen, dus onder `NOT_APPLICABLE`
bleef één meter over die alles moest dragen. Daarom staat er nu een derde:
`server/effectmeter.js`. Hij meet niet wat de code *kan* en niet wat er in de
*collecties* veranderde, maar of dit ene verzoek werkelijk **iets heeft gedaan**
— op drie choke points: een schrijfpoging (`save()` in `server/db/index.js`), een
mail en een sms (`server/mail.js`, `server/mail-lokaal.js`).

Drie regels houden hem eerlijk:

1. **Hij staat uit.** Zonder `RTG_STAATLOG` hangt hij niet eens in de keten —
   dezelfde vlag als de opslagmeter, want twee vlaggen voor één meetopstelling is
   er één te veel.
2. **Hij telt alleen choke points.** Een teller die op honderd plekken wordt
   aangeroepen, wordt op de honderdeneerste vergeten.
3. **Wat hij niet telt, staat met naam in het antwoord.** De kop
   `X-RTG-Effect-Niet-Gemeten` noemt `bestand` en `externe-aanroep`, en die tekst
   gaat mee in de grond van elk contract dat op deze meter leunt. Er is geen veld
   dat `0` teruggeeft voor iets dat niet gemeten wordt — dat is precies hoe een
   meter een geruststelling wordt.

Twee dingen die hij bewust *niet* meet en waarom: **bestandsschrijfacties** hebben
geen enkel choke point (uploads via `server/kluis.js`, de outbox rechtstreeks, een
handvol modules met een eigen `fs.writeFileSync`) — wie dat wil meten maakt eerst
één schrijfweg, en dat is een opruimklus en geen meetklus. **Externe aanroepen**
zouden halve dekking geven: `server/ai.js` is wel een choke point, de betaalrails
niet, en een meter die bij drie van de vier zwijgt leest als "er gebeurde niets".

**Hij telt de poging en niet de fysieke schrijfactie.** Een bundel van drie saves
plus zijn commit telt vier. Dat is bewust: de vraag hier is niet *hoeveel* maar
*iets of niets*, en die eerste vraag mag geen tak missen. De eerste versie telde
wél onder de bundelcheck, en meldde `geen` op een verzoek dat een compleet account
aanmaakte — `bijeen()` keert daar af met alleen een vlag, en de echte schrijfactie
loopt daarna via `saveDuurzaam()`, die `save()` lang niet in elke tak aanroept.

### De fout eronder: de async-context ging verloren bij het lezen van de body

De meter meldde ook na die reparatie `geen`. De oorzaak zat niet in de meter maar
in `server/web/body.js`, en ze raakt alles in dit huis dat met een async-context
werkt: **een luisteraar op een EventEmitter draait in de context van wie `emit`,
niet van wie hem heeft aangehangen.** De `end` van een verzoeklichaam komt uit de
HTTP-parser, dus alles ná `express.json()` liep buiten elke async-context die de
keten daarvóór had geopend.

Dat trof niet alleen deze meter. `server/kern/kosten/haak.js` draagt langs dezelfde
weg de vraag *wie betaalt dit*; die staat verderop gemount en ontsnapte daarmee aan
het gat, maar elke context die vóór de body-lezer wordt geopend was stil kapot.
`AsyncResource.bind` op de terugroep repareert het bij de oorzaak, één binding per
verzoek met een lichaam.

`test/effectmeter.test.js` houdt het vast, en die toets moest zelf twee keer
gemaakt worden: de eerste versie speelde het verzoek na met een `EventEmitter` die
zijn eigen `end` uitzond — binnen de context, dus zonder verlies. Die toets slaagde
ook zónder de reparatie en bewees dus niets. De parser is precies het stuk dat je
niet kunt naspelen; de toets draait nu over een echte socket.

## 5d. Geen sleutel is geen verzoek — op de handelingen die geld verplaatsen

Overal in dit huis is een idem-sleutel een **vangnet**: is hij er niet, dan gebeurt
het werk gewoon. Voor het overgrote deel is dat de juiste afweging — een dubbele
agenda-afspraak is hinderlijk, een geweigerd verzoek is erger.

Bij geld draait die afweging om, en de kale ronde zegt precies hoe hard:
**achttien geldroutes** deden bij een woordelijk gelijke herhaling zónder sleutel
het werk gewoon opnieuw. `/api/bank/overboek` boekte twee keer, `/api/bank/sepa`
stuurde twee keer het huis uit, `/api/pay/stuur` betaalde twee keer.

De grens staat in `server/lib/idem.js`, op de regel die er al stond:
`if (!sleutel) return werk()`. Een aanroeper die weet dat zijn handeling geld
verplaatst, zegt dat — `metIdem(sleutel, afdruk, werk, { geld: 'boekt van de ene
rekening naar de andere' })` — en dan wordt de sleutelloze aanroep geweigerd met
`400 IDEMPOTENTIESLEUTEL_VERPLICHT` en de reden van díé handeling erbij. **Twaalf
aanroepplekken** dragen die verklaring: storten, overboeken, SEPA, bulk/loon,
pasbetaling, wallet-brug, terugkerende reeks, geld sturen, een betaalverzoek
voldoen, opladen, een tik afrekenen en tegoed kopen.

### Waarom niet in de HTTP-poort, en hoe dat gemeten is

De eerste versie stond in `server/lib/idem-poort.js`, met een lijst van paden. Dat
is een aantrekkelijke plek — één middleware, alle routes — en hij was fout. Die
poort draait **vóór de bewakers**, dus een lid dat de rekening van een ander
probeerde kreeg `400` in plaats van `404`. Tien toetsen zakten, en twee ervan
meten juist die eigendomsgrens: *"B komt met zijn eigen geldige sessie nergens bij
A binnen"* zag hem niet meer.

Dat is de les die het waard is om op te schrijven: **een ergonomische regel mag
nooit een veiligheidsmeting blind maken.** In de geldlaag staat de weigering ná de
eigenaarscontrole (`if (!eigenaar(...)) return 404` staat in de kern boven de
`metIdem`-aanroep) en vóór het werk — de enige plek waar allebei waar is.

Er is daarmee ook géén tweede lijst: deze laag kent geen routes, en een register
van paden naast de aanroepplek loopt binnen een jaar uiteen. De verklaring staat
waar de handeling staat. `test/geldroutes.test.js` houdt de twaalf vast en zakt
zodra er een zijn `{ geld: … }` verliest.

## 5e. Het bewijsbesluit van 30 augustus 2026

De 851 `NOT_APPLICABLE`-voorstellen lagen klaar met twee onafhankelijke
runtime-metingen eronder, en bleven op `LEGACY` staan omdat een stand nooit uit
bewijs wordt afgeleid. Dat is geen impasse maar een vraag aan de eigenaar, en die
is beantwoord:

> **Twee onafhankelijke runtime-metingen die allebei nul lezen, met genoemd
> waarover zij zwijgen, is voldoende grond voor `NOT_APPLICABLE`.**

Dat is een besluit over de **bewijsstandaard**, niet over 788 losse routes — en de
aftekening zegt dat ook zo: *"besluit van de eigenaar over de bewijsstandaard;
niet route voor route door een mens gelezen"*. Dat verschil hoort te blijven
staan. Wie er later een naleest en zijn eigen naam eronder wil zetten, haalt die
route hier weg en zet hem met zijn naam in een van de andere contractbestanden:
een mens wint van een besluit over een standaard, net zoals een mens van een
script wint.

**Van de 848 voorstellen zijn er 788 afgetekend.** De overige 60 haalden de vier
eisen wel maar hebben geen waargenomen toegangsklasse. Een contract zonder deur
bestaat niet, en een verzonnen deur is erger dan een route die op `LEGACY` blijft
staan; ze wachten op de vraag welke deur zij hebben.

De routes staan in `server/lib/effectroutes.json` — alleen hun naam en hun deur.
De redenering, het bewijs en de aftekening staan één keer, in
`server/lib/mutatiecontracten-effect.js`. 788 keer dezelfde zin uitschrijven is de
vorm waarin een verschil onopgemerkt insluipt.

**Drie dingen houden dit besluit eerlijk**, en `test/mutatiecontract.test.js` zakt
zodra er één sneuvelt: elk contract komt door dezelfde keuring als alle andere;
elk noemt de meter én waarover die zwijgt; en geen van hen overschrijft een
contract dat wél gelezen is (`server/lib/mutatiecontracten.js` gooit erop, want
"zou niet moeten" is geen handhaving).

| | voor | na |
|---|---:|---:|
| `LEGACY_PENDING_CLASSIFICATION` | 1.584 | **40** |
| `NOT_APPLICABLE` | 40 | 1.060 |
| geclassificeerd | 3.069 | 4.613 van 4.653 (99,1%) |

### Een derde argument, en 147 deuren

Dezelfde ronde legde een gat in de detectie bloot dat groter was dan het bewijs
zelf. `const g = werkPoort(req, res, 'it');` is een gewone poort met een derde
argument dat zegt *welk recht* binnen die werkruimte — en de `const`-vorm eiste
precies `(req, res)`. Vrijwel heel `/api/bedrijf` viel daardoor buiten beeld, en
kreeg in het register "geen deur" in plaats van zijn werkelijke klasse.

`werkPoort` stónd al in het handgelezen register; alleen de vorm zag hem niet.
Eén teken in de reguliere expressie: **niet af te leiden 362 → 215**,
`OBJECT_SCOPED` 478 → 625. De naam wordt nog steeds tegen het register gehouden,
dus een rekenfunctie die toevallig `req` en `res` krijgt wordt hier geen deur —
dat is precies waarom die twee dingen gescheiden zijn.

Dat is ook waarom de deurloze bak zo lang groot bleef: hij zag eruit als een
lijst routes die publiek zijn, en was voor 147 stuks een lijst routes waarvan we
de poort niet herkenden.

### De verklaring die al bestond, twee mappen verderop

Van de routes zonder afleidbare toegangsklasse stonden er **99 al op een
mensgelezen lijst met een reden**: `PUBLIEK` in `scripts/check.js`, die
keuringsregel 28 afdwingt. Geen poort is namelijk twee heel verschillende
dingen — een gat, of een bewuste publieke deur — en die lijst kent het verschil
al. Ze stonden niettemin in het register als "toegang niet af te leiden".

Die lijst is verhuisd naar `scripts/lib/publiekeroutes.js` en wordt nu door
`check.js` én het contractregister gelezen. Twee kopieën zouden uiteenlopen, en
dan noemt de ene lijst een route publiek die op de andere een poort heeft
(LAT.md regel 4). De **reden reist mee in het contract**: `PUBLIC` zonder reden
is een gat dat toevallig nog niemand heeft gedicht, en de keuring weigert het.

Dat weigeren gebeurde ook meteen: dertien contracten uit
`scripts/effectcontracten.js` kwamen er zonder reden uit. `test/mutatiecontract.test.js`
houdt dat nu vast op de plek waar ze *ontstaan*, niet alleen waar ze worden
gekeurd.

**Een rem lijkt een deur, en daarom hoort die vraag als laatste te komen.** De
eerste versie raadpleegde de publieke lijst alleen wanneer er *geen* bewaker
stond. `/api/rtf/club/portaal` heeft er twee — en het zijn allebei
snelheidsremmen (`ipRem`, `codeRem`). Die tellen als bewaker, dus de publieke
controle werd nooit bereikt en de route bleef "toegang niet af te leiden",
terwijl zijn reden op regel 116 van diezelfde lijst staat. De vraag staat nu op
allebei de takken.

| | voor | na |
|---|---:|---:|
| toegang niet af te leiden | 215 | **96** |
| `PUBLIC` | 0 | 99 |

### Het montagepad hoeft niet geraden te worden

`router.post('/agenda')` in `server/foundation/onderwijs/schrift.js` past op
zeven routes — `/api/foundation/agenda`, `/api/genootschap/agenda`,
`/api/supplier/care/agenda` en nog vier. Niets toewijzen was tot nu toe het
enige eerlijke, en dat kostte veertien routes een klasse die zij wel degelijk
hebben.

Maar het montagepad staat in de **andere handlers van hetzelfde bestand**: die
matchen wél uniek, en het stuk dat voor hun bronpad wordt geplakt is het
voorvoegsel van dat bestand. Zijn die het onderling niet eens, of is er geen
enkele unieke, dan blijft het bij niets toewijzen.

Dat het geen gok is, is gemeten: veertien routes erbij en **nul** die daarna nog
dubbelzinnig zijn. De afleiding kiest dus nooit tussen twee kandidaten — hij
vindt er precies één of geen. De zeven die overblijven zijn bestanden waarvan het
voorvoegsel niet uit hun eigen handlers volgt.


### Waar de detectie ophoudt, en waarom dat hier is

Twee laatste vormen erbij, allebei eerst gemeten: een poort via een **namespace**
(`sctx.lidVan(req, res)` — de naam die telt staat na de punt) en een poort die het
**werk omhult** (`(req, res) => metPartner(req, res, p => …)`, waarbij de handler
geen eigen lichaam heeft). Samen tien routes, en dat is het eerlijke beeld: de
eerste vormen leverden er honderden, deze tien.

Ook toegevoegd: `horecaRekVan` als **alias**. `rekening.js` zet zijn `rekVan` op
de gedeelde kern onder die naam, en drie andere horecabestanden roepen hem zo aan
— een register op naam ziet dat als een tweede poort. Hij staat er met dezelfde
omschrijving bij, in plaats van dat de aanroepers hun naam veranderen: dat laatste
is een verbouwing, dit is een register.

**Hierna is de deurloze bak geen detectieprobleem meer.** Van de routes zonder
klasse bevat ongeveer de helft geen enkele aanroep met `(req, res)` — die hebben
werkelijk geen poort. Dat is geen gebrek in de meting maar een eigenschap van die
routes, en de vraag die overblijft (is dit een bewuste publieke deur of een gat?)
is er een die een mens beantwoordt, per route, met een reden.

## 5f. Eerst repareren, dan classificeren

De kale ronde vond **116 routes** waar een woordelijk gelijke herhaling zónder
sleutel het werk gewoon opnieuw deed. Dat is geen classificatievraag maar een
bevinding: een dubbeltik op een trage verbinding maakte daar een tweede project,
een tweede leerling, een tweede werkruimte, een tweede bankpas.

Van zestien is de handler nagelezen — de handler, niet de naam, want dat is de
fout waar `/api/muziek/maak` in `idemsleutels.js` het litteken van draagt. Bij elk
stond er een veld in de body dat bepaalt wát er ontstaat, dus is een tweede
identiek verzoek binnen het dubbeltikvenster een dubbeltik en geen tweede
bedoeling. De verklaringen staan in `server/lib/idemsleutels-kaleronde.js`, met
per regel het veld dat de identiteit draagt.

**De volgorde is hier het punt.** `PROTECTED` betekent "een herhaling doet het
werk niet nog een keer — vastgesteld, niet aangenomen". Dat etiket mag er dus pas
op als de meting het laat zien. Dus eerst de verklaring, dan de proef opnieuw
(zestien van de zestien gemeten als `beschermd`), en pas daarna het contract in
`server/lib/mutatiecontracten-kaleronde.js`.

Twee routes staan er bewust níét in. `/api/foundation/les/maak` is wél
gerepareerd en meet ook als beschermd, maar heeft geen waargenomen
toegangsklasse — een contract zonder deur bestaat niet.
`/api/supplier/bezorg/overzicht` meet als beschermd zonder dat zijn handler is
gelezen; die hoort er niet bij, want dan zou de aftekening niet kloppen.

### En de andere 100

Dezelfde behandeling voor de rest van de 116, in twee helften die het
tegenovergestelde vragen.

**55 kregen een duplicaatregel** (`server/lib/idemsleutels-kaleronde.js`): een
tweede ontwerp, een tweede uitnodiging, een tweede cadeaukaart, een tweede
werkruimte. Daarbij hoort ook de categorie die er onschuldig uitziet — de
overschrijving. Het ding blijft één, maar er komt wel een tweede regel in het
auditspoor, en dat spoor hoort te zeggen hoe vaak een *mens* op de knop drukte,
niet hoe vaak het verzoek aankwam.

**30 kregen er met opzet géén** (`server/lib/idemsleutels-kaleronde-b.js`), elk
met een reden, want dat is de moeilijkere helft:

| | waarom niet dedupliceren |
|---|---|
| rondes | de tweede ronde hoort iets anders te vinden — dat is het *bewijs* dat de eerste werkte |
| inzage | twee keer in een leerlingdossier kijken is twee keer kijken; het inzagejournaal hoort dat allebei te dragen |
| momenten | een pols, een locatiemelding, een vraag aan de AI — twee keer is twee keer |

Die laatste categorie is niet theoretisch: `/api/supplier/security` is een
**alarmknop**. Een laag die de tweede druk opslikt, kan iemand in nood stil laten
staan.

Voor die dertig levert de kale ronde per definitie geen voorstel — geen meter
leest een bedoeling af. Maar het bewijs dat `INTENTIONALLY_NON_IDEMPOTENT` eist
("bewijs dat het gedrag ook werkelijk zo is") is er wél: alle dertig zijn gemeten
als `onbeschermd`. De reden staat op één plek, in de sleutellijst waar hij ook de
idem-poort stuurt; het contract haalt hem daar op en **gooit** als hij ontbreekt,
in plaats van een lege string te dragen.

| | voor | na |
|---|---:|---:|
| dubbeltik opgevangen | 33 | **86** |
| dubbeltik deed het werk opnieuw | 148 | **93** |
| `PROTECTED` | 24 | **78** |
| `INTENTIONALLY_NON_IDEMPOTENT` | 32 | **62** |
| `LEGACY_PENDING_CLASSIFICATION` | 576 | **492** |

### Drie soorten blindheid, en de derde was de sluipendste

De bak "geen deur" leverde over drie rondes drie structurele oorzaken op, elk met
een ander soort blindheid:

| | wat de detectie niet zag |
|---|---|
| namespace | `sctx.lidVan(req, res)` — de naam die telt staat ná de punt |
| omhulling | `(req, res) => metPartner(req, res, p => …)` — de handler heeft geen eigen lichaam |
| **lus** | `app.post('/api/rtf/spel/' + naam, …)` — het **pad staat niet in de brontekst** |

Die laatste kostte 43 routes. De poort was er wel degelijk (`rtfSpeler`, en die
stond al in het register), maar geen enkele lezer die de brontekst op routepaden
afzoekt vindt een route waarvan het pad een expressie is. In het register stond
"geen deur" bij routes die er een hebben.

`FAMILIES` in `server/kern/handlerpoorten/index.js` beschrijft zo'n lus: een
voorvoegsel plus de poort die hij aanroept, met het bestand en de regel erbij —
want dat is waar een volgende lezer moet kijken als de lus verandert. Het is
uitdrukkelijk *geen* raadpartij: de lus staat op één plek, roept één poort aan, en
elke route die eruit komt loopt er langs. Voor een voorvoegsel met verschillende
poorten eronder is het onbruikbaar, en dat staat er ook zo.

**Het voorvoegsel staat er in segmenten** (`['api', 'rtf', 'spel']`) en niet als
pad. Twee keuringsregels lezen elk `'/api/…'` in `server/` als een *registratie*
van die route — terecht, want zo vind je een pad dat twee keer wordt aangemaakt.
Een lijst die routes beschrijft ziet er voor die regels precies zo uit als een
lijst die ze aanmaakt, en ging er meteen op af. Segmenten maken het verschil
zichtbaar in de code zelf.

### En een fout van mijn eigen makelij

`scripts/effectcontracten.js` sloeg routes over die al een contract hadden, en las
daarvoor een **hardgecodeerde lijst van vier zijbestanden**. Toen er drie
bijkwamen, groeide die lijst niet mee: het script schreef generieke contracten
over routes die inmiddels met de hand waren gelezen.

De overschrijfcontrole in `mutatiecontracten.js` gooide daarop — precies waarvoor
zij is gemaakt. Maar een controle die achteraf gooit is de *tweede* verdediging;
de eerste is dat zo'n lijst niet kán achterlopen. Hij wordt nu **gevonden in
plaats van getypt** (met een ondergrens die stopt als er te weinig ligt), en het
aantal overgeslagen contracten sprong van 96 naar 180 — precies de contracten die
het script overheen wilde schrijven.

| | voor | na |
|---|---:|---:|
| toegang niet af te leiden | 96 | **53** |
| `LEGACY_PENDING_CLASSIFICATION` | 492 | **452** |
| geclassificeerd | 4.161 | **4.201 van 4.653** |

## 5g. Een meting wint van een vorm

`scripts/schrijfanalyse.js` mocht als **veto** dienen: te ruim om iets te
bewijzen, uitstekend om iets te weerleggen. Dat klopte toen de opslagmeter de
enige andere lijn was. Het klopt niet meer.

Gemeten op de routes die erop stranden: **178 van de 194** werden geveto'd, en het
bewijs daaronder is `Object.assign`, een lijst-mutatie, en op één plek een
variabele die `antwoord` heet. De schrijfvormenlijst loopt van `save()` — een
echte schrijfaanroep — tot dingen die elke route doet die een antwoord
samenstelt.

Die analyse bestond om te dekken wat de opslagmeter niet ziet. Voor twee van die
drie dingen (een schrijfactie via `save()`, een bericht) doet `server/effectmeter.js`
dat nu **rechtstreeks**, en beter: hij meet wat er *gebeurde* in plaats van wat de
vorm van de code suggereert. Wat hij niet ziet — een bestand, een externe aanroep
— noemt hij bij naam, en dat staat in elk contract dat op hem leunt.

**De regel is dus: heeft de effectmeter een meting, dan wint die van een vorm.
Zwijgt hij, dan blijft het veto onverkort staan** — want dan is de analyse weer de
enige die het gat afdekt. Dat is een verscherping en geen versoepeling: er komt
een sterker bewijs in de plaats van een zwakker, niet minder bewijs.

### En elf redenen die alleen in volgorde klopten

De toets die eist dat een `PUBLIC`-contract een reden draagt, ving iets anders:
elf regels in de publieke lijst zeiden letterlijk **`'idem'`** — een verwijzing
naar de regel erboven. Leesbaar zolang je de lijst van boven naar beneden leest,
betekenisloos zodra hij ergens anders wordt gebruikt. En dat gebeurde: het
contractregister neemt die reden over in het contract van die route, en zette
"idem" onder een route waar niets boven staat.

Alle elf staan nu uitgeschreven, en de kop van dat bestand zegt waarom: *een reden
die alleen klopt in volgorde, is geen reden.*

| | voor | na |
|---|---:|---:|
| routes onder het bewijsbesluit | 804 | **1.002** |
| `NOT_APPLICABLE` | 865 | **1.042** |
| `LEGACY_PENDING_CLASSIFICATION` | 452 | **271** |
| geclassificeerd | 4.201 | **4.382 van 4.653 (94,2%)** |

### De vierde vorm, en waar de opbrengst ophoudt

`const wie = wieScant(req); if (!wie) return res.status(401)…` — een poort die
alleen `req` krijgt, want hij leest de kop zelf en antwoordt niet zelf. **136
handlers**, waarvan er 90 een poort noemen die het register al kende.

Dat is ook waar dit ophoudt: die 136 leverden **vier** routes op in de deurloze
bak. De 90 hadden hun klasse allang van de bewaker op de router; ze waren alleen
niet zichtbaar als poort *in* de handler. De reeks vormen is daarmee uitgeput —
de eerste leverde honderden, deze vier.

**Bij deze vorm telt de naamcontrole het zwaarst**, en dat is geen theorie.
`(req)` nemen doet elke hulpfunctie. `mij` uit `server/routes/veiligheid.js` is
`(req) => req.session.key`: hij *leest* de sessiesleutel en controleert niets — de
deur staat op de router. Hij ziet er precies zo uit als een poort, en zonder een
regel die zegt dat hij er geen is, kregen 23 routes hun toegangsklasse van een
leesfunctie. Hij staat daarom in het register, als `geen-deur`.

### De objectpoort op de router, en het veld dat niemand had opgeschreven

Dertien werkplek-routes stonden stil op precies één ontbrekend gegeven. Ze
haalden alle vier de bewijseisen, hun toegangsklasse was bekend
(`OBJECT_SCOPED`) — maar een `OBJECT_SCOPED`-contract moet noemen *welk veld*
het object aanwijst, en dat wist niemand.

De reden: hun objectpoort hangt op de **router** (`app.post(pad, huisAuth, …)`),
niet in de handler. De bewakerskaart ziet hem wel — zij leest de router — en weet
dat het een objectpoort is, maar niet welk veld uit het lichaam het object kiest.
Het handlerpoortregister ging uitdrukkelijk over poorten *in de handler*.

`ROUTERPOORTEN` in `server/kern/handlerpoorten/index.js` vult dat gat, en staat
er **apart** van de handlerpoorten: het zijn twee verschillende waarnemingen, de
een leest de handler en de ander de router. Zes bewakers, elk veld gelezen in de
bewaker zelf, met het bestand erbij:

| bewaker | veld | waar |
|---|---|---|
| `huisAuth` | `bedrijf` | `routes/werkplek.js` |
| `huisPoort` | `bedrijf` | `routes/kantoorpakket-huis.js` via `huisDrive()` |
| `gezinsPoort` | `code` | `routes/tiener.js`, `routes/baby.js` |
| `rtfPoort` | `code` | `routes/kantoorpakket-huis.js` |
| `gastAuth` | `sleutel` | `routes/gast.js` |
| `arrivalPassAuth` | `pass` | `routes/supplier/horeca/arrival-toegang.js` |

| | voor | na |
|---|---:|---:|
| voorstellen zonder bruikbare deur | 21 | **8** |
| routes onder het bewijsbesluit | 1.002 | **1.015** |
| `LEGACY_PENDING_CLASSIFICATION` | 271 | **258** |
| geclassificeerd | 4.382 | **4.395 van 4.653 (94,5%)** |

### De poort die niet te zien is, en de fout die ik daarbij maakte

Er blijft een rest waar geen enkele detectievorm bij kan, en niet door
slordigheid: de poort staat **inline in de handler, zonder de vorm van een
poort**. `rtf.verifieerProfiel(req.body.code, req.body.token)` krijgt geen `req`
en geen `res` maar twee velden uit het lichaam; een vorm die dát vangt, vangt
elke functie met twee argumenten.

Voor die routes is er één eerlijke weg: iemand leest de handler en schrijft op
wat hij ziet. Dat is `ROUTEPOORTEN` in
`server/kern/handlerpoorten/buiten-routes.js` — 24 routes, elk gelezen, elk met
de reden in de bewoording van die handler.

`buiten.js` draagt daarmee drie registers, en het zijn drie **verschillende**
redenen waarom een lezer niets vindt:

| | waarom onzichtbaar |
|---|---|
| `ROUTEPOORTEN` | de poort staat inline, zonder poortvorm |
| `ROUTERPOORTEN` | de poort hangt op de router; het objectveld staat nergens |
| `FAMILIES` | de route komt uit een lus, dus zijn pad staat niet in de bron |

**En dan de fout.** Ik zette `/api/login`, `/api/office/login` en de andere
inlogdeuren op de *publieke* lijst — er is bij het inloggen immers nog geen
sessie. Keuringsregel 28 wees dat terug: *"staat op de publieke lijst maar heeft
inmiddels een eigen poort — haal de uitzondering weg"*, twaalf keer.

Zij heeft gelijk, en het is precies het onderscheid dat ik zelf bovenaan
`buiten.js` had opgeschreven en vervolgens overtrad. **Een inlogroute is niet
"publiek want zonder poort" — de poort ís de wachtwoordcontrole.** Wie de
gegevens niet heeft komt er niet door; dat is wat een deur doet. `PUBLIC` zegt
dat er *niets* tussen staat, en dat is een besluit met andere gevolgen. Ze staan
nu als `AUTHENTICATED` in de handgelezen lijst, met de reden dat de identiteit
daar wordt *vastgesteld* in plaats van verondersteld.

Dat die regel in twee richtingen kijkt — een route die de lijst niet (meer)
verdient moet eraf — is wat dit ving.

| | voor | na |
|---|---:|---:|
| toegang niet af te leiden | 49 | **30** |
| `LEGACY_PENDING_CLASSIFICATION` | 258 | **240** |
| geclassificeerd | 4.395 | **4.413 van 4.653 (94,8%)** |

## 5h. De stille hindernis

Er zijn twee manieren waarop de proef er niet bij komt, en de tweede zag niemand.

**De luidruchtige** is bekend: de route geeft een hindernis terug — *"Dit gezin
kennen we niet"* — en de afleidgang schrijft die als `BLOCKED_BY_TEST_FIXTURE`
met de reden erbij.

**De stille** ziet er heel anders uit: de route antwoordt `200`, de effectmeter
telt een schrijfpoging, en de opslagmeter ziet niets veranderen. Alle drie de
metingen kloppen — de handler riep `save()` aan en er viel niets te schrijven. Zo
gedraagt zich een `/verwijder`-route die geen bestaand object meekreeg. Van de 141
routes die hierop strandden eindigen er **58 op `/weg` of `/verwijder`** en 14 op
`/zet`.

Dat is geen onbekend *gedrag* maar een gat in de **proefopstelling**, en daar is
die stand precies voor. Ze stonden op `LEGACY` — "niet ingedeeld" — terwijl we
exact wisten wat eraan ontbrak.

**De grens die deze regel eerlijk houdt:** hij mag alleen aanslaan als de
effectmeter wél iets telde. Telde hij niets en veranderde er niets, dan is de
route een kandidaat voor `NOT_APPLICABLE`, en zou `BLOCKED` hem daar wegkapen.

| | voor | na |
|---|---:|---:|
| `BLOCKED_BY_TEST_FIXTURE` | 3.218 | **3.359** |
| `LEGACY_PENDING_CLASSIFICATION` | 240 | **99** |
| geclassificeerd | 4.413 | **4.554 van 4.653 (97,9%)** |

## 5i. De val waarin de noodstop van de bank "niets verandert"

De laatste 23 routes uit de kale ronde kregen dezelfde behandeling: de
kantoorschakelaars (`bank/nood`, `bank/leden`, `rekening/bevries`,
`agent/stop`) een duplicaatregel, en zeven een reden waarom ze er juist géén
krijgen — waaronder `/api/office/bank/draai`, want die knop gaat een **slag
verder** en twee keer drukken is twee slagen.

Toen de proef opnieuw draaide, kwam er iets veel ernstigers boven.
**`/api/office/bank/nood` — de noodstop van de bank — werd geclassificeerd als
`NOT_APPLICABLE`: "deze route verandert niets".** Dat is niet een beetje mis, dat
is het tegenovergestelde van waar.

De oorzaak lag niet in de verklaringen maar in de regel zelf, en het is een val
die niets met deze lijst te maken heeft: **een route waarvan de stand al op de
doelwaarde staat, ziet er voor beide meters precies zo uit als een route die
nooit iets verandert.** De proef had de noodstop in een eerdere ronde al gezet;
de tweede keer viel er niets te schrijven, en opslagmeter én effectmeter lazen
allebei nul. Twee onafhankelijke runtime-metingen, allebei correct, samen een
verkeerde conclusie.

Het tegenbewijs stond al in huis: **een route met een duplicaatregel is per
definitie geen `NOT_APPLICABLE`-kandidaat.** Wie een route dedupliceert, zegt
daarmee dat een herhaling wél iets zou doen — anders viel er niets te
dedupliceren. Dat veto staat bewust *boven* de meting, en dat is geen
inconsequentie: het is geen zwakker signaal dat door een sterker wordt
overstemd, maar een uitspraak van een mens over de **betekenis** van de
handeling, en die wint van elke meter.

Achttien routes werden erdoor tegengehouden. `LEGACY` ging daardoor van 84 terug
naar 101 — en dat is winst: een lager percentage met een register dat klopt, is
meer waard dan een hoger percentage waarin de noodstop van de bank niets doet.
Zestien ervan kregen daarna het contract dat ze wél verdienen (`PROTECTED`,
gemeten na de reparatie).

| | voor | na |
|---|---:|---:|
| dubbeltik opgevangen | 86 | **101** |
| dubbeltik deed het werk opnieuw | 93 | **77** |
| `PROTECTED` | 78 | **94** |
| `LEGACY_PENDING_CLASSIFICATION` | 99 | **85** |
| geclassificeerd | 4.554 | **4.568 van 4.653 (98,2%)** |

## 5j. Waar ik gestopt ben, en waarom daar

De laatste tien routes met een voorstel zijn gelezen, en bij **drie ervan ben ik
het niet eens met het voorstel**: `/api/foundation/school/toestemming/overzicht`
en `/api/geld/beleid` staan als `PROTECTED` voorgesteld terwijl het
raadplegingen zijn. De grond van het voorstel zegt het zelf: *"het verschil zat
in kosten. NA TE KIJKEN: is dat werk van deze route, of een meter die alleen de
eerste keer aansloeg?"*

Dat is de vraag, en het antwoord is de tweede: bij die twee is het **enige** dat
verandert de kostenmeter van het huis — de boekhouding van het verzoek, niet het
werk van de route. Dat geldt voor **14 routes**.

Ik teken ze niet af. Een voorstel dat "na te kijken" zegt met een snelle blik
overschrijven is precies de schijnzekerheid waar dit register tegen bestaat, en
of een kostentik als werk telt, is een besluit over wat dit huis onder "werk"
verstaat — niet iets wat uit deze meting volgt.

### Wel gerepareerd: een grens van de meter die op een storing leek

Vier geslaagde routes droegen geen `X-RTG-Effect`-kop, en dat zag eruit als een
gebrek. Het is een **vorm**-grens en geen soort-grens: een stromend antwoord
(`res.setHeader` + `res.write`, zoals de drie `.csv`-uitvoeren) heeft zijn koppen
al verstuurd voordat `res.end` langskomt.

Dat is niet te repareren, en de kop van `server/effectmeter.js` zegt nu waarom:
de kop forceren kan niet (hij is weg) en eerder zetten kan ook niet (het getal is
pas aan het eind bekend). Die vier komen daardoor binnen als **ongemeten** in
plaats van als "geen effect" — precies het onderscheid waarvoor deze meter
bestaat, nu op zichzelf toegepast.

## 5k. De kostentik is ruis — en de fout die dat blootlegde

**Besluit van de eigenaar, 30 augustus 2026: een tik van de kostenmeter is ruis
en geen werk.** Het is de boekhouding van het *huis* over het verzoek, niet de
handeling van de route. Zou het wel werk zijn, dan wordt elke leesroute
niet-idempotent zodra de meter hem raakt — en dat is bijna elke leesroute.

Elf routes werden daardoor gemeten alsof ze werk deden terwijl het enige dat
bewoog `kosten` was. Dat maakte de meting op die punten niet onvolledig maar
**verkeerd**.

**De ruisijking kan hem niet vinden, en dat is haar definitie.** Zij zoekt wat bij
*elke* oproep groeit; de kostenmeter tikt alleen op poorten die een drager kennen.
Een tweede ijkroute toevoegen hielp dan ook niet — gemeten: de lijst bleef
`rtgai, handelingLog, apiSpoor`. Daarom staat `kosten` er met naam bij, met de
reden erbij dat hij niet meetbaar is, en met de prijs: zou een handler ooit zélf
in `kosten` schrijven, dan ziet deze proef dat niet meer. Nagekeken — vandaag
schrijft niets buiten `kern/kosten/` erin, en `KOSTEN.md` zegt dat de meter de
enige schrijver is.

### Twee verklaringen over dezelfde route is een loterij

Bij het uitvoeren van dit besluit bleek dat ik zelf een fout had gemaakt.
`/api/kosten/grens`, `/api/kosten/vooruitblik` en
`/api/supplier/kosten/vooruitblik` stonden **twee keer** verklaard: als
`{ leest: true }` in `idemsleutels-kosten.js` en als `nietIdempotent` in mijn
`idemsleutels-kaleronde-b.js`. `Object.assign` laat de laatste winnen — stil —
dus welke verklaring gold hing af van de volgorde van de `require`s.

Dat is geen verklaring meer maar een loterij, en het is ernstiger dan een
slordigheid: een duplicaatregel stuurt de idem-poort, en een poort die van een
require-volgorde afhangt is erger dan geen poort.

`server/lib/idemsleutels-eenmaal.js` gooit nu bij het laden zodra een route in
twee zijbestanden staat. De lijst met delen staat dáár en niet in de aanroeper —
dezelfde les als de vier hardgecodeerde contractbestanden in
`scripts/effectcontracten.js`: een lijst die op twee plekken moet meegroeien,
groeit op één plek niet mee.

| | voor | na |
|---|---:|---:|
| dubbeltik deed het werk opnieuw | 77 | **74** |
| `LEGACY_PENDING_CLASSIFICATION` | 85 | **74** |
| geclassificeerd | 4.568 | **4.579 van 4.653 (98,4%)** |

## 5l. Nul routes zonder deur — en een rem die er voor de derde keer als een deur uitzag

De bak "toegang niet af te leiden" blokkeerde vanaf het begin alles: een contract
zonder deur bestaat niet, dus elke andere uitspraak over die routes bleef liggen.
Hij staat nu op **nul**, van 366.

De laatste 25 zijn met de hand gelezen en staan in
`server/kern/handlerpoorten/buiten-routes-b.js`, in vier groepen die geen ordening
zijn maar vier verschillende soorten toegang: een **apparaatsleutel** (de vier
doos-routes), een **gezinscode** (de uitnodigingen, de post, de kosten), een
**bewuste publieke deur** (een gezin of les die nog niet bestaat), en een **pas
die iets mág zijn** (`partnerSessie`).

**En voor de derde keer dezelfde fout.** De handgelezen lijst stond in de tak
"geen bewaker op de router". `/api/betaal/webhook/adyen` heeft er twee — allebei
snelheidsremmen — dus die tak werd nooit bereikt, en de route bleef "geen deur"
terwijl er zwart-op-wit stond dat Adyen zich met een HMAC legitimeert. Eerder
gebeurde dat al bij de publieke lijst en bij de familie-lus.

De volgorde is nu principieel in plaats van toevallig: **een uitspraak van een
mens over één route is het meest specifieke wat dit register heeft, en gaat vóór
elke afleiding uit een vorm.**

### Een correctie op mezelf

`doosSleutelOk` stond als `geen-deur` in het register, omdat ik hem als
snelheidsrem had gelezen. Hij is allebei: hij telt afketsers per IP **en**
vergelijkt daarna de doossleutel uit `x-doos-sleutel` in constante tijd. De
naam-ingang blijft `geen-deur` — aan een naam alleen is niet te zien welke helft
een aanroeper bedoelt — maar de vier doos-routes dragen nu
`SERVICE_TO_SERVICE` met wat er werkelijk gebeurt.

| | voor | na |
|---|---:|---:|
| toegang niet af te leiden | 366 | **0** |
| `LEGACY_PENDING_CLASSIFICATION` | 74 | **51** |
| geclassificeerd | 4.579 | **4.602 van 4.653 (98,9%)** |

## 5m. De laatste twaalf, en een reden die maar op één plek mag staan

De laatste twaalf uit de kale ronde zijn gelezen en splitsten scherp langs de
vraag die er werkelijk toe doet: wat zou een tweede identieke oproep *doen*?

Drie **overschrijven** (een bewaartermijn zetten, een verse sudoku die het lopende
potje vervangt) en kregen een duplicaatregel; ze meten nu `beschermd`. Negen
kregen er met opzet géén — en dat is de kant waar dedupliceren schade doet:

- een **imap-sleutel** is elke keer vers; de tweede opslikken laat een sleutel
  verdwijnen die het lid net gekregen heeft;
- een **export** legt een reden vast: twee keer exporteren is twee keer gegevens
  meenemen en hoort twee sporen te geven;
- `/api/office/bank/draai` gaat een **slag verder**; twee keer drukken is twee
  slagen.

**De reden staat op één plek en wordt opgehaald, niet overgetypt.** In de
sleutellijst stuurt zij de idem-poort; in het contract verantwoordt zij een stand.
Twee kopieën lopen uiteen, en dan staat er in het register iets anders dan wat de
poort werkelijk doet. Ontbreekt de reden, dan **gooit** het contractbestand — een
`INTENTIONALLY_NON_IDEMPOTENT` met een lege `waarom` is precies het vinkje waar
die stand voor waarschuwt.

Die controle wees bij haar eerste run meteen een aanname van mij aan: ik haalde de
reden op uit het bestand waar ik *hoopte* dat hij stond, en
`/api/command/sonde/draai` staat al veel langer in het hoofdbestand. Nu komt hij
uit de samengevoegde lijst — waar hij ook staat.

| | voor | na |
|---|---:|---:|
| dubbeltik deed het werk opnieuw | 148 (begin) | **71** |
| `PROTECTED` | 24 | **97** |
| `INTENTIONALLY_NON_IDEMPOTENT` | 32 | **71** |
| `LEGACY_PENDING_CLASSIFICATION` | 51 | **40** |
| geclassificeerd | 4.602 | **4.613 van 4.653 (99,1%)** |

## 5n. De laatste tweeënveertig, en vier keer dat het voorstel niet klopte

Hierna stond het register op nul onverklaarde routes. Het waren er nog
tweeënveertig, en ze zijn alle tweeënveertig **gelezen** in plaats van
overgenomen — dat was het besluit van de eigenaar (30 augustus 2026: waar mijn
lezing van het voorstel afwijkt, volgt de lezing en wordt de afwijking
opgeschreven). Vier keer week de lezing af, en die vier zijn samen de beste
verdediging van de regel dat een stand nooit uit bewijs wordt afgeleid.

**Een wachtrij is geen werk.** Drie routes maten twee keer `beschermd` en de
meter stelde `PROTECTED` voor. Het enige verschil in de opslag zat in `wacht` —
de wachtrij van de AI-laag en de rem, en die groeit van het *kijken*. `PROTECTED`
doet een uitspraak over gedrag bij een herhaling; een route die geen werk doet
heeft dat gedrag niet, en een leeg `PROTECTED` is precies de schijnzekerheid waar
dit register tegen is aangelegd. Een meter die de rem meetelt, verklaart elke
bevraagde lezer tot schrijver.

**Twee zwijgende meters zijn geen bewijs van stilte.** Acht routes lieten geen
spoor in de opslag *én* de effectmeter telde op allebei de oproepen `geen`. Zes
keer klopt dat. Twee keer niet:

- `/api/foundation/school/personeel/inloglink` schrijft een verse eenmalige
  inloghash en verstuurt een mail — maar alleen als het schoolaccount bestaat. In
  de kale ronde bestond het niet, en dan loopt de route met opzet door de
  anti-enumeratietak: hetzelfde antwoord, dezelfde antwoordtijd, geen effect.
  Beide meters keken naar de tak die niets doet.
- `/api/foundation/hulp/ai` schrijft werkelijk niets, en is toch niet
  `NOT_APPLICABLE`: de tweede oproep stelt de vraag echt opnieuw aan het model —
  een tweede antwoord en een tweede rekening. Een externe aanroep staat in
  `NIET_GEMETEN` van `server/effectmeter.js`, dus de meter zweeg over iets dat hij
  niet kán zien. **Zwijgen is daar geen nul.**

**`ongemeten` kan een vorm zijn in plaats van een storing.** De vier CSV-uitvoeren
antwoorden streamend; bij `res.end` zijn de koppen al de deur uit, en dat is de
grens die in de kop van `server/effectmeter.js` staat opgeschreven. Hun handlers
zijn gelezen: bezit controleren, lezen, regel voor regel wegschrijven. De gemelde
lijst-mutatie in `rides.csv` is een valse treffer — `.filter` geeft een nieuwe
lijst en `.sort` raakt die kopie — en de melding blijft als *weerlegging* staan in
plaats van weggelaten te worden.

**En de grootste groep: zestien die de proefopstelling nooit aan het werk kreeg.**
Een 409 omdat het ding er al was, een 404 omdat het er niet was, een 429 omdat de
rem aansloeg, een 401 omdat er geen sessie was, een 400 omdat de body niet klopte.
De kale ronde meldde ze als `beschermd`, en dat leest als "de herhaling deed
niets" — maar wat er gebeurde is dat de **eerste** oproep niets deed, en dan is de
tweede niet beschermd maar irrelevant. Zij staan op `BLOCKED_BY_TEST_FIXTURE` met
per route de voorwaarde die `scripts/lib/idemwereld.js` moet klaarzetten: niet
"kreeg 409" maar *wat er had moeten bestaan*. Hun `semantiek.klasse` is `onbekend`
en niet een van de vijf andere — een klasse invullen zou de uitspraak zijn die de
meting niet draagt.

Bij de geldroutes viel diezelfde valstrik de andere kant op: daar wás de weigering
de bescherming (5o hieronder). Het verschil is niet te raden, alleen te meten.

## 5o. De omkering bij het geld

Zes geldroutes stonden op `LEGACY` met de reden *ongemeten* — de kale ronde kon
niets meten omdát de route weigerde. Dat las als onwetendheid en was het
tegendeel: **de weigering ís de bescherming.** Sinds het besluit van de eigenaar
weigert `lib/idem.js` een geldhandeling zonder sleutel, dus een keyloze dubbeltik
kan daar niet eens ontstaan; mét sleutel vangt de duurzame geldlaag hem op. Het
bewijs is daarom tweezijdig, en pas dan is `PROTECTED` waar.

`/api/pay/verzoek/betaal` bleef er bewust buiten: die meet mét sleutel een 409
("er is geen schuld meer"), en dat is een **toestandscontrole** en geen
idempotentie.

## 5p. De poort staat op nul

`test/mutatiecontract.test.js` hield `LEGACY_PENDING_CLASSIFICATION` op een
bovengrens die alleen mocht krimpen. Die grens stond op 1.594 en staat nu op **0**.
Vanaf hier is de poort niet meer "het mag niet groeien" maar **"het mag niet
bestaan"**: een nieuwe schrijfroute zonder contract laat de bouw meteen zakken.

| | begin | nu |
|---|---:|---:|
| geclassificeerd | 3.059 (65,7%) | **4.653 van 4.653 (100%)** |
| vastgesteld door een mens | 106 | **1.278** |
| `PROTECTED` | 24 | **104** |
| `INTENTIONALLY_NON_IDEMPOTENT` | 32 | **74** |
| `NOT_APPLICABLE` | 40 | **1.073** |
| `BLOCKED_BY_TEST_FIXTURE` | 2.963 | **3.402** (hoort te slinken) |
| `LEGACY_PENDING_CLASSIFICATION` | 1.594 | **0** |

**100% geclassificeerd is niet 100% idempotent, en dat was ook de opdracht niet.**
De 3.402 geblokkeerde routes zijn geen dekking maar een wachtrij met per stuk een
adres; het werk daaraan heeft één plek, `scripts/lib/idemwereld.js`, en paragraaf 8
beschrijft wat daar moet komen.

## 5q. De volle ronde was rood, en vier van de veertien waren van mij

Tot hier had ik naar `scripts/check.js` en de deeltoetsen gekeken en die stonden
groen. De **volle** testronde is iets anders, en `SUITE.json` laat zien dat hij
rood was — in zijn hele vastgelegde geschiedenis heeft `"groen": true` er nog
nooit gestaan. Dat had ik eerder moeten nakijken.

Veertien zakkers. Acht bestonden al, vier komen uit deze werkstroom, en één is
een breuk uit de geldgrens zelf.

**De noodstop en de herstelknop van de bank — de ernstigste.** Ik had ze allebei
een duplicaatregel gegeven, en allebei dragen ze een lijf dat leeg mag zijn. Twee
keer drukken geeft dus dezelfde vingerafdruk, en de tweede druk werd opgeslikt
mét het antwoord van de eerste: dus met "ok". Een tweede noodstop zet de bank
niet stil; een tweede herstel haalt hem er niet uit. In `test/bank.test.js` bleef
de bank daardoor in nood staan, en dat werd pas **drie toetsen verderop**
zichtbaar doordat de foundation-afdracht via de kaart liep in plaats van het eigen
grootboek. Dat late zichtbaar worden is het gevaarlijke: op een echte bank is dat
een stand die niemand terugdraait. Dezelfde redenering had ik voor de alarmknop
van een zaak wél opgeschreven — *"een laag die de tweede opslikt, kan iemand in
nood stil laten staan"* — en niet toegepast op de herstelkant.

**`/api/office/bank/mislukking`.** Drie mislukte clearings melden gaat met een
leeg lijf, dus de teller kwam op 1 in plaats van 3 en de bank sloeg niet
automatisch in nood.

**`/api/supplier/horeca/folio/nacht`.** De nachtrun houdt zelf bij welke nachten
geboekt zijn en meldt eerlijk `geboekt: 0, overgeslagen: 1`. Met een regel erboven
kreeg de tweede oproep `geboekt: 1` terug: er werd niets dubbel geboekt, maar het
*antwoord* loog over wat er gebeurd was.

Samen één regel: **een route die zelf al weet dat ze het al gedaan heeft, krijgt
hier niets.** Die laag is er voor routes die dat niet weten. En hij staat nu als
**grendel** in `lib/idemsleutels-nooit.js`, niet als opmerking — wie deze lijst
aanvult, leest geen opmerking over iets wat er niet meer staat. Daar zijn meteen
de andere twee laadkeuringen bij gaan staan: drie controles die om beurten iets
over dezelfde lijst zeggen, horen op één plek, anders draait de volgende over de
helft. Dat is hier al een keer gebeurd.

**Een verse sleutel werd genegeerd — en dat was de oorzaak, één keer
gerepareerd.** De poort keek alleen naar de header, terwijl dit huis zijn sleutel
in het *lijf* draagt (`idem` / `idempotentieSleutel`). Bij een route met een
inhoudsregel besliste dus de vingerafdruk, en die is voor twee inhoudelijk gelijke
verzoeken dezelfde — hoe vers de sleutel ook is. Een tweede bankpas met een nieuwe
sleutel kwam er niet, en een tweede betaalverzoek evenmin. De verklaring is een
vangnet voor wie niets meestuurt; **wie wel iets meestuurt, heeft al gesproken.**

**En de geldgrens brak Rahul.** Na "ja" kon hij geen Tik meer sturen, want hij gaf
geen sleutel mee. Nu is het *voorstel* de sleutel: twee keer "ja" op hetzelfde
voorstel is één Tik, een nieuw voorstel is een nieuwe. Zelfde voor het betalen van
een klompje.

Eén ding om niet te herhalen: ik had eerst `test/bank.test.js` aangepast om een
van de zakkers op te lossen. Dat was symptoombestrijding — na de echte reparatie
bleek de aanpassing niet nodig, en ze is teruggedraaid.

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
Classified                        3.059   65,7%
  vastgesteld door een mens         106   (een uitspraak over gedrag)
  afgeleid door een script        2.953   (alleen: wij weten het niet, en waarom)

  PROTECTED                          24
  INTENTIONALLY_NON_IDEMPOTENT       32
  NOT_APPLICABLE                     40
  UNTESTABLE_WITH_JUSTIFIED_REASON    0
  BLOCKED_BY_TEST_FIXTURE         2.963   hoort te slinken
LEGACY_PENDING_CLASSIFICATION     1.594   moet naar nul
```

**De 32 `INTENTIONALLY_NON_IDEMPOTENT` komen uit een register dat er al was.**
`IDEMBESLUIT.json` draagt 127 besluiten van een mens over waarom een herhaling
daar mag: een code-maker *hoort* elke keer iets nieuws te geven, een teller hoort
op te hogen, en bij een `creatie` is besloten dat een tweede item hinderlijk is
maar geen geld raakt. Dat is de reden die deze stand eist; wat ontbrak was de
meting, en de kale ronde levert die.

Twee dingen die daarbij eerlijk moeten blijven staan:

- **Van de 127 besluiten halen er 32 deze lijst.** Vierenveertig zijn `berekening`
  of `instelling` — die horen bij een andere stand — en de rest is niet gemeten.
  Een besluit zonder meting is hier geen contract, hoe goed het besluit ook is.
- **Zeven dragen een reden over déze route; vijfentwintig alleen de reden van hun
  klasse.** Dat tweede is nog steeds een besluit — iemand heeft die route daar
  bewust in gezet — maar het is een zwakkere grond, en het contract zegt dat er
  met zoveel woorden bij.

Het contract leest die reden bij het opbouwen **op uit `IDEMBESLUIT.json`** in
plaats van hem over te typen: twee plekken met dezelfde reden lopen uiteen, en dan
draagt dit register een reden die niemand meer meent. Verdwijnt een route daar,
dan valt de bouw om. (De eerste versie viel stil terug op de klassetekst, en toen
liet de mutatieproef niets zakken — dat is precies waar een mutatieproef voor is.)

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
| ~~10~~ 0 | niet gemeten (pad-parameter) | **gedaan** — zie hieronder |

**De tien met een pad-parameter zijn uit de restpost.** De proef slaat `/api/x/:id`
met opzet over: zo'n pad is geen adres maar een vorm, en een verzonnen id levert
een 404 op die niets meet — maar die 404 leest in een register hetzelfde als een
route die werkelijk niets doet. Ze waren dus in beide richtingen onzichtbaar:
nergens een probleem, nergens een besluit.

Ze staan nu in `mutatiecontracten-padparameter.js` op `BLOCKED_BY_TEST_FIXTURE`,
elk met het adres van het werk. Bij vier ervan bestaat de halve opstelling al —
de proefsleutelbos draait een SCIM-sleutel, en `idemwereld.js` maakt tijdens de
schoolketen een SSO-koppeling `proefkoppeling` aan. Bij die twee wissers zit er
een volgorde in: eerst de sleutel, dan de koppeling, anders meet de tweede een
404 in plaats van een handeling. En één is de vreemde eend: `POST /api/cluster/:actie`
draagt geen object-id maar een **handelingsnaam** — daar valt niets aan te maken,
alleen op te sommen. Een toets zakt nu zodra er weer een route is die noch gemeten
is, noch een contract draagt.

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
