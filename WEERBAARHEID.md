# RTG Weerbaarheid — de compromis-bestendige architectuur

*Stand: 8 september 2026. Richtingsdocument zoals `PLATFORM.md`, `EXECUTIE.md` en
`HDI.md`: per onderdeel staat er of het **staat**, **een stap weg** is, **een
besluit vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar
aanziet.*

De lat waar alles aan hangt:

> **RTG gaat ervan uit dat mensen worden misleid, AI wordt gemanipuleerd,
> apparaten worden overgenomen, credentials uitlekken en onderdelen van RTG zelf
> ooit gecompromitteerd raken — zonder dat één van die gebeurtenissen
> automatisch tot systeemcompromis leidt.**

Dat is een omkering van de vraag die `SECURITY.md` stelt. Daar staat *welke
aanvallen houden wij tegen*; hier staat *wat overleeft één geslaagd compromis*.
De eerste vraag is eindeloos en de tweede is telbaar — en alleen de tweede kan
zakken.

Waarom dit document niet `AANVAL.md` heet: `scripts/aanval.js` bestaat al en is
de aanvalsbatterij. Een document met die naam zou lezen als de handleiding
daarbij, en dat is het niet.

---

## 0. De meting vóór de bouw

Dit huis heeft twee keer duur betaald voor een laag die eroverheen werd
*verklaard* in plaats van in de domeinen *gevonden*: `Asset`
(`OBJECTMODEL.json`) en de capability-grammatica (`CAPABILITEIT.json`, 21
lijsten, 250 leden, 91% in precies één lijst). Daarom is deze ronde eerst
gemeten en pas daarna opgeschreven.

**De uitkomst is streng en gunstig tegelijk: van de vijfentwintig voorstellen
staan er veertien al, onder een andere naam.** Het werk is dus grotendeels
aansluiten en hernoemen, niet uitvinden. En vier voorstellen botsen met een
besluit dat dit huis al heeft genomen; die staan in par. 2 en 5 met de reden.

## 1. Wat er al staat, onder een andere naam

| Voorstel | Bestaat hier als | Stand |
|---|---|---|
| Intent Envelope (2) | `kern/stuur/goedkeuring.js` zet pad + body server-side vast, eenmalig token, 5 min, max 8 open per identiteit, interne goedkeuring als `Symbol` dat niet uit JSON te maken is | **een stap weg** — de velden ontbreken, de vorm niet |
| Bewijs achteraf (2) | `kern/stuur/bon.js` — wat gebeurde, waarom het mocht, wat de bewijsstand was, wat er níét is gemeten | **staat** |
| Plan-brede keuring (2) | `kern/commercie/voornemen.js` — de keuring gaat over het TOTAAL, en een goedgekeurd plan kan niet meer veranderen (vingerafdruk) | **staat** |
| Apparaat-identiteit (3) | `apparaat` is één van de **zes dragers** in `kern/isolatie/dragers.js`; `kern/isolatie/apparaatsleutel.js` leidt een stabiele toestelsleutel af uit een passkey, via HKDF-domeinscheiding | **een stap weg** — de as staat, de treden niet |
| Continuous authorization (4) | `kern/frictie/` — `hand` / `assist` / `auto`, per geval berekend uit grondslag, bedrag, aantal, omkeerbaarheid en zekerheid, **met de opbouw van de score erbij** | **staat** |
| Ondergrens die niet mag zakken (4, 12) | `kern/frictie/bodem.js` — *frictie mag omhoog van de omstandigheden, en omlaag van niets* | **staat** |
| Risico- en schadeklasse per handeling (17) | `kern/handelingsklasse.js` — klasse, bron én bewijsgraad per waarde, met `onbekend` als eersteklas uitslag | **staat** |
| AI als eigen principal (7) | `kern/envelop.js` draagt actor, correlatie, oorzaak en classificatie; `kern/service/onderzoeker.js` gebruikt het voorvoegsel `ai:` dat niemand zelf kan zetten | **een stap weg** |
| Taint tracking (8) | `kern/isolatie/herkomst.js` (4 klassen, 13 kanalen, 8 verboden effecten) + `kern/stuur/besmetting.js` + de poort bij `doe` in `kern/stuur/lusstap.js` | **staat, bijt niet** |
| Security control plane (11) | `CONTROLPLANE.md` — vier dimensies, delegatie kan alleen versmallen, **acht uitkomsten** waarvan `ONBEKEND` met opzet géén synoniem van `WEIGEREN` is | **staat als model** |
| Cooling-off + tweede paar ogen (12, 14) | `kern/isolatie/ceremonie-eisen.js` — reden, passkey, wachttijd, tweede mens, met per stap of hij écht wordt gecontroleerd | **staat, één kant** |
| Step-up op bezit (12) | `server/kern/zwaarbewijs.js` — verse passkey per zware handeling, terugval nooit stil (kritieke melding), `passkey-weg` zit zelf in de zware lijst | **staat, 6 routes** |
| Intrekking wint (Wet 7) | `server/pgaccounts-intrekking.js` — outbox met SHA-256-vinger, rij verdwijnt pas nadat Redis de vervalsleutel atomisch heeft gezet én gepubliceerd | **staat** |
| Security fault injection (19) | `scripts/sabotage.js` (zet de handhaver van een wet uit en eist rood) + `server/lib/verraad.js` (4 ingebouwd, 5 voornemen) + `server/opzet/liegpoort.js` | **staat, verkeerd gericht** |
| Supply chain (22) | `scripts/imageherkomst.js` — SBOM (CycloneDX 1.5) uit het image zelf, Ed25519-handtekening die stuklijst, image-digest en bron bindt; `scripts/release-bewijs.js` hasht de bron | **staat, geen transparantielogboek** |

**Wat werkelijk vanaf nul begint zijn er drie**, en dat is een korte lijst:
kortlevende workload-identiteit (par. 6 — mTLS en een interne CA staan er wél,
zie par. 4), lokvermogens (par. 15) en de cryptografie-inventaris (par. 24). De
overlevingsmeter stond ook in dit rijtje en is er sinds 8 september 2026 uit:
`scripts/overleving.js` draait, ijkt zichzelf en hangt in CI.

## 2. Vier namen zijn bezet, en één begrip botst

`SEMANTIEK.json` meet dit huis op precies deze fout: 100 namen dragen meer dan
één betekenis, samen 284 betekenissen. `kern/frictie/index.js` legt in zijn kop
uit waarom hij geen `risico` heet — dat woord was al twee keer bezet. Diezelfde
toets geldt hier.

| Naam uit het voorstel | Al bezet door | Voorstel |
|---|---|---|
| **envelop** | `kern/envelop.js` — de gebeurtenis-envelop op de bus (id, tijd, versie, kanaal, actor, correlatie, oorzaak, classificatie) | **`intentiebewijs`** (vrij; nul treffers in de boom) |
| **voornemen** | `kern/commercie/voornemen.js` — het execution plan | niet hergebruiken; het intentiebewijs zit eronder, niet ernaast |
| **canary** | twee keer: de uitrol-canary (`kern/command/`) en de ruis-kanarie (`scripts/ruis-canary.js`) | **`lokvermogen`** / **`lokobject`** (allebei vrij) |
| **mandaat** | drie keer: `kern/stuur/mandaat.js`, `kern/fiscaal/gateway/mandaat.js`, het bestuursmandaat in `kern/stadsweefsel/` | de eerste houden, de andere twee niet aanroepen vanuit deze laag |
| **capability** | `OS.md`: platformvermogen tegenover domeinvermogen (genre-cap) | par. 5 hieronder — het smalle uitvoeringsbewijs is géén nieuwe capabilitylijst |

En één inhoudelijke botsing die zwaarder weegt dan een naam: **de vijf uitkomsten
uit voorstel 11 (`ALLOW / DENY / STEP-UP / QUARANTINE / REQUIRE_SECOND_PERSON`)
zijn een tweede vocabulaire naast de acht van `CONTROLPLANE.md`.** Daar is
`ONBEKEND` met opzet iets anders dan `WEIGEREN` — *een storing hoort niet te
klinken als een overtreding*. Twee uitkomstenlijsten naast elkaar is exact de
`VERMOGENS`-fout uit `OS.md`. De vier ontbrekende uitkomsten worden dus
**toegevoegd aan de bestaande acht**, niet ernaast gezet.

## 3. De acht wetten — en waar ze thuishoren

Dit huis heeft de machinerie voor wetten al: `WETTEN.json` (46 wetten, elk met
bron én handhaver) en `scripts/sabotage.js`, die per wet de handhaver uitzet en
eist dat er iets rood wordt. Dat is precies wat voorstel 18 en 19 vragen.

**En hier zit een gat dat de meting blootlegde: van die 46 wetten gaat er geen
enkele over beveiliging.** De vier die er wél zijn — `SEC-LOCK-001` tot en met
`SEC-LOCK-004` — leven alleen in codecommentaar en in `test/seclock.test.js`.
Ze staan niet in het register, dus `npm run sabotage` heeft ze nog nooit
geprobeerd te breken. Een wet zonder plek in het register is een wet waarvan
niemand meet of hij bijt.

*Stand 13 oktober 2026, en de alinea hierboven blijft staan als de meting van
toen:* de vier SEC-LOCK-wetten staan inmiddels wél in `WETTEN.json` (soort
`beveiliging`, nu 55 wetten in totaal), en `SABOTAGE.json` van 11 oktober zegt
voor alle vier `raak`. Van de acht wetten uit de tabel hieronder staat er nog
geen enkele in het register. Zie par. 9.

| Wet | Handhaver vandaag | Stand |
|---|---|---|
| 1 · Onvertrouwde informatie vergroot nooit capabilities | `kern/isolatie/herkomst.js` + `kern/stuur/lusstap.js` | **telt, bijt niet** (`RTG_HERKOMST_AFDWINGEN` ≠ 1) |
| 2 · Geen actor vergroot zijn eigen bevoegdheid | `CONTROLPLANE.md`: delegatie versmalt structureel; `kern/stuur/mandaat.js` | model staat, **0 aanroepers** |
| 3 · Geen AI produceert een menselijke bevestiging | `kern/stuur/goedkeuring.js` (`Symbol`), `test/stuur-aanval.test.js` met vijandig model | **staat, met toets** |
| 4 · Geen gedeelde credential autoriseert een kritieke handeling | — | **geen handhaver**: 460 van 586 kantoorroutes |
| 5 · Niemand verzwakt kritieke beveiliging alleen | `kern/isolatie/ceremonie-eisen.js` (SEC-LOCK-001) | staat voor de isolatiestand, **0 kantoorroutes** |
| 6 · Onbekende herkomst valt naar minimale bevoegdheid | `herkomst.js` `klasseVan()`, SEC-LOCK-004, `handelingsklasse.js` | **staat als vorm**, dekking 1 van 13 kanalen |
| 7 · Intrekking wint van eerder verleend vertrouwen | `pgaccounts-intrekking.js` | **staat**, niet als wet geregistreerd |
| 8 · Elke kritieke mutatie draagt cryptografisch bewijs van intentie | `goedkeuring.js` (pad + body, niet cryptografisch) | **een stap weg** |

De eerste opdracht is dus niet acht wetten schrijven maar **de twaalf die er zijn
(vier SEC-LOCK plus deze acht) in `WETTEN.json` zetten met hun handhaver, en
`npm run sabotage` erop richten.** Dan bestrijdt het huis meteen wat voorstel 19
noemt: beveiliging die groen blijft terwijl zij uit staat.

**Eén tegenspraak niet wegpoetsen.** `CLAUDE.md` zegt dat `kluispoort.js` aan 8 van de
585 routes hangt; `KANTOORMACHT.json` (6 september) telt `kluisAuth` op **5** van de
586. Twee bronnen, twee getallen, en er wordt hier geen winnaar gekozen — dat is de
regel van `EXECUTION_MAP.json`: waar twee bronnen elkaar tegenspreken staat
`ONBEPAALD` en nooit stil een winnaar. Wat vaststaat is de orde van grootte: een
handvol van de 586.

### 3a. De eerste zeven deuren, en de vier die terug moesten

Op 9 september staan er zeven kantoorroutes bij die een **naam** vragen in plaats
van de gedeelde code: `bank/rekening/open`, `/rood`, `/bevries`,
`bank/krediet/besluit`, `bank/salaris/run`, `bank/incasso` en
`office/export.csv`. De regel eronder is één zin: **wat geld verplaatst, een
recht verleent of bulk uitvoert, vraagt een mens; gewoon lezen niet.**

Er stonden er eerst elf, en de vier die eraf gingen zijn leerzamer dan de zeven
die bleven. Het waren allemaal **lezingen** — het kredietbord, het
salarisvoorstel, de bevoegdheidsmatrix en de machtskaart — en `KANTOORMACHT.md`
zet `ENFORCE_EXECUTE` bewust vóór `ENFORCE_READ` omdat lezen élk scherm raakt
voor de kleinste risicoreductie. Dat bleef geen theorie: `bankVervers()` in
`kantoren.html` haalt het kredietbord en de matrix in één `Promise.all` op, dus
de hele bankkamer viel om en een schermtoets die daar niets mee te maken had
zakte. Een zichtbare ingang naar een onbereikbare functie is een productdefect,
ook als elke regel code klopt (`BETROUWBAARHEID.md` bewijs 1).

**Twee dingen die deze ronde blootlegde en die geen van beide over de deur
gingen.** De `ZWAAR`-lijst in `scripts/kantoormacht.js` matchte op
**onderwerpen** (`bank/krediet`) terwijl haar drie klassen **effecten** zijn, en
telde daardoor vier lezingen als zwaar. Een ondergrens mag dingen missen; hij mag
niet iets aanwijzen dat er niet is — een valse `nee` stuurt de volgende lezer
naar een deur die niets oplevert, en daarna gelooft niemand de meter meer. En de
CSV-knop in de backoffice deed `if (!r.ok) return;`: een verhindering zonder
reden, wat `GRAMMATICA.md` verbiedt. Dat viel jaren niet op omdat hij altijd
slaagde. **Een deur dichtzetten is de goedkoopste manier om te ontdekken welke
foutafhandeling er nooit is geweest.**

**De prijs staat hardop.** `anoniemUitvoerbaar` ging van 365 terug naar
<!--getal:kantoor.anoniem-->342<!--/getal-->, en die teller mag alleen dalen. De
verhoging staat daarom uitgeschreven in `KANTOORMACHT.json` zelf — met de reden
en met wat hem weer omlaag brengt — in de vorm van de `OPEN_MAX`-verhoging uit
`SERVICE.md` par. 13, en `test/kantoormacht.test.js` toets 6b weigert voortaan
een verhoging zonder allebei. Dat is nog altijd 16 lager dan `main` (385). Wie
een ratel omzeilt zonder het te zeggen, sloopt de ratel zelf.

### 3b. Drie besluiten, uitgevoerd — en wat elk ervan opleverde

De eigenaar heeft op 9 september vier keuzes gemaakt. Drie leidden tot code, de
vierde was met opzet *niet nu*.

**Vier ogen op rood-staan en de incassoronde, en met opzet niet op bevriezen.**
`kern/kantoor/tweedehandtekening.js`: de aanvrager vraagt, een collega met een
eigen kantooraccount bevestigt, en pas dan gebeurt er iets. Bevriezen blijft één
handtekening omdat het omkeerbaar is én de knop is waarmee je fraude *stopt* —
twee mensen eisen maakt de rem trager dan de diefstal. Een strengere deur is niet
vanzelf een veiligere, en dat is de enige plek in deze ronde waar dat expliciet
tegen elkaar is afgewogen.

**De herkomstpoort gaat nog niet bijten; eerst tellen.** De poort liep al in de
schaduw, maar telde *per gesprek* en verdween daarna — dus de vraag "hoe vaak zou
hij bijten" was onbeantwoordbaar en de vlag omzetten een gok.
`kern/stuur/schaduwtelling.js` telt over gesprekken heen, per wereld en per pad,
met een leesweg in de boardroom. Het is een **teller en geen journaal**: geen
identiteit, en een pad met een id erin wordt geschuild in plaats van weggelaten —
weglaten zou het getal stil verlagen. En de uitslag zegt zelf dat hij niet
bewaard is, met zijn begindatum erin, zodat "achttien" niet als een totaal over
de levensduur wordt gelezen.

**Het mandaat wordt niet gebouwd.** `kern/stuur/mandaat.js` blijft grammatica met
nul aanroepers, en dat is de juiste stand: *leeg is dicht*, dus naïef aansluiten
geeft de assistent nul paden in plaats van minder. Een mandaat is pas zinvol
naast een lopende autonome handeling, en die is er niet.

**`zwaar` wordt gemeten en niet geraden — en de meting zegt vooral hoe blind zij
is.** `scripts/lib/zwaareffect.js` leest uit `IDEMPROEF.json` welke collecties een
route werkelijk aanraakte. Over de kantoorroutes haalt hij **10,6%**, en binnen
dat deel vond hij géén verborgen geldbeweging: de drie treffers zijn alle drie
lezingen of onderhoudsrondes. Maar **12 van de 13 zware routes zijn onmeetbaar** —
de bankknoppen vragen een levende bank, een geldig IBAN en een lid met een
rekening, en die wereld zet de proef niet op. `zwaarZonderMens: 0` blijft dus een
geruststelling met een ondergrens eronder; het verschil is dat die ondergrens nu
een getal heeft. De twee assen worden **nooit opgeteld**: de padas mist een route
die geld beweegt onder een onschuldige naam, de effectas mist elke route die de
proef niet aan het werk kreeg, en een som van twee ondergrenzen is niets.

**Wat het dichtzetten opleverde buiten de deuren zelf.** Drie stille gebreken
kwamen alleen aan het licht doordat er iets veranderde: de CSV-knop in de
backoffice deed `if (!r.ok) return;` (jarenlang onopgemerkt omdat hij altijd
slaagde), de incassoknop meldde "Niets aan de beurt" op een aanvraag, en
`test/herkomstlus.test.js` toets 3 mat de bijtende poort niet meer omdat de
schakelaar zijn omgeving één keer leest. **Een deur dichtzetten is de goedkoopste
manier om te ontdekken welke foutafhandeling er nooit is geweest.**

## 4. Single Compromise Survivability — de nieuwe lat

De meeteenheid is niet een route en niet een score, maar een zin die per
kroonjuweel te beantwoorden is: *als dit één ding wordt overgenomen, houdt RTG
dan stand?* Voor de kroonjuwelen — geld bewegen, identiteit wijzigen, de kluis
lezen, bulk exporteren — moet elk antwoord **JA** zijn.

**Dit is sinds 8 september 2026 een METER en geen tabel** (`npm run overleving`,
`OVERLEVING.json`). Dat is geen opsmuk: de eerste versie van deze paragraaf was
een tabel met de hand, en drie van de acht regels erin waren fout. Een tabel kan
niet zakken, en een tabel wordt niet nagerekend.

De meter leest per rij een echte bron, draagt per rij een bewijsgraad én wat de
rij **niet** dekt, en kent vier uitslagen waarvan `onbekend` er een is — nooit
stilzwijgend een middenwaarde. Er komt met opzet **geen samengesteld cijfer** uit;
`test/overleving.test.js` toets 5 is de rem op die verleiding.

**Stand nu: <!--getal:overleving.ja-->0<!--/getal--> ja,
<!--getal:overleving.deels-->6<!--/getal--> deels,
<!--getal:overleving.nee-->1<!--/getal--> nee en
<!--getal:overleving.onbekend-->1<!--/getal--> onbekend over
<!--getal:overleving.rijen-->8<!--/getal--> scenario's.** Die getallen komen uit
`OVERLEVING.json` en worden door `npm run getallen` bijgehouden, dus ze kunnen
hier niet stil verouderen. De rijen zelf staan in het register, met per rij de
bron.

**Nul van de acht staan op JA**, en dat is precies wat een dashboard zou
verbergen: de registers waar dit huis groen op staat (`IDOR.json`: 1623 routes,
0 doorbraken; `GLUURRONDE.json`: 13.617 verzoeken, 0 gaten) beantwoorden een
andere vraag — of een *niet-gecompromitteerde* buitenstaander binnenkomt. Dat is
de makkelijke helft.

**Drie ratels bewaken hem** (`npm run overleving:controle`, in CI): `ja` mag
alleen stijgen, `nee` alleen dalen, en `onbekend` mag óók niet stijgen. Die derde
is de belangrijkste — zonder hem is een bron weghalen de goedkoopste manier om
een `nee` te laten verdwijnen.

**En de meter ijkt zichzelf** (`npm run overleving:ijking`, in CI vóór de ratel).
Hij voedt zichzelf een vervalste bron waarin het probleem is opgelost en eist dat
de uitslag meebeweegt. LAT.md regel 2: een meter die je niet hebt zien uitslaan,
meet niets — en een meter die zijn bron niet leest, geeft acht keurige uitslagen
die niets betekenen.

### Wat de eerste ronde meteen vond, en het waren fouten in de METER

Drie rijen zagen er goed uit en waren fout. Ze staan hier omdat ze alle drie
dezelfde vorm hebben, en die vorm is de gevaarlijkste van deze hele laag: **een
valse `nee` is even schadelijk als een valse `ja`** — hij wordt geloofd, en
daarna genegeerd.

- de apparaat-probe las 600 tekens vanaf `apparaat:` en liep door in de
  buurstap, die op `uitgevoerd: true` staat. Hij meldde dus dat het toestel
  wordt gecontroleerd, terwijl de stap er letterlijk bij zegt van niet.
- de AI-probe zocht het `Symbol` in `goedkeuring.js`, terwijl dat in
  `bevestiging.js` woont — en meldde dat de goedkeuring te vervalsen was.
- de wachtwoord-probe zocht `'naam':` in wat een array is, telde nul zware
  handelingen en meldde `nee`. Het zijn er tien.

**En een vierde correctie raakt dit document zelf.** Hierboven stond dat er
"geen enkele treffer op mTLS, SPIFFE of een dienst-token" was. Dat was onwaar en
het was mijn fout: `server/lib/ca.js` is een eigen interne CA en
`server/lib/tls.js` doet wederzijdse TLS voor het verkeer tussen de RTG-servers,
de zaakdoos, de noodserver en losse instances. Wat ontbreekt is niet het
mechanisme maar de **bedrading**: `server/web/index.js` roept `maakServer(app)`
aan zónder `ca`, dus aan de webdeur wordt geen clientcertificaat gevraagd. De rij
kijkt dat sindsdien na in plaats van te greppen, en staat daarom op `deels` en
niet op `onbekend`.

Wat daarmee overeind blijft van par. 1: **kortlevende** werklastidentiteit — een
dienst die per aanroep bewijst wie hij is — bestaat hier niet. Een certificaat is
een langlevende identiteit, en dat is een ander ding.

## 5. De grenzen — zeven, en drie ervan corrigeren het voorstel

1. **Geen samengesteld risicocijfer.** `kern/frictie/motor.js` draagt de opbouw
   van elke score mee: *een cijfer zonder opbouw is een orakel, en een orakel kun
   je niet tegenspreken.* Dat blijft. De uitkomst is redenen en gronden.
2. **Gedragsafwijking is een besluit en geen gegeven.** Voorstel 4 noemt
   gedragsafwijking als invoer voor continuous authorization. Dat botst met een
   besluit dat hier al genomen is: `kern/identiteit/vertrouwen.js` weegt gedrag
   met opzet **niet** mee, want dat vraagt een gedragslogboek per lid — en
   `KOSTEN.md` houdt om dezelfde reden tellers bij en geen journaal. Wie dit wil,
   koopt signaal met een logboek van wat elk lid doet. Dat is een besluit van de
   eigenaar met een prijs, geen technische stap.
3. **Apparaatvertrouwen is nooit een groen vinkje, en drie treden zijn in een
   webapp onbereikbaar.** `apparaatsleutel.js` schrijft zelf op dat een
   multiDevice-passkey de *sleutelhanger* dekt en niet het toestel. OS-integriteit,
   patchstatus en jailbreak-signalen kan een webapp niet zien. Een ladder van vijf
   treden waarvan er drie nooit gehaald kunnen worden, is een ladder die liegt —
   dezelfde regel als duress mode in `HDI.md` (heel of niet). Dus: bouw de treden
   die met WebAuthn-attestation te halen zijn, en zet er hardop bij wat er niet
   te weten is.
4. **De Trust Graph is een projectie en nooit een tweede database.** `HDI.md`
   par. 5.1 is hier de grens waarop het hele project staat of valt: er komt geen
   `humans`-tabel en geen route die "alles over deze mens" teruggeeft. De vorm die
   werkt staat al in `kern/levensgraaf/graaf.js`, met `deel` als poort en niet als
   etiket. Een verantwoordingsgraaf die je met de hand kunt bijwerken, is de 22e
   capabilitylijst.
5. **De lokvermogens raken nooit een mens.** Een lokobject is een resource, nooit
   een medewerker of een lid dat wordt uitgelokt. En een aanraking leidt tot
   isoleren en bewijs bewaren — nooit tot een score op een persoon
   (`KANTOORMACHT.md`: een score op een mens draagt altijd zijn opbouw en wordt
   nooit een sorteersleutel).
6. **Deceptie vervangt geen beveiliging.** `liegpoort.js` schrijft al op wat zijn
   proef niet bewijst; een detectielaag die als grens wordt verkocht, is erger
   dan geen detectielaag.
7. **Een nieuwe handhaving loopt eerst mee in de schaduw.** `CONTROLPLANE.md`:
   je kunt niet afdwingen wat nooit in de schaduw heeft gelopen. Dat geldt ook
   voor de maatregelen uit dít document — inclusief de herkomstpoort, die daarom
   al maanden meeloopt en waarvan de prijs daardoor bekend is.

## 6. De volgorde, met de gemeten prijs erbij

De prioriteiten uit het voorstel, gecorrigeerd waar de meting iets anders zegt.
De prijs staat erbij waar hij gemeten is; waar hij niet gemeten is, staat dat er.

| # | Werk | Waarom nu | Prijs |
|---|---|---|---|
| **P0** | `RTG_HERKOMST_AFDWINGEN=1`, per wereld en niet globaal | de enige security boundary die af is en niet bijt | **gemeten**: een lid houdt na de eerste `doe` 36 van 120 paden over, een zaak 9 van 53 (`ISOLATIEPROEF.json`) |
| **P0** | `kluispoort.js` op de zware kantoorroutes | 460 routes achter één gedeelde code | onbekend; de poort bestaat, het is bedrading |
| **P0** | De twaalf beveiligingswetten in `WETTEN.json` + `npm run sabotage` erop richten | anders meet niemand of de beveiliging bijt | klein; de machinerie staat |
| **P0** | `kern/stuur/mandaat.js` een aanroeper geven | 0 aanroepers = nog geen grens | **besluit**, en de blokkade is preciezer dan "een aanroeper" — zie hieronder |
| **P1** | Intentiebewijs: `goedkeuring.js` uitbreiden met actor, apparaat, bedrag, ontvanger, doel, vervaltijd — en cryptografisch laten ondertekenen | maakt een gekaapte sessie oninteressant | `zwaarbewijs.js` levert de passkey-kant al |
| **P1** | Toestelregister op de bestaande drager `apparaat` | de ontbrekende vertrouwensgrond, met de eerlijke bovengrens uit grens 3 | middel |
| **P1** | De overige 12 herkomstkanalen laten labelen | 1 van 13 is geen dekking | route voor route |
| **P1** | Dynamische goedkeuring: `frictie` + `bodem` aan de kantoordeur hangen | de motor staat al; hij hangt alleen niet waar het misgaat | klein |
| **P2** | `scripts/overleving.js` → `OVERLEVING.json` | de lat uit par. 4 wordt pas echt als hij kan zakken | middel |
| **P2** | Workload-identiteit voor diensten en agents | één gelekte omgevingsvariabele = maanden toegang | groot |
| **P2** | Lokvermogens + intrekking van de tokenfamilie | detectie die AI-agents juist wél raakt | middel |
| **P3** | `CRYPTOGRAFIE.json` (inventaris) en crypto-agility | zonder inventaris is PQC-migratie onbestuurbaar | zie hieronder |
| **P3** | Productie accepteert alleen artefacten met een kloppende keten | SBOM en handtekening staan al; de acceptatiekant niet | klein |
| **Extern** | Onafhankelijke pentest vóór livegang van geld en identiteit | `scripts/aanval.js` zegt het zelf: *je zoekt niet naar de aanname die je niet weet dat je hebt* | inkoop |

**Over `mandaat.js`, en waarom "geef hem een aanroeper" de verkeerde opdracht
is.** Nagekeken op 9 september 2026: het probleem is niet dat niemand hem
aanroept, maar dat er niets bestaat om hem mee aan te roepen.
`speelruimte()` verwacht een mandaat met **padpatronen** (`capabilities`) en een
looptijd. Er ís een mandaatopslag in dit huis — `kern/command/toegang.js` legt
vast dat X namens Y mag handelen, met een einddatum en een journaalregel — maar
die draagt een vrij tekstveld `terrein` en geen paden. Die twee op elkaar
afbeelden zou gokken zijn, en een gegokte brug tussen twee bevoegdheidsmodellen
is precies de fout die dit document elders tegenhoudt.

En let op de valkuil in de andere richting: **leeg is dicht**. Wie
`speelruimte()` naïef in de padberekening hangt, geeft de assistent bij elk
gesprek zónder mandaat *nul* paden — de hele assistent valt stil. De aanroeper is
dus niet klein en niet risicoloos; hij hangt aan een besluit over wie een mandaat
uitgeeft, waar het staat en hoe het wordt ingetrokken.

*(Terzijde, want het telt mee voor par. 2: `mandaat` draagt in deze boom nu vier
betekenissen — `kern/stuur/`, `kern/fiscaal/gateway/`, `kern/stadsweefsel/` en
`kern/command/toegang.js`. Dat is er één meer dan par. 2 vermeldt.)*

**Over de cryptografie-inventaris, eerlijk over de graad.** Een ruwe lexicale
telling over `server/` geeft vandaag: RSA 210 treffers, SHA-256 250, scrypt 58,
Ed25519 17, ES256 16, AES-256-GCM 9, en aan de staart SHA-1 7 en MD5 1. Dat is
graad **vermoed** en geen inventaris: een grep raakt commentaar, woordenlijsten
en toetsen net zo goed als echt gebruik. Precies daarom is `CRYPTOGRAFIE.json`
het werk — algoritme, doel, gegevensklasse, plaats, rotatie, eigenaar,
PQC-pad — en niet een zin in dit document. De staartwaarden (SHA-1, MD5) horen
als eerste te worden nagekeken: als ze ergens iets *authenticeren* is dat een
bevinding, en als ze een cachesleutel maken is het niets.

## 7. Wat er bewust niet komt

- **Geen stem- of gezichtsherkenning als beveiligingsgrens.** Voorstel 13 heeft
  gelijk en het is ook al de vorm van dit huis: menselijke communicatie *vraagt*
  iets, cryptografie *autoriseert* iets. Een telefoontje van een directeur is een
  verzoek; de opdracht verschijnt binnen RTG als een ondertekend intentiebewijs
  of hij bestaat niet. Daarmee is een deepfake een probleem van de
  communicatielaag en niet van de autorisatielaag.
- **Geen scanner op verdachte tekst.** `herkomst.js` schrijft het al op: dat werkt
  niet en het wekt de indruk dat het wel werkt, wat erger is dan niets.
- **Geen tweede uitkomstenlijst, geen tweede bevoegdheidsmodel, geen tweede
  routelijst.** Zie par. 2.
- **Geen `humans`-tabel voor de Trust Graph.** Zie grens 4.
- **Geen automatische volledige onderhoudsstand.** Die is er eerder geweest en
  werkte als DoS-versterker: zes gespoofte bronnen zetten het hele huis uit
  (`SECURITY.md`, de noodrem-ladder). Weerbaarheid mag geen zelf toegebrachte
  storing worden.

## 8. De vier verdedigingslussen: één kader, geen nieuwe laag

*Eigenaarsbesluit van 13 oktober 2026.* De bestaande beveiliging wordt niet
alleen gerepareerd. Ze wordt **aantoonbaar weerbaar tegen autonome
AI-aanvallen**, zonder tweede architectuur. Een aanvallende AI blijft variëren
en opnieuw proberen. Een huis dat alleen detecteert, blokkeert en achteraf
leert, loopt daarom altijd achter. Het antwoord is geen slimmere wachter. Het
antwoord is dat elke bevoegdheid tijdelijk, controleerbaar en intrekbaar is, en
dat het huis na een aanval **aantoonbaar** terugkeert naar een vertrouwde
toestand, zonder blind te vertrouwen op de AI die het herstel uitvoerde.

**Over de naam.** AEGIS is de naam van het **programma** en nooit van een
module, tabel of route. `AEGIS` is in de code al de leverancierscode van het
demobedrijf "Aegis Elite Security" (`server/kern/initdata/deel4-genres.js`,
`server/kern/staffseed.js`, de leverancier- en personeelsapp en hun toetsen).
Dezelfde regel als par. 2: een bezette naam wordt niet tweemaal gebruikt.

**De grenzen van dit programma** zijn geen nieuwe grenzen. Ze staan al vast:

- Er komt geen AEGIS-module, geen Sentinel en geen laag boven de bewijsmachine.
  Wat erbij komt, sluit aan op een bestaand onderdeel (`BEWIJSLUS.md` par. 11,
  grens 1).
- Er komt geen nieuwe gezagsschaal en geen samengesteld risicocijfer op een
  persoon (grens 1 hierboven, `BEWIJSLUS.md` grens 2).
- Een model stelt voor en een deterministische regel stelt vast. Een
  productiewijziging door generatieve AI is nooit de volgende stap
  (`BEWIJSLUS.md` grens 3 en 4).
- Een nieuwe handhaving loopt eerst in de schaduw (grens 7).
- Er komt geen automatische productie-uitrol. Elke fase is een eigen PR met
  groene CI, en de eigenaar beoordeelt en merget zelf (`CONSOLIDATIE.md`,
  voorwaarde 3).

### 8a. Drie verplichte uitgangspunten

1. **De gecompromitteerde-AI-aanname.** Bij elke kritieke uitvoering gaat RTG
   ervan uit dat Rahul, een externe AI-agent of de invoer gecompromitteerd kan
   zijn. Een uitvoeringsbevoegdheid hangt daarom nooit alleen af van wat een
   model verklaart. Dit is de lat van dit document (de zin bovenaan) toegepast
   op de AI. De vorm staat al: wet 3 (`goedkeuring.js`, een `Symbol` dat niet
   uit JSON te maken is) en SEC-LOCK-002 ("de AI kan de beveiliging niet
   opheffen"). Wat ontbreekt, is dat het voor élke kritieke uitvoering geldt en
   niet alleen voor de paden die de assistent kent. Dat is fase 2.
2. **Beveiligingsdekking**, het *Security Coverage Proof*. RTG wordt niet
   beoordeeld op het aantal beveiligingssystemen. RTG wordt beoordeeld op **de
   schade die één gecompromitteerde identiteit, AI-agent of server nog kan
   aanrichten**. Dat is dezelfde vraag als par. 4, nu per route in plaats van
   per kroonjuweel. De 2714 muterende routes zonder motoras
   (`MACHINEDEKKING.json`, `CONSOLIDATIE.md` voorwaarde 2) gaan dus níet
   allemaal door één nieuwe pijp. Ze worden eerst ingedeeld naar werkelijk
   effect en risico. Daarna wordt per kritieke route bewezen dat de bestaande
   autorisatie-, bewijs- en uitvoeringsregels niet te omzeilen zijn. Die
   dekking wordt een **as op een bestaand register** en niet een nieuwe
   routelijst (par. 7). Het totaal blijft zichtbaar naast het kritieke deel en
   verdwijnt nooit doordat de meetlat kleiner wordt (`CONSOLIDATIE.md`,
   voorwaarde 2). `beveiligingsdekking` is als naam vrij: nul treffers.
3. **De onafhankelijke herstelproef**, het *Independent Recovery Proof*. Een
   herstel is pas geslaagd als een controle die het herstel níét uitvoerde,
   alle vijf punten bevestigt:
   - de oorspronkelijke aanval werkt niet meer;
   - legitieme handelingen werken nog;
   - de bewijsregistratie is intact;
   - de beveiligingsregels zijn niet verzwakt;
   - de productieversie is de goedgekeurde versie.

   Elk van de vijf heeft al een instrument:
   - het herhaalpakket en de fixtoets die eerst op de oude code moet falen
     (`BEWIJSLUS.md` par. 6a);
   - de ketenproeven;
   - `lib/auditwacht.js` en het externe anker;
   - `SABOTAGE.json` en de ratels van `OVERLEVING.json`;
   - de ondertekende artefactketen (`scripts/artefactketen.js`).

   De proef zelf is fase 5. Let op de naam: `herstelproef`
   (`scripts/herstelproef.js`) is al bezet door de heen-en-terugproef op
   gegevens, en `herstelbewijs` draagt al drie losse betekenissen.

**Het besluit over correlatie.** Voorlopig komt er **regelgebaseerde
ketencorrelatie zonder permanent gedragsprofiel per lid**. Dat is geen verbod op
AI: een model mag onbekende aanvalsketens ontdekken en nieuwe regels voorstellen.
Automatisch handhaven mogen alleen expliciet goedgekeurde, toetsbare regels. Een
uitgebreidere gedragsanalyse vraagt eerst een eigen privacy- en juridische
beoordeling. Daarmee blijft grens 2 hierboven staan zoals hij staat.

### 8b. De lussen naast wat er al staat

| Lus | Wat er staat | Het gemeten gat | Fase |
|---|---|---|---|
| **1. Uitvoering** (intentie → identiteit → bevoegdheid → risico → uitvoering → bewijs → verificatie) | `kern/stuur/goedkeuring.js`, `kern/zwaarbewijs.js`, `opzet/kritiekspoor.js` (geen auditregel betekent 503), `kern/agentteken.js`, `kern/command/transactie-poorten.js`, `kern/frictie/` + `bodem.js` | 2714 muterende routes zonder motoras; `mandaat.js` heeft 0 aanroepers (par. 6); `herkomst.js` bijt niet; het intentiebewijs is niet cryptografisch (wet 8) | 2 |
| **2. Aanval** (signaal → correlatie → hypothese → bewijs → begrenzing → onderzoek → herstel) | `server/beveiliging.js` + de noodremladder, `kern/schild.js`, `kern/wacht/`, `kern/incidentcontrole.js` (vijf standen, exact herstel, het journaal wordt verzegeld bij het omschakelen), `kern/beschermstand.js` | Correlatie over meerdere verzoeken bestaat niet. Samenvoegen gaat alleen per soort en bron binnen twee minuten, en `X-RTG-Correlation` volgt één verzoek | 3 |
| **3. Evolutie** (incident → patroon → reproductie → voorstel → tegenproef → uitrol → meting → nieuwe uitgangspositie) | `scripts/tegenvoorbeeld.js`, `scripts/lib/divergentie.js`, `herhaalpakket.js`, `sabotage.js`, `aanval.js`, `overleving.js`, de uitrol-canary, `middleware/schorspoort.js` | Immuniteit is nog handwerk (`BEWIJSLUS.md` par. 6a); de criticus die andere invoer krijgt is een besluit en nog geen code (`AUTONOMIE.md`) | 4 |
| **4. Integriteit van de verdediging** | `lib/auditwacht.js` (bij de start en elke 5 min), het Ed25519-anker buiten de database, `kern/auditboek/`, SEC-LOCK-001..004 (alle vier `raak`), de noodrem gaat alleen uit door de eigenaar met passkey | Zie par. 9: er is geen alarm voor een stille sensor, acht gecatalogiseerde gebeurtenissen hebben geen schrijver, en geen enkele uitrol meet buitensluiting | 1 |
| *Afsluiting* | de vijf instrumenten uit 8a punt 3 | Er is geen proef die ze samen draait, en geen onafhankelijke uitvoerder | 5 |

### 8c. De volgorde

| Fase | Werk | Wat RTG daarna heeft |
|---|---|---|
| 0 | Dit hoofdstuk | Eén kader zonder nieuwe laag |
| 1 | Integriteit van de verdediging (par. 9) | Bewijs dat de verdediging zelf werkt |
| 2 | Vertrouwde uitvoering: de routes zonder as indelen, het mandaat aansluiten waar nodig, het intentiebewijs ondertekenen, de herkomstpoort per wereld laten bijten | Een AI-agent vergroot zijn bevoegdheid niet via een onbewaakt uitvoeringspad |
| 3 | Benoemde aanvalsketens (`aanvalsketen`, vrij) over meerdere verzoeken, op handelingsklasse en sessie, zonder profiel per lid | Detectie van samengestelde aanvallen zonder risicoscore op een persoon |
| 4 | Sabotage en tegenvoorbeelden uitbreiden met autonome AI-aanvalsscenario's; een AI stelt reparaties voor, een mens tekent af | Een verdediging die aantoonbaar beter wordt na een vondst |
| 5 | De onafhankelijke herstelproef (8a punt 3) | Een gesloten lus |

De P-labels in par. 6 zijn **prioriteiten** en geen fasen. P0 "herkomst laten
bijten" valt in fase 2, en P0 "de twaalf wetten" valt deels in fase 1 (par. 9,
punt 4).

**Elke fase levert hetzelfde op:**
1. de huidige toestand, met gemeten bewijs;
2. de exacte kwetsbaarheden en de betrokken bestanden;
3. de kleinste wijziging binnen de bestaande architectuur;
4. positieve, negatieve en vijandige toetsen;
5. een meting vóór en na;
6. de resterende risico's, hardop;
7. een eigen PR met groene CI, klaar voor menselijke review.

## 9. Fase 1: de inventaris (13 oktober 2026)

Gemeten op `main` (`99f61f35`). Dit is de stand vóór de eerste wijziging. Er is
in deze ronde geen productiecode veranderd.

**1. Stille sensoren.**
- **Stand.** `kern/command/alarm.js` draagt tien controles: zeven in het
  bestand zelf en drie in `alarm-aanvullend.js`. **Geen van de tien vraagt of
  een sensor nog leeft.** Ze lezen allemaal een uitslag. Drie stille paden zijn
  bij naam gevonden:
  - `kern/command/tikker.js` slikt elke fout uit `weeg()` ("nooit de lus
    breken"), en er bestaat geen stempel "laatst gewogen". Het alarm draait
    zelf op die tikker. **De wachter die de andere wachters bewaakt, kan dus
    zonder spoor stoppen.** Dat is het zwaarste punt van deze fase.
  - `opzet/schildwacht.js` geeft schildtreffers door via `beveiligVan()`. Is die
    `null`, dan verdwijnt de melding. De aanroepen naar De Wacht staan in een
    lege `catch`.
  - `lib/auditwacht.js` meldt alleen via datzelfde alarm.
- **Kleinste wijziging.**
  - Een sensor stempelt zijn **ronde** en niet zijn vondst: een schild dat
    niets vangt, leeft gewoon.
  - `tikker.js` houdt de laatste geslaagde ronde en de laatste fout bij.
  - Er komt één controle `sensor-stil` in `alarm.js` die die stempels leest.
  - Omdat het alarm zichzelf niet kan bewaken, kijkt de bestaande buitensonde
    ook naar de leeftijd van de laatste alarmronde, in de vorm van
    `niets-van-buiten`.
- **Toetsen.**
  - Positief: alles leeft en er gaat geen alarm af.
  - Negatief: een stilgezette tikker of een `beveiligVan` die `null` is, geeft
    een alarm.
  - Vijandig: een sabotagewet die de stempel weghaalt, moet rood worden.
- **Meting vóór.** 0 van de 10 controles dekken de levendigheid van een sensor,
  en er zijn 3 benoemde stille paden.

**2. Het auditboek aansluiten.**
- **Stand.** Van de acht security- en beheertypen buiten het boekbeheer zelf
  wordt er **één** geschreven (`kritiek.toegestaan`, door `kritiekspoor.js`).
  Zeven hebben geen schrijver: `kritiek.geweigerd`, `bezitsbewijs.geweigerd`,
  `sessie.ingetrokken`, `inzage.kluis`, `beheer.rol.gewijzigd`,
  `beheer.sleutel.gewisseld` en `beheer.config.gewijzigd`. Daarnaast heeft
  `release.gate` geen schrijver.
- **Aanhaakpunten die al vaststaan:**
  - `opzet/kritiekspoor.js` voor de weigering;
  - `opzet/diensten2.js` bij de weigering van het bezitsbewijs;
  - `pgaccounts-intrekking.js` en `kern/sessies.js` voor de intrekking;
  - `opzet/inzagespoor.js` voor de kluis.

  De plekken voor rol, sleutel en configuratie zijn nog niet vastgesteld; dat
  is het eerste werk van deze stap.
- **Twee ontwerpkeuzes vooraf, en ze staan hier zodat ze niet stil worden
  gemaakt:**
  - Een weigering voert al niets uit. Een mislukte auditregel bij een
    **weigering** mag daarom nooit in een toestemming omslaan, en ook niet in
    een 503 die als storing leest. Die regel gaat naar het alarm.
  - Het auditboek bestaat alleen in de PostgreSQL-modus. In de JSON- of
    SQLite-modus schrijft een schrijver dus niets, en de meting moet dat zeggen
    in plaats van het als gedekt te tellen.
- **Toetsen.** Per type: de regel landt; een verboden vorm wordt geweigerd; en
  een ingetrokken sessie zonder regel laat de toets zakken.
- **Meting vóór.** 1 van de 8 (security en beheer); `release.gate` 0 van 1.

**3. Buitensluiting meten.**
- **Stand.** `kern/command/canary.js` rolt alleen terug op serverfouten (5xx).
  `server/meting.js` heeft wel een `4xx`-emmer, maar die gooit 401, 403, 404,
  409 en 422 op één hoop en weet niet **welke regel** weigerde.
- **De meting zegt ook iets dat de opdracht niet zei.** Een
  beveiligingsregel gaat vandaag niet via de canary naar buiten maar via een
  omgevingsvlag (`RTG_HERKOMST_AFDWINGEN`). Het enige wat telt hoe vaak een
  regel zou bijten, is `kern/stuur/schaduwtelling.js`, en die geldt alleen voor
  de herkomstpoort.
- **Kleinste wijziging, in twee stappen:**
  1. Een weigering van een beveiligingspoort draagt een regel-id.
  2. De schaduwtelling telt per regel-id, over de bestaande poorten.

  Pas daarna kan een uitrol stoppen op "deze regel sluit legitieme leden
  buiten". Eerst als meting, en alleen na een schaduwperiode als rem (grens 7).
- **Toetsen.** Een legitiem lid op een pad dat een nieuwe regel zou weigeren,
  verschijnt in de telling. Een regel zonder id laat de toets zakken.
- **Meting vóór.** 0 beveiligingspoorten met een regel-id; schaduwtelling op 1
  poort.

**4. Beveiligingswetten in het register.**
- **Stand.** `WETTEN.json` telt 55 wetten. De vier SEC-LOCK-wetten staan erin
  en zijn alle vier `raak` (`SABOTAGE.json`, 11 oktober; over het hele register
  51 raak, 1 blind, 3 mensenwerk). Van de acht wetten uit par. 3 staat er
  **geen**.
- **Wat nu kan.** Een wet met een sabotage is alleen eerlijk als zijn handhaver
  bijt. Nu registreerbaar, want de handhaver bestaat en heeft een toets:
  - wet 3, `goedkeuring.js` met `test/stuur-aanval.test.js`;
  - wet 7, de intrekking, met `test/kantoorintrekking.test.js` en de
    intrekkingstoetsen;
  - de regel "geen kritieke toestemming zonder auditregel", met
    `opzet/kritiekspoor.js` en `test/kritiekspoor.test.js`.
- **Wat nog niet kan.** Wet 1, 2, 4, 5 (de kantoorkant) en 8 bijten niet.
  Registreren met een sabotage zou een uitslag geven die niets meet. Die gaan
  in het register in fase 2, op het moment dat ze bijten. Wet 6 heeft een vorm
  die 1 van de 13 kanalen dekt, en schuift mee met wet 1.
- **Daarna.** De wetten die stap 1 tot en met 3 opleveren, komen er ook in.
- **Meting vóór.** 4 van de 12 wetten uit par. 3 staan in het register.
- **Meting na stap 1 (13 oktober 2026).** 7 van de 12 staan erin, en alle
  zeven zijn `raak`. De drie nieuwe wetten zijn:
  - `beveiliging-ai-maakt-geen-menselijke-bevestiging` (wet 3);
  - `beveiliging-intrekking-wint` (wet 7);
  - `beveiliging-geen-kritieke-handeling-zonder-spoor`.

  Het register telt nu 58 wetten.
- **De eerste ronde vond een gat.** Wet 3 kwam eerst op `afgeslagen`. De
  sabotage liet de stuurpoort een `bevestigd` uit de body accepteren, en geen
  enkele toets werd rood, want de bestaande aanval zette die vlag náást de body.
  `test/stuur-aanval.test.js` smokkelt hem nu ín de body, en daarna was de wet
  `raak`.
- **Wat `raak` niet bewijst.** De wet staat aan voor déze zet, niet voor elke
  omweg (de grens in `SABOTAGE.json`).
- **Wat nog openstaat.** Wet 7 is bewezen op de recordsessie
  (`kern/sessies.js`). De staatloze lid-token
  (`accounts/tokens.js`) en de Redis-kant (`pgaccounts-intrekking.js`) hebben
  hun eigen toetsen, maar nog geen sabotage.

**Bijvangst. Twee koppen spreken de code tegen; ze zijn in deze ronde niet
aangeraakt, omdat er geen code verandert.**
- De kop van `server/beveiliging.js` zegt dat de noodrem bij een brede aanval
  "de onderhoudsstand" laat springen. `beveiliging-noodrem.js` en `SECURITY.md`
  zeggen dat die zekering **nooit** automatisch springt, en die twee kloppen.
- `opzet/schildwacht.js` zoekt De Wacht in een map veilig onder kern, die niet bestaat. De Wacht woont
  in `kern/wacht/`.

### 9a. De volgorde en het alarmkanaal (tweede eigenaarsbesluit, 13 oktober 2026)

Fase 1 wordt geen verzameling reparaties. Het doel is **de eerste aantoonbaar
gesloten beveiligingslus** van RTG. De inventaris bevestigt waarom dat nodig is:
RTG heeft beveiligingsmechanismen, maar kan nog niet betrouwbaar vaststellen of
de eigen bewaking volledig werkt.

| Stap | Werk | Acceptatievoorwaarde |
|---|---|---|
| 0 | Deze PR reviewen en mergen | De documentatie klopt met de actuele code |
| 1 | De drie registreerbare wetten (punt 4) | `npm run sabotage` bewijst dat elke handhaver echt tegenhoudt |
| 2 | Stille sensoren en de bewaker zelf (punt 1) | Ook een uitgevallen bewaker wordt **van buitenaf** opgemerkt |
| 3 | Het auditboek aansluiten (punt 2) | Alle acht gebeurtenissen hebben een schrijver met een toets |
| 4 | Weigeringen per regel meten (punt 3) | Een uitrol ziet een onterechte blokkade, niet alleen een serverfout |
| 5 | De integrale tegenproef | Bewaking, alarm, bewijs, begrenzing en herstel werken samen |

Elke stap is een eigen PR, en de volgende begint pas na de merge van de vorige.

**Een proces kan zijn eigen volledige uitval niet betrouwbaar opmerken.** Dat
corrigeert punt 1 hierboven. Een stempel "laatst gewogen" helpt alleen zolang er
nog iets is dat hem leest. Dus moet minstens één bewaker **buiten het
serverproces** nagaan of de RTG-bewaking nog leeft.

Het begin daarvan staat er al: `scripts/sonde.js` draait op een andere machine
en eindigt met exitcode 1 als een reis mislukt. Maar hij kijkt niet naar de
bewaking, en hij waarschuwt niemand zelf. Stap 2 geeft hem één reis die de
leeftijd van de laatste alarmronde leest. Zijn uitval gaat via het kanaal
hieronder, en niet via de app die hij bewaakt.

**Drie escalatieniveaus.**

| Niveau | Wat er gebeurt | Wat er al staat |
|---|---|---|
| 1 | Een regel in het beveiligingsjournaal en een sein op het kantoorbord | `alarm.js` → `alarm-uitgang.js` (journaal + office-SSE) |
| 2 | Een externe melding naar een aangewezen beveiligingsverantwoordelijke | Alleen het transport: de webhook van `foutmelder.js`, op de overgang |
| 3 | Een externe urgente melding, plus een **vooraf vastgestelde** automatische begrenzing van kritieke handelingen | De begrenzing: de standen van `kern/incidentcontrole.js` en de noodremladder |

Bij niveau 3 blijft één grens staan: de begrenzing is een bestaande stand of
trede, die vooraf is vastgelegd. **Nooit de volledige onderhoudsstand** (par. 7),
en eerst in de schaduw (grens 7).

**Een webhook is een transport en geen garantie dat iemand het alarm
ontvangt.** Een kanaal telt pas als het volgende getoetst is:
- de aflevering;
- de ontvangstbevestiging door een mens;
- herhaling als die bevestiging uitblijft;
- escalatie naar niveau 3 als er geen reactie komt.

Mail mag een aanvullend kanaal zijn, maar nooit de enige voorziening voor een
kritiek incident.

**Het alarmkanaal is een harde voorwaarde voor stap 2.** De detectie van stille
sensoren gaat pas aan als niveau 2 aantoonbaar iemand bereikt. Een detector
waarvan de melding nergens aankomt, is de stille sensor die hij moest vinden.
Daarvoor zijn drie dingen nodig die geen code zijn:
- wie de aangewezen verantwoordelijke is, en wie hem vervangt;
- welke externe dienst niveau 2 en 3 aflevert, en met welke
  verwerkersovereenkomst (`VERWERKERS.md`);
- hoe lang een bevestiging mag uitblijven voordat er wordt geëscaleerd.

Tot die drie er zijn, staat stap 2 **gebouwd en niet actief**. Dat is dezelfde
vorm als de herkomstpoort.

### 9b. Het alarmkanaal (derde eigenaarsbesluit, 13 oktober 2026)

| Onderdeel | Besluit | Wat er nog open is |
|---|---|---|
| Ontvangers | Een vaste beveiligingsverantwoordelijke en een **onafhankelijke** vervanger | De vervanger: een tweede mens die aantoonbaar beschikbaar en bevoegd is |
| Meldingsdienst | Een EU-gehoste piketdienst met ontvangstbevestiging, herhaling en escalatie | De leverancier (zie hieronder) |
| Escalatie | Hangt af van de ernst: **5 minuten** bij kritiek, **15 minuten** bij hoog, **60 minuten** bij niet-kritiek | De koppeling aan de bestaande ernstschaal (zie hieronder) |

**De primaire verantwoordelijke is tot V1 de eigenaar, en geen AI-agent.** Een
agent kan die rol niet dragen, om drie redenen:
- de gecompromitteerde-AI-aanname uit par. 8a geldt ook voor de agent die
  meekijkt;
- een agent draait niet doorlopend en kan een oproep om drie uur 's nachts niet
  bevestigen;
- een bevestiging door een AI is precies wat wet 3 uitsluit.

Een agent mag een incident wel voorbereiden en uitzoeken. Bevestigen en
beoordelen doet een mens.

Zolang er geen tweede mens is, staat het risico op één persoon hardop. **Er
wordt pas op menselijke opvolging vertrouwd als de vervanger er is.**

**Nog geen leverancier.** Eerst worden vijf punten beoordeeld:
- de gegevenslocatie;
- de beschikbaarheid;
- de kosten;
- de verwerkersovereenkomst (`VERWERKERS.md`);
- de onafhankelijkheid van RTG's eigen infrastructuur.

**De ernst krijgt geen tweede schaal.** Er bestaan er al twee:
- `alarm.js`: hoog, midden, laag;
- `beveiliging.js`: info, waarschuwing, kritiek.

De drie escalatietijden worden op die bestaande waarden gelegd, in stap 2, met
code en een toets. Er komt geen derde lijst bij (par. 2).

**Vier aanvullende eisen.**

1. **Geen afhankelijkheid van RTG zelf.** De externe bewaker en de
   meldingsdienst werken door als de hele RTG-applicatie of de primaire
   infrastructuur plat ligt. Dat betekent:
   - een andere hostingpartij, en geen gedeelde DNS of gedeeld netwerk;
   - sleutels en ontvangers die niet in RTG staan.

   `scripts/sonde.js` draait daarom niet in de RTG-omgeving.
2. **Automatische begrenzing wacht niet op een mens.** Bij een aantoonbaar
   kritieke compromittering voert `kern/incidentcontrole.js` meteen de vooraf
   vastgestelde beschermingsstand uit. De vijf minuten gaan over het oproepen
   van een mens, niet over het stoppen van de aanval. Drie grenzen blijven
   staan:
   - "aantoonbaar" is een deterministische regel en nooit het oordeel van een
     model (`BEWIJSLUS.md` grens 3);
   - het gaat alleen om een bestaande stand of trede, nooit om de volledige
     onderhoudsstand (par. 7);
   - de regel loopt eerst in de schaduw (grens 7).

   Welke stand bij welk signaal hoort, legt de eigenaar vast vóór stap 2
   actief wordt.
3. **Een alarm is pas afgehandeld na bevestiging én beoordeling.** Een
   ontvangstbevestiging zegt alleen dat iemand de melding zag. Het incident
   blijft open tot de verantwoordelijke de situatie heeft beoordeeld, en die
   beoordeling komt in het spoor. Stilzetten (`alarm.js`, met een maximum)
   is geen afhandeling.
4. **Uitval van de meldingsdienst is zelf een incident.** De externe bewaker
   heeft een onafhankelijk reservekanaal. Hij toont periodiek met een
   proefmelding aan dat beide kanalen werken, met een ontvangstbevestiging. Een
   kanaal dat zijn laatste proef niet haalde, telt als uitgevallen, nooit als
   stil groen. Dit is storing 5 van de integrale tegenproef.

**De lat voor fase 1 blijft de tegenproef en niet groene CI.** Na fase 1 moet RTG
niet alleen incidenten registreren, maar ook zien dat een deel van zijn eigen
bewaking stilvalt. Dat is pas bewezen als de vijf storingen hieronder echt
zijn gesimuleerd.

### 9c. Beschermstanden en alarmstormen (vierde eigenaarsbesluit, 13 oktober 2026)

| Onderdeel | Besluit |
|---|---|
| Vervanger | Verplicht vóór menselijke escalatie wordt geactiveerd. Tot dan is het een expliciet open risico. |
| Meldingsdienst | Een onafhankelijke, EU-gehoste piketdienst met ontvangstbevestiging, escalatie en een apart reservekanaal. De leverancier moet nog worden gekozen. |
| Automatische beschermstand | Alleen vooraf goedgekeurde, bestaande standen van `kern/incidentcontrole.js`, gekoppeld aan concrete, deterministische signalen. |

**De beslisregel, gelegd op de bestaande standen** (`normaal`, `waakzaam`,
`beperkt`, `beschermd`, `isolatie`) en op de bestaande ernstschalen:

| Ernst | Wat er gebeurt |
|---|---|
| laag / info | Registreren en controleren; de stand blijft gelijk. |
| midden / waarschuwing | Een menselijke melding plus `waakzaam`. Strenger alleen waar een bestaande regel dat al voorschrijft. |
| hoog / kritiek | Direct de kleinste passende bestaande stand, meestal `beperkt`, maar alleen bij een benoemd, deterministisch signaal. Tegelijk gaat er een extern alarm uit, zonder te wachten op een mens. |

**Een ontbrekende hartslag is geen bewijs van een aanval.** Het kan ook een
storing zijn. Een stille sensor leidt daarom altijd tot een extern alarm, maar
nooit op zichzelf tot een zwaardere stand. Daarvoor is een tweede,
onafhankelijk signaal nodig.

**De lijst signalen die een stand mogen zetten, legt de eigenaar vast.** Per
signaal is er een toets. Een agent stelt de lijst voor; de eigenaar keurt hem
goed.

**De beveiliging mag geen aanvalsmiddel worden.** Voordat stap 2 actief wordt,
moet de tegenproef aantonen dat kunstmatig opgewekte alarmen RTG niet
ontregelen. Wat er al staat, en wat de tegenproef nog moet bewijzen:

| Er staat al | Nog te bewijzen |
|---|---|
| `server/beveiliging.js` voegt dezelfde soort uit dezelfde bron binnen 2 minuten samen en escaleert hooguit eens per 5 minuten per soort | of een aanvaller met **wisselende** bronnen die rem omzeilt en de externe pieper laat overlopen |
| De noodremladder heeft tijdslimieten en zet nooit automatisch de volledige onderhoudsstand | dat geen opgewekt signaal een zwaardere stand dan de vooraf vastgestelde kan afdwingen |
| `alarm.js` meldt alleen bij een overgang, niet bij elke ronde | dat een alarm dat snel aan en uit flikkert de piketdienst niet overspoelt |
| Een stand verlagen vraagt een ceremonie (SEC-LOCK-001) | dat herhaalde escalaties niet stapelen tot isolatie |

**De volgorde:**
1. stap 2 bouwen;
2. onafhankelijk testen, met de tegenproef op alarmstormen;
3. de vervanger en de meldingsdienst regelen;
4. gecontroleerd activeren.

Mergen doet de eigenaar.

### 9d. Stap 2 gebouwd: de stille sensor (14 oktober 2026)

**Een stille sensor staat in de bewaking; hij verdwijnt niet uit de lijst.**
`server/kern/command/sensorstilte.js` houdt per sensor bij of hij nog een ronde
draait. Het kijkt niet naar wat de sensor vindt, alleen naar of hij nog kijkt.
Er zijn drie standen:
- `levend`;
- `stil`;
- `uit`: bewust niet gestart, bijvoorbeeld in een meetserver. Dat is een
  uitspraak en telt niet als levend.

Een verwachte sensor die nooit is gestart, telt als **stil**: een weggehaalde
wachter verdwijnt niet uit de lijst.

| Sensor | Hoe zijn ronde wordt gezien |
|---|---|
| het alarm, de canary | `kern/command/tikker.js` stempelt elke geslaagde ronde en telt een fout in plaats van hem te slikken |
| de auditwacht | `lib/auditwacht.js` stempelt elke controle |
| het schild | `opzet/schildwacht.js` legt de verzoekteller van het schild naast die van de meting. Telt de meting 20 of meer verzoeken en het schild geen enkel, dan hangt het schild niet meer in de keten. |
| meldingen van het schild | Een melding zonder beveiligingsjournaal telt als verloren, in plaats van zonder spoor te verdwijnen |

**Het alarm** heeft één controle erbij, `sensor-stil` (ernst hoog), in
`kern/command/alarm-aanvullend.js`. Die controle wordt **in de schaduw** gewogen:
- Hij wordt berekend en is te zien in `/api/metrics/kort` onder `bewaking`,
  achter de bestaande meetpoort.
- Hij wordt pas als alarm gemeld met `RTG_SENSORSTILTE_ACTIEF=1`, en dat gebeurt
  pas na de stappen in par. 9c.
- Een stille sensor zet nooit een stand.

**De externe bewaker.** `scripts/sonde.js` leest die `bewaking` vanaf een andere
machine, met het meettoken. Een stille sensor, een onleesbaar antwoord of geen
antwoord is **niet gelukt**, en dan eindigt de sonde met exitcode 1. Zo ziet
iemand buiten het proces ook dat het alarm zelf stilvalt.

**Meting vóór en na:**

| | vóór | na |
|---|---|---|
| alarmcontroles die kijken of een sensor nog leeft | 0 van 10 | 1 van 11, in de schaduw |
| benoemde stille paden die nu gezien worden | — | 3 van 3: tikkerfouten, een verloren schildmelding, een schild buiten de keten |
| controle van buitenaf of de bewaking leeft | geen | `sonde.js` |

**Toetsen:** `test/sensorstilte.test.js`, met negen gevallen:
- positief: alles levend;
- negatief: stil, nooit gestart, een tikker die omvalt, verloren meldingen;
- vijandig: een schild buiten de keten, terwijl het bord vaak leest.

**Resterende risico's:**
- De uitrolregie stempelt nog niet. `kern/command/uitrolregie.js` is groter dan
  de omvangsgrens, en die grens gaat voor; het opsplitsen is een eigen stap.
- De Wacht (`kern/wacht/`) en het beveiligingsjournaal hebben nog geen eigen
  ronde om te stempelen.
- Het schildoordeel kan pas na twee wegingen van het alarm iets zeggen.
- De sonde waarschuwt nog niemand zelf: hij geeft een exitcode, en wat daarmee
  gebeurt hangt aan de meldingsdienst uit par. 9b.

### 9e. Detectie, alarmering en bescherming zijn drie dingen (vijfde eigenaarsbesluit, 14 oktober 2026)

Stap 2 levert **detectie**: RTG kan vaststellen dat een sensor stilvalt. Twee
andere dingen zijn nog niet operationeel bewezen, en ze worden niet met
detectie verward:
- **alarmering**: de verantwoordelijke buiten het platform bereiken;
- **bescherming**: volgens vooraf vastgestelde regels veilig reageren.

**Besluit:** stap 2 mag na groene CI en review worden gemerged, met de
detectie in de schaduw. Stap 2 heet pas technisch voltooid als ook De Wacht en
het beveiligingsjournaal gedekt zijn. Daarna volgen:
1. de meldingsdienst met een reservekanaal;
2. de tegenproef op alarmstormen;
3. een onafhankelijke storingstest.

**Vier garanties, en waar ze nu staan:**

| Garantie | Stand na stap 2 |
|---|---|
| **Onafhankelijke waarneming.** Valt de hele server uit, dan ziet de externe sonde dat. | **In code, niet in bedrijf.** Een dode server laat de bestaande reizen van `sonde.js` zakken (`/api/health`), en de bewakingscontrole wordt "geen antwoord", dus niet gelukt. Dat geldt pas als de sonde echt op een andere machine draait, en dat is nog niet geregeld (par. 9b, eis 1). |
| **Geen vals veiligheidsgevoel.** Een werkende meetroute bewijst niet dat de beveiliging werkt. | **Zo gebouwd, en hier hardop.** `bewaking` zegt alleen dat een sensor nog **rondes draait**, niet dat hij goed oordeelt. Dat een handhaver ook echt tegenhoudt, bewijzen de sabotagewetten (`SABOTAGE.json`), en ook die alleen voor de geprobeerde overtreding. Een groene `bewaking` is dus nooit "de beveiliging werkt". |
| **Bestand tegen alarmstormen.** Herhaalde storingssignalen geven geen onbeperkte meldingen of zware acties. | **Deels.** Een stille sensor zet nooit een stand, en `alarm.js` meldt alleen bij een overgang. De tegenproef met wisselende bronnen en flikkerende alarmen (par. 9c) is nog niet gedaan. |
| **Controleerbare terugkeer.** Herstel blijkt uit nieuwe geslaagde metingen, niet uit een gewist alarm. | **Gebouwd.** Een tikker of de auditwacht wordt pas weer `levend` na een nieuwe geslaagde ronde. Het schild herstelt pas na een weging waarin het weer verkeer zag. Een bron met verloren meldingen herstelt pas als er daarna weer een melding **aankomt**; de teller blijft als spoor staan (`test/sensorstilte.test.js` 6b). Een alarm stilzetten verandert niets aan de stand. |

**De integrale tegenproef (stap 5) simuleert vijf storingen.**

| Storing | Wat RTG moet aantonen |
|---|---|
| Een beveiligingssensor stopt | dat het alarm afgaat, en van buitenaf als de bewaker zelf stopt |
| De auditregistratie faalt | dat een kritieke toestemming niet doorgaat (503) en dat een weigering een weigering blijft |
| Een nieuwe regel blokkeert legitieme leden | dat de telling per regel het ziet voordat de regel van de schaduw naar handhaving gaat |
| Een beheerder probeert de bewaking uit te zetten | dat dit een ceremonie vraagt (SEC-LOCK-001), in het auditboek komt en van buitenaf zichtbaar wordt |
| Het externe alarmkanaal is onbereikbaar | dat dit zelf een alarm is op niveau 1 en bij de externe bewaker, en nooit stil groen |

Per storing levert de proef vier antwoorden op:
- wat RTG detecteert;
- welke actie volgt;
- waar het bewijs staat;
- welke risico's er overblijven.

De proef draait in de testwereld uit `AFBOUWPROGRAMMA.md` par. 3, met simulaties
naast de echte rails en nooit in de productieweg. Hij wordt een ketenproef in
de vorm van `scripts/tafelproef.js`, en niet een eigen raamwerk.

**Resterende risico's, hardop.**
- Tot het alarmkanaal geregeld is, heeft een alarm geen uitgang buiten het huis
  als `ERR_WEBHOOK_URL` leeg is. Dat is het kanaalbesluit uit `SLO.md` punt 4.
  Hierboven is de vorm besloten; de drie invullingen staan nog open.
- Een beheerder met databasetoegang wordt door het auditboek niet tegengehouden.
  Het anker ziet het achteraf (`AUDITBOEK.md`). Fase 1 verandert dat niet.
- De externe pentest blijft `extern` (`AFBOUWPROGRAMMA.md` par. 7). Geen
  interne proef vervangt hem.

---

*De getallen in dit document staan er met hun bron en hun datum, maar ze lopen
nog niet mee in `npm run getallen`. Dat is het eerste wat er moet gebeuren als
dit document blijft staan: een getal zonder merkteken veroudert stil, en dat is
in dit huis al een keer gebeurd.*
