# Horeca (link:horeca)

Eigenaar: `horeca.dashboard` -> `apps/horeca.html`, met 13 `horeca.*`-capabilities
(bar, beheer, bezorging, club, events, keuken, haccp, hotel, pda, vloer,
tweedescherm; plus `horeca.tafelgast` en `horeca.bestellen` aan de gastkant).
Ingang: `/apps/horeca.html`, bediend via `RTGHoreca.api` (`public/apps/horeca/kern.js`).
Doelgroep: zaak (medewerker en manager van een horecazaak). De gast is een lid
op codenaam en hoort bij de gastkant (`apps/gast.html`, `apps/bestellen.html`).

De horeca-app is de zaakkant van de leveranciersapp. Rooster, klok en team zijn
van Team Room (`zaak.teamroom`, `apps/personeel.html`); loon is van het
loonkantoor (`kantoor.payroll`, `apps/payroll.html`) met de zaak als tweede
handtekening; vestigingen zijn van Concern (`werk.concern`, `apps/concern.html`);
oprichting en vergunningstappen zijn van Onderneming (`werk.onderneming`); B2B-inkoop
tussen zaken is van `handel.inkoop` (`apps/handel.html`); de kassa is `handel.kassa`.

## a. Inventaris van het bewezen bestaande

**Wat er staat**

- Schermen (11): `public/apps/horeca.html`, `-bar`, `-beheer`, `-bezorg`, `-club`,
  `-events`, `-expeditie`, `-haccp`, `-hotel`, `-pda`, `-vloer`.
- Routes: 42 bestanden in `server/routes/supplier/horeca/`, 128 paden. Kern:
  `rekening/open|regel|regel/stoel|regel/corrigeer|regel/weg|splits|verdeel|verplaats|voeg-samen`,
  `betaal`, `keuken/bord|stand|regie|stappen`, `offline/sync|handelingen`, `wijk/*`,
  `haccp/*`, `club/*`, `event/*`, `folio/*`, `bezorg/*`.
- Kern: `server/kern/horeca.js` en `server/kern/horeca/` (41 modules), o.a.
  `regel.js`, `gezelschap.js`, `pas.js`, `keukenlaag.js`, `stappen.js`,
  `werklijst.js`, `wijk*.js`, `dienstmeting.js`, `correctie.js`, `teruggave.js`,
  `samenvoegen.js`, `safety.js`, `bezorgovergang.js`, `rahul-recht.js`.
- Opslag: collectie `horeca` per zaakcode, bedragen in centen, 13 kanalen.
  Regelstanden: besteld, gestart, bereid, klaar, uitgegeven.
- HACCP: `server/routes/supplier/horeca/haccp.js` (meetpunten met grens, meting
  met verplichte actie bij afwijking, correctie met de oude waarde erbij,
  logboek met "gemist vandaag", batches met THT) en `haccp-lijsten.js`
  (controlelijsten, elk punt apart, niet-akkoord vraagt een opmerking).
- Allergenen: per gerecht `allergens` op de kaart (`server/routes/supplier/menukaart.js`),
  per regel een eigen veld `allergie` (`kern/horeca/regel.js`), de 14 EU-allergenen
  als vaste lijst in `server/kern/tafelwensen.js` (gastwensen).
- Veiligheidsgrens: `server/kern/horeca/safety.js` (alcohol buiten de functie,
  allergie vraagt menselijke dubbelcheck, noodroute); leeftijdscontrole bij de
  bezorgrit (`bezorgrit.js`) en de clubdeur (`clubdeur.js`); leeftijdsregel in
  `server/kern/gast/beleid.js`.
- Voorraad en inkoop: `server/kern/keuken.js` (recepten, afboeken, telling,
  verspilling, levering, inkoopadvies), `/api/supplier/keuken/bestel-advies`,
  `server/kern/groothandel.js` met `/api/supplier/inkoop/{markt,bestel,mijn,annuleer,ai,ai-bevestig}`.
- Personeelszicht: `server/kern/leverancier/logboekzicht.js` en
  `personeelzicht.js` (kloktijden van collega's alleen voor de manager, verzuim
  alleen "afwezig", sollicitaties alleen voor de manager).
- Omzetdag tot sluiting of 05:00: `omzetdag()` in `server/kern/tijdzone.js`.
- Ketenproeven: `scripts/tafelproef.js` (gast, zaal, keuken) en
  `scripts/bezorgproef.js` (tien schakels bezorging).
- Ongeveer 37 horecatoetsen in `test/` (o.a. `horeca-rekening`, `horeca-keuken`,
  `horeca-dienstmeting`, `horeca-klokgrens`, `horeca-leen-dienst`,
  `personeelzicht-routes`).

**Wat bewezen is**

| Bewijs | Stand | Bron |
|---|---|---|
| bereikbaar, bedienbaar, waarheidsgetrouw | BEWEZEN centraal | APPWERKT.json |
| menselijk | NIET_GETEST centraal; lokaal gesloten 3/3 (afgeleid) | APPWERKT; voltooiproef 19-10 |
| voltooibaar | NIET_GETEST centraal (bron `scripts/tafelproef.js`); lokaal gesloten 6/6 | idem |
| persistent, herstelbaar | GEEN_FIXTURE centraal; lokaal gesloten | idem |
| bevoegd | NIET_GETEST in APPWERKT; BEVOEGD.json telt 7/7 (stempel 05:08, 55ed79f9) | BEVOEGD.json |
| IDOR | 1999 routes huisbreed, 0 doorbraken, 0 lekken | IDOR.json |

Voltooiproef lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.
De proef (`scripts/lib/voltooi/horeca.js`) loopt: rekening openen op tafel,
gerecht tegen de kaartprijs (een clientprijs van 1 cent telt niet), tweede
rekening op dezelfde tafel geeft 409, gang vrij, keuken zet uitgegeven, afrekenen
met pin, offline sync eenmalig, tweede zaak (PONTO) ziet niets.

**Wat de code of het document zelf als niet gebouwd opgeeft** (HORECA.md)

- Bereidingsstappen half, runner half, action receipt niet.
- Acht van twaalf meetpunten van de meetlat "niet gemeten"; "met geen enkele
  dienst bewezen".
- Bezorgzones en tijdsloten (`kern/horeca/bezorglaag.js`) worden door de
  ledenbestelling niet geraadpleegd; de bezorgketen staat niet in `scripts/ketenvorm.js`.
- Een sluitingstijd na middernacht bestaat nergens.
- Uitklokken in de personeelsapp meldt nog niet de tafels die iemand draagt.

## b. Marktvergelijking

Alle regels: geraadpleegd 2026-10-19, (via zoektool, live te controleren).
Merken staan hier alleen ter vergelijking.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Lightspeed Restaurant [oud] | reserveringen, geavanceerde voorraad, multi-vestiging als add-on; KDS $30 per scherm | reserveren ja (`horeca.reserveren`); voorraad half; multi-vestiging half (Concern, geen vergelijkbeeld); KDS ja | https://www.lightspeedhq.com/pos/restaurant/pricing/ |
| Toast | losse modules: online bestellen, payroll, voorraad, roosters, loyaliteit; KDS extra; multi-locatie apart; inkoop via xtraCHEF | online bestellen ja; payroll ja (kantoor); roosters half; loyaliteit niet onderzocht; inkoopfacturen nee | https://pos.toasttab.com/shop/starter-kit, https://pos.toasttab.com/products/multi-location-management, https://pos.toasttab.com/products/xtrachef |
| Square for Restaurants | Plus $60 per vestiging: KDS, dagafsluiting, auto-uitverkocht, live omzet | KDS ja; dagafsluiting ja (kasopmaak, omzetdag); uitverkocht ja; live omzet ja | https://squareup.com/us/en/point-of-sale/restaurants/pricing |
| Oracle Simphony (duurste, offerte) | multi-property, centraal menu- en prijsbeheer; voorraad en Labor als aparte cloudservices; HACCP via partner (SynergySuite) | multi-property half; centraal menu over vestigingen nee; eigen HACCP ja | https://www.oracle.com/food-beverage/restaurant-pos-systems/simphony-pos/, https://marketplace.oracle.com/listings/57783807 |

Conclusie uit `markt-enterprise.txt`: grote spelers hebben geen eigen
HACCP-module. Wij wel, en die is strenger (actie verplicht, correctie zonder
gladstrijken). Waar wij achterlopen: centraal menu over vestigingen, een
vestigingsvergelijking, en inkoop met leveranciersprestaties.

## c. Analyse van het volledige domein

**Particulier.** De gast: bestellen, allergie melden, splitsen, betalen. Hij moet
vóór aankoop de 14 allergenen kunnen weten (EU 1169/2011; mondeling mag met
zichtbare melding, daarnaast schriftelijk of elektronisch vastgelegd voor
personeel en inspecteur). Bron: https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/allergenen.
Verkoop van alcohol pas vanaf 18 jaar, met leeftijdscontrole; online bij
bestellen en bij afleveren. Bron: https://ondernemersplein.kvk.nl/alcohol-verkopen/.

**Professioneel (de medewerker).** Werken volgens HACCP of de hygiënecode is
verplicht. NVWA-normen: koel tot 7 °C, warm houden vanaf 60 °C, terugkoelen
binnen 5 uur naar 7 °C, opwarmen tot 60 °C.
Bron: https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/schoon-en-veilig.
KHN-registratieformulieren minstens 6 maanden bewaren, ongekoelde presentatie 1 jaar.
Bron: https://khn.nl/veelgestelde-vragen/hoe-lang-moet-ik-de-formulieren-van-de-hygienecode-voor-de-horeca-bewaren.
Arbeidstijdenwet: maximaal 12 uur per dienst, 60 per week; 11 uur dagelijkse rust
(eens per 7 dagen 8); nachtdienst maximaal 10 uur, na 3 nachten 46 uur rust;
registratieplicht van arbeids- en rusttijden, 52 weken bewaren.
Bronnen: https://www.rijksoverheid.nl/vraag-en-antwoord/werktijden/wettelijke-regels-werktijden-en-rusttijden,
https://www.nlarbeidsinspectie.nl/nederlandse-arbeidsinspectie/sancties-en-handhavingsmethoden/boete/boetes-atw.
Oproepkrachten: oproep minstens 4 dagen vooraf (bij cao minimaal 24 uur).
Bron: https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/welke-contracten-zijn-er-voor-oproepkrachten.

**Organisatie (de zaak en de groep).** Alcoholvergunning van de gemeente;
leidinggevenden 21+, met Verklaring Sociale Hygiëne en registratie in het
Register Sociale Hygiëne; elke leidinggevende staat op de vergunning.
Bronnen: https://ondernemersplein.kvk.nl/alcohol-verkopen/, https://khn.nl/kennis/alcoholwet.
Exploitatievergunning: https://ondernemersplein.kvk.nl/exploitatievergunning-horecabedrijf-aanvragen.
Cao Horeca: rooster minstens 3 weken vooraf bekend; later ingeroosterde uren mag
de medewerker weigeren; de cao loopt tot 31-12-2026; toeslagen te controleren in
de cao-tekst. Bron: https://khn.nl/kennis/roosterprogramma-en-handleiding-2026.
Fiscale bewaarplicht 7 jaar (art. 52 AWR). De regel over contante betalingen staat op
de lijst "te controleren" (workos.md par. 11).
Inkoop: betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken (art. 6:119a BW).
Leveranciersbeoordeling heeft geen wettelijke basis; normatief ISO 9001 8.4.

**Wat dat betekent voor software.**

- Een HACCP-registratie is bewijs voor de inspecteur: append-only, met wie,
  wanneer, actie, en een bewaartermijn van minstens 6 maanden (1 jaar voor
  ongekoelde presentatie). Afkappen op aantal is geen bewaarbeleid.
- Allergeneninformatie moet per gerecht volledig zijn (14 soorten) en vóór
  aankoop zichtbaar; de bron is beheerde receptdata, nooit een model.
- De vergunning is een objectieve lijst namen; wie dienst heeft als
  leidinggevende moet erop staan. RTG kan dat tonen, niet keuren: de gemeente
  verleent, RTG dient niets in (voorbehouden).
- Een rooster heeft een publicatiemoment en een horizon (3 weken), en een
  ATW-toets vóór publicatie.
- Een zaak met meerdere vestigingen wil één kaart, één HACCP-sjabloon en een
  vergelijking zonder ranglijst op mensen.

## d. Functiecatalogus L1-L6

### L1 Persoonlijk (de medewerker op zijn eigen toestel)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| PDA-werklijst "mijn volgende handeling" | bestaat, `kern/horeca/werklijst.js`, `horeca-pda.html` | rekeningen, gangen, wijk | geordend op minuten over een vastgelegde grens | geen | medewerker direct | eigen wijk; geleende tafels zichtbaar | offline: wachtrij op `clientId` | de bediening ziet bovenaan wat nu moet, ook na een herstart | - | bestaat |
| Mijn HACCP-taken vandaag | half: logboek kent `gemistVandaag`, geen persoonlijke taak | `haccp.punten`, `afgevinkt`, rooster (Team Room) | punt zonder meting vandaag = open taak; toegewezen aan wie dienst heeft op die post | wie meet is niet vastgelegd per punt | medewerker bij start dienst; manager om 14:00 bij gat | staff ziet eigen taken, manager alles | gesloten dag: geen taak | wie de opening doet ziet zijn drie metingen en vinkt ze één voor één af | klein | aanbevolen nu |
| Allergiekaart bij de regel | bestaat, veld `allergie` per regel; `safety.js` vraagt dubbelcheck | regel, kaart | allergie -> menselijke check vóór uitserveren | kaartdata kan onvolledig zijn | pas en bediening bij uitgifte | iedereen in dienst | geen | geen bon met allergie gaat uit zonder bevestiging | - | bestaat |
| Eigen kloktijden en klokstand | bestaat bij Team Room (`personeelzicht.js`) | klokboek `kern/personeel.js` | zelf en manager zien tijdstip | geen | medewerker | eigenaar Team Room | - | - | - | eigenaar Team Room |

### L2 Professioneel (de vakman: kok, barman, maître)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Allergenenmatrix volgens 14 EU-soorten | half: `menukaart.js` neemt vrije tekst, kapt af op 12; vaste lijst bestaat in `tafelwensen.js` | kaart, recepten (`kern/keuken.js`), opties | elke allergeen uit de vaste lijst van 14; per gerecht "bevat", "kan sporen bevatten", "vrij", of "niet vastgelegd"; opties tellen mee | receptdata door mensen ingevoerd: klasse `advies` tot een mens per gerecht aftekent | chef bij wijziging; gast vóór aankoop | chef of manager tekent af; AI mag een concept geven, nooit vastleggen | gerecht zonder recept: "niet vastgelegd", nooit "vrij" | een gerecht met 13 allergenen toont ze alle 13; een onbekend woord wordt geweigerd met de lijst erbij | klein | aanbevolen nu |
| HACCP-meetpunt met NVWA-voorinstelling | half: punt met vrije min/max | `haccp.punten` | sjablonen koeling max 7, warmhoud min 60, terugkoelen 5 uur naar 7 | eigen grenzen strenger mag, ruimer vraagt reden | manager bij aanmaken | grens wijzigen alleen manager, met spoor | vriezer, afwas: eigen sjabloon | een koeling krijgt standaard 7 °C als bovengrens; een grens van 9 °C vraagt een reden en blijft in de historie | klein | aanbevolen nu |
| Terugkoelklok (5 uur) | ontbreekt | batch met starttijd | start bij kooktijd; meting na 5 uur moet 7 °C of lager zijn | starttijd door mens ingevoerd | kok bij start; signaal na 4,5 uur | kok | partij weggegooid: klok stopt met reden | een terugkoelpartij zonder eindmeting staat na 5 uur als open afwijking | middel | later |
| Bereidingsstappen per gerecht | half: `stappen.js`, één norm per gerecht (HORECA.md) | recept, station | stappen met eigen station en tijd | normtijden zijn schattingen | station bij vrijgave gang | chef beheert | - | de grill ziet zijn stap pas als de koude stap klaar is | middel | later |
| Runnerrol | half: claim staat (`pas.js`), rol niet | pas, wijk | claim per gang; rol wijst toe | geen | runner bij gereed | manager wijst rol | - | een gang is van één runner, zichtbaar voor de pas | middel | later |

### L3 Organisatorisch (zaak en groep)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Vergunningsregister leidinggevenden (Alcoholwet) | ontbreekt | vergunning als stuk (RTDocs), namen op de vergunning, VSH-bewijs via `kern/vakbewijs.js`, rooster (Team Room) | dienst met rol leidinggevende: staat de persoon op de vergunning en is zijn VSH-stuk afgetekend door RTG? Ja, nee of "niet vastgelegd" | RTG valideert niets inhoudelijk; een stuk is geen bewijs tot een mens van RTG aftekent | manager bij het rooster maken; signaal als een dienst geen leidinggevende op de vergunning heeft | VSH-nummer in de kluis (`member_state`), niet bij de zaak | gemeente verleent; RTG dient niets in (voorbehouden) | een avond waarop niemand van de vergunning dienst heeft, staat rood in het rooster met de reden | middel | aanbevolen nu |
| HACCP-bewaartermijn | ontbreekt: metingen afgekapt op 20.000, lijsten op 5.000; horeca niet in `server/bewaarbeleid.js` | `haccp.metingen`, `afgevinkt` | termijn 6 maanden (KHN), ongekoelde presentatie 1 jaar; daarna rapport via `bewaarveger.js` (standaard niets wissen) | duur per formulier volgens KHN, te controleren per formulier | eigenaar bij het veegrapport | eigenaar | juridische bewaring gaat voor | geen meting jonger dan 6 maanden verdwijnt, ook niet bij een drukke zaak | klein | aanbevolen nu |
| Inspectie-export | half: logboek per periode bestaat | metingen, afwijkingen met actie, lijsten, batches | één export per periode, met correcties zichtbaar | geen | manager bij inspectie | manager | - | de manager geeft de inspecteur in één keer zes maanden logboek met elke correctie erin | klein | aanbevolen nu |
| Roosterpublicatie 3 weken vooraf (cao) | ontbreekt: `roosterVoorstel` (`kern/agent.js`) plant 7 dagen vanaf vandaag | rooster (Team Room), `kern/vrijheid/beleid.js` | publicatiedatum op het rooster; uren later dan 21 dagen vooraf gemarkeerd als "mag geweigerd worden" | cao loopt tot 31-12-2026; vervolg te controleren | medewerker bij publicatie; bij latere wijziging met keuze accepteren of weigeren | manager publiceert; eigenaar Team Room | oproepkracht: 4 dagen (WAB), cao minimaal 24 uur | een dienst die 10 dagen vooraf wordt toegevoegd, kan de medewerker met één tik weigeren zonder gevolg | middel | aanbevolen nu, bij Team Room |
| ATW-toets vóór vaststellen rooster | half: rust in `kern/vrijheid/rust.js`, ATW alleen in taxi (`kern/mobiliteit/cdt-tijden.js`) | rooster, klokboek | 12 uur per dienst, 60 per week, 11 uur rust, nachtregels | waarden uit beleid; zonder vastgestelde waarde "onbekend" | manager vóór vaststellen | eigenaar Team Room | jeugdigen eigen regels (niet in domein-max: te controleren) | een rooster met 9 uur rust tussen sluiting en opening wordt niet stil vastgesteld | middel | later (besluit ATW-laag) |
| Inkooporder met goedkeuringsgrens | half: `/api/supplier/inkoop/*` zonder managergrens | groothandelorders | orders boven een zaakgrens vragen een manager | geen | manager bij grensoverschrijding | staff mag voorstellen, manager plaatst boven grens | spoedlevering met reden | een medewerker kan een bijbestelling van 80 euro plaatsen; 800 euro gaat naar de manager | klein | aanbevolen nu |
| Leveranciersprestaties | ontbreekt (`bedrijf/uitval.js`: "een leverancier bestaat hier niet") | levering in `kern/keuken.js`, batches met leverancier en ontvangstdatum, HACCP-ontvangstmeting | per leverancier: te laat, onvolledig, buiten temperatuur, als telling met noemer; geen score | ontvangst wordt niet altijd gemeten: "niet gemeten" | manager maandelijks | manager | - | de manager ziet "3 van 14 leveringen buiten 7 °C" met de leveringen erbij, geen cijfer | middel | later |
| Vestigingsvergelijking | ontbreekt; vestigingen staan in `kern/concern/` | omzetdag, afwijkingen, gemiste metingen per vestiging | tellingen met noemer per vestiging, nooit per medewerker | lege dag geeft "niet gemeten" | concernmanager wekelijks | eigenaar `werk.concern`; scope per vestiging (`kern/concern/scope.js`) | - | twee vestigingen staan naast elkaar met gemiste HACCP-dagen, zonder rangorde op mensen | middel | later, eigenaar Concern |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Dienstmeting met soort per regel | bestaat, `kern/horeca/dienstmeting.js` | rekeningen, standen | gemeten / uit het model / niet gemeten; geen totaalcijfer | 8 van 12 niet gemeten | manager na de dienst | manager | lege avond: geen nullen | - | - | bestaat |
| Drukterem met rekensom | bestaat, `openWerk()` in `keukenlaag.js` | openstaande minuten, koks | minuten gedeeld door koks | normtijden | chef | chef beslist | - | - | - | bestaat |
| Personeelsscenario horeca | half: `kern/fiscaal/scenario.js` (`/api/supplier/scenario/personeel`) zonder schermaanroeper | omzetdag, rooster, loonkosten uit Payroll OS | doorrekening met lijsten aannames en onbekend; klasse `advies` | voorspelling is nooit een feit | manager op verzoek | manager; klaarzetten mag, doorvoeren is een mensbesluit (`kern/stuur.js`) | - | de manager ziet wat een extra kok op vrijdag kost, met de aannames, en er verandert niets tot hij bevestigt | klein | aanbevolen nu |
| Bijbestelvoorstel | bestaat, `ghBijbestelVoorstel` en `bestel-advies` | verkoop, mise-en-place, voorraad | aanvullen tot twee keer minimum | verkoop is geen vraag | inkoper | menselijke bevestiging | - | - | - | bestaat |
| HACCP-trend per meetpunt | ontbreekt | metingen | aantal afwijkingen per punt per week, met noemer | apparaat of meetfout niet te onderscheiden | manager wekelijks | manager | - | "koeling 2: 4 van 14 metingen boven 7 °C" staat bovenaan, met de metingen | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Opening van een zaak: menu, HACCP, vergunning | half: `kern/onderneming/oprichting.js` noemt alcoholvergunning; "eersteklant" vraagt een menu | Onderneming, kaart, haccp | klaar = menu, minstens één meetpunt per koeling, vergunning als stuk | stuk is geen bewijs | eigenaar bij oprichting | eigenaar `werk.onderneming` | zaak zonder alcohol: geen VSH-eis | een nieuwe zaak ziet welke drie dingen nog ontbreken voor de eerste dienst | klein | aanbevolen nu |
| Exploitatiefase als stand | ontbreekt (feiten-code: "een exploitatiefase als aparte stand ontbreekt") | `fase.js` | afgeleid, nooit met de hand | - | - | eigenaar Onderneming | - | - | middel | later, eigenaar Onderneming |
| Sluiting of overname | half: `deactivateStaffVanZaak`, `kern/tenant/uitgang.js` | alles van de zaak | HACCP en kasdata blijven tot het einde van hun termijn | - | eigenaar | eigenaar | - | na sluiting staat het HACCP-logboek nog 6 maanden leesbaar voor de eigenaar | middel | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fooi naar workforce-laag | bestaat | betaling | fooi naar de verdeling | - | medewerker | - | - | - | - | bestaat |
| Hotelfolio | bestaat, betaalwijze `kamer`, `kern/horeca/foliolaag.js` | rekening | rekening naar folio | - | hotel | - | - | - | - | bestaat |
| Uitklokken meldt gedragen tafels | ontbreekt (HORECA.md: "de koppeling in de andere richting") | `klokVan` in `kern/personeel.js`, wijk-leen | bij uitklokken: aantal open tafels op zijn naam | - | medewerker bij uitklokken | eigenaar Team Room levert het scherm, horeca de telling | - | wie uitklokt met twee open tafels krijgt dat te zien vóór hij weg is | klein | aanbevolen nu |
| Klokuren naar de loonrun | half: loonrun leest uren, horeca-klok is Team Room | klokboek | eigenaar Payroll OS | - | - | kantoor + zaak | - | - | - | eigenaar Payroll OS |
| Gastallergie vanuit tafelwensen | bestaat, `kern/tafeldek.js`, `tafelwensen.js` | gastprofiel op codenaam | gast geeft op, zaak ziet op de bon | - | bediening | gast deelt | - | - | - | bestaat |

**Modus LOS.** Als Team Room, Payroll OS, Concern en Onderneming uit staan, blijft
de kerntaak: een tafel bedienen van openen tot afrekenen, keuken en pas regisseren,
HACCP registreren, offline doorwerken. Het scherm zegt dan eerlijk: "Rooster en
klok komen uit Team Room; die staat uit, dus wie er dienst heeft is hier niet
bekend" en toont bij HACCP-taken "toegewezen: niet vastgelegd". Het
vergunningsregister zegt "geen rooster gekoppeld; controle op leidinggevenden niet mogelijk".

**Modus SAMEN.** Keten "vrijdagavond met allergie en een uitvaller".

1. 16:00 De manager opent `horeca-beheer`. Team Room levert het rooster; het
   vergunningsregister toont dat leidinggevende B op de vergunning staat met
   afgetekend VSH-stuk. *Storing: Team Room niet bereikbaar.* Zichtbaar: "rooster
   niet geladen, controle leidinggevende open". Bewaard: niets verandert; de
   dienst kan door.
2. 16:30 De kok meet koeling 1: 8 °C. De route weigert zonder actie; hij noteert
   "deur stond open, na 30 min 5 °C". *Storing: netwerk weg.* Zichtbaar: de
   meting staat in de wachtrij van het toestel. Bewaard: de meting met
   `clientId`; bij terugkeer precies één keer (zelfde vorm als `offline/sync`;
   voor HACCP nog te bouwen, dus vandaag: de meting gaat verloren en het scherm
   moet dat zeggen).
3. 19:10 Tafel 12 opent; stoel 2 meldt notenallergie. De regel draagt `allergie`;
   de kaart toont voor het gerecht "bevat: noten". De bediening krijgt een
   waarschuwing; de pas vraagt dubbelcheck (`safety.js`). *Storing: het gerecht
   heeft geen vastgelegde allergenen.* Zichtbaar: "allergenen niet vastgelegd,
   vraag de chef". Bewaard: de bon met de allergievraag; niets wordt als "vrij" getoond.
4. 21:00 Kok C meldt zich ziek in Team Room. De horeca-app ziet alleen
   "afwezig" (`personeelzicht.js`). De manager vraagt het personeelsscenario: wat
   kost een invaller; klasse `advies`. *Storing: scenario-engine faalt.*
   Zichtbaar: "doorrekening niet beschikbaar". Bewaard: niets; er is niets doorgevoerd.
5. 23:40 Afrekenen; tafel 12 splitst op stoel. Omzetdag loopt tot 05:00.
   *Storing: crash na betaling.* Zichtbaar na herstart: rekening betaald, één keer
   (voltooiproef herstelbaar). Bewaard: betaling en bon.
6. 00:30 Kasopmaak; dezelfde dag als 23:30 (`test/omzetdag.test.js`). De klokuren
   gaan via Team Room naar de loonrun van Payroll OS; de loonstrook leest de
   medewerker in `loon.strook`.

## e. RTG-exclusieve mogelijkheden

| Mogelijkheid | Eigenaar | Capability | Waarom geen markt-app dit kan |
|---|---|---|---|
| Rooster dat weet of de leidinggevende op de vergunning staat, met VSH-stuk dat een mens van RTG aftekende en een nummer in de kluis | Team Room (rooster), horeca (signaal) | `zaak.teamroom`, `kern/vakbewijs.js`, `kern/persoonseis.js` | een kassa kent de vergunning niet en een roosterapp kent de identiteitskluis niet |
| Allergie van de gast (codenaam, tafelwensen) tot op de bon en de pas, met harde menselijke check | horeca | `horeca.tafelgast`, `safety.js` | de gast en de zaak zitten in hetzelfde huis; de gast deelt alleen de allergie, nooit zijn naam |
| Kok op de loonstrook ziet dezelfde uren als het klokboek, met dossier "wie keurde" | Payroll OS / `loon.strook` | `kern/payroll/dossier.js` | loon en horeca zijn één systeem met vier ogen |
| Dienst eindigt met open tafels: overdracht naar collega met spoor | horeca | `wijk-leen.js`, `klokVan` | klok en vloer delen één personeelsdomein |
| Ex-medewerker houdt zijn ervaring als feit in zijn loopbaanledger, bevestigd door de zaak | Loopbaan | `loopbaan.ledger`, `/api/supplier/carriere/bevestig` | het ledger hoort bij de mens, niet bij de werkgever |

## f. Bouwstenen en ontbrekende koppelingen

**Bestaande modules om op te bouwen.**
`server/routes/supplier/horeca/haccp.js`, `haccp-lijsten.js`,
`server/kern/tafelwensen.js` (14 allergenen), `server/routes/supplier/menukaart.js`,
`server/kern/keuken.js`, `server/kern/groothandel.js`, `server/kern/vakbewijs.js`,
`server/kern/persoonseis.js`, `server/kern/vrijheid/rust.js`, `server/kern/vrijheid/beleid.js`,
`server/kern/agent.js` (roostervoorstel), `server/kern/fiscaal/scenario.js`,
`server/kern/fiscaal/zekerheid.js`, `server/kern/stuur.js`, `server/bewaarbeleid.js`,
`server/bewaarveger.js`, `server/kern/concern/vestiging.js`, `server/kern/concern/scope.js`,
`server/kern/horeca/dienstmeting.js`, `server/kern/leverancier/personeelzicht.js`.

**Ontbrekende koppelingen.**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| `menukaart.js` (allergens) | `tafelwensen.ALLERGENEN` | verwijzing: validatie tegen de vaste lijst | chef of manager |
| horeca `haccp` | `bewaarbeleid.js` | regel in de bewaartabel | eigenaar zet de veger aan |
| rooster (Team Room) | vergunningsregister | projectie: dienst x vergunningnamen x vakbewijs | manager leest; nummer blijft in de kluis |
| `roosterVoorstel` | `kern/vrijheid/rust.js` en ATW-waarden | aanroep vóór vaststellen | manager |
| uitklokken (Team Room) | `wijk-leen.js` | gebeurtenis bij uitklok | medewerker zelf, manager |
| `scenario/personeel` | `horeca-beheer.html` | schermaanroep | manager |
| HACCP-meting offline | `offline/sync`-vorm | wachtrij met `clientId` | staff |

## g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Allergenen valideren tegen 14 EU-soorten, geen afkap op 12 | klein | laag | `tafelwensen.js` | aanbevolen nu |
| HACCP in de bewaartabel (6 maanden / 1 jaar) | klein | laag | `bewaarbeleid.js` | aanbevolen nu |
| Meetpuntgrens alleen door manager, met historie | klein | laag | `haccp.js` | aanbevolen nu |
| Inkooporder met managergrens | klein | laag | `groothandel.js` route | aanbevolen nu |
| Vergunningsregister leidinggevenden in het rooster | middel | middel | Team Room, `vakbewijs.js`, besluit | aanbevolen nu |
| Uitklokken meldt gedragen tafels | klein | laag | Team Room | aanbevolen nu |
| Personeelsscenario op `horeca-beheer` | klein | laag | `scenario.js` | aanbevolen nu |
| Inspectie-export per periode | klein | laag | logboek | aanbevolen nu |
| Roosterpublicatie 3 weken vooraf | middel | middel | Team Room, besluit | later (eigenaar Team Room) |
| ATW-toets in het horecarooster | middel | middel | besluit ATW-laag (PLANNING.md) | later |
| Terugkoelklok, HACCP-trend | middel | middel | - | later |
| Leveranciersprestaties | middel | middel | besluit leveranciersobject | later |
| Vestigingsvergelijking | middel | middel | Concern | later |
| Centraal menu over vestigingen | groot | hoog | Concern, kaartmodel | later |
| AI die allergenen vaststelt | - | - | - | niet doen: grens 1 HORECA.md |
| Ranglijst bediening op omzet of tempo | - | - | - | niet doen: grens 3 HORECA.md |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | tafel, bar, keuken, bezorging, hotel, club, event en HACCP draaien op één rekening | `scripts/tafelproef.js`, `scripts/bezorgproef.js`, plus ketenproef club en hotel | tafel en bezorging gemeten; club en hotel niet |
| Professionele diepte | elk gerecht draagt 14 allergenen of "niet vastgelegd"; elk HACCP-punt een grens met historie | nieuwe toets in `test/` op `menukaart.js` en `haccp.js` | half: afkap op 12, grens overschrijfbaar |
| Levenscyclus | opening, exploitatie en sluiting houden HACCP en kas leesbaar binnen termijn | veegrapport van `bewaarveger.js` toont horeca met termijn | ontbreekt: horeca niet in de bewaartabel |
| Samenwerking en rollen | grens, inkoop boven grens en vergunning zijn managerwerk; collega's zien geen kloktijden | `test/personeelzicht-routes.test.js` plus BEVOEGD-ronde op inkoop en haccp | personeelszicht bewezen; inkoop en meetpunt niet |
| Domeinintelligentie | elke voorspelling draagt klasse en aannames; geen score op mensen | `test/horeca-dienstmeting.test.js`, `test/horeca-journey.test.js` | bestaat |
| Los functioneren | zonder Team Room werkt de tafel; het scherm zegt wat ontbreekt | voltooiproef met Team Room uit | niet gemeten |
| RTG-ketens | klokuur naar loonstrook, allergie gast naar pas | ketenproef klok -> loonrun -> `loon.strook` | niet gemeten |
| Bewezen betrouwbaarheid | acht bewijzen centraal gestempeld | APPWERKT.json | 3 BEWEZEN, 4 lokaal gesloten, bevoegd NIET_GETEST |

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

| Functie | Kosten | Bouwt op |
|---|---|---|
| Allergenen valideren tegen de 14 EU-soorten, met "niet vastgelegd" | klein | `server/kern/tafelwensen.js`, `server/routes/supplier/menukaart.js` |
| HACCP-termijn in de bewaartabel | klein | `server/bewaarbeleid.js`, `server/bewaarveger.js` |
| Meetpuntgrens alleen door de manager, met historie | klein | `server/routes/supplier/horeca/haccp.js` |
| NVWA-sjablonen voor meetpunten | klein | idem |
| Inspectie-export per periode | klein | het HACCP-logboek |
| Inkoop met managergrens | klein | `server/routes/supplier/groothandel.js` |
| Mijn HACCP-taken vandaag | klein | `gemistVandaag`, rooster van Team Room |
| Uitklokken meldt gedragen tafels | klein | `klokVan`, `server/kern/horeca/wijk-leen.js` |
| Personeelsscenario op het beheerscherm | klein | `server/kern/fiscaal/scenario.js`, `server/kern/stuur.js` |
| Vergunningsregister leidinggevenden (na besluit 1) | middel | `server/kern/vakbewijs.js`, `server/kern/persoonseis.js`, Team Room |
| Later: terugkoelklok, HACCP-trend, bereidingsstappen, runnerrol, vestigingsvergelijking, leveranciersprestaties als tellingen | middel | `stappen.js`, `pas.js`, `server/kern/concern/`, `server/kern/keuken.js` |

### (B) Het domeinmaximum, ook buiten de scope (richting, geen toezegging)

**Proces 1. Van horecaplan tot eerste dienst.**
- Stappen: concept en locatie, ondernemingsplan, rechtsvorm en KvK, exploitatie-
  en alcoholvergunning aanvragen bij de gemeente, VSH van de leidinggevenden,
  menu met allergenenmatrix, HACCP-plan met meetpunten, personeel werven,
  contracten en loonadministratie, proefdienst, opening.
- Rollen: ondernemer, leidinggevenden, gemeente, KvK, Register Sociale Hygiëne,
  NVWA (toezicht), KHN (hygiënecode), boekhouder.
- RTG-apps: Onderneming (`werk.onderneming`, eigenaar van het traject), Horeca
  (menu, HACCP), Team Room (werving en rooster), Payroll OS (`kantoor.payroll`),
  RTDocs (`docs.bestanden`, stukken), Geld (financiële gevolgen).
- Buiten de scope: een koppeling met gemeentelijke vergunningloketten en met
  het Register Sociale Hygiëne (extern; RTG dient niets in, dat blijft
  voorbehouden), en het besluit of RTG een vergunningsdossier per zaak bijhoudt.

**Proces 2. De dagelijkse exploitatie, gesloten van inkoop tot afrekening.**
- Stappen: inkoop bij de leverancier, ontvangst met temperatuurmeting, opslag
  met batch en THT, bereiding volgens recept, uitgifte met allergiecheck,
  verkoop, kasopmaak, voorraadtelling, derving, betaling aan de leverancier
  binnen de termijn.
- Rollen: inkoper, kok, chef, bediening, manager, leverancier, groothandel.
- RTG-apps: Horeca (eigenaar van de dienst), `handel.inkoop`, `handel.kassa`,
  Onderneming (crediteuren), Geld.
- Buiten de scope: een leveranciersobject met prestaties en inkoopfacturen
  buiten de groothandel (nieuw domein: besluit), en koppelingen met externe
  groothandels en elektronische facturen.

**Proces 3. Een horecagroep met meerdere vestigingen.**
- Stappen: entiteiten en vestigingen inrichten, centraal menu en prijsbeheer,
  één HACCP-sjabloon voor de groep, vergelijking per vestiging zonder ranglijst
  op mensen, uitwisseling van personeel tussen vestigingen, geconsolideerde cijfers.
- Rollen: concerndirectie, vestigingsmanager, chef, controller.
- RTG-apps: Concern (`werk.concern`, eigenaar), Horeca, Team Room, Payroll OS, Geld.
- Buiten de scope: een centraal kaartmodel over vestigingen (groot), en een
  besluit over de uitwisseling van personeel binnen de groep (employment is waarheid, ARBEID.md par. 7a).

**Proces 4. Inspectie en incident.**
- Stappen: NVWA-bezoek of klacht, logboek en lijsten over een periode leveren,
  bij een allergie-incident de keten reconstrueren (gerecht, recept, batch,
  bon, wie uitgaf), corrigerende maatregel, nacontrole.
- Rollen: inspecteur, manager, chef, gast (op codenaam).
- RTG-apps: Horeca (eigenaar), Service (`service.hulp`), RTDocs.
- Buiten de scope: een generiek incident- en CAPA-object voor alle genres
  (feiten-dwars thema 3: ontbreekt; besluit).

## Vraagt besluit

1. **Wie bezit het vergunningsregister leidinggevenden?**
   - **A (aanbevolen): Team Room (`zaak.teamroom`)**, horeca leest alleen het signaal. Kost: middel; één eigenaar voor rooster en mensen.
   - B: horeca, als `horeca.beheer`. Kost: middel; maar dan kent horeca personeelsstukken, een tweede plek naast `persoonseis.js`.
   - C: Onderneming (vergunning hoort bij de zaak). Kost: middel; Onderneming kent geen rooster.
2. **Mag elke medewerker inkopen bij de groothandel?**
   - **A (aanbevolen): ja tot een zaakgrens, daarboven de manager.** Kost: klein.
   - B: alleen de manager. Kost: klein; remt de keuken bij spoed.
   - C: zo laten. Kost: nul; financieel risico zonder tweede paar ogen.
3. **ATW en cao-horizon in het horecarooster.**
   - **A (aanbevolen): wachten op het besluit "ATW-laag losgemaakt uit taxi" (PLANNING.md) en dan Team Room laten lezen.** Kost: middel, later.
   - B: nu een horeca-eigen ATW-toets. Kost: middel; de achtste planner, botst met "geen nieuwe motor".
4. **Leveranciersprestaties.**
   - **A (aanbevolen): later, als tellingen met noemer op bestaande leveringen en batches, geen leveranciersobject.** Kost: middel.
   - B: een leveranciersobject voor alle genres. Kost: groot; nieuw domein, buiten de bouwscope.
