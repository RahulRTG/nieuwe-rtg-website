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
| Bewijstoken | `commercie/bewijstoken.js` + `/zegel.js` | **af** als laag; nog geen route levert er een in (§5.2) |
| Schaduwstand | `commercie/schaduw.js` | **af** — aan de leverancierspoort, met één regel die vandaag meeloopt (§5.3) |
| Tegenfeit | `commercie/tegenfeit.js` | **af** — met de boardroom als beslisser (§5.4) |
| Economische idempotentie | `kern/betaalopdracht/rij.js` | **af** voor uitbetalingen; nog niet over de hele keten (§5.5) |
| Intent (voornemen) | `commercie/voornemen.js` + `/plan`, `/keuring`, `/uitvoeren` | **af** — de keuring gaat over het totaal (§5.6) |
| Effectieve rechten | `commercie/rechten.js` | **af** — nominaal naast effectief (§5.7) |
| Limits | grenzen op de bevoegdheid | **af**; dagtellers komen van de aanroeper |
| Enforcement | `commercie/routepoort.js` aan de leverancierspoort | **af** — acht van acht capabilities hebben een caller |
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
dekking-klopt-met-toets, en sinds §6.1 ook enforcement. Wat er nog niet in zit:
billing en UI. Zie §7.

### 5.1 De caller-meting (was §6.1, nu gebouwd)

`scripts/capabilities.js` telt per capability of er een caller is buiten de eigen
module. Bij de eerste run: **vijf van de acht stil** — kassa, Werk OS, personeel,
governance en de vaste contactpersoon werden nergens gevraagd. Ze waren
beschreven in het productprofiel, nagepraat door drie toetsen, en in vier
bestanden in commentaar uitgelegd. Niemand werd ooit tegengehouden.

Wat wél en niet als caller telt, is het hele punt:

| Soort | Telt | Waarom |
|---|---|---|
| `mag(pas, 'can_use_pos')` in `server/` | **ja** | hier wordt iemand tegengehouden |
| een regel in de routetabel die aantoonbaar weigert | **ja** | gedragsbewijs, zie hieronder |
| `tredenMet('…')` voor een zin op een scherm | nee | vertellen wat je nodig hebt is geen slot |
| dezelfde aanroep in `test/` | nee | een toets bewijst dat de tabel klopt, niet dat er iets mee gebeurt |
| de naam in commentaar | nee | dit is de gevaarlijkste soort: het leest als bewijs |

**De reparatie werd een tabel, en toen bleef de meter rood.** Een controle in elk
kassabestand zou de zevenenzeventigste pas-id-controle in een ander jasje zijn,
dus de vijf gaten werden gedicht met één tabel aan het keelgat waar elke
leveranciersroute doorheen moet (`routepoort.js` in `leverancierpoort.js`, naast
de persoonseis die daar al staat en om dezelfde reden). Daarmee stond de
capability in een tabel en niet in een `mag()`-aanroep.

De meter kreeg daarvoor **geen uitzondering** — dan meet hij zijn eigen oplossing
goed en de volgende niet. Hij kreeg **gedragsbewijs**: voor elke tabelregel zoekt
hij een trede die de capability niet heeft, roept `beoordeel()` aan, en telt de
regel alleen als hij werkelijk weigert. En de tabel zelf moet een aanroeper
hebben, want anders verplaatst de stille belofte zich één laag omhoog.

**Twee dingen die de meting eerlijk houden.** De poort valt hier *terug* waar de
persoonseis ernaast *dicht*valt: die beschermt kinderen, deze bewaakt een
productgrens, en een migratie die rechten intrekt is een storing met een nette
naam. En het rapport zegt per capability of hij vandaag iemand raakt: kassa, Werk
OS en personeel zitten in béide zakelijke treden, dus die grens is aangelegd maar
bijt nog niet. Alleen governance doet dat, tegen Business Lite.

De bekende grens van de meter staat in zijn eigen kop: hij leest tekst en volgt
geen aanroepgraaf. Een `beoordeel(...)` in een functie die zelf nergens wordt
aangeroepen telt mee. Dat is bij een mutatie aangetoond en niet weggeredeneerd;
wat die laatste schakel vasthoudt is een gedragstoets op de deur zelf.

### 5.2 Het bewijstoken (was §6.2, nu gebouwd)

Een besluit dat alleen in `besluit.js` bestaat, moet door elke volgende stap
opnieuw worden gevraagd — en elke stap moet daarvoor bij de rechtenbron kunnen.
Een **bewijstoken** draagt dat besluit mee: één handeling, één doel, één bedrag,
een paar minuten. Naast de snelheid zit daar de zwaardere winst: een sessie is
vandaag een sleutel tot álles wat de houder mag, en een bewijstoken is het
omgekeerde. Gestolen is dan niet gelijk aan onbeperkt.

Vier dingen zijn hard, en elk ervan is met een mutatie nagetrokken:

1. **Een token kan nooit verruimen.** Hij wordt gemunt úit een bevoegdheid en
   erft haar grenzen; extra grenzen versmallen alleen — met dezelfde `versmal()`
   als delegatie, zodat er één plek is waar "smaller" wordt uitgelegd.
2. **Hij vervalt altijd, en snel.** Maximaal vijftien minuten, en langer wordt
   *geweigerd* in plaats van stil afgekapt. Kort is hier geen voorzichtigheid
   maar de hele constructie: tussen munten en gebruiken kan een bevoegdheid
   worden ingetrokken, en die intrekking bereikt een token pas als hij verloopt.
   Dat is de prijs van niet-opzoeken, en hij hoort opgeschreven te staan.
3. **Bij waarde is hij eenmalig.** Anders is afluisteren genoeg om dezelfde
   betaling twee keer te doen. Dit raakt aan §6.5 (economische idempotentie) en
   vervangt die niet: een nonce beschermt één token, geen keten.
4. **De sleutel is niet de sessiesleutel** maar er met HKDF uit afgeleid onder
   een eigen label. Wie een handtekening onder een bewijstoken zou kunnen
   krijgen, maakt daarmee geen sessietoken — en andersom. Domeinscheiding kost
   hier één regel en is later niet meer in te bouwen.

**Twee mutaties overleefden de eerste ronde**, en dat is het vermelden waard
omdat ze allebei hetzelfde soort blinde vlek waren — een toets die het juiste
gedrag bevestigt zonder de eigenschap te meten:

- Een handtekeningvergelijking op alleen de eerste vier tekens bleef groen: elke
  toets veranderde een veld *willekeurig*, en dan verschilt het begin ook. Een
  forceerder probeert juist niet willekeurig maar bouwt teken voor teken op. Er
  staat nu een token waarvan het begin van de handtekening klopt en de rest niet.
- De gemunte waarde als bovengrens was nergens getoetst: een token voor één euro
  liet duizend euro door zolang de bevoegdheidsgrens dat toestond.

**Wat er nog niet is:** een route die een bewijstoken inlevert. Er is een
producent (`besluit.js` geeft hem mee bij `TOESTAAN`, en alleen daar — ook
`BEPERKT` krijgt er geen, want daar is de gevráágde handeling juist niet
goedgekeurd) en er is een verbruiker in de laag zelf, maar de eerste echte
inlevering hoort bij §6.6, de intent-laag. Dat staat hier zodat het niet als
"af" leest: een token die niemand inlevert, is precies de stille belofte die dit
document elders bestrijdt.

### 5.3 De schaduwstand (was §6.3, nu gebouwd)

§5.1 hing een abonnementscontrole aan de leverancierspoort. Zorgvuldig gebouwd,
tien mutaties nagelopen — en niemand kon zeggen wat hij de volgende ochtend om
negen uur zou dóen: hoeveel verzoeken hij raakt, van wie, op welke paden. Dat is
het moment waarop een handhavingsregel een storing wordt in plaats van een grens.

Een regel staat daarom in één van drie standen: **UIT** (niet eens gewogen),
**SCHADUW** (oordeelt, telt, laat iedereen door) of **AFDWINGEN**. De enige zin
die deze laag echt maakt is de volgende:

> **Je kunt niet afdwingen wat nooit in de schaduw heeft gelopen.**

Zonder die eis is een schaduwstand een vinkje dat niemand aanzet. Met die eis is
hij de enige weg naar afdwingen: minstens 200 waarnemingen én minstens 7 dagen,
en beide moeten gehaald zijn — duizend waarnemingen op één dag zeggen niets over
de maandafsluiting, en een week met drie verzoeken zegt niets over drukte.

**De uitzondering wordt gerekend, niet beweerd.** Een regel die aantoonbaar niets
afpakt, hoeft niet te wachten — maar "aantoonbaar" is hier een som: heeft élke
trede waarop een zaak kan staan de capability, dan kan de regel niemand iets
ontnemen. Verandert het productprofiel, dan vervalt de vrijstelling vanzelf en
valt de regel terug in de schaduw. Vrijstellingen zijn telbaar (`vrijgesteld()`),
want een uitzondering die je niet kunt tellen is over een jaar de regel.

**En dat betrapte meteen mijn eigen werk van een uur eerder.** Van de vier regels
die de abonnementspoort voortbrengt zijn er drie vrijgesteld — kassa, Werk OS en
personeel zitten op béide zakelijke treden. De vierde niet: *governance pakt
Business Lite wel degelijk iets af*, en die regel is in §5.1 meteen aangezet.
Dat had niet gemoeten. Hij loopt nu mee, en hij bijt pas als er bewijs is.

Twee dingen die de meting eerlijk houden: een regel die in de héle
schaduwperiode niemand zou hebben tegengehouden, is niet "veilig om aan te
zetten" maar een regel waarvan we niet weten of hij werkt — dat staat als
waarschuwing in de rijpheid, zonder te blokkeren. En een regel die al maanden in
de schaduw staat, is een besluit dat niemand neemt; `blijftInSchaduw()` telt ze.

Negen mutaties, alle negen gevangen. Drie ervan gingen niet over de laag maar
over de *aansluiting*: zes mutaties op `schaduw.js` lieten de poortdeur groen,
dus dat de deur de schaduwlaag werkelijk raadpleegt was nergens bewezen. Een
laag die je alleen los toetst, is een laag waarvan je hóópt dat hij is
aangesloten. Er staan nu drie gedragstoetsen op de deur zelf, waaronder de
belangrijkste: een ontbrekende schaduwlaag mag geen handhaving uitzetten.

### 5.4 Het tegenfeit (was §6.4, nu gebouwd)

§5.3 laat een regel meelopen en telt wat hij zou hebben tegengehouden. Na een
week staat er een getal, en dan komt de vraag die er werkelijk toe doet: **kan
die regel aan?** En breder: wat gebeurt er als `maxCenten` van 250 naar 150 gaat
— hoeveel handelingen lopen anders, om hoeveel geld, hoeveel extra
goedkeuringen? Zonder antwoord is een beleidswijziging een gok met een
percentage erop.

Drie dingen houden dit eerlijk, en ze zijn alle drie belangrijker dan de
rekensom:

1. **Het draait de échte beslisfunctie.** Twee motoren uit `besluit.js`,
   dezelfde verzoeken erdoorheen. Een tegenfeit dat op een *model* van je
   systeem rekent, meet je model — en modellen en systemen lopen uiteen op
   precies de gevallen waar het om gaat.
2. **Het zegt hoeveel geschiedenis het zag.** Onder de honderd verzoeken komt er
   geen getal maar een mededeling. "3 van de 12" leest als een percentage
   terwijl het ruis is; dat precies ogende getal uit een lege week is hier de
   duurste verleiding.
3. **Het schrijft niets.** Deze module heeft geen `db` en geen `save`, en een
   toets houdt dat vast — dan kán het niet.

**En het verzint geen rangorde.** De eerste versie telde "strenger" als
doorgaan → niet-doorgaan, en noemde `TOESTAAN → BEPERKT` dus geen van beide,
terwijl er precies dan minder geld beweegt. De verleiding is dan om de acht
uitkomsten op één lijn van los naar streng te zetten — maar die lijn bestaat
niet: is BEPERKT (u krijgt minder) strenger of soepeler dan GOEDKEURING (u
krijgt alles, met een handtekening)? Dat hangt af van wie het vraagt. Er staan
daarom vier assen die elk wél eenduidig zijn — geweigerd, wacht, krijgt minder,
voorwaarde erbij — en een overgang kan er meer dan één tegelijk raken. `ONBEKEND`
telt apart: een storing is geen overtreding.

**De beslisser is een mens.** `/api/office/handhaving` toont per regel de
schaduwstand mét het tegenfeit; `/api/office/handhaving/zet` zet hem om, met een
regel in het auditjournaal. Daarmee heeft de keten van §5.3 en §5.4 een
aanroeper aan beide kanten: de poort meldt, de boardroom beslist.

### 5.5 Economische idempotentie (was §6.5) — en de fout die er al zat

Bij het bouwen hiervan bleek het niet om een nieuwe laag te gaan maar om een
reparatie. Elke betaalopdracht in dit huis droeg al een idempotentiesleutel:

```
rtf:<lid>:<factuur>          de foundation-afdracht
pay-uit:<zaak>:<boeking>     de partneruitbetaling
bank-sepa:<iban>:<boeking>   de SEPA-overboeking
```

Die sleutel ging keurig mee naar de rail. **Alleen keek RTG er zelf nooit naar.**
Zes plekken schreven hem, geen enkele las hem. Twee aanroepen met dezelfde
sleutel leverden twee opdrachten van samen het dubbele bedrag, en of dat geld ook
echt twee keer wegging hing af van de goede wil van een externe partij.

Dat is dezelfde fout als "0% commissie" naast een commissieknop, alleen duurder:
een veld dat eruitziet als een grendel en er geen is. Het staat hier omdat het de
derde keer is dat deze vorm opduikt — na de zes stille capabilities en de vier
gebouwde-maar-nooit-aangeroepen functies — en dat is geen toeval meer maar een
patroon om op te letten.

**De sleutel identificeert de economische handeling, niet een poging.** Bestaat
hij al, dan krijgt de aanroeper de bestaande opdracht terug, mét `hergebruikt` en
mét een klacht in het log — stil ontdubbelen zou een tweede stil gedrag zijn op
de plek waar we er net één weghalen. Opnieuw proberen is `dienIn` of de ronde;
wie werkelijk een nieuwe betaling wil, heeft een nieuwe sleutel.

Dat het veilig kon, is nagegaan en niet aangenomen: alle drie de rails maken een
verse boeking per uitbetaling, dus de terugvalsleutel is per definitie uniek en
er bestaat geen legitieme tweede uitbetaling op één boeking. Een reeds afgeronde
opdracht wordt bovendien niet opnieuw ingediend.

**Wat er nog niet is:** dit dekt de uitbetaalkant. De ene wereldwijde
`economic_intent` die door order, betaling, grootboek, leverancier, settlement én
refund loopt, vraagt de intent-laag van §6.6. Wat er nu staat is de plek waar het
geld het huis verlaat — de duurste plek om het níet te hebben.

### 5.6 Het voornemen (was §6.6, nu gebouwd)

Een agent die vijf boekingen doet, vraagt vandaag vijf keer los "mag dit". Bij de
vierde is het budget op. Er staan dan drie boekingen, een boze klant en een
half-uitgevoerde handeling die niemand heeft besloten. **Het beleid heeft
gewerkt en het resultaat is een puinhoop.**

Dus: eerst het hele plan wegen, dan pas beginnen.

```
"boek vijf hotels in Parijs onder € 180"
  → vijf stappen van € 184,40 → € 922,00 totaal
  → beleid: vanaf € 500 een verse bevestiging → WACHT
  → een tweede persoon tekent → GEKEURD → uitvoeren
```

Die zin komt vóór de eerste boeking, niet halverwege. Vijf dingen zijn hard:

1. **De keuring gaat over het totaal.** Niet over de duurste stap en niet over
   het gemiddelde. Vijf keer € 190 is geen vijf kleine besluiten maar één van
   € 950.
2. **Een goedgekeurd plan kan niet meer veranderen.** Een vingerafdruk over de
   stappen, hun bedragen en hun *volgorde* wordt bij elke uitvoering opnieuw
   gerekend. Zonder dat is "goedgekeurd" een stempel op iets dat daarna nog kan
   groeien: keur € 900 goed, voer € 9.000 uit. Wijkt hij af, dan is de
   goedkeuring vervállen — niet "bijna geldig".
3. **Elke uitvoering levert het bewijs in.** Hiermee krijgt het bewijstoken van
   §5.2 eindelijk zijn verbruiker: een stap draait niet op "de keuring stond
   hierboven toch".
4. **Elke stap draagt een eigen economische sleutel** — die van het voornemen
   met het stapnummer erachter. Dat is wat een herhaling onschadelijk maakt tot
   in de betaalrij van §5.5: nu over een hele keten in plaats van over één
   betaling.
5. **Een nee wordt geen ja door het nog eens te vragen.** Er is geen overgang van
   AFGEWEZEN naar GEKEURD.

En twee keuzes die makkelijk de andere kant op hadden gekund: **BEPERKT is voor
een plan geen ja** — een plan van vijf stappen kun je niet voor zestig procent
uitvoeren zonder te weten welke stappen sneuvelen, en dat is een keuze van de
aanvrager, niet van het systeem. **ONBEKEND wordt hier wél een afwijzing**, en
dat spreekt §4 niet tegen: dáár is het verschil tussen "mag niet" en "weten we
niet" belangrijk, híer beweegt waarde en dan valt het dicht.

**Wat halverwege blijft steken, is telbaar.** Een voornemen op `BEZIG` is een
economische handeling die niemand heeft afgemaakt; `/api/office/voornemens` zet
dat getal vooraan.

**De sleutel komt nu ergens vandaan.** `accounts.sleutelVoor('bewijstoken')`
geeft een met HKDF afgeleide sleutel per doel; de ruwe sessiesleutel verlaat de
kluis nooit. Dat was in §5.2 nog een open eind.

Zeven mutaties op de laag, alle zeven gevangen — twee pas na een aanscherping.
De overgangstabel bleek een *tweede* slot dat geen enkele toets raakte (`keur()`
ving alles eerder af), en de sleutelafleiding stond eerst rechtstreeks op de
kluisstaat, waardoor de toets zichzelf in elk toetsproces stil oversloeg en drie
mutaties er dwars doorheen liepen. Een zuivere functie is te toetsen; een die op
modulestaat leunt, doet alsof.

### 5.7 Het rechtenbord (was §6.7, nu gebouwd)

Het antwoord op "wat mag deze partij nu écht" lag na §5.1–§5.6 op zes plekken:
de trede, wat die trede bevat, welk abonnement de zaak wérkelijk draagt, wat het
contract zegt, welke regels vandaag afdwingen en welke nog meelopen, en wat er
aan AI-tegoed over is. Wie dat met de hand samenstelt, doet het één keer goed.

Het bord zet twee kolommen naast elkaar, en dáár zit de waarde:

| | betekenis |
|---|---|
| **nominaal** | wat het productprofiel zegt |
| **effectief** | wat er vandaag werkelijk gebeurt |

Die lopen uiteen zodra een handhavingsregel in de schaduw staat. Een zaak op
Business Lite heeft nominaal geen governance — en krijgt het vandaag tóch, omdat
die regel nog meeloopt. Dat is geen fout maar een besluit (§5.3); het moet alleen
te zien zijn, want anders staat er in de verkooppraatjes iets anders dan in de
deur. **Precies dat gat is waar dit hele traject mee begon.**

Twee dingen die het bord bruikbaar houden in plaats van alarmerend:

- **"Elders bewaakt" is geen gat.** Vier van de acht capabilities hebben hun
  poort buiten de abonnementspoort — `can_use_ai` in `tegoed.js`,
  `can_be_partner` in `zaakabonnement.js` en `partnerkanaal.js`,
  `can_use_lifestyle_service` in `routes/member/lifestyle.js`,
  `can_use_dedicated_support` in `routes/supplier/abonnement.js`. Wie die
  "onbewaakt" noemt, laat vier keer per bord een vals alarm afgaan, en dan leert
  iedereen de kolom te negeren. Het register van wie waar wordt gevraagd is
  `scripts/capabilities.js` (§5.1), niet dit bord.
- **Zonder schaduwlaag zegt het bord "onbekend", niet "afgedwongen".** Doen alsof
  een regel bijt terwijl je het niet kunt nakijken, is precies de soort zekerheid
  die dit document nergens wil.

En het **verandert niets**: geen `save`, geen knop om een regel om te zetten, met
een toets die dat vasthoudt. Een bord dat ook knoppen heeft wordt gebruikt om te
sturen, en dan is er een zevende plek waar rechten vandaan komen in plaats van
één die ze samenvat.

`/api/office/rechten` geeft het bord van één zaak, van één trede, of — zonder
argument — de **scheuren** over alle zaken heen. Loopt een scheur over álle
zaken, dan is het geen zaakprobleem maar een regel die nog niet afdwingt, en dat
staat er apart bij.

## 6. Wat hierna komt, op volgorde

Alles hieronder is **ontwerp en geen code**. Het staat hier zodat de volgorde
vastligt en niemand halverwege iets anders bouwt.

1. ~~**Enforcement in de Promise Gate.**~~ **Gebouwd** — zie §5.1.
2. ~~**Capability tokens**~~ **Gebouwd** — zie §5.2. De laag staat er; de eerste
   route die er een inlevert nog niet.
3. ~~**Shadow enforcement**~~ **Gebouwd** — zie §5.3.
4. ~~**Counterfactual testing**~~ **Gebouwd** — zie §5.4.
5. ~~**Economic idempotency**~~ **Gebouwd voor de uitbetaalkant** — zie §5.5. De
   ene sleutel door de hele keten hoort bij de intent-laag hieronder.
6. ~~**Intent layer + compiler**~~ **Gebouwd** — zie §5.6. Wat er nog niet is:
   een *compiler* die van vrije tekst een plan maakt. De laag die het plan
   controleert staat er; wie het plan opstelt is nu nog de aanroeper.
7. ~~**Effective rights**~~ **Gebouwd** — zie §5.7. Rol, delegatie en risicostand
   staan er nog niet in: die wonen in CONCERN.md respectievelijk `bevoegdheid.js`,
   en een bord dat ze half toont is misleidender dan één dat ze weglaat.
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

- ~~**Cryptografische tokens** vóór de enforcement-meting.~~ Die volgorde is
  aangehouden: eerst de caller-meting (§5.1), toen het token (§5.2). Een
  ondertekend token dat een recht draagt dat nergens wordt gevraagd, zou een
  handtekening onder een lege belofte zijn geweest.
- **De digital twin en economic sagas.** De intent-laag waar ze op leunen bestaat
  sinds §5.6; deze twee staan nog steeds op de lijst en niet in de code, nu
  omdat een saga zonder compensatie-pad erger is dan geen saga.
- **Outcome-aware prijsstelling.** Vraagt gemeten waarde per capability; die
  meting bestaat nog niet, en een verzonnen besparing is erger dan geen.

## 8. De regel die dit document waar moet maken

> Geen belofte zonder afdwingbare capability. Geen capability zonder caller.
> Geen bevoegdheid zonder oorsprong. Geen economische actie zonder bewijs.

Zolang die vier niet allemaal machinaal gemeten worden, is dit een ambitie. Drie
zijn dat nu — belofte (`claims.poort`), oorsprong (`bevoegdheid.herkomst`) en
caller (`scripts/capabilities.js`) — en één deels: bewijs. Dat verschil eerlijk
houden is de hele reden dat dit document een tabel bevat en geen manifest.

En één eerlijkheid hoort erbij: van de vijf gaten die de caller-meting vond, is
er vandaag maar één die werkelijk iemand tegenhoudt. De andere vier zijn
bedrading die klaarligt voor de eerste trede die het onderdeel níet bevat. Dat is
geen fout — een grens die niemand raakt is nog steeds een grens die er is — maar
het is iets anders dan een grens die bijt, en het rapport zegt per capability wat
het van de twee is.
