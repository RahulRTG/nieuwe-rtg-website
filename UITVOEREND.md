# RTG Uitvoerende Media

> **RTG speelt media niet af. RTG voert media uit.**

Dit bestand hoort bij `PLATFORM.md` zoals `APPSTORE.md` en `DEVELOPERCLOUD.md`
dat doen, en het staat bóven de mediadomeinen: Klankwerk, Theater, Clips en
Podium zijn niet het product maar de bouwstenen ervan. `LAT.md` zegt hoe er
geschreven wordt, `CLAUDE.md` wat het merk is, `README.md` waar de dingen nu
staan. Dit zegt waar media heen gaat.

**En net als de andere richtingsdocumenten zegt het wat er vandaag in de weg
staat.** Alles hieronder valt in vier bakken: **staat**, **een stap weg**, **een
besluit nodig**, **jaren weg**. Wat in de laatste twee bakken staat, hoort
nergens als knop op een scherm te verschijnen (LAT-regel 6).

---

## 0. De herformulering, en waarom die hier al waar is

Wat er tot vandaag stond is een mediawereld die vier soorten bestanden ontsluit:
een track, een video, een clip, een uitzending. Dat is de vergelijking met
Spotify, YouTube en TikTok — en in die vergelijking is RTG per definitie de
kleinste, want die drie hebben meer bestanden.

De propositie is de andere kant op:

> Een maker publiceert geen bestand maar een **programma**: onderdelen, regels,
> toestemmingen en handelingen. RTG bouwt daar op het moment van vragen een
> **uitvoering** van, binnen de grenzen die de maker heeft vastgelegd.

Het aantrekkelijke daaraan is niet dat het nieuw klinkt. Het is dat **dit huis
niet anders kán**, en dat is nagetrokken en geen retoriek:

- Het beeld van een clip staat in OPFS op het toestel van de maker. RTG heeft de
  bytes nooit (`kern/clips.js`).
- Het Theater hercomprimeert principieel niet: wat de maker uploadt is exact wat
  de kijker ziet (`kern/theater/index.js`).
- Een uitgave uit het Klankwerk is geen audiobestand maar een rij getallen die
  het toestel van de luisteraar uitrekent (`kern/muziek.js`).

**RTG kan geen montage renderen. Dus moet RTG een montage uitvoeren.** De
herformulering vraagt niet om een nieuwe architectuur; ze geeft een naam aan de
architectuur die er staat.

De scherpste illustratie staat al in de code, in `kern/clips-studio.js`:

> KNIPPEN is een begin en een eind, geen nieuwe video. De speler van de kijker
> springt naar `van` en stopt bij `tot`. Het origineel blijft heel.

Dat is uitvoerende media, één stuk groot. Een montage is diezelfde knip over
meerdere bronnen.

---

## 1. Wat er vandaag al staat, gemeten

Geen inschatting: per bouwsteen staat het bestand erbij dat het doet.

| bouwsteen | wat er staat | waar |
|---|---|---|
| **Het deel** | een bereik in een bron (`van`/`tot`), niet-destructief, terug te draaien | `kern/clips-studio.js` (de knip) |
| **Spoelen zonder kwaliteitsverlies** | bereik-verzoeken op het origineel | `kern/theater/video.js` |
| **Media als regel i.p.v. bestand** | een track is stappen en noten; `bouw(stijl, maten, ladder, zaad)` wekt op uit een zaad | `kern/muziek.js`, `kern/muziek-stijlen.js` |
| **Eén contentidentiteit** | `<vorm>:<domein-id>` over vier domeinen (`track:`, `video:`, `clip:`, `live:`) | `kern/mediaos/catalogus.js` |
| **Verwijzen i.p.v. kopiëren** | een lijst draagt alleen id's en lost ze op met de sessie van de LEZER | `kern/mediaos/lijsten.js` |
| **Een gedeelde aanwijzer i.p.v. een gedeelde stroom** | de luisterkamer deelt welk stuk, welke seconde, spelend of stil | `kern/mediaos/samen.js` |
| **Een `waarom` per rij** | elk stuk in de wereld draagt waarom het er staat, uit de code en niet uit een tekstje | `kern/mediaos/smaak.js` |
| **Toestemming met een doel én een grens** | `geeft` / `nooit` / `risico` / gesloten doelenlijst; wat niet bestaat staat er met de reden | `kern/appstore/machtigingen.js` |
| **Eén poort voor elke handeling met geld** | geen tweede betaalweg, geen tweede saldo | `kern/pay/poort.js` |
| **Intentie als interface** | de balk "Kies een wereld" wordt met een tik een vraagveld | `WERELD.md`, `public/shared/command/praat.js` |
| **Een tijdgebonden tekstspoor** | `van`/`tot`/`tekst`, op één plek gevalideerd voor twee vormen | `kern/ondertitels.js` |
| **De partituur, de aanspraak en de uitvoering** | gebouwd op 27 augustus 2026: zeven routes, vijftien toetsen, vier mutaties raak | `kern/uitvoering/`, `routes/uitvoering.js` |
| **Benoemde stukken op een tijdlijn** | `secties`: intro, couplet, refrein als namen op stukken van het raster, bewaard op de track | `kern/muziek.js`, `kern/muziek-lied.js` |

**En wat er niet staat, ook gemeten — met een correctie die de zaak sterker
maakt.** Het benoemde stuk op een tijdlijn bestaat hier al, maar in precies één
van de vier domeinen: het Klankwerk bewaart `secties` op een track (intro,
couplet, refrein), met de regel erbij dat een sectie die buiten het stuk valt
vervalt. In het Theater, Clips en het Podium bestaat niets vergelijkbaars — daar
zijn de enige tijdstructuren de ondertitelcue en de knip.

Het **deel** uit paragraaf 2 is dus geen vreemd begrip dat van buiten komt. Het
is `secties` doorgetrokken naar de andere drie vormen, en dat is precies het
soort uitbreiding waar `SEMANTIEK.json` op aandringt: een bestaande naam met een
bestaande betekenis, niet een 78ste woord voor hetzelfde. Wie dit bouwt, hoort
eerst te kijken of `secties` en `deel` één ding horen te zijn.

---

## 2. Het ene nieuwe begrip: het programma

De verleiding is dertien functies. Het zijn er niet dertien maar één: een
publicatie krijgt vier delen, en alles hieronder is een gevolg daarvan.

| deel | wat de maker vastlegt |
|---|---|
| **Onderdelen** | wat er ís — bestaande id's, plus één nieuwe vorm: `fragment:` |
| **Regels** | wat eruit mag ontstaan — verplichte kern, optionele verdieping, volgorde-eisen, minimum- en maximumduur, dieptes, talen |
| **Toestemming** | wat RTG ermee mag — inkorten, hermonteren, als bron dienen, in een samengestelde uitzending |
| **Handelingen** | wat het stuk kan dóén — kopen, boeken, vragen; altijd over de bestaande rails *(nog niet gebouwd, zie par. 3)* |

### 2.1 Het fragment: de vijfde id-vorm

`kern/mediaos/catalogus.js` kent vier vormen. Er komt er één bij, en maar één:

```
fragment:<vorm>:<domein-id>@<van>-<tot>        fragment:track:u91c0@0-30
```

**Het heette in de eerste opzet `deel`, en die naam is afgevallen op een
meting.** `deel` is in precies deze laag al bezet: `deelId()` in
`kern/mediaos/catalogus.js` SPLITST een stuk-id, en `delen` in
`kern/mediaos/lijstdelen.js` betekent iets met iemand DELEN. Een derde
betekenis erbij, uitgerekend in de module die het id moet parsen, is de stille
botsing die `SEMANTIEK.json` telt. `fragment` kwam uit dezelfde meting als vrij.

Een fragment bezit niets. Het draagt een verwijzing en twee getallen — exact het
patroon van de bibliotheek en de afspeellijst (LAT-regel 4). Daaruit volgen drie
eigenschappen die niet apart gebouwd hoeven te worden:

- **Haalt de maker het stuk weg, dan is het fragment weg** — en het verdwijnt
  niet stil, maar staat als onbeschikbaar in de uitvoering.
- **De deur blijft van het domein.** Een fragment wordt opgelost met de sessie
  van de kijker. Een uitvoering is dus nooit een weg om binnen te halen wat de
  wereld weigert.
- **Er wordt niets gekopieerd**, dus er ontstaat geen tweede administratie naast
  het origineel.

### 2.2 De uitvoering

Een verzoek (tijd, taal, toestel, voorkennis, toestemming) levert een
**uitvoering**: een geordende lijst delen met per regel een `waarom`, in dezelfde
vorm als `kern/mediaos/smaak.js` die nu al draagt.

Een uitvoering is **reproduceerbaar**: hij draagt zijn zaad en zijn verzoek, dus
dezelfde vraag levert dezelfde montage, en een maker kan zien wat een kijker
werkelijk kreeg. Zonder dat is "de officiële 24-minutenversie" niet na te trekken
en dus niet te verdedigen.

### 2.3 De regel die dit RTG maakt in plaats van AI-rommel

> **RTG monteert alleen uit wat de maker heeft aangewezen, en verzint er nooit
> iets bij.** Elke regel van een uitvoering is terug te voeren op een deel dat de
> maker heeft toegestaan. Past het gevraagde niet binnen de regels, dan wordt het
> **geweigerd met de reden** — er wordt niet opgevuld, niet overbrugd en niet
> gladgestreken.

Dat is dezelfde beweging als "liever geen getal dan een getal dat niets meet"
(het makersbord), nu op montage. Een verzonnen brug tussen twee scènes is
precies zo'n getal: het ziet eruit als het werk van de maker en is het niet.

### 2.4 Een uitvoering draagt wat hij is

`BESTUUR.md` eist dat elke bewering een bewijsgraad draagt. Een uitvoering is een
bewering van RTG over andermans werk, dus hij draagt: waaruit hij bestaat, wat de
maker precies heeft toegestaan, welk verzoek eraan ten grondslag lag, en wat er
is weggelaten. Niet in de kleine lettertjes — een kijker die vraagt "wat mis ik
in deze 24 minuten" hoort een antwoord te krijgen.

---

## 3. De vijf standaarden, per stuk in een bak

Bijgewerkt op 27 augustus 2026, nadat de motor er stond.

| # | idee | standaard | bak | wat het nog vraagt |
|---|---|---|---|---|
| 1 | film die zich aan jou vormt | Elastic | **staat** (runtime) / **jaren** (auteurschap) | de motor draait; de studio voor de maker is het echte werk |
| 7 | "leg me dit uit in 20 minuten" | Elastic | **een stap weg** | de motor is er; wat ontbreekt is de ingang, en die bestaat (`praat.js`) |
| 13 | geen homepage, intentie als interface | — | **staat** | aansluiten op de bestaande balk, geen tweede ingang bouwen |
| 8 | makers verkopen aanspraken | — | **staat** (het begrip) / **een stap weg** (de aankoop) | de aanspraak werkt; de koppeling aan RTG Pay is de volgende stap |
| 11 | muzikaal universum (NIGHT DRIVE) | Elastic | **een stap weg** | een uitgave die de regel draagt i.p.v. de kanalen; de generator staat er al |
| 4 | content die terugpraat | Responsive | **een stap weg** | keuzepunten als regels in de partituur |
| 6 | "maak mijn ochtend" | Elastic + Responsive | **een besluit nodig** | zie 4.4: alleen op wat het lid zelf heeft aangewezen |
| 5 | RTG Recall | Responsive | **een besluit nodig** | zie 4.4; het is `smaak.js` met een tijdas, niet een profiel |
| 9 | objecten in media | Executable | **een besluit nodig** | zie 4.5: verklaard door de maker, nooit gedetecteerd |
| 2 | aanwezigheid i.p.v. livestream | World | **een besluit nodig** | het Podium heeft de motor; de ruimte is een wereld en moet de lat halen |
| 3 | een maker publiceert een wereld | World | **een besluit nodig** | zie 4.2: het wereldpatroon is de lat, niet een tabbladenbundel |
| 10 | media beweegt tussen apparaten | Fluid | **jaren weg** | tussen tabbladen staat het (`shared/speler.js`); tussen apparaten is een ander ding |
| 12 | Creator Presence | World | **jaren weg** | zie 4.3 |

**Wat er van de motor NIET staat, en dat hoort er hardop bij.** Een partituur
draagt vandaag onderdelen, regels en toestemming; de vierde kolom uit par. 2 --
de **handelingen** (kopen, boeken, vragen vanuit een uitvoering) -- is niet
gebouwd. Er is dus nog geen enkele knop in een uitvoering die geld of een
afspraak raakt, en er staat er ook geen die doet alsof. De aanspraak is er wel
al: wat ontbreekt is de aankoop die hem verleent, en die hoort over
`kern/pay/poort.js` te lopen en nergens anders.

Ook niet gebouwd: een scherm. Deze ronde is de laag en niet de app.

## 4. Waar de opzet en het huis botsen

### 4.1 "Capability" heette hier al twee dingen — het besluit is genomen

`OS.md` had dit gemeten en het was geen muggenziften: het woord staat in het
lagenmodel van `PLATFORM.md` én in dat van de OS-opzet, en het betekent er niet
hetzelfde. `SEMANTIEK.json` telt 77 namen die meer dan één betekenis dragen; dit
zou de 78ste zijn geworden, en meteen in een verkoopbelofte aan makers.

**Besluit van de eigenaar (27 augustus 2026): het heet `aanspraak`.** Niet
capability, niet skill, niet access, niet membership. De meting bevestigde dat
de naam vrij was: nul treffers in `server/` en `public/`, op één stuk lopende
tekst in de juridische voorwaarden na — waar het precies dit betekent.

Het is ook het enige woord dat de RELATIE beschrijft in plaats van een kant
ervan:

| woord | wat het beschrijft |
|---|---|
| capability | wat een systeem KAN |
| toestemming | wat iemand MAG |
| toegang | of een deur opengaat |
| abonnement | een betaalvorm |
| product | wat er verkocht wordt |
| **aanspraak** | **wat deze mens van deze maker mag verlangen, en waarom** |

Daaruit volgt de keten: **aanbod → aankoop → aanspraak → uitvoering**. Een
maker verkoopt een product; dat product VERLEENT aanspraken; de uitvoering
controleert de aanspraak. Een betaald fotografieprogramma is dus niet zelf een
rechtenset — dat onderscheid is precies wat de oude naam kwijtraakte.

En de herkomst verschilt terwijl de uitvoering dat niet hoeft te weten: een
aanspraak uit een aankoop, een cadeau, een werkgeversbudget, een kaartje, een
actie of van de maker zelf zijn voor de motor hetzelfde ding. Het gratis pad en
het betaalde pad delen dus één deur — er is er maar één die dicht kan zitten.

**Twee grenzen bij dit woord.** Een aanspraak hangt aan een HERKOMST plus een
BRON en nooit aan een boolean (dezelfde regel die `WAARDE.md` aan uitbetalen
stelt): zonder allebei ontstaat er geen aanspraak, en is er dus ook nooit een
die per ongeluk aanstaat. En het is een **huiswoord, geen schermwoord** — een
lid ziet "jouw aankopen", "jouw cursussen", "jouw kaartjes", nooit "mijn
aanspraken", net zomin als hij hoort te weten dat een montage intern een lijst
fragmenten is.

*Ook `programma` viel af op dezelfde meting: het betekent hier al een lijst
gebeurtenissen op een dag (`kern/rechterhand/reisboek.js`,
`kern/sportclub/cockpit.js`, `kern/rtfclubs.js`). Wat de maker vastlegt heet
daarom `partituur` — vrij, en de metafoor klopt tot in de details: een partituur
wordt niet afgespeeld maar uitgevoerd.*

### 4.2 "Wereld" heeft hier al een lat

`PLATFORM.md` beschrijft het wereldpatroon: samenvoegen is stap één, niet de
bedoeling — een wereld is pas af als hij zijn onderwerp begrijpt (graaf, beleid,
cockpit, gegronde Rahul, actielog).

Massimo's Kitchen als verzameling tabbladen (video's, recepten, winkel, Q&A) is
precies de super-app-fout die dat document voorkomt. Dat is goed nieuws: de lat
bestaat al en hoeft niet bedacht te worden. Maar hij geldt onverkort, ook — juist
— als het een maker is die de wereld publiceert. De toetsvraag blijft die uit
`PLATFORM.md`: is dit een zelfstandige capability, of een tweede ingang naar
dezelfde?

### 4.3 Creator Presence is de zwaarste, en botst het hardst

Dit huis zegt op elke plek waar het ertoe doet dat de AI niet met gezag spreekt
en nooit namens een mens toezegt: de pas-regels (de AI belooft nooit zelf
toegang), het Klankwerk ("de AI zet neer, jij bent de maker"), de horeca
(generatieve AI bepaalt nooit of iets veilig is om te eten), het geld (de AI
beweegt geen geld).

Een aanwezigheid die uit 500 uur materiaal antwoord geeft, staat daar dwars op
zodra hij als de maker klinkt. Wat hij minimaal moet dragen om te mogen bestaan:

- **Elke uitspraak herleidbaar** naar een fragment dat de maker heeft
  vrijgegeven, zichtbaar voor de kijker — geen samenvatting zonder bron.
- **Nooit de ik-vorm zonder dat fragment.** Het heet niet "de maker" maar
  "gebouwd uit het materiaal van de maker", overal, ook in de kop.
- **Nooit een toezegging**: geen prijs, geen afspraak, geen toegang, geen
  medisch, juridisch of financieel oordeel. Dat is geen extra regel maar de
  bestaande regel, hier toegepast.
- **Onmiddellijk intrekbaar** door de maker, met terugwerkende kracht op wat er
  klaarstaat.
- **Codenamen blijven codenamen.** Een aanwezigheid die uit echt materiaal put,
  is een van de makkelijkste manieren om een echte naam te laten ontsnappen.

Kan het die vijf niet dragen, dan vervalt de functie. Dat is de regel uit
`LEVEN.md`, en hij geldt hier onverkort.

### 4.4 Recall en "maak mijn ochtend" botsen niet — mits ze blijven wat ze zijn

`kern/mediaos/smaak.js` staat er expliciet:

> Geen kijkgedrag, geen afspeelduur, geen stil meegeschreven profiel.

Recall zoals voorgesteld — wat iemand zelf heeft bewaard, aangewezen en
belangrijk gevonden — is daarmee niet in strijd. Het is `smaak.js` met een
tijdas erbij: niet "wat heb je gekeken" maar "wat had je aangewezen, en wat is
daaraan veranderd".

De grens waar het wél op stukloopt: zodra "wat er voor jou nieuw is" beter wordt
door stil mee te schrijven wat iemand afmaakte of overslaat, is de verleiding
groot en de regel dood. Een samengestelde ochtenduitzending mag dus alleen putten
uit wat het lid **zelf** heeft ingesteld, en hoort per fragment te zeggen waarom
het erin zit.

### 4.5 Objecten in media kunnen hier niet gedetecteerd worden

RTG heeft de clipbytes niet en hercomprimeert het Theater niet. Er is dus geen
moment waarop een pan of een gitaar herkend kán worden — en dat is maar goed ook:
`kern/mediaos/hub.js` weigert nu al een "officiële videoclip bij dit nummer",
omdat een gokje op titelgelijkenis eruit zou zien als een feit en dat niet is.

Objecten worden dus **verklaard** door de maker op een tijdlijn, in dezelfde vorm
als een deel (`van`/`tot` plus wat het is). Dat is minder magisch en het is de
enige eerlijke vorm. De koppeling naar kopen, huren of boeken loopt daarna over
de bestaande rails; er komt geen tweede weg naast `kern/pay/poort.js`, en een
handeling die een tweede persoon raakt wordt klaargezet en door een mens
bevestigd (`LIFE.md`).

### 4.6 Wie is verantwoordelijk voor de montage?

"De officiële 24-minutenversie" is een bewering van RTG over het werk van iemand
anders. Zolang elke regel herleidbaar is (2.3) en de uitvoering draagt waaruit
hij bestaat (2.4), is die bewering te verdedigen. Zonder die twee is het
hermontage van andermans werk onder de naam van de maker, en dan is de vraag niet
technisch maar juridisch.

Dit hoort daarom in de toestemming te staan en niet in een instelling: een maker
die alleen de volledige versie wil, houdt de volledige versie.

---

## 5. Wat het kost, en waar het omvalt

Niet op de runtime. Op het **auteurschap**.

Een documentaire van 140 scènes met relaties, verplichte kernstukken, dieptes en
talen is echt werk, en geen enkele maker doet dat twee keer als het gereedschap
tegenvalt. **Elastic Media leeft of sterft bij de studio voor de maker, niet bij
de speler voor de kijker.** Wie hier begint met de mooie kijkkant en de
makerskant "later" doet, bouwt een formaat waar niemand in publiceert.

Twee dingen die dat verzachten en die er al zijn:

- De knip is al niet-destructief en al terug te draaien. Een maker die delen
  markeert, gooit nooit iets weg.
- Rahul mag hier doen wat hij in het Klankwerk al doet: een **voorstel** neerzetten
  (een scène-indeling, een korte versie) dat de maker daarna verschuift en
  wegstreept. Nooit een klaar programma, want dan is de maker de machine.

---

## 6. De volgorde

1. ~~**Het woord voor wat een maker verkoopt.**~~ **Genomen op 27 augustus 2026:
   `aanspraak`** (par. 4.1). Twee andere namen vielen op dezelfde meting af:
   `deel` werd `fragment`, `programma` werd `partituur`.
2. ~~**Het fragment en de uitvoering** op wat er al staat.~~ **Gebouwd**:
   `kern/uitvoering/`, zeven routes, vijftien toetsen, vier mutaties raak. Geen
   transcodering, geen nieuw beeld — de bestaande spelers voeren het uit.
3. **De aankoop die een aanspraak verleent**, over `kern/pay/poort.js`. Vandaag
   verleent alleen de maker er een; dat is de helft van de keten.
4. **Het muzikaal universum** in het Klankwerk (#11): de goedkoopste nieuwe
   standaard, en de enige die de grote drie structureel niet hebben.
5. **De makersstudio** voor fragmenten en regels — het punt waarop dit staat of
   valt (par. 5).
6. **Verklaarde objecten** (4.5), over dezelfde betaalpoort.
7. Pas daarna de wereld (4.2) en, als hij zijn vijf voorwaarden kan dragen, de
   aanwezigheid (4.3).

## 7. Wat dit document niet is

Het is geen toezegging dat er vijf standaarden komen. Het is de plek waar staat
welke er al liggen, welke één stap weg zijn, welke een besluit van de eigenaar
vragen en welke jaren weg zijn — zodat niemand ze voor elkaar aanziet.

Drie dingen die er met opzet NIET in staan:

- **Geen belofte dat een uitvoering "beter" is dan de montage van de maker.** Ze
  is korter, of anders gericht. Het volledige werk blijft het werk.
- **Geen getal over hoeveel programma's of delen er zijn.** Er zijn er vandaag
  nul; het begrip bestaat nog niet in de code.
- **Geen tweede mediawereld naast de Media OS.** Dit is geen nieuwe laag over de
  vier domeinen maar één begrip erbinnen. Zodra dit een eigen catalogus,
  een eigen volgknop of een eigen bibliotheek krijgt, is het de fout die
  `kern/mediaos/catalogus.js` juist heeft opgelost.
