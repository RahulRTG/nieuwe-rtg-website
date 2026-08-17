# Het beginscherm — één, en het is de werktafel

Vastgelegd 11 augustus 2026 als *De levende wereld*; herschreven 17 augustus 2026,
toen de klok van het beginscherm af ging. Dit document beschrijft het
**beginscherm**; CANVAS.md beschrijft de opbouw van elk ánder scherm en blijft
daar leidend, WERKRUIMTE.md beschrijft het desktopparadigma van RTG Command,
ONTWERP.md en MATERIAAL.md gaan over de vormtaal.

## De regel, in één zin

> **Er is één beginscherm, en dat is de werktafel van RTG Command.**

Wie inlogt komt daar uit. Wie zijn laatste werkblad sluit blijft daar. Wie op
Home drukt komt daar terug. Drie handelingen, één plek — `land()`, `leeg()` en
`thuis()` in `shared/command.js` en `shared/command/werktafel.js` komen alle drie
op dezelfde toestand uit, en dat is geen toeval maar de hele afspraak.

Het scherm zegt wat het is: *"Kies een wereld om te beginnen."* Er staat niets
voorgekookt open. Wie binnenkomt kiest zelf; het huis opent geen activiteit,
geen voorbeeld en geen dashboard voor hem.

## Wat hier stond, en waarom het weg is

Hier stond de klok. Niet als widget maar als **kern**: de hoofdwerelden hingen
als merken op een bezel eromheen, je draaide eraan om te reizen, je zoomde een
wereld in zonder de cirkel te verlaten, en lang drukken gaf een Command Wheel met
vijf werkwoorden. Daarnaast lag een schakelaar Wereld / Rooster in het
bedieningspaneel, en de belofte eronder was: *er zijn geen twee beginschermen,
beide standen delen dezelfde lijst, dezelfde klok en dezelfde balk van Rahul.*

Die belofte is niet gesneuveld — hij is verhuisd. De werktafel werd het
beginscherm (commit `c974015`), en daarmee waren er alsnog twee: de klok waar je
op landde, en de werktafel die eroverheen kwam. Eén van de twee moest weg, en dat
is de klok geworden. Wat er van hem over is:

- **Het horloge staat nog op het inlogscherm** (`os-lock-klok`, `shared/klok.js`).
  Daar is het het eerste wat je ziet, en dáár is het merk het antwoord op een
  leeg scherm. Op een beginscherm was het een groot rond ding boven de dingen
  waarvoor je kwam.
- **De werelden staan bovenaan de bank** van de werktafel, boven de software en
  onder een eigen kopje (`shared/command/bank.js`). Ze dragen hetzelfde teken als
  hun huis, in goud, want een wereld is hier geen app maar een huis.
- **De onderdelen staan op het huis zelf.** `/apps/rtg.html`, `/apps/kantoor.html`
  en `/apps/foundation/index.html` dragen ze alle drie compleet. Ze een tweede
  keer in de bank hangen zou een rail van veertig regels geven, en de vraag welke
  van de twee lijsten de echte is.
- **`shared/wereld.js`, `shared/wereld.css` en `test/wereld.e2e.js` zijn
  verwijderd**, samen met de schakelaar Wereld / Rooster, de momenten op de
  wijzerplaat, de gouden ring van Rahul en de ritme-teller die alleen die ring
  bediende. Een laag die zijn enige lezer verliest gaat mee; blijven staan maakt
  hem niet reversibel, alleen onvindbaar.

## En toen ging het springboard er ook af

De schil eronder (`.os-thuisscherm` in `apps/app.html`) bleef eerst nog staan als
scherm: één knop in de bank vouwde de werktafel op en dan stond hij er weer. Dat
was opnieuw een tweede beginscherm, en hij is een dag later gevolgd — **je kunt
er niet meer komen**, en `command.css` houdt hem uit beeld ook als er iets anders
misgaat.

Wat daar woonde en NIET mocht verdwijnen, staat nu boven de werktafel in plaats
van eronder:

- **Het bedieningspaneel** — met scannen, je Zegel, je backoffice, de Boardroom,
  de algemene pin, taal, weergave, push, zoeken, meldingen en **uitloggen**. Het
  hing achter de knop rechtsboven op het springboard; het staat nu in de **voet
  van de bank**, en de bovenrand omlaag halen werkt nog steeds (`shared/randen.js`
  luistert op `document`, niet op een scherm).
- **Rahul** — zijn balk stond onderaan het springboard. Gemeten na het weghalen:
  nul zichtbare ingangen. Zijn console in de werktafel wordt verborgen door
  `shared/rahul-tab/style-base.js`, de tab die daarvoor in de plaats komt vindt
  op deze pagina geen gastheer, en de handenvrij-balk hangt bewust weg tot je hem
  roept. Er staat nu een deur **Rahul** in dezelfde voet, die `RTGRahul.open()`
  aanroept — dezelfde manier waarop de rest van het huis hem roept.

De schil zelf blijft bestaan als **la**, niet als scherm: een doorzichtige,
klikdoorlatende laag boven de werktafel waar die panelen in hangen. Gaat er tóch
een scherm open (een tab uit Spotlight), dan is hij even weer een scherm —
ondoorzichtig, met een terugknop die je op de werktafel terugzet.

Twee dingen die daarbij aan het licht kwamen en hier horen te staan, want ze
waren allebei al stuk:

1. **`openTab()` vertelde de schil niet dat het scherm wisselde.** `sync()` hing
   aan een waarnemer op `#app`, en `openTab` raakt `#app` niet aan. Gevolg: je
   opende Ter plaatse en de statusbalk bleef die van het beginscherm, zónder weg
   terug. Dat viel niet op zolang het springboard eronder lag.
2. **`shared/levendekleur.js` schildert elke `[data-levendegrond]` met
   `!important`** — en dat is deze schil. Zonder een even hard antwoord lag er
   een ondoorzichtige lap over de werktafel.

Het springboard is als *registry* niet weg: `#osMappen` blijft de plek waar de
bank en Spotlight uit gevuld worden. Dat is een lijst, geen scherm.

## Eén lijst werelden, en waar hij woont

`MAPPEN` in `apps/app-main/app-main-24a2.js` is de **enige** lijst werelden, met
`itemZichtbaar` als de enige vraag wat bij jouw pas hoort. `shared/command.js`
weet daar met opzet niets van: het krijgt de lijst aangereikt via
`RTGCommand.werelden(...)` (`app-main-29c.js`) en houdt er geen kopie van.

Dat is dezelfde afspraak die de wereldstand en het rooster ooit bij elkaar hield,
alleen tussen andere partijen. Wie in `shared/command/` ooit een eigen lijst
werelden ziet ontstaan, heeft de fout te pakken waar LAT.md regel 4 over gaat:
twee lijsten die op verschillende momenten worden bijgewerkt, zíjn twee lijsten.

Nul werelden is een geldige stand en geen storing — een gast, of een pagina
zonder `app-main`. Dan staat er geen kopje en houdt de bank zijn software.

## Dezelfde lucht als de poort

Je logt in onder een sterrenhemel, en die twee lagen zijn niet met de klok
meegegaan:

- **`data-inlogkleur`** — `shared/inlogkleur.js` verft elk vlak dat dit attribuut
  draagt met de levende dagkleur: de boog van de dag, het seizoen, de dag van het
  jaar. Eén kleur, op één plek uitgerekend.
- **`shared/sterren.js`** — hetzelfde firmament, met de echte sterrenbeelden op
  de plek waar ze op dit moment vanaf jouw locatie staan.

**En een les die drie keer dezelfde was.** Zowel de gloed als de sterrenhemel
ging mis op hetzelfde punt: ze maten zichzelf op één moment in plaats van het
scherm te volgen. Een doek van 1 bij 1 dat werd uitgerekt tot een egale lap; en
toen dat verholpen was, een doek dat middenin de openingsanimatie werd opgehangen
en 386 bij 773 mat waar het scherm 393 bij 788 was. Niet kapot — net wazig, en
precies het soort verschil dat niet als fout leest maar als goedkoop.

Wie hier een laag bijzet: meet niet op een moment. Volg het element (een
`ResizeObserver`), en hang niets op zolang de getekende maat en de indelingsmaat
niet gelijk zijn.

## Wat er bewust NIET staat

**Geen statusstrook met "97%", "€ 8,4M", "alles draait perfect".** Zulke cijfers
zouden hier verzonnen zijn, en CANVAS.md is er hard over: een stand die niet
gemeten kan worden, hoort niet getoond te worden.

**Geen voorgekookt werkblad.** Het beginscherm begint leeg. Er stonden hier ooit
twee `open()`-aanroepen; welke apps dat zouden zijn is een keuze van een mens en
niet van het huis.

**Geen foto's.** Getekend in CSS, SVG en canvas — geen stockbeeld, geen modellen
(CLAUDE.md).

## Handhaving

`test/werkscherm.e2e.js` meet de werktafel. `test/appmenu.e2e.js` meet de bank:
dat de drie werelden er bovenaan staan, dat ze hun eigen glyf dragen, dat ze hun
huis als wérkblad openen, en dat het springboard niet terugkomt. `test/apps-ui.e2e.js`
meet dat de sessie echt is hersteld en dat Rahul vanaf het beginscherm in één
stap bereikbaar is — bóven de werktafel en niet erachter. `test/zware-bundels.test.js`
bewaakt dat `shared/glyf.js` vóór `apps/app-main.js` staat — zonder die volgorde
dragen de werelden in de bank geen teken.

Wat hier nog **niet** machinaal gehandhaafd wordt, en dus op mensen berust: dat er
één beginscherm blijft. De drie wegen ernaartoe komen op één toestand uit omdat ze
dezelfde functies aanroepen, niet omdat een toets het meet. Wie een vierde weg
bijbouwt, hoort hem daar te laten uitkomen.
