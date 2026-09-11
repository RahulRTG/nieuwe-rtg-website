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

- **De bouwer voor een OSM-gebied** (nog niet geschreven: de indexschrijver
  bestaat, de bouwer die er een pakket van maakt niet). Een `.osm.pbf`
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
- **Offline ROUTEREN** (de tweede helft van stap 2). De graaf gaat sinds
  `kern/navigatie/toestelpakket.js` wel naar het toestel (par. 11), maar de
  route wordt nog op de server gerekend. Elk antwoord van de keuzelaag draagt
  daarom `opToestel: null` MET de reden -- `null` en niet `false`, want de
  server kan niet weten wat er in de opslag van een browser staat; het scherm
  meet dat.
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

## 9. Wat de eerste browserronde vond, en wat dat over toetsen zegt

De vier servertoetsen van deze laag stonden groen voordat het paneel ooit in een
browser had gestaan. `test/navigatiekaarten.e2e.js` liep daarna voor het eerst,
en toets 4 zakte: **de knop "Kaarten kiezen" was zichtbaar en niet aan te
tikken.** De poort (`#poort`, `inset:0`, z-index 20) dekt het hele scherm, en
`shared/plek.js` zet zijn locatievraag daarboven op z-index 9985 -- want een
vraag die onder een poort verdwijnt, kan niemand beantwoorden. Gemeten op
390x844: de vraagkaart staat op 516-694 en de knop op 514-558, dus 42 van de 44
px zat eronder.

Drie dingen die je hier niet moet wegpoetsen.

**Het defect is ouder dan deze laag.** `#manualStart` ("Kies vertrekpunt") staat
in hetzelfde kaartje en stond op 460-504 -- twee pixels boven de vraagkaart. De
knop erbij duwde de onderste van de twee eronder. Wat de kaartenlaag toevoegde
is dus geen nieuw defect maar de druppel; de poort houdt de band waar de
locatievraag woont nu vrij (`padding-bottom`), en `margin:auto` op het kaartje
laat hem scrollen in plaats van zijn kop kwijtraken zodra het handmatige
vertrekpaneel opengaat.

**Alleen een ECHTE klik ziet dit.** De andere drie toetsen openen het paneel met
`page.evaluate(() => el.click())`, en dat moet ook: de schil verbouwt de kop met
`defer` en dan klik je zestig keer op een cookiebalk (SERVICE.md par. 13). Maar
een DOM-klik gaat dwars door een dekkende laag heen. Toets 4 klikt daarom met de
MUIS, en dat staat er als reden bij -- wie die regel "opruimt" naar een
evaluate-klik, maakt de toets blind voor precies het defect waarvoor hij bestaat.

**Zichtbaar en onbereikbaar is een productdefect** (BETROUWBAARHEID.md par. 6),
ook als elke regel code klopt en elke servertoets groen staat. De belofte is niet
"de route antwoordt 200" maar *ik zie welke kaarten RTG kan leveren en kies zelf
welke ik wil hebben*.

## 10. Een nieuwe route raakt ook MUTATIESEMANTIEK.json

Toetsscherf 2 zakte op `test/mutatiesemantiek.test.js`: de bron had 4394 routes
en het register 4391 -- precies de drie kaartenroutes van deze laag. De
afrondronde draaide wel `scripts/semantiek.js` (botsende NAMEN, `SEMANTIEK.json`)
en niet `scripts/mutatiesemantiek.js` (wat doet een TWEEDE aanroep,
`MUTATIESEMANTIEK.json`). Twee namen die op elkaar lijken en twee verschillende
dingen meten -- de vorm die `SEMANTIEK.json` zélf meet, nu op de gereedschapskist
in plaats van op de code.

Wie een route toevoegt draait dus ook `node scripts/mutatiesemantiek.js
--vastleggen`. De verklaring bij de drie routes blijft daarbij leeg tot iemand
hem geeft: `onverklaard` is een uitslag en geen nul.

## 11. Stap 2, de helft die er echt is: het pakket op het toestel

De graaf van een gebouwd pakket is nu op te halen en op het toestel te bewaren
(`server/kern/navigatie/toestelpakket.js` plus `public/shared/kaartpakket.js`).
Wat dat wel en niet betekent, staat hieronder -- want een download die "offline
navigatie" heet terwijl de helft mist, is de gevaarlijkste vorm van marketing.

**Wat er meegaat**: de acht bestanden van de graaf (`graaf.json`, `coords.f64`,
`offsets.u32`, `doelen.u32`, `kosten.f32`, `lengtes.f32`, `wegen.u32`,
`vlaggen.u8`) -- precies de vorm die `gebiednet.js` leest.

**Wat er niet meegaat, met de reden in het manifest zelf**: de `<code>.sqlite`
ernaast. Daar zitten de plaatsnamen (FTS), de wegnamen en de geometrie in, en
dat is een zoekindex voor een query-engine die een browser niet heeft. Zoeken
blijft dus online, en een route die het toestel zelf zou rekenen kent de vorm
van de weg wel en zijn naam niet. Dat staat als `nietMeegeleverd` in het
antwoord en niet als stilte.

**Vier grenzen die deze laag zichzelf oplegt.**

1. **De lijst is gesloten.** Een lid vraagt om één van acht delen en nooit om
   een bestandsnaam. Wie hier een vrij pad toelaat, opent `RTG_DATA_DIR` -- daar
   liggen ook de sleutels en de database. `pakket.js` weert al een onveilige
   gebiedscode; de lijst weert de tweede helft van dezelfde aanval, en
   `test/navigatietoestelpakket.test.js` toets 5 probeert acht vormen.
2. **De licentie gaat vóór de bytes.** Een pakket op een toestel zetten is
   verspreiden, en dan eist ODbL naamsvermelding. Geen vermelding, geen
   manifest -- en ook geen bytes, want de tweede route vraagt dezelfde poort.
   De vermelding gaat MEE de opslag in, zodat het scherm hem ook offline kan
   noemen: ODbL vraagt hem zolang de gegevens er zijn.
3. **Een half pakket is geen pakket.** Ontbreekt of leeg is één deel, dan
   weigert het hele manifest met de naam erin. En valt er tijdens het ophalen
   een deel af, dan gaat het hele gebied er weer uit -- zeven achtste van een
   graaf is geen kaart.
4. **Een stuk bestand is erger dan geen bestand.** Een afgekapte of omgekiepte
   graaf levert geen foutmelding maar een ROUTE: de motor leest onzin uit de
   typed arrays en rekent er een net uitziende weg mee. Elk deel wordt daarom
   tegen een sha256 uit het manifest gehouden. De browsertoets stuurt met opzet
   48 bytes nul terug voor een deel dat óók 48 bytes is -- zou de laag alleen de
   lengte controleren, dan kwam dat erdoor.

**Drie dingen die een browser anders doet dan een telefoon-app**, en ze staan
alle drie op het scherm in plaats van in een voetnoot:

- **Zonder https is er geen opslag.** `caches` en `crypto.subtle` bestaan alleen
  in een beveiligde context. Op http (behalve localhost) kan het dus niet, en
  dan draagt de knop de reden in plaats van stil niets te doen.
- **De browser mag het weggooien.** We vragen `navigator.storage.persist()`, en
  het antwoord staat in de kop van het paneel: bewaart hij het, mag hij het
  opruimen, of zegt hij het niet? Alle drie zijn echte uitkomsten, en `null` is
  er één van.
- **De server weet niet wat er op uw toestel staat.** Daarom `opToestel: null`
  en niet `false`, en daarom MEET het scherm de opslag bij elke keer openen in
  plaats van een lijst te onthouden. Een onthouden lijst en een lege cache lopen
  binnen een week uit elkaar, en dan belooft het scherm een kaart die er niet is.

Het plaatselijke manifest (`__manifest`, een adres dat de server niet kent en
zou weigeren) is het bewijs dat een download IS afgerond. Het gaat er als
LAATSTE in: zolang het er niet staat, is het een halve download en zegt de laag
dat ook.
