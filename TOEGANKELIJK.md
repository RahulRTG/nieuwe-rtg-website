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
| contrast, beide staten | **0** van 259, en nu over 83% van de tekst | tekst die te bleek is om te lezen |
| structuur (alt, label, naam, taal, titel) | **0** van 259 | een knop of veld zonder naam |
| springlink | eerste tabstop op elk scherm met een schil | vijftien tabs door dezelfde balk, elk scherm opnieuw |
| ondertitels | 21 van 29 media-elementen geregeld; alle opgenomen vormen | video die je zonder geluid niet kunt volgen |
| raakvlak (24x24) | **0** van 259, op telefoonformaat | een knop die een trillende hand niet raakt |
| de drie andere thema's | **0** onzichtbare tekst; het accent-als-kleine-tekst staat op een bovengrens | een lid dat champagne kiest en zijn scherm leeg ziet |

**DE NUL BIJ CONTRAST WAS NOOIT WAAR, EN DAT IS OP 19 AUGUSTUS 2026 GEBLEKEN.**
De keuring gaf op zodra er ergens in de keten een verloop stond -- en de themalaag
geeft `body` er een. Gemeten over alle 258 schermen in twee thema's: **1884
tekstelementen werden gewogen en 3042 werden overgeslagen**, alle 3042 om die ene
reden. De poort mat dus 38% van de tekst en meldde daarover nul. Hij rekent
verlopen en doorzichtige lagen nu uit (`gronden()` in `scripts/a11ykeuring.js`)
en weegt 83%; de rest is een `url()` als achtergrond of een keten die tot de
wortel doorzichtig blijft, en daar blijft hij eerlijk zwijgen.

Wat daarmee zichtbaar werd waren eerst drie systeemfouten -- de juridische
pagina's met zwart op zwart, de grote iOS-titel licht op licht, en gedeelde
componenten die het thema niet volgden -- en daarna een staart van zestig losse
gevallen. **Alle zestig zijn gerepareerd**, bij de bron en niet per scherm: negen
plekken in gedeelde bladen en zes op een scherm. De nul staat er dus weer, en hij
betekent nu iets anders dan de vorige: hij gaat over 83% van de tekst in plaats
van 38%. Wat er nog buiten valt staat met naam in `A11Y-INGELOGD.json`.

**EN DE POORT KEURDE MAAR EEN STAND, NAMELIJK ONYX.** Dat is waar de themalaag
op terugvalt als een lid niets kiest, dus alle drie de ronden hierboven meten die
ene. Wie champagne, bordeaux of royal koos, kreeg een huis dat nooit gemeten was.
Op 19 augustus 2026 is dat een keer geteld: onder **champagne** -- het enige
LICHTE thema -- stonden **116 stukken tekst die onzichtbaar waren**, niet slecht
leesbaar maar onzichtbaar, tot 1,01:1. Bordeaux en royal hadden daar nul van; die
zijn allebei donker, net als onyx, dus de fout leefde alleen in de stand die
niemand mat. Ingelogd en op bureaubladbreedte kwamen er daarna nog 55 bij die de
uitgelogde meting niet kon zien.

Het was bijna allemaal EEN fout in twee spiegelbeelden: een vlak dat zijn grond
hard donker schildert en zijn inkt uit het thema haalt, of andersom. Gerepareerd
bij de bron -- `--rtg-card2` ontbrak in alle vier de themablokken, 89 kopbalken
mengden een thema-stop met een harde bijna-zwarte stop, de iOS-balk en de
Command-schillen zetten hun tokens niet als donker eiland, en veertien schermen
die geen thema verdragen (een zoeker, een kaart, een speler, een cockpit)
verklaren zich nu `data-rtg-eigenvlak="onyx"`. **Alle 171 zijn weg**; wat overblijft is het
goud en de andere accenten als kleine tekst, en dat is een merkbesluit
(MATERIAAL.md) en geen instelfout. Dat staat per thema als bovengrens in
`A11Y-INGELOGD.json` en mag alleen omlaag.

Die zes zakken de bouw als iemand ze breekt. `scripts/a11y.js` draait ze bij
elke push over alle schermen -- structuur en contrast in twee staten, het
raakvlak in een derde ronde op telefoonformaat (390x844, ingelogd; wie iets
vindt, meet nog een keer), en de drie andere thema's in een vierde ronde,
ingelogd. `check.js` regel 49 doet het ondertitelregister, en
`test/thema.test.js` vangt de oorzaak zonder browser.

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

**Werkt: de veeg is nooit de enige weg.** Sinds vandaag dragen regels acties die
je met een veeg naar links of naar rechts tevoorschijn haalt (`shared/gebaar.js`,
zie `ONTWERP.md` par. 6). Dat is precies het soort functie waar WCAG 2.5.7 over
gaat: geen enkele handeling mag alleen met slepen te doen zijn. Vier andere wegen
komen bij dezelfde acties uit -- vasthouden, een rechtermuisklik, de menutoets en
de pijltoetsen -- en die openen een `<dialog>` met echte knoppen, echte namen en
focus die terugvalt op de regel waar hij vandaan kwam. De regel zelf zegt met
`aria-describedby` dát er acties aan hangen en hoe je erbij komt.

De zichtbare lade onder de regel is met opzet `aria-hidden`: bijna elke regel
hier is zelf een `<a>`, en een knop in een link is voor een schermlezer een knop
in een link. De lade is dus het oppervlak voor een hand, de actielade dat voor een
toets. `test/gebaar.test.js` zakt zodra iemand daar een echte knop in zet, en
zodra een van de vier andere wegen verdwijnt.

**Niet gemeten, en het is erger dan dat: NIET TE METEN met de poort die er staat.**
De acties rechtsboven in de iOS-balk (`.ios-nav-acties`) staan op 17px in
`--ios-accent`, en dat is de DAGKLEUR — zestien ankertinten met een interpolatie
ertussen, dus de kleur van die tekst hangt af van het seizoen en het uur. De
contrastpoort ziet hem nooit: de balk is `rgba(12,12,11,0.72)` over een `body`
met een verloop, en `achtergrond()` in `scripts/a11ykeuring.js` slaat een
onoplosbare grond bewust over. "Contrast: 0 van 259" dekt deze tekst dus niet.

Nagerekend met de rekenregel van diezelfde keuring, over alle zestien ankertinten,
op de twee gronden die de balk kan hebben:

| grond | zakt onder 4,5:1 |
|---|---|
| donker thema (onyx, bordeaux, royal) | **3 van 16** — zeenacht 3,83 · pruim 3,96 · lila 3,86 |
| champagne (72% zwart over parel = rgb 77,76,73) | **15 van 16** — alleen citroen haalt het (5,13) |

Het is geen fout in een scherm en geen browserblauw: het is het ontwerp dat op
een plek uitkomt waar niemand het heeft nagerekend. Dezelfde les staat al in
`shared/dagkleur.css` voor de tint als ACHTERGROND — daar is de inkt per tint
uitgerekend. Voor de tint als TEKST is dat nooit gebeurd.

En de voor de hand liggende reparatie is de verkeerde, ook dat is uitgerekend:
om op de champagne-balk 4,5 te halen moet zeenacht van 47% naar 76% lichtheid
(`#3E6FB0` → `#A5BEDF`), pruim en lila net zo. Dan zijn het pastels en is de
seizoenstint weg. Vijftien van de zestien schuiven zichtbaar op. Een grond die
tussen bijna-zwart en middengrijs kan liggen, draagt geen enkele verzadigde
kleur op 4,5 — de keuze zit dus in het MATERIAAL van de balk of in de vraag of
de dagkleur daar tekst mag zijn, en niet in de tint.

**Gerepareerd op 19 augustus 2026, en breder dan waar het begon.** Dezelfde tint
stond ook in de UI-kit als tekst -- `--rtg-acc` is dezelfde dagkleur -- op vier
plekken: de weg terug (twee keer), het merk-plaatje en de hover van een knoprij.
Daar is de grond de PAGINA, en het beeld is er even slecht: 3 tot 4 van de 16
zakken op de donkere thema's, 15 van de 16 op champagne. Geen enkele tint haalt
alle vier.

Alle zes de plekken dragen nu de inkt die het thema zelf al meebrengt
(`--rtg-txt`, en in de balk `--ios-label`, want die is altijd donker ook onder
een licht thema). Gemeten in een echte browser op alle vier de thema's: **7,56
tot 17,23:1**, waar de norm 4,5 is. De hover van een knoprij was bovendien
*alleen* een kleurverschil; dat is nu een streep, want `ONTWERP.md` par. 5 zegt
dat een toestand nooit op kleur alleen leunt.

De dagkleur blijft waar hij geen tekst is: als vlak, als rand, als schakelaar,
en in de focusring van de balk. Daar is de inkt per tint al uitgerekend.

*Handhaving:* `test/balkkleur.test.js` rekent de balkgrond uit met dezelfde
`ratio()` als de keuring -- de enige manier die hier kan, want de poort zelf zal
deze grond blijven overslaan -- en zakt zodra de dagkleur ergens weer tekst
wordt, zodra de labelkleur op een van de vier gronden onder de norm komt, of
zodra de cijfers hierboven niet meer kloppen.

**Niet gemeten:** of iemand met een tremor de drempel haalt zonder per ongeluk
door te vegen. De drempel ligt voorbij de volle lade én voorbij 55% van de regel,
en wat niet terug te draaien is gaat alleen op vasthouden -- maar dat is een
redenering, geen meting met een mens.

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
