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

**Sinds 20 augustus 2026 telt hij over processen heen.** Hij woonde in het
geheugen en telde per proces, en bij een vloot (`server/vloot.js`) is dat vier
budgetten naast elkaar — precies de fout die deze rem bij de contactpin al had:
tellen op een plek die de aanvaller kan vermenigvuldigen. Hij deelt zijn missers
nu over de realtime-bus (`server/bus.js`), de enige gedeelde leiding die dit huis
heeft. Zonder `REDIS_URL` is die in-proces en verandert er niets; met `REDIS_URL`
telt elk proces ook de missers van de andere.

Drie dingen liggen daarbij vast, en alle drie getoetst: lokaal tellen gebeurt
**altijd**, ook zonder bus of met een stukke bus (een rem die uitvalt als een
leiding hapert, is weg precies wanneer je hem nodig hebt); de eigen echo telt
niet dubbel; en een tweede bus op dezelfde rem wordt geweigerd.

Het blijft bij benadering, en dat mag: dit is een budget over een minuut, geen
harde teller. Een atomaire teller (Redis `INCR`) zou nauwkeuriger zijn en een
tweede verbinding en een tweede faalwijze kosten, voor een precisie die dit
budget niet vraagt. De andere remmen in dit huis (`server/pinslot.js`,
`loginFails`) tellen nog wél per proces; dat blijft de gedeelde-opslag-stap.

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

   Nog niet: de gezinskant, die op een profieltoken draait en niet op de
   Bearer-sessie waar deze deur op staat. (Die kwam er later dezelfde dag bij;
   zie stap 4.)

   **`pas`, `zegel` en `deur` krijgen geen intentie, en dat is een besluit.**
   Hier stond dat de laag er "nog niets mee doet", en dat las als onaf werk. Op
   20 augustus 2026 nagelopen wat ze werkelijk zijn: `deur` wordt door niemand
   uitgegeven en door niemand gelezen. `pas` wordt wel getoond (de portemonnee
   heeft er een levende QR van), maar de enige lezer is een technische
   controleur die "geldig, soort: pas" afdrukt — en wat een zaak écht wil weten
   (geldig lid? achttien?) doet het RTG Zegel, met selectieve claims en zonder
   naam. Een intentie op `pas` zou daar een tweede, zwakkere identiteitscontrole
   naast zetten. En `zegel` als codesoort geeft niemand uit: het echte Zegel is
   een andere tokenfamilie (`server/lib/zegel.js`), met opzet offline te
   controleren tegen de publieke sleutel. Die door deze deur halen plakt er een
   serverreis aan vast, en een parser die tekst zónder voorvoegsel gaat gokken
   is geen parser meer.

   Dat het Zegel een eigen verificatie heeft, maakt hem geen tweede scanner: het
   scherm dat hem leest gebruikt dezelfde huisoverlay (`shared/scanknop.js`).
   Eén leesinstrument, twee tokenfamilies.
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
   van dichtbij, geen beeld dat je van een afstand fotografeert.

   **En hij was maar half af, tot 20 augustus 2026.** Er zijn VIER kassa-ingangen,
   en alleen `/api/supplier/pos/sale` was verhuisd. Uitchecken van een kamer of
   tafel (`/api/supplier/pos/checkout`) en de winkelvloer
   (`/api/supplier/retail/verkoop`) gingen rechtstreeks naar `pay.kasInt` en
   kenden dus alleen de code van zes tekens: wie zijn QR ophield kon bij dezelfde
   kassa aan de ene knop wel afrekenen en aan de andere niet. Dat is geen besluit,
   dat is vergeten.

   Ze lopen nu alle vier langs `kern/pay/kasinnen.js` — één plek die weet welke
   dragers er zijn, in plaats van hetzelfde blok vier keer overgeschreven. En aan
   de klantkant langs `payCodeMetKaart` (`leverancier-61.js`), zodat het
   bedoelingsscherm bij alle vier vóór de bon komt: een belofte die op één van de
   vier plekken geldt, is geen belofte.

   Daarbij ging nog een vierde eigen uitvoering weg. De winkelvloer had zijn eigen
   `window.prompt` met een onvoorwaardelijke `toUpperCase()` — en droeg daarmee de
   fout die elders al gerepareerd was: een ondertekende RTG-code is
   hoofdlettergevoelig, dus kapitalen slopen hem. Hij deed het alleen niet, omdat
   die route nog geen token aannam.
3. **Het bedoelingsscherm.** ✅ *gebouwd op 20 augustus 2026.*
   `public/shared/linkkaart.js` met zijn vormtaal in `shared/rtg-ontwerp.css`
   (`.rtg-bedoeling`), dus onder de poorten van ONTWERP.md. Eén component voor
   alle scanners: wie, wat, waarom, welke gegevens, hoe lang — en dan pas een
   knop.

   Vier keuzes die hem bruikbaar houden. **De app haalt op, het scherm toont**:
   hij doet zelf geen enkel verzoek, want elke app heeft zijn eigen weg naar de
   server. **Hij voert niets uit**: de intentie draagt zijn eigen weg, de app
   roept die aan. **`opbouw()` is puur**, zodat een toets in Node kan nakijken
   dat de vijf vragen echt beantwoord worden en dat er nooit een knop verschijnt
   zonder weg. En **wat de app erbij weet, staat op dezelfde kaart** — bij de
   kassa is dat wat déze bon kost, naast wat de code maximaal toestaat.

   Twee dingen die het bouwen opleverde. De knoptekst was
   "Bekijken en bevestigen · je ziet eerst wat er gebeurt": de juiste tekst
   zolang die belofte nergens werd waargemaakt, en overbodig zodra er een kaart
   boven staat. Nu: "Bevestigen". En het bedrag is ceremonieel (ONTWERP.md par.
   1) maar het **valutateken niet** — Bodoni's euro leest op deze plek als een C,
   op precies het scherm waar iemand moet zien hoeveel er van hem afgaat.

   **De kassa gebruikt hem** (`leverancier-64.js`): scan je een RTG-code bij het
   afrekenen, dan komt eerst de kaart en pas daarna de bon. `/api/supplier/pos/sale`
   neemt sindsdien beide dragers — de getypte code van zes tekens én het token —
   en int ze allebei langs `kern/pay/kassa.js`.
4. **RTG Scan.** ✅ *gebouwd op 20 augustus 2026.* De scanknop van de leden-app
   (`app-main-56.js`) ging langs een keten van als-dans: tafel → menu, kascode →
   een tekstje, entree → een ander tekstje, anders de ruwe tekst. Elke nieuwe
   soort code kwam er als tak bij, en elke app had zijn eigen keten. Nu wordt de
   vraag "wat is dit en wat kan ik ermee" één keer gesteld, aan de laag die het
   weet — daarna de kaart, daarna een mens, daarna pas de handeling.

   Wat een lid vandaag met één knop kan: iemand toevoegen (vaste pin én levende
   code), een tafel openen om te bestellen, en een vraagcode betalen. Die laatste
   is nieuw en volgt gratis uit de laag: `geld.ontvangen` bestond al, en RTG Scan
   is de eerste plek waar een lid hem kan aanvaarden.

   De app houdt een tabel `intentie → wat er dan gebeurt`, want een intentie is
   soms een aanroep en soms een la die opengaat. Die tabel en de catalogus van de
   server gaan over dezelfde lijst; `test/link.test.js` zakt zodra er een intentie
   bijkomt die het scherm niet kent — anders staat er een knop die "dit kan hier
   nog niet" zegt.

   **Wat hier bewust NIET is meegegaan:** de scanner op het vriendenscherm van de
   leden-app (`app-main-09a.js`). Die is gespecialiseerd — hij toont je eigen pin,
   je QR, je live code en de treffer in één blok — en leunt onderhuids al op
   dezelfde laag (dezelfde rem, hetzelfde `pinKijk`). Een tweede weg naar
   hetzelfde antwoord is dat niet; een tweede *uitvoering* zou het wel zijn.

   Eén ding stond daar wél nog open, en het is dezelfde soort kopie die aan de
   gezinskant is opgeruimd: het camerablad van dat scherm was een eigen
   `RTGScanner` in plaats van de huisoverlay. **Op 20 augustus 2026 is dat de
   laatste geworden die weg is.** Het was er geen doodlopende weg — de scanknop
   van de app zelf droeg de handinvoer wél — maar het was één leesinstrument te
   veel, en zonder werkende camera kwam je op dít scherm nergens.

   De vorm van het scherm blijft: je eigen pin, je QR, je live code en de treffer
   in één blok. Wat eraf ging is de `<video>` en de aan/uit-knop; wat erbij kwam
   is de handinvoer en de uitleg waarom de camera niet start. Eén ding is er
   bewust bij bedacht: een gescande code die géén RTG-pin is, houdt de overlay
   nu OPEN. Eerst viel het venster dicht op een verkeerde QR en moest een mens
   opnieuw beginnen (`test/contactpin.e2e.js`).

   **De gezinskant kwam er op 20 augustus 2026 bij** (`routes/social/gezinnen/link.js`).
   Een eigen deur, want een gezinslid heeft een andere geloofsbrief: een
   gezinscode met een profieltoken in het lijf, niet de Bearer-sessie waar
   `routes/link.js` op staat. Daarmee mochten de `gezin:`-wegen terug in
   `intenties.js` — ze stonden er niet, omdat een regel voor een scanner die de
   deur niet kan bereiken een belofte zonder weg is.

   Drie dingen die daarbij hoorden. **Voor een kind van 15 of jonger staat ook
   deze deur dicht**, met exact dezelfde zin als bij elk pinloket: scannen hoort
   daar geen uitzondering op te zijn, anders leest een kind twee verhalen over
   hetzelfde. **Capabilities gingen niet mee** — een gezinsprofiel heeft geen
   portemonnee, dus geen enkele handeling noemt `gezin` als aanvaarder; de kaart
   is er wel, de knop niet. En **de weg terug volgt de wereld van de scanner**:
   "verzoek intrekken" wees naar `/api/member/connect/intrek`, en dat is een deur
   die een gezinslid niet opent — `/api/rtf/social/connect/intrek` bestaat sinds
   deze stap.

   Twee gaten die het bouwen zichtbaar maakte: de gezinskant **schreef geen bon**
   bij het verbinden (dus "mijn koppelingen" vertelde daar niets over wat je zelf
   deed), en de gezinspoort stond in twee bestanden op het punt een derde kopie te
   worden — hij staat nu één keer in `routes/social/gezinnen.js`.

   **Het gezinsscherm is alsnog in een browser nagelopen** (`test/linkgezin.e2e.js`,
   20 augustus 2026). Hier stond dat dat niet gelukt was; de proefopstelling
   struikelde niet over de gezinssessie maar over twee dingen die niemand had
   opgeschreven. Het scherm wordt door `shared/deelmenu.js` in tabbladen geknipt,
   dus "Toevoegen" staat er pas na een druk — de toets drukt nu, want een toets
   die de tabbalk overslaat meet een scherm dat niemand zo ziet. En de
   leerlingdeur (`/api/rtf/toegang`) staat voor een beheerder gewoon open; die
   draait in deze toets dus echt mee en wordt niet afgeplakt.

   **Wat het naar boven haalde is geen toetsprobleem maar een gat in het scherm:
   RTG Link was daar alleen met een CAMERA te bereiken.** De Scan-knop had een
   eigen camerablad — een `<video>` in de pagina met een `RTGScanner` eromheen —
   en dus geen handinvoer. Wie een levende code of een vraagcode geplakt kreeg,
   kon die er nergens in kwijt: het pinveld eronder snapt alleen een pin.

   De oorzaak was niet dat er een invoerveld ontbrak, maar dat dit scherm een
   TWEEDE UITVOERING had van iets dat het huis al heeft. `shared/scanknop.js`
   bestaat precies hiervoor — "zonder camera valt hij terug op met de hand
   typen/plakken, zodat een scan nooit een doodlopende weg is" — en de leden-app
   gebruikt hem al. De gezinskant gebruikt hem nu ook, en het eigen camerablad is
   weg. Er kwam dus geen veld bij; er ging een kopie af (LAT.md regel 1 en 4).

   Twee dingen komen daar gratis bij. De handinvoer, waarmee een geplakte code
   hier eindelijk naar binnen kan. En de uitleg waarom de camera niet start: de
   overlay leest de mediapoort, en op een gewoon http-adres geeft de browser de
   camera niet vrij — op een telefoon de meest voorkomende reden. Hier stond
   "Geen toegang tot de camera.", en dat laat een mens zelf zoeken.

   Het pinveld blijft een pinveld: typen blijft wat het was.

   Twee dingen zijn daarmee in een echte browser bevestigd: de kaart toont de
   codenaam en niet de echte naam, en kijken kost nog niets — er staat pas een
   verzoek na de druk. En de grens uit deze stap is er ook te zien: een vraagcode
   toont wel de kaart en géén knop, want een gezinsprofiel heeft geen portemonnee.

   De weg is getoetst in een echte browser (`test/linkscan.e2e.js`): scannen met
   de handinvoer van de scanoverlay, de kaart lezen, bevestigen, en dan pas is er
   geld bewogen of een verzoek verstuurd.

   **En deze stap liet één toets achter die niemand zag zakken.**
   `test/scan-tafel.e2e.js` beschreef de weg van ervóór: scannen, en het menu
   ging open. Sinds de kaart ertussen staat, gebeurt dat niet meer vanzelf — dus
   die toets stond rood vanaf de dag dat stap 4 landde. Hij kwam pas boven bij de
   volle e2e-ronde op 20 augustus 2026 (254 toetsen, dit was de enige zakker), en
   dat is precies waarvoor die ronde er is: een browsertoets die niemand draait,
   bewaakt niets. Hij beproeft nu de nieuwe belofte, en scherper dan daarvoor:
   eerst staat de kaart er en is het menu nog dicht, en pas na de druk gaat het
   open.

   **En de omgekeerde richting kreeg een poort** (`test/link.test.js`, 20 augustus
   2026). De bestaande toetsen liepen van de intentie naar de route: bestaat hij,
   en staat de goede poort ervoor. Terug was ongedekt. `capability.aanvaarden`
   draagt `magVereist`, dus de regel verschijnt alleen als de LAAG zegt dat deze
   scanner deze handeling mag aanvaarden — en dat "mag" komt uit de rollenlijst
   van de handeling zelf. Zet iemand daar een rol bij zonder weg in
   `intenties.js`, dan zegt de laag ja tegen een scanner die nergens naartoe kan:
   kaart wel, knop niet, en niemand ziet waarom. Beide richtingen bijten nu, en
   de toets leest de handelingen uit hun aanmelding in plaats van uit een lijstje
   — zo groeit hij mee met wat er morgen bijkomt.

5. **Twee echte intenties.** ✅ *gehaald onderweg.* Verbinden (kost niets) en
   betalen (vraagt alles) lopen allebei over de laag, aan beide uiteinden
   getoetst — inclusief de poorten van RTG Pay, die ook via deze deur gelden.
6. **Mijn koppelingen.** ✅ *gebouwd op 20 augustus 2026.* `kern/link/koppelingen.js`
   en `kern/link/cap-beheer.js`, met het scherm in `shared/linkkoppelingen.js` —
   te openen in de leden-app naast inzage en vergetelheid, want dit gaat niet over
   je adres maar over wat het huis van je bewaart.

   Drie lijsten die drie verschillende vragen beantwoorden: **wat staat er nu
   open** (codes van mij die nog leven, met een eigen id om ze weg te halen),
   **wat is er gebeurd** (de bonnen), en **met wie** (per partij: hoe vaak,
   wanneer, langs welke weg — het antwoord op "waarom had die toegang" is niet
   een lijst rechten maar wat er werkelijk tussen jullie gebeurde).

   **Wat er nog aan te doen is, rekent de server uit** en niet het scherm. Dat is
   een besluit en geen opmaak: een scherm dat zelf gokt welke knop mag, toont
   vroeg of laat een knop die weigert. En bij geld staat er geen knop maar een
   reden — een betaling is geen deur die je dichtdoet.

   **Twee dingen die deze stap boven water haalde.** Een openstaande capability
   heeft nu naast zijn verwijzing (die verzilvert) een eigen **beheer-id** (dat
   alleen intrekt): een beheerscherm hoort geen tweede manier te zijn om aan een
   werkende code te komen. En een verstuurd vriendschapsverzoek had helemaal geen
   weg terug — `/api/member/connect/intrek` bestaat sinds deze stap, want "wat kan
   ik hier nog aan doen" was daar "niets", niet als besluit maar omdat er nooit
   een deur voor was gebouwd.

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

---

## 7. Wat er nu nog open staat

Bijgewerkt op 20 augustus 2026, na de ronde die de acht punten hierboven
afwerkte. Wat hier staat is nagelopen in de code, niet uit het hoofd.

- **Vier remmen tellen nog per proces.** Die van RTG Link niet meer (par. 3.7),
  maar `server/pinslot.js` en `loginFails` wel. Bij één proces is er niets aan de
  hand; bij een vloot zijn het net zoveel budgetten als processen. De weg is
  dezelfde als hier gelopen: de realtime-bus, of een echte gedeelde teller.
- **Drie voorraden, alle drie op de ratel.** 1192 endpoints zonder toets, 155
  toetsen waar de mutatiemotor nog niet langs is, en 92 beweringen die op een
  lege verzameling vanzelf slagen. Ze mogen niet groeien (`NORM.json`), maar ze
  zijn niet afgebouwd. Van die laatste staan er **twaalf op HOOG** — de vorm "na
  het weghalen is hij weg" of "de buurman ziet niets", de twee die echt een fout
  kunnen verbergen. Die zijn niet nagelopen.
- **De ratel staat op zes meters rood**, en dat komt van vóór deze ronde:
  `keuringOmvang`, `kernBreedte`, `kernGedeeld`, `inlineStijlAttributen`,
  `toetsenNietGemeten` en `toetsenOngevoeligPct` staan boven hun norm omdat
  `npm run norm:vast` een aantal commits niet is gedraaid. De ratel doet precies
  wat hij moet doen; er heeft alleen niemand naar gekeken. Herstellen of de norm
  met reden verlagen is een besluit van de eigenaar, geen opruimklus onderweg.
- **De volle e2e-ronde was nooit gedraaid.** Op 20 augustus 2026 wel: 254
  toetsen, 253 groen, één zakker — en die zakker stond rood vanaf de dag dat
  RTG Scan landde, omdat hij het gedrag van ervóór beschreef. Dat is de les, niet
  de toets: een browsertoets die niemand draait, bewaakt niets. De ronde duurt
  bijna een uur en hoort daarom bij een vaste kadans, niet bij goede bedoelingen.
- **Het Zegel deelt de scanner maar niet de laag.** Dat is met opzet (par. 4,
  stap 1) en geen open punt — maar het betekent wel dat "één scanner" vandaag
  twee verificatiewegen achter zich heeft: de linkdeur voor RTG-codes, en de
  offline sleutelcontrole voor een Zegel.
