# DPIA — voorbereiding (AVG art. 35)

**Dit document is geen DPIA. Het is het feitelijke fundament eronder.**

Een gegevensbeschermingseffectbeoordeling is een *beoordeling*: iemand weegt
risico's en besluit of ze aanvaardbaar zijn. Dat is mensenwerk en het hoort bij
een functionaris gegevensbescherming of een jurist te liggen — zeker hier, waar
het om gezondheidsgegevens gaat.

Wat hieronder staat is het deel dat wél uit de code te halen is, en dat in de
praktijk het meeste tijd kost: een **eerlijke, verifieerbare beschrijving van
wat het systeem werkelijk doet**. Elke regel is te controleren tegen een bestand
in deze repository. Waar een oordeel nodig is, staat er `[TE BEOORDELEN]` — die
plekken zijn met opzet leeg gelaten. Ze invullen is niet aan de bouwer.

De organisatorische gegevens (wie is verantwoordelijke, is er een FG, welke
bewaartermijn kiest RTG) vraagt Rahul uit op de technische pagina; zie
`server/papieren/`. Ze staan hier dus bewust niet nog een keer.

---

## 1. Waarom een DPIA hier waarschijnlijk verplicht is

Art. 35 lid 3 noemt drie gevallen. Twee daarvan raken RTG rechtstreeks:

- **lid 3 sub b — grootschalige verwerking van bijzondere categorieën.** RTG
  verwerkt gezondheidsgegevens: allergieën, medische aandachtspunten en een
  zorgintake (`server/kern/care/`, zorgprofiel bij elke transactie). Dat is
  art. 9-materiaal.
- **lid 3 sub a — systematische en uitgebreide beoordeling van persoonlijke
  aspecten.** De AI (Rahul) beoordeelt aanmeldingen en doet voorstellen, en de
  ballotage bepaalt of iemand toegang krijgt.

Daar komt bij dat de Autoriteit Persoonsgegevens een eigen lijst hanteert met
verwerkingen waarvoor een DPIA hoe dan ook verplicht is; **gezondheidsgegevens
en grootschalige verwerking staan daarop**. De AP-lijst hoort naast dit
document gelegd te worden.

`[TE BEOORDELEN]` — Is de verwerking "grootschalig" in de zin van de AVG? Dat
hangt af van aantallen leden, geografisch bereik en duur. Vandaag is er geen
enkel echt lid; bij lancering verandert dat. **Deze beoordeling hoort opnieuw
te gebeuren op het moment dat er echte leden komen.**

---

## 2. Systematische beschrijving van de verwerking (art. 35 lid 7 sub a)

### 2.1 Het ontwerp in één alinea

RTG draait op **pseudonimisering**. Alles wat operationeel is — bestellingen,
boekingen, gesprekken, De Salon, zorgprofielen — staat onder een **codenaam**.
De echte naam, het e-mailadres en het telefoonnummer liggen AES-256-GCM
versleuteld in een aparte kluis (`server/accounts/kluis.js`) met een sleutel die
buiten de database hoort te staan.

Juridisch: **pseudonimisering is geen anonimisering** (art. 4 lid 5). De
gegevens onder een codenaam blijven persoonsgegevens, want wij hebben de sleutel
om ze te herleiden. Wat het wél oplevert is een passende beveiligingsmaatregel
in de zin van art. 32: een gestolen database toont codenamen.

Elke blik in de kluis komt in het inzagejournaal (`server/inzagelog.js`): wie,
wanneer, welk account, en waarom.

### 2.2 De gezondheidsgegevens in het bijzonder

| | |
|---|---|
| **Wat** | Allergieën, dieetwensen, medische aandachtspunten, intake bij RTG Care |
| **Waar** | Zorgprofiel bij het account; `server/kern/care/` |
| **Doel** | Voorkomen dat iemand iets krijgt waar hij niet tegen kan |
| **Grondslag** | Uitdrukkelijke toestemming (art. 9 lid 2 sub a) |
| **Wie ziet het** | Alleen de zaak waar het lid op dat moment iets afneemt, en alleen wat nodig is voor die handeling |
| **Onder welke naam** | Codenaam. De zaak ziet geen echte naam |
| **Automatische weigering** | De menukaart keurt gerechten af die botsen met het profiel, en de AI weigert automatisch (zie de zorg-/allergieveiligheidslaag) |

Het gevoeligste punt zit niet in de opslag maar in de **verstrekking**: een
allergieprofiel dat naar een horecazaak gaat, is een gezondheidsgegeven dat een
derde partij bereikt. Dat is precies waarom de codenaam-scheiding hier het
zwaarst weegt: de zaak weet *wat* iemand niet kan hebben, niet *wie* het is.

`[TE BEOORDELEN]` — Is de toestemming die het lid geeft werkelijk
"uitdrukkelijk" en geïnformeerd genoeg voor art. 9? Vrije keuze, specifiek per
doel, en even makkelijk intrekbaar als te geven.

### 2.3 Identiteitsverificatie (KYC)

Een geüpload identiteitsbewijs, geboortedatum, nationaliteit, geslacht uit het
paspoort en een gezichtsvergelijking (ja/nee).

**Let op de grens naar art. 9:** een pasfoto is *geen* biometrisch gegeven
zolang er geen geautomatiseerde herkenning op draait. Wordt die wel ingebouwd,
dan verschuift dit naar een bijzondere categorie en is een aparte grondslag
nodig. `[TE BEOORDELEN — en opnieuw, vóór er gezichtsherkenning bij komt]`

### 2.4 Locatie

Coördinaten tijdens een rit of bezorging, gekoppeld aan de codenaam.
Grondslag: **toestemming** (art. 6 lid 1 sub a) — het lid zet het zelf aan en
kan het intrekken. Toestemming voor "tijdens de rit" dekt niet "voor altijd";
de termijn is een van de vragen die Rahul uitvraagt.

### 2.5 Kinderen (RTFoundation)

De RTF-apps richten zich op leeftijdsgroepen vanaf de basisschool. Er is een
leeftijdslaag met landregels, en een ouder-goedkeuringsstroom.

`[TE BEOORDELEN]` — Art. 8: vanaf welke leeftijd is toestemming van het kind
zelf geldig? Nederland hanteert 16 jaar. Klopt de leeftijdsgrens in de code met
elk land waar RTG actief wil zijn, en is de ouderlijke toestemming aantoonbaar?

### 2.6 Geautomatiseerde besluitvorming

Rahul voert de ballotage-intake en doet voorstellen. **Voor de betaalde passen
beslist een mens** — dat is een merkregel én sinds `0786fbf` een harde grens in
de code: zelf-registreren geeft altijd een RTG Pass, en alleen een menselijk
akkoord tilt een account op.

Dat is relevant voor art. 22 (geen besluit uitsluitend op geautomatiseerde
verwerking met rechtsgevolg of vergelijkbaar effect). `[TE BEOORDELEN]` — Is de
RTG-intake zelf een besluit met "vergelijkbaar aanmerkelijk effect"? Toegang
weigeren tot een dienst kan dat zijn.

---

## 3. Noodzaak en evenredigheid (art. 35 lid 7 sub b)

`[TE BEOORDELEN — dit is de kern van de DPIA en niet door de bouwer in te vullen]`

De vragen die beantwoord moeten worden, per verwerking:

1. Kan het doel ook met **minder** gegevens? (art. 5 lid 1 sub c)
2. Is de **bewaartermijn** niet langer dan nodig? (art. 5 lid 1 sub e)
3. Staat de inbreuk in verhouding tot het belang?
4. Is er een minder ingrijpend alternatief?

Wat de code hierover feitelijk laat zien, als voer voor die weging:

- Het zorgprofiel gaat **per transactie** en **alleen wat nodig is** naar de
  zaak, niet als geheel profiel.
- De partner ziet een **codenaam**, nooit de echte naam.
- Het RTG Zegel bewijst een **feit** (18+, geldig lid) zonder het onderliggende
  gegeven te tonen, en is offline verifieerbaar — een echte
  dataminimalisatie-maatregel, geen sier.
- Een feit dat niet waar is, valt niet te bewijzen: 21+ aanvragen als 19-jarige
  levert geen claim op (`test/zegelroute.test.js`).

---

## 4. Risico's voor de rechten en vrijheden (art. 35 lid 7 sub c)

Hieronder de risico's die uit de code en de veiligheidsrondes naar voren komen.
**De inschatting van kans en ernst is met opzet niet ingevuld** — dat is de
beoordeling zelf.

| # | Risico | Wat er kan gebeuren | Kans | Ernst |
|---|---|---|---|---|
| R1 | Ontsleuteling van de kluis | Naam, e-mail en telefoon van alle leden worden herleidbaar | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R2 | Zorggegevens bij de verkeerde zaak | Een allergie- of medisch gegeven bereikt een partij die er niets mee te maken heeft | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R3 | Herleiding via de codenaam | Een partner legt codenaam en persoon naast elkaar via bestelpatroon of tijdstip | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R4 | Locatiegeschiedenis blijft hangen | Een profiel van iemands bewegingen ontstaat ongemerkt | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R5 | Paspoortscan blijft bewaard | Een gestolen bestand bevat een volledig identiteitsbewijs | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R6 | Gegevens van kinderen | RTF verwerkt gegevens van minderjarigen, met een ander beschermingsniveau | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R7 | Doorgifte buiten de EU via de AI | Wat een lid typt bereikt een verwerker in een derde land | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |
| R8 | Verwerker zonder overeenkomst | Aansprakelijkheid ligt volledig bij RTG, en er is geen grip op wat de partij doet | `[TE BEOORDELEN]` | `[TE BEOORDELEN]` |

---

## 5. Maatregelen (art. 35 lid 7 sub d)

Dit is de kolom die wél hard is: dit bestaat en is getest.

| Risico | Maatregel | Waar | Bewijs |
|---|---|---|---|
| R1 | AES-256-GCM in een gescheiden kluis; sleutel verplicht uit de omgeving in productie (de server start niet zonder) | `server/accounts/kluis.js`, `server/config.js` | `test/scheiding.test.js` |
| R1 | Inzagejournaal: elke ontsleuteling met wie/wanneer/waarom; het bord toont hoe vaak er zónder reden is gekeken | `server/inzagelog.js` | `test/inzagelog.test.js` |
| R2, R3 | Codenaam-scheiding: de zaak ziet nooit de echte naam | `server/accounts/` | `test/scheiding.test.js` |
| R2 | Alleen wat nodig is, per transactie — geen volledig profiel | zorg-/allergieveiligheidslaag | — |
| R3 | Onkoppelbare pseudoniemen: elke partner ziet een ánder pseudoniem voor hetzelfde lid, dus twee zaken kunnen hun gegevens niet naast elkaar leggen | `server/lib/zegel.js` | `test/zegelroute.test.js` (test 2) |
| R4, R5 | Bewaartermijnenbeleid per categorie + een wacht die dagelijks telt en maandelijks meldt — en **nooit zelf wist** | `server/bewaartermijnen.js`, `server/bewaarwacht.js` | `test/bewaarwacht.test.js` |
| R5 | `[TE BESLISSEN door RTG]` — de termijn voor de paspoortscan zelf. Advies van de bouwer: verwijderen zodra de verificatie rond is, alleen de uitkomst bewaren. Rahul vraagt dit uit | `server/papieren/vragen.js` | — |
| R6 | Leeftijdslaag met landregels; ouder-goedkeuring | RTF-laag | `test/beschermd.test.js` |
| R7 | Zonder AI-sleutel gaan er geen gesprekken naar buiten (vaste demo-antwoorden). Sinds de poortwacht-ronde: **zonder inlog raakt het vertaal-endpoint de AI-aanbieder niet** | `server/translate.js` | `test/poortwacht.test.js` |
| R8 | `[TE REGELEN door RTG]` — de overeenkomsten zelf. Zie VERWERKINGSREGISTER.md; Rahul vraagt per partij uit of er een ligt | `server/papieren/` | — |
| alle | Recht op verwijdering, aantoonbaar | `/api/privacy/delete` | `test/vergeten.test.js` |
| alle | Geen persoonsgegevens in de logboeken | `server/log.js` | `test/loghygiene.test.js` |
| alle | Herstelproef: een backup wordt écht teruggezet en daarna wordt er ingelogd | `scripts/herstelproef.js` | `test/herstelproef.test.js` |

---

## 6. Wat deze voorbereiding niet is

- **Geen beoordeling.** Kans en ernst zijn niet ingevuld, en de conclusie —
  is het restrisico aanvaardbaar, of is een voorafgaande raadpleging van de
  Autoriteit Persoonsgegevens nodig (art. 36)? — staat er niet in.
- **Geen advies van een FG.** Art. 35 lid 2 schrijft voor dat de
  verwerkingsverantwoordelijke advies van de functionaris inwint. Of er een FG
  is, vraagt Rahul uit.
- **Geen raadpleging van betrokkenen.** Art. 35 lid 9 vraagt waar passend om de
  mening van betrokkenen of hun vertegenwoordigers.
- **Geen momentopname die blijft gelden.** Art. 35 lid 11: bij verandering van
  het risico hoort een nieuwe toetsing. Concreet voor RTG: bij de eerste echte
  leden, bij gezichtsherkenning, bij een AI-sleutel in productie, en bij
  uitbreiding naar een nieuw land.

---

## 7. Voor wie dit oppakt

De snelste route: neem hoofdstuk 2 en 5 als gegeven mee (die zijn te
controleren tegen de code), en besteed de tijd aan hoofdstuk 3 en 4 — de
weging. Dat is waar een DPIA over gaat, en het enige deel dat een mens moet
doen.

Loop daarna nog één keer langs de `[TE BEOORDELEN]`-plekken; ze staan er
allemaal met opzet, en geen van alle is per ongeluk blijven staan.
