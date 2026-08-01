# De lat

Dit is de technische lat voor RTG. `CLAUDE.md` gaat over het merk; dit gaat over
de code. Alles hieronder komt uit een fout die hier echt is gemaakt, en elke
regel zegt erbij WAT hem handhaaft. Een regel zonder handhaver is een voornemen,
en die staan hieronder ook als zodanig gemarkeerd.

De lat geldt voor nieuw werk, voor wat er al staat, en voor wat er nog komt. Wat
dat per tijdvak betekent staat onderaan, want het is niet voor alle drie
hetzelfde en doen alsof van wel is de eerste manier om hem te verliezen.

---

## De negen regels

### 1. Repareer de oorzaak, niet het symptoom

Een reparatie die het gevolg wegneemt en de oorzaak laat staan heet hier een
pleister. Pleisters mogen bestaan als tussenstap, maar dan staan ze met naam in
de takenlijst met de oorzaak erbij.

*Voorbeeld:* boeking 50.001 verdween stil uit `db.data.boekingen`. De staart gaat
nu eerst duurzaam naar `archief/`, en dat is beter dan verlies. Maar de oorzaak
is dat het transactie-grootboek alleen in de sqlite- en postgres-stand actief is.
Zolang dat zo is, is die code een pleister en staat hij als zodanig genoteerd.

**Handhaver:** mensenwerk, zichtbaar gemaakt in het commit-bericht en de
takenlijst. Geen machine.

### 2. Elke bewering wordt met een mutatie nagetrokken

Een toets die je niet hebt zien zakken, is geen toets. Een keuringsregel die je
niet hebt zien afkeuren, keurt niets. Draai de reparatie terug, bevestig dat de
JUISTE toets zakt, zet hem terug.

Vier uitkomsten, niet twee: RAAK (de mutatie bijt), AFGESLAGEN (hij bijt niet en
dat is een bevinding op zich), GELUKT, NIET GEPROBEERD. Een mutatie die ALLES
laat zakken bewijst niets: dan is de mutatie te grof.

**Handhaver:** mensenwerk. Het commit-bericht noemt welke mutatie is gedaan en
welke toets ervan zakte.

### 3. Een meter zakt als zijn invoer ontbreekt

Stilvallen is geen uitkomst. Een teller zonder invoer, een draaier zonder
database, een keuring zonder journaal: die horen te falen, niet groen te blijven
met een eerlijke tekst erboven.

*Voorbeeld:* `scripts/dekking.js` gaf bij een leeg routejournaal netjes
exitcode 2. `scripts/pgtoetsen.js` gaf zonder database exitcode 0, met de tekst
"de Postgres-toetsen worden overgeslagen" erboven. Acht toetsbestanden hebben
daardoor maanden bestaan zonder ooit te draaien.

**Handhaver:** `scripts/check.js` regel 25 (elk zelf-poortend toetsbestand staat
in de draaier) en de exitcodes van de draaiers zelf.

### 4. Nooit twee plekken die een waarheid vasthouden

Zodra dezelfde waarheid op twee plekken staat, lopen ze uiteen. Niet misschien:
zeker, en meestal zonder dat iets klaagt.

*Voorbeelden die hier echt zijn gevonden:* `ledenGidsWeg` ontbrak in de
exportlijst van `db/index.js` terwijl drie modules hem doorgaven, waardoor het
recht op vergetelheid in Postgres-stand niets deed. De pasprijs stond in de
boardroom en nog een keer hard in `kern/lid.js`. De rate limiter `teVaak` stond
in drie kernmodules, en geen van de kopieen had de opruimronde van het origineel.

**Handhaver:** `check.js` regel 26 (elke naam die je uit een module haalt bestaat
daar), regel 25, regel 27, regel 28 (de publieke-routelijst mag geen namen
bevatten die niet meer bestaan of die inmiddels een eigen poort hebben), en
`scripts/kruisscan.js`.

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

**Handhaver:** regel 2 (mutatie) en de meter `zelfpoortendeToetsen` in
`NORM.json`. Voor de rest: mensenwerk.

---

## Wat de lat betekent per tijdvak

### De toekomst

Bindend. Nieuw werk voldoet aan alle negen, en waar een machine kan handhaven
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
| 29 codeafspraken, binair | `scripts/check.js` |
| de ratel: meters mogen maar een kant op | `NORM.json` + `scripts/norm.js` |
| kruis-slice-verwijzingen tussen opgeknipte modules | `scripts/kruisscan.js` |
| statische analyse zonder dependencies | `scripts/ast-scan.js` |
| geen geslaagde toets met een serverfout eronder | `test/helper.js` (strenge poort) |
| waargenomen endpoint-dekking uit het routejournaal | `scripts/dekking.js` |
| de Postgres-toetsen, elk in een eigen database | `scripts/pgtoetsen.js` |
| de pijplijn die dit alles draait | `.github/workflows/ci.yml` |

Wat hier niet in staat, wordt niet gehandhaafd. Dat is geen tekortkoming van de
lijst maar informatie: het zegt precies waar je op mensen vertrouwt.
