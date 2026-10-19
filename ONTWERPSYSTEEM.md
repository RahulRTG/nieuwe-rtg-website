# Het RTG Design System: één afdwingbare visuele architectuur

*Eigenaarsbesluit van 19 oktober 2026. Dit document zegt waarom RTG zijn
vormgeving niet nog een keer bijwerkt maar vervangt, hoe het nieuwe systeem in
elkaar zit, en welke machine voorkomt dat het oude probleem terugkomt. Het
volgt `HERITAGE.md` (de ontwerpgrammatica) en vervangt de vele bladen die die
grammatica tot nu toe moesten dragen.*

> **Geen extra visuele laag bovenop de oude structuur. De oude structuur wordt
> gecontroleerd vervangen door één duurzaam systeem.**

## 1. De diagnose (fase 1, gemeten op 19 oktober 2026)

`npm run ontwerpsysteem` telt het opnieuw; dit is de nulmeting.

| Wat | Stand |
|---|---|
| Stijlbladen in `public/` | 179, samen 2,3 MB |
| `!important` in die bladen | 7.503 |
| Hexkleuren in die bladen | 5.639 |
| Schermen met een eigen `<style>`-blok | 290 (453 blokken, 1,6 MB, 214× `!important`) |
| Scripts die zelf stijl in de pagina zetten | 125 (229 plekken) |
| Erfenisbladen per scherm, gemiddeld (statisch afgeleid) | 48,7 |
| Zwaarste scherm | `/apps/app.html`, 62 bladen |
| Kandidaat-wezen (door niets geladen of genoemd) | 11 |
| Verschillende "ivoor/papier"-tinten als eigen token | minstens 10 |

**De oorzaak is geen gebrek aan ontwerp, maar dat er nooit iets wegging.**
Elke ontwerpronde legde een laag bovenop de vorige (`rtg-heritage`,
`rtg-editorial-v4`, `rtg-cinematic-system`, `rtg-edge-2`, `rtg-adaptive-edge`,
`rtg-worlds-2026`, `rtg-world-home`, ...). Omdat de nieuwe laag van de oude
moest winnen, kwam er `!important` bij, en uiteindelijk
`rtg-heritage-order.js`: een MutationObserver die de "nieuwste" laag steeds
achteraan in `<head>` terugzet. Een nieuw ontwerp kwam dus binnen als de
zoveelste laag, en de oude lagen duwden het terug. Daarom werkte bijwerken
niet, en daarom zou nog een ronde bijwerken ook niet werken.

De bestaande ratels (`schermenZonderVormtaal`, `inlineStijlAttributen` in
`NORM.json`) maten de ADOPTIE van een nieuwe laag, en niet of er een oude bij
kwam. De hoekregel in `scripts/check.js` (regel 58) heeft een toelatingslijst
per bestand die met elke laag langer werd. Een meting die het stapelen niet
ziet, houdt het stapelen ook niet tegen.

## 2. De architectuur

```
RTG Core → Design System → Wereldthema → Component → Schermtype → Scherm
            tokens.css      thema/*.css   componenten/  schermen/
```

Alles staat in `public/ds/`, en een scherm laadt precies één blad:
`/ds/rtg-ds.css`. De eerste regel daarvan legt de volgorde van de **CSS-
cascadelagen** vast:

```css
@layer rtg.reset, rtg.tokens, rtg.thema, rtg.component, rtg.scherm;
```

Dat is de structurele vervanging van `rtg-heritage-order.js`. Welke regel wint,
hangt niet meer af van welk `<link>` het laatst in `<head>` staat of van
`!important`, maar van deze ene declaratie. Een schermtype wint van een
component, een component van een thema, en dat geldt altijd en in elke
laadvolgorde.

- **Tokens** (`tokens.css`). Twee niveaus. De primitieven (`--ds-p-*`) zijn de
  merkkleuren uit `AGENTS.md` en de wereldaccenten uit `HERITAGE.md` par. 3.
  Daarboven liggen de semantische tokens (`--ds-grond`, `--ds-accent`,
  `--ds-inkt`, ...), en dat is het enige wat componenten lezen. Dit is het
  ENIGE bestand waarin een kleurwaarde mag staan.
- **Wereldthema's** (`thema/living|travel|work|foundation.css`). Een thema zet
  uitsluitend de tokens die `contract.json` → `themabaar` noemt, op
  `[data-rtg-world="..."]` (het attribuut dat `scripts/heritage-uitrol.js`
  al op elk scherm zet). Een thema kan dus nooit een knop, kaart of marge
  overschrijven. TravelOS volledig veranderen raakt WorkOS niet.
- **Componenten** (`componenten/`): kop, knop, kaart, veld, lijst, chip,
  dialoog en edge. Elke selector begint bij een eigen `.ds-`-klasse. Een
  verbetering aan `.ds-knop` werkt door in elk aangesloten scherm van elke
  wereld.
- **Schermtypen** (`schermen/`): de zeven uit de goedgekeurde mockups,
  namelijk **Cover, Collectie, Taak, Detail, Gesprek, Canvas en Status**. Elk
  scherm van RTG is een van deze zeven of een samenstelling ervan.
- **Talen**: alle 19 uit `public/shared/i18n.js`. Er staat geen enkele
  fysieke richting in het systeem (`margin-left`, `text-align: right`, ...),
  alleen logische eigenschappen. Arabisch werkt dus vanzelf van rechts naar
  links zodra i18n `dir="rtl"` zet, zonder aparte RTL-bladen.

- **Elk scherm meet zichzelf.** `.ds-scherm` is een container
  (`container: ds / inline-size`). Schermtypen reageren dus met
  `@container ds` op hun eigen breedte, en maten en goten rekenen in `cqi`
  in plaats van `vw`. Daardoor klopt een scherm ook in een split-paneel, een
  ingebed kader of het telefoonkader. De schermhoogte is een token
  (`--ds-schermhoogte`), dat het kader verzet.
- **De voorbeeldpagina** (`/ds/voorbeeld.html`) zet alle zeven schermtypen in
  een telefoonkader naast elkaar, gebouwd uit niets anders dan de echte
  componenten. Dit is de plek om het systeem naast de goedgekeurde mockups te
  leggen; `test/ontwerpvoorbeeld.e2e.js` bewaakt hem.

`public/ds/contract.json` is de machineleesbare vorm hiervan: lagen, werelden,
schermtypen, componenten, themabare tokens en talen.

## 3. De handhaving: het staat niet alleen in een document

`npm run ontwerpsysteem:controle` (`scripts/ontwerpsysteem.js --controle`)
draait in `ci.yml` naast de andere poorten en zakt bij elke schending.
`test/ontwerpsysteem.test.js` bewijst per regel dat hij echt dichtgaat (elke
toets zet één verboden ding neer en eist dat het wordt tegengehouden).

| Regel | Handhaving |
|---|---|
| Geen nieuw stijlblad buiten `public/ds/` | ratel: een pad dat niet in `ONTWERPNORM.json` staat, bestaat niet |
| Geen nieuw `<style>`-blok in een scherm | ratel per scherm |
| Geen extra `!important` of hexkleur in de erfenis | ratel per bestand en per veld; alleen krimpen |
| Een erfenisblad groeit niet | ratel op bytes per bestand |
| Geen nieuwe stijlinjectie uit een script | ratel per script (`<style>`, `insertRule`, `adoptedStyleSheets`, `.css`-namen) |
| Alles in `public/ds/` zit in een cascadelaag uit het contract | contractregel 1 |
| Geen `!important` in het systeem | contractregel 2 |
| Kleurwaarden alleen in `tokens.css` | contractregel 3 |
| Alleen logische eigenschappen (RTL) | contractregel 4 |
| Afronding alleen via `--ds-radius-*` | contractregel 5 (en `check.js` regel 58 verwijst ernaar in plaats van een lijst per bestand) |
| Een thema zet alleen themabare tokens | contractregel 6 |
| Een component raakt alleen zijn eigen `.ds-`-klassen en leest geen primitieven | contractregel 7 |
| Een `@import` haalt nooit erfenis binnen | contractregel 1 |
| Een gemigreerd scherm draagt geen eigen `<style>`-blok | contract |

**Per bestand, niet als som.** Een som laat toe dat het ene scherm opruimt en
het andere er evenveel bij zet. Daar waarschuwde de deltapoort al voor.

**Uitzonderingen** gaan in `ONTWERPNORM.json` → `uitzonderingen`, met `pad`,
`reden` en `vervalt`. Een uitzondering zonder een van die drie, of over haar
datum, laat de controle zakken. `--vastleggen` zet de lat strakker zodra er iets
is opgeruimd, en weigert hem ooit losser te zetten of een nieuw pad op te nemen.

**Wat de controle niet ziet**, en dat hoort er even groot bij te staan: of een
scherm overeenkomt met de mockup, en welke stijl een script tijdens het draaien
via `element.style` zet. De laadgraaf is statisch afgeleid. Het eerste vraagt
de visuele vergelijking uit fase 3, het tweede valt onder
`inlineStijlAttributen` in `NORM.json`.

## 4. Eigenaarsbesluiten van 19 oktober 2026

De mockups botsten op drie punten met de huisregels. De eigenaar besliste:

1. **Fotografie met mensen mag**, gecontroleerd: als sfeer en nooit als
   bewijs (`HERITAGE.md` par. 2.3), zonder echte merken, en met dezelfde
   herkomstregels als het overige beeld. De regel "géén mensen" in
   `AGENTS.md` is daarop aangepast.
2. **Afgeronde elementen mogen**, alleen via de tokens: inhoud blijft vrijwel
   recht (`--ds-radius-inhoud`, 2px), systeemlagen zijn herkenbaar rond
   (`--ds-radius-systeem`), en knoppen, chips en invoervelden mogen een
   capsule zijn (`--ds-radius-capsule`).
3. **Wereldspecifieke accentkleuren mogen**, alleen als primitief in
   `tokens.css` en alleen via een wereldthema: diepe wijn (TravelOS),
   zwartgroen (WorkOS) en nachtblauw (FoundationOS), naast bordeaux en goud.
   Dat volgt `HERITAGE.md` par. 3. De logokleuren veranderen niet.

## 5. Wat "gemigreerd" betekent

Een scherm telt als gemigreerd als het `/ds/rtg-ds.css` laadt, **geen enkel
erfenisblad** (alleen `fonts.css` mag ernaast), en geen eigen `<style>`-blok
draagt. `npm run ontwerpsysteem` telt het aantal.

Half migreren bestaat niet, en dat is een eigenschap van CSS en geen keuze.
Een regel buiten een cascadelaag wint van elke laag. Een scherm dat het nieuwe
systeem laadt maar de oude bladen ook houdt, krijgt dus nog steeds de oude
vorm. De migratie haalt per scherm de oude bladen weg en zet niets nieuws
eroverheen.

## 6. De fasen, en waar ze staan

| Fase | Wat | Stand |
|---|---|---|
| 1. Diagnose | inventaris van bladen, blokken, injecties, laadgraaf en wezen | **gedaan**: `npm run ontwerpsysteem`, `--json=pad` voor de volledige graaf |
| 2. Fundament | tokens, lagen, vier thema's, acht componenten, zeven schermtypen, contract, CI-poort | **gedaan**: `public/ds/`, `ONTWERPNORM.json`, `ci.yml` |
| 3. Proefmigratie | TravelOS volledig als referentie, met visuele vergelijking tegen de mockups, mobiel/tablet/desktop, end-to-end, toegankelijkheid en 19 talen | volgende stap |
| 4. Platformmigratie | LivingOS, WorkOS, FoundationOS en de rest, wereld voor wereld, kern eerst (`CONSOLIDATIE.md`: RTG Pass, TravelOS, WorkOS, betalen, Edge) | open |
| 5. Opschoning | bladen die geen scherm meer laadt, `rtg-heritage-order.js`, de toelatingslijst van `check.js` regel 58, de wezen | open; elke verwijdering zet de ratel strakker |
| 6. Bewaking | CI-poort, contract, regels in `AGENTS.md` | **gedaan** voor nieuw werk; groeit mee met elke fase |

Het werk is af als (1) alle schermen gemigreerd of met reden uitgezonderd
zijn, (2) `ONTWERPNORM.json` geen bladen en blokken meer bevat, (3) de
gebruikersstromen hun ketenproeven halen en (4) visuele regressietoetsen
aantonen dat een wijziging aan één wereld de andere niet raakt. Dat ziet er
dan niet alleen mooier uit, maar is ook aantoonbaar schoon.

Dit is geen garantie dat er nooit meer een ontwerpfout ontstaat. Het zorgt er
wel voor dat de oorzaak van deze fout, het stapelen van lagen, niet ongemerkt
kan terugkomen.
