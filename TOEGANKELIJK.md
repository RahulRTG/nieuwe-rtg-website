# Wat een mens met een handicap hier wel en niet kan

Dit document staat naast de poorten en niet erin. `A11Y-INGELOGD.json` zegt wat
een machine kan meten; hier staat wat een **mens** tegenkomt, per soort barrière,
met de meting erbij en met de dingen die geen poort ooit zal zien.

De regel voor dit bestand is dezelfde als voor `BELOFTE.md`: **wat hier als
"kan" staat, is gemeten. Wat niet gemeten is, staat als niet gemeten.** Een
groene poort is geen bewijs dat iemand het kan.

Gemeten op **17 augustus 2026** over alle 259 schermen, ingelogd én uitgelogd,
op telefoonformaat (390x844).

---

## Wat er hard vaststaat, en wat het tegenhoudt

| poort | staat | wat hij tegenhoudt |
|---|---|---|
| contrast, drie staten | **0** van 262 | tekst die te bleek is om te lezen |
| structuur (alt, label, naam, taal, titel) | **0** van 262 | een knop of veld zonder naam |
| springlink | eerste tabstop op elk scherm met een schil | vijftien tabs door dezelfde balk, elk scherm opnieuw |
| ondertitels | 21 van 29 media-elementen geregeld; alle opgenomen vormen | video die je zonder geluid niet kunt volgen |
| raakvlak (24x24) | **0** van 262, in twee sessies | een knop die een trillende hand niet raakt |

Die vijf zakken de bouw als iemand ze breekt. `scripts/a11y.js` draait ze bij
elke push over alle schermen -- structuur en contrast in DRIE staten, het
raakvlak op telefoonformaat (390x844) in twee sessies; wie iets vindt, meet nog
een keer. `check.js` regel 49 doet het ondertitelregister.

**"Wie iets vindt, meet nog een keer" geldt sinds 23 augustus 2026 voor ALLE
ronden**, en niet meer alleen voor het raakvlak. Alleen daar stond hij, en
daardoor was de contrastronde niet streng maar onbetrouwbaar: twee volledige
scans op dezelfde code gaven twee uitkomsten, met dezelfde bevinding op een
ander scherm in een andere ronde -- en dezelfde pagina daarna twaalf keer op rij
gemeten gaf twaalf keer nul. De oorzaak is dat de keuring omhoog klimt tot een
ondoorzichtige achtergrond, en dat een pagina die zijn eigen grond nog niet
heeft geverfd er dus een leent van iets erboven. `scripts/a11y-hermeet.js`
draagt die tweede meting nu voor beide ronden. Dat verzwakt de poort niet: een
echte fout meldt zich in de tweede meting gewoon weer, en
`test/a11y-hermeet.e2e.js` houdt precies dat vast -- een blijvend te bleke regel
blijft staan, een grond die er een tel later niet meer is telt niet. Een poort
die af en toe zomaar rood wordt, leert mensen om hem te negeren.

**De derde staat is er sinds 23 augustus 2026, en waarom dat nodig was.** De scan
logde in met een lidmaatschapstoken. Alles achter een ZAAK-inlog -- de
horecaschermen, de kassa, het personeelsscherm, de leveranciers-app -- draagt een
ander token, en kreeg dus de DEUR te zien: een lege schil met een inlogkaart, die
netjes nul oplevert. "Nul over alle schermen" was waar voor de staat die gemeten
werd, en onwaar voor de staat waarin het personeel werkt. Dezelfde negen
horecaschermen gaven met een zaak-sessie 1 structurele en 15 contrastfouten.

Twee dingen kwamen daar bovenop, en ze horen erbij omdat ze dezelfde vorm hebben:
de scan draaide in deze omgeving HELEMAAL NIET (hij koos een Playwright waarvan
de Chromium ontbrak, en concludeerde daaruit "geen browser" met exitcode 0), en
hij draaide zonder demostand -- dus met lege lijsten, waar een leeg scherm per
definitie schoon meet. Beide zijn weg: de browserkeuze komt nu uit
`test/browser.js` (die probeert te STARTEN in plaats van te laden) en de
wegwerpserver draait in demostand. Samen brachten die drie dingen 27 raakvlakken
aan het licht die er altijd al waren.

## De instellingen die een lid zelf zet

`server/kern/toegankelijk.js` draagt er zes, en ze zijn er allemaal omdat de
GEDEELDE laag ze op elk scherm waarmaakt: tekstgrootte (twee stappen), hoog
contrast, zo min mogelijk beweging, links altijd onderstreept, één ding tegelijk,
en minder nadruk. Ze heten naar wat ze doen en niet naar een diagnose -- de kop
van dat bestand legt uit waarom er geen "ADHD-modus" in staat.

Wat er bewust NIET in staat: eenvoudige taal, schermlezer-teksten per scherm,
spraakbesturing. Die moeten per pagina gemaakt worden, en een schakelaar die ze
belooft zonder ze te bouwen is precies de leugen die LAT.md regel 6 beschrijft.

---

## Per mens: wat werkt, en waar het ophoudt

### Wie niet of slecht ziet

**Werkt:** elk formulierveld heeft een label, elke knop een naam, elke afbeelding
een alt (0 bevindingen over 259 schermen, in beide staten). De eerste Tab springt
naar de inhoud. Meldingen worden voorgelezen: sinds vandaag krijgt elke toast- en
statusplek `role="status"` uit de gedeelde laag -- daarvoor waren er 46 op 42
schermen die in stilte verschenen.

**Houdt op bij:** audiodescriptie. Een video vertelt dingen in beeld die niet
worden uitgesproken, en dit huis heeft geen spoor om die te beschrijven. Dat is
niet gebouwd en het staat nergens als schakelaar -- zie het ondertitelregister,
waar hetzelfde onderscheid staat.

**Niet gemeten:** of de alt-teksten KLOPPEN. Een scanner ziet dat er een alt
staat, niet of hij zegt wat er te zien is. Dat kan alleen een mens.

### Wie doof is of slechthoort

**Werkt:** opgenomen video in het Theater en de Media OS draagt sinds vandaag een
ondertitelspoor dat de maker zelf schrijft; een clip had dat al, en de drie
spelers gebruiken dezelfde band. De feed laat zien wat ondertiteld is.

**Sinds 24 augustus loopt er een TEKSTBAAN mee door alle zes de gesprekken.**
Videogesprek, gezinsgesprek, bellen met een vriend, de vergaderkamer, de
teamcall en het schoolgesprek dragen `shared/meelezen.js`: een baan onder het
gesprek waarin deelnemers meeschrijven en die bij iedereen live meeloopt. Wie
doof is kan daarmee het gesprek volgen en eraan meedoen -- lezen wat er getypt
wordt, en zelf typen. Bij het schoolgesprek weegt dat het zwaarst, want dat is
alleen geluid: daar valt niet eens van te liplezen.

**Dat is GEEN ondertiteling, en dit register mag daar niet voor worden
opgepoetst.** Er wordt niets van spraak naar tekst omgezet: wat in de baan staat,
staat er omdat een mens het heeft getypt. WCAG 1.2.4 is dus niet gehaald, en de
acht tellen in de keuring gewoon door als open. Wat er wel is veranderd, is
waar de afhankelijkheid ligt: van "kan niet meedoen" naar "kan meedoen als de
anderen meetypen". Dat is minder dan ondertiteling en meer dan niets, en die twee
zinnen horen allebei te staan.

**Waarom er geen automatische ondertiteling in zit is een BESLUIT.**
Spraakherkenning in de browser stuurt het geluid van het gesprek naar een server
van de leverancier, en dit huis draait op codenamen met de echte namen in een
aparte kluis -- het gesprek van twee leden naar buiten sturen om er tekst van te
maken is precies wat dat ontwerp voorkomt. De weg die hier wel past loopt langs
een lokaal model (`LOCAL_AI_URL`), en dat is een inrichtingskeuze. De naad
daarvoor ligt klaar en neemt niets aan: een regel met bron `machine` komt in
dezelfde baan en staat er zichtbaar als machinetekst bij, want tekst die een
machine heeft geraden is iets anders dan tekst die iemand heeft geschreven.

**De twee uitzendingen staan er anders voor, en die twee verschillen onderling.**
Het Podium heeft al een tekstbaan: de kanaalchat naast de uitzending, met
`aria-live`, waarin de uitzender kan meeschrijven. Het SOS-scherm heeft er geen.
Dat is de eerlijke stand en niet een gat dat nog even gedicht wordt: **wie doof
is kan geen SOS-dienst draaien**, want daar komt het geluid van een lid in nood
binnen en er is niets dat het opschrijft. Een noodscherm is niet de plek om er
ongevraagd iets bij te zetten; dat is een besluit dat RTG neemt.

De keuring houdt dit vast en niet alleen dit document: een gesprek dat de
tekstbaan verliest, laat `npm run check` regel 49 zakken -- gemeten door hem uit
het schoolgesprek te halen en de keuring te zien klagen.

Wat hier eerst stond als "ook open" -- een spraakbericht in de teamchat zonder
tekstversie -- bleek bij het narekenen geen gat maar DOOD HOUT. De speler stond
in de code achter een veld `m.audio`, en niets in dit huis schrijft dat veld ooit:
de route neemt alleen tekst aan en geen enkele aanroeper stuurt iets anders. Het
was dus een knop voor een functie die niet bestaat. Weggehaald in plaats van
beschreven; het register telt nu 29 media-elementen in plaats van 30.

**Daarmee zijn ALLE opgenomen vormen gedekt.** Wat als open overblijft, is
uitsluitend live.

### Wie een motorische beperking heeft

**Werkt:** alles is met het toetsenbord te bedienen, inclusief de wereldklok --
die heeft pijltjes, Escape en een sneltoets naast het draaien met een vinger
(`shared/wereld/wereld-03.js`). Focus is altijd zichtbaar: de gedeelde laag zet
een `:focus-visible`-rand op elk scherm. Een open venster sluit sinds vandaag de
rest van de pagina af met `inert`, zodat je er niet meer uit tabt zonder het te
merken -- gemeten op app.html: dertien focusbare elementen stonden buiten het
venster open, nu nul. En als het venster dichtgaat, geeft die laag de focus terug
aan de knop waar hij vandaan kwam.

Dat laatste stond er niet meteen, en het staat hier omdat het iets zegt over de
grens van de poort. Diezelfde maatregel brak drie schermtoetsen: het loslaten van
`inert` wachtte een frame, waardoor een pagina die zelf de focus terugzette hem op
een inert element zette; en de laag nam het EERSTE venster in de boom in plaats
van het laatste, waardoor een nieuwer venster dat er bovenop opende zelf werd
afgesloten -- zichtbaar, en niet aan te klikken. De a11y-poort bleef al die tijd
groen. **Een poort die meet of een scherm toegankelijk is, meet niet of het nog
werkt.** Alleen de gewone schermtoetsen zagen dit.

**Werkt ook: elk raakvlak is minstens 24x24** (WCAG 2.5.8), gemeten op
telefoonformaat. De meting begon op 267 stuks over 188 schermen en staat nu op
nul, met een poort eronder die zakt zodra er een bijkomt.

Twee oorzaken droegen het leeuwendeel. De home-indicator van de iOS-schil stond
op 150x22 -- twee pixels te laag, op elk scherm dat de schil laadt (146
gevallen). En op 22 schermen zet `ios.js` die pil neer terwijl het scherm
`ios.css` NIET laadt: zonder stijl krimpt een lege knop tot zijn inhoud, 4x4 op
comm.html en 16x6 op geld.html. Onzichtbaar, onraakbaar, en tóch in de
tabvolgorde met de naam "Omhoog vegen brengt je naar de homescreen". De
component brengt zijn maat nu zelf mee, en dat geldt sinds vandaag ook voor de
acties rechtsboven in diezelfde balk en voor de microfoonknop.

De staart van 82 daarna was géén gedeeld patroon maar een reeks losse gevallen,
en die zijn per scherm gedaan: kaartkoppen, terugwegen, twee rijen
navigatielinks, zes kale aanvinkvakjes van 13x13, de knoppen in de
Command-modus-schermen, en zes links die in hun eentje een alinea vullen. Wat er
NIET is gebeurd: een blinde `min-height` over alles heen. De ene keer dat ik in
de buurt daarvan kwam -- padding op de gedeelde `.terug` -- overschreef die
meteen de padding van `residentie.html`, dat zijn terugknop al netjes had staan,
en kwam die terug op 13x27. Sindsdien staat er in de gedeelde regels alleen
`min-height`/`min-width`: dat kan een pagina niet overrulen, alleen te kleine
dingen groter maken.

**Twee van de 82 bleken geen maatprobleem maar een defect**, en dat is het beste
argument voor deze ronde. Op `pay.html` heetten de drie hoofdknoppen
`.knop.merk`, terwijl `rtg-ui.css` `.merk` gebruikt voor een statuslabel -- die
selector is specifieker, dus de betaalknop rendeerde als badge van 9,9px
hoofdletters in een pilletje van 19 hoog in plaats van een schermbrede bordeaux
knop. En `muziek.html` en `camera.html` laadden `spraak.js` met `defer` terwijl
het script eronder tijdens het parsen `if (window.Spraak)` doet: die voorwaarde
was altijd onwaar, dus de microfoonknop is daar nooit gekoppeld geweest. Hij
stond er als lege knop van 0x0 -- onzichtbaar, onraakbaar, en wel in de
tabvolgorde met de naam "Spraaksturing: zeg wat u wilt horen".

### Wie moeite heeft met drukte, taal of geheugen

**Werkt:** "één ding tegelijk" splitst elke app op in delen met een menu erboven.
"Minder nadruk" haalt de kleur en de dikke randen eruit. "Zo min mogelijk
beweging" zet alle animatie stil, en dat gebeurt ook vanzelf bij
`prefers-reduced-motion`. Er is geen oneindige scroll, geen autoplay en geen
kunstmatige urgentie -- dat staat als merkregel in CLAUDE.md en niet als
instelling.

**Houdt op bij:** eenvoudige taal. De teksten in dit huis zijn geschreven in drie
tonen (per pas), niet op taalniveau B1. Er is geen tweede tekstlaag en geen
schakelaar die er een belooft.

**Niet gemeten:** of iemand een taak ook echt AFMAAKT. Dit huis telt geen
mislukte pogingen per scherm. Zolang dat er niet is, weten we van geen enkel
scherm of het te begrijpen valt -- alleen dat het te bedienen valt.

---

## De grens van de meting zelf

De a11y-scan bekijkt elk scherm 600 ms na het laden, in **één toestand van de
data**. Kleuren en knoppen die van gegevens afhangen kunnen daardoor tussen
ronden verschijnen en verdwijnen. Dat is geen theorie: `stad.html` kleurde een
waarde alleen bordeaux als een domein op dat moment druk was, en die bevinding
ontbrak in een gerichte meting terwijl hij er wel degelijk was.

De raakvlakronde heeft daar één ding aan toegevoegd dat de andere twee nog niet
doen: **wie iets vindt, meet nog een keer**. Hij meldde `zorgbalie.html` voor een
knop van precies 24 pixels, en die knop klopte -- de pagina stond 600 ms na het
laden nog midden in een schaal-animatie op 99,827%, en dan meet 24 er 23,96. Een
meting die niet wacht, meet een moment.

Wachten tot álle animaties uit zijn was de eerste reparatie, en die was om een
andere reden fout: op de meeste schermen loopt er altijd iets (de wereldklok
tikt), dus liep bijna elke pagina tegen de tijdgrens aan. Een tweede meting kost
alleen iets op de schermen die iets vinden -- en een scherm dat permanent
geschaald is, meldt zich dan gewoon weer.

Een groene ronde is dus een sterk signaal en geen bewijs voor elke toestand. Wie
deze poort scherper wil: geef de ingelogde ronde een vaste, geseede dataset.

En het grootste gat is per definitie niet te tellen: **er is nog nooit iemand met
een handicap door dit huis gelopen.** Alles hierboven is gemeten met een browser.
Een half uur met een echte schermlezergebruiker vindt dingen die geen scanner
kent, en dat half uur heeft niemand hier gehad.
