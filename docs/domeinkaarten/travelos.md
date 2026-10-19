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
| Restbetaling | uiterlijk 6 weken vóór vertrek is branchegewoonte | voorwaarden van organisaties (zoekresultaat). *Te controleren:* een gemelde uitspraak dat annuleren wegens te late betaling een waarschuwing vooraf vraagt; de uitspraak zelf is niet geopend en telt hier niet als bron (zie par. 5a). |
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

**Legenda.**
- Stand: bestaat / half / ontbreekt.
- Kosten: K klein (een dag, één module), M middel (meerdere modules of een nieuw scherm), G groot (een nieuwe externe afhankelijkheid of meerdere families).
- Bak:
  - **HERSTEL**: iets is nu onwaar, onveilig of in strijd met een huisregel.
  - **VERDIEPING**: nieuwe waarde binnen de architectuur.
  - **LATER**: hangt aan een besluit of een afhankelijkheid.
  - **NIET**: met de reden erbij.
- Lagen: L1 persoonlijk, L2 professioneel (via de bestaande genres), L3 organisatorisch, L4 domeinintelligentie, L5 levenscyclus, L6 RTG-samenhang.

Elke functiekaart heeft acht velden:
1. Gegevens (wat er nodig is en waar het vandaan komt)
2. Regels (regels en grenzen)
3. Rekenen (hoe er gerekend of besloten wordt)
4. Onzekerheid (welke er is en hoe het scherm die toont)
5. Melden (wie wanneer iets hoort)
6. Rollen (wie meedoet en wie toestemming geeft)
7. Uitzonderingen
8. Klaar als (het acceptatiecriterium)

**LOS in drie groepen** is de harde producteis, getoetst vanuit het lid. *Eigen* is wat de app zelf doet. *Platform* zijn de noodzakelijke platformdiensten: zonder die werkt niets, en het scherm zegt dat. *Optioneel* zijn de koppelingen: valt er een uit, dan blijft de kerntaak werken, en de schermtekst staat erbij.

### 3.1 Reisbureau (`/apps/reisbureau.html`): de boeking zelf

**a. Bewezen werkelijkheid.**
- Werkt: aanvragen, advies (`/advies`), annuleren, wijzigen (een verzoek; het kantoor beslist), afzeggen met teruggaverecht, en betalen in de kern (`reisbureau-betaling.js`, idempotent op `pay-handeling:[reis, ref]`).
- IDOR (integratietak, 19 oktober): `boek`, `betaal`, `annuleer`, `wijzig` en `thuis` zijn **gescheiden**; een ander account krijgt 404.
- Poorten (Geld, 960cc45a): aanvragen vraagt een account, betalen ook de paspoortpoort.
- K1 is gerepareerd (eb4f7f02b): bevestigd heet "nog niet betaald".
- K7 is gerepareerd door Geld (6016db28).
- Niet gemeten: er is geen APPWERKT-rij, geen voltooiscenario en geen BEVOEGD-rij. Het scherm staat in geen enkele wereld.

**b. Markt.** TripIt en Tripsy organiseren wat elders geboekt is; zelf boeken ze niet. Hopper en AirHelp verkopen bescherming bij verstoring. Een reisbureau-app met een adviseur, bevestiging en teruggave in één keten is in de gevonden bronnen niet als consumentenabonnement te koop.

**c. Domein.** Zie par. 2.

**d. LOS in drie groepen**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | aanvragen, inzien, annuleren, wijziging vragen, afzeggen, advies (lokaal regelwerk, geen model) | — |
| Platform | sessie en account, de gegevenspoort (contactgegevens), opslag | "Uw reis is nu niet te laden. Er is niets veranderd; probeer het zo opnieuw." |
| Optioneel: Geld | betalen, betaalbewijs | "Betalen kan nu niet. Uw reis blijft bevestigd en staat als nog niet betaald." |
| Optioneel: Agenda | visumtaak, dagprogramma | "Uw agenda is nu niet bij te werken. Uw aanvraag staat er wel." |
| Optioneel: Kantoor | bevestigen, wijziging beslissen | "Een reisadviseur bevestigt uw reis. Tot dan is het een aanvraag." |
| Optioneel: Post | bevestiging per mail | "De bevestiging per mail volgt; hij staat hier al." |

**e. Volledige werkzaamheid.** Een lid vraagt een reis aan, laat hem bevestigen, betaalt, wijzigt of zegt af, en krijgt zijn geld terug. Op elk moment ziet hij een eerlijke stand en heeft hij een bewijs. Nergens heet iets geboekt of betaald dat het niet is.

**f. Functiekaarten**

**F1 · Aanvragen met herhaalsleutel** (K8). L5 · half · K · **HERSTEL**
- Gegevens: de herhaalsleutel van het scherm (RTGIdem), de reis-id, personen en vertrekdatum, uit reisbureau.html.
- Regels: één open aanvraag per lid en per reis. Dezelfde sleutel geeft hetzelfde antwoord; dezelfde sleutel voor een andere reis geeft 409.
- Rekenen: de sleutel staat bij de aanvraag in `reisAanvragen` en overleeft een herstart.
- Onzekerheid: geen.
- Melden: het lid ziet zijn aanvraag direct; het kantoor ziet hem in de reisbalie.
- Rollen: het lid.
- Uitzonderingen: een aanvraag zonder sleutel (een oud scherm) houdt de huidige 409 "al aangevraagd".
- Klaar als: een dubbeltik, een afgebroken verzoek en een herstart geven allemaal één aanvraag en hetzelfde antwoord.

**F2 · Betaalknop bij de reis** (K2). L1 · ontbreekt · K · **HERSTEL**
- Gegevens: de bevestigde aanvraag met haar samenstelling (`reisbureau-betaling.js`).
- Regels: alleen een bevestigde, uitgesplitste reis is te betalen, en alleen door het eigen account na de paspoortpoort.
- Rekenen: de prijs komt uit de samenstelling en niet uit het scherm.
- Onzekerheid: een betaling die bij de provider nog loopt, is "wacht op bevestiging", nooit "betaald".
- Melden: na de afloop ziet het lid de stand met de reden; het kantoor ziet de betaling in de reisbalie.
- Rollen: het lid betaalt; Geld bevestigt de betaling.
- Uitzonderingen: 402 bij te weinig saldo zonder dekking, 503 als de betaallaag uit staat, 403 met kyc bij een ongekeurd account; in alle drie de gevallen blijft de reis onbetaald.
- Klaar als: een lid betaalt een bevestigde reis in reisbureau.html; elke weigering staat in woorden op het scherm en de reis heet dan nergens betaald.

**F3 · Betaald alleen via de afhandelaar van de betaalwaarheid.** L5/L6 · ontbreekt · M · **HERSTEL** (Geld bouwt, het reisbureau roept aan)
- Gegevens: de afloop van de betaalwaarheid (soort `reis`, bronRef = aanvraag-ref).
- Regels: `markeerBetaald` wordt alleen door die afhandelaar aangeroepen.
- Rekenen: betaald, geweigerd of traag (de afloop van de provider).
- Onzekerheid: "traag" toont "wacht op bevestiging van de betaling", met het tijdstip.
- Melden: het lid hoort de afloop; staat de betaling na 24 uur nog op "traag", dan ziet het kantoor hem.
- Rollen: Geld (afhandelaar) en het reisbureau (stand).
- Uitzonderingen: een terugboeking door de provider zet de reis terug op "bevestigd, nog niet betaald" en meldt dat.
- Klaar als: in het ketenscenario (1.3, stap 4-9) heet de reis pas betaald na "betaald" van de betaalwaarheid.

**F4 · Betaalbewijs** (K3). L6 · ontbreekt · K · **HERSTEL** (Geld)
- Gegevens: de geslaagde betaling, de reis-ref, het bedrag en de herkomstregels.
- Regels: één bewijs per betaling, aangemaakt door `factuurVoorLid` vanuit de afhandelaar.
- Rekenen: geen; het bewijs volgt de boeking.
- Onzekerheid: geen.
- Melden: het lid ziet het bewijs in Geld en bij de reis.
- Rollen: Geld.
- Uitzonderingen: bij een teruggave komt er een creditbewijs, en het oude bewijs blijft staan.
- Klaar als: na betalen staat er precies één bewijs met de reis-ref in Geld, te downloaden, ook na een dubbeltik en een herstart.

**F5 · Overzicht van bestellingen klopt** (K4). L6 · half · K · **HERSTEL**
- Gegevens: `a.betaald` van de aanvraag (`kern/mall/bestellingen.js:109`).
- Regels: het overzicht leest de stand en verzint hem niet.
- Rekenen: betaald = er is een betaling vastgelegd.
- Onzekerheid: geen.
- Melden: het overzicht toont het bij de volgende keer openen.
- Rollen: het lid.
- Uitzonderingen: geen.
- Klaar als: een betaalde reis staat als betaald, een bevestigde onbetaalde als "nog niet betaald".

**F6 · Bevestiging op een duurzame drager.** L2/L5 · half · M · **VERDIEPING** (de inhoud over insolventie hangt aan B1)
- Gegevens:
  - de reis, de speciale wensen en de contactgegevens van RTG en van een lokaal contactpunt (uit het kantoor);
  - de insolventieregeling, na besluit B1.
- Regels:
  - de inhoud van richtlijn art. 7 lid 2 (zoekresultaat, te controleren);
  - geen document zonder een bevestigde reis.
- Rekenen: een document per bevestiging. Wijzigt de reis, dan komt er een nieuwe versie met een eigen datum, en de oude blijft bewaard.
- Onzekerheid: wat nog niet bekend is (zoals een vluchttijd) staat erin als "volgt", en wordt nooit ingevuld met iets wat RTG niet weet.
- Melden: bij bevestiging komt er een PDF in Bestanden en een mail via de postvanger.
- Rollen: het kantoor bevestigt; het lid ontvangt.
- Uitzonderingen: een reis die niet onder de pakketreisregels valt (besluit B1), krijgt een eenvoudiger bevestiging. Die zegt dat ook.
- Klaar als:
  - na een bevestiging bestaat precies één document met de verplichte velden;
  - een wijziging maakt versie 2;
  - een ander account kan het document niet openen (404).

**F7 · Wijziging door RTG, met de keuze van het lid.** L5 · half · M · **VERDIEPING**
- Gegevens: de oude en de nieuwe reis en de reden, ingevoerd door het kantoor.
- Regels: een wezenlijke wijziging gaat pas door als het lid ja zegt; kosteloos opzeggen kan altijd (richtlijn art. 11, te controleren).
- Rekenen: het verschil per veld (datum, verblijf, prijs).
- Onzekerheid: geen; het gaat om het voorstel van het kantoor.
- Melden: het lid krijgt een melding met een termijn om te antwoorden. Antwoordt hij niet, dan gebeurt er niets met zijn reis of geld, en hoort het kantoor dat.
- Rollen: het kantoor stelt voor; het lid en elke reisgenoot met een eigen deel stemmen in (reisgezelschap-instemming).
- Uitzonderingen: een onbeduidende wijziging (bijvoorbeeld een terminal) is alleen een melding; welke wijziging onbeduidend is, legt het kantoor vast met een reden.
- Klaar als: een voorstel zonder ja verandert niets; een ja past de reis toe met spoor en audit; een nee biedt kosteloos opzeggen met teruggave.

**F8 · Teruggave binnen 14 dagen bewaakt.** L3 · half · K · **VERDIEPING**
- Gegevens: de klaargezette teruggaven (`reisbureau-teruggave.js`) met hun datum.
- Regels: binnen 14 dagen na de opzegging (richtlijn art. 12, te controleren).
- Rekenen: de resterende dagen per teruggave.
- Onzekerheid: geen.
- Melden: na 10 dagen staat de teruggave bovenaan bij het kantoor; het lid ziet de datum waarop hij uiterlijk komt.
- Rollen: het kantoor voert uit (passkey, vanaf €1000 een tweede mens).
- Uitzonderingen: een afgewezen teruggave noemt de reden.
- Klaar als: een teruggave van 11 dagen oud staat bovenaan, met het aantal resterende dagen.

**F9 · Betaalklok (aanbetaling en rest).** L5 · ontbreekt · M · **LATER** (besluit B2)
- Gegevens: het betalingsplan, door de eigenaar vast te stellen.
- Regels: rest uiterlijk op de vastgestelde datum (de branchegewoonte is 6 weken; *te controleren*). Niet betaald wordt nooit stil geannuleerd.
- Rekenen: de vervaldatum is vertrek minus de termijn.
- Onzekerheid: geen.
- Melden: herinneringen 7 en 2 dagen vóór de datum; op de datum een melding aan het kantoor.
- Rollen: het lid betaalt; het kantoor beslist over annuleren, na een gedocumenteerde herinnering.
- Uitzonderingen: boekt het lid binnen de termijn, dan betaalt hij alles direct.
- Klaar als: zonder vastgesteld plan staat er nergens een vervaldatum; met een plan volgt de klok het plan.

**F10 · Prijswijziging met keuze.** L5 · ontbreekt · M · **LATER**
- Gegevens: de nieuwe prijs en de reden, alleen brandstof, belasting of wisselkoers, ingevoerd door het kantoor.
- Regels:
  - alleen als het contract het toelaat;
  - uiterlijk 20 dagen vóór vertrek;
  - boven 8% kiest het lid: accepteren of kosteloos opzeggen (richtlijn art. 10-11, te controleren).
- Rekenen: het percentage boven de oorspronkelijke prijs.
- Onzekerheid: geen.
- Melden: het lid krijgt oud, nieuw en de reden, met twee knoppen.
- Rollen: het kantoor stelt voor; het lid kiest.
- Uitzonderingen: daalt de prijs, dan geldt de verlaging zonder dat het lid iets hoeft te doen.
- Klaar als: zonder antwoord blijft de oude prijs; boven 8% is kosteloos opzeggen te kiezen.

**F11 · Annuleringskosten.** L5 · ontbreekt · M · **LATER** (besluit B3)
- Gegevens: de staffel, door de eigenaar vast te stellen.
- Regels: vóór het afzeggen ziet het lid het bedrag en de regel.
- Rekenen: de staffel tegen het aantal dagen tot vertrek.
- Onzekerheid: geen.
- Melden: bij het afzeggen staat het bedrag in de teruggave.
- Rollen: het lid; het kantoor beslist bij twijfel.
- Uitzonderingen: kosteloos bij onvermijdbare omstandigheden op de bestemming (richtlijn art. 12 lid 2, te controleren); het kantoor stelt dat vast met een reden.
- Klaar als: zonder staffel kost afzeggen niets en staat dat er ook; met een staffel ziet het lid het bedrag vóórdat hij bevestigt.

**F12 · Groepsreis: minimumaantal deelnemers.** L2 · ontbreekt · M · **LATER**
- Gegevens: het minimumaantal en de annuleringsdatum per reis, uit het aanbod.
- Regels: het kantoor annuleert wegens te weinig deelnemers alleen vóór de grens (20/7 dagen of 48 uur, te controleren).
- Rekenen: het aantal bevestigde deelnemers tegen het minimum.
- Onzekerheid: geen.
- Melden: elk lid ziet "minimaal N, nu M" en de grensdatum.
- Rollen: het kantoor.
- Uitzonderingen: geen.
- Klaar als: na de grensdatum weigert annuleren wegens deelnemers met een reden.

**F13 · Gedeelde betaling per reisgenoot.** L1/L6 · half · G · **LATER**
- Gegevens: de delen per reisgenoot (reisgezelschap-opties).
- Regels: ieder betaalt zijn eigen deel; de reis heet pas betaald als alle delen binnen zijn.
- Rekenen: de som van de delen tegen de reissom.
- Onzekerheid: geen.
- Melden: iedereen ziet wie nog moet betalen.
- Rollen: de reisgenoten; de hoofdboeker ziet de stand.
- Uitzonderingen: weigert één genoot, dan blijven de andere betalingen staan en beslist het kantoor.
- Klaar als: drie van de vier betaald geeft "3 van 4" en nooit "betaald".

**F14 · Zakenreis: goedkeuring vooraf.** L3 · ontbreekt · M · **LATER** (eigenaar Onderneming)
- Gegevens: het reisbeleid en de goedkeurder per bedrijf (Onderneming).
- Regels: geen aanvraag naar het kantoor zonder ja van de goedkeurder.
- Rekenen: de reis wordt tegen het beleid gelegd (budget, klasse).
- Onzekerheid: geen.
- Melden: de goedkeurder hoort het direct; de reiziger hoort het besluit met de reden.
- Rollen: reiziger, goedkeurder en kantoor.
- Uitzonderingen: met spoed kan het kantoor het vrijgeven met een reden, zichtbaar voor het bedrijf.
- Klaar als: zonder ja staat de aanvraag op "wacht op goedkeuring"; een nee komt met een reden terug.

**NIET:**
- GDS/NDC-boekingen in de huidige scope: externe certificering en contracten; RTG bevestigt niets namens een partner.
- Verstoringsbescherming verkopen (het Hopper-model): dat is een verzekeringsproduct.

**g. RTG-exclusief.** Het kantoor bevestigt met naam en reden, het lid stemt in bij elke wijziging, en de herkomst van elke euro is te zien. Een reis bij RTG is uitlegbaar tot op de euro, zonder commissie.

**h. Uitkomst B als proces: de organisator- en agentuurketen.**

| Stap | Wat er gebeurt | Wie | Wat het vraagt |
|---|---|---|---|
| 1. Wens | Het lid beschrijft zijn reis; de adviseur stelt hem samen uit partneraanbod. | lid, reisadviseur | inkoop bij partners |
| 2. Offerte | Het standaardinformatieformulier met prijs, onderdelen en annuleringsregels. | adviseur | besluit B1, sjabloon (te controleren) |
| 3. Contract | Bevestiging op een duurzame drager en de aanbetaling via Geld. | lid, Geld | betalingsplan (B2) |
| 4. Inkoop | Per onderdeel een boeking bij de partner; elke bevestiging komt terug in het dossier. Wijkt er iets af, dan beslist de adviseur. | inkoper | consolidator of GDS/NDC, contracten met hotelbanken, IATA of een host agency |
| 5. Restbetaling | Herinneringen, dan de restbetaling; niet betaald gaat naar het kantoor, nooit stil. | lid, Geld, kantoor | B2 |
| 6. Wijziging door een partner | De organisator beoordeelt of het wezenlijk is; het lid kiest (F7). | adviseur, lid | — |
| 7. Vertrek | Documentcheck, het offline dossier en het contactpunt. | lid | 3.2 |
| 8. Tijdens de reis | Verstoring: de assistentiedesk maakt een herstelvoorstel, het lid zegt ja, het domein boekt om en de bevestiging komt in het dossier. | desk, lid, partner | 3.2 B |
| 9. Na de reis | Een klacht binnen de termijn, de afhandeling, eventueel de geschillencommissie; teruggave of compensatie via Geld. | lid, kantoor | ANVR-lidmaatschap (te controleren) |
| 10. Afrekening | Inkoopfacturen van partners, marge en de btw-margeregeling; uitbetaling aan partners na uitvoering. | Geld, kantoor | besluit marge, fiscaal advies (te controleren) |

**Zakelijk travelmanagement** komt erbij, met Onderneming als eigenaar van het bedrijf:
1. Het bedrijf legt een reisbeleid vast, met een budget per kostenplaats.
2. De medewerker vraagt aan; het beleid wordt gecontroleerd en de goedkeurder zegt ja of nee.
3. Er wordt geboekt binnen het beleid. Wie erbuiten boekt, geeft een reden.
4. Tijdens de reis volgt RTG de reiziger alleen met zijn toestemming per reis.
5. Bij een incident ziet de travelmanager wie er geraakt is; de reiziger krijgt een bericht en een contactpunt.
6. Per maand komt er een verzamelfactuur per kostenplaats, via Geld.

Wat dit vraagt:
- inschrijving als organisator met SGR, en besluit B1;
- mensen: adviseurs en een inkoper;
- jaren aan contracten.

### 3.2 Reizen & Veilig (`link:reizen`) en de wereldpagina

**a. Bewezen.**
- APPWERKT: bereikbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent en herstelbaar zijn BEWEZEN; bedienbaar en bevoegd NIET_GETEST.
- Voltooiscenario `reizen.js` (Momenten).
- Kern:
  - Live Circle-Momenten: een exacte locatie gaat alleen naar een connectie;
  - de reiswereld: een projectie, met `stil` per bron;
  - de reiswacht: een momentopname;
  - de reisoplosser: voert alleen een agendataak uit;
  - het reisgezelschap met instemming, en de Reiswijzer.

**b. Markt.** Tripsy en TripIt Pro bieden gasten uitnodigen, agenda-sync en alerts.

**d. LOS in drie groepen**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | Momenten delen en stoppen, de tijdlijn van de reis tonen, een groepsvoorstel en instemming | — |
| Platform | sessie, connecties (wie ontvangt), opslag | "Uw reis is nu niet te laden. Er is niets gedeeld of veranderd." |
| Optioneel: bronnen van de reiswereld | reisbureau, vluchten, verblijven, activiteiten, invoer | "Eén bron antwoordt nu niet ({naam}); de rest van uw reis staat er wel." |
| Optioneel: Move, OV, Navigatie, Reisbureau | panelen in het werkblad | "{App} is nu niet bereikbaar; uw reis en uw Momenten werken gewoon." |
| Optioneel: Agenda | taak uit de reisoplosser | "De taak kon niet in uw agenda; het voorstel staat hier." |

**e. Volledige werkzaamheid.** Een lid ziet zijn hele reis op één tijdlijn, uit elke bron en met de stand van elke bron. Hij hoort per onderdeel wat een vertraging breekt en krijgt een herstelvoorstel. Hij deelt zijn veiligheid zo veel of weinig als hij wil, en besluit samen met zijn gezelschap. Niets gebeurt zonder zijn ja.

**f. Functiekaarten**

**F15 · Logeren bij leden in de tijdlijn.** L6 · ontbreekt · K · **VERDIEPING**
- Gegevens: een bevestigd verblijf uit `thuisBoekingen` (eigenaar `/apps/thuis.html`).
- Regels: een projectie, geen kopie. Alleen de eigen boekingen; een afgewezen of geannuleerde valt weg.
- Rekenen: datum en plaats uit de boeking.
- Onzekerheid: zonder aankomsttijd van de gastheer heet de naad "niet te bepalen".
- Melden: geen eigen melding; de boeking meldt al.
- Rollen: gast en gastheer.
- Uitzonderingen: de deurcode komt nooit in de tijdlijn.
- Klaar als: een bevestigd logeeradres staat in de reis, de agenda en Move. Een ander lid ziet het niet. Na annuleren is het weg.

**F16 · Hoteltijden in de naad.** L4 · ontbreekt · K · **VERDIEPING**
- Gegevens: de inchecktijd die de zaak opgeeft (veld op het verblijf of de zaak).
- Regels: zonder opgave geen tijd; RTG verzint geen 15:00 (MOVE.md:198-202).
- Rekenen: de naad met die tijd, en de bron erbij.
- Onzekerheid: "volgens de opgave van de zaak".
- Melden: geen.
- Rollen: de zaak geeft de tijd op.
- Uitzonderingen: een late check-in op afspraak geldt alleen als de zaak hem bevestigt.
- Klaar als: met een opgave is de naad gewogen en staat de bron erbij; zonder opgave blijft hij "niet te bepalen".

**F17 · Herstelvoorstel bij vertraging.** L4/L5 · half · M · **VERDIEPING**
- Gegevens:
  - de vertraging, door het lid of het kantoor opgegeven (realtime bronnen ontbreken);
  - de reistijdlijn en `gevolg.js`.
- Regels:
  - per geraakt onderdeel één voorstel, met de kosten (als die bekend zijn) en wie bevestigt;
  - er wordt niets uitgevoerd.
- Rekenen: Move rekent de naden opnieuw; het voorstel volgt uit de soort onderdeel (gevolg.js:50-60).
- Onzekerheid:
  - elke opgegeven vertraging heet "opgegeven door {wie}", nooit "gemeten";
  - onbekende kosten heten "kosten onbekend".
- Melden: het lid ziet het voorstel meteen; reisgenoten met hetzelfde onderdeel zien het ook.
- Rollen: het lid zegt ja per voorstel.
- Uitzonderingen: een onderdeel zonder plek of tijd staat als "niet te beoordelen".
- Klaar als: bij 90 minuten vertraging ziet het lid welke onderdelen breken, met een voorstel per onderdeel. Zonder zijn ja verandert er niets.

**F18 · Documentcontrole vóór vertrek.** L4 · half · M · **VERDIEPING**
- Gegevens:
  - nationaliteit en geldigheid van het document, uit het Reisboek en de identiteitskluis (geen documentnummer);
  - de bestemming, uit de reis;
  - een eigen regeltabel met de datum van de laatste controle.
- Regels:
  - Schengen voor derdelanders: geldig tot minstens 3 maanden na vertrek, en minder dan 10 jaar oud;
  - UK ETA, US ESTA;
  - ETIAS alleen met een bevestigde startdatum.
- Rekenen: per reiziger een uitkomst per regel.
- Onzekerheid:
  - elke uitkomst draagt "regel per {datum}, controleer bij de autoriteit";
  - RTG zegt nooit "u mag reizen".
- Melden: 60, 30 en 7 dagen vóór vertrek, alleen bij een probleem.
- Rollen: het lid; voor een kind de ouder (Gezin).
- Uitzonderingen: een land zonder regel in de tabel geeft "RTG kent de regel voor {land} niet".
- Klaar als: een paspoort dat twee maanden na terugkomst verloopt, geeft bij een Schengenreis van een derdelander een melding met de regel en de datum.

**F19 · Reis als context naar de schil.** L6 · ontbreekt · K · **VERDIEPING**
- Gegevens: de reis-ref.
- Regels: `{rtg:'context', ref:{soort:'reis', id, label}}` zonder verdere velden; `ref:null` betekent "geen keuze" (contract van Versheid en LivingOS-B).
- Rekenen: geen.
- Onzekerheid: geen.
- Melden: de ontvanger meldt zich met `context-volgt`.
- Rollen: geen.
- Uitzonderingen: een ontvanger die de soort niet kent, zwijgt.
- Klaar als: kiest het lid een reis, dan toont de Agenda die reis, zonder gegevens over te nemen.

**F20 · PRM-assistentie melden.** L1/L5 · ontbreekt · M · **LATER**
- Gegevens: het toegankelijkheidsprofiel (met toestemming) en de vervoerders van de reis.
- Regels: melden uiterlijk 48 uur vooraf (lucht, water), 36 uur (bus) of 24 uur (trein) (zoekresultaat, te controleren).
- Rekenen: de uiterste meldtijd per onderdeel.
- Onzekerheid: de bevestiging van de vervoerder staat als "gemeld, niet bevestigd" tot ze er is.
- Melden: het lid ziet de uiterste tijd; het kantoor meldt bij een reis van het reisbureau.
- Rollen: lid en kantoor.
- Uitzonderingen: een vervoerder zonder meldkanaal staat als "zelf melden".
- Klaar als: een lid met een profiel ziet bij elke vlucht "meld vóór {tijd}".

**F21 · Kleurcode van het BZ-reisadvies.** L4 · ontbreekt · M · **LATER** (externe bron)
- Klaar als: de kleurcode staat erbij met datum en bron, of anders alleen een link; RTG verzint geen kleur.

**LATER:**
- de achtergrondwacht (besluit B4).

**NIET nu:**
- realtime vlucht- en spoordata: een externe licentie, "jaren weg". Tot dan heet bewaking een momentopname.

**h. Uitkomst B als proces: reiscontinuïteit, 24/7.**

| Stap | Wat er gebeurt | Wie | Wat het vraagt |
|---|---|---|---|
| 1. Signaal | Een vertraging, annulering of incident komt binnen: van de vervoerder, het lid of het BZ-reisadvies. | bron | realtime bronnen met licentie; besluit B4 |
| 2. Doorrekenen | De reisgraaf (Move-gevolg) bepaalt welke onderdelen werkelijk geraakt zijn, met de bron van elk feit. | systeem | — |
| 3. Desk | Een mens ziet de zaak met de opties: kosten, risico en haalbaarheid per optie. Een voorspelling staat als bandbreedte. | assistentiedesk | een bemande meldkamer, diensten, protocol, aansprakelijkheid |
| 4. Keuze | Het lid kiest; elke reisgenoot met een eigen onderdeel stemt zelf in. Zonder ja gebeurt er niets. | lid, reisgenoten | reisgezelschap-instemming |
| 5. Uitvoeren | Elk domein voert uit via zijn eigen route: omboeken, een late check-in, de tafel verzetten. | domeinen, partners | wijzigen na toestemming per domein |
| 6. Terugmelden | Bevestigingen en weigeringen komen in het dossier; kosten via Geld; een EU261-claim start als het lid dat wil. | domeinen, Geld | claimdienst (Vluchten B) |
| 7. Afsluiten | Opgelost, open en nazorg; de zaak sluit pas als het lid dat zegt. | desk, lid | — |

**Crisis.** Gaat het BZ-reisadvies naar oranje of rood, dan krijgen leden in het gebied een bericht met het contactpunt en het BZ-nummer. Wie in het gebied is, weet RTG alleen bij leden die het per reis toestaan. Een travelmanager ziet zijn reizigers volgens ISO 31030 (te controleren); RTG ziet geen exacte plek zonder toestemming.

### 3.3 De reistab (`tab:reizen`)

**a. Bewezen.** Op deze tak:
- voltooiscenario `reistab.js` 9/3/4/3;
- de stand van de reiskaart is sinds K1 eerlijk ("Bevestigd, nog niet betaald").
- APPWERKT meet de tab nog als NIET_GETEST (hij heeft geen eigen adres).

**d. LOS in drie groepen**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | de reiskaart uit `md.trip` en de showroom | — |
| Platform | sessie, identiteitskluis | "Uw reis is nu niet te laden." |
| Optioneel: Agenda | het dagprogramma | "Het programma is nu niet te berekenen; uw reis staat er wel." |
| Optioneel: Netwerk | alles | "U bent offline. Dit is uw reis zoals hij om {tijd} was." |

**e. Volledige werkzaamheid.** Het lid heeft zijn reis bij zich met een eerlijke stand per onderdeel, ook zonder netwerk, en met de contactkaart.

**f. Functiekaarten**

**F22 · Dagprogramma robuust per bron** (K5). L6 · half · K · **HERSTEL**
- Gegevens: de bronnen van `agendaVoor`.
- Regels: een bron die gooit, wordt weggelaten en genoemd.
- Rekenen: zoals nu, per bron in een net.
- Onzekerheid: "deze bron rekent nu niet".
- Melden: één regel op het scherm.
- Rollen: geen.
- Uitzonderingen: geen.
- Klaar als: laat één bron gooien; de andere punten staan er, en één regel noemt de uitgevallen bron.

**F23 · Visumtaak in een net** (K6). L5 · half · K · **HERSTEL**
- Gegevens: `visumtaak.bijBoeking`.
- Regels: een fout daar breekt de aanvraag niet.
- Rekenen: een try rond de aanroep, en het antwoord zegt dat de taak niet gezet kon worden.
- Onzekerheid: geen.
- Melden: het lid ziet "de visumtaak kon niet in uw agenda".
- Rollen: geen.
- Uitzonderingen: geen.
- Klaar als: laat bijBoeking gooien; de aanvraag geeft 200 met die zin, en er is één aanvraag.

**F24 · Offline reisdossier met contactkaart** (K9). L1/L2 · ontbreekt · M · **VERDIEPING**
- Gegevens: `md.trip`, het contactpunt (F6) en het BZ-nummer (+31 247 247 247, nederlandwereldwijd.nl; zoekresultaat, te controleren).
- Regels:
  - alleen het eigen dossier, versleuteld op het toestel waar dat kan;
  - wissen bij uitloggen.
- Rekenen: elke keer dat het lid online opent, wordt de kopie ververst.
- Onzekerheid: "laatst bijgewerkt {tijd}".
- Melden: geen.
- Rollen: het lid.
- Uitzonderingen: handelingen met geld of een partner staan offline uit, met de reden.
- Klaar als: zet het toestel offline; het dossier, het contactpunt en het BZ-nummer staan er met de tijd. Na uitloggen is het weg.

### 3.4 Reisboek (`link:reisboek`, Lifestyle)

**a. Bewezen.** APPWERKT: alles BEWEZEN behalve bevoegd. Voltooiscenario `reisboek.js`.

**d. LOS in drie groepen**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | het eigen dossier: legs, verblijven, documenten, programma | — |
| Platform | sessie, levensdossier, de Lifestyle-poort | "Het Reisboek hoort bij de Lifestyle Pass." / "Uw Reisboek is nu niet te laden." |
| Optioneel: reiswereld | de gemeten reizen | "De geboekte reizen zijn nu niet te tonen; uw eigen Reisboek staat er wel." |

**e. Volledige werkzaamheid.** Het lid houdt per reis een draaiboek bij dat meetelt in de wacht en in Move. Het is versleuteld en altijd aan te passen.

**f. Functiekaarten**

**F25 · Handmatige reizen in de reiswereld.** L6 · ontbreekt · K · **VERDIEPING**
- Gegevens: de reizen uit `rechterhand/reisboek.js`.
- Regels: bron "ingevoerd door u", nooit "bevestigd".
- Rekenen: geen.
- Onzekerheid: het label.
- Melden: de reiswacht meldt zoals bij elke bron.
- Rollen: het lid.
- Uitzonderingen: geen.
- Klaar als: een ingevoerde vlucht telt mee in Move, met het label.

**F26 · Item bewerken.** L5 · ontbreekt · K · **VERDIEPING**
- Klaar als: een leg of document is aan te passen zonder hem eerst weg te halen; een ander lid krijgt 404.

**F27 · Documentgegevens versleuteld.** L1 · half · K · **HERSTEL** (privacy: `enc()` bestaat, maar wordt niet gebruikt)
- Gegevens: soort, houder en geldigheid.
- Regels: versleuteld opgeslagen; geen documentnummer.
- Klaar als: in de opslag staan houder en geldigheid niet leesbaar.

### 3.5 Routedossier — buiten de reisfamilie

Inzage voor het kantoor in elf schakels per API-route (AUTH … PRIVACY). Bewezen: bereikbaar, bedienbaar, waarheidsgetrouw (APPWERKT); voltooiscenario `routedossier.js` op deze tak. Geen reisfunctie; voorstel aan de integrator: verplaats het naar de bewijsfamilie. Twee eerlijke gaten uit de code: OUTPUT en AUDIT staan voor elke route op ongemeten omdat niets het meet (office/dossier.js:111-115), en uitgaande kanalen vallen buiten SIDE_EFFECT.

### 3.6 Logeren bij leden (`/apps/thuis.html`): eigenaar is TravelOS

Besluit: Logeren bij leden hoort in de productindeling bij TravelOS. **Ik ben de eigenaar van deze kaart**; LivingOS-A verwijst ernaar vanuit livingos-a.md. Het eigenaarschap van de code en de bronlogica blijft waar het is (SCHERMEIGENAAR.json:291 `verblijf.logeren-bij-leden`; cluster :550-561 met `eigenaar: null`) totdat een migratie bewezen veilig is.

**Wat er is:**
- 21 routes `/api/thuis/*`;
- huizen en boekingen op codenaam;
- aanvragen, beslissen, in- en uitchecken;
- annuleringsbeleid flex, gemiddeld of streng;
- een herhaalsleutel;
- de deurcode pas 3 dagen vooraf.

**d. LOS in drie groepen**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | zoeken, aanvragen, beslissen, in- en uitchecken, berichten, beoordelen | — |
| Platform | sessie, gegevenspoort, identiteitspoort (na F28) | "Logeren bij leden vraagt een gekeurd, volwassen account." |
| Optioneel: Geld | betalen en uitbetalen (na B5) | "Er is nog niets afgeschreven; de betaling volgt bij bevestiging." *(Pas tonen als het echt zo werkt.)* |
| Optioneel: reiswereld en Agenda | projectie (F15) | "Uw verblijf staat hier; de agenda is nu niet bij te werken." |

**e. Volledige werkzaamheid.** Een gekeurde volwassene logeert bij een ander gekeurd lid. Beide kanten zijn bekend aan RTG, de betaling en uitbetaling zijn eerlijk, het verblijf staat in zijn reis en agenda, en elke kant kan beoordelen.

**F28 · Gekeurde identiteit voor gast en gastheer.** L1/L3 · ontbreekt · K · **HERSTEL** (veiligheid)
- Gegevens: `volwassen()` (een eigen account, A3, 18 of ouder).
- Regels:
  - boeken en verhuren alleen met de poort;
  - de deurcode alleen voor een gekeurde gast.
- Rekenen: de poort bij boek, beslis, huis en checkin.
- Onzekerheid: geen.
- Melden: een ongekeurd account hoort waarom, en hoe het gekeurd wordt.
- Rollen: gast en gastheer.
- Uitzonderingen: een zakelijke verhuurder (een zaak) loopt via de keuring van de zaak.
- Klaar als: een ongekeurd account krijgt bij boeken 403 met de reden en ziet nooit een deurcode.

**F29 · Eerlijke betaaltekst.** L5 · ontbreekt · K · **HERSTEL** (onwaar)
- Gegevens: de zin in boeken.js:113.
- Regels: geen betaalbelofte op het scherm zolang er niet betaald wordt.
- Klaar als: de bevestiging zegt "er wordt via RTG niets betaald; maak de betaling met de gastheer af". Na B5 komt de tekst van het echte pad.

**F30 · Betalen en uitbetalen.** L5/L6 · ontbreekt · M · **LATER** (besluit B5; Geld)
- Klaar als: de gast betaalt via de betaalwaarheid, en na het uitchecken gaat de uitbetaling naar de gastheer. Een annulering geeft het percentage van het beleid echt terug.

**F31 · Doel in SCHERMEIGENAAR rechtzetten.** — · fout · K · **HERSTEL**
- Klaar als: :2506-2510 zegt "logeren bij leden".

F15 (de projectie in de reis, de agenda en Move) staat bij 3.2.

## 4. Prioritering (de reisfamilie)

**HERSTEL** (onwaar, onveilig of tegen een huisregel), in deze volgorde:

| # | Wat | Kosten | Afhankelijk van | Stand |
|---|---|---|---|---|
| H1 | K1: bevestigd heet "nog niet betaald" | K | — | **gedaan** (eb4f7f02b) |
| H2 | K7: geldrijen niet dubbel na een crash | K | Geld | **gedaan** (Geld 6016db28) |
| H3 | F2 betaalknop, F3 betaald alleen via de betaalwaarheid, F4 betaalbewijs | M | Geld | open |
| H4 | F5 (K4) overzicht van bestellingen | K | — | open |
| H5 | F1 (K8) herhaalsleutel bij aanvragen; F23 (K6) visumtaak in een net | K | — | open |
| H6 | F22 (K5) agenda robuust per bron | K | eigenaar Agenda; Versheid | open |
| H7 | F27 documentgegevens versleuteld (Reisboek) | K | — | open |
| H8 | F28 identiteitspoort, F29 eerlijke betaaltekst, F31 doeltekst (Logeren) | K | eigenaar thuis.html | open |
| H9 | Wereldingang plus APPWERKT-rij en voltooiscenario voor reisbureau.html | K | integrator | open |

**VERDIEPING**, na toezegging:
- F24 offline dossier met contactkaart (M);
- F7 wijziging door RTG met keuze (M);
- F6 bevestiging op een duurzame drager (M, inhoud na B1);
- F17 herstelvoorstel (M);
- F18 documentcontrole (M);
- F8 teruggave bewaakt (K);
- F15 logeren in de tijdlijn (K);
- F16 hoteltijden (K);
- F19 context naar de schil (K);
- F25 en F26 Reisboek (K).

**LATER:**
- na een besluit: F9 (B2), F11 (B3), F30 (B5);
- daarnaast F10, F12, F13, F14, F20 en F21.

## 5a. Te controleren aan de bron

Niets in deze kaart is uit een zelf geopende primaire bron gelezen; alle externe feiten komen uit zoekresultaten van 19 oktober 2026. Vóór een functie die erop leunt, gebouwd of gepubliceerd wordt, moet een mens het volgende aan de bron nalopen:
- de artikelen 5, 7, 10-14 en 16 van Richtlijn (EU) 2015/2302 en de artikelnummers in BW 7:500 e.v.;
- de herziening van de richtlijn uit 2026;
- de ANVR-Reizigersvoorwaarden 2026: aanbetaling, restbetaling en staffel;
- de gemelde uitspraak van het Hof Den Haag (31-03-2026) over annuleren wegens te late betaling. Die is niet geopend en telt in deze kaart niet als bron;
- de SGR-garantieregeling;
- de ETIAS-startdatum;
- ISO 31030;
- de aanmeldtermijnen voor assistentie;
- het BZ-nummer;
- de landen met een verbod op flitswaarschuwingen (8.4);
- alle marktprijzen in 2.3 en deel 2.

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
| Geld echt bewegen bij `/api/booking/pay` | L5/L6 | half | lidacties.js:75-106 zet alleen `paid=true`; annuleren.js:22-24 | Een ticket of huur heet betaald na een RTG Pay-boeking; bij annuleren gaat het geld aantoonbaar terug. | M | HERSTEL (Geld bouwt, in uitvoering) |
| Huur of charter wijzigen | L5 | ontbreekt | huur.js | Een lid verzet zijn huurperiode zolang de auto niet is uitgegeven; overlap geeft een weigering in woorden; de prijs wordt opnieuw gerekend en hij bevestigt. | M | LATER |
| Bod of bezichtiging intrekken | L5 | ontbreekt | vastgoed.js | Een lid trekt zijn eigen bod of bezichtiging in; de makelaar ziet dat meteen. | K | VERDIEPING |
| Tickets met transfer als keten | L6 | half | kopen/tickets.js:66 | Een ticket met transfer staat in de reis en de agenda; vertraagt het evenement, dan geeft Move het gevolg voor de transfer. | M | LATER |
| Scenario's tickets/charter/vastgoed/bezorgen | — | ontbreekt | — | Elk onderdeel heeft een eigen voltooiscenario. | M | VERDIEPING |

**e.** Schadestaat met foto's door beide partijen en SOS tijdens de huur: tegen schimmig verhuren (huur.js-kop).


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | verhuuraanbod, huren, Mijn huur, locatie aan/uit, contracten tekenen of weigeren, tickets tonen | — |
| Platform | sessie, gegevenspoort, leeftijd uit het paspoort | "Huren kan pas met uw gecontroleerde leeftijd; dat gaat via uw paspoort." |
| Optioneel: Geld | betalen en teruggave | "Betalen kan nu niet; uw huur is vastgehouden maar nog niet betaald." |
| Optioneel: de zaak | uitgifte en inname | "De zaak bevestigt de uitgifte aan de balie." |

**Volledige werkzaamheid.** Een lid huurt, chartert, koopt een ticket of tekent een contract ter plaatse, betaalt echt, deelt vrijwillig zijn locatie, en krijgt bij annuleren zijn geld aantoonbaar terug.

### 7.2 Aankomst (`link:aankomst`, Invisible Arrival)

**a.** Voltooiscenario `aankomst.js` 10/3/4/3; arrival-security- en arrivalpas-toetsen 13/13; account verplicht met de pass als tweede sleutel (17fe7717); accountdeur in het scherm (e2b57ad6, browsertoets). Een ander account met dezelfde pass: 404.
**b.** OpenTable, Resy en SevenRooms: de gast betaalt niets; het restaurant betaalt per maand (OpenTable Basic $149, Core $299, Pro $499 plus per gast; Resy $289-459; SevenRooms prijs niet openbaar) — restaurant.opentable.com/products, resy.com/resyos/plans-and-pricing, sevenrooms.com/pricing (19-10-2026). Extra voor gasten loopt bij Resy via een creditcard (Amex Global Dining Access).
**c.** Allergie en toegankelijkheid zijn veiligheidsbeloften die alleen een mens van de zaak bevestigt (dat doet het scherm al: `wacht-op-mens`).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Reservering annuleren vanuit de pass | L5 | ontbreekt | arrival-toegang.js:63 (intrekken laat reservering staan) | Het lid annuleert zijn tafel in hetzelfde scherm; de zaak ziet het en de pass sluit. | K | VERDIEPING |
| Aankomst in de reis en Move | L6 | half | reserveringen in agendaVoor | Een tafel uit Aankomst staat in de reis; Move rekent de naad van de vorige afspraak naar de tafel. | K | VERDIEPING |
| Kop plaatsnadering.js bijwerken | — | verouderd | "pass is anoniem" | De kop zegt dat de pass aan een account hangt. | K | HERSTEL — gedaan (df6a2c9f3) |
| Capaciteitsscore uitleggen | L4 | half | heuristiek (invisible-arrival.js:20) | De score toont waarop hij rekent en heet "schatting". | K | LATER |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | wens tot plan, aanvraag, pass, pulsen, roteren en intrekken | — |
| Platform | sessie (accountdeur in het scherm), de pass als tweede sleutel | "Invisible Arrival is er voor wie een RTG-account heeft. Een gratis account is genoeg." |
| Optioneel: plaatslaag | automatische puls in de buurt | "Met de hand werkt het gewoon: tik op ‘Ik ben in de buurt’." |
| Optioneel: de zaak | bevestigen van beloften | "De zaak bevestigt persoonlijk wat veiligheid raakt." |

**Volledige werkzaamheid.** Een lid vertelt zijn wens één keer, krijgt een tafel met beloften die een mens van de zaak bevestigt, en deelt vrijwillig zijn komst zonder ooit zijn plek te geven.

### 7.3 Vluchten (`link:vluchten`)

**a.** Voltooiscenario `vluchten.js`; herhaalsleutel op charter (416d8740). Bord, boeken met paspoortpoort (428), inchecken, boarding pass met eenmalige code, roteren en intrekken. **Demo**: de luchthaven LUCHT en de vluchten bestaan alleen met `RTG_MAGNAAT_TEST` (luchthaven/index.js:71-95). Er bestaat geen prijs of betaling.
**b.** Flighty Pro $59,99/jaar: Where's My Plane, vertragingsvoorspelling, meldingen vóór de airline (flighty.com/pricing). Flightradar24 Silver/Gold/Business (flightradar24.com/premium). TripIt Pro alternatieve vluchten. AirHelp+ compensatie zonder commissie.
**c.** EU261: zorg 2/3/4 uur, omboeken of terugbetalen, compensatie €250/400/600 vanaf 3 uur; PRM-melding 48 uur; documenten (Schengen, ETA, ESTA).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Eigen vlucht annuleren | L5 | ontbreekt | geen route | Een lid annuleert een niet-ingecheckte boeking; de pass sluit en de agenda vervalt. | K | VERDIEPING |
| Melding bij charterbesluit | L5 | ontbreekt | royaal.js | Bevestigt of weigert operations een charter, dan hoort het lid het met de reden. | K | VERDIEPING |
| EU261-rechtenkaart bij vertraging | L4 | ontbreekt | 261/2004 | Bij een door de luchthaven gemelde vertraging ziet het lid welke zorg en welke compensatie de regel noemt voor deze afstand, als "regel, de maatschappij beslist", met de drempels. | M | LATER |
| Realtime vluchtdata | L4 | ontbreekt | TRAVELCOMMERCE.md:199 | — | G | NIET nu: licentie en jaren weg; tot dan "demo op eigen gegevens" (REIZEN.md:180-183). |
| Charter buiten de transactie | L5 | defect | royaal.js:58-61 | charterBeslis schrijft binnen dezelfde transactie als de boarding pass. | K | HERSTEL — gedaan (5a5316348) |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | bord, boeken, inchecken, boarding pass, roteren en intrekken, charter aanvragen | — |
| Platform | sessie, paspoortpoort (gegevenspoort 428) | "Voor deze vlucht vragen maatschappij en grens uw paspoortgegevens." |
| Optioneel: Agenda | visumtaak | "De visumtaak kon niet in uw agenda; uw boeking staat er wel." |
| Optioneel: operations | charterbesluit | "Operations bevestigt persoonlijk; tot dan is het een aanvraag." |

**Volledige werkzaamheid.** Een lid vindt een vlucht, boekt, checkt in met een pass die alleen hij kan tonen, annuleert wat hij niet meer wil en weet bij een vertraging wat zijn rechten zijn — op een demonstratieluchthaven, en dat staat er.

### 7.4 Hangar (`link:hangar`, Lifestyle)

**a.** Logboek van eigen toestellen en vluchten in het levensdossier; AI-vraag met "u belooft nooit een slot of vergunning". Geen planning of boeking. Los van kern/luchthaven, terwijl reiswereld charters als "Hangar" labelt (reiswereld-bronnen-rtg.js:60-63).
**b.** Jetkaarten en lidmaatschappen (NetJets Private Jet Card; Wheels Up vanaf $200.000) — netjets.com, investors.wheelsup.com (19-10-2026; uurprijzen niet bevestigd).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Charters uit Vluchten tonen | L6 | ontbreekt | reiswereld-bronnen-rtg.js | Een charteraanvraag staat in de Hangar, met link naar Vluchten waar hij woont. | K | HERSTEL (de reiswereld wijst naar een scherm dat ze niet toont) |
| Bemanningsuren en onderhoudsdatum | L2 | ontbreekt | hangar.js | Het logboek telt uren per toestel en waarschuwt bij een opgegeven onderhoudsgrens; "u voert het in, RTG keurt niets". | M | LATER |
| Slots, vliegplannen, vergunningen | L2 | ontbreekt | — | — | G | NIET: luchtvaartautoriteit en operator; RTG belooft het niet. |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | toestellen en vluchten bijhouden | — |
| Platform | sessie, Lifestyle-poort | "De Hangar hoort bij de Lifestyle Pass." |
| Optioneel: Vluchten | charters | "Uw charteraanvragen staan in Vluchten." |
| Optioneel: model | vraag aan de vluchtcoördinator | "De coördinator is nu niet beschikbaar; uw logboek werkt gewoon." |

**Volledige werkzaamheid.** Een lid houdt zijn eigen toestellen, vluchten en charters bij op één plek, zonder dat RTG een slot of vergunning belooft.

## 8. Bewegen

### 8.1 Move (`link:move`)

**a.** Voltooiscenario `move.js`; tijdzone van de zaak (fa381ae6). Rekent per overgang ruim/krap/onhaalbaar/niet te bepalen, met reden; `gevolg` geeft voorstellen met `uitgevoerd:false, bevestigt:'een mens'`. Schrijft niets.
**c.** MCT per luchthaven; zelf samengestelde overstap onbeschermd; trein 100 minuten; de reis als klok (2.2).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Hoteltijd uit de zaak | L4 | ontbreekt | MOVE.md:198-202 | Zie 3.2. | K | VERDIEPING |
| Overstapbescherming herkennen | L4 | ontbreekt | IATA MCT | Twee vluchten op aparte boekingen krijgen "zelf samengestelde overstap: niet beschermd" naast het oordeel; een eigen MCT-waarde wordt alleen gebruikt met bron. | M | LATER |
| Gevolg naar herstelvoorstel | L4/L5 | half | gevolg.js | Zie 3.2. | M | VERDIEPING |
| Bereikbaarheid met OV | L4 | ontbreekt | navRoute modus auto | De naad rekent ook met de lijnen uit OV (frequentie, geen dienstregeling) en zegt dat. | M | LATER |
| `vooraf` op het scherm | L1 | ontbreekt | MOVE.md:179 | Het lid ziet vóór hij iets toevoegt wat het met zijn reis doet. | K | VERDIEPING |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | per overgang ruim/krap/onhaalbaar/niet te bepalen, het gevolg van een vertraging | — |
| Platform | sessie, de reiswereld (bron van de onderdelen) | "Uw reis is nu niet te lezen; er is niets beoordeeld." |
| Optioneel: Navigatie | reistijd | "Zonder wegennet is deze overgang niet te bepalen." |
| Optioneel: tijdzone van de zaak | lokale tijd | "Tijd volgens Europe/Amsterdam; de zaak gaf geen tijdzone op." |

**Volledige werkzaamheid.** Een lid weet per overgang of hij het haalt en waarom, ziet wat een vertraging stroomafwaarts breekt, en krijgt herstelvoorstellen die pas na zijn ja worden uitgevoerd.

### 8.2 OV (`link:ov`) en OV-routes (`link:ovroutes`)

**a.** OV: voltooiscenario `ov.js`; kaartje en abonnement met herhaalsleutel en 409 bij een ander product (91a1b432). Inchecken met eenmalige QR of GPS binnen 150 m; teruggave alleen via een storing van de vervoerder (50/100%). OV-routes: voltooiscenario `ovroutes.js`, persona `personeel` (0defbbf5); lijnen direct live, zonder concept, versie of audit. Demo-vervoerder TRANSIT.
**b.** Citymapper Club (nu vooral advertentievrij), Moovit+ (SafeRide, routes vergelijken), Transit Royale (vervoerders betalen het voor hun reizigers) — citymapper.com/news/2589, moovit.com/press-releases/moovit-plus-features, help.transitapp.com (19-10-2026).
**c.** Treinrechten 2021/782 (25/50%, zelf omreizen na 100 min); busrechten 181/2011.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Kaartje of abonnement zelf terugvragen | L5 | ontbreekt | storing.js | Een ongebruikt kaartje is terug te vragen volgens de regel uit de overeenkomst; wordt het geweigerd, dan staat de reden erbij. | M | LATER (regel komt uit de overeenkomst) |
| Lijn als concept en daarna publiceren | L3 | ontbreekt | dienst.js | Een gewijzigde lijn is pas zichtbaar voor leden na "publiceren"; er is een vorige versie. | M | VERDIEPING |
| Audit op lijnwijzigingen | L3 | ontbreekt | dienst.js (geen logActivity) | Elke wijziging staat in het logboek van de zaak met wie en wanneer. | K | VERDIEPING |
| Verwijderen met lopende ritten | L5 | ontbreekt | dienst.js:91-97 | Een lijn met lopende ritten of geldige kaartjes is niet te verwijderen; de manager hoort waarom. | K | HERSTEL — gedaan (02bc39d0d) |
| Rit in de agenda | L6 | ontbreekt | geen agendakoppeling | Een geplande OV-reis staat in de agenda als projectie. | K | LATER |
| ovOverzicht filteren op de zaak | L3 | defect | dienst.js:130 | Het overzicht van een zaak telt alleen de eigen operaties. | K | HERSTEL — gedaan (02bc39d0d) |
| Echte dienstregeling (GTFS/NDOV) | L4 | ontbreekt | — | — | G | NIET nu: externe bron en licentie. |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen (OV) | kaart, inchecken met code of GPS, uitchecken, kaartje en abonnement, mijn vervoerbewijzen | — |
| Eigen (OV-routes) | lijnen tekenen, bewerken, verwijderen | — |
| Platform | sessie (lid of PDA-personeel), overeenkomst met de vervoerder | "In dit gebied verkoopt RTG nog geen kaartjes van deze vervoerder." |
| Optioneel: Geld | betalen bij uitchecken en kopen | "Betalen kan nu niet; u bent niet ingecheckt." |

**Volledige werkzaamheid.** Een reiziger checkt in en uit tegen een eerlijke prijs en heeft zijn vervoerbewijzen bij zich; een vervoerder tekent zijn lijnen, publiceert ze bewust en verwijdert nooit een lijn onder een reiziger.

### 8.3 Navigatie (`link:navigatie`)

**a.** Voltooiscenario `navigatie.js` met een NWB-fixture langs de echte importroute (3396809e); 13/3/5, menselijk open door de bewust bewaarde 503. Eigen A*, gebieden, pakketten met ODbL-vermelding, partnerevents.
**b.** TomTom GO (abonnement, offline, flitspalen), Sygic Premium+ (offline 3D, rijstroken), HERE WeGo (gratis, offline) — tomtom.com newsroom, sygic.com, here.com (19-10-2026; prijzen niet bevestigd).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Offline routeren | L1 | ontbreekt | KAARTEN.md:149-154 | Met een gedownload gebied rekent het toestel een route zonder netwerk en zegt dat verkeer niet meetelt. | G | LATER |
| OSM-bouwer voor gebieden | L2 | ontbreekt | KAARTEN.md:137-148 | Een gekozen gebied wordt een pakket uit OSM met vermelding. | G | LATER (extern: download geweigerd) |
| Huisnummers en postcodes | L1 | ontbreekt | NAVIGATIE.md:918-923 | Zoeken op adres vindt een huisnummer, met bron (BAG). | M | LATER |
| Manifest ondertekenen | L3 | ontbreekt | pakket.js | Een pakket draagt een handtekening die het toestel controleert. | K | VERDIEPING |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | route, bestemmingen, gebieden kiezen, melden | — |
| Platform | sessie, wegennet (NWB of gebiedspakket) | "Het Nederlandse wegennet is nog niet ingeladen." |
| Optioneel: Flits | meldingen onderweg | "Meldingen van het netwerk zijn nu niet te tonen; de route werkt." |
| Optioneel: partnerevents | afsluitingen van zaken | — |

**Volledige werkzaamheid.** Een lid wordt van zijn plek naar een bestemming genavigeerd op een net waarvan de bron en de licentie op het scherm staan — en waar dat net ontbreekt, zegt de app dat in plaats van een route te verzinnen.

### 8.4 Flits (`link:flits`, "Verkeer")

**a.** Voltooiscenario `flits.js` 8/3/4/3; eigen melding niet zelf bevestigen (af180843). Vijf soorten met levensduur, ontdubbelen binnen 300 m, stemmen.
**b.** Flitsmeister PRO €1,99/mnd (geen reclame, CarPlay, trajectcontrole-snelheid) — flitsmeister.nl/pro; Coyote Premium €14,99/mnd — moncoyote.com; Waze flitsers standaard aan — support.google.com/waze (19-10-2026).
**c.** Flitswaarschuwing tijdens het rijden verboden in Duitsland (€75 en 1 punt), volledig verboden in Zwitserland, in Frankrijk alleen "zones de danger" (bronnen: TomTom-help, recht24-7.de; geen overheidsbron). Nederland: geen bron gevonden.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Land bepalen op de server | L4 | defect | flits.html:136 `LAND='ES'`, client kiest | De landregel gebruikt de positie van de melding op de server; een flitser melden in DE, CH, FR (als exacte plek) geeft de weigering, ongeacht wat de client stuurt. | K | HERSTEL — stap A gedaan (80bbd5ad8); stap B (veelhoeken) LATER |
| Eigen melding intrekken | L5 | ontbreekt | flits.js | Een melder trekt zijn eigen melding in; hij verdwijnt voor iedereen. | K | VERDIEPING |
| Codenaam van de melder niet tonen | L1 | ontbreekt | flits.html:199,234 | Andere leden zien soort, plek en leeftijd, niet wie het meldde. | K | HERSTEL — gedaan (50f6207e5) |
| Wegwerk uit het stadsweefsel | L6 | ontbreekt | geen koppeling | Een werkorder van de gemeente op een weg verschijnt als wegwerk met bron "gemeente". | M | LATER |
| Vooruitblik niet hard op Ibiza | L1 | defect | flits.html:247 | De vooruitblik volgt de plek van het lid. | K | HERSTEL (onwaar) |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | melden, stemmen, rondom-beeld, vooruitblik | — |
| Platform | sessie, landregel uit de plek | "RTG kan hier niet uitsluiten dat flitsermeldingen verboden zijn (benadering van de landsgrenzen)." |
| Optioneel: Navigatie | waarschuwen op de route | — |
| Optioneel: Ghost Driver | vooruitblik | "De vooruitblik is nu niet beschikbaar; meldingen werken gewoon." |

**Volledige werkzaamheid.** Een rijder ziet en meldt wat er op de weg is, zonder dat iemand ziet wie hij is, binnen de wet van het land waar hij rijdt.

## 9. Verblijven en de plek

### 9.1 Stad (`link:stad`)

**a.** Voltooiscenario `stad.js`; herhaalsleutel op de melding (416d8740). Het scherm is een bewonersscherm: stand van de stad, melden, mijn meldingen. Onder de motorkap veel meer: stadsweefsel (assets, werkorders, voorzieningen, begroting, inspraak, algoritmeregister), ~80 kantoorroutes zonder scherm, en openbare API's voor algoritmes, besluiten en raadplegingen zonder scherm. Demo: één fictieve stad met 6 zones.
**b.** FixMyStreet Pro (gemeente betaalt £15.000-56.000/jaar; G-Cloud 2026), SeeClickFix (gemeente betaalt), BuitenBeter (gratis voor de bewoner) — bronnen 19-10-2026.
**c.** De ambitie van de eigenaar: een digitaal stadsmodel met meldingen, voorzieningen, werkzaamheden, participatie en transparantie.
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Doel in SCHERMEIGENAAR rechtzetten | — | fout | :2470-2474 "verkennen tijdens een reis" | De doeltekst zegt wat het scherm doet; of verkennen erbij hoort is een besluit. | K | HERSTEL |
| Melding aanvullen, intrekken, heropenen | L5 | ontbreekt | bewoner.js | De melder voegt een foto of tekst toe, trekt in, of heropent binnen 14 dagen na "klaar"; de ploeg ziet het. | M | VERDIEPING |
| Werkzaamheden op een kaart | L3/L6 | half (kantoor) | weefsel2.js:116 hinder | De bewoner ziet lopende en geplande werkzaamheden in zijn zone met einddatum en bron "gemeente". | M | VERDIEPING |
| Raadplegingen en besluiten zichtbaar | L3 | half (API zonder scherm) | stad.js:49-58 | Een open raadpleging is te lezen en te beantwoorden; een besluit staat met datum en motivering. | M | VERDIEPING |
| Algoritmeregister zichtbaar | L3 | half (API zonder scherm) | stad.js:40-41 | Elk gebruikt algoritme staat met doel, gegevens en wie verantwoordelijk is. | K | VERDIEPING |
| Voorzieningen per wijk | L3 | half | voorzieningen.js | De bewoner ziet de voorzieningen in zijn wijk, zonder personen. | K | LATER |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | stand van de stad, melden, mijn meldingen | — |
| Platform | sessie, paspoortdeur voor melden | "Melden kan met een gratis account met gecontroleerd paspoort." |
| Optioneel: gemeente | behandelen en terugmelden | "Uw melding staat; de gemeente behandelt hem en u hoort het hier." |

**Volledige werkzaamheid.** Een bewoner meldt wat kapot of vol is, volgt het tot het klaar is, ziet wat er in zijn buurt gebeurt en waarom, en praat mee — op codenaam.

### 9.2 Residentie (`link:residentie`, menulabel "Verblijven")

**a.** Voltooiscenario `residentie.js` 9/3/4/3; suite begint dicht (dd55bcf7). Een virtueel grandhotel: zalen, chat, spellen, eigen suite. Heeft niets met echte verblijven te maken (dat is `verblijf.hotel` → hotels.html).
**b.** Habbo Club $3,99/31 dagen (exclusieve items, groter vriendenlijstje) — help.habbo.com (19-10-2026).
**d.**

| Functie | Laag | Stand | Bron | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|
| Menulabel "Verblijven" corrigeren | — | fout | app-main.js:4040 | Het menu noemt dit "Residentie"; "Verblijven" is de hotelboeking. | K | HERSTEL |
| Melden en blokkeren van leden | L1/L3 | ontbreekt | grep leeg | Een lid meldt of blokkeert een ander in een zaal; een geblokkeerd lid ziet zijn chat niet; het kantoor ziet de melding. | M | HERSTEL (veiligheid) |
| 18+-poort op het gewaagde vragendek | L1 | ontbreekt | rahul.js:4-5, spel.js:123-131 | Het gewaagde dek opent alleen voor twee volwassen, gekeurde accounts (`volwassen()`). | K | HERSTEL — gedaan (d380e1a78) |
| Suite resetten | L5 | ontbreekt | suite.js | Het lid zet zijn suite terug naar de standaardinrichting. | K | LATER |


**LOS in drie groepen.**

| Groep | Wat | Als het uitvalt, zegt het scherm |
|---|---|---|
| Eigen | zalen, chat, spellen, eigen suite | — |
| Platform | sessie, pas (geen gast), 18+-poort voor het gewaagde dek | "De Résidence is voor leden." |
| Optioneel: Salon/vrienden | vrienden vinden | "Vrienden zijn nu niet te laden; de zalen werken gewoon." |

**Volledige werkzaamheid.** Een lid ontmoet anderen in een besloten, rustig grandhotel, richt zijn suite in en houdt hem dicht tot hij zelf opendoet, en kan iedereen die hem lastigvalt melden of blokkeren.

## 10. Prioritering en eindcontract, deel 2

**HERSTEL** (onwaar, onveilig of tegen een huisregel)

Gedaan:
- Flits: codenaam van de melder (50f6207e5); landregel stap A (80bbd5ad8).
- Residentie: 18+-poort (d380e1a78).
- OV-routes: verwijderen met lopende ritten en het overzicht per zaak (02bc39d0d).
- Vluchten: charter in de transactie (5a5316348).
- Aankomst: kop van plaatsnadering.js (df6a2c9f3).
- Navigatie: menselijk via de gedeelde configregel van Versheid (78cc84f6, bij de integratie), plus het eigen scenario (360cb0423).

Open:
- Ter plaatse: geld echt bewegen bij `booking/pay`. Geld bouwt dit; het is in uitvoering.
- Residentie: melden en blokkeren van leden, en het menulabel.
- Flits: de vooruitblik staat hard op Ibiza.
- Stad: de doeltekst.
- Hangar: charters uit Vluchten tonen.

**VERDIEPING**

Klein:
- Aankomst: annuleren vanuit de pass; de tafel in de reis en Move.
- Vluchten: eigen vlucht annuleren; melding bij een charterbesluit.
- Move: `vooraf` op het scherm.
- Navigatie: het manifest ondertekenen.
- Ter plaatse: een bod intrekken.
- Flits: een eigen melding intrekken.
- OV-routes: audit op lijnwijzigingen.
- Stad: het algoritmeregister zichtbaar.

Middel:
- Ter plaatse: scenario's voor tickets, charter, vastgoed en bezorgen.
- Stad: melding aanvullen en heropenen; werkzaamheden, raadplegingen en besluiten zichtbaar.
- OV-routes: concept en publiceren.
- Move: het herstelvoorstel (met deel 1).

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
| **Reisbureau** | HERSTEL H1-H9 en VERDIEPING uit par. 4. *Het B-proces met stappen en rollen staat in 3.1 h.* | **Volledige organisator- en agentuurketen.** Echte boekingen bij vervoerders en hotels via een consolidator of GDS/NDC, met tickets op naam. Een **mid- en backoffice** met inkoopfacturen van partners, marge per reis en de btw-reisbureauregeling (margeregeling). Een **betalingsplan** met aanbetaling, restbetaling, herinneringen en annuleringsstaffel. **Groepsreizen** met kamerblokken, attrition, cut-off, rooming list en reisleider. Een **zakelijk travelmanagement**: reisbeleid per bedrijf, goedkeuring vooraf, kostenplaatsen, verzamelfactuur, ongebruikte tickets terugwinnen. | IATA-accreditatie of een host-agency; NDC-certificering per maatschappij; contracten met consolidator en hotelbanken. Inschrijving als organisator met insolventiebescherming (SGR) en een besluit over B1. Een fiscaal advies over de margeregeling (*niet nagelopen*). Reisadviseurs als mensen. Voor zakelijk een koppeling met Onderneming (eigenaar). Jaren werk, deels buiten RTG's macht. |
| **Reizen & Veilig** | F15-F21. *Het B-proces met stappen en rollen staat in 3.2 h.* | **Reiscontinuïteit als dienst.** Een **24/7 assistentiedesk** van mensen die bij een incident de reis herstellen (omboeken, hotel, terugreis), met de hulpplicht van art. 16 als minimum. **Traveller tracking voor werkgevers** volgens ISO 31030: wie is waar bij een incident, tweerichtingsbericht, binnen 2 uur contact. **Massamelding** bij een crisis, gekoppeld aan het BZ-reisadvies. Een **achtergrondwacht** met push. | Een bemande meldkamer (diensten, protocol, aansprakelijkheid). Een externe bron voor reisadvies en incidenten (licentie of een afspraak met BZ). Besluit B4 (achtergrondwacht). Toestemming van de reiziger voor locatie per reis (privacy by design). |
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
