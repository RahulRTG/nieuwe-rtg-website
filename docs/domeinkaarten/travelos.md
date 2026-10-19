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
| K7 | **Na een crash tussen boeking en `markeerBetaald` worden geldrijen en uitkeringen opnieuw gepusht**, zonder ontdubbeling op boeking-id. | reisbureau-betaling.js:86-114 | Dubbele herkomstregels en uitkeringen klaargezet. Geld is gevraagd dit te bevestigen. |
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
| Geldrijen ontdubbelen op boeking-id | L5 | half (K7) | reisbureau-betaling.js:86-114 | Een crash na de pay-boeking en opnieuw betalen geeft geen tweede herkomstrij of uitkering. | K | NU |
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
- **B6** Is een reis een pasfunctie of geldt "minimaal een account" (de route weigert nu tier guest)?

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

*Deel 2 (Ter plaatse, Aankomst, Vluchten, Hangar, Move, OV, OV-routes, Navigatie, Stad, Residentie, Flits) volgt in hetzelfde formaat.*
