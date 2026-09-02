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

**Waar die lijn vandaag staat**, na §5.1–§5.10. Eén rij, met per schakel het
enige dat er echt toe doet: is hij aangesloten, of staat hij er alleen?

| | | staat er | wordt gebruikt |
|---|---|---|---|
| Contract | `commercie/contract.js` | ja | ja |
| Capability | `capaciteiten` + `routepoort` | ja | ja — 8 van 8 hebben een caller (§5.1) |
| Delegation | `bevoegdheid.js` | ja | nog niet: geen route delegeert |
| Intent | `voornemen.js` | ja | ja — binnen het huis; nog geen compiler (§6.1) |
| Decision | `besluit.js` | ja | ja — via de voornemens |
| Value | `pay`, `bank`, `betaalopdracht` | ja | ja |
| Settlement | `verrekening` + `ronde` | ja | ja |
| Evidence | `bewijstoken` + `veiligheidskern` | ja | ja — 1 van de 5 soorten (§5.10) |

Drie schakels staan er dus vóór op hun gebruik uit. Dat is geen schande — je kunt
niet bouwen wat niemand nog aanroept — maar het is wel het verschil tussen een
lijn die *bestaat* en een lijn die *draagt*, en dit document telt liever het
tweede.

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
| Terugval-voorstel | `commercie/voorstel.js` + `/weging.js` | **af** — voorstellen, nooit verplaatsen (§5.8) |
| Capability health | `commercie/capgezondheid.js` | **af** — meet; blokkeert nog niet automatisch (§5.9) |
| Veiligheidskern | `commercie/veiligheidskern.js` | **af** — 1 van de 5 soorten gaat er vandaag doorheen (§5.10) |
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

`scripts/capabilityroepers.js` telt per capability of er een caller is buiten de eigen
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

**Wat er nu wel en nog niet is:** de eerste productiecel bestaat inmiddels. Een
betaalde abonnementsbijdrage krijgt één `economic_intent`, drie claims, sluitende
ledgerbundles, settlements, reconciliation en een principal-geïsoleerd Economic
Proof in LivingOS (zie `EXPERIENCE.md`). De universele migratie is nog niet af:
order, leverancier, payroll, travel en refund moeten ditzelfde pad nog krijgen.
De uitbetaalkant hieronder blijft de plek waar geld het huis verlaat — de
duurste plek om idempotentie níet te hebben.

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
  `scripts/capabilityroepers.js` (§5.1), niet dit bord.
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

### 5.8 Het terugval-voorstel (was §6.8, nu gebouwd)

`zaakabonnement.js` laat elke zaak van vóór de ladder terugvallen op `business`
met `herkomst: 'voor-de-ladder'`. Dat was de juiste keuze — een migratie die
rechten intrekt is een storing met een nette naam — maar het is een *terugval* en
geen besluit, en zonder iets dat ze voorstelt staan die zaken er over een jaar
nog.

Drie regels, en de eerste is de enige die er echt toe doet:

1. **Er wordt niets automatisch verplaatst.** Er is één plek waar een trede
   verandert, en dat is `bevestig()` met een naam erbij. Een zaak die op
   maandagochtend haar kassa kwijt is omdat een algoritme vond dat ze hem niet
   gebruikte, is precies de storing die de terugval moest voorkomen.
2. **Geen bewijs is geen voorstel.** De verleiding is om "niets gebruikt" te
   lezen als "de goedkoopste trede volstaat".
3. **Een voorstel zegt wat het afpakt** — met naam, want wie tekent hoort te
   weten wat hij intrekt.

**En daar kwam een vierde bij, die deze module bijna miste.** De laag daarboven
kan lang niet elke capability zien: kassa-artikelen en personeelsrijen staan
ergens te tellen, maar of een zaak ooit governance heeft gebruikt weet niemand.
Een nul uit *"niet gemeten"* ziet er precies zo uit als een nul uit *"niet
gebruikt"* — en op die eerste een onderdeel intrekken is geen voorstel maar een
gok. Daarom is `gemeten` een aparte lijst en geen afgeleide van `gebruik`: wat er
niet in staat en wat de zaak nú heeft, telt als nodig.

Het gevolg is zichtbaar en niet stil: de adapter meet vandaag twee dingen
(kassa-artikelen, personeelsrijen), dus er valt zelden een lágere trede voor te
stellen. Wat er wél uit komt is "leg vast waar deze zaak al draait" — en dat is
óók winst: een terugval wordt een besluit zonder dat iemand iets kwijtraakt.
Groeit de meetlijst, dan worden de voorstellen vanzelf scherper. Eerst meten, dan
voorstellen.

Zeven mutaties, alle zeven gevangen.

### 5.9 Capability health (was §6.9, nu gebouwd)

Een gewone healthcheck kent één antwoord: het huis doet het, of het doet het
niet. Valt de uitbetaalrail om, dan staat er rood — en dan is de vraag "kan de
kassa nog draaien?" niet te beantwoorden, terwijl het antwoord gewoon ja is. Een
restaurant op vrijdagavond wordt niet geholpen door een lampje dat over iets
anders gaat.

Dus een stand **per capability**: GROEN, AMBER, ROOD, QUARANTAINE — en
ONGEMETEN, want *groen is niet "geen nieuws"*. Een capability waar niemand iets
mee deed is niet gezond maar onbewezen, en een bord dat na een stille nacht
overal groen staat, zegt niets. Dezelfde regel als bij de schaduwstand (§5.3) en
het terugval-voorstel (§5.8) — inmiddels drie keer dezelfde discipline op drie
plekken.

**Quarantaine raakt één capability en nooit het huis.** Structureel: `mag()`
neemt een capability en antwoordt alleen daarover; er is geen functie die "alles"
dicht kan zetten, en een toets houdt dat vast. `payout` in quarantaine terwijl
kassa, orders en refunds doorlopen is precies het verschil tussen een storing en
een uitval.

**Automatisch erin, nooit automatisch eruit.** Een onderdeel dat een kwartier
onafgebroken rood staat gaat vanzelf dicht — doorgaan met een rail die alles
weigert kost bij elke poging geld en vertrouwen. Eruit komen doet een mens, met
een naam. Een systeem dat zichzelf dicht doet én zichzelf weer open doet,
verbergt precies de storing die je had willen zien. Automatische quarantaines
zijn apart telbaar.

**En hij meet, hij blokkeert niet.** De uitbetaalrail meldt sinds nu elke
inzending (gelukt of niet), maar niets in de geldstroom raadpleegt `mag()` nog.
Automatisch de geldrail dichtzetten is precies het soort regel dat eerst hoort
mee te lopen — §5.3 bestaat daarvoor. Eerst meten, dan afdwingen; dat de meting
er is en de blokkade niet, staat hier zodat het niet als "af" leest.

Zeven mutaties, alle zeven gevangen. En één fout die géén mutatie was: de module
heette eerst `gezondheid.js`, en dat botste met het Gezondheidsmaatje van de
RTFoundation — ik overschreef daarmee een bestaand toetsbestand. Vandaar
`capgezondheid`: in dit huis gaat "gezondheid" over mensen.

### 5.10 De veiligheidskern (was §6.10, nu gebouwd)

Alles hiervóór beantwoordt een deelvraag: mag deze actor dit (§4), draagt hij daar
bewijs van (§5.2), past het hele plan (§5.6), gebeurt het maar één keer (§5.5).
Wat ontbrak is de plek waar die antwoorden **verplicht** worden gesteld. Zolang
een domein rechtstreeks geld kan verplaatsen, is elk van die lagen een
aanbeveling.

**Vijf soorten, en niet meer:** WAARDE, IDENTITEIT, RECHTEN, EXPORT, AI. Waarom
juist deze: het zijn de handelingen die je niet terug kunt nemen door een scherm
te verversen. Al het andere is werk; dit is onomkeerbaar werk.

**De kern is piepklein, en dat is een eigenschap.** Een veiligheidskern van
vijfhonderd regels is geen kern maar een tweede applicatie, en niemand leest hem
nog in één keer. `test/veiligheidskern.test.js` telt de regels code en zakt boven
de zestig. Wie er iets bij wil zetten, hoort eerst te vragen of het niet
*erbuiten* kan.

Drie regels: **geen handeling zonder besluit** dat doorlaat (voor waarde,
identiteit en rechten — export en AI gaan er wél doorheen maar hebben hun poort
elders, en twee plekken die dezelfde grens trekken is er één te veel), **geen
handeling zonder wie en waarom**, en **alles laat een spoor, juist wat mislukt**.
De kern eet geen fouten op: dat is precies hoe een mislukte betaling ooit een
geslaagd antwoord werd.

**Wat er vandaag werkelijk doorheen gaat: één van de vijf.** De uitvoering van
een voornemen (§5.6) stuurt elke stap die geld verplaatst door de kern, met het
besluit eronder en een regel in het journaal. De andere vier soorten niet.
`/api/office/kernjournaal` zet dat getal vooraan — `vanDeVijf` — want een kern
die er staat en waar niets langs komt, is precies de stille belofte die dit
document van begin tot eind bestrijdt.

Tien mutaties, alle tien gevangen. Eén ervan pas na een correctie die het
vermelden waard is: de toets liep met `for (const soort of EIST_BESLUIT)` over
de tabel die hij moest controleren, en toetste dus zichzelf. De drie soorten
staan er nu voluit in.

## 6. De routekaart, en wat er van elk punt terechtkwam

Dit stond hier op 20 augustus 2026 als **ontwerp en geen code**, zodat de
volgorde vastlag en niemand halverwege iets anders zou bouwen. Alle tien zijn
gebouwd. Belangrijker dan dat vinkje is wat er per punt *niet* gelukt is; dat
staat erbij, want een routekaart die alleen afvinkt, is een routekaart die liegt.

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
8. ~~**Self-healing fallback**~~ **Gebouwd** — zie §5.8, met één afwijking van de
   oorspronkelijke formulering: "op basis van hun historie" is het niet geworden,
   want die historie bestaat niet. Het voorstel leunt op wat er nú te tellen
   valt, en zegt met naam waar het niet naar heeft gekeken.
9. ~~**Capability health**~~ **Gebouwd** — zie §5.9. De *failover* zelf (een
   gequarantainede capability die de geldstroom werkelijk tegenhoudt) staat er
   nog niet: die regel hoort eerst mee te lopen.
10. ~~**Safety kernel**~~ **Gebouwd** — zie §5.10. De kern staat er en is klein;
    "doorheen moeten" geldt vandaag voor één van de vijf soorten. Dat getal
    staat in het kantoor, zodat het zichtbaar is en niet aangenomen.

### 6.2 Het spiegelbeeld: de Ghost Capability Gate

Regel 2 zegt *geen capability zonder caller*, en §5.1 meet dat. De andere kant is
even hard en werd nergens gesteld: **RTG mag geen afdwingbaar onderdeel hebben
dat op geen enkele trede staat.** Zo'n capability is een spook — hij houdt mensen
tegen (de code vraagt hem, de poort weigert) maar er is geen product waar hij bij
hoort, dus niemand heeft hem gekocht en niemand kán hem krijgen. Dat is geen dode
code die je opruimt als je toevallig langsloopt; het is een deur die dicht zit
zonder dat iemand er een sleutel voor heeft laten maken.

`scripts/capabilityroepers.js` meet het nu in dezelfde run. Vandaag zijn er nul — en
juist daarom hoort de meting te bestaan, want de dag dat er één komt, komt hij
stil.

De toets moest daarvoor wel zelf een spook máken. De eerste versie stelde alleen
vast dat er vandaag geen zijn, en dat blijft groen als de meting helemaal niets
doet: een mutatie liep er dwars doorheen. Nu voegt de toets tijdelijk een
capability aan de tabel toe die nergens te koop is, en controleert dat hij hem
vindt — en ruimt hem op in een `finally`, want die tabel is gedeeld.

### 6.1 Wat er na deze tien openstaat

Uit de aantekeningen hierboven, op volgorde van waarde:

1. **De intent-compiler** (§5.6) — van vrije tekst naar een plan. De laag die het
   plan controleert staat er; wie het plan *opstelt* is nu nog de aanroeper. Dit
   is het stuk waar de eigenaar mee begon ("boek vijf hotels in Parijs") en het
   enige dat nog tussen ontwerp en gebruik in staat.
2. **De vier andere soorten door de veiligheidskern** (§5.10). Vandaag gaat er
   één van de vijf doorheen. Identiteit en rechten zijn de volgende twee, en ze
   zijn allebei goed af te bakenen.
3. **De capability-failover** (§5.9) — een gequarantainede capability die de
   geldstroom werkelijk tegenhoudt. Eerst laten meelopen (§5.3), dan afdwingen.
4. **De governance-regel uit de schaduw halen** (§5.3). Over een week staat er
   een getal; `/api/office/handhaving` zegt dan of hij aan kan.
5. **Meer meten voor het terugval-voorstel** (§5.8). Zolang de adapter twee
   dingen ziet, valt er zelden een lagere trede voor te stellen.
6. **`claim.social.share`** wacht nog steeds op `RTF_IBAN`. Dat is een
   bankrekening en geen code.

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
caller (`scripts/capabilityroepers.js`) — en één deels: bewijs. Sinds §5.10 is dat
laatste voor één van de vijf soorten onomkeerbare handelingen wél hard: een
waardestap uit een voornemen komt er zonder besluit niet doorheen. Dat verschil
eerlijk houden is de hele reden dat dit document een tabel bevat en geen
manifest.

En één eerlijkheid hoort erbij: van de vijf gaten die de caller-meting vond, is
er vandaag maar één die werkelijk iemand tegenhoudt. De andere vier zijn
bedrading die klaarligt voor de eerste trede die het onderdeel níet bevat. Dat is
geen fout — een grens die niemand raakt is nog steeds een grens die er is — maar
het is iets anders dan een grens die bijt, en het rapport zegt per capability wat
het van de twee is.
