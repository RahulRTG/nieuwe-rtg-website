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
<!--getal:overleving.deels-->5<!--/getal--> deels,
<!--getal:overleving.nee-->2<!--/getal--> nee en
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
| **P0** | `kern/stuur/mandaat.js` een aanroeper geven | 0 aanroepers = nog geen grens | besluit, geen bouwwerk |
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

---

*De getallen in dit document staan er met hun bron en hun datum, maar ze lopen
nog niet mee in `npm run getallen`. Dat is het eerste wat er moet gebeuren als
dit document blijft staan: een getal zonder merkteken veroudert stil, en dat is
in dit huis al een keer gebeurd.*
