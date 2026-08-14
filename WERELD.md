# De levende wereld — het beginscherm als ruimte

Vastgelegd 11 augustus 2026, op aanwijzing van Rahul. Dit document beschrijft
het **beginscherm**; CANVAS.md beschrijft de opbouw van elk ánder scherm
(status, rust, drie kaarten, dan pas functies) en blijft daar leidend.
ONTWERP.md en MATERIAAL.md gaan over de vormtaal. Wie hier bouwt, leest die
drie er dus naast.

## De vraag

Niet "hoe tonen we drie hoofdwerelden?" maar:

> *"Waarom voelt dit alsof ik ergens BEN, in plaats van dat ik ergens naar
> kijk?"*

Een rooster met icoontjes werkt, en het is volstrekt inwisselbaar. Elk toestel
ter wereld opent zo. Het rooster zegt dus niets over wie dit huis is — het is
de meest neutrale vorm die er bestaat.

Wat wél eigen is, stond er al: **de klok.**

## Het besluit

De klok is geen widget meer. Hij is de **kern**.

- De drie hoofdwerelden hangen als merken op een **bezel** om hem heen.
- Je **draait** eraan om te reizen, zoals aan een horloge.
- Het merkteken op twaalf uur staat **stil**; de ring draait eronderdoor. Zo
  lees je je positie af aan een vast punt.
- Je **zoomt in** op een wereld zonder de cirkel te verlaten: dezelfde ring,
  maar nu met de onderdelen van díe wereld erop.

Tijd is daarvoor het juiste anker, en niet zomaar een mooi beeld: werk, reizen,
geld, sociaal, media en agenda draaien allemaal om momenten. De klok is het
enige element dat al die werelden werkelijk verbindt.

## Wat er NIET gebeurde, en waarom dat de kern is

**Er zijn geen twee beginschermen.** De wereldstand en het rooster delen:

- dezelfde lijst werelden (`MAPPEN`, `app-main-24a2.js`);
- dezelfde klok (`shared/klok.js`, één element dat verhuist);
- dezelfde balk van Rahul en dezelfde draad;
- dezelfde manier om een app te openen (`openItem`).

Omschakelen verplaatst de klok en zet één attribuut. Meer niet. Wie hier ooit
een tweede opbouw naast zet, krijgt twee schermen die langzaam uit elkaar lopen
— precies wat LAT.md regel 4 verbiedt. De ring hangt daarom ook aan dezelfde
`bouw()` als de tegels: twee lijsten die op verschillende momenten worden
bijgewerkt, zíjn twee lijsten.

## De bediening, en de regel eronder

| gebaar | wat er gebeurt | toets |
|---|---|---|
| slepen over de ring | reizen tussen werelden | ← / → |
| tik op een merk | ernaartoe reizen | Tab |
| tik op het merk dat er al staat | die wereld openen | Enter |
| tik op de klok | inzoomen: de onderdelen van deze wereld | Enter op de kern |
| tik op de klok (ingezoomd) | weer uitzoomen | Escape |
| lang drukken op de klok | het Command Wheel | `w` |

**Elk gebaar heeft een toets-equivalent.** Dit is de voordeur van het platform;
een voordeur die alleen met een vinger opengaat, is voor een deel van de leden
geen voordeur. Dat is geen extraatje maar een voorwaarde.

Twee kleine regels die uit echte fouten komen:
- **Een sleep eindigt niet in een tik.** Laat je los met je vinger op een merk,
  dan stuurt de browser daar een `click` achteraan — en sta je in een app die je
  nooit koos.
- **Lang drukken werkt alleen op de klok, niet op de ring.** Een merk vasthouden
  voelt als "deze wil ik"; een menu dat dán opengaat, is een verrassing.

## Het Command Wheel

Geen menu maar vijf **werkwoorden**: Regel · Zoek · Analyseer · Maak ·
Automatiseer. Het verschil is niet cosmetisch. Een menu vraagt je eerst te
bedenken in welke app iets hoort; een werkwoord vraagt alleen wat je wilt. De
wereld waar je staat is de context, dus "Regel" op Reizen betekent iets anders
dan "Regel" op Geld — en dat hoef je nergens in te vullen.

Ze doen ook echt iets: de keuze gaat naar de balk van Rahul, met die wereld
erbij. **Een wiel dat mooi opengaat en verder niets doet, is een animatie en
geen bediening.**

## Dezelfde lucht als de poort

Je logt in onder een sterrenhemel. Je hoort binnen te komen onder **dezelfde**
sterrenhemel — niet in een andere ruimte die toevallig ook donker is. Het
beginscherm draagt daarom letterlijk dezelfde twee lagen als de inlogpoort:

- **`data-inlogkleur`** — `shared/inlogkleur.js` verft elk vlak dat dit attribuut
  draagt met de levende dagkleur: de boog van de dag, het seizoen, de dag van
  het jaar. Eén kleur, op één plek uitgerekend, op beide schermen.
- **`shared/sterren.js`** — hetzelfde firmament, met de echte sterrenbeelden op
  de plek waar ze op dit moment vanaf jouw locatie staan.

**De sterrenhemel hoort bij het beginscherm, niet bij de wereldstand.** Hij
blijft dus ook staan als je terugschakelt naar het rooster met tegels: je logt in
onder een hemel, dus je hoort er ook onder thuis te komen — of je nu naar een
kring of naar een rooster kijkt. Wat in de rasterstand wél weggaat is de dagkleur
(daar hoort de wallpaper die het lid zelf koos, `os-wall-*`, te winnen) en de
gloed van de wereld, want die hoort bij een wereld die je daar niet ziet.

### En de hemel beweegt in zijn geheel

De hemel bestond uit twee lagen: een **stofveld** van duizenden minuscule punten
en daarboven zo'n dertienhonderd heldere sterren die langzaam ronddraaiden. Dat
stofveld werd één keer in een apart doek gebakken en daarna elk beeld ongewijzigd
overgezet. Het overgrote deel van wat je zag stond dus muurvast, en juist die
paar felle punten bewogen — precies andersom dan het lijkt. Op een stilstaande
afdruk zie je dat niet; op een scherm waar je een minuut naar kijkt leest het als
behang met een paar bewegende stipjes erover.

Nu heeft **elk** stofje een eigen diepte, en die bepaalt hoe snel het schuift:
echte parallax, dus de hemel krijgt laagjes in plaats van een vlak. De plek volgt
uit de tijd (`x0 + t × snelheid × diepte`) en niet uit optellen per beeld, zodat
een hapering of een pauze niets uit de pas laat lopen. Daarbovenop ademt elke
kleur/helderheid-groep met een eigen fase, zodat het veld in lagen op- en
afzwelt.

Twee dingen die daarbij niet onderhandelbaar zijn:

- **Groeperen, niet per punt.** Vierduizend keer per beeld `fillStyle` zetten is
  duurder dan vierduizend keer tekenen. De punten liggen bij het zaaien vast in
  drie kleuren × acht helderheidstrappen, dus een beeld kost 24 wissels in plaats
  van 4000. Gemeten: 16,6 ms per beeld — gewoon 60 beelden per seconde.
- **Meten, niet vinden.** `test/wereld.e2e.js` leest de hemel op twee momenten en
  telt hoeveel opgelichte punten er zes seconden later nog op exact dezelfde plek
  oplichten. Bewegend veld: 9,5% (alleen toevallige overlap). Gebakken veld: 58%.
  Een toets die alleen kijkt of er een canvas staat, ziet dat verschil niet — dat
  canvas stond er in beide gevallen.

## Elke wereld is een licht, geen tekening

Hierboven op ligt een canvas met de sfeer van de wereld waar je staat. Dat waren
eerst domeinspecifieke **lijntekeningen**: golfjes voor Reizen, een skyline van rechthoekjes
voor Kantoor, een raster bolletjes voor Veilig. Naast een poort met een diepe
sterrenhemel zag dat eruit als wat het was — draadwerk op een vlakke ondergrond.
Een luxemerk tekent geen diagram op de achtergrond.

Wat er nu staat is **licht**: twee tot vier grote, zachte gloeden die heel
langzaam over de grond drijven, opgeteld met `lighter` zodat ze elkaar
versterken in plaats van elkaar te overschilderen. Per wereld verschillen hun
plek, hun tint en hun ritme — Reizen ademt breed en traag als een horizon, Geld
staat strak en rechtop, Media flakkert als een stad. Je ziet geen vorm die je
kunt benoemen; je merkt dat het ergens anders naar rúikt. Dat is het verschil
tussen sfeer en illustratie. Meer dan vier gloeden is geen sfeer meer maar een
lavalamp.

Drie regels die niet onderhandelbaar zijn:

1. **Het draagt geen betekenis.** Alles wat je moet weten staat in tekst. Deze
   laag is sfeer, en dus voor een schermlezer niet aanwezig.
2. **Het luistert naar de schuif Beweging** (`window.RTGBeweging`) en naar
   `prefers-reduced-motion`. Op stil staat de wereld stil — volledig bedienbaar,
   alleen zonder beweging.
3. **Het staat stil zodra het tabblad weg is.** Een achtergrond die op een
   onzichtbare pagina batterij verstookt, is geen sfeer maar een lek.

### En een les die drie keer dezelfde was

Zowel de gloed als de sterrenhemel ging mis op **hetzelfde punt**: ze maten
zichzelf op één moment in plaats van het scherm te volgen.

- De gloed werd gemeten voordat de indeling had gedraaid → een canvas van 1 bij
  1, uitgerekt tot niets.
- De sterrenhemel werd opgehangen terwijl de poort er nog overheen lag → weer
  1 bij 1, en `shared/sterren.js` rekt dat uit tot een **egale crèmekleurige lap
  over het hele beginscherm**.
- En toen dát verholpen was, werd hij opgehangen midden in de openingsanimatie,
  die het scherm van 0,98 naar 1 schaalt. `getBoundingClientRect()` geeft dan de
  geschaalde maat: een doek van 386 bij 773 dat wordt uitgerekt naar 393 bij
  788. Niet kapot — net wazig. Precies het soort verschil dat niet als fout
  leest maar als goedkoop.

Wie hier een laag bijzet: meet niet op een moment. Volg het element (een
`ResizeObserver`), en hang niets op zolang de getekende maat en de indelingsmaat
niet gelijk zijn. `test/wereld.e2e.js` meet van beide lagen of de tekenmaat
gelijk is aan de schermmaat maal de pixeldichtheid — een toets die alleen naar
"er staat een canvas" kijkt, laat alle drie de standen door.

## Rahul: nergens, en overal

Hij is er niet, tot hij iets heeft. Dan komt er een gouden ring op met **één
zin**. Geen vaste balk die elke ochtend "Goedemorgen" zegt — die leest na drie
dagen als behang. Geen popup, geen badge die knippert.

Die zin komt **niet** uit deze laag. Hij komt uit de draad die Rahul al vult
(`/fluister/profiel`, `/voorspel`, `/spar/lijst`). Er wordt hier niets bedacht
om het scherm te vullen. Staat het gesprek al open, dan komt de ring niet op:
twee keer hetzelfde is geen nadruk maar ruis.

## Wat er bewust NIET staat

**Geen statusstrook met "97%", "€ 8,4M", "alles draait perfect".** Zulke cijfers
zouden hier verzonnen zijn, en CANVAS.md is er hard over: een stand die niet
gemeten kan worden, hoort niet getoond te worden. Wat er wél staat onder de
naam van een wereld is geteld — hoeveel onderdelen die wereld voor jóuw pas
draagt. Komt er ooit een echte, meetbare stand per wereld, dan hoort hij hier
thuis. Tot die tijd niet.

**Geen foto's.** De werelden zijn getekend in CSS, SVG en canvas. Geen
stockbeeld, geen modellen (CLAUDE.md).

## De schakelaar

Het bedieningspaneel draagt **Beginscherm: Wereld / Rooster**. De wereld is de
standaard; de schakelaar bestaat om terug te kunnen, niet om het aan te moeten
zetten. Wie terugschakelt, houdt die keuze.

## Handhaving

`test/wereld.e2e.js` meet wat machinaal te meten is, en bij elke meting staat
welke mutatie hem hoort te laten zakken (LAT.md regel 9). Onder andere: dat de
wereld de standaard ís, dat de merken op één cirkel liggen, dat inzoomen de
onderdelen van díe wereld toont, dat de grond werkelijk pixels tekent op de
juiste maat, dat Rahul niet dubbel staat, en dat draaien geen app opent.

De rasterstand wordt elders gemeten (`appmenu.e2e.js`, `apps-ui.e2e.js`); die
toetsen zetten `rtg_os_wereld` op `uit`. Twee vormen, twee metingen — en één
lijst werelden eronder.
