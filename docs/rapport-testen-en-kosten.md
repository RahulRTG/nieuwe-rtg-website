# Rapport: testuitslagen en hostingkosten

Datum meting: 21 en 22 juli 2026, stand van commit `33fe748` plus de clips-fix.
Alle metingen komen van de eigen testinstrumenten in deze repo (`npm test`,
`npm run e2e`, `scripts/a11y-scan.js`, `scripts/ast-scan.js`,
`scripts/kruisscan.js`, `scripts/beproeving.js`). Er zijn geen externe
testdiensten gebruikt; alles is herhaalbaar met een kale Node 22.

## 1. De cijfers in het kort

| Meting | Uitslag |
|---|---|
| Unit- en integratietests | 1.408 tests, 1.401 geslaagd, 0 gefaald, 7 overgeslagen |
| Duur volledige suite | ~490 seconden (8 minuten) |
| E2e (echte browser, Chromium) | 11 van 11 geslaagd, ~53 tot 64 seconden |
| Toegankelijkheid (strenge modus) | schoon; 2 adviserende contrastmeldingen |
| Eigen code-scanner (ast-scan) | 697 bestanden, 0 fouten |
| Kruisscan (client tegen server-API) | 0 afwijkingen |
| Beproeving: verwerkte calls | 316.934 in ~3 minuten (~1.761 per seconde) |
| Beproeving: latentie p50 / p95 / p99 | 3 / 13 / 21 ms |
| Beproeving: RAM | 145 MB na laden, 271 MB piek onder vollast |
| Beproeving: herstart met volle database | 0,5 seconde |
| Beproeving: geheugenlek | 0,0 MB per minuut |
| API-dekking | 1.241 endpoints, allemaal voldoende geraakt |
| Regels eigen code | 122.841 |
| Externe dependencies | 0 (dus ook 0 licentie- en supply-chain-risico) |

## 2. Unit- en integratietests

De suite telt 251 testbestanden en draait tegen de echte server met de echte
seed-data (geen mocks van de eigen kern). De 7 overgeslagen tests zijn tests
die alleen zinvol zijn met een echte `ANTHROPIC_API_KEY` of een
Postgres-verbinding; die slaan zichzelf netjes over in plaats van vals groen
te geven.

Wat de suite afdekt, per laag:

- **Kern-modules** (`server/kern/`): elke module heeft een eigen testbestand
  dat het volledige gedrag toetst, inclusief randgevallen (lege invoer,
  verkeerde types, te lange strings, dubbele verzoeken).
- **Routes**: elke route wordt met en zonder geldige sessie aangeroepen;
  rol-scheiding (lid, leverancier, kantoor, techniek) wordt per route getoetst.
- **Geld**: RTG Pay wordt op de cent gecontroleerd, met
  idempotentie-sleutels (hetzelfde verzoek twee keer sturen mag nooit twee
  keer afschrijven) en conservatie (geld verdwijnt nergens en ontstaat nergens).
- **Nieuwste functies**: het werkvenster (3 tests), het aanmeldgesprek met
  Rahul (1 uitgebreide scenariotest) en de algemene pin (1 uitgebreide test,
  inclusief raadslot en foutmeldingen) zijn allemaal groen.
- **Persona-drift**: een test bewaakt dat Rahuls basisprompt de vaste regels
  bevat (nooit "butler", warmtespiegel), zodat een latere wijziging die
  regels niet stilletjes kan slopen.

## 3. E2e in een echte browser

De 11 e2e-scenario's draaien in een echte Chromium tegen een echte server:
registreren, inloggen, chatten, boeken, betalen, het OS-startscherm, de
leveranciersomgeving en de backoffice. Duur: 53 tot 64 seconden voor de hele
reeks. Deze ronde ving eerder deze week een echte fout (een helper die door
de bundelvolgorde in de verkeerde scope belandde); die is verholpen en de
reeks is sindsdien groen.

## 4. De beproeving (stress- en misbruiktest)

`scripts/beproeving.js` is de zwaarste test: hij start een verse server,
zaait een volle kast met data, en vuurt daarna ~3 minuten met 12 werkers op
alle 1.241 endpoints, met alle rollen en met bewust kapotte invoer. Acht
oordelen bepalen slagen of zakken.

Uitslag (sqlite-modus, seed 1234567):

| Oordeel | Uitslag | Toelichting |
|---|---|---|
| ROBUUSTHEID | PASS (na fix, zie onder) | 0 onverwachte serverfouten in 316.934 calls |
| ROL-SCHEIDING | PASS | geen enkel verkeerd-rol token kreeg een 2xx |
| DEKKING | PASS | 0 endpoints te weinig geraakt |
| GELD | PASS | op de cent, idempotent, onzin geweigerd |
| MISBRUIK | PASS | alle 6 morele beproevingen gehaald |
| DUURZAAMHEID | PASS | geld en idempotentie overleefden een herstart |
| GEHEUGEN | PASS | lek-vloer 0,0 MB/min (drempel 40) |
| LATENTIE | PASS | p99 = 21 ms (drempel ~2.168 ms) |

De zes misbruik-beproevingen, voluit: de AI kan de identiteitskluis en de
infrastructuur niet aanraken (403), de AI vraagt bevestiging voor geld
(zonder bevestiging 428), de identiteitskluis blijft dicht voor leden en
anoniemen (401), een lid ziet kantoor en leverancier niet, een kind wordt bij
registratie geweigerd en 18+-functies blijven dicht voor een 16-jarige, en
het stadsbeeld meet dingen en geen mensen.

**Eerlijk vermeld: de test vond een echte bug.** De eerste run eindigde op
7 van 8 met twee serverfouten (van 305.882 calls) in twee clips-functies
die als enige de lazy-init van de clips-lijsten oversloegen. Dat is precies
waar deze test voor bestaat. De fix is aangebracht, de clips-tests zijn
groen en de herbevestigingsrun eindigde op 8 van 8: 316.934 calls
(~1.761 per seconde), 0 serverfouten, maximale latentie 129 ms.

Prestaties onder vollast, ter herhaling: ~1.761 verzoeken per seconde op een
enkele node, p99 van 21 milliseconden, piek-RAM 271 MB, en na drie identieke
leesrondes een lek-helling van exact 0,0 MB per minuut. De herstart met een
volle database duurt een halve seconde, en na de herstart kloppen de saldi
en de idempotentie-sleutels nog steeds.

### Wat deze test niet bewijst

- Eén node met sqlite in een tijdelijke map; geen echte productie-opslag.
- De testdata is rechtstreeks gezaaid, niet via alle echte schrijfpaden.
- De misbruik-beproeving dekt de zwaarste regels, niet elke denkbare vorm.
- Latentie en doorvoer gelden voor deze machine en dit werkpunt; het is
  geen capaciteitsgarantie voor andere hardware.
- De mega-schaal (100 miljoen leden) draait alleen met `DATABASE_URL`
  (Postgres); dit rapport meet de sqlite-standaard.

## 5. Betrouwbaarheid en security, de inventaris

Wat er in de code zit om dit waar te maken:

- **Privacy by design**: klantdata draait op codenamen; echte namen staan in
  een gescheiden, versleutelde kluis (`accounts.js`) met eigen sleutel. De
  AI en de gewone routes kunnen daar niet bij; de beproeving toetst dat.
- **Wachtwoorden en de algemene pin**: scrypt (N=16384, r=8, p=1) met een
  eigen salt per lid, vergelijking via `timingSafeEqual` (geen
  timing-lekken), en een raadslot van 5 fouten per 60 seconden.
- **Rol-scheiding**: elke route controleert de rol server-side; 269.962
  bewust-verkeerde verzoeken in de beproeving leverden nul keer een 2xx op
  voor de verkeerde rol.
- **Werkvenster**: de werkgever bepaalt per weekdag wanneer personeel de
  werkomgeving in kan; dat wordt op beide ingangen afgedwongen (de
  personeels-pin-login en de een-account-start), niet alleen in de interface.
- **Rate-limiting**: per-IP-limieten op de open endpoints (o.a. het
  aanmeldgesprek: 40 verzoeken per minuut), raadsloten op pin en wachtwoord.
- **Journaal met zegel**: het doos-journaal is HMAC-gezegeld, zodat
  achteraf knoeien met de administratie detecteerbaar is.
- **Geld**: idempotentie-sleutels op elke betaling, bevestigingsplicht (428)
  voordat de AI iets met geld mag doen, conservatie-controle in de tests.
- **Herstel**: herstart in 0,5 seconde met behoud van saldi; geen
  geheugenlek over lange leesrondes.
- **Toeleveringsketen**: 0 dependencies betekent geen npm-pakketten die
  stilletjes kunnen wijzigen; de eigen ast-scanner (697 bestanden) en de
  kruisscan bewaken de code zelf.

## 6. Wat kost het om dit online te hebben?

Alle bedragen zijn indicaties (prijspeil medio 2026, euro's per maand,
excl. btw) en aannames staan erbij. De code zelf kost niets: 0 dependencies
betekent 0 licentiekosten, en de bundels zijn klein (grootste app ~722 KB
JavaScript) dus er is geen dure CDN nodig.

### Scenario A: demo of pilot (tientallen tot honderden gebruikers)

Eén kleine VPS is ruim voldoende: de server gebruikt 145 MB RAM na laden en
piekt op 271 MB onder een last (~1.700 verzoeken/s) die een demo nooit haalt.

| Post | Indicatie |
|---|---|
| VPS, 2 vCPU / 4 GB (bijv. Hetzner CX22 of vergelijkbaar) | ~7 |
| Domeinnaam | ~1 |
| TLS-certificaat (Let's Encrypt) | 0 |
| Back-up van `server/data/` naar object-opslag | ~1 |
| **Totaal infra** | **~10 tot 15** |

Sqlite volstaat; een dagelijkse kopie van `server/data/` is de hele
back-upstrategie.

### Scenario B: serieuze start (duizenden leden, echte klanten)

Nu wil je geen enkel punt dat alles platlegt, en een database die los van de
applicatie leeft.

| Post | Indicatie |
|---|---|
| 3 x VPS, 4 vCPU / 8 GB (trio met failover) | ~45 tot 60 |
| Managed Postgres (met automatische back-ups) | ~40 tot 80 |
| Load balancer + vaste IP's | ~10 |
| Transactionele mail (bevestigingen, uitnodigingen) | ~10 tot 20 |
| Monitoring en logboek-opslag | ~15 tot 30 |
| **Totaal infra** | **~120 tot 200** |

### Scenario C: mega-schaal (richting het 100-miljoen-ledenmodel)

De architectuur houdt leden buiten het RAM (het RAM-venster laadt alleen
actieve leden), dus de applicatielaag schaalt met het *verkeer*, niet met
het *ledental*. Bij ~1.700 verzoeken/s per node draag je met 10 tot 20
app-nodes al een heel groot dagverkeer; de database wordt de echte kostenpost.

| Post | Indicatie |
|---|---|
| 10 tot 20 app-nodes | ~300 tot 800 |
| Postgres-cluster met replica's en back-ups | ~800 tot 3.000 |
| Load balancers, opslag, mail op volume, monitoring | ~400 tot 1.200 |
| **Totaal infra** | **~1.500 tot 5.000** |

### De AI-kosten (de echte variabele)

Zonder `ANTHROPIC_API_KEY` draait alles op vaste demo-antwoorden en kost de
AI niets. Met echte AI betaal je per gebruik, niet per maand. Rekenvoorbeeld
met deze aannames: een gemiddeld gesprek van ~8 beurten, per beurt ~2.500
tokens in (systeem-prompt plus context) en ~300 tokens uit.

| Model | Prijs per miljoen tokens (in / uit) | Kosten per 1.000 gesprekken |
|---|---|---|
| Claude Haiku 4.5 | $1 / $5 | ~30 euro |
| Claude Sonnet | $3 / $15 | ~90 tot 150 euro |
| Claude Opus | $5 / $25 | ~150 tot 250 euro |

Kanttekeningen: prompt-caching drukt de invoerkant fors (de systeem-prompt
is elke beurt dezelfde), en het aanmeldgesprek werkt volledig zonder API-key
(deterministische machine), dus dat kost per definitie niets. Een reëel
mengmodel is Haiku voor het dagelijkse werk en een zwaarder model alleen
voor de momenten die erom vragen; dan blijft de AI-post bij duizenden
gesprekken per maand in de tientallen euro's.

### Samengevat

| Scenario | Infra per maand | AI per maand (indicatie) |
|---|---|---|
| Demo / pilot | ~10 tot 15 | 0 (demo-antwoorden) tot ~30 |
| Serieuze start | ~120 tot 200 | ~30 tot 300, schaalt met gebruik |
| Mega-schaal | ~1.500 tot 5.000 | dominant; per gesprek begroten |

De belangrijkste conclusie: de vaste lasten zijn laag omdat de code licht is
(145 MB RAM, 0 dependencies, halve-seconde-herstart) en de variabele kosten
zitten vrijwel volledig bij de AI, waar je per model en per gesprek aan de
knoppen zit.
