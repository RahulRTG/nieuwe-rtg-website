# Professionals rond wonen (zaak.beheer, binnen de bestaande genres)

Eigenaar aan de zaakkant: `zaak.beheer` → `apps/leverancier.html` (SCHERMEIGENAAR.json, rol eigenaar). Eigenaar aan de bewonerskant: Wonen (LivingOS), met `woning.overzicht` → `apps/wonen.html`, `woning.dossier` → `apps/woningdossier.html`, `woning.onderhoud` → `apps/onderhoud.html`, `woning.apparaten` → `apps/home.html` en `woning.huishouden` → `apps/maison.html`. Doelgroep: de zaak (makelaar, aannemer, verhuurder, beheerder, architect) en, als tegenpartij, het lid. Het kantoor van RTG tekent af waar een sector gereguleerd is.

Dit is een KAART en geen bouwopdracht. Een functie wordt pas werk als de eigenaar haar per familie toezegt. Stand van de code: tak `appwerkt/workos`, gelezen op 19 oktober 2026; herzien op 19 oktober 2026 (avond) na het oordeel van de integrator ("echte diepte": behouden en aangescherpt).

**Wat er in deze herziening veranderde.**
- De bak "aanbevolen nu" is gesplitst in **HERSTEL** (fouten, rolgrenzen, wat het scherm belooft maar niet doet) en **VERDIEPING** (nieuwe premiumdiepte binnen scope). De twee reparaties uit de reparatieronde staan als "gerepareerd (commit …)".
- Per beroep een regel **"Volledige werkzaamheid:"**, modus LOS in drie groepen met de letterlijke schermtekst, en modus SAMEN als contractblok `samen` (voorstel; `scripts/lib/appcontract.js` is niet gewijzigd).
- L5 (volledige levenscyclus) en L6 (RTG-samenhang) zijn per beroep een **catalogus** met de kolommen van het sjabloon, geen proza meer.
- Nieuwe sectie **ONTBREKEND (meetbaar)** met keten b (verkoop en overdracht) en keten e (verbouwing), elk gesplitst per ontbrekende schakel, met proefinstrument, storingen en meetbare uitslag.
- Elke wets- en normregel in c. en elke marktregel in b. draagt **(te controleren)**: geen primaire tekst is zelf nagelezen. Zo'n regel staat nergens meer als harde weigerregel; hooguit als signaal. De contantregel is uit de makelaar gehaald (zie `docs/domeinkaarten/workos.md` par. 11).
- Nieuwe bevinding (gelezen, niet beproefd, niet gerepareerd): de offerte kent in de kern al regels (`server/kern/vakwerk/pro.js`, `offerteAntwoord` met `regels` via `server/kern/onderneming/offertebouw.js`), maar het scherm stuurt alleen `prijs` en `toelichting` (`public/apps/leverancier/leverancier-24b.js:6`). De eerdere stand "materiaalstaat ontbreekt" was daarom te streng: het gat zit in het scherm.

---

## Algemeen deel

### A1. De bijstelling van de eigenaar (bindend)

- Alles gebeurt binnen de BESTAANDE leveranciersgenres uit het genre-register (`server/seed/genres.js`, met `server/seed/genres-lijst-a.js` en `server/seed/genres-lijst-b.js`), met rollen en een schermprofiel per beroep.
- Geen tweede vastgoedmotor en geen duplicatie van domeinlogica. Het aanbod, de bezichtiging en het bod van de makelaar bestaan één keer (`server/routes/supplier/vastgoed/`). Het gebouwbeheer bestaat één keer (`server/kern/gebouw.js`, `server/routes/supplier/gebouwpand.js`, `server/routes/supplier/gebouwplus.js`, met de poort `server/kern/gebouw-poort.js`). De vakpro-laag bestaat één keer (`server/kern/vakwerk/`).
- Makelaar = genre `vastgoed`. Aannemer = genre `bouw` met de vakpro-laag; `vakwerk` hoort sinds 4a914ea ook bij die laag.
- Verhuurder, woningcorporatie, architect, VvE en vastgoedbeheerder: eerst het best passende bestaande genre. Past er geen, dan staat het onder "Vraagt besluit" en wordt er geen nieuw domein ontworpen.
- "Schermprofiel" is een woord van deze kaart. Het komt in de code niet voor (grep, 19-10). Wat de code wel kent: de rollen per genre (`FUNCS` in `public/apps/leverancier.js`, r. 400-427) en de tabs per cap (r. 160-200). Een schermprofiel is hier dus: de set tabs die de caps van het genre openen, plus de rollen die binnen die tabs mogen handelen. Het is geen nieuw object.
- `apps/leverancier.html` heeft geen functie-id in de wereldcatalogus (`public/shared/interface/workspace-world-catalog.js`) en geen APPWERKT-rij. De `samen`-blokken hieronder gebruiken daarom het voorstel-id `link:leverancier` met een beroepsachtervoegsel; dat id bestaat nog niet en vraagt een besluit (B14).

### A2. De naad met Wonen

Afspraak met de sessie LivingOS-A (sessie `session_01P8cRS3Ug6vMpBgo4fRD8Gz`). Haar kaart: `docs/domeinkaarten/livingos-a.md` op tak `appwerkt/living-a`, sha `3174847c45506e7e31a31083ba34e1ecd74ef7df`, par. 1 Wonen. Twee van haar functies raken deze kaart rechtstreeks:

- **W4 (keten a, "aanbevolen nu" bij haar):** vanuit een melding vraagt het lid een offerte bij een `bouw`- of `vakwerk`-zaak via de bestaande offertestroom `/api/vak/offerte/*` (`server/kern/vakwerk/pro.js`). De offerte draagt het melding-id als verwijzing. Na akkoord toont de melding "vakman gepland". Deze kaart bouwt aan de zaakkant op precies die verwijzing en voegt geen tweede stroom toe. Sinds 4a914ea werkt dat ook voor `vakwerk`. Vandaag kent de offerte nog geen melding-veld: `offerteVraag` bewaart alleen omschrijving en wensdatum (grep "melding" in `server/kern/vakwerk/`: 0 treffers).
- **W16 (ketens b-d, "later" bij haar):** projectie delen met makelaar, verhuurder of VvE, gebouwd op het bestaande delen per bestand (`server/kern/bestanden-delen.js`), met een einddatum en direct intrekken.
- Verhuurder, corporatie, VvE, architect en beheerder staan bij haar als "ontbrekend genre, vraagt besluit", met verwijzing naar deze kaart. De besluiten staan hier per beroep.

De afspraak zelf:

- **Wonen is eigenaar van alle objecten van de bewoner:** woning-projectie, ruimte, bouwdeel, installatie, apparaat, melding, onderhoudsplan, documentdossier (kluis), huurcontract-als-lid, VvE-lidmaatschap en verhuisdossier.
- **De zaak krijgt alleen een projectie, en alleen met toestemming.** Een makelaar ziet nooit het woningdossier; hij ziet wat het lid voor één transactie deelt. Een aannemer ziet de bouwdelen en installaties die bij zijn opdracht horen, niet de rest.
- **De zaak blijft eigenaar van haar eigen werk:** het pand in de portefeuille van de makelaar, de offerte en de werkbon van de aannemer, het huurcontract aan de verhuurderskant, de meldingen van een gebouw. Wat zij naar het lid stuurt, is een verwijzing of een document; het lid bewaart het in zijn eigen dossier.
- **Geld is eigenaar van verplichting en betaling** (huur, termijn, waarborgsom, VvE-bijdrage). Wonen en de zaak verwijzen ernaar en rekenen niet zelf.
- **Bestanden is de opslag van het dossier.** Het woningdossier is de map Woningdossier in Bestanden (`/api/bestanden/*`, `server/routes/bestanden.js`). Delen bestaat vandaag per bestand op codenaam (`/api/bestanden/deel`, `server/kern/bestanden-delen.js`). Drie grenzen voor deze kaart: de ontvanger is een persoon met een codenaam en niet een zaak; wie een gedeeld bestand krijgt, mag er volgens het commentaar ook nieuwe versies op zetten ("de ander kijkt, haalt op en zet nieuwe versies"); en in `public/apps/` roept geen scherm `/api/bestanden/deel` aan (grep 19-10; alleen `public/shared/interface/personal-image-editor.js` noemt het). Voor een projectie naar een makelaar of verhuurder is alleen-lezen nodig; dat is een te nemen besluit bij W16, geen nieuw deelmechanisme.
- **Het Consent Center is de plek waar toestemming staat en wordt ingetrokken** (`privacy.toegang` → `apps/mijn-relaties.html`; `server/routes/consent.js`, `server/kern/consent.js`: `/api/toestemming`, `/api/toestemming/intrek`, `/relaties`, `/relatie/gevolgen`, `/relatie/sluit`). De routes zeggen zelf: "er staat hier niets dat een zaak of een kantoor kan opvragen". Elke projectie naar een zaak hoort dus als partij in dat consent te staan, zodat het lid haar ziet en kan sluiten.
- **Wat er vandaag NIET is:** een keten van een melding naar een zaak. `server/kern/woningonderhoud.js` zegt het zelf: "zonder gekoppelde vakman doen we niet alsof iemand onderweg is". De melding blijft op "gemeld" staan.

Gevolg voor deze kaart: elke functie die een zaak iets van de bewoner laat zien, is een projectie met consent en nooit een kopie in de zaak. Elke functie die iets bij de bewoner neerlegt, is een document of een verwijzing die het lid zelf aanneemt.

### A3. De ketens a–f

Vorm volgens CIVILIS par. 5D: expliciete gebeurtenis of gecontroleerde projectie, nooit een gedeelde tabel.

| Keten | Geeft uit | Ontvangt | Vorm | Toestemming | Bestaand vandaag |
|---|---|---|---|---|---|
| a. Melding | lid (Wonen) | verhuurder, beheerder of corporatie; daarna aannemer | gebeurtenis "melding gedeeld" + projectie van de melding; status terug als verwijzing | per melding, door het lid; doorzetten naar de aannemer door de verhuurder, met bericht aan het lid | `/api/home/onderhoud/meld` (lid); geen keten |
| b. Koop of huur via makelaar | makelaar (aanbod), lid (bod, overdrachtsstukken) | lid, makelaar | aanbod = projectie van het pand; bod = gebeurtenis; overdrachtsprojectie van het lid, per stuk | per stuk, door het lid; intrekbaar tot overdracht | aanbod, bezichtiging en bod bestaan; overdrachtsprojectie en transactiedossier niet. Uitgewerkt in ONTBREKEND (meetbaar), keten b |
| c. Huurcontract en betalingen | verhuurder (contract), Geld (verplichting en betaling) | lid (huurcontract-als-lid) | contract = document naar het dossier van het lid; verplichting = verwijzing naar Geld | het lid neemt het contract aan; betalingsstatus alleen als het lid de verplichting koppelt | huurcontracten alleen in `gebouwplus` (zakelijk) |
| d. VvE | VvE-zaak (vergadering, MJOP, reservefonds, bijdrage) | lid (VvE-lidmaatschap) | projectie van de VvE-zaak naar het lid; stem = gebeurtenis van het lid | lidmaatschap moet door de VvE bevestigd zijn; stem alleen door het lid | niets (grep "VvE": 0 treffers) |
| e. Verbouwing | lid (opdracht), aannemer (uitvoering, oplevering) | lid (opleverdossier), aannemer (opdrachtprojectie) | offerte/akkoord = gebeurtenissen; opdrachtprojectie naar de aannemer; opleverdossier = document in het dossier van het lid | per opdracht, door het lid; bouwdelen per stuk | offerte, akkoord, werkbon bestaan (`/api/vak/*`); opleverdossier niet. Uitgewerkt in ONTBREKEND (meetbaar), keten e |
| f. Woninggeschiedenis (voorstel LivingOS-A) | vertrekkend lid | nieuw lid | kopie met toestemming, van Wonen naar Wonen | door het vertrekkende lid, per onderdeel | niet; de makelaar ziet alleen DAT er een overdracht klaarligt |

**Storingen per keten** (wat de gebruiker ziet en wat bewaard blijft):

- **a. Melding.**
  - Verhuurder heeft geen RTG-zaak: het lid ziet "deze verhuurder is niet aangesloten; uw melding staat in uw eigen dossier", met een exporteerbare tekst. De melding blijft "gemeld".
  - Verhuurder reageert niet binnen de termijn die hij zelf heeft opgegeven: het lid ziet de termijn als verlopen. Er komt geen automatische escalatie naar een aannemer.
  - Lid trekt de melding in (`/api/home/onderhoud/annuleer`): de projectie bij de verhuurder vervalt; zijn eigen afhandeling blijft bij hem met de notitie "ingetrokken door bewoner".
  - Aannemer weigert: de verhuurder ziet de weigering. Het lid ziet "de verhuurder zoekt een andere vakman" pas als de verhuurder dat zelf zet.
  - Tenant-storing: verhuurder B vraagt de melding van verhuurder A op en krijgt 404, niet 403 (geen bestaan lekken).
- **b. Koop of huur.** Zie ONTBREKEND (meetbaar), keten b.
- **c. Huur.**
  - Betaling mislukt in Geld: de verhuurder ziet "niet ontvangen", het lid ziet de mislukte betaling in Geld. Wonen toont alleen de verwijzing.
  - Contract loopt af: `gebouwplus` heeft een looptijdbewaking voor zakelijke huur. Voor woninghuur ontbreekt die (zie verhuurder).
  - Lid koppelt de verplichting niet: de verhuurder ziet geen betalingsstatus via RTG en houdt zijn eigen administratie.
- **d. VvE.**
  - Lid is (nog) niet bevestigd als eigenaar van een appartementsrecht: geen stemrecht; het lid ziet waarom.
  - Quorum niet gehaald: het besluit heet "niet genomen", niet "afgewezen".
  - Een stem achteraf wijzigen kan alleen tot de sluiting van de stemming.
- **e. Verbouwing.** Zie ONTBREKEND (meetbaar), keten e.
- **f. Woninggeschiedenis.**
  - Vertrekkend lid weigert: het nieuwe lid begint met een leeg dossier. De makelaar ziet "geen geschiedenis gedeeld", geen reden.
  - Persoonlijke stukken (polissen, betaalbewijzen) gaan nooit mee; alleen bouwdelen, installaties, onderhoud en opleverdossiers die het lid aanvinkt.

### A4. De CIVILIS-eisen op deze ketens

| Eis (CIVILIS) | Wat het hier betekent |
|---|---|
| Genre-register, geen tweede catalogus (par. 3) | Elke sectorclaim (makelaar, aannemer, verhuurder) staat in het genre-register of in `server/functies/register/`. Een beroep zonder genre krijgt geen eigen lijst. `test/genreregister.test.js` zakt op een genre buiten het register. |
| Een genre zonder werkend gereedschap blijft op `binnenkort` (par. 5A) | Geen woongenre gaat open met alleen `location`. Een eventueel woninghuurgenre gaat pas open als contract, verplichting en melding werken. `vakwerk` was open zonder gereedschap; gerepareerd in 4a914ea (`test/vakwerk-genre.test.js`). |
| Verenigingen via de concernlaag (par. 5B) | Een VvE is een vereniging. Haar plek is de concernlaag en `server/kern/onderneming/rechtsvorm-nl.js` (kent "vereniging"), niet een woongenre. |
| Ketens via gebeurtenis en projectie (par. 5D) | Ketens a–f hierboven. Geen tabel die zaak en lid allebei beschrijven. |
| Proef naar het model van `scripts/ritproef.js`, in de ketenlijst van `scripts/ondernemerbewijs.js` (par. 5F) | Elke keten a–f krijgt een proef met schakels en storingen en een regel in `KETENS`. Vandaag staat er geen enkele woonketen in die lijst; de nauwst verwante is `offerte-factuur` ("Offerte -> opdracht -> factuur", `proef: null`, r. 439). Voor b en e staat het voorstel uitgeschreven in ONTBREKEND (meetbaar). |
| Tenant-storing (par. 3) | Elke keten heeft minstens de storing "zaak B ziet en raakt de gegevens van zaak A niet", en daarbij "zaak ziet niets van het lid zonder consent". |
| Bewijs met menselijke aftekening voor gereguleerd (par. 3) | Vandaag heeft geen woongenre eisen in `BEWIJS_EISEN` (`server/kern/bedrijfscontrole.js`) en geen persoonseis (`server/kern/persoonseis-lijst.js`). Alleen de basiseisen gelden (KVK, bevoegdheid, vergunningenscan, integriteit). Kandidaten voor een eis: architect (titel beschermd, Architectenregister; te controleren), corporatie (toegelaten instelling, Aw; te controleren), makelaar met NVM- of VastgoedCert-claim. Zie "Vraagt besluit". |

### A5. Beroep → genre → caps → rollen → tabs → wat ontbreekt

| Beroep | Genre | Caps | Rollen (FUNCS) | Tabs | Wat ontbreekt |
|---|---|---|---|---|---|
| Makelaar | `vastgoed` (realestate, open) | vastgoed, location, pricing | Makelaar, Bezichtigingen, Backoffice | Vastgoed | transactiedossier, contractobject, Wwft-stap, overdrachtsprojectie van het lid |
| Aannemer | `bouw` (construction, open); `vakwerk` idem | services, location, pricing | geen | geen eigen tab; werkvorm "zelfstandig" | rollen, offerteregels in het scherm, meerwerk, opleverdossier, keten met de melding |
| Verhuurder | beste pasvorm `vastgoed`, deels | vastgoed, location, pricing | Makelaar, Bezichtigingen, Backoffice (passen niet) | Vastgoed | huurder, woninghuurcontract, waarborgsom, servicekosten, inning |
| Woningcorporatie | geen | — | — | — | alles; de code zegt zelf dat sociale huur, corporatie, urgentie en wachtlijst niet bestaan |
| Architect | beste pasvorm `professioneel`; alternatief `zzp` | advies, location, pricing | Officemanager, Advocaat, Notaris, Fiscalist (passen niet) | Praktijk | rollen, ontwerp- en projectflow, titelbewijs |
| VvE | geen woongenre; concernlaag (vereniging) | — | — | — | alles; geen appartementsrecht, vergadering of bijdrage |
| Vastgoedbeheerder | beste pasvorm `kantoorgebouw`, alleen commercieel | gebouw, location, pricing | Receptie, Security, Facilitair, Concierge & jetset | Gebouw | woonunits, portefeuille (één gebouw per zaak), servicekostenafrekening |

Verwante genres die NIET passen: `verhuur` is autoverhuur; `apartment` en `villa` (bookings, doors; rollen Beheer, Housekeeping, Onderhoud) zijn kort verblijf en horen bij TravelOS. `vakwerk`, `schoonmaak`, `hovenier`, `wasserij` en `verhuizer` hebben dezelfde caps als `bouw` en zijn de natuurlijke tweede lijn in keten a en e.

### A6. Productbevindingen

**Gerepareerd in de reparatieronde** (tabel in `docs/domeinkaarten/workos.md` par. 9):

| Bevinding | Commit | Toets |
|---|---|---|
| `gebouwpand` en `gebouwplus` vroegen alleen `supplierAuth`, niet de cap `gebouw`; elke zaak kon er een pand met huurcontracten en keuringen in zetten (geen lek tussen zaken, wel een open genre-grens). Nu één poort `server/kern/gebouw-poort.js` (`eisGebouw`, 403 "Dit is geen kantoorgebouw-partner.") voor drie deuren. | d3d5ce8 | `test/gebouw-cap.test.js` |
| `vakwerk` stond open in het register maar ontbrak in `VAK_GENRES`; `isVak` faalde en een vakwerkzaak kreeg 403 op offertes, capaciteit en werkbon. Nu in `server/kern/vakwerk/genres.js`. | 4a914ea | `test/vakwerk-genre.test.js` |

**Nog open** (gelezen, niet beproefd, NIET gerepareerd):
- `server/routes/supplier/vastgoed/deals.js:80`: de variabele `koop` is `true` bij huur. De uitkomst klopt (soort wordt 'huur'), de naam misleidt.
- `server/routes/supplier/vastgoed/deals.js:96`: het bericht aan het lid zegt "We stellen een contract op." Er is geen contractobject en geen contractstap; het scherm belooft iets wat de code niet doet.
- De poort `isVastgoed` toetst het genre (`s.type === 'vastgoed'`), niet de cap. Een zaak met de cap vastgoed onder een ander genre komt er niet in. Dat is een keuze, maar wel een andere dan bij `gebouw`.
- `offerteVraag` (`server/kern/vakwerk/pro.js`) heeft geen herhaalsleutel. Een dubbele tik maakt twee aanvragen; de enige rem is "tien open aanvragen".
- Het offertescherm van de zaak (`public/apps/leverancier/leverancier-24b.js:6`) stuurt alleen `prijs` en `toelichting`; de regelopbouw van de kern (`regels`, `offertebouw.js`) is vanuit het scherm niet te bereiken.
- Project Room (`apps/project-room.html`, eigenaar `werk.project`, doelgroep kantoor) draait volledig op `officeAuth` (`server/routes/rtgone.js`, `/api/rtgone/*`). Een aannemer (supplierAuth) en een lid (auth) kunnen er vandaag niet in. Dat raakt keten e direct; zie ONTBREKEND en "Vraagt besluit" B3.

### A7. Keten e: de verbouwing (eigenaarsvoorbeeld)

Verhuisd naar **ONTBREKEND (meetbaar), keten e**, waar elke stap een eigenaar, een route en een ONTBREKEND-regel draagt.

### A8. Bewijsstand van wat er is

- APPWERKT.json (stempel 2026-10-19T05:16, commit af81b538): `link:wonen` en `link:maison` BEWEZEN op bereikbaar, bedienbaar, menselijk, voltooibaar, waarheidsgetrouw, persistent en herstelbaar; bevoegd NIET_GETEST. `link:projectroom` (persona kantoor): bereikbaar, bedienbaar en waarheidsgetrouw BEWEZEN; menselijk en bevoegd NIET_GETEST; voltooibaar, persistent en herstelbaar GEEN_FIXTURE. Voltooiproef projectroom lokaal gesloten 4/4 (19-10, dc501544), centraal nog te stempelen.
- Er is GEEN APPWERKT-rij voor de leverancierskant van vastgoed, vakpro of gebouw, en geen functie-id voor `apps/leverancier.html`. Die functies heten in deze kaart "staat, onbewezen".
- De reparaties d3d5ce8 en 4a914ea hebben elk een eigen toets; dat is bewijs voor de grens, niet een APPWERKT-bewijs voor de app.
- IDOR.json: 1999 routes, 0 doorbraken, 0 lekken. Dat zegt niets over de ketens a–f, die bestaan niet.
- Geen woonketen in `KETENS` van `scripts/ondernemerbewijs.js`.

---

## ONTBREKEND (meetbaar)

Dit is een VOORSTEL in de kaart. Er is geen script gewijzigd. De regels volgen de structuur `ONTBREKEND` uit `scripts/lib/appcontract.js` zoals die op de tak `appwerkt/versheid` staat (commit 03734800d, r. 712 e.v.; op `appwerkt/workos` en `claude/appwerkt-integraal` bestaat die structuur nog niet). Velden: `familie`, `naam`, `laag` (`'scherm'`: er is geen knop of weergave; `'kern'`: de server legt de schakel niet), `ontbreekt` (`'keten'`: geen koppeling in de code; `'proef'`: de koppeling bestaat, maar geen proef loopt haar af), `k`, `kaart`, `wat`, `bron` (`[{ bestand, noemt }]`), `zolang` (alleen waar het gat in de code te meten is, vorm `{ geenBestandIn, noemt }`; elke `zolang` hieronder is op 19-10 met grep nagegaan), plus het extra veld `lagen` (`'L5'` of `'L6'`, de laag uit de functiecatalogus).

De familie `woning` bestaat nog niet in `FAMILIES` (daar staat alleen `reis`). Voorstel, als besluit B15:

```js
woning: { wat: 'verkopen, verbouwen en bewonen met een zaak: een woonketen is compleet als de zaak haar werk doet, het lid alleen deelt wat het wil, het resultaat in het eigen woningdossier landt en Geld de gevolgen toont, los en samen',
  kaart: 'docs/domeinkaarten/professionals-wonen.md' }
```

Geld en de simulatiebank: geen van beide ketens raakt vandaag de bankrail (`RAILROUTES` in `scripts/lib/simulatieafloop.js` op `appwerkt/versheid`): het bod boekt een factuur via `facturatie.boek` en het akkoord maakt een boeking met `betaalMoment: 'achteraf'`, zonder betaling. Komt er in een latere versie een betaling bij (aanbetaling, termijn, waarborgsom), dan legt de proef de afloop vast met `afloopVan` of `kiesRef` uit dat bestand en roept hij `vraag(...)` aan voor het stempel. Nooit een per run verschillende sleutel.

### Keten b. Verkoop en overdracht met de makelaar

**Stappen, met eigenaar per stap.** Eigenaar = de capability uit SCHERMEIGENAAR.json die het object bezit.

| # | Stap | Wie handelt | Eigenaar (capability) | Route of plek | Stand | ONTBREKEND-regel |
|---|---|---|---|---|---|---|
| 1 | Pand in portefeuille, aanbieding aan leden | makelaar (rol Makelaar of Backoffice) | `zaak.beheer` | `/api/supplier/pand`, `/api/supplier/aanbieding` | bestaat, onbewezen | `makelaar-ketenproef` |
| 2 | Lid ziet aanbod en vraagt bezichtiging | lid | `zaak.beheer` (aanbod), lid leest | `/api/vastgoed/aanbod`, `/interesse`; scherm `app-main-17.js` | bestaat, onbewezen | `makelaar-ketenproef` |
| 3 | Bezichtiging beslissen, keyless | rol Bezichtigingen | `zaak.beheer` | `/api/supplier/bezichtiging/beslis`, `server/kern/vastgoed-keyless-toegang.js` | bestaat; elke medewerker mag, rol niet afgedwongen | `makelaar-rolgrens` |
| 4 | Bod uitbrengen | lid | lid (bod), `zaak.beheer` (beslissing) | `/api/vastgoed/bod`; scherm `app-main-18.js` | bestaat, onbewezen | `makelaar-ketenproef` |
| 5 | Bod beslissen (accepteren, afwijzen, tegenbod) | rol Makelaar | `zaak.beheer` | `/api/supplier/bod/beslis` (managerOnly); `facturatie.boek` met 0% btw | bestaat; manager-grens wel, rolgrens niet; belooft een contract dat er niet is | `makelaar-rolgrens`, `bod-naar-contractbelofte` |
| 6 | Transactiedossier opent bij acceptatie | systeem, binnen de zaak | `zaak.beheer` | ontbreekt | ontbreekt | `bod-naar-transactiedossier` |
| 7 | Lid deelt overdrachtsstukken per stuk | lid | `woning.dossier` (stukken), `privacy.toegang` (consent) | `/api/bestanden/deel` (kern, geen scherm; ontvanger is persoon, niet zaak) | half | `dossier-naar-makelaar-projectie`, `overdracht-deelknop` |
| 8 | Wwft-stap als signaal in het dossier | rol Makelaar, mens | `zaak.beheer` | ontbreekt; RTG iD-niveau als bron | ontbreekt | `transactiedossier-wwft-stap` |
| 9 | Koopovereenkomst als contract | Makelaar + lid tekenen | `werk.onderneming`-kant van het contractregister (`server/bedrijf/contract.js`), besluit B2 | ontbreekt als brug | ontbreekt | `transactiedossier-naar-contract` |
| 10 | Notarisdatum en overdracht | rol Makelaar (notaris extern) | `zaak.beheer` | ontbreekt | ontbreekt | `bod-naar-transactiedossier` |
| 11 | "Overdracht voltooid" naar Wonen (alleen DAT, geen inhoud) | systeem | `woning.overzicht` | ontbreekt | ontbreekt | `overdracht-naar-wonen` |

**ONTBREKEND-regels voor keten b:**

```js
const KAART_WONEN = 'docs/domeinkaarten/professionals-wonen.md';
[
  { familie: 'woning', naam: 'makelaar-ketenproef', laag: 'kern', ontbreekt: 'proef', k: 'K1', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'aanbod, bezichtiging en bod bestaan en zijn met elkaar verbonden, maar geen proef loopt ze af; een keten zonder proef is een bewering',
    bron: [{ bestand: 'server/routes/supplier/vastgoed/portefeuille.js', noemt: '/api/supplier/aanbieding' },
           { bestand: 'server/routes/supplier/vastgoed/deals.js', noemt: '/api/supplier/bod/beslis' },
           { bestand: 'server/routes/member/handel/vastgoed.js', noemt: '/api/vastgoed/bod' }] },
  { familie: 'woning', naam: 'makelaar-rolgrens', laag: 'kern', ontbreekt: 'keten', k: 'K2', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'de rollen Makelaar, Bezichtigingen en Backoffice staan alleen als lijst in het scherm; de server kent alleen manager of medewerker. /api/supplier/bod/beslis is managerOnly, maar /api/supplier/bezichtiging/beslis laat elke medewerker beslissen, ook Backoffice, en een medewerker met rol Makelaar die geen manager is kan geen bod behandelen',
    bron: [{ bestand: 'public/apps/leverancier.js', noemt: 'FUNCS' }, { bestand: 'server/routes/supplier/vastgoed/deals.js', noemt: 'managerOnly' }] },
  { familie: 'woning', naam: 'bod-naar-contractbelofte', laag: 'scherm', ontbreekt: 'keten', k: 'K3', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'het bericht na acceptatie belooft "We stellen een contract op", maar er is geen contractstap; het lid krijgt een belofte zonder schakel',
    bron: [{ bestand: 'server/routes/supplier/vastgoed/deals.js', noemt: 'We stellen een contract op' }] },
  { familie: 'woning', naam: 'bod-naar-transactiedossier', laag: 'kern', ontbreekt: 'keten', k: 'K4', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'een geaccepteerd bod opent geen transactiedossier; verkocht en verhuurd worden alleen geteld, notaris en overdracht hebben geen stap',
    zolang: { geenBestandIn: 'server/', noemt: 'transactiedossier' } },
  { familie: 'woning', naam: 'transactiedossier-wwft-stap', laag: 'kern', ontbreekt: 'keten', k: 'K5', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'het cliëntenonderzoek heeft geen stap met naam en datum; het wordt een signaal (te controleren), geen weigerregel, en RTG meldt niets namens de makelaar' },
  { familie: 'woning', naam: 'dossier-naar-makelaar-projectie', laag: 'kern', ontbreekt: 'keten', k: 'K6', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'delen kan alleen per bestand met een codenaam (persoon), met schrijfrecht voor de ontvanger; een alleen-lezen projectie naar een zaak met een consentregel bestaat niet',
    bron: [{ bestand: 'server/kern/bestanden-delen.js', noemt: 'gedeeldMet' }],
    zolang: { geenBestandIn: 'server/routes/supplier/vastgoed/', noemt: 'consent' } },
  { familie: 'woning', naam: 'overdracht-deelknop', laag: 'scherm', ontbreekt: 'keten', k: 'K7', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'geen scherm in public/apps/ roept /api/bestanden/deel aan: het lid kan een stuk uit Woningdossier niet aan de makelaar geven' },
  { familie: 'woning', naam: 'transactiedossier-naar-contract', laag: 'kern', ontbreekt: 'keten', k: 'K8', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'het contractregister kent soorten, tekenen met twee namen en een klok, maar hangt aan een Werk OS-werkruimte en niet aan een leverancierszaak (besluit B2)',
    bron: [{ bestand: 'server/bedrijf/contract.js', noemt: 'SOORTEN' }] },
  { familie: 'woning', naam: 'overdracht-naar-wonen', laag: 'kern', ontbreekt: 'keten', k: 'K9', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'een voltooide overdracht laat Wonen niets weten; keten f (woninggeschiedenis) heeft daardoor geen begin' }
]
```

**Proefinstrument (voorstel).** Een nieuwe ketenproef `scripts/overdrachtproef.js`, in dezelfde vorm als `scripts/ritproef.js` en zonder gedeelde module (ritproef zegt waarom: `scripts/ketenvorm.js` telt achteraf wat ketens delen):
- `schakel(nr, van, naar, wat, bekend)` per stap; een open schakel met een uitgeschreven reden (`bekend`, met verwijzing naar het besluit) heet `openBekend`, nooit gesloten.
- `noteer(naam, belofte, klopt, wat)` per storing, met `gehouden` of `gebroken`.
- `telling` met `schakels, gesloten, open, openBekend, stuk, storingen, gehouden, gebroken`; `sluit` als open, stuk, gebroken en openBekend nul zijn en er minstens 7 schakels zijn (dezelfde drempel als ritproef).
- Register `OVERDRACHTPROEF.json` met het volle stempel uit `scripts/lib/stempel.js`; draaien met `npm run overdrachtproef` en `npm run overdrachtproef:vast` (`--vastleggen`), naast `ritproef` in `package.json` r. 401-402.
- De wereld via de echte toelatingsweg, zoals `scripts/voorraadproef.js` r. 111-131: twee `vastgoed`-zaken (A en B, B voor de tenant-naad), via `/api/auth/register`, `/api/aanmelding/aanvraag` (`bedrijf.type: 'vastgoed'`), `/beslis`, `/termijn-voldaan` en `/api/supplier/mijn/login`; twee leden (koper en een derde). Personeel met rol Bezichtigingen via `/api/supplier/staff/add`, zoals ritproef r. 120.
- Plek in de ketenlijst: een nieuwe regel in `KETENS` van `scripts/ondernemerbewijs.js` direct na `offerte-factuur` (r. 439-441):

```js
{ id: 'woning-overdracht', naam: 'Aanbod -> bod -> transactiedossier -> overdracht', proef: 'OVERDRACHTPROEF.json', dekt: 'deels',
  waar: 'scripts/overdrachtproef.js -- 11 schakels, 7 storingen, twee makelaars en twee leden',
  mist: 'notaris en koopakte blijven extern; tot K4-K9 gebouwd zijn, eindigen schakels 6-11 als openBekend en dekt de proef hooguit deels' }
```

`dekt` wordt gelezen en niet verklaard: zolang het register een open, stuk of gebroken schakel heeft, maakt `ondernemerbewijs.js` er zelf `geen` van.

**Storingen** (elk met de belofte die de proef toetst):
1. Twee gelijktijdige beslissingen op hetzelfde bod: de tweede krijgt "al beslist" (409); er is één factuur.
2. Rolgrens: een medewerker (geen manager) roept `/api/supplier/bod/beslis` aan en wordt geweigerd met een melding in woorden (vandaag gehouden, managerOnly); een medewerker met rol Backoffice roept `/api/supplier/bezichtiging/beslis` aan en hoort geweigerd te worden (vandaag gebroken; K2).
3. **Tenant-storing:** makelaar B vraagt het bod, het pand en (na K4) het transactiedossier van makelaar A op en krijgt niets: 404, geen bestaan lekken.
4. Zaak ziet niets van het lid zonder consent: zonder deelregel is er geen enkel stuk uit Woningdossier zichtbaar voor makelaar A.
5. Lid trekt een gedeeld stuk in vóór de overdracht: het stuk verdwijnt uit de projectie; de regel in het consentjournaal blijft.
6. Keyless bezichtiging met een verlopen code: de deur blijft dicht; de makelaar ziet de poging.
7. Een derde lid ziet het bod van de koper niet, en de koper ziet de hoogte van andere biedingen niet.

**Meetbare uitslag.** `OVERDRACHTPROEF.json` met `telling`. Vandaag te verwachten: schakels 1-5 gesloten, 6-11 `openBekend` met verwijzing naar K4-K9, storing 2 gebroken. De keten heet `sluit` als alle 11 schakels gesloten en alle 7 storingen gehouden zijn. De regel `woning-overdracht` in `ONDERNEMERBEWIJS.json` draagt dan `dekt: 'sluit'` en een verse stempel. Elke ONTBREKEND-regel K1-K9 gaat er pas af als zijn schakel gesloten is; een opgelost gat met een `zolang` dat blijft staan, maakt de controle rood.

### Keten e. Verbouwing (Wonen, aannemersgenre `bouw`, Project Room, Geld, RTDocs, stuurlaag)

Rolverdeling volgens de eigenaar: Wonen heeft het woningdossier, het aannemersgenre (`bouw`, ook `vakwerk`) heeft de uitvoering, Project Room ondersteunt de samenwerking, Geld toont de financiële gevolgen, RTDocs en Bestanden hebben de documenten, de stuurlaag bewaakt toestemming en uitvoering.

| # | Stap | Wie handelt | Eigenaar (capability) | Route of plek | Stand | ONTBREKEND-regel |
|---|---|---|---|---|---|---|
| 1 | Wens vastleggen ("badkamer vernieuwen") | lid | `woning.onderhoud` | `/api/home/onderhoud/meld` (`server/kern/woningonderhoud.js`); scherm `wonen.js` | bestaat, BEWEZEN via `link:wonen` | — |
| 2 | Offerte vragen vanuit de melding | lid | `zaak.beheer` (offerte), `woning.onderhoud` (melding) | `/api/vak/offerte/vraag` bestaat (scherm `mall.html`); melding-id ontbreekt | half | `melding-naar-offertevraag`, `offertevraag-herhaalsleutel` |
| 3 | Opdrachtprojectie delen (ruimte, bouwdelen, installaties) | lid | `woning.dossier`, `privacy.toegang` | ontbreekt | ontbreekt | `dossier-naar-aannemer-projectie` |
| 4 | Offerte uitbrengen met regels (materiaal, arbeid) | aannemer, alleen manager | `zaak.beheer` | `/api/supplier/vak/offerte/antwoord`; kern kent `regels`, scherm stuurt alleen `prijs` | half | `offerteregels-scherm` |
| 5 | Financieel gevolg zien | lid | `geld.overzicht` | `/api/geld/pot/reserveer` bestaat; koppeling offerte → pot ontbreekt | half | `offerte-naar-geldpot` |
| 6 | Akkoord, via de stuurlaag alleen met bevestiging | lid | `zaak.beheer` (boeking), stuurlaag (`server/routes/stuur.js`) | `/api/vak/offerte/akkoord` (scherm `mall.html`); `/api/member/doe/bevestig` | bestaat, onbewezen | `verbouw-ketenproef` |
| 7 | Plannen en uitvoeren | aannemer | `zaak.beheer` | `/api/supplier/vak/capaciteit`, boeking uit het akkoord | bestaat, onbewezen | `verbouw-ketenproef` |
| 8 | Samenwerken (vragen, foto's, meerwerk) | lid en aannemer | `werk.project` (Project Room) of de Werk OS-praktijk, besluit B3 | Project Room alleen `officeAuth` | ontbreekt | `verbouw-samenwerkruimte` |
| 9 | Meerwerk als nieuw akkoord | aannemer stelt voor, lid akkoord | `zaak.beheer` | ontbreekt | ontbreekt | `meerwerk-akkoord` |
| 10 | Werkbon en afsluiting | aannemer (medewerker schrijft) | `zaak.beheer` | `/api/supplier/vak/werkbon`, `server/kern/vakwerk/pro2.js` | bestaat, onbewezen | `verbouw-ketenproef` |
| 11 | Opleverdossier naar het woningdossier | aannemer → lid | `woning.dossier` (map Woningdossier, `docs.bestanden`); RTDocs (`docs.office`) voor het samenstellen | ontbreekt | ontbreekt | `werkbon-naar-opleverdossier` |
| 12 | Bouwdelen bijwerken uit het opleverdossier | lid neemt aan | `woning.dossier` | ontbreekt | ontbreekt | `opleverdossier-naar-bouwdeel` |
| 13 | Review en herhaalonderhoud | lid, aannemer | `zaak.beheer` | `/api/vak/review` (scherm `mall.html`), `/api/vak/ritme/start` | bestaat, onbewezen | `verbouw-ketenproef` |

**ONTBREKEND-regels voor keten e:**

```js
[
  { familie: 'woning', naam: 'verbouw-ketenproef', laag: 'kern', ontbreekt: 'proef', k: 'K10', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'offerte, akkoord (dat een boeking maakt), werkbon en review zijn verbonden, maar geen proef loopt ze af; offerte-factuur in KETENS heeft proef: null',
    bron: [{ bestand: 'server/kern/vakwerk/pro.js', noemt: 'offerteAkkoord' }, { bestand: 'server/kern/vakwerk/pro2.js', noemt: 'werkbonZet' }] },
  { familie: 'woning', naam: 'melding-naar-offertevraag', laag: 'kern', ontbreekt: 'keten', k: 'K11', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'een offertevraag draagt geen melding-id; de melding in Wonen blijft "gemeld" en weet niets van de offerte (W4 van LivingOS-A)',
    zolang: { geenBestandIn: 'server/kern/vakwerk/', noemt: 'melding' } },
  { familie: 'woning', naam: 'offertevraag-herhaalsleutel', laag: 'kern', ontbreekt: 'keten', k: 'K12', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'offerteVraag heeft geen herhaalsleutel: een dubbele tik geeft twee aanvragen bij de aannemer',
    bron: [{ bestand: 'server/kern/vakwerk/pro.js', noemt: 'offerteVraag' }] },
  { familie: 'woning', naam: 'dossier-naar-aannemer-projectie', laag: 'kern', ontbreekt: 'keten', k: 'K13', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'de aannemer ziet alleen de omschrijving (max. 300 tekens); een projectie van ruimte, bouwdelen en installaties met consent per opdracht bestaat niet' },
  { familie: 'woning', naam: 'offerteregels-scherm', laag: 'scherm', ontbreekt: 'keten', k: 'K14', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'de kern bouwt een offerte uit regels (offertebouw.js), maar het zaakscherm stuurt alleen prijs en toelichting: een materiaalstaat is niet in te voeren',
    bron: [{ bestand: 'public/apps/leverancier/leverancier-24b.js', noemt: '/supplier/vak/offerte/antwoord' }] },
  { familie: 'woning', naam: 'offerte-naar-geldpot', laag: 'kern', ontbreekt: 'keten', k: 'K15', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'een aangeboden offerte is geen verwijzing in Geld; het lid ziet pot en offerte niet naast elkaar (de zaak hoort de pot nooit te zien)' },
  { familie: 'woning', naam: 'verbouw-samenwerkruimte', laag: 'kern', ontbreekt: 'keten', k: 'K16', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'Project Room draait volledig op officeAuth; een aannemer en een lid kunnen er niet in. De Werk OS-praktijk heeft wel een gastlink, maar hangt aan een werkruimte en niet aan een leverancierszaak (besluit B3)',
    bron: [{ bestand: 'server/routes/rtgone.js', noemt: 'officeAuth' }, { bestand: 'server/bedrijf/praktijk-gast.js', noemt: '/api/werk-gast/beeld' }] },
  { familie: 'woning', naam: 'meerwerk-akkoord', laag: 'kern', ontbreekt: 'keten', k: 'K17', kaart: KAART_WONEN, lagen: 'L5',
    wat: 'meerwerk bestaat niet: na akkoord is de offerte gesloten en kan er geen aanvullende regel met een nieuw akkoord bij',
    zolang: { geenBestandIn: 'server/', noemt: 'meerwerk' } },
  { familie: 'woning', naam: 'werkbon-naar-opleverdossier', laag: 'kern', ontbreekt: 'keten', k: 'K18', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'de werkbon (werk max. 300, materiaal max. 200 tekens) is het eindpunt; er gaat geen opleverdossier als document naar de map Woningdossier van het lid',
    zolang: { geenBestandIn: 'server/', noemt: 'opleverdossier' } },
  { familie: 'woning', naam: 'opleverdossier-naar-bouwdeel', laag: 'scherm', ontbreekt: 'keten', k: 'K19', kaart: KAART_WONEN, lagen: 'L6',
    wat: 'Wonen heeft geen knop om een installatie of bouwdeel uit een ontvangen opleverdossier over te nemen met herkomst' }
]
```

**Proefinstrument (voorstel).** Een nieuwe ketenproef `scripts/verbouwproef.js`, in de vorm van `scripts/ritproef.js` (schakels, storingen, `telling`, `sluit` bij minstens 7 schakels), register `VERBOUWPROEF.json` met het volle stempel, `npm run verbouwproef` en `npm run verbouwproef:vast`.
- De wereld: twee `bouw`-zaken en één `vakwerk`-zaak via de echte toelatingsweg (zoals `scripts/voorraadproef.js`), het lid met een melding in Wonen, een tweede lid voor de consent-naad. Een medewerker via `/api/supplier/staff/add`.
- De stuurlaag: het akkoord loopt één keer rechtstreeks (`/api/vak/offerte/akkoord`) en één keer als voorstel via `/api/member/doe`; de proef toetst dat er zonder `/api/member/doe/bevestig` niets gebeurt.
- Plek in de ketenlijst van `scripts/ondernemerbewijs.js`: een nieuwe regel direct na `offerte-factuur` (en na `woning-overdracht`). `offerte-factuur` blijft staan: de verbouwproef loopt niet tot een factuur (het akkoord maakt een boeking met `paid: false`), en een halve keten mag een andere keten niet groen rekenen.

```js
{ id: 'verbouwing', naam: 'Melding -> offerte -> akkoord -> werkbon -> opleverdossier', proef: 'VERBOUWPROEF.json', dekt: 'deels',
  waar: 'scripts/verbouwproef.js -- 13 schakels, 8 storingen, twee bouwzaken, een vakwerkzaak en twee leden',
  mist: 'factuur en betaling liggen bij factuur-grootboek; Wkb-meldingen gaan extern via de kwaliteitsborger (voorbehouden); schakels 2, 3, 5, 8, 9, 11 en 12 blijven openBekend tot K11-K19 gebouwd zijn' }
```

**Storingen** (elk met de belofte die de proef toetst):
1. **Tenant-storing:** aannemer B vraagt de offerte, de boeking en de werkbon van aannemer A op en krijgt niets (404 "Offerte niet gevonden." of "Boeking niet gevonden."), en kan er niet op antwoorden.
2. Zaak ziet niets van het lid zonder consent: zonder opdrachtprojectie ziet de aannemer alleen de omschrijving, geen ruimte, bouwdeel of installatie.
3. Een medewerker beantwoordt een offerte: geweigerd (manager beslist de prijs).
4. Dubbele tik op akkoord: de tweede geeft 409 ("staat niet open voor akkoord"); er is één boeking.
5. Dubbele tik op offerte vragen: vandaag twee aanvragen (gebroken tot K12).
6. Werkbon op een klus die niet afgerond is: 409 "Een werkbon hoort bij een afgeronde klus."; een tweede werkbon: 409.
7. Stuurlaag: een voorstel tot akkoord via `/api/member/doe` zonder `/doe/bevestig` laat de offerte op "aangeboden".
8. Lid trekt een offerte in die al akkoord is: 409 "Deze offerte is al akkoord; overleg met de zaak."; de boeking blijft bij beide.

**Meetbare uitslag.** `VERBOUWPROEF.json` met `telling`. Vandaag te verwachten: schakels 1, 4 (alleen prijs), 6, 7, 10 en 13 gesloten; 2, 3, 5, 8, 9, 11 en 12 `openBekend` met verwijzing naar K11-K19; storing 5 gebroken. De keten heet `sluit` als alle 13 schakels gesloten en alle 8 storingen gehouden zijn; dan draagt `verbouwing` in `ONDERNEMERBEWIJS.json` `dekt: 'sluit'`. Elke regel K10-K19 gaat er pas af als zijn schakel gesloten is.

**Externe en voorbehouden grenzen in keten e.** Bij gevolgklasse 1 nieuwbouw gaan de bouwmelding en de gereedmelding via de kwaliteitsborger naar de gemeente (Wkb; te controleren). RTG dient niets in (voorbehouden). De Wkb voor verbouw is volgens de zoekbron voorlopig niet doorgegaan (iplo.nl, geraadpleegd 2026-10-19, via zoektool, live te controleren). Het opleverdossier toont per onderdeel uit BW 7:757a "aanwezig" of "ontbrekend" als signaal (te controleren), nooit als weigering; RTG beoordeelt niet of de inhoud klopt.

---

## 1. Makelaar (genre `vastgoed`)

**Volledige werkzaamheid:** een makelaar zet een pand in zijn portefeuille, biedt het aan leden aan, laat bezichtigen, behandelt de biedingen en brengt een geaccepteerd bod via een transactiedossier (koopovereenkomst, notarisdatum) tot de overdracht, met de stukken die het lid zelf per stuk deelt; het eindpunt is een gesloten dossier dat 7 jaar terug te lezen is en een melding "overdracht voltooid" in Wonen. Toets: `scripts/overdrachtproef.js` sluit met 11 schakels en 7 gehouden storingen.

Genre `vastgoed` ("Vastgoed & makelaar", sector realestate, open, `server/seed/genres-lijst-b.js:34`). Caps vastgoed, location, pricing. Tab "Vastgoed". Rollen Makelaar, Bezichtigingen, Backoffice. Ingang `apps/leverancier.html` (`zaak.beheer`). Tegenpartij: het lid via `/api/vastgoed/*`.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Portefeuille: pand aanmaken (woning, appartement, villa, commercieel, grond; koop of huur), foto's | `server/routes/supplier/vastgoed/portefeuille.js` (`/api/supplier/pand`, `/pand/foto`); opslag `supplier.panden` | staat, onbewezen |
| Aanbieding aan leden of publiek aan volgers | `/api/supplier/aanbieding` (zelfde bestand) | staat, onbewezen |
| Overzicht van de zaak | `/api/supplier/vastgoed/overzicht` (`server/routes/supplier/vastgoed/deals.js`) | staat, onbewezen |
| Bezichtiging beslissen, keyless toegang | `/api/supplier/bezichtiging/beslis` (elke medewerker); `server/kern/vastgoed-keyless-toegang.js` | staat, onbewezen |
| Bod beslissen: accepteren, afwijzen, tegenbod | `/api/supplier/bod/beslis` (managerOnly); bij accepteren gaat het pand op onder-optie en boekt `facturatie.boek` met 0% btw | staat, onbewezen |
| Lid: aanbod, interesse, bod, keyless | `server/routes/member/handel/vastgoed.js` (`/api/vastgoed/aanbod`, `/interesse`, `/bod`, `/keyless`); schermen `public/apps/app-main/app-main-17.js` en `-18.js` | staat, onbewezen |
| Makelaarsbackoffice in het scherm | `public/apps/leverancier.js` vanaf r. 4089 ("de slimme makelaars-backoffice"); bundel `public/apps/leverancier/leverancier-28.js` | staat, onbewezen |

- Bewijs: geen APPWERKT-rij voor de vastgoedkant van de zaak; geen keten in `scripts/ondernemerbewijs.js`. BEVOEGD en IDOR dekken de routes generiek (IDOR: 0 doorbraken over 1999 routes).
- Zelf opgegeven als niet gebouwd: het transactiedossier. Er is geen contractobject en geen notarisstap; het bericht zegt alleen "We stellen een contract op" (`deals.js:96`). Verkocht en verhuurd worden alleen geteld.
- `server/kern/knelpunt/openingen-kaart.js:107-114` zegt over dit aanbod: "commercieel aanbod en geen woonvoorziening".

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Realworks (eigendom NVM) (te controleren) | CRM Base €125 en Pro €190 per maand; modules €15-50: NWWI, Workflow (alleen Pro), Facturatie, VoIP, BOG, Nieuwbouw (alleen Pro, plus €25 per project per jaar), A&LV; app per gebruiker; klantportaal Move.nl €10 per object; taxatie | CRM half (portefeuille, aanbod, bod); workflow nee; klantportaal half (het lid ziet zijn bod); nieuwbouw nee; taxatie nee |
| Kolibri (te controleren) | CRM €113 per maand voor 3 gebruikers, plus klantportaal per object | CRM half; klantportaal half |

Bronnen: https://www.realworks.nl/prijzen en https://kolibri.software/prijzen/, geraadpleegd 2026-10-19 (via zoektool, live te controleren). Merken staan hier alleen ter vergelijking, nooit als partner.

### c. Analyse van het volledige domein

- **Particulier:** een lid verkoopt of koopt een woning één of twee keer in tien jaar. Hij wil zien waar zijn bod staat, welke stukken de makelaar heeft, en wat er na het akkoord gebeurt (koopakte bij de notaris).
- **Professioneel:** woningmakelaardij is sinds 2001 geen beschermd beroep; de NVM pleit voor wettelijke normen (https://www.nvm.nl/nieuws/2026/nvm-wettelijke-kwaliteitsnormen-nodig-voor-alle-woningmakelaars/) (te controleren). NVM Wonen vraagt inschrijving in de kamer Wonen van VastgoedCert, de SVMNIVO-praktijktoets, per vestiging minstens één Register Makelaar, en valt onder Erecode en tuchtrecht (https://www.nvm.nl/media/wuhl3gld/reglement-lidmaatschap-en-aansluiting-2024.pdf) (te controleren). PE: 6 verplichte en 6 facultatieve punten per jaar, elke 5 jaar de Niveaumeting (https://www.vastgoedcert.nl/ik-ben-gecertificeerd-makelaar/mijn-permanente-educatie/) (te controleren). Taxateurs: NRVT-register (te controleren). Alle bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wwft:** cliëntenonderzoek en melden van ongebruikelijke transacties. Volgens de bron zijn de toezichthouders per 1-1-2026 gefuseerd tot DFEI (https://www.rijksoverheid.nl/onderwerpen/financiele-sector/aanpak-witwassen-en-financiering-terrorisme/veelgestelde-vragen-wwft) (te controleren).
- **Bewaarplicht:** fiscale administratie 7 jaar, onroerende zaken 10 jaar (art. 52 AWR; domein-max.txt) (te controleren).
- **Koopovereenkomst:** schriftelijk, met bedenktijd voor de particuliere koper. Bron niet opgehaald (te controleren).
- **Wat dat voor software betekent:**
  - het cliëntenonderzoek is een stap met naam en datum, uitgevoerd door een mens bij de makelaar; RTG toont hem als signaal (te controleren) en meldt niets namens de makelaar (voorbehouden);
  - het transactiedossier bewaart stukken met herkomst en datum; de termijn staat als signaal "minstens 7 jaar (te controleren)", niet als harde wisgrens;
  - een "Register Makelaar"- of NVM-claim op de zaak is een claim die een mens van RTG aftekent, en geen vrij tekstveld;
  - de notaris blijft extern; RTG toont de stap, voert hem niet uit.

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid als koper of verkoper; eigenaar Wonen, de makelaar ziet een projectie)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Mijn bod en zijn stand | bestaat (`/api/vastgoed/bod`) | `db.data.biedingen` | alleen eigen biedingen | geen | lid bij elke beslissing van de makelaar | lid | tegenbod | het lid ziet binnen één scherm bedrag, stand en tegenbod | klein | VERDIEPING (melding bij beslissing) |
| Eerlijk bericht na acceptatie | half: belooft "We stellen een contract op" (`deals.js:96`) | bodstatus | het bericht noemt alleen wat er werkelijk volgt | — | lid bij acceptatie | — | — | geen bericht belooft een contract zolang er geen contractstap is | klein | HERSTEL |
| Overdrachtsprojectie (keten b) | ontbreekt (K6, K7) | stukken uit het woningdossier (Bestanden) | per stuk aangevinkt; alleen-lezen; intrekbaar tot overdracht | wat al gedownload is, ligt buiten RTG | makelaar bij delen en intrekken | lid geeft; Backoffice-rol leest | stuk zonder versie | het lid deelt drie stukken, trekt er één in, en de makelaar ziet er twee | middel | VERDIEPING |

**L2 Professioneel**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Transactiedossier per pand | ontbreekt (K4) | pand, bod, overdrachtsprojectie, contract uit `server/bedrijf/contract.js` (soorten, tekenen met twee namen, klok) | één dossier per geaccepteerd bod; stappen bod → koopovereenkomst → notaris → overdracht; elke stap met datum en wie | notarisdatum is extern | Makelaar en Backoffice bij elke stap; lid bij koopovereenkomst en overdracht | Makelaar schrijft; Bezichtigingen leest niet | huur heeft geen notarisstap | na acceptatie van een bod staat er één dossier met vier stappen; afvinken van "notaris" vraagt een datum | middel | VERDIEPING |
| Wwft-stap als signaal | ontbreekt (K5) | identiteit via RTG iD (niveau, niet het nummer) | stap met naam en datum; staat hij open bij "koopovereenkomst", dan toont het dossier het signaal "Wwft-stap niet afgevinkt (te controleren)" en legt vast wie toch doorging | de beoordeling is van de makelaar; de wetsregel is niet zelf nagelezen | Makelaar | alleen rol Makelaar vinkt af | lid zonder gekeurde identiteit: stap blijft open, signaal blijft staan | het dossier toont bij elke overgang of de stap is afgevinkt, door wie en wanneer; RTG weigert niets op grond van de Wwft | middel | VERDIEPING |
| Bezichtigingsplanning per medewerker | half (beslissen bestaat; geen toewijzing) | agenda van de zaak | rol Bezichtigingen krijgt een bezichtiging toegewezen | geen | medewerker bij toewijzing | Bezichtigingen | keyless zonder medewerker | een bezichtiging heeft een naam van een medewerker of het woord "keyless" | klein | later |

**L3 Organisatorisch**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen afdwingen per handeling | half: server kent manager/medewerker (bod managerOnly); FUNCS-rollen alleen als lijst (`public/apps/leverancier.js:413`) (K2) | FUNCS, actor | bod beslissen alleen Makelaar; bezichtiging alleen Bezichtigingen of Makelaar; foto en aanbieding ook Backoffice | geen | — | manager wijst rollen toe | eenmanszaak heeft alle rollen | Backoffice krijgt 403 op `/api/supplier/bezichtiging/beslis`, met een melding in woorden | klein | HERSTEL (rolgrens) |
| Certificeringsclaim (Register Makelaar, NVM) | ontbreekt | stuk geüpload door de zaak | claim zichtbaar pas na aftekening door een mens van RTG; vervalt op de geldigheidsdatum | RTG valideert niet inhoudelijk | kantoor bij indienen; zaak bij verlopen | manager dient in; kantoor tekent af | geen claim = niets tonen | zonder aftekening ziet het lid geen certificaat | middel | later (hangt aan besluit B1) |

**L4 Domeinintelligentie**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Tijd-tot-bod per pand | ontbreekt | aanbiedingsdatum en eerste bod | telling in dagen | klein aantal panden: geen trend | Makelaar wekelijks | Makelaar, manager | panden zonder bod | het getal heet "gemeten", nooit "verwacht" | klein | later |
| Vraagprijsadvies | ontbreekt | geen marktdata in RTG | — | geen bron | — | — | — | — | groot | niet doen: geen eigen transactiedata en geen NWWI; een getal zonder bron is een voorspelling die als feit gelezen wordt |

**L5 Volledige levenscyclus** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Pand opnemen en aanbieden | bestaat, onbewezen (`portefeuille.js`) | pand, foto's, transactie koop/huur | één pand per object; status te koop → onder optie → verkocht | — | volgers bij aanbieding | Makelaar, Backoffice | foto-upload faalt: pand zonder foto met melding | een aangeboden pand staat in `/api/vastgoed/aanbod` van een lid | — | bestaat; bewijzen via K1 |
| L5.2 Bezichtiging | bestaat, onbewezen | bezichtigingsverzoek, keyless code | bevestigen of afwijzen; keyless alleen met geldige code | — | lid bij beslissing | Bezichtigingen (na K2) | verlopen code: deur dicht, poging zichtbaar | het lid ziet het bevestigde moment; een verlopen code opent niets | — | bestaat; HERSTEL rolgrens (K2) |
| L5.3 Bod en beslissing | bestaat, onbewezen | biedingen | accepteren, afwijzen, tegenbod; één beslissing per bod | — | lid bij elke beslissing | manager (vandaag), Makelaar (na K2) | gelijktijdige beslissingen: tweede "al beslist" | er is één factuurboeking per geaccepteerd bod | — | bestaat; HERSTEL bericht (K3) |
| L5.4 Transactiedossier | ontbreekt (K4) | bod, pand, stukken | opent bij acceptatie; vier stappen met datum en wie | notarisdatum extern | Makelaar, Backoffice, lid bij stap 2 en 4 | Makelaar schrijft | huur: geen notarisstap | precies één dossier per geaccepteerd bod, ook bij dubbele tik | middel | VERDIEPING |
| L5.5 Stukken van het lid | ontbreekt (K6, K7) | Woningdossier | per stuk, alleen-lezen, intrekbaar | gedownload = buiten RTG | makelaar bij delen/intrekken | lid geeft, consent in `privacy.toegang` | lid zonder dossier: makelaar voegt zelf stukken toe | een ingetrokken stuk is binnen één verversing weg | middel | VERDIEPING |
| L5.6 Wwft-stap | ontbreekt (K5) | RTG iD-niveau | signaal, geen weigering (te controleren) | wetsregel niet nagelezen | Makelaar | rol Makelaar | — | overgang zonder afvinken laat naam en tijd achter | middel | VERDIEPING |
| L5.7 Koopovereenkomst | ontbreekt (K8) | contractregister `server/bedrijf/contract.js` | tekenen met twee namen; klok voor bedenktijd (termijn te controleren, signaal) | brug naar zaak hangt aan B2 | lid en makelaar bij tekenen | Makelaar en lid | koper zonder RTG-account: tweede naam handmatig | het dossier verwijst naar één contract met twee handtekeningen | middel | VERDIEPING |
| L5.8 Notaris en overdracht | ontbreekt (K4) | datum ingevoerd door Makelaar | datum verschuift: klok rekent opnieuw | extern | lid en Backoffice bij invoer | Makelaar | — | na "overdracht" is het pand verkocht en het dossier gesloten | klein | VERDIEPING |
| L5.9 Nazorg en woninggeschiedenis | ontbreekt (K9) | gebeurtenis "overdracht voltooid" | alleen DAT, geen inhoud | — | verkoper en koper (Wonen) | systeem | verkoper deelt niets: koper begint leeg | Wonen van beide leden toont de gebeurtenis | klein | later (hangt aan keten f) |
| L5.10 Archief | ontbreekt | gesloten dossier | bewaren; termijn 7/10 jaar als signaal (te controleren) | termijn niet nagelezen | manager bij wisverzoek | manager | wettelijke bewaarplicht gaat voor wissen (te controleren) | een gesloten dossier is na herstart leesbaar en niet zonder spoor te wissen | middel | later |

**L6 RTG-samenhang** (catalogus; wat de makelaar uitgeeft en ontvangt)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Aanbod → lid (projectie) | bestaat, onbewezen | `supplier.panden`; eigenaar `zaak.beheer` | lid leest, kopieert niet | — | volgers bij publicatie | open voor leden | ingetrokken aanbod verdwijnt | een verkocht pand staat niet meer in het aanbod | — | bestaat; bewijzen (K1) |
| L6.2 Bod lid → makelaar (gebeurtenis) | bestaat, onbewezen | `db.data.biedingen` | één bod per lid per pand open | — | makelaar direct | lid | — | het bod staat bij makelaar A en nergens anders | — | bestaat; bewijzen (K1) |
| L6.3 Factuur → Geld | bestaat, onbewezen (`facturatie.boek`) | bod, 0% btw | Geld is eigenaar van betaling; de makelaar rekent niet zelf | btw-behandeling: fiscale klasse "uitlegbaar" (overdrachtsbelasting i.p.v. btw, `deals.js:78`) | beide partijen bij acceptatie | systeem | facturatie faalt: dossier staat, factuur heet "niet geboekt" | één factuur per bod, ook bij dubbele tik | — | bestaat |
| L6.4 Stukken lid → makelaar (projectie met consent) | ontbreekt (K6, K7) | `woning.dossier`, `privacy.toegang` | alleen-lezen, per stuk, einddatum | — | lid ziet de partij in het Consent Center | lid | — | de makelaar staat als partij in `/api/toestemming/relaties` van het lid en is daar te sluiten | middel | VERDIEPING |
| L6.5 Transactiedossier → contractregister (verwijzing) | ontbreekt (K8) | `server/bedrijf/contract.js` | geen tweede register | eigenaar hangt aan B2 | — | Makelaar | — | het dossier verwijst naar een contract-id, geen kopie | middel | VERDIEPING (na B2) |
| L6.6 Identiteitsniveau ← RTG iD (verwijzing) | ontbreekt | niveau, nooit het nummer | het nummer blijft in de kluis | — | — | — | — | het dossier toont alleen het niveau | klein | VERDIEPING |
| L6.7 "Overdracht voltooid" → Wonen (gebeurtenis) | ontbreekt (K9) | dossierstatus | alleen DAT | — | beide leden | systeem | — | Wonen krijgt één gebeurtenis per overdracht | klein | later |

**Modus LOS** (de makelaar zonder Wonen, Geld of andere apps)

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | portefeuille, aanbieding, bezichtiging, bod beslissen; (na bouw) transactiedossier met handmatig toegevoegde stukken | "Dit dossier heeft nog geen stukken. U voegt ze hier zelf toe." |
| noodzakelijke platformdiensten | zaaksessie (`supplierAuth`), opslag, identiteit van het lid (RTG iD-niveau), stuurlaag voor voorstellen | "U bent niet meer ingelogd bij uw zaak. Log opnieuw in; er is niets verloren gegaan." |
| optionele koppelingen | Wonen (stukken van het lid), Geld (betaalstatus factuur), contractregister | "Deze klant deelt geen stukken via RTG. U werkt met wat u zelf toevoegt." |

**Modus SAMEN**, keten b: zie ONTBREKEND (meetbaar), keten b, voor de stappen, de storingen en de proef. Het contractblok (voorstel):

```js
samen: {
  functie: 'link:leverancier-makelaar' /* bestaat nog niet; besluit B14 */, familie: 'woning' /* voorstel B15 */,
  belofte: 'een makelaar biedt een pand aan, behandelt de biedingen en brengt een geaccepteerd bod via een transactiedossier tot de overdracht, met alleen de stukken die het lid zelf deelt -- een andere makelaar ziet er niets van',
  ingang: '/apps/leverancier.html', via: 'tab Vastgoed',
  bestanden: ['public/apps/leverancier/leverancier-28.js'], scenario: 'scripts/lib/voltooi/leverancier-makelaar.js' /* te maken */,
  ketens: [
    { naam: 'aanbod-naar-lid', uitgeeft: 'pand', ontvangt: 'lid', vorm: 'projectie',
      eigenaar: 'zaak.beheer', toestemming: 'open voor leden of volgers, door de makelaar',
      storingen: ['ingetrokken aanbod blijft niet zichtbaar', 'makelaar B ziet het aanbod van A niet als het zijne'], proef: 'scripts/overdrachtproef.js' },
    { naam: 'bod-naar-makelaar', uitgeeft: 'bod', ontvangt: 'zaak.beheer', vorm: 'gebeurtenis',
      eigenaar: 'zaak.beheer', toestemming: 'het lid brengt het bod zelf uit',
      storingen: ['dubbele beslissing geeft "al beslist"', 'medewerker zonder rol beslist niet', 'tenant: makelaar B ziet het bod niet'], proef: 'scripts/overdrachtproef.js' },
    { naam: 'stukken-naar-makelaar', uitgeeft: 'woningstuk', ontvangt: 'zaak.beheer', vorm: 'projectie',
      eigenaar: 'woning.dossier', toestemming: 'per stuk, alleen-lezen, intrekbaar, zichtbaar in privacy.toegang',
      storingen: ['ingetrokken stuk verdwijnt', 'zonder consent ziet de zaak niets'], proef: 'scripts/overdrachtproef.js' },
    { naam: 'dossier-naar-contract', uitgeeft: 'transactiedossier', ontvangt: 'contract', vorm: 'verwijzing',
      eigenaar: 'zaak.beheer', toestemming: 'beide partijen tekenen', storingen: ['contract zonder tweede handtekening blijft concept'], proef: 'scripts/overdrachtproef.js' },
    { naam: 'overdracht-naar-wonen', uitgeeft: 'overdracht', ontvangt: 'woning.overzicht', vorm: 'gebeurtenis',
      eigenaar: 'woning.overzicht', toestemming: 'alleen DAT, geen inhoud', storingen: ['verkoper deelt geen geschiedenis: koper begint leeg'], proef: 'scripts/overdrachtproef.js' }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **Overdrachtsprojectie uit het eigen woningdossier** (eigenaar Wonen; capability `woning.dossier`). Een markt-app krijgt PDF's per mail; hier deelt het lid stukken per stuk en trekt ze in.
- **Woninggeschiedenis van verkoper naar koper** (keten f; eigenaar Wonen). Kan alleen waar beide partijen hetzelfde dossiermodel hebben.
- **Keyless bezichtiging met het RTG-account** (bestaand, `server/kern/vastgoed-keyless-toegang.js`).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vastgoed/deals.js`, `portefeuille.js`, `server/routes/member/handel/vastgoed.js`, `server/bedrijf/contract.js` (contractregister, tekenen, klok), `server/routes/bestanden.js`, `server/kern/bestanden-delen.js`, `server/kern/consent.js`.
- Ontbrekend: zie ONTBREKEND K4-K9 (Bestanden → makelaar als projectie met consent; bod → transactiedossier; dossier → contractregister; overdracht → Wonen).
- Eigenaarstwijfel: het contractregister hangt aan een Werk OS-werkruimte, niet aan een leverancierszaak. Zie besluit B2.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Bericht na acceptatie eerlijk maken (K3) | klein | laag | — | HERSTEL |
| Rolgrens op bezichtiging en bod (K2) | klein | laag | FUNCS, actor | HERSTEL |
| Naam `koop` in `deals.js:80` rechtzetten | klein | laag | — | HERSTEL |
| Transactiedossier (K4) | middel | middel | contractregister (B2) | VERDIEPING |
| Wwft-stap als signaal (K5) | middel | middel | RTG iD-niveau | VERDIEPING |
| Overdrachtsprojectie (K6, K7) | middel | middel | Bestanden, consent, W16 | VERDIEPING |
| Ketenproef b met tenant-storing (K1) | middel | middel | bovenstaande; kan vandaag al lopen tot schakel 5 | VERDIEPING |
| Certificeringsclaim | middel | middel | besluit B1 | later |
| Vraagprijsadvies | groot | hoog | marktdata | niet doen |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | koop en huur, woning en commercieel, particulier en zakelijk | genre-register + proef met één pand per soort | half: soorten bestaan, huurbeheer niet |
| Professionele diepte | dossier met Wwft-signaal en notarisstap | `overdrachtproef`: een overgang zonder afgevinkte Wwft-stap laat naam en tijd achter | ontbreekt |
| Levenscyclus | van aanbod tot archief | proef loopt tot overdracht en leest het dossier na herstart terug | ontbreekt na bod |
| Samenwerking en rollen | drie rollen met eigen rechten | storing: Backoffice beslist geen bezichtiging, medewerker geen bod | half: bod managerOnly, rollen alleen als lijst |
| Domeinintelligentie | alleen gemeten getallen, gelabeld | toets: geen voorspelling zonder zekerheidsklasse | ontbreekt (bewust klein) |
| Los functioneren | werkt zonder Wonen en Geld | proef met Wonen uit; schermtekst LOS verschijnt | bestaat, onbewezen |
| RTG-ketens | keten b en f | regel `woning-overdracht` in `KETENS` met `dekt: sluit` | geen regel |
| Bewezen betrouwbaarheid | acht bewijzen | een APPWERKT-rij voor de vastgoedkant (vraagt B14) | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Bericht "We stellen een contract op" vervangen door wat er werkelijk volgt | klein | `server/routes/supplier/vastgoed/deals.js:96` |
| Rolgrens: bezichtiging alleen Bezichtigingen of Makelaar, bod alleen Makelaar | klein | `FUNCS` (`public/apps/leverancier.js:413`), `deals.js` |
| Variabele `koop` → `huur` in `deals.js:80` | klein | — |

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Transactiedossier per geaccepteerd bod | middel | `server/routes/supplier/vastgoed/deals.js`, `server/bedrijf/contract.js` |
| Wwft-stap als signaal met naam en datum | middel | RTG iD-niveau, transactiedossier |
| Overdrachtsprojectie (keten b) | middel | W16 van LivingOS-A, `server/kern/bestanden-delen.js`, `server/kern/consent.js` |
| Ketenproef b (`scripts/overdrachtproef.js`) met tenant-storing | middel | model `scripts/ritproef.js`, regel `woning-overdracht` in `KETENS` |

Later: bezichtiging toewijzen aan een medewerker (klein, agenda van de zaak); certificeringsclaim met aftekening (middel, besluit B1); archief met bewaartermijn als signaal (middel).

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
12. Nazorg: woninggeschiedenis naar de koper (keten f), afrekening, archief.

- Rollen en organisaties: verkoper (lid), koper (lid), verkoopmakelaar en aankoopmakelaar (zaken `vastgoed`), taxateur, bouwkundig keurder, hypotheekadviseur, bank, notaris.
- RTG-apps en eigenaren: aanbod en dossier = zaak `vastgoed` (`zaak.beheer`); woningdossier, overdracht en keten f = Wonen; waarborgsom, factuur en courtage = Geld; contract = `server/bedrijf/contract.js` (Werk OS); keuring = `bouw`-zaak of `professioneel`; identiteit = RTG iD.
- Buiten scope: koppeling met woningportalen en NWWI (externe koppeling, besluit); taxatie als eigen rol (besluit: genre of rol binnen `vastgoed`); hypotheek en bank (extern); notaris blijft extern (geen indiening, voorbehouden).

*Proces 2: aankoopbegeleiding.* Zoekopdracht van het lid → selectie uit aanbod → bezichtiging met aankoopmakelaar → biedadvies (klasse "advies") → onderhandeling → koopovereenkomst → keuring → overdracht. Draagt: Wonen (zoekprofiel), zaak `vastgoed`, Geld (budget). Buiten scope: aanbod van niet-RTG-makelaars (externe koppeling).

*Proces 3: verhuurbemiddeling.* Opdracht verhuurder → aanbod → screening huurder (alleen met toestemming, geen discriminatie volgens de Wet goed verhuurderschap; te controleren) → bezichtiging → huurovereenkomst → overdracht naar de verhuurder. Kosten alleen bij één partij (geen dubbele bemiddelingskosten, art. 7:417 BW; te controleren). Draagt: zaak `vastgoed`, Wonen (huurcontract-als-lid), Geld. Buiten scope: het lopende huurbeheer daarna (zie verhuurder).

### Vraagt besluit

- **B1. Wordt een Register Makelaar- of NVM-claim een bewijseis?**
  - (aanbevolen) Een vrijwillige claim met menselijke aftekening, geen toegangseis. Kost: middel. Makelaardij is volgens de zoekbron niet beschermd (te controleren), dus een verplichte eis zou meer vragen dan de wet.
  - Een eis in `BEWIJS_EISEN` voor `vastgoed`. Kost: middel, plus kantoorwerk bij elke aanmelding.
  - Niets. Kost: geen; het lid kan echt en onecht niet onderscheiden.
- **B2. Waar woont het contract van een transactie?**
  - (aanbevolen) In het bestaande contractregister `server/bedrijf/contract.js`, met een brug naar de leverancierszaak. Kost: middel. Geen tweede register.
  - Een eigen veld op het pand. Kost: klein, maar dat is een tweede contractregister.

---

## 2. Aannemer (genre `bouw`, met de vakpro-laag; ook `vakwerk`)

**Volledige werkzaamheid:** een aannemer (zzp, klein bedrijf of bedrijf met ploegen) ontvangt een offertevraag, ook vanuit een woningmelding, brengt een offerte met regels uit, krijgt akkoord, plant en voert uit, legt meerwerk opnieuw ter akkoord voor, sluit af met een werkbon en levert een opleverdossier dat in het woningdossier van het lid landt; het eindpunt is een afgesloten klus met review en, waar gewenst, herhaalonderhoud. Toets: `scripts/verbouwproef.js` sluit met 13 schakels en 8 gehouden storingen, voor een `bouw`- en een `vakwerk`-zaak.

Genre `bouw` ("Bouw & installatie", sector construction, open). Caps services, location, pricing. Geen eigen tab; de werkvorm wordt "zelfstandig" (`server/kern/werkvormen.js:22`). Geen rollen. De vakpro-laag geldt via `VAK_GENRES.bouw` (`server/kern/vakwerk/genres.js`, persona werkvoorbereider: "klusplanning, materiaal, offertes en spoedklussen"); sinds 4a914ea ook via `VAK_GENRES.vakwerk`. Ingang `apps/leverancier.html`. Tegenpartij: het lid via `/api/vak/*` (scherm `public/apps/mall.html`).

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Offerte vragen, akkoord, intrekken (lid) | `server/routes/member/vakpro.js` (`/api/vak/offerte/vraag`, `/offertes/mijn`, `/offerte/akkoord`, `/offerte/intrek`); scherm `public/apps/mall.html` | staat, onbewezen; geen herhaalsleutel op vragen |
| Offerte beantwoorden en weigeren (alleen manager: "Alleen de eigenaar bepaalt de prijs.") | `server/routes/supplier/vakpro.js` (`/api/supplier/vak/offerte/antwoord`, `/weiger`) | staat, onbewezen |
| Offerte opbouwen uit regels (eigen aanbod plus losse posten, btw) | `server/kern/vakwerk/pro.js` `offerteAntwoord` met `regels` → `server/kern/onderneming/offertebouw.js` | kern staat; het scherm (`public/apps/leverancier/leverancier-24b.js:6`) stuurt alleen `prijs` en `toelichting` |
| Akkoord maakt een boeking (`betaalMoment: 'achteraf'`, `paid: false`) | `server/kern/vakwerk/pro.js` `offerteAkkoord` | staat, onbewezen |
| Capaciteit (alleen manager) | `/api/supplier/vak/capaciteit` | staat, onbewezen |
| Werkbon die de klus afsluit (elke medewerker; alleen op een afgeronde boeking; één per klus) | `/api/supplier/vak/werkbon`; `server/kern/vakwerk/pro2.js` (werk max. 300, materiaal vrij tekstveld max. 200 tekens) | staat, onbewezen |
| Herhaalonderhoud, wachtlijst, review | `/api/vak/ritme/*`, `/api/vak/wachtlijst/zet`, `/api/vak/review`; `/api/supplier/vak/dienst/herhaal`, `/onderhoud/herinner` | staat, onbewezen |
| Klusketen offerte → boeking → factuur | `server/kern/onderneming/klussen.js` (leest drie objecten met een referentie; "er komt geen projectenregister bij") | staat, onbewezen |

- Bewijs: geen APPWERKT-rij voor de vakpro-laag; keten `offerte-factuur` in `scripts/ondernemerbewijs.js` heeft `proef: null`. De genregrens voor `vakwerk` heeft sinds 4a914ea een toets (`test/vakwerk-genre.test.js`).
- Niet gebouwd: offerteregels vanuit het scherm, inkoop, rollen, meerwerk, opleverdossier, de keten van een woningmelding naar de aannemer.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Exact Online Bouw (te controleren) | Essentials €129, Plus €229, Professional €359 per maand; Professional met kwaliteitsbeheer, capaciteits- en projectplanning | offerte ja (regels alleen in de kern); capaciteit half (één getal); projectplanning nee; kwaliteitsbeheer nee |
| Bouwportaal (te controleren) | €45 per maand, inclusief Wkb-dossier en opleverrapporten | Wkb-dossier nee; oplevering half (werkbon) |

Bronnen: https://www.exact.com/nl/producten/bouw/features-en-prijzen en https://bouwportaal.nl/prijzen, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Particulier:** een lid laat een badkamer, dak of uitbouw doen. Hij wil één offerte, één akkoord, weten wanneer ze komen, meerwerk vooraf zien, en na afloop papieren die hij over tien jaar terugvindt.
- **Professioneel:** zzp-vakman of klein bouwbedrijf: offerte, planning, materiaal, werkbon, factuur.
- **Organisatie:** een aannemer met ploegen, werkvoorbereiding en uitvoerders.
- **Wkb:** sinds 1-1-2024 voor gevolgklasse 1: kwaliteitsborger, bouwmelding minstens 4 weken vooraf, gereedmelding met verklaring (https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/wet-kwaliteitsborging-bouwen-wkb/) (te controleren). Voor verbouw is de Wkb voorlopig niet doorgegaan (te controleren).
- **Consumentendossier (BW 7:757a):** tekeningen, berekeningen, materialen, installaties en onderhoud (https://iplo.nl/regelgeving/regels-voor-activiteiten/technische-bouwactiviteit/kwaliteitsborging/privaatrecht-wet-kwaliteitsborging/consumentendossier-opleverdossier-wkb/) (te controleren). Beide geraadpleegd 2026-10-19 (via zoektool, live te controleren). Of 7:757a ook bij verbouw zonder Wkb geldt: te controleren.
- **Bewaarplicht:** 7 jaar administratie (art. 52 AWR; domein-max.txt) (te controleren).
- **Wat dat voor software betekent:**
  - de bouwmelding en de gereedmelding gaan via de kwaliteitsborger naar de gemeente; RTG dient niets in (voorbehouden);
  - het opleverdossier is een document met vaste onderdelen dat bij het lid belandt; de onderdelenlijst komt uit een niet nagelezen bron en is dus een signaal, geen weigering;
  - meerwerk vraagt een nieuw akkoord; zonder akkoord geen meerwerk op de factuur. Dat is een RTG-productregel, geen wetsregel, en mag hard.

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid; eigenaar Wonen)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Offerte vragen vanuit een woningmelding | half (melding en offerte bestaan los; K11; W4 van LivingOS-A bouwt de lidkant) | `server/kern/woningonderhoud.js`, `/api/vak/offerte/vraag` | de offerte draagt het melding-id als verwijzing; geen kopie | — | aannemer bij de vraag | lid | aannemer zonder RTG-zaak | vanuit een melding is in twee tikken een offerte gevraagd; de melding toont de offertestand | klein | VERDIEPING |
| Eén aanvraag per tik | ontbreekt (K12) | herhaalsleutel | dezelfde sleutel geeft dezelfde aanvraag terug | — | — | lid | — | een dubbele tik geeft één aanvraag bij de aannemer | klein | HERSTEL |
| Opleverdossier ontvangen | ontbreekt (K18) | document van de aannemer, in de map Woningdossier | onderdelen uit BW 7:757a als signaal "aanwezig" of "ontbrekend" (te controleren) | RTG beoordeelt de inhoud niet | lid bij ontvangst | lid neemt aan | lid weigert: document blijft bij de aannemer | het lid ziet per onderdeel aanwezig of ontbrekend | middel | VERDIEPING |

**L2 Professioneel**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Materiaalstaat op de offerte | half: kern bouwt uit regels (`offertebouw.js`), scherm stuurt alleen prijs (K14) | regels: omschrijving, aantal, eenheid, prijs; eigen aanbod | som = offerteprijs; btw volgens de fiscale laag, dezelfde basiscategorie als de factuurmotor | prijzen van leveranciers buiten RTG | manager bij offerte | manager prijst; medewerker leest | geen materiaal (alleen arbeid): alleen `prijs` blijft toegestaan | de manager voert drie regels in het scherm in en het lid ziet dezelfde regels en hetzelfde totaal | klein | VERDIEPING |
| Meerwerk als nieuw akkoord | ontbreekt (K17) | aanvullende offerteregel | zonder akkoord niet op de factuur (productregel) | — | lid bij voorstel | manager stelt voor, lid akkoord | spoed: alleen met vastgelegd mondeling akkoord en naam | meerwerk zonder akkoord staat niet op de factuur | middel | VERDIEPING |
| Opleverdossier samenstellen | ontbreekt (K18) | werkbon, foto's, documenten (RTDocs `docs.office` voor het samenstellen) | elk onderdeel "aanwezig", "ontbrekend" of "n.v.t. met reden"; verzenden kan altijd, de lijst gaat mee | onderdelenlijst te controleren | lid bij verzenden | manager verstuurt | verbouw zonder Wkb: dossier blijft aanbevolen | het lid ontvangt het dossier met de lijst zoals de aannemer hem invulde | middel | VERDIEPING |
| Wkb-stappen als checklist | ontbreekt | datum bouwmelding, naam kwaliteitsborger | signaal als de start binnen 4 weken na de bouwmelding valt (te controleren) | of het project onder gevolgklasse 1 valt, bepaalt de mens | manager 5 weken voor start | manager | geen Wkb bij verbouw | de manager ziet het signaal; RTG dient niets in en weigert niets | klein | later |

**L3 Organisatorisch**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Rollen voor `bouw` en `vakwerk` | ontbreekt (FUNCS heeft geen regel) | `public/apps/leverancier.js:400-427` | voorstel: Werkvoorbereiding, Uitvoerder, Monteur; de server-grens manager/medewerker blijft | — | — | manager wijst toe | zzp: één persoon | de werkbon draagt de rol van wie hem schreef | klein | VERDIEPING (B4) |
| Eigen tab "Vakwerk" | ontbreekt (werkvorm zelfstandig) | tabs per cap, r. 160-200 | tab hangt aan `isVak`, niet aan een nieuwe cap | — | — | — | — | een bouwzaak ziet offertes, planning en werkbonnen in één tab | klein | later |
| Genregrens `vakwerk` | gerepareerd (commit 4a914ea, `test/vakwerk-genre.test.js`) | `VAK_GENRES` | elk open bouwgenre is een vakgenre | — | — | — | — | een vakwerkzaak krijgt geen 403 meer op de vakpro-laag | — | HERSTEL: gerepareerd (4a914ea) |

**L4 Domeinintelligentie**

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Waar de klusketen blijft steken | bestaat (`server/kern/onderneming/klussen.js`) | offerte, boeking, factuur | telt per schakel | — | manager | manager | — | elke klus heeft één huidige schakel | klein | VERDIEPING (zichtbaar maken in de tab) |
| Doorlooptijd-schatting | ontbreekt | eigen afgesloten werkbonnen | mediaan per soort klus | klasse "advies"; minder dan 10 klussen: niet tonen | manager | manager | — | het getal draagt de zekerheidsklasse en het aantal klussen | klein | later |

**L5 Volledige levenscyclus** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Melding of wens | bestaat (Wonen; `link:wonen` BEWEZEN) | `server/kern/woningonderhoud.js` | object van Wonen | — | lid | lid | — | de melding staat in het eigen dossier | — | bestaat |
| L5.2 Offertevraag | bestaat, onbewezen; melding-id en herhaalsleutel ontbreken (K11, K12) | `offerteVraag` | omschrijving ≥ 10 tekens; max. 10 open aanvragen | — | aannemer direct | lid | zaak geen vakgenre: 404 | één aanvraag met melding-id per tik | klein | HERSTEL (K12) + VERDIEPING (K11) |
| L5.3 Opdrachtprojectie | ontbreekt (K13) | ruimte, bouwdelen, installaties | per opdracht, alleen wat bij de klus hoort | — | aannemer bij delen/intrekken | lid, consent in `privacy.toegang` | intrekken tijdens uitvoering: aannemer verliest zicht, werkbon blijft | de aannemer ziet precies de gedeelde bouwdelen en niets anders | middel | VERDIEPING |
| L5.4 Offerte met regels | half (K14) | `offertebouw.js` | som regels = prijs; btw uit de fiscale laag | leveranciersprijzen extern | lid bij antwoord | manager | alleen prijs blijft mogelijk | het lid ziet de regels die de manager invoerde | klein | VERDIEPING |
| L5.5 Akkoord | bestaat, onbewezen | `offerteAkkoord` → boeking | alleen vanuit "aangeboden"; tweede akkoord 409 | — | aannemer bij akkoord | lid; via stuurlaag alleen met `/doe/bevestig` | zaak bestaat niet meer: 404 | één boeking per akkoord | — | bestaat; bewijzen (K10) |
| L5.6 Plannen | bestaat, onbewezen | capaciteit, boeking | manager zet capaciteit | — | lid ziet datum | manager | planning verschuift: lid ziet nieuwe datum | — | — | bestaat; bewijzen |
| L5.7 Samenwerken tijdens uitvoering | ontbreekt (K16) | vragen, foto's | ruimte volgens B3 | eigenaarschap open | lid en aannemer | gastlink of Project Room | — | een vraag van het lid en een foto van de aannemer staan op één plek | middel | later (na B3) |
| L5.8 Meerwerk | ontbreekt (K17) | aanvullende regel | nieuw akkoord vereist | — | lid bij voorstel | manager stelt voor | spoed met vastgelegd mondeling akkoord | zonder akkoord staat meerwerk niet op de factuur | middel | VERDIEPING |
| L5.9 Werkbon | bestaat, onbewezen | `werkbonZet` | alleen op afgeronde boeking; één per klus | — | lid bij werkbon | elke medewerker | — | tweede werkbon geeft 409 | — | bestaat; bewijzen |
| L5.10 Opleverdossier | ontbreekt (K18) | werkbon, documenten | onderdelenlijst als signaal (te controleren) | RTG beoordeelt inhoud niet | lid bij ontvangst | manager verstuurt, lid neemt aan | lid weigert | het document staat in Woningdossier met herkomst en versie | middel | VERDIEPING |
| L5.11 Factuur | half (`klussen.js` leest de keten; betaling ligt bij Geld) | boeking, offerte | Geld is eigenaar van betaling | fiscale klasse per uitkomst | lid bij factuur | manager | — | de factuur bevat alleen geakkordeerde regels | — | bestaat; keten `factuur-grootboek` |
| L5.12 Review en herhaalonderhoud | bestaat, onbewezen | `/api/vak/review`, `/api/vak/ritme/*` | review na afgeronde klus | — | aannemer | lid | — | een review hoort bij één klus | — | bestaat |
| L5.13 Archief | half (boeking en werkbon blijven) | boeking | bewaren 7 jaar als signaal (te controleren) | termijn niet nagelezen | — | manager | — | een werkbon is na herstart leesbaar | klein | later |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Melding (Wonen) → offertevraag (verwijzing) | ontbreekt (K11) | melding-id | verwijzing, geen kopie | — | aannemer bij vraag; lid ziet stand in de melding | lid | aannemer zonder RTG-zaak | de melding toont "offerte gevraagd", "aangeboden", "vakman gepland" | klein | VERDIEPING |
| L6.2 Bouwdelen lid → aannemer (projectie) | ontbreekt (K13) | `woning.dossier` | per opdracht, alleen-lezen | — | lid ziet de partij in `privacy.toegang` | lid | — | de aannemer staat als partij in `/api/toestemming/relaties` | middel | VERDIEPING |
| L6.3 Offerte → Geld-pot (verwijzing, alleen voor het lid) | ontbreekt (K15) | `geld.overzicht`, `/api/geld/pot/reserveer` | Geld rekent; de aannemer ziet de pot nooit | — | lid bij offerte | lid koppelt | pot te klein: Geld meldt het, de aannemer niet | het lid ziet pot en offerte naast elkaar; de zaak niet | middel | VERDIEPING |
| L6.4 Akkoord via de stuurlaag | bestaat (`server/routes/stuur.js`) | voorstel | AI voert nooit uit zonder `/api/member/doe/bevestig` | — | lid | lid bevestigt | — | zonder bevestiging blijft de offerte "aangeboden" | — | bestaat; bewijzen (storing 7) |
| L6.5 Samenwerkruimte | ontbreekt (K16) | `werk.project` of praktijk-gastlink | eigenaarschap B3 | — | lid en aannemer | — | — | — | middel | later (B3) |
| L6.6 Opleverdossier → Woningdossier (document) | ontbreekt (K18) | `docs.bestanden`, map Woningdossier | het lid neemt aan; geen schrijfactie van de zaak in Wonen | — | lid | lid | — | het document heeft herkomst "opleverdossier <ref>" | middel | VERDIEPING |
| L6.7 Opleverdossier → bouwdeel (lid neemt over) | ontbreekt (K19) | `woning.dossier` | het lid kiest per installatie | — | lid | lid | — | een overgenomen installatie draagt de herkomst | klein | later |
| L6.8 Doorgezette melding verhuurder/beheerder → aannemer (keten a) | ontbreekt | melding-id | gebeurtenis | — | aannemer | verhuurder zet door | aannemer weigert | — | middel | later (hangt aan B6, B12) |
| L6.9 Factuur → Geld | half | boeking | Geld is eigenaar | — | lid | — | — | — | — | bestaat; keten `factuur-grootboek` |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | offerte beantwoorden, capaciteit, werkbon, herhaalonderhoud, review | "Deze klant deelt geen woninggegevens; u werkt op de omschrijving van de offerte." |
| noodzakelijke platformdiensten | zaaksessie, opslag, stuurlaag voor voorstellen, identiteit van het lid op codenaam | "U bent niet meer ingelogd bij uw zaak. Log opnieuw in; uw offertes en werkbonnen staan er nog." |
| optionele koppelingen | Wonen (melding, bouwdelen, opleverdossier), Geld (pot), samenwerkruimte | "Het opleverdossier kan niet naar het woningdossier van deze klant. Geef het hem zelf mee." |

**Modus SAMEN**, keten e: zie ONTBREKEND (meetbaar), keten e. Het contractblok (voorstel):

```js
samen: {
  functie: 'link:leverancier-aannemer' /* bestaat nog niet; besluit B14 */, familie: 'woning' /* voorstel B15 */,
  belofte: 'een aannemer krijgt een offertevraag vanuit een woningmelding, brengt een offerte met regels uit, krijgt akkoord, voert uit met meerwerk alleen na nieuw akkoord, en levert een opleverdossier dat in het woningdossier van het lid landt -- een andere aannemer ziet er niets van',
  ingang: '/apps/leverancier.html', via: 'het offerte- en werkbonblok (werkvorm zelfstandig)',
  bestanden: ['public/apps/leverancier/leverancier-24b.js'], scenario: 'scripts/lib/voltooi/leverancier-aannemer.js' /* te maken */,
  ketens: [
    { naam: 'melding-naar-offerte', uitgeeft: 'melding', ontvangt: 'zaak.beheer', vorm: 'verwijzing',
      eigenaar: 'woning.onderhoud', toestemming: 'per melding, door het lid',
      storingen: ['dubbele tik geeft één aanvraag', 'zaak zonder vakgenre: 404', 'tenant: aannemer B ziet de vraag niet'], proef: 'scripts/verbouwproef.js' },
    { naam: 'bouwdelen-naar-aannemer', uitgeeft: 'bouwdeel', ontvangt: 'zaak.beheer', vorm: 'projectie',
      eigenaar: 'woning.dossier', toestemming: 'per opdracht, alleen-lezen, zichtbaar en te sluiten in privacy.toegang',
      storingen: ['zonder consent alleen de omschrijving', 'intrekken tijdens uitvoering laat werkbon bij de aannemer'], proef: 'scripts/verbouwproef.js' },
    { naam: 'offerte-naar-geld', uitgeeft: 'offerte', ontvangt: 'geld.overzicht', vorm: 'verwijzing',
      eigenaar: 'geld.overzicht', toestemming: 'het lid koppelt; de zaak ziet de pot nooit', storingen: ['pot te klein: alleen het lid hoort het'], proef: 'scripts/verbouwproef.js' },
    { naam: 'akkoord-via-stuurlaag', uitgeeft: 'voorstel', ontvangt: 'zaak.beheer', vorm: 'gebeurtenis',
      eigenaar: 'zaak.beheer', toestemming: 'alleen na /api/member/doe/bevestig', storingen: ['zonder bevestiging gebeurt niets', 'tweede akkoord 409'], proef: 'scripts/verbouwproef.js' },
    { naam: 'opleverdossier-naar-wonen', uitgeeft: 'opleverdossier', ontvangt: 'woning.dossier', vorm: 'verwijzing',
      eigenaar: 'woning.dossier', toestemming: 'het lid neemt aan', storingen: ['lid weigert: document blijft bij de aannemer', 'onvolledig: lijst toont wat ontbreekt'], proef: 'scripts/verbouwproef.js' }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **Opleverdossier dat in het woningdossier van het lid landt** (eigenaar Wonen; `woning.dossier`). Een markt-app levert een PDF; hier wordt het bouwdeel bijgewerkt en is het over tien jaar terug te vinden, ook na verkoop (keten f).
- **Melding → offerte zonder overtypen** (eigenaar Wonen voor de melding, de zaak voor de offerte).
- **Budget in Geld naast de offerte** (eigenaar Geld): het lid ziet de pot en de offerte, de aannemer ziet de pot niet.
- **Akkoord via de stuurlaag**: een AI mag een akkoord voorstellen, nooit geven (`/doe/bevestig`).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vakpro.js`, `server/routes/member/vakpro.js`, `server/kern/vakwerk/pro.js`, `server/kern/vakwerk/pro2.js`, `server/kern/vakwerk/index.js`, `server/kern/onderneming/klussen.js`, `server/kern/onderneming/offertebouw.js`, `server/routes/bestanden.js`, `server/routes/stuur.js`.
- Ontbrekend: zie ONTBREKEND K10-K19.
- Eigenaarstwijfel: waar de samenwerking woont (Project Room is kantoor; Werk OS-praktijk heeft gastlinks). Zie besluit B3.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| `vakwerk` in `VAK_GENRES` | — | — | — | HERSTEL: gerepareerd (4a914ea) |
| Herhaalsleutel op offertevraag (K12) | klein | laag | — | HERSTEL |
| Offerteregels in het scherm (K14) | klein | laag | `offertebouw.js` bestaat | VERDIEPING |
| Rollen voor `bouw` en `vakwerk` | klein | laag | FUNCS, B4 | VERDIEPING |
| Melding → offertevraag (K11) | klein | laag | Wonen (W4) | VERDIEPING |
| Meerwerk als akkoord (K17) | middel | middel | offerte | VERDIEPING |
| Opleverdossier (K18) | middel | middel | Bestanden | VERDIEPING |
| Ketenproef e met tenant-storing (K10) | middel | middel | kan vandaag al lopen voor 6 schakels | VERDIEPING |
| Wkb-checklist als signaal | klein | laag | — | later |
| Eigen tab | klein | laag | — | later |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis in gewone taal | Toets | Stand nu |
|---|---|---|---|
| Breedte | zzp, klein bedrijf en aannemer met ploegen; `bouw` en `vakwerk` | `verbouwproef` met een `bouw`- en een `vakwerk`-zaak | `vakwerk` gerepareerd (4a914ea); proef ontbreekt |
| Professionele diepte | offerteregels, meerwerk, opleverdossier | `verbouwproef` schakels 4, 9, 11 | half (regels alleen in de kern) |
| Levenscyclus | van melding tot herhaalonderhoud | proef leest werkbon en dossier na herstart terug | half |
| Samenwerking en rollen | rollen met eigen rechten | storing: medewerker prijst geen offerte (vandaag gehouden) | manager/medewerker bestaat; rollen niet |
| Domeinintelligentie | alleen gelabelde getallen | toets op zekerheidsklasse | klusketen bestaat |
| Los functioneren | werkt zonder Wonen | proef met Wonen uit; LOS-tekst verschijnt | bestaat, onbewezen |
| RTG-ketens | keten a (tweede lijn) en e | regel `verbouwing` in `KETENS`, `dekt: sluit` | `offerte-factuur` zonder proef |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij vakpro (vraagt B14) | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL:

| Functie | Kosten | Bouwt op |
|---|---|---|
| `vakwerk` in `VAK_GENRES` — gerepareerd (commit 4a914ea) | — | `server/kern/vakwerk/genres.js`, `test/vakwerk-genre.test.js` |
| Herhaalsleutel op `/api/vak/offerte/vraag` | klein | `server/kern/vakwerk/pro.js` |

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Offerteregels (materiaalstaat) in het zaakscherm | klein | `server/kern/onderneming/offertebouw.js`, `public/apps/leverancier/leverancier-24b.js` |
| Rollen voor `bouw` en `vakwerk` (Werkvoorbereiding, Uitvoerder, Monteur) | klein | `FUNCS` in `public/apps/leverancier.js` |
| Melding → offertevraag aan de zaakkant (tegenhanger van W4) | klein | `server/kern/vakwerk/pro.js`, melding-id als verwijzing |
| Meerwerk als nieuw akkoord | middel | `/api/vak/offerte/*` |
| Opleverdossier naar het woningdossier | middel | `server/kern/vakwerk/pro2.js`, `server/routes/bestanden.js` |
| Ketenproef e (`scripts/verbouwproef.js`) met tenant-storing | middel | model `scripts/ritproef.js`, regel `verbouwing` in `KETENS` na `offerte-factuur` |

Later: Wkb-checklist als signaal en eigen tab (klein, `isVak`, tabs per cap); doorlooptijd-schatting (klein, klasse "advies").

**(B) Domeinmaximum, ook buiten de huidige scope (richting, geen toezegging)**

*Proces 1: bouwproject van ontwerp tot oplevering en nazorg (particuliere opdrachtgever).*
1. Wens en programma van eisen (lid, Wonen).
2. Ontwerp en vergunningstekening (architect of tekenaar).
3. Omgevingsvergunning of melding bij de gemeente (extern).
4. Constructieve en bouwfysische berekeningen (constructeur, adviseur).
5. Offertes, vergelijking, keuze, aannemingsovereenkomst.
6. Bij gevolgklasse 1: kwaliteitsborger kiezen, bouwmelding vooraf (extern; termijn te controleren).
7. Werkvoorbereiding: planning, materiaalstaat, inkoop, onderaannemers.
8. Uitvoering met dagrapporten, foto's, meerwerk en minderwerk.
9. Termijnfacturen volgens betalingsschema.
10. Oplevering met opnamestaat; herstelpunten.
11. Gereedmelding met verklaring van de kwaliteitsborger (extern).
12. Opleverdossier (BW 7:757a; te controleren) naar het woningdossier.
13. Onderhoudstermijn, garantie, herhaalonderhoud.

- Rollen en organisaties: opdrachtgever (lid), architect, constructeur, hoofdaannemer, onderaannemers (installateur, loodgieter), leveranciers, kwaliteitsborger, gemeente.
- RTG-apps en eigenaren: wens, bouwdelen, dossier = Wonen; offerte, planning, werkbon = zaak `bouw` (vakpro-laag); samenwerking = Werk OS-praktijk of Project Room (besluit B3); termijnen en budget = Geld; documenten = Bestanden en RTDocs; akkoorden = stuurlaag met `/doe/bevestig`.
- Buiten scope: onderaanneming als keten tussen twee zaken (CIVILIS par. 5D, nieuwe keten en proef); inkoop bij bouwleveranciers (keten zoals `voorraad-ontvangst`, besluit); koppeling met het Omgevingsloket en met kwaliteitsborgers (extern, voorbehouden: RTG dient niets in); termijnschema als Geld-functie (besluit bij Geld; een termijnbetaling in een proef legt de afloop vast via `scripts/lib/simulatieafloop.js`).

*Proces 2: onderhoudscontract.* Inspectie → onderhoudsplan per bouwdeel → herhaalafspraak (`/api/vak/ritme/*`) → werkbon → rapport naar het dossier. Draagt: Wonen (onderhoudsplan), zaak `bouw`. Buiten scope: niets nieuws; dit is (A)-werk plus het onderhoudsplan van Wonen.

*Proces 3: storing en spoed.* Melding (Wonen) → doorgezet door verhuurder of beheerder (keten a) → spoedplanning → werkbon → kosten naar de juiste betaler. Buiten scope: de verhuurder als zaak (besluit B6).

### Vraagt besluit

- **B3. Waar werken lid en aannemer samen tijdens een verbouwing?**
  - (aanbevolen) Op de bestaande Werk OS-praktijk met gastlink (`server/bedrijf/praktijk.js`, `/api/bedrijf/praktijk/delen`; `server/bedrijf/praktijk-gast.js`, `/api/werk-gast/beeld` en `/besluit`; minimaal een gratis account). Kost: middel (brug van leverancierszaak naar werkruimte). Bestaat al voor klant en project.
  - Project Room openen voor zaak en lid. Kost: groot; Project Room draait nu volledig op `officeAuth` en is voor het kantoor ontworpen.
  - Geen samenwerkingsruimte; alleen offerte, werkbon en dossier. Kost: geen; meerwerk en vragen lopen dan buiten RTG.
- **B4. Krijgen `bouw` en `vakwerk` rollen in FUNCS?**
  - (aanbevolen) Ja: Werkvoorbereiding, Uitvoerder, Monteur. Kost: klein.
  - Nee, alleen manager/medewerker. Kost: geen.
- **B5. `vakwerk` buiten VAK_GENRES** — afgedaan: gerepareerd in 4a914ea (optie "toevoegen").

---

## 3. Verhuurder (beste pasvorm `vastgoed`, deels)

**Volledige werkzaamheid:** een particuliere of professionele woningverhuurder legt per verhuureenheid een lopend huurcontract vast met een huurder (lid), ontvangt diens meldingen en zet ze door naar een aannemer, ziet via Geld of de huur is ontvangen, en sluit de huurperiode af met eindinspectie en teruggave van de waarborgsom; het eindpunt is een beëindigd contract met een afgerekende waarborgsom. Toets: een proef over één volledige huurperiode (keten a en c). Vandaag kan alleen het aanbieden; het lopende beheer hangt aan besluit B6.

Geen eigen genre. `verhuur` is autoverhuur en past niet. `apartment` en `villa` zijn kort verblijf (TravelOS). De beste pasvorm is `vastgoed`: dat kent `transactie: 'huur'` en de telling "verhuurd". Het kent geen huurder, geen lopend woninghuurcontract en geen inning. Huurcontracten met looptijd bestaan alleen in `gebouwplus` (zakelijk, per verdieping, sinds d3d5ce8 alleen voor zaken met de cap `gebouw`). Rollen van `vastgoed` (Makelaar, Bezichtigingen, Backoffice) passen niet op verhuurbeheer.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Pand met transactie huur, aanbieding, bezichtiging, bod | `server/routes/supplier/vastgoed/` | staat, onbewezen |
| Bij geaccepteerd bod op huur: `facturatie.boek` met soort 'huur' (via de misleidend benoemde variabele `koop`, `deals.js:80`) | `server/routes/supplier/vastgoed/deals.js` | staat, onbewezen; eenmalige boeking, geen maandhuur |
| Zakelijke huurcontracten met looptijdbewaking | `server/routes/supplier/gebouwplus.js` (`/api/supplier/gebouwplus/contract`, `/contract/zet`) | staat, onbewezen; ander genre (`kantoorgebouw`); cap-check gerepareerd (d3d5ce8) |
| Contractregister met soort `huur`, tekenen met twee namen, opzegklok | `server/bedrijf/contract.js` (`SOORTEN` bevat 'huur'), `server/bedrijf/contractklok.js` | staat; hangt aan een Werk OS-werkruimte, niet aan een leverancierszaak |
| Meldingen van de bewoner | `/api/home/onderhoud/meld` (Wonen) | staat; geen keten naar een verhuurder |

Niet gebouwd: huurder als relatie, woninghuurcontract, waarborgsom, maandelijkse inning, servicekostenafrekening, indexering. Geen APPWERKT-rij, geen keten in `KETENS`.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| HMS (te controleren) | vanaf €1,25 per object per maand | huurbeheer nee |
| Scope (Scopeselect) (te controleren) | €55 per maand voor 5-100 contracten [oud] | contractbeheer half (alleen zakelijk, `gebouwplus`) |

Bronnen: https://hmsystems.nl/prijzen.html en https://www.scopesoftware.nl/, geraadpleegd 2026-10-19 (via zoektool, live te controleren; de Scope-prijs is als oud gemarkeerd).

### c. Analyse van het volledige domein

- **Particulier:** iemand verhuurt één woning (geërfd, of de eigen woning na samenwonen).
- **Professioneel:** een belegger met tien tot honderden woningen, vaak met een beheerder (beroep 7).
- **Wet goed verhuurderschap** (sinds 1-7-2023): geen discriminatie of intimidatie, schriftelijk contract, schriftelijke informatie, geen dubbele bemiddelingskosten; sinds 2024 een meldpunt per gemeente (https://www.volkshuisvestingnederland.nl/onderwerpen/huren-en-wonen/wet-goed-verhuurderschap/landelijke-regels-van-goed-verhuurderschap) (te controleren).
- **Waarborgsom:** maximaal 2 maanden kale huur, terug binnen 14 dagen (https://www.volkshuisvestingnederland.nl/onderwerpen/huurbescherming-en-huurcontracten/waarborgsom) (te controleren).
- **Servicekosten:** alleen werkelijke kosten, zonder winst; jaarafrekening vóór 1 juli bij de huurder; toetsing aan het Beleidsboek Servicekosten (https://www.huurcommissie.nl/onderwerpen/huurder-sociale--en-middensector/servicekosten-sociale-middensector-huurder/jaarafrekening-servicekosten-beoordelen) (te controleren). Alle bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- Huurprijsgrenzen en het puntenstelsel: niet in de feiten (te controleren).
- **Wat dat voor software betekent:** de waarborgsom-regel zou "bepaald" zijn als de wet en de gegevens eenduidig zijn, maar zolang de regel niet uit de primaire tekst is nagelezen, is het een signaal en geen weigering; de servicekostenafrekening is "uitlegbaar" (verdeelsleutels zijn een keuze); de huurprijstoets is "advies" (een mens beoordeelt). Een vonnis of naheffing is "voorbehouden".

### d. Functiecatalogus L1–L6

**L1 Persoonlijk** (het lid als huurder; eigenaar Wonen en Geld)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Huurcontract-als-lid (keten c) | ontbreekt | document van de verhuurder, in het dossier van het lid | het lid neemt aan; Wonen bewaart | — | lid bij ontvangst | lid | verhuurder buiten RTG: lid uploadt zelf | het contract staat in Woningdossier met herkomst | klein | VERDIEPING (Wonen-kant; verwijzing van de zaak hangt aan B6) |
| Huur als verplichting in Geld | ontbreekt | bedrag, dag, tegenpartij | Geld is eigenaar; Wonen verwijst | — | lid bij betaaldag | lid koppelt | — | de huur verschijnt in Geld, niet als kopie in Wonen | middel | later |

**L2 Professioneel** (de verhuurder; alleen binnen `vastgoed` als B6 dat kiest)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| Woninghuurcontract op een pand | ontbreekt | pand (`supplier.panden`) + `server/bedrijf/contract.js` soort 'huur' | één lopend contract per verhuureenheid; klok rekent opzegtermijn | opzegtermijnen per contractvorm: te controleren | verhuurder 3 maanden voor einde bepaalde tijd | manager tekent; huurder (lid) tekent als tweede naam | huur zonder RTG-huurder: tweede naam handmatig | een pand toont huurder (codenaam), ingang en einde | middel | VERDIEPING, als B6 = A |
| Waarborgsom-signaal | ontbreekt | kale huur, waarborgsom | signaal boven 2 × kale huur en na 14 dagen zonder teruggave (te controleren) | regel niet nagelezen | verhuurder bij invoer; beide bij einde | manager | schade-inhouding: klasse "uitlegbaar", mens beslist | een waarborgsom boven 2 × kale huur toont het signaal met de bron; opslaan blijft mogelijk | klein | VERDIEPING, als B6 = A |
| Schriftelijke informatieplicht | ontbreekt | vaste informatieset (Wet goed verhuurderschap; te controleren) | signaal zolang de set niet verzonden is | inhoud van de set: te controleren | huurder bij ingang | manager | — | het contract toont "informatieset niet verzonden (te controleren)" tot hij verzonden is | klein | later |
| Maandelijkse inning | ontbreekt | Geld | Geld is eigenaar; zaak ziet "ontvangen" of "niet ontvangen" | de simulatiebank bewijst geen echte betaling; een proef legt de afloop vast via `scripts/lib/simulatieafloop.js` | verhuurder bij achterstand | huurder koppelt | — | geen bedragen in de zaak zonder Geld-verwijzing | groot | later |
| Servicekostenafrekening | ontbreekt | werkelijke kosten, verdeelsleutel | geen winst; termijn 1 juli als signaal (te controleren) | klasse "uitlegbaar" | huurder | manager | geschil: Huurcommissie, extern | de afrekening toont per post kosten, sleutel en aandeel | middel | later |

**L3 Organisatorisch:** rollen voor verhuur (Verhuur, Technisch beheer, Financieel) bestaan niet in `FUNCS`. Kosten klein; VERDIEPING als B6 = A.

**L4 Domeinintelligentie:** contracteinde-signaal (bestaand patroon in `gebouwplus`, looptijdbewaking) — klein, later. Huurprijsadvies: niet doen (geen bron voor het puntenstelsel in RTG; zou een voorspelling als feit tonen).

**L5 Volledige levenscyclus** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Aanbieden | bestaat, onbewezen (`vastgoed`, transactie huur) | pand | zoals makelaar L5.1 | — | volgers | manager | — | een huurpand staat in het aanbod | — | bestaat |
| L5.2 Selectie en screening | ontbreekt | aanvraag lid, met toestemming | objectieve criteria, vooraf vastgelegd (te controleren) | geen AI-beoordeling van personen | aanvrager bij besluit | manager; lid geeft toestemming | — | elke afwijzing noemt het criterium | middel | later (B6) |
| L5.3 Contract | ontbreekt | `server/bedrijf/contract.js` | één lopend per eenheid | termijnen te controleren | beide bij tekenen | manager, lid | — | contract met twee namen | middel | VERDIEPING (B6 = A) |
| L5.4 Waarborgsom | ontbreekt | Geld | signaal, geen weigering | te controleren | beide | manager | — | zie L2 | klein | VERDIEPING (B6 = A) |
| L5.5 Ingang en inspectie | ontbreekt | foto's, staat | document naar beide dossiers | — | beide | manager, lid | — | inspectie staat in Woningdossier van het lid | middel | later |
| L5.6 Inning | ontbreekt | Geld | Geld rekent | simulatiebank | verhuurder bij achterstand | lid koppelt | — | zie L2 | groot | later |
| L5.7 Meldingen (keten a) | ontbreekt | melding uit Wonen | projectie met consent | — | verhuurder bij delen | lid | verhuurder niet op RTG | melding verschijnt bij verhuurder A en nergens anders | middel | VERDIEPING |
| L5.8 Servicekosten | ontbreekt | kosten | uitlegbaar | — | huurder | manager | geschil extern | zie L2 | middel | later |
| L5.9 Opzegging en einde | ontbreekt | contractklok | klok rekent opzegtermijn | termijn te controleren | beide | manager, lid | — | contract gaat naar "beëindigd" met datum | klein | later |
| L5.10 Waarborgsom terug | ontbreekt | Geld | signaal na 14 dagen (te controleren) | — | beide | manager | inhouding met reden | teruggave staat in Geld met datum | klein | later |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Melding lid → verhuurder (projectie, keten a) | ontbreekt | `woning.onderhoud` | per melding, met consent | — | verhuurder bij delen | lid; partij in `privacy.toegang` | verhuurder niet op RTG: exporteerbare tekst | ingetrokken melding verdwijnt bij de verhuurder | middel | VERDIEPING |
| L6.2 Melding verhuurder → aannemer (gebeurtenis) | ontbreekt | melding-id (zelfde vorm als K11) | verwijzing, geen kopie | — | aannemer; lid bij planning | verhuurder zet door | aannemer weigert | lid ziet "vakman gepland" | middel | VERDIEPING |
| L6.3 Contract → lid (document, keten c) | ontbreekt | contractregister | het lid neemt aan | — | lid | lid | — | contract in Woningdossier met herkomst | klein | VERDIEPING (B6 = A) |
| L6.4 Betaalstatus ← Geld (verwijzing) | ontbreekt | `geld.overzicht` | alleen "ontvangen"/"niet ontvangen" | — | verhuurder | huurder geeft toestemming | — | de verhuurder ziet nooit de rekening van het lid | middel | later |
| L6.5 Status melding → lid (verwijzing) | ontbreekt | melding | status terug, nooit automatisch "opgelost" | — | lid | verhuurder of lid zet opgelost | — | alleen lid of verhuurder sluit de melding | klein | VERDIEPING |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | een pand te huur aanbieden, bezichtigen, een bod accepteren | "Lopend huurbeheer bestaat hier nog niet. U kunt dit pand wel aanbieden en een huurder kiezen." |
| noodzakelijke platformdiensten | zaaksessie, opslag, identiteit van de huurder op codenaam | "U bent niet meer ingelogd bij uw zaak. Log opnieuw in; uw panden staan er nog." |
| optionele koppelingen | Wonen (meldingen, contract bij de huurder), Geld (betaalstatus), aannemer | "Deze huurder deelt zijn meldingen niet via RTG. Spreek met hem af hoe hij u bereikt." |

**Modus SAMEN**, keten a (melding naar verhuurder en door naar de aannemer):
1. Lid meldt lekkage (`/api/home/onderhoud/meld`) en deelt hem met zijn verhuurder. Storing: verhuurder geen RTG-zaak; melding blijft "gemeld" met exporteerbare tekst.
2. Verhuurder ziet de projectie en zet "in behandeling". Storing: lid trekt in; projectie vervalt.
3. Verhuurder vraagt een offerte bij een `bouw`- of `vakwerk`-zaak met het melding-id als verwijzing (zelfde stroom als W4). Storing: aannemer weigert; verhuurder ziet de weigering.
4. Aannemer plant; het lid ziet "vakman gepland" (W4). Storing: planning verschuift; het lid ziet de nieuwe datum.
5. Werkbon sluit de klus; de melding gaat naar "opgelost" door het lid of de verhuurder, nooit automatisch door de aannemer.
6. Tenant-storing: verhuurder B en aannemer C zien niets van de melding van verhuurder A.

```js
samen: {
  functie: 'link:leverancier-verhuur' /* bestaat nog niet; B14, en hangt aan B6 */, familie: 'woning' /* voorstel B15 */,
  belofte: 'een verhuurder ontvangt de meldingen die zijn huurder deelt, zet ze door naar een aannemer en ziet de status terug, zonder het woningdossier of de rekening van de huurder te zien',
  ingang: '/apps/leverancier.html', via: 'tab Vastgoed (schermprofiel Verhuur, na B6)',
  bestanden: ['public/apps/leverancier/leverancier-28.js'], scenario: 'scripts/lib/voltooi/leverancier-verhuur.js' /* te maken */,
  ketens: [
    { naam: 'melding-naar-verhuurder', uitgeeft: 'melding', ontvangt: 'zaak.beheer', vorm: 'projectie',
      eigenaar: 'woning.onderhoud', toestemming: 'per melding, door het lid, zichtbaar in privacy.toegang',
      storingen: ['verhuurder niet op RTG: melding blijft gemeld', 'lid trekt in: projectie vervalt', 'tenant: verhuurder B ziet niets'], proef: 'scripts/meldingproef.js' /* voorstel, keten a */ },
    { naam: 'melding-naar-aannemer', uitgeeft: 'melding', ontvangt: 'zaak.beheer', vorm: 'gebeurtenis',
      eigenaar: 'zaak.beheer', toestemming: 'verhuurder zet door, lid krijgt bericht', storingen: ['aannemer weigert', 'aannemer sluit de melding niet zelf'], proef: 'scripts/meldingproef.js' },
    { naam: 'contract-naar-lid', uitgeeft: 'huurcontract', ontvangt: 'woning.dossier', vorm: 'verwijzing',
      eigenaar: 'woning.dossier', toestemming: 'het lid neemt aan', storingen: ['lid weigert: contract blijft bij de verhuurder'], proef: null /* pas na B6 */ }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **Melding met foto uit Wonen, door naar de aannemer, status terug bij de bewoner** (eigenaren Wonen en `bouw`), zonder dat de verhuurder het woningdossier ziet.
- **Huur als verplichting in Geld met betaalstatus voor de verhuurder** (eigenaar Geld), zonder dat de verhuurder de rekening ziet.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/supplier/vastgoed/portefeuille.js`, `server/bedrijf/contract.js`, `server/bedrijf/contractklok.js`, `server/kern/woningonderhoud.js`, `server/kern/vakwerk/pro.js`, `server/kern/consent.js`.
- Ontbrekend: melding → verhuurder (projectie, consent per melding); verhuurder → `bouw` (gebeurtenis, verwijzing melding-id); contract → lid (document); Geld → verhuurder (verwijzing "ontvangen", consent van de huurder). Keten a staat niet in ONTBREKEND (meetbaar) van deze herziening; de opdracht vroeg b en e. Voorstel: dezelfde vorm, met een proef `scripts/meldingproef.js`.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Besluit B6 | — | — | eigenaar | eerst |
| Variabele `koop` in `deals.js:80` | klein | laag | — | HERSTEL (gedeeld met makelaar) |
| Melding → verhuurder → aannemer (keten a) | middel | middel | W4, consent, K11 | VERDIEPING |
| Woninghuurcontract op een pand | middel | middel | B6, contractregister | VERDIEPING als B6 = A |
| Waarborgsom-signaal | klein | laag | contract | VERDIEPING als B6 = A |
| Inning via Geld | groot | hoog | Geld, echte rail | later |
| Servicekosten | middel | middel | kostenregistratie | later |

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | particuliere en professionele verhuurder | proef met 1 en 20 eenheden | ontbreekt |
| Professionele diepte | contract, waarborgsom, informatieplicht | toets: waarborgsom > 2 × kale huur toont het signaal met bron, en slaat op | ontbreekt |
| Levenscyclus | ingang tot teruggave waarborgsom | proef over een volledige huurperiode | ontbreekt |
| Samenwerking en rollen | verhuurrollen | storing: rol Financieel tekent geen contract | ontbreekt |
| Domeinintelligentie | alleen gelabelde signalen | toets op zekerheidsklasse | ontbreekt |
| Los functioneren | werkt zonder Geld | proef met Geld uit; LOS-tekst verschijnt | half (aanbod) |
| RTG-ketens | a en c | regels in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij | geen rij |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Variabele `koop` → `huur` (`deals.js:80`) | klein | — |
| Zakelijke huurcontracten in `gebouwplus` alleen voor de cap `gebouw` — gerepareerd (commit d3d5ce8) | — | `server/kern/gebouw-poort.js` |

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Keten a: melding → verhuurder → `bouw` | middel | `server/kern/woningonderhoud.js`, W4 (`server/kern/vakwerk/pro.js`), `server/kern/consent.js` |
| Huurcontract als document bij het lid (keten c, Wonen-kant) | klein | `server/routes/bestanden.js` |
| Woninghuurcontract en waarborgsom-signaal op een `vastgoed`-pand (alleen als B6 = A) | middel | `server/bedrijf/contract.js`, `supplier.panden` |

Later: inning via Geld (groot), servicekostenafrekening (middel), informatieplicht-signaal (klein).

**(B) Domeinmaximum: de verhuurcyclus (richting, geen toezegging)**

1. Verhuurbaar maken: eenheid, energielabel, huurprijsberekening (advies).
2. Aanbieden met objectieve selectiecriteria (Wet goed verhuurderschap; te controleren).
3. Screening met toestemming; geen discriminatie.
4. Contract, informatieset, waarborgsom (maximum te controleren).
5. Sleuteloverdracht met ingangsinspectie en foto's.
6. Maandelijkse inning, achterstandsbeleid, aanmaningen.
7. Reparatieverzoeken (keten a), planmatig onderhoud.
8. Jaarlijkse huurverhoging binnen de wettelijke grenzen (te controleren).
9. Servicekostenafrekening (termijn te controleren).
10. Opzegging, eindinspectie, waarborgsom terug.
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

**Volledige werkzaamheid:** binnen de huidige scope bedient RTG de huurder van een corporatie, niet de corporatie: het lid bewaart zijn corporatiecontract en zijn meldingen in het eigen woningdossier en kan een melding exporteren voor het portaal van zijn corporatie; geen scherm suggereert toegang tot sociale huur. Toets: `link:wonen` (BEWEZEN) plus een toets dat de eerlijke grens in `openingen-kaart.js` blijft staan. Een corporatiekant bestaat pas na besluit B7.

Er past geen genre. `server/kern/knelpunt/openingen-kaart.js:107-114` en HDI.md (rond r. 551) zeggen letterlijk dat sociale huur, een woningcorporatie, een urgentieverklaring en een wachtlijst "in deze code niet" bestaan, en dat `vastgoed` "commercieel aanbod en geen woonvoorziening" is. Volgens de bijstelling ontwerpt deze kaart hier geen domein. Wat volgt, is de analyse en de besluitvraag.

### a. Inventaris van het bewezen bestaande

- Niets corporatie-specifieks. Wat een corporatie zou kunnen raken: de melding van de bewoner (Wonen), het zakelijke gebouwbeheer (`kantoorgebouw`, één gebouw per zaak), de concernlaag voor de toegelaten instelling als rechtspersoon (`server/kern/concern/`, `server/kern/onderneming/rechtsvorm-nl.js`).
- Geen APPWERKT-rij, geen keten, geen bewijseis.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Aareon Tobias 365 (te controleren) | prijs op offerte; apps en het portaal Mareon | nee |
| Itris ViewPoint (te controleren) | modules voor mutatie, overlast, huurincasso en inspectie | nee |
| Cegeka-DSA Dynamics Empire (te controleren) | marktaandeel ca. 2019: Cegeka 31%, Aareon 26% [oud] | nee |

Bronnen: https://www.aareon.nl/producten/tobias, https://itris.nl/oplossingen/modules, https://www.computable.nl/?p=256188, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- Een corporatie is een toegelaten instelling met tienduizenden huurders, toewijzing via wachtlijst en urgentie, en publiek toezicht.
- De Aw (ILT) houdt toezicht op grond van art. 61 Woningwet: rechtmatigheid, governance, financiële continuïteit, fit & proper (https://www.ilent.nl/onderwerpen/autoriteit-woningcorporaties/over-de-autoriteit-woningcorporaties/toezicht-van-de-aw/toezicht-op-woningcorporaties) (te controleren).
- Regels: Woningwet, Btiv en Rtiv (https://www.ilent.nl/onderwerpen/autoriteit-woningcorporaties/publicaties-cijfers-en-wetgeving-autoriteit-woningcorporaties/wet-en-regelgeving/woningwet-btiv-en-rtiv) (te controleren).
- dVi vóór 1 juli, met een accountantsprotocol (te controleren).
- Bronnen geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wat dat voor software betekent:** toewijzing raakt rechten van woningzoekenden en vraagt uitlegbare regels en bezwaar; dat is geen functie die als "projectie" in een bestaand genre past. Een corporatie zou bovendien een gereguleerde sector zijn (toelating met menselijke aftekening, CIVILIS par. 3).

### d. Functiecatalogus L1–L6

Alleen wat binnen bestaande eigenaren valt:

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | Huurder legt corporatiecontract en meldingen in eigen dossier | half (Wonen bestaat) | Woningdossier, melding | lid is eigenaar | — | lid | lid | — | het lid kan een melding exporteren voor het portaal van zijn corporatie | klein | later (Wonen) |
| L1 | Eerlijke zin in Wonen | bestaat (`openingen-kaart.js`) | — | RTG belooft geen sociale huur | — | lid | — | — | geen scherm suggereert toegang tot sociale huur | — | bestaat |
| L3 | Toewijzing, wachtlijst, urgentie | ontbreekt | — | — | — | — | — | — | — | groot | niet doen zonder besluit B7: nieuw domein, gereguleerd |
| L3 | Corporatie als `kantoorgebouw`-zaak | — | — | één gebouw per zaak, geen woonunits | — | — | — | — | — | — | niet doen: verkeerd model, zou een tweede woonmotor in `gebouw` worden |

**L5 Volledige levenscyclus** (catalogus; alleen de huurderskant)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Contract bewaren | half (Woningdossier) | upload door het lid | lid is eigenaar | — | lid | lid | — | contract staat met herkomst "zelf geüpload" | — | bestaat (Wonen) |
| L5.2 Melding vastleggen | bestaat (`link:wonen` BEWEZEN) | `woningonderhoud.js` | — | — | lid | lid | — | — | — | bestaat |
| L5.3 Melding exporteren | ontbreekt | melding | tekst + foto's, geen koppeling | — | lid | lid | — | het lid kopieert of downloadt de melding in één tik | klein | later (Wonen) |
| L5.4 Inschrijving, toewijzing, mutatie | ontbreekt | — | — | — | — | — | — | — | groot | niet doen (B7) |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Melding → corporatie | ontbreekt; geen ontvanger | — | — | — | — | — | — | — | middel per corporatie | niet doen vóór B7 (optie B: externe koppeling) |
| L6.2 Huur → Geld | ontbreekt | Geld | Geld is eigenaar | — | lid | lid koppelt | — | huur staat in Geld | middel | later (Geld) |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | (geen corporatiekant) | — |
| noodzakelijke platformdiensten | lidsessie, kluis voor het contract | "U bent uitgelogd. Uw dossier staat veilig; log opnieuw in om het te zien." |
| optionele koppelingen | corporatieportaal (bestaat niet) | "Uw corporatie is niet op RTG aangesloten. Uw melding staat in uw eigen dossier." |

**Modus SAMEN:** bestaat niet.

```js
samen: null /* geen corporatiekant in RTG; besluit B7. Een keten van Wonen naar een corporatie is een externe koppeling (optie B) en geen ketens-regel. */
```

### e. RTG-exclusieve mogelijkheden

Geen, zolang er geen besluit is. Potentieel (alleen na B7): een melding uit Wonen die zonder overtypen bij de corporatie binnenkomt (eigenaar Wonen; keten a).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen bij een eventueel besluit: genre-register, concernlaag, keten a.
- Ontbrekend: alles. Eigenaarstwijfel: is dit RTG-werk of een externe koppeling met corporatieportalen? Zie B7.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Eerlijke grens laten staan | — | — | — | HERSTEL: niets te doen; bestaat |
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

**(A) Binnen de huidige architectuur en scope:** HERSTEL: niets. VERDIEPING: niets aan de zaakkant. Later: de export van een melding uit Wonen (klein, bouwt op `server/kern/woningonderhoud.js`), en de eerlijke grens in `openingen-kaart.js` laten staan.

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

**Volledige werkzaamheid:** een architect (zelfstandig of bureau) voert een opdracht van een lid door de ontwerpfasen, laat het lid per versie akkoord geven, houdt de vergunningsstap zichtbaar (extern), levert het bestek als verwijzing aan de aannemer van het lid en de ontwerpdocumenten aan het woningdossier, en toont de titel "architect" alleen met een door RTG afgetekend registerbewijs; het eindpunt is een opgeleverd ontwerpdossier met per fase wie het zette. Toets: een proef die keten e uitbreidt met de architect, en een toets dat de titel zonder aftekening niet verschijnt.

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
| Archicad (Graphisoft) (te controleren) | Studio en Collaborate als abonnement | ontwerpsoftware nee, en niet doen |
| Revit / AEC Collection (Autodesk) (te controleren) | Revit $3.005 per jaar; AEC Collection $3.675 | nee, en niet doen |
| Simplicate (te controleren) | bureausoftware, prijs per gebruiker [oud] | half (praktijkdossiers, Werk OS-projecten) |

Bronnen: https://www.graphisoft.com/en-nl/pricing/, https://www.autodesk.com/collections/architecture-engineering-construction/buy, https://www.simplicate.com/nl/tarieven/, geraadpleegd 2026-10-19 (via zoektool, live te controleren). RTG bouwt geen tekenpakket; het vergelijkbare deel is de bureau- en opdrachtgeverskant.

### c. Analyse van het volledige domein

- **Particulier:** het lid laat een uitbouw of verbouwing ontwerpen en heeft een vergunningstekening nodig.
- **Professioneel:** de titel architect is beschermd door de Wet op de architectentitel; alleen met inschrijving in het Architectenregister (https://www.architectenregister.nl/wie-wij-zijn/wet-op-de-architectentitel) (te controleren). Beroepservaringsperiode van 2 jaar, 16 uur bij- en nascholing per jaar (https://www.architectenregister.nl/geregistreerden/bij-en-nascholing) (te controleren). Geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- Gangbare fasering (schetsontwerp, voorlopig ontwerp, definitief ontwerp, vergunning, technisch ontwerp, uitvoering): niet in de feiten (te controleren).
- **Wat dat voor software betekent:** een zaak die zich "architect" noemt, kan een registerinschrijving tonen die een mens van RTG heeft afgetekend; RTG valideert niet bij het register en doet niet alsof. Dat de titel beschermd is, is te controleren; daarom is de aftekening een voorwaarde voor het TONEN van de titel (RTG-productregel), niet een weigering van de zaak. De vergunningsaanvraag blijft extern (voorbehouden).

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | Ontwerp-akkoord van het lid per versie | ontbreekt | document in het praktijkdossier | akkoord hoort bij één versie | — | lid bij nieuwe versie | lid akkoord, via gastlink | — | een akkoord op versie 2 geldt niet voor versie 3 | middel | later (hangt aan B8) |
| L1 | Ontwerp landt in het woningdossier | ontbreekt | document | lid neemt aan | — | lid | lid | — | de vergunningstekening staat in Woningdossier met herkomst | klein | later |
| L2 | Fasen als stappen in het praktijkdossier | half (dossierstatus bestaat) | `server/kern/planners/praktijk.js` | vaste fasenlijst; status per fase | fasenlijst te controleren | lid bij fase-overgang | architect | kleine opdracht zonder fasen | een dossier toont de huidige fase en wie die zette | klein | VERDIEPING (als B8 = A) |
| L2 | Honorarium per fase | ontbreekt | offerte, betaalverzoek (`/api/bedrijf/praktijk/betaalverzoek`) | factuur per afgeronde fase | — | lid bij factuur | architect | — | geen fasefactuur zonder afgeronde fase | middel | later |
| L3 | Rollen voor een architectenbureau | ontbreekt | `FUNCS` | voorstel: Architect, Tekenaar, Projectleider, Officemanager | — | — | manager | — | alleen rol Architect zet een fase op "definitief" | klein | VERDIEPING (als B8 = A) |
| L3 | Titelbewijs met menselijke aftekening | ontbreekt | registerinschrijving, geüpload | titel zichtbaar pas na aftekening; vervalt bij verloop | RTG valideert niet inhoudelijk; wet te controleren | kantoor bij indienen | manager dient in, kantoor tekent af | geen inschrijving: de zaak toont "ontwerper" en niet "architect" | de zaak toont "architect" alleen met afgetekend bewijs | middel | VERDIEPING (B9) |
| L4 | Uren per fase gemeten | ontbreekt | agenda per adviseur | telling | — | manager | manager | — | getal heet "gemeten" | klein | later |

**L5 Volledige levenscyclus** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Intake en dossier | bestaat, onbewezen (`/api/supplier/dossier`) | praktijkdossier | één dossier per opdracht | — | lid bij opening | architect | — | het dossier bestaat na herstart | — | bestaat |
| L5.2 Woningprojectie ontvangen | ontbreekt | `woning.dossier` | ruimte en bouwdelen, met consent | — | lid ziet de partij | lid | intrekken: architect houdt eigen dossier | de architect ziet alleen de gedeelde ruimte | middel | later |
| L5.3 Ontwerpfasen | half (status) | `praktijk.js` | fasenlijst | lijst te controleren | lid bij overgang | Architect | — | zie L2 | klein | VERDIEPING (B8) |
| L5.4 Akkoord per versie | ontbreekt | gastlink | versiegebonden | — | lid | lid | gastlink verlopen: 404 | zie L1 | middel | later |
| L5.5 Vergunning | extern | — | RTG toont de stap, dient niets in (voorbehouden) | — | lid | — | — | geen knop "indienen" | — | niet doen (voorbehouden) |
| L5.6 Bestek naar aannemer | ontbreekt | document | verwijzing via het lid, nooit rechtstreeks zonder consent | — | aannemer | lid geeft door | aannemer niet op RTG: lid downloadt | de aannemer ziet het bestek pas na doorgeven door het lid | middel | later |
| L5.7 Honorarium | ontbreekt | betaalverzoek | per fase | — | lid | architect | — | zie L2 | middel | later |
| L5.8 Oplevering ontwerpdossier | ontbreekt | documenten | naar Woningdossier | — | lid | lid neemt aan | — | dossier met herkomst | klein | later |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Wonen → architect (projectie) | ontbreekt | `woning.dossier` | consent per opdracht | — | lid | lid, `privacy.toegang` | — | architect staat als partij in het Consent Center | middel | later |
| L6.2 Architect → lid (document) | ontbreekt | ontwerpversie | lid neemt aan | — | lid | lid | — | document met herkomst | klein | later |
| L6.3 Architect → aannemer (verwijzing via het lid) | ontbreekt | bestek | nooit zonder consent | — | aannemer | lid | — | — | middel | later |
| L6.4 Titelbewijs ← kantoor (aftekening) | ontbreekt | `BEWIJS_EISEN` (`server/kern/bedrijfscontrole.js`) | aftekening door een mens van RTG | geen registercontrole | kantoor | kantoor | — | zie L3 | middel | VERDIEPING (B9) |
| L6.5 Samenwerking (gastlink) | bestaat (`praktijk-gast.js`) | werkruimte | gastlink, minimaal gratis account | brug naar zaak ontbreekt (B3) | lid | lid | gastlink verlopen | — | middel | later (B3) |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | praktijkdossiers, afspraken, dossierstatus | "De opdrachtgever deelt geen woninggegevens via RTG." |
| noodzakelijke platformdiensten | zaaksessie, opslag, aftekening door het kantoor | "Uw registerbewijs wacht op aftekening door RTG. Tot dan staat u als ontwerper vermeld." |
| optionele koppelingen | Wonen (projectie, documenten), aannemer (bestek), Werk OS-gastlink | "Deze opdrachtgever heeft geen gastlink geopend. Deel de versie op een andere manier." |

**Modus SAMEN** (verbouwing met architect, uitbreiding van keten e):
1. Lid deelt de woningprojectie (ruimte, bouwdelen) met de architect. Storing: lid trekt in; de architect behoudt zijn eigen dossier, niet de projectie.
2. Architect zet fase schetsontwerp en deelt versie 1 via gastlink. Storing: gastlink verlopen; het lid ziet "deze link is verlopen" (404, bestaand gedrag).
3. Lid geeft akkoord op versie 2. Storing: architect wijzigt na akkoord; het akkoord geldt niet voor de nieuwe versie.
4. Vergunning: extern. RTG toont de stap, dient niets in.
5. Bestek gaat als verwijzing naar de aannemer (keten e, stap 2). Storing: aannemer niet op RTG; het lid downloadt het bestek.
6. Tenant-storing: architect B ziet niets van het dossier van architect A.

```js
samen: {
  functie: 'link:leverancier-architect' /* bestaat nog niet; B14, en hangt aan B8 */, familie: 'woning' /* voorstel B15 */,
  belofte: 'een architect voert een opdracht door de fasen, het lid geeft per versie akkoord, de ontwerpstukken landen in het woningdossier en het bestek gaat alleen via het lid naar de aannemer',
  ingang: '/apps/leverancier.html', via: 'tab Praktijk',
  bestanden: [] /* het praktijkscherm zit in public/apps/leverancier.js (renderAdvies); bundelbestand te bepalen */, scenario: 'scripts/lib/voltooi/leverancier-architect.js' /* te maken */,
  ketens: [
    { naam: 'woning-naar-architect', uitgeeft: 'ruimte', ontvangt: 'zaak.beheer', vorm: 'projectie',
      eigenaar: 'woning.dossier', toestemming: 'per opdracht, alleen-lezen, in privacy.toegang', storingen: ['intrekken', 'tenant: architect B ziet niets'], proef: 'scripts/verbouwproef.js' /* uitbreiding */ },
    { naam: 'versie-naar-lid', uitgeeft: 'ontwerpversie', ontvangt: 'woning.dossier', vorm: 'verwijzing',
      eigenaar: 'zaak.beheer', toestemming: 'gastlink of document dat het lid aanneemt', storingen: ['gastlink verlopen', 'akkoord geldt niet voor nieuwe versie'], proef: 'scripts/verbouwproef.js' },
    { naam: 'bestek-naar-aannemer', uitgeeft: 'bestek', ontvangt: 'zaak.beheer', vorm: 'verwijzing',
      eigenaar: 'zaak.beheer', toestemming: 'alleen via het lid', storingen: ['aannemer niet op RTG: lid downloadt'], proef: 'scripts/verbouwproef.js' }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **Ontwerp, bestek, offerte en opleverdossier op één woningdossier** (eigenaar Wonen): de architect ziet de bestaande bouwdelen, de aannemer het bestek, het lid alles.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/routes/planners.js`, `server/kern/planners/praktijk.js`, `server/bedrijf/project.js`, `server/bedrijf/praktijk-gast.js`.
- Ontbrekend: Wonen → architect (projectie, consent); architect → lid (document); architect → aannemer (verwijzing via het lid, nooit rechtstreeks zonder consent).

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Titel "architect" niet tonen zonder afgetekend bewijs | middel | middel | B9 | VERDIEPING |
| Rollen en fasen binnen `professioneel` | klein | laag | B8 | VERDIEPING |
| Akkoord per versie | middel | middel | gastlink | later |
| Honorarium per fase | middel | middel | betaalverzoek | later |

Geen HERSTEL-regel: er is in de code van deze praktijkkant niets gevonden dat het scherm belooft en niet doet.

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | zelfstandig architect en bureau | proef met `professioneel` en `zzp` | half |
| Professionele diepte | fasen, akkoord per versie | proef: oud akkoord geldt niet voor nieuwe versie | ontbreekt |
| Levenscyclus | wens tot oplevering | `verbouwproef` uitgebreid met de architect | ontbreekt |
| Samenwerking en rollen | bureaurollen | storing: Tekenaar zet geen fase op definitief | ontbreekt |
| Domeinintelligentie | gemeten uren | toets op label | ontbreekt |
| Los functioneren | praktijk zonder Wonen | proef met Wonen uit; LOS-tekst verschijnt | bestaat, onbewezen |
| RTG-ketens | e (uitgebreid) | regel `verbouwing` in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen; titelbewijs met aftekening | APPWERKT-rij; bewijseis in `BEWIJS_EISEN` | geen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL: geen.

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Titelbewijs met menselijke aftekening (titel pas tonen na aftekening) | middel | `server/kern/bedrijfscontrole.js` (`BEWIJS_EISEN`), bestaande aftekening |
| Rolprofiel architect binnen `professioneel` | klein | `FUNCS` |
| Fasen als dossierstatus | klein | `server/kern/planners/praktijk.js` |

Later: akkoord per versie via gastlink (middel, `server/bedrijf/praktijk-gast.js`); honorarium per fase (middel).

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
  - (aanbevolen) Ja, alleen voor het tonen van de titel; menselijke aftekening, geen registercontrole. Kost: middel. Dat de titel wettelijk beschermd is, is te controleren; de eis blijft een RTG-productregel voor het tonen, geen weigering van de zaak.
  - Nee. Kost: geen; de zaak kan zich architect noemen zonder bewijs.

---

## 6. VvE (geen woongenre; de concernlaag)

**Volledige werkzaamheid:** een VvE (zelfbeheerd of via een beheerder) bestaat als vereniging met een bestuur, roept haar bevestigde leden op, laat hen stemmen met het stemgewicht en de drempels uit haar eigen reglement, legt besluiten en notulen als document bij de leden neer en toont de reserveringsnorm als signaal; het eindpunt is een afgesloten VvE-jaar (begroting, vergadering, besluiten, notulen). Toets: een proef over één VvE-jaar met een tenant-storing tussen twee VvE's. Alles hangt aan besluit B10.

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
| TwinQ (te controleren) | beroepsbeheerders; tarieflijst 2026 | nee |
| VvE Beheer Software (te controleren) | €19, €34 of €59 per VvE; digitaal stemmen naar breukdeel, quorumcheck | half (besluitvorming bestaat, maar één stem per persoon) |
| VvE App (te controleren) | gratis start, Plus €19 | nee |

Bronnen: https://www.twinq.nl/tarieflijst-beroepsmatige-vve-beheerders/, https://vvebeheersoftware.nl/, https://vveapp.com/vve-beheer-kosten, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Particulier:** de bewoner is van rechtswege lid van de VvE (te controleren); hij wil weten wat er besloten wordt, wat hij betaalt en wat er gereserveerd is.
- **Organisatie:** een kleine VvE wordt door bewoners zelf bestuurd; een grote door een beroepsbeheerder (beroep 7).
- **Wet verbetering functioneren VvE:** jaarlijks reserveren op basis van een MJOP (minstens 10 jaar, niet ouder dan 5 jaar) of minstens 0,5% van de herbouwwaarde; afwijken kan met 4/5 van de stemmen of een bankgarantie (art. 5:126 BW) (https://www.vvebelang.nl/kennisbank/juridisch/wet-vve/, geraadpleegd 2026-10-19, via zoektool, live te controleren) (te controleren). Een wetsvoorstel voor een MJOP van 30 jaar: status onbevestigd (te controleren).
- Bewaarplicht administratie: 7 jaar (domein-max.txt, art. 52 AWR; voor verenigingen via de Belastingdienst-pagina voor stichtingen en verenigingen) (te controleren).
- **Wat dat voor software betekent:** stemgewicht en quorum komen uit de splitsingsakte en het reglement van de VvE zelf; het bestuur voert ze in en RTG rekent ermee ("bepaald" zodra ingevoerd). De wettelijke reserveringsnorm (0,5% of MJOP) en de 4/5-drempel zijn te controleren en staan dus als signaal naast de berekening, niet als weigering. De MJOP zelf is "advies" (een deskundige stelt hem op). De splitsingsakte en het reglement blijven bij de notaris (extern).

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | VvE-lidmaatschap in Wonen | ontbreekt (object van Wonen volgens de afspraak) | appartementsrecht, breukdeel | het lid voert in; bevestiging door de VvE | onbevestigd = geen stemrecht | lid | lid | — | het lid ziet zijn breukdeel met "bevestigd" of "niet bevestigd" | klein | later (Wonen) |
| L1 | Bijdrage als verplichting in Geld | ontbreekt | bedrag, dag | Geld is eigenaar | — | lid | lid | — | bijdrage staat in Geld, niet in Wonen | middel | later |
| L3 | VvE als vereniging in de concernlaag | half (rechtsvorm bestaat) | `rechtsvorm-nl.js`, `server/kern/concern/` | bestuur via de bestaande bevoegdheidsgraaf | — | bestuur | bestuur | — | een VvE kan als entiteit met bestuurders bestaan | middel | VERDIEPING, als B10 = A |
| L3 | Stemmen naar breukdeel met quorum | ontbreekt (`server/bedrijf/besluit.js` kent één stem per persoon) | breukdelen, reglement | stemgewicht = breukdeel; quorum en drempel zoals het bestuur ze uit het reglement invoert | wettelijke 4/5-drempel te controleren: signaal als een reserveringsbesluit eronder blijft | leden bij oproep en uitslag | lid stemt zelf; geen volmacht zonder vastgelegde volmacht | quorum niet gehaald = "niet genomen" | een stemming met een ingevoerde drempel van 80% slaagt alleen bij ≥ 80% van de breukdelen | middel | later (hangt aan B10, B11) |
| L3 | Reserveringsnorm als signaal | ontbreekt | herbouwwaarde, MJOP-bedrag | toont max(0,5% herbouwwaarde, MJOP-bedrag) naast het begrote bedrag (te controleren) | regel niet nagelezen; bij onvolledige invoer "niet ingedeeld" | bestuur bij begroting | bestuur | afwijkingsbesluit | de toets toont de norm, het begrote bedrag en het verschil, en weigert niets | klein | later |
| L4 | MJOP opstellen | ontbreekt | inspectie | — | deskundige | — | — | — | — | groot | niet doen: is werk van een deskundige; RTG bewaart de MJOP als document |

**L5 Volledige levenscyclus** (catalogus; een VvE-jaar)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Oprichten als vereniging | half (rechtsvorm) | concernlaag | entiteit + bestuurders | — | bestuur | bestuur | — | de VvE bestaat na herstart | middel | VERDIEPING (B10 = A) |
| L5.2 Leden bevestigen | ontbreekt | breukdeel uit Wonen | bestuur bevestigt | — | lid | bestuur | onbevestigd: geen stemrecht, met reden | — | klein | later |
| L5.3 Begroting en bijdrage | ontbreekt | Geld | bijdrage per breukdeel | — | leden | bestuur | — | som bijdragen = begroting | middel | later |
| L5.4 Oproep en agenda | ontbreekt | stukken | projectie naar bevestigde leden | — | leden bij oproep | bestuur | — | een niet-lid ziet niets | middel | later |
| L5.5 Stemmen | ontbreekt | besluit | breukdeel, drempel uit reglement | — | leden | lid zelf | stem na sluiting geweigerd; tweede stem vervangt eerste tot sluiting | zie L3 | middel | later |
| L5.6 Notulen en besluitenlijst | half (`besluitlijst.js`) | besluit | document naar de leden | — | leden | bestuur | — | notulen staan in Woningdossier van elk lid | klein | later |
| L5.7 Opdracht onderhoud | ontbreekt | keten a/e op gebouwniveau | offerte bij `bouw` | — | aannemer | bestuur | — | — | middel | later |
| L5.8 Jaarrekening en decharge | ontbreekt | Geld | kascommissie | — | leden | bestuur, kascommissie | — | — | middel | later |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 VvE → lid (projectie, keten d) | ontbreekt | vergadering, besluiten, MJOP, reservefonds | alleen voor bevestigde leden | — | lid bij oproep | bestuur bevestigt | — | een lid ziet de oproep en stemt; een niet-lid ziet niets | middel | later |
| L6.2 Lid → VvE (stem als gebeurtenis) | ontbreekt | stem | één per lid, wijzigbaar tot sluiting | — | bestuur bij uitslag | lid zelf | — | — | middel | later |
| L6.3 VvE → Geld (bijdrage als verplichting) | ontbreekt | Geld | Geld rekent | — | lid | lid koppelt | — | — | middel | later |
| L6.4 VvE → `bouw` (opdracht) | ontbreekt | keten e op gebouwniveau | offerte, akkoord door bestuur | — | aannemer | bestuur | — | — | middel | later |
| L6.5 Notulen → Woningdossier (document) | ontbreekt | besluitlijst | lid neemt aan | — | lid | — | — | — | klein | later |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | (na B10) vereniging met bestuur in de concernlaag | "Deze vereniging heeft nog geen bevestigde leden." |
| noodzakelijke platformdiensten | sessie, opslag, bevoegdheidsgraaf van de concernlaag | "U bent geen bestuurder van deze vereniging. Vraag een bestuurder om u toe te voegen." |
| optionele koppelingen | Wonen (lidmaatschap, stukken), Geld (bijdrage) | "Uw VvE is niet op RTG aangesloten." (lidkant; VvE-stukken staan dan als documenten in Woningdossier) |

**Modus SAMEN**, keten d (alleen na B10 = A):
1. Bestuur roept vergadering op; leden zien de oproep via de projectie. Storing: lid niet bevestigd; geen stemrecht, met reden.
2. Leden stemmen naar breukdeel. Storing: stem na sluiting; geweigerd. Storing: dubbele stem; de tweede vervangt de eerste tot sluiting.
3. Uitslag: quorum niet gehaald heet "niet genomen".
4. Besluit en notulen gaan als document naar de leden (Wonen).
5. Tenant-storing: VvE B ziet geen leden of besluiten van VvE A.

```js
samen: {
  functie: 'link:werk-concern-vve' /* geen eigen scherm; de concernlaag heeft werk.concern. Id en ingang vragen B10 en B14 */, familie: 'woning' /* voorstel B15 */,
  belofte: 'een VvE roept haar bevestigde leden op, zij stemmen naar breukdeel, en besluiten en notulen landen in het woningdossier van elk lid -- een andere VvE ziet niets',
  ingang: null /* te bepalen na B10 */, via: 'de concernlaag',
  bestanden: [], scenario: 'scripts/lib/voltooi/vve.js' /* te maken */,
  ketens: [
    { naam: 'oproep-naar-lid', uitgeeft: 'vergadering', ontvangt: 'woning.overzicht', vorm: 'projectie',
      eigenaar: 'werk.concern', toestemming: 'alleen bevestigde leden', storingen: ['niet bevestigd: geen stemrecht', 'tenant: VvE B ziet niets'], proef: 'scripts/vveproef.js' /* voorstel */ },
    { naam: 'stem-naar-vve', uitgeeft: 'stem', ontvangt: 'werk.besluit', vorm: 'gebeurtenis',
      eigenaar: 'werk.besluit', toestemming: 'alleen het lid zelf', storingen: ['stem na sluiting geweigerd', 'quorum niet gehaald: niet genomen'], proef: 'scripts/vveproef.js' },
    { naam: 'bijdrage-naar-geld', uitgeeft: 'bijdrage', ontvangt: 'geld.overzicht', vorm: 'verwijzing',
      eigenaar: 'geld.overzicht', toestemming: 'het lid koppelt', storingen: ['niet gekoppeld: VvE ziet geen status'], proef: null }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **VvE-besluit naast het eigen woningdossier en het eigen Geld-potje** (eigenaren Wonen en Geld): het lid ziet wat een dakrenovatie voor zijn bijdrage betekent.

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/kern/onderneming/rechtsvorm-nl.js`, `server/kern/concern/`, `server/bedrijf/besluit.js`, `server/routes/geld.js`.
- Ontbrekend: VvE → lid (projectie, alleen bevestigde leden); lid → VvE (stem als gebeurtenis); VvE → Geld (bijdrage als verplichting, verwijzing).
- Eigenaarstwijfel: stemmen naar breukdeel hoort bij `server/bedrijf/besluit.js` (uitbreiding van één stem per persoon) of bij een VvE-kant. Zie B10 en B11.

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| VvE als vereniging in de concernlaag | middel | middel | B10 | VERDIEPING als B10 = A |
| Lidmaatschap in Wonen | klein | laag | Wonen | later |
| Stemmen naar breukdeel | middel | middel | `besluit.js`, B11 | later |
| Reserveringsnorm als signaal | klein | laag | invoer | later |
| MJOP opstellen | groot | hoog | deskundige | niet doen |

Geen HERSTEL-regel: er is geen VvE-code die iets belooft.

### h. Toetsbaar eindcontract Beyond Premium

| Dimensie | Eis | Toets | Stand nu |
|---|---|---|---|
| Breedte | kleine zelfbeheerde en grote VvE | proef met 4 en 80 appartementsrechten | ontbreekt |
| Professionele diepte | breukdeel, quorum, drempel uit reglement | toets: bij een ingevoerde drempel van 80% haalt 79% hem niet | ontbreekt |
| Levenscyclus | een VvE-jaar | proef: begroting → vergadering → besluit → notulen | ontbreekt |
| Samenwerking en rollen | bestuur, leden, beheerder | storing: lid sluit geen stemming | ontbreekt |
| Domeinintelligentie | reserveringsnorm met klasse en label "te controleren" | toets op zekerheidsklasse | ontbreekt |
| Los functioneren | stukken in Woningdossier | APPWERKT `link:wonen` | BEWEZEN (bevoegd NIET_GETEST) |
| RTG-ketens | d | regel in `KETENS` | geen |
| Bewezen betrouwbaarheid | acht bewijzen | APPWERKT-rij | geen |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL: geen.

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| VvE-stukken als documenten in Woningdossier | klein | `server/routes/bestanden.js` (Wonen) |
| VvE als vereniging in de concernlaag (als B10 = A) | middel | `server/kern/onderneming/rechtsvorm-nl.js`, `server/kern/concern/` |

Later: reserveringsnorm als signaal (klein, invoer door het bestuur); stemgewicht (middel, B11).

**(B) Domeinmaximum: een VvE-jaar (richting, geen toezegging)**

1. Begroting en voorschotbijdragen per breukdeel.
2. Reservering volgens MJOP of een percentage van de herbouwwaarde (te controleren).
3. Oproep ledenvergadering met agenda en stukken.
4. Vergadering en stemmen (fysiek, digitaal, volmacht).
5. Notulen en besluitenlijst.
6. Opdrachten aan aannemers voor gemeenschappelijk onderhoud (keten a en e op gebouwniveau).
7. Inning, achterstanden, aanmaningen.
8. Jaarrekening, kascommissie, decharge.
9. MJOP-actualisatie door een deskundige.
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

**Volledige werkzaamheid:** een beheerder van een commercieel gebouw houdt installaties en keuringen, huurcontracten met looptijd, leads, bezoekers en meldingen bij, zet een melding van een huurder door naar een aannemer en werkt de keuring bij na de werkbon; het eindpunt is een melding die "opgelost" is door Facilitair met een bijgewerkte keuring. Toets: een proef van keten a op gebouwniveau met een tenant-storing, plus de bestaande toets `test/gebouw-cap.test.js` op de genregrens. Woningen beheert hij als verhuurder (B6), meer gebouwen via het concern (B12).

Genre `kantoorgebouw` ("Kantoorgebouw (RTG Enterprise)", sector facility, open, `server/seed/genres-lijst-b.js:37`). Caps gebouw, location, pricing. Tab "Gebouw" (`public/apps/leverancier.js:174`; `renderGebouw` op `has('gebouw')`, r. 5454). Rollen Receptie, Security, Facilitair, Concierge & jetset. Eén gebouw per zaak, geen woonunits, geen portefeuille.

### a. Inventaris van het bewezen bestaande

| Onderdeel | Pad | Stand |
|---|---|---|
| Gebouw: toren, vloeren, huurders per verdieping, zalen met boekingen, bezoekers, badges, meldingen (schoonmaak, onderhoud, catering), valet, jetset | `server/kern/gebouw.js`, `server/kern/gebouw-demo.js`, `server/routes/gebouw.js` (`/api/supplier/gebouw`, `/zaal`, `/bezoeker`, `/badge`, `/melding`, `/valet`, `/jetset`) | staat, onbewezen |
| Pand: installaties met keuringsbewaking, post, parkeren, BHV | `server/routes/supplier/gebouwpand.js` (`/api/supplier/gebouwpand/overzicht`, `/installatie`, `/installatie/keuring`, `/post`, `/post/opgehaald`, `/parkeer`, `/bhv`) | staat, onbewezen; cap-check gerepareerd (d3d5ce8) |
| Plus: huurcontracten met looptijdbewaking, leads (nieuw → rondleiding → voorstel → getekend of afgewezen), energie per week | `server/routes/supplier/gebouwplus.js` (`/api/supplier/gebouwplus/overzicht`, `/contract`, `/contract/zet`, `/lead`, `/lead/fase`, `/energie`) | staat, onbewezen; cap-check gerepareerd (d3d5ce8) |
| De genregrens voor alle drie | `server/kern/gebouw-poort.js` (`eisGebouw`) | bestaat; `test/gebouw-cap.test.js` |
| Schermen | `public/apps/leverancier-gebouwpand.js`, `public/apps/leverancier-gebouwplus.js` (3D-toren), `public/apps/leverancier-gebouwrapport.js` | staat, onbewezen |

Geen APPWERKT-rij voor de gebouwkant. Niet gebouwd: woonunits, meerdere gebouwen per zaak, servicekostenafrekening, beheer namens een eigenaar.

### b. Marktvergelijking

| Leider | Achter de betaalmuur | Wij |
|---|---|---|
| Omniboxx (te controleren) | basislicentie plus modules en koppelingen | half (één commercieel gebouw) |
| Bloxs (te controleren) | contractbeheer en de API-module apart | half (contracten in `gebouwplus`) |
| Scope Beheer, TwinQ verhuurbeheer (te controleren) | beheerderssoftware | nee voor woningen |

Bronnen: https://www.omniboxx.nl/basislicentie/, https://www.bloxs.com/koppeling-met-huurprijscheck/, https://www.scopesoftware.nl/beheerders.html, https://twinq.nl/vastgoed-software/verhuurbeheer-software, geraadpleegd 2026-10-19 (via zoektool, live te controleren).

### c. Analyse van het volledige domein

- **Professioneel:** een beheerder werkt namens een of meer eigenaren (beleggers, VvE's), met tientallen tot duizenden eenheden, commercieel en wonen door elkaar.
- Er is geen apart register (te controleren). De Wet goed verhuurderschap verbiedt dubbele bemiddelingskosten (art. 7:417 BW) (https://www.volkshuisvestingnederland.nl/onderwerpen/wet-goed-verhuurderschap/regelgeving-bemiddelingskosten) (te controleren).
- De servicekostenafrekening valt onder het Beleidsboek Servicekosten van januari 2026 (https://www.huurcommissie.nl/site/binaries/site-content/collections/documents/2026/01/01/beleidsboek-servicekosten/beleidsboek-servicekosten-januari-2026.pdf) (te controleren). Beide geraadpleegd 2026-10-19 (via zoektool, live te controleren).
- **Wat dat voor software betekent:** de beheerder handelt namens een eigenaar; zijn rechten zijn een gedelegeerde bevoegdheid en geen eigendom. Een portefeuille van gebouwen is een lijst van gebouwen onder één zaak, niet een nieuwe motor.

### d. Functiecatalogus L1–L6

| Laag | Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L2 | Genregrens op pand en plus | gerepareerd (commit d3d5ce8, `test/gebouw-cap.test.js`) | caps van de zaak | `eisGebouw` als eerste regel van elke handler | — | — | — | — | een zaak zonder cap `gebouw` krijgt 403 op alle 13 routes van pand en plus | — | HERSTEL: gerepareerd (d3d5ce8) |
| L2 | Keuringsbewaking installaties | bestaat (`gebouwpand.js`) | installatie, keuringsdatum | signaal vóór verloop | keuringstermijn per installatie: invoer | Facilitair bij verloop | manager | — | een verlopen keuring staat bovenaan | klein | VERDIEPING (bewijzen) |
| L2 | Huurcontract-looptijd (commercieel) | bestaat (`gebouwplus.js`) | contract | looptijdbewaking | — | manager | manager | — | einddatum binnen 6 maanden zichtbaar | klein | bestaat; bewijzen |
| L2 | Melding van een huurder naar een `bouw`-zaak | ontbreekt (meldingen blijven binnen het gebouw) | `server/kern/gebouw.js` melding | gebeurtenis met melding-id als verwijzing (zelfde vorm als K11) | — | aannemer bij doorzetten | Facilitair zet door | — | een gebouwmelding kan een offertevraag worden zonder overtypen | middel | VERDIEPING |
| L3 | Meerdere gebouwen per zaak | ontbreekt (één gebouw per zaak) | `db.data.gebouw[code]` | lijst van gebouwen onder één code | migratie raakt opslag: besluit | — | manager | — | een beheerder kiest tussen twee gebouwen | groot | later (B12) |
| L3 | Woonunits in een gebouw | ontbreekt | — | — | — | — | — | — | — | groot | niet doen zonder B12: zou een tweede woonmotor naast `vastgoed` worden |
| L4 | Energie per week | bestaat (`gebouwplus.js`) | invoer | telling | gemeten, geen voorspelling | manager | manager | — | het getal heet "gemeten" | klein | bestaat |
| L4 | Servicekostenafrekening | ontbreekt | kosten per post, verdeelsleutel | geen winst; termijn 1 juli als signaal (te controleren) | klasse "uitlegbaar" | huurders | manager | geschil: Huurcommissie (extern) | per post kosten, sleutel en aandeel | middel | later |

**L5 Volledige levenscyclus** (catalogus; een commerciële huurrelatie)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L5.1 Lead | bestaat, onbewezen (`/lead`, `/lead/fase`) | lead | nieuw → rondleiding → voorstel → getekend of afgewezen | — | manager | manager | — | een lead loopt alleen langs deze fasen | — | bestaat; bewijzen |
| L5.2 Contract | bestaat, onbewezen (`/contract`) | contract per verdieping | looptijd | — | manager | manager | — | contract staat na herstart | — | bestaat; bewijzen |
| L5.3 Ingebruikname: badges, bezoekers | bestaat, onbewezen (`server/routes/gebouw.js`) | badge, bezoeker met RTG-account | — | — | Receptie | Receptie, Security | — | — | — | bestaat |
| L5.4 Meldingen | bestaat binnen het gebouw | melding | binnen het gebouw | — | Facilitair | Facilitair | melding zonder verdieping geweigerd | — | — | bestaat |
| L5.5 Doorzetten naar aannemer | ontbreekt | melding-id | verwijzing | — | aannemer | Facilitair | aannemer weigert | zie L2 | middel | VERDIEPING |
| L5.6 Keuringen | bestaat (`/installatie/keuring`) | installatie | signaal vóór verloop | — | Facilitair | manager | — | — | — | bestaat |
| L5.7 Servicekosten | ontbreekt | kosten | uitlegbaar | — | huurders | manager | — | — | middel | later |
| L5.8 Contracteinde | bestaat (looptijdbewaking) | contract | signaal 6 maanden vooraf | — | manager | manager | — | — | — | bestaat |

**L6 RTG-samenhang** (catalogus)

| Functie | Stand | Gegevens en bron | Regels en rekenwijze | Onzekerheid | Wie hoort wanneer | Rollen en toestemming | Uitzonderingen | Acceptatiecriterium | Kosten | Bak |
|---|---|---|---|---|---|---|---|---|---|---|
| L6.1 Gebouwmelding → `bouw` (gebeurtenis) | ontbreekt | melding-id | verwijzing, geen kopie | — | aannemer | Facilitair | aannemer weigert: Facilitair ziet het | de melding gaat pas op "opgelost" door Facilitair | middel | VERDIEPING |
| L6.2 Werkbon → keuring (verwijzing terug) | ontbreekt | werkbon-ref | Facilitair werkt keuring bij | — | Facilitair | Facilitair | — | de keuring noemt de werkbon | klein | later |
| L6.3 Bezoeker met RTG-account | bestaat | account | badge | — | Receptie | bezoeker | — | — | — | bestaat |
| L6.4 Beheerder ↔ eigenaar (gedelegeerde bevoegdheid) | ontbreekt | concernlaag | delegatie, geen eigendom | — | eigenaar | eigenaar delegeert | — | — | middel | later (besluit) |
| L6.5 Contract → woonhuurder (document) | ontbreekt | — | alleen na B12 | — | — | — | — | — | — | niet doen vóór B12 |

**Modus LOS**

| Groep | Wat de app dan kan | Letterlijke schermtekst als iets ontbreekt |
|---|---|---|
| eigen | gebouw, zalen, bezoekers, installaties, keuringen, contracten, leads, energie | "Dit beheer is voor kantoorgebouwen; woonunits worden hier niet beheerd." |
| noodzakelijke platformdiensten | zaaksessie, de genregrens (`eisGebouw`), opslag | "Dit is geen kantoorgebouw-partner." (de bestaande 403-tekst van `server/kern/gebouw-poort.js`) |
| optionele koppelingen | aannemer (`bouw`), Wonen (alleen na B12) | "Deze melding is nog niet aan een aannemer gegeven. Zet hem door of los hem zelf op." |

**Modus SAMEN**, keten a op gebouwniveau:
1. Huurder meldt een kapotte lift (`/api/supplier/gebouw/melding`). Storing: melding zonder verdieping; geweigerd met reden.
2. Facilitair zet door naar een `bouw`-zaak met melding-id als verwijzing (te bouwen). Storing: aannemer weigert; Facilitair ziet de weigering.
3. Aannemer plant en sluit met werkbon. Storing: de werkbon komt binnen; de melding gaat pas op "opgelost" door Facilitair.
4. Keuring van de lift wordt bijgewerkt (`/installatie/keuring`).
5. Tenant-storing: beheerder B ziet het gebouw van beheerder A niet. Genre-storing: een zaak zonder cap `gebouw` wordt op `gebouwpand` en `gebouwplus` geweigerd (sinds d3d5ce8, `test/gebouw-cap.test.js`).

```js
samen: {
  functie: 'link:leverancier-gebouw' /* bestaat nog niet; B14 */, familie: 'woning' /* voorstel B15; commercieel gebouw valt er alleen onder via keten a */,
  belofte: 'een gebouwbeheerder zet een melding van een huurder door naar een aannemer, ziet de werkbon terug en werkt de keuring bij -- een andere zaak komt niet in zijn gebouw',
  ingang: '/apps/leverancier.html', via: 'tab Gebouw',
  bestanden: ['public/apps/leverancier-gebouwpand.js', 'public/apps/leverancier-gebouwplus.js'], scenario: 'scripts/lib/voltooi/leverancier-gebouw.js' /* te maken */,
  ketens: [
    { naam: 'gebouwmelding-naar-aannemer', uitgeeft: 'melding', ontvangt: 'zaak.beheer', vorm: 'gebeurtenis',
      eigenaar: 'zaak.beheer', toestemming: 'Facilitair zet door',
      storingen: ['aannemer weigert', 'aannemer sluit de melding niet zelf', 'tenant: beheerder B ziet het gebouw van A niet', 'zaak zonder cap gebouw: 403'], proef: 'scripts/meldingproef.js' /* voorstel, keten a */ }
  ]
}
```

### e. RTG-exclusieve mogelijkheden

- **Gebouwmelding → aannemer → keuring bijgewerkt, in één ketting** (eigenaren `kantoorgebouw` en `bouw`).
- **Bezoeker met RTG-account en badge** (bestaand in `server/kern/gebouw.js`).

### f. Bouwstenen en ontbrekende koppelingen

- Bouwstenen: `server/kern/gebouw.js`, `server/kern/gebouw-poort.js`, `server/routes/gebouw.js`, `server/routes/supplier/gebouwpand.js`, `server/routes/supplier/gebouwplus.js`, `server/kern/vakwerk/pro.js`.
- Ontbrekend: gebouwmelding → `bouw` (gebeurtenis, verwijzing); beheerder ↔ eigenaar (gedelegeerde bevoegdheid via de concernlaag, besluit).

### g. Prioritering

| Functie | Bouwkosten | Complexiteit | Afhankelijkheden | Bak |
|---|---|---|---|---|
| Cap-check op `gebouwpand` en `gebouwplus` | — | — | — | HERSTEL: gerepareerd (d3d5ce8) |
| Gebouwmelding → `bouw` | middel | middel | vakpro, K11-vorm | VERDIEPING |
| Bewijs voor wat er staat (APPWERKT-rij gebouw, voltooiscenario) | klein | laag | fixture, B14 | VERDIEPING |
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
| Bewezen betrouwbaarheid | acht bewijzen; cap-check op alle gebouwroutes | APPWERKT-rij; `test/gebouw-cap.test.js` | geen rij; cap-check gerepareerd en getoetst (d3d5ce8) |

Dit contract vervangt de acht bewijzen van APPWERKT niet.

### Twee uitkomsten

**(A) Binnen de huidige architectuur en scope**

HERSTEL:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Cap-check op `gebouwpand` en `gebouwplus` — gerepareerd (commit d3d5ce8) | — | `server/kern/gebouw-poort.js`, `test/gebouw-cap.test.js` |

VERDIEPING:

| Functie | Kosten | Bouwt op |
|---|---|---|
| Gebouwmelding → offertevraag bij `bouw` | middel | `server/kern/gebouw.js`, `server/kern/vakwerk/pro.js` |
| Bewijs voor gebouw, pand en plus | klein | voltooiproef-scenario, APPWERKT |

Later: servicekostenafrekening voor commerciële huurders (middel, `server/routes/supplier/gebouwplus.js`); meerdere gebouwen per zaak (groot, B12).

**(B) Domeinmaximum: beheer namens eigenaren (richting, geen toezegging)**

1. Beheerovereenkomst met de eigenaar (belegger, VvE, particulier).
2. Portefeuille: gebouwen, eenheden (commercieel en wonen), installaties.
3. Verhuur: leads, screening, contract (commercieel en woning).
4. Huuradministratie: inning, indexering, achterstanden.
5. Technisch beheer: meldingen, aannemers, keuringen, planmatig onderhoud.
6. Servicekosten: voorschot, afrekening (termijn te controleren).
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
- **B13. Cap-check op `gebouwpand` en `gebouwplus`** — afgedaan: gerepareerd in d3d5ce8 (optie "ja, met dezelfde poort als `eisGebouw` en een toets op 403 zonder cap").

---

## Algemene besluiten van deze herziening

- **B14. Krijgt de zaakkant (`apps/leverancier.html`) functie-id's in de wereldcatalogus, zodat APPWERKT, het app-contract en `samen` erover kunnen spreken?**
  - (aanbevolen) A. Eén id per schermprofiel (`link:leverancier-makelaar`, `-aannemer`, `-gebouw`, later `-verhuur` en `-architect`), met `via` naar de tab. Kost: klein in het register, middel per voltooiscenario. Geen nieuw scherm.
  - B. Eén id `link:leverancier` voor de hele zaakkant. Kost: klein; maar één belofte voor zeven beroepen is geen toetsbare belofte.
  - C. Geen id; de zaakkant blijft buiten APPWERKT. Kost: geen; de vastgoed-, vakpro- en gebouwkant blijven "staat, onbewezen".
- **B15. Komt er een familie `woning` in `FAMILIES`?**
  - (aanbevolen) A. Ja, met de tekst uit ONTBREKEND (meetbaar) en deze kaart als `kaart`; de regels K1-K19 hangen eraan. Kost: klein (registerregel), het werk zit in de ketens.
  - B. Nee; de ketens vallen onder een bestaande familie. Kost: geen; maar `reis` is de enige en past niet.

---

## Samenvatting van de besluiten

| Code | Vraag | Aanbeveling |
|---|---|---|
| B1 | Register Makelaar/NVM als bewijseis | vrijwillige claim met aftekening |
| B2 | Contract van een transactie | bestaand contractregister `server/bedrijf/contract.js` |
| B3 | Samenwerking bij verbouwing | Werk OS-praktijk met gastlink, niet Project Room |
| B4 | Rollen voor `bouw` en `vakwerk` | ja |
| B5 | `vakwerk` buiten VAK_GENRES | afgedaan: gerepareerd (4a914ea) |
| B6 | Woningverhuurder | schermprofiel binnen `vastgoed` |
| B7 | Woningcorporatie | niet vóór V1 |
| B8 | Architect | rolprofiel binnen `professioneel` |
| B9 | Architectentitel als bewijs | ja, voor het tonen van de titel |
| B10 | VvE | vereniging in de concernlaag |
| B11 | Stemgewicht in `besluit.js` | pas bij een tweede gebruiker |
| B12 | Beheerder van woningen en meer gebouwen | `kantoorgebouw` commercieel, woningen via `vastgoed`, meer gebouwen via het concern |
| B13 | Cap-check gebouwpand/gebouwplus | afgedaan: gerepareerd (d3d5ce8) |
| B14 | Functie-id's voor de zaakkant | één id per schermprofiel |
| B15 | Familie `woning` | ja |
