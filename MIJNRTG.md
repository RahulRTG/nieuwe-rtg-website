# MIJN RTG — de persoonlijke vertrouwenslaag

*Jouw identiteit. Jouw data. Jouw rechten. Jouw apparaten. Jouw bewijs.*

Dit is een richtingsdocument zoals `PLATFORM.md`, `OS.md` en `FABRIC.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is — zodat niemand die vier voor elkaar aanziet. Het beschrijft
geen accountpagina. Het beschrijft de laag die van instellingen een
*controlevlak* maakt.

De zin die het geheel draagt:

> **MIJN RTG bezit niets. Het stelt samen, simuleert, laat bevestigen en bewijst.**

Dat is geen bescheidenheid maar de enige vorm waarin deze laag kan bestaan zonder
het vierde rechtenmodel van dit huis te worden.

---

## 0. Wat dit vervangt, en wat niet

De huidige generatie accountcentra is in essentie: profiel → wachtwoord →
privacy → apparaten → betalingen → instellingen. Zes laden met formulieren, en de
gebruiker moet zelf weten in welke la zijn vraag zit. Wie wil dat zijn werkgever
zijn privételefoonnummer niet meer ziet, moet dat vertalen naar een pad door een
menu dat door een engineer is ingedeeld.

MIJN RTG draait dat om. De gebruiker beschrijft het **resultaat**; het systeem
stelt de configuratie samen, toont de gevolgen, en voert pas uit na bevestiging.

Wat dit **niet** vervangt: de boardroom blijft de waarheid over
capability-toestemming, het consentregister blijft de juridische bron, het
paspoort blijft de bewijsbron, de kluis blijft de documentbron, en de
machtigingen blijven de delegatiebron. MIJN RTG **componeert** ze. Elke
projectie in deze laag is leesbaar afgeleid van zijn bron en schrijft nooit een
tweede waarheid.

---

## 1. Twee correcties op de opzet, gemeten in de code

Dit document begint met twee dingen die anders liggen dan ze op papier leken. Ze
staan vooraan omdat ze allebei richting veranderen.

### 1.1 `kern/bevoegdheid/` is NIET de uitvoeringsrechtenlaag

De opzet noemde "bevoegdheid blijft waarheid voor uitvoeringsrechten". Dat is
niet wat daar staat. `server/kern/bevoegdheid/index.js` opent met de eigen
verklaring waarom hij bestaat:

> *Software kunnen bouwen en bevoegd zijn om geld te bewegen zijn twee dingen,
> en zolang ze in dezelfde schakelaar zitten kun je de eerste niet uitbouwen
> zonder de tweede te suggereren.*

Het is de laag die zegt **wat RTG ZELF mag** — `software`, `rail`, `vergunning`,
met de rangen betaalinstelling < elektronischgeldinstelling < bank. Het gaat over
vergunningen van het huis, niet over rechten van een mens.

Wie een lidgericht rechtenoverzicht op `bevoegdheid/` bouwt, bouwt op het
verkeerde fundament en krijgt een scherm dat vertelt of RTG een bankvergunning
heeft. **De vijf assen waarop een functie voor een gebruiker dicht kan staan in
`server/middleware/functieschakelaars.js`** (globaal, per pas, per land, per
plaats, per persoon, per genre); de capability-toestemming van het lid staat in
`kern/lidboard/`. Dat zijn de twee bronnen voor de permissieprojectie.

### 1.2 De rechtengraaf bestaat al — maar alleen voor personeel

Punt 3 van de opzet (de Trust Graph, "waarom mocht dit?") is niet nieuw voor dit
huis. `server/routes/command/toezicht.js` draagt `command.toegang.graaf()`:
*wie heeft nu welk zwaar recht, van wie gekregen, waarom en tot wanneer.* Met
rechten die vanzelf verlopen (`minuten`), een mandaat van-naar-terrein-tot, en
een breekglas-deur die een volledige reden eist en met risico 95 in het journaal
gaat.

De commentaarregel erboven is precies de redenering van de opzet, vier maanden
eerder opgeschreven voor de andere doelgroep:

> *Een agent-budget en een tijdelijk mensenrecht zijn dezelfde vraag in twee
> vormen: wie mag nu hoeveel, en tot wanneer?*

**Gevolg voor de bouw:** de trust graph van het lid is geen nieuwe uitvinding
maar de *tweede lezer* van een bestaand model. Dat is goedkoper én het is het
bewijs dat het model werkt. Het verschil dat wél gebouwd moet worden: de
personeelsgraaf kent zware rechten binnen RTG; de ledengraaf kent relaties naar
buiten (organisaties, apps, agenten, mensen).

---

## 2. Het fundament dat ontbreekt: de sessie weet te weinig

Vijf van de mooiste onderdelen uit de opzet — continu vertrouwen (4),
action-bound authentication (5), aanwezigheid per context (21), sender-constrained
sessies (22) en de meeste noodstand-acties (16) — hangen allemaal aan hetzelfde
en dat staat er niet.

Gemeten in `server/kern/sessies.js` en alle acht aanroepen van
`rememberSession()`: een sessie draagt vandaag `role`, `code`, `actor`,
`staffId`, `staffRole`, `manager`, `lidKey`, `lid` en `at`. Er staat **geen
toestel in, geen authenticator, geen locatie, geen context, geen risicostand**.
De sleutel is een sha-256 van het token; het venster schuift op bij gebruik.

Daaruit volgt de bouwvolgorde, en die is niet onderhandelbaar:

> **Zolang een sessie niet weet met welke sleutel op welk toestel hij ontstond,
> is elk scherm dat "waar ben ik aanwezig?" beantwoordt een verzonnen scherm.**

Dat is regel 11 van `LAT.md` toegepast op deze laag: er staat nooit een getal
waar er geen is. Een apparatenlijst die "iPhone 16 Pro, Amsterdam" toont terwijl
de sessie dat nooit heeft opgeslagen, is een `SCHERMLEUGEN.json`-regel in
wording.

**Eerste blok is dus de sessieverrijking**, en pas daarna de schermen. Let op de
16 KB-grens in `geldigeSessie()` en op het feit dat de sessiebak over een bus
naar andere processen reist: wat je erin zet, reist mee. Een toestelnaam die een
mens heeft ingetypt is een contactgegeven-achtig veld — zie de actor-regel van
`kern/envelop.js`, die precies daarom weigert wat op een contactgegeven lijkt.

---

## 3. De stand per onderdeel

Vierentwintig voorstellen uit de opzet, met de eerlijke stand. **Staat** betekent:
er is code die het doet. **Stap weg**: de bron is er, de lezer niet. **Besluit**:
er is een keuze te maken die geen engineer alleen hoort te maken. **Jaren**: de
standaard of de wereld is er nog niet klaar voor.

| # | Onderdeel | Stand | Waarom |
|---|---|---|---|
| 1 | Intent-based beheer ("deel locatie alleen tijdens een rit") | **besluit** | De doelbinding bestaat nog niet (zie 8). Zonder die laag kan de intentie niet gecompileerd worden. |
| 2 | Persoonlijke command bar | **stap weg** | `kern/stuur/beleid.js` heeft `toegestanePaden()` al: de bewijspoort die een geschorste capability uit de keuzelijst laat vallen. De intentparser wordt de tweede aanroeper daarvan, niet een tweede poort. |
| 3 | Trust graph | **stap weg** | `command.toegang.graaf()` bestaat, office-only. Zie 1.2. |
| 4 | Continu vertrouwen / step-up per actie | **half** | De VERTROUWENSSTAND staat (`kern/identiteit/vertrouwen.js`, 31 augustus 2026), op harde feiten en nergens bewaard -- zie par. 5c. Step-up PER ACTIE bestaat als `bezitsbewijs` op vijftien zware paden. Wat er niet is, is een risicoweging: dat vraagt beleidskeuzes die de eigenaar bewust niet heeft gemaakt. |
| 5 | Action-bound authentication | **stap weg** | `kern/webauthn.js` heeft de ceremonieopslag al (`zetChallenge`/`pakChallenge` met `extra`). De actie in de challenge binden is een kleine, echte stap. |
| 6 | Permission firewall ("wie heeft nu toegang tot mij?") | **staat** | 31 augustus 2026: `kern/consent-relaties.js`, scherm `/apps/mijn-relaties.html`. Geen nieuwe laag -- het Consent Center dééd dit al per soort; dit legt dezelfde negen lagen per PARTIJ. Meten wees ook uit dat de boardroom geen toegangsregister is en dat de bureau-delegatie RTG machtigt en geen buitenstaander; die staan met die reden bij "wat dit scherm niet dekt". |
| 7 | Tijdelijke rechten als standaard (wie+wat+waarom+hoelang) | **staat, verkeerde doelgroep** | `recht/geef` kent `minuten`, `mandaat` kent `tot`. Voor leden bestaat het niet. |
| 8 | Purpose-bound data | **staat, in de schaduw** | `kern/identiteit/doelen.js` + `doelpoort.js`; zichtbaar op de gegevenskaart, meetbaar op `/api/command/doelbinding`. Zie par. 5f. |
| 9 | Credential wallet (VC 2.0) | **jaren, vooruitcompatibel ontwerpen** | W3C VC 2.0 is Recommendation; de Digital Credentials API is Working Draft. Ontwerp de kluis zo dat een credential ernaast kan, maak hem geen afhankelijkheid. |
| 10 | Zero-copy identity (ask → prove → forget) | **stap weg voor nieuwe modules, jaren voor bestaande** | `kern/gegevenspoort.js` is het aanknopingspunt. De 100 bestaande domeinen bewaren al kopieën; dat is een migratie en geen schakelaar. |
| 11 | Gegevenskaart | **staat** | `kern/identiteit/gegevenssoorten.js` + `gegevenskaart.js`, scherm `/apps/mijn-gegevens.html`. Zie par. 5e. |
| 12 | Data lineage voor personen | **jaren** | Vergelijk `kern/kosten/herkomst.js`: die keten eindigt eerlijk bij "zo is hij overgenomen door een mens". Een persoonsketen over 100 domeinen is groter dan dat. |
| 13 | Policy compiler | **besluit** | Volgt op 1 en 8. |
| 14 | Simulatie vóór uitvoering | **stap weg** | De vorm bestaat: de gevolgsimulatie in `TENANT.md` met `nietGerekend` voor wat níét is meegerekend. Hergebruik die taal. |
| 15 | Undo / time machine | **stap weg, met grens** | Vereist een wijzigingsjournaal met inverse operatie. De grens staat in par. 5. |
| 16 | Noodstand | **stap weg** na sessieverrijking | `server/beveiliging-noodrem.js` bestaat aan de platformkant; de ledenkant niet. |
| 17 | Security autopilot / rechtenschuld | **stap weg** | `BEWIJSSCHULD.json` is het model: een schuld met een naam, een reden en een sluitweg. Identity debt is dezelfde vorm. |
| 18 | Privacy budget (cumulatieve blootstelling) | **jaren** | Interessant en ongemeten. Niet beginnen vóór 8 en 11 staan. |
| 19 | AI-mandaat i.p.v. almacht | **staat, verkeerde doelgroep** | `command.toezicht.zetGrenzen()` doet dit voor RTG-agenten. `FABRIC.md` par. 5 heeft de grenzen al. |
| 20 | Contextwisseling zonder opnieuw inloggen | **staat** | `kern/eenaccount.js` + `/api/account/rollen|start`, `/api/sso/wissel`. Sinds 31 augustus 2026 ook ZICHTBAAR: elke context legt zich vast bij het wisselen en verschijnt als eigen regel in "waar ben ik aanwezig". |
| 21 | Aanwezigheid per context i.p.v. sessies | **na sessieverrijking** | Zie par. 2. |
| 22 | Sender-constrained sessies (DPoP) | **staat, in de schaduw** | `kern/identiteit/bezitsbewijs.js`, 31 augustus 2026. Niet DPoP zelf (geen access token met cnf-claim, geen OAuth) maar het idee ervan, op de toestelsleutel uit blok 3. Vijftien paden met per stuk een reden. Drie standen; hij begint in `schaduw`. De meter levert het getal waar het besluit om te gaan handhaven op rust, en staat als bord in RTG Command onder *Spiegel* (`command/command-21.js`) -- met `niets gemeten` als eigen stand naast een percentage, want nul zou "niets werkt" betekenen terwijl het "wij weten het niet" is. Er staat met opzet geen schakelaar naast: de stand komt uit `RTG_BEZITSBEWIJS` bij het opstarten. |
| 23 | Evidence-native UI | **staat als taal, niet als UI** | `BESTUUR.md`: onbekend → vermoed → gemeten → bewezen, met datum, en *vervallen bewijs is geen bewijs*. Niet opnieuw uitvinden. |
| 24 | Trust receipts | **stap weg** | De ketenhash (`server/lib/keten*.js`) en het handelingsspoor dragen het bewijs al; er is geen bon die het aan de mens toont. |

---

## 4. Wat "Mijn Stand" mag zijn, en wat niet

De opzet stelt terecht voor om "Account Health 87%" te vervangen door *Mijn
Stand*. Dat is niet alleen een betere naam — het percentage is in dit huis
**verboden**, en om een reden die hier eerder is opgeschreven.

`LAT.md` regel 11 en regel 48 van `scripts/check.js` verbieden het samengestelde
groene cijfer: bewijsgroen is geen go-live-groen. `scripts/zekerheid.js` bestaat
juist omdat losse eerlijke getallen samen een gevaarlijk gevoel geven. En
`BEWIJSMACHINE.md` zegt het over precies deze vorm: één samengesteld cijfer
verbergt welke van de meters bewoog.

"Profiel 82% compleet" verbergt wát er mist, en 82% voelt goed terwijl het
ontbrekende de herstelroute kan zijn. De eerlijke vorm noemt het ding:

```
identiteit          bewezen        paspoort gezien 12 mrt 2026
huidig toestel      bewezen        passkey, deze sessie
adres               opgegeven      door jou, niet onafhankelijk getoetst
werkrelatie         gemeten        geldig tot 30 november
verificatie e-mail  onbekend       nooit gecontroleerd
```

`onbekend` is een eersteklas uitslag naast in orde en storing — geen nul, geen
grijs bolletje. Dat is dezelfde regel als `KOSTEN.md`: er staat nooit een getal
waar er geen is.

---

## 5. De grenzen

Zeven, en ze mogen geen van alle sneuvelen. Waar een functie uit par. 3 met een
grens botst, vervalt de functie.

**G1 — MIJN RTG is geen rechtenbron.** Elke permissie, delegatie en toestemming
in deze laag is een *projectie* met een aanwijsbare bron. Wie hier een recht
opslaat dat nergens anders bestaat, heeft het vierde rechtenmodel gebouwd. De
toets: haal de laag weg, en er mag geen recht verdwijnen.

**G2 — de AI stelt samen; de rechtenlaag beslist.** De keten is
intent → voorstel → bevoegdheid → conflictcontrole → impact → bevestiging →
uitvoering → bewijs. De parser kiest uit `toegestanePaden()` en breidt die lijst
nooit uit. Dit is `FABRIC.md` par. 5 en `LIFE.md` par. 4 letterlijk: **klaarzetten
mag, bevestigen doet de mens.**

**G3 — wat een tweede persoon of een derde partij bereikt, gaat nooit
automatisch.** Een intrekking mag onmiddellijk (dat beperkt), een verlening nooit
(die opent). Asymmetrie is hier het ontwerp: dichtdraaien is één handeling,
opendraaien vraagt bevestiging.

**G4 — een simulatie zegt wat zij niet heeft gerekend.** De gevolgpreview draagt
verplicht zijn eigen `nietGerekend`, zoals de tenantsimulatie. Een preview die
"0 conflicten" toont zonder te zeggen waar hij níét gekeken heeft, is gevaarlijker
dan geen preview: hij koopt vertrouwen dat hij niet heeft verdiend.

**G5 — sommige dingen zijn met opzet onomkeerbaar.** De time machine (15) raakt
nooit sleutelintrekking, credentialherroeping, of een uitgevoerde
gegevensverwijdering. Een "undo" op een intrekking is een heropening, en die loopt
via G3. De lijst onomkeerbare handelingen staat in de code met de reden per
regel, niet als vlag.

**G6 — deze laag toont bewijs, en meet het niet.** `BESTUUR.md`: de laag die iets
toont, meet het niet — anders zeggen twee schermen op een dag iets anders over
hetzelfde. MIJN RTG leest bewijsgraden; het kent er geen toe.

**G7 — de trust graph draagt codenamen.** Een graaf die persoon, toestel,
organisatie en handeling verbindt is precies de structuur die
`scripts/afleidbaar.js` meet als afleidingsrisico. De koppeling naar een echte
naam hoort in de identiteitskluis, met een inzageregel. Draai
`npm run afleidbaar` na elke uitbreiding van de graaf.

---

## 5a. Het telefoonnummer is een herstelkanaal (gerepareerd 31 augustus 2026)

`/api/auth/reset` stuurt een sms naar `phoneOf(u)`. Dat nummer is dus een
herstelkanaal -- en het KON worden vervangen door een ingelogde sessie zonder
dat er opnieuw om een wachtwoord werd gevraagd, via `/api/gegevens/zeg` of
`/api/onboarding/inricht`. Het wachtwoord wijzigen eiste dat wél. Dat was de
scheve kant op: het nummer omzetten is de eerste stap van een accountovername en
het wachtwoord de tweede.

`routes/auth/herstel.js` redeneert in zijn eigen commentaar dat een aanvaller
"eerst het telefoonnummer zou moeten weghalen, en daarvoor moet hij al binnen
zijn". Die redenering klopte; de aanname eronder niet. `setPhone` kon een nummer
niet leegmaken -- maar wel VERVANGEN, en dat komt op hetzelfde neer.

**De grendel staat in de kern en niet op een route** (`accounts/users.js`,
`setPhone`). Op een route dek je de aanroepers die je kent; in de kern ook die
van volgend jaar. Het onderscheid is niet *zetten* maar *vervangen*:

| Situatie | Wat er gebeurt |
|---|---|
| nog geen nummer | toegestaan -- er is geen kanaal om te kapen, en een eerste invoer een wachtwoord vragen is wrijving zonder winst |
| zelfde nummer | toegestaan, want er verandert niets |
| ander nummer | alleen met `vervangenMag`, en die zet een aanroeper pas ná her-authenticatie |

De twee bestaande aanroepers geven die vlag niet mee en kunnen dus alleen nog een
eerste nummer zetten; ze *melden* de weigering in plaats van hem te slikken. Een
scherm dat "gelukt" toont terwijl het nummer stil is geweigerd, laat een mens
denken dat zijn herstelkanaal is bijgewerkt terwijl het oude nog geldt.

Vervangen gebeurt op `/api/mijn/herstelkanaal/telefoon`, met dezelfde
her-authenticatie als `/api/auth/password`. Dat is geen nieuwe drempel maar het
rechttrekken van een scheve. Het antwoord noemt het **gevolg** en niet alleen het
succes: *"een herstelcode gaat vanaf nu naar dit nummer"* -- wie dat leest en de
wijziging niet herkent, hoort meteen te weten dat er iets mis is.

### Het e-mailadres, in twee stappen

Er was geen ledenroute die het adres verandert, en dat was een gat en geen
besluit: een lid kon zijn eigen inlognaam niet wijzigen. Die route staat er nu,
met drie sloten in plaats van een, want dit adres is de inlognaam (`findByLogin`
zoekt op `email_hash`) én het herstelkanaal tegelijk:

1. **het wachtwoord**, net als bij het nummer;
2. **bevestiging op het NIEUWE adres**, wat ook beschermt tegen een typefout --
   ging het meteen in, dan is een verkeerde letter een account waar niemand meer
   in kan;
3. **een bericht naar het OUDE adres**, zonder goedkeurlink maar wel met wat er
   gaat gebeuren. Wie dat leest en het niet zelf deed, kan het nog voor zijn.

Twee dingen die daarbij niet mogen schuiven. Het aangevraagde adres ligt in het
**ledendossier** en niet in `db.data`: dat dossier gaat versleuteld de kolom in,
en een e-mailadres in de operationele opslag ligt buiten de kluis. En de
**aanvraag toetst níét of het adres al bestaat** -- dat gebeurt pas bij de
bevestiging, want anders was dit een manier om te ontdekken welke adressen een
RTG-account hebben.

De bevestigingsroute is publiek en staat met die reden in de `PUBLIEK`-lijst van
`scripts/check.js`: hij komt uit de mailbox van het nieuwe adres en heeft dus
geen sessie. Dat is geen omissie maar het bewijs zelf.

## 5b. Een gat dat het overzicht zelf niet zag

Bij het bouwen van de firewall is eerst GEMETEN of de vier bronnen een vorm
delen, in plaats van dat aan te nemen. Dat leverde twee dingen op.

Ten eerste: er hoefde geen vijfde laag bij. Het Consent Center bewaart niets,
leest negen lagen en laat het intrekken over aan de laag die de toestemming
beheert -- dat ís de firewall-architectuur. De boardroom bleek geen
toegangsregister maar een schakelbord van het lid zelf, en de bureau-delegatie
machtigt RTG en geen buitenstaander. Die twee staan nu met die reden bij "wat dit
scherm niet dekt", in plaats van dat ze er verkeerd in zaten.

Ten tweede, en dat is de dure: **een zaak die uw echte naam mag opvragen**
(`kern/metier/bewijs.js`) stond in geen van beide lijsten van het register --
niet als gedekte laag en ook niet bij het niet-gedekte. Hij had zijn eigen
schermpje binnen `/api/metier/ik` en viel daardoor buiten het overzicht dat "wie
ziet wat" heet, terwijl het een lopende toestemming is met een doel en een
intrekknop.

Hij ontsnapte aan `test/consent-dekking.test.js` omdat die scan zoekt naar een
rij met `status: 'actief'`, en deze laag `ingetrokken: null` gebruikt. Dat is
precies het gat dat `consent-register.js` in zijn eigen kop benoemt ("wat die
scan NIET vindt is een andere vorm") -- het is dus niet onverwacht, maar het was
wel onopgemerkt.

## 5c. De vertrouwensstand: afgeleid, niet bewaard

Besluit van de eigenaar, 31 augustus 2026: de stand rust **alleen op harde
feiten** -- authenticator, toestelbinding, sleutelbinding. Geen locatiesprongen
(die zouden een landcode in elke sessie vragen, en een sessie repliceert over een
bus), geen gedrag (dat vraagt een gedragslogboek per lid, en dit huis houdt
tellers bij en geen journaal van wat iemand doet).

**Hij wordt niet opgeslagen, en dat is de kern.** Het veld `vertrouwen` stond in
`sessievelden.js` en werd door niemand geschreven. Dat was geen achterstand maar
een aanwijzing: een vertrouwensstand is geen waarneming maar een gevolgtrekking
uit claims die er al staan. Zo'n gevolgtrekking bewaren maakt er een tweede
waarheid van die veroudert -- de sessie zegt dan "sterk" terwijl het toestel er
inmiddels uit ligt. Het veld is er daarom uit gehaald in plaats van gevuld.

**Vier standen, geen cijfer.** `onbekend` (nooit vastgelegd), `kennis` (iets dat
u weet, en dus over te dragen), `bezit` (een sleutel of toestel heeft bezit
aangetoond) en `gebonden` (bezit én het token zit aan die sleutel vast). Een
mens die "72" leest weet niet of hij iets moet doen; wie leest "alleen iets dat u
weet" weet dat wel.

**De regel die hem eerlijk houdt: een conclusie is nooit harder dan haar zachtste
premisse.** Een sessie kan `Bezit en binding` heten en toch graad `gemeten`
dragen, omdat de inlog zelf een wachtwoord was. Zonder die regel lezen drie halve
zekerheden samen als een hele -- precies het samengestelde cijfer dat LAT-regel
11 verbiedt. En elke stand draagt zijn `nietMeegewogen`: een stand die zwijgt
over wat hij niet bekeek, laat een mens denken dat hij alles bekeek.

## 5d. Commerciele post: toestemming, en niet een voorkeur

Dit huis had al meldingsvoorkeuren (`kern/ervaring.js`, `MELDING_SCOPES`) en die
staan **standaard aan**: dat zijn serviceberichten -- uw bestelling is onderweg,
uw reservering is bevestigd. Ze uitzetten is een gemak dat RTG aanbiedt.

Commerciele post is het omgekeerde, en dat is geen stijlkeuze maar de wet: zonder
toestemming geen aanbieding. `kern/identiteit/commercieel.js` staat daarom
standaard UIT, per soort en per kanaal apart -- ja tegen mail is geen ja tegen
sms, en ja tegen aanbiedingen is geen ja tegen enquetes.

**De geschiedenis is het bewijs.** Bij een klacht is de vraag niet of het
aanstond maar wanneer iemand ja zei en waar. Elke beweging -- geven, wijzigen,
intrekken -- komt in een lijst die aangroeit en nooit wordt herschreven, met
tijdstip en herkomst. Een stand zonder herkomst is geen bewijs van toestemming;
hij is een bewering dat er ooit toestemming was.

**Wat er nooit onder valt** staat in `ALTIJD`, met de reden per regel:
beveiligingswaarschuwingen, facturen en incasso, wettelijke mededelingen, en
antwoord op iets dat u zelf vroeg. Die lijst gaat mee naar het scherm -- een
toestemmingsscherm dat alleen toont wat je KUNT uitzetten, laat denken dat de
rest ook uit kan.

Het staat op het Consent Center en niet op een eigen eilandje: een lid hoort niet
te moeten weten dat "wie mag mij benaderen" ergens anders woont dan "wie mag iets
van mij zien". In de firewall groepeert het onder *Rahul Travel Group*, want hier
verstuurt dit huis zelf en is de partij geen derde.

## 5e. De gegevenskaart: wat weet RTG van mij

Dit huis had drie van de vier vragen al beantwoord, en dat is precies waarom deze
ontbrak zonder dat iemand hem miste:

| vraag | laag |
|---|---|
| wie **mag** er iets van mij | `kern/consent-register.js` |
| wie **heeft** er gekeken | `kern/inzagekaart.js` |
| wat **mist** er voor een handeling | `kern/gegevenspoort.js` |
| wat **is** er van mij | `kern/identiteit/gegevenskaart.js` |

`/api/privacy/export` gaf die vierde wel, maar als een dump: een JSON met veertien
takken waarin een mens moet zoeken. Een uitvoer is een RECHT, en een antwoord is
iets anders dan een bestand.

**Drie woorden die hier niet hetzelfde betekenen**, en dat is met opzet: *waar*
iets staat (kluis, dossier, operationeel, afgeleid), *hoe* het bij ons kwam
(opgegeven, gemeten, overgenomen, afgeleid) en *waarvoor* het gebruikt mag worden.
Ze lopen uit elkaar -- uw geboortedatum staat in de kluis, is door u opgegeven,
en kan later zijn overgenomen van een document dat een mens aftekende. Dat
verschil is de reden dat RTG iD twee bronnen toont, en een kaart die alleen
"geboortedatum: bekend" zegt, wist het weg.

**Dit is een register en geen afleiding, en dat is een keuze.**
`BEWIJSMACHINE.md` waarschuwt terecht dat een register naast de code binnen een
jaar zelf een botsing wordt. Het antwoord daarop is hier niet "dan leiden we het
af" -- want doelbinding en het gevolg van weghalen staan nergens in de code te
lezen; die zijn besloten, niet gemeten. Het antwoord is dat elke regel een
`bron` draagt: het bestand waar dat gegeven werkelijk woont. Verhuist dat
bestand, dan zakt `test/gegevenskaart.test.js` -- en dan is de regel aantoonbaar
achterhaald in plaats van stil verkeerd. Bij de eerste keer draaien vond die
handhaver meteen een fout: `server/accounts.js` bestaat niet, dat is een map.

**Drie redenen waarom iets niet weg kan, en ze zijn niet inwisselbaar.** Ze
stonden eerst alle drie als een kale `kan: false`, en dan komt uw naam op
dezelfde lijst als uw facturen -- terwijl het ene meegaat als u opheft en het
andere zeven jaar blijft staan. Dus: `account-nodig` (gaat mee bij opheffen),
`wettelijk` (blijft ook daarna), `beschermt-u` (wissen zou het onbruikbaar maken
als bescherming -- kon u het inzagejournaal wissen, dan kon iemand die bij u keek
dat ook).

**Een storing is geen afwezigheid.** Elke peiling geeft ja, nee of *niet vast te
stellen*, en die derde draagt altijd een reden bij de rij zelf. `BESTUUR.md` zegt
dat "niet vast te stellen" een eersteklas uitslag is naast de andere twee, en
hier is dat geen netheid: zou een storing als "nee" op het scherm komen, dan leest
een lid "RTG heeft mijn adres niet" op het moment dat de kluis niet opengaat. Die
regel sneuvelde onderweg een keer in mijn eigen code -- de kluisfout werd
opgevangen en daarna zeiden de dossier-peilingen keurig `false`. De toets ving
het; het scherm geeft "onbekend" een eigen kleur, zodat het onderscheid ook voor
een mens bestaat.

**Wat deze kaart niet zegt** staat op de kaart zelf, in vier regels: het zijn
soorten en geen inhoud (dat blijft de AVG-uitvoer), wat een zaak zelf bijhoudt
valt erbuiten, een controle met het Zegel kan er niet op (het pseudoniem verschilt
per zaak, dus RTG kan hem niet aan uw account terugkoppelen), en de kaart schrijft
niets -- hem openen laat geen spoor achter, anders wordt uw eigen kaart voller
door ernaar te kijken.

**De termijn komt uit het beleid en niet uit een zin.** Hij stond eerst als
"zeven jaar" in het register, en het narekenen tegen `server/bewaartermijnen.js`
legde meteen een fout bloot die ik zelf had geschreven: het inzagejournaal
"blijft", zei de kaart -- terwijl het beleid het na **730 dagen** veegt. "Blijft
altijd" en "blijft twee jaar" zijn niet hetzelfde, en het tweede is wat er
gebeurt. Elk gegeven met een termijn draagt daarom een `bewaartak` die naar de
regel in het beleid wijst, en de kaart haalt het getal daar op. Verdwijnt die
regel, dan zegt de kaart dat de termijn niet is vast te stellen -- want een
verdwenen regel als "geen termijn" tonen zou zeggen dat het eeuwig blijft staan,
en dat is de gevaarlijke kant van de fout.

**Er zijn drie uitkomsten bij opheffen en niet twee.** `kern/vergeten.js` kent
vier soorten, en de tweede is *de persoon eruit, de rest blijft*: een reactie in
andermans draad, uw helft van een gesprek, de bel van een zaak. Dat is geen
wissen en geen bewaren. Het scherm noemde die derde eerst niet, en dan leest
"alles gaat weg" als een belofte die iemand later zijn eigen zin nog ziet
tegenspreken -- ook al is er niets fout gegaan.

Er komt met opzet **geen wisknop** op dit scherm. Weghalen doe je waar het gegeven
woont; zou het hier ook kunnen, dan bestond er van elk gegeven twee plekken om het
weg te halen, en dan is er binnen een jaar een die het net iets anders doet.

## 5f. Doelbinding: waarvoor mag dit gegeven gebruikt worden?

Dit was het duurste gat van de lijst, en het gat zat niet in wat er ontbrak maar
in wat er stond. De boardroom van een lid schakelt per **functie** -- reizen aan,
Salon uit. Dat is een goede laag en hij blijft. Maar een functie is geen doel:
"RTG Pay staat aan" zegt niets over de vraag of uw telefoonnummer gebruikt mag
worden om u een aanbieding te sturen. De gegevenskaart noemde per gegeven een
doel, in een **zin**, en niemand dwong die zin af. Doelbinding was daarmee een
belofte in tekst -- LAT-regel 6.

**De grond is het scharnier, en hij bepaalt of u nee mag zeggen.** Dat is geen
nuance maar de kern: een kaart die zegt "u kunt elk doel weigeren" liegt, want
uw adres gebruiken om uw bestelling te bezorgen is de uitvoering van wat u zelf
vroeg. Vier gronden, en maar één ervan is een keuze:

| grond | te weigeren | waarom |
|---|---|---|
| `overeenkomst` | nee | zonder dit gebruik kan RTG niet leveren wat u zelf in gang zette |
| `wettelijk` | nee | de wet schrijft het voor; niemand hier kan dat wegklikken |
| `bescherming` | nee | kon u het uitzetten, dan kon een ander dat ook |
| `toestemming` | **ja** | staat standaard uit, en is altijd in te trekken |

**Er komt geen tweede toestemmingsboekhouding bij.** Een doel met grond
`toestemming` vraagt het aan `kern/identiteit/commercieel.js` -- dezelfde laag
die het scherm en het Consent Center lezen. Zou de poort een eigen ja/nee
bewaren, dan zijn er binnen een jaar twee waarheden over hetzelfde, en verschilt
de ene van de andere precies wanneer het ertoe doet (LAT-regel 4).

**Vier uitkomsten en niet twee**, in de geest van CONTROLPLANE.md: `onbekend` is
met opzet geen synoniem van `geweigerd`. Een doel dat niemand kent is een fout
van de aanroeper; een storing is geen overtreding. En een storing weigert nooit,
ook niet in de stand `afdwingen` -- als de toestemmingslaag stuk is, weten we het
niet, en de app stilzetten om een reden die niets met het lid te maken heeft is
erger dan doorgaan. Wel geteld, en juist die teller hoort op te vallen.

**Twee standen en niet drie.** Bij het bezitsbewijs bestaat `aanbevolen` omdat
een waarschuwing aan een MENS daar betekenis heeft ("bind uw toestel"). Hier
staat geen mens: hier vraagt code of zij dit gegeven mag gebruiken, en
"eigenlijk niet" is geen antwoord waar een aanroeper iets mee kan. Een derde
stand die niemand kan uitvoeren, is een knop die niets doet.

**Twee dingen die de handhaver meteen vond.** De toets die de twee registers aan
elkaar houdt, ontdekte dat `post` -- uw eigen postvoorkeuren -- geen enkel doel
had: een gegeven waarvan niemand meer kon zeggen waarom RTG het heeft. Het is
nu het doel *toestemmingsbewijs*, met grond `wettelijk`, want wie zich op
toestemming beroept moet kunnen aantonen dat die er was (AVG art. 7 lid 1). Let
op de vorm: uw voorkeuren zijn zelf níét weigerbaar terwijl waar ze over gaan dat
wel is -- kon u dat bewijs wegdrukken, dan kon RTG niet meer aantonen dat u ooit
nee zei, en dan werkt uw nee tegen u.

Het tweede vond een **mutatie die overleefde**: `identiteitsbewijs` toevoegen aan
een doel dat er niets mee te maken heeft, ging door alle toetsen heen. Machinaal
is niet te bepalen welk doel welk gegeven nódig heeft -- dat is een afweging.
Wat wel kan is hem vastleggen, zoals `GRENZEN.json` dat doet: de doel-gegeven-
matrix staat in `test/doelbinding.test.js`, en wie een doel verbreedt moet daar
opschrijven dat hij het wilde. Zo verwatert dataminimalisatie niet met een regel
erbij omdat het handig uitkwam.

**En hij begint in de schaduw.** `RTG_DOELBINDING` staat op `schaduw` en weigert
niets; hij rekent alleen uit wat er zou zijn gebeurd en telt dat, leesbaar op
`/api/command/doelbinding`. CONTROLPLANE.md: je kunt niet afdwingen wat nooit in
de schaduw heeft gelopen. De overstap naar `afdwingen` is een besluit van de
eigenaar, en er hoort productieverkeer onder te liggen voordat het genomen wordt.

## 6. De volgorde

Niet naar aantrekkelijkheid maar naar afhankelijkheid. Elk blok is los
opleverbaar en los terug te draaien.

1. **Sessieverrijking** — toestel, authenticator, context en ontstaansmoment in
   de sessie. Zonder dit is blok 2, 5 en 7 verzonnen. *(par. 2)*
2. **Sessies & toestellen voor het lid** — lijst, uitloggen per sessie,
   contextbinding intrekken. Het enige gat dat vandaag schade kan doen.
   *(Staat, 31 augustus 2026: `routes/member/sessies.js`, scherm
   `/apps/mijn-sessies.html`. De intrekking loopt op de SID en niet op het
   token -- het token van dat andere toestel heb je niet, en dat is nou juist
   het toestel dat je kwijt bent. Contextbinding intrekken wacht op blok 7.)*
3. **2FA en herstel voor leden** — `kern/totp.js` bestaat, maar alleen met
   `OFFICE_TOTP_SECRET`. Eén herstelcode is geen herstelcodeset.
   *(Toestelbinding staat sinds 31 augustus 2026:
   `kern/identiteit/toestellen.js` plus `public/shared/toestelsleutel.js`. Een
   ECDSA-sleutel die de browser maakt met `extractable: false` tekent een
   uitdaging; alleen dat verdient `bewezen`. De sleutel is nadrukkelijk GEEN
   inlogmiddel -- hij bindt een sessie die er al is, en `test/toestelbinding.test.js`
   toets 6 zakt zodra die module een account aanraakt.)*
4. **De permission firewall** — projectie over vier bestaande bronnen. Het eerste
   blok dat er als MIJN RTG uitziet.
   *(Staat. En de meting die eraan voorafging vond een gat: een zaak die uw
   echte naam mag opvragen stond in géén van beide lijsten van het Consent
   Center -- niet gedekt en ook niet als uitzondering benoemd. Zie par. 5b.)*
5. **Trust receipts** — de bon onder wat blok 2 en 4 uitvoeren. Bewijs dat al
   bestaat, eindelijk zichtbaar.
6. **Mijn Stand** — pas als er iets te tonen valt dat gemeten is. *(par. 4)*
7. **Doelbinding** — het duurste gat, en het besluit dat de intentlaag ontgrendelt.
8. **De command bar** — laatst, niet eerst. Een intentparser boven een halve
   permissielaag compileert halve intenties.

De verleiding is bij 8 te beginnen, want dat is het onderdeel dat het meest naar
2030 ruikt. Maar een command bar die "trek alles van bedrijf X in" aanneemt
terwijl de doelbinding er niet is, belooft een intrekking die hij niet kan
waarmaken — en dat is erger dan een menu.

---

## 7. De gouden regel

Voor elke functie in deze laag geldt één vraag: **waarom moet de gebruiker dit
zelf beheren?**

- Kan het systeem het veilig afleiden → automatisch doen.
- Kan het veilig voorstellen → voorstellen, niet aandringen (`GRAMMATICA.md`).
- Vereist het toestemming → één duidelijke keuze, met de gevolgen erbij.
- Is het risico groot → eerst simuleren, met `nietGerekend`.
- Is de handeling gevoelig → cryptografisch aan díé handeling binden.
- Is het uitgevoerd → bewijzen, met een bon.
- Kan het tijdelijk → dan is het tijdelijk, en verloopt het vanzelf.
- Is de data niet nodig → niet opslaan.
- Is een bewijs genoeg → de brondata niet delen.

En de lat voor de vorm: **80% van de gewone accounttaken binnen twee
handelingen.** Een nieuw telefoonnummer is één verificatie en één bevestiging van
de migratie — niet zes schermen waarin de gebruiker zelf de afhankelijkheden moet
onthouden die het systeem allang kent.
