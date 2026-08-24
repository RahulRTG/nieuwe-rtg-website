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
**begrijpen**. De gezondheidskaart (paragraaf 5) is die derde stap. De vierde,
herstellen als transactie, staat in paragraaf 7 en is nog niet gebouwd.

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
| incident als eersteklas object | **ontbreekt** | par. 7.1 |
| herstel als transactie met verificatie | **ontbreekt** | par. 7.2 |
| configuratietijdlijn | **deels** | het journaal draagt het, er is geen tijdlijnbeeld — par. 7.3 |
| RTG Bijstand (toegang van support tot een klant) | **ontbreekt** | par. 7.4 |
| vlootbeeld over alle klanten, één hoofdincident | **ontbreekt** | par. 7.5 |
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

### 7.1 Het incident als object

Vandaag is een storing een alarm plus een journaalregel. Een incident hoort een
object te zijn met een identiteit, een begin, een oorzaak, een gemeten impact
(hoeveel gevallen, hoeveel verloren, hoeveel dubbel), de genomen maatregelen,
een status en een einde. Dan kun je ernaar verwijzen, hem afsluiten, en hem
achteraf teruglezen.

*De grens:* de impact wordt **gemeten en niet geschat**. "23 facturen vertraagd,
0 verloren, 0 dubbel verwerkt" is alleen te schrijven als er iets is dat die
drie getallen kan tellen. Kan het niet, dan staat er wat er niet gemeten is.

### 7.2 Herstel als transactie

De keten uit grens 6.5, met per recept een certificaat: voorwaarden, maximale
impact, terugweg, verplichte verificatie, versie. Daarmee wordt repareren zelf
een gecontroleerd softwaresysteem in plaats van een verzameling knoppen.

*De grens:* geen enkel recept mag autonoom draaien zonder verificatiestap, en
geen enkele verificatie mag "geen fout gezien" als "geslaagd" tellen.

### 7.3 De configuratietijdlijn

Alles wat verandert op één lijn: wie zette welke grens om, welke appversie ging
erin, welke sleutel is vervangen, welk beleid herlaadde. Bij een storing
antwoordt die lijn de vraag die iedereen als eerste stelt: *wat is er vlak
daarvoor veranderd?*

*De grens:* een correlatie is geen oorzaak. Het scherm mag "begon 37 seconden na
X" tonen; het mag niet "veroorzaakt door X" schrijven zonder dat iets dat kan
dragen. En het journaal ziet alleen wat via RTG Command is gegaan — die zin
staat al bovenaan het herkomstscherm en hoort hier net zo goed.

### 7.4 RTG Bijstand — support die binnenkomt zonder de sleutel te krijgen

Dit is de tweede helft van de visie en het grootste ontbrekende stuk.

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

*Waar dit op leunt:* `kern/command/toegang.js` heeft de vervaldatum en de
nooddeur al; `kern/tenant/register.js` heeft de organisatie als grens; het
journaal heeft de keten. Wat ontbreekt is de sessie zelf, de scoping op één
organisatie, en het redigeren van inhoud.

*De grens, en hij is hard:* de sessie is een **uitnodiging van de klant**. Er
komt geen stand waarin RTG zichzelf toegang geeft omdat het handiger is. Als er
ooit een nooddeur bij komt die zonder de klant open kan, dan met een reden, een
maximum van een uur, een melding aan de klant op het moment zelf, en een regel
in zijn eigen journaal — precies zoals break-glass hier nu al werkt.

### 7.5 Het vlootbeeld

Eén externe storing bij 800 klanten is één hoofdincident en geen 800 tickets.
Support hoort van *alle organisaties* naar *één terminal in één vestiging* te
kunnen zakken zonder van gereedschap te wisselen.

*De grens:* dat je op terminalniveau kunt diagnosticeren, betekent niet dat je
alles mag lezen (grens 6.6 en 6.7). En zolang de meting geen organisatie draagt
— vandaag telt `server/meting.js` per routepatroon en niet per tenant — is er
**geen beschikbaarheidscijfer per klant**, en hoort er ook geen te staan. Dat
staat al zo in `kern/tenant/bewijs.js` en het blijft zo tot de meting het
werkelijk kan.

### 7.6 De veilige noodstand

`kern/incidentcontrole.js` kan al functies dichtzetten en exact terugzetten wat
zij heeft geraakt. Wat ontbreekt is de vorm uit grens 6.10: één handeling die
BESCHERMT in plaats van uitzet, met per onderdeel wat er wel en niet doorloopt.

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
- **Geen beschikbaarheidscijfer per organisatie** zolang de meting geen tenant
  draagt. Een platformcijfer als "uw beschikbaarheid" presenteren is preciezer
  dan de meting en dus onwaar.
- **Geen mail of telefoonmelding vanuit het alarm** zonder dat er een piket aan
  vastzit. Dat is een kanaalbesluit en hoort niet stilzwijgend ingebouwd te
  worden — het staat om die reden ook in `SLO.md`.
- **Geen "AI-beheerder".** De AI verwoordt, groepeert en stelt voor. Zij
  besluit niet en zij voert niets uit dat niet als recept met een toets bestaat.

---

## 9. De open beslissing

De volgorde in paragraaf 7 is een voorstel en geen besluit. Er zijn twee
verdedigbare wegen en ze sluiten elkaar niet uit, maar wel voor de eerstvolgende
maanden:

1. **De diepte in:** incident-als-object, herstel-als-transactie, de
   configuratietijdlijn. Dat maakt van RTG Command een besturingsvlak dat een
   storing van begin tot bewijs draagt.
2. **De breedte in:** RTG Bijstand en het vlootbeeld. Dat maakt van RTG een
   leverancier die een klant kan helpen zonder ooit zijn sleutels te krijgen —
   en dat is de propositie die een enterprise-inkoper begrijpt.

Wat er ook wordt gekozen: het hoort hier te staan voordat het wordt gebouwd, met
de grens erbij. Een besturingsvlak dat zijn eigen grenzen niet opschrijft,
bestuurt op den duur zichzelf.
