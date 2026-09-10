# KAARTEN.md -- alle landen aanbieden, en het lid kiest

RTG Navigatie kende precies EEN kaart: Nederland, uit het NWB van
Rijkswaterstaat. Daarbuiten viel alles terug op een demonstratieraster rond
Ibiza. Dit document beschrijft de laag die dat opent: **RTG biedt elk gebied aan
dat de bron kan leveren, en een lid kiest zelf welke kaarten hij wil hebben.**

Lees `NEDERLAND-WEGENNET.md` ernaast: dat gaat over de Nederlandse bron en
blijft onverkort gelden. Nederland is sindsdien EEN geval van deze laag, niet de
laag zelf.

## 1. Drie standen, en ze mogen nooit een vinkje worden

| stand | wat het betekent |
|---|---|
| `aangeboden` | de bron heeft dit gebied; RTG kan het bouwen |
| `gebouwd` | het pakket ligt in `RTG_DATA_DIR`, er valt hier werkelijk op te routeren |
| `gekozen` | dit lid wil deze kaart hebben |

**"Aangeboden" is geen dekking.** Wie die drie samentelt of er een groen vinkje
van maakt, belooft een kaart die niemand heeft gebouwd. Het scherm zet ze daarom
naast elkaar: *"200 gebieden aangeboden, 2 gebouwd, 3 door u gekozen"* is de
eerlijke mededeling.

Een gekozen gebied dat nog niet gebouwd is, is een **verzoek**: RTG weet daarmee
wat er gebouwd moet worden, en dat is precies de weg "via ons". Het antwoord van
`/api/nav/gebied/kies` zegt dat met zoveel woorden, zodat niemand denkt dat er
al een kaart klaarstaat.

## 2. De licentie is een grendel, geen veld

De catalogus komt van OpenStreetMap via Geofabrik: **ODbL 1.0**, en die licentie
EIST naamsvermelding. Een pakket dat die plicht draagt en geen vermelding
meelevert komt er niet door -- `gebieden.mag()` weigert het, met de reden, en
`gebiednetten.js` laadt de motor dan niet. Een kaart tonen zonder de vermelding
die de licentie eist, is niet een kleine slordigheid maar het overtreden van de
voorwaarde waaronder wij de data mogen gebruiken.

Het NWB is CC0 en vraagt niets; die twee gevallen staan op EEN plek
(`eistNaamsvermelding`), en onbekend telt als eisend -- een licentie die wij niet
kennen krijgt niet het voordeel van de twijfel.

## 3. Een bron-id is geen bestandsnaam

De ids van de bron dragen schuine strepen (`europe/netherlands`) en een
gebiedscode wordt een bestandsnaam. `kern/navigatie/pakket.js` weigert daarom
alles wat geen veilige code is: alleen kleine letters, cijfers en koppeltekens,
niet beginnend of eindigend op een koppelteken, en fail closed -- `null` en geen
pad. Dat is een reparatie en geen voorzorg: `pakketVan('../../../etc/passwd')`
gaf gewoon een pad buiten de datamap terug.

Het VERTALEN doet de indexschrijver (`scripts/navigatie-index.js`), want alleen
die ziet alle ids tegelijk. Bij een botsing -- twee ids die op dezelfde code
uitkomen -- vallen ze **allebei** af, met de naam van de ander in de reden. Een
van de twee laten winnen is willekeur op sorteervolgorde, en het gevolg is erger
dan een gemist gebied: een lid downloadt dan een pakket dat volgens het scherm
over het ene gebied gaat en in werkelijkheid het andere bevat.

## 4. Een rechthoek is geen grens

Wat van de bron overblijft is het omhullende vak. Het Nederlandse vak bevat
Belgisch en Duits land, dus twee landen overlappen echt.
`kern/navigatie/gebiedkeuze.js` beslist daarom op **verklaarde omvatting** (de
`ouder` uit de bron) en niet op oppervlak -- "het kleinste vak wint" liet
Maastricht een keer op Belgie uitkomen, met een echte reistijd over het
Belgische wegennet eronder. Blijven er buren over, dan kiest die module NIET, en
elk antwoord draagt `vakIsGeenGrens`.

## 5. Wat de laag NIET mag doen: iets wegnemen

De gebiedslaag mag alleen **toevoegen**. Zonder gebiedsindex gedraagt de
navigatie zich exact zoals hiervoor -- het NWB voor Nederland, het
demonstratieraster daarbuiten -- en `test/navigatiegebiednet.test.js` toets 3 is
die grendel. Twee dingen die daaruit volgen en die gemeten zijn in plaats van
bedacht:

- **Het eigen pakket gaat voor.** Ligt er een OSM-pakket over Nederland naast
  het NWB, dan wint het NWB: RTG bouwt dat zelf uit een CC0-bron en verst het
  dagelijks. (Toets 8.)
- **Een niet-gebouwd gebied over Nederland mag het NWB niet blokkeren.** Die
  regel leek dubbelop; de mutatiemotor liet hem weghalen zonder dat er iets
  zakte, en het gevolg was dat een punt in Amsterdam geweigerd werd terwijl het
  net er lag. (Toets 9.)
- **Maar een GEBOUWD pakket gaat voor de weigering.** Wie het OSM-pakket van
  Nederland heeft gebouwd en het NWB niet, kreeg "Geen kaartdata voor
  Nederland" terwijl er een bruikbare kaart klaarlag. Een echte kaart is beter
  dan een nee; alleen als er niets ligt, blijft de weigering staan. Die orde
  staat op twee plekken (`kern/navigatie.js` en `dekking.netVoor()`) en beide
  zijn met een mutatie nagemeten -- twee plekken die hem anders leggen, geven
  twee antwoorden op dezelfde vraag. (Toets 13.)

## 5a. De vermelding staat op het SCHERM en niet alleen in een poort

ODbL eist naamsvermelding en `mag()` weigert een pakket zonder -- maar een
vermelding die niemand ziet, is geen vermelding. Bij een geladen gebied reist
zij daarom mee in `dekking` van `/api/nav/status`, op dezelfde plek waar
Nederland zijn bron en licentie zet, en `apps/navigatie.html` zet haar in de
bronregel. De badge kent daarvoor twee standen extra (`gebied` en
`gebied-geen`): met een gebouwd OSM-pakket onder de voeten stond er eerst
"Demonstratienet" terwijl er op een echte kaart werd gerekend, en dat is precies
waar de kop van `haalStatus()` voor waarschuwt -- een badge die niet is
bijgewerkt is geen lege badge, hij liegt.

## 6. "Hier is geen gebied" is niet "hier is geen motor"

Het duurste defect van deze ronde: een gebied dat AANGEBODEN was maar niet
gebouwd, viel door naar het demonstratieraster. Een lid in Parijs kreeg dan een
route van 1583 km met een echte reistijd eronder -- de gevaarlijkste vorm van
fout, want hij ziet compleet uit. Een aangeboden gebied zonder pakket levert nu
een gebied ZONDER net plus de reden, en alle **vier** de antwoorden weigeren met
diezelfde reden: kaart, bestemmingen, poi en route. Vier antwoorden op een
ontbrekende bron zijn vier waarheden; die les stond al in toets 13 van
`test/navigatie.test.js` en gold buiten Nederland net zo goed.

## 7. Wat er staat, en wat er niet staat

**Staat**

- de catalogus, de licentiepoort en de gebiedskeuze (`kern/navigatie/gebieden.js`,
  `gebiedkeuze.js`, `pakket.js`, `gebiedsindex.js`);
- de routemotor per gebied (`gebiednet.js` -- was `nederland.js`, en de naam was
  de tweede waarheid zelf) met de registratie eromheen (`gebiednetten.js`), waar
  een mislukte poging wordt onthouden MET zijn reden en pas opnieuw wordt
  beproefd als de pakketmap verandert;
- drie afsplitsingen die niets met gebieden te maken hebben en de router onder de
  10 kB-grens houden: `hoop.js` (de prioriteitshoop van de A*), `geografie.js`
  (middelpunt, grenzen en de POI-lagen die het stadsweefsel meeleest) en
  `plekken.js` (de koppeling van de eigen bronnen als bestemming);
- het importscript voor de index (`npm run navigatie:index`), met de vertaling,
  de botsingsregel en de weigeringen die nooit stil zijn;
- de keuze van het lid (`kern/navigatie/mijnkaarten.js`,
  `/api/nav/gebieden`, `/api/nav/gebied/kies`, `/api/nav/gebied/weg`) en het
  paneel "Kaarten" in `apps/navigatie.html`.

**Staat niet, met de reden**

- **De bouwer voor een OSM-gebied** (`scripts/navigatie-osm.js`). Een `.osm.pbf`
  lezen vraagt protobuf en zlib zonder externe module -- dat kan, maar het is
  hier niet te BEWIJZEN: de uitgaande proxy van de bouwomgeving weigert
  `download.geofabrik.de` en `planet.openstreetmap.org` met een 403 op de
  CONNECT. Tot die bouwer er is, is elk gebied buiten Nederland `aangeboden` en
  niet `gebouwd`, en dat staat zo op het scherm.
- **Het ophalen van de index** is om dezelfde reden onbeproefd. Het ONTLEDEN is
  wel beproefd, op een vaste GeoJSON in de gedocumenteerde vorm van Geofabriks
  `index-v1.json` (`test/navigatie-index-fixture.js`). Dat de echte bron er zo
  uitziet is daarmee graad `vermoed` en niet `gemeten`; klopt een veld niet, dan
  hoort de fixture bijgewerkt te worden en niet de bewering.
- **Het pakket op het TOESTEL** (stap 2). Vandaag leest RTG de kaart zelf; echt
  offline navigeren vraagt de graaf in de browser. Elk antwoord van de
  keuzelaag draagt daarom `opToestel: false` MET de reden -- geen leeg veld,
  want een leeg veld wordt door de lezer met zijn eigen aanname gevuld. De
  keuze die een lid nu maakt, is de lijst die het toestel dan ophaalt.
- **Het formaat van een pakket** staat niet in de index; dat vergt een HEAD per
  gebied. `bronBytes` is daarom `null` en niet `0` -- een nul zou op het scherm
  van een lid "gratis" betekenen.

## 8. De grens die deze laag zelf trekt

Welke landen iemand op zijn telefoon zet, zegt iets over waar hij komt. De
keuze hangt daarom aan de **sessiesleutel** en nooit aan de kluis (CLAUDE.md,
privacy by design), en de kantoorkant telt alleen AANTALLEN per gebied -- nooit
wie. Er komt ook geen plafond op het aantal kaarten: de pakketten zijn gedeeld,
dus een maximum zou een verzonnen grens zijn. Op het toestel is de grens de
opslag van dat toestel, en die kent RTG niet.
