# Premiumdomeinkaarten · LivingOS-A

## Kader

**Opdracht.** De opdracht komt van Centraal, 19 oktober 2026: Beyond Premium, met de bijstelling en de aanscherping van de eigenaar van later die dag. Er komen geen nieuwe domeinen vóór V1; de bestaande apps worden verdiept.

**Wat niet mag:**
- een nieuwe motor of laag;
- een centraal woningobject (`Asset` en `RTGObject` zijn afgewezen: AFBOUWPROGRAMMA.md r.33-35, OFFICE.md r.77).

**Integratie** loopt via verwijzingen en projecties: AFBOUWPROGRAMMA.md r.40-45 en WERKRUIMTE.md par. 5. Daar staat: *"de shell verstuurt alleen een verwijzing (soort, id, label), nooit een kopie van de gegevens"*.

Geld gaat nooit vanzelf, en een voorspelling is nooit een feit.

**Verdeling (vastgesteld door Centraal).** LivingOS-A schrijft: appdossier, assets, bellen, berichten, bestellen, camera, vonk, theater, spelavond, gezin, vooruitzicht, krant, podium, huis, leven, wonen, cellier, garderobe, maison, veilig, entourage en vandaag.

Logboek gaat naar Geld voor de financiële registratie (bericht van Centraal). LivingOS-B en Geld schrijven de rest.

**Naden met andere kaarten:**
- **WorkOS** (docs/domeinkaarten/professionals-wonen.md) schrijft de kant van de zaak in de ketens a t/m e. Wonen schrijft de kant van de bewoner, met dezelfde ketennamen.
- **Geld** (docs/domeinkaarten/geld.md) is eigenaar van verplichtingen, betalingen en Logboek. Wonen verwijst ernaar.
- **Toegang** (docs/domeinkaarten/instellingen.md) levert account, vertrouwde contacten en toestemming aan Veilig.

**Legenda:**
- Lagen: L1 persoonlijk · L2 professioneel · L3 organisatorisch · L4 domeinintelligentie · L5 levenscyclus · L6 samenhang.
- Status: **bestaat**, **half** of **ontbreekt**.
- Kosten: K (klein, minder dan een dag), M (middel, een paar dagen), G (groot, een week of meer).
- Uitkomst A: bouwbaar binnen de huidige architectuur en scope.
- Uitkomst B: het domeinmaximum.

Bronnen van buiten zijn geraadpleegd op **19 oktober 2026**. Een bron die alleen tweedehands of commercieel is, staat erbij als "na te gaan".

---

## 1. Wonen (`link:wonen`)

**Doel.** Een lid beheert zijn woning over de hele levenscyclus, zonder zorgen en zonder iets twee keer te hoeven vertellen:
- weten wat er in en aan het huis zit;
- horen wanneer iets aandacht vraagt, met de reden en de onzekerheid erbij;
- een probleem tot het einde opgelost krijgen, met de juiste vakman of de verhuurder;
- het bewijs bij de hand hebben;
- bij een verhuizing of verkoop overdragen wat de volgende bewoner nodig heeft.

### 1a. Inventaris van het bewezen bestaande

Het gebouwde en het bewezene zijn hier uit elkaar gehouden. "Bewezen" betekent: een toets of een voltooiproef sluit erop.

| Onderdeel | Wat er is | Bewezen door |
|---|---|---|
| **Melden** | `/api/home/onderhoud`, `/meld` en `/annuleer` (routes/home.js:21-23; kern/woningonderhoud.js). Velden: titel, plek, notitie, urgentie (laag/normaal/hoog) en status (gemeld/geannuleerd); hooguit 25 open. | voltooiproef `link:wonen` (scripts/lib/voltooi/wonen.js): melden, 400 met reden, annuleren laat de geschiedenis staan, herstart, dubbeltik en crash |
| **Woningdossier** | de map "Woningdossier" in de kluis (kern/bestanden.js), altijd versleuteld via `kluis.versleutelBestand`; 200 MB, 15 MB per bestand. Delen per bestand op codenaam (`/api/bestanden/deel`). | dezelfde voltooiproef: upload, herstart, dubbeltik |
| **Apparaten en scènes** | kern/homekit.js: 7 vaste kamers en apparaten (lamp, tv, audio, gordijn, klimaat, stekker, slot). Scènes met AI-voorstel. Een slot gaat nooit mee in een scène of via de AI (homekit.js:36, :62). | `/api/home` laadt in de voltooiproef; de scènes zelf staan niet in een voltooiproef |
| **Vakwerk (zaakkant)** | kern/vakwerk/pro.js: offerte aanvragen (`/api/vak/offerte/vraag`), aanbieden, akkoord, en dan een boeking met `betaalMoment:'achteraf', paid:false`. pro2.js: werkbon en onderhoudsherinnering (hooguit eens per 30 dagen), dienst met `herhaalMnd` 1-60. | toetsen van vakwerk; geen koppeling met Wonen |
| **Kantoorgebouw (zaak)** | routes/supplier/gebouwpand.js: installaties `{soort, naam, keuringTot}` met signalen bij een verlopen keuring. gebouwplus.js: energie per week (kWh, m³), contracten. gebouw.js: meldingen open/bezig/klaar. | alleen voor zaken; bruikbaar als vorm, niet als object |
| **Agenda** | `/api/agenda/bewaar` met `herhaal` (dag/week/maand/jaar), `herhaalTot` en `herinner` (kern/agenda-pro.js:80-100); ICS-export met RRULE. | agenda-toetsen; geen koppeling met Wonen |
| **Vastgoed (makelaar)** | pand met energielabel, bezichtiging (aangevraagd → bevestigd/afgewezen), bod (open → geaccepteerd/afgewezen/tegenbod) en keyless bezichtiging (supplier/vastgoed/, member/handel/vastgoed.js). Geen transactiedossier. | vastgoedtoetsen |
| **Architect** | apps/architect-pda.html (`ontwerp.opdracht`, doelgroep zaak): `/api/office/architect/concept`, `/bouwstaat`, `/kritiek`, `/project`. | lid-toegang niet gevonden; zie "vraagt besluit" |
| **Voorspelling en scenario** | kern/voorspel/ (behoefte van lid of zaak), kern/stuur/gevolgcontract/voorspelling.js (meting en verklaring naast elkaar, nooit opgeteld), kern/fiscaal/scenario.js (ondernemers). | niets voor wonen of energie |

**Gaten in de belofte.**
- SCHERMEIGENAAR.json r.2146 belooft dat onderhoud.html loopt "tot een vakman is gepland en het is opgelost". Er is geen route die "gepland" of "opgelost" zet; kern/woningonderhoud.js leest 'opgelost' wel (r.37, r.49).
- Gedeelde toegang voor huisgenoten, verhuurder of vakman bestaat niet; alles staat in een eigencollectie per sessiesleutel.

### 1b. Marktvergelijking: ook het duurste pakket

| Aanbieder | Topfunctie | Prijs (bron) | RTG nu |
|---|---|---|---|
| **HomeZada** (consument, VS) | inventaris met handleidingen en garanties, onderhoudskalender uit 50+ checklists, projecten met budget en uitgaven, documenten aan items, financiën | Essentials gratis, Premium $79/jr, Deluxe $149/jr (tot 3 woningen); Pro $99 per woning ([prijsmodel 2022](https://zen.homezada.com/2022/03/31/understanding-homezadas-pricing-model/), [pro](https://www.homezada.com/professionals/pricing), [functies](https://www.homezada.com/)) | inventaris half, kalender half, projecten ontbreekt, documenten half |
| **Centriq** (consument, VS) | foto van het typeplaatje geeft handleiding en garantie, terugroepacties, onderdelen | gratis voor bewoners, betaald voor professionals ([This Old House](https://www.thisoldhouse.com/smart-homes/keep-track-of-home-maintenance-with-the-centriq-home-app)) | ontbreekt |
| **Werkspot** (NL) | klus plaatsen, voorstellen van vakmensen, directe aanvraag bij een vakman | gratis voor de consument; de vakman betaalt per lead (alleen forumbron, na te gaan) ([werkspot.nl](https://www.werkspot.nl/hoe-werkt-het/opdrachtgever)) | offerte bij vakwerk bestaat, koppeling aan melding ontbreekt |
| **O-Prognose / Spacewell / IBIS** (beheerders, corporaties) | NEN 2767-conditiemeting met automatische conditiescores, MJOP over 1-50 jaar, elementenbibliotheek | niet openbaar; in aanbestedingen ([Tenderned 2024](https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties/413352/documenten/13979973/content), [Spacewell](https://spacewell.com/asset-facility-management-software/maintenance-planning-software/), [O-Prognose-brochure](https://www.bouwstenen.nl/sites/default/files/uploads/Brochure_O-Prognose_Vastgoedbeheer_2014.pdf)) | ontbreekt (alleen `keuringTot` bij kantoorpanden) |
| **IAMD / TraxOne / Simple-Simon** (installateurs) | werkbon aan een installatie (merk, serienummer), onderhoudscontract, planbord, handtekening van de klant | niet onderzocht ([Simple-Simon](https://apps.apple.com/nl/app/simple-simon/id897884395), [IAMD](https://intercom.help/iamd/nl/articles/9677475-een-reparatie-of-een-onderhoud-uitvoeren-op-een-installatie)) | werkbon bestaat bij vakwerk, zonder installatie |

**Conclusie.** Consumentenapps bewaren en herinneren. Professionele pakketten meten conditie en plannen. Geen van beide verbindt de bewoner, de vakman, de verhuurder en het geld in één keten met toestemming. Dat is het gat dat RTG kan vullen (1e).

### 1c. Analyse van het volledige domein: hoe de mensen echt werken

| Wie | Wat ze doen en waaraan ze gebonden zijn | Bron |
|---|---|---|
| **Bewoner-eigenaar** | is zelf verantwoordelijk voor een rookmelder op elke verdieping in de vluchtroute (EN 14604), verplicht in bestaande woningen sinds 1 juli 2022 (Bouwbesluit 2012 art. 6.21 lid 6). Gasinstallatie minstens eens per 2 jaar laten controleren door een CO-vrij gecertificeerd bedrijf (advies Rijksoverheid). Energielabel 10 jaar geldig, opgenomen door een erkende EP-adviseur (NTA 8800), nodig bij verkoop. | [Van Bruggen](https://www.vanbruggen.nl/actueel/nieuws/2022/rookmelders-verplicht-vanaf-1-juli-2022), [Rijksoverheid CO](https://www.rijksoverheid.nl/vraag-en-antwoord/gezond-en-veilig-wonen/hoe-voorkom-ik-koolmonoxidevergiftiging-in-mijn-huis), [Rijksoverheid energielabel](https://www.rijksoverheid.nl/vraag-en-antwoord/energielabel-woningen-en-gebouwen/wat-is-een-geldig-energielabel) |
| **Huurder** | doet de kleine herstellingen (binnenschilderwerk, kraanleertjes, hang- en sluitwerk) volgens het Besluit kleine herstellingen (art. 7:240 BW); de verhuurder herstelt gebreken (art. 7:206 BW); het contract kan afwijken. Bij een geschil: de Huurcommissie. | [Omgevingsweb](https://omgevingsweb.nl/nieuws/blog-14-helder-huurrecht-onderhoudsverdeling-tussen-verhuurder-en-huurder/), [Stb. 2003, 168](https://zoek.officielebekendmakingen.nl/stb-2003-168.pdf) |
| **Verhuurder** | Wet goed verhuurderschap (sinds 1 juli 2023): schriftelijke informatie over rechten en plichten, waarborgsom hooguit 2x de kale huur en binnen 14 dagen terug, beleid tegen discriminatie. Rookmelders in de huurwoning (onderhoud door de huurder, volgens consumentenbron). | [Aedes](https://aedes.nl/huurbeleid-en-betaalbaarheid/de-wet-goed-verhuurderschap-wat-verandert-er-voor-woningcorporaties), [Omgevingsweb](https://omgevingsweb.nl/nieuws/verhuurders-opgelet-nieuwe-verplichtingen-per-1-juli-2023/) |
| **Woningcorporatie** | reparatieverzoeken van huurders, planmatig onderhoud uit conditiemetingen (NEN 2767, scores 1-6) en een MJOP, energielabels van de portefeuille, een klachtenprocedure (Woningwet art. 55c; commerciële bron, na te gaan), toezicht door de Autoriteit woningcorporaties. | [NEN 2767 in MJOP](https://www.bouwstenen.nl/sites/default/files/171128%20Spelregels%20juiste%20versie.pdf), [Aedes energielabels](https://aedes.nl/media/document/wegwijzer-data-energielabels-op-orde) |
| **VvE** | reserveert jaarlijks minstens 0,5% van de herbouwwaarde, of volgens een MJOP dat hooguit 5 jaar oud is en minstens 10 jaar beslaat (sinds 1 januari 2018). Ledenvergadering, besluiten, gemeenschappelijke delen. | [Eerste Kamer](https://www.eerstekamer.nl/overig/20250120/evaluatie_wet_verbeteren/document) |
| **Installateur** | onderhoud aan installaties met merk en serienummer, onderhoudscontracten met een vaste cyclus, een werkbon met een handtekening. Sinds april 2023 alleen gecertificeerde bedrijven aan cv-ketels (CO-vrij; consumentenbron, na te gaan). | [Univé](https://www.unive.nl/veilig-wonen/cv-onderhoud/co-melder), [IAMD](https://intercom.help/iamd/nl/articles/9677475-een-reparatie-of-een-onderhoud-uitvoeren-op-een-installatie) |
| **Aannemer** | opdracht, uitvoering, oplevering. Onder de Wkb levert hij een consumentendossier bij oplevering (BW 7:757a): tekeningen, berekeningen, materialen en informatie over gebruik en onderhoud. | [Kiwa](https://www.kiwa.com/nl/nl/specials/wkb/hoe-kunt-u-in-de-praktijk-werken-met-de-wkb/) |
| **Architect** | ontwerp, bouwstaat en vergunningsaanvraag. De Vergunningcheck in het Omgevingsloket zegt of een vergunning of melding nodig is. Zonnepanelen zijn bouwtechnisch vergunningvrij (Bbl art. 2.27); een dakkapel vaak ook, onder voorwaarden. | [IPLO](https://iplo.nl/thema/bouw/bouwen-vergunning-melding/zonnecollectoren-zonnepanelen-dak/) |
| **Gemeente** | verleent vergunningen (Omgevingswet), houdt toezicht en handhaaft de Wet goed verhuurderschap. Een adreswijziging gaat via de BRP. | zie boven |
| **Makelaar** | aanbod, bezichtiging, bod, transactiedossier; het energielabel is verplicht bij verkoop. | genre `vastgoed` in RTG |

**Uit deze analyse volgt:**
1. Het domein draait om **objecten met een cyclus en een verantwoordelijke**. Een rookmelder (bewoner of huurder), een cv-ketel (eigenaar, gecertificeerde installateur, 2 jaar), een label (10 jaar) en een MJOP (5 jaar) hebben elk een vaste vorm.
2. **Wie betaalt en wie herstelt hangt af van de rol.** Een huurder en een eigenaar die dezelfde lekkage melden, horen elk iets anders te horen.
3. **Bewijs is wettelijk.** Het consumentendossier, het label en het CO-certificaat zijn stukken die iemand moet kunnen tonen.

### 1d. Functiecatalogus, concreet en in L1-L6

Elke functie heeft:
- de gegevens en hun bron;
- de regel of norm;
- de rekenwijze;
- de onzekerheid en hoe die getoond wordt;
- wanneer iemand iets hoort;
- de rollen en wie toestemming geeft;
- de uitzonderingen;
- het acceptatiecriterium. Dat wordt een stap in scripts/lib/voltooi/wonen.js.

Eigenaren van schermen staan tussen `backticks` en komen uit SCHERMEIGENAAR.json.

**W1 · Ruimtes, bouwdelen en installaties (woningidentiteit) · L1 · half · M · A, nu**
- **Gegevens:**
  - een ruimte heeft naam en verdieping;
  - een installatie heeft:
    - soort (cv-ketel, warmtepomp, boiler, ventilatie, zonnepanelen, rookmelder, CO-melder, meterkast);
    - merk en type, als vrije tekst;
    - bouw- of plaatsingsjaar;
    - de ruimte waarin hij staat;
    - optioneel: serienummer, garantieTot, laatsteOnderhoud.
- **Bron:** het lid zelf. Het systeem verzint niets en kent geen merkenlijst als partner.
- **Bouwstenen:** de kamers van homekit (de 7 vaste kamers worden de beginwaarde), de vorm `{soort, naam, keuringTot}` uit gebouwpand.js, en een eigencollectie per sessiesleutel zoals bij woningonderhoud.js.
- **Rollen:** alleen het lid.
- **Uitzondering:** een installatie zonder jaar mag. Dan rekent W7 niet en zegt het scherm waarom.
- **Acceptatie:** het lid legt "Badkamer" en "CV-ketel, 2015, in Zolder" vast. Na een herstart staan ze er nog. Een ander lid krijgt 404. Een dubbeltik geeft één installatie.

**W2 · Onderhoudscyclus per installatie, met norm (technisch beheer) · L1/L4 · ontbreekt · M · A, nu**
- **Gegevens:** soort en laatsteOnderhoud uit W1.
- **Regel:** een vaste tabel `cyclusPerSoort` met bron en datum per regel:
  - gasverbrandingsinstallatie: 24 maanden, advies Rijksoverheid;
  - rookmelder: zelf testen, met een interval dat het lid instelt (fabrikant), omdat een wettelijk testinterval niet gevonden is;
  - energielabel: 120 maanden, Rijksoverheid.
  Waar geen bron is, staat er geen standaard: het lid stelt dan zelf een interval in.
- **Rekenwijze:** volgende = laatsteOnderhoud + interval.
- **Wanneer iemand iets hoort:** 30 dagen ervoor een attentie; op de vervaldag "verlopen" (zelfde vorm als `keuringTot` in gebouwpand.js).
- **Onzekerheid:** zonder laatsteOnderhoud staat er "onbekend, voer de laatste beurt in", nooit een gegokte datum.
- **Agenda:** W6.
- **Acceptatie:** een cv-ketel met laatste beurt 2024-11-01 toont "volgende beurt 2026-11-01 (advies: eens per 2 jaar, bron Rijksoverheid)". Een rookmelder zonder ingesteld interval toont geen datum.

**W3 · Melding afronden: gepland en opgelost (technisch beheer, L5) · L1/L5 · half · K · A, nu**
- **Gegevens:** de bestaande melding, met erbij `opgelostAt`, `oplossing` (tekst), en optioneel `opdrachtRef` (W4) en `installatieId` (W1).
- **Regel:** van gemeld naar gepland gaat alleen met een opdrachtRef. Naar opgelost kan altijd; daarna verandert er niets meer (stand `hooguitEens`).
- **Rollen:** het lid zet de melding op opgelost.
- **Acceptatie:**
  - "opgelost" met een notitie verschijnt in de geschiedenis;
  - een tweede keer afronden geeft hetzelfde resultaat met herhaald;
  - een geannuleerde melding kan niet meer op opgelost;
  - dit lost het gat in SCHERMEIGENAAR r.2146 op.

**W4 · Van melding naar vakman, keten a (L2/L6) · half · M · A, nu**
- **Gegevens:** melding-id, titel, plek, foto's als bestand-id's, en de installatie (W1).
- **Wat gedeeld wordt:** een **projectie** met precies die velden, alleen als het lid toestemming geeft voor die ene zaak.
- **Bouwsteen:** `/api/vak/offerte/vraag` in kern/vakwerk/pro.js, met een nieuw veld `bronRef: {soort:'woning.melding', id}`.
- **De keten:**
  1. De zaak (`zaak.beheer`, genre bouw of vakwerk) ziet de projectie en biedt aan.
  2. Het lid gaat akkoord.
  3. Er ontstaat een boeking (`betaalMoment:'achteraf', paid:false`).
  4. De melding wordt "gepland" (W3), met de verwijzing erbij.
  5. De werkbon (pro2.js) komt terug als verwijzing.
- **Rollen en toestemming:**
  - het lid kiest de zaak en geeft toestemming per melding;
  - de zaak ziet nooit de rest van het dossier;
  - intrekken van de offerte maakt de projectie ongeldig.
- **Uitzonderingen:**
  - Een huurder krijgt eerst de vraag "kleine herstelling of voor de verhuurder?". De verdeling volgt het Besluit kleine herstellingen, als uitleg en niet als oordeel: het contract gaat voor.
  - Is de huurder verhuurd door een zaak in RTG, dan gaat de melding naar de verhuurder (keten a). Anders staat er "geef het door aan je verhuurder" met de projectie als pdf.
- **LOS:** valt vakwerk uit, dan blijft de melding "gemeld" en zegt het scherm "status bij de vakman nu niet te zien".
- **Acceptatie:**
  - uit een melding ontstaat een offerteaanvraag met bronRef;
  - na akkoord is de melding "gepland";
  - een andere zaak ziet niets;
  - vakwerk uit laat de melding ongemoeid.

**W5 · Garantie en handleiding per installatie (technisch beheer en documenten) · L1 · ontbreekt · K · A, nu**
- **Gegevens:** garantieTot, en bestand-id's van het garantiebewijs en de handleiding in de kluis (`docs.bestanden`; Wonen bewaart alleen het id).
- **Wanneer iemand iets hoort:** 30 dagen voor het einde van de garantie, dan "verlopen".
- **Rollen:** alleen het lid.
- **Uitzondering:** is de kluis uit, dan staat er "bewijs nu niet te openen" en blijft de datum zichtbaar.
- **Acceptatie:** de handleiding opent vanuit "CV-ketel". De garantie die over 20 dagen afloopt geeft een attentie. Een verwijderd bestand geeft "bewijs ontbreekt", nooit een fout.

**W6 · Cyclus naar de Agenda (L6) · half · K · A, nu**
- **Bouwsteen:** `/api/agenda/bewaar` met `herhaal`, `herinner` en een verwijzing `bron:{soort:'woning.installatie', id}`. De eigenaar is `agenda.afspraken`.
- **Toestemming:** het lid kiest "zet in mijn agenda" per cyclus.
- **LOS:** valt de agenda uit, dan blijft de cyclus in Wonen staan met "niet in agenda". Er gebeurt geen stille poging opnieuw zonder dat het lid het weet.
- **Acceptatie:**
  - een jaarlijkse ketelbeurt wordt een herhalende afspraak met een herinnering 7 dagen vooraf;
  - verwijderen in Wonen vraagt of de afspraak ook weg moet;
  - zonder agenda staat de cyclus er toch.

**W7 · Vervangingsplanning met onzekerheid (L4) · ontbreekt · M · A, later**
- **Gegevens:** soort en bouwjaar (W1), conditie (W8, optioneel) en het aantal storingen in 24 maanden (meldingen met installatieId).
- **Regel:** een levensduurbandbreedte per soort, met bron. Zonder bron rekent W7 niet voor die soort. Fabrikanten- en brancheopgaven moeten nog worden vastgelegd; zie 1h.
- **Rekenwijze:**
  - venster = bouwjaar + [ondergrens, bovengrens];
  - het venster schuift naar voren bij een conditiescore van 4 of slechter, of bij meer dan 2 storingen in 24 maanden;
  - de verschuiving staat erbij als reden.
- **Onzekerheid:** altijd een venster ("tussen 2031 en 2036"), nooit één datum; de aannames staan eronder. Dit hergebruikt de vorm van stuur/gevolgcontract/voorspelling.js: meting en verklaring naast elkaar.
- **Wanneer iemand iets hoort:** als het venster begint.
- **Acceptatie:** een ketel uit 2012 met 3 storingen toont een venster en "vervroegd door 3 storingen". Zonder bouwjaar staat er "kan niet rekenen: bouwjaar ontbreekt".

**W8 · Conditiemeting van de eigen woning (L4/L1) · ontbreekt · M · B**
- **Norm:** NEN 2767, scores 1 (nieuwbouwstaat) tot 6 (slechtst).
- **Wie meet:** het lid kan een eigen inschatting geven, met het label "eigen inschatting, geen NEN-meting". Een NEN-meting komt alleen van een vakman die de projectie krijgt (keten a) en wordt gemarkeerd met wie meet.
- **Acceptatie:** een eigen score en een vakmanscore staan naast elkaar, nooit gemiddeld.

**W9 · Verbruik en energiebalans (energie) · L1/L4 · ontbreekt · M · A, later**
- **Gegevens:** meterstanden (stroom in kWh, gas in m³, warmte in GJ) per datum, door het lid ingevoerd; vorm `energie {week, stroomKwh, waterM3}` uit gebouwplus.js. Zonnepanelen-opbrengst als eigen reeks.
- **Rekenwijze:** verbruik per periode = verschil tussen standen. Een negatief verschil is een fout en wordt geweigerd met de reden.
- **Onzekerheid:** een periode zonder standen wordt niet geïnterpoleerd maar als gat getoond.
- **Uitzondering:** een meterwissel is een reset met een nieuwe beginstand.
- **Acceptatie:** drie maandstanden geven twee verbruiken. Een lagere stand zonder meterwissel geeft 400 "lager dan de vorige stand".

**W10 · Energiescenario's: isolatie, zonnepanelen, warmtepomp (L4) · ontbreekt · G · B**
- **Gegevens:** W9, het energielabel (datum en klasse, door het lid ingevoerd) en W1.
- **Regel:** de besparing per maatregel als bandbreedte, met de bron van kentallen en tarief en de datum. Zonder bron rekent het niet.
- **Vergunning:** voor zonnepanelen staat erbij "bouwtechnisch vergunningvrij (Bbl art. 2.27), check het Omgevingsloket". Er wordt nooit een vergunning beloofd.
- **Acceptatie:** dezelfde invoer geeft dezelfde bandbreedte. Een verlopen tarief geeft "tarief verouderd".

**W11 · Energielabel bewaken (energie) · L1 · ontbreekt · K · A, nu**
- **Gegevens:** klasse, registratiedatum en het labeldocument (bestand-id).
- **Regel:** 10 jaar geldig (Rijksoverheid).
- **Wanneer iemand iets hoort:** 6 maanden voor het verlopen, en altijd zodra een verkoop- of verhuurketen start (W17).
- **Acceptatie:** een label van 2017-03-01 toont "geldig tot 2027-03-01" en geeft in september 2026 een attentie.

**W12 · Verbouwproject (renovatie), keten e · L1/L2/L5/L6 · ontbreekt · G · A, later**
- **Eigenaren per behoefte (SCHERMEIGENAAR):**
  - Wonen (`woning.dossier`) houdt het project als verwijzingenlijst: welke installaties en ruimtes, en welke offertes;
  - de aannemer (genre `bouw`, `zaak.beheer`) bezit opdracht, materiaal en uitvoering;
  - Project Room (`werk.project`) draagt de samenwerking, als het lid toegang heeft (vraagt besluit);
  - Geld (`geld.overzicht`) toont begroting en betaald, met betalingen via betaalWaarheid;
  - de kluis (`docs.bestanden`) bewaart tekeningen en het Wkb-consumentendossier;
  - de stuurlaag (kern/stuur: goedkeuring, mandaat) bewaakt dat elke betaling en elk akkoord van het lid komt.
- **Afhankelijkheden:** een taak met `naNa: [taakId]`. Een taak start niet voordat zijn voorganger klaar is; zo niet, dan zegt het scherm wie wacht.
- **Oplevering:** het project is pas "opgeleverd" als de aannemer het consumentendossier heeft geleverd (BW 7:757a) of als het lid uitdrukkelijk "zonder dossier" kiest. Dat staat dan zichtbaar in de woninggeschiedenis.
- **Acceptatie:**
  - een project met twee offertes en één akkoord toont de begroting uit Geld;
  - valt Geld uit, dan staat er "bedragen nu niet te zien";
  - opleveren zonder dossier vraagt een uitdrukkelijke keuze.

**W13 · Vergunningcheck en vergunningdossier (renovatie) · niet doen (indienen) / L1 (bewaren)**
- Een vergunning indienen namens het lid is **voorbehouden**. RTG verwijst naar de Vergunningcheck in het Omgevingsloket en bewaart het besluit als document aan het project (W12).

**W14 · Woonlasten (financieel beheer) · L6 · ontbreekt · M · A, wacht op Geld**
- Geld is eigenaar van de verplichting: huur, hypotheek, VvE-bijdrage, energie en verzekering. Wonen toont per woning een projectie (bedrag, vervaldag, verwijzing) en bezit niets.
- Een onderhoudsreserve is een **reservering in Geld** die het lid zelf zet. Wonen levert de prognose (W7) als onderbouwing, nooit als afschrijving.
- **Grens met Logboek** (afgestemd met Geld op 19 oktober):
  - **Geld (Logboek) bezit de financiële registratie** van een kostbaar bezit: aanschaf, waarde, kosten en verwachte jaarkosten (GELD.md fase 4, "asset ledger in Logboek").
  - **Het onderhoud van het fysieke object** (keuring, service, reparatie, stalling) **is van het objectdomein**:
    - de woning en haar installaties: Wonen (W1-W5);
    - een vliegtuig of helikopter: Hangar (`reizen.vliegtuig`);
    - een voertuig of jacht: het objectdomein als dat bestaat, anders "vraagt besluit".
  - Logboek verwijst naar de onderhoudsregel (bronRef = object-id of opdracht) en toont alleen de kosten. Het bezit de regel niet.
  - **Gemeten spanning:** kern/rechterhand/logboek.js bewaart vandaag zelf onderhoudsregels met kosten en een volgende datum. Geld zet dat als "half / vraagt besluit". Voor de woning geldt: Logboek neemt de woning niet op.
- **Acceptatie:** valt Geld uit, dan staat er "woonlasten nu niet te zien", zonder bedrag. Er gebeurt nooit een automatische reservering.

**W15 · Documenten aan woning, ruimte, installatie of project (documentbeheer) · L1/L6 · ontbreekt · K · A, nu**
- **Gegevens:** bestand-id's (`docs.bestanden`) met een soort: eigendom, handleiding, certificaat, verzekering, garantie, opleverdossier, label.
- **Regel:** de bytes blijven in de kluis.
- **Acceptatie:** een certificaat hangt aan "CV-ketel" en opent daar. Een document kan aan meer dingen hangen, zonder kopie.

**W16 · Slim wonen: automatisering op tijd en energieregels · L1 · ontbreekt · M · A, later**
- **Gegevens:** een scène (bestaat) met een tijdschema: dagen en tijdstip.
- **Regels:** een slot doet nooit mee (homekit.js:36). Een regel als "stekker uit als de thuisbatterij leeg is" alleen voor apparaten met een echte meting. Bij de demo-merken staat er "demo".
- **Wanneer iemand iets hoort:** een gemiste uitvoering (server uit) meldt zich bij de volgende start. Er gebeurt geen stil inhalen.
- **Acceptatie:** een scène op 07:00 werkdagen draait, en een gemiste run toont "gemist om 07:00".

**W17 · Toegang voor gasten en deurcodes · vraagt besluit · G · B**
- Echte sloten vragen aansprakelijkheid en een provider. Voor de bezichtiging bestaat vastgoed-keyless-toegang.js; voor de woning van het lid gebeurt niets zonder besluit.

**W18 · Veiligheidskaart van het huis (veiligheid) · L1 · ontbreekt · K · A, nu**
- **Gegevens:**
  - rookmelders per verdieping (W1-soort rookmelder) met testdatum;
  - CO-melder bij de ketel;
  - plaats van de hoofdkraan, de gaskraan en de groepenkast;
  - noodnummers;
  - een vluchtroute in tekst.
- **Regel:** een rookmelder op elke verdieping in de vluchtroute (Bouwbesluit art. 6.21 lid 6). Ontbreekt er een, dan staat er "volgens de regel hoort hier een rookmelder", uitleg en geen oordeel.
- **Rollen:** eigenaar en huurder hetzelfde. Bij een huurwoning staat erbij "de verhuurder plaatst, jij onderhoudt", met de bron.
- **Samen:** zichtbaar vanuit Veilig (`veilig.noodcontacten`) als verwijzing.
- **Acceptatie:** een woning met 2 verdiepingen en 1 rookmelder toont het verschil. Een testdatum ouder dan het zelf ingestelde interval geeft een attentie.

**W19 · Verhuizen: plan, inventaris, overdracht en oplevering · L5/L6 · ontbreekt · M · A, later**
- **Gegevens:** een verhuisdatum, een checklist (tellerstanden, sleutels, afmelden en aanmelden), en een inventaris van installaties en documenten die meegaan of blijven.
- **Rollen:**
  - een verhuizer via offerte (genre `verhuizer`, vakwerk);
  - een adreswijziging bij de gemeente is **voorbehouden**: RTG wijst de weg, zonder in te dienen.
- **Overdracht, keten f:**
  - het lid kiest wat de volgende bewoner krijgt;
  - de ontvanger (een lid) krijgt een **kopie** en een eigen W1-W5;
  - er blijft niets gedeeld.
- **Bij verkoop, keten b:** de makelaar (`vastgoed`) krijgt een projectie van label, opleverdossier en onderhoudsgeschiedenis, per stuk en met een einddatum.
- **Acceptatie:**
  - de ontvanger ziet de gekozen installaties met garantie, de verzender houdt zijn eigen kopie;
  - intrekken vóór acceptatie lukt;
  - na acceptatie is de kopie van de ontvanger.

**W20 · Woninggeschiedenis (L5) · half · K · A, nu**
- **Wat het is:** een tijdlijn over de eigen objecten en verwijzingen (meldingen, opdrachten, documenten, cycli, besluiten), met datum en bron per regel. Het is een **projectie**, geen nieuwe opslag. Leven (`link:leven`) kan haar weer projecteren.
- **Acceptatie:** melden, plannen, opgelost en het garantiebewijs staan op volgorde. Valt een bron uit, dan staat er "deel van de geschiedenis nu niet te zien".

**W21 · Huisgenoten in dezelfde woning (L3) · vraagt besluit · M · B**
- Nu bestaat alleen het lid zelf.
- **Voorstel:** de woning blijft van één lid (de eigenaar in Wonen). Een huisgenoot krijgt een **rol** per woning: melden, zien of beheren. Dat volgt het patroon van de gezinsagenda (`gezin:`).
- **Besluit nodig:** wie eigenaar is bij gelijkwaardige huisgenoten, en wat er gebeurt bij uit elkaar gaan.

**W22 · Huurdersmodus en verhuurderketen c · L2/L6 · ontbreekt · M · B**
- **Gegevens:** huurcontract-als-lid (begin, kale huur, waarborgsom) en de informatie die de verhuurder verplicht verstrekt (Wet goed verhuurderschap) als document.
- **Regels:**
  - een waarborgsom boven 2x de kale huur wordt gemarkeerd, als uitleg en niet als oordeel;
  - bij het einde van de huur volgt Geld de 14 dagen voor terugbetaling;
  - geld beweegt nooit vanzelf.
- **Vraagt besluit:** het genre verhuurder of corporatie bestaat niet (WorkOS).

**W23 · VvE-lidmaatschap, keten d · L2/L3/L6 · ontbreekt · M · B**
- **Wat het lid ziet:** de vergadering, de stukken en het MJOP met het reservefonds als projectie van de VvE-zaak, en de eigen stem.
- **Regel:** het reservefonds wordt getoetst aan 0,5% van de herbouwwaarde, of aan een MJOP dat hooguit 5 jaar oud is. Afwijking wordt gemarkeerd.
- **Vraagt besluit:** genre VvE (WorkOS), en of stemmen via de bestaande democratie-stemmotor mag.

### 1e. RTG-exclusieve mogelijkheden

Deze bestaan alleen omdat apps, rollen en processen verbonden zijn:
1. **Eén melding, de juiste route.** Of het lid huurt of eigenaar is, bepaalt wie de melding krijgt (W4). Een huurder ziet de verdeling uit het Besluit kleine herstellingen als uitleg; de verhuurder krijgt de projectie, met de status terug. Geen marktleider heeft de bewoner, de verhuurder en de vakman in één keten.
2. **Een vakman die mag.** RTG kent persoonseis en vakbewijs (kern/persoonseis.js, kern/vakbewijs.js). Een handeling "onderhoud aan een gasverbrandingsinstallatie" kan het CO-vrij-certificaat van de onderneming eisen. Het lid ziet dan alleen zaken die het bewijs hebben laten zien, afgetekend door een mens van RTG. RTG valideert niets inhoudelijk; zie de regels in AGENTS.md.
3. **Betaald heet pas betaald.** Een werkbon of verbouwing wordt via betaalWaarheid betaald. De melding of het project wordt nooit stil afgesloten op een betaling die niet bevestigd is (W4, W12).
4. **Bewijs dat meeverhuist.** Garantie, label en opleverdossier gaan als kopie mee naar de volgende bewoner (W19). De makelaar ziet alleen wat het lid deelt.
5. **Eén agenda, één tijdlijn.** Ketelbeurt, VvE-vergadering en verhuisdag staan in de gezinsagenda. De woninggeschiedenis (W20) vertelt het hele verhaal zonder centrale database.

### 1f. Bouwstenen en ontbrekende koppelingen

| Bouwsteen (eigenaar) | Bestaat | Ontbrekende koppeling |
|---|---|---|
| woningonderhoud.js (`woning.onderhoud`) | melden, annuleren | status gepland en opgelost (W3); installatieId; opdrachtRef |
| homekit.js (`woning.apparaten`) | kamers, apparaten, scènes | ruimtes delen met W1; schema (W16) |
| bestanden.js en kluis (`docs.bestanden`) | versleutelde map, delen per bestand | bestand-id aan een object (W15); een projectie met einddatum (W19) |
| vakwerk/pro.js en pro2.js (`zaak.beheer`) | offerte, boeking, werkbon | `bronRef` naar een melding (W4); werkbon terug als verwijzing |
| agenda-pro.js (`agenda.afspraken`) | herhaal en herinner | `bron`-verwijzing naar een installatie (W6) |
| betaalWaarheid (Geld) | betaling met bronRef | bronRef = opdracht of project (W4, W12) |
| persoonseis.js en vakbewijs.js | eis per genre en handeling | handeling "gasinstallatie" met CO-vrij (1e.2) |
| stuur (goedkeuring, mandaat) | akkoord van het lid | akkoord per verbouwstap (W12) |
| vastgoed (`vastgoed`) | bezichtiging, bod | projectie uit het woningdossier (W19) |
| voorspelling (gevolgcontract) | meting en verklaring naast elkaar | levensduurtabel met bron (W7) |

### 1g. Prioritering

| Volgorde | Functie | Kosten | Complexiteit | Hangt af van |
|---|---|---|---|---|
| 1 | W1 ruimtes en installaties | M | laag | — |
| 2 | W3 gepland en opgelost | K | laag | — |
| 3 | W15 documenten aan objecten | K | laag | W1 |
| 4 | W5 garantie en handleiding | K | laag | W1, W15 |
| 5 | W2 cyclus met norm | M | middel (bronnentabel) | W1 |
| 6 | W6 cyclus naar Agenda | K | laag | W2 |
| 7 | W18 veiligheidskaart | K | laag | W1 |
| 8 | W11 energielabel | K | laag | W15 |
| 9 | W20 woninggeschiedenis | K | laag | W3, W15 |
| 10 | W4 melding naar vakman | M | middel (projectie en toestemming) | W1, W3 |
| later | W9, W7, W12, W14, W16, W19 | M-G | middel-hoog | Geld (W14), bronnen (W7) |
| B | W8, W10, W17, W21, W22, W23 | M-G | hoog | besluiten en genres |

**Aanbeveling voor nu, gesplitst.**
- **HERSTEL:** geen open fout. Het gat in SCHERMEIGENAAR r.2146 (onderhoud beloofde "gepland" en "opgelost") is met e8e70ca70 rechtgezet in de doeltekst.
- **VERDIEPING (wacht op het akkoord voor de familie `wonen`):** W1, W3, W15, W5, W2, W6, W18, W11, W20 en W4, in de volgorde van de tabel.

**Uitkomst A (huidige architectuur en scope):** W1 t/m W6, W9, W11, W12, W14 t/m W16, W18 t/m W20. Alles op bestaande vermogens, met eigencollecties, verwijzingen en projecties.

**Uitkomst B (domeinmaximum).** Dit zijn nieuwe professionele processen samen met de bewoner:
- de **corporatie-intake**: een reparatieverzoek van een huurder komt getrieerd binnen, met de kleine-herstellingenverdeling en de status terug;
- **planmatig onderhoud**: de conditiemeting (NEN 2767) en het MJOP van de corporatie of VvE kondigen werk bij de bewoner aan, met afspraak en toegang;
- **installateurscontracten** met installatiegegevens die de bewoner deelt, en CO-vrij als vakbewijs;
- een **VvE** met vergadering, stem en reservefondstoets;
- een **verhuurder** die zijn informatieplicht en waarborgsom via RTG nakomt;
- een **makelaar** met een transactiedossier dat leest uit wat de verkoper deelt.

B vraagt genres en besluiten (1h).

### 1h. Extern, vraagt besluit, en twijfels voor Centraal

**Vraagt besluit:**
- de genres verhuurder, corporatie, VvE en vastgoedbeheerder (via WorkOS);
- gedeelde woning en huisgenoten (W21);
- echte sloten (W17);
- of Project Room voor een lid en een aannemer samen open mag (W12);
- of de architect-PDA (`ontwerp.opdracht`, routes `/api/office/architect/*`) een zaak-genre wordt of kantoor blijft. Nu kan een lid er geen opdracht geven.

**Extern:**
- P1 of slimme meter: hardware of een netbeheerder;
- een levensduurtabel met bronnen (branche, fabrikant);
- energietarieven en kentallen met datum (W10);
- de NEN 2767-tekst zelf (betaald, NEN).

**Voorbehouden:** een vergunning indienen (W13), een adreswijziging (W19), en een oordeel over wie een herstel betaalt (alleen uitleg, nooit een besluit).

**Twijfel 1, voor Centraal.** RTDocs (`docs.office`) of de kluis (`docs.bestanden`) voor woningdocumenten? Ik kies de kluis voor de bestanden en RTDocs alleen voor wat het lid zelf opstelt. Zo is er geen tweede documentmodel.

**Twijfel 2.** Het energielabel bestaat al als veld bij een vastgoedpand. W11 is het label van de eigen woning, ingevoerd door het lid. Het zijn twee eigenaren van twee feiten, die pas bij keten b naar elkaar verwijzen.

### 1i. Toetsbaar eindcontract Beyond Premium · Wonen

Dit contract vervangt de acht bewijzen nooit. Elke regel wordt een stap in een voltooiproef, en "gehaald" betekent dat die stap sluit.

| Dimensie | Eis | Hoe getoetst |
|---|---|---|
| **Breedte** | alle tien families hebben minstens één werkende functie: identiteit W1, technisch W2-W5, energie W9 of W11, renovatie W12, financieel W14, documenten W15, slim wonen bestaat, veiligheid W18, verhuizen W19, geschiedenis W20 | één stap per familie in voltooi/wonen.js |
| **Professionele diepte** | een vakman ontvangt een melding als projectie, biedt aan, en de werkbon komt terug als verwijzing (W4) | stap met een `bouw`-zaak in de kantoorwereld |
| **Levenscyclus** | van melden via gepland en opgelost naar de geschiedenis (W3, W20); van installeren via cyclus en vervangvenster (W1, W2, W7) | stap "volledige cyclus van één cv-ketel" |
| **Samenwerking en rollen** | huurder en eigenaar krijgen elk de juiste route (W4); een andere zaak ziet niets; intrekken werkt | bevoegdheidsstappen, 401 / 403 / 404 |
| **Domeinintelligentie** | elke datum of schatting toont de bron, en een onzekerheid toont een venster; zonder bron wordt er niet gerekend (W2, W7) | stap "geen bron → geen datum" |
| **Los functioneren** | met Agenda, vakwerk, Geld en de kluis elk afzonderlijk uit lukt melden, en het scherm noemt wat er niet kan | vier storingsstappen |
| **RTG-ketens** | de keten "de cv-ketel lekt" van melding tot garantiebewijs loopt over vijf eigenaren zonder gedeelde data | één ketenstap, met een controle in de opslag dat er geen kopieën zijn |
| **Bewezen betrouwbaarheid** | de acht bewijzen van APPWERKT.json blijven groen: bereikbaar, bedienbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent, bevoegd, herstelbaar | de bestaande voltooiproef en de IDOR- en rolproeven |

**Gebruikersketen met storingen, "de cv-ketel lekt":**
1. Het lid meldt de lekkage aan de installatie "CV-ketel".
2. Het vraagt een offerte bij een `bouw`-zaak die CO-vrij heeft laten zien.
3. Het geeft akkoord.
4. De afspraak komt in de Agenda.
5. De werkbon komt terug.
6. Het lid betaalt via Geld.
7. De melding staat op opgelost.
8. Het garantiebewijs hangt aan de installatie.
9. De volgende beurt staat over 2 jaar.

**Storingen:**
- Agenda uit: de afspraak staat niet in de agenda, en het scherm zegt dat.
- Betaling geweigerd: de werkbon heet "niet betaald" en de melding blijft open.
- Kluis uit: het bewijs is niet bewaard, maar de melding is wel opgelost.
- Vakwerk uit: de melding blijft "gemeld" met "status vakman niet te zien".

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** melden, annuleren en de meldingenlijst met geschiedenis (`/api/home/onderhoud`), apparaten en scenes (`/api/home`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - de kluis (`docs.bestanden`) voor het woningdossier. Uit: "Het woningdossier is nu niet te openen. Melden werkt gewoon."
- **Optionele koppelingen:**
  - vakwerk (W4). Uit: "Status bij de vakman nu niet te zien."
  - Agenda (W6). Uit: "Niet in je agenda gezet."
  - Geld (W14). Uit: "Woonlasten nu niet te zien."
  - Veilig (W18), Logboek (W14, grens met Geld).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:wonen': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:wonen': { uitgeeft: ['woning.melding', 'woning.installatie'], ontvangt: ['vak.werkbon'],
  ketens: [{ naam: 'melding-naar-vakman', laag: 'scherm', familie: 'wonen',
    schakels: ['link:wonen', '<werkos-ingang van de vakman>'], proef: { register: 'VOLTOOIPROEF.json', instrument: 'scripts/voltooiproef.js' } }] }
```

FAMILIES:

```js
wonen: { wat: 'een woningprobleem is af als het gemeld, bij de juiste vakman of verhuurder, gepland, opgelost, betaald en bewezen is, los en samen',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'wonen', naam: 'melding-naar-vakman', laag: 'kern', ontbreekt: 'keten', k: 'W4', kaart: KAART_LIVA,
  wat: 'een melding gaat als projectie naar een vakzaak (bronRef woning.melding) en de offerte verwijst terug',
  zolang: { geenBestandIn: 'server/kern/vakwerk/', noemt: 'woning.melding' } },
{ familie: 'wonen', naam: 'werkbon-naar-melding', laag: 'kern', ontbreekt: 'keten', k: 'W3', kaart: KAART_LIVA,
  wat: 'de werkbon van de vakman zet de melding op opgelost met de verwijzing' },
{ familie: 'wonen', naam: 'cyclus-naar-agenda', laag: 'kern', ontbreekt: 'keten', k: 'W6', kaart: KAART_LIVA,
  wat: 'een onderhoudscyclus wordt een herhalende afspraak met bron woning.installatie' },
{ familie: 'wonen', naam: 'werkbon-betalen', laag: 'kern', ontbreekt: 'keten', k: 'W4', kaart: KAART_LIVA,
  wat: 'de werkbon wordt betaald via betaalWaarheid met bronRef = opdracht (Geld)' },
{ familie: 'wonen', naam: 'garantie-naar-kluis', laag: 'kern', ontbreekt: 'keten', k: 'W5', kaart: KAART_LIVA,
  wat: 'het garantiebewijs hangt als bestand-id aan de installatie' }
```

**Volledige werkzaamheid.** De bewoner meldt hier en bewaart zijn dossier. Plannen, betalen en bewijzen doet hij nog buiten RTG. Daarvoor blijft nodig: de telefoon of WhatsApp met de vakman, de agenda van het toestel en de bankapp. De installateur werkt in zijn eigen pakket (IAMD, Simple-Simon) tot W4 bestaat.

---

## Werkwijze voor de overige apps

Elke app volgt de vorm van Wonen:
- a. inventaris (gebouwd en bewezen);
- b. markt (ook het duurste pakket);
- c. domein;
- d. catalogus;
- e. RTG-exclusief;
- f. bouwstenen;
- g. prioritering, met de aanbeveling voor nu gesplitst in **HERSTEL** en **VERDIEPING**;
- h. eindcontract;
- i. LOS, SAMEN en volledige werkzaamheid.

**Volledig formaat (herstel na het oordeel van Centraal, 19 oktober).** Veilig, Gezin, Assets en het Vooruitzicht hebben hun catalogus in het volledige formaat van Wonen 1d: acht velden per functie, en elke uitkomst B als proces met stappen en rollen. De andere apps houden de compacte tabel; hun B-functies zijn klein of vragen eerst een besluit.

**HERSTEL en VERDIEPING.**
- **HERSTEL** is een belofte die vandaag niet klopt: een tekst, een stille fout, een route die wel bestaat maar die het scherm niet aanroept, of een lezer zonder afzender. Herstel maakt het huis eerlijker en voegt geen functie toe.
- **VERDIEPING** is een nieuwe functie. Die wacht op het akkoord van de eigenaar per familie.

**LOS (sectie i).** Per app drie groepen: eigen functies, noodzakelijke platformdiensten en optionele koppelingen. Bij elke dienst die kan uitvallen staat de schermtekst. "(bestaat)" betekent dat het scherm die tekst vandaag al toont; anders is de tekst het doel.

**SAMEN (sectie i).** In de velden van `scripts/lib/appcontract.js` zoals ze op de tak `appwerkt/versheid` staan: `uitgeeft`, `ontvangt` en `ketens` per functie, een FAMILIES-entry, en ONTBREKEND-regels met `laag` (scherm of kern), `ontbreekt` (keten of proef) en een K-nummer uit deze kaart. Vandaag is geen enkele app van LivingOS-A verbonden: het veld is leeg. Daaronder staat het doel als verklaring, nog geen uitslag. In de regels staat `kaart: KAART_LIVA`, en dat staat voor `'docs/domeinkaarten/livingos-a.md'`. Ik heb `appcontract.js` niet aangeraakt; die blokken zijn klaar om over te nemen door wie de tak `appwerkt/versheid` bezit.

**Volledige werkzaamheid (sectie i).** Per app één regel: wie doet hier zijn hele werk, en welke externe software blijft nodig?

**Wetten en marktregels.** Een regel die ik alleen uit een zoekfragment ken, krijgt het label "te controleren" en stuurt geen weigerregel en geen uitkomst `bepaald`. Zulke regels staan onderaan in één lijst, met waar ze in deze kaart gebruikt worden en wat ze daar wel en niet mogen doen.

Per app staat er een gebruikersketen met storingen. Elk acceptatiecriterium wordt een stap in de voltooiproef van die app. De bronnen zijn geraadpleegd op 19 oktober 2026; "na te gaan" betekent dat de bron secundair is.

**Eindcontract (h):** dezelfde acht dimensies als bij Wonen 1i. Het vervangt nooit de acht bewijzen van APPWERKT.json (bereikbaar, bedienbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent, bevoegd, herstelbaar). Per app staan alleen de dimensies die iets eigens vragen.

---

## 2. RTG Veilig (`link:veilig`, eigenaar `veilig.noodcontacten`)

**Doel.** Wie het lid zelf koos, krijgt bericht als het misgaat, met alleen wat het lid per persoon toestond. Een lege kring wordt eerlijk geweigerd.

### a. Inventaris
- **Scherm:** veilig.html met vijf standen: vandaag, wacht, codewoord, vitaal en rust. Thuiswacht, thuisrust, vitaal en codewoord zijn omleidingen.
- **Kern:** kern/veiligheid/:
  - kring: hooguit 8 contacten en 4 e-mailadressen; een contact moet een actieve Salon-verbinding zijn en wordt bij elk alarm opnieuw getoetst;
  - escalatie: eerst een por aan het lid zelf met genadetijd (10 minuten), dan de kring;
  - het codewoord slaat de por over en blijft stil;
  - een dubbeltik binnen 5 seconden telt als één alarm;
  - alarmplekken worden na 90 dagen gewist;
  - de grenszin: "geen alarmcentrale, niemand wordt gebeld, niets zonder internet".
- **Bewezen:** voltooiproef `veilig.js`. Niet gelopen: push op het toestel, de thuiswacht, het codewoord en rust.
- **Gaten:**
  - `/api/veiligheid/alarm/afsluiten` wordt door geen scherm aangeroepen;
  - een handmatige alarmknop (`soort:'knop'` bestaat in de kern) staat niet op het scherm;
  - de alarmen die het lid als kringlid ontvangt (`voorMij`) worden niet getoond;
  - `safety.incident.started` wordt gelezen (workspace-orchestrator.js:44) maar nergens uitgegeven.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Life360 Platinum | SOS met meldkamer 24/7, crashdetectie, pechhulp, identiteitsbescherming | $199,99 per jaar in de VS ([Life360 SOS](https://intl.life360.com/blog/help-is-just-a-tap-away-introducing-sos-with-24-7-emergency-dispatch); prijs na te gaan) |
| Noonlight | stil alarm naar een meldkamer, watch en widget | prijs niet openbaar ([help](https://help.noonlight.com/en/articles/3270559-how-much-does-noonlight-cost)) |
| bSafe Premium | timer, "Follow Me" met automatisch alarm, video bij SOS | oude prijs, na te gaan |

### c. Domein
- **Alarmcentrales** zijn gecertificeerd volgens EN 50518 (Kiwa, CCV) ([Kiwa](https://www.kiwa.com/nl-be/nl/diensten/certificering/en-50518-monitoring-and-alarm-receiving-centre/)). RTG is dat niet en zegt het.
- **HartslagNu** wordt alleen door de 112-meldkamer gealarmeerd, bij een hartstilstand ([HartslagNu](https://hartslagnu.nl/wp-content/uploads/2023/07/Presentatie_Over-HartslagNu-2023.pdf)). Burgers zetten zichzelf daar niet in gang.
- **112.** De plicht geldt voor telecomaanbieders, niet voor spraak in apps ([ACM](https://www.acm.nl/nl/publicaties/acm-stelt-beleidsregel-vast-voor-mobiel-bellen-naar-alarmnummer-112)). Veilig mag dus nooit lijken op een route naar 112.
- **Locatie** is een persoonsgegeven (AVG art. 6). Toestemming per contact bestaat al.

### d. Catalogus, volledig formaat

Elke functie heeft dezelfde acht velden als Wonen 1d: gegevens en bron, regel of norm, rekenwijze, onzekerheid, wanneer iemand iets hoort, rollen en toestemming, uitzonderingen, en acceptatie. De acceptatie wordt een stap in `scripts/lib/voltooi/veilig.js`. Een veld dat voor een functie niets zegt, staat er met "—".

**V1 · Alarmknop op het scherm · L1 · half (`soort:'knop'` bestaat in de kern) · K · VERDIEPING**
- **Gegevens en bron:** het lid zelf (de tik), de kring uit `kern/veiligheid/kring.js` en de laatste plek uit `plek.js` als het lid plek deelt.
- **Regel:** de knop slaat de por over, net als het codewoord (`alarm.js`, kop: "het codewoord slaat trede 1 over"). Eén bevestiging ("Alarm sturen naar je kring?") voorkomt een zakalarm.
- **Rekenwijze:** —
- **Onzekerheid:** is de plek ouder dan het venster, dan krijgt de kring "laatst bekende plek, N minuten oud" (`ouderdomMin` bestaat al in de mail).
- **Wanneer iemand iets hoort:** de kring direct (push en inbox, mail waar opgegeven); het lid krijgt "Alarm verstuurd: N contacten" (bestaat).
- **Rollen en toestemming:** alleen het lid zelf slaat alarm. Per kringlid geldt de plekkeuze die het lid eerder zette.
- **Uitzonderingen:** een lege kring geeft 400 met "Je kring is leeg" (bestaat). Een dubbeltik binnen 5 seconden is één alarm (bestaat).
- **Acceptatie:** tik, bevestig, en kringlid B ontvangt een alarm met soort `knop`; een tweede kringlid zonder plekrecht ontvangt het zonder plek; een dubbeltik geeft één alarm.

**V2 · Alarm afsluiten op het scherm · L5 · half (route bestaat, geen scherm) · K · HERSTEL**
- **Gegevens en bron:** het open alarm van het lid (`alarmen` in de opslag van Veilig).
- **Regel:** een alarm dat blijft hangen is bijna even erg als geen alarm (`alarm.js`, kop van `alarmAfsluiten`). Alleen de melder sluit af.
- **Rekenwijze:** —
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** elke ontvanger krijgt "Alarm afgesloten" met de optionele toelichting (bestaat in de kern).
- **Rollen en toestemming:** alleen het lid dat alarm sloeg.
- **Uitzonderingen:** een proefalarm, of een alarm dat binnen een minuut wordt afgesloten, verliest zijn plek direct; een echt alarm houdt hem 90 dagen (`sosPositie`).
- **Acceptatie:** na afsluiten op het scherm krijgt B "afgesloten"; een tweede keer afsluiten verandert niets; een ander lid krijgt 404.
- **Waarom herstel:** de route bestaat en de grenszin belooft een einde, maar het lid kan het einde vandaag niet zelf geven. Dat is een belofte die niet klopt, geen nieuwe functie.

**V3 · "Voor mij": alarmen die ik als kringlid ontvang · L2/L6 · half (`alarmenVoorMij` bestaat in de kern) · M · VERDIEPING**
- **Gegevens en bron:** `alarmenVoorMij(handle)`: soort, tijd, codenaam, notitie en de plek alleen als het kringlid plekrecht heeft en het alarm open is.
- **Regel:** de plek verdwijnt bij afsluiten (bestaat in de kern).
- **Rekenwijze:** —
- **Onzekerheid:** de ouderdom van de plek staat erbij.
- **Wanneer iemand iets hoort:** het kringlid tikt "ik kom" of "ik bel"; de melder ziet wie wat koos.
- **Rollen en toestemming:** het kringlid ziet nooit meer dan het lid voor hem toestond.
- **Uitzonderingen:** is de verbinding tussen beiden verbroken, dan verdwijnt het alarm uit de lijst van B.
- **Acceptatie:** B ziet het alarm van A met plek; C zonder plekrecht ziet het zonder plek; na afsluiten heeft B geen plek meer.

**V4 · 112-wegwijzer · L1 · ontbreekt · K · VERDIEPING**
- **Gegevens en bron:** —
- **Regel:** RTG-bellen en Veilig zijn geen route naar 112 (`grens.js`, "Bij levensgevaar belt u het alarmnummer"). De knop opent `tel:112` in de kiezer van het toestel.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** iedereen.
- **Uitzonderingen:** een toestel zonder telefonie (desktop) toont het nummer als tekst.
- **Acceptatie:** de knop heeft `href="tel:112"`, staat bovenaan tijdens een open alarm, en het scherm zegt "RTG belt niet zelf".

**V5 · Incident naar de werkruimte · L6 · half (gelezen, nooit uitgegeven) · K · HERSTEL**
- **Gegevens en bron:** alleen soort en id van het alarm, geen inhoud.
- **Regel:** `public/shared/interface/workspace-orchestrator.js:44` en `second-screen.js:25` lezen `safety.incident.started`, en `modules/safety.js:14` verklaart het als uitgifte, maar geen regel publiceert het. Een lezer zonder afzender is een dode draad.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** de werkruimte van het lid zelf, niet die van een ander.
- **Rollen:** het lid.
- **Uitzonderingen:** een proefalarm geeft geen incident.
- **Acceptatie:** een alarm geeft het begin en afsluiten het einde, beide met alleen soort en id.

**V6 · Incidentdossier na afloop · L5 · ontbreekt · M · later**
- **Gegevens en bron:** het afgesloten alarm, de bezorgingen (`naar`, `mails`) en de reacties van V3.
- **Regel:** wissen na 90 dagen, gelijk met de plekken (`vergeetAlarmPlekken`).
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** alleen het lid.
- **Uitzonderingen:** —
- **Acceptatie:** de tijdlijn toont wie wanneer bericht kreeg; na 90 dagen is hij weg.

**V7 · Veiligheidskaart van het huis (Wonen W18) · L6 · ontbreekt · K · later**
- Verwijzing naar Wonen; Veilig bezit niets. Wonen uit: "Kaart nu niet te zien." Acceptatie als bij W18.

**V8 · Vertrouwde contacten uit Instellingen · L6 · ontbreekt · M · later**
- Naad met Toegang (docs/domeinkaarten/instellingen.md). De kring kiest uit de relatie-objecten; er komt geen tweede lijst. Acceptatie: een contact dat in Instellingen vervalt, valt bij het volgende alarm uit de kring en het lid ziet wie.

**V9 · Doorschakelen naar een gecertificeerde meldkamer (EN 50518) · L2 · ontbreekt · G · B, extern contract**
Zie het B-proces hieronder.

**V10 · Een mislukte e-mail is zichtbaar · L1 · fout (stil geslikt) · K · HERSTEL**
- **Gegevens en bron:** het resultaat van `mail.send` per adres.
- **Regel:** `alarm.js` vangt een mislukte mail op met `catch (e) {}`, terecht om de rest van het alarm niet tegen te houden. Maar de bevestiging aan het lid telt de adressen als gewaarschuwd, ook als de mail niet weg is.
- **Rekenwijze:** gewaarschuwd = push verstuurd + mails die `send` zonder fout verliet.
- **Onzekerheid:** een verstuurde mail is nog geen gelezen mail; het scherm zegt "verstuurd", nooit "ontvangen".
- **Wanneer iemand iets hoort:** het lid: "E-mail niet verstuurd naar 1 adres; je kring kreeg wel een melding in de app."
- **Rollen:** het lid.
- **Uitzonderingen:** een stil alarm (codewoord) toont niets op het toestel; de mislukking staat dan alleen in het dossier (V6).
- **Acceptatie:** met de mail uit telt de bevestiging 0 mails en noemt het scherm het mislukte adres.

**B-proces V9: een alarm dat een meldkamer bereikt.** Alleen na een contract met een EN 50518-gecertificeerde meldkamer en een besluit van de eigenaar over "RTG is geen alarmcentrale".
1. **Lid:** kiest per wacht "ook de meldkamer" (uitdrukkelijk, nooit standaard) en geeft toestemming voor plek en noodkaart (AVG art. 9 bij gezondheid).
2. **Veilig (RTG):** stuurt bij een gemiste check-in eerst de por (trede 1), daarna tegelijk de kring en de meldkamer, met alleen soort, plek, codenaam en terugbelnummer.
3. **Meldkamer (externe partij):** belt het lid terug volgens haar protocol en beslist zelf over 112. RTG beslist dat nooit.
4. **Kring:** ziet "meldkamer ingeschakeld" en de status die de meldkamer terugmeldt.
5. **Lid of meldkamer:** sluit af; iedereen hoort het einde (V2).
6. **Kantoor (RTG):** ziet het aantal doorschakelingen en de afloop, nooit de inhoud; het contract en de SLA zijn van Geld en de eigenaar.

### e. RTG-exclusief
- De kring bestaat uit echte Salon-verbindingen en wordt bij elk alarm opnieuw getoetst.
- Thuisrust houdt meldingen tegen, maar een alarm gaat door.
- Een reis-moment, de thuiswacht en de veiligheidskaart van Wonen raken één kring.

### f. Bouwstenen
- kern/veiligheid (alarm, kring, wacht);
- meldAan en push;
- mail.send;
- shared/interface/modules/safety.js;
- Wonen W18;
- Instellingen (relaties, Toegang).

### g. Prioritering
- **HERSTEL:** V2 (alarm afsluiten op het scherm), V5 (het incident wordt gelezen maar nooit uitgegeven), V10 (een mislukte e-mail telt als gewaarschuwd).
- **VERDIEPING (wacht op het akkoord per familie):** V1, V3, V4.
- **A later:** V6, V7, V8.
- **B:** V9. Die vraagt een contract met een meldkamer en een besluit van de eigenaar over de verhouding tot "RTG is geen alarmcentrale".

### Keten "ik voel me niet veilig onderweg"
1. Het lid start de wacht.
2. Het mist de check-in.
3. Het krijgt een por en genadetijd.
4. De kring krijgt een alarm met plek.
5. B drukt "ik kom" (V3).
6. A sluit af (V2).
7. Iedereen hoort dat het voorbij is.

**Storingen:**
- Mail uit: push gaat wel, en het scherm zegt "e-mail niet verstuurd".
- Een kringlid is geen verbinding meer: hij wordt overgeslagen en het lid ziet wie.
- Geen internet: de grenszin met de 112-knop (V4).

### h. Eindcontract, eigen eisen
- **Los functioneren:** zonder Salon-verbindingen weigert de kring met de reden.
- **Samenwerking:** een kringlid ziet nooit meer dan per contact is toegestaan (plek aan of uit). Dat wordt getoetst met een tweede kringlid zonder plekrecht.
- **Bewezen betrouwbaarheid:** dubbeltik, crash tijdens een lopende wacht (de wacht loopt door na een herstart), en het wissen na 90 dagen.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** kring, wacht, codewoord, rust, alarm en afsluiten (`/api/veiligheid/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - Salon-verbindingen: een kringlid moet een actieve verbinding zijn. Zonder: "Je kring is leeg; er is niemand om te waarschuwen." (bestaat);
  - meldingen (push en inbox). Uit: "Je kring ziet het alarm pas als ze de app openen.";
  - internet en de server. Zonder: de grenszin "niets zonder internet" met de 112-knop (bestaat als grenszin, de knop is V4).
- **Optionele koppelingen:**
  - e-mail. Uit: "E-mail niet verstuurd; je kring kreeg wel een melding in de app." (ontbreekt: V10);
  - plek. Uit of geweigerd: "Zonder plek verstuurd.";
  - Wonen (V7), Instellingen (V8), Vonk (Vo1), Vandaag (Va1), Reizen en Veilig (moment, TravelOS).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:veilig': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:veilig': { uitgeeft: ['veilig.alarm'], ontvangt: ['vonk.date', 'woning.veiligheidskaart'], ketens: [] }
```

FAMILIES:

```js
veiligheid: { wat: 'als het misgaat hoort de eigen kring het, vanuit elke app waar het mis kan gaan, met alleen wat het lid per persoon toestond',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'veiligheid', naam: 'alarm-naar-werkruimte', laag: 'scherm', ontbreekt: 'keten', k: 'V5', kaart: KAART_LIVA,
  wat: 'safety.incident.started wordt gelezen (workspace-orchestrator, second-screen) en verklaard (modules/safety.js), maar nergens gepubliceerd' },
{ familie: 'veiligheid', naam: 'date-naar-wacht', laag: 'kern', ontbreekt: 'keten', k: 'Vo1', kaart: KAART_LIVA,
  wat: 'een bevestigde date start op verzoek een wacht met de eindtijd van de date' },
{ familie: 'veiligheid', naam: 'kringlid-naar-noodkaart', laag: 'kern', ontbreekt: 'keten', k: 'Va1', kaart: KAART_LIVA,
  wat: 'de noodkaart van Vandaag kiest een kringlid als verwijzing in plaats van vrije tekst' },
{ familie: 'veiligheid', naam: 'veiligheidskaart-naar-veilig', laag: 'scherm', ontbreekt: 'keten', k: 'V7', kaart: KAART_LIVA,
  wat: 'de veiligheidskaart van Wonen (W18) is vanuit Veilig te openen' }
```

**Volledige werkzaamheid.** Het lid en zijn kring doen hier het hele werk van "laat iemand weten dat het misgaat". Buiten RTG blijft nodig: 112, een gecertificeerde meldkamer (RTG is er geen) en de telefoon om het lid te bellen.

---

## 3. Berichten (`link:berichten`, eigenaar `comm.berichten`)

**Doel.** Berichten sturen en ontvangen met de mensen dichtbij, met een samenvatting die het gesprek kort maakt zonder iets te verzinnen.

### a. Inventaris
- **Scherm:** comm.html, met inbox, gesprek, reacties, wijzigen, wissen, vlaggen, typ-indicator, por, zoeken, groepen, @Rahul en bel- en videoknoppen.
- **Routes:** `/api/comm/*` (comm.js, comm-stand.js). Starten met `/begin` vraagt een vriendschap met elke deelnemer.
- **AI** (kern/berichten/ai.js):
  - samenvatten is lokaal en extractief, zonder model;
  - afspraken herkent de app met lokale patronen;
  - een concept loopt via de lokaal-eerst-keten, en zonder model geeft dat 503;
  - de regel: AI stelt op, de mens verstuurt.
- **Bewezen:** voltooiproef `berichten.js` (sturen, herhaalsleutel, herstel; een fout is gerepareerd met `test/comm-herhaalsleutel.test.js`). Niet gelopen: bellen, de por, @Rahul, zoeken en het realtime seintje.
- **Gat:** afspraken staan alleen als tekst op het scherm (comm.html:683-686), zonder agendaknop, terwijl ai.js r.98-100 die belooft.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| WhatsApp | AI-samenvatting via "Private Processing", standaard uit | gratis ([Meta engineering](https://engineering.fb.com/2025/04/29/security/building-private-processing-for-ai-tools-on-whatsapp/)) |
| Signal | end-to-end-versleuteling, zelfwissende berichten | gratis |
| Microsoft Teams Premium | intelligente samenvatting met notities, taken en hoofdstukken | $10 per gebruiker per maand als add-on (na te gaan) |

### c. Domein
- **DSA art. 16:** een meldmechanisme met motivering, de beslissing terug naar de melder en bezwaarmogelijkheid ([tekst](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-16/)).
- **Telecommunicatiewet art. 11.7a:** iets op het toestel opslaan of uitlezen mag alleen met toestemming.
- **De praktijk:** de beste diensten hebben end-to-end-versleuteling, en AI-samenvatting staat er standaard uit.

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| B1 | Herkende afspraak naar de Agenda | L6 | half | Een herkende afspraak heeft een knop "in agenda". Er ontstaat een afspraak met een verwijzing naar het gesprek. Is de Agenda uit, dan blijft de tekst en staat er "niet in agenda gezet". | K | **A nu** |
| B2 | Een bericht melden in DSA-vorm | L2/L3 | half (melden bestaat bij vonk, niet bij comm) | Een melding vraagt een reden. Het kantoor beslist, en de melder hoort de beslissing en hoe hij bezwaar maakt. | M | **A nu** |
| B3 | Herkomst van de samenvatting | L4 | half | Elke samenvattingszin verwijst naar het bericht waar hij uit komt, met het label "lokaal, extractief". Een zin zonder bron bestaat niet. | K | **A nu** |
| B4 | Bijlage uit de kluis als verwijzing | L6 | ontbreekt | Een document uit `docs.bestanden` gaat als verwijzing mee. De ander opent het alleen als het gedeeld is. | M | A later |
| B5 | Zelfwissende berichten per gesprek | L1 | ontbreekt | Een termijn per gesprek. Na afloop is het bericht uit de opslag; dat wordt getoetst buiten de server om. | M | A later |
| B6 | End-to-end-versleuteling | L1 | ontbreekt | — | G | B, vraagt besluit: botst met samenvatten, melden en moderatie op de server |

### e. RTG-exclusief
Een afspraak uit een gesprek wordt een agendapunt, een gedeeld document blijft in de kluis, en bellen zit in hetzelfde gesprek. Er ontstaan nergens kopieën.

### f. Bouwstenen
- kern/comm en kern/berichten;
- agenda (`/api/agenda/bewaar`);
- bestanden-delen;
- de bestaande meldroute van vonk (connection-communication) als vorm voor B2.

### g. Prioritering
- **HERSTEL:** B1 (ai.js belooft een agendaknop bij een herkende afspraak, het scherm heeft hem niet).
- **VERDIEPING (wacht op het akkoord per familie):** B2, B3.
- **A later:** B4, B5.
- **B:** B6.

### Keten "we spreken af"
1. Het bericht noemt "donderdag 19:00 bij Sal de Mar".
2. De app herkent een afspraak.
3. De afspraak komt in de Agenda.
4. Er komt een herinnering.

**Storingen:**
- Agenda uit: de afspraak blijft als tekst, met een melding.
- Model uit: samenvatten werkt lokaal; een concept geeft 503 met "schrijf zelf".
- De ander heeft geblokkeerd: 403 met de reden.

### h. Eindcontract, eigen eisen
- **Domeinintelligentie:** geen samenvattingszin zonder bronbericht (B3).
- **Samenwerking:** een niet-deelnemer leest, wijzigt of meldt niets (bestaat; houden).

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** inbox, gesprek, reacties, wijzigen, wissen, vlaggen, zoeken, groepen en lokaal samenvatten (`/api/comm/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - een vriendschap met elke deelnemer (bestaat: `/begin` weigert anders met de reden);
  - de live-stroom. Uit: "Nieuwe berichten verschijnen na verversen."
- **Optionele koppelingen:**
  - een model voor een concept. Uit: 503 met "schrijf zelf" (bestaat);
  - Agenda (B1). Uit: "Niet in agenda gezet.";
  - de kluis (B4), Bellen (Be2).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:berichten': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:berichten': { uitgeeft: ['afspraak'], ontvangt: ['bestand', 'oproep.gemist'], ketens: [] }
```

FAMILIES:

```js
gesprek: { wat: 'mensen die elkaar kennen schrijven, bellen en spreken af zonder kopieen: een afspraak uit een gesprek komt in de agenda, een gemiste oproep in het gesprek',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'gesprek', naam: 'afspraak-naar-agenda', laag: 'scherm', ontbreekt: 'keten', k: 'B1', kaart: KAART_LIVA,
  wat: 'een herkende afspraak wordt een agendapunt met een verwijzing naar het gesprek' },
{ familie: 'gesprek', naam: 'bestand-als-bijlage', laag: 'scherm', ontbreekt: 'keten', k: 'B4', kaart: KAART_LIVA,
  wat: 'een document uit de kluis gaat als verwijzing mee' },
{ familie: 'gesprek', naam: 'bellen-uit-gesprek', laag: 'scherm', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'de belknop in het gesprek start os:bellen; de voltooiproef van berichten loopt bellen niet' }
```

**Volledige werkzaamheid.** Leden voeren hier hun dagelijkse gesprekken. Buiten RTG blijft nodig: WhatsApp of Signal voor wie geen lid is, e-mail, en end-to-end-versleuteling (B6, vraagt besluit).

---

## 4. Bellen (`os:bellen`, onder `kern.app`)

**Doel.** Een verbonden lid bellen met spraak. Niemand anders hoort iets, en van het gesprek wordt niets bewaard.

### a. Inventaris
- **Signalering:** `/api/member/call`. Een doorgeefluik zonder opslag, met de signalen ring, accept, offer, answer, ice, hangup, decline en busy, via SSE.
- **Bewezen:** voltooiproef `bellen.js` (6/6, 3/3, 3/3), en het media-deel voor video in videobellen-echt.e2e (LivingOS-B).
- **Fout gevonden:**
  - app-main-10.js:46 stuurt `kind:'tekst'` voor de meeleesbaan;
  - de whitelist in routes/social/leden.js:158 kent `'tekst'` niet, dus de server antwoordt 400;
  - de client slikt die fout (`.catch(()=>{})`);
  - getypte meeleesregels komen bij een gewoon gesprek dus nooit aan.

  Dit is een reparatie, geen nieuwe functie. Ik bouw hem na een akkoord van Centraal.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| FaceTime en WhatsApp | gratis spraak en video, versleuteld | gratis |
| Zoom Workplace Business Plus | telefonie, hoge limieten | $22,49 per gebruiker per maand bij jaarbetaling (na te gaan) |
| Teams Phone | telefonie met belplan | $10-34 per gebruiker per maand (na te gaan) |

### c. Domein
- **112** hoeft niet via app-spraak ([ACM](https://www.acm.nl/nl/publicaties/acm-stelt-beleidsregel-vast-voor-mobiel-bellen-naar-alarmnummer-112)). Het scherm moet dat zeggen.
- **Opnemen:** een deelnemer mag opnemen, een buitenstaander niet afluisteren (Sr 139a/b; bron na te gaan). De AVG kan gelden.
- **Toegankelijkheid:** de European Accessibility Act geldt sinds 28 juni 2025. Real-time text in noodcommunicatie volgt uiterlijk op 28 juni 2027 ([EENA](https://eena.org/news/european-accessibility-act-begins-applying-across-the-eu/)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Be1 | Meeleesregel komt aan (reparatie) | L1 | fout | Signaal `tekst` geeft 200 en de ander ontvangt de regel. Een fout wordt getoond, niet geslikt. | K | **A nu** |
| Be2 | Gemiste oproep | L5/L6 | ontbreekt | Een oproep die niet beantwoord wordt, wordt een melding en een regel in het gesprek in Berichten, met wie en wanneer, zonder inhoud. | M | **A nu** |
| Be3 | 112-zin in de kiezer | L1 | ontbreekt | De kiezer zegt "RTG-bellen is geen 112" en heeft een knop `tel:112`. | K | **A nu** |
| Be4 | Gespreksgeschiedenis zonder inhoud | L1 | ontbreekt | Alleen wie, wanneer en hoe lang, alleen voor de twee deelnemers. Wissen kan per regel. | M | A later |
| Be5 | TURN voor strenge netwerken | L1 | ontbreekt | — | M | A later, extern (relay) |
| Be6 | Opnemen | — | — | — | — | niet doen: botst met "van het gesprek wordt niets bewaard" |

### e. RTG-exclusief
Bellen kan alleen tussen echte verbindingen, met de meeleesbaan en lokale ondertitels als toegankelijkheid, zonder dat er iets bewaard wordt.

### f. Bouwstenen
- `/api/member/call`;
- de live-stroom;
- meelezen.js en meeluister.js (lokaal model);
- kern/comm voor Be2.

### g. Prioritering
- **HERSTEL:** Be1 is af (e65703f35).
- **VERDIEPING (wacht op het akkoord per familie):** Be2, Be3.
- **A later:** Be4, Be5.

### Keten "bellen vanuit een gesprek"
1. Het lid belt vanuit Berichten.
2. Het gaat over bij B.
3. B mist de oproep.
4. B krijgt een melding en een regel in het gesprek (Be2).
5. B belt terug.

**Storingen:**
- B is niet live verbonden: A hoort "niet bereikbaar" na de wachttijd, en de oproep wordt gemist.
- Blokkade: 403 met de reden.

### h. Eindcontract, eigen eisen
- **Betrouwbaarheid:** er blijft niets van een gesprek in de opslag (bestaat, persistente stap 3).
- **Toegankelijkheid:** Be1 is getoetst (een meeleesregel komt aan).

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** spraakgesprek tussen verbindingen, meeleesbaan en lokale ondertitels (`/api/member/call`).
- **Noodzakelijke platformdiensten:**
  - account en een verbinding met de ander;
  - de live-stroom voor de signalering. B niet live: "Niet bereikbaar." (bestaat);
  - WebRTC in de browser. Een streng netwerk zonder TURN: "De verbinding komt via dit netwerk niet tot stand." (ontbreekt, Be5).
- **Optionele koppelingen:**
  - het lokale spraakmodel (meeluister). Uit: "Ondertitels staan uit; de meeleesbaan werkt wel.";
  - Berichten (Be2).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'os:bellen': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'os:bellen': { uitgeeft: ['oproep.gemist'], ontvangt: ['gesprek'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'gesprek', naam: 'gemiste-oproep-naar-gesprek', laag: 'kern', ontbreekt: 'keten', k: 'Be2', kaart: KAART_LIVA,
  wat: 'een onbeantwoorde oproep wordt een regel in het gesprek in Berichten, zonder inhoud' }
```

**Volledige werkzaamheid.** Tussen leden kan hier het hele gesprek. Buiten RTG blijft nodig: gewone telefonie, 112 en bellen met wie geen lid is.

---

## 5. Vandaag (`link:vandaag` → life.html, eigenaar `dag.overzicht`)

**Doel.** In één dagoverzicht zien hoe het gaat: stemming, gewoonten, medicatie, metingen, noodkaart en toestellen. Het is nooit een diagnose.

### a. Inventaris
- **Scherm:** life.html met de routes `/api/life`, `/api/dag`, `/gewoonten`, `/metingen`, `/gemoed`, `/noodkaart`, `/toestellen` en `/medicatie`.
- **Gemoed:** zes stemmingen. Als de grens aanslaat, komt er een escalatie zonder tip (gemoed.js:91).
- **Noodkaart:** niet op afstand op te vragen.
- **Bewezen:** voltooiproef `vandaag.js`. Niet gelopen: medicatie en toestellen.
- **Gaten:**
  - de grens van de proef noemt `/api/dag` een "modelvraag", maar kern/dagcoach.js is regelgestuurd. De tekst in de proef klopt dus niet;
  - de proef noemt een veiligheidskring die het scherm meeleest, maar life.html roept `/api/veiligheid` niet aan;
  - het noodcontact op de noodkaart is een vrij tekstveld.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Oura Membership | diepere inzichten, trends, AI | €69,99 per jaar ([Oura](https://support.ouraring.com/hc/lv/articles/4409086524819-Oura-Membership)) |
| Withings+ | gezondheidsscore, AI-assistent, ECG beoordeeld door een cardioloog | €99,50 per jaar ([Withings](https://support.withings.com/hc/en-us/articles/14166469200529)) |
| Bearable Premium | correlatierapporten over 365 dagen, eigen metingen | $34,99 per jaar ([Bearable](https://bearable.app/pricing)) |

### c. Domein
- **MDR regel 11 / MDCG 2019-11:** software die informatie geeft voor diagnose of therapie is minstens klasse IIa. Alleen opslaan of doorsturen is geen medisch hulpmiddel ([samenvatting](https://openregulatory.com/mdcg/mdcg-2019-11), na te gaan). Vandaag blijft daarom onder "opslaan en tonen", nooit "beoordelen".
- **Medicatie:** loopt via het LSP met opt-in in Mitz ([kamerstuk](https://zoek.officielebekendmakingen.nl/kst-27529-AG.pdf)). Dat is extern en voor zorgaanbieders.
- **AVG art. 9:** gezondheidsgegevens vragen uitdrukkelijke toestemming ([EDPB](https://edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202003_healthdatascientificresearchcovid19_nl.pdf)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Va1 | Noodcontact uit de Veilig-kring | L6 | ontbreekt | De noodkaart kiest een kringlid als verwijzing. Verdwijnt de verbinding, dan staat er "noodcontact niet meer verbonden". | K | **A nu** |
| Va2 | Grenstekst van de proef rechtzetten | — | fout in de documentatie | De grens van de proef zegt dat `/api/dag` regelgestuurd is. | K | **A nu** |
| Va3 | Trends over eigen metingen, zonder oordeel | L4 | ontbreekt | Gemiddelde en spreiding per week. Zonder 7 metingen geen trend. De tekst zegt "geen diagnose" (MDR-grens). | M | A later |
| Va4 | Export voor de eigen zorgverlener | L6 | ontbreekt | Het lid kiest een periode en maakt een pdf. Er gaat niets automatisch naar buiten. | M | A later |
| Va5 | Medicatieoverzicht uit het LSP | — | — | — | — | niet doen: extern, voor zorgaanbieders (Mitz) |
| Va6 | Correlaties (slaap tegenover stemming) | L4 | ontbreekt | — | G | B: dicht tegen MDR-klasse IIa; vraagt besluit |

### e. RTG-exclusief
De dag ziet de agenda, de wacht van Veilig en het eigen gemoed bij elkaar. Gemoed verlaat het account nooit, en een werkgever ziet niets.

### f. Bouwstenen
- kern/life, dagcoach, gemoed (zorgniveau), metingen en noodkaart;
- kern/veiligheid voor Va1.

### g. Prioritering
- **HERSTEL:** Va2 (de grenstekst van de proef noemt `/api/dag` een modelvraag; dagcoach is regelgestuurd).
- **VERDIEPING (wacht op het akkoord per familie):** Va1.
- **A later:** Va3, Va4.
- **B:** Va6.

### Keten "een slechte dag"
1. Het lid kiest een sombere stemming.
2. Een herhaling raakt de grens.
3. De app verwijst door zonder tip.
4. Het noodcontact is een echt kringlid (Va1).

**Storing:** Veilig uit: de noodkaart toont "kring nu niet te zien", en de noodkaart zelf blijft werken.

### h. Eindcontract, eigen eisen
- **Domeinintelligentie:** er is geen tekst die een diagnose stelt. Een toets zoekt naar woorden als "u heeft" of "diagnose" in de antwoorden van de app.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** dag, gewoonten, metingen, gemoed, noodkaart, medicatie en toestellen (`/api/life`, `/api/dag`).
- **Noodzakelijke platformdiensten:**
  - account en sessie.
- **Optionele koppelingen:**
  - Veilig (Va1). Uit: "Je kring is nu niet te zien; je noodkaart werkt gewoon.";
  - Agenda (de dag leest haar).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:vandaag': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:vandaag': { uitgeeft: [], ontvangt: ['veilig.kringlid'], ketens: [] }
```

ONTBREKEND:

```js
(zie 'kringlid-naar-noodkaart' bij Veilig)
```

**Volledige werkzaamheid.** Het lid houdt hier zijn eigen dag bij. Buiten RTG blijft nodig: de zorgverlener, het LSP via Mitz voor medicatie, en de app van een wearable (Oura, Withings) voor de meting zelf.

---

## 6. Gezin (`tab:gezin`, onder `kern.app`)

**Doel.** Een oppas of familielid koppelt zich met de eenmalige uitnodiging van een RTFoundation-gezin. Hij ziet wat het gezin hem toevertrouwt, stuurt berichten en ontkoppelt zelf.

### a. Inventaris
- **Routes:** `/api/rtf/*` (uitnodiging, overzicht, kanaal, bericht, ontkoppel).
- **Uitnodiging:** 48 uur geldig, alleen de hash wordt bewaard.
- **Kanaaltoken:** 12 uur geldig.
- **Kind:** alles wat een kind raakt vraagt `volwassen()`.
- **Agenda:** een gezinsagenda met de sleutel `gezin:<code>`.
- **Bewezen:** voltooiproef `gezin.js` (6/6, 3/3, 4/4).
- **Fout gevonden:** chat en antwoord gebruiken alleen het eerste gezin (`g[0]`, app-main-43.js:92 en app-main-44.js:62). Wie twee gezinnen volgt, schrijft altijd naar het eerste.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| FamilyWall Premium | gezinsagenda, documenten, plek-alerts | $44,99 per jaar ([App Store](https://apps.apple.com/app/id496889629)) |
| Cozi Gold | gedeelde agenda, herinneringen, meldingen bij wijzigingen | $39 per jaar (na te gaan) |
| Life360 Platinum | plek en SOS | zie Veilig |

### c. Domein
- **Gastouder (Wet kinderopvang):** een VOG en het Personenregister Kinderopvang met continue screening ([kamerstuk](https://zoek.officielebekendmakingen.nl/kst-33538-3.pdf)).
- **Particuliere oppas:** er is geen VOG-plicht gevonden. De ouder kan erom vragen (na te gaan).
- **AVG art. 8:** onder 16 jaar is toestemming van de ouder nodig ([tekst](https://gdpr-text.com/nl/read/article-8/)).

### d. Catalogus, volledig formaat

Dezelfde acht velden als Wonen 1d. De acceptatie wordt een stap in `scripts/lib/voltooi/gezin.js`, of een schermtoets waar het scherm het enige bewijs is. De gezinskant zelf (de RTFoundation-app) is van FoundationOS; Gezin is de kant van de gekoppelde oppas of het familielid in de ledenapp.

**G1 · Het juiste gezin kiezen · L1 · gerepareerd (90c8166f5) · K · HERSTEL, af**
- **Gegevens en bron:** `/api/rtf/overzicht` (`gastOverzicht`) geeft alle gekoppelde gezinnen; het gekozen gezin is een keuze op het scherm.
- **Regel:** chat en antwoord gaan naar het gekozen gezin, nooit vanzelf naar het eerste.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** de leden van het gekozen gezin, en de andere gekoppelde gasten van dat gezin (`bezorgAanGasten`).
- **Rollen en toestemming:** de server toetst per bericht de koppeling (`berichtVanGast`: 403 zonder koppeling).
- **Uitzonderingen:** met één gezin verschijnt er geen keuze.
- **Acceptatie:** `test/gezin-keuze.e2e.js`: een oppas met twee gezinnen kiest het tweede, en het bericht staat bij het tweede en niet bij het eerste.

**G2 · Oppasbeurt in de gezinsagenda · L6 · half (gezinsagenda bestaat) · M · later**
- **Gegevens en bron:** een agendapunt van het gezin (sleutel `gezin:<code>`, gezinskant) met soort `oppas`, begin, einde en het gastprofiel.
- **Regel:** de beurt is van het gezin. De oppas krijgt een verwijzing in zijn eigen agenda (`agenda.afspraken`), geen kopie.
- **Rekenwijze:** —
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** de oppas bij het plannen en bij een wijziging; een herinnering op de dag zelf.
- **Rollen en toestemming:** een ouder of beheerder plant; de oppas bevestigt of weigert. Een weigering is geen fout en staat bij de ouder.
- **Uitzonderingen:** ontkoppelt de oppas, dan vervalt de verwijzing in zijn agenda en ziet de ouder "oppas niet meer gekoppeld".
- **Acceptatie:** de ouder plant, de oppas ziet de beurt in zijn agenda, de ouder ziet de bevestiging; na ontkoppelen is de verwijzing weg.

**G3 · Aankomst en vertrek van de oppas · L5 · ontbreekt · M · later**
- **Gegevens en bron:** twee tikken van de oppas ("ik ben er", "ik ga") aan een beurt uit G2.
- **Regel:** zonder beurt geen aankomst. De plek gaat alleen mee als de ouder daar per beurt om vroeg.
- **Rekenwijze:** de duur van de beurt = vertrek − aankomst; hij staat bij de beurt en is de basis voor G5.
- **Onzekerheid:** een vergeten "ik ga" toont "vertrek niet gemeld", nooit een geschat tijdstip.
- **Wanneer iemand iets hoort:** de ouders bij beide tikken.
- **Rollen en toestemming:** alleen de gekoppelde oppas van die beurt.
- **Uitzonderingen:** een dubbeltik is één aankomst.
- **Acceptatie:** aankomst en vertrek staan bij de beurt; een ander gastprofiel van hetzelfde gezin kan deze beurt niet aftikken (403).

**G4 · VOG op verzoek van de ouder · L2 · ontbreekt · M · B, vraagt besluit**
Zie het B-proces hieronder.

**G5 · De oppas betalen · L6 · ontbreekt · M · B, eigenaar Geld**
Zie het B-proces hieronder.

**G6 · Ontkoppelen, door de oppas of door het gezin · L5 · bestaat · — · houden**
- **Gegevens en bron:** `unlinkGast` wist de koppeling en sluit het kanaaltoken (`gezinstoken.sluit`).
- **Regel:** na ontkoppelen leest de oppas niets meer van het gezin.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** het gezin ziet dat het profiel niet meer gekoppeld is.
- **Rollen:** de oppas zelf, of het gezin in de RTFoundation-app.
- **Uitzonderingen:** een profiel dat al aan een ander lid hangt, wordt niet overgenomen (409, bestaat).
- **Acceptatie (bestaat):** na ontkoppelen geeft `/api/rtf/kanaal` 403 en `/api/rtf/bericht` 403.

**G7 · De plek van de gezinsleden, alleen tijdens een beurt · L3 · vraagt besluit · M · HERSTEL-vraag**
- **Gegevens en bron:** `gastOverzicht` geeft elke gekoppelde gast de precieze plek van elk gezinslid dat zijn plek met het gezin deelt (`locatiePubliek`, ontsleuteld), zolang de koppeling bestaat.
- **Regel (voorstel):** een gast ziet plekken alleen tijdens een lopende beurt (G2/G3). Buiten een beurt ziet hij "plek alleen tijdens een oppasbeurt".
- **Rekenwijze / Onzekerheid:** de ouderdom van de plek staat erbij.
- **Wanneer iemand iets hoort:** —
- **Rollen en toestemming:** het gezin kiest; de gast kan het niet zelf ruimer maken.
- **Uitzonderingen:** een familielid (geen oppas) kan van het gezin blijvend plekrecht krijgen, uitdrukkelijk.
- **Acceptatie:** zonder lopende beurt bevat het overzicht van de oppas geen coördinaten.
- **Waarom een vraag:** vandaag is het gedrag een keuze die niemand uitdrukkelijk maakte. Het gaat om de live plek van kinderen. Dat is aan het gezin en FoundationOS, niet aan mij. Ik heb niets veranderd.

**B-proces G4: een VOG op verzoek van de ouder.**
1. **Ouder (gezinskant):** zet bij het gastprofiel "VOG gevraagd". Dat is een wens, geen poort; de koppeling blijft bestaan.
2. **Oppas:** vraagt zelf de VOG aan bij Justis (extern, buiten RTG) en levert het stuk in via de kluis (`docs.bestanden`) als vakbewijs (`kern/vakbewijs.js`).
3. **Mens van RTG:** tekent af dat het stuk gezien is, met datum; nooit de ouder zelf (regel in AGENTS.md: "een ingediend stuk is geen bewijs").
4. **Gezin:** ziet "VOG gezien op <datum>", niet het stuk zelf. Het documentnummer staat in de identiteitskluis.
5. **Verloop:** het stuk heeft een datum; de ouder bepaalt hoe oud het mag zijn, en bij elke vraag wordt het opnieuw gerekend (`persoonseis`).
- **Besluit nodig:** een persoonseis "oppas" in `kern/persoonseis.js`, met reikwijdte `handeling`, zodat alleen de beurt en niet de koppeling wacht. RTG valideert inhoudelijk niets.

**B-proces G5: de oppas betalen.**
1. **Oppas:** de beurt is af met aankomst en vertrek (G3).
2. **Gezin:** ziet de duur en het afgesproken uurtarief (door het gezin ingevuld) en drukt "betalen".
3. **Geld (eigenaar):** voert de betaling uit via betaalWaarheid met `bronRef` = de beurt. Betaald heet pas betaald na bevestiging.
4. **Oppas:** ziet "betaald" pas na die bevestiging.
5. **Grens:** RTG zegt niets over werkgeverschap of de Regeling dienstverlening aan huis behalve als uitleg met bron (zie Maison M1). Nooit een automatische betaling.

### e. RTG-exclusief
- De oppas is een gekeurd RTG-lid, met een eenmalige uitnodiging en een verloop van 12 uur.
- De gezinsinfo blijft van het gezin; de oppas ziet alleen wat het gezin hem toevertrouwt.

### f. Bouwstenen
foundation/gasten (koppeling, gezinsuitnodiging, gezinsagenda), pushHook en persoonseis.

### g. Prioritering
- **HERSTEL:** G1 is af (90c8166f5); G7 (de plek van gezinsleden voor elke gast, altijd) is een vraag aan het gezin en FoundationOS.
- **VERDIEPING (wacht op het akkoord per familie):** geen voor nu; G2 en G3 later.
- **A later:** G2, G3.
- **B:** G4, G5.

### Keten "de oppasavond"
1. De ouder plant de avond (G2).
2. De oppas tikt "ik ben er" (G3).
3. Hij leest de noodcontacten.
4. Hij stuurt een bericht.
5. Hij tikt "ik ga".

**Storingen:**
- Kanaaltoken verlopen: het scherm vraagt opnieuw te openen.
- De ouder heeft ontkoppeld: 403 met de reden.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** gezinnen zien, oppasinfo lezen, agenda lezen, berichten sturen, ontkoppelen (`/api/rtf/overzicht`, `/kanaal`, `/bericht`, `/ontkoppel`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - een geldige uitnodiging (48 uur) om te koppelen. Verlopen: de reden (bestaat);
  - het kanaaltoken (12 uur). Verlopen: "Open het gezin opnieuw."
- **Optionele koppelingen:**
  - meldingen van het gezin (push via `pushHook`). Uit: berichten staan in de inbox, zonder telefoonmelding;
  - Agenda (G2), Geld (G5).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'tab:gezin': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'tab:gezin': { uitgeeft: [], ontvangt: ['gezin.oppasbeurt'], ketens: [] }
```

FAMILIES:

```js
gezin: { wat: 'een oppas of familielid doet zijn deel voor het gezin met alleen wat het gezin toevertrouwt: plannen, aankomen, berichten, vertrekken',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'gezin', naam: 'oppasbeurt-naar-agenda', laag: 'kern', ontbreekt: 'keten', k: 'G2', kaart: KAART_LIVA,
  wat: 'een oppasbeurt van het gezin staat als verwijzing in de agenda van de oppas' },
{ familie: 'gezin', naam: 'gezinsagenda-naar-gast', laag: 'kern', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'gastOverzicht geeft de gezinsagenda (agendaPubliek); geen proef loopt dat af',
  bron: [{ bestand: 'server/foundation/gasten/koppeling.js', noemt: 'agendaPubliek' }] }
```

**Volledige werkzaamheid.** De oppas of het familielid doet hier zijn deel: lezen en berichten. Buiten RTG blijft nodig: de telefoon voor aankomst en vertrek (G3), Justis voor een VOG (G4) en een betaalapp om de oppas te betalen (G5).

---

## 7. Bestellen (`tab:bestellen`, onder `kern.app`)

**Doel.** Boodschappen bij een groothandel of supermarkt bestellen, en eten bij een zaak. De bestelling volgen tot de deur, en annuleren wat nog kan.

### a. Inventaris
- **Groothandel:** `/api/groothandel/markt`, `/bestel` (idem), `/mijn` en `/annuleer`. Statussen: aangevraagd → bevestigd → onderweg → geleverd, plus geweigerd en geannuleerd. Annuleren staat op het scherm sinds d53698410.
- **Eten:** `/api/bezorg/*`, `/api/order/pay` (zaakbetaling) en live volgen via SSE.
- **Bewezen:** voltooiproef `bestellen.js` (7/7, 3/3, 4/4) en de schermtoets bestellen-scherm.e2e.
- **Gaten:**
  - de groothandel laat alleen "Bezorgen" kiezen; de server neemt `true` aan (winkel.js:39), dus afhalen kan niet;
  - de stand heeft geen eigen regel in SCHERMEIGENAAR, terwijl apps/bestellen.html (`horeca.bestellen`) dezelfde eetbestelling aanbiedt.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Uber One | gratis bezorging vanaf €18 (restaurant) en €40 (supermarkt) | €89,99 per jaar ([Uber](https://www.uber.com/nl/nl/uber-one/)) |
| Thuisbezorgd Plus | gratis bezorging boven een minimum | prijs tegenstrijdig, na te gaan |
| Picnic | gratis bezorging, minimum €35 | geen abonnement (na te gaan) |
| Makro | groothandelsprijzen | alleen voor bedrijven met KvK |

### c. Domein
- **Alcoholwet, verkoop op afstand:** de leeftijd wordt gecontroleerd vóór de aankoop (actieve invoer) én bij elke aflevering ([Ondernemersplein](https://ondernemersplein.overheid.nl/bedrijfsvoering/juridische-zaken/doe-een-leeftijdscontrole-bij-alcohol-verkopen-op-afstand/)). Een boete voor bezorgdiensten is gepland voor 2027 ([Rijksoverheid](https://www.rijksoverheid.nl/actueel/nieuws/2026/01/09/boete-bezorgdienst-bij-afleveren-alcohol-aan-18-minners)).
- **Allergenen (EU 1169/2011):** de 14 allergenen, ook bij verkoop op afstand vóór de aankoop.
- **Herroepingsrecht:** de uitzondering voor snel bederfelijke waar (BW 6:230p; bron secundair).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Bs1 | Afhalen bij de groothandel | L1 | ontbreekt (alleen bezorgen) | Het lid kiest afhalen. De bestelling heeft `bezorgen:false` en de groothandel ziet "afhalen". | K | **A nu** |
| Bs2 | Allergenen vóór het bestellen | L2/L1 | ontbreekt | Elk product toont de allergenen die de zaak opgaf. Ontbreekt de opgave, dan staat er "niet opgegeven door de zaak", nooit "geen". | M | **A nu** |
| Bs3 | Leeftijd bij alcohol | L2 | ontbreekt | Een product met alcohol vraagt `volwassen()` vóór het bestellen. De bezorger krijgt "leeftijd controleren bij afgifte". | M | A nu, als er alcohol verkocht wordt |
| Bs4 | Gedeelde boodschappenlijst met het gezin | L6 | ontbreekt | Gezinsleden vullen één lijst. Eén persoon bestelt. | M | A later |
| Bs5 | Vaste bestelling herhalen | L5 | ontbreekt | Het lid zet een herhaling. Elke keer komt er een voorstel, en nooit een automatische betaling of bestelling. | M | A later |
| Bs6 | Wie is eigenaar: de stand of bestellen.html? | — | vraagt besluit | — | — | SCHERMEIGENAAR |

### e. RTG-exclusief
Een gezinsboodschappenlijst, rekeningen splitsen met verbindingen, en "betaald" alleen na bevestiging via de zaakbetaling.

### f. Bouwstenen
- kern/groothandel (orderlaag);
- bezorg en zaakbetaling;
- `volwassen()`;
- de gezinsagendasleutel als vorm voor Bs4.

### g. Prioritering
- **HERSTEL:** geen gemeten fout; Bs6 (wie is eigenaar van de eetbestelling) is een besluit.
- **VERDIEPING (wacht op het akkoord per familie):** Bs1, Bs2.
- **Mits alcohol:** Bs3.
- **A later:** Bs4, Bs5.
- **Besluit:** Bs6.

### Keten "boodschappen voor het weekend"
1. Het lid kiest producten met allergenen erbij (Bs2).
2. Het kiest afhalen (Bs1).
3. De groothandel bevestigt.
4. Het lid haalt af.

**Storingen:**
- Groothandel uit: de bestelling blijft "aangevraagd", en het scherm zegt dat er nog niets is bevestigd.
- Dubbeltik: één bestelling (bestaat).

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** groothandelsbestelling, eetbestelling, volgen en annuleren (`/api/groothandel/*`, `/api/bezorg/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - de zaak of groothandel aan de andere kant. Reageert niet: "Nog niet bevestigd." (de status aangevraagd bestaat);
  - de zaakbetaling voor eten (`/api/order/pay`). Geweigerd: "Niet betaald; de bestelling is niet geplaatst."
- **Optionele koppelingen:**
  - de live-stroom voor volgen. Uit: de status na verversen;
  - Gezin (Bs4).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'tab:bestellen': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'tab:bestellen': { uitgeeft: ['bestelling'], ontvangt: ['boodschappenlijst'], ketens: [] }
```

FAMILIES:

```js
huishouden: { wat: 'het huishouden draait: boodschappen, personeel en taken, met een lijst die het gezin deelt en een betaling die pas betaald heet na bevestiging',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'huishouden', naam: 'gezinslijst-naar-bestelling', laag: 'scherm', ontbreekt: 'keten', k: 'Bs4', kaart: KAART_LIVA,
  wat: 'een gedeelde boodschappenlijst wordt een bestelling bij de groothandel' }
```

**Volledige werkzaamheid.** Het lid bestelt hier volledig bij zaken in RTG. Buiten RTG blijft nodig: de app van een supermarkt die geen zaak in RTG is (Picnic, AH).

---

## 8. Assets (`tab:assets`, onder `kern.app`)

**Doel.** Een betalend lid vraagt gebruiksrechten in een object aan (een jet, jacht of villa: 300 tickets, 24 uur per jaar, 10 jaar). Een mens van RTG keurt. Pas een bevestigde betaling geeft de tickets. Herroepen zegt alleen wat waar is.

### a. Inventaris
- Gebouwd op 19 oktober 2026 (e36fe0acc): de aanvraag, een mens op naam die keurt, betaalWaarheid, tickets precies één keer, en herroepen via terugbetalen.
- **Bewezen:** `test/assets.test.js` (16) en voltooiproef `assets.js` (9/9, 3/3, 3/3).
- **Gaten:**
  - na het boeken van een dag zegt de app "het team neemt vooraf contact op" (gebruik.js:70), maar er is geen taak en geen agendapunt;
  - bij overdracht via de wachtlijst slikken `try{}catch(e){}` rond `pay.huisIn/huisUit` (gebruik.js:95-96) een fout stil.

### b. Markt
| Aanbieder | Wat | Prijs en bron |
|---|---|---|
| NetJets (fractional) | 1/16 voor ongeveer 50 vlieguren per jaar | $0,5-3,2M aankoop plus $12-28K per maand (na te gaan, [luxe.digital](https://luxe.digital/travel/netjets-cost/)) |
| Pacaso | 1/8 van een woning, 44 nachten per jaar | 10-12% opslag plus maandbedrag (na te gaan) |
| Yacht Quarters (Princess F70) | 1/8 van een jacht | £330.000 plus £56.000 per jaar (na te gaan) |

### c. Domein, met belangrijke bevindingen
- **Timeshare (Richtlijn 2008/122/EG, BW 7:50a e.v.):** 14 dagen bedenktijd en een **verbod op vooruitbetaling tijdens die termijn**. Dit is dwingend recht (art. 7:50i) ([kamerstuk](https://zoek.officielebekendmakingen.nl/kst-32422-3.pdf)).
  - Valt een Access-ticket voor de villa daaronder (een gebruiksrecht op accommodatie, langer dan een jaar), dan **mag de betaling niet binnen de bedenktijd vallen**.
  - Nu kan een lid direct na goedkeuring betalen. **Dit vraagt een juridisch besluit vóór livegang.**
- **Asset-smaak (deelneming met restwaarde):**
  - een vrijstelling van de prospectusplicht vraagt een informatiedocument en een melding bij de AFM; de grens is volgens de AFM €12M sinds 5 juni 2026 ([AFM](https://www.afm.nl/~/profmedia/files/rapporten/2025/risicos-op-crimineel-gedrag-bij-vrijgestelde-aanbiedingen.pdf));
  - aanbieden van een beleggingsobject kan een vergunning vragen (Wft; bron uit 2014, na te gaan).
  - Ook dit vraagt een besluit.

### d. Catalogus, volledig formaat

Dezelfde acht velden als Wonen 1d. De acceptatie wordt een stap in `scripts/lib/voltooi/assets.js` of een toets in `test/assets.test.js`. Vaste getallen komen uit `server/kern/assets.js`: 300 tickets per object, 24 uur per ticket per jaar, 10 jaar geldig, 14 dagen bedenktijd, terugkoop binnen 30 dagen, servicefee 2%, overdracht 5%, 15 onderhoudsdagen, piek juli en augustus.

**A1 · Juridische toets: timeshare en Wft · — · ontbreekt · — · vraagt besluit**
Zie het B-proces hieronder. Tot het besluit stuurt geen enkele wetsregel uit deze kaart een weigering of een uitkomst `bepaald` (zie "Te controleren" onderaan).

**A2 · Betaling pas na de bedenktijd, of in bewaring · L5 · ontbreekt · M · na A1**
- **Gegevens en bron:** de goedgekeurde aanvraag met datum van akkoord (`assetAanvragen`), en de bedenktijd van 14 dagen (`BEDENKTIJD_DAGEN`).
- **Regel:** alleen als A1 besluit dat de Access-smaak onder de timesharerichtlijn valt: binnen de bedenktijd wordt niet betaald, of het geld blijft in bewaring tot dag 15. Zonder besluit verandert er niets.
- **Rekenwijze:** betaalbaar vanaf = datum akkoord + 14 dagen.
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** het lid bij akkoord ("betalen kan vanaf <datum>") en op die dag.
- **Rollen en toestemming:** het lid betaalt; Geld voert uit via betaalWaarheid.
- **Uitzonderingen:** herroepen binnen de termijn kost niets en vraagt geen terugbetaling, want er is niets betaald.
- **Acceptatie:** betalen op dag 3 geeft 409 met de datum; op dag 15 lukt het.

**A3 · Wachtlijstoverdracht en terugkoop niet stil laten falen · L5 · gerepareerd (5e04dc5b6) · K · HERSTEL, af**
- **Gegevens en bron:** de uitkomst van `pay.huisIn` en `pay.huisUit` (`{status, error}`, ze gooien niet).
- **Regel:** de koper betaalt eerst. Mislukt dat, dan blijft hij op de wachtlijst en volgt de terugkoop. Een mislukte uitbetaling aan de verkoper zet `uitbetalingOpen` en het antwoord zegt `uitbetaling:'open'`. Een terugkoop die niet uitbetaald kan worden, geeft 409 en blijft open.
- **Rekenwijze:** waarde = actuele ticketwaarde; de koper betaalt waarde + 5%.
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** verkoper en koper krijgen de echte uitkomst.
- **Rollen:** het lid stapt uit; het kantoor betaalt de terugkoop.
- **Uitzonderingen:** een bedrag boven €5000 per boeking lukt niet via het huisgeld (A7).
- **Acceptatie:** `test/assets.test.js`, drie kerntoetsen met een nep-pay, 18 van 18.

**A4 · Geboekte dag: agendapunt en een taak voor het team · L6 · ontbreekt · M · HERSTEL (tekst) en VERDIEPING (taak)**
- **Gegevens en bron:** de geboekte dag (`assetGebruik`), het object en de codenaam.
- **Regel:** de melding zegt vandaag "Het team neemt vooraf contact op" (`gebruik.js:70`), maar er bestaat geen taak, geen agendapunt en geen kantoorscherm dat dat contact draagt.
  - HERSTEL: de tekst zegt wat er is: "uw dag is vastgelegd". Klein, kan nu.
  - VERDIEPING: het kantoor krijgt een open taak met de dag, en het lid een verwijzing in zijn agenda (`agenda.afspraken`).
- **Rekenwijze:** —
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** het lid bij het boeken; het kantoor via de taak; het lid opnieuw als de taak is opgepakt ("het team neemt contact op").
- **Rollen en toestemming:** een kantoormens op naam pakt de taak op.
- **Uitzonderingen:** is de agenda uit, dan blijft de boeking staan met "niet in agenda gezet".
- **Acceptatie:** na het boeken staat er een verwijzing in de agenda en een open taak in het kantoor; de melding belooft geen contact zolang er geen taak is.

**A5 · Servicefee in de verplichtingenkalender van Geld · L6 · half · K · later (Geld)**
- **Gegevens en bron:** de fee per ticket per jaar (2% van de ticketwaarde), het ticket-id en de vervaldag.
- **Regel:** Geld bezit de verplichting; Assets geeft alleen de verwijzing. Er wordt nooit automatisch afgeschreven.
- **Rekenwijze:** fee = 2% × ticketwaarde (`serviceFeeVan`).
- **Onzekerheid:** de ticketwaarde volgt de taxatie en kan dalen; de datum van de taxatie staat erbij.
- **Wanneer iemand iets hoort:** 30 dagen voor de vervaldag, in Geld.
- **Rollen:** het lid betaalt; het kantoor int (`/api/office/asset/fees`).
- **Uitzonderingen:** Geld uit: "fee nu niet te zien".
- **Acceptatie:** de fee staat in de verplichtingen van Geld met de verwijzing naar het ticket.

**A6 · Dagen ruilen tussen poolleden · L3 · ontbreekt · M · B**
Zie het B-proces hieronder.

**A7 · Bedragen boven het plafond van het huisgeld · L6 · grens gemeten · — · Geld en eigenaar**
- **Gegevens en bron:** `pay` heeft `MAX_CENTEN` = 500000, dus €5000 per boeking. Een ticketprijs, een overdracht of een terugkoop is vaak hoger.
- **Regel:** boven het plafond lukt de boeking niet en zegt het antwoord dat (sinds A3). Voor deze bedragen is de bankrail (betaalWaarheid) nodig.
- **Rest:** —
- **Acceptatie:** een bedrag boven het plafond geeft een eerlijke weigering en zet geen ticket over (bestaat sinds A3).
- **Besluit:** bij Geld en de eigenaar. Ik bouw hier niets.

**A8 · Open uitbetalingen zichtbaar voor het kantoor · L3 · ontbreekt · K · HERSTEL-vervolg**
- **Gegevens en bron:** `t.uitbetalingOpen` (aan wie, waarde, reden, tijd), gezet door A3.
- **Regel:** een open uitbetaling mag niet alleen in de opslag staan; iemand moet haar zien en opnieuw kunnen starten.
- **Rekenwijze:** —
- **Onzekerheid:** —
- **Wanneer iemand iets hoort:** het kantoor ziet de lijst; de verkoper ziet "uitbetaling open" bij zijn ticket.
- **Rollen:** een kantoormens op naam start de uitbetaling opnieuw; nooit vanzelf.
- **Uitzonderingen:** —
- **Acceptatie:** na een mislukte uitbetaling staat ze in `/api/office/asset/overzicht`; opnieuw starten met succes wist de markering.

**B-proces A1: de juridische toets.**
1. **Eigenaar:** legt de vraag voor aan een jurist: valt de Access-smaak onder BW 7:50a e.v. (timeshare, gebruiksrecht op accommodatie langer dan een jaar)? Valt de Asset-smaak onder de prospectusplicht of de Wft?
2. **Jurist (extern):** geeft een schriftelijk advies met de klasse uit `kern/fiscaal/zekerheid.js`-taal: bepaald, uitlegbaar of voorbehouden.
3. **Geld:** zet de uitkomst om in betaalregels (A2: bewaring of uitstel).
4. **LivingOS-A:** bouwt A2 en past het informatiedocument aan (`assetDocument`).
5. **Kantoor:** keurt pas nieuwe aanvragen na dat besluit, als de eigenaar dat zo kiest.

**B-proces A6: dagen ruilen.**
1. **Lid A:** biedt een geboekte dag aan voor een andere dag.
2. **Lid B (poollid van hetzelfde object):** ziet het aanbod en kiest een eigen dag ervoor terug.
3. **Assets:** controleert dat beide dagen nog van hen zijn en dat de piekregel (hooguit de helft in juli en augustus) blijft kloppen.
4. **Beide leden:** geven akkoord. Een gemist akkoord binnen 48 uur betekent geen ruil.
5. **Kantoor:** ziet de ruil in het overzicht; er gaat geen geld om.

### e. RTG-exclusief
Een mens op naam keurt, betaald heet pas betaald, en de dag staat in dezelfde agenda als de reis van TravelOS. Zo zijn het een gebruiksrecht en een reis, niet twee losse dingen.

### g. Prioritering
- **Eerst A1 (besluit).**
- **HERSTEL:** A3 is af (5e04dc5b6); A4 (de melding belooft contact van het team zonder taak); A8 (open uitbetalingen zichtbaar maken).
- **VERDIEPING (wacht op het akkoord per familie):** A4 (taak en agendapunt).
- **Na A1:** A2.
- **A later:** A5.
- **B:** A6.

### Keten "een dag op het jacht"
1. Aanvraag.
2. Goedkeuring.
3. De bedenktijd verstrijkt (A2).
4. Betaling.
5. Tickets.
6. De dag boeken.
7. Het agendapunt en de taak voor het team (A4).

**Storingen:**
- Betaling geweigerd: geen ticket (bestaat).
- Agenda uit: de boeking blijft staan, met de melding.
- Terugbetaling niet bevestigd: "loopt" (bestaat).

### h. Eindcontract, eigen eisen
- **Levenscyclus:** van aanvraag tot uitstappen of herroepen, zonder stille fout (A3).
- **Juridisch:** geen betaling binnen de bedenktijd, als A1 dat zo besluit.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** aanvragen, documentinformatie, tickets, dagen boeken, wachtlijst, uitstappen en herroepen (`/api/asset/*`, `/api/assets`).
- **Noodzakelijke platformdiensten:**
  - account met een betalende pas;
  - een mens van het kantoor die keurt. Afwezig: de aanvraag blijft "aangevraagd" met "Een mens van RTG beoordeelt hem" (bestaat);
  - Geld (betaalWaarheid, pay). Uit of geweigerd: geen ticket, met de reden (bestaat).
- **Optionele koppelingen:**
  - Agenda (A4). Uit: "Niet in agenda gezet.";
  - de verplichtingen van Geld (A5).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'tab:assets': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'tab:assets': { uitgeeft: ['asset.dag'], ontvangt: [], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'geld', naam: 'asset-betalen', laag: 'kern', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'een goedgekeurde aanvraag wordt betaald via betaalWaarheid en geeft dan de tickets; de voltooiproef loopt dat voor het lid, er is geen ketenregister',
  bron: [{ bestand: 'server/kern/assets/aanvraag-betaal.js', noemt: 'betaal' }] },
{ familie: 'geld', naam: 'assetdag-naar-agenda', laag: 'kern', ontbreekt: 'keten', k: 'A4', kaart: KAART_LIVA,
  wat: 'een geboekte dag staat als verwijzing in de agenda en als taak bij het kantoor' }
```

**Volledige werkzaamheid.** Het lid doet hier zijn deel, van aanvraag tot uitstappen. Het kantoor keurt hier. Buiten RTG blijft nodig: de bank voor bedragen boven het plafond van het huisgeld (A7), en een jurist voor A1. De bemanning en het beheer van het object werken in hun eigen systemen.

---

## 9. Vonk (`link:vonk`, eigenaar `daten.vonk`)

**Doel.** Een geverifieerd lid van 18 jaar of ouder vindt een passende ander, leert hem kennen in een veilige omgeving en spreekt af op een plek die de keten ook echt bevestigt.

### a. Inventaris
- **Routes:** `/api/vonk/*` (profiel, foto's, selectie van max. 6, like, bericht, halfweg, kies, betaal, blokkeer) en `/api/connection/vonk/*` (consent, tekst, media, bellen).
- **Statussen:** van DISCOVERY tot POST_DATE, met de reservering aangevraagd → onbekend, geweigerd of bevestigd.
- **Toegang:** 18+ met een geverifieerd paspoort (ontmoetpoort.js:38). Bellen en media alleen met wederzijdse consent. Beschikbaarheid gaat pas na een match open, als één gedeeld dagdeel.
- **Geld:** €10 bevestiging, verdeeld RTG €5 / partner €5, met terugboeking (payment.js).
- **Bewezen:** voltooiproef `vonk.js`. Gerepareerd: herhaalsleutel op bericht en tekst. Niet gelopen: de foto, bellen en video.
- **Gat:** `commitmentId=null` staat hard in payment.js:78. Daardoor ontbreekt het domeinbewijs altijd totdat de zaak beslist.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Hinge (HingeX) | eerder compatibele mensen zien, prioriteit | niet openbaar; $49,99 per maand (na te gaan) ([Hinge](https://help.hinge.co/hc/en-us/articles/38014282744595-Subscription-and-Purchase-Benefits)) |
| Tinder Select | alleen op uitnodiging, bericht zonder match | $499 per maand bij de lancering in 2023 ([TechCrunch](https://techcrunch.com/2023/09/25/tinder-snobs-can-now-pay-499-per-month-to-be-matched-with-the-most-sought-after-profiles)) |
| The League (Investor) | exclusieve selectie | $999 per maand (na te gaan) ([Fortune 2024](https://fortune.com/2024/01/07/wealthy-gen-z-millennial-singles-paying-thousands-the-league-dating-app)) |

### c. Domein
- **DSA art. 28:** richtlijnen voor minderjarigen (14 juli 2025) ([Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/rd-european-commission-guidelines-on-protection-of-minors-under-the-digital-services-act)).
- **EU-blauwdruk voor leeftijdsverificatie:** versie 2 sinds oktober 2025 ([Commissie](https://digital-strategy.ec.europa.eu/en/policies/eu-age-verification)).
- **DSA art. 16, 17 en 22:** melden, een motivering bij ingrijpen en trusted flaggers. Toezicht door de ACM ([jaarverslag](https://www.acm.nl/system/files/documents/dsa-jaarverslag-2025.pdf)).
- **Datingfraude:** de signalen zijn verliefdheid die te snel komt, niet willen videobellen en om geld vragen.
- **Eerste date:** een openbare plek, iemand inlichten en eigen vervoer.

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Vo1 | Date-check-in met Veilig | L6 | ontbreekt | Bij DATE_ACTIVE kan het lid een wacht starten (Veilig) met de eindtijd van de date. Een gemiste check-in alarmeert de eigen kring, nooit de match. | M | **A nu** |
| Vo2 | Fraudesignaal in het gesprek | L4 | ontbreekt | Vraagt de ander om geld of een rekeningnummer (lokale patroonherkenning), dan ziet de ontvanger een waarschuwing met het advies. Er gaat niets automatisch naar het kantoor. | M | **A nu** |
| Vo3 | Melding met motivering terug (DSA 17) | L3 | half (meldingen bestaan) | Het kantoor beslist met een reden. De melder en de gemelde horen de beslissing en hoe ze bezwaar maken. | M | A nu |
| Vo4 | Domeinbewijs van de reservering | L5 | geen fout (nagemeten 19 oktober) | `commitmentId` is null zolang de zaak niet besliste: het domeinbewijs wordt pas bij het besluit van de zaak vastgelegd (`server/opzet/trust-bewijs.js`, `bewijsHospitalityBesluit`). Dat is fail-closed en blijft zo. | — | vervalt |
| Vo5 | Na de date: wederzijds akkoord voor vervolg | L5 | half (POST_DATE) | Beide kiezen "graag weer" of "liever niet". Alleen bij twee keer ja gaat het gesprek verder; een nee wordt nooit getoond als afwijzing. | M | A later |
| Vo6 | EU-leeftijdsverificatie (blauwdruk) | L2 | ontbreekt | — | G | B, extern |

### e. RTG-exclusief
Een date die echt gereserveerd is bij een gekeurde zaak, een check-in via Veilig bij de eigen kring, en een bevestiging van €10 die terugkomt als de zaak weigert.

### g. Prioritering
- **HERSTEL:** geen: Vo4 bleek geen fout.
- **VERDIEPING (wacht op het akkoord per familie):** Vo1, Vo2, Vo3.
- **A later:** Vo5.
- **B:** Vo6.

### Keten "de eerste date"
1. Match.
2. Halfweg een plek kiezen.
3. €10 bevestigen.
4. De zaak bevestigt de tafel.
5. Check-in via Veilig (Vo1).
6. POST_DATE.

**Storingen:**
- De zaak weigert: de reservering heet geweigerd en de €10 komt terug.
- Veilig uit: de date gaat door, en het scherm zegt "geen check-in mogelijk".

### h. Eindcontract, eigen eisen
- **Bevoegd:** een lid zonder 18+-verificatie bereikt geen enkele route (bestaat).
- **Samenwerking:** wensen blijven bij de eigenaar. Getoetst: een match ziet geen wensen.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** profiel, foto's, selectie, like, bericht, halfweg, kiezen, reserveren, blokkeren (`/api/vonk/*`, `/api/connection/vonk/*`).
- **Noodzakelijke platformdiensten:**
  - account met 18+-verificatie (`ontmoetpoort.js`). Zonder: de reden (bestaat);
  - Geld voor de bevestiging van €10. Geweigerd: "Bevestigen lukte niet; er is niets afgeschreven.";
  - een gekeurde zaak die de tafel bevestigt. Stil: "De zaak heeft nog niet gereageerd." (de status onbekend bestaat).
- **Optionele koppelingen:**
  - Veilig (Vo1). Uit: "Geen check-in mogelijk.";
  - bellen en media (wederzijdse consent).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:vonk': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:vonk': { uitgeeft: ['vonk.date'], ontvangt: [], ketens: [] }
```

FAMILIES:

```js
ontmoeten: { wat: 'twee leden leren elkaar veilig kennen en spreken af op een plek die de zaak echt bevestigt, met de eigen kring als vangnet',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'ontmoeten', naam: 'date-naar-zaak', laag: 'kern', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'de reservering gaat naar de zaak en het domeinbewijs ontstaat bij haar besluit (opzet/trust-bewijs.js); geen ketenproef loopt de zaakkant',
  bron: [{ bestand: 'server/opzet/trust-bewijs.js', noemt: 'bewijsHospitalityBesluit' }] }
```

**Volledige werkzaamheid.** Het lid doet hier het hele werk van kennismaken tot een gereserveerde date. Buiten RTG blijft nodig: het reserveringssysteem van een zaak die geen RTG-zaak is (daar kan Vonk niet reserveren).

---

## 10. Theater (`link:theater`, eigenaar `media.theater`)

**Doel.** Films en series kijken, kanalen volgen, een eigen kanaal met werk beheren en reacties lezen.

### a. Inventaris
- **Routes:** `/api/theater/*` (zaal, kanaal/aanmeld, video/maak, upload tot 420 MB, ondertitels, abonneer, reactie, meld, kijk/:id met stroomticket, zaakbibliotheek, kijkplicht, huisstijl).
- **Kantoor:** keurt kanalen (wacht → goedgekeurd of geweigerd).
- **Bewezen:** voltooiproef `theater.js` (reactie- en videoherhaling gerepareerd). Niet gelopen: het Thuisarchief (WebRTC), ondertitels, de zaakbibliotheek en de kijkplicht.
- **Gaten:**
  - "abonnementen beheren" is alleen volgen;
  - series bestaan niet;
  - geen leeftijdsregel;
  - MAX_VIDEO_MB is een "demo-grens".

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Netflix Premium | 4K, meerdere schermen | €20,99 per maand (na te gaan) |
| Vimeo OTT Enterprise | eigen apps, DRM, live | op offerte |
| Patreon | betaalde lidmaatschappen voor makers | 10% voor nieuwe makers sinds augustus 2025 ([Patreon](https://support.patreon.com/hc/en-gb/articles/360024952552)) |

### c. Domein
- **Commerciële mediadienst op aanvraag:** registratie bij het CvdM, plus NICAM (Kijkwijzer) en de Reclame Code. Het artikel is na te gaan.
- **Kijkwijzer-iconen** staan vóór het afspelen.
- **DSA art. 16 en 17:** melden en een motivering.
- **EAA (sinds 28 juni 2025):** de speler moet toegankelijk zijn en ondertitels doorgeven ([Taylor Wessing](https://www.taylorwessing.com/en/interface/2025/media-hot-topics-2025/access-to-audiovisual-media-services-under-the-european-accessibility-act)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| T1 | Leeftijdsclassificatie per video | L2 | ontbreekt | De maker kiest een Kijkwijzer-leeftijd. Een video van 16+ of 18+ speelt alleen voor een lid dat `volwassen()` of de leeftijd haalt; anders volgt 403 met de reden. | M | **A nu** |
| T2 | Series (seizoen, aflevering, verder kijken) | L1 | ontbreekt | Afleveringen hangen aan een serie. Verder kijken begint bij de laatste positie van het lid. | M | A later |
| T3 | Ondertitels altijd doorgeven (EAA) | L1 | half | Ondertitels van de maker staan in de speler, aan en uit te zetten, en worden getoetst op elke video met cues. | K | **A nu** |
| T4 | Betaald abonnement op een kanaal | L2/L6 | ontbreekt | — | M | B: Geld (betaalWaarheid) en de PSD2-vraag (zie Podium) |
| T5 | Registratieplicht CvdM | — | — | — | — | vraagt besluit (juridisch) |

### e. RTG-exclusief
Een zaakbibliotheek met kijkplicht voor medewerkers, en het Thuisarchief rechtstreeks van maker naar kijker.

### g. Prioritering
- **HERSTEL:** geen gemeten fout.
- **VERDIEPING (wacht op het akkoord per familie):** T3, T1.
- **A later:** T2.
- **B:** T4.
- **Besluit:** T5.

### Keten "een video publiceren"
1. Kanaal aanvragen.
2. Het kantoor keurt.
3. Uploaden met ondertitels en leeftijd.
4. Een lid kijkt.
5. Het lid reageert.

**Storing:** de opslag is vol: de upload wordt geweigerd met de reden, en er blijft geen half bestand achter.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** kijken, kanalen volgen, een eigen kanaal, uploaden, ondertitels, reacties (`/api/theater/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - opslag (tot 420 MB per video). Vol: "Uploaden lukt niet: de opslag is vol.";
  - het kantoor dat een kanaal keurt. Afwezig: "Je kanaal wacht op keuring." (de status wacht bestaat);
  - het stroomticket om te kijken.
- **Optionele koppelingen:**
  - de zaakbibliotheek en kijkplicht (een zaak);
  - het Thuisarchief (WebRTC, van maker naar kijker).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:theater': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:theater': { uitgeeft: ['media.video'], ontvangt: ['bestand'], ketens: [] }
```

FAMILIES:

```js
media: { wat: 'maken, publiceren, kijken en reageren, met de keuring en de grenzen van het huis, zonder kopie tussen de media-apps',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'media', naam: 'abonnement-naar-geld', laag: 'kern', ontbreekt: 'keten', k: 'T4', kaart: KAART_LIVA,
  wat: 'een betaald abonnement op een kanaal (vraagt Geld en het PSD2-besluit)' }
```

**Volledige werkzaamheid.** Kijkers en makers doen hier hun werk binnen RTG. Buiten RTG blijft nodig: montage (Premiere, DaVinci), het maken van ondertitels, en de registratie bij het Commissariaat voor de Media als die geldt (T5).

---

## 11. Podium (`link:podium`, eigenaar `media.podium`)

**Doel.** Live uitzendingen kijken, chatten en cadeaus geven, of via de zaal andere kanalen vinden.

### a. Inventaris
- **Routes:** `/api/podium/*` (kanalen, live, kijk, signaal, chat, cadeau, abonneer, kaartje, koop, blokkeer, meld).
- **Kantoor:** `/api/office/podium/beslis`.
- **Zones:** open, creator, evenement, besloten, beperkt (18+), zaak en handel.
- **Geld:** cadeaus en kraam via RTG Pay `pay.stuur` met herhaalsleutel.
- **Bewezen:** voltooiproef `podium.js` (chat-idem gerepareerd). Niet gelopen: abonnementen, kaartjes, de kraam en de besloten zones.
- **Gaten:**
  - het commentaar zegt "strikt 18+" (index.js:7, kernlaag5.js:115), maar de zones open en creator vragen alleen een lid;
  - de catalogus zegt nog "(18+)";
  - het kantoorscherm voor het keuren van kanalen roept geen scherm aan;
  - `/kaartje` en `/nodig` staan niet op podium.html.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Twitch | tier-3 sub, Turbo | $24,99 / $11,99 per maand (na te gaan) |
| YouTube-kanaallidmaatschappen | tot 6 niveaus, de maker houdt 70% | ([YouTube](https://www.youtube.com/creators/channel-memberships/)) |
| Patreon | lidmaatschap en live | 10% |

### c. Domein
- **Vloggers en de Mediawet (sinds 1 juli 2022):** registratie bij 500.000 volgers, 24 video's per jaar en een KvK-inschrijving. Of die drempel nog actueel is, is na te gaan ([Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2022/07/new-set-of-rules-for-influencer-marketing-in-the-netherlands)).
- **PSD2:** een platform dat gelden ontvangt en doorbetaalt heeft een DNB-vergunning nodig, tenzij een betaalinstelling het uitvoert ([DNB](https://www.dnb.nl/voor-de-sector/open-boek-toezicht/wet-regelgeving/psd2/elektronische-handelsplatformen-e-commerce-platforms-psd2)). Dat raakt de cadeaus.
- **Witwasrisico van cadeaus:** in de VS wordt erover geprocedeerd ([bron](https://moneylaundering.com/news/tiktok-lawsuit-highlights-potential-money-laundering-risks)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| P1 | Leeftijd per zone, eerlijk opgeschreven | L2 | fout (tekst) | Commentaar en catalogus zeggen wat de code doet: alleen de zone "beperkt" is 18+. Getoetst met een lid onder 18 in de zone "open". | K | **A nu** |
| P2 | Plafond op cadeaus en signalen | L3 | ontbreekt | Een cadeaubedrag boven het dag- en maandplafond van het lid wordt geweigerd met de reden. Ongewone patronen gaan naar het kantoor, zonder automatische straf. | M | A nu |
| P3 | Kaartje en uitnodiging op het scherm | L1 | half (routes bestaan) | Een kaartje voor een evenementzone geeft toegang. Zonder kaartje volgt 403 met "kaartje nodig". | M | A later |
| P4 | Kanaal keuren op het kantoorscherm | L3 | half | Een kantoormens op naam keurt op een scherm. Hij keurt nooit zijn eigen kanaal. | M | A later |
| P5 | Betaalvergunning voor cadeaus | — | — | — | — | vraagt besluit (Geld en juridisch: PSD2) |

### g. Prioritering
- **HERSTEL:** P1 is af (a53012167).
- **VERDIEPING (wacht op het akkoord per familie):** P2.
- **A later:** P3, P4.
- **Besluit:** P5.

### Keten "live met cadeau"
1. Kijken.
2. Chatten.
3. Een cadeau geven via Pay.
4. De maker ziet het cadeau.

**Storingen:**
- Pay weigert: geen cadeau, met de melding.
- Kantoor uit: kanaalaanvragen blijven "wacht".

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** live kijken, chatten, volgen, blokkeren en melden (`/api/podium/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - de live-signalering. Uit: "De uitzending is nu niet te bereiken.";
  - het kantoor voor kanaalaanvragen. Afwezig: "wacht" (bestaat).
- **Optionele koppelingen:**
  - Geld (`pay.stuur`) voor cadeaus en de kraam. Geweigerd: "Geen cadeau verstuurd" met de reden (bestaat);
  - kaartjes (P3).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:podium': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:podium': { uitgeeft: ['media.live'], ontvangt: [], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'media', naam: 'cadeau-naar-maker', laag: 'kern', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'een cadeau gaat via pay.stuur naar de maker; geen ketenproef loopt betaling en ontvangst samen',
  bron: [{ bestand: 'server/kern/podium/index.js', noemt: 'stuur' }] }
```

**Volledige werkzaamheid.** Kijkers en makers doen hier hun werk tijdens de uitzending. Buiten RTG blijft nodig: de software die uitzendt (OBS of een camera-app), en een betaalinstelling voor cadeaus zolang P5 niet besloten is.

---

## 12. Krant (`link:krant`, eigenaar `media.krant`)

**Doel.** Een lid leest artikelen of bladert door de gids van kranten. Een redactie maakt, corrigeert en publiceert.

### a. Inventaris
- **Lezers:** `/api/krant/{gids, open, artikel}` met auth.
- **Redactie:** `/api/supplier/redactie/*`, met de capability `redactie`.
- **Statussen:** concept en live, met eindredactie. Correcties zijn zichtbaar in publicatie.js.
- **Bewezen:** voltooiproef `krant.js`. De openbaarheidsstap is gesloten sinds Toegang (66f413ff).
- **Gaten:**
  - journalistiek-krant.js:4 zegt "vraagt geen sessie", maar de routes eisen auth;
  - "gepersonaliseerd" bestaat niet;
  - assist (journalistiek.js:113-129) zoekt `claude.vraag`, maar server.js:1068 geeft die niet mee, dus assist draait altijd op de regel-terugval.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| FT Premium Digital | alles, analyses | rond €69 per maand (na te gaan) |
| NRC Digitaal Compleet | krant en archief | €54,95 per maand (na te gaan) |
| WordPress VIP (redacties) | redactieplatform | vanaf $25.000 per jaar ([WPVIP](https://wpvip.com/?p=98790)) |

### c. Domein
- **Raad voor de Journalistiek:** zelfregulering via de Leidraad (2019). De tekst over rectificatie is na te gaan ([Leidraad](https://rvdj.nl/assets/uploads/2024/01/Leidraad-aanpassing-2019.pdf)).
- **Art. 6:167 BW:** een rechter kan rectificatie bevelen ([Dirkzwager](https://www.dirkzwager.nl/kennis/artikelen/over-de-vordering-tot-rectificatie/)).
- Er is geen wettelijk recht op weerwoord ([IViR](https://www.ivir.nl/?p=9272)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| K1 | Correctie met datum en reden, zichtbaar boven het artikel | L2 | half | Een correctie toont wat er veranderde, wanneer en waarom. De vorige tekst blijft voor de redactie in de geschiedenis. | K | **A nu** |
| K2 | Commentaar laten kloppen met de code | — | fout (tekst) | De kop van journalistiek-krant.js zegt dat lezen een sessie vraagt. | K | **A nu** |
| K3 | Assist via de lokaal-eerst-keten | L4 | fout (geen `claude`) | Assist krijgt de keten van server/ai.js. Zonder model blijft de regel-terugval, met het label "zonder model". | K | A nu (melden aan WorkOS of de redactie als dat de eigenaar is) |
| K4 | Klacht van een lezer naar de redactie | L2/L3 | ontbreekt | Een lezer meldt een fout. De redactie beslist met een reden, en de lezer hoort het. | M | A later |
| K5 | Persoonlijke krant (rubrieken volgen) | L1 | ontbreekt | Het lid volgt rubrieken. De volgorde is uit te leggen: nooit een verborgen score. | M | A later |

### g. Prioritering
- **HERSTEL:** K2 en K3 zijn af (58b2f5cf3).
- **VERDIEPING (wacht op het akkoord per familie):** K1.
- **A later:** K4, K5.

### Keten "een fout in een artikel"
1. Een lezer meldt de fout (K4).
2. De redactie corrigeert (K1).
3. De correctie staat boven het artikel.
4. De lezer hoort het.

**Storing:** redactie uit: lezen werkt door; de melding blijft "ontvangen".

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** gids, lezen, en voor de redactie maken, corrigeren en publiceren (`/api/krant/*`, `/api/supplier/redactie/*`).
- **Noodzakelijke platformdiensten:**
  - account en sessie (lezen vraagt een sessie);
  - de capability `redactie` voor de redactiekant.
- **Optionele koppelingen:**
  - een model voor assist. Zonder: de regel-terugval met het label "zonder model";
  - meldingen voor de lezer bij een correctie (K4).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:krant': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:krant': { uitgeeft: ['krant.artikel'], ontvangt: [], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'media', naam: 'klacht-naar-redactie', laag: 'kern', ontbreekt: 'keten', k: 'K4', kaart: KAART_LIVA,
  wat: 'een lezer meldt een fout en de redactie beslist met een reden' }
```

**Volledige werkzaamheid.** Lezers lezen hier volledig; de redactie publiceert en corrigeert hier. Buiten RTG blijft nodig: de schrijfomgeving van de redactie (vaak Word of Google Docs) en persbureaus voor bronnen.

---

## 13. Spelavond (`link:spelavond` → spelscherm.html, eigenaar `spelen.projectiescherm`)

**Doel.** Een spel dat op de telefoon gestart is, projecteren op een tweede scherm, om samen aan tafel te spelen.

### a. Inventaris
- **Routes:** `/api/projectie/koppel` en `/kijk` (no-store). GET `/api/projectie/:code` geeft 410.
- **De tv:** heeft geen account; hij krijgt een eenmalige code en daarna een gehashte schermsessie.
- **Openen en sluiten:** alleen een speler kan dat.
- **Scores:** alleen bij `progressieMag`.
- **Bewezen:** voltooiproef `spelavond.js`.
- **AI:** Rahul in spellen/rahul.js via de lokaal-eerst-keten, met vaste tips als terugval.
- **Gaten:** geen echte. Een aparte "spelavond"-planning bestaat niet.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Jackbox Party Pack 11 | partyspellen via telefoon en tv | ongeveer $29-35 eenmalig (na te gaan) |
| AirConsole Hero | meer dan 170 spellen, onbeperkt spelers | $7,99 per maand ([App Store](https://apps.apple.com/app/airconsole/id1017688554)) |
| Kahoot! 360 Pro Max | tot 2.000 deelnemers | $69 per host per maand ([Kahoot](https://www.kahoot.com/pricing)) |

### c. Domein
- **Kansspelwet:** geen geldprijzen. Een promotioneel kansspel valt onder de gedragscode ([Ksa](https://kansspelautoriteit.nl/sites/default/files/2026-06/2026-06-02_21670_LOD%20illegaal%20promotioneel%20kansspel_sanctiebesluit.pdf)).
- **PEGI vanaf juni 2026:** betaalde lootboxen worden PEGI 16, en onbeperkte chat zonder blokkeren of melden wordt PEGI 18 ([Osborne Clarke](https://www.osborneclarke.com/insights/games-loot-boxes-get-16-plus-age-rating-europe-under-pegi-overhaul)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| S1 | Avond plannen met uitnodigingen in de Agenda | L6 | ontbreekt | De gastheer plant een avond. De genodigden krijgen een agendaverwijzing. De potjes van die avond hangen eraan. | M | A later |
| S2 | Melden en blokkeren in de spelchat | L2 | onbekend | Spelchat heeft melden en blokkeren. Ontbreekt dat, dan gaat de meting als besluit naar de eigenaar (de PEGI-regel is te controleren en stuurt zelf niets). | K | **A nu** (eerst meten) |
| S3 | Geen lootboxen of geldprijzen | — | bestaat (niet gebouwd) | Een toets die vastlegt dat geen spelroute geld uitkeert of een willekeurige betaalde beloning geeft. | K | **A nu** |

### g. Prioritering
- **HERSTEL:** geen gemeten fout.
- **VERDIEPING (wacht op het akkoord per familie):** S2 (eerst meten), S3.
- **A later:** S1.

### Keten "spelavond"
1. Plannen (S1).
2. Starten op de telefoon.
3. Koppelen met de tv-code.
4. Spelen.
5. Afsluiten.

**Storing:** de tv valt weg: het potje gaat door op de telefoon, en opnieuw koppelen kan met een nieuwe code.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** koppelen met een tv-code en kijken (`/api/projectie/koppel`, `/kijk`).
- **Noodzakelijke platformdiensten:**
  - account van de speler;
  - een lopend spel (Spelen, LivingOS-B). Geen spel: "Start eerst een spel op je telefoon."
- **Optionele koppelingen:**
  - Agenda (S1);
  - Rahul via de lokaal-eerst-keten. Zonder model: vaste tips (bestaat).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:spelavond': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:spelavond': { uitgeeft: [], ontvangt: ['spel.potje'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'spel', naam: 'avond-naar-agenda', laag: 'scherm', ontbreekt: 'keten', k: 'S1', kaart: KAART_LIVA,
  wat: 'een geplande spelavond staat als verwijzing in de agenda van de genodigden' }
```

**Volledige werkzaamheid.** Spelers doen hier alles wat een spelavond vraagt. Buiten RTG blijft nodig: een browser op de tv of een cast-toestel.

---

## 14. Camera (`link:camera`, eigenaar `media.camera`)

**Doel.** Foto's maken, met tips, afwerken in de Studio, en bewaren.

### a. Inventaris
- **Scherm:** camera.html met zoeker, standen, Studio (looks en schuiven) en spraak. De enige route is `/api/fluister`.
- **Bewezen:** schermtoets camerascherm.e2e.js, met beeld, oorzaak zonder camera, en een Studio-download als echte JPEG met de look in de pixels (2a4da64b8).
- **Niet geregistreerd:** de eigenaar beslist of een app zonder serverstaat telt.
- **Gaten:**
  - "bewaren" is alleen een download in de browser;
  - de herkenning is een lokale pixelheuristiek, geen AI;
  - de tekst "deze mag de Salon in" heeft geen route;
  - spraak gebruikt de Web Speech API van de browser, niet lokaal, terwijl meelezen.js die voor gesprekken uitsluit.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Adobe Creative Cloud Pro | Lightroom, generatief | $69,99 per maand ([ProVideo](https://www.provideocoalition.com/please-read-adobes-official-article-on-the-pricing-changes-coming-to-the-creative-cloud-plans/)) |
| VSCO One | Studio Pro, zakelijk | $499,99 per jaar ([VSCO](https://vsco.co/pricing)) |
| Halide Mark III | RAW, Process Zero, looks | $59,99 eenmalig ([PetaPixel](https://petapixel.com/2026/05/27/halide-mark-iii-promises-most-beautiful-photos-possible-on-iphone/)) |

### c. Domein
- **Portretrecht (Auteurswet art. 21):** geen publicatie als een redelijk belang zich verzet ([Dirkzwager](https://www.dirkzwager.nl/kennis/artikelen/wat-is-het-portretrecht-de-juridische-aspecten)).
- **AVG:** een herkenbare foto is een persoonsgegeven.
- **EXIF/GPS:** kan een adres verraden (na te gaan).
- **Beroepsfotografen:** licentie vooraf, schriftelijk (DuPho).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| C1 | Bewaren in de kluis | L1/L6 | ontbreekt | Bewaar zet de afgewerkte foto in `docs.bestanden` (map "Foto's"), versleuteld. Is de kluis uit, dan volgt een download met de melding. | M | **A nu** |
| C2 | Plekgegevens eraf bij delen | L1 | ontbreekt | Een gedeelde of bewaarde foto heeft geen GPS in EXIF, tenzij het lid dat per foto kiest. Getoetst door de bytes te lezen. | K | **A nu** |
| C3 | Naar De Salon, met de Salon als eigenaar | L6 | ontbreekt | "Naar de Salon" opent het plaatsen van de Salon (LivingOS-B) met de foto als bestand-id. De Camera bezit de post niet. | M | A later |
| C4 | Portretwaarschuwing | L4 | ontbreekt | Bij delen van een foto met een herkenbaar gezicht (lokale detectie) vraagt de app "heeft de persoon toestemming?". Er wordt niets geblokkeerd. | M | A later |
| C5 | Spraak lokaal | L1 | fout tegen de huisregel, gemeld | Spraaksturing gaat via de lokale spraakroute (meeluister) of staat uit. De browser-cloud is niet de standaard. Besluit Centraal 19 oktober: aanbevolen nu, nog niet omgebouwd. Ook 'bewaren' is alleen een download. | M | aanbevolen nu |

### g. Prioritering
- **HERSTEL:** C5 (spraak via de browsercloud; besluit Centraal: melden, niet ombouwen) en de teksten "Opgeslagen op volle resolutie" en "Deze mag de Salon in" (`camera.html:417, :592`) terwijl opslaan een download is en er geen Salon-route is.
- **VERDIEPING (wacht op het akkoord per familie):** C2, C1.
- **A later:** C3, C4.

### Keten "foto voor de Salon"
1. Maken.
2. Afwerken.
3. Bewaren in de kluis (C1, zonder GPS: C2).
4. Plaatsen in de Salon (C3).

**Storing:** kluis uit: een download met de melding; de Salon krijgt niets zonder bestand.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** zoeker, standen, Studio en downloaden (`camera.html`, route alleen `/api/fluister`).
- **Noodzakelijke platformdiensten:**
  - toestemming voor de camera in de browser. Geweigerd: de oorzaak (bestaat).
- **Optionele koppelingen:**
  - de kluis (C1). Uit: "Bewaren in de kluis kan nu niet; download de foto.";
  - de Salon (C3), spraaksturing (C5).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:camera': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:camera': { uitgeeft: ['bestand'], ontvangt: [], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'media', naam: 'foto-naar-kluis', laag: 'scherm', ontbreekt: 'keten', k: 'C1', kaart: KAART_LIVA,
  wat: 'bewaren zet de foto versleuteld in docs.bestanden' },
{ familie: 'media', naam: 'foto-naar-salon', laag: 'scherm', ontbreekt: 'keten', k: 'C3', kaart: KAART_LIVA,
  wat: 'de foto gaat als bestand-id naar het plaatsen van de Salon (LivingOS-B)' }
```

**Volledige werkzaamheid.** Het lid maakt en werkt hier foto's af. Buiten RTG blijft nodig: de camera-app van het toestel voor RAW, en Lightroom voor professioneel werk.

---

## 15. App-dossier (`link:appdossier`, eigenaar `appstore.dossier`)

**Doel.** Inzien welke apps het lid genomen heeft, wat het ze gaf, en dat weer intrekken. Per app: wie hem leverde en toeliet, wat hij nooit krijgt, en waar de gegevens blijven.

### a. Inventaris
- **Routes:** `/api/appstore/dossier` en `/kanaal`. Het scherm leest alleen.
- **Publiceren:** een kantoormens op naam, met een echte toegankelijkheidskeuring (scripts/appstore-a11y.js).
- **Bewezen:** voltooiproef `appdossier.js`.
- **Gat:** het doel belooft "genomen apps, wat ik gaf, intrekken". De routes daarvoor bestaan (`/api/appstore/mijn`, `/weg`, `/tijdlijn`, `/vernietig`, lid.js:25-109), maar het scherm gebruikt ze niet.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Apple App Privacy-labels | zelfopgave per app; Apple controleert niet | ([BHFS](https://www.bhfs.com/insight/new-privacy-requirements-for-app-developers-using-the-apple-app-store/)) |
| Google Play Data safety | verplicht, ook SDK's van derden | ([Google](https://support.google.com/googleplay/android-developer/answer/10787469)) |
| Microsoft App Governance | beleid voor OAuth-apps | in Defender for Cloud Apps (na te gaan) |

### c. Domein
- **DMA art. 6(4):** alternatieve stores, met integriteitsmaatregelen die evenredig moeten zijn.
- **AVG art. 28:** een verwerkersovereenkomst per externe verwerker.
- **ISO 27001 A.5.19-5.23:** leveranciersbeheer van onboarding tot exit ([HighTable](https://hightable.io/iso-27001-annex-a-5-20-addressing-information-security-within-supplier-agreements)).
- **EAA:** een toegankelijkheidsverklaring ([Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2025/09/european-accessibility-act-requirements-for-e-commerce-services)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| D1 | Mijn apps, met intrekken op het dossierscherm | L1/L5 | half (routes bestaan) | Het lid ziet zijn genomen apps en wat hij gaf, en trekt een machtiging in. Daarna krijgt de app 403 op die gegevens. Getoetst met de echte app-sessie. | M | **A nu** |
| D2 | Tijdlijn van wat een app deed | L5 | half (`/tijdlijn`) | Per app de handelingen met gegevens, alleen voor het lid. | K | **A nu** |
| D3 | Verwerkersovereenkomst in het dossier | L2 | ontbreekt | Het dossier toont of een overeenkomst getekend is (ja, nee of niet nodig), zoals het kantoor vastlegde. Zonder vastlegging staat er "niet vastgelegd". | M | A later |
| D4 | Toegankelijkheidsverklaring per app | L2 | half (keuring bestaat) | De uitslag van de echte keurloper staat in het dossier, met datum en versie. | K | A later |
| D5 | Alles van een app vernietigen | L5 | half (`/vernietig`) | Na vernietigen is er buiten de server om niets meer van die app in de opslag te vinden. | M | A later |

### e. RTG-exclusief
Apple en Google laten de maker het label zelf invullen. Bij RTG keurt een mens op naam, met een echte toegankelijkheidsmeting, en het lid kan zelf intrekken.

### g. Prioritering
- **HERSTEL:** D1 (het doel belooft genomen apps en intrekken; de routes bestaan, het scherm gebruikt ze niet).
- **VERDIEPING (wacht op het akkoord per familie):** D2.
- **A later:** D3, D4, D5.

### Keten "ik stop met een app"
1. Het dossier openen.
2. De machtiging intrekken.
3. De app krijgt 403.
4. Alles vernietigen.
5. Er is niets meer in de opslag.

**Storing:** de app-dienst is uit: intrekken werkt toch, want de machtiging staat bij RTG en niet bij de app.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** het dossier van een app en het kanaal lezen (`/api/appstore/dossier`, `/kanaal`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - het register van de App Store.
- **Optionele koppelingen:**
  - de routes voor intrekken en vernietigen (`/api/appstore/mijn`, `/weg`, `/tijdlijn`, `/vernietig`), zodra het scherm ze aanroept (D1).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:appdossier': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:appdossier': { uitgeeft: [], ontvangt: ['app'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'appstore', naam: 'intrekken-op-dossier', laag: 'scherm', ontbreekt: 'keten', k: 'D1', kaart: KAART_LIVA,
  wat: 'het dossierscherm trekt een machtiging in, en de app krijgt daarna 403' }
```

**Volledige werkzaamheid.** Het lid ziet hier wat een app van hem heeft. Buiten RTG blijft nodig: de instellingen van Apple of Google voor apps buiten RTG.

---

## 16. Logeren bij leden (`link:huis` → thuis.html): verwijzing naar TravelOS

**Waar de kaart staat.** Logeren valt in de productindeling onder TravelOS (eigenaarsbesluit van 19 oktober). De domeinkaart staat in `docs/domeinkaarten/travelos.md` par. 3.6, met de open vraag B5 (betalen via RTG en de uitbetaling aan de gastheer) in par. 5, de familie `reis` en de ONTBREKEND-regel `logeren-naar-agenda` in `scripts/lib/appcontract.js`. Hier staat geen tweede kaart, om te voorkomen dat er twee lezingen van hetzelfde product ontstaan.

**Wat LivingOS-A hier op 19 oktober deed, op verzoek van Centraal:**
- **c597f7916:** de teksten van boeking, hostbord, hostformulier en annuleren beloven geen betaling meer. De uitbetaling heeft de status `buiten-rtg`. Toets: `test/thuis-betaaltekst.test.js`.
- **e8e70ca70:** het doel in SCHERMEIGENAAR.json beschrijft logeren bij leden. Toets: `test/schermeigenaar-doelen-livinga.test.js`.

Daarmee zijn twee van de vier NU-regels uit travelos.md 3.6 af: de betaaltekst en het doel. De gekeurde identiteit en de projectie in agenda, reis en Move blijven bij TravelOS.

**Wat ik aan TravelOS overdraag (uit mijn eerdere inventaris, niet in travelos.md 3.6 gezien):**
- De host krijgt geen melding van een aanvraag.
- `terugPct` wordt alleen vastgelegd; er gaat geen geld terug.
- De juridische punten: de registratieplicht en de nachtenteller (Wet toeristische verhuur), het nachtregister en de toeristenbelasting (Gemeentewet art. 224), en de gegevensplicht uit verordening 2024/1028. Al deze regels zijn "te controleren" (zie onderaan) en sturen geen weigerregel.

---

## 17. Mijn leven (`link:leven`, eigenaar `leven.werkblad`)

**Productindeling.** Het eigenaarsbesluit zegt dat Leven een overkoepelende projectie is en nooit eigenaar van gegevens.

**Doel.** Een lid ziet zijn lijn (fasen, rollen, afspraken, wat deze week speelt) uit de eigen apps, zonder dat Leven iets bezit of iets voor hem doet.

### a. Inventaris
- **Routes:** alleen lezend. `/api/leven/lijn` en `/cockpit`; routes/leven.js zegt letterlijk "geen enkele schrijfroute".
- **Cockpit:** items zijn `niveau:'kijken'`.
- **Delen:** via levensband (`/api/leven/beleid`, `/band/*`, `/deel/*`).
- **Mentor:** `/api/leven/mentor` via de lokaal-eerst-keten, met `spiegel()` als terugval.
- **Bewezen:** voltooiproef `leven.js`.
- **Gaten:**
  - SCHERMEIGENAAR r.1884 beschrijft nog de avondcomponist, terwijl die naar avond.html verhuisd is;
  - "Rahul" op het scherm is trefwoordrouting;
  - leven.html roept de mentor en de levensband niet aan.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Day One Gold | AI-chat, samenvatting over meerdere notities | $74,99 per jaar ([Day One](https://dayoneapp.com/guides/premium-subscription/day-one-pricing-features-guide/)) |
| Notion Business | life-OS-templates met AI | ongeveer $18-20 per gebruiker per maand (na te gaan) |
| Apple Journal | dagboek | gratis |

### c. Domein
- **AVG art. 20:** dataportabiliteit van wat het lid zelf gaf.
- **AVG art. 22 en UAVG art. 40:** geen besluit met aanmerkelijk effect dat uitsluitend geautomatiseerd tot stand komt (AP-advies 2024) ([Eerste Kamer](https://www.eerstekamer.nl/overig/20241025/advies_artikel_22_avg_en/document)).
- **Coaching:** de EMCC/AC-code (versie 4, december 2025): de coachee beslist ([EMCC](https://www.emccglobal.org/global-code-of-ethics/)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| L1 | Bron bij elk item op de lijn | L6 | half | Elk cockpit-item noemt de app die eigenaar is en opent daar. Is die app uit, dan staat er "bron nu niet te zien", zonder kopie. | K | **A nu** |
| L2 | Export van de eigen lijn (art. 20) | L1 | ontbreekt | Het lid downloadt zijn lijn als JSON, met de bron per regel. | K | A later |
| L3 | Mentor op het scherm, volgens de EMCC-regel | L4 | half (route bestaat) | De mentor stelt vragen en geeft nooit een besluit of een opdracht. Zonder model komt de spiegel. Het lid kan alles wissen. | M | A later |
| L4 | Doel in SCHERMEIGENAAR rechtzetten | — | fout (tekst) | Het doel beschrijft de lijn als projectie. | K | **A nu** |

### g. Prioritering
- **HERSTEL:** L4 is af (e8e70ca70).
- **VERDIEPING (wacht op het akkoord per familie):** L1.
- **A later:** L2, L3.

### Keten "mijn week"
1. De agenda, de woninggeschiedenis (Wonen W20) en Entourage leveren aan de lijn.
2. Leven toont ze, met de bron per item.

**Storing:** een bron is uit: dat deel staat er niet, en het scherm noemt welke bron.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** de lijn en de cockpit tonen, alleen lezend (`/api/leven/lijn`, `/cockpit`).
- **Noodzakelijke platformdiensten:**
  - account en sessie;
  - de bronnen zelf. Zonder bronnen is de lijn leeg, met "nog niets uit je apps".
- **Optionele koppelingen:**
  - een bron die uitvalt: "<app> nu niet te zien" (L1);
  - de levensband voor delen; de mentor (model, terugval `spiegel()`).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:leven': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:leven': { uitgeeft: [], ontvangt: ['afspraak', 'woning.geschiedenis', 'reis'], ketens: [] }
```

FAMILIES:

```js
leven: { wat: 'het lid ziet zijn lijn uit de eigen apps, met de bron per regel, zonder dat een overzicht iets bezit',
  kaart: 'docs/domeinkaarten/livingos-a.md' }
```

ONTBREKEND:

```js
{ familie: 'leven', naam: 'woninggeschiedenis-naar-lijn', laag: 'kern', ontbreekt: 'keten', k: 'W20', kaart: KAART_LIVA,
  wat: 'de woninggeschiedenis van Wonen staat als projectie op de lijn' },
{ familie: 'leven', naam: 'deling-naar-vooruitzicht', laag: 'kern', ontbreekt: 'proef', kaart: KAART_LIVA,
  wat: 'een deling van afspraken in Leven opent de partnerweergave van het Vooruitzicht; getoetst in test/instant-reality-partner.test.js, maar niet in een ketenregister',
  bron: [{ bestand: 'server/routes/instant-reality.js', noemt: 'inzageMag' }] }
```

**Volledige werkzaamheid.** Het lid ziet hier zijn lijn; het werk zelf doet hij in de eigen apps. Buiten RTG blijft nodig: een dagboek als Day One voor wat niet uit een app komt.

---

## 18. Cellier (`link:cellier`, eigenaar `leven.cellier`, Lifestyle en Business)

**Doel.** De eigen wijnkelder bijhouden, weten wat op dronk is, en schenkadvies krijgen.

### a. Inventaris
- **Routes:** `/api/member/rechterhand/cellier`, `/zet`, `/weg`, `/schenk` en `/ai`.
- **Stand van een fles:** op dronk, laten liggen, over de top of onbekend.
- **Bewezen:** voltooiproef `cellier.js`. Inschenken is met opzet een teller, dus niet ontdubbeld.
- **Gat:** "een fles laten regelen" heeft geen route; alleen de AI-tekst belooft het.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| CellarTracker | drinkvensters (eigen, community en professioneel), waardering, critici | $40-500 per jaar naar keldergrootte ([CellarTracker](https://support.cellartracker.com/article/25-voluntary-payment)) |
| InVintory Premium | 3D-keldermap, AI-sommelier | $149,99 per jaar (verkopersbron) |
| Vivino Premium | wijnkaartscanner, AI | ongeveer $47,90 per jaar (na te gaan) |

### c. Domein
- **Bewaren:** stabiel 12-14°C, ongeveer 70% luchtvochtigheid, donker en zonder trilling (secundair).
- **Alcoholwet art. 20 en 20a:** de leeftijd wordt gecontroleerd bij verkoop op afstand én bij aflevering ([CBL](https://www.cbl.nl/wp-content/uploads/2024/12/CBL_checklist_nix18_online_2024dec.pdf)).
- **Accijns:** zelf meegebracht voor eigen gebruik is vrijgesteld (richtwaarde 90 liter).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Ce1 | Drinkvenster met bron | L4 | half | Een venster komt van het lid of van een opgegeven bron, met het label erbij. Zonder venster staat er "onbekend", nooit een gok. | K | **A nu** |
| Ce2 | Plek in de kelder (rek, vak) | L1 | ontbreekt | Elke fles heeft een plek, en zoeken op plek werkt. | K | A later |
| Ce3 | Fles bestellen bij een zaak | L2/L6 | ontbreekt (alleen AI-tekst) | Bestellen gaat via een gekeurde wijnzaak (bestaande handel) met een 18+-controle vóór en bij aflevering. Er wordt nooit iets beloofd zonder route. | M | A later |
| Ce4 | AI-tekst eerlijk maken | — | fout (belofte) | De adviseur zegt niet "ik zet klaar" zolang Ce3 niet bestaat. | K | **A nu** |

### g. Prioritering
- **HERSTEL:** Ce4 (de adviseur belooft een fles te regelen zonder route).
- **VERDIEPING (wacht op het akkoord per familie):** Ce1.
- **A later:** Ce2, Ce3.

### Keten "een fles voor zaterdag"
1. Het lid kiest wat op dronk is.
2. Schenkadvies.
3. Inschenken telt af.

**Storing:** model uit: een vaste tekst met `demo:true`.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** kelder bijhouden, schenken en advies (`/api/member/rechterhand/cellier/*`).
- **Noodzakelijke platformdiensten:**
  - account met Lifestyle of Business Pass.
- **Optionele koppelingen:**
  - een model. Uit: een vaste tekst met `demo:true` (bestaat);
  - een wijnzaak (Ce3).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:cellier': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:cellier': { uitgeeft: ['cellier.fles'], ontvangt: [], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'leven', naam: 'fles-naar-zaak', laag: 'kern', ontbreekt: 'keten', k: 'Ce3', kaart: KAART_LIVA,
  wat: 'een fles bestellen bij een gekeurde wijnzaak met 18+-controle' }
```

**Volledige werkzaamheid.** Het lid beheert hier zijn kelder. Buiten RTG blijft nodig: een wijnhandel voor aankoop en CellarTracker voor scores van critici.

---

## 19. Garderobe (`link:garderobe`, eigenaar `leven.garderobe`, Lifestyle en Business)

**Doel.** De eigen garderobe bijhouden, de vaklui kennen (kleermaker, schoenmaker) en de stylist iets vragen.

### a. Inventaris
- **Routes:** `/api/member/rechterhand/garderobe`, `/stuk`, `/vakman` en `/ai`. Er zijn 10 categorieën en 5 vakken.
- **Bewezen:** voltooiproef `garderobe.js`. De vaklui zijn contacten en geen accounts.
- **Gat:** de "persoonlijke stylist" is alleen de AI.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Indyx | menselijke stylist 1:1 vanaf $60, analyses | ([Indyx](https://myindyx.com/), na te gaan) |
| Whering | AI-styling met credits | $1,99-9,99 per credit-bundel (na te gaan) |
| Stylebook | outfits, kalender | $4,99 eenmalig |

### c. Domein
- **Stylist:** een kastaudit (pasvorm, kleur, staat), daarna een boodschappenlijst (secundair).
- **ISO 3758:2023:** onderhoudssymbolen ([ISO](https://www.iso.org/standard/74401.html)).
- **UPV textiel (sinds 1 juli 2023):** 50% hergebruik of recycling in 2025, oplopend tot 75% in 2030 ([consultatie](https://internetconsultatie.nl/upv_textiel/document/7508)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Ga1 | Onderhoudssymbolen per stuk (ISO 3758) | L1 | ontbreekt | Het lid kiest de symbolen. Het stuk toont de wasinstructie, en de stylist leest ze mee. | K | **A nu** |
| Ga2 | Opdracht aan een kleermaker of schoenmaker (vakwerk) | L2/L6 | ontbreekt | Vanuit een stuk vraagt het lid een offerte bij een zaak met het genre vakwerk (verwijzing naar het stuk). De werkbon komt terug. | M | A later |
| Ga3 | Kastaudit | L4 | ontbreekt | Per stuk de staat en het laatste gebruik. Stukken die een jaar niet gedragen zijn, staan in een lijst met de opties herstel, verkoop en inzameling. | M | A later |
| Ga4 | Een menselijke stylist (Lifestyle-concierge) | L2 | ontbreekt | — | M | B, besluit (rol of genre) |

### g. Prioritering
- **HERSTEL:** geen gemeten fout.
- **VERDIEPING (wacht op het akkoord per familie):** Ga1.
- **A later:** Ga2, Ga3.
- **B:** Ga4.

### Keten "het jasje laten herstellen"
1. Stuk.
2. Offerte bij een kleermaker (Ga2).
3. Werkbon.
4. Terug in de garderobe.

**Storing:** vakwerk uit: het stuk krijgt het label "herstel aangevraagd, status niet te zien".

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** stukken, vaklui als contact, en de stylist (`/api/member/rechterhand/garderobe/*`).
- **Noodzakelijke platformdiensten:**
  - account met Lifestyle of Business Pass.
- **Optionele koppelingen:**
  - een model voor de stylist. Uit: een vaste tekst;
  - vakwerk (Ga2). Uit: "herstel aangevraagd, status niet te zien".

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:garderobe': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:garderobe': { uitgeeft: ['garderobe.stuk'], ontvangt: ['vak.werkbon'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'leven', naam: 'stuk-naar-vakman', laag: 'kern', ontbreekt: 'keten', k: 'Ga2', kaart: KAART_LIVA,
  wat: 'een offerte bij een kleermaker of schoenmaker met een verwijzing naar het stuk' }
```

**Volledige werkzaamheid.** Het lid beheert hier zijn garderobe. Buiten RTG blijft nodig: de telefoon met de kleermaker, zolang Ga2 niet bestaat.

---

## 20. Maison (`link:maison`, eigenaar `woning.huishouden`, Lifestyle en Business)

**Doel.** Een Lifestyle-lid beheert zijn huishouden: personeel, taken en het logboek van het huis.

### a. Inventaris
- **Routes:** `/api/member/rechterhand/maison`, `/staf`, `/taak`, `/taak/klaar`, `/log` en `/ai`.
- **Bewezen:** voltooiproef `maison.js`.
- **Gat:** het personeel heeft geen account en ontvangt niets; "via de huismeester" is alleen de AI.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Nines | huishoud-OS voor family offices: panden, personeel, HR, NDA | per pand, niet openbaar ([Wealth Mosaic](https://www.thewealthmosaic.com/vendors/nines/nines)) |
| EstateSpace | planning, onderhoud, bezittingen | $22-34 per gebruiker per maand (na te gaan) |

### c. Domein
- **Regeling dienstverlening aan huis:**
  - minder dan 4 dagen per week per particulier;
  - minimumloon plus 8% vakantiegeld;
  - bij ziekte maximaal 6 weken doorbetalen (art. 7:629 BW);
  - vanaf 4 dagen gewoon werkgeverschap.
  - Bron: [Rijksoverheid](https://www.rijksoverheid.nl/onderwerpen/dienstverlening-aan-huis/vraag-en-antwoord/ik-doe-huishoudelijk-werk-voor-iemand.-wat-kan-ik-afspreken).
- **Praktijk:** een huishoudhandboek voor continuïteit; de household of estate manager doet administratie en HR.

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| M1 | Dagen per medewerker met de grens van de regeling | L2 | ontbreekt | Per medewerker de dagen per week. Bij 4 of meer staat er "volgens de regeling (te controleren) is dit gewoon werkgeverschap", met de bron, als uitleg en niet als oordeel. | K | **A nu** |
| M2 | Taak voor een medewerker die zelf RTG-lid is | L3/L6 | ontbreekt | Is de medewerker lid en gekoppeld met zijn toestemming, dan ziet hij zijn taken en vinkt hij ze af. Een niet-lid blijft een notitie. | M | A later |
| M3 | Huishoudhandboek | L1 | ontbreekt | Vaste routines per ruimte (verwijzing naar Wonen W1). Een document te delen met nieuw personeel, met een einddatum. | M | A later |
| M4 | Loon via Geld (wbw of Pay) | L6 | ontbreekt | — | M | B, eigenaar Geld; werkgeverschap vraagt een besluit |

### g. Prioritering
- **HERSTEL:** geen gemeten fout; het label "Vraag de huismeester" (`maison.html:86`) is een AI-adviseur, en de kaart noemt dat zo.
- **VERDIEPING (wacht op het akkoord per familie):** M1.
- **A later:** M2, M3.
- **B:** M4.

### Keten "de week van het huis"
1. Taken plannen.
2. De medewerker vinkt af (M2).
3. Het log.
4. Het onderhoud van een installatie gaat als verwijzing naar Wonen.

**Storing:** Wonen uit: de taak blijft staan zonder de installatiekoppeling.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** staf, taken, taak klaar, log en advies (`/api/member/rechterhand/maison/*`).
- **Noodzakelijke platformdiensten:**
  - account met Lifestyle of Business Pass.
- **Optionele koppelingen:**
  - een model. Uit: een vaste tekst;
  - Wonen (installaties, M3). Uit: de taak blijft zonder installatiekoppeling;
  - Geld (M4).

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:maison': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:maison': { uitgeeft: ['maison.taak'], ontvangt: ['woning.installatie'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'huishouden', naam: 'taak-naar-medewerker', laag: 'kern', ontbreekt: 'keten', k: 'M2', kaart: KAART_LIVA,
  wat: 'een medewerker die lid is ziet zijn taken en vinkt ze af' },
{ familie: 'wonen', naam: 'taak-naar-installatie', laag: 'kern', ontbreekt: 'keten', k: 'M3', kaart: KAART_LIVA,
  wat: 'een onderhoudstaak verwijst naar een installatie in Wonen' }
```

**Volledige werkzaamheid.** Het lid plant hier het huishouden. Het personeel ontvangt hier niets. Daarvoor blijft nodig: WhatsApp met het personeel en een loonadministratie (wbw) zolang M2 en M4 niet bestaan.

---

## 21. Entourage (`link:entourage`, eigenaar `leven.entourage`, Lifestyle en Business)

**Doel.** De mensen om het lid heen en hun reisdocumenten bijhouden, en een reisgezelschap samenstellen dat klaar is om te gaan.

### a. Inventaris
- **Routes:** `/api/member/rechterhand/entourage`, `/persoon`, `/doc` en `/gezelschap`.
- **Banden:** partner, familie, vriend, zakelijk, kind en overig.
- **Documenten:** paspoort, visum, rijbewijs, verzekering, vaccinatie en overig.
- **Waarschuwing:** 90 dagen vooraf. `gezelschap` geeft `gereed` met wat ontbreekt.
- **Bewezen:** voltooiproef `entourage.js`. Inreisvereisten worden met opzet niet beloofd.
- **Gaten:**
  - de personen zijn geen accounts en zien niets;
  - het doel noemt "dienstverleners", maar die band bestaat niet;
  - de AI-context noemt alleen paspoorten.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| TripIt Pro | alerts, hulp bij verstoringen | $49 per jaar (na te gaan) |
| 1Password Families | gedeelde kluis voor documenten, 5 personen | $71,88 per jaar ([TidBITS](https://tidbits.com/?p=73397)) |

### c. Domein
- **Schengengrenscode art. 6:** voor derdelanders 3 maanden geldig na vertrek. Veel landen vragen 6 maanden ([Rijksoverheid](https://www.rijksoverheid.nl/onderwerpen/paspoort-en-identiteitskaart/vraag-en-antwoord/moet-ik-mijn-paspoort-of-identiteitskaart-meenemen-tijdens-reizen-naar-het-buitenland)).
- **ETIAS:** €20; de start is niet officieel bevestigd ([Commissie](https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/european-travel-information-authorisation-system_en)).
- **Minderjarigen:** een toestemmingsformulier per kind, sterk aanbevolen ([Rijksoverheid](https://www.rijksoverheid.nl/onderwerpen/reizen-met-kinderen/documenten/formulieren/2014/02/06/formulier-toestemming-reizen-met-minderjarige-naar-het-buitenland)).
- **AVG art. 14:** informatieplicht voor gegevens van derden. Dat geldt voor RTG als platform, eigen lezing, na te gaan.

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| E1 | Geldigheid tegen de reis | L4/L6 | half (90 dagen) | Bij een reis uit TravelOS (verwijzing) toetst Entourage "nog 6 maanden geldig na terugkeer" als algemene regel. Er staat bij "check de eisen van het land", zonder belofte per land. | M | **A nu** |
| E2 | Toestemmingsformulier voor een minderjarige | L2 | ontbreekt | Reist een kind mee zonder beide gezaghebbers, dan meldt het gezelschap "toestemmingsformulier aanbevolen" met de link naar de Rijksoverheid. | K | **A nu** |
| E3 | Gegevens van derden: informatieplicht | L3 | ontbreekt | Bij het toevoegen van een persoon vraagt de app of die persoon op de hoogte is. Wissen per persoon wist ook de documenten. | K | **A nu** |
| E4 | Gezelschapslid dat zelf lid is, ziet zijn eigen deel | L3/L6 | ontbreekt | Met zijn toestemming ziet een gekoppeld lid de reis en zijn eigen documentstatus, en niets van de anderen. | M | A later |
| E5 | Band "dienstverlener" | L1 | ontbreekt | De band bestaat, zonder documenten. | K | A later |

### g. Prioritering
- **HERSTEL:** het doel in SCHERMEIGENAAR.json:1062 noemt "dienstverleners" terwijl die band niet bestaat (E5 of de doeltekst).
- **VERDIEPING (wacht op het akkoord per familie):** E1, E2, E3.
- **A later:** E4, E5.

### Keten "met z'n vieren naar New York"
1. De reis staat in TravelOS.
2. Het gezelschap.
3. Toets op geldigheid (E1).
4. Het kind heeft een formulier nodig (E2).
5. Gereed.

**Storing:** TravelOS uit: de toets gebruikt de datum die het lid zelf invult, en zegt dat.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** personen, documenten en een gezelschap (`/api/member/rechterhand/entourage/*`).
- **Noodzakelijke platformdiensten:**
  - account met Lifestyle of Business Pass.
- **Optionele koppelingen:**
  - een reis uit TravelOS (E1). Uit: de toets gebruikt de datum die het lid invult, en zegt dat;
  - een model.

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:entourage': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:entourage': { uitgeeft: [], ontvangt: ['reis'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'reis', naam: 'reis-naar-gezelschap', laag: 'scherm', ontbreekt: 'keten', k: 'E1', kaart: KAART_LIVA,
  wat: 'een reis uit /apps/reizen.html (die de soort reis al uitgeeft) is de datum waartegen het gezelschap de documenten toetst' }
```

**Volledige werkzaamheid.** Het lid houdt hier zijn gezelschap reisklaar. Buiten RTG blijft nodig: de gemeente voor een paspoort, visumportalen en straks ETIAS.

---

## 22. Het Vooruitzicht (`link:vooruitzicht` → living-os.html, eigenaar `leven.vooruitzicht`)

**Doel.** Een lid legt een intentie of beslissing vast en ziet vooruit wat er in agenda, geld, reis en veiligheid speelt. Er wordt niets geregeld zonder zijn uitdrukkelijke akkoord.

### a. Inventaris
- **Routes:** `/api/instant-reality`, `/event` en `/partner`. Werelden: ideal, likely en disruption. Statussen: draft, prepared en confirmed.
- **Bronnen:** het scherm leest acht bronnen (bureau, geld, reis, agenda, veiligheid).
- **Gerepareerd** (c2-fase): een provider-gebeurtenis van het lid krijgt 403, en de financiële stand heet niet meer "verified".
- **Bewezen:** voltooiproef `vooruitzicht.js`. Er is geen providerroute.
- **Gaten:**
  - "klaargezet" maakt niets in een andere app;
  - `/partner` geeft de eigen universe terug;
  - `permissions.friends` wordt niet afgedwongen;
  - `beslis` en `vraag` worden nooit aangeroepen;
  - het vraagveld werkt met regex.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Motion | AI-planning van taken en agenda | ongeveer $39-69 per maand (na te gaan) |
| Reclaim.ai | slimme agenda | ongeveer $18 per gebruiker per maand (na te gaan) |
| TripIt Pro | proactieve alerts | $49 per jaar |

Een consumentenproduct met scenario's (ideaal, waarschijnlijk, verstoring) is **niet gevonden**. Dit is een eigen RTG-categorie.

### c. Domein
- **Scenariopraktijk (Oxford, Shell):** plausibele werelden, geen voorspellingen, geen kansen ([MIT Sloan](https://www.sloanreview.mit.edu/article/using-scenario-planning-to-reshape-strategy)).
- **AVG art. 22:** betekenisvolle menselijke tussenkomst bij een aanmerkelijk effect.
- **Richtlijn consumentenrechten art. 22:** geen afgeleide extra betalingen en geen vooraf aangevinkte vakjes.
- **Pakketreisrichtlijn:** een gekoppeld reisarrangement vraagt informatie vooraf.

### d. Catalogus, volledig formaat

Dezelfde acht velden als Wonen 1d. De acceptatie wordt een stap in `scripts/lib/voltooi/vooruitzicht.js` of een toets naast `test/instant-reality-partner.test.js`. Het Vooruitzicht bezit alleen de intentie en haar gebeurtenissen (`kern/instant-reality.js`, eigencollectie `instantReality`). Alles wat het toont van agenda, geld, reis, bureau en veiligheid leest het scherm bij de eigenaar (`living-os-data.js`: `/api/agenda/bereik`, `/api/geld/cockpit`, `/api/reis/wereld`, `/api/member/bureau/*`, `/api/veiligheid/moment`).

**Vz1 · Vrijgeven wordt een voorstel in de eigenaar-app · L6 · ontbreekt · M · VERDIEPING**
- **Gegevens en bron:** de intentie (`intent`, hooguit 300 tekens) en de gebeurtenis `preparation.authorized`, die alleen `state:'prepared'` zet.
- **Regel:** "Voorbereiding vrijgeven" maakt vandaag in geen enkele andere app iets, en het scherm zegt dat ook eerlijk ("VOORBEREIDING VRIJGEGEVEN", providers "lokaal concept"; `living-os-view.js:30, :98`). Nagemeten: geen herstel nodig. De verdieping: vrijgeven maakt in Agenda, Geld en reis een concept met een verwijzing naar de intentie (`soort:'vooruitzicht.intentie'`). Niets is bindend of betaald tot het lid het in die app bevestigt.
- **Rekenwijze:** —
- **Onzekerheid:** een concept heet in elke app "voorstel uit het Vooruitzicht", nooit "gepland" of "gereserveerd".
- **Wanneer iemand iets hoort:** het lid ziet per app "voorstel klaar" of "niet klaargezet: <app> nu niet bereikbaar".
- **Rollen en toestemming:** alleen het lid. Geen vooraf aangevinkte keuzes (Richtlijn consumentenrechten art. 22; te controleren, zie onderaan).
- **Uitzonderingen:** valt een app uit, dan gaat de rest door en noemt het scherm wat ontbreekt.
- **Acceptatie:** na vrijgeven staat er in de agenda een concept met de verwijzing; zonder bevestiging in de agenda blijft het concept; Geld uit geeft "niet klaargezet" voor geld.

**Vz2 · Drie werelden zonder kansen · L4 · half · K · VERDIEPING**
- **Gegevens en bron:** de gekozen wereld (`ideal`, `likely`, `disruption`) en de bronnen van het scherm.
- **Regel:** scenario's tonen gevolgen, geen percentages (scenariopraktijk; te controleren). Elk gevolg noemt zijn bron (een app) of "aanname van het lid".
- **Rekenwijze:** geen kansberekening; een gevolg is een regel uit een bron of een invoer van het lid.
- **Onzekerheid:** het scherm toont "GEEN AANNAMES" alleen als er geen aanname in staat; anders "1 aanname van u".
- **Wanneer iemand iets hoort:** —
- **Rollen:** het lid.
- **Uitzonderingen:** zonder bronnen toont elke wereld "nog geen route" (bestaat).
- **Acceptatie:** geen tekst op het scherm bevat een percentage of het woord "kans"; elk gevolg heeft een bronlabel.

**Vz3 · Vrienden-toestemming afdwingen · L3 · gerepareerd (2f7a65c58) · K · HERSTEL, af**
- **Gegevens en bron:** `permissions.friends` met de bekende waarden `own_share` en `itinerary`, gezet met de gebeurtenis `permissions.friends`.
- **Regel:** `itinerary` geeft de partner aankomstvenster en providers, `own_share` de betaalgarantie. Onbekende waarden vallen weg.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** de eigenaar zet; de partner kan het niet ruimer maken.
- **Uitzonderingen:** —
- **Acceptatie:** `test/instant-reality-partner.test.js`, toets 3.

**Vz4 · `/partner` laat de echte partner zien · L3 · gerepareerd (2f7a65c58) · M · HERSTEL, af**
- **Gegevens en bron:** de wereld van de eigenaar, in partnervorm (`instantPartnerVan`), zonder de intentie zelf.
- **Regel:** met `van` alleen bij een bevestigde levensband en een deling van "afspraken" (`levensband.inzageMag`). Anders 403, ook voor een onbekende codenaam. Een lezing maakt geen wereld aan voor de eigenaar.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** de eigenaar deelt via Leven (`/api/leven/deel/zet`) en trekt in met `/deel/in`.
- **Uitzonderingen:** zonder `van` is het de eigen voorvertoning.
- **Acceptatie:** `test/instant-reality-partner.test.js`, vier toetsen.

**Vz5 · Verstoring van een provider (vlucht vertraagd) · L6 · ontbreekt (geen providerroute) · G · B**
Zie het B-proces hieronder.

**Vz6 · Toestemming en partnerweergave op het scherm · L3 · ontbreekt · K · VERDIEPING**
- **Gegevens en bron:** dezelfde als Vz3 en Vz4. `living-os.js` roept `/partner` en de gebeurtenis `permissions.friends` niet aan; de rij "Gegevensdeling" zegt altijd "Nog geen toestemming toegepast".
- **Regel:** het lid kiest per stuk (reisplan, betaalgarantie) en ziet "zo ziet uw partner het".
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** het lid.
- **Uitzonderingen:** zonder bevestigde levensband zegt het scherm "u deelt met niemand" en verwijst naar Leven.
- **Acceptatie:** uitzetten van "reisplan" laat de providers verdwijnen uit de voorvertoning op het scherm.

**Vz7 · Vragen en beslissen via het vraagveld · L4 · half (regex) · M · later**
- **Gegevens en bron:** het vraagveld (`loInput`) en `/api/member/bureau/zaak/beslis`.
- **Regel:** het vraagveld herkent nu met patronen; een vraag die het niet herkent, krijgt al "Deze vraag is niet uitgevoerd" (`living-os.js:137`), nooit een verzonnen antwoord. De verdieping: beslissen over een concreet voorstel van het bureau vanuit het vraagveld.
- **Rekenwijze / Onzekerheid:** —
- **Wanneer iemand iets hoort:** —
- **Rollen:** het lid; een besluit buiten mandaat gaat naar een mens (Privékantoor).
- **Uitzonderingen:** zonder model blijft de patroonherkenning.
- **Acceptatie:** een onbekende vraag blijft "niet uitgevoerd"; een besluit verschijnt in het bureau van het lid.

**B-proces Vz5: een echte verstoring van een provider.**
1. **Provider (hotel, vervoerder; via TravelOS):** meldt een vertraging via een providerroute met handtekening. Die route bestaat niet; een gebeurtenis van het lid zelf krijgt 403 (bestaat).
2. **TravelOS (eigenaar van de reis):** zet de vertraging in de reiswereld en geeft een verwijzing uit.
3. **Vooruitzicht:** ontvangt de verwijzing, zet de wereld op "verstoring" en toont het nieuwe aankomstvenster met de bron.
4. **Lid:** kiest een herstelvoorstel; het wordt een concept in de eigenaar-app (Vz1).
5. **Partner (met deling):** ziet het nieuwe venster als `itinerary` gedeeld is.
- **Nodig:** de providerroute en het handtekeningmodel (TravelOS en Geld), en een besluit welke provider mag melden.

### e. RTG-exclusief
Eén intentie die zichtbaar wordt in de agenda, het geld, de reis en de veiligheid van dezelfde persoon, als voorstel in elke eigenaar-app. Er is geen centrale planner die iets bezit.

### g. Prioritering
- **HERSTEL:** Vz3 en Vz4 zijn af (2f7a65c58); nagemeten: het scherm zegt al eerlijk "voorbereiding vrijgegeven".
- **VERDIEPING (wacht op het akkoord per familie):** Vz2, Vz6, Vz1.
- **A later:** Vz4.
- **B:** Vz5.

### Keten "ik verhuis in maart"
1. De intentie.
2. Agenda-concepten (Vz1).
3. De verhuischecklist van Wonen (W19) als voorstel.
4. Een reservering in Geld als voorstel.
5. Het lid bevestigt elk voorstel in de eigen app.

**Storing:** Geld uit: dat deel staat er als "niet klaargezet". De rest gaat door.

### i. LOS, SAMEN en volledige werkzaamheid

**LOS.** Wat de app alleen doet, wat hij van het platform nodig heeft, en wat hij optioneel koppelt. Bij een dienst die uitvalt staat de schermtekst erbij; "(bestaat)" betekent dat het scherm hem vandaag al zo zegt.

- **Eigen functies:** intentie, werelden, vrijgeven (`/api/instant-reality`, `/event`, `/partner`).
- **Noodzakelijke platformdiensten:**
  - account en sessie.
- **Optionele koppelingen:**
  - de acht bronnen van het scherm: bureau, Geld, reis, Agenda en Veiligheid. Een bron uit: "<bron> nu niet te zien";
  - Leven (levensband) voor de partnerweergave.

**SAMEN** in de velden van `scripts/lib/appcontract.js` (modus SAMEN, families en ONTBREKEND, op de tak `appwerkt/versheid`). Leeg is eerlijk "niet verbonden", nooit "bewezen".

```js
'link:vooruitzicht': { uitgeeft: [], ontvangt: [], ketens: [] }
```

Het doel, zodra de ketens met proef bestaan (een verklaring, nog geen uitslag):

```js
'link:vooruitzicht': { uitgeeft: ['vooruitzicht.intentie'], ontvangt: ['reis', 'afspraak'], ketens: [] }
```

ONTBREKEND:

```js
{ familie: 'leven', naam: 'intentie-naar-concept', laag: 'kern', ontbreekt: 'keten', k: 'Vz1', kaart: KAART_LIVA,
  wat: 'vrijgeven maakt een concept in Agenda, Geld en reis met een verwijzing naar de intentie' },
{ familie: 'reis', naam: 'verstoring-naar-vooruitzicht', laag: 'kern', ontbreekt: 'keten', k: 'Vz5', kaart: KAART_LIVA,
  wat: 'een providerverstoring uit TravelOS zet de wereld op verstoring' }
```

**Volledige werkzaamheid.** Het lid denkt hier vooruit en geeft vrij. Uitvoeren gebeurt in de eigen apps, en buiten RTG bij hotel en vervoerder zolang er geen providerroute is (Vz5).

---

## Samenvatting voor Centraal

**Reparaties na het akkoord van 19 oktober** (failing-first, één commit per fout, tak `appwerkt/living-a`):
- **Vooruitzicht** (bevoegdheid, eerst): `/partner` met `van` vraagt een bevestigde levensband en een deling van "afspraken"; `permissions.friends` bepaalt de velden. Toets `test/instant-reality-partner.test.js`.
- **Bellen:** het signaal `tekst` staat in de lijst. Toets `test/bellen-tekst.test.js`.
- **Gezin:** chat en antwoord gaan naar het gekozen gezin. Toets `test/gezin-keuze.e2e.js`.
- **Assets:** een mislukte betaling bij de wachtlijstoverdracht of terugkoop wordt gemeld en laat het verzoek open. Toetsen in `test/assets.test.js`. Bedragen boven het plafond van €5000 per boeking vragen de bankrail (Geld en eigenaar).
- **Krant:** assist loopt via de lokaal-eerst-keten en vraagt een sessie. Toets `test/journalistiek-assist.test.js`.
- **Podium:** de tekst zegt dat alleen de zone 'beperkt' 18+ is. Toets `test/podium-leeftijdtekst.test.js`.
- **SCHERMEIGENAAR:** doelen van thuis, leven en onderhoud rechtgezet. Toets `test/schermeigenaar-doelen-livinga.test.js`.
- **Logeren:** de teksten beloven geen betaling meer; de uitbetaling heeft status `buiten-rtg`. Toets `test/thuis-betaaltekst.test.js`. Het betalen zelf en de hostmelding wachten op de toezegging.
- **Vonk:** geen fout, zie Vo4.
- **Camera:** gemeld, niet omgebouwd (C5).

**Herstel van de kaart na het oordeel "DEELS" (19 oktober, avond).**
- Veilig, Gezin, Assets en het Vooruitzicht staan in het volledige formaat van Wonen 1d, met elke B als proces met stappen en rollen.
- Logeren is een verwijzing naar travelos.md 3.6 geworden.
- Elke app heeft een sectie i: LOS in drie groepen met schermtekst, SAMEN in de velden van appcontract.js met FAMILIES en ONTBREKEND, en een regel volledige werkzaamheid. Ik stel acht families voor: `wonen`, `veiligheid`, `gesprek`, `gezin`, `huishouden`, `ontmoeten`, `media` en `leven`; Assets valt onder `geld`, Entourage onder `reis`. Vandaag is geen enkele app van LivingOS-A verbonden.
- "Aanbevolen nu" is overal gesplitst in HERSTEL en VERDIEPING.
- Wets- en marktregels uit zoekfragmenten staan onderaan in "Te controleren". Ze sturen geen weigerregel en geen uitkomst `bepaald`. Twee criteria zijn daarop aangepast: Spelavond S2 en Maison M1.

**Nieuw HERSTEL, gevonden bij het nameten (niets gebouwd):**
- **Veilig V2:** het lid kan een alarm niet zelf afsluiten op het scherm (de route bestaat).
- **Veilig V5:** `safety.incident.started` wordt gelezen en verklaard, maar nergens gepubliceerd.
- **Veilig V10:** een mislukte e-mail telt in de bevestiging toch als gewaarschuwd.
- **Assets A4:** de melding na het boeken belooft "het team neemt vooraf contact op" zonder taak.
- **Assets A8:** een open uitbetaling (sinds 5e04dc5b6 vastgelegd) heeft nog geen kantoorscherm.
- **Camera:** "Opgeslagen op volle resolutie" en "Deze mag de Salon in" bij een download zonder Salon-route.
- **App-dossier D1:** de routes voor intrekken bestaan, het scherm roept ze niet aan.
- **Entourage:** het doel noemt "dienstverleners", de band bestaat niet.
- **Gezin G7 (vraag, geen herstel):** elke gekoppelde gast ziet de precieze plek van elk gezinslid dat zijn plek deelt, ook buiten een oppasbeurt. Dat is aan het gezin en FoundationOS.
- **Nagemeten, geen fout:** het Vooruitzicht zegt al eerlijk "voorbereiding vrijgegeven".

**Fouten in de code, gevonden met de inventaris** (de oorspronkelijke lijst):
- **Bellen:** het signaal `tekst` geeft 400 en de fout wordt geslikt.
- **Gezin:** alleen het eerste gezin, `g[0]`.
- **Assets:** stille fout bij een wachtlijstoverdracht.
- **Vonk:** `commitmentId` staat op null.
- **Krant:** assist krijgt de lokaal-eerst-keten niet.
- **Camera:** spraak gaat via de cloud van de browser.
- **Podium:** de 18+-tekst klopt niet.
- **Logeren:**
  - betalen, terugbetalen en uitbetalen gebeurt alleen in tekst;
  - de host krijgt geen melding.
- **Vooruitzicht:** de vriendentoestemming en `/partner` werken niet zoals beloofd.
- **SCHERMEIGENAAR-doelen kloppen niet:** Logeren r.2510, Leven r.1884, en onderhoud r.2146 (Wonen W3).

**Juridisch, vraagt besluit** (alle regels hieronder zijn "te controleren"):
- **Assets:** een verbod op vooruitbetaling binnen de bedenktijd, als de timesharerichtlijn van toepassing is. Daarnaast de prospectusvrijstelling en het beleggingsobject.
- **Podium en Theater:** PSD2 voor cadeaus en betaalde abonnementen; de CvdM-registratie.
- **Logeren:** de gegevensplicht uit verordening 2024/1028.
- **Bestellen:** alcohol, als dat verkocht wordt.

---

## Te controleren: wets- en marktregels uit zoekfragmenten

Elke regel hieronder heb ik gevonden met een zoekopdracht op 19 oktober 2026. Ik heb de wettekst of de officiële bron niet zelf volledig gelezen, of de bron is secundair. Daarom geldt voor elke regel:
- hij krijgt het label **te controleren**;
- hij stuurt **geen weigerregel**: een scherm weigert niets omdat deze regel het zou eisen;
- hij levert **nooit de klasse `bepaald`** (`kern/fiscaal/zekerheid.js`). Hooguit `uitlegbaar`, en dan als uitleg met de bron erbij.

Waar een scherm wél iets weigert, is dat een **huisregel van RTG** die zelf in de code staat (`volwassen()`, `progressieMag`, de bevoegdheidspoorten). Het scherm noemt dan de huisregel en geen wetsartikel.

| Regel | Bron (soort) | Gebruikt in | Mag | Mag niet |
|---|---|---|---|---|
| Rookmelder op elke verdieping in de vluchtroute (Bouwbesluit 2012 art. 6.21 lid 6) | makelaar (secundair) | Wonen W18 | uitleg "volgens de regel hoort hier een rookmelder" | een woning afkeuren |
| Gasinstallatie eens per 2 jaar laten controleren | Rijksoverheid, advies | Wonen W2 | een adviesdatum met bron | een datum als "verplicht" tonen |
| Energielabel 10 jaar geldig | Rijksoverheid | Wonen W11 | "geldig tot" als uitleg | een verkoopketen tegenhouden |
| Alleen CO-vrij gecertificeerde bedrijven aan cv-ketels (sinds april 2023) | consumentenbron | Wonen 1e.2 | een vakbewijs als keuze van het lid | een zaak weigeren zonder besluit over de persoonseis |
| Besluit kleine herstellingen (BW 7:240), herstelplicht verhuurder (BW 7:206) | juridische blog, Staatsblad | Wonen W4 | uitleg wie wat herstelt; het contract gaat voor | een oordeel over wie betaalt |
| Waarborgsom hooguit 2x de kale huur, terug binnen 14 dagen (Wet goed verhuurderschap) | Aedes, Omgevingsweb | Wonen W22 | markering | een contract weigeren |
| VvE-reserve 0,5% van de herbouwwaarde of een MJOP | Eerste Kamer | Wonen W23 | markering | een VvE afkeuren |
| Consumentendossier bij oplevering (BW 7:757a, Wkb) | Kiwa | Wonen W12 | "opgeleverd zonder dossier" vraagt een uitdrukkelijke keuze van het lid | opleveren blokkeren |
| Zonnepanelen bouwtechnisch vergunningvrij (Bbl art. 2.27) | IPLO | Wonen W10 | verwijzen naar de Vergunningcheck | een vergunning beloven of uitsluiten |
| Alarmcentrales gecertificeerd volgens EN 50518 | Kiwa | Veilig V9 | uitleggen dat RTG geen alarmcentrale is | — |
| 112-plicht geldt voor telecomaanbieders, niet voor app-spraak | ACM | Veilig V4, Bellen Be3 | de 112-wegwijzer met `tel:112` | — |
| Toestemming van de ouder onder 16 (AVG art. 8) | tekstsite | Gezin | uitleg | een koppeling weigeren |
| VOG en Personenregister voor gastouders (Wet kinderopvang); geen VOG-plicht gevonden voor een particuliere oppas | kamerstuk; zoekresultaat | Gezin G4 | een wens van de ouder | een oppas weigeren zonder de persoonseis uit G4 |
| Timeshare: 14 dagen bedenktijd en een verbod op vooruitbetaling (BW 7:50a e.v., 7:50i) | kamerstuk | Assets A1, A2 | de vraag aan de jurist | betalen blokkeren vóór het besluit A1 |
| Prospectusvrijstelling tot €12M, Wft-vergunning voor een beleggingsobject | AFM-rapport; bron uit 2014 | Assets A1 | de vraag aan de jurist | een uitkomst `bepaald` |
| DSA art. 16, 17, 22 en 28 | wetteksten op een tekstsite, advocatenkantoor | Berichten B2, Vonk Vo3 | een meldproces met motivering | een automatische straf |
| Opslaan op het toestel alleen met toestemming (Telecommunicatiewet art. 11.7a) | — | Berichten | uitleg | — |
| MDR regel 11 en MDCG 2019-11: informatie voor diagnose is minstens klasse IIa | samenvattingssite | Vandaag Va3, Va6 | de grens "opslaan en tonen, nooit beoordelen" | — |
| Alcohol op afstand: leeftijd vóór aankoop en bij aflevering (Alcoholwet art. 20 en 20a) | Ondernemersplein, CBL | Bestellen Bs3, Cellier Ce3 | `volwassen()` als **huisregel** van RTG, met de tekst "RTG verkoopt alcohol alleen aan leden van 18 jaar en ouder" | "wettelijk verplicht" op het scherm |
| 14 allergenen vóór de aankoop (EU 1169/2011) | — | Bestellen Bs2 | "niet opgegeven door de zaak" | "geen allergenen" |
| Geen herroeping bij snel bederfelijke waar (BW 6:230p) | secundair | Bestellen | uitleg | annuleren weigeren op grond van deze regel |
| Registratie bij het CvdM, Kijkwijzer (NICAM) | na te gaan | Theater T1, T5 | de leeftijd die de **maker** kiest, als huisregel | een registratieplicht vaststellen |
| Ondertitels doorgeven (European Accessibility Act) | advocatenkantoor | Theater T3 | doel | — |
| Vloggers: registratie bij 500.000 volgers en 24 video's per jaar | advocatenkantoor (2022) | Podium | uitleg | een kanaal weigeren |
| PSD2: een platform dat gelden doorbetaalt heeft een vergunning nodig | DNB | Podium P5, Theater T4 | de vraag aan Geld en de jurist | een uitkomst `bepaald` |
| Rectificatie (BW 6:167), Leidraad van de Raad voor de Journalistiek | advocatenkantoor; Leidraad 2019 | Krant K1 | uitleg | — |
| Betaalde lootboxen PEGI 16, vrije chat zonder melden of blokkeren PEGI 18 (vanaf juni 2026) | advocatenkantoor | Spelavond S2, S3 | meten; de uitkomst gaat als besluit naar de eigenaar | vrije chat uitzetten op grond van deze regel |
| Portretrecht (Auteurswet art. 21) | advocatenkantoor | Camera C4 | een vraag "heeft de persoon toestemming?" | iets blokkeren |
| DMA art. 6(4), AVG art. 28, ISO 27001 A.5.19-5.23, toegankelijkheidsverklaring (EAA) | diverse | App-dossier D3, D4 | wat het kantoor vastlegde tonen | een app weigeren |
| Wet toeristische verhuur, verordening 2024/1028, toeristenbelasting (Gemeentewet art. 224), nepreviews | Volkshuisvesting, kamerstuk, ACM | Logeren (nu TravelOS 3.6) | uitleg | een huis offline halen |
| Dataportabiliteit (AVG art. 20), geautomatiseerd besluit (AVG art. 22, UAVG art. 40), EMCC-code | Eerste Kamer, EMCC | Leven L2, L3 | de mentor beslist nooit | — |
| Bewaren van wijn (12-14°C), accijnsvrij meebrengen (richtwaarde 90 liter) | secundair | Cellier | uitleg | — |
| Onderhoudssymbolen (ISO 3758:2023), UPV textiel | ISO, consultatie | Garderobe Ga1, Ga3 | uitleg | — |
| Regeling dienstverlening aan huis: minder dan 4 dagen per week | Rijksoverheid | Maison M1 | uitleg "volgens de regeling (te controleren) is dit bij 4 dagen of meer gewoon werkgeverschap" | een uitkomst `bepaald` over werkgeverschap |
| Paspoort 3 maanden na vertrek (Schengengrenscode art. 6), vaak 6 maanden; ETIAS; toestemmingsformulier voor een minderjarige; informatieplicht derden (AVG art. 14) | Rijksoverheid, Commissie | Entourage E1, E2, E3 | uitleg met "check de eisen van het land" | een reis "niet gereed" noemen op grond van een landregel |
| Geen vooraf aangevinkte vakjes (Richtlijn consumentenrechten art. 22); menselijke tussenkomst (AVG art. 22); informatie vooraf bij een gekoppeld reisarrangement | — | Vooruitzicht Vz1 | ontwerpregel: niets vooraf aangevinkt | — |
| Scenario's zonder kansen (scenariopraktijk Oxford en Shell) | MIT Sloan | Vooruitzicht Vz2 | ontwerpregel | — |
| Alle prijzen in de markttabellen (b) | aanbieders, pers, verkopers | elke app | vergelijking | een eigen prijs of belofte afleiden |
