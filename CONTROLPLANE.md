# CONTROLPLANE.md — RTG Economic Control Plane

*Koerswijziging van de eigenaar, 20 augustus 2026. Niet: RTG Money verder
uitbouwen. Wel: de laag waarop capability, geld, bewijs, identiteit, organisaties
en AI één systeem worden.*

**Lees dit document met COMMERCIE.md ernaast.** Dat beschrijft de commerciële
kern (wat iets kost, wat een abonnement bevat); dit beschrijft de laag die vóór
elke economische handeling bepaalt of zij mag, en achteraf kan bewijzen waarom.

## 0. De ambitie, in één zin

> RTG kan vóór iedere economische handeling bewijzen wie iets mag, waarom, met
> welke waarde, binnen welke grens, onder welke overeenkomst, met welk risico,
> via welke rail — en kan achteraf bewijzen waarom die beslissing correct was.

De markt beweegt naar AI-agentbetalingen: Mastercard demonstreerde in 2026
agentic payments in productie en kondigde machine-to-machine payments aan, Visa
werkt aan cryptografisch herkenbare agents en verifieerbare commerce-intent.
"Onze AI kan betalen" is dus geen onderscheid meer.

**Waar RTG wél kan winnen is de combinatie**, als één doorlopende lijn:

```
Contract → Capability → Delegation → Intent → Decision → Value → Settlement → Evidence
```

Niet omdat de losse stukken uniek zijn — banken, kaartnetwerken en clouds bouwen
ze allemaal — maar omdat ze bij RTG in één huis staan en elkaar kunnen bewijzen.

## 1. De vier regels

Dit is de kern, en alle drie de fouten van 20 augustus 2026 waren een schending
ervan:

1. **Geen belofte zonder afdwingbare capability.**
   *"0% commissie" stond in de voorwaarden naast een commissieknop op 12%.*
2. **Geen capability zonder caller.**
   *Zes van de acht capabilities werden nergens gevraagd.*
3. **Geen bevoegdheid zonder oorsprong.**
   *Een zaak droeg geen trede; `mag(zaak, cap)` was een vraag zonder onderwerp.*
4. **Geen economische actie zonder bewijs.**
   *Drie verplichtingen lagen vast en werden door niets opgepakt.*

Elke regel is nu machinaal te meten. Dat is het verschil met een principe.

## 2. De keten, en waar hij nu is

```
SUBJECT → CONTRACT → ENTITLEMENTS → CAPABILITIES → POLICIES → LIMITS
        → EVIDENCE → ACTION → VALUE MOVEMENT → SETTLEMENT → PROOF
```

| Schakel | Waar | Staat |
|---|---|---|
| Subject | accounts, suppliers | bestond |
| Contract | `commercie/contract.js` | **af** |
| Entitlement | `pasladder.js` (product) | **af** |
| Capability | `commercie/capaciteiten.js` | **af** (per trede) |
| Bevoegdheid + grenzen | `commercie/bevoegdheid.js` | **af** — vier dimensies, delegatie versmalt |
| Policy + decision | `commercie/besluit.js` | **af** — acht uitkomsten |
| Limits | grenzen op de bevoegdheid | **af**; dagtellers komen van de aanroeper |
| Evidence | `commercie/claims.js` + de bewijslaag | **deels** |
| Action | de bestaande domeinen | bestond |
| Value movement | `pay`, `bank` | bestond |
| Settlement | `commercie/verrekening.js` + `ronde.js` | **af** |
| Proof | het besluit draagt zijn keten | **begin** |

## 3. Een bevoegdheid is geen ja of nee

Een boolean is te grof voor de vraag die ertoe doet. "Mag deze medewerker
terugbetalen" hangt af van hoeveel, waar en onder welke omstandigheden. Met
booleans krijg je `refund_10`, `refund_50`, `refund_250` — honderd capabilities
voor één handeling.

**Vier dimensies** (`kern/commercie/bevoegdheid.js`):

```
WAT      money.refund
WAAR     zaak:KIKUNOI
HOEVEEL  maxCenten 25000, maxPerDagCenten 100000
WANNEER  alleenEigenVestiging, apparaatVertrouwd, omkeerbaarVerplicht
```

### Delegatie kan alleen versmallen

Structureel, niet als vuistregel. Een gedelegeerde bevoegdheid krijgt per grens
de **engste** van beide kanten; wie meer weggeeft dan hij heeft, geeft weg wat
hij heeft:

```
directeur   € 100.000
  manager    € 20.000     (kan geen € 200.000 worden)
  AI-agent    € 2.000
  deelproces    € 250
```

Twee subtiliteiten die het verschil maken:

- **Een vergeten grens verruimt niets.** Noemt een delegatie `apparaatVertrouwd`
  niet, dan blijft die staan. Anders was "de grens weglaten" de makkelijkste
  escalatie die er is.
- **Een andere scope is geen versmalling.** Van `zaak:A` naar `zaak:B` is
  verhuizen, niet inperken; dat wordt geweigerd.

Daarmee is een hele klasse rechten-escalatie *onmogelijk* in plaats van
onwaarschijnlijk — en de vraag die na een incident als eerste komt (*waarom mocht
deze agent € 82,40 uitgeven?*) is een veld en geen archeologie.

## 4. Eén beslisvraag, acht uitkomsten

```
beslis({ actor, handeling, doel, waardeCenten, context })
```

**"Nee" is er maar één van.** Een autorisatielaag die alleen ja of nee kent,
dwingt elke aanroeper zelf te verzinnen wat er dan wél kan — en dan staat er in
het ene scherm "verboden" en in het andere "vraag je manager".

| Uitkomst | Wanneer |
|---|---|
| `TOESTAAN` | binnen bevoegdheid en beleid |
| `BEPERKT` | te veel gevraagd, maar tot de grens kan het wel |
| `OMKEERBAAR` | mag, mits terug te draaien |
| `GOEDKEURING` | een tweede persoon tekent mee |
| `EXTRA_BEWIJS` | vraagt een verse bevestiging (step-up) |
| `UITSTELLEN` | dagtotaal vol — morgen mag het wel |
| `WEIGEREN` | mag niet, met de reden |
| `ONBEKEND` | de vraag kon niet worden beantwoord |

`ONBEKEND` is met opzet **geen synoniem van** `WEIGEREN`. "We weten het niet" en
"het mag niet" zijn verschillende dingen; wie ze samenvoegt, bouwt een systeem
dat bij een storing klinkt als bij een overtreding. Wat een aanroeper ermee doet
staat op één plek (`veiligeUitkomst`): **alles wat waarde verplaatst valt dicht,
een leesvraag mag open blijven.** Fail closed waar het moet, fail useful waar het
kan — als besluit, niet als toeval.

Het **beleid** komt bovenop de bevoegdheid en hangt aan het bedrag, niet aan de
persoon: ook wie ruim bevoegd is, tekent bij een groot bedrag niet alleen.

## 5. De Promise Gate

`claims.poort()` was al streng op één ding: liegen over de hardheid. Hij keurt nu
ook of een claim naar iets **wijst dat bestaat** — een claim die naar
`kern/commercie/verzonnen.js` wijst ziet er net zo degelijk uit als een die
klopt, en dat is erger dan geen bron omdat hij uitnodigt om niet te kijken.

De volledige keten die uiteindelijk verplicht wordt:

```
CLAIM → CAPABILITY → ENFORCEMENT → TEST → EVIDENCE → BILLING → UI
```

Wat er nu machinaal in zit: claim → bron (bestaat) → toets (bestaat) →
dekking-klopt-met-toets. Wat er nog niet in zit: enforcement (is er een caller?),
billing en UI. Zie §7.

## 6. Wat hierna komt, op volgorde

Alles hieronder is **ontwerp en geen code**. Het staat hier zodat de volgorde
vastligt en niemand halverwege iets anders bouwt.

1. **Enforcement in de Promise Gate.** Meet per capability of er een caller is
   buiten de eigen module. Dat is precies de meting die de zes stille
   capabilities vond, en zij hoort automatisch te draaien in plaats van met de
   hand. *Dit is de goedkoopste en waardevolste volgende stap.*
2. **Capability tokens** — kortlevende, ondertekende autorisatie
   (*proof-carrying authorization*): actor, capability, resource, limiet,
   vervaltijd, beleidsversie, nonce, handtekening. Minder databasecalls per
   verzoek, en een gestolen sessie is niet meer gelijk aan onbeperkte rechten.
3. **Shadow enforcement** — een nieuwe regel eerst een week meelopen zonder te
   blokkeren: *wat zou er gebeurd zijn?* Pas daarna afdwingen.
4. **Counterfactual testing** — een beleidswijziging tegen de geschiedenis
   draaien: `refund.max 250 → 150` geeft *73 transacties anders, € 11.294
   betroffen, 51 extra goedkeuringen*.
5. **Economic idempotency** — één wereldwijde `economic_intent` die door order,
   betaling, grootboek, leverancier, settlement en refund loopt. Zeventien
   retries, één economische handeling. Dit voorkomt de duurste klasse bugs.
6. **Intent layer + compiler** — van *"boek vijf hotels in Parijs onder € 180"*
   naar een gecontroleerd plan, met de blokkade vóór uitvoering: *"€ 922 totaal;
   beleid staat € 900 toe → goedkeuring nodig."*
7. **Effective rights** — één bord: wat mag deze partij nu écht, uit product,
   contract, rol, delegatie, beleid, uitzonderingen en risicostand.
8. **Self-healing fallback** — de zaken op `voor-de-ladder` automatisch
   voorstellen op basis van hun historie, en pas na menselijke bevestiging
   verplaatsen.
9. **Capability health** (GROEN/AMBER/ROOD/QUARANTAINE) en **capability-level
   failover**: `payout` in quarantaine terwijl kassa, orders en refunds
   doorlopen. Veel beter dan "healthcheck rood → platform stuk".
10. **Safety kernel** — één piepkleine kern waar waardeverplaatsing,
    identiteitswijziging, rechtenwijziging, data-export en AI-uitvoering
    doorheen moeten.

## 7. Wat we bewust nog niet doen

- **Cryptografische tokens** vóór de enforcement-meting. Een ondertekend token
  dat een recht draagt dat nergens wordt gevraagd, is een handtekening onder een
  lege belofte. Eerst §6.1, dan §6.2.
- **De digital twin en economic sagas.** Prachtige ideeën, maar ze leunen op een
  intent-laag die er niet is. Ze staan op de lijst en niet in de code.
- **Outcome-aware prijsstelling.** Vraagt gemeten waarde per capability; die
  meting bestaat nog niet, en een verzonnen besparing is erger dan geen.

## 8. De regel die dit document waar moet maken

> Geen belofte zonder afdwingbare capability. Geen capability zonder caller.
> Geen bevoegdheid zonder oorsprong. Geen economische actie zonder bewijs.

Zolang die vier niet allemaal machinaal gemeten worden, is dit een ambitie. Twee
zijn dat nu (belofte, oorsprong), één deels (bewijs), één nog niet (caller — §6.1).
Dat verschil eerlijk houden is de hele reden dat dit document een tabel bevat en
geen manifest.
