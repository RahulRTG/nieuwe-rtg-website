# De softwaremarkt — de winkelkant van de App Store

`APPSTORE.md` beschrijft de POORT en de CEL: hoe code van buiten binnenkomt en
wat zij daarna niet kan. Dit document gaat over de andere helft, en die is niet
minder: **wat een mens ervaart wanneer hij hier software toevoegt.**

Het is een richtingsdocument zoals `PLATFORM.md` en `DEVELOPERCLOUD.md`. Per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is — zodat niemand die vier voor elkaar aanziet.

## Het principe

> **Een app krijgt bij RTG geen toegang. Een app krijgt een afgebakende ruimte om
> iets voor u te doen.**

Daar volgt de winkel uit, en niet andersom. Een etalage met sterren en een
downloadknop verkoopt apps; deze verkoopt een vertrouwensmodel. Wat er te zien
is, is dus niet hoe populair iets is maar hoe ver het komt.

## 1. Wat er al staat, en wat daaraan ontbreekt

De feiten die zo'n winkel nodig heeft, liggen er grotendeels al. Wat ontbreekt is
bijna nergens de meting en bijna overal de PRESENTATIE.

| gevraagd | stand | waar het vandaan komt |
|---|---|---|
| doel, ruimte, bruggen, grenzen, herkomst per app | **staat** | `kern/appstore/etalage.js` (`kaart`), `dossier.js`, `dossier-grenzen.js` |
| "wat deze app nooit krijgt", met bron per bewering | **staat** | `dossier-grenzen.js` — vier velden per regel: claim, hoe, bron, waarde |
| contract-diff bij een update | **staat** | `etalage.js` (`diff`), en de mens ziet dezelfde vergelijking (`tovLive`) |
| bewijskaart: keuring, toegankelijkheid, omvang, hash | **staat** | `toegankelijk.js`, `bundel.js` (`maten`), `besluit.js` |
| geen sterren, geen ranglijst | **staat** | met de reden in de kop van `etalage.js` |
| first-party onder dezelfde celgrenzen | **staat** | grens 1 kent geen vertrouwde uitgever en geen vlag |
| bereikklasse per app (Zero Reach e.d.) | **staat sinds vandaag** | `kern/appstore/bereik.js` — zie hieronder |
| celkader met celnaam en kanaalfeiten | **staat sinds vandaag** | `uitgifte.js` (`celnaam`), `public/apps/appcel.html` |
| softwarepaspoort op de winkelkaart | **staat sinds vandaag** | `kern/appstore/paspoort.js`, getoond in `mall.html` |
| "krijgt niets anders" onder de vinkjes | **staat sinds vandaag** | `mall.html`, storeKaart |
| drie universa (Essentials, Play, Makers) | **staat** | `kern/appstore/universa.js`, afgeleid uit uitgever en arena -- geen manifestveld |
| spellen met een eigen arena | **staat** | `kern/appstore/arena.js`; Sudoku, Tetris en Sneek staan in `storeapps/` |
| tijdelijke cel (voor deze reis) | **staat** | `kern/appstore/tijdelijk.js` + `opruim.js`: einddatum van het LID, en "vernietig de cel" zegt wat er verdwijnt |
| Foundry-meters tijdens het bouwen | **een stap weg** | de proefkeuring geeft de getallen al terug (`versies.js`, `proef`) |
| INSTANT-label | **een besluit** | alleen als het GEMETEN is, zoals `scripts/tikken.js` — nooit als claim |
| minimum context invocation | **staat** | `kern/appstore/context.js`: zeven velden, eenmalig, en het lid bevestigt per handeling |
| private store voor een organisatie | **jaren weg** | vraagt eerst het tenantbestuur uit `TENANT.md` |

## 2. Waarom "Zero Reach" per app een leugen zou zijn

Dit is de duurste fout die in het voorstel zat, en hij is voorkomen door hem te
rekenen in plaats van te zetten.

Netwerk is in dit kanaal **geen eigenschap van een app maar van de uitvoering**:
`connect-src 'none'` staat op de celroute en geldt voor alle apps tegelijk. Een
badge die op de ene app wél en op de andere niet staat, zegt daarmee iets wat
niet waar is — hij suggereert dat er apps zijn die het internet wél bereiken.
Een keurmerk dat overal geldt, onderscheidt niets; een keurmerk dat lijkt te
onderscheiden terwijl het dat niet doet, is erger dan geen.

Wat per app wél verschilt is het aantal **bruggen**. Daarom klasseert
`kern/appstore/bereik.js` dat, in vier standen die uit de machtigingen worden
GEREKEND:

| klasse | wanneer |
|---|---|
| **zonder bereik** | de app vraagt niets |
| **eigen potje** | alleen `opslag.eigen` |
| **kent uw codenaam** | `profiel.basis` erbij |
| **kan een bericht klaarzetten** | `bericht.klaarzetten` erbij — de enige die buiten de app iets achterlaat |

Drie dingen die daar niet mogen sneuvelen:

1. **Er is geen veld waarmee een uitgever dit zet.** Het manifest weigert een
   onbekende sleutel, dus `bereik: "zonder-bereik"` in een inzending is een
   fout met een naam erin. Een keurmerk dat een partij over zichzelf kan
   uitspreken, is een verkooppraatje (COMMERCIE.md, `claims.poort`).
2. **Een onbekende machtiging valt naar de ZWAARSTE klasse.** Een bevoegdheid die
   niemand kent, mag nooit als "geen bereik" langskomen; dat is exact het gat
   waar zo'n classificatie doorheen lekt.
3. **De kanaalfeiten staan ernaast en niet erin** — geen netwerk, geen sensoren,
   geen andere app — elk met de plek waar het wordt afgedwongen. Dat is de zin
   die de winkel draagt, en hij hoort bij het KANAAL en bij elke app tegelijk.

De klasse wordt twee keer gerekend en nooit één keer: wat het manifest VRAAGT en
wat dit lid heeft VERLEEND (`vraagtBereik` en `verleendBereik` in `etalage.js`).
Die twee door elkaar halen is grens 4.

## 3. Minimum context invocation — gebouwd, en waar de streep ligt

De sterkste gedachte uit het voorstel, en de enige die een grens raakt:

> RTG bepaalt niet wat een app allemaal mág zien. RTG bepaalt wat de app voor
> deze handeling minimaal móét krijgen.

Vandaag krijgt een cel niets mee. Wil je "€184,50 inclusief 21%" naar de
rekenmachine sturen, dan gaat er voor het eerst iets van RTG's kant naar binnen
zonder dat het een machtiging is. Dat is geen brug (de app vraagt niets) en geen
machtiging (het lid verleent niets duurzaams) — het is een **derde vorm**, en
`APPSTORE.md` zegt dat er geen zevende begrip bij komt.

De uitweg die dat niet breekt: het is geen begrip maar een **eigenschap van de
opening**. De cel wordt geopend met een handelingswaarde die (a) door het lid
zelf is uitgesproken, (b) zichtbaar is op het scherm vóórdat de app opent, (c)
niets bevat wat het lid niet zelf typte, en (d) niet wordt bewaard. Zodra er
iets in mag komen dat RTG zelf heeft opgezocht — een reisprofiel, een bedrag uit
de boekhouding — is het wél een brug en hoort het door de machtigingenlaag.

**Besloten op 31 augustus 2026: ook wat RTG zelf opzoekt mag mee, en het lid
bevestigt per handeling.** Dat is de ruimere kant van de streep, en daarom is de
laag strenger gebouwd dan een openingseigenschap:

- **Zeven velden, gesloten lijst** (`kern/appstore/context.js`): bedrag,
  btw-tarief, bestemming, aantal dagen, aantal personen, datum, tot en met. Elk
  veld draagt een wereld en een uitleg die een lid leest; een veld erbij is een
  besluit. Een onbekend veld is een fout en wordt niet genegeerd.
- **Nooit een identificator.** Wat op een e-mailadres, telefoonnummer of iban
  lijkt, wordt geweigerd -- ook in een tekstveld als `bestemming`. Deze weg
  draagt alleen waarden waarmee niemand te vinden is.
- **Eenmalig, een kwartier geldig, aan een lid en aan een app.** Een id in het
  adres en de waarden op de server: zou de waarde in de URL staan, dan is een
  gedeeld webadres een gedeelde overdracht.
- **Bevestigen doet de mens, per handeling.** Er is met opzet geen machtiging die
  dit een keer aanzet -- `test/appstore-context.test.js` toets 8 zakt zodra er
  een machtiging bijkomt die erop lijkt. De kaart staat OVER de app en toont elke
  waarde voluit; "niet doorgeven" laat de app gewoon leeg beginnen.

## 3a. De eerste eigen app staat er, en hij kreeg geen streepje voor

`storeapps/rekenmachine/` is de rekenmachine uit RTG Gereedschap als bundel:
13,3 kB in drie bestanden, waarvan 9,2 kB script (het budget is 2 MB en 300 kB).
Hij ging langs dezelfde weg als een derde -- inzenden, machinepoort,
toegankelijkheidskeuring, een mens die aftekent -- en `test/appstore-eersteapps.test.js`
houdt vol dat elke bundel in `storeapps/` dat blijft halen, mét de echte
virusscanner: zonder scanner gaat de poort dicht, en een toets die dat omzeilt
toetst de poort niet.

Twee dingen die die eerste app liet zien en die geen enkel document had
opgeleverd:

1. **Het kader vulde de cel niet.** Het iframe begon 69 px lager dan de cel en
   liep er onderaan evenveel uit, omdat de schil van het huis eigen rijen om de
   kop zet. De onderste regel van elke app viel dus buiten beeld. Gemeten met een
   echte browser, niet vermoed.
2. **Een app hoeft zijn eigen naam niet te dragen.** De cel noemt de app, de
   uitgever en de versie al; de bundel deed het nog eens, en dat kostte op een
   telefoon een schermhoogte. Een app in een cel begint bij zijn eerste handeling.

## 3b. De arena per game, en wat die kostte

Besloten: storeversies van spellen bewaren wel degelijk een score, met de
bestaande 18+-progressie erachter. Dat is de eerste keer dat er via de brug iets
naar buiten gaat dat een ANDER lid ziet, en dat vroeg drie dingen:

1. **Een bord per app, nooit dat van het huis.** Een derde stuurt het getal in;
   een gedeelde ranglijst zou daarmee zo betrouwbaar zijn als de minst
   betrouwbare app erin. Een app die verdwijnt, neemt zijn bord mee.
2. **De 18+-poort wordt doorgegeven, niet nagebouwd.** `kern/spellen/grens.js`
   stond alleen in de spellenlaag; hij is nu een eigenschap van de kern
   (`kern.volwassen`), want twee leeftijdsregels in een huis is er een te veel.
   Een vers geregistreerd lid haalt hem NIET -- dat is de standaard, en
   `test/appstore-arena.test.js` toets 1 zakt zodra dat verandert.
3. **De richting staat in het manifest.** Wint de hoogste of de laagste? Zou een
   app dat per aanroep meesturen, dan draait hij het bord om zodra hij verliest.
   Nu gaat het door de keuring en tekent een mens het af.

Wat er eerlijk bij hoort: de score van een spel in een cel is een **bewering van
die app**, geen meting van RTG. De Sudoku van het huis rekent op de server juist
om die reden -- en in een cel kan dat niet, want een cel heeft geen netwerk. Het
staat in de kop van elke bundel, zodat niemand het later voor bewijs aanziet.

## 4. Wat er bewust niet komt

- **Geen score.** Geen "98/100 securityscore", geen samengesteld cijfer over de
  bewijskaart. `BEWIJSMACHINE.md` legt uit waarom: één getal boven eerlijke
  losse meters verbergt welke ervan bewoog, en LAT-regel 11 verbiedt het groen
  dat uit optellen ontstaat.
- **Geen INSTANT-label zonder meting.** Het idee is goed en de norm is scherp;
  maar een label dat niet uit een echte meting komt, is precies de klasse fout
  die `scripts/tikken.js` bestaat om te voorkomen.
- **Geen aparte behandeling voor RTG's eigen apps.** Niet omdat het niet mag,
  maar omdat het niet kán: grens 1 kent geen vertrouwde uitgever.
- **Geen naamsbesluit hier.** RTG Atelier, RTG Objects of RTG Store met de zin
  eronder is een merkkeuze en geen architectuurkeuze; hij hoort van de eigenaar
  te komen en niet uit een bestand.
