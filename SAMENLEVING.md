# SAMENLEVING.md — één infrastructuur voor elke plek in de samenleving

*Richtingsdocument en grondwet, 27 september 2026. Zoals PLATFORM.md,
ECONOMIE.md en HDI.md staat bij elk onderdeel of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is. De bodem voor de gratis trede is
inmiddels GEMETEN (`npm run onvervreemdbaar`, `ONVERVREEMDBAAR.json`, par. 11);
de rest van wat hier als stand staat is gelezen in de code en draagt de graad
`vermoed`.*

---

## 0. De kern, in een zin

> **Een zwerver en een magnaat moeten allebei altijd kunnen leren, zich
> ontwikkelen en rust vinden — en wat ze daarnaast van RTG krijgen, verschilt
> in wie betaalt, wie uitvoert en hoeveel bescherming nodig is. Het verschilt
> nooit in wie ze als mens zijn.**

RTG bedient de samenleving dus niet met een product per groep. Er is één
infrastructuur. Daarboven liggen verschillende routes voor betalen, uitvoeren,
beschermen en deelnemen, en daaronder een bodem die voor niemand verdwijnt.

## 1. Een correctie op de eerste versie van deze gedachte

De eerste uitwerking (in het gesprek dat aan dit document voorafging) zette de
lagen van de samenleving in een tabel van Lifestyle tot kwetsbaar, en sprak over
"de onderste twee lagen". Die tabel klopt als beschrijving van de betaalroutes,
maar als model van de mens is hij fout, om drie redenen:

1. **Een positie is een toestand, geen eigenschap.** Iemand kan vandaag dakloos
   zijn en over vijf jaar ondernemer. Een miljonair kan morgen failliet gaan. Een
   zzp'er kan een half jaar steun nodig hebben. Een gepensioneerde kan financieel
   comfortabel zijn en digitaal nauwelijks meekomen. Een model dat mensen in een
   laag zet, houdt ze daar vast.
2. **De pas is een commercieel feit, geen maatschappelijk feit.** Wie
   RTG Community gebruikt is niet daardoor kwetsbaar, en een lid met Lifestyle
   Pass is daardoor niet veilig. Een Lifestyle-lid kan thuis in een onveilige
   situatie zitten, en juist dan mag zijn huishouden niet meelezen.
3. **Een laag is een score.** "Onderste laag" is een rangorde op mensen, en die
   botst met de scherpste grens die dit huis heeft (HDI.md par. 5.4,
   KANTOORMACHT.md, CARRIERE.md CAR-05): de meeteenheid is nooit de mens.

Daarom modelleert RTG intern niet

> mens → maatschappelijke klasse → product

maar

> **mens → huidige behoefte → passende mogelijkheid**

en er bestaat nergens een centrale maatschappelijke score. Dat is geen nieuwe
regel. Het is de regel van HDI.md par. 5.1, **de mens bestaat nergens als rij**,
toegepast op de hele samenleving in plaats van alleen op de kwetsbare kant.

De vorm bestaat al in code: `kern/knelpunt/` geeft `vondsten(voorwaarde)` een
randvoorwaarde en verder niets. Een geschiktheidstoets kan daar structureel
niet, en is dus niet alleen verboden (MAATSTAF.md par. 7g). Precies zo hoort elke
route van behoefte naar mogelijkheid te zijn: de behoefte gaat erin, de mens
niet.

## 2. De universele bodem

Boven de hele ladder ligt één laag die niet van een abonnement, vermogen,
werkgever, woonadres of maatschappelijke positie afhangt. Zeven dingen mogen
voor niemand volledig verdwijnen:

> **leren → ontwikkelen → oriënteren → verbinden → rust → hulp kunnen vinden →
> opnieuw kunnen beginnen**

Daarmee is RTG Community (€ 0) niet het goedkoopste abonnement maar **de
maatschappelijke bodem van RTG**. Het onderscheid doet ertoe. Een dakloze hoeft
niet dezelfde boekhoudsoftware te krijgen als een ondernemer, en een miljonair
hoeft geen gesubsidieerde ondersteuning te krijgen. Maar allebei moeten ze een
leerpad kunnen openen en iets kunnen leren.

De bodem is een **ondergrens aan mogelijkheden**, geen maximum. Een betaalde pas
mag er meer bovenop zetten, zoals uitvoering, schaal of een mens die het voor je
doet. Hij mag er niets onder weghalen.

| werkwoord | wat er in de code op lijkt | stand (`vermoed`) |
|---|---|---|
| **leren** | `kern/leerstof.js` (200 gratis leerpaden), School, het leerdossier (CONNECT.md) | staat; bereikbaarheid voor de gratis trede ongemeten |
| **ontwikkelen** | het leerdossier als ledger en niet als niveau, Métier, de aanvoer van werk en opleiding in `kern/knelpunt/aanvoer*.js` | staat in delen |
| **oriënteren** | Ontdekken (`/apps/connect.html`), de hulpwijzer, de knelpuntmotor | staat |
| **verbinden** | Buurtruil (`kern/rtfos/ruil.js`, op een gewone ledensessie en zonder geld), De Salon, de kring | staat; De Salon is ongemeten voor de gratis trede |
| **rust** | `kern/veiligheid/rust.js` (vijf standen, de kring komt er altijd door, elke stand eindigt vanzelf), met een eigen functie `rust` voor elke doelgroep met account | staat; RTG Veilig staat sinds 29 september in LivingOS (par. 6) |
| **hulp kunnen vinden** | de HDI-voordeur zonder account, BSN of adres; `kern/service/mens.js` (een mens bij een probleem is een ondergrens voor elk account) | staat |
| **opnieuw kunnen beginnen** | niets dat het zo noemt | **een stap weg**: zie hieronder |

**Opnieuw beginnen is het werkwoord zonder eigenaar.** Er zijn onderdelen die
erbij horen: een account dat je terugkrijgt, een verleden dat je kunt
meenemen (bewijsmap, leerdossier), een verleden dat je kunt achterlaten (de
vergetelheidsbezem, bewaartermijnen) en een schuld die niet voor altijd op je
scherm staat. Maar geen enkele module heeft als opdracht dat iemand na een
breuk opnieuw kan instappen zonder dat de breuk hem blijft volgen. Wie dat
bouwt, bouwt het als PROJECTIE over wat er al staat (HDI.md par. 5.1), niet als
nieuw dossier.

## 3. Vijf assen in plaats van drie

Wat een mens van RTG krijgt, verschilt langs vijf assen. Elke as is een
eigenschap van de SITUATIE en niet van de persoon, en kan dus morgen anders
zijn.

| # | as | de vraag | voorbeelden van waarden |
|---|---|---|---|
| 1 | **betaler** | wie betaalt dit? | het lid, een werkgever, een gemeente (budget uit WAARDE.md), de RTFoundation, niemand |
| 2 | **uitvoerder** | wie doet het? | de mens zelf, De Rechterhand, een professional naast hem, een gemachtigde |
| 3 | **bescherming** | hoeveel bescherming is nodig? | gewone privacy, een eigen dataklasse voor veiligheid (HDI.md par. 5.2), duress |
| 4 | **deelnamevorm** | hoe kan deze mens meedoen? | volledig digitaal, eenvoudige taal, begeleid, fysiek, anoniem waar verantwoord, via een gemachtigde |
| 5 | **bodem** | wat verdwijnt nooit achter betaling? | de zeven werkwoorden van par. 2 |

**As 4 is de as die het vaakst wordt vergeten**, en die bepaalt of assen 1 tot en
met 3 er voor iemand überhaupt toe doen. Stand per waarde:

| deelnamevorm | stand |
|---|---|
| volledig digitaal | staat |
| meertalig | staat: `public/shared/i18n/` |
| eenvoudige taal | **een stap weg**: er bestaat geen taalniveau naast de taalkeuze |
| begeleid | staat in delen: bijstand (`kern/command/bijstand.js`), de ledenbalie, een mens in Service |
| via een gemachtigde | staat: `kern/vertegenwoordiging/`, maar achter A3 (par. 5) |
| anoniem waar verantwoord | staat aan de HDI-voordeur, nergens anders |
| fysiek | **vraagt een besluit**: RTG heeft geen fysieke plek waar een mens binnen kan lopen |
| met een handicap | gemeten met een browser en nooit met een mens (TOEGANKELIJK.md) |

## 4. Het model, en waar het in code al zo loopt

```
mens ──(deelt alleen wat nodig is)──> huidige behoefte ──> passende mogelijkheid
                                                             │
                     betaler · uitvoerder · bescherming · deelnamevorm
                                                             │
                                          de bodem valt er nooit af
```

Drie eisen, en alle drie bestaan ze al ergens:

- **De behoefte is een randvoorwaarde en geen profiel.** Zie
  `vondsten(voorwaarde)` in `kern/knelpunt/`.
- **Een mogelijkheid is geen recht.** Dat Adam een vacature ziet, zegt niets over
  of hij mag solliciteren. Die vraag blijft bij het domein dat erover gaat
  (MAATSTAF.md par. 7i).
- **Er wordt niets gerangschikt op de mens.** Een motor mag alleen toevoegen, en
  zegt nooit "dit is niets voor jou" (FOUNDATION.md par. 5.3).

## 5. Identiteit bepaalt wat veilig mag, niet of je mens bent

> **De identiteit bepaalt wat iemand veilig mag doen, niet of iemand als mens
> toegang heeft tot RTG of RTF.**

Iemand zonder identiteitsbewijs hoeft niet door dezelfde poort als iemand die
€ 20.000 voor Lifestyle betaalt. Dat betekent niet dat RTG tegen die persoon zegt:
"dan kunnen wij niets voor u betekenen."

Vandaag vragen machtigingen (`kern/vertegenwoordiging/`), de progressielaag en
de datingpoort allemaal A3: RTG heeft het identiteitsbewijs gezien
(`volwassen()` in `server/kern/volwassen.js`). Voor die handelingen is dat terecht.
De fout zou zijn om de A3-poort ook voor de bodem te laten gelden. Daarom:

- **De bodem vraagt geen identiteitsniveau.** Leren, oriënteren, rust en hulp
  vinden werken zonder bewezen identiteit. Verbinden werkt waar het veilig kan.
- **Een handeling vraagt het niveau dat bij haar risico hoort.** Hier staat de
  regel van `kern/identiteit/vertrouwen.js`: een conclusie is nooit harder dan
  haar zachtste premisse.
- **Een weigering zegt hoe het wel kan**, zoals de firewall van ECONOMIE.md dat
  al doet. "U heeft geen document" zonder vervolg is een deur die dichtgaat
  zonder bordje.

## 6. Rust als eigen ontwerpgebied

RTG mag functies hebben die geen omzet, engagement of productiviteit proberen te
maximaliseren. Dat is geen restcategorie maar een ontwerpgebied met eigen regels:

1. **Klaar is een toestand.** Een scherm mag af zijn. De vorm staat al in het
   Ochtendritme van de Foundation ("Helemaal klaar voor vandaag"). Daarna komt
   er niets meer, en zeker geen "misschien vind je dit ook leuk".
2. **Stilte is standaard bereikbaar en eindigt vanzelf.** `kern/veiligheid/rust.js`
   laat de wereld zwijgen terwijl de kring erdoor komt. Het gebrek was dat de
   functie onder Veiligheid hing en niet onder de bodem, en dus alleen te vinden
   was voor wie haar al zocht: Thuisrust is een stand van RTG Veilig, en die app
   stond onder Instellingen. **Besluit van 29 september 2026: heel RTG Veilig
   staat nu in LivingOS**, en in het functieregister heeft rust een eigen functie
   (`rust`, `/api/veiligheid/rust`) voor elke doelgroep met een account, los van
   `dom-veiligheid`. `test/rust-eindigt.test.js` handhaaft de helft "eindigt
   vanzelf": elke stand krijgt een einddatum binnen 24 uur, ook "tot ik thuis
   ben", wat de aanroeper ook vraagt, en de kring komt er altijd door.
3. **Rustige publieke ruimtes.** Waar mensen elkaar ontmoeten zonder dat er
   iets van ze gevraagd wordt: geen tellers, geen "wie is er online", geen feed
   die ververst.
4. **Geen verslavende aanbevelingslus.** Dit staat al in "Wat NIET te doen" in
   CLAUDE.md. Hier wordt het een eis aan elk onderdeel van de bodem, en niet
   alleen een verbod.
5. **Geen commerciële druk binnen de bodem.** Geen upgradeknop midden in een
   leerpad en geen "met RTG Pass kon u dit sneller". Wie meer wil, vindt de
   ladder waar de ladder staat. **Gemeten** met `npm run bodemdruk`
   (`BODEMDRUK.json`, graad `vermoed`): de bodemschermen worden AFGELEID uit de
   verklaring, het functieregister en `SCHERMROUTES.json` (46 op 29 september),
   en op geen van hen staat een uitnodiging om te betalen. Die nul is een ratel
   (`bodemDruk`, alleen omlaag), en hij is geen stilte: de meter vindt de
   "Word lid" op `reisuitnodiging.html`, dat geen bodemscherm is. De eerste
   proef vond negen treffers, en alle negen stonden in commentaar.

Eis 1, 3 en 4 hebben vandaag geen handhaver. Klaar-zijn, rustige ruimtes en de
afwezigheid van een aanbevelingslus zijn lexicaal te onbetrouwbaar om te tellen:
een meter die daar een getal geeft, zou vooral ruis ratelen. Dat staat er liever
dan een schijnbewaker.

Rust meet je niet met gebruikstijd. Een rustfunctie die meer gebruikt wordt, is
niet vanzelf beter. Wat er gemeten mag worden, is of hij er is en of hij vanzelf
eindigt. Hoe lang iemand hem gebruikt, gaat niemand iets aan.

## 7. De RTFoundation: vier permanente functies

De RTFoundation is niet alleen degene die de onderkant financiert. Ze heeft vier
permanente functies. Er komt geen tweede vocabulaire naast de zes motoren van
FOUNDATION.md par. 3; de functies zijn een indeling BOVEN die motoren.

| functie | opdracht | motoren eronder | stand |
|---|---|---|---|
| **Toegang** | niemand valt buiten het systeem omdat geld, taal, handicap, woning of digitale vaardigheid ontbreekt | Understand, Protect | staat in delen; eenvoudige taal en een fysieke ingang ontbreken (par. 3) |
| **Ontwikkeling** | leerpaden, leerwerkplekken, mentoring, een volgende stap | Grow, Resolve | leerstof en aanvoer staan; opleiding, wonen en vervoer vragen een derde partij (HDI.md par. 7.11) |
| **Bescherming** | de HDI-kant, waar gewone software niet genoeg is | Protect, Prove | staat (HDI.md par. 7, regels 1 t/m 7) |
| **Gemeenschap** | fysieke plekken, vrijwilligers, lokale projecten, mensen verbinden | Connect | Buurtruil en het vrijwilligersportaal staan; een fysieke plek niet |

Let bij twee van deze vier op de namen, voordat ze code worden (par. 9).

## 8. De kringloop, en waarom hij geen trechter is

```
RTG creëert economische waarde
   → 30% stroomt naar de RTFoundation          (PRIJZEN.md: 20% lokaal, 10% stichting)
   → de RTFoundation vergroot toegang en mogelijkheden
   → mensen ontwikkelen zich
   → mensen doen mee in samenleving en economie
   → sommigen bouwen later zelf waarde binnen RTG
   → een deel daarvan stroomt opnieuw terug
```

Dat is iets anders dan freemium. Freemium verlaagt de drempel om te
converteren, en deze kringloop financiert een bodem die op zichzelf klopt. Twee
dingen houden het verschil vast:

1. **De eerste pijl is vandaag niet rond.** De 30% wordt per betaling geboekt en
   gereserveerd, maar zonder `RTF_IBAN` niet betaald (PRIJZEN.md par. 4.9,
   `server/config/productie-geld.js`). Daarboven staan de drie besluiten van
   GIFT.md: de RTFoundation heeft nog geen positie om geld op te ontvangen. De
   kringloop is dus gebouwd en niet gesloten.
2. **De laatste pijl wordt nooit per persoon gemeten.** "Sommigen bouwen later
   zelf waarde" is een waarneming over een PROGRAMMA en nooit een doel voor een
   mens. Er komt geen conversieratio van Foundation-deelnemer naar betalend lid,
   geen herkomstlabel "ex-Foundation" op een account, en geen enkele functie in
   de bodem die ontworpen is om iemand omhoog te laten klimmen op de ladder.
   Anders is de bodem een trechter (LIFE.md par. 4: een relatie is geen
   trechter). Wat wel mag, staat in MENSNETWERK.md par. 2.1: RTG meet wat een
   programma oplevert en nooit wat een mens waard is.

## 9. Namen die bezet zijn, vóór de eerste regel code

Dit is de goedkoopste paragraaf van het document, en die van `VERMOGENS`,
`Pulse` en `moment` laten zien waarom hij voorop moet.

| begrip hier | waar het al iets anders betekent | besluit (27 september 2026) |
|---|---|---|
| **bodem** | `bodemCenten` in `kern/pasladder.js` is de prijsondergrens van een trede, en PRIJZEN.md zegt met nadruk: *een bodem is geen prijs*. RTG Community heeft daar letterlijk `bodemCenten: 0`. Een tweede `bodem` die over mogelijkheden gaat, zou in hetzelfde bestand een andere betekenis krijgen | in proza "de universele bodem"; in code **`onvervreemdbaar`** (gemeten: 0 treffers) -- **genomen** |
| **Toegang** (RTF-functie) | WERELDEN.md maakt van **Access** een van vier begrippen: *wat mag ik*. De RTF-functie betekent iets anders: *niemand valt buiten* | in code **`insluiting`** (3 treffers, alle drie gewone lopende tekst en geen identifier) -- **genomen** |
| **Gemeenschap** (RTF-functie) | **RTG Community** is de gratis trede. `kern/pasladder.js` noemt zelf de reden waarom "RTG Foundation" als productnaam afviel: *twee semantisch verschillende objecten horen twee namen te hebben* | in code **`samenkomst`** (gemeten: 0 treffers) -- **genomen**. Eerst gekozen was `nabijheid`, en die bleek **bezet** met drie betekenissen: de nabijheid van een plek (`kern/voorspel/index.js:51`), de trede van een RELATIE in de kringladder (`kern/connect/kring.js:91`) en een weegfactor voor wagen-tot-reiziger (`kern/mobiliteit/matching.js:26`) |
| **vangnet** | 129 bestanden | niet gebruiken |
| **ondergrens** | 85 bestanden, onder meer de prijsbodem en de mens-ondergrens van Service | niet als identifier gebruiken |

Er is ook een naamsverschil dat al in de code staat: `PAS_NAAM.gratis` in
`kern/passen.js` heet **"Gratis app"**, terwijl `kern/pasladder.js` dezelfde trede
**"RTG Community"** noemt. Het ledenregister toont dus iets anders dan de
prijsladder.

## 10. De grondwet: SAM-01 tot en met SAM-07

Bij elke regel staat wie hem handhaaft, en waar dat nog niemand is.

| regel | inhoud | handhaver |
|---|---|---|
| **SAM-01** | **De bodem verdwijnt nooit achter betaling.** Geen van de zeven werkwoorden van par. 2 vraagt een betaalde pas. | `test/onvervreemdbaar.test.js` op `ONVERVREEMDBAAR.json`: geen werkwoord `verdwenen`, en het aantal functies (deels) achter betaling mag alleen dalen. De DEUR, niet de kamer, en op een indeling die nog niet is afgetekend (par. 11) |
| **SAM-02** | **Geen maatschappelijke score.** Nergens wordt een positie, klasse of kwetsbaarheid van een mens berekend, opgeslagen of als sorteersleutel gebruikt, ook niet intern. | deels: `test/cijferopmens.test.js` en de CAR-05-familie; voor een positie-afleiding **niemand** |
| **SAM-03** | **De pas zegt niets over de mens.** Uit een trede wordt nooit kwetsbaarheid, draagkracht of bescherming afgeleid, in geen van beide richtingen. | **niemand** |
| **SAM-04** | **Identiteit begrenst handelingen, niet het mens-zijn.** De bodem vraagt geen bewezen identiteit, en een weigering op identiteit zegt hoe het wel kan. | **niemand** voor de bodem; `volwassen()` voor de handelingen erboven |
| **SAM-05** | **Rust maximaliseert niets.** Geen onderdeel van de bodem wordt beoordeeld op gebruikstijd, terugkeer of conversie. | deels: `test/rust-eindigt.test.js` (rust eindigt vanzelf) en `BODEMDRUK.json` (geen uitnodiging tot betalen op een bodemscherm); gebruikstijd en terugkeer **niemand** |
| **SAM-06** | **De kringloop is geen trechter.** Er is geen per-persoon-meting van Foundation naar betalend, en geen herkomstlabel op een account. | **niemand** |
| **SAM-07** | **Elke deelnamevorm die voor een functie bestaat, bestaat voor de bodem.** Wie via een gemachtigde of in begeleiding kan betalen, kan zo ook leren en hulp vinden. | **niemand** |

Vijf van de zeven hebben geen handhaver, en SAM-05 heeft er een voor twee van zijn helften. Dat staat er liever dan een
schijnbewaker (vergelijk AI-CONTEXT-02 in MENSNETWERK.md). SAM-01 kreeg de
eerste, omdat die meetbaar was zonder één productbesluit (par. 11).

## 11. De toetsvraag, en de meting die bepaalt of dit bestaat

Per product is de hoofdvraag niet alleen *wat krijg je voor deze prijs?* maar:

> **Kan een mens, ongeacht zijn huidige positie, via RTG of RTF blijven leren,
> zich ontwikkelen, deelnemen, rust vinden en — wanneer nodig — een volgende stap
> zetten?**

Waar het antwoord nee is, is er een maatschappelijk gat gevonden. De tabel die
dat beantwoordt, is voor twee rijen GEMETEN (27 september 2026, graad `vermoed`,
op de deur) en voor de rest nog niet:

| | leren | ontwikkelen | oriënteren | verbinden | rust | hulp vinden | opnieuw beginnen |
|---|---|---|---|---|---|---|---|
| zonder account | nee | deels | ja | nee | nee | ja (HDI-voordeur) | geen eigenaar |
| RTG Community | **ja** | **ja** | **ja** | **ja** | **ja** | **ja** | geen eigenaar |
| RTG Pass en hoger | ? | ? | ? | ? | ? | ? | geen eigenaar |
| Business Lite | bestaat nog niet als pas (`bestaatNog: false`) | | | | | | |
| FoundationOS (gezin) | ? | ? | ? | ? | ? | ? | geen eigenaar |

"Ja" betekent: minstens één functie die het werkwoord draagt, laat deze sessie
langs de deur. De rij "zonder account" komt uit dezelfde meting (`zonderAccount`
per functie) en is informatie en geen overtreding: de bodem belooft vandaag
alleen de HDI-voordeur en de hulpwijzer zonder account.

### 11.1 Wat bij het schrijven bovenkwam, en wat de meting ervan overliet

De eerste versie van deze paragraaf schreef: *een lid met RTG Community en een
niet-lid zijn in de code dezelfde waarde*, want beide dragen `tier === 'guest'`
en 101 bestanden toetsen daarop. **Dat was maar half waar.** `geenGast()` in
`server/server.js` weigert alleen `guest` ZONDER `session.account`, met de zin
*"Maak een gratis account (met paspoort) om vrienden toe te voegen en te
chatten."* -- de code kent het verschil dus wel, op de plekken die `geenGast`
gebruiken. Van de 101 bestanden noemen er 36 ook `account` (lexicaal); de andere 65
zijn niet nagelopen.

### 11.2 De nulmeting, en de meetfout die zij eerst maakte

`scripts/onvervreemdbaar.js` legt per functie uit de verklaring
(`scripts/lib/onvervreemdbaar-verklaring.js`) drie verzoeken naast elkaar: een
**geregistreerd gratis account**, een **RTG Pass** en **anoniem**. Komt de RTG
Pass langs en het gratis account niet, dan is de pas het enige verschil en heet
de route `achter-betaling`. Per route staat de foutzin erbij, want dat is een
sessieverschil gelezen als pasverschil (graad `vermoed`).

**De eerste ronde mat de verkeerde persoon**, en dat hoort hier te staan
(BEWIJSMACHINE.md par. 6a). Hij leende de "gratis" sessie van de doelgroepmeter,
en die is de DEMO-inlog: `guest` zonder account, een bezoeker. Uitslag: vijf
functies achter betaling (Metier, vrienden verbinden, de kring, Buurtruil, de
stadsraad), en alle vijf gaven de `geenGast`-zin. Met een echt gratis account
langs `/api/auth/register` zijn het er nog **een**. Twee gevolgen:

- **`DOELGROEPBEREIK.json` zei over RTG Community niets.** Het register rekent
  bezoeker en gratis account allebei tot de doelgroep `gast`
  (`tierNaarDoelgroep`), maar de meter droeg alleen de bezoeker. Dat is sinds
  28 september 2026 gerepareerd (stap 4b, par. 11.3).
- **Een account opent meer dan een pas.** Voor de bodem is het verschil tussen
  zonder en met account groter dan tussen gratis en betaald: leren, verbinden
  en rust gaan pas open met een account. Een gratis account vraagt een paspoort
  (de zin van `geenGast`), en dan staat SAM-04 er scherp: *identiteit begrenst
  handelingen, niet het mens-zijn*. Of leren zonder paspoort hoort te kunnen, is
  een besluit.

**Wat er voor het gratis account achter betaling zat** (routes waar de RTG Pass
langskwam en het gratis account niet):

| functie | wat | foutzin | stand na besluit 4c |
|---|---|---|---|
| `dom-gemeente` | een afspraak maken | *Alleen voor leden.* | **open na paspoortcontrole** |
| `dom-overheid` | aangifte doen | *Alleen voor leden.* | **open na paspoortcontrole** |
| `dom-care` | een intake delen | *Alleen voor leden.* | **open na paspoortcontrole** |
| `dom-gemeente` / `dom-overheid` | belasting of een aanslag betalen | *Alleen voor leden.* | achter de pas: geld, niet besloten |
| `dom-care` | een behandeling boeken | *Boeken kan alleen met een lidmaatschap.* | achter de pas: boeking, niet besloten |
| `dom-samen` | alle acht routes: samen-sessies | *Samen-sessies zijn voor leden.* | achter de pas |
| `opvangwijzer` | een aanvraag klaarzetten | *Een aanvraag klaarzetten kan met een lidmaatschap.* | achter de pas |
| `salon` | een deal claimen | *Alleen voor leden.* | achter de pas, en terecht |

**Besluit 4c (27 september 2026).** De gemeenteafspraak, de aangifte en de
zorgintake zijn wegen naar een instantie en horen bij *hulp vinden*. Ze staan
open voor een gratis account, maar pas nadat RTG het paspoort heeft gezien.
Dat is geen nieuwe identiteitsregel maar `idGeverifieerd()` uit
`server/server.js`, en hij woont op een plek: `server/kern/onvervreemdbaar.js`
(`maakPaspoortdeur`). Drie dingen liggen daar vast en worden alle drie tegen een
echte server beproefd (`test/paspoortdeur.test.js`, met twee mutaties die hem
laten zakken): een betaalde pas merkt er niets van, een bezoeker zonder account
blijft buiten, en elke weigering zegt in `hoe` hoe het wel kan (SAM-04). Wat
ernaast staat en geld is -- een aanslag of gemeentebelasting BETALEN -- is met
opzet niet meegegaan.

**De meter meet daarom een GECONTROLEERD gratis account.** Wie met een
ongecontroleerd account meet, noemt een route die achter de paspoortcontrole
zit "achter betaling" -- dezelfde vorm als de eerste meetfout hierboven. Het
ongecontroleerde account staat ernaast als kolom (`zonderControle` per route,
`achterPaspoortcontrole` per functie), zodat zichtbaar blijft wat de controle
opent.

**Wat de meting niet zegt.** Of de indeling in werkwoorden klopt: die is een
VOORSTEL en door geen mens afgetekend (`AFGETEKEND` in de verklaring). Of de
kamer werkt: er gaat een leeg lichaam heen. En niets over de betaalde treden
onderling of over het gezin in FoundationOS; die rijen blijven `?`.

### 11.3 De doelgroepmeter draagt nu beide gasten (stap 4b)

`gast` heeft in `scripts/lib/doelgroepsessies.js` twee **vormen**: de bezoeker
(de demo-inlog, en nog steeds wat `draag()` geeft, zodat de bodemmeter hem als
eigen kolom houdt) en een gratis account waarvan RTG het paspoort heeft gezien.
Het registreren en keuren woont in `scripts/lib/gratisaccount.js`, zodat de
bodemmeter en de doelgroepmeter hetzelfde gratis lid meten en niet twee
versies ervan. Een cel is open zodra **een** vorm erlangs komt, en draagt dan
`openVorm`; komt geen vorm erlangs en gaf er een een onbepaald antwoord, dan is
de cel onbepaald en niet dicht (`klopVormen` in `scripts/doelgroepbereik.js`).

Verse meting ervoor en erna, op dezelfde code verder:

| `gast` | alleen bezoeker | bezoeker + account |
|---|---|---|
| waar | 43 | **48** |
| onbepaald | 52 | **40** |
| bereikbaar zonder verklaring | 73 | **82** |
| geen deur | 16 | 14 |
| correct afgesloten | 37 | 37 |
| registerleugen | 1 | 1 |

Geen andere doelgroep bewoog, en het totaal aan registerleugens bleef 18: die
zitten allemaal in `gemengde-deuren`, en de enige van de gast (`tg-sso`) stond
er met alleen de bezoeker ook al en komt ook met een account niet langs. Drie
dingen uit de nieuwe cellen:

- **Vijf functies die het register aan de gast belooft, waren tot nu toe
  onbewezen** (democratie, de RTG Pay-wallet, `/api/ik`, `/api/comm`,
  festivalgast) en zijn nu `waar` -- alleen met een account, en dat is wat de
  belofte ook bedoelde.
- **Negen cellen bedienen het gratis lid zonder dat het register het zegt.**
  Zeven waren onbepaald (vrienden verbinden, ontmoetingen, spellen, de kring,
  Metier, genootschap, kosten) en twee heetten `geen-deur` (passkeys en
  werving). Acht daarvan antwoorden precies zoals een verklaarde doelgroep
  (`gelijk-aan-verklaard`). Dat is een BESTUURSgat en geen toegangsfout: het
  bord kan die functies niet voor de gast uitzetten. De bodem draagt daarmee
  meer dan het register weet.
- **Eén cel is een toegangsvraag**: `POST /api/werving/verbind` weigert elke
  verklaarde doelgroep en laat een gratis account door (`ruimer-dan-verklaard`).
  Of dat bedoeld is, is een vraag voor een mens; deze meter beantwoordt hem
  niet.

### 11.4 De 101 bestanden nagelopen (stap 5)

Par. 11.1 liet 65 bestanden open die op `guest` toetsen zonder `account` te
noemen. Die zijn nu niet met de hand nagelopen maar GEMETEN, want een handlijst
loopt achter zodra er een deur bijkomt: `npm run gastsplitsing`
(`GASTSPLITSING.json`, graad `vermoed`) loopt elke toets op de gast in `server/`
na en zet naast elkaar wat de CODE doet en wat de WEIGERING belooft. Op 29
september 2026: 143 toetsen in 124 bestanden.

| wat de plek doet | aantal |
|---|---|
| houdt bezoeker en gratis account uit elkaar (`account` of `idGeverifieerd()`) | 23 |
| vertakt alleen (geen weigering) | 23 |
| weigert, en zegt dat er een betaalde pas nodig is | 11 |
| weigert "voor leden" | 82 |
| weigert, en belooft dat een account of profiel volstaat | **3** |
| weigert zonder tekst | 1 |

**De 82 "voor leden" zijn geen fout maar een formuleringsvraag.** Het woord is
dubbelzinnig: een Community-lid heet ook lid, en leest *"RTG Bank is voor
leden"* als een deur die hem open hoort te staan. Wat daar bedoeld is, is een
betaalde pas; of dat per functie zo HOORT, zegt de bodem (par. 11.2), en daar
verdween geen werkwoord.

**De drie zijn een tegenspraak tussen tekst en code**, en ze zijn nagetrokken op
een echte server met een gratis account waarvan RTG het paspoort had gezien --
alle drie gaven 403:

- `POST /api/stad/melding`: *"Melden kan met een RTG-profiel; meekijken mag altijd."*
- `POST /api/stad/raadpleging/reageer`: *"Meepraten kan met een RTG-profiel; meelezen mag altijd."*
- `routes/neiging.js` (zeven routes): *"Dit hoort bij een account; als gast is er
  niets om te bewaren."* -- terwijl de kop van dat bestand zegt dat de grond
  "zonder account" is.

Dat is precies de vorm van de meetfout uit par. 11.2, maar dan in de code zelf:
de tekst gaat over een ACCOUNT, de voorwaarde over een PAS.

**Het besluit (29 september 2026): de code volgt de tekst.** Alle drie lopen nu
langs dezelfde paspoortdeur als besluit 4c (`maakPaspoortdeur()` in
`server/kern/onvervreemdbaar.js`): een gratis account waarvan RTG het paspoort
zag mag, een gratis account zonder controle hoort hoe het wel kan, een bezoeker
zonder account blijft buiten, en een betaalde pas merkt niets.
`test/paspoortdeur.test.js` draagt de drie deuren naast de eerste drie, en zakt
als een ervan terug achter de pas gaat. Meekijken en meelezen bleven wat ze
waren: open. Twee ratels houden het vast: `gastTegenspraak` staat op 0 en mag
alleen omlaag (dus niet meer omhoog), `gastOnderscheidt` op 23 en mag alleen
omhoog.

## 12. De volgorde

| # | wat | stand |
|---|---|---|
| 1 | Dit document als grondwet | **staat** |
| 2 | De naamsbesluiten van par. 9, vóór de eerste identifier | **genomen**: `onvervreemdbaar`, `insluiting`, `samenkomst` |
| 3 | De nulmeting van par. 11.2 | **staat** voor het gratis account; de verklaring wacht op aftekening |
| 4 | SAM-01 als ratel | **staat** (`test/onvervreemdbaar.test.js`) |
| 4b | De doelgroepmeter een gratis-accountsessie geven naast de bezoeker | **staat** (par. 11.3); de toegangsvraag bij `werving/verbind` wacht op een mens |
| 4c | Gemeenteafspraak, aangifte en zorgintake voor een Community-lid | **staat**: open na paspoortcontrole (`server/kern/onvervreemdbaar.js`) |
| 5 | `guest` splitsen in *bezoeker* en *lid op de bodem* | **staat** (par. 11.4): gemeten met `npm run gastsplitsing`, en de drie tegenspraken zijn op 29 september besloten en dicht; de 82 weigeringen "voor leden" zijn een formuleringsvraag |
| 6 | Rust verhuizen van Veiligheid naar de bodem, plus de vijf eisen van par. 6 | **staat** (par. 6): RTG Veilig in LivingOS, `rust` als eigen functie, eis 2 en 5 gehandhaafd; eis 1, 3 en 4 zonder handhaver, met de reden |
| 7 | Eenvoudige taal als deelnamevorm | een stap weg |
| 8 | De Foundation-rekening en de ANBI-vraag (GIFT.md) | **vraagt een besluit**; sluit de eerste pijl van de kringloop |
| 9 | Een fysieke plek per gemeente, met een partner | vraagt een besluit en een derde partij |
| 10 | RTG Lite, getoetst aan deze grondwet in plaats van aan de prijsladder | na 3 |
| 11 | Opnieuw beginnen als projectie over wat er staat | na 3 |

## 13. Wat dit document niet is

- **Geen nieuwe wereld.** De bodem zit dwars op de vier werelden, zoals RTG Core
  (WERELDEN.md). Leren staat in FoundationOS, rust in LivingOS, en dat blijft zo.
  De bodem zegt alleen wat er in elke wereld voor iedereen open moet blijven.
- **Geen nieuw product.** Er komt geen "RTG Bodem" of "RTG Samenleving" naast de
  ladder.
- **Geen segmentatiemodel.** Het doel is dat niemand een segment hoeft te zijn.
- **Geen uitspraak over prijzen.** Wat een trede kost, staat in PRIJZEN.md. Hier
  staat alleen wat een trede nooit mag weghalen.
