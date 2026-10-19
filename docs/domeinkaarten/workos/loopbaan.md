# Loopbaan (link:loopbaan)

**Volledige werkzaamheid:** de app doet volledig waarvoor ze er is als een lid
een feit over zijn eigen loopbaan vastlegt, het laat bevestigen door een partij
die daar aantoonbaar toe in de positie is (een werkgever waar hij werkte of een
partij die hij erom vroeg, of het RTG-kantoor op naam), één feit met een
verlopende code toont aan een ontvanger zonder account, en dat feit kan
intrekken of het delen stoppen, zonder dat een regel ooit verdwijnt of een derde
zijn ledger kan vullen. Toets: de voltooiproef `scripts/lib/voltooi/loopbaan.js`
sluit, `test/carriereledger-appendonly.test.js` is groen, en een zaak zonder
verzoek en zonder dienstverband krijgt bij bevestigen een weigering.

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
  - een zaak trekt alleen haar eigen bevestiging in (`magTerug`);
  - sinds 73ae8c6: het ledger knipt nooit (vol is vol, 409 bij 500 regels);
    een partij (de zaak, anders de naam) heeft per feit hoogstens één actieve
    bevestiging en over de hele geschiedenis hoogstens drie
    (`bevestigBezwaar`); de laatste 50 regels zijn voor de eigenaar.
- Delen: code van 128 bits via `server/kern/bearercode.js`, als hash op schijf,
  standaard 30 dagen, maximaal een jaar, met een eigen label `voor` per ontvanger;
  een ingetrokken feit wordt getoond als ingetrokken. Er wordt niet bijgehouden
  of en hoe vaak een code is geopend.
- Handhaver CAR-05: `scripts/lib/cijferopmens.js`, `test/cijferopmens.test.js`.
- Toetsen: `test/carriereledger.test.js`, `test/carriereledger.e2e.test.js`,
  `test/carriereledger-appendonly.test.js`.

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
- Het afkappen is weg (73ae8c6), maar twee plekken zeggen nog het oude:
  de kop boven `MAX_REGELS` in `server/kern/carriereledger/regels.js` ("daarboven
  kapt ./index.js aan de voorkant"), en `projectie.js` zet bij 500 regels
  `misschienAfgekapt`, waarop `public/apps/loopbaan.html` het lid meldt "oudere
  regels kunnen ontbreken". Dat is sinds 73ae8c6 niet meer waar.
- De bevestigingsroute van de zaak vraagt nog steeds geen verzoek van het lid
  en geen dienstverband (`server/routes/supplier/carriereledger.js`).

## b. Marktvergelijking

Alle regels: geraadpleegd 2026-10-19, (via zoektool, live te controleren).
Alleen ter vergelijking. Elke regel in deze tabel is **(te controleren)**: hij
komt uit een zoeksamenvatting, geen pagina is zelf geopend.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| LinkedIn Premium Career | InMail, profielbezoekers over 365 dagen, anoniem bekijken, Learning, AI | profielbezoekers nee, en niet doen (volgsysteem); anoniem bekijken niet van toepassing: niemand doorzoekt een ledger; Learning via leerhuis/School | https://premium.linkedin.com/careers/compare-plans (te controleren) |
| LinkedIn Recruiter Corporate en Talent Insights (offerte) | 150 InMails per seat, koppelingen met 28+ ATS'en; arbeidsmarktinzicht | nee, en zoeken in ledgers niet doen (CARRIERE.md par. 6d: "alles over deze mens" buiten de orde) | https://www.linkedin.com/help/linkedin/answer/a417251, https://business.linkedin.com/hire/talent-insights (te controleren) |
| Workday Recruiting met HiredScore en Paradox (duurste, offerte) | AI-ranking van kandidaten, agents | nee, en ranking niet doen (geen cijfer op een mens) | https://blog.workday.com/en-us/workday-leads-talent-acquisition-agentic-era.html (te controleren) |
| Cornerstone Galaxy (offerte) | Skills Architect, People Graph | half: zeven voorraden als feiten; geen vaardighedenlijst (voorstel 103 vraagt besluit) | https://www.cornerstoneondemand.com/platform/portfolio-packages/ (te controleren) |
| Indeed (werkgever) | Sponsored Jobs, Smart Sourcing | vacatures ja (`werk.vacatures`); sponsoring nee | https://www.indeed.com/hire/resources/howtohub/how-pricing-works-on-indeed (te controleren) |

Wat de markt verkoopt is zichtbaarheid en rangorde. Wat wij hebben en de markt
niet: een feit dat een derde vanaf zijn eigen account bevestigt, met wat dat NIET
zegt erbij, en één regel delen zonder de rest van het profiel.

## c. Analyse van het volledige domein

Geen van de wetsregels in deze paragraaf is in de primaire tekst nagelezen; elke
regel draagt **(te controleren)** en wordt nergens een harde weigerregel. De
grenzen die wél hard zijn (CAR-05, `progressieMag`, de kluis) zijn huisregels
uit AGENTS.md en CARRIERE.md, geen wetsregels.

**Particulier.** Een mens bouwt een loopbaan over werkgevers, opleidingen,
opdrachten en vrijwilligerswerk heen. Hij wil bewijs dat zijn vertrek bij een
werkgever overleeft, en hij wil per ontvanger kiezen wat hij laat zien. Een
minderjarige mag een leerdossier hebben onder de vier voorwaarden; competitieve
progressie stopt bij 18+ (`progressieMag`, `server/kern/spellen/grens.js`).

**Professioneel.** Een werkgever is bij het einde van de arbeidsovereenkomst op
verzoek van de werknemer verplicht een getuigschrift uit te reiken (art. 7:656 BW);
minimaal de aard van het werk en de duur, een beoordeling alleen op verzoek van
de werknemer **(te controleren)**. Termijn en lidnummering spreken elkaar in de
bronnen tegen. Bron (secundair, via zoektool, live te controleren, 2026-10-19):
https://lawyrup.nl/burgerlijk_wetboek/burgerlijk-wetboek-inleiding/bijzondere-overeenkomsten/arbeidsovereenkomst/bijzondere-verplichtingen-werkgever/.
Persoonseisen per vak (BIG, VOG, beveiliging) wonen in `server/kern/persoonseis.js`
en `server/kern/vakbewijs.js`; het nummer staat in de kluis.

**Organisatie.** Werving: met loontransparantie (EU 2023/970) komen een
salarisindicatie in de vacature en een verbod op de vraag naar eerder salaris;
wetsvoorstel ingediend 21-5-2026, beoogd 1-1-2027 **(te controleren)**; nog geen recht.
Bron: https://www.rijksoverheid.nl/actueel/nieuws/2026/05/21/meer-openheid-over-loonkloof-tussen-mannen-en-vrouwen.
Bewaren: overige personeelsgegevens 2 jaar (AP-richtlijn); sollicitatiegegevens
"niet langer dan nodig" **(te controleren)**. Bron: https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/werk-en-uitkering/personeelsdossiers.

**Wat dat betekent voor software.**

- Het ledger is van de mens en niet van de werkgever; het werkgeversdeel is een
  bevestiging op een regel die de mens aanlevert.
- Een getuigschrift is een document van de werkgever met een vaste minimale
  inhoud; in het ledger hoort alleen DAT er een is en wie het afgaf, het stuk zelf in RTDocs.
- Geen salaris in het ledger (CAR-05, NOOIT.bedrag); een salarisindicatie hoort
  bij de vacature, niet bij de persoon.
- Delen moet per ontvanger, tijdelijk en intrekbaar.

## d. Functiecatalogus L1-L6

In de kolom Bak staat sinds de herziening **herstel** (fout, rolgrens,
bewaartermijn, wat het scherm belooft maar niet doet) of **verdieping** (nieuwe
diepte binnen de huidige scope), elk met "nu" of "later".

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Feit zetten, intrekken met reden | bestaat, `carriereledger.js` | `carriereLedger` | `toets()` in `regels.js` | herkomst `zelf` zegt dat niemand anders het zag | lid | alleen het lid | - | - | - | bestaat |
| Eén regel delen met code | bestaat, `deel.js` | `carriereDelen` | 30 dagen standaard, maximaal 365; label `voor` per ontvanger | - | ontvanger zonder sessie | lid start en stopt | ingetrokken feit: getoond als ingetrokken | - | - | bestaat |
| Ledger knipt nooit | gerepareerd (73ae8c6): `schrijfRegel` weigert bij 500 in plaats van de oudste te knippen | `carriereLedger` | vol is vol (409) | - | lid bij de weigering | - | - | `test/carriereledger-appendonly.test.js` | klein | herstel: gerepareerd (commit 73ae8c6) |
| Afschrift en scherm zeggen niet meer "kan regels missen" | ontbreekt: `projectie.js` zet `misschienAfgekapt` bij 500 regels, `loopbaan.html` meldt "oudere regels kunnen ontbreken"; sinds 73ae8c6 onwaar | `projectie.js`, `loopbaan.html` | het afschrift zegt bij een vol ledger "vol: er kan niets meer bij, er ontbreekt niets" | - | lid bij afschrift | - | ledgers van vóór 73ae8c6 die wél zijn afgekapt: niet te onderscheiden; dat staat erbij met de datum | een vol ledger van na 19 oktober 2026 meldt geen ontbrekende regels | klein | herstel nu |
| Ruimte in het ledger zichtbaar | ontbreekt | `carriereLedger` | "312 van 500 regels; 40 van anderen; de laatste 50 zijn voor u" | - | lid op het scherm | alleen het lid | - | het lid ziet hoeveel ruimte er is en hoeveel ervan door bevestigingen van anderen is gebruikt, als telling, nooit als score | klein | verdieping nu |
| Werkervaring uit het dienstverband voorstellen | ontbreekt; `loopbaan.html` leest `/api/concern/mijnwerk` alleen als overzicht | employment (Concern, `server/kern/concern/employment.js`): entiteit, rol, soort, van, tot | bij `tot` gezet: voorstel "werkte bij <entiteit> als <rol>, <van>-<tot>", kapitaal `netwerk`; het lid zet het zelf (herkomst `zelf`); geen bedrag | rolnaam zoals de werkgever die invulde | lid bij einde dienstverband, één keer | lid kiest; niets komt vanzelf in het ledger | lopend dienstverband: alleen "sinds"; twee rollen bij dezelfde entiteit: twee voorstellen | wie uit dienst gaat, ziet één voorstel en zet het met één tik; zonder tik staat er niets; een tweede keer openen toont geen tweede voorstel als het feit al staat | klein | verdieping nu |
| Deelspoor per code | ontbreekt: `toon` in `deel.js` telt niets | `carriereDelen` | per code: aantal keer geopend en de datum van de laatste opening; geen IP, geen toestel, geen identiteit van de lezer | een opening is geen lezing door een mens | lid in "wat ik deelde" | alleen het lid | gestopte code: teller blijft zichtbaar | het lid ziet "Code voor sponsor B: 3 keer geopend, laatst op 12-10", en de ontvanger wordt niet gevolgd | klein | verdieping nu |
| Bundel delen (meerdere regels, één code) | ontbreekt | `carriereDelen` | dezelfde code-regels; de ontvanger ziet alleen de gekozen regels, niet hoeveel er nog zijn | - | ontvanger | lid | een ingetrokken feit in een bundel: getoond als ingetrokken | een sollicitant deelt drie feiten met één code; de werkgever ziet niet dat er twintig zijn | middel | verdieping later |
| Afschrift als document | half: `/afschrift` bestaat, geen bestand in RTDocs | ledger | inclusief intrekkingen; niet ondertekend (staat erin) | - | lid | lid | - | het lid bewaart zijn afschrift in RTDocs | klein | verdieping later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Kantoor noteert "gezien" | bestaat, `office/carriereledger.js` | stuk | herkomst `gezien`: een mens van RTG zag een stuk, niet: het stuk is echt | - | lid | kluisAuth, op naam | - | - | - | bestaat |
| Vakbewijs als feit | ontbreekt als koppeling | `kern/vakbewijs.js` (`afgetekend`, verval) | het lid kiest een afgetekend vakbewijs; er komt een feit "<soort> afgetekend door RTG op <datum>" met herkomst `gezien`; het nummer blijft in de kluis | stuk verloopt; het feit zegt "afgetekend op", nooit "geldig" | lid | lid kiest; kantoor tekende al af | verlopen stuk: feit blijft met de datum; niet-afgetekend stuk: geen feit | een kok zet "VSH afgetekend door RTG op 3-9" zonder registernummer, en de deelpagina toont geen nummer | klein | verdieping nu |
| Getuigschrift-aanvraag | ontbreekt | dienstverband, RTDocs | het lid vraagt bij einde dienstverband; de werkgever levert een document; in het ledger komt "getuigschrift afgegeven door X op datum", herkomst `bevestigd` | minimale inhoud en termijn te controleren (art. 7:656 BW); nooit als harde eis | werkgever bij aanvraag; lid bij aflevering | lid vraagt, manager levert | beoordeling alleen op verzoek van het lid (te controleren) | de werkgever ziet de vraag in Team Room; het lid ziet het stuk in RTDocs en het feit in zijn ledger | middel | verdieping later |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Zaak bevestigt een regel | bestaat, `supplier/carriereledger.js` | regel-id + codenaam | manager; de zaaknaam met de medewerker | - | lid | - | - | - | - | bestaat |
| Bevestigen begrensd | gerepareerd (73ae8c6): per feit per partij één actieve, hoogstens drie in totaal; laatste 50 regels voor de eigenaar | `bevestigBezwaar` in `regels.js` | zie a. | - | zaak bij weigering (409) | - | - | `test/carriereledger-appendonly.test.js` | klein | herstel: gerepareerd (commit 73ae8c6) |
| Bevestiging alleen met verzoek of dienstverband | ontbreekt: elke manager met codenaam en regel-id kan bevestigen. Na 73ae8c6 kan hij met bevestigen en intrekken over veel feiten (en met meerdere zaken) nog steeds tot 450 van de 500 regels vullen; het lid houdt dan 50 | verzoeklijst (zie hieronder), employment (Concern) | een bevestiging mag als (a) er een open verzoek van het lid aan deze zaak voor dit feit is, of (b) er een dienstverband bij die zaak bestaat of bestond | de koppeling zaak -> Concern-entiteit is niet voor elke zaak gelegd: dan alleen (a) | lid bij elke bevestiging | het lid vraagt; de manager bevestigt | kantoor `gezien` buiten deze regel | een zaak zonder verzoek en zonder dienstverband krijgt 403; met verzoek komt de bevestiging één keer door en sluit het verzoek | klein | herstel nu (rolgrens) |
| Bevestigingsverzoek | ontbreekt | nieuwe kleine lijst `carriereVerzoeken` naast `carriereDelen` (geen nieuwe laag): feit-id, zaakcode, aangemaakt, vervalt, uitkomst | verzoek vervalt na 30 dagen; per feit per zaak één open verzoek; de zaak ziet alleen de tekst van dat ene feit | - | manager in de werkbak van Team Room; lid bij bevestigen, weigeren of verval | lid maakt en trekt in; manager bevestigt of weigert met reden | zaak bestaat niet meer: verzoek vervalt met die reden | het lid vraagt Meridiaan om "receptie 2026" te bevestigen; de manager ziet alleen dat feit; na bevestigen staat het verzoek op "afgehandeld" | klein | verdieping nu |
| Publieke bevestiging zonder persoonsnaam | ontbreekt: `namens` zet de zaaknaam met de naam van de medewerker in `door`, en die reist mee met elke deelcode | `supplier/carriereledger.js` | op de deelpagina: zaaknaam plus rol; voor het lid ook de naam | - | ontvanger van een deelcode | - | - | een sponsor ziet "Meridiaan Toren (manager)" en geen persoonsnaam | klein | herstel nu, na besluit 2 |
| Werving leest gedeelde regels | ontbreekt | sollicitatie (`routes/werving.js`), deelcode | het lid voegt een code toe aan zijn sollicitatie; alleen de manager ziet hem (personeelzicht) | - | manager | lid kiest | code verloopt: sollicitatie toont "verlopen", niet leeg | de manager opent bij een sollicitatie de drie gedeelde feiten met hun herkomst | klein | verdieping later (eigenaar werk.vacatures) |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Wat ontbreekt aan bewijs bij een feit | ontbreekt | ledger, `HERKOMST` in `regels.js` | per feit: herkomst `zelf` zonder bevestiging of `gezien` wordt benoemd, met wie het zou kunnen bevestigen (een oud-werkgever uit Concern, het kantoor voor een stuk); alleen voor het lid | geen | lid | lid | - | "dit diploma staat er op uw eigen woord; het kantoor kan een stuk inzien" | klein | verdieping nu |
| Score, ranglijst, Career Independence Score | - | - | - | - | - | - | - | - | - | niet doen: CARRIERE.md par. 4.1, CAR-05 |
| Matching op vacatures | ontbreekt | vacatures, ledger | alleen op verzoek van het lid, lokaal-eerst, uitkomst als voorstel met klasse `advies` en de redenen | voorspelling is geen feit | lid | lid start | geen ledger-doorzoeking door werkgevers | het lid vraagt "welke vacatures passen bij mijn feiten" en krijgt redenen per vacature | middel | verdieping later (eigenaar werk.vacatures) |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Leerdossier van een jongere | half: School en leerhuis; ledger kent geen leeftijdsgrens | School, leerhuis | leerdossier mag onder de vier voorwaarden; geen vergelijking, geen niveaulabel | - | jongere | jongere en wie een rechtmatige verhouding heeft | competitieve feiten (ranglijst) pas bij `volwassen()` | een 15-jarige kan "diploma zwemmen" zetten; een toernooipositie niet | klein | verdieping later, besluit |
| Ledger na overlijden of opzegging | niet gevonden | ledger, nalatenschap | - | - | - | - | - | - | middel | later, besluit |
| Bewaartermijn | niet gevonden in `server/bewaarbeleid.js` | ledger, `carriereDelen` | zolang het account bestaat; bij opzegging export en wissen; gestopte en verlopen deelcodes (alleen hash) na een termijn opruimen | - | lid | lid | - | bij opzegging krijgt het lid zijn afschrift mee | klein | herstel later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werkoverzicht uit Concern | bestaat, `/api/concern/mijnwerk` | employment | alleen eigen sessie | - | lid | - | - | - | - | bestaat |
| Ledgerfeit naar cv | ontbreekt | ledger, `werk.cvmaker` | het cv toont een feit met zijn herkomst-label | - | lid | lid kiest | - | in het cv staat "bevestigd door X" naast een functie | klein | verdieping later (eigenaar werk.cvmaker) |
| Examen of leerbewijs naar ledger | ontbreekt | School, leerhuis | alleen een echt diploma, nooit een oefenindicatie | - | lid | lid | onder 18: leerdossier, geen ranking | - | klein | verdieping later |

**Modus LOS.** De kerntaak zonder andere apps: zelf feiten zetten, intrekken met
reden, één regel delen en het delen stoppen. De publieke pagina werkt zonder
account. Wat ontbreekt, zegt het scherm in één zin, in de "u"-vorm die
`loopbaan.html` al gebruikt.

*Eigen (de app bezit het en kan het altijd).* Het ledger, de drie herkomsten,
de zeven voorraden, het afschrift, deelcodes en hun stop.
- Ledger vol (staat er al, 409): "Dit ledger is vol (500 regels). Er verdwijnt nooit een regel, dus er kan niets meer bij."
- Verlopen of gestopte code op de publieke pagina (deels al: "Deze code doet niets meer."): "Deze code doet niets meer. Vraag de persoon die hem gaf om een nieuwe."
- Nog geen feiten: "Uw ledger is leeg. Een feit zet u zelf; een ander kan het daarna bevestigen."

*Noodzakelijke platformdiensten.* Account en sessie (`auth`), opslag
(`carriereLedger`, `carriereDelen`), `server/kern/bearercode.js` voor de code,
de kluis (`kluisAuth`) voor de herkomst `gezien`.
- Geen sessie: "Meld u aan om uw loopbaan te zien; een gedeelde regel kan iedereen openen met de code."
- Opslag niet beschikbaar: "Er kan nu niets worden vastgelegd. Uw ledger is niet veranderd."
- Kantoor zonder naam (staat er al, 403): "Een bevestiging gaat op naam. Zonder naam is later niet te zien wie dit heeft bevestigd."

*Optionele koppelingen.* Concern (dienstverband, werkoverzicht), Team Room
(verzoek aan de zaak), Werving, cv-maker, RTDocs, `kern/vakbewijs.js`.
- Concern uit: "Uw werkgevers zijn nu niet te tonen; uw ledger staat los daarvan en is volledig."
- Team Room uit (na verdieping): "Uw verzoek om bevestiging kan nu niet bij de zaak worden bezorgd. Het feit staat er al; vraag het later opnieuw."
- RTDocs uit: "Het afschrift kan nu niet in RTDocs worden bewaard; u kunt het wel als bestand downloaden."

**Modus SAMEN.** Keten "kok vertrekt en solliciteert".

1. De kok werkt bij zaak MERIDIAAN; Concern kent het dienstverband (entiteit,
   rol, van).
2. Bij vertrek (`tot` gezet) stelt Loopbaan voor: "werkte bij Meridiaan Toren
   als kok, 2025-2026". Hij zet het (herkomst `zelf`). *Storing: Concern niet
   bereikbaar.* Zichtbaar: "voorstel nu niet te maken; u kunt het feit zelf
   schrijven". Bewaard: niets automatisch.
3. Hij stuurt Meridiaan een bevestigingsverzoek voor dat ene feit (verdieping).
   De manager bevestigt vanaf het zaakaccount. *Storing: dubbele tik.* Bewaard:
   één bevestiging (409 op de tweede, sinds 73ae8c6 ook bij een andere tekst).
   *Storing: een andere zaak bevestigt ongevraagd.* Vandaag: dat lukt nog
   (herstel nu); na herstel 403.
4. Het kantoor noteert `gezien` op zijn VSH-stuk. *Storing: kantoor zonder naam.*
   403: een bevestiging gaat op naam.
5. Hij deelt het werkfeit 14 dagen met een nieuwe werkgever (`voor`: "Brasserie
   Noord"); die opent de publieke pagina zonder account. *Storing: code verlopen.*
   Zichtbaar: "Deze code doet niets meer."; bewaard: het feit en het spoor van
   het delen. Na verdieping ziet de kok "1 keer geopend".
6. Hij stopt het delen. *Storing: crash direct na stoppen.* Na herstart blijft
   de code dicht (voltooiproef herstelbaar).
7. Zijn loonstroken van Meridiaan blijven in `loon.strook` (sinds 1575572); geen
   bedrag komt in het ledger.

**SAMEN als contractblok (voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd).**

```js
samen: {
  functie: 'link:loopbaan', familie: 'WorkOS',
  belofte: 'een lid schrijft feiten in een ledger dat niets wist en dat geen ander kan volschrijven, laat ze bevestigen door wie hij vroeg of waar hij werkte, trekt er een terug met reden, en deelt een feit met een code die hij weer stopzet',
  ingang: '/apps/loopbaan.html',
  bestanden: ['public/apps/loopbaan.html', 'public/apps/loopbaanbewijs.html'],
  scenario: 'scripts/lib/voltooi/loopbaan.js',
  ketens: [
    { naam: 'dienstverband naar werkfeit', uitgeeft: 'feit met herkomst zelf', ontvangt: 'voorstel uit het beëindigde dienstverband',
      vorm: 'projectie', eigenaar: 'werk.concern', toestemming: 'het lid zet; niets komt vanzelf in het ledger',
      storingen: ['Concern uit', 'dienstverband zonder einddatum', 'feit staat er al'], proef: 'niet gebouwd (CARRIERE.md par. 7)' },
    { naam: 'bevestiging door de zaak', uitgeeft: 'verzoek voor een feit', ontvangt: 'bevestiging met herkomst bevestigd',
      vorm: 'gebeurtenis', eigenaar: 'loopbaan.ledger', toestemming: 'alleen na verzoek of bij een (oud) dienstverband; alleen een manager',
      storingen: ['zaak zonder verzoek', 'dubbele tik', 'vierde bevestiging', 'ledger bijna vol'], proef: 'test/carriereledger-appendonly.test.js (toets, geen ketenproef)' },
    { naam: 'één feit tonen aan een vreemde', uitgeeft: 'deelcode', ontvangt: 'niets',
      vorm: 'verwijzing', eigenaar: 'loopbaan.bewijs', toestemming: 'lid start en stopt; verloopt vanzelf',
      storingen: ['code verlopen', 'code gestopt', 'feit ingetrokken', 'crash na stoppen'], proef: 'scripts/lib/voltooi/loopbaan.js' },
    { naam: 'vakbewijs als feit', uitgeeft: 'feit met herkomst gezien, zonder nummer', ontvangt: 'afgetekend vakbewijs',
      vorm: 'verwijzing', eigenaar: 'loopbaan.ledger' /* het vakbewijs zelf: /api/vakbewijs vanuit apps/app.html (app-main-60.js) */, toestemming: 'het lid kiest; het nummer blijft in de kluis',
      storingen: ['stuk niet afgetekend', 'stuk verlopen'], proef: 'niet gebouwd' }
  ]
}
```

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Werkfeit uit een echt dienstverband, door het lid gekozen, door de werkgever bevestigd | Loopbaan | `loopbaan.ledger` + Concern employment | een profielsite kent het dienstverband niet; een HR-pakket is van de werkgever |
| "Gezien door RTG" naast "bevestigd door de bond", nooit samengevoegd | Loopbaan | herkomst `gezien` / `bevestigd` | vereist een kantoor met kluis en een zaakaccount in hetzelfde huis |
| Eén feit tonen aan een vreemde zonder account, zonder de rest | Loopbaan | `loopbaan.bewijs`, `bearercode.js` | profielen delen alles of niets |
| Vakbewijs zonder nummer delen | Loopbaan + kluis | `vakbewijs.js`, `member_state` | het nummer verlaat de kluis niet |
| Bevestiging alleen van wie het lid vroeg of waar hij aantoonbaar werkte | Loopbaan | `loopbaan.ledger` + Concern employment | een profielsite kan niet zien of een "aanbeveler" er ooit werkte; hier staat het dienstverband in hetzelfde huis |
| Het lid ziet hoe vaak zijn gedeelde feit is geopend, zonder dat de lezer gevolgd wordt | Loopbaan | `loopbaan.bewijs` | markt-apps verkopen juist het omgekeerde: wie keek naar mij, met naam (LinkedIn Premium) |

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
| lid | zaak | bevestigingsverzoek (gebeurtenis), kleine lijst `carriereVerzoeken` naast `carriereDelen` | lid; zonder verzoek of dienstverband geen bevestiging |
| `toon` in `deel.js` | `carriereDelen` | teller per code (aantal, laatste datum) | alleen het lid leest |
| `projectie.js` (`misschienAfgekapt`) | `loopbaan.html` | herstel van een onware melding | - |
| vakbewijs (afgetekend) | ledger | verwijzing zonder nummer | lid |
| deelcode | sollicitatie | verwijzing | lid; alleen manager leest |
| ledger | `werk.cvmaker` | projectie | lid |

## g. Prioritering

De bak "aanbevolen nu" is gesplitst in **herstel** en **verdieping**.

**Herstel**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Ledger knipt nooit; bevestigen per partij per feit begrensd | klein | laag | `index.js`, `regels.js` | gerepareerd (commit 73ae8c6) |
| Bevestiging alleen met verzoek of (oud) dienstverband | klein | laag | verzoeklijst, Concern employment | herstel nu (rolgrens; derden vullen nu nog tot 450 regels) |
| Afschrift en scherm melden geen "ontbrekende regels" meer na 73ae8c6; kop van `regels.js` bijwerken | klein | laag | `projectie.js`, `loopbaan.html` | herstel nu |
| BEVOEGD-ronde op de drie deuren (lid, zaak, kantoor) | klein | laag | BEVOEGD | herstel nu (bewijs 6 staat op NIET_GETEST) |
| Publieke bevestiging zonder persoonsnaam | klein | laag | `supplier/carriereledger.js`, besluit 2 | herstel nu, na besluit 2 |
| Ledger en verlopen deelcodes in de bewaartabel | klein | laag | `bewaarbeleid.js` | herstel later |

**Verdieping**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Bevestigingsverzoek (lid vraagt één zaak om één feit) | klein | laag | `carriereVerzoeken`, werkbak Team Room | verdieping nu |
| Werkervaring als voorstel bij einde dienstverband | klein | laag | `/api/concern/mijnwerk`, `employment.js` | verdieping nu |
| Vakbewijs als feit zonder nummer | klein | laag | `kern/vakbewijs.js` | verdieping nu |
| Deelspoor per code (aantal, laatste datum) | klein | laag | `deel.js` | verdieping nu |
| Ruimte in het ledger zichtbaar | klein | laag | `carriereLedger` | verdieping nu |
| Wat ontbreekt aan bewijs bij een feit | klein | laag | `HERKOMST` | verdieping nu |
| Ketenproef dienstverband -> feit -> verzoek -> bevestiging -> delen | klein | laag | voltooiwereld | verdieping nu |
| Bundel delen, afschrift in RTDocs | klein tot middel | middel | RTDocs | later |
| Getuigschrift-aanvraag | middel | middel | Team Room, RTDocs, wettekst nalezen | later |
| Werving leest gedeelde regels, matching op verzoek | middel | middel | `werk.vacatures` | later |
| Verifiable Credentials | groot | hoog | standaard nalezen (par. 3) | later, besluit |
| Score, ranglijst, profielbezoekers met naam | - | - | - | niet doen: CAR-05, LIFE.md |
| Getuigschriftinhoud (art. 7:656, te controleren) als harde eis | - | - | - | niet doen: workos.md par. 11 |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | werk, opleiding, vak, publiek, eigendom: alle zeven voorraden bruikbaar, plus vakbewijs als feit | e2e met een feit per kapitaal | toets per kapitaal niet gevonden |
| Professionele diepte | werkgever, kantoor en bond bevestigen elk met hun eigen betekenis | `test/carriereledger.e2e.test.js` | bestaat |
| Levenscyclus | een feit overleeft vertrek, intrekking en elke poging van anderen om het ledger te vullen | `test/carriereledger-appendonly.test.js`, plus een toets waarin een zaak zonder verzoek bevestigt | knippen en onbeperkt bevestigen gerepareerd (73ae8c6); ongevraagd bevestigen nog open |
| Samenwerking en rollen | geen bevestiging zonder verzoek of dienstverband; geen persoonsnaam in het publieke deel | BEVOEGD-ronde, toets op de deelpagina | ontbreekt |
| Domeinintelligentie | nergens een cijfer op een mens | `test/cijferopmens.test.js` | bestaat (lexicale ondergrens) |
| Los functioneren | zonder Concern, Team Room en RTDocs werkt het ledger volledig, en elke ontbrekende koppeling geeft de zin uit Modus LOS | voltooiproef met Concern uit | niet gemeten |
| RTG-ketens | dienstverband tot gedeeld, bevestigd feit | ketenproef (CARRIERE.md par. 7) | niet gedraaid |
| Bewezen betrouwbaarheid | acht bewijzen centraal | APPWERKT.json | 7 BEWEZEN, bevoegd NIET_GETEST |

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**Herstel**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Ledger knipt nooit; bevestigen begrensd | gerepareerd (commit 73ae8c6) | `server/kern/carriereledger/index.js`, `regels.js` |
| Bevestiging alleen met verzoek of dienstverband | klein | `server/routes/supplier/carriereledger.js`, `server/kern/concern/employment.js` |
| Geen onware melding "oudere regels kunnen ontbreken" | klein | `server/kern/carriereledger/projectie.js`, `public/apps/loopbaan.html` |
| BEVOEGD-ronde | klein | `scripts/lib/voltooi/loopbaan.js`, BEVOEGD |
| Publieke bevestiging zonder persoonsnaam (na besluit 2) | klein | `server/routes/supplier/carriereledger.js` |

**Verdieping**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Bevestigingsverzoek | klein | `carriereDelen`-vorm, werkbak Team Room |
| Werkervaring als voorstel | klein | `/api/concern/mijnwerk` |
| Vakbewijs als feit | klein | `server/kern/vakbewijs.js` |
| Deelspoor en ruimte in het ledger | klein | `server/kern/carriereledger/deel.js`, `projectie.js` |
| Wat ontbreekt aan bewijs | klein | `HERKOMST` in `regels.js` |
| Ketenproef | klein | `scripts/lib/voltooi/loopbaan.js` |
| Later: bundel delen, afschrift in RTDocs, getuigschrift-aanvraag, werving met deelcode | klein tot middel | `deel.js`, `routes/werving.js`, RTDocs |

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

1. **Wanneer mag een zaak een regel bevestigen?** Sinds 73ae8c6 is het aantal
   begrensd, maar nog niet wie het mag.
   - **A (aanbevolen): na een verzoek van het lid aan die zaak, of bij een (oud) dienstverband bij die entiteit.** Kost: klein.
   - B: alleen na een verzoek. Kost: klein; ook een oud-werkgever moet dan eerst gevraagd worden.
   - C: zo laten. Kost: nul; een zaak kan ongevraagd bevestigen en met bevestigen en intrekken tot 450 van de 500 regels vullen.
2. **De naam van de manager in een publiek getoonde bevestiging.**
   - **A (aanbevolen): zaaknaam plus rol ("manager"), de persoonsnaam alleen voor het lid.** Kost: klein; houdt namen uit het publieke deel.
   - B: zo laten (zaaknaam met de naam van de medewerker). Kost: nul; een echte naam reist mee met elke deelcode.
3. **Getuigschrift.**
   - **A (aanbevolen): later, eerst de wettekst van art. 7:656 BW nalezen; het stuk in RTDocs, het feit in het ledger.** Kost: middel.
   - B: niet doen; het blijft een document buiten RTG. Kost: nul.
4. **Waar ziet de manager een bevestigingsverzoek?**
   - **A (aanbevolen): in de werkbak van Team Room (`zaak.teamroom`), de lijst blijft van Loopbaan.** Kost: klein; één plek voor werk van de manager.
   - B: in de horeca- of zaakapp zelf. Kost: klein per genre; meerdere plekken voor hetzelfde verzoek.
