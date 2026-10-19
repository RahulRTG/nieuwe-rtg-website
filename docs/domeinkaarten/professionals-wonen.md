# Professionals rond wonen (zaak.beheer, binnen de bestaande genres)

Eigenaar aan de zaakkant: `zaak.beheer` → `apps/leverancier.html` (SCHERMEIGENAAR.json, rol eigenaar). Eigenaar aan de bewonerskant: Wonen (LivingOS), met `woning.overzicht` → `apps/wonen.html`, `woning.dossier` → `apps/woningdossier.html`, `woning.onderhoud` → `apps/onderhoud.html`, `woning.apparaten` → `apps/home.html` en `woning.huishouden` → `apps/maison.html`. Doelgroep: de zaak (makelaar, aannemer, verhuurder, beheerder, architect) en, als tegenpartij, het lid. Het kantoor van RTG tekent af waar een sector gereguleerd is.

Dit is een KAART en geen bouwopdracht. Een functie wordt pas werk als de eigenaar haar per familie toezegt. Stand van de code: tak `appwerkt/workos`, gelezen op 19 oktober 2026.

---

## Algemeen deel

### A1. De bijstelling van de eigenaar (bindend)

- Alles gebeurt binnen de BESTAANDE leveranciersgenres uit het genre-register (`server/seed/genres.js`, met `server/seed/genres-lijst-a.js` en `server/seed/genres-lijst-b.js`), met rollen en een schermprofiel per beroep.
- Geen tweede vastgoedmotor en geen duplicatie van domeinlogica. Het aanbod, de bezichtiging en het bod van de makelaar bestaan één keer (`server/routes/supplier/vastgoed/`). Het gebouwbeheer bestaat één keer (`server/kern/gebouw.js`, `server/routes/supplier/gebouwpand.js`, `server/routes/supplier/gebouwplus.js`). De vakpro-laag bestaat één keer (`server/kern/vakwerk/`).
- Makelaar = genre `vastgoed`. Aannemer = genre `bouw` met de vakpro-laag.
- Verhuurder, woningcorporatie, architect, VvE en vastgoedbeheerder: eerst het best passende bestaande genre. Past er geen, dan staat het onder "Vraagt besluit" en wordt er geen nieuw domein ontworpen.
- "Schermprofiel" is een woord van deze kaart. Het komt in de code niet voor (grep, 19-10). Wat de code wel kent: de rollen per genre (`FUNCS` in `public/apps/leverancier.js`, r. 400-427) en de tabs per cap (r. 160-200). Een schermprofiel is hier dus: de set tabs die de caps van het genre openen, plus de rollen die binnen die tabs mogen handelen. Het is geen nieuw object.

### A2. De naad met Wonen

Afspraak met de sessie LivingOS-A (sessie `session_01P8cRS3Ug6vMpBgo4fRD8Gz`). Haar kaart: `docs/domeinkaarten/livingos-a.md` op tak `appwerkt/living-a`, sha `3174847c45506e7e31a31083ba34e1ecd74ef7df`, par. 1 Wonen. Twee van haar functies raken deze kaart rechtstreeks:

- **W4 (keten a, "aanbevolen nu" bij haar):** vanuit een melding vraagt het lid een offerte bij een `bouw`- of `vakwerk`-zaak via de bestaande offertestroom `/api/vak/offerte/*` (`server/kern/vakwerk/pro.js`). De offerte draagt het melding-id als verwijzing. Na akkoord toont de melding "vakman gepland". Deze kaart bouwt aan de zaakkant op precies die verwijzing en voegt geen tweede stroom toe. Let op de bevinding over `vakwerk` in A6: zonder reparatie werkt W4 alleen voor `bouw`.
- **W16 (ketens b-d, "later" bij haar):** projectie delen met makelaar, verhuurder of VvE, gebouwd op het bestaande delen per bestand (`server/kern/bestanden-delen.js`), met een einddatum en direct intrekken.
- Verhuurder, corporatie, VvE, architect en beheerder staan bij haar als "ontbrekend genre, vraagt besluit", met verwijzing naar deze kaart. De besluiten staan hier per beroep.

De afspraak zelf:

- **Wonen is eigenaar van alle objecten van de bewoner:** woning-projectie, ruimte, bouwdeel, installatie, apparaat, melding, onderhoudsplan, documentdossier (kluis), huurcontract-als-lid, VvE-lidmaatschap en verhuisdossier.
- **De zaak krijgt alleen een projectie, en alleen met toestemming.** Een makelaar ziet nooit het woningdossier; hij ziet wat het lid voor één transactie deelt. Een aannemer ziet de bouwdelen en installaties die bij zijn opdracht horen, niet de rest.
- **De zaak blijft eigenaar van haar eigen werk:** het pand in de portefeuille van de makelaar, de offerte en de werkbon van de aannemer, het huurcontract aan de verhuurderskant, de meldingen van een gebouw. Wat zij naar het lid stuurt, is een verwijzing of een document; het lid bewaart het in zijn eigen dossier.
- **Geld is eigenaar van verplichting en betaling** (huur, termijn, waarborgsom, VvE-bijdrage). Wonen en de zaak verwijzen ernaar en rekenen niet zelf.
- **Bestanden is de opslag van het dossier.** Het woningdossier is de map Woningdossier in Bestanden (`/api/bestanden/*`, `server/routes/bestanden.js`). Delen bestaat vandaag per bestand op codenaam (`/api/bestanden/deel`, `server/kern/bestanden-delen.js`). Twee grenzen voor deze kaart: de ontvanger is een persoon met een codenaam en niet een zaak, en wie een gedeeld bestand krijgt, mag er volgens het commentaar ook nieuwe versies op zetten ("de ander kijkt, haalt op en zet nieuwe versies"). Voor een projectie naar een makelaar of verhuurder is alleen-lezen nodig; dat is een te nemen besluit bij W16, geen nieuw deelmechanisme.
- **Het Consent Center is de plek waar toestemming staat en wordt ingetrokken** (`server/routes/consent.js`, `server/kern/consent.js`: `/api/toestemming`, `/api/toestemming/intrek`). De routes zeggen zelf: "er staat hier niets dat een zaak of een kantoor kan opvragen". Elke projectie naar een zaak hoort dus als partij in dat consent te staan, zodat het lid haar ziet en kan sluiten.
- **Wat er vandaag NIET is:** een keten van een melding naar een zaak. `server/kern/woningonderhoud.js` zegt het zelf: "zonder gekoppelde vakman doen we niet alsof iemand onderweg is". De melding blijft op "gemeld" staan.

Gevolg voor deze kaart: elke functie die een zaak iets van de bewoner laat zien, is een projectie met consent en nooit een kopie in de zaak. Elke functie die iets bij de bewoner neerlegt, is een document of een verwijzing die het lid zelf aanneemt.

### A3. De ketens a–f

Vorm volgens CIVILIS par. 5D: expliciete gebeurtenis of gecontroleerde projectie, nooit een gedeelde tabel.

| Keten | Geeft uit | Ontvangt | Vorm | Toestemming | Bestaand vandaag |
|---|---|---|---|---|---|
| a. Melding | lid (Wonen) | verhuurder, beheerder of corporatie; daarna aannemer | gebeurtenis "melding gedeeld" + projectie van de melding; status terug als verwijzing | per melding, door het lid; doorzetten naar de aannemer door de verhuurder, met bericht aan het lid | `/api/home/onderhoud/meld` (lid); geen keten |
| b. Koop of huur via makelaar | makelaar (aanbod), lid (bod, overdrachtsstukken) | lid, makelaar | aanbod = projectie van het pand; bod = gebeurtenis; overdrachtsprojectie van het lid, per stuk | per stuk, door het lid; intrekbaar tot overdracht | aanbod, bezichtiging en bod bestaan; overdrachtsprojectie en transactiedossier niet |
| c. Huurcontract en betalingen | verhuurder (contract), Geld (verplichting en betaling) | lid (huurcontract-als-lid) | contract = document naar het dossier van het lid; verplichting = verwijzing naar Geld | het lid neemt het contract aan; betalingsstatus alleen als het lid de verplichting koppelt | huurcontracten alleen in `gebouwplus` (zakelijk) |
| d. VvE | VvE-zaak (vergadering, MJOP, reservefonds, bijdrage) | lid (VvE-lidmaatschap) | projectie van de VvE-zaak naar het lid; stem = gebeurtenis van het lid | lidmaatschap moet door de VvE bevestigd zijn; stem alleen door het lid | niets (grep "VvE": 0 treffers) |
| e. Verbouwing | lid (opdracht), aannemer (uitvoering, oplevering) | lid (opleverdossier), aannemer (opdrachtprojectie) | offerte/akkoord = gebeurtenissen; opdrachtprojectie naar de aannemer; opleverdossier = document in het dossier van het lid | per opdracht, door het lid; bouwdelen per stuk | offerte, akkoord, werkbon bestaan (`/api/vak/*`); opleverdossier niet |
| f. Woninggeschiedenis (voorstel LivingOS-A) | vertrekkend lid | nieuw lid | kopie met toestemming, van Wonen naar Wonen | door het vertrekkende lid, per onderdeel | niet; de makelaar ziet alleen DAT er een overdracht klaarligt |

**Storingen per keten** (wat de gebruiker ziet en wat bewaard blijft):

- **a. Melding.**
  - Verhuurder heeft geen RTG-zaak: het lid ziet "deze verhuurder is niet aangesloten; uw melding staat in uw eigen dossier", met een exporteerbare tekst. De melding blijft "gemeld".
  - Verhuurder reageert niet binnen de termijn die hij zelf heeft opgegeven: het lid ziet de termijn als verlopen. Er komt geen automatische escalatie naar een aannemer.
  - Lid trekt de melding in (`/api/home/onderhoud/annuleer`): de projectie bij de verhuurder vervalt; zijn eigen afhandeling blijft bij hem met de notitie "ingetrokken door bewoner".
  - Aannemer weigert: de verhuurder ziet de weigering. Het lid ziet "de verhuurder zoekt een andere vakman" pas als de verhuurder dat zelf zet.
  - Tenant-storing: verhuurder B vraagt de melding van verhuurder A op en krijgt 404, niet 403 (geen bestaan lekken).
- **b. Koop of huur.**
  - Bod tegelijk met een ander bod: de makelaar beslist per bod (`/api/supplier/bod/beslis`). Het lid ziet alleen zijn eigen bod, nooit de hoogte van andere biedingen.
  - Lid trekt een gedeeld stuk in vóór de overdracht: het stuk verdwijnt uit de projectie. Wat de makelaar al heeft gedownload, ligt buiten RTG; dat zegt het consentscherm vooraf.
  - Keyless bezichtiging zonder geldige code (`server/kern/vastgoed-keyless-toegang.js`): de deur blijft dicht, de makelaar ziet de poging.
  - Tenant-storing: makelaar B ziet het bod op een pand van makelaar A niet.
- **c. Huur.**
  - Betaling mislukt in Geld: de verhuurder ziet "niet ontvangen", het lid ziet de mislukte betaling in Geld. Wonen toont alleen de verwijzing.
  - Contract loopt af: `gebouwplus` heeft een looptijdbewaking voor zakelijke huur. Voor woninghuur ontbreekt die (zie verhuurder).
  - Lid koppelt de verplichting niet: de verhuurder ziet geen betalingsstatus via RTG en houdt zijn eigen administratie.
- **d. VvE.**
  - Lid is (nog) niet bevestigd als eigenaar van een appartementsrecht: geen stemrecht; het lid ziet waarom.
  - Quorum niet gehaald: het besluit heet "niet genomen", niet "afgewezen".
  - Een stem achteraf wijzigen kan alleen tot de sluiting van de stemming.
- **e. Verbouwing.** Zie A7.
- **f. Woninggeschiedenis.**
  - Vertrekkend lid weigert: het nieuwe lid begint met een leeg dossier. De makelaar ziet "geen geschiedenis gedeeld", geen reden.
  - Persoonlijke stukken (polissen, betaalbewijzen) gaan nooit mee; alleen bouwdelen, installaties, onderhoud en opleverdossiers die het lid aanvinkt.

### A4. De CIVILIS-eisen op deze ketens

| Eis (CIVILIS) | Wat het hier betekent |
|---|---|
| Genre-register, geen tweede catalogus (par. 3) | Elke sectorclaim (makelaar, aannemer, verhuurder) staat in het genre-register of in `server/functies/register/`. Een beroep zonder genre krijgt geen eigen lijst. `test/genreregister.test.js` zakt op een genre buiten het register. |
| Een genre zonder werkend gereedschap blijft op `binnenkort` (par. 5A) | Geen woongenre gaat open met alleen `location`. Een eventueel woninghuurgenre gaat pas open als contract, verplichting en melding werken. |
| Verenigingen via de concernlaag (par. 5B) | Een VvE is een vereniging. Haar plek is de concernlaag en `server/kern/onderneming/rechtsvorm-nl.js` (kent "vereniging"), niet een woongenre. |
| Ketens via gebeurtenis en projectie (par. 5D) | Ketens a–f hierboven. Geen tabel die zaak en lid allebei beschrijven. |
| Proef naar het model van `scripts/ritproef.js`, in de ketenlijst van `scripts/ondernemerbewijs.js` (par. 5F) | Elke keten a–f krijgt een proef met schakels en storingen en een regel in `KETENS`. Vandaag staat er geen enkele woonketen in die lijst; de nauwst verwante is `offerte-factuur` ("Offerte -> opdracht -> factuur", `proef: null`). |
| Tenant-storing (par. 3) | Elke keten heeft minstens de storing "zaak B ziet en raakt de gegevens van zaak A niet", en daarbij "zaak ziet niets van het lid zonder consent". |
| Bewijs met menselijke aftekening voor gereguleerd (par. 3) | Vandaag heeft geen woongenre eisen in `BEWIJS_EISEN` (`server/kern/bedrijfscontrole.js`) en geen persoonseis (`server/kern/persoonseis-lijst.js`). Alleen de basiseisen gelden (KVK, bevoegdheid, vergunningenscan, integriteit). Kandidaten voor een eis: architect (titel beschermd, Architectenregister), corporatie (toegelaten instelling, Aw), makelaar met NVM- of VastgoedCert-claim. Zie "Vraagt besluit". |

### A5. Beroep → genre → caps → rollen → tabs → wat ontbreekt

| Beroep | Genre | Caps | Rollen (FUNCS) | Tabs | Wat ontbreekt |
|---|---|---|---|---|---|
| Makelaar | `vastgoed` (realestate, open) | vastgoed, location, pricing | Makelaar, Bezichtigingen, Backoffice | Vastgoed | transactiedossier, contractobject, Wwft-cliëntenonderzoek, overdrachtsprojectie van het lid |
| Aannemer | `bouw` (construction, open) | services, location, pricing | geen | geen eigen tab; werkvorm "zelfstandig" | rollen, materiaalstaat, opleverdossier (Wkb, BW 7:757a), keten met de melding |
| Verhuurder | beste pasvorm `vastgoed`, deels | vastgoed, location, pricing | Makelaar, Bezichtigingen, Backoffice (passen niet) | Vastgoed | huurder, woninghuurcontract, waarborgsom, servicekosten, inning |
| Woningcorporatie | geen | — | — | — | alles; de code zegt zelf dat sociale huur, corporatie, urgentie en wachtlijst niet bestaan |
| Architect | beste pasvorm `professioneel`; alternatief `zzp` | advies, location, pricing | Officemanager, Advocaat, Notaris, Fiscalist (passen niet) | Praktijk | rollen, ontwerp- en projectflow, titelbewijs |
| VvE | geen woongenre; concernlaag (vereniging) | — | — | — | alles; geen appartementsrecht, vergadering of bijdrage |
| Vastgoedbeheerder | beste pasvorm `kantoorgebouw`, alleen commercieel | gebouw, location, pricing | Receptie, Security, Facilitair, Concierge & jetset | Gebouw | woonunits, portefeuille (één gebouw per zaak), servicekostenafrekening |

Verwante genres die NIET passen: `verhuur` is autoverhuur; `apartment` en `villa` (bookings, doors; rollen Beheer, Housekeeping, Onderhoud) zijn kort verblijf en horen bij TravelOS. `vakwerk`, `schoonmaak`, `hovenier`, `wasserij` en `verhuizer` hebben dezelfde caps als `bouw` en zijn de natuurlijke tweede lijn in keten a en e.

### A6. Productbevindingen (gemeld, NIET gerepareerd)

1. **Gebouwpand en gebouwplus zonder cap-check.** `server/routes/supplier/gebouwpand.js` en `server/routes/supplier/gebouwplus.js` vragen alleen `supplierAuth` (en `managerOnly`), niet de cap `gebouw`. `server/routes/gebouw.js` doet dat wel via `eisGebouw`. Gevolg: een manager van een zaak zonder gebouw kan installaties, post, parkeren, BHV, huurcontracten en leads aanmaken in `gebouwPand[code]` en `gebouwPlus[code]`. Afgeleid uit de code, niet gedraaid. Of het binnen de eigen tenant blijft, moet een IDOR-meting bevestigen; IDOR.json meldt 0 doorbraken over 1999 routes, dus waarschijnlijk wel binnen de eigen code.
2. **Vakwerk niet in VAK_GENRES.** `server/seed/genres-lijst-b.js:27` definieert `vakwerk` ("Vakwerk & klussen", caps services, location, pricing, open). `server/kern/vakwerk/genres.js` kent wel `bouw`, `schoonmaak`, `hovenier`, `verhuizer` en andere, maar geen `vakwerk`. `isVak` (`server/kern/vakwerk/index.js:30-31`) leest `VAK_GENRES[s.type]`, dus een vakwerk-zaak krijgt 403 op de vakpro-laag. Afgeleid, niet gedraaid.

Kleinere waarnemingen, ook niet gerepareerd:
- `server/routes/supplier/vastgoed/deals.js:80`: de variabele `koop` is `true` bij huur. De uitkomst klopt (soort wordt 'huur'), de naam misleidt.
- De poort `isVastgoed` toetst het genre (`s.type === 'vastgoed'`), niet de cap. Een zaak met de cap vastgoed onder een ander genre komt er niet in. Dat is een keuze, maar wel een andere dan bij `gebouw`.
- Project Room (`apps/project-room.html`, eigenaar `werk.project`, doelgroep kantoor) draait volledig op `officeAuth` (`server/routes/rtgone.js`, `/api/rtgone/project/*`). Een aannemer (supplierAuth) en een lid (auth) kunnen er vandaag niet in. Dat raakt keten e direct; zie A7 en "Vraagt besluit".

### A7. Keten e uitgewerkt: de verbouwing (eigenaarsvoorbeeld)

Rolverdeling volgens de eigenaar: Wonen heeft het woningdossier, het aannemersgenre (`bouw`) heeft de uitvoering, Project Room ondersteunt de samenwerking, Geld toont de financiële gevolgen, RTDocs en Bestanden hebben de documenten, de stuurlaag bewaakt toestemming en uitvoering.

| Stap | Wie | Waar (bestaand of ontbrekend) | Vorm | Wat bewaard blijft |
|---|---|---|---|---|
| 1. Wens vastleggen ("badkamer vernieuwen") | lid | Wonen: melding of onderhoudsplan (`server/kern/woningonderhoud.js`) | object van Wonen | de wens in het dossier van het lid |
| 2. Offerte vragen | lid | `/api/vak/offerte/vraag` (bestaat) | gebeurtenis naar de aannemer | de vraag bij beide, elk in eigen opslag |
| 3. Opdrachtprojectie delen | lid | ontbreekt: projectie van de betrokken ruimte, bouwdelen en installaties, met consent | projectie | consentregel in het Consent Center |
| 4. Offerte uitbrengen | aannemer (manager beslist prijs) | `/api/supplier/vak/offerte/antwoord` (bestaat) | gebeurtenis | offerte bij de aannemer; verwijzing bij het lid |
| 5. Financieel gevolg zien | lid | Geld: potje reserveren (`/api/geld/pot/reserveer`, bestaat); koppeling offerte → pot ontbreekt | verwijzing | bedrag staat in Geld, niet in Wonen |
| 6. Akkoord | lid | `/api/vak/offerte/akkoord` (bestaat); via de stuurlaag alleen met `/doe/bevestig` (`server/routes/stuur.js`) | gebeurtenis | akkoord met tijdstip bij beide |
| 7. Plannen en uitvoeren | aannemer | agenda en `/api/supplier/vak/capaciteit` (bestaat) | object van de aannemer | planning bij de aannemer; het lid ziet een datum als verwijzing |
| 8. Samenwerken (vragen, foto's, meerwerk) | lid en aannemer | Project Room bestaat, maar alleen voor kantoor (officeAuth) | ontbreekt | — |
| 9. Werkbon en afsluiting | aannemer (medewerker schrijft, manager beslist prijs) | `/api/supplier/vak/werkbon`, `server/kern/vakwerk/pro2.js` (bestaat) | object van de aannemer | werkbon; materiaal als vrij tekstveld (max. 200 tekens) |
| 10. Opleverdossier | aannemer → lid | ontbreekt: document met tekeningen, materialen, installaties en onderhoud (BW 7:757a) | document naar het dossier van het lid | document in de map Woningdossier (Bestanden), versie bewaard |
| 11. Bouwdelen bijwerken | lid | Wonen: installatie of bouwdeel uit het opleverdossier overnemen | het lid neemt aan; geen automatische schrijfactie van de zaak | nieuw bouwdeel met herkomst "opleverdossier <ref>" |
| 12. Review en herhaalonderhoud | lid, aannemer | `/api/vak/review`, `/api/vak/ritme/start` (bestaan) | gebeurtenis | review bij de aannemer, ritme bij beide |

**Storingen van keten e:**
- Aannemer heeft geen RTG-zaak: stap 2 tot en met 9 vallen weg. Het lid kan een extern opleverdossier zelf uploaden in Woningdossier; dat heet "niet via RTG ontvangen".
- Lid trekt de opdrachtprojectie in tijdens de uitvoering: de aannemer verliest het zicht op de bouwdelen; zijn werkbon en planning blijven bij hem.
- Meerwerk: de aannemer stelt een nieuwe offerteregel voor; het lid moet opnieuw akkoord geven. Zonder akkoord blijft de oorspronkelijke opdracht de afspraak.
- Pot in Geld te klein: Geld meldt het tekort; Wonen en de aannemer zien het niet (geen financiële inkijk voor de zaak).
- Opleverdossier onvolledig: het lid ziet een lijst van de vier onderdelen uit BW 7:757a met per onderdeel aanwezig of ontbrekend. RTG beoordeelt niet of de inhoud klopt.
- Gevolgklasse 1 nieuwbouw: de Wkb-bouwmelding en de gereedmelding gaan naar de gemeente via de kwaliteitsborger. RTG dient niets in (voorbehouden). De Wkb voor verbouw is voorlopig niet doorgegaan (iplo.nl, geraadpleegd 2026-10-19, via zoektool, live te controleren).
- Tenant-storing: aannemer B vraagt de werkbon of de opdrachtprojectie van aannemer A op en krijgt niets.
- Stuurlaag: een AI-voorstel om akkoord te geven wordt nooit zonder `/doe/bevestig` door de mens uitgevoerd.

### A8. Bewijsstand van wat er is

- APPWERKT.json (stempel 2026-10-19T05:16, commit af81b538): `link:wonen` en `link:maison` BEWEZEN op bereikbaar, bedienbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent en herstelbaar; bevoegd NIET_GETEST. `link:projectroom` (persona kantoor): bereikbaar, bedienbaar en waarheidsgetrouw BEWEZEN; menselijk en bevoegd NIET_GETEST; voltooibaar, persistent en herstelbaar GEEN_FIXTURE. Voltooiproef projectroom lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.
- Er is GEEN APPWERKT-rij voor de leverancierskant van vastgoed, vakpro of gebouw. Die functies heten in deze kaart "staat, onbewezen".
- IDOR.json: 1999 routes, 0 doorbraken, 0 lekken. Dat zegt niets over de ketens a–f, die bestaan niet.
- Geen woonketen in `KETENS` van `scripts/ondernemerbewijs.js`.

---

## 1. Makelaar (genre `vastgoed`)

Genre `vastgoed` ("Vastgoed & makelaar", sector realestate, open, `server/seed/genres-lijst-b.js:34`). Caps vastgoed, location, pricing. Tab "Vastgoed". Rollen Makelaar, Bezichtigingen, Backoffice. Ingang `apps/leverancier.html` (`zaak.beheer`). Tegenpartij: het lid via `/api/vastgoed/*`.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Portefeuille: pand aanmaken (woning, appartement, villa, commercieel, grond; koop of huur), foto's | `server/routes/supplier/vastgoed/portefeuille.js` (`/api/supplier/pand`, `/pand/foto`); opslag `supplier.panden` | staat, onbewezen |
| Aanbieding aan leden of publiek aan volgers | `/api/supplier/aanbieding` (zelfde bestand) | staat, onbewezen |
| Overzicht van de zaak | `/api/supplier/vastgoed/overzicht` (`server/routes/supplier/vastgoed/deals.js`) | staat, onbewezen |
| Bezichtiging beslissen, keyless toegang | `/api/supplier/bezichtiging/beslis`; `server/kern/vastgoed-keyless-toegang.js` | staat, onbewezen |
| Bod beslissen: accepteren, afwijzen, tegenbod | `/api/supplier/bod/beslis`; bij accepteren gaat het pand op onder-optie en boekt `facturatie.boek` met 0% btw | staat, onbewezen |
| Lid: aanbod, interesse, bod | `server/routes/member/handel/vastgoed.js` (`/api/vastgoed/aanbod`, `/api/vastgoed/bod`, `/interesse`) | staat, onbewezen |
| Makelaarsbackoffice in het scherm | `public/apps/leverancier.js` vanaf r. 4089 ("de slimme makelaars-backoffice") | staat, onbewezen |

- Bewijs: geen APPWERKT-rij voor de vastgoedkant van de zaak; geen keten in `scripts/ondernemerbewijs.js`. BEVOEGD en IDOR dekken de routes generiek (IDOR: 0 doorbraken over 1999 routes).
- Zelf opgegeven als niet gebouwd: het transactiedossier. Er is geen contractobject en geen notarisstap; het bericht zegt alleen "We stellen een contract op". Verkocht en verhuurd worden alleen geteld.
- `server/kern/knelpunt/openingen-kaart.js:107-114` zegt over dit aanbod: "commercieel aanbod en geen woonvoorziening".

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Realworks (eigendom NVM) | CRM Base €125 en Pro €190 per maand; modules €15-50: NWWI, Workflow (alleen Pro), Facturatie, VoIP, BOG, Nieuwbouw (alleen Pro, plus €25 per project per jaar), A&LV; app per gebruiker; klantportaal Move.nl €10 per object; taxatie | CRM half (portefeuille, aanbod, bod); workflow nee; klantportaal half (het lid ziet zijn bod); nieuwbouw nee; taxatie nee |
| Kolibri | CRM €113 per maand voor 3 gebruikers, plus klantportaal per object | CRM half; klantportaal half |

Bronnen: https://www.realworks.nl/prijzen en https://kolibri.software/prijzen/, geraadpleegd 2026-10-19 (via zoektool, live te controleren). Merken staan hier alleen ter vergelijking, nooit als partner.

### c. Analyse van het volledige domein

- **Particulier:** een lid verkoopt of koopt een woning één of twee keer in tien jaar. Hij wil zien waar zijn bod staat, welke stukken de makelaar heeft, en wat er na het akkoord gebeurt (koopakte bij de notaris).
- **Professioneel:** woningmakelaardij is sinds 2001 geen beschermd beroep; de NVM pleit voor wettelijke normen (https://www.nvm.nl/nieuws/2026/nvm-wettelijke-kwaliteitsnormen-nodig-voor-alle-woningmakelaars/). NVM Wonen vraagt inschrijving in de kamer Wonen van VastgoedCert, de SVMNIVO-praktijktoets, per vestiging minstens één Register Makelaar, en valt onder Erecode en tuchtrecht (https://www.nvm.nl/media/wuhl3gld/reglement-lidmaatschap-en-aansluiting-2024.pdf). PE: 6 verplichte en 6 facultatieve punten per jaar, elke 5 jaar de Niveaumeting (https://www.vastgoedcert.nl/ik-ben-gecertificeerd-makelaar/mijn-permanente-educatie/). Taxateurs: NRVT-register. Alle bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wwft:** cliëntenonderzoek en melden van ongebruikelijke transacties. Volgens de bron zijn de toezichthouders per 1-1-2026 gefuseerd tot DFEI (https://www.rijksoverheid.nl/onderwerpen/financiele-sector/aanpak-witwassen-en-financiering-terrorisme/veelgestelde-vragen-wwft; te controleren). Contant €3.000 of meer is sinds 1-1-2026 verboden (domein-max.txt, Belastingdienst).
- **Bewaarplicht:** fiscale administratie 7 jaar, onroerende zaken 10 jaar (art. 52 AWR; domein-max.txt).
- **Koopovereenkomst:** schriftelijk, met bedenktijd voor de particuliere koper. Bron niet opgehaald; te controleren.
- **Wat dat voor software betekent:**
  - het cliëntenonderzoek is een stap met bewijs, uitgevoerd door een mens bij de makelaar; RTG meldt niets namens hem (voorbehouden);
  - het transactiedossier moet stukken met herkomst en datum bewaren, minstens 7 jaar;
  - een "Register Makelaar"- of NVM-claim op de zaak is een claim die een mens van RTG aftekent, en geen vrij tekstveld;
  - de notaris blijft extern; RTG toont de stap, voert hem niet uit.

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid als koper of verkoper; eigenaar Wonen, de makelaar ziet een projectie)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn bod en zijn stand | bestaat (`/api/vastgoed/bod`) | `db.data.biedingen` | alleen eigen biedingen | geen | lid bij elke beslissing van de makelaar | lid | tegenbod | het lid ziet binnen één scherm bedrag, stand en tegenbod | klein | aanbevolen nu (alleen verdiepen: melding bij beslissing) |
| Overdrachtsprojectie (keten b) | ontbreekt | stukken uit het woningdossier (Bestanden) | per stuk aangevinkt; intrekbaar tot overdracht | wat al gedownload is, ligt buiten RTG | makelaar bij delen en intrekken | lid geeft; Backoffice-rol leest | stuk zonder versie | het lid deelt drie stukken, trekt er één in, en de makelaar ziet er twee | middel | aanbevolen nu |

**L2 Professioneel**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Transactiedossier per pand | ontbreekt | pand, bod, overdrachtsprojectie, contract uit `server/bedrijf/contract.js` (soorten, tekenen met twee namen, klok) | één dossier per geaccepteerd bod; stappen bod → koopovereenkomst → notaris → overdracht; elke stap met datum en wie | notarisdatum is extern | Makelaar en Backoffice bij elke stap; lid bij koopovereenkomst en overdracht | Makelaar schrijft; Bezichtigingen leest niet | huur heeft geen notarisstap | na acceptatie van een bod staat er één dossier met vier stappen; afvinken van "notaris" vraagt een datum | middel | aanbevolen nu |
| Wwft-cliëntenonderzoek als stap | ontbreekt | identiteit via RTG iD (niveau, niet het nummer) | stap moet afgevinkt zijn vóór "koopovereenkomst"; RTG meldt niets | de beoordeling is van de makelaar | Makelaar | alleen rol Makelaar; aftekening door een mens | lid zonder gekeurde identiteit: stap blijft open | het dossier gaat niet naar koopovereenkomst zonder afgevinkte stap met naam en datum | middel | aanbevolen nu |
| Bezichtigingsplanning per medewerker | half (beslissen bestaat; geen toewijzing) | agenda van de zaak | rol Bezichtigingen krijgt een bezichtiging toegewezen | geen | medewerker bij toewijzing | Bezichtigingen | keyless zonder medewerker | een bezichtiging heeft een naam van een medewerker of het woord "keyless" | klein | later |

**L3 Organisatorisch**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen afdwingen per handeling | half (FUNCS bestaat als lijst) | `public/apps/leverancier.js:413` | bod beslissen alleen Makelaar; foto en aanbieding ook Backoffice | geen | — | manager wijst rollen toe | eenmanszaak heeft alle rollen | Bezichtigingen krijgt 403 op `/api/supplier/bod/beslis` | klein | aanbevolen nu |
| Certificeringsclaim (Register Makelaar, NVM) | ontbreekt | stuk geüpload door de zaak | claim zichtbaar pas na aftekening door een mens van RTG; vervalt op de geldigheidsdatum | RTG valideert niet inhoudelijk | kantoor bij indienen; zaak bij verlopen | manager dient in; kantoor tekent af | geen claim = niets tonen | zonder aftekening ziet het lid geen certificaat | middel | later (hangt aan besluit B1) |

**L4 Domeinintelligentie**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Tijd-tot-bod per pand | ontbreekt | aanbiedingsdatum en eerste bod | telling in dagen | klein aantal panden: geen trend | Makelaar wekelijks | Makelaar, manager | panden zonder bod | het getal heet "gemeten", nooit "verwacht" | klein | later |
| Vraagprijsadvies | ontbreekt | geen marktdata in RTG | — | geen bron | — | — | — | — | groot | niet doen: geen eigen transactiedata en geen NWWI; een getal zonder bron is een voorspelling die als feit gelezen wordt |

**L5 Volledige levenscyclus:** aanbod → bezichtiging → bod → transactiedossier → overdracht → (keten f) woninggeschiedenis klaar → archief 7 en 10 jaar. Ontbreekt vanaf het transactiedossier.

**L6 RTG-samenhang:** geeft uit: aanbod (projectie naar leden), beslissingen op bod (gebeurtenis), factuur via `facturatie.boek`. Ontvangt: bod en interesse, overdrachtsprojectie (keten b), melding "woninggeschiedenis klaar" (keten f, alleen DAT). Geld is eigenaar van de factuurbetaling.

**Modus LOS:** zonder Wonen en Geld werkt de makelaar met portefeuille, aanbod, bezichtiging en bod. Het scherm zegt bij het dossier: "Het lid deelt geen stukken via RTG; voeg ze zelf toe."

**Modus SAMEN, keten b (verkoop via makelaar, koper is lid):**
1. Makelaar zet pand en aanbieding aan volgers. Storing: foto-upload faalt; het pand staat zonder foto, met melding.
2. Lid vraagt bezichtiging; Bezichtigingen beslist. Storing: keyless code verlopen; deur dicht, poging zichtbaar.
3. Lid brengt bod uit; Makelaar accepteert. Storing: twee gelijktijdige beslissingen; de tweede krijgt "al beslist".
4. Transactiedossier opent (te bouwen). Storing: facturatie faalt; het dossier staat, factuur heet "niet geboekt".
5. Lid deelt drie stukken. Storing: lid trekt in; stuk weg uit de projectie, regel in het consentjournaal blijft.
6. Wwft-stap afgevinkt door Makelaar; koopovereenkomst getekend via `server/bedrijf/contract.js`.
7. Notarisdatum ingevoerd; overdracht. Storing: datum verschuift; de klok rekent opnieuw.
8. Tenant-storing: makelaar B ziet niets van stap 1-7.

### e. RTG-exclusieve mogelijkheden

- **Overdrachtsprojectie uit het eigen woningdossier** (eigenaar Wonen; capability `woning.dossier`). Een markt-app krijgt PDF's per mail; hier deelt het lid stukken per stuk en trekt ze in.
- **Woninggeschiedenis van verkoper naar koper** (keten f; eigenaar Wonen). Kan alleen waar beide partijen hetzelfde dossiermodel hebben.
- **Keyless bezichtiging met het RTG-account** (bestaand, `server/kern/vastgoed-keyless-toegang.js`).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vastgoed/deals.js`, `portefeuille.js`, `server/routes/member/handel/vastgoed.js`, `server/bedrijf/contract.js` (contractregister, tekenen, klok), `server/routes/bestanden.js`, `server/kern/consent.js`.
- Ontbrekend:
  - Bestanden (lid) → makelaar: projectie, consent per stuk.
  - bod geaccepteerd → transactiedossier: gebeurtenis binnen de zaak.
  - transactiedossier → contractregister: verwijzing.
  - overdracht → Wonen (keten f): gebeurtenis "overdracht voltooid", geen inhoud.
- Eigenaarstwijfel: het contractregister hangt aan een Werk OS-werkruimte, niet aan een leverancierszaak. Zie besluit B2.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Rollen afdwingen op bod/aanbieding | klein | laag | FUNCS | aanbevolen nu |
| Transactiedossier | middel | middel | contractregister (B2) | aanbevolen nu |
| Wwft-stap met aftekening | middel | middel | RTG iD-niveau | aanbevolen nu |
| Overdrachtsprojectie (keten b) | middel | middel | Bestanden, consent | aanbevolen nu |
| Ketenproef b met tenant-storing | middel | middel | bovenstaande | aanbevolen nu |
| Certificeringsclaim | middel | middel | besluit B1 | later |
| Vraagprijsadvies | groot | hoog | marktdata | niet doen |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | koop en huur, woning en commercieel, particulier en zakelijk | genre-register + proef met één pand per soort | half: soorten bestaan, huurbeheer niet |
| Professionele diepte | dossier met Wwft-stap en notarisstap | ketenproef b: zonder Wwft-stap geen koopovereenkomst | ontbreekt |
| Levenscyclus | van aanbod tot archief | proef loopt tot overdracht en leest het dossier na herstart terug | ontbreekt na bod |
| Samenwerking en rollen | drie rollen met eigen rechten | storing: Bezichtigingen beslist geen bod | half: rollen alleen als lijst |
| Domeinintelligentie | alleen gemeten getallen, gelabeld | toets: geen voorspelling zonder zekerheidsklasse | ontbreekt (bewust klein) |
| Los functioneren | werkt zonder Wonen en Geld | proef met Wonen uit | bestaat, onbewezen |
| RTG-ketens | keten b en f | regel in `KETENS` met `dekt: sluit` | geen regel |
| Bewezen betrouwbaarheid | acht bewijzen | een APPWERKT-rij voor de vastgoedkant | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Rollen afdwingen op bod en aanbieding | klein | `FUNCS` (`public/apps/leverancier.js:413`), `server/routes/supplier/vastgoed/deals.js` |
| Transactiedossier per geaccepteerd bod | middel | `server/routes/supplier/vastgoed/deals.js`, `server/bedrijf/contract.js` |
| Wwft-stap met menselijke aftekening | middel | RTG iD-niveau, transactiedossier |
| Overdrachtsprojectie (keten b) | middel | W16 van LivingOS-A, `server/kern/bestanden-delen.js`, `server/kern/consent.js` |
| Ketenproef b met tenant-storing | middel | model `scripts/ritproef.js`, regel in `KETENS` |
| Bezichtiging toewijzen aan medewerker (later) | klein | agenda van de zaak |
| Certificeringsclaim met aftekening (later) | middel | besluit B1 |

**(B) Domeinmaximum, ook buiten de huidige scope (richting, geen toezegging)**

*Proces 1: woningverkoop van opdracht tot nazorg.*
1. Verkoopgesprek en opdracht tot dienstverlening (getekend contract).
2. Wwft-cliëntenonderzoek van de verkoper.
3. Waardebepaling; bij financiering een gevalideerde taxatie door een NRVT-taxateur.
4. Fotografie, plattegrond, meetrapport, vragenlijst en lijst van zaken.
5. Publicatie (eigen aanbod en portalen).
6. Bezichtigingen, terugkoppeling aan de verkoper.
7. Biedingen, onderhandeling, mondelinge overeenstemming.
8. Koopovereenkomst, bedenktijd, ontbindende voorwaarden (financiering, keuring).
9. Bouwkundige keuring door de koper.
10. Waarborgsom of bankgarantie bij de notaris.
11. Notariële akte, overdracht, sleutels.
12. Nazorg: woninggeschiedenis naar de koper (keten f), afrekening, archief 7 en 10 jaar.

- Rollen en organisaties: verkoper (lid), koper (lid), verkoopmakelaar en aankoopmakelaar (zaken `vastgoed`), taxateur, bouwkundig keurder, hypotheekadviseur, bank, notaris.
- RTG-apps en eigenaren: aanbod en dossier = zaak `vastgoed` (`zaak.beheer`); woningdossier, overdracht en keten f = Wonen; waarborgsom, factuur en courtage = Geld; contract = `server/bedrijf/contract.js` (Werk OS); keuring = `bouw`-zaak of `professioneel`; identiteit = RTG iD.
- Buiten scope: koppeling met woningportalen en NWWI (externe koppeling, besluit); taxatie als eigen rol (besluit: genre of rol binnen `vastgoed`); hypotheek en bank (extern); notaris blijft extern (geen indiening, voorbehouden).

*Proces 2: aankoopbegeleiding.* Zoekopdracht van het lid → selectie uit aanbod → bezichtiging met aankoopmakelaar → biedadvies (klasse "advies") → onderhandeling → koopovereenkomst → keuring → overdracht. Draagt: Wonen (zoekprofiel), zaak `vastgoed`, Geld (budget). Buiten scope: aanbod van niet-RTG-makelaars (externe koppeling).

*Proces 3: verhuurbemiddeling.* Opdracht verhuurder → aanbod → screening huurder (alleen met toestemming, geen discriminatie volgens Wet goed verhuurderschap) → bezichtiging → huurovereenkomst → overdracht naar de verhuurder. Kosten alleen bij één partij (geen dubbele bemiddelingskosten, art. 7:417 BW). Draagt: zaak `vastgoed`, Wonen (huurcontract-als-lid), Geld. Buiten scope: het lopende huurbeheer daarna (zie verhuurder).


### Vraagt besluit

- **B1. Wordt een Register Makelaar- of NVM-claim een bewijseis?**
  - (aanbevolen) Een vrijwillige claim met menselijke aftekening, geen toegangseis. Kost: middel. Makelaardij is niet beschermd, dus een verplichte eis zou meer vragen dan de wet.
  - Een eis in `BEWIJS_EISEN` voor `vastgoed`. Kost: middel, plus kantoorwerk bij elke aanmelding.
  - Niets. Kost: geen; het lid kan echt en onecht niet onderscheiden.
- **B2. Waar woont het contract van een transactie?**
  - (aanbevolen) In het bestaande contractregister `server/bedrijf/contract.js`, met een brug naar de leverancierszaak. Kost: middel. Geen tweede register.
  - Een eigen veld op het pand. Kost: klein, maar dat is een tweede contractregister.

---

## 2. Aannemer (genre `bouw`, met de vakpro-laag)

Genre `bouw` ("Bouw & installatie", sector construction, open). Caps services, location, pricing. Geen eigen tab; de werkvorm wordt "zelfstandig" (`server/kern/werkvormen.js:22`). Geen rollen. De vakpro-laag geldt via `VAK_GENRES.bouw` (`server/kern/vakwerk/genres.js`, persona werkvoorbereider: "klusplanning, materiaal, offertes en spoedklussen"). Ingang `apps/leverancier.html`. Tegenpartij: het lid via `/api/vak/*`.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Offerte vragen, akkoord, intrekken (lid) | `server/routes/member/vakpro.js` (`/api/vak/offerte/vraag`, `/offertes/mijn`, `/offerte/akkoord`, `/offerte/intrek`) | staat, onbewezen |
| Offerte beantwoorden en weigeren (alleen manager) | `server/routes/supplier/vakpro.js` (`/api/supplier/vak/offerte/antwoord`, `/weiger`) | staat, onbewezen |
| Capaciteit (alleen manager) | `/api/supplier/vak/capaciteit` | staat, onbewezen |
| Werkbon die de klus afsluit | `/api/supplier/vak/werkbon`; `server/kern/vakwerk/pro2.js` (materiaal: vrij tekstveld, max. 200 tekens) | staat, onbewezen |
| Herhaalonderhoud, wachtlijst, review | `/api/vak/ritme/*`, `/api/vak/wachtlijst/zet`, `/api/vak/review`; `/api/supplier/vak/dienst/herhaal`, `/onderhoud/herinner` | staat, onbewezen |
| Klusketen offerte → boeking → factuur | `server/kern/onderneming/klussen.js` (leest drie objecten met een referentie; "er komt geen projectenregister bij") | staat, onbewezen |

- Bewijs: geen APPWERKT-rij voor de vakpro-laag; keten `offerte-factuur` in `scripts/ondernemerbewijs.js` heeft `proef: null`.
- Niet gebouwd: materiaalstaat, inkoop, rollen, opleverdossier, de keten van een woningmelding naar de aannemer.
- Bevinding (A6): een zaak met genre `vakwerk` krijgt 403 op deze laag.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Exact Online Bouw | Essentials €129, Plus €229, Professional €359 per maand; Professional met kwaliteitsbeheer, capaciteits- en projectplanning | offerte ja; capaciteit half (één getal); projectplanning nee; kwaliteitsbeheer nee |
| Bouwportaal | €45 per maand, inclusief Wkb-dossier en opleverrapporten | Wkb-dossier nee; oplevering half (werkbon) |

Bronnen: https://www.exact.com/nl/producten/bouw/features-en-prijzen en https://bouwportaal.nl/prijzen, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Particulier:** een lid laat een badkamer, dak of uitbouw doen. Hij wil één offerte, één akkoord, weten wanneer ze komen, meerwerk vooraf zien, en na afloop papieren die hij over tien jaar terugvindt.
- **Professioneel:** zzp-vakman of klein bouwbedrijf: offerte, planning, materiaal, werkbon, factuur.
- **Organisatie:** een aannemer met ploegen, werkvoorbereiding en uitvoerders.
- **Wkb:** sinds 1-1-2024 voor gevolgklasse 1: kwaliteitsborger, bouwmelding minstens 4 weken vooraf, gereedmelding met verklaring (https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/wet-kwaliteitsborging-bouwen-wkb/). Voor verbouw is de Wkb voorlopig niet doorgegaan.
- **Consumentendossier (BW 7:757a):** tekeningen, berekeningen, materialen, installaties en onderhoud (https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/privaatrecht-wet-kwaliteitsborging/consumentendossier-opleverdossier-wkb/). Beide geraadpleegd 2026-10-19 (via zoektool, live te controleren). Of 7:757a ook bij verbouw zonder Wkb geldt: te controleren.
- **Bewaarplicht:** 7 jaar administratie (art. 52 AWR; domein-max.txt).
- **Wat dat voor software betekent:**
  - de bouwmelding en de gereedmelding gaan via de kwaliteitsborger naar de gemeente; RTG dient niets in (voorbehouden);
  - het opleverdossier is een document met vier vaste onderdelen dat bij het lid belandt;
  - meerwerk vraagt een nieuw akkoord; zonder akkoord geen meerwerk op de factuur.

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid; eigenaar Wonen)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Offerte vragen vanuit een woningmelding | half (melding en offerte bestaan los; W4 van LivingOS-A bouwt de lidkant met het melding-id als verwijzing) | `server/kern/woningonderhoud.js`, `/api/vak/offerte/vraag` | de melding krijgt een verwijzing naar de offerte; geen kopie | — | aannemer bij de vraag | lid | aannemer zonder RTG-zaak | vanuit een melding is in twee tikken een offerte gevraagd; de melding toont de offertestand | klein | aanbevolen nu |
| Opleverdossier ontvangen | ontbreekt | document van de aannemer, in de map Woningdossier | vier onderdelen (BW 7:757a) aanwezig of ontbrekend | RTG beoordeelt de inhoud niet | lid bij ontvangst | lid neemt aan | lid weigert: document blijft bij de aannemer | het lid ziet per onderdeel aanwezig of ontbrekend | middel | aanbevolen nu |

**L2 Professioneel**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Materiaalstaat op de offerte | ontbreekt (alleen tekstveld 200 tekens) | regels: omschrijving, aantal, eenheid, prijs | som = offerteregel materiaal; btw volgens de factuurlaag | prijzen van leveranciers buiten RTG | manager bij offerte | manager prijst; medewerker leest | geen materiaal (alleen arbeid) | de som van de regels is gelijk aan het materiaalbedrag op de offerte | middel | aanbevolen nu |
| Meerwerk als nieuw akkoord | ontbreekt | aanvullende offerteregel | zonder akkoord niet op de factuur | — | lid bij voorstel | manager stelt voor, lid akkoord | spoed: alleen met vastgelegd mondeling akkoord en naam | meerwerk zonder akkoord staat niet op de factuur | middel | aanbevolen nu |
| Opleverdossier samenstellen | ontbreekt | werkbon, foto's, documenten | vier onderdelen; ontbrekend onderdeel zichtbaar | — | lid bij verzenden | manager verstuurt | verbouw zonder Wkb: dossier blijft aanbevolen, niet verplicht | het dossier gaat niet weg zonder dat elk onderdeel "aanwezig" of "n.v.t. met reden" heeft | middel | aanbevolen nu |
| Wkb-stappen als checklist | ontbreekt | datum bouwmelding, naam kwaliteitsborger | bouwmelding minstens 4 weken voor start | of het project onder gevolgklasse 1 valt, bepaalt de mens | manager 5 weken voor start | manager | geen Wkb bij verbouw | bij start binnen 4 weken na bouwmelding ziet de manager een waarschuwing; RTG dient niets in | klein | later |

**L3 Organisatorisch**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen voor `bouw` | ontbreekt (FUNCS heeft geen regel) | `public/apps/leverancier.js:400-427` | voorstel: Werkvoorbereiding, Uitvoerder, Monteur | — | — | manager wijst toe | zzp: één persoon | de werkbon draagt de rol van wie hem schreef | klein | aanbevolen nu |
| Eigen tab "Vakwerk" | ontbreekt (werkvorm zelfstandig) | tabs per cap, r. 160-200 | tab hangt aan `isVak`, niet aan een nieuwe cap | — | — | — | — | een bouwzaak ziet offertes, planning en werkbonnen in één tab | klein | later |

**L4 Domeinintelligentie**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Waar de klusketen blijft steken | bestaat (`server/kern/onderneming/klussen.js`) | offerte, boeking, factuur | telt per schakel | — | manager | manager | — | elke klus heeft één huidige schakel | klein | aanbevolen nu (zichtbaar maken in de tab) |
| Doorlooptijd-schatting | ontbreekt | eigen afgesloten werkbonnen | mediaan per soort klus | klasse "advies"; minder dan 10 klussen: niet tonen | manager | manager | — | het getal draagt de zekerheidsklasse en het aantal klussen | klein | later |

**L5 Volledige levenscyclus:** melding → offerte → akkoord → planning → uitvoering → meerwerk → werkbon → opleverdossier → factuur → review → herhaalonderhoud. Ontbreekt: melding-koppeling, meerwerk, opleverdossier.

**L6 RTG-samenhang:** geeft uit: offerte, werkbon, opleverdossier (document naar het lid), factuur (Geld). Ontvangt: offertevraag, akkoord, opdrachtprojectie (keten e), doorgezette melding van verhuurder of beheerder (keten a).

**Modus LOS:** offerte, capaciteit, werkbon en review werken zonder Wonen. Het scherm zegt: "Deze klant deelt geen woninggegevens; u werkt op de omschrijving van de offerte."

**Modus SAMEN:** keten e, volledig in A7.

### e. RTG-exclusieve mogelijkheden

- **Opleverdossier dat in het woningdossier van het lid landt** (eigenaar Wonen; `woning.dossier`). Een markt-app levert een PDF; hier wordt het bouwdeel bijgewerkt en is het over tien jaar terug te vinden, ook na verkoop (keten f).
- **Melding → offerte zonder overtypen** (eigenaar Wonen voor de melding, de zaak voor de offerte).
- **Budget in Geld naast de offerte** (eigenaar Geld): het lid ziet de pot en de offerte, de aannemer ziet de pot niet.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vakpro.js`, `server/routes/member/vakpro.js`, `server/kern/vakwerk/pro2.js`, `server/kern/vakwerk/index.js`, `server/kern/onderneming/klussen.js`, `server/kern/onderneming/offertebouw.js`, `server/routes/bestanden.js`.
- Ontbrekend:
  - melding (Wonen) → offertevraag: verwijzing, consent per melding;
  - lid → aannemer opdrachtprojectie: projectie, consent per opdracht;
  - aannemer → lid opleverdossier: document;
  - offerte → Geld-pot: verwijzing, alleen zichtbaar voor het lid.
- Eigenaarstwijfel: waar de samenwerking woont (Project Room is kantoor; Werk OS-praktijk heeft gastlinks). Zie besluit B3.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Rollen voor `bouw` | klein | laag | FUNCS | aanbevolen nu |
| Melding → offertevraag | klein | laag | Wonen | aanbevolen nu |
| Materiaalstaat | middel | middel | factuurlaag | aanbevolen nu |
| Meerwerk als akkoord | middel | middel | offerte | aanbevolen nu |
| Opleverdossier | middel | middel | Bestanden | aanbevolen nu |
| Ketenproef e met tenant-storing | middel | middel | bovenstaande | aanbevolen nu |
| Wkb-checklist | klein | laag | — | later |
| Eigen tab | klein | laag | — | later |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | zzp, klein bedrijf en aannemer met ploegen; ook `vakwerk` | proef met een `bouw`- en een `vakwerk`-zaak | `vakwerk` faalt (A6) |
| Professionele diepte | materiaalstaat, meerwerk, opleverdossier | ketenproef e | ontbreekt |
| Levenscyclus | van melding tot herhaalonderhoud | proef leest werkbon en dossier na herstart terug | half |
| Samenwerking en rollen | rollen met eigen rechten | storing: Monteur prijst geen offerte | manager/medewerker bestaat; rollen niet |
| Domeinintelligentie | alleen gelabelde getallen | toets op zekerheidsklasse | klusketen bestaat |
| Los functioneren | werkt zonder Wonen | proef met Wonen uit | bestaat, onbewezen |
| RTG-ketens | keten a (tweede lijn) en e | regel in `KETENS`, `dekt: sluit` | `offerte-factuur` zonder proef |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij vakpro | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Rollen voor `bouw` (Werkvoorbereiding, Uitvoerder, Monteur) | klein | `FUNCS` in `public/apps/leverancier.js` |
| Melding → offertevraag aan de zaakkant (tegenhanger van W4) | klein | `server/kern/vakwerk/pro.js`, `server/routes/supplier/vakpro.js`, melding-id als verwijzing |
| Materiaalstaat op de offerte | middel | `server/kern/onderneming/offertebouw.js`, de factuurlaag |
| Meerwerk als nieuw akkoord | middel | `/api/vak/offerte/*` |
| Opleverdossier naar het woningdossier | middel | `server/kern/vakwerk/pro2.js`, `server/routes/bestanden.js` |
| Ketenproef e met tenant-storing | middel | model `scripts/ritproef.js`, regel in `KETENS` naast `offerte-factuur` |
| Wkb-checklist en eigen tab (later) | klein | `isVak`, tabs per cap |

**(B) Domeinmaximum, ook buiten de huidige scope (richting, geen toezegging)**

*Proces 1: bouwproject van ontwerp tot oplevering en nazorg (particuliere opdrachtgever).*
1. Wens en programma van eisen (lid, Wonen).
2. Ontwerp en vergunningstekening (architect of tekenaar).
3. Omgevingsvergunning of melding bij de gemeente (extern).
4. Constructieve en bouwfysische berekeningen (constructeur, adviseur).
5. Offertes, vergelijking, keuze, aannemingsovereenkomst.
6. Bij gevolgklasse 1: kwaliteitsborger kiezen, bouwmelding minstens 4 weken vooraf (extern).
7. Werkvoorbereiding: planning, materiaalstaat, inkoop, onderaannemers.
8. Uitvoering met dagrapporten, foto's, meerwerk en minderwerk.
9. Termijnfacturen volgens betalingsschema.
10. Oplevering met opnamestaat; herstelpunten.
11. Gereedmelding met verklaring van de kwaliteitsborger (extern).
12. Opleverdossier (BW 7:757a) naar het woningdossier.
13. Onderhoudstermijn, garantie, herhaalonderhoud.

- Rollen en organisaties: opdrachtgever (lid), architect, constructeur, hoofdaannemer, onderaannemers (installateur, loodgieter), leveranciers, kwaliteitsborger, gemeente.
- RTG-apps en eigenaren: wens, bouwdelen, dossier = Wonen; offerte, planning, werkbon = zaak `bouw` (vakpro-laag); samenwerking = Werk OS-praktijk of Project Room (besluit B3); termijnen en budget = Geld; documenten = Bestanden en RTDocs; akkoorden = stuurlaag met `/doe/bevestig`.
- Buiten scope: onderaanneming als keten tussen twee zaken (CIVILIS par. 5D, nieuwe keten en proef); inkoop bij bouwleveranciers (keten zoals `voorraad-ontvangst`, besluit); koppeling met het Omgevingsloket en met kwaliteitsborgers (extern, voorbehouden: RTG dient niets in); termijnschema als Geld-functie (besluit bij Geld).

*Proces 2: onderhoudscontract.* Inspectie → onderhoudsplan per bouwdeel → herhaalafspraak (`/api/vak/ritme/*`) → werkbon → rapport naar het dossier. Draagt: Wonen (onderhoudsplan), zaak `bouw`. Buiten scope: niets nieuws; dit is (A)-werk plus het onderhoudsplan van Wonen.

*Proces 3: storing en spoed.* Melding (Wonen) → doorgezet door verhuurder of beheerder (keten a) → spoedplanning → werkbon → kosten naar de juiste betaler. Buiten scope: de verhuurder als zaak (besluit bij beroep 3).


### Vraagt besluit

- **B3. Waar werken lid en aannemer samen tijdens een verbouwing?**
  - (aanbevolen) Op de bestaande Werk OS-praktijk met gastlink (`server/bedrijf/praktijk.js`, `/api/bedrijf/praktijk/delen`; `server/bedrijf/praktijk-gast.js`, `/api/werk-gast/beeld` en `/besluit`; minimaal een gratis account). Kost: middel (brug van leverancierszaak naar werkruimte). Bestaat al voor klant en project.
  - Project Room openen voor zaak en lid. Kost: groot; Project Room draait nu volledig op `officeAuth` en is voor het kantoor ontworpen.
  - Geen samenwerkingsruimte; alleen offerte, werkbon en dossier. Kost: geen; meerwerk en vragen lopen dan buiten RTG.
- **B4. Krijgt `bouw` rollen in FUNCS?**
  - (aanbevolen) Ja: Werkvoorbereiding, Uitvoerder, Monteur. Kost: klein.
  - Nee, alleen manager/medewerker. Kost: geen.
- **B5. Wordt de bevinding `vakwerk` buiten VAK_GENRES gerepareerd?**
  - (aanbevolen) `vakwerk` toevoegen aan `VAK_GENRES`. Kost: klein, plus een toets.
  - `vakwerk` op `binnenkort` zetten (CIVILIS par. 5A). Kost: klein; bestaande vakwerk-zaken verliezen het genre.

---

## 3. Verhuurder (beste pasvorm `vastgoed`, deels)

Geen eigen genre. `verhuur` is autoverhuur en past niet. `apartment` en `villa` zijn kort verblijf (TravelOS). De beste pasvorm is `vastgoed`: dat kent `transactie: 'huur'` en de telling "verhuurd". Het kent geen huurder, geen lopend woninghuurcontract en geen inning. Huurcontracten met looptijd bestaan alleen in `gebouwplus` (zakelijk, per verdieping). Rollen van `vastgoed` (Makelaar, Bezichtigingen, Backoffice) passen niet op verhuurbeheer.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Pand met transactie huur, aanbieding, bezichtiging, bod | `server/routes/supplier/vastgoed/` | staat, onbewezen |
| Bij geaccepteerd bod op huur: `facturatie.boek` met soort 'huur' (via de misleidend benoemde variabele `koop`, `deals.js:80`) | `server/routes/supplier/vastgoed/deals.js` | staat, onbewezen; eenmalige boeking, geen maandhuur |
| Zakelijke huurcontracten met looptijdbewaking | `server/routes/supplier/gebouwplus.js` (`/api/supplier/gebouwplus/contract`, `/contract/zet`) | staat, onbewezen; ander genre (`kantoorgebouw`), zonder cap-check (A6) |
| Contractregister met soort `huur`, tekenen met twee namen, opzegklok | `server/bedrijf/contract.js` (`SOORTEN` bevat 'huur') | staat; hangt aan een Werk OS-werkruimte, niet aan een leverancierszaak |
| Meldingen van de bewoner | `/api/home/onderhoud/meld` (Wonen) | staat; geen keten naar een verhuurder |

Niet gebouwd: huurder als relatie, woninghuurcontract, waarborgsom, maandelijkse inning, servicekostenafrekening, indexering. Geen APPWERKT-rij, geen keten in `KETENS`.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| HMS | vanaf €1,25 per object per maand | huurbeheer nee |
| Scope (Scopeselect) | €55 per maand voor 5-100 contracten [oud] | contractbeheer half (alleen zakelijk, `gebouwplus`) |

Bronnen: https://hmsystems.nl/prijzen.html en https://www.scopesoftware.nl/, geraadpleegd 2026-10-19 (via zoektool, live te controleren; de Scope-prijs is als oud gemarkeerd).

### c. Analyse van het volledige domein

- **Particulier:** iemand verhuurt één woning (geërfd, of de eigen woning na samenwonen).
- **Professioneel:** een belegger met tien tot honderden woningen, vaak met een beheerder (beroep 7).
- **Wet goed verhuurderschap** (sinds 1-7-2023): geen discriminatie of intimidatie, schriftelijk contract, schriftelijke informatie, geen dubbele bemiddelingskosten; sinds 2024 een meldpunt per gemeente (https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/wet-goed-verhuurderschap/landelijke-regels-van-goed-verhuurderschap).
- **Waarborgsom:** maximaal 2 maanden kale huur, terug binnen 14 dagen (https://www.volkshuisvestingnederland.nl/onderwerpen/huurbescherming-en-huurcontracten/waarborgsom).
- **Servicekosten:** alleen werkelijke kosten, zonder winst; jaarafrekening vóór 1 juli bij de huurder; toetsing aan het Beleidsboek Servicekosten (https://www.huurcommissie.nl/onderwerpen/huurder-sociale--en-middensector/servicekosten-sociale-middensector-huurder/jaarafrekening-servicekosten-beoordelen). Alle bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- Huurprijsgrenzen en het puntenstelsel: niet in de feiten; te controleren.
- **Wat dat voor software betekent:** de waarborgsom-regel is "bepaald" (wet en gegevens leiden eenduidig tot een maximum); de servicekostenafrekening is "uitlegbaar" (verdeelsleutels zijn een keuze); de huurprijstoets is "advies" (een mens beoordeelt). Een vonnis of naheffing is "voorbehouden".

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid als huurder; eigenaar Wonen en Geld)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Huurcontract-als-lid (keten c) | ontbreekt | document van de verhuurder, in het dossier van het lid | het lid neemt aan; Wonen bewaart | — | lid bij ontvangst | lid | verhuurder buiten RTG: lid uploadt zelf | het contract staat in Woningdossier met herkomst | klein | aanbevolen nu (Wonen-kant; verwijzing van de zaak hangt aan B6) |
| Huur als verplichting in Geld | ontbreekt | bedrag, dag, tegenpartij | Geld is eigenaar; Wonen verwijst | — | lid bij betaaldag | lid koppelt | — | de huur verschijnt in Geld, niet als kopie in Wonen | middel | later |

**L2 Professioneel** (de verhuurder; alleen binnen `vastgoed` als B6 dat kiest)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Woninghuurcontract op een pand | ontbreekt | pand (`supplier.panden`) + `server/bedrijf/contract.js` soort 'huur' | één lopend contract per verhuureenheid; klok rekent opzegtermijn | opzegtermijnen per contractvorm: te controleren | verhuurder 3 maanden voor einde bepaalde tijd | manager tekent; huurder (lid) tekent als tweede naam | huur zonder RTG-huurder: tweede naam handmatig | een pand toont huurder (codenaam), ingang en einde | middel | aanbevolen nu, als B6 = A |
| Waarborgsom-toets | ontbreekt | kale huur, waarborgsom | maximaal 2 × kale huur; terug binnen 14 dagen na einde | klasse "bepaald" | verhuurder bij invoer; beide bij einde | manager | schade-inhouding: klasse "uitlegbaar", mens beslist | een waarborgsom boven 2 × kale huur wordt geweigerd met de regel erbij | klein | aanbevolen nu, als B6 = A |
| Schriftelijke informatieplicht | ontbreekt | vaste informatieset (Wet goed verhuurderschap) | verstuurd vóór of bij ingang | inhoud van de set: te controleren | huurder bij ingang | manager | — | het contract kan niet op "lopend" zonder verzonden informatieset | klein | later |
| Maandelijkse inning | ontbreekt | Geld | Geld is eigenaar; zaak ziet "ontvangen" of "niet ontvangen" | demo-rail bewijst geen echte betaling | verhuurder bij achterstand | huurder koppelt | — | geen bedragen in de zaak zonder Geld-verwijzing | groot | later |
| Servicekostenafrekening | ontbreekt | werkelijke kosten, verdeelsleutel | geen winst; vóór 1 juli bij de huurder | klasse "uitlegbaar" | huurder vóór 1 juli | manager | geschil: Huurcommissie, extern | de afrekening toont per post kosten, sleutel en aandeel | middel | later |

**L3 Organisatorisch:** rollen voor verhuur (Verhuur, Technisch beheer, Financieel) bestaan niet in `FUNCS`. Kosten klein; bak hangt aan B6.

**L4 Domeinintelligentie:** contracteinde-signaal (bestaand patroon in `gebouwplus`, looptijdbewaking) — klein, later. Huurprijsadvies: niet doen (geen bron voor het puntenstelsel in RTG; zou een voorspelling als feit tonen).

**L5 Volledige levenscyclus:** aanbod → screening → contract → waarborgsom → ingang → inning → melding → servicekosten → opzegging → eindinspectie → waarborgsom terug. Bestaat alleen het eerste stuk (aanbod).

**L6 RTG-samenhang:** geeft uit: contract (document, keten c), status van een melding (verwijzing, keten a), doorgezette melding (gebeurtenis naar `bouw`). Ontvangt: melding (projectie met consent), betaalstatus (verwijzing uit Geld).

**Modus LOS:** zonder Wonen en Geld kan een verhuurder vandaag een pand te huur aanbieden en een bod accepteren. Het scherm zegt eerlijk: "Lopend huurbeheer bestaat hier nog niet."

**Modus SAMEN, keten a (melding naar verhuurder en door naar de aannemer):**
1. Lid meldt lekkage (`/api/home/onderhoud/meld`) en deelt hem met zijn verhuurder. Storing: verhuurder geen RTG-zaak; melding blijft "gemeld" met exporteerbare tekst.
2. Verhuurder ziet de projectie en zet "in behandeling". Storing: lid trekt in; projectie vervalt.
3. Verhuurder vraagt een offerte bij een `bouw`-zaak met het melding-id als verwijzing (zelfde stroom als W4). Storing: aannemer weigert; verhuurder ziet de weigering.
4. Aannemer plant; het lid ziet "vakman gepland" (W4). Storing: planning verschuift; het lid ziet de nieuwe datum.
5. Werkbon sluit de klus; de melding gaat naar "opgelost" door het lid of de verhuurder, nooit automatisch door de aannemer.
6. Tenant-storing: verhuurder B en aannemer C zien niets van melding van verhuurder A.

### e. RTG-exclusieve mogelijkheden

- **Melding met foto uit Wonen, door naar de aannemer, status terug bij de bewoner** (eigenaren Wonen en `bouw`), zonder dat de verhuurder het woningdossier ziet.
- **Huur als verplichting in Geld met betaalstatus voor de verhuurder** (eigenaar Geld), zonder dat de verhuurder de rekening ziet.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vastgoed/portefeuille.js`, `server/bedrijf/contract.js`, `server/bedrijf/contractklok.js`, `server/kern/woningonderhoud.js`, `server/kern/vakwerk/pro.js`, `server/kern/consent.js`.
- Ontbrekend: melding → verhuurder (projectie, consent per melding); verhuurder → `bouw` (gebeurtenis, verwijzing melding-id); contract → lid (document); Geld → verhuurder (verwijzing "ontvangen", consent van de huurder).

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Besluit B6 | — | — | eigenaar | eerst |
| Melding → verhuurder (keten a) | middel | middel | W4, consent | aanbevolen nu |
| Woninghuurcontract op een pand | middel | middel | B6, contractregister | aanbevolen nu als B6 = A |
| Waarborgsom-toets | klein | laag | contract | aanbevolen nu als B6 = A |
| Inning via Geld | groot | hoog | Geld, echte rail | later |
| Servicekosten | middel | middel | kostenregistratie | later |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | particuliere en professionele verhuurder | proef met 1 en 20 eenheden | ontbreekt |
| Professionele diepte | contract, waarborgsom, informatieplicht | toets: waarborgsom > 2 × kale huur geweigerd | ontbreekt |
| Levenscyclus | ingang tot teruggave waarborgsom | proef over een volledige huurperiode | ontbreekt |
| Samenwerking en rollen | verhuurrollen | storing: rol Financieel tekent geen contract | ontbreekt |
| Domeinintelligentie | alleen gelabelde signalen | toets op zekerheidsklasse | ontbreekt |
| Los functioneren | werkt zonder Geld | proef met Geld uit | half (aanbod) |
| RTG-ketens | a en c | regels in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Keten a: melding → verhuurder → `bouw` | middel | `server/kern/woningonderhoud.js`, W4 (`server/kern/vakwerk/pro.js`), `server/kern/consent.js` |
| Huurcontract als document bij het lid (keten c, Wonen-kant) | klein | `server/routes/bestanden.js` |
| Woninghuurcontract en waarborgsom-toets op een `vastgoed`-pand (alleen als B6 = A) | middel | `server/bedrijf/contract.js`, `supplier.panden` |

**(B) Domeinmaximum: de verhuurcyclus (richting, geen toezegging)**

1. Verhuurbaar maken: eenheid, energielabel, huurprijsberekening (advies).
2. Aanbieden met objectieve selectiecriteria (Wet goed verhuurderschap).
3. Screening met toestemming; geen discriminatie.
4. Contract, informatieset, waarborgsom (max. 2 maanden).
5. Sleuteloverdracht met ingangsinspectie en foto's.
6. Maandelijkse inning, achterstandsbeleid, aanmaningen.
7. Reparatieverzoeken (keten a), planmatig onderhoud.
8. Jaarlijkse huurverhoging binnen de wettelijke grenzen (te controleren).
9. Servicekostenafrekening vóór 1 juli.
10. Opzegging, eindinspectie, waarborgsom terug binnen 14 dagen.
11. Geschillen: Huurcommissie (extern).

- Rollen en organisaties: verhuurder, huurder (lid), beheerder, aannemer, gemeente (meldpunt), Huurcommissie.
- RTG-apps en eigenaren: eenheid en contract = verhuurderszaak (genre per B6); huurcontract-als-lid, melding = Wonen; inning, waarborgsom, verplichting = Geld; reparatie = `bouw`.
- Buiten scope: een eigen woonverhuurgenre of een rolprofiel binnen `vastgoed` (besluit B6); incasso via een echte betaalrail (extern); huurprijscheck (externe koppeling).

### Vraagt besluit

- **B6. Waar woont de particuliere en professionele woningverhuurder?**
  - (aanbevolen) A. Als schermprofiel binnen `vastgoed`: rollen Verhuur, Technisch beheer, Financieel; lopend contract via `server/bedrijf/contract.js`. Kost: middel. Geen nieuw genre, geen tweede vastgoedmotor.
  - B. Een nieuw genre "woningverhuur" in het genre-register, op `binnenkort` tot contract, melding en inning werken (CIVILIS par. 5A). Kost: groot; nieuw domein vóór V1 is uitgesloten.
  - C. Niets: de verhuurder blijft buiten RTG; het lid beheert zijn huur in Wonen en Geld. Kost: geen; keten a stopt bij de bewoner.

---

## 4. Woningcorporatie (geen passend genre)

Er past geen genre. `server/kern/knelpunt/openingen-kaart.js:107-114` en HDI.md (rond r. 551) zeggen letterlijk dat sociale huur, een woningcorporatie, een urgentieverklaring en een wachtlijst "in deze code niet" bestaan, en dat `vastgoed` "commercieel aanbod en geen woonvoorziening" is. Volgens de bijstelling ontwerpt deze kaart hier geen domein. Wat volgt, is de analyse en de besluitvraag.

### a. Inventaris van het bewezen bestaande

- Niets corporatie-specifieks. Wat een corporatie zou kunnen raken: de melding van de bewoner (Wonen), het zakelijke gebouwbeheer (`kantoorgebouw`, één gebouw per zaak), de concernlaag voor de toegelaten instelling als rechtspersoon (`server/kern/concern/`, `server/kern/onderneming/rechtsvorm-nl.js`).
- Geen APPWERKT-rij, geen keten, geen bewijseis.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Aareon Tobias 365 | prijs op offerte; apps en het portaal Mareon | nee |
| Itris ViewPoint | modules voor mutatie, overlast, huurincasso en inspectie | nee |
| Cegeka-DSA Dynamics Empire | marktaandeel ca. 2019: Cegeka 31%, Aareon 26% [oud] | nee |

Bronnen: https://www.aareon.nl/producten/tobias, https://itris.nl/oplossingen/modules, https://www.computable.nl/?p=256188, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- Een corporatie is een toegelaten instelling met tienduizenden huurders, toewijzing via wachtlijst en urgentie, en publiek toezicht.
- De Aw (ILT) houdt toezicht op grond van art. 61 Woningwet: rechtmatigheid, governance, financiële continuïteit, fit & proper (https://www.ilent.nl/onderwerpen/autoriteit-woningcorporaties/over-de-autoriteit-woningcorporaties/toezicht-van-de-aw/toezicht-op-woningcorporaties).
- Regels: Woningwet, Btiv en Rtiv (https://www.ilent.nl/onderwerpen/autoriteit-woningcorporaties/publicaties-cijfers-en-wetgeving-autoriteit-woningcorporaties/wet-en-regelgeving/woningwet-btiv-en-rtiv).
- dVi vóór 1 juli, met een accountantsprotocol (termijn te controleren).
- Bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wat dat voor software betekent:** toewijzing raakt rechten van woningzoekenden en vraagt uitlegbare regels en bezwaar; dat is geen functie die als "projectie" in een bestaand genre past. Een corporatie zou bovendien een gereguleerde sector zijn (toelating met menselijke aftekening, CIVILIS par. 3).

### d. Functiecatalogus L1–L6

Alleen wat binnen bestaande eigenaren valt:

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Huurder legt corporatiecontract en meldingen in eigen dossier | half (Wonen bestaat) | Woningdossier, melding | lid is eigenaar | — | lid | lid | — | het lid kan een melding exporteren voor het portaal van zijn corporatie | klein | later (Wonen) |
| Eerlijke zin in Wonen | bestaat (`openingen-kaart.js`) | — | RTG belooft geen sociale huur | — | lid | — | — | geen scherm suggereert toegang tot sociale huur | — | bestaat |
| Toewijzing, wachtlijst, urgentie | ontbreekt | — | — | — | — | — | — | — | groot | niet doen zonder besluit B7: nieuw domein, gereguleerd |
| Corporatie als `kantoorgebouw`-zaak | — | — | één gebouw per zaak, geen woonunits | — | — | — | — | — | — | niet doen: verkeerd model, zou een tweede woonmotor in `gebouw` worden |

**Modus LOS / SAMEN:** er is geen corporatiekant. Het lid werkt LOS in Wonen; SAMEN bestaat niet. Eerlijke tekst: "Uw corporatie is niet op RTG aangesloten. Uw melding staat in uw eigen dossier."

### e. RTG-exclusieve mogelijkheden

Geen, zolang er geen besluit is. Potentieel (alleen na B7): een melding uit Wonen die zonder overtypen bij de corporatie binnenkomt (eigenaar Wonen; keten a).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen bij een eventueel besluit: genre-register, concernlaag, keten a.
- Ontbrekend: alles. Eigenaarstwijfel: is dit RTG-werk of een externe koppeling met corporatieportalen? Zie B7.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Export van een melding (Wonen) | klein | laag | Wonen | later |
| Corporatiegenre | groot | hoog | B7, gereguleerd bewijs | niet doen vóór V1 |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | — | — | geen genre |
| Professionele diepte | — | — | geen |
| Levenscyclus | — | — | geen |
| Samenwerking en rollen | — | — | geen |
| Domeinintelligentie | — | — | geen |
| Los functioneren | de huurder werkt in Wonen | APPWERKT `link:wonen` | BEWEZEN (bevoegd NIET_GETEST) |
| RTG-ketens | — | — | geen |
| Bewezen betrouwbaarheid | eerlijke grens blijft staan | `openingen-kaart.js` blijft "dektNiet" tonen | bestaat |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope:** alleen de export van een melding uit Wonen (klein, bouwt op `server/kern/woningonderhoud.js`), en de eerlijke grens in `openingen-kaart.js` laten staan.

**(B) Domeinmaximum: de corporatie-toewijzing en het huurdersleven (richting, geen toezegging)**

1. Inschrijving als woningzoekende; inschrijfduur telt.
2. Urgentieaanvraag met bewijsstukken; besluit met bezwaarmogelijkheid.
3. Aanbod via advertentiemodel of lotingsmodel; reactie.
4. Toewijzing volgens passend toewijzen (inkomen, huishouden; te controleren).
5. Bezichtiging, aanbieding, huurcontract.
6. Huurdersleven: reparaties, overlast, huurincasso, jaarlijkse huurverhoging.
7. Mutatie bij vertrek: eindinspectie, herstel, nieuwe verhuring.
8. Verantwoording aan de Aw (dVi) en de gemeente (prestatieafspraken).

- Rollen en organisaties: woningzoekende, huurder (lid), corporatie (verhuur, wijkbeheer, incasso), gemeente (urgentie), Aw, huurdersorganisatie.
- RTG-apps en eigenaren: huurder-kant = Wonen en Geld; corporatie-kant: geen eigenaar.
- Buiten scope: een nieuw genre en domein (besluit; gereguleerd, met menselijke aftekening); koppeling met bestaande corporatiesystemen en woonruimteverdeelsystemen (extern); toewijzingsregels (uitlegbaar en met bezwaar, nooit AI-beslist).

### Vraagt besluit

- **B7. Gaat RTG een woningcorporatie bedienen?**
  - (aanbevolen) A. Nee vóór V1. RTG bedient de huurder in Wonen en zegt eerlijk dat de corporatie niet is aangesloten. Kost: geen.
  - B. Externe koppeling: de melding gaat als export of via een API van de corporatie naar buiten. Kost: middel per corporatie; afhankelijk van hun systeem.
  - C. Een gereguleerd corporatiegenre op `binnenkort`. Kost: groot; nieuw domein, toezicht door de Aw, bewijs met menselijke aftekening.

---

## 5. Architect (beste pasvorm `professioneel`; alternatief `zzp`)

Genre `professioneel` ("Professionele diensten", sector professional, open, `server/seed/genres-lijst-b.js:43`). Caps advies, location, pricing. Tab "Praktijk" (cap advies, `public/apps/leverancier.js:179`, `renderAdvies` vanaf r. 5922). Rollen Officemanager, Advocaat, Notaris, Fiscalist: die passen niet op een architect. Alternatief `zzp` ("Zelfstandig professional", caps services, location, pricing) met de werkvorm zelfstandig. `server/kern/architect/` gaat over een AI- of software-architect en niet over dit beroep.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Praktijk: dossiers (maken, status) en afspraken per adviseur | `server/routes/planners.js` (`/api/supplier/advies`, `/dossier`, `/dossier/status`, `/afspraak`, poort op cap `advies`); `server/kern/planners/praktijk.js` (opslag `db.data.advies[code]`; "De AI plant alleen en adviseert nooit inhoudelijk") | staat, onbewezen |
| Werk OS-projecten met taken en voortgang uit afgeronde taken | `server/bedrijf/project.js` ("geen zelfgemeld percentage") | staat; hangt aan een werkruimte |
| Project delen met de klant via gastlink, besluit en betaalverzoek | `server/bedrijf/praktijk.js` (`/api/bedrijf/praktijk/delen`, `/betaalverzoek`), `server/bedrijf/praktijk-gast.js` (`/api/werk-gast/beeld`, `/besluit`) | staat; hangt aan een werkruimte |

Niet gebouwd: ontwerpfasen, tekeningversies met akkoord van de opdrachtgever, honorarium per fase, titelbewijs. Geen APPWERKT-rij voor de praktijkkant van de zaak.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Archicad (Graphisoft) | Studio en Collaborate als abonnement | ontwerpsoftware nee, en niet doen |
| Revit / AEC Collection (Autodesk) | Revit $3.005 per jaar; AEC Collection $3.675 | nee, en niet doen |
| Simplicate | bureausoftware, prijs per gebruiker [oud] | half (praktijkdossiers, Werk OS-projecten) |

Bronnen: https://www.graphisoft.com/en-nl/pricing/, https://www.autodesk.com/collections/architecture-engineering-construction/buy, https://www.simplicate.com/nl/tarieven/, geraadpleegd 2026-10-19 (via zoektool, live te controleren). RTG bouwt geen tekenpakket; het vergelijkbare deel is de bureau- en opdrachtgeverskant.

### c. Analyse van het volledige domein

- **Particulier:** het lid laat een uitbouw of verbouwing ontwerpen en heeft een vergunningstekening nodig.
- **Professioneel:** de titel architect is beschermd door de Wet op de architectentitel; alleen met inschrijving in het Architectenregister (https://www.architectenregister.nl/wie-wij-zijn/wet-op-de-architectentitel). Beroepservaringsperiode van 2 jaar, 16 uur bij- en nascholing per jaar (https://www.architectenregister.nl/geregistreerden/bij-en-nascholing). Geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- Gangbare fasering (schetsontwerp, voorlopig ontwerp, definitief ontwerp, vergunning, technisch ontwerp, uitvoering): niet in de feiten; te controleren.
- **Wat dat voor software betekent:** een zaak die zich "architect" noemt, moet een registerinschrijving kunnen tonen die een mens van RTG heeft afgetekend; RTG valideert niet bij het register en doet niet alsof. De vergunningsaanvraag blijft extern (voorbehouden).

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | Ontwerp-akkoord van het lid per versie | ontbreekt | document in het praktijkdossier | akkoord hoort bij één versie | — | lid bij nieuwe versie | lid akkoord, via gastlink | — | een akkoord op versie 2 geldt niet voor versie 3 | middel | later (hangt aan B8) |
| L1 | Ontwerp landt in het woningdossier | ontbreekt | document | lid neemt aan | — | lid | lid | — | de vergunningstekening staat in Woningdossier met herkomst | klein | later |
| L2 | Fasen als stappen in het praktijkdossier | half (dossierstatus bestaat) | `server/kern/planners/praktijk.js` | vaste fasenlijst; status per fase | fasenlijst te controleren | lid bij fase-overgang | architect | kleine opdracht zonder fasen | een dossier toont de huidige fase en wie die zette | klein | aanbevolen nu (als B8 = A) |
| L2 | Honorarium per fase | ontbreekt | offerte, betaalverzoek (`/api/bedrijf/praktijk/betaalverzoek`) | factuur per afgeronde fase | — | lid bij factuur | architect | — | geen fasefactuur zonder afgeronde fase | middel | later |
| L3 | Rollen voor een architectenbureau | ontbreekt | `FUNCS` | voorstel: Architect, Tekenaar, Projectleider, Officemanager | — | — | manager | — | alleen rol Architect zet een fase op "definitief" | klein | aanbevolen nu (als B8 = A) |
| L3 | Titelbewijs met menselijke aftekening | ontbreekt | registerinschrijving, geüpload | zichtbaar pas na aftekening; vervalt bij verloop | RTG valideert niet inhoudelijk | kantoor bij indienen | manager dient in, kantoor tekent af | geen inschrijving: geen titel "architect" tonen | de zaak toont "architect" alleen met afgetekend bewijs | middel | aanbevolen nu (B9) |
| L4 | Uren per fase gemeten | ontbreekt | agenda per adviseur | telling | — | manager | manager | — | getal heet "gemeten" | klein | later |
| L5 | Levenscyclus | — | wens → ontwerp → vergunning (extern) → aanbesteding (keten e) → uitvoering → oplevering | — | — | — | — | — | — | — | — |
| L6 | Samenhang | — | geeft uit: ontwerpdocumenten (document naar Wonen), bestek voor de aannemer (verwijzing, keten e); ontvangt: wens en woningprojectie (consent) | — | — | — | — | — | — | — | — |

**Modus LOS:** de praktijktab werkt met dossiers en afspraken zonder Wonen. Het scherm zegt: "De opdrachtgever deelt geen woninggegevens via RTG."

**Modus SAMEN (verbouwing met architect, uitbreiding van keten e):**
1. Lid deelt de woningprojectie (ruimte, bouwdelen) met de architect. Storing: lid trekt in; de architect behoudt zijn eigen dossier, niet de projectie.
2. Architect zet fase schetsontwerp en deelt versie 1 via gastlink. Storing: gastlink verlopen; het lid ziet "deze link is verlopen" (404, bestaand gedrag).
3. Lid geeft akkoord op versie 2. Storing: architect wijzigt na akkoord; het akkoord geldt niet voor de nieuwe versie.
4. Vergunning: extern. RTG toont de stap, dient niets in.
5. Bestek gaat als verwijzing naar de aannemer (keten e, stap 2). Storing: aannemer niet op RTG; het lid downloadt het bestek.
6. Tenant-storing: architect B ziet niets van het dossier van architect A.

### e. RTG-exclusieve mogelijkheden

- **Ontwerp, bestek, offerte en opleverdossier op één woningdossier** (eigenaar Wonen): de architect ziet de bestaande bouwdelen, de aannemer het bestek, het lid alles.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/planners.js`, `server/kern/planners/praktijk.js`, `server/bedrijf/project.js`, `server/bedrijf/praktijk-gast.js`.
- Ontbrekend: Wonen → architect (projectie, consent); architect → lid (document); architect → aannemer (verwijzing via het lid, nooit rechtstreeks zonder consent).

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Titelbewijs met aftekening | middel | middel | B9 | aanbevolen nu |
| Rollen en fasen binnen `professioneel` | klein | laag | B8 | aanbevolen nu |
| Akkoord per versie | middel | middel | gastlink | later |
| Honorarium per fase | middel | middel | betaalverzoek | later |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | zelfstandig architect en bureau | proef met `professioneel` en `zzp` | half |
| Professionele diepte | fasen, akkoord per versie | proef: oud akkoord geldt niet voor nieuwe versie | ontbreekt |
| Levenscyclus | wens tot oplevering | ketenproef e met architect | ontbreekt |
| Samenwerking en rollen | bureaurollen | storing: Tekenaar zet geen fase op definitief | ontbreekt |
| Domeinintelligentie | gemeten uren | toets op label | ontbreekt |
| Los functioneren | praktijk zonder Wonen | proef met Wonen uit | bestaat, onbewezen |
| RTG-ketens | e (uitgebreid) | regel in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen; titelbewijs met aftekening | APPWERKT-rij; bewijseis in `BEWIJS_EISEN` | geen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Titelbewijs met menselijke aftekening | middel | `server/kern/bedrijfscontrole.js` (`BEWIJS_EISEN`), bestaande aftekening |
| Rolprofiel architect binnen `professioneel` | klein | `FUNCS` |
| Fasen als dossierstatus | klein | `server/kern/planners/praktijk.js` |
| Akkoord per versie via gastlink (later) | middel | `server/bedrijf/praktijk-gast.js` |

**(B) Domeinmaximum: van ontwerp tot oplevering (richting, geen toezegging)**

1. Intake en programma van eisen met het lid.
2. Opdrachtbevestiging met honorarium en fasering.
3. Schetsontwerp, voorlopig ontwerp, definitief ontwerp, elk met akkoord.
4. Constructeur en adviseurs inschakelen.
5. Omgevingsvergunning aanvragen (extern; RTG dient niets in).
6. Technisch ontwerp en bestek.
7. Aanbesteding: offertes van aannemers vergelijken (keten e).
8. Directievoering tijdens de uitvoering.
9. Oplevering en opleverdossier (samen met de aannemer).

- Rollen en organisaties: opdrachtgever (lid), architect, tekenaar, constructeur, installatieadviseur, aannemer, gemeente, kwaliteitsborger.
- RTG-apps en eigenaren: praktijk = zaak `professioneel`; samenwerking = Werk OS-praktijk (gastlink) of Project Room (B3); woning en documenten = Wonen en Bestanden; honorarium = Geld.
- Buiten scope: een eigen architectengenre (besluit B8); koppeling met het Omgevingsloket (extern); BIM- of tekeningviewer (externe koppeling, besluit); registercontrole via het Architectenregister (extern; vandaag niet).

### Vraagt besluit

- **B8. Waar woont de architect?**
  - (aanbevolen) A. Rolprofiel binnen `professioneel` (rollen Architect, Tekenaar, Projectleider naast de bestaande; tab Praktijk). Kost: klein. Geen nieuw genre.
  - B. Binnen `zzp` als werkvorm zelfstandig. Kost: geen; maar geen dossiers per fase.
  - C. Nieuw genre "architect". Kost: middel; nieuw genre vóór V1 vraagt een besluit en een gereedschap dat werkt (CIVILIS par. 5A).
- **B9. Wordt de architectentitel een bewijseis?**
  - (aanbevolen) Ja, alleen voor het tonen van de titel; menselijke aftekening, geen registercontrole. Kost: middel. De titel is wettelijk beschermd.
  - Nee. Kost: geen; de zaak kan zich architect noemen zonder bewijs.

---

## 6. VvE (geen woongenre; de concernlaag)

Er past geen woongenre. Een VvE is een vereniging. Volgens CIVILIS par. 5B hoort die bij de concernlaag (`server/kern/concern/`) en de rechtsvormen (`server/kern/onderneming/rechtsvorm-nl.js` kent `vereniging`, r. 74). Er is geen object voor appartementsrechten, ledenvergadering of bijdragen. grep "VvE": 0 treffers. Het VvE-lidmaatschap van de bewoner is volgens de afspraak een object van Wonen.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Rechtsvorm vereniging | `server/kern/onderneming/rechtsvorm-nl.js` | staat |
| Concernlaag: entiteit, personen, bevoegdheid | `server/kern/concern/` (o.a. `entiteit.js`, `graaf-bevoegdheid.js`, `uitnodiging.js`) | staat, onbewezen voor een VvE |
| Besluitvorming: eigenaar met onderbouwing, adviesronde, bezwaren blijven staan, één stem per persoon, evaluatiedatum, AI beslist niet | `server/bedrijf/besluit.js`, `server/bedrijf/besluitlijst.js` | staat; hangt aan een werkruimte |
| Potjes en reserveringen voor het lid | `/api/geld/pot/*` (`server/routes/geld.js`) | staat; persoonlijk, niet voor een vereniging |

Niet gebouwd: appartementsrecht met breukdeel, ledenvergadering met quorum, stemmen naar breukdeel, MJOP, reservefonds, bijdrage per lid.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| TwinQ | beroepsbeheerders; tarieflijst 2026 | nee |
| VvE Beheer Software | €19, €34 of €59 per VvE; digitaal stemmen naar breukdeel, quorumcheck | half (besluitvorming bestaat, maar één stem per persoon) |
| VvE App | gratis start, Plus €19 | nee |

Bronnen: https://www.twinq.nl/tarieflijst-beroepsmatige-vve-beheerders/, https://vvebeheersoftware.nl/, https://vveapp.com/vve-beheer-kosten, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Particulier:** de bewoner is van rechtswege lid van de VvE; hij wil weten wat er besloten wordt, wat hij betaalt en wat er gereserveerd is.
- **Organisatie:** een kleine VvE wordt door bewoners zelf bestuurd; een grote door een beroepsbeheerder (beroep 7).
- **Wet verbetering functioneren VvE:** jaarlijks reserveren op basis van een MJOP (minstens 10 jaar, niet ouder dan 5 jaar) of minstens 0,5% van de herbouwwaarde; afwijken kan met 4/5 van de stemmen of een bankgarantie (art. 5:126 BW) (https://www.vvebelang.nl/kennisbank/juridisch/wet-vve/, geraadpleegd 2026-10-19, via zoektool, live te controleren). Een wetsvoorstel voor een MJOP van 30 jaar: status onbevestigd, te controleren.
- Bewaarplicht administratie: 7 jaar (domein-max.txt, art. 52 AWR; voor verenigingen via de Belastingdienst-pagina voor stichtingen en verenigingen).
- **Wat dat voor software betekent:** stemmen naar breukdeel en een quorumregel zijn "bepaald" zodra de splitsingsakte is ingevoerd; de reserveringsnorm (0,5% of MJOP) is "bepaald" als herbouwwaarde en MJOP er zijn; de MJOP zelf is "advies" (een deskundige stelt hem op). De splitsingsakte en het reglement blijven bij de notaris (extern).

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | VvE-lidmaatschap in Wonen | ontbreekt (object van Wonen volgens de afspraak) | appartementsrecht, breukdeel | het lid voert in; bevestiging door de VvE | onbevestigd = geen stemrecht | lid | lid | — | het lid ziet zijn breukdeel met "bevestigd" of "niet bevestigd" | klein | later (Wonen) |
| L1 | Bijdrage als verplichting in Geld | ontbreekt | bedrag, dag | Geld is eigenaar | — | lid | lid | — | bijdrage staat in Geld, niet in Wonen | middel | later |
| L3 | VvE als vereniging in de concernlaag | half (rechtsvorm bestaat) | `rechtsvorm-nl.js`, `server/kern/concern/` | bestuur via de bestaande bevoegdheidsgraaf | — | bestuur | bestuur | — | een VvE kan als entiteit met bestuurders bestaan | middel | aanbevolen nu, als B10 = A |
| L3 | Stemmen naar breukdeel met quorum | ontbreekt (`server/bedrijf/besluit.js` kent één stem per persoon) | breukdelen | stemgewicht = breukdeel; quorum volgens reglement | reglement per VvE: invoer door een mens | leden bij oproep en uitslag | lid stemt zelf; geen volmacht zonder vastgelegde volmacht | quorum niet gehaald = "niet genomen" | een stemming met 4/5-eis slaagt alleen bij ≥ 80% van de breukdelen | middel | later (hangt aan B10) |
| L3 | Reserveringsnorm-toets | ontbreekt | herbouwwaarde, MJOP-bedrag | max(0,5% herbouwwaarde, MJOP-bedrag), tenzij 4/5-besluit of bankgarantie | klasse "bepaald" bij volledige invoer; anders "niet ingedeeld" | bestuur bij begroting | bestuur | afwijkingsbesluit | de toets toont de norm, het begrote bedrag en het verschil | klein | later |
| L4 | MJOP opstellen | ontbreekt | inspectie | — | deskundige | — | — | — | — | groot | niet doen: is werk van een deskundige; RTG bewaart de MJOP als document |
| L6 | Projectie VvE → lid (keten d) | ontbreekt | vergadering, besluiten, MJOP, reservefonds | projectie, alleen voor bevestigde leden | — | lid bij oproep | — | — | een lid ziet de oproep en stemt; een niet-lid ziet niets | middel | later |

**Modus LOS:** zonder VvE-kant beheert het lid zijn VvE-stukken als documenten in Woningdossier. Eerlijke tekst: "Uw VvE is niet op RTG aangesloten."

**Modus SAMEN, keten d (alleen na B10 = A):**
1. Bestuur roept vergadering op; leden zien de oproep via de projectie. Storing: lid niet bevestigd; geen stemrecht, met reden.
2. Leden stemmen naar breukdeel. Storing: stem na sluiting; geweigerd. Storing: dubbele stem; de tweede vervangt de eerste tot sluiting.
3. Uitslag: quorum niet gehaald heet "niet genomen".
4. Besluit en notulen gaan als document naar de leden (Wonen).
5. Tenant-storing: VvE B ziet geen leden of besluiten van VvE A.

### e. RTG-exclusieve mogelijkheden

- **VvE-besluit naast het eigen woningdossier en het eigen Geld-potje** (eigenaren Wonen en Geld): het lid ziet wat een dakrenovatie voor zijn bijdrage betekent.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/kern/onderneming/rechtsvorm-nl.js`, `server/kern/concern/`, `server/bedrijf/besluit.js`, `server/routes/geld.js`.
- Ontbrekend: VvE → lid (projectie, alleen bevestigde leden); lid → VvE (stem als gebeurtenis); VvE → Geld (bijdrage als verplichting, verwijzing).
- Eigenaarstwijfel: stemmen naar breukdeel hoort bij `server/bedrijf/besluit.js` (uitbreiding van één stem per persoon) of bij een VvE-kant. Zie B10.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| VvE als vereniging in de concernlaag | middel | middel | B10 | aanbevolen nu als B10 = A |
| Lidmaatschap in Wonen | klein | laag | Wonen | later |
| Stemmen naar breukdeel | middel | middel | `besluit.js` | later |
| Reserveringsnorm-toets | klein | laag | invoer | later |
| MJOP opstellen | groot | hoog | deskundige | niet doen |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | kleine zelfbeheerde en grote VvE | proef met 4 en 80 appartementsrechten | ontbreekt |
| Professionele diepte | breukdeel, quorum, 4/5 | toets: 79% haalt de 4/5-eis niet | ontbreekt |
| Levenscyclus | een VvE-jaar | proef: begroting → vergadering → besluit → notulen | ontbreekt |
| Samenwerking en rollen | bestuur, leden, beheerder | storing: lid sluit geen stemming | ontbreekt |
| Domeinintelligentie | reserveringsnorm met klasse | toets op zekerheidsklasse | ontbreekt |
| Los functioneren | stukken in Woningdossier | APPWERKT `link:wonen` | BEWEZEN (bevoegd NIET_GETEST) |
| RTG-ketens | d | regel in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij | geen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| VvE-stukken als documenten in Woningdossier | klein | `server/routes/bestanden.js` (Wonen) |
| VvE als vereniging in de concernlaag (als B10 = A) | middel | `server/kern/onderneming/rechtsvorm-nl.js`, `server/kern/concern/` |
| Reserveringsnorm-toets (later) | klein | invoer door het bestuur |

**(B) Domeinmaximum: een VvE-jaar (richting, geen toezegging)**

1. Begroting en voorschotbijdragen per breukdeel.
2. Reservering volgens MJOP of 0,5% van de herbouwwaarde.
3. Oproep ledenvergadering met agenda en stukken.
4. Vergadering en stemmen (fysiek, digitaal, volmacht).
5. Notulen en besluitenlijst.
6. Opdrachten aan aannemers voor gemeenschappelijk onderhoud (keten a en e op gebouwniveau).
7. Inning, achterstanden, aanmaningen.
8. Jaarrekening, kascommissie, decharge.
9. MJOP-actualisatie elke 5 jaar door een deskundige.
10. Bij verkoop van een appartement: verklaring van de VvE voor de notaris (keten b).

- Rollen en organisaties: bestuur, leden (leden van RTG), kascommissie, beroepsbeheerder, aannemer, MJOP-deskundige, notaris, bank (bankgarantie).
- RTG-apps en eigenaren: lidmaatschap = Wonen; vereniging en bestuur = concernlaag; besluiten = `server/bedrijf/besluit.js`; bijdragen en reservefonds = Geld; onderhoud = `bouw`.
- Buiten scope: stemmen naar breukdeel (uitbreiding van een bestaande eigenaar, besluit); een rekening op naam van de vereniging met echte inning (externe rail); notarisverklaring (extern).

### Vraagt besluit

- **B10. Waar woont de VvE?**
  - (aanbevolen) A. Als vereniging in de concernlaag (CIVILIS par. 5B), met besluiten via `server/bedrijf/besluit.js`, uitgebreid met stemgewicht. Kost: middel. Geen woongenre.
  - B. Alleen de bewonerskant in Wonen (stukken, lidmaatschap); de VvE zelf blijft buiten RTG. Kost: klein.
  - C. Een VvE-genre in het genre-register. Kost: groot; botst met CIVILIS par. 5B.
- **B11. Krijgt `server/bedrijf/besluit.js` stemgewicht?**
  - (aanbevolen) Pas als B10 = A en er een tweede gebruiker van stemgewicht is (bijvoorbeeld aandeelhouders). Kost: middel.
  - Nu al. Kost: middel; raakt de regel "één stem per persoon".

---

## 7. Vastgoedbeheerder (beste pasvorm `kantoorgebouw`, alleen commercieel)

Genre `kantoorgebouw` ("Kantoorgebouw (RTG Enterprise)", sector facility, open, `server/seed/genres-lijst-b.js:37`). Caps gebouw, location, pricing. Tab "Gebouw" (`public/apps/leverancier.js:174`; `renderGebouw` op `has('gebouw')`, r. 5454). Rollen Receptie, Security, Facilitair, Concierge & jetset. Eén gebouw per zaak, geen woonunits, geen portefeuille.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Gebouw: toren, vloeren, huurders per verdieping, zalen met boekingen, bezoekers, badges, meldingen (schoonmaak, onderhoud, catering), valet, jetset | `server/kern/gebouw.js`, `server/kern/gebouw-demo.js`, `server/routes/gebouw.js` (`/api/supplier/gebouw`, `/zaal`, `/bezoeker`, `/badge`, `/melding`, `/valet`, `/jetset`; poort `eisGebouw`) | staat, onbewezen |
| Pand: installaties met keuringsbewaking, post, parkeren, BHV | `server/routes/supplier/gebouwpand.js` (`/api/supplier/gebouwpand/overzicht`, `/installatie`, `/installatie/keuring`, `/post`, `/post/opgehaald`, `/parkeer`, `/bhv`) | staat, onbewezen; zonder cap-check (A6) |
| Plus: huurcontracten met looptijdbewaking, leads (nieuw → rondleiding → voorstel → getekend of afgewezen), energie per week | `server/routes/supplier/gebouwplus.js` (`/api/supplier/gebouwplus/overzicht`, `/contract`, `/contract/zet`, `/lead`, `/lead/fase`, `/energie`) | staat, onbewezen; zonder cap-check (A6) |
| Schermen | `public/apps/leverancier-gebouwpand.js`, `public/apps/leverancier-gebouwplus.js` (3D-toren), `public/apps/leverancier-gebouwrapport.js` | staat, onbewezen |

Geen APPWERKT-rij voor de gebouwkant. Niet gebouwd: woonunits, meerdere gebouwen per zaak, servicekostenafrekening, beheer namens een eigenaar.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Omniboxx | basislicentie plus modules en koppelingen | half (één commercieel gebouw) |
| Bloxs | contractbeheer en de API-module apart | half (contracten in `gebouwplus`) |
| Scope Beheer, TwinQ verhuurbeheer | beheerderssoftware | nee voor woningen |

Bronnen: https://www.omniboxx.nl/basislicentie/, https://www.bloxs.com/koppeling-met-huurprijscheck/, https://www.scopesoftware.nl/beheerders.html, https://twinq.nl/vastgoed-software/verhuurbeheer-software, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Professioneel:** een beheerder werkt namens een of meer eigenaren (beleggers, VvE's), met tientallen tot duizenden eenheden, commercieel en wonen door elkaar.
- Er is geen apart register. De Wet goed verhuurderschap verbiedt dubbele bemiddelingskosten (art. 7:417 BW) (https://www.volkshuisvestingnederland.nl/onderwerpen/wet-goed-verhuurderschap/regelgeving-bemiddelingskosten).
- De servicekostenafrekening valt onder het Beleidsboek Servicekosten van januari 2026 (https://www.huurcommissie.nl/site/binaries/site-content/collections/documents/2026/01/01/beleidsboek-servicekosten/beleidsboek-servicekosten-januari-2026.pdf). Beide geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wat dat voor software betekent:** de beheerder handelt namens een eigenaar; zijn rechten zijn een gedelegeerde bevoegdheid en geen eigendom. Een portefeuille van gebouwen is een lijst van gebouwen onder één zaak, niet een nieuwe motor.

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L2 | Keuringsbewaking installaties | bestaat (`gebouwpand.js`) | installatie, keuringsdatum | signaal vóór verloop | keuringstermijn per installatie: invoer | Facilitair bij verloop | manager | — | een verlopen keuring staat bovenaan | klein | aanbevolen nu (cap-check toevoegen hoort bij de bevinding, niet hier repareren) |
| L2 | Huurcontract-looptijd (commercieel) | bestaat (`gebouwplus.js`) | contract | looptijdbewaking | — | manager | manager | — | einddatum binnen 6 maanden zichtbaar | klein | bestaat; bewijzen |
| L2 | Melding van een huurder naar een `bouw`-zaak | ontbreekt (meldingen blijven binnen het gebouw) | `server/kern/gebouw.js` melding | gebeurtenis met melding-id als verwijzing (zelfde vorm als W4) | — | aannemer bij doorzetten | Facilitair zet door | — | een gebouwmelding kan een offertevraag worden zonder overtypen | middel | aanbevolen nu |
| L3 | Meerdere gebouwen per zaak | ontbreekt (één gebouw per zaak) | `db.data.gebouw[code]` | lijst van gebouwen onder één code | migratie raakt opslag: besluit | — | manager | — | een beheerder kiest tussen twee gebouwen | groot | later (B12) |
| L3 | Woonunits in een gebouw | ontbreekt | — | — | — | — | — | — | — | groot | niet doen zonder B12: zou een tweede woonmotor naast `vastgoed` worden |
| L4 | Energie per week | bestaat (`gebouwplus.js`) | invoer | telling | gemeten, geen voorspelling | manager | manager | — | het getal heet "gemeten" | klein | bestaat |
| L4 | Servicekostenafrekening | ontbreekt | kosten per post, verdeelsleutel | geen winst; vóór 1 juli | klasse "uitlegbaar" | huurders vóór 1 juli | manager | geschil: Huurcommissie (extern) | per post kosten, sleutel en aandeel | middel | later |
| L6 | Samenhang | — | geeft uit: melding door naar `bouw` (gebeurtenis), contract (document naar het lid als woonhuurder, alleen na B12); ontvangt: melding van een huurder | — | — | — | — | — | — | — | — |

**Modus LOS:** het gebouwbeheer werkt zonder Wonen; het is gebouwd voor commerciële huurders. Eerlijke tekst bij een woonvraag: "Dit beheer is voor kantoorgebouwen; woonunits worden hier niet beheerd."

**Modus SAMEN, keten a op gebouwniveau:**
1. Huurder meldt een kapotte lift (`/api/supplier/gebouw/melding`). Storing: melding zonder verdieping; geweigerd met reden.
2. Facilitair zet door naar een `bouw`-zaak met melding-id als verwijzing (te bouwen). Storing: aannemer weigert; Facilitair ziet de weigering.
3. Aannemer plant en sluit met werkbon. Storing: de werkbon komt binnen; de melding gaat pas op "opgelost" door Facilitair.
4. Keuring van de lift wordt bijgewerkt (`/installatie/keuring`).
5. Tenant-storing: beheerder B ziet het gebouw van beheerder A niet. Extra storing door de bevinding: een zaak zonder cap `gebouw` hoort op `gebouwpand` en `gebouwplus` geweigerd te worden; vandaag gebeurt dat niet (A6).

### e. RTG-exclusieve mogelijkheden

- **Gebouwmelding → aannemer → keuring bijgewerkt, in één ketting** (eigenaren `kantoorgebouw` en `bouw`).
- **Bezoeker met RTG-account en badge** (bestaand in `server/kern/gebouw.js`).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/kern/gebouw.js`, `server/routes/gebouw.js`, `server/routes/supplier/gebouwpand.js`, `server/routes/supplier/gebouwplus.js`, `server/kern/vakwerk/pro.js`.
- Ontbrekend: gebouwmelding → `bouw` (gebeurtenis, verwijzing); beheerder ↔ eigenaar (gedelegeerde bevoegdheid via de concernlaag, besluit).

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Gebouwmelding → `bouw` | middel | middel | vakpro | aanbevolen nu |
| Bewijs voor wat er staat (APPWERKT-rij gebouw) | klein | laag | fixture | aanbevolen nu |
| Servicekostenafrekening | middel | middel | kosten | later |
| Meerdere gebouwen per zaak | groot | hoog | B12, migratie | later |
| Woonunits | groot | hoog | B12 | niet doen vóór besluit |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | commercieel en (na besluit) wonen; meerdere gebouwen | proef met twee gebouwen | één gebouw, commercieel |
| Professionele diepte | keuringen, contracten, servicekosten | proef: verlopen keuring bovenaan | half |
| Levenscyclus | lead tot contracteinde | proef over de leadfasen tot getekend en einde | bestaat, onbewezen |
| Samenwerking en rollen | vier rollen met eigen rechten | storing: Receptie tekent geen contract | rollen als lijst |
| Domeinintelligentie | gemeten energie, gelabeld | toets op label | bestaat |
| Los functioneren | werkt zonder Wonen | proef met Wonen uit | bestaat, onbewezen |
| RTG-ketens | a op gebouwniveau | regel in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen; cap-check op alle gebouwroutes | APPWERKT-rij; toets op 403 zonder cap | geen rij; cap-check ontbreekt (A6) |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

| Functie | Kosten | Bouwt op |
|---|---|---|
| Gebouwmelding → offertevraag bij `bouw` | middel | `server/kern/gebouw.js`, `server/kern/vakwerk/pro.js` |
| Bewijs voor gebouw, pand en plus | klein | voltooiproef-scenario, APPWERKT |
| Servicekostenafrekening voor commerciële huurders (later) | middel | `server/routes/supplier/gebouwplus.js` |

**(B) Domeinmaximum: beheer namens eigenaren (richting, geen toezegging)**

1. Beheerovereenkomst met de eigenaar (belegger, VvE, particulier).
2. Portefeuille: gebouwen, eenheden (commercieel en wonen), installaties.
3. Verhuur: leads, screening, contract (commercieel en woning).
4. Huuradministratie: inning, indexering, achterstanden.
5. Technisch beheer: meldingen, aannemers, keuringen, planmatig onderhoud.
6. Servicekosten: voorschot, afrekening vóór 1 juli.
7. Rapportage aan de eigenaar per kwartaal.
8. Mutaties: opzegging, eindinspectie, herverhuur.
9. VvE-beheer als aparte opdracht (zie beroep 6).

- Rollen en organisaties: beheerder (verhuur, technisch, financieel), eigenaar, huurders, aannemers, keuringsinstanties, Huurcommissie.
- RTG-apps en eigenaren: gebouw = zaak `kantoorgebouw`; woningen = zaak `vastgoed` (verhuurder, B6); huurder = Wonen; geld = Geld; onderhoud = `bouw`; delegatie = concernlaag.
- Buiten scope: portefeuille en woonunits (besluit B12; geen tweede vastgoedmotor); beheer namens derden als gedelegeerde bevoegdheid (besluit); huurprijscheck en indexering (externe bron).

### Vraagt besluit

- **B12. Hoe bedient RTG een beheerder van woningen en van meer dan één gebouw?**
  - (aanbevolen) A. Commercieel blijft `kantoorgebouw` met één gebouw per zaak; woningen beheert hij als verhuurder binnen `vastgoed` (B6); meerdere gebouwen = meerdere zaken onder één concern. Kost: klein; bestaat grotendeels.
  - B. Portefeuille van gebouwen binnen `kantoorgebouw`. Kost: groot; opslagmigratie, vraagt een afzonderlijk besluit (CIVILIS par. 3: geen destructieve migraties zonder toestemming).
  - C. Woonunits in `gebouw`. Kost: groot; tweede woonmotor naast `vastgoed`, in strijd met de bijstelling.
- **B13. Wordt de cap-check op `gebouwpand` en `gebouwplus` gerepareerd?**
  - (aanbevolen) Ja, met dezelfde poort als `eisGebouw` en een toets op 403 zonder cap. Kost: klein.
  - Nee, alleen documenteren. Kost: geen; de afwijking blijft.

---

## Samenvatting van de besluiten

| Code | Vraag | Aanbeveling |
|---|---|---|
| B1 | Register Makelaar/NVM als bewijseis | vrijwillige claim met aftekening |
| B2 | Contract van een transactie | bestaand contractregister `server/bedrijf/contract.js` |
| B3 | Samenwerking bij verbouwing | Werk OS-praktijk met gastlink, niet Project Room |
| B4 | Rollen voor `bouw` | ja |
| B5 | `vakwerk` buiten VAK_GENRES | toevoegen |
| B6 | Woningverhuurder | schermprofiel binnen `vastgoed` |
| B7 | Woningcorporatie | niet vóór V1 |
| B8 | Architect | rolprofiel binnen `professioneel` |
| B9 | Architectentitel als bewijs | ja, voor het tonen van de titel |
| B10 | VvE | vereniging in de concernlaag |
| B11 | Stemgewicht in `besluit.js` | pas bij een tweede gebruiker |
| B12 | Beheerder van woningen en meer gebouwen | `kantoorgebouw` commercieel, woningen via `vastgoed`, meer gebouwen via het concern |
| B13 | Cap-check gebouwpand/gebouwplus | ja |
