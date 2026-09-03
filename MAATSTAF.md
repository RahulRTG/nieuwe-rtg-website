# MAATSTAF — de doctrine "na Big Tech", gehouden tegen het huis

MAATSTAF voegt geen tweede leer aan RTG toe. Het projecteert uitspraken over
uitkomstgestuurde software op bestaande huisbesluiten en maakt zichtbaar wat
reeds staat, wat één stap vraagt, welk besluit een voorstel uitsluit en welk
bewijs nog ontbreekt.

Geen schaal in dit document heeft zelfstandig gezag. Geen graad vervangt READY.
Geen platformterm overschrijft een wereldgrens. Aanwezigheid van code geldt niet
automatisch als bewijs van werking.

**Waar dit uit komt.** Op 3 september 2026 lag er een doctrine van negenentwintig
paragrafen: RTG niet als de nieuwe Big Tech maar als de maatstaf erna, een
*Verified Outcome Platform* waarin een mens een bedoeling uitspreekt en het
platform de volledige, veilige en aantoonbare uitkomst regelt over alle partijen
heen. Zeven beloften in een rij: één bedoeling, één voorstel, één bevestiging,
één uitvoering, één tijdlijn, één resultaat, één herstelpad.

Die doctrine is tegen de code gehouden voordat er iets van is overgenomen. De
uitkomst was sterker dan "geniaal": het huis bleek in staat een overtuigende
doctrine tegen te spreken waar die niet past. Het merendeel beschrijft een
machine die al bestaat, een klein deel botst met besluiten die hier al genomen
zijn, en een handvol punten is echt nieuw. Dit document legt dat vast in de
vorm die ECONOMIE.md en DEVELOPERCLOUD.md ook hebben: per uitspraak of hij
**staat**, **een stap weg** is, **een besluit vraagt**, **jaren weg** is, of
**geprojecteerd** wordt — dat laatste betekent dat de bedoeling overeind blijft
maar de vorm uit de doctrine wordt vervangen door een vorm die het huis al heeft.

Drie woorden lopen door het hele document en zijn met opzet niet hetzelfde:
**aanwezig** (de code bestaat), **afgedwongen** (een toets zakt als hij wordt
overtreden) en **bewezen** (de werking is gemeten, met datum). Een mechanisme
dat aanwezig is en nergens wordt afgedwongen, is een belofte in tekst (LAT-regel
6). Een mechanisme dat wordt afgedwongen maar op lege invoer draait, is een poort
die alles doorlaat. De bewijspoort van par. 6 is daar het scherpste voorbeeld
van.

---

## 1. De uitspraken, geteld

De doctrine is uiteengelegd in toetsbare uitspraken. Per uitspraak staat de
**huisgrond** (welk document of besluit erover gaat), het **mechanisme** (welke
code het draagt), de **afdwinging** (welke toets zakt) en het **bewijs** (welke
meting er ligt, of het woord *geen*). "Tweederde" uit de eerste lezing was een
indruk zonder noemer; dit is de noemer. `test/doodspoor.test.js` toets 15 telt
de tabel na en zakt zodra de telregel eronder niet meer klopt.

| # | Uitspraak | Huisgrond | Mechanisme | Afdwinging | Bewijs | Uitkomst |
|---|---|---|---|---|---|---|
| U1 | De gebruiker spreekt een bedoeling uit; het systeem vindt de paden die zij raakt | EXECUTIE.md blok 0 | `kern/stuur/resolver.js` | `npm run resolverbereik` zakt onder 100% dekking | 1232 proeven, dekking 100% | **staat** |
| U2 | Eén begrijpelijk voorstel: stappen gewogen, bezwaren benoemd, bevestigingen vooraf geteld | EXECUTIE.md blok 3 | `kern/stuur/plan.js` | vier toetsen (voert niets uit, bezit niets, live autoriteit, verboden stap laat alles zakken) | toetsen | **staat** |
| U3 | Frictie volgt het risico: lezen direct, klein met ongedaan, voorstel met bevestiging, plechtig door een mens | GRAMMATICA.md, EXECUTIE.md (`lezen`/`klein`/`voorstel`) | `kern/stuur/beleid.js`, gewichten `licht`…`plechtig` | `test/stuur-niveaus.test.js` | oude lijst letterlijk overgeschreven | **staat** |
| U4 | Risicoklassen R0–R5 als eigen schaal | EXECUTIE.md: vijf gezagsschalen, consolidatie vóór features | `scripts/gezag.js` ziet een zesde niet | `test/gezagsnoemer.test.js` | 18 evident, 3 besloten, 0 open | **geprojecteerd** |
| U5 | Gecoördineerde uitvoering met voorcontrole en nacontrole, waarbij een controle die niet kon draaien niet geslaagd is | EXECUTIE.md | `kern/command/transactie-poorten.js` | toetsen | toetsen | **staat** |
| U6 | Eén tijdlijn: elk gevolg weet waardoor het ontstond | OS.md (eventenvelop) | `kern/envelop.js`: id, tijd, versie, kanaal, actor, correlatie, oorzaak, classificatie | toetsen op de envelop | keten loopt door | **staat** |
| U7 | Een claim zonder bewijs telt niet; de route kiest op bewijskwaliteit (proof-aware routing) — het mechanisme | FABRIC.md, PROOF.md | bewijspoort in `kern/stuur/beleid.js` laat een geschorste capability uit de paden vallen | toets op de poort | mechanisme aanwezig | **staat** |
| U8 | …en dat bewijs is sterk genoeg om routes werkelijk verschillend te laten handelen | PROOF.md par. 0: bewijs mag alleen groeien | `scripts/vertrouwen.js`, `BEWIJSSCHULD.json` met sluitweg per route | normtanden `bewijsCellenBewezen`, `bewijsAchterstand` | <!--getal:vertrouwen.bewezen-->0<!--/getal--> bewezen, <!--getal:vertrouwen.routes-->4180<!--/getal--> verzwakt | **jaren weg** |
| U9 | Elke hoofdactie is omkeerbaar of compenseerbaar, en die twee worden nooit samengeteld | EXECUTIE.md blok 5 | `scripts/herstelproef.js`, `scripts/lib/herstelwereld.js`; voor horeca `kern/horeca/correctie.js` (compensatie met een bevroren bedrag) | proef zakt op een verdict zonder grond; `test/horeca-correctie.test.js` | 13 exact, 30 compensatie, 1 geen-herstel, 46 vragen een wereld | **staat** |
| U10 | Vraag een gegeven maar één keer, en hergebruik alleen met doel, toestemming, bron en actualiteit | LEVEN.md par. 2, LINK.md par. 3, `kern/consent-register.js` | één bron (`db.data.zorgProfielen`), projectie erop: `zorgMee` eist een zaak + reden en stempelt de kopie, `zorgActueel` laat de bron winnen | `scripts/afleidbaar.js`; `scripts/doorwerking.js` telt naamloze lezers en ongestempelde kopieën | DOORWERKING.json: 12 lezers naar een derde, **0 naamloos, 0 bevroren** (was 14 en 12) — voor het zorgprofiel; andere gegevens ongemeten | **staat** |
| U11 | Eén werkelijkheid, meerdere perspectieven: consument, zaak, keuken, koerier, support en finance kijken naar hetzelfde object | HORECA.md: de rekening is één waarheid over alle kanalen | per domein; `kern/mobiliteit/appbrug.js` brengt de app-rit naar het dispatchbord | `test/appbrug.test.js`, ritproef schakel 1 | horeca gemeten; mobiliteit: de brug staat, de 34 lezers van `rides` zijn nog niet omgezet (par. 7.5) | **stap weg** |
| U12 | Geen enkele actie eindigt in een dood spoor: elke handeling heeft een ontvanger, of een verklaring | par. 3 hieronder | `scripts/doodspoor.js`, `DOODSPOOR.json` | `npm run doodspoor:controle` zakt op een verlopen verklaring; de regel zelf is nog geen poort | <!--getal:doodspoor.bronroutes-->282<!--/getal--> bronroutes, <!--getal:doodspoor.open-->85<!--/getal--> open na de triage (was 163) | **stap weg** |
| U13 | De interface toont de taak, niet de organisatie | TIKKEN.md, `shared/sprong.js` | resolver + sprong (handelingen uit de schermen zelf) | `scripts/vindbaar.js` | VINDBAAR.json | **staat** |
| U14 | Elke weigering, prijs of beperking is verklaarbaar in gewone taal, met de weg eromheen | ECONOMIE.md (firewall zegt hoe het wél kan), GRAMMATICA.md (een verhindering draagt een reden) | `kern/economie/firewall.js`, verhinderingen | toetsen per weigering | toetsen | **staat** |
| U15 | Elke niet-terminale toestand heeft een eigenaar, een volgende stap, een termijn en een verval | par. 4 hieronder | lokaal: `kern/commerce/retour.js` (vijf standen die zeggen welke partij ze zet), `kern/mobiliteit/keten.js` (tien standen met VOLGENDE per stand) | ritproef storing 2 en 3 | twee domeinen met een echte statusmachine; huisbreed geen regel | **stap weg** |
| U16 | Falen is een normale producttoestand: leeg, laden, traag, gedeeltelijk, offline, conflict, fout, herstel, geannuleerd, betwist | ADAPTIEF.md (verbergen bestaat niet), `scripts/chaos.js` | achterkant: chaos en aanvalsbatterij; voorkant: per scherm en ongemeten | vijf storingen in `scripts/tafelproef.js`, alleen voor de tafelketen | geen, over 258 schermen | **jaren weg** |
| U17 | AI handelt binnen een mandaat met doel, objecten, acties, bedrag, duur, verval en stopvoorwaarden | CONTROLPLANE.md (vier dimensies), EXECUTIE.md blok 6 | `kern/stuur/mandaat.js`: versmalt alleen, leeg is dicht, hoogt geen niveau op | toetsen | toetsen | **staat** |
| U18 | Autonomieniveaus A0–A4 als eigen schaal | EXECUTIE.md: de noemer geen / tonen / klaarzetten / uitvoeren | `scripts/gezagsnoemer.js` | `test/gezagsnoemer.test.js` | noemer op 18 evident | **geprojecteerd** |
| U19 | A2 "veilige, omkeerbare acties zelfstandig uitvoeren" als platformwaarheid | FOUNDATION.md par. 2: geen `EXECUTE_LOW_RISK`, wie bouwt weet niet in wiens leven hij staat | `klein` bestaat in LivingOS en WorkOS; niet in FoundationOS | toetsen op de wereldgrens | per wereld anders | **geprojecteerd** |
| U20 | De gebruiker ziet vooraf wat er gaat gebeuren en achteraf wat er gebeurde, als verschil | EXECUTIE.md blok 4 | `kern/stuur/gevolg.js` projecteert een eerdere meting; geen droogloop in de zandbak | toets: `onbekend` en `geen-effect` lopen nooit door elkaar | 36 gemeten, 44 geen effect, 96 onbekend van 176 | **stap weg** |
| U21 | Eén canoniek objectmodel voor de volledige economie (Person … Asset … Vehicle … Room) | DEVELOPERCLOUD.md par. 2, OBJECTMODEL.json, COMMERCE.json | `scripts/objectmodel.js`, `scripts/ketenvorm.js` | `test/objectmodel*.test.js`, `test/ritproef.test.js` toets 8 | `Asset` bestaat niet; 0 domeinen met alle acht werkwoorden; en over drie ketens <!--getal:ketenvorm.actorenGedeeld-->0<!--/getal--> van <!--getal:ketenvorm.actorenTotaal-->13<!--/getal--> gedeelde actoren (par. 7.6) | **geprojecteerd** |
| U22 | Elke overgang van een object is een benoemd commando met actor, voorwaarde, gegevens, beleid, bewijs en gevolg | MUTATIECONTRACT.md (semantiek per route) | `kern/mutatie.js`; geen statusmachine | `test/mutatiecontract*.test.js` op de classificatie | 1573 beproefd, 3156 ongemeten | **stap weg** |
| U23 | Negen perspectieven per productfamilie, beoordeeld en verklaard | par. 5 hieronder | `kern/platformregister/` kent functie, route, bewijs, scherm; geen actor | geen | geen | **stap weg** |
| U24 | De handoff-matrix tussen actoren wordt gemeten | par. 3 hieronder | `DOODSPOOR.json` veld `matrix` | toets 1 en 2 in `test/doodspoor.test.js` | gemeten, smalle lens | **staat** |
| U25 | Eén vaste mentale structuur: vind, kies, bevestig, volg, los op | GRAMMATICA.md: zeven zinnen, vijf gebaren met elk één betekenis | schilbalk, orb, gewichten | `test/ontwerp.test.js`, grammatica-toetsen | toetsen | **staat** |
| U26 | Eén shell met vijf vaste gebieden: Vandaag, Doen, Inbox, Ruimtes, Jij | WERELD.md: één beginscherm, de lege werktafel, geen voorgekookt werkblad | `vandaag.html`, Rahul in de schilbalk, werelden in de bank, bedieningspaneel in de voet | `test/wereldregister.test.js` | vier van de vijf bestaan als projectie | **geprojecteerd** |
| U27 | Een inbox: alles waarvoor deze actor nu ontvanger, eigenaar of beslisser is | par. 3 en 4: hangt aan het ontvangercontract en het statuscontract | niet gebouwd | geen | geen | **stap weg** |
| U28 | Elke objectpagina draagt dezelfde structuur: samenvatting, status, volgende actie, tijdlijn, betrokkenen, geld, documenten, bewijs, rechten, probleem oplossen | ONTWERP.md (Context Pane, Reference, Action Line); `kern/objectlaag/` | `kern/objectlaag/pagina.js` stelt de tien secties SAMEN uit aangemelde bijdragers; een sectie zonder bijdrager komt terug als `nietGevraagd` | `test/objectpagina.test.js`: elf secties knallen, een verzonnen sectie knalt, `leeg` ≠ `nietGevraagd` | route `POST /api/sociaal/object/pagina` | **staat** |
| U29 | Interactiesnelheid is een releasebudget (50 ms reactie, 400 ms warme weergave, 300 ms opdracht ontvangen) | KEURING.md; `scripts/tikken.js` draait al een echte browser | `scripts/prestaties.js` meet de motor, niet de interface | geen | geen | **stap weg** |
| U30 | Uitkomstsnelheid wordt gemeten: van bedoeling tot boeking, van klacht tot besluit, van verkoop tot afwikkeling | nergens | niets meet een doorlooptijd over actoren heen | geen | geen | **jaren weg** |
| U31 | Dezelfde opdracht twee keer versturen veroorzaakt niet twee bestellingen | MUTATIECONTRACT.md: 100% geclassificeerd, niet 100% idempotent | `IDEMPROEF.json`, `lib/idemsleutels.js` | toetsen op de classificatie | <!--getal:idem.beoordeeld-->1573<!--/getal--> beoordeeld | **staat** |
| U32 | Optimistische interface waar veilig, nooit bij geld: opdracht ontvangen → wordt bevestigd → voltooid | GELD.md: geld verlaat het huis nooit vanzelf; bewijsbord met drie standen en geen groen | `kern/pay/bewijs.js` | toetsen | toetsen | **staat** |
| U33 | Een organisatie start bijna zonder configuratie: per branche een veilige standaard, en de klant past alleen afwijkingen aan | PLATFORM.md par. 5: veertig sectormotoren is jaren werk; TENANT.md levenscyclus | 73 genres met werkvormen; geen branchestandaard als voorstel | geen | geen | **jaren weg** |
| U34 | De organisatie is een digitale tweeling die voorspelt ("71% kan automatisch worden verplaatst") | BESTUUR.md: nooit een getal waar geen meting is; KOSTEN.md: bandbreedte pas na drie gemeten maanden | `kern/kosten/vooruitblik.js` (trefzekerheid meet zichzelf), gevolgsimulatie in TENANT met `nietGerekend` | toetsen | per voorspelling een graad | **geprojecteerd** |
| U35 | Eén identiteit, meerdere contexten; rechten zijn relationeel, tijdelijk, bedrag- en objectgebonden | CONTROLPLANE.md (wat, waar, hoeveel, wanneer; delegatie versmalt), BESTUUR.md (toegang is een uitnodiging) | `kern/bevoegdheid/`, `kern/stuur/mandaat.js`, `sociaal/pin-deur.js` | `scripts/capabilityroepers.js` | CAPABILITEIT.json | **staat** |
| U36 | De audit is cryptografisch tegen stille wijziging beschermd | OS.md: de envelop; PROOF.md | `lib/keten.js` (hashketen per journaal), `lib/keten-anker.js` (kopafknipping), `lib/ankerdienst.js` (één blok over vier journalen), `lib/ankerpost.js` (bestemming: tweede machine) | aangesloten in `server.js` en `routes/office/toegang.js`; `stand()` meldt `inBedrijf: false` zolang er geen blok buiten staat | `test/keten.test.js`, `test/ankerdienst*.test.js`, `test/ankerpost.test.js` | **staat** |
| U37 | Alle geld gaat door één ledger, dubbel geboekt; een correctie is een nieuwe boeking en nooit geschiedenis herschrijven | WAARDE.md, GELD.md: geen tweede boekhouding | `kern/pay/poort.js`, `kern/waarde/` | check.js regel 62 en 63 (een domein raakt opslag alleen door zijn eigen deur) | toetsen | **staat** |
| U38 | RTG Grade 0–5 als productscore | LAT-regel 11, `scripts/check.js` regel 48: bewijsgroen is geen go-live-groen; BEWIJSMACHINE.md | `scripts/zekerheid.js` | regel 48 zakt zodra de go-live-keuring een bewijsregister leest | — | **geprojecteerd** |
| U39 | Harde poorten die nooit compenseerbaar zijn: ledger, audit, herstel, toegankelijkheid, prestatie, actor-compleetheid, dood spoor, uitstap | KEURING.md, TOEGANKELIJK.md, TENANT.md (uitgang) | `scripts/check.js` (64 regels), a11y-poorten, `kern/tenant/uitgang.js` | bestaand: ja; dood spoor en actor: nog niet | per poort | **stap weg** |
| U40 | Elk product draagt een machineleesbaar contract (PRODUCT-360) dat in de toetsing meeloopt | PLATFORM.md par. 0; EXECUTION_MAP.json is een projectie per route | per route: ja; per product: de eenheid "product" is niet vastgesteld | `npm run executionmap` zakt op handwerk; `npm run ketenvorm` over drie ketens | KETENVORM.json: 0 van 13 actoren gedeeld — een contract over domeinen heen is niet gerechtvaardigd (par. 7e) | **besluit** |
| U41 | Elke capability draagt een contract: objecten, commando's, events, rechten, fouten, herstel, SLO, gebruikers, toetsen | OS.md par. 4; `kern/appstore/machtigingen.js` is het enige bestand met doel én grens | 21 capability-lijsten met 250 leden | `scripts/capabilityroepers.js`, `scripts/ketenvorm.js` | CAPABILITEIT.json; KETENVORM.json: wat drie ketens delen gaat over de machine, niet over het domein (par. 7e) | **besluit** |
| U42 | Een journey wordt als volledig verhaal over actoren heen getest, inclusief verstoring, herhaling en herstel | par. 7 hieronder | `scripts/tafelproef.js`, `scripts/ritproef.js` en `scripts/toelatingsproef.js`, los geschreven; `scripts/ketenvorm.js` telt wat ze delen | alle drie geven foutcode 1 op een open schakel; `test/tafelproef.test.js` en `test/ritproef.test.js` bewaken de proeven | tafel <!--getal:tafel.schakels-->11<!--/getal--> schakels en <!--getal:tafel.storingen-->8<!--/getal--> storingen; rit <!--getal:rit.schakels-->8<!--/getal--> gesloten + <!--getal:rit.bevindingen-->0<!--/getal--> bevinding, <!--getal:rit.storingen-->11<!--/getal--> storingen | **staat** |
| U43 | Het register koppelt product, actor, bedoeling, journey, capability, object, route, event, beleid, bewijs, scherm, toets, prestatie en herstelpad | `kern/platformregister/` | functie ↔ routes ↔ bewijs ↔ scherm | check.js regel 64 | — | **stap weg** |
| U44 | Volgorde: eerst de gedeelde grond, dan drie gouden ketens (mobiliteit, horeca, werk), dan de families | EXECUTIE.md par. 7: één bewezen keten vóór honderd functies | besloten 3 september 2026: horeca eerst (par. 7) | — | — | **staat** |
| U45 | De repo verhuist naar /products, /domains, /capabilities, /trust | 415 kerndomeinen in `server/kern`; EXECUTION_MAP is een projectie | een gegenereerde leesweergave kan; een fysieke verhuizing niet | — | — | **geprojecteerd** |
| U46 | De doctrine komt letterlijk in PLATFORM.md | dit document | MAATSTAF projecteert; PLATFORM.md houdt de vier-productregel | — | — | **geprojecteerd** |

Geteld uit de tabel: 46 uitspraken -- staat 21, stap weg 10, besluit 2, jaren weg 4, geprojecteerd 9.

Wat die telling níét zegt: dat RTG voor 18/46 klaar is. De rijen wegen niet
gelijk. U8 alleen (bewijs dat routes verschillend laat handelen) is meer werk
dan de achttien die staan bij elkaar, en zonder U8 houdt U7 niets tegen. Het
precieze stadium is dus: **kern gebouwd, huis coherent, ketenbewijs begonnen.**

---

## 2. De botsingen, en wat ervoor in de plaats komt

Negen uitspraken zijn geprojecteerd. Geen ervan is een tegenvaller: een
onvolwassen project had ze alle negen naast de bestaande lagen gezet, en na een
jaar wist niemand meer welke schaal gezag heeft. Per botsing staat hier de vorm
die overeind blijft.

### 2.1 Risico en autonomie zijn projecties op de noemer (U4, U18, U19)

De doctrine brengt twee ladders mee: R0–R5 (risico van de handeling) en A0–A4
(autonomie van de AI). `scripts/gezag.js` registreert al vijf gezagsschalen en
zegt letterlijk dat een zesde voor de meter onzichtbaar is. Sinds 31 augustus
2026 is er een noemer met vier treden: **geen / tonen / klaarzetten /
uitvoeren**, en daaroverheen bestaan de wereld, het mandaat en het gewicht van
de handeling. Beide ladders worden daarop geprojecteerd en niet ernaast gezet:

| Doctrine | Noemertrede | Wat er verder over beslist |
|---|---|---|
| R0 alleen lezen, A0 uitleg | tonen | — |
| R1 eenvoudig omkeerbaar, A1 voorbereiden | klaarzetten | gewicht `licht`, ongedaan vóór bevestigen |
| R2 beperkt gevolg, A2 beperkt uitvoeren | uitvoeren, alleen waar de **wereld** dat toestaat | LivingOS en WorkOS kennen `klein`; FoundationOS niet |
| R3 financieel/juridisch, A3 beleidsgebonden | klaarzetten; uitvoeren alleen binnen een mandaat, en nooit bij geld of het pasbesluit | `kern/stuur/mandaat.js`, GELD.md par. 3 |
| R4 veiligheid/rechten, R5 kritiek, A4 kritieke ondersteuning | klaarzetten voor een bevoegd mens | gewicht `plechtig` |

Conceptueel: **wereld × noemer × gewicht × mandaatgrenzen**. Zo wordt zichtbaar
waarom `EXECUTE_LOW_RISK` geen platformwaarheid kan zijn: een handeling kan
klein lijken voor wie hem bouwt en toch in een leven vallen waarvan de bouwer de
context niet kent (FOUNDATION.md par. 2). *Autonoom* en *begrensd* blijven
eigenschappen van het mandaat en worden geen trede.

### 2.2 Eén canonieke envelop, geen universele ontologie (U21)

De doctrine vraagt één objectmodel voor de volledige economie. OBJECTMODEL.json
heeft gemeten dat `Asset` niet bestaat: tafel, kamer, podium en leaseauto delen
niets buiten hun verpakking. COMMERCE.json vond nul domeinen die alle acht
werkwoorden dragen, en `Koopbaar` werd daarom een verklaring van werkwoorden en
geen interface. De doctrine mengt twee dingen die OS.md uit elkaar houdt:

- **platformvermogen** — Person, Organization, Payment, Consent, Evidence,
  Decision, AuditEvent: daar mag één grammatica over, en die staat er grotendeels
  (kluis, poort, consent-register, envelop);
- **domeinvermogen** — Vehicle, Room, Shift, Table, Delivery, Case: die worden
  niet geforceerd tot afstammelingen van iets abstracts, want de gemeten
  werkwoorden en levenscycli komen niet overeen.

De regel: *de verpakking en de vertrouwensregels worden gedeeld; de
domeinbetekenis wordt niet geforceerd.* Een gedeeld type wordt gevonden in de
domeinen (de vier van `architect`, `atelier`, `hardwarelab`, `studio`) en nooit
eroverheen verklaard.

### 2.3 Grade is een projectie en nooit een rekenmodel (U38)

De poorten uit de doctrine zijn bruikbaar; het cijfermodel niet. Een product is
niet RTG-waardig omdat elf dimensies gemiddeld een 8,6 opleveren. Eén ontbrekend
herstelpad of één geldbeweging buiten de ledger blijft een blokkade. Dus:

> **RTG-waardig = alle toepasselijke harde poorten gesloten.**

READY blijft de gezaghebbende uitkomst (`scripts/zekerheid.js`). Een presentatie
als `rtg grade` mag alleen uitleggen waarom READY wel of niet volgt, en mag nooit
een tweede waarheid produceren. Dat is LAT-regel 11 en check.js regel 48, en
BEWIJSMACHINE.md heeft dezelfde vraag al één keer zo beantwoord.

### 2.4 De vijf shellgebieden worden op het huis geprojecteerd (U26, U27)

WERELD.md heeft besloten dat er één beginscherm is, de lege werktafel van RTG
Command. Vier van de vijf gebieden bestaan al als projectie: **Vandaag** is
`vandaag.html`, **Doen** is Rahul in de schilbalk, **Ruimtes** zijn de werelden
in de bank, **Jij** is het bedieningspaneel in de voet. Alleen **Inbox** is een
echte nieuwe capability, en die hoeft geen vijfde tabblad te zijn. Hij wordt
eerst ontworpen als geadresseerde objectprojectie: *alles waarvoor deze actor nu
ontvanger, eigenaar of beslisser is.* Dan hangt hij rechtstreeks aan het
ontvangercontract (par. 3) en het statuscontract (par. 4), en is hij geen
tweede berichtenbak.

### 2.5 Een voorspelling krijgt meetgrond (U34)

De digitale tweeling mag bestaan. Maar "71% van de afspraken kan automatisch
worden verplaatst" is exact de zin die BESTUUR.md verbiedt zonder graad erbij.
Een voorspelling in dit huis draagt: historische grond, meetperiode,
datakwaliteit, bandbreedte, onzekerheid, en de voorwaarden waaronder zij
vervalt. `kern/kosten/vooruitblik.js` doet dat al voor kosten en toont pas een
bandbreedte als de trefzekerheid over drie afgesloten maanden gemeten is. Zonder
die grond toont RTG hoogstens een scenario, geen voorspelling.

### 2.6 De repo verhuist niet (U45, U46)

De mappenstructuur `/products`, `/domains`, `/capabilities`, `/trust` kan een
gegenereerde leesweergave zijn, zoals EXECUTION_MAP.json een projectie van 3282
routes is. Een fysieke verhuizing van 415 kerndomeinen is geen norm maar een
verbouwing, en dezelfde mapnamen leveren niet automatisch dezelfde semantiek op.
De architectuur blijkt uit contracten en registers. Om dezelfde reden komt de
doctrine niet letterlijk in PLATFORM.md: daar zouden de botsingen naast de
besluiten staan die ze tegenspreken.

---

## 3. Het ontvangercontract — **staat als meting, nog geen poort**

*Over het woord.* De doctrine noemt dit een handoff. De eerste versie van dit
document noemde het "overdracht" en de meter `scripts/overdracht.js`, en dat
overschreef `test/overdracht.test.js`: **`kern/overdracht.js` bestaat al** en is
de Integration Fabric, het pakket dat meegaat als een gezin van school wisselt.
Dezelfde botsing die SEMANTIEK.json bij `KANALEN` vond, hier vóór de commit
gevangen door het bestandssysteem in plaats van door de meter. Het contract heet
daarom **ontvangercontract**, de meter `scripts/doodspoor.js` (naar de regel die
hij meet), en waar dit document "handoff" zegt, is dat het Engelse woord uit de
doctrine en geen nieuw huisbegrip.

Dit is de waardevolste vondst uit de doctrine, omdat hij precies de ruimte sluit
waarin moderne software meestal faalt: *de eerste handeling is uitgevoerd, en
niemand bezit wat daarna moet gebeuren.* De zin "zonder ontvanger" stond al op
vijf plekken in de code (`mailaanname.js`, `rtfos/gift.js`, `rtfwallet.js`,
`webplatform.js`, `rtmail-schrijf.js`), telkens lokaal en telkens anders
geformuleerd. Nergens werd hij gemeten.

### 3.1 Het contract

Elke handeling die een tweede partij raakt, draagt:

```
bronactor          wie handelt
bronroute          welk commando
geraakt object     welke collectie
nieuwe toestand    wat er veranderde
ontvangende actor  wie nu aan zet is
ontvangende route  waar die dat doet (route, wachtrij of taak)
eigenaar           wie de toestand bezit
volgende stap      wat er verwacht wordt
verval             wat er gebeurt als niemand reageert
herstelpad         hoe het terug kan (exact of compensatie)
bewijsgrond        waaruit blijkt dat de handoff plaatsvond
gesloten           ja / terminaal / open
reden              bij terminaal en open verplicht
```

Er is geen schaal. Een handoff is **gesloten**, **terminaal** (bewust
verklaard: dit object heeft geen tweede partij) of **onverklaard open**.
Terminaal is een verklaring en nooit de afwezigheid van een vervolgroute.

### 3.2 De meting

`scripts/doodspoor.js` (`npm run doodspoor`) meet de smalle helft van dat
contract die vandaag meetbaar is: **bron**, **object** en **ontvangende actor**.
De bron is IDEMPROEF.json, dat per route heeft gemeten welke collecties zij
aanraakte (hetzelfde veld dat `kern/stuur/gevolg.js` leest). Vier actorgroepen
worden afgeleid uit de rol die de proef hanteerde: consument, aanbieder, kantoor,
platform. Een bronroute is een route die in de proef werk deed en een collectie
aanraakte. Vijf standen, en er is geen schaal:

| Stand | Betekenis | Graad |
|---|---|---|
| **gesloten** | een andere groep zet een stand op dezelfde collectie | gemeten |
| **gezien** | een andere groep leest hem alleen | vermoed (uit de bron) of aangewezen (door een mens, getoetst) |
| **tussen** | de ontvanger is een ánder lid — zie 3.3 | verklaard, met de tegenroute |
| **terminaal** | de collectie wacht op niemand | de soort: `mens`, `huis` of `boeking` |
| **open** | geen ontvanger gevonden en geen verklaring | — |

Infrastructuur die elke aanroep raakt (sessies, idempotentiesleutels) staat in
`INFRA` met een reden en telt niet mee.

| | eerste ronde | na de triage |
|---|---:|---:|
| bronroutes met gemeten werk | 282 | <!--getal:doodspoor.bronroutes-->282<!--/getal--> |
| gesloten (gemeten) | 65 | <!--getal:doodspoor.gesloten-->65<!--/getal--> |
| gezien (vermoed of aangewezen) | 49 | <!--getal:doodspoor.gezien-->51<!--/getal--> |
| tussen leden (verklaard) | — | <!--getal:doodspoor.tussen-->18<!--/getal--> |
| terminaal (verklaard) | 5 | <!--getal:doodspoor.terminaal-->56<!--/getal--> |
| open | 163 | <!--getal:doodspoor.open-->85<!--/getal--> |
| collecties met minstens één open bronroute | 121 | <!--getal:doodspoor.openCollecties-->81<!--/getal--> |
| routes die in de proef geen werk deden en dus buiten de meting vallen | 3123 | <!--getal:doodspoor.nietGemeten-->3123<!--/getal--> |

De matrix (bron → ontvanger, gesloten relaties per collectie) staat in
DOODSPOOR.json. Wat hij laat zien: consument → aanbieder en aanbieder →
consument zijn de dikste lijnen, kantoor is als ontvanger dunner, en de
platformrij is nul in beide richtingen. Die laatste nul is geen bevinding over
het platform maar over de lens: platformroutes (techniek, scim) doen in de proef
geen werk op zaakcollecties.

### 3.3 Wat de triage vond — en waarom er twee standen bij kwamen

De eerste ronde zette 163 bronroutes op open. Die lijst is nagelopen, en hij
bevatte drie dingen die alle drie iets anders vragen. Twee ervan waren geen
gaten in het product maar in de meter, en ze zijn allebei uitgeschreven in plaats
van weggewerkt.

**1. De ontvanger is een ánder lid — de blinde vlek van vier groepen.**
`/api/pay/verzoek` maakt een betaalverzoek, `/api/pay/verzoek/betaal` voldoet
het, en dat zijn twee mensen. Beide routes dragen de rol `member`, dus de meter
noemde de ontvanger "dezelfde groep" en zette de bron op open. Dat is geen
randgeval: het is wat een betaalverzoek *is*. Een fijner groepenmodel redt dat
niet — twee leden zijn per definitie dezelfde soort actor. De stand **tussen**
draagt daarom de **tegenroute** als bewijs, en die wordt getoetst tegen de
routelijst van de server: bestaat hij niet, dan is de verklaring verlopen en
zakt de naloop. Drie collecties vielen zo weg uit open: het betaalverzoek, de
contactpin (LINK.md: lid A geeft zijn code, lid B zoekt hem op) en De Résidence,
waar `pols()` de staat van de zaal teruggeeft aan de anderen die er staan.

Of de proef die tegenroute ook kon **meten** is een tweede vraag, en het antwoord
staat apart in de uitslag: `/api/member/pin/zoek` bestaat en gaf 400, omdat er
geen geldige pin te zoeken was. Niet gemeten is geen oordeel (LAT-regel 12), dus
dat wordt gemeld en niet verzwegen.

**2. De collectie wacht op niemand — en "eigen" was daarvoor te smal.** De eerste
ronde kende alleen `EIGEN`: van één mens. De triage liep daar binnen een uur op
vast. `zelfzorg` is van het **kantoor** (`kern/zelfzorg/index.js`: het platform
ruimt zichzelf op, en wat een mens moet beslissen wordt daar al een advies via
een andere collectie). `paySaldi` is van **niemand** — het is een positie in het
grootboek, en een grootboekregel ís het bewijs dat een handoff plaatsvond in
plaats van een taak die wacht (WAARDE.md). Alle drie zijn terminaal, maar wie ze
onder één woord schuift, verliest juist de reden. Vandaar `TERMINAAL` met drie
soorten — `mens`, `huis`, `boeking` — en een vierde erbij verzinnen is een
besluit, niet een sluiproute voor een lastige collectie. `test/doodspoor.test.js`
toets 4b houdt dat op drie.

De grens bij `huis` is smal en met opzet: hij geldt voor de machine, nooit voor
een zaak of een lid. `commandBeleid` (de operationele regels van RTG, inclusief
prijzen en limieten) en `commandPlannen` (een plan van de AI-operator dat een
mens uitvoert) staan er daarom **niet** in en blijven open — hun effect landt bij
een klant, en dan is "wie is nu aan zet" een echte vraag.

**2b. De ontvanger bestaat nog niet, en dat is elders al besloten.** De tweede
triageronde vond een groep die in geen bak paste: het kantoor zet de giftstand
van de RTFoundation, richt een stad in, beheert haar winkel — en de ontvanger zou
een **donateur** zijn. Die bestaat niet, en dat is geen omissie: GIFT.md legt
vast dat er met opzet geen doneerknop en geen incasso is, en dat er drie
besluiten aan voorafgaan. Zo'n collectie open laten staan zou de lijst vervuilen
met werk dat niemand mag doen; hem terminaal noemen zou liegen. Vandaar de stand
**`besluit`**, met de vindplaats erbij — en `test/doodspoor.test.js` toets 12b
zakt zodra dat document niet bestaat of de verklaring niet meer wordt gebruikt.

**3. Wat overblijft: <!--getal:doodspoor.openCollecties-->81<!--/getal--> collecties met een echt open handoff.** Daar zit het
werk. De grootste post is `concern` (5). De volledige lijst staat gesorteerd in
DOODSPOOR.json onder `openCollecties`.

### De derde ronde (3 september 2026)

Twaalf collecties erbij verklaard, 109 open bronroutes → <!--getal:doodspoor.open-->85<!--/getal-->. Twee soorten,
en ze zijn allebei nagelezen in de code en niet afgeleid uit de naam:

- **terminaal `huis` (10):** de vier ontwerpbureaus (`architect`, `atelier`,
  `hardware`, `studio` — concept én chefsblik komen uit dezelfde module, er
  wacht niemand op), de ops-cockpit (`commandAgents`, `commandBeleid`,
  `commandPlannen`, naast de al verklaarde `zandbakken` en `apiPoort`), het
  bestuursvlak van een zaak (`zaakCommand` — *"er is geen sleutel die buiten de
  zaak wijst"*), `bankregie` en `webMerken`.
- **tussen leden (2):** `salon` (lid A schrijft, lid B leest in de feed) en
  `genootschap` (lid A richt op en nodigt uit, lid B komt binnen via
  `/api/genootschap/binnen`).

Eén van die tien is een regel die hoort te sneuvelen: `OBJECTMODEL.json` noemt
de **ontwerpopdracht** als de enige kandidaat die de drempel voor een gedeeld
type haalt. Komt er ooit een klant aan zo'n opdracht te hangen, dan is dat
precies het moment waarop de vier bureaus geen terminaal huis meer zijn. Dat
staat er met zoveel woorden bij in `scripts/doodspoor.js`.

`rtfos` (7) blijft de grootste `besluit`-post en `bankregie` is nu verklaard als
regie van RTG zelf — de LEDEN zien het resultaat via hun eigen rekening, en die
collectie staat apart.

Wat de meter principieel niet ziet, staat in zijn uitslag onder `grens`: een
ontvanger die niet via een collectie loopt (mail, sms, webhook), routes die in de
proef geen werk deden, en eigenaar, termijn en verval van een stand (par. 4).

**Daarom is dit nog steeds een meting en geen poort.** Pas als "open" schoon is,
mag de regel hard worden: dan zakt de bouw op een onverklaarde open handoff, en
niet eerder. Twee triagerondes brachten hem van 163 naar
<!--getal:doodspoor.open-->85<!--/getal-->, met zes standen die elk iets anders
zeggen. Wat er nu ligt is voor het eerst een lijst waar één betekenis onder zit.

---

## 4. Het statuscontract — **stap weg**

De doctrine wil per object een levenscyclus met benoemde overgangen. Het huis
mag daarin niet opnieuw alle domeinen gelijkmaken: een bestelling, een
arbeidszaak en een zorgmelding hoeven niet dezelfde standen te hebben (par. 2.2).
Wat wél huisbreed kan, is **één regel voor statussemantiek, geen lijst met
statussen**. Elk niet-terminaal domeinobject verklaart:

```
wie bezit deze toestand
wie is nu aan zet
welke overgang is toegestaan, en wat veroorzaakt hem
wanneer verloopt de toestand
wat gebeurt er bij geen reactie
welk herstel bestaat (exact of compensatie, uit HERSTEL.json)
```

Het patroon staat al op één plek: `kern/commerce/retour.js` kent vijf standen
die elk zeggen welke partij ze zet. Dat wordt het model; de vorm komt uit de
gouden keten (par. 7) en niet uit een ontwerpsessie, omdat een contract dat op
papier is bedacht binnen een jaar zelf de volgende botsing is.

---

## 5. Actor-compleetheid — een lens, geen toneelcast — **stap weg**

De negen perspectieven (consument, zakelijke klant, aanbieder, professional,
operations, administrator, support, partner of toezichthouder, platform) zijn
sterk als beoordelingskader. Niet elk product heeft ze alle negen nodig. De
regel:

> Elke productfamilie beoordeelt alle negen perspectieven en verklaart welke
> toepasselijk zijn. Elke toepasselijke actor en elke handoff tussen actoren
> is volledig: commando, projectie, bevoegdheid, verantwoordelijkheid, bewijs en
> herstel.

Actor-compleetheid is dus niet "negen schermen aanwezig" maar "geen noodzakelijke
actor ontbreekt". Het platformregister krijgt daarvoor alleen de minimale
aanvullende relatie die de meting nodig heeft: per functie welke actorgroepen
haar dragen, afgeleid uit de rollen van haar routes en niet met de hand ingevuld.

---

## 6. Bewijskwaliteit — de grootste inhoudelijke schuld

Proof-aware routing is in de doctrine de onderscheidende superkracht. Hier
staat het zo, en het onderscheid tussen de vier regels is de hele boodschap:

| Onderdeel | Stand |
|---|---|
| mechanisme (bewijspoort laat een geschorste capability uit de paden vallen) | staat |
| aansluiting op de routing (`kern/stuur/beleid.js`) | staat |
| bewijsdekking | niet bewezen: <!--getal:vertrouwen.bewezen-->0<!--/getal--> bewezen, <!--getal:vertrouwen.routes-->4180<!--/getal--> verzwakt, <!--getal:vertrouwen.geschorst-->0<!--/getal--> geschorst |
| blokkerende werking | niet aangetoond: met nul geschorste routes houdt de poort niets tegen |
| uitspraak | capability aanwezig, onderscheidende werking open |

Zolang vrijwel alles als *verzwakt* binnenkomt, kan de poort niet betekenisvol
onderscheiden. Het is een beveiligingspoort waarvan alle passen dezelfde
onzekere status hebben. Daarom staat U8 op *jaren weg* en niet op *stap weg*:
BEWIJSSCHULD.json draagt per afwijking een sluitweg, maar dat zijn er
duizenden en geen één. De regel uit EXECUTIE.md blijft: "onbekende
uitvoeringssemantiek krijgt nooit maximale autonomie" zet vandaag *alles* op
het minimum, en hoort dus eerst in de schaduw te lopen.

---

## 7. De gouden ketens: horeca en mobiliteit — **twee, en dat is het punt**

De doctrine wil drie gouden ecosystemen (mobiliteit, horeca, werk). Horeca ging
eerst, omdat daar de meeste ketenwaarheid al staat. Let op het verschil met
EXECUTIE.md par. 7: die keten (*bereid een standaard inkoopbestelling voor*,
vier routes) bewijst een **autonome AI-keten**; deze bewijst een **actorketen**.
Het zijn twee vragen, en de tweede vraagt geen AI.

`scripts/tafelproef.js` (`npm run tafelproef`) legt die keten af tegen een
wegwerpserver met een eigen datamap. Hij vraagt per stap niet "geeft de route
200" maar **handelt actor A, en ziet actor B dat vervolgens?** Een schakel is
`gesloten` als de ontvanger de verandering aantoonbaar ziet, `open` als hij hem
niet ziet, en `stuk` als de handeling zelf al niet lukte. Eén open schakel laat
de proef zakken: dit is geen triagelijst zoals DOODSPOOR.json maar één keten die
hoort te sluiten.

### 7.1 De negen schakels

| # | van → naar | wat er gebeurt | wat de ontvanger ziet |
|---|---|---|---|
| 1 | zaak → gast | opent een rekening op de tafel | de gast leest tafel en zaaknaam na het scannen |
| 2 | zaak → zaak | zet een stoel aan tafel (de tweede deur) | één stoel, en die draagt **geen** eigen sessie |
| 3 | gast → zaak | schuift aan via de QR | dezelfde rekening-id, nu met twee stoelen |
| 4 | gast → zaak | bestelt | de regel staat op de bon van de zaak |
| 5 | zaal → keuken | geeft de gang vrij | keukenbord **0 → 1** bon |
| 6 | keuken → keuken | leest de bon | de bon draagt `gastNr 2` en de stoelnaam |
| 7 | keuken → gast | zet de bon op uitgegeven | de gast leest 1 van 1 uitgegeven |
| 8 | gast → gast | splitst per stoel | 2 delen, som gelijk aan het te betalen bedrag |
| 9 | zaal → gast | corrigeert een regel met grond en reden | de gast leest *"Verkeerd bereid: koud geserveerd"* bij zijn gerecht |
| 10 | zaal → zaak | de rekening zakt met het bevroren bedrag | bruto 3200 → 1600, en de regel staat er nóg |
| 11 | zaak → gast | rekent de rest af | de gastsessie sluit met een reden en een weg terug |

Drie dingen die deze proef aantoonde en die geen enkele losse routetoets kon
zien:

**Schakel 5 is de handoff die nergens beschreven stond.** Vóór
`/api/supplier/horeca/gang/vrij` staat de bestelling níét op het keukenbord —
`if (!regel.vrijAt) continue`. Het werk wacht dus bij de zaal, en dat is een
overdracht met een eigenaar. In DOODSPOOR.json is dat onzichtbaar, want beide
routes zijn `supplier`.

**Schakel 6 laat zien dat de stoel het hele eind meegaat.** HORECA.md noemde de
stoel het ontbrekende scharnier en vond hem daarna terug in de data; hier blijkt
dat hij tot op de keukenbon staat. De kok ziet voor wie hij kookt.

**Schakel 9 verried een fout in de proef zelf, en dat is de nuttigste vondst.**
De eerste versie toetste `openstaand === 0 && gesloten === true` — allebei
velden uit het antwoord van de *zaak*. De proef die bestaat om de ontvanger te
meten, keek naar de bron, stond op groen, en had daar nooit van kunnen zakken.
De enige aanwijzing was `gastbeeld: undefined` in de uitslag. Wat de gast
werkelijk ziet is **401 `sessie-weg`** met "Scan de QR op tafel opnieuw" — geen
gat maar een grens, want een sleutel die na het afrekenen geldig blijft, is een
tafel waar een vreemde later nog op kan kijken. `test/tafelproef.test.js` toets 8
houdt vast dat elke schakel over actoren heen de gemeten waarde vastlegt en
nooit een booleaan.

### 7.2 De vijf storingen

Falen is een normale producttoestand (U16), en dit is de helft die zonder proef
op "dat vangen we af" blijft staan. Elke storing noemt wat hij belooft; komt het
antwoord niet overeen, dan zakt de proef.

| storing | belofte | wat er gebeurde |
|---|---|---|
| dubbele tik op Bestellen | dezelfde sleutel geeft geen tweede regel | 1 regel, ook na de herhaling |
| een stand terugzetten zonder reden | wordt geweigerd, en de weigering zegt waarom | 400: *"kan, maar noteer waarom; dat blijft op de bon staan"* |
| betalen met een rail die de gastdeur niet heeft | weigert, noemt de reden en zegt wat er wel kan | 501, met `rails: ["bon","tegoed","kamer"]` |
| een verzonnen gastsleutel | opent geen rekening, ook niet leeg-maar-geldig | 401, geen rekening in het antwoord |
| een tweede rekening op dezelfde tafel | weigert en wijst naar de bestaande | 409, met het id van de open rekening |
| een correctie op een rekening die al betaald is | zet een teruggaverecht klaar zonder het uit te voeren | 3200 klaar, `uitgevoerd: false`, en `openstaand` spiegelt het op −3200 |
| dezelfde regel twee keer corrigeren | weigert | 409 — anders zakt de rekening twee keer voor één gerecht |
| een weigering die naar een andere weg verwijst | die weg bestaat werkelijk en doet wat de melding belooft | de weigering wees naar `regel/corrigeer`, en die gaf 200 |

### 7.3 Het dode spoor dat de keten blootlegde

Het bouwen van deze keten leverde de scherpste vondst van alle drie de rondes op,
en het is een dood spoor in de zuiverste vorm: **een weigering die je naar een
deur stuurt die niet bestaat.**

Wie een regel van de rekening haalde waar de keuken al aan begonnen was, kreeg:

> *"De keuken is hier al aan begonnen. Haal hem eraf via derving, met een reden."*

Die derving bestaat — maar in een ánder domein. `/api/supplier/kassa/derving`
schrijft in `kassaDerving`, neemt losse items met een prijs en een aantal, boekt
voorraad af, en kent geen rekening, geen regel en geen gast. Je kon er dus niet
doen waar de melding je heen stuurde. De horecalaag wist het zelf al, op een plek
waar niemand het zocht: `kern/horeca/dienstmeting.js` meldt bij meetpunt 9 dat
"de kassa derving met een soort kent; de rekening niet".

Het gevolg was niet administratief. Een gerecht dat verkeerd bereid was, kon
alleen van de rekening met **korting** (op de hele bon, zonder te zeggen wát er
misging) of met **oninbaar** (de hele rekening afboeken). Alles of niets, en in
geen van beide staat wat er met dat ene gerecht gebeurde.

**De reparatie is `kern/horeca/correctie.js`**, met vier dingen die vastliggen:

1. **De regel blijft staan** en telt nul — via `regelSom` in `kern/horeca.js`,
   dus op één plek, zodat de totalen, het splitsen, het samenvoegen en de
   verdeling per stoel meebewegen en `controleerSom()` blijft kloppen. Laat je
   hem verdampen, dan ziet de keuken zijn werk verdwijnen en verliest de gast het
   spoor (dezelfde grens als `gezelschap.js` bij het weghalen van een stoel).
2. **Grond én reden verplicht.** De grond komt uit een gesloten lijst van vijf,
   elk met wie het meldt (gast of zaak); de reden is vrije tekst. Zonder grond
   zegt de dagstaat niets; zonder reden is het een knop waarmee omzet verdwijnt.
3. **Geld wordt klaargezet, nooit verplaatst.** Is er nog niet betaald, dan zakt
   het te betalen bedrag. Is er ál betaald, dan ontstaat er een teruggave**recht**
   met een bevroren bedrag en `uitgevoerd: false`; een mens voert het uit langs
   `kern/pay` (GELD.md par. 3). Toets 12 in `test/horeca-correctie.test.js` zakt
   zodra deze laag de betaalpoort aanraakt.
4. **Een negatief `openstaand` blijft staan.** Corrigeer je na de betaling, dan
   is er meer binnen dan er te betalen valt. Dat op nul afkappen zou het bedrag
   stil laten verdwijnen uit de enige plek waar een scherm het leest. Het is de
   waarheid, en het hoort exact te spiegelen met de som van de openstaande
   teruggaven — een invariant die de proef meet.

**Waarom dit geen `kern/commerce/retour.js` is.** Die laag is voor een koper die
goederen terugstuurt naar een verkoper: verzendstanden, een `orderRef` naar een
vreemd domein dat RTG niet kan nakijken, en een verkoper die nog moet beslissen.
Een gast aan tafel stuurt niets terug, de order is van dít domein en staat een
functie verderop, en de medewerker die de correctie boekt *is* de verkoper.
COMMERCE.md had die vraag al gemeten: van de 100 domeinen kenden er zes iets dat
op een retour leek en geen ervan was een goederenretour. Wat er wél uit die laag
komt is de **vorm** — gesloten gronden, een bevroren bedrag, een geldbesluit dat
wordt klaargezet.

De oude toets op dit gedrag keek of het wóórd "derving" in de foutmelding stond.
Hij loopt nu de aangewezen weg af en controleert dat die werkt — een melding die
ergens heen wijst, is pas een melding als daar iets is.

### 7.4 De tweede keten: de rit — **sluit**

Eén keten die sluit bewijst dat het kan. De vraag daarna is een andere: **is er
een gedeelde vorm, of is elke keten zijn eigen ding?** Die vraag beantwoord je
niet met een tweede horecaketen — bezorging deelt de rekening, de kaart en de
keuken met de tafel, dus dan meet je bijna hetzelfde nog een keer. Vandaar de
rit, in een ander domein.

`scripts/ritproef.js` (`npm run ritproef`) legt acht schakels af — aanvraag,
vooruitbetaling, toewijzing, vier standen, afronding — met zes storingen. Zeven
schakels sluiten. Wat deze keten *anders* doet dan de tafel is precies waarom
hij nuttig is als tweede meting:

| | tafel | rit |
|---|---|---|
| volgorde | eerst leveren, dan betalen | eerst betalen, dan leveren (`assign` weigert met 409) |
| standen | een regel kan terug, mét reden | de keten mag alleen vooruit (`RIT_KETEN`) |
| naam van de werker | gaat **niet** naar de gast | gaat **wel** naar het lid — je stapt bij iemand in de auto |
| naam van de klant | zelfgekozen handle | codenaam (privacy by design) |

**De stand `openBekend` blijft bestaan, en dat is geen restant.** Een schakel die
aantoonbaar niet sluit mag een uitgeschreven reden dragen. De vorm komt van
`MET_REDEN` in `scripts/tikken.js` —
een scherm dat buiten bereik ligt mag bestaan zolang iemand heeft opgeschreven
waarom. Zonder die uitweg heeft een proef die iets echts vindt maar twee
uitgangen: altijd zakken (dan zet iemand hem uit) of de bevinding wegpoetsen
(dan meet hij niets meer). De proef meldt daarom twee dingen apart — `sluit` en
`sluitMetBevinding` — en nooit één samengesteld cijfer. Dat die uitweg hier nu
leeg staat, is het bewijs dat hij werkte: de bevinding is niet weggepoetst maar
opgelost.

### 7.5 De twee ritwerelden — **besluit genomen, brug gelegd**

Schakel 1 vroeg of de vervoerder een aangevraagde rit terugvindt in een
werklijst. Hij vond hem niet, en de oorzaak was groter dan een ontbrekende
route: er waren **twee ritwerelden met nul verwijzingen in beide richtingen**.

- `db.data.rides` — de lidkant. `/api/ride/request`, `ride/pay`,
  `supplier/ride/*`. Zes standen (`RIT_KETEN`, `kern/vervoer.js`).
- `db.data.mobOpdrachten` — het dispatchcentrum. `/api/supplier/mob/*`, met
  matching, overboeken en telefoonboekingen. Tien standen (`KETEN`,
  `kern/mobiliteit/keten.js`) plus uitzonderingen.

Vier standen deelden ze letterlijk, twee onder een andere naam
(`aan-boord`/`ingestapt`, `afgerond`/`voltooid`), en één woord botste echt:
**`rijdt`** is in `rides` een verouderde naam vóór `aan-boord` (`RIT_LEGACY`
mapt hem weg) en in de opdrachtketen een eigen stand ná `ingestapt`. En
`kern/mobiliteit/dispatch.js` beloofde in zijn eigen kop dat een
telefoonboeking *"dezelfde keten"* krijgt als een app-rit — omgekeerd waar: de
**app-rit** haalde het dispatchbord nooit.

**Het besluit van de eigenaar (3 september 2026): de opdracht wordt de
waarheid.** `kern/mobiliteit/appbrug.js` legt de brug. Vier dingen liggen daar
vast:

1. **Een mislukte opdracht breekt de rit niet.** `opdrachtMaak` heeft poorten
   die de app-rit niet passeerde: de module moet aanstaan, en vertrek én
   bestemming moeten oplosbare *plekken* zijn. Een app-rit draagt vaak alleen
   een tekst ("Haven"). Dan ontstaat er geen opdracht en blijft de rit precies
   zoals hij was, met `opdrachtReden` erop. Een besluit uitvoeren mag geen
   aanvragen weigeren die het gisteren nog deed.
2. **De ritketen is grover, dus de brug loopt een pad.** `aangevraagd` →
   `geaccepteerd` is in de opdrachtwereld drie gebeurtenissen (geprijsd,
   aangeboden, geaccepteerd); `aan-boord` → `afgerond` er twee (rijdt,
   voltooid). Die tussenstappen zijn geen kunstgreep: bij een app-rit staat de
   prijs meteen vast en is hij meteen aangeboden aan die ene vervoerder. Het pad
   loopt alleen door de hoofdketen — nooit via `incident` of `geannuleerd`, want
   dat zou een gebeurtenis verzinnen die niet plaatsvond.
3. **De standen worden vertaald, niet overgetypt.** De tabel staat uitgeschreven
   in de brug, met de `rijdt`-botsing erbij. `test/appbrug.test.js` toets 4 zakt
   zodra een ritstand naar `rijdt` vertaalt.
4. **De brug loopt één kant op.** Van rit naar opdracht, nooit terug. Twee
   lijsten die elkaar bijwerken hebben geen waarheid meer — en het besluit was
   juist dat de opdracht dat is.

De aanvraag verschijnt nu op het dispatchbord, en schakel 1 sluit.

**De migratie is in kaart gebracht, en de kaart stopte hem meteen.**
`scripts/ritmigratie.js` (`npm run ritmigratie`) deelt de <!--getal:ritmigratie.bestanden-->21<!--/getal-->
plekken die `db.data.rides` noemen in naar wat ze ermee doen:
<!--getal:ritmigratie.stand-->7<!--/getal--> lezen de **lopende** rit,
<!--getal:ritmigratie.historie-->9<!--/getal--> tellen **historie** af,
2 **schrijven**, en 3 noemen hem alleen in commentaar.

Die kaart is geschreven vóór er een regel verplaatst werd, en zij bewees haar
nut binnen het uur: de eerste versie zei *"zeven lezers kunnen nu om"*, omdat
een stand-lezer alleen de lopende rit toont en de opdracht die rijker draagt.
Wat daarbij werd overgezien is dat een rit **zonder** opdracht dan uit die
weergave valt — en dan ziet een lid met een bestemmingsloze rit zijn eigen taxi
niet meer staan in `/api/live/state`. Dat is een regressie en geen migratie, en
de kaart ging daarop naar nul.

### 7.5b Het besluit dat de blokkade ophief: de vervoerder kiest

De blokkade was principieel: de ledenapp stuurt `toCode` alleen als het lid een
bestemming koos, en zonder bestemming loste `kern/mobiliteit/plekken.js` geen
plek op. **Het besluit van de eigenaar (3 september 2026) maakt er een keuze van
de vervoerder van** — en die geldt voor een losse chauffeur net zo goed als voor
een bedrijf:

| | |
|---|---|
| `rittenMetDoel` | de gast noemt de bestemming vooraf |
| `rittenZonderDoel` | de gast zegt het onderweg, zoals in een straattaxi |

Twee booleans in `ZAAK_OPTIES` (`kern/leverancier.js`) en geen keuzelijst met
drie standen: dat register draagt booleans, de instellingenroute toetst er
letterlijk op, en *"beide aan, of één uit"* ís twee booleans. Beide uit betekent
hetzelfde als `ritten: false`, en dat wordt gezegd in plaats van een lege lijst
te tonen.

Wat er gebeurt bij een rit zonder bestemming:

- **neemt de vervoerder die soort aan** → de opdracht krijgt een bestemming die
  expliciet `onbekend` heet: geen afstand, geen vaste prijs, wel een plek op het
  dispatchbord. `kern/mobiliteit/plekken.js` heeft daarvoor een eigen spec
  (`{ onbekend: true }`), en die is met opzet expliciet — de weigering voor
  alles wat wél een plek had moeten zijn, blijft staan.
- **neemt hij hem niet aan** → `kern/lidacties/ritten.js` weigert met de reden
  én de weg eromheen: *"vraagt om een bestemming voordat de rit begint."*

Zo of zo heeft elke rit die bestáát voortaan een opdracht. De teller in de
migratiekaart staat daarmee op **<!--getal:ritmigratie.kanNu-->7<!--/getal-->
lezers die om kunnen** (de stand-lezers), daarna
<!--getal:ritmigratie.daarna-->11<!--/getal--> (historie, dan de schrijvers).

**En de losse chauffeur is geen bijzonder geval.** Hij is een zaak met één
persoon erin: hij meldt zich aan op eigen naam (`staffId` + pincode), wijst
zichzelf de rit toe met `self: true`, en ziet hem op zijn eigen dispatchbord.
Wie met het *bedrijfsaccount* inlogt heeft geen `staffId` en kan dat niet — dat
is de grens en geen gebrek: elke handeling staat op een persoon. Storing 11 in
de ritproef meet die hele weg.

**Wat er overblijft is geen blokkade maar een restrisico**, en het staat in de
uitslag: `opdrachtMaak` kan nog per geval weigeren (een vervoersmodule die in
dat gebied uitstaat, een vertrekpunt dat niet op te lossen is), en dan draagt de
rit `opdrachtReden`. Elke lezer die omgaat moet zo'n rit afvangen — zichtbaar,
met de reden erbij, en nooit door hem stil uit de lijst te laten vallen.

Zolang de lezers niet om zijn, blijft `rides` een echte lijst en geen projectie.
De richting staat vast, de blokkade is weg, en de volgorde van het werk staat in
de kaart — niet alleen hier.

Eén ding kwam bij het bouwen naar boven en is de moeite waard: de domeingrens
(`GRENZEN.json`) hield de brug tegen tot iemand hem op de lijst zette. Precies
zoals bedoeld — *"de lijst wordt compleet doordat hij ergens knelt, niet doordat
iemand goed heeft geraden."*

### 7.6 Wat de ketens delen — gemeten, niet verklaard

> **Bijgewerkt na de derde keten.** Deze paragraaf is geschreven toen er twee
> waren; de tabel telt inmiddels over drie (par. 7e). De redenering eronder is
> niet veranderd, de uitkomst is scherper geworden.

De verleiding na de tafelproef was een `scripts/lib/keten.js` en beide proeven
daarop zetten. Dat is precies de vorm waarin `Asset` hier al een keer sneuvelde.
De twee proeven zijn daarom los geschreven, in dezelfde vorm maar zonder gedeelde
module, en `scripts/ketenvorm.js` telt achteraf wat ze werkelijk delen
(`test/ritproef.test.js` toets 8 zakt zodra een van de drie alsnog aan een
gedeelde ketenmodule hangt).

De uitkomst is streng:

| | gedeeld |
|---|---|
| **actoren** | <!--getal:ketenvorm.actorenGedeeld-->0<!--/getal--> van <!--getal:ketenvorm.actorenTotaal-->13<!--/getal--> |
| **beloftethema's** | <!--getal:ketenvorm.themasGedeeld-->2<!--/getal--> van <!--getal:ketenvorm.themasTotaal-->10<!--/getal--> |

**Geen enkele actornaam komt in alle ketens voor.** De tafel kent gast, zaak,
zaal en keuken; de rit kent lid, vervoerder, dispatch en chauffeur; de toelating
kent aanvrager, kantoor, keurder, dossier en tijd. Dat is dezelfde uitkomst als
`OBJECTMODEL.json` bij `Asset`: de domeinen delen hun rolbegrippen niet, en een
`Actor`-type eroverheen zou een woord zijn en geen betekenis. Het enige woord dat
twee ketens delen is `zaak`, en het betekent er niet hetzelfde.

**Wat ze wél delen gaat over de máchine en niet over het domein:** `herhaling`
(een tweede aanroep doet niets) en `weigeringMetReden` (een nee zegt waarom) in
alle drie; `volgorde`, `onbekendObject` en `nietsKlaarZonderGrond` in twee van de
drie.
Dat is exact de grens die OS.md trekt tussen **platformvermogen** en
**domeinvermogen** — en het is het eerste bewijs voor die grens dat uit
onafhankelijke ketens komt in plaats van uit een redenering.

De vier beloften die alleen de tafel heeft (`geldKlaargezet`, `bereikbareWeg`,
`dubbelObject`, `weigeringMetReden`) en de ene die alleen de rit heeft
(`nietsKlaarZonderGrond`) zijn geen gaten in de andere keten: ze zijn de
domeinhelft. Dat is bij de derde keten bevestigd: die bracht twee eigen thema's
mee (`handelingMetNaam`, `geslotenLijst`) die de andere twee niet kennen. Wat de
meting over zichzelf blijft zeggen: drie ketens van dezelfde hand kunnen ook
gedeelde gewoonte zijn in plaats van gedeelde vorm — daarvoor is een keten van
een ándere hand nodig, en die is er niet.

### 7.7 Wat deze ketens nog steeds niet bewijzen

Het zijn de **tafel**, de **rit** en de **toelating**: bezorging, hotel, club,
OV, vluchten en de ballotage van een LID hebben eigen naden. Er komt geen browser aan te pas, dus dit zegt niets over de
schermen. Aan tafel is het teruggaverecht een *recht* — dat het geld werkelijk
terugkomt loopt langs `kern/pay` en is niet gemeten. Bij de rit loopt de betaling
over de demo-rail; dat het geld bij de vervoerder landt is evenmin gemeten.

---

## 7b. Het anker — waar het blok heen gaat (U36)

**Dit stond in de tabel verkeerd, en dat is de eerste bevinding.** U36 heette
hier een *besluit* — "geen keten van afdrukken". Dat was niet zo. De hashketen
per journaal staat (`server/lib/keten.js`), de laag die kopafknipping kan zien
staat (`keten-anker.js`), en de dienst die de koppen van de vier journalen tot
één getekend blok maakt staat ook (`ankerdienst.js`), aangesloten in
`server/server.js` en `routes/office/toegang.js`. Een tabelregel die achterloopt
op de code stuurt het werk verkeerd; hij is bijgewerkt naar **staat**.

Wat er wél open was, stond in de code zelf uitgeschreven: `ankerdienst.js` zegt
dat hij níét bepaalt waar het blok heen gaat, want *"een anker dat deze software
zelf op dezelfde schijf wegschrijft is geen anker maar een tweede regel om te
wijzigen"*, en dat de bestemming *"een besluit over de infrastructuur"* is dat
bij een mens hoort.

**Dat besluit is genomen (3 september 2026, eigenaar): een tweede machine binnen
RTG.** `server/lib/ankerpost.js` is dat besluit in code, en vijf dingen liggen
er vast:

1. **Dezelfde schijf is geen bestemming.** `file:`, een pad, `localhost` en
   `127.0.0.1` worden geweigerd mét de reden — precies de vorm die de
   ankerdienst voorzag en niet wilde.
2. **Geen bestemming is niet in bedrijf.** Zonder `RTG_ANKERPOST_URL` doet de
   post niets en meldt hij dat. Fail-closed: hij maakt nooit van "niet gemeten"
   een "in orde", en de stand van de ankerdienst blijft zeggen wat zij al zei.
3. **Alleen bijschrijven.** De post kent één werkwoord richting de tweede
   machine. Kan deze kant daar iets weghalen, dan is het anker een sier.
4. **Wat terugkomt is invoer en geen waarheid.** Een teruggehaald blok gaat
   ongewijzigd naar `ankerdienst.reken()` en raakt geen enkel journaal aan; iets
   dat niet op een blok lijkt is een bevinding over de tweede machine en geen
   aanleiding om hier te repareren.
5. **Wat het niet bewijst, staat in elke stand.** Een tweede machine *binnen*
   RTG ziet kopafknipping door één hand. Wie beide machines bestuurt, knipt
   beide koppen af. Daarvoor is een partij buiten dit huis nodig, en dat is een
   tweede besluit dat niet is genomen — `stand()` noemt die grens elke keer mee,
   zodat niemand het anker voor meer aanziet dan het is.

Twee routes voeren het uit: `POST /api/office/anker/post` brengt het blok van nu
weg, `POST /api/office/anker/post/reken` rekent af met het blok dat op de tweede
machine *ligt* in plaats van met een blok dat iemand hier overtypt. Het verschil
is klein en het is het hele punt.

## 7c. De doorwerking van één gegeven (U10)

**Ook deze regel stond half verkeerd.** De tabel zei dat doorwerking over
domeinen "niet gebouwd en niet gemeten" was. Gebouwd was hij wél: het
zorgprofiel — allergenen, dieet, medische aandachtspunten — staat op één plek
(`db.data.zorgProfielen`, `kern/gastzorg.js`) en reist mee naar bestellingen,
ritten, tickets, bezorging, charter, autohuur, verblijven, tafelreserveringen,
zorgboekingen en de reisplanner. Dieet → reizen → evenement liep dus al.

Wat er niet was, is de **meting**, en die legde twee gaten bloot die je per
call-punt niet ziet omdat elk punt er los redelijk uitziet
(`scripts/doorwerking.js`, `DOORWERKING.json`):

| | vóór | na |
|---|---|---|
| lezers naar een derde | 15 | 12 |
| **naamloos** (geen zaak → geen regel in het inzagejournaal) | **14** | **0** |
| **bevroren** (kopie in opgeslagen data, zonder datum of bron) | **12** | **0** |

*Naamloos* betekende dat een lid nooit kon zien welke zaak zijn allergieën had
gelezen — precies het gat dat de kop van `gastzorg.js` zegt te hebben gedicht.
*Bevroren* betekende dat intrekken niet terugwerkte: haalt een lid morgen een
allergie weg of zet hij het delen uit, dan blijft de kopie in de bestelling
staan. Toestemming die niet terugwerkt, is geen toestemming.

**De scherpste vondst is het doorgeefluik.** Precies één plek noemde netjes een
zaak (`kern/avond/voorkeuren.js`), en één laag erboven stond
`zorgVoor: (k) => kern.zorgVoor(k)` — het tweede argument viel op de grond. De
enige lezer die het goed deed, was ontwapend door een wrapper. Dat is een fout
die geen enkele toets op één bestand ooit vindt.

**De reparatie is één bron met een projectie erop** (`kern/gastzorg-profiel.js`):

- `zorgMee(key, { zaak, reden })` — geeft **niets** terug zonder zaak, noteert in
  het inzagejournaal en stempelt de kopie met `op`, `bron` en `voor`. Een kopie
  zonder ontvanger is geen doorwerking maar een afdruk, en een afdruk is niet in
  te trekken.
- `zorgActueel(key, bewaard)` — zet de kopie naast de bron van nu. De bron wint
  altijd; de kopie zegt alleen nog wat er stond. Vier standen, en `ingetrokken`
  is met opzet iets anders dan `leeg`: het eerste is een besluit van het lid.

Wat er níét in staat: kopieën die al in de database stonden. Die dragen geen
datum, en `zorgActueel` zegt dat met zoveel woorden in plaats van te doen alsof.
En dit is **één** doorwerking, niet alle — dat staat als `nietGemeten` in het
register zelf.

## 7d. De objectpagina als samenstelling (U28)

De gemakkelijke uitvoering van "elke objectpagina draagt dezelfde structuur" is:
schrijf de tien secties op in ONTWERP.md en tel achteraf hoeveel schermen zich
eraan houden. Dat is een belofte met een meter erachter, en dit huis weet wat
daarmee gebeurt — PLATFORM.md par. 0: zeventien app-beschrijvingen beloofden
functies die geen route hadden.

**Daarom is de structuur geen afspraak maar een samenstelling**
(`server/kern/objectlaag/pagina.js`). Een scherm vraagt niet om een object en
tekent er tien blokken omheen; het vraagt om de **pagina**, en die komt terug met
alle tien secties in dezelfde volgorde, gevuld door **bijdragers** die zich per
soort aanmelden. Een capability die morgen iets nieuws weet over een bijeenkomst,
meldt zich aan als bijdrager en staat op élke eventpagina — zonder dat er één
scherm verandert. Dat is de reden dat dit op de objectlaag hangt en niet in de
vormtaal: die laag beantwoordde al de vraag *wat kan ik met dit ding*, en de
pagina is diezelfde vraag met negen andere ernaast.

**Vier dingen liggen vast:**

1. **Verbergen bestaat niet** (ADAPTIEF.md). Een sectie zonder inhoud verdwijnt
   niet. En `leeg` is met opzet iets anders dan `nietGevraagd`: het eerste is een
   feit over het object (er is een bijdrager, en die weet hier niets), het tweede
   een gat in het platform (niemand heeft zich voor deze soort aangemeld). Een
   structuur die haar eigen gaten wegvouwt, meet zichzelf nooit.
2. **Elke bijdrage draagt een bron en een bewijsgraad** (BESTUUR.md), met
   `onbekend` als veilige val — een bijdrager die niets over de hardheid zegt,
   krijgt geen graad cadeau.
3. **De pagina bezit niets**, net als de objectlaag eromheen: geen opslag, geen
   schrijffunctie, en de bijdragers krijgen alleen wat `object()` al teruggaf.
4. **De secties staan vast en zijn met tien.** Een elfde is geen uitbreiding maar
   het einde van de structuur; wie iets nieuws wil tonen, meldt een bijdrager aan
   in een bestaande sectie. `test/objectpagina.test.js` laat een verzonnen sectie
   knallen bij het aanmelden en niet pas op het scherm.

**De eerste lichting bijdragers is met opzet mager, en dat is de opbrengst.** Zij
lezen uitsluitend wat de objectlaag al teruggaf. Een eventpagina komt daardoor
terug met vier gevulde secties, één lege en **vijf `nietGevraagd`** — de eerste
eerlijke uitdraai van wat dit huis over een bijeenkomst kan zeggen. Geld,
documenten en bewijs staan er leeg bij, met de soort erbij, in plaats van weg te
zijn.

## 7e. Wat drie ketens delen (U40 en U41)

Twee ketens dragen geen contract: twee punten liggen altijd op een lijn. Daarom
is er een derde — `scripts/toelatingsproef.js`, de weg van een aanvraag naar een
toegelaten zaak in een gereguleerd genre. Hij is met opzet maximaal ánders
gekozen dan de twee voorgangers (dat was al de reden om de bezorging over te
slaan: die deelt de rekening, de kaart en de keuken met de tafel):

- **de klant is geen lid.** Een aanvrager heeft geen account, geen zaak en geen
  sessie — hij heeft alleen zijn aanvraagnummer. In de twee andere ketens had de
  klant altijd een sessie.
- **er zit een kantoor in**, en dus een mens van RTG die op naam tekent.
- **het gaat over een document met een houdbaarheid.** Schakel 7 is de enige
  schakel in de drie ketens die door **tijd** wordt getrokken en niet door een
  handeling: niemand doet iets, en toch verandert de stand.
- **de uitkomst is toegang**, geen geleverde dienst.

Zeven schakels sluiten, zeven storingen houden hun belofte.

**Het bouwen legde meteen een grens bloot die niemand had opgeschreven.** De
eerste ronde liep vast op schakel 4: aftekenen en beslissen eisen een naam (*"een
aftekening zonder naam is geen aftekening"*), en `boardroomWie()` geeft die
alleen als er een lid-account achter het kantoortoken hangt. Wie inlogt met de
**gedeelde kantoorcode** heeft geen naam, en dan staat de hele toelatingsketen
voor gereguleerde genres stil — netjes, met een goede melding, maar stil. Dat is
een grens en geen gat, en hij zit nu in de meting in plaats van eromheen: storing
1 en 7 meten precies dat geval, en de proef zet voor de keten zelf een mens
klaar zoals de ritproef een chauffeur klaarzet. Twee dingen die daarbij hoorden
op te vallen en in het register staan: de naam die in het dossier landt is een
**sleutel** (`user-1`) en geen mensennaam, en de weigering bij het besluit noemt
zelf de uitweg (*"log in met je eigen RTG-account"*).

### De uitslag

`scripts/ketenvorm.js` telt nu over drie registers (hij indexeerde op
`gelezen[0]` en `gelezen[1]`; een derde had daar stil niet meegeteld):

| | twee ketens | drie ketens |
|---|---|---|
| actoren gedeeld | 0 van 8 | **0 van 13** |
| beloftethema's in álle ketens | 3 van 8 | **2 van 10** (`herhaling`, `weigeringMetReden`) |
| in meer dan één, niet in alle | — | 3 (`volgorde`, `onbekendObject`, `nietsKlaarZonderGrond`) |

**Nul gedeelde actoren over drie domeinen.** Gast, keuken, zaal, zaak tegenover
lid, vervoerder, dispatch, chauffeur tegenover aanvrager, kantoor, keurder,
dossier, tijd. Er is één woord dat twee ketens delen — `zaak` — en het betekent
er niet hetzelfde: in de horecaketen is het de ontvanger die bedient, in de
toelatingsketen de **uitkomst** die ontstaat. Dezelfde naam, twee betekenissen;
precies de vorm die `SEMANTIEK.json` meet.

En alles wat de drie wél delen, gaat over de **machine** en niet over het
domein: mag dit twee keer, mag dit nu, en zegt een weigering waarom.
`test/toelatingsproef.test.js` toets 8 zakt zodra er een domeinbegrip in die
gedeelde lijst verschijnt — dan is er een echte vondst en hoort iemand te kijken.

### Wat dat betekent voor U40 en U41

Een **statuscontract, actorcontract en uitkomstcontract over domeinen heen is
niet gerechtvaardigd** door deze meting, en dat is een antwoord en geen
uitstel. Wat er wél onder ligt is een contract over de drie machine-eigenschappen
— dezelfde grens die OS.md trekt tussen platformvermogen en domeinvermogen, nu
met bewijs uit drie onafhankelijke ketens in plaats van twee.

**Eén eerlijkheid hoort erbij.** De themalijst van `ketenvorm.js` is één keer
uitgebreid, toen zes van de zeven beloften van de derde keten erbuiten vielen.
Dat is exact het moment waarop je een overlap kunt fabriceren. De regel die is
aangehouden staat in de bron: een patroon erbij mag alleen als de belofte
hetzelfde zegt in andere woorden, en de **actoren zijn niet aangeraakt** — die
staan op nul, en dat is de uitslag die telt. `test/toelatingsproef.test.js`
toets 5 houdt vast dat die uitleg blijft staan.

## 8. De volgorde

1. **Dit document** — welke uitspraak huisgrond heeft, welke wordt
   geprojecteerd, welke een besluit vraagt, welke bewijs mist. *Staat.*
2. **`scripts/doodspoor.js`** — de sterkste nieuwe regel meetbaar. *Staat als
   meting, en de triage is gedaan: 163 → 122 open, met twee standen erbij die de
   meter eerlijker maken (par. 3.3). Poort worden kan pas als de rest van "open"
   een betekenis heeft.*
3. **Het platformregister** krijgt alleen de actorgroep per functie, afgeleid
   uit de routes. *Stap weg.*
4. **Eén gouden horecaketen** als volledig verhaal, met verstoring. *Staat voor
   de tafel: elf schakels, acht storingen, `npm run tafelproef` — inclusief de
   correctie en het teruggaverecht (par. 7.3).*
5. **Uit die keten** de status-, actor- en uitkomstcontracten. *Volgt op 4. De
   tweede keten (par. 7.4) meet nu wat er te delen valt: geen actoren, wel drie
   beloften over de machine. Een actorcontract eroverheen zou dus een woord zijn
   en geen betekenis; een contract over herhaling, volgorde en bestaan heeft
   grond.*

Twee ketens liggen er nu. De horecaketen sluit volledig; de ritketen loopt door
met één uitgeschreven bevinding, en die bevinding is waardevoller dan een groene
regel zou zijn geweest — zij legde twee ritwerelden bloot die niets van elkaar
weten. Wat nog niet kan: `scripts/doodspoor.js` vindt 122 open handoffs, en de
gemeten overlap tussen de twee ketens is nul actoren. Een derde keten, van een
andere hand, zou uitwijzen of die drie gedeelde beloften een vorm zijn of een
gewoonte. Pas daarna verandert de claim opnieuw. Dan is *Verified Outcome Platform* niet
langer alleen een goede naam voor de architectuur, maar een door de code
aantoonbaar gedragen eigenschap van RTG.

---

## 9. Wat dit document niet is

- **Geen grondwet.** De grondwet staat verspreid over de diepte-documenten en
  wordt door hun toetsen gehandhaafd; dit document verwijst ernaar.
- **Geen bewijs van productie- of marktwerking.** Alles hierboven is gemeten
  met een browser, een proef en een register, en nergens met een klant.
- **Geen percentage.** De telling in par. 1 is een noemer over uitspraken, niet
  over werk of waarde. Wie er een voortgangsbalk van maakt, heeft LAT-regel 11
  gemist.
