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
