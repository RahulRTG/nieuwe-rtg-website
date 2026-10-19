# Loopbaan (link:loopbaan)

Eigenaar: `loopbaan.ledger` -> `apps/loopbaan.html` (lid: "bekijkt en vult zijn
carrièreledger: de reeks bewijsregels, de zeven voorraden en wat hij heeft
gedeeld") en `loopbaan.bewijs` -> `apps/loopbaanbewijs.html` (publiek: iemand
zonder RTG-account bekijkt één gedeelde regel). Diepte-document: CARRIERE.md
par. 6d. Doelgroep: lid; met een zaak en het kantoor als bevestigers.

Grenzen van deze app: werving en vacatures zijn van `werk.vacatures`
(`apps/foundation/werk.html`, `server/routes/werving.js`, `server/kern/werk.js`);
het cv is van `werk.cvmaker` (`apps/foundation/cv.html`); het dienstverband is van
Concern (`server/kern/concern/employment.js`); leren en bewijs van vaardigheden
zijn van het leerhuis (`leerhuis.mijn`) en School; geld naar een talent is van
`server/kern/rugdekking`; vertegenwoordiging is van `mandaat.beheer`.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Schermen: `public/apps/loopbaan.html` (roept `/api/carriere/ledger/*` en
  `/api/concern/mijnwerk` aan), `public/apps/loopbaanbewijs.html` (alleen
  `/api/carriere/regel/toon`).
- Routes:
  - `server/routes/carriereledger.js`: `/api/carriere/ledger/{mijn, afschrift, zet, intrek, deel, delen, stopdelen}` (auth) en `/api/carriere/regel/toon` (zonder sessie).
  - `server/routes/office/carriereledger.js`: `/api/office/carriere/ledger/bevestig` (kluisAuth, herkomst `gezien`).
  - `server/routes/supplier/carriereledger.js`: `/api/supplier/carriere/bevestig` en `/intrek` (supplierAuth, alleen manager).
- Kern: `server/kern/carriereledger/` (`index.js`, `regels.js`, `projectie.js`, `deel.js`).
  Data: `carriereLedger` (kaart per lid), `carriereDelen` (lijst).
- Regels (`regels.js`):
  - drie soorten regels: feit, bevestiging, intrekking; append-only; `ingetrokken`
    wordt bij het lezen afgeleid;
  - drie herkomsten met elk "stelt" en "zegt niet": `zelf`, `gezien`, `bevestigd`;
  - zeven kapitalen zonder totaal (vermogen, netwerk, publiek, financieel,
    eigendom, bewijs, reputatie);
  - NOOIT: cijfer, bedrag, gezondheid, een feit over een ander, toekomst;
  - dubbele regel op dezelfde dag: 409; intrekken vraagt een reden;
  - een zaak trekt alleen haar eigen bevestiging in (`magTerug`).
- Delen: code van 128 bits via `server/kern/bearercode.js`, als hash op schijf,
  standaard 30 dagen, maximaal een jaar; een ingetrokken feit wordt getoond als ingetrokken.
- Handhaver CAR-05: `scripts/lib/cijferopmens.js`, `test/cijferopmens.test.js`.
- Toetsen: `test/carriereledger.test.js`, `test/carriereledger.e2e.test.js`.

**Wat bewezen is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent, herstelbaar | BEWEZEN centraal (7 van 8) | APPWERKT.json |
| bevoegd | NIET_GETEST; BEVOEGD.json telt 8/7 | BEVOEGD.json (05:08, 55ed79f9) |
| IDOR | huisbreed 0 doorbraken | IDOR.json |

De voltooiproef (`scripts/lib/voltooi/loopbaan.js`) loopt: feit zonder kapitaal,
met bedrag of in de toekomst geweigerd; echt feit met herkomst `zelf`; dubbel op
dezelfde dag 409; delen met een vreemde zonder sessie, die alleen dat feit en
het voorbehoud ziet; intrekken zonder reden 400, met reden blijft het feit staan;
afschrift en `concern/mijnwerk` laden.

**Wat de code of het document zelf als niet gebouwd opgeeft**

- CARRIERE.md par. 6d: een zaak kan zelf geen feit voorstellen (bewust).
- Par. 3: Rights Vault, C2PA en Verifiable Credentials bestaan niet; C2PA en
  WebAuthn Level 3 als `vermoed`, niet nageslagen.
- Par. 7: de ketenproef voor dit onderwerp is niet gedraaid.
- `regels.js`: het ledger bewaart maximaal 500 regels en kapt aan de voorkant,
  met de eerste regel vast; `projectie.js` zegt dat in het afschrift.

## b. Marktvergelijking

Alle regels: geraadpleegd 2026-10-19, (via zoektool, live te controleren).
Alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| LinkedIn Premium Career | InMail, profielbezoekers over 365 dagen, anoniem bekijken, Learning, AI | profielbezoekers nee, en niet doen (volgsysteem); anoniem bekijken niet van toepassing: niemand doorzoekt een ledger; Learning via leerhuis/School | https://premium.linkedin.com/careers/compare-plans |
| LinkedIn Recruiter Corporate en Talent Insights (offerte) | 150 InMails per seat, koppelingen met 28+ ATS'en; arbeidsmarktinzicht | nee, en zoeken in ledgers niet doen (CARRIERE.md par. 6d: "alles over deze mens" buiten de orde) | https://www.linkedin.com/help/linkedin/answer/a417251, https://business.linkedin.com/hire/talent-insights |
| Workday Recruiting met HiredScore en Paradox (duurste, offerte) | AI-ranking van kandidaten, agents | nee, en ranking niet doen (geen cijfer op een mens) | https://blog.workday.com/en-us/workday-leads-talent-acquisition-agentic-era.html |
| Cornerstone Galaxy (offerte) | Skills Architect, People Graph | half: zeven voorraden als feiten; geen vaardighedenlijst (voorstel 103 vraagt besluit) | https://www.cornerstoneondemand.com/platform/portfolio-packages/ |
| Indeed (werkgever) | Sponsored Jobs, Smart Sourcing | vacatures ja (`werk.vacatures`); sponsoring nee | https://www.indeed.com/hire/resources/howtohub/how-pricing-works-on-indeed |

Wat de markt verkoopt is zichtbaarheid en rangorde. Wat wij hebben en de markt
niet: een feit dat een derde vanaf zijn eigen account bevestigt, met wat dat NIET
zegt erbij, en één regel delen zonder de rest van het profiel.

## c. Analyse van het volledige domein

**Particulier.** Een mens bouwt een loopbaan over werkgevers, opleidingen,
opdrachten en vrijwilligerswerk heen. Hij wil bewijs dat zijn vertrek bij een
werkgever overleeft, en hij wil per ontvanger kiezen wat hij laat zien. Een
minderjarige mag een leerdossier hebben onder de vier voorwaarden; competitieve
progressie stopt bij 18+ (`progressieMag`, `server/kern/spellen/grens.js`).

**Professioneel.** Een werkgever is bij het einde van de arbeidsovereenkomst op
verzoek van de werknemer verplicht een getuigschrift uit te reiken (art. 7:656 BW);
minimaal de aard van het werk en de duur, een beoordeling alleen op verzoek van
de werknemer. Termijn en lidnummering spreken elkaar in de bronnen tegen: te
controleren. Bron (secundair, via zoektool, live te controleren, 2026-10-19):
https://lawyrup.nl/burgerlijk_wetboek/burgerlijk-wetboek-inleiding/bijzondere-overeenkomsten/arbeidsovereenkomst/bijzondere-verplichtingen-werkgever/.
Persoonseisen per vak (BIG, VOG, beveiliging) wonen in `server/kern/persoonseis.js`
en `server/kern/vakbewijs.js`; het nummer staat in de kluis.

**Organisatie.** Werving: met loontransparantie (EU 2023/970) komen een
salarisindicatie in de vacature en een verbod op de vraag naar eerder salaris;
wetsvoorstel ingediend 21-5-2026, beoogd 1-1-2027, te controleren; nog geen recht.
Bron: https://www.rijksoverheid.nl/actueel/nieuws/2026/05/21/meer-openheid-over-loonkloof-tussen-mannen-en-vrouwen.
Bewaren: overige personeelsgegevens 2 jaar (AP-richtlijn); sollicitatiegegevens
"niet langer dan nodig". Bron: https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers.

**Wat dat betekent voor software.**

- Het ledger is van de mens en niet van de werkgever; het werkgeversdeel is een
  bevestiging op een regel die de mens aanlevert.
- Een getuigschrift is een document van de werkgever met een vaste minimale
  inhoud; in het ledger hoort alleen DAT er een is en wie het afgaf, het stuk zelf in RTDocs.
- Geen salaris in het ledger (CAR-05, NOOIT.bedrag); een salarisindicatie hoort
  bij de vacature, niet bij de persoon.
- Delen moet per ontvanger, tijdelijk en intrekbaar.

## d. Functiecatalogus L1-L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Feit zetten, intrekken met reden | bestaat, `carriereledger.js` | `carriereLedger` | `toets()` in `regels.js` | herkomst `zelf` zegt dat niemand anders het zag | lid | alleen het lid | - | - | - | bestaat |
| Eén regel delen met code | bestaat, `deel.js` | `carriereDelen` | 30 dagen standaard, maximaal 365 | - | ontvanger zonder sessie | lid start en stopt | ingetrokken feit: getoond als ingetrokken | - | - | bestaat |
| Werkervaring uit het dienstverband voorstellen aan het lid | ontbreekt; `loopbaan.html` leest `/api/concern/mijnwerk` alleen als overzicht | employment (Concern): entiteit, functie, van, tot | voorstel "werkte bij X als Y van-tot", kapitaal `netwerk`; het lid zet het zelf; geen bedrag | functienaam zoals de werkgever die invulde | lid bij einde dienstverband | lid kiest; niets komt vanzelf in het ledger | lopend dienstverband: alleen "sinds" | wie uit dienst gaat, ziet één voorstel en zet het met één tik; zonder tik staat er niets | klein | aanbevolen nu |
| Bundel delen (meerdere regels, één code) | ontbreekt | `carriereDelen` | dezelfde code-regels; de ontvanger ziet alleen de gekozen regels, niet hoeveel er nog zijn | - | ontvanger | lid | - | een sollicitant deelt drie feiten met één code; de werkgever ziet niet dat er twintig zijn | middel | later |
| Afschrift als document | half: `/afschrift` bestaat, geen bestand | ledger | inclusief intrekkingen en de afkap-melding | - | lid | lid | - | het lid bewaart zijn afschrift in RTDocs | klein | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Kantoor noteert "gezien" | bestaat, `office/carriereledger.js` | stuk | herkomst `gezien`: een mens van RTG zag een stuk, niet: het stuk is echt | - | lid | kluisAuth, op naam | - | - | - | bestaat |
| Vakbewijs als feit | ontbreekt als koppeling | `kern/vakbewijs.js` (afgetekend stuk) | het lid kiest om een afgetekend vakbewijs als feit te zetten; nummer blijft in de kluis | stuk verloopt; het feit zegt "afgetekend op", nooit "geldig" | lid | lid kiest | verlopen stuk: feit blijft, met de datum | een kok zet "VSH afgetekend door RTG op 3-9" zonder registernummer | klein | later |
| Getuigschrift-aanvraag | ontbreekt | dienstverband, RTDocs | het lid vraagt bij einde dienstverband; de werkgever levert een document; in het ledger komt "getuigschrift afgegeven door X op datum", herkomst `bevestigd` | termijn te controleren | werkgever bij aanvraag; lid bij aflevering | lid vraagt, manager levert | beoordeling alleen op verzoek van het lid | de werkgever ziet de vraag in Team Room; het lid ziet het stuk in RTDocs en het feit in zijn ledger | middel | later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Zaak bevestigt een regel | bestaat, `supplier/carriereledger.js` | regel-id + codenaam | manager; de zaaknaam met de medewerker | - | lid | geen toestemming van het lid per bevestiging nodig | - | - | - | bestaat |
| Bevestiging alleen met relatie of verzoek | ontbreekt: elke manager met codenaam en regel-id kan bevestigen, onbeperkt met wisselende tekst | dienstverband (Concern), bevestigingsverzoek van het lid | een bevestiging mag als (a) het lid erom vroeg voor deze zaak, of (b) er een dienstverband bij die zaak bestaat of bestond | - | lid bij elke bevestiging | lid kan een bevestiging weigeren te tonen (intrekking van zijn kant) | kantoor `gezien` buiten deze regel | een zaak zonder verzoek en zonder dienstverband krijgt 403; met verzoek komt de bevestiging één keer door | klein | aanbevolen nu |
| Ledgerplafond niet door derden te vullen | ontbreekt: bevestigingen tellen mee voor de 500 regels | `MAX_REGELS` in `regels.js` | bevestigingen per zaak per feit begrenzen (bijv. 1 actief); afkap nooit door regels van een ander | - | lid | - | - | een zaak kan met 500 bevestigingen niet de oudste feiten van een lid wegdrukken | klein | aanbevolen nu |
| Werving leest gedeelde regels | ontbreekt | sollicitatie (`routes/werving.js`), deelcode | het lid voegt een code toe aan zijn sollicitatie; alleen de manager ziet hem (personeelzicht) | - | manager | lid kiest | code verloopt: sollicitatie toont "verlopen", niet leeg | de manager opent bij een sollicitatie de drie gedeelde feiten met hun herkomst | klein | later (eigenaar werk.vacatures) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Wat ontbreekt aan bewijs bij een feit | ontbreekt | ledger | per feit: herkomst `zelf` zonder bevestiging of `gezien` wordt als zodanig benoemd, met wie het zou kunnen bevestigen (alleen het lid ziet dit) | geen | lid | lid | - | "dit diploma staat er op uw eigen woord; het kantoor kan een stuk inzien" | klein | later |
| Score, ranglijst, Career Independence Score | - | - | - | - | - | - | - | - | - | niet doen: CARRIERE.md par. 4.1, CAR-05 |
| Matching op vacatures | ontbreekt | vacatures, ledger | alleen op verzoek van het lid, lokaal-eerst, uitkomst als voorstel met klasse `advies` en de redenen | voorspelling is geen feit | lid | lid start | geen ledger-doorzoeking door werkgevers | het lid vraagt "welke vacatures passen bij mijn feiten" en krijgt redenen per vacature | middel | later (eigenaar werk.vacatures) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Leerdossier van een jongere | half: School en leerhuis; ledger kent geen leeftijdsgrens | School, leerhuis | leerdossier mag onder de vier voorwaarden; geen vergelijking, geen niveaulabel | - | jongere | jongere en wie een rechtmatige verhouding heeft | competitieve feiten (ranglijst) pas bij `volwassen()` | een 15-jarige kan "diploma zwemmen" zetten; een toernooipositie niet | klein | later, besluit |
| Ledger na overlijden of opzegging | niet gevonden | ledger, nalatenschap | - | - | - | - | - | - | middel | later, besluit |
| Bewaartermijn | niet gevonden in `server/bewaarbeleid.js` | ledger | zolang het account bestaat; bij opzegging export en wissen | - | lid | lid | - | bij opzegging krijgt het lid zijn afschrift mee | klein | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werkoverzicht uit Concern | bestaat, `/api/concern/mijnwerk` | employment | alleen eigen sessie | - | lid | - | - | - | - | bestaat |
| Ledgerfeit naar cv | ontbreekt | ledger, `werk.cvmaker` | het cv toont een feit met zijn herkomst-label | - | lid | lid kiest | - | in het cv staat "bevestigd door X" naast een functie | klein | later (eigenaar werk.cvmaker) |
| Examen of leerbewijs naar ledger | ontbreekt | School, leerhuis | alleen een echt diploma, nooit een oefenindicatie | - | lid | lid | onder 18: leerdossier, geen ranking | - | klein | later |

**Modus LOS.** Staan Concern, Werving en RTDocs uit, dan blijft de kerntaak: zelf
feiten zetten, intrekken met reden, één regel delen en stoppen. Het scherm zegt:
"Uw werkgevers zijn nu niet te tonen; uw ledger staat los daarvan en is
volledig." De publieke pagina werkt zonder account en zonder andere apps.

**Modus SAMEN.** Keten "kok vertrekt en solliciteert".

1. De kok werkt bij zaak MERIDIAAN; Concern kent het dienstverband.
2. Bij vertrek stelt Loopbaan voor: "werkte bij Meridiaan Toren als kok,
   2025-2026". Hij zet het (herkomst `zelf`). *Storing: Concern niet bereikbaar.*
   Zichtbaar: "voorstel nu niet te maken; u kunt het feit zelf schrijven".
   Bewaard: niets automatisch.
3. Hij vraagt de manager te bevestigen en geeft het regelnummer. De manager
   bevestigt vanaf het zaakaccount. *Storing: dubbele tik.* Bewaard: één
   bevestiging (409 op de tweede).
4. Het kantoor noteert `gezien` op zijn VSH-stuk. *Storing: kantoor zonder naam.*
   403: een bevestiging gaat op naam.
5. Hij deelt het werkfeit 14 dagen met een nieuwe werkgever; die opent de
   publieke pagina zonder account. *Storing: code verlopen.* Zichtbaar: "deze
   code is verlopen"; bewaard: het feit en het spoor van het delen.
6. Hij stopt het delen. *Storing: crash direct na stoppen.* Na herstart blijft
   de code dicht (voltooiproef herstelbaar).
7. Zijn loonstroken van Meridiaan blijven in `loon.strook` (na de fix daar); geen
   bedrag komt in het ledger.

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Werkfeit uit een echt dienstverband, door het lid gekozen, door de werkgever bevestigd | Loopbaan | `loopbaan.ledger` + Concern employment | een profielsite kent het dienstverband niet; een HR-pakket is van de werkgever |
| "Gezien door RTG" naast "bevestigd door de bond", nooit samengevoegd | Loopbaan | herkomst `gezien` / `bevestigd` | vereist een kantoor met kluis en een zaakaccount in hetzelfde huis |
| Eén feit tonen aan een vreemde zonder account, zonder de rest | Loopbaan | `loopbaan.bewijs`, `bearercode.js` | profielen delen alles of niets |
| Vakbewijs zonder nummer delen | Loopbaan + kluis | `vakbewijs.js`, `member_state` | het nummer verlaat de kluis niet |

## f. Bouwstenen en ontbrekende koppelingen

**Bouwstenen.** `server/kern/carriereledger/` (vier bestanden),
`server/routes/carriereledger.js`, `server/routes/office/carriereledger.js`,
`server/routes/supplier/carriereledger.js`, `server/kern/bearercode.js`,
`server/kern/concern/employment.js`, `server/routes/concern/mensen.js`,
`server/kern/vakbewijs.js`, `server/routes/werving.js`, `server/kern/werk.js`,
`scripts/lib/cijferopmens.js`, `server/kern/spellen/grens.js`, `server/kern/volwassen.js`.

**Ontbrekende koppelingen.**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| Concern employment (einde) | Loopbaan | projectie: voorstel, nooit een regel | lid zet |
| lid | zaak | bevestigingsverzoek (gebeurtenis) | lid; zonder verzoek of dienstverband geen bevestiging |
| vakbewijs (afgetekend) | ledger | verwijzing zonder nummer | lid |
| deelcode | sollicitatie | verwijzing | lid; alleen manager leest |
| ledger | `werk.cvmaker` | projectie | lid |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Bevestiging alleen met verzoek of dienstverband | klein | laag | Concern employment | aanbevolen nu |
| Afkap nooit door regels van derden | klein | laag | `index.js`, `regels.js` | aanbevolen nu |
| Werkervaring als voorstel bij einde dienstverband | klein | laag | `/api/concern/mijnwerk` | aanbevolen nu |
| Ketenproef dienstverband -> feit -> bevestiging -> delen | klein | laag | voltooiwereld | aanbevolen nu |
| BEVOEGD-ronde op de drie deuren | klein | laag | BEVOEGD | aanbevolen nu |
| Bundel delen, afschrift als document, vakbewijs als feit | klein tot middel | middel | RTDocs, kluis | later |
| Getuigschrift-aanvraag | middel | middel | Team Room, RTDocs, wettekst nalezen | later |
| Werving leest gedeelde regels, matching op verzoek | middel | middel | `werk.vacatures` | later |
| Verifiable Credentials | groot | hoog | standaard nalezen (par. 3) | later, besluit |
| Score, ranglijst, profielbezoekers | - | - | - | niet doen: CAR-05, LIFE.md |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | werk, opleiding, vak, publiek, eigendom: alle zeven voorraden bruikbaar | e2e met een feit per kapitaal | toets per kapitaal niet gevonden |
| Professionele diepte | werkgever, kantoor en bond bevestigen elk met hun eigen betekenis | `test/carriereledger.e2e.test.js` | bestaat |
| Levenscyclus | een feit overleeft vertrek, intrekking en 500 regels van anderen | nieuwe toets: zaak vult met bevestigingen, eerste feiten blijven | faalt vandaag naar verwachting (zie f) |
| Samenwerking en rollen | geen bevestiging zonder verzoek of dienstverband | BEVOEGD-ronde | ontbreekt |
| Domeinintelligentie | nergens een cijfer op een mens | `test/cijferopmens.test.js` | bestaat (lexicale ondergrens) |
| Los functioneren | zonder Concern werkt het ledger volledig | voltooiproef met Concern uit | niet gemeten |
| RTG-ketens | dienstverband tot gedeeld, bevestigd feit | ketenproef (CARRIERE.md par. 7) | niet gedraaid |
| Bewezen betrouwbaarheid | acht bewijzen centraal | APPWERKT.json | 7 BEWEZEN, bevoegd NIET_GETEST |

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Bevestiging alleen met verzoek of dienstverband | klein | `server/routes/supplier/carriereledger.js`, `server/kern/concern/employment.js` |
| Afkap nooit door regels van derden | klein | `server/kern/carriereledger/index.js` |
| Werkervaring als voorstel | klein | `/api/concern/mijnwerk` |
| Ketenproef en BEVOEGD-ronde | klein | `scripts/lib/voltooi/loopbaan.js` |
| Later: bundel delen, afschrift als document, vakbewijs als feit, getuigschrift-aanvraag, werving met deelcode | klein tot middel | `deel.js`, `vakbewijs.js`, `routes/werving.js`, RTDocs |

### (B) Het domeinmaximum, ook buiten de scope (richting, geen toezegging)

**Proces 1. Van sollicitatie tot vertrek.**
- Stappen: vacature met salarisindicatie, sollicitatie met gedeelde feiten,
  gesprek, aanname, contract, dienstverband, ontwikkeling en opleiding, opzegging,
  getuigschrift, werkfeit in het ledger, bevestiging door de werkgever.
- Rollen: kandidaat, manager, werkgever (entiteit), loonkantoor.
- RTG-apps: `werk.vacatures` (eigenaar werving), Concern (dienstverband),
  Team Room, Payroll OS, Loopbaan (eigenaar van het ledger), RTDocs.
- Buiten de scope: loontransparantie (wet), een vaardighedenlijst (voorstel 103:
  besluit), getuigschrift als sjabloon met wettelijke minimuminhoud.

**Proces 2. Beroepsregistratie en vakbewijs.**
- Stappen: diploma, inschrijving in een beroepsregister, periodieke herregistratie,
  bijscholing, bewijs tonen aan een werkgever.
- Rollen: professional, beroepsorganisatie, register, werkgever, RTG-kantoor (`gezien`).
- RTG-apps: `kern/vakbewijs.js` en `kern/persoonseis.js`, Loopbaan, leerhuis.
- Buiten de scope: koppeling met externe registers (RTG valideert vandaag niets
  inhoudelijk en belt het register niet; dat veranderen is een besluit) en
  Verifiable Credentials als uitwisselvorm.

**Proces 3. Talent: sporter, artiest, maker.**
- Stappen: prestaties en uitslagen, bevestiging door bond of label, contracten
  (als feit, zonder bedrag), vertegenwoordiging, rechten op eigen werk.
- Rollen: talent, club of bond, agent, sponsor, ouder bij een minderjarige.
- RTG-apps: Loopbaan, `mandaat.beheer`, `kern/rugdekking`, School.
- Buiten de scope: Rights Vault en contentherkomst (C2PA), CARRIERE.md par. 3:
  bestaan niet; nieuw domein, dus besluit.

## Vraagt besluit

1. **Wanneer mag een zaak een regel bevestigen?**
   - **A (aanbevolen): na een verzoek van het lid aan die zaak, of bij een (oud) dienstverband bij die entiteit.** Kost: klein.
   - B: alleen na een verzoek. Kost: klein; ook een oud-werkgever moet dan eerst gevraagd worden.
   - C: zo laten (codenaam plus regel-id volstaat). Kost: nul; een zaak kan ongevraagd bevestigen en met wisselende tekst het plafond van 500 regels vullen.
2. **De naam van de manager in een publiek getoonde bevestiging.**
   - **A (aanbevolen): zaaknaam plus rol ("manager"), de persoonsnaam alleen voor het lid.** Kost: klein; houdt namen uit het publieke deel.
   - B: zo laten (zaaknaam met de naam van de medewerker). Kost: nul; een echte naam reist mee met elke deelcode.
3. **Getuigschrift.**
   - **A (aanbevolen): later, eerst de wettekst van art. 7:656 BW nalezen; het stuk in RTDocs, het feit in het ledger.** Kost: middel.
   - B: niet doen; het blijft een document buiten RTG. Kost: nul.
