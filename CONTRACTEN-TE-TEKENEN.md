# Achttien contracten die een besluit vroegen — en getekend zijn

**Stand 1 september 2026: getekend.** De achttien staan in
`server/lib/mutatiecontracten-samenvoeging.js`, `LEGACY_PENDING_CLASSIFICATION`
staat weer op 0 en `test/mutatiecontract.test.js` bewaakt dat. Drie besluiten
wijken af van het voorstel hieronder, met de reden in het contract zelf:

| route | voorstel | getekend | waarom |
|---|---|---|---|
| `POST /api/foundation/school/opleiding/zet` | `PROTECTED`, mits | `INTENTIONALLY_NON_IDEMPOTENT` | het id in het lijf is de sleutel: met id zet een tweede oproep dezelfde opleiding opnieuw, zonder id is elke oproep met opzet een nieuwe (`server/school/organisatie.js`, `|| rid(4)`); het verschil in `wacht` was de wachtlijstteller, geen rem |
| `POST /api/rtfos/gift/stand/zet` | open | `INTENTIONALLY_NON_IDEMPOTENT` | de stand zelf is idempotent, maar elke druk op deze boardroomschakelaar hoort een eigen auditregel te krijgen — een dubbeltik samenvouwen zou een druk uit het journaal wissen |
| `POST /api/supplier/pay/rekening` | open | `INTENTIONALLY_NON_IDEMPOTENT` | een herhaalde rekeningwijziging start de wachttijd opnieuw en dat is de bedoeling; vastgelegd in `server/lib/idemsleutels-geld.js` zodat de idempotentielaag en het contract dezelfde bron lezen |

De dertien lezers zijn `NOT_APPLICABLE` (geen van hen schrijft naar een bestand
of roept een externe partij aan) en `POST /api/auth/tweede` is
`BLOCKED_BY_TEST_FIXTURE`. De tekst hieronder is het voorstel zoals het er lag,
bewaard omdat de afweging zelf het besluit draagt.

---


De samenvoeging van twaalf PR's bracht 106 schrijfroutes zonder contract binnen
(`LEGACY_PENDING_CLASSIFICATION`). `scripts/mutatiecontract.js --afleiden` heeft
er 88 afgehandeld op grond van een **gemeten** hindernis — die regels dragen
`door: --afleiden` met hun grond erbij, dus ze zijn na te lopen en te overrulen.

Deze achttien blijven over. Ze staan hier omdat `MUTATIECONTRACT.md` het zo
wil: *het bewijs draagt een voorstel, een mens draagt het besluit.*

Tekenen doe je door de route met zijn stand op te nemen in
`server/lib/mutatiecontracten.js` (of een van zijn deelbestanden). Wie afwijkt
van het voorstel schrijft de reden erbij — dat is precies de plek waar een
menselijk besluit zwaarder weegt dan de meting.

---

## A. Dertien die alleen lezen — voorstel `NOT_APPLICABLE`

Bij alle dertien geldt dezelfde gemeten grond, en het zijn er **twee**
onafhankelijke meters die het zeggen:

> twee geslaagde oproepen zonder spoor in de opslag, én de effectmeter telde op
> allebei `geen` — geen schrijfpoging, geen mail, geen sms.

Wat geen van beide meters ziet: een schrijf naar een **bestand** en een
**externe aanroep**. Dat is de enige vraag die jij moet beantwoorden: doet een
van deze routes zoiets?

| route | uit |
|---|---|
| `POST /api/command/bezitsbewijs` | #157 |
| `POST /api/experience/bootstrap` | #143 |
| `POST /api/experience/evidence` | #143 |
| `POST /api/lab2/capsule` | #159 |
| `POST /api/lab2/metingen` | #159 |
| `POST /api/office/rtfwallet` | #160 |
| `POST /api/reis/gezelschap/kring` | #158 |
| `POST /api/rtfos/gift/plan/lijst` | #160 |
| `POST /api/rtfos/gift/stand/kantoor` | #160 |
| `POST /api/rtfos/winkel/artikelen` | #160 |
| `POST /api/rtfos/winkel/bestellingen` | #160 |
| `POST /api/supplier/horeca/werklijst` | — |
| `POST /api/supplier/pay/rekening/stand` | — |
| `POST /api/toestemming/relaties` | #157 |

**Te tekenen:** allemaal `NOT_APPLICABLE`, tenzij er een naar een bestand
schrijft of een externe partij aanroept.

---

## B. Eén die de proef niet in kwam — voorstel `BLOCKED_BY_TEST_FIXTURE`

`POST /api/auth/tweede` — de proef kreeg *"Deze inlogpoging is verlopen. Log
opnieuw in."* De route is dus niet beoordeeld omdat het instrument er niet bij
kon, niet omdat er iets mis is.

**Te tekenen:** `BLOCKED_BY_TEST_FIXTURE`. Dit is een tekort van de proef en
geen oordeel over de route.

---

## C. Eén met een uitgeschreven twijfel — voorstel `PROTECTED`, maar

`POST /api/foundation/school/opleiding/zet`. De meter zegt het zelf:

> het verschil zat in `wacht`. NA TE KIJKEN: is dat werk van deze route, of een
> rem/meter die alleen de eerste keer aansloeg? In dat laatste geval is de
> juiste stand `NOT_APPLICABLE` en niet `PROTECTED`.

**Te tekenen:** `PROTECTED` als de tweede oproep echt werk overslaat,
`NOT_APPLICABLE` als het een rem was die alleen de eerste keer aansloeg.

---

## D. Twee waar geen meting antwoord op geeft

Bij deze twee deed de herhaling het werk **opnieuw**. Of dat een dubbeltik is
die je wilt tegenhouden, of een tweede handeling die hoort te mogen, is geen
meetvraag maar een ontwerpvraag:

### `POST /api/rtfos/gift/stand/zet` (#160)

Zet de stand van de giftlaag. Twee keer versturen zet hem twee keer. Is dat erg?

- **`INTENTIONALLY_NON_IDEMPOTENT`** — een stand zetten mag herhaald worden, de
  tweede zet hetzelfde. Dan is er niets te beschermen.
- **`PROTECTED`** — als een tweede zet een tweede gebeurtenis in het
  giftjournaal oplevert, wil je hem afvangen.

*Wat het zwaar maakt:* dit is de laag waar `GIFT.md` over gaat, en daar is de
belofte dat er geen doneerknop is en dat geld aannemen via RTG Pay loopt. Een
dubbele standwijziging in die keten is meer dan een schoonheidsfoutje.

### `POST /api/supplier/pay/rekening`

Opent of raakt de lopende rekening bij een zaak. Twee keer aanroepen doet het
werk twee keer.

- **`PROTECTED`** — een rekening is geld; een dubbeltik hoort niet twee regels
  op te leveren.
- **`INTENTIONALLY_NON_IDEMPOTENT`** — als elke aanroep met opzet een nieuwe
  regel is, hoort dat er expliciet te staan.

*Wat het zwaar maakt:* `COMMERCE.md` zegt dat er geen tweede betaalweg naast
`kern/pay/poort.js` komt en dat één mand niet één bevestiging is. Deze route zit
in die keten.

---

## Waar dit vandaan komt

Gemeten met `node scripts/mutatiecontract.js --afleiden` op de samengevoegde
stand van 1 september 2026, met een verse `IDEMPROEF.json` eronder. De 88
afgeleide regels staan in `MUTATIECONTRACT-AFGELEID.json` met per regel de
grond; ze worden bij elke volgende gang overschreven en drukken een menselijk
besluit nooit weg.


---

# En twee bevindingen die geen contract zijn maar een bug

De idempotentieproef heeft na de port van de wereldopstelling twee routes
gevonden waarvan **bewezen** is dat een herhaling het werk overdoet. Dat is de
bak `ECHT_DEFECT`, en die hoort op nul te staan:

| route | wat de proef zag |
|---|---|
| `POST /api/bank/rekening/open` | twee keer aankloppen opent twee rekeningen |
| `POST /api/office/aidata/export` | de tweede oproep doet de export opnieuw |

De eerste is de zwaarste: een bankrekening openen is geen leeshandeling, en een
dubbeltik hoort daar niet twee rekeningen op te leveren. Dit is geen
classificatievraag zoals de achttien hierboven — er is niets te tekenen, er is
iets te repareren.

De tweede is milder maar niet niets: een export die twee keer draait kost twee
keer werk en levert twee keer een bestand.

## Wat ik NIET heb gedaan

Ze repareren. Een idempotentiesleutel op een bankroute is een ingreep in de
geldketen, en `kern/pay/poort.js` is de plek waar dit huis zulke besluiten
neemt. Dat hoort een eigen wijziging te zijn met eigen toetsen, niet een
bijvangst van een samenvoeging.

## En een derde die geen bug is

`GEEN_PROEFSLEUTEL` staat op 471. Nagerekend: `scripts/onbewezen.js` en
`verdeelOpRol` zijn identiek aan die van PR #144, en met de rollenlijst van #144
komt er exact hetzelfde uit (731 zonder rol, 4038 met rol). Het verschil zit
niet in het instrument maar in de data: **548 van die routes hebben hun poort in
de HANDLER** in plaats van op de route, en daar kan een rolverdeler per
definitie geen rol aan toekennen.

Die bak op nul krijgen vraagt dus dat het instrument handlerpoorten leert lezen.
Dat is een uitbreiding en geen reparatie, en het is de eerlijke reden dat
`test/eindpoort.test.js` rood blijft staan.
