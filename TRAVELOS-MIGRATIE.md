# TravelOS-migratie: de eerste wereld op het RTG Design System

*Eigenaarsbesluit van 19 oktober 2026: optie 1, de volledige migratie van
TravelOS als referentiewereld. Dit document is het werkdossier. Het zegt wat
TravelOS is (de nulmeting), in welke batches het overgaat, wat per batch
bewezen moet zijn, en wat er nog openstaat. De architectuur zelf staat in
`ONTWERPSYSTEEM.md`; dit document voegt er niets aan toe en kopieert er niets
uit.*

> **De mockups bepalen de visuele ambitie, het Design System de technische
> uitvoering, en de bestaande motor blijft.**

## 1. Nulmeting (batch 1, 19 oktober 2026)

`rtg-world-identity.js` deelt 30 schermen in bij TravelOS. Geen van die
schermen is een redirect. Elk scherm laadt 45 tot 58 erfenisbladen (statisch
afgeleid met `npm run ontwerpsysteem -- --json=pad`), en samen zijn de schermen
ruim 600 kB HTML. Geen van de 30 gebruikt `data-i18n`; de vertaling loopt
volledig via de automatische DOM-vertaling van `shared/i18n.js`
(`RTGAutoVertaling`, `i18n-00b.js`/`i18n-00c.js`). Dat is goed nieuws: een
scherm dat op het nieuwe systeem staat, blijft vertaald zolang het
`i18n.js` laadt.

### 1a. Ledenschermen (16): deze krijgen de nieuwe vormgeving

| Route | Schermtype(n) | Backend | e2e | Opmerking |
|---|---|---|---|---|
| `reizen` | Cover + Collectie (+ Taak, Gesprek) | `/api/reis/*`, `/api/reis/gezelschap/*`, `/api/mob/*` | 25 | de wereldingang; laatste in de volgorde, omdat hij het meest raakt |
| `reisbureau` | Collectie + Taak + Gesprek | `/api/reisbureau*`, `/api/reis/wijzer` | 5 | |
| `hotels` | Collectie + Detail + Taak | `/api/hotels`, `/api/verblijf*` | 0 | geen browsertoets: die komt mee met de migratie |
| `vluchten` | Collectie + Taak + Detail | `/api/member/vluchten*` | 2 | interne luchthavendata, geen airline-feed |
| `reisboek` | Detail + Collectie | `/api/member/rechterhand/reisboek*`, `/api/reis/*` | 6 | |
| `rit` | Taak + Detail/Status | `/api/mob/*`, `/api/verblijf/mijn` | 3 | tweede ingang van `vervoer.rit` (eigenaar is `ov`) |
| `ov` | Taak + Detail | `/api/ov/*`, `/api/mob/*` | 5 | demo-zaak alleen met `RTG_DEMO` |
| `navigatie` | Canvas | `/api/nav/*` | 7 | zonder OSM-pakket een zichtbaar "Demonstratienet" |
| `move` | Collectie + Status | `/api/move/*` | 2 | |
| `reizen-veilig` | Collectie + Taak + Status | `/api/veiligheid/moment*` | 5 | |
| `arrival` | Taak + Gesprek + Detail | `/api/arrival/*` | 1 | |
| `flits` | Collectie + Taak | `/api/flits/*` | 2 | vooruitblik staat vast op Ibiza |
| `hangar` | Collectie + Taak + Gesprek | `/api/member/rechterhand/hangar*` | 0 | Lifestyle |
| `zakelijk` | Collectie + Taak | `/api/supplier/mob/*` | 1 | Business-manager |
| `reisuitnodiging` | Detail + Taak + Status | `/api/reis/uitnodiging/*` | 0 | publiek via een eenmalige link: zonder ledenschil |
| `living-world` | Collectie + Detail + Taak | `/api/living-world/view`, `/api/experience/*` | 1 | doelgroep ontbreekt in `SCHERMEIGENAAR.json` |

### 1b. Operatie- en kantoorschermen (11): zelfde systeem, werklaag

`luchthaven`, `marechaussee`, `ovdienst`, `ovroutes`, `dispatch`, `chauffeur`,
`ghost`, `ovcontrol`, `voertuig` (zaak of autoriteit) en `routedossier`,
`routedekking` (kantoor). Deze schermen krijgen geen cinematografische Cover.
Ze gaan over op de werklaag van hetzelfde systeem (Collectie, Taak, Detail,
Status), na de ledenschermen.

### 1c. Wereldindeling ter beslissing (3)

`residentie` (een virtueel grandhotel, sociaal), `boeken` (lezen,
`media.boeken`) en `stad` (burgerloket) zijn wel bij TravelOS ingedeeld, maar
het zijn inhoudelijk geen reisfuncties. Ze worden pas gemigreerd als de
eigenaar besluit bij welke wereld ze horen. Tot dat besluit gaan ze niet mee
in de TravelOS-acceptatie.

### 1d. Gesimuleerde gegevens die zichtbaar moeten blijven

- het weerbeeld van `ghost` (expliciet "(demo)")
- de demovloot van `stad`
- de Magnaat-proef van `chauffeur`
- de demo-zaak op de OV-schermen (alleen met `RTG_DEMO`)
- het demonstratienet van `navigatie`

De migratie mag die markeringen niet wegpoetsen. Een premium scherm dat een
simulatie als echt toont, is erger dan een lelijk scherm dat de waarheid zegt.

## 2. De batches

| # | Batch | Bewijs | Stand |
|---|---|---|---|
| 1 | Nulmeting | dit document, par. 1 | **gedaan** |
| 2 | Schil en Edge: `/ds/shell.js`, `/ds/edge.js` en `/ds/edge-modi.js` vervangen op een gemigreerd scherm `shared/basis.js`, en daarmee ruim 150 kB Edge-CSS | contracttoetsen, en een browsertoets die bewijst dat er geen erfenisblad laadt | **gebouwd**; de browsertoets komt mee met batch 3 |
| 3 | Eerste ledenroute volledig over, met alle bewijzen uit par. 3 | | open |
| 4 | De overige ledenroutes uit 1a, `reizen` als laatste | | open |
| 5 | De operatie- en kantoorroutes uit 1b | | open |
| 6 | Oude TravelOS-bladen ontkoppelen en verwijderen; `ONTWERPNORM.json` strakker zetten | | open |
| 7 | TravelOS als referentiewereld vastleggen, met een herhaalbare migratiemethode voor de andere werelden | | open |

## 3. Wat per route bewezen moet zijn

Een route telt pas als gemigreerd als alle punten hieronder aantoonbaar zijn.
"Er mooier uitzien" is geen van die punten.

1. `npm run ontwerpsysteem` telt de route als gemigreerd. De route laadt dan
   `/ds/rtg-ds.css`, geen enkel erfenisblad en geen eigen `<style>`-blok.
2. Een browsertoets laadt de route en eist:
   - dat er geen stijlblad buiten `/ds/` en `/fonts/` actief is;
   - dat de Edge staat;
   - dat de kernhandeling van de route tegen de echte backend slaagt.
3. Schermafbeeldingen op 390, 820 en 1440 px, naast de mockups gelegd.
4. Dezelfde route met `rtg_lang=ar`: `dir="rtl"` staat, en niets loopt over of
   staat gespiegeld fout.
5. De bestaande toetsen van de route zijn groen. Een toets die de OUDE vorm
   eiste, wordt herschreven naar het gedrag dat hij bewaakte, en nooit
   verwijderd.
6. De a11y-scan (`A11Y-INGELOGD.json`) gaat niet achteruit.

## 4. Open punten (eerlijk opgeschreven)

- **Edge-modi zonder aansluiting.** De mockup toont acht Edge-vormen. Vier
  daarvan staan: navigatie, Rahul, objectacties en bericht. Inkomende en
  actieve oproep, de appcarrousel en e-mail opstellen komen pas als ze aan de
  bestaande gesprek- en postlaag zijn gekoppeld. Tot dan bestaan ze niet: een
  knop die niets doet, zetten we niet neer.
- **De taalkiezer van `i18n.js`** zet nog een eigen `<style>` neer. Dat blok
  is beperkt tot `.rtg-lang-*`, plus één regel voor verminderde beweging. Het
  hoort in batch 6 naar een `.ds-`-component te gaan.
- **Lettertypen en schriften.** Bodoni Moda en Inter zijn zelf gehost en
  dekken het Latijnse en het Cyrillische schrift. Voor Arabisch, Chinees,
  Japans en Hindi valt de browser terug op een systeemletter. Dat is leesbaar,
  maar niet de huisletter. Een extra lettertype vraagt een besluit
  (`AGENTS.md`: geen fonts toevoegen zonder overleg).
- **Kleurvoorstel van de eigenaar.** Ivoor `#F7F3EC`, espresso `#231C1A`,
  bordeaux `#570F1D`, goud `#B39465` en petrol `#0D3B43`. Deze waarden gaan als
  TravelOS-primitieven in `tokens.css`. Voor tekst kunnen ze pas worden
  vastgezet als het contrast is gemeten (WCAG 2.2 AA), en na de keuring van
  `check.js` regel 23 dat geen ervan een haar naast een logokleur ligt.
