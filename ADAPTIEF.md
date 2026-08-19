# De adaptieve laag — dezelfde capability, opnieuw samengesteld

Vastgelegd 19 augustus 2026. Dit document gaat over hoe een handeling zich
gedraagt op het apparaat waarop hij gebruikt wordt. `ONTWERP.md` gaat over de
vormtaal en noemt in paragraaf 10 de drie layouts; dit is wat daaronder hangt.
`WERELD.md` beschrijft het beginscherm en de schilbalk waar dit in landt,
`WERKRUIMTE.md` het desktopparadigma, `TOEGANKELIJK.md` de harde poorten.

**`GRAMMATICA.md` staat hier bovenop.** Dit document zegt WAAR een handeling
terechtkomt op welk apparaat; de grammatica zegt HOE je hem aanraakt (vijf
gebaren) en WAT hij weegt (vijf trappen, van `licht` tot `plechtig`). Wie een
capability declareert, heeft ze allebei nodig.

## De regel, in één zin

> **Bureau toont veel context tegelijk; telefoon toont één duidelijke taak met
> zijn context en handelingen binnen bereik — en de capability zelf verandert
> niet, alleen zijn vorm.**

Dit is geen "mobiele versie" en geen responsive-ronde. Het is een tweede
compositie van hetzelfde. Wat een lid op een groot scherm kan, kan hij op zijn
telefoon ook.

## Waarom dit een laag is en geen stapel uitzonderingen

Er staan 184 schermen in `public/apps/`. Als elk scherm zijn eigen mobiele
oplossing krijgt, gebeurt er altijd hetzelfde: de werkbalk past niet, dus gaat
hij op `display:none`, en daarmee is de handeling niet verplaatst maar wég. Bij
tien schermen valt dat op. Bij honderdvierentachtig kan niemand meer zeggen wat
een lid op zijn telefoon nog kán, en is er ook geen plek meer waar je dat zou
kunnen nakijken.

Vandaar dat er één laag is, en dat capabilities zich daarbij **aanmelden** in
plaats van dat de laag ze gaat kennen. De schilbalk weet niet wat een document is
en het document weet niet dat er een balk bestaat.

## Een declaratie

```js
RTGAdaptief.declareer({
  id: 'document.commentaar.toevoegen',
  naam: 'Commentaar',
  bureau:   ['werkbalk', 'contextmenu', 'sneltoets'],
  tablet:   ['selectiepopover', 'werkbalk'],
  telefoon: ['selectiebalk', 'lade'],
  doe: function () { /* de ENE implementatie */ }
});
```

De vormen zijn `telefoon` (< 640px), `tablet` (640–999) en `bureau` (≥ 1000),
plus `stem` als kanaal. Die grenzen staan op één plek — `MAAT` in
`shared/adaptief.js` — en 1000 is met opzet dezelfde breedte waarop de bank in
`command.css` een vaste rail wordt. Een tweede getal ernaast zou een strook van
veertig pixels opleveren waar de ene laag "telefoon" zegt en de andere "desktop".

De presentaties, met hun diepte en of ze dominant zijn:

| presentatie | vormen | diepte | dominant |
|---|---|---|---|
| `werkbalk` | tablet, bureau | 1 | nee |
| `contextmenu` | tablet, bureau | 2 | nee |
| `sneltoets` | bureau | 1 | nee |
| `contextvlak` | tablet, bureau | 1 | nee |
| `selectiepopover` | tablet | 1 | nee |
| `selectiebalk` | telefoon, tablet | 1 | nee |
| `balk` | telefoon, tablet | 1 | nee |
| `lade` | telefoon, tablet | 2 | **ja** |
| `paneel` | telefoon, tablet, bureau | 2 | **ja** |
| `taakmodus` | telefoon, tablet | 2 | **ja** |
| `gesprek` | stem | 1 | nee |

**Diepte** telt tikken vanaf waar je staat tot de handeling gedaan is. Een knop
die er al staat is 1, iets achter een laag is 2, iets in een tweede laag daarin
is 3 — en drie is de grens. De diepte van een capability is de **kortste** weg
die hij heeft: staat vet zowel in de selectiebalk als in de lade, dan is hij één
tik diep en is de lade zijn uitgebreide vorm, niet zijn enige weg.

**Dominant** betekent dat de laag beslag legt op het scherm en er maar één van
tegelijk open kan zijn.

## De grenzen

Dit zijn de regels waar een functie voor wijkt, niet andersom.

**1. Verbergen bestaat niet.** Een capability die op bureau bestaat en op telefoon
geen enkele vorm heeft, is geen ontwerpkeuze maar een **gebrek**. `keur()` meldt
hem als `verdwenen`, het register schrijft hem in `gebreken()`, en
`test/adaptief.test.js` laat de bouw zakken zodra er in de bron een declaratie
staat zonder `telefoon:`. Kan een handeling niet zichtbaar zijn, dan krijgt hij
een andere vorm — een lade, een paneel, een taakmodus. Weglaten is de fout waar
deze hele laag tegen is.

**2. Eén dominante laag tegelijk.** `RTGLagen` sluit wat er stond voordat hij iets
nieuws opent. Twee laden over elkaar is de vorm waarin een mens niet meer weet
waar "terug" heen gaat, en dan verlaat hij het scherm in plaats van de laag.

**3. Drie manieren om eruit, en alle drie werken ze.** Naar beneden vegen, naast
de laag tikken, en de terugknop van het toestel. Die laatste is de reden dat er
met de geschiedenis gewerkt wordt: een laag die de terugknop niet opvangt, laat
die knop de hele app verlaten.

**4. Maximaal drie handelingen diep.** Gemeten als de kortste weg, per vorm.

**5. Raakvlakken zijn minstens 44×44.** `TOEGANKELIJK.md` houdt 24×24 aan als
harde poort — dat is WCAG 2.2 AA, de ondergrens waaronder iets kapót is. Deze
laag is geen ondergrens maar een ontwerp voor duimen, en dan is 44 de maat. De
poort blijft de poort; dit is strenger en mag dat zijn.

**6. Geen horizontale schuif, behalve waar de inhoud dat vraagt.** Een tabel mag
schuiven. Een rij handelingen niet: wat niet past gaat naar de lade.

**7. Eén implementatie per handeling.** De adaptieve laag biedt een handeling op
een andere plek AAN; hij bouwt hem niet na. Een tweede implementatie van "vet" is
een tweede vet — ze zijn een week gelijk, en daarna is de vraag welke van de twee
de echte is (`LAT.md` regel 4).

## De schilbalk is het eerste instrument

De balk onderaan de werktafel had drie zones: de bank links, waar je bent in het
midden, weg hier rechts, en Rahul aan het eind. Met nul werkbladen stond er "Kies
een wereld" — een zin, geen bediening, en de enige weg naar een wereld liep via
de lade: twee handelingen voor het enige wat dat scherm te doen heeft.

Het midden is nu een **contextzone**:

| stand | wat er staat |
|---|---|
| geen blad open | de werelden zelf, als knoppen. Eén tik. |
| een blad open | de handelingen die dat blad aanmeldt, met zijn naam als anker ervoor |
| een selectie | de handelingen van die selectie; zodra de selectie weg is, staat de vorige rij er weer |

**De structuur blijft voorspelbaar, en dat is de voorwaarde.** Links is altijd de
bank, rechts is altijd Rahul, het midden begint altijd met waar je bent. Wat
verandert is de inhoud van het midden, nooit de plekken.

**Lang drukken legt uit; omhoog trekken geeft meer.** Hier stond eerst dat lang
drukken de uitgebreide lade opende. Dat was een tweede betekenis voor hetzelfde
gebaar, naast die van omhoog trekken, en zo verliest een taal zijn woorden
(`GRAMMATICA.md`). Meer gereedschap zit nu waar het hoort: omhoog trekken, of de
`⋯` ernaast.

**Twee dingen die hier bewust zijn ingeleverd.** Bij een selectie wijkt het anker,
en daarmee de weg terug naar je werkbladen; op 390px houdt de balk 232 pixels over
tussen de bank en Rahul, en met een documentnaam erin bleef daar één handeling van
over. Het anker komt terug zodra je de selectie loslaat, en de bank links blijft de
hele tijd staan. En een pagina die je rechtstreeks opent in plaats van als
werkblad heeft geen schilbalk, dus ook geen contextzone; daar doet de eigen
werkbalk van dat scherm het werk. Dat is geen ontbrekende functie, wel een gat in
de dekking.

## De brug over de frame-grens

Een werkblad is een iframe (`shared/command/werktafel.js`); de balk staat in het
bovendocument. Een tekstverwerker die "er is tekst geselecteerd" roept, roept dat
dus in een ander document dan waar de knoppen staan.

`shared/adaptief/brug.js` stuurt declaraties en context omhoog en handelingen
terug omlaag, met `postMessage`. Drie dingen die daar bewaken:

1. **Alleen dezelfde herkomst.** Een bericht van elders is geen context maar een
   poging de balk van een lid te laten zeggen wat iemand anders wil.
2. **Alleen het actieve blad.** Twee bladen kunnen naast elkaar staan; zonder deze
   eis neemt het blad waar je niet naar kijkt de balk over, en wijst "vet" naar het
   verkeerde document.
3. **Alleen wat serialiseerbaar is.** Een teken is in het frame een SVG-element en
   gaat niet over de grens; wat overgaat is het label.

En één ding dat daar stil fout was: het blad wisselen stuurt géén bericht, dus
bleef de balk de handelingen van blad 1 tonen terwijl blad 2 in beeld stond.
Vandaar een waarnemer op de bladen zelf.

## Wie er aangesloten is, en wie nog niet

**RTG Office** (`apps/office/adaptief.js` + `adaptief-pres.js`) is de eerste en
tot nu toe enige afnemer: de tekstverwerker, het rekenblad en de presentatie.

De manier waarop dat gebeurt is de bedoeling voor iedereen die volgt: die laag
bouwt **geen tweede knoppenset**, hij leest de werkbalk die er al staat
(`#tekstTools`, `#bladTools`) en maakt van elke knop daarin een capability. De
handeling blijft precies één keer geïmplementeerd. Wie morgen een knop aan de
werkbalk toevoegt, heeft hem op een telefoon meteen ook; er valt niets bij te
werken.

Wat de presentatie apart maakt: zijn bediening is geen werkbalk. Presenteren is
een **taakmodus** en de indeling is een `<select>` die op een telefoon een lade
wordt — dezelfde opties, dezelfde waarde terug naar hetzelfde element.

**Nog niet aangesloten:** alle andere schermen. Ze zijn niet stuk — ze dragen hun
eigen bediening zoals ze die hadden — maar ze doen niet mee aan de contextzone.
Dat is de eerlijke stand: de laag staat er, de eerste afnemer bewijst hem, en de
rest is werk dat nog moet gebeuren. Wie een scherm aansluit, declareert zijn
capabilities en meldt zijn context; hij raakt `shared/adaptief/balk.js` niet aan.

## Handhaving

`test/adaptief.test.js` meet wat je niet ziet door te kijken: dat de vormgrens op
één plek staat, dat elke breedte in precies één vorm valt, dat `keur()` een
capability zonder telefoonvorm afkeurt, dat **elke declaratie in de hele bron** een
telefoonvorm noemt, dat geen presentatie dieper dan drie ligt, dat de aanraakmaat
uit de leer als token in het blad staat, en dat een verborgen zone ook echt weg is.
Bij elke toets staat de mutatie die hem hoort te laten zakken; alle zes zijn
gedraaid en zakten op precies één toets.

`test/adaptief.e2e.js` meet in een echte browser wat alleen een scherm kan zeggen:
dat de werelden in de balk staan, dat elk raakvlak 44 haalt, dat de balk binnen de
schermbreedte blijft, dat een selectie de balk verandert en een tik erop in het
werkblad aankomt, dat de lade de volledige lijst draagt en met Escape dichtgaat,
dat er nooit twee dominante lagen liggen, en dat de contextzone op een breed scherm
niet bestaat.

Wat hier **niet** machinaal gehandhaafd wordt, en dus op mensen berust: of de vier
handelingen die vooraan staan de juiste vier zijn. Dat blijft een keuze, en die
staat per afnemer in zijn eigen `VOORAAN`-tabel — zichtbaar, en op één plek.

Wat er ook niet is: een meting van hoeveel van de 184 schermen zijn aangesloten.
Zolang het er één is, is dat een lijst en geen teller.
