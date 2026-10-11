# Vakantietoets — het juridische toetsingsdossier van de rekenregel voor vakantierecht

*Een dossier voor een bevoegde menselijke beoordelaar (arbeidsjurist). Opgesteld
op 11 oktober 2026 op besluit 4A van de eigenaar. Het hoort bij `VRIJHEID.md`
par. 6a, waar de regel en de poort zijn besloten (B1).*

**Dit dossier bevat geen juridisch oordeel.** Het zegt wat de CODE doet, op welke
plek, onder welke aannames, en met welke uitkomst op concrete invoer. Of dat de
juiste lezing van de wet is, beslist de beoordelaar. RTG doet niet alsof.

**De productiepoort is gesloten** en blijft dat tot deze toets is afgerond en de
eigenaar hem volgens par. 6 heeft geopend. Dit dossier opent niets.

**REGELVERSIE:** `vr1-592c0b88f002`

**Getoetste bron** (de eerste zestien tekens van de sha256 van het bestand; zie
par. 6.3 waarom dit naast de REGELVERSIE staat):

- `server/kern/vrijheid/vakantieregel.js@sha256:634be62f36be9146`
- `server/kern/vrijheid/vakantiepoort.js@sha256:772d776c9b354f53`
- `server/kern/vrijheid/saldobron.js@sha256:0e25b2961cd313a6`

`test/vakantietoets.test.js` zakt zodra een van deze drie waarden, een
codeverwijzing in dit dossier of een voorbeelduitkomst niet meer klopt met de
code. Dit dossier kan dus niet stil verouderen: verandert de regel, dan moet het
dossier mee, en een toets op het oude dossier is geen toets op de nieuwe regel.

**Hoe de codeverwijzingen te lezen zijn.** Een verwijzing heeft de vorm
`pad:regel#naam`: het bestand, het regelnummer in deze versie, en een naam die op
die regel staat (een functie, een constante of een variabele). De toets houdt elke
verwijzing tegen de bron.

**Waarom een eigen document en geen paragraaf van `VRIJHEID.md`.** Dit dossier
gaat naar een beoordelaar BUITEN het huis en moet op zichzelf te lezen zijn,
zonder de rest van het Vrijheid-ontwerp (RTG Days, verjaardag, eerlijkheid). Het
heeft een eigen handtekeningblok en een eigen handhaver, en wordt bij elke nieuwe
regelversie opnieuw ingevuld; dat past niet in een paragraaf van een
richtingsdocument. `VRIJHEID.md` par. 6a verwijst ernaar. De naam is gecontroleerd
op botsingen: `VAKANTIETOETS` en `vakantietoets` kwamen in de repository nergens
voor.

---

## 1. Doel en reikwijdte

### 1.1 Wat de regel berekent

Het **wettelijke vakantierecht in uren** van EEN werknemer, bij EEN zaak, over EEN
kalenderjaar, naar Nederlands recht. De rekenkern is
`server/kern/vrijheid/vakantieregel.js:105#reken`; de aansluiting op de bronnen
(dienstverband, contract, verzuim, beleid, poort) is
`server/kern/vrijheid/saldobron.js:56#verlofrechten`.

Het getal is het RECHT van dat jaar. Het is geen saldo: wat er al is opgenomen,
wordt elders afgetrokken en valt buiten deze toets.

De bronnen:

| Gegeven | Bron | Codeplek |
|---|---|---|
| dienstverband (ingang, einde) | het teambeeld, dat het leest uit `kern/concern/employment.js` | `server/kern/vrijheid/saldobron.js:65#dienstverband` |
| arbeidsduur per week en soort contract | de contractversies in de payroll | `server/kern/vrijheid/saldobron.js:79#geschiedenis` |
| tijdvakken van verzuim | het verzuimregister | `server/kern/vrijheid/saldobron.js:91#voorPayroll` |
| de factor (weken per jaar) | het beleid, laag LEGAL_BASELINE, alleen voor een zaak met een Nederlandse vestiging | `server/kern/vrijheid/huis.js:55#wetVoor` |

### 1.2 Wat de regel NIET berekent

Elk van deze punten levert geen getal maar de stand **OPEN** met de reden die de
code geeft. Een recht van nul is een uitspraak, en die doet de regel alleen als de
bronnen hem dragen.

| Onderwerp | Stand | Reden zoals de code hem geeft | Codeplek |
|---|---|---|---|
| bovenwettelijk verlof | OPEN, altijd | "Het arbeidscontract (kern/payroll/contracten.js) draagt geen bovenwettelijk verlof; er is geen bron om het uit te lezen." | `server/kern/vrijheid/saldobron.js:124#contractueel` |
| cao | niet gelezen | er is geen cao-bron; de beleidslaag `COLLECTIVE_AGREEMENT` bestaat, maar niemand zet er de vakantiefactor in (zie aanname A11) | `server/kern/vrijheid/beleid.js:28#LAGEN` |
| ouderschapsverlof | OPEN | "gedeeltelijk loon; hoe art. 7:635 BW deze soort raakt, is niet vastgesteld" | `server/kern/vrijheid/vakantieregel.js:80#ouderschap` |
| zorgverlof | OPEN | idem | `server/kern/vrijheid/vakantieregel.js:81#zorg` |
| oproep, nuluren, uitzend, freelance (geen vaste omvang) | OPEN | "... zonder vaste arbeidsduur per week; dan hangt het recht aan de gewerkte uren, en die regel is niet gegeven." | `server/kern/vrijheid/vakantieregel.js:131#soort` |
| vaste soort zonder arbeidsduur in de bron | OPEN | "... noemt geen arbeidsduur per week; die ontbreekt in de bron en is geen nul." | `server/kern/vrijheid/vakantieregel.js:129#VASTE_OMVANG` |
| meer dan een contract bij dezelfde zaak | OPEN | "Er lopen N contracten bij deze zaak; hoe die samen het recht vormen is niet vastgesteld." | `server/kern/vrijheid/saldobron.js:77#nrs` |
| vestiging buiten Nederland | OPEN | "Deze zaak staat in XX; de rekenregel volgt Nederlands recht (art. 7:634 BW) en geldt hier niet." | `server/kern/vrijheid/saldobron.js:69#vest` |
| vakantie langs de oude verlofroute (in dagen) | OPEN | "... staan in dagen; dit saldo telt in uren, en die omrekening is niet vastgesteld." | `server/kern/vrijheid/saldobron.js:90#ander` |
| verval en verjaring van niet-opgenomen uren (art. 7:640a en 7:642 BW) | buiten de regel | de regel rekent het recht van een jaar en raakt die vraag niet | — |
| opgenomen vakantie, saldo, uitbetaling bij einde dienstverband | buiten de regel | dat is het saldo en niet het recht | — |

---

## 2. Per wetsartikel

**Over de wettekst.** Dit dossier citeert GEEN wettekst als letterlijk. Wat
hieronder staat is RTG's interpretatie, zoals die in de code is vastgelegd. De
beoordelaar legt die naast de geldende tekst op wetten.overheid.nl (Burgerlijk
Wetboek Boek 7, titel 10, afdeling 8: vakantie en verlof) en op de peildatum van de
toets.

De artikelen die de code zelf noemt staan in
`server/kern/vrijheid/vakantieregel.js:55#ARTIKELEN`. Het zijn er drie.

### 2.1 Art. 7:634 lid 1 BW — het minimum over een vol jaar

**RTG's interpretatie.** Over een jaar waarin de werknemer recht op loon heeft over
de volle overeengekomen arbeidsduur, bedraagt het wettelijke vakantierecht ten
minste viermaal de overeengekomen arbeidsduur per week, in uren.

**Wat de code doet.**

- De factor vier staat als waarde in de wettelijke laag:
  `server/kern/vrijheid/vakantieregel.js:65#LEGAL_BASELINE`.
- Die laag wordt alleen gezet voor een zaak met een Nederlandse vestiging:
  `server/kern/vrijheid/huis.js:58#WETTELIJKE_LAAG`.
- Een hogere beleidslaag kan de factor niet verlagen (de hoogste wint, een
  lagere waarde wordt een conflict en blijft staan):
  `server/kern/vrijheid/beleid.js:76#beter`.
- Per kalenderdag in dienst telt de regel `factor x urenPerWeek / dagen in het
  jaar`: `server/kern/vrijheid/vakantieregel.js:137#per`. Over een vol jaar is de
  som exact `4 x urenPerWeek` (voorbeelden V1, V4, V11).
- Tijdvakken met recht op loon tellen door. Welke verzuimsoorten dat zijn, staat
  in `server/kern/vrijheid/vakantieregel.js:71#OPBOUW`: `vakantie`, `rtgdag`,
  `verjaardag`, `bijzonder` en `geboorte` met de grond "volledig betaald".

**Vragen aan de beoordelaar.**

- 2.1.a Is "viermaal de overeengekomen arbeidsduur per week" in UREN de juiste
  uitkomst, en is het uur de juiste eenheid voor het recht (en niet dagen)?
- 2.1.b Is het veld `urenPerWeek` van de contractversie "de overeengekomen
  arbeidsduur per week", ook bij een min-maxcontract (V17) en bij stage (V18)?
- 2.1.c Zijn de vijf soorten verzuim met "volledig betaald" terecht soorten waarover
  de opbouw doorloopt?

### 2.2 Art. 7:634 lid 2 BW — een deel van het jaar

**RTG's interpretatie.** Heeft de werknemer niet over het hele jaar recht op loon
(in dienst getreden, uit dienst gegaan), dan bestaat het recht naar evenredigheid.

**Wat de code doet.**

- Het jaar wordt geknipt op het dienstverband: ingang en einde, beide INCLUSIEF:
  `server/kern/vrijheid/vakantieregel.js:114#van` en
  `server/kern/vrijheid/vakantieregel.js:115#tot`.
- De evenredigheid is per KALENDERDAG, over 365 of 366 dagen:
  `server/kern/vrijheid/vakantieregel.js:109#dagenInJaar`. Weekenddagen,
  feestdagen en dagen waarop een deeltijder niet werkt tellen even zwaar als een
  werkdag.
- Dagen zonder recht op loon zonder uitzondering (onbetaald verlof) bouwen niet op:
  `server/kern/vrijheid/vakantieregel.js:139#geen`. Die dagen staan apart in
  `zonderOpbouw`, met de grond.

**Vragen aan de beoordelaar.**

- 2.2.a Is naar rato per kalenderdag een juiste lezing, of hoort het per gewerkte
  week, per maand of per loontijdvak?
- 2.2.b Telt de dag van indiensttreding en de laatste dag van het dienstverband
  allebei volledig mee (V2, V3)?
- 2.2.c Is "geen opbouw over onbetaald verlof" een juiste toepassing van lid 2 in
  samenhang met art. 7:635 BW (V8, V15)?

### 2.3 Wisselende arbeidsduur (art. 7:634 BW)

**RTG's interpretatie.** Verandert de overeengekomen arbeidsduur in de loop van het
jaar, dan geldt per periode de arbeidsduur die in die periode is overeengekomen.

**Wat de code doet.**

- Per dag de contractversie die OP DIE DAG geldt, met dezelfde vraag die de loonrun
  stelt (de laatst ingegane versie wint):
  `server/kern/vrijheid/vakantieregel.js:96#versieOp`, gelijk aan
  `server/kern/payroll/contracten.js:81#opDatum`.
- Een nieuwe versie met dezelfde arbeidsduur (bijvoorbeeld alleen een ander
  uurloon) verandert het recht niet (V6).

**Vraag aan de beoordelaar.**

- 2.3.a Is naar rato per kalenderdag per contractversie de juiste behandeling van
  een wijziging van de arbeidsduur midden in het jaar (V5, V16)?

### 2.4 Art. 7:635 BW — opbouw over tijdvakken zonder (volledig) loon

**RTG's interpretatie.** Over tijdvakken waarin de werknemer geen recht op loon
heeft, bouwt hij geen vakantie op, behalve in de gevallen die het artikel noemt.
Ziekte is zo'n geval: tijdens ziekte loopt de opbouw volledig door. Zwangerschaps-
en bevallingsverlof ook.

**Wat de code doet.**

- `ziek` loopt door: `server/kern/vrijheid/vakantieregel.js:77#ziek`.
- `zwangerschap` loopt door: `server/kern/vrijheid/vakantieregel.js:78#zwangerschap`.
- `onbetaald` bouwt niet op: `server/kern/vrijheid/vakantieregel.js:79#onbetaald`.
- `ouderschap` en `zorg` zijn OPEN: de regel rekent dan helemaal niet en geeft de
  reden (`server/kern/vrijheid/vakantieregel.js:136#open`). Het verzuimregister
  kent deze twee soorten met gedeeltelijk loon
  (`server/kern/payroll/verzuim.js:33#ouderschap`).
- Een soort die niet in de tabel staat, is OPEN: 
  `server/kern/vrijheid/vakantieregel.js:135#OPBOUW`.

**Vragen aan de beoordelaar.**

- 2.4.a Loopt de opbouw bij ziekte volledig door, ook bij langdurige ziekte die
  meerdere jaren beslaat, en ook als het loon tijdens ziekte lager is dan honderd
  procent (het verzuimregister kent ziekte met 70% loon)?
- 2.4.b Is de behandeling van zwangerschaps- en bevallingsverlof juist?
- 2.4.c Hoe moet de opbouw over ouderschapsverlof en zorgverlof worden gerekend?
  Vandaag is dat OPEN; het antwoord wordt een rij in `OPBOUW` en dus een nieuwe
  REGELVERSIE.
- 2.4.d Zijn er andere tijdvakken zonder loon die het artikel noemt en die in het
  verzuimregister geen eigen soort hebben?

### 2.5 Artikelen die de code NIET toepast, maar die de beoordelaar kan raken

| Artikel | Waarom het hier staat | Wat de code doet |
|---|---|---|
| art. 7:640a BW (verval wettelijke uren) | het recht van een jaar vervalt na een termijn | niets; buiten de regel |
| art. 7:642 BW (verjaring) | bovenwettelijke uren verjaren anders dan wettelijke | niets; en zie aanname A11 over de scheiding wettelijk en bovenwettelijk |
| art. 7:645 BW (afwijken ten nadele) | of een lagere afspraak het minimum kan raken | de beleidsmotor laat een lagere laag nooit winnen (`server/kern/vrijheid/beleid.js:76#beter`) |

Dit zijn verwijzingen, geen interpretaties. De beoordelaar bepaalt of ze hier
spelen.

---

## 3. Aannames

Elke aanname is een keuze die de code maakt waar de wet (volgens RTG) niet alles
voorschrijft, of waar RTG een lezing heeft gekozen. Allemaal te toetsen.

| Nr. | Aanname | Codeplek |
|---|---|---|
| A1 | De factor is **4** (weken per jaar), en komt uit de wettelijke beleidslaag. | `server/kern/vrijheid/vakantieregel.js:65#LEGAL_BASELINE` |
| A2 | Naar rato **per kalenderdag**: elke dag in dienst telt `factor x urenPerWeek / dagenInJaar`, ook weekend en feestdagen. | `server/kern/vrijheid/vakantieregel.js:137#per` |
| A3 | Het jaar heeft **365 of 366** dagen; een schrikkeljaar telt 366 en een vol schrikkeljaar geeft dus hetzelfde recht als een vol gewoon jaar. | `server/kern/vrijheid/vakantieregel.js:109#dagenInJaar` |
| A4 | Het rekenjaar is het **kalenderjaar** (1 januari tot en met 31 december), niet een vakantiejaar of opbouwjaar van de werkgever. | `server/kern/vrijheid/vakantieregel.js:108#jaarVan` |
| A5 | Begin- en einddatum van het dienstverband tellen **allebei volledig** mee. | `server/kern/vrijheid/vakantieregel.js:115#tot` |
| A6 | Per dag geldt de **contractversie op die dag**; bij twee versies die beide gelden wint de laatst ingegane. | `server/kern/vrijheid/vakantieregel.js:96#versieOp` |
| A7 | De arbeidsduur is het veld `urenPerWeek` van de versie, voor `vast`, `tijdelijk`, `minmax` en `stage` (de soorten "met vaste omvang"). | `server/kern/payroll/samenstellen-rekenhulp.js:18#VASTE_OMVANG` |
| A8 | **Ziekte bouwt volledig op**, ongeacht het percentage doorbetaald loon en ongeacht de duur, ook over de jaargrens. | `server/kern/vrijheid/vakantieregel.js:77#ziek` |
| A9 | **Onbetaald verlof bouwt niet op**, per kalenderdag. | `server/kern/vrijheid/vakantieregel.js:79#onbetaald` |
| A10 | Verzuim dat volledig wordt doorbetaald (vakantie, RTG Day, verjaardag, bijzonder verlof, geboorteverlof) en zwangerschapsverlof **bouwt op**. De vlag `opbouwend` in het verzuimregister wordt met opzet NIET gelezen (die staat voor `vakantie` op `false`; zie `VRIJHEID.md` par. 6a). | `server/kern/vrijheid/vakantieregel.js:71#OPBOUW` |
| A11 | De factor is het **wettelijke** recht. De beleidsmotor laat een hogere laag (bijvoorbeeld een cao met 5) wel winnen; dan zou het getal ook bovenwettelijk verlof bevatten. Vandaag zet geen enkele code een hogere laag voor deze variabele, maar de scheiding wettelijk/bovenwettelijk (die voor verval en verjaring uitmaakt) is daardoor niet structureel gegarandeerd. | `server/kern/vrijheid/beleid.js:76#beter` |
| A12 | **Afronding**: het totaal wordt eenmaal afgerond op twee decimalen (`Math.round(x * 100) / 100`); de perioden worden elk apart afgerond, zodat hun som een honderdste kan afwijken van het totaal. Het totaal is leidend. | `server/kern/vrijheid/vakantieregel.js:153#rond` |
| A13 | Overlappen twee verzuimmeldingen op dezelfde dag, dan telt **de eerste in de lijst** (de volgorde waarin ze zijn vastgelegd). Zie grensgeval G13: de uitkomst hangt dan af van de volgorde. | `server/kern/vrijheid/vakantieregel.js:134#find` |
| A14 | Een verzuimmelding **zonder einddatum** loopt door tot het einde van het rekenjaar. | `server/kern/vrijheid/vakantieregel.js:134#tot` |
| A15 | Een verzuimmelding zonder geldige begindatum wordt **genegeerd**. | `server/kern/vrijheid/vakantieregel.js:119#isDatum` |
| A16 | Ontbreekt een gegeven, dan is de uitkomst **geen getal** (null) met de reden, en nooit nul. Een enkele open dag maakt het hele jaar open. | `server/kern/vrijheid/vakantieregel.js:155#uren` |
| A17 | De regel geldt alleen voor een zaak met een vestiging in **Nederland**; het land komt uit de vestiging van de zaak en niet uit de woonplaats of de werkplek van de werknemer. | `server/kern/vrijheid/saldobron.js:68#land` |
| A18 | Het recht is per **zaak** en per **dienstverband bij de entiteit van die zaak**; dienstverbanden bij andere zaken worden niet opgeteld. | `server/kern/vrijheid/saldobron.js:63#inDienst` |

---

## 4. Grensgevallen

| Nr. | Geval | Wat de code doet | Voorbeeld |
|---|---|---|---|
| G1 | Indiensttreding midden in het jaar | naar rato per kalenderdag vanaf de ingangsdatum, die dag inbegrepen | V2, V16 |
| G2 | Uitdiensttreding midden in het jaar | naar rato tot en met de laatste dag | V3, V16 |
| G3 | Schrikkeljaar | 366 dagen in de noemer; een vol jaar geeft 4 x de arbeidsduur | V4 |
| G4 | In dienst op 29 februari | telt vanaf 29 februari, noemer 366 | V12 |
| G5 | Wisseling van arbeidsduur midden in het jaar | naar rato per periode van de contractversie | V5, V16 |
| G6 | Nieuwe contractversie zonder andere arbeidsduur | geen verschil in het recht | V6 |
| G7 | Deeltijd | 4 x de arbeidsduur per week van de deeltijder; geen omrekening naar werkdagen | V11 |
| G8 | Ziekte, ook over de jaargrens of zonder einddatum | de opbouw loopt volledig door; alleen het deel binnen het rekenjaar wordt bekeken | V7, V13, V14 |
| G9 | Onbetaald verlof, ook over de jaargrens | geen opbouw over die dagen, apart vermeld in `zonderOpbouw` | V8, V15, V16 |
| G10 | Ouderschaps- of zorgverlof | OPEN, geen getal | V9, V10 |
| G11 | Ontbrekend dienstverband, of dienstverband dat niet in het jaar loopt | OPEN, geen getal | V23, V24, S6 |
| G12 | Ontbrekend contract, of een gat tussen ingang dienstverband en eerste contractversie | OPEN, geen getal; het gat wordt met datums genoemd | V22, S6 |
| G13 | Twee verzuimmeldingen op dezelfde dag (bijvoorbeeld ziek en onbetaald) | de eerste in de lijst telt; **de uitkomst hangt af van de volgorde** (128 uur tegen 124,49 uur) | V26, V27 |
| G14 | Contract zonder vaste omvang (oproep, nuluren, uitzend, freelance), ook voor een deel van het jaar | OPEN, geen getal | V19, V20 |
| G15 | Vaste soort zonder arbeidsduur in de bron | OPEN, nooit nul | V21 |
| G16 | Min-max en stage | gerekend met het veld `urenPerWeek` van de versie | V17, V18 |
| G17 | Meerdere contracten bij dezelfde zaak | OPEN, geen getal | S3 |
| G18 | Meerdere dienstverbanden bij verschillende zaken of entiteiten | per zaak apart gerekend, niet opgeteld; er is geen plek waar de rechten bij elkaar komen | (aanname A18) |
| G19 | Buitenlandse vestiging | OPEN, de Nederlandse regel geldt niet | S4 |
| G20 | Zaak zonder vestiging | OPEN, omdat de wettelijke laag dan niet wordt gezet; de reden noemt de ontbrekende vestiging NIET, alleen dat de factor niet is vastgesteld | S5 |
| G21 | Een verzuimsoort die niet in de opbouwtabel staat | OPEN | V28 |
| G22 | Factor ontbreekt | OPEN | V25 |
| G23 | Vakantie langs de oude verlofroute in dagen | OPEN | S7 |

---

## 5. Voorbeeldberekeningen

Alle uitkomsten hieronder zijn door de ECHTE functies berekend en letterlijk
overgenomen: `reken()` uit `server/kern/vrijheid/vakantieregel.js:105#reken` voor
V1 tot en met V28, en `verlofrechten()` uit
`server/kern/vrijheid/saldobron.js:56#verlofrechten` (met echte contract-, verzuim-
en poortmodules en een opslag in het geheugen) voor S1 tot en met S7. Er is geen
getal met de hand uitgerekend. `test/vakantietoets.test.js` draait elk blok
opnieuw en zakt als de uitkomst niet meer exact gelijk is.

V1 tot en met V9 zijn de voorbeelden uit de bestaande toetsen
(`test/vrijheid-vakantieregel.test.js`); de rest zijn de grensgevallen uit par. 4.

Lezen: `uren` is het recht in uren (null = geen getal), `perioden` zijn de stukken
met opbouw, `zonderOpbouw` de stukken zonder, `open` de redenen waarom er geen
getal is. Bij S-voorbeelden is `wettelijk` het recht waar een verlofbesluit op mag
steunen (alleen bij een open poort), `berekend` wat de regel rekende, en `waarom`
de reden zoals de werknemer en de manager hem lezen. `beleid: "wet"` is het beleid
dat `huis.js` voor een Nederlandse zaak zet, `beleid: "leeg"` dat voor een zaak
zonder Nederlandse vestiging. De toets in S2 is een PROEF en geen echte toets.

#### V1. Heel jaar, 32 uur per week (toets)

```json vakantievoorbeeld
{
  "id": "V1",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V2. In dienst op 1 juli (toets)

```json vakantievoorbeeld
{
  "id": "V2",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2026-07-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2026-07-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 64.53,
    "perioden": [
      {
        "van": "2026-07-01",
        "tot": "2026-12-31",
        "dagen": 184,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 64.53
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V3. Uit dienst op 31 maart, 40 uur (toets)

```json vakantievoorbeeld
{
  "id": "V3",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": "2026-03-31"
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 40
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 39.45,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-03-31",
        "dagen": 90,
        "urenPerWeek": 40,
        "soort": "vast",
        "uren": 39.45
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V4. Schrikkeljaar, heel jaar (toets)

```json vakantievoorbeeld
{
  "id": "V4",
  "functie": "reken",
  "invoer": {
    "jaar": 2028,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2028-01-01",
        "tot": "2028-12-31",
        "dagen": 366,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 366
  }
}
```

#### V5. Wisseling van 40 naar 20 uur op 1 juli (toets)

```json vakantievoorbeeld
{
  "id": "V5",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 40
      },
      {
        "vanaf": "2026-07-01",
        "soort": "vast",
        "urenPerWeek": 20
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 119.67,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-06-30",
        "dagen": 181,
        "urenPerWeek": 40,
        "soort": "vast",
        "uren": 79.34
      },
      {
        "van": "2026-07-01",
        "tot": "2026-12-31",
        "dagen": 184,
        "urenPerWeek": 20,
        "soort": "vast",
        "uren": 40.33
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V6. Nieuwe contractversie met alleen een ander uurloon (toets)

```json vakantievoorbeeld
{
  "id": "V6",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      },
      {
        "vanaf": "2026-05-01",
        "soort": "vast",
        "urenPerWeek": 32,
        "uurloonCenten": 1900
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-01",
        "tot": "2026-12-31",
        "dagen": 245,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 85.92
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V7. Ziek in februari en maart (toets)

```json vakantievoorbeeld
{
  "id": "V7",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-02-01",
        "tot": "2026-03-31",
        "soort": "ziek"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V8. Tien dagen onbetaald verlof (toets)

```json vakantievoorbeeld
{
  "id": "V8",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "onbetaald"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 124.49,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-11",
        "tot": "2026-12-31",
        "dagen": 235,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 82.41
      }
    ],
    "zonderOpbouw": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "dagen": 10,
        "soort": "onbetaald",
        "grond": "art. 7:634 lid 1 en 7:635 BW: over een tijdvak zonder recht op loon en zonder uitzondering geen opbouw",
        "uren": 3.51
      }
    ],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V9. Ouderschapsverlof: OPEN (toets)

```json vakantievoorbeeld
{
  "id": "V9",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "ouderschap"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-11",
        "tot": "2026-12-31",
        "dagen": 235,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 82.41
      }
    ],
    "zonderOpbouw": [],
    "open": [
      "Verzuim (ouderschap) vanaf 2026-05-01: gedeeltelijk loon; hoe art. 7:635 BW deze soort raakt, is niet vastgesteld."
    ],
    "dagenInJaar": 365
  }
}
```

#### V10. Zorgverlof: OPEN

```json vakantievoorbeeld
{
  "id": "V10",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "zorg"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-11",
        "tot": "2026-12-31",
        "dagen": 235,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 82.41
      }
    ],
    "zonderOpbouw": [],
    "open": [
      "Verzuim (zorg) vanaf 2026-05-01: gedeeltelijk loon; hoe art. 7:635 BW deze soort raakt, is niet vastgesteld."
    ],
    "dagenInJaar": 365
  }
}
```

#### V11. Deeltijd, 24 uur per week

```json vakantievoorbeeld
{
  "id": "V11",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 24
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 96,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 24,
        "soort": "vast",
        "uren": 96
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V12. Schrikkeljaar, in dienst op 29 februari

```json vakantievoorbeeld
{
  "id": "V12",
  "functie": "reken",
  "invoer": {
    "jaar": 2028,
    "dienstverband": {
      "van": "2028-02-29",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2028-02-29",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 107.37,
    "perioden": [
      {
        "van": "2028-02-29",
        "tot": "2028-12-31",
        "dagen": 307,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 107.37
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 366
  }
}
```

#### V13. Ziekte over de jaargrens (1 november 2025 tot 28 februari 2026), jaar 2026

```json vakantievoorbeeld
{
  "id": "V13",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2025-11-01",
        "tot": "2026-02-28",
        "soort": "ziek"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V14. Ziekte zonder einddatum

```json vakantievoorbeeld
{
  "id": "V14",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": null,
        "soort": "ziek"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V15. Onbetaald verlof over de jaargrens, jaar 2026

```json vakantievoorbeeld
{
  "id": "V15",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2025-12-15",
        "tot": "2026-01-15",
        "soort": "onbetaald"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 122.74,
    "perioden": [
      {
        "van": "2026-01-16",
        "tot": "2026-12-31",
        "dagen": 350,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 122.74
      }
    ],
    "zonderOpbouw": [
      {
        "van": "2026-01-01",
        "tot": "2026-01-15",
        "dagen": 15,
        "soort": "onbetaald",
        "grond": "art. 7:634 lid 1 en 7:635 BW: over een tijdvak zonder recht op loon en zonder uitzondering geen opbouw",
        "uren": 5.26
      }
    ],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V16. In en uit dienst in hetzelfde jaar, twee contractversies, ziekte en onbetaald verlof

```json vakantievoorbeeld
{
  "id": "V16",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2026-03-10",
      "tot": "2026-09-20"
    },
    "versies": [
      {
        "vanaf": "2026-03-10",
        "soort": "vast",
        "urenPerWeek": 36
      },
      {
        "vanaf": "2026-06-01",
        "soort": "vast",
        "urenPerWeek": 28
      }
    ],
    "verzuim": [
      {
        "van": "2026-04-01",
        "tot": "2026-04-30",
        "soort": "ziek"
      },
      {
        "van": "2026-08-03",
        "tot": "2026-08-07",
        "soort": "onbetaald"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 65.58,
    "perioden": [
      {
        "van": "2026-03-10",
        "tot": "2026-05-31",
        "dagen": 83,
        "urenPerWeek": 36,
        "soort": "vast",
        "uren": 32.75
      },
      {
        "van": "2026-06-01",
        "tot": "2026-08-02",
        "dagen": 63,
        "urenPerWeek": 28,
        "soort": "vast",
        "uren": 19.33
      },
      {
        "van": "2026-08-08",
        "tot": "2026-09-20",
        "dagen": 44,
        "urenPerWeek": 28,
        "soort": "vast",
        "uren": 13.5
      }
    ],
    "zonderOpbouw": [
      {
        "van": "2026-08-03",
        "tot": "2026-08-07",
        "dagen": 5,
        "soort": "onbetaald",
        "grond": "art. 7:634 lid 1 en 7:635 BW: over een tijdvak zonder recht op loon en zonder uitzondering geen opbouw",
        "uren": 1.53
      }
    ],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V17. Min-maxcontract met 20 uur per week in de versie

```json vakantievoorbeeld
{
  "id": "V17",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "minmax",
        "urenPerWeek": 20
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 80,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 20,
        "soort": "minmax",
        "uren": 80
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V18. Stage, 16 uur per week

```json vakantievoorbeeld
{
  "id": "V18",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "stage",
        "urenPerWeek": 16
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": 64,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 16,
        "soort": "stage",
        "uren": 64
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V19. Oproepcontract: OPEN

```json vakantievoorbeeld
{
  "id": "V19",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "oproep"
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [],
    "zonderOpbouw": [],
    "open": [
      "De contractversie vanaf 2020-01-01 is een oproep-contract zonder vaste arbeidsduur per week; dan hangt het recht aan de gewerkte uren, en die regel is niet gegeven."
    ],
    "dagenInJaar": 365
  }
}
```

#### V20. Halverwege het jaar van vast naar nuluren: OPEN

```json vakantievoorbeeld
{
  "id": "V20",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      },
      {
        "vanaf": "2026-07-01",
        "soort": "nuluren"
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-06-30",
        "dagen": 181,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 63.47
      }
    ],
    "zonderOpbouw": [],
    "open": [
      "De contractversie vanaf 2026-07-01 is een nuluren-contract zonder vaste arbeidsduur per week; dan hangt het recht aan de gewerkte uren, en die regel is niet gegeven."
    ],
    "dagenInJaar": 365
  }
}
```

#### V21. Vast contract zonder arbeidsduur in de bron: OPEN

```json vakantievoorbeeld
{
  "id": "V21",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast"
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [],
    "zonderOpbouw": [],
    "open": [
      "De contractversie vanaf 2020-01-01 (vast) noemt geen arbeidsduur per week; die ontbreekt in de bron en is geen nul."
    ],
    "dagenInJaar": 365
  }
}
```

#### V22. Gat: dienstverband sinds 2020, eerste contractversie pas op 1 april: OPEN

```json vakantievoorbeeld
{
  "id": "V22",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2026-04-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [
      {
        "van": "2026-04-01",
        "tot": "2026-12-31",
        "dagen": 275,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 96.44
      }
    ],
    "zonderOpbouw": [],
    "open": [
      "Van 2026-01-01 tot en met 2026-03-31 loopt het dienstverband zonder contractversie; de arbeidsduur is daar onbekend."
    ],
    "dagenInJaar": 365
  }
}
```

#### V23. Geen dienstverband: OPEN

```json vakantievoorbeeld
{
  "id": "V23",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": null,
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [],
    "zonderOpbouw": [],
    "open": [
      "Het dienstverband heeft geen ingangsdatum; zonder ingang is er niets te rekenen."
    ]
  }
}
```

#### V24. Dienstverband loopt niet in het gevraagde jaar: OPEN

```json vakantievoorbeeld
{
  "id": "V24",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": "2025-12-31"
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [],
    "zonderOpbouw": [],
    "open": [
      "Het dienstverband loopt niet in 2026."
    ]
  }
}
```

#### V25. Factor ontbreekt (geen wettelijke laag): OPEN

```json vakantievoorbeeld
{
  "id": "V25",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": []
  },
  "uitkomst": {
    "uren": null,
    "perioden": [],
    "zonderOpbouw": [],
    "open": [
      "De wettelijke factor (verlof.wettelijkWekenPerJaar) is niet gegeven."
    ]
  }
}
```

#### V26. Ziekte en onbetaald verlof op dezelfde dagen, ziekte eerst gemeld

```json vakantievoorbeeld
{
  "id": "V26",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "ziek"
      },
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "onbetaald"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 128,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-12-31",
        "dagen": 365,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 128
      }
    ],
    "zonderOpbouw": [],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V27. Dezelfde twee meldingen, onbetaald verlof eerst

```json vakantievoorbeeld
{
  "id": "V27",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "onbetaald"
      },
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "ziek"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": 124.49,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-11",
        "tot": "2026-12-31",
        "dagen": 235,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 82.41
      }
    ],
    "zonderOpbouw": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "dagen": 10,
        "soort": "onbetaald",
        "grond": "art. 7:634 lid 1 en 7:635 BW: over een tijdvak zonder recht op loon en zonder uitzondering geen opbouw",
        "uren": 3.51
      }
    ],
    "open": [],
    "dagenInJaar": 365
  }
}
```

#### V28. Een verzuimsoort die niet in de opbouwtabel staat: OPEN

```json vakantievoorbeeld
{
  "id": "V28",
  "functie": "reken",
  "invoer": {
    "jaar": 2026,
    "dienstverband": {
      "van": "2020-01-01",
      "tot": null
    },
    "versies": [
      {
        "vanaf": "2020-01-01",
        "soort": "vast",
        "urenPerWeek": 32
      }
    ],
    "verzuim": [
      {
        "van": "2026-05-01",
        "tot": "2026-05-10",
        "soort": "nieuwesoort"
      }
    ],
    "weken": 4
  },
  "uitkomst": {
    "uren": null,
    "perioden": [
      {
        "van": "2026-01-01",
        "tot": "2026-04-30",
        "dagen": 120,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 42.08
      },
      {
        "van": "2026-05-11",
        "tot": "2026-12-31",
        "dagen": 235,
        "urenPerWeek": 32,
        "soort": "vast",
        "uren": 82.41
      }
    ],
    "zonderOpbouw": [],
    "open": [
      "Verzuim (nieuwesoort) vanaf 2026-05-01: onbekende verzuimsoort nieuwesoort."
    ],
    "dagenInJaar": 365
  }
}
```

#### S1. Poort dicht: de regel rekent, het recht blijft leeg

```json vakantievoorbeeld
{
  "id": "S1",
  "functie": "verlofrechten",
  "invoer": {
    "land": "NL",
    "poort": "dicht",
    "beleid": "wet",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      }
    ]
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": 128,
    "graad": "vermoed",
    "waarom": "Volgens de rekenregel (art. 7:634 lid 1 BW, art. 7:634 lid 2 BW, art. 7:635 BW) zou het recht 128 uur zijn, graad vermoed. De juridische toets van de rekenregel is niet afgerond; de productiepoort is gesloten (besluit eigenaar, 11 oktober 2026). Geen verlofbesluit kent vakantie toe op dit getal."
  }
}
```

#### S2. Poort open na een (proef)toets: dezelfde berekening is het recht

```json vakantievoorbeeld
{
  "id": "S2",
  "functie": "verlofrechten",
  "invoer": {
    "land": "NL",
    "poort": "open",
    "beleid": "wet",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      }
    ]
  },
  "uitkomst": {
    "wettelijk": 128,
    "berekend": 128,
    "graad": "gemeten",
    "waarom": null
  }
}
```

#### S3. Meerdere contracten bij dezelfde zaak: OPEN

```json vakantievoorbeeld
{
  "id": "S3",
  "functie": "verlofrechten",
  "invoer": {
    "land": "NL",
    "poort": "open",
    "beleid": "wet",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      },
      {
        "nr": 2,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 8
        }
      }
    ]
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": null,
    "graad": null,
    "waarom": "Er lopen 2 contracten bij deze zaak; hoe die samen het recht vormen is niet vastgesteld."
  }
}
```

#### S4. Buitenlandse vestiging (ES): OPEN

```json vakantievoorbeeld
{
  "id": "S4",
  "functie": "verlofrechten",
  "invoer": {
    "land": "ES",
    "poort": "open",
    "beleid": "leeg",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      }
    ]
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": null,
    "graad": null,
    "waarom": "Deze zaak staat in ES; de rekenregel volgt Nederlands recht (art. 7:634 BW) en geldt hier niet. Nog niet vastgesteld: Het wettelijke vakantierecht als veelvoud van de arbeidsduur per week (in Nederland art. 7:634 BW); hoe die regel voor deze laag uitpakt, is niet juridisch getoetst."
  }
}
```

#### S5. Zaak zonder vestiging: OPEN

```json vakantievoorbeeld
{
  "id": "S5",
  "functie": "verlofrechten",
  "invoer": {
    "land": null,
    "poort": "open",
    "beleid": "leeg",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      }
    ]
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": null,
    "graad": null,
    "waarom": "Nog niet vastgesteld: Het wettelijke vakantierecht als veelvoud van de arbeidsduur per week (in Nederland art. 7:634 BW); hoe die regel voor deze laag uitpakt, is niet juridisch getoetst."
  }
}
```

#### S6. Geen lopend dienstverband en geen contract: OPEN

```json vakantievoorbeeld
{
  "id": "S6",
  "functie": "verlofrechten",
  "invoer": {
    "land": "NL",
    "poort": "open",
    "beleid": "wet",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": null
    },
    "contracten": []
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": null,
    "graad": null,
    "waarom": "Er loopt geen dienstverband bij de entiteit van deze zaak; zonder werkgever is er geen recht om te rekenen. Er is geen arbeidscontract vastgelegd in de payroll; de arbeidsduur per week is onbekend."
  }
}
```

#### S7. Vakantie die langs de oude verlofroute in DAGEN is gemeld: OPEN

```json vakantievoorbeeld
{
  "id": "S7",
  "functie": "verlofrechten",
  "invoer": {
    "land": "NL",
    "poort": "open",
    "beleid": "wet",
    "jaar": 2026,
    "mens": {
      "id": "7",
      "inDienst": {
        "van": "2024-03-01",
        "tot": null
      }
    },
    "contracten": [
      {
        "nr": 1,
        "versie": {
          "vanaf": "2025-01-01",
          "soort": "vast",
          "uurloonCenten": 1600,
          "urenPerWeek": 32
        }
      }
    ],
    "verzuim": [
      {
        "soort": "vakantie",
        "van": "2026-02-02",
        "tot": "2026-02-06"
      }
    ]
  },
  "uitkomst": {
    "wettelijk": null,
    "berekend": null,
    "graad": null,
    "waarom": "1 vakantiemelding(en) in 2026 kwamen langs de verlofroute en staan in dagen; dit saldo telt in uren, en die omrekening is niet vastgesteld."
  }
}
```

---

## 6. De poort

### 6.1 Hoe hij werkt

De regel REKENT altijd. Of zijn uitkomst een RECHT wordt waar een verlofbesluit op
mag steunen, beslist de productiepoort
(`server/kern/vrijheid/vakantiepoort.js:40#stand`).

- **Twee standen**, `gesloten` en `open`
  (`server/kern/vrijheid/vakantiepoort.js:30#STANDEN`). Een ontbrekende of
  onbekende stand leest als gesloten
  (`server/kern/vrijheid/vakantiepoort.js:42#opgeslagen`).
- **Drie grendels**, en de poort is alleen open als alle drie kloppen
  (`server/kern/vrijheid/vakantiepoort.js:45#open`):
  1. de stand is `open`;
  2. er is een toets vastgelegd met wie toetste, een datum en een kenmerk
     (`server/kern/vrijheid/vakantiepoort.js:43#toetsKlopt`);
  3. de toets is vastgelegd op DEZE regelversie
     (`server/kern/vrijheid/vakantiepoort.js:44#versieKlopt`).
- **Binding aan REGELVERSIE.** De regelversie is een hash over de artikelen, de
  wettelijke laag, de opbouwtabel en de lijst soorten met vaste omvang
  (`server/kern/vrijheid/vakantieregel.js:87#REGELVERSIE`). Verandert een van die
  vier, dan verandert de versie en gaat de poort vanzelf dicht, met de reden "De
  rekenregel is veranderd sinds de toets"
  (`server/kern/vrijheid/vakantiepoort.js:48#regelVersie`).
- **Dicht** betekent: `wettelijk` is null, de berekening staat er met de graad
  `vermoed` en de reden
  (`server/kern/vrijheid/saldobron.js:113#berekend`), en een vakantieverzoek wordt
  UNKNOWN (`server/kern/vrijheid/besluit.js:57#recht`). **Open** betekent: dezelfde
  berekening wordt het recht, met de graad `gemeten`
  (`server/kern/vrijheid/saldobron.js:112#wettelijk`).
- **Een poort die niet te lezen is, is dicht**
  (`server/kern/vrijheid/saldobron.js:49#poortStand`).
- **Wie hem zet.** Lezen mag iedereen met boardroomtoegang
  (`server/routes/vrijheid/vakantieregel.js:15#boardroomAuth`); zetten alleen de
  eigenaar (`server/routes/vrijheid/vakantieregel.js:21#boardroomBaas`), op eigen
  naam (de gedeelde kantoorcode is geen naam:
  `server/kern/vrijheid/vakantiepoort.js:60#wie`), met een verse passkey onder de
  actie `eigenaar-vakantieregel`
  (`server/routes/vrijheid/vakantieregel.js:24#eis`,
  `server/kern/webauthn-acties.js:63#vakantieregel`), en duurzaam vastgelegd
  (`server/routes/vrijheid/vakantieregel.js:28#vastleggen`).
- **Openen vraagt de toets**: wie toetste, de datum (JJJJ-MM-DD, niet in de
  toekomst) en het kenmerk van het toetsdossier
  (`server/kern/vrijheid/vakantiepoort.js:69#mist`,
  `server/kern/vrijheid/vakantiepoort.js:70#tijd`). Dichtzetten vraagt geen toets.
- **RTG beoordeelt het toetsdossier niet inhoudelijk.** De poort legt vast WAAROP
  de eigenaar opende, en de regelversie waarop dat gebeurde
  (`server/kern/vrijheid/vakantiepoort.js:73#regelVersie`).

### 6.2 Wat de binding aan REGELVERSIE NIET dekt

De REGELVERSIE is een hash over de vier TABELLEN, niet over de rekencode zelf.
Verandert iemand de berekening in `reken()` (bijvoorbeeld van per kalenderdag naar
per werkdag) zonder een tabel aan te raken, dan blijft de REGELVERSIE gelijk en
blijft een open poort open. Hetzelfde geldt voor `saldobron.js` (welke bronnen,
welke redenen) en voor de beleidsmotor (`beleid.js`, wie er wint).

Dit dossier verandert de code niet, en dus ook dit niet. Het vangt het op twee
manieren op, en geen van beide is een grendel op de poort:

- de bronhashes bovenaan dit dossier: `test/vakantietoets.test.js` zakt zodra
  `vakantieregel.js`, `vakantiepoort.js` of `saldobron.js` byte voor byte
  verandert, en daarmee zakt de keuring tot het dossier is bijgewerkt;
- de codeverwijzingen en de voorbeelduitkomsten, die de toets elk tegen de bron
  houdt.

Of de REGELVERSIE ook de rekencode moet dekken, is een besluit van de eigenaar en
geen vraag aan de jurist. Het staat hier omdat de beoordelaar moet weten waaraan
zijn handtekening vastzit: aan de regelversie EN aan de bronhashes van dit
dossier.

### 6.3 De stappen van de eigenaar na een POSITIEVE toets

1. De beoordelaar levert het ingevulde dossier terug (par. 7: alle punten
   akkoord, of akkoord met opmerkingen die geen wijziging van de regel vragen),
   met naam, datum en kenmerk.
2. De eigenaar controleert dat de **REGELVERSIE** en de **bronhashes** in het
   getoetste dossier gelijk zijn aan die in de code van dat moment. De actuele
   regelversie geeft `POST /api/office/vrijheid/vakantieregel` (veld
   `regelVersie`); de bronhashes rekent `sha256sum` over de drie bestanden (eerste
   zestien tekens). Wijkt een van beide af, dan is de toets op een andere versie
   gedaan: niet openen, eerst opnieuw laten toetsen.
3. De eigenaar legt het ingevulde dossier vast (een commit die par. 7 invult met
   naam, datum en kenmerk), zodat de toets in de geschiedenis van de repository
   staat naast de code waarop hij sloeg.
4. De eigenaar logt op EIGEN naam in de boardroom in (niet met de gedeelde
   kantoorcode) en roept
   `POST /api/office/vrijheid/vakantieregel/stand` aan met
   `{ "stand": "open", "toets": { "door": "<naam van de beoordelaar of het bureau>", "datum": "<JJJJ-MM-DD van de toets>", "kenmerk": "<kenmerk van het toetsdossier>" } }`,
   en bevestigt met een verse passkey. Er is vandaag geen scherm voor deze
   schakelaar; de route is de enige ingang.
5. De eigenaar leest de stand terug (`POST /api/office/vrijheid/vakantieregel`):
   `open: true`, de toets met het juiste kenmerk, en `regelVersie` gelijk aan die
   in het dossier.
6. Vanaf dat moment steunt een verlofbesluit op het berekende recht. Elke
   wijziging van de regel daarna sluit de poort vanzelf (via de REGELVERSIE) of
   laat de keuring zakken (via de bronhashes), en dan begint dit proces opnieuw.

### 6.4 Bij een NEGATIEVE toets

- De poort blijft dicht. Er hoeft niets te worden gezet: dicht is de standaard.
- Staat de poort toch open (bijvoorbeeld na een eerdere toets), dan zet de
  eigenaar hem dicht met `{ "stand": "gesloten" }` op dezelfde route. Dat vraagt
  geen toets, wel de eigenaar en een passkey.
- De bevindingen van de beoordelaar worden een wijziging van de regel (een
  artikel, de opbouwtabel, de factor of de rekencode). Dat levert een nieuwe
  REGELVERSIE of nieuwe bronhashes op, en dus een nieuwe versie van dit dossier
  die opnieuw getoetst wordt. Een negatieve toets wordt NIET opgelost door de
  poort te openen met een ander kenmerk.
- Tot dan blijft het recht null met de reden, en blijft een vakantieverzoek
  UNKNOWN. Een mens kan in de menselijke beoordeling (HUMAN_REVIEW) nog steeds zelf
  verlof toekennen; dat leunt dan op zijn eigen oordeel en niet op het getal.

---

## 7. Checklist voor de beoordelaar

Per punt: **A** = akkoord, **N** = niet akkoord, met een opmerking waar nodig. Een
punt dat N is, houdt de poort dicht.

| Nr. | Punt | Zie | A / N | Opmerking |
|---|---|---|---|---|
| T1 | Factor vier, in uren, over een jaar met recht op loon | 2.1.a, A1 | | |
| T2 | `urenPerWeek` is de overeengekomen arbeidsduur, ook bij min-max en stage | 2.1.b, A7, G16 | | |
| T3 | Opbouw loopt door over volledig betaald verlof | 2.1.c, A10 | | |
| T4 | Naar rato per kalenderdag (weekend en feestdagen inbegrepen) | 2.2.a, A2 | | |
| T5 | Begin- en einddag tellen volledig mee | 2.2.b, A5, G1, G2 | | |
| T6 | Kalenderjaar als rekenjaar | A4 | | |
| T7 | Schrikkeljaar: 366 in de noemer | A3, G3, G4 | | |
| T8 | Wisselende arbeidsduur: naar rato per contractversie | 2.3.a, A6, G5 | | |
| T9 | Ziekte bouwt volledig op, ook langdurig, bij gedeeltelijk loon en over de jaargrens | 2.4.a, A8, G8 | | |
| T10 | Zwangerschaps- en bevallingsverlof bouwt op | 2.4.b | | |
| T11 | Onbetaald verlof bouwt niet op | 2.2.c, A9, G9 | | |
| T12 | Ouderschaps- en zorgverlof: hoe te rekenen (vandaag OPEN) | 2.4.c, G10 | | |
| T13 | Andere tijdvakken zonder loon die in het register ontbreken | 2.4.d | | |
| T14 | Contracten zonder vaste omvang: OPEN is een aanvaardbare uitkomst tot er een regel is | G14 | | |
| T15 | Overlappende verzuimmeldingen: de uitkomst hangt af van de volgorde | A13, G13 | | |
| T16 | Afronding op twee decimalen, totaal leidend | A12 | | |
| T17 | Wettelijk en bovenwettelijk blijven gescheiden (cao-laag kan de factor verhogen) | A11 | | |
| T18 | Alleen Nederlandse vestiging; land uit de vestiging van de zaak | A17, G19, G20 | | |
| T19 | Meerdere dienstverbanden of contracten: OPEN of apart gerekend | A18, G17, G18 | | |
| T20 | Verval en verjaring (art. 7:640a, 7:642 BW) vallen terecht buiten deze regel | 2.5 | | |
| T21 | De voorbeelduitkomsten in par. 5 zijn wat de wet voorschrijft | par. 5 | | |

**Algemene opmerkingen van de beoordelaar:**

&nbsp;

**De toets** (in te vullen na afronding; deze drie velden zijn exact wat de
eigenaar in de poort vastlegt):

| Veld | Waarde |
|---|---|
| Beoordelaar (naam, en bureau) | |
| Datum van de toets (JJJJ-MM-DD) | |
| Kenmerk van het toetsdossier | |
| Getoetste REGELVERSIE | |
| Getoetste bronhashes (alle drie) | |
| Peildatum van de wettekst | |
| Uitslag (positief / negatief) | |

---

## 8. Wat dit dossier NIET zegt

- **Geen juridisch oordeel.** Het beschrijft wat de code doet. Dat de code doet wat
  hier staat, is getoetst; dat het de juiste lezing van de wet is, niet.
- **Geen garantie.** Ook na een positieve toets is de uitkomst zo goed als de
  bronnen: een verkeerd ingevoerde contractversie of een ontbrekende ziekmelding
  geeft een verkeerd getal, en de regel ziet dat niet.
- **Alleen de wet, geen cao.** Er is geen cao-bron, en dus geen cao-regel. Een
  werkgever met een cao die meer of anders geeft, krijgt hier alleen het wettelijke
  minimum, en een cao die bepalingen raakt waar de wet ruimte laat (bijvoorbeeld
  rond ziekte) is niet meegenomen.
- **Geen bovenwettelijk verlof, geen saldo, geen opname, geen uitbetaling, geen
  verval, geen verjaring.**
- **Geen letterlijke wettekst.** De artikelverwijzingen zijn RTG's lezing; de
  beoordelaar legt ze naast de officiële bron.
- **Geen uitspraak over buitenlandse dienstverbanden** of over welk recht van
  toepassing is op een grensoverschrijdende arbeidsovereenkomst; de regel volgt
  alleen het land van de vestiging.
- **Geen bewijs dat de regel in productie draait.** De poort is dicht; er is nog
  geen enkel verlofbesluit op dit getal genomen.
