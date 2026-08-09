# RTG Life: het lifestyle- en welzijns-OS

Dit is de architectuurnotitie voor RTG Life. Ze beschrijft één idee, en dan
eerlijk wat daar vandaag van staat en wat niet.

**Het idee.** Een lid hoeft niet te weten of hij Vitaal, Balans, Sport of de
Zorg-tab moet openen. Hij weet dat hij moe is, dat hij naar de kapper moet, of
dat hij weer eens wil bewegen. RTG bepaalt welke onderdelen dan relevant zijn en
brengt ze samen. De losse apps blijven bestaan als motor; ze worden diensten
binnen één omgeving in plaats van elf ingangen waaruit je moet kiezen.

**Waarom deze notitie bestaat en niet meteen de code.** De onderdelen die hier
nog niet staan zijn geen kleine bouwsteentjes: een doelenmotor, een slaaplaag,
een voedingslaag en een coach raken allemaal aan hetzelfde gevoelige profiel.
Wie ze los bouwt en later verbindt, bouwt de scheiding tussen lifestyle en zorg
achteraf in, en dat is precies de volgorde die niet werkt. De grenzen onderaan
deze notitie horen vast te staan vóór de eerste motor erbij komt.

Regel 6 van `LAT.md` geldt hier hard: een belofte in tekst is een belofte in
code. Alles onder "wat er staat" is aan te wijzen in een bestand en draait onder
een toets. Alles onder "wat er niet staat" is niet gebouwd, hoe redelijk het ook
klinkt.

---

## Wat er vandaag staat

| onderdeel | waar | wat het doet |
|---|---|---|
| Zorg (spa, wellness, kliniek) | `server/kern/care.js`, `care/leden.js`, `care/zaak.js` | behandeling boeken bij een behandelaar in een tijdslot, betalen via RTG Pay |
| Verzorging (kapper, barbier, nagels) | `server/kern/verzorging/beautyleden.js` | dezelfde salonagenda als de zaak zelf, maar dan vanaf de kant van het lid, op codenaam |
| De Zorgbalie (behandelaar) | `server/kern/care/zaak.js`, tab in `public/apps/personeel.html` | dagagenda per behandelaar, zorgcontext vóór de behandeling, afronden |
| Zorgprofiel + toestemming | `server/kern/gastzorg.js` | allergenen, dieet en aandachtspunten die alleen meereizen als het lid delen aanzet |
| Intake-deling per aanbieder | `server/kern/care/leden.js` | medische context, uitdrukkelijk, per kliniek, 90 dagen, altijd te stoppen |
| Rust en ritme | `server/kern/balans.js` | weekbeeld uit de agenda, advies om ook eens niks te doen; geen streaks |
| Dagelijkse check-in | `public/apps/vitaal.html` + de veiligheidskern | één knop per dag; de klok loopt op de server, dus stilte is het signaal |
| Sport | `public/apps/sport.html`, `sportclub.html`, `server/kern/clubs.js` | activiteiten, clubs, lessen, banen |
| Gezin | `public/apps/foundation/gezondheid.html`, `gevoel.html`, `rust.html` | gezinsgezondheidsboekje, hoe voel je je, even rust |
| Inzage-audit | `server/inzagelog.js` | wie welke identiteitsgegevens opvroeg, en waarom |
| Identiteitskluis | `server/accounts.js` | echte namen apart; alles daarbuiten draait op codenamen |

Wat deze rij bij elkaar houdt is het toestemmingsmodel, en dat is het meest
waardevolle dat er al staat: niets zonder een "ja", per ontvanger, met een
einddatum, altijd te stoppen. RTG Life hoort daarop verder te bouwen en niet
naast een tweede model te gaan staan.

## Wat deze ronde is rechtgezet

1. **Een echte categorie.** De App-Bibliotheek had acht categorieën en geen
   ervan ging over gezondheid; Vitaal stond onder veiligheid, Balans onder geld
   en Sport onder spelen. Er is nu `leven` ("Leven & gezondheid",
   `server/kern/appcatalogus-data.js`) en die drie staan daar. Ze draaien nog op
   dezelfde kernen als eerst: de categorie zegt waar iemand zoekt, niet waar de
   code woont.

2. **Verzorging aan de consumentenkant.** De salon (`kern/verzorging/beauty.js`)
   bestond alleen voor de zaak zelf: een lid kon nergens een knipbeurt boeken.
   Er is nu een ledenlaag op dezelfde bak, met een eigen blok in de Zorg-tab.
   Zorg en verzorging staan naast elkaar maar niet door elkaar: het salonblok
   draagt geen zorgprofiel en kent geen intake, en zegt dat ook op het scherm.

3. **Balans stond verkeerd beschreven.** De catalogus en de appgids noemden hem
   allebei een geldapp ("je saldo en tikgeschiedenis", "de boekhoudhulp"),
   terwijl `kern/balans.js` over rust, ritme en ontprikkelen gaat. Beide teksten
   zijn gelijkgetrokken met wat de code doet.

Bij dat derde punt hoort een aantekening die eerlijker is dan een vinkje: er is
geen machine die dit bewaakt. Drie plekken beschrijven dezelfde app (de pagina,
de catalogusregel, de gidsentry) en niets vergelijkt ze. `LAT.md` regel 6 noemt
dat met naam: voor proza bestaat geen handhaver. Deze drift is met de hand
gevonden en met de hand hersteld, en kan met de hand terugkomen.

## Wat er niet staat

Niet gebouwd, en dus ook niet half. Voor elk hiervan geldt: er is geen module,
geen route en geen toets.

- **Doelenmotor** (doel, reden, nulmeting, mijlpalen, aanpassing bij een gemiste
  week). Er zijn spaardoelen in bank en zakgeld en gezinsdromen in de
  foundation, maar geen algemene motor.
- **Gewoonten, slaap, voeding, water, stress, herstel, trainingsbelasting.**
  Geen van deze bestaat als laag.
- **Life Compass** (de zes signalen op één scherm) en de **dagcoach**.
- **Toegankelijkheidsprofiel dat platformbreed doorwerkt.** Er is wel
  `prefers-reduced-motion` in `public/shared/rust.css` en Vitaal zet zelf grotere
  tekst en grotere raakvlakken, maar dat is per pagina geregeld en niet één
  profiel dat heel RTG respecteert. ADHD- en autismemodus bestaan niet.
- **Wearables en apparaatkoppelingen.**
- **Coach-marktplaats en coachportaal.**
- **Multi-vestiging voor zorgorganisaties, resource-planning, wachtlijstmotor.**

## De grenzen die vast moeten staan vóór de bouw

Deze horen in de architectuur en niet in een latere ronde, want ze bepalen hoe
de motoren hierboven eruit mogen zien.

**Drie niveaus, en de AI weet altijd in welk niveau hij staat.**

1. *Lifestyle* -- algemene ondersteuning: ritme, beweging, structuur, rust. Dit
   is waar Balans nu al staat.
2. *Professional-supported* -- een plan dat aan een echte trainer, coach of
   behandelaar hangt. De mens is de eigenaar van het plan, RTG voert uit.
3. *Clinical* -- alleen binnen daarvoor ontworpen workflows. Diagnose, triage en
   behandeladvies horen hier, en RTG doet ze vandaag niet.

De bestaande regel uit `CLAUDE.md` blijft er onverkort boven staan: de AI mag
nooit zelf toegang beloven of verlenen, en nooit claimen dat een boeking
verwerkt is. Voor medicatie geldt hetzelfde: RTG kan een afgesproken schema
ondersteunen, maar een dosering is nooit iets dat uit een taalmodel komt.

**Herkomst van gegevens.** Vier soorten die nooit door elkaar mogen lopen: het
lid zei het zelf, een apparaat mat het, een behandelaar legde het vast, of RTG
leidde het af. Zonder dat onderscheid vanaf het eerste veld wordt een afgeleide
schatting later als een meting gelezen. Dit is dezelfde fout die `LAT.md` regel
10 beschrijft voor meters, en die is hier duurder.

**Wie ziet wat.** Het bestaande intake-model (uitdrukkelijk, per ontvanger, met
einddatum, altijd te stoppen) is het model voor alles wat erbij komt. Een
masseur hoort niet te zien wat een arts ziet; een coach hoort geen
mental-coachgesprekken te zien; een werkgever die een sportbudget aanbiedt hoort
geen individuele gegevens te zien, alleen geaggregeerde.

**De onderkant blijft simpel.** Voor een deel van de leden is RTG Life precies
één scherm: "medicijnen genomen? ja". Dat is Vitaal, en dat is af. Een
enterprise-achterkant mag daar nooit doorheen komen. De functionaliteit mag
groot zijn; het scherm hoort dat niet te voelen.

## Wat een volgende ronde zou doen

In deze volgorde, want elke stap heeft de vorige nodig:

1. Het **toegankelijkheidsprofiel**, platformbreed. Het is de enige die de
   andere apps meteen beter maakt en die niets gevoeligs toevoegt.
2. De **doelenmotor**, want die is de ruggengraat onder sport, slaap, voeding en
   coach; los gebouwd krijgt elk daarvan zijn eigen halve versie.
3. Het **Life Compass**-scherm dat leest uit wat er dan is -- met "niet gemeten"
   waar niets gemeten is, en niet met een nul. Dat is `LAT.md` regel 3 toegepast
   op een gezondheidsscherm, en bij welzijnscijfers is het verschil tussen "geen
   gegevens" en "slecht" niet cosmetisch.

Wat daarna komt (slaap, voeding, stress, coach, marktplaats) hangt aan die drie
en hoort pas daarna aan de beurt.
