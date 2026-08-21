# PROOF-INCREMENTAL.md — incrementeel bewijs

*Koerswijziging van de eigenaar, 21 augustus 2026. Niet: de suite sneller maken.
Wel: het architectuurcontract voor hoe RTG wijzigingen voortaan accepteert.*

**Lees dit document met PROOF.md ernaast.** Dat beschrijft wat een bewijs ís en
hoe bewijsschuld wordt bijgehouden; dit beschrijft wanneer een bewijs zijn
geldigheid VERLIEST, wanneer het die mag HOUDEN, en hoe dat mechanisch is aan te
tonen. En met LAT.md, want de regel eronder is dezelfde: een bewering zonder
toets is geen bewering.

Het nieuwe idee hier is niet "snellere CI". Het is **incrementeel bewijs**: een
bewijsmatrix die niet telkens opnieuw wordt berekend maar onderhouden.

## 0. De grondwet

> **Snelheid mag alleen voortkomen uit bewezen irrelevantie, nooit uit
> overgeslagen zekerheid.**
>
> **Wat het systeem niet kan bewijzen als irrelevant, behandelt het als
> relevant.**

De eerste zin is het principe; de tweede maakt hem technisch afdwingbaar. Zonder
die tweede is "bewezen irrelevantie" een intentie waar iedere twijfel doorheen
past — met die tweede is elke twijfel automatisch werk.

Dat is dezelfde vorm als `claims.poort()` in de commerciële kern: een bewering
die zich AFGEDWONGEN noemt zonder toets, komt er niet door. Hier geldt hij over
de TIJD in plaats van over een claim, en daarmee is dit geen nieuw principe maar
de bestaande lat, doorgetrokken.

## 1. Waarom deze laag er komt

Op 18–21 augustus 2026 zijn 24 takken tot één verzameling samengevoegd: 623
commits, ~897 → 1058 toetsbestanden. Wat die samenvoeging blootlegde is de
aanleiding, want het was **geen enkele keer** een fout binnen een module.

Alles brak in de **naad tussen** modules, en alles brak **stil**:

| wat | hoe het faalde |
|---|---|
| de verspreide-aanval-rem | de emmer telde; de twee regels die de vertraging uitvoeren waren weg |
| 28 leesroutes | gaven binnen het idem-venster het antwoord van de vorige keer |
| het leerpaspoort | een becijferde toets landde er NOOIT in, ook niet op main |
| The Table | mountregel weg: alle drie de adressen 404 |
| de locatieschakelaar | de knop weg uit het bedieningspaneel, het script bleef |
| het ledenbewijs | drie veldvormen uit drie takken; het kantoor las er één |
| de voorvertoning | opende het paneel en liet de inhoud leeg |
| `dekking.js` | kapte zijn eigen 152 kB antwoord af op 64 kB |

Geen van deze fouten riep om aandacht. Een 200 met oude gegevens, een nette 503,
een emmer die keurig vol liep, een 404 op een module die niemand inlaadt: een
huis dat beleefd faalt is gevaarlijker dan een huis dat schreeuwt.

De tweede les is even hard: **de suite die dit had moeten vangen duurt 2,5 uur**
en werd die week vijf keer afgebroken voordat hij iets zei. Zekerheid die te laat
komt, is geen zekerheid.

## 2. De keten

```
Δ code
  → Reality Index
  → Change Graph
  → Forbidden Graph
  → Risk Propagation
  → Proof Invalidator
  → Assurance Planner
  → Execution
  → Proof Ledger
```

Het doel is niet dat een normale wijziging sneller door 2,5 uur heen komt. Het
doel is dat een normale, veilige wijziging binnen **tientallen seconden tot
enkele minuten** volledig bewijsbaar mergebaar is — en dat een gevaarlijke
wijziging juist méér controle krijgt dan nu.

## 3. De Change Graph

Niet `bestand → toets`, maar de hele lijn:

```
regel/symbool → export → import → contract → route → capability
              → data → scherm → control → bewijs → toets
```

Daarmee weet je niet alleen wát er veranderde, maar wat die verandering kán
beïnvloeden.

### 3.1 Hij is AFGELEID, nooit verklaard

Dit is de belangrijkste invariant van het systeem, en hij komt rechtstreeks uit
de samenvoeging. Elke fout van augustus was er één waar een **verklaring bestond
en de werkelijkheid was weggedreven**:

- `test/dekking.test.js` eiste een veld `journalen` dat het script niet meer gaf;
- `MAG_LOS` in check.js zei dat een scherm met opzet los stond, terwijl
  `BEREIK.json` hetzelfde scherm als schuld verwachtte;
- het commentaar in `voordeur.js` beschreef een scriptvolgorde die de code niet
  meer had.

Een Change Graph die zelf een onderhouden artefact wordt, rot precies zo. Hij
wordt daarom **per commit uit de code gerekend** en nergens bijgehouden.

### 3.2 Onzekerheid is een gemeten grootheid, geen gevoel

Een graaf die zegt "nul onzekerheden" moet dat kunnen **bewijzen**. Daarom telt
hij zichzelf, per commit:

```
known edges          — mechanisch vastgesteld
potentially relevant — bereikbaar, nog niet uitgesloten
unresolved edges     — niet te bepalen (samengesteld adres, dynamische require,
                       reflectie, generatie op runtime)
```

`unresolved > 0` is geen storing maar een **feit met gevolgen**: alles wat aan
zo'n kant hangt valt terug op de bredere set. `scripts/lib/bereik.js` zegt dit al
over zijn eigen meting — *"Wat dit NIET ziet: een adres dat een script uit
stukjes samenstelt. Het is dus een ONDERGRENS."* Die houding wordt hier de regel,
en het getal komt in de uitslag te staan.

## 4. De Forbidden Graph

**Dit is de grootste veiligheidswinst in dit document, en het huis heeft hem half
al.**

Leg niet alleen vast wat iets gebruikt, maar wat **nooit mag gebeuren**. Vijf
werkwoorden:

```
MUST_NOT_REACH     gast              ─╳→  bankDeur
MUST_NOT_READ      business-export   ─╳→  Foundation-data
MUST_NOT_WRITE     kind (t/m 15)     ─╳→  open sociale laag
MUST_NOT_EXPORT    codenaam          ─╳→  echte naam (buiten de kluis om)
MUST_NOT_EXECUTE   walletsaldo       ─╳→  bankrekening (TOKEN.md, gesloten circuit)
```

De gluurronde (*mag A bij de spullen van B*) en de rolronde (*welke rol komt waar
binnen*) beweren dit al — maar dynamisch, achteraf, en alleen waar iemand een
toets schreef. `WALLET_SALDO` in `kern/bevoegdheid/lijst.js` is letterlijk een
verklaarde verboden kant, nu nog in proza.

Ze formaliseren tot statisch controleerbare regels maakt ze bestand tegen het
geval waarin niemand eraan dácht een toets te schrijven. **Daarmee worden het
architectuurregels in plaats van alleen toetsen.** Een wijziging wordt dan niet
alleen gecontroleerd tegen wat hij raakt, maar tegen wat hij mogelijk maakt.

## 5. Risk propagation

Risico komt niet uit de vorm van de diff maar uit **capability-, data- en
control-context**, en verspreidt zich transitief door de graaf.

**De vorm van een wijziging liegt.** Twee voorbeelden uit augustus:

- De inlogrem verloor twee regels. Wat de diff toont is *het verwijderen van een
  `await`* — `implementation`. Wat het wás: de doelemmer telde nog wel maar remde
  niet meer, en dertig gokken van dertig adressen liepen weer op volle snelheid.
  Dat is `security`.
- `open = vind(id); if (!open) return;` werd `const g = vind(id); if (!g) return;
  open = g;`. Puur `implementation` — en het repareerde een scherm dat voor elk
  lid een bestand opende zonder ooit de inhoud te tonen.

Daarom: **de risicoklasse wordt geërfd langs de graaf, met de semantische diff
alleen als ondergrens.** Ligt een gewijzigde regel binnen iets dat bereikbaar is
vanuit een capability die als `security`, `money` of `identity` geklasseerd is,
dan is de wijziging dat ook — hoe onschuldig hij eruitziet.

Klassen: `cosmetic`, `implementation`, `contract`, `authorization`, `schema`,
`money`, `security`, `public API`.

| gebied | wat er automatisch bij komt |
|---|---|
| formatter, weergave, tekst | lichte controle |
| `may_execute`, autorisatie, objectgrens | negatieve toetsen, IDOR, replay |
| geld, betalen, wallet | daarbovenop: audit, concurrency, idempotentie |
| identiteit, kluis, codenamen | daarbovenop: mutatietoetsen |

## 6. Structurele fail-fast: seconden, niet uren

De fouten van augustus horen nooit een volledige suite te bereiken. Vóór alles
andere, en elk hiervan onmiddellijk rood:

```
parse → exports/imports → mounts → routes → HTML-assets → contracts → schema
```

Dit is de goedkoopste stap in het document en hij heeft zich al bewezen. Drie
ad-hoc scans, geschreven tijdens de samenvoeging zelf, vonden in één nacht:

- **86 namen** in 41 toetsbestanden die kaal werden gebruikt en nergens
  binnengehaald;
- **8 exports** die uit `test/helper.js` waren gevallen;
- **29 `<script>`- en `<link>`-verwijzingen** die een tak wel had en de
  samenvoeging niet — waaronder de hele adaptieve laag;
- **één routemodule** die de router niet kende, gevonden door de bron naast de
  router te leggen.

## 7. Bewijs: hash, erfelijkheid, en drie verdedigingslagen

### 7.1 De afdruk

Een groen bewijs blijft geldig zolang **al** zijn invoer dezelfde afdruk heeft:

```
source → config → schema → fixtures → control/policy → test implementation
      → Node/runtime → browser + build → OS/arch → TZ/locale → toolchains
      → feature flags → database-engine/version
```

De omgevingsdelen staan er niet voor de sier. Augustus leverde drie
omgevingsverschillen op die de uitslag écht veranderden:

- een Chromium-bouw die een raakvlak op **43,99 px** meet waar een andere 44,00
  zegt — en de poort eist 44;
- een ontbrekende **`cargo`**, waardoor twee toetsen van de Rust-motor zakken op
  de ene machine en slagen op de andere;
- de **tijdzone**: twee toetsen zakten tussen 00:00 en 02:00 CEST en slaagden
  daarna weer, omdat de ene kant UTC las en de andere lokale tijd.

Een bewijs dat over een browserbouw, een toolchain of een TZ heen erft, is
aantoonbaar onjuist.

### 7.2 Erfelijkheid

Is bewijs A geldig op commit `abc123`, en raakt `abc124` niets binnen de
dependency-closure van A, dan geldt formeel:

```
A@abc124 = inherited(A@abc123)   — met de reden waarom dat veilig is
```

De bewijsmatrix verandert daarmee van iets dat telkens opnieuw wordt berekend in
iets dat **incrementeel wordt onderhouden**. Dat is het eigenlijke onderwerp van
dit document.

### 7.3 Drie lagen tegen vals vertrouwen

Erfelijkheid alleen is niet veilig genoeg. Er zijn drie lagen nodig, en ze
dekken elkaars gat:

**1. Expiration — oud bewijs moet opnieuw.**
Erfelijkheid maakt een fout bewijs onsterfelijk, en dat is geen theoretisch
bezwaar. In augustus bleek dat een becijferde schooltoets *nooit* in het
leerpaspoort landde — niet sinds de samenvoeging, maar over de hele looptijd:
`foundation.js` gaf de onderwijskern nooit door aan `school.js`, dus
`bewijsNaarPaspoort()` gaf altijd nul terug en `/school/bewijs/leerling`
antwoordde altijd 503. Het vangnet dat bedoeld was voor de eerste seconden na het
opstarten, dekte alles af. Was daar ooit een groen bewijs voor geweest, dan had
dit model het tot in de eeuwigheid geërfd — de invoer veranderde immers niet.
Dus: **hooguit N commits of T dagen, daarna één keer echt draaien.**

**2. Sampling — ook jong geërfd bewijs wordt soms gecontroleerd.**
Zegt de motor "deze 19.800 bewijzen hoeven niet opnieuw", neem daar dan continu
een kleine willekeurige steekproef uit en voer die tóch uit. Faalt een geërfd
bewijs onverwacht, dan heb je niet één falende toets gevonden maar iets veel
ergers: **de impactberekening zelf is verdacht.** De motor mag daarop
zelfstandig reageren — de inheritance-zone vergroten, of erfelijkheid tijdelijk
blokkeren tot de graaf weer klopt.

**3. Fail-closed — onzekerheid betekent meer toetsen.**
Zie 0 en 3.2. Wat niet als irrelevant te bewijzen is, is relevant.

Expiration vangt de fout die er altijd al was. Sampling vangt de fout in de
impactberekening. Fail-closed vangt wat de graaf niet kan zien. Alleen samen zijn
ze genoeg.

## 8. De machinerie

- **One-pass semantic indexer.** Elke commit wordt één keer geparsed. Die ene
  index (de *Reality Index*) levert exports, imports, routes,
  HTML-afhankelijkheden, capabilities, dataflows, contracts, code-bytes, controls
  en dependency-randen. Niet acht scanners die acht keer dezelfde bestanden
  lezen.
- **Ephemeral merge twin.** Elke PR wordt vóór de merge opgebouwd alsóf hij al
  met main samengevoegd is, en dáárop draait de bedradingsanalyse. Dat richt zich
  precies op de fouten van augustus — inclusief de klasse die niemand verwacht:
  een bestand dat main had verwijderd en dat de merge terugbracht
  (`test/wereld.e2e.js`, dat twintig seconden wachtte op een klok die er niet
  meer is).
- **Dynamische parallellisatie op WERK, niet op bestanden.** Workers halen werk
  uit een wachtrij; geen vaste shards, dus geen trage shard die de rest ophoudt.
- **Historisch zelflerende planner.** Onthoud welke wijzigingen welke toetsen
  ooit lieten zakken, welke toetsen samen zakken, looptijd, flakkergedrag, en
  welke modules vaak conflicteren. De graaf zegt "41 toetsen"; de historie zegt
  "dit soort wijziging brak drie keer iets onverwachts in module X" — en dan
  komen die zeven erbij.

### 8.1 Persistente runners komen als laatste, en niet eerder

Warme processen met gereset toestand schelen enorm veel opstartkosten. Maar ze
maken tijdsafhankelijk gedrag veel meer verweven, en dit huis heeft daar nu geen
grond voor: **1303 directe tijdsaanroepen** staan buiten `server/lib/klok.js`
(KLOK.json). Augustus liet al zien wat het idempotentievenster van vijf seconden
met drie toetsen deed zodra de timing verschoof.

**De klokschuld moet dus grotendeels afgelost zijn vóórdat runners warm blijven.**
Anders koop je snelheid met een nieuwe klasse flakkers die niemand kan
reproduceren — precies wat de grondwet verbiedt.

## 9. De uitslag

Een merge levert geen `✅ 4.000 tests passed` meer op, maar een verklaring:

```
MERGEABLE — PROVEN

    27  semantische objecten gewijzigd
   163  afhankelijke objecten geraakt
    41  bewijzen ongeldig verklaard
20.895  bewijzen behouden
    37  opnieuw bewezen
     4  hoog-risico bewijzen diep getoetst
   214  geërfde bewijzen bemonsterd: 214 consistent
     0  onopgeloste dependency-randen
     0  verboden paden geïntroduceerd
        omgevingsafdruk komt overeen
```

Dat is niet alleen informatiever — het is **narekenbaar**. Elk getal hierboven
komt uit een register dat een mens kan openen, en elke nul is een bewering die
zichzelf kan verantwoorden.

## 10. De volgorde

Dit is een half jaar bouwen, en de verkeerde volgorde kost het meest.

1. **One-pass semantic indexer.** Broncode één keer begrijpen. Nog geen
   ingewikkelde beslissingen.
2. **Wiring/structural gate.** Exports, imports, routes, mounts, scripts, assets,
   contractvormen. Onmiddellijk rendement.
3. **Graph completeness / uncertainty model.** Expliciet een eigen stap, en vóór
   alles wat erop gaat leunen: `known / potentially relevant / unresolved`. Een
   graaf die "0 onzekerheden" zegt, moet dat kunnen bewijzen.
4. **Forbidden Graph.** MUST_NOT_REACH / READ / WRITE / EXPORT / EXECUTE.
5. **Risk propagation engine.** Transitief, uit capability-, data- en
   control-context.
6. **Semantic change analysis.**
7. **Proof invalidation + inheritance.** Vanaf dag één inclusief expiration,
   omgevingsafdruk en random revalidation — niet als latere toevoeging.
8. **Incremental assurance planner.** Pas hier komt de grote snelheidswinst: wat
   moet werkelijk opnieuw bewezen worden?
9. **Dynamische parallelle uitvoering.**
10. **Persistente runners.** En pas nadat de 1303 directe tijdsaanroepen
    voldoende onder controle zijn.

## 11. De grenzen

Vijf dingen die niet mogen sneuvelen, hoe verleidelijk snelheid ook is.

**Onzekerheid verbreedt, nooit versmalt.** Wat niet als irrelevant te bewijzen
is, is relevant. "Waarschijnlijk niet geraakt" bestaat niet.

**Een bewijs erft niet eeuwig, en niet onbemonsterd.** Zie 7.3. Zonder expiration
vereeuwigt dit systeem een fout in plaats van hem te vinden; zonder sampling
merkt niemand dat de impactberekening zelf scheef staat.

**De risicoklasse komt uit de graaf.** Een classificator die naar de vorm van de
diff kijkt, ziet een verdwenen `await` in een beveiligingslaag aan voor opmaak.

**Een verboden pad is een architectuurregel, geen toets.** Wie hem alleen
dynamisch controleert, controleert alleen waar iemand aan gedacht heeft.

**Er komt geen tweede waarheid.** Dit document beschrijft een laag die uit de
code wordt afgeleid. Zodra er een handgeschreven register bij komt dat zegt wat
waarvan afhangt, is dat register vanaf dat moment aan het verouderen — en dan
heeft deze laag precies de fout waar hij tegen gebouwd is.

## 12. Wat er bewust NIET komt

- **Geen "draai minder omdat het lang duurt".** Zie de grondwet.
- **Geen graaf die met de hand wordt bijgehouden.** Zie 3.1.
- **Geen erfelijkheid zonder expiration én sampling.** Zie 7.3.
- **Geen warme runners vóór de klokschuld.** Zie 8.1.
- **Geen classificatie op diff-vorm alleen.** Zie 5.
- **Geen groen dat niet kan uitleggen waarom het groen is.** Zie 9.
