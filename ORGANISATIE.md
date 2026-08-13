# ORGANISATIE.md — Organisational Physics

Magnaat simuleert niet alleen *wat* een bedrijf doet, maar **waarom sommige
organisaties onder druk blijven functioneren en andere uit elkaar vallen terwijl
hun cijfers er nog prima uitzien.**

`VERHAAL.md` beschrijft de werklaag: een dienst, een storing, een keten van
besluiten. Dit document beschrijft wat daar boven ligt — de natuurkunde van een
organisatie. Lees het naast `CONCERN.md` (dat gaat over de *juridische* vorm van
een bedrijf) en `VERHAAL.md` (dat gaat over de mens erin).

---

## 1. De keten

Een organisatie die iets oplost, doorloopt zeven schakels:

> **waarnemen → begrijpen → bevoegd zijn → beslissen → uitvoeren → overdragen → leren**

En ze kan op elke schakel breken. Dat is de kern van dit document: **zeven totaal
verschillende organisatorische oorzaken voor hetzelfde eindresultaat.**

| # | schakel | het faalt als | staat er |
|---|---|---|---|
| 1 | waarnemen | niemand ziet het | ✅ `rush.js`, `rush-weten.js` |
| 2 | begrijpen | iemand ziet het maar begrijpt het verkeerd | ✗ |
| 3 | bevoegd zijn | iemand begrijpt het maar mag niets beslissen | ✅ `mandaat.js`, `beheer-besluit.js` |
| 4 | beslissen | iemand mag beslissen maar durft niet | ✗ |
| 5 | uitvoeren | er is besloten maar niemand voert het uit | ✗ |
| 6 | overdragen | het is uitgevoerd maar slecht overgedragen | ✅ `overdracht.js` |
| 7 | leren | het keert terug omdat de organisatie niets opstak | ◐ `organisatie.js` |

En het eindresultaat is elke keer dezelfde zin:

> Koeling B is alweer kapot.

---

## 2. De wet die er al onder ligt

Uit `VERHAAL.md` hoofdstuk 15, en hij geldt voor alles wat hierna komt:

> **De wereld weet wat waar is. Een ploeg weet alleen wat zij kan ZIEN of wat
> aan haar is OVERGEDRAGEN.**

Drie informatiebronnen, en ze mogen nooit één worden:

| | wat het is | waar het woont |
|---|---|---|
| **waarneembaar** | de stand van de wereld | `storing.js`, op de vestiging |
| **overdracht** | wat de vorige ploeg bewust achterliet | `overdracht.js` |
| **audit** | wie besloot en wat het kostte | `storing-keten.js`, voor wie bestuurt |

Zou iedereen de audit kunnen lezen, dan verdwijnt alle menselijke frictie en is
iedereen alwetend — en dan is een organisatie een rekenmachine met rollen.

---

## 3. De grenzen

Deze staan boven elke functie hieronder. Waar een functie ermee botst, vervalt
de functie.

**GEEN SCORE. NERGENS.** Geen `organisatiekwaliteit: 91`, geen `bus factor: -20`,
geen `knowledge_debt = 74`, geen `cultuur: 82%`. Alles wat dit document belooft
komt uit **feiten die er al staan**, geteld en naast elkaar gezet. Een getal dat
"hoe goed is mijn organisatie" heet, wordt een ding om te maximaliseren — en dan
speelt iemand het cijfer in plaats van het bedrijf.

**EEN LEZING, GEEN TWEEDE VOORRAAD.** Alles hier is afgeleid van het
besluitenlog, de storingen en de dienstverbanden. Wordt het ergens opgeslagen,
dan is er een tweede waarheid die kan gaan afwijken. Dezelfde regel als in
`loopbaan-profiel.js`.

**INZICHT IS GEEN MECHANIEK.** Een herhaling kost geen cent extra. Wat hij kost,
kostte hij de vorige keer ook — en juist dát is de les: de rekening was er
altijd al, alleen niemand telde hem op. Zou er een boete op staan, dan gaat een
speler zijn geschiedenis wegpoetsen in plaats van eruit leren.

**EEN LEZING BELOOFT NOOIT MEER DAN ZIJN BRON DRAAGT.** De audit is afgekapt
(`storing-keten.js` `LENGTE`), dus een telling gaat over *de laatste besluiten*
en niet over de hele campagne — en dat staat er met zoveel woorden bij.

---

## 4. Wat er nu staat

`magnaat/organisatie.js`, en het is bewust klein.

### Herhaling — de schakel `leren`

Een koeling die voor de derde keer stukgaat is niet zwaarder kapot dan de eerste
keer. De wereld doet precies hetzelfde. Maar het is een **ander verhaal**, en dat
verhaal stond nergens:

> Koeling B is de 3e keer stuk
> de eerste keer in maand 88 · 2 keer met een tijdelijke oplossing

Die tweede regel is de eerste vorm van **kennisschuld** die uit deze bron af te
lezen is: *structureel tijdelijke maatregelen*. Drie keer een noodkoeling is een
ander verhaal dan drie keer een monteur.

### Wie het feitelijk doet

Iedere onderneming heeft twee organisaties: wie er volgens het organigram
verantwoordelijk is, en **wie mensen daadwerkelijk bellen als het misgaat.** Dat
verschil staat in geen enkel veld — maar het staat wel in de besluiten:

> Wie het feitelijk doet
> Boris (vakkracht) · 9 besluiten · van de laatste 16

De regel verschijnt alleen als er iemand ánders is dan de eigenaar. Is die er
niet, dan is er geen tweede organisatie en zou de regel alleen bevestigen wat het
organigram al zei.

---

## 5. Waar het heen gaat

In volgorde van wat er op het bestaande fundament past.

### Knowledge debt

Zoals technische schuld. Een workaround werkt, iedereen is druk, niemand legt hem
vast. Volgende maand hetzelfde. Boris weet nog hoe het moet, dus niemand voelt
pijn. Zes maanden later heeft Boris vijf informele workarounds in zijn hoofd en
lijkt de onderneming efficiënter dan ooit.

**Een uitstekend draaiend bedrijf kan dus steeds kwetsbaarder worden.** Af te
leiden uit: terugkerende afwijkingen zonder vastgelegde oplossing, processen die
van dezelfde mens afhangen, herhaalde onderzoeksuren, structureel tijdelijke
maatregelen, overdrachten zonder sluitende oorzaak.

### Sleutelpersonen en succession risk

Dan zegt Boris op. Niet *"bus factor -20"* — de organisatie **ontdekt langzaam
dat haar organigram gelogen heeft.**

En dat geeft promotie een veel grotere betekenis: een goede leider is niet
degene die alles zelf oplost, maar degene die ervoor zorgt dat anderen het ook
kunnen. Was Boris eigenlijk het bedrijf?

### De communicatiefout, in vijf soorten

Niet alleen "Boris meldt iets verkeerds":

| soort | wat er gebeurt |
|---|---|
| **verlies** | informatie wordt nooit doorgegeven |
| **vervorming** | informatie komt verkeerd aan |
| **vertraging** | informatie komt te laat |
| **overload** | alles wordt gemeld, waardoor niets meer opvalt |
| **verkeerde ontvanger** | de juiste informatie belandt bij iemand die niets kan doen |

Die laatste is de sterkste. Boris meldt correct *"compressordruk fluctueert"* —
aan de eigenaar. Die weet niet wat ermee moet. De technische dienst had het in
twintig minuten opgelost. Alle informatie was aanwezig en tóch faalde de
organisatie. **Routing.** Dan wordt operationeel ontwerp gameplay.

### Mandaat als architectuur

Een koelinstallatie moet voor €14.000 vervangen worden. De vakkracht ziet het
maar mag alleen mitigeren. De bedrijfsleider mag tot €5.000 en moet escaleren. De
regiomanager mag €25.000 maar krijgt de melding pas morgen. De eigenaar heeft
zichzelf verplicht alles boven €10.000 goed te keuren — en is op vakantie.

Geen scripted crisis. **Een besluitvormingsarchitectuur die zelf een crisis
veroorzaakt.** En drie maanden later reconstrueert de boardroom precies waar hij
vastliep, met €31.400 indirect verlies vóór de definitieve reparatie.

### Dashboards die expres onvolmaakt zijn

Een eigenaar hoort niet de absolute waarheid te zien. Hij ziet **wat zijn
organisatie kan rapporteren.**

```
Wereldwaarheid:       12 storingen
Vestiging registreerde: 9
Managementdashboard:    7
Boardroom zag:          4 als materieel risico
```

Dat verschil is geen bug. Dat *is* de organisatie. En dan krijgt audit een echte
functie: achteraf reconstrueren waarom management iets niet wist.

### Governance onder druk

Crises die niet moeilijk zijn omdat de getallen groter worden, maar omdat de
organisatie **overbelast** raakt. Eén storing is prima. Een storm die twaalf
locaties raakt: elke bedrijfsleider escaleert, regiomanagement loopt vol, de CFO
krijgt liquiditeitsvragen, techniek heeft te weinig monteurs. De vraag wordt:
*kan jouw organisatie prioriteren zonder dat jij alles gaat micromanagen?*

### Cultuur zonder cijfer

Een bedrijf waar mensen problemen vroeg melden functioneert anders dan een waar
iedereen bang is slecht nieuws omhoog te sturen. Managers die elke escalatie
afstraffen krijgen prachtige dashboards — tot alles tegelijk ontploft.

Daarmee wordt *"we hebben weinig incidentmeldingen"* zowel goed als heel slecht
nieuws. Een speler moet leren **interpreteren** in plaats van KPI's maximaliseren.

### Organisaties vergelijken zonder ranglijst

> **Havenzicht** — problemen worden vroeg gemeld · 84% van de operationele
> besluiten wordt lokaal genomen · structurele problemen na gemiddeld 1,8
> herhalingen opgelost · twee processen hangen van één persoon af

> **Noordzee Horeca** — weinig meldingen · veel storingen keren terug · vier
> managers beslissen vrijwel niets zonder de eigenaar · zes sleutelprocessen
> hebben één kennisdrager · bij afwezigheid van de eigenaar stijgt de
> hersteltijd sterk

Voelt als een consultancy-audit. Alle tekst komt uit de gespeelde wereld.

---

## 6. De afwezigheidsproef

De uiteindelijke test, en met opzet geen test op winst of groei.

Kloon hetzelfde concern. In wereld A blijft de eigenaar actief; in wereld B
verdwijnt hij twaalf maanden. Zelfde economie, zelfde externe gebeurtenissen.
Vergelijk daarna continuïteit, verlies, besluitvertraging, escalaties,
personeelsverloop, kennisschuld, crisisrespons en strategische missers.

Niet om de eigenaar te straffen. Om te meten:

> **Is dit een bedrijf, of gewoon één uitzonderlijk mens met personeel eromheen?**

Dan hoeft het spel bij *"ik wil drie maanden niet spelen"* niet te vragen "weet
je het zeker?". De echte vraag is of je een organisatie hebt gebouwd die dat
aankan. En kom je terug, dan lees je:

```
Executive Review — 91 dagen
28 operationele incidenten · 24 lokaal opgelost · 3 geëscaleerd
1 strategisch besluit wachtte op jou
omzet stabiel · twee sleutelpersonen vertrokken
één vestiging ontwikkelde structurele overdrachtsproblemen
geen kredietconvenanten geschonden
Rotterdam heeft zonder jouw tussenkomst een nieuw bedrijfsleider benoemd
```

Dat is de progressie waar dit alles heen gaat. Niet *"ik heb genoeg geld om niet
meer te spelen"*, maar:

> **Ik heb iets gebouwd dat zonder mij kan bestaan.**

---

## 7. De boog

    Eerst bouw je een carrière.        VERHAAL.md
    Dan bouw je een bedrijf.           GELD.md, CONCERN.md
    Dan bouw je een organisatie.       dit document
    Uiteindelijk bouw je een instituut dat jou kan overleven.
