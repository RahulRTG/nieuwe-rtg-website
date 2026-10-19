# Werk OS (link:werkos)

**Volledige werkzaamheid:** een organisatie met minstens twee leden legt in één
werkruimte haar taken, projecten, besluiten, contracten en uitgaven vast, en elk
object komt pas op zijn eindstand (taak klaar, mijlpaal gehaald, project
geaccepteerd, besluit geëvalueerd, contract actief of opgezegd, uitgave betaald)
als een ander lid dan de uitvoerder het binnen zijn recht heeft gekeurd; elke
stap staat met actor en reden in het journaal en is na een herstart en een
crash precies één keer terug te vinden. Getoetst: per soort één proefstap in
`scripts/lib/voltooi/werkos.js` die de eindstand haalt, plus een weigering voor
wie het recht mist.

Eigenaar volgens SCHERMEIGENAAR.json: `werk.organisatie` -> `apps/werk.html`,
doelgroep business-lid ("briefing, aandacht, personeel/onboarding en besluiten
in één overzicht"). Ingang: `/apps/werk.html`, of via de werkkiezer (`os:werk`,
rol `werkruimte`). Doelgroep: de zaak en de organisatie (eigenaar, manager,
medewerker, extern), nooit een gast.

Werk OS is de kern van de WorkOS-familie. De dwarsthema's capaciteit,
werkstromen, kwaliteit, contractverplichtingen, inkoop, personeel, begroting,
besluitvorming, continuïteit en audit (feiten-dwars.txt) landen hier of worden
hier zichtbaar. Werk is daarbij **geen tabel**. Het is een projectie over
objecten die al in hun domein wonen (ARBEID.md par. 2: "rekent dit, of bezit
dit?"). Par. d.0 werkt die projectie veld voor veld uit.

---

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/werk.html` met de modules in `public/apps/werk/`
  (o.a. `modules.js`, `acties.js`, `uitgaven.js`, `command.js`, `status.js`,
  `praktijk*.js`).
- Server: `server/bedrijf/` (78 bestanden), gemonteerd in volgorde via
  `server/bedrijf/index.js`. De routes `/api/bedrijf/*` liggen erachter.
- Opslag: `db.data.werkruimtes[CODE]` via `server/kern/tenant/opslag.js`.
  Werkruimtecode `W` plus vijf hextekens (`server/bedrijf/werkruimte.js`).
  Geen eigen database.
- Bakken per werkruimte, elk in de eigen deellaag:
  - `projecten` en `taken` (`project.js`, `taak.js`, herhaalsleutel in `taak-idem.js`);
  - `besluiten` (`besluit.js`, `besluit-loop.js`, `besluitlijst.js`, `geheugen.js`);
  - `contracten` (`contract.js` + `contractklok.js`);
  - `uitgaven` (`uitgave.js`, `tekengrens.js`, `samentekenen.js`, `entiteitbetaling.js`);
  - kennis, klanten, tickets, storingen, bouw, IT, vlaggen, releases;
  - in- en uitdienst (`indienst.js`, `uitdienst.js`), leden en rollen
    (`leden.js`, `rollen.js`, `rollen-register.js`, `rollen-beleid.js`);
  - het journaal (`rollen.js` `log()`) en de gebeurtenislaag
    (`gebeurtenis.js`, `gebeurtenis-lezen.js`, `gebeurtenis-veld.js`).
- Lezers die niets bezitten:
  - `beeld.js`, `beeld-consolidatie.js`, `gezondheid.js` (dagbeeld);
  - `inzicht.js` (zoek, dossier) boven `server/kern/werkcommand/register.js`;
  - `toen.js` (bestaan op datum X), `uitval.js` (wat valt om als een
    wederpartij wegvalt), `gevolg.js` (wat blijft open), `mijnwerk.js`
    (alleen eigen werk, geen parameter voor een ander).
- Regels:
  - `regels.js` + `regelpoort.js`: één goedkeurroute `/api/bedrijf/keur` voor
    contract, besluit en uitgave. Een mens keurt één keer per object. Een
    goedkeuring vervalt als de waarde stijgt.
  - Commandobalk: `handeling.js`, `handeling-lijst.js`, `handeling-uitvoering.js`.
- Aansluiting zonder kopie (`index.js`: "AANGESLOTEN, niet overgedaan"):
  - `aansluiting.js` (tellingen van agenda, postvak en kluis);
  - `postbrug.js` (RT Mail -> taak/ticket met herkomst);
  - `herkomst.js` (`rtg://soort/id`, nooit opgelost).
- Identiteit: eigen inlog buiten productie (werkruimtecode + beheer- of
  lid-token). In productie eerst de RTG-accountpoort (`productie-identiteit.js`).

**Wat bewezen is**

| Bron | Stand |
|---|---|
| APPWERKT.json (114 onderdelen, 0 defecten) | `link:werkos`: bereikbaar B, bedienbaar B, menselijk NT, voltooibaar B, waarheidsgetrouw B, persistent B, bevoegd NT, herstelbaar B |
| VOLTOOIPROEF.json (stempel 2026-10-19T04:47, f85c044e) | scenario `werkos`: `/api/bedrijf/start`, `/taak/maak` en `/taken` (`scripts/lib/voltooi/werkos.js`) |
| BEVOEGD.json (05:08, 55ed79f9) | werkos: 8 routes gemeten, 8 open, dus niet getoetst |
| IDOR.json | 1999 routes, 0 doorbraken, 0 lekken (over het hele huis) |

Het centrale bewijs dekt dus **taken maken en terugvinden**. Al het andere
hieronder heet "staat, onbewezen", tenzij een eigen toets genoemd wordt:
project, besluit, contract, uitgave, uitval, gevolg, toen, indienst en de
regelpoort.

**Wat de code zelf als niet gebouwd opgeeft**

- `gevolg.js` `NIET_GEREKEND`: kosten, contracten ("de contractbibliotheek
  weet niet welk contract aan welk project of welke persoon hangt"), controls,
  terugdraaien.
- `uitval.js`: "een leverancier bestaat hier niet", alleen de vrije tekst
  `wederpartij`.
- `project.js`: geen zelfgemeld percentage. Een budgetoverschrijding wordt
  gemeld en niet geblokkeerd. Een acceptatie of oplevering is er niet.
- `taak.js`: geen verwijder- of archiefroute.
- ARBEID.md par. 2: `work_item` in de manifesten zijn "labels zonder
  implementatie". Par. 3: drie werkrelaties lezen elkaar niet. Par. 7a:
  `employment` is de waarheid, het werkruimtelid "blijft een productinstantie en
  geen juridische relatie".
- OFFICE.md:
  - P9: geen register van gebeurtenisnamen en tijdregels;
  - P12: geen staatsmachine die een gebruiker bouwt;
  - P13: geen besluitdossier;
  - P14: geen procesmeting.

**Gelezen in de code (niet beproefd), van belang voor de kaart**

- Het scherm roept `gevolg`, `mijnwerk`, `besluit/raakt`, `project/wijzig`,
  `project/mijlpaal`, `project/risico` en `taak/wacht-op` niet aan.
- Een mijlpaal krijgt `gehaald: false` (`project.js`). Er is geen route die
  hem op gehaald zet (grep op `gehaald` in `server/bedrijf/`). `waarom.js`
  telt elke mijlpaal met een verstreken datum daardoor blijvend als gemist.
- `contract.js` rekent de waarde om met `Math.round(x * 100)`. `project.js` en
  `uitgave.js` gebruiken `kern/geld/eenheid.js`. Het zijn twee rekenwijzen
  voor hetzelfde begrip.
- Een uitgave draagt `afdeling` maar geen `projectId`. Een contract draagt
  `klantId` maar geen `projectId`.
- In `werk.html` staat het paneel "Human Enterprise" vast in de HTML (zie
  "Productfouten" onderaan).

---

## b. Marktvergelijking

Alles is geraadpleegd op 2026-10-19, via de zoektool en niet live geopend.
Echte merken staan hier alleen ter vergelijking. Elke regel in deze tabel komt
uit een zoeksamenvatting en draagt daarom het label **(te controleren)**; geen
ervan is een eis of een weigerregel in de functies hieronder.

| Leider | Wat achter de betaalmuur zit | Wij | Bron |
|---|---|---|---|
| Asana Advanced / Enterprise+ | doelen, portfolio's, goedkeuringsworkflows, werklast/resourcebeheer. Enterprise+: SIEM (Audit Log API), dataresidentie | doelen: nee. Portfolio: half (`beeld-consolidatie.js`, holding). Goedkeuring: ja (`regelpoort.js`). Werklast: nee. Auditlog: ja (journaal + gebeurtenislaag), SIEM-uitvoer: nee | https://asana.com/pricing (via zoektool, live te controleren) **(te controleren)** |
| Jira Premium | Advanced Roadmaps (planning over teams), sandbox, 99,9% SLA. Standard: rollen en auditlog | rollen: ja (18 rechten, 14 rollen, einddatum). Planning over teams: nee. Sandbox: nee in Werk OS (CONCERN noemt hem) | https://www.atlassian.com/software/jira/pricing (via zoektool, live te controleren) **(te controleren)** |
| Smartsheet AWM / Enterprise | Control Center (portfolio-uitrol), baselines, scenarioplanning; Resource Management als add-on | baseline: nee. Scenario: half (`gevolg.js` voor wegvallen, `kern/fiscaal/scenario.js` niet voor projecten). Uitrol van structuur: nee | https://www.smartsheet.com/advanced-work-management en https://www.smartsheet.com/pricing (via zoektool, live te controleren) **(te controleren)** |
| ServiceNow SPM Pro (duurste) | hybride roadmaps, doelenbeheer, scenarioplanning, portfoliofinanciën | portfoliofinanciën: nee (geen jaarbegroting of kostenplaats). Doelen: nee | https://www.servicenow.com/products/strategic-portfolio-management.html (via zoektool, live te controleren) **(te controleren)** |
| Azeus Convene / Diligent (besluitvorming) | besluiten, review rooms, auditsporen; AI-notulen | besluit met advies, bezwaar en evaluatie: ja (`besluit.js`, `geheugen.js`). Besluitdossier: nee (P13). AI-notulen: niet doen als besluitbron | https://www.azeusconvene.com/pricing, https://www.diligent.com/products/boards (via zoektool, live te controleren) **(te controleren)** |

Wat vrijwel alle topniveaus delen (markt-enterprise.txt): SSO en SCIM,
auditlog/SIEM, dataresidentie, DLP, sandbox en een vaste CSM. Werk OS heeft
een auditlog en een rechtenjournaal. SCIM bestaat in het huis
(`routes/scim.js` volgens de kop van `bedrijf/index.js`). SIEM-uitvoer en een
sandbox per werkruimte zijn niet gevonden.

Waar wij verder gaan dan de markt:
- een budgetoverschrijding zegt het zonder te blokkeren;
- een bezwaar blijft op een aangenomen besluit staan;
- een goedkeuring vervalt bij een hoger bedrag;
- `gevolg.js` noemt wat het niet rekent.

Geen van de vergeleken pakketten maakt die laatste belofte openbaar (via
zoektool niet gevonden).

---

## c. Analyse van het volledige domein

**Particulier.** Een zzp'er of kleine maatschap heeft werk zonder organisatie:
- klussen, offertes, een paar contracten (huur, verzekering, licentie);
- uitgaven en de vraag "wanneer moet ik opzeggen".

Werk OS is daar te zwaar als het met rollen begint. De kern moet werken met
één lid.

**Professioneel.** Een team of afdeling heeft:
- taken met afhankelijkheden en geschreven uren;
- besluiten die later uitlegbaar moeten zijn;
- contracten met termijnen en uitgaven met functiescheiding.

**Organisatie.** Een bedrijf of groep heeft daarnaast:
- personeel met wettelijke termijnen;
- kwaliteitsaudits, leveranciersbeoordeling en continuïteitsplannen;
- een begroting per afdeling.

**Wettelijke en normatieve eisen** (domein-max.txt, geraadpleegd 2026-10-19).
Geen van deze primaire teksten is door de schrijver zelf nagelezen; elke regel
draagt daarom **(te controleren)** (workos.md par. 11). In de functies en in het
eindcontract staat zo'n regel hooguit als signaal "te controleren", nooit als
weigering. De contantregel van € 3.000 staat hier bewust niet (workos.md par. 11).

| Eis | Bron | Wat het voor Werk OS betekent |
|---|---|---|
| **(te controleren)** Arbeids- en rusttijden registreren, 52 weken bewaren (art. 4:3 ATW). Boetenorm €10.000 | https://www.nlarbeidsinspectie.nl/nederlandse-arbeidsinspectie/sancties-en-handhavingsmethoden/boete/boetes-atw | Geschreven uren in `taak.js` zijn projecturen, geen arbeidstijdregistratie. Die woont bij `kern/vrijheid/` en de klok. Werk OS mag niet doen alsof. |
| **(te controleren)** Fiscale bewaarplicht 7 jaar, onroerende zaken 10 jaar (art. 52 AWR) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | Uitgaven en contracten mogen niet hard weg. `contract.js` ruimt al niets op; een bewaarklasse per bak ontbreekt. |
| **(te controleren)** Betaaltermijn B2B max. 60 dagen, 30 zonder afspraak; groot aan mkb max. 30 (art. 6:119a BW) | https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/ | Een uitgave heeft geen vervaldatum. De termijn is te rekenen als die er komt. |
| **(te controleren)** Besluit buiten vergadering vraagt instemming van alle vergadergerechtigden; bestuurders houden een raadgevende stem (art. 2:238 BW). Notulenplicht te controleren | https://www.dirkzwager.nl/kennis/artikelen/raadgevende-stem-van-de-bestuurder-ook-buiten-vergadering | `besluit.js` telt één stem per persoon, maar kent geen "alle gerechtigden" of raadgevende stem. Een AVA-besluit is geen werkruimtebesluit: grens noemen. |
| **(te controleren)** ISO 9001: 7.5 gedocumenteerde informatie, 8.4 externe leveranciers, 9.2 interne audit, 9.3 directiebeoordeling, 10.2 corrigerende maatregelen. Versie 2026 gepubliceerd, overgang te controleren | https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/ | Leveranciersbeoordeling (8.4) en een auditobject (9.2) ontbreken. Corrigerende maatregel = een risico met maatregel (`project.js`), maar niet op organisatieniveau. |
| **(te controleren)** ISO 27001:2022 A.5.19-5.23 leveranciers | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes | Zelfde gat: geen leveranciersobject. |
| **(te controleren)** ISO 22301 clausule 8: BIA, strategie, plannen, oefenen | https://www.iso.org/standard/75106.html | `uitval.js` en `gevolg.js` zijn een begin van een BIA zonder kansen of bedragen. Een plan en een oefening ontbreken. |
| **(te controleren)** Cyberbeveiligingswet (NIS2), sinds 15-8-2026: 24 uur waarschuwing, 72 uur melding, 1 maand eindverslag | https://www.ncsc.nl/cyberbeveiligingswet-nis2/meldplicht | `storing.js` en `it.js` bestaan. Een meldklok op een incident is niet gevonden. RTG meldt niet namens de organisatie (voorbehouden). |
| **(te controleren)** AVG art. 33: datalek binnen 72 uur, altijd intern registreren | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken | Idem: klok en register, geen indiening. |
| **(te controleren)** RI&E verplicht met plan van aanpak (Arbowet art. 5) | https://www.nlarbeidsinspectie.nl/onderwerpen/aanleveren-rie/veelgestelde-vragen-rie | Een RI&E-plan is een project met risico's en maatregelen. De vorm bestaat; een RI&E-sjabloon niet. |
| **(te controleren)** Wet verbetering poortwachter: week 6, 8, 42, 87-91 (eerstejaarsevaluatie te controleren) | https://www.uwv.nl/nl/ervaringsverhalen/stappenplan-wet-verbetering-poortwachter | Hoort bij payroll/verzuim (`kern/payroll/verzuim`). Werk OS toont hoogstens dat er een termijn loopt, nooit de inhoud. |
| **(te controleren)** Personeelsdossier: ID-kopie 5 jaar na uitdienst, salaris 7 jaar, overig 2 jaar (AP) | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | `uitdienst.js` moet bewaarklassen kennen. Het recht `mens.gevoelig` vraagt al een reden. |
| **(te controleren)** Loontransparantie (EU 2023/970), beoogd per 1-1-2027 (te controleren) | https://www.rijksoverheid.nl/actueel/nieuws/2026/05/21/meer-openheid-over-loonkloof-tussen-mannen-en-vrouwen | Alleen voorbereiden. Werk OS bewaart geen loon. |

**Wat dat betekent voor software.** Werk OS rekent termijnen en laat ze zien.
Het dient niets in, beoordeelt niets inhoudelijk en bewaart niets dubbel.
Uren, loon, verzuim en de agenda horen bij hun eigenaar. Werk OS verwijst
ernaar.

---

## d. Functiecatalogus L1–L6

### d.0 Werk als controleerbaar object: de projectie, veld voor veld

Er komt **geen `work_items`-tabel** (ARBEID.md par. 2). Een "werkobject" is
een antwoord van een leesroute over één bestaand object, met etiketten.
Dezelfde vorm als `gevolg.js`: geen `save()`, geen eigen bak.

| Veld | Bron per soort (bestaand veld) | Rekent of bezit | Gat |
|---|---|---|---|
| soort + id | project, taak, besluit, contract, uitgave, ticket (`kern/werkcommand/register.js` kent de soorten) | rekent | Project Room (`rtgone-projecten.js`) en Concern zijn andere werelden: verwijzen via `herkomst.js`, nooit oplossen |
| doel | project `naam`+`omschrijving`, taak `titel`+`omschrijving`, besluit `titel`+`onderbouwing`, contract `titel`, uitgave `omschrijving` | rekent | geen |
| eigenaar | project `eigenaar`/`eigenaarId`, taak `wie`/`wieId` (`wieis.js`), besluit `eigenaar`, uitgave `door.lidId` | rekent | contract heeft geen eigenaarveld (gelezen in `contract.js`); toon dan "geen eigenaar vastgelegd" |
| bevoegdheden | recht van de soort (`rollen-register.js`), tekengrens (`tekengrens.js`, strengste van werkruimte en concerngraaf), `ontbreekt` uit `regelpoort.stand()` | rekent | geen; dit is het sterkste veld |
| budget | project `budgetCenten`; `voortgang()` geeft `kostenCenten` = uren × uurtarief en `overBudget` | rekent | uitgaven en contractwaarde tellen niet mee: er is geen `projectId` op beide |
| afhankelijkheden | taak `wachtOp[]`, `ouderId`; contract `klantId`; besluit `raakt[]` (`geheugen.js`) | rekent | project-op-project en contract-op-project ontbreken |
| besluiten | `besluit.raakt[]` teruggelezen (`/besluit/raakt-terug`) | rekent | koppeling is handwerk, en dat is bewust (kop `geheugen.js`) |
| bewijs | taak `klaarAt`/`klaarDoor`, contract `handtekeningen[]`, uitgave `goedkeuringen[]` + `betaald`, indienststap `door`+`waarom`, gebeurtenissen met actor/bron/reden | rekent | projectbewijs (bijlage, document-id) ontbreekt; Office-documenten alleen als `herkomst`-verwijzing |
| acceptatie | contract: twee handtekeningen + regels (`herzie`); uitgave: goedkeuring door een ander; besluit: `magSluiten` | rekent | project en taak: geen acceptatie. "klaar" zet de uitvoerder zelf |
| stand | taak `kolom`, project `status`, contract `status` (alleen `herzie` zet actief), besluit `status`, uitgave berekend | rekent | mijlpaal `gehaald` heeft geen route (zie a.) |
| zekerheid | elk veld draagt `bron: veld` of `bron: berekend` of `niet vastgelegd` | rekent | nieuw als etiket, geen nieuwe klasse; voorspellingen (gevolg) dragen `advies`-aard en `nietGerekend` |

Route-voorstel: `/api/bedrijf/werk/object {soort, id}`, achter `werkPoort` met
het recht van die soort. Wie het recht mist, krijgt een telling met reden,
zoals `geheugen.js` al doet. Wat dit bezit: niets.

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn werk | bestaat, niet op scherm (`mijnwerk.js`) | journaal + rijen met eigen `wieId`/naam | geen `lidId`-parameter; beheer-token 403 | naam zonder id telt als naam (`wieis.js`) | alleen het lid zelf, op verzoek | elk lid | lid zonder eigen sleutel: 403 met reden | Een medewerker ziet zijn open taken en besluiten; een collega kan dat overzicht niet opvragen. | klein | nu: verdieping (scherm aansluiten) |
| Werkobject lezen (d.0) | ontbreekt | zie d.0 | projectie, geen opslag | veldbron per veld | wie het object opent | recht van de soort | onbekend id 404, geen recht: telling | Bij een taak zie ik doel, eigenaar, waarop hij wacht, welk besluit hem raakt en wat nog ontbreekt, en bij elk veld waar het vandaan komt. | middel | nu: verdieping |
| Eigen uren | bestaat (`/taak/uren`) | `urenlijst` per taak | max. 24 per regel, 500 regels | geschreven, niet gemeten | projecteigenaar ziet totaal | recht `project` | geen ATW-registratie | Geschreven uren tellen op in de projectkosten en dragen een naam en datum. | klein | bestaat |
| Persoonlijke werkruimte zonder organisatie (zzp) | half: één lid kan maken (`werkruimte/maak`) | werkruimte met één lid | directie-rol op het eigen account (productie) | geen | n.v.t. | eigenaar | rollen- en regelschermen zijn leeg en lezen als gebrek | Een zzp'er gebruikt taken, contracten en uitgaven zonder eerst rollen in te richten; het scherm zegt dat goedkeuren door een ander bij één lid niet kan. | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Taken met afhankelijkheden | bestaat (`taak.js`) | `taken`, `wachtOp`, `ouderId` | cirkel 409; klaar geweigerd bij open wachtOp of kinderen | geen | toegewezene ziet op startscherm (`startBron('taken')`) | `project` | praktijk-taak alleen via Dagelijks werk | Een taak die op een andere wacht, kan niet op klaar; een cirkel wordt geweigerd met de namen. | — | bestaat; scherm voor wacht-op: nu: verdieping |
| Mijlpaal gehaald zetten | ontbreekt (alleen `gehaald:false`) | `project.mijlpalen[]` | via `werkVeld` met actor; gehaald = handeling van projecteigenaar | geen | projecteigenaar | `project` | datum verschuiven vraagt reden | Een gehaalde mijlpaal verdwijnt uit "gemist" in `waarom.js`; een verschoven datum laat de oude datum en reden zien. | klein | nu: herstel (het scherm telt nu elke verstreken mijlpaal blijvend als gemist) |
| Oplevering en acceptatie van een project | ontbreekt in Werk OS; bestaat intern in Project Room (`rtgone-projecten.js`) | taken, bewijs-verwijzing, accepteerder | zelfde regel als Project Room: alle taken klaar, minstens één bewijs, accepteerder ≠ uitvoerder | bewijs is een verwijzing, niet gecontroleerd | eigenaar + accepteerder bij gereedmelding | `project` + nieuw te kiezen recht (vraagt besluit) | externe accepteerder via rol `extern` met gedeelde ruimte | Een project staat pas op opgeleverd als een ander dan de uitvoerder het accepteert met bewijs; tot dan staat er "gereed gemeld". | middel | nu: verdieping (geen nieuw domein; na besluit 2) |
| Besluit met advies, bezwaar en evaluatie | bestaat (`besluit.js`, `geheugen.js`) | `besluiten`, `raakt`, evaluaties | stemmen pas na adviesronde; één stem per persoon; evaluatiedatum verplicht | evaluatie-uitkomst is menselijk oordeel | stemgerechtigden bij stemronde | `besluit` | AI beslist niet | Een aangenomen besluit toont zijn bezwaren en de evaluatie; niemand stemt twee keer. | — | bestaat |
| Contractklok | bestaat (`contract.js`, `contractklok.js`) | einddatum, opzegtermijn, stilzwijgend | laatste opzegdag uitgerekend | datum uit invoer | lijst binnen opzegtermijn | `recht` | verlopen blijft staan | De laatste opzegdag staat er vóór hij verstrijkt, met het aantal dagen. | — | bestaat |
| Contractverplichting met termijn en eigenaar | half: `verplichtingen[]` is vrije tekst (max. 30) | contract | per verplichting: wat, wie, wanneer, bewijs; klok per verplichting | tekst uit contract is menselijke invoer; AI-extractie alleen als kandidaat | eigenaar van de verplichting, x dagen vooraf | `recht` | geen eigenaar: zichtbaar als "zonder eigenaar" | Elke verplichting uit een contract heeft een eigenaar en een datum, of staat zichtbaar als onbeheerd. | middel | later |
| Uitgave met functiescheiding | bestaat (`uitgave.js`, `regelpoort.js`) | `uitgaven` | indiener keurt niet; strengste tekengrens; bedrag vast | betaling buiten RTG met kenmerk | keurders bij indienen | `geld`, `geld.goedkeuren` | beheer-token dient niets in | Een uitgave is pas goedgekeurd door een ander dan de indiener, binnen zijn grens. | — | bestaat |
| Uitgave en contract aan project hangen | ontbreekt (geen `projectId`) | `projectId` als verwijzing | budgetstand = uren + gekeurde uitgaven + contractwaarde naar rato (alleen wat vastligt) | contractwaarde over looptijd is een verdeling: `advies` | projecteigenaar bij overschrijding | `geld` om te koppelen, `project` om te lezen | uitgave zonder project telt bij afdeling | Het projectbudget telt ook gekeurde uitgaven mee, en zegt welke contracten eraan hangen. | klein | nu: verdieping |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen met einddatum en reden-inzage | bestaat (`rollen.js`, `rollen-register.js`) | 18 rechten, 14 rollen | rol buiten venster telt niet; 4 rechten vragen reden | geen | journaal | directie zet rollen | extern = nul rechten | Een tijdelijke rol vervalt vanzelf; inzage in een personeelsdossier staat met reden in het journaal. | — | bestaat |
| In- en uitdienst | bestaat (`indienst.js`, `uitdienst.js`) | stappen met `gedaan`, `door`, `waarom` | gemeten stap wordt niet met de hand afgevinkt | stap die niet meetbaar is, blijft menselijk | nieuwe medewerker + manager | `mens` | werkruimtelid ≠ dienstverband (ARBEID 7a) | Een indienstdossier toont per stap wie het deed; een stap zonder bewijs blijft open. | — | bestaat |
| Indienst leest dienstverband | ontbreekt | `kern/concern/employment.js` als bron, werkruimtelid als product | brug één kant op: employment -> werkruimtelid-voorstel, nooit terug | werkruimte zonder entiteit: "niet getoetst" | eigenaar van de entiteit kiest | eigenaar entiteit (concern), niet de werkruimtebeheerder | zelfde vorm als `dienstverbandInhaal` (voorstel, vinkjes uit) | Een nieuw dienstverband bij de entiteit verschijnt als voorstel in Werk OS; zonder keuze gebeurt niets. | middel | later (na besluit 1 van ARBEID 7a ook voor Werk OS) |
| Leveranciersobject + beoordeling | ontbreekt (`uitval.js`: "bestaat hier niet") | wederpartij-naam op contract; groothandel kent eigen leveranciers | beoordeling = afwijkingen en leverdata, geen score op een mens | naam-match is onzeker; telt dubbelen | inkoper bij afwijking | `recht` + `geld` | ISO 9001 8.4 is normatief, geen wet | Een leverancier heeft één id; uitval, contracten en beoordelingen hangen eraan; dubbele namen worden getoond, niet samengevoegd. | groot | vraagt besluit (eigenaar) |
| Jaarbegroting per afdeling | ontbreekt | `uitgave.afdeling`, project `budgetCenten` | begroting = vastgelegd bedrag per afdeling per jaar; realisatie = gekeurde uitgaven | realisatie zonder boekhouding is onvolledig: klasse `advies` | afdelingshoofd bij 80% en 100% | `geld` lezen, directie zet | afdeling is vrije tekst: eerst een lijst | De afdeling ziet begroot, gekeurd en betaald, en wat buiten RTG ging staat er als "niet zichtbaar". | middel | later |
| Kwaliteitsaudit (generiek) | ontbreekt; HACCP bestaat bij Horeca | controlelijst (`kennis.js`), bevinding, maatregel | bevinding -> maatregel met eigenaar en datum; afsluiten met bewijs door een ander | oordeel is menselijk | auditeigenaar, maatregeleigenaar | nieuw recht of `kennis.beheer` (vraagt besluit) | Horeca houdt HACCP; geen tweede | Een auditbevinding kan pas dicht als een ander dan de eigenaar het bewijs heeft gezien. | middel | later |
| Continuïteit: BIA-lijst | half (`uitval.js`, `gevolg.js`) | contracten, klanten, tickets, taken | wat valt om, per stap `naam` of `sleutel` als hardheid | geen kans, geen schade in euro's | directie op verzoek | `recht` + `besluit` | leverancier op naam | De lijst toont per afhankelijkheid of hij op een sleutel of op een naam rust. | klein | nu: verdieping (scherm) |
| Meldklok incident (NIS2/AVG) | ontbreekt | `storing.js`, `it.js` | 24 u / 72 u / 1 maand vanaf vastgesteld tijdstip, als signaal; de termijnen zijn **te controleren** en weigeren niets | of iets meldplichtig is: `voorbehouden` aan mens | IT-verantwoordelijke + directie | `it.beveiliging` (reden) | RTG meldt nooit namens | Bij een incident staan de drie termijnen met resterende tijd; er is geen knop "melden". | klein | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Gevolg van uitdienst/wegvallen | bestaat, niet op scherm (`gevolg.js`) | alle bakken, leest | geen `save()`; volgt rechten | `nietGerekend` met naam | vrager | rechten van de vrager | rollback bestaat niet | Voor een uitdienst zie ik welke taken en besluiten blijven hangen, en wat niet gerekend is. | klein | nu: verdieping (scherm) |
| Organisatie op datum X | bestaat (`toen.js`) | gebeurtenissen | bestaan, geen volledige toestand | gaten vóór gebeurtenislaag | vrager | `journaal`? (te verifiëren per route) | — | "Wie had op 1 maart welke rol" geeft een antwoord met de grens erbij. | — | bestaat |
| Budgetvooruitblik project | ontbreekt | uren-tempo, budget | lineaire doortrekking van geschreven uren | klasse `advies` (`scenario.doorrekening`), aannames in antwoord | projecteigenaar | `project` | < 2 weken data: geen getal | Bij een project staat "bij dit tempo over budget rond <datum>", met de aanname en het woord advies. | klein | later |
| Stuurlaag-voorstel | bestaat (`handeling.js`, `kern/stuur/`) | commandobalk | exact voorstel, aparte menselijke bevestiging; AI kan nooit meer dan vrager | gevolg voor 93-96 van 176 paden niet gemeten | vrager | eigen rechten | — | Een opdracht via de balk komt eerst terug als exact voorstel; zonder bevestiging gebeurt niets. | — | bestaat |
| Werkdruksignaal per persoon | ontbreekt | taken per persoon | — | — | — | — | — | — | — | niet doen: een cijfer op een mens (ARBEID par. 8.1); teamniveau via Vrijheid (`kern/vrijheid/teambeeld`) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werkruimte maken tot sluiten | half: maken bestaat, sluiten niet gevonden | werkruimte | export via `kern/tenant/uitgang.js` + `herstelproef.js` | — | eigenaar | directie | holding: dochter blijft | Een organisatie kan haar werkruimte exporteren, de export terugleest, en daarna sluiten met bewaarklassen. | middel | later |
| Bewaarklassen per bak | ontbreekt | contracten, uitgaven, personeel | huisregel: een uitgave of contract wordt gearchiveerd en nooit hard gewist (zelfde vorm als de Office-reparatie 697f1b5). De termijnen 7 jaar fiscaal, 5 jaar ID-kopie, 2 jaar overig en 52 weken uren staan erbij als signaal **(te controleren)** | welke klasse een rij heeft: `uitlegbaar` | beheerder bij einde termijn | directie | geschil houdt vast | Een uitgave verdwijnt nooit hard; bij een verzoek tot verwijderen ziet de beheerder de termijn die nog loopt, met het label "te controleren". | middel | later |
| Taak archiveren | ontbreekt (geen verwijder- of archiefroute) | taken | archiveren, nooit hard verwijderen; via `werkVeld` | — | toegewezene | `project` | taak met gebeurtenissen blijft leesbaar | Een afgeronde taak verdwijnt uit het bord maar blijft in dossier en `toen`. | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| RT Mail -> taak/ticket | bestaat (`postbrug.js`) | bericht-id als herkomst | twee sleutels, dezelfde persoon | — | ontvanger | lid gekoppeld aan RTG-account | — | Een mail wordt één taak met herkomst; een tweede klik maakt geen tweede. | — | bestaat |
| Contracten naar Onderneming | bestaat, lezend (`kern/onderneming/contracten.js`) | werkruimtecode op onderneming | klok gedeeld (`contractklok.js`) | — | ondernemer op dagbeeld | alleen een actief lid met eigen `rtgKey` (sinds d9fd905) | — | De ondernemer ziet de opzegdag op zijn dagbeeld, alleen van een werkruimte waar hij actief lid van is. | — | herstel: gerepareerd (commit d9fd905, `test/onderneming-contracten.test.js`) |
| Tekengrens uit concerngraaf | bestaat (`tekengrens.js`) | `concern/graaf-bevoegdheid.js` | strengste wint | vrije naam telt niet | keurder | lid op eigen RTG-codenaam | beheer-token koppelt niet | Een bestuurder met concernlimiet 10.000 keurt geen uitgave van 12.000, ook niet met werkruimterecht. | — | bestaat |
| Office-document als bewijs | half (`herkomst.js`, nooit opgelost) | `rtg://office/id` | lezer opent met eigen sessie | — | — | eigen RTG-sessie | werkruimtelid zonder RTG-account ziet alleen de verwijzing | Een bewijsverwijzing toont geen titel aan wie geen toegang heeft. | — | bestaat |
| Geld-gevolg tonen | ontbreekt in Geld | gekeurde/betaalde uitgaven | Geld leest, bezit niet | buiten RTG betaald: niet zichtbaar | — | eigenaar Geld (`geld.overzicht`) | — | — | middel | later (eigenaar Geld beslist) |

### Modus LOS

De kerntaak als Office, RT Mail, agenda, Concern, Onderneming en Geld uit staan:
taken met afhankelijkheden, besluiten, contracten met klok en uitgaven met
functiescheiding. Dat staat volledig in `server/bedrijf/` en heeft geen andere
app nodig. Elke groep hieronder noemt de letterlijke schermtekst als dat deel
ontbreekt. Een tekst met "(bestaat)" staat zo in de code; een tekst met
"(voorstel)" is de zin die er moet komen.

**1. Eigen: wat Werk OS zelf bezit en altijd kan.** Taken, projecten,
besluiten, contracten met klok, uitgaven met de regelpoort, rollen met
einddatum, het journaal en de lezers `gevolg`, `uitval` en `toen`. Valt hier
iets weg, dan is dat een fout en geen uitvalstand.

- Een startblok dat niet laadt (`server/bedrijf/start.js` vangt per blok):
  "dit blok kon niet worden opgehaald" (bestaat). Gewenst: "Dit blok kon niet
  worden opgehaald. Uw gegevens in de werkruimte zijn niet gewijzigd."
  (voorstel)
- Een lezer die iets niet rekent: `gevolg.js` noemt het in `nietGerekend`
  (bestaat), bijvoorbeeld kosten en contracten.

**2. Noodzakelijke platformdiensten.**
- Account en sessie: buiten productie de werkruimtecode met beheer- of
  lid-token; in productie eerst de RTG-accountpoort
  (`server/bedrijf/productie-identiteit.js`).
- Opslag: `db.data.werkruimtes` via `server/kern/tenant/opslag.js`.
- Stuurlaag: `server/kern/stuur/` onder de commandobalk (`handeling.js`).

Schermtekst als een van deze ontbreekt:
- sessie verlopen of account niet meer actief: "U bent niet meer aangemeld bij
  deze werkruimte. Meld u opnieuw aan met uw RTG-account; er is niets
  gewijzigd." (voorstel)
- stuurlaag niet beschikbaar: "De commandobalk is nu niet beschikbaar. Taken,
  besluiten, contracten en uitgaven werken gewoon via de knoppen." (voorstel)
- opslag niet beschikbaar: geen eigen tekst; de server weigert. Dit hoort bij
  bewijs 7 (herstelbaar), niet bij modus LOS.

**3. Optionele koppelingen: andere apps.**
- Agenda, postvak en kluis (`server/bedrijf/aansluiting.js`): zonder gekoppeld
  RTG-account geeft de bron `null` en geen telling (gelezen). Of het scherm dat
  als leeg of als "niet gekoppeld" toont, is niet nagegaan. Gewenste tekst:
  "Uw agenda, postvak en kluis zijn niet aan deze werkruimte gekoppeld. Dat is
  geen nul." (voorstel)
- Office en andere RTG-objecten (`herkomst.js`): "Deze verwijzing wordt NIET
  opgelost: er is geen titel of status van de RTG-kant opgehaald." (bestaat)
- Concern (`tekengrens.js`): "Geen tekengrens in de werkruimte. Is de
  werkruimte aan een entiteit gekoppeld, dan kan de concerngraaf nog een grens
  geven." (bestaat)
- RTG Rekening (`entiteitbetaling.js`): "Deze werkruimte betaalt niet vanaf een
  entiteit." gevolgd door de reden (bestaat); de uitgave valt terug op betalen
  buiten RTG met kenmerk.
- RT Mail (`postbrug.js`): "Uw postvak is niet aan deze werkruimte gekoppeld.
  Maak de taak met de hand; er gaat niets verloren." (voorstel)

### Modus SAMEN: het contractblok (voorstel)

Dit is een VOORSTEL in de vorm van CONTRACT uit `scripts/lib/appcontract.js`.
In dat bestand verandert niets. `belofte`, `ingang` en `bestanden` zijn de
velden van CONTRACT; `functie`, `familie`, `scenario` en `ketens` volgen de
vorm van de herziening. `eigenaar` is de SCHERMEIGENAAR-capability van de
kant waar de gegevens wonen.

```js
samen: {
  functie: 'link:werkos', familie: 'WorkOS',
  belofte: 'een inkoper legt een leverancierscontract vast dat pas actief wordt na goedkeuring door een ander binnen zijn concernlimiet en twee handtekeningen; de aanbetaling wordt door een ander gekeurd; en bij uitval van de leverancier ziet de directie welke contracten, klanten, tickets en besluiten aan hem hangen',
  ingang: '/apps/werk.html',
  bestanden: ['public/apps/werk/modules.js', 'public/apps/werk/acties.js', 'public/apps/werk/uitgaven.js'],
  scenario: 'scripts/lib/voltooi/werkos.js',
  ketens: [
    { naam: 'mail wordt werk', uitgeeft: 'taak met herkomst rtg://mail/<id>', ontvangt: 'bericht-id uit RT Mail',
      vorm: 'verwijzing', eigenaar: 'comm.mail', toestemming: 'het lid zelf, met zijn RTG-account aan de werkruimte gekoppeld',
      storingen: ['dubbele klik: één taak, "was al ontvangen"', 'postvak niet gekoppeld: taak met de hand, geen herkomst'],
      proef: 'nieuwe stap in scripts/lib/voltooi/werkos.js (postbrug twee keer)' },
    { naam: 'tekengrens uit de concerngraaf', uitgeeft: 'goedkeuring of weigering met reden', ontvangt: 'concernlimiet van de bestuurder',
      vorm: 'projectie', eigenaar: 'werk.concern', toestemming: 'keurder op eigen RTG-codenaam; beheer-token koppelt niet',
      storingen: ['limiet lager dan de waarde: weigering met de limiet', 'werkruimte los van de entiteit: alleen de werkruimtegrens, en dat wordt gezegd'],
      proef: 'nieuwe stap: keuren boven de concernlimiet zakt' },
    { naam: 'opzegdag op het dagbeeld van de ondernemer', uitgeeft: 'contractklok (laatste opzegdag)', ontvangt: 'niets',
      vorm: 'projectie', eigenaar: 'werk.onderneming', toestemming: 'alleen een actief lid met eigen rtgKey (sinds d9fd905)',
      storingen: ['lid vertrekt: stand geen-toegang', 'werkruimte opgeheven: stand werkruimte-weg', 'geen koppeling: aantal null, nooit 0'],
      proef: 'test/onderneming-contracten.test.js' },
    { naam: 'document als bewijs', uitgeeft: 'niets', ontvangt: 'verwijzing rtg://office/<id>',
      vorm: 'verwijzing', eigenaar: 'docs.office', toestemming: 'de lezer opent met zijn eigen RTG-sessie',
      storingen: ['lezer zonder toegang: alleen de verwijzing, geen titel'],
      proef: 'niet gevonden; voorstel: stap met een werkruimtelid zonder RTG-account' },
    { naam: 'uitdienst-gevolg', uitgeeft: 'lijst van open taken en besluiten', ontvangt: 'dienstverband (nog niet gekoppeld)',
      vorm: 'projectie', eigenaar: 'werk.concern', toestemming: 'rechten van de vrager; mens.gevoelig vraagt een reden',
      storingen: ['dienstverband niet gekoppeld: gevolg rekent alleen de werkruimte en zegt dat'],
      proef: 'niet gevonden; voorstel na besluit ARBEID 7a' }
  ]
}
```

### Modus SAMEN: een leverancierscontract van offerte tot uitval

Spelers:
- Ilse, inkoper met rechten `recht` en `geld`;
- Bram, directie met `geld.goedkeuren` en een concernlimiet van €10.000;
- Mo, projecteigenaar.

| Stap | Wat gebeurt er | Bron |
|---|---|---|
| 1 | Een offerte komt binnen in RT Mail. Ilse zet hem om naar een taak in project "Verbouwing keuken". | `postbrug.js`, `taak.js` |
| 2 | Ilse legt het contract vast: wederpartij, waarde €18.000, einddatum, opzegtermijn 60 dagen, stilzwijgend. | `contract.js` |
| 3 | Een bedrijfsregel eist boven €15.000 goedkeuring namens `recht` en `geld.goedkeuren`. Status: concept. | `regels.js`, `regelpoort.js` |
| 4 | Bram keurt namens `geld.goedkeuren`. Zijn concernlimiet is lager dan de waarde: geweigerd met de reden. Een tweede bestuurder keurt. | `tekengrens.js` |
| 5 | Twee handtekeningen (wij en wederpartij). `herzie` zet het contract op actief. | `regelpoort.js` |
| 6 | Mo schrijft uren. Het project meldt "over budget", zonder te blokkeren. | `project.js` `voortgang` |
| 7 | De aanbetaling wordt als uitgave ingediend door Ilse en gekeurd door een ander. Betaling buiten RTG met kenmerk. | `uitgave.js` |
| 8 | Maanden later valt de leverancier om. Bram vraagt `/uitval` op naam: contracten (op naam), klanten en tickets (op sleutel), en het besluit waarom hij gekozen is. | `uitval.js`, `geheugen.js` |
| 9 | Bram simuleert dat Ilse vertrekt: welke taken en besluiten blijven open. | `gevolg.js` |

Storingen in deze keten:

| Storing | Wat de gebruiker ziet | Wat bewaard blijft |
|---|---|---|
| Dubbele klik in stap 1 | één taak, "was al ontvangen" | de eerste taak |
| RT Mail uit of postvak niet gekoppeld | de postbrug-knop zegt niet gekoppeld; taak met de hand | niets verloren; geen herkomst |
| Waarde verhoogd na goedkeuring (stap 4 -> €25.000) | "goedkeuringen op het oude bedrag zijn vervallen", met het bedrag van toen | de vervallen goedkeuring met reden |
| Ilse probeert haar eigen uitgave te keuren | 403 met de regel | de uitgave, ongekeurd |
| Beheer-token probeert te keuren | 403: "goedkeuring zonder gezicht" | niets gewijzigd |
| Crash direct na stap 5 | na herstart staat het contract op wat `herzie` vastlegde; de gebeurtenislaag toont de overgang | handtekeningen en gebeurtenis |
| Werkruimte losgekoppeld van de entiteit | de concerngrens valt weg; het antwoord zegt dat | werkruimtegrens blijft |
| Uitval op een naam met twee schrijfwijzen | de telling van wederpartijen met die naam en een waarschuwing | geen samenvoeging |
| Kosten van uitval gevraagd | `nietGerekend: kosten` met reden | — |

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Tekengrens die tegelijk uit werkruimte en concerngraaf komt, strengste wint | Werk OS (`werk.organisatie`), graaf bij `werk.concern` | `tekengrens.js` + `concern/graaf-bevoegdheid.js` | Een PM-pakket kent de juridische bestuursbevoegdheid niet; een boardportaal kent de uitgaven niet. |
| Werk dat vanuit RT Mail ontstaat en de herkomst draagt zonder hem te kopiëren | Werk OS, RT Mail (`comm.mail`) | `postbrug.js`, `herkomst.js` | Mail en taak zijn bij de markt twee leveranciers; hier één account en één codenaam. |
| Uitdienst-gevolg dat ook het dienstverband en de loonkant raakt | Werk OS leest, Concern en Loonstrook bezitten | `gevolg.js` + `concern/employment.js` (nog niet gekoppeld) | Alleen hier staan dienstverband, werkruimtelid en loon in één huis (ARBEID par. 3). |
| Besluit dat zijn eigen uitval-antwoord voedt ("waarom kozen we hem") | Werk OS | `geheugen.js` -> `uitval.js` | Besluitportalen en contractregisters zijn gescheiden producten. |
| Onderneming die haar opzegdagen op het dagbeeld ziet | Onderneming (`werk.onderneming`) leest Werk OS | `kern/onderneming/contracten.js` | De markt koppelt boekhouding en contractregister via losse integraties. |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules om op te bouwen**
- Projectie: `server/kern/werkcommand/register.js`, `server/bedrijf/inzicht.js`
  en `server/bedrijf/gevolg.js` (vorm zonder `save()`).
- Gebeurtenissen: `server/bedrijf/gebeurtenis.js` (`werkVeld`, `werkFeit`).
- Regels: `server/bedrijf/regelpoort.js` `stand()`.
- Oplevering: de regel van `server/kern/rtgone-projecten.js` (Project Room,
  alleen als patroon; geen code delen tussen intern en klant).
- Dienstverband: `server/kern/concern/aanname.js` (`dienstverbandInhaal`).
- Scenario: `server/kern/fiscaal/scenario.js` + `zekerheid.js`.

**Ontbrekende koppelingen**

| Van -> naar | Vorm | Toestemming |
|---|---|---|
| uitgave -> project | verwijzing (`projectId`) | `geld` om te zetten |
| contract -> project | verwijzing (lijst `projectIds`) | `recht` |
| werkobject-projectie -> alle soorten | projectie | recht per soort, weglaten bij geen recht |
| concern employment -> werkruimtelid | voorstel, één kant op | eigenaar van de entiteit kiest |
| Werk OS uitgave -> Geld | gebeurtenis of projectie | eigenaar Geld beslist |
| storing -> meldklok | projectie op tijdstip | `it.beveiliging` |
| Werk OS besluit <-> Decision Room | geen koppeling | niet doen: intern RTG en ondernemer zijn twee werelden |

---

## g. Prioritering

De oude bak "aanbevolen nu" is gesplitst. **Herstel**: fouten, ontbrekende
herhaalsleutels, prullenbak of bewaartermijn, rolgrenzen, en wat het scherm
belooft maar niet doet. **Verdieping**: nieuwe premiumdiepte binnen de huidige
scope en architectuur.

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Vreemde werkruimte koppelen en haar contracten lezen (via Onderneming) | — | — | — | herstel: gerepareerd (commit d9fd905, `test/onderneming-contracten.test.js`) |
| Mijlpaal gehaald/verschuiven (route + `werkVeld`) | klein | laag | geen | nu: herstel |
| Human Enterprise-paneel eerlijk maken (vaste duur, gesprekstijden en advies eruit; simulatieknop weg of echt) | klein | laag | besluit 3 | nu: herstel |
| Eén rekenwijze euro naar cent: `contract.js` via `kern/geld/eenheid.js` | klein | laag | geen | nu: herstel |
| Rolgrenzen meten: BEVOEGD over alle `/api/bedrijf/*` (nu 8 gemeten, 8 open) | middel | middel | `scripts/` van BEVOEGD | nu: herstel |
| Taak archiveren in plaats van eeuwig op het bord (nooit hard wissen) | klein | laag | `werkVeld` | nu: herstel |
| Werkobject-projectie `/api/bedrijf/werk/object` | middel | middel | register, inzicht, regelpoort | nu: verdieping |
| `projectId` op uitgave en contract, budget telt gekeurde uitgaven | klein | laag | regelpoort ongewijzigd | nu: verdieping |
| Gevolg, mijnwerk, uitval (BIA-lijst) en wacht-op op het scherm | klein | laag | routes bestaan | nu: verdieping |
| Projectoplevering met acceptatie door een ander | middel | middel | besluit 2 | nu: verdieping (na besluit 2) |
| Verplichting met eigenaar en termijn | middel | middel | contract | later |
| Jaarbegroting per afdeling | middel | middel | afdelingslijst | later |
| Indienst leest dienstverband | middel | middel | ARBEID 7a | later |
| Meldklok incident (signaal, termijnen te controleren) | klein | laag | storing.js | later |
| Bewaarklassen + werkruimte sluiten | middel | middel | tenant/uitgang | later |
| Budgetvooruitblik met klasse `advies` | klein | laag | `kern/fiscaal/scenario.js` | later |
| Leveranciersobject + beoordeling | groot | hoog | besluit eigenaar | vraagt besluit |
| Gebruikersbouwbare workflowmotor | groot | hoog | P12 | niet doen: jaren weg, botst met "regels alleen waar code afdwingt" |
| `work_items`-tabel | groot | hoog | — | niet doen: ARBEID par. 2 |
| Werkdruk- of productiviteitsscore per persoon | middel | — | — | niet doen: cijfer op een mens |

---

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | Taken, projecten, besluiten, contracten en uitgaven zijn alle vijf via één werkobject-antwoord te lezen | nieuwe toets per soort in `scripts/lib/voltooi/werkos.js` | 0 van 5 (projectie ontbreekt) |
| Professionele diepte | Elke grendel (cirkel, klaar-met-wacht, indiener-keurt, waarde-omhoog) weigert met reden | bestaande unittoetsen + een mutatie per grendel | grendels staan; mutatiedekking niet gemeten |
| Levenscyclus | Een project gaat van maken tot geaccepteerde oplevering, en een mijlpaal kan gehaald worden | voltooiproef uitbreiden met oplevering | oplevering ontbreekt, mijlpaal-route ontbreekt |
| Samenwerking en rollen | Een tweede lid met minder rechten ziet een telling in plaats van inhoud; extern ziet niets ongedeeld | BEVOEGD voor alle `/api/bedrijf/*` | 8 routes gemeten, 8 open |
| Domeinintelligentie | Elke voorspelling draagt `advies` en `nietGerekend` | toets op `gevolg` en budgetvooruitblik | gevolg ja; vooruitblik ontbreekt |
| Los functioneren | Met Office, RT Mail, agenda en Concern uit werken taken, besluiten, contracten en uitgaven, en toont elke ontbrekende groep de schermtekst uit Modus LOS | proef met uitgeschakelde aansluitingen | niet gemeten; de bron geeft nu `null` zonder tekst |
| RTG-ketens | De vijf ketens uit het `samen`-blok lopen elk met hun storingen; de keten van par. d (mail -> contract -> uitgave -> uitval) in één proef | nieuw scenario | 1 van 5 beproefd (opzegdag op dagbeeld, `test/onderneming-contracten.test.js`) |
| Bewezen betrouwbaarheid | APPWERKT acht bewijzen B | APPWERKT.json | 6 van 8 B; menselijk en bevoegd NT |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

---

## Productfouten gezien

**Gerepareerd**
- **Onderneming koppelde een werkruimte zonder lidmaatschap**
  (`server/kern/onderneming/contracten.js`, `ondernemingWerkruimte`). Werk OS
  was hier slachtoffer: de contracten van een werkruimte waren leesbaar voor
  wie de code kende. Gerepareerd in commit d9fd905: alleen een actief lid met
  zijn eigen `rtgKey` koppelt; een vreemde werkruimte krijgt hetzelfde 404 als
  een onbekende; wie vertrekt, ziet stand `geen-toegang`. Toets:
  `test/onderneming-contracten.test.js`.

**Nog open (gelezen, niet beproefd; niet gerepareerd)**

1. **Mijlpaal kan niet gehaald worden.**
   - `server/bedrijf/project.js` regel 130 zet `gehaald: false`, en geen route
     zet hem op true.
   - `server/bedrijf/waarom.js` regel 119-120 telt hem daardoor na de datum
     altijd als gemist.
2. **Paneel "Human Enterprise" in `public/apps/werk.html` (regel 133).** Deels
   bijgewerkt sinds de eerste lezing: de vijf meters tonen nu "Niet gemeten"
   en het advies opent met "Voorbeeld van een opbouw in stappen". Nog open:
   - vaste duur 21/45/90 dagen en vaste gesprekstijden 25/15/20 min in de HTML;
   - vaste statussen in "Permission choreography";
   - een klik op een wereld zet in `public/apps/werk/command.js` de zin
     "Balanced Start past bij deze rol" zonder berekening;
   - "Start veilige simulatie" (`wkSimulation`) zet alleen de tekst
     "Simulatie gestart: …" en start niets.
3. **Twee rekenwijzen voor euro naar cent.**
   - `server/bedrijf/contract.js` regel 56: `Math.round(x * 100)`.
   - `project.js` en `uitgave.js`: `kern/geld/eenheid.js`.

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**HERSTEL**

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| Werkruimte alleen koppelen en lezen als actief lid (Onderneming-kant) | — | `kern/onderneming/contracten.js` | gerepareerd (commit d9fd905) |
| Mijlpaal gehaald/verschuiven met reden | klein | `server/bedrijf/project.js`, `gebeurtenis.js` (`werkVeld`) | open |
| Human Enterprise-paneel eerlijk maken | klein | `indienst.js`, `public/apps/werk/command.js` | open, na besluit 3 |
| Eén rekenwijze euro naar cent in `contract.js` | klein | `kern/geld/eenheid.js` | open |
| BEVOEGD over alle `/api/bedrijf/*` | middel | bestaande BEVOEGD-meting | open (8 van 8 open) |
| Taak archiveren, nooit hard wissen | klein | `taak.js`, `werkVeld` | open |

**VERDIEPING**

| Functie | Kosten | Bouwt op | Bak |
|---|---|---|---|
| Werkobject-projectie (d.0), leest en bezit niets | middel | `kern/werkcommand/register.js`, `inzicht.js`, `regelpoort.js` `stand()`, vorm van `gevolg.js` | nu |
| `projectId` op uitgave en contract; budget telt gekeurde uitgaven | klein | `uitgave.js`, `contract.js`, `project.js` `voortgang()` | nu |
| Gevolg, mijnwerk, uitval en wacht-op op het scherm | klein | bestaande routes; `public/apps/werk/` | nu |
| Projectoplevering met acceptatie door een ander | middel | patroon `rtgone-projecten.js`, recht uit `rollen-register.js` | nu, na besluit 2 |
| Contractverplichting met eigenaar en termijn | middel | `contract.js` `verplichtingen[]`, `contractklok.js` | later |
| Jaarbegroting per afdeling | middel | `uitgave.afdeling`, `project.budgetCenten` | later |
| Indienst leest dienstverband (voorstel, één kant op) | middel | `kern/concern/aanname.js`, `employment.js` | later |
| Meldklok incident (24 u / 72 u / 1 maand) als signaal, termijnen te controleren, zonder indienen | klein | `storing.js`, `it.js` | later |
| Bewaarklassen en werkruimte sluiten | middel | `kern/tenant/uitgang.js`, `herstelproef.js` | later |
| Budgetvooruitblik met klasse `advies` | klein | `kern/fiscaal/scenario.js`, `zekerheid.js` | later |

### (B) Het domeinmaximum, ook buiten de huidige scope

Dit is richting en geen toezegging. Een nieuw domein vóór V1 blijft uitgesloten.
Elke regel "nodig buiten scope" is daarom een besluit en geen werk.

**Proces 1: Inkoop-tot-betaling (procure-to-pay) voor een mkb-organisatie.**

Stappen:
1. Behoefte als taak.
2. Offerte via RT Mail.
3. Leverancierskeuze als besluit, met de alternatieven.
4. Contract met regels en twee handtekeningen.
5. Bestelling.
6. Ontvangst met bewijs.
7. Factuur aan de bestelling gekoppeld (three-way match).
8. Uitgave met functiescheiding.
9. Betaling.
10. Leveranciersbeoordeling.
11. Uitval-analyse.

Rollen en organisaties:
- intern: aanvrager, inkoper, budgethouder, keurder (≠ indiener), directie,
  accountant (extern, gedeeld);
- buiten: de leverancier.

Apps en eigenaren:
- Werk OS (`werk.organisatie`): taak, besluit, contract, uitgave;
- RT Mail (`comm.mail`): offerte;
- RTDocs (`docs.office`): stukken;
- Geld (`geld.overzicht`): gevolg;
- groothandel (`kern/groothandel.js`): de horecacatalogus.

Nodig buiten scope:
- een leveranciersobject (besluit 1);
- een bestelling buiten de groothandel (nieuw domein);
- een factuurkoppeling uit de boekhouding (externe koppeling of eigen
  facturatie, besluit);
- een bankkoppeling (extern; RTG verplaatst geen geld, GELD.md).

**Proces 2: Kwaliteitsmanagementsysteem (ISO 9001-achtig) voor een dienstverlener.**

Stappen:
1. Beleid en doelen.
2. Processen beschreven als kennisartikelen.
3. Risico's met maatregel.
4. Interne audit.
5. Bevinding.
6. Corrigerende maatregel met eigenaar.
7. Afsluiten met bewijs door een ander.
8. Directiebeoordeling als besluit met evaluatie.
9. Leveranciersbeoordeling (8.4).

Rollen en organisaties:
- intern: kwaliteitsmanager, auditor, procesowner, directie;
- buiten: de externe certificerende instelling (blijft extern; RTG
  certificeert niets).

Apps en eigenaren:
- Werk OS: kennis, project-risico, besluit;
- Horeca: HACCP blijft daar (`horeca.*`);
- RTDocs: gedocumenteerde informatie.

Nodig buiten scope:
- een generiek audit- en bevindingobject (nieuw in Werk OS, besluit);
- een normenregister met bron per clausule (besluit, licentie op normtekst
  is extern).

**Proces 3: Bedrijfscontinuïteit en incidentmelding (ISO 22301, NIS2, AVG).**

Stappen:
1. BIA: wat valt om, en wat rust op een naam.
2. Uitwijkplan per kritieke afhankelijkheid.
3. Oefening met verslag.
4. Incident.
5. Meldklokken.
6. Melding door de organisatie zelf bij NCSC of AP. Dat is buiten RTG en
   voorbehouden.
7. Eindverslag.
8. Evaluatiebesluit.

Rollen en organisaties:
- intern: IT-verantwoordelijke, FG/privacy, directie;
- buiten: toezichthouder (NCSC, AP).

Apps en eigenaren:
- Werk OS: `uitval.js`, `gevolg.js`, storing;
- `kern/tenant/herstelproef.js`: het export-bewijs;
- de rampstand-UX: voorstel 148, nog geen eigenaar.

Nodig buiten scope:
- een risicoregister met kans en impact (besluit: een kans is een
  voorspelling, dus klasse `advies`);
- een uitgang voor concern en payroll (voorstel 147);
- de rampstand-UX (148).

**Proces 4: Het arbeidstraject van vacature tot uitdienst (organisatiekant).**

Stappen:
1. Vacature.
2. Werving.
3. Aanname.
4. Dienstverband bij de entiteit.
5. Werkruimtelid.
6. Indienst.
7. Rooster binnen ATW en cao.
8. Verlof en verzuim met de poortwachtertermijnen.
9. Loon.
10. Loopbaanregel.
11. Uitdienst met gevolg en bewaarklassen.

Rollen en organisaties:
- intern: manager, HR, administrateur (vier ogen), medewerker;
- buiten: arbodienst, UWV en Belastingdienst (alle extern; RTG dient niets
  in).

Apps en eigenaren:
- werving (`kern/werk.js`);
- Concern (`werk.concern`, employment);
- Werk OS (indienst, uitdienst, gevolg);
- Team Room (`zaak.teamroom`, `kern/vrijheid/`);
- Loonstrook (`loon.strook`);
- Loopbaan.

Nodig buiten scope:
- de ATW-laag losgemaakt uit taxi (besluit, PLANNING.md);
- een constraint solver (jaren weg);
- een arbodienstkoppeling (extern);
- loontransparantie: alleen voorbereiden; het is nog geen recht.

**Proces 5: Portfolio- en begrotingssturing voor een groep.**

Stappen:
1. Jaarbegroting per entiteit en afdeling.
2. Projectportfolio.
3. Gekeurde uitgaven als realisatie.
4. Kwartaalherziening als besluit.
5. Geconsolideerd beeld over werkruimtes heen, met een eigen recht.

Rollen en organisaties:
- holdingdirectie, controller (tijdelijke rol), afdelingshoofden.

Apps en eigenaren:
- Werk OS: `beeld-consolidatie.js`, project, uitgave;
- Concern: entiteiten;
- Onderneming: plan en simulatie;
- Geld.

Nodig buiten scope:
- kostenplaatsen en een grootboek (nieuw domein of externe boekhouding,
  besluit);
- scenariotakken (P14);
- een scenario promoveren naar werkobjecten (voorstel 107, jaren).

---

## Vraagt besluit

1. **Wie is eigenaar van een leverancier als object?**
   - (a) **Aanbevolen**: Werk OS krijgt een leveranciersverwijzing per
     werkruimte. De groothandel (`kern/groothandel.js`) blijft eigenaar van
     zijn eigen leveranciers en wordt verwezen, niet gekopieerd. Kosten: groot.
     Één nieuwe bak in `server/bedrijf/`.
   - (b) Commercie (`kern/commercie/contract.js`) wordt de bron van
     wederpartijen. Kosten: groot, en het raakt de RTG-zaak-kant.
   - (c) Niets bouwen; uitval blijft op naam. Kosten: geen. ISO 9001 8.4 blijft
     onbediend.
2. **Welk recht accepteert een projectoplevering?**
   - (a) **Aanbevolen**: het bestaande recht `project`, met de regel
     "accepteerder ≠ uitvoerder". Kosten: klein.
   - (b) Een nieuw recht `project.accepteer` in `rollen-register.js`. Kosten:
     klein, plus een rollenmigratie.
   - (c) Alleen directie. Kosten: klein. Te smal voor teams.
3. **Het Human Enterprise-paneel in `werk.html`.**
   - (a) **Aanbevolen**: weghalen wat niet gemeten is, en de journey alleen uit
     `indienst.js` tonen. Kosten: klein.
   - (b) Laten staan met het label "voorbeeld". Kosten: klein. Blijft
     onderzoekswaardig onder BETROUWBAARHEID.md.
   - (c) Echt bouwen (simulatie, onboardingwerelden). Kosten: groot. Nieuw
     domein, buiten de scope.
4. **Telt een contractwaarde mee in het projectbudget?**
   - (a) **Aanbevolen**: alleen gekeurde uitgaven tellen. Contracten staan
     ernaast als verplichting met klasse `advies`. Kosten: klein.
   - (b) De contractwaarde naar rato over de looptijd. Kosten: middel. Het is
     een verdeling, geen feit.
5. **Welk proces uit B wordt na V1 als eerste richting uitgewerkt?**
   - (a) **Aanbevolen**: proces 1, inkoop tot betaling. Het meeste staat er al
     (contract, uitgave, uitval), en het ontbrekende is één object: de
     leverancier. Kosten: groot, en het vraagt besluit 1.
   - (b) Proces 2, kwaliteitsmanagement. Kosten: middel tot groot, met een nieuw
     auditobject.
   - (c) Proces 3, continuïteit. Kosten: middel. Het hangt aan de voorstellen
     147 en 148.
