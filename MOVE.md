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

- **Twee van de zes bronnen leveren geen plek**, en dat blijft zo tot het
  domein er een meestuurt. Het reisbureau draagt een bestemming als vrije tekst
  ("Barcelona") en geen zaak; de Invoerbalie leest uit een document of een foto
  en kent per definitie geen zaakcode. Move meldt die naad als
  `NIET_TE_BEPALEN` met `plek-naar` in de mist-lijst, in plaats van een
  stadsnaam naar coördinaten te benaderen -- op zo'n marge wordt straks een
  reservering verzet. Het hotel dat het reisbureau boekt *is* een zaak, dus die
  bron kan de dekking verhogen zonder dat er in Move iets verandert; dat is werk
  in het reisbureau en niet hier.
- **Een verblijf levert een plek maar geen tijd.** Het hotel is een zaak en die
  code stond al op het verblijf, dus de plek is bekend. Een verblijf draagt
  alleen een aankomst*datum* en geen uur, dus de naad ernaartoe blijft
  `NIET_TE_BEPALEN` -- met een kortere `mist`-lijst. Een standaard check-in van
  15:00 erbij verzinnen zou de marge een gok maken.
- **Voor een vlucht is de plek de luchthaven en niet de bestemming.** Dat is
  geen benadering maar een ander gegeven: u moet op de luchthaven zijn, en het
  vliegtuig brengt u naar Parijs. Bij elk ander onderdeel vallen "waar ga ik
  heen" en "waar moet ik zijn" samen; hier niet. De code komt uit
  `kern/luchthaven` (`lucht.plek()`) en niet uit een letterlijke `'LUCHT'` in de
  reiswereld. Geen luchthaven in de database, of een zaak zonder punt op de
  kaart: dan is er geen plek, en zegt Move dat.
- **Geen moment waarop je het vliegveld UIT bent.** Een aankomende vlucht draagt
  wel zijn aankomsttijd op RTG Airport, dus de naad *naartoe* is te rekenen. Wat
  nergens bekend is, is wanneer je er weg kunt: bagage, douane en de weg naar de
  uitgang. Daarom krijgt een vlucht geen `klaarAt` en blijft de naad *ná* een
  vlucht `NIET_TE_BEPALEN` -- en niet een geraden drie kwartier.

  **Dat stond hier eerder ook al, en de code deed het niet.** `Number(null)` is
  `0` en `0 >= 0` is waar, dus kreeg élk onderdeel zonder bekende duur
  `klaarAt === nodigAt`: *"u kunt weg op het moment dat u er moet zijn"*. Voor
  een vlucht, een charter, een verblijf en eigen invoer -- de meerderheid van de
  reis -- gold dat dus. Het gevolg was geen ontbrekend getal maar een **verkeerd
  getal met een compleet ogende onderbouwing**: een charter van 18:10 met een
  diner om 19:00 gaf *"50 min beschikbaar, 17 nodig, marge 33 -- RUIM"*. De fout
  was onzichtbaar zolang vluchten geen plek hadden: de naad sneuvelde toch al op
  `plek-van`. Hij kwam pas boven toen de dekking omhoog ging, en dat is het
  patroon om te onthouden -- een gebrek dat door een ánder gebrek wordt gedekt,
  komt pas los als je dat andere repareert.

- **Een onderbalk die later verschijnt, wordt door de cookiemelding bedekt.** In
  `/apps/move.html` opgelost (de balk houdt zijn hoogte én is aanraakbaar), maar
  de oorzaak zit in de gedeelde component en geldt dus breder:
  `shared/cookie/cookie-02.js` zoekt met `elementsFromPoint` wat er achter haar
  ligt, en dat slaat `pointer-events:none` en `visibility:hidden` over. Zij
  meet één keer bij het laden en één frame later; haar `MutationObserver`
  hermeet alleen de inkt. Elk ander scherm met een primaire actie die
  asynchroon verschijnt, heeft daarmee een knop die niemand kan indrukken --
  gemeten in een browser: 60 klikpogingen, *"#rtg-cookie intercepts pointer
  events"*. Dat is niet in deze tak opgelost: het raakt 313 schermen en hoort
  een eigen ronde met een eigen proef.
- **EEN NIEUW SCHERM MOET OP VIER PLEKKEN WORDEN INGESCHREVEN, en de keuring
  zegt er niets over.** `/apps/move.html` stond in `MAPPEN` (de bank) en werkte,
  maar niet in `server/kern/wereldroutes/life.js` (wie bezit deze functie),
  niet in `public/shared/rtg-world-identity.js` (welke vaste kamer en welk
  materiaal) en het laadde het Heritage-blad niet. `npm run check` bleef
  "Alles in orde" zeggen; negen TOETSEN zakten, verspreid over vier bestanden,
  met meldingen die er alle negen anders uitzagen ("mist zijn vaste wereld",
  "kiest een ongeoorloofde materiaalvariant", "de appboom hoort 303
  HTML-bestanden te bevatten"). Dat is nu gerepareerd, en de les is de
  vindplaats: `npm run heritage:controle` noemt het achterlopende scherm bij
  naam, en de twee registers zijn met de hand bij te werken. Wie een scherm
  toevoegt, draait die controle -- de statische keuring vangt dit niet.

- **Geen achtergrondwachter.** Move rekent op het moment van opvragen, net als
  de Reiswacht. Een wachter die doorwerkt terwijl de app dicht is, is een eigen
  besluit met een eigen prijs en groeit hier niet stilletjes bij.
- **De Continue Key hangt niet in de schilbalk.** `/apps/move.html` doet zijn
  WERK -- de volgende plek als label, en erheen brengen -- maar niet met de
  component. `shared/rtg-continue-key.*` hoort bij het Edge 2-systeem van de
  schil: een 44px-cirkel die opengaat tot een capsule, met eigen
  materiaalvariabelen. Geen enkel routescherm draagt hem, en keuring 58 zegt
  waarom dat klopt: route-inhoud blijft `0` en een afgeronde systeemlaag komt
  alleen uit de centrale Heritage-CSS. Hem in de schilbalk hangen is schilwerk
  en volgt.
