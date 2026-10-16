# Het afbouwprogramma — wat RTG heeft toegezegd, afbouwen en bewijzen

*Eigenaarsbesluit van 11 oktober 2026, met het uitvoeringsbesluit van 16 oktober
2026. Dit document legt de scope, grenzen, bouwstromen en bewijsvoering vast. Het
is LEIDEND voor de verdere ontwikkeling van RTG.*

Let op de naam. `afbouw` is in dit huis al bezet door de releaseketen
(`npm run afbouw:software`, `scripts/afbouwoordeel.js`: *is deze commit
bewezen?*). Dit document gaat over iets anders, namelijk over de SCOPE van wat
er nog gebouwd en bewezen wordt, en heet daarom het afbouwPROGRAMMA. Het woord
`toezegging` is ook bezet (een financiële belofte van het mecenaat in de
geldgraaf, `POLITIEK.md` par. 0), dus in code heet de inventaris
`toezegklassen`.

## 0. Het besluit

> **Het doel: alles wat RTG daadwerkelijk heeft toegezegd volledig ontwikkelen,
> integreren en bewijzen. Niet alles wat ooit in een document is genoemd.**

De eigenaar koos optie D: het volledige ontwikkelprogramma, met meerdere agents
en parallelle werkstromen waar dat technisch verantwoord is, en met een
gecontroleerde uitvoering van A, B en C naast elkaar. Na het vastleggen begint
de uitvoering. Dit is geen nieuwe audit- of documentatiefase; elke ronde levert
een meetbare softwareverbetering op.

### Uitvoeringsbesluit 16 oktober 2026 — Full Build → Final Qualification

De uitvoering bouwt voortaan eerst alle bestaande en toegezegde onderdelen tot
één afgeschermde releasekandidaat. Daarna volgt één gezamenlijke,
platformbrede eindkwalificatie. Een open platformbrede CI-afwijking in een
afzonderlijke ontwikkeltak houdt onafhankelijk bouwwerk niet stil, maar blijft
zichtbaar en mag niet als groen bewijs of stabiele productiegrondslag worden
gebruikt.

Tijdens de bouw blijven typechecks, gerichte unit-, contract- en
integratietoetsen en de relevante beveiligingsproeven verplicht. Account- en
tenantisolatie, autorisatie, gegevensbehoud en financiële veiligheid moeten
lokaal dicht zijn voordat ander werk op zo'n grens voortbouwt. De volledige
scherm-, route-, prestatie-, toegankelijkheids-, herstel- en operationele
kwalificatie wordt uitgevoerd op de geïntegreerde kandidaat.

De integratietak is geen publieke release. Mergen naar `main`, een releasetag,
een productie-image en een live-uitrol blijven afzonderlijke handelingen met de
bestaande menselijke poorten. Een feature flag kan nieuw gedrag afschermen,
maar vervangt nooit serverautorisatie of een andere beveiligingsgrens.

## 1. De drie grenzen, definitief

Dit zijn harde architectuur- en productgrenzen. Ze gaan voor elke functie: waar
een functie botst met een grens, vervalt de functie (de regel van `LEVEN.md`
par. 2, hier huisbreed).

1. **Scope.** Alleen toegezegde functionaliteit wordt gebouwd. Wat afgewezen is
   blijft afgewezen, met de grens die het afwees (het `Asset`-, `Moment`- en
   `Career`-object, de `humans`-tabel, een score of ranglijst op een mens, de
   fanladder, `EXECUTE_LOW_RISK`, de overtuigings-API, een token op een publieke
   chain). Wat een besluit of een externe voorwaarde vraagt, blijft geblokkeerd
   tot die voorwaarde AANTOONBAAR vervuld is. `LEVEN.md` en de huisregels uit
   `CLAUDE.md` blijven leidend.
2. **Integratie.** De vier werelden (LivingOS, WorkOS, TravelOS, FoundationOS)
   houden hun eigen domeingrenzen en gegevensverantwoordelijkheid. Integratie
   gebeurt via projecties (de vorm van `kern/levensgraaf/graaf.js`) en via
   platformvermogen (identiteit, bevoegdheid, envelop, uitvoering, bewijs), nooit
   via één gedeeld datamodel. Privacy, toestemming, bevoegdheid en bewijs blijven
   verplicht.
3. **Menselijke regie.** Geen stilzwijgende overdracht van werkgegevens,
   privébudgetten of andere gevoelige informatie. Wat een tweede persoon bereikt
   (uitnodiging, bericht, boeking, betaling) wordt klaargezet en een mens
   bevestigt. Geld verlaat het huis nooit automatisch.

## 2. De bewijsregel, en wat er niet mag

**Geen enkele agent markeert een product als voltooid op basis van alleen eigen
toetsen of documentatie.** Het bewijs moet reproduceerbaar zijn via de bestaande
meetinfrastructuur: `APPWERKT.json` (`scripts/appwerkt.js`, de acht bewijzen uit
`BETROUWBAARHEID.md`) en de ketenproeven (`tafelproef`, `ritproef`,
`toelatingsproef`, `adamproef`, `lusproef`, `momentproef` en wat erbij komt).
Een bewijs dat je weglaat leest als een bewijs dat je haalt; daarom staat wat
niet gemeten is er met de reden (`GEEN_FIXTURE`, `NIET_GETEST`, `openBekend`,
`nietGebouwd`).

Er komt geen schijnfunctionaliteit: geen knop die niets doet, geen mockresultaat
op een echt scherm, geen backend die niet is aangesloten, en geen AI die beweert
iets gedaan te hebben. En er wordt niets herbouwd wat er al is: aansluiten, niet
uitvinden — en een nieuwe naam wordt eerst tegen de code gehouden.

## 3. Wat dit besluit sluit: de testwereld wordt gebouwd

`BETROUWBAARHEID.md` par. 4 en par. 7 stap 4 zeiden dat de gecontroleerde
testwereld *een besluit vraagt*. **Dat besluit is hiermee genomen: bouwen.**
De vorm ligt al vast en verandert niet: een simulatie-adapter vervangt de rail,
nooit de poort (`MAGNAATLAB.md`); elke adapter heeft een grendel die fail-closed
is; geen vlag in de productieweg; en een simulatie mag nooit een handeling laten
slagen die in het echt niet zou slagen. Daarmee gaan bewijs 3, 5 en 7
(voltooibaar, persistent, herstelbaar) open. Werkstroom F voert het uit en Q
kwalificeert de geïntegreerde uitkomst.

In de inventaris staat dat als correctie in `TOEZEGKLASSEN.json`: de regel van
par. 7 stap 4 is daar `toegezegd`, met dit besluit als reden. Andere open punten
in `BETROUWBAARHEID.md` (bellen/video in een headless browser, de acht bewijzen
per belofte) blijven wat ze waren.

## 4. De zes bouwstromen en de kwalificatiestroom

| werkstroom | wat | werkterrein |
|---|---|---|
| A — Experience | Heritage, Edge 3.0, de bestaande schermen, cinematische samenhang, responsiviteit en toegankelijke interactie | bestaande Heritage- en Edge-bronnen en de schermen die ze gebruiken |
| B — Spatial | Flow ↔ Spatial, TravelOS, WorkOS, panelen, sessiecontinuïteit, niet-opgeslagen werk, herstel en foutisolatie | bestaande Spatial Shell, Workspace Runtime, modulecontracten en domeinbronnen |
| C — Universal Concierge | Coordination Envelope, Universal Service Case, organisaties, rollen, mandaten, delegatie en sectorprofielen | bestaande bevoegdheids-, organisatie-, concierge- en domeincontracten; geen tweede backend |
| D — Revenue | catalogus, producten, entitlements, abonnementen, betaalbewijs, reconciliation en B2B/B2C/B2B2C | bestaande commerce-, prijzen-, Pass- en Pay-grenzen |
| E — Rahul | Intent Router, Capability Manifest en gecontroleerde contextuele bediening | bestaande Rahul-, Stuur-, Trusted Execution- en capabilitybronnen; geen tweede agent |
| F — Platform | bestaande apps en widgets, testwereld, infrastructuur, integraties, technische afbouw en registergeneratie | bestaande domeinen, adapters naast echte rails en `scripts/` |
| Q — eindkwalificatie | één campagne over alle geïntegreerde apps, routes, schermen, Living Modules, servercapabilities, gebruikersketens, beveiliging, toegankelijkheid, prestaties, herstel en operatie | de afgeschermde releasekandidaat en bestaande releaseketen |

De eerdere testwereld en integratieproef vervallen niet. Ze zijn ondergebracht in
F en Q. De Rome-keten blijft een echte ketenproef over de werelden; de
gecontroleerde testwereld blijft de manier om externe effecten veilig te
bewijzen.

## 5. Coördinatie

- Eén bestaande architectuur en één completion-register: `APPWERKT.json`. De
  inventaris staat daarin als blok, niet ernaast.
- Eén afgeschermde integratietak verzamelt afhankelijke bouwstappen. Een stap
  noteert zijn basis en afhankelijkheden; een falende of onvolledige stap wordt
  nooit ongemarkeerd als stabiele basis behandeld.
- Onafhankelijke bouwstromen mogen doorwerken wanneer een andere stroom een
  niet-relevante kwalificatieafwijking heeft. Afhankelijke wijzigingen blijven
  in volgorde en krijgen gerichte lokale toetsing vóór de volgende laag erop
  voortbouwt.
- Geen conflicterende wijzigingen tussen werkstromen: iedere stroom blijft
  binnen zijn werkterrein en hergenereert geen registers die niet van hem zijn.
- Geen omzeiling van veiligheidsgrenzen, en geen automatische merges zonder de
  vereiste controles. Mergen blijft mensenwerk (`ONDERHOUD.md`).
- Iedere bouwronde rapporteert wat is gebouwd, geïntegreerd en lokaal getoetst,
  wat nog eindkwalificatie vraagt en welke blokkades of afhankelijkheden er
  zijn. Alleen de eindkwalificatie mag de stand `DEFINITIEF_GEDEKT` toekennen.
- Een poort bewijst alleen zijn eigen bereik (`LAT.md` regel 17): zeg welke poort
  groen staat en wat niet bevestigd is.

### 5.1 Eén afbouwadministratie

`AFBOUWPROGRAMMA.md` bewaart het eigenaarsbesluit, de werkstroomstand en de
afhankelijkheden. `APPWERKT.json` blijft het gegenereerde completion-register
en de bron voor de acht bewijsstanden. Er komt geen tweede register.

De ontwikkelrapportage gebruikt zes labels: `GEBOUWD`, `GEINTEGREERD`,
`LOKAAL_GETEST`, `EINDKWALIFICATIE_NODIG`, `GEBLOKKEERD` en
`DEFINITIEF_GEDEKT`. Deze labels vervangen de bewijsstanden in `APPWERKT.json`
niet. Ze voorkomen juist dat lokaal geslaagd werk voortijdig als volledig
bewezen wordt beschreven.

| werkstroom | actuele bouwstand | afhankelijkheid | kwalificatiestand |
|---|---|---|---|
| A — Experience | Edge Quiet Presence is geïntegreerd op `main`; overige schermmigratie loopt | Heritage en bestaande schermcontracten | `EINDKWALIFICATIE_NODIG` |
| B — Spatial | TravelOS ondersteunt Flow ↔ Spatial, native aanvraag, veilige hervatting, accountisolatie, Edge-contextacties, antwoordverliesherstel en menselijke bevestigingsstatus. WorkOS is als tiende Living Module aangesloten: pas na expliciete activatie leest hij de bestaande `/api/bedrijf`-bronnen, bewaart hij geen lidtoken en kan hij veilig naar dezelfde werkruimte in de volledige Flow overdragen | TravelOS- en WorkOS-bronroutes, Workspace Runtime, bestaande account- en lidmaatschapssessies | `GEBOUWD`, `GEINTEGREERD`, `LOKAAL_GETEST`, `EINDKWALIFICATIE_NODIG` |
| C — Universal Concierge | Zaakregiebeeld en RTG Regie projecteren bestaande Concierge Case/Lus en Servicezaak. De bestaande Bedrijfspoort bindt nu een eigen zaak read-only aan exact dezelfde RTG-account, actieve WorkOS-werkruimte, tenant en eventuele concernentiteit; vreemde zaken, tenants en ingetrokken lidmaatschappen sluiten zonder bronlek | bestaande concierge-, service-, WorkOS-, tenant-, organisatie- en bevoegdheidsbronnen | `GEBOUWD`, `GEINTEGREERD`, `LOKAAL_GETEST`, `EINDKWALIFICATIE_NODIG` |
| D — Revenue | naast de catalogus- en betaalbewijsgrenzen bestaan nu een read-only entitlementprojectie, accountoverzicht en eligibility-contract voor B2C, B2B en B2B2C. Alleen een exact gebonden, geboekte, niet teruggedraaide en transactiespecifiek gereconcilieerde betaling kan `ELIGIBLE` worden; de huidige ruwe betaalbronnen missen nog de vereiste product-, account-, tenant- en reconciliatiereferenties, dus publieke aankoop en toekenning blijven dicht | financiële veiligheid, exacte adaptercontracten, Payment Truth, RTG Pay en expliciete eigenaarspoorten | `GEBOUWD`, `GEINTEGREERD`, `LOKAAL_GETEST`, `GEBLOKKEERD`, `EINDKWALIFICATIE_NODIG` |
| E — Rahul | accountgebonden tabgeschiedenis en goedkeuringscontext sluiten fail-closed. Rahul leest van Workspace uitsluitend id, presentatiemodus en de door dezelfde actuele Edge-context bevestigde module; modules kunnen alleen expliciet veilige `read`, `search`, `open` en `propose`-acties declareren, zonder payload, route of uitvoeringsrecht | bestaande Rahul-, Fluister-, Stuur-, modulemanifest-, sessie- en Trusted Execution-grenzen | `GEBOUWD`, `GEINTEGREERD`, `LOKAAL_GETEST`, `EINDKWALIFICATIE_NODIG` |
| F — Platform | het canonieke wereldregister ontsluit 116 UX-functies; tien Living Modules volgen hetzelfde runtimecontract. WorkOS, RTG Regie en de Rahul-projectie gebruiken dezelfde offline shell en bestaande Command-/wereldnavigatie, zonder tweede app-catalogus | de zes productstromen, bestaande routekaart, service workers en registergeneratoren | `GEBOUWD`, `GEINTEGREERD`, `LOKAAL_GETEST`, `EINDKWALIFICATIE_NODIG` |
| Q — eindkwalificatie | start nadat de overeengekomen scope in de kandidaat is geïntegreerd | A t/m F | `GEBLOKKEERD` door nog lopende bouw |

De mapping van C heeft aangetoond dat een tweede generieke case-opslag of een
nieuwe lifecycle de bestaande Concierge Case, Servicezaak en domeinobjecten zou
dupliceren. Het eerste universele contract is daarom een afgeleide, read-only
regieprojectie met getypeerde bronverwijzingen, fasen, verantwoordelijkheden,
relaties en niet-uitvoerbare actieverklaringen. Het bezit zelf geen status of
domeininhoud en iedere handeling blijft bij het brondomein opnieuw geautoriseerd.
`RTG Regie` leest deze projecties via de bestaande Service- en
Privékantoorpoorten. De module bewaart geen zaakdata in de
werkruimtestaat. De Edge ontvangt uitsluitend vooraf gedeclareerde acties;
`vraag een mens` loopt opnieuw door de bestaande serviceautorisatie en vraagt
expliciete bevestiging. Gericht zijn het modulecontract, Edge-selectie,
bronisolatie en de bestaande Service- en Privékantoorketens lokaal groen. De
platformbrede scherm- en herstelkwalificatie blijft voor Q gereserveerd.

De nieuwe Bedrijfspoort voegt geen zaak of bevoegdheid toe. Hij bevestigt bij
iedere lezing opnieuw vier reeds bestaande waarheden: het actuele RTG-account,
het actief aan dat account gekoppelde WorkOS-lidmaatschap, de tenant van de
gekozen werkruimte en het eigendom van precies de gevraagde Bureau- of
Servicezaak. De contextadapter projecteert daarna alleen bronreferenties en
niet-uitvoerbare acties. Een tweede tenant, vreemde zaak, losgemaakte
tenantbinding, onbekende concernentiteit of ingetrokken lidmaatschap levert geen
gedeeltelijke context op.

De mapping van D heeft aangetoond dat `server/kern/revenue/catalogus-v1.js` al
de gesloten catalogusbron is en dat RTG Pay, Payment Truth en Economic Runtime
de financiële waarheid dragen. De bestaande AI-creditroute mag nog niet als
publiek aankoopbewijs gelden. De directe grant is inmiddels gesloten: zonder
servermatig geverifieerde settlement-, ledger-, betaler-, product-, prijs- en
valutakoppeling wordt niets toegekend, en een evidence-id werkt precies een
keer. `REV-AI-CREDIT-001` blijft zichtbaar totdat de exacte adapter tussen
catalogus, Payment Truth, grootboek en transactiereconciliatie end-to-end is
aangesloten. De reeds gebouwde
entitlementprojectie en het accountoverzicht verlenen niets: zij behouden per
bron de nominale aanspraak, effectieve stand, ontzegreden, lifecycle en
provenance. Het eligibility-contract weigert ontbrekende of afwijkende
account-, tenant-, product-, offer-, bedrag-, valuta-, payment-, ledger- en
reconciliationbinding en iedere refund, reversal of onzekere uitkomst. Deze
grens houdt alleen de afhankelijke commerciële keten tegen; de onafhankelijke
bouwstromen gaan door.

De mapping van E gebruikt geen tweede agent of intent-uitvoerder. De Workspace
Runtime projecteert alleen een door de actieve module expliciet vrijgegeven
assistentmanifest. Rahul krijgt daarvan uitsluitend actie-id en soort. Hij
krijgt geen payload, endpoint, formulierinhoud, werkruimtelayout, concept,
toegangstoken of mutatiefunctie. De bestaande Action Broker, serverautorisatie,
bevestiging en Trusted Execution blijven de enige uitvoeringstrechter.

## 6. De inventaris: vier klassen

| klasse | wat het betekent |
|---|---|
| `toegezegd` | het huis heeft het beloofd; het wordt gebouwd, geïntegreerd en bewezen met de acht bewijzen |
| `afgewezen-met-grens` | het komt er niet, en de grens die dat zegt staat erbij |
| `vraagt-besluit` | geblokkeerd tot een besluit van de eigenaar aantoonbaar genomen is |
| `extern` | geblokkeerd tot een voorwaarde buiten de code aantoonbaar vervuld is (juridisch, vergunning, certificering, leverancier, netwerk, sleutel) |

De klassen zijn gesloten; `scripts/lib/toezegklassen.js` weigert elke andere.

**Hoe hij gelezen wordt.** Deterministisch waar het kan. De richtingsdocumenten
dragen per onderdeel al een stand (staat, een stap weg, vraagt een besluit,
jaren weg), in een tabel met een stand-kolom, als vetgedrukte cel in een
tabelrij, of achter een kop. Die worden gelezen met de letterlijke regel als
citaat, plus bestand en regelnummer. De stand bepaalt de klasse: staat, een stap
weg en jaren weg zijn `toegezegd` (de stand blijft erbij als tweede as, want
"jaren weg" is toegezegd maar afhankelijk), vraagt een besluit is
`vraagt-besluit`. Een markering in lopende tekst wordt NIET gelezen, omdat daar
niet af te lezen is over welk onderdeel hij gaat; die worden geteld en niet
geraden.

**Wat een oordeel vraagt, staat in `TOEZEGKLASSEN.json`.** Afgewezen en extern
zijn geen markering maar een oordeel. Dat bestand is met de hand en met opzet
klein, en elk item draagt een citaat dat LETTERLIJK op een regel van zijn
document moet staan. Staat het er niet meer, dan is het item rot: het telt niet
stil mee, het staat in `rot`, en `test/toezegklassen.test.js` zakt. Een
geblokkeerd item zegt welke voorwaarde aantoonbaar vervuld moet zijn. Valt een
item op dezelfde regel als een gelezen markering, dan wint het besluitbestand.

**De stand bij lezing** (levende getallen uit `APPWERKT.json`, bijgehouden door
`npm run getallen`): over <!--getal:toezeg.documenten-->176<!--/getal-->
documenten zijn er <!--getal:toezeg.toegezegd-->897<!--/getal--> onderdelen
`toegezegd`, <!--getal:toezeg.afgewezen-->20<!--/getal-->
`afgewezen-met-grens`, <!--getal:toezeg.besluit-->88<!--/getal-->
`vraagt-besluit` en <!--getal:toezeg.extern-->10<!--/getal--> `extern`.
Daarnaast liggen er <!--getal:toezeg.proza-->220<!--/getal--> markeringen in
lopende tekst die bewust niet zijn gelezen.

**Wat hij niet is.** Geen tweede belofteregister: `BELOFTE.json` zegt of de
BESTANDEN achter een belofte bestaan, deze inventaris in welke KLASSE een
onderdeel valt. En geen bewijs: `toegezegd` met stand "staat" is wat het
document beweert. Bewezen is het pas via de acht bewijzen of een ketenproef.

Draaien: `npm run appwerkt:inventaris` werkt alleen het blok bij, zonder
browser, en laat elk ander veld van `APPWERKT.json` byte voor byte staan;
`npm run appwerkt:inventaris:controle` zakt als het blok achterloopt op de
documenten, een citaat rot is of een klasse buiten de vier valt. Een volle
meting (`npm run appwerkt`) schrijft het blok gewoon mee.

## 7. Wat geblokkeerd is

De volledige lijst staat in `APPWERKT.json` onder
`toezegklassen.geblokkeerd`, per item met citaat, reden en voorwaarde. De
geblokkeerde items uit het besluitbestand:

| onderdeel | klasse | voorwaarde |
|---|---|---|
| doneerknop en incasso (`GIFT.md`) | vraagt-besluit | besluit 2 van GIFT.md genomen en de giftstand open met wallet en vorm |
| verborgen dwangmodus met tweede pincode (`HDI.md` par. 5.7) | vraagt-besluit | threat model, en het besluit om hem heel te bouwen |
| B7, vergeten tegenover collectieve kennis (`VERDER.md`) | vraagt-besluit | de eigenaar kiest een van de twee opties |
| uitbetalen aan een mens, CAR-01 (`MENSNETWERK.md`) | vraagt-besluit | het juridische besluit, na GIFT.md |
| de acht bewijzen per belofte (`BETROUWBAARHEID.md` par. 7 stap 6) | vraagt-besluit | welke ingangen samen een belofte vormen |
| ANBI-status van de RTFoundation (`GIFT.md`) | extern | beschikking van de Belastingdienst |
| juridische toets machtigingstekst (`GIFT.md`) | extern | een jurist |
| eigen betaaltoken buiten het gesloten circuit (`TOKEN.md`) | extern | EMI-vergunning bij DNB of een vergunninghoudende EMI |
| externe security-audit en pentest (`PRODUCTION.md`) | extern | rapport van een externe auditor |
| echte betaalcertificering (`PRODUCTION.md`) | extern | betaalprovider en PCI-scope |
| juridische validatie van het tijdbeleid (`VRIJHEID.md`) | extern | een arbeidsjurist |
| rechtspersoon en statuten DemocratieOS (`POLITIEK.md`) | extern | notaris en jurist; een echte partij pas na groene fase B en C, en niet die van de oprichter |
| OSM-bouwer buiten Nederland (`KAARTEN.md`) | extern | een bouwomgeving die de bron mag ophalen |
| vertrouwde sleutellijst op het toestel (`TOESTEL.md`) | extern | een ondertekeningssleutel bij een mens |
| ondertekende modelbytes uit de bron (`TOESTEL.md`) | extern | toegang tot de oorspronkelijke bron |

Daarnaast draagt de inventaris de onderdelen die een document zelf als "vraagt
een besluit" markeert. Een deel daarvan is inmiddels besloten in een ander
document, en dat is een eerlijke beperking van deze meting: het document dat de
markering draagt, is de bron. Een correctie hoort in dat document of als item in
`TOEZEGKLASSEN.json`, nooit stil in de telling. Een voorbeeld dat al bekend is:
`CLAUDE.md` zei dat het genre voor een extern reisbureau niet bestond, terwijl
`TRAVELCOMMERCE.md` par. 9b het op 10 september 2026 bouwde. Daarom staat het
niet bij de geblokkeerde items.

## 8. De eindtoestand

**<!--getal:toezeg.onderdelen-->114<!--/getal--> onderdelen in `APPWERKT.json`
is de huidige registerbasis, niet het definitieve aantal.** Het register meet per
onderdeel uit `MAPPEN`, en die lijst groeit wanneer er een toegezegd onderdeel
bij komt. Het programma is af wanneer:

1. elk onderdeel in de klasse `toegezegd` gebouwd en geïntegreerd is;
2. elk onderdeel uit `MAPPEN` alle acht bewijzen haalt op BEWEZEN, gemeten door
   de bestaande infrastructuur en niet door een eigen toets;
3. elke relevante keten gesloten is in een ketenproef, of een open schakel
   draagt met oorzaak, eigenaar en voorwaarde;
4. elk `vraagt-besluit`- en `extern`-onderdeel er nog staat met zijn voorwaarde,
   tot die aantoonbaar vervuld is, en elk `afgewezen-met-grens`-onderdeel
   afgewezen blijft.

## 9. Wat deze inventaris (nog) niet kan

- Een onderdeel uit een document is nog niet gekoppeld aan een rij van
  `MAPPEN`. Welke documentonderdelen samen één functie vormen, staat nergens in
  de code; dat verzinnen zou een lijst opleveren die stelliger is dan wat het
  huis weet (dezelfde reden als `BETROUWBAARHEID.md` par. 7 stap 6).
- Markeringen in lopende tekst en standwaarden buiten de vier (gedekt, proven,
  half) worden geteld en niet gelezen.
- "toegezegd" komt uit het document. Of het onderdeel er werkelijk is, zeggen de
  acht bewijzen en `BELOFTE.json`, niet deze inventaris.
