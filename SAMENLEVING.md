# Magnaat als samenleving — de veertien fasen

> **Magnaat is geen tycoonspel waarin jij een bedrijf bouwt. Het is een levende
> economische samenleving waarin jij een spoor achterlaat.**

Dit document is de wegenkaart. `VERHAAL.md` beschrijft de verhaallaag zoals die
nu gebouwd is; dit beschrijft waar hij heen gaat, en — belangrijker — **wat er
al ligt**. Want dat viel bij het opschrijven gunstiger uit dan verwacht: van de
veertien fasen staan er vier grotendeels, en drie in de steigers.

De regel eronder is niet nieuw en verandert niet:

> Blijvende waarde komt uit **tijd** en uit **wat je deed**, nooit uit geld.
> Kas, ondernemingswaarde, leningen en aandelen blijven in het potje; het
> verleden gaat mee. (`CLAUDE.md`, `VERHAAL.md` paragraaf 1)

---

## De stand, in één tabel

| | fase | staat er | waar |
|---|---|---|---|
| 1 | De eerste baan | **grotendeels** | `magnaat/dienst*.js`, `promotie.js`, `rush*.js`, `loopbaan*.js` |
| 2 | De eerste leider | **de motor wel, de laag niet** | `rush.js` draagt het patroon al |
| 3 | De eerste ondernemer | **de helft** | `loopbaan.js` schrijft; niemand leest hem bij de start |
| 4 | De levende stad | **ja** | `pandgeheugen.js`, `stadsgeheugen.js`, `ondernemerskring.js` |
| 5 | Mensen krijgen een leven | nee | `concurrent.js` is de enige die initiatief neemt |
| 6 | Organisaties krijgen karakter | nee | — |
| 7 | Een echte economie | **half** | `cyclus.js`, `nieuws.js`, `vraag.js` |
| 8 | De eerste crisis | **de haak wel** | `cyclus.js` kent al golven; een schok niet |
| 9 | Concern | **ja** | `magnaat/concern.js`, `bestuur.js`, `CONCERN.md` |
| 10 | Nederland | nee | `kaart.js` kent één stad (`STEDEN`) |
| 11 | Europa | nee | — |
| 12 | De geschiedenis van de wereld | **bijna** | zie de open vraag hieronder |
| 13 | De documentaire | **de onderdelen** | `tijdlijn.js`, `stadskrant.js`, `pandgeheugen.js`, `loopbaan.js` |
| 14 | De levende economie | het gevolg van 1–13 | — |

---

## De ene open vraag die alles eronder raakt

In fase 12 staat één zin die met de grondwet botst:

> *"Ik kocht dit pand terug. Mijn dochter runt het nu."*

`stadsgeheugen.js` beantwoordt de eigendomsvraag ondubbelzinnig, en het staat er
als de regel waar de laag op staat of valt:

> **WIE BEZIT HET? NIEMAND, EN DAT IS DE HELE REGEL.** Een stad is van niemand,
> dus kan hij niemand rijker maken dan een ander. Iedereen die daarna in die stad
> speelt begint met dezelfde kaart — de bouwer net zo goed als iemand die er
> nooit eerder was. Zou het anders zijn, dan is een oude speler structureel in
> het voordeel en is elke eerste campagne een verplichte inhaalronde.

Een pand terugkopen dat je vader ooit had, is **bezit dat over campagnes heen
reist**. Dat is precies wat die regel uitsluit.

**En het goede nieuws:** de rest van fase 12 botst er niet mee. De screenshot
waar het om gaat —

> *"Mijn opa begon hier als afwasser. Mijn vader werd hier bedrijfsleider."*

— is een **record**, geen bezit. Dat mag, dat is de bedoeling, en de machinerie
ervoor staat er al (`loopbaan.js` + `pandgeheugen.js`). Wat niet mag is dat er
een sleutel bij zit.

Drie manieren om ermee om te gaan, en de eerste is de aanbeveling:

1. **De stad onthoudt, het bezit niet.** Je kunt lezen dat je opa er afwaste en
   dat je vader er bedrijfsleider was; je erft geen pand en geen voorsprong. De
   emotionele lading van fase 12 blijft volledig overeind, want die zit in het
   verhaal en niet in de akte.
2. **Bezit reist mee, maar zonder voordeel** — een pand dat je erft moet je tegen
   marktprijs kopen. Kost: de grens wordt een gradatie, en gradaties slijten.
3. **De grens verruimen.** Dan is elke eerste campagne een inhaalronde, en dat is
   de uitkomst die `stadsgeheugen.js` expliciet wilde voorkomen.

---

## Per fase: wat er staat en wat er ontbreekt

### Fase 1 — De eerste baan ✅ grotendeels

*"Iemand geeft jou een kans."*

Staat: solliciteren, aannemen, salaris als overdracht tussen spelers, opzeggen
zonder boete, promotie als gesprek, diensten draaien, en de loopbaan die het
potje overleeft.

En de belofte **"je promotie verandert niet je level maar je wereld"** is sinds
de tweede dienst letterlijk waar: bij dezelfde koelstoring ziet een hulpkracht
één uitweg (*de waar overzetten*) en een vakkracht vier. Er staat geen venster
omheen — er staat morgen een regel op je scherm die er gisteren niet was.

Open: de bijbaan buiten de horeca, en het echte PDA-scherm (`VERHAAL.md`
hoofdstuk 9: de brug is gebouwd, er rijdt nog niets overheen).

### Fase 2 — De eerste leider ⚙ de motor ligt er

*"Management wordt: kiezen welk probleem vandaag mag blijven bestaan."*

Dat is **exact** wat `rush.js` al doet. De motor kent voorvallen met een prijs
voor laten liggen en een prijs voor laten wachten, uitwegen per rol, en een
neutrale lat (*de ploeg werkt op volgorde van binnenkomst*). Een leider is
dezelfde machinerie met andere voorvallen: ruzie, onderbezetting, een
promotieverzoek.

Eén echt verschil, en het is geen detail: **een leider heeft geen avond maar een
maand.** Zes momenten van een dienst zijn zes minuten; zes besluiten van een
bedrijfsleider zijn vier weken. De tijdbasis moet mee, en `opVolgorde()` moet
dan iets anders betekenen — een ploeg zonder sturing werkt op volgorde, een
bedrijf zonder sturing doet wat de AI-manager doet (`beheer.js`). Die lat ligt er
dus ook al, alleen een andere.

### Fase 3 — De eerste ondernemer ⚙ de helft

*"Dit bedrijf is geboren uit mijn geschiedenis."*

`loopbaan.js` bewaart banen en momenten op codenaam, buiten het potje.
`ondernemerskring.js` bewaart wie er in deze stad ooit een zaak had.

**Wat ontbreekt is de leesrichting.** `loopbaan-noteren.js` draait aan het *eind*
van een partij; niets leest de loopbaan bij de *start* van een nieuwe. Daardoor
weet een nieuwe campagne niet dat jij hier ooit afwaste. Dat is één ontbrekende
verbinding, geen nieuwe laag — en het is waarschijnlijk de goedkoopste stap met
de grootste opbrengst van deze hele kaart.

### Fase 4 — De levende stad ✅ ja

*"Iedere steen vertelt iets."*

`pandgeheugen.js` doet precies het voorbeeld uit de opdracht, en het staat er in
die woorden:

```
2027-2031  Bakkerij De Haven      (retail)
2031-2032  leegstand
2032-2038  Rahul Hospitality      (kantoor)
2039-2044  North Sea Logistics    (logistiek)
2044-heden leegstand
```

Met de twee regels erboven: *wat gebeurd is blijft waar* (een periode wordt nooit
herschreven), en *systemen schrijven feiten, Magnaat leest geschiedenis*.
Daarnaast `stadsgeheugen.js` (wat er gebouwd is, slijt in campagnes) en
`ondernemerskring.js` (wie hier ooit begon, achter de 18+-poort want daar staat
een persoon in).

Wat ontbreekt is het **scherm**: de straat waar je op een pand klikt.

### Fase 5 — Mensen krijgen een leven ✗

*"De wereld begint initiatief te nemen."*

Vandaag neemt alleen `concurrent.js` initiatief, en die concurreert — hij wil
niets. Een medewerker met ambities is nieuw.

Twee grenzen die vooraf vastliggen, want deze fase trekt ze allebei aan:

- **Geen verslavende patronen** (`CLAUDE.md`). Een NPC die je blijft vragen is
  een notificatietredmolen. Dezelfde wet als wet 4 van de werklaag: er niet zijn
  mag niets kosten, dus een ambitie die verloopt omdat jij weg was, bestaat niet.
- **Ambitie is geen chantage.** "Geef me promotie of ik vertrek" is een deadline,
  en deadlines zijn kunstmatige urgentie.

### Fase 6 — Organisaties krijgen karakter ✗

*"Havenzicht: bekend om goede opleiding, trouwe medewerkers, weinig verloop."*

Dit is de mooiste fase om **afgeleid** te houden in plaats van in te stellen. Een
bedrijf dat "bekend staat om opleiding" is een bedrijf waar mensen zijn
opgeleid — dat feit staat al in `loopbaan.js` (`opgeleid`). Karakter is dan een
*lezing* van de geschiedenis, geen veld dat je invult. Zodra het een veld wordt,
kun je het kiezen, en dan is het marketing.

### Fase 7 — Een echte economie ⚙ half

`cyclus.js` (de wind over de hele stad), `nieuws.js` (buien per zone of sector,
deterministisch en vooraf aangekondigd) en `vraag.js` (kavelindex, segmenten)
staan er. Wat ontbreekt is de **terugkoppeling**: een fabriek die sluit moet de
koopkracht van een wijk raken. Vandaag beweegt de vraag door de kaart en de
conjunctuur, niet door wat er met de bedrijven gebeurde.

### Fase 8 — De eerste crisis ⚙ de haak ligt er

Een systeemcrisis is `cyclus.js` met een schok en een langere staart. De eis die
er nu al staat en die moet blijven: **deterministisch en vooraf aangekondigd.**
Een crisis die je pas merkt als je omzet zakt is pech, geen mechaniek.

### Fase 9 — Concern ✅ ja

`magnaat/concern.js` rekent al wat het kost om een bedrijf te zijn in plaats van
een zaak; `bestuur.js` en `dienst-rollen.js` kennen coo, cfo en ceo. `CONCERN.md`
beschrijft de echte kant.

De omslag die de opdracht noemt — *van "hoe verdien ik meer" naar "waar zit mijn
grootste risico"* — vraagt een risicobeeld over vestigingen heen. `risico.js`
rekent per vestiging; optellen naar concernniveau is een lezing, geen nieuwe
motor.

### Fase 10 en 11 — Nederland en Europa ✗

`kaart.js` kent vandaag één stad (`STEDEN = { ijmuiden }`) met een `STEDENLIJST`
die erop wacht. De structuur is er; de data en de verbindingen niet.

De vraag die vóór de tweede stad beantwoord moet worden: **reist een mens tussen
steden, of alleen goederen?** Daar hangt aan of `loopbaan.js` een stad kent.

### Fase 12 — De geschiedenis van de wereld ⚙ bijna

Zie de open vraag hierboven. De machinerie staat er; de eigendomsvraag niet.

### Fase 13 — De documentaire ⚙ de onderdelen

`tijdlijn.js` (binnen een partij), `pandgeheugen.js` (de panden),
`loopbaan.js` + `loopbaan-momenten.js` (de mensen, met zinnen in plaats van
cijfers), `stadskrant.js` (de stad van vandaag — en die begint bewust bij een
verbod, want "Daily" is in deze industrie de naam van precies het patroon dat
`CLAUDE.md` uitsluit).

Wat ontbreekt is het samenstel: één scherm dat ze naast elkaar legt. En de eis
die de opdracht zelf stelt — *geen eindscore, geen ranglijst* — is precies waarom
dit een documentaire kan zijn en geen dashboard.

### Fase 14 — De levende economie

*"Ik woon in Magnaat."* Dat is geen fase maar wat er overblijft als 1 tot en met
13 kloppen. De zin die hem draagt staat al in `stadsgeheugen.js`: **de wereld
verandert niet doordat jij weg was; hij verandert doordat er gespeeld is.**

---

## Wat dit document niet is

Geen belofte en geen planning. Elke fase hierboven moet langs dezelfde vijf
vragen die `VERHAAL.md` paragraaf 1 aan alles stelt wat blijft bestaan — waar
komt het vandaan, wie bezit het, hoe verlaat het de wereld, wat bij afwezigheid,
wat als iemand stopt — en langs de meters die er al zijn:
`scripts/magnaat-pomp.js` (komt er geld uit het niets?),
`scripts/magnaat-balans.js` (is elke sector speelbaar?) en
`scripts/magnaat-storing.js` (is elke uitweg ergens de goede?).

Een fase die daar niet langs kan, gaat niet door. Dat is geen rem maar de reden
dat de vorige dertien wél kunnen.
