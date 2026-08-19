# De kaart — drie werelden, en de pas die er dwars op staat

Vastgelegd 19 augustus 2026. Dit document neemt het besluit dat `PLATFORM.md`
par. 3 sinds 11 augustus openhield: welke werelden er zijn en hoe ze zich tot
elkaar verhouden. `PLATFORM.md` blijft waar de volgorde van bouwen staat, dit is
waar de indeling staat.

**Er is nog geen scherm verhuisd.** Dit is een kaart, geen migratie. Wat er
vandaag draait, draait morgen precies hetzelfde; wat hier verandert is waar we
zeggen dat het hoort, en welke regels dat afdwingbaar maken.

## De twee assen

De vorige kaarten liepen vast op één verwarring, en die is de moeite waard om
bovenaan te zetten: **pas en wereld zijn twee loodrechte assen.**

| | zegt | waarden |
|---|---|---|
| **pas** | wie je bent, en wat je mag zien | `rtg` · `lifestyle` · `business` |
| **wereld** | waar je bent, en wat je aan het doen bent | `ROS` · `Concern` · `Fundament` |

De pas is in de code geen etiket maar een dimensie: `?pas=` herbouwt de hele
ledenapp (`app-main-02.js`: *"Dan wordt dit DE app van die pas"*), en `PREMIUM`
sluit veertien onderdelen af achter `lifestyle` of `business`. Elke wereld moet
daarom voor alle drie de passen werken — dat is de belofte die in `MAPPEN` al
staat: *"Zo blijft RTG voor elke pas compleet ogen."*

> ### De regel
> **Een wereld draagt nooit de naam van een pas.**
>
> Vallen die woorden samen, dan leest een lid een plek als een prijs. Een
> RTG-Pass-houder met een horecazaak hoort thuis in de wereld waar je een zaak
> bestuurt — maar zou "Business" lezen als *"dat is die dure pas, niet voor mij"*.
> Daarom heet die wereld hier Concern en niet Business.
>
> *Handhaving:* `test/wereldregister.test.js`.

## De drie werelden

### ROS — de wereld van de persoon

*Alles wat van mij is en wat ik in mijn dagelijks leven doe.*

ROS betekende tot nu toe het hele ledenplatform (`README.md`: *"De app is een
besturingssysteem (het ROS)"*, en `shared/rosapps.js` heet de canonieke lijst
ROS-apps). **Die betekenis versmalt hier**: ROS is de wereld van de persoon, niet
de koepel over alles. Wat een lid voor zijn onderneming doet, hoort in Concern.

Anker: `apps/rtg.html` — en, tot de kaart is uitgevoerd, ook wat er vandaag onder
`map-rtg` hangt.

### Concern — de wereld van de organisatie

*Hier bestuur ik mijn onderneming.*

`CONCERN.md` beschreef deze wereld al voordat hij een wereld heette: het *Company
Launch & Workforce OS*, van bedrijfsnaam of idee naar een ingericht concern, met
als kern dat **één bedrijf niet één KvK is**. Kantoor is daarin een capability en
geen wereld; Horeca ook niet — dat is een domein met vierentwintig standen.

Ankers die er al staan: `apps/concern.html`, `apps/kantoor.html`,
`apps/horeca.html` (24 standen), `apps/handel.html`, `apps/onderneming.html`,
`apps/magnaat.html`, `apps/loonstrook.html`, plus `apps/office/` (25),
`apps/personeel/` (31), `apps/leverancier/` (105), `apps/rtgschool/`,
`apps/schoolpartner/`, `apps/werk/`.

### Fundament — de wereld waar RTG zelf draait

*Hier wordt bepaald waarom RTG betrouwbaar mag handelen.*

Dit is met opzet **niet** "de vertrouwenslaag als wereld". Dat kan niet: van de
258 schermen gaan er elf over identiteit, vertrouwen of bewijs, en vier daarvan
zijn juridische documenten. De vertrouwenslaag zelf woont op de server —
`gegevenspoort`, `aipoort`, `verraad`, `vakbewijs`, `incidentcontrole`,
`paspoort`, tussen de 1336 modules van `server/kern` — en wordt **overal**
afgedwongen. Een laag die overal geldt, is geen tegel op een startscherm.

Wat wél een wereld is, is het publiek dat die laag bedient: de bestuurskant van
RTG. Ankers: `apps/backoffice.html` (+ `apps/backoffice/`), `apps/boardroom.html`
(+ `apps/boardroom/`), `apps/meldkamer.html`, `apps/techniek.html`,
`apps/defensie.html`, `apps/dispatch.html`.

**En daarom niet "Foundation".** `RTFoundation` bestaat al en betekent iets heel
anders: de stichting die 30% van de bijdragen naar liefdadigheid brengt
(`CLAUDE.md`), en een Life OS dat een mens vanaf de geboorte begeleidt
(`LEVEN.md`) — 71 schermen, een eigen service worker, een eigen huis. Die hoort
in ROS. Twee Foundations in één huis, waarvan één een publieke belofte draagt,
is het soort naamconflict dat je jaren blijft uitleggen.

## De tweede laag

De acht van 11 augustus zijn niet weggegooid; ze zijn een niveau gezakt. Dat is
de winst van deze kaart: er hoefde niets te sneuvelen.

```
ROS         Geld · Wonen · Mobiliteit · Reizen · Sociaal · Media · Zorg · Identiteit
Concern     Kantoor · Horeca · Handel · Personeel · Onderwijs
Fundament   Toezicht · Bewijs · Beleid · Platform
```

Wat een domein tot domein maakt en niet tot app, staat in `PLATFORM.md`: het
wereldpatroon met zijn vijf lagen (graaf, beleid, cockpit, gegronde Rahul,
actielog). **RTG Geld heeft die vorm als enige af** en is daarmee het
referentiemodel voor de rest — niet als wereld, maar als domein binnen ROS.

## De canonieke hiërarchie

```
RTG → wereld → domein → capability → oppervlak → handeling
```

Bijvoorbeeld:

```
RTG → ROS       → Geld     → Bankieren   → Rekeningen → overboeken
RTG → Concern   → Horeca   → Kassa       → Bon        → terugboeken
RTG → Fundament → Bewijs   → Controls    → money.refund.order.v1 → bewijsstuk
```

`ADAPTIEF.md` en `GRAMMATICA.md` beschrijven de onderste twee treden al:
een **capability** declareert per apparaatvorm zijn presentatie, en per handeling
zijn gewicht. Die twee lagen staan dus, en deze kaart zet er de bovenste drie op.

## Wat dit NIET verandert

- **Geen scherm verhuist.** `MAPPEN` houdt zijn drie ingangen en al zijn items.
  Wat er wél verandert is één woord: de eerste wereld heet niet langer `RTG` maar
  `ROS`, want `rtg` is de naam van de instappas. Het huis (`/apps/rtg.html`) en de
  glyf houden hun naam.
- **Geen pas verandert.** `?pas=`, `PREMIUM` en de toonregels per pas blijven
  precies zoals ze zijn.
- **Geen naam in de code wijzigt.** `shared/rosapps.js` en `rosthema.js` heten
  nog hoe ze heten; hun betekenis versmalt, hun bestandsnaam niet.

## Wat er open blijft

- **Waar de grens tussen ROS en Concern precies loopt.** Een lid met een
  horecazaak opent vandaag alles vanuit dezelfde app. Wordt Concern een eigen
  wereld, dan moet hij daar vanuit de ledenapp bij kunnen — en dat is een
  navigatievraag die nog niet beantwoord is.
- **Of Business Pass méér ziet in Concern, of dat Concern voor iedereen met een
  zaak hetzelfde is.** Dat is een productvraag en geen kaartvraag, maar hij komt
  door deze indeling wel boven.
- **Het startscherm.** `WERELD.md` zegt: er is één beginscherm en dat is de lege
  werktafel. Drie grote werelden als eerste keuze zou dat vervangen. Dat is een
  eigen besluit en geen bijvangst van deze kaart.
- **De precieze domeinlijst per wereld.** De drie regels hierboven zijn een eerste
  indeling op wat er in de code staat, niet een uitputtende lijst.

## Handhaving

`test/wereldregister.test.js` bewaakt wat machinaal te bewaken is: dat elk item
in een wereld ergens heen gaat (fail-closed), dat geen item in twee werelden
staat, en dat **geen wereld de naam van een pas draagt**.

Wat op mensen berust: of een domein in de juiste wereld staat. Dat is een
oordeel, en het hoort hier te worden opgeschreven in plaats van in een tabel
verstopt te raken.
