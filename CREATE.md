# RTG Create — de makerslaag

> **Van idee naar veilige digitale dienst, zonder eerst infrastructuurbedrijf te
> hoeven worden.**
>
> Start simple. Never outgrow RTG.

Dit bestand hoort bij `DEVELOPERCLOUD.md` zoals dat bij `PLATFORM.md` hoort, en
het staat er bewust BOVEN. De Developer Cloud beschrijft wat een ONTWIKKELAAR
krijgt; dit beschrijft de hele ladder eronder — van een kapper die zelf een
pagina maakt tot een softwarebedrijf met een eigen team, en de belofte dat je
daartussen niet één keer opnieuw hoeft te beginnen.

`LAT.md` zegt hoe er geschreven wordt, `CLAUDE.md` wat het merk is,
`APPSTORE.md` hoe een derde binnenkomt, `TENANT.md` hoe een klant zijn eigen
naam erop zet, `ARCHITECTUUR.md` waar de dingen staan.

---

## 0. Wat dit document is, en de vier bakken

Net als `PLATFORM.md` en `DEVELOPERCLOUD.md` noemt dit stuk niet alleen de
bestemming. Een richtingsdocument dat alleen de bestemming noemt is een
verlanglijst; hier staat alles in vier bakken:

| bak | betekenis |
|---|---|
| **staat** | het draait, er is een toets, je kunt het openen |
| **een stap weg** | de onderdelen staan, wat ontbreekt is de schil |
| **vraagt een besluit** | het kan, maar het verandert een bestaande belofte of grens |
| **jaren weg** | het is een eigen project met een eigen bewijslast |

**Wat in de laatste twee bakken staat, hoort nergens als knop op een scherm te
verschijnen.** Dat is dezelfde regel als in DEVELOPERCLOUD.md par. 0, en hij
geldt hier extra: een makerslaag die dingen belooft die er niet zijn, wordt door
makers als eerste doorgeprikt.

---

## 1. De vier routes die er vandaag al zijn

Dit is de reden dat dit document bestaat. Er is hier geen lege developer cloud;
er zijn **vier verschillende manieren waarop iemand vandaag iets op RTG maakt**,
en ze weten niets van elkaar.

| route | voor wie | wat het al kan | waar |
|---|---|---|---|
| **Website-maker** | leden en zaken | veertien bloktypen, 12 sites per lid, 7 extra pagina's, versiegeschiedenis (10 standen), publiceren op een moment, spoor, privacyarme cijfers, `naam.rtg` | `kern/webmaker*.js`, `/apps/sitemaker.html` |
| **Website Platform** | zaken | complete site uit het zaakprofiel, **live blokken** die naar de bron wijzen, publiceren achter `managerOnly`, merkuitrol over vestigingen | `kern/webplatform.js`, `kern/webmerk.js` |
| **App Store** | derden | uitgeversplek, manifest, bundel met hash, machinepoort met regelnummers, proefkeuring, menselijk besluit, cel, verkoop via RTG Pay | `kern/appstore/` (16 modules) |
| **Tenant / white-label** | organisaties | `org` als klant, contract, quota, SAML + OIDC, SCIM, uitgang, bewijspoort | `kern/tenant/`, `server/sso/`, `server/scim/` |

Daarnaast de **specialistische makers**: Lesmaker, Clips-studio, bedrijfsontwerper
en Mall-bouwer, Magnaat Partnerstudio, de creator-laag.

Wat er dus al is: creëren, publiceren, distribueren, verkopen, isoleren,
white-labelen, AI-assistentie, rechten, menselijke review en een business master
record. Wat er niet is, is **de ervaring waarmee iemand die kracht prettig
gebruikt** — en dat is precies waar de aandacht heen moet.

---

## 2. De regel die beslist of dit één familie mag worden

Dit is de belangrijkste paragraaf in dit document, en hij komt niet uit een
mening maar uit een fout die hier al een keer is gemaakt.

`PLATFORM.md` par. 0b stelt de toetsvraag bij alles wat "erbij" of "eraf" moet:

> **Is dit een zelfstandige professionele capability, of is dit slechts een
> andere ingang naar dezelfde capability?**
>
> Alleen in het tweede geval samenvoegen. In het eerste geval **een laag
> erboven**.

Die regel is er gekomen na Cercle en Entourage: twee apps die identiek KLONKEN
en bij onderzoek totaal verschillende data en werkstromen bleken te hebben.
Dezelfde meting is later herhaald over de hele codebase (`scripts/objectmodel.js`,
`OBJECTMODEL.json`): van 1140 bewaarde vormen in 216 domeinen horen **1179 van de
1661 velden (71%) bij precies één domein**, en `Asset` bestaat niet — tafel,
kamer, podium en leaseauto delen niets buiten hun verpakking.

**RTG Create is daarom een LAAG en geen samensmelting.** Dat onderscheid is niet
semantisch:

- *Een laag erboven* betekent: één ingang ("wat wil je maken?"), één
  projectbegrip, één publicatiemodel, één bewijsrecord — en daaronder blijven
  Lesmaker, Clips en de Website-maker hun eigen kern, data en workflow houden.
- *Samensmelten* betekent: één codebase, één datamodel. Dat mag alleen waar de
  toetsvraag met "andere ingang naar dezelfde capability" wordt beantwoord.

En dat is aantoonbaar niet overal zo. Twee voorbeelden uit deze codebase:

- **Website-maker en Website-studio delen wél een kern.** Allebei draaien ze op
  dezelfde bloktaal, en de studio zet sjablonen in een etalage die de maker als
  startpunt leest. De maker kent er veertien (`kern/webmaker-schoon.js`), de
  studio tien (`kern/atelierweb.js`) — de vier extra zijn `zaakdata`,
  `formulier`, `faq` en `prijzen`, en dat is geen andere taal maar een
  bovenverzameling: de studio maakt sjablonen en heeft geen live bedrijfsblok
  nodig. Twee ingangen naar dezelfde capability. Samenvoegen mag.
- **Lesmaker en Clips-studio delen niets.** De Lesmaker maakt lesstof met een
  klascode, een leraar die elke vraag zelf start en lessen die na zes uur
  verlopen. Clips knipt video die **het toestel van de maker nooit verlaat** —
  daar valt niets te renderen omdat RTG het beeld niet heeft. Dat zijn twee
  zelfstandige capabilities met een gedeeld woord ("studio") en verder niets.

### Wat er dus eerst gemeten moet worden

Voordat er een familie wordt uitgeroepen, hoort dezelfde meting te draaien die
par. 2 van DEVELOPERCLOUD.md al een keer heeft gedaan — nu over de makers:

1. haal per maker de vorm op van wat hij bewaart (een site, een les, een clip,
   een mallprofiel, een partnerbedrijf);
2. trek de envelop eraf (`id`, `naam`, `at`, `status` — de 35 velden die
   `OBJECTMODEL.json` al als verpakking heeft aangewezen);
3. tel wat er overblijft.

**Wat vier makers delen, is een projectmodel. Wat er twee delen, is een
toevalligheid met een mooie naam.** Zonder die meting is "Universal Project" een
aanname over gedeelde vorm, en dat is exact de aanname die hier al een keer fout
is geweest.

Het gereedschap ervoor bestaat al; er hoeft geen methode te worden bedacht,
alleen een script (`scripts/makers.js`) dat `scripts/objectmodel.js` volgt.

---

## 3. De ladder

Vier niveaus, één onderliggende software. Dit is de belofte, en hij is
controleerbaar: **hetzelfde project moet door alle vier de ingangen te bekijken
zijn.**

| niveau | wat de mens doet | wat er vandaag al voor staat |
|---|---|---|
| **1 — Create** | beschrijft het ("maak een website voor mijn hotel") | de automatische bedrijfssite uit het zaakprofiel; de AI-knop in de maker |
| **2 — Builder** | bouwt visueel: pagina's, blokken, regels | de Website-maker en de Website-studio |
| **3 — Studio** | schrijft code: SDK, CLI, schema's, events | niets — dit is fase 4 van DEVELOPERCLOUD.md |
| **4 — Engineering** | teams, omgevingen, uitrol, governance | `kern/tenant/`, SSO, SCIM, het bewijsmodel |

De ladder is niet vier producten maar één trap: een kapper begint op 1, huurt
later een ontwerper in die op 2 werkt, dan een bureau dat op 3 zit, en groeit
door naar 300 vestigingen op 4 — met de merkenlaag die uitrolt. **Zonder
platformmigratie.** Dat is de sterkste claim in dit document en tegelijk de
duurste: hij is pas waar als niveau 3 bestaat.

---

## 4. Wat er STAAT

Niet als inschatting; per punt het bestand dat het doet.

- **Isolatie.** Derdencode in een naamloze herkomst, eigen CSP, `connect-src
  'none'`, integriteit bij elke lezing — `routes/appstore/cel.js`.
- **Machtigingen met een doel.** Drie machtigingen, elk met een gesloten lijst
  doelen; een machtiging zonder doel wordt geweigerd — `kern/appstore/machtigingen.js`,
  `manifest.js`.
- **De vergunningsdiff.** Een versie die meer vraagt, vraagt opnieuw —
  `kern/appstore/besluit.js`.
- **De brug.** Zes methodes, en de brug leest wat het lid VERLEENDE, niet wat het
  manifest vroeg — `kern/appstore/brug.js`.
- **Grenzen die gerekend worden en niet vertrouwd.** 32 sleutels, 4 kB per
  waarde, 64 kB totaal, 5 berichten per dag, 120 aanroepen per minuut — `GRENS`.
- **Een poort die uitlegt.** Per bestand én per regel wat er is en hoe het wél
  kan — `kern/appstore/keuring.js`, `verboden.js`.
- **Een proefkeuring.** Dezelfde poort, niets bewaard, geen rem —
  `kern/appstore/versies.js`.
- **Onveranderlijke bundels.** Hash in het pad, immutable, integriteit per
  lezing — `kern/appstore/bundel.js`.
- **Geld.** Prijs in het manifest, btw in het land van het lid, afdracht,
  payout, teruggaverecht — `kern/appstore/geld.js`, `kern/pay/verkoop.js`.
- **Publiceren met een weg terug.** Versiegeschiedenis, herstellen, plannen,
  spoor — `kern/webmaker-versies.js`, `-plan.js`, `-spoor.js`.
- **Views in plaats van kopieën.** Live zaakdata-blokken die bij het openen uit
  het profiel worden opgelost — `kern/webplatform.js`.
- **Enterprise.** SAML, OIDC, SCIM, contract, quota, uitgang, bewijspoort.
- **Het inkoopdossier.** Per bewering een bron in de code, plus een blok "wat dit
  dossier NIET zegt" — `kern/appstore/dossier.js`.

---

## 5. Een stap weg

De onderdelen staan; wat ontbreekt is de schil. Dit is fase 4 van
DEVELOPERCLOUD.md, met de doorrekening.

1. **Eén brugklant, één CSP.** Ze staan nu als string-literal in
   `routes/appstore/cel.js` (regel 43 en 77). Een CLI die ze kopieert, maakt een
   tweede brug — LAT-regel 4. Verhuizen naar `kern/appstore/brugklant.js`.
2. **Eén foutmodel — en het is nu kapot.** `brug.js` geeft bij een weigering vier
   velden terug (`machtiging`, `verleend`, `gevraagd`, `hoe`) die precies
   uitleggen of de app het niet vroeg, het lid het niet gaf, of het lid het
   introk. `appcel.html:133` maakt er `new Error(d.error)` van, `:179` stuurt
   alleen `err.message` terug, `cel.js:81` maakt er opnieuw een kale string van.
   **Dat zorgvuldig geschreven antwoord bereikt vandaag niemand.**
3. **`rtg check`.** `keur()` is al puur (`{bestanden, manifest, antivirus}`, geen
   db, geen sessie), dus een CLI kan de echte poort requiren in plaats van hem na
   te bouwen. Eén obstakel: zonder virusscanner geeft `keur()` `door: false`, wat
   op de server juist is en in een CLI elke bundel afkeurt om een reden die de
   bouwer niet kan oplossen. Oplossing in de taal van dit huis: **drie uitslagen
   in plaats van twee** — vorm in orde of blokkeert, virusscan *niet uitgevoerd*
   (BESTUUR.md: `niet vast te stellen` is een eersteklas uitslag). Een `eisScan`
   die op de server default `true` blijft.
4. **`rtg dev` draait de ECHTE brug.** `maakBrug()` heeft alleen
   `{S, save, nu, boek, eigen}` nodig; een in-memory `S()` levert de echte brug
   met de echte grenzen. Een emulator die de regels nábouwt liegt vroeg of laat
   over precies de grens waarop een app stukloopt. Deze voert ze uit.
5. **SDK en typings, gegenereerd.** Uit `METHODES` + `machtigingen.js`, met een
   toets die zakt als er een methode bij komt zonder hergeneratie.
6. **`rtg new`.** Vraagt wat je maakt, niet welk configbestand je wilt.

Volgorde: 1 → 2 → 3 → 4 → 5 → 6. Punt 2 vóór 5, want je codificeert geen
foutmodel dat onderweg wordt weggegooid. Punt 1 vóór 4, want anders is *"werkt
lokaal, geblokkeerd in de cel"* het eerste wat een uitgever meemaakt.

---

## 6. Vraagt een besluit

Zes punten die kunnen, maar die een bestaande belofte of grens raken. Ze horen
een besluit van de eigenaar te krijgen in plaats van stilletjes de ene of de
andere kant op te vallen.

### 6.1 Ontwikkelen zonder eerst bedrijf te zijn

Vandaag loopt inzenden via `supplierAuth`, en de uitgeversplek eist een
organisatie: *"Een app in de officiële App Store heeft een aanspreekbare
rechtspersoon achter zich"* (`routes/appstore/uitgever.js`). Een student met een
goed idee komt er dus niet in.

De uitweg is een ladder van identiteiten, en die botst niet met TENANT.md zolang
er geen vijfde identiteitsbegrip bij komt:

| niveau | mag |
|---|---|
| **individueel** | bouwen, lokaal draaien, een besloten preview delen |
| **geverifieerd** | idem, plus publiceren van gratis apps |
| **commercieel** | betaald distribueren (rechtspersoon, bank, fiscaal) |
| **enterprise** | teams, SSO, SCIM |

**Het besluit zit op de tweede regel, niet op de eerste.** Bouwen en lokaal
draaien vragen geen enkele identiteit — dat kan morgen, want `rtg check` en
`rtg dev` raken de server niet. Maar zodra code van een natuurlijk persoon voor
een LID draait, staat er geen aanspreekbare partij meer achter, en dat is precies
wat APPSTORE.md met opzet heeft dichtgezet.

### 6.2 De capabilities die vandaag met een reden NIET bestaan

Een lijst als `calendar.read`, `payments.request`, `location.approximate`,
`files.pick`, `notifications.send` leest als een routekaart. Vijf ervan staan
vandaag in `machtigingen.NIET_GEBOUWD` **met een reden**, en die redenen zijn
geen achterstand:

| gevraagd | wat er nu staat |
|---|---|
| `payments.request` | geld verlaat het huis nooit vanzelf (GELD.md par. 3); er is geen weg waarlangs een lid een betaling van een derde bevestigt |
| `calendar.read` | er is geen leesweg naar de agenda die een codenaam niet terugvoert op een mens — een afspraaktitel bevat namen |
| `files.pick` | de bestandenlaag kent delen per persoon en per zaak, niet per app; een vierde deelmodel maakt "wie mag hierbij" op twee plekken beantwoordbaar (LAT-regel 4) |
| `location.approximate` | zolang er geen intrekbare, zichtbare en tijdgebonden vorm van staat, komt er geen ruwe vorm van |
| `notifications.send` | **push onderbreekt.** Een derde krijgt geen kanaal dat een telefoon laat trillen |

De laatste is geen technische schuld maar een merkbesluit, en hij staat haaks op
`notifications.send` als capability. `bericht.klaarzetten` bestaat juist omdat
het de niet-onderbrekende vorm is: de app legt het bericht neer, het lid haalt
het op.

**Elke capability die erbij komt, komt erbij door zijn reden op te lossen — niet
door hem op een lijst te zetten.** Een regel in `NIET_GEBOUWD` verdwijnt pas als
de brug hem uitvoert.

### 6.3 Uitgaand netwerk, connectors, en eigen backend

`connect-src 'none'` is vandaag strenger dan een hostlijst, en dat is geen
voorzichtigheid maar een andere aankoop: *zolang een app niets kan versturen,
hoeft niemand te bewaken wát hij verstuurt.* DEVELOPERCLOUD.md par. 3.1 raadt aan
dat zo te houden zolang de capability-poort het werk kan doen.

Connectors met een expliciete uitgaande binding (welke partij, welk land, welke
dataklasse, welke toestemming) zijn de juiste vorm als het toch moet — en "Bring
Your Own Backend" is diezelfde beslissing in zijn duurste vorm, want dan is de
uitgaande weg de normale weg. Beide vragen een uitgaande proxy met logging per
verzoek. **Dit is één besluit met twee gezichten, geen twee features.**

### 6.4 Agents als publiceerbaar producttype

Het gekozen voorbeeld valt precies goed en dat is het vermelden waard: een
inkoopagent met `purchase.draft` en zonder `payment.execute` is exact
"klaarzetten", en dat is de bovengrens die GELD.md par. 3 al trekt. De
vier-niveautabel bestaat dus al (kijken / voorstellen / klaarzetten /
automatisch), en DEVELOPERCLOUD.md par. 3.2 legt hem naast observe / assisted /
autonomous.

Wat een besluit vraagt is niet de agent maar zijn **duur**: een tijdelijke,
begrensde, intrekbare bevoegdheid met een spoor is de vorm waarin dit kan. Een
agent met een permanente machtiging is het niet.

### 6.5 Private catalogus via entitlements — de sterkste vondst

DEVELOPERCLOUD.md weigert de private catalogus vandaag met een reden: hij vraagt
te weten welk LID bij welke ORGANISATIE hoort, en dat antwoord bestaat al twee
keer (het dienstverband uit CONCERN.md, de SSO-inrichting uit TENANT.md). Een
derde lezing erbij is LAT-regel 4.

**Entitlements lossen dat op zonder een derde register.** De App Store vraagt dan
niet "bij welke organisatie hoort deze mens", maar krijgt uit de identiteitslaag
alleen `entitlement: app.internal.1234`. Geen directory, geen kopie, geen derde
bron van waarheid — en interne apps worden mogelijk zonder de privacyarchitectuur
te breken.

Dit is het patroon dat dit huis wil: **een nieuwe functie door een betere
capabilitygrens, niet door een datakopie.** Van alles in deze paragraaf is dit
het punt met de beste verhouding tussen waarde en risico.

### 6.6 De afdracht

Staat vandaag op 0%, en dit huis belooft partners "RTG rekent 0% commissie".
Elke marketplace-economie hierboven (onderdelen, thema's, workflows, agents)
gaat ervan uit dat er iets te verdelen valt. Van 0% naar iets is een verandering
van een bestaande belofte en hoort zo te worden opgeschreven.

---

## 7. Jaren weg

Eigen project, eigen bewijslast, en het hoort niet als knop op een scherm.

- **Serverside functies, cron, background jobs, managed data, realtime.** Vandaag
  draait derdencode uitsluitend in de browser van het lid. Zodra
  `onOrderCreated(event)` bij ons draait, verandert het dreigingsmodel volledig:
  procesisolatie, resourcelimieten, buurmanlekken, uitbraak, en een
  aanvalsoppervlak dat 24 uur per dag aan staat. Dat is niet een feature erbij
  maar RTG dat een hostingbedrijf wordt (DEVELOPERCLOUD.md par. 3.4).
- **Er is één ding dat hiervóór moet, en het is gemeten.** `IDEMPROEF.json`:
  van 3074 routes met een rol zijn er **115 beoordeeld, 15 beschermd, 100
  onbeschermd en 2959 ongemeten.** Het bestand zegt er zelf bij dat
  "onbeschermd" een telling is en geen defect-oordeel — maar dat is precies het
  punt: **het getal dat ertoe doet is 2959.** Achtergrondtaken met retries
  bovenop een laag waarvan de herhaalbaarheid grotendeels ongemeten is,
  vermenigvuldigt een bestaand gat in plaats van een nieuwe functie te leveren.
  Retry-semantiek is dus geen los punt maar een voorwaarde.
- **SDK's in vijf talen uit één contract.** Zinvol zodra het contract er is; niet
  ervoor.
- **Visuele app-bouwer en conversation-to-app.** Dit is niveau 1 en 2 voor apps
  in plaats van sites. De Website-maker bewijst dat het patroon werkt; de sprong
  zit in wat een app IS zonder eigen runtime.

---

## 8. Drie aannames die de code niet steunt

Deze staan hier apart omdat ze de volgorde veranderen, en omdat een plan dat
leunt op iets wat er niet is, het duurst is op het moment dat iemand erop bouwt.

### 8.1 Magnaat is een leerspel, geen testharnas

`kern/magnaatwereld.js` opent met: *"een spelopdracht roept NOOIT een
productie-endpoint aan. Elke functie wordt vertaald naar een trainingskopie met
synthetische data."* Magnaat is een kantoor- en ondernemersgame waarin een MENS
oefent met RTG-functies — trainingslobby, werkroutes, economenlab,
partnerstudio. Er zit geen motor in die een app van derden met 100.000
synthetische gebruikers bestookt.

"Test in Magnaat" is dus geen integratie van iets bestaands maar een nieuwe
engine met een bekende naam. **Wat er wél staat, staat ergens anders:**
`scripts/aanval.js` (een aanvalsronde tegen een draaiende server, mét de
eerlijke kanttekening dat het geen onafhankelijke pentest is),
`scripts/chaos.js` (een server omleggen en meten of de rest het overneemt) en
`scripts/beproeving.js`. "Break My App" hoort daar te beginnen, niet in Magnaat.

### 8.2 De keuring kijkt niet naar toegankelijkheid

`kern/appstore/keuring.js` controleert bestandssoort, budget, verboden vormen,
externe verwijzingen en de virusscan. Meer niet. De a11y-machinerie van dit huis
(`scripts/a11y.js`, `test/a11ykeuring.test.js`, `TOEGANKELIJK.md`) draait over
**onze eigen 258 schermen** en heeft nooit een derdenbundel gezien.

Een toegankelijkheidsscore in de keuring is dus nieuw werk — verdedigbaar werk,
want de poort die per regel uitlegt hoe het wél kan is er al en dit past er
precies in. Maar het is bouwen, geen zichtbaar maken.

### 8.3 Er is geen Economic Control Plane

Er is geen laag die kosten per app, per gebruiker of per functie bijhoudt.
Wat er is: `scripts/duurzaamheidskosten.js` (wat een duurzame commit kost, één
meting), `kern/servicekosten.js` en `kern/pasprijs.js` (prijzen van RTG-diensten
aan leden), en `kern/magnaat-economie.js` — dat laatste is de spel-economie.

Kostenvoorspelling per deployment is daarmee niet "ons bestaande vlak
aansluiten" maar een nieuw meetvlak. Het is een goed idee en waarschijnlijk een
echte differentiator; het is alleen geen stap weg.

---

## 9. De volgorde

Wat eerst moet, is wat de rest mogelijk maakt — niet wat het aantrekkelijkst is.

| | wat | waarom hier |
|---|---|---|
| **1** | de makersmeting (`scripts/makers.js`) | beslist of "één familie" een laag of een samensmelting is, vóórdat er code op die aanname staat |
| **2** | brugklant + CSP los, foutmodel heel | vier bestanden; alles hierna leunt erop |
| **3** | `rtg check` (met de derde uitslag) | grootste winst per regel, en vraagt geen inlog |
| **4** | `rtg dev` op de echte brug | de ontbrekende lokale ervaring |
| **5** | SDK, typings, `rtg new` | pas zinvol als 2 t/m 4 staan |
| **6** | ontwikkelaarsidentiteit (niveau individueel) | opent de deur voor wie geen zaak is; het besluit uit 6.1 hoort hier |
| **7** | entitlements → interne apps | de beste verhouding waarde/risico van alles in par. 6 |
| **8** | retry-semantiek over de gemeten routes | voorwaarde voor alles in par. 7, niet een punt erna |
| **9** | console, observability, kostenvlak | zodra er iets draait dat waargenomen moet worden |
| **10** | runtime (functies, jobs, data) | eigen document, eigen bewijslast |

**Stap 1 kost het minst en beslist het meest.** Elke stap daarna is
omkeerbaar; het projectmodel is dat niet.

---

## 10. Wat dit document niet is

Geen toezegging dat alles hierboven wordt gebouwd, en geen volgorde die vastligt
buiten par. 9. Wat het wel is: de plek waar de vier bestaande makersroutes voor
het eerst als één ding worden beschreven, mét de grenzen die ze al hebben.

De drie beloftes eronder mogen pas op een scherm staan als ze waar zijn:

- voor de amateur — *als je het kunt beschrijven, kun je eraan beginnen*
- voor de professional — *RTG doet het platform, jij doet het product*
- voor enterprise — *snel werken zonder de controle af te staan*

En de algemene, die alleen waar wordt als niveau 3 bestaat:

> **Start simple. Never outgrow RTG.**
