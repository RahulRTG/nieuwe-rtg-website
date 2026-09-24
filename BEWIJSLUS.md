# De bewijslus -- van productie terug naar bewijs

Dit is een richtingsdocument in de vorm van `PLATFORM.md` en `ECONOMIE.md`: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is. Het is geen nieuwe laag. Het is het besluit om er GEEN te
bouwen.

## 0. Het besluit in een zin

**RTG krijgt geen architectuur boven de bewijsmachine; de ontbrekende lus wordt
gesloten.** De heenweg staat al:

    wijziging -> veranderbereik -> impactbereik -> Evidence DAG -> proeven
      -> bewijsmatrix -> release-bewijs -> herkomst/SBOM -> Sentinel -> canary

Wat ontbreekt is de terugweg:

    productie -> afwijking -> tegenvoorbeeld -> eerste divergentie
      -> reproductie -> oorzaak -> reparatiebewijs -> blijvende bescherming

Daar komen **vier** nieuwe bouwstenen voor en niet meer: een zoekende
tegenstander, een divergentiepunt, een herhaalpakket en een immuniteitsstap.
Al het andere in dit document is AANSLUITEN op wat er al is.

Het voorstel waar dit uit kwam (24 september 2026) introduceerde eerst een eigen
Sentinel, een eigen statusruimte met acht standen, vier autonomieniveaus en een
Reliability Graph. Alle vier bestonden al onder een andere naam, en drie ervan
waren een zesde ladder geweest. Dit document is de versie die overbleef nadat
dat was nagemeten.

## 1. Wat er staat (de heenweg)

| Stap | Staat als | Stand |
|---|---|---|
| Wat raakt deze wijziging | `scripts/veranderbereik.js`, `scripts/impactbereik.js` | staat |
| Welk bewijs moet opnieuw | `scripts/plan.js` -- Evidence DAG, REUSED / REPROVE / UNKNOWN, fail-closed | staat |
| Routeketen scherm -> route -> bestand -> functie | `EXECUTION_MAP`, `ROUTEBRON`, `SYMBOLEN`, `AANROEPGRAAF`, `SCHERMROUTES` | staat |
| Elf bewijscellen per route | `scripts/bewijsmatrix.js` | staat |
| Verval per route | `scripts/vertrouwen.js` (bewezen / verschaald / verzwakt / geschorst / ongemeten) | staat, versheid per REGISTER en nog niet per route |
| Kan de toets zakken | `mutatie`, `mutatie:scherm`, `sabotage`, `tandeloos`, `leugens` | staat |
| Wat als iets wegvalt | `faalproef`, `verraad` (`server/lib/verraad.js`), `ketenronde`, `chaos` | staat |
| Waardoor ontstond dit | `kern/envelop.js` -- `correlatie` en `oorzaak` | staat, acht velden, gesloten |
| Wat gaat er de deur uit | `release-bewijs`, `imageherkomst`, `sbom` | staat |
| Klopt de uitrol nog met het bewijs | `motor/src/sentinel.rs` (`npm run sentinel:status`, `npm run sentinel:scan`, `npm run sentinel:isolate` en verwanten), vier standen normaal / waakzaam / beperkt / isolatie | staat |
| Klopt de meter zelf | `versheid`, `registerklopt`, `meterklasse`, `overleving:ijking`, `zekerheid` | staat |

Twee dingen hieruit gelden voor de rest van dit document. **De Reliability
Graph wordt niet gebouwd**: de registers hierboven zijn hem samen al, en een
graaf ernaast is de 22e lijst (`OS.md`). En **"een ontbrekende meter is nooit
groen" is geen nieuw principe** maar LAT-regel 12 en `BESTUUR.md`.

## 2. De namen, gemeten

Gemeten op 24 september 2026: het aantal bestanden in `server/`, `scripts/` en
`motor/src/` dat het woord draagt.

| Woord uit het voorstel | Bezet | Door wat |
|---|---|---|
| Sentinel | ja | de Rust-binary `rtg-sentinel`, releasecontrole en geketend auditspoor |
| capsule | ja | `kern/livinglab/capsule.js`, de reproductiecapsule van het Living Lab |
| replay | ja, 37 | in de betekenis van IDEMPOTENTIE: `lib/idemsleutels.js`, `economie/runtime/reconciliatie.js` (`replay: true` is een herhaald antwoord) |
| naspelen | ja | `kern/spellen/naspelen.js` |
| bewijskaart | ja | `scripts/lib/productie-promotie.js`, een sha-kaart van de bronnen |
| hypothese | ja, 20 | vooral het Living Lab (10 bestanden in `kern/livinglab/`) |
| waarneming | ja, 135 | overal |
| tegenproef | ja, 127 | overal, als gewoon woord |
| explorer / verkenner | ja | `kern/studio/`, `kern/beroepenbieb/`, `kern/bureau/` |
| L0-L3, PROVEN ... UNTRUSTED | botst | INT-01, `AFSPRAAK.md` ("geen L1-L4"), `MACHINE.md` (geen zesde ladder) |
| **divergentie** | **vrij** (0) | |
| **immuniteit** | **vrij** (0) | |
| **herhaalpakket** | **vrij** (0) | |
| **bewijsweg** | **vrij** (0) | |
| **bewijslus** | **vrij** | de naam van dit document |

De gevaarlijkste van de bezette namen is `replay`. In dit huis betekent het al
*een tweede aanroep krijgt het eerste antwoord*, en een "replay capsule" ernaast
zou betekenen *een oude fout opnieuw laten gebeuren*. Dat is exact de
`VERMOGENS`-botsing. Het object heet daarom een **herhaalpakket**.

De autonomieniveaus en de acht statussen worden niet vertaald maar afgebeeld:

- Observe en Diagnose zijn `tonen`, Recommend is `klaarzetten`, Contain is
  `uitvoeren`, met `begrensd` als eigenschap van het mandaat
  (`kern/stuur/mandaat.js`). Er komt geen niveau bij.
- PROVEN, EXPECTED, DEGRADED, VIOLATED en UNKNOWN bestaan al als bewezen,
  vermoed/verklaard, verzwakt/verschaald, geschorst en ongemeten/onbekend.
  OBSERVED, NOVEL en UNTRUSTED bestaan niet, en worden **assen** naast de graad
  (par. 9) en geen treden erin.

## 3. Bouwsteen 1 -- de zoekende tegenstander

**Stand: een stap weg.** Dit is het grootste gat, en het gat dat
`BEWIJSMACHINE.md` zelf aanwijst: er is geen zoeker die tegenvoorbeelden
genereert. `sabotage` overtreedt elke wet een keer met opzet, `invoerproef`
stuurt vaste rommel. Geen van beide zoekt.

Hij krijgt een doel in de vorm *zoek een uitvoerbare reeks waarin wet W niet
meer waar is*, en vier assen om te variëren:

    waarden x volgorde x gelijktijdigheid x storing

**Voor geld ligt alle grondstof er al**, en daarom is geld de eerste:

- de wet: `geld-conservatie` in `WETTEN.json`, met een sabotagerecept op
  `kern/pay/boeking.js`;
- het deterministische oordeel: `pay.sluitcontrole()` -- de som van alle saldi
  is exact nul, en geen leden- of partnerrekening staat onder nul;
- de as STORING: de synthetische rail (`server/betaal/synthetisch.js`) kent
  vier afloopen, `betaald`, `geweigerd`, `traag` en `terugboeking`,
  reproduceerbaar gekozen uit de idempotentiesleutel;
- de as VOLGORDE: `magnaat:pomp:rtg` draait al vijf perverse volgordes tegen
  RTG Pay;
- herhaalbaar toeval: `scripts/beproeving.js` heeft al een geseede PRNG
  (mulberry32).

Wat ontbreekt: een generator over REEKSEN in plaats van losse aanroepen,
gelijktijdigheidsschema's, en **krimpen** -- het tegenvoorbeeld terugbrengen tot
de kleinste reeks die nog steeds faalt.

Vier grenzen:

1. **De zoeker oordeelt nooit.** Hij levert kandidaten; het oordeel
   (`tegenvoorbeeld` / `geen tegenvoorbeeld` / `onbekend`) komt uit een
   bestaande deterministische regel. Heeft een wet geen uitvoerbaar oordeel, dan
   kan de zoeker er niet op draaien, en dat staat er met de reden.
2. **Eerst zonder taalmodel.** Generatoren, toestandsverkenning, zaad en krimpen
   zijn reproduceerbaar; een model niet. Een model mag later een zoekrichting
   VOORSTELLEN.
3. **Een tegenvoorbeeld is zaad plus reeks**, en wie hem nog een keer draait,
   krijgt hetzelfde. Een vondst die niet te herhalen is, is geen vondst.
4. **Een vondst promoveert niets vanzelf.** `CODE.md` besluit 4 geldt: hij mag
   melden, en een mens tekent af voordat hij een register raakt.

"Geen tegenvoorbeeld gevonden" is geen bewijs dat er geen is. Het wordt
vastgelegd als *gezocht: zoveel reeksen, deze assen, dit zaad*, en nooit als
`bewezen`.

## 4. Bouwsteen 2 -- de eerste divergentie

**Stand: vraagt een besluit, daarna een stap weg.** De vraag is niet *waar
crashte het* maar *waar werd het voor het eerst onwaar*. Een uitvoering krijgt
semantische ijkpunten:

    E0 intentie -> E1 bevoegdheid -> E2 ingangstoestand -> E3 effectbesluit
      -> E4 opslag -> E5 extern effect -> E6 gebeurtenis -> E7 projectie
      -> E8 uitkomst voor de gebruiker

Per ijkpunt: **verwacht, waargenomen, bron**. De divergentie is het eerste
opeenvolgende paar waarvan het ene klopt en het volgende niet. Dat is een FEIT
over twee waarnemingen, en daarom geen nieuwe graad.

Het besluit: **de envelop is gesloten op acht velden** (`MACHINE.md`) en zegt
met opzet nooit WAT. IJkpunten erin zetten is dus een versiesprong. De vorm die
dat vermijdt is een eigen spoor dat NAAR de envelop verwijst (via `correlatie`),
zoals het uitvoerkapsel dat in `MACHINE.md` ook doet. Dat is de aanbeveling.

Verschillende ijkpunten worden al ergens gemeten, alleen niet op een lijn:
E1 in de schaduw van `server/kern/beleidsmotor/`, E4 door `db/duurzaam.js`, en E6
door de envelop zelf. Het werk is ze naast elkaar leggen, voor een keten tegelijk:
eerst RTG Pay.

Grens: een ijkpunt draagt metadata en relaties, **geen inhoud** -- geen bedrag
naast een codenaam, geen berichttekst. Anders is het spoor een tweede kopie van
de data die het moet bewaken.

## 5. Bouwsteen 3 -- het herhaalpakket

**Stand: een stap weg in de testwereld, een besluit voor productie.** Een fout
wordt een herhaalbaar object:

    identiteit van het artefact en de configuratie, de causale keten,
    de relevante begintoestand, de invoer en gebeurtenissen op volgorde,
    de klok, het zaad, de uitkomsten van afhankelijkheden, de faalpunten,
    en de wetten die hadden moeten gelden

met de eis: hetzelfde pakket op hetzelfde artefact geeft dezelfde logische
uitkomst, voor zover het subsysteem deterministisch te maken is. Waar dat niet
kan, staat dat in het pakket.

Daarboven de **herhaalmatrix**: hetzelfde pakket tegen de vorige release, de
huidige, main en de kandidaat-reparatie. Faalt alleen de huidige, dan is het
zoekgebied al klein, en een automatische bisect daarboven is een stap verder.
De identiteit van het artefact bestaat al (`release-bewijs`, `imageherkomst`).

Het besluit gaat over productie: **wat mag er van een echte fout in een pakket
terechtkomen.** Het Living Lab heeft die vraag al een keer beantwoord, en die
regels worden overgenomen en niet opnieuw bedacht (`kern/livinglab/capsule.js`):
het pakket wordt AFGELEID en niet dichtgeklapt bewaard, draagt **geen
aliassen** (een pakket met codenamen maakt de scheiding ongedaan zodra iemand
het doorstuurt), en bevat de OPZET en niet de ruwe gegevens. Voor een pakket uit
productie hoort daar een bewaartermijn bij, en dat raakt `DPIA.md`.

## 6. Bouwsteen 4 -- immuniteit

**Stand: een stap weg.** Alle onderdelen bestaan; wat ontbreekt is de ene
deterministische vraag na een bevestigde fout: *welke bestaande waarheid had dit
moeten voorkomen?* Drie antwoorden, elk met een eigen weg die al bestaat:

| Antwoord | Betekent | Weg |
|---|---|---|
| A. de wet bestond en de proef had hem moeten vinden | het instrument is onvolledig | ijking van de meter (`meterklasse`, `scripts/lib/ijking.js`) |
| B. de wet bestond, maar geen proef keek naar deze toestand | het zoekdomein is te smal | het krimpresultaat wordt zaad voor de zoeker |
| C. de wet bestond niet | er ontbreekt een waarheid | een nieuwe wet in `WETTEN.json`, met bron en sabotagerecept -- en dat is een besluit, geen afleiding |

Daarna wordt het kleinste tegenvoorbeeld een blijvende toets in de bewijsfamilie
waar het hoort, en die toets moet **zakken op de oude code** voordat hij telt
(LAT-regel 9).

Wat dit oplevert is een meting over de bewijsmachine zelf: dezelfde klasse fout
twee keer is een bevinding over de machine en niet over de code.

## 7. De Architect als uitlegger

**Stand: besloten (`CODE.md` besluit 2), nog niet gebouwd.** Hij wordt geen
analist die door de repository loopt maar de UITLEGGER van deterministische
kennis. De vraag *waarom vertrouwen we deze route* gaat eerst naar een functie
die uit de registers een dossier samenstelt:

    route, bron (ROUTEBRON), keten scherm -> route -> bestand -> functie,
    per bewijscel: bewezen door welk instrument, of ongemeten,
    versheid, en een lijst ONBEKEND

Pas daarna maakt een LOKAAL model er zinnen van (`CODE.md` besluit 3). De lijst
ONBEKEND is vandaag niet leeg, en het dossier moet dat zeggen in plaats van een
getal te verzinnen:

- **zoeken naar tegenvoorbeelden**: bestaat niet (par. 3);
- **mutatie per route**: `mutatie.js` meet per TOETSBESTAND, dus "97 van 98
  mutanten gedood" bestaat voor geen enkele route;
- **waarneming in productie**: bestaat niet (par. 8).

Let op de naam: `scripts/waarom.js` bestaat al en vraagt iets anders (waarom is
deze route ONGEMETEN).

## 8. Waarneming in productie

**Stand: de eerste is een uur werk.** Beschikbaarheid is geen juistheid. De
sonde (`scripts/sonde.js`, reizen in `SLO.json`) kijkt of de server antwoordt,
of de voordeur laadt en of het inlogpad antwoordt. **Hij kijkt niet of het
grootboek sluit** -- terwijl die controle er als route al staat:
`/api/pay/gezond` geeft 200 als `sluitcontrole()` klopt en 500 als niet, en de
kop van `kern/pay/index.js` zegt dat hij "het aan de bewaking meldt". Het wordt
alleen gelezen door `tot-crash`, `ketenronde` en de motorproeven, nooit in
productie. Het wordt dus aan de bewaking gemeld, maar de bewaking kijkt niet.

Vier invarianten om mee te beginnen, en niet meer:

| Invariant | Wat er al is |
|---|---|
| geld: vereffend -> precies een grootboekeffect, en de som sluit | `/api/pay/gezond` -- alleen aansluiten op de sonde |
| gezag: een effect heeft een geldige beslisherkomst | de beleidsmotor telt in de schaduw eens/oneens per kantoordeur |
| privacy: een effect van zaak A raakt niets van B | de isolatiepoort in de schaduw -- maar met een noemer die in productie NUL is (`scripts/isolatieschaduw.js`) |
| gebeurtenissen: een duurzaam geaccepteerde mutatie heeft een traceerbaar gevolg | de envelop, met `oorzaak` |

Grens: ze controleren **relaties en metadata, geen inhoud**. Er komt geen
tweede waarheidsstelsel.

## 9. VERTROUWEN rijker voeden, niet vervangen

De staat van een route blijft zoals `scripts/vertrouwen.js` hem rekent. Daarnaast
komen **assen**, en die worden nooit opgeteld:

- bewijs: uit een proef, uit productie, of allebei;
- versheid;
- betrouwbaarheid van de bron (is het register uit een schone boom gemaakt, is de
  meter geijkt);
- waarneming in productie: aanwezig of afwezig;
- gezocht naar tegenvoorbeelden: ja (hoeveel, welke assen, welk zaad) of nee.

## 10. Onafhankelijkheid van bewijs

**Stand: een stap weg.** Niet *wet W heeft 48 toetsen* maar *langs hoeveel
onafhankelijke bewijswegen wordt W gedragen*:

    geld-conservatie
      routeproef        ja
      herstelproef      ja
      verraad           ja
      ketenproef        ja
      mutatie           ja
      zoeker            nog niet
      productie         nog niet

Geen percentage en geen graad: een lijst per wet. Twee wegen die hetzelfde
orakel of dezelfde helper gebruiken, zijn minder onafhankelijk dan ze lijken, en
dat is te meten op de `AANROEPGRAAF`. Het huis heeft het principe al een keer
toegepast: `scripts/lib/ijking.js` en `test/gelding.test.js` ijken de
onafhankelijkheid van de drie assen van `GELDING.json`.

## 11. De grenzen

1. **Er komt geen laag boven de bewijsmachine**, geen Reliability Graph en geen
   eigen Sentinel. Wat er bijkomt, is een van de vier bouwstenen of het sluit aan.
2. **Geen nieuwe ladder, geen nieuwe gezagsschaal.** Een nieuw begrip is een as
   naast een bestaande graad, of het is een feit.
3. **Een model stelt voor, een deterministische regel stelt vast.** Een
   hypothese is een EXPERIMENTVOORSTEL dat het instrument noemt dat hem kan
   weerleggen (verraad, idemproef, herstelproef ...), en de uitkomst is
   `bevestigd`, `weerlegd` of `niet beslisbaar` -- nooit een oordeel van het
   model. Noemt een hypothese geen instrument, dan is hij niet beslisbaar.
4. **Een productiewijziging door generatieve AI is nooit de volgende stap.**
   Bewijs en de release-authority staan ertussen.
5. **Gezocht en niets gevonden is geen bewezen.**
6. **Een herhaalpakket draagt geen aliassen en geen ruwe gegevens.**

## 12. De volgorde

1. **De sonde leest `/api/pay/gezond`** -- een reis erbij in `SLO.json`. De
   eerste semantische waarneming in productie, voor bijna niets.
2. **Het vertrouwensdossier**: een deterministische functie in `scripts/` die par. 7
   samenstelt, inclusief de lijst ONBEKEND. Raakt `server/` niet.
3. **De zoeker op `geld-conservatie`**, zonder model: reeksen, gelijktijdigheid,
   storing via de synthetische rail, krimpen.
4. **De immuniteitsstap**: de A/B/C-vraag als deterministische indeling na een
   bevestigde vondst.
5. **IJkpunten E0-E8 voor RTG Pay**, als spoor naast de envelop (na het besluit
   in par. 4).
6. **Het herhaalpakket en de herhaalmatrix**, eerst in de testwereld.

Pas als deze lus betrouwbaar rond is, komt de nachtelijke zoektocht: ongebruikte
rekentijd die systematisch toestanden, volgordes, storingen en
gelijktijdigheden afzoekt, waarbij alleen gereproduceerde en verkleinde vondsten
bij een mens terechtkomen. Dat is **jaren weg**, en het staat hier om de richting
vast te leggen, niet als taak.

## 13. Open besluiten voor de eigenaar

1. **IJkpunten naast de envelop of erin** (par. 4). Aanbevolen: ernaast.
2. **Wat van een productiefout in een herhaalpakket mag** (par. 5), en met welke
   bewaartermijn. Aanbevolen: de regels van het Living Lab overnemen, plus een
   termijn, en tot dat besluit alleen pakketten uit de testwereld.
3. **Of `/api/pay/gezond` van buiten bereikbaar mag blijven** zodra de sonde
   hem leest. Hij geeft alleen `{ klopt }` terug, maar is dan wel een openbaar
   signaal over de gezondheid van het grootboek.
