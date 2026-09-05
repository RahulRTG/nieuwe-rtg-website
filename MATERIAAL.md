# RTG Materialen & Licht

> **Wij hoeven niet te bewijzen dat we luxe zijn.**

`ONTWERP.md` zegt hoe dicht en hoe hard een scherm werkt. Dit bestand zegt
waarvan het gemaakt is. Het verschil is niet cosmetisch: een luxemerk denkt niet
in kleuren maar in **materialen en licht**. `#C9A24B` is een hexcode; geborsteld
champagnegoud is een materiaal, en dat is wat je moet kunnen zien.

De referentie is Porsche, Dior, B&O, Leica, Aesop, Rimowa. Niet Ferrari
(schreeuwerig), niet Gucci (druk), niet Versace (ornament). Stil, duur en
zelfverzekerd.

---

## De ankers komen uit het logo

Goud is **`#857007`** en bordeaux is **`#7F1634`** — precies zoals ze in
`CLAUDE.md` staan en precies zoals ze in het beeldmerk zitten.

Een eerdere versie van dit bestand had ze **verzonnen** uit de beschrijving: een
champagne `#B99A55` en een wijn `#3D0F1E` die nergens op sloegen behalve op mijn
eigen idee ervan. Dat is precies de fout die `CLAUDE.md` verbiedt — de kleuren
komen exact uit het logo en veranderen niet zonder opdracht.

Wat de materialenleer wél toevoegt is **het licht**. De logotoon is de kleur van
het materiaal in rust; de glans zet daar een lichtere en een donkerdere toon
omheen. Champagne is dus geen andere kleur maar hetzelfde goud waar licht op
valt, en fluweel is hetzelfde bordeaux in de schaduw.

Twee metingen die dat bevestigen, en die de beschrijving en het merk laten
samenvallen:

| | helderheid | |
|---|---|---|
| logo-bordeaux `#7F1634` | **56,8** | al donker genoeg voor fluweel — donkerder dan het "vrij rode" dat het leek |
| logo-goud `#857007` | **106** | diep olijfgoud |
| internet-goud `#FFD700` | 202 | glitter |

*Handhaving:* `test/materiaal.test.js` eist die twee tonen letterlijk. Zonder die
ankertoets drijft een materiaal langzaam weg van het beeldmerk zonder dat iemand
het merkt — wat dus ook precies gebeurd was.

---

## De vijf materialen

Elk materiaal wordt beschreven als **materiaal · licht · gevoel**, en pas daarna
als tokens. Wie een nieuw vlak maakt, kiest dus een materiaal en geen kleur.

### RTG Pearl — *levend wit*

| | |
|---|---|
| Materiaal | gepolijst keramiek, geslepen parelmoer |
| Licht | zachte zijdeglans; nauwelijks reflectie, nooit fel |
| Gevoel | vriendelijk, premium, rust |

**Dit is geen wit.** Italiaans marmer, een hotelhal in Monaco, de binnenkant van
een Oyster-kast. Warm wit met een lichte crème erin. Als er licht op valt zie je
warme tonen — **nooit blauw, nooit klinisch.**

*Handhaving:* `test/materiaal.test.js` leest de kanalen uit en zakt zodra een
Pearl-toon meer blauw dan rood heeft. Een koel wit is hier geen smaakverschil
maar het verkeerde materiaal.

### RTG Gold — *geborsteld massief goud*

| | |
|---|---|
| Materiaal | 18 karaat geborsteld champagnegoud |
| Licht | warme reflectie, mat; geen spiegel, geen glitter |
| Gevoel | autoriteit, kwaliteit, belangrijk |

Geen geel, geen oranje, geen internet-goud. Het moet lijken alsof iemand een
massief gouden knop heeft gefreesd: diep en mat, met een subtiele glans langs de
rand.

*Handhaving:* de toets zakt op een goudtoon die te verzadigd of te geel is
(zoals `#FFD700`), en op een verloop met meer dan één lichtpunt — geborsteld
metaal heeft één richting, glitter heeft er tien.

### RTG Onyx — *pianolak*

| | |
|---|---|
| Materiaal | pianolak, zoals een Steinway of een Rolls-Royce-dashboard |
| Licht | overdag bijna zwart, 's avonds diepe reflectie |
| Gevoel | boardroom, avond, directie |

**Niet egaal.** Egaal zwart is verf; pianolak heeft altijd een klein beetje
leven — een nauwelijks zichtbaar verloop, en een rand die licht vangt.

### RTG Bordeaux — *fluweel*

| | |
|---|---|
| Materiaal | fluweel; Bordeaux Grand Cru, een Hermès-doos, theater |
| Licht | **absorbeert** licht in plaats van het terug te kaatsen |
| Gevoel | exclusief, klassiek, Europees |

Het huidige bordeaux is te rood. Dit moet bijna zwart lijken tot het licht erop
valt; dán zie je rood. Een fluwelen vlak dat oplicht is geen fluweel meer.

### RTG Royal — *satijn*

| | |
|---|---|
| Materiaal | satijn; Koninklijke Marine, Savile Row, Royal Delft |
| Licht | koele glans — het enige materiaal dat koel mag zijn |
| Gevoel | institutioneel, enterprise, vertrouwen |

Geen Microsoft-blauw, geen Facebook. Koningsblauw: het moet als **instituut**
voelen.

---

## De vier vaste wereldcomposities

*Vastgelegd op 4 september 2026. De exacte schermtokens staan in
`ONTWERP.md` paragraaf 4a.*

Een materiaal is niet automatisch een wereldkleur. Iedere wereld kiest een
vaste compositie van grond, licht en één signatuur:

| Wereld | Compositie | Waarom |
|---|---|---|
| LivingOS | Pearl met zacht goud | persoonlijk, warm en rustig; het enige structureel lichte huis |
| TravelOS | Bordeaux in diepe schaduw met champagne | beweging, avond en bestemming zonder een rode paginavulling |
| WorkOS | grafiet met gedempt teal en messing | concentratie en precisie; teal is oriëntatie, geen successtatus |
| FoundationOS | diep institutioneel navy met mat goud | vertrouwen en publieke verantwoordelijkheid zonder corporate blauw |

De signatuur verschijnt als een dunne bovenlijn, geselecteerde toestand,
focusrand of klein metaalaccent. Zij wordt niet als groot gevuld vlak gebruikt.
Dat geldt in het bijzonder voor bordeaux: een scherm kan onmiskenbaar TravelOS
zijn zonder een massieve rode knop.

Fotografie wordt per wereld getemperd door een kleurwas van de eigen grond. Zij
mag sfeer en context geven, maar geen operationele waarheid suggereren. Een
foto van Ibiza is geen bewijs dat een reis naar Ibiza is geboekt; die naam mag
pas uit de reisbron komen.

De composities gelden voor pagina's die de nieuwe wereldschil expliciet
activeren. De oudere materiaaltoewijzing blijft tijdelijk actief op niet
gemigreerde schermen. Daardoor kan ieder scherm afzonderlijk worden getoetst en
teruggedraaid.

### De rand erft de wereld

RTG Edge 2.0 gebruikt niet één zwarte systeembalk met vier accentkleuren. Het
hele materiaal van de bestaande rand wisselt mee: grond, paneel, inkt, gedempte
inkt, lijn, signatuur, zachte signatuur en metaal. Daardoor is de wereld ook
zonder titel herkenbaar:

- LivingOS is structureel licht: parel en ivoor, donkere inkt, zacht goud;
- TravelOS is diepe wijn met champagne;
- WorkOS is grafiet met gedempt teal en messing;
- FoundationOS is diep navy met mat goud.

De contextlade is een verhoogd vlak van diezelfde wereld en nooit een vijfde
materiaal. Compact en Focus veranderen alleen de zichtbaarheid en de ruimte van
de rand, niet de kleuren van het scherm. Een ingebed scherm erft de rand van de
ouder en schildert daarom geen eigen tweede navigatiemateriaal.

---

## Het materiaal is licht, geen verf

Gevonden op 31 augustus 2026 door naar het scherm te kijken in plaats van naar
de code. `rtg-worlds-2026.css` zette het materiaal van een wereld als
**paginagrond**: `body[data-rtg-world="living"]{ background:var(--bordeaux-diep) }`
en WorkOS de royal-glans. Over de volle hoogte van een scherm gaf dat een waas
waarin kaarten, randen en tekst allemaal even hard riepen — en `--bordeaux-glans`
begint op `#9E1C40`, dat is `--burgundy-bright`, in `CLAUDE.md` genoteerd als
**hover-state**.

Dat botst met drie merkregels tegelijk: bordeaux is een accent, er komt geen
gradient-grond, en het ritme is stark zwart/wit.

**De regel luidt daarom: de grond is zwart, en het materiaal is het licht dat
erop valt.** Eén radiale gloed uit een hoek, en verder niets — precies één
signatuurelement. De schermen deden dat al goed en werden overschilderd;
`/apps/rtg.html` droeg
`radial-gradient(circle at 38% 4%, rgba(127,22,52,.25), transparent 42%)` over
`#030303`. Die behandeling staat nu in de wereldlaag, zodat elke wereld hem
krijgt in plaats van hem te moeten overschrijven.

Champagne is de uitzondering en blijft dat: een donkere grond met een lichte
gloed erover is bij het enige lichte materiaal precies verkeerd om.

Wie hier een materiaal weer als vlakvulling wil gebruiken, verandert een
merkregel en geen instelling. `npm run wereldstijl` meet de gemeten grond per
scherm tegen het palet, dus een afwijking valt op — maar hij kan niet zien of
een grond mooi is, alleen of hij uit het palet komt.

---

## De sociale kant staat op Pearl, en dat is een besluit

Gemeten op 31 augustus 2026 met `npm run wereldstijl`: de sociale schermen van
LivingOS — Sociaal, Vonk, Rendez-vous, Cercle, Entourage, Attenties en Vandaag —
staan op een **lichte** grond terwijl de rest van de wereld donker is. Dat is
**geen fout en geen achterstand**, het is een keuze, en hij staat hier omdat een
keuze die nergens staat opgeschreven vroeg of laat door iemand wordt
weggerepareerd met de beste bedoelingen.

Waarom het klopt: het huis heeft al een licht materiaal, en dit ís het. Vonk en
Rendez-vous meten **exact `--pearl-basis` (`#F4F0E9`)** en Sociaal zit er drie
vanaf. Parelmoer waar mensen elkaar ontmoeten en pianolak waar het huis werkt is
een verdedigbare grens: het onderwerp van die schermen is een ander mens, en dat
verdraagt geen zwart.

Wat er wél uit die meting volgt, en dat is klein en concreet: **vier schermen
staan op `#DDD6C9`** (Attenties, Cercle, Entourage, Vandaag) en dat is
`--suite-paper` uit `shared/social-suite.css` — 32 stappen naast `--pearl-basis`,
een zesde kleur die in geen enkel materiaal staat. Dat is geen tweede besluit
maar een drift: dezelfde bedoeling, een eigen getal. Of die vier naar Pearl gaan
of `suite-paper` een naam in dit bestand krijgt, is een open punt.

`scripts/wereldstijl.js` weet dit inmiddels. Hij vroeg eerst of een grond DONKER
was, en zette elk licht scherm daarmee in de bak "ombouwen" — een oordeel dat een
meter niet mag vellen. Hij houdt de gemeten pixel nu tegen het **palet** uit
`rtg-materiaal.css`: Pearl is een goed antwoord, Onyx ook, en een zelfbedachte
kleur valt op — ook als die toevallig donker is.

---

## Een scherm dat geen materiaal verdraagt, zegt dat

Een zoeker, een kaart, een speler, een cockpit. Dat zijn schermen waar het
materiaal geen keuze is maar een eigenschap van het onderwerp: een camerabeeld
op parelmoer is geen ander materiaal, het is een ander scherm. Zulke schermen
schilderen hun vlakken zelf, hard donker.

Dat botst met de themalaag, en het botste stil. De laag verzet de INKT van elk
scherm (`--rtg-txt` op de body) maar niet de vlakken die een scherm zelf
schildert. Onder champagne — het enige lichte materiaal — gaf dat op 19 augustus
2026 **116 stukken tekst die onzichtbaar waren**: bijna-zwart op bijna-zwart, tot
1,01:1. Niet slecht leesbaar. Onzichtbaar. Bordeaux en royal hadden er nul van,
want die zijn zelf donker; de fout leefde alleen in de stand die niemand mat.

Er zijn twee vormen van hetzelfde, en beide staan in `shared/rtg-themas.css`:

| verklaring op de body | wat het betekent |
|---|---|
| `data-rtg-eigenvlak` | ik schilder mijn eigen grond **en** mijn eigen inkt |
| `data-rtg-eigenvlak="onyx"` | ik ben altijd onyx — draai mijn hele eiland terug naar de donkere set |

De tweede staat nu op veertien schermen: de zoekers en kaarten (camera,
navigatie), de spelers (media, muziek), de cockpits (living-os, geld-command,
werkruimte, sociaal), de panelen (reizen-veilig, leven), en horloge, uitzicht,
residentie en rtg.html. De
themakeuze van het lid blijft overal elders staan; deze schermen doen er alleen
niet aan mee, en zeggen dat in één woord in plaats van per ongeluk.

**Half meedoen is de fout.** Een vlak dat zijn grond zelf schildert, schildert
ook zijn inkt; een scherm dat zijn inkt zelf schildert, schildert ook zijn grond.
Datzelfde geldt binnen een scherm: een donker eiland (de iOS-balk, de
Command-schil) herdefinieert de huistokens erbinnen, zodat álles wat er
binnenkomt klopt — en niet alleen wat er vandaag in staat.

*Handhaving:* `npm run a11y` keurt sinds 19 augustus 2026 ook champagne,
bordeaux en royal, over alle schermen, ingelogd.

---

## Licht is een eigenschap, geen effect

Elk materiaal draagt drie dingen, en daarom is een materiaal in code nooit één
waarde:

| Laag | Wat het doet |
|---|---|
| `-basis` | de kleur van het materiaal zelf |
| `-glans` | hoe licht erop valt: de richting en de zachtheid |
| `-rand` | wat de rand van het materiaal met licht doet |

Een vlak dat alleen `-basis` gebruikt is geverfd karton. Pas met glans en rand
wordt het een materiaal.

**Geen slagschaduwen als decoratie.** Diepte komt uit de rand en de glans, niet
uit een wolk onder een kaart.

---

## Typografie: twee rollen, één discipline

De huidige Bodoni-overal oogt luxe, maar ook **modeblad**. Voor een
softwarebedrijf hoort de werkletter moderner en technischer te zijn.

### RTG Display
Elegante high-contrast serif. Alleen voor: logo, wereldnamen, hoofdstukken,
marketing, grote cijfers. De gesloten lijst rollen staat in `ONTWERP.md` par. 1
en verandert hier niet.

### RTG Interface
Een geometrische, moderne grotesk: ronde `O`, open letters, strakke cijfers,
veel witruimte. Minimalistisch, technisch en precies — de ontwerpfilosofie van de
premium automerken, zonder futuristisch te worden. Voor menu's, tabellen,
formulieren, knoppen, dashboards, enterprise en Office.

```
RTG Reizen                          ← Display
29 AUG · RTG-R-6F612F · 2 reizigers ← Interface
```

### De grens, eerlijk benoemd

In `public/fonts/` liggen op dit moment **alleen Bodoni Moda en Inter**. De CSP
staat geen externe letterbron toe (`font-src 'self'`), en een letter voor een
commercieel merk kiezen is bovendien een licentiebesluit en geen codebesluit.

Daarom staan de twee **rollen** er nu wel — `--rtg-display` en
`--rtg-interface` — en loopt alles daar doorheen. Inter is de tijdelijke
invulling van de interface-rol: een grotesk, alleen geen geometrische. Zodra er
een licentie ligt, is het wisselen één regel in plaats van een sweep over
tweehonderd pagina's.

*Handhaving:* de toets zakt zodra een blad een letterfamilie noemt buiten die
twee tokens om.

---

## Het logo

`Rahul Travel Group` staat er nu klassiek en met veel contrast. Richting:
optisch strakker, dunner, ruimer gespatieerd, minder contrast.

```
Rahul Travel Group      →      R A H U L  T R A V E L  G R O U P
```

Niet luider, maar rustiger. Veel ruimte, veel lucht — Europees instituut in
plaats van modeblad. *Dit is een merkbesluit en staat hier als richting, niet als
uitgevoerde wijziging: het logo raak ik niet aan zonder expliciete opdracht
(`CLAUDE.md`).*

---

## Waar dit op neerkomt

- weinig kleuren;
- veel rust;
- perfecte uitlijning;
- hoogwaardige materialen;
- typografie met discipline;
- geen schreeuwerige glans of effecten.

Consequent doorgevoerd levert dat iets op wat je zelden ziet: software die
tegelijk warm, Europees, luxe én zakelijk oogt — en die op een consumentenapp
even geloofwaardig is als op een enterprise-dashboard.
