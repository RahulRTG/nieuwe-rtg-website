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
| ondertitels | 21 van 30 media-elementen geregeld | video die je zonder geluid niet kunt volgen |

Die vier zakken de bouw als iemand ze breekt. `scripts/a11y.js` draait ze bij
elke push over alle schermen in twee staten; `check.js` regel 49 doet het
ondertitelregister.

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

Ook open: een spraakbericht in de teamchat heeft geen tekstversie, terwijl RTG
Memo op hetzelfde toestel wél een transcript maakt. Dat is de eerstvolgende die
te bouwen is.

### Wie een motorische beperking heeft

**Werkt:** alles is met het toetsenbord te bedienen, inclusief de wereldklok --
die heeft pijltjes, Escape en een sneltoets naast het draaien met een vinger
(`shared/wereld/wereld-03.js`). Focus is altijd zichtbaar: de gedeelde laag zet
een `:focus-visible`-rand op elk scherm. Een open venster sluit sinds vandaag de
rest van de pagina af met `inert`, zodat je er niet meer uit tabt zonder het te
merken -- gemeten op app.html: dertien focusbare elementen stonden buiten het
venster open, nu nul.

**Houdt op bij: knoppen onder 24x24** (WCAG 2.5.8). De meting begon op 267 stuks
over 188 schermen, en twee oorzaken droegen het leeuwendeel:

  - de home-indicator van de iOS-schil stond op 150x22 -- twee pixels te laag,
    op elk scherm dat de schil laadt. Nu 24, en dat scheelde 146 gevallen.
  - op 22 schermen bleek `ios.js` die pil neer te zetten terwijl het scherm
    `ios.css` NIET laadt. Zonder stijl krimpt een lege knop tot zijn inhoud: 4x4
    op comm.html, 16x6 op geld.html. Onzichtbaar, onraakbaar, en tóch in de
    tabvolgorde met de naam "Omhoog vegen brengt je naar de homescreen" -- de
    slechtst denkbare combinatie. De component brengt zijn maat nu zelf mee.

Na die twee staat de teller op **82 knoppen over 41 schermen**, en dat is een
staart van losse gevallen: kleurstalen 22x22, terugpijlen en verversknoppen van
14 tot 20 hoog, een selectievakje van 13x13. Die staan open. Het zijn per scherm
een paar regels CSS en geen gedeeld patroon, dus ze horen per scherm gedaan te
worden door wie dat scherm kent -- een blinde `min-height` over alles heen zou
259 lay-outs verschuiven om 82 knoppen te repareren.

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

Een groene ronde is dus een sterk signaal en geen bewijs voor elke toestand. Wie
deze poort scherper wil: geef de ingelogde ronde een vaste, geseede dataset.

En het grootste gat is per definitie niet te tellen: **er is nog nooit iemand met
een handicap door dit huis gelopen.** Alles hierboven is gemeten met een browser.
Een half uur met een echte schermlezergebruiker vindt dingen die geen scanner
kent, en dat half uur heeft niemand hier gehad.
