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
| Consent Center | `server/kern/consent.js`, `public/apps/toestemming.html` | acht lagen toestemming op één scherm; intrekken gaat naar de bron |
| Behandelaar legt vast | `server/kern/care/vastleggen.js` | een zorgaanbieder mag met aparte toestemming een meting in het dossier zetten, via een afspraak bij zichzelf |
| De grens (drie niveaus) | `server/kern/zorgniveau.js` | lifestyle, professioneel, klinisch; bij crisis en medicatie houdt RTG op en wijst het de weg naar echte hulp |
| Dagcheck-in | `server/kern/gemoed.js`, blok op `apps/life.html` | hoe zit u erbij, met de keuze tussen erover schrijven of gewoon iets doen |
| Gewoonten | `server/kern/gewoonten.js`, blok op `apps/life.html` | kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem aanzet |
| Wachtlijst en gemiste afspraak | `server/kern/care/wachtlijst.js` | eerder aan de beurt als er iets vrijkomt (u boekt zelf), en een no-show die niet met u meereist |
| Noodkaart | `server/kern/noodkaart.js`, blok op `apps/life.html` | een noodcontact en, als u dat wilt, uw allergenen en middelen: gelezen uit het zorgprofiel en het medicatieschema, niet gekopieerd; u toont hem zelf |
| Training | `server/kern/training.js`, `public/apps/training.html` | uw eigen trainingsschema en wat u ervan deed; aftekenen landt als beweging-meting, RTG schrijft geen training voor |
| Schakelbaar in de boardroom | `server/functies/register/cat-apps.js`, `server/kern/lidboard/catalogus.js` | elke laag hierboven is door het lid zelf uit te zetten; het toestemmingsscherm met reden niet |
| Tijdlijn | `server/kern/tijdlijn.js`, `public/apps/tijdlijn.html` | wat er in de tijd is gebeurd, gelezen uit de bestaande lagen; geen verbanden en geen score |
| Voeding | `server/kern/voeding.js`, `public/apps/voeding.html` | een weekplan voor wat u wilt eten; er wordt niets geteld en er komt geen oordeel |
| Gedachtenboek | `server/kern/gedachten.js`, `public/apps/gedachten.html` | opschrijven voor uzelf; geen model leest mee, niets wordt samengevat, en de crisisregel bewaart hier wel |
| De dagcoach | `server/kern/dagcoach.js`, blok bovenaan `apps/life.html` | alles wat vandaag ergens staat, op volgorde van de klok; hij plant niets en bezit niets |
| Medicatieschema | `server/kern/medicatie.js`, `public/apps/medicijnen.html` | wat u gebruikt, op welke tijden, en hoeveel er nog in huis is; RTG bepaalt nooit een dosering en controleert geen combinaties |
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

- **Trainingsbelasting.** Er is een trainingsschema (zie hieronder), maar geen
  belastingsmodel: geen ACWR, geen "u traint te hard", geen hartslagzones. Dat
  vraagt hartslag, slaap, herstel en een normgroep, en het is een uitspraak over
  uw gezondheid.
- **Stress en herstel.** Bestaan niet als laag.
- **Voeding als getal.** Er is nu wel een weekplan (zie hieronder), maar er wordt
  nog steeds niets geteld: een lid kan zijn voeding niet in een eerlijk getal
  zetten. RTG Life leidt er iets naast af (hoe vaak er buiten de deur gegeten is,
  uit het grootboek) en zegt erbij dat het een afgeleide is.
- **Wat je moet DOEN om een doel te halen.** De doelenmotor rekent een pad uit
  tussen twee getallen; hij zegt niets over trainen, eten of gezondheid. Dat is
  geen tekort maar de grens uit deze notitie: dat is professional-supported of
  clinical werk, en dat staat er niet.
- **Een dag die RTG indeelt** (ontbijt, wandeling, training, avondroutine). De
  dagcoach die er nu staat legt alleen naast elkaar wat het lid al ergens heeft
  staan; hij verzint geen tijdstippen. Zie hieronder waarom.
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

`apps/toestemming.html` zet acht lagen naast elkaar: medische context bij een
zorgaanbieder, zorgaanbieders die iets in uw dossier mogen vastleggen, diensten
die met RTG iD gegevens ophalen, mensen die namens u mogen inloggen, zaken die
live meekijken, het zorgprofiel dat meereist met bestellingen, toestellen die
metingen wegschrijven, en zorgaanbieders die u mogen seinen als er iets vrijkomt.

Die achtste is er gekomen doordat de handhaver hem aanwees. De wachtlijst werd
gebouwd, de scan zag een nieuwe toestemmingsvorm in `server/kern/`, en de toets
zakte met de bestandsnaam erbij. Dat is precies waar hij voor is: hij besliste
niets, hij dwong een besluit af.

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

## De wachtlijst en de gemiste afspraak

**Er wordt niemand automatisch ingeboekt.** Komt er een slot vrij doordat iemand
annuleert, dan krijgt de wachtlijst bericht en boekt wie wil het zelf. "Met
toestemming kan het automatisch" klinkt aardig, maar die toestemming zou weken
eerder zijn gegeven voor een moment dat u nog niet kende. Een seintje en een knop
is eerlijker dan een afspraak die u moet afzeggen.

**Een gemiste afspraak is geen cijfer dat met u meereist.** Een aanbieder kan
noteren dat iemand niet kwam -- dat hoort bij zijn eigen agenda -- maar er
ontstaat geen no-show-score die door het huis loopt. Dat zou een strafblad zijn
met een vriendelijke naam. De toets kijkt daarvoor aan de kant waar zo'n cijfer
wáárde zou hebben: het antwoord aan de aanbieder. Een eerdere versie keek alleen
in het overzicht van het lid en bleef groen terwijl er een telling aan de
aanbieder werd teruggegeven.

**En wat het lid krijgt is geen berisping maar een aanbod:** wilt u uw
herinnering voortaan eerder? Dat is het enige dat een gemiste ochtend echt
oplost.

## De noodkaart, en waarom er geen break-glass is

`server/kern/noodkaart.js`, met een blok onderaan `apps/life.html`.

Wat erop staat: wie er gebeld moet worden, één zin over wat iemand meteen moet
weten (maximaal 200 tekens), en desgewenst de allergenen en aandachtspunten uit
het zorgprofiel. De kaart staat standaard **uit**, en zolang hij uit staat toont
het scherm ook niets — geen grijze voorvertoning, want half getoond leest als
bijna aan.

**Hij dupliceert het zorgprofiel niet.** De allergenen worden op het moment van
tonen gelezen uit `kern/gastzorg.js`. Haalt het lid er daar één weg, dan staat
hij ook niet meer op de kaart. Een kopie zou uit de pas lopen met het origineel,
en dan leest iemand in een ambulance een allergie die vorig jaar is geschrapt —
LAT.md regel 4, en hier met de scherpste denkbare gevolgen. Wat het lid wél zelf
kiest is óf ze op de kaart mogen (`zorgErbij`), niet wat erin staat.

**Niemand kan hem opvragen.** Er zijn drie routes en die zijn alle drie van het
lid zelf. Er is met opzet geen vierde waarmee een zaak, een kantoor of een
hulpverlener de kaart van iemand anders ophaalt. Een kaart die op afstand op te
vragen is, is een dossier dat toevallig klein is.

**Wat er daarom niet is: break-glass.** Een hulpverlener die in een noodgeval
bijzondere toegang aanvraagt hoort bij een keten die hier niet bestaat:
geverifieerde professionals, een vastgelegde reden, een melding achteraf aan het
lid, en een compliance-review die de gevallen nakijkt. Een knop die "break-glass"
heet zonder die keten eronder is theater — en gevaarlijker dan geen knop, want
hij wekt de indruk dat er toezicht is. Komt die keten er ooit, dan is dat een
eigen ronde met een eigen consent-laag, geen uitbreiding van dit bestand.

Op het toestemmingsscherm staat de noodkaart daarom bij **wat dit scherm niet
dekt**, met de reden erbij: er valt niets in te trekken omdat er niemand is die
hem kan opvragen. Zonder die regel zou een lezer denken dat we hem vergeten zijn.

## Het medicatieschema, en waarom het zo saai is

`server/kern/medicatie.js`, met een eigen pagina `apps/medicijnen.html` en een
leesblok op Life.

**RTG bepaalt nooit een dosering.** Er is geen middelenlijst om uit te kiezen,
geen aanvulling op de naam, geen voorgestelde sterkte, geen maximum en geen
bijwerkingentekst. Alles wat er staat heeft het lid overgetikt van het doosje of
van de apotheek. RTG is de agenda, niet de apotheker.

**Er is geen interactiecontrole, en dat is een keuze.** "Mag dit samen met dat?"
is klinisch werk: het vraagt een onderhouden databank, aansprakelijkheid en een
beroepsgroep. Een half werkende versie is gevaarlijker dan geen, want hij wekt
vertrouwen waar niets onder ligt. Wie dit ooit bouwt, bouwt een ander product.

**Er staat nergens "neem dit nu in".** Dat is een doseerinstructie. Het scherm
zegt wat er in het eigen schema staat en wat er nog niet is afgetekend; wat
daarmee gebeurt is aan het lid en aan de arts. "Geweest en niet afgetekend" is
dan ook een constatering en geen verwijt: geen rood, geen uitroepteken, en geen
teller die bijhoudt hoe vaak het al is gebeurd.

**De voorraad is een meting, geen aanname.** Is er geen aantal ingevuld, dan
staat er niet nul maar "niet ingevuld", met de reden erbij. Is er wel een aantal,
dan telt hij af op wat het lid *aftekent* — en het scherm zegt er zelf bij dat
het zo werkt, want wie niet aftekent ziet een voorraad die te hoog staat. Liever
een eerlijk onvolledige telling dan een verzonnen volledige (LAT.md regel 3). Om
dezelfde reden valt een vertypte tijd niet stilletjes weg: de aanroeper hoort
hoeveel er is afgevallen, anders leest "08:00, halfelf" als twee ingevulde
momenten.

**De grens staat er permanent, niet als reactie.** `kern/zorgniveau.js` markeert
elk medicijnwoord als klinisch — dat filter beschermt een *gesprek*, en zou hier
de app blokkeren die het beschrijft. Daarom staat de verwijzing naar arts en
apotheek hier als een bordje aan de muur, ook op een dag dat er niets aan de hand
is. De **crisisregel** loopt er wel doorheen: wat iemand in een notitieveld
schrijft, schrijft hij ergens, en dan wordt er niets bewaard en komt de weg naar
hulp terug.

**Wat er nog niet is: een herinnering die afgaat.** Het schema kent de tijden,
maar er gaat geen melding af. Dat vraagt de serverklok en het meldingenkanaal —
zoals de Vitale check-in dat doet — en dat is een eigen ronde. Er staat daarom
ook nergens op het scherm dat RTG u zal herinneren; een belofte in tekst is een
belofte in code (LAT.md regel 6).

## De dagcoach, en waarom hij niets plant

`server/kern/dagcoach.js`, met een blok bovenaan `apps/life.html`.

Het oorspronkelijke voorstel vroeg om een Daily Coach die de dag indeelt:
ontbijt, wandeling, training, avondroutine. Dat is niet gebouwd, en de reden is
niet dat het te veel werk was.

Een dagindeling maken vereist weten hoeveel energie iemand heeft, wat er buiten
RTG in zijn dag staat, wanneer hij kinderen ophaalt, wanneer hij vergadert en wat
hij lekker vindt. Daarvan weet RTG niets. Een indeling verzinnen uit wat RTG
toevallig wel weet, levert een **zelfverzekerd verkeerd plan** — en dat is erger
dan geen plan, want het ziet er even goed uit als een goed plan. Wie zijn dag
naar zo'n schema inricht en merkt dat het niet klopt, vertrouwt het volgende
scherm ook niet meer.

Wat de dagcoach daarom wel doet: alles wat het lid vandaag al ergens heeft staan
op een rij zetten, op volgorde van de klok. Medicijnmomenten en afspraken hebben
een tijd; gewoonten, dagmetingen en de check-in hebben er geen — en die krijgen
er ook geen. Een gewoonte om kwart over drie zetten omdat het schema dan leeg is,
is precies het verzinnen waar dit onderdeel niet aan doet. Ze staan onderaan, als
"ergens vandaag".

**Hij bezit niets.** Er is één route en die leest alleen; er is geen `/dag/af`.
Afvinken gebeurt in de laag die het ding bezit, en op het scherm staat dan ook
geen enkele afvinkknop — alleen een weg naar de app waar het thuishoort. Twee
plekken die dezelfde dag bijhouden, is precies wat LAT.md regel 4 verbiedt.

**Geen score.** Er staat hoeveel er open is, want dat is een aantal dingen. Er
staat nergens "vier van de zeven" en er is geen balk die vol loopt: dat maakt van
een dag een cijfer en van een rustige dag een slechte. De toets bewaakt dat op
twee manieren — op de tekst én op de vorm van het antwoord — omdat de
tekstcontrole alleen een `voortgang: "2 van de 5"` er ongezien doorheen liet.

Rust komt uit `kern/balans.js` en niet uit dit bestand: zegt de agenda dat er
deze week geen lege dag is, dan mag dat er staan. Verzinnen doet hij het niet.

## Het gedachtenboek, en waarom de grens hier andersom staat

`server/kern/gedachten.js`, met een eigen pagina `apps/gedachten.html`.

Een plek om iets op te schrijven, voor uzelf. Wat het **niet** is: materiaal. Er
leest geen model mee, er wordt niets samengevat, er komt geen stemmingsgrafiek
uit en er verschijnt nergens een "inzicht" dat op iemands eigen woorden is
gebaseerd. Een dagboek dat geanalyseerd wordt, is geen dagboek.

Dat is geen belofte in een tekstje maar de bouw: er zijn drie routes (lezen,
opschrijven, weggooien) en er is er geen vierde. De toets kijkt daar ook op twee
manieren naar — de routes die niet bestaan, én de bron zelf, want een route
erbij is makkelijker toegevoegd dan een toets is aangepast.

**De crisisregel bewaart hier wél, en dat is het omgekeerde van de check-in.**
In `kern/gemoed.js` wordt bij een crisiszin niets bewaard: dat is een gesprek
waarin RTG antwoordt, en RTG hoort niet over die grens heen te antwoorden. Hier
antwoordt RTG helemaal niet. Iemand die op zijn zwaarste moment iets opschrijft
en zijn woorden ziet verdwijnen, wordt gestraft voor eerlijkheid — en raakt kwijt
wat hij net moest opschrijven. De notitie blijft dus staan, en de weg naar echte
hulp komt ernaast, met erbij dat RTG de tekst niet leest en niet beoordeelt: de
kaart verschijnt omdat er woorden in staan die een woordenlijst herkent.

**Versleuteling komt van beneden.** De hele database gaat door `server/kluis.js`
zodra `RTG_ENC_KEY` gezet is; dit onderdeel doet daar niets bovenop. Een tweede
eigen slot zou een tweede sleutelbeheer betekenen (LAT.md regel 4).

Wat er bewust niet is: doorzoeken over de hele historie (dat vraagt een index, en
een index is een tweede kopie van precies deze tekst) en delen. De lijst geeft de
zestig nieuwste terug en zegt hoeveel er ouder zijn — een lijst die stilletjes
afkapt, leest als een lijst die compleet is.

## Training, en waarom het een briefje is en geen bibliotheek

`server/kern/training.js`, met een eigen pagina `apps/training.html`.

Precies dezelfde vorm als het medicatieschema, en om dezelfde reden: **RTG
schrijft geen training voor.** Geen sets, geen herhalingen, geen gewichten, geen
opbouw van 5 naar 10 kilometer, geen hartslagzones en geen belastingscore. Dat is
werk voor een coach of een fysiotherapeut die u kent en u heeft zien bewegen —
het "professional-supported" niveau uit `kern/zorgniveau.js`.

Wat er wel is: u of uw coach zet het schema erin, RTG houdt het vast, en u tekent
af wat u deed. Wie het schema maakte staat er ook bij, want dat is meestal niet
RTG.

**Aftekenen schrijft naar de bestaande beweegmeting.** De minuten gaan via
`kern/metingen.js` naar het onderwerp `beweging`, met herkomst "zelf" — u bent
degene die zegt dat u het deed. Er komt dus geen tweede beweegcijfer naast het
cijfer dat al op RTG Life staat (LAT.md regel 4). Het totaal wordt elke keer
**herteld** uit het logboek van die dag en niet opgeteld of afgetrokken: wie twee
keer aftekent en er een weghaalt, houdt anders een cijfer over dat nergens meer
op slaat. Mislukt dat wegschrijven, dan staat dat in het antwoord en niet alleen
in de logs (regel 5) — een beweegcijfer dat stilletjes niet klopt is erger dan
een foutmelding.

De laatste training van een dag weghalen zet uw beweging **niet op nul**. Nul zou
een bewering zijn die RTG niet kan doen: u kunt die dag ook zonder training
hebben bewogen. Er staat waarom.

Er is geen oefeningenbibliotheek met voorgeschreven uitvoering. Verkeerd
uitgevoerd krachtwerk is een blessure, en een plaatje is geen begeleiding.

## De tijdlijn, en waarom er geen verbanden in staan

`server/kern/tijdlijn.js`, met een eigen pagina `apps/tijdlijn.html`.

Wat er in de tijd met het lid is gebeurd, op maand gegroepeerd: afspraken bij
zorg en verzorging die al geweest zijn, doelen die begonnen of gehaald zijn,
toestellen die gekoppeld werden, en wat een behandelaar heeft vastgelegd. **Hij
bezit niets** — net als Life en de dagcoach leest hij alleen. Een tijdlijn die
zelf ging bewaren wordt een tweede dossier naast de lagen waar het vandaan kwam,
en juist bij gezondheid is een tweede dossier dat uit de pas loopt precies het
probleem dat je wilt vermijden.

**Er staan geen verbanden in.** "Uw slaap werd slechter na die behandeling" is
een medische uitspraak, en die doet RTG niet (`kern/zorgniveau.js`). De tijdlijn
zet dingen naast elkaar; wat dat betekent, bepaalt het lid met iemand die hem
kent. **En geen score over de tijd**: er bestaat geen getal dat samenvat hoe het
met iemand gaat, en een lijn door verzonnen punten is een grafiek van niets.

**Alleen wat geweest is.** Wat nog komt staat in de dagcoach en op Life; een
tijdlijn die de toekomst meeneemt is een agenda die zich voordoet als
geschiedenis.

**Elke regel draagt zijn herkomst**, en niet als versiering: het verschil tussen
"u vulde dit zelf in" en "uw behandelaar legde het vast" is bij terugkijken het
hele verhaal. De eigen dagmetingen staan er met opzet niet in — dat zijn er
honderden en ze maken van een tijdlijn een logboek.

Voor de historie is er een lezer bij `kern/metingen.js` gekomen
(`metingenHistorie`), want `beeldVan` geeft een gemiddelde over veertien dagen en
wie terugkijkt heeft de losse regels nodig. Die lezer woont bij de laag die de
metingen bezit en niet bij de tijdlijn (LAT.md regel 4).

Een gat weegt hier zwaarder dan elders: het leest als "toen gebeurde er niets".
Een kapotte laag staat daarom bovenaan het scherm, en de schermtoets laat de
motor ook echt een storing melden — anders toetste hij alleen dat er op een
gezond systeem geen storing staat, en dan mag het scherm ze net zo goed weggooien.

## De voedingslaag, en waarom er niets geteld wordt

`server/kern/voeding.js`, met een eigen pagina `apps/voeding.html`.

Een weekplan: wat u van plan bent te eten, in uw eigen woorden, voor vandaag en
de zes dagen erna. Het is een **plan en geen meting**, en dat verschil is de hele
opzet.

**Er wordt niets geteld.** Geen calorieën, geen macro's, geen voedingswaarde.
Niemand weet hoeveel gram er in zijn pan zat; wie het toch vraagt krijgt een
verzonnen cijfer terug dat daarna als feit door het systeem reist. **Er komt ook
geen oordeel**: gezond en ongezond zijn geen eigenschappen van een maaltijd maar
van een heel leven, en RTG kent dat leven niet.

**En er is geen allergenenfilter.** Dat is de gevaarlijkste van de drie. Uw
allergenen staan er wél — gelezen uit het zorgprofiel, niet gekopieerd — maar
alleen als geheugensteun voor uzelf, met erbij dat RTG niet nakijkt of uw plan ze
bevat. Een waarschuwing die soms komt, leest als een controle die altijd draait,
en dan vertrouwt iemand op een filter dat niet weet wat er in de pan ging. De weg
die wél werkt bestaat al: uw allergenen reizen mee naar de zaak waar u bestelt
(`kern/gastzorg.js`), en daar staat een mens.

Wat voorbij is wordt opgeruimd. Dit is een plan voor de komende week, en bewaren
wat achter u ligt maakt er stilletjes toch een eetdagboek van — een registratie
die u nooit heeft aangezet.

## De boardroom: eenenveertig deuren die niemand kon uitzetten

Dit is geen functie maar een reparatie, en ze hoort hier omdat ze precies laat
zien hoe dit soort gaten ontstaat.

De hele RTG Life-stapel is gebouwd zonder ooit in de functiecatalogus te worden
gezet. Gevolg: eenenveertig routes die vanuit de boardroom **onzichtbaar** waren
— niet uit te zetten, niet per pas fijn te regelen, en de storingswachter greep
er nooit op in. Ze waren er gewoon, altijd, voor iedereen. Dat is er niet
uitgekomen door nadenken maar doordat `routesNietSchakelbaar` in `NORM.json`
omhoog liep en `test/schakelkast-dekking.test.js` ging piepen.

Er zijn twee registers, en dat verschil kostte een ronde: `server/functies` is de
platform-schakelkast (wat RTG breed kan sluiten), en `server/kern/lidboard/` is
het bord van het lid zelf — dat laatste is wat de auth-laag echt handhaaft. Een
laag alleen in het eerste zetten levert een regel in een catalogus op zonder dat
er iets dichtgaat: een knop zonder draad. Beide zijn nu bijgewerkt, en
`test/life-schakelbaar.test.js` **drukt de knop ook echt om** in plaats van hem
te tellen.

Twee deuren staan er met reden buiten:

- **`/api/toestemming`** — een knop waarmee u uw eigen intrekscherm dichtzet
  hoort niet te bestaan. De toestemmingen lopen door en de weg om ze te stoppen
  is weg. Dezelfde redenering als bij `/api/privacy` en de AVG-rechten.
- **`/api/toestel/meting`** — die komt binnen op een toestelsleutel en niet op een
  ledensessie, dus de boardroom-controle in de auth-laag raakt hem sowieso niet.
  Hem toch onder een schakelaar zetten zou schakelbaarheid *beweren* die er niet
  is. Het lid schakelt hem wel degelijk: door de sleutel in te trekken, en dat
  wordt in de toets ook echt nagespeeld.

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

10. ~~**Wachtlijst en no-show**, met de grens dat een gemiste afspraak niet
    meereist.~~ Gedaan; zie hierboven.

11. ~~De **noodkaart**, zonder break-glass.~~ Gedaan; zie hierboven.

12. ~~Het **medicatieschema**, zonder interactiecontrole.~~ Gedaan; zie
    hierboven. De herinnering die afgaat staat er bewust nog niet.

13. ~~De **dagcoach**, die niets plant.~~ Gedaan; zie hieronder.

14. ~~Het **gedachtenboek**, waar geen model in meeleest.~~ Gedaan; zie hieronder.

15. ~~De **sportlaag**: een eigen trainingsschema, zonder belastingsmodel.~~
    Gedaan; zie hieronder. In dezelfde ronde zijn de eenenveertig RTG
    Life-routes alsnog in de boardroom gezet.

16. ~~De **voedingslaag**: een weekplan, zonder telling en zonder filter.~~
    Gedaan; zie hieronder.

17. ~~De **tijdlijn**: terugkijken zonder verbanden en zonder score.~~ Gedaan;
    zie hieronder.

Wat daarna komt: de coachmarktplaats, multi-vestiging
en resource-planning voor zorgorganisaties, en de langere staart uit het oorspronkelijke voorstel (health
ADHD- en autismemodus, energiemanagement, mantelzorg, corporate wellbeing, Life
Wallet, lifestyle-marktplaats). En als er ooit een gesprek komt op het mentale
onderwerp, dan door `zorgniveau.js` heen.
