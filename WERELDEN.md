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
| **LivingOS** | `/apps/rtg.html` | mijn dagelijks leven | 42 |
| **WorkOS** | `/apps/kantoor.html` | mijn werk en organisaties | 10 |
| **TravelOS** | `/apps/reizen.html` | mijn reizen en onderweg zijn | 11 |
| **FoundationOS** | `/apps/foundation/index.html` | RTFoundation en haar maatschappelijke werk | 1 |

Die laatste kolom telt items in `MAPPEN` en geen schermen: FoundationOS draagt
één item dat naar een huis met 71 schermen leidt. De tabel wordt machinaal
vergeleken met de code, dus als hij niet meer klopt zakt de bouw.

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

In het functieregister staat die tweedeling vandaag nog als twee losse dingen:
`Werk OS (werkruimtes)` draagt `intern, business`, terwijl `De werkvloer`, `De
werkplek`, `Metier` en `Vakritmes` `leverancier, personeel` dragen. Een wereld
eroverheen ontkent dat verschil niet — **de commerciële verpakking zit binnen de
wereld**, niet eromheen.

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

## Instellingen — en waarom het geen wereld is

*Mijn account, identiteit, privacy en controle.*

Instellingen staat wel in de bank maar is geen wereld. Een wereld is een context
waar je in leeft; instellingen is de plek waar je aan het systeem zelf draait.
Het is preciezer om te zeggen wat het echt is:

> **Instellingen is het enige zichtbare gezicht van RTG Core.**

Mechanisch staat het vandaag in het bedieningspaneel in de voet van de bank
(`WERELD.md`), samen met thema, taal, push, meldingen, Zegel en uitloggen. De
vier identiteitsapps — Wie ben ik, RTG Veilig, Passkeys, Juridisch — staan nog in
LivingOS. Zie *Wat er nog niet gedaan is*.

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

**Nog niet gedaan**, met de reden erbij:

- **De levensschermen uit FoundationOS naar LivingOS.** Ongeveer 60 van de 71
  schermen onder `public/apps/foundation/` gaan over het leven van een kind en
  niet over de stichting. Dat is een echte verhuizing met een eigen service
  worker, een eigen sessiemodel en `LEVEN.md` eroverheen; hij hoort niet als
  bijvangst van een hernoeming te gebeuren.
- **De vier identiteitsapps naar Instellingen.** `link:ik`, `link:veilig`,
  `link:passkeys` en `link:juridisch` staan nog in LivingOS. Ze horen bij Core,
  en Core heeft in de bank precies één gezicht: het bedieningspaneel. Een map
  zonder `wereld` valt vandaag stil uit de bank maar breekt `openMap` in
  `app-main-29.js`; dat is eerst een kleine reparatie en daarna een verhuizing.
- **De werkvloer en de werkruimte onder één WorkOS-toegangsmodel.** Vandaag zijn
  het twee losse functiegroepen met verschillende doelgroepen. Ze samenvoegen
  raakt de prijs (zie hieronder) en is dus geen kaartbesluit.
- **Het huis van LivingOS toont de reisonderdelen nog steeds.** `/apps/rtg.html`
  heeft een REIZEN-paneel en een rij van negen reiskaarten onder "Alle
  diensten". Die staan er dubbel zolang TravelOS ze ook draagt. Dat is een
  schermbesluit: welke zes domeinen LivingOS aan zijn voordeur toont is een
  ontwerpvraag, en die hoort niet als bijvangst van een kaart beantwoord te
  worden.

## Wat dit NIET verandert

- **Geen scherm verhuist.** De elf reisonderdelen wisselen van wereld, maar
  blijven exact dezelfde schermen op exact dezelfde adressen.
- **Geen pas verandert.** `?pas=`, `PREMIUM` en de toonregels per pas blijven
  precies zoals ze zijn.
- **Geen huis verandert van naam.** RTG Kantoor, RTG Reizen en RTFoundation
  houden hun titel. Een huis is een merk, een wereld is een context.
- **Geen bestandsnaam wijzigt.** `shared/rosapps.js` en `rosthema.js` heten nog
  hoe ze heten; hun betekenis versmalt, hun naam niet.

## Wat er open blijft

- **Het prijsverschil tussen de passen.** Gemeten: Business draagt 145 functies,
  Lifestyle 142, RTG 140 — en er zijn **twee** functies die alleen Business heeft
  (Zakelijk bankieren, Instant Reality) en **nul** die alleen Lifestyle heeft. Dat
  is geen basis voor €65 tegenover €20.000. Het zakelijke aanbod moet waarde
  verkopen als organisatiebezit, beheer, personeel, workflows, governance,
  rechten, data, automatisering, SLA's, compliance en schaal — niet als drie
  extra tegels. Dat is een productvraag, geen kaartvraag, maar hij komt door deze
  indeling wel scherp boven.
- **`LivingOS` botst met een app die `Living OS` heet.** Dit is met een browser
  gevonden en niet met een grep: in de bank staat nu `LivingOS` onder
  *Werelden* en vier regels lager `Living OS` onder *Software*. Dat is
  `/apps/living-os.html` — *"geld, tijd, energie, mensen en beleving als een
  samenhangende wereld vooruit bekijken"* — genoemd op vijf plekken
  (`shared/command/catalog.js`, `apps/rtg.html`, `apps/private-office.html`,
  `apps/partner-network.html`, de appgids). Dezelfde botsing als LifeOS tegenover
  Lifestyle Pass, maar erger: dezelfde woorden, in dezelfde lijst, vier regels
  uit elkaar. Er is nog niets aan gedaan, want er zijn drie uitwegen en ze zijn
  geen van drieën vanzelfsprekend: de wereld hernoemen (maar die naam is bewust
  gekozen), de app hernoemen (maar naar wat), of de app opvatten als de
  **cockpit van LivingOS** en hem daarin laten opgaan — wat inhoudelijk het
  beste past, want dat is precies de vorm die `PLATFORM.md` van een wereld
  vraagt.
- **Of WorkOS en RTG Kantoor twee namen voor hetzelfde zijn.** De bank zegt
  WorkOS, het huis zegt RTG Kantoor. Dat kan (context tegenover merk), maar het
  is een merkbesluit dat nog niet genomen is.
- **Het startscherm.** `WERELD.md` zegt: er is één beginscherm en dat is de lege
  werktafel. Vier werelden als eerste keuze zou dat vervangen. Eigen besluit.
- **De precieze domeinlijst per wereld.** De vijf regels hierboven zijn een eerste
  indeling op wat er in de code staat, geen uitputtende lijst.

## Handhaving

`test/wereldregister.test.js` bewaakt wat machinaal te bewaken is:

- elk item in een wereld gaat ergens heen (fail-closed);
- geen item staat in twee werelden;
- geen wereld draagt de naam van een pas, **noch de stam ervan**;
- de werelden in `MAPPEN` zijn exact de werelden die dit document verklaart —
  drift tussen kaart en code laat de bouw zakken.

`scripts/check.js` regel 44 telt daarnaast dat elke app in precies één wereld
staat. `npm run groepen` schrijft `GROEPEN.md` uit de bron, zodat de tellingen in
dit document na te rekenen zijn in plaats van te geloven.

Wat op mensen berust: of een domein in de juiste wereld staat. Dat is een
oordeel, en het hoort hier te worden opgeschreven in plaats van in een tabel
verstopt te raken.

En wat geen enkele toets vandaag ziet: of een wereldnaam botst met de naam van
een APP. De pasnamen staan in een lijst en zijn dus te toetsen; de
softwarecatalogus (`shared/command/catalog.js`) staat naast `MAPPEN` en niemand
vergelijkt de twee. Daar is `Living OS` doorheen gekomen. Zodra dat besluit
gevallen is, hoort die vergelijking hier bij te komen — anders is de volgende
botsing weer een toevalstreffer.
