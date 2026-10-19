# Premiumdomeinkaarten · LivingOS-A

Opdracht: Centraal, 19 oktober 2026 (Beyond Premium, met de bijstelling van de eigenaar van later die dag). Geen nieuwe domeinen vóór V1; de bestaande apps worden verdiept. Geen nieuwe motor of laag, geen centraal woningobject (`Asset` en `RTGObject` zijn afgewezen: AFBOUWPROGRAMMA.md r.33-35, OFFICE.md r.77). Integratie loopt via verwijzingen en projecties (AFBOUWPROGRAMMA.md r.40-45, WERKRUIMTE.md par. 5). Geld gaat nooit vanzelf. Een voorspelling is nooit een feit.

**Verdeling (vastgesteld door Centraal):** LivingOS-A schrijft appdossier, assets, bellen, berichten, bestellen, camera, vonk, theater, spelavond, gezin, vooruitzicht, krant, podium, huis, leven, wonen, cellier, garderobe, maison, veilig, entourage, vandaag en logboek. LivingOS-B en Geld schrijven de rest.

**Naden met andere kaarten:**
- WorkOS (docs/domeinkaarten/professionals-wonen.md) beschrijft de kant van de zaak in de ketens a t/m e. Wonen beschrijft de kant van de bewoner, met dezelfde ketennamen.
- Geld (docs/domeinkaarten/geld.md) is eigenaar van verplichtingen en betalingen. Wonen verwijst ernaar.
- Toegang (docs/domeinkaarten/instellingen.md) levert account, vertrouwde contacten en toestemming aan Veilig.

Lagen: L1 persoonlijk · L2 professioneel · L3 organisatorisch · L4 domeinintelligentie · L5 levenscyclus · L6 samenhang.
Status: **bestaat**, **half** of **ontbreekt**. Kosten: K (klein), M (middel) of G (groot).

---

## 1. Wonen (`link:wonen`)

**a. Doel.** Een lid wil zijn woning zonder zorgen beheren. Hij wil weten wat erin zit en wanneer iets aandacht vraagt. Hij wil een probleem tot het einde opgelost krijgen. Alles wat over het huis bewaard moet blijven, wil hij bij de hand hebben, ook als hij verhuist of verkoopt.

**b. Wat er al is. Hergebruik gaat voor nieuwbouw.**

| Onderdeel | Wat het doet | Waar |
|---|---|---|
| Schermen | wonen.html (Mijn thuis), onderhoud.html en woningdossier.html, op één `wonen.js` | eigenaren `woning.overzicht`, `woning.onderhoud` en `woning.dossier`; SCHERMEIGENAAR.json r.308, r.234, r.309 |
| Meldingen | `/api/home/onderhoud`, `/meld` en `/annuleer`. Velden: titel, plek, notitie, urgentie en status. Statussen gemeld en geannuleerd; "opgelost" wordt gelezen, maar geen route zet het. Maximaal 25 open. | kern/woningonderhoud.js; routes/home.js:21-23 |
| Apparaten en scènes | `/api/home`, `/zet`, `/scene/*` en `/merk/*`. 7 vaste kamers. Sloten gaan nooit mee in een scène en nooit via de AI. | kern/homekit.js; home.html |
| Woningdossier | een map in de kluis: alles wordt versleuteld, tot 200 MB. Delen kan per bestand op codenaam (`/api/bestanden/deel`). | kern/bestanden.js; kluis.js |
| Vakwerk | offerte aanvragen, aanbieden, akkoord geven, waarna een boeking `betaalMoment:'achteraf', paid:false` ontstaat. Werkbon en onderhoudsherinnering aan de kant van de vakman. | kern/vakwerk/pro.js en pro2.js; `/api/vak/offerte/*` |
| Kantoorgebouw (zaak) | installaties met `keuringTot` en signalen, meldingen open/bezig/klaar, energie per week (kWh, m³) | routes/supplier/gebouwpand.js en gebouwplus.js |
| Agenda | herhalende afspraak met herinnering: `herhaal` (dag, week, maand, jaar), `herinner` | kern/agenda-pro.js:80-100; `/api/agenda/bewaar` |
| Vastgoed (makelaar) | pand met energielabel, bezichtiging, bod, keyless bezichtiging | routes/member/handel/vastgoed.js; supplier/vastgoed/ |
| Voltooiproef | `link:wonen` sluit: melden, annuleren, dossier, herstart, dubbeltik en crash | scripts/lib/voltooi/wonen.js |

**c. Objecten en eigenaar.** Alle objecten hieronder zijn van **Wonen**, per sessiesleutel van het lid:
- de woning van het lid (een eigen projectie, geen centraal dossier);
- ruimte, installatie en apparaat;
- melding;
- onderhoudscyclus;
- de koppeling tussen een document en een installatie of ruimte.

Wat Wonen alleen als verwijzing vasthoudt:
- de bytes van documenten: eigenaar is de **Bestanden-kluis**;
- de offerte en de boeking: eigenaar is de **vakwerk-zaak**;
- de afspraak: eigenaar is de **Agenda**;
- lasten en betalingen: eigenaar is **Geld**;
- pand, bezichtiging en bod: eigenaar is de **makelaar**.

**d. Handelingen, van begin tot herstel.**
1. Woning vastleggen.
2. Ruimtes en installaties vastleggen.
3. Documenten koppelen.
4. Een cyclus plannen.
5. Melden.
6. Een vakman vragen (offerte), akkoord geven, uitvoeren.
7. Betalen (Geld, door het lid bevestigd).
8. Opgelost: de geschiedenis blijft staan.
9. Overdragen of archiveren.

Herstel: een dubbeltik, een afgebroken verzoek of een crash maakt niets dubbel; dit is al bewezen voor melden en uploaden. Annuleren laat de geschiedenis staan.

**e. Rechten en rollen.** Nu kan alleen het lid zelf iets doen (eigencollectie per sessiesleutel). Een huisgenoot, verhuurder of vakman ziet alleen wat het lid per stuk deelt. Dat is nu alleen mogelijk per bestand; een map of projectie delen kan nog niet. Een slot gaat nooit via een scène of de AI. Voor een gedeelde woning (huisgenoten) moet de eigenaar besluiten wie eigenaar is; zie W25.

**f. Modus LOS en SAMEN.**

- **LOS: wat werkt zonder andere apps.** Melden, de geschiedenis, ruimtes en installaties, het dossier (als de kluis werkt) en de apparaten.
- **LOS: wat het scherm eerlijk zegt als een bron uitvalt:**
  - Kluis uit: "het dossier is nu niet te openen; je meldingen staan er wel".
  - Vakwerk uit: "de status bij de vakman is nu niet te zien". De melding blijft dan 'gemeld' en wordt niet stil afgerond.
  - Agenda uit: "de herinnering staat niet in je agenda". De cyclus blijft in Wonen.
- **SAMEN: wat Wonen uitgeeft.** Verwijzingen naar een melding, een installatie en de woning-projectie.
- **SAMEN: wat Wonen ontvangt.** Een offerte- of boekingsverwijzing (vakwerk), een afspraak-id (Agenda), een betaalbewijs (Geld), een bestand-id (kluis) en de projecties van een pand of VvE.
- **SAMEN: de ketens, met WorkOS:**
  - a: melding → verhuurder, beheerder of aannemer;
  - b: makelaar;
  - c: huur;
  - d: VvE;
  - e: verbouwing;
  - f (voorstel): overdracht van lid naar lid.

> **Gebruikersketen "de cv-ketel lekt":**
> 1. Het lid meldt de lekkage.
> 2. Het vraagt vanuit de melding een offerte bij een `bouw`-zaak.
> 3. Het geeft akkoord.
> 4. De afspraak komt in de Agenda.
> 5. De werkbon komt binnen.
> 6. Het lid betaalt via Geld.
> 7. De melding staat op opgelost.
> 8. Het garantiebewijs komt in het dossier, aan de installatie.
>
> **Storingen:**
> - Valt de Agenda uit, dan blijven melding en offerte staan en zegt het scherm dat de afspraak niet in de agenda staat.
> - Wordt de betaling geweigerd, dan heet de werkbon "niet betaald" en wordt de melding niet stil afgesloten.
> - Valt de kluis uit, dan wordt het garantiebewijs niet bewaard en blijft de melding opgelost.
> - Valt vakwerk uit, dan blijft de melding "gemeld" met de tekst "status vakman niet te zien".

**g. Betaalmuur als ondergrens.** Geraadpleegd op 19 oktober 2026.

| Marktleider | Functie | Bij RTG |
|---|---|---|
| HomeZada | inventaris, onderhoudskalender uit checklists, projecten met budget, documenten aan items. Premium kostte in 2022 $79 per jaar. Bron: [homezada.com](https://www.homezada.com/), [prijsmodel 2022](https://zen.homezada.com/2022/03/31/understanding-homezadas-pricing-model/) | inventaris **half**, kalender **half**, projecten **niet**, documenten **half** |
| Centriq | handleiding en garantie via een foto van het typeplaatje; terugroepacties. Bron: [This Old House](https://www.thisoldhouse.com/smart-homes/keep-track-of-home-maintenance-with-the-centriq-home-app) | garanties **niet**, handleiding op foto **niet** |
| Werkspot | klus plaatsen, voorstellen van vakmensen, gratis voor de consument. Bron: [werkspot.nl](https://www.werkspot.nl/hoe-werkt-het/opdrachtgever) | offerte bij vakwerk **bestaat**, koppeling aan melding **niet** |
| Wkb-consumentendossier (wet, geen product) | bij oplevering tekeningen, materialen en onderhoudsinformatie (BW 7:757a). Bron: [Kiwa](https://www.kiwa.com/nl/nl/specials/wkb/hoe-kunt-u-in-de-praktijk-werken-met-de-wkb/) | opleverdossier in het woningdossier **half** (map bestaat) |

**h. Beyond.** RTG kan dit omdat de apps samen bestaan:
- een melding gaat zonder overtypen naar een vakman die RTG kent;
- het onderhoud staat in dezelfde agenda als het gezin;
- de betaling is pas "betaald" als Geld het bevestigt;
- het bewijs staat versleuteld in de eigen kluis;
- bij verkoop deelt het lid een overdrachtsprojectie met de makelaar, per stuk en met toestemming, en nooit het hele huis.

Geen van de marktleiders heeft melding, vakman, agenda, betaling en kluis in één keten.

**i. Functiecatalogus.** Elk acceptatiecriterium wordt een stap in `scripts/lib/voltooi/wonen.js`.

| # | Functie (familie) | Laag | Status | Bron | Acceptatiecriterium | K | Bak |
|---|---|---|---|---|---|---|---|
| W1 | Ruimtes en installaties vastleggen (identiteit) | L1 | half | homekit-kamers; gebouwpand-installaties | Het lid legt "Badkamer" en "CV-ketel, bouwjaar 2015" vast. Na een herstart staan ze er; een ander lid ziet ze niet. | M | **nu** |
| W2 | Plattegrond, bouwdelen en materialen (identiteit) | L1 | ontbreekt | — | Het lid hangt een plattegrond (bestand) aan de woning en markeert ruimtes. | G | later |
| W3 | Melding afronden als opgelost (technisch) | L5 | half | woningonderhoud.js leest 'opgelost' | Het lid zet een melding op opgelost met een notitie. Ze blijft in de geschiedenis, en een tweede keer afronden verandert niets. | K | **nu** |
| W4 | Van melding naar vakman, keten a (technisch) | L2/L6 | half | vakwerk/pro.js offerte | Vanuit een melding vraagt het lid een offerte bij een bouw- of vakwerkzaak. De offerte verwijst naar het melding-id. Na akkoord toont de melding "vakman gepland". Is vakwerk uit, dan blijft de melding staan en zegt ze dat. | M | **nu** |
| W5 | Garantie per installatie (technisch) | L1 | ontbreekt | vorm `keuringTot` (gebouwpand) | Het lid zet de einddatum van de garantie en een bewijs. 30 dagen vóór het einde verschijnt een attentie; daarna staat er "verlopen". | K | **nu** |
| W6 | Onderhoudscyclus naar de agenda (technisch) | L5/L6 | half | `/api/agenda/bewaar` met herhaal | "CV-ketel jaarlijks" maakt een herhalende afspraak met herinnering, met een verwijzing terug. Is de Agenda uit, dan staat de cyclus er toch, met de melding "niet in agenda". | K | **nu** |
| W7 | Vervangingsplanning met onzekerheid (technisch) | L4 | ontbreekt | kern/voorspel | Bij bouwjaar en levensduur toont Wonen "vervanging verwacht tussen 2031 en 2036 (schatting)". Nooit één datum; bron en aanname staan erbij. | M | later |
| W8 | Meterstanden en verbruik (energie) | L1/L4 | ontbreekt | vorm gebouwplus energie | Het lid voert maandstanden in en ziet het verloop. Zonder standen toont het scherm geen cijfers. | M | later |
| W9 | Scenario's voor isolatie, zonnepanelen en warmtepomp (energie) | L4 | ontbreekt | geen woonscenario (fiscaal/scenario is voor zaken) | Het lid kiest een maatregel en ziet een bandbreedte van besparing, met tarief en bron. Ontbreekt een bron, dan rekent het scenario niet. | G | later |
| W10 | Slimme meter (P1) koppelen (energie) | L6 | ontbreekt | — | — | G | niet doen nu: vraagt hardware of een provider (zie j) |
| W11 | Verbouwproject: begroting, offertes, afhankelijkheden, oplevering (renovatie) | L2/L5 | ontbreekt | vakwerk-offertes; kluis | Het lid maakt een project met een begroting. Offertes van vakwerk hangen eraan; de oplevering (Wkb-dossier) komt in de map. | G | later |
| W12 | Een vergunning indienen (renovatie) | — | — | — | — | — | niet doen: voorbehouden (Omgevingsloket). Stukken bewaren kan wel, via W15 |
| W13 | Woonlasten als projectie van Geld (financieel) | L6 | ontbreekt | Geld stelt een verplichting-object voor | De woning toont de lasten uit Geld. Is Geld uit, dan staat er "woonlasten nu niet te zien", zonder bedrag. | M | later (wacht op Geld) |
| W14 | Woningdossier (documenten) | L1 | **bestaat** | wonen.js; kluis | Is al een stap in de voltooiproef. | — | — |
| W15 | Document koppelen aan installatie of ruimte (documenten) | L1/L6 | ontbreekt | bestand-id als verwijzing | De handleiding hangt aan "CV-ketel" en opent vanuit de installatie. Zonder kluis zegt het scherm dat. | K | **nu** |
| W16 | Projectie delen met makelaar, verhuurder of VvE, ketens b t/m d (documenten) | L2/L6 | half | delen per bestand (bestanden-delen.js) | Het lid deelt een selectie, met een einddatum. De ontvanger ziet alleen die selectie. Intrekken werkt direct. | M | later |
| W17 | Apparaten en scènes (slim wonen) | L1 | **bestaat** | homekit.js | Is al bewezen in de huidige app. | — | — |
| W18 | Automatisering op tijd (slim wonen) | L1 | ontbreekt | merk-beschrijving TUINRIJK, geen planner | Een scène start op een vast tijdstip. Sloten doen nooit mee. Een gemiste start meldt zich. | M | later |
| W19 | Toegang voor gasten en deurcodes (slim wonen) | — | ontbreekt | vastgoed-keyless (bezichtiging) | — | G | vraagt besluit: echte sloten en aansprakelijkheid |
| W20 | Veiligheidskaart van het huis (veiligheid) | L1 | ontbreekt | noodkaart is medisch; Veilig/Thuiswacht bestaan | Het lid legt vast waar de afsluiters zitten en wanneer hij de rookmelder testte. Een gemiste test geeft een attentie. Te zien vanuit Veilig. | K | **nu** |
| W21 | Verhuischecklist en planning (verhuizen) | L5 | ontbreekt | genre `verhuizer` | Het lid maakt een verhuisplan met data. Een verhuizer kan via een offerte (vakwerk) gevraagd worden. | M | later |
| W22 | Adreswijziging bij instanties (verhuizen) | — | — | — | — | — | niet doen: voorbehouden (BRP via de gemeente) |
| W23 | Overdrachtsdossier, keten f (verhuizen) | L5/L6 | ontbreekt | W1, W15, kluis | Het lid kiest installaties, garanties en documenten en geeft ze als kopie aan de volgende bewoner (een lid), met toestemming. Er blijft niets gedeeld achter. | M | later |
| W24 | Woninggeschiedenis als tijdlijn (geschiedenis) | L5 | half | meldingen blijven als geschiedenis | Eén tijdlijn van meldingen, werk, documenten en besluiten, alleen uit eigen objecten en verwijzingen, met de datum en de bron van elke stap. | K | **nu** |
| W25 | Huisgenoten in dezelfde woning (organisatorisch) | L3 | ontbreekt | gezinsagenda `gezin:` | — | M | vraagt besluit: wie is eigenaar van een gedeelde woning? |

**Oordeel per laag:**
- **L1 persoonlijk:** sterk op basis (melden, dossier, apparaten). Er ontbreken objecten per ruimte en installatie (W1, W5, W15).
- **L2 professioneel:** de genres bouw, vakwerk, vastgoed en verhuizer bestaan. Verhuurder, corporatie, VvE, architect en beheerder ontbreken; die gaan naar "vraagt besluit" bij WorkOS.
- **L3 organisatorisch:** alleen het lid zelf; zie W25.
- **L4 domeinintelligentie:** nog niets voor wonen. Er zijn geen voorspellingen zonder bandbreedte (W7, W9).
- **L5 levenscyclus:** het gat zit tussen "gemeld" en "opgelost" (W3, W4) en bij overdracht (W23).
- **L6 samenhang:** de bouwstenen bestaan (vakwerk, agenda, Geld, kluis). Wat ontbreekt zijn de verwijzingen ertussen (W4, W6, W13, W15).

**Aanbevolen nu (8):** W1, W3, W4, W5, W6, W15, W20 en W24. Samen is dat 2 keer M (W1, W4) en 6 keer K, en alles op bestaande vermogens. W3 lost ook de afwijking op waarbij SCHERMEIGENAAR r.2146 "opgelost" belooft zonder dat er een route voor is.

**j. Extern en "vraagt besluit".**
- **P1 of slimme meter (W10):** vraagt hardware of een netbeheerder- of leverancierskoppeling.
- **Echte sloten en deurcodes (W19):** vraagt aansprakelijkheid en een besluit.
- **Energietarieven en subsidiebronnen (W9):** vraagt een bron met datum.
- **Gedeelde woning (W25):** de eigenaar moet het eigenaarschap bepalen.
- **Genres:** verhuurder, corporatie, VvE, architect en beheerder ontbreken (via WorkOS).
- **Woonlasten (W13):** wacht op een verplichting-object van Geld.
- **Vergunning en adreswijziging (W12, W22):** blijven voorbehouden.
