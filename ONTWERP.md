# RTG Interface Operating Standard — visuele taal

> **Van veraf classy, van dichtbij extreem krachtig.**
>
> Wie vijf seconden kijkt, ziet een exclusief Europees merk. Wie er acht uur per
> dag mee werkt, merkt dat er een volledig operationeel systeem onder zit.

Dit is geen los design system maar de visuele uitvoering van `INTERFACE.md`.
`CLAUDE.md` zegt wat het merk is, `LAT.md` hoe er geschreven wordt en
`PLATFORM.md` hoe apps zich tot elkaar verhouden. Dit bestand zegt hoe iedere
RTG-surface eruitziet en waarom — en per regel wat hem handhaaft, want een
ontwerpregel zonder handhaving is over drie maanden twintig stijlen.

**Deze specificatie ligt vast vóór er schermen worden aangepast.** Dat is de
volgorde met opzet: wie eerst Reizen, dan Office en dan Command "mooier maakt",
interpreteert de regels drie keer en houdt drie ontwerpen over.

---

## 0a. Waar dit systeem vandaag wordt gedragen

*Toegevoegd 23 augustus 2026, want dit ontbrak en de afwezigheid was niet te
zien.*

Deze specificatie was volledig: de tokenlaag staat in
`public/shared/rtg-ontwerp.css`, de materialenleer in
`public/shared/rtg-materiaal.css`, en `test/ontwerp.test.js` (19 toetsen) en
`test/materiaal.test.js` (10) houden ze streng. Maar die toetsen meten de
**tokenlaag tegen zichzelf**. Van de 185 app-pagina's sloot er precies **één**
`rtg-ontwerp.css` in, en `rtg-materiaal.css` **nul**.

Een ontwerpsysteem dat nergens wordt ingesloten is geen systeem maar een
document. Sinds vandaag telt `schermenZonderVormtaal` in `NORM.json` hoeveel
pagina's hem niet dragen, en die meter mag alleen omlaag — geteld op de
insluiting en niet op het gebruik, want dat is de goedkope en eerlijke
ondergrens van adoptie.

`/apps/werk.html` is de eerste die hem echt draagt: `data-rtg-modus="pro"`, en
de zeven kleurtokens van dat scherm verwijzen naar de materialenleer in plaats
van hun eigen hexcodes te dragen. Die waarden klopten toevallig — `#7f1634` is
de logo-bordeaux en `#c0a544` is `--gold-tekst` — maar het was een kopie, en
een kopie loopt uit de pas zodra de bron verandert. Uitgerekend in het scherm
dat aan partners wordt verkocht.

## 0. Wat we niet doen

We maken van RTG geen grijze corporate SaaS-doos. De bordeaux-gouden identiteit,
de klok, de Bodoni en de Europese luxe-sfeer zijn het waardevolle deel en blijven
staan.

Wat vervangen wordt is de **UI-logica**, niet de huisstijl:

```
oud:  icoon → knop → app → kaartje
nieuw: wereld → toestand → workflow → object → context → actie
```

---

## 1. Merk-elementen en werk-elementen

De fout die het geheel vlak maakte: bijna elk onderdeel kreeg dezelfde
behandeling. Een status, een kaarttitel en een hoofdstuktitel zagen er even
belangrijk uit, dus niets was belangrijk.

**Bodoni (serif) is ceremonieel.** Hij mag op:

- hoofdtitels en hoofdstukken;
- een bestemming of stad;
- een belangrijk bedrag;
- één dominante KPI;
- een dagnummer dat als anker in een register dient;
- bewust merkgebruik.

**Bodoni mag niet op**: statussen, kaarttitels, invoervelden, tabelkoppen,
knoppen, meta-regels, of wat dan ook dat vaker dan een paar keer per scherm
voorkomt. Een serif die overal staat, is geen signatuur meer.

**Inter draagt het werk**, met tabulaire cijfers en echte gewichtsverschillen.

```
REIZEN                                    ← Bodoni, groot, ceremonieel
RTG-R-ECF153 · 2 reizigers · €2.200 · 18 AUG   ← Inter, compact, tabulair
```

*Handhaving:* `test/ontwerp.test.js` telt per pagina de serif-rollen en zakt
zodra een pagina Bodoni op een niet-toegestane rol zet. De klassen die serif
dragen zijn een **gesloten lijst** (`.rtg-ceremonie`, `.rtg-kpi`, `.rtg-datum`,
`.rtg-plaats`, `h1`); een vrije `font-family` in een pagina-`<style>` is een fout.

---

## 2. Drie modi: World, Pro, Command

Eén systeem, drie dichtheden. De modus staat op `<body>` als
`data-rtg-modus="world|pro|command"` en zet niets anders dan **schaal, ruimte en
dichtheid** — nooit een andere kleur, een ander lettertype of een andere vorm.
Dat is precies waarom het één systeem blijft.

| | **World** | **Pro** | **Command** |
|---|---|---|---|
| Voor | leden | wie ermee werkt | directie, operations, security |
| Objecten per scherm | 3–8 | 10–20 | 20–60 |
| Regelhoogte | 56px | 40px | 32px |
| Basisruimte | 20px | 12px | 8px |
| Bodoni | ruim toegestaan | spaarzaam | alleen de dominante toestand |
| Witruimte | draagt het ontwerp | functioneel | minimaal |

**World moet óók slimmer.** Niet alleen een naam, maar een naam met een
toestand erachter:

```
REIZEN
Ibiza · 18 aug
2 reizen gepland
```

*Handhaving:* de drie modi staan als tokenblokken in
`public/shared/rtg-ontwerp.css`. `test/ontwerp.test.js` zakt zodra een modus een
token mist dat een andere wél zet (een half gevulde modus is een scherm dat in
die modus stuk gaat), en zodra een modus een kleur- of fonttoken overschrijft.

---

## 2b. De ruimteschaal

Vijf stappen, en verder niets:

| | | |
|---|---|---|
| `0.25rem` | 4px | de haarbreedte: twee dingen die bij elkaar horen |
| `0.5rem` | 8px | de basisruimte van **Command** |
| `0.75rem` | 12px | de basisruimte van **Pro** |
| `1.25rem` | 20px | de basisruimte van **World** |
| `2rem` | 32px | de sectiebreuk: hier houdt iets op en begint iets anders |

**Waarom precies deze vijf.** Ze zijn niet bedacht maar opgeraapt: drie ervan
staan al in de tabel hierboven als de basisruimte van World, Pro en Command. Een
schaal die daar niet op staat zou een tweede ruimtetaal zijn naast de bestaande,
en dan hebben we er twee. De vierde is een halve Command-stap voor wat tegen
elkaar aan hoort, de vijfde het dubbele van World voor waar iets ophoudt.

**Wat er stond.** Zeventien willekeurige stappen: .3, .35, .4, .45, .5, .55, .6,
.65, .7, .8, .9, 1, 1.1, 1.2, 1.4 en 1.5rem, door elkaar geschreven als `.5rem`
en `0.5rem`. Niemand koos daar iets; ze zijn ontstaan. Het verschil tussen
0.55rem en 0.6rem is 0,8 pixel — dat is geen ontwerpbeslissing maar ruis, en het
maakt elke hulpklasse onmogelijk omdat er voor elke ruisstap een eigen klasse
zou moeten komen.

**Bij gelijke afstand naar de RUIMERE stap.** 1rem ligt precies tussen 0.75 en
1.25; die wordt 1.25. Dat is geen willekeur maar CLAUDE.md: *bij twijfel meer
ruimte.*

**Wat er buiten valt.** `0`, `auto`, en alles boven 2rem. Een marge van 3 of
4rem is geen ruisstap maar een bewuste grote sprong, en die snapt nergens
netjes heen. Ook `px`- en `%`-marges blijven staan: die zitten meestal in een
berekening waar een rem-stap niets te zoeken heeft.

*Handhaving:* `node scripts/margeschaal.js --controle` zakt op elke rem-marge in
een `style="..."` die niet op de schaal ligt, en `npm run check` regel 51 draait
hem mee. De omzetting zelf staat in hetzelfde script en is met `--proef` droog
te draaien. Gemeten bij het invoeren: 1.372 declaraties verschoven, gemiddeld
1,4 pixel, grootste sprong 5,6px (1.6rem → 1.25rem).

---

## 3. Uitzonderingsgestuurd

Software moet niet roepen *"kijk hoeveel data ik heb"*, maar *"dit gaat goed,
hier moet jij naar kijken"*.

```
Reizen                    ← niet interessant
1.284 boekingen

Reizen                    ← wél interessant
1.284 boekingen
3 vereisen actie
1 leverancier > SLA
€4.850 betaling wacht
```

Dat is ook waarom een dashboard geen zes even grote dozen is: er is **één
dominante toestand** ("SYSTEMEN IN ORDE") en daarnaast kleine indicatoren voor de
afwijkingen.

---

## 4. Kleur is betekenis, niet decoratie

Goud mag niet de kleur van "een mooie knop" worden.

| Token | Betekenis |
|---|---|
| `--rtg-goud` | autoriteit, primair, geselecteerd |
| `--rtg-acc` (bordeaux) | omgeving, merk |
| `--rtg-bg` | workspace |
| `--rtg-txt` (ivoor) | informatie |
| `--rtg-sig-gezond` | normaal — bijna onzichtbaar |
| `--rtg-sig-aandacht` | aandacht |
| `--rtg-sig-incident` | menselijk ingrijpen nodig |
| `--rtg-sig-actief` | draaiend of geautomatiseerd proces |

**Groen is bijna onzichtbaar en dat is de bedoeling.** Normaal hoort geen
aandacht te trekken.

---

## 4a. De vaste kleurrol van iedere wereld

*Vastgelegd op 4 september 2026 na goedkeuring van de vier wereldschermen.*

De vier werelden delen typografie, ritme, componenten en interactie. Ze delen
niet dezelfde sfeer. De wereldkleur is daarom geen los thema dat een gebruiker
kan verwisselen, maar een vaste laag van de informatiearchitectuur:

| Wereld | Grond | Verhoogd vlak | Verdiept vlak | Inkt | Gedempte inkt | Signatuur | Metaal |
|---|---|---|---|---|---|---|---|
| LivingOS | `#F4F0E8` | `#FBF8F2` | `#E8E0D2` | `#211E19` | `#675F54` | `#B89545` | `#745718` |
| TravelOS | `#14090E` | `#231016` | `#0E090B` | `#F7F0E6` | `#C2B2AA` | `#7F1634` | `#D0B77B` |
| WorkOS | `#0C1112` | `#141B1C` | `#090D0E` | `#F0F2EC` | `#AAB6B2` | `#75B8B1` | `#C1A45F` |
| FoundationOS | `#071522` | `#0B2032` | `#06101B` | `#F2F2EA` | `#AEBCCC` | `#D0B66E` | `#D0B66E` |

Dit zijn **rollen**, geen verfdoos. `grond` draagt de pagina, `verhoogd vlak`
draagt een contextpaneel, `verdiept vlak` een rail of invoergebied, en `inkt`
en `gedempte inkt` dragen tekst,
`signatuur` markeert de actieve wereld en `metaal` is alleen voor een klein,
belangrijk accent. LivingOS gebruikt bewust een donkerdere metaaltoon voor
kleine tekst; licht goud op ivoor is onvoldoende leesbaar.

De merkankers blijven exact het logo-goud `#857007` en logo-bordeaux
`#7F1634`. De tabel verandert het logo niet. Hij legt vast hoe licht, contrast
en materiaal op een scherm worden vertaald.

### Twee schalingen van dezelfde schil

De nieuwe wereldschil heeft precies twee presentaties:

| Modus | Gebruik | Gedrag |
|---|---|---|
| `home` | de vier Vandaag-ingangen | royaal, fotografisch, één actuele focus |
| `surface` | agenda, dossier, project, stad en volgende subschermen | compacte contextkop, daarna het bestaande werkscherm |

Een pagina kiest declaratief:

```html
<body data-rtg-world="travel" data-rtg-vandaag-luxe="surface">
```

De implementatie staat in `public/shared/rtg-vandaag-luxe.css` en
`public/shared/rtg-vandaag-luxe.js`. De laag:

- doet zelf geen API-aanroep en schrijft niets naar opslag;
- verandert geen sessie, recht, tenant of routecontract;
- toont alleen echte bestaande scherminformatie, of zegt eerlijk dat die nog
  wordt geladen of leeg is;
- wordt in een iframe of ingebed Command-oppervlak niet als tweede chrome
  getekend;
- is per pagina direct terug te draaien door het attribuut en de twee gedeelde
  insluitingen te verwijderen.

De eerste surface-proeven zijn de bestaande routes voor Agenda, Reisboek,
Projecten en de publieke Foundation-stad. Nieuwe parallelle dashboards zijn
niet toegestaan: de schil komt om de echte workflow heen.

### De enige balk: RTG Edge 2.0

*Vastgelegd op 4 september 2026 na goedkeuring van de adaptieve wereldranden.*

Edge 2.0 tekent geen nieuwe top-, zij- of onderbalk. Het verbetert het bestaande
`.rtg-edge-chrome`-casco en accepteert alleen een document waarin precies één
`.rtg-edge-top`, één `.rtg-edge-side`, één `.rtg-edge-bottom` en één klein
RTG-merkteken aanwezig zijn. Op een telefoon bestaat de zijbalk wel als
onderdeel van het gedeelde casco, maar is zij nooit zichtbaar en reserveert zij
geen ruimte.

| Stand | Bureau | Telefoon | Bedoeling |
|---|---|---|---|
| `overview` | top + side + bottom | top + bottom | oriënteren en van wereld wisselen |
| `compact` | alleen bottom | alleen bottom | doorwerken met de hoofdhandeling onder de duim |
| `focus` | alle randen weg | alle randen weg | lezen, schrijven of presenteren zonder chrome |
| `auto` | scroll omlaag compact, omhoog overview | hetzelfde | ruimte geven zonder de bediening zoek te maken |

Focus heeft precies één zichtbare, toetsenbordbereikbare herstelgreep. Escape en
de greep herstellen de vorige automatische keuze als Focus vanuit Auto kwam;
anders herstellen zij Overview. Automatisch wisselen stopt zolang iemand in een
invoer, dialoog, contextlade of sleepbeweging werkt.

De systeemstatus bevat de vier expliciete keuzes **Overzicht, Compact,
Automatisch en Focus**. Een vaste keuze van de gebruiker gaat voor automatische
scrolllogica en wordt lokaal onthouden. De menuknop opent uitsluitend de
functie-index; hij vouwt niet buiten dit toestandscontract om nog een tweede
variant van de randen in.

Schermspecifieke tabbladen en knoppen komen in één contextlade in de bestaande
onderbalk. Edge kloont ze niet, maar verplaatst de echte DOM-node, met bestaande
listeners, id's en rechten, en kan haar weer op de oorspronkelijke plek
terugzetten. Alleen benoemde contexttokens zijn toegestaan. Een inhoudsmenu
zoals de Foundation-deelbalk blijft bij de inhoud als de broneigenaar die plek
nodig heeft.

De overdracht is transactioneel:

1. de bestaande Edge bereikt `data-rtg-edge-ready="true"`;
2. Edge 2 vindt exact één volledig casco en alle gevraagde contextbronnen;
3. pas daarna zet het `data-rtg-edge-2-rendered="true"`;
4. alleen achter die marker mag oude, dubbele chrome verdwijnen.

Bij een fout blijft de bestaande bediening zichtbaar en bruikbaar. In een
iframe, `?embed=1` of Command-oppervlak wordt geen tweede Edge gestart en wordt
de lokale vaste chrome van het kind onderdrukt. De hoofdactie in de onderbalk
is per route expliciet en niet-destructief; een willekeurige eerste knop uit
`main` is nooit een geldige systeemactie.

De declaratieve ingang is:

```html
<body data-rtg-edge-2-context="hoofdtabs"
      data-rtg-edge-2-state="overview"
      data-rtg-edge-2-auto="true">
```

De centrale laadketen staat in `rtg-edge-system.js` en
`rtg-edge-2-loader.js`. Pagina's laden zelf geen Edge 2-assets. De contract-,
integratie- en browserproeven staan in `test/rtg-edge-2.test.js`,
`test/rtg-edge-2-pilots.test.js` en `test/rtg-edge-2.e2e.js`.

### Rust is de luxeregel

- Eén RTG-merkanker per scherm is genoeg. Een subscherm krijgt geen herhaald
  woordlogo in iedere kaart of balk.
- Geen grote massieve rode knoppen. Bordeaux is een signatuur, selectie of
  dunne actielijn; primaire acties blijven rustig omlijnd.
- Fotografie geeft context en sfeer, nooit een verzonnen status of cijfer.
- Rechte hoeken, dunne lijnen en één duidelijke hiërarchie blijven verplicht.
- Een status blijft woord plus teken plus, als derde laag, kleur.

De oudere toewijzingen in `rtg-worlds-2026.css` blijven uitsluitend bestaan
voor nog niet gemigreerde schermen. Een pagina krijgt de nieuwe vaste wereldrol
pas door deze schil expliciet te dragen. Zo is de overgang controleerbaar en
wordt een globale kleurwissel niet vermomd als een kleine stijlaanpassing.

---

## 5. Status nooit op kleur alleen

Operationele informatie moet leesbaar blijven voor wie kleur niet ziet, en op een
zwart-witte print.

```
BEVESTIGD ✓        WACHT OP LEVERANCIER ◷
ACTIE VEREIST !    GEANNULEERD ×
```

Elke status draagt dus **een woord en een teken**, en kleur is de derde laag.

*Handhaving:* `test/ontwerp.test.js` zakt op een statuscomponent zonder
`data-teken`. Dit is bovendien de enige ontwerpregel die ook in `scripts/a11y.js`
terugkomt, want het is er net zo goed een toegankelijkheidsregel als een
merkregel.

---

## 6. Eigen componenten

Niet een andere kleur over bestaande UI-patronen, maar onderdelen die van RTG
zijn.

### RTG Signal Rail
Een dunne verticale lijn links van een object. Geen kleur = normaal, groen =
afgerond, goud = aandacht, rood = ingrijpen. Zo kun je honderd regels tonen
zonder honderd gekleurde pillen.

### RTG Reference
Elke enterprise-entiteit draagt zijn kenmerk op **dezelfde positie**, in
tabulaire cijfers: `RTG-R-ECF153`. Klikken kopieert. De referentie is geen
detail dat je bij "meer" wegstopt — het is waar een professional naar zoekt.

### RTG Action Line
Elke operationele regel mag een volgende stap dragen: `ACTIE · PASPOORT
CONTROLEREN` of `WACHT OP · HOTEL`. Daarmee is het scherm procesgedreven in
plaats van beschrijvend.

### RTG Context Pane
Op desktop permanent rechts. Selecteer een boeking → het paneel toont die
boeking. Selecteer een betaling → hetzelfde paneel verandert. Je klikt niet meer
door pagina's heen.

### RTG Gebaren
Een operationele regel is een **plank met twee laden eronder**. Veeg naar links
en de rechterlade komt tevoorschijn, veeg naar rechts en de linker; veeg door en
de eerste actie van die kant gebeurt meteen. De laden zijn onyx met de actie in
kapitaaltjes — geen gekleurde blokken met een prullenbakje, want dat is precies
de doosjes-UI uit par. 7.

**De drempel is zichtbaar.** Voorbij het punt waar loslaten iets doet, neemt de
eerste actie de hele lade over, wijkt de rest en licht de snede goud op — één
keer, met één korte tik. Een doorveeg die je niet zag aankomen is geen bediening
maar een ongeluk.

**De eerste actie ligt aan de snede.** De lade gaat vanaf de snede open, dus wat
daar ligt zie je het eerst — en een volle veeg voert de eerste actie uit. Aan de
rechterkant klopte dat toevallig; aan de linkerkant niet. Daar hing de knoppenrij
wel aan de snede maar stond hij in leesvolgorde, dus je zag eerst de LAATSTE
actie en de eerste pas als de lade helemaal open stond. Gemeten op de post, veeg
naar rechts, bij 40, 90 en 150 pixels: *Ster* nul van 55 pixels zichtbaar, alle
drie de keren. Wat je wél zag was het midden van een tweeregelig label — een
grijze bak. De actie die afgaat, hoort de actie te zijn die je ziet.

**De lade toont alleen wat er heel op past, en hij eindigt zoals de regel
eindigt.** Twee dingen die je pas ziet als je kijkt, en die er tot 19 augustus
2026 allebei naast zaten. De lade werd afgeknipt op 72% van de regel terwijl de
knoppen hun eigen breedte hielden, dus stond de laatste half in beeld: op de post
las *Overnemen* als *OVER*. Wat er niet bij past valt er nu UIT — en dat kost
niets, want de actielade toont ze alle drie. De eerste blijft altijd staan: dat
is de actie die een volle veeg uitvoert. En de lade was een rechthoek tegen een
regel met ronde hoeken; nu meet de laag de ronding van de regel en volgt de snede
hem. Een half woord is geen knop, en een scherpe hoek naast een ronde regel is
geen afwerking.

**Vier wegen, één deur.** Vasthouden, rechtermuisklik, de menutoets en de
pijltoetsen openen dezelfde acties als lijst, met echte knoppen in de bovenlaag.
Dat is geen stapeling: het is dezelfde deur, die op elk toestel anders heet. De
lade zelf is aria-hidden en is er voor de hand; de actielade is er voor de toets
en de schermlezer. Wat niet terug te draaien is, gaat op vasthouden en nooit op
een veeg.

**Een veeg die de server raakt, is optimistisch.** De regel verdwijnt meteen en
de server volgt; komt er een fout terug, dan komt de regel terug met een melding.
Snelheid is wat een veeg beter maakt dan een knop, en die weggeven maakt hem
zinloos. De prijs is dat elke server-actie een tegenactie moet hebben — zonder
weg terug hoort hij niet op een veeg maar op vasthouden.

*Sinds 19 augustus 2026 is dit uitgevoerd en gehandhaafd.* `RTGGebaar.klaar.server()`
doet het drieluik op één plek: de regel klapt meteen in, de server volgt, en gaat
het mis dan komt de regel terug mét de reden — stil falen is hier de ergste
uitkomst, want dan denkt het lid dat het gelukt is en staat het er morgen weer.
Een actie zónder tegenactie krijgt geen terugdraai-knop maar wordt automatisch
een `borg`: die gaat alleen op vasthouden. Dat is geen strengheid maar de enige
eerlijke uitkomst — een knop "Terugdraaien" die niets terugdraait is erger dan
geen knop.

Het eerste domein is RTG Bestanden: naar links is de prullenbak (`/weg`, terug
met `/herstel`), naar rechts de ster. In de prullenbak zelf is een tweede `/weg`
onomkeerbaar, en juist daar valt de borg vanzelf op zijn plek.

Het tweede is **RTMAIL**, en dat is het gebaar dat een lid al meebrengt van
buiten dit huis: opzij is weg, de andere kant is markeren. Juist daarom moet hij
hier kloppen — een veeg die op post iets anders doet dan overal, is verwarrender
dan geen veeg. Naar links liggen Opbergen en Weggooien, naar rechts de ster,
sluimeren tot morgen en overnemen. Alles is omkeerbaar: opbergen, weggooien en
terugzetten zijn dezelfde route (`verplaats`) met een andere map, en sluimeren
gaat terug met `verplaats` naar `in` (dat wist het sluimermoment). Er is hier dus
geen enkele borg, en dat is de reden dat dit domein het tweede is en niet het
tiende. De melding zegt EERST wat er gebeurd is en dan welk bericht: andersom
werd hij op een telefoon afgekapt tot het onderwerp, met een knop Terugdraaien
ernaast en geen woord over wat je terugdraait.

Het derde is **RTG Notities**, en dat is het eerste bord waar de twee soorten
actie naast elkaar liggen. Archiveren is de la — `bewaar {archief:true}` legt
hem erin en `{archief:false}` haalt hem eruit, dus een echte weg terug. Weggooien
is dat niet: de kern gooit de notitie echt van het bord en neemt een gekoppelde
agenda-afspraak mee. Die actie krijgt daarom geen `terug`, en daarmee maakt de
laag er vanzelf een borg van. Naast elkaar op één regel maakt dat het verschil
zichtbaar zonder dat er een woord bij hoeft: het ene gaat op een veeg, het andere
alleen als je hem vasthoudt. Het gedeelde bord houdt zijn knoppen — vastpinnen en
archiveren horen bij de eigenaar, en een gedeelde notitie "weggooien" betekent
iets anders (jezelf van de lijst halen) met een andere weg terug.

Het vierde is **De Salon**, en dat is het eerste domein waar niet elke actie de
regel weghaalt. Archiveren, verbergen en verwijderen halen een post uit je
tijdlijn, dus die lopen via `klaar.server()`. Bewaren doet dat niet — een
bewaarde post blijft gewoon staan — dus daar drukt de veeg de knop in die op de
regel zelf al staat (`klaar.eigenKnop()`). Zo blijft er één waarheid over wat
bewaren doet, en die staat op het scherm en niet in de gebarenlaag. Wat je mag
hangt bovendien af van wiens post het is: op je eigen post archiveer je, op die
van iemand anders verberg je — dat is iets anders en het heet hier ook anders.

Dat vierde domein legde meteen een fout in de laag zelf bloot: **de laag slikte
zijn eigen klik op.** Na een gebaar staat `slikRij` op de regel, want de echte
klik die achter een veeg aankomt hoort niet door te lekken naar de link eronder —
maar de klik die `eigenKnop` zelf stuurt komt uit diezelfde regel en werd net zo
hard tegengehouden. Bewaren bereikte de server dus nooit. De onderdrukking wordt
nu precies om die ene klik heen opgetild en daarna teruggezet; de naklik van de
vinger wordt nog steeds geslikt.

**En de laag werkte tot 19 augustus 2026 niet op een telefoon.** `.gb-rij` kreeg
zijn `position:relative` alleen binnen de mediaquery van het aanwijslicht —
`(hover:hover) and (pointer:fine)` — en op een aanraakscherm is die onwaar. De
lade is absoluut geplaatst en zocht dus de PAGINA als houvast: gemeten met
aanraakemulatie stond er naast een regel van 62 pixels een lade van 844, van de
bovenkant tot de onderkant van het scherm. Geen enkele toets of schermafdruk zag
het, want die draaiden allemaal met een muis — en daar zette de lichtregel de
positie er per ongeluk bij. Een eigenschap die je nodig hebt, mag geen bijwerking
van een andere regel zijn.

*Handhaving:* `test/gebaar.test.js` bewaakt wat je niet ziet (de laag raakt in
rust alleen aan wat met naam geleend is, de lade draagt geen knop-in-een-link,
het gebaar is nooit de enige weg, de drie wereldregisters delen één bouwer, en de
regel draagt zijn plaatsanker buiten elke mediaquery), `test/gebaar.e2e.js` veegt
in een echte browser — met een derde scenario in de aanraakstand, over een regel
die zichzelf NIET plaatst, want een scherm dat dat wel doet verbergt de fout van
de laag. `test/gebaar-bestanden.e2e.js`, `test/gebaar-rtmail.e2e.js`,
`test/gebaar-notities.e2e.js` en `test/gebaar-salon.e2e.js` meten de belofte met
een server erachter, tot aan een geweigerde aanvraag, een borg die pas op de
tweede druk afgaat en een veeg die de eigen knop van het scherm indrukt toe.

### RTG Command Palette (⌘K)
`Boeking ECF153` · `Open Ibiza` · `Maak factuur` · `Sluit kassadag` · `Toon
voertuigen Haarlem`. Hier verdwijnt de AI natuurlijk in, in plaats van als los
chatvenster ernaast te staan.

---

## 7. Weg met het kaarten-dashboard

Niet elk stuk informatie hoort in een afgerond rechthoekje. Dat is precies wat
een scherm het gevoel van een template geeft.

Gebruik in plaats daarvan: **vlakken, verticale rails, dunne borders,
typografische groepen, registers, kolommen, open ruimte en contextpanelen.**

**Een kaart is alleen een kaart als het ding een zelfstandig object is.** Dan
wordt hij weer bijzonder.

*Handhaving:* `test/ontwerp.test.js` telt kaarten per scherm en zakt boven een
grens per modus (World 8, Pro 4, Command 2). Een register is geen stapel kaarten.

---

## 8. Cijfers zien eruit als cijfers

Alles wat een getal is, staat in tabulaire cijfers en lijnt uit:

```
€ 2.500.000
      000184
     99,982%
RTG-R-ECF153
```

Klein detail, groot effect: dit is wat een interface institutioneel laat ogen.

*Handhaving:* `--rtg-cijfers` zet `font-variant-numeric: tabular-nums`; de
componentklassen voor bedragen, referenties en tellers dragen hem verplicht, en
de toets zakt als er één zonder staat.

---

## 9. Rahul is geen chatbotje

`Vraag Rahul…` is goed voor World. In Pro en Command is Rahul **aanwezig in de
context**, niet in een venster ernaast:

```
Rahul · 3 boekingen vragen vandaag aandacht          [ Los op ]
Rahul · omzet ligt 8% onder verwachting              [ Los op ]
Rahul · terrasbezetting loopt sneller op dan de keuken aankan
```

De bestaande drempel blijft staan: **de AI stelt op, de mens verstuurt en
beslist** (`CLAUDE.md`, en de comm-kern doet het al zo). "Los op" opent de
handeling; hij voert hem niet zelf uit.

---

## 10. Drie echte layouts

Een telefoonontwerp uitrekken is geen desktopontwerp.

| | Layout |
|---|---|
| Mobile | één hoofdvlak + bladen van onderen |
| Tablet | hoofdvlak + optioneel contextvlak |
| Desktop | `240px navigatie │ flex werkvlak │ 360px context` |

*Handhaving:* de drie layouts staan als grid-klassen in `rtg-ontwerp.css`. De
schermtoetsen meten op 430px én op 1440px, zodat "het staat scheef op desktop"
een zakkende toets is en geen smaakkwestie.

*En wat eronder hangt:* een layout zegt waar dingen staan, niet wat een mens er
kan. Dat tweede staat in **`ADAPTIEF.md`** — per capability een presentatie per
vorm, met als harde grens dat een handeling die op bureau bestaat op telefoon
niet mag verdwijnen. `test/adaptief.test.js` laat de bouw daarop zakken.

---

## 11. Dichtheid met contrast

Enterprise betekent niet *alles klein maken*. Het betekent: **compact waar
gewerkt wordt, groot waar gekeken wordt.**

| Element | Intensiteit |
|---|---|
| Dashboardtitel | groot |
| Dominante KPI | groot |
| Boekingsregister | compact |
| Beschrijving | klein |
| Status | zeer compact |
| Primaire actie | duidelijk |

De fout van nu is dat te veel elementen dezelfde visuele intensiteit hebben.

---

## 12. Motion, extreem subtiel

Geen spelcomputer. Beweging bestaat om te laten voelen dat er een systeem
onder draait:

| Gebeurtenis | Beweging |
|---|---|
| Regel komt binnen | 120 ms inschuiven |
| Status verandert | Signal Rail verkleurt rustig |
| Rahul verwerkt iets | kleine pulse |
| Paneel opent | 180 ms, strak |
| Teller verandert | zonder pagina-herlading |
| Vinger sleept een regel | 1-op-1, zonder overgang — dat is geen animatie maar bediening |
| Lade klapt terug | 180 ms, dezelfde als een paneel |
| Hand boven een vlak | het licht volgt, één lichtpunt (MATERIAAL.md) |

*Handhaving:* alle duren staan als tokens (`--rtg-tijd-kort`, `--rtg-tijd-paneel`)
en elke animatie respecteert `prefers-reduced-motion`.

---

## 13. Eén iconensysteem

24×24 basisgrid, één vaste lijndikte, drie formaten, geen willekeurige
detailgraad. Letters alleen als **bewust monogram** — een monogram mag een
RTG-signatuur zijn, maar nooit een terugval omdat er geen icoon was.

---

## 14. Hiërarchie boven launchers

Het beginscherm en de werelden zijn nu vooral startknoppen. Ze horen een
toestand te tonen:

```
REIZEN                 GELD                  SALON                 HUIS
2 komende reizen       € •••••               4 nieuwe berichten    Werk · Zorg · School
Ibiza · 18 AUG         3 transacties vandaag 2 uitnodigingen       1 aandacht
```

Pas ná een tik komen de losse apps. Niet twintig icoontjes vóórdat je ergens
bent.

Datzelfde geldt binnen een wereld: Het Huis is nu een raster en hoort een wereld
te zijn — **WERK** (5 taken, 2 afspraken), **ZORG** (geen actie nodig),
**SCHOOL** (3 berichten), en daaronder pas *Diensten* en *Persoonlijk*. Alle
software blijft; ze krijgt alleen hiërarchie.

De klok blijft, maar krijgt een functie: hij toont de tijd wáár je volgende reis
of activiteit is.

---

## 15. De twee schillen

- **RTG Office** wordt één shell met een vaste navigatie (Werk, Mail, Agenda,
  Mensen, Finance, CRM, Projecten, Bestanden, AI, Directie), een commandobalk
  boven, de actieve applicatie in het midden en context rechts. De losse apps
  blijven zelfstandig diep — dat is precies de super-app-regel uit `PLATFORM.md`.
- **RTG Command** staat daarboven en bestuurt niet één organisatie maar het
  ecosysteem: van Europa → Nederland → Haarlem → Mobiliteit → voertuig
  RTG-M-0184 → rit → betaling → audit. Doorlopen van infrastructuur, niet een
  wand met KPI's.

---

## 16. Wat dit moet oproepen

| Bij | Gevoel |
|---|---|
| de consument | "dit voelt bijzonder" |
| een medewerker | "hier kan ik snel mee werken" |
| een directeur | "ik heb controle" |
| een enterprise-klant | "dit is geen hobbyproject" |

Dat laatste krijg je niet door alles vol te zetten, maar door precisie,
consistente componenten, sterke informatiearchitectuur en diepe functionaliteit.

---

## 17. De volgorde van invoeren

Klein en omkeerbaar, en niets hieronder vraagt om het weggooien van wat er staat.

1. ✅ **Deze specificatie**, vastgelegd vóór er een scherm verandert.
2. ✅ **De tokenlaag** (`public/shared/rtg-ontwerp.css`): de drie modi, de
   signaalkleuren, de dichtheidsmaten, de tijden en de tabulaire cijfers. Naast
   `rtg-ui.css` en niet eroverheen — die blijft de basisvormtaal, dit voegt de
   dichtheid en de betekenis toe.
3. ✅ **De componenten**: Signal Rail, Reference, Action Line, Status, Register.
4. **Eén scherm als proef** — RTG Reizen in Pro-dichtheid, met register in plaats
   van kaartenstapel. Pas als dat staat, de rest.
5. **De Context Pane en het desktopraster** (240 │ flex │ 360).
6. **De Command Palette (⌘K)**, met Rahul erin in plaats van ernaast.
7. **Het beginscherm en de werelden**: van launchers naar toestanden.
8. **RTG Office als shell**, daarna **RTG Command**.

Stap 4 is bewust één scherm en niet vier: het patroon moet één keer bewezen zijn
voordat het twintig keer vastligt.
