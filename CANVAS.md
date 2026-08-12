# The Command Canvas — de ontwerpfilosofie van RTG

Vastgelegd 11 augustus 2026, op aanwijzing van Rahul. Dit document gaat vóór
losse schermkeuzes: wie een RTG-scherm bouwt of verbouwt, houdt zich hieraan.
ONTWERP.md beschrijft het merk (kleur, letter, ritme); dit beschrijft de
**opbouw** — wat er eerst komt, en waarom er zo weinig staat.

## De vraag die het ontwerp moet beantwoorden

Niet "hoeveel kan deze software?" maar:

> *"Waarom voelt dit alsof de software al weet wat ik wil doen?"*

De wauw komt **niet** uit meer kleuren, meer knoppen of meer tegels. Hij komt
uit hiërarchie. Elke app opent hetzelfde — niet met functies, maar met
overzicht.

## De volgorde, en die is niet onderhandelbaar

1. **Status en rust** — hoe staat het ervoor, in één seconde
2. **Wat vraagt aandacht** — hooguit drie dingen
3. **De AI die meedenkt** — naast je, niet over je heen
4. **Pas als laatste: alle krachtige functies**

Een scherm dat met zijn functies begint, is fout gebouwd, hoe mooi het ook is.

## Laag 0 — De status

Bovenaan elke app: geen dashboard, maar een **stand**. Eén woord dat een mens
begrijpt, en drie cijfers eronder.

```
WORK            Hospitality        Money            Social
Operationeel    Rustig             Gezond           Levendig
97%             142 gasten         Buffer 8,2 mnd   4 wachten op jou
5 taken         3 reserveringen    Geen actie       12 online
2 wachten       0 klachten                          2 afspraken
0 problemen
```

Het woord is een oordeel, geen getal: *Operationeel*, *Rustig*, *Gezond*,
*Levendig* — en dus ook *Druk*, *Krap*, *Verstoord* als dat waar is. Het liegt
nooit. Een stand die altijd groen is, is een sierstrook.

## Laag 1 — De rust

Negentig procent lucht. Bovenin staat niet meer dan:

```
Goedemorgen Rahul
Uw dag verloopt rustig. Geen kritieke aandachtspunten.
```

of

```
Vandaag vragen 3 zaken uw aandacht.
```

Niet meer. Wie hier iets bij wil zetten, moet eerst iets weghalen.

## Laag 2 — Drie kaarten. Altijd drie. Nooit zes.

```
Vandaag         2 documenten wachten · 1 afspraak over 40 minuten
AI              Ik heb 3 optimalisaties gevonden.
Organisatie     418 medewerkers · alles operationeel
```

Drie is de regel, niet het maximum. Is er een vierde die er echt toe doet, dan
valt er een af — dat is de hele oefening.

## Laag 3 — De Command Timeline

Geen lijst maar een levende tijdlijn, uitklapbaar:

```
09:00 ─ Contract        ✓ afgerond
  ↓
10:45 ─ Presentatie     Rahul heeft de agenda alvast voorbereid.
  ↓
14:00 ─ Vergadering     Nog 3 punten open.
```

## Commands in plaats van menu's

Je opent Work. Midden in beeld:

```
Waar wilt u aan werken?
○ Project   ○ Persoon   ○ Klant   ○ Document   ○ AI
```

Je tikt *Project*. Er komt **geen nieuw scherm** — alles verandert ter plekke
naar een workspace: Samenvatting · Team · Planning · Budget · AI · Bestanden.

## De AI zit ernaast, niet erover

Selecteer je Budget, dan schuift Rahul mee:

```
Budget  165.000
   ↓
Rahul   "Als je leverancier B kiest bespaar je EUR 18.300."
```

Subtiel, niet verstopt. **Geen popups, geen nieuwe pagina's** — alles schuift.
Je weet altijd waar je bent.

## Focus Mode

```
Focus
Vandaag is alleen belangrijk: Project Europa — deadline 14:00
```

De rest verdwijnt niet, maar **vervaagt**. Dat is het verschil: verdwijnen
maakt onrustig (waar is het heen?), vervagen geeft rust.

## De Command Ring

Onderaan. Geen chat, maar werkwoorden:

```
Wat wilt u doen?
Zoek · Maak · Vraag · Automatiseer · Analyseer
```

De AI kent de context. Ben je in Hospitality en zeg je *"maak de reservering
klaar"*, dan is er geen uitleg nodig.

## En de knop die het geheel draagt

```
COMMAND
```

Opent geen menu maar een commandocentrum:

```
Rahul — Ik zie vandaag 7 dingen.
Hiervan hoeft u er maar 2 zelf te doen.
De andere 5 kan ik automatisch uitvoeren.        [Toon]
```

Dat is enterprise: niet veel functies, maar **werk uit handen**.

## Wat er staat, en wat het vasthoudt

Dit document beschrijft een opbouw; hieronder staat welk deel ervan **bestaat**
en wie hem handhaaft. Wat hier niet staat, is nog tekst.

| laag | waar | handhaver |
|---|---|---|
| 0 — de stand | `server/kern/wereldkern.js` (`standVan`), per wereld drie eigen woorden | `test/wereldkern.test.js` 6–9 |
| 0/1 op het scherm | `public/shared/canvas.js` + `canvas.css` | `test/canvas.test.js` |
| de drie kaarten | `RTGCanvas.kaarten` — een vierde **gooit** | `test/canvas.test.js` 1 |
| Focus Mode | `RTGCanvas.focus` + `.cv-vervaagt` | `test/canvas.test.js` 5 |
| Kantoor, Reizen, Sociaal | dragen laag 0, 1 en 3 | `test/canvas.test.js` 8/9, `test/kantoor.e2e.js` |
| laag 3 — de tijdlijn | `RTGCanvas.lijn`, op alle drie de werelden | `test/canvas.test.js` 5b/8, `test/kantoor.e2e.js` |
| de apprij van een wereld | `.wereldapps` — namen op een regel, geen doosjes | `test/canvas.test.js` 5c |
| Command Ring, COMMAND-knop | nog niet gebouwd | — |

**De tijdlijn is de klok, niet de lijst.** Wat er vandaag op een tíjd staat gaat
naar laag 3, op tijd gesorteerd; al het andere blijft in het register eronder,
op signaal gesorteerd. Een taak die vandaag af moet heeft geen uur en hoort dus
niet op een lijn die op tijd loopt — die zou op 09:00 of onderaan belanden, en
allebei is verzonnen. En wat op de tijdlijn staat, staat niet óók in het
register: hetzelfde ding twee keer is precies wat een scherm dat zijn bestaan
aan weglaten ontleent niet kan hebben.

Per wereld valt dat anders uit, en dat is de bedoeling: bij Kantoor zijn het de
afspraken met een tijd, bij Reizen de vluchten en charters (een hotelovernachting
heeft een dag en geen uur), bij Sociaal de bijeenkomsten. Een wereld waar niets
een uur draagt, hoort dus géén tijdlijn te tonen — een lege lijn is een leeg
kader dat om aandacht vraagt zonder iets te zeggen.

**De stand komt uit de wereld, niet uit het scherm.** Wanneer iets
'Operationeel' heet is één regel op één plek (`standVan`); een scherm dat dat
zelf afleidt, maakt er acht (LAT.md regel 4). Elke wereld benoemt zijn eigen
drie woorden — Kantoor is *Operationeel* waar Sociaal *Rustig* is — maar niet
zijn eigen onwetendheid: **'Onbekend' is van de kern**, want wie zijn eigen
onwetendheid mag benoemen, noemt hem vroeg of laat mooier.

En de stand liegt in twee richtingen niet: geen groen woord als een bron zweeg,
en **geen cijfers als er niets gemeten is**. Drie nullen onder een 'Onbekend'
zijn dezelfde leugen, alleen kleiner gedrukt.

## Wat dit betekent voor wie hier bouwt

- **Uniform.** Alle acht werelden dragen dezelfde opbouw. Een eigen variant
  bedenken is de duurste manier om het geheel goedkoop te laten voelen.
- **Eén signatuurelement.** Geen stapeling van trucjes (ONTWERP.md).
- **De stand liegt nooit.** Kan een scherm zijn stand niet meten, dan zegt het
  dat — een verzonnen "Operationeel" is erger dan geen stand.
- **Wie een vierde kaart toevoegt, haalt er een weg.**
- **Geen doosjes om namen.** Navigatie is typografie: een naam op een regel, met
  een lijn die pas bij aanwijzen verschijnt. Een rand die er altijd is, is een
  knop; vijfendertig knoppen op een rij is een werkbalk, en een werkbalk boven
  een scherm van lucht en Bodoni leest als software van vijftien jaar geleden.
  Dit staat ook al in CLAUDE.md par. 3 (geen ronde hoeken of gouden randjes) —
  het stond er alleen niet aan gehouden.

## Het gevoel dat we zoeken

> *"Waarom voelt dit alsof ik in de cockpit van een bedrijf zit, terwijl het
> tegelijk zo rustig en eenvoudig oogt?"*

Niet een verzameling software. Eén intelligent besturingssysteem.
