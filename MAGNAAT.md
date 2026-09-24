# Magnaat — de grondwet

> **Hoe complexer Magnaat onder water wordt, hoe eenvoudiger het boven water moet voelen — en boven water mag niets staan wat onder water niet waar is.**

Dit document is normatief. Het zegt wat economische waarheid in Magnaat is, en per regel wie die afdwingt. `GAMEHALL.md` §12 beschrijft Magnaat als product en `MAGNAATLAB.md` beschrijft Magnaat als testhal. Dit document staat onder die twee: het zijn de regels waar elke nieuwe functie langs moet, en CI bewaakt dat.

Het regeldeel verderop wordt **niet met de hand bijgehouden**. `npm run magnaat:grondwet` leest de verklaring in `scripts/lib/magnaatgrondwet.js`. Van elke handhaver zoekt hij het citaat letterlijk op in de code, van elke toets de naam, en de schendingen telt hij zelf. `-- --document` schrijft het deel tussen de merktekens opnieuw. `test/magnaatgrondwet.test.js` zakt in drie gevallen: als dat deel achterloopt, als een citaat niet meer klopt, en als de stand achteruitgaat.

---

## 0. Waarom nu, en wat de meting vond

Op 24 september 2026 is voor het eerst nagemeten wat Magnaat economisch afdwingt, voordat er verder gebouwd wordt. De uitkomst was gunstiger dan hij klinkt.

**Er zijn twee economische motoren, en de goede zit in het verkeerde deel.**

- **World** (Quick en Campaign, `server/kern/spellen/magnaat/`) heeft **geen grootboek**. Een saldo wordt rechtstreeks gezet: `st.geld[h] += verdeeld.eigenaar`. Omzet uit gesimuleerde vraag, rente en boetes hebben geen tegenboeking. Of er geld uit het niets ontstaat, wordt achteraf gecontroleerd door de geldpompmeter. Die vergelijkt totalen binnen een ruismarge, en alleen voor de scenario's die erin geschreven zijn.
- **Het Oefenkantoor** (sinds ronde A1 `server/kern/magnaat-economische-motor/`, daarvoor één los bestand) heeft **strikt dubbel boekhouden**. Een journaalpost zonder idempotentiesleutel of met debet ≠ credit wordt geweigerd, en er is een motorversie. Precies dit deel gaat volgens het besluit hieronder uit Magnaat.

De bruikbare financiële kern bestaat dus al; alleen gebruikt het vlaggenschip hem niet. Daaruit volgt het belangrijkste besluit van dit document: **er komt geen tweede grootboek.**

## 1. Drie producten, één merk

| Product | Wat het is | Verwachting |
|---|---|---|
| **Magnaat Classic** | het bordspel met veertig velden, dobbelstenen en huizen (`bord.js`, `bordspel.js`) | een gezellige avond aan tafel, binnen een uur |
| **Magnaat World** | de economische simulatie: Quick, Campaign en Living World | een speelbare digitale economie |
| **Het Oefenkantoor** | leren werken met RTG-software op synthetische dossiers | expliciet leren: facturen, planning, dossiers |

Classic valt buiten de stichtingsregels. Het is een bordspel waarin de bank bij "langs Start" geld maakt, en dat hoort zo; een grootboek eisen van Monopoly-regels is een categoriefout. Het Oefenkantoor gaat uit Magnaat: het wordt een eigen product. Het verschil is fundamenteel. In het Oefenkantoor leer je een RTG-functie omdat de opdracht dat zegt. In World heb je die functie nodig omdat je economische probleem erom vraagt.

## 2. Het architectuurbesluit: één economische autoriteit

**Magnaat World krijgt precies één economische autoriteit.** Er komt dus geen grootboek voor Quick naast een voor Campaign naast een voor het Oefenkantoor.

De motor uit het Oefenkantoor (sinds A1 `kern/magnaat-economische-motor/`) wordt niet letterlijk "de game". Uit die motor wordt de economische waarheid gehaald, en die wordt een eigen kern. Daaromheen draaien World (Quick, Campaign, Living World) en het Oefenkantoor. **Het Oefenkantoor mag de kern gebruiken, maar is de kern niet.** Anders draait het vlaggenschip over twee jaar op een trainingsmodule.

**De naam is `economische-motor`** (ronde A1, 24 september 2026): `server/kern/magnaat-economische-motor/`. Gemeten vóór hij bestond: als identifier kwam hij nergens in de code voor, ook niet in `SEMANTIEK.json`; `kern`, `envelop`, `doel` en `SOORTEN` waren bezet. De module heet de economische motor, zijn rol in de architectuur is de **economische autoriteit**. In de grondwet is hij een eigen scope naast de producten: wat daar geldt, geldt voor elke consument die op hem draait.

**Een saldo is een projectie van waarheid, niet de waarheid zelf.** Spelcode verandert geen saldo meer. Ze vraagt de kern om een economische gebeurtenis:

```
Voornemen     VERKOOP
  → Toets     mag deze verkoop plaatsvinden?
  → Gebeurtenis   wat is er economisch gebeurd? (met een gebeurtenis-id)
  → Journaal  wie geeft en wie ontvangt wat? (debet = credit)
  → Projectie nieuw saldo, voorraad, bedrijfstoestand
  → Uitleg    wat ziet de speler, en wat mag Rahul verklaren?
```

Directe saldomutatie (`st.geld[h] += …`) wordt niet alleen weggehaald. Ze wordt **architectonisch onmogelijk**: de telling in M-001 en M-005 gaat naar nul, en daarna bewaakt een toets dat ze daar blijft.

**Rahul creëert nooit economische waarheid.** De server doet `WERELD → GEBEURTENIS → JOURNAAL → TOESTAND`; de AI doet `TOESTAND → UITLEG`, nooit andersom (M-007).

## 3. Hoe een regel eruitziet

Elke regel heeft per productvorm (scope) de volgende velden:

| Veld | Betekenis |
|---|---|
| ID | `M-001`; de negentien stichtingsregels houden hun nummer |
| Invariant | wat altijd waar moet zijn, in één zin |
| Scope | World / Economische motor / Oefenkantoor / Classic, alleen waar de regel vandaag geldt |
| Autoriteit | welk onderdeel de waarheid bezit |
| Handhaver | welke code hem afdwingt, als citaat dat letterlijk in de code staat |
| Toets | welke geautomatiseerde toets hem bewijst, op naam |
| Stand | PASS / PARTIAL / ABSENT / VIOLATION, **berekend**, nergens ingevuld |
| Migratie | wat er nog om moet |
| Faalwijze | wat er gebeurt als de regel breekt |

**NIEMAND is een geldige handhaver.** Het is de eerlijke stand van een regel die bedoeld is maar door niets wordt tegengehouden, en hij telt als ABSENT. Een document hoort niet te doen alsof iets veilig is omdat het de bedoeling is. Om dezelfde reden telt een citaat in commentaar niet: de meter haalt het commentaar weg voordat hij zoekt.

De stand wordt zo berekend:

- **VIOLATION**: er is minstens één schending geteld, wat er verder ook staat.
- **PASS**: handhaver én toets gevonden, niets geschonden, en geen reden waarom de scope maar deels gedekt is.
- **PARTIAL**: een van de twee gevonden, of allebei maar met een uitgeschreven `deels`.
- **ABSENT**: geen van beide.

Een regel krijgt de strengste stand van zijn scopes. PASS in de ene scope naast ABSENT in de andere is PARTIAL.

Daarnaast vier vragen die apart worden geteld en nooit opgeteld: **gedocumenteerd** (staat hier), **geïmplementeerd** (in minstens één scope staat een handhaver), **afgedwongen** (in elke scope een handhaver en nergens een schending) en **getoetst** (in elke scope een toets).

## 4. De families

De negentien stichtingsregels houden hun nummer. Nieuwe regels krijgen een nummer in hun familie, zodat Magnaat niet opnieuw één groot bestand met losse spelregels wordt.

| Familie | Naam | Waarover |
|---|---|---|
| M-0xx | Economische waarheid | geld, grootboek, eigendom, voorraad |
| M-1xx | Marktwaarheid | prijzen, vraag, aanbod, transacties, concurrentie |
| M-2xx | Mens- en werkwaarheid | tijd, arbeid, vaardigheden, beschikbaarheid |
| M-3xx | Informatiewaarheid | kennis, voorspellingen, onzekerheid, oorzaak |
| M-4xx | Wereldwaarheid | tijd, plaatsen, bevolking, voortgang zonder speler |
| M-5xx | Ondernemingswaarheid | bedrijven, contracten, belangen, insolventie |
| M-6xx | Simulatie-integriteit | seed, versie, herhaling, determinisme |
| M-7xx | AI-grens | wat Rahul wel en niet bepaalt |
| M-8xx | Spelzuiverheid | geen verborgen geldinjecties, geen rubber-banding, gelijke regels |
| M-9xx | Privacy en veiligheid | geen woonadressen, synthetische personen, scheiding echt/spel |

Het nummer van een stichtingsregel zegt niet in welke familie hij hoort; dat doet het veld `familie`. M-003 hoort bijvoorbeeld bij informatiewaarheid.

## 5. De ratel: integriteit kan alleen verbeteren

De huidige slechte toestand is geen CI-fout. Dan zou niemand kunnen migreren. De nulstand is **bevroren** in `MAGNAATGRONDWET.json` (`npm run magnaat:grondwet -- --vastleggen`, alleen op een schone boom), en vanaf dat moment geldt:

- het aantal **VIOLATION**-regels mag nooit stijgen, en het aantal getelde schendende plekken ook niet;
- het aantal **PASS**-regels en het aantal **afgedwongen** regels mag nooit dalen;
- **geen enkele regel mag afzakken** (PASS → PARTIAL, PARTIAL → ABSENT, alles → VIOLATION), en een regel mag niet verdwijnen;
- een citaat of toets die niet meer gevonden wordt, laat de toets zakken. De verklaring beweert dan iets wat niet waar is, en die moet worden rechtgezet in plaats van stil te verzwakken.

Achteruitgaan kan alleen door de nulstand opnieuw vast te leggen. Dat is een wijziging van `MAGNAATGRONDWET.json` die in de diff staat, met een reden in de commit: een **constitutionele wijziging**, geen ongeluk.

## 6. Wat deze meting niet bewijst

- **Graad: vermoed.** Handhavers en toetsen worden lexicaal gevonden. Dat een citaat in de code staat, bewijst niet dat het op elk pad zit. Dat een toets zo heet, bewijst niet dat hij groen is; dat beslist `npm test`, waar alle genoemde toetsen in draaien.
- **Een schending is een telling van een patroon**, en dus een ondergrens. Een regel waar geen patroon voor geschreven is, kan nooit VIOLATION zijn. Dat is de reden dat een ABSENT-regel niet "in orde" betekent.
- **De meter kent alleen de regels in de verklaring.** Een economische eigenschap die hier niet staat, bestaat voor hem niet.

## 7. Het traject

**MAGNAAT FINISH (besluit van de eigenaar, 24 september 2026).** De fundering is goed genoeg. Vanaf hier geldt een **harde scopebevriezing**: er komen geen nieuwe invarianten, subsystemen, macro-economische ideeën of onderzoeksfuncties bij, tenzij de migratie op een aantoonbare blocker stuit. Toekomstbestendig is niet hetzelfde als toekomstvolledig. Het doel is een speelbare Magnaat World 1.0:

| Ronde | Wat |
|---|---|
| **A2.2** | tegenpartijen, minimaal: alleen de vijf macro-actoren die nodig zijn om de 27 gebeurtenissen van de geldkaart sluitend te maken. Geen bankensimulatie en geen huishoudmodel |
| **A2.3–A2.9** | één migratieprogramma: de zeven categorieën van de geldkaart één voor één door het grootboek. Per categorie migreren, dan toetsen tegen de golden baseline, dan de volgende. Geen architectuurrondes ertussen |
| **A2.10** | de deur dicht: directe `st.geld`-mutaties op nul, en CI verbiedt voorgoed nieuwe. Daarmee is de financiële migratie af, en daarna zijn er geen A-nummers meer |
| **V1 From Zero** | één speelbare keten van persoon tot eerste onderneming: startpositie, werk, inkomen, tijd, kosten, software, eigen project, klant, offerte, onderhandeling, opdracht, uitvoering, factuur, te late betaling, geldnood, keuzes, gevolgen. Met de schermen Vandaag, Wereld, Werk, Geld, Netwerk en Mijn bedrijf (dat laatste pas wanneer je een onderneming hebt), en de Edge als bediening. RTG-functies verschijnen pas als ze relevant worden |
| **V2 Onderneming** | personeel, planning, leverancier, voorraad, kosten, verkoop, contracten en cashflow |
| **V3 Levende markt** | NPC-bedrijven, concurrentie, synthetische consumenten, vraag en aanbod, locatie, weer en seizoen |
| **V4 Game-afwerking** | onboarding, tempo, moeilijkheid, feedback, beeld en geluid, Edge-interacties, multiplayer, opslaan en hervatten, toegankelijkheid, mobiel, en of het leuk is. Spelers testen |
| **V5 Release hardening** | performance, gelijktijdigheid, crashherstel, exploits en valsspelen, reconnect, oude saves, rollback, belasting, security, geldinvarianten en volledige journeys. Daarna Magnaat World 1.0 |

Na 1.0 pas: de Observatory, een wetenschappelijke modus, individuele huishoudens, complexe banken, grote toeleveringsketens, macrobeleid, een onderzoekers-API en tientallen sectoren. Ook A3 t/m A6 hieronder (fysieke opslag per gebeurtenis, wereld- en versie-identiteit, herhaling, de Academy-scheiding) worden alleen opgepakt als een V-ronde erop vastloopt.

### De oorspronkelijke fundering (C en A)

| Ronde | Wat |
|---|---|
| **C0** | nulstand vastleggen als bewijs (`MAGNAATGRONDWET.json`) |
| **C1** | M-001 t/m M-019 formeel, met families |
| **C2** | machineleesbare verklaring en de meter (`npm run magnaat:grondwet`) |
| **C3** | de ratel (`test/magnaatgrondwet.test.js`) |
| A1 | de economische kern losmaken uit het Oefenkantoor, met een gemeten naam |
| A2 | World op de economische autoriteit: elke euro van Quick en Campaign via een commando met betekenis, geen directe `st.geld` meer |
| A3 | fysieke append-only opslag: een gebeurtenis per rij in plaats van een journaal als één waarde |
| A4 | wereld- en versie-identiteit: wereld-id, seed, regel-, motor- en datasetversie, aanmaakmoment |
| A5 | deterministische herhaling: een wereld opnieuw draaien vanaf zijn journaal |
| A6 | het Oefenkantoor scheiden: eigen product, gedeelde kern |
| V1–V4 | de eerste verticale plak: van een mens met € 63 en een baan, via de eerste klant, een factuur die te laat wordt betaald en geldnood, naar een eerste bedrijf |

Pas daarna komen bevolking, concurrenten die fouten maken, toeleveringsketens, banken en de levende stad. Pas daarna ook de nieuwe schermen, die uit de economische waarheid voortkomen: wie geen bedrijf heeft, krijgt geen tabblad "Bedrijf".

**Ronde C (C0–C3) en A1 staan.** A1 haalde de motor uit het Oefenkantoor zonder één cent gedragsverandering:

- **Gelijkwaardigheid bewezen tegen de oude motor.** Vóór de verhuizing is een gouden referentie geschreven uit de oude code (`test/fixtures/magnaat-economie-gouden.json`, drie scenario's, 267 stappen, 3676 boekingen). De nieuwe motor geeft bij elke stap dezelfde vingerafdruk van saldi, boekingen, antwoord en overzicht. Pas daarna is het oude bestand weggehaald.
- **De motor kent het Oefenkantoor niet.** Bedrijven, beginkas en teksten komen uit een profiel. Het economenlab haakt in via haken. Een missie komt binnen als economisch commando `verricht` (actor, activiteit, kwaliteit, eenheden, context), en welke spelvorm welke activiteit is, zegt het Oefenkantoor (`server/kern/magnaat-oefeneconomie.js`). Een toets leest de bron van de motor en zakt zodra die een bedrijfsnaam, een missie of het lab noemt, of iets anders laadt dan zichzelf, zijn Rust-client, de opslagdeclaratie en de klok.
- **Het journaal is gezaghebbend en wordt alleen aangevuld** (M-018): een eigen collectie `magnaatJournaal`, per wereld volgnummer 1, 2, 3 … zonder gat, sleutels en bevroren gebeurtenissen. De wereld draagt alleen de projectie: saldi, `laatstToegepast`, lopende totalen, een venster van 100 voor het scherm en de posten van vandaag. Een gebeurtenis draagt `wereld`, `volgnummer`, `soort` (wat er gebeurde), `oorzaak`, `regelVersie` en `motorVersie`, met de postings eronder.
- **10.000+ gebeurtenissen beproefd**: 700 dagen, 10.509 gebeurtenissen. De projectie is precies het journaal, geen gebeurtenis is weg, een gewone beslissing leest het journaal nul keer, en een herhaling vanaf volgnummer n geeft exact de saldi van nu.
- **Herstel**: loopt het journaal voor op de projectie, dan wordt alleen het ontbrekende stuk opnieuw toegepast. Loopt het achter, dan weigert de motor te boeken en zegt dat in het overzicht.
- **Een geweigerd besluit laat niets achter**: boekingen op een kopie gaan pas bij bevestigen het journaal in.
- **Een wereld van vóór A1** neemt zijn journaal mee. Wat de oude grens al had weggegooid, wordt als gat benoemd (`ontbrekend`) en niet verzonnen.

Wat A1 met opzet **niet** deed: World migreren (A2), opslag per gebeurtenis (A3) en een wereldkop met seed en datasetversie (A4). In deze opslag is een collectie één waarde, dus het journaal van een wereld wordt bij het wegschrijven nog in zijn geheel geserialiseerd. Dat is een eigenschap van de opslaglaag, geen gedrag van de motor, en archiveren kan later als opslagstrategie zonder de logische historie aan te raken.

**A2, stap 1: de inventaris staat, en World is nog niet aangeraakt.** Voordat er één regel van World verandert, heeft elke geldplek een economische betekenis en een tegenzijde gekregen. De kaart staat in `scripts/lib/magnaatgeldkaart.js`, en `test/magnaatgeldkaart.test.js` zoekt de plekken zelf opnieuw in de code: elke gevonden plek is precies een been van een gebeurtenis, en een nieuwe mutatie zonder classificatie laat de toets zakken. Wat de lezing opleverde:

- **36 plekken, 27 gebeurtenissen, 7 categorieën.** De 32 saldomutaties van M-001 plus 4 in de Foundation-pot, die de grondwetmeter niet ziet omdat ze geen `geld[...]` heten. Bij zes overdrachten staan betalen en ontvangen als twee losse mutaties in de code (vijf keer op twee regels, één keer op dezelfde regel), en één betaalbeen hoort bij twee verschillende gebeurtenissen (een kavel is een gronduitgifte, een vestiging een overname).
- **Eén regel verbergt acht gebeurtenissen.** `st.geld[h] += verdeeld.eigenaar` in `maand.js` is het saldo van omzet min inkoop, lonen, vaste lasten, huur, marketing en onderhoud. De meter telt er één; het zijn er acht. De migratie telt dus gebeurtenissen en geen regels.
- **Bij 18 van de 27 bestaat de tegenzijde niet.** Alleen overdrachten tussen spelers (contracten, aandelen, veiling) hebben twee benen. Bouwen, rente, aflossen, premie en schade laten geld verdwijnen; openen, lenen, sluiten, uitkeren en de Foundation-afdracht laten het ontstaan. Wie het ontvangt of betaalt, bestaat in World niet. De kaart noemt per geval een voorgestelde tegenpartij tussen haken (bank, aannemer, verzekeraar, huishoudens, arbeidsmarkt). Dat is een voorstel en nog geen besluit.
- **De Foundation-pot groeit uit het niets.** De afdracht wordt berekend over de omzet van de stad, maar van niemand afgetrokken.
- **Rood staan is geen lening maar een negatief saldo.** De rekening-courant bestaat alleen als `st.geld[h] < 0`.
- **World rekent in euro's met drijvende komma, de motor in hele eurocenten.** Resultaatdeling en rente op rood worden niet afgerond, en een contractbetaling wordt aan de ene kant wel en aan de andere kant niet afgerond. "Financieel gelijk" kan dus niet byte voor byte zijn; de toegestane afwijking wordt een besluit.
- **De motor moet eerst in tweeën.** A1 leverde de boekhoudautoriteit (commando, boekingen, journaal, projectie) samen met het marktmodel van het Oefenkantoor. World heeft een eigen marktmodel (`stap.js`) en hoort alleen de eerste helft te gebruiken. Die naad komt in A2 vóór de migratie.
- **De grondwetmeter meldde verschoven regelnummers.** Hij haalde commentaar weg en telde daarna de regels. Hij slaat het commentaar nu plat, zoals `scripts/lib/bron.js` daarvoor al een vorm had. De tellingen zijn gelijk gebleven; alleen de adressen kloppen nu.

**De vier besluiten van A2 (24 september 2026).**

1. **Eerst de afronding repareren.** Vóór de migratie komt een eigen stap die de oude afrondingen in World rechtzet: de contractbetaling (aan de ene kant afgerond, aan de andere niet), de resultaatdeling, de rente op rood en de Foundation-afdracht. World gaat daarbij over op hele eurocenten. Dat is een BEWUSTE gedragswijziging met een eigen regelversie. Daarna wordt een gouden referentie van World vastgelegd, en de migratie moet daar exact tegen gelijk blijven.
2. **Macro-actoren per wereld.** Elke wereld krijgt boekbare tegenpartijen: bank, huishoudens (klanten en loon), aannemer, verzekeraar en de stad (huur en grond). Er verdwijnt geen geld meer uit World en er ontstaat niets meer uit het niets. Voor de spelers blijft het financieel gelijk.
3. **De Foundation-afdracht wordt betaald door de stad en de spelers, via RTG naar de RTFoundation, zoals het buiten het spel bedoeld is.** De afdracht wordt dus een echte post naar rato van de omzet, en niet langer geld uit het niets. Ook dit is een bewuste regelwijziging met een eigen regelversie, apart van de pariteit. De opmerking dat RTG in het spel ook zijn big-tech-concurrenten heeft, staat als ontwerpvraag voor de latere ronden; A2 legt alleen vast wie betaalt.
4. **Het grootboek wordt een eigen laag onder de motor.** `magnaat-economische-motor/` splitst in een grootboek (commando's met betekenis, validatie, boekingen, journaal, projectie, herstel) en het marktmodel van het Oefenkantoor erbovenop. World en het Oefenkantoor worden allebei consumenten van het grootboek. De gouden referentie van A1 blijft daarbij ongewijzigd groen, en M-601 geldt voor beide lagen.

**Aanvullingen van de eigenaar op dezelfde dag.**

- **A2 bewijst één ding:** elke economische gebeurtenis in het bestaande World heeft na de migratie een volledige, reproduceerbare en boekhoudkundig sluitende betekenis. RTG wordt in A2 **geen** concurrerende economische speler. In de Foundation-afdracht is RTG alleen de route (stad en spelers → RTG → RTFoundation). Marktaandeel, prijzen, kostenstructuur en big-tech-concurrenten horen bij de marktlaag, na A2.
- **Binnen het grootboek bestaat geen geld met drijvende komma.** Zodra iets monetair wordt, is het een geheel aantal eurocenten. Een percentage of rente mag een decimale parameter zijn, maar het bedrag dat eruit volgt krijgt één expliciete afrondingsregel. Dezelfde gebeurtenis geeft aan beide kanten exact hetzelfde bedrag: nooit meer −€ 10,01 bij de betaler en +€ 10,00 bij de ontvanger.
- **Macro-actoren zijn echte synthetische actoren met een betekenis, geen sluitposten.** Een lening gaat van de bank naar de speler, bouwkosten van de speler naar de aannemer, een premie van de speler naar de verzekeraar en een schade-uitkering van de verzekeraar naar de speler. Ze krijgen een stabiele identiteit per wereld (`world:{id}:macro:bank` …), zodat een wereld nooit tegen de macrorekening van een andere wereld kan boeken.
- **Het grootboek kent alleen economische primitieven:** rekeningen, gebeurtenissen, boekingen, saldi, volgnummer en herhaling. Geen restaurants, toeristen, missies of marktvraag. De lagen worden: Magnaat World → World-economie → grootboek, en Academy-adapter → Academy-economie → grootboek.
- **A2.0 is met opzet saai:** geen nieuwe gameplay, geen macro-actoren, geen afrondingswijziging en geen World-migratie. Het bewijs is: A1 vóór de extractie = A1 na de extractie, op alle 267 gouden stappen. Als er één cent of één macrogetal verandert, is A2.0 niet klaar.
- **A2.1 is de enige toegestane geldgedragswijziging vóór de referentie.** Er komt een grenswaardetoets bij: € 0,00, € 0,01, een halve cent vóór afronding, negatieve waarden waar dat mag, zeer grote bedragen, percentages, rente over meerdere perioden en de contractbedragen die nu asymmetrisch afronden. Daarna wordt het moment expliciet gemarkeerd als **WORLD ECONOMIC GOLDEN BASELINE**. Vanaf dan mogen A2.2 t/m A2.9 de architectuur veranderen, maar de speluitkomst niet, op de vooraf goedgekeurde Foundation-regelwijziging na.
- **A2.10 draait de betekenis van de scanner om.** Hij blijft bestaan en wordt permanent `DIRECT_WORLD_MONEY_MUTATION = FORBIDDEN`. Nul is dan geen nulstand die later naar één kan kruipen, maar een grondwettelijke grens: bij één mutatie gaat CI op rood.

De stappen van A2 zijn daarmee: **A2.0** het grootboek losmaken (pariteit tegen de A1-referentie), **A2.1** de afronding in World repareren en daarna de gouden referentie van World vastleggen, **A2.2** de macro-actoren, **A2.3 t/m A2.9** de migratie per categorie, en **A2.10** de harde CI-fout zodra de teller op nul staat.

De migratievolgorde volgt de categorieën, zodat elke stap apart tegen het oude gedrag te bewijzen is: opening, overdrachten tussen spelers (tegenzijde bestaat al, laagste risico), financiering, verzekering, activa, maandresultaat (het grootste stuk) en de Foundation.

**A2.0 en A2.1 staan.** A2.0 maakte het grootboek een eigen laag onder de motor (`server/kern/magnaat-grootboek/`), zonder één cent gedragsverandering: de gouden referentie van A1 bleef op alle 267 stappen gelijk. A2.1 is de enige toegestane geldgedragswijziging van World, en hij is in vier stappen gelopen:

1. **World vastgelegd vóór de wijziging** (`test/fixtures/magnaat-world-voor-a21.json`). Twee scenario's, "gewoon" en "crisis", raken samen alle 27 gebeurtenissen van de geldkaart. Dat is **gemeten**: een teller op elk been telt wat er echt liep (`test/lib/magnaat-geldkaart-dekking.js`).
2. **Het grootboek rondt nooit af** (grondwetregel M-020). Het accepteert alleen gehele, niet-negatieve eurocenten en weigert de rest met de reden erbij: een breuk, NaN, Infinity, een negatief getal, 2^53, en ook de tekst `"1234"`. Afronden is domeinbeleid. De motor van het Oefenkantoor heeft zijn eigen afrondingsfunctie terug, en de A1-referentie bleef groen: hij gaf al alleen hele centen door.
3. **World rekent in hele eurocenten**, met één canonieke functie (`server/kern/spellen/magnaat/centen.js`). De afrondingsregel is rekenkundig, de helft van nul af, met een grens tegen binaire breuken (1,005 wordt 101 cent).
   - Wat geld **houdt of verplaatst** staat in centen: kassen, de Foundation-pot, het restant van een lening, betaalde rente en aflossing, contractbetalingen, boetes en afkopen, uitkeringen uit belangen, premies en polisuitkeringen.
   - **Afgesproken termen** blijven hele euro's, want die zijn al exact: een hoofdsom, een contractbedrag, een bod, een belangprijs. Ze worden pas geld als ze door `naarCenten` gaan.
   - **De buitenkant blijft in euro's**: wat een speler intikt en wat hij ziet.
   - **Een partij van vóór A2.1** wordt bij het laden één keer omgezet en krijgt `eenheid` en `regelversie` mee. Een tweede keer omzetten gebeurt niet. De lijst monetaire velden is dezelfde als die van de invariant-toets.
   - **`st.geld` heeft met opzet zijn naam gehouden.** Het patroon van M-001 kijkt naar `geld[...]`, dus een nieuwe naam zou de teller laten zakken zonder dat er iets is opgelost.
4. **De WORLD ECONOMIC GOLDEN BASELINE** staat in `test/fixtures/magnaat-world-baseline.json` (regelversie 2). A2.2 t/m A2.9 moeten daar stap voor stap exact aan gelijk blijven, op de vooraf goedgekeurde Foundation-regelwijziging na.

**Wat A2.1 veranderde, gemeten tegen World van ervoor:**
- Elke spelactie kreeg hetzelfde antwoord.
- De kassen schoven na 12 tot 15 maanden hooguit € 2. Het maandresultaat werd vroeger als geheel op hele euro's afgerond. Nu is het de som van **acht gebeurtenissen die elk één keer op centen worden afgerond**: verkoop, contractomzet en zes kostenposten. Dat is met opzet zo, zodat de acht losse boekingen van A2.8 exact hetzelfde resultaat geven als deze baseline. In de eerste versie van A2.1 werd het resultaat nog als één bedrag afgerond. Dat zou in A2.8 de baseline hebben gebroken, en is daarom vóór het bevriezen hersteld.
- **Een contractbetaling draagt aan beide kanten exact hetzelfde bedrag.** Vroeger rondde de leverancier over het totaal van zijn contracten af en betaalde elke afnemer zijn eigen, onafgeronde deel. De toets daarvoor controleert eerst of zijn eigen opstelling gevoelig genoeg is: één keer afronden over het totaal geeft er een andere cent dan afronden per contract. Anders zou hij alleen bij toeval kunnen zakken.
- **Een lening met minder dan één euro restant werd kwijtgescholden** (`if (l.restant < 1)`). In centen is dat hooguit één cent, dus in feite niets meer.
- De geldpomp-meter vindt de lekkende scenario's nu **exact op nul**. Voorheen stond daar een marge van 25 euro afrondingsruis.

**Vondsten die niet in A2.1 zijn opgelost:**
- Wie rood staat en een vestiging met een contract wil sluiten, krijgt de melding "afkopen kost 0", terwijl de reden de negatieve kas is.
- Omzet- en resultaattotalen en het resultatengeheugen van de bank zijn statistieken en geen geld. Die blijven euro's tot ze uit het grootboek worden afgeleid.
- De teller van M-001 en M-005 staat nog op 32. Dat is ook de bedoeling: A2.1 veranderde de precisie en niet de route. De teller zakt vanaf A2.3.

**A2.2 staat: de tegenpartijen, minimaal.** `server/kern/spellen/magnaat/boekhouding.js` voert de vijf tegenpartijen in, en verder niets:
- **bank**: krediet, aflossing en rente;
- **huishoudens**: klanten, loon, werving en afvloeiing;
- **aannemer**: bouwen, uitbreiden, herstel, terugkoop en projecten;
- **verzekeraar**: premie en uitkering;
- **stad**: de rest van de stadseconomie, dus huur, grond, inkoop, vaste lasten, marketing en onderhoud.

Elke rekening draagt de wereld in haar naam (`world:{id}:macro:bank`, `world:{id}:speler:{h}:kas`), dus twee werelden raken elkaar nooit. De geldkaart heeft geen voorstellen tussen haken meer: elke kant van elk van de 27 gebeurtenissen is een besloten partij uit een gesloten lijst, en bij de twee samengestelde gebeurtenissen heeft elk deel een eigen betaler en ontvanger (`test/magnaat-world-boekhouding.test.js`). World boekt er nog niets mee. Dat begint in A2.3, met de opening.

---

## 8. De regels

<!-- grondwet:begin -- gegenereerd door npm run magnaat:grondwet -- --document; niet met de hand wijzigen -->

### De stand per regel

| Regel | Familie | Stand | Gedocumenteerd | Geimplementeerd | Afgedwongen | Getoetst |
|---|---|---|---|---|---|---|
| M-001 | Economische waarheid | **VIOLATION** | ja | ja | nee | nee |
| M-002 | Mens- en werkwaarheid | **ABSENT** | ja | nee | nee | nee |
| M-003 | Informatiewaarheid | **PARTIAL** | ja | ja | ja | ja |
| M-004 | Economische waarheid | **PASS** | ja | ja | ja | ja |
| M-005 | Economische waarheid | **VIOLATION** | ja | ja | nee | nee |
| M-006 | Spelzuiverheid | **ABSENT** | ja | nee | nee | nee |
| M-007 | AI-grens | **ABSENT** | ja | nee | nee | nee |
| M-008 | Spelzuiverheid | **ABSENT** | ja | nee | nee | nee |
| M-009 | Privacy en veiligheid | **PARTIAL** | ja | ja | ja | nee |
| M-010 | Ondernemingswaarheid | **ABSENT** | ja | nee | nee | nee |
| M-011 | Ondernemingswaarheid | **PASS** | ja | ja | ja | ja |
| M-012 | Informatiewaarheid | **PARTIAL** | ja | ja | nee | nee |
| M-013 | Informatiewaarheid | **ABSENT** | ja | nee | nee | nee |
| M-014 | Wereldwaarheid | **PASS** | ja | ja | ja | ja |
| M-015 | Spelzuiverheid | **VIOLATION** | ja | ja | nee | nee |
| M-016 | Economische waarheid | **PASS** | ja | ja | ja | ja |
| M-017 | Simulatie-integriteit | **PARTIAL** | ja | ja | nee | nee |
| M-018 | Simulatie-integriteit | **PARTIAL** | ja | ja | nee | nee |
| M-019 | Simulatie-integriteit | **PARTIAL** | ja | ja | ja | ja |
| M-020 | Economische waarheid | **PASS** | ja | ja | ja | ja |
| M-601 | Simulatie-integriteit | **PASS** | ja | ja | ja | ja |

21 invarianten: 6 PASS, 6 PARTIAL, 6 ABSENT, 3 VIOLATION; 70 geteld schendende plekken.

### M-001: Economische waarheid

> Geld heeft altijd herkomst: elke verandering van een saldo is terug te voeren op een geboekte gebeurtenis.

Stand: **VIOLATION**

- **World**: VIOLATION
  - Autoriteit: geen: het saldo zelf (st.geld) is de waarheid
  - Handhaver: NIEMAND
  - Toets: NIEMAND
  - Schending: 32, een saldo dat rechtstreeks wordt gezet, verhoogd of verlaagd (st.geld[h] += ...), zonder journaalpost
- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/, het journaal
  - Handhaver: `server/kern/magnaat-grootboek/boeken.js`, `function boek(p, sleutel, soort, omschrijving, regels, labels = [])`
  - Toets: `test/magnaat-economie.test.js`, "de openingsbalans en iedere economische journaalpost zijn exact in balans"
- **Economische motor**: PASS
  - Autoriteit: het grootboek; de motor boekt alleen via zijn functies
  - Handhaver: `server/kern/magnaat-economische-motor/index.js`, `Object.assign(m, grootboek);`
  - Toets: `test/magnaat-grootboek.test.js`, "2. de motor boekt nergens buiten het grootboek om"
- **Oefenkantoor**: VIOLATION
  - Autoriteit: server/kern/magnaatwereld.js (spelerbudget)
  - Handhaver: NIEMAND
  - Toets: NIEMAND
  - Schending: 3, spelgeld dat als beloning wordt bijgeschreven buiten het grootboek van de motor om

**Migratie.** World gaat op de economische kern draaien (ronde A2/A4): een saldo wordt een projectie van het journaal. In het Oefenkantoor gaat de beloning via een journaalpost of verlaat hij het geldbegrip.

**Faalwijze.** Op de vraag "waar kwam deze 312 vandaan?" is geen antwoord; een fout in een spelregel maakt of vernietigt geld zonder spoor.

### M-002: Mens- en werkwaarheid

> Tijd kan niet dubbel worden besteed: een uur van een actor is op hetzelfde wereldmoment hooguit een keer ingezet.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: geen: er is geen urenmodel
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Economische motor**: ABSENT
  - Autoriteit: geen: er is geen urenmodel
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Een tijd- en capaciteitsboek in de kern (vertical slice V2); contractcapaciteit wordt bij het tekenen gereserveerd in plaats van achteraf naar rato verdeeld.

**Faalwijze.** Een speler levert aan drie klanten tegelijk met dezelfde uren; tekorten verschijnen pas bij afrekening, verdeeld over iedereen.

### M-003: Informatiewaarheid

> Geen actor bezit informatie die hij niet heeft verkregen: een beslissing gebruikt alleen wat die actor kan weten.

Stand: **PARTIAL**

- **World**: PARTIAL
  - Autoriteit: server/kern/spellen/magnaat/weergave.js
  - Handhaver: `server/kern/spellen/magnaat/weergave.js`, `geld: euroTonen(st.geld[mij] || 0),`; `server/kern/spellen/magnaat/weergave.js`, `return (st.contracten || []).filter(c => partij(c, h))`
  - Toets: `test/spelmagnaat.test.js`, "bij de economie zijn de boeken van een ander niet van jou"; `test/spelveiling.test.js`, "niemand ziet andermans bod, ook niet in de publieke of kijkerweergave"
  - Waarom hooguit PARTIAL: geldt voor wat SPELERS te zien krijgen; er zijn nog geen NPC-bedrijven, dus voor beslissende niet-spelers bestaat er geen informatiemodel

**Migratie.** Een informatiemotor: wat iedere actor weet is toestand, en een NPC beslist alleen daarop (M-3xx).

**Faalwijze.** Een tegenstander reageert op een prijs of kas die hij niet kan kennen; het spel voelt vals.

### M-004: Economische waarheid

> Voorraad kan niet negatief worden.

Stand: **PASS**

- **Economische motor**: PASS
  - Autoriteit: server/kern/magnaat-economische-motor/markt.js, de marktstap
  - Handhaver: `server/kern/magnaat-economische-motor/markt.js`, `Math.min(b.vraagVandaag, b.capaciteitVandaag, b.voorraad)`
  - Toets: `test/magnaat-economische-motor.test.js`, "5. 10.000+ gebeurtenissen: projectie klopt, journaal volledig, beslissen leest niet, herhaling gelijk"

**Migratie.** Een toets die verkopen tegen voorraad afzet (de bestaande toets draagt voorraad in zijn naam maar controleert alleen vraag en capaciteit); World krijgt voorraad pas met de kern.

**Faalwijze.** Er wordt verkocht wat er niet is; omzet zonder goederen.

### M-005: Economische waarheid

> Een transactie heeft minimaal twee economische zijden, en debet is gelijk aan credit.

Stand: **VIOLATION**

- **World**: VIOLATION
  - Autoriteit: geen: er is geen journaal
  - Handhaver: NIEMAND
  - Toets: NIEMAND
  - Schending: 32, een saldo dat rechtstreeks wordt gezet, verhoogd of verlaagd (st.geld[h] += ...), zonder journaalpost
- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/, het journaal
  - Handhaver: `server/kern/magnaat-grootboek/boeken.js`, `throw new Error('Ongebalanceerde journaalpost geweigerd: '`
  - Toets: `test/magnaat-economie.test.js`, "de openingsbalans en iedere economische journaalpost zijn exact in balans"; `test/magnaat-grootboek.test.js`, "3. een consument zonder dagen of bedrijven kan boeken, bevestigen, herstellen en verifieren"
- **Economische motor**: PASS
  - Autoriteit: het grootboek; de motor boekt alleen via zijn functies
  - Handhaver: `server/kern/magnaat-economische-motor/index.js`, `Object.assign(m, grootboek);`
  - Toets: `test/magnaat-grootboek.test.js`, "2. de motor boekt nergens buiten het grootboek om"

**Migratie.** Zelfde weg als M-001: World boekt via de kern. De geldpompmeter blijft ernaast staan tot de eigenschapstoetsen er zijn.

**Faalwijze.** Geld verschijnt of verdwijnt aan een kant; de totalen kloppen alleen nog binnen een ruismarge.

### M-006: Spelzuiverheid

> NPC-bedrijven en spelers vallen onder dezelfde economische kernregels.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: geen: er zijn geen NPC-bedrijven
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Economische motor**: ABSENT
  - Autoriteit: server/kern/magnaat-economische-motor/
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Een NPC is een actor in de kern met een eigen beslisser; de kern kent geen apart pad voor NPC's. Een toets zet een speler en een NPC in dezelfde situatie en eist dezelfde boekingen.

**Faalwijze.** NPC's krijgen stilletjes gratis krediet of voorraad; spelers verliezen van een tegenstander die niet echt concurreert.

### M-007: AI-grens

> AI mag economische toestand verklaren, nooit verzinnen.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: de motor; er zit vandaag geen model in Magnaat
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Oefenkantoor**: ABSENT
  - Autoriteit: de motor; uitleg is vaste tekst
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Zodra Rahul in Magnaat verschijnt: de AI krijgt alleen leestoegang op toestand (STATE -> UITLEG) en een toets eist dat geen AI-pad een boeking kan maken.

**Faalwijze.** "De AI besluit dat je 5 miljoen verdiend hebt."

### M-008: Spelzuiverheid

> Er bestaat geen verborgen score op een mens: elk cijfer over een speler is voor die speler zichtbaar met zijn opbouw.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: server/kern/spellen/magnaat/weergave.js (kredietprofiel)
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Oefenkantoor**: ABSENT
  - Autoriteit: server/kern/magnaatwereld.js (xp, reputatie)
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Een toets die elk veld over een speler in de staat afzet tegen wat die speler te zien krijgt.

**Faalwijze.** Een onzichtbaar getal bepaalt kansen, prijzen of tegenstanders.

### M-009: Privacy en veiligheid

> Geen woonadres is speelbaar bezit: alles met een woonfunctie valt uit de kaart.

Stand: **PARTIAL**

- **World**: PARTIAL
  - Autoriteit: scripts/kaart-import.js, de importeur van de kaart
  - Handhaver: `scripts/kaart-import.js`, `if (doelen.includes('woonfunctie')) return { weg: 'woonfunctie' };`
  - Toets: NIEMAND

**Migratie.** Een toets die een woonfunctie-object door de importeur haalt en eist dat het wegvalt.

**Faalwijze.** Iemands huis wordt een kavel in een spel.

### M-010: Ondernemingswaarheid

> Faillissement vernietigt geen geld zonder tegenpost; het is een proces en geen drempel.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: geen: failliet gaan bestaat in World niet, een negatief saldo kost rente
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Economische motor**: ABSENT
  - Autoriteit: geen: bij tekort volgt automatisch een noodlening (geldstromen.js)
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Een insolventieproces in de kern: liquiditeitsdruk, achterstand, herstructurering, afwikkeling -- elke stap geboekt, verliezen bij schuldeisers volgens de regels.

**Faalwijze.** Een bedrijf verdwijnt en neemt geld mee dat nergens meer staat, of het leeft eeuwig door op nooit aflopende noodleningen.

### M-011: Ondernemingswaarheid

> Een contractverplichting is tijdgebonden toestand: zij begint en eindigt op een wereldmoment.

Stand: **PASS**

- **World**: PASS
  - Autoriteit: server/kern/spellen/magnaat/handel-acties.js en maand-contracten.js
  - Handhaver: `server/kern/spellen/magnaat/handel-acties.js`, `c.eindMaand = st.maand + c.looptijd;`; `server/kern/spellen/magnaat/maand-contracten.js`, `if (st.maand + 1 >= c.eindMaand) c.status = 'afgelopen';`
  - Toets: `test/spelhandel.test.js`, "een contract kan niet langer lopen dan de campagne, en de rondes zijn eindig"; `test/spelhandel.test.js`, "de afkoopsom loopt nooit op tot meer dan de resterende looptijd"

**Migratie.** Contracten verhuizen mee naar de kern; hun begin en eind worden gebeurtenissen in het journaal.

**Faalwijze.** Een verplichting loopt eeuwig door of verdwijnt halverwege.

### M-012: Informatiewaarheid

> Een voorspelling is geen feit: een vooruitblik draagt een andere stand dan een uitkomst tot hij is gerealiseerd.

Stand: **PARTIAL**

- **Oefenkantoor**: PASS
  - Autoriteit: server/kern/magnaat-economenlab-training.js
  - Handhaver: `server/kern/magnaat-economenlab-training.js`, `status: 'wacht-op-realisatie'`
  - Toets: `test/magnaat-economenlab.test.js`, "de volgende dag ijkt de forecast en maakt de trainingsscore definitief"
- **World**: ABSENT
  - Autoriteit: geen: World kent nog geen vooruitblik
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Een vooruitblik in World wordt een eigen soort toestand naast het journaal, nooit een boeking.

**Faalwijze.** Een verwachting verschijnt als saldo; een speler plant op geld dat er niet is.

### M-013: Informatiewaarheid

> Correlatie is geen causaliteit: een uitleg noemt alleen oorzaken die de motor werkelijk heeft doorgerekend.

Stand: **ABSENT**

- **World**: ABSENT
  - Autoriteit: geen
  - Handhaver: NIEMAND
  - Toets: NIEMAND
- **Oefenkantoor**: ABSENT
  - Autoriteit: server/kern/magnaat-economenlab-rapport.js
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Elke uitleg verwijst naar gebeurtenis-id's uit de causale keten; een toets eist dat een genoemde oorzaak als gebeurtenis bestaat.

**Faalwijze.** De uitleg klinkt overtuigend en is verzonnen; een speler leert de verkeerde les.

### M-014: Wereldwaarheid

> Een speler die offline is, stopt de wereld niet.

Stand: **PASS**

- **World**: PASS
  - Autoriteit: server/kern/spellen/magnaat/economie.js, het bijrekenen op de klok
  - Handhaver: `server/kern/spellen/magnaat/economie.js`, `let stappen = Math.floor((nu - st.gerekendTot) / st.maandMs);`
  - Toets: `test/spelmagnaat.test.js`, "bijrekenen is deterministisch: tien maanden in een keer of tien los"

**Migratie.** Blijft; de klok verhuist mee naar de kern (Time Engine).

**Faalwijze.** Iedereen wacht op de traagste speler; een permanente wereld staat stil.

### M-015: Spelzuiverheid

> Spelbalans mag het grootboek nooit vervalsen: geen speler of spelregel maakt waarde uit het niets.

Stand: **VIOLATION**

- **World**: PARTIAL
  - Autoriteit: server/kern/spellen/magnaat/handel.js (prijsband) en scripts/magnaat-pomp.js
  - Handhaver: `server/kern/spellen/magnaat/handel.js`, `const PRIJSBAND = [0.4, 2.0];`; `scripts/magnaat-pomp.js`, `RUIS`
  - Toets: `test/spelhandel.test.js`, "geen enkel scenario van de geldpomp-keuring maakt waarde uit het niets"; `test/spelbank.test.js`, "geen van de zes financieringsroutes maakt waarde uit het niets"; `test/magnaat-rtgketen.test.js`, "2. geen enkel pompscenario maakt waarde uit het niets"
  - Waarom hooguit PARTIAL: de pompmeter kent alleen de scenario's die erin geschreven zijn, en vergelijkt totalen binnen een ruismarge; er is nog geen eigenschapstoets over willekeurige reeksen transacties
- **Oefenkantoor**: VIOLATION
  - Autoriteit: server/kern/magnaatwereld.js (spelerbudget)
  - Handhaver: NIEMAND
  - Toets: NIEMAND
  - Schending: 3, spelgeld dat als beloning wordt bijgeschreven buiten het grootboek van de motor om

**Migratie.** Eigenschapstoetsen over duizenden willekeurige transacties (debet = credit, geen onverklaarde creatie, geen dubbele gebeurtenis, herhaling geeft dezelfde eindstaat); de beloning in het Oefenkantoor gaat via het grootboek of verlaat het geldbegrip.

**Faalwijze.** Een volgorde van acties die de speler rijk maakt zonder dat iemand armer wordt.

### M-016: Economische waarheid

> Eigendom is exclusief: een bezit is op hetzelfde wereldmoment van hooguit een eigenaar en wordt niet tweemaal overgedragen.

Stand: **PASS**

- **World**: PASS
  - Autoriteit: server/kern/spellen/magnaat/veiling-acties.js en aandeel.js
  - Handhaver: `server/kern/spellen/magnaat/veiling-acties.js`, `return { status: 409, error: 'Dat kavel staat al in de veiling.' }`; `server/kern/spellen/magnaat/aandeel.js`, `const MAX_DEEL = 49;`
  - Toets: `test/spelveiling.test.js`, "een gewonnen kavel is van de winnaar, en van niemand anders"; `test/spelveiling.test.js`, "een kavel dat in de veiling staat is niet ondertussen te grijpen"; `test/spelaandeel.test.js`, "meer dan de helft van een zaak kun je niet weggeven"

**Migratie.** Eigendom wordt een register in de kern, met overdracht als geboekte gebeurtenis.

**Faalwijze.** Twee spelers bezitten hetzelfde kavel, of een aandeel wordt twee keer verkocht.

### M-017: Simulatie-integriteit

> Iedere economische mutatie heeft een gebeurtenisidentiteit: opnieuw verwerken levert geen tweede economisch resultaat op.

Stand: **PARTIAL**

- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/, de idempotentiesleutel in het journaal
  - Handhaver: `server/kern/magnaat-grootboek/boeken.js`, `if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');`; `server/kern/magnaat-grootboek/opslag.js`, `throw new Error('Journaal weigert: sleutel '`
  - Toets: `test/magnaat-economie.test.js`, "een herhaald commando verwerkt nooit tweemaal dezelfde economische dag"; `test/magnaat-economische-motor.test.js`, "9. dezelfde wereld en dezelfde handelingen geven dezelfde gebeurtenissen, id voor id"
- **World**: ABSENT
  - Autoriteit: geen: een spelactie draagt geen gebeurtenis-id
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Elke spelactie wordt een gebeurtenis met een id; ook voorraad, belangen, contracten, loon en eigendom (niet alleen geld).

**Faalwijze.** Een dubbelklik of een herstart na een storing boekt dezelfde verkoop twee keer.

### M-018: Simulatie-integriteit

> Historie is alleen aanvullen: een economische gebeurtenis wordt nooit achteraf herschreven of weggegooid, een correctie is een nieuwe gebeurtenis.

Stand: **PARTIAL**

- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/opslag.js, het journaal in de eigen collectie magnaatJournaal
  - Handhaver: `server/kern/magnaat-grootboek/opslag.js`, `throw new Error('Journaal weigert: volgnummer '`; `server/kern/magnaat-grootboek/opslag.js`, `Object.freeze(g);`
  - Toets: `test/magnaat-economische-motor.test.js`, "3. het journaal vult alleen aan: geen gat, geen dubbel, geen inkorten, niets herschrijven"; `test/magnaat-economische-motor.test.js`, "5. 10.000+ gebeurtenissen: projectie klopt, journaal volledig, beslissen leest niet, herhaling gelijk"
  - Schending: 0, een journaal dat korter wordt: een afkapping, een ringbuffer of een weggehaalde gebeurtenis
- **World**: ABSENT
  - Autoriteit: geen: er is geen gebeurtenishistorie, alleen maandverslagen
  - Handhaver: NIEMAND
  - Toets: NIEMAND

**Migratie.** Het journaal krijgt opslag die groeit (of een afgesloten periode met een openingsbalans die het verleden samenvat en bewaart), nooit een afkapping.

**Faalwijze.** Een herhaling vanaf het begin kan niet meer: de eerste boekingen zijn weg.

### M-019: Simulatie-integriteit

> Wereldregels zijn versiegebonden: een wereld draagt wereld-id, seed, regelversie, motorversie, datasetversie en aanmaakmoment.

Stand: **PARTIAL**

- **World**: PARTIAL
  - Autoriteit: server/kern/spellen/magnaat/economie.js
  - Handhaver: `server/kern/spellen/magnaat/economie.js`, `seed: 'magnaat-'+potje.id`
  - Toets: `test/spelmagnaat.test.js`, "bijrekenen is deterministisch: tien maanden in een keer of tien los"
  - Waarom hooguit PARTIAL: de seed volgt uit het potje-id, maar er wordt geen regel-, motor- of datasetversie bij de wereld bewaard
- **Grootboek**: PARTIAL
  - Autoriteit: server/kern/magnaat-grootboek/, elke gebeurtenis
  - Handhaver: `server/kern/magnaat-grootboek/boeken.js`, `wereld: g.wereld, volgnummer: p.boekVolgorde, soort, oorzaak,`; `server/kern/magnaat-grootboek/boeken.js`, `regelVersie: g.versies.regel, motorVersie: g.versies.motor,`
  - Toets: `test/magnaat-economie.test.js`, "dezelfde beginsituatie en besluiten geven reproduceerbaar dezelfde economie"; `test/magnaat-economische-motor.test.js`, "9. dezelfde wereld en dezelfde handelingen geven dezelfde gebeurtenissen, id voor id"
  - Waarom hooguit PARTIAL: elke gebeurtenis draagt wereld-id, volgnummer, regel- en motorversie; er is nog geen seed, datasetversie of aanmaakmoment als wereldkop (ronde A4)

**Migratie.** Een wereldkop in de kern met alle zes velden, vastgelegd bij het aanmaken en nooit meer gewijzigd.

**Faalwijze.** Een onderzoeker kan een wereld niet opnieuw draaien, of draait hem op andere regels zonder het te weten.

### M-020: Economische waarheid

> Geld is een geheel aantal eurocenten: het grootboek rondt nooit af en weigert elk ander bedrag, en een economische gebeurtenis wordt een keer afgerond voordat er geboekt wordt, zodat beide kanten exact hetzelfde bedrag dragen.

Stand: **PASS**

- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/geld.js
  - Handhaver: `server/kern/magnaat-grootboek/geld.js`, `if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {`
  - Toets: `test/magnaat-grootboek.test.js`, "5. het grootboek accepteert alleen gehele, niet-negatieve eurocenten en rondt nooit af"
- **World**: PASS
  - Autoriteit: server/kern/spellen/magnaat/centen.js, de ene plek waar World een bedrag tot geld maakt
  - Handhaver: `server/kern/spellen/magnaat/centen.js`, `const uit = Math.round(Number(cent.toFixed(6)));`; `server/kern/spellen/magnaat/maand-contracten.js`, `betaling[c.id] = naarCenten(H.afwikkelen(c,`
  - Toets: `test/magnaat-world-geld.test.js`, "4. na elke stap is elk monetair veld een geheel aantal eurocenten"; `test/magnaat-world-geld.test.js`, "5. een contractbetaling draagt aan beide kanten exact hetzelfde bedrag"

**Migratie.** Geen voor World en het grootboek: sinds ronde A2.1 rekent World in hele eurocenten en wordt een gebeurtenis een keer afgerond. Wat nog rest is dat World zijn geld nog niet via het grootboek boekt (A2.3 t/m A2.9).

**Faalwijze.** De betaler betaalt 10,01 en de ontvanger krijgt 10,00: een cent ontstaat of verdwijnt uit het niets.

### M-601: Simulatie-integriteit

> De economische motor kent geen consument en het grootboek kent geen domein: de afhankelijkheid loopt alleen van consument naar motor naar grootboek.

Stand: **PASS**

- **Economische motor**: PASS
  - Autoriteit: server/kern/magnaat-economische-motor/index.js: wat per wereld verschilt komt binnen via profiel en haken
  - Handhaver: `server/kern/magnaat-economische-motor/index.js`, `const m = { wereld, profiel, wereldState, opslag, save, haken,`; `server/kern/magnaat-economische-motor/index.js`, `keurProfiel(profiel);`
  - Toets: `test/magnaat-economische-motor.test.js`, "2. de motor kent het Oefenkantoor niet, en leunt er ook niet op"
  - Schending: 0, de motor noemt een consument (Oefenkantoor, Academy, missie, spelvorm) of laadt iets buiten zichzelf, het grootboek, zijn Rust-client, de opslagdeclaratie en de klok
- **Grootboek**: PASS
  - Autoriteit: server/kern/magnaat-grootboek/index.js: soorten, versies en periode komen van de consument
  - Handhaver: `server/kern/magnaat-grootboek/index.js`, `if (!soorten || typeof soorten !== 'object') throw new Error('Het grootboek vereist de lijst gebeurtenissoorten.');`
  - Toets: `test/magnaat-grootboek.test.js`, "1. het grootboek kent geen domein en laadt niets buiten zichzelf en de opslag"
  - Schending: 0, het grootboek noemt een domein (Oefenkantoor, markt, bedrijf, spel) of laadt iets buiten zichzelf en de opslagdeclaratie

**Migratie.** Geen: dit is de stand na ronde A1. Bij A2 komt World erbij als tweede consument, via de boekhoudkant van de motor en niet via het marktmodel van het Oefenkantoor.

**Faalwijze.** Een wijziging voor het Oefenkantoor verandert stil de economie van elke wereld die op de motor draait.

<!-- grondwet:eind -->
