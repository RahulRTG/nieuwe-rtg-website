# TravelOS-migratie: de eerste wereld op het RTG Design System

*Eigenaarsbesluit van 19 oktober 2026: optie 1, de volledige migratie van
TravelOS als referentiewereld. Dit document is het werkdossier. Het zegt wat
TravelOS is (de nulmeting), in welke batches het overgaat, wat per batch
bewezen moet zijn, en wat er nog openstaat. De architectuur zelf staat in
`ONTWERPSYSTEEM.md`; dit document voegt er niets aan toe en kopieert er niets
uit.*

> **De mockups bepalen de visuele ambitie, het Design System de technische
> uitvoering, en de bestaande motor blijft.**

## 0. Eigenaarsbesluit van 19 oktober 2026: optie 4

Alle 30 TravelOS-schermen worden volledig vervangen, in één doorlopend
programma met parallelle werkstromen en één integrator. Er komt geen
tussentijdse beperking tot voorbeeldschermen. Wat het besluit vastlegt:

- `hotels` wordt opnieuw gecontroleerd.
- `residentie`, `boeken` en `stad` gaan mee. Hun functie blijft behouden en
  hun definitieve plaats wordt vastgelegd op basis van de routes; een
  productbesluit dat niet uit de code blijkt, gaat apart naar de eigenaar.
- `reizen` (de Cover) gaat vroeg, met behoud van zijn 25 browsertoetsen.
- De zes aangeleverde mockups zijn het visuele ontwerpcontract.
- Nieuwe fotografie alleen als deel van de migratie, nooit als losse
  demonstratie.
- Er komen geen tijdelijke CSS-lagen, demonstratiefuncties of ongecontroleerde
  uitzonderingen bij.
- Een batch wordt pas geïntegreerd als de verplichte CI groen is.

Het eindrapport noemt drie getallen naast elkaar: gemigreerde schermen,
werkelijk verwijderde oude stijl (bladen, bytes, `!important`), en
aantoonbaar werkende gebruikersstromen (browsertoetsen per scherm).

### Werkstromen

| Stroom | Schermen |
|---|---|
| A. Ingang | `reizen` (Cover) |
| B. Plannen en boeken | `reisbureau`, `vluchten`, `reisboek`, `hotels` (hercontrole) |
| C. Onderweg | `rit`, `ov`, `move`, `reizen-veilig`, `arrival`, `flits`, `navigatie` |
| D. Rechterhand en zakelijk | `hangar`, `zakelijk`, `reisuitnodiging`, `living-world` |
| E. Operatie | `luchthaven`, `marechaussee`, `ovdienst`, `ovroutes`, `dispatch`, `chauffeur`, `ghost`, `ovcontrol`, `voertuig` |
| F. Kantoor | `routedossier`, `routedekking` |
| G. Plaatsbepaling | `residentie`, `boeken`, `stad` |

### Werkwijze per scherm (het recept, bewezen op `hotels`)

1. **HTML.** Het scherm laadt nog maar drie dingen:
   - `/fonts/fonts.css` en `/ds/rtg-ds.css`;
   - in de `<head>` `/shared/id.js`, en waar het scherm hem gebruikt
     `poortgesprek.js`, met `/ds/shell.js` als laatste;
   - onderaan zijn eigen scripts, `/shared/basis.js` (defer) en de
     overgangsscripts die het nodig heeft.

   Verder:
   - Geen enkel oud stijlblad, geen `<style>`-blok, geen `style=`-attribuut.
   - Geen `randen.js`, `metgezel.js`, `ios.js`, `travel-os.js` of
     `rtg-world-desktop.js`.
   - `<body class="ds-scherm" data-rtg-world="travel" data-ds-schermtype="...">`.
   - De kop is `.ds-kop` met `[data-ds-zoek]` (opent de sprong), RTG en het
     account.
2. **Vorm.** Alleen de componenten en schermtypen uit `public/ds/`:
   - Collectie: beeldkaarten met de naam op de foto.
   - Taak: `.ds-veld`-rijen.
   - Detail: groot beeld, status en icoonrijen.
   - Gesprek: berichten, met de Edge in de modus `bericht`.
   - Canvas en Status zoals op `/ds/voorbeeld.html`.

   Mist er een component, dan komt hij als nieuw bestand in
   `public/ds/componenten/` (contract en `rtg-ds.css` bijwerken). Een eigen
   blad per scherm bestaat niet.
3. **Gedrag blijft.** Dezelfde API-aanroepen, dezelfde teksten, dezelfde
   menselijke grenzen ("het huis bevestigt", "aangevraagd" en nooit
   "geboekt"), dezelfde rechten. Simulaties houden hun zichtbare markering
   (par. 1d).
   - Datum en bedrag volgen `document.documentElement.lang`, via `Intl`.
   - De primaire handelingen dragen `data-ds-actie`, zodat de Edge ze toont.
4. **Beeld.** Alleen in-huis beeld met herkomst (`public/campagne/`,
   `public/images/worlds/`). Ontbreekt er passend beeld, dan noemt het
   rapport dat. Er komt geen extern beeld.
5. **Toetsen.**
   - Een browsertoets `test/<scherm>-ds.e2e.js` naar het model van
     `test/hotels-ds.e2e.js`:
     - geen erfenisblad, ook niet in de stijlbundel;
     - de ds-poort klopt;
     - de Edge staat;
     - de kernhandeling slaagt tegen de echte backend;
     - geen overloop op 390, 820 en 1440;
     - `dir="rtl"` in het Arabisch.
   - Registreer de toets in `public/ds/contract.json` → `bewijs` en in de
     toets-naar-bronkaart van `scripts/mutatie.js`.
   - Een bestaande toets die de oude vorm eiste, wordt herschreven naar het
     gedrag dat hij bewaakte en nooit verwijderd.
6. **Opruimen.** Een oud blad dat na de migratie door niets meer wordt
   geladen, gaat weg, en `ONTWERPNORM.json` wordt strakker gezet. Een blad
   dat nog door andere schermen wordt geladen, blijft staan tot het laatste
   scherm over is.

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
| 2 | Schil en Edge: `/ds/shell.js`, `/ds/edge.js` en `/ds/edge-modi.js`. `shared/basis.js` kent `html[data-ds]`: het gedrag blijft, de oude vormlagen (ruim 150 kB Edge-CSS, Heritage, iOS, thema's) laden niet | contracttoetsen; `contract.json` → `dsPoort`, in de browser bewezen door de toets van batch 3 | **gedaan** |
| 3 | Eerste ledenroute: `hotels` (Collectie, Detail, Taak, Status) | `test/hotels-ds.e2e.js` (5 toetsen, gevoelig volgens de mutatiemotor): geen erfenisblad actief, ook niet in de stijlbundel; ds-poort klopt; Edge staat; een aanvraag loopt over de echte verblijfskern en blijft "Aangevraagd"; geen overloop op 390/820/1440 en in het Arabisch (rtl). Oude bladen `rtg-verblijven-2026.css` en `-momenten` verwijderd | **gedaan** |
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
- **Overgangsscripts.** Op een ds-scherm zetten zes gedeelde scripts nog een
  eigen, afgebakend `<style>`: `basis.js` (toegankelijkheidsprofiel,
  hulpkaart, springlink), `i18n.js`, `poortgesprek.js`, `cookie.js`,
  `uitvoer.js` en `sprong.js`. Ze staan in `contract.json` → `overgangsscripts`,
  met een reden en een vervaldatum (31 januari 2027). Een zevende kan er niet
  stil bij komen.
- **Vertaling in de toets.** De toetsserver heeft geen vertaalmodel. In het
  Arabisch is daar alleen te bewijzen dat `dir="rtl"` staat en dat niets
  overloopt. De vertaalde tekst zelf komt uit de bestaande vertaalkast
  (`RTGAutoVertaling`) en wordt hier niet opnieuw bewezen.
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
