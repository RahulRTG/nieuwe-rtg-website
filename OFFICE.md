# RTG Office Next — van editors naar werk

*Richtingsdocument, 23 september 2026. Zelfde vorm als `PLATFORM.md`,
`ECONOMIE.md` en `PLANNING.md`: per onderdeel staat erbij of het **staat**,
**een stap weg** is, **een besluit vraagt** of **jaren weg** is, zodat niemand
die vier voor elkaar aanziet.*

De ambitie van de eigenaar, in één zin: **alles wat een bedrijf dagelijks van
Microsoft 365 of Google Workspace verwacht is er, maar RTG maakt van documenten,
data, communicatie, processen, AI en bedrijfssoftware één systeem.** Niet Office
2024 nabouwen. De markt beweegt naar live, AI-native en programmeerbare
werkobjecten (Loop-componenten, Copilot Pages, Gemini over apps heen, Sheets
Canvas), en een kopie van de klassieke bestandssuite is af op de dag dat hij
achterloopt.

Dit document neemt die ambitie over en legt er drie dingen onder die uit de code
komen en niet uit het voorstel:

1. **Wat er al staat.** Van de 26 punten bestaat een groot deel al onder een
   andere naam, meestal buiten Office. Het werk is vooral aansluiten.
2. **Wat gemeten moet worden voordat het gebouwd wordt.** Het dragende punt,
   het universele objectmodel, is gemeten (par. 0), en de uitslag verandert het
   ontwerp.
3. **Wat er vandaag onder het voorstel ontbreekt.** Het grootste gat is geen
   functie. Het is dat een tekstdocument hier geen model heeft (par. 1).

Par. 0 tot en met 5 gaan over de eerste 26 punten. Par. 6 tot en met 9 gaan over
de punten 27–150, en brengen ze op verzoek van de eigenaar terug tot vijftien
platformen met een afhankelijkheidsgraaf en een bouwvolgorde.

---

## 0. De meting: is er een `RTGObject`?

Het voorstel in par. 2 van de opdracht is een Universal RTG Object Model: document,
tabel, taak, persoon, bedrijf, goedkeuring, handtekening, betaling, boeking,
afspraak en workflow worden subtypen van één `RTGObject` met een gedeelde kop
van vijftien kenmerken. Dat is exact de vorm waarin in dit huis `Asset`,
`Koopbaar`, `Career`, `Moment`, `Ontdekking`, `Manier` en de planningsgrond al
sneuvelden (`DEVELOPERCLOUD.md` par. 2: *een universeel objectmodel moet worden
GEVONDEN in de domeinen, niet eroverheen verklaard*). Dus is het eerst gemeten:
`npm run officevorm` (`OFFICEVORM.json`), op de lezer van
`scripts/objectmodel.js` zodat het getal naast de vorige ligt, en over twee
domeinlijsten zodat de uitslag niet op de lijst drijft.

**Uitslag over <!--getal:officevorm.domeinen-->11<!--/getal--> objectdomeinen: <!--getal:officevorm.inAlle-->0<!--/getal-->
van <!--getal:officevorm.velden-->144<!--/getal--> velden in álle domeinen**, 0 in zelfs maar de helft, en
**<!--getal:officevorm.domeineigenPct-->95.1<!--/getal-->% in precies één** (platformbreed is dat 71%). Op de smalle lijst is
dat 0 en 100%, en geen enkel paar deelt ook maar één veld. Het meest verwante
paar op de ruime lijst (afspraak en workflow) deelt precies `gedaan`. De meter
is een mutatie aangedaan en bewoog: versmald tot dat paar slaat de conclusie om.

De tweede as vraagt welke van de vijftien voorgestelde kenmerken een domein
vandaag al draagt, onder welke naam dan ook. Lexicaal, dus graad `vermoed` en
een ondergrens:

| kenmerk | domeinen die het dragen | | kenmerk | domeinen die het dragen |
|---|---|---|---|---|
| id | 11 van 11 | | versie | 1 (document) |
| workflowstand | 8 | | inhoud | 1 (document) |
| eigenaar | 5 | | historie | 0 |
| relaties | 5 | | audit | 0 |
| schema | 4 | | AI-context | 0 |
| rechten | 3 | | bewaring | 0 |
| tenant | 2 | | versleuteling | 0 |
| classificatie | 2 | | | |

Twee kanttekeningen die er even groot bij horen. De lezer ziet geneste objecten
niet als eigen vorm, dus het `beheer`-blok van `kern/office/docs.js` (met
`bewaartermijn`) en het `audit[]` van een document tellen niet mee. Een nul op
deze as is dus geen afwezigheidsbewijs. En de eerste draai vond een valse
treffer (`sleutel` in `voornemen.js` is een idempotentiesleutel en geen
versleuteling). Die is eruit, met de reden erbij in de meter.

**Wat daaruit volgt, en dat verandert punt 2 en 3 van het voorstel:**

- **Er komt geen `RTGObject`-type en geen `objects`-tabel.** Een betaling, een
  boeking en een alinea delen niets buiten hun verpakking, en een type dat ze
  toch samenbindt dwingt elf domeinen in één schema dat van geen van hen is.
- **"Eén object, meerdere views" blijft wél staan, maar als VERWIJZING.** Een
  tabel uit een blad in een document is geen gedeeld subtype maar een blok dat
  naar het blad WIJST en bij elk openen wordt opgelost. Dat patroon draait hier
  al twee keer: de bloktaal van `CREATE.md` par. 3 (`zaakdata` is een VIEW, *wijst
  een bron aan en wordt bij elk bezoek opgelost*), en `kern/objectlaag/caps.js`,
  waar elke cap op een persoon, groep of event naar zijn eigen domein wijst en
  een cap zonder werkende bestemming niet in de catalogus komt.
- **De gedeelde kop is een ENVELOP en geen type.** De vijftien kenmerken zijn
  geen velden van het object maar vragen die het platform aan elk domein stelt:
  wie is de eigenaar, hoe gevoelig is het, hoelang blijft het. Dat is de vorm van
  `kern/envelop.js` (die met opzet nooit zegt WAT) en van de projectie in
  `kern/levensgraaf/graaf.js` (etiketten op informatie die in haar eigen domein
  blijft). Vier van de vijftien bestaan in geen enkel domein (historie, audit,
  AI-context en bewaring als eigen veld, versleuteling), dus daar is de kop niet
  te ontdekken maar moet hij per domein verklaard worden.

---

## 1. Het fundament dat onder het voorstel ontbreekt

**Een tekstdocument heeft hier geen model: het IS HTML.** `inhoud.tekst` is een
HTML-string (`kern/office/basis.js`, `schoonInhoud`), bewerkt met
`document.execCommand` op een `contenteditable` (`public/apps/office/tekst.js`).
`execCommand` is door de browsermakers opgegeven en doet per browser iets anders.

Dat klinkt als een uitvoeringsdetail en het is het tegenovergestelde. Vijf punten
van het voorstel hangen eraan:

| punt | waarom het niet op HTML kan |
|---|---|
| 4 wijzigingen bijhouden, vergelijken | een wijziging is een bewerking op een model; een verschil tussen twee HTML-strings is een tekstdiff zonder betekenis |
| 4 DOCX → RTG → DOCX | OOXML heeft stijlen, secties, velden en voetnoten; een HTML-string heeft er geen plek voor, dus verdwijnt het bij de eerste heen-en-weer |
| 8 live samen schrijven | een CRDT voegt bewerkingen op een structuur samen, niet op markup |
| 3 live blokken | een blok moet een knoop in het document zijn met een verwijzing, niet een `<div>` die iemand kan wegtypen |
| 10 Rahul begrijpt objecten | "deze tabel" moet een ding zijn met een adres, niet een stuk van een string |

**Het eerste bouwwerk van Office Next is dus een documentmodel** (blokken met
markeringen, zoals ProseMirror en de OOXML-body het allebei doen), per SOORT en
niet universeel: het tekstmodel, het bladmodel en het presentatiemodel zijn
drie modellen, want par. 0 zegt dat ze niets delen. Wat ze wél delen is de
schil eromheen: opslag, versies, delen, opmerkingen, classificatie en audit. Die
schil bestaat al en werkt voor alle zes de soorten (`kern/office/`).

Twee dingen die daarbij niet mogen sneuvelen:

- **De bestaande documenten gaan mee.** Er staan HTML-documenten in
  `db.data.officeDocs`. Een model dat ze niet inleest is een tweede product, geen
  opvolger. De importeur van HTML naar model is dus stap één van het model, niet
  een migratie achteraf.
- **Geen tweede opslag.** Het model wordt `inhoud` in dezelfde collectie, onder
  dezelfde `schoonInhoud`-poort. RTDocs (`voorzijde.js`) zegt het al: *zo ontstaan
  er geen tweede documentenmodel en geen schaduwversies naast RTG Office.*

---

## 2. Namen die al bezet zijn

Goedkoopste paragraaf van het document, en de duurste om over te slaan
(`OS.md`: twee bestanden met allebei een `VERMOGENS` en nul gedeelde leden).

| voorgestelde naam | al bezet door | voorstel |
|---|---|---|
| **RTG Workspace Engine** | `RTG-WORKSPACE-RUNTIME.md` (de Workspace Runtime is het productfundament; geen module bouwt een tweede shell, identiteit of permissielaag) en 22 bestanden met `workspace` in de naam | de laag onder Office Next heet **Office-kern**, en hij is een GEBRUIKER van de Workspace Runtime, nooit een tweede |
| **Canvas** (Sheet Canvas, Canvas-app) | `CANVAS.md`: de ontwerpfilosofie van élk scherm (status, aandacht, AI, dan pas functies) | **Bladweergave** of **Bladapp**; een tekenvlak is de bestaande **Schets** |
| **Spaces** | `server/bedrijf/werkruimte.js` (werkruimte en holding in Werk OS) en `WERKRUIMTE.md` (de desktop) | een Space IS een Werk OS-werkruimte met een project; zie par. 3, punt 18 |
| **Live** (Live Blocks) | `kern/live.js`, `ai-live-twin.js` | **Levende blokken**, of gewoon *blok* met de soort `view` |
| **Rahul Actions** | `actie` staat in ruim 1100 bestanden; het mechanisme bestaat als `kern/stuur/goedkeuring.js` + `bevestiging.js` | geen nieuwe naam: het IS de stuurlaag |
| **Agents** | `kern/agent.js` (de roosteragent van de zaak) | **profielen** op een mandaat (`kern/stuur/mandaat.js`) |
| **RTG Migrate** | `server/migraties/` (databasemigraties) | **RTG Overstap** |
| **RTG Meeting** | `kern/meet.js` (RTG Meet, WebRTC-kamers) | het is RTG Meet, met een verslaglaag erbij |
| **RTG Sign** | 31 tekenwegen met elk een eigen definitie van "getekend" (`AFSPRAAK.md` par. 3) | geen 32ste tekenweg; zie punt 14 |

---

## 3. De 26 punten, per stuk

**Stand**: **staat** · **een stap weg** · **vraagt een besluit** · **jaren weg**.
"Staat" betekent dat het mechanisme in de code zit; het zegt niets over of het
al aan Office hangt.

### Architectuur (1–3)

**1. Office-kern in plaats van losse editors** — *een stap weg.* De schil is er
al: zes soorten (`tekst`, `blad`, `presentatie`, `formulier`, `schets`, `bord`)
delen opslag, versies, delen, opmerkingen, classificatie, workflow en audit in
`kern/office/`, over vijf ingangen (lid, zaak, kantoor, RTF, werkplek) met één
API. Wat ontbreekt is par. 1: de modellen per soort.

**2. Universal RTG Object Model** — *vervalt als type, blijft als verwijzing*
(par. 0).

**3. Levende blokken** — *een stap weg, per blok.* De grammatica staat in
`CREATE.md` par. 3: **inhoud**, **view** (wijst een bron aan, opgelost bij elk
openen) en **handeling** (doet iets, en bestaat alleen als er een ontvanger is).
`/budget Q4` is een view; `/approval`, `/signature` en `/payment` zijn
handelingen en vallen daarmee onder de regels van punt 11 en 13. Twee regels die
het ontwerp eerlijk houden. Een view toont nooit meer dan de LEZER mag zien,
dus hetzelfde boarddocument toont een ander getal of een lege plek aan wie de
financiën niet mag lezen (en zegt dat erbij, nooit stil). En elk blok wijst naar
een bestaande bron, zoals `objectlaag/caps.js`: een blok zonder werkende bron
komt niet in het `/`-menu. Van de 24 voorgestelde blokken hebben er vandaag
ongeveer tien een bron in dit huis (taak, persoon, bedrijf, agenda, besluit,
formulier, budget via `kern/pay/budget.js`, factuur, project, boeking); de rest
is een belofte zonder bestemming.

### De editors (4–7)

**4. Document vervangt Word** — *jaren weg, en in deze volgorde.* Eerst het
model (par. 1). Dan DOCX lezen en schrijven met een **trouwmeter**: een corpus
echte Word-bestanden heen en terug, per bestand gemeten wat er verloren ging.
Zonder die meter is "hoge round-trip fidelity" een bewering en geen eigenschap.
Let op iets dat dit huis anders maakt dan elke concurrent: **`package.json` heeft
geen enkele runtime-dependency.** Postgres-wire, S3, WebAuthn, SAML en een PDF-parser
zijn eigen bouw. Een DOCX is een zip met XML; de zip-kant is met `zlib` in eigen
huis te doen, de OOXML-kant is het werk. Opmaak (secties, kop- en voetteksten,
voetnoten, stijlen) volgt uit het model. Wijzigingen bijhouden volgt uit het
model én uit punt 8.

**5. Sheet wordt serieus** — *een stap weg voor de breedte, jaren weg voor de
diepte.* De motor staat: een echte ontleder (een formule draait nooit als code),
**66 functies** onder 129 namen (Nederlands én Engels), verwijzingen naar andere
bladen, kolommen voorbij Z (`public/shared/rekenmotor.js`, `rekenfuncties*.js`).
Van 66 naar 500 is vooral breedte; dynamische matrices, draaitabellen en een
solver zijn diepte. Voor die laatste staat er een verklaarde lege plek:
`kern/ai/router.js` routeert al naar de techniek `optimalisatie` en zegt erbij
dat er **geen constraint solver** is. Die wordt één keer gebouwd, voor het blad
én voor het rooster (`PLANNING.md`).

**6. Van blad naar app** — *vraagt een besluit.* Het idee blijft; de vorm moet
anders. Een app die een model uit een zin GENEREERT is derdencode, en derdencode
draait hier nooit op de RTG-herkomst (`APPSTORE.md`: een naamloze cel zonder
netwerk). De vorm die past is **declaratief**: Rahul stelt een bladapp SAMEN uit
bestaande blokken (lijst, teller, balk, formulier) met een verwijzing naar de
cellen, en er draait geen gegenereerd script. Het voorbeeld uit het voorstel
toont nog iets: *"17 ziek"* is verzuim, en verzuim is een gezondheidsgegeven
(AVG art. 9). Een HR-dashboard mag per vestiging tellen en nooit per mens
sorteren (CAR-05, `KANTOORMACHT.md`: een score op een mens wordt nooit een
sorteersleutel), en wie de telling ziet moet dat verzuim mogen lezen.

**7. Present op Keynote-niveau** — *jaren weg.* Vandaag: vijf indelingen,
thema's, sprekersnotities, een presenteermodus en een hand-out waar de notities
niet in meeprinten. Een vrij canvas met vormen, maskers en animaties is een
ander model (par. 1) en een eigen project. De merkkit bestaat wél al:
`ONTWERP.md` en `MATERIAAL.md` zijn precies wat Rahul als "brandbook" moet
lezen, en een deck dat daarbuiten kleurt is fout gebouwd.

### Samenwerken en offline (8–9)

**8. Live samen schrijven** — *vraagt een besluit, daarna jaren.* Wat er staat:
een optimistisch slot op `gewijzigd` (409 `VERSIECONFLICT`), wijzigingen die via
**SSE** naar de anderen gaan (`kern/sse.js`, `bus.js` met Redis pub/sub), en
aanwezigheid die elke 15 seconden meldt. WebSockets zijn er niet, en dat hoeft
ook niet: SSE naar beneden en POST naar boven dragen een operatielog prima. Het
besluit is de CRDT zelf. Yjs of Automerge zou de **eerste runtime-dependency**
van het huis zijn, en een CRDT zelf bouwen is maanden werk. Eén grens die het
voorstel niet noemt: **samenvoegen geldt voor INHOUD en nooit voor de STAND.**
Een goedgekeurd document dat stil wordt samengevoegd met een late bewerking is
niet meer goedgekeurd, en daarom zet een inhoudswijziging de fase vandaag al
terug naar concept (`kern/office/docs.js`). Die regel blijft: een weigering op
een standovergang is geen tekort van het samenwerkingsmodel maar de werking
ervan.

**9. Offline eerst** — *vraagt een besluit.* `public/sw.js` slaat nu elk
`/api/`-verzoek en alles behalve GET over; er is geen wachtrij voor offline
schrijven. Technisch is dat een stap (IndexedDB met een uitgaande log, en punt 8
voegt samen). Het besluit gaat over classificatie: een **strikt** document dat
versleuteld op een laptop staat, staat daar. Dus per classificatie: `intern`
mag offline, `strikt` niet, en `vertrouwelijk` is de vraag.

### Rahul (10–12)

**10. Rahul in de editor** — *staat half, en er is eerst een gat te dichten.*
De schrijfhulp heeft acht opdrachten, waarvan er vijf lokaal draaien zonder
model (`kern/office/delen.js`: formule, samenvatten, inkorten, actiepunten,
kritisch). **Het gat was:** de drie die wél een model aanroepen (herschrijven,
engels, doorschrijven) stuurden de eerste 6000 tekens van het HELE document mee
en lazen `beheer.classificatie` niet. **Dicht sinds 23 september 2026**: een
strikt document krijgt 403 `CLASSIFICATIE_STRIKT` met de reden, en
`test/office-ai-classificatie.test.js` vangt met een nep-modelserver wat het huis
verlaat (met een tegenproef, en de weigering uitzetten laat hem zakken). "Alleen
naar het lokale model" bleek geen uitweg: de keten in `server/ai.js` valt bij een
storing van het lokale model door naar een externe aanbieder, en een
per-aanroep *nooit extern* bestaat daar niet. Dat is een besluit voor de
AI-uitgang (platform 11 in par. 8), niet voor Office. Daarna geldt AI-CONTEXT-01 uit
`MENSNETWERK.md` par. 4d ook hier: **een AI-context wordt opgebouwd uit een
positieve lijst, nooit uit een object waar daarna iets uit wordt gehaald.**
"Selecteer een tabel en vraag waarom de marge daalde" betekent dat Rahul de
selectie krijgt en de bronnen die de LEZER mag lezen, en niets meer.

**11. Voorstellen, toetsen, goedkeuren, uitvoeren, vastleggen** — *staat.* Dat
is de stuurlaag: `kern/stuur/plan.js` (het plan en zijn bezwaren),
`goedkeuring.js` + `bevestiging.js` (een mens keurt met een eenmalig token en
krijgt een bon), `mandaat.js` (versmalt alleen) en `kern/envelop.js` voor het
spoor. Wat ontbreekt is het GETAL in het voorbeeld. *"€ 1.840 verwachte extra
loonkosten"* is een voorspelling, en `kern/stuur/gevolg.js` weet van 96 van de 176
bereikbare paden niet wat ze aanraken. Een scherm dat dan toch een bedrag toont,
geeft een geruststelling zonder grond. De regel uit `KOSTEN.md` geldt: **er
staat nooit een getal waar er geen is.** Bovendien leest vandaag geen enkele
roostermotor verzuim (`PLANNING.md` par. 7), dus "maak een nieuwe planning voor
Haarlem" kan een zieke medewerker inplannen.

**12. Specialistische profielen** — *staat als grammatica.* Een Finance-, HR- of
Legal-profiel is een **mandaat** op `kern/stuur/mandaat.js`: een doorsnede van
wat de vrager al mag, en leeg is dicht. Het is dus geen chatbot met eigen
rechten maar een versmalling. Eén correctie op de formulering: een profiel mag
nooit meer dan de mens die het aanroept, dus "Finance mag financiële bronnen
lezen" is waar voor een financieel medewerker, en voor een stagiair die het
Finance-profiel kiest niet.

### Processen (13–15)

**13. Workflow met regels op de server** — *een stap weg.* De motor staat en
wordt al op de server afgedwongen: concept → beoordeling → goedgekeurd →
archief, goedkeuren alleen door de eigenaar en alleen met `mens: true`, en een
aanroep met `bron: 'ai'` krijgt 403 (`kern/office/workflow.js`). Wat ontbreekt
zijn de REGELS ("boven € 25.000 → CFO", "persoonsgegevens → privacytoets"). Die
horen niet in Office maar in de bevoegdheidslaag van `CONTROLPLANE.md`, waar een
bevoegdheid al vier dimensies heeft (wat, waar, hoeveel, wanneer), en een nieuwe
regel loopt eerst in de schaduw mee (`commercie/schaduw.js`). "Persoonsgegevens
aanwezig" automatisch herkennen is een detector, en een detector is graad
`vermoed`: hij mag een toets TOEVOEGEN en nooit overslaan.

**14. Eigen e-handtekening** — *vraagt twee besluiten.* Het eerste is juridisch.
eIDAS kent drie niveaus. Een eenvoudige en een geavanceerde handtekening kan RTG
zelf zetten (passkey via `kern/webauthn-actie.js`, een hash over het document,
een keten via `lib/keten.js`). Een **gekwalificeerde** vraagt een
gekwalificeerde vertrouwensdienst, en dat is een partnerkeuze. Het tweede besluit
is intern: `AFSPRAAK.md` telde 31 tekenwegen, waarvan er één een cryptografisch
bewijs vastlegt (`kern/onboarding/lid.js`, sha256 over tekst, versie en naam).
RTG Sign wordt de **gemeenschappelijke** weg voor die 31 en niet de 32ste, en
`lib/keten-anker.js` vraagt het besluit dat daar al openstaat: een anker in
dezelfde database is geen anker.

**15. PDF Studio** — *staat voor de helft.* Er is een eigen PDF-laag: lezen,
xref-streams, samenvoegen en splitsen, annotatie, en **echte redactie die de
tekst uit de bytes haalt** (`kern/pdf*.js`, route `routes/bestanden-pdf.js`).
Wat ontbreekt: OCR (`kern/invoer.js` zegt met zoveel woorden dat die er niet is),
formulieren invullen, vergelijken en ondertekenen (punt 14). Het werk is een
scherm op die laag, geen nieuwe laag.

### Vinden en weten (16–18)

**16. Eén zoekveld** — *een stap weg, zonder centrale index.* Er zijn nu ruim
tien zoekroutes per domein (`/api/bedrijf/zoek`, `/api/comm/zoek`,
`/api/member/berichten/zoek`, `/api/mall/zoek`, ...) en een sprong naar
schermen (`shared/sprong.js`). Een federatie die elk domein zijn eigen deel laat
beantwoorden, met zijn eigen poort, is direct te bouwen en lekt niets. Een
**centrale index** zou een kopie van elk document naast zijn eigen rechten
leggen; dat is een besluit. **Semantisch zoeken** vraagt embeddings, en dus gaat
de inhoud door een model. Dat mag alleen lokaal (`LOCAL_AI_URL`), om dezelfde
reden als bij punt 10.

**17. Kennisgraaf** — *staat als vorm.* De vorm is gevonden en draait al drie
keer: `kern/levensgraaf/graaf.js`, `kern/socialegraaf/`, `kern/geldgraaf/`.
Een PROJECTIE en geen tweede database, met `deel` als poort. De bedrijfsgraaf
("Mustafa werkt voor RTG Türkiye, dat hoort bij ...") is een vierde projectie
over `kern/concern/` (entiteit, vestiging, employment) en `server/bedrijf/`
(project, besluit, contract). Er komt dus geen `graph`-tabel.

**18. Spaces** — *staat onder een andere naam.* `server/bedrijf/werkruimte.js`,
`project.js` (projecten, taken, sprints; voortgang geteld en nooit ingevuld),
`kennis.js` (met houdbaarheid) en `besluit.js`. Een Space is een scherm dat een
werkruimte en een project samen toont, met Office-documenten als deel ervan.
Geen nieuw begrip.

### Vergaderen (19)

**19. Van vergadering naar besluit** — *staat in stukken, met één grens erbij.*
RTG Meet (`kern/meet.js`), spraak naar tekst **alleen lokaal**
(`kern/spraaktekst.js`), samenvatting en actiepunten van een transcript dat niet
wordt bewaard (`routes/memo.js`), en formele besluiten (`server/bedrijf/besluit.js`).
De grens komt uit `SERVICE.md` par. 13d: **iedereen ondertitelt zichzelf, en
niemand ondertitelt een ander achter zijn rug.** Een verslag van een vergadering
vraagt dus toestemming van iedere spreker, en wie niet instemt, staat er niet in.
De rest van het voorstel past precies: niets wordt stil uitgevoerd, er is een
"verslag nakijken"-stap, en pas daarna worden goedgekeurde objecten bijgewerkt,
via punt 11.

### Enterprise (20–25)

**20. Beheer voor organisaties** — *staat grotendeels.* SAML
(`server/sso/saml/`), OIDC, SCIM (`server/scim/`), passkeys (`server/webauthn/`),
tenants met levensloop en uitgang (`TENANT.md`), bewaartermijnen
(`bewaartermijnen.js`, en per document al `beheer.bewaartermijn`), juridische
bewaring (voor mail in `rtmail-bewaar.js`, en de vlag `legalHold` op een tenant).
**Niet gevonden**: DLP, dataresidentie als mechanisme, en herstel naar een
willekeurig tijdstip.

**21. Zero-trust toegang** — *staat als bevoegdheidslaag, niet als één motor.*
Het voorstel noemt twaalf ingangen (wie, wat, tenant, rol, apparaat, sessie,
locatie, classificatie, doel, tijd, bron, handeling). De bevoegdheidslaag van
`CONTROLPLANE.md` heeft er vier (wat, waar, hoeveel, wanneer), de doelbinding
bestaat (`test/doelbinding.test.js`), en de classificatie van een document wordt
al op de server gelezen (`kern/office/rechten.js`: bij strikt tellen delingen
niet). Een beslissing heeft acht uitkomsten, en `ONBEKEND` is met opzet geen
`WEIGEREN`. Apparaat en locatie ontbreken, en die zijn een besluit (wat telt als
een beheerd apparaat?).

**22. Bedrijfscontinuïteit** — *staat voor de helft.* PostgreSQL-stand,
S3-opslag (`server/media/s3.js`), back-up en herstel (`scripts/docker/backup.sh`,
`herstel.sh`), chaostoetsen (`scripts/chaos.js`), en een crashproef die per
geldroute het proces laat sterven (`scripts/crashproef.js`). Vandaag geldt
voor Office één kwetsbaarheid die het voorstel terecht aanwijst: versies zijn
volle kopieën, maximaal 15 per document, in hetzelfde record. Herstel naar een
tijdstip en regionale back-up zijn *jaren weg*.

**23. Open formaten** — *een stap weg per formaat, en de volgorde is de
prijskaart.* Vandaag: tekst naar HTML, blad naar CSV, presentatie naar TXT,
schets naar SVG, formulieruitslag naar CSV, en PDF via de afdrukdialoog. Geen
enkel Office- of OpenDocument-formaat, in of uit. Volgorde naar waarde:
**XLSX lezen** (het goedkoopst en het meest gevraagd), **DOCX schrijven**,
**DOCX lezen** (vraagt het model uit par. 1), dan PPTX. ODF volgt op dezelfde
modellen. "Wij houden je niet gevangen" is de juiste belofte, en er hoort een
toets bij: alles wat erin kan, moet er ook uit.

**24. RTG Overstap (migratie)** — *vraagt een besluit.* Er is niets. Koppelingen
met Microsoft 365 en Google vragen een app-registratie bij die partijen, en dat
is een partnerkeuze. Het rapport uit het voorstel ("1.801.223 volledig
compatibel") kan pas als de trouwmeter van punt 4 bestaat. Zonder meter is
"compatibel" een woord.

**25. Naast elkaar draaien** — *volgt uit 23.* Met DOCX en XLSX in en uit kan een
bedrijf gefaseerd overstappen. Er is verder niets extra's voor nodig.

### Apparaten (26)

**26. Desktop en mobiel** — *staat als PWA, de rest is een besluit.* Er zijn 30
manifests en de werktafel draait op elke breedte (`WERKRUIMTE.md`). Native apps
(Electron, Capacitor of eigen) zijn er niet, en elk ervan is een tweede
releasekanaal met een eigen keuring. Het deel van het voorstel dat op het web
wél kan: meerdere vensters en sneltoetsen. Offline valt onder punt 9.

---

## 4. Grenzen

De grenzen van `FABRIC.md`, `EXECUTIE.md` en `GELD.md` gelden onverkort. Deze
komen erbij, en elk komt uit iets wat hierboven werd gevonden.

1. **Een blok verwijst, het kopieert niet** (par. 0). Een levend blok dat een
   waarde vastlegt in plaats van naar zijn bron te wijzen, is weer een kopie.
2. **Een view toont nooit meer dan de lezer mag** (punt 3), en een lege plek
   zegt waarom hij leeg is.
3. **Samenvoegen is voor inhoud, nooit voor een stand** (punt 8). Een
   goedkeuring wordt niet samengevoegd.
4. **Classificatie reist mee naar elke uitgang**: delen, offline, AI, zoekindex
   en export (punten 9, 10 en 16). Een uitgang die haar niet leest, is een lek.
5. **Rahul krijgt een positieve lijst** (AI-CONTEXT-01) en kan nooit meer dan
   degene die hem aanroept (punt 12).
6. **Er staat geen getal waar er geen is** (punt 11). Een voorspelde kostenpost
   zonder gemeten gevolg is `onbekend`, en het scherm zegt dat.
7. **Geen gegenereerde code in een bladapp** (punt 6). Rahul stelt samen uit
   bestaande blokken en schrijft geen script.
8. **Wie niet instemt, staat niet in het verslag** (punt 19).
9. **Geen cijfer op een mens** (punt 6), ook niet in een dashboard dat Rahul
   bouwt.

---

## 5. Volgorde

De stuurmaat is niet "wanneer hebben we Office Next" maar **wanneer kan een
bedrijf een dag werken zonder Word te openen**. Dat haalt het niet met meer
editors, wel met formaten en een model.

| stap | wat | stand | waarom hier |
|---|---|---|---|
| 0 | strikte documenten niet naar een taalmodel (punt 10) | **gedaan**, 23 september 2026 | het was een lek, en het was klein |
| 1 | XLSX lezen en schrijven op de bestaande bladmotor | een stap weg | het bladmodel bestaat al (`cellen`, `opmaak`); dit is het goedkoopste formaat met de meeste waarde |
| 2 | het tekstmodel, met een importeur van de bestaande HTML-documenten | een stap weg, maanden | draagt punt 4, 8 en 3 |
| 3 | DOCX schrijven, dan lezen, met de trouwmeter | na 2 | draagt 23, 24 en 25 |
| 4 | één zoekveld als federatie | een stap weg | geen index, geen lek |
| 5 | besluit: CRDT kopen (eerste dependency) of bouwen | besluit | draagt punt 8 en 9 |
| 6 | levende blokken, eerst de views (`/taak`, `/besluit`, `/budget`) | na 2 | de handelingen volgen via de stuurlaag |
| 7 | workflowregels via de bevoegdheidslaag, eerst in de schaduw | een stap weg | de motor staat al |
| 8 | Sign als gemeenschappelijke tekenweg | twee besluiten | juridisch en intern |

Wat er met opzet niet in staat: Present op Keynote-niveau, native apps en
migratiekoppelingen. Niet omdat ze onbelangrijk zijn, maar omdat elk ervan op
een eerdere stap rust (het model, de formaten) of op een partnerkeuze die eerst
genomen moet worden.

---

## 6. De punten 27–150: waar de lat verder omhoog gaat

De eigenaar trok de lat op 23 september een tweede keer omhoog: niet gelijkwaardig
aan Microsoft 365 of Google Workspace, maar **een concrete reden voor een bedrijf
om zijn dagelijkse werk naar RTG te verplaatsen**. Daarbij kwamen 124 punten,
van een universele commandolaag tot een Company Runtime. De eigenaar zei er zelf
bij wat de volgende stap moet zijn: *niet meteen 151–200 verzinnen, maar de 150
terugbrengen tot ongeveer vijftien platformen, een afhankelijkheidsgraaf en een
meerjarige bouwvolgorde.* Dat doen par. 7 tot en met 9. Deze paragraaf zet eerst
recht waar een punt botst met iets wat dit huis al heeft besloten of gemeten.

### 6.1 Wat herhaald wordt en al beantwoord is

- **79 en 142, het universele objectmodel en de canonieke datalaag**, zijn par. 0
  in een ander jasje. Een canonieke klant over systeem A en RTG heen is de
  `Asset`-vorm over een systeemgrens, en die is er nog verder van af dan binnen
  één huis. De vorm die wel werkt staat in `MAATSTAF.md` par. 7g: een projectie met
  vaste etiketten per bron (`terrein`, `wat`, `ingang`, `dektNiet`, `herkomst`),
  waarbij de bron zijn eigen betekenis houdt.
- **44, universele blokken**, is punt 3 (blokken verwijzen, ze zijn niet
  hetzelfde object). "Het blijft hetzelfde object" klopt alleen als de bron de
  waarheid houdt en het blok hem toont.
- **38, 97 en 39, het migratiecentrum**, zijn punt 24. **40 en 98, parallel
  draaien**, zijn punt 25. **41 en 99, formaten als eersteklas burger**, zijn
  punt 23 met de trouwmeter van punt 4. **53, 55, 57 en 61** komen terug als 112,
  75, 57 en 73.

### 6.2 Wat botst met een besluit van dit huis

| punt | botst met | de vorm die overleeft |
|---|---|---|
| **69** risiconiveaus L0–L5 | de zesde gezagsladder. `scripts/gezagsnoemer.js` legt vijf bestaande schalen al op één noemer van vier treden (`geen` / `tonen` / `klaarzetten` / `uitvoeren`), en `EXECUTIE.md` zegt dat een nieuwe ladder precies de consolidatie ongedaan maakt | het RISICO van een handeling is een EIGENSCHAP die `kern/frictie/motor.js` per geval uitrekent (bedrag, omkeerbaarheid, zekerheid, met de opbouw erbij), en het gezag blijft een van de vier treden. L4 "extern" en L5 "juridisch/financieel" zijn geen treden maar redenen om een tweede handtekening te eisen |
| **27** één commandoveld voor het hele huis | `EXECUTIE.md` blok 9, **bewust niet gebouwd**: `VERTROUWEN.json` stond op 0 bewezen routes en de gevolgvoorspelling op 96 van 176 onbekend. *Eerst die twee getallen bewegen, dan de balk* | het veld mag er komen als het kiest uit wat `resolver.js` al versmalt en `plan.js` al weegt, en elk plan zegt wat het NIET weet. Het besluit is van de eigenaar |
| **30 en 108** tijdreizen | `KANTOORMACHT.md`: er is geen historische toestand van entiteiten, en tijdreizen botst met de eigen bewaartermijnen | alleen waar het domein het al bijhoudt: `kern/concern/tijd.js` houdt juridische feiten met `van`/`tot` en overschrijft nooit, `server/bedrijf/toen.js` weigert met zoveel woorden een volledige reconstructie. "De workspace zoals hij op 17 maart was" wordt dus "wat dit domein van 17 maart weet", mét wat het niet meer weet |
| **61 en 73** procesanalyse | CAR-05 en `KANTOORMACHT.md`: een score op een mens wordt nooit een sorteersleutel | per STAP en per cohort, nooit per mens. Het voorbeeld van de eigenaar ("71% van de vertraging zit bij account provisioning") is precies goed; "de medewerker die het langst doet over provisioning" is het product dat niet mag bestaan. `kern/service/kwaliteit.js` meet al doorlooptijd zonder naam |
| **86** screenshots beperken | `HDI.md` over de noodstand: een webapp kan de app-switcher, notificaties en browsergeschiedenis niet garanderen | wat niet af te dwingen is, staat er hardop bij als *ontmoedigd*. Een watermerk kan wél, en zegt meer |
| **83** klembord | hetzelfde: een webapp kan kopiëren niet afdwingen | DLP geldt waar de SERVER een uitgang is (delen, export, download, AI, API). Het klembord staat in de lijst van wat het niet ziet |
| **49 en 85** klantsleutels | `vault.key` en `RTG_ENC_KEY` zijn platformbreed, en `kern/beschermstand-lijst.js` zegt dat er voor `secret.key` en `vault.key` geen rotatie bestaat | sleutelrotatie komt vóór klantsleutels. Wie de eigen sleutel niet kan draaien, kan die van een ander niet beloven |
| **110** Rahul overal in beeld | `INTELLIGENTIE.md` INT-04: een aandachtmotor geeft een besluit met zijn opbouw en nooit een samengesteld cijfer, en `CANVAS.md`: hooguit drie dingen die aandacht vragen | ambient mag, als het één regel met een reden is en je hem kunt wegklikken |
| **149** autonome zones | `EXECUTIE.md`: een mandaat verleent nooit vermogen, het versmalt alleen, en geld en het pasbesluit blijven mensenwerk | de inkoopketen uit het voorbeeld kan, binnen een mandaat met een plafond, tot en met het KLAARZETTEN. Bestellen boven nul euro is uitvoeren richting een derde, en dat blijft een mens (`GELD.md`) |

### 6.3 Wat al staat en de lat al haalt

Een deel van de 124 staat er, meestal onder een andere naam:

- **68 de AI-firewall** (gebruiker ∩ agent ∩ classificatie ∩ context) is
  letterlijk `kern/stuur/mandaat.js`: de speelruimte is een doorsnede en kan
  structureel niets toevoegen.
- **67 agentidentiteit** bestaat half: het voorvoegsel `ai:` in
  `kern/service/machtiging-grenzen.js` (een AI is nooit de tweede handtekening),
  API-sleutels met scopes en quota in `kern/command/apipoort.js`, en de `actor` in
  de envelop. Serviceaccounts ontbreken.
- **127 budgetten**: `ai-meter.js` (dagplafond voor het hele huis),
  `ai-rem.js` (per minuut), `ai-budget.js` (per persoon per pas) en
  `kern/kosten/grens.js` (twee sloten, de strengste wint).
- **71 schaduwstand**: `commercie/schaduw.js` (UIT, SCHADUW, AFDWINGEN, en
  afdwingen alleen na schaduw) en de modelrouter die in de schaduw meet.
- **33 en 69 goedkeuren per actie**: `stuur/goedkeuring.js` (eenmalig token,
  gebonden aan pad, body, rol en persoon) en `bevestiging.js` met een bon.
- **35 modelrouter**: `kern/ai/router.js`, vijf technieken van goedkoop naar
  duur, en hij zegt hardop dat er geen constraint solver is.
- **94 en 95 tijdelijke rechten en noodtoegang**: `kern/command/toegang.js`
  (alles draagt een `tot`, noodtoegang wordt gejournaliseerd) en
  `kern/command/bijstand.js`.
- **92 passkeys eerst**: `server/webauthn/`, step-up per handeling in
  `kern/webauthn-actie.js`, en een apparaatsleutel die niet te exporteren is
  (`public/shared/toestelsleutel.js`).
- **90 de auditketen**: `lib/keten.js` (en het ankerbesluit uit punt 14).
- **75 besluiten**: `server/bedrijf/besluit.js`, met bezwaren die nooit
  verdwijnen en een evaluatiedatum op elk aangenomen besluit.
- **54 en 118 wat-als**: `kern/command/simulatie.js` rekent op echte tellingen en
  zet de aannames in de uitslag.

### 6.4 Wat nergens staat

Niet gevonden, en dus werk: MCP (noch als server, noch als client), uitgaande
webhooks, een OAuth-provider voor derden, een eigen API-beschrijving (OpenAPI),
een register van gebeurtenisnamen (`OS.md` zegt met opzet dat de envelop geen
schemaregister is), een automatisering die een gebruiker zelf maakt (er zijn
alleen vaste draaiboeken in `kern/automatisering.js`), een datamodel dat een
bedrijf zelf aanlegt (alleen in `server/school/`), procesanalyse over standen
heen, detectie van BSN en paspoortnummers in vrije tekst, sleutels per klant,
een regio-instelling, beoordeling van het sessierisico, eDiscovery over meer dan
mail, een clean room, een publieke statuspagina, en een AI-noodstop per tenant
(`RTG_AI_UIT` is er alleen voor het hele huis).

---

## 7. Van 150 punten naar vijftien platformen

Een platform hier is een vermogen dat door meerdere punten wordt gebruikt en één
eigenaar in de code heeft of hoort te krijgen. Het is **geen** objecttype en geen
laag die de domeinen bezit (par. 0): domeinen houden hun betekenis, de platformen
leveren wat ze delen. Dat is de regel van `AFSPRAAK.md`, hier toegepast: *RTG deelt
bewijs, identiteit, levenscyclus, rechten en opvolging, en de domeinen houden hun
eigen betekenis.*

| # | platform | punten | stand | wat er al is |
|---|---|---|---|---|
| **P1** | Identiteit, sessie en apparaat | 67, 91–95 | **staat grotendeels** | codenamen en kluis, passkeys, step-up, apparaatsleutel, SAML/OIDC/SCIM, tijdelijke rechten, noodtoegang. Ontbreekt: serviceaccounts, sessierisico |
| **P2** | Beleid en bevoegdheid | 13, 21, 45, 51, 52, 80, 81, 115–117, 136 | **staat als motor, ontbreekt op veldniveau** | vier dimensies en acht uitkomsten (`CONTROLPLANE.md`), schaduw vóór afdwingen, doelbinding, bedrijfsregels met afdwingpunt (`bedrijf/regels.js`, `regelpoort.js`). Ontbreekt: rechten per blok of veld, en een beleidstaal die een beheerder kan lezen |
| **P3** | Classificatie en gegevensbescherming | 46–48, 82, 83, 86 | **een stap weg** | drie classificaties per document, strikt blokkeert delen én (sinds stap 0) het model. Ontbreekt: detectoren, dynamisch zwartlakken, één plek die elke uitgang langsloopt |
| **P4** | Opslag, bewaring, bewijs en plaats | 22, 49, 50, 56, 84, 85, 88–90, 96, 100 | **staat voor de helft** | PostgreSQL, S3, back-up, bewaartermijnen, juridische bewaring (mail, tenant, ID-dossier), hashketen, uitgang per tenant. Ontbreekt: sleutelrotatie, klantsleutels, regio's, herstel naar een tijdstip, eDiscovery, trust center |
| **P5** | Documentmodellen en formaten | 4, 5, 7, 23, 41, 42, 99 | **het fundament ontbreekt** | het bladmodel bestaat, het tekstmodel niet (par. 1). Geen enkel Office- of ODF-formaat |
| **P6** | Samenwerking en offline | 8, 9, 145 | **vraagt een besluit** | SSE en de bus met Redis, optimistisch slot. Geen CRDT, geen uitgaande wachtrij |
| **P7** | Blokken, views en de werkschil | 3, 6, 43, 44, 101–107, 26, 146 | **grammatica staat** | inhoud / view / handeling (`CREATE.md`), caps met een bestemming (`objectlaag/caps.js`), de adaptieve laag (`ADAPTIEF.md`). Gegenereerde UI = samengesteld uit toegestane blokken, nooit code |
| **P8** | Projecties, graaf en zoeken | 16, 17, 28, 29, 76–78, 111, 143 | **de vorm staat, de bedrijfsgraaf niet** | drie projecties (`levensgraaf`, `socialegraaf`, `geldgraaf`), ruim tien zoekroutes per domein. Ontbreekt: de bedrijfsprojectie en de federatie. Semantisch zoeken alleen lokaal |
| **P9** | Gebeurtenissen en tijd | 30, 108, 113, 114, 116, 147, 148 | **staat zonder register** | bus met envelop (actor, correlatie, oorzaak, classificatie), `concern/tijd.js`, append-only gebeurtenissen in `bedrijf/`. Ontbreekt: een register van gebeurtenisnamen en tijdregels |
| **P10** | Stuurlaag: plan, mandaat, bevestiging | 10–12, 31–34, 66–71, 121–130, 149 | **staat, en is de sterkste** | resolver, plan, gevolg, mandaat, goedkeuring, bon, schaduw. Ontbreekt: de gevolgmeting voor 96 van 176 paden, een typetaal tussen agents, en de promotieladder van `PROOF.md` als poort voor een agent |
| **P11** | AI-uitgang en modelrouter | 35, 103, 104, 144 | **staat in de schaduw** | router met vijf technieken, lokaal eerst, budgetten, dagplafond. Ontbreekt: een per-aanroep *nooit extern* (zie stap 0), en een noodstop per tenant |
| **P12** | Workflow en automatisering | 13, 59, 60, 109, 115, 116, 135 | **staat voor documenten, niet voor gebruikers** | de Office-fasen op de server, vaste draaiboeken, `rtgone`-automatisering met herstel. Ontbreekt: een staatsmachine die een gebruiker bouwt, en tijdregels |
| **P13** | Besluiten en vergaderen | 19, 55–58, 75 | **staat in stukken** | besluiten met bezwaren en evaluatie, notulen die later worden vastgesteld, RTG Meet, spraak naar tekst alleen lokaal. Ontbreekt: het besluitdossier dat de stukken aan elkaar knoopt |
| **P14** | Simulatie en procesmeting | 53, 54, 61, 72–74, 112, 118–120 | **staat als tweeling, niet als procesanalyse** | `command/simulatie.js`, de stadsweefselsimulatie, Magnaat met de synthetische bank. Ontbreekt: doorlooptijd per stap over domeinen heen, en scenariotakken |
| **P15** | Koppelen, overstappen en bouwen op RTG | 24, 25, 37–40, 62–65, 97, 98, 131–141 | **het dunst** | API-sleutels (`apipoort.js`), de App Store met een cel, Webmaker, SSO/SCIM. Ontbreekt: MCP, uitgaande webhooks, OAuth voor derden, API-beschrijving, bronkoppelingen, een eigen datamodel per bedrijf |

Drie punten vallen buiten de vijftien en staan er met opzet niet in als
platform: **26 en 146** (native apps en spatial) zijn uitvoervormen van P7 en
een releasebesluit, **87** (clean room) is een product op P2 + P3 + P8 en geen
fundament, en **150** (Company Runtime) is de optelsom en geen onderdeel.

---

## 8. De afhankelijkheidsgraaf

Een pijl betekent: *kan niet eerlijk bestaan zonder*.

```text
                     P1 Identiteit
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
   P2 Beleid ◄──── P3 Classificatie    P4 Opslag, bewijs
          │               │                │
          │      ┌────────┴──────┐         │
          ▼      ▼               ▼         ▼
      P10 Stuurlaag        P11 AI-uitgang  P9 Gebeurtenissen en tijd
          │   │                  │           │         │
          │   └────────┬─────────┘           │         │
          │            ▼                     ▼         ▼
          │      P12 Workflow ◄──────── P8 Projecties  P14 Simulatie
          │            │                  │    │
          ▼            ▼                  ▼    │
     P13 Besluiten ◄───┘            P7 Blokken ◄── P5 Modellen ◄── P6 Samenwerking
                                          │
                                          ▼
                                    P15 Koppelen, bouwen
```

Wat de graaf zegt, in drie zinnen:

1. **P3 staat hoger dan hij lijkt.** Classificatie voedt het beleid (P2), de
   AI-uitgang (P11), het zoeken (P8), offline (P6) en export (P15). Stap 0 was een
   voorbeeld: één uitgang die haar niet las, en er ging een strikt document naar
   een model. Elke nieuwe uitgang zonder P3 is hetzelfde lek opnieuw.
2. **P5 is het smalste punt voor de Office-kant.** Blokken (P7), samen schrijven
   (P6) en formaten (P15-overstap) wachten er alle drie op, en niets anders kan
   het vervangen.
3. **P10 is ver, maar hangt aan twee getallen en niet aan code.** De stuurlaag
   staat; wat haar tegenhoudt is dat de gevolgmeting en het bewijsregister te
   weinig zeggen. Meer agents bovenop dat getal geeft meer macht zonder meer
   zekerheid.

---

## 9. Bouwvolgorde

De stuurmaat blijft die van par. 5 (**wanneer kan een bedrijf een dag werken
zonder Word te openen**), met een tweede ernaast die de lat van de eigenaar
vangt: **wanneer kan RTG een CIO iets tonen wat hij bij de ander niet krijgt**.
Die tweede vraag bepaalt de volgorde meer dan de eerste. Een CIO stapt niet over
omdat de tekstverwerker even goed is, maar omdat er iets bij komt wat hij nu mist.

### Wat RTG al heeft en de ander niet op deze manier

Dit zijn de vier redenen om over te stappen die het dichtst bij staan, omdat de
fundering er al ligt:

1. **Een AI die nooit meer kan dan de mens die hem vraagt, en dat is structureel.**
   `mandaat.js` is een doorsnede, geen instelling. Dat is punt 68, en hier hoeft
   het niet gebouwd te worden.
2. **Elke uitkomst draagt haar bewijsgraad** (onbekend, vermoed, gemeten,
   bewezen) en *niet vast te stellen* is een eersteklas antwoord (`BESTUUR.md`).
   Dat is punt 34 en 70 als huisregel in plaats van als functie.
3. **Het besluit met zijn bezwaren.** `bedrijf/besluit.js` laat een bezwaar nooit
   verdwijnen en zet een evaluatiedatum op elk besluit. Met het dossier van P13
   wordt dat punt 55 en 76, en dat heeft niemand zo.
4. **De uitgang is al gebouwd.** `kern/tenant/` heeft een levensloop met een
   uitgang. Met de formaten van P5 wordt dat punt 100: *je kunt weg, en daarom
   durf je te komen.*

### De fasen

| fase | wat | platformen | stand | waarom hier |
|---|---|---|---|---|
| **0** | strikt niet naar een model | P3, P11 | **gedaan** | het was een lek |
| **1** | één uitgangspoort voor classificatie: delen, export, download, AI, API en zoeken lezen haar op dezelfde plek, met een toets die elke nieuwe uitgang dwingt zich te melden | P3 | een stap weg | na stap 0 is dit hetzelfde lek, maar dan structureel dicht |
| **2** | XLSX in en uit, en DOCX schrijven | P5 | een stap weg | het goedkoopste deel van de overstap, en de uitgang (reden 4) wordt echt |
| **3** | het tekstmodel met de importeur van de bestaande documenten, dan DOCX lezen met de trouwmeter | P5 | maanden | fundament voor P6 en P7 |
| **4** | het besluitdossier: besluit, stukken, cijfers, bezwaren, goedkeuringen en uitvoering aan elkaar, op de hashketen | P13, P4 | een stap weg | reden 3; bijna alles bestaat |
| **5** | de bedrijfsprojectie en één zoekveld als federatie, met bronnen bij elk antwoord | P8 | een stap weg | punt 29 met bron en datum is het vertrouwensproduct, en er komt geen centrale index |
| **6** | besluit over samenwerking (CRDT kopen of bouwen) en over offline per classificatie | P6 | besluit | wacht op 3 |
| **7** | serviceaccounts en uitgaande webhooks, daarna MCP als server over de lijst die `beleid.js` al toestaat | P1, P15 | een stap weg | "koppel eerst, vervang later" is de commerciële route van de eigenaar; MCP mag geen tweede toegangsweg worden, dus het leest dezelfde lijst |
| **8** | de gevolgmeting en het bewijsregister omhoog (de twee getallen van blok 9) | P10 | jaren, en een meting | pas daarna het commandoveld (27) en agents met uitvoerend gezag |
| **9** | rechten per blok en dynamisch zwartlakken | P2, P3, P7 | na 3 | vraagt het tekstmodel; op HTML is het een filter op markup |
| **10** | procesanalyse per stap, daarna scenariotakken | P14, P9 | een stap weg voor de eerste | het register van gebeurtenisnamen komt eerst, anders meet je namen |
| **11** | sleutelrotatie, dan regio's en klantsleutels | P4 | besluit, daarna jaren | wat je zelf niet kunt draaien, kun je een ander niet beloven |
| **12** | een datamodel per bedrijf, bladapps en workflows die een gebruiker bouwt | P15, P12, P7 | jaren | rust op 2, 3, 7 en 9 |

**Wat bewust achteraan staat:** agents die zelfstandig uitvoeren (punt 121–130
voorbij klaarzetten), autonome zones (149), spatial (146) en de Company Runtime
(150). Niet omdat ze onbelangrijk zijn, maar omdat elk ervan macht toevoegt op een
fundering die vandaag nog niet kan zeggen wat een handeling aanraakt. De volgorde
van de eigenaar zelf, *connect, import, coexist, prove, migrate, consolidate,
optimize, automate*, zegt hetzelfde: automatiseren komt als laatste.

---

## 10. Wat dit document niet zegt

- De tabel met concurrenten staat hier niet in, want die veroudert per kwartaal.
  Ook de uitspraken over Loop, Copilot Pages, Work IQ, Gemini, MCP bij Google,
  Sheets Canvas en de nieuwe producten van andere partijen in de opdracht zijn
  niet nagetrokken. Ze sturen de richting, en ze zijn niet gemeten.
- "Staat" is nagezocht in de code en niet beproefd in een browser. Waar een
  toets bestaat staat hij erbij; de rest is graad `vermoed`.
- De kop-as van par. 0 is lexicaal en een ondergrens. De conclusie rust op de
  vorm-as, en die is hard.
- Hoeveel mensjaren dit kost, zegt dit document niet. Een schatting zonder
  meting is hier geen getal.
