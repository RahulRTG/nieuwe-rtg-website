# Premiumdomeinkaart WorkOS

Familie: WorkOS (17 apps). Opgesteld op 19 oktober 2026 op tak `appwerkt/workos`,
na drie opdrachten van de eigenaar op dezelfde dag: Beyond Premium, de bijstelling
en de aanscherping.

Dit is een KAART en geen bouwopdracht. Een functie wordt pas werk als de
eigenaar haar per familie toezegt (besluit 5). Er komen geen nieuwe domeinen vóór
V1 en de architectuur blijft stabiel: geen nieuwe motor of laag, geen centrale
database, geen tweede eigenaar.

De kaart per app staat in `docs/domeinkaarten/workos/<app>.md` en volgt
`workos/_sjabloon.md`:
- a. inventaris;
- b. markt;
- c. volledig domein;
- d. functiecatalogus L1–L6 met acceptatiecriteria;
- e. RTG-exclusief;
- f. bouwstenen en ontbrekende koppelingen;
- g. prioritering;
- h. toetsbaar eindcontract;
- "Vraagt besluit".

De professionals rond wonen staan in `docs/domeinkaarten/professionals-wonen.md`.

## 1. De zeventien apps

| App | Functie | Kaart | Ingang | Doelgroep | Eigenaar (SCHERMEIGENAAR) |
|---|---|---|---|---|---|
| Werk OS | link:werkos | [werkos.md](workos/werkos.md) | /apps/werk.html | business-lid, organisatie | werk.organisatie |
| Werk | os:werk | [werk.md](workos/werk.md) | /apps/app.html, via Rahul "open werk" | lid met een werkrol | geen entry (zie par. 6) |
| Office / RTDocs | link:office | [office.md](workos/office.md) | /apps/office.html | lid, zaak, kantoor | docs.office |
| RT Mail | link:rtmail | [rtmail.md](workos/rtmail.md) | /apps/rtmail.html | lid, zaak | comm.mail, zaak.rtmail |
| Browser | link:browser | [browser.md](workos/browser.md) | /apps/browser.html | lid | web.browser |
| Sitemaker | link:sitemaker | [sitemaker.md](workos/sitemaker.md) | /apps/sitemaker.html | lid, zaak | werk.website-maker |
| Onderneming | link:onderneming | [onderneming.md](workos/onderneming.md) | /apps/onderneming.html | lid-ondernemer | werk.onderneming |
| Horeca | link:horeca | [horeca.md](workos/horeca.md) | /apps/horeca.html (11 schermen) | zaak | horeca.dashboard + 13 horeca.* |
| Loonstrook | link:loonstrook | [loonstrook.md](workos/loonstrook.md) | /apps/loonstrook.html | medewerker | loon.strook |
| Loopbaan | link:loopbaan | [loopbaan.md](workos/loopbaan.md) | /apps/loopbaan.html | lid | loopbaan.ledger |
| Vertegenwoordiging | link:vertegenwoordiging | [vertegenwoordiging.md](workos/vertegenwoordiging.md) | /apps/vertegenwoordiging.html | lid | mandaat.beheer |
| School | link:school | [school.md](workos/school.md) | /apps/rtgschool.html | leerling, ouder, docent | leren.school |
| Magnaat | link:magnaat | [magnaat.md](workos/magnaat.md) | /apps/magnaat.html | lid (18+-progressie) | spel.magnaat |
| RTG One | link:rtgone | [rtgone.md](workos/rtgone.md) | /apps/rtgone.html | RTG/RTF-personeel | werk.rtgone |
| Decision Room | link:decisionroom | [decisionroom.md](workos/decisionroom.md) | /apps/decision-room.html | RTG-kantoor | werk.besluit |
| Project Room | link:projectroom | [projectroom.md](workos/projectroom.md) | /apps/project-room.html | RTG-kantoor | werk.project |
| Partner Network | link:partnernetwerk | [partnernetwerk.md](workos/partnernetwerk.md) | /apps/partner-network.html | zaak | zaak.partnernetwerk |

## 2. Werkwijze en bronnen

**Vier onderzoeken per app**, zoals de eigenaar ze voorschrijft:

1. **Bestaande werkelijkheid.** Code en documenten zijn gelezen. Het bewijs komt uit:
   - APPWERKT.json (gemeten: 114 onderdelen, 0 defecten);
   - VOLTOOIPROEF.json (stempel 04:47, commit f85c044e);
   - BEVOEGD.json (stempel 05:08, commit 55ed79f9);
   - IDOR.json (1999 routes, 0 doorbraken, 0 lekken);
   - een verse voltooiproef op deze tak (zie par. 3).
2. **Marktmaximum.** Twee à drie marktleiders per categorie, inclusief het duurste enterprisepakket, met bron-URL en de datum 19 oktober 2026.
3. **Domeinmaximum.** De Nederlandse wet en normen met bron: arbeidsrecht, ATW, Wazo, Poortwachter, RI&E, HACCP en KHN, Alcoholwet, ISO 9001/27001/22301, NIS2/Cyberbeveiligingswet, AVG, AWR-bewaarplicht, BW2, WPO en de inspectie, EAA en de Telecommunicatiewet.
4. **RTG Beyond.** Wat er ontstaat doordat apps, rollen en processen verbonden zijn.

**Grens van het webonderzoek.** WebFetch en curl waren vanuit deze omgeving
niet bereikbaar (DNS-fout en proxy 403). Alle markt- en wetsregels komen uit
zoeksamenvattingen van de officiële domeinen. Wetteksten op wetten.overheid.nl
konden niet worden ingezien. Elke regel draagt daarom "(via zoektool, live te
controleren)". Wat de bronnen onzeker lieten, staat als "te controleren". Echte
merken staan er alleen ter vergelijking en nooit als partner.

## 3. Bewijsstand per app (19 oktober 2026)

APPWERKT kent acht bewijzen. "B" betekent bewezen, "NT" niet getest, "GF" geen
fixture.

| Functie | ber | bed | mens | volt | waar | pers | bev | herst | Verse voltooiproef (deze tak, dc501544) |
|---|---|---|---|---|---|---|---|---|---|
| link:werkos | B | B | NT | B | B | B | NT | B | centraal al bewezen |
| os:werk | NT | NT | NT | GF | NT | GF | NT | GF | alle bewijzen sluiten (voltooibaar 5/5) |
| link:office | B | B | NT | GF | B | GF | NT | GF | sluit (6/6, 3/3, 3/3, 3/3) |
| link:rtmail | B | B | B | B | B | B | NT | B | centraal al bewezen |
| link:browser | B | B | NT | GF | B | GF | NT | GF | sluit (7/7, 3/3, 4/4, 3/3) |
| link:sitemaker | B | B | NT | GF | B | GF | **B** | GF | sluit (7/7, 3/3, 4/4, 3/3) |
| link:onderneming | B | B | NT | GF | B | GF | NT | GF | sluit (6/6, 3/3, 4/4, 3/3) |
| link:horeca | B | B | NT | NT | B | GF | NT | GF | alle bewijzen sluiten (voltooibaar 6/6) |
| link:loonstrook | B | B | NT | GF | B | GF | NT | GF | sluit (6/6, 3/3, 4/4, 3/3) |
| link:loopbaan | B | B | B | B | B | B | NT | B | centraal al bewezen |
| link:vertegenwoordiging | B | B | NT | GF | B | GF | NT | GF | sluit (7/7, 3/3, 3/3, 3/3) |
| link:school | B | B | B | B | B | B | NT | B | centraal al bewezen |
| link:magnaat | B | NT | NT | GF | NT | GF | NT | GF | alle bewijzen sluiten (voltooibaar 6/6) |
| link:rtgone | B | B | NT | GF | B | GF | NT | GF | alle bewijzen sluiten (voltooibaar 7/7) |
| link:decisionroom | B | B | NT | GF | B | GF | NT | GF | sluit (6/6, 3/3, 4/4, 3/3) |
| link:projectroom | B | B | NT | GF | B | GF | NT | GF | sluit (6/6, 3/3, 4/4, 3/3) |
| link:partnernetwerk | B | B | NT | GF | B | GF | NT | GF | sluit (5/5, 3/3, 3/3, 3/3) |

Bij de verse voltooiproef staan de stappen in de volgorde voltooibaar,
persistent, herstelbaar, menselijk.

**De grootste open dimensie is bewezen bevoegdheid.** Bij 16 van de 17 apps staat
het bewijs bevoegd op NIET_GETEST; alleen Sitemaker is bewezen. BEVOEGD meet
breder dan IDOR: niet alleen of A de gegevens van B ziet (IDOR zegt hier 0
doorbraken), maar of elke ROL in de app precies mag wat zijn rol belooft:
- de manager tegenover het personeelslid;
- de eigenaar tegenover de bewerker;
- het kantoor tegenover de zaak;
- uitgelogd.

De reparatieronde van 19 oktober (par. 9) vond juist in die laag zes
fouten: Office-teamdrive, HACCP-grens, inkoop, gebouwpand/-plus,
werkruimtekoppeling en ledgerbevestiging. Dat is de reden waarom dimensie 4 en 8
van elk eindcontract eerst een BEVOEGD-ronde per app vragen.

Wat dit zegt:
- De voltooiproef is voor alle dertien scenario's die deze sessie bouwde lokaal
  gesloten. De centrale meetronde moet dat nog stempelen. Tot dan staat in
  APPWERKT "GEEN_FIXTURE", en dat is de stand die telt.
- Het bewijs **bevoegd** is voor 16 van de 17 apps NIET_GETEST. Alleen Sitemaker
  is bewezen.
- Het bewijs **menselijk** is alleen voor RT Mail, Loopbaan en School centraal
  bewezen.

Dat zijn de twee grootste gaten in bewezen betrouwbaarheid, en ze staan in elk
eindcontract (dimensie 8).

## 4. Dwarsthema's van de bijstelling

De eigenaar vroeg WorkOS uit te breiden met de thema's hieronder. Werk blijft
een PROJECTIE over bestaande domeinobjecten (ARBEID.md par. 2: "geen
`work_items`-tabel"). De toetsvraag uit ARBEID.md is "rekent dit, of bezit
dit?".

| Thema | Stand | Wat er staat (pad) | Eigenaar van het scherm | Kern van het gat | Uitgewerkt in |
|---|---|---|---|---|---|
| Capaciteitsplanning | half | kern/vrijheid/ (24 modules), kern/personeel.js, kern/agent.js rooster, payroll/inplanbaar.js, zeven losse planners (PLANNING.md par. 1) | Team Room (zaak.teamroom); Werk OS leest | geen gedeelde ATW-regelset buiten taxi; planners lezen verzuim niet; geen werkdruksignaal | werkos.md, horeca.md |
| Bedrijfsprocessen en werkstromen | half | bedrijf/regels.js + regelpoort.js, uitgave.js + tekengrens.js, indienst/uitdienst.js, kern/automatisering.js, kern/stuur/ | Werk OS | geen door de gebruiker bouwbare staatsmachine of tijdregels (OFFICE.md P12) | werkos.md |
| Kwaliteitscontrole | half | horeca HACCP (routes/supplier/horeca/haccp.js, haccp-lijsten.js), kern/checklijst.js, bedrijf/kennis.js, oplevering in Project Room | Horeca; Werk OS | geen generiek inspectie-, afwijkings- of CAPA-object buiten horeca | werkos.md, horeca.md |
| Contractverplichtingen | bestaat, los | bedrijf/contract.js + contractklok.js, bedrijf/service.js (SLA), kern/commercie/contract/verplichting.js | Werk OS (module Contracten), Onderneming (dagbeeld) | geen koppeling contract–project–persoon; leveranciersverplichtingen; één tekenweg (AFSPRAAK.md par. 4) | werkos.md, onderneming.md |
| Vestigingsbeheer | bestaat | kern/concern/ (stappen 0–10 groen, CONCERN.md par. 10) | Concern (werk.concern, via Onderneming) | geen operationeel vergelijkbeeld over vestigingen | onderneming.md, horeca.md |
| Inkoop | half | kern/groothandel.js, orderlaag.js, /api/supplier/inkoop/*, bedrijf/praktijk-leverancier.js | Horeca/Leverancier; Werk OS | inkooporders buiten de groothandel | horeca.md, werkos.md |
| Leveranciersprestaties | ontbreekt | bedrijf/uitval.js: "een leverancier bestaat hier niet" | (vraagt besluit) | er is geen leveranciersobject | werkos.md |
| Personeel | half | werving (kern/werk.js), payroll, vrijheid, concern/employment.js, Team Room | Team Room, Loonstrook, Loopbaan, Werk OS | de naad aanname → employment → contract → loon (ARBEID.md par. 3, besluit 6) | werkos.md, loonstrook.md |
| Begrotingen | half | projectbudget (bedrijf/project.js), onderneming/plan.js, simulatie.js, kas.js | Onderneming, Werk OS | geen jaarbegroting per organisatie of afdeling, geen kostenplaats | onderneming.md, werkos.md |
| Besluitvorming | bestaat, twee sporen | bedrijf/besluit.js (ondernemer), rtgone-bestuur.js (RTG intern) | Werk OS; Decision Room (intern) | geen besluitdossier (OFFICE.md P13); Decision Room staat los van bedrijf/besluit.js | decisionroom.md, werkos.md |
| Bedrijfscontinuïteit | half | kern/tenant/uitgang.js + herstelproef.js, bedrijf/uitval.js, gevolg.js | Werk OS | geen BCP of risicoregister voor de ondernemer; concern en payroll hebben geen uitgang | werkos.md |
| Audits | bestaat | bedrijf/gebeurtenis.js ("ene deur"), toen.js, kern/auditboek/, inzagelog | Werk OS | geen audittrailscherm voor de ondernemer; geen register van gebeurtenisnamen (OFFICE.md P9) | werkos.md |
| Domeinintelligentie (L4) | bestaat | kern/fiscaal/scenario.js (klasse `advies`, schrijft niets), onderneming/simulatie.js, bedrijf/gevolg.js (`nietGerekend`), kern/stuur/ | per app | scenario-engine zonder schermaanroeper; gevolgvoorspelling ontbreekt voor 93–96 van 176 paden | elke kaart, laag L4 |

## 5. Werkbehoeften buiten WorkOS, en wie ervan eigenaar is

Opdracht 3 van de aanscherping: werkbehoeften in ANDERE apps herkennen en per
behoefte bepalen of die een eigen eigenaar heeft of via een bestaande capability
geleverd kan worden. Dat voorkomt dubbele logica. WorkOS bouwt hier niets; WorkOS
**verwijst** of **projecteert**.

| Werkbehoefte (waar gezien) | Eigenaar of bestaande capability | Wat WorkOS doet | Toestemming |
|---|---|---|---|
| Rooster en diensten in horeca, festival, beveiliging, taxi, OV, school (zeven planners) | elk domein zijn planner; Vrijheid levert dekking, rust en verlof | Werk OS toont "mijn diensten" als projectie; Team Room blijft eigenaar | dienstverband (employment) |
| Werkbon en klus van een vakman (kern/vakwerk, routes/supplier/vakpro.js) | genre bouw/vakwerk in de leveranciersapp | als taak-verwijzing in Werk OS van de opdrachtgever-zaak | opdracht (offerte-akkoord) |
| Onderhoudsmelding van een bewoner (kern/woningonderhoud.js) | Wonen | geen; de keten loopt via de zaak (professionals-wonen.md, keten a) | lid per melding |
| Meldingen in een gebouw (kern/gebouw.js, gebouwpand.js) | genre kantoorgebouw | als ticket-verwijzing in Werk OS van de beheerder | zaak |
| Concierge-onderdeel voor een partner (bureau-cases, CON-02) | Concierge (Privékantoor) | Partner Network telt het; geen eigen opslag | case-deelnemer |
| Werkorders en aannemer-SLA van een gemeente (kern/stadsweefsel/) | Stadsweefsel | niets; dit is de overheidskant | — |
| Opdracht aan een leverancier (bedrijf/praktijk-leverancier.js) | Werk OS (zelf) | blijft eigenaar | via link |
| Facturen, betalingen, kas (Geld) | Geld / kern/pay, facturatie | Onderneming en Werk OS tonen alleen gevolgen (projectie) | zaak |
| Documenten en dossiers bij werk | Office/RTDocs (docs.office), Bestanden (kluis) | Werk OS bewaart rtg://-verwijzingen (herkomst.js) | rechten van het document |
| Mail als bron van werk | RT Mail | Werk OS postbrug en RTG One project/van-mail | dezelfde persoon, twee sleutels |
| Toestemming en uitvoering van een handeling | stuurlaag (kern/stuur/) | elke WorkOS-handeling met gevolg gaat via voorstel en bevestiging | de vrager; de AI kan niet meer |
| Verbouwing (voorbeeld van de eigenaar) | Wonen (woningdossier), genre bouw (uitvoering), Project Room (samenwerking), Geld (financiële gevolgen), RTDocs (documenten), stuurlaag (toestemming en uitvoering) | Project Room is de samenwerkingsruimte en bezit geen gegevens van de anderen | per stuk, door het lid |

Twijfel over het eigenaarschap staat bij de eigenaar onder par. 6.

## 6. Vraagt besluit (familiebreed)

De vragen per app staan in de app-kaarten. Hier staan de vragen die meer dan
één app raken. De aanbeveling staat steeds vooraan.

1. **Waar woont "werk" voor de ondernemer, naast RTG-intern?**
   Decision Room en Project Room zijn nu RTG-intern (officeAuth, rtgone-*).
   Werk OS heeft voor ondernemers een eigen besluit- en projectspoor
   (bedrijf/besluit.js, bedrijf/project.js).
   - (A, aanbevolen) Decision Room en Project Room worden ook het SCHERM op
     bedrijf/besluit.js en bedrijf/project.js, met dezelfde schermcomponenten
     en de werkruimtecode als scope. Er komt geen tweede motor; de eigenaar
     van de gegevens blijft Werk OS. Kosten: middel.
   - (B) Beide blijven intern; Werk OS bouwt zijn eigen besluit- en
     projectschermen verder uit. Kosten: middel, en er blijven twee
     schermfamilies voor hetzelfde werk.
   - (C) Samenvoegen in één app. Kosten: groot; raakt SCHERMEIGENAAR en de
     consolidatie.
2. **Leveranciersobject.** Inkoop en leveranciersprestaties hebben geen
   leverancier om aan te hangen (bedrijf/uitval.js zegt het zelf).
   - (A, aanbevolen) Een leverancier is een **relatie** in de bestaande
     relaties of crediteuren van Onderneming (kern/onderneming/crediteuren.js);
     de prestatiemeting is een projectie over opdrachten, leveringen en
     klachten. Kosten: middel.
   - (B) Een eigen leveranciersobject in Werk OS. Kosten: middel; risico op
     een tweede relatiebestand.
   - (C) Niet doen vóór V1.
3. **Welke werkrelatie is de waarheid in de schermen?** De eigenaar koos
   employment (ARBEID.md par. 7a). De naad aanname → employment → contract →
   loon staat nog open.
   - (A, aanbevolen) Werk (os:werk), Loonstrook en Werk OS lezen alle drie
     employment. staffId en werkruimtelid worden ernaar herleid; ze worden
     niet vervangen. Kosten: middel.
   - (B) Laten zoals het is. Kosten: geen, maar elke kaart blijft drie
     bronnen tonen.
4. **SCHERMEIGENAAR voor os:werk.** Er is geen entry.
   - (A, aanbevolen) De entry `werk.kiezer` toevoegen, met rol router en
     eigenaar app-main-25.js. Kosten: klein.
   - (B) Laten zoals het is.
5. **Browser: intern web of het echte web?** Het SCHERMEIGENAAR-doel zegt "naar
   het web surfen"; de code opent alleen het interne .rtg-web.
   - (A, aanbevolen) Het doel bijstellen naar het interne web van leden en
     zaken. Een open web is een eigenaarsbesluit met security-gevolgen (DLP,
     CSP). Kosten: klein.
   - (B) Een open web bouwen. Kosten: groot.

## 7. Toetsbaar eindcontract Beyond Premium (familiesjabloon)

Elke app-kaart vult deze acht dimensies concreet in. Het contract VERVANGT NOOIT
de acht bewijzen van APPWERKT: bereikbaar, bedienbaar, menselijk, voltooibaar,
waarheidsgetrouw, persistent, bevoegd en herstelbaar. Het komt erbovenop.

| Dimensie | Familie-eis | Toets |
|---|---|---|
| 1. Breedte | elke functie in "aanbevolen nu" heeft een scherm en een route; geen route zonder scherm | scripts/schermen.js; de schermroutes van de app |
| 2. Professionele diepte | elke wettelijke termijn of norm uit c. die de app raakt, staat als regel met bron in de code en heeft een toets die op de grens zakt | `node --test` per regel (bijv. ATW-rust, bewaarklasse, betaaltermijn) |
| 3. Levenscyclus | elk object in de app doorloopt aanmaken, wijzigen, delen, archiveren en herstellen, of zegt per stap waarom niet | voltooiproef: de bewijzen voltooibaar en herstelbaar |
| 4. Samenwerking en rollen | elke rol uit d. heeft een toets voor toegang en weigering; een andere zaak, een ander lid of uitgelogd geeft 404/403/401 | BEVOEGD en IDOR (nu NT voor 16 van 17 apps: dit is het eerste werk) |
| 5. Domeinintelligentie | elke voorspelling draagt een klasse of bewijsgraad en een lijst `onbekend`; niets voert door zonder menselijke bevestiging | test op zekerheid/klasse; kern/stuur/ |
| 6. Los functioneren | met de andere apps uit lukt de kerntaak, en het scherm zegt wat niet kan | een proef met de koppelingen uit (mijn-isolatie.html als patroon) |
| 7. RTG-ketens | elke keten uit d. (L6) loopt van begin tot eind via een verwijzing of projectie, met storingen, en zonder gegevens over te nemen | een ketenproef naar het model van scripts/ritproef.js, opgenomen in scripts/ondernemerbewijs.js |
| 8. Bewezen betrouwbaarheid | alle acht bewijzen van APPWERKT staan centraal op BEWEZEN | APPWERKT.json |

## 8. Twee uitkomsten per app

Dit volgt uit de aanvulling van de eigenaar. Elke app-kaart sluit af met twee
uitkomsten:
- **(A)** wat binnen de huidige architectuur en scope gebouwd kan worden;
- **(B)** het domeinmaximum, ook buiten de scope.

Uitkomst B beschrijft hele professionele processen en geen losse schermen. Een
greep daaruit:
- inkoop tot betaling en een kwaliteitsmanagementsysteem (werkos.md);
- van idee tot groep, inclusief een tweede vestiging (onderneming.md);
- een horecazaak van vergunning tot jaarafsluiting (horeca.md);
- het werkgeverschap van aanname tot uitdiensttreding (loonstrook.md, loopbaan.md);
- een schooljaar met formatief evalueren (school.md).

De processen van de beroepen rond wonen staan in professionals-wonen.md:
- woningverkoop;
- verhuurcyclus;
- bouwproject;
- VvE-jaar.

B is richting en geen toezegging. Wat B buiten de scope vraagt, staat in de
kaart als besluit.

## 9. Bevindingen in de code (19 oktober 2026)

De schrijvers lazen de code voor deze kaart en noteerden wat er mis lijkt. Een
bevinding is pas een fout als ze in een toets of proef zakt. Elke regel noemt
waar je haar terugvindt. Dertien zijn daarna gerepareerd; de rest staat nog
open.

**Gerepareerd** (19 oktober 2026, op verzoek van de integrator). Elke
reparatie is minimaal, met eerst een falende toets, in een eigen commit op
appwerkt/workos:

| Kaart | Wat er mis was | Commit | Toets |
|---|---|---|---|
| onderneming | een vreemde werkruimte koppelen en haar contracten lezen | d9fd905 (vóór de kaarten) | test/onderneming-contracten.test.js |
| office | teamdocument hard gewist door elk personeelslid; bewaartermijn en spoor genegeerd | 697f1b5 | test/office-weg.test.js |
| loopbaan | ledger knipte oude regels weg; bevestigen onbeperkt | 73ae8c6 | test/carriereledger-appendonly.test.js |
| loonstrook | oud-medewerker verloor zijn stroken (bewaarplicht 7 jaar) | 1575572 | test/loonstrook-oudmedewerker.test.js |
| horeca | allergenen afgekapt op 12 (EU: 14) | cc7510f | test/menukaart-allergenen.test.js |
| horeca | HACCP-grens door elke medewerker, zonder historie | 4002318 | test/haccp-grens.test.js |
| horeca | inkoop bestellen/annuleren zonder manager | 605ab79 | test/inkoop-manager.test.js |
| professionals-wonen | gebouwpand/-plus zonder cap-check | d3d5ce8 | test/gebouw-cap.test.js |
| professionals-wonen | vakwerk ontbrak in VAK_GENRES (403) | 4a914ea | test/vakwerk-genre.test.js |
| vertegenwoordiging | /handel zei "Uitgevoerd" zonder uitvoering | 54a828f | test/handelenspoor.test.js (toets 4) |
| school | dubbele tik telde twee leerjaren | dc14a03 | test/onderwijs-jaarover.test.js |
| magnaat | virtueel budget groeide onder de 18 | 9f2a7ab | test/magnaatwereld.test.js (toets 4) |
| projectroom | opgeleverd project viel terug; besluit gold niet meer | 1fc43c1 | test/rtgone.test.js (toets 8) |

**Nog open (gelezen, niet beproefd)**, per kaart. Bij de kaarten hierboven is het gerepareerde deel verdwenen; wat overblijft staat hier:

| Kaart | Bevinding (pad) |
|---|---|
| rtmail | `kern/rtmail-schrijf.js` `verstuur` heeft geen herhaalsleutel; een herhaling na een verbroken antwoord meldt een fout terwijl het bericht verstuurd is. `rtmail-bewaar.js` `zetTermijn` staat op een zakelijk postvak 0 dagen toe |
| browser | `routes/webbrowser.js`: een sollicitatie via een site wordt een gewone klus (`addTicket`) en valt buiten de leidingsplek. `webmaker-blader.js` `gids` sorteert op bezoeken, wat neerkomt op een populariteitsranglijst |
| sitemaker | `kern/webdomein-html.js`: galerijbeelden krijgen `alt=""` en `lang="nl"` staat vast; risico voor WCAG 2.1 AA (EAA) |
| werkos | `bedrijf/project.js`: een mijlpaal kan nooit op `gehaald` komen. `werk.html` r. 133 heeft een statisch "Human Enterprise"-paneel, en "Start veilige simulatie" start niets. `contract.js` rekent euro→cent anders dan `kern/geld/eenheid.js` |
| werk | `app-main-25.js`: de lege-staattekst raadt een PIN-koppeling aan die `eenaccount/koppelen.js` weigert. `eenaccount.js` `slice(-10)` haalt bij een elfde rol stil de oudste weg |
| onderneming | `onderneming/beeld.js` telt vestigingen uit Mall-plekken en entiteiten als het aantal ondernemingen, niet uit Concern; zo ontstaat "groep" zonder tweede rechtspersoon. `belasting.js` heeft een eigen `zeker: true` in plaats van de klassen |
| horeca | `kern/agent.js` `roosterVoorstel` plant 7 dagen vooruit zonder rusttoets (ATW) en zonder de publicatietermijn van 3 weken (cao Horeca) |
| loonstrook | een strook (`kern/payroll/motor.js`) draagt het minimumloon en de vakantiegeldopbouw niet (art. 7:626 BW); payroll en HACCP staan niet in `bewaarbeleid.js` |
| vertegenwoordiging | `vertegenwoordiging.html` belooft "Voorstellen doet u" maar roept `/voorstel`, `/handel` en `/voogd/*` niet aan; het jeugdbestuur heeft geen scherm |
| magnaat | MAGNAATLAB.md en MAGNAATLAB.json noemen verschillende dekkingscijfers |
| rtgone | `rtgone.js` `overdrachtMaak` zoekt op een deel van de naam ("Jan" vindt ook "Janneke") en verplaatst het eigendom niet. De audit wordt afgekapt op 500, terwijl het scherm "onveranderlijk" belooft |
| decisionroom | "terug" sluit het besluit zonder herindienroute, waardoor het gekoppelde project blijft hangen. Een voorwaarde bij akkoord wordt opgeslagen maar nergens bewaakt |
| projectroom | het scherm belooft "op volgorde van afhankelijkheid", maar een taak heeft geen afhankelijkheidsveld |
| partnernetwerk | `kern/partnernetwerk.js` bepaalt "vandaag" in UTC. Het SCHERMEIGENAAR-doel wijkt af van de code |

## 11. Te controleren

Een regel die alleen uit een zoeksamenvatting komt, is geen feit. Hij draagt in
elke kaart het label **te controleren** tot een mens de primaire bron heeft
nagelezen: de wettekst, de officiële pagina of de cao-tekst. Een regel van die
soort wordt nooit als code afgedwongen.

| Regel | Waar hij vandaan kwam | Wat ermee gebeurd is |
|---|---|---|
| Verbod op contante betalingen vanaf € 3.000 (sinds 1-1-2026) | een zoeksamenvatting van een Belastingdienst-pagina | Op verzoek van de integrator uit de kaarten van Decision Room, Onderneming, Magnaat en Horeca gehaald. Hij was nergens in code afgedwongen; `grep` op server/, public/apps en scripts/ vond niets. Hij komt pas terug na nalezing van de primaire bron. |
| Eerstejaarsevaluatie Poortwachter (week 46–52) | bronnen spreken elkaar tegen | geldt in loonstrook.md en werkos.md als signaal, niet als harde datum |
| Grenzen van de jaarrekeningklassen (€ 50 of € 51 mln) | KvK-pagina's spreken elkaar tegen | onderneming.md: klasse `uitlegbaar` |
| Loontransparantie (EU 2023/970), invoering NL | wetsvoorstel, nog geen recht | overal "voorbereiden, geen recht" |
| ISO 9001:2026, clausulenummers | revisie 16-9-2026; nummers niet geverifieerd | werkos.md noemt de nummers van de versie 2015 |
| Herroepingsknop webwinkel (19-6 of 25-6-2026) | ACM en KvK noemen verschillende data | sitemaker.md |
| Toeslagen in de cao Horeca | niet teruggevonden | horeca.md |
| Alle marktprijzen in b. | zoeksamenvattingen, geen pagina zelf geopend | "(via zoektool, live te controleren)" |

## 10. Wat deze kaart niet doet

- Hij bouwt niets.
- Hij voegt geen regels toe aan registers en zet niets in NORM.json.
- De gemeten JSON-bestanden zijn gelezen en niet gecommit.
- Hij geeft geen juridisch oordeel. De wetsverwijzingen zijn oriëntatie met
  bron, live te controleren.
- Hij ontwerpt geen nieuw domein. Wat niet past, staat onder "Vraagt besluit".
