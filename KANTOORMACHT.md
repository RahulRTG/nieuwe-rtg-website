# KANTOORMACHT.md — de bestuurlijke Control Fabric van RTG

*Richtingsdocument, 2 september 2026. Niet: een adminpagina bouwen. Wel: de
laag die bepaalt wie wat over wie mag weten, voorbereiden, uitvoeren, koppelen
en bewijzen. De vier besluiten uit §8 zijn op 2 september 2026 genomen en staan
nu als uitgangspunt in het document, niet meer als vraag.*

**Lees dit document met `CONTROLPLANE.md` ernaast, en verwar ze niet.** Dat gaat
over de economische keten (mag deze HANDELING, met welke waarde, onder welke
overeenkomst). Dit gaat over de MENS aan de knop: wie in dit kantoor wat mag,
waar zijn macht ophoudt, en hoe het huis dat kan bewijzen. Ze delen de
bevoegdheidsmotor; ze delen hun naam niet — een tweede "control plane" zonder
eigen woord is exact de `VERMOGENS`-fout uit `BEWIJSMACHINE.md`.

## 0. De grondwet

> Niemand krijgt een systeem. Iedereen krijgt precies genoeg werkelijkheid en
> precies genoeg macht om één legitieme opdracht uit te voeren. Iedere
> uitbreiding is tijdelijk, iedere zware handeling kent haar gevolg, en iedere
> beslissing laat bewijs achter.

De kortere vorm blijft bruikbaar op een scherm: *alles zichtbaar waar
noodzakelijk, alles bestuurbaar waar bevoegd, niets onbewijsbaar.* Er hoort één
zin naast, want de meting in §2 laat zien welke helft vandaag ontbreekt:

> **En niets zonder een mens erachter.** Een spoor dat eindigt bij een gedeelde
> code is geen spoor, het is een alibi.

De verandering die dit document beschrijft is geen dashboard. Het is de overgang
van *"iemand is binnen kantoor"* naar *"deze mens mag voor deze opdracht op dit
moment precies deze handeling uitvoeren."*

```
vandaag   OFFICE_CODE → office → 106 bestanden → 26 kamers → 548 routes
straks    mens → identiteit → kamer → opdracht → gezag → context → bewijs → uitvoering
```

## 1. De omkering: de super-admin is er al

Het uitgangspunt *bouw geen almachtige SUPER_ADMIN* is juist en het is een
verkeerde tijd. RTG heeft er al een, en hij heet `officeAuth`.

| | |
|---|---|
| Eén gedeelde toegangscode | `OFFICE_CODE`, één rol: `role: 'office'` |
| Bestanden die die deur gebruiken | **106** |
| Muterende routes achter `/api/office` en `/api/boardroom` | **548** |
| Kamers achter diezelfde ene deur | **26** |
| Sterkere poorten erachter | **2** — `kluispoort` (identiteitskluis) en `boardroomAuth` (100 routes) |

Zesentwintig kamers, één sleutel. **De eerste functie van KANTOORMACHT is
daarom niet macht toevoegen maar bestaande macht uit elkaar halen.** Wie
People, Companies, Money en Risk vandaag bouwt, zet zevenentwintig kamers achter
diezelfde sleutel.

## 2. Wat er onder de knop gebeurt — gemeten

De geëiste keten:

```
medewerker → reden → bevoegdheid → impact → bevestiging → tweede paar ogen
           → uitvoering → onveranderbaar auditbewijs
```

Over de **548** muterende kantoorroutes, lexicaal gemeten:

| Schakel | Routes | Bewijsgraad |
|---|---|---|
| medewerker (een IDENTITEIT, geen gedeelde code) | onbekend — `lidKey` is optioneel op de sessie | ongemeten |
| reden verplicht | **37** van 548 | vermoed |
| bevoegdheid fijner dan "kantoor" | **2** poorten | gemeten |
| impactberekening vooraf | 0 | vermoed |
| bevestiging met gewicht | 0 | vermoed |
| tweede paar ogen | **0** | vermoed |
| auditspoor | **99** van 548 | vermoed |
| reden **én** spoor samen | **10** van 548 | vermoed |

Tien van de 548, en met opzet geen percentage met een groen randje: het is
**lexicaal** gemeten (grep op de handlertekst) en draagt daarom de graad
`vermoed`. Blok 0 vervangt ze door gemeten getallen.

## 3. Wat er al staat — de gereedschapskist hangt niet aan de deur

Dit is de kern van waarom dit haalbaar is: bijna elk futuristisch onderdeel
hieronder bestaat al, alleen niet aan de kantoordeur. Er hoeven geen twintig
securitysystemen naast RTG te komen.

| Onderdeel | Waar het al woont | Stand |
|---|---|---|
| onveranderbaar bewijs | `lib/keten.js` + `lib/keten-anker.js` — hashketen mét extern anker tégen kopafknipping | **staat** |
| wie keek in de kluis, en waarom | `server/inzagelog.js` — een lege "waarom" is daar al een fout | **staat** |
| **execution plan** | `kern/commercie/voornemen.js` + `/plan`, `/keuring`, `/uitvoeren` | **staat** — zie §9 |
| **machtskaart** | `kern/commercie/rechten.js` — nominaal náást effectief | **staat** — zie §11 |
| **causale keten** | `kern/envelop.js` — `correlatie` én `oorzaak` op elk bericht | **half** — zie §19 |
| **digitale tweeling** | `kern/command/simulatie.js` — heet zo, met de aannames in de uitslag | **staat** — zie §8 |
| tweede goedkeurder op de mens | `kern/appstore/vierogen.js` — sleutel én naam, mét de graad van de scheiding | **staat**, alleen voor appkeuring |
| bevoegdheid in vier dimensies, delegatie versmalt | `kern/commercie/bevoegdheid.js` | **staat**, geen route delegeert |
| acht besluituitkomsten, `ONBEKEND` ≠ `WEIGEREN` | `kern/commercie/besluit.js` | **staat** |
| een nieuwe regel eerst in de schaduw | `kern/commercie/schaduw.js` | **staat** |
| canary met automatische terugrol | `kern/command/canary.js` | **staat** — zie §16 |
| noodstanden (vijf, en het is geen ladder) | `kern/incidentcontrole.js` + `kern/beschermstand.js` | **staat** |
| zandbak uit de zaaiset, nooit uit productie | `kern/command/zandbak.js` | **staat** |
| gevolgmeting per handeling | `kern/stuur/gevolg.js` — 3 graden, 96 van 176 `onbekend` | **half** |
| één zoekbalk over alle domeinen | `kern/command/zoek.js` + `register.js` | **staat**, ops-gericht |
| plancompiler en resolver voor AI | `kern/stuur/plan.js`, `kern/stuur/resolver.js` | **staat**, 0 kantoorpaden |
| risico, fraude, clusters, velocity | — | **niets** |
| historische toestand van een entiteit | — | **niets** — zie §18 |
| gegevensklasse per VELD | — | **niets** — zie §22 |

Drie regels ontbreken werkelijk: Risk, tijdreizen en de gegevensklasse. De rest
is aansluiten.

## 4. De schaduwstand, en de ladder gaat andersom

Besluit 1 is genomen: **schaduw-eerst**. `officeAuth` wordt niet verwijderd —
dat zou juist gevaarlijk zijn. Er komt een beslislaag vóór:

```
officeAuth → Kantoormacht → kamer → opdracht → gezag → context → uitvoering
```

In fase één beslist Kantoormacht niets. Hij berekent per kantoorhandeling wie
handelt, uit welke kamer, op welk object, welke gegevens nodig zijn, welke
gezagstrede vereist zou zijn, of een reden nodig zou zijn, of vier ogen nodig
zouden zijn, en welke bewijsroute gebruikt zou worden — en `officeAuth` blijft
beslissend. Model: `kern/commercie/schaduw.js`, dat precies dit al doet aan de
leverancierspoort.

**De volgorde van afdwingen gaat om.** De voorgestelde ladder was:

```
SHADOW → WARN → ENFORCE_READ → ENFORCE_PREPARE → ENFORCE_EXECUTE
```

Die zet de breedste blast radius vooraan voor de kleinste risicoreductie. Lezen
raakt élk kantoorscherm; een onbevoegde LEZING is bovendien het minst
schadelijke van de drie, en de gevaarlijkste lezing — de identiteitskluis — is
al apart afgedwongen door `kluispoort.js`. Een onbevoegde UITVOERING is het
duurst en raakt 548 routes in plaats van alles. Dus:

```
SHADOW → WARN → ENFORCE_EXECUTE → ENFORCE_PREPARE → ENFORCE_READ
```

Eerst dichtzetten wat pijn doet, dan wat hindert. Het kantoor blijft werken
terwijl de macht vernauwt, en dat is precies wat een migratie over 4.700
schrijfroutes nodig heeft om niet als storing te eindigen.

## 5. De kamers zijn geen machtsdomeinen — nog niet

Besluit 2 is genomen: de 26 kamers worden de primaire bevoegdheidseenheid, geen
22e capabilitywoordenlijst. Dat is de goede keuze. **Er zit één correctie in, en
die komt uit de meting.**

De kamers zijn ontworpen als WERKKAMERS, niet als machtsdomeinen. Uitgelezen uit
`kern/afdelingen/register.js` en `register2/`:

| Soort | Kamers | Bruikbaar als bevoegdheidsdomein |
|---|---|---|
| **Bestuurlijk** (18) | sales, marketing, pr, hr, financien, inkoop, verkoop, juridisch, creatief, intern, onderzoek, klantenservice, support, ingenieurs, integraties, controleregister, consumentenAbo, partnerAbo | **ja** |
| **Sociaal** (1) | kantine | **nee** — een menu en een chat; geen macht om te dragen |
| **Product-/domeinkamer** (7) | atelier, studio, hardware, architect, reisbureau, regering, opvang | **nee** — dat zijn werelden van het platform, geen afdelingen van RTG |

En vier kamers die het machtsmodel nodig heeft, bestaan niet:

| Ontbrekende kamer | Bestaat de FUNCTIE al? | Waar |
|---|---|---|
| VEILIGHEID | ja | `routes/office/veiligheid.js`, `securityLog`, `beveiliging/` |
| OPERATIES | ja | `kern/command/` — 107 routes |
| BESTUUR | ja, maar als POORT | `boardroomAuth` — een deur, geen kamer |
| RISICO | **nee** | — |

Dus: **drie van de vier ontbrekende kamers zijn geen nieuwe macht maar bestaande
macht zonder kamerdeur**, en dat is precies het probleem van §1 in het klein.
Concreet werk:

1. Het kamerregister krijgt `bestuurlijk: true|false`. Een kamer die geen
   bevoegdheidsdomein is, kan er geen dragen — en dat staat er dan, in plaats
   dat iemand het over een half jaar opnieuw moet uitzoeken.
2. Er komen vier bestuurlijke kamers bij: VEILIGHEID, OPERATIES, BESTUUR,
   RISICO. De eerste drie WIKKELEN bestaande routes; alleen RISICO is leeg.
3. `BESTUUR` als kamer maakt `boardroomAuth` niet overbodig. De boardroom eist
   een IDENTITEIT waar de kantoordeur een anonieme code toelaat; dat verschil is
   de reden dat hij geen vlag op `officeAuth` is, en het blijft staan.

Binnen een kamer geldt de bestaande viertrapschaal, ongewijzigd:

```
0 geen   1 tonen   2 klaarzetten   3 uitvoeren
```

Aanwezigheid in een kamer geeft dus nog geen uitvoeringsmacht. Er komt geen
parallelle RBAC-wereld: KANTOORMACHT consumeert de gezagstaal die er al is
(`GEZAGSNOEMER.json`, 18 evident, 3 besloten, 0 open).

## 6. Macht wordt opdrachtgebonden

Zelfs FINANCIËN + `uitvoeren` geeft niet permanent alle financiële uitvoering.
Per opdracht wordt een tijdelijke **machtsenvelop** berekend:

```
mens × kamer × opdracht × object × handeling × tijd
```

Bijvoorbeeld, voor *"corrigeer de dubbele afschrijving van betaling P-81931"*:

```
kamer         FINANCIËN
toegestaan    betaling P-81931 tonen; gekoppelde grootboekregels tonen;
              klantcodenaam tonen; correctie klaarzetten; correctie uitvoeren
niet          andere betalingen wijzigen; volledige identiteit openen;
              andere bedrijven bekijken; chats bekijken; uitbetaling wijzigen
geldig        12 minuten
```

Dit is geen nieuw mechanisme. `kern/commercie/bevoegdheid.js` kent de vier
dimensies al (WAT / WAAR / HOEVEEL / WANNEER) en delegatie versmalt daar
**structureel** — per grens de engste van beide kanten, niet als vuistregel.
De envelop is een delegatie met een klok erop.

**De valkuil, en hij is gemeten in dit huis.** `EXECUTIE.md` §7 (blok 0) leerde
dat de gevaarlijkste faalvorm van een versmallingslaag niet is dat hij te veel
toelaat, maar dat hij het GEVRAAGDE vermogen verbergt: de resolver versmalde ooit
op een gelijke score en liet /api/bank/pas/betaal op alfabet afvallen. Op het
kantoor is het gevolg erger dan een gemist zoekresultaat — een medewerker
concludeert dan dat een macht niet bestaat. Daarom:

> Een envelop die het gevraagde vermogen niet bevat, zegt dat hardop en noemt de
> weg ernaartoe. Hij verdwijnt nooit stil uit de lijst.

Het succescriterium is dus **dekking**, niet compactheid — precies zoals bij
`npm run resolverbereik`. Liever veertien relevante bevoegdheden dan drie
waarvan de juiste ontbreekt.

## 7. Twee werkelijkheden

De operationele werkelijkheid (`C-73812`, `B-1904`, `D-8201`, `P-72918`,
`Z-441`) draagt bijna al het kantoorwerk. De identiteitswerkelijkheid (naam,
adres, telefoon, bank, documenten) ligt achter een afzonderlijke poort die al
bestaat: `kluispoort.js` + `inzagelog.js`.

Een medewerker kan dus zien dat `C-73812` drie mislukte betalingen en één open
supportzaak heeft, zonder te weten wie dat is. **Een naam openen wordt zelf een
bestuurlijke handeling** — `OPEN_IDENTITEIT`, met reden, bevoegdheid,
journaalregel en boven een grens een tweede paar ogen.

Dat is geen nieuwe voorziening maar het STRENGER maken van een bestaande: het
inzagejournaal eist de reden al, en bewaart de opgevraagde naam met opzet níét
(anders is het auditlog zelf een tweede, onversleutelde kluis).

## 8. Het klantbeeld wordt samengesteld, niet opgeslagen

Er komt geen `universal_customer_profile` in de database. Het scherm wordt
just-in-time samengesteld: eerst wordt *"wat mag deze medewerker voor deze
opdracht over C-73812 zien"* opgelost, daarna leveren alleen de toegestane
bronnen hun fragment.

```
Identiteit   GESLOTEN        Devices   BEPERKT
Bedrijven    TONEN           Chats     GESLOTEN
Betalingen   TONEN           Risk      SAMENVATTING
Support      TONEN           Audit     EIGEN HANDELINGEN
```

Twee medewerkers die naar dezelfde klant kijken, hoeven niet hetzelfde scherm te
zien. Drie eisen gaan vóór het scherm uit:

1. Het beeld bouwt op de codenaam. Het beeld openen is niet hetzelfde als de
   kluis openen.
2. Een gesloten blok verdwijnt niet — het staat er als GESLOTEN. Zelfde regel
   als de intentielijst in `LINK.md` §3 en als §6 hierboven.
3. `scripts/afleidbaar.js` draait erop vóór livegang. Zes velden staan vandaag
   rechtstreeks naast een codenaam; dit scherm zet er geen zevende bij.

Dat maakt het klantbeeld technisch universeel en organisatorisch niet — en dat
verschil is de hele oplossing van de spanning waar dit blok in zat.

## 9. Zware acties worden plannen — en dat mechanisme bestaat

Voor gevoelige handelingen komt er geen knop maar een plan dat twee mensen
ONDERTEKENEN, in plaats van twee knoppen die zij toevallig na elkaar indrukken.

**Dat bouwen we niet: `kern/commercie/voornemen.js` is het al**, met vijf regels
die precies hier voor gemaakt zijn:

1. De keuring gaat over het **totaal**, niet over de duurste stap.
2. Een goedgekeurd plan **kan niet meer veranderen** — de vingerafdruk wordt bij
   elke uitvoering opnieuw gerekend. Zonder dat keur je 900 goed en voert iemand
   9000 uit.
3. Elke stap **levert zijn bewijs in** (`bewijstoken.js`); geen stap draait op
   "de keuring stond hierboven toch".
4. Een stap gebeurt **hoogstens één keer** — de economische sleutel loopt door
   naar elke stap.
5. **Een nee wordt geen ja door het nog eens te vragen.** Er is geen overgang van
   AFGEWEZEN naar GEKEURD; wie het anders wil, stelt een nieuw voornemen op.

Wat er ontbreekt is klein en scherp: het voornemen kent vandaag geen
handtekeningen van meerdere kamers. `vierogen.js` levert die vergelijking al
(sleutel hard, naam zwak, mét de graad van de scheiding). Die twee koppelen is
het werk — niet een executie-engine bouwen.

Eén bestaande grens blijft staan en beperkt wat een plan mag zijn: het voornemen
**bedenkt zelf geen stappen**. Wie dat verandert, maakt van de controlelaag een
tweede opdrachtgever.

## 10. Impact vóór bevestiging — de tweeling heet al zo

`kern/command/simulatie.js` is de digitale tweeling en draagt die naam letterlijk.
Hij doet al twee dingen: een wat-als op werkelijke aantallen, en een beleidsregel
door de simulatie halen vóórdat hij gezet wordt. Zijn belangrijkste eigenschap
gaat hier onverkort mee: **de aannames staan in de uitslag, altijd** — een
simulatie zonder zichtbare aannames is een mening met cijfers eromheen.

Daarnaast meet `kern/stuur/gevolg.js` welke collecties een handeling aanraakt, in
drie graden. De middelste twee mogen nooit door elkaar lopen op een
bevestigingsscherm:

- `gemeten` — dit raakt 4 collecties en 1.281 leden
- `geen-effect-gemeten` — er is gekeken, er gebeurt niets
- `onbekend` — **er is niet gekeken** (vandaag: 96 van 176 paden)

Een blokkade van onderneming B-819 die "raakt niets aan" toont terwijl niemand
keek, is een geruststelling zonder grond.

## 11. De machtskaart bestaat, en blijft lezend

*"Waarom kan Rahul dit?"* moet mechanisch te beantwoorden zijn, niet door
documentatie te lezen. `kern/commercie/rechten.js` doet dat al voor zaken, en het
interessantste dat hij toont is precies wat het kantoor nodig heeft:

```
NOMINAAL    wat het profiel zegt
EFFECTIEF   wat er vandaag werkelijk gebeurt
```

Die twee lopen uiteen zodra een regel in de SCHADUW staat — en tijdens fase één
van §4 staat de HELE kantoormacht in de schaduw. Zonder dat onderscheid ziet een
kamerhoofd zes maanden lang een macht die niet wordt afgedwongen, of andersom.

De kaart krijgt de standen erbij: PERMANENT, TIJDELIJK, GEDELEGEERD, NOODMACHT,
VERVALLEN. En één eigenschap blijft: **hij is uitsluitend lezend**. Een bord dat
ook knoppen heeft, wordt gebruikt om te sturen, en dan is er een zevende plek
waar rechten vandaan komen in plaats van één die ze samenvat.

## 12. Macht krijgt een budget

Impact wordt zelf onderdeel van bevoegdheid. Financieel bestaat dit al —
`bevoegdheid.js` kent `maxCenten` en `maxPerDagCenten`:

```
refund  ≤ €500       zelfstandig
        €500–5.000   tweede paar ogen
        > €5.000     Finance Lead
        > €50.000    Boardroom
```

Niet-financieel is nieuw, en het is de betere helft:

```
0–20 accounts        operationeel
20–1.000 accounts    incidentgoedkeuring
> 1.000 accounts     platformbesluit
```

Dit hangt aan §10: een drempel op aantal geraakte accounts kan alleen werken als
de gevolgmeting `gemeten` is. Bij `onbekend` valt hij terug op de STRENGSTE trede
en zegt waarom — nooit op de laagste omdat er geen getal was.

## 13. Break glass wordt noodmacht

Geen vijfde gezagstrede. Dit huis heeft er vier en die zijn er gekomen nadat er
**vijf** gezagsvocabulaires langs elkaar bleken te leven; `autonoom` en
`begrensd` bleven om dezelfde reden eigenschappen. Noodmacht is dus `uitvoeren`
plus verplichtingen, niet erboven:

```
uitvoeren + sterke herauthenticatie + reden met zaaknummer + tijdelijk token
          + volledige auditcontext + directe melding + automatische vervaldatum
          + review binnen 24 uur, als taak met een eigenaar
```

De hashketen en de externe verankering worden hiervoor rechtstreeks gebruikt: een
noodhandeling kan niet stil verdwijnen, ook niet door de kop van het journaal af
te knippen — daar is `lib/keten-anker.js` voor.

`test/gezagsnoemer.test.js` bestaat om een vijfde vocabulaire tegen te houden en
hoort dit ook tegen te houden.

## 14. Risk: een bewijsmodel, geen scoremachine

Besluit 3 is genomen: de clustergraaf mag, **pseudoniem**. De graaf kent
`codenaam ↔ device ↔ IP ↔ betaalmiddel ↔ bedrijf` en ontsluit nooit vanzelf
`codenaam → echte identiteit`. Dat wordt een eigen handeling,
`DEANONIMISEER_CLUSTER`, met de zware poort erop.

Vanaf nul beginnen is hier een kans. Niet `riskScore = 87`, maar:

```
SIGNAAL       7 accounts gebruiken hetzelfde device
BRON          sessieregister, 12 aug – 2 sep
STERKTE       0,81
TEGENBEWIJS   device is mogelijk een gedeeld POS-station
VERVALT       30 dagen
BESLUIT       geen automatische blokkade
ACTIE         menselijke beoordeling
```

Dat is dezelfde vorm als de bewijsgraden van `BESTUUR.md`, en het is sterker dan
een black-box score. Drie grenzen:

1. **Een score op een mens draagt altijd zijn opbouw.** Een cijfer zonder opbouw
   is een orakel. Nooit als los getal, nooit als sorteersleutel — ook niet
   intern. Die regel staat al in `ONTMOETEN.md`, `LIFE.md` en `HORECA.md`.
2. **Vervallen bewijs is geen bewijs.** Een signaal zonder vervaldatum wordt een
   permanent stempel op een mens.
3. **Tegenbewijs is een verplicht veld, geen nette gewoonte.** Een signaal dat er
   geen kan hebben, is een conclusie die zich als signaal voordoet.

Splitsing van het werk: **8a (een stap weg)** — velocity en tellers, op de
bestaande meters (`kern/kosten/meterstand.js`, grootboektellers). **8b (jaren
weg)** — de enclave zelf.

## 15. Insider Risk — en de datasource bestaat al

KANTOORMACHT bewaakt ook wie KANTOORMACHT gebruikt: ongewoon veel klantinzages,
grote exports, steeds dezelfde persoon opzoeken, financiële handelingen buiten
patroon, herhaald break-glass, bevoegdheid gebruiken vlak voor vertrek.

Dit is dichterbij dan het klinkt: `inzagelog.lijst({ doorId })` bestaat al, en
dat is precies de as waarop deze signalen liggen. Het is optellen over een
bestaand journaal, geen nieuwe verzameling.

En §14 geldt hier onverkort, met één toevoeging die zwaarder weegt omdat het over
eigen mensen gaat: **geen automatische beschuldiging, geen ranglijst op
medewerkers.** Signaal, tegenbewijs, menselijke beoordeling — dezelfde vorm als
voor klanten, en er komt geen tweede kluis om dit in te bewaren.

## 16. Canary voor kantoorbeleid — met één maat die niet past

`kern/command/canary.js` kan een nieuwe kantoorregel geleidelijk invoeren, met
vergelijking op false block, false allow, extra handelingen, wachttijd,
afgebroken taken en veiligheidseffect. KANTOORMACHT wordt daarmee zelf
uitrolbaar.

**Eén ding klopt niet, en het volgt rechtstreeks uit besluit 4.** De
canaryverdeling is deterministisch **op de persoon**. Bij drie medewerkers is
"5% van de office-handelingen" nul mensen, en bij dertig is het er één. Een
percentage is hier de verkeerde maat. Voor kantoorbeleid gaat de uitrol daarom
per **kamer**, niet per percentage:

```
Finance → Finance + Support → alle bestuurlijke kamers
```

De meting komt uit `server/meting.js` en niet uit een eigen teller — een canary
die zelf telt, kan een ander verhaal vertellen dan het foutbudget.

## 17. Policy Replay — het corpus bestaat niet, en het is zelf een risico

*"Wat zou deze nieuwe regel de afgelopen 90 dagen hebben gedaan?"* is de juiste
vraag en hij kan vandaag niet worden beantwoord. Twee redenen, en de tweede is
belangrijker dan de eerste:

1. **Er is geen corpus.** 99 van 548 routes laten een spoor na, en die sporen
   leggen de UITKOMST vast, niet de invoer waarop besloten werd. Replay is dus
   gegrendeld achter blok 2, en het eerste eerlijke antwoord is *"over de eerste
   negentig dagen na blok 2, niet eerder"*.
2. **Een replay-corpus is een schaduwkopie van alles wat het kantoor deed** —
   inclusief kluisinzages. Wie hem aanlegt om beleid te toetsen, legt precies de
   verzameling aan waartegen §7 het hele codenaam-ontwerp beschermt.

De uitweg is niet minder replay maar een ander corpus: bewaar de
BESLISSINGSCONTEXT (kamer, gezagstrede, objectsoort, bedragklasse, gevolggraad)
en niet het verzoek. Dat is genoeg om een regel te herrekenen en te weinig om een
mens mee te reconstrueren. En de zandbak leent zich er niet voor: die draait uit
de zaaiset en **nooit** uit productie, met dezelfde reden — anders is de zandbak
zelf het datalek.

## 18. Tijdreizen — eerlijk: dit bestaat niet

*"Toon B-882 zoals kantoor hem zag op 12 augustus om 14:31"* vraagt historische
toestand, en die is er niet. Er is geen versiegeschiedenis van entiteiten;
`db.data` draagt de huidige stand. Reconstructie uit de auditsporen kan alleen wat
die sporen bevatten, en dat is 99 van 548 routes.

Het botst bovendien met een belofte die dit huis al heeft gedaan: bewaartermijnen
en het recht op vergeten (`bestanden-vergeten.js`, `bewaarverzoek`). Een
tijdmachine over alle entiteiten is een bewaartermijn van oneindig, met een
mooiere naam.

Daarom: **jaren weg, en pas na een besluit over reikwijdte.** Een haalbare kleinere
vorm die de meeste onderzoeken dekt: reconstrueer de toestand van de OBJECTEN die
in een zaak of incident genoemd zijn, over de looptijd van die zaak, en laat de
rest los. Dat is een onderzoeksdossier, geen tijdmachine.

## 19. Causale audit — de ruggengraat ligt er

Niet *"X wijzigde Y"* maar de keten:

```
incident I-829 → risk-signaal RS-91 → case C-128 → medewerker M-18 opent case
→ identiteitsinzage I-882 → execution plan EP-129 → goedkeuring A-91 + A-92
→ payout HOLD → klantmelding N-72 → review R-11
```

`kern/envelop.js` draagt dit al: elk bericht op de bus krijgt acht velden,
waaronder **`correlatie`** en **`oorzaak`**, en de keten loopt vanzelf door zodat
een gevolg weet waardoor het ontstond. Dat is de ruggengraat; wat ontbreekt is
dat de kantoorhandelingen erop worden geregen.

Drie grenzen van de envelop gelden onverkort mee, en ze passen hier precies:
de actor is een **codenaam** (de envelop weigert wat op een contactgegeven lijkt),
**`onbekend` is geen `openbaar`** en een gevolg erft de classificatie niet, en
**de levering gaat voor** — een geweigerde actor houdt een melding nooit tegen,
maar verdwijnt ook nooit stil.

## 20. Mission Control kijkt ook naar kantoor zelf

De voordeur toont niet alleen de business maar de toestand van RTG, in vier
blokken. Het vierde is het blok dat een gewone adminomgeving nooit heeft:

```
NU              mensen · bedrijven · geld · platform · veiligheid · risk · incidenten
AFWIJKINGEN     ↑ payouts +18% · 12 nieuwe risk-clusters · 2 functies degraded
AANDACHT        7 besluiten wachten · 3 vier-ogen · 2 noodhandelingen wachten op review
MACHT           4 tijdelijke bevoegdheden actief · 1 break-glass token actief
                3 delegaties verlopen vandaag · 0 onverklaarde kantoorhandelingen
```

Eén regel over de vorm: **geen samengesteld "control health"-cijfer.** Zes assen,
zes getallen. `scripts/zekerheid.js` bestaat juist omdat losse eerlijke getallen
samen een gevaarlijk gevoel geven, en `BEWIJSMACHINE.md` verbiedt het enkele
`READY` boven een scorecard.

## 21. Separation of knowledge — het ontbrekende stuk

Naast scheiding van taken: scheiding van kennis. Finance mag weten dat betaling
P-92 bij een geverifieerde natuurlijke persoon C-19 hoort, zonder naam, adres of
chat. Risk mag weten dat C-19 een device deelt met C-72. Support mag weten dat
C-19 Premium heeft en dat P-92 faalde. Niemand krijgt automatisch het hele
mensbeeld.

**Hiervoor ontbreekt een begrip dat nog niet bestaat: een gegevensklasse per
VELD.** `kern/envelop.js` classificeert BERICHTEN (`openbaar` … `onbekend`) en
dat is iets anders. Zonder veldklasse wordt §8 een lijst met de hand
onderhouden blokken, en die loopt binnen een jaar uit de code.

Twee dingen die de klasse van dag één moet dragen, allebei geleend van bestaande
regels: `onbekend` is **geen** `openbaar` (een veld dat niemand indeelde valt naar
de strengste klasse en zegt dat het niet is ingedeeld), en de klasse hangt aan het
VELD en niet aan het scherm — anders is er een tweede plek waar gevoeligheid
vandaan komt.

## 22. Het systeem verklaart zichzelf

Iedere weigering krijgt een mechanische verklaring:

```
ACTIE GEWEIGERD
je hebt        FINANCE / klaarzetten
dit vraagt     FINANCE / uitvoeren
waarom         de correctie verandert het financiële grootboek
volgende stap  execution plan klaarzetten voor een bevoegde uitvoerder
```

Ook dit is een bestaande huisregel en geen nieuwe: `kern/economie/firewall.js`
weigert al standaard en **zegt altijd hoe het wel kan**. En `besluit.js` heeft acht
uitkomsten waarvan "nee" er één is — `ONBEKEND` is met opzet geen synoniem van
`WEIGEREN`, want een storing hoort niet te klinken als een overtreding. Dat
onderscheid moet op het scherm overleven; het is precies wat een medewerker onder
druk verkeerd leest.

Dezelfde verklaring geldt voor de AI. Macht wordt daarmee begrijpelijk zonder
zwakker te worden.

## 23. De AI: 9a leest, 9b stelt voor

`kern/stuur/beleid.js` kent vandaag **0** `/api/office`-paden en
`VERTROUWEN.json` staat op **0 bewezen**. De bewijspoort waar het idee op leunt
houdt dus niets tegen. Daarom in twee stappen.

**9a — bevragen.** De vijf voorbeeldvragen (*waarom is C-819 geblokkeerd, wie
wijzigde gisteren payoutinstellingen*) zijn allemaal LEESvragen, en `tonen` is de
laagste gezagstrede. De AI krijgt niet de rechten van `office` maar de doorsnede:

```
medewerker ∩ kamer ∩ opdracht ∩ resolver ∩ gegevensklasse
```

De AI kan daardoor mínder zien dan de medewerker, nooit meer. Dat is
structureel dezelfde vorm als het mandaat in `kern/stuur/mandaat.js`: een
doorsnede kan niets toevoegen, en **leeg is dicht**.

Wel meebrengen: de dekkingsmeter. `npm run resolverbereik` bestaat omdat
versmalling die een gevraagd vermogen verbergt de gevaarlijkste faalvorm is. Voor
kantoorpaden geldt dat sterker, niet zwakker.

**9b — voorstellen.** De AI voert niets uit; hij stelt een execution plan voor dat
een mens autoriseert. Dat is §9 met een andere opsteller, en `voornemen.js` weigert
al dat een laag zowel het plan bedenkt als bepaalt of het mag.

**De tegenstander (Planner → Critic → Policy Engine → mens) heeft één eis om geen
theater te zijn:** de Critic moet een ANDERE INVOER hebben dan de Planner. Twee
keer hetzelfde model op dezelfde context levert twee keer hetzelfde antwoord met
andere woorden, en dan is de tegenspraak een stempel. De Critic ziet het plan en
het beleid — niet de redenering die tot het plan leidde. Zonder die scheiding is
dit een tweede handtekening van dezelfde hand, en dat is exact wat
`vierogen.js` bestaat om te voorkomen.

## 24. Strengheid groeit mee, semantiek niet

Besluit 4 is genomen: teamgrootte is geen architectuurbesluit. Het model staat
vanaf het begin; wat meegroeit is hoeveel ervan wordt afgedwongen.

| Bij | Afgedwongen |
|---|---|
| 3 | kamers, audit, redenen, schaduwbeleid, execution plans voor de zwaarste acties |
| 10 | + delegatie, tijdelijke macht, vier ogen, authority budgets |
| 30 | + volledige scheiding van taken, insider risk, JIT-autorisatie, automatische vervaldatum, policy replay |

Niet *"we bouwen enterprise controls zodra we enterprise zijn"*, maar *"het model
staat, de ceremonie groeit mee"*. Let wel op §16: sommige mechanismen (canary op
percentage) zijn bij drie mensen niet streng maar zinloos, en dat is iets anders
dan uitgeschakeld.

## 25. De architectuur

```
                        RTG KANTOOR
                             │
                   ┌─────────▼─────────┐
                   │  MISSION CONTROL  │
                   └─────────┬─────────┘
                   ┌─────────▼─────────┐
                   │   KANTOORMACHT    │  control fabric
                   └─────────┬─────────┘
          ┌──────────────────┼──────────────────┐
      IDENTITEIT           GEZAG             CONTEXT
      medewerker         vier treden         opdracht
      codenaam           delegatie           object
      identiteit         noodmacht           tijd
          └──────────────────┼──────────────────┘
                   ┌─────────▼─────────┐
                   │   POLICY ENGINE   │  besluit.js · bevoegdheid.js
                   └─────────┬─────────┘
                  tonen · klaarzetten · uitvoeren
                   ┌─────────▼─────────┐
                   │ EXECUTION ENGINE  │  voornemen.js
                   └─────────┬─────────┘
            impact · vier ogen · canary op beleid
                   ┌─────────▼─────────┐
                   │ BEWIJS & HASHKETEN│  keten.js · keten-anker.js · envelop.js
                   └───────────────────┘
```

People, Companies, Money, Risk, Support, Trust, Security, Operations, Platform,
Incidents, Audit en Intelligence zijn geen losse adminmodules. Het zijn
gezichtspunten op dezelfde bestuurlijke onderlaag.

## 26. De volgorde

| Blok | Wat | Stand |
|---|---|---|
| **0** | de meter: `scripts/kantoormacht.js` → `KANTOORMACHT.json` | eerst, altijd |
| **1** | de mens achter de deur — schaduw, dan `ENFORCE_EXECUTE` | §4 |
| **2** | reden en spoor als één poort; geen achtste auditcollectie | §2 |
| **3** | kamers bestuurlijk maken; vier kamers erbij; enveloppen | §5, §6 |
| **4** | impact vóór bevestiging — `simulatie.js` + `gevolg.js` aan de poort | §10 |
| **5** | execution plan met kamerhandtekeningen — `voornemen.js` × `vierogen.js` | §9 |
| **6** | noodmacht als eigenschap | §13 |
| **7** | het samengestelde klantbeeld | §7, §8 |
| **8a** | Risk: velocity op bestaande tellers | §14 |
| **8b** | Risk: de pseudonieme enclave | §14 |
| **9a** | AI leest | §23 |
| **9b** | AI stelt plannen voor, met een Critic op andere invoer | §23 |

Wat opzettelijk NA blok 2 staat en er niet vóór kan: policy replay (§17) heeft
het corpus van blok 2 nodig, en authority budgets op accountaantallen (§12) hebben
de gevolgmeting van blok 4 nodig.

Blok 0 mag geen samengesteld cijfer worden. Zes assen, zes getallen, en
`ongemeten` is een eigen uitslag naast ja en nee — nooit een nul. `npm run
getallen` neemt hem op, zodat de getallen in dit document verouderen met een
gezakte toets in plaats van in stilte.

## 27. De grenzen

1. **Geen tweede rechtenmodel.** Bevoegdheid komt uit `commercie/bevoegdheid.js`;
   delegatie versmalt structureel.
2. **Geen vijfde gezagsschaal.** Noodmacht is een eigenschap van `uitvoeren`.
3. **Een gedeelde code is geen mens.** Lezen mag anoniem; schrijven niet.
4. **Een lege reden is een fout, geen detail.**
5. **Het auditlog draagt nooit een naam uit de kluis.**
6. **Een correctie is een nieuwe mutatie**, nooit een overschrijving.
7. **Risk ziet geen namen.** De enclave is pseudoniem; deanonimiseren is een
   eigen handeling met een eigen poort.
8. **Geen score op een mens zonder opbouw**, en nooit als sorteersleutel — niet
   op klanten en niet op medewerkers.
9. **Een versmalling die het gevraagde vermogen verbergt, is een gebrek**, geen
   veiligheid. Dekking gaat vóór compactheid.
10. **De AI kan nooit meer dan de medewerker die hem iets vraagt**, en noodmacht
    is nooit voor de AI.
11. **Geen scherm toont een macht die het systeem niet kan afdwingen.**
    `commercie/claims.js` is daar de poort voor.

## 28. Wat er bewust NIET komt

- **Geen `/admin`.** De kamers bestaan; er komt geen ingang naast.
- **Geen tweede zoekbalk, geen achtste auditcollectie, geen tweede kluis.**
- **Geen `SUPER_ADMIN`-rol.** De boardroom is een kamer met een deur, geen vlag
  die alles overslaat.
- **Geen samengesteld control-health-cijfer.**
- **Geen noodknop die alles platlegt.** `beschermstand` is de derde knop en is er
  al (`BESTUUR.md` grens 6.10).
- **Geen tijdmachine over alle entiteiten** (§18). Wel een onderzoeksdossier per
  zaak.
- **Geen replay-corpus met verzoeken erin** (§17). Wel met beslissingscontext.

## 29. Wat dit document niet zegt

De getallen in §1 en §2 zijn van 2 september 2026 en dragen hun graad
(`vermoed` waar lexicaal, `gemeten` waar geteld). Blok 0 vervangt ze. Tot dat
blok er is, hoort niemand ze door te vertellen zonder de graad erbij.

En één ding is met opzet niet opgelost: er staat nergens hoeveel medewerkers RTG
heeft. Besluit 4 maakt dat geen blocker voor de architectuur, maar het blijft een
blocker voor twee mechanismen — de canary op percentage (§16) en de zwaarte van
de vier-ogenregel (§9). Bij drie mensen is "een tweede paar ogen" soms
"dezelfde mens morgen", en dáár helpt geen enkele hoeveelheid code tegen.
