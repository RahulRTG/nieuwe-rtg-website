# Achttien contracten die een besluit vragen

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
