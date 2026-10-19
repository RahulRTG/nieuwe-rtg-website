# Premiumdomeinkaart TravelOS — deel 1: de reisfamilie

*Stand 19 oktober 2026, tak `appwerkt/travelos`. Opgesteld voor het eigenaarsbesluit "Beyond Premium". Dit is een kaart en geen bouwopdracht: niets hieronder wordt gebouwd voordat de eigenaar het per familie heeft toegezegd. Deel 2 (de andere TravelOS-apps) volgt.*

De reisfamilie is wat een lid nodig heeft om **een reis te boeken, te betalen, terug te zien in zijn agenda en mee te nemen als reisdossier**. De eigenaar koos haar als eerste familie die aantoonbaar compleet wordt, los en samen getest.

Hoe deze kaart is gemaakt. Elk feit over RTG komt uit de code of uit de proefregisters van de integratietak (APPWERKT, VOLTOOIPROEF, IDOR, BEVOEGD van 19 oktober 2026), met bestand en regel. Marktgegevens komen uit zoekresultaten van 19 oktober 2026; de leverancierspagina's zelf waren vanuit deze omgeving niet te openen (DNS en proxy weigerden), dus elk bedrag is **zoekresultaat, niet zelf gelezen** en moet vóór publicatie worden nagelopen. Een voorspelling of een externe bron die RTG niet zelf heeft, staat overal als onzeker.

## 0. Drie correcties vooraf

1. **Routedossier hoort niet in de reisfamilie.** `/apps/routedossier.html` gaat over de API-routes van de software ("Van elke route van dit huis: wat we er werkelijk van weten, over elf schakels"), niet over reisroutes. Capability `kantoor.routedossier`, doelgroep kantoor (SCHERMEIGENAAR.json:2346). Het staat in deze kaart kort in par. 6, en hoort eigenlijk bij de bewijsmachine (BEWIJSMACHINE.md).
2. **Het boekscherm van de familie ontbreekt in de wereld.** De reis wordt geboekt in `/apps/reisbureau.html` (capability `reizen.reisbureau`, SCHERMEIGENAAR.json:2292: "Een door RTG samengestelde reis kiezen en boeken … wijzigen of afzeggen"). Dat scherm staat in geen enkele wereld (`MAPPEN`, app-main-24a2b.js), heeft geen rij in APPWERKT en geen voltooiscenario. Een familie "aantoonbaar compleet" kan niet zonder: het hoort in deze familie en krijgt hier zijn eigen kaart (par. 3).
3. **"Reizen" is twee dingen.** De app `link:reizen` is "Reizen & Veilig" (`/apps/reizen-veilig.html`: een werkblad dat reisbureau, Move, OV, Veilig en Navigatie opent, plus Live Circle-Momenten). De tab `tab:reizen` in de ledenapp toont de reis (`trip` uit de identiteitskluis), het dagprogramma (`/api/agenda/mijn`) en de autoshowroom. De wereldpagina `/apps/reizen.html` leest de reiswereld (`/api/reis/*`).

## 1. De keten van de eigenaar, helemaal uitgeschreven

> Een reis boeken geeft een betaalbewijs, een agendapunt en een reisdossier. Valt Agenda uit, dan verdwijnt de bevestigde reis niet. Faalt het betalen, dan heet de boeking niet betaald.

### 1.1 Zo loopt hij vandaag (gemeten)

| Stap | Wat er gebeurt | Waar | Wie bezit het |
|---|---|---|---|
| 1. Aanvragen | Lid kiest een reis in reisbureau.html; `POST /api/reisbureau/boek`. Eerst de gegevenspoort (428 met wat ontbreekt), dan een rij in `reisAanvragen` met `status 'aangevraagd'`, ref `RTG-R-…`. Een tweede open aanvraag voor dezelfde reis: 409. | routes/member/winkel.js:32, kern/reisbureau.js:65-89, kern/gegevenspoort.js:115-128 | Reisbureau (TravelOS) |
| 2. Visumtaak | Bij de aanvraag zet `visumtaak.bijBoeking` een taak in de eigen agenda, met `bron = ref` (niet dubbel). | kern/visumtaak.js:43-56, reisbureau.js:89 | Agenda (opgeslagen regel) |
| 3. Reisdossier | `reisdossier.zetAanvraag` schrijft een regel in `md.trip` (de identiteitskluis): status `req`, label "In aanvraag". | kern/lid/reisdossier.js:59-60 | Reisdossier (TravelOS) |
| 4. Bevestigen | Het kantoor bevestigt of wijst af (afwijzen vraagt een reden, elke beslissing een naam). Bij bevestigen: `reisdossier.bevestig` → **status `paid`**, label "Bevestigd". | kern/reisbureau-besluit.js:47-123, reisdossier.js:85-88 | Kantoor beslist, dossier volgt |
| 5. Betalen | `POST /api/reisbureau/betaal` → alleen een bevestigde, uitgesplitste reis (anders 409). Eén pay-boeking met economische sleutel `pay-handeling:[reis, ref]` (idempotent, ook na crash). Pas daarna `reisGeldrijen`, `reisUitkeringen` (uitgevoerd:false) en `markeerBetaald`. Faalt de boeking: 502/402/503, niets heet betaald. | kern/reisbureau-betaling.js:45-114, kern/pay/boeking.js:111-143 | Geld (boeking), reisbureau (markeerBetaald) |
| 6. Agenda | `/api/agenda/mijn` rekent bij elke vraag uit de bronnen, ook `reisAanvragen` (aangevraagd, bevestigd, wijziging-gevraagd, alleen met vertrekdatum). Niets wordt weggeschreven. | kern/ervaring/leden/spaarpot.js:10-62 | Agenda (projectie) |
| 7. Wijzigen | Lid vraagt (`/wijzig` → `wijziging-gevraagd`), het kantoor past toe of wijst af met reden. | kern/reisbureau-wijziging.js, routes/kantoren/reisbureau.js:58 | Kantoor |
| 8. Afzeggen en terug | `/afzeggen` vraagt een reden; een betaalde reis krijgt pas `afgezegd` als er een teruggaverecht klaarstaat. Teruggave: klaargezet → uitgevoerd (door een mens, passkey, vanaf €1000 een tweede mens) of afgewezen. | kern/reisbureau-nazorg.js:99-117, reisbureau-teruggave.js | Kantoor + Geld |

### 1.2 Waar de keten vandaag breekt (defecten tegen de regel van de eigenaar)

| # | Defect | Bewijs | Gevolg voor het lid |
|---|---|---|---|
| K1 | **Een bevestigde, onbetaalde reis heet in het dossier `paid`.** Bevestigen zet `status 'paid'`; betalen raakt het dossier niet. | kern/lid/reisdossier.js:85-88 | De pil in de reistab toont "betaald" zonder dat er betaald is. Breekt "faalt het betalen, dan heet de boeking niet betaald". |
| K2 | **Er is geen betaalknop.** Geen scherm roept `/api/reisbureau/betaal` aan. | grep in public/ (Geld bevestigde dit apart) | Een lid kan een bevestigde reis niet zelf betalen. |
| K3 | **Er is geen betaalbewijs.** `reisbureau-betaling.js` roept `factuurVoorLid` niet aan; `/api/facturen` leest alleen `md.invoices`. | grep 'factuur' in kern/reisbureau*.js | Het enige bewijs is het object `a.betaald` in `/api/reisbureau/mijn`. |
| K4 | **Het bestellingenoverzicht zegt altijd "niet betaald".** | kern/mall/bestellingen.js:109 (reis), :126 (logeren) | Ook een betaalde reis staat als onbetaald. |
| K5 | **Eén kapotte bron breekt de hele agenda.** Geen try/catch per bron (de reiswereld doet dat wel: `stil`). | spaarpot.js:10-62 vs kern/wereldkern.js:46-48 | Valt één domein uit, dan ziet het lid geen enkel programmapunt. De reis zelf blijft wel bestaan. |
| K6 | **Een fout in de visumtaak geeft een kaal antwoord terwijl de aanvraag bestaat.** `bijBoeking` staat zonder try na het bewaren. | reisbureau.js:85-89 | Het lid ziet een fout, maar de aanvraag is er wel: dat nodigt uit tot een tweede aanvraag (die dan 409 krijgt). |
| K7 | **Na een crash tussen boeking en `markeerBetaald` werden geldrijen en uitkeringen opnieuw gepusht.** *Gerepareerd door Geld*: alleen schrijven als er nog geen rij met `payboeking:<boeking>` is. | reisbureau-betaling.js; Geld 6016db28, test/reisbetaling-herhaal.test.js (zakte eerst op 12 waar 6 hoort) | Was: dubbele herkomstregels en uitkeringen. |
| K8 | **Aanvragen heeft geen herhaalsleutel.** Een dubbeltik geeft 409 "al aangevraagd" in plaats van dezelfde aanvraag. | reisbureau.js:75 | De toestand klopt (één aanvraag), de melding niet. Vaste regel herhaalsleutel geldt. |
| K9 | **Geen offline dossier.** De service worker cachet geen `/api/`; er is geen lokale kopie van `md.trip`. | public/sw.js:111 | Zonder netwerk op het vliegveld: geen reisdossier. |

### 1.3 De keten zoals hij moet (het toetsbare scenario)

Eén scenario, gelopen in de voltooiwereld (scripts/voltooiproef.js), met een lid A, een lid B en het kantoor. Elke regel is een stap met een uitkomst die je kunt zien.

1. **A vraagt een reis aan** in reisbureau.html, met een herhaalsleutel. → Eén aanvraag in `reisAanvragen`; dossier "In aanvraag"; agenda toont de reis op de vertrekdatum; visumtaak staat één keer in de agenda.
2. **Dubbeltik op aanvragen** → dezelfde aanvraag terug (`herhaald: true`), niet een 409, en niet twee.
3. **Het kantoor bevestigt** → dossier "Bevestigd, nog niet betaald" (een eigen stand, nooit `paid`); agenda "bevestigd"; Geld toont een open verplichting zonder vervaldag (er bestaat geen betaaltermijn, TRAVELCOMMERCE.md:241).
4. **A betaalt, maar het saldo is te laag** → 402 met de reden in woorden; dossier blijft "nog niet betaald"; geen geldrij, geen bewijs, niets heet betaald.
5. **Betaallaag valt uit** → 503 "De betaallaag is niet beschikbaar"; zelfde uitkomst als 4.
6. **Betaling staat open bij de provider** (in voorstel betaalwaarheid) → "wacht op bevestiging", nooit "betaald".
7. **A betaalt met dekking** → één pay-boeking; dossier "Betaald" (pas nu); betaalbewijs (factuur) in Geld met de ref; bestellingenoverzicht "betaald".
8. **Dubbeltik op betalen** → één boeking, één bewijs; de tweede tik geeft hetzelfde antwoord.
9. **Crash direct na de pay-boeking, vóór `markeerBetaald`** → na de herstart geeft opnieuw betalen dezelfde boeking, geen tweede geldrij, en de reis heet betaald.
10. **Agenda valt uit** (de agendaprojectie gooit) → `/api/reisbureau/mijn`, het dossier en Geld tonen de reis en de betaling ongewijzigd; de agenda zegt in woorden dat hij nu niet kan rekenen, de andere bronnen blijven zichtbaar.
11. **Nette herstart** → aanvraag, bevestiging, betaling, bewijs en dossier staan er nog, ook in een nieuwe sessie.
12. **B probeert A's reis te zien, betalen, wijzigen of af te zeggen** → 404 op elke route (IDOR meet dit nu al als `gescheiden` voor boek, betaal, annuleer, wijzig, thuis); B's agenda en dossier tonen niets van A.
13. **Offline** → het dossier van A staat leesbaar op het toestel, met "laatst bijgewerkt", zonder geld te kunnen verplaatsen.

**LOS en SAMEN, getoetst vanuit het lid.** LOS: met Agenda en Geld uit kan A zijn reis aanvragen, zien en laten bevestigen, en het scherm zegt eerlijk dat betalen en de agenda nu niet kunnen. SAMEN: de stappen 1–13 lopen door alle vier de apps zonder dat één app de gegevens van een ander kopieert: de agenda en het overzicht in Geld zijn projecties, het bewijs komt van Geld, de reis blijft van het reisbureau.


### 1.4 De toets van de eigenaar voor LOS: blijft de reis bruikbaar als vervoer, boekingen of Agenda niet beschikbaar zijn?

| Valt uit | Wat het lid dan nog heeft (gemeten) | Wat ontbreekt | Toets die het bewijst |
|---|---|---|---|
| **Agenda** | Alles: de agenda is een projectie (spaarpot.js:10-62) en bezit geen reis. Reisbureau, dossier (`md.trip` in de kluis) en Geld staan los. | Valt één bron van de agenda uit, dan ziet het lid geen enkel punt (K5). | Scenario stap 10 (par. 1.3), met één bron die gooit. |
| **Boekingen** (reisbureau, partner of betaallaag) | Het dossier `md.trip` blijft leesbaar; de reiswereld toont de andere bronnen en zet de uitgevallen bron op `stil` (wereldkern.js:46-48). Betalen geeft 503 en de reis blijft onbetaald. | Het dossier is alleen online (K9); het scherm van de reistab zegt niet welke bron uitviel. | Reisbureau-bron laten falen: tijdlijn toont de rest + "stil"; dossier ongewijzigd. |
| **Vervoer** (OV, taxi, Move, navigatie) | De reis zelf (boeking, dossier, agenda) hangt er niet van af. Move geeft "niet te bepalen" in plaats van een verzonnen oordeel (index.js:23-27). | Geen aanwijzing in het dossier wat het lid dan moet doen (contactpunt, BZ-nummer). | Navigatie 503: Move zegt "niet te bepalen" met de reden; dossier en betaling ongewijzigd. |
| **Netwerk** (op het vliegveld) | Niets: de service worker cachet geen `/api/` (sw.js:111). | Offline dossier (K9, NU, M). | Toestel offline: dossier leesbaar met "laatst bijgewerkt". |

Oordeel vandaag: **de reis blijft bestaan, maar is niet in alle gevallen bruikbaar**. Bestaan is gedekt (niets hangt aan de agenda of het vervoer); bruikbaar vraagt K5 (agenda per bron) en K9 (offline dossier met contactkaart).

### 1.5 Antwoorden aan Geld (afgestemd 19 oktober) en het eigenaarsbesluit

- **Eigenaarsbesluit 19 oktober:** een reis laten boeken en betalen via het reisbureau mag elk account dat gekeurd is met de paspoortpoort. Daarmee is B6 beslist. Uitgevoerd door Geld (960cc45a op appwerkt/geld, toets test/reisbetaal-poorten.test.js): aanvragen vraagt een account; betalen vraagt daarbij de paspoortpoort (`onboarding.payGate`), net als opladen. *Lezing ter bevestiging door de eigenaar:* het besluit noemt "boeken en betalen … mits gekeurd met de paspoortpoort"; Geld leest de poort alleen bij betalen, omdat aanvragen geen geld beweegt. De bezitspoort op `/api/reisbureau/betaal` volgt bij Toegang. K7 (geldrijen dubbel na een crash) is door Geld gerepareerd (6016db28, test/reisbetaling-herhaal.test.js).
- **Wie bezit het betaalscherm?** `apps/reisbureau.html` (`reizen.reisbureau`, SCHERMEIGENAAR.json:2292). De betaalknop hoort bij de reis zelf. Geld toont de open verplichting en de kasstroom als projectie, maar bezit de reis niet.
- **Bestaat er een betaaltermijn?** Nee. Er is geen betalingsplan, vervaldatum of annuleringsregel (TRAVELCOMMERCE.md:241). Geld toont dus "open, geen vervaldag" en verzint geen datum. Een termijn komt pas met besluit B2; de branchegewoonte (rest uiterlijk 6 weken voor vertrek, met een aantoonbare herinnering) staat in par. 2.1.
- **Mag "betaald" alleen via de afhandelaar van de betaalwaarheid?** Ja, akkoord met het voorstel van Geld. `markeerBetaald` wordt alleen aangeroepen door de afhandelaar van de betaalwaarheid (soort `reis`, bronRef = aanvraag-ref), net als bij bank-stort en markt-deal. "Wacht op bevestiging" en "geweigerd" zijn eigen standen en heten nooit betaald. Het betaalbewijs komt uit Geld (`factuurVoorLid`), vanuit dezelfde afhandelaar.

## 2. Het domein: wat reizen, boeken en betalen werkelijk vragen

Niet "wat doet de beste app", maar wat de mensen in dit vak nodig hebben. Wie werkt hier mee: de reiziger, het reisgezelschap, de reisadviseur van RTG (kantoor), de organisator en zijn lokale vertegenwoordiger, de vervoerder, het hotel, de travelmanager van een bedrijf, en bij nood Buitenlandse Zaken. Bronnen uit zoekresultaten van 19 oktober 2026; wat niet in de brontekst zelf is gezien staat als *niet bevestigd*.

**2.1 Wet en regels die een reis met RTG raken** (RTG stelt reizen samen via het reisbureau, dus de pakketreisregels zijn het uitgangspunt; of RTG juridisch organisator is, is een vraag voor de eigenaar en een jurist, zie besluit B1).

| Plicht | Concreet | Bron |
|---|---|---|
| Bevestiging op een duurzame gegevensdrager | bij of direct na het sluiten; met speciale wensen, verantwoordelijkheid en hulpplicht, de insolventiebeschermer en een contactpunt dat snel bereikbaar is | Richtlijn (EU) 2015/2302 art. 7; BW 7:504 — legislation.gov.uk/eudr/2015/2302/article/7 |
| Prijsverhoging | alleen als het contract het zegt, alleen brandstof/belasting/wisselkoers, uiterlijk 20 dagen vóór vertrek; boven 8% kiest de reiziger: accepteren of kosteloos opzeggen | art. 10-11 — legislation.gov.uk/eudr/2015/2302/chapter/III |
| Wezenlijke wijziging door de organisator | de reiziger kiest: accepteren, of kosteloos opzeggen (eventueel vervangende reis) | art. 11 (*termijn niet bevestigd*) |
| Annuleren door de organisator bij te weinig deelnemers | uiterlijk 20 dagen (>6 dagen reis), 7 dagen (2-6 dagen) of 48 uur (<2 dagen) vooraf; terugbetalen binnen 14 dagen | art. 12 — legislation.gov.uk/eudr/2015/2302/article/12; HvJ C-540/21 |
| Kosteloos opzeggen bij onvermijdbare omstandigheden op de bestemming | ja | art. 12 lid 2 |
| Terugreis onmogelijk | tot 3 nachten verblijf per reiziger; geen plafond voor PRM, zwangeren, alleenreizende minderjarigen en medisch afhankelijken mits 48 uur vooraf gemeld | art. 13 lid 7-8 |
| Hulpplicht | zonder onnodige vertraging: informatie over zorg, autoriteiten, consulaire hulp; hulp bij communicatie en alternatieve regelingen | art. 16 — legislation.gov.uk/eudr/2015/2302/article/16 |
| Gekoppeld reisarrangement | ontstaat bij een tweede dienst gericht geboekt binnen 24 uur na de eerste | art. 3 punt 5 |
| Herziening richtlijn | voucher weigeren mag, max. 12 maanden, beschermd bij faillissement; EP akkoord 12-03-2026 (*nummer en omzetting niet bevestigd*) | travelextra.ie; epthinktank.eu |
| Insolventie in NL | SGR dekt pakketten en door een reisbureau samengestelde reizen, niet losse tickets of autohuur | tui.nl/…/sgr; consumentenbond.nl |
| Restbetaling | uiterlijk 6 weken vóór vertrek is branchegewoonte; annuleren wegens te late betaling alleen na een duidelijke waarschuwing vooraf | voorwaarden van organisaties; Hof Den Haag 31-03-2026 (ECLI:NL:GHDHA:2026:439) |
| Aanbetaling, annuleringsstaffel | ANVR-gewoonte (vaak 15%; staffel 35-100%) | *niet bevestigd tegen de ANVR-tekst 2026* |
| Vlucht vertraagd of geannuleerd | zorg vanaf 2/3/4 uur; omboeken "at the earliest opportunity" of terugbetaling; compensatie €250/400/600 vanaf 3 uur op de eindbestemming | Verordening 261/2004 art. 5-9; Sturgeon |
| Trein | 25% bij 60-119 min, 50% vanaf 120 min; geen alternatief binnen 100 min: zelf omreizen op kosten van de vervoerder | Verordening 2021/782 art. 18-19 |
| Bus en boot | keuze terugbetaling/omreizen vanaf 120 min (bus, ≥250 km) en 90 min (boot) | 181/2011; 1177/2010 |
| Toegankelijkheid | assistentie melden 48 uur vooraf (lucht, water), 36 uur (bus), 24 uur (trein); vooraanmelden is gratis en hoort in de boeking | 1107/2006 art. 7; 2021/782 |
| Documenten | Schengen voor derdelanders: paspoort jonger dan 10 jaar en 3 maanden geldig na vertrek; EES actief sinds 10-04-2026; UK ETA verplicht sinds 2-4-2025; ETIAS-datum *niet bevestigd* (uitstel naar 2027 gemeld) | Verordening 610/2013; gov.pl; ec.europa.eu |
| Zorgplicht werkgever | toestemming vóór de reis, risicobeoordeling, traveller tracking, tweerichtingscommunicatie; 73% van de reizigers verwacht binnen 2 uur contact na een incident | ISO 31030:2021 (*norm zelf niet ingezien*); GBTA/Concur |
| Veiligheid | BZ-kleurcodes geel/oranje/rood; Informatieservice BZ meldt wijzigingen per e-mail of sms; 24/7 BZ Contact Center +31 247 247 247 | nederlandwereldwijd.nl; rijksoverheid.nl |
| Overstappen | MCT per luchthaven (IATA SSIM h. 8); op één ticket beschermd, bij een zelf samengestelde overstap niet | iata.org MCT user guide |

**2.2 Wat hieruit volgt voor de reisfamilie.** Een reis is geen object maar een **klok met beslismomenten**: T-6 weken restbetaling (met aantoonbare herinnering), T-20 dagen grens voor prijsverhoging en voor annulering bij te weinig deelnemers, T-48 uur assistentiemelding, T-0 vertrek met documentcheck, en tijdens de reis de drempels 2/3/4 uur (zorg), 3 uur (compensatie) en 100 minuten (trein). Elk moment heeft een eigenaar, een keuze voor de reiziger en een bewijs dat het gebeurd is.

**2.3 Wat de markt laat betalen** (de ondergrens; zoekresultaat 19-10-2026, niet zelf gelezen)

| Leverancier | Betaalde laag | Wat erachter zit | Bron |
|---|---|---|---|
| TripIt | Pro, ca. $49/jaar | realtime vertraging/annulering, gatewijziging, alternatieve vluchten, (Seat Tracker *niet bevestigd*) | tripit.com/uhp/pricing |
| Tripsy | Pro (prijs *niet bevestigd*) | reserveringen doorsturen, onbeperkt documenten, gasten uitnodigen, agenda-sync, uitgaven | tripsy.app/pro |
| Wanderlog | Pro, $39,99/jaar | offline, routeoptimalisatie, mail-import, onbeperkt bijlagen | wanderlog.com |
| Flighty | Pro, $59,99/jaar | Where's My Plane, late-plane alerts, vertragingsvoorspelling, meldingen vóór de airline, agenda-sync | flighty.com/pricing |
| Hopper | Disruption Assistance (fee per boeking) | bij ≥2 uur vertraging of annulering omboeken zonder bijbetaling of geld terug | hopper.com/legal/premium-disruption-assistance |
| AirHelp | AirHelp+, €39,99-99,99/jaar | compensatie zonder commissie, vaste uitkering bij vertraging, lounge bij verstoring | airhelp.com/en/airhelp-plus |

Patroon: men betaalt om **eerder te weten**, om **een omboekrecht vooraf af te kopen**, en om **geld bij verstoring zonder commissie**. Bij RTG zit wat technisch, juridisch en financieel kan standaard in de pas (besluit 1); het afkopen van risico (Hopper, AirHelp) is financieel een verzekering en hoort niet standaard (zie "niet doen").

## 3. De reisfamilie, per app

Legenda. **Stand**: bestaat / half / ontbreekt. **Kosten**: K klein (een dag, één module), M middel (meerdere modules of een nieuw scherm), G groot (nieuwe externe afhankelijkheid of meerdere families). **Bak**: NU = aanbevolen nu, LATER, NIET (met reden). Lagen: L1 persoonlijk, L2 professioneel (via bestaande genres), L3 organisatorisch, L4 domeinintelligentie, L5 levenscyclus, L6 RTG-samenhang.

### 3.1 Reisbureau (`/apps/reisbureau.html`) — de boeking zelf

**a. Bewezen werkelijkheid.** Aanvragen, advies (`/advies`), annuleren, wijzigen (verzoek; kantoor beslist), afzeggen met teruggaverecht, betalen in de kern (`reisbureau-betaling.js`, idempotent op `pay-handeling:[reis, ref]`). IDOR (integratietak, 19-10): `boek`, `betaal`, `annuleer`, `wijzig`, `thuis` **gescheiden** (404 voor een ander). Niet gemeten: geen APPWERKT-rij, geen voltooiscenario, geen BEVOEGD-rij — het scherm staat in geen wereld. Toetsen: test/reisherkomst.test.js, test/reisteruggave.test.js (via Geld).

**b. Markt.** TripIt/Tripsy organiseren wat elders geboekt is; ze boeken zelf niet. Hopper en AirHelp verkopen verstoringsbescherming. Een reisbureau-app met adviseur, bevestiging en teruggave in één keten is in de gevonden bronnen niet als consumentenabonnement te koop.

**c. Domein.** Zie par. 2: bevestiging op duurzame drager met contactpunt en insolventiebeschermer; betaalmomenten; prijswijziging met keuze; annuleren met termijnen; hulpplicht.

**d. Catalogus**

| Functie | Laag | Stand | Bron | Acceptatiecriterium (gewone taal) | Kosten | Bak |
|---|---|---|---|---|---|---|
| Aanvragen met herhaalsleutel | L5 | half | reisbureau.js:65-89 (409 i.p.v. herhaling) | Twee keer tikken op "Vraag aan" geeft één aanvraag en twee keer hetzelfde antwoord, ook na een herstart. | K | NU |
| Stand "bevestigd, nog niet betaald" | L5 | ontbreekt (K1) | reisdossier.js:85-88 | Na bevestiging door het kantoor zegt elk scherm "bevestigd, nog niet betaald"; pas na een geslaagde betaling "betaald". | K | NU |
| Betaalknop bij de reis | L1 | ontbreekt (K2) | grep public/ | Een lid betaalt een bevestigde reis in reisbureau.html; bij 402/503 ziet hij in woorden waarom en blijft de reis onbetaald. | K | NU |
| Betalen via de betaalwaarheid (voorstel Geld) | L5/L6 | ontbreekt | Geld, 19-10 | Betaald heet een reis pas als de betaalwaarheid "betaald" geeft; "wacht op bevestiging" en "geweigerd" zijn eigen standen. | M | NU (Geld bouwt, reisbureau roept aan) |
| Betaalbewijs | L6 | ontbreekt (K3) | grep 'factuur' | Na betalen staat één bewijs met de reisref in Geld (`factuurVoorLid`), te downloaden; een tweede tik maakt geen tweede bewijs. | K | NU |
| Geldrijen ontdubbelen op boeking-id | L5 | bestaat (Geld, 6016db28) | test/reisbetaling-herhaal.test.js | Een crash na de pay-boeking en opnieuw betalen geeft geen tweede herkomstrij of uitkering. | — | gedaan |
| Bevestiging op duurzame drager | L2/L5 | half | richtlijn art. 7 | Na bevestiging krijgt het lid een document (PDF in Bestanden, mail via de postvanger) met de reis, speciale wensen, verantwoordelijkheid, contactpunt en — als de eigenaar dat besluit — de insolventieregeling. Geen document zonder bevestigde reis. | M | NU (inhoud insolventie: besluit B1) |
| Betaalklok (aanbetaling, rest) | L5 | ontbreekt | TRAVELCOMMERCE.md:241 | Een bevestigde reis toont "rest te betalen vóór <datum>" alleen als de eigenaar een betalingsplan heeft vastgesteld; een herinnering gaat 7 en 2 dagen vóór die datum; niet betaald wordt nooit stil geannuleerd. | M | LATER (besluit B2) |
| Prijswijziging met keuze | L5 | ontbreekt | art. 10-11 | Wijzigt de prijs vóór T-20 dagen, dan ziet het lid oud en nieuw, de reden en de knoppen "accepteren" en "kosteloos opzeggen"; zonder antwoord gebeurt er niets met zijn geld. | M | LATER |
| Wezenlijke wijziging door RTG met keuze | L5 | half | reisbureau-wijziging.js (alleen lid→kantoor) | Wijzigt het kantoor de reis zelf, dan krijgt het lid een voorstel (oud/nieuw) dat hij aanvaardt of kosteloos weigert; de reis wordt pas gewijzigd na zijn ja. | M | NU |
| Annuleringskosten en staffel | L5 | ontbreekt | TRAVELCOMMERCE.md:293 | Bij afzeggen ziet het lid vóór zijn bevestiging wat het kost en waarom (regel en datum); na afzeggen staat de teruggave met bedrag klaar. | M | LATER (besluit B3) |
| Terugbetaling binnen 14 dagen bewaakt | L3 | half | reisbureau-teruggave.js | Een klaargezette teruggave die na 10 dagen niet is uitgevoerd, staat bovenaan bij het kantoor met de resterende dagen. | K | NU |
| Groepsreis: minimumaantal en annuleringstermijn | L2 | ontbreekt | art. 5, 12 | Een groepsreis toont het minimumaantal en de laatste dag waarop RTG mag annuleren; daarna kan het kantoor niet meer annuleren wegens te weinig deelnemers. | M | LATER |
| Gedeelde betaling per reisgenoot | L1/L6 | half | reisgezelschap-opties*.js | Elke reisgenoot betaalt zijn eigen deel; de reis heet pas betaald als alle delen binnen zijn; één weigering laat de andere betalingen staan en zegt wie nog moet. | G | LATER |
| Zakenreis: goedkeuring vooraf | L3 | ontbreekt | ISO 31030; GBTA | Een reis voor een bedrijf gaat pas naar het kantoor na een ja van de aangewezen goedkeurder in Onderneming; afwijzen met reden komt terug bij de reiziger. | M | LATER (eigenaar: Onderneming) |
| Echte boekingen bij vervoerders (GDS/NDC) | L2 | ontbreekt | TRAVELCOMMERCE.md:221 "jaren weg" | — | G | NIET nu: externe certificering en contracten; RTG bevestigt niets namens een partner. |
| Verstoringsbescherming verkopen (Hopper-model) | L1 | ontbreekt | hopper.com | — | G | NIET: is een verzekeringsproduct, financieel en juridisch geen standaardfunctie. |

**e. RTG-exclusief.** Het kantoor bevestigt met naam en reden, het lid stemt in bij elke wijziging, en de herkomst van elke euro is te zien (reisGeldrijen): een reis is bij RTG uitlegbaar tot op de euro, zonder commissie.

**f. Bouwstenen en ontbrekende koppelingen.** Bestaand: reisbureau*, pay.boekAsync, betaalwaarheid (Geld), factuurVoorLid (Geld), reisdossier, visumtaak, postvanger/mail. Ontbreekt: aanroep betaalwaarheid vanuit de reis, bewijs na betalen, de stand "bevestigd/onbetaald", een herhaalsleutel op aanvragen, een wereldingang.

### 3.2 Reizen & Veilig (`link:reizen`) en de wereldpagina

**a. Bewezen.** APPWERKT: bereikbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent, herstelbaar BEWEZEN; bedienbaar en bevoegd NIET_GETEST. Voltooiscenario `reizen.js` (Momenten). Kern: Live Circle-Momenten (kern/veiligheid/moment.js; exacte locatie alleen naar een connectie, nooit naar een bedrijf), reiswereld (projectie met `stil`), reiswacht (momentopname), reisoplosser (voert alleen een agendataak uit), reisgezelschap met instemming, Reiswijzer.

**b. Markt.** Tripsy/TripIt Pro: gasten uitnodigen, agenda-sync, alerts. Live-locatie delen is gratis bij grote platforms (*niet onderzocht met bron*).

**d. Catalogus**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Eén tijdlijn van de reis uit alle bronnen | L6 | bestaat | kern/reiswereld.js | Een reisdeel uit reisbureau, vlucht, verblijf, activiteit of invoer staat één keer op de tijdlijn; een uitgevallen bron staat als "stil" en de rest blijft. | — | — |
| Logeren bij leden in de tijdlijn | L6 | ontbreekt | thuisBoekingen niet in reiswereld/agenda/Move | Een bevestigd verblijf bij een lid staat in de reis, de agenda en Move, als projectie; eigenaar blijft thuis.html. | K | NU |
| Haalbaarheid van overstappen (Move) | L4 | bestaat/half | kern/move/*; hoteltijd NIET_TE_BEPALEN | Elke overgang krijgt ruim/krap/onhaalbaar of "niet te bepalen" met de reden; een onbekende tijd wordt nooit als ruim geteld. | — | — |
| Hoteltijden in de naad | L4 | ontbreekt | MOVE.md:198-202 | Een verblijf met een door de zaak opgegeven inchecktijd geeft een gewogen naad; zonder opgave blijft hij "niet te bepalen". | K | NU (de zaak levert het veld, geen verzonnen 15:00) |
| Herstelvoorstel bij vertraging | L4/L5 | half | gevolg.js (uitgevoerd:false) | Bij een opgegeven vertraging ziet het lid per geraakt onderdeel wat er breekt, één voorstel per onderdeel met kosten en wie het moet bevestigen; er verandert niets tot hij ja zegt. | M | NU |
| Wijzigen na toestemming (uitvoeren) | L5 | ontbreekt | MOVE.md:82-86 | Na een ja van het lid voert het domein dat de boeking bezit de wijziging uit via zijn eigen route; de bevestiging (of weigering) komt terug in het dossier. Geen boeking zonder ja. | G | LATER (per domein; begint bij reisbureau-wijziging) |
| Groepsbesluit | L1/L3 | bestaat | reisgezelschap-instemming.js | Een voorstel wordt bevroren met vingerafdruk; pas als iedereen instemt geldt het; een wijziging laat de versie vervallen. | — | — |
| Documentcontrole vóór vertrek | L4 | half | Reisboek (handmatig), visumtaak | Voor elke reis buiten Schengen of met een derdelander ziet het lid per reiziger: paspoort geldig tot ≥3 maanden na terugkeer (Schengen) en of een ETA/ESTA nodig is, met "regel per <datum>, controleer bij de autoriteit"; nooit "u mag reizen". | M | NU (regels als tabel in eigen huis; Timatic: NIET) |
| BZ-reisadvies en Informatieservice | L4 | ontbreekt | nederlandwereldwijd.nl | Het dossier toont de kleurcode van de bestemming met datum en bron en een link om je bij de Informatieservice te melden; RTG verzint geen kleur. | M | LATER (externe bron; eerst als link) |
| Achtergrondwacht | L4 | ontbreekt (bewust) | REIZEN.md:464-468; MOVE.md:252 | — | M | LATER: eigen besluit van de eigenaar (B4); verandert de belofte. |
| Realtime vlucht- en spoordata | L4 | ontbreekt | TRAVELCOMMERCE.md:199 "jaren weg" | — | G | NIET nu: externe licentie; tot dan heet bewaking een momentopname. |
| Assistentiemelding (PRM) | L1/L5 | ontbreekt | 1107/2006 art. 7 | Een lid met een toegankelijkheidsprofiel ziet bij elke vlucht/trein "meld vóór <T-48u/T-24u>"; RTG meldt het bij een eigen reis door en zet de bevestiging in het dossier. | M | LATER |

### 3.3 De reistab (`tab:reizen`)

**a. Bewezen.** Op deze tak: voltooiscenario `reistab.js` — voltooibaar 9/9, persistent 3/3, herstelbaar 4/4, menselijk 3/3 (agenda met geboekte vlucht, showroom met proefrit, bod, tekenen; ander lid 404). APPWERKT van de integratietak meet de tab nog als NIET_GETEST (geen eigen adres). De tab toont `trip` (dossier), het dagprogramma (`/api/agenda/mijn`) en de showroom.

**d. Catalogus**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Reiskaart met echte stand | L1 | half (K1) | app-main-45.js; reisdossier.js | De kaart toont per onderdeel "in aanvraag", "bevestigd, nog niet betaald" of "betaald" zoals de bron het zegt. | K | NU |
| Dagprogramma robuust per bron | L6 | half (K5) | spaarpot.js | Valt één bron uit, dan staan de andere punten er en zegt één regel welke bron nu niet rekent. | K | NU |
| Offline reisdossier | L1 | ontbreekt (K9) | public/sw.js:111 | Zonder netwerk ziet het lid zijn reis, contactpunt, BZ-nummer en documentenlijst met "laatst bijgewerkt <tijd>"; acties die geld of een partner raken staan uit met de reden. | M | NU |
| Contactkaart in het dossier | L2 | ontbreekt | art. 7.2.d, 16 | Elke bevestigde reis draagt het contactpunt van RTG en de lokale vertegenwoordiger (als die er is), offline leesbaar. | K | NU |
| Autoshowroom | L1 | bestaat | reistab.js | (bewezen) | — | — |

### 3.4 Reisboek (`link:reisboek`, Lifestyle)

**a. Bewezen.** APPWERKT: alle bewijzen BEWEZEN behalve bevoegd (NIET_GETEST); voltooiscenario `reisboek.js`. Eigen dossier in het levensdossier (legs, verblijven, documenten met geldigTot en waarschuwing binnen 90 dagen, programma) plus de gemeten reizen uit de reiswereld, client-side samengevoegd.

**d. Catalogus**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Handmatige reizen in de reiswereld | L6 | ontbreekt | rechterhand/reisboek.js; reiswereld.js:131 | Een zelf ingevoerde reis in het Reisboek telt mee in reiswacht, reisoplosser en Move, als bron "ingevoerd door u", nooit als bevestigd. | K | NU |
| Item bewerken | L5 | ontbreekt | reisboek.js | Een leg of document is te wijzigen zonder hem eerst weg te halen. | K | NU |
| Versleuteling van documentgegevens | L1 | half | enc() bestaat, niet gebruikt | Documentsoort, houder en geldigheid staan versleuteld; geen documentnummer (dat hoort in de identiteitskluis). | K | NU |
| Verblijven koppelen aan echte boekingen | L6 | ontbreekt | vrije tekst | Een verblijf in het Reisboek kan verwijzen naar een boeking in hotels.html of thuis.html; de boeking blijft van daar. | K | LATER |

### 3.5 Routedossier — buiten de reisfamilie

Inzage voor het kantoor in elf schakels per API-route (AUTH … PRIVACY). Bewezen: bereikbaar, bedienbaar, waarheidsgetrouw (APPWERKT); voltooiscenario `routedossier.js` op deze tak. Geen reisfunctie; voorstel aan de integrator: verplaats het naar de bewijsfamilie. Twee eerlijke gaten uit de code: OUTPUT en AUDIT staan voor elke route op ongemeten omdat niets het meet (office/dossier.js:111-115), en uitgaande kanalen vallen buiten SIDE_EFFECT.

### 3.6 Logeren bij leden (`/apps/thuis.html`) — onder TravelOS in de productindeling

Besluit van de eigenaar: vindbaar onder TravelOS; eigenaarschap en bronlogica blijven waar ze zijn (SCHERMEIGENAAR.json:291 `verblijf.logeren-bij-leden`; cluster :550-561 `eigenaar: null`; WERELDLIJST.md:86 LivingOS) tot een migratie bewezen veilig is. Wat er is: 21 routes `/api/thuis/*`, huizen en boekingen op codenaam, aanvragen/beslissen/in- en uitchecken, annuleringsbeleid flex/gemiddeld/streng, herhaalsleutel, deurcode pas 3 dagen vooraf.

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Gekeurde identiteit voor gast en gastheer | L1/L3 | ontbreekt | grep A3/volwassen leeg | Alleen een door RTG gekeurd, volwassen account boekt of verhuurt; een ongekeurd account krijgt geen deurcode en hoort waarom. | K | NU (veiligheid; bestaande `volwassen()`) |
| Betaling die de belofte waarmaakt | L5/L6 | ontbreekt | boeken.js:113 belooft RTG Pay | Er staat geen betaalbelofte meer op het scherm zolang er niet betaald wordt; of, na besluit, betaling via de betaalwaarheid met uitbetaling na uitchecken. | K (tekst) / M (betalen) | NU (tekst) / LATER (geld, besluit B5) |
| In agenda, reiswereld en Move | L6 | ontbreekt | zie 3.2 | Zie 3.2. | K | NU |
| Doel in SCHERMEIGENAAR corrigeren | — | fout | :2506-2510 | De beschrijving zegt "logeren bij leden", niet "woningdiensten". | K | NU |

## 4. Prioritering (de reisfamilie)

| # | Wat | Kosten | Afhankelijk van |
|---|---|---|---|
| 1 | K1 stand "bevestigd, nog niet betaald" + K4 overzicht | K | — |
| 2 | K2 betaalknop + Geld-voorstel betaalwaarheid + K3 bewijs + K7 ontdubbelen | M | Geld (betaalwaarheid, factuurVoorLid) |
| 3 | K8 herhaalsleutel aanvragen; K6 visumtaak in een net | K | — |
| 4 | K5 agenda per bron robuust | K | Versheid (ketenproef), eigenaar agenda |
| 5 | Wereldingang + APPWERKT/voltooiscenario reisbureau | K | integrator |
| 6 | K9 offline dossier + contactkaart | M | schil (sw.js) |
| 7 | Logeren: identiteitspoort, eerlijke betaaltekst, projectie in agenda/reis | K | eigenaar thuis.html |
| 8 | Wijziging door RTG met keuze van het lid | M | — |
| 9 | Documentcontrole als eigen regeltabel | M | — |

## 5. Open besluiten voor de eigenaar

- **B1** Is RTG organisator in de zin van de pakketreisrichtlijn, en welke insolventiebescherming hoort er in de bevestiging? (juridisch; RTG beslist dit niet zelf)
- **B2** Betalingsplan: aanbetaling en restbetaling, met vervaldatum (TRAVELCOMMERCE.md:241).
- **B3** Annuleringskosten en staffel (TRAVELCOMMERCE.md:244, :293).
- **B4** Achtergrondwacht: van momentopname naar belofte (REIZEN.md:464-468).
- **B5** Logeren bij leden: wordt er betaald via RTG, en wanneer gaat de uitbetaling naar de gastheer?
- **B6** ~~Is een reis een pasfunctie?~~ Beslist op 19 oktober: elk account dat gekeurd is met de paspoortpoort mag boeken en betalen (par. 1.5).

## 6. Toetsbaar eindcontract Beyond Premium — de reisfamilie

Vult de acht bestaande bewijzen aan, vervangt ze nooit. Elk punt is een toets die zakt of slaagt.

| Dimensie | Toets |
|---|---|
| Functionele breedte | Aanvragen, bevestigen, betalen, bewijs, wijzigen (beide richtingen met instemming), afzeggen met teruggave, dagprogramma en dossier zijn elk met één scenario te lopen. |
| Professionele diepte | Bevestiging op duurzame drager met de verplichte inhoud; prijs- of reiswijziging altijd met keuze; terugbetaling binnen 14 dagen bewaakt. |
| Volledige levenscyclus | Elke reis doorloopt aangevraagd → bevestigd/onbetaald → betaald → (gewijzigd) → vertrokken → afgerond of afgezegd → teruggegeven, en geen stand wordt overgeslagen of verzonnen. |
| Samenwerking en rollen | Kantoor beslist met naam en reden; reisgenoten stemmen elk zelf in; een goedkeurder van een bedrijf (later) zegt ja vóór het kantoor; een ander lid ziet niets (404). |
| Domeinintelligentie | Haalbaarheid per overgang met reden; een onbekende tijd heet "niet te bepalen"; een herstelvoorstel noemt kosten, risico en wie bevestigt; elke externe of voorspelde waarde draagt zijn bron en "onzeker". |
| Los functioneren | Met Agenda en Geld uit lukt aanvragen en inzien, en zegt het scherm eerlijk wat niet kan; offline is het dossier leesbaar. |
| RTG-ketens | Reis → betaalbewijs (Geld) → agendapunt (projectie) → dossier, zonder dat één app de gegevens van een ander kopieert; logeren bij leden verschijnt in dezelfde keten. |
| Bewezen betrouwbaarheid | Het ketenscenario van par. 1.3 slaagt in de voltooiwereld met dubbeltik, afgebroken verzoek, crash en herstart, en nergens heet iets betaald dat niet betaald is. |

---

# Deel 2: de andere TravelOS-apps

Zelfde legenda als deel 1. Per app: (a) bewezen werkelijkheid, (b) markt, (c) domein, (d) catalogus, (e) RTG-exclusief, (f) bouwstenen en gaten. De prioritering en het eindcontract per app staan onderaan (par. 9-10).

## 7. Onderweg en ter plaatse

### 7.1 Ter plaatse (`tab:terplaatse`)

**a.** Op deze tak: voltooiscenario `terplaatse.js` (voltooibaar 9/9, persistent 3/3, herstelbaar 4/4, menselijk 3/3) voor verhuur en huurcontract, met de herhaalsleutel op `/api/huur/boek` (commit b102eaef). Niet bewezen: tickets en transfer, charter (boten), vastgoed, bezorgen. Eén annuleerroute `/api/annuleer` voor order/rit/ticket/boeking (kern/ervaring/leden/annuleren.js:53-121).
**b.** Huur: Hertz Gold Plus en Sixt ONE zijn gratis loyaliteitsprogramma's, geen betaalmuur (hertz.com/us/en/gold-plus-rewards; sixt.com help-center, 19-10-2026).
**c.** Autohuur valt niet onder de SGR als losse dienst (zie 2.1). Huurrechten: vaste prijs vooraf, schadestaat bij uitgifte en inname.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Geld echt bewegen bij `/api/booking/pay` | L5/L6 | half | lidacties.js:75-106 zet alleen `paid=true`; annuleren.js:22-24 | Een ticket of huur heet betaald na een RTG Pay-boeking; bij annuleren gaat het geld aantoonbaar terug. | M | NU (met Geld) |
| Huur of charter wijzigen | L5 | ontbreekt | huur.js | Een lid verzet zijn huurperiode zolang de auto niet is uitgegeven; overlap geeft een weigering in woorden; de prijs wordt opnieuw gerekend en hij bevestigt. | M | LATER |
| Bod of bezichtiging intrekken | L5 | ontbreekt | vastgoed.js | Een lid trekt zijn eigen bod of bezichtiging in; de makelaar ziet dat meteen. | K | NU |
| Tickets met transfer als keten | L6 | half | kopen/tickets.js:66 | Een ticket met transfer staat in de reis en de agenda; vertraagt het evenement, dan geeft Move het gevolg voor de transfer. | M | LATER |
| Scenario's tickets/charter/vastgoed/bezorgen | — | ontbreekt | — | Elk onderdeel heeft een eigen voltooiscenario. | M | NU |

**e.** Schadestaat met foto's door beide partijen en SOS tijdens de huur: tegen schimmig verhuren (huur.js-kop).

### 7.2 Aankomst (`link:aankomst`, Invisible Arrival)

**a.** Voltooiscenario `aankomst.js` 10/3/4/3; arrival-security- en arrivalpas-toetsen 13/13; account verplicht met de pass als tweede sleutel (17fe7717); accountdeur in het scherm (e2b57ad6, browsertoets). Een ander account met dezelfde pass: 404.
**b.** OpenTable, Resy en SevenRooms: de gast betaalt niets; het restaurant betaalt per maand (OpenTable Basic $149, Core $299, Pro $499 plus per gast; Resy $289-459; SevenRooms prijs niet openbaar) — restaurant.opentable.com/products, resy.com/resyos/plans-and-pricing, sevenrooms.com/pricing (19-10-2026). Extra voor gasten loopt bij Resy via een creditcard (Amex Global Dining Access).
**c.** Allergie en toegankelijkheid zijn veiligheidsbeloften die alleen een mens van de zaak bevestigt (dat doet het scherm al: `wacht-op-mens`).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Reservering annuleren vanuit de pass | L5 | ontbreekt | arrival-toegang.js:63 (intrekken laat reservering staan) | Het lid annuleert zijn tafel in hetzelfde scherm; de zaak ziet het en de pass sluit. | K | NU |
| Aankomst in de reis en Move | L6 | half | reserveringen in agendaVoor | Een tafel uit Aankomst staat in de reis; Move rekent de naad van de vorige afspraak naar de tafel. | K | NU |
| Kop plaatsnadering.js bijwerken | — | verouderd | "pass is anoniem" | De kop zegt dat de pass aan een account hangt. | K | NU |
| Capaciteitsscore uitleggen | L4 | half | heuristiek (invisible-arrival.js:20) | De score toont waarop hij rekent en heet "schatting". | K | LATER |

### 7.3 Vluchten (`link:vluchten`)

**a.** Voltooiscenario `vluchten.js`; herhaalsleutel op charter (416d8740). Bord, boeken met paspoortpoort (428), inchecken, boarding pass met eenmalige code, roteren en intrekken. **Demo**: de luchthaven LUCHT en de vluchten bestaan alleen met `RTG_MAGNAAT_TEST` (luchthaven/index.js:71-95). Er bestaat geen prijs of betaling.
**b.** Flighty Pro $59,99/jaar: Where's My Plane, vertragingsvoorspelling, meldingen vóór de airline (flighty.com/pricing). Flightradar24 Silver/Gold/Business (flightradar24.com/premium). TripIt Pro alternatieve vluchten. AirHelp+ compensatie zonder commissie.
**c.** EU261: zorg 2/3/4 uur, omboeken of terugbetalen, compensatie €250/400/600 vanaf 3 uur; PRM-melding 48 uur; documenten (Schengen, ETA, ESTA).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Eigen vlucht annuleren | L5 | ontbreekt | geen route | Een lid annuleert een niet-ingecheckte boeking; de pass sluit en de agenda vervalt. | K | NU |
| Melding bij charterbesluit | L5 | ontbreekt | royaal.js | Bevestigt of weigert operations een charter, dan hoort het lid het met de reden. | K | NU |
| EU261-rechtenkaart bij vertraging | L4 | ontbreekt | 261/2004 | Bij een door de luchthaven gemelde vertraging ziet het lid welke zorg en welke compensatie de regel noemt voor deze afstand, als "regel, de maatschappij beslist", met de drempels. | M | LATER |
| Realtime vluchtdata | L4 | ontbreekt | TRAVELCOMMERCE.md:199 | — | G | NIET nu: licentie en jaren weg; tot dan "demo op eigen gegevens" (REIZEN.md:180-183). |
| Charter buiten de transactie | L5 | defect | royaal.js:58-61 | charterBeslis schrijft binnen dezelfde transactie als de boarding pass. | K | NU |

### 7.4 Hangar (`link:hangar`, Lifestyle)

**a.** Logboek van eigen toestellen en vluchten in het levensdossier; AI-vraag met "u belooft nooit een slot of vergunning". Geen planning of boeking. Los van kern/luchthaven, terwijl reiswereld charters als "Hangar" labelt (reiswereld-bronnen-rtg.js:60-63).
**b.** Jetkaarten en lidmaatschappen (NetJets Private Jet Card; Wheels Up vanaf $200.000) — netjets.com, investors.wheelsup.com (19-10-2026; uurprijzen niet bevestigd).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Charters uit Vluchten tonen | L6 | ontbreekt | reiswereld-bronnen-rtg.js | Een charteraanvraag staat in de Hangar, met link naar Vluchten waar hij woont. | K | NU |
| Bemanningsuren en onderhoudsdatum | L2 | ontbreekt | hangar.js | Het logboek telt uren per toestel en waarschuwt bij een opgegeven onderhoudsgrens; "u voert het in, RTG keurt niets". | M | LATER |
| Slots, vliegplannen, vergunningen | L2 | ontbreekt | — | — | G | NIET: luchtvaartautoriteit en operator; RTG belooft het niet. |

## 8. Bewegen

### 8.1 Move (`link:move`)

**a.** Voltooiscenario `move.js`; tijdzone van de zaak (fa381ae6). Rekent per overgang ruim/krap/onhaalbaar/niet te bepalen, met reden; `gevolg` geeft voorstellen met `uitgevoerd:false, bevestigt:'een mens'`. Schrijft niets.
**c.** MCT per luchthaven; zelf samengestelde overstap onbeschermd; trein 100 minuten; de reis als klok (2.2).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Hoteltijd uit de zaak | L4 | ontbreekt | MOVE.md:198-202 | Zie 3.2. | K | NU |
| Overstapbescherming herkennen | L4 | ontbreekt | IATA MCT | Twee vluchten op aparte boekingen krijgen "zelf samengestelde overstap: niet beschermd" naast het oordeel; een eigen MCT-waarde wordt alleen gebruikt met bron. | M | LATER |
| Gevolg naar herstelvoorstel | L4/L5 | half | gevolg.js | Zie 3.2. | M | NU |
| Bereikbaarheid met OV | L4 | ontbreekt | navRoute modus auto | De naad rekent ook met de lijnen uit OV (frequentie, geen dienstregeling) en zegt dat. | M | LATER |
| `vooraf` op het scherm | L1 | ontbreekt | MOVE.md:179 | Het lid ziet vóór hij iets toevoegt wat het met zijn reis doet. | K | NU |

### 8.2 OV (`link:ov`) en OV-routes (`link:ovroutes`)

**a.** OV: voltooiscenario `ov.js`; kaartje en abonnement met herhaalsleutel en 409 bij een ander product (91a1b432). Inchecken met eenmalige QR of GPS binnen 150 m; teruggave alleen via een storing van de vervoerder (50/100%). OV-routes: voltooiscenario `ovroutes.js`, persona `personeel` (0defbbf5); lijnen direct live, zonder concept, versie of audit. Demo-vervoerder TRANSIT.
**b.** Citymapper Club (nu vooral advertentievrij), Moovit+ (SafeRide, routes vergelijken), Transit Royale (vervoerders betalen het voor hun reizigers) — citymapper.com/news/2589, moovit.com/press-releases/moovit-plus-features, help.transitapp.com (19-10-2026).
**c.** Treinrechten 2021/782 (25/50%, zelf omreizen na 100 min); busrechten 181/2011.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Kaartje of abonnement zelf terugvragen | L5 | ontbreekt | storing.js | Een ongebruikt kaartje is terug te vragen volgens de regel uit de overeenkomst; wordt het geweigerd, dan staat de reden erbij. | M | LATER (regel komt uit de overeenkomst) |
| Lijn als concept en daarna publiceren | L3 | ontbreekt | dienst.js | Een gewijzigde lijn is pas zichtbaar voor leden na "publiceren"; er is een vorige versie. | M | NU |
| Audit op lijnwijzigingen | L3 | ontbreekt | dienst.js (geen logActivity) | Elke wijziging staat in het logboek van de zaak met wie en wanneer. | K | NU |
| Verwijderen met lopende ritten | L5 | ontbreekt | dienst.js:91-97 | Een lijn met lopende ritten of geldige kaartjes is niet te verwijderen; de manager hoort waarom. | K | NU |
| Rit in de agenda | L6 | ontbreekt | geen agendakoppeling | Een geplande OV-reis staat in de agenda als projectie. | K | LATER |
| ovOverzicht filteren op de zaak | L3 | defect | dienst.js:130 | Het overzicht van een zaak telt alleen de eigen operaties. | K | NU |
| Echte dienstregeling (GTFS/NDOV) | L4 | ontbreekt | — | — | G | NIET nu: externe bron en licentie. |

### 8.3 Navigatie (`link:navigatie`)

**a.** Voltooiscenario `navigatie.js` met een NWB-fixture langs de echte importroute (3396809e); 13/3/5, menselijk open door de bewust bewaarde 503. Eigen A*, gebieden, pakketten met ODbL-vermelding, partnerevents.
**b.** TomTom GO (abonnement, offline, flitspalen), Sygic Premium+ (offline 3D, rijstroken), HERE WeGo (gratis, offline) — tomtom.com newsroom, sygic.com, here.com (19-10-2026; prijzen niet bevestigd).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Offline routeren | L1 | ontbreekt | KAARTEN.md:149-154 | Met een gedownload gebied rekent het toestel een route zonder netwerk en zegt dat verkeer niet meetelt. | G | LATER |
| OSM-bouwer voor gebieden | L2 | ontbreekt | KAARTEN.md:137-148 | Een gekozen gebied wordt een pakket uit OSM met vermelding. | G | LATER (extern: download geweigerd) |
| Huisnummers en postcodes | L1 | ontbreekt | NAVIGATIE.md:918-923 | Zoeken op adres vindt een huisnummer, met bron (BAG). | M | LATER |
| Manifest ondertekenen | L3 | ontbreekt | pakket.js | Een pakket draagt een handtekening die het toestel controleert. | K | NU |

### 8.4 Flits (`link:flits`, "Verkeer")

**a.** Voltooiscenario `flits.js` 8/3/4/3; eigen melding niet zelf bevestigen (af180843). Vijf soorten met levensduur, ontdubbelen binnen 300 m, stemmen.
**b.** Flitsmeister PRO €1,99/mnd (geen reclame, CarPlay, trajectcontrole-snelheid) — flitsmeister.nl/pro; Coyote Premium €14,99/mnd — moncoyote.com; Waze flitsers standaard aan — support.google.com/waze (19-10-2026).
**c.** Flitswaarschuwing tijdens het rijden verboden in Duitsland (€75 en 1 punt), volledig verboden in Zwitserland, in Frankrijk alleen "zones de danger" (bronnen: TomTom-help, recht24-7.de; geen overheidsbron). Nederland: geen bron gevonden.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Land bepalen op de server | L4 | defect | flits.html:136 `LAND='ES'`, client kiest | De landregel gebruikt de positie van de melding op de server; een flitser melden in DE, CH, FR (als exacte plek) geeft de weigering, ongeacht wat de client stuurt. | K | NU (juridisch) |
| Eigen melding intrekken | L5 | ontbreekt | flits.js | Een melder trekt zijn eigen melding in; hij verdwijnt voor iedereen. | K | NU |
| Codenaam van de melder niet tonen | L1 | ontbreekt | flits.html:199,234 | Andere leden zien soort, plek en leeftijd, niet wie het meldde. | K | NU (privacy) |
| Wegwerk uit het stadsweefsel | L6 | ontbreekt | geen koppeling | Een werkorder van de gemeente op een weg verschijnt als wegwerk met bron "gemeente". | M | LATER |
| Vooruitblik niet hard op Ibiza | L1 | defect | flits.html:247 | De vooruitblik volgt de plek van het lid. | K | NU |

## 9. Verblijven en de plek

### 9.1 Stad (`link:stad`)

**a.** Voltooiscenario `stad.js`; herhaalsleutel op de melding (416d8740). Het scherm is een bewonersscherm: stand van de stad, melden, mijn meldingen. Onder de motorkap veel meer: stadsweefsel (assets, werkorders, voorzieningen, begroting, inspraak, algoritmeregister), ~80 kantoorroutes zonder scherm, en openbare API's voor algoritmes, besluiten en raadplegingen zonder scherm. Demo: één fictieve stad met 6 zones.
**b.** FixMyStreet Pro (gemeente betaalt £15.000-56.000/jaar; G-Cloud 2026), SeeClickFix (gemeente betaalt), BuitenBeter (gratis voor de bewoner) — bronnen 19-10-2026.
**c.** De ambitie van de eigenaar: een digitaal stadsmodel met meldingen, voorzieningen, werkzaamheden, participatie en transparantie.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Doel in SCHERMEIGENAAR rechtzetten | — | fout | :2470-2474 "verkennen tijdens een reis" | De doeltekst zegt wat het scherm doet; of verkennen erbij hoort is een besluit. | K | NU |
| Melding aanvullen, intrekken, heropenen | L5 | ontbreekt | bewoner.js | De melder voegt een foto of tekst toe, trekt in, of heropent binnen 14 dagen na "klaar"; de ploeg ziet het. | M | NU |
| Werkzaamheden op een kaart | L3/L6 | half (kantoor) | weefsel2.js:116 hinder | De bewoner ziet lopende en geplande werkzaamheden in zijn zone met einddatum en bron "gemeente". | M | NU |
| Raadplegingen en besluiten zichtbaar | L3 | half (API zonder scherm) | stad.js:49-58 | Een open raadpleging is te lezen en te beantwoorden; een besluit staat met datum en motivering. | M | NU |
| Algoritmeregister zichtbaar | L3 | half (API zonder scherm) | stad.js:40-41 | Elk gebruikt algoritme staat met doel, gegevens en wie verantwoordelijk is. | K | NU |
| Voorzieningen per wijk | L3 | half | voorzieningen.js | De bewoner ziet de voorzieningen in zijn wijk, zonder personen. | K | LATER |

### 9.2 Residentie (`link:residentie`, menulabel "Verblijven")

**a.** Voltooiscenario `residentie.js` 9/3/4/3; suite begint dicht (dd55bcf7). Een virtueel grandhotel: zalen, chat, spellen, eigen suite. Heeft niets met echte verblijven te maken (dat is `verblijf.hotel` → hotels.html).
**b.** Habbo Club $3,99/31 dagen (exclusieve items, groter vriendenlijstje) — help.habbo.com (19-10-2026).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Menulabel "Verblijven" corrigeren | — | fout | app-main.js:4040 | Het menu noemt dit "Residentie"; "Verblijven" is de hotelboeking. | K | NU |
| Melden en blokkeren van leden | L1/L3 | ontbreekt | grep leeg | Een lid meldt of blokkeert een ander in een zaal; een geblokkeerd lid ziet zijn chat niet; het kantoor ziet de melding. | M | NU (veiligheid) |
| 18+-poort op het gewaagde vragendek | L1 | ontbreekt | rahul.js:4-5, spel.js:123-131 | Het gewaagde dek opent alleen voor twee volwassen, gekeurde accounts (`volwassen()`). | K | NU |
| Suite resetten | L5 | ontbreekt | suite.js | Het lid zet zijn suite terug naar de standaardinrichting. | K | LATER |

## 10. Prioritering en eindcontract, deel 2

**Aanbevolen nu, klein** (veiligheid, eerlijkheid of een kapotte belofte): Flits landregel op de server, codenaam melder verbergen en vooruitblik niet hard op Ibiza; Residentie 18+-poort, melden/blokkeren en menulabel; Stad doeltekst, algoritmeregister zichtbaar; OV-routes audit, verwijderen met lopende ritten, overzicht per zaak; Vluchten eigen annuleren, melding charterbesluit, charter in de transactie; Aankomst annuleren vanuit de pass, kop bijwerken; Hangar charters tonen; Move `vooraf` op het scherm; Navigatie manifest ondertekenen; Ter plaatse bod intrekken.

**Aanbevolen nu, middel**: Ter plaatse geld echt bewegen bij `booking/pay` (met Geld) en de ontbrekende scenario's; Stad melding aanvullen en heropenen, werkzaamheden en raadplegingen zichtbaar; OV-routes concept en publiceren; Move herstelvoorstel (met deel 1).

**Later**: offline routeren en OSM-bouwer, huisnummers, EU261-rechtenkaart, overstapbescherming, OV-bereikbaarheid, kaartjes terugvragen, huur wijzigen, Hangar-onderhoud.

**Niet doen nu, en waarom**: realtime vlucht- en spoordata en een dienstregeling (externe licentie, "jaren weg"; tot dan heet het een demonstratie op eigen gegevens); slots en vergunningen in de Hangar (luchtvaartautoriteit); GDS/NDC (deel 1).

**Eindcontract per app, acht dimensies.** Voor elke app in deel 2 geldt hetzelfde contract als in par. 6, met deze app-eigen toetsen:

| App | Los functioneren | RTG-keten | Bewezen betrouwbaarheid (naast de acht bewijzen) |
|---|---|---|---|
| Ter plaatse | huren en tekenen lukken zonder Agenda | huur → betaalbewijs → reis | verhuur, tickets, charter, vastgoed, bezorgen elk een scenario |
| Aankomst | pass werkt zonder plaatslaag (handknoppen) | tafel → reis → Move | ander account 404, browsertoets accountdeur |
| Vluchten | bord en pass zonder Agenda | boeking → visumtaak → reis → Move | annuleren en charterbesluit in het scenario |
| Hangar | logboek zonder Vluchten | charter uit Vluchten zichtbaar | ander lid ziet niets |
| Move | oordeel zonder navigatie heet "niet te bepalen" | gevolg → herstelvoorstel → domein voert uit na ja | onbekende tijd nooit "ruim" |
| OV / OV-routes | inchecken zonder Geld zegt waarom niet | lijn → kaart → kaartje → teruggave bij storing | geen lijnwijziging zonder audit |
| Navigatie | met gedownload gebied (later) | route → Move | 503 zonder net in woorden |
| Flits | melden zonder navigatie | melding → navigatie; werkorder → wegwerk | landregel op de server getoetst |
| Stad | melden zonder gemeente-koppeling zegt dat | melding → zaak → werkorder → klaar → melder | melder blijft codenaam |
| Residentie | zalen zonder Salon | suite dicht tot het lid opent | 18+-poort en blokkeren getoetst |

---

# Deel 3: twee uitkomsten per app

Op verzoek van de eigenaar staan per app twee uitkomsten naast elkaar.
- **A. Binnen de huidige architectuur en scope:** de NU- en LATER-regels uit de catalogi hierboven, samengevat. Er komt geen nieuwe laag en geen centrale database bij.
- **B. Het domeinmaximum, ook buiten de scope:** compleet nieuwe professionele processen, met eerlijk erbij wat ervoor nodig is, zoals licenties, certificering, contracten, mensen en wetgeving.

B is een richting en geen belofte. Wat bij B staat zonder bron uit het onderzoek, is eigen vakkennis en staat als *niet nagelopen*.

| App | A — binnen de architectuur | B — domeinmaximum (nieuwe processen) | Wat B vraagt |
|---|---|---|---|
| **Reisbureau** | K1-K9 dichten; betalen via de betaalwaarheid met bewijs; bevestiging op duurzame drager; wijziging door RTG met keuze van het lid; teruggave binnen 14 dagen bewaakt. | **Volledige organisator- en agentuurketen.** Echte boekingen bij vervoerders en hotels via een consolidator of GDS/NDC, met tickets op naam. Een **mid- en backoffice** met inkoopfacturen van partners, marge per reis en de btw-reisbureauregeling (margeregeling). Een **betalingsplan** met aanbetaling, restbetaling, herinneringen en annuleringsstaffel. **Groepsreizen** met kamerblokken, attrition, cut-off, rooming list en reisleider. Een **zakelijk travelmanagement**: reisbeleid per bedrijf, goedkeuring vooraf, kostenplaatsen, verzamelfactuur, ongebruikte tickets terugwinnen. | IATA-accreditatie of een host-agency; NDC-certificering per maatschappij; contracten met consolidator en hotelbanken. Inschrijving als organisator met insolventiebescherming (SGR) en een besluit over B1. Een fiscaal advies over de margeregeling (*niet nagelopen*). Reisadviseurs als mensen. Voor zakelijk een koppeling met Onderneming (eigenaar). Jaren werk, deels buiten RTG's macht. |
| **Reizen & Veilig** | Logeren bij leden in de tijdlijn; hoteltijden in de naad; herstelvoorstel; documentcontrole als eigen regeltabel; PRM-melding. | **Reiscontinuïteit als dienst.** Een **24/7 assistentiedesk** van mensen die bij een incident de reis herstellen (omboeken, hotel, terugreis), met de hulpplicht van art. 16 als minimum. **Traveller tracking voor werkgevers** volgens ISO 31030: wie is waar bij een incident, tweerichtingsbericht, binnen 2 uur contact. **Massamelding** bij een crisis, gekoppeld aan het BZ-reisadvies. Een **achtergrondwacht** met push. | Een bemande meldkamer (diensten, protocol, aansprakelijkheid). Een externe bron voor reisadvies en incidenten (licentie of een afspraak met BZ). Besluit B4 (achtergrondwacht). Toestemming van de reiziger voor locatie per reis (privacy by design). |
| **Reistab** | Echte standen op de reiskaart; agenda robuust per bron; offline dossier met contactkaart. | **De reis in de wallet van het toestel**: instapkaart, hotelsleutel, tafel en ticket als pass met live stand. Een **reisdagboek** dat na de reis het bewijs bundelt (bonnen, bevestigingen, foto's) voor declaratie of claim. | Certificaten voor Apple Wallet en Google Wallet; afspraken met partners voor live updates; een besluit over bewaartermijnen. |
| **Reisboek** | Handmatige reizen in de reiswereld; item bewerken; versleutelen; verwijzen naar echte boekingen. | **Automatisch reisdossier uit eigen mail**: de reiziger stuurt een bevestiging door, RTG leest hem lokaal en zet hem in het dossier als "ingevoerd, niet bevestigd door RTG". Een **gezinsreisboek** met documenten per kind en een toestemmingsbrief voor een minderjarige die alleen met één ouder reist. | Lokale extractie zonder extern model (AI lokaal-eerst); toestemming per mailbox; Gezin als eigenaar van de gezinsrollen. |
| **Ter plaatse** | Geld echt bewegen bij `booking/pay`; bod intrekken; huur wijzigen; scenario's per onderdeel. | **Verhuur met een echte borg**: een voorautorisatie op de kaart, en vrijgave na de schadestaat. Een **schadeclaimproces** met foto's van beide partijen, termijnen en arbitrage door RTG. **Tickets met dynamische toegang** (roterende code, overdragen aan een reisgenoot). | Een PSP met voorautorisatie, geregeld via Geld; voorwaarden voor schadeafhandeling; een besluit of RTG arbiter mag zijn. |
| **Aankomst** | Annuleren vanuit de pass; tafel in reis en Move; uitleg van de capaciteit. | **Venue-orkestratie**: de aankomst stuurt tafel, keuken, parkeren, toegankelijke route en de allergiebriefing, ook bij zaken met een eigen reserveringssysteem. Een **no-showbeleid** met aanbetaling, met het geld via Geld. | Koppelingen met de systemen van de zaken (per zaak een afspraak, nooit een merk als partner opvoeren); de horecafamilie als eigenaar van de keukenkant. |
| **Vluchten** | Eigen annuleren; melding bij een charterbesluit; charter in de transactie; EU261-rechtenkaart. | **Echte vluchtstatus en omboeken bij verstoring.** Dienstregelingen en live status, met omboeken over maatschappijen heen. Een **EU261-claimdienst** zonder commissie, met machtiging, indienen, opvolgen en uitbetaling via Geld. De **PRM-melding** automatisch naar de maatschappij. | Een licentie op een databron voor vluchten, met de naam niet genoemd tot er een contract is. Interline-afspraken of ticketing (zie Reisbureau). Voor claims een juridische opzet en een besluit of RTG dat mag (klasse "voorbehouden" totdat het besloten is). |
| **Hangar** | Charters uit Vluchten tonen; bemanningsuren en onderhoud als eigen logboek. | **Privéluchtvaart-operatie**: vliegplannen, slots, bemanningsroosters met vlieg- en rusttijden, onderhoudsbeheer (CAMO) en een jetkaart met een urensaldo in Geld. | Een luchtvaartmaatschappij of operator met de juiste vergunningen. RTG is dat niet en belooft het niet. Een partnerschap met een operator; regels voor vliegtijden (*niet nagelopen*). |
| **Move** | Hoteltijd uit de zaak; `vooraf` op het scherm; herstelvoorstel; OV-bereikbaarheid. | **Een voorspellende reisgraaf**: realtime vlucht-, spoor- en verkeersdata met een kansband (nooit een feit), beschermde en onbeschermde overstappen (MCT), en een achtergrondwacht die herstelt en na een ja via de domeinen omboekt. | Realtime bronnen (spoor, NDW-verkeersdata, vluchtdata) met licenties; besluit B4; een eerlijke kalibratie van de kansband op gemeten data. |
| **OV** | Concept en publiceren van lijnen; audit; verwijderen met lopende ritten blokkeren; rit in de agenda. | **Een vervoerdersplatform**: dienstregeling (GTFS en GTFS-RT), voertuigomloop, chauffeursdiensten, reizigersinformatie op haltes, inchecken met de bankpas, en concessierapportage aan de OV-autoriteit. | Integratie met het landelijke betaalsysteem (afspraken met de partijen achter het OV), open OV-data (NDOV) en een vervoerder als klant. Het zijn concessiecontracten en geen app-functies (*niet nagelopen*). |
| **OV-routes** | Zie OV. | **Lijnplanning met dienstregelingsexport** (GTFS) en een proefrit-simulatie op echte reistijden. | Wegennet en reistijden uit Navigatie; een vervoerder als klant. |
| **Navigatie** | Manifest ondertekenen; later offline routeren, de OSM-bouwer en huisnummers. | **Volwaardige navigatie**: gesproken instructies per afslag, rijstroken, vrachtwagen- en EV-routes met laadpalen, verkeer uit open data, en offline routeren per gebied. | Een routeermotor op het toestel; open verkeersdata (NDW, DATEX II); laadpaaldata van de partijen in de keten; BAG voor adressen; veel testkilometers. |
| **Flits** | Landregel op de server; melder verbergen; intrekken; wegwerk uit de gemeente. | **Een verkeersveiligheidsnetwerk**: officiële data voor trajectcontroles en wegwerk, per land de wettelijke grens met juridische toetsing, en terugkoppeling aan wegbeheerders. | Open data van wegbeheerders; een jurist per land (welke meldingen mogen); afspraken met gemeenten. |
| **Stad** | Doeltekst; aanvullen en heropenen; werkzaamheden, raadplegingen en het algoritmeregister zichtbaar. | **Een digitale tweeling van de gemeente**: melding openbare ruimte gekoppeld aan het zaaksysteem van de gemeente, kaartlagen uit BGT en BAG, een participatieplatform met besluitvorming, een open begroting, open data en een algoritmeregister volgens de rijksstandaard. | De standaarden van de gemeenten (VNG, *niet nagelopen*); een gemeente als klant met verwerkersovereenkomst; toegankelijkheid op overheidsniveau (WCAG). |
| **Residentie** | 18+-poort; melden en blokkeren; menulabel; suite resetten. | **Een besloten sociaal platform met moderatie op niveau**: melden en optreden met motivering en beroep, virtuele evenementen van partners, en een eigen hotelbeleving die naar echte verblijven verwijst. | De regels van de Digital Services Act voor hostingdiensten (melden en optreden, motivering) (*niet nagelopen*); mensen voor moderatie; een besluit over evenementen van partners. |
| **Logeren bij leden** | Identiteitspoort; eerlijke betaaltekst; in agenda en reis; doeltekst. | **Een volledig deelplatform voor verblijven**: betaling met uitbetaling aan de gastheer na het uitchecken, borg, beoordeling over en weer, verzekering voor gastheren en de meldplichten van de gemeente voor toeristische verhuur. | Geld (uitbetaling, borg); een verzekeraar; de lokale regels voor verhuur en toeristenbelasting per gemeente (*niet nagelopen*); besluit B5. |
