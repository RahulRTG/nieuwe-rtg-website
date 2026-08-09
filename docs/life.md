# RTG Life: het lifestyle- en welzijns-OS

Dit is de architectuurnotitie voor RTG Life. Ze beschrijft één idee, en dan
eerlijk wat daar vandaag van staat en wat niet.

**Het idee.** Een lid hoeft niet te weten of hij Vitaal, Balans, Sport of de
Zorg-tab moet openen. Hij weet dat hij moe is, dat hij naar de kapper moet, of
dat hij weer eens wil bewegen. RTG bepaalt welke onderdelen dan relevant zijn en
brengt ze samen. De losse apps blijven bestaan als motor; ze worden diensten
binnen één omgeving in plaats van elf ingangen waaruit je moet kiezen.

**Waarom deze notitie bestaat en niet meteen de code.** De onderdelen die hier
nog niet staan zijn geen kleine bouwsteentjes: een doelenmotor, een slaaplaag,
een voedingslaag en een coach raken allemaal aan hetzelfde gevoelige profiel.
Wie ze los bouwt en later verbindt, bouwt de scheiding tussen lifestyle en zorg
achteraf in, en dat is precies de volgorde die niet werkt. De grenzen onderaan
deze notitie horen vast te staan vóór de eerste motor erbij komt.

Regel 6 van `LAT.md` geldt hier hard: een belofte in tekst is een belofte in
code. Alles onder "wat er staat" is aan te wijzen in een bestand en draait onder
een toets. Alles onder "wat er niet staat" is niet gebouwd, hoe redelijk het ook
klinkt.

---

## Wat er vandaag staat

| onderdeel | waar | wat het doet |
|---|---|---|
| Zorg (spa, wellness, kliniek) | `server/kern/care.js`, `care/leden.js`, `care/zaak.js` | behandeling boeken bij een behandelaar in een tijdslot, betalen via RTG Pay |
| Verzorging (kapper, barbier, nagels) | `server/kern/verzorging/beautyleden.js` | dezelfde salonagenda als de zaak zelf, maar dan vanaf de kant van het lid, op codenaam |
| De Zorgbalie (behandelaar) | `server/kern/care/zaak.js`, tab in `public/apps/personeel.html` | dagagenda per behandelaar, zorgcontext vóór de behandeling, afronden |
| Zorgprofiel + toestemming | `server/kern/gastzorg.js` | allergenen, dieet en aandachtspunten die alleen meereizen als het lid delen aanzet |
| Intake-deling per aanbieder | `server/kern/care/leden.js` | medische context, uitdrukkelijk, per kliniek, 90 dagen, altijd te stoppen |
| Rust en ritme | `server/kern/balans.js` | weekbeeld uit de agenda, advies om ook eens niks te doen; geen streaks |
| Dagelijkse check-in | `public/apps/vitaal.html` + de veiligheidskern | één knop per dag; de klok loopt op de server, dus stilte is het signaal |
| Sport | `public/apps/sport.html`, `sportclub.html`, `server/kern/clubs.js` | activiteiten, clubs, lessen, banen |
| Gezin | `public/apps/foundation/gezondheid.html`, `gevoel.html`, `rust.html` | gezinsgezondheidsboekje, hoe voel je je, even rust |
| Toegankelijkheidsprofiel | `server/kern/toegankelijk.js`, `public/shared/toegankelijk.js`, kop van `shared/basis.js` | tekstgrootte, contrast, beweging en onderstreepte links, op elke pagina die `shared/basis.js` laadt |
| Doelenmotor | `server/kern/doelen.js`, `public/apps/doelen.html` | beginpunt, streefpunt, datum en reden; mijlpalen worden afgeleid, dus een gemiste week is een ander pad en geen mislukking |
| Het ene scherm | `server/kern/life.js`, `public/apps/life.html` | leest ritme, doelen, afspraken en check-in bij elkaar; meet zelf niets en legt niets vast |
| Dagmetingen | `server/kern/metingen.js`, invulvak op `apps/life.html` | slaap, beweging en water, door het lid zelf ingevuld; een dag heeft één waarde |
| Herkomst van gegevens | `server/kern/herkomst.js` | vier soorten, en alleen wat er echt is staat aan; gedeeld door de doelenmotor en de metingen |
| Gekoppelde toestellen | `server/kern/toestellen.js`, vak op `apps/life.html` | een horloge of weegschaal schrijft dagmetingen weg met een eigen smalle sleutel, altijd in te trekken |
| Consent Center | `server/kern/consent.js`, `public/apps/toestemming.html` | zeven lagen toestemming op één scherm; intrekken gaat naar de bron |
| Behandelaar legt vast | `server/kern/care/vastleggen.js` | een zorgaanbieder mag met aparte toestemming een meting in het dossier zetten, via een afspraak bij zichzelf |
| De grens (drie niveaus) | `server/kern/zorgniveau.js` | lifestyle, professioneel, klinisch; bij crisis en medicatie houdt RTG op en wijst het de weg naar echte hulp |
| Dagcheck-in | `server/kern/gemoed.js`, blok op `apps/life.html` | hoe zit u erbij, met de keuze tussen erover schrijven of gewoon iets doen |
| Gewoonten | `server/kern/gewoonten.js`, blok op `apps/life.html` | kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem aanzet |
| Inzage-audit | `server/inzagelog.js` | wie welke identiteitsgegevens opvroeg, en waarom |
| Identiteitskluis | `server/accounts.js` | echte namen apart; alles daarbuiten draait op codenamen |

Wat deze rij bij elkaar houdt is het toestemmingsmodel, en dat is het meest
waardevolle dat er al staat: niets zonder een "ja", per ontvanger, met een
einddatum, altijd te stoppen. RTG Life hoort daarop verder te bouwen en niet
naast een tweede model te gaan staan.

## Wat deze ronde is rechtgezet

1. **Een echte categorie.** De App-Bibliotheek had acht categorieën en geen
   ervan ging over gezondheid; Vitaal stond onder veiligheid, Balans onder geld
   en Sport onder spelen. Er is nu `leven` ("Leven & gezondheid",
   `server/kern/appcatalogus-data.js`) en die drie staan daar. Ze draaien nog op
   dezelfde kernen als eerst: de categorie zegt waar iemand zoekt, niet waar de
   code woont.

2. **Verzorging aan de consumentenkant.** De salon (`kern/verzorging/beauty.js`)
   bestond alleen voor de zaak zelf: een lid kon nergens een knipbeurt boeken.
   Er is nu een ledenlaag op dezelfde bak, met een eigen blok in de Zorg-tab.
   Zorg en verzorging staan naast elkaar maar niet door elkaar: het salonblok
   draagt geen zorgprofiel en kent geen intake, en zegt dat ook op het scherm.

3. **Balans stond verkeerd beschreven.** De catalogus en de appgids noemden hem
   allebei een geldapp ("je saldo en tikgeschiedenis", "de boekhoudhulp"),
   terwijl `kern/balans.js` over rust, ritme en ontprikkelen gaat. Beide teksten
   zijn gelijkgetrokken met wat de code doet.

Bij dat derde punt hoort een aantekening die eerlijker is dan een vinkje: er is
geen machine die dit bewaakt. Drie plekken beschrijven dezelfde app (de pagina,
de catalogusregel, de gidsentry) en niets vergelijkt ze. `LAT.md` regel 6 noemt
dat met naam: voor proza bestaat geen handhaver. Deze drift is met de hand
gevonden en met de hand hersteld, en kan met de hand terugkomen.

Dat is bewust zo gebleven. Voor de twee ANDERE gaten uit deze notitie is
inmiddels wel iets gebouwd -- de salon heeft eigen openingstijden, en op het
consent-register let `test/consent-dekking.test.js` mee -- maar of twee stukken
proza elkaar tegenspreken, is niet machinaal te beslissen. Een controle die dat
zou proberen, wordt een controle die je moet wegstrepen, en die wordt binnen een
week genegeerd.

## Wat er niet staat

Niet gebouwd, en dus ook niet half. Voor elk hiervan geldt: er is geen module,
geen route en geen toets.

- **Stress, herstel, trainingsbelasting.** Geen van deze bestaat als laag.
- **Voeding als getal.** Er wordt niets gevraagd, want een lid kan zijn voeding
  niet in een eerlijk getal zetten. RTG Life leidt er iets naast af (hoe vaak er
  buiten de deur gegeten is, uit het grootboek) en zegt erbij dat het een
  afgeleide is.
- **Wat je moet DOEN om een doel te halen.** De doelenmotor rekent een pad uit
  tussen twee getallen; hij zegt niets over trainen, eten of gezondheid. Dat is
  geen tekort maar de grens uit deze notitie: dat is professional-supported of
  clinical werk, en dat staat er niet.
- **De dagcoach** die een dag indeelt (ontbijt, wandeling, training, avondroutine).
  Het scherm zegt wel waar vandaag het meeste te winnen valt, maar plant niets.
- **De rest van de toegankelijkheid.** Het profiel dat er nu is doet vier
  dingen (zie hieronder); eenvoudige taal, een taak per scherm,
  schermlezer-teksten en spraakbesturing staan er bewust niet in, want die zijn
  per pagina werk en geen schakelaar. ADHD- en autismemodus bestaan niet.
- **Coach-marktplaats en coachportaal.**
- **Multi-vestiging voor zorgorganisaties, resource-planning, wachtlijstmotor.**

## Het toegankelijkheidsprofiel, zoals het nu werkt

Vier instellingen, in te stellen op `apps/ik.html` onder "Hoe het scherm zich
gedraagt": tekstgrootte (normaal, groot, nog groter), contrast, beweging en
onderstreepte links. `server/kern/toegankelijk.js` is de enige plek waar staat
welke er zijn; het scherm rendert de schakelaars uit die lijst, dus een optie
erbij is één regel daar.

**Waarom deze vier en niet meer.** Dit zijn precies de dingen die een gedeelde
laag kan waarmaken zonder dat een app er iets voor doet. De tekstmaat werkt
omdat de hele familie in `rem` meet: ruim drieduizend plekken, en precies één in
`px`. Contrast tilt de twee gedempte tinten van het huis op (dezelfde `#F4F1EC`,
alleen minder doorzichtig), dus er komt geen kleur bij die niet van het merk is.
Een schakelaar aanbieden voor iets dat per pagina gebouwd moet worden, zou een
belofte zijn die de code niet waarmaakt.

**Twee wegen, en de snelle telt.** De stand staat in `localStorage` en wordt
bovenin `shared/basis.js` meteen toegepast; `shared/toegankelijk.js` haalt hem
daarna bij de server op zodat een tweede toestel hem ook krijgt. Die volgorde is
geen optimalisatie maar de functie zelf: wie grote tekst nodig heeft, hoort geen
flits kleine tekst te zien terwijl de server nadenkt.

Dat onderscheid heeft de toets zelf moeten leren. De eerste versie mat de
tekstgrootte pas nadat beide wegen klaar konden zijn, en bleef groen terwijl de
snelle weg was weggehaald -- afgeslagen, en dus een bevinding. `test/toegankelijk-scherm.e2e.js`
snijdt nu de server-weg af en meet wat er dan nog staat.

**Waar het niet werkt.** Contrast raakt alleen pagina's die de huis-tokens
(`--rtg-txt`, `--rtg-soft`, `--rtg-muted`, `--rtg-line`) gebruiken; een pagina
die haar grijstinten hard invult, verandert niet mee. Tekstgrootte en beweging
raken alles. En zonder eigen account is er niets om bij de server te bewaren:
de instelling blijft dan op dat ene toestel staan.

## De doelenmotor, zoals hij nu werkt

Een doel is vier dingen: waar u begon, waar u heen wilt, wanneer, en waarom. De
reden is verplicht, en dat is een keuze: een doel zonder waarom is het eerste
dat sneuvelt in een drukke week.

**Mijlpalen worden afgeleid, niet bewaard.** Dat is de hele motor. Een lijstje
mijlpalen dat vastligt, loopt uit de pas zodra het leven anders loopt, en dan is
er een "programma aanpassen"-knop nodig die niemand indrukt -- waarna het lijstje
liegt. Hier wordt het pad elke keer opnieuw berekend vanaf waar u NU staat en
hoeveel tijd er nog is. Een gemiste week is dan geen mislukking en ook geen
ingreep: het pad dat overblijft is gewoon een ander pad. Uw beginpunt schuift
daarbij nooit mee, dus u begint ook nooit opnieuw.

**Geen meting is niet nul.** Zonder meting staat er "nog niets gemeten" en geen
0%. Bij een doel is het verschil tussen geen gegevens en slecht geen detail
(`LAT.md` regel 3).

**Elke meting draagt haar herkomst.** Vandaag kan die er maar één zijn (`zelf`),
want er is geen apparaat dat meet en geen behandelaar die vastlegt. Het veld
staat er nu al in omdat een meting zonder herkomst later niet meer te
onderscheiden is van een gemeten of afgeleide waarde -- en dan is het te laat.
Een verzonnen herkomst wordt geweigerd en telt niet stil als `zelf`.

**De uitweg is een knop, geen mislukking.** De streefdatum verzetten rekent het
pad opnieuw uit vanaf waar u staat. Zonder die knop is de enige uitweg uit een
doel dat niet meer past, het doel weggooien -- en dat is dan ook precies wat
mensen doen.

Wat een toets hier heeft geleerd: de eerste versie beweerde dat het pad steiler
wordt als er minder tijd over is, en bleef groen toen de mijlpalen vanaf de
nulmeting werden gerekend in plaats van vanaf de meting -- een pad dat bij 3 km
begint terwijl je 4 km loopt, oftewel precies "opnieuw beginnen". De bewering is
nu dat elke mijlpaal VOOR je ligt en nooit achter je, en dat ziet het wel.

## RTG Life, het scherm

Een lid hoeft niet te weten of hij Doelen, Balans, Zorg of Vitaal moet openen.
`apps/life.html` leest die lagen en zet ze naast elkaar: ritme (uit de agenda),
doelen, komende afspraken bij zorg en verzorging, en de dagelijkse check-in.

**Het meet zelf niets en legt niets vast.** Er staat geen enkele nieuwe bak
achter dit scherm. Dat is met opzet: een overzicht dat zelf gaat bijhouden,
wordt een tweede waarheid naast de laag waar het vandaan kwam. Een doel dat je
bij Doelen stopt, is hier meteen weg -- daar is een toets voor.

**En het verzint geen cijfers.** Voor slaap, beweging en voeding is geen bron
aangesloten. Ze staan er dus als "niet gemeten", met de reden erbij, en zonder
getal. Niet weggelaten (dat leest als "hier valt niets te halen") en niet op nul
(dat leest als een slechte uitslag). Bij welzijn is dat verschil geen detail.

**Een kapotte laag is zichtbaar.** Doet een van de lagen het niet, dan staat dat
bovenaan het scherm met de naam van de laag erbij. Anders zien "geen afspraken"
en "de zorglaag is stuk" er hetzelfde uit. Die vorm ving meteen een echte fout:
`kern.balans` is een object terwijl doelen, care en de veiligheidskern hun
functies plat in de kern hangen, en de toets meldde "de laag Balans is niet
aangesloten" op een systeem waar Balans gewoon draaide.

**Stilte is een geldige uitkomst.** Bovenaan staat waar vandaag het meeste te
winnen valt, en een van de antwoorden is "er is niets dat om uw aandacht
vraagt". Een scherm dat elke dag iets dringends moet vinden, verzint het op den
duur; dat is precies het engagement-patroon dat `CLAUDE.md` verbiedt. Ook hier
leerde een mutatie iets: de tak die dat zegt stond onder geen enkele toets, dus
"Er is vandaag veel te doen" eronder schuiven bleef groen. Nu niet meer.

## De dagmetingen, en waarom er drie zijn

Slaap, beweging en water: drie dingen die alleen het lid weet en die hij in een
eerlijk getal kan zetten. Ze staan in het invulvak op RTG Life zelf, want daar
staan ook de signalen die ze voeden -- een lege rij met een invulveld eronder is
iets anders dan een lege rij waar je niets aan kunt doen.

**Waarom voeding er niet bij staat.** Een lid kan niet zeggen "mijn voeding was
vandaag een 7" zonder dat dat getal verzonnen is, en een cijfer dat eruitziet als
een meting is precies wat dit huis niet doet. Wat er wel is, is hoe vaak er
buiten de deur gegeten is; dat rekende `kern/balans.js` al uit het grootboek.
Dat signaal staat er dus met herkomst `afgeleid` en met die zin erbij.

**En daar zit meteen het onderscheid dat deze ronde draagt.** Slaap zonder
invulling is "niet gemeten": er is geen bron. Voeding met nul bestellingen is
een échte nul: het grootboek is compleet. Een scherm dat die twee hetzelfde
toont, liegt in een van beide richtingen. `test/life.test.js` houdt allebei vast.

**Een dag heeft één waarde.** Twee keer invullen overschrijft. Anders telt een
correctie als een tweede nacht en klopt het gemiddelde niet meer. Het aantal
dagen dat echt is ingevuld gaat mee naar het scherm: een gemiddelde over één
nacht is geen weekbeeld, en dat hoort een lezer te zien.

**De herkomst staat nu op één plek.** `kern/herkomst.js` kent de vier soorten
uit deze notitie (zelf, apparaat, behandelaar, afgeleid) en zegt welke er
beschikbaar zijn. De doelenmotor had zijn eigen lijstje en de metingenlaag zou
er een tweede krijgen; twee lijstjes met dezelfde waarheid lopen uiteen, meestal
zonder dat iets klaagt (`LAT.md` regel 4). Een herkomst die bestaat maar nog niet
beschikbaar is (`apparaat`) wordt geweigerd en valt niet stil terug op `zelf` --
anders staat een apparaatmeting die nog niet bestaat straks als eigen woord van
het lid in de boeken. Beide kanten toetsen die regel.

## Toestellen: de tweede herkomst

Een horloge, weegschaal of band die zelf meet, mag dagmetingen wegschrijven. Dat
maakt `apparaat` de tweede beschikbare herkomst naast `zelf`; `behandelaar`
blijft uit, want er is geen deur waardoor een behandelaar iets vastlegt.

**De sleutel is smal, en dat is de hele veiligheidsgedachte.** Een toestel krijgt
géén ledentoken maar een eigen sleutel die precies één ding kan: een dagmeting
wegschrijven voor het lid dat hem aanmaakte. Geen agenda, geen betalingen, geen
dossier. Een gestolen horloge kost daarmee hooguit verzonnen slaapuren, en niet
een sessie. `test/toestellen.test.js` loopt vijf ledenroutes langs en eist op elk
een 401.

**De sleutel staat niet in de database.** Bewaard wordt een sha256-afdruk; het
lid ziet de sleutel één keer bij het koppelen en daarna nooit meer. Op het scherm
overleeft hij het hertekenen maar niet het herladen, en dat staat er ook bij.

**Voor wie er geschreven wordt, volgt uit de sleutel** en staat niet in het
verzoek. Anders zet het toestel van de een een nacht bij de ander in de boeken.

**Geen slot met een teller, met reden.** `LAT.md` regel 7 zegt dat een grendel
aan het doel hangt, en `pinslot.js` is het gedeelde slot voor ráádbare geheimen
-- een pin van vier cijfers loopt in een uur af. Deze sleutel is 24 willekeurige
bytes uit de CSPRNG; die valt niet af te lopen, en een teller eromheen sluit
vooral een toestel met een slecht netwerk buiten. Wat er wél is: intrekken, en
dat werkt meteen.

**Intrekken wist geen geschiedenis.** Wat het toestel mat, is echt gemeten; die
metingen blijven staan met hun herkomst. Alleen schrijven stopt.

**Twee beweringen over dezelfde nacht botsen niet.** Zegt u zelf acht uur en meet
het horloge zes en een half, dan staan ze er allebei. Het gemiddelde gebruikt het
apparaat -- die heeft gemeten, u heeft geschat -- en het beeld draagt twee
lijstjes: `herkomsten` (waar dit getal vandaan komt) en `naast` (wat er nog meer
staat maar niet is meegeteld). Ze samenvoegen zou het gemiddelde een herkomst
geven die er niet in zit; het tweede weglaten zou uw invulling laten verdwijnen.

**En de herkomst komt uit de deur, nooit uit het verzoek.** Toen `apparaat` een
echte herkomst werd, bleek de doelenmotor `body.bron` te lezen -- een lid had
zijn eigen schatting als apparaatmeting kunnen boeken. Beide schrijvers krijgen
de herkomst nu van de route mee.

## Het Consent Center

`apps/toestemming.html` zet zeven lagen naast elkaar: medische context bij een
zorgaanbieder, zorgaanbieders die iets in uw dossier mogen vastleggen, diensten
die met RTG iD gegevens ophalen, mensen die namens u mogen inloggen, zaken die
live meekijken, het zorgprofiel dat meereist met bestellingen, en toestellen die
metingen wegschrijven.

**Het bewaart niets, en trekt in bij de bron.** Er staat hier geen eigen
vlaggetje dat zegt of iets nog mag; intrekken roept de stopfunctie van de laag
zelf aan. Anders zou dit scherm kunnen melden dat iets uit staat terwijl de laag
het nog toelaat -- een tweede waarheid over toestemming, en dat is de
gevaarlijkste soort (`LAT.md` regel 4). De toets kijkt daarom na elke intrek bij
de **eigen app** van die laag of het er echt af is.

**Het gevaarlijkste aan dit scherm is onvolledigheid.** Een overzicht dat "wie
ziet wat" heet en er drie vergeet, is erger dan geen overzicht: het geeft
zekerheid die er niet is. Daarom staat er een register van gedekte lagen in
`kern/consent.js`, en staan de niet-gedekte dingen er **met reden** bij (wat u
in De Salon plaatst, uw veiligheidskring, uw dagcheck-in, wat een zaak van een
boeking weet).

**En er let iets op dat register.** `test/consent-dekking.test.js` zoekt in
`server/kern/` naar de vórm van een toestemming -- een rij met een `key` en een
`status: 'actief'` -- en eist dat elke module die hem heeft, in het register
staat of daar een reden krijgt. Een nieuwe laag zakt dus met naam en toenaam;
een verzonnen module met precies die vorm is er een keer doorheen gehaald om te
zien dat de scan uitslaat. Wat hij NIET vindt is een andere vorm: RTG iD
gebruikt een `ingetrokken`-vlag en staat in het register omdat een mens hem erin
zette. Het gat is kleiner, niet weg, en het scherm zegt dat ook zo.

**Zien en schrijven zijn niet hetzelfde.** Een kliniek *ziet* iets; een toestel
*schrijft* iets; een gemachtigde *handelt namens u*. Die drie staan met een eigen
label op het scherm, want ze op één hoop gooien maakt "toegang" een woord zonder
inhoud. Een machtiging die u krijgt is geen toestemming die u geeft en staat er
dus niet bij.

**Uitzetten is niet weggooien.** Het zorgprofiel niet meer laten meereizen laat
het profiel zelf staan; anders raakt u uw eigen allergenenlijst kwijt bij het
uitzetten van een deling. Hetzelfde geldt voor een ingetrokken toestel: wat het
mat, blijft staan.

## De derde herkomst: een behandelaar legt vast

De eerste laag waarin iemand anders dan het lid in het dossier van dat lid
schrijft. Een zorgaanbieder kan bij een afspraak een meting vastleggen -- het
gewicht bij een consult -- en die draagt herkomst `behandelaar` én de naam van
wie hem vastlegde. Niet "een behandelaar" maar wélke.

**Het is een APARTE toestemming, en met opzet niet de intake.** De intake gaat de
andere kant op: daar deelt het lid iets mét de aanbieder. Hier legt de aanbieder
iets vast ín het dossier. Dat een kliniek uw bloedverdunner mag weten, betekent
niet dat ze uw gewicht in uw dossier mag zetten. Wie die twee op één schakelaar
zet, zegt het ene en doet het andere; er staat een toets op dat de intake géén
schrijfrecht geeft.

**De afspraak is de ingang.** Een behandelaar schrijft nooit op codenaam maar
altijd op de referentie van een afspraak bij zijn eigen aanbieder. Er valt dus
niets te raden en niets op te zoeken, en een kliniek kan niet schrijven op een
afspraak bij de spa -- ook niet als dat lid de spá toestemming gaf.

**Gewicht is er als onderwerp bij gekomen**, en dat is geen toeval: het is het
enige waar alle drie de schrijvers samenkomen. U stapt zelf op de weegschaal,
een slimme weegschaal meldt het, en een kliniek weegt u. Daarmee is de rangorde
uit `kern/herkomst.js` op één onderwerp te zien: de behandelaar gaat voor het
apparaat, het apparaat voor uw eigen schatting. De andere twee verdwijnen niet
-- ze staan in `naast`.

**Het lid krijgt bericht.** Iets in uw dossier dat er stil bij komt, is het
tegenovergestelde van wat deze laag moet zijn.

**Intrekken stopt het schrijven en wist niets.** Wat de behandelaar mat, is echt
gemeten en blijft staan met zijn naam erbij -- net als bij een ingetrokken
toestel.

Het herkomstregister heeft nu vier beschikbare soorten en dus vier deuren. De
toets somt ze letterlijk op, zodat een vijfde soort die iemand op beschikbaar
zet zonder deur er meteen doorheen zakt. Dat is de enige manier waarop dat
register een belofte blijft en geen lijstje wordt.

## De grens, en waarom hij er eerder is dan het gesprek

`kern/zorgniveau.js` bestaat vóór er iets is om mee te praten. Dat is de hele
volgorde: het veiligheidsmodel hoort in de architectuur en niet in een latere
ronde, want een grens die je achteraf om een werkende functie heen bouwt, wordt
een tekstje onderaan.

**Drie niveaus.** *Lifestyle* -- ritme, rust, structuur; hier mag RTG meedenken.
*Professioneel* -- iets waar een mens bij hoort; RTG mag de weg wijzen, niet de
inhoud geven. *Klinisch* -- crisis, zelfbeschadiging, medicatie, diagnose; hier
houdt RTG op. Geen advies, geen geruststelling, geen "even samen kijken".

**De grens is code en geen prompt.** Wat wordt aangewezen levert `mag: false` op
en er is geen veld waarmee een aanroeper dat omzet. Een taalmodel dat zijn eigen
veiligheidsregel mag uitleggen, is geen veiligheidsregel. Er staat een toets op
die `mag: true` meestuurt en toch `mag: false` terugkrijgt.

**En bij een crisis verdwijnt de rest.** Geen ademhalingsoefening, geen
doe-lijst, geen patroonpraatje -- alleen de weg naar hulp, met een nummer dat
een mens opneemt (113 Zelfmoordpreventie, de huisartsenpost, 112). Dat is de
scherpste bewering van deze laag en hij wordt aan twee kanten getoetst: in de
motor én op het scherm.

**Dit is een vloer, geen filter.** Wat er doorheen komt is niet "veilig
bevonden" -- het is alleen niet herkend. Een woordenlijst mist omschrijvingen,
understatement, ironie en elke taal die er niet in staat. Wie hem ooit als
filter gebruikt ("het sloeg niet aan, dus het mag"), gebruikt hem verkeerd. Dat
staat zo in het bestand.

**Aanhoudend zwaar is geen crisis en geen diagnose.** Vijf dagen op rij is lang
genoeg om een mens te noemen, meer niet. Een goede dag ertussen breekt de reeks:
het gaat om aanhoudend, niet om optellen.

## De dagcheck-in

Eén tik, en dan de keuze die ertoe doet: er iets over schrijven, of gewoon iets
doen. Iemand die moe is wil niet altijd een gesprek; soms wil hij tien minuten
rust en verder niets. Een app die op elk gevoel met een vraag reageert, wordt
iets dat je gaat vermijden.

**Wat u opschrijft gaat nergens heen.** Er is geen deelroute, geen partnerkant
en geen kantoorkant -- dat is geen omissie maar het ontwerp. Daarom staat deze
laag in het Consent Center bij *wat dat scherm niet dekt*, met de reden erbij:
er valt niets te delen.

**Geen score, geen reeks, geen gemiddelde stemming.** Er staat een toets op die
faalt zodra er een cijfer, gemiddelde of streak in kruipt, ook onder een andere
naam. Wie zich een week niet meldt, mist niets.

**Wat er NIET is: een AI-gesprek.** Bewust. De grens staat er nu, de
niet-pratende helft werkt; een gesprek is een veel groter oppervlak en hoort pas
te komen als het door deze grens heen moet. Elke toekomstige AI-ingang op dit
onderwerp gaat langs `zorgniveau.js` of hij hoort er niet te zijn.

## Gewoonten, en de teller die uit staat

Kleine dingen die u vaker wilt doen. Eén tik zet vandaag aan, dezelfde tik zet
hem weer uit -- een vergissing hoort geen handeling in een apart menu te zijn.

**De reeksteller is een keuze, en hij staat uit.** Voor sommige mensen werkt
dagen-op-rij geweldig; voor anderen is hij precies de reden om te stoppen zodra
hij breekt. Hij gaat per gewoonte aan als het lid dat zelf wil, en weer uit
zonder dat er iets verdwijnt: de afvinkjes blijven, alleen het getal gaat weg.
Wat uit staat komt ook niet mee in het antwoord -- wat er niet is, kan niet
opduiken.

**Een gebroken reeks is geen gebeurtenis.** Geen melding, geen rood, geen "u
heeft uw reeks van twaalf verspeeld". Er staat een toets op die faalt zodra er
ook maar één woord in kruipt dat er een gebeurtenis van maakt. En vandaag telt
pas mee als hij af is: wie nog niet heeft afgevinkt, hoort niet te lezen dat
zijn reeks op nul staat terwijl de dag nog loopt.

Geen percentage, geen score, geen ranglijst, geen beste week ooit. De vorm van
een gewoonte ligt in een toets vast, zodat daar niets bij kan sluipen zonder dat
die zakt.

## De grenzen die vast moeten staan vóór de bouw

Deze horen in de architectuur en niet in een latere ronde, want ze bepalen hoe
de motoren hierboven eruit mogen zien.

**Drie niveaus, en de AI weet altijd in welk niveau hij staat.** Dit staat sinds
deze ronde in code: `server/kern/zorgniveau.js`. Zie "De grens" hieronder.

1. *Lifestyle* -- algemene ondersteuning: ritme, beweging, structuur, rust. Dit
   is waar Balans nu al staat.
2. *Professional-supported* -- een plan dat aan een echte trainer, coach of
   behandelaar hangt. De mens is de eigenaar van het plan, RTG voert uit.
3. *Clinical* -- alleen binnen daarvoor ontworpen workflows. Diagnose, triage en
   behandeladvies horen hier, en RTG doet ze vandaag niet.

De bestaande regel uit `CLAUDE.md` blijft er onverkort boven staan: de AI mag
nooit zelf toegang beloven of verlenen, en nooit claimen dat een boeking
verwerkt is. Voor medicatie geldt hetzelfde: RTG kan een afgesproken schema
ondersteunen, maar een dosering is nooit iets dat uit een taalmodel komt.

**Herkomst van gegevens.** Vier soorten die nooit door elkaar mogen lopen: het
lid zei het zelf, een apparaat mat het, een behandelaar legde het vast, of RTG
leidde het af. Zonder dat onderscheid vanaf het eerste veld wordt een afgeleide
schatting later als een meting gelezen. Dit is dezelfde fout die `LAT.md` regel
10 beschrijft voor meters, en die is hier duurder.

**Wie ziet wat.** Het bestaande intake-model (uitdrukkelijk, per ontvanger, met
einddatum, altijd te stoppen) is het model voor alles wat erbij komt. Een
masseur hoort niet te zien wat een arts ziet; een coach hoort geen
mental-coachgesprekken te zien; een werkgever die een sportbudget aanbiedt hoort
geen individuele gegevens te zien, alleen geaggregeerde. Het Consent Center
(hieronder) is de plek waar dat zichtbaar is.

**De onderkant blijft simpel.** Voor een deel van de leden is RTG Life precies
één scherm: "medicijnen genomen? ja". Dat is Vitaal, en dat is af. Een
enterprise-achterkant mag daar nooit doorheen komen. De functionaliteit mag
groot zijn; het scherm hoort dat niet te voelen.

## Wat een volgende ronde zou doen

In deze volgorde, want elke stap heeft de vorige nodig:

1. ~~Het **toegankelijkheidsprofiel**, platformbreed.~~ Gedaan; zie hierboven
   wat het wel en niet doet.
2. ~~De **doelenmotor**.~~ Gedaan; zie hierboven.
3. ~~Het **Life Compass**-scherm.~~ Gedaan; zie hieronder.

4. ~~Een **bron** voor de lege signalen.~~ Gedaan: de dagmetingen, zie hieronder.

5. ~~Een **apparaat** als tweede herkomst.~~ Gedaan: zie Toestellen hieronder.

6. ~~Het **Consent Center**.~~ Gedaan; zie hieronder.

7. ~~De derde herkomst (`behandelaar`), met de zevende consent-laag.~~ Gedaan;
   zie hieronder.

8. ~~De mentale laag, beginnend bij de **grens**.~~ Gedaan; zie hieronder. De
   check-in en de doe-kant staan er; een AI-gesprek bewust nog niet.

9. ~~**Gewoonten**, met de teller uit.~~ Gedaan; zie hierboven.

Wat daarna komt: de dagcoach, sport- en voedingslagen, de coachmarktplaats, en
de zaakkant van de zorg (multi-vestiging, wachtlijst, no-show). En het
gedachtenboek, dat bij de check-in hoort maar er nog niet is. En als er ooit een gesprek komt op het
mentale onderwerp, dan door `zorgniveau.js` heen.
