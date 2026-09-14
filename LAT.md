# De lat

Dit is de technische lat voor RTG. `CLAUDE.md` gaat over het merk; dit gaat over
de code. Alles hieronder komt uit een fout die hier echt is gemaakt, en elke
regel zegt erbij WAT hem handhaaft. Een regel zonder handhaver is een voornemen,
en die staan hieronder ook als zodanig gemarkeerd.

De lat geldt voor nieuw werk, voor wat er al staat, en voor wat er nog komt. Wat
dat per tijdvak betekent staat onderaan, want het is niet voor alle drie
hetzelfde en doen alsof van wel is de eerste manier om hem te verliezen.

---

## De regels

*Ze zijn GENUMMERD en niet GETELD, en dat verschil is er een van vandaag. De
nummers dragen betekenis -- `scripts/check.js` citeert er zes bij naam ("LAT.md
regel 4", "regel 8", "regel 10"), dus een regel hernummeren breekt een
verwijzing. Het TOTAAL droeg niets: het stond in CLAUDE.md als "elf regels"
terwijl het er twaalf waren, verouderde stil, en had geen enkele handhaver. Een
aantal dat niemand nakijkt is een bewering zonder handhaver -- regel 6, op het
document zelf.*


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
schalen -- `stuur/beleid.js` (verboden/voorstel/direct), `frictie/motor.js`
(hand/assist/auto), `geldbeleid/regels.js` (kijken/voorstellen/klaarzetten/
automatisch), `stadsweefsel/ainiveau.js` (waarnemen tot verboden) en
`bureau/delegatie.js` (informeren tot autonoom). Elk van de vijf is op zichzelf
zorgvuldig gebouwd; het bezwaar is dat geen van de vijf de andere vier kan lezen,
dus geen mens en geen machine kan ze naast elkaar leggen. Ze waren dan ook al
uiteengelopen, en die twee gevallen staan hier omdat ze allebei zijn gerepareerd
en allebei laten zien wat de kosten van vijf schalen zijn.

`ainiveau.js` zette "een vergunning of aanvraag afwijzen" op niveau 4 ("hier komt
geen machine aan, met of zonder sleutel") terwijl `stuur/beleid.js` precies die
handeling als `voorstel` toeliet, en `magAutomatisch()` -- dat in zijn eigen
commentaar "de enige plek die daar antwoord op geeft" heet -- werd op die weg
nooit aangeroepen. De niveau-4-lijst was daar dus decoratie. Opgelost op
3 september 2026 (TAKEN.md 4.56) zonder een van beide documenten te verzwakken:
`ambtenaar.js` roept hem aan, geeft zijn reden door aan de mens die bevestigt, en
kiest geen dossier meer uit -- want dát was het echte bezwaar, de machine koos
zelf wie er werd afgewezen. En de bevinding is niet weggegooid maar verhuisd naar
`OPGELOST` in `scripts/gezag.js`, met dezelfde tand: haal de koppeling weg en
`npm run gezag` zakt. Een opgeloste bevinding die niets achterlaat, is een
reparatie die de volgende ronde stil kan verdwijnen.

Daarnaast stond `niveau: 'hand'` als kale tekenreeks in achttien Command-modules
die `risico.js` niet importeerden: hernoem de trede en die achttien schrijven
zwijgend het oude woord. Ook dat is dicht (TAKEN.md 4.55, `losseNiveaunamen` 22
-> 0), en daar bleek de nul zelf zacht: de meter sloeg een bestand over zodra het
de schaal ophaalde, ook als er een kale trede naast bleef staan.

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

*En het narekenen daarvan is zelf een voorbeeld bij deze regel* (3 september
2026, TAKEN.md 4.72). Het getal `actorVormen` in `ENVELOP.json` noemde zichzelf
"geratelde stand, mag alleen omlaag" en werd door geen script en geen toets
nagerekend: met de hand getypt, en dus niet in staat te zakken -- regel 6 in het
register dat over de canonieke vorm gaat. `scripts/actorvormen.js` leidt het nu
af. En toen bleek het er geen zeven van hetzelfde te zijn: ZES van de zeven zijn
sessieobjecten die ook domeindata dragen (`.tier`, `.staffId`, `.zaakcode`), en
die "overzetten op de envelop" zou de envelop een zevende sessie maken. Alleen
`req.boardroomKey` was een kaal duplicaat, en die is weg. De les is niet dat de
schuld kleiner was dan gedacht, maar dat een getal dat niemand narekent ook de
VRAAG verkeerd kan stellen.

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

*Tweede voorbeeld, 18 augustus 2026, en het is een parameter die er al stond.*
`dicht()` in `server/middleware/schakelaar-antwoord.js` kreeg `bekend`
meegestuurd en het commentaar erboven beloofde een vreemde "ook de NEUTRALE zin
en niet die van de reden". De functie las die parameter nooit. Het was daarmee
het derde geval van deze vorm in dezelfde twee bestanden -- eerst
functieschakelaars.js dat beloofde "nooit voor de deur" te antwoorden, toen de
bevoegdheids-as die maar half zweeg, en nu de schakelaar-as. De vorm om op te
letten: een parameter die alleen in het commentaar iets doet leest als
werkende beveiliging, ook voor wie de code ernaast bekijkt.

**Handhaver:** `check.js` regel 27 (elke aangeraden omgevingsvariabele wordt
ergens gelezen). Voor commentaar bestaat geen handhaver; dat is regel 2 en
mensenwerk. Voor deze derde: `test/schakelaar-zwijgt.test.js` houdt nu beide
kanten van beide assen vast, dus de belofte en de code kunnen niet meer los van
elkaar bewegen zonder dat er iets zakt.

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

*Een vijfde geval, en dat is een eigen vorm: een assertie die de tekst van een
CONTAINER leest terwijl hij over een element eronder beweert.* Dat ging in één
ronde drie keer mis, telkens net anders:

| wat er stond | waarom het niets bewees |
|---|---|
| `assert.match(await page.textContent('#opheffen'), /eruit gehaald/)` | de zin stond ook in de inleiding erboven; het blok waar het over ging kon verdwijnen zonder dat de toets iets merkte |
| `assert.match(await page.textContent('main'), ...)` | ergens op de pagina staat het, en dat is niet hetzelfde als op de juiste plek |
| `assert.match(rijTekst, /Waarvoor:\s*\S/)` | `textContent` plakt de kinderen aan elkaar, dus het VOLGENDE label ("Waar:") vulde de plek van het ontbrekende antwoord |

De les is smaller dan "lees geen containers": een AFWEZIGHEID aantonen wordt juist
sterker naarmate je breder kijkt (`assert.ok(!alles.includes(email))` hoort op de
hele pagina). Het is de AANWEZIGHEID die op het element hoort waar hij over gaat.

**Handhaver sinds 31 augustus 2026:** `scripts/schermmutatie.js`
(`npm run mutatie:scherm`). `scripts/mutatie.js` kende twee fasen en een
schermtoets valt in geen van beide op de manier die ertoe doet -- hij laadt geen
module (hij bezoekt een adres) en de liegpoort leegt de API, niet de PAGINA. De
nieuwe motor haalt stukken van het scherm zelf weg (`blok-weg`,
`appendChild-weg`) en kijkt of de toets het merkt. Op zijn eerste ronde vond hij
drie ongedekte stukken in het scherm waarvoor hij geschreven was.

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

*En de achtste, van 18 augustus 2026: een meter die met een leeg lijf aanklopt,
meet een dichte deur.* De gluurronde meldde negen aanmaakroutes "waarvan geen
enkele leesroute het resultaat toont". Acht van die negen hadden hun lezer
gewoon naast zich staan. De ronde vroeg ze alleen verkeerd: op `/api/rtf/*` wil
een route de gezinsreferentie in het lijf, en een detailroute wil het
identificator -- een leeg lijf levert daar een 403 of een 404 op, en dat las de
meter als "die functie bestaat niet". Het bijzondere is dat het instrument die
sleutelvorm al kende: bij het AANLEGGEN stuurde het hem netjes mee. De les was
niet meeverhuisd naar het TERUGZOEKEN, precies zoals de uitlogkanarie eerder
niet meeverhuisde van de rolronde naar de gluurronde. De vorm om op te letten:
een meter die een ONTBREKEN telt, moet kunnen aantonen dat hij het bestaande
wél ziet -- anders telt hij zijn eigen onvermogen. Wat er daarna wel echt uit
kwam, was een lek: `/api/concern/entiteit/groep` controleerde de eigenaar van
de entiteit maar niet die van de groep.

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


### 12. Een meting die niet heeft gedraaid is geen slechte uitslag

Regel 3 gaat over een meter die groen blijft zonder invoer. Dit is de omkering,
en die is gemener: een meter die zonder invoer een NETJES OPGEMAAKT SLECHT CIJFER
geeft. Groen zonder invoer valt op zodra iemand het nakijkt. Een slecht cijfer
valt niet op -- het ziet eruit als diligentie, en iemand gaat eraan werken.

De vraag die elke meter moet kunnen beantwoorden is dus niet alleen "wat is de
uitslag" maar eerst "heeft de meting plaatsgevonden". Zolang die twee in een
getal zitten, kun je ze niet uit elkaar houden.

*Het geval, 18 augustus 2026:* de e2e-ronde viel om op alle 122 browsertoetsen --
de omgeving had chromium 1194 staan en playwright vroeg om bouw 1234. Het
schermjournaal van die ronde bevatte 294 TOETS-regels, 296 AUDIT-regels en nul
SCHERM-regels. Precies hetzelfde bestand als een geslaagde ronde oplevert waarin
geen enkel scherm wordt geopend. Het platformregister zou daar "262 schermen
nooit geopend" van hebben gemaakt: een hard oordeel over 262 apps op grond van
een storing in de meetopstelling.

*En de twee wachten die dit hadden moeten zien, keken naar de verpakking:*
`test/skipwacht.test.js` en `test/browserpoort.e2e.js` controleerden allebei of
de MODULE playwright te vinden was. Die lag er die dag ook. Een aanwezige functie
is geen startende browser.

*Dezelfde fout, een laag hoger:* `scripts/meetkeuring.js` keurde het REGISTER en
trok daaruit een conclusie over het INSTRUMENT. Een instrument dat de regel nooit
heeft geleerd en een instrument dat hem vanmorgen leerde maar sindsdien niet
heeft gedraaid, zien er in het register identiek uit -- en ze vragen om twee
verschillende reparaties. Er is nu een derde uitslag, `oud register`, met de
herstelopdracht erbij.

*En het positieve spiegelbeeld:* waar een route niet te bewijzen valt, hoort er
te staan WAT eraan ontbreekt. 3112 keer "ongemeten" is eerlijk en onbruikbaar;
`scripts/waarom.js` maakt er negen soorten van met per soort wat eraan te doen
is. Dat is hetzelfde onderscheid van de andere kant: niet de uitslag maar de
voorwaarde.

**Handhaver:** `scripts/schermen.js` `rondeVerslag()` (nul geopende schermen uit
een ronde met browsertoetsen is een storing, geen uitslag; `--vastleggen` weigert
dan), `test/schermronde.test.js`, `test/meetkeuring.test.js` toets 7, en
`scripts/check.js` regel 50 (een browser start op EEN plek, zodat er iets te
repareren valt als hij niet start). Voor de mens die een slecht cijfer leest en
zich niet afvraagt of er wel gemeten is, bestaat geen handhaver; daarvoor staat
deze regel hier.

### 13. "Mijn gebruikelijke controles" is niet "het oordeel van de keten"

Een CI-job die als ÉÉN release-oordeel geldt, bestaat uit meer poorten dan
iemand onthoudt. Wie er lokaal een paar van draait en dan pusht, heeft niet de
keten nagespeeld maar zijn gewoonte -- en het verschil tussen die twee is
precies waar een rode ronde vandaan komt.

De regel is dus niet "draai meer". Het is: **een samengesteld oordeel hoort
lokaal als één opdracht te bestaan**, zodat er geen ruimte zit tussen *ik heb
mijn controles gedaan* en *ik heb het oordeel gereproduceerd*.

*Het geval, 13 september 2026:* een tak zakte op `De keuringen (statisch) en
PostgreSQL`. De oorzaak was klein -- een notitie in `NORM.json` droeg
`soort: "besluit"` en het verval kent alleen `structureel` en `schuld` -- maar
de manier waarop hij ontsnapte is de les. Van de vier poorten in die job waren er
lokaal twee gedraaid (`check.js`, `norm.js`); `deltapoort.js` en
`normverval.js` niet. Allebei hadden ze hem gevonden: `normverval` in 200
milliseconden.

*En het gereedschap bestond al.* `scripts/ci-lokaal.js` draait precies die keten
en leidt de poorten AF uit `.github/workflows` in plaats van ze over te typen --
`normverval` staat er als tweede regel in. Wat ontbrak was niet een mechanisme
maar het gebruik ervan; in de PR-tekst stond het vakje `npm run ci:lokaal` zelfs
uitdrukkelijk ONGEVINKT, en dat is erger dan vergeten.

*Waarom dit niet met een langere checklist op te lossen is:* een handgeschreven
lijst poorten is een tweede waarheid naast `ci.yml` (regel 4), en die loopt uit
elkaar zodra iemand een poort toevoegt. De kop van `ci-lokaal.js` zegt het zelf:
*"Een handgeschreven lijst hier zou dat oplossen tot de eerste keer dat iemand
hem vergeet bij te werken -- en daarna bewaakt hij niets meer en denkt iedereen
van wel."* De afleiding uit de werkstroom IS de handhaving.

*Wat de keten hier niet kan, meldt hij als NIET GEDRAAID met de reden* -- geen
Redis, geen PostgreSQL, geen docker -- en nooit als `staat`. Dat is regel 12 in
het klein: een poort die je overslaat en groen noemt, is erger dan een poort die
je niet hebt.

**Handhaver:** `scripts/ci-lokaal.js` (afgeleid uit `.github/workflows` via
`scripts/lib/werkstroom.js`; `--controle` zakt zodra de gewone ronde een poort
niet meer bereikt) en `scripts/ci-keten.js`, die eist dat elke poort leesbaar
genoeg blijft om hier na te spelen. Voor de mens die hem niet draait bestaat geen

### 14. Een meter kent zijn eigen grens

Een meter die uitspraken doet over onbekend terrein wordt eerst geijkt tegen
beschikbare bekende waarheid. Is er geen grondwaarheid beschikbaar, dan zegt de
meter dat expliciet en beperkt hij zijn conclusies tot wat hij daadwerkelijk
heeft waargenomen.

Regel 10 gaat over een meter die je niet hebt zien uitslaan. Regel 12 over een
meting die niet heeft gedraaid. Dit is de derde in die familie en de stilste: een
meter die WEL draait, WEL uitslaat en een overtuigend getal geeft -- terwijl
niemand weet of hij het bewijsbare überhaupt ziet.

*Het eerste geval, 13 september 2026:* `scripts/doctrine.js` telde harde
uitspraken in de doctrine-documenten en meldde 1088 kandidaten. Een net getal,
netjes uitgesplitst. Toen het tegen `WETTEN.json` werd gehouden -- vijftig
uitspraken waarvan een mens al had vastgesteld dat ze hard zijn, met een
handhaver en een sabotage eronder -- vond hij er **21**. Van de 29 die hij miste
stond het anker van er 15 op een kop, 4 op een vette openingszin en 2 in een
blokcitaat: drie plekken die hij per ontwerp niet las. Zonder die ijking had
niemand het gemerkt, want er was niets om het getal tegen af te zetten.

*Het tweede geval, dezelfde dag, en het is de scherpere:* `scripts/verband.js`
vraagt of een onafhankelijke waarnemer de wet-wachter-randen terugvindt die
`WETTEN.json` verklaart. Bij het narekenen is er een sensor toegevoegd die het
veld `handhaver` teruggaf -- precies het veld dat hij moest reconstrueren. De
uitslag sprong naar 56 van de 56. Honderd procent, en er was niets geleerd. Een
meter die zijn eigen antwoord leest, ijkt zichzelf en is dan niet fout maar leeg
-- en hij ziet er beter uit dan de eerlijke versie.

*De helft die niet over percentages gaat.* Deze regel eist NIET dat elke meter
een score haalt. Voor sommige verschijnselen bestaat geen menselijke catalogus om
tegen te ijken, en zo'n meter is daarmee niet waardeloos. Hij mag alleen niet
claimen wat hij niet kan weten: "gevonden: 37 kandidaten" is een waarneming,
"dekt alle gevallen" is een dekkingsclaim, en die tweede vraagt een grondwaarheid.
Wie geen grondwaarheid heeft, schrijft op waarom -- dat is een eerlijke stand en
geen gat dat verstopt wordt, dezelfde vorm als het `mensenwerk` van `WETTEN.json`.

*En de vloer hoort niet op het laatste getal te staan.* De ijking van de
doctrinecompiler staat op 48 van de 50 en zijn ondergrens op 45; die van de
verbandlaag op 54 van de 56 met een vloer van 50. Een NIEUWE wet waarvoor nog
geen sensor bestaat is gewoon werk en mag binnenkomen. Wat niet mag is dat
bekende zichtbaarheid stil verdwijnt.

**Handhaver:** `scripts/lib/ijking.js` (welke meter tegen welke grondwaarheid is
geijkt, of waarom er geen is) plus `test/meterwet.test.js`, dat drie dingen laat
zakken: een meter met een dekkingsclaim die geen grondwaarheid verklaart, een
`GEEN` zonder reden, en een verklaarde grondwaarheid waarvan de uitslag ontbreekt.
Voor de mens die een hoog percentage leest en zich niet afvraagt waartegen het is
gemeten, bestaat geen handhaver; daarvoor staat deze regel hier.

### 15. Een bewijsveld draagt een bewijsrelatie

Wanneer een veld meerdere semantisch verschillende relaties vertegenwoordigt,
worden die relaties afzonderlijk benoemd en gemeten.

Deze regel staat er pas nadat hij drie keer onafhankelijk is misgegaan, en de
derde keer was de gevaarlijkste.

*Een, 13 september 2026:* `handhaver` in `WETTEN.json` bleek twee dingen te
betekenen. Van de 93 verklaarde randen wijzen er 57 naar een WACHTER (een toets
die rood wordt) en 36 naar de IMPLEMENTATIE die de regel draagt. Een
implementatiebestand kan de wet perfect dragen zonder ooit rood te worden, en
een toets kan perfect rood worden zonder de implementatie te zijn. Die twee
optellen tot "handhavers" telt appels bij peren.

*Twee, dezelfde dag, in de meter die het eerste geval aanwees:* `isWachter` in
`scripts/verband.js` besliste op het PAD -- alles onder `scripts/` was een
wachter. Toen `scripts/lib/ijking.js` als handhaver in het register kwam,
belandde een BIBLIOTHEEK in de wachter-bak: een bestand met besluiten dat niets
uitvoert en dus nooit rood wordt. De aanwijzer maakte de fout die hij aanwees.

*Drie, en deze kan valse dekking produceren:* het veld `bereik` draagt in de
bewijsregisters drie betekenissen. In `MAGNAATLAB.json` is het wat de
simulatielaag werkelijk RAAKT. In `TAALOORDEEL.json` is het *"waarover dit
oordeel gaat"* -- de gelding. In `EXECUTION_MAP.json` is het wat een rol via het
AI-stuur MAG. De eerste twee zijn de twee kanten van dezelfde vraag, en ze staan
onder een naam: wie ze ooit optelt tot een dekkingsgetal, leest waargenomen reik
als verklaarde gelding. Dat is geen telfout maar een bewering die niemand heeft
gedaan.

*Waarom dit geen naamgevingskwestie is.* Een veld met twee betekenissen is
technisch correct en semantisch onjuist, en dat is precies de vorm die geen
enkele toets ziet: het type klopt, de waarde klopt, de optelling klopt -- alleen
de vraag die beantwoord wordt is een andere dan de gestelde. Dezelfde familie als
`SEMANTIEK.json` meet voor constantennamen, hier op de bewijslaag.

*Wat de regel NIET eist:* dat elk veld overal hetzelfde heet. `route` betekent in
zeventien registers een HTTP-pad en dat is geen overbelasting maar consistentie.
De regel bijt waar een naam twee verschillende RELATIES draagt binnen dezelfde
bewijsvraag.

**Handhaver:** `scripts/lib/bewijsvelden.js` (welk veld draagt welke relatie, en
welke velden zijn aantoonbaar gesplitst) plus `test/bewijsveld.test.js`. Voor de
mens die twee getallen optelt omdat ze dezelfde kop dragen, bestaat geen
handhaver; daarvoor staat deze regel hier.

### 16. Een register heeft hoogstens een schrijver, en die bewijst bij publicatie dat hij nog dezelfde wereld meet

Regel 12 gaat over een meting die niet heeft gedraaid. Dit is de derde vorm, en
hij is van de drie de gevaarlijkste: een meting die **wel** heeft gedraaid, met
een **correcte** meter, over een wereld die er niet meer is. De uitslag is dan
plausibel, netjes opgemaakt en volledig -- en fout. Er is geen enkel spoor in het
bestand waaraan een lezer dat kan zien.

Twee helften, en ze falen los van elkaar.

**De schrijfkant: hoogstens een schrijver.** Loopt er een tweede meter van
dezelfde soort, dan wint de laatste die klaar is, en dat is niet degene die de
verste wereld heeft gezien.

*Het geval, 13 september 2026:* een crashproefronde (pid 9598) was gestart voor
een rebase en leefde daar nog, terwijl ik na de rebase een verse ronde begon.
Die oude ronde had `CRASHPROEF.json` technisch geldig kunnen schrijven, alleen
over de wereld van voor de rebase. Hij is gevonden doordat ik op een proces
wachtte en `ps` er twee vond -- niet door een wachter. Bij de twee pogingen
ervoor ging het wachten zelf mis: `pgrep -f` matchte zijn eigen opdrachtregel, en
`pgrep | tail -1` pakte een vluchtige treffer en meldde daarmee "de meting is
klaar" terwijl er nog een draaide.

**De publicatiekant: dezelfde wereld als bij de start.** `scripts/lib/stempel.js`
leest de commit op het moment van SCHRIJVEN. Een ronde die op commit A begint en
publiceert terwijl HEAD op B staat, krijgt dus stempel B -- een bestand dat van
zichzelf zegt dat het B meet terwijl het A heeft gemeten. Dat is geen
theoretische mogelijkheid: het is precies wat pid 9598 zou hebben opgeleverd. Een
stempel die de bronwereld bij de START vastlegt en bij publicatie vergelijkt,
weigert dan met een reden in plaats van te liegen.

**En er is een leeskant, met een eigen geval op dezelfde dag.** Een register kan
ook achterlopen op de bron die het beschrijft, en dan geeft het een
zelfverzekerd verkeerd antwoord aan zijn LEZER. `ROUTEBRON.json` wees voor vier
bankroutes naar regelnummers van voor mijn bewerking van
`server/routes/kantoren/bank.js`; `scripts/crashproef.js` las daar `leestBody:
false` uit voor routes die hun body wel degelijk lezen. De reparatie was niet het
register verversen maar de LEZER laten twijfelen: het regelnummer werd een
aanwijzing in plaats van een adres, en een niet-gevonden pad antwoordt `null` en
niet `false`. Over de 45 geldroutes klopte het regelnummer 40 keer en zat het 5
keer ernaast.

Drie dingen die uit deze regel volgen en die je nergens anders moet herhalen. Een
exclusief slot hoort te WEIGEREN en niet te wachten -- een tweede ronde die
netjes in de rij gaat staan, publiceert alsnog een verouderde wereld zodra hij
aan de beurt is. Een geweigerde ronde raakt het register NIET aan, ook niet om er
"mislukt" in te zetten: een half bijgewerkt register is erger dan een oud. En de
schaal is niet klein: 84 scripts schrijven via `scripts/lib/stempel.js` en er
staan 138 registers in de wortel, dus dit is een eigenschap van de meetlaag en
geen eigenaardigheid van de crashproef.

**Handhaver:** vandaag niemand -- en dat is de eerlijke stand, niet een
vooruitblik. De leeskant is op een plek gerepareerd
(`scripts/crashproef.js` `leestBodyVan()`, met `null` voor onbekend) en de andere
lezers van een register zijn niet nagelopen. Het exclusieve slot en de
vergelijking bij publicatie horen in `scripts/lib/stempel.js`, waar de stempel al
woont; zolang ze daar niet staan, is dit een regel waar alleen op mensen wordt
vertrouwd.

---

### 17. Een poort bewijst alleen zijn eigen bereik

Regel 11 gaat over twee soorten groen die verschillende dingen betekenen. Dit is
de gemenere variant: **een** soort groen, correct gemeten, en daarna in woorden
ruimer gemaakt dan hij is.

*Waar dit fout ging, twee keer op een dag:* op 13 september 2026 stonden
`npm run check`, `npm run norm` en de deltapoort alle drie groen, en dat is in
dit verslag "de gate is groen" gaan heten. CI bleef daarna terecht rood, twee
keer achter elkaar en om twee verschillende dingen:

- `test/routedekking.test.js` vond een route die de server registreert en die
  nooit door een toets was aangeraakt (`POST /api/supplier/activity`);
- keuringsregel 41 zakte omdat `BEWIJS.md` achterliep op de toetsen.

Geen van beide ligt binnen wat die drie poorten meten. Er was dus niets mis met
de meting -- de uitspraak was ruimer dan het bewijs. Dat is precies de fout die
regel 11 in het groot beschrijft, nu in het klein en daarom veel makkelijker te
maken.

**Elke poort heeft een bereik, en dat bereik is klein:**

| Poort | Bewijst | Bewijst NIET |
|---|---|---|
| `npm run check` | statische huisregels, registers, documentwaarheid | gedrag, routedekking, ketens, go-live |
| `npm run norm` | de ratels en aantalsnormen in `NORM.json` | alles wat geen ratel heeft |
| `npm run delta` | geen verslechtering t.o.v. de basis, op de **gewijzigde** bestanden | de rest van het huis; gedrag; routedekking |
| `npm test` | gedrag van wat een toets aanroept | wat geen toets aanroept |
| `test/routedekking.test.js` | elke geregistreerde route is door een toets geraakt | of die aanraking iets zinnigs toetst |
| `npm run e2e` | gedrag in een echte browser | wat geen schermtoets aanroept |
| de ketenproeven | dat één benoemde keten van begin tot eind sluit | de negentien andere |
| `npm run golive` | operationeel en juridisch mogen starten | de software |
| CI | de samenstelling van al het bovenstaande | niets daarbuiten |

Voortaan dus niet "de gate is groen" maar **"statische poort groen; gedrag en
routedekking nog niet bevestigd"**. Dat klinkt kleiner en het is waar.

**En een poort kan op de SOM van meer dan een ronde leunen.** `DEKKING.json`
wordt gevuld uit twee journalen: `.routejournaal` van `npm test` en
`.schermjournaal` van `npm run e2e`. Draai je er een en lees je de uitslag alsof
hij compleet is, dan lijken de browser-only routes ongedekt -- vijf stuks, op
13 september 2026, en geen ervan was een echt gat. `scripts/dekking.js` zegt dat
zelf ("zonder die ronde blijven de browser-only routes ongeraakt, en dat hoort de
poort dan ook te zeggen in plaats van ze te verzwijgen") en hij WEIGERDE te
schrijven. Had hij wel geschreven, dan stond de beperking van mijn omgeving nu
als eigenschap van de codebase in een register -- regel 12, een laag dieper.

**Het gevolg voor een nieuwe HTTP-route.** Dezelfde dag kwam de tweede helft van
deze les binnen, en die is architectonisch. `POST /api/supplier/activity` HAD een
toets: `test/supplier-activity.test.js`, die de handler op een nagemaakte app
monteert. Die toets is goed en bewijst één ding van de drie die een route nodig
heeft:

1. **handlergedrag** -- doet de functie wat zij belooft (een nagemaakte app kan dit);
2. **echte montage en transport** -- is de route werkelijk geregistreerd en bereikbaar;
3. **bevoegdheid op een echte server** -- weigert de echte deur de verkeerde rol.

Een nagemaakte app bewijst alleen de eerste. Daaruit volgt de regel: **geen
nieuwe HTTP-route zonder ten minste één treffer op een echte server in een
gewone CI-toets.** Niet als losse lijst die iemand moet bijhouden, maar
mechanisch -- route-inventaris tegenover routejournaal, en dat is precies wat
`test/routedekking.test.js` al doet. De les is dus niet dat er een poort bij
moet, maar dat die poort tot de definitie van "in CI bewezen" hoort en niet tot
het optionele meetwerk eromheen.

Let op de valkuil die dit geval eronder verstopte: de route WERD wel over HTTP
geraakt, door `scripts/zaakliveproef.js`. Maar dat is een SCRIPT: het draait in
de meetronde en niet in elke CI-run. Dat onderscheid staat al in de kop van
`test/integratie-routes.test.js`, waar het na een eerdere vondst van de
deltapoort is opgeschreven -- en is hier alsnog opnieuw gemaakt.

*En deze tabel maakte zelf meteen dezelfde fout:* de deltapoort stond er onder
de naam van zijn SCRIPTBESTAND in plaats van onder zijn npm-naam, en zo'n
commando bestaat niet. Keuringsregel 67 (*"elk `npm run X` in een document
bestaat ook echt"*) ving het binnen een uur. Ik had de tabel uit mijn hoofd
opgeschreven in plaats van uit `package.json`, en dat is exact het patroon dat
deze regel beschrijft: een bewering die ruimer is dan wat er is nagekeken.

De reparatie liep bovendien twee keer mis op dezelfde manier als bij de
afbouwdiagnose hierboven: de eerste versie van dit stukje CITEERDE de kapotte
naam, en die keuring leest een document net zo goed als code. Een voorbeeld van
wat er fout was, schrijf je dus niet uit -- je beschrijft het.

**Handhaver:** `scripts/check.js`, `scripts/norm.js` en `scripts/deltapoort.js`
drukken sinds deze dag zelf hun bereik af, op de groene EN de rode uitgang. Een
tabel in een document had deze fout niet voorkomen; een poort die zijn eigen
grens meeleest wel, want dan staat de beperking op het scherm van wie hem
draait. Voor de mens die drie groene poorten optelt tot één zin bestaat verder
geen handhaver -- daarvoor staat deze regel hier, net als bij regel 11.


### 17. Een poort die een artefact leest, herberekent het of bewaakt niets

Een register in de wortel is een **bouwartefact**, en een artefact kan een commit
achterlopen. Een poort die zo'n bestand leest en er een uitspraak op doet, doet
die uitspraak over de laatste meetstand en niet noodzakelijk over de huidige code.

`EXECUTION_MAP.json` heeft dit al opgelost: de autoriteit komt live en nooit uit
een bouwartefact. De vorm die werkt staat in `test/capabilities.test.js`: draai
het instrument opnieuw en vergelijk elk getal met wat er is vastgelegd.

*Het geval, 13 september 2026:* de poort `LEGACY_PENDING_CLASSIFICATION mag
alleen krimpen` stond vier dagen groen op nul terwijl er 47 schrijfroutes zonder
contract waren. `MUTATIECONTRACT-AFGELEID.json` was veranderd zonder dat
`MUTATIECONTRACT.json` was meegeregenereerd. Een versheidswaarschuwing alleen is
niet genoeg: die zegt dat een bestand oud is, niet of het nog klopt. Vergelijk
daarom elk getal, niet slechts een handvol.

**Handhaver:** `test/mutatiecontract.test.js` draait de actuele telling en
vergelijkt elke stand; `test/capabilities.test.js` en
`test/objectmodel.test.js` doen hetzelfde voor hun registers. Voor registers
zonder zo'n toets bestaat geen handhaver, en daarvoor staat deze regel hier.

---

### 18. Tijdens een meetronde is de werkboom niet van jou

Een meetketen schrijft registers en journalen en zet bij ijkingen bewust
verkeerde waarden neer die zij daarna zelf terugzet. Wie tijdens zo'n ronde
`git status` leest, ziet een momentopname midden in een proef. Wie er
`git add -A` op loslaat, schrijft die momentopname de geschiedenis in.

Op 13 september 2026 gebeurde dat in drie vormen: een `GLUURRONDE.json` uit een
vuile boom, tijdelijke ijkgegevens in `package.json` en `LUSSEN.json`, en een
half `.schermjournaal` na het afbreken van de e2e-fase. De regel die eruit volgt:
draai nooit twee meetketens tegelijk, commit niet door een lopende ronde heen en
beëindig een keten niet halverwege een fase.

**Handhaver:** `scripts/lib/stempel.js` zet `boomVuil` op elk register en
`scripts/norm.js` ratelt `registersUitVuileBoom`; de deltapoort meldt hem per
bestand met de reden. Voor de mens die midden in een ronde commit bestaat geen
handhaver.

---

### 19. Een handhaver die één vorm kent, bewaakt één vorm

Een poort die op een patroon zoekt, vindt dat patroon en niet automatisch het
hele probleem. Zodra dezelfde fout anders wordt geschreven, kan groen ten
onrechte als een uitspraak over alle vormen worden gelezen.

*Het geval, 13 september 2026:* de pipe-regel vond
`console.log(JSON.stringify(...))` gevolgd door `process.exit()`, maar niet de
gelijkwaardige variant met `process.stdout.write`. Hetzelfde gebeurde in
`scripts/dekking.js`: twee takken telden de unie van de route- en
schermjournalen, terwijl de tak die de suite zelf draaide alleen het eigen
journaal gebruikte. Browser-only routes konden daar dus nooit gedekt raken.

De vraag bij elke handhaver is daarom niet alleen "vindt hij dit geval?", maar
ook "hoe ziet dit geval eruit als iemand het anders schrijft?". Waar dat
onbekend is, hoort het expliciet te worden vermeld.

**Handhaver:** `scripts/mutatie.js` muteert de code en eist dat een toets zakt.
Een handhaver die een tweede schrijfwijze niet ziet, zakt daar niet op, en
daarvoor staat deze regel hier.

### 21. Een belofte over een spoor is pas een regel als het spoor kan weigeren

Dit huis belooft op tientallen plekken dat er iets wordt vastgelegd: wie in een
dossier keek, welk besluit er viel, wat er is weggeschreven. Zo'n belofte is pas
een regel als de schrijfactie de handeling kan TEGENHOUDEN. Kan zij dat niet, dan
gaat de handeling door terwijl het spoor ontbreekt -- en de gebruiker krijgt een
bevestiging over iets dat niet is gebeurd.

*Het geval, 13 september 2026:* `server/inzagelog.js` gaf `noteer()` een uitslag
terug die **geen van de 42 aanroepende bestanden las**, en het wegschrijven zat in
een lege `catch`. Zonder database schreef hij in een weggegooide array en meldde
succes. De inzage in het dossier van een lid ging dus gewoon door als het spoor
niet geschreven werd -- en juist daar is het spoor de hele rechtvaardiging.

*Waarom een genegeerde uitzondering niet het ergste is.* De reparatie die zich
opdringt is "vang die fout op en meld hem". Dat verschuift het probleem naar een
VALSE BEVESTIGING, en die is erger, want hij ziet eruit als bewijs.
`save()` in `server/db/index.js` zet binnen een bundel alleen een vlag; in
PostgreSQL-modus markeert hij dat de responsepoort vóór het antwoord één
autoritatieve commit moet doen. Succesvol terugkeren betekent daar dus niet dat
er iets staat. "Geregistreerd" mag daarom niet betekenen dat er geen fout is
gegooid, maar dat de COMMIT geslaagd is -- en dat is beproefbaar zonder iets
nieuws te bouwen: `server/lib/verraad.js` kent `schrijf-verloren` ("keert NORMAAL
terug zonder iets te bewaren") en `schrijf-faalt`.

*De reparatie hoort op EEN plek en niet in 42.* `inzagelog.noteerVast()` levert
een uitslag, en `kern/ledenbalie-inzage.js` houdt de inzage tegen als het spoor
niet vaststaat: onder beide verraadstanden komt er geen dossier, geen
trefferlijst en geen herstelbericht meer uit. Daaruit volgt een tweede les die
breder geldt: **plaats een garantie waar alle informatie voor die garantie
samenkomt, niet zo vroeg mogelijk in de keten.** De kluispoort kent de MENS en
niet het onderwerp; het journaal kent het onderwerp en niet wat er getoond zou
worden.

*En het spoor zegt `toegestaan`, nooit `geleverd`.* De regel wordt geschreven
vóór het dossier wordt samengesteld, dus hij legt vast dat inzage is VERLEEND.
Zou er `ingezien` staan, dan liegt het spoor bij elke mislukte lezing -- en in
het voordeel van het huis.

*De vorm is niet uniek voor het journaal.* Van de 1841 `catch`-blokken in
`server/` zijn er 674 volledig leeg, en daarbinnen staan 18 SPOOR-schrijvers en
24 OPSLAG-schrijvers in een `try` waarvan het falen wordt opgegeten. Dat is een
vorm en geen aanklacht: `server/log.js` smoort `noteerFout` omdat een logger die
zelf gooit de oorspronkelijke fout maskeert, en `kern/envelop.js` zegt met zoveel
woorden dat de LEVERING voorgaat. Het getal is daarom een triagelijst met een
besluitregister ernaast, in de vorm van `HERREKENBAAR.json` naast
`FAALPROEF.json`: een verklaring is een besluit en wordt nooit van de telling
afgetrokken.

**Handhaver:** `scripts/stilspoor.js` + `STILSPOOR.json` (`npm run stilspoor`),
met drie ratels in `NORM.json`: `stilSpoor` en `stilleOpslag` mogen alleen
omlaag, en `stilSpoorAanroepen` alleen omhoog -- want een schuld die daalt
doordat het instrument blind wordt, is de gevaarlijkste vorm van vooruitgang.
Verder `test/ledenbaliespoor.test.js` en `scripts/faalproef.js` (`FAALPROEF.json`:
per route beproefd onder `schrijf-verloren` en `schrijf-faalt`). Voor de
aanroeper die de uitslag van een schrijfactie negeert ZONDER try/catch bestaat
geen handhaver; die vorm draagt geen kenmerk waar een meter op kan aanslaan, en
---

## Wat de lat betekent per tijdvak

### De toekomst

Bindend. Nieuw werk voldoet aan alle elf, en waar een machine kan handhaven
handhaaft hij. Wie een regel toevoegt aan `check.js` beproeft hem met een mutatie
voordat hij hem inlevert (regel 2 geldt ook voor regels).

**Sinds 18 augustus 2026 handhaaft een machine dit ook echt: `scripts/deltapoort.js`.**
Die zin hierboven was tot dan een voornemen, en wel een van de gevaarlijkste
soort -- hij klonk als een regel. Wat eronder zat: elke meter in `NORM.json` is
een SOM over de hele codebase, en een som verrekent. Vijf inline stijlattributen
erbij in het ene bestand en zes eruit in het andere is een daling; de ratel
juicht, en het nieuwe bestand houdt zijn vijf. Zo blijft nieuw werk precies zo
slecht als oud werk mag zijn, terwijl elke meter de goede kant op wijst.

De deltapoort weigert die verrekening en hanteert twee latten. Een NIEUW bestand
staat op de norm -- nul inline stijlattributen, onder de omvanggrens, geen
zelfpoortende toets, elk endpoint met een toets. Een AANGERAAKT bestand mag niet
zakken: de erfenis hoef je niet op te ruimen om iets te mogen wijzigen, maar je
mag hem niet vergroten. Daarmee kan het geheel alleen nog dalen, en dat is het
verschil tussen "niet slechter worden" en "beter worden".

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

   Ook in die zin zaten twee gaten, en `scripts/normverval.js` sluit ze sinds
   18 augustus 2026. Het eerste: de reden was een GEWOONTE en geen eis. Er
   staan 62 notities in `NORM.json` -- een ongewoon nauwkeurig register -- maar
   niets hield tegen dat de 63e er niet kwam. Wie een getal verlaagt en verder
   niets doet, komt gewoon door de poort: `norm.js` vergelijkt de meting met de
   norm en heeft geen idee dat de norm zelf net is opgeschoven. De ratel
   bewaakte de code, en niemand bewaakte de ratel.

   Het tweede: een reden had geen EINDE. Een verlaging blijft staan tot iemand
   er toevallig over struikelt, en een excuus dat nooit verloopt is na een half
   jaar geen uitzondering meer maar een tweede norm die nergens staat
   opgeschreven. Vandaar twee soorten, en het verschil is echt. *Structureel*:
   het gemetene veranderde van vorm (elf schermtoetsen verdwenen omdat de
   schermen verdwenen). Daar valt niets terug te halen, dus geen vervaldatum --
   wel de eis te zeggen WAARHEEN de belofte ging. *Schuld*: we konden het even
   niet. Dat mag, met een datum erbij; daarna zakt de ronde tot de meter terug
   is. Zo wordt een schuld geind in plaats van vergeten.

4. **De ratel mag niet krimpen, en stilstand is zichtbaar.** Een ratel kan
   alleen tegenhouden wat hij meet, dus dekt hij over de tijd een steeds kleiner
   deel van een steeds grotere codebase. `ratelTanden` telt daarom hoeveel
   meters er geratelde zijn en mag alleen omhoog; `metingenZonderRatel` telt de
   meetbestanden in de wortel waar niets achter staat (zes van de eenentwintig)
   en mag alleen omlaag. En omdat een ratel over STILSTAND niets zegt --
   negentien van de drieentwintig meters stonden bij de laatste ronde op
   "gelijk", en dat mag eeuwig zo blijven -- toont `npm run norm` sinds
   dezelfde dag de veer: welke meter staat het langst stil terwijl er nog werk
   aan is. Die zakt met opzet niet. Een poort op stilstand koopt cosmetische
   winst, en dat heeft dit huis bij de dekkingsteller al een keer geleerd.

Dat is geen enterprise-grade verleden. Het is een verleden dat elke week een
stukje beter wordt en nooit slechter, en dat is het enige eerlijke aanbod.

---

## De handhavers op een rij

| wat | waar |
|---|---|
| 59 codeafspraken, binair | `scripts/check.js` |
| de INVOER van elke bronkeuring: commentaar eruit, maar geen code opeten | `scripts/lib/bron.js` + `test/bron.test.js` |
| toegankelijkheid van elk scherm, uitgelogd EN ingelogd, hard op nul | `scripts/a11y.js` + `A11Y-INGELOGD.json` |
| elk media-element een besluit over ondertiteling, met een reden | `scripts/check.js` regel 49 |
| de onderhoudsveger lost de rem niet, en is aan te roepen met een eigen klok | `server/opzet/onderhoud.js` + `test/onderhoud.test.js` |
| elk raakvlak 24x24 op telefoonformaat, en de uitzonderingen niet te ruim | `scripts/raakvlakkeuring.js` + `test/raakvlak.test.js` |
| geen geheim uit `Math.random()`, geen handtekening met `!==` vergeleken | `scripts/check.js` regel 50 |
| geen bestand plukt een naam uit een bereik dat het niet heeft | `scripts/check.js` regel 51 |
| WERELDLIJST.md loopt niet achter op het wereldregister | `scripts/check.js` regel 52 |
| elk scherm is vanaf de bank te bereiken | `scripts/check.js` regel 53 |
| elke meter met een dekkingsclaim is geijkt tegen bekende waarheid, of zegt waarom dat niet kan | `scripts/lib/ijking.js` + `test/meterwet.test.js` |
| een bewijsveld draagt een bewijsrelatie; een gesplitst veld wordt apart benoemd en gemeten | `scripts/lib/bewijsvelden.js` + `test/bewijsveld.test.js` |
| elk register heeft een verklaarde eigenaar; geen script schrijft naar andermans register | `scripts/lib/registereigenaar.js` + `test/registereigenaar.test.js` |
| de ratel: meters mogen maar een kant op | `NORM.json` + `scripts/norm.js` |
| nieuw werk op de norm, aangeraakt werk niet eronder (geen verrekening) | `scripts/deltapoort.js` |
| een verlaging van de lat heeft een reden, een soort en een einde | `scripts/normverval.js` |
| de ratel zelf mag niet krimpen, en wat nergens aan hangt is geteld | `ratelTanden` + `metingenZonderRatel` + `scripts/lib/metingen.js` |
| welke meter het langst stilstaat terwijl er werk aan is (wijst, zakt niet) | de veer in `scripts/norm.js` |
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
| die laag ook echt geraakt vanaf een ECHTE route (bewezen weigerend is niet bewezen bereikbaar) | `test/begrotingroute.test.js` |
| de grens per collectie, en waar er geen mag staan (het vergeetpad) | `BEGROTING.json` + `server/opzet/begrotingsgrenzen.js` |
| een bovengrens draait in het onderhoud en niet in een schrijfroute | `server/kern/kappen.js` + `test/kappen.test.js` |
| welke grote krimpen de toetsen echt uitlokken -- met bewijs dat de val aanstond | `KRIMP.json` + `scripts/krimpronde.js` + `test/krimpronde.test.js` |
| een bronmuterende toets draait alleen, niet naast een server die diezelfde bron leest | `scripts/lib/geisoleerd.js` + `test/bronmutanten.test.js` |
| een register heeft hoogstens een schrijver, en meet bij publicatie nog dezelfde wereld | **niemand** -- zie regel 13; het slot en de vergelijking horen in `scripts/lib/stempel.js` |
| staat elke functie in de boardroom (en dus onder een schakelaar) | `scripts/schakelbaar.js` + `NORM.json` |
| de wisregels van de identiteitskluis en de locatiesporen | `server/bewaarveger.js` |
| elk scherm opent en geeft een teken van leven (dood is stiller dan stuk) | `test/paginas.e2e.js` |
| de Postgres-toetsen, elk in een eigen database | `scripts/pgtoetsen.js` |
| een omgeving die schermtoetsen belooft, heeft ook een browser die START | `test/browserpoort.e2e.js` + `test/skipwacht.test.js` |
| een ronde die niet heeft gedraaid, telt niet als uitslag | `scripts/schermen.js` `rondeVerslag()` |
| de instrumenten gemeten langs hun eigen regels | `scripts/meetkeuring.js` + `test/meetkeuring.test.js` |
| waarom een route niet te bewijzen valt, in zijn eigen woorden | `scripts/waarom.js` + `WAAROM.json` |
| een browser start op EEN plek | `test/helper.js` + `scripts/check.js` regel 50 |
| de harde uitspraken van dit huis, met per stuk wie hem tegenhoudt | `WETTEN.json` + `scripts/wetten.js` |
| dertien treden van kleuter tot aanvaller tegen een ECHTE server | `scripts/ladder.js` + `LADDER.json` + `ci.yml` |
| welke rol waar binnenkomt, gevraagd aan de server en niet aan de bron | `scripts/rolronde.js` + `ROLRONDE.json` + `ci.yml` |
| mag lid A bij de spullen van lid B (horizontaal), met een zelfproef erop | `scripts/gluurronde.js` + `GLUURRONDE.json` + `ci.yml` |
| geen vergunningsgegevens naar een beller die zich niet bekendmaakte | `server/middleware/schakelaar-antwoord.js` |
| elke handhaver EEN keer echt uitgezet, om te zien wie er rood wordt | `scripts/sabotage.js` + `SABOTAGE.json` |
| een belofte over een spoor die niet kan weigeren (de klasse, geen aanklacht) | `scripts/stilspoor.js` + `STILSPOOR.json` + drie ratels in `NORM.json` |
| wat we na al dat meten weten, en vooral wat we niet weten | `scripts/zekerheid.js` |
| bewijsgroen en go-live-groen kunnen elkaar niet groen praten | `scripts/check.js` regel 48 |
| de dekkingsvloer, opgeteld over de vier delen van de suite | `scripts/dekkingsvloer.js` |
| het a11y-oordeel over de hele ronde, niet per deel | `scripts/lib/a11yoordeel.js` + `test/a11yoordeel.test.js` |
| elke bronmuterende ijking draait ergens, en niet nergens | `scripts/lib/ijkingen.js` + `test/delen.test.js` |
| gedeeld zout blijft bij de demo-seed en komt nooit op een echt account | `scripts/check.js` + `test/zaaihash.test.js` |
| de pijplijn die dit alles draait bij elke push | `.github/workflows/ci.yml` |
| de zware rondes (beproeving, dekking) draaien vanzelf, wekelijks | `.github/workflows/ronde.yml` |
| een register-afdruk loopt niet achter op de code die hij beschrijft | `test/mutatiecontract.test.js` + `test/capabilities.test.js` toets 8 |
| een meting uit een vuile werkboom is geen bewijs | `scripts/lib/stempel.js` (`boomVuil`) + `registersUitVuileBoom` in `NORM.json` |
| grote uitvoer gevolgd door `process.exit()` kapt bij een pipe af | de pipe-regel in `scripts/meetkeuring.js` |

Wat hier niet in staat, wordt niet gehandhaafd. Dat is geen tekortkoming van de
lijst maar informatie: het zegt precies waar je op mensen vertrouwt.

De ladder stond hier tot 18 augustus 2026 niet in, en dat was geen vergeetachtigheid
maar een gevolg. Hij was de meest complete aanvalsproef van dit huis -- 3878
pogingen over dertien treden -- en hij kon niet groen worden: twaalf bewust
openbare routes stonden niet in zijn publieke lijst, een 503 uit de schakelkast
telde als serverfout, en de begane grond toetste op seed-gegevens die
weggedreven waren (KIKUNOI staat allang niet meer in de seed). Achttien keer
RAAK, elke ronde, geen van alle een bevinding.

En de derde helft kwam uit het instrument dat ik er zelf bij bouwde. De
gluurronde (`scripts/gluurronde.js`) meldde bij zijn eerste draaien netjes "A
kwam nergens bij de spullen van B" -- over 1084 vragen die allemaal **uitgelogd**
waren. A klopt in zijn passieve veeg op elke route, en daar zit
`/api/auth/logout` bij, alfabetisch vooraan; A logde zichzelf uit en kreeg
daarna 401 op alles. Groen, over een proef die niets had geprobeerd.

Het is exact dezelfde fout die een dag eerder in `scripts/rolronde.js` was
gevonden en gerepareerd. Hij kwam terug omdat de LES niet meeverhuisde, alleen
de reparatie. Vandaar dat de kanarie nu op de plek zit waar de vraag gesteld
wordt (`vraagA`) en niet in een losse controle ernaast: er is geen weg omheen.

Twee dingen leerde datzelfde instrument nog, allebei over METEN en niet over de
code. Toen de vernielingscontrole breder werd gemaakt -- van de eigen familie naar
een opname over alles -- vond hij VEERTIEN van B's stukken waar de smalle
zoektocht er vijftien vond. Een bredere zoektocht die minder vindt, vernietigt
onderweg: tussen die duizenden aanroepen zitten wis- en archiveerroutes die met
een leeg lijf gewoon hun werk doen. En de versie daarna liep tegen de
snelheidsrem: de eerste opname gaf 299 keer 2xx, de tweede nog 36, met 2700 keer
401 -- waarna de controle veertien lekken meldde die geen van alle bestonden.
**Een meting die de rem uitlokt, meet de rem.** Beide keren zag de uitslag er
geloofwaardig uit; beide keren was het getal verzonnen door het instrument zelf.

En daaruit volgde nog een correctie, op een meter die ik twee dagen eerder zelf
had gezet. `gluurProeven` telde VERZOEKEN. De herbouw controleerde meer en vroeg
minder (9349 in plaats van 9540), en de ratel las die winst als achteruitgang.
Een meter die geklets beloont, duwt de volgende verbetering de verkeerde kant op;
hij is vervangen door `gluurGecontroleerd`, dat telt wat er is NAGEKEKEN. Die
vervanging is langs de vervalregel gegaan als een structurele verlaging met een
waarheen -- het mechanisme uit de vorige ronde liep daarmee voor het eerst zijn
eigen pad.

En de dekking van diezelfde ronde kwam er niet met meer handwerk maar met
BETER LUISTEREN. Van de 73 aanmaakroutes lukten er 20; de andere 53 zeiden bijna
allemaal met zoveel woorden wat ze misten -- "een clip duurt 1 tot 60 seconden",
"welk vak is het?", "minstens twee vraag-antwoordparen", "wat is de kaart- of
ticketcode?". Die meldingen zijn de invoer voor de volgende poging, en elf
andere routes zeiden "Log opnieuw in bij je gezin", wat geen ontbrekend RECHT
bleek maar een andere SLEUTELVORM (gezinscode in het lijf, profieltoken in de
header of in body.token, afhankelijk van de route). Twaalf van de 73 waren
bovendien helemaal geen leden-routes. Een foutmelding die zegt wat er ontbreekt,
is een handleiding; wie hem als muur leest, bouwt een proef die minder ziet dan
hij kan.

En daaronder ligt de reden dat die ronde nu ook een ZELFPROEF heeft. Drie
pogingen om zijn scherpste controle -- ziet hij dat A iets van B heeft
weggegooid? -- met een opzettelijk gat te beproeven sloegen alle drie af, en
niet omdat de controle deugde: de mutatie werkte alleen zolang de notities van
het slachtoffer niet in een bundel waren opgeborgen. **Een ijking die van de
opslagvorm afhangt, is geen ijking.** Met `GLUUR_ZELFPROEF=1` laat B nu zelf
een stuk verdwijnen langs de gewone weg, en de ronde eist van zichzelf dat hij
dat ziet. Die stap draait in CI, naast de ronde zelf.

Dezelfde week kwam de tweede helft van die les uit een andere hoek.
`test/auth-rol.test.js` opende met "Uitputtende auth-scoping-test. Niet een
steekproef en geen mooipraterij" -- en herkende een leden-endpoint aan het
eerste woord na het pad. Staat de grendel in de BODY van de handler
(`const g = werkPoort(req, res); if (!g) return;`), dan valt de route buiten de
uitdrukking en dus stilzwijgend buiten de toets: 511 van de 1885 registraties,
waarvan zeventig echte leden-endpoints die nooit op rolscheiding zijn beproefd.

Geen van die zeventig bleek lek -- `scripts/rolronde.js` vraagt het nu aan de
server in plaats van aan de bron en vindt 1444 leden-endpoints met nul gaten.
Maar de belofte was onwaar, en dat is het punt: **een toets die zegt dat hij
alles ziet en 5% mist, is gevaarlijker dan een toets die zegt dat hij een
steekproef is.** De eerste laat je stoppen met zoeken. Beide meters van die
ronde staan er daarom naast elkaar: `rolscheidingGaten` (nul, mag niet omhoog)
en `rolscheidingGemeten` (1444, mag niet omlaag) -- want nul gaten is triviaal
te halen door minder te onderzoeken.

**Een proef die per definitie rood staat, kan nergens aan hangen.** Dat is de
stille manier waarop een handhaver uit deze tabel verdwijnt: niet doordat iemand
hem weghaalt, maar doordat hij zo veel ruis geeft dat niemand hem meer in een
poort durft te zetten. En dan valt de negentiende melding -- de echte -- niemand
meer op. De reparatie was dus niet de meldingen dempen maar ze waar maken; pas
daarna kon hij aan `ci.yml` en aan twee ratels. `ladderNietGeprobeerd` staat er
naast `ladderRaak` omdat nul bevindingen anders te halen is door niets meer te
proberen -- precies wat er gebeurde met de insider-trede, die nul proeven deed
en keurig geen enkele bevinding meldde.

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
