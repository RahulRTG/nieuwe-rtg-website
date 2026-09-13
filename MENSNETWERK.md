# RTG Mensnetwerk

*Welke mensen brengen bijzondere waarde het netwerk in, hoe komen zij binnen,
wat krijgen zij terug — en wie mag namens hen handelen.*

`CARRIERE.md` staat hierboven en niet ernaast: dat beantwoordt wat de mens die
van zijn talent leeft in dit huis IS, en het draagt de meting die zegt waarom
daar geen objecttype voor komt. `RUGDEKKING.md` beantwoordt één vraag daaruit
(hoe heet het geld dat naar zo'n mens gaat). Dit document beantwoordt de twee
die overbleven: **hoe komt hij binnen, en wie staat er naast hem.**

Lees dit vóór je een aanmeldweg, een vertegenwoordigingsmodel of een
RTG-managementdienst bouwt.

**De kern in één zin: RTG biedt geen managementmodel aan maar een keuze uit
modellen — en de enige reden dat die keuze geloofwaardig is, is dat de manager
van RTG door precies dezelfde deur moet als de manager van de concurrent.**

Dat is vandaag geen belofte maar een afgedwongen eigenschap, en par. 0.4 laat
zien waar. Wie die eigenschap opgeeft om een verkoopgesprek makkelijker te
maken, heeft het hele document weggegooid.

---

## 0. De vier metingen die vóór alles gaan

Gemeten op 13 september 2026, uit de bron. Het voorstel waar dit document op
antwoordt rust op vier beweringen, en ze zijn alle vier na te rekenen in plaats
van aan te nemen — dezelfde volgorde als bij `Asset` (`OBJECTMODEL.json`) en bij
de carrièrelus (`CARRIEREVORM.json`).

### 0.1 "Ongeveer de helft van de infrastructuur staat er al" — dat klopt

De voorgestelde keten telt zeventien onderdelen. Nagekeken:

| | Onderdeel | Stand |
|---|---|---|
| 1 | Human Value Profile | **half** — genre `talentmens` en zeven hoedanigheden staan; een profiel niet |
| 2 | Talent Intake | **half** — `kern/aanmeldgesprek*.js` staat, kent dit onderwerp niet |
| 3 | Identity / A3 | **staat** — `kern/betrouwbaarheid.js`, `/apps/verificatie.html` |
| 4 | Passkey | **half** — `server/webauthn/` staat, hangt niet aan de zware handelingen |
| 5 | My World | **botst** — er is er één, en hij is niet van de mens alleen (par. 2.4) |
| 6 | Circle of Trust | **staat** — `kern/vertegenwoordiging/`, 8 routes, eigen scherm |
| 7 | Proof of Career | **staat** — `kern/carriereledger/`, 10 routes, 2 schermen |
| 8 | Proof Wallet | **half** — deelcodes staan (`kern/bearercode.js`); VC/OpenID4VCI niet |
| 9 | Rights Vault | **bestaat niet** |
| 10 | Likeness Firewall | **bestaat niet** |
| 11 | Rugdekking | **staat zonder scherm** — par. 5.2 |
| 12 | Economic Person | **geen vijfde wereld nodig** (par. 2.5); de uitbetaalweg is een besluit |
| 13 | Opportunity Room | **half** — `kern/commercie/voorstel.js` + `voornemen.js` als patroon |
| 14 | Roster Workspace | **staat als gegeven** — `ikSta` in `/api/vertegenwoordiging/mijn`; geen scherm |
| 15 | Direct Community | **half** — De Salon, tickets, membership en merch bestaan los |
| 16 | Opportunity Matching | **bestaat niet**, en de vorm is al beslist (`CARRIERE.md` par. 4.3) |
| 17 | Legacy | **bestaat niet** — en het is geen functie, zie par. 2.1 |

Vijf staan, zes staan half of als patroon, zes bestaan niet. **De schatting "de
helft" is dus juist**, en dat is hier het zeldzame geval waarin een meting een
voorstel bevestigt in plaats van corrigeert. De opdracht is bedraden en niet
uitvinden — dezelfde uitkomst als in `AFSPRAAK.md`.

### 0.2 Vier naamsbotsingen, en ze zijn geteld

`OS.md` heeft dit huis één keer geleerd wat een gedeelde naam kost: twee
bestanden met allebei een `VERMOGENS` en nul gedeelde leden. De vier
voorgestelde productnamen dragen alle vier een woord dat hier al iets anders
betekent — geteld in `server/kern/`:

| Voorgesteld | Het woord | Wat het hier al is | Bestanden |
|---|---|---|---|
| Rights **Vault** | kluis | de identiteitskluis: echte namen achter codenamen | **192** |
| Proof **Wallet** | wallet | geld — `WAARDE.md`, `TOKEN.md`, `WALLET_SALDO` | **87** |
| Performance **Passport** | paspoort | het identiteitsbewijs, bron van `leeftijdBron` | **139** |
| Likeness **Firewall** | firewall | `kern/economie/firewall.js`, de grens tussen vier werelden | **26** |

De derde is de gevaarlijkste. `leeftijdBron: 'paspoort'` is precies het signaal
waarop het jeugdbestuur beslist of iemand een voogd nodig heeft; een tweede
"paspoort" dat over sportprestaties gaat, zet dat woord in dezelfde zinnen naast
een andere betekenis. Hernoemen vóór de eerste regel code, niet erna.

### 0.3 De gevraagde managementhandelingen tegen de gesloten lijst

`kern/vertegenwoordiging/bevoegdheden.js` kent **negen** bevoegdheden en **zeven**
dingen in NOOIT. Het voorstel vraagt om een manager die aanbiedingen bekijkt,
voorstellen maakt, conceptdocumenten uploadt, agenda-afspraken voorstelt, reizen
regelt en niet mag tekenen of geld verplaatsen. Naast elkaar gelegd:

| Gevraagd | Bestaat als |
|---|---|
| sponsoraanvragen bekijken | `aanbod.ontvangen` |
| onderhandelen / voorstellen maken | `aanbod.bespreken` (`klaarzetten: true`) |
| conceptdocumenten opstellen | `contract.opstellen` (`klaarzetten: true`) |
| agenda-afspraken voorstellen | `agenda.voorbereiden` |
| reizen regelen | `reis.voorbereiden` |
| facturen klaarzetten | `factuur.voorbereiden` |
| loopbaan inzien | `loopbaan.lezen` |
| ✗ contract ondertekenen | NOOIT 2 |
| ✗ geld verplaatsen | NOOIT 1 |
| ✗ bankgegevens wijzigen | NOOIT 3 |

**Het voorgestelde machtigingsscherm is bijna letterlijk het bestaande.** Dat is
geen toeval: het is dezelfde grammatica, en zij komt uit `kern/stuur/mandaat.js`.

Maar één gevraagd onderdeel valt er hard buiten, en het is niet het zwaarste
maar het vanzelfsprekendste: **de pods.** Een lead manager die werk doorzet naar
commercial, rights, travel of legal is *delegatie*, en delegatie staat in NOOIT
met zoveel woorden — *"een machtiging die zichzelf kan doorgeven, is geen
machtiging maar een sleutel."* Zie par. 2.6 voor de vorm die wél overleeft.

### 0.4 "RTG krijgt geen systeemvoordeel" — dat is vandaag al afgedwongen

Dit is de belangrijkste uitkomst van de vier, want het is het enige dat een
verkoopverhaal onderscheidt van een marketingzin.

Er staat vandaag **geen enkele** kantoorweg in `kern/vertegenwoordiging/` waarmee
RTG zichzelf een machtiging kan geven. Sterker: `routes/vertegenwoordiging.js`
draait achter de domeingrens `vertegenwoordiging` en **kan per definitie niet bij
`kluisAuth`** — dat staat uitgeschreven in de kop van `routes/office/voogdij.js`,
de enige kantoorroute in dit domein, en die gaat over iets anders (een mens van
RTG bevestigt ná bewijs een voogdij, hij vertegenwoordigt niemand).

Een RTG-manager is dus structureel een `manager` zoals elke andere: hij staat in
`HOEDANIGHEDEN` naast zaakwaarnemer, boekhouder, advocaat, coach, assistent en
ouder, en hij krijgt zijn bevoegdheden doordat de cliënt ze aanvaardt. De zin
*"zelfs wij krijgen alleen toegang die jij ons geeft"* is hier geen belofte maar
een gevolg van de domeingrens.

**Wat ontbreekt is de handhaver die dat vasthoudt.** De grens bestaat vandaag
doordat niemand hem heeft doorbroken, niet doordat iets zakt als je het
probeert. Dat is precies de stand waar `CARRIERE.md` CAR-05 in stond vóór
`test/cijferopmens.test.js` — vier documenten en nul toetsen.

---

## 1. Wat het voorstel goed heeft en wat dus niet opnieuw bedacht moet worden

Vier dingen staan er al in de vorm die het voorstel beschrijft. Ze worden hier
genoemd omdat het duurste wat je met dit document kunt doen, is ze nog een keer
bouwen.

**De Permission Simulator staat, inclusief de diff.**
`kern/vertegenwoordiging/simulatie.js` toont vóór aanvaarding wat er verandert
(erbij, eraf, gelijk), toont de NOOIT-lijst even groot, schrijft niets, en geeft
met opzet géén cijfer. De voorgestelde waarschuwing *"deze machtiging is breder
dan de vorige"* is regel 1 van dat bestand.

**De Roster Workspace staat als gegeven.** `/api/vertegenwoordiging/mijn` geeft
twee kanten terug: `team` (wie mag iets namens mij) en `ikSta` (voor wie sta ik).
Een manager met achttien cliënten leest zijn roster dus vandaag al uit de
bestaande route; wat ontbreekt is het werkblad eromheen. En de eigenschap die het
voorstel eist — *de manager bezit die dossiers niet, bij intrekking verdwijnt de
cliënt onmiddellijk* — is geen functie maar de vorm: `ikSta` is een projectie
over lopende machtigingen, en `stand()` wordt bij elke vraag opnieuw gerekend.

**De Circle of Trust staat.** Zeven hoedanigheden, negen bevoegdheden met een
grond, verval als berekende toestand, aanvaarden door de cliënt, een eigen
plafond dat ook lopende machtigingen raakt, en een spoor van **geweigerde**
pogingen. Dat laatste is het onderdeel dat het voorstel terecht uitlicht en dat
nergens anders bestaat.

**Het jeugdbestuur staat, en strenger dan het voorstel vraagt.** De jongere
tekent eerst, de voogd kan niet vooruit tekenen, de voogd kan niet ook de
vertegenwoordiger zijn, en een voogd compenseert leeftijd maar nooit onbekende
identiteit. De voorgestelde Youth Safe Mode voegt daar drie dingen aan toe die er
werkelijk niet zijn: een maximumduur voor commerciële mandaten van een
minderjarige, een verbod op verborgen exclusiviteit, en een herbeoordeling op de
achttiende verjaardag. Zie par. 7 regel 9.

---

## 2. De zeven plekken waar het voorstel tegen een bestaande grens loopt

Vier zijn te repareren door een vorm te kiezen die al bestaat. Drie zijn een nee.

### 2.1 De Talent Path is een ladder op een mens

`DISCOVERED → EMERGING → VERIFIED → PROFESSIONAL → ESTABLISHED → ELITE → LEGACY`
is zeven treden waarop een mens omhoog kan. Dat is dezelfde vorm als de fanladder
die `CARRIERE.md` par. 4.2 al heeft afgewezen, en de grens staat vier keer
onafhankelijk: `KANTOORMACHT.md` (een score op een mens wordt nooit een
sorteersleutel), `HDI.md` (de meeteenheid is nooit de mens, ook niet intern),
`ONTMOETEN.md` en `LIFE.md` (er komt geen cijfer op het leven tussen mensen), en
`CARRIERE.md` CAR-05 — die sinds deze zomer een echte handhaver heeft in
`scripts/lib/cijferopmens.js`.

Het voorstel ziet het zelf half aankomen (*"een amateur-wielrenner kan
Professional zijn"*), en die nuance is nu juist het bewijs dat de trede een
oordeel is en geen feit.

**De vorm die overleeft staat al in het huis:** wat iemand heeft gedaan is een
feit, waar hij "staat" is een oordeel. Het Career Ledger toont de feiten in
chronologische volgorde, met per regel wie hem bevestigde en wat die bevestiging
níét zegt. Wie een etiket nodig heeft voor een schermkop, gebruikt de
hoedanigheid die de mens zelf heeft opgegeven — niet een trede die RTG toekent.

**En "Legacy" is geen zevende trede maar de afwezigheid van een vervalmoment.**
Dat een loopbaanboek na een carrière gewoon blijft staan, is al waar: het ledger
kent alleen bijschrijven en intrekken. Daar hoeft niets voor gebouwd te worden,
en er hoort juist niets voor gebouwd te worden.

### 2.2 De Contribution Graph en de Network Seed Value zijn allebei een cijfer op een mens

Acht balken (Reach, Trust, Expertise, Commercial, Community, Cultural, Growth,
Platform fit) is niet de uitweg uit één score maar acht scores. `CARRIERE.md`
par. 4.1 laat precies één vorm toe: **zeven aparte, aanwijsbare voorraden met hun
opbouw, nooit als sorteersleutel over mensen.** Het verschil is niet cosmetisch —
een voorraad die je kunt navertellen ("41 mensen kwamen drie keer") is iets
anders dan een balk op 87%, en die tweede kan niemand navertellen.

De Network Seed Value is scherper en hoort hier apart:

> *Talent 1 · potential members 18.400 · annual commerce €620k · deze persoon
> kost €8.000 om binnen te halen.*

Dat is een **prijs op een mens**, bedoeld als sorteersleutel voor wie RTG wel en
niet benadert. "Niet publiek, alleen intern" is geen verzachting maar precies de
uitzondering die `HDI.md` uitsluit. En het botst met grens 8 van `RUGDEKKING.md`:
wie afvalt, valt af uit een regeling en niet uit een leven.

**Wat wél mag, en het is bijna hetzelfde werk:** meet het NETWERK en niet de
mens. Hoeveel organisaties, zaken en leden zijn er via dit *programma*
binnengekomen — een programma is een regeling, en een regeling mag geëvalueerd
worden. `kern/rtfos/gemeente.js` is daar de bestaande vorm voor: een outcomes
ledger die telt zonder te lezen.

### 2.3 De vier naamsbotsingen — hernoemen vóór de eerste regel

Zie par. 0.2. Voorstellen die met niets botsen en op de bestaande conventie
passen: **Rechtenboek** (in plaats van Rights Vault), **Bewijsmap** (Proof
Wallet), **Prestatiebeeld** (Performance Passport) en **Gelijkenisgrendel**
(Likeness Firewall). De laatste is het belangrijkste product van de vier en
verdient de minst ambtelijke naam; als de eigenaar iets beters heeft, is dat
prima — als het maar geen `firewall` is.

### 2.4 "My World" bestaat, en hij is niet van de mens alleen

`WERELD.md` is hard: er is **één** beginscherm, en dat is de werktafel van RTG
Command. Inloggen, een werkblad sluiten en op Home drukken komen alle drie op
dezelfde lege keuze uit. Daarnaast kent `WERELDEN.md` vier werelden, en de regel
dat een vijfde erbij komt is `PLATFORM.md` par. 0b — een toptalent staat in
LivingOS, WorkOS, TravelOS en FoundationOS *tegelijk*, en een eigen wereld zou
alle vier dupliceren. Dat besluit staat al in `RUGDEKKING.md` par. 3.

Wat het voorstel werkelijk beschrijft — één scherm met vandaag, Rahul, en de
onderdelen die er voor deze mens toe doen — is geen wereld maar een **werkblad**,
en dat is een bestaand begrip (`WERKRUIMTE.md`). De correcte vorm is dus: geen
`My World`, wel een werkblad dat de bestaande wereldindeling gebruikt. Anders
staat er binnen een jaar een tweede thuisscherm naast het enige thuisscherm.

### 2.5 "Economic Person" is geen vijfde wereld

Dit is de belangrijkste correctie in het document, want ze maakt een blokkade
kleiner dan hij lijkt.

`kern/economie/werelden.js` kent vier economische werelden en **de wereld is een
eigenschap van de identiteit**: `consument`, `commercieel`, `rtg-intern`,
`rtfoundation`. De natuurlijke persoon heeft daarmee al een wereld, en de meting
loopt al op vijf identiteitssoorten (lid, zaak, gezin, lab, huis). De zin *"maak
eerst een KvK aan omdat onze database anders geen ontvanger kent"* is dus
feitelijk onjuist: **de database kent de mens uitstekend.**

Wat ontbreekt is geen datamodel maar een **bevoegdheid om hem te betalen**. Van
de zes waardeklassen is er geen enkele waarin RTG geld dat van RTG is uitkeert
aan een mens, en de twee bestaande uitbetaalwegen passen geen van beide
(`PARTNER_UITBETALING` gaat naar een ondernemer met omzet; `LID_UITBETALING` gaat
over het geld van het lid zelf). De derde weg is er als besluit —
`RUGDEKKING_BEURS` in `kern/bevoegdheid/lijst-afhankelijk.js`, met
`zonderStand: 'gesloten'` — en hij staat dicht.

**CAR-01 is daarmee geen technische schuld maar een vergunningsvraag**, en dat is
goed nieuws: er hoeft niets te worden omgebouwd, er moet iets worden besloten.
En dan geldt onverkort wat `CLAUDE.md` over de terugstortstand zegt: **de
schakelaar ís de juridische positie.** Bouw er geen pad omheen.

### 2.6 De pods botsen met de NOOIT-lijst, en de uitweg is beter dan het voorstel

Een lead manager die intern doorzet naar commercial, rights, travel of finance is
delegatie, en delegatie is uitgesloten. Dat is geen formaliteit: een machtiging
die zichzelf kan doorgeven, is een sleutel, en de cliënt weet dan niet meer wie
er in zijn dossier zit.

De uitweg die overleeft is strenger én eerlijker: **elke specialist heeft zijn
eigen machtiging van de cliënt**, met zijn eigen hoedanigheid
(`boekhouder`, `advocaat`, `assistent`) en zijn eigen bevoegdheden. De cliënt
ziet dan op één scherm precies wie er namens hem werkt — wat het voorstel zelf
als "Mijn RTG-team" tekent. Het verschil zit in de administratie, niet in de
beleving: RTG regelt de aanvraag, de cliënt drukt zeven keer in plaats van één
keer, en het blijft waar dat niemand toegang heeft die hij niet zelf heeft
gegeven.

Wat daar wél voor nodig is en vandaag niet bestaat: een **machtigingsbundel** —
één voorstel dat meerdere machtigingen tegelijk klaarzet, met één aanvaarding per
stuk. Dat is een scherm en een route, geen nieuw rechtenmodel.

### 2.7 De Second Opinion is een juridische uitspraak zonder klassen

Een managementcontract lezen en melden dat er exclusiviteit op alle commerciële
inkomsten rust, is een juridische uitspraak over het contract van een mens. Aan
de fiscale kant heeft dit huis daar een vorm voor: `kern/fiscaal/zekerheid.js`
met vier klassen (`bepaald`, `uitlegbaar`, `advies`, `voorbehouden`) en de regel
dat een uitkomst die niemand heeft ingedeeld terugvalt op de voorzichtige klasse
en dat ook zegt.

Aan de juridische kant bestaat die vorm **niet**. Wat er is, zijn losse zinnen —
*"geen juridisch advies"* staat verspreid in tien bestanden als vrije tekst.
Precies de situatie die `CLAUDE.md` voor fiscale uitspraken heeft opgelost: één
zin onder alles, die na een week niemand meer leest.

Dus: een Second Opinion mag, maar niet vóór er een juridische
zekerheidsindeling is. *"Deze overeenkomst loopt automatisch twee jaar door
tenzij u 90 dagen van tevoren opzegt"* is `bepaald` (het staat er letterlijk).
*"Deze commissieregeling is ongebruikelijk breed"* is `advies`. En *"zeg dit
contract voor u op"* is `voorbehouden`, net als indienen namens een ondernemer.

---

## 3. De vijf modellen, en waarom ze technisch één ding zijn

Het voorstel wil vijf routes waaruit een mens kiest. Dat is goed, en het is
goedkoper dan het klinkt: **alle vijf draaien op dezelfde machtiging.** Het
verschil tussen "mijn eigen manager" en "RTG Management" is commercieel en
menselijk, niet technisch — en dat is precies waarom het eerlijk kan zijn.

| Model | Wie handelt | Wat RTG doet | Wat er vandaag voor nodig is |
|---|---|---|---|
| **Zelf** | de mens | gereedschap + Rahul | niets — staat |
| **Eigen manager koppelen** | externe manager | machtiging faciliteren | niets — staat |
| **Manager zoeken** | externe manager | verwijzen naar geverifieerde professionals | een register van geverifieerde managers (bestaat niet) |
| **Aanvullen (co-management)** | meerdere partijen | een deel van de bevoegdheden | machtigingsbundel (par. 2.6) |
| **RTG Management** | een mens van RTG | volledige vertegenwoordiging | par. 4 — en dat is het echte werk |

De vijfde rij is geen software maar een **dienst met mensen erin**, en dat is de
enige rij die RTG nieuw geld kost. Wat hem mogelijk maakt is dat de andere vier
er al staan: RTG kan de dienst aanbieden zonder dat iemand ertoe gedwongen is,
en dat is de hele grap.

**Interim management** (30, 60 of 90 dagen als de manager wegvalt) verdient
aparte vermelding: hij is de goedkoopste van de vijf om aan te bieden, want
`MAX_MAANDEN` en het berekende verval doen het meeste werk al, en hij raakt de
mens op het moment dat hij het hardst nodig heeft.

---

## 4. RTG als vertegenwoordiger: de belangenverstrengeling

Zodra RTG zowel de infrastructuur levert als de vertegenwoordiging, is elke
aanbeveling verdacht. Het voorstel ziet dat en lost het op met een voornemen
("Rahul mag niet zeggen dat je huidige manager slecht is"). Een voornemen is hier
niet genoeg — `LAT.md` regel 1 en de hele opzet van dit huis zeggen dat een regel
die nergens wordt afgedwongen een belofte is en geen regel.

Zes regels, met per regel wie hem zou moeten handhaven.

| # | Regel | Handhaver |
|---|---|---|
| MN-01 | **Een RTG-manager gaat door dezelfde deur als elke andere.** Geen kantoorweg naar een machtiging, geen `if (manager === RTG)`. | vandaag de domeingrens (par. 0.4); een toets ontbreekt |
| MN-02 | **De AI beveelt RTG Management niet aan.** Hij noemt bij een aflopend mandaat alle routes, of geen. | niemand — dit is een systeemprompt-regel zonder toets |
| MN-03 | **De managementvergoeding is geen omzetcommissie.** De 0%-belofte over platformomzet staat en beweegt niet; een managementfee hangt aan benoemde diensten en aan door RTG gesloten deals. | `kern/commercie/vergoeding.js` (voor de platformkant); de managementkant bestaat niet |
| MN-04 | **Exclusiviteit is nooit een voorwaarde voor infrastructuur.** Wie RTG Management verlaat, houdt zijn account, loopbaan, rechten en team. | de uitstaptoets van `CARRIERE.md` par. 5 — nog niet gebouwd |
| MN-05 | **Vertrek is een knop en geen gesprek.** Intrekken kan per direct, zonder tussenkomst van de partij die wordt ingetrokken. | `kern/vertegenwoordiging/acties.js` — staat |
| MN-06 | **RTG stelt geen oordeel vast over de manager van iemand anders.** Feiten uit het contract mogen; een kwalificatie is `advies` en draagt zijn klasse. | par. 2.7 — de juridische zekerheidsindeling bestaat niet |

Van de zes hebben er vandaag **twee** een handhaver. Dat is de eerlijke stand, en
het is dezelfde stand waarin `KANTOOR.md` par. 13 zijn tien wetten aantrof.

**MN-03 verdient een waarschuwing apart.** Tot 20 augustus 2026 had de boardroom
een generieke commissieknop: standaard 12 procent, per genre te zetten, tot 30
procent. Die is eruit gehaald omdat drie dingen tegelijk misgingen, en het huis
zichzelf op drie manieren tegensprak over hetzelfde getal. Een managementfee die
als percentage van "alles wat iemand verdient" wordt ingebouwd, is die knop
terug. De vorm die wél kan is die van de vier benoemde vergoedingen: **per
inkomstensoort, vooraf zichtbaar, en nul waar RTG niets heeft gedaan** — precies
de tabel die het voorstel zelf tekent (clubsalaris 0%, een door RTG gesloten
merkdeal een afgesproken percentage, een bestaande sponsor 0%).

---

## 5. De acquisitie

### 5.1 De vier kanalen

| Kanaal | Stand |
|---|---|
| De publieke voordeur (`index.html`, `/site/passen/`, `/site/werelden/`) | **staat**, maar spreekt per pas en per wereld — geen woord richting een mens met een talent |
| Het aanmeldgesprek met Rahul | **staat**, kent dit onderwerp niet; hij adviseert RTG Pass en belooft (terecht) niets |
| Het kantoor kent rugdekking toe | **staat, en is per definitie outbound** — er is geen aanmeldweg |
| Via de organisatie: club, bond, festival, label | **het sterkste kanaal, en ongebruikt** — de organisatie is al een zaak, de mens al een lid |

Het vierde is het goedkoopste en het minst gebouwde. Het Career Ledger heeft er
al een haakje voor: een zaak kan vanaf haar eigen account een regel **bevestigen**
(`supplierAuth`), en dat is precies de handeling waarmee een club aantoont dat
iemand bij haar hoort. Wat ontbreekt is de uitnodiging ernaartoe. En de grens
staat er al bij: een club kan een regel bevestigen maar er geen voorstellen — het
lid schrijft, een ander bevestigt, en die volgorde is wat voorkomt dat een club
in het dossier van een oud-speler schrijft.

### 5.2 De drie gaten, gemeten

**Rugdekking heeft geen scherm.** De functieschakelaar heet *"Rugdekking (wie
staat er achter mij)"*, staat standaard aan, `/api/rugdekking/mijn` bestaat — en
geen enkel bestand in `public/` roept die route aan, en er is geen ingang in
`MAPPEN`. De mens om wie het gaat kan vandaag niet zien dat RTG achter hem staat.

**Er is geen aanmeldweg.** `routes/rugdekking.js` kent alleen `lijst` en `mijn`,
allebei lezend. De vorm die `RUGDEKKING.md` overhield — *het merk beschrijft een
programma, het talent meldt zich aan* — is niet gebouwd, en zonder die weg is
elke acquisitie handwerk.

**De A3-poort staat vóór het sterkste argument.** "Mijn team" gaat pas open als
RTG het identiteitsbewijs heeft gezien. Dat is met opzet — een commerciële
volmacht hoort niet te kunnen op een zelf ingetypte geboortedatum — maar het
betekent dat verificatie **onderdeel van de onboarding** is en niet iets van
later. Het voorstel heeft daar gelijk in.

---

## 6. De grenzen die niet mogen sneuvelen

Bovenop die van `CARRIERE.md` en `RUGDEKKING.md`, die onverkort blijven gelden.

1. **Er komt geen trede en geen balk op een mens** — niet publiek, niet intern,
   niet als sorteersleutel, en ook niet als acquisitiewaarde in euro's (par. 2.1
   en 2.2).
2. **Een RTG-manager krijgt geen enkele bevoegdheid die een externe manager niet
   kan krijgen** (MN-01).
3. **De 0%-belofte over platformomzet staat los van elke managementvergoeding**,
   en wordt er nooit mee vermengd (MN-03).
4. **Delegatie blijft uitgesloten.** Een team om een mens heen bestaat uit
   meerdere machtigingen en nooit uit één machtiging die doorgeeft (par. 2.6).
5. **Een merk zoekt geen mensen.** Het beschrijft een programma; RTG toont dat
   aan wie eraan voldoet — toevoegen, nooit afstrepen — en het talent meldt zich
   aan (`CARRIERE.md` par. 4.3, `FOUNDATION.md` par. 5).
6. **Een bewijs zegt wat het niet zegt, even groot.** Een C2PA-herkomst is een
   signaal en geen eigendomsbewijs; een clubbevestiging zegt niet dat de club
   daartoe bevoegd was. Dezelfde regel als de drie herkomsten in het Career
   Ledger.
7. **Rechten over gelijkenis kennen geen stilzwijgende ja.** Wat een merk niet
   expliciet heeft gekregen, heeft het niet — en AI-training en synthetische stem
   zijn aparte vragen en nooit onderdeel van "beeldgebruik".
8. **De audiencerelatie is van de mens die volgt.** Een artiest kan zijn publiek
   bedienen; hij krijgt er geen adreslijst van, en de toestemming blijft bij de
   volger (`LIFE.md` par. 4).

---

## 7. De volgorde

| # | Onderdeel | Stand |
|---|---|---|
| 1 | Circle of Trust, simulator, jeugdbestuur, Career Ledger | **staat** |
| 2 | Het rugdekkingsscherm | **een halve dag** — par. 5.2 |
| 3 | Aanmeldweg voor een programma | **een stap weg** — par. 5.2, vorm ligt vast |
| 4 | Doelgroeppagina + `talentmens` in het aanmeldgesprek | **een stap weg** |
| 5 | MN-01 als toets (geen kantoorweg naar een machtiging) | **een stap weg**, en hij hoort vóór 12 |
| 6 | Rosterwerkblad voor een manager | **een stap weg** — het gegeven bestaat |
| 7 | Clubuitnodiging + bevestiging | **een stap weg** — het haakje bestaat |
| 8 | Machtigingsbundel (meerdere specialisten in één voorstel) | **een stap weg** |
| 9 | Youth Safe Mode: maximumduur, geen verborgen exclusiviteit, herbeoordeling op 18 | **een besluit** — klein, en het raakt de mens uit de aanleiding |
| 10 | Juridische zekerheidsindeling (vorm van `kern/fiscaal/zekerheid.js`) | **een besluit** — staat vóór 11 en 16 |
| 11 | Second Opinion op een managementcontract | **een besluit** — ná 10 |
| 12 | RTG Management als dienst | **een besluit van de eigenaar** — par. 4 |
| 13 | Rechtenboek (gebied, kanaal, looptijd, exclusiviteit, AI-gebruik) | **een besluit** — de conflictcontrole is de hele waarde |
| 14 | Gelijkenisgrendel | **een besluit** — ná 13, want hij leest eruit |
| 15 | Bewijsmap op VC 2.0 / OpenID4VCI | **een stap weg qua standaard, een besluit qua werk** — par. 9 |
| 16 | Contentherkomst (C2PA) | **een besluit** — par. 9, en met de beperking erbij |
| 17 | De derde uitbetaalweg (een mens betalen) | **een besluit, en `GIFT.md` staat ervóór** |
| 18 | Opportunity Room voor een merk | **jaren weg** — ná 13 en 10 |
| 19 | Opportunity Matching | **jaren weg**, en alleen in de omgekeerde vorm (grens 5) |
| 20 | Agentic exchange | **jaren weg** — `CARRIERE.md` par. 4.5: ná de bewijsschuld |

Regel 2 tot en met 8 kosten samen minder dan twee weken en zetten het kanaal om
van outbound naar inbound. Regel 5 staat er bewust tussen: hij is een toets en
geen functie, en hij hoort er te zijn vóór RTG zelf een belang krijgt.

---

## 8. De besluiten voor de eigenaar

### Besluit 1 — Wordt RTG zelf vertegenwoordiger?

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Ja, maar pas na MN-01 als toets** *(aanbevolen)* | De dienst komt er, en de handhaver dat RTG geen systeemvoordeel heeft, staat er eerder dan de eerste cliënt. | Een dag voor de toets; daarna een dienst met mensen erin. |
| B. Ja, nu | Sneller een eerste cliënt. | Dan bestaat het belang eerder dan de grens, en dat is de volgorde die dit huis elders vermijdt. |
| C. Nee, alleen infrastructuur | Geen belangenverstrengeling, geen uitleg nodig. | Dan is RTG voor een talent gereedschap, en het gesprek over zijn carrière voert iemand anders. |

### Besluit 2 — De managementvergoeding

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Per inkomstensoort, vooraf zichtbaar** *(aanbevolen)* | Nul waar RTG niets deed; een afgesproken percentage op deals die RTG sloot. | Vraagt een vijfde benoemde vergoeding naast de vier bestaande. |
| B. Vast maandbedrag | Simpel, voorspelbaar, en het raakt de 0%-belofte nergens. | Een beginnend talent betaalt dan voor werk dat nog niets oplevert. |
| C. Percentage over alles | Zoals de markt het doet. | **Dit is de commissieknop terug** (MN-03) en het holt de 0%-belofte uit. |

### Besluit 3 — De derde uitbetaalweg (CAR-01)

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Nu onderzoeken, met de schakelaar dicht** *(aanbevolen)* | De vergunningsvraag beantwoorden vóór het eerste talent hem stelt. | Juridisch werk, geen bouwwerk. De schakelaar bestaat al. |
| B. Later | Tot die tijd: word een zaak. | Dat is CAR-01 overtreden, en het treft juist de jongste mensen het hardst. |
| C. Niet | RTG betaalt alleen ondernemingen. | Eerlijk, en het moet dan ook zo heten in elk gesprek. |

### Besluit 4 — Het Rechtenboek

| Optie | Wat het betekent | Prijs |
|---|---|---|
| **A. Bouwen, en beginnen bij AI-gebruik** *(aanbevolen)* | Het enige onderdeel dat voor makers werkelijk onderscheidend is, en het urgentste. | Middelgroot. De conflictcontrole is het werk, niet de opslag. |
| B. Alleen registreren, geen controle | Sneller. | Een register dat geen conflict signaleert, is een spreadsheet. |
| C. Niet | — | Dan blijft het aanbod voor creators wat het is: administratie zonder bescherming. |

---

## 9. De vier standaarden, nageslagen

`CARRIERE.md` par. 3 legde vast dat twee van de vier genoemde standaarden niet
waren nagekeken en dus `vermoed` waren. Dat is op 13 september 2026 gedaan; ze
staan nu als **gemeten**, met één correctie.

| Standaard | Stand |
|---|---|
| W3C Verifiable Credentials 2.0 | Recommendation (mei 2025) — bevestigd |
| WebAuthn Level 3 | **W3C Recommendation sinds 25 augustus 2026** — bevestigd |
| OpenID4VCI 1.0 | Final; zelfcertificering via de conformance suite **sinds 26 februari 2026** — de aangedragen datum (augustus 2026) klopt niet |
| C2PA / Content Credentials | versie **2.4**, uitgebracht april 2026 — bevestigd |

**Bij C2PA hoort de beperking in dezelfde zin als de belofte:** uploads,
schermafdrukken, exports en platformbewerkingen verwijderen of breken de metadata
routinematig. Content Credentials zijn daarmee een **herkomstsignaal en geen
bewijs op zichzelf** — en dat hoort op het scherm te staan waar het lid het
leest, niet in een voetnoot. Dezelfde vorm als de drie herkomsten van het Career
Ledger, waar bij elke herkomst staat wat zij níét zegt.

---

## 10. Wat dit document NIET zegt

- Het zegt niet dat de zeventien onderdelen samen een product vormen. Dat ze op
  dezelfde mens passen, is een ontwerpvraag en geen gemeten feit — de vorm
  daarvoor is de ketenproef (`scripts/tafelproef.js`, `ritproef.js`,
  `toelatingsproef.js`), en die is voor dit onderwerp **niet gedraaid**.
- Het meet niet of de zes voorgestelde klassen mensen (performance, creative,
  creator, expertise, leadership, emerging, cultural) werkelijk iets delen. Dat
  is exact dezelfde claim als in `CARRIERE.md` par. 0, waar het antwoord over
  vijftien talentdomeinen **nul gedeelde velden** was. Bouw er geen indeling op
  voordat `npm run carrierevorm` erover heeft gelopen.
- Het zegt niets over bedragen: niet over een managementfee, niet over
  rugdekking, niet over wat een programma waard is.
- Het zegt niets over wie een programma verdient. Selectie is mensenwerk, en er
  komt geen model dat het voorstelt.
- Het beweert niet dat RTG Management een goed idee is. Het zegt wat er waar moet
  zijn voordat het er een kan worden.
