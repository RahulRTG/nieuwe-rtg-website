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

De uitvoerbare contracten, projections, Action Broker en Evidence-laag die deze
kaart inmiddels dragen staan in [`EXPERIENCE.md`](EXPERIENCE.md). Dit document
blijft eigenaar van de indeling; `EXPERIENCE.md` van de werkende platformnaad.

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

### De twee regels die daaruit volgen

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

En de tweede, genomen op 19 augustus 2026:

> **Een wereld en zijn huis houden elk hun eigen naam.**
>
> De bank zegt WorkOS, het huis zegt RTG Kantoor. Dat is geen seam die nog
> dichtgemaakt moet worden maar het onderscheid zelf: **een wereld is een
> context, een huis is een merk.** WorkOS is waar je bent; RTG Kantoor is wat je
> opent. Zo ook TravelOS naast RTG Reizen, en FoundationOS naast RTFoundation.
>
> Het alternatief is geprobeerd en valt om op de vierde wereld: RTFoundation is
> een publieke merknaam die 30% van de bijdragen draagt (`CLAUDE.md`) en die je
> niet kunt hernoemen omdat een tegel anders heet. Eén regel die op drie van de
> vier werkt, is geen regel.
>
> Wat je ervoor accepteert: de tegel heet anders dan de titelbalk erachter. Dat
> is de prijs, en hij is bewust betaald.

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
| **LivingOS** | `/apps/rtg.html` | mijn dagelijks leven | 50 |
| **WorkOS** | `/apps/kantoor.html` | mijn werk en organisaties | 13 |
| **TravelOS** | `/apps/reizen.html` | mijn reizen en onderweg zijn | 11 |
| **FoundationOS** | `/apps/foundation/os-publiek.html` | RTFoundation en haar maatschappelijke werk | 2 |

Die laatste kolom telt items in `MAPPEN` en geen schermen. De tabel wordt
machinaal vergeleken met de code, dus als hij niet meer klopt zakt de bouw.

**Wat er precies in elke wereld hangt staat in [`WERELDLIJST.md`](WERELDLIJST.md)**
— alle 76 onderdelen met hun adres, uit `MAPPEN` geschreven door
`npm run wereldlijst`. Dit document zegt *waarom* de werelden zo lopen; die lijst
zegt *wat* erin zit, en regel 50 van `scripts/check.js` houdt de twee gelijk.

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

## Er is geen lijst ernaast

De bank van de werktafel had twee kopjes: **Werelden** en daaronder **Software**.
Die tweede droeg twaalf apps uit `shared/command/catalog.js`, en negen ervan
hingen in geen enkele wereld — ze bestonden alleen in die rij.

Dat is precies de vraag die deze kaart wil afschaffen. Een lid moest bij elk ding
twee dingen weten: in welke wereld het hoort, en zo niet, of het dan in de lijst
ernaast staat. Zolang beide lijsten zichtbaar waren viel dat niemand op; het was
alleen een tweede voorraadkast naast de eerste.

> **Een app hoort in de context waarin een mens hem gebruikt, of nergens.**

Uitgevoerd met de contextvraag, en niet met wie hem gebouwd heeft:

| app | wereld | waarom |
|---|---|---|
| Vandaag | LivingOS | de dagbriefing van één mens |
| Leven | LivingOS | zijn levenslijn |
| Sociaal | LivingOS | zijn mensen |
| Geld | LivingOS | zijn geld |
| Media | LivingOS | zijn vrije tijd |
| Het Vooruitzicht | LivingOS | de cockpit van die wereld (hing er al) |
| Privékantoor | LivingOS | zaken die persoonlijk oordeel vragen |
| Horeca | WorkOS | een zaak besturen |
| Partner Network | WorkOS | bedrijven die samenwerken |
| Reizen & Veilig | TravelOS | hing er al |
| Gastdossier | TravelOS | hing er al |

**De catalogus zelf blijft.** Hij is ook Rahuls routeertabel (`appUit` — *"toon
het gastdossier"*) en de bron van werkbladtitels (`titelVan`); wie hem leeghaalt
sloopt allebei. Hij tekent alleen geen bank-sectie meer.

Er zat één stille fout onder: `/apps/rtg.html` — het huis van LivingOS — droeg in
zijn eigen zijbalk exact diezelfde twaalf, met twee verkeerde adressen. "Vandaag"
wees naar `/apps/app.html` (de werktafel, waar de topbar ook al heen ging) terwijl
er een Vandaag-app bestaat, en "Private Office" wees naar `/apps/lifestyle.html`,
dat Het Privékantoor is. Twee schermen met bijna dezelfde naam, allebei echt.
Beide staan er nu onder hun eigen naam.

*Handhaving:* `test/wereldregister.test.js` — elke app uit de catalogus hangt in
een wereld, vergeleken op adres en niet op naam.

## De twee dubbele paren

*Besloten en uitgevoerd op 19 augustus 2026.*

Vier schermen beloofden twee dingen. **Het Vooruitzicht** en **Instant Reality**
rekenden allebei één intentie door naar drie werelden en twee beslissingen, met
dezelfde Kyoto-reis als voorbeeld. **Private Office** en **Het Privékantoor**
waren allebei een rustige directietafel voor zaken die een handtekening vragen.
Een lid dat de bank opende, moest bij elk paar raden welke van de twee de echte
was.

Het besluit was: **één scherm per paar, de ander gaat erin op, en wereld en huis
houden elk hun eigen naam.** Bij het uitvoeren bleek de mechaniek per paar
tegengesteld te liggen, en dat is de moeite waard om vast te leggen — want het
antwoord op *welke van de twee blijft staan* volgde niet uit de naam maar uit de
meting.

| paar | blijft | wat de ander had |
|---|---|---|
| Het Vooruitzicht ← Instant Reality | de vorm | **de motor** |
| Het Privékantoor ← Private Office | de motor | de vorm |

- **Het Vooruitzicht was het decor.** `living-os.js` (2,6 KB) deed geen enkele
  `/api/`-aanroep: drie werelden in een object, een `setWorld()` en een
  trefwoordvergelijking. Instant Reality had wél de motor —
  `server/kern/instant-reality.js` met versies, idempotente sleutels, een 409 op
  een verlopen beeld en een statusladder die pas *gereed* zegt als een provider
  dat bevestigt, plus drie toetsen. Het gekozen scherm opslokken zou dus een
  werkende capability in een maquette hebben gestopt. De motor is daarom
  *hierheen gehaald*: `living-os.js` praat nu met `/api/instant-reality`, en het
  tweede scherm is weg. `server/routes/instant-reality.js`,
  `server/kern/instant-reality.js` en `test/instant-reality.test.js` blijven; het
  pad houdt zijn naam omdat een bestaande API hernoemen meer kost dan het
  oplevert.
- **Bij het Privékantoor lag het andersom.** `private-office.js` (2,5 KB) deed
  ook geen enkele aanroep; het Privékantoor draait op
  `server/kern/lifestyle/` en `server/kern/bureau/` met een levensgraaf, een
  Control Tower, cases met een echt team en een mandaatschuif. De richting klopte
  daar dus meteen.

**Wat er meekwam, en wat niet.** Van Instant Reality: de statusladder, de
Decision Compression (16 → 2), het Delta Event met *simuleer +6 uur*, het
bewerkbare intentieveld en de One Reality-regel. Van Private Office: de Council
— maar niet als zes vaste stemmen met een vast advies over een verzonnen reis.
Dat was decor. De gedachte erachter (*voordat u tekent hoort u te zien wie eraan
gewerkt heeft*) is er wél, en staat nu op de werkelijke bezetting van uw zaak
(`server/kern/bureau/cases.js`, `teamVoor`). Zit er niemand op, dan staat er
niets: een lege raad is eerlijker dan een verzonnen unanimiteit. De Continuity
Vault kwam mee als de lijst die er al lag — *dit blijft van u* boven het
mandaatlogboek.

**En één gebrek dat pas bij het samenvoegen zichtbaar werd.** De vijf knoppen in
de balk van Het Vooruitzicht waren nergens aan gebonden. Op bureaumaat viel dat
niet op — de drie panelen staan daar naast elkaar — maar op telefoonmaat toont
dat scherm er precies één, en waren *intent* en *beslissingen* dus onbereikbaar.
Dat is exact wat `ADAPTIEF.md` verbiedt: **verbergen bestaat niet.** De balk kiest
nu het paneel op een telefoon en schuift het in beeld op een bureau, en de
beslissende actie staat in het wereldpaneel zelf — het enige paneel dat een
telefoon standaard toont.

*Handhaving:* `test/wereldregister.test.js` (elke app uit de catalogus hangt in
een wereld, vergeleken op adres) en `test/wereldbreedte.e2e.js` (het scherm past
op 390px, toont daar zijn hoofdwereld met een raakbare hoofdactie, en elk van de
vijf balkknoppen levert werkelijk een zichtbaar paneel op).

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
- **Het huis van LivingOS draagt alleen nog LivingOS.** `/apps/rtg.html` had
  standen Reizen en Veilig, een reiskaart bovenaan, negen reisapps onder "Alle
  diensten" en de drie identiteitsapps. Die horen nu in TravelOS en in
  Instellingen, en beide zijn vanuit de bank op elk scherm te bereiken. Het
  reisdossier blijft er wél staan: dat is geen deur maar een briefing over je
  eigen leven, net als Vandaag. De regel die daaruit volgt: **een huis houdt zijn
  eigen domeinen en zijn briefings, en laat de deuren naar andere werelden aan de
  bank.**
- **De schuldlijst van `test/beginscherm.test.js` is leeg.** Daar stonden vier
  apps die in WorkOS hingen terwijl `/apps/kantoor.html` er nergens naar wees:
  Onderneming, Loonstrook, Browser en Sitemaker. Ze waren alleen te bereiken door
  het adres met de hand in te typen. Ze staan nu op het huis.
- **De Software-rij in de bank is weg.** Onder de werelden stond een tweede
  kopje met twaalf apps uit `shared/command/catalog.js` — Vandaag, Instant
  Reality, Private Office, Het Vooruitzicht, Partner Network, Reizen & Veilig,
  Leven, Geld, Sociaal, Media, Horeca, Gastdossier. Negen daarvan hingen in geen
  enkele wereld. Ze staan nu waar ze horen: zeven in LivingOS, twee in WorkOS,
  drie hingen al in TravelOS of LivingOS. Twee van die twaalf bestaan sindsdien
  niet meer als eigen scherm — zie *De twee dubbele paren* hieronder. Zie ook
  *Er is geen lijst ernaast* hieronder.
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

- **Het bedrag per trede.** *Waar* de prijs aan hangt is besloten (zie *De drie
  passen* hieronder); wat een trede mag kosten staat nergens in de code en is
  een productbesluit. Voor Lifestyle hangt daar een vraag aan die niet kan
  wachten, en die is 19 augustus 2026 nagemeten: **er is geen capaciteitsmodel.**
  `server/kern/lifestyle/` en `server/kern/bureau/` kennen verzoeken, zaken, een
  team per zaak en een mandaatschuif, maar nergens staat wie er beschikbaar is,
  hoeveel zaken één Rechterhand kan dragen, of wat er gebeurt als er meer
  binnenkomt dan er uit kan. `cases-soorten.js` draagt wel het label *Staf &
  planning*, maar dat is een soort zaak en geen bezetting. Als de prijs
  uitvoering koopt, is dat het eerste dat gebouwd moet worden — niet omdat het
  document dat zegt, maar omdat de belofte anders alleen op papier staat.
- **De domeinnamen per wereld.** Dit punt is voor de helft dicht. *Welke
  onderdelen* in welke wereld hangen staat nu voluit in **`WERELDLIJST.md`**,
  gegenereerd uit `MAPPEN` met `npm run wereldlijst` en bewaakt door regel 50 van
  `scripts/check.js`: verhuist er iets, dan wordt de keuring rood tot het
  document bij is. Wat er *niet* in staat is de laag ertussen — welke onderdelen
  samen "het huishouden" heten of "zorg en gezin". Die namen staan nergens in de
  code, en ze uit de bestandsnamen afleiden zou een indeling opleveren die
  stelliger klinkt dan wat het huis werkelijk weet. Dat is een ontwerpbesluit.

## Wat er dicht is gegaan

- **Het startscherm.** Hier stond: *"`WERELD.md` zegt: er is één beginscherm en
  dat is de lege werktafel. Vier werelden als eerste keuze zou dat vervangen."*
  Dat is geen keuze meer maar de gemeten stand: de werktafel **is** het
  beginscherm, en de vier werelden zijn wat er op die tafel te kiezen valt — ze
  staan bovenaan de bank en de lege tafel zegt letterlijk *"Kies een wereld om te
  beginnen."* Ze vervangen elkaar dus niet; de een is het meubel en de ander de
  inhoud. Wat er sinds 19 augustus wél veranderde staat in `WERELD.md`: inloggen
  komt terug waar je gebleven was, en alleen Home en het sluiten van je laatste
  blad eindigen nog leeg.

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
  werkruimtes), plus Zakelijk bankieren en de scenariolaag achter Het
  Vooruitzicht.

### En waar de prijs dan aan hangt

Besloten op 19 augustus 2026, en het volgt uit de meting hierboven in plaats van
uit een tarievenlijst:

| trede | de prijs hangt aan |
|---|---|
| RTG Pass | het platform zelf, per mens |
| Lifestyle Pass | **uitvoering** — er doet iemand het vóór je |
| Business Pass | **schaal** — per organisatie, per vestiging, per medewerker |

Waarom niet op functies: de meting zegt dat Lifestyle er drie meer heeft dan RTG
Pass. Drie functies dragen geen factor driehonderd in prijs, en het alternatief —
functies wéghalen bij RTG Pass om ruimte te maken — botst frontaal met de eerste
merkregel uit `CLAUDE.md`: *premium, ook aan de onderkant.* De instap mag nooit
budget aanvoelen, dus hij mag ook niet uitgekleed worden om een hogere trede te
rechtvaardigen.

Waarom uitvoering wél werkt voor Lifestyle: de suite heet niet toevallig **De
Rechterhand**. Wat je koopt is niet een tegel maar dat iemand het regelt, en dat
is uit te leggen zonder één extra functie te beloven — precies wat de AI-regel in
`CLAUDE.md` ook vraagt, want die verbiedt de assistent om toegang toe te zeggen.

**Wat daar meteen aan vastzit:** als de prijs uitvoering koopt, moet er
capaciteit tegenover staan. Die planning bestaat nog niet, en zonder haar is
"uitvoering" een belofte in plaats van een product. Dat is de eerste bouwvraag
van deze trede, niet een detail eronder.

**En de tweede lijst kent de eerste nu.** De client houdt een eigen
`PREMIUM`-set van veertien app-sleutels (`apps/app-main`, `premiumPas =
lifestyle || business`) om diezelfde apps bij een RTG-pas uit de mappen en uit
Spotlight te houden. Die lijst wist niets van het register: er kon een app
bijkomen die de server weigert en de client toont — een tegel die 403 geeft — of
andersom. De veertien sleutels staan nu als `apps` op de functie `rechterhand`
in het register, en `test/wereldregister.test.js` legt ze naast de client. Wie er
een vijftiende bij zet, zet hem op beide plekken of de bouw zakt.

Wat nog wél verschilt is de **korrel**, en dat is geen slordigheid: de server
schakelt op functie en per doelgroep, de client verbergt apps en kent geen
verschil tussen Lifestyle en Business. Ze delen de inhoud, niet de vorm.

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
