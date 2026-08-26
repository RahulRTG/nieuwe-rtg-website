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

## De hoofdregel

Alles in dit document hangt aan één zin, en die zin is er gekomen nadat een
eerdere versie van dit plan bijna acht zelfstandige makers tot één technische
familie had uitgeroepen:

> **RTG Create verenigt vindbaarheid, identiteit, publiceren, bewijs en de
> makerservaring — nooit domeinbetekenis zonder gemeten overlap.**

Create maakt de ERVARING uniform, niet noodzakelijk de implementatie. Dat
onderscheid is geen nuance maar de hele architectuur: het is het verschil tussen
een laag die het huis samenhang geeft en een laag die vier werkende producten
tot één gemiddelde vermaalt.

De kortste vorm ervan, en meteen de belofte aan een maker:

> *RTG voelt als één platform zonder te doen alsof alles erin hetzelfde is.*

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
verschijnen.** Een makerslaag die dingen belooft die er niet zijn, wordt door
makers als eerste doorgeprikt.

---

## 1. De grondwet van Create

Zeven regels. Ze gaan over hoe een mens dit huis ervaart en niet over hoe het
van binnen is gebouwd — dat is precies waarom ze in dit document staan en niet
in `ARCHITECTUUR.md`. Bij elke regel staat wat hem vandaag handhaaft, en waar
dat nog niemand is, staat dat er ook.

**CREATE-01 — Elke maker is bereikbaar vanaf één maakvlak.**
Eén ingang met één vraag: *wat wil je maken?* Geen keuze vooraf tussen
webontwikkelaar, appbouwer of automatiseerder. *Handhaver: nog niets — dit is
het eerste dat gebouwd moet worden.*

**CREATE-02 — Een gedeeld scherm betekent geen gedeelde domeinbetekenis.**
Twee makers onder dezelfde ingang delen daarmee geen datamodel, geen opslag en
geen werkstroom. *Handhaver: `PLATFORM.md` par. 0b, en de meting uit par. 3
hieronder.*

**CREATE-03 — Een gedeeld model vraagt gemeten semantische overlap.**
Niet een gedeelde naam, niet een gedeeld gevoel: een meting. *Handhaver:
`scripts/objectmodel.js` + `OBJECTMODEL.json` hielden `Asset` tegen;
`scripts/makers.js` + `MAKERS.json` doen het voor de makers, met
`test/makers.test.js` eronder.*

**CREATE-04 — Eenvoudig maken toont alleen veilige standaarden.**
Wie op niveau 1 begint, kan niets kiezen dat hem later in de problemen brengt.
Diepte is beschikbaar, niet verplicht. *Handhaver: de Website-maker doet dit al
— beeld komt uit eigen bronnen, adressen worden geschoond, grenzen zijn gerekend.*

**CREATE-05 — Professionele diepte komt erbij zonder migratie.**
Een project dat op niveau 1 begon, gaat naar 2, 3 en 4 zonder opnieuw te
beginnen en zonder van identiteit te wisselen. *Handhaver: nog niets voor apps;
voor websites is dit aantoonbaar (zie par. 3).*

**CREATE-06 — Publiceren is altijd een uitdrukkelijke handeling.**
Niets komt naar buiten omdat er iets is bewaard. *Handhaver: `managerOnly` op de
zaakkant, `kern/webmaker-publiceren.js`, het menselijke besluit in
`kern/appstore/besluit.js`.*

**CREATE-07 — De AI stelt voor; een mens legt vast waar het productcontract dat
eist.**
*Handhaver: `kern/webmaker-ai.js` slaat niets op, `kern/onderneming/ontwerper.js`
schrijft niets weg, `kern/appstore/besluit.js` weigert een handtekening van de
uitgever zelf. De grens zelf staat in `CLAUDE.md` (de AI belooft nooit toegang)
en `GELD.md` par. 3 (klaarzetten is de bovengrens).*

---

## 2. De vier routes die er vandaag al zijn

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
gebruikt.**

---

## 3. Waarom dit een laag is en geen samensmelting

`PLATFORM.md` par. 0b stelt de toetsvraag bij alles wat "erbij" of "eraf" moet:

> **Is dit een zelfstandige professionele capability, of is dit slechts een
> andere ingang naar dezelfde capability?**
>
> Alleen in het tweede geval samenvoegen. In het eerste geval **een laag
> erboven**.

Die regel is er gekomen na Cercle en Entourage: twee apps die identiek KLONKEN
en bij onderzoek totaal verschillende data en werkstromen bleken te hebben.
Dezelfde meting is later herhaald over de hele codebase: van 1140 bewaarde
vormen in 216 domeinen horen **1179 van de 1661 velden (71%) bij precies één
domein**, en `Asset` bestaat niet.

De formule die daaruit volgt, geldt voor heel Create:

> **Gedeelde ingang, zelfstandig domein.**

Create → Nieuw → Les opent de Lesmaker. Zelfde ingang, zelfde identiteit,
mogelijk dezelfde publicatiestroom — en daarachter een eigen model dat niemand
in een vreemde taal probeert te drukken.

### Waar de overlap wél bewezen is

**Website-maker en Website-studio delen een kern.** Allebei draaien ze op
dezelfde bloktaal; de studio zet sjablonen in een etalage die de maker als
startpunt leest. Twee ingangen naar dezelfde capability. Samenvoegen mag.

### En daarbinnen loopt de naad ergens anders dan hij lijkt

Het ligt voor de hand om de veertien bloktypen van de maker te lezen als *tien
consumentenblokken plus vier zakelijke*. **Dat klopt niet, en het verschil is
belangrijk genoeg om er een developer-oppervlak op te bouwen of juist niet.**
Gemeten in `kern/webmaker-schoon.js` en `kern/webplatform.js` zijn er drie
klassen:

| klasse | blokken | wat het is |
|---|---|---|
| **inhoud** | hero, kop, tekst, knop, beeld, kolommen, galerij, citaat, ruimte, voettekst, faq, prijzen (12) | wat de maker zelf invult; staat er zoals hij het achterliet |
| **view** | `zaakdata` (1) | wijst een BRON aan en wordt bij elk bezoek opgelost uit het zaakprofiel |
| **handeling** | `formulier` (1) | doet iets, en bestaat alleen als er een ONTVANGER is |

`faq` en `prijzen` zijn dus geen zakelijke blokken — een lid dat iets verkoopt,
gebruikt ze net zo goed. Het enige echt zakelijke blok is `zaakdata`, en dat is
ook het enige blok dat een tweede waarheid raakt.

Twee gedragingen die daaruit volgen en die precies de "views, geen kopieën"-wet
zijn:

- Een `zaakdata`-blok op een site zonder zaak **valt stil weg** in plaats van als
  lege doos te blijven staan — behalve `bron: 'salon'`, want Salonbeeld is van
  het huis en niet van een zaak, en lost dus ook op een ledensite op.
- Een pagina die alléén live blokken droeg en waarvan niets overbleef,
  **verdwijnt uit de site**. Anders staat "Werken bij ons" in de navigatie van
  een zaak zonder vacatures, en dat is een deur naar een lege kamer. Pagina's die
  de maker zelf vulde blijven altijd staan, ook leeg — die laten verdwijnen zou
  hem overvallen.
- Een `formulier` zonder ontvanger wordt niet getoond, want anders is het een
  knop die stilletjes niets doet.

**Dat is de juiste indeling voor een `rtg.web.blocks`-oppervlak.** Een blok van
een derde zou moeten verklaren tot welke klasse het hoort, en de derde klasse —
een blok dat iets DOET — is precies waar machtigingen aan hangen. Een indeling in
consument/zakelijk had die vraag nooit gesteld.

### De meting is gedaan. Dit kwam eruit.

`scripts/makers.js` meet acht makers over 56 bestanden langs vijf dimensies:
vorm (bewaarde velden na aftrek van de envelop), **taal** (gesloten
woordenschatten), opslag (`db.data`-sleutels), publicatie (welke stappen van de
levensloop) en poort (achter welke inlog). De extractie komt uit
`scripts/objectmodel.js` en de envelop wordt daar overgenomen — een tweede manier
om een vorm te lezen is een tweede manier om hem verkeerd te lezen. De uitkomst
staat in `MAKERS.json`.

```
8 makers, 56 bestanden, 17 bewaarde vormen na aftrek van de envelop
28 paren onderzocht; 1 met een gedeelde kern (drempel 0,60)

JA   websitemaker <-> websitestudio    taal 0,71   vorm 0,22
     beeld citaat galerij hero knop kolommen kop ruimte tekst voettekst
NEE  websitemaker <-> clips            taal 0,09   vorm 0,07
NEE  al het andere                     0,00
```

**Precies één paar deelt een kern, en het is het paar dat je bij het lezen al
zag.** Al het andere zit op nul. Dat is geen zwak resultaat maar het antwoord:
RTG Create is een laag over zelfstandige makers, en er hoort geen gedeeld
projectmodel te komen.

*Waarom er een tweede dimensie bij moest.* De eerste versie mat alleen vorm en
gaf Website-maker ↔ Atelier **0,22** — terwijl die twee aantoonbaar dezelfde
bloktaal spreken. Die taal woont niet in een bewaarde vorm maar in
`TYPES = ['hero','kop',...]`. Een meter die daarnaast kijkt, zegt "nee" op de
goede vraag om de verkeerde reden, en dat is erger dan geen meter.

*En waarom het bewijs ertoe doet.* Toen de taaldimensie er eenmaal was, haalde
het paar de drempel — maar met als bewijs `['id','type','verberg','varianten']`,
een uitsluitlijstje dat in beide bestanden woordelijk staat en dus 1,00 scoort.
Het oordeel klopte en het bewijs was waardeloos. Nu wint onder de paren die de
drempel halen die met de **meeste gedeelde woorden**. Beide vallen staan als
toets in `test/makers.test.js`.

**Wat vier makers delen, is een projectmodel. Wat er twee delen, is een
toevalligheid met een mooie naam.** Er zijn er twee, en ze delen een formaat —
geen projectmodel. Dezelfde discipline waarmee `Asset` is voorkomen.

---

## 4. De ladder

Vier niveaus, één onderliggende software. De belofte is controleerbaar:
**hetzelfde project moet door alle vier de ingangen te bekijken zijn.**

| niveau | wat de mens doet | wat er vandaag al voor staat |
|---|---|---|
| **1 — Create** | beschrijft het ("maak een website voor mijn hotel") | de automatische bedrijfssite uit het zaakprofiel; de AI-knop in de maker |
| **2 — Builder** | bouwt visueel: pagina's, blokken, regels | de Website-maker en de Website-studio |
| **3 — Studio** | schrijft code: SDK, CLI, schema's, events | niets — dit is fase 4 van DEVELOPERCLOUD.md |
| **4 — Engineering** | teams, omgevingen, uitrol, governance | `kern/tenant/`, SSO, SCIM, het bewijsmodel |

### De Website-maker is de eerste volledige demonstrator

Niet omdat websites het belangrijkst zijn, maar omdat de overlap daar **bewezen**
is en de ladder er dus vandaag al bijna helemaal staat:

| | wat een mens daar doet | staat het? |
|---|---|---|
| amateur | blokken slepen, kleuren kiezen | ja |
| AI | "maak het luxer", "voeg een pagina voor bruiloften toe" | ja — en het bewaart niets, de mens bevestigt |
| professioneel | het ontwerpbureau beheert sjablonen in de Studio | ja |
| ontwikkelaar | eigen blokken via `rtg.web.blocks` | nee — dit is het eerste echte stukje niveau 3 |
| enterprise | merkuitrol over honderden vestigingen | ja |

Eén ontbrekend blokje in een verder complete ladder is een veel beter eerste
doelwit dan een generieke app-bouwer. **Maak dit het referentieproduct van
Create**, en de belofte "start simple, never outgrow RTG" is te demonstreren in
plaats van te beweren.

---

## 5. Wat er STAAT

Per punt het bestand dat het doet.

- **Isolatie.** Derdencode in een naamloze herkomst, eigen CSP, `connect-src
  'none'`, integriteit bij elke lezing — `routes/appstore/cel.js`.
- **Machtigingen met een doel.** Drie machtigingen, elk met een gesloten lijst
  doelen; een machtiging zonder doel wordt geweigerd — `kern/appstore/machtigingen.js`.
- **De vergunningsdiff.** Een versie die meer vraagt, vraagt opnieuw —
  `kern/appstore/besluit.js`.
- **De brug.** Zes methodes, en de brug leest wat het lid VERLEENDE, niet wat het
  manifest vroeg — `kern/appstore/brug.js`.
- **Grenzen die gerekend worden en niet vertrouwd.** 32 sleutels, 4 kB per
  waarde, 64 kB totaal, 5 berichten per dag, 120 aanroepen per minuut.
- **Een poort die uitlegt.** Per bestand én per regel wat er is en hoe het wél
  kan — `kern/appstore/keuring.js`, `verboden.js`.
- **Een proefkeuring.** Dezelfde poort, niets bewaard, geen rem.
- **Onveranderlijke bundels.** Hash in het pad, immutable, integriteit per
  lezing — `kern/appstore/bundel.js`.
- **Geld.** Prijs in het manifest, btw in het land van het lid, afdracht,
  payout, teruggaverecht.
- **Publiceren met een weg terug.** Versiegeschiedenis, herstellen, plannen,
  spoor.
- **Views in plaats van kopieën.** Live zaakdata-blokken, opgelost bij bezoek.
- **Enterprise.** SAML, OIDC, SCIM, contract, quota, uitgang, bewijspoort.
- **Het inkoopdossier.** Per bewering een bron in de code, plus een blok "wat dit
  dossier NIET zegt".

En sinds P0/P1 (zie par. 11):

- **De makersmeting.** `scripts/makers.js`, `MAKERS.json`, `test/makers.test.js`.
- **De gebeurtenisenvelop.** Dertien velden, geen domeinkennis — `kern/envelop.js`.
- **De mutatiesemantiek.** Zes klassen, en een poort die `onbekend` weigert aan
  de rand van het platform — `kern/mutatie.js`. De zes brugmethodes zijn
  geclassificeerd; een zevende zonder klasse laat de brug niet opbouwen.
- **Eén foutentaal.** Stabiele codes, en een weigering die heel aankomt tot in de
  cel — `kern/platformfout.js`, `kern/appstore/brugklant.js`.
- **Het gereedschap.** `rtg new`, `rtg check`, `rtg dev`, `rtg sdk` —
  `scripts/rtg*.js`, zonder inlog en zonder de server te raken.

---

## 6. De ontwikkelaarsingang — gebouwd

Dit was fase 4 van DEVELOPERCLOUD.md. Zes punten, en ze staan er alle zes. Ze
blijven hier staan met hun reden erbij, want wie ze verandert hoort te weten
waarom ze zo zijn.

**1. Eén brugklant, één CSP** — `kern/appstore/brugklant.js`.
Ze stonden als tekenreeks in `routes/appstore/cel.js`. Dat werkte zolang de cel
de enige lezer was; `rtg dev` is de tweede. Een kopie ernaast loopt een keer
uiteen, en dan is de fout die een uitgever ziet *"werkt lokaal, geblokkeerd in de
cel"* — precies de ervaring die dit kanaal niet moet geven (LAT-regel 4). De
bestaande CSP-bewaker in `test/appstore-cel.test.js` is meeverhuisd en rekent er
nu ook na dát de cel hem daar vandaan haalt.

**2. Eén foutentaal** — `kern/platformfout.js`.
De brug schreef bij een weigering al vier dingen op: welke machtiging nodig was,
wat het lid WEL gaf, wat het manifest vroeg, en hoe het op te lossen is. Dat
bereikte niemand — `appcel.html` maakte er `new Error(d.error)` van en stuurde
alleen `err.message` de cel in. Nu draagt elke weigering een stabiele code en
komt alles heel aan als `RTGFout` met velden. `uitgezondenDoor` in de codetabel
wijst het bestand aan en wordt nagerekend, dus een code die niets kan produceren
valt om. Wat er géén code heeft, staat in `NOG_GEEN_CODE` mét de reden.

**3. `rtg check`** — de echte poort, op je eigen machine.
`keur()` was al puur, dus de CLI require't hem in plaats van hem na te bouwen:
dezelfde verbodenlijst, hetzelfde budget, dezelfde regelnummers. Eén obstakel
moest worden opgelost: zonder virusscanner gaf `keur()` `door: false`, wat op de
server juist is en in een CLI elke bundel afkeurt om een reden die de bouwer niet
kan oplossen. Er zijn nu **drie uitslagen**: vorm in orde of blokkeert, virusscan
*niet uitgevoerd*, keuring *niet vast te stellen* (BESTUUR.md — een eersteklas
uitslag naast in orde en storing). Op de server blijft `eisScan` op `true` en
verandert er niets.

**4. `rtg dev` draait de ECHTE brug** — `scripts/rtg-dev.js`.
`maakBrug()` heeft alleen `{S, save, nu, boek, eigen}` nodig, dus een opslag in
het geheugen levert de echte brug met de echte grenzen: 32 sleutels, 4 kB per
waarde, 64 kB totaal, 5 berichten per dag, 120 aanroepen per minuut. Die getallen
staan nergens in de CLI — ze komen uit `brug.GRENS`. Een emulator die ze nábouwt,
liegt vroeg of laat over precies de grens waarop een app stukloopt.

En hij doet **nooit alsof een capability bestaat die er niet is**. Een aanroep
die in productie weigert, weigert hier met dezelfde tekst, dezelfde code en
hetzelfde alternatief. Een machtiging is met een vinkje in te trekken — juist die
weg is de weg die niemand test.

**5. SDK en typings, gegenereerd** — `scripts/rtg-sdk.js`.
Uit `METHODES`, `kern/mutatie.js`, `machtigingen.js`, `platformfout.js`,
`GRENS` en `BUDGET`. Een handgeschreven `.d.ts` loopt uit de pas op de dag dat er
een zevende methode bij komt; een toets zakt als de vormenlijst achterloopt. De
mutatieklasse staat per methode in de typings én in de documentatie, want dat is
wat een taakloper moet lezen.

**6. `rtg new`** — een app die zijn eigen `rtg check` doorkomt.
Dat laatste is een toets, en hij ving meteen iets: het eerste sjabloon noemde
`fetch()` in een **commentaarregel**, en de poort leest regels zonder commentaar
af te strijken. Dus blokkeerde `rtg new` gevolgd door `rtg check`. Dat is streng
en het is de goede kant om streng te zijn — een lijst die je omzeilt door je
aanroep in een string te zetten, is geen lijst.

**Wat er met opzet niet in zit: inzenden.** `rtg check` en `rtg dev` vragen geen
inlog en raken de server niet. Inzenden blijft op `/apps/appstore-uitgever.html`,
want daar hangt een uitgeversplek aan een organisatie. Zo hoeft niemand een BV te
hebben om te kunnen bouwen — en het identiteitsvraagstuk uit par. 7.1 hoefde niet
eerst te worden opgelost om dit te kunnen leveren.

### `NIET_GEBOUWD` wordt documentatie

De meeste platforms documenteren alleen wat bestaat. Dit huis heeft al een lijst
van wat er met opzet níét is, mét de reden (`kern/appstore/machtigingen.js`).
Die hoort in de ontwikkelaarsdocumentatie te staan onder zijn eigen kop —
**Bewust niet beschikbaar** — met per regel: status, reden, het beschikbare
alternatief, en de voorwaarde waaronder het ooit wél kan.

Dat is geen zwaktebod maar het tegendeel: het laat zien dat een ontbrekende API
geen vergeten werk is. En het is het enige eerlijke antwoord op de vraag die
iedere ontwikkelaar toch stelt.

---

## 7. Vraagt een besluit

### 7.1 Ontwikkelen zonder eerst bedrijf te zijn

Vandaag loopt inzenden via `supplierAuth`, en de uitgeversplek eist een
organisatie: *"Een app in de officiële App Store heeft een aanspreekbare
rechtspersoon achter zich."* Een student met een goed idee komt er dus niet in.

De uitweg is een ladder van identiteiten, zonder een vijfde identiteitsbegrip:

| niveau | mag |
|---|---|
| **individueel** | bouwen, lokaal draaien, een besloten preview delen |
| **geverifieerd** | idem, plus publiceren van gratis apps |
| **commercieel** | betaald distribueren (rechtspersoon, bank, fiscaal) |
| **enterprise** | teams, SSO, SCIM |

> **Bouw vrij; publiceer naar risico.**

**Het besluit zit op de tweede regel, niet op de eerste.** Bouwen en lokaal
draaien vragen geen enkele identiteit — dat kan morgen, want `rtg check` en
`rtg dev` raken de server niet. Maar zodra code van een natuurlijk persoon voor
een LID draait, staat er geen aanspreekbare partij meer achter.

### 7.2 De capabilities die vandaag met een reden NIET bestaan

Vijf staan in `machtigingen.NIET_GEBOUWD` **met een reden**, en die redenen zijn
geen achterstand:

| gevraagd | wat er nu staat |
|---|---|
| `payments.request` | geld verlaat het huis nooit vanzelf (GELD.md par. 3) |
| `calendar.read` | er is geen leesweg die een codenaam niet terugvoert op een mens — een afspraaktitel bevat namen |
| `files.pick` | de bestandenlaag kent delen per persoon en per zaak, niet per app; een vierde deelmodel is LAT-regel 4 |
| `location.approximate` | zolang er geen intrekbare, zichtbare en tijdgebonden vorm van staat, komt er geen ruwe vorm van |
| `notifications.send` | **push onderbreekt.** Een derde krijgt geen kanaal dat een telefoon laat trillen |

De laatste is geen technische schuld maar een merkbesluit.
`bericht.klaarzetten` bestaat juist als de niet-onderbrekende vorm.

**Elke capability die erbij komt, komt erbij door zijn reden op te lossen — niet
door hem op een lijst te zetten.**

### 7.3 Uitgaand netwerk, connectors, en eigen backend

`connect-src 'none'` is strenger dan een hostlijst, en dat is een andere
aankoop: *zolang een app niets kan versturen, hoeft niemand te bewaken wát hij
verstuurt.* Connectors met een expliciete uitgaande binding (welke partij, welk
land, welke dataklasse, welke toestemming) zijn de juiste vorm als het toch moet;
"Bring Your Own Backend" is diezelfde beslissing in zijn duurste vorm, want dan
is de uitgaande weg de normale weg. **Eén besluit met twee gezichten.**

### 7.4 Agents als publiceerbaar producttype

Een inkoopagent met `purchase.draft` en zonder `payment.execute` is exact
"klaarzetten", en dat is de bovengrens die GELD.md par. 3 al trekt. Wat een
besluit vraagt is niet de agent maar zijn **duur**: tijdelijk, begrensd,
intrekbaar, met een spoor. Een agent met een permanente machtiging is het niet.

### 7.5 Private apps via entitlements

De private catalogus is geweigerd omdat hij zou vragen welk LID bij welke
ORGANISATIE hoort — een antwoord dat hier al twee keer bestaat (CONCERN.md,
TENANT.md). Een derde lezing erbij is LAT-regel 4.

**Entitlements lossen dat op zonder derde register.** De catalogus vraagt niet
*waar werkt deze persoon* maar *heeft deze actor entitlement X*, en de
identiteitslaag blijft gezaghebbend. Interne apps worden mogelijk zonder de
privacyarchitectuur te breken.

Het patroon is breder toepasbaar — `site.template.luxury`, `app.beta.8271`,
`developer.preview` — maar dat is een tweede stap, en CREATE-03 geldt ook hier:
één distributiemechanisme mag pas als de semantiek aantoonbaar dezelfde is.

### 7.6 De afdracht

Staat op 0%, en dit huis belooft partners "RTG rekent 0% commissie". Elke
marketplace-economie hierboven gaat ervan uit dat er iets te verdelen valt. Van
0% naar iets is een verandering van een bestaande belofte.

---

## 8. Jaren weg

- **Serverside functies, cron, jobs, managed data, realtime.** Vandaag draait
  derdencode uitsluitend in de browser van het lid. Zodra `onOrderCreated(event)`
  bij ons draait, verandert het dreigingsmodel volledig. Eigen document, eigen
  bewijslast (DEVELOPERCLOUD.md par. 3.4).
- **Event-platform voor derden.** Eerst de envelop (par. 10), dan pas abonneren.
- **SDK's in vijf talen uit één contract.** Zinvol zodra het contract er is.
- **Visuele app-bouwer en conversation-to-app.** Niveau 1 en 2 voor apps in
  plaats van sites. De Website-maker bewijst het patroon; de sprong zit in wat
  een app IS zonder eigen runtime.

---

## 9. Drie aannames die de code niet steunt

Deze staan apart omdat ze de volgorde veranderen, en omdat een plan dat leunt op
iets wat er niet is, het duurst is op het moment dat iemand erop bouwt.

### 9.1 Magnaat is een leerspel — en hoort uit de ontwikkelaarsroute

`kern/magnaatwereld.js` opent met: *"een spelopdracht roept NOOIT een
productie-endpoint aan. Elke functie wordt vertaald naar een trainingskopie met
synthetische data."* Magnaat is een kantoor- en ondernemersgame waarin een MENS
oefent — trainingslobby, werkroutes, economenlab, partnerstudio.

**Er zit geen motor in die een app van derden met synthetische gebruikers
bestookt, en die naam hoort dus niet in de ontwikkelaarsroute.** "Test in
Magnaat" zou semantisch misleidend zijn: het belooft een testomgeving en levert
een leerspel.

De twee begrippen blijven daarom strikt uit elkaar:

| | wat het is |
|---|---|
| **Magnaat** | de spel- en trainingswereld, voor mensen |
| **RTG Forge** | de geautomatiseerde beproevingsomgeving, voor software |

De naam Forge is van de eigenaar en mag veranderen; **de scheiding niet.** Wat er
al staat om Forge mee te beginnen, staat er echt: `scripts/aanval.js` (een
aanvalsronde tegen een draaiende server, mét de eerlijke kanttekening dat het
geen onafhankelijke pentest is) en `scripts/chaos.js` (een server omleggen en
meten of de rest het overneemt). Daar hoort `rtg break` te beginnen — niet in
Magnaat. Magnaat kan later scenario's aanleveren; het is niet dezelfde motor.

### 9.2 De keuring kijkt niet naar toegankelijkheid

`kern/appstore/keuring.js` controleert bestandssoort, budget, verboden vormen,
externe verwijzingen en de virusscan. Meer niet. De a11y-machinerie
(`scripts/a11y.js`, `test/a11ykeuring.test.js`) draait over onze eigen schermen
en heeft nooit een derdenbundel gezien.

**Bouw daar geen tweede stack voor.** Wat ontbreekt is een adapter: derdenbundel
→ gerenderd testoppervlak → de bestaande machinerie → bewijs bij de app. Dan
wordt een machine die er al staat breder inzetbaar, en past het naadloos in een
poort die toch al per regel uitlegt hoe het wél kan.

### 9.3 Er is geen kostenvlak

Er is geen laag die kosten per app, per gebruiker of per functie bijhoudt. Wat er
is: `scripts/duurzaamheidskosten.js` (één meting), `kern/servicekosten.js` en
`kern/pasprijs.js` (prijzen aan leden), en `kern/magnaat-economie.js` (de
spel-economie). Kostenvoorspelling per uitrol is een nieuw meetvlak — een goed
idee, maar geen stap weg.

---

## 10. Mutatiesemantiek: geclassificeerd, niet idempotent

`IDEMPROEF.json` meet wat er gebeurt als een route twee keer wordt aangeroepen:
van **3074 routes met een rol** zijn er **115 beoordeeld, 15 beschermd, 100
onbeschermd en 2959 ongemeten**. Het bestand zegt er zelf bij dat "onbeschermd"
een telling is en geen defect-oordeel — en dat is juist. Het getal dat ertoe doet
is 2959.

**Maar het doel is niet 3074 van 3074 idempotent. Het doel is 3074 van 3074
geclassificeerd.** Een mutatie mag bewust niet veilig herhaalbaar zijn; dat moet
alleen uitgesproken zijn, zodat de SDK, de taakloper, de client en een
werkstroommotor weten wat ze ermee moeten.

Zes klassen:

| klasse | betekenis |
|---|---|
| `IDEMPOTENT` | herhalen is gratis |
| `IDEMPOTENCY_KEY_REQUIRED` | herhalen mag mét sleutel |
| `AT_MOST_ONCE` | nooit automatisch herhalen |
| `COMPENSATABLE` | herhalen mag, terugdraaien bestaat |
| `NON_REPEATABLE` | herhalen is per definitie een tweede gebeurtenis |
| `UNKNOWN` | niet vastgesteld |

En de poort die het bruikbaar maakt: **`UNKNOWN` is verboden voor elke nieuwe
publiek aanroepbare ontwikkelaarsopdracht.** Niet met terugwerkende kracht over
2959 routes — dat is jarenlang werk — maar vanaf nu, aan de rand waar het
ontwikkelaarsplatform begint. Zo groeit de dekking mee met wat naar buiten gaat,
in plaats van dat een megaproject vooraf moet slagen.

Dit is de reden dat cron, jobs en functies in bak vier staan: retries bovenop een
laag waarvan de herhaalbaarheid grotendeels ongemeten is, vermenigvuldigen een
bestaand gat in plaats van een functie te leveren.

### De envelop deelt vorm, geen betekenis

Hetzelfde principe geldt voor gebeurtenissen, en het is precies CREATE-02 in zijn
technische vorm. Eén envelop — `event_id`, `type`, `schema_version`, `actor`,
`subject`, `organization`, `purpose`, `occurred_at`, `correlation_id`,
`causation_id`, `classification`, `source`, `payload` — en daarbinnen betekent
`website.published` iets totaal anders dan `message.prepared`. **De envelop is
verpakking; de payload is domein.** Dat is dezelfde scheiding die
`OBJECTMODEL.json` al maakte toen hij 35 velden als envelop aanwees.

---

## 11. De volgorde

| | fase | wat |
|---|---|---|
| **P0** ✅ | corrigeren | makersmeting (`scripts/makers.js` + `MAKERS.json`); de gebeurtenisenvelop (`kern/envelop.js`); mutatieclassificatie met `onbekend` verboden aan de rand (`kern/mutatie.js`) |
| **P1** grotendeels | de ingang voor ontwikkelaars | ✅ brugklant + CSP los; ✅ het foutmodel heel; ✅ `rtg check`, `rtg dev`, `rtg new`, `rtg sdk` — **open:** de individuele ontwikkelaarsidentiteit (par. 7.1), want die vraagt een besluit en geen code |
| **P2** | zichtbaarheid | console; documentatie inclusief *bewust niet beschikbaar*; machtigingenverkenner; logs en traces; toegankelijkheid in de derdenkeuring |
| **P3** | distributie | private apps via entitlements; previews en beta; de vergunningsdiff als uitgave-primitief; snellere review waar het risico dat toelaat |
| **P4** | RTG Forge | `aanval.js` + `chaos.js` tot één beproevingshal; app-gerichte adversariële tests; replay; regressiebewijs |
| **P5** | serverside platform | functies, jobs, cron, managed state, gecontroleerd netwerk — pas als P0's mutatieclassificatie het draagt |

**P0 kostte het minst en besliste het meest.** De makersmeting gaf één paar met
een gedeelde kern van de achtentwintig, en daarmee ligt de vorm van Create vast
voordat er een regel schil op stond. Elke stap daarna is omkeerbaar; het
projectmodel en de gebeurtenistaal zijn dat niet.

Wat P1 nog open laat is met opzet geen code: **wie mag er publiceren zonder
rechtspersoon** (par. 7.1). Bouwen en lokaal draaien vragen vandaag geen enkele
identiteit, dus dat besluit hield het gereedschap niet tegen — het houdt alleen
tegen dat wat je bouwt bij een lid terechtkomt.

---

## 12. Wat dit document niet is

Geen toezegging dat alles hierboven wordt gebouwd, en geen volgorde die vastligt
buiten par. 11. Wat het wel is: de plek waar de vier bestaande makersroutes voor
het eerst als één ding worden beschreven, mét de grenzen die ze al hebben.

De drie beloftes eronder mogen pas op een scherm staan als ze waar zijn:

- voor de amateur — *als je het kunt beschrijven, kun je eraan beginnen*
- voor de professional — *RTG doet het platform, jij doet het product*
- voor enterprise — *snel werken zonder de controle af te staan*

En de algemene, die alleen waar wordt als niveau 3 bestaat:

> **Start simple. Never outgrow RTG.**
