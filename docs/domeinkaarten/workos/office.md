# Office / RTDocs (link:office)

Eigenaar: `docs.office` (SCHERMEIGENAAR.json, doelgroep `zaak`), ingang
`/apps/office.html`. Werkelijke doelgroepen in de code: lid, zaak, kantoor, RTF-gezin
en werkplek (vijf ingangen op één kern). Ambitie van de eigenaar: documenten,
spreadsheets, presentaties, databases, formulieren en gezamenlijk bewerken.

Leeswijzer: dit is een KAART en geen bouwopdracht. Het besluit uit `OFFICE.md` blijft
leidend: er komt geen `RTGObject` en geen `objects`-tabel (par. 0), het eerste
fundament is een documentmodel per soort (par. 1), en live samen schrijven wacht op
het CRDT-besluit (punt 8, P6).

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Scherm: `public/apps/office.html` met `public/apps/office/` (tekst, tekstpro,
  teksttabel, blad, bladpro, bladgrafiek, bladreeks, pres, presenteren, formulier,
  formulieruitslag, schets, schetsbalk, schetsvorm, bord, bordpaneel, voorzijde,
  voorzijde-besluit, voorzijde-dossier, afdruk, adaptief*). De bundel
  `public/apps/office/app.js` wordt gebouwd uit `public/apps/office/app/*.js`.
- Routes: `server/routes/kantoorpakket.js`, `kantoorpakket-samen.js`,
  `kantoorpakket-huis.js`, `kantoorpakket-formaten.js`. Dezelfde acties over vijf
  ingangen: `/api/kantoorpakket` (lid, geen gast), `/api/supplier/kantoorpakket`
  (zaak, sleutel `sup:CODE`), `/api/office/kantoorpakket` (kantoor, `rtg:kantoor`),
  `/api/rtf/kantoorpakket` (gezin) en `/api/werkplek/kantoorpakket`.
  Acties: mijn, maak, open, bewaar, deel, weg, ster, versies, terug, ai, fase, vul,
  uitslag, samen, aanwezig, opmerking, beheer, exporteer, importeer.
- Kern: `server/kern/office/` (21 bestanden, 2028 regels), o.a. `basis.js`
  (soorten en grenzen), `docs.js`, `rechten.js`, `uitgangspoort.js`, `samen.js`,
  `workflow.js`, `formaten.js`, `xlsx-lees.js`, `xlsx-schrijf.js`,
  `docx-schrijf.js`, `herhaling.js`, `formulier.js`, `formuletaal.js`.
  Rekenmotor: `public/shared/rekenmotor.js` (66 functies, OFFICE.md punt 5).
- Opslag: `db.data.officeDocs` en `db.data.officeAntwoorden` (formulierinzendingen).

**Gedrag dat in de code staat**

| Onderdeel | Wat het doet | Pad |
|---|---|---|
| Soorten | `tekst`, `blad`, `presentatie`, `formulier`, `schets`, `bord`. Geen database-soort. | `server/kern/office/basis.js` r. 7 |
| Grenzen | 200 documenten per eigenaar, 500 kB per document, 15 versies, 60 dia's, 30 vragen, 500 inzendingen | `basis.js` |
| Maken | met herhaalsleutel `idem` | `server/kern/office/herhaling.js` |
| Bewaren | optimistisch slot `verwachtGewijzigd`, 409 `VERSIECONFLICT`; een herhaling met dezelfde inhoud is 200 `herhaald` | `docs.js` `bewaar` |
| Versies | volle kopie in hetzelfde record, maximaal 15, terugzetten | `docs.js`, route `terug` |
| Fasen | concept, beoordeling, goedgekeurd, archief; een inhoudswijziging zet terug naar concept met auditregel; `bron: 'ai'` kan niet goedkeuren | `docs.js`, `workflow.js` |
| Rechten | eigenaar, bewerkers, `gedeeldMet` op codenaam, RTF-kring | `rechten.js` |
| Classificatie | intern, vertrouwelijk, strikt; strikt sluit delen, gezinsdeling, meelezen en het taalmodel; bij export reist de markering mee | `uitgangspoort.js` |
| Beheer | classificatie, bewaartermijn (`geen`, `1jaar`, `3jaar`, `7jaar`, `permanent`; standaard `7jaar`), herzieningsdatum, tags | `samen.js` r. 12-27 |
| Samen | SSE `office` naar meelezers; aanwezigheid in geheugen | `samen.js`, `server/kern/sse.js` |
| Formaten | tekst naar DOCX/HTML, blad naar XLSX/CSV, XLSX inlezen, presentatie naar TXT, schets naar SVG, bord naar CSV; elk antwoord draagt een `trouw`-lijst | `formaten.js` |
| AI | acht opdrachten, vijf lokaal zonder model; strikt krijgt 403 `CLASSIFICATIE_STRIKT` | `delen.js`, `test/office-ai-classificatie.test.js` |
| Verwijderen | harde delete door de eigenaar, formulierinzendingen gaan mee; geen prullenbak | `docs.js` `weg` |

**Wat BEWEZEN is**

- APPWERKT.json (`link:office`): bereikbaar B, bedienbaar B, menselijk NT,
  voltooibaar GF, waarheidsgetrouw B, persistent GF, bevoegd NT, herstelbaar GF.
- Voltooiproef op deze tak: lokaal gesloten 4/4 (19-10, dc501544), centraal nog te
  stempelen. Voltooibaar 6/6, persistent 3/3, herstelbaar 3/3, menselijk 3/3. Stap 5:
  "een zaak en een lid zonder kantoorrol openen of wijzigen dit kantoordocument
  niet" (zaak 403, lid 403, kantoordeur 401). Scenario: `scripts/lib/voltooi/office.js`.
  Het scenario loopt alleen de KANTOOR-ingang; de vier andere ingangen zijn niet
  door de voltooiproef gelopen.
- BEVOEGD.json: 1 route gemeten, 1 open. IDOR.json: 0 doorbraken over 1999 routes.
- Tests: o.a. `test/office.test.js`, `office-uitgangspoort.test.js`,
  `office-classificatie-grens.test.js`, `office-formaten.test.js`,
  `office-save-atomic.test.js`, `officebord.test.js`, `office-suite.e2e.js`.

**Staat, onbewezen**: delen en meeschrijven tussen twee leden, opmerkingen, fasen,
export en import, formulier invullen en uitslag, de RTF- en werkplekingang.

**Wat de code en OFFICE.md zelf als niet gebouwd opgeven**

- Geen documentmodel: tekst IS HTML via `execCommand` (OFFICE.md par. 1).
- Live samen schrijven: geen CRDT; "het besluit is de CRDT zelf" (punt 8).
- Offline schrijven: `public/sw.js` slaat `/api/` over; geen wachtrij (punt 9).
- Herstel naar een tijdstip: jaren weg (punt 22).
- DOCX lezen, PPTX, ODF: niet gebouwd (punt 23).
- P9 register van gebeurtenisnamen, P10 gevolgmeting, P12 gebruikersstaatsmachine,
  P13 besluitdossier, P14 procesmeting: open (OFFICE.md par. 7).
- Database-soort: ontbreekt (zie d., L1/L3 "Register").

## b. Marktvergelijking

Echte merken staan hier alleen als vergelijking, nooit als partner. Geraadpleegd
2026-10-19; elke regel komt uit een zoeksamenvatting.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Microsoft 365 E5 ($60) | DLP, Insider Risk, eDiscovery Premium, Purview, Power BI | half: classificatie per document en uitgangspoort; geen DLP-detector, geen eDiscovery | https://www.microsoft.com/en-us/security/pricing/enterprise-plans (via zoektool, live te controleren) |
| Microsoft 365 E7 ($99, sinds mei 2026) | E5 plus Copilot, Agent 365, Entra Suite | half: AI-opdrachten met classificatiepoort; geen agents met uitvoerend gezag (bewust, OFFICE.md par. 9) | https://www.microsoft.com/en-us/microsoft-365/enterprise/e7 (via zoektool, live te controleren) |
| Google Workspace Enterprise Plus (offerte) | client-side encryptie, dataregio's, AI-classificatie in Drive, Access Transparency | nee: geen klantsleutels, geen regio's (OFFICE.md P4) | https://knowledge.workspace.google.com/admin/getting-started/editions/compare-enterprise-editions (via zoektool, live te controleren) |
| Google Workspace (alle edities) | opslag 30 GB / 2 TB / 5 TB; Gemini in Docs vanaf Standard | half: 200 docs x 500 kB per eigenaar; lokale schrijfhulp | https://workspace.google.com/pricing (via zoektool, live te controleren) |
| Notion Plus / Business / Enterprise | Plus: onbeperkt blokken, formulieren; Enterprise: SCIM, auditlog, onbeperkte paginageschiedenis | half: formulieren ja, databases nee, 15 versies, SCIM bestaat platformbreed (`server/scim/`) | https://www.notion.com/pricing (via zoektool, live te controleren) |

Wat bijna alle topniveaus delen (markt-enterprise.txt): SSO en SCIM, auditlog of
SIEM, dataresidentie of client-side encryptie, DLP, sandbox. RTG heeft SSO/SCIM en
een auditspoor per document; DLP-detectie en regio's ontbreken.

## c. Analyse van het volledige domein

**Particulier.** Een lid schrijft brieven, houdt lijsten bij (inboedel, recepten,
verbouwing), vult formulieren van anderen in en deelt met huisgenoten. Wat telt:
niets kwijtraken, terugkunnen naar een eerdere stand, en een bestand dat er ook
weer uit kan (DOCX, XLSX, PDF).

**Professioneel.** Een zzp'er of medewerker maakt offertes, notulen, begrotingen en
rapportages, deelt die met een klant en werkt samen met een collega. Wat telt:
uitwisselbaarheid met Word en Excel, versies met naam, opmerkingen en een
reviewstap.

**Organisatie.** Een zaak of concern heeft documentbeheer nodig met rollen,
classificatie, bewaartermijnen en een spoor. Normatief: ISO 9001 clausule 7.5
(gedocumenteerde informatie beheersen; ISO 9001:2026 gepubliceerd 16-9-2026, overgang
tot ca. 2029, te controleren; https://www.lrqa.com/en/latest-news/iso-9001-publication-date-confirmed/).

**Wettelijke eisen die Office raken**

| Eis | Bron | Gevolg voor software |
|---|---|---|
| Fiscale bewaarplicht 7 jaar, onroerende zaken 10 jaar (art. 52 AWR) | https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/ondernemen/administratie/hoelang-moet-u-gegevens-bewaren | een document met fiscale waarde mag binnen de termijn niet hard verdwijnen; de bewaartermijn moet worden AFGEDWONGEN, niet alleen getoond |
| AVG art. 5 en 17: niet langer dan nodig; recht op wissen | https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens | na de termijn moet vernietiging kunnen, met een spoor zonder inhoud |
| AVG art. 30 verwerkingsregister, art. 33 datalek binnen 72 uur | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/beveiliging/meldplicht-datalekken | een gedeeld strikt document dat verkeerd is gedeeld moet terug te vinden zijn: wie, wanneer, met wie |
| Personeelsdossiers 2 jaar (richtlijn AP), salarisadministratie 7 jaar | https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers | de bewaartermijnlijst `geen/1/3/7 jaar/permanent` mist 2, 5 en 10 jaar |
| ISO 27001:2022 Annex A (93 maatregelen) | https://www.dqsglobal.com/blog/new-iso-27001-2022-key-changes (secundair) | classificatie, toegangsbeheer en logging per document zijn bewijs voor een audit |
| Besluit buiten vergadering (art. 2:238 BW): instemming van alle vergadergerechtigden, elektronisch mag; notulenplicht te controleren | https://www.dirkzwager.nl/kennis/artikelen/raadgevende-stem-van-de-bestuurder-ook-buiten-vergadering | een besluitdocument moet de instemming per persoon kunnen dragen; dat is `server/bedrijf/besluit.js`, niet Office |

**Wat dat betekent.** Office is de plek waar documenten LEVEN; de bewaarplicht, het
besluit en de handtekening horen bij hun eigen eigenaar en worden in Office getoond,
niet opnieuw gebouwd (Sign: OFFICE.md punt 14; besluit: `bedrijf/besluit.js`).

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Prullenbak met 30 dagen terug | ontbreekt; `docs.js` `weg` is hard | `officeDocs`, veld `weg: {om, door}` | weg = markeren; na 30 dagen of na de bewaartermijn (de langste wint) echt weg, met een regel zonder inhoud | geen | eigenaar ziet "verwijderd, nog 30 dagen terug te zetten" | alleen eigenaar; bij `sup:CODE` alleen de manager | strikt: zelfde regel; formulierinzendingen volgen het document | ik verwijder per ongeluk een offerte en zet hem de volgende dag terug, met versies | klein | aanbevolen nu |
| Register (database-soort), eenvoudig | ontbreekt | zie onder "Ontwerp Register" | velden met type, rijen, weergaven tabel en bord | geen; een berekend veld is een formule uit `rekenmotor.js` | eigenaar en wie gedeeld is, via SSE `office` | zelfde rechten als elk document | geen relaties in deze stap | ik maak een inboedellijst met vijf kolommen, sorteer op waarde en exporteer naar XLSX | middel | aanbevolen nu |
| Versies met naam | half: 15 naamloze versies | `d.versies[]` | een benoemde versie telt niet mee in de 15 en blijft staan tot de eigenaar hem loslaat (max. 10) | geen | eigenaar | eigenaar en bewerkers | strikt: zelfde | ik noem een versie "verstuurd aan klant" en vind die na 40 bewerkingen terug | klein | aanbevolen nu |
| PDF uit elk document op de server | half: afdrukdialoog (`afdruk.js`); PDF-laag bestaat (`kern/pdf*.js`) | inhoud | export langs `uitgangspoort.js`, markering in de kop | opmaak kan afwijken; `trouw`-lijst zegt wat | eigenaar | wie mag openen | strikt: markering, geen blokkade (besluit open) | ik download een PDF met de classificatie zichtbaar in de kop | middel | later |
| Offline lezen, intern | ontbreekt (`public/sw.js`) | laatste geopende stand | alleen `intern`; `strikt` nooit; `vertrouwelijk` vraagt besluit | of de stand verouderd is: het scherm toont "stand van <tijd>" | lezer | lezer | schrijven offline: niet (P6) | in de trein open ik mijn notulen van gisteren; het scherm zegt hoe oud de stand is | middel | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Opmerkingen met toewijzing | half: `opmerking` met `opgelost` | `d.opmerkingen[]` | een opmerking kan een codenaam dragen; die ziet hem in Werk OS "mijn werk" als projectie, niet als taak | geen | toegewezene via melding; eigenaar bij oplossen | bewerkers en lezers mogen opmerken | strikt: alleen eigenaar en bewerkers | een collega krijgt "kijk alinea 3 na" en ziet het in zijn werkoverzicht zonder dat er een tweede taak ontstaat | klein | aanbevolen nu |
| Reviewronde met meerdere beoordelaars | half: fase `beoordeling`, eigenaar keurt | `workflow.js` | beoordelaars per document; goedkeuren blijft eigenaar + `mens: true`; elk oordeel in het spoor | geen | eigenaar zodra alle beoordelaars gereageerd hebben | beoordelaar = lezer met recht op oordeel | een inhoudswijziging zet alles terug naar concept (bestaande regel) | drie mensen zeggen akkoord of bezwaar; het bezwaar blijft staan na goedkeuring | middel | later |
| DOCX lezen | ontbreekt | upload | importeur naar het tekstmodel met trouwmeter | groot: OOXML-stijlen; `trouw`-lijst verplicht | importeur | eigenaar | zonder tekstmodel niet eerlijk (OFFICE.md par. 1) | ik lees een Word-bestand in en zie per bestand wat er niet meekwam | groot | later (na tekstmodel) |
| Tekstmodel met HTML-importeur | ontbreekt | `inhoud.tekst` | blokken met markeringen per soort; importeur leest elk bestaand HTML-document | middel: oude markup | niemand: migratie in dezelfde collectie | n.v.t. | geen tweede opslag (par. 1) | elk bestaand document opent na de wissel met dezelfde tekst; een meter telt verschillen | groot | later (fundament, maanden) |
| Formulier naar register | ontbreekt | `officeAntwoorden` | een formulier kan zijn inzendingen als rijen in een register schrijven | geen | registereigenaar bij elke inzending (instelbaar) | formuliereigenaar = registereigenaar | anonieme inzending bestaat niet: een gast is geen gebruiker | een inschrijfformulier vult een lijst die ik sorteer en exporteer | klein | aanbevolen nu |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Bewaartermijn afgedwongen | half: veld bestaat, `weg` leest het niet | `beheer.bewaartermijn` | binnen termijn: verwijderen = archiveren; na termijn: vernietigen met regel; juridische bewaring wint altijd (zelfde drieslag als `server/kern/rtmail-bewaar.js`) | welke termijn wettelijk geldt, beslist de mens; de app stelt voor per sjabloon (factuur 7 jaar) | eigenaar 30 dagen vooraf | vernietigen: eigenaar of manager; bewaring: manager | `geen` blijft mogelijk voor privé | een factuurdocument met 7 jaar kan niet weg; de knop zegt tot wanneer | middel | aanbevolen nu |
| Teamdrive met rollen | half: `sup:CODE` deelt alles met het hele team | `supplier_staff`, `bedrijf/rollen.js` | lezen: team; verwijderen en beheer: manager; geen derde rechtenmodel (lees de bestaande rollen) | geen | manager bij verwijderen door een ander | via bestaande rollen | kantoor (`rtg:kantoor`) volgt `officeAuth` | een medewerker kan een teamdocument niet weggooien; de manager wel, met spoor | klein | aanbevolen nu |
| Register met relaties | ontbreekt | verwijzing `rtg://soort/id` (`server/bedrijf/herkomst.js`) | een veld `verwijzing` wijst naar een ander register of een domeinobject; opgelost bij elk openen met de rechten van de LEZER (CREATE.md par. 3) | bron weg: cel toont "bron niet bereikbaar", nooit een oude kopie | lezer | lezer | strikt bron: lege cel met reden | een projectregister wijst naar contracten; wie contracten niet mag lezen ziet een lege cel met uitleg | middel | later |
| Eén uitgangspoort voor alle uitgangen | half: `uitgangspoort.js` geldt voor Office | `UITGANGEN` | elke nieuwe uitgang meldt zich; test zakt anders | geen | n.v.t. | n.v.t. | export bij strikt: besluit open | een nieuwe uitgang zonder registratie laat `test/office-uitgangspoort.test.js` zakken (bestaat) | klein | bestaat; uitbreiden naar Register |
| Bewaartermijnen 2, 5 en 10 jaar | ontbreekt | `BEWAARTERMIJNEN` in `samen.js` | lijst uitbreiden naar de wettelijke klassen (domein-max.txt) | geen | eigenaar | eigenaar | geen | ik kies "10 jaar" voor een koopakte | klein | aanbevolen nu |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Lokale schrijfhulp | bestaat (`delen.js`) | selectie | vijf opdrachten zonder model; drie met model, strikt dicht | modeluitvoer is graad `vermoed` | gebruiker | wie mag bewerken | per-aanroep "nooit extern" ontbreekt (P11) | samenvatten werkt zonder model; strikt geeft 403 met reden | klein | bestaat |
| Bewaarvoorstel per sjabloon | ontbreekt | sjabloongroep (`sjablonen.js`) | factuur, contract: voorstel 7 jaar; zekerheidsklasse `uitlegbaar` uit `server/kern/fiscaal/zekerheid.js` | het is een voorstel, nooit een vaststelling | eigenaar bij maken | eigenaar kiest | geen | bij een nieuw factuurdocument staat "voorstel: 7 jaar (art. 52 AWR), u kiest" | klein | later |
| Persoonsgegevensdetector | ontbreekt | inhoud | patroon (BSN-vorm, IBAN) mag een toets TOEVOEGEN, nooit overslaan (OFFICE.md punt 13) | graad `vermoed` | eigenaar bij delen | n.v.t. | strikt: al dicht | bij delen van een document met een IBAN vraagt het scherm "bewust delen?" | middel | later |
| Gevolg bij weggooien | ontbreekt | verwijzingen naar het document | "dit document wordt aangewezen door 2 besluiten en 1 project" | onvolledig: alleen bekende verwijzingen; `nietGerekend` met naam (zoals `bedrijf/gevolg.js`) | eigenaar vóór verwijderen | eigenaar | geen | voor ik iets weggooi zie ik wat ernaar wijst | middel | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Herzieningsdatum met signaal | half: `herzienOp` veld | `beheer.herzienOp` | op de datum een melding aan de eigenaar en een regel in "mijn werk" | geen | eigenaar op de datum | eigenaar | gearchiveerd: geen signaal | op 1 maart krijg ik "huisregels herzien" | klein | aanbevolen nu |
| Uit dienst: documenten overdragen | ontbreekt | `bedrijf/uitdienst.js`, `officeDocs` | eigen documenten in een teamcontext gaan naar de manager; privédocumenten van een lid blijven van het lid | welke documenten werk zijn: alleen teamdrive telt, nooit de privédrive | manager bij uitdienst | manager | lid zonder dienstverband: niets | na uitdiensttreding staan de teamdocumenten bij de manager, zijn privédocumenten niet | middel | later |
| Tenantuitgang met documenten | half: `server/kern/tenant/uitgang.js` | `officeDocs` per zaak | export in DOCX/XLSX/CSV per document, teruggelezen in de herstelproef | `trouw`-lijst per bestand | eigenaar | manager | strikt: markering mee | een zaak die vertrekt krijgt al haar documenten mee en de proef leest ze terug | middel | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werk OS leest Office | bestaat (`server/bedrijf/aansluiting.js`) | tellingen en titels | geen tweede Docs in Werk OS | geen | n.v.t. | rechten van de lezer | Office uit: telling "niet bereikbaar" | Werk OS toont mijn documenten zonder kopie | klein | bestaat |
| Besluitdossier (P13) | ontbreekt | `bedrijf/besluit.js`, `officeDocs` | het besluit wijst naar stukken (verwijzing), niet omgekeerd; eigenaar = besluit | geen | deelnemers aan het besluit | rechten van het stuk gelden | strikt stuk: lege plek met reden | bij een besluit zie ik de stukken in de stand waarin ze werden goedgekeurd (benoemde versie) | middel | later (OFFICE.md fase 4) |
| Mailbijlage naar Office | ontbreekt | RT Mail, `mailbijlage.js` | een bijlage wordt een document in de drive met herkomst `rtg://rtmail/<id>` | formaat: alleen XLSX en tekst | ontvanger | eigenaar van het postvak | onbetrouwde bijlage van buiten: nooit automatisch | ik zet een XLSX uit een mail met één tik in mijn drive en zie waar hij vandaan kwam | middel | later |

**Ontwerp Register (de database-soort), binnen Office en zonder centrale database**

- Waarom binnen Office: een register is een document met structuur, zoals het blad.
  Het krijgt dezelfde schil (opslag, versies, delen, classificatie, uitgangspoort,
  audit) uit `server/kern/office/`. Het wordt soort nummer zeven in `SOORTEN`
  (`basis.js`) en `inhoud` in dezelfde `officeDocs`-collectie onder `schoonInhoud`.
  Er komt geen tabel per register en geen centrale database.
- Model: `inhoud = { velden: [{id, naam, type}], rijen: [{id, w: {veldId: waarde}}],
  weergaven: [{soort: 'tabel'|'bord'|'formulier', sorteer, filter, groep}] }`.
  Typen: tekst, getal, bedrag (centen), datum, keuze, vink, persoon (codenaam) en
  later verwijzing (`rtg://`). Berekend veld = formule uit `rekenmotor.js`, nooit code.
- Grenzen: 40 velden; rijen begrensd door de bestaande 500 kB per document
  (ongeveer 2.000 korte rijen); 15 versies als volle kopie blijven gelden. Een
  register dat erboven wil, krijgt een eerlijke melding en geen stille afkapping.
- Rij-idempotentie: elke rij heeft een eigen id; het optimistische slot geldt voor
  het hele register. Fijnmaziger samenvoegen wacht op het CRDT-besluit (P6).
- Grenzen uit OFFICE.md par. 4 die hier gelden: geen cijfer op een mens (een weergave
  sorteert nooit op een getal binnen een groepering op persoon); een view toont nooit
  meer dan de lezer mag; geen gegenereerde code.
- Eigenaarschap: een register dat een bestaand domeinobject nabootst (klanten, taken,
  facturen) is een tweede eigenaar. Het scherm wijst dan naar Werk OS (`klant/*`,
  `taak/*`) of Geld; die herkenning is graad `vermoed` en voegt alleen een wijzer toe.
- Waarom niet groter nu: relaties en een "datamodel per bedrijf" staan in OFFICE.md
  fase 12 als "jaren" en rusten op P5, P7 en P9.

**Modus LOS.** Kerntaak zonder andere apps: documenten maken, bewaren met versies,
terugzetten, delen op codenaam, exporteren. Valt Werk OS, RT Mail of de AI weg, dan
werkt alles behalve de AI-opdrachten met model; het scherm zegt "schrijfhulp met
model niet beschikbaar; samenvatten, inkorten en actiepunten werken lokaal". Valt de
SSE weg, dan zegt het scherm "u ziet wijzigingen van anderen pas na opnieuw openen";
het slot voorkomt overschrijven.

**Modus SAMEN: de verbouwing van een horecazaak (gebruikersketen)**

1. De aannemer stuurt een offerte naar `receptie@<zaak>.partner.rtg`. RT Mail stempelt
   SPF/DKIM/DMARC (`mailinkomend.js`), de postbrug maakt er een Werk OS-taak van met
   herkomst (`server/bedrijf/postbrug.js`).
2. De manager opent de teamdrive en maakt "Verbouwing 2027 – begroting" (blad) en
   "Verbouwing – eisen" (tekst). Maak draagt `idem`.
   - Storing: dubbele tik. Gevolg: één document (`herhaling.js`). Bewaard: het eerste.
3. De bedrijfsleider schrijft mee (bewerker). Beide vensters open.
   - Storing: beide bewaren tegelijk. Wat de tweede ziet: 409 "Dit document is
     intussen door iemand anders gewijzigd", met wie het laatst schreef. Bewaard: de
     eerste stand; de tweede tekst staat nog in zijn venster.
4. De manager zet het eisendocument op beoordeling en daarna op goedgekeurd.
   - Storing: de bedrijfsleider wijzigt nog een komma. Gevolg: terug naar concept met
     auditregel "inhoud gewijzigd". Dat is de werking, geen fout (OFFICE.md punt 8).
5. De manager exporteert de begroting als XLSX voor de bank.
   - Storing: het document is strikt. Gevolg: export mag, de markering reist mee in
     het bestand en het spoor krijgt `geexporteerd`. Delen met de bank op codenaam is
     dicht (403).
6. Het besluit "verbouwing doorzetten" in Werk OS (`bedrijf/besluit.js`) wijst naar de
   begroting.
   - Storing: Office staat uit in de boardroom. Wat de gebruiker ziet: de verwijzing
     toont "niet bereikbaar"; `herkomst.js` lost nooit stil op. Bewaard: het besluit
     en de verwijzing.
7. Geld toont de financiële gevolgen; Wonen (bij een lid) of het aannemersgenre houdt
   de uitvoering. Office is daarin alleen de documentplek.

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Classificatie die elke uitgang langsloopt, met een test die een nieuwe uitgang dwingt zich te melden | `docs.office` | `uitgangspoort.js` | bij de markt is DLP een betaald add-on bovenop de editor; hier is het de poort zelf |
| Een AI die nooit meer kan dan de vrager | stuurlaag | `server/kern/stuur/mandaat.js` | mandaat is een doorsnede, geen instelling (OFFICE.md par. 9 reden 1) |
| Document dat in Werk OS, besluit en project verschijnt zonder kopie | `docs.office` + Werk OS | verwijzing `rtg://` (`server/bedrijf/herkomst.js`) | markt-apps koppelen via bestanden of links zonder rechtencontrole bij de lezer |
| Delen op codenaam: een gedeeld document lekt geen echte naam | `docs.office` | `rechten.js`, kluis in `server/accounts.js` | markt-suites delen op e-mailadres |
| Formulier dat in een register landt zonder externe tool, met inzendingen die alleen van ingelogde leden komen | `docs.office` | soort formulier + Register | markt-formulieren accepteren anonieme invoer; hier is een gast geen gebruiker |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules**: `server/kern/office/` (heel de map), `public/shared/rekenmotor.js`,
`server/kern/rtmail-bewaar.js` (de drieslag termijn/bewaring/vernietiging als
voorbeeld), `server/bedrijf/herkomst.js`, `server/bedrijf/aansluiting.js`,
`server/kern/stuur/`, `server/kern/fiscaal/zekerheid.js`, `server/kern/tenant/uitgang.js`,
`CREATE.md` par. 3 (bloktaal), `server/kern/objectlaag/caps.js`.

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| Office `weg` | `beheer.bewaartermijn` | regel in de kern | eigenaar; manager bij teamdrive |
| Formulier | Register | verwijzing (doel-id) en schrijven in hetzelfde record | formuliereigenaar = registereigenaar |
| Opmerking met codenaam | Werk OS mijnwerk | projectie (geen work_items-tabel, ARBEID.md par. 2) | rechten van het document |
| Besluit (`bedrijf/besluit.js`) | benoemde versie van een document | verwijzing | rechten van het stuk |
| RT Mail bijlage | Office | gebeurtenis "bijlage bewaard" met herkomst | eigenaar postvak |
| `bedrijf/uitdienst.js` | teamdrive | gebeurtenis | manager |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Prullenbak met 30 dagen terug | klein | laag | `docs.js` | aanbevolen nu |
| Bewaartermijn afgedwongen bij weg | middel | middel | prullenbak | aanbevolen nu |
| Teamdrive: verwijderen alleen manager | klein | laag | `bedrijf/rollen.js` of `supplier_staff` | aanbevolen nu |
| Register, eenvoudig (tabel, bord, XLSX/CSV) | middel | middel | `basis.js`, `formaten.js` | aanbevolen nu |
| Formulier naar register | klein | laag | Register | aanbevolen nu |
| Versies met naam | klein | laag | `docs.js` | aanbevolen nu |
| Herzieningssignaal | klein | laag | meldingen | aanbevolen nu |
| Bewaartermijnen 2/5/10 jaar | klein | laag | `samen.js` | aanbevolen nu |
| Opmerkingen met toewijzing | klein | laag | Werk OS mijnwerk | aanbevolen nu |
| Tekstmodel + importeur | groot | hoog | besluit, maanden | later |
| DOCX lezen met trouwmeter | groot | hoog | tekstmodel | later |
| Register met relaties | middel | middel | `herkomst.js`, CREATE.md views | later |
| Besluitdossier | middel | middel | `bedrijf/besluit.js` | later |
| Live samen schrijven (CRDT) | groot | hoog | besluit P6 | later |
| Offline lezen per classificatie | middel | middel | besluit punt 9 | later |
| Gegenereerde bladapps | groot | hoog | botst met OFFICE.md grens 7 | niet doen: gegenereerde code draait hier nooit |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | tekst, blad, presentatie, formulier, schets, bord en register bestaan als soort | `SOORTEN` in `basis.js` telt 7; `test/office.test.js` maakt er van elk één | 6 van 7 |
| Professionele diepte | XLSX in en uit, DOCX uit, benoemde versies, reviewronde | `test/office-formaten.test.js`; nieuwe test voor benoemde versies | formaten ja, versies met naam nee |
| Levenscyclus | niets verdwijnt binnen zijn bewaartermijn; na de termijn verdwijnt het met een spoor | nieuwe test: `weg` op een document met `7jaar` geeft weigering of archief | nee: `weg` is hard |
| Samenwerking en rollen | twee vensters overschrijven elkaar nooit; een medewerker kan een teamdocument niet vernietigen | voltooiproef herstelbaar; nieuwe test op `/api/supplier/kantoorpakket/weg` als staff | slot ja, rol nee |
| Domeinintelligentie | een AI-uitkomst draagt haar graad; strikt gaat nooit naar een model | `test/office-ai-classificatie.test.js` | ja |
| Los functioneren | zonder AI, SSE en Werk OS werken maken, bewaren, versies en export | voltooiproef met AI uit; e2e met SSE uit | niet beproefd |
| RTG-ketens | Werk OS en een besluit tonen het document zonder kopie, met de rechten van de lezer | nieuwe test op `aansluiting.js` en verwijzing | half |
| Bewezen betrouwbaarheid | alle acht bewijzen B in APPWERKT, alle vijf ingangen in BEVOEGD | `scripts/voltooiproef.js --alleen=office` en de centrale meetronde | 3 van 8 B centraal; 4 lokaal gesloten; bevoegd NT |

Dit contract vervangt de acht bewijzen van APPWERKT nooit.

## Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Prullenbak met 30 dagen terug | klein | `server/kern/office/docs.js` (`weg`) |
| Bewaartermijn afgedwongen, met bewaring en vernietigingsregel | middel | `beheer.bewaartermijn` (`samen.js`), patroon van `server/kern/rtmail-bewaar.js` |
| Teamdrive: verwijderen en beheer alleen door de manager | klein | `server/routes/kantoorpakket.js`, bestaande zaakrollen |
| Register (tabel, bord, CSV/XLSX), formulier naar register | middel | `basis.js` `SOORTEN`, `formaten.js`, `rekenmotor.js`, `formulier.js` |
| Versies met naam, herzieningssignaal, termijnen 2/5/10 jaar | klein | `docs.js`, `samen.js`, meldingen |
| Opmerkingen met toewijzing als projectie in Werk OS | klein | `server/bedrijf/aansluiting.js` |
| Later: tekstmodel, DOCX lezen, register met relaties, besluitdossier, offline lezen | groot tot middel | OFFICE.md par. 1, punt 23, fase 4; `bedrijf/besluit.js`; `public/sw.js` |

**(B) Het domeinmaximum, ook buiten de huidige scope.** Richting, geen toezegging.
Wat hier buiten scope valt, staat als besluit en niet als werk.

| Proces | Stappen | Rollen en organisaties | RTG-apps en eigenaar | Nodig buiten scope |
|---|---|---|---|---|
| Kwaliteitsmanagement (ISO 9001-traject van een mkb-zaak) | 1 scope en beleid vastleggen; 2 procedures als beheerde documenten met herzieningsdatum; 3 registraties (afwijkingen, klachten) in registers; 4 interne audit met bevindingen; 5 directiebeoordeling als besluit; 6 corrigerende maatregelen als taken; 7 certificatie-audit door een externe instelling | eigenaar, kwaliteitsfunctionaris, interne auditor, certificerende instelling (extern) | Office (documenten en registers, eigenaar `docs.office`), Werk OS (taken, besluiten, `werk.organisatie`), RT Mail (klachten) | een generiek audit- en afwijkingsobject (feiten-dwars thema 3: ontbreekt) is een nieuw domein: besluit; certificatie blijft extern |
| Bestuurs- en aandeelhoudersvergadering (bv) | 1 agenda; 2 vergaderstukken; 3 vergaderen of besluit buiten vergadering (art. 2:238 BW); 4 notulen vastgesteld; 5 uitvoering; 6 deponeren jaarrekening bij KVK | bestuurder, aandeelhouders, notaris (extern), accountant (extern) | Office (stukken, notulen), Werk OS `bedrijf/besluit.js`, Onderneming (`bestuur/*`, `aandeel/*`), RTG Meet | besluitdossier P13; gemeenschappelijke tekenweg (OFFICE.md punt 14, gekwalificeerde handtekening vraagt een vertrouwensdienst: partnerbesluit); indienen bij KVK blijft extern (voorbehouden) |
| Offerte tot oplevering (dienstverlener, bijvoorbeeld een aannemer) | 1 aanvraag binnen (mail of site); 2 offerte opstellen uit sjabloon; 3 klant accepteert; 4 contract; 5 uitvoering met meerwerk; 6 oplevering met bewijs; 7 factuur; 8 bewaren 7 jaar | klant, zaak, onderaannemer | RT Mail en Browser (binnenkomst), Office (offerte, contract), Werk OS (project, contract, `werk.organisatie`), Geld (factuur), Wonen bij een particuliere klant | de koppeling contract-project-persoon (feiten-dwars thema 4) en een gemeenschappelijke tekenweg: besluit |
| Overstap van een andere kantoorsuite | 1 inventaris; 2 import XLSX en DOCX met trouwmeter; 3 naast elkaar draaien; 4 rechten en classificatie toewijzen; 5 oude suite opzeggen | IT-beheerder, medewerkers | Office, tenantlaag (`server/kern/tenant/`) | "RTG Overstap" met koppelingen naar externe suites vraagt een app-registratie bij die partijen (OFFICE.md punt 24): partnerbesluit |

## Vraagt besluit

1. **Mag een strikt document geëxporteerd worden?** (`uitgangspoort.js` zegt: nooit besloten)
   - A (aanbevolen): export blijft open met markering, plus een verplichte reden in het spoor. Kosten: klein.
   - B: strikt sluit export, alleen de eigenaar mag. Kosten: klein; kost gebruiksgemak bij bank en accountant.
   - C: zoals nu. Kosten: geen; het spoor zegt niet waarom.
2. **Het CRDT-besluit (OFFICE.md punt 8).**
   - A (aanbevolen): eerst het tekstmodel, daarna kiezen; tot dan blijft het slot. Kosten: geen nu.
   - B: Yjs of Automerge nu, als eerste runtime-dependency. Kosten: groot; breekt de nul-dependency-regel.
   - C: zelf bouwen. Kosten: maanden.
3. **Doelgroep in SCHERMEIGENAAR.json.** `docs.office` staat op `zaak`, de code dient vijf ingangen.
   - A (aanbevolen): doelgroep "lid, zaak, kantoor" met de ingangen erbij. Kosten: klein.
   - B: zo laten. Kosten: geen; de kaart en het register spreken elkaar tegen.
4. **Register: hoe ver?**
   - A (aanbevolen): tabel en bord zonder relaties nu; relaties later. Kosten: middel.
   - B: met relaties en weergave kalender meteen. Kosten: groot; rust op CREATE.md-views.
   - C: geen register; lijsten blijven in het blad. Kosten: geen; de ambitie "databases" valt dan af.
5. **Bewaartermijn bij een teamdrive: wie mag vernietigen na de termijn?**
   - A (aanbevolen): manager, met verse passkey zoals bij de RT Mail-hold. Kosten: klein.
   - B: iedere eigenaar van het document. Kosten: klein; bij `sup:CODE` is dat het hele team.
