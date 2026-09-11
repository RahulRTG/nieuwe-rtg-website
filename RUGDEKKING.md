# RTG Rugdekking

*Wat RTG een sporter, een artiest of een maker biedt — en waarom dat geen
sponsoring heet.*

**`CARRIERE.md` staat hierboven en niet ernaast.** Dat document beantwoordt de
vraag waaronder deze valt — wat de mens die van zijn talent leeft in dit huis
IS — en het draagt de meting die zegt waarom daar geen objecttype voor komt. Dit
document beantwoordt één vraag uit die laag: hoe het geld heet dat naar zo'n mens
gaat.

Lees dit document vóór je iets bouwt waarmee RTG geld, middelen of zichtbaarheid
naar een INDIVIDUELE mens beweegt die van zijn talent leeft. Het gaat niet over
clubs (dat is `kern/sportclub/`), niet over festivals (`kern/festival/`) en niet
over de filantropie van een lid (`kern/rechterhand/mecenaat.js`). Het gaat over
de mens zelf.

**De kern in één zin: een sponsor koopt zichtbaarheid en is weg zodra de
zichtbaarheid weg is; RTG draagt het huis waarin een talent zijn leven, zijn
onderneming en zijn geld beheert — en dat huis blijft staan als de carrière
stopt.**

Daaruit volgt de toetsvraag van dit document, en hij staat bewust naast die van
`PLATFORM.md` par. 0b: niet *"kunnen wij deze sporter betalen?"* maar **"wat
houdt deze mens over als wij morgen stoppen met betalen?"** Bij een sponsor is
het antwoord: niets. Dat is het hele verschil, en het is ook het enige echte
verkoopargument dat RTG hier heeft — want in geld verliest dit huis het van elke
frisdrankfabrikant.

---

## 0. Het antwoord op de gestelde vraag, eerst

De vraag was: *wat hebben wij voor sporters, zaakwaarnemers, muzikale artiesten
en IOC-sporters die geld nodig hebben?* Gemeten op 11 september 2026, en het
antwoord valt in twee helften uiteen die bijna niets met elkaar te maken hebben.

**Voor de ORGANISATIE om een talent heen: veel.** Een club, een festival, een
studio, een galerie, een eventbureau en een fitnessclub zijn alle zes een gewone
RTG-zaak met eigen software, eigen kassa, eigen personeel en eigen boekhouding.
Een sporter die een BV heeft, een artiest met een management-entiteit en een
festival dat hem boekt, draaien vandaag al op dit platform.

**Voor de PERSOON zelf: bijna niets.** En dat komt niet doordat er honderd
functies ontbreken, maar doordat er precies één steen ontbreekt — de mens die
van zijn talent leeft, bestaat in dit huis niet als partij. Hij is óf een lid
(consument, betaalt ons) óf een zaak (commercieel, factureert ons). Een
toptalent is allebei tegelijk, en daar bovenop nog iemand met een gezondheid,
een reisschema van veertig weken en een inkomen dat over acht jaar binnenkomt en
veertig jaar mee moet.

| De vraag | Staat er iets? |
|---|---|
| Een club, bond of vereniging als zaak | **Ja** — genre `sportclub`, 34 sportroutes, eigen cockpit |
| Een festival dat een artiest boekt | **Ja** — `kern/festival/`, boeking, rider, afrekening |
| Zelf muziek maken en uitgeven | **Ja** — `kern/muziek*.js`, RTG Studio, eigen uitgave |
| Een maker die zijn carrière runt | **Ja** — genre `creator`, scherm heet letterlijk "Mijn carrière" |
| Een sporter/artiest als eigen onderneming | **Ja, via omweg** — genre `zzp` of `creator`; geen eigen genre |
| Een bedrijf dat een club sponsort | **Ja** — `sponsorMaak` / `sponsorInteresse` / `sponsorBeslis` |
| **RTG die een mens geld geeft voor zijn talent** | **Nee — nul.** Zie par. 1 |
| **Een zaakwaarnemer die namens iemand handelt** | **Nee.** Zie par. 4.2 |
| **Een beurs / stipendium aan een individu** | **Nee, en er staat een blokkade vóór.** Zie par. 2.3 |
| Gezondheidsbegeleiding van een topsporter | **Nee, en dat is een grens.** Zie par. 4.4 |

---

## 1. De meting

Niet geschat maar geteld, op 11 september 2026, uit de bron:

| Wat | Getal | Bron |
|---|---|---|
| Genres op het platform | 74 | `server/seed/genres.js` |
| Daarvan in de sector `sports` | **3** (sportclub, golfclub, fitnessclub) | idem |
| Genres voor een INDIVIDUELE sporter of artiest | **0** | idem |
| API-routes die iets met sport doen | 34 | `routes/sportclub.js`, `routes/clubs.js` |
| Waardeklassen in het huis | 6 | `kern/waarde/klassen.js` |
| Daarvan uitbetaalbaar | 2 | idem |
| Waardeklassen waarin RTG een MENS geld geeft dat van RTG is | **0** | idem |
| Vormen van vertegenwoordiging in de code | 3 | zie par. 4.2 |
| Daarvan: mens handelt commercieel namens mens | **0** | idem |

**Het scherpste getal is die nul bij de waardeklassen, en hij is geen
toevalligheid maar de vorm.** De zes klassen die er zijn, dekken vijf
werkelijkheden en niet de zesde:

- `PERSONAL_FUNDED` — het geld van het lid zelf, terug te storten. Niet van ons.
- `EMPLOYER_BUDGET` — een werkgever geeft, niet uitbetaalbaar.
- `MUNICIPAL` — een gemeente geeft, niet uitbetaalbaar.
- `LOYALTY` — RTG geeft, maar met zoveel woorden **niet uitbetaalbaar**: *"een
  korting die RTG bijlegt, geen aangehouden klantgeld"*.
- `GIFT` — een zaak geeft, alleen bij de uitgever te besteden.
- `PARTNER_SETTLEMENT` — RTG betaalt uit, maar aan een **zaak**, en met de grond
  *"ontvangen omzet van een ondernemer, geen aangehouden consumentengeld"*.

Er is dus wel een weg waarlangs geld van RTG naar buiten gaat, en die loopt
uitsluitend naar een onderneming. Een mens komt er alleen langs als hij zijn
eigen geld terughaalt. Wie een sporter wil betalen, moet daarom óf van hem een
onderneming maken (kan vandaag), óf de zesde klasse erbij zetten — en dat is
geen tabelregel maar een vergunningsvraag, zie par. 4.3.

*Terzijde, want het is gemeten en niet overgeschreven: de kop van
`server/seed/genres.js` spreekt over "deze 73 genres", het register telt er 74.
Eén regel drift, en precies de soort die LAT.md regel 4 bedoelt.*

---

## 2. Waarom "sponsor" hier het verkeerde woord is — en dat staat al in de code

Dit is geen taalkwestie. Het woord *sponsor* heeft in dit huis al twee
betekenissen, en de tweede is juridisch geladen.

### 2.1 Sponsoring is per definitie géén gift, en de code weigert dat al

`server/kern/rtfos/herkomst.js` heeft er een grendel voor staan:

> *"Er staat iets tegenover deze gift, dus het is geen donatie maar sponsoring.
> Boek hem als sponsoring: ander fiscaal regime, andere verantwoording."*

En `kern/rtfos/donateur.js` weigert het giftbewijs zodra `tegenprestatie` waar
is. Dat betekent: **zodra RTG iets terugverwacht — een logo, een post, een
aanwezigheid, een vermelding — is het per definitie commercieel en gaat er een
factuur uit.** De route via de RTFoundation is dan dicht, en niet omdat iemand
dat streng vindt maar omdat de code hem dichthoudt.

### 2.2 En de economische firewall weigert precies de constructie die voor de hand ligt

De voor de hand liggende opzet — *de stichting betaalt de sporters, het merk
RTG plukt de zichtbaarheid* — is exact waar `kern/economie/firewall.js` voor
gebouwd is. Vier werelden, standaard NEE, een relatie bestaat alleen met een
grondslag én een plafond, en er is een vijfde vraag die geen relatie kan openen:
`magDragerBelasten` — *een rekening landt bij de ENTITEIT van een wereld, nooit
bij een gebruiker ervan.*

Daar staat bovenop wat `ECONOMIE.md` in één zin zegt: **de RTFoundation is geen
kostenpost van RTG die je over gebruikers uitsmeert, maar een eigen rechtspersoon
met een eigen vermogen** — en dat wordt afgedwongen en niet beloofd.

### 2.3 De blokkade die er vóór allebei staat, en die vandaag hard is

`GIFT.md` is er eerlijk over: er is **geen codenaam en geen positie van de
RTFoundation om aan te betalen**, en haar ANBI-status is gemodelleerd maar niet
aangesloten — `kern/foundationregistratie*.js` legt ANBI en RSIN vast van
PÁRTNERstichtingen, en de giftlaag leest die status nul keer.

Dus: **een beurzenprogramma via de RTFoundation kan vandaag niet uitbetalen.**
Dat is geen bug die iemand even fixt; het zijn de drie besluiten uit GIFT.md, en
ze staan vóór dit hele plan en niet erna.

### 2.4 Er zijn dus precies twee eerlijke routes, en ze zijn niet uitwisselbaar

| | **Commercieel** (RTG BV) | **Beurs** (RTFoundation) |
|---|---|---|
| Wat het is | RTG koopt iets: beeld, aanwezigheid, rechten | Steun zonder tegenprestatie |
| Wereld | `commercieel` | `rtfoundation` |
| De sporter is | leverancier, met factuur en btw | begunstigde |
| Mag RTG een logo vragen? | ja, dat is de koop | **nee — dan is het sponsoring** |
| Mag RTG een post vragen? | ja | **nee** |
| Vandaag uitvoerbaar? | ja, via genre `zzp`/`creator` | nee, zie 2.3 |

Kiezen tussen die twee is geen redactiekeuze. Een programma dat beide wil zijn,
is de constructie waar de firewall en de giftgrendel allebei op gebouwd zijn.

---

## 3. Wat RTG heeft dat een sponsor nooit heeft

Hier zit het echte antwoord op *"ik wil zijn als Red Bull"*, en het is
tegendraads: **RTG kan die wedstrijd niet winnen en hoeft hem niet te spelen.**
Red Bull koopt zichtbaarheid met marketinggeld; wie dat wil verslaan, heeft meer
marketinggeld nodig. Wat RTG in plaats daarvan heeft, is het spul waar een
topsporter en een artiest werkelijk om vallen zodra ze dertig zijn — en geen
enkele sponsor levert het.

Een toptalent is namelijk tegelijk zes dingen, en voor vijf ervan staat hier al
software:

1. **Een onderneming.** `CONCERN.md`, en juist in de vorm die hier past: *één
   bedrijf is niet één KvK.* Een sporter met een BV, een stichting voor zijn
   fonds en startgelden uit drie landen is exact het geval waarvoor concern,
   entiteit, registratie, vestiging, merk en operating unit zes begrippen zijn.
2. **Een reiziger.** `REIZEN.md`, en dan het stuk dat er al staat en dat elke
   reisapp mist: **het Travel OS beheert ook de reis die RTG niet verkocht
   heeft.** Een sporter reist veertig weken per jaar op tickets van bonden,
   organisatoren en sponsors. Dat is letterlijk de vorm die er al is — elk
   reisonderdeel draagt een **soort** (wat de reiziger ziet) en een **herkomst**
   (wat het systeem weet).
3. **Iemand met geld dat piekt en dan stopt.** `GELD.md` en `WAARDE.md`. De
   duurste fout in de sport is niet te weinig verdienen maar het verkeerd
   vasthouden, en het onderscheid dat daarvoor nodig is bestaat hier al en is
   met opzet niet hetzelfde: een **reservering** is iemand anders die uw geld
   vasthoudt en die vervalt; een **oormerk** is u die uw eigen geld apart zet en
   dat blijft (`kern/waarde/oormerk.js`).
4. **Een mens met een gezondheid.** `LEVEN.md`, `kern/metingen.js`,
   `kern/trainingsschema.js` — en de grens uit `kern/zorgniveau.js` die dit huis
   eerder heeft getrokken dan er iets was om mee te praten. Zie par. 4.4; dit is
   het lastigste punt van het hele document.
5. **Een podium.** `kern/festival/`, `kern/muziek*.js` (RTG Studio: *alles wordt
   opgewekt, niets wordt geleend* — dus de muziek die een sporter onder zijn
   eigen clip zet, draagt geen licentie van een ander), `clips-studio`, De Salon.
6. **Iemand met een team om zich heen.** En dát is de steen die ontbreekt — par.
   4.2.

Geen vijfde wereld, en dat is een besluit. Een toptalent is geen nieuwe wereld
naast LivingOS, WorkOS, TravelOS en FoundationOS; hij is een mens die in alle
vier tegelijk staat. `WERELDEN.md` beslist dat met één vraag — *in welke context
denkt de mens dat hij zich bevindt wanneer hij dit gebruikt?* — en het antwoord
is per moment anders: zijn contract is WorkOS, zijn knie is LivingOS, zijn vlucht
naar Tokio is TravelOS, zijn fonds is FoundationOS. Een "RTG Sport"-wereld zou
alle vier dupliceren; `PLATFORM.md` par. 0b verbiedt dat met zoveel woorden.

---

## 4. De vier ontbrekende stenen

Niet veertig functies. Vier, en ze zijn ongelijk van gewicht.

### 4.1 De mens die van zijn talent leeft, bestaat niet als partij

Vandaag is iemand een **lid** (drager van de wereld `consument`) of een **zaak**
(drager van `commercieel`). Een toptalent is beide, gelijktijdig en permanent,
en het schuift: een zestienjarige is alleen lid, een negentienjarige heeft
ineens een startgeld en een sponsorcontract, een dertigjarige heeft een BV met
personeel.

De vorm ligt er al en hoeft niet uitgevonden te worden: **genre `creator` ís dit
patroon** — een mens wiens talent zijn inkomen is, met een scherm dat letterlijk
"Mijn carrière" heet. Wat ontbreekt is de sport- en podiumvariant ernaast, en de
schuif van "alleen lid" naar "ook zaak" zonder dat iemand een tweede account
aanmaakt (`kern/eenaccount.js` is de plek waar die vraag al woont).

**Wat je hier niet moet doen:** een `sporter`-tabel aanleggen. Dat is exact de
`humans`-tabel die `HDI.md` par. 5.1 verbiedt en waar `KANTOOR.md` op
terugkomt. De juiste vorm is een PROJECTIE zoals `kern/levensgraaf/graaf.js`,
met `deel` als poort en niet als etiket.

### 4.2 De zaakwaarnemer — en dit is het grootste onderscheidende vermogen dat hier ligt

Dit huis kent drie vormen van "iemand handelt namens iemand anders", en geen
ervan is deze:

| Vorm | Wie namens wie | Waar |
|---|---|---|
| Bijstand | RTG namens een klant | `kern/command/bijstand.js` |
| Servicemachtiging | een medewerker in een zaak van een lid | `kern/service/machtiging.js` |
| Mandaat | de AI namens een mens | `kern/stuur/mandaat.js` |
| **Zaakwaarneming** | **een mens commercieel namens een mens** | **bestaat niet** |

En dit is precies de relatie waar het in de sport en de muziek werkelijk misgaat:
een talent van zeventien tekent iets wat hij niet leest, bij iemand die hem
"ontdekt" heeft, en komt er op zijn vijfentwintigste achter wat hij heeft
weggegeven.

De grammatica om dat anders te doen, ligt hier al klaar en is niet voor deze
gelegenheid bedacht — dat is nu juist het punt:

- **Een mandaat verleent nooit vermogen maar VERSMALT bestaand vermogen**
  (`kern/stuur/mandaat.js`). Een zaakwaarnemer kan dus structureel nooit méér
  dan zijn cliënt, en **leeg is dicht**: geen mandaat betekent niets, niet alles.
- **Delegatie kan alleen versmallen** (`CONTROLPLANE.md`), en een bevoegdheid is
  geen ja of nee maar vier dimensies: wat, waar, hoeveel, wanneer.
- **Verval is een berekende toestand en geen opruimactie** (`SERVICE.md`), dus
  een volmacht die niemand intrekt, houdt vanzelf op.
- **Geld en het pasbesluit blijven mensenwerk**, hoeveel er ook in het mandaat
  staat.

Eén ding komt er hard bovenop en staat nergens anders: **de cliënt ziet zijn
eigen machtiging.** Niet op verzoek, niet in een export — als stand op zijn
scherm: wie mag vandaag wat namens mij, sinds wanneer, tot wanneer, en wat is er
namens mij gedaan. Dat is de vorm van `SERVICE.md` par. 13e, waar ontdekt werd
dat een lid toestemming gaf voor iets wat de medewerker al mocht.

Dit is wat RTG een sporter kan bieden dat niemand anders biedt, en het kost geen
sponsorbudget.

### 4.3 De beurs als waardeklasse — en waarom dat een besluit is en geen tabelregel

Er zou een zevende waardeklasse bij moeten. Maar `WAARDE.md` heeft daar een
grens die niet mag sneuvelen: **uitbetaalbaar hangt altijd aan een bevoegdheid
en nooit aan een boolean** — elke uitbetaalbare klasse noemt haar
`uitbetaalVermogen`. En de twee bestaande uitbetaalwegen passen geen van beide:

- `PARTNER_UITBETALING` gaat naar een ondernemer die omzet heeft gemaakt. Een
  beurs is geen omzet.
- `LID_UITBETALING` is **afhankelijk** van de terugstortstand en gaat bovendien
  over het geld van het lid zelf. Een beurs is geld van ons.

Dus: een klasse waarin RTG of de RTFoundation geld uitkeert aan een mens, is een
derde uitbetaalweg, en die vraagt zijn eigen bevoegdheid met zijn eigen grond.
Dat is exact de vorm van de terugstortstand in `CLAUDE.md`: **de schakelaar ís
de juridische positie.** Bouw er geen pad omheen.

Tot die bevoegdheid er is, is er wél een route die vandaag werkt en eerlijk is:
de sporter of artiest is een **zaak**, levert iets, en wordt betaald als
leverancier. Dat is commerciële rugdekking en geen beurs, en het moet ook zo
heten.

### 4.4 De gezondheidsgrens — het lastigste punt, en het antwoord is nee

Red Bull heeft een Athlete Performance Center. De verleiding om dat na te bouwen
is groot, en `kern/zorgniveau.js` sluit hem af — niet met een prompt maar met
code: drie niveaus, en bij `professioneel` mag RTG *"helpen de weg te vinden,
niet de inhoud te geven"*.

**Topsportbegeleiding IS per definitie professioneel niveau.** Een
belastingsmodel, een hartslagzone, een herstelprotocol, een terugkeer-na-blessure
— dat is allemaal werk voor iemand die de sporter kent en hem heeft zien bewegen.
`kern/trainingsschema.js` zegt dat al in zijn kop en somt op wat er daarom
bewust NIET in zit.

Er is één eerlijke uitweg en het is niet een uitzondering: **zet de professional
IN het systeem.** Die machinerie bestaat — `kern/persoonseis.js` en
`kern/vakbewijs.js` houden per genre vast dat de mens die de handeling doet
bevoegd is, met twee reikwijdtes (werk en handeling), met een stuk dat verloopt
en bij élke vraag opnieuw wordt gerekend. Een fysiotherapeut of sportarts die op
RTG werkt, mag inhoud geven. RTG zelf niet, en een AI zeker niet.

En daar hoort een grens bij die verderop terugkomt: **de betaler leest de
gezondheid nooit.** Dat is niet een gevoelig veld maar een andere dataklasse
(`HDI.md`).

---

## 5. De grenzen die niet mogen sneuvelen

Acht, en ze komen alle acht uit iets dat dit huis al heeft besloten. Waar een
functie met een grens botst, vervalt de functie.

1. **Een sporter onder de achttien is geen merk.** De progressiegrens
   (`kern/spellen/grens.js`) houdt scores en ranglijsten al weg bij wie de 18+-
   poort niet haalt, en `LEVEN.md` zegt: een kind is geen profiel. Voor
   rugdekking betekent dat: geen zichtbaarheidsverplichting, geen post, geen
   vermelding als voorwaarde, en geen ranglijst van jeugdtalenten. De topsport
   zit vol veertienjarigen; dit is de grens die het vaakst onder druk komt.
2. **Rugdekking koopt geen stem.** Wie geld ontvangt, is niet verplicht iets te
   zeggen, te dragen of te plaatsen. Zodra dat er wél tegenover staat, is het
   sponsoring — en dan hoort er een factuur uit te gaan (par. 2.1). Dat wordt
   niet met een formulering opgelost.
3. **De betaler leest de gezondheid nooit.** Wie een sporter draagt, mag zijn
   blessure, zijn medicatie en zijn belasting niet zien. Geen uitzondering voor
   "we willen weten of hij fit genoeg is": dat is precies de vraag waarvoor de
   grens bestaat.
4. **De machtiging van een zaakwaarnemer kan alleen versmallen, en de cliënt
   ziet hem.** Zie par. 4.2. Een volmacht die de cliënt niet op zijn eigen
   scherm ziet staan, bestaat niet.
5. **Er komt geen cijfer op een mens.** Geen talentscore, geen potentieelrating,
   geen ranglijst van wie de meeste steun verdient — ook niet intern als
   sorteersleutel. Dat staat al in `KANTOORMACHT.md` en in `ONTMOETEN.md`, en
   het geldt hier woordelijk hetzelfde.
6. **Geld verlaat het huis nooit vanzelf.** `GELD.md` en `FABRIC.md`. Een
   toekenning wordt KLAARGEZET; een mens geeft vrij. De AI beweegt geen geld,
   ook niet onder een mandaat.
7. **RTG belooft nooit selectie, toegang of een plek.** Dezelfde regel als bij
   de passen in `CLAUDE.md`: de AI mag nooit zelf toegang beloven of verlenen.
   Een talentprogramma dat suggereert dat deelname iets oplevert wat het niet
   oplevert, is de duurste vorm daarvan.
8. **Een afwijzing zegt waarom, en een niet-toegekende beurs is geen oordeel
   over een mens.** Een solver toont altijd meer dan één pad en zegt nooit "dit
   is niets voor jou" (`HDI.md`). Bij een talentprogramma is dat geen
   vriendelijkheid maar de kern: wie afvalt, valt af uit een regeling en niet
   uit een leven.

---

## 6. De volgorde: wat staat, wat een stap weg is, wat een besluit vraagt

Zoals `PLATFORM.md`, `ECONOMIE.md` en `HDI.md`, zodat niemand die vier voor
elkaar aanziet.

| # | Onderdeel | Stand |
|---|---|---|
| 1 | Club, bond, vereniging als zaak | **staat** (`kern/sportclub/`) |
| 2 | Festival boekt en rekent af met een artiest | **staat** (`kern/festival/`) |
| 3 | Zelf muziek maken en uitgeven, rechtenvrij | **staat** (`kern/muziek*.js`) |
| 4 | Een maker die zijn carrière runt als zaak | **staat** (genre `creator`) |
| 5 | Eigen boekhouding, btw, facturen voor een talent-BV | **staat** (`kern/fiscaal/`, `kern/commercie/`) |
| 6 | Reizen die RTG niet verkocht heeft, mét herkomst | **staat** (`REIZEN.md`) |
| 7 | Eigen geld oormerken over een lange horizon | **staat** (`kern/waarde/oormerk.js`) |
| 8 | Een sporter/artiest die zich als zaak aanmeldt | **een stap weg** — genre toevoegen in `genres.js`, verder niets |
| 9 | Betaald worden door RTG als leverancier | **een stap weg** — bestaande partnerrail, wel eerlijk benoemen (par. 2.4) |
| 10 | De cliënt ziet wie wat namens hem mag | **een stap weg** — vorm van `SERVICE.md` par. 13e |
| 11 | Zaakwaarneming als eigen mandaatvorm | **een besluit** — par. 4.2; geen nieuw rechtenmodel, wel een nieuwe drager |
| 12 | Een beurs uitbetalen aan een mens | **een besluit** — en de drie besluiten van `GIFT.md` staan ervóór |
| 13 | Gezondheidsbegeleiding op topsportniveau | **een besluit, en het antwoord neigt naar nee** — par. 4.4 |
| 14 | "De grootste sponsor van alle topsporters" | **jaren weg, en waarschijnlijk nooit** — zie par. 3: dit is de wedstrijd die met geld gewonnen wordt |

De goedkoopste twee regels van deze tabel zijn 10 en 8. Samen kosten ze minder
dan een week en ze doen meer voor de sporter uit de aanleiding dan de vijf
eronder — precies de vorm van `HDI.md` par. 7.

---

## 7. De besluiten die de eigenaar moet nemen

Vier, met per optie wat het betekent en wat het kost. Ze zijn niet
uitwisselbaar en ze staan in volgorde: besluit 1 bepaalt de rest.

### Besluit 1 — Hoe heet het geld dat naar een talent gaat?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Commerciële rugdekking** *(aanbevolen)* | De sporter is leverancier, levert iets, krijgt een factuurbetaling. Eerlijk, vandaag uitvoerbaar, geen vergunningsvraag. | Er staat iets tegenover, en dat moet ook zo heten. Geen "belangeloze steun" in de communicatie. |
| B. Beurs via de RTFoundation | Geen tegenprestatie, geen logo, geen post. Past bij het merk. | Vraagt eerst de drie besluiten van `GIFT.md`, en daarna een derde uitbetaalbevoegdheid (par. 4.3). Maanden, niet weken. |
| C. Allebei, netjes gescheiden | Twee programma's, twee werelden, twee registers. | Het duurste, en de firewall dwingt de scheiding af — dus het moet echt gescheiden zijn en niet in naam. |
| D. Allebei, door elkaar | — | **Kan niet.** Dit is de constructie die `firewall.js` en `herkomst.js` weigeren. |

### Besluit 2 — Komt er een genre voor de individuele sporter/artiest?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Eén genre `talent`** *(aanbevolen)* | Sporter, artiest, muzikant en maker in één genre met eigen caps, naast `creator`. | Klein: een regel in `genres.js` plus caps. Maar het woord `talent` is bezet (Talent Exchange = vacaturematching) — dus hernoemen of uitwijken, zoals `OS.md` voorschrijft. |
| B. Twee genres: `sporter` en `artiest` | Scherper, eigen taal per groep. | Twee keer de caps, en de vraag "wat delen ze" komt binnen een jaar alsnog. |
| C. Geen genre; `zzp` en `creator` volstaan | Nul werk. | De sporter voelt zich een zzp'er, en dat is hij ook — maar dan is er geen enkel verschil met elk ander platform. |

### Besluit 3 — Bouwen we de zaakwaarneming?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Ja, en als eerste** *(aanbevolen)* | De machtiging die alleen kan versmallen, zichtbaar bij de cliënt, met verval. Het enige in dit document dat niemand anders heeft. | Middelgroot. Geen nieuw rechtenmodel — het versmalt bestaand vermogen (par. 4.2). |
| B. Later, na het geld | Eerst betalen, dan beschermen. | Dan is de eerste zaakwaarnemer er eerder dan zijn grens, en dat is precies de volgorde die dit huis elders vermijdt. |
| C. Niet | — | Dan is RTG voor een talent een betaalkanaal, en die zijn er al. |

### Besluit 4 — Doen we iets met de gezondheid van een topsporter?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Alleen de weg naar een mens** *(aanbevolen)* | RTG houdt vast wat de sporter of zijn coach erin zet, en geeft geen inhoud. Exact `zorgniveau.js` vandaag. | Nul. Het staat er al. |
| B. Professionals in het systeem | Fysio's en sportartsen als bevoegde zaken; zij geven inhoud, RTG niet. | Middelgroot, maar de machinerie bestaat (`persoonseis.js`, `vakbewijs.js`). |
| C. Een eigen belastingsmodel van RTG | Belasting, zones, herstel, terugkeer na blessure. | **Botst met `zorgniveau.js`.** Dat is een grens in code, geen achterstand. |

---

## 8. Wat dit document NIET zegt

- Het zegt niet dat RTG geen sporters kan betalen. Het zegt dat er twee wegen
  zijn en dat ze verschillende namen, registers en gevolgen hebben.
- Het zegt niets over bedragen. Er staat nergens in dit huis een prijs voor
  rugdekking, en die verzinnen is precies wat `PRIJZEN.md` verbiedt.
- Het zegt niets over welke sporter. Selectie is mensenwerk en er komt geen
  model dat het voorstelt (grens 5 en 7).
- Het beweert niet dat de zes bouwstenen uit par. 3 *samen* al een
  talentprogramma vormen. Ze staan los van elkaar, en dat ze op dezelfde mens
  passen is een ontwerpvraag en geen gemeten feit — de vorm daarvoor is de
  ketenproef (`scripts/tafelproef.js`, `scripts/ritproef.js`,
  `scripts/toelatingsproef.js`) en die is voor dit onderwerp niet gedraaid.
