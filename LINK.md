# LINK.md -- RTG Link

Het diepte-document voor de adres- en capabilitylaag. `PLATFORM.md` zegt wanneer
iets een eigen wereld is, `LIFE.md` zegt wat het leven tussen mensen mag worden,
`LAT.md` zegt hoe er geschreven wordt. Dit zegt wat een RTG-code is -- en,
zwaarder wegend, wat hij nooit mag worden.

Besluit van de eigenaar, 19 augustus 2026.

---

## 0. De kern, in een zin

> De contactpin was een sociale functie. RTG Link is een **laag**: één menselijk
> herkenbaar adres, waarachter het platform per context tijdelijke, begrensde
> bevoegdheden uitgeeft.

En daaruit volgt de regel die het hele ontwerp stuurt:

> **Een code zegt wie of wat, nooit wat er mag.** Wat er mag, wordt op het moment
> van scannen berekend uit wie er scant, waar hij staat en wat hij al mocht.

Wie die twee door elkaar haalt, bouwt een QR die op een muur hangt en geld kan
verplaatsen.

### De drie begrippen, en waarom het er drie zijn

| | Vraag | Levensduur | Draagt |
|---|---|---|---|
| **RTG iD** | wie ben jij? | permanent | identiteit, in de kluis (`server/accounts.js`) |
| **RTG PIN** | hoe bereik of koppel ik jou? | blijvend, vernieuwbaar, uit te zetten | een adres, meer niet |
| **RTG Capability** | wat mag er nu, één keer, precies hier? | seconden tot minuten | handeling + bron + reikwijdte + vervaltijd |

De PIN is nooit zelf autorisatie. Hij opent alleen de deur naar een context waar
de bevoegdheid pas wordt uitgerekend.

**Het woord "pin" is voor mensen.** Een tafel heeft geen pin, een pakket heeft
geen pin. Die hebben een *adres*. Wie een tafelcode een pin gaat noemen, krijgt
binnen een half jaar iemand die hem ook zo behandelt.

---

## 1. Dit is geen groen veld, en dat is het belangrijkste feit hier

Zes van de mechanismen die deze visie vraagt, draaien hier al getoetst. Ze staan
alleen los van elkaar, en niemand bindt ze samen.

| Wat de visie vraagt | Wat er staat | Waar |
|---|---|---|
| één ondertekende, verlopende code | `RTG1.<body>.<hmac>`, HMAC-SHA256, sleutel alleen op de node, TTL 45 s (max 5 min) | `server/kern/dyncode.js` |
| één camera, één overlay, geen extern pakket | `RTGScanner` + het volscherm-scanblad, met terugval op met de hand typen | `public/shared/scanner.js`, `scanknop.js` |
| één parser voor gescande tekst | `rtg:tafel:` / `rtg:kas:` / `rtg:entree:` / `rtg:pin:` / `RTG1.` | `public/shared/rtgcode.js` |
| één verifieerdeur | `POST /api/code/scan` -- controleert handtekening en verval | `server/routes/code.js` |
| een persoonsadres met remmen en een levende variant | contactpin, huisbrede misserrem, QR van 60 s, eenmalig | `server/kern/sociaal/pin*.js` |
| rechten per band, tweezijdig bevestigd, intrekbaar | levensband: delen per stuk, met vervaldatum | `server/kern/levensband/` |
| smalle sleutel met intrekken, zonder geschiedenis te wissen | toestelkoppeling | `server/kern/toestellen.js` |
| in- en uitgaand verkeer naleesbaar | het doorgeefjournaal | `server/kern/doorgeefjournaal.js` |

Wat **niet** bestaat -- en dat is precies de sprong:

1. **Een typeregister.** `/api/code/scan` weet dat iets een `kas` of een `tafel`
   is; er is geen laag die zegt: dit is een PERSOON, dit is een PLAATS, dit is
   een ZAAK, dit is een CAPABILITY.
2. **Een resolver naar intenties.** Na de scan doet elke app zijn eigen ding
   (`app-main-56.js`, `geld/rtgcode.js`, `leverancier-76.js`). Niemand vertaalt
   *gescande code + wie ik ben + waar ik sta* naar *wat kan er nu*.
3. **Capabilities.** Een dyncode draagt een verwijzing, geen handeling. Er is
   geen code die zegt "ontvang €18,50 voor diner, één keer, twee minuten".
4. **Het bedoelingsscherm.** Wie / wat / waarom / hoe lang / welke gegevens,
   vóór de bevestiging.
5. **De bon en het intrekken.** Er is geen "dit is er gebeurd" en geen
   "ongedaan maken" over al deze handelingen heen.

---

## 2. De weg, en er is er maar één

    SCAN of TIK
      -> DECODE        (welk transport dan ook)
      -> VERIFIEER     (handtekening, verval, eenmaligheid)
      -> TYPE          (persoon | zaak | plaats | object | zaakdossier | capability | ...)
      -> CONTEXT       (wie scant, welke rol, welke plek, welke app)
      -> BEVOEGDHEID   (wat mag DEZE scanner hier vragen)
      -> BEDOELING     (wie, wat, waarom, hoe lang, welke gegevens)
      -> MENS BEVESTIGT
      -> UITVOEREN
      -> BON

Geen enkel domein bouwt hier omheen. Wie een nieuwe soort code toevoegt, voegt
een type toe aan het register en intenties aan de resolver -- geen tweede
scanner, geen tweede parser, geen tweede rem.

**De mens bevestigt.** Dit is de LIFE.md-regel (samenstellen en klaarzetten,
bevestigen doet de mens) en hij staat hier al in code: `pin-deur.js` zoekt eerst
op, en pas een tweede handeling verbindt. Een gescande QR die meteen iets doet,
is een handeling die niemand bewust deed.

---

## 3. De grenzen

Waar een functie hiermee botst, vervalt de functie.

### 3.1 De intentielijst is het nieuwe lek

Dit is de gevaarlijkste regel van dit document, omdat hij tegen het leukste
onderdeel van het idee in gaat.

"Bij de schoolbalie geen bankinformatie, in RTG Geld geen schooldossier" klinkt
als veiligheid, maar als de lijst uit de EIGENSCHAPPEN VAN DE GESCANDE MENS komt,
is de lijst zelf een profieluitdraai. Een grijs "zorgdossier delen" vertelt de
scanner dat er een zorgdossier is. Een ontbrekende regel "kind koppelen" vertelt
dat er geen kind is.

> **De lijst toont wat DEZE scanner in DEZE context mag VRAGEN, nooit wat de
> ander HEEFT.** Twee mensen die dezelfde vreemde scannen op dezelfde plek, zien
> dezelfde lijst. Het antwoord komt pas van de ander.

Dit is `pin-deur.js` op platformschaal: daar geven vier uitkomsten met opzet
hetzelfde antwoord, omdat het verschil tussen "bestaat niet" en "is een kind"
precies het gaatje is. Hier geldt hetzelfde voor het verschil tussen "mag niet"
en "heeft niet".

### 3.2 Een scan is geen bewijs van een mens

Een scan start een proces. Hij bewijst niemand.

> Geld eruit, een sleutel, een dossier, een machtiging of een identiteitsclaim
> vraagt **altijd** een bevestiging op het eigen toestel van de eigenaar. De code
> mag die stap versnellen, nooit vervangen.

Het hotelvoorbeeld is de juiste vorm: de scan vindt de reservering, de gast
bevestigt op zijn eigen telefoon.

### 3.3 Een sticker is geen bron van gezag

Plaats- en objectcodes hangen aan een muur. Iedereen kan ze fotograferen, en
iedereen kan er een eigen sticker overheen plakken -- dat is geen theorie, dat is
het meest voorkomende QR-misbruik dat er is.

- Een plaats- of objectcode mag **nooit** een handeling starten waarbij geld het
  huis verlaat of een dossier opengaat.
- Het bedoelingsscherm toont de naam van de eigenaar **uit ons register**, niet
  uit de code. Wie de sticker vervangt, ziet zijn eigen naam niet verschijnen.
- Betalen aan een zaak loopt zoals nu: de zaak toont een verse, ondertekende
  code, de klant scant. Niet andersom.

### 3.4 Vast adres of tijdelijke bevoegdheid -- de scheiding is architectuur

| Mag een vast adres zijn | Moet tijdelijk zijn |
|---|---|
| persoon (PIN), zaak, plaats, object, apparaat | betalen, ontvangen, delen, overdragen, machtigen, koppelen, toegang geven |

**En de regel die daaruit volgt: een capability is de handdruk, niet de
toegang.** Wie een handeling bedenkt die BLIJVENDE toegang uitdeelt, bouwt een
sleutel die in een oude foto van een QR blijft zitten. Wat er na de handdruk
overblijft — een boeking, een band, een gedeelde reis — hoort in de laag te
staan waar die dingen wonen, met hun eigen intrekknop. De code sterft.

De toets: *kan iemand met een foto van deze code over een jaar nog iets in gang
zetten?* Zo ja, dan hoort hij niet vast te zijn. `pin-live.js` is hier de
bestaande vorm van: de code draagt de pin niet, leeft 60 seconden, is eenmalig,
en de verwijzing staat in het geheugen omdat hij een herstart niet hoort te
overleven.

### 3.5 Een capability draagt nooit een echte naam

Privacy by design uit `CLAUDE.md`: operationele data draait op codenamen. Een
bedoelingsregel als "Rahul wil €18,50 ontvangen" wordt op het scherm samengesteld
uit de codenaam die de scanner al mag zien -- de naam zit niet in de code, niet in
het token en niet in de bon.

### 3.6 Intrekken wist geen geschiedenis

Ongedaan maken is de norm: gedeelde reis, gegeven machtiging, gekoppeld apparaat,
verleend contact -- alles gaat weer dicht, en meteen. Maar dat sluit de toegang;
het wist niet dat het gebeurd is. Dezelfde afspraak als bij `toestellen.js`. Een
bon die kan verdwijnen is geen bon.

### 3.7 Eén deur, één rem

`pin-deur.js` heeft een huisbreed budget aan MISSERS per minuut, gedeeld door
elke ingang, omdat een teller per aanvrager niets doet tegen iemand met twintig
gratis accounts. Die rem hoort bij de LAAG, niet bij de contactpin.

> Elke nieuwe ingang die een code oplost, gebruikt dezelfde rem. Wie er een eigen
> teller naast zet, heeft de rem uitgezet zonder het op te schrijven.

De bekende beperking blijft: hij woont in het geheugen en telt per proces (zie
`server/pinslot.js`), en hoort bij de stap naar gedeelde opslag.

### 3.8 Nabijheid is een signaal, geen bewijs

"Beide toestellen waren in dezelfde flow" mag meewegen bij een overdracht. Het
mag nooit als plaatsbepaling of als identiteit worden gepresenteerd, en er wordt
geen locatiegeschiedenis van bewaard. `LIFE.md`: er komt geen score op het leven
tussen mensen -- en dus ook geen stille kaart van waar iemand was.

### 3.9 Geen trechter

De actiekaart toont wat er kan, niet wat het platform wil. Geen "je hebt Sophie
al 3 weken niet betaald", geen suggesties op basis van hoe vaak twee mensen
scannen, geen ranglijst van koppelingen.

---

## 4. De bouwvolgorde

Klein en omkeerbaar, en elke stap laat de bestaande wegen werken. Niets van wat
er nu draait wordt gesloopt; de nieuwe laag komt eronder te liggen en de oude
paden verhuizen er per stuk naartoe.

1. **Register + resolver + bon.** ✅ *gebouwd op 20 augustus 2026.*
   `server/kern/link/`: het typeregister (`register.js`), de gedeelde deurrem
   (`rem.js`), de intentiecatalogus (`intenties.js`), de bonnen (`bonnen.js`),
   wie er scant (`wie.js`) en `los()` die ze samenbrengt (`index.js`). De deur
   is `POST /api/link/los` en `POST /api/link/bonnen` (`server/routes/link.js`);
   `/api/code/scan` en alle pinloketten blijven werken.

   Wat er in dezelfde ronde uit de contactpin is verhuisd: de huisbrede rem staat
   niet meer in `kern/sociaal/pin-deur.js` maar in `kern/link/rem.js`, en de twee
   deuren delen hem — inclusief de dertig-pogingen-per-uur per lid, die anders
   langs het nieuwe loket te omzeilen was. `test/link.test.js` legt de twee deuren
   naast elkaar en zakt zodra ze uit elkaar lopen.

   Nog niet: de gezinskant (die draait op een profieltoken en niet op de
   Bearer-sessie waar deze deur op staat) en de intenties voor `pas`, `zegel` en
   `deur` — die codesoorten worden herkend en zeggen eerlijk dat deze laag er nog
   niets mee doet.
2. **Capabilities.** ✅ *gebouwd op 20 augustus 2026.* `kern/link/cap.js` (de
   machinerie) en `kern/link/handelingen.js` (het register). Een capability
   draagt een gebonden opdracht: handeling, bron, vervaltijd, eenmalig. De deur
   is `POST /api/link/cap/maak`, `/aanvaard` en `/trek`; kijken gaat via het
   bestaande `/api/link/los`, dat een capability als eigen type herkent.

   Drie dingen die de vorm bepalen. **De code draagt de inhoud niet** — hij
   draagt een verse verwijzing, net als de levende contactcode, zodat een foto
   van de QR niet leest hoeveel er gevraagd wordt. **Het domein schrijft zijn
   eigen handeling** (beschrijving én uitvoering), want de linklaag weet niet
   wat geld is. **De code gaat pas op als de handeling gelukt is**, anders is
   een betaling met te weinig saldo een vraag die niemand meer kan beantwoorden.

   De eerste handeling is `geld.ontvangen` in `kern/pay/vraagcode.js`: "betaal
   mij 18,50 voor diner", twee minuten geldig, eenmalig, en langs dezelfde
   KYC-poort als `/api/pay/stuur` — een tweede deur naar hetzelfde geld zonder
   die poort zou een omweg om die poort heen zijn.

   **De kascode is verhuisd** (`kern/pay/kassacode.js`, dezelfde dag). Hij was in
   alles al een capability — gebonden, begrensd, eenmalig, kort houdbaar —
   behalve in naam. Wat veranderde is de **drager**: in de QR stond de code zelf
   (`A1B2C3`), dus wie het scherm fotografeerde kon hem overtypen aan een andere
   RTG-kassa; nu staat er een ondertekende verwijzing in en ziet de kassa eerst
   een kaart (wie betaalt, tot welk bedrag). Het innen blijft `kasInt`: er is
   geen tweede plek waar een kassacode wordt verzilverd.

   Dit is de eerste capability die een **zaak** aanvaardt, en dat raakte drie
   dingen die het eens moeten zijn: de rol in het register, de weg in
   `intenties.js`, en een eigen loket achter `supplierAuth`
   (`/api/supplier/link/cap/aanvaard`) — een kassa heeft geen ledensessie. Twee
   dingen die daarbij zijn bijgekomen: een capability kan nu **invoer van de
   aanvaarder** aannemen (het bedrag, binnen het maximum dat het lid afgaf), en
   een handeling kan zeggen of datgene waar de code aan hangt **nog leeft** —
   RTG Pay houdt per lid één code actief, dus een verse verdringt de vorige, en
   dat hoort de kassa te weten vóórdat hij een bedrag intikt.

   Wat de verhuizing **niet** deed, en dat hoort er eerlijk bij: de code van zes
   tekens staat nog gewoon op het scherm (voor een kassa zonder camera lees je
   hem voor) en de contactloze afgifte draagt hem ook nog — dat is een handeling
   van dichtbij, geen beeld dat je van een afstand fotografeert. En er is nog
   **geen kassascherm** dat deze weg gebruikt: het loket staat open en is
   getoetst, maar in `public/apps/` bestaat vandaag geen enkele knop die
   `/api/supplier/pay/in` of de nieuwe deur aanroept. Die kant komt met stap 4.
3. **Het bedoelingsscherm.** Eén component, in de huisstijl: wie, wat, waarom,
   hoe lang, welke gegevens, en één bevestigknop.
4. **RTG Scan.** Eén scherm in de leden-app dat op de resolver leunt, met de
   actiekaart. De domeinscanners worden er cliënt van.
5. **Twee echte intenties.** Eén die niets kost (contact of kaartje delen) en
   één die alles vraagt (betalen, met de step-up uit 3.2), zodat de laag meteen
   aan beide uiteinden is beproefd.
6. **Mijn koppelingen.** Bonnenlijst met intrekken per stuk, en per partij het
   antwoord op "waarom had die toegang".

Elke stap krijgt een poort in `test/`, en `LAT.md` regel 2 geldt: een toets die
je niet hebt zien zakken, is geen toets.

---

## 5. De taal

Drie woorden, en niet meer:

- **RTG PIN** -- je vaste, menselijke adres. "Stuur je pin."
- **RTG Link** -- het protocol dat mensen, zaken, plaatsen en objecten verbindt.
  QR is er één drager van; NFC, nabijheid, een deeplink of een overgetypte code
  zijn dezelfde Link.
- **RTG Handshake** -- de wederzijdse bevestiging. Zonder handshake is er niets
  gebeurd.

---

## 6. Wat hier bewust NIET staat

- **Geen universele "scan en het gebeurt".** Elke handeling houdt zijn
  bevestiging. Snelheid komt uit het wegvallen van typen en zoeken, niet uit het
  wegvallen van instemming.
- **Geen tweede rechtenmodel.** Bevoegdheid wordt gehaald waar hij woont
  (levensband, concernrollen, gezinspoort). RTG Link vraagt het na en verzint
  het niet. Dat is dezelfde regel als in `CONCERN.md`: er komt geen derde
  rechtenmodel bij.
- **Geen profiel achter de code.** De code wijst een mens aan; hij vertelt niets
  over hem.
