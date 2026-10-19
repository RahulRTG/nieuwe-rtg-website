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
- Het **Logboek** (Geld) registreert de financiële kant van onderhoud. Het onderhoud van woning en installaties blijft van Wonen; Logboek verwijst ernaar en bezit het niet.
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
