# De kaart — vier werelden, een kern eronder, en de pas die er dwars op staat

Vastgelegd 19 augustus 2026. Dit document neemt het besluit dat `PLATFORM.md`
par. 3 sinds 11 augustus openhield: welke werelden er zijn en hoe ze zich tot
elkaar verhouden. `PLATFORM.md` blijft waar de volgorde van bouwen staat, dit is
waar de indeling staat.

Dit is de tweede versie. De eerste (drie werelden: ROS, Concern, Fundament) hield
één dag stand en dat is geen schande maar de bedoeling: hij liep vast op iets dat
pas zichtbaar werd toen de functies geteld waren. Wat er misging staat verderop,
onder *Wat de vorige kaart fout had*, want een kaart die zijn eigen fouten
weggummt leert niemand iets.

## Vier begrippen die niet langer door elkaar lopen

Dit is de kern van deze versie, en de reden dat de vorige kaart wankelde. Er
werden vier verschillende dingen met dezelfde woorden aangeduid:

| begrip | beantwoordt | waarden |
|---|---|---|
| **World** | waar ben ik? | LivingOS · WorkOS · TravelOS · FoundationOS |
| **Capability** | wat kan het systeem? | 190 functieschakelaars in `server/functies/register/` |
| **Access** | wat mag ik? | 8 doelgroepen, plus de vertrouwenslaag op de server |
| **Pass / Product** | waar betaal ik voor? | `rtg` · `lifestyle` · `business` |

Zolang die vier op één hoop liggen, is elke vraag een strikvraag. "Hoort dit bij
Business?" betekent dan tegelijk *waar staat het*, *wat doet het*, *wie mag erbij*
en *wat kost het* — vier antwoorden die elkaar tegenspreken zodra er één
verandert.

Uit elkaar getrokken luidt de zin:

> **Core ondersteunt Worlds. Worlds organiseren Experiences. Access bepaalt wat
> zichtbaar is. Passes bepalen commerciële rechten.**

### De regel die daaruit volgt

> **Een wereld draagt nooit de naam van een pas — ook niet de stam ervan.**
>
> Vallen die woorden samen, dan leest een lid een plek als een prijs. Een
> RTG-Pass-houder met een horecazaak hoort thuis in de wereld waar je een zaak
> bestuurt, maar zou "Business" lezen als *"dat is die dure pas, niet voor mij"*.
>
> De stam telt mee, en dat is met opzet scherper dan de eerste versie. `LifeOS`
> was de eerste kandidaat voor de persoonlijke wereld en haalde de toets — `life`
> is immers niet `lifestyle`. Maar dat is de regel op de letter volgen en niet op
> de bedoeling: een lid ziet "Life" staan naast een pas die "Lifestyle" heet. Wie
> zelf een regel schrijft tegen semantische botsingen, hoort hem niet met een
> technische woordvergelijking te omzeilen. Vandaar **LivingOS**.
>
> *Handhaving:* `test/wereldregister.test.js` — exact woord én gedeelde stam.

## De beslisprocedure

Bij elk twijfelgeval is er nu één vraag, en het is niet meer "bij welke pas hoort
dit?" of "in welke map staat de code?":

> **In welke context denkt de mens dat hij zich bevindt wanneer hij dit gebruikt?**

Dezelfde persoon, vier keer op een dag:

| hij doet | context |
|---|---|
| zijn rooster openen | WorkOS |
| eten bestellen | LivingOS |
| naar Ibiza vliegen | TravelOS |
| vrijwilligerswerk doen voor RTFoundation | FoundationOS |

RTG iD, Rahul, betalen en meldingen reizen gewoon met hem mee. Dat zijn geen
werelden maar Core.

### En het principe erachter

> **De eigenaar of bouwer van een capability bepaalt niet in welke wereld hij
> thuishoort. De gebruikerscontext bepaalt dat.**

RTFoundation kan dus eigenaar zijn van een capability die aan de voorkant in
LivingOS verschijnt. Dat is precies wat er onder `public/apps/foundation/`
gebeurd is: 71 schermen, waarvan er acht over de stichting als organisatie gaan
en de rest over het leven van een kind. Die schermen zijn niet "Foundation" omdat
RTFoundation ze gebouwd heeft.

## De vier werelden

Ze zijn met opzet **niet even groot**. Ze hoeven niet gelijk te zijn in volume,
prijs of doelgroep; ze moeten elk een stabiele menselijke context zijn.

| wereld | huis | dat is | onderdelen |
|---|---|---|---|
| **LivingOS** | `/apps/rtg.html` | mijn dagelijks leven | 40 |
| **WorkOS** | `/apps/kantoor.html` | mijn werk en organisaties | 10 |
| **TravelOS** | `/apps/reizen.html` | mijn reizen en onderweg zijn | 11 |
| **FoundationOS** | `/apps/foundation/os-publiek.html` | RTFoundation en haar maatschappelijke werk | 2 |

Die laatste kolom telt items in `MAPPEN` en geen schermen. De tabel wordt
machinaal vergeleken met de code, dus als hij niet meer klopt zakt de bouw.

### LivingOS — mijn dagelijks leven

Alles wat van mij is en wat ik op een gewone dag doe: geld, sociaal, het huis en
het huishouden, zorg en gezin, media en cultuur, en mijn eigen gegevens. Hier
horen op termijn ook de levensschermen thuis die nu onder RTFoundation staan
(babyboek, dromen, gevoel, gezondheid, ochtend, rust, opvoeden, campus, bieb,
club, speeltuin).

`ROS` betekende tot 18 augustus het hele ledenplatform (`README.md`: *"De app is
een besturingssysteem (het ROS)"*). Die betekenis versmalt hier tot één wereld.
`shared/rosapps.js` en `rosthema.js` houden hun bestandsnaam.

### WorkOS — mijn werk en organisaties

Eén wereld, **twee volstrekt verschillende toegangsmodellen**, en dat is geen
tegenstrijdigheid maar de reden dat het één wereld moet zijn:

| wie | krijgt | hoe |
|---|---|---|
| werknemer | de werkvloer | via zijn werkgever |
| werkgever / business | de werkruimte | koopt hem |
| RTG-medewerker | beide | als werknemer, eventueel als beheerder |
| directie | Boardroom | rol |
| operations | Meldkamer | rol |
| specialist | Metier, Vakritmes | rol |

Een wereld eroverheen ontkent die verschillen niet — **de commerciële verpakking
zit binnen de wereld**, niet eromheen. En het register zegt dat sinds vandaag
ook: twaalf werkfuncties dragen samen de groep `WERKOS` (`intern`, `business`,
`leverancier`, `personeel`) in plaats van twee losse setjes.

### De fout die daaronder lag

Dit was niet alleen een indelingsvraag. Het register zei `leverancier, personeel`
op elf werkfuncties, maar hun paden — `/api/werkvloer`, `/api/werkplek`,
`/api/metier`, `/api/vak`, `/api/verkoop`, `/api/doos`, `/api/facturen`,
`/api/kantoor`, `/api/werkmail`, `/api/mail/binnen`, `/api/werving` — beginnen
niet met `/api/supplier` of `/api/staff`. De doelgroep viel daar dus terug op de
**pas**, en een partner of medewerker heeft geen pas.

Gevolg: op die elf functies stonden schakelaars op het bord **die nooit verkeer
zagen**. Ze kleurden groen of rood en stuurden niets. Dat is precies de stilste
storing die er is — een meter die geruststelt.

De reparatie heeft twee helften, en ze horen bij elkaar:

1. `server/functies/doelgroep.js` leest op de werkpaden de **relatie tot de
   organisatie** uit de sessie: `office` → `intern`, een zaaksessie met
   `manager` → `leverancier`, zonder → `personeel`. Een lid zonder werksessie
   volgt nog steeds zijn pas: dat is de werkgever die zijn eigen zaak bestuurt.
2. Het register declareert die vier op dezelfde functies (`WERKOS`).

De sessie zegt met opzet **niet** uit welke app je komt: een medewerker logt één
keer in en gebruikt daarmee zowel de partner-app als de PDA. Op een gedeeld pad
valt dus niet af te lezen welk scherm belt — en dat hoeft ook niet. Wat het bord
wil sturen is niet het scherm maar de mens: wie de zaak bestuurt tegenover wie er
werkt. `test/functies.test.js` houdt beide helften vast, en meet ook dat er geen
schakelaar meer op het bord staat die niemand kan bereiken.

Daarmee lost ook iets op waar de vorige kaart een aparte wereld voor optuigde:
RTG is gewoon één werkgever binnen WorkOS. Backoffice, Boardroom en Meldkamer
zijn een werkplek in dezelfde wereld waar een horecazaak zijn rooster maakt, geen
eigen "Fundament".

`CONCERN.md` beschrijft deze wereld al voordat hij zo heette: *Company Launch &
Workforce OS*, met als kern dat **één bedrijf niet één KvK is**.

### TravelOS — mijn reizen en onderweg zijn

De kleinste wereld: elf onderdelen in `MAPPEN`, veertien van de 190
functieschakelaars. Dat is bewust geen argument tegen hem. Een wereld is geen
categorie in een spreadsheet maar een bestemming in het mentale model, en deze
bezit een hele keten:

```
reis bedenken → vervoer → verblijf → activiteiten → hospitality
   → arrival → lokaal vervoer → onderweg → terugreis
```

Luchtvaart, OV, taxi, Hospitality, Invisible Arrival en destination services
kunnen daar allemaal onder groeien zonder dat de wereldstructuur ooit hoeft te
wijzigen. Dat is de verdediging, en niet "RTG is een reisbureau".

Het huis bestond al en hing nergens aan: `/apps/reizen.html` — *"uw reiswereld op
een plek, alles wat eraan komt, uit alle reisapps tegelijk"*
(`server/kern/appgids-data/deel11.js`), met een eigen webmanifest.

### FoundationOS — RTFoundation en haar maatschappelijke werk

De operationele en digitale wereld van de stichting: bestuur, donateurs,
vrijwilligers, deelnemers, veldwerk, het onderzoekslab, het labfonds, de
onderwijsprogramma's, de stadsraad, het RTF-kantoor, maatschappelijke projecten.

Gemeten: van de 71 schermen onder `public/apps/foundation/` gaan er acht over de
stichting als organisatie (`os-bestuur`, `os-donateur`, `os-vrijwilliger`,
`os-veld`, `os-deelnemer`, `os-publiek`, `os-portaal`, `os`). In het
functieregister dragen 48 functies de doelgroep `foundation`, maar er zijn er
**13 werkelijk eigen** — de rest is Core dat overal zit.

**FoundationOS is dus de wereld, RTFoundation is het merk erin.** Dezelfde relatie
als tussen WorkOS en RTG Kantoor, en tussen TravelOS en RTG Reizen. Een huis is
een merk; een wereld is een context.

## Het Vooruitzicht — de cockpit van LivingOS

Er stond een app die `Living OS` heette, en na de hernoeming van de wereld
stonden ze in de bank vier regels uit elkaar: `LivingOS` onder *Werelden*,
`Living OS` onder *Software*. Dezelfde botsing als LifeOS tegenover Lifestyle
Pass, maar erger — dezelfde woorden, dezelfde lijst. Gevonden met een browser en
niet met een grep, want geen enkele toets hield een wereldnaam tegen de
softwarecatalogus.

De uitweg was niet hernoemen om het hernoemen: dat scherm **is** de cockpit van
LivingOS. Kijk waar het uit bestaat en het is letterlijk het wereldpatroon van
`PLATFORM.md`, laag voor laag:

| laag (`PLATFORM.md`) | op dat scherm |
|---|---|
| graaf | de drie gesimuleerde werelden, met geld, tijd, energie, mensen, beleving |
| beleid | *Meereizende regels* — menselijk akkoord boven €500, minimaal delen |
| cockpit | het scherm zelf, uitzonderingsgestuurd |
| gegronde Rahul | de balk onderaan, met bronnen onder *Waarom deze wereld?* |
| actielog | *Replay* — terugspoelen om oorzaak en herstel te begrijpen |

Het heet nu **Het Vooruitzicht** en hangt als eerste onderdeel in LivingOS. De
bestandsnaam (`/apps/living-os.html`, `shared/living-os.css`) blijft: een
bestandsnaam is geen merknaam.

**Het is niet uit de softwarecatalogus gehaald, en dat is een bewuste correctie
op het eerste plan.** Die catalogus is namelijk ook Rahuls routeertabel
(`appUit` in `shared/command/catalog.js`): wie er een regel uit haalt, sloopt
"open het gastdossier". Twee apps staan om precies die reden al in allebei de
lijsten — Reizen & Veilig en Gastdossier hangen in TravelOS én in de catalogus.
Wat er dus fout was, was de NAAM en niet de plaats.

## Instellingen — en waarom het geen wereld is

*Mijn account, identiteit, privacy en controle.*

Instellingen staat wel in de bank maar is geen wereld. Een wereld is een context
waar je in leeft; instellingen is de plek waar je aan het systeem zelf draait.
Het is preciezer om te zeggen wat het echt is:

> **Instellingen is het enige zichtbare gezicht van RTG Core.**

Mechanisch is dat het bedieningspaneel in de voet van de bank (`WERELD.md`),
samen met thema, taal, push, meldingen, Zegel en uitloggen. Daar staan sinds
vandaag ook de vier identiteitsapps bij: **Wie ben ik, RTG Veilig, Passkeys,
Juridisch**. Ze stonden in LivingOS en gaan niet over een dag maar over het
systeem.

In `MAPPEN` hebben ze een eigen ingang gekregen die géén `wereld` draagt maar een
`paneel`. Dat lost twee dingen tegelijk op: `wereldBij()` filtert de map vanzelf
uit de werelden weg (Instellingen is geen wereld), en `openMap` opent het paneel
in plaats van een eigen tegelveld (Instellingen is geen tweede scherm). Ze
verdwijnen daarmee niet uit Spotlight, want dat indexeert `MAPPEN` en niet de
werelden — en ze zomaar uit het register halen zou verbergen zijn, wat
`ADAPTIEF.md` verbiedt.

**Wat hier nog wringt:** het paneel staat in HTML (`apps/app.html`) en het
register in JS (`MAPPEN`). Wie er een vijfde bij zet, moet dat op beide plekken
doen. Dat is genoemd in de code zelf in plaats van het te laten opvallen als er
ooit een mist.

## RTG Core — de laag die met de mens meereist

Geen wereld, geen tegel, geen vijfde ingang. Core is wat overal geldt.

Dit is geen aanname maar een telling. **Vierentwintig functies zitten in álle vijf
publieksgroepen** (`rtg`, `gast`, `personeel`, `leverancier`, `foundation`) —
afgelezen uit `server/functies/register/`, zie `GROEPEN.md`:

```
identiteit    RTG iD · Onboarding · Inloggen en registreren · SSO ·
              Pincode en sleutelwoorden · Zegel, codes en rechtenbeheer ·
              De gegevenspoort · Account en profiel · Aanmelden voor een pas ·
              Wervingslink van een werkgever
toestand      De app-staat · De live-verbinding · Meldingen en push ·
              Storingsmelding uit de browser
communicatie  Berichten en gesprekken · Communicatieplatform · Taal en vertaling
AI            Rahul (de assistent) · App-gids en uitleg
geld          Pasprijzen en balans
media         Media-assets · Media uitleveren
overig        Living Lab: de bewonerskant · Invisible Arrival
```

Die laatste twee horen daar strikt genomen niet — ze zitten in alle groepen
omdat ze breed zijn opengezet, niet omdat ze infrastructuur zijn. Dat staat er
juist bij: de meting is de meting, en waar hij en het ontwerp uiteenlopen is dat
een vraag en geen afrondingsfout.

De vertrouwenslaag hoort ook in Core en staat op de server: `gegevenspoort`,
`aipoort`, `verraad`, `vakbewijs`, `incidentcontrole`, `paspoort`, tussen de 1336
modules van `server/kern`. Een laag die overal wordt afgedwongen is geen tegel op
een beginscherm.

## De tweede laag

De acht domeinen van 11 augustus zijn niet weggegooid; ze zijn een niveau
gezakt.

```
LivingOS      Geld · Wonen · Sociaal · Media · Zorg · Cultuur · Winkel
WorkOS        Kantoor · Horeca · Handel · Personeel · Onderwijs · Bestuur
TravelOS      Vervoer · Verblijf · Onderweg · Aankomst
FoundationOS  Programma's · Veldwerk · Onderzoek · Fondsen
RTG Core      Identiteit · Toestand · Communicatie · AI · Betalen · Media
```

Wat een domein tot domein maakt en niet tot app, staat in `PLATFORM.md`: het
wereldpatroon met zijn vijf lagen (graaf, beleid, cockpit, gegronde Rahul,
actielog). **RTG Geld heeft die vorm als enige af** en is daarmee het
referentiemodel — niet als wereld, maar als domein binnen LivingOS.

Mobiliteit stond in de vorige kaart onder de persoonlijke wereld; het is hier
opgegaan in TravelOS. Identiteit stond er als domein; het is Core geworden.

## De canonieke hiërarchie

```
RTG → wereld → domein → capability → oppervlak → handeling
```

Bijvoorbeeld:

```
RTG → LivingOS     → Geld     → Bankieren  → Rekeningen → overboeken
RTG → WorkOS       → Horeca   → Kassa      → Bon        → terugboeken
RTG → TravelOS     → Verblijf → Reisboek   → Boeking    → wijzigen
RTG → FoundationOS → Veldwerk → Living Lab → Deelnemer  → aanmelden
```

`ADAPTIEF.md` en `GRAMMATICA.md` beschrijven de onderste twee treden al: een
**capability** declareert per apparaatvorm zijn presentatie, en per handeling zijn
gewicht. Die twee lagen staan; deze kaart zet er de bovenste vier op.

## Wat de vorige kaart fout had

Twee dingen, en ze zijn allebei pas met een telling zichtbaar geworden.

1. **"Fundament" was een omweg.** De bestuurskant van RTG kreeg een eigen wereld
   omdat er anders geen plek voor was. Maar RTG is gewoon een werkgever, en
   Backoffice en Boardroom zijn werkplekken. Zodra WorkOS twee toegangsmodellen
   mag dragen in plaats van één, verdwijnt de noodzaak van die derde wereld.
2. **De horizontale laag had geen naam.** Daardoor werd hij afwisselend in een
   wereld gestopt ("Identiteit" als domein) of als wereld voorgesteld ("de
   vertrouwenslaag"). Beide zijn fout, en de telling maakt duidelijk waarom: 24
   functies zitten in élke doelgroep. Iets dat overal is, hoort nergens.

Wat wél stand hield: de twee assen (pas ⟂ wereld) en de regel dat een wereld
nooit de naam van een pas draagt. Die regel is hier alleen aangescherpt.

## Wat er in de code staat, en wat nog niet

**Gedaan** (`public/apps/app-main/app-main-24a2.js`, `MAPPEN`):

- `ROS` → `LivingOS`, `RTG Kantoor` → `WorkOS`, `RTFoundation` → `FoundationOS`
- `TravelOS` toegevoegd als vierde wereld, met huis `/apps/reizen.html` en een
  eigen glyf. De elf reisonderdelen zijn uit LivingOS geknipt; geen item is
  nieuw en geen item is verdwenen.
- Het huis van TravelOS draagt die elf nu ook zelf. De bank geeft alleen een
  deur door en geen inhoud (`app-main-29c.js`), dus een wereld die zijn
  onderdelen niet op zijn eigen huis zet, heeft ze nergens.
- `PREMIUM` staat niet langer in hetzelfde bestand als `MAPPEN`
  (`app-main-24a3.js`). Dezelfde snede als deze kaart: waar iets is, tegenover
  wie het mag zien.
- De app `Living OS` heet nu **Het Vooruitzicht** en is de cockpit van LivingOS.
  Zie de paragraaf hieronder.
- **Instellingen** is ingericht: de vier identiteitsapps staan in het
  bedieningspaneel en hebben in `MAPPEN` een eigen ingang met `paneel` in plaats
  van `wereld`.
- **Het gezin is uit FoundationOS naar LivingOS gegaan.** Niet als
  bestandsverhuizing maar als deur: `os:rtf` (RTF Mini, Kids, Tiener, Jong,
  Volwassen) hangt nu in LivingOS, en FoundationOS wijst naar de publieke kant
  van de stichting (`os-publiek.html`, *"Wat wij doen, bij u in de buurt"*) met
  het partnerportaal ernaast. Gemeten: 62 van de 71 schermen onder
  `/apps/foundation/` gaan over het leven van een kind, negen over de stichting
  als organisatie. Niet `os.html`: dat is een kantoorconsole achter een
  kantoorcode, geen voordeur voor een lid.
- Drie bestanden gingen over de 10 KB en zijn gesplitst langs een echte grens:
  `app-main-26b` (tekenen) tegenover `app-main-26c` (openen en hernoemen), en
  `functies/toegang.js` (mag dit pad) tegenover `functies/doelgroep.js` (wie
  belt er).
- **WorkOS heeft één toegangsmodel gekregen**, en dat legde een gemeten fout
  bloot. Zie de paragraaf bij WorkOS hierboven.
- **De Rechterhand staat in het register**, zodat elke telling van wat een pas
  krijgt eindelijk klopt. Zie *De drie passen* hieronder.
- `test/beginscherm.test.js` telde nog hard op DRIE werelden, en die telling is
  nu vier. Dat getal staat er met opzet hard in: een vijfde wereld hoort een
  besluit te zijn dat je in dat bestand komt opschrijven, niet iets dat erbij
  sluipt.

Eén ding dat ik in de vorige versie van dit document verkeerd had staan: er stond
dat een map zonder `wereld` `openMap` zou breken. Dat is niet zo — `openMap` viel
al terug op een tegelveld. Het probleem was niet dat het brak maar dat het het
verkéérde deed: een tweede instellingenscherm naast het paneel dat er al was.

**Nog niet gedaan**, met de reden erbij:

- **De bestanden zelf staan nog onder `/apps/foundation/`.** De deur staat in de
  goede wereld, de map heet nog hoe hij heet. Dat is met opzet: die 62 schermen
  delen een service worker, een sessiemodel en `LEVEN.md`, en een mapnaam is geen
  merknaam (zie *Wat dit NIET verandert*).
- **Het huis van LivingOS loopt achter op zijn eigen wereld.** `/apps/rtg.html`
  toont nog een REIZEN-paneel en negen reiskaarten die nu bij TravelOS horen, en
  het toont Wie ben ik, Passkeys en Juridisch die nu bij Instellingen horen.
  RTFoundation is er wél bij gezet. Dat is een schermbesluit: welke domeinen
  LivingOS aan zijn voordeur toont is een ontwerpvraag, en die hoort niet als
  bijvangst van een kaart beantwoord te worden. Niets is onbereikbaar — het staat
  alleen op twee plekken.

## Wat dit NIET verandert

- **Geen scherm verhuist.** De elf reisonderdelen wisselen van wereld, maar
  blijven exact dezelfde schermen op exact dezelfde adressen.
- **Geen pas verandert.** `?pas=`, `PREMIUM` en de toonregels per pas blijven
  precies zoals ze zijn. Het register zegt nu wél wat de code al deed, maar er
  komt niemand bij en er gaat niemand af.
- **Geen huis verandert van naam.** RTG Kantoor, RTG Reizen en RTFoundation
  houden hun titel. Een huis is een merk, een wereld is een context.
- **Geen bestandsnaam wijzigt.** `shared/rosapps.js` en `rosthema.js` heten nog
  hoe ze heten; hun betekenis versmalt, hun naam niet.

## Wat er open blijft

- **De prijs zelf.** De ladder is nu wél te lezen (zie hieronder), maar wat een
  trede mag kosten staat er niet in. €65 tegenover €20.000 tegenover prijs op
  maat is een productbesluit.
- **Of WorkOS en RTG Kantoor twee namen voor hetzelfde zijn.** De bank zegt
  WorkOS, het huis zegt RTG Kantoor. Dat kan (context tegenover merk), maar het
  is een merkbesluit dat nog niet genomen is.
- **Het startscherm.** `WERELD.md` zegt: er is één beginscherm en dat is de lege
  werktafel. Vier werelden als eerste keuze zou dat vervangen. Eigen besluit.
- **De precieze domeinlijst per wereld.** De vijf regels hierboven zijn een eerste
  indeling op wat er in de code staat, geen uitputtende lijst.

## De drie passen, na twee reparaties

De vorige versie van dit document zei dat het verschil tussen de passen "geen
basis is voor €65 tegenover €20.000": Business had twee exclusieve functies,
Lifestyle nul. Dat klopte als meting en niet als conclusie — er waren twee dingen
kapot in het register, en allebei maakten de ladder onleesbaar.

**Eén: de Rechterhand stond nergens in het register.** De veertien apps van de
Lifestyle-suite (Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat,
Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties, Rendez-vous) worden
op de server gewoon afgedwongen — `routes/member/rechterhand.js` weigert iedereen
die geen Lifestyle of Business heeft. Maar hun paden vielen onder de generieke
functie `member`, en die draagt `rtg` en `gast`. Het bord zei dus dat een RTG-pas
dit heeft terwijl de route 403 gaf; elke telling las Lifestyle als nul; en de
enige knop die de suite kon raken was de knop die de hele ledenapp uitzet.

**Twee: de elf werkfuncties van WorkOS**, hierboven beschreven.

Beide zijn geen productwijziging maar een correctie: er komt niemand bij en er
gaat niemand af, het register zegt alleen wat de code al deed. Wat er daarna
staat:

| | functies | uniek | dat is |
|---|---:|---:|---|
| Gratis app | 44 | . | rondkijken, bestellen, Rahul |
| RTG Pass | 140 | . | het hele platform voor één mens |
| Lifestyle Pass | 143 | 3* | + De Rechterhand, RTG Zakelijk, Het Privékantoor |
| Business Pass | 157 | 14 | + WorkOS: de organisatie |

\* die drie zijn Lifestyle **en** Business: Lifestyle is een strikte deelverzameling
van Business. Er is geen enkele functie die alleen Lifestyle heeft, en dat is nu
een bewuste vorm en geen meetfout.

Daarmee is de ladder in één zin per trede te zeggen, en elke zin is na te rekenen
met `npm run groepen`:

- **RTG Pass** — het hele platform, voor jezelf.
- **Lifestyle Pass** — hetzelfde platform, maar er doet iemand het vóór je: de
  Rechterhand-suite, het zakelijke netwerk en het Privékantoor. Je koopt geen
  functies maar uitvoering.
- **Business Pass** — daarbovenop een hele wereld: WorkOS, met twaalf van de
  veertien exclusieve functies (werkvloer, werkplek, metier, vakritmes, verkoop,
  zaakdoos, facturen, kantoorgesprek, werkmail, RTG Mail, wervingslink,
  werkruimtes), plus Zakelijk bankieren en Instant Reality.

**Wat hier nog niet klopt:** de client houdt daarnaast een eigen `PREMIUM`-set
van veertien app-sleutels (`apps/app-main`, `premiumPas = lifestyle || business`)
die niets van het register weet en geen onderscheid maakt tussen Lifestyle en
Business. Twee lijsten met verschillende korrel, allebei over hetzelfde. Dat is
de volgende reparatie, en `scripts/groepen.js` legt ze tot die tijd naast elkaar
in plaats van te doen alsof er één is.

## Handhaving

`test/wereldregister.test.js` bewaakt wat machinaal te bewaken is:

- elk item in een wereld gaat ergens heen (fail-closed);
- geen item staat in twee werelden;
- geen wereld draagt de naam van een pas, **noch de stam ervan**;
- geen wereld draagt de naam van een **app uit de softwarecatalogus**;
- de werelden in `MAPPEN` zijn exact de werelden die dit document verklaart —
  drift tussen kaart en code laat de bouw zakken.

`scripts/check.js` regel 44 telt daarnaast dat elke app in precies één wereld
staat. `npm run groepen` schrijft `GROEPEN.md` uit de bron, zodat de tellingen in
dit document na te rekenen zijn in plaats van te geloven.

Wat op mensen berust: of een domein in de juiste wereld staat. Dat is een
oordeel, en het hoort hier te worden opgeschreven in plaats van in een tabel
verstopt te raken.

Wat nog steeds op mensen berust bij het NAAMGEVEN: er wordt nu tegen twee
lijsten getoetst (passen en softwarecatalogus), maar niet tegen de honderden
namen in `LINKS` en `OSAPPS`. Een wereld die straks zo heet als een app diep in
een andere wereld, komt er nog steeds doorheen. Dat is een bewuste grens: die
namen zijn niet allemaal merknamen, en een toets die op elk woord aanslaat leert
je zijn meldingen negeren.
