# Hoe vol is elke OS-app

Een inventarisatie, gemeten en niet geschat. Per app staat wat hij bij het
openen ECHT doet: hoeveel verschillende server-endpoints hij aanroept, en
hoeveel knoppen en velden er staan als de pagina klaar is met opbouwen.

**Gemeten op 2026-08-04 met `node --experimental-sqlite scripts/appdiepte.js`.**

## Waarom dit opnieuw gemeten is

De vorige versie telde letterlijke `/api/`-paden in de bron. Dat is een
tekstzoektocht, en die liegt twee kanten op: te laag, want vrijwel elke app
roept zijn server aan via een hulpje (`api('cellier')`) waardoor het pad
nergens voluit staat; en te hoog, want een pad in een commentaarregel telt
gewoon mee. Zo stonden er 35 "schillen" in dit document. Het zijn er 4.

Deze meting vraagt het aan de browser: elk scherm gaat open met een gewone
ledensessie, en wat de pagina dan aanroept is wat er geteld wordt. De
gedeelde schil (het OS-menu en de metgezel, die op ELKE pagina hetzelfde
aanroepen) wordt eraf getrokken -- niet met een lijst die iemand bijhoudt,
maar met wat op alle eenentachtig pagina's tegelijk voorkomt. Zo kan die
aftrek niet verouderen.

## Wat dit cijfer NIET is

Het is geen ranglijst. Het telt wat een app doet bij het OPENEN, want dat
is de enige stand die je van alle apps op dezelfde manier kunt meten. De
meeste schermen halen hun tweede en derde lading pas op als je een tabblad
aantikt. De verdeling laat dat zien:

| endpoints bij het openen | apps |
|---|---|
| 1 | 4 |
| 2 | 30 |
| 3 | 42 |
| 4 | 4 |
| 5 | 1 |

Zo'n smalle spreiding is een ondergrens, geen oordeel. Daarom kent dit
document maar EEN grens: een app die na aftrek van de schil hooguit een
endpoint aanroept, haalt iets op en toont het. De rest krijgt geen etiket --
een cijfer dat niet discrimineert hoort er geen te dragen.

Wat er wel per app is nagelopen staat in `test/*.e2e.js`: die lopen de weg
van een scherm werkelijk af, inclusief de tabbladen. `scripts/schermen.js`
houdt bij hoeveel apps zo'n toets nog missen.

## De 4 schillen

Deze halen bij het openen hooguit een ding op. Dat hoeft geen gebrek te
zijn: een scherm dat bewust een ding doet is af met nul aanroepen. Het is
de lijst om NAAR TE KIJKEN, niet de lijst van wat stuk is.

| app | endpoints | knoppen | velden | tekens |
|---|---|---|---|---|
| Camera | 1 | 45 | 12 | 332 |
| Juridisch | 1 | 43 | 15 | 765 |
| RTG Sound | 1 | 32 | 4 | 597 |
| Rust | 1 | 24 | 2 | 246 |

## Alle apps

| app | endpoints | knoppen | velden | tekens |
|---|---|---|---|---|
| Berichten | 5 | 30 | 5 | 381 |
| Boeken | 4 | 28 | 2 | 942 |
| Spelen | 4 | 61 | 17 | 435 |
| Vitaal | 4 | 26 | 8 | 1039 |
| Wie ben ik | 4 | 35 | 18 | 992 |
| Attenties | 3 | 18 | 2 | 521 |
| Babyboek | 3 | 20 | 2 | 342 |
| Cellier | 3 | 18 | 2 | 488 |
| Cercle | 3 | 18 | 2 | 454 |
| Clips | 3 | 34 | 6 | 213 |
| Codewoord | 3 | 28 | 6 | 1254 |
| Entourage | 3 | 18 | 2 | 522 |
| Flits | 3 | 23 | 2 | 367 |
| Garde-robe | 3 | 18 | 2 | 521 |
| Geloof & Wijsheid | 3 | 16 | 2 | 464 |
| Gereedschap | 3 | 53 | 15 | 201 |
| Gezondheid | 3 | 16 | 2 | 332 |
| Hangar | 3 | 18 | 2 | 489 |
| Kompas | 3 | 16 | 2 | 338 |
| Logboek | 3 | 18 | 2 | 480 |
| Maison | 3 | 18 | 2 | 497 |
| Markt | 3 | 16 | 2 | 301 |
| Mecenaat | 3 | 18 | 2 | 494 |
| Meet | 3 | 26 | 4 | 456 |
| Memo | 3 | 20 | 3 | 445 |
| Mijn Stad | 3 | 21 | 5 | 391 |
| Nalatenschap | 3 | 18 | 2 | 497 |
| Navigatie | 3 | 26 | 3 | 183 |
| Pesten | 3 | 16 | 2 | 346 |
| Podium | 3 | 26 | 5 | 312 |
| Projecten | 3 | 16 | 2 | 313 |
| Reisboek | 3 | 18 | 2 | 500 |
| Rendez-vous | 3 | 21 | 2 | 524 |
| RTF-Bibliotheek | 3 | 16 | 2 | 335 |
| Scanner | 3 | 23 | 4 | 512 |
| School | 3 | 22 | 12 | 524 |
| Schrijven | 3 | 16 | 2 | 332 |
| Table | 3 | 18 | 2 | 474 |
| Theater | 3 | 22 | 6 | 558 |
| Thuisrust | 3 | 36 | 5 | 1296 |
| Thuiswacht | 3 | 32 | 7 | 970 |
| Toetsen | 3 | 16 | 2 | 307 |
| Veilig | 3 | 16 | 2 | 333 |
| Vrienden | 3 | 54 | 18 | 591 |
| Website-maker | 3 | 66 | 9 | 684 |
| Wie betaalt wat | 3 | 24 | 5 | 303 |
| Zakgeld | 3 | 16 | 2 | 291 |
| Agenda | 2 | 77 | 13 | 434 |
| Balans | 2 | 28 | 4 | 483 |
| Bestanden | 2 | 31 | 9 | 396 |
| De Salon | 2 | 59 | 3 | 1747 |
| De Zaal | 2 | 24 | 2 | 450 |
| Food Court | 2 | 33 | 3 | 723 |
| Galerij | 2 | 28 | 3 | 365 |
| Genootschap | 2 | 22 | 3 | 216 |
| Het Huis | 2 | 39 | 2 | 6718 |
| Lab-fonds | 2 | 26 | 9 | 814 |
| Leren | 2 | 22 | 6 | 351 |
| Métier | 2 | 27 | 12 | 752 |
| Nieuws | 2 | 23 | 2 | 237 |
| Notities & Taken | 2 | 28 | 9 | 324 |
| Passkeys | 2 | 21 | 4 | 555 |
| Pulse | 2 | 22 | 3 | 179 |
| Reisbureau | 2 | 28 | 5 | 879 |
| RTFoundation | 2 | 107 | 9 | 127 |
| RTG Browser | 2 | 22 | 4 | 306 |
| RTG Klankwerk | 2 | 34 | 15 | 232 |
| RTG Krant | 2 | 17 | 2 | 169 |
| RTG Office | 2 | 61 | 13 | 827 |
| RTG OV | 2 | 24 | 2 | 696 |
| RTG-code | 2 | 26 | 3 | 379 |
| Sport | 2 | 24 | 2 | 376 |
| Uitgaan | 2 | 28 | 2 | 349 |
| Verblijven | 2 | 31 | 4 | 423 |
| Vertaler | 2 | 28 | 5 | 808 |
| Vluchten | 2 | 22 | 2 | 399 |
| Vonk | 2 | 24 | 10 | 755 |
| Camera | 1 | 45 | 12 | 332 |
| Juridisch | 1 | 43 | 15 | 765 |
| RTG Sound | 1 | 32 | 4 | 597 |
| Rust | 1 | 24 | 2 | 246 |
