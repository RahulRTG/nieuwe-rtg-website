# Magnaat (link:magnaat)

Eigenaar: `spel.magnaat` → `apps/magnaat.html` (SCHERMEIGENAAR.json, doelgroep
lid; doel: "een lid leert ondernemen door in een spel-simulatie een eigen
bedrijf te runnen en keuzes te maken"). Ingang: de app Magnaat. Doelgroep: het
lid als speler. Twee buurschermen hebben een **eigen eigenaar**:
`kantoor.controleregister` → `apps/magnaat-kantoor.html` (kantoor) en
`handel.digitaletweeling` → `apps/magnaat-partnerstudio.html` (zaak).
Diepte-documenten: `GAMEHALL.md` par. 12 (Magnaat als product) en
`MAGNAATLAB.md` (Magnaat als testhal).

Magnaat is twee dingen in één motor: (1) een **werkspel** waarin een speler
dossiers uit een dagdienst afhandelt door de juiste RTG-schermen te openen, en
(2) een **economie** (bordspel, Quick, Campaign, Living World) waarin hij een
bedrijf runt. Deze kaart gaat over beide als leerweg naar ondernemen.

---

## a. Inventaris van het bewezen bestaande

### Wat er staat

| Laag | Wat | Pad |
|---|---|---|
| Schermen | spel, kantoor (controleregister), partnerstudio | `public/apps/magnaat.html` + `magnaat-*.js`; `magnaat-kantoor.html`; `magnaat-partnerstudio.html` |
| Routes (lid) | `/api/member/magnaat/{overzicht, taak/start, taak/antwoord, taak/handeling, taak/actie, kantoor/kies, werkproces/start, economie/beslis, economie/analyse, economie/volgende-dag, economie/schok, controle/*, partner/start, partner/stap, teamkamer/*, leven/*}`; stad: `/api/member/magnaat/stad/{staat, maak, doe, start, actie, verlaat}` | `server/routes/magnaatwereld.js`, `server/routes/magnaatstad.js` |
| Routes (zaak, kantoor) | `/api/supplier/magnaat/studio/*`; `/api/office/magnaat/*` (boardroomAuth) | `server/routes/magnaatwereld.js` |
| Kern | spelbrug (1066 regels), capability-scanner, dekkingsmatrix, partnerstudio, trainingslobby (teamkamer), economenlab, kantoorregels, werkroutefabriek; economie, bank, verzekering, veiling, handel, boekhouding, kaart | `server/kern/magnaatwereld.js`, `server/kern/magnaat-*.js`, `server/kern/spellen/magnaat/` |
| Testhal-rail | synthetische bank als vierde provider; geldpompvraag aan RTG Pay | `server/betaal/synthetisch.js`, `server/kern/spellen/magnaat/rtg-keten.js`, `test/simulatiebank.test.js`, `test/magnaat-rtgketen.test.js` |
| Meting | testhalbereik | `scripts/magnaatlab.js`, `MAGNAATLAB.json`, `test/magnaatlab.test.js` |
| Toetsen | ongeveer 50 | `test/` |

Regels in code:
- **Een spelopdracht roept nooit een productie-endpoint aan** (kop van
  `kern/magnaatwereld.js`); elke functie wordt een trainingskopie met
  synthetische data. Een speelbeurt laadt `kern/pay` niet (toets 7 in
  `test/magnaat-rtgketen.test.js`).
- **18+-grens**: `magOpbouwen = progressieMag`; xp, niveau en reputatie alleen
  voor wie `volwassen()` haalt; zonder bedrading faalt hij dicht. Melding
  `GEEN_OPBOUW`.
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
  "Start dossier" opent één opdracht.
- **BEVOEGD.json** (05:08, 55ed79f9): 90 routes, waarvan 20 open.
- **IDOR.json** (huisbreed): 1999 routes, 0 doorbraken.
- **Testhal**: `MAGNAATLAB.json` (commit van 19 oktober 2026): 70
  simulatiemodules, 7 kernmodules geraakt in 6 van 720 kerndomeinen (1%), 0
  modules praten naar buiten, 3 aanroepen naar `kern/hospitality-universe/`.
  Geraakt: `eigencollectie`, `bestuursroutes`, `magnaat-kantoorregels/tabel`,
  `bearercode`, `betaalwaarheid`, `pay`, `pay/loshistorie`. MAGNAATLAB.md par. 2
  noemt nog 2 van 415; de feitenlijst noemt 4 van 576. De JSON is de verste
  stempel.
- Geldpompproef via RTG Pay: vijf perverse volgordes, exact nul verschil;
  twintig tikken geven veertig grootboekregels (MAGNAATLAB.md par. 5.1).

### Wat de code of het document zelf "niet gebouwd" noemt

- MAGNAATLAB fase 3 (twee synthetische werelden wegen), 5 (poort in `npm run
  check`) en 6 (opschalen) staan open; er is **geen impactgraaf** (par. 5.2).
- De pijp loopt "de verkeerde kant op": RTG-routes worden spelonderwerp, een
  partij raakt geen route werkelijk aan (par. 2).
- De kaartdata zijn `handmatig`: één stad met echte straatnamen, zonder
  huisnummers (GAMEHALL par. 12.1).
- Er is **geen verbinding met Onderneming**: geen module in `kern/magnaat*` of
  `kern/spellen/magnaat/` leest `kern/onderneming/`.

---

## b. Marktvergelijking

Geraadpleegd 19 oktober 2026 via WebSearch op het officiële domein (via
zoektool, live te controleren). Merken alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Capitalism Lab | betaalde DLC: Subsidiary, City Economic Simulation, Digital Age, Banking | bank en financiering: **ja** (`spellen/magnaat/bank*.js`); stadseconomie: **half** (één stad, handmatige data); dochterondernemingen: **half** (aandeel-acties) | https://www.capitalismlab.com/dlc/ |
| Big Ambitions | eenmalige aankoop; geen betaalmuur gevonden | persoonlijk ondernemersverhaal: **half** (`magnaat-leven`) | https://store.steampowered.com/app/1331550/Big_Ambitions/ |
| Duurste enterprisepakket voor bedrijfssimulatie | niet gevonden in de werkbestanden | – | niet gevonden |
| Zakelijk leren (Cornerstone, Docebo, offerte) | vaardighedengraaf, leerpaden | werkprocessen oefenen op echte schermen: **ja**, een vaardighedengraaf **nee** | https://www.cornerstoneondemand.com/platform/portfolio-packages/ , https://www.docebo.com/pricing/ |

Wat de markt niet heeft: een spel dat de werkelijke schermen van het platform
als oefenstof gebruikt zonder ze aan te roepen, met dezelfde privacy- en
bevoegdheidsregels als het echte werk, en een officieel partnerbedrijf als
digitale tweeling na menselijke goedkeuring.

---

## c. Analyse van het volledige domein

**Particulier.** Iemand wil leren ondernemen zonder geld te verliezen: prijzen
zetten, personeel inplannen, een lening afsluiten, een tegenvaller opvangen.
Behoefte: een veilige oefenruimte en uitleg waarom iets misging.

**Professioneel.** Een (aankomend) ondernemer wil zijn eigen plan oefenen: wat
gebeurt er bij een slechte maand, een loonsverhoging, een tweede vestiging.
Een medewerker wil een werkproces (servicegesprek, controle) oefenen vóór hij het
echt doet. Een opleider wil een groep laten oefenen (teamkamer).

**Organisatie.** Een zaak wil nieuwe medewerkers inwerken op haar eigen bedrijf
(partnerstudio, `handel.digitaletweeling`). RTG wil capabilities bewijzen
voordat ze productie halen (testhal, MAGNAATLAB).

**Wet en norm.** Magnaat voert niets uit en is dus nergens wettelijk
aansprakelijk; maar wat het **leert**, moet kloppen met de wet. Relevant uit
`domein-max.txt`:
- Minimumloon 21+ per 1-7-2026 €14,99 bruto per uur
  (https://www.rijksoverheid.nl/onderwerpen/minimumloon/bedragen-minimumloon/bedragen-minimumloon-2026).
- Oproepkrachten: oproep minstens 4 dagen vooraf
  (https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/welke-contracten-zijn-er-voor-oproepkrachten).
- Arbeidstijdenwet: 12 uur per dienst, 11 uur rust
  (https://www.rijksoverheid.nl/vraag-en-antwoord/werktijden/wettelijke-regels-werktijden-en-rusttijden).
- KVK-inschrijving van 1 week vóór tot 1 week na de start
  (https://www.kvk.nl/starten/op-welke-datum-moet-ik-mijn-bedrijf-inschrijven-bij-kvk/).
- Btw-aangifte uiterlijk de laatste dag van de maand na het tijdvak
  (https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/btw_aangifte_doen_en_betalen/btw-aangifte-waar-moet-u-aan-denken/btw-aangifte-waar-moet-u-aan-denken).
- Contant verbod vanaf €3.000 sinds 1-1-2026
  (https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/aangifte_betalen_en_toezicht/wwft-voorkomen-van-witwassen-en-terrorismefinanciering/verplichtingen/verbod-cash-3000).
- Betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken
  (https://ondernemersplein.kvk.nl/betalingstermijn-incassokosten-en-wettelijke-rente/).

**Wat dat betekent voor software.** Een regel uit de echte wereld in het spel is
**speldata met een bron en een datum**, niet een kopie van de fiscale of
arbeidskern. Waar het spel een echte regel gebruikt, hoort het die te lezen uit
de eigenaar (bijvoorbeeld de ATW-regels als data, `mobiliteit/cdt*.js`) of de
spelwaarde zichtbaar "spelindex" te noemen, zoals de wereld nu al doet
("economische cijfers zijn expliciete spelindices"). Een speluitkomst is nooit
een advies over een echt bedrijf.

---

## d. Functiecatalogus L1–L6

### L1 Persoonlijk

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Dagdienst met drie dossiers | bestaat, `magnaatwereld.js` | catalogus, wereldgebeurtenis | dossier af = juist scherm geopend + keuzes; bonus bij volle dienst | geen | speler | eigen | – | een tweede speler ziet de dossiers niet | – | bestaat |
| Progressie alleen 18+ | half: xp en reputatie via `progressieMag`; `virtueelBudget` en `dienstenVoltooid` groeien ook onder 18 (r. 581-582, 707, 990) | spelersstaat | alles wat tussen sessies als stand blijft, hangt aan `progressieMag` | geen | speler | – | Quick en Campaign zijn een potje | een speler onder 18 houdt na een herstart geen opgebouwd budget of teller over | klein | aanbevolen nu (Vraagt besluit 1) |
| Uitleg na een fout | half: `uitleg` per stap | scenariostap | engine rekent, AI legt uit; nooit een verzonnen getal | geen | speler | – | – | elke foute keuze krijgt de reden in één zin | – | bestaat |
| "Sinds je weg was" | bestaat volgens GAMEHALL par. 12.4 | twee gerekende standen | verschil, geen logboek | geen | speler bij terugkomst | – | – | – | – | bestaat (niet apart beproefd) |
| Safe Management bij afwezigheid | beschreven, GAMEHALL par. 12.6 | beleid | geen grote investering offline; essentiële kosten door | geen | speler | – | expliciet agressief gekozen | een week weg betekent niet failliet | middel | later |

### L2 Professioneel

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Werkproces oefenen op echte schermen | bestaat, `KANTOORWERKPROCESSEN` (1 volledig: reiswijziging) | functiecatalogus | stappen `software` + `formulier`; alles synthetisch | geen | speler | eigen | rode functies (geld, identiteit) alleen oefenen | – | – | bestaat |
| Meer werkprocessen uit de Capability Graph | half: `magnaat-werkroutefabriek.js`, 1 handgeschreven proces | routes en risicokleur | elke familie krijgt dezelfde stapsoorten | middel: automatisch gegenereerde stappen kunnen onzin zijn | – | kantoor keurt (`kantoor.controleregister`) | – | per afdeling minstens één volledig werkproces, door een mens goedgekeurd | middel | later |
| **Eigen onderneming oefenen** (scenario-oefening) | ontbreekt | plan en aannames uit `kern/onderneming/simulatie.js` (12 maanden, 3 scenario's, herkomst per aanname) | Onderneming levert een **kopie van de aannames**, Magnaat speelt maanden met schokken; niets gaat terug als feit | groot: spel is geen voorspelling; uitkomst klasse `advies` of label "spel" | ondernemer | ondernemer kiest export | onder 18: speelbaar, niets bewaard | een ondernemer speelt zijn eigen plan een jaar door en ziet bij elke uitkomst "spel, geen voorspelling" | middel | later (Vraagt besluit 2) |
| Teamkamer (groep oefent samen) | bestaat, `magnaat-trainingslobby*.js` | kamer, rollen, revisie | code delen en intrekken; rol per deelnemer | geen | deelnemers | maker van de kamer | – | – | – | bestaat (niet apart beproefd) |
| Partnerbedrijf als tweeling | bestaat bij `handel.digitaletweeling` | snapshot na menselijke goedkeuring | geen route stuurt de volledige tweeling naar een browser | geen | speler, zaak | zaak bouwt, RTG keurt | – | – | – | bestaat (andere eigenaar) |

### L3 Organisatorisch

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Inwerken op de eigen zaak | half: partnerstudio + `partner/start` | tweeling van de zaak | de zaak wijst een training toe aan eigen personeel; uitslag gaat alleen naar de medewerker | geen | medewerker | zaak (manager) | geen ranglijst op medewerkers (HORECA-regel) | een nieuwe medewerker oefent het eigen bedrijf; de manager ziet "gedaan" en geen score | middel | later |
| Controleregister en Future Engine | bestaat, `kantoor.controleregister` | spelfrictie (min. 3 dossiers, gemiddelde < 72%) | voorstel, nooit codewijziging | middel | kantoor | boardroom | – | – | – | bestaat (andere eigenaar) |
| Opleidingsgroep (school, bootcamp) | ontbreekt | teamkamer + School | een docent opent een kamer voor een klas; geen uitslag per leerling buiten de kamer | geen | docent | `werk.schoolbeheer` of `leren.school` | onder 18: niets bewaard | een klas speelt een partij en na afloop is er niets per kind opgeslagen | middel | later |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Economie met segmenten en schokken | bestaat, `spellen/magnaat/vraag.js`, `economie.js` | spelindices | deterministisch bijrekenen | geen: spelwaarheid | speler | – | – | dezelfde begintoestand geeft dezelfde uitkomst | – | bestaat |
| Geldpompcontrole | bestaat, `scripts/magnaat-pomp.js`, `magnaat:pomp:rtg` | grootboek | som nul, aantal regels vast | geen | – | – | – | – | – | bestaat |
| Echte regels als speldata met bron | ontbreekt | `domein-max.txt`-bronnen | minimumloon, ATW, betaaltermijn als gedateerde data; leest bij voorkeur van de eigenaar | laag: bedragen wijzigen per halfjaar | speler ziet bron | – | – | een loon onder het minimumloon geeft in het spel dezelfde weigering als in Werk, met bron | middel | later |
| Spel naar scenario-engine | ontbreekt | `kern/fiscaal/scenario.js` (`scenario.doorrekening` = advies) | een spelvraag "wat als ik iemand aanneem" mag dezelfde doorrekening tonen, als oefening | middel | speler | – | – | – | middel | later |
| Agent Arena | beschreven, MAGNAATLAB par. 4.3 | – | uitslag is "zou binnen de grenzen zijn gebleven", nooit vrijgave | – | – | – | – | – | groot | niet doen nu: een PASS mag geen bevoegdheid verlenen, en de autonomiegrens is een besluit |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fasen idee → groep als speelbare hoofdstukken | ontbreekt | `kern/onderneming/fase.js` (idee, validatie, oprichting, eersteklant, tractie, werkgever, vestigingen, groep) | spelhoofdstukken volgen dezelfde namen; de fase in het spel zegt niets over de echte onderneming | geen | speler | – | – | wie in het spel "werkgever" wordt, ziet dezelfde stappen als in Onderneming, gemarkeerd als spel | middel | later |
| Afscheid en faillissement in het spel | half: `spellen/magnaat/afscheid.js` | spelstaat | – | geen | speler | – | – | – | – | bestaat (niet beproefd) |
| Living World | 18+ (GAMEHALL par. 12.7) | – | permanent = progressie | – | – | volwassen() | – | – | groot | later |

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
| Twee synthetische werelden | open (fase 3) | `kern/hospitality-universe/` | wegen vóór er een derde komt | – | – | – | – | – | klein | aanbevolen nu (meting, geen bouw) |

### Modus LOS

Met alle andere apps uit blijft Magnaat volledig speelbaar: de economie, het
bordspel en de dossiers draaien op synthetische data. Werkprocessen die een
RTG-scherm openen, zeggen eerlijk: **"Dit scherm staat uit; de oefening gebruikt
een stilstaande kopie."** Een speler onder 18 leest: "Je speelt gewoon; er wordt
niets opgebouwd" (`GEEN_OPBOUW`).

### Modus SAMEN: een volledige keten

Een aankomend horeca-ondernemer van 24.

1. Hij legt zijn plan vast in Onderneming (`/plan/vastleggen`, simulatie met
   herkomst).
2. (Later, besluit 2) Hij kiest "oefen dit plan in Magnaat". Onderneming geeft
   een kopie van de aannames; Magnaat start een Campaign.
   - Storing: aannames onvolledig. Onderneming weigert met de ontbrekende
     velden (LAT-regel 3); Magnaat start niet met verzonnen waarden.
3. Hij speelt twaalf spelmaanden met een schok (personeelsuitval).
   - Storing: dubbele tik op "volgende dag". `commandoId` voorkomt een dubbele
     dag.
4. Hij oefent het werkproces "personeel inplannen" op een kopie van Team Room.
   - Storing: hij plant 13 uur. (Later) het spel weigert met de ATW-regel en
     bron, zoals het echte scherm.
5. Na afloop ziet hij "spel, geen voorspelling" en de verschillen met zijn
   plan. Niets gaat terug naar Onderneming.
   - Storing: crash midden in de maand. Na herstart staan punten en lopende
     opdracht er nog (voltooiproef persistent).
6. Hij is 24 en geverifieerd: xp en reputatie worden opgebouwd. Een
   medespeler van 16 in dezelfde teamkamer speelt mee en houdt niets over
   (aanbevolen nu: ook geen budget of teller).

---

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Werk oefenen op de echte schermen zonder ze aan te roepen | `spel.magnaat` | spelbrug + capability-scanner | een simulatiespel kent de software van zijn speler niet |
| Het eigen ondernemingsplan als spelwereld | `werk.onderneming` levert, `spel.magnaat` speelt | snapshot van aannames met herkomst | een tycoon-game heeft geen plan van de speler; een planningstool heeft geen spel |
| Inwerken op een goedgekeurde tweeling van de eigen zaak | `handel.digitaletweeling` | partnerstudio | geen spel kent de zaak achter de speler |
| Testhal die door de echte waardepoort gaat | MAGNAATLAB | `server/betaal/synthetisch.js` | een spel heeft geen productiepoort om te bewijzen |
| 18+-grens op één plek voor alle spellen | `kern/spellen/grens.js` | `progressieMag` | – |

---

## f. Bouwstenen en ontbrekende koppelingen

**Bouwstenen**: `server/kern/magnaatwereld.js`, `magnaat-werkroutefabriek.js`,
`magnaat-capabilities.js`, `magnaat-trainingslobby.js`,
`magnaat-partnerstudio.js`, `server/kern/spellen/magnaat/`,
`server/kern/spellen/grens.js`, `server/kern/onderneming/simulatie.js`,
`server/kern/onderneming/fase.js`, `server/kern/fiscaal/scenario.js`,
`server/kern/fiscaal/zekerheid.js`, `server/betaal/synthetisch.js`,
`scripts/magnaatlab.js`, `scripts/magnaat-pomp.js`.

| Van → naar | Vorm | Toestemming |
|---|---|---|
| Onderneming → Magnaat | snapshot (kopie), één richting | ondernemer, per keer |
| Magnaat → Loopbaan | verwijzing, label "geoefend" | lid, 18+ |
| Wetregels → Magnaat | gedateerde data met bron, gelezen van de eigenaar | geen |
| School/Schoolpartner → teamkamer | kamer met klas, niets per kind | docent |
| Magnaat → controleregister | voorstel | boardroom beslist |

---

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| `virtueelBudget` en `dienstenVoltooid` onder `progressieMag` | klein | laag | besluit 1 | aanbevolen nu |
| Bedienbaar en waarheidsgetrouw bewijzen (APPWERKT NT) | klein | laag | voltooiproef | aanbevolen nu |
| MAGNAATLAB-cijfer in het document gelijktrekken met de JSON | klein | laag | – | aanbevolen nu |
| Twee synthetische werelden wegen (fase 3) | klein | laag | meting | aanbevolen nu |
| Eerlijke tekst "scherm staat uit" bij werkprocessen | klein | laag | – | aanbevolen nu |
| Eigen onderneming oefenen | middel | middel | besluit 2 | later |
| Wetregels als speldata | middel | middel | eigenaren van de regels | later |
| Meer werkprocessen uit de graaf | middel | middel | controleregister | later |
| Inwerken op de eigen zaak, opleidingsgroep | middel | middel | partnerstudio, School | later |
| Agent Arena, poort in `npm run check` | groot | hoog | MAGNAATLAB fase 5 | niet doen nu |

---

## h. Toetsbaar eindcontract Beyond Premium

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | elke afdeling heeft minstens één volledig werkproces | telling in `KANTOORWERKPROCESSEN` + fabriek | 1 volledig |
| Professionele diepte | spelregels die een echte regel nadoen, dragen bron en datum | registertoets op speldata | niet gemeten |
| Levenscyclus | de fasen van Onderneming zijn speelbaar, als spel gemarkeerd | toets op fasenamen | ontbreekt |
| Samenwerking en rollen | teamkamer: geen ranglijst, rollen per revisie | bestaande trainingslobby-toetsen | bestaat |
| Domeinintelligentie | geen speluitkomst verschijnt buiten Magnaat als feit | toets: geen module buiten het spel leest spelstaat | niet getoetst |
| Los functioneren | zonder andere apps blijft alles speelbaar | voltooiproef met domeinen uit | niet beproefd |
| RTG-ketens | nooit een productie-endpoint vanuit een speelbeurt | `test/magnaat-rtgketen.test.js` toets 7 | bestaat |
| Bewezen betrouwbaarheid | acht bewijzen centraal; 18+-grens dekt elke blijvende stand | APPWERKT, toets op `virtueelBudget` | lokaal 4/4 (dc501544), centraal te stempelen; bedienbaar en waarheidsgetrouw NT |

---

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Blijvende standen onder `progressieMag` | klein | `kern/spellen/grens.js`, `magnaatwereld.js` |
| Bedienbaar/waarheidsgetrouw bewijs | klein | `scripts/lib/voltooi/magnaat.js` |
| Werelden wegen, cijfer gelijktrekken | klein | `scripts/magnaatlab.js` |
| Eerlijke "scherm uit"-tekst | klein | spelbrug |
| Eigen onderneming oefenen (na besluit) | middel | `kern/onderneming/simulatie.js`, campagne |
| Wetregels als speldata, meer werkprocessen, inwerken | middel | eigenaren, werkroutefabriek, partnerstudio |

### (B) Het domeinmaximum, ook buiten de huidige scope

Richting, geen toezegging. Een nieuw domein vóór V1 blijft uitgesloten.

**Proces 1: van idee tot eerste werknemer, eerst geoefend, dan echt.**
- Stappen: idee en plan (Onderneming) → plan spelen in Magnaat → rechtsvorm en
  KVK (extern, 1 week vóór tot 1 week na start) → eerste klant → eerste
  werknemer oefenen in Magnaat (rooster, loon, ATW) → echt aannemen (Werk OS,
  payroll) → eerste btw-aangifte (extern, voorbehouden).
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
- Stappen: klas speelt Quick (potje) → reflectie → projectweek met teamkamer →
  voor 18+ een Campaign met opbouw.
- Rollen: leerling, docent, school.
- Apps: Magnaat, School (`leren.school`), Schoolpartner (`werk.schoolbeheer`).
- Buiten scope: een besluit over een leerdoel "ondernemen" in de Fabric; niets
  per kind bewaard onder 18.

**Proces 4: Magnaat als testhal voor RTG.**
- Stappen: capability kiezen → rail-adapter → invariant verplaatsen → pas dan
  een poortregel.
- Eigenaar: MAGNAATLAB (geen app-eigenaar; huisbreed).
- Buiten scope: impactgraaf (OS.md), één laagmodel; besluit over fase 5.

---

## Vraagt besluit

**1. Valt elke blijvende spelstand onder `progressieMag`?**
- **A. Ja: ook `virtueelBudget` en `dienstenVoltooid`** (aanbevolen). Klein;
  een speler onder 18 begint elke sessie met het startkapitaal.
- B. Nee: alleen xp, niveau en reputatie. Geen werk; een groeiend budget is dan
  een stand buiten het potje onder een andere naam.

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

**4. De twee synthetische werelden (MAGNAATLAB fase 3)**
- **A. Eerst meten wat ze delen, dan beslissen** (aanbevolen). Klein.
- B. Nu samenvoegen. Middel; risico op het verkeerde model.
