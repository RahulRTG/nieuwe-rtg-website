# FOUNDATION.md -- RTFoundation als Personal & Civic Operating System

Dit is het diepte-document van de RTFoundation als PLATFORM, naast de andere
werelden: `GELD.md` (RTG Geld), `LIFE.md` (RTG Sociaal), `CONCERN.md` (RTG
Concern). Het beschrijft wat de Foundation moet WORDEN op drie niveaus tegelijk:
voor het individu, voor de professional en voor de organisatie.

**`LEVEN.md` blijft onverkort gelden en wordt hier niet overgedaan.** Dat document
gaat over de mens zelf: de levenslijn, de talentenkaart, het kind, de dromen, de
bijdrage-spiegel. Zijn tien grenzen (par. 2) zijn ook de grenzen van dit
document; waar hier iets botst met LEVEN.md, wint LEVEN.md. Dit bestand voegt toe
wat daar niet staat: de civiele en organisatorische helft -- zaken die meerdere
instanties raken, documenten die iets van iemand vragen, processen die een
doorlooptijd hebben, en het bewijs dat dat alles eerlijk gebeurt.

Twee documenten die je vóór dit bestand moet kennen: `PLATFORM.md` (het
wereldpatroon en, belangrijker, de regel dat elke wereld haar WERKWOORD bewust
kiest en opschrijft vóór er iets gebouwd wordt) en `LAT.md` (repareer de oorzaak,
en een bewering zonder mutatietoets is geen bewering).

---

## 0. De kern, in een zin

> RTFoundation is een privacy-first Personal & Civic Operating System dat mensen
> helpt begrijpen, handelen, ontwikkelen en samenwerken -- en organisaties helpt
> dat sneller, veiliger en aantoonbaar beter te faciliteren.

De wauw komt niet uit een schermontwerp. Hij komt uit één gevoel, en dat gevoel is
de lat waaraan elk onderdeel hieronder wordt gemeten:

> *"Dit systeem begrijpt mijn situatie, beschermt me, zet dingen voor me klaar --
> en laat me altijd zien waarom."*

Let op het derde werkwoord. Het is niet "regelt". Waarom niet, staat in par. 2.

---

## 1. Dit is geen groen veld, en dat is het belangrijkste feit hier

Wie dit document leest als een bouwopdracht, bouwt drie dingen opnieuw die er al
staan. De stand op 19 augustus 2026, gemeten en niet geschat:

### 1.1 De motor staat er al -- aangesloten op de verkeerde wereld

`server/kern/levensgraaf/graaf.js` opent met de zin die dit hele document had
kunnen zijn: *"DIT IS EEN PROJECTIE, GEEN TWEEDE DATABASE."* De graaf slaat niets
op. Hij leest de domeinen en bouwt de knopen elke keer opnieuw, en voegt alleen
toe wat nergens stond: **vijf etiketten per stuk informatie.**

| etiket | wat het zegt |
|---|---|
| `bron` | uit welke app het komt, en dus wie hem verandert |
| `eigenaar` | van wie het is: het lid zelf, of iemand in zijn kring |
| `deel` | wie het mag zien -- een POORT, geen etiket: `graafVoor()` filtert erop |
| `gevoelig` | 0 open, 1 persoonlijk, 2 vertrouwelijk, 3 besloten |
| `vervalt` | de datum waarop dit ding aandacht nodig heeft |

Daarbovenop rekent `server/kern/levensgraaf/termijnen.js` de Control Tower uit,
met het venster dat in geen enkele app zat en dat er het meest toe doet:
achterstallig. En `server/kern/levenslijn/index.js` verbiedt in zijn eigen kop al
wat wij ook verbieden: geen voortgang, geen rangschikking, geen handeling.

**Wat er mis is:** die graaf leest `agendas, boekingen, cvs, leren, lifestyle,
rtgid`. De gezinsstore van de Foundation zit er niet bij. De Foundation is de
enige wereld die niet is aangesloten op de motor die voor haar geschreven is.

Dat verandert de opgave. Niet "bouw een persoonlijke laag", maar "schrijf
Foundation-bronnen voor de graaf die er staat". Een orde van grootte goedkoper,
en het is precies wat het wereldpatroon vraagt.

### 1.2 Wat er verder al staat

| wat | waar | hoe ver |
|---|---|---|
| Trust graph -- inzagelog, sessies per dienst, `namens`, herroepbare mantelzorg-machtiging | `server/kern/rtgid-regie.js` | werkend |
| Consent Center, met een DEKKINGSREGISTER dat door een toets wordt bewaakt | `server/kern/consent.js`, `test/consent-dekking.test.js` | werkend |
| Claim zonder gegeven (18-plus als attribuut, niet als geboortedatum) | `server/kern/rtgid.js` | werkend, één attribuut |
| Document → termijn, als VOORSTEL met de bronzin ernaast | `server/kern/postdatum-lezer.js` | werkend, alleen datums |
| Append-only actielog dat elke automatische handeling verantwoordt | `server/kern/geldbeleid/actielog.js` | werkend, alleen geld |
| Ingetogen lijn-iconenset in huisstijl, ter vervanging van emoji | `public/shared/glyf.js` | werkend, niet aangeroepen door de Foundation |
| Modi World/Pro/Command als dichtheidstokens | `public/shared/rtg-ontwerp.css` | werkend, 0 Foundation-schermen gebruiken het |

`postdatum-lezer.js` verdient een aparte vermelding, omdat hij de discipline die
dit document van alle extractie eist al voordoet: *"Wat hier uitkomt heet een
VOORSTEL, en een mens bevestigt het -- met de zin waar het uit komt ernaast."*
Dat is de vorm. Elke volgende extractor kopieert die vorm en verzint geen tweede.

### 1.3 En de zichtbare laag klopt niet

Gemeten op de draaiende app, ingelogd als volwassen beheerder:

- de hub toont **56 app-tegels met een leeg icoonvak** (`<div class="ic"></div>`),
  terwijl de iconenset die daarvoor gemaakt is in `public/shared/glyf.js` klaar
  staat en door de Foundation nooit wordt aangeroepen;
- op een telefoon van 390 px is de hub **736 px breed** en `vrienden.html`
  **809 px** -- de pagina schuift zijwaarts;
- drie verschillende schilen binnen één app (logo-chip, campus-zijbalk, en op
  `vrienden.html` drie onderstreepte links rechtsboven die van het scherm lopen);
- de primaire labels staan in `#C23A5E` op 10--14 px en halen **3,75:1**, terwijl
  `CLAUDE.md` voor kleine tekst op zwart 4,5 eist en wit voorschrijft;
- `.kpi b` staat in Bodoni (`public/shared/rtg-ui.css:326`), waardoor een `0` in
  een statistiektegel als `()` leest.

Dit staat hier niet om de lijst compleet te maken. Het staat hier omdat par. 3
eindigt met een motor die *Prove* heet, en "bewijs dat dit veilig werkt" is een
moeilijke belofte op een voordeur met 56 lege vakken. De zes motoren en de
zichtbare laag zijn niet dezelfde sprint, maar ze landen bij dezelfde mens.

---

## 2. Het werkwoord van deze wereld

`PLATFORM.md`: *"Wat per wereld verschilt is niet de vorm maar het WERKWOORD dat
de vierde laag mag. (...) Wie een nieuwe wereld bouwt, kiest dat werkwoord bewust
en schrijft het op voordat hij begint."*

Het werkwoord dat er nu staat is **openen**: *"RTFoundation voert niets uit en
opent alleen (LEVEN.md par. 2.2)."*

Een Personal & Civic OS met alleen dat werkwoord kan de helft van zijn belofte
niet waarmaken. Een plan dat alleen opent is een lijstje. Een aanvraag die alleen
opent is nog steeds een formulier. Een warme overdracht die alleen opent is een
telefoonnummer.

Maar het werkwoord verruimen naar **uitvoeren** haalt LEVEN.md par. 2.2 onderuit,
en dat is precies de paragraaf die dit huis beschermt tegen een platform dat de
reden wordt dat iemand een kans niet krijgt.

### Het werkwoord wordt: **openen en klaarzetten. Bevestigen doet de mens.**

Dit is geen compromis, het is de vorm die in dit huis al bewezen is. `LIFE.md`
draait op exact dit werkwoord: *"samenstellen en klaarzetten -- bevestigen doet
de mens: alles wat een tweede persoon bereikt (uitnodiging, bericht, boeking,
betaling) wordt nooit automatisch."*

Wat dat concreet betekent, in de termen van punt 19 van de opdracht:

```
LEZEN        automatisch          de graaf, de termijnen, de documentextractie
BEGRIJPEN    automatisch          de uitleg, de vertaling, de vereenvoudiging
VOORSTELLEN  automatisch          het plan, de route, de mogelijk passende regeling
KLAARZETTEN  automatisch          het formulier ingevuld, de map compleet, de
                                  overdracht geschreven -- maar NIET verzonden
UITVOEREN    nooit door RTG       indienen, delen, overdragen, betalen, wijzigen:
                                  één menselijke bevestiging, altijd
```

Er is geen `EXECUTE_LOW_RISK`. De verleiding is groot en het argument klinkt
goed -- "een adreswijziging is toch onschuldig" -- maar de grens tussen laag en
hoog risico wordt gezet door wie de functie bouwt, en die weet niet in wiens leven
hij staat. Voor de één is een adreswijziging administratie. Voor de ander is het
de dag waarop een ex-partner weet waar zij woont. Een grens die per geval anders
had gemoeten, is geen grens.

Wat de gebruiker WEL mag instellen is hoever het klaarzetten gaat: mag RTG
ongevraagd een map compleet maken, of pas als ik het vraag. Dat is de
autonomie-envelope, en hij loopt van "alleen als ik erom vraag" tot "zet alles
klaar" -- niet tot "doe het".

**Dit besluit ligt bij de eigenaar.** Wordt het toch `uitvoeren`, dan verandert
dit document niet op vijf plaatsen maar op één: hier. En dan moeten LEVEN.md par.
2.2 en PLATFORM.md (*Het wereldpatroon*) in dezelfde commit mee, want anders staan er twee
waarheden over wat deze wereld mag -- en dat is regel 4 van de lat.

---

## 3. De zes motoren

De zes motoren zijn CAPABILITIES. De vijf lagen van `PLATFORM.md` (graaf, beleid,
cockpit, Rahul, actielog) zijn ARCHITECTUUR. Ze staan loodrecht op elkaar en
mogen niet door elkaar worden gehaald: elke motor gebruikt alle vijf de lagen, en
elke laag draagt alle zes de motoren.

| motor | wat hij doet | zijn eigen valkuil |
|---|---|---|
| **Understand** | documenten, taal, context begrijpelijk maken | doen alsof begrijpen hetzelfde is als zeker weten |
| **Resolve** | een probleem van begin tot eind volgen | de zaak overnemen in plaats van hem klaarzetten |
| **Grow** | vaardigheden en kansen | van groei een wedstrijd maken |
| **Connect** | gezin, professionals, gemeenschap | van een relatie een trechter maken |
| **Protect** | identiteit, toestemming, bevoegdheid, veiligheid | bescherming die stigmatiseert |
| **Prove** | bewijs van elke belangrijke bewering | bewijs dat een belofte is en geen meting |

En de vijf lagen, hier ingevuld:

| laag | in de Foundation | de regel die hem eerlijk houdt |
|---|---|---|
| **graaf** | de levensgraaf, uitgebreid met Foundation-bronnen | leest alleen, bezit niets, telt nooit zelf op wat een domein al optelt |
| **beleid** | de autonomie-envelope + wie in mijn kring waarbij mag helpen | het systeem handelt binnen beleid, nooit naar eigen inzicht |
| **cockpit** | Calm Home voor de burger, Control Tower voor de organisatie | uitzonderingsgestuurd; rust is een uitkomst, geen leegte |
| **Rahul** | de gegronde stem: rekent met echte gegevens, noemt zijn bronnen | geen antwoord zonder herkomst |
| **actielog** | append-only geheugen van elke voorbereide en bevestigde handeling | groeit aan, wordt nooit herschreven |

---

## 4. De drie niveaus, en de drie lagen van de schil

Drie doelgroepen op één systeem, en niemand ziet de complexiteit van een ander.

| | burger | professional | organisatie |
|---|---|---|---|
| **Calm Home** | wat nu van mij is | mijn caseload vandaag | de uitzonderingen van vandaag |
| **Context Workspace** | alles rond één doel of zaak | alles rond één mens (binnen scope) | alles rond één proces |
| **Power Surface** | zoeken, mijn kring, mijn bewijs | filters, overdracht, sjablonen | automatisering, beleid, bewijs |

De drie lagen van de schil vertalen één op één naar de drie modi die al in
`public/shared/rtg-ontwerp.css` staan: Calm Home is **World**, Context Workspace
is **Pro**, Power Surface is **Command**. Er komt dus geen vierde ontwerpsysteem
bij; de Foundation gaat het bestaande gebruiken, wat zij vandaag op nul van haar
71 schermen doet.

---

## 5. DE GRENZEN. Dit deel weegt zwaarder dan par. 1--4

Waar een functie botst met een grens, vervalt de functie. Zeven grenzen komen
hieronder bij die van LEVEN.md; ze gelden allemaal voor de civiele helft.

### 5.1 LEVEN.md geldt onverkort, en wordt hier niet herhaald

De tien grenzen van LEVEN.md par. 2 staan daar en nergens anders. Ze hier
samenvatten zou een tweede formulering opleveren, en twee formuleringen van
dezelfde grens lopen uiteen. Wie aan de Foundation werkt, leest beide bestanden.

### 5.2 Klaarzetten is geen uitvoeren, en het verschil is zichtbaar

Elk klaargezet ding draagt zichtbaar dat het klaargezet is en niet gedaan. Geen
"verzonden ✓" waar "klaar om te verzenden" hoort. De vorm is die van
`postdatum-lezer.js`: het voorstel, met waar het vandaan komt, en een knop.

*Handhaving:* een toets die van elke schrijfroute in de Foundation eist dat hij
óf een bevestigingsstap draagt, óf op een expliciete uitzonderingslijst staat met
reden -- naar het model van `test/consent-dekking.test.js`.

### 5.3 Een eligibility-engine mag alleen toevoegen

LEVEN.md par. 2.2: de verzameling mogelijkheden mag VERGROOT worden en nooit
verkleind. "Mogelijk relevant voor jou" mag. "Dit is niets voor jou" nooit, en
ook niet in de zachte vorm van iets weglaten omdat het waarschijnlijk niet past.

Dus: de motor toont wat mogelijk past MET de reden erbij, en wat níét is
gecontroleerd staat er als "nog niet gecontroleerd" naast -- niet als afwijzing.
Er is geen verborgen score en er is geen drempel waaronder iets uit beeld valt.

### 5.4 Geen capaciteitscijfer op een mens

Een capaciteitsmotor die zegt "er zijn deze week 14 open taken en één persoon
draagt er 11" beschrijft de TAKEN. Een die zegt "Rahul doet 70% van het
huishouden" beoordeelt een MENS, en dat is de vergelijkende spiegel die LEVEN.md
par. 2.4 verbiedt en de score die LIFE.md par. 4.4 verbiedt.

De grens: de eenheid van meting is de taak, nooit de persoon. Een herverdeling
wordt voorgesteld op de stapel, niet op wie hem draagt.

Bij vrijwilligers en personeel ligt dit anders -- daar is bezetting een
legitiem operationeel gegeven -- maar dan loopt het via `CONCERN.md` en de rol,
niet via het gezin.

### 5.5 Bewaarde groei valt onder de 18+-grens

"Proof of Growth" is per definitie een prestatie die buiten het moment bewaard
blijft. Daarmee valt hij onder `server/kern/spellen/grens.js`: alles wat een
prestatie búiten het potje bewaart bestaat alleen voor geverifieerd volwassen
leden. Onder die grens blijft leren volledig bruikbaar -- er wordt alleen niets
van vastgelegd.

De grens hangt aan `progressieMag` en krijgt geen tweede kopie. Een leerpaspoort
dat zijn eigen leeftijdsregel meebrengt, is precies de zesde progressievorm waar
de kop van dat bestand voor waarschuwt.

### 5.6 Geen misbruikgraaf die over codenamen heen kijkt

Een graaf die `account → berichten → buddy-aanvragen → marktplaats → accounts →
device` verbindt, is functioneel een de-anonimiseringsmachine: hij voert een
codenaam terug naar een mens door genoeg zijkanten te combineren. Dat is het
ontwerp uit `CLAUDE.md` (operationele data op codenaam, echte naam in de
gescheiden kluis) omzeild via de achterdeur.

Misbruikdetectie mag, maar binnen één domein en met een mens die beslist. De
cross-domain graaf komt er niet zonder een aparte governance-ronde die
opschrijft wie hem mag bevragen, met welke reden, met welke journaalregel en met
welk bericht aan de betrokkene -- zoals de identiteitskluis dat al doet.

### 5.7 Bewijs is een meting of het bestaat niet

Proof Mode toont geen geruststelling. Hij toont een toets, een run, een hash, een
metriek en een incidenthistorie. Een bewijsscherm dat "beveiligd ✓" zegt zonder
dat er iets gemeten is, is erger dan geen bewijsscherm -- het geeft zekerheid die
er niet is, precies zoals `consent.js` dat over onvolledige overzichten zegt.

En, uit `LAT.md`: een toets die je niet hebt zien zakken is geen toets. Wat in
Proof Mode staat, staat er met de mutatie die hem laat zakken ernaast.

---

## 6. Wat er bewust NIET komt

- **Geen `EXECUTE_LOW_RISK`.** Par. 2.
- **Geen persoonlijkheidsmodel.** De planningstweeling rekent met tijd,
  verplichtingen en geld. Niet met karakter, motivatie of betrouwbaarheid.
- **Geen engagementfeed.** Kansen worden getoond op relevantie en met een reden,
  nooit op wat iemand lang laat kijken (`CLAUDE.md`).
- **Geen automatische sociale uitsluiting.** Zie 5.6.
- **Geen tweede rechtenmodel.** Toegang loopt via RTG iD en de rol. Wat
  `CONCERN.md` daarover zegt, geldt hier ook.
- **Geen tweede database.** De graaf projecteert. Zie 1.1.
- **Geen publieke marketingpagina** die dit alles uitlegt. `/` blijft de inlog.

---

## 7. De vijftig punten, per motor

Status: **staat er** (werkend, mogelijk voor een andere wereld) · **uitbreiden**
(motor bestaat, deze wereld ontbreekt) · **nieuw** · **besluit** (kan pas na par. 2).

### Understand -- documenten, taal, context

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 14 | Document Intelligence | uitbreiden (`postdatum-lezer.js` doet datums) | voorstel + bronzin + menselijke bevestiging; origineel blijft leidend |
| 15 | Conflict Detector | nieuw | nooit zelf kiezen welk document klopt -- melden en stoppen |
| 25 | Universal Communication Layer | uitbreiden (i18n staat er) | vertaling overschrijft het origineel nooit; zekerheid staat erbij |
| 26 | Live Interpreter Mode | nieuw | bij juridisch/zorg: menselijke tolk aanbevelen, techniek kent zijn grens |
| 27 | Plain Language Compiler | nieuw | een representatie vervangt het origineel niet, hij staat ernaast |
| 16 | Provenance Everywhere | staat er (de vijf etiketten) | een gegeven zonder `bron` komt de graaf niet in |
| 17 | Decision Receipt | nieuw | toont ook wat NIET is gebruikt (zorg, beschermde kenmerken) |

### Resolve -- van probleem naar oplossing

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 1 | Personal Operating Layer | uitbreiden (graaf staat er, Foundation niet aangesloten) | projectie, geen tweede database |
| 2 | Intent Engine | nieuw | een intentie opent routes, sluit er nooit een af (5.3) |
| 3 | RTG Plan | besluit | het plan wordt klaargezet, niet uitgevoerd (par. 2) |
| 4 | Scenario Engine | nieuw | vergelijking met marges, nooit een advies als waarheid |
| 5 | Dependency Graph | uitbreiden (`termijnen.js` doet datums) | "92% compleet" is een meting, geen belofte over de uitkomst |
| 6 | Life Event Engine | nieuw | één event toont gevolgen, kiest er nooit een |
| 13 | Apply Once | besluit | de mens ziet exact welke velden, en tekent per aanvraag |
| 18 | Reversibility | uitbreiden (`intrekken` bestaat breed) | onomkeerbaar = extra bevestiging, nooit stil |
| 19 | Safe Autopilot | besluit | envelope loopt tot KLAARZETTEN, niet verder (par. 2) |
| 20 | Personal SLA | nieuw | "wie is aan zet" is een feit; een termijn die RTG niet kent, verzint hij niet |
| 21 | Cross-Organization Case Graph | nieuw | de burger ziet één geheel, elke organisatie alleen haar deel |
| 22 | Warm Handoff | besluit | de overdracht wordt geschreven en getoond; verzenden doet de mens |
| 29 | Cognitive Load Engine | nieuw | stoppen kost niets en laat geen schuld achter |
| 30 | Calm Intelligence | nieuw | rust is een uitkomst, geen leegte (wereldpatroon) |
| 31 | Personal Command Center | nieuw | zoeken opent, filtert nooit stil weg |

### Grow -- vaardigheden en kansen

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 43 | Development Graph | uitbreiden (`cvs`, `leren` zijn al graafbronnen) | een ontbrekende skill is een uitnodiging, geen poort (LEVEN 2.2) |
| 44 | Skill-to-Opportunity | nieuw | tonen met reden; geen engagementfeed |
| 45 | Proof of Growth | nieuw | valt onder `progressieMag` (5.5) |
| 12 | Eligibility Engine | nieuw | mag alleen toevoegen (5.3) |

### Connect -- gezin, professionals, gemeenschap

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 23 | Human Network / Mijn kring | uitbreiden (machtiging per dienst staat er) | rechten wonen op de relatie en verlopen (LEVEN 2.8) |
| 24 | Collaborative Plans | nieuw | ieder ziet alleen zijn eigen acties |
| 8 | Capacity Engine | nieuw | meeteenheid is de taak, nooit de mens (5.4) |
| 46 | Community Intelligence | nieuw | geaggregeerd of het bestaat niet (LEVEN 2.6) |
| 47 | Resource Optimizer | nieuw | bewijs voor planning, nooit automatische toewijzing |
| 48 | Civic Simulation | nieuw | met onzekerheidsmarges, of niet tonen |

### Protect -- identiteit, toestemming, veiligheid

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 9 | Trust Graph | staat er (`rtgid-regie.js`) | scope, geldigheid en herroepbaarheid bij élke vraag opnieuw |
| 10 | Data Vaults | uitbreiden (`gevoelig`/`deel` zijn de policy) | cross-vault alleen via expliciet beleid, nooit via een default |
| 11 | Zero-knowledge claims | uitbreiden (18-plus doet het al) | een claim vervangt het gegeven, hij begeleidt het niet |
| 39 | Personal Safety Envelope | nieuw | extra bescherming zonder zichtbaar etiket op de mens |
| 40 | Abuse Graph | besluit (governance) | zie 5.6 -- niet zonder aparte ronde |
| 41 | Privacy-preserving analytics | nieuw | analytics en operationele toegang volledig gescheiden |
| 28 | Accessibility Profile | uitbreiden (`TOEGANKELIJK.md`) | één keuze werkt op alle schermen, niet per app |

### Prove -- bewijs van elke belangrijke bewering

| # | wat | status | de grens die hem eerlijk houdt |
|---|---|---|---|
| 36 | Ethical Automation Ledger | uitbreiden (`geldbeleid/actielog.js`) | append-only; wat niet gelogd kan worden, wordt niet geautomatiseerd |
| 37 | Shadow Mode | nieuw | de vergelijking wordt gepubliceerd, ook als hij tegenvalt |
| 38 | Canary per doelgroep | nieuw | automatische rollback óók op toegankelijkheidsregressie |
| 42 | Proof-of-Service | nieuw | bewijs zonder onnodige persoonsgegevens |
| 49 | Public Auditability | uitbreiden (`consent.js` heeft het dekkingsregister) | wat niet gedekt is, staat er MET reden bij |
| 50 | Proof Mode | nieuw | een meting of niets (5.7) |
| 7 | Planningstweeling | nieuw | rekent met verplichtingen, nooit met persoonlijkheid |
| 32 | Event-driven kern | nieuw | één event, controleerbare gevolgen, geen stille zijeffecten |
| 33 | Process Engine | besluit | configureerbaar tot aan de bevestiging, niet erdoorheen |
| 34 | Proces-digital-twin | nieuw | simulatie op echte historie, met marges |
| 35 | Control Tower | uitbreiden (`termijnen.js` voor het lid) | uitzonderingsgestuurd; verzint geen datum die een domein niet kent |

---

## 8. Het wereldpatroon, hier ingevuld

Zie par. 3 voor de vijf lagen. Wat deze wereld onderscheidt van RTG Geld en RTG
Sociaal:

- **RTG Geld** voert uit binnen regels en binnen het eigen tegoed; geld verlaat
  het huis nooit vanzelf.
- **RTG Sociaal** stelt samen en zet klaar; bevestigen doet de mens.
- **RTFoundation** opent en zet klaar; bevestigen doet de mens -- en uitvoeren
  richting een instantie doet de Foundation nooit zelf.

Het verschil met RTG Sociaal is de tweede helft van die zin. Daar gaat het om
wat een tweede PERSOON bereikt. Hier gaat het om wat een INSTANTIE bereikt, en
daar is de schade van een fout van een andere orde: een verkeerd verstuurde
uitnodiging is een ongemak, een verkeerd ingediende aanvraag is een besluit.

---

## 9. Faseplan

Elke fase levert iets dat werkt en toetsbaar is. Geen fase begint met een scherm.

**Fase 0 -- de voordeur klopt.** De 56 lege icoonvakken aan `glyf.js`, de
horizontale overloop op telefoon en desktop weg, één schil in plaats van drie,
contrast van de kleine labels naar wit, en `.kpi b` uit Bodoni. Geen visiewerk;
wel het verschil tussen prototype en product in de eerste vijf seconden. Toetsen:
een die zakt op overloop, een die zakt op contrast onder de eis.

**Fase 1 -- de graaf krijgt Foundation-bronnen.** Een bronbestand naar het model
van `bronnen-leven.js`, dat de gezinsstore als knopen aanbiedt met alle vijf de
etiketten, `deel` met de hand gezet op elke knoop. Daarna rekent `termijnen.js`
er vanzelf overheen. Levert punt 1, 16 en het begin van 5 en 35.

**Fase 2 -- het werkwoord vastgelegd, en de envelope erbij.** Par. 2 als besluit
in PLATFORM.md en LEVEN.md, plus de beleidslaag waarin een mens zijn eigen
autonomie-envelope zet. Deblokkeert 3, 13, 19, 22 en 33.

**Fase 3 -- Understand.** Documentextractie voorbij datums, volgens de vorm van
`postdatum-lezer.js`, met de conflictdetector er meteen naast: twee documenten
die elkaar tegenspreken leveren een melding, geen gok.

**Fase 4 -- Resolve.** Intent → plan → klaargezette map. Levenszaak over
organisaties heen, met per organisatie alleen haar deel.

**Fase 5 -- Prove.** Actielog Foundation-breed, Proof Mode op de eerste vijf
beweringen, shadow mode vóór er iets automatisch gaat.

**Fase 6 -- de organisatiekant.** Control Tower, procesmotor, proces-tweeling,
canary. Dit is de fase die het woord "enterprise" verdient, en hij komt bewust
als laatste: een besturingstoren boven een systeem dat de burger nog niet
vertrouwt, meet het verkeerde.

---

*Geschreven 19 augustus 2026. De stand in par. 1 is gemeten op de draaiende app
en niet geschat; wie dit over drie maanden leest, meet opnieuw.*
