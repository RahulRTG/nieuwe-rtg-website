# MOVE.md -- RTG Move, de bewegingslaag

De naad tussen wat RTG organiseert en wat een mens daarna in de echte wereld
moet afleggen. `REIZEN.md` is het Travel OS eronder, `GRAMMATICA.md` en
`ADAPTIEF.md` zeggen hoe beweging op een scherm voelt, `LAT.md` hoe er
geschreven wordt.

---

## 0. De kern, in twee zinnen

> Een navigatie-app weet **waar** je heen wilt. RTG Move weet of je het
> **haalt** -- en wat er stroomafwaarts breekt als iets verschuift.

Daaruit volgt de enige functie die deze laag toevoegt:

> **Move is geen doos maar een naad.** Hij bezit niets, meet niets zelf en
> verzint niets. Hij legt één verband dat nergens bestond: dat tussen twee
> opeenvolgende reisonderdelen.

---

## 1. Dit was geen groen veld, en dat is hier het belangrijkste feit

De voorgestelde laag (Routing / Mobility / Places onder een Journey Graph) is
eerst **gemeten** in plaats van verklaard -- zelfde reden als bij `Asset` in
`DEVELOPERCLOUD.md` par. 2. Vijf van de zes bouwstenen stonden er al:

| Wat de visie vraagt | Wat er stond | Waar |
|---|---|---|
| de reis als één tijdlijn over de domeinen | een **projectie** die niets bezit, nooit schrijft en per bron eerlijk meldt als hij stilvalt | `kern/reiswereld.js` |
| routing van A naar B | de **multimodale planner**: etappes, kosten, overstappen, uitstoot | `kern/mobiliteit/reisplan.js` |
| plekken als één waarheid | een plek komt binnen als **verwijzing** (`{ zaak }`, `{ halte }`) en wordt daar opgelost | `kern/mobiliteit/plekken.js`, `kern/plaats/` |
| merken dat er iets speelt | de **Reiswacht**: momentopname, elke bron meldt zichzelf, juist als hij er niet is | `kern/reiswacht.js` |
| iets eraan doen | de **oplosser**: lezen mag, klaarzetten mag, uitvoeren blijft bij het domein | `kern/reisoplosser.js` |
| **het verband tussen twee onderdelen** | **niets** | -- |

Die laatste rij is gemeten en niet aangenomen: een zoekopdracht op
`haalbaar|krap|overstaptijd|marge` over de hele reis- en mobiliteitskern gaf
**nul** treffers, en de planner werd vanuit **geen enkele** reis aangeroepen.
Er hoefde dus niets afgebroken te worden -- alleen aangesloten.

---

## 2. De vorm: één naad, vijf uitkomsten

`kern/move/naad.js` rekent per overgang: wanneer kun je weg, wanneer moet je er
zijn, hoe lang duurt de beweging, en wat blijft er over. De uitkomsten zijn
**gesloten**, en "waarschijnlijk goed" zit er niet bij:

    GEEN_BEWEGING     zelfde plek; er valt niets af te leggen
    RUIM              marge boven de drempel
    KRAP              marge positief, onder de drempel
    ONHAALBAAR        de beweging past niet in de tijd
    NIET_TE_BEPALEN   een plek, een tijd of de reistijd ontbreekt

`kern/move/haalbaar.js` maakt daar het oordeel over de reis van: **de strengste
naad wint** en er wordt niet gemiddeld -- één onmogelijke overgang maakt de reis
onmogelijk. Zelfde vorm als de stand van een rij in `APPWERKT.json` en de drie
plafonds in `kern/livinglab/graden.js` waar het laagste wint.

---

## 3. Vijf grenzen die niet mogen sneuvelen

1. **Move bezit niets.** Geen eigen collectie, geen schrijfweg, geen tweede
   reisadministratie -- zelfde grens als `kern/reiswereld.js`.
   `test/move.test.js` toets 12 zakt zodra een van de drie modules `db.data` of
   `save()` aanraakt.
2. **Er komt geen bandbreedte en geen samengesteld cijfer.** "Verwachte aankomst
   19:14-19:35" leest krachtig en is verzonnen: een band vraagt spreiding, en
   die is hier nergens gemeten. Wat er wél staat is de marge, het oordeel en
   `nietGewogen`. Zelfde regel als `kern/kosten/vooruitblik.js` en INT-04. Ook
   geen haalbaarheidsscore van 0 tot 100: dat verbergt welke naad bewoog.
3. **Een onbekende naad is nooit een goede naad.** Ontbreekt een plek of een
   tijd, dan is de uitkomst `NIET_TE_BEPALEN` met de ontbrekende velden erbij --
   en de reis krijgt `oordeel: null` in plaats van stil groen. Naast elk oordeel
   staat de **dekking**: over welk deel van de overgangen Move iets kon zeggen.
4. **Een drempel die zich voordoet als meting is erger dan geen drempel.** De
   dertig minuten van `RUIM` zijn een huiskeuze en dragen `grond: 'huiskeuze'`
   in het antwoord.
5. **Move voert niets uit.** Elk voorstel komt terug met `uitgevoerd: false`,
   het domein dat het moet doen, en `bevestigt: 'een mens'`. Een transfer
   verzetten raakt een chauffeur en een reservering verzetten een restaurant:
   beide bereiken een **tweede persoon**, en dat gebeurt hier nooit automatisch
   (`LIFE.md` par. 4, `REIZEN.md` par. 4.5). Er is met opzet geen schrijfroute.

---

## 4. Wat het bouwen blootlegde

Drie stille fouten, alle drie gevonden door de laag op **echte** boekingen te
laten draaien in plaats van op een fixture:

1. **De tijdlijn gooide weg wat hij al wist.** `reiswereld-bronnen.js` haalde de
   leverancierscode op (`findSupplier`) en hield alleen de stadsnaam over; de
   duur van de dienst, die `routes/member/boeken.js` regel 40 al opslaat, ging
   dezelfde weg. Zonder plek en duur valt er geen enkele overgang te rekenen.
2. **Er was een derde waarheid over wanneer een boeking is.** Die bron filterde
   op `b.datum` en las `b.tijd` -- velden die op een boeking niet bestaan (die
   heet `wanneer`). Het filter was dus **altijd onwaar** en **geen enkele
   betaalde activiteit of afspraak kwam ooit op de reistijdlijn terecht**. Stil,
   want een bron die niets oplevert leest als "u hebt geen afspraken".
   `kern/agendatijd.js` bestond al precies hiervoor en waarschuwt in zijn eigen
   kop voor deze fout.
3. **De volgorde werd aangenomen.** De eerste volle ronde gaf
   `beschikbaarMin: -135` en een netjes onderbouwd `ONHAALBAAR`: Move rekende
   een overgang **terug in de tijd**, omdat `reiswereld.komend()` op zijn eigen
   rangorde sorteert en niet chronologisch. Het antwoord zag compleet uit, met
   een echte reistijd en een echte bron erbij -- de gevaarlijkste vorm van fout.
   Sorteren gebeurt nu in de module die bepaalt wat "opeenvolgend" betekent.

Daarnaast twee dingen die alleen een volle ronde kon vinden: `gevolg` las het
onderdeel uit de **ongesorteerde** rij (een voorstel aan het verkeerde adres,
volkomen geloofwaardig), en de soort die een echte boeking oplevert --
`afspraak` -- stond niet in de domeinkaart, waarmee juist het meest
voorkomende geval geen voorstel kreeg.

---

## 5. Wat er vandaag werkelijk uit komt

Gemeten op een wegwerpserver met twee **echte** betaalde boekingen (training
10:00-11:00 bij de ene zaak, massage 11:15 bij de andere):

    /api/move/reis        KRAP -- 15 min beschikbaar, 14 nodig, marge 1,
                          dekking 100%, bron: het eigen A*-wegennet
    /api/move/volgende    de massage, met de plek opgelost uit de zaakcode
    /api/move/gevolg +30  KRAP -> ONHAALBAAR, het juiste onderdeel geraakt,
                          voorstel klaargezet met uitgevoerd: false

Dat is de uitspraak die een reisadviseur vóór de verkoop wil: *deze planning is
niet betrouwbaar* -- gerekend uit echte gegevens door de echte motor.

---

## 6. Wat er niet is, met de reden

- **Eén van de zes bronnen levert een plek.** Activiteiten en afspraken bij een
  zaak wel; verblijven, reisbureau-reizen, vluchten, charters en eigen invoer
  dragen alleen een vrije tekst ("Barcelona"). Move meldt die als onbekend in
  plaats van een stadsnaam naar coördinaten te benaderen -- op zo'n marge wordt
  straks een reservering verzet. Elke bron die een verwijzing gaat meesturen,
  verhoogt de dekking zonder dat hier iets verandert.
- **Geen aankomsttijd van een vlucht.** Een vlucht draagt zijn vertrektijd; het
  moment waarop je het vliegveld verlaat is nergens bekend. Zolang dat zo is,
  is de naad ná een vlucht `NIET_TE_BEPALEN` -- en niet een geraden drie kwartier.
- **Geen achtergrondwachter.** Move rekent op het moment van opvragen, net als
  de Reiswacht. Een wachter die doorwerkt terwijl de app dicht is, is een eigen
  besluit met een eigen prijs en groeit hier niet stilletjes bij.
- **Geen Continue Key op het scherm.** `/api/move/volgende` levert de waarheid
  die zo'n toets nodig heeft; hem in de schil hangen is schermwerk en volgt.
