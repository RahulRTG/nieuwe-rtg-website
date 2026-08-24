# Het belofteregister

Wat er is toegezegd, en waar het staat. Elke belofte draagt haar dekking: bestandspaden of API-paden die er echt moeten zijn. `node scripts/belofte.js` kijkt dat na. Een belofte zonder dekking heet OPEN en is werkvoorraad; een belofte die naar iets verwijst dat er niet meer is heet GEBROKEN, en dat is de enige alarmerende stand -- zo'n belofte mist niemand vanzelf.

Dit register beoordeelt geen kwaliteit. Dat een bestand bestaat, zegt niet dat de belofte goed is ingelost; daarvoor is BEWIJS.md er, en de toetsen die daaronder liggen.

> Gegenereerd met `node scripts/belofte.js`. Bewerk **BELOFTE.json**, niet dit bestand.

| stand | aantal | wat het betekent |
| --- | --- | --- |
| gedekt | 79 | elk bewijsstuk bestaat |
| open | 0 | nog geen dekking opgeschreven: werkvoorraad |
| gebroken | 0 | er wordt naar iets verwezen dat er niet (meer) is |

## De werkplek (Microsoft 365-achtig)

| belofte | stand | waar het staat |
| --- | --- | --- |
| RTG Docs: documenten met AI schrijven, vergelijken en koppelen | gedekt | `public/apps/office/tekst.js`<br>`public/apps/office/tekstpro.js`<br>`public/apps/office.html` |
| RTG Sheets: formules, reeksen, grafieken en analyse | gedekt | `public/apps/office/blad.js`<br>`public/apps/office/bladpro.js`<br>`public/apps/office/bladgrafiek.js` |
| RTG Slides: presentaties uit cijfers en projecten | gedekt | `public/apps/office/pres.js`<br>`public/apps/office/presenteren.js` |
| RTG Forms: formulieren, aanvragen en uitslagen | gedekt | `public/apps/office/formulier.js`<br>`public/apps/office/formulieruitslag.js` |
| RTG Whiteboard: schetsen en procesontwerp | gedekt | `public/apps/office/schets.js`<br>`public/apps/office/bord.js` |
| RTG Mail: eigen mailstack met gedeelde postbussen | gedekt | `public/apps/rtmail.html`<br>`server/routes/rtmail.js`<br>`server/smtp.js`<br>`server/imap.js` |
| RTG Calendar: mensen, ruimtes en middelen in één planning | gedekt | `public/apps/agenda.html`<br>`server/routes/agenda.js`<br>`server/kern/agenda-pro.js` |
| RTG Meet: vergaderen, scherm delen, notulen | gedekt | `public/apps/meet.html`<br>`server/routes/meet.js` |
| RTG Chat: interne en externe messaging in één gesprekslijst | gedekt | `public/apps/comm.html`<br>`server/kern/comm` |
| RTG Drive: versies, rechten, bewaartermijn en spoor | gedekt | `public/apps/bestanden.html`<br>`server/routes/bestanden.js`<br>`server/kern/bestanden-poort.js` |
| RTG Notes: aantekeningen gekoppeld aan dossiers | gedekt | `public/apps/notities.html`<br>`server/routes/notities.js` |
| RTG Sites: interne portals en kennisomgevingen | gedekt | `public/apps/sitemaker.html`<br>`public/apps/websitestudio.html` |
| RTG Projects: taken, mijlpalen, capaciteit | gedekt | `public/apps/werk.html`<br>`server/routes/planners.js` |
| RTG CRM: klanten, kansen, contactmomenten<br><sub>Gewogen pijplijn, verplichte verliesreden, bewust geen klantwaarde-score.</sub> | gedekt | `server/bedrijf/klant.js` |
| RTG Service Desk: meldingen, SLA's, escalaties | gedekt | `public/apps/meldkamer.html`<br>`server/kern/ledenbalie.js` |
| RTG HR: personeel, verlof, onboarding, beoordelingen | gedekt | `public/apps/personeel.html`<br>`server/routes/supplier/hrplus.js` |
| RTG Finance: grootboek, facturatie, budgetten | gedekt | `public/apps/balans.html`<br>`server/routes/facturatie.js`<br>`server/kern/balans.js` |
| RTG Payroll: loonrun, uren, toeslagen | gedekt | `public/apps/payroll.html`<br>`server/routes/payroll.js` |
| RTG BI: cijfers, voorspelling en rapportage<br><sub>Het voorspellen is bewust doorzichtig en zegt het als er te weinig geschiedenis is.</sub> | gedekt | `server/kern/voorspel`<br>`server/meting.js`<br>`public/apps/office/bladgrafiek.js` |
| RTG Automate: workflows over de apps heen | gedekt | `server/kern/automatisering.js` |
| RTG Build: interne apps laten bouwen | gedekt | `server/kern/werkplaats.js` |
| RTG Identity: SSO, SCIM, passkeys, MFA | gedekt | `server/sso`<br>`server/scim`<br>`server/webauthn`<br>`public/apps/passkeys.html` |
| RTG Device Management: apparaten en vloot op afstand | gedekt | `server/vloot.js`<br>`public/apps/doos.html`<br>`server/kern/zaakdoos` |
| RTG Security Center: risico, alerts, zero-trust | gedekt | `server/kern/beveiliging`<br>`server/beveiliging.js` |
| RTG Compliance Center: AVG, bewaren, bewijs | gedekt | `server/bewaarbeleid.js`<br>`server/bewaartermijnen.js`<br>`VERWERKINGSREGISTER.md`<br>`DPIA.md` |
| RTG Contracts: afspraken, termijnen, risico | gedekt | `server/routes/supplier/contract.js`<br>`server/bedrijf/contract.js` |
| RTG Wiki: interne kennis voor mensen en agents | gedekt | `server/kern/appbieb.js`<br>`server/kern/bibliothecaris.js` |
| RTG Designer: eigen beeld en ontwerp | gedekt | `server/kern/atelier`<br>`public/shared/bureaupda.js` |
| RTG Developer Portal: API's, logs, sleutels | gedekt | `public/apps/techniek.html`<br>`server/techniek.js` |

## Command: zien, besturen, automatiseren

| belofte | stand | waar het staat |
| --- | --- | --- |
| Global Command Center: realtime stand van elk domein | gedekt | `server/kern/command/puls.js`<br>`/api/command/puls` |
| Cross-domain search: één balk over alles | gedekt | `server/kern/command/zoek.js`<br>`/api/command/zoek` |
| Universal Object Control: ieder object openen | gedekt | `server/kern/command/object.js`<br>`/api/command/object` |
| Event timeline per object | gedekt | `server/kern/command/object.js` |
| Support komt binnen op uitnodiging van de klant, met een niveau, een einde en een spoor | gedekt | `server/kern/command/bijstand.js`<br>`server/kern/command/bijstand-klant.js`<br>`server/kern/command/bijstand-rtg.js`<br>`/api/tenant/bijstand/vraag`<br>`/api/command/bijstand/betreed`<br>`public/apps/werk/bijstand.js` |
| Een supportsessie ziet structuur en geen inhoud, en zegt wat zij nooit toont | gedekt | `server/kern/command/bijstand-diagnose.js` |
| Alle organisaties in een beeld, met een hoofdincident en zonder cijfer per klant | gedekt | `server/kern/command/vlootbeeld.js`<br>`/api/command/vloot`<br>`public/apps/command/command-20.js` |
| AI Operator: opdracht in gewone taal | gedekt | `server/kern/command/operator.js`<br>`/api/command/operator/plan` |
| Root-cause: de oorzaak wordt gemeten, niet geraden | gedekt | `server/kern/command/oorzaak.js` |
| AI Supervisor: budgetten, botsingen, stoppen | gedekt | `server/kern/command/toezicht.js`<br>`/api/command/agents` |
| Autonomous remediation via goedgekeurde runbooks | gedekt | `server/kern/command/runbooks.js`<br>`/api/command/runbook/voer` |
| One-click rollback op elke herstelronde | gedekt | `/api/command/runbook/terug` |
| Policy-as-data met versies en vier ogen | gedekt | `server/kern/command/beleid.js`<br>`/api/command/beleid/zet` |
| Risk engine + confidence routing (hand/assist/auto) | gedekt | `server/kern/command/risico.js` |
| Exception queue met eigenaar, termijn en besluit | gedekt | `server/kern/command/zaken.js`<br>`/api/command/zaken` |
| Immutable audit trail met hashketen | gedekt | `server/kern/command/journaal.js`<br>`/api/command/journaal` |
| Forensic replay van een tijdvak | gedekt | `/api/command/journaal/herbeleef` |
| Digital twin / what-if en veilige beleidsproef | gedekt | `server/kern/command/simulatie.js`<br>`/api/command/simulatie/watals` |
| Workforce minimization: handminuten per 1.000 | gedekt | `server/kern/command/werkbesparing.js`<br>`/api/command/werk` |
| Just-in-time privilege, break-glass en mandaat | gedekt | `server/kern/command/toegang.js`<br>`/api/command/recht/nood` |
| RTG Command als één app | gedekt | `public/apps/command.html`<br>`public/apps/command` |
| Gezondheid per vermogen, met de bewijsgraad ernaast | gedekt | `server/kern/command/gezondheid.js`<br>`server/kern/command/vermogens.js`<br>`/api/command/gezondheid`<br>`public/apps/command/command-17.js` |
| Controleer: een ronde die echt iets uitvoert, of eerlijk zegt dat er niets uit te voeren viel | gedekt | `server/kern/command/gezondheid-proef.js`<br>`/api/command/gezondheid/controleer` |
| Herstel als transactie: voorcontrole, verificatie en terug bij mislukking | gedekt | `server/kern/command/transactie.js`<br>`server/kern/command/transactie-poorten.js`<br>`/api/command/runbook/voer` |
| Elk herstelrecept draagt een certificaat: bovengrens, weg terug, verificatie, versie | gedekt | `server/kern/command/runbookcatalogus.js` |
| Het incident als object: nummer, gemeten omvang, maatregelen, verslag | gedekt | `server/kern/command/incident.js`<br>`server/kern/command/incident-verslag.js`<br>`/api/command/incidenten`<br>`public/apps/command/command-18.js` |
| Wat van een storing niet te meten is, staat er met de reden bij | gedekt | `server/kern/command/incident-impact.js` |
| Wat is er vlak daarvoor veranderd: drie bronnen op een lijn, zonder oorzaakclaim | gedekt | `server/kern/command/tijdlijn.js`<br>`/api/command/tijdlijn` |
| Knowledge graph over personen, bedrijven, contracten en gebeurtenissen<br><sub>De randen worden gemeten uit de gegevens, niet uit een schema; de wandeling zegt het als hij tegen zijn grens loopt.</sub> | gedekt | `server/kern/command/graaf.js`<br>`/api/command/graaf`<br>`test/kwaliteit.test.js` |
| Data lineage: waar komt een gegeven vandaan en wie hangt ervan af<br><sub>Elk antwoord draagt zijn aard: gemeten, aangegeven of afgeleid. De blinde vlek staat in de uitslag -- het journaal ziet alleen wat via Command ging, dus 'geen schrijver' betekent hier niet 'hier schrijft niemand in'.</sub> | gedekt | `server/kern/command/herkomst.js`<br>`/api/command/herkomst`<br>`/api/supplier/command/herkomst`<br>`public/apps/command/command-11.js` |
| Master data management: één authoritative record per klant/bedrijf<br><sub>kern/eenaccount doet dit voor het lid; deze laag doet bedrijven en locaties. Er wordt nooit vanzelf samengevoegd -- twee bedrijven met dezelfde naam in dezelfde stad kunnen twee bedrijven zijn, en dat verschil zit niet in de gegevens. Samenvoegen wist niets: de verliezers houden een verwijzing, dus terugdraaien is dezelfde handeling omgekeerd.</sub> | gedekt | `server/kern/command/mdm.js`<br>`server/kern/command/mdmsamen.js`<br>`/api/command/mdm` |
| Data quality engine: duplicaten en inconsistenties vinden<br><sub>Zeker (dubbele sleutel, wees) en vermoed (zeldzame waarde) staan apart; een meter die vermoedens als feiten telt, wordt terecht genegeerd.</sub> | gedekt | `server/kern/command/kwaliteit.js`<br>`/api/command/kwaliteit`<br>`test/kwaliteit.test.js` |
| SLO- en error-budgetbeheer per dienst<br><sub>De norm staat in SLO.json en de tabel in SLO.md is daar een afdruk van (npm run check regel 43). De meter zegt 'onvoldoende gemeten' zolang er te weinig verkeer of te kort gemeten is; het uitrolslot slaat bewust niet aan op zulke doelen.</sub> | gedekt | `SLO.json`<br>`server/kern/command/slo.js`<br>`/api/command/slo`<br>`public/apps/command/command-10.js`<br>`scripts/slo.js` |
| Synthetic monitoring: nepgebruikers die continu de keten lopen<br><sub>Binnen en buiten staan apart en worden nergens opgeteld. Wat er NIET is: een cron die scripts/sonde.js elke minuut van buitenaf start -- dat is een inrichtingsbesluit op een machine buiten deze repo, en het staat als punt 1 in SLO.md.</sub> | gedekt | `server/kern/command/sonde.js`<br>`/api/command/sonde`<br>`/api/sonde/melding`<br>`scripts/sonde.js` |
| Chaos testing: gecontroleerd uitschakelen om failover te bewijzen<br><sub>Start een EIGEN trio met een eigen datamap en schiet de ACTIEVE server om met SIGKILL (een nette afsluiting bewijst alleen dat gepland onderhoud werkt). Raakt nooit productie en er is geen vlag om hem daarheen te richten. De uitslag staat in SLO.md: 535 verzoeken op 25 ms, 0 mislukt, geen onderbreking gemeten -- en dat is expliciet iets anders dan geen onderbreking.</sub> | gedekt | `scripts/chaos.js`<br>`scripts/lib/chaosmeet.js` |
| Canary deployments met automatische terugroldrempels<br><sub>Rolt een FUNCTIE uit de schakelkast gefaseerd uit, niet een build. De drempel rekent op dezelfde tellers als de servicedoelen, op het verschil sinds de nulmeting; na een herstart is die nulmeting kwijt en weegt hij bewust niet. Anoniem verkeer valt nooit in een canary.</sub> | gedekt | `server/kern/command/canary.js`<br>`server/functies/canaryas.js`<br>`/api/command/canary` |
| Country packs: een nieuw land activeren als configuratiebundel<br><sub>Een pakket dekt de INRICHTING en nooit de naleving: btw-registratie, loonaangifte en een toezichthouder staan per land als mensenwerk, en die lijst wordt niet korter door te activeren. LANDEN.json draagt alleen wat nergens anders staat -- de fiscale kennis komt uit kern/fiscaal/landen.js (189 landen), de muntschaal uit kern/payroll/valuta.js.</sub> | gedekt | `LANDEN.json`<br>`server/kern/command/landpakket.js`<br>`/api/command/land` |
| City bootstrap: een nieuwe stad automatisch inrichten<br><sub>Richt de ADMINISTRATIE in: een stad krijgt een land (het landpakket moet aanstaan), een naam op dezelfde normalisatie als de schakelkast, en de per-plaats-standen. Wat het NIET doet staat er als openstaande stap bij: het stadsweefsel draagt vandaag een geografie zonder sleutel welke stad, dus een tweede stad met eigen zones en Stadsdozen is een verbouwing van die laag en geen knop hier.</sub> | gedekt | `server/kern/command/stadstart.js`<br>`/api/command/stad` |
| Acquisition mode: een overgenomen bedrijf importeren en migreren<br><sub>Vier stappen waarvan de volgorde de veiligheid is: inlezen, afbeelden, droogloop, uitvoeren. Uitvoeren kan alleen met het zegel van precies de bekeken droogloop, er wordt nooit iets overschreven (een bestaande sleutel is een botsing), en elke ingevoerde rij draagt zijn partij zodat terugdraaien exact die rijen weghaalt.</sub> | gedekt | `server/kern/command/overname.js`<br>`server/kern/command/overnamevoorstel.js`<br>`/api/command/overname` |
| Enterprise API gateway met scopes, quota en contractregels<br><sub>De poort hangt op /api/extern/ en de toelating begint LEEG: er staat niets achter tot iemand er een pad in zet. Dat is een besluit en geen omissie -- een poort die bij oplevering al half het platform ontsluit is een gat met een naam. Het geheim van een sleutel wordt nergens bewaard, het quotum staat in de opslag (dus een herstart wist hem niet) en een uitfasering wordt aangekondigd voordat hij bijt.</sub> | gedekt | `server/kern/command/apipoort.js`<br>`server/middleware/apipoort.js`<br>`/api/command/apipoort` |
| Sandbox-omgevingen om processen te testen zonder productiedata<br><sub>De inhoud komt uit de zaaiset en nooit uit db.data; de motoren zien een DB-venster op het vak van de zandbak, dus er is geen pad naar een productiecollectie. Wat het NIET is: een tweede installatie -- alleen de motoren van Command draaien erop, niet de gewone app-routes.</sub> | gedekt | `server/kern/command/zandbak.js`<br>`/api/command/zandbak` |
| Een veilige noodstand die beschermt in plaats van uitzet<br><sub>Zes van de zestien functiecategorieën bevriezen, tien werken door, en vier functies lopen met naam door omdat stilzetten meer kost dan de storing (inloggen, hulpdiensten, grensdiensten, de storingsmelder). Deze stand zet GEEN enkele schakelaar om, dus opheffen is geen herstelactie. Wat hij NIET doet: sleutels roteren -- dat staat in het antwoord als nietAfgedwongen met de reden, want er is geen rotatiemechanisme voor secret.key en vault.key.</sub> | gedekt | `server/kern/beschermstand.js`<br>`server/kern/beschermstand-lijst.js`<br>`server/kern/incidentcontrole-bescherm.js`<br>`/api/techniek/controle/incident` |
| Hoeveel organisaties een storing raakte, als ondergrens<br><sub>Een ONDERGRENS en geen aantal: geteld wordt bij de twee deuren van de werkruimte, dus ledenverkeer, zaakverkeer en verkeer van buiten staan onder nietToegewezen. Gaat nooit mee naar Prometheus (geen tekst()-functie) en de org-codes verlaten de module niet. Wat het NIET is en niet wordt: een beschikbaarheidscijfer per klant.</sub> | gedekt | `server/meting-tenant.js`<br>`server/bedrijf/deuren.js` |
| De klant krijgt bericht als er een bijstandssessie loopt<br><sub>In zijn eigen werkruimtejournaal: een kanaal dat hij al leest en dat een gesloten tabblad overleeft. Een regel op de vier momenten dat RTG handelt, met het sessie-id en zonder de codenaam van de medewerker. Wat er bewust NIET bij komt is mail of een telefoonmelding -- dat is een kanaalbesluit dat een klant hoort in te stellen.</sub> | gedekt | `server/kern/command/bijstand-melden.js` |

## De zaak: dezelfde regie, eigen scope

| belofte | stand | waar het staat |
| --- | --- | --- |
| Objectregister van één zaak, zonder de buurman | gedekt | `server/kern/zaakcommand/register.js` |
| Signalen: wat een mens moet beslissen | gedekt | `server/kern/zaakcommand/signalen.js` |
| Recepten die administratie rechtzetten, geen werkelijkheid verzinnen | gedekt | `server/kern/zaakcommand/runbooks.js` |
| Rolscope: verlof en sollicitaties alleen voor de leiding | gedekt | `server/kern/zaakcommand/register.js`<br>`test/zaakcommand.test.js` |
| Regie in de zaak-app en op de PDA, één scherm | gedekt | `public/shared/zaakcommand`<br>`public/apps/leverancier.html`<br>`public/apps/personeel.html` |

## De zaak: regie over de eigen onderneming

| belofte | stand | waar het staat |
| --- | --- | --- |
| Ook een zaak repareert door de hersteltransactie, niet erlangs<br><sub>Voorcontrole, momentopname, uitvoeren, verificatie, vastleggen -- met certificaten die LAGER staan dan aan de RTG-kant, want de schaal van een zaak is de schaal van één onderneming. De gezondheidskaart gaat er bewust niet in en dat staat als `fundament-gezond: gecontroleerd false` met de reden in het antwoord.</sub> | gedekt | `server/kern/zaakcommand/runbooks.js`<br>`/api/supplier/command/runbook/voer` |

