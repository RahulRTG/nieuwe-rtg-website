# Magnaat (link:magnaat)

**Volledige werkzaamheid:** Magnaat doet volledig waarvoor het er is als een lid
in één sessie de drie dossiers van zijn dagdienst afmaakt door telkens eerst het
juiste RTG-scherm te openen en dan de keuzes te beantwoorden, in de
Oefenkantoor-economie een besluit neemt en na de volgende spel-dag ziet wat dat
besluit deed en waarom; een lid van 18+ met gezien identiteitsbewijs houdt daar
opbouw van over, een lid onder 18 niets, en in die hele sessie is geen enkel
productie-endpoint aangeroepen. Toets: `scripts/lib/voltooi/magnaat.js` plus
`test/magnaatwereld.test.js` toets 4 plus `test/magnaat-rtgketen.test.js` toets 7.

Eigenaar: `spel.magnaat` → `apps/magnaat.html` (SCHERMEIGENAAR.json, doelgroep
lid; doel: "een lid leert ondernemen door in een spel-simulatie een eigen
bedrijf te runnen en keuzes te maken"). Ingang: de app Magnaat. Doelgroep: het
lid als speler. Twee buurschermen hebben een **eigen eigenaar**:
`kantoor.controleregister` → `apps/magnaat-kantoor.html` (kantoor) en
`handel.digitaletweeling` → `apps/magnaat-partnerstudio.html` (zaak).
Diepte-documenten: `GAMEHALL.md` par. 12 (Magnaat als product) en
`MAGNAATLAB.md` (Magnaat als testhal).

**Correctie op de vorige versie van deze kaart (19 oktober 2026, avond).** Er
draaien twee economieën onder de naam Magnaat, en ze hebben niet dezelfde
eigenaar:
- de **Oefenkantoor-economie** (`server/kern/magnaat-oefeneconomie.js` op
  `server/kern/magnaat-economische-motor/`, met het economenlab
  `server/kern/magnaat-economenlab*.js`) zit in `apps/magnaat.html` achter
  `/api/member/magnaat/economie/*`. Die is van `spel.magnaat`;
- **Magnaat World** (bordspel, economie met kavels en vestigingen, bank,
  verzekering, veiling; `server/kern/spellen/magnaat/`) wordt gespeeld in
  `apps/spelen.html` (r. 305 en 1476: "Magnaat als economie"). Dat scherm is van
  `spelen.bordspel`.

De vorige versie rekende World tot deze app. Functies die op World bouwen, staan
hieronder bij de andere eigenaar (zie A, "naar een andere eigenaar", en Vraagt
besluit 5).

---

## a. Inventaris van het bewezen bestaande

### Wat er staat

| Laag | Wat | Pad |
|---|---|---|
| Schermen | spel, kantoor (controleregister), partnerstudio | `public/apps/magnaat.html` + `magnaat-*.js`; `magnaat-kantoor.html`; `magnaat-partnerstudio.html` |
| Routes (lid) | `/api/member/magnaat/{overzicht, taak/start, taak/antwoord, taak/handeling, taak/actie, kantoor/kies, werkproces/start, economie/beslis, economie/analyse, economie/volgende-dag, economie/schok, controle/*, partner/start, partner/stap, teamkamer/*, leven/*}`; stad: `/api/member/magnaat/stad/{staat, maak, doe, start, actie, verlaat}` | `server/routes/magnaatwereld.js`, `server/routes/magnaatstad.js` |
| Routes (zaak, kantoor) | `/api/supplier/magnaat/studio/*`; `/api/office/magnaat/*` (boardroomAuth) | `server/routes/magnaatwereld.js` |
| Kern (deze app) | spelbrug, capability-scanner, dekkingsmatrix, partnerstudio, trainingslobby (teamkamer), kantoorregels, werkroutefabriek | `server/kern/magnaatwereld.js`, `server/kern/magnaat-*.js` |
| Oefenkantoor-economie | twee bedrijven (RTG en Praktijkbedrijf), dagcyclus met vaste schokken (dag 3, 6, 9 van een cyclus van 12), besluiten via een transactie op een kopie, historie van 180 dagen, Rust-rekenmotor met terugval op JS | `server/kern/magnaat-oefeneconomie.js`, `server/kern/magnaat-economische-motor/` (`besluiten.js`, `dag.js`, `schokken.js`, `markt.js`, `staat.js`) |
| Economenlab | resultatenrekening, balans, kasstroom, kengetallen, diagnose van de bindende beperking, prijs-volumebrug, analyses met voorspelling en realisatie (max. 60 per lid) | `server/kern/magnaat-economenlab.js`, `-rapport.js`, `-training.js`, `-basis.js` |
| Grootboek | dubbel geboekt, één boekhoudwaarheid voor beide economieën | `server/kern/magnaat-grootboek/` |
| Testhal-rail | synthetische bank als vierde provider; geldpompvraag aan RTG Pay | `server/betaal/synthetisch.js`, `server/kern/spellen/magnaat/rtg-keten.js`, `test/simulatiebank.test.js`, `test/magnaat-rtgketen.test.js` |
| Meting | testhalbereik | `scripts/magnaatlab.js`, `MAGNAATLAB.json`, `test/magnaatlab.test.js` |
| World (andere eigenaar) | bordspel, economie, bank, convenanten, verzekering, risico's, veiling | `server/kern/spellen/magnaat/`, gespeeld in `public/apps/spelen.html` |

Regels in code:
- **Een spelopdracht roept nooit een productie-endpoint aan** (kop van
  `kern/magnaatwereld.js`); elke functie wordt een trainingskopie met
  synthetische data. Een speelbeurt laadt `kern/pay` niet (toets 7 in
  `test/magnaat-rtgketen.test.js`).
- **18+-grens**: `magOpbouwen = progressieMag`; xp, niveau, reputatie en sinds
  9f2a7ab ook virtueel budget en het aantal voltooide diensten alleen voor wie
  `volwassen()` haalt; zonder bedrading faalt hij dicht. Melding `GEEN_OPBOUW`:
  "Xp, niveau, reputatie en virtueel budget bouw je pas op als RTG je
  identiteitsbewijs heeft gezien en je 18 of ouder bent; het dossier zelf telt
  gewoon."
- Een besluit in de Oefenkantoor-economie verandert niets direct: "De volgende
  dagcyclus rekent eerst alle markt-, arbeids- en kasgevolgen door"
  (`besluiten.js`). De volgende dag vraagt een `commandoId`; dezelfde sleutel
  geeft `herhaald: true`.
- De Future Engine stelt voor; alleen een mens zet een voorstel naar test of
  pilot; een pilot blijft sandbox.
- De AI verzint geen getal: de engine rekent, de AI legt uit (GAMEHALL par.
  12.1). Geen betaald voordeel, geen straf voor wegblijven (par. 12.6).

### Wat bewezen is

- **APPWERKT.json** (19 oktober 2026): bereikbaar B, bedienbaar NT, menselijk NT,
  voltooibaar GEEN_FIXTURE, waarheidsgetrouw NT, persistent GEEN_FIXTURE, bevoegd
  NT, herstelbaar GEEN_FIXTURE.
- **Voltooiproef op deze tak**: lokaal gesloten 4/4 (19-10, dc501544), centraal
  nog te stempelen. Voltooibaar 6/6: de speler opent Magnaat (xp 0, budget
  250000, 3 open dossiers), moet eerst het juiste RTG-scherm openen, een tweede
  speler ziet zijn dossiers niet, zonder sessie opent niemand iets. Persistent:
  na herstart "xp 300, voltooid 1, lopend 1". Herstelbaar: dubbele tik op
  "Start dossier" opent één opdracht. De grens van het scenario zegt zelf: "de
  teamkamer, de economie, de controlekamer, de partnertraining en Oudwijk zijn
  niet beproefd".
- **18+-grens op het budget**: `test/magnaatwereld.test.js` toets 4 (commit
  9f2a7ab).
- **BEVOEGD.json** (05:08, 55ed79f9): 90 routes, waarvan 20 open.
- **IDOR.json** (huisbreed): 1999 routes, 0 doorbraken.
- **Testhal**: `MAGNAATLAB.json` (na 9f2a7ab): 70 simulatiemodules, 7
  kernmodules geraakt in 6 van 727 kerndomeinen (1%), 0 modules praten naar
  buiten, 3 aanroepen tussen de werelden, 17 gedeelde onderwerpen, 43
  kandidaatparen, **0 paren met een gedeelde vorm**. MAGNAATLAB.md par. 2 noemt
  nog "2 van 415"; de JSON is de verste stempel.
- Geldpompproef via RTG Pay: vijf perverse volgordes, exact nul verschil;
  twintig tikken geven veertig grootboekregels (MAGNAATLAB.md par. 5.1).

### Wat de code of het document zelf "niet gebouwd" noemt

- MAGNAATLAB fase 3 (twee synthetische werelden wegen), 5 (poort in `npm run
  check`) en 6 (opschalen) staan open; er is **geen impactgraaf** (par. 5.2).
  De meting voor fase 3 staat al in de JSON (0 van 43 paren delen een vorm);
  het besluit nog niet.
- De pijp loopt "de verkeerde kant op": RTG-routes worden spelonderwerp, een
  partij raakt geen route werkelijk aan (par. 2).
- `KANTOORWERKPROCESSEN` in `magnaatwereld.js` heeft **één** volledig
  werkproces (`service-reiswijziging`); de rest komt uit de automatische graaf.
- Er is **geen verbinding met Onderneming**: geen module in `kern/magnaat*` of
  `kern/spellen/magnaat/` leest `kern/onderneming/`.

---

## b. Marktvergelijking

Geraadpleegd 19 oktober 2026 via WebSearch op het officiële domein. Elke regel
hieronder is **(te controleren)** en (via zoektool, live te controleren). Merken
alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Capitalism Lab | betaalde DLC: Subsidiary, City Economic Simulation, Digital Age, Banking (te controleren) | bank en financiering: **ja**, maar in World (`spelen.bordspel`); in het Oefenkantoor alleen een lening via `beslis`. Stadseconomie: **half** (World). Dochterondernemingen: **half** (World, aandeel-acties) | https://www.capitalismlab.com/dlc/ |
| Big Ambitions | eenmalige aankoop; geen betaalmuur gevonden (te controleren) | persoonlijk ondernemersverhaal: **half** (`magnaat-leven`) | https://store.steampowered.com/app/1331550/Big_Ambitions/ |
| Duurste enterprisepakket voor bedrijfssimulatie | niet gevonden in de werkbestanden | – | niet gevonden |
| Zakelijk leren (Cornerstone, Docebo, offerte) | vaardighedengraaf, leerpaden (te controleren) | werkprocessen oefenen op echte schermen: **ja**; een vaardighedengraaf **nee** | https://www.cornerstoneondemand.com/platform/portfolio-packages/ , https://www.docebo.com/pricing/ |

Wat de markt niet heeft: een spel dat de werkelijke schermen van het platform
als oefenstof gebruikt zonder ze aan te roepen, met dezelfde privacy- en
bevoegdheidsregels als het echte werk, en een officieel partnerbedrijf als
digitale tweeling na menselijke goedkeuring. Wat een tycoon-game ook niet heeft:
een economenlab dat de voorspelling van de speler naast de gerealiseerde dag
legt.

---

## c. Analyse van het volledige domein

**Particulier.** Iemand wil leren ondernemen zonder geld te verliezen: prijzen
zetten, personeel inplannen, een lening afsluiten, een tegenvaller opvangen.
Behoefte: een veilige oefenruimte en uitleg waarom iets misging.

**Professioneel.** Een (aankomend) ondernemer wil zijn eigen plan oefenen: wat
gebeurt er bij een slechte maand, een loonsverhoging, een tweede vestiging.
Een medewerker wil een werkproces (servicegesprek, controle) oefenen vóór hij het
echt doet. Een opleider wil een groep laten oefenen (teamkamer). Een
controller of econoom wil leren een bindende beperking te herkennen en zijn
verwachting te toetsen; dat is wat het economenlab nu al vraagt (hypothese →
indicatoren → besluit → voorspelling → realisatie → forecastfout).

**Organisatie.** Een zaak wil nieuwe medewerkers inwerken op haar eigen bedrijf
(partnerstudio, `handel.digitaletweeling`). RTG wil capabilities bewijzen
voordat ze productie halen (testhal, MAGNAATLAB).

**Wet en norm.** Magnaat voert niets uit en is dus nergens wettelijk
aansprakelijk; maar wat het **leert**, moet kloppen met de wet. Uit
`domein-max.txt`, alle regels uit een zoeksamenvatting en dus **(te
controleren)**; geen ervan wordt in deze kaart een harde weigerregel:
- Minimumloon 21+ per 1-7-2026 €14,99 bruto per uur (te controleren)
  (https://www.rijksoverheid.nl/onderwerpen/minimumloon/bedragen-minimumloon/bedragen-minimumloon-2026).
- Oproepkrachten: oproep minstens 4 dagen vooraf (te controleren)
  (https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/welke-contracten-zijn-er-voor-oproepkrachten).
- Arbeidstijdenwet: 12 uur per dienst, 11 uur rust (te controleren)
  (https://www.rijksoverheid.nl/vraag-en-antwoord/werktijden/wettelijke-regels-werktijden-en-rusttijden).
- KVK-inschrijving van 1 week vóór tot 1 week na de start (te controleren)
  (https://www.kvk.nl/starten/op-welke-datum-moet-ik-mijn-bedrijf-inschrijven-bij-kvk/).
- Btw-aangifte uiterlijk de laatste dag van de maand na het tijdvak (te
  controleren)
  (https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/btw-aangifte-waar-moet-u-aan-denken/btw-aangifte-waar-moet-u-aan-denken).
- Betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken (te
  controleren)
  (https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/).

**Wat dat betekent voor software.** Een regel uit de echte wereld in het spel is
**speldata met een bron en een datum**, niet een kopie van de fiscale of
arbeidskern. Zolang een regel (te controleren) is, mag het spel hem hooguit als
signaal tonen ("in het echt geldt mogelijk ..., te controleren"), nooit als
weigering. De spelwaarden zelf heten zichtbaar "spelindex", zoals de wereld nu
al doet. Een speluitkomst is nooit een advies over een echt bedrijf.

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Dagdienst met drie dossiers | bestaat, `magnaatwereld.js` | catalogus, wereldgebeurtenis | dossier af = juist scherm geopend + keuzes; bonus bij volle dienst | geen | speler | eigen | – | een tweede speler ziet de dossiers niet | – | bestaat |
| Blijvende stand alleen 18+ | bestaat sinds 9f2a7ab: xp, reputatie, `virtueelBudget` en `dienstenVoltooid` via `bouwOp` → `progressieMag` | spelersstaat | alles wat tussen sessies als stand blijft, hangt aan `progressieMag` | geen | speler | – | het dossier zelf telt gewoon | een speler onder 18 houdt na een herstart geen opgebouwd budget of teller over | – | HERSTEL: gerepareerd (commit 9f2a7ab) |
| Uitleg na een fout | half: `uitleg` per stap | scenariostap | engine rekent, AI legt uit; nooit een verzonnen getal | geen | speler | – | – | elke foute keuze krijgt de reden in één zin | – | bestaat |
| Kalibratiespiegel (eigen voorspellingen naast de uitkomst) | ontbreekt; de gegevens staan er (`economen.analyses[lid]`, max. 60) | zie VERDIEPING V1 | zie V1 | geen: rekent op wat er gebeurd is | speler, op verzoek | alleen eigen analyses | minder dan 5 afgeronde analyses: "nog te weinig" | zie V1 | klein | VERDIEPING, aanbevolen nu |
| "Sinds je weg was" | bestaat volgens GAMEHALL par. 12.4 (World) | twee gerekende standen | verschil, geen logboek | geen | speler bij terugkomst | – | – | – | – | bestaat, andere eigenaar (`spelen.bordspel`) |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werkproces oefenen op echte schermen | bestaat, `KANTOORWERKPROCESSEN` (1 volledig: reiswijziging) | functiecatalogus | stappen `software` + `formulier`; alles synthetisch | geen | speler | eigen | rode functies (geld, identiteit) alleen oefenen | – | – | bestaat |
| Tweede volledig werkproces per afdeling | half: `magnaat-werkroutefabriek.js` maakt automatische routes, 1 handgeschreven | zie VERDIEPING V4 | zie V4 | middel: automatisch gegenereerde stappen kunnen onzin zijn | – | kantoor keurt (`kantoor.controleregister`) | – | zie V4 | middel | VERDIEPING, later |
| Proefdag ("wat doet dit besluit") | ontbreekt | zie VERDIEPING V2 | zie V2 | middel: geldt alleen als niemand anders vóór de volgende dag iets wijzigt | speler, vóór bevestigen | eigen | zie V2 | zie V2 | middel | VERDIEPING, aanbevolen nu |
| Winstbrug tussen twee dagen | half: alleen de prijs-volumebrug op de omzet (`prijsVolumeBrug`) | zie VERDIEPING V3 | zie V3 | geen | speler | eigen | eerste dag: "na twee dagen" | zie V3 | klein | VERDIEPING, aanbevolen nu |
| **Eigen onderneming oefenen** | ontbreekt | plan en aannames uit `kern/onderneming/simulatie.js` | Onderneming levert een **kopie van de aannames**, Magnaat speelt dagen met schokken; niets gaat terug als feit | groot: spel is geen voorspelling; label "spel" | ondernemer | ondernemer kiest export | onder 18: speelbaar, niets bewaard | een ondernemer speelt zijn eigen plan door en ziet bij elke uitkomst "spel, geen voorspelling" | middel | later (Vraagt besluit 2) |
| Teamkamer (groep oefent samen) | bestaat, `magnaat-trainingslobby*.js` | kamer, rollen, revisie | code delen en intrekken; rol per deelnemer | geen | deelnemers | maker van de kamer | – | – | – | bestaat (niet apart beproefd) |
| Partnerbedrijf als tweeling | bestaat bij `handel.digitaletweeling` | snapshot na menselijke goedkeuring | geen route stuurt de volledige tweeling naar een browser | geen | speler, zaak | zaak bouwt, RTG keurt | – | – | – | bestaat (andere eigenaar) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Wie stuurt de gedeelde economie | half: één gedeelde Oefenkantoor-economie; elk lid kan `beslis`, `schok` en `volgende-dag` aanroepen (`routes/magnaatwereld.js` r. 30-33, alleen `auth`) | `magnaatWereld`-bak (één voor iedereen) | een besluit, een geforceerde schok of een nieuwe dag van één lid geldt voor iedereen | geen | alle spelers | geen rol of beurt | – | wie de dag doordraait of een schok plant, is aanwijsbaar en mag dat volgens een regel | klein | HERSTEL (rolgrens), Vraagt besluit 6 |
| Inwerken op de eigen zaak | half: partnerstudio + `partner/start` | tweeling van de zaak | de zaak wijst een training toe aan eigen personeel; uitslag gaat alleen naar de medewerker | geen | medewerker | zaak (manager) | geen ranglijst op medewerkers (HORECA-regel) | een nieuwe medewerker oefent het eigen bedrijf; de manager ziet "gedaan" en geen score | middel | later |
| Controleregister en Future Engine | bestaat, `kantoor.controleregister` | spelfrictie (min. 3 dossiers, gemiddelde < 72%) | voorstel, nooit codewijziging | middel | kantoor | boardroom | – | – | – | bestaat (andere eigenaar) |
| Opleidingsgroep (school, bootcamp) | ontbreekt | teamkamer + School | een docent opent een kamer voor een klas; geen uitslag per leerling buiten de kamer | geen | docent | `werk.schoolbeheer` of `leren.school` | onder 18: niets bewaard | een klas speelt een partij en na afloop is er niets per kind opgeslagen | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Diagnose van de bindende beperking | bestaat, `magnaat-economenlab-rapport.js` `diagnose` | kengetallen van het Praktijkbedrijf | vaste volgorde: liquiditeit (< 3 dagen kasbuffer), aanbod, arbeid, capaciteit, prijs, vraag, productiviteit | geen: spelregel | speler | – | – | – | – | bestaat |
| Economie met schokken | bestaat, `magnaat-economische-motor/schokken.js` | vast schema van 12 dagen of een klaargezette schok | deterministisch | geen: spelwaarheid | speler | – | – | dezelfde begintoestand geeft dezelfde uitkomst | – | bestaat |
| Geldpompcontrole | bestaat, `scripts/magnaat-pomp.js`, `magnaat:pomp:rtg` | grootboek | som nul, aantal regels vast | geen | – | – | – | – | – | bestaat |
| Echte regels als speldata met bron | ontbreekt | `domein-max.txt`-bronnen, alle (te controleren) | hooguit een signaal met bron en datum | hoog zolang de bron niet is nagelezen | speler ziet bron | – | – | – | middel | niet doen nu (zie afgewezen kandidaten) |
| Spel naar scenario-engine | ontbreekt | `kern/fiscaal/scenario.js` (`scenario.doorrekening` = advies) | een spelvraag "wat als ik iemand aanneem" mag dezelfde doorrekening tonen, als oefening | middel | speler | – | – | – | middel | later |
| Agent Arena | beschreven, MAGNAATLAB par. 4.3 | – | uitslag is "zou binnen de grenzen zijn gebleven", nooit vrijgave | – | – | – | – | – | groot | niet doen nu: een PASS mag geen bevoegdheid verlenen, en de autonomiegrens is een besluit |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fasen idee → groep als speelbare hoofdstukken | ontbreekt | `kern/onderneming/fase.js` (idee, validatie, oprichting, eersteklant, tractie, werkgever, vestigingen, groep) | spelhoofdstukken volgen dezelfde namen; de fase in het spel zegt niets over de echte onderneming | geen | speler | – | – | wie in het spel "werkgever" wordt, ziet dezelfde stappen als in Onderneming, gemarkeerd als spel | middel | later |
| Economenlab-analyses onder de leerdossierregel | half: tot 60 analyses met een rubricscore (max. 100) per lid, zonder `progressieMag` en zonder toets op de vier voorwaarden | `economen.analyses[lid]` | een analyse over de eigen redenering mag een leerdossier zijn als ze nooit vergelijkt, geen blijvend niveau-label draagt, alleen voor het lid leesbaar is en aan de codenaam hangt | middel: of een score per analyse een "niveau-label" is, is een oordeel | speler | – | – | er is één toets die zakt zodra een analyse met score zichtbaar wordt voor een ander of een niveau draagt | klein | HERSTEL (te beoordelen), Vraagt besluit 7 |
| Living World | 18+ (GAMEHALL par. 12.7) | – | permanent = progressie | – | – | volwassen() | – | – | groot | later, andere eigenaar (`spelen.bordspel`) |

### L6 RTG-samenhang

Magnaat **geeft uit**: spelfrictie aan het controleregister, en (testhal) een
bewijs per capability. Magnaat **ontvangt**: de functiecatalogus en routes
(lezend), partnertweelingen na goedkeuring, `progressieMag`. Magnaat roept nooit
een productie-endpoint aan; de testhalrail gaat via `server/betaal.js`, nooit
via een vlag in `kern/pay/poort.js`.

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Onderneming → Magnaat (aannames als oefenstof) | ontbreekt | snapshot aannames | een richting: van Onderneming naar Magnaat; geen speluitkomst terug | groot | ondernemer | ondernemer | – | niets uit het spel verschijnt in Onderneming als feit | middel | later (besluit 2) |
| Magnaat → Loopbaan | ontbreekt | voltooide werkprocessen | alleen 18+, alleen door het lid gekozen, label "geoefend, niet gedaan" | geen | lid | lid | onder 18 niet | een geoefend proces staat nooit als werkervaring | klein | later (besluit 3) |
| Testhal: één capability per kwartaal via een rail | half: pay staat | `server/betaal/synthetisch.js`-vorm | adapter vervangt de rail, nooit de poort | – | – | – | – | – | middel | later |
| Twee synthetische werelden | meting staat: 0 van 43 paren delen een vorm (`MAGNAATLAB.json`) | `kern/hospitality-universe/` | besluit vóór er een derde komt | – | – | – | – | – | klein | besluit (Vraagt besluit 4) |

### Modus LOS

Magnaat blijft speelbaar met alle andere apps uit; de dagdienst, het
Oefenkantoor en het economenlab draaien op synthetische data. Per groep, met de
letterlijke tekst die de speler ziet als iets ontbreekt. "Bestaat" betekent: de
zin staat zo in de code; "voorstel" betekent: deze kaart stelt hem voor.

**Eigen (Magnaat bezit het en kan het altijd).** Dagdienst en dossiers, de
Oefenkantoor-economie met haar schokken, het economenlab, de teamkamer.
- Geen open dossier meer: "Je dagdienst is af. Morgen staan er nieuwe dossiers
  klaar." (voorstel)
- De Rust-rekenmotor valt weg: de dag wordt in JavaScript gerekend
  (`meldRustFout`, "veilige terugval naar JS"); de speler hoeft niets te zien
  omdat de uitkomst dezelfde is. (bestaat, alleen in het serverlog)

**Noodzakelijke platformdiensten.** Account en sessie (`auth`), opslag
(`eigencollectie`, de bak `magnaatWereld`), identiteit en leeftijd
(`volwassen()` via `progressieMag`), de klok (`lib/klok`).
- Geen sessie: geen spel; elke route vraagt `auth`, en zonder sessie opent niemand iets (voltooiproef). (bestaat)
- Leeftijd of identiteit niet vastgesteld: "Xp, niveau, reputatie en virtueel
  budget bouw je pas op als RTG je identiteitsbewijs heeft gezien en je 18 of
  ouder bent; het dossier zelf telt gewoon." (bestaat, `GEEN_OPBOUW`)
- Opslag niet beschikbaar: "Je keuze is niet bewaard. Probeer het zo opnieuw;
  er wordt niets dubbel geteld." (voorstel; de herhaalsleutel op `volgende-dag`
  en "Start dossier" maakt de tweede zin waar)

**Optionele koppelingen (andere apps).** De RTG-schermen die een dossier opent,
de partnertweeling (`handel.digitaletweeling`), het controleregister
(`kantoor.controleregister`), later Onderneming.
- Het RTG-scherm van een dossier staat uit: "Dit scherm staat uit; de oefening
  gebruikt een stilstaande kopie." (voorstel)
- Geen goedgekeurde tweeling bij een code: "Deze trainingscode hoort bij geen
  goedgekeurd partnerbedrijf." (voorstel)
- Controleregister uit: de speler merkt niets; de frictie wordt alleen niet
  doorgegeven. (geen tekst nodig)

### Modus SAMEN als contractblok (voorstel)

Dit is een VOORSTEL; `scripts/lib/appcontract.js` blijft zoals het is. De
huidige regel daar draagt alleen `belofte` en de voltooiproef.

```js
samen: {
  functie: 'link:magnaat', familie: 'WorkOS',
  belofte: 'een lid pakt een dossier uit zijn dagdienst op, opent het juiste RTG-scherm en beantwoordt de keuzes; in het Oefenkantoor ziet hij na de volgende dag wat zijn besluit deed; wat hij verdient telt een keer, en blijft alleen boven de 18 als stand bestaan',
  ingang: '/apps/magnaat.html',
  bestanden: ['server/kern/magnaatwereld.js', 'server/routes/magnaatwereld.js',
    'server/kern/magnaat-oefeneconomie.js', 'server/kern/magnaat-economische-motor/besluiten.js',
    'server/kern/magnaat-economische-motor/dag.js', 'server/kern/magnaat-economenlab-rapport.js',
    'server/kern/magnaat-economenlab-training.js', 'server/kern/spellen/grens.js'],
  scenario: 'scripts/lib/voltooi/magnaat.js',
  ketens: [
    { naam: 'spelfrictie naar het controleregister', uitgeeft: 'frictie per functie: minstens 3 dossiers, gemiddelde onder 72%', ontvangt: 'een besluit van de boardroom: voorstel naar test of pilot, of niets',
      vorm: 'gebeurtenis', eigenaar: 'kantoor.controleregister', toestemming: 'boardroomAuth; alleen een mens zet een voorstel door; een pilot blijft sandbox',
      storingen: ['controleregister uit: frictie blijft liggen, het spel speelt door', 'dubbele frictiemelding: telt als een patroon, niet twee'],
      proef: 'niet beproefd: de grens in scripts/lib/voltooi/magnaat.js noemt de controlekamer' },
    { naam: 'inwerken op een goedgekeurde tweeling', uitgeeft: 'gedaan of niet gedaan, alleen aan de medewerker zelf', ontvangt: 'snapshot van het partnerbedrijf na menselijke goedkeuring',
      vorm: 'projectie', eigenaar: 'handel.digitaletweeling', toestemming: 'de zaak bouwt, RTG keurt; de medewerker start met een code',
      storingen: ['code ingetrokken midden in een training: training stopt, gemaakte stappen blijven bij de medewerker', 'tweeling bijgewerkt: lopende training houdt de oude revisie'],
      proef: 'niet beproefd: de grens in scripts/lib/voltooi/magnaat.js noemt de partnertraining' },
    { naam: 'opbouw onder de 18+-grens', uitgeeft: 'xp, reputatie, virtueel budget, voltooide diensten', ontvangt: 'progressieMag uit kern/spellen/grens.js, die volwassen() leest',
      vorm: 'verwijzing', eigenaar: 'spel.magnaat', toestemming: 'geen; de grens is een huisregel',
      storingen: ['grens niet bedraad: faalt dicht, niets opgebouwd', 'lid wordt 18 midden in een dienst: opbouw vanaf de eerstvolgende afronding'],
      proef: 'test/magnaatwereld.test.js toets 4' },
    { naam: 'aannames uit Onderneming als oefenstof (na besluit 2)', uitgeeft: 'niets terug', ontvangt: 'een kopie van de aannames met herkomst',
      vorm: 'projectie', eigenaar: 'werk.onderneming', toestemming: 'de ondernemer, per keer',
      storingen: ['aannames onvolledig: Onderneming weigert met de ontbrekende velden, Magnaat start niet met verzonnen waarden'],
      proef: 'ontbreekt' }
  ]
}
```

### Modus SAMEN: een volledige keten

Een aankomend horeca-ondernemer van 24, geverifieerd.

1. Hij opent Magnaat en speelt zijn dagdienst: drie dossiers, telkens eerst het
   juiste RTG-scherm.
   - Storing: dubbele tik op "Start dossier". Eén opdracht (voltooiproef
     herstelbaar).
   - Storing: het RTG-scherm staat uit. (Voorstel) "Dit scherm staat uit; de
     oefening gebruikt een stilstaande kopie."
2. In het Oefenkantoor ziet hij de diagnose "liquiditeit": minder dan drie dagen
   kasbuffer. Hij dient een analyse in met twee indicatoren en een voorspelling
   voor morgen, met zekerheid 80%.
   - Storing: één indicator. 400 "Onderbouw de analyse met minimaal twee gemeten
     indicatoren."; bewaard: niets.
3. (Aanbevolen nu, V2) Hij zet een besluit klaar (prijs omhoog, bestelling
   omlaag) en vraagt een proefdag. Hij ziet "kas morgen +€ 4.100, levergraad
   -3 punten; spel, geen voorspelling; geldt als niemand anders vóór morgen iets
   wijzigt". Er is niets opgeslagen.
   - Storing: een ander lid wijzigt de strategie tussen proef en bevestigen. De
     echte dag wijkt af; het scherm zegt dat het besluit van een ander
     tussendoor kwam.
4. Hij bevestigt en draait de dag door (`volgende-dag` met `commandoId`).
   - Storing: dubbele tik. `herhaald: true`, één dag.
   - Storing: Rust valt weg. Terugval op JS, zelfde uitkomst.
5. (Aanbevolen nu, V3) De winstbrug zegt waarom de winst daalde: "-€ 2.300
   omzet, +€ 900 kostprijs, -€ 400 rente; controle 0".
6. Na vijf afgeronde analyses (aanbevolen nu, V1) ziet hij zijn
   kalibratiespiegel: "Bij 80% zekerheid had je 2 van 5 richtingen goed."
7. Hij is 24 en geverifieerd: xp, reputatie en budget worden opgebouwd. Een
   medespeler van 16 in dezelfde teamkamer speelt mee en houdt niets over
   (9f2a7ab).
   - Storing: crash midden in de dienst. Na herstart staan punten en lopende
     opdracht er nog (voltooiproef persistent).

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Werk oefenen op de echte schermen zonder ze aan te roepen | `spel.magnaat` | spelbrug + capability-scanner | een simulatiespel kent de software van zijn speler niet |
| Voorspelling naast realisatie, op dezelfde boekhoudwaarheid | `spel.magnaat` | economenlab op `magnaat-grootboek` | een tycoon-game toetst geen verwachting; een cursus heeft geen economie die doorrekent |
| Het eigen ondernemingsplan als spelwereld | `werk.onderneming` levert, `spel.magnaat` speelt | snapshot van aannames met herkomst | een tycoon-game heeft geen plan van de speler; een planningstool heeft geen spel |
| Inwerken op een goedgekeurde tweeling van de eigen zaak | `handel.digitaletweeling` | partnerstudio | geen spel kent de zaak achter de speler |
| Testhal die door de echte waardepoort gaat | MAGNAATLAB | `server/betaal/synthetisch.js` | een spel heeft geen productiepoort om te bewijzen |
| 18+-grens op één plek voor alle spellen | `kern/spellen/grens.js` | `progressieMag` | – |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bouwstenen**: `server/kern/magnaatwereld.js`, `magnaat-werkroutefabriek.js`,
`magnaat-capabilities.js`, `magnaat-trainingslobby.js`,
`magnaat-partnerstudio.js`, `server/kern/magnaat-oefeneconomie.js`,
`server/kern/magnaat-economische-motor/` (`besluiten.js` met `transactie` en
`kopieStaat`, `dag.js` met `neemMoment` en `volgendeDag`, `schokken.js` met
`schokZonderMutatie`), `server/kern/magnaat-economenlab-rapport.js`
(`resultatenrekening`, `prijsVolumeBrug`), `server/kern/magnaat-grootboek/`
(`geheugenJournaal`), `server/kern/spellen/grens.js`,
`server/kern/onderneming/simulatie.js`, `server/kern/onderneming/fase.js`,
`server/kern/fiscaal/scenario.js`, `server/betaal/synthetisch.js`,
`scripts/magnaatlab.js`, `scripts/magnaat-pomp.js`.

| Van → naar | Vorm | Toestemming |
|---|---|---|
| Onderneming → Magnaat | snapshot (kopie), één richting | ondernemer, per keer |
| Magnaat → Loopbaan | verwijzing, label "geoefend" | lid, 18+ |
| Wetregels → Magnaat | gedateerde data met bron, als signaal, pas na nalezing | geen |
| School/Schoolpartner → teamkamer | kamer met klas, niets per kind | docent |
| Magnaat → controleregister | voorstel | boardroom beslist |

---

## g. Prioritering

### HERSTEL

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| `virtueelBudget` en `dienstenVoltooid` onder `progressieMag` | – | – | – | gerepareerd (commit 9f2a7ab, `test/magnaatwereld.test.js` toets 4) |
| MAGNAATLAB.md par. 2 gelijktrekken met de JSON (6 van 727) | klein | laag | – | aanbevolen nu |
| Rolgrens op de gedeelde economie: wie mag `schok` en `volgende-dag` | klein | laag | Vraagt besluit 6 | aanbevolen nu, na besluit |
| Economenlab-analyses toetsen op de vier leerdossiervoorwaarden | klein | laag | Vraagt besluit 7 | aanbevolen nu |
| Bedienbaar en waarheidsgetrouw bewijzen (APPWERKT NT); economie en teamkamer in het scenario | klein | laag | voltooiproef | aanbevolen nu |
| Eerlijke tekst "scherm staat uit" bij werkprocessen | klein | laag | spelbrug | aanbevolen nu |

### VERDIEPING

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| V1 Kalibratiespiegel | klein | laag | `economen.analyses` | aanbevolen nu |
| V2 Proefdag | middel | middel | `transactie`, `geheugenJournaal` | aanbevolen nu |
| V3 Winstbrug | klein | laag | `historie[].bedrijven[].kosten` | aanbevolen nu |
| V4 Tweede volledig werkproces per afdeling | middel | middel | werkroutefabriek, controleregister | later |
| Eigen onderneming oefenen | middel | middel | besluit 2 | later |
| Inwerken op de eigen zaak, opleidingsgroep | middel | middel | partnerstudio, School | later |
| Agent Arena, poort in `npm run check` | groot | hoog | MAGNAATLAB fase 5 | niet doen nu |

---

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | elke afdeling heeft minstens één volledig werkproces | telling in `KANTOORWERKPROCESSEN` + fabriek | 1 volledig |
| Professionele diepte | na elke spel-dag is te zien waarom de winst veranderde, tot op de cent sluitend | toets op de winstbrug: `controle === 0` over 30 gerekende dagen | omzetbrug ja, winstbrug nee |
| Levenscyclus | de fasen van Onderneming zijn speelbaar, als spel gemarkeerd | toets op fasenamen | ontbreekt |
| Samenwerking en rollen | teamkamer zonder ranglijst; in de gedeelde economie is aanwijsbaar wie de dag doordraait | trainingslobby-toetsen + toets op de rolgrens | teamkamer ja, rolgrens nee |
| Domeinintelligentie | een proefdag verandert niets, en zonder tussenkomst is de echte dag gelijk aan de proef | toets: `mutatieVersie` en journaallengte gelijk na een proef; daarna echte dag vergelijken | ontbreekt |
| Los functioneren | zonder andere apps blijft alles speelbaar en zegt het scherm wat er uit staat | voltooiproef met domeinen uit | niet beproefd |
| RTG-ketens | nooit een productie-endpoint vanuit een speelbeurt | `test/magnaat-rtgketen.test.js` toets 7 | bestaat |
| Bewezen betrouwbaarheid | acht bewijzen centraal; 18+-grens dekt elke blijvende stand | APPWERKT, `test/magnaatwereld.test.js` toets 4 | lokaal 4/4 (dc501544), centraal te stempelen; bedienbaar en waarheidsgetrouw NT; grens op budget gerepareerd |

Geen dimensie leunt op een regel die (te controleren) is.

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

#### HERSTEL

| Functie | Kosten | Bouwt op | Stand |
|---|---|---|---|
| Blijvende standen onder `progressieMag` | – | `kern/spellen/grens.js`, `magnaatwereld.js` | gerepareerd (commit 9f2a7ab) |
| MAGNAATLAB.md gelijk met de JSON | klein | `scripts/magnaatlab.js` | open |
| Rolgrens op `schok` en `volgende-dag` | klein | `routes/magnaatwereld.js`, `besluiten.js` | open, na besluit 6 |
| Economenlab onder de leerdossiertoets | klein | `magnaat-economenlab-training.js` | open, na besluit 7 |
| Bedienbaar/waarheidsgetrouw bewijs; economie in het scenario | klein | `scripts/lib/voltooi/magnaat.js` | open |
| Eerlijke "scherm uit"-tekst | klein | spelbrug | open |

#### VERDIEPING

Drie echte verdiepingsfuncties voor nu, en een vierde voor later. Alle vier
blijven bij `spel.magnaat`, bouwen op wat er staat en bewaren niets nieuws.

**V1. Kalibratiespiegel: hoe goed zijn mijn eigen verwachtingen?**
- Gegevens en bron: de afgeronde analyses van het lid in
  `economen.analyses[lid]` (max. 60, `magnaat-economenlab-training.js`). Elke
  analyse draagt `voorspelling` (omzet, winst, inflatie, `zekerheid` 50-95),
  `richtingen` (omzet, winst, kas) en na `verwerkDag` een `uitkomst`.
- Rekenwijze: alleen analyses met status `beoordeeld` (gezet door `verwerkDag`). Indelen in drie
  zekerheidsbanden (50-69, 70-84, 85-95). Per band: aantal analyses, het deel
  waarin alle drie de richtingen goed waren, en de mediane absolute fout op
  omzet en winst als percentage van de uitkomst. Kalibratie per band =
  gemiddelde opgegeven zekerheid min het deel goed, in procentpunten. Minder dan
  5 afgeronde analyses in totaal: geen cijfers, alleen "nog te weinig".
  Projectie bij elke vraag, geen opslag.
- Rollen: alleen het lid zelf, voor zijn eigen sleutel. Geen kantoor, geen
  teamkamer, geen vergelijking met anderen. Onder 18 dezelfde projectie, omdat
  er niets bewaard of vergeleken wordt (de bestaande opslag van analyses valt
  onder HERSTEL, besluit 7).
- Acceptatiecriterium: een lid met 6 afgeronde analyses, waarvan 4 op 80%
  zekerheid met 2 goed, ziet "Bij 70-84% zekerheid: 4 analyses, 2 goed (50%);
  je was 30 punten te zeker." Een tweede lid krijgt bij dezelfde vraag alleen
  zijn eigen cijfers. Na de vraag is er niets in de opslag veranderd.
- Kosten: klein.

**V2. Proefdag: wat doet dit besluit morgen?**
- Gegevens en bron: de live staat via `kopieStaat()` in
  `magnaat-economische-motor/besluiten.js`; de schok van morgen via
  `schokZonderMutatie(e, dag + 1)` (`schokken.js`, deterministisch); het
  besluit in dezelfde velden als `beslis` (prijs, personeelDoel, loonMaand,
  trainingDag, bestelling, impactPct, lening).
- Rekenwijze: het besluit toepassen op de kopie, één dag rekenen op de kopie met
  een `geheugenJournaal` (`kern/magnaat-grootboek/opslag.js`), en voor het
  Praktijkbedrijf het verschil tonen in omzet, winst, kas, levergraad en
  kasbufferdagen, plus de diagnose vóór en na. De live staat, het journaal, de
  audit en de `commandos` worden niet aangeraakt. Label: "spel, geen
  voorspelling; geldt als niemand anders vóór morgen iets wijzigt".
- Onzekerheid: bij een Rust-rekenmotor die anders afrondt dan JavaScript kan de
  echte dag afwijken; de proef rekent daarom altijd via het JS-pad, en de toets
  hieronder meet of dat gelijk loopt.
- Rollen: elk lid dat `beslis` mag aanroepen; de proef zelf schrijft niets en
  hoeft dus geen rolgrens.
- Acceptatiecriterium: na een proefdag zijn `mutatieVersie`, de journaallengte
  en `historie.length` gelijk aan ervoor. Bevestigt het lid daarna hetzelfde
  besluit en draait niemand anders iets tussendoor, dan is de echte dag voor
  het Praktijkbedrijf gelijk aan de proef, tot op de cent.
- Kosten: middel.

**V3. Winstbrug: waarom is de winst veranderd?**
- Gegevens en bron: de twee laatste momenten in `historie`
  (`magnaat-economische-motor/dag.js`, `neemMoment`); elk moment draagt per
  bedrijf `omzet`, `winst` en `kosten` (kostprijs, loon, training, impact,
  rente, belasting).
- Rekenwijze: Δwinst = Δomzet − Δkostprijs − Δloon − Δtraining − Δimpact −
  Δrente − Δbelasting, en `controle` = Δwinst min de som van de posten (moet 0
  zijn), in dezelfde vorm als het bestaande `prijsVolumeBrug`. De omzetpost
  splitst verder in het bestaande prijs-, volume- en interactie-effect. De drie
  grootste posten krijgen een zin met de schok van die dag erbij.
- Rollen: elke speler leest de brug van het Praktijkbedrijf; het bedrijf is
  gedeeld en de cijfers staan al in het overzicht.
- Acceptatiecriterium: na de tweede dag staat er bij elke dag een brug waarvan
  de posten optellen tot het winstverschil, met controle 0 over 30 gerekende
  dagen in een toets; vóór de tweede dag staat er "Na twee economische dagen
  wordt de winst verklaard."
- Kosten: klein.

**V4 (later). Tweede volledig werkproces per afdeling.**
- Gegevens en bron: `KANTOORWERKPROCESSEN` in `magnaatwereld.js` (vorm van
  `service-reiswijziging`: stappen `software` + `formulier`, velden met
  min/max), de automatische routes uit `magnaat-werkroutefabriek.js`.
- Rekenwijze: per afdeling één werkproces met vier stappen (intake, oplossing,
  eigenaar, terugkoppeling), elk veld met verplichting en lengtegrens; een
  automatisch voorstel wordt pas "volledig" na goedkeuring in het
  controleregister.
- Rollen: kantoor (`kantoor.controleregister`, boardroom) keurt; de speler
  oefent.
- Acceptatiecriterium: de telling van volledige werkprocessen gaat van 1 naar
  het aantal afdelingen, en elk nieuw proces heeft een goedkeuring op naam.
- Kosten: middel. Later, omdat het werk per proces handwerk is.

**Afgewezen kandidaten, met reden**

| Kandidaat | Reden |
|---|---|
| Echte regels als speldata die weigeren (minimumloon, ATW) | De bron is een zoeksamenvatting en dus (te controleren); zo'n regel wordt nooit een harde weigerregel. Ook de eigenaar draagt hem niet: de loonstrook (`kern/payroll/motor.js`) kent het minimumloon niet (workos.md par. 9). Hooguit later een signaal, na nalezing. |
| Risicokaart per vestiging ("waarom brandt het bij jou vaker") | Bouwbaar op `spellen/magnaat/risico.js` (`kansOp`, `weegt`), maar World is van `spelen.bordspel`. Gaat naar die eigenaar (Vraagt besluit 5). |
| Convenantafstand ("nog € X tot de liquiditeitsnorm") | Bouwbaar op `spellen/magnaat/convenant.js` en `bank-acties.js` `beeld` (toont al `buffer`, `schuldlast`, `breukMaanden`, `trap`), maar ook World. Gaat naar `spelen.bordspel`. |
| Maandverklaring uit het World-grootboek | Idem: World. Het Oefenkantoor krijgt dezelfde vraag via V3. |
| Safe Management bij afwezigheid | GAMEHALL par. 12.6 beschrijft het voor World; het Oefenkantoor heeft geen klok die doorloopt zonder speler. |
| Examenachtige score op het economenlab | Een rubricscore die blijft en vergeleken kan worden, valt onder `progressieMag`; dat is het tegendeel van verdiepen. |

#### Naar een andere eigenaar

| Functie | Eigenaar | Bouwt op |
|---|---|---|
| Risicokaart, convenantafstand, maandverklaring World | `spelen.bordspel` | `kern/spellen/magnaat/risico.js`, `convenant.js`, `boekhouding.js` |
| Eigen onderneming oefenen (de aannames) | `werk.onderneming` levert | `kern/onderneming/simulatie.js` |

### (B) Het domeinmaximum, ook buiten de huidige scope

Richting, geen toezegging. Een nieuw domein vóór V1 blijft uitgesloten.

**Proces 1: van idee tot eerste werknemer, eerst geoefend, dan echt.**
- Stappen: idee en plan (Onderneming) → plan spelen in Magnaat → rechtsvorm en
  KVK (extern; termijn te controleren) → eerste klant → eerste werknemer
  oefenen in Magnaat (rooster, loon) → echt aannemen (Werk OS, payroll) →
  eerste btw-aangifte (extern, voorbehouden).
- Rollen: ondernemer, boekhouder (via Vertegenwoordiging), KVK en
  Belastingdienst (extern), eerste medewerker.
- Apps en eigenaar: Onderneming (`werk.onderneming`, de waarheid), Magnaat
  (`spel.magnaat`, alleen oefening), Werk OS, Loonstrook, Vertegenwoordiging.
- Buiten scope: besluit over de richting Onderneming → Magnaat; geen
  terugrichting; RTG dient niets in.

**Proces 2: inwerken van een horecateam.**
- Stappen: zaak bouwt tweeling → RTG keurt → nieuwe medewerker oefent
  HACCP-ronde, rekening splitsen, allergievraag → eerste echte dienst in
  Horeca.
- Rollen: manager, medewerker, RTG-kantoor.
- Apps: partnerstudio (`handel.digitaletweeling`), Magnaat, Horeca
  (`horeca.dashboard`), Team Room.
- Buiten scope: een besluit dat oefenresultaten nooit een beoordeling van
  personeel worden (geen ranglijst, HORECA-regel), en HACCP-regels als
  speldata van de eigenaar.

**Proces 3: ondernemerschap als leerlijn op school.**
- Stappen: klas speelt Quick (potje, `spelen.bordspel`) → reflectie in het
  economenlab → projectweek met teamkamer → voor 18+ een Campaign met opbouw.
- Rollen: leerling, docent, school.
- Apps: Magnaat, Spelen, School (`leren.school`), Schoolpartner
  (`werk.schoolbeheer`).
- Buiten scope: een besluit over een leerdoel "ondernemen" in de Fabric; niets
  per kind bewaard onder 18.

**Proces 4: Magnaat als testhal voor RTG.**
- Stappen: capability kiezen → rail-adapter → invariant verplaatsen → pas dan
  een poortregel.
- Eigenaar: MAGNAATLAB (geen app-eigenaar; huisbreed).
- Buiten scope: impactgraaf (OS.md), één laagmodel; besluit over fase 5.

---

## Vraagt besluit

**1. Valt elke blijvende spelstand onder `progressieMag`?** Genomen in de
reparatie: ja, ook `virtueelBudget` en `dienstenVoltooid` (commit 9f2a7ab). Blijft
hier staan als besluit dat de eigenaar nog bevestigt; open is alleen het
economenlab (besluit 7).

**2. Wie bezit "je eigen onderneming oefenen"?**
- **A. Onderneming bezit plan en aannames; Magnaat krijgt een kopie en speelt;
  niets gaat terug** (aanbevolen). Geen tweede eigenaar. Middel.
- B. Onderneming bouwt zelf een oefenmodus op `simulatie.js`. Geen spel nodig;
  dan staat er een tweede simulatiemotor naast Magnaat.
- C. Magnaat leest Onderneming live. Altijd actueel; spel en echte data lopen
  door elkaar.

**3. Mag een geoefend werkproces in Loopbaan?**
- **A. Ja, alleen 18+, door het lid gekozen, label "geoefend, niet gedaan"**
  (aanbevolen). Klein.
- B. Nee. Geen werk; oefening blijft onzichtbaar.

**4. De twee synthetische werelden (MAGNAATLAB fase 3).** De meting staat er:
17 gedeelde onderwerpen, 43 kandidaatparen, 0 met een gedeelde vorm.
- **A. Gescheiden laten en de meting als poort houden: een gedeelde vorm meldt
  zich vanzelf** (aanbevolen). Kost niets.
- B. Nu samenvoegen. Middel; er is niets gemeten dat samenvoegen draagt.

**5. Hoort Magnaat World bij deze kaart?** (nieuw)
- **A. Nee: World blijft van `spelen.bordspel`; een eigen kaart of een hoofdstuk
  in de spelenkaart; deze kaart noemt alleen de naad** (aanbevolen). Kost een
  kaart.
- B. World verhuist naar `spel.magnaat`. Eén Magnaat; dan verandert
  SCHERMEIGENAAR en het scherm `spelen.html` verliest een spel.
- C. Laten zoals het in de vorige kaart stond. Geen werk; dan beschrijft deze
  kaart een scherm dat niet van haar is.

**6. Wie mag de gedeelde Oefenkantoor-economie doordraaien en een schok plannen?** (nieuw)
- **A. Iedereen mag een besluit nemen; `schok` en `volgende-dag` alleen voor de
  maker van een teamkamer of het kantoor, en elke keer met naam in de audit**
  (aanbevolen). Klein.
- B. Iedereen, zoals nu. Geen werk; één lid kan de dag van alle anderen
  doordraaien.
- C. Per lid een eigen economie. Groot; dan is "één gedeelde virtuele economie"
  weg.

**7. Is een economenlab-analyse met score een leerdossier?** (nieuw)
- **A. Ja, onder de vier voorwaarden, met een toets erop; de score blijft per
  analyse en wordt nooit opgeteld tot een niveau** (aanbevolen). Klein.
- B. Nee, het is progressie: onder 18 niets bewaren. Klein; een kind verliest
  zijn eigen terugblik.
