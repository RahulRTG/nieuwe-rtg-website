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
| U9 | Elke hoofdactie is omkeerbaar of compenseerbaar, en die twee worden nooit samengeteld | EXECUTIE.md blok 5 | `scripts/herstelproef.js`, `scripts/lib/herstelwereld.js` | proef zakt op een verdict zonder grond | 13 exact, 30 compensatie, 1 geen-herstel, 46 vragen een wereld | **staat** |
| U10 | Vraag een gegeven maar één keer, en hergebruik alleen met doel, toestemming, bron en actualiteit | LEVEN.md par. 2, LINK.md par. 3, `kern/consent-register.js` | kluis + codenamen; doelbinding per verlening | `scripts/afleidbaar.js` meet de afstand codenaam → identificator | doorwerking over domeinen (dieet → reizen → evenement) is niet gebouwd en niet gemeten | **besluit** |
| U11 | Eén werkelijkheid, meerdere perspectieven: consument, zaak, keuken, koerier, support en finance kijken naar hetzelfde object | HORECA.md: de rekening is één waarheid over alle kanalen | per domein; huisbreed geen meting | geen | alleen horeca, en daar gemeten | **stap weg** |
| U12 | Geen enkele actie eindigt in een dood spoor: elke handeling heeft een ontvanger, of een verklaring | par. 3 hieronder | `scripts/doodspoor.js`, `DOODSPOOR.json` | `npm run doodspoor:controle` zakt op een verlopen verklaring; de regel zelf is nog geen poort | <!--getal:doodspoor.bronroutes-->282<!--/getal--> bronroutes, <!--getal:doodspoor.open-->163<!--/getal--> open | **stap weg** |
| U13 | De interface toont de taak, niet de organisatie | TIKKEN.md, `shared/sprong.js` | resolver + sprong (handelingen uit de schermen zelf) | `scripts/vindbaar.js` | VINDBAAR.json | **staat** |
| U14 | Elke weigering, prijs of beperking is verklaarbaar in gewone taal, met de weg eromheen | ECONOMIE.md (firewall zegt hoe het wél kan), GRAMMATICA.md (een verhindering draagt een reden) | `kern/economie/firewall.js`, verhinderingen | toetsen per weigering | toetsen | **staat** |
| U15 | Elke niet-terminale toestand heeft een eigenaar, een volgende stap, een termijn en een verval | par. 4 hieronder | lokaal: `kern/commerce/retour.js` (vijf standen die zeggen welke partij ze zet) | geen | geen | **stap weg** |
| U16 | Falen is een normale producttoestand: leeg, laden, traag, gedeeltelijk, offline, conflict, fout, herstel, geannuleerd, betwist | ADAPTIEF.md (verbergen bestaat niet), `scripts/chaos.js` | achterkant: chaos en aanvalsbatterij; voorkant: per scherm en ongemeten | geen | geen, over 258 schermen | **jaren weg** |
| U17 | AI handelt binnen een mandaat met doel, objecten, acties, bedrag, duur, verval en stopvoorwaarden | CONTROLPLANE.md (vier dimensies), EXECUTIE.md blok 6 | `kern/stuur/mandaat.js`: versmalt alleen, leeg is dicht, hoogt geen niveau op | toetsen | toetsen | **staat** |
| U18 | Autonomieniveaus A0–A4 als eigen schaal | EXECUTIE.md: de noemer geen / tonen / klaarzetten / uitvoeren | `scripts/gezagsnoemer.js` | `test/gezagsnoemer.test.js` | noemer op 18 evident | **geprojecteerd** |
| U19 | A2 "veilige, omkeerbare acties zelfstandig uitvoeren" als platformwaarheid | FOUNDATION.md par. 2: geen `EXECUTE_LOW_RISK`, wie bouwt weet niet in wiens leven hij staat | `klein` bestaat in LivingOS en WorkOS; niet in FoundationOS | toetsen op de wereldgrens | per wereld anders | **geprojecteerd** |
| U20 | De gebruiker ziet vooraf wat er gaat gebeuren en achteraf wat er gebeurde, als verschil | EXECUTIE.md blok 4 | `kern/stuur/gevolg.js` projecteert een eerdere meting; geen droogloop in de zandbak | toets: `onbekend` en `geen-effect` lopen nooit door elkaar | 36 gemeten, 44 geen effect, 96 onbekend van 176 | **stap weg** |
| U21 | Eén canoniek objectmodel voor de volledige economie (Person … Asset … Vehicle … Room) | DEVELOPERCLOUD.md par. 2, OBJECTMODEL.json, COMMERCE.json | `scripts/objectmodel.js` | `test/objectmodel*.test.js` | `Asset` bestaat niet; 0 domeinen met alle acht werkwoorden | **geprojecteerd** |
| U22 | Elke overgang van een object is een benoemd commando met actor, voorwaarde, gegevens, beleid, bewijs en gevolg | MUTATIECONTRACT.md (semantiek per route) | `kern/mutatie.js`; geen statusmachine | `test/mutatiecontract*.test.js` op de classificatie | 1573 beproefd, 3156 ongemeten | **stap weg** |
| U23 | Negen perspectieven per productfamilie, beoordeeld en verklaard | par. 5 hieronder | `kern/platformregister/` kent functie, route, bewijs, scherm; geen actor | geen | geen | **stap weg** |
| U24 | De handoff-matrix tussen actoren wordt gemeten | par. 3 hieronder | `DOODSPOOR.json` veld `matrix` | toets 1 en 2 in `test/doodspoor.test.js` | gemeten, smalle lens | **staat** |
| U25 | Eén vaste mentale structuur: vind, kies, bevestig, volg, los op | GRAMMATICA.md: zeven zinnen, vijf gebaren met elk één betekenis | schilbalk, orb, gewichten | `test/ontwerp.test.js`, grammatica-toetsen | toetsen | **staat** |
| U26 | Eén shell met vijf vaste gebieden: Vandaag, Doen, Inbox, Ruimtes, Jij | WERELD.md: één beginscherm, de lege werktafel, geen voorgekookt werkblad | `vandaag.html`, Rahul in de schilbalk, werelden in de bank, bedieningspaneel in de voet | `test/wereldregister.test.js` | vier van de vijf bestaan als projectie | **geprojecteerd** |
| U27 | Een inbox: alles waarvoor deze actor nu ontvanger, eigenaar of beslisser is | par. 3 en 4: hangt aan het ontvangercontract en het statuscontract | niet gebouwd | geen | geen | **stap weg** |
| U28 | Elke objectpagina draagt dezelfde structuur: samenvatting, status, volgende actie, tijdlijn, betrokkenen, geld, documenten, bewijs, rechten, probleem oplossen | ONTWERP.md (Context Pane, Reference, Action Line) | per scherm | `test/ontwerp.test.js` op de vormtaal, niet op de objectstructuur | geen | **besluit** |
| U29 | Interactiesnelheid is een releasebudget (50 ms reactie, 400 ms warme weergave, 300 ms opdracht ontvangen) | KEURING.md; `scripts/tikken.js` draait al een echte browser | `scripts/prestaties.js` meet de motor, niet de interface | geen | geen | **stap weg** |
| U30 | Uitkomstsnelheid wordt gemeten: van bedoeling tot boeking, van klacht tot besluit, van verkoop tot afwikkeling | nergens | niets meet een doorlooptijd over actoren heen | geen | geen | **jaren weg** |
| U31 | Dezelfde opdracht twee keer versturen veroorzaakt niet twee bestellingen | MUTATIECONTRACT.md: 100% geclassificeerd, niet 100% idempotent | `IDEMPROEF.json`, `lib/idemsleutels.js` | toetsen op de classificatie | <!--getal:idem.beoordeeld-->1573<!--/getal--> beoordeeld | **staat** |
| U32 | Optimistische interface waar veilig, nooit bij geld: opdracht ontvangen → wordt bevestigd → voltooid | GELD.md: geld verlaat het huis nooit vanzelf; bewijsbord met drie standen en geen groen | `kern/pay/bewijs.js` | toetsen | toetsen | **staat** |
| U33 | Een organisatie start bijna zonder configuratie: per branche een veilige standaard, en de klant past alleen afwijkingen aan | PLATFORM.md par. 5: veertig sectormotoren is jaren werk; TENANT.md levenscyclus | 73 genres met werkvormen; geen branchestandaard als voorstel | geen | geen | **jaren weg** |
| U34 | De organisatie is een digitale tweeling die voorspelt ("71% kan automatisch worden verplaatst") | BESTUUR.md: nooit een getal waar geen meting is; KOSTEN.md: bandbreedte pas na drie gemeten maanden | `kern/kosten/vooruitblik.js` (trefzekerheid meet zichzelf), gevolgsimulatie in TENANT met `nietGerekend` | toetsen | per voorspelling een graad | **geprojecteerd** |
| U35 | Eén identiteit, meerdere contexten; rechten zijn relationeel, tijdelijk, bedrag- en objectgebonden | CONTROLPLANE.md (wat, waar, hoeveel, wanneer; delegatie versmalt), BESTUUR.md (toegang is een uitnodiging) | `kern/bevoegdheid/`, `kern/stuur/mandaat.js`, `sociaal/pin-deur.js` | `scripts/capabilityroepers.js` | CAPABILITEIT.json | **staat** |
| U36 | De audit is cryptografisch tegen stille wijziging beschermd | OS.md: de envelop; PROOF.md | `kern/envelop.js` draagt actor en oorzaak; geen keten van afdrukken | geen | geen | **besluit** |
| U37 | Alle geld gaat door één ledger, dubbel geboekt; een correctie is een nieuwe boeking en nooit geschiedenis herschrijven | WAARDE.md, GELD.md: geen tweede boekhouding | `kern/pay/poort.js`, `kern/waarde/` | check.js regel 62 en 63 (een domein raakt opslag alleen door zijn eigen deur) | toetsen | **staat** |
| U38 | RTG Grade 0–5 als productscore | LAT-regel 11, `scripts/check.js` regel 48: bewijsgroen is geen go-live-groen; BEWIJSMACHINE.md | `scripts/zekerheid.js` | regel 48 zakt zodra de go-live-keuring een bewijsregister leest | — | **geprojecteerd** |
| U39 | Harde poorten die nooit compenseerbaar zijn: ledger, audit, herstel, toegankelijkheid, prestatie, actor-compleetheid, dood spoor, uitstap | KEURING.md, TOEGANKELIJK.md, TENANT.md (uitgang) | `scripts/check.js` (64 regels), a11y-poorten, `kern/tenant/uitgang.js` | bestaand: ja; dood spoor en actor: nog niet | per poort | **stap weg** |
| U40 | Elk product draagt een machineleesbaar contract (PRODUCT-360) dat in de toetsing meeloopt | PLATFORM.md par. 0: vier apps, en wat technisch nog losse pagina's zijn; EXECUTION_MAP.json is een projectie per route | per route: ja; per product: de eenheid "product" is niet vastgesteld | `npm run executionmap` zakt op handwerk | — | **besluit** |
| U41 | Elke capability draagt een contract: objecten, commando's, events, rechten, fouten, herstel, SLO, gebruikers, toetsen | OS.md par. 4; `kern/appstore/machtigingen.js` is het enige bestand met doel én grens | 21 capability-lijsten met 250 leden | `scripts/capabilityroepers.js` | CAPABILITEIT.json | **besluit** |
| U42 | Een journey wordt als volledig verhaal over actoren heen getest, inclusief verstoring, herhaling en herstel | par. 7 hieronder | `scripts/lib/herstelwereld.js` en `idemwereld.js` als bouwstenen | geen | geen keten bewezen | **stap weg** |
| U43 | Het register koppelt product, actor, bedoeling, journey, capability, object, route, event, beleid, bewijs, scherm, toets, prestatie en herstelpad | `kern/platformregister/` | functie ↔ routes ↔ bewijs ↔ scherm | check.js regel 64 | — | **stap weg** |
| U44 | Volgorde: eerst de gedeelde grond, dan drie gouden ketens (mobiliteit, horeca, werk), dan de families | EXECUTIE.md par. 7: één bewezen keten vóór honderd functies | besloten 3 september 2026: horeca eerst (par. 7) | — | — | **staat** |
| U45 | De repo verhuist naar /products, /domains, /capabilities, /trust | 415 kerndomeinen in `server/kern`; EXECUTION_MAP is een projectie | een gegenereerde leesweergave kan; een fysieke verhuizing niet | — | — | **geprojecteerd** |
| U46 | De doctrine komt letterlijk in PLATFORM.md | dit document | MAATSTAF projecteert; PLATFORM.md houdt de vier-productregel | — | — | **geprojecteerd** |

Geteld uit de tabel: 46 uitspraken -- staat 17, stap weg 11, besluit 5, jaren weg 4, geprojecteerd 9.

Wat die telling níét zegt: dat RTG voor 17/46 klaar is. De rijen wegen niet
gelijk. U8 alleen (bewijs dat routes verschillend laat handelen) is meer werk
dan de zeventien die staan bij elkaar, en zonder U8 houdt U7 niets tegen. Het
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
aanraakte; een ontvanger is een route van een *andere* groep die diezelfde
collectie aanraakt (**gesloten**, gemeten) of leest (**gezien**, vermoed uit de
brontekst, of **aangewezen** door een mens en getoetst tegen de proef). Een
collectie die per definitie van één mens is, staat in `EIGEN` met een reden;
infrastructuur die elke aanroep raakt (sessies, idempotentiesleutels) staat in
`INFRA` en telt niet mee.

De eerste ronde, 3 september 2026:

| | |
|---|---|
| bronroutes met gemeten werk | <!--getal:doodspoor.bronroutes-->282<!--/getal--> |
| gesloten (gemeten) | <!--getal:doodspoor.gesloten-->65<!--/getal--> |
| gezien (vermoed of aangewezen) | <!--getal:doodspoor.gezien-->49<!--/getal--> |
| eigen (verklaard) | <!--getal:doodspoor.eigen-->5<!--/getal--> |
| open | <!--getal:doodspoor.open-->163<!--/getal--> |
| collecties met minstens één open bronroute | <!--getal:doodspoor.openCollecties-->121<!--/getal--> |
| routes die in de proef geen werk deden en dus buiten de meting vallen | <!--getal:doodspoor.nietGemeten-->3123<!--/getal--> |

De matrix (bron → ontvanger, gesloten relaties per collectie) staat in
DOODSPOOR.json. Wat hij laat zien: consument → aanbieder en aanbieder →
consument zijn de dikste lijnen, kantoor is als ontvanger dunner, en de
platformrij is nul in beide richtingen. Die laatste nul is geen bevinding over
het platform maar over de lens: platformroutes (techniek, scim) doen in de proef
geen werk op zaakcollecties.

### 3.3 Wat "open" hier betekent, en wat niet

**Open is een triagelijst en geen beschuldiging.** Drie dingen lopen erin door
elkaar, en de tweede ronde moet ze uit elkaar halen:

1. **Een echt dood spoor.** Een lid doet iets waar een zaak op zou moeten
   reageren, en geen route van die zaak raakt het object aan.
2. **Een ontvanger die de lens niet ziet.** De lezer-index volgt `require`, en
   dit huis geeft zijn kernmodules via een context door. Gemeten:
   `routes/office/concierge.js` bereikt `data.lifestyle` op geen enkele
   diepte, terwijl het conciërgebureau die vragen wél leest. Daarvoor bestaat
   `ONTVANGER`: een mens wijst de route aan, en de meter toetst dat die route
   bestaat, in een andere groep zit en in de proef werk deed. Een aanwijzing die
   de meter later zelf ziet, is verlopen en laat de naloop zakken.
3. **Een object zonder tweede partij** dat nog niet in `EIGEN` staat. De
   kantoorroutes op `zelfzorg` zijn zo: het kantoor onderhoudt iets van zichzelf.

Wat de meter principieel niet ziet, staat in zijn uitslag onder `grens`: een
ontvanger die niet via een collectie loopt (mail, sms, webhook), routes die in de
proef geen werk deden, en eigenaar, termijn en verval van een stand (par. 4).

**Daarom is dit een meting en geen poort.** Pas als "open" schoon is, mag de
regel hard worden: dan zakt de bouw op een onverklaarde open handoff, en niet
eerder. Een poort op een lijst met drie betekenissen dwingt mensen tot
verklaringen die niets verklaren.

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

## 7. De eerste gouden keten: horeca — **niet gebouwd, wel gekozen**

De doctrine wil drie gouden ecosystemen (mobiliteit, horeca, werk). Horeca gaat
eerst, omdat daar de meeste ketenwaarheid al staat: de rekening is één waarheid
over alle kanalen, de retour kent standen die zeggen wie ze zet, en de stoel —
in HORECA.md ooit het ontbrekende scharnier — bleek al te bestaan als
`deelnemer.nr` ↔ `regel.gastNr`, met `kern/horeca/gezelschap.js` als tweede
deur. Let op het verschil met EXECUTIE.md par. 7: die keten (*bereid een
standaard inkoopbestelling voor*, vier routes) bewijst een **autonome
AI-keten**; deze bewijst een **actorketen**. Het zijn twee vragen, en de tweede
vraagt geen AI.

Niet "heel horeca" is de journey, maar één gesloten verhaal:

```
gast wordt aan stoel, tafel en gezelschap gekoppeld
→ bestelling ontstaat vanuit een kanaal (QR, gastvrouw, PDA)
→ de rekening blijft één over de betrokken kanalen
→ keuken ontvangt een uitvoerbare productieopdracht
→ een medewerker zet toestand en bewijs
→ uitgifte wordt bevestigd
→ betaling loopt via de ene poort
→ gast meldt één ontbrekend onderdeel
→ de retourzaak krijgt eigenaar en volgende stap
→ gedeeltelijke teruggave maakt compensatieboekingen
→ creditnota en zaakpositie sluiten
→ elke actorprojectie toont dezelfde kernwerkelijkheid
→ audit en bewijs sluiten
```

Met minstens één verstoring per ronde: een dubbele opdracht, een keuken die niet
reageert, een artikel dat niet beschikbaar blijkt, een betaling die wel
geautoriseerd maar niet afgerekend is, een uitgifteclaim met verzwakt bewijs, een
teruggavetermijn die verloopt zonder behandelaar.

Wat die ene keten dan aantoont: geen dood spoor (par. 3 als poort, voor deze
keten), elke toestand heeft een eigenaar (par. 4, eerste vorm), elke actor ziet
zijn bevoegde perspectief (par. 5), geld wordt niet dubbel bijgehouden, herstel
is exact of compenserend, bewijs beïnvloedt werkelijk de route, herhaling maakt
geen tweede transactie, en de einduitkomst is over de hele keten aantoonbaar.
Uit die echte keten volgen de precieze status-, actor- en uitkomstcontracten.
Niet andersom: een contract dat vóór de keten wordt geschreven, brengt alsnog
R0–R5 of een universele objectnaam als nieuwe waarheid binnen.

De bouwstenen bestaan: `scripts/lib/herstelwereld.js` zet een wereld op, laat
een onderwerp langs de gewone route ontstaan en draait drie sessies met de rol
uit IDEMPROEF.json. Wat ontbreekt is de keten zelf als proef, en `test/…` die
zakt zodra één schakel een andere waarheid toont dan de vorige.

---

## 8. De volgorde

1. **Dit document** — welke uitspraak huisgrond heeft, welke wordt
   geprojecteerd, welke een besluit vraagt, welke bewijs mist. *Staat.*
2. **`scripts/doodspoor.js`** — de sterkste nieuwe regel meetbaar. *Staat als
   meting; de triage van de open lijst is de volgende ronde.*
3. **Het platformregister** krijgt alleen de actorgroep per functie, afgeleid
   uit de routes. *Stap weg.*
4. **Eén gouden horecaketen** als volledig verhaal, met verstoring. *Niet
   gebouwd.*
5. **Uit die keten** de status-, actor- en uitkomstcontracten. *Volgt op 4.*

Zodra één horecajourney volledig sluit en `scripts/doodspoor.js` geen
onverklaarde primaire dode sporen meer vindt, verandert de claim opnieuw. Dan is
*Verified Outcome Platform* niet langer alleen een goede naam voor de
architectuur, maar een door de code aantoonbaar gedragen eigenschap van RTG.

---

## 9. Wat dit document niet is

- **Geen grondwet.** De grondwet staat verspreid over de diepte-documenten en
  wordt door hun toetsen gehandhaafd; dit document verwijst ernaar.
- **Geen bewijs van productie- of marktwerking.** Alles hierboven is gemeten
  met een browser, een proef en een register, en nergens met een klant.
- **Geen percentage.** De telling in par. 1 is een noemer over uitspraken, niet
  over werk of waarde. Wie er een voortgangsbalk van maakt, heeft LAT-regel 11
  gemist.
