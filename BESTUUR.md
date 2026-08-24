# RTG Bestuur — het bewijsbare besturingsvlak

Dit bestand gaat over de achterkant van RTG, en het begint met een besluit over
wat die achterkant IS. Niet "de backoffice", niet "de admin", niet een verzameling
beheerschermen. Een **besturingsvlak**: één laag waarin een mens kan zien wat er
draait, waarom het draait, wat gezond is en hoe hard dat bewijs is, wat het kost,
wie er iets mag, wat er veranderd is — en waarin hij, als het misgaat, veilig kan
terugzetten zonder engineer te zijn.

`PLATFORM.md` zegt hoe een wereld eruitziet, `LAT.md` hoe er geschreven wordt,
`ONTWERP.md` hoe het eruitziet, `TENANT.md` wie de klant is. Dit zegt hoe het
huis zichzelf bestuurt en zichzelf kan verantwoorden.

---

## 1. De regel die boven dit hele project hangt

> **De eigenaar van een bedrijf moet zijn volledige digitale organisatie kunnen
> begrijpen en beheersen zonder engineer te zijn — terwijl een engineer tot op
> het diepste technische niveau kan afdalen zonder naar een ander systeem te
> hoeven.**

Alles hieronder is daarvan afgeleid. Wat er niet uit volgt, hoort hier niet.

Twee dingen die uit die ene zin volgen en die makkelijk over het hoofd worden
gezien. Ten eerste: **het zijn niet twee schermen.** Een eigenaarsdashboard naast
een engineersdashboard betekent twee waarheden, en binnen een maand zegt de ene
iets anders dan de andere — precies op de dag dat het ertoe doet. Het is één
scherm met lagen. Ten tweede: **"begrijpen" is een hogere eis dan "zien".** Zien
is een lijst met services. Begrijpen is weten dat de voorraadprognoses gezond
zijn en dat alleen de automatische bestellingen bij één leverancier wachten, dat
er niets verloren gaat, en dat er niets hoeft.

---

## 2. Het werkwoord: waarnemen → begrijpen → besturen → herstellen → bewijzen

Dit is de productfilosofie, en ze is de moeite van het uitspellen waard omdat
elk van de vijf normaal een eigen product is (observability, administration,
security, support, audit, recovery) met een eigen scherm en een eigen waarheid.

| | Wat het is | Waar het misgaat als je het overslaat |
|---|---|---|
| **waarnemen** | de tellers, de sondes, de scans | er is niets om over te praten |
| **begrijpen** | wat betekent dit, voor wie, en hoe erg | vijftig alarmen, geen oordeel |
| **besturen** | het veranderen, binnen beleid | een knop zonder gevolgweging |
| **herstellen** | het terugbrengen, met verificatie | een reparatie die een tweede storing maakt |
| **bewijzen** | achteraf hard maken wat er gebeurde | "onze engineer heeft even gekeken" |

Dit huis was sterk op **waarnemen**, **besturen** en **bewijzen** en zwak op
**begrijpen** en **herstellen**. Die twee zijn nu gesloten: de gezondheidskaart
(par. 5) zegt wat er aan de hand is en hoe hard dat bewijs is, de
hersteltransactie (par. 5b) maakt van repareren een keten die zichzelf nakijkt,
het incident (par. 5c) onthoudt het, en de configuratietijdlijn (par. 5d)
beantwoordt de vraag die er meteen achteraan komt. En de vraag *wie erbij mag*
is daarna ook gesloten: RTG Bijstand (par. 5e) laat een klant ons binnen op zijn
uitnodiging, en het vlootbeeld (par. 5f) toont alle organisaties tot precies
daar waar die uitnodiging begint. Wat er nog openstaat is par. 7.6, de veilige
noodstand — en dat is geen laag maar een vorm die de bestaande incidentcontrole
nog mist.

---

## 3. De bewijsgraad, en waarom dit de kern van alles is

Een bord dat `Betalen: OK` toont, zegt niet WAAROM het dat weet. Dat kan zijn:

- omdat er in het afgelopen uur 4.812 betaalverzoeken langskwamen zonder fout;
- omdat er zojuist een proef is gedraaid die het werkelijk heeft gedaan;
- omdat er geen klachten binnenkwamen;
- omdat er niemand heeft gekeken.

Die vier zijn niet hetzelfde, en het verschil ertussen is precies wat iemand
nodig heeft om te weten of hij naar huis kan. **Vandaar vier graden, en ze zijn
niet uitwisselbaar:**

| graad | wat het betekent |
|---|---|
| `onbekend` | geen bron zegt hier iets over |
| `vermoed` | afgeleid uit gegevens die er toevallig liggen |
| `gemeten` | een teller of scan heeft er in dit venster naar gekeken |
| `bewezen` | een proef heeft het onlangs echt GEDAAN |

En daarnaast een even belangrijke uitslag: **`niet vast te stellen`**. Dat is
geen storing en geen groen. Het is de eerlijke derde stand, en zonder die stand
is de rest waardeloos — want dan is het bord het groenst op de dag dat er nog
niets draait.

Dit huis kende dat onderscheid al op drie plekken, en het is geen toeval dat het
telkens uit een fout kwam:

- `kern/command/slo.js` heeft naast *gehaald* en *niet gehaald* een derde stand
  **onvoldoende gemeten**, met een eigen kleur — omdat een vers proces met drie
  verzoeken en nul fouten rekenkundig op 100% staat.
- `kern/command/herkomst.js` markeert elk antwoord als *gemeten*, *aangegeven*
  of *afgeleid* — omdat een geheel door elkaar de betrouwbaarheid van zijn
  zwakste deel krijgt zonder dat iemand kan zien welk deel dat is.
- `kern/tenant/bewijs.js` maakt van elke enterprisebewering een OBJECT met een
  bron, omdat er ooit een schil stond die "audit gereed" beweerde zonder dat er
  iets was dat het kon dragen.

De bewijsgraad tilt dat van drie modules naar een **huisregel**.

### De houdbaarheid

Bewijs veroudert. Een proef die gisteren slaagde, bewijst vandaag minder en
volgende maand niets. Elke proef draagt daarom een houdbaarheid, en na afloop
zakt het vermogen **niet naar rood maar naar "moet opnieuw worden vastgesteld"**,
met de datum van de vorige ronde erbij.

Dezelfde regel staat al in `kern/command/canary.js`: die weigert te wegen als
zijn nulmeting na een herstart kwijt is, omdat doorrekenen een negatief
foutaantal zou geven en dus altijd groen. **Iets wat je niet meer weet, is geen
nul.** Vervallen bewijs is geen bewijs.

---

## 4. Wat er al staat, gemeten en niet aangenomen

Dit hoort hier omdat het eerder is misgegaan. Op de vraag "maak alles wat er nog
niet is" kwam in dit huis twee keer het verkeerde antwoord terug: RTG Sheets en
Slides als "ontbrekend" terwijl ze in `public/apps/office/` staan, en CRM en BI
als "ontbrekend" terwijl ze `server/bedrijf/klant.js` en `server/kern/voorspel/`
heten. Daaruit kwam `BELOFTE.json`. De les geldt hier net zo hard: **een
besturingsvlak ontwerpen zonder eerst te kijken wat er staat, levert een
tweede besturingsvlak op.**

| Wat de visie vraagt | Wat er is | Waar |
|---|---|---|
| één cockpit in plaats van veertien schermen | **staat** | `public/apps/command.html`, twaalf werkplekken op één objectmodel |
| één zoekbalk over alle domeinen | **staat** | `kern/command/zoek.js` op `register.js` |
| ieder object opent met dezelfde knoppen | **staat** | `kern/command/object.js` (stand, acties, herkomst, journaal) |
| opdracht in gewone taal → gemeten plan | **staat** | `kern/command/operator.js` + `oorzaak.js` |
| handmatig / assisted / autonoom per handeling | **staat** | `kern/command/risico.js`, uit beleid en niet uit de knop |
| herstelrecepten met terugdraaien | **staat** | `kern/command/runbooks.js` (rondes, oude waarde mee, `BEVROREN` velden) |
| beleid als gegeven, met versies en vier ogen | **staat** | `kern/command/beleid.js` |
| onveranderlijk journaal met hashketen | **staat** | `kern/command/journaal.js`, `controleer()` wijst de eerste breuk aan |
| zware rechten die vanzelf verlopen, break-glass | **staat** | `kern/command/toegang.js` — alles heeft een `tot` |
| servicedoelen met foutbudget | **staat** | `kern/command/slo.js` + `SLO.json` |
| sonde die van buitenaf aanklopt | **staat** | `kern/command/sonde.js`, buiten en binnen apart |
| alarm dat piept op verandering | **staat** | `kern/command/alarm.js` — leest lagen, meet zelf niets |
| gegevenskwaliteit (wezen, dubbelen) | **staat** | `kern/command/kwaliteit.js` |
| kennisgraaf over objecten | **staat** | `kern/command/graaf.js` |
| herkomst: waar komt dit vandaan, wie hangt eraan | **staat** | `kern/command/herkomst.js` |
| zandbak per omgeving | **staat** | `kern/command/zandbak.js` |
| gefaseerde uitrol met terugroldrempel | **staat** | `kern/command/canary.js` |
| master data met gouden record | **staat** | `kern/command/mdm.js` |
| beleidssimulatie vóór het zetten | **staat** | `kern/command/simulatie.js` |
| gevolgsimulatie bij een bedrijfswijziging | **staat** | `server/bedrijf/gevolg.js`, met `nietGerekend` in elk antwoord |
| centrale incidentbediening op de schakelkast | **staat** | `kern/incidentcontrole.js` (bewaart alleen wat zij raakt) |
| maintenance per functie, per doelgroep, per land | **staat** | `server/functies/` — 191 schakelaars |
| meter die dit hele bouwwerk kan tegenspreken | **staat** | `kern/command/werkbesparing.js` — handminuten per duizend handelingen |
| **gezondheid per vermogen, met bewijsgraad** | **nieuw, zie par. 5** | `kern/command/gezondheid*.js` |
| **incident als eersteklas object** | **nieuw, zie par. 5c** | `kern/command/incident*.js` |
| **herstel als transactie met verificatie** | **nieuw, zie par. 5b** | `kern/command/transactie*.js` |
| **configuratietijdlijn** | **nieuw, zie par. 5d** | `kern/command/tijdlijn.js` |
| **RTG Bijstand** (toegang van support tot een klant) | **nieuw, zie par. 5e** | `kern/command/bijstand*.js` |
| **vlootbeeld over alle klanten, één hoofdincident** | **nieuw, zie par. 5f** | `kern/command/vlootbeeld.js` |
| veilige noodstand (beschermen ≠ platleggen) | **deels** | `kern/incidentcontrole.js` en `server/nood.js` — par. 7.6 |

Wat opvalt is niet hoeveel er ontbreekt maar hoe weinig. Het besturingsvlak in
de visie is voor drie kwart al gebouwd; wat ontbrak was de laag die het
**begrijpelijk** maakt, en dat is precies de laag die het verschil maakt tussen
een indrukwekkende backoffice en iets dat een restauranthouder openslaat.

---

## 5. De gezondheidskaart — gebouwd

`kern/command/gezondheid.js` en de kaart eronder (`vermogens.js`). Werkplek
**Gezondheid** onder *Zien*, `POST /api/command/gezondheid`.

**Wat het beantwoordt.** `puls.js` zegt hoe de GEGEVENS ervoor staan: hoeveel
objecten, wat staat open, waar verloopt een termijn. Dat is niet dezelfde vraag
als *doet betalen het?*. Een domein kan brandschoon zijn terwijl de dienst
eronder plat ligt, en andersom.

**Twaalf vermogens, geen 191 schakelaars.** De kaart groepeert de
functiecatalogus per CATEGORIE en niet per functie-id: acht diensten
(binnenkomen, betalen, de ledenkant, het sociale, de eigen apps, de zakenkant,
de RTFoundation, het kantoor) en vier fundamenten die geen verkeer hebben en
toch stuk kunnen zijn (bereikbaar, de gegevens, de sporen, het bewaren). Per
categorie is grover en het **veroudert niet**: een nieuwe schakelaar in een
bestaande categorie landt vanzelf bij het goede vermogen. Dat elke categorie
ergens valt, wordt bij het opstarten afgedwongen — een categorie die nergens
valt, verdwijnt stil van de kaart, en dan staat er groen omdat er niets staat.

**Hij meet niets zelf.** Elk getal komt uit een laag die er al was: de meting
per capability, de servicedoelen, de sonde, het alarm, de gegevenskwaliteit, de
hashketen van het journaal, de back-upstand. Dezelfde regel die in `alarm.js`
staat, en om dezelfde reden: een kaart met een eigen meting zegt op een dag iets
anders dan het scherm waar hij over gaat, en dan gelooft niemand meer welk van
de twee.

**Elke bron draagt wat hij NIET aantoont.** Dat is het veld waar deze hele laag
om draait, en het staat op het scherm en niet in een voetnoot:

> *De back-upcontrole kijkt na of de bestanden er zijn en of db.json opent. Het
> is GEEN terugzetproef: of de inhoud klopt en of een herstel werkelijk lukt, is
> nergens gemeten. Daarom kan dit vermogen niet hoger komen dan "gemeten", ook
> niet na een controleronde.*

Dat is meteen het scherpste voorbeeld van wat de bewijsgraad doet. Elk ander
bord zet hier **Backup: OK** neer. Dit bord zegt: gemeten, met een plafond, en
waarom het plafond er is.

**De doorwerking kleurt niets rood.** Een vermogen dat zelf klopt maar leunt op
iets met een storing, blijft in orde staan met de zin erbij: *"De zakenkant
werkt. Wat hier via betalen loopt, wacht."* Alles rood kleuren omdat er ergens
iets stuk is, maakt van een kaart een alarmklok, en dan kijkt niemand meer.

**Vier talen, één waarheid.** Geen vier schermen maar vier lagen van hetzelfde
scherm: één zin zonder getal, dan wat elke bron zegt, dan de getallen eronder,
dan het bewijs — waar het vandaan komt, wanneer het gemeten is en wat het niet
aantoont. De eerste drie kun je verzinnen; de vierde verwijst naar een bron die
er is of niet is, en dat is wat dit onderscheidt van een dashboard met een
uitklapje.

**De knop Controleer, en waar hij weigert.** Een controleronde voert echt iets
uit: de sonde loopt zijn reizen, de hashketen wordt opnieuw nagerekend, de
gegevens worden opnieuw gescand, de back-up wordt opnieuw opengemaakt. Maar voor
de meeste DIENSTEN bestaat zo'n proef niet, en dan zegt de ronde dat:

> *Niets gecontroleerd: voor dit vermogen bestaat geen proef die het echt
> uitvoert.*

Betalen bewijzen betekent betalen. Een boeking bewijzen betekent boeken. Dit
huis doet dat niet met het geld of de reis van een lid om een scherm groen te
krijgen — `CLAUDE.md` verbiedt zelfs de suggestie dat een boeking verwerkt zou
zijn. Zo'n ronde levert daarom `bewijzend: false` op, blijft staan als
gebeurtenis met een datum en een naam, en geeft **geen oordeel**.

Dat laatste is er na een echte fout. In de eerste ronde tegen een draaiende
server zette een controleronde op *betalen* — die niets kón doen — dat vermogen
van "niet vast te stellen" op "in orde". Een knop die groen maakt door hem in te
drukken. Gevonden door de eerste live-ronde en niet door een lezer en niet door
de toetsen die er toen al waren; er staat nu een toets op met de mutatie erbij.

Getoetst in `test/gezondheidskaart.test.js` (veertien beweringen, acht mutaties
waarvan zeven RAAK en één AFGESLAGEN mét wat daaraan is gedaan), de bedrading in
`test/commandlagen.test.js`, het scherm in `test/command.e2e.js`.

---

## 5b. Herstel als transactie — gebouwd

`kern/command/transactie.js` met `transactie-poorten.js`. Elke herstelronde in
RTG Command loopt sindsdien door deze keten, en `POST /api/command/runbook/voer`
is er het enige pad naartoe.

**De helft stond er al.** `runbooks.js` schrijft alleen via één vorm — één veld
op één object van een bekende soort — en draagt de oude waarde per object mee.
Terugdraaien is daar geen extra code maar hetzelfde mechanisme omgekeerd, en dat
is meteen de momentopname: een tweede kopie ernaast zou op een dag iets anders
zeggen dan de eerste. Wat ontbrak zijn de twee stappen eromheen, en dat zijn
precies de twee die een herstelknop normaal niet heeft.

**De voorcontrole.** Vier genoemde voorwaarden, elk met hun eigen uitslag en
reden: het veld staat niet op de bevroren lijst; de weg terug bestaat werkelijk
als het certificaat er een belooft; het aantal gevallen blijft binnen de
bovengrens van het certificaat; en het fundament (bereikbaar, de gegevens, de
sporen) staat niet op storing — gegevens rechtzetten terwijl dat wankelt, is hoe
je er een tweede storing bij maakt. Een echte ronde wordt door een weigering
tegengehouden; **een droogloop niet**, want droog draaien is juist hoe je
erachter komt dat de voorcontrole niet houdt.

**Het certificaat.** Per recept: hoe groot het mag worden, hoe de weg terug
loopt, waaraan achteraf wordt nagekeken, en een versie. `maxObjecten` is iets
anders dan de rondegrens uit het beleid: die zegt hoeveel er per keer mag, dit
zegt op hoeveel gevallen dit recept ooit is beproefd. Een recept dat op vijftig
is bekeken en er ineens vierduizend raakt, is geen herstel maar een migratie.

Een recept **zonder** certificaat draait gewoon door, maar de transactie meldt
dat erbij: geen bovengrens afgesproken, en de weg terug is alleen wat
`terugDraaibaar` zegt. Een standaardcertificaat verzinnen zou een
ongecertificeerd recept laten lezen als een gecertificeerd recept.

**De verificatie, en waarom zij positief is.** Er wordt niet gekeken of er iets
misging maar of het bedoelde werkelijk is gebeurd: staat het veld op de bedoelde
waarde, en is de aanleiding weg. Raakte de ronde nul objecten, dan is de uitslag
`niet van toepassing` en uitdrukkelijk **niet** "geslaagd" — een herstelknop die
stil niets doet en groen meldt, is erger dan een knop die niets doet.

**Terug bij een mislukte verificatie**, automatisch, en alleen als het
certificaat die weg belooft. De uitslag gaat terug op de ronde zelf én in het
journaal; een verificatie die alleen in het antwoord van dat ene verzoek
bestaat, is morgen weg. In de rondelijst staat `niet nagekeken` daarom als
uitslag en niet als leegte: een oude ronde van vóór de transactie hoort niet te
lezen als een ronde die is nagekeken.

**Wat er nog niet doorheen loopt:** de zaak-kant. `kern/zaakcommand/` draait
dezelfde recepten op zijn eigen register en roept `runbooks.js` rechtstreeks
aan. De module is erop voorbereid — register, db en gezondheid gaan er als
parameter in — maar de bedrading ligt er niet, en dat staat hier en niet als
stille aanname dat het overal geldt.

Getoetst in `test/hersteltransactie.test.js` (negen beweringen, zes mutaties,
alle zes RAAK) op de echte receptenmotor met een rij die zijn schrijfactie
weigert — zo ziet de transactie precies wat zij in het echt zou zien als een
wijziging niet plakt. De bedrading in `test/command-routes-herstel.test.js`.

---

## 5c. Het incident als object — gebouwd

`kern/command/incident.js` met `incident-impact.js` en `incident-verslag.js`.
Werkplek **Incidenten** onder *Doen*.

**Zonder dit is een storing een alarm plus een journaalregel.** Die twee
verdwijnen allebei in een lijst: het alarm zwijgt zodra de drempel terugloopt,
en de journaalregel staat tussen tienduizend andere. Wat er dan ontbreekt is
precies wat een mens nodig heeft: waar begon het, wat is eraan gedaan, wat was
de uitkomst, en wat weten we nog steeds niet.

**Dit is geen tweede uitzonderingenrij.** `zaken.js` gaat over één geval dat de
machine niet zelf kon afhandelen, met een eigenaar, een termijn en een besluit.
Een incident gaat over een *vermogen* dat het niet doet. Andere gegevens, andere
werkstroom, andere levensduur — dat is de toetsvraag uit `PLATFORM.md`
(zelfstandige capability of tweede ingang naar dezelfde), en hier valt hij op de
eerste.

**De machine opent, een mens sluit.** `weeg()` leest de gezondheidskaart en
opent een incident voor elk vermogen dat op storing komt: een storing die
niemand vastlegt, is een storing waar niemand van leert. Sluiten doet hij niet
— dan zou er een incident in de historie staan zonder conclusie. Herstelt de
bron zich, dan wordt het incident `hersteld` gemarkeerd en wacht het op een
verslag. Die asymmetrie is met opzet en `tel()` telt hem apart: *wacht op
verslag* is werkvoorraad van een eigen soort — de storing is weg en de les is
nooit getrokken.

**En sluiten kan niet terwijl het nog stuk is.** Een gesloten incident boven een
lopende storing is een leugen in de historie, en het is de makkelijkste om te
vertellen: het scherm wordt er rustiger van. Het kan wel met `toch` en een
reden, en dan staat dat in het verslag als `geslotenBovenEenStoring` — een
besluit in plaats van een vergissing. Een grendel zonder uitweg wordt omzeild
in plaats van gebruikt.

**De impact is gemeten, en wat niet te meten is staat erbij.** Dit is de
gevaarlijkste tekst op een incidentscherm: *"23 facturen vertraagd, 0 verloren,
0 dubbel verwerkt"* is precies wat een eigenaar wil lezen, en precies wat je
niet mag schrijven zonder iets dat die drie kan tellen. Elk getal komt daarom
uit een bevinding van de gezondheidskaart. Drie dingen staan er standaard als
**niet gemeten**, met de reden erbij, en dat zijn feiten over deze code:

- *hoeveel leden of organisaties dit raakte* — `server/meting.js` telt per
  routepatroon en draagt geen lid en geen tenant;
- *of er iets verloren ging* — er is geen teller die verlies meet; het
  transactie-grootboek dekt de collecties in `server/db/tx/collecties.js`, niet
  het hele platform;
- *of er iets dubbel is verwerkt* — om dezelfde reden.

**De oorzaak is een aanleiding en geen feit.** Er is geen veld `oorzaak` met een
zin erin, maar een lijst aanleidingen met per stuk de bron en de hardheid. Leunt
het vermogen op iets dat óók stuk is, dan is dat de sterkere kandidaat — met de
zin erbij dat gelijktijdigheid geen oorzaak bewijst. Vindt hij niets, dan staat
er *geen aanleiding gevonden*, en dat is een uitslag en geen reden om er een te
verzinnen. Dezelfde regel als in `oorzaak.js`, waar de operator zijn gevallen
*meet* in plaats van een tabel "wat verklaart wat" te raadplegen.

**De momentopname bij het ontstaan blijft staan**, naast de stand van nu. Alleen
de eerste tonen laat een opgelost incident als lopend lezen; alleen de tweede
maakt onzichtbaar wat er toen aan de hand was.

Getoetst in `test/incident.test.js` (tien beweringen, zes mutaties, alle zes
RAAK), de bedrading in `test/commandlagen.test.js`.

---

## 5d. De configuratietijdlijn — gebouwd

`kern/command/tijdlijn.js`. Zichtbaar op de werkplek **Journaal** en in het
dossier van elk incident, achter de knop *"Wat veranderde er vlak hiervoor?"*.

**De vraag die iedereen bij een storing als eerste stelt** was hier niet te
beantwoorden — niet omdat het nergens stond, maar omdat het op drie plekken
stond in drie vormen: het journaal van RTG Command, de aanvragen aan de
schakelkast (`techniek.functieVerzoeken`) en het auditspoor van de
incidentcontrole.

**Dit is een samenvoeging en geen vierde opslag.** Er wordt niets bewaard; elke
regel komt uit een bron die er al was en draagt de naam van die bron. Een eigen
kopie zou op een dag iets anders zeggen dan het scherm waar zij vandaan kwam —
en dan is de tijdlijn het minst betrouwbare bewijsstuk van de drie.

**Volgorde is geen oorzaak**, en die zin zit in het antwoord van de server en
niet in het scherm. `rondom(moment, minuten)` zegt dat er zevenendertig seconden
eerder iets is gewijzigd; hij zegt niet dat dat het veroorzaakte. Een tijdlijn
zonder die zin wordt binnen een week gelezen als een oorzakenlijst.

**En "niets gevonden" is niet "niets gebeurd".** Een leeg venster antwoordt met
zoveel woorden dat er in *deze drie bronnen* niets staat — want een uitrol, een
wijziging op de machine of een schrijfactie buiten Command zou er ook niet in
staan. Dat is precies de verwarring waarmee iemand een oorzaak uitsluit die er
wel degelijk was. Wat elke bron mist staat per bron, en wat geen van drieën ziet
staat als aparte lijst `buitenBeeld`.

**Een aanvraag die niets veranderde staat er toch in**, met de status erbij: wie
zoekt naar wat er veranderde, wil ook zien wat er bíjna veranderde. Het aantal
regels en het aantal dat werkelijk iets veranderde staan daarom apart — anders
leest "vijf wijzigingen vlak ervoor" als vijf wijzigingen.

Getoetst in `test/tijdlijn.test.js` (acht beweringen, zes mutaties, alle zes
RAAK). Eén van die mutaties legde een echte fout bloot die er al in zat:
`Number(minuten || 30)` maakte van een gevraagd venster van **nul** minuten er
stil dertig, en gaf dus veel meer regels terug dan er was gevraagd.

---

## 5e. RTG Bijstand — gebouwd

`kern/command/bijstand.js` met `bijstand-klant.js`, `bijstand-rtg.js`,
`bijstand-niveaus.js` en `bijstand-diagnose.js`. Werkplek **Bijstand** in RTG
Command; de klantkant staat als kaart in het Werk OS
(`public/apps/werk/bijstand.js`).

**Toegang is een uitnodiging en geen recht, en dat is de vorm en niet een
instelling.** Er is geen route aan de kantoorkant die een sessie aanmaakt. De
functie staat in `bijstand-klant.js`, de RTG-kant staat in `bijstand-rtg.js`, en
wie dat wil veranderen moet aan de klantkant bijbouwen — dat valt op. Er staat
zelfs een fail-fast op een naam die aan beide kanten voorkomt: `Object.assign`
laat de RTG-kant winnen, dus een functie die daar `vraag` gaat heten zou de
klantkant stilzwijgend vervangen terwijl het andere bestand nog steeds de enige
plek *lijkt* waar een sessie ontstaat.

**Vier niveaus**, met per niveau een eigen maximale looptijd:

| niveau | wat het mag | hooguit |
|---|---|---|
| **kijken** | alleen de diagnose lezen | 60 min |
| **meedenken** | handelingen voorstellen, niet uitvoeren | 120 min |
| **herstellen** | uitvoeren ná goedkeuring per handeling | 60 min |
| **nood** | handelen zonder per handeling te wachten | 30 min |

**Waarom `nood` geen uitzondering op de eerste regel is.** De verleiding is een
stand waarin RTG bij een ernstig incident zelf naar binnen kan. Die komt er niet.
Wat `nood` doet is de goedkeuring **vooraf** geven in plaats van per handeling —
omdat een klant die om half drie 's nachts belt niet naast het scherm gaat zitten
om vinkjes te zetten. Dat is zijn besluit, met een verplichte reden, voor een
half uur, en elke handeling verschijnt onmiddellijk in het spoor. De goedkeuring
is dus niet weg; hij is één keer gegeven, met een reden, voor een venster met een
einde. Op de handeling staat dan `besluitDoor: 'vooraf, bij het openen van de
noodsessie'` — niet stil overgeslagen, want in het verslag moet leesbaar zijn wie
wanneer ja zei.

**Verlopen is een toestand en geen opruimactie.** `stand()` rekent hem bij elke
lezing uit de klok. Een sessie die pas dichtgaat als er een schoonmaker langskomt
staat tussendoor open — en dan hangt "verloopt vanzelf" van een cron af.

**En de klant kan hem terugnemen, zonder uit te leggen waarom.** Verlopen is de
zachte uitgang; intrekken is de harde. `trekIn()` zet de sessie op `ingetrokken`
en daarmee is RTG er buiten — niet met een 403 die zegt "mag niet meer", maar
omdat de sessie niet meer loopt. De route vraagt met opzet **geen reden**: een
uitnodiging die je niet zonder uitleg kunt terugnemen is een recht met een
wachttijd. Het intrekken staat wel in het spoor, want de klant moet later kunnen
zien wanneer hij de deur dichtdeed.

**Een gedeelde kantoorcode betreedt geen klantomgeving.** Wie zo binnenkomt heet
in het journaal `kantoor (gedeelde code)`, één naam voor iedereen. Zo'n naam kan
niet in een verslag staan als degene die het deed, dus hij komt er niet in.
Dezelfde grendel als bij de vier-ogen-goedkeuring.

**Inhoud is dicht.** De diagnose geeft structuur, tellingen en toestanden, plus
de platformstand — met de zin erbij dat die over ons gaat en niet over deze
klant. De *namen* van werkruimtes en groepen zitten achter een apart, gemotiveerd
verzoek dat de klant goedkeurt. En er is een derde laag die niet bestaat: de
identiteitskluis, persoonsgegevens en de inhoud van berichten en bestanden. Dat
is geen strengheid maar bouw — `server/accounts.js` heeft zijn eigen poort met
een verplichte reden, een regel in het inzagejournaal en bericht aan de
betrokkene, en die deur loopt niet door deze laag. Elk antwoord draagt die
`nooit`-lijst met een reden per post.

**Deze laag voert zelf niets uit.** `voerUit()` bewaakt de toestemming en
schrijft de uitslag op; wat er werkelijk aan gegevens verandert, loopt door de
hersteltransactie (par. 5b). Een tweede schrijfpad zou wijzigingen opleveren die
de voorcontrole en de verificatie overslaan.

Getoetst in `test/bijstand.test.js` (twaalf beweringen, negen mutaties),
`test/bijstandketen.test.js` (negen toetsen over de echte routes: de hele keten,
de twee grenzen die alleen daar te zien zijn, en het intrekken) en
`test/bijstandscherm.e2e.js`.

---

## 5f. Het vlootbeeld — gebouwd

`kern/command/vlootbeeld.js`, werkplek **De vloot**.

**Twee dingen moeten tegelijk waar zijn, en ze trekken tegengesteld.** Support
moet van alle organisaties naar één werkruimte kunnen zakken zonder van
gereedschap te wisselen — anders wordt één externe storing bij achthonderd
klanten achthonderd tickets. En tegelijk mag "ik kan tot op werkruimteniveau
kijken" niet betekenen "ik mag alles lezen".

Vandaar de regel die dit beeld zijn vorm geeft: **het vlootbeeld toont wat RTG
zonder uitnodiging mag zien, en houdt op waar de uitnodiging begint.** De
afdaling eindigt met `dieper.mag: false` en de reden erbij, plus hoe je dan wél
verder komt. Een lege diepte leest als "er is niets"; dit zegt "hier mag ik niet
zonder toestemming".

**Eén hoofdincident is één incident.** De incidenten hangen aan een *vermogen* en
niet aan een klant. Er staat dus bij hoeveel organisaties er **bestaan**, en er
staat `geraakteOrganisaties: null` — want dat getal kan hier niemand tellen. Zou
het er wel staan, dan wordt "812 organisaties" binnen een week gelezen als "812
klanten hadden hier last van".

**En er staat geen beschikbaarheidscijfer per klant.** Niet uit voorzichtigheid
maar omdat de meting het niet draagt: `server/meting.js` telt per routepatroon en
kent geen tenant. `kern/tenant/bewijs.js` weigert dat cijfer al aan de klant; het
intern wél gebruiken zou betekenen dat wij een getal hanteren dat wij extern
onwaar noemen.

Getoetst in `test/vlootbeeld.test.js` (zeven beweringen, zes mutaties).

---

## 6. De grenzen

Dit is de belangrijkste paragraaf van dit bestand. Waar een functie hieronder
met een grens botst, vervalt de functie.

### 6.1 Een cockpit die niet kan zakken, is een dashboard

Elke bewering op een besturingsscherm draagt een bron en een datum, of hij staat
er niet. Er is geen veld `status` dat iemand op groen kan zetten; het oordeel
wordt elke keer opnieuw uit de gegevens gerekend. Een stoplicht dat je kunt
overrulen, staat op den duur altijd op groen.

### 6.2 Niet gemeten is niet groen, en vervallen bewijs is geen bewijs

`niet vast te stellen` is een eersteklas uitslag met een eigen (kleurloze)
weergave. Elke kleur die hij wél zou krijgen, wordt binnen een week als een
oordeel gelezen.

### 6.3 De laag die het toont, meet niet

Geen enkele bestuurslaag krijgt een eigen telling. Wie een meting mist, voegt
hem toe aan de laag die er hoort — niet aan het scherm dat hem nodig heeft.

### 6.4 De machine repareert alleen uit een gecertificeerd receptenboek

Zelfherstel bestaat alleen als vooraf beproefde recepten met voorwaarden, een
maximale impact, een terugweg en een verplichte verificatie. **De AI verzint
geen productiehandelingen.** Zij mag een bevinding verwoorden, een oorzaak
voorstellen en een bestaand recept aanwijzen; wat er wordt uitgevoerd, staat in
code met een toets erbij. Dit is dezelfde grens die `runbooks.js` al trekt, en
hij wordt door geen enkele toekomstige "assistent" opgerekt.

### 6.5 Een herstel dat niet terug kan, is een gok

Elke herstelhandeling is een transactie: voorcontrole → momentopname →
uitvoeren → verifiëren → vastleggen, en bij een mislukte verificatie terug. Een
reparatie die zelf een tweede storing kan maken zonder weg terug, is geen
reparatie.

### 6.6 Toegang van RTG tot een klant is een uitnodiging, geen recht

Er komt geen permanent `admin = true` voor RTG-personeel. Toegang tot de
omgeving van een klant is per keer, per onderwerp, met een einde eraan, zichtbaar
terwijl het gebeurt, en achteraf terug te lezen. **Ook intern is een
RTG-medewerker geen god-mode**, en dat is een ontwerpwet en geen beleidsregel:
de rechtenmotor controleert op elke laag, ook als de beller uit ons eigen
kantoor komt.

### 6.7 Support ziet structuur, geen inhoud

Wie een mailmodule repareert, hoeft geen mails te kunnen lezen. Inhoud staat
standaard dicht en gaat pas open met een aparte, gemotiveerde toestemming die de
klant ziet. Dit is geen nette gewoonte maar de enige reden dat een klant een
supportsessie durft toe te staan.

### 6.8 Uit is een keuze, geen storing

Een dienst die bewust dicht staat, leest niet als rood — en ook niet als groen.
Dat onderscheid verdwijnt op elk ander bord, en het is precies wat een
onderhoudsstand bruikbaar maakt.

### 6.9 De kaart mag niet groener zijn dan het huis

Wat buiten de dekking valt, staat op het scherm: verkeer dat onder geen functie
valt, alarmen die aan geen vermogen hangen, bronnen die niet gelezen konden
worden. Stil weglaten laat het totaal kloppen terwijl er iets ontbreekt.

### 6.10 Een noodknop die alles platlegt, wordt niet gebruikt

De noodstand beschermt in plaats van uit te zetten: nieuwe bevoorrechte
handelingen tegenhouden, mutaties van derden bevriezen, lezen laten doorlopen,
bewijs veiligstellen, sleutels roteren. Een organisatie platleggen om haar te
beschermen is bijna altijd duurder dan de storing.

---

## 7. Wat er nog niet is, in de volgorde waarin het hoort te komen

Alles hieronder is ontwerp en geen code. Het staat hier opgeschreven zodat
niemand het later voor vergeten aanziet (LAT.md regel 6), en met de grens erbij
zodat het niet als iets makkelijkers wordt gebouwd dan het is.

### 7.1 Het incident als object — GEBOUWD, zie par. 5c

Wat er van deze paragraaf werkvoorraad blijft: een maatregel is nu een notitie
met een verwijzing, en er is nog geen knop die vanuit een incident een
herstelronde start en die ronde er automatisch aan hangt. En de drie
niet-gemeten posten blijven niet-gemeten tot er tellers zijn die ze kunnen
dragen — dat is geen achterstand van dit scherm maar van de meting eronder.

### 7.2 Herstel als transactie — GEBOUWD, zie par. 5b

**De zaak-kant loopt er sinds 24 augustus doorheen.** `kern/zaakcommand/` riep
`runbooks.js` rechtstreeks aan: wel een momentopname, geen voorcontrole en geen
verificatie. Een ondernemer die op "rechtzetten" drukte kreeg dus dezelfde groene
ronde of het gelukt was of stil niets had gedaan. Alle vier de zaak-recepten
dragen nu een certificaat met een bovengrens (25 of 50, lager dan aan de
RTG-kant: de schaal van een zaak is de schaal van één onderneming) en beide
verificaties, `veld-staat-op-doel` én `oorzaak-weg`.

**De gezondheidskaart gaat er bewust NIET in**, en dat is geen vergeten
parameter. Zij gaat over het platform; een ondernemer heeft daar geen
zeggenschap over en zou haar ook niet kunnen lezen. `transactie-poorten.js` kende
dat geval al: zonder kaart komt `fundament-gezond` terug als
`gecontroleerd: false` mét de reden, en houdt hij niets tegen. Zo staat er in het
antwoord van een zaak wélke controle daar niet bestaat, in plaats van een
controle die er stilzwijgend niet is.

Wat er van deze paragraaf overblijft als werkvoorraad: er is nog geen recept dat
iets anders verifieert dan het veld dat het zelf schrijft. Dat gaat pas knellen
bij een recept waarvan de aanleiding in een ánder veld staat; het certificaat kan
dat al dragen.

### 7.3 De configuratietijdlijn — GEBOUWD, zie par. 5d

Wat er werkvoorraad blijft, is de dekking en niet de lijn zelf: een uitrol, een
wijziging op de machine en een schrijfactie buiten Command staan er niet in, en
dat is een gat in de BRONNEN. Zolang dat zo is, staat het als `buitenBeeld` in
elk antwoord in plaats van als een lijn die volledig lijkt.

### 7.4 RTG Bijstand — GEBOUWD, zie par. 5e

**De klant krijgt sinds 24 augustus een bericht** (`kern/command/bijstand-melden.js`).
Wat er mis was, was subtiel: hij kón alles zien — het spoor loopt live mee, het
dossier staat open, de kaart in het Werk OS toont de sessie — maar alleen *als
hij keek*. "Toegang is een uitnodiging" wordt dun als de uitgenodigde binnenkomt
op een moment dat de gastheer niet naar de deur kijkt.

**Het kanaal is zijn eigen werkruimtejournaal**, en dat is een besluit met een
reden: het bestaat al, hij leest het al, het overleeft een gesloten tabblad, en
het is auditeerbaar — wie later vraagt "wist ik hiervan", ziet de regel met
tijdstip staan. Er komt een regel bij op de vier momenten dat RTG handelt:
binnenkomen, een goedgekeurde handeling uitvoeren, om namen vragen, en afsluiten.
De afzender is `RTG Bijstand` en niet de codenaam van de medewerker — die zegt de
klant niets en geeft ons een naam in zijn dossier die er niet hoort; het
sessie-id staat er wel bij, zodat hij het kan terugvinden. En het landt in de
werkruimte die de uitnodiging deed, niet in de eerste de beste van dezelfde
organisatie.

**Wat er bewust niet bij komt is een mail of een telefoonmelding** — zie par. 8.
Dat is hetzelfde kanaalbesluit als bij het alarm in `SLO.md`, en het hoort een
klant in te stellen in plaats van stilzwijgend te krijgen. Getoetst in
`test/bijstandbericht.test.js` (vier toetsen, drie mutaties).

Wat werkvoorraad blijft: de diagnose geeft vandaag de organisatiestand, de
inrichting en de platformstand. Wie een concrete koppeling wil zien haperen,
heeft daar meer aan dan aan een teller — maar elke bron die erbij komt, komt
door dezelfde redactieregel of hij komt er niet.

<details><summary>Het oorspronkelijke ontwerp, ter vergelijking</summary>

De klant vraagt hulp en kiest waarmee. Daarop ontstaat een **sessie** en geen
account: één organisatie, één onderwerp, één doel, een looptijd, en een niveau.

| niveau | wat het mag |
|---|---|
| **kijken** | alleen diagnose lezen |
| **meedenken** | mag handelingen VOORSTELLEN, niet uitvoeren |
| **herstellen** | mag goedgekeurde recepten draaien |
| **nood** | alleen bij een ernstig incident, zwaar gecontroleerd |

Vier eigenschappen die niet optioneel zijn: de klant ziet **live** wat er
gebeurt en wie het doet; elke mutatie vraagt zijn akkoord; inhoud is dicht
(grens 6.7); en de sessie verloopt vanzelf — er is niets in te trekken omdat er
niets blijft staan. Achteraf krijgt de klant een **verslag**: wat er mis was,
wat er is gedaan, wat het resultaat was, hoeveel er is gewijzigd en of er iets
verloren ging.

*De grens, en hij is hard:* de sessie is een **uitnodiging van de klant**. Er
komt geen stand waarin RTG zichzelf toegang geeft omdat het handiger is.
</details>

### 7.5 Het vlootbeeld — GEBOUWD, zie par. 5f

**De meting draagt sinds 24 augustus een tenant — als ondergrens en niet als
aantal.** `server/meting-tenant.js` telt per FUNCTIE hoeveel organisaties eraan
kwamen en hoeveel er een serverfout zagen. Waarom dat niet gewoon in de metrics
kon: `meting.js` telt met opzet per routepatroon (een tijdreeks per klant is een
miljoen tijdreeksen) en houdt met opzet persoonsgegevens uit een eindpunt dat
gescrapet wordt door een systeem dat doorgaans minder streng bewaakt is dan de
database. Een `tenant`-label breekt allebei die regels. Dit register staat er dus
**naast** en gaat nooit mee naar Prometheus: er is geen `tekst()`-functie, en de
codes verlaten de module niet — het antwoord is een aantal.

**Het staat op de functie en niet op het routepatroon**, dezelfde keuze die
`vermogens.js` maakt: een routepatroon verandert bij elke verbouwing, een
functie-id is een productafspraak. Een vermogen kent zijn categorieën, een
functie kent zijn categorie — zo sluit "welke organisaties raakte dit vermogen"
aan op wat er geteld is. Over meerdere functies telt de **unie** en niet de som:
één klant die twee functies van hetzelfde vermogen raakt, is één klant.

**Geteld wordt waar het compleet kan.** Bij de twee deuren van de werkruimte
(`server/bedrijf/deuren.js`, `beheerVan` en `lidVan`) — daar komt elke route van
die laag langs en is de tenant toch al opgezocht voor het quotum. Ledenverkeer,
zaakverkeer en verkeer van buiten dragen geen organisatie en worden geteld als
`nietToegewezen`. Wie hier "vijf organisaties" leest, weet dus: **minstens vijf,
en er is een deel waarvan we het niet weten** — en dat deel staat erbij. Harde
bovengrens van 200 organisaties per functie, met `afgekapt: true` in plaats van
een getal dat te laag is zonder het te zeggen, en een venster van een uur.

**En het blijft géén beschikbaarheidscijfer per organisatie.** Daarvoor heb je
alle verzoeken van een klant over een hele periode nodig, niet de organisaties
die in een uur een fout zagen. Par. 8 blijft daarmee onveranderd staan. Getoetst
in `test/metingtenant.test.js` (vijf toetsen, drie mutaties).

Wat werkvoorraad blijft is de diepte: de afdaling eindigt bij de werkruimte en
niet bij een terminal, omdat er onder die laag geen bron is die RTG zonder
uitnodiging mag lezen.

### 7.6 De veilige noodstand — GEBOUWD

`kern/beschermstand.js` met `beschermstand-lijst.js`, aangezet via
`kern/incidentcontrole-bescherm.js` als vijfde modus `beschermd`. Handhaving in
`middleware/functieschakelaars.js`, met één aanroep — er komt geen tweede poort
naast de schakelkast.

**De methode is hier het verkeerde signaal, en dat is gemeten.** De eerste vorm
was "elke niet-GET wordt tegengehouden, lezen loopt door". In dit huis staan
**3728 POST-routes tegenover 35 GET-routes**: het lezen gaat hier grotendeels óók
per POST. Die regel zou dus alles hebben tegengehouden — isolatie met een
vriendelijkere naam, exact de knop die volgens 6.10 niet gebruikt wordt.

**Dus: per categorie bevriezen, met een gesloten lijst uitzonderingen.** Zes van
de zestien categorieën dragen wat 6.10 bedoelt met nieuwe bevoorrechte
handelingen en mutaties van derden (identiteit, rechten, de twee geldcategorieën,
partners, integraties); de andere tien werken door, RTG-Backoffice voorop — dat
is de hand die repareert en de hand die deze stand weer opheft. Binnen een
bevroren categorie loopt een GET altijd door, en lopen **vier met naam genoemde
functies** door: `tg-inlog` (wie dit bevriest zet ook het lezen stil),
`dom-veiligheid` en `dom-kmar` (een hulpdienst stilzetten om een incident in te
dammen is de ruil die 6.10 verbiedt) en `dom-foutmelder` (het kanaal waarlangs
we hóren dat er iets mis is).

**Drie fail-fasts bij het laden**, niet bij het eerste incident: elke categorie
staat in precies één emmer (een nieuwe categorie laat de server niet starten in
plaats van stilzwijgend te blijven schrijven), elke uitzondering bestaat nog, en
elke uitzondering zit in een categorie die werkelijk bevriest.

**Deze stand zet geen enkele schakelaar om.** `beperk` en `isoleer` schrijven
standen weg die je daarna exact moet terugzetten; dit is een vlag. Opheffen is
dus geen herstelactie met een eigen risico — en een noodstand die je durft aan te
zetten omdat je hem durft uit te zetten, is de noodstand die gebruikt wordt. Om
dezelfde reden vraagt hij geen bevestigingszin: een drempel opwerpen voor de
veilige keuze duwt mensen naar de onveilige.

**Vier van de vijf onderdelen uit 6.10 zijn afgedwongen, het vijfde niet — en dat
staat in het antwoord van de server.** Lezen loopt door, mutaties van derden
bevriezen, nieuwe bevoorrechte handelingen worden tegengehouden, en het bewijs
wordt bij het omzetten vastgezet: de hashketen van het journaal wordt nagelopen
en de uitslag komt als zegel in het audit, zodat wat er daarna aan de historie
verandert daartegen breekt. **Sleutels roteren gebeurt niet**, met de reden
erbij: er is geen rotatiemechanisme voor `secret.key` en `vault.key`, en die
roteren betekent alles opnieuw versleutelen — een migratie, geen noodhandeling.
Dat staat er als `nietAfgedwongen` en niet als lege waarde.

Twee dingen die het zegel eerlijk houden: het **zet** het bewijs vast en
**kopieert** het niet naar buiten (wie de schijf heeft, heeft ook het zegel), en
"er is geen keten" en "de keten is niet te lezen" komen als twee verschillende
antwoorden terug. Getoetst in `test/beschermstand.test.js` (zes toetsen, vier
mutaties).

---

## 8. Wat er bewust niet komt

- **Geen tweede meetlaag.** Standaarden als OpenTelemetry kunnen ooit de
  ONDERGROND worden waarop dit draait, en daar valt iets voor te zeggen — maar
  dat is een eigen besluit met een eigen prijs, en geen bijvangst van dit
  document. De waarde van RTG zit erboven: de betekenis, de afhankelijkheid, de
  impact, het bewijs. Zolang dat besluit niet genomen is, blijft
  `server/meting.js` de bron en komt er niets naast.
- **Geen "repareer alles"-knop.** Voor kleine, beproefde gevallen mag herstel
  autonoom; alles daarboven toont een plan met impact, terugweg en risico.
- **Geen god-mode, ook niet voor ons.** Zie grens 6.6.
- **Geen beschikbaarheidscijfer per organisatie**, en dat verandert niet nu de
  meting wél een tenant draagt (par. 7.5). Die telt hoeveel organisaties er in een
  uur een fout zagen — een ondergrens op impact. Een beschikbaarheidspercentage
  vraagt álle verzoeken van een klant over een hele periode. Een platformcijfer
  als "uw beschikbaarheid" presenteren is preciezer dan de meting en dus onwaar.
- **Geen mail of telefoonmelding bij een lopende bijstandssessie.** De klant
  krijgt sinds 24 augustus wél een bericht — in zijn eigen werkruimtejournaal,
  het kanaal dat hij al leest en dat een gesloten tabblad overleeft (par. 7.4).
  Een kanaal naar buiten dat niemand heeft afgesproken, komt op het verkeerde
  moment bij de verkeerde persoon aan: 's nachts, op een oud adres, of bij iemand
  die er niets mee kan. Dat hoort een klant in te stellen. Zelfde kanaalbesluit
  als bij het alarm hierboven, met dezelfde prijs.
- **Geen mail of telefoonmelding vanuit het alarm** zonder dat er een piket aan
  vastzit. Dat is een kanaalbesluit en hoort niet stilzwijgend ingebouwd te
  worden — het staat om die reden ook in `SLO.md`.
- **Geen "AI-beheerder".** De AI verwoordt, groepeert en stelt voor. Zij
  besluit niet en zij voert niets uit dat niet als recept met een toets bestaat.

---

## 9. Wat er nu open is

De vier punten die hier op 24 augustus stonden zijn alle vier gebouwd: de veilige
noodstand (par. 7.6), de zaak-kant door de hersteltransactie (par. 7.2), de
meting die een tenant draagt (par. 7.5) en het bericht aan de klant bij een
lopende bijstandssessie (par. 7.4). Wat daarvan overblijft is geen restpost maar
de grens die er bij het bouwen bij hoorde, en die staat hier zodat niemand hem
voor vergeten aanziet:

1. **Sleutelrotatie bestaat niet** (par. 7.6). Grens 6.10 noemt het als vijfde
   onderdeel van de veilige noodstand; er is geen rotatiemechanisme voor
   `secret.key` en `vault.key`, en die roteren betekent alles opnieuw
   versleutelen. Dat is een migratie en geen noodhandeling. Het staat in het
   antwoord van de server als `nietAfgedwongen` mét die reden, en niet als knop.
2. **Het bewijszegel wordt vastgezet, niet weggezet** (par. 7.6). Wie de schijf
   heeft, heeft ook het zegel. Een tweede bewaarplaats buiten dit huis is een
   eigen besluit met een eigen prijs.
3. **De ondergrens op impact is een ondergrens** (par. 7.5). Alleen verkeer dat
   langs een werkruimtedeur komt draagt een organisatie; ledenverkeer,
   zaakverkeer en verkeer van buiten staan onder `nietToegewezen`. Voor LEDEN is
   er nog steeds geen register, en dat staat zo in `nietGemeten`.
4. **Geen recept dat iets anders verifieert dan het veld dat het zelf schrijft**
   (par. 7.2). Dat gaat pas knellen bij een recept waarvan de aanleiding in een
   ánder veld staat; het certificaat kan dat al dragen.
5. **Een kanaal naar buiten bij bijstand blijft weg** (par. 7.4 en 8). Niet
   omdat het moeilijk is, maar omdat het een afspraak met een klant vraagt.

Wat er ook bij komt: het hoort hier te staan voordat het wordt gebouwd, met de
grens erbij. Een besturingsvlak dat zijn eigen grenzen niet opschrijft, bestuurt
op den duur zichzelf.
