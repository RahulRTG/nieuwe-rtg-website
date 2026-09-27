# RTG Autonomy Kernel

*Richtingsdocument. Per onderdeel staat er of het **staat**, **een stap weg** is,
**een besluit vraagt** of **jaren weg** is, dezelfde vorm als `PLATFORM.md`,
`ECONOMIE.md`, `INTELLIGENTIE.md` en `EXECUTIE.md`, zodat niemand die vier voor
elkaar aanziet.*

Geschreven op 25 september 2026, na de meting en niet ervoor. Elk getal hieronder
tussen merktekens komt uit `BEDRIJFSMAAT.json` en wordt door `npm run getallen`
bijgehouden; een getal zonder merkteken draagt zijn bron in de zin.

---

## 0. De lat

Niet *"AI runt RTG"*, maar:

> **RTG bestuurt zichzelf binnen een door mensen vastgestelde constitutie.**

De machine krijgt **initiatief, maar niet vanzelf gezag**. Hij hoeft niet op een
opdracht te wachten: hij neemt waar, ontdekt, onderzoekt, rekent, simuleert en
zet klaar. De mens bestuurt met grenzen en beslismomenten. De keten is die van
`INTELLIGENTIE.md` par. 0, hier toegepast op RTG als ONDERNEMING in plaats van op
een lid of een zaak:

```
gebeurtenissen -> waarnemen -> afwijking of kans -> onderzoeken -> hypothesen
  -> rekenen -> scenario's -> plan -> beleidscontrole -> mandaat
  -> tonen / klaarzetten / uitvoeren -> nameting -> menselijk goedgekeurd leren
```

Drie zinnen die het ontwerp dragen:

- **Een waarnemend brein is niet een portemonnee** (besluit C1).
- **Lenzen, geen breinen.** Finance, Growth, Product en de rest zijn verklaarde
  vragen over DEZELFDE werkelijkheid, zonder eigen opslag. Dertien breinen met
  elk een eigen module worden binnen een jaar dertien versies van RTG; dat is de
  `VERMOGENS`-botsing die `CAPABILITEIT.json` al 21 keer telt.
- **Autonome actie alleen als geen enkele dimensie van de streefstand buiten
  haar tolerantie verslechtert.** Een handeling die dimensies tegen elkaar
  uitruilt, gaat altijd naar een mens, met de uitruil zichtbaar. Er komt geen
  gewogen som (INT-04).

---

## 1. Wat gemeten is

De vraag *welke cijfers over RTG als onderneming bestaan* is eerst gemeten en
niet aangenomen: `npm run bedrijfsmaat` (`BEDRIJFSMAAT.json`, de catalogus in
`server/kern/bedrijfsmaat/`). Een maat BESTAAT pas als vier elementen
aantoonbaar zijn, elk als citaat dat letterlijk in de code moet staan (bij
gedrag zonder commentaar mee te lezen):

| element | vraag | gat als het ontbreekt |
|---|---|---|
| bron | wordt de werkelijkheid ergens geregistreerd? | `BRON_ONTBREEKT` |
| definitie | heeft RTG vastgelegd wat de maat betekent? | `DEFINITIE_ONTBREEKT` |
| projectie | is er code die hem uitrekent? | `PROJECTIE_ONTBREEKT` |
| bewijs | kan de uitkomst herkomst, graad of peilmoment tonen? | `BEWIJS_ONTBREEKT` |

De stand: <!--getal:bedrijfsmaat.maten-->67<!--/getal--> maten over de 28 domeinen van de eigenaar.
<!--getal:bedrijfsmaat.bestaat-->40<!--/getal--> bestaan, <!--getal:bedrijfsmaat.half-->19<!--/getal--> half en <!--getal:bedrijfsmaat.ontbreekt-->8<!--/getal--> ontbreken.
Van de bestaande zien er <!--getal:bedrijfsmaat.gedeeltelijk-->13<!--/getal--> een deel van de werkelijkheid niet
(`gedeeltelijk`, met de reden). <!--getal:bedrijfsmaat.ketensGegrond-->3<!--/getal--> van de zes ketens is gegrond, en er staan
<!--getal:bedrijfsmaat.privacyGaten-->0<!--/getal--> projecties over mensen zonder afgedwongen groepsgrens.

De eerste meting (commit `2820af35`) stond op 61 maten, 22 bestaand en 9
privacygaten. Het verschil is werk van dezelfde dag en staat hieronder.

**Een citaat dat niet klopt laat de controle zakken.** Dat verdiende zich direct
terug: de eerste catalogus citeerde een commentaarkop als projectie, een
`"stempel"` in een register dat geen stempel heeft, en zeven keer
`module.exports` -- wat alleen bewijst dat een bestand bestaat. Die laatste is
nu een vormregel.

---

## 2. De besluiten van 25 september 2026

### 2.1 De constitutie

- **C1, een waarnemende laag.** RTG en de RTFoundation mogen door dezelfde laag
  worden waargenomen; elke waarneming en elk voorstel houdt zijn economische
  wereld; `kern/economie/firewall.js` wordt niet omzeild of versoepeld;
  RTF-informatie leidt buiten haar wereld hoogstens tot een constatering of een
  voorstel. Afgedwongen: elke maat draagt precies een wereld uit
  `kern/economie/werelden.js`.
- **C2, het kantoor alleen op tonen.** `office` is een AI-rol op de bestaande
  trede `lezen`, met paden die gemeten niets schrijven en totalen tonen
  (`command/puls`, `economie/werelden`, `kosten/periode`, en sinds 27 september
  `office/bedrijfsmaat`, nadat de idempotentieproef hem als beschermd en zonder
  effect in de opslag mat). De ingang `/api/office/doe` eist een mens op naam,
  en er is met opzet geen `/doe/bevestig`.

Beide staan als gegevens in `server/kern/bedrijfsmaat/besluiten.js` en reizen mee
in het register. De formulering is door Claude opgeschreven en nog niet door een
mens nagelezen.

### 2.2 De definities

Uit uitgeschreven opties gekozen, en vastgelegd met een versie in
`server/kern/bedrijfsmaat/definities.js`:

| begrip | definitie |
|---|---|
| nieuw lid | de eerste pas boven gast |
| cohort | de ISO-week van nieuw lid |
| activatie | een geslaagde uitkomst binnen 30 dagen, in welke wereld ook |
| omzet | gefactureerd EN ontvangen, naast elkaar, zonder btw |
| churn | pas naar gast of contract GEEINDIGD, in de maand van ingang |
| afwaardering | een stap naar een lagere betaalde pas; geen churn |
| retentie | als waarde (een uitkomst) EN als aanwezigheid (een bezoekdag) |
| brutomarge | ontvangen omzet min de GEMETEN kostensoorten |

Twee drempels zijn een voorstel van Claude en nog niet bevestigd: het venster
van retentie als waarde (dag 30 tot 60) en de drempel van 30 dagen bij
aanwezigheid.

### 2.3 Privacy in de meter zelf

De groepspoort (`server/kern/bedrijfsmaat/poort.js`) staat aan de BRON van een
maat en niet in een scherm, want anders krijgt alles ervoor -- een model, een
lens, een export -- het precieze getal nog wel:

- onder de grens (leden, personeel en gezinnen 10, zaken 5) komt er
  `TE_KLEINE_GROEP` met de grens en de reden, en **geen waarde, geen nul en ook
  niet het aantal**;
- zonder groepsgrootte komt er niets (`GROEP_ONBEKEND`);
- bij een telling per categorie: vaste namen (pas, geslacht) houden hun naam met
  secundaire onderdrukking, want een enkele verborgen groep is terug te rekenen
  uit het totaal; namen die iets verraden (land, stad, werkgever) gaan samen op
  in "Overige".

Op besluit van de eigenaar geldt dat **ook op het kantoorscherm** (het
ledenregister, gebruikers per economische wereld, het transactievolume over
zaken). Werklijsten per persoon of per zaak -- kosten per drager, omzet per zaak
-- blijven voor een mens op naam, want dat zijn lijsten voor een handeling en geen
tellingen; ze komen niet op het kantoorstuur, en `test/stuur-kantoor.test.js`
houdt dat vast.

### 2.4 Twee nieuwe bronnen

- **De pasgeschiedenis** (`kern/pasgeschiedenis.js`): de accountlaag meldt elke
  overgang (`createUser`, `setTier`) aan een luisteraar; codenaam, van, naar en
  moment, zeven jaar bewaard.
- **De laatste bezoekdag** (`kern/aanwezigheid.js`): een dag per lid, aangeraakt
  naast de ledengids, dertien maanden bewaard.

### 2.5 De besluiten van 27 september 2026

Genomen door de eigenaar uit meerkeuzevragen; de opties en wat ze kosten stonden
erbij. Nog niet gebouwd, behalve waar het staat.

- **C3, klantwaarde per wereld: een uitkomst per wereld, vier maten naast
  elkaar en geen totaal.** LivingOS: een rit of bestelling afgerond. TravelOS:
  een reis die THUIS is -- een nieuwe stand in de reisketen, gezet door het
  kantoor of het lid, want vandaag stopt een reisaanvraag bij bevestigd.
  WorkOS: een loonrun die definitief is. FoundationOS: een casus afgerond --
  die krijgt daarvoor een tijdstip (`afgerondOp`), want vandaag staat dat alleen
  in het auditspoor.
- **C4, het banksaldo van RTG uit meer dan een bron.** Eerst handmatig, met het
  afschrift als herkomst en de graad `vermoed` (het patroon van de huisrekening
  in `kern/kosten`). Een bankkoppeling later, als eigen besluit met een contract.
  En **RTG gaat eigen cadeaubonnen verkopen**: geld van een verkochte bon staat
  op de bank maar is nog niet verdiend, dus telt het als cash EN als verplichting,
  zodat runway het niet als vrij geld leest. Let op wat dat raakt: een bon die
  tegen de nominale waarde inwisselbaar is, valt onder de e-geldvraag van
  `TOKEN.md` en de regels van `WAARDE.md` -- de bon zelf is dus een eigen
  bouwstuk met die vraag erbij, en tot hij bestaat staat zijn plek in het
  banksaldo op nul met die reden. De bonnen die ZAKEN vandaag verkopen blijven
  van die zaak; de firewall laat ze niet als RTG-geld tellen.
- **C5, van een betaalde pas naar gast langs drie wegen.** Het lid zelf, en hij
  kiest nu of aan het eind van zijn periode; het kantoor met de hand; en
  automatisch met drie regels (afgelopen, afgelopen plus wachttijd, onbetaalde
  termijnen), elk een schakelaar die standaard uit staat. Wat Claude daaronder
  legt en nog door de eigenaar moet worden bevestigd: een lid zonder vastgelegd
  contract (`GEEN_CONTRACT`) gaat nooit automatisch, bij `afgelopen` en `wacht`
  samen wint de zachtste, en facturen en bewijsstukken blijven na de overgang
  (`AFSPRAAK.md`: rechten hangen per capability, niet per account).
- **C6, het herkomstkanaal: een vraag bij aanmelding EN een campagnecode in de
  link.** Allebei optioneel, alleen geteld langs de groepspoort, nooit per lid
  zichtbaar, dertien maanden bewaard en weg bij vergetelheid.
- **C7, de streefstand: de machine stelt voor, de eigenaar tekent.** Een
  voorstel per dimensie met een tolerantie, uit de afgesloten maanden; het geldt
  pas na een handtekening, en zonder getekende streefstand gebeurt er niets
  autonoom (leeg is dicht).

---

## 3. De architectuur, onderdeel voor onderdeel

| laag | stand | waar het staat, of wat ontbreekt |
|---|---|---|
| Reality Register | **staat** | `server/kern/bedrijfsmaat/` + `BEDRIJFSMAAT.json`; de sensor rekent in `stand.js`, achter de boardroom |
| Schema/Event Register | **stap weg** | de bus staat (`kern/envelop.js`, acht velden); het schemaregister niet (`INTELLIGENTIE.md` par. 3.6) |
| Intelligence Router | **staat, in de schaduw** | `kern/ai/router.js`: regels, algoritme, optimalisatie, voorspelling, ai; de optimizer staat in `ONTBREEKT` |
| Model Registry | **stap weg** | `server/local-ai.js` kent een lokaal model; een register per rol (klein, redeneren, embedding, tijdreeks) bestaat niet. `RTG_EXTERNE_AI_UIT=1` sluit extern hard af |
| Lenzen | **besluit** | een lens is een verklaarde set vragen en maten over het register, zonder eigen opslag |
| Opportunity + Diagnosis | **stap weg** | `kern/command/oorzaak.js` (welk veld verklaart deze gevallen samen) voor techniek; voor bedrijfsmaten niet |
| Forecast | **staat voor kosten** | `kern/kosten/vooruitblik.js`: een band pas als de trefzekerheid over drie afgesloten maanden gemeten is |
| Causale inferentie, optimizer | **jaren weg** | geen constraint solver in dit huis |
| Digital Twin | **staat voor ops** | `kern/command/simulatie.js`; een tweeling van de bedrijfseconomie bestaat niet |
| Planner | **staat als kern** | `kern/stuur/plan.js`: voert niets uit, bezit niets |
| Independent Critic | **besluit** | de tegenproef krijgt ANDERE invoer (plan, beleid, ruwe cijfers), nooit de redenering; een critic op dezelfde invoer is een stempel (`KANTOORMACHT.md`) |
| Deterministic Verification | **staat** | `kern/command/transactie-poorten.js`: een controle die niet kon draaien is niet geslaagd |
| Policy + Streefstand + Mandate | **stap weg + besluit** | `kern/beleidsmotor/` in de schaduw, `kern/stuur/mandaat.js` zonder aanroepers; een streefstand met tolerantie per dimensie bestaat niet |
| tonen | **staat voor het kantoor** | C2: drie paden |
| klaarzetten, uitvoeren | **jaren weg** | 7 van de 118 AI-schrijfparen dragen een gemeten gevolg, een beproefde terugweg en een beschermde herhaling (`INTELLIGENTIE.md` par. 6) |
| Boardroom | **staat** | vraagt een identiteit; de enige plek waar een besluit vandaag een naam heeft |
| Decision Memory | **stap weg** | de vorm is er (`commercie/voornemen.js`, versies op de definities); het geheugen zelf niet |
| Nameting | **stap weg** | volgt uit het beslisgeheugen |
| Leren | **besluit genomen** | een leerregel promoveert pas na aftekening door een mens (`CODE.md` besluit 4) |

**De terugweg blijft het plafond.** Zolang het getal van 7 op 118 laag is, wordt
de machine briljant in waarnemen, analyseren, voorspellen en klaarzetten, en niet
kunstmatig sneller in uitvoeren. Pas als de terugwegen bewezen zijn, schuift het
gezag vanzelf op.

---

## 4. De ketens

Een conclusie over een keten is pas gegrond als elke schakel bestaat. Waar hij
breekt, is waar het verhaal ophoudt:

| keten | stand | eerste breuk, en wat er ontbreekt |
|---|---|---|
| service | **gegrond** | fout -> klokken -> opgelost zonder herhaling |
| afdracht | **gegrond** (27 september) | de maandbijdrage zegt nu zelf dat hij afgesproken is, gemeten, wanneer gepeild en wat hij niet dekt |
| funnel | **gegrond** (27 september) | nieuw lid, cohort, activatie, klantwaarde in LivingOS en aanwezigheid; de andere drie werelden hebben hun eigen klantwaardemaat ernaast |
| kosten | breekt bij `marge.per-lid` | kosten per drager bestaan, opbrengst per drager niet |
| geld | breekt bij `marge.operationeel-rtg` | de brutomarge en het banksaldo staan sinds 27 september; de vaste kosten van RTG als organisatie worden nergens geregistreerd |
| werving | breekt bij `campagnes.rtg-marketing` | RTG registreert geen eigen campagnes of uitgaven |

---

## 5. Wat de meting blootlegde

Dingen die geen bestaande toets zag, en die het ontwerp raken:

1. **Wat het kantoor "omzet" noemt, is transactievolume van zaken.** Dezelfde
   functie zegt dat RTG niets aan boekingen verdient.
2. **Er bestaat geen weg van een betaalde pas naar gast.** Een account krijgt
   zijn pas bij het aanmaken, `setTier` tilt alleen op, en een opgezegd contract
   laat de pas staan. Churn volgens de definitie kan vandaag niet voorkomen; de
   maat bestaat en zegt dat hardop.
3. **De ledenfacturen van RTG Pass-leden staan per lid versleuteld in de kluis.**
   De omzetmaten zien alleen de betaalschema's uit aanmeldingen; alles optellen
   is een leesweg naar de kluis, en dat is een besluit.
4. **`HERSTELPROEF.json` draagt geen stempel.** De terugwegen -- het plafond op
   autonomie -- hebben daardoor geen aantoonbaar peilmoment.
5. **Het kantoorscherm toonde tellingen van een.** Een stad met een lid, een pas
   met drie; en de omzet per pas verraadde het aantal via prijs maal aantal.
6. **RTG kent zijn eigen banksaldo niet.** Cash, liquiditeit en runway missen
   daardoor hun bron; het instrument bestaat wel, voor een ondernemer.

---

## 6. Wat niet mag sneuvelen

- **Geen zesde gezagsladder.** Observer, Adviseur en de rest zijn geen treden:
  de treden zijn `geen / tonen / klaarzetten / uitvoeren`, en *autonoom binnen
  mandaat* is een eigenschap van het mandaat (INT-01).
- **Geen samengesteld cijfer** over bedrijfsgezondheid, klantwaarde of kansen, en
  een schatting draagt de graad `vermoed` met haar opbouw (INT-04).
- **De runtime komt nooit aan de bron.** De catalogus staat in `server/`, de
  controle van de citaten in `scripts/` (CODE-AI-001).
- **Geld verlaat het huis nooit vanzelf**, en de firewall tussen de werelden gaat
  voor alles (C1, `GELD.md`, `ECONOMIE.md`).
- **Experimenten op leden zijn ongelijke behandeling.** Geen prijsexperiment op
  een lopend contract, niets op de RTFoundation of op minderjarigen, en nooit
  optimaliseren op aandacht -- alleen op een geslaagde uitkomst.

---

## 7. De volgorde

Van goedkoop naar duur. Bijgewerkt op 27 september 2026: wat staat, is
doorgestreept met de datum; de besluiten staan in par. 2.5.

1. ~~**`uitkomst.rit-afgerond` als projectie**~~ -- staat (27 september), langs de
   groepspoort, die leden telt en geen ritten.
2. ~~**Klantwaarde per wereld**~~ -- staat (27 september, C3): de reisstand `thuis`
   (`kern/reisbureau-thuis.js`, door het lid of het kantoor), `afgerondOp` op een
   casus, en vier maten naast elkaar in `kern/bedrijfsmaat/klantwaarde.js` -- elk
   met een eigen wereld en groepspoort, en geen totaal.
3. ~~**De brutomarge uitrekenen**~~ -- staat (27 september): ontvangen omzet min
   de gerekende gemeten kostensoorten; verbruik zonder tarief maakt haar
   `NIET_UIT_TE_REKENEN` in plaats van nul.
4. ~~**Een graad en peilmoment op de maandbijdrage**~~ -- staat (27 september); de
   afdrachtketen is gegrond.
5. ~~**De idempotentieproef over `/api/office/bedrijfsmaat`**~~ -- gemeten en op het
   kantoorstuur (27 september), zonder dat de onbekende effectpaden stegen. De
   verse ronde legde twee dingen bloot: veertien routes die het oude register
   niet kende (alle veertien kregen een besluit), en een proef die na de
   passkeyverharding van de incassoronde niet meer binnenkwam -- die krijgt nu een
   eigen medewerker met passkey (`scripts/lib/idempasskey.js`).
6. **Het banksaldo van RTG** -- besloten (C4). ~~De handmatige bron~~ staat (27
   september): `kern/bankpositie.js`, per maand met afschrift en afschriftdag,
   graad `vermoed`, en de plek voor eigen bonnen op nul met reden. Nog te doen: de
   bon zelf als eigen bouwstuk met de e-geldvraag, en liquiditeit en runway, die een
   register van de korte verplichtingen van RTG nodig hebben.
7. ~~**Een weg van een betaalde pas naar gast**~~ -- staat (27 september, C5):
   `kern/aanmeldingen/naargast.js`. Het lid kiest nu of aan het eind van zijn
   periode (zijn eigen opdracht, geen schakelaar), het kantoor op naam met een
   reden, en drie automatische regels (afgelopen, afgelopen plus wachttijd,
   onbetaalde termijnen) die standaard uit staan. Elke weg laat de sessies
   vervallen; facturen en betaalschema blijven. Churn kan nu voorkomen.
8. ~~**Een herkomstkanaal bij aanmelding**~~ -- staat grotendeels (27 september, C6):
   `kern/aanmeldkanaal.js` telt per maand, nooit per lid, en de campagnecode uit de
   link (`?c=`) reist mee. Nog niet: de vraag zelf in het aanmeldscherm (een
   keuzelijst is daar een nieuw bedieningselement), en CAC, dat wacht op een
   register van de marketinguitgaven van RTG.
9. ~~**De streefstand**~~ -- staat (27 september, C7), in de code het **streefbeeld**
   (`kern/streefbeeld.js`; `streefstand` was al een veld van elk gevolgcontract).
   Het voorstel komt uit de laatste drie afgesloten maanden, de eigenaar tekent een
   vingerafdruk van precies dat voorstel, en autonoom mag alleen als geen enkele
   dimensie buiten de tolerantie of onbekend is. Er handelt nog niets autonoom.
10. **Het beslisgeheugen** -- nadat 1 tot en met 9 er zijn, want een geheugen
    over besluiten zonder gegronde ketens onthoudt vooral gissingen.
