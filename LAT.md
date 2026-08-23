# De lat

Dit is de technische lat voor RTG. `CLAUDE.md` gaat over het merk; dit gaat over
de code. Alles hieronder komt uit een fout die hier echt is gemaakt, en elke
regel zegt erbij WAT hem handhaaft. Een regel zonder handhaver is een voornemen,
en die staan hieronder ook als zodanig gemarkeerd.

De lat geldt voor nieuw werk, voor wat er al staat, en voor wat er nog komt. Wat
dat per tijdvak betekent staat onderaan, want het is niet voor alle drie
hetzelfde en doen alsof van wel is de eerste manier om hem te verliezen.

---

## De elf regels

### 1. Repareer de oorzaak, niet het symptoom

Een reparatie die het gevolg wegneemt en de oorzaak laat staan heet hier een
pleister. Pleisters mogen bestaan als tussenstap, maar dan staan ze met naam in
de takenlijst met de oorzaak erbij.

*Voorbeeld:* boeking 50.001 verdween stil uit `db.data.boekingen`. De staart gaat
nu eerst duurzaam naar `archief/`, en dat is beter dan verlies. Maar de oorzaak
is dat het transactie-grootboek alleen in de sqlite- en postgres-stand actief is.
Zolang dat zo is, is die code een pleister en staat hij als zodanig genoteerd.

*Wat er sindsdien van af is, en wat niet.* Dezelfde `unshift` + `slice` stond ook
onder `directBetalingen` en `betaalVerzoeken` -- 38 MB betalingen zonder enig
grootboek erachter, terwijl `server/pg/sync.js` ze wel als herstelbaar behandelde.
Die twee staan nu in `server/db/tx/collecties.js` en gaan bij aanmaak als eigen
rij mee. In de sqlite- en de postgres-stand is dat geen pleister meer maar een
oorzaak-reparatie. In de json- en geheugen-stand blijft `bewaarStaart` het vangnet,
want daar is nog steeds geen grootboek.

*En een fout in de vorige alinea, die er zelf een regel-6-geval van maakte.* Hier
stond dat json en geheugen "de ontwikkel- en toetsstanden zijn en niet de
productiestand". Dat was aangenomen en niet nagetrokken. `server/db/keuze.js`
(toen nog een regel in `opslag.js`) kiest json zodra er een `db.json` ligt en er
geen `DATABASE_URL` is -- ook in productie -- en `productie.js` gaf daar alleen
een waarschuwing over, op een voorwaarde die er bovendien aan twee kanten naast
zat: hij blokkeerde een verse installatie die juist sqlite krijgt, en liet de
installatie lopen die ooit met json begon en later zijn `DATABASE_URL` kwijtraakte.
Sinds `server/config/productie-opslag.js` is het een blokkerende fout, gesteld met
dezelfde functie waarmee de opslag zijn stand kiest. De zin hierboven is nu waar
omdat een machine hem handhaaft, en niet omdat ik hem opschreef.

**Handhaver:** mensenwerk, zichtbaar gemaakt in het commit-bericht en de
takenlijst. Geen machine.

### 2. Elke bewering wordt met een mutatie nagetrokken

Een toets die je niet hebt zien zakken, is geen toets. Een keuringsregel die je
niet hebt zien afkeuren, keurt niets. Draai de reparatie terug, bevestig dat de
JUISTE toets zakt, zet hem terug.

Vier uitkomsten, niet twee: RAAK (de mutatie bijt), AFGESLAGEN (hij bijt niet en
dat is een bevinding op zich), GELUKT, NIET GEPROBEERD. Een mutatie die ALLES
laat zakken bewijst niets: dan is de mutatie te grof.

**Handhaver:** voor de METERS machinaal: `test/meterijk.test.js` voert elke
geijkte meter een bekend-foute invoer en eist dat hij uitslaat, en
`scripts/check.js` regel 35 eist dat elke meter daar staat -- met een proef of
met een opgeschreven reden, geteld door `metersOngeijkt` in `NORM.json`, die
alleen omlaag mag. Voor de SCHERMEN: `scripts/schermen.js` telt de apps die
geen enkele toets ooit heeft geopend, uit het journaal van een echte e2e-ronde
en niet uit een tekstzoektocht. Voor de rest: mensenwerk, en het commit-bericht
noemt welke mutatie is gedaan en welke toets ervan zakte.

### 3. Een meter zakt als zijn invoer ontbreekt

Stilvallen is geen uitkomst. Een teller zonder invoer, een draaier zonder
database, een keuring zonder journaal: die horen te falen, niet groen te blijven
met een eerlijke tekst erboven.

*Voorbeeld:* `scripts/dekking.js` gaf bij een leeg routejournaal netjes
exitcode 2. `scripts/pgtoetsen.js` gaf zonder database exitcode 0, met de tekst
"de Postgres-toetsen worden overgeslagen" erboven. Acht toetsbestanden hebben
daardoor maanden bestaan zonder ooit te draaien.

*Tweede voorbeeld, van later dezelfde dag:* `test/genreplan.test.js` had zeven
toetsen die begonnen met `if (!gewired) return t.skip('wiring volgt')`, waarbij
`gewired` uit een 404-proef kwam. De routes zijn allang aangesloten, dus de vlag
stond permanent op true en deed niets -- behalve het enige wat hij nog kon: zeven
toetsen stil uitzetten zodra iemand de routekoppeling breekt. De proef is nu een
bewering. In dezelfde ronde: `scripts/a11y.js` geeft zonder browser exitcode 0,
en de slotsuite draaide hem zo, terwijl die laag daar als `hard` staat. Nu met
`A11Y_STRICT=1`, want in de laatste poort voor go-live is "niet gemeten" geen
groen.

**Handhaver:** `scripts/check.js` regel 25 (elk zelf-poortend toetsbestand staat
in de draaier), de exitcodes van de draaiers zelf, en de meter
`zelfpoortendeToetsen` in `NORM.json`. Voor een zelfgebouwde vlag als `gewired`
bestaat geen handhaver; dat is regel 2 en mensenwerk.

### 4. Nooit twee plekken die een waarheid vasthouden

Zodra dezelfde waarheid op twee plekken staat, lopen ze uiteen. Niet misschien:
zeker, en meestal zonder dat iets klaagt.

*Voorbeelden die hier echt zijn gevonden:* `ledenGidsWeg` ontbrak in de
exportlijst van `db/index.js` terwijl drie modules hem doorgaven, waardoor het
recht op vergetelheid in Postgres-stand niets deed. De pasprijs stond in de
boardroom en nog een keer hard in `kern/lid.js`. De rate limiter `teVaak` stond
in drie kernmodules, en geen van de kopieen had de opruimronde van het origineel.

*En het duurste geval, want het zit in de veiligheid zelf:* de vraag "mag de
machine dit zelf doen" wordt op VIJF plekken beantwoord, met vijf verschillende
schalen -- `stuur/beleid.js` (verboden/voorstel/direct), `command/risico.js`
(hand/assist/auto), `geldbeleid/regels.js` (kijken/voorstellen/klaarzetten/
automatisch), `stadsweefsel/ainiveau.js` (waarnemen tot verboden) en
`bureau/delegatie.js` (informeren tot autonoom). Elk van de vijf is op zichzelf
zorgvuldig gebouwd; het bezwaar is dat geen van de vijf de andere vier kan lezen,
dus geen mens en geen machine kan ze naast elkaar leggen. Ze zijn dan ook al
uiteengelopen: `ainiveau.js` zet "een vergunning of aanvraag afwijzen" op niveau
4 ("hier komt geen machine aan, met of zonder sleutel") terwijl `stuur/beleid.js`
precies die handeling als `voorstel` toelaat, en `magAutomatisch()` -- dat in zijn
eigen commentaar "de enige plek die daar antwoord op geeft" heet -- op die weg
nooit wordt aangeroepen. Daarnaast staat `niveau: 'hand'` als kale tekenreeks in
achttien Command-modules die `risico.js` niet importeren: hernoem de trede en die
achttien schrijven zwijgend het oude woord.

*En dezelfde fout een laag lager, waar hij het meest kost:* "wie handelt hier"
stond op ZEVEN plekken op het verzoek -- `req.session`, `req.actor`,
`req.boardroomKey`, `req.techUser`, `req.gast`, `req.gezinslid`, `req.drive`.
Zeven namen voor een begrip betekent dat er niets generieks op kan staan: een
teller, een rem, een bonnetje of een blast radius zou zeven keer geschreven
moeten worden, en de achtste poortwachter zou de eerste zeven weer niet kennen.
`server/opzet/envelop.js` is sinds augustus 2026 de canonieke vorm, en tien van
de elf poortwachters zetten hem. Hij is er ADDITIEF bij gezet en heeft niets
weggehaald -- een vervanging in het authenticatiepad van 3349 routes ineens is
precies het soort wijziging waarvan je pas maanden later merkt wat er stuk ging.
De zeven oude vormen blijven daarom geteld in `ENVELOP.json` tot ze route voor
route zijn afgebouwd.

**Handhaver:** `check.js` regel 26 (elke naam die je uit een module haalt bestaat
daar), regel 25, regel 27, regel 28 (de publieke-routelijst mag geen namen
bevatten die niet meer bestaan of die inmiddels een eigen poort hebben),
`scripts/kruisscan.js`, en voor het gezagsgeval `scripts/gezag.js` + `GEZAG.json`
(het aantal schalen en het aantal losse niveaunamen mag alleen omlaag, en een
vastgelegde tegenspraak wordt bij elke ronde opnieuw nagetrokken).

### 5. Niets slaat stil over

Een `catch` die zwijgt, een `.then` zonder `.catch`, een `if` om een grendel
heen, een overgeslagen toets, een niet-bezorgde melding: als iets niet gebeurt,
hoort dat ergens te staan. Bij voorkeur luid.

*Voorbeeld:* de fout-melder deed `req.on('error', () => {})`. Dat hoort er te
staan, want een fout-melder mag de app nooit omgooien. Maar het gevolg was dat
een webhook met een typefout precies hetzelfde deed als een werkende: niets
zichtbaars. Nu worden bezorgfouten geteld en staan ze op het techniekbord.

**Handhaver:** de strenge poort in `test/helper.js` (een geslaagde toets mag geen
uncaughtException of 5xx opleveren), `scripts/ast-scan.js`, en `check.js` regel
28: een route die je vergeet te poorten geeft geen fout en geen log, en is
daarmee de stilste vorm die er is.

### 6. Een belofte in tekst is een belofte in code

Commentaar, documentatie en checklists verouderen zonder dat iets klaagt. Wat er
staat moet waar zijn, of weg.

*Voorbeeld:* `SENTRY_DSN` stond op zeven plekken, waaronder het go-live-vinkje
"gezet en er komt een testfout binnen". Niets las die variabele. Wie de checklist
netjes afliep ging live zonder alarmering.

**Handhaver:** `check.js` regel 27 (elke aangeraden omgevingsvariabele wordt
ergens gelezen). Voor commentaar bestaat geen handhaver; dat is regel 2 en
mensenwerk.

### 7. Een grendel hangt aan het doel, niet aan de aanvrager

Tellers, remmen en sloten horen bij het ding dat beschermd wordt. Hangt de teller
aan de aanvrager, dan koopt een aanvaller er meer.

*Voorbeeld:* de personeelspin had een teller per RTG-account. Een gratis account
kost een e-mailadres, dus wie er twintig maakte had twintig keer vijf pogingen
per minuut op een pincode van vier cijfers.

**Handhaver:** `server/pinslot.js` is het enige slot; wie een nieuwe deur bouwt
gebruikt hem. Geen machinecontrole. Voornemen.

### 8. Een controle op vorm is geen controle

`typeof`, een regex op een header, een naam vergelijken: dat zijn geen
identiteitscontroles.

*Voorbeeld:* `/api/translate` deed `/^Bearer\s+\S/i.test(...)` op de
Authorization-kop en zette daarmee de weg naar de AI-aanbieder open. Wie
`Bearer x` meestuurt had geen account nodig. Het commentaar erboven beloofde
letterlijk het tegendeel.

**Handhaver:** `check.js` regel 29. Elke plek die de Authorization-kop leest
moet het token binnen twaalf regels door een echte verifier halen; wie de kop
alleen betast, wordt aangewezen. Twee uitzonderingen staan er met een reden bij
(een extractor en een doorgeefluik naar een interne dienst).

Voor het bredere geval blijft dit een voornemen: een `typeof`, een naam die
vergeleken wordt, een rol uit `req.body` -- die vormen kent geen enkele scan.
Blijf dus bij elke poort vragen wat er precies bewezen wordt.

### 9. Een toets die niet kan zakken is slechter dan geen toets

Hij koopt vertrouwen dat er niet is. Let op: lussen over een verzameling die leeg
kan zijn, beide kanten van een vergelijking uit dezelfde aanroep, `assert.ok` op
iets dat altijd waar is, een statuscontrole die een hele klasse toelaat, en een
404 die als "geweigerd" telt terwijl de route gewoon niet bestaat.

*Vier gevallen die hier echt zijn gevonden, met wat de reparatie was:*

| wat er stond | waarom het niets bewees | wat het nu is |
|---|---|---|
| `assert.ok([200,404].includes(m.status))` op `/api/metrics`, met het lichaam achter `if (status===200)` | open en dicht gaven allebei groen, en bij dicht werd er niets meer nagekeken; de deur die net was dichtgezet had geen enkele toets die kon zakken | `test/metingpoort.test.js`: drie servers, drie standen, exacte statussen |
| `assert.ok([200,403,404].includes(kijk.status))` op een verhaal in de vriendenlaag | "hij ziet het", "hij mag er niet bij" en "het bestaat niet" waren alle drie goed | het verhaal MOET er staan, B MOET het mogen openen, en een derde gezin mag het juist niet |
| `for (const w of r.body.waarschuwingen)` | op een rustige dag draait de lus nul keer en controleert de toets niets | de leegte is gekoppeld aan het `rustig`-vlaggetje en aan het uurbeeld: twee langs verschillende weg berekende getallen tegen elkaar aan |
| een IDOR-poging binnen `if (dossier bevat MERK)` en `if (id && id.id)` | brak het aanmaken, dan viel de hele controle geruisloos weg | elke stap is een bewering |

**Handhaver:** regel 2 (mutatie) en de meter `zelfpoortendeToetsen` in
`NORM.json`. Voor de rest: mensenwerk. Een `assert.ok([a, b].includes(status))`
is de vorm om op te letten -- soms terecht, vaak een toets die zijn eigen vraag
niet durft te stellen.

### 10. Een meter die je niet hebt zien uitslaan, meet niets

Regel 9 gaat over toetsen. Deze gaat over het gereedschap waarmee je meet, en hij
is er gekomen omdat op één dag **zeven** meters bleken te liegen -- en geen enkele
daarvan zat in de RTG-code. Ze zaten allemaal in de instrumenten die moesten
bewijzen dat de code deugde.

Dat is het gevaarlijke eraan. Een kapotte toets zakt of slaagt ten onrechte, en
dat is nog te merken. Een kapotte meter geeft een getal. Getallen ogen als feiten,
worden overgeschreven in een rapport, en niemand vraagt ooit of de meter zelf ooit
heeft uitgeslagen.

*De zeven, met wat er per stuk misging:*

| de meter | wat hij zei | wat er werkelijk gebeurde |
|---|---|---|
| endpoint-dekking | "94% gedekt" | telde treffers in plaats van endpoints; de echte dekking was 2 van 634 |
| herstel na de storm | "niet hersteld" | zonder statuscode, dus 429, 503 en 401 waren niet uit elkaar te houden -- drie totaal verschillende conclusies |
| rol-scheiding | "0% verkeerde-rol 2xx" | de storm logt zichzelf uit; 85% van die antwoorden was een 401 op een dood token, geen rechtenbesluit |
| de rolproef | een uur lang PASS | kreeg een functie die alleen `{status, ms}` teruggaf, dus hij vergeleek vijf keer `null` met vijf keer `null` |
| dezelfde rolproef | "saldo 137 -> 0, blijvende wijziging!" | vergeleek drie verschillende personas: het token werd bij elke aanroep opnieuw willekeurig gekozen |
| de scrypt-teller | "0 scrypts, 0 ms CPU" | kende alleen `scryptSync`; na de reparatie naar de asynchrone vorm meldde hij een wonder in plaats van een verplaatsing |
| event-loop na de storm | "p99 nog 74 ms" | de histogram is cumulatief en werd nooit gewist, dus dat was de p99 VAN de storm |

*Wat de regel praktisch betekent.* Voordat een meter een oordeel mag dragen, moet
je hem één keer hebben zien uitslaan op iets waarvan je weet dat het fout is. Voor
de vingerafdruk in de rolproef is dat nu ingebouwd: `ijkVingerafdruk()` doet eerst
een legitieme wijziging met de juiste rol, en beweert niets als de meter die niet
ziet -- dan meldt hij `meterStuk` en zakt het oordeel. Dat is regel 2 (elke
bewering met een mutatie natrekken) toegepast op het meetinstrument zelf.

En de tegenhanger, want de val heeft twee kanten: een meter die zijn eigen invoer
niet vindt, moet zakken en niet zwijgen. De prestatielat in `scripts/norm.js`
faalt hard als `BEPROEVING.json` ontbreekt terwijl er wel een lat staat, weigert
de cijfers van een GEZAKTE ronde als grondwaarde, en vergelijkt niet tussen
machines of opslagstanden -- 144 ms op vier kernen is geen betere 144 ms dan op
zestien, het is een andere.

**Handhaver:** sinds deze ronde machinaal, en niet meer alleen als voornemen.
`test/meterijk.test.js` houdt een registratie waarin ELKE meter staat: met een
proef die hem op een bekend-foute invoer laat uitslaan, of met een opgeschreven
reden waarom dat in een toets niet eerlijk kan. `scripts/check.js` regel 35
zakt zodra een meter daar ontbreekt -- ook de meters die in een eigen script
wonen (`dekking.js`, `schermen.js`, `samenhang.js`), want juist die stonden er
eerst buiten. En `metersOngeijkt` in `NORM.json` telt de redenen en mag alleen
omlaag, zodat het gat kleiner wordt in plaats van vergeten.

De ijking sloeg meteen op zichzelf aan: `zelfpoortendeToetsen` telde de
skip-regel die als TEKST in het ijkbestand staat mee als een echte
zelfpoortende toets. Derde keer dat een meter hier tekst voor code aanzag.
Gerepareerd door tekst door dezelfde wringer te halen als commentaar -- niet
door de tekst op te knippen zodat de meter hem niet ziet, want dat is de meter
bedriegen in plaats van repareren.

Daarnaast: `test/normprestatie.test.js` (acht toetsen, alle vier de mutaties
zagen we zakken) en de ijking in `scripts/lib/rolproef.js`. De vorm om op te
letten blijft een meter die nog nooit iets anders heeft gezegd dan "in orde".

### 11. Bewijsgroen is geen go-live-groen

Twee soorten groen die niets met elkaar te maken hebben, en ze door elkaar halen
is de duurste fout die deze hele stapel kan maken.

**Bewijsgroen** zegt: van de dingen die mis kunnen gaan heeft iemand gekeken.
Dat is een uitspraak over de code en over de instrumenten eromheen.
**Go-live-groen** zegt: dit huis mag en moet de deur open. Dat gaat over sleutels
uit een secrets manager, een verwerkingsregister dat af is, een datalek-draaiboek
met een 72-uursklok, en achttien juridische vragen die beginnen bij "onder welke
naam draait RTG".

Je kunt honderd procent bewijsdekking hebben en nog steeds niet mogen lanceren.
En andersom: alle papieren op orde met een matrix die voor zeventig procent uit
ongemeten bestaat. Het eerste is een reden om trots te zijn en geen reden om live
te gaan; het tweede is een reden om door te meten en geen reden om te wachten.

*Waar dit fout gaat:* iemand ziet `npm run check` groen, de ketenronde groen en
een bewijsmatrix die verdubbelt, en leest dat als "we zijn er klaar voor".
`npm run golive` staat dan nog steeds op rood om acht dingen die geen van allen
in de code zitten — en dat is precies goed. Operationeel of juridisch niet klaar
betekent niet live, hoe groen de software ook is.

**Handhaver:** `scripts/check.js` regel 48. De go-live-keuring mag geen enkel
bewijsregister lezen (`BEWIJSMATRIX`, `CONTROLS`, `ROLPROEF`, `KETENS`,
`STAATPROEF` en de rest), en de bewijsinstrumenten mogen geen go-live-oordeel
vellen. Zolang die twee kanten elkaars uitkomst niet kunnen zien, kan de een de
ander niet groen praten. Voor de mens die ze naast elkaar legt bestaat geen
handhaver; daarvoor staat deze regel hier.

---

## Wat de lat betekent per tijdvak

### De toekomst

Bindend. Nieuw werk voldoet aan alle elf, en waar een machine kan handhaven
handhaaft hij. Wie een regel toevoegt aan `check.js` beproeft hem met een mutatie
voordat hij hem inlevert (regel 2 geldt ook voor regels).

### Het heden

De bekende defecten gaan naar nul. "Foutloos" is bij 1145 bestanden niet te
bewijzen en niemand hoort dat te beweren; wat wel kan is een eindige lijst van
alles wat we weten, en die op nul brengen. Die lijst staat in de takenlijst, niet
in iemands hoofd.

### Het verleden

Hier is eerlijkheid belangrijker dan ambitie. Het bestaande werk wordt niet met
terugwerkende kracht herschreven. Wat wel geldt:

1. **Gemeten.** Wat er niet goed staat is geteld en staat in `NORM.json`.
2. **Gerangschikt.** Naar risico, niet naar aantal. Van de 633 endpoints zonder
   toets raken er achtentwintig geld, toegang of identiteit; die gaan eerst.
3. **Alleen maar beter.** De ratel laat elke meter maar een kant op. Wie de lat
   wil verlagen doet dat met de hand in `NORM.json`, met een reden erbij, zodat
   het een besluit is en geen erosie.

Dat is geen enterprise-grade verleden. Het is een verleden dat elke week een
stukje beter wordt en nooit slechter, en dat is het enige eerlijke aanbod.

---

## De handhavers op een rij

| wat | waar |
|---|---|
| 51 codeafspraken, binair | `scripts/check.js` |
| de INVOER van elke bronkeuring: commentaar eruit, maar geen code opeten | `scripts/lib/bron.js` + `test/bron.test.js` |
| toegankelijkheid van elk scherm, uitgelogd EN ingelogd, hard op nul | `scripts/a11y.js` + `A11Y-INGELOGD.json` |
| elk media-element een besluit over ondertiteling, met een reden | `scripts/check.js` regel 49 |
| de onderhoudsveger lost de rem niet, en is aan te roepen met een eigen klok | `server/opzet/onderhoud.js` + `test/onderhoud.test.js` |
| elk raakvlak 24x24 op telefoonformaat, en de uitzonderingen niet te ruim | `scripts/raakvlakkeuring.js` + `test/raakvlak.test.js` |
| de ratel: meters mogen maar een kant op | `NORM.json` + `scripts/norm.js` |
| kruis-slice-verwijzingen tussen opgeknipte modules | `scripts/kruisscan.js` |
| statische analyse zonder dependencies | `scripts/ast-scan.js` |
| geen geslaagde toets met een serverfout eronder | `test/helper.js` (strenge poort) |
| geen productiestart op een opslag zonder grootboek | `server/config/productie-opslag.js` |
| waargenomen endpoint-dekking uit het routejournaal | `scripts/dekking.js` |
| welke apps een toets ECHT heeft geopend ("af" is geen bewering) | `scripts/schermen.js` + `NORM.json` |
| elke meter een keer zien uitslaan voor hij een oordeel draagt | `test/meterijk.test.js` + `check.js` regel 35 |
| de prestatielat: p99, doorvoer, event-loop, herstel | `BEPROEVING.json` + `scripts/norm.js` |
| wie bewaakt wat, en wat bewaakt niemand | `scripts/samenhang.js` |
| hoeveel losse schalen beantwoorden "mag de machine dit zelf" (vijf, en ze kennen elkaar niet) | `GEZAG.json` + `scripts/gezag.js` |
| wat een poortwachter vaststelt voor hij JA zegt, en de canonieke vorm daarvoor | `ENVELOP.json` + `scripts/envelop.js` + `server/opzet/envelop.js` |
| wat een verzoek werkelijk verandert (rijen per collectie, voor en na) | `server/opzet/handeling.js` + `test/handeling.test.js` |
| een massaverwijdering tegengehouden VOORDAT hij landt (standaard: melden) | `server/opzet/begroting.js` + `server/db/state.js` |
| een bronmuterende toets draait alleen, niet naast een server die diezelfde bron leest | `scripts/lib/geisoleerd.js` + `test/bronmutanten.test.js` |
| staat elke functie in de boardroom (en dus onder een schakelaar) | `scripts/schakelbaar.js` + `NORM.json` |
| de wisregels van de identiteitskluis en de locatiesporen | `server/bewaarveger.js` |
| elk scherm geeft een teken van leven (dood is stiller dan stuk) | `test/leven.e2e.js` |
| de Postgres-toetsen, elk in een eigen database | `scripts/pgtoetsen.js` |
| een omgeving die schermtoetsen belooft, heeft ook een browser | `test/browserpoort.e2e.js` |
| de harde uitspraken van dit huis, met per stuk wie hem tegenhoudt | `WETTEN.json` + `scripts/wetten.js` |
| elke handhaver EEN keer echt uitgezet, om te zien wie er rood wordt | `scripts/sabotage.js` + `SABOTAGE.json` |
| wat we na al dat meten weten, en vooral wat we niet weten | `scripts/zekerheid.js` |
| bewijsgroen en go-live-groen kunnen elkaar niet groen praten | `scripts/check.js` regel 48 |
| de pijplijn die dit alles draait bij elke push | `.github/workflows/ci.yml` |
| de zware rondes (beproeving, dekking) draaien vanzelf, wekelijks | `.github/workflows/ronde.yml` |

Wat hier niet in staat, wordt niet gehandhaafd. Dat is geen tekortkoming van de
lijst maar informatie: het zegt precies waar je op mensen vertrouwt.

En sinds `scripts/samenhang.js` is die lijst niet langer alleen een belofte in
tekst (regel 6). Die census draait de vraag om: niet "zakt er iets" maar "kijkt
er iemand". Hij houdt per soort ding bij welke handhaver ernaar kijkt, meldt met
naam wat niemand bewaakt, en zakt zodra een soort een handhaver noemt die niet
bestaat. Nieuw werk valt vanzelf in een soort; valt het in geen enkele soort,
dan is dat zelf de melding.

Wat hij NIET kan: bewijzen dat een handhaver iets zinnigs beweert. Dat blijft
regel 2 en regel 10. Zijn eerste versie telde of een bestandsnaam ergens in een
toets voorkwam en meldde 849 valse gevallen -- die maatstaf is weggegooid en
vervangen door echte dekkingsdata, want een census die je moet wegstrepen wordt
binnen een week genegeerd.

En dat laatste gat is precies waar `WETTEN.json` en `scripts/sabotage.js` voor
zijn. De census vraagt "kijkt er iemand"; de sabotage stelt de enige vraag die
daarna nog overblijft: **als ik deze afspraak WERKELIJK overtreed, wordt er dan
iets rood?** Dus wordt hij overtreden -- in de echte bestanden, met de wachter
erachteraan en alles terug na afloop. Dat is regel 2 toegepast op de afspraken
zelf in plaats van op een enkele toets.

Wat ook die motor niet kan, en het staat in zijn eigen kop: RAAK bewijst dat een
wachter gevoelig is voor DIE ene overtreding, niet dat hij elke overtreding ziet
en niet dat de wet goed geformuleerd is. En het register bevat alleen wat iemand
heeft opgeschreven -- een afspraak die dit huis wel naleeft maar nergens noemt,
is er onzichtbaar. Dat is de grootste blinde vlek van allemaal, want hij is per
definitie niet te tellen. `npm run zekerheid` zet die grenzen onder elke stand,
zodat een lijst met vinkjes nooit voor meer doorgaat dan hij is.
