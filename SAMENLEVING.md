# SAMENLEVING.md — één infrastructuur voor elke plek in de samenleving

*Richtingsdocument en grondwet, 27 september 2026. Zoals PLATFORM.md,
ECONOMIE.md en HDI.md staat bij elk onderdeel of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is. Wat hier als stand staat is
gelezen in de code en niet gemeten, dus draagt het de graad `vermoed` tot de
nulmeting van par. 11 heeft gedraaid.*

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
| **rust** | `kern/veiligheid/rust.js` (vijf standen, de kring komt er altijd door, elke stand eindigt vanzelf) | staat als functie; als ontwerpgebied niet (par. 6) |
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
   laat de wereld zwijgen terwijl de kring erdoor komt. Het gebrek: de functie
   hangt onder Veiligheid en niet onder de bodem, en is dus te vinden voor wie
   haar al zoekt.
3. **Rustige publieke ruimtes.** Waar mensen elkaar ontmoeten zonder dat er
   iets van ze gevraagd wordt: geen tellers, geen "wie is er online", geen feed
   die ververst.
4. **Geen verslavende aanbevelingslus.** Dit staat al in "Wat NIET te doen" in
   CLAUDE.md. Hier wordt het een eis aan elk onderdeel van de bodem, en niet
   alleen een verbod.
5. **Geen commerciële druk binnen de bodem.** Geen upgradeknop midden in een
   leerpad en geen "met RTG Pass kon u dit sneller". Wie meer wil, vindt de
   ladder waar de ladder staat.

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

| begrip hier | waar het al iets anders betekent | voorstel |
|---|---|---|
| **bodem** | `bodemCenten` in `kern/pasladder.js` is de prijsondergrens van een trede, en PRIJZEN.md zegt met nadruk: *een bodem is geen prijs*. RTG Community heeft daar letterlijk `bodemCenten: 0`. Een tweede `bodem` die over mogelijkheden gaat, zou in hetzelfde bestand een andere betekenis krijgen | in proza "de universele bodem"; in code **`onvervreemdbaar`** (0 treffers in `server/` en `public/`) |
| **Toegang** (RTF-functie) | WERELDEN.md maakt van **Access** een van vier begrippen: *wat mag ik*. De RTF-functie betekent iets anders: *niemand valt buiten* | in code **`insluiting`**; in proza mag "toegang" blijven zolang het bij de RTF staat |
| **Gemeenschap** (RTF-functie) | **RTG Community** is de gratis trede. `kern/pasladder.js` noemt zelf de reden waarom "RTG Foundation" als productnaam afviel: *twee semantisch verschillende objecten horen twee namen te hebben* | in code niet `community` of `gemeenschap`; voorstel **`nabijheid`** (eerst zelf meten) |
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
| **SAM-01** | **De bodem verdwijnt nooit achter betaling.** Geen van de zeven werkwoorden van par. 2 vraagt een betaalde pas. | **niemand**. Dat is precies wat de nulmeting moet meten |
| **SAM-02** | **Geen maatschappelijke score.** Nergens wordt een positie, klasse of kwetsbaarheid van een mens berekend, opgeslagen of als sorteersleutel gebruikt, ook niet intern. | deels: `test/cijferopmens.test.js` en de CAR-05-familie; voor een positie-afleiding **niemand** |
| **SAM-03** | **De pas zegt niets over de mens.** Uit een trede wordt nooit kwetsbaarheid, draagkracht of bescherming afgeleid, in geen van beide richtingen. | **niemand** |
| **SAM-04** | **Identiteit begrenst handelingen, niet het mens-zijn.** De bodem vraagt geen bewezen identiteit, en een weigering op identiteit zegt hoe het wel kan. | **niemand** voor de bodem; `volwassen()` voor de handelingen erboven |
| **SAM-05** | **Rust maximaliseert niets.** Geen onderdeel van de bodem wordt beoordeeld op gebruikstijd, terugkeer of conversie. | **niemand** |
| **SAM-06** | **De kringloop is geen trechter.** Er is geen per-persoon-meting van Foundation naar betalend, en geen herkomstlabel op een account. | **niemand** |
| **SAM-07** | **Elke deelnamevorm die voor een functie bestaat, bestaat voor de bodem.** Wie via een gemachtigde of in begeleiding kan betalen, kan zo ook leren en hulp vinden. | **niemand** |

Zes van de zeven hebben geen handhaver. Dat staat er liever dan een
schijnbewaker (vergelijk AI-CONTEXT-02 in MENSNETWERK.md). SAM-01 krijgt de
eerste, omdat die meetbaar is zonder één productbesluit (par. 11).

## 11. De toetsvraag, en de meting die bepaalt of dit bestaat

Per product is de hoofdvraag niet alleen *wat krijg je voor deze prijs?* maar:

> **Kan een mens, ongeacht zijn huidige positie, via RTG of RTF blijven leren,
> zich ontwikkelen, deelnemen, rust vinden en — wanneer nodig — een volgende stap
> zetten?**

Waar het antwoord nee is, is er een maatschappelijk gat gevonden. De tabel die
dat beantwoordt, staat hieronder en is **ongemeten**:

| | leren | ontwikkelen | oriënteren | verbinden | rust | hulp vinden | opnieuw beginnen |
|---|---|---|---|---|---|---|---|
| zonder account | ? | ? | ? | ? | ? | staat (HDI-voordeur) | ? |
| RTG Community | ? | ? | ? | ? | ? | staat (Service) | ? |
| RTG Pass | ? | ? | ? | ? | ? | staat | ? |
| Business Lite | ? | ? | ? | ? | ? | ? | ? |
| Business Pass | ? | ? | ? | ? | ? | staat | ? |
| Lifestyle Pass | ? | ? | ? | ? | ? | staat | ? |
| FoundationOS (gezin) | ? | ? | ? | ? | ? | ? | ? |

### 11.1 Wat bij het schrijven al bovenkwam, en waarom de meting eerst moet

**Een lid met RTG Community en een niet-lid zijn in de code dezelfde waarde.**
`kern/passen.js` zegt het met zoveel woorden: *een gast/gratis lid heeft tier
`guest`*. Tegelijk toetsen **101 bestanden** in `server/` op `tier === 'guest'`,
en AFSPRAAK.md stelde bij 45 van de 46 ledenroutes vast dat die toets betekent
*is dit überhaupt een lid*. Voor de code is iemand op de maatschappelijke bodem
dus per constructie iemand die er niet bij hoort.

Dat is een vermoeden en geen uitslag, om twee redenen die elkaar tegenwerken.
Een deel van die toetsen bedoelt terecht "wie niet betaalt, koopt hier niets"
(`kern/passen.js` noemt precies dat voorbeeld), en dat is geen bodemfunctie.
Omgekeerd hangen `/api/veiligheid/rust` en de leerstofroutes gewoon aan `auth`
zonder op `guest` te toetsen, dus daar is de bodem waarschijnlijk open. Welke
kant de overhand heeft, zegt alleen een echte sessie.

### 11.2 De nulmeting

De meting bestaat grotendeels al. `DOELGROEPBEREIK.json` meet per cel (functie x
doelgroep) of een verklaarde doelgroep met een echte sessie binnenkomt, en
leest `dicht` alleen als de sessie geen enkel verschil maakte met anoniem
(MAATSTAF.md par. 7f). Wat ontbreekt is een as, geen motor:

1. **De zeven werkwoorden als verklaring** over de bestaande functies uit
   `MAPPEN`: welke functie draagt welk werkwoord. Dit is een verklaring en geen
   afleiding, net als `LEDENVELDEN` in AI-CONTEXT-01, en een mens tekent haar af.
2. **Een sessie op de gratis trede** in de sleutelbos van de proeven, naast de
   sessies die er al zijn.
3. **De uitslag per cel** in de standen van de doelgroepmeter, met één regel erbij:
   een werkwoord van de bodem dat voor de gratis trede `dicht` is, is een
   overtreding van SAM-01 en geen triagepunt.

Pas daarna heeft het zin om Community, Business Lite, Pass, Business,
Lifestyle, FoundationOS en HDI aan deze grondwet te toetsen. Zonder de meting
is dit document een belofte over het huis in plaats van een beschrijving ervan.

## 12. De volgorde

| # | wat | stand |
|---|---|---|
| 1 | Dit document als grondwet | **staat** |
| 2 | De naamsbesluiten van par. 9, vóór de eerste identifier | **vraagt een besluit** |
| 3 | De nulmeting van par. 11.2: de werkwoordverklaring, de gratis sessie en de uitslag per cel | **een stap weg** |
| 4 | SAM-01 als ratel: het aantal dichte bodemcellen mag alleen dalen | na 3 |
| 5 | `guest` splitsen in *geen lid* en *lid op de bodem*, als de meting laat zien dat het ertoe doet | na 3; raakt 101 bestanden, dus eerst de schaduw (CONTROLPLANE.md) |
| 6 | Rust verhuizen van Veiligheid naar de bodem, plus de vijf eisen van par. 6 | een stap weg |
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
