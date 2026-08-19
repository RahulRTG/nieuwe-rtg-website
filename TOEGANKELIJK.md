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
| contrast, beide staten | **0** van 259 | tekst die te bleek is om te lezen |
| structuur (alt, label, naam, taal, titel) | **0** van 259 | een knop of veld zonder naam |
| springlink | eerste tabstop op elk scherm met een schil | vijftien tabs door dezelfde balk, elk scherm opnieuw |
| ondertitels | 21 van 29 media-elementen geregeld; alle opgenomen vormen | video die je zonder geluid niet kunt volgen |
| raakvlak (24x24) | **0** van 259, op telefoonformaat | een knop die een trillende hand niet raakt |
| past op een telefoon | **0** te breed, **0** leeg | een scherm waarvan de rechterhelft weg is, of dat niets toont |
| duimbereik | **0** buiten bereik, per hand gemeten over 89 aangewezen hoofdhandelingen | de belangrijkste knop op de plek waar jouw duim niet komt |

Die zeven zakken de bouw als iemand ze breekt. `scripts/a11y.js` draait ze bij
elke push over alle schermen -- structuur en contrast in twee staten, het
raakvlak in een derde ronde op telefoonformaat (390x844, ingelogd; wie iets
vindt, meet nog een keer), en breedte plus duimbereik in een vierde die TWEE
keer draait: een keer rechtshandig en een keer linkshandig, want de duimboog van
een linkshandige is het spiegelbeeld (`ADAPTIEF.md`). `check.js` regel 49 doet
het ondertitelregister.

### Een nul die niemand gemeten had

Dit hoort erbij, want het raakt hoe je de tabel hierboven moet lezen. Tot 19
augustus 2026 zocht `scripts/a11y.js` zijn browser met een eigen lader, en die
kwam uit op een Playwright waarvan de chromium **niet bestond** (1234, terwijl er
1194 stond). Het pakket laadt in dat geval gewoon; alleen de browser ontbreekt.
De scan doet dan wat hij hoort te doen op een kale CI — *"geen browser, scan
overgeslagen"*, met exitcode 0.

Gevolg: hier draaide hij niet, terwijl dit document en `A11Y-INGELOGD.json` een
**nul** meldden. Die nul was per ongeluk waar — de scan is op 19 augustus voor
het eerst met een echte browser gedraaid en kwam op precies dezelfde uitkomst —
maar dat wisten we niet toen we hem opschreven, en dat is het verschil tussen
een meting en een aanname (`LAT.md` regel 9).

Wat er is veranderd: de vindwijze staat nu op één plek (`scripts/lib/scherm.js`,
gedeeld met `test/helper.js`) en de scan **drukt af waarmee hij gemeten heeft**,
zodat "overgeslagen" nooit meer op stilte lijkt.

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

**Houdt op bij: de acht live vormen.** Zes gesprekken (videogesprek,
gezinsgesprek, bellen met een vriend, de vergaderkamer, de teamcall, het
schoolgesprek) en twee uitzendingen (het Podium, en het SOS-beeld van een lid
naar het kantoor). Een `<track>` kan daar niet bestaan, want het beeld ontstaat
nu. Wat er hoort is spraak-naar-tekst tijdens het gesprek, en dat bestaat hier
niet. **Dit is een besluit en geen taak**: zolang het niet genomen is, kan een
dove deelnemer niet meedoen aan een gesprek in dit huis, en dat hoort zo hard te
staan.

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

**En werkt ook: het scherm past, en de belangrijkste knop ligt onder je duim.**
Dat is een tweede laag boven 24x24, en het onderscheid is de moeite waard:
24 pixels is de ondergrens om iets te kunnen RAKEN met een hand die trilt, 44 is
wat een duim in beweging nodig heeft — in een trein, lopend, met één hand.
`GRAMMATICA.md` belooft het eerste van die twee met zoveel woorden: *"ik wil iets
doen → mijn duim vindt het onderaan."*

De ronde begon op elf schermen die op 390px rechts buiten beeld liepen (tot
1289px, zonder mogelijkheid ernaartoe te scrollen) en negentien met de
hoofdhandeling te klein of buiten bereik. Beide staan nu op nul.

Eén ding daaraan is nieuw en niet vanzelfsprekend: **het bereik wordt per hand
gemeten**. Acht schermen hadden hun hoofdhandeling in het kwart waar de duim
niet komt — en *welke* acht dat waren, verschilde tussen een linkshandige en een
rechtshandige. Een scherm dat alleen voor rechtshandigen klopt, is niet af.

**Wat hier NOG NIET staat**, en het is de grootste post: van de 254 schermen
wijzen er **89** hun hoofdhandeling aan (bij het openen van deze ronde waren het
er 18). De conventie bestaat (`data-hoofdactie`, `GRAMMATICA.md`) en de poort
meet wat gedeclareerd is; de overige 165 zijn niet gemeten op duimbereik omdat
er niets te meten valt — een lijst, een cockpit of een dagbriefing heeft niet
één handeling die eruit springt. Dat is geen fout die verborgen wordt — het
getal staat in `A11Y-INGELOGD.json` — maar het is wel de eerlijke maat van hoe
ver dit is.

**En één blinde vlek is er tussenuit gekomen die geen enkele teller liet zien.**
De keuring logde in met een RTG-lidmaatschap, en de RTF-leerling- en
gezinsschermen hangen achter een tweede deur die daar los van staat
(`apps/foundation/sessie.js`). Vijfenvijftig schermen — 22% van dit huis — zijn
dus rondenlang gemeten als "gaat open, past, geen hoofdhandeling", terwijl er in
werkelijkheid een slot in beeld stond. De keuring maakt nu ook een gezin met een
profiel aan. Meteen daarna kwam er een echt gebrek achter vandaan dat er al die
tijd stond: het tegelraster van `/apps/foundation/index.html` liep 353 pixels
buiten beeld. **Een scherm dat je nooit open hebt zien gaan, heb je niet
gemeten** — en het stond wel als gemeten in dit document.

Na die reparatie blijven er **drie** dicht, en die staan hier met naam in plaats
van weggewerkt:

| scherm | wat de deur vraagt | staat het nu |
|---|---|---|
| `/apps/foundation/campus.html` | een leerlingprofiel mét geboortedatum, niet het gezinsprofiel | **open** — de ronde maakt er een aan en zet dat token alleen voor dit scherm klaar |
| `/apps/foundation/bord.html` | een tijdelijke schoolpas: een klassleutel die alleen in de tab van een lopende les bestaat en na dertig minuten vervalt | **dicht** |
| `/apps/foundation/schrift.html` | dezelfde schoolpas, aan de leerlingkant | **dicht** |

Die laatste twee zijn niet aan te maken zonder een les te starten, en dat vraagt
een model achter `/api/les/maak`. Ze worden dus aan hun deur gemeten. Dat is
geen nul en geen groen: **het is één regel, en die staat er.**

**En één soort gebrek zag geen enkele ronde, omdat een browservenster geen
telefoon is.** Er zit geen statusbalk boven en geen thuisstreep onder, dus
`env(safe-area-inset-*)` is nul en een scherm dat die zone negeert ziet er in de
keuring perfect uit. Vijf schermen deden dat — de Command-modus-familie
(`partner-network`, `reizen-veilig`, `living-os`, en via dat blad ook
`geld-command` en `leven`) — en dat kwam boven met een **schermafdruk van een
echt toestel**, niet met een meting. De bovenste strook liep onder de klok door
en de menuknop lag op de eerste tab.

Dat hoeft niet zo te blijven: Chromium kán een inkeping nabootsen
(`Emulation.setSafeAreaInsetsOverride`), en dat is gebruikt om deze reparatie in
beide richtingen te meten — mét de reparatie begint de kop op 59 en houdt de
balk 39 pixels vrij, zonder op 0 en 5. **De ronde zelf draagt die inkeping nog
niet.** Zolang dat zo is, geldt voor de veilige zone wat voor dit hele document
geldt: gemeten met een browser, niet met een toestel.

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
