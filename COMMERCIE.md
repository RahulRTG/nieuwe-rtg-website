# COMMERCIE.md — de Commercial Core

*Besluit van de eigenaar, 20 augustus 2026, direct na de doorlichting die
PRIJZEN.md opleverde. Die doorlichting vond twaalf gaten en de conclusie was
niet "repareer ze een voor een" maar: **prijzen, contracten, voorwaarden,
boekingen en claims zijn nog niet één systeem.** Dit document beschrijft het
subsysteem dat ze één maakt. PRIJZEN.md blijft de prijslijst en de lijst gaten;
dit is de architectuur eronder.*

## 0. De kern, in een zin

> Er is één commerciële bron van waarheid, en catalogusprijs, contractprijs en
> factuurbedrag zijn drie verschillende dingen.

Dat laatste onderscheid is vanaf nu heilig. De meeste gaten in PRIJZEN.md §4
komen uit het vervagen ervan: een lijstprijs die op een factuur belandde, een
bodem die als prijs werd gelezen, een percentage in een voorwaardendocument dat
niets met de code te maken had.

## 1. De zeven lagen

```
Commercial Core
├─ Product Catalog      wat er te koop is        kern/pasladder.js
├─ Pricing Engine       welk bedrag geldt        kern/pasprijs.js
├─ Contract Engine      wat is afgesproken       deels: aanmeldingen/besluit.js
├─ Usage & Bundles      wat is verbruikt         nog niet gebouwd
├─ Ledger / Settlement  wat is geboekt en betaald deels: pay, bank, betaalopdracht
├─ Tax Engine           welke btw geldt          verspreid — nog te centraliseren
└─ Commercial Claims    wat we publiek beweren   nog niet gebouwd
```

`pasladder.js` is de **Product Catalog** en nadrukkelijk niet de plek waar de
commerciële logica ophoudt. Elke laag hierboven mag de laag erboven lezen en
nooit andersom.

## 2. Vijf producten, drie prijsmechanismen

| Product | Catalogusprijs | Mechanisme |
|---|---|---|
| RTG Community | € 0 | free |
| RTG Pass | € 65 p/m | fixed |
| RTG Business Lite | € 150 p/m | fixed + usage |
| RTG Business | vanaf € 5.000 p/m | contract |
| RTG Lifestyle | vanaf € 20.000 p/m | contract |

Vijf producten, maar slechts drie mechanismen — dat is wat het simpel houdt.

**Fixed** — `catalogusprijs + verbruik = factuur`. RTG Pass is € 65 plus
eventuele extra AI. Business Lite is € 150 plus extra AI plus betaaldienst.

**Contract** — de bodem is een commerciële invariant, niet de factuurprijs:

```
minimumprijs → voorstel → onderhandelde prijs → getekende contractprijs → snapshot
```

Business minimaal € 5.000, Lifestyle minimaal € 20.000. Daarboven kan een klant
€ 7.500, € 18.000, € 27.500 of € 100.000 betalen; de bodem weigert alleen wat
eronder ligt.

**Free** — precies één product mag `prijs = 0` en `commercieel = false`. Dat is
technisch aantoonbaar: `pasladder.gratisTreden()` telt de treden op nul, en
`test/pasladder.test.js` toets 1 valt om zodra het er twee worden.

### De vijf prijsbegrippen

```
catalogusprijs   wat er op de prijslijst staat
minimumprijs     de bodem; weigert invoer, toont "vanaf", en is nooit een factuurbedrag
offerteprijs     wat is aangeboden
afgesproken prijs wat is getekend
factuurprijs     wat er in rekening wordt gebracht
```

Voor contractproducten geldt: **factuurprijs = afgesproken prijs.** Er wordt
voor een bestaand contract nooit opnieuw de actuele lijstprijs opgehaald.

## 3. Wat er inmiddels staat

| Onderdeel | Staat |
|---|---|
| Product Catalog met bodems | `kern/pasladder.js`, `test/pasladder.test.js` (9) |
| Bodem ≠ prijs | afgedwongen; toets 5, mutatie-geverifieerd |
| Eén gratis product | afgedwongen; toets 1 |
| Contractprijs bij het besluit | `kern/aanmeldingen/besluit.js`; accepteren weigert zonder bedrag |
| Partnervergoeding = 0 | `kern/commercie/vergoeding.js`, `test/commercie.test.js` (1–4) |
| Ledenvoordeel met vier bedragen | `kern/commercie/subsidie.js`, `test/commercie.test.js` (5–9) |
| Betaaldienstvergoeding met statussen | `kern/commercie/fee.js`, `test/betaaldienstfee.test.js` (9) |
| Tarief publiek en live in de voorwaarden | `/api/betaaldiensttarief` |

### De partnervergoeding is nul, en dat is geen knop

De generieke commissie is verdwenen. Wat RTG een partner in rekening kan
brengen, valt onder vier **benoemde** soorten, en geen ervan neemt een aandeel
in de omzet van de partner:

```
payment_service       het afhandelen van een betaling
marketplace_service   een boeking via het partnerkanaal (over de service, nooit over de netto reissom)
ticketing_service     verkoop en scan van tickets
implementation        eenmalig inrichten, migreren, koppelen
```

Een *payment service fee* is een prijs voor een verleende dienst; een *commissie*
is een aandeel in andermans omzet. Ze kunnen hetzelfde bedrag opleveren en zijn
commercieel het tegenovergestelde. Wie ze allebei "commissie" noemt, kan het
verschil nooit meer uitleggen. `test/commercie.test.js` toets 3 dwingt af dat
geen enkele soort over omzet gaat.

### Het ledenvoordeel heeft vier bedragen

```
bruto            22,00
lid betaalt      19,80
RTG legt bij      2,20
zaak ontvangt    22,00
```

met de invariant `lid + RTG === bruto === zaak`. Alle vier worden vastgelegd op
de transactie, en `subsidie.keur()` rekent ze na op de **opgeslagen** rij — niet
op een verse berekening. De oude toets controleerde `order.total` en
`regieKorting`: precies de twee velden die ook kloppen als er niets gebeurt.

## 3b. Vier besluiten van 20 augustus 2026

Genomen nadat de ladder een gat opende dat er daarvoor niet was.

### De partnerpoort wordt Business Lite

`routes/member/partnerkanaal.js` eist voor een bedrijfscode een **Business
Pass** — en die is sinds de ladder vanaf € 5.000 per maand. Daarmee sloot de
poort precies de klant buiten die MARKT.md als ingang aanwijst: het restaurant
met acht man. De ladder had dat gat zelf gemaakt.

**Besluit:** een zaak wordt partner met **RTG Business Lite** (€ 150 p/m).
Business blijft voor grotere organisaties. Twee gevolgen die erbij horen:

- Business Lite moet gebouwd zijn vóór de poort verandert (§6). Tot dan blijft
  de eis staan zoals hij is; de poort verzetten naar een pas die niet bestaat,
  zou hem helemaal sluiten.
- De **€ 10.000 entree en € 500 contributie** uit de partnervoorwaarden moeten
  worden ingetrokken of herzien. Twee toegangsprijzen naast elkaar (€ 150 p/m
  én € 10.000 eenmalig) is onuitlegbaar, en een eenmalig bedrag van € 10.000
  sluit dezelfde kleine zaak weer buiten. Dit is PRIJZEN.md §4.6, dat daarmee
  van "niet gebouwd" naar "te herzien" gaat.

### Een prijswijziging raakt nooit een lopend contract

`price_lock_until` = einde van de minimumtermijn. Wat een lid tekende, betaalt
het lid. Consumentenrechtelijk het veiligst voor de RTG Pass (twaalf maanden) en
commercieel het duidelijkst.

Dit is nu nog **niet** afgedwongen: `test/pasprijs.test.js` toets 6 bewaakt zelfs
het tegenovergestelde — dat een boardroom-wijziging overal doorkomt, ook op de
factuur van een lid met een jaarcontract. Die toets bewaakt iets echts (de drie
uiteengelopen kopieën van de pasprijs) en mag pas veranderen als de Contract
Engine er is; dan wordt het "een wijziging komt door naar elk contract dat er nog
niet aan vastzit". Prijs: één prijswijziging leeft langer naast de oude, want
lopende contracten volgen pas bij verlenging.

### Het betaaldiensttarief blijft, en komt in de voorwaarden

€ 0,10 + 1% per transactie blijft. De partnervoorwaarden noemen **RTG nu
expliciet als betaaldienstverlener**, met het tarief, met de grondslag ("per
transactie, niet over uw omzet") en met de vaststelling dat afrekenen via RTG
Pay niet verplicht is. Artikel 1 is daarvoor herschreven: het beloofde "geen
transactiekosten" terwijl elke kassabetaling naar `rtg:betaaldienst` boekte.

Het bedrag staat **niet hard** in het document maar komt live uit
`/api/betaaldiensttarief` — de eerste stap van §9. Een bedrag in een juridisch
document dat los kan lopen van wat de code rekent, is precies hoe "0% commissie"
naast een commissieknop kon blijven bestaan.

### RTG Community

Zie §11.

## 4. Wat hierna komt, op volgorde

De eigenaar heeft de volgorde bepaald. 1, 2 en 3 zijn af.

1. ~~Commissieconflict definitief verwijderen~~ — **af**
2. ~~Ledenkorting financieel echt maken~~ — **af** (rekenkundig; de uitbetaalkant
   staat op `te_verrekenen` tot de betaal-naad hem oppakt)
3. ~~Betaaldienst met ledger en recovery~~ — **af**. `if (kb.error) kosten = 0`
   is weg; de vergoeding wordt vastgelegd vóór de boekpoging en blijft bij een
   mislukking verschuldigd (`kern/commercie/fee.js`,
   `test/betaaldienstfee.test.js`). De staten heten in dit huis GEINCASSEERD →
   OPENSTAAND → GEBOEKT / HERKANSING → AFGESTEMD, met de Engelse namen erbij.
   Nog **niet** gebouwd: de automatische herkansingsronde. Een HERKANSING blijft
   nu staan tot iemand kijkt — zichtbaar in `kostenOpen` op het
   partneroverzicht, maar niemand pakt hem op.
4. **Contract Engine met price snapshots.** Zie §5.
5. **Business Lite via capabilities**, niet via pas-id-checks. Zie §6.
6. **AI Entitlement**: bundels, auto-top-up, spend cap. Zie §7.
7. **Tax Engine centraliseren** — nu staat `* 1.21` hard op meerdere plekken.
8. **Foundation / social allocation settlement.** Zie §8.
9. **Publieke claims automatisch uit de Commercial Core.** Zie §9.
10. **Release-gate**: geen financiële claim zonder bewijs.

## 5. De contract lifecycle

Dit lost "maand 13" op de goede manier op. Niet: genereer twaalf termijnen.
Maar een contract met een staat:

```
DRAFT → OFFERED → ACCEPTED → ACTIVE → RENEWAL_DUE → RENEWED → TERMINATING → ENDED
```

Het contract draagt: `start_at`, `minimum_term`, `billing_frequency`,
`renewal_policy`, `notice_period`, `agreed_price`, `price_lock_until`,
`indexation_policy`, `tax_profile`, `service_level`.

De billing engine stelt elke periode één vraag: **is er vandaag een geldige
betalingsverplichting?** en genereert dán pas een termijn. Maand 13 bestaat
vanzelf zodra het contract verlengd is — en bestaat níét als het is opgezegd.

`price_lock_until` is meteen het antwoord op PRIJZEN.md §4.5: een prijswijziging
in de boardroom mag een lopend jaarcontract niet raken.

## 6. Business Lite via capabilities

`beschikbaar: false` blijft staan tot dit er is. Maar de 77 bestanden die een
pas-id noemen moeten Business Lite **niet** leren kennen — dat zou dezelfde
technische fout opnieuw maken. Dit is fout:

```js
if (pas === 'business-lite')
```

In plaats daarvan capabilities, en een productprofiel dat ze toekent:

```
can_use_workos
can_manage_staff
can_use_pos
can_use_ai
can_use_enterprise_governance
can_use_dedicated_support
can_use_lifestyle_service
```

```
Business Lite → WorkOS standard, standaard support, standaard AI-entitlement,
                RTG Pay, géén enterprise-SLA, géén dedicated implementation
Business      → WorkOS full, enterprise governance, integraties, SLA,
                contractfeatures, dedicated implementation
```

Bij een zesde abonnement hoeven er dan geen 77 bestanden open.

Wat er voor Business Lite bewezen moet zijn vóór `beschikbaar: true`: identity,
entitlement, onboarding, billing, permissions, governance-behandeling,
feature access, cancellation, renewal, invoices, upgrade path.

## 7. AI als verbruiksproduct

Een eigen engine, geen pasfunctie:

```
AI Entitlement
├─ included allowance
├─ consumed / remaining
├─ soft limit / hard limit
├─ top-up policy
├─ auto top-up
└─ spend ceiling
```

Elk abonnement krijgt een policy; Business en Lifestyle contractueel. Bij het
plafond vier standen: `STOP`, `BUY_BUNDLE`, `AUTO_TOPUP`, `CONTRACT_OVERAGE`.

Bundels zijn zelf producten: AI-S, AI-M, AI-L, AI-XL. **Een klant koopt
capaciteit, geen model** — hij koopt bijvoorbeeld 25.000 RTG AI-credits, en de
onderliggende modellen mogen veranderen zonder dat er een contract opengaat.

Extern nooit tokens tonen. Niet *"nog 1.293.582 tokens"* maar *"AI-tegoed deze
maand: 72% gebruikt."*

De verkoopprijs van een bundel wordt gerekend en niet gekozen:
`inkoopkosten → veiligheidsmarge → platformmarge → verkoopprijs`.

Het budget hoort in de bestaande rechtenlaag, niet in een losse meter: per
afdeling een maximum, dure acties na toestemming, automatisch bijkopen tot € X
per maand. Voor Business dieper: organisatie → afdeling → team → gebruiker →
capability, zodat een CFO kan zien wáárom de AI € 1.847 kostte.

## 8. Social Allocation Policy

De 30% wordt losgemaakt van productnamen. Niet "Foundation Pass → Foundation
allocation", maar een economische regel:

```
eligible revenue
→ 30% social allocation
   ├─ 20% local impact
   └─ 10% RTFoundation
```

Elk bedrag draagt: `source`, `amount`, `allocation_rule_version`,
`local_destination`, `foundation_destination`, `reserved_at`, `payable_at`,
`settled_at`. Daarmee is achteraf van elke euro aan te tonen waar hij heen ging —
en dat is precies wat MARKT.md eist zodra de 30% in marketing staat.

`allocation_rule_version` is het veld dat het verschil maakt: verandert de regel
ooit, dan blijven oude bedragen leesbaar onder de regel die toen gold.

## 9. Claims mogen geen bedragen meer bevatten

Het probleem van PRIJZEN.md §4.1 ontstond doordat HTML, code en documenten
onafhankelijk over hetzelfde getal konden praten. Dus worden commerciële claims
machine-leesbaar:

```
claim.partner.commission     = ZERO
claim.business_lite.price    = FROM_150
claim.business.price         = FROM_5000
claim.lifestyle.price        = FROM_20000
claim.community.price        = FREE
```

Website en voorwaarden halen hun commerciële waarden uit dezelfde bron. En
daarna een release-test over de hele keten:

```
publieke claim → commerciële regel → contractgedrag → ledgergedrag → bewijs
```

Kan die keten niet worden bewezen, dan blokkeert de release. Daarmee wordt de
bewijslaag ook commercieel bruikbaar.

## 10. De drie assen

**Toegang** — € 0 → € 65 → € 150 → € 5.000+ → € 20.000+.

**Verbruik** — AI, betalingen, echte externe kosten.

**Verantwoordelijkheid** — zelfbediening → zakelijke software → enterprise
verantwoordelijkheid → menselijke ontzorging.

Daarmee is de ladder geen verzameling willekeurige bedragen meer:

- **€ 0** — maatschappelijke toegang
- **€ 65** — één persoon
- **€ 150** — gestandaardiseerde onderneming
- **€ 5.000+** — enterprise verantwoordelijkheid
- **€ 20.000+** — high-touch menselijke verantwoordelijkheid

## 11. Namen

`RTFoundation` is de stichting die maatschappelijke middelen ontvangt en
beheert. Het gratis product heet **RTG Community**. Twee semantisch totaal
verschillende objecten, twee namen — en die scheiding wordt niet meer opgegeven.
Het interne id van de trede blijft `gratis`: beschrijvend, en het staat in
opgeslagen ledenrijen.
