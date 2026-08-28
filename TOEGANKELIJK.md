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
| contrast, beide staten | **0** van 259, en nu over 84,6% van de tekst | tekst die te bleek is om te lezen |
| structuur (alt, label, naam, taal, titel) | **0** van 259 | een knop of veld zonder naam |
| springlink | eerste tabstop op elk scherm met een schil | vijftien tabs door dezelfde balk, elk scherm opnieuw |
| ondertitels | 21 van 29 media-elementen geregeld; alle opgenomen vormen | video die je zonder geluid niet kunt volgen |
| raakvlak (24x24) | **0**, op telefoon- EN tabletformaat | een knop die een trillende hand niet raakt |
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
| raakvlak (24x24) | **0** van 259, op telefoonformaat | een knop die een trillende hand niet raakt |
| de drie andere thema's | **0** op alle drie | tekst die alleen in de stand die je zelf niet gebruikt onleesbaar is |

**HET GOUD WAS GEEN MERKBESLUIT MAAR EEN TOKEN DAT NIET MEETHEMAAT.** Toen de
vierde ronde (champagne, bordeaux, royal) erbij kwam, stonden daar 470
bevindingen, en na de reparatie van de onzichtbare tekst was er nog EEN soort
over: goud als kleine tekst. Dat leek een keuze uit `MATERIAAL.md` -- goud is een
vulkleur -- tot het nagerekend werd. Er bestaat per grond een goud dat wél leest:

| goud | op een licht vlak | op onyx |
|---|---|---|
| `#A98F1C` (het harde goud van de zaakschermen) | 2,56 | 6,18 |
| `#857007` (de logotoon) | 3,94 | 4,02 |
| `#C0A544` (`--gold-tekst`) | 1,95 | **8,11** |
| `#5E4F05` (`--gold-diep`) | **6,55** | 2,42 |

De logotoon haalt het dus op géén enkele grond, en `--rtg-leesgoud` -- het token
dat hier al voor bestaat -- wees op champagne naar precies die toon. Rechtgezet,
en aangezet op de 933 plekken waar goud TEKST is; randen, vullingen en het
beeldmerk houden hun goud.

Dezelfde vorm bleek te gelden voor drie andere tonen, en die hebben nu allemaal
een leestoken per thema: het **groen** (de stand *vrij*, *gezond*), de **zachte
onderregel** en het **rood** (*druk*, *verwijderen*). Alle vier zijn ze
**dekkend**, en dat was toen om een reden die inmiddels vervallen is: de keuring
sloeg een voorgrond met alfa over, dus een zachte toon daarheen sturen zou de
bevinding laten *verdwijnen* zonder hem op te lossen. Dat gat is een dag later
gedicht — zie *de alfa* hieronder — en dekkend zijn ze gebleven, nu om een betere
reden: een alfa zegt iets over sluier en niets over leesbaarheid.

Daarmee ging de ronde van **470 naar 0** op alle drie de thema's, en die nul is
hard.

**EN DE GROOTSTE BLINDE VLEK WAS NIET DE GROND MAAR DE LETTER.** Hierboven stond
dat de poort 83% van de tekst weegt en dat de rest een `url()` als achtergrond is
of een keten die tot de wortel doorzichtig blijft. Die 83% was een schatting, en
op 20 augustus 2026 is hij nageteld over alle schermen in drie thema's. **5977
tekstelementen: 3346 gewogen (56%), 663 overgeslagen om een `url()` (11,1%), nul
om een doorzichtige keten** — die reden stond dus op papier zonder ooit te zijn
voorgekomen — **en 1968 (32,9%) om iets dat hier helemaal niet stond: hun
KLEUR had een alfa.** (Dat was een losse telling; sindsdien telt de poort het
zelf, zie onderaan deze alinea.) De keuring deed daar `if (fg[3] < 1) return`, en dat is
precies de groep waar `--rtg-muted` en `--rtg-soft` in wonen. De poort keek langs
de tekst waar hij het hardst nodig was.

Rekenen kon gewoon — het is dezelfde som die de keuring al op doorzichtige
ACHTERGRONDlagen doet. `opGrond()` mengt de letter nu over elke grondkandidaat en
weegt daarna, per kandidaat, want over een verloop is dezelfde letter op elke toon
een andere kleur. Wat nog steeds stopt: een letter met alfa **nul**. Dat is geen
bleke letter maar een onzichtbare, gebruikt om tekst door een achtergrond te laten
tekenen; daar valt geen verhouding van te maken die iets betekent.

**En het getal komt sindsdien uit de meting zelf.** Dat een percentage over de
dekking met de hand geteld in twee documenten stond, is precies waarom het kon
verouderen zonder dat iemand het merkte. `scripts/a11y.js` telt het nu per ronde
mee en sluit ermee af, zodat het niet meer kan wegzakken:

> `[a11y] dekking: van 28494 zichtbare tekstelementen zijn er 24102 gewogen
> (84,6%); 4392 overgeslagen om een onberekenbare grond (15,4%), 0 om een letter
> met alfa nul (0,0%).`

Die 15,4% is één ding: een `url()` als achtergrond, een foto. Daar valt zonder de
pixels niets van te rekenen, en dat blijft zo.

Wat er daarmee zichtbaar werd was groot: **2844 bevindingen op de drie
thema-ronden en 49 in de twee gewone staten**, en 795 van de voorbeelden waren
twee tokens. `--rtg-soft` en `--rtg-muted` waren zelf de grootste bron van
onleesbare tekst in dit huis. De oorzaak is dat **alfa de verkeerde knop is**:
"56% van de inkt" is geen besluit over leesbaarheid maar over sluier, en wat het
oplevert hangt af van de grond. Op onyx haalde 0,56 vlot 5,6:1, op parelmoer 3,5
en op fluweel 3,6 — dezelfde regel, drie uitkomsten, waarvan twee onleesbaar.

Ze zijn nu dekkend en per thema uitgerekend, met een regel die na te lopen is: de
zachte toon is **zo zacht als de norm toelaat** (de lichtste tint die op de ergste
grond van dat materiaal nog 4,85:1 haalt), de gedempte toon staat **halverwege**
tussen die vloer en de volle inkt. "De ergste grond" is opgesomd en niet gegokt:
elke stop van het glansverloop, elk van de zestien dagkleuren daarover, en de twee
kaartvlakken daar weer overheen. `test/thema.test.js` rekent dat na zonder
browser.

Wat dat kost, hoort er eerlijk bij te staan: **op fluweel is er nauwelijks
ruimte.** De lichtste bordeaux-stop haalt met de volle ivoren inkt maar 6,40:1,
dus liggen de drie treden daar op 6,4 / 5,6 / 4,9 in plaats van op 11,5 / 8,2 /
4,9 zoals op parelmoer. Op velours draagt de hiërarchie dus meer op maat en
gewicht dan op toon — dezelfde uitkomst als bij het goud, dat op fluweel ook al
ivoor werd.

De rest was negen schermen die hun eigen vlak schilderen en hun eigen inkt niet,
of niet specifiek genoeg. Twee daarvan zijn het vermelden waard omdat ze een
patroon zijn en geen incident: op `app.html` is het bureau rondom de schil altijd
zwart terwijl de inkt de themakeuze volgt, dus las alles wat BUITEN de schil landt
1,06:1 onder champagne; en de website die een LID bouwt is een eigen document,
maar `body.rtg-stijl .sub` uit de RTG-laag won van `.b-hero .sub` uit de bloklaag
en verfde de hulptekst in de sitemaker onleesbaar. Dat laatste raakt ook een
bezoeker van een gepubliceerde site, die geen lid is en niets aan die kleuren kan
doen.

**EN DE POORT ZELF WIEBELDE, DOORDAT PAGINA'S BIJ HET OPENEN VAN KLEUR
VERANDERDEN.** De eerste grenzen zette ik op één meting, en de ronde daarna zakte
de scan. Dat bleek geen ruis: `shared/seizoen.css` zette een overgang van 0,8
seconde op de achtergrondkleur van elke `body`, bedoeld voor de wisseling van het
licht ("als een zonsondergang") — maar hij gold ook bij de eerste weergave. Elke
pagina fadede bij het openen dus bijna een seconde van de kleur waarmee hij begon
naar de kleur die hij hoort te hebben, en de keuring meet op 600 ms precies daarin.
De overgang wordt nu pas een frame ná de eerste toepassing gearmeerd. Gemeten over
drie ronden daarna: de wiebel ging van zes naar één. Dat is niet alleen een
stabielere poort maar ook een pagina die meteen de goede kleur heeft.

**DE NUL BIJ CONTRAST WAS NOOIT WAAR, EN DAT IS OP 19 AUGUSTUS 2026 GEBLEKEN.**
De keuring gaf op zodra er ergens in de keten een verloop stond -- en de themalaag
geeft `body` er een. Gemeten over alle 258 schermen in twee thema's: **1884
tekstelementen werden gewogen en 3042 werden overgeslagen**, alle 3042 om die ene
reden. De poort mat dus 38% van de tekst en meldde daarover nul. Hij rekent
verlopen en doorzichtige lagen nu uit (`gronden()` in `scripts/a11ykeuring.js`)
en woog daarmee 56% — niet de 83% die hier een dag lang stond. Dat getal was een
schatting en die hoort hier niet; zie *de alfa* hieronder voor de telling en voor
wat er daarna nog buiten valt.

Wat daarmee zichtbaar werd waren eerst drie systeemfouten -- de juridische
pagina's met zwart op zwart, de grote iOS-titel licht op licht, en gedeelde
componenten die het thema niet volgden -- en daarna een staart van zestig losse
gevallen. **Alle zestig zijn gerepareerd**, bij de bron en niet per scherm: negen
plekken in gedeelde bladen en zes op een scherm. De nul staat er dus weer, en hij
betekent nu iets anders dan de vorige: hij gaat over 56% van de tekst in plaats
van 38%, en sinds de dag erna over 84,6% -- een getal dat de poort zelf meet en
aan het eind van elke ronde noemt. Wat er nog buiten valt staat met naam in
`A11Y-INGELOGD.json`.

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

**Sinds 19 augustus 2026 draagt de telefoonronde die inkeping wel**, en de
uitkomst was rustig: over 254 schermen met een statusbalk van 59 en een
thuisstreep van 34 kwam er **geen enkel nieuw gebrek** bij. De rest van dit huis
deed de veilige zone dus al goed; alleen de Command-modus-familie deed het niet.

**En de tabletband wordt nu ook gemeten** — 834x1112, ingelogd. Die band was
nooit door een browser getekend, en dat was geen detail: twee gebreken bestonden
alleen daar. Op `/apps/rtg.html` is een dossierregel een link naar een
betaalpagina die op 390 afbreekt en 74 hoog meet, en op 700 en 834 op één regel
past en 20 meet; op `/apps/salon.html` geldt hetzelfde voor de naam boven een
post. **Onzichtbaar voor de raakvlakronde, want die meet 390 — waar het
toevallig goed gaat.**

**Twee deuren die dicht stonden, staan nu open.** `bord.html` en `schrift.html`
hangen achter een tijdelijke schoolpas, en hier stond dat die niet te maken was
zonder een model. Dat was verkeerd gemeten: `/api/les/maak` heeft een handmatige
werkmodus. De keuring maakt nu zelf een les aan — en de eerste keer dat
`bord.html` werkelijk openging lag er meteen een gebrek (de dikte-schuifregelaar
op 96x16). Dat is nu twee keer hetzelfde patroon, na de RTF-gezinsdeur:
**elke deur die dicht blijft in een keuring is een stuk huis waarvan niemand
weet wat er staat.**

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
