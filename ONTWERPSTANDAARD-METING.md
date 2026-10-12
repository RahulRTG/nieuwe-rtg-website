# Ontwerpstandaard — meting website tegenover app

> Gemeten op 11 oktober 2026, op commit `611c894a`, met een verse server
> (`test/helper.js` `startServer`, lege `RTG_DATA_DIR`, `SMTP_URL` leeg) en
> Chromium uit `browserOpties()`. De website zonder sessie, de app met een vers
> geregistreerd RTG Pass-lid (registreren, onboardingstatus, tekenen — de vorm
> van `maakLid` in `scripts/edgedekking.js`). Twee formaten: 390×844 en
> 1440×900. Dit document verandert geen code en geen CSS.

**Besluit van de eigenaar waar dit onder hangt.** De www-website is de visuele
referentie voor de IDENTITEIT: fotografie, typografie, kleur, rust, witruimte,
goud. Zij is géén referentie voor de hoeveelheid inhoud of de bediening. Een
wereldscherm bootst de website niet na en wordt niet voller; aanvullende
bediening en complexiteit horen in de Edge (`EDGE.md`). Er komt geen tweede
designsysteem. Elk voorstel hieronder zegt daarom of het over **identiteit**
gaat (moet gelijk) of over **bediening/indeling** (mag verschillen).

**Graden.** *gemeten* = uit `getComputedStyle`, `getBoundingClientRect` of
`elementsFromPoint` in de browser, of letterlijk uit een bronbestand.
*vermoed* = met het oog op een schermafdruk. Een uitspraak zonder graad staat
er niet.

## 0. Wat er gemeten is, en hoe

| Kant | Scherm | Adres | Wereld (`data-rtg-world`) | Palet |
|---|---|---|---|---|
| website | landing | `/` (= `index.html` in de wortel) | living | `data-public-platform="app"` |
| website | 5 paspagina's | `/site/passen/{rtg-pass,lifestyle-pass,business-pass,business-lite,community}.html` | living/work/foundation | `data-public-platform="detail"` |
| website | 4 wereldpagina's | `/site/werelden/{livingos,travelos,workos,foundationos}.html` | per wereld | `data-public-platform="detail"` |
| app | werktafel | `/apps/app.html?pas=rtg` | living | `data-rtg-palette="living"` |
| app | LivingOS | `/apps/rtg.html` | living | living |
| app | TravelOS | `/apps/reizen.html` | travel | travel |
| app | WorkOS | `/apps/kantoor.html` | work | work |
| app | FoundationOS | `/apps/foundation/os-publiek.html` | foundation | foundation |

Alle 15 schermen draaien `data-rtg-skin="heritage"` en `data-rtg-layout="standard"` (*gemeten*).

Per scherm is geteld over elk zichtbaar element (display ≠ none, visibility ≠
hidden, opacity > 0, rechthoek ≥ 1×1): de eerste font-family van elk element met
eigen tekst, de tekst-, achtergrond- en randkleuren (randen alleen bij breedte >
0), elke border-radius ≠ 0, elke `transition-duration` en `animation-duration` ≠
0, en elke `img`, `video` en `background-image`. Daarnaast voor het eerste
scherm: hoeveel tekstelementen, links/knoppen en verschillende tekstmaten erin
staan, welk deel van het beeld foto is (raster van 24×24 punten, foto als een
`img`/`video`/niet-SVG-`url()` onder het punt ligt), en de grootste knoppen.

**Meetvoorwaarden die de uitslag kleuren.**

- De browser draaide in `en-US`. De landing en grote delen van de app tonen dan
  Engels naast Nederlands ("Good evening.", "Your journey begins here.", naast
  "Dichtbij begint hier.") (*gemeten*: `navigator.language` = `en-US`). Taal is
  hier geen onderwerp; het verklaart alleen de tekst op de afdrukken.
- De werktafel kwam in 45 seconden niet tot netwerkstilte (een open verbinding);
  in de eerste ronde is daarna 2,5 s gewacht, in de tweede ronde is op `load` plus
  5 s gemeten. Beide rondes gaven dezelfde orde van getallen (*gemeten*).
- De volle schermafdruk van de app op 1440 toont een geopend wereldpaneel ("Uw vier
  werelden") dat in de gewone afdruk niet open staat (*vermoed*: het volle
  formaat veroorzaakt een herlay-out). Die afdruk is niet gebruikt als bewijs voor
  indeling.
- Kleuren in `color(srgb …)`-notatie (uit `color-mix`) zijn niet naar hex
  omgezet; ze staan als "afwijkend van de merktokens" in de telling, wat klopt —
  geen van die mengsels is een merktoken.

**Wat niet gemeten kon worden, met de reden.**

- *Witruimte als getal.* Er is geen eerlijke enkelvoudige maat voor; de
  dichtheid van het eerste scherm (tekstelementen, maten, links) staat er als
  plaatsvervanger, de rest is *vermoed* van de afdrukken.
- *Of een overgang ooit afspeelt.* Gemeten is de verklaarde duur op het element,
  niet of er een toestandswissel komt die hem laat lopen.
- *Fotokwaliteit en kadrering.* Alleen herkomst (pad) en oppervlak zijn gemeten;
  "filmisch" is een oordeel en daarom *vermoed*.
- *Reduced Motion, toetsenbord, 320/768/1024/1920 px.* Buiten deze opdracht;
  HERITAGE.md par. 12 vraagt ze voor "gereed", niet voor deze vergelijking.

## 1. Gemeten per scherm

### 1.1 Lettertypen

| Scherm | 390 | 1440 |
|---|---|---|
| landing | Inter 88, Bodoni Moda 4 | Inter, Bodoni Moda |
| paspagina's (5×) | Inter 41–44, Bodoni Moda 15 | idem |
| wereldpagina's (4×) | Inter, Bodoni Moda, **`ui-monospace` 7** (`span.proof-source`) | idem |
| app werktafel | Inter 44, Bodoni Moda 16 | Inter 112, Bodoni Moda 27, **Georgia 1** (`span.rtg-ss-mark`) |
| app LivingOS / TravelOS / WorkOS / FoundationOS | Inter, Bodoni Moda | Inter, Bodoni Moda |

*gemeten.* Beide kanten blijven op Bodoni Moda + Inter. Twee uitzonderingen: de
website toont een bronvermelding in de systeem-monospace (zeven elementen per
wereldpagina), en op de werktafel staat één element waarvan de eerste
font-family Georgia is — `Georgia` is in het hele huis alleen een TERUGVAL achter
Bodoni (`second-screen-personal.css` gebruikt `"Bodoni Moda",Didot,Georgia,serif`),
dus één regel draagt hem als eerste keus (*gemeten*; welke regel precies is niet
nagezocht).

**Typografische hiërarchie in het eerste scherm** (*gemeten*):

| Scherm | Bodoni-elementen in beeld (390) | verschillende Bodoni-maten (390) | idem 1440 |
|---|---:|---:|---:|
| landing | 3 | 3 (32–39 px) | 7 / 6 maten |
| paspagina | 5 | 5 | 8 / 8 maten |
| wereldpagina | 4–5 | 4–5 | 8–12 / 7 maten |
| app werktafel | 11 | 8 (14–38 px) | **18 / 12 maten** |
| app LivingOS | 7 | 6 | 10 / 6 |
| app TravelOS | 9 | 7 | 9 / 5 |
| app WorkOS | 9 | 7 | 10 / 6 |
| app FoundationOS | 6 | 5 | 9 / 6 |

Bodoni is in HERITAGE.md par. 4 "ceremonieel: dominante titels, wereldnamen,
bestemmingen en één betekenisvol getal". Op de werktafel staat hij op 1440 in
twaalf maten tegelijk — kaartkoppen, widgettitels, de profielnaam, het
"Pass"-woord — en dat is geen ceremonie meer maar een tweede werkletter.

### 1.2 Kleur tegenover de merktokens uit CLAUDE.md

De negen merktokens (`#FFFFFF #0C0C0B #7F1634 #9E1C40 #C23A5E #857007 #DEDBD5
#4D4A45 #8A8680`) als noemer. "op token" = exacte waarde, ongeacht alfa.

| Scherm (390) | tekst op token | achtergrond op token | rand op token | grond (`body`) |
|---|---:|---:|---:|---|
| landing | 0 / 92 | 0 / 45 | 0 / 237 | `#100E0C` |
| paspagina RTG Pass | 15 / 59 | 0 / 16 | 0 / 39 | `#100E0C` + Pearl `#EEE9DF`/`#FAF6EE` |
| overige paspagina's | 4–7 / 56–59 | 0 / 16 | 0 / 39 | idem |
| wereldpagina LivingOS | 20 / 600 | 0 / 31 | 0 / 239 | idem |
| overige wereldpagina's | 3 / 226–257 | 0 / 30 | 0 / 143–151 | idem |
| app werktafel | 2 / 60 | 1 / 33 | 4 / 75 | `#100D0A` (living) |
| app LivingOS | 2 / 155 | 1 / 90 | 16 / 325 | `#100D0A` (living) |
| app TravelOS | 1 / 152 | 1 / 66 | 4 / 219 | `#190D12` (travel) |
| app WorkOS | 2 / 140 | 1 / 63 | 4 / 201 | `#101817` (work) |
| app FoundationOS | 2 / 89 | 1 / 49 | 4 / 149 | `#10231E` (foundation) |

*gemeten.* **De merktokens uit CLAUDE.md worden aan geen van beide kanten
gerenderd**, op een handvol na: `#7F1634` als bovenregel op Pearl (website),
`#857007` als vier randen en `#FFFFFF` als losse tekst (app). Wat er wél staat,
komt uit één bestand: `public/shared/rtg-world-palette.css` (*gemeten*, bron).
Daarin staan vijf paletten:

| Palet | grond | inkt | gedempt | lijn | metaal | actie |
|---|---|---|---|---|---|---|
| neutraal (website, `data-public-platform`) | `#100e0c` | `#f5efe5` | `#c3b8a9` | `#4d4133` | `#dfbd88` | `#74263c` |
| living | `#100d0a` | `#f7f0e5` | `#cbbdab` | `#514330` | `#dfbd88` | `#74263c` |
| travel | `#190d12` | `#f8efe7` | `#d1bbbc` | `#5a3a43` | `#dfbd88` | `#74263c` |
| work | `#101817` | `#f3f0e7` | `#bdc4bb` | `#43514a` | `#dfbd88` | `#74263c` |
| foundation | `#10231e` | `#f7f1e5` | `#c0c9b9` | `#4a6557` | `#dfbd88` | `#244e41` |

Twee dingen volgen daaruit (*gemeten*):

1. Het goud dat beide kanten tonen is `#DFBD88` (champagne), niet `--gold:#857007`
   uit CLAUDE.md. Het bordeaux is `#74263C` (`--rtg-world-action`), niet
   `--burgundy:#7F1634`. Het verschil tussen website en app zit dus **niet** in
   het goud of het bordeaux — die delen ze — maar in de **grond**.
2. De website gebruikt het neutrale palet (de "neutrale RTG-hal" uit HERITAGE.md
   par. 3) en zet de wereldkleur alleen als **accent** op Pearl: de bovenregel per
   wereld is `#7F1634` (living), `#941B43` (travel), `#183252` (work),
   `#0B5277` (foundation), en per pas `#6E5530`, `#183252`, `#704B2C`, `#446D5A`.
   De app zet de wereldkleur als **grond van het hele scherm** — en voor
   FoundationOS (`#10231E`, zwartgroen) en WorkOS (`#101817`, grafiet-groen) is
   er daardoor geen zwart meer en ook geen bordeaux in de actie (Foundation:
   `#244e41`).

**Lichte vlakken (Pearl).** Elementen breder dan 60% van het beeld, hoger dan
200 px en met een achtergrond met luminantie > 0,7 (*gemeten*):

| Kant | lichte vlakken |
|---|---|
| paspagina's | `section.story-section` `#EEE9DF` (≈1700 px hoog) + 3× `article.outcome` `#FAF6EE` |
| wereldpagina's | `section.story-try` en `section.story-section` `#EEE9DF` + `article.outcome` `#FAF6EE` |
| landing | geen |
| alle vijf app-schermen | **geen** |

### 1.3 Afronding tegenover de Heritage-regel

HERITAGE.md par. 4 en CLAUDE.md design-principe 3: inhoud 0–4 px, systeemlagen
16–28 px, cirkels mogen.

| Scherm | 16 px op inhoud (voorbeelden) | 24 px | 50% / 999 px |
|---|---|---|---|
| landing | 40–45× `button.pp-context`, `article.wh-photo.pp-feature`, `button.pp-story` | 37–40× `p.pp-technology-signal`, `button.pp-button`, `input` | profielknop, iconen, Edge-balk |
| paspagina's | 8× `section.world-hero`, `a.button-primary`, `a.button-ghost`, `article.outcome` | 5× Edge-items | taalknop, Edge-balk |
| wereldpagina's | 25–26× idem + `aside.app-truth-panel` | 5× Edge | idem |
| app werktafel | 19–54× `header.wd-greeting`, `button.notif-push`, `button.privknop`, `button.rtguitvoer-knop` | 7–10× `button.cmd-intentie`, `span.rtg-module-state` | avatars, Edge |
| app LivingOS | 75–93× `section.wp-scene`, `div.wp-photo`, `article.wd-widget`, `button.wd-primary`, `span.wh-caption` | 6–7× `header.dagkop.wh-photo` | `span.momentring` |
| app TravelOS | 45–65× idem + `p#worldTravelMessage`, `a.wh-service` | 8× `div.kaartraster`, `form.rahulsnel`, `section.strook` | `img` (rond), `span.pionrond` |
| app WorkOS | 42–61× idem + `div#worldWorkState` | 15× `section.doelgroep`, `div#stand.cv-stand.rtg-rail` | |
| app FoundationOS | 36–55× idem + `p.wh-free`, `div.onthaal-kies` | 6× `section.onthaal` | |

*gemeten.* **Nergens op beide kanten komt een afronding tussen 1 en 4 px voor.**
Elk afgerond inhoudsvlak staat op 16 px. Dat is geen afwijking van de app
tegenover de website — de website doet het precies zo — maar van beide tegenover
het document. De oorzaak staat in één regel (*gemeten*, bron):

```css
/* public/shared/rtg-heritage.css, regel 37 */
--rtg-radius-capsule:999px;--rtg-radius-content:16px;--rtg-radius-system:24px;--rtg-radius-editorial:16px;
```

`--rtg-radius-content` is 16 px, terwijl HERITAGE.md "inhoudsvlakken 0–4 px"
zegt. Keuringsregel 58 (`scripts/check.js`) bewaakt dat een afronding via deze
tokens loopt, niet welke WAARDE het token heeft — dus de keuring is groen en de
regel uit het document geldt nergens. Op de app komt er één inhoudsvlak met 0 px
voor: de "Open Vandaag"-knop op LivingOS (*gemeten*: `border-radius: 0px`,
`text-transform: uppercase`, `letter-spacing: 1.82px`).

### 1.4 Overgangsduren tegenover de vier motion-tokens

Tokens (`public/shared/rtg-heritage-motion.css`): 100 / 200 / 340 / 560 ms.

| Scherm (1440) | op token | buiten token (aantal elementen, voorbeeld) |
|---|---|---|
| landing | 0,2 s ×10, 0,34 s ×3 | **0,45 s ×10** `img.pp-widget-photo`; 0,3 s ×5, 0,42 s ×3, 0,24 s ×1 (Edge-balk); 0,28 s ×1 `header.rtg-edge-top` |
| pas- en wereldpagina's | 0,2 s ×24, 0,34 s ×3 | 0,3 s ×5, 0,42 s ×3, 0,24 s ×1 — **alleen de Edge-balk** |
| app werktafel | 0,2 s ×13, 0,34 s ×3 | **0,3 s ×61** (`a.wd-person`, `button.notif-push`), 0,18 s ×27, 0,14 s ×25 (`button.cmd-intentie`), 0,16 s ×12, 0,24 s ×11, 0,15 s ×4, 0,25 s, 0,28 s, **0,8 s** `div#shell` |
| app LivingOS | 0,1 s ×162, 0,2 s ×66 | **0,3 s ×65** (`a.rtg-spring`, `a.wd-person`, `a.wp-action`), 0,28 s ×12 (390: `div.status`, `section#reisdossier.hero`), 0,15 s, 0,24 s, 0,42 s |
| app TravelOS | 0,1 s ×45, 0,2 s ×28 | 0,3 s ×74, 0,18 s ×11 `a.poort`, 0,28 s ×15, 0,15 s ×9 |
| app WorkOS | 0,1 s ×84, 0,2 s ×41 | 0,3 s ×61, 0,28 s ×6 |
| app FoundationOS | 0,1 s ×48, 0,2 s ×29 | 0,3 s ×50, 0,28 s ×18 |

*gemeten.* Geen van beide kanten heeft een `animation-duration` behalve één
animatie van 0,333 s op een icoon in de app en 0,28 s op `section.appblad.actief`
(TravelOS). De website zit, op de gedeelde Edge-balk na, op de tokens. De app
heeft per wereldscherm 50–75 elementen op 0,3 s — tussen functioneel en
structureel in — en de werktafel heeft acht verschillende duren buiten de tokens.
**De Edge-balk (`nav.rtg-adaptive-bar`, `rtg-adaptive-edge.css`) wijkt aan
BEIDE kanten af (0,24 / 0,3 / 0,42 s)**; dat is één bron, geen verschil.

### 1.5 Fotografie

| Scherm | foto in eerste scherm 390 / 1440 | bronnen (*gemeten*) |
|---|---|---|
| landing | **57% / 29%** | `/images/worlds/heritage/{living-sociaal-hero-v1,travel-heritage-v2,work-heritage-v2}.jpg`, `/images/editorial/{foundation-care,discover-*}.webp` |
| paspagina's | 0% / 0% | geen foto; één radiaal verloop |
| wereldpagina's | 0% / 0–8% | `/campagne/{kyoto-suite,kaiseki,jet,bamboe}.jpg`, `/images/worlds/heritage/<wereld>-heritage-v2.jpg`, `/images/editorial/moment-*.webp` — verderop op de pagina |
| app werktafel | **0% / 0%** | 390: geen enkel beeld. 1440: vier kleine (`/images/world-homes/living.webp`, 110×69) en een strook `living-sfeer.jpg` |
| app LivingOS | 46% / 31% | `/images/worlds/heritage/living-heritage-v2.jpg` als achtergrond, `/images/editorial/living-dining.webp` |
| app TravelOS | 55% / 32% | `travel-heritage-v2.jpg` als achtergrond, `/images/editorial/travel-*.webp`, `/campagne/onsen.jpg`, `/images/travelos/*.jpg` |
| app WorkOS | 63% / 31% | `/images/world-homes/work.webp`, `/images/editorial/work-project.webp` |
| app FoundationOS | 46% / 31% | `/images/editorial/foundation-family.webp` |

*gemeten.* Het beeld komt aan beide kanten uit dezelfde eigen mappen
(`public/images/`, `public/campagne/`), geen externe bron. Drie verschillen:

- De **werktafel heeft geen enkele foto**, en dat is een uitgeschreven keuze in
  de bron: `public/shared/rtg-simple.css` regel 207–217 zet voor alle vier
  wereldtegels `--rtg-card-photo:none`, terwijl de tegel zelf een fotolaag
  (`var(--rtg-card-photo)`, `background-size:cover`) en een donker verloop
  eroverheen verwacht (*gemeten*, bron; ingevoerd in `1e882978`, 3 oktober 2026).
  Het resultaat op 390 is vier lege donkere vlakken van 343×176 met één gouden
  stip (*vermoed*, afdruk `app-werktafel-390.png`). De website toont dezelfde
  vier werelden als World Portal mét foto
  (`/images/worlds/heritage/*-heritage-v2.jpg`).
- **WorkOS en FoundationOS gebruiken niet de heritage-foto van hun wereld**:
  `world-homes/work.webp` en `editorial/foundation-family.webp` in plaats van
  `work-heritage-v2.jpg` en `foundation-heritage-v2.jpg`, die de website gebruikt
  (*gemeten*).
- De website-wereldpagina opent **typografisch** (0% foto in het eerste scherm)
  en laat de fotografie verderop vol in beeld komen; de app opent met een foto in
  een afgerond kader (`div.wp-photo`, 16 px) en zet dezelfde heritage-foto ook
  nog achter de kopbalk (*vermoed* van de afdrukken; de achtergrond-`url()` is
  *gemeten*).

### 1.6 Rust: dichtheid van het eerste scherm

| Scherm | tekstelementen 390 / 1440 | links + knoppen 390 / 1440 | verschillende tekstmaten 390 / 1440 |
|---|---:|---:|---:|
| landing | 22 / 46 | 19 / 28 | 9 / 18 |
| paspagina's | 16–19 / 28–31 | 9 / 16 | 12–14 / 19–21 |
| wereldpagina's | 18–22 / 39–54 | 9–10 / 19 | 11–16 / 19–21 |
| app werktafel | **48 / 100** | **25 / 52** | 19 / **33** |
| app LivingOS | 48 / 76 | 23 / 37 | 21 / 19 |
| app TravelOS | 49 / 72 | 24 / 37 | 20 / 18 |
| app WorkOS | 42 / 76 | 18 / 37 | 18 / 19 |
| app FoundationOS | 47 / 69 | 19 / 31 | 19 / 18 |

*gemeten.* Op telefoonformaat staan er in het eerste scherm van elk appscherm
**twee tot drie keer zoveel tekstelementen en links** als op een website-pagina.
Een deel daarvan is Edge (zij staat aan beide kanten in beeld en telt aan beide
kanten mee); het verschil is dus van het scherm zelf.

## 2. Per scherm: wat het oog ziet

Alles in deze paragraaf is *vermoed*, van de afdrukken.

**Website, landing (390).** Eén kader met één foto (tafel bij avondlicht), een
Bodoni-titel over drie regels, één zin, één gouden knop, één tekstlink, daaronder
vier ronde wereldportalen met foto. Alles daarboven is lucht.

**Website, wereldpagina (390, LivingOS).** Een Bodoni-titel, een alinea van vijf
regels, een gouden knop en een zwarte spookknop, dan het vlak "Actueel in
LivingOS". Verderop wisselen zwarte en Pearl-vlakken elkaar af, met
schermvullende foto's (tafel, raam) en grote Bodoni-koppen in donkere inkt op
licht. Het ritme is: titel — lucht — één ding — lucht.

**Website, paspagina (1440).** Linkerkolom met de vier werelden, midden een
typografische held met prijs ("€ 65") als enige grote Bodoni-cijfer, rechts een
inhoudsopgave; daaronder het eerste Pearl-vlak. Geen foto in beeld.

**App, werktafel (390).** "Goedenavond.", een invoerveld, dan vier wereldtegels
die als lege donkere kaarten verschijnen — alleen de naam, een kort onderschrift
en een gouden stip. Dit is het scherm dat het verst van de website af staat.
**(1440)** De middenkolom bevat twee panelen naast elkaar, waarvan het tweede
door de kolomrand wordt afgesneden ("G", "Wat wi", "Typ", "Uw wer" zijn half
zichtbaar); vier wereldknoppen zijn omrande 16 px-capsules met icoon in plaats
van portalen.

**App, LivingOS (390).** Drie tabs ("Vandaag", "Alles", "Mensen") boven een
afgerond fotokader met "Life, together.", een bordeaux knop in kapitalen met
spatiëring ("OPEN VANDAAG →") en een groene status-pil. Daaronder "Momenten van
vandaag" in een eigen kader, en verderop — op de volle afdruk — een lijst van
ruim vijftig wereldonderdelen als capsules (`section#rtgEdgeFunctions.rtg-edge-index`).
Die lijst is Edge-inhoud die in het wereldscherm zelf staat. **(1440)** Drie
kolommen: mensen links, held midden, favoriete apps rechts; de held is mooi,
de rechterkolom is drie omrande widgets met een onderstreepte link.

**App, TravelOS (390).** De meest filmische van de app: foto van wolken bij
zonsondergang als held, Bodoni-titel, een bordeaux knop in volle breedte, vier
ronde fotoportalen. Op 1440 opent hij met een lege band van ongeveer 100 px tussen
"Welcome" en het fotokader.

**App, WorkOS (390).** Foto als held met "Good evening.", daarna "This deserves
your attention." en een omrand vlak met uitleg, daarna weer een foto met
Bodoni-titel. Drie Bodoni-koppen op één telefoonscherm.

**App, FoundationOS (390).** Groene grond. Een groen pilletje "Always 100% free",
een fotoheld, dan een licht (crème) vlak "Kies je stad" — het enige lichte vlak in
de hele app — en groene omrande kaarten met een gouden link.

## 3. De vijf grootste verschillen

### V1 — De grond: neutrale hal met Pearl tegenover een gekleurde wereld zonder licht

- Website: `body` `#100E0C` (neutraal palet) met per pagina 3–4 Pearl-vlakken
  (`#EEE9DF`, `#FAF6EE`) waarop de wereld alleen als accentkleur van een bovenregel
  terugkomt (*gemeten*, 1.2).
- App: de wereldkleur is de grond van het hele scherm — `#10231E`, `#101817`,
  `#190D12`, `#100D0A` — met **nul** lichte vlakken (*gemeten*). Daardoor is er
  op FoundationOS en WorkOS geen zwart en (Foundation) geen bordeaux meer.
- Bron van het verschil: `rtg-world-palette.css`, waar het neutrale palet alleen
  geldt met `data-public-platform` en de vier wereldpaletten alle oppervlakken
  inkleuren ("The world owns the entire UI palette, including Edge") (*gemeten*).
- Botsing die eerst beslist moet worden: HERITAGE.md par. 3 geeft de werelden
  bewust eigen materiaal (FoundationOS "nachtblauw, civiel goud", WorkOS "grafiet,
  zwartgroen, teal"). Het besluit "bordeaux, zwart" van de eigenaar en die tabel
  zeggen niet hetzelfde. Zie voorstel S1.

### V2 — De primaire actie: champagne aan de ene kant, bordeaux aan de andere

- Website: de hoofdknop is een champagneverloop — `linear-gradient(120deg,#e5c99e,#b18b61)`
  (`public/site/storyline.css` regel 48) en `linear-gradient(110deg,#edcf99,#c4a279)`
  (`.pp-button`, `public/site/platform-shell.css` regel 39), donkere inkt
  `#20170F`/`#1C150E`, gewone hoofdletters, 13,76–16 px (*gemeten*).
- App: de hoofdknop is bordeaux — het centrale contract in
  `public/shared/rtg-heritage-materials.css` regel 79–84 (`--rtg-world-action`
  `#74263c` met een verloop) — op LivingOS in kapitalen met 1,82 px spatiëring
  en 0 px afronding (*gemeten*).
- Let op de richting: de app volgt hier het **centrale** contract, en de website
  wijkt ervan af met twee hard getypte verlopen in website-CSS. Wie "website =
  referentie" letterlijk neemt, maakt van een lokale afwijking de standaard.
- Bijvangst (*gemeten*): op de werktafel en de wereldschermen staat een
  Edge-schakelaar ("Hier" / "Heel RTG") met witte tekst `#FFFFFF` op `#DFBD88` —
  een contrast van ongeveer 1,8 : 1. Of dat element op het moment van meten
  zichtbaar was, is *vermoed* (het staat in de volle afdruk van LivingOS in het
  geopende paneel).

### V3 — Rust: twee tot drie keer zoveel in het eerste scherm

- 390: website 16–22 tekstelementen en 9–19 links in het eerste scherm, app 42–49
  en 18–25. 1440: website 28–54 / 16–28, app 69–100 / 31–52 (*gemeten*, 1.6).
- Bodoni in het eerste scherm: website 3–5 elementen in 3–5 maten (390), app 6–11
  in 5–8 maten; werktafel 1440 18 elementen in 12 maten (*gemeten*, 1.1).
- De website zet één ding per scherm neer; de app zet een groet, een held, een
  favorietenkolom, een mensenkolom en een Edge-index naast elkaar (*vermoed*).
  Onder de randvoorwaarde van de eigenaar is de uitweg **niet** dat de
  wereldschermen dunner worden door inhoud te schrappen, maar dat wat bediening
  is naar de Edge gaat (S6).

### V4 — Fotografie: de werktafel heeft geen beeld, en twee werelden een ander beeld

- Werktafel: 0% foto in het eerste scherm op beide formaten; de vier
  wereldtegels krijgen hun foto uitgezet met `--rtg-card-photo:none`
  (`rtg-simple.css` 207–217) (*gemeten*). De website toont dezelfde vier werelden
  met hun heritage-foto.
- WorkOS en FoundationOS openen met `world-homes/work.webp` en
  `editorial/foundation-family.webp`, niet met de `*-heritage-v2.jpg` die de
  website voor die werelden gebruikt (*gemeten*).
- Behandeling: website-foto staat vol in beeld tussen tekstvlakken; app-foto staat
  in een kader met 16 px afronding en wordt daarnaast achter de kopbalk herhaald
  (*vermoed*).

### V5 — Beweging: de website zit op de tokens, de app ernaast

- Website: alles op 0,2 s of 0,34 s behalve de gedeelde Edge-balk en tien
  foto's op de landing (0,45 s) (*gemeten*).
- App: 50–75 elementen per wereldscherm op 0,3 s, plus 0,28 / 0,18 / 0,16 /
  0,15 / 0,14 / 0,25 s, en 0,8 s op `div#shell` van de werktafel (*gemeten*).
  0,3 s valt in HERITAGE.md par. 7 in de band "structureel" (260–420 ms) maar is
  geen token; de elementen die hem dragen (`a.wd-person`, `a.wp-action`,
  `a.rtg-spring`) zijn links, dus volgens de tabel "direct" of "functioneel".

**Wat géén verschil is, maar wel een afwijking aan beide kanten**
(*gemeten*): de lettertypen (beide Bodoni + Inter), het goud (`#DFBD88`) en het
bordeaux van het palet (`#74263C`), de 16 px-afronding van elk inhoudsvlak (een
token dat het document tegenspreekt, 1.3), en de duur van de Edge-balk.

## 4. Welke bestaande bestanden elke kant laadt

*gemeten* uit de `<link rel="stylesheet">`-elementen, met de gebundelde
(`/stijlbundel.css?f=…`) uitgepakt. `rtg-heritage.css` importeert zelf
`rtg-world-palette.css`, `rtg-heritage-motion.css`, `-materials`, `-adapters`,
`-experiences`, `-components`, `rtg-continue-key.css`, `rtg-simple.css` en meer.

| Bestand | website | app |
|---|---|---|
| `shared/rtg-heritage.css` (+ alle imports) | alle 10 | alle 5 |
| `shared/rtg-world-home.css` | alle 10 | alle 5 |
| `shared/rtg-adaptive-edge.css` | alle 10 | alle 5 |
| `shared/rtg-edge-system.css` | landing | alle 5 |
| `site/start/start-base.css` | alle 10 | — |
| `site/storyline.css`, `site/storyline-stage.css` | alle 10 | — |
| `site/platform-shell.css` | alle 10 | — |
| `site/website-truth.css` | alle 10 | — |
| `site/platform-detail.css`, `site/werelden/world.css` | pas + wereld | — |
| `site/start/experience*.css` (6) | landing | — |
| `fonts/fonts.css`, `shared/rtg-ui.css`, `shared/rtg-uniform.css` | — | alle 5 |
| `shared/rtg-worlds-2026.css`, `wereldrooster.css`, `experience-kernel.css`, `rtg-vandaag-luxe.css`, `rtg-world-start.css`, `rtg-world-widgets.css` | — | 4 wereldschermen |
| `shared/rust.css`, `toegang.css`, `gebaar.css`, `rtg-edge-2.css` | — | alle 5 |
| `shared/command.css`, `interface/*.css`, `ios.css`, `apps/access/portal.css` | — | werktafel |

**Componenten uit HERITAGE.md par. 5.** De acht componentrollen staan als klassen
in `rtg-heritage-components.css` (`.rtg-editorial-hero`, `.rtg-world-portal`,
`.rtg-moment-list`, `.rtg-context-strip`, `.rtg-narrative-panel`,
`.rtg-operational-panel`, `.rtg-state`, `.rtg-side-sheet`). Een zoektocht in
`public/` en `index.html` naar de eerste zes vindt **geen enkel scherm dat ze
gebruikt** — niet op de website, niet in de app; `.rtg-side-sheet` komt alleen
voor in `apps/agenda.html` en de service workers, `.rtg-state` alleen in
`rtg-heritage-registry.js` (*gemeten*). Website en app hebben elk hun eigen
held en hun eigen portaal (`section.world-hero`, `.pp-*` tegenover `.wp-scene`,
`.wh-*`, `.cmd-startwereld`). Het gedeelde vocabulaire bestaat dus, en geen van
beide kanten spreekt het.

## 5. Voorstel: één gedeelde ontwerpstandaard

Uitgangspunten, in de woorden van de opdracht en de randvoorwaarde: alleen
bestaande tokens en componenten, geen tweede designsysteem, identiteit gelijk,
bediening en indeling mogen verschillen, en niets maakt een wereldscherm drukker.
Elke regel noemt het bestand dat het al heeft en de schermen die het missen.

| # | Wat | Soort | Bestaat al in | Missen het (gemeten) |
|---|---|---|---|---|
| S1 | **Eén grond: zwart + Pearl, de wereld als accent.** Het neutrale palet (`#100e0c`, inkt `#f5efe5`, metaal `#dfbd88`, actie `#74263c`) wordt de grond van ieder scherm; de wereldkleur blijft de signatuur (bovenregel, `--rtg-world-signature`, actieve rand), niet de vlakvulling. | identiteit — moet gelijk | `rtg-world-palette.css` (neutrale `body[data-rtg-skin="heritage"]`-regel, en de selector `:not([data-public-platform])` die het onderscheid nu maakt) | alle 5 app-schermen; het sterkst FoundationOS en WorkOS |
| S2 | **Pearl als rustvlak.** Een licht vlak voor verhalende of uitleggende inhoud, met donkere Bodoni erop. Niet extra inhoud toevoegen: een bestaand narratief blok (bijvoorbeeld "Momenten van vandaag", "Kies je stad") krijgt dit materiaal. | identiteit — materiaal gelijk; welk blok Pearl wordt is indeling en mag per wereld verschillen | `site/storyline.css` regel 51 en 55 (`#faf6ee`, `#eee9df`); MATERIAAL.md *RTG Pearl*; "de sociale kant staat op Pearl" | alle 5 app-schermen (0 lichte vlakken); FoundationOS heeft er één, in crème `#F4EDDF` buiten het register |
| S3 | **Eén primaire actie, één materiaal.** De hoofdknop volgt het centrale contract `rtg-heritage-materials.css` 79–84 (bordeaux `--rtg-world-action`), gewone hoofdletters, Inter. Champagne `#dfbd88` blijft metaal voor randen, actieve stand en het ene ceremoniële detail. | identiteit — moet gelijk | `rtg-heritage-materials.css`; `--rtg-world-action` in `rtg-world-palette.css` | **website**: `site/storyline.css` 48 en `site/platform-shell.css` 39 typen een eigen champagneverloop; app LivingOS: kapitalen + 1,82 px spatiëring + 0 px. Zie besluit B2 |
| S4 | **Bodoni alleen ceremonieel.** Per scherm één dominante titel, wereldnamen, één betekenisvol getal. Widgettitels, kaartkoppen, profielnaam en tabbladen in Inter. | identiteit — moet gelijk | HERITAGE.md par. 4; MATERIAAL.md *RTG Display*; `rtg-heritage-materials.css` | werktafel (12 Bodoni-maten op 1440), WorkOS en TravelOS (7 maten op 390); `span.rtg-ss-mark` met Georgia als eerste keus |
| S5 | **Fotografie uit één bron per wereld.** Het World Portal en de held van een wereld gebruiken `/images/worlds/heritage/<wereld>-heritage-v2.jpg`, net als de website; de foto staat vol in de held en wordt niet nog eens achter de kopbalk herhaald. | identiteit — moet gelijk; welke editorial-foto verder op het scherm staat is inhoud | `public/images/worlds/heritage/` (+ `HERKOMST.json`); `.rtg-world-portal` en `.rtg-editorial-hero` in `rtg-heritage-components.css`; `.cmd-startwereld` heeft de fotolaag al (`var(--rtg-card-photo)`) | werktafel (`--rtg-card-photo:none` in `rtg-simple.css` 207–217); WorkOS (`world-homes/work.webp`); FoundationOS (`editorial/foundation-family.webp`) |
| S6 | **Wat bediening is, gaat naar de Edge.** De lijst van alle wereldonderdelen (`section#rtgEdgeFunctions.rtg-edge-index`, ruim vijftig capsules op LivingOS 390), de stand-schakelaars ("Overzicht/Compact/Automatisch") en "Hier / Heel RTG" staan in de Edge-lade en niet in de scroll van het wereldscherm. Dat maakt het eerste scherm rustiger zonder één functie weg te halen. | bediening — mag verschillen, maar hoort in de Edge (EDGE.md) | `rtg-adaptive-edge.css`, `rtg-edge-2.css`, de Edge-index in `rtg-edge-system.css`; ADAPTIEF.md: verbergen bestaat niet, verplaatsen wel | LivingOS, TravelOS, WorkOS, FoundationOS (index inline in de pagina) — **vermoed** voor alles behalve LivingOS; zie open punt O3 |
| S7 | **De componentrollen gebruiken in plaats van herbouwen.** Een wereldhome = `.rtg-editorial-hero` + `.rtg-narrative-panel` + Edge; de werktafel = vier `.rtg-world-portal`. Het eigen held- en portaal-DOM van beide kanten (`section.world-hero`, `.pp-*`, `.wp-scene`, `.wh-*`, `.cmd-startwereld`) stapt er stuk voor stuk op over. | identiteit (vorm gelijk); de inhoud van het paneel is indeling | `rtg-heritage-components.css` (de klassen bestaan en worden door niemand gebruikt) | alle 15 schermen, website ook |
| S8 | **Beweging op de vier tokens.** 0,3 s, 0,28 s, 0,18 s, 0,16 s, 0,15 s, 0,14 s, 0,25 s, 0,45 s en 0,8 s worden de dichtstbijzijnde klasse: links en knoppen `--rtg-time-functional` (200 ms), panelen `--rtg-time-structural` (340 ms), een wereldwissel of filmische binnenkomst `--rtg-time-atmospheric` (560 ms). | identiteit — moet gelijk | `rtg-heritage-motion.css` | app: alle 5 (50–75 elementen per scherm op 0,3 s, werktafel `#shell` 0,8 s); beide kanten: Edge-balk (`rtg-adaptive-edge.css`: 0,24 / 0,3 / 0,42 s); landing: `img.pp-widget-photo` 0,45 s |
| S9 | **Afronding: eerst het token, dan de schermen.** Het besluit B1 hieronder bepaalt of `--rtg-radius-content` 16 px blijft of naar 0–4 px gaat. Daarna hoeft geen scherm iets te doen: elk afgerond inhoudsvlak aan beide kanten loopt al via dat token (keuringsregel 58). | identiteit — moet gelijk | `rtg-heritage.css` regel 37; `scripts/check.js` regel 58 | geen scherm — het gat zit tussen token en document |
| S10 | **Contrast op metaal.** Witte tekst op `#DFBD88` (≈ 1,8 : 1) wordt donkere inkt (`#1C150E`/`#20170F`, zoals de website op hetzelfde metaal doet). | identiteit + toegankelijkheid | de website-knoppen (`#1C150E` op champagne); TOEGANKELIJK.md | Edge-schakelaar "Hier / Heel RTG" op werktafel en wereldschermen |

**Wat dit voorstel met opzet NIET doet.** Het neemt van de website geen
indeling over (geen linkerkolom met werelden, geen inhoudsopgave rechts, geen
prijsblok), geen inhoud (geen "Actueel in …"-vlak, geen verhaalsecties) en geen
tweede held. De website verkoopt en vertelt; een wereldscherm opent. Wat gelijk
moet worden is het **materiaal**: grond, licht, goud, letter, beeld, tempo.

### Besluiten die eerst nodig zijn

Met opties, aanbeveling vooraan.

**B1 — Afronding van inhoudsvlakken.**
- (a) *Aanbevolen.* HERITAGE.md en CLAUDE.md volgen: `--rtg-radius-content`
  naar 2–4 px, `--rtg-radius-editorial` idem. Eén regel in `rtg-heritage.css`
  verandert beide kanten tegelijk; kost een visuele herkeuring van alle schermen.
- (b) 16 px houden en HERITAGE.md par. 4 en CLAUDE.md design-principe 3 herschrijven
  naar "inhoud 16 px". Goedkoop, maar het "Modern Heritage-ritme" verliest zijn
  verschil tussen inhoud en systeemlaag (systeem is 24 px, inhoud 16 px: dat
  leest als dezelfde familie).
- (c) Niets doen. Dan blijft keuringsregel 58 groen op een regel die nergens
  geldt.

**B2 — Kleur van de primaire actie.**
- (a) *Aanbevolen.* Bordeaux, het centrale contract. CLAUDE.md noemt bordeaux de
  primaire accentkleur en de eigenaar vraagt "subtiele gouden accenten"; een
  gouden hoofdknop op elk scherm is niet subtiel. Kost: de website verliest haar
  champagneknop (twee regels in `site/`).
- (b) Champagne, zoals de website. Dan moet `rtg-heritage-materials.css` 79–84
  op `--rtg-world-metal` met donkere inkt, en is bordeaux nergens meer de actie.
- (c) Website champagne, app bordeaux (de huidige stand). Dan bestaan er twee
  primaire acties, en dat is wat deze meting een verschil noemt.

**B3 — Wereldkleur als grond of als accent** (botst met HERITAGE.md par. 3).
- (a) *Aanbevolen.* Accent: de grond is overal het neutrale zwart + Pearl, en
  de wereldidentiteit leeft in signatuurkleur, fotografie en bewegingskarakter
  (`rtg-heritage-motion.css` heeft al een eigen ease en richting per wereld).
  HERITAGE.md par. 3 krijgt een kolom "accent" in plaats van "grond".
- (b) Grond, zoals nu: HERITAGE.md blijft, en het besluit "bordeaux, zwart"
  geldt alleen voor LivingOS en de website.
- (c) Grond alleen donker getint (de huidige LivingOS-waarde `#100d0a` is al
  vrijwel zwart): Travel blijft wijn, Work en Foundation gaan naar zwart.

**B4 — Merktokens in CLAUDE.md tegenover wat er wordt gerenderd.** `--gold:#857007`
en `--burgundy:#7F1634` komen aan geen kant voor als goud en actie; het huis
rendert `#DFBD88` en `#74263C`.
- (a) *Aanbevolen.* CLAUDE.md laten verwijzen naar `rtg-world-palette.css` als de
  bron van gerenderde kleur, met de logokleuren als *logo*-ankers (zoals
  MATERIAAL.md "de ankers komen uit het logo" al zegt).
- (b) Het palet terugbrengen naar de CLAUDE.md-waarden. Raakt elk scherm; `#857007`
  op `#100e0c` is als tekst te donker.

## 6. Open punten

- **O1** — De werktafel op 1440 snijdt een tweede paneel af aan de rand van de
  middenkolom (*vermoed*, `app-werktafel-1440.png`). Niet nagezocht of dat een
  lay-outfout is of een paneel dat er hoort te staan.
- **O2** — Wereldpagina's van de website tonen de titel twee keer boven elkaar
  ("Uw dagelijks leven, als één geheel.") (*vermoed*, `web-wereld-livingos-1440.png`).
  Buiten deze opdracht, wel zichtbaar.
- **O3** — Of de inline Edge-index ook op TravelOS, WorkOS en FoundationOS staat,
  is alleen voor LivingOS (390, volle afdruk) gezien. De selector
  `section#rtgEdgeFunctions.rtg-edge-index` komt in de afrondingsmeting van
  LivingOS, FoundationOS en de werktafel voor (*gemeten*), maar of hij daar in de
  scroll van het scherm staat of in een lade, is niet vastgesteld.
- **O4** — De gemeten 0,8 s op `div#shell` (werktafel) kan een binnenkomst zijn die
  maar één keer afspeelt; dat is niet gemeten (zie par. 0).

## 7. Bewijsstukken

De schermafdrukken en de ruwe metingen staan buiten de repository, in de
scratchpad van deze sessie:

- `…/scratchpad/meting/shots/<scherm>-<390|1440>.png` (eerste scherm) en
  `…-vol.png` (hele pagina), voor de 15 schermen hierboven;
- `…/scratchpad/meting/meting.json` (ronde 1: fonts, kleuren, afronding,
  overgangen, beeld, koppen, stylesheets) en `meting2.json` (ronde 2:
  fotodekking, inktdekking, Bodoni in beeld, knoppen, lichte vlakken, afronding en
  overgangen met voorbeeldselectors);
- `…/scratchpad/meting/meet.js` en `meet2.js` — de meetscripts.

Herhalen kan door die scripts opnieuw te draaien tegen een verse server; ze
schrijven niets in de repository.
