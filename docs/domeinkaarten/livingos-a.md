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

---

## Werkwijze voor de overige apps

Elke app volgt de vorm van Wonen, compacter:
- a. inventaris (gebouwd en bewezen);
- b. markt (ook het duurste pakket);
- c. domein;
- d. catalogus;
- e. RTG-exclusief;
- f. bouwstenen;
- g. prioritering met uitkomst A en B;
- h. eindcontract.

Per app staat er ook een gebruikersketen met storingen. Elk acceptatiecriterium wordt een stap in de voltooiproef van die app. De bronnen zijn geraadpleegd op 19 oktober 2026; "na te gaan" betekent dat de bron secundair is.

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

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| V1 | Alarmknop op het scherm | L1 | half (`soort:'knop'`) | De knop vraagt één bevestiging, slaat de por over en stuurt de kring een bericht met plek waar dat is toegestaan. Een dubbeltik geeft één alarm. Met een lege kring wordt hij geweigerd met de reden. | K | **A nu** |
| V2 | Alarm afsluiten op het scherm | L5 | half (route bestaat) | Afsluiten meldt elke ontvanger dat het voorbij is. Een tweede keer afsluiten verandert niets. | K | **A nu** |
| V3 | "Voor mij": alarmen die ik als kringlid ontvang | L2/L6 | ontbreekt | B ziet het alarm van A met de toegestane plek, en drukt "ik kom" of "ik bel". A ziet dat. Na afsluiten verdwijnt de plek bij B. | M | **A nu** |
| V4 | 112-wegwijzer | L1 | ontbreekt | Een knop opent de telefoonkiezer met 112 (`tel:112`). RTG belt niet en zegt dat ook. Bij een alarm staat de 112-knop bovenaan. | K | **A nu** |
| V5 | Incident uitgeven aan de werkruimte | L6 | half | Een alarm geeft `safety.incident.started` uit, zonder inhoud, alleen soort en id. Afsluiten geeft het einde. | K | **A nu** |
| V6 | Incidentdossier na afloop | L5 | ontbreekt | Een tijdlijn van wie wat zag en wanneer, alleen voor het lid. Wordt gewist na 90 dagen, gelijk met de plekken. | M | A later |
| V7 | Veiligheidskaart van het huis (Wonen W18) | L6 | ontbreekt | Vanuit Veilig is de kaart van Wonen te zien als verwijzing. Is Wonen uit, dan staat er "kaart nu niet te zien". | K | A later |
| V8 | Vertrouwde contacten uit Instellingen | L6 | ontbreekt | De kring kiest uit de relatie-objecten van Instellingen (naad met Toegang). Er is geen tweede lijst. | M | A later |
| V9 | Doorschakelen naar een gecertificeerde meldkamer (EN 50518) | L2 | ontbreekt | — | G | B, extern contract |

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
- **A nu:** V1, V2, V4, V5 (K) en V3 (M).
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
- **A nu:** B1, B3 (K) en B2 (M).
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
- **A nu:** Be1, Be3 (K) en Be2 (M).
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
- **A nu:** Va1, Va2.
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

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| G1 | Het juiste gezin kiezen (reparatie) | L1 | fout | Wie twee gezinnen volgt, kiest het gezin, en het bericht komt bij dat gezin aan. Getoetst met twee gezinnen. | K | **A nu** |
| G2 | Oppasbeurt in de gezinsagenda | L6 | half (gezinsagenda bestaat) | De ouder plant een oppasbeurt, en de oppas ziet hem in zijn eigen agenda als verwijzing. | M | A later |
| G3 | Aankomst en vertrek van de oppas | L5 | ontbreekt | De oppas tikt "ik ben er" en "ik ga". De ouder krijgt een melding, zonder plek tenzij hij die vraagt. | M | A later |
| G4 | VOG op verzoek van de ouder | L2 | ontbreekt | — | M | B, vraagt besluit: persoonseis "oppas" (kern/persoonseis.js); RTG valideert niets inhoudelijk |
| G5 | Oppas betalen | L6 | ontbreekt | — | M | B, eigenaar Geld |

### e. RTG-exclusief
- De oppas is een gekeurd RTG-lid, met een eenmalige uitnodiging en een verloop van 12 uur.
- De gezinsinfo blijft van het gezin; de oppas ziet alleen wat het gezin hem toevertrouwt.

### f. Bouwstenen
foundation/gasten (koppeling, gezinsuitnodiging, gezinsagenda), pushHook en persoonseis.

### g. Prioritering
- **A nu:** G1.
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
- **A nu:** Bs1 (K) en Bs2 (M).
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

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| A1 | Juridische toets timeshare en Wft | — | ontbreekt | — | — | **vraagt besluit** (eigenaar, Geld, juridisch) |
| A2 | Betaling pas na de bedenktijd, of in bewaring | L5 | ontbreekt | Hangt af van A1. Binnen 14 dagen na akkoord kan er niet betaald worden, of het geld blijft in bewaring tot dag 15. Herroepen binnen de termijn kost niets. | M | A, na A1 |
| A3 | Wachtlijstoverdracht niet stil laten falen (reparatie) | L5 | fout | Weigert `pay.huisIn` of `huisUit`, dan gaat de overdracht niet door en zegt het scherm waarom. Er wordt geen ticket overgezet zonder geld. | K | **A nu** |
| A4 | Geboekte dag naar Agenda, met een taak voor het team | L6 | ontbreekt | De dag staat in de agenda van het lid (verwijzing), en het kantoor ziet een open taak. Is de Agenda uit, dan blijft de boeking staan met de melding. | M | **A nu** |
| A5 | Servicefee in de verplichtingenkalender van Geld | L6 | half | Geld toont bedrag, vervaldag en ticket-id. Betalen gaat via betaalWaarheid. Er wordt nooit automatisch afgeschreven. | K | A later (Geld) |
| A6 | Dagen ruilen tussen poolleden | L3 | ontbreekt | Twee leden ruilen een dag met allebei een akkoord. Een gemiste bevestiging betekent geen ruil. | M | B |

### e. RTG-exclusief
Een mens op naam keurt, betaald heet pas betaald, en de dag staat in dezelfde agenda als de reis van TravelOS. Zo zijn het een gebruiksrecht en een reis, niet twee losse dingen.

### g. Prioritering
- **Eerst A1 (besluit).**
- **A nu:** A3 (K, reparatie) en A4 (M).
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
- **A nu:** Vo1, Vo2 en Vo3 (M). Vo4 vervalt: geen fout.
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
- **A nu:** T3 (K) en T1 (M).
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
- **A nu:** P1 (K) en P2 (M).
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
- **A nu:** K1, K2, K3 (K).
- **A later:** K4, K5.

### Keten "een fout in een artikel"
1. Een lezer meldt de fout (K4).
2. De redactie corrigeert (K1).
3. De correctie staat boven het artikel.
4. De lezer hoort het.

**Storing:** redactie uit: lezen werkt door; de melding blijft "ontvangen".

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
| S2 | Melden en blokkeren in de spelchat | L2 | onbekend | Spelchat heeft melden en blokkeren (de PEGI-grens). Ontbreekt dat, dan geen vrije chat. | K | **A nu** (eerst meten) |
| S3 | Geen lootboxen of geldprijzen | — | bestaat (niet gebouwd) | Een toets die vastlegt dat geen spelroute geld uitkeert of een willekeurige betaalde beloning geeft. | K | **A nu** |

### g. Prioritering
- **A nu:** S2, S3.
- **A later:** S1.

### Keten "spelavond"
1. Plannen (S1).
2. Starten op de telefoon.
3. Koppelen met de tv-code.
4. Spelen.
5. Afsluiten.

**Storing:** de tv valt weg: het potje gaat door op de telefoon, en opnieuw koppelen kan met een nieuwe code.

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
- **A nu:** C2 (K), C1 en C5 (M).
- **A later:** C3, C4.

### Keten "foto voor de Salon"
1. Maken.
2. Afwerken.
3. Bewaren in de kluis (C1, zonder GPS: C2).
4. Plaatsen in de Salon (C3).

**Storing:** kluis uit: een download met de melding; de Salon krijgt niets zonder bestand.

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
- **A nu:** D2 (K) en D1 (M).
- **A later:** D3, D4, D5.

### Keten "ik stop met een app"
1. Het dossier openen.
2. De machtiging intrekken.
3. De app krijgt 403.
4. Alles vernietigen.
5. Er is niets meer in de opslag.

**Storing:** de app-dienst is uit: intrekken werkt toch, want de machtiging staat bij RTG en niet bij de app.

---

## 16. Logeren bij leden (`link:huis` → thuis.html, eigenaar `verblijf.logeren-bij-leden`)

**Productindeling.** Het eigenaarsbesluit van 19 oktober zet Logeren in de productindeling onder TravelOS. Het eigenaarschap blijft hier.

**Doel.** Een lid zet zijn huis open voor andere leden. Een ander lid vindt het, vraagt aan, logeert en geeft een review. De host beslist, en betaald heet pas betaald.

### a. Inventaris
- **Routes:** `/api/thuis/*` (zoek, detail, boek met idem, beslis, annuleer, checkin, checkuit, review, bericht, huis met idem, cohost, prijsadvies, zakelijk).
- **Statussen:** aangevraagd of bevestigd (instant), afgewezen, geannuleerd, ingecheckt en uitgecheckt.
- **Deurcode:** alleen voor de gast, vanaf 3 dagen vóór aankomst.
- **Bewezen:** voltooiproef `huis.js` (herhaalsleutels op boek en huis gerepareerd).
- **Gaten:**
  - SCHERMEIGENAAR r.2510 beschrijft een ander product ("woning-gerelateerde diensten");
  - de boeking zegt "betaling loopt via RTG Pay bij bevestiging", maar `beslis` zet alleen de status;
  - `terugPct` wordt alleen vastgelegd, er gaat geen geld terug;
  - de uitbetaling blijft "gepland";
  - de host krijgt geen melding van een aanvraag.

### b. Markt
| Aanbieder | Topfunctie | Prijs en bron |
|---|---|---|
| Airbnb Luxe | gekeurd huis, een vaste Trip Designer | host-fee 15,5% ([Airbnb](https://www.airbnb.ca/help/article/3301); het Luxe-tarief is na te gaan) |
| Plum Guide | gecureerd | 16,5% host-only, of 3% plus 12% voor de gast, plus €300 onboarding ([Plum Guide](https://help.plumguide.com/en/articles/4684372-plum-guide-fees)) |
| Booking.com / Vrbo | groot bereik | 15-18% / 5% plus 3% (na te gaan) |

### c. Domein
- **Wet toeristische verhuur van woonruimte:** de gemeente kan een registratienummer, een meldplicht en een nachtenplafond eisen. Boetes tot €8.700 en €21.750 ([Volkshuisvesting](https://www.volkshuisvestingnederland.nl/onderwerpen/toeristische-verhuur/veelgestelde-vragen-toeristische-verhuur)).
- **EU-verordening 2024/1028 (sinds 20 mei 2026):** registratie en een plicht voor platforms om gegevens te delen ([kamerstuk 36904](https://zoek.officielebekendmakingen.nl/kst-36904-3.pdf)).
- **Toeristenbelasting (Gemeentewet art. 224):** de verhuurder is plichtig en houdt een nachtregister bij.
- **Nepreviews:** verboden sinds 28 mei 2022 ([ACM](https://www.acm.nl/nl/publicaties/acm-pakt-handel-nepreviews-en-neplikes-aan)).

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| H1 | Betalen via betaalWaarheid na bevestiging | L6 | ontbreekt (alleen tekst) | Na de bevestiging van de host betaalt de gast via betaalWaarheid (soort `thuis-boeking`). Zonder bevestigde betaling geen deurcode en geen check-in. Bij een weigering volgt "niet betaald". | M | **A nu** (met Geld) |
| H2 | Annuleren met echte terugbetaling | L5 | ontbreekt (`terugPct` registratief) | Annuleren volgens het beleid start `terugbetalen`. Het scherm zegt pas "terugbetaald" als dat bevestigd is. | M | A nu, na H1 |
| H3 | Melding aan de host bij een aanvraag | L1 | ontbreekt | Elke aanvraag geeft de host een melding met de datums. Een tweede aanvraag met dezelfde sleutel geeft geen tweede melding. | K | **A nu** |
| H4 | Registratienummer en nachtenteller | L2 | ontbreekt | De host vult het registratienummer van zijn gemeente in. Zonder nummer gaat het huis niet live, als de gemeente het eist (vastgelegd door de host, RTG valideert niet). De teller toont de nachten per jaar. Boven het plafond dat de host opgaf, sluit de kalender. | M | A later |
| H5 | Nachtregister en toeristenbelasting | L2/L6 | ontbreekt | Per verblijf een registerregel (nachten, gasten). De belasting wordt berekend als het tarief bekend is, met bron. Zonder tarief staat er "tarief niet ingevuld". | M | A later |
| H6 | Uitbetaling aan de host | L6 | ontbreekt (gepland) | Na het uitchecken loopt de uitbetaling via Geld, die eigenaar is. Het scherm zegt "uitbetaald" pas als dat bevestigd is. | M | A later (Geld) |
| H7 | SCHERMEIGENAAR-doel rechtzetten | — | fout (tekst) | Het doel beschrijft logeren bij leden. | K | **A nu** |
| H8 | Gegevens delen met de overheid (2024/1028) | — | — | — | — | vraagt besluit (juridisch) |

### g. Prioritering
- **A nu:** H3, H7 (K) en H1 (M).
- **Daarna:** H2.
- **A later:** H4, H5, H6.
- **Besluit:** H8.

### Keten "een weekend logeren"
1. Zoeken.
2. Aanvragen; de host krijgt een melding (H3).
3. Bevestigen.
4. Betalen (H1).
5. De deurcode komt 3 dagen vóór aankomst.
6. Inchecken en uitchecken.
7. Reviews.
8. Uitbetaling (H6).

**Storingen:**
- Betaling geweigerd: geen deurcode, met de melding.
- Geld uit: de boeking blijft "bevestigd, niet betaald".

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
- **A nu:** L1, L4.
- **A later:** L2, L3.

### Keten "mijn week"
1. De agenda, de woninggeschiedenis (Wonen W20) en Entourage leveren aan de lijn.
2. Leven toont ze, met de bron per item.

**Storing:** een bron is uit: dat deel staat er niet, en het scherm noemt welke bron.

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
- **A nu:** Ce1, Ce4.
- **A later:** Ce2, Ce3.

### Keten "een fles voor zaterdag"
1. Het lid kiest wat op dronk is.
2. Schenkadvies.
3. Inschenken telt af.

**Storing:** model uit: een vaste tekst met `demo:true`.

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
- **A nu:** Ga1.
- **A later:** Ga2, Ga3.
- **B:** Ga4.

### Keten "het jasje laten herstellen"
1. Stuk.
2. Offerte bij een kleermaker (Ga2).
3. Werkbon.
4. Terug in de garderobe.

**Storing:** vakwerk uit: het stuk krijgt het label "herstel aangevraagd, status niet te zien".

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
| M1 | Dagen per medewerker met de grens van de regeling | L2 | ontbreekt | Per medewerker de dagen per week. Bij 4 of meer staat er "geen dienstverlening aan huis meer: gewoon werkgeverschap", met de bron, als uitleg en niet als oordeel. | K | **A nu** |
| M2 | Taak voor een medewerker die zelf RTG-lid is | L3/L6 | ontbreekt | Is de medewerker lid en gekoppeld met zijn toestemming, dan ziet hij zijn taken en vinkt hij ze af. Een niet-lid blijft een notitie. | M | A later |
| M3 | Huishoudhandboek | L1 | ontbreekt | Vaste routines per ruimte (verwijzing naar Wonen W1). Een document te delen met nieuw personeel, met een einddatum. | M | A later |
| M4 | Loon via Geld (wbw of Pay) | L6 | ontbreekt | — | M | B, eigenaar Geld; werkgeverschap vraagt een besluit |

### g. Prioritering
- **A nu:** M1.
- **A later:** M2, M3.
- **B:** M4.

### Keten "de week van het huis"
1. Taken plannen.
2. De medewerker vinkt af (M2).
3. Het log.
4. Het onderhoud van een installatie gaat als verwijzing naar Wonen.

**Storing:** Wonen uit: de taak blijft staan zonder de installatiekoppeling.

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
- **A nu:** E2, E3 (K) en E1 (M).
- **A later:** E4, E5.

### Keten "met z'n vieren naar New York"
1. De reis staat in TravelOS.
2. Het gezelschap.
3. Toets op geldigheid (E1).
4. Het kind heeft een formulier nodig (E2).
5. Gereed.

**Storing:** TravelOS uit: de toets gebruikt de datum die het lid zelf invult, en zegt dat.

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

### d. Catalogus
| # | Functie | Laag | Status | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|
| Vz1 | Klaarzetten is een voorstel in de eigenaar-app | L6 | ontbreekt | "Klaarzetten" maakt in Agenda, Geld en reis alleen een concept of voorstel, met een verwijzing naar de intentie. Niets is bindend of betaald tot het lid het in die app bevestigt. Er zijn geen vooraf aangevinkte keuzes. | M | **A nu** |
| Vz2 | Drie werelden zonder kansen | L4 | half | De werelden tonen gevolgen, geen percentages. Elk gevolg noemt zijn bron (een app) of "aanname van het lid". | K | **A nu** |
| Vz3 | Vrienden-toestemming afdwingen | L3 | fout (niet afgedwongen) | `permissions.friends` bepaalt wie de intentie ziet. Een niet-genoemde vriend krijgt 403. | K | **A nu** |
| Vz4 | `/partner` laat de echte partner zien | L3 | fout | Met een levensband-akkoord ziet de partner de gedeelde intentie, en zonder akkoord niets. | M | A later |
| Vz5 | Verstoring van een provider (vlucht vertraagd) | L6 | ontbreekt (geen providerroute) | — | G | B: providerroute met handtekening (TravelOS) |

### e. RTG-exclusief
Eén intentie die zichtbaar wordt in de agenda, het geld, de reis en de veiligheid van dezelfde persoon, als voorstel in elke eigenaar-app. Er is geen centrale planner die iets bezit.

### g. Prioritering
- **A nu:** Vz2, Vz3 (K) en Vz1 (M).
- **A later:** Vz4.
- **B:** Vz5.

### Keten "ik verhuis in maart"
1. De intentie.
2. Agenda-concepten (Vz1).
3. De verhuischecklist van Wonen (W19) als voorstel.
4. Een reservering in Geld als voorstel.
5. Het lid bevestigt elk voorstel in de eigen app.

**Storing:** Geld uit: dat deel staat er als "niet klaargezet". De rest gaat door.

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

**Juridisch, vraagt besluit:**
- **Assets:** een verbod op vooruitbetaling binnen de bedenktijd, als de timesharerichtlijn van toepassing is. Daarnaast de prospectusvrijstelling en het beleggingsobject.
- **Podium en Theater:** PSD2 voor cadeaus en betaalde abonnementen; de CvdM-registratie.
- **Logeren:** de gegevensplicht uit verordening 2024/1028.
- **Bestellen:** alcohol, als dat verkocht wordt.
