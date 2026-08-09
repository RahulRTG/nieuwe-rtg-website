# Het belofteregister

Wat er is toegezegd, en waar het staat. Elke belofte draagt haar dekking: bestandspaden of API-paden die er echt moeten zijn. `node scripts/belofte.js` kijkt dat na. Een belofte zonder dekking heet OPEN en is werkvoorraad; een belofte die naar iets verwijst dat er niet meer is heet GEBROKEN, en dat is de enige alarmerende stand -- zo'n belofte mist niemand vanzelf.

Dit register beoordeelt geen kwaliteit. Dat een bestand bestaat, zegt niet dat de belofte goed is ingelost; daarvoor is BEWIJS.md er, en de toetsen die daaronder liggen.

> Gegenereerd met `node scripts/belofte.js`. Bewerk **BELOFTE.json**, niet dit bestand.

| stand | aantal | wat het betekent |
| --- | --- | --- |
| gedekt | 56 | elk bewijsstuk bestaat |
| open | 9 | nog geen dekking opgeschreven: werkvoorraad |
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
| Knowledge graph over personen, bedrijven, contracten en gebeurtenissen<br><sub>De randen worden gemeten uit de gegevens, niet uit een schema; de wandeling zegt het als hij tegen zijn grens loopt.</sub> | gedekt | `server/kern/command/graaf.js`<br>`/api/command/graaf`<br>`test/kwaliteit.test.js` |
| Data quality engine: duplicaten en inconsistenties vinden<br><sub>Zeker (dubbele sleutel, wees) en vermoed (zeldzame waarde) staan apart; een meter die vermoedens als feiten telt, wordt terecht genegeerd.</sub> | gedekt | `server/kern/command/kwaliteit.js`<br>`/api/command/kwaliteit`<br>`test/kwaliteit.test.js` |
| SLO- en error-budgetbeheer per dienst<br><sub>De norm staat in SLO.json en de tabel in SLO.md is daar een afdruk van (npm run check regel 43). De meter zegt 'onvoldoende gemeten' zolang er te weinig verkeer of te kort gemeten is; het uitrolslot slaat bewust niet aan op zulke doelen.</sub> | gedekt | `SLO.json`<br>`server/kern/command/slo.js`<br>`/api/command/slo`<br>`public/apps/command/command-10.js`<br>`scripts/slo.js` |
| Synthetic monitoring: nepgebruikers die continu de keten lopen<br><sub>Binnen en buiten staan apart en worden nergens opgeteld. Wat er NIET is: een cron die scripts/sonde.js elke minuut van buitenaf start -- dat is een inrichtingsbesluit op een machine buiten deze repo, en het staat als punt 1 in SLO.md.</sub> | gedekt | `server/kern/command/sonde.js`<br>`/api/command/sonde`<br>`/api/sonde/melding`<br>`scripts/sonde.js` |

## De zaak: dezelfde regie, eigen scope

| belofte | stand | waar het staat |
| --- | --- | --- |
| Objectregister van één zaak, zonder de buurman | gedekt | `server/kern/zaakcommand/register.js` |
| Signalen: wat een mens moet beslissen | gedekt | `server/kern/zaakcommand/signalen.js` |
| Recepten die administratie rechtzetten, geen werkelijkheid verzinnen | gedekt | `server/kern/zaakcommand/runbooks.js` |
| Rolscope: verlof en sollicitaties alleen voor de leiding | gedekt | `server/kern/zaakcommand/register.js`<br>`test/zaakcommand.test.js` |
| Regie in de zaak-app en op de PDA, één scherm | gedekt | `public/shared/zaakcommand`<br>`public/apps/leverancier.html`<br>`public/apps/personeel.html` |

## Nog open

| belofte | stand | waar het staat |
| --- | --- | --- |
| Data lineage: waar komt een gegeven vandaan en wie hangt ervan af | open | _nog niet gebouwd_ |
| Master data management: één authoritative record per klant/bedrijf<br><sub>kern/eenaccount doet dit voor het lid; voor bedrijven en locaties niet.</sub> | open | _nog niet gebouwd_ |
| Chaos testing: gecontroleerd uitschakelen om failover te bewijzen | open | _nog niet gebouwd_ |
| Canary deployments met automatische terugroldrempels | open | _nog niet gebouwd_ |
| Country packs: een nieuw land activeren als configuratiebundel | open | _nog niet gebouwd_ |
| City bootstrap: een nieuwe stad automatisch inrichten | open | _nog niet gebouwd_ |
| Acquisition mode: een overgenomen bedrijf importeren en migreren | open | _nog niet gebouwd_ |
| Enterprise API gateway met scopes, quota en contractregels | open | _nog niet gebouwd_ |
| Sandbox-omgevingen om processen te testen zonder productiedata | open | _nog niet gebouwd_ |

