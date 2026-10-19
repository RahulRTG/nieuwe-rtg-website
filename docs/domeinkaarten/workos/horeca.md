# Horeca (link:horeca)

**Volledige werkzaamheid:** de app doet volledig waarvoor ze er is als een zaak
met haar eigen bediening, keuken en manager een tafel van openen tot afrekenen
en kasopmaak bedient, met de allergie van de gast tot op de pas bevestigd, met
elke HACCP-meting van die dienst vastgelegd met wie, wanneer en actie, en met
een offline opgenomen bestelling die precies één keer binnenkomt. Toets: de
voltooiproef `scripts/lib/voltooi/horeca.js` sluit, `scripts/tafelproef.js`
sluit, en het logboek van die dag geeft per meetpunt een meting of "gemist".

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
  sinds cc7510f genormaliseerd tegen de veertien namen in `server/kern/horeca/allergenen.js`
  (met synoniemen; een onbekende term weigert de kaart en de oude kaart blijft staan);
  per regel een eigen veld `allergie` (`kern/horeca/regel.js`); een tweede vaste
  lijst van dezelfde veertien in `server/kern/tafelwensen.js` (gastwensen).
- HACCP-meetpuntgrens: sinds 4002318 alleen door de manager (`managerOnly`), en
  een gewijzigde grens schuift de oude met van, tot en door in `punt.historie`.
- Inkoop: sinds 605ab79 zijn `/api/supplier/inkoop/bestel`, `/annuleer` en
  `/ai-bevestig` managerwerk; markt, mijn en het AI-voorstel maken blijven voor de hele zaak.
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
Merken staan hier alleen ter vergelijking. Elke regel in deze tabel is
**(te controleren)**: hij komt uit een zoeksamenvatting, geen pagina is zelf
geopend. Niets hieruit wordt een weigerregel of een eis in h.

| Leider | Achter de betaalmuur | Wij | Bron |
|---|---|---|---|
| Lightspeed Restaurant [oud] | reserveringen, geavanceerde voorraad, multi-vestiging als add-on; KDS $30 per scherm | reserveren ja (`horeca.reserveren`); voorraad half; multi-vestiging half (Concern, geen vergelijkbeeld); KDS ja | https://www.lightspeedhq.com/pos/restaurant/pricing/ (te controleren) |
| Toast | losse modules: online bestellen, payroll, voorraad, roosters, loyaliteit; KDS extra; multi-locatie apart; inkoop via xtraCHEF | online bestellen ja; payroll ja (kantoor); roosters half; loyaliteit niet onderzocht; inkoopfacturen nee | https://pos.toasttab.com/shop/starter-kit, https://pos.toasttab.com/products/multi-location-management, https://pos.toasttab.com/products/xtrachef (te controleren) |
| Square for Restaurants | Plus $60 per vestiging: KDS, dagafsluiting, auto-uitverkocht, live omzet | KDS ja; dagafsluiting ja (kasopmaak, omzetdag); uitverkocht ja; live omzet ja | https://squareup.com/us/en/point-of-sale/restaurants/pricing (te controleren) |
| Oracle Simphony (duurste, offerte) | multi-property, centraal menu- en prijsbeheer; voorraad en Labor als aparte cloudservices; HACCP via partner (SynergySuite) | multi-property half; centraal menu over vestigingen nee; eigen HACCP ja | https://www.oracle.com/food-beverage/restaurant-pos-systems/simphony-pos/, https://marketplace.oracle.com/listings/57783807 (te controleren) |

Conclusie uit `markt-enterprise.txt`: grote spelers hebben geen eigen
HACCP-module. Wij wel, en die is strenger (actie verplicht, correctie zonder
gladstrijken). Waar wij achterlopen: centraal menu over vestigingen, een
vestigingsvergelijking, en inkoop met leveranciersprestaties.

## c. Analyse van het volledige domein

Geen van de wets- en normregels hieronder is in de primaire tekst nagelezen;
ze komen uit `domein-max.txt` (zoeksamenvattingen met bron-URL). Elke regel
draagt daarom het label **(te controleren)**. Zo'n regel wordt nergens een
harde weigerregel: in d. en h. staat hij hooguit als signaal "te controleren".
De contantregel staat niet in deze kaart (workos.md par. 11).

**Particulier.** De gast: bestellen, allergie melden, splitsen, betalen. Hij moet
vóór aankoop de 14 allergenen kunnen weten (EU 1169/2011; mondeling mag met
zichtbare melding, daarnaast schriftelijk of elektronisch vastgelegd voor
personeel en inspecteur) **(te controleren)**. Bron: https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/allergenen.
Verkoop van alcohol pas vanaf 18 jaar, met leeftijdscontrole; online bij
bestellen en bij afleveren **(te controleren)**. Bron: https://ondernemersplein.kvk.nl/alcohol-verkopen/.

**Professioneel (de medewerker).** Werken volgens HACCP of de hygiënecode is
verplicht **(te controleren)**. NVWA-normen: koel tot 7 °C, warm houden vanaf
60 °C, terugkoelen binnen 5 uur naar 7 °C, opwarmen tot 60 °C **(te controleren)**.
Bron: https://www.nvwa.nl/onderwerpen/voedselveiligheid/voedselveilig-werken-in-horeca-ambacht-en-retail/hoe-werk-ik-veilig/schoon-en-veilig.
KHN-registratieformulieren minstens 6 maanden bewaren, ongekoelde presentatie 1 jaar
**(te controleren)**.
Bron: https://khn.nl/veelgestelde-vragen/hoe-lang-moet-ik-de-formulieren-van-de-hygienecode-voor-de-horeca-bewaren.
Arbeidstijdenwet: maximaal 12 uur per dienst, 60 per week; 11 uur dagelijkse rust
(eens per 7 dagen 8); nachtdienst maximaal 10 uur, na 3 nachten 46 uur rust;
registratieplicht van arbeids- en rusttijden, 52 weken bewaren **(te controleren)**.
Bronnen: https://www.rijksoverheid.nl/vraag-en-antwoord/werktijden/wettelijke-regels-werktijden-en-rusttijden,
https://www.nlarbeidsinspectie.nl/nederlandse-arbeidsinspectie/sancties-en-handhavingsmethoden/boete/boetes-atw.
Oproepkrachten: oproep minstens 4 dagen vooraf (bij cao minimaal 24 uur) **(te controleren)**.
Bron: https://www.rijksoverheid.nl/onderwerpen/arbeidsovereenkomst-en-cao/vraag-en-antwoord/welke-contracten-zijn-er-voor-oproepkrachten.

**Organisatie (de zaak en de groep).** Alcoholvergunning van de gemeente;
leidinggevenden 21+, met Verklaring Sociale Hygiëne en registratie in het
Register Sociale Hygiëne; elke leidinggevende staat op de vergunning **(te controleren)**.
Bronnen: https://ondernemersplein.kvk.nl/alcohol-verkopen/, https://khn.nl/kennis/alcoholwet.
Exploitatievergunning **(te controleren)**: https://ondernemersplein.kvk.nl/exploitatievergunning-horecabedrijf-aanvragen.
Cao Horeca: rooster minstens 3 weken vooraf bekend; later ingeroosterde uren mag
de medewerker weigeren; de cao loopt tot 31-12-2026 **(te controleren)**; toeslagen
niet teruggevonden (workos.md par. 11). Bron: https://khn.nl/kennis/roosterprogramma-en-handleiding-2026.
Fiscale bewaarplicht 7 jaar (art. 52 AWR) **(te controleren)**.
Inkoop: betaaltermijn B2B maximaal 60 dagen, 30 als niets is afgesproken (art. 6:119a BW)
**(te controleren)**. Leveranciersbeoordeling heeft geen wettelijke basis; normatief
ISO 9001 8.4 (clausulenummer van de versie 2015, workos.md par. 11) **(te controleren)**.

**Wat dat betekent voor software.** Elke termijn en grens hieronder komt uit
een regel die nog te controleren is; de software toont hem als signaal met de
bron, en weigert er niets op.

- Een HACCP-registratie is bewijs voor de inspecteur: append-only, met wie,
  wanneer, actie, en een bewaartermijn van minstens 6 maanden (1 jaar voor
  ongekoelde presentatie; te controleren). Afkappen op aantal is geen
  bewaarbeleid. Een bewaarMINIMUM wist niets en weigert niets, dus het mag als
  ondergrens in de bewaartabel staan zodra een mens de KHN-pagina heeft nagelezen.
- Allergeneninformatie moet per gerecht volledig zijn (14 soorten) en vóór
  aankoop zichtbaar; de bron is beheerde receptdata, nooit een model. De lijst
  van veertien staat al in code; de weigering in `menukaart.js` gaat over een
  onbekend woord (gegevenskwaliteit), niet over een wetsartikel.
- De vergunning is een objectieve lijst namen; wie dienst heeft als
  leidinggevende moet erop staan. RTG kan dat tonen, niet keuren: de gemeente
  verleent, RTG dient niets in (voorbehouden).
- Een rooster heeft een publicatiemoment en een horizon (3 weken, te
  controleren), en een ATW-signaal vóór publicatie, geen ATW-weigering.
- Een zaak met meerdere vestigingen wil één kaart, één HACCP-sjabloon en een
  vergelijking zonder ranglijst op mensen.

## d. Functiecatalogus L1-L6

### L1 Persoonlijk (de medewerker op zijn eigen toestel)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| PDA-werklijst "mijn volgende handeling" | bestaat, `kern/horeca/werklijst.js`, `horeca-pda.html` | rekeningen, gangen, wijk | geordend op minuten over een vastgelegde grens | geen | medewerker direct | eigen wijk; geleende tafels zichtbaar | offline: wachtrij op `clientId` | de bediening ziet bovenaan wat nu moet, ook na een herstart | - | bestaat |
| Mijn HACCP-taken vandaag | half: logboek kent `gemistVandaag`, geen persoonlijke taak | `haccp.punten`, `afgevinkt`, rooster (Team Room) | punt zonder meting vandaag = open taak; toegewezen aan wie dienst heeft op die post | wie meet is niet vastgelegd per punt | medewerker bij start dienst; manager om 14:00 bij gat | staff ziet eigen taken, manager alles | gesloten dag: geen taak | wie de opening doet ziet zijn drie metingen en vinkt ze één voor één af | klein | verdieping nu |
| HACCP-meting zonder netwerk | ontbreekt, en het scherm zwijgt: `RTGHoreca.api` (`public/apps/horeca/kern.js`) heeft geen `catch` op een mislukte `fetch`, en `public/apps/horeca/haccp-meting.js` handelt alleen een antwoord af; zonder netwerk ziet de kok niets en is de meting weg (gelezen, niet beproefd) | `haccp.metingen` | eerst: een mislukte verzending zegt dat de meting NIET is vastgelegd; daarna: wachtrij op het toestel met `clientId`, precies één keer bij terugkeer (vorm van `offline/sync`) | tijdstip van de meting is het toestel, niet de server | kok direct | staff | correctie op een gesynchroniseerde meting: gewone correctieroute | een kok die zonder netwerk meet, ziet "Meting niet vastgelegd: geen verbinding. Noteer hem en voer hem opnieuw in." en geen stilte | klein (melding), middel (wachtrij) | herstel nu (melding); wachtrij verdieping later |
| Allergiekaart bij de regel | bestaat, veld `allergie` per regel; `safety.js` vraagt dubbelcheck | regel, kaart | allergie -> menselijke check vóór uitserveren | kaartdata kan onvolledig zijn | pas en bediening bij uitgifte | iedereen in dienst | geen | geen bon met allergie gaat uit zonder bevestiging | - | bestaat |
| Eigen kloktijden en klokstand | bestaat bij Team Room (`personeelzicht.js`) | klokboek `kern/personeel.js` | zelf en manager zien tijdstip | geen | medewerker | eigenaar Team Room | - | - | - | eigenaar Team Room |

### L2 Professioneel (de vakman: kok, barman, maître)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Allergenenmatrix volgens 14 EU-soorten | lijst bestaat: `kern/horeca/allergenen.js` normaliseert, geen afkap meer, onbekend woord 400 (cc7510f); het onderscheid "bevat / kan sporen bevatten / vrij / niet vastgelegd" ontbreekt: een lege lijst is niet te onderscheiden van "vrij" | kaart, recepten (`kern/keuken.js`), opties | elke allergeen uit de vaste lijst van 14; per gerecht een van vier standen; opties tellen mee | receptdata door mensen ingevoerd: klasse `advies` tot een mens per gerecht aftekent | chef bij wijziging; gast vóór aankoop | chef of manager tekent af; AI mag een concept geven, nooit vastleggen | gerecht zonder recept of zonder ingevulde lijst: "niet vastgelegd", nooit "vrij" | een gerecht met 14 allergenen toont ze alle 14 (gerepareerd); een gerecht zonder ingevulde lijst toont "niet vastgelegd" en niet niets (open) | klein | herstel: lijst gerepareerd (cc7510f); "niet vastgelegd" herstel nu |
| HACCP-meetpunt met NVWA-voorinstelling | grens alleen door de manager, oude grens in `punt.historie`: gerepareerd (4002318); sjablonen ontbreken, punt heeft vrije min/max | `haccp.punten` | sjablonen stellen voor: koeling max 7, warmhoud min 60 (NVWA, te controleren) | de normwaarden zijn niet in de primaire tekst nagelezen | manager bij aanmaken | grens wijzigen alleen manager, met spoor (bestaat) | vriezer, afwas: eigen sjabloon | een koeling krijgt 7 °C voorgesteld; een grens van 9 °C wordt opgeslagen met het zichtbare signaal "ruimer dan de NVWA-waarde (te controleren)" en blijft in de historie; niets wordt geweigerd | klein | rolgrens: gerepareerd (4002318); sjablonen verdieping nu |
| Terugkoelklok (5 uur) | ontbreekt | batch met starttijd | start bij kooktijd; signaal als na 5 uur geen meting van 7 °C of lager staat (NVWA, te controleren) | starttijd door mens ingevoerd | kok bij start; signaal na 4,5 uur | kok | partij weggegooid: klok stopt met reden | een terugkoelpartij zonder eindmeting staat na 5 uur als open signaal, niet als weigering | middel | later |
| Bereidingsstappen per gerecht | half: `stappen.js`, één norm per gerecht (HORECA.md) | recept, station | stappen met eigen station en tijd | normtijden zijn schattingen | station bij vrijgave gang | chef beheert | - | de grill ziet zijn stap pas als de koude stap klaar is | middel | later |
| Runnerrol | half: claim staat (`pas.js`), rol niet | pas, wijk | claim per gang; rol wijst toe | geen | runner bij gereed | manager wijst rol | - | een gang is van één runner, zichtbaar voor de pas | middel | later |

### L3 Organisatorisch (zaak en groep)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Vergunningsregister leidinggevenden (Alcoholwet, te controleren) | ontbreekt | vergunning als stuk (RTDocs), namen op de vergunning, VSH-bewijs via `kern/vakbewijs.js`, rooster (Team Room) | dienst met rol leidinggevende: staat de persoon op de vergunning en is zijn VSH-stuk afgetekend door RTG? Ja, nee of "niet vastgelegd" | RTG valideert niets inhoudelijk; een stuk is geen bewijs tot een mens van RTG aftekent; de eis zelf is te controleren | manager bij het rooster maken; signaal als een dienst geen leidinggevende op de vergunning heeft | VSH-nummer in de kluis (`member_state`), niet bij de zaak | gemeente verleent; RTG dient niets in (voorbehouden) | een avond waarop niemand van de vergunning dienst heeft, staat als signaal in het rooster met de reden; het rooster wordt niet geweigerd | middel | verdieping nu, na besluit 1 |
| HACCP-bewaartermijn | ontbreekt: metingen afgekapt op 20.000, lijsten op 5.000; de grenshistorie van 4002318 houdt hoogstens 50 wijzigingen; horeca niet in `server/bewaarbeleid.js` | `haccp.metingen`, `afgevinkt`, `punt.historie` | ondergrens 6 maanden, ongekoelde presentatie 1 jaar (KHN, te controleren); daarna rapport via `bewaarveger.js` (standaard niets wissen) | duur per formulier volgens KHN, te controleren per formulier | eigenaar bij het veegrapport | eigenaar | juridische bewaring gaat voor | geen meting en geen oude grens jonger dan 6 maanden verdwijnt, ook niet bij een drukke zaak | klein | herstel nu |
| Inspectie-export | half: logboek per periode bestaat | metingen, afwijkingen met actie, lijsten, batches, grenshistorie | één export per periode, met correcties en grenswijzigingen zichtbaar | geen | manager bij inspectie | manager | - | de manager geeft de inspecteur in één keer zes maanden logboek met elke correctie en elke grenswijziging erin | klein | verdieping nu |
| Roosterpublicatie 3 weken vooraf (cao, te controleren) | ontbreekt: `roosterVoorstel` (`kern/agent.js`) plant 7 dagen vanaf vandaag | rooster (Team Room), `kern/vrijheid/beleid.js` | publicatiedatum op het rooster; uren later dan 21 dagen vooraf ingeroosterd krijgen een markering met de bron | cao loopt tot 31-12-2026; de regel zelf te controleren | medewerker bij publicatie en bij latere wijziging | manager publiceert; eigenaar Team Room | oproepkracht: 4 dagen (WAB) en cao 24 uur, beide te controleren | een dienst die 10 dagen vooraf wordt toegevoegd, staat bij de medewerker gemarkeerd als "later dan 3 weken ingeroosterd"; een gevolg in code komt pas na nalezing | middel | later, bij Team Room |
| ATW-signaal vóór vaststellen rooster | half: rust in `kern/vrijheid/rust.js`, ATW alleen in taxi (`kern/mobiliteit/cdt-tijden.js`) | rooster, klokboek | 12 uur per dienst, 60 per week, 11 uur rust, nachtregels (te controleren) | waarden uit beleid; zonder vastgestelde waarde "onbekend" | manager vóór vaststellen | eigenaar Team Room | jeugdigen eigen regels (niet in domein-max: te controleren) | een rooster met 9 uur rust tussen sluiting en opening toont dat signaal vóór vaststellen; vaststellen blijft een mensbesluit | middel | later (besluit ATW-laag) |
| Inkooporder met goedkeuringsgrens | rolgrens gerepareerd (605ab79): bestellen, annuleren en AI-voorstel bevestigen alleen door de manager; een zaakgrens waaronder een medewerker zelf mag bestellen ontbreekt | groothandelorders | orders boven een zaakgrens vragen een manager | geen | manager bij grensoverschrijding | nu: alleen manager plaatst; na besluit 2: staff tot de grens | spoedlevering met reden | nu: een medewerker krijgt bij bestellen de melding dat dit managerwerk is; na besluit 2: 80 euro mag, 800 euro gaat naar de manager | klein | rolgrens: gerepareerd (605ab79); zaakgrens verdieping later, besluit 2 |
| Leveranciersprestaties | ontbreekt (`bedrijf/uitval.js`: "een leverancier bestaat hier niet") | levering in `kern/keuken.js`, batches met leverancier en ontvangstdatum, HACCP-ontvangstmeting | per leverancier: te laat, onvolledig, buiten temperatuur, als telling met noemer; geen score | ontvangst wordt niet altijd gemeten: "niet gemeten" | manager maandelijks | manager | - | de manager ziet "3 van 14 leveringen buiten 7 °C" met de leveringen erbij, geen cijfer | middel | later |
| Vestigingsvergelijking | ontbreekt; vestigingen staan in `kern/concern/` | omzetdag, afwijkingen, gemiste metingen per vestiging | tellingen met noemer per vestiging, nooit per medewerker | lege dag geeft "niet gemeten" | concernmanager wekelijks | eigenaar `werk.concern`; scope per vestiging (`kern/concern/scope.js`) | - | twee vestigingen staan naast elkaar met gemiste HACCP-dagen, zonder rangorde op mensen | middel | later, eigenaar Concern |

### L4 Domeinintelligentie

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Dienstmeting met soort per regel | bestaat, `kern/horeca/dienstmeting.js` | rekeningen, standen | gemeten / uit het model / niet gemeten; geen totaalcijfer | 8 van 12 niet gemeten | manager na de dienst | manager | lege avond: geen nullen | - | - | bestaat |
| Drukterem met rekensom | bestaat, `openWerk()` in `keukenlaag.js` | openstaande minuten, koks | minuten gedeeld door koks | normtijden | chef | chef beslist | - | - | - | bestaat |
| Personeelsscenario horeca | half: `kern/fiscaal/scenario.js` (`/api/supplier/scenario/personeel`) zonder schermaanroeper | omzetdag, rooster, loonkosten uit Payroll OS | doorrekening met lijsten aannames en onbekend; klasse `advies` | voorspelling is nooit een feit | manager op verzoek | manager; klaarzetten mag, doorvoeren is een mensbesluit (`kern/stuur.js`) | - | de manager ziet wat een extra kok op vrijdag kost, met de aannames, en er verandert niets tot hij bevestigt | klein | verdieping nu |
| Bijbestelvoorstel | bestaat, `ghBijbestelVoorstel` en `bestel-advies` | verkoop, mise-en-place, voorraad | aanvullen tot twee keer minimum | verkoop is geen vraag | inkoper | menselijke bevestiging | - | - | - | bestaat |
| HACCP-trend per meetpunt | ontbreekt | metingen | aantal afwijkingen per punt per week, met noemer | apparaat of meetfout niet te onderscheiden | manager wekelijks | manager | - | "koeling 2: 4 van 14 metingen boven 7 °C" staat bovenaan, met de metingen | klein | later |

### L5 Volledige levenscyclus

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Opening van een zaak: menu, HACCP, vergunning | half: `kern/onderneming/oprichting.js` noemt alcoholvergunning; "eersteklant" vraagt een menu | Onderneming, kaart, haccp | klaar = menu, minstens één meetpunt per koeling, vergunning als stuk | stuk is geen bewijs | eigenaar bij oprichting | eigenaar `werk.onderneming` | zaak zonder alcohol: geen VSH-signaal | een nieuwe zaak ziet welke drie dingen nog ontbreken voor de eerste dienst | klein | verdieping nu |
| Exploitatiefase als stand | ontbreekt (feiten-code: "een exploitatiefase als aparte stand ontbreekt") | `fase.js` | afgeleid, nooit met de hand | - | - | eigenaar Onderneming | - | - | middel | later, eigenaar Onderneming |
| Sluiting of overname | half: `deactivateStaffVanZaak`, `kern/tenant/uitgang.js` | alles van de zaak | HACCP en kasdata blijven tot het einde van hun termijn (te controleren) | - | eigenaar | eigenaar | - | na sluiting staat het HACCP-logboek nog 6 maanden leesbaar voor de eigenaar | middel | later |

### L6 RTG-samenhang

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Fooi naar workforce-laag | bestaat | betaling | fooi naar de verdeling | - | medewerker | - | - | - | - | bestaat |
| Hotelfolio | bestaat, betaalwijze `kamer`, `kern/horeca/foliolaag.js` | rekening | rekening naar folio | - | hotel | - | - | - | - | bestaat |
| Uitklokken meldt gedragen tafels | ontbreekt (HORECA.md: "de koppeling in de andere richting") | `klokVan` in `kern/personeel.js`, wijk-leen | bij uitklokken: aantal open tafels op zijn naam | - | medewerker bij uitklokken | eigenaar Team Room levert het scherm, horeca de telling | - | wie uitklokt met twee open tafels krijgt dat te zien vóór hij weg is | klein | verdieping nu |
| Klokuren naar de loonrun | half: loonrun leest uren, horeca-klok is Team Room | klokboek | eigenaar Payroll OS | - | - | kantoor + zaak | - | - | - | eigenaar Payroll OS |
| Gastallergie vanuit tafelwensen | bestaat, `kern/tafeldek.js`, `tafelwensen.js` | gastprofiel op codenaam | gast geeft op, zaak ziet op de bon | - | bediening | gast deelt | - | - | - | bestaat |

**Modus LOS.** De kerntaak zonder andere apps: een tafel bedienen van openen
tot afrekenen, keuken en pas regisseren, HACCP registreren, offline bestellingen
opnemen. Wat ontbreekt, zegt het scherm in één zin, in de zakelijke toon van de zaak.

*Eigen (de app bezit het en kan het altijd).* Rekening, regels, gangen,
keukenbord, pas, splitsen en afrekenen op de kaartprijs, offline sync van
bestellingen, HACCP-meetpunten, metingen, correcties, lijsten en batches,
menukaart met de veertien allergenen, dienstmeting.
- Gerecht zonder ingevulde allergenen: "Allergenen van dit gerecht zijn niet vastgelegd. Vraag de chef vóór u serveert."
- HACCP-meting zonder netwerk (na herstel): "Meting niet vastgelegd: geen verbinding. Noteer hem en voer hem opnieuw in."
- Geen meetpunten: "Er zijn nog geen meetpunten. Zonder meetpunt is er geen HACCP-logboek."

*Noodzakelijke platformdiensten.* Zaaksessie en rol (`supplierAuth`,
`managerOnly`), opslag (collectie `horeca`), identiteit van de medewerker op
codenaam, de stuurlaag (`kern/stuur.js`) voor het scenario, de betaalrail voor pin.
- Sessie verlopen: "Uw sessie is verlopen. Meld u opnieuw aan; niets van deze tafel is verloren."
- Rol ontbreekt (grens, inkoop): "Dit is werk van de leiding. Vraag uw manager." (Vandaag zegt `managerOnly` in `server/kern/leverancier/zaak.js` overal "Alleen een manager kan dit aanpassen.", ook bij bestellen.)
- Opslag niet beschikbaar: "Er kan nu niets worden vastgelegd. Neem op papier op; het scherm zegt wanneer het weer kan."
- Betaalrail weigert of hangt: "De betaling is niet bevestigd. De rekening staat nog open; reken niet nog eens af voordat dit scherm het zegt."

*Optionele koppelingen.* Team Room (rooster, klok, team), Payroll OS (loon),
Concern (vestigingen), Onderneming (vergunningstappen), `handel.inkoop`,
gastkant (`horeca.tafelgast`, tafelwensen).
- Team Room uit: "Rooster en klok komen uit Team Room; die staat uit, dus wie er dienst heeft is hier niet bekend."
- HACCP-taak zonder rooster: "Toegewezen: niet vastgelegd. Wie meet, vinkt zelf af."
- Vergunningsregister zonder rooster: "Geen rooster gekoppeld; controle op leidinggevenden niet mogelijk."
- Gastkant uit: "Allergieën van gasten komen nu niet binnen. Vraag ze aan tafel."
- Payroll OS uit: "Uren worden bewaard in Team Room; de loonrun leest ze later."

**Modus SAMEN.** Keten "vrijdagavond met allergie en een uitvaller".

1. 16:00 De manager opent `horeca-beheer`. Team Room levert het rooster; het
   vergunningsregister (na besluit 1) toont dat leidinggevende B op de vergunning
   staat met afgetekend VSH-stuk. *Storing: Team Room niet bereikbaar.*
   Zichtbaar: "rooster niet geladen, controle leidinggevende open". Bewaard:
   niets verandert; de dienst kan door.
2. 16:30 De kok meet koeling 1: 8 °C. De route weigert zonder actie; hij noteert
   "deur stond open, na 30 min 5 °C". *Storing: netwerk weg.* Vandaag: de meting
   gaat verloren en het scherm zwijgt (herstel nu, zie L1). Na herstel: de
   melding "niet vastgelegd"; na de verdieping: wachtrij met `clientId`, precies
   één keer bij terugkeer.
3. 19:10 Tafel 12 opent; stoel 2 meldt notenallergie. De regel draagt `allergie`;
   de kaart toont voor het gerecht "noten" uit de veertien. De pas vraagt
   dubbelcheck (`safety.js`). *Storing: het gerecht heeft geen vastgelegde
   allergenen.* Vandaag: een lege lijst. Na herstel: "allergenen niet
   vastgelegd, vraag de chef". Bewaard: de bon met de allergievraag; niets wordt
   als "vrij" getoond.
4. 21:00 Kok C meldt zich ziek in Team Room. De horeca-app ziet alleen
   "afwezig" (`personeelzicht.js`). De manager vraagt het personeelsscenario: wat
   kost een invaller; klasse `advies`. *Storing: scenario-engine faalt.*
   Zichtbaar: "doorrekening niet beschikbaar". Bewaard: niets; er is niets doorgevoerd.
5. 22:00 Een medewerker wil bij de groothandel bijbestellen. *Storing: geen
   manager-rol.* Zichtbaar: "Alleen een manager kan dit aanpassen." (605ab79; de zin past slecht bij bestellen).
   Bewaard: het AI-voorstel blijft staan voor de manager.
6. 23:40 Afrekenen; tafel 12 splitst op stoel. Omzetdag loopt tot 05:00.
   *Storing: crash na betaling.* Zichtbaar na herstart: rekening betaald, één keer
   (voltooiproef herstelbaar). Bewaard: betaling en bon.
7. 00:30 Kasopmaak; dezelfde dag als 23:30 (`test/omzetdag.test.js`). De klokuren
   gaan via Team Room naar de loonrun van Payroll OS; de loonstrook leest de
   medewerker in `loon.strook`. *Storing: geen ketenproef.* Deze schakel is niet
   gemeten (h., RTG-ketens).

**SAMEN als contractblok (voorstel; `scripts/lib/appcontract.js` blijft ongewijzigd).**

```js
samen: {
  functie: 'link:horeca', familie: 'WorkOS',
  belofte: 'een zaak bedient een tafel van rekening openen tot afrekenen, met de allergie van de gast tot op de pas en een HACCP-logboek dat de inspecteur kan lezen; een offline opgenomen bestelling komt precies een keer binnen',
  ingang: '/apps/horeca.html',
  bestanden: ['public/apps/horeca.html', 'public/apps/horeca/kern.js', 'public/apps/horeca/haccp-meting.js'],
  scenario: 'scripts/lib/voltooi/horeca.js',
  ketens: [
    { naam: 'allergie van de gast tot de pas', uitgeeft: 'bon met allergievraag en dubbelcheck', ontvangt: 'allergie van de gast op codenaam (tafelwensen)',
      vorm: 'verwijzing', eigenaar: 'horeca.tafelgast', toestemming: 'de gast deelt alleen de allergie, nooit zijn naam',
      storingen: ['gerecht zonder vastgelegde allergenen', 'gastkant uit', 'dubbele tik op uitgifte'], proef: 'scripts/tafelproef.js' },
    { naam: 'klokuur naar loonstrook', uitgeeft: 'gewerkte dienst op de zaak', ontvangt: 'niets terug; de medewerker leest zijn strook in loon.strook',
      vorm: 'projectie', eigenaar: 'zaak.teamroom', toestemming: 'zaak keurt uren als tweede oog, kantoor maakt definitief',
      storingen: ['Team Room uit', 'uren zonder dienstverband (loon_zonder_dienstverband)', 'dubbele tik op definitief'], proef: 'niet gebouwd: ketenproef klok -> loonrun -> loon.strook' },
    { naam: 'rooster en vergunning', uitgeeft: 'signaal "geen leidinggevende op de vergunning"', ontvangt: 'rooster en afgetekend vakbewijs',
      vorm: 'projectie', eigenaar: 'zaak.teamroom', toestemming: 'manager leest; het nummer blijft in de kluis',
      storingen: ['Team Room uit', 'stuk niet afgetekend', 'stuk verlopen'], proef: 'niet gebouwd (wacht op besluit 1)' },
    { naam: 'inkoop bij de groothandel', uitgeeft: 'bestelling namens de zaak', ontvangt: 'orderstand en levering',
      vorm: 'gebeurtenis', eigenaar: 'handel.inkoop', toestemming: 'manager plaatst en annuleert (605ab79)',
      storingen: ['medewerker zonder manager-rol', 'groothandel weigert', 'dubbele tik'], proef: 'test/inkoop-manager.test.js (toets, geen ketenproef)' }
  ]
}
```

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
`server/kern/horeca/allergenen.js` en `server/kern/tafelwensen.js` (twee lijsten van 14), `server/routes/supplier/menukaart.js`,
`server/kern/keuken.js`, `server/kern/groothandel.js`, `server/kern/vakbewijs.js`,
`server/kern/persoonseis.js`, `server/kern/vrijheid/rust.js`, `server/kern/vrijheid/beleid.js`,
`server/kern/agent.js` (roostervoorstel), `server/kern/fiscaal/scenario.js`,
`server/kern/fiscaal/zekerheid.js`, `server/kern/stuur.js`, `server/bewaarbeleid.js`,
`server/bewaarveger.js`, `server/kern/concern/vestiging.js`, `server/kern/concern/scope.js`,
`server/kern/horeca/dienstmeting.js`, `server/kern/leverancier/personeelzicht.js`.

**Ontbrekende koppelingen.**

| Van | Naar | Vorm | Toestemming |
|---|---|---|---|
| `tafelwensen.ALLERGENEN` | `kern/horeca/allergenen.js` | verwijzing: één lijst in plaats van twee (de koppeling menukaart -> vaste lijst is er sinds cc7510f) | - |
| `menukaart.js` (allergens) | stand "niet vastgelegd" | gegevensveld per gerecht | chef of manager |
| horeca `haccp` | `bewaarbeleid.js` | regel in de bewaartabel | eigenaar zet de veger aan |
| rooster (Team Room) | vergunningsregister | projectie: dienst x vergunningnamen x vakbewijs | manager leest; nummer blijft in de kluis |
| `roosterVoorstel` | `kern/vrijheid/rust.js` en ATW-waarden | aanroep vóór vaststellen | manager |
| uitklokken (Team Room) | `wijk-leen.js` | gebeurtenis bij uitklok | medewerker zelf, manager |
| `scenario/personeel` | `horeca-beheer.html` | schermaanroep | manager |
| HACCP-meting offline | `offline/sync`-vorm | wachtrij met `clientId` | staff |

## g. Prioritering

De bak "aanbevolen nu" is gesplitst in **herstel** (fouten, rolgrenzen,
bewaartermijn, wat het scherm belooft maar niet doet) en **verdieping**
(nieuwe premiumdiepte binnen de huidige scope).

**Herstel**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Allergenen tegen de 14, geen afkap op 12, onbekend woord geweigerd | klein | laag | `kern/horeca/allergenen.js` | gerepareerd (commit cc7510f) |
| Meetpuntgrens alleen door de manager, oude grens in de historie | klein | laag | `haccp.js` | gerepareerd (commit 4002318) |
| Inkoop bestellen, annuleren en AI-voorstel bevestigen alleen door de manager | klein | laag | `groothandel.js` route | gerepareerd (commit 605ab79) |
| HACCP in de bewaartabel (ondergrens 6 maanden / 1 jaar, te controleren), ook de grenshistorie (nu afgekapt op 50) | klein | laag | `bewaarbeleid.js` | herstel nu |
| HACCP-meting zonder netwerk zegt dat ze niet is vastgelegd | klein | laag | `public/apps/horeca/kern.js`, `haccp-meting.js` | herstel nu |
| "Niet vastgelegd" als stand van een gerecht, zodat leeg nooit "vrij" leest | klein | laag | `menukaart.js` | herstel nu |
| Eén allergenenlijst in plaats van twee | klein | laag | `tafelwensen.js`, `allergenen.js` | herstel nu |
| `roosterVoorstel` zonder rust- en publicatiesignaal (workos.md par. 9) | middel | middel | Team Room, besluit 3 | herstel later, eigenaar Team Room |

**Verdieping**

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Inspectie-export per periode, met correcties en grenswijzigingen | klein | laag | logboek, `punt.historie` | verdieping nu |
| NVWA-sjablonen voor meetpunten, ruimer = signaal (te controleren) | klein | laag | `haccp.js` | verdieping nu |
| Mijn HACCP-taken vandaag | klein | laag | `gemistVandaag`, Team Room | verdieping nu |
| Uitklokken meldt gedragen tafels | klein | laag | Team Room | verdieping nu |
| Personeelsscenario op `horeca-beheer` | klein | laag | `scenario.js` | verdieping nu |
| Opening van een zaak: wat nog ontbreekt | klein | laag | Onderneming | verdieping nu |
| Vergunningsregister leidinggevenden in het rooster (signaal) | middel | middel | Team Room, `vakbewijs.js`, besluit 1 | verdieping nu, na besluit 1 |
| HACCP-meting offline in een wachtrij met `clientId` | middel | middel | `offline/sync`-vorm | later |
| Zaakgrens voor inkoop door medewerkers | klein | laag | besluit 2 | later |
| Roosterpublicatie 3 weken vooraf (markering) | middel | middel | Team Room, nalezen cao | later (eigenaar Team Room) |
| ATW-signaal in het horecarooster | middel | middel | besluit ATW-laag (PLANNING.md) | later |
| Terugkoelklok, HACCP-trend | middel | middel | - | later |
| Leveranciersprestaties | middel | middel | besluit leveranciersobject | later |
| Vestigingsvergelijking | middel | middel | Concern | later |
| Centraal menu over vestigingen | groot | hoog | Concern, kaartmodel | later |
| AI die allergenen vaststelt | - | - | - | niet doen: grens 1 HORECA.md |
| Ranglijst bediening op omzet of tempo | - | - | - | niet doen: grens 3 HORECA.md |
| Een te-controleren regel (NVWA, KHN, ATW, cao) als harde weigering | - | - | - | niet doen: workos.md par. 11 |

## h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | tafel, bar, keuken, bezorging, hotel, club, event en HACCP draaien op één rekening | `scripts/tafelproef.js`, `scripts/bezorgproef.js`, plus ketenproef club en hotel | tafel en bezorging gemeten; club en hotel niet |
| Professionele diepte | elk gerecht draagt 14 allergenen of "niet vastgelegd"; elk HACCP-punt een grens met historie die alleen de manager zet | `test/menukaart-allergenen.test.js`, `test/haccp-grens.test.js`, plus een nieuwe toets op "niet vastgelegd" | lijst en grens gerepareerd (cc7510f, 4002318) en getoetst; "niet vastgelegd" ontbreekt |
| Levenscyclus | opening, exploitatie en sluiting houden HACCP en kas leesbaar binnen termijn | veegrapport van `bewaarveger.js` toont horeca met een ondergrens; de termijn zelf is te controleren en wordt geen weigering | ontbreekt: horeca niet in de bewaartabel |
| Samenwerking en rollen | grens, inkoop en vergunning zijn managerwerk; collega's zien geen kloktijden | `test/personeelzicht-routes.test.js`, `test/haccp-grens.test.js`, `test/inkoop-manager.test.js`, plus een BEVOEGD-ronde | personeelszicht bewezen; grens en inkoop getoetst (failing-first), BEVOEGD-ronde nog niet |
| Domeinintelligentie | elke voorspelling draagt klasse en aannames; geen score op mensen | `test/horeca-dienstmeting.test.js`, `test/horeca-journey.test.js` | bestaat |
| Los functioneren | zonder Team Room werkt de tafel, en elke ontbrekende dienst geeft de zin uit Modus LOS; een meting zonder netwerk zegt dat ze niet is vastgelegd | voltooiproef met Team Room uit, plus een toets met een geweigerde `fetch` op `haccp-meting.js` | niet gemeten; meting zonder netwerk zwijgt vandaag |
| RTG-ketens | klokuur naar loonstrook, allergie gast naar pas | ketenproef klok -> loonrun -> `loon.strook` | niet gemeten |
| Bewezen betrouwbaarheid | acht bewijzen centraal gestempeld | APPWERKT.json | 3 BEWEZEN, 4 lokaal gesloten, bevoegd NIET_GETEST |

Dit contract vervangt nooit de acht bewijzen van APPWERKT.

## Twee uitkomsten

### (A) Binnen de huidige architectuur en scope

**Herstel**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Allergenen tegen de veertien, geen afkap | gerepareerd (commit cc7510f) | `server/kern/horeca/allergenen.js`, `server/routes/supplier/menukaart.js` |
| Meetpuntgrens alleen door de manager, met historie | gerepareerd (commit 4002318) | `server/routes/supplier/horeca/haccp.js` |
| Inkoop bestellen en annuleren alleen door de manager | gerepareerd (commit 605ab79) | `server/routes/supplier/groothandel.js` |
| HACCP-ondergrens in de bewaartabel, inclusief grenshistorie | klein | `server/bewaarbeleid.js`, `server/bewaarveger.js` |
| Meting zonder netwerk zegt "niet vastgelegd" | klein | `public/apps/horeca/kern.js`, `public/apps/horeca/haccp-meting.js` |
| Stand "niet vastgelegd" per gerecht; één allergenenlijst | klein | `server/routes/supplier/menukaart.js`, `server/kern/tafelwensen.js` |
| Roostervoorstel met rust- en publicatiesignaal | middel, later | `server/kern/agent.js`, `server/kern/vrijheid/rust.js`, eigenaar Team Room |

**Verdieping**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Inspectie-export per periode | klein | het HACCP-logboek, `punt.historie` |
| NVWA-sjablonen voor meetpunten (signaal, te controleren) | klein | `server/routes/supplier/horeca/haccp.js` |
| Mijn HACCP-taken vandaag | klein | `gemistVandaag`, rooster van Team Room |
| Uitklokken meldt gedragen tafels | klein | `klokVan`, `server/kern/horeca/wijk-leen.js` |
| Personeelsscenario op het beheerscherm | klein | `server/kern/fiscaal/scenario.js`, `server/kern/stuur.js` |
| Opening van een zaak: wat nog ontbreekt | klein | `server/kern/onderneming/oprichting.js` |
| Vergunningsregister leidinggevenden (na besluit 1) | middel | `server/kern/vakbewijs.js`, `server/kern/persoonseis.js`, Team Room |
| Later: offline HACCP-wachtrij, zaakgrens inkoop, terugkoelklok, HACCP-trend, bereidingsstappen, runnerrol, vestigingsvergelijking, leveranciersprestaties als tellingen | klein tot middel | `offline/sync`, `stappen.js`, `pas.js`, `server/kern/concern/`, `server/kern/keuken.js` |

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
2. **Een zaakgrens voor inkoop door medewerkers?** Sinds 605ab79 bestelt alleen de manager.
   - **A (aanbevolen): zo laten tot een zaak er zelf om vraagt; dan een grens per zaak, daarboven de manager.** Kost: nu nul, later klein.
   - B: nu een grens bouwen. Kost: klein; een instelling die geen zaak heeft gevraagd.
   - C: terug naar iedereen. Kost: nul; een verplichting tot betalen zonder tweede paar ogen.
3. **ATW en cao-horizon in het horecarooster.**
   - **A (aanbevolen): wachten op het besluit "ATW-laag losgemaakt uit taxi" (PLANNING.md) en dan Team Room laten lezen.** Kost: middel, later.
   - B: nu een horeca-eigen ATW-toets. Kost: middel; de achtste planner, botst met "geen nieuwe motor".
4. **Leveranciersprestaties.**
   - **A (aanbevolen): later, als tellingen met noemer op bestaande leveringen en batches, geen leveranciersobject.** Kost: middel.
   - B: een leveranciersobject voor alle genres. Kost: groot; nieuw domein, buiten de bouwscope.
5. **Mag een te-controleren norm (NVWA 7 °C, KHN 6 maanden) als ondergrens in code?**
   - **A (aanbevolen): als bewaarondergrens en als signaal ja, als weigering nee, pas na nalezing door een mens.** Kost: klein; een uur nalezen per bron.
   - B: niets in code tot nalezing. Kost: nul; HACCP blijft intussen zonder bewaarbeleid.
