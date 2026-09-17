# RTG Planning — de tijd- en capaciteitslaag

Een richtingsdocument zoals `PLATFORM.md` en `ECONOMIE.md`: per onderdeel staat
erbij of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren
weg** is, zodat niemand die vier voor elkaar aanziet.

Het voorstel dat eraan ten grondslag ligt, in één zin: *roosteren mag binnen RTG
geen personeelsfunctie zijn maar een universele tijd- en capaciteitsmotor* — niet
`medewerker + dienst` als basiseenheid maar `resource + tijd + plaats +
activiteit + capaciteit + regels`, waaronder de bestaande planners
domeinadapters worden. Eén motor voor een zzp'er die alleen zichzelf plant, een
kapsalon met drie mensen, een restaurant met tachtig en een beveiligingsbedrijf
met honderden.

---

## 0. De meting die vooraf gaat

**Dit is de vijfde keer dat dit huis deze belofte krijgt.** `Asset`, `Koopbaar`,
`Career`, `Moment` en `Manier` waren alle vijf "één type over veel domeinen", en
vier van de vijf sneuvelden op de meting. `DEVELOPERCLOUD.md` par. 2 zegt waarom:
*een universeel objectmodel moet worden GEVONDEN in de domeinen, niet eroverheen
verklaard.* Dus is het eerst gemeten.

`npm run planvorm` (`PLANVORM.json`) draait op de lezer van
`scripts/objectmodel.js` — dezelfde als bij alle voorgangers, want een tweede
parser maakt de vergelijking waardeloos. Twee assen die **nooit worden
opgeteld**, want een samengesteld cijfer verbergt welke van de twee beweegt
(INT-04):

- **DE VORM** — delen de plandomeinen VELDEN? Dat is de `Asset`-vraag.
- **DE LUS** — voert een domein de negen stations van de voorgestelde keten uit?

En twee domeinlijsten, ruim en smal, want `scripts/carrierevorm.js` sloeg op een
versmalling om van 0 naar 8 gedeelde velden: *een uitslag die op de domeinlijst
drijft, is geen uitslag.*

### De uitslag

Over <!--getal:planvorm.domeinen-->7<!--/getal--> plandomeinen (horeca,
beveiliging, festival, taxi, ov, verblijf, school):

| | velden | in álle domeinen | in de helft | in precies één |
|---|---|---|---|---|
| ruim | <!--getal:planvorm.velden-->269<!--/getal--> | <!--getal:planvorm.inAlle-->0<!--/getal--> | 0 | <!--getal:planvorm.domeineigenPct-->91.8<!--/getal--> % |
| smal | <!--getal:planvorm.smalVelden-->48<!--/getal--> | 0 | 0 | <!--getal:planvorm.smalDomeineigenPct-->97.9<!--/getal--> % |

Platformbreed is 70,4 % van de velden domeineigen (`OBJECTMODEL.json`, 1441 van
2046). **De plandomeinen zijn dus mínder verwant dan een willekeurige doorsnede
van dit huis** — en ze staan in de band van hun vier voorgangers: Carrière 88,2 ·
Stage 88,1 · Connect 87,9 · Aanvoer 93,8.

Op de lus-as: <!--getal:planvorm.lusRond-->0<!--/getal--> van zeven domeinen
maakt de lus rond, <!--getal:planvorm.stationsInAlle-->0<!--/getal--> van negen
stations staat in álle domeinen, en er zijn
<!--getal:planvorm.combinaties-->7<!--/getal--> verschillende combinaties over
evenveel domeinen — elk plandomein doet het dus anders.

Het meest verwante paar is taxi ↔ ov: vijf gedeelde velden, overlap 0,063. Klein,
en het is het enige dat er is.

### Het getal dat het product stuurt

**`reistijd` staat op <!--getal:planvorm.reistijd-->0<!--/getal--> van zeven.**
Geen enkel plandomein definieert reistijd, transitietijd of afstand als
planprimitief; `haversine` woont in `lib/geo.js` en wordt alleen geconsumeerd.

Die nul is met een mutatie nagetrokken (een `reistijdTussen()` in
`server/kern/mobiliteit/` zette hem op 1 en weghalen weer op 0), dus het is een
vondst en geen dode tak — de les van de `rooms`-cap, die er groen uitzag omdat
een toets hem met verzonnen invoer voedde.

En het is precies de naad die deze laag vult. Het is het enige station dat álle
voorbeelden uit het voorstel delen: de fotograaf die om 11:00 onderweg is, het
schoonmaakteam van locatie A naar locatie B, de taxi, de beveiliger die tussen
posten loopt. **Een zzp'er heeft geen bezettingsgraad nodig; hij heeft
transitietijd nodig.**

---

## 1. Wat er vandaag staat

Zeven planners, geen gedeelde laag. Ze zijn geen probleem dat opgeruimd moet
worden — ze zijn het bronmateriaal waaruit de gedeelde begrippen moeten komen.

| Domein | Waar | Wat het kan |
|---|---|---|
| Algemeen weekrooster | `kern/personeel.js` (`scheduleFor`) | drie standen (ochtend, avond, vrij); een vastgesteld rooster wint van het patroon |
| AI-roostervoorstel | `kern/agent.js` (`roosterVoorstel`, `roosterBeslis`) | plant op verwachte drukte per dag; de manager keurt goed, past aan of wijst af |
| Beveiliging | `kern/beveiliging/rooster/` | posten × shifts, budgetbewaking tegen het contract, autoplanner met rust en eerlijke urenverdeling |
| Festival | `kern/festival/dienst.js` | niemand staat op twee plekken tegelijk; de medewerker leest alleen zijn eigen dienst |
| Taxi | `kern/mobiliteit/cdt*.js` | arbeids-, rij- en rusttijden als data mét bron, instelbaar per regime |
| OV | `kern/ov/dienst.js` | de dienst van chauffeur, machinist of schipper in de PDA |
| School | `server/school/klas.js` | het lesrooster, met een signaal aan de directie bij een klas zonder rooster |

Daarnaast het pendelrooster (`kern/mobiliteit/pendel-rooster.js`) en de
kamerplanning van het hotel (`kern/verblijf/receptie.js` — die plant kamers en
geen mensen).

**Twee dingen die eruitzien als een planner en het niet zijn.**
`/api/supplier/shift` is een dienstOVERDRACHT en geen planning, en
`kern/opvang.js` kent `DIENSTEN` als opvangSOORTEN (dagopvang, BSO) en niet als
ploegen. Ze staan hier zodat niemand ze nog eens meetelt.

---

## 2. De vorm die overleeft

Een verplichte basiseenheid als OBJECT is door de meting niet gerechtvaardigd. Er
komt dus **geen `resources`-tabel en geen `roosters`-tabel**.

Wat wél overleeft is de vorm die dit huis al vier keer heeft gekozen:

1. een **verklaring van werkwoorden** (`COMMERCE.md`, `Koopbaar`) — de grond
   verklaart wat een plandomein kan aanbieden, en dwingt geen methodes af;
2. boven een **projectie met etiketten** (`kern/levensgraaf/graaf.js`) — het
   plandomein stelt zijn eigen behoefte samen, de grond rekent en **bezit
   niets**.

Dat is ook wat het voorstel zelf al zei: *de planner hoeft niet te weten wat een
hotel of restaurant is; de domeinsoftware vertaalt gebeurtenissen naar planbare
behoefte.* De architectuurintuïtie klopt. Alleen de basiseenheid mag geen rij
worden.

De toetsvraag bij elk nieuw stuk is daarmee: **rekent dit, of bezit dit?** Wat
bezit, hoort in het domein.

---

## 3. Namen die al bezet zijn

Gemeten, niet aangenomen. Dit huis is hier vaker op gestruikeld dan op wat ook.

| Naam | Bezet door | Waarom dat botst |
|---|---|---|
| `plan` | `kern/stuur/plan.js` (`EXECUTIE.md` blok 3) | bestaat al als PLAN-object, maar over **capabilities** — welke API-stappen mag ik ketenen — en niet over tijd en mensen. Twee betekenissen op de centrale naam van een laag is de `VERMOGENS`-botsing |
| `beschikbaarheid` | `kern/beschikbaar.js` | dating-beschikbaarheid: eenentwintig dagdeel-hokjes, en met zoveel woorden *geen* kalender ("geen datum, geen tijdstip"). De tegenovergestelde betekenis van wat een planner nodig heeft |
| `SOORTEN` | 51 domeinen, **49 betekenissen** (`SEMANTIEK.json`) | het ergste woord van het huis. Een `activiteitsoort`-lijst komt daar bovenop |
| `simulatie` | `kern/command/simulatie.js`, `kern/onderneming/simulatie.js` | twee bestaande betekenissen; een derde maakt het onleesbaar |
| `mandaat` | `kern/stuur/mandaat.js` | **dit is geen botsing maar een geschenk** — zie hieronder |

`resource` is lexicaal vrij (nul treffers in `server/kern` en `server/routes`),
maar het is Engels in een Nederlands huis, en par. 5 zegt waarom juist dat woord
hier gevaarlijk is.

**Het mandaat is al gebouwd.** Wat het voorstel vraagt — vooraf mandaat geven
voor bepaalde soorten wijzigingen — staat in `kern/stuur/mandaat.js` als
grammatica, met twee regels die precies passen: *een mandaat verleent nooit
vermogen, het VERSMALT alleen bestaand vermogen*, en *leeg is dicht*. Er komt
geen tweede; deze laag sluit erop aan.

---

## 4. De verklaarde lege plek

`kern/ai/router.js` routeert vandaag al de woorden `rooster`, `inplannen` en
`bezetting` naar de techniek `optimalisatie` — en zegt er in zijn `ONTBREEKT`-lijst
bij:

> er is geen constraint solver in dit huis. `kern/agent.js` maakt
> roostervoorstellen op weekdagfactoren — een heuristiek, geen optimizer. Een
> rooster met contracturen, beschikbaarheid en cao-grenzen is zelfstandig werk en
> hoort in het roosterdomein.

"Plan volgende week" wordt dus nu al gerouteerd naar een motor die niet bestaat,
op een plek die het huis zelf heeft aangewezen. Deze laag hoeft daarvoor geen
nieuwe vocabulaire te bedenken; er ligt een gereserveerd gat met een naam.

---

## 5. De grenzen die niet mogen sneuvelen

**1. Een mens is geen resource.** Het woord maakt van een mens hetzelfde type als
een bus en een machine, en een optimizer die resources rangschikt op geschiktheid
produceert per definitie een cijfer op een mens — ook intern als sorteersleutel.
Die grens staat in vier documenten (CAR-05, `HDI.md`, `KANTOORMACHT.md`,
`ONDERNEMEN.md` par. 13.1).

De uitweg staat al in de beste planner van dit huis:
`kern/beveiliging/rooster/aanvragen.js` sorteert kandidaten op **de minste uren
deze maand**. Dat is sorteren op wat iemand TOEKOMT, niet op wat hij waard is —
en dat is de vorm die de gedeelde grond moet erven. *Sorteren op aanspraak, nooit
op geschiktheid.*

**2. Een mens-resource draagt wat een bus niet draagt.** Een pauzerecht dat de
werkgever niet mag meten (`kern/lidboard/werkbeleid.js` telt pauzeMINUTEN en met
opzet niet wat iemand erin doet), een ziekmelding zonder reden-veld
(`kern/payroll/verzuim.js`), en een vertrouwenslijn die de werkgever nooit ziet.
Een planner die die drie als gewone "constraints" inleest, is precies de plek
waar ze sneuvelen.

**3. De grond bezit niets.** Wie de planningsgrond een eigen waarheid over
mensen, diensten of klanten laat bewaren, heeft een tweede administratie gemaakt.
Zij krijgt een behoefte en geeft een uitkomst terug.

**4. Wat niet gemeten is, wordt geen getal.** Dezelfde regel als in `HORECA.md`
en `KOSTEN.md`. Een bezettingsvoorspelling zonder gemeten trefzekerheid draagt
geen percentage (`kern/kosten/vooruitblik.js` is de vorm).

**5. Een voorstel is geen besluit.** `kern/agent.js` doet dit al goed: de AI
stelt een weekrooster voor, de gemachtigde keurt goed, past aan of wijst af. Dat
blijft zo, hoe goed de optimizer ook wordt.

**6. Drie plannen naast elkaar tonen mag pas als de gevolgen gemeten zijn.**
`kern/stuur/gevolg.js` staat op 96 van 176 paden `onbekend`. Drie toekomsten
tonen boven gevolgen die voor meer dan de helft ongemeten zijn, is drie
verzinsels tonen — en `onbekend` is nadrukkelijk geen `geen-effect`.

**7. Geen samengesteld plancijfer.** Een plan draagt zijn opbouw in woorden, niet
één score waar "kosten", "continuïteit" en "ruimte" in verdwijnen. Dat is INT-04,
en het is dezelfde reden waarom de mixer in `CONNECT.md` plekken verdeelt in
plaats van punten.

---

## 6. Per onderdeel

### Staat

- **Zeven werkende planners** (par. 1), elk met domeinkennis die niet weggegooid
  hoeft te worden.
- **De rekenkant van de Arbeidstijdenwet**, als data met een bron en instelbaar
  per regime: `kern/mobiliteit/cdt-tijden.js`. De enige plandomeinmodule die al
  een deelbare vorm ín zich heeft.
- **Eerlijk verdelen zonder score**: de autoplanner van de beveiliging.
- **De mandaatgrammatica**: `kern/stuur/mandaat.js`.
- **Verzuim dat de planning bedient zonder een gezondheidsgegeven prijs te
  geven**: `/api/supplier/verzuim/planning` levert "afwezig" plus wat iemand nog
  kan, en nooit wat hij heeft.

### Een stap weg

- **Verlof en ziekte laten meewegen in de twee autoplanners.** Dit is vandaag een
  echt gebrek en geen toekomstmuziek: géén roostermotor leest verzuim, dus een
  zieke medewerker kan gewoon worden ingepland. De gegevens liggen er al.
- **Het werkdruksignaal op rooster en klok** (`ONDERNEMEN.md` par. 7, stap 4,
  open). Nooit *"deze medewerker voelt zich somber"*, wel *"de sluitdiensten zijn
  zes weken onevenredig over drie mensen verdeeld"* — te meten uit `db.data.klok`,
  het weekrooster en verlof, en het raakt geen enkel gezondheidsgegeven.
- **De ATW-rekenlaag uit taxi trekken** naar een gedeelde plek, zodat een
  horeca- of beveiligingsmedewerker dezelfde bewaking krijgt. Vandaag geldt die
  alleen voor het taxivervoer.

### Vraagt een besluit

- **Transitietijd als eerste gedeelde primitief.** Het staat op nul en het is het
  enige dat alle plandomeinen én alle voorbeelden uit het voorstel delen. Waar
  hoort het te wonen, en wie mag het vullen?
- **De naam van de laag**, gegeven par. 3. `plan`, `beschikbaarheid` en
  `simulatie` zijn bezet; een codenaam en een schermnaam hoeven niet hetzelfde te
  zijn.
- **Of de optimizer het gereserveerde gat in `kern/ai/router.js` invult**, en
  onder welke techniek hij daar wordt aangemeld.

### Jaren weg

- **De constraint solver zelf**, met contracturen, beschikbaarheid en
  cao-grenzen. Dat is zelfstandig werk, en het huis zegt dat zelf al.
- **Plan A / B / C met gevolgen**, om de reden in grens 6.
- **Continu herplannen op een gebeurtenis** (iemand valt uit, een reservering
  komt binnen) — dat vraagt eerst een effectgraaf die niet voor de helft
  `onbekend` is.

---

## 7. De volgorde

Niet op aantrekkelijkheid maar op wat de volgende stap mogelijk maakt.

| # | Stap | Waarom nu |
|---|---|---|
| 1 | Verlof en ziekte in de twee autoplanners | het enige dat vandaag écht fout kan gaan in een echt rooster |
| 2 | Transitietijd als primitief | staat op nul, en is het enige dat alle domeinen delen |
| 3 | De ATW-rekenlaag uit taxi trekken | hij is al data-met-bron en al instelbaar per regime |
| 4 | Het werkdruksignaal op rooster en klok | raakt geen gezondheidsgegeven, en is de helft die wél mag |
| 5 | De verklaring van werkwoorden | pas zinvol als 1 t/m 3 hebben laten zien wat er werkelijk gedeeld wordt |

Simulatie en optimizer staan er met opzet niet in: die wachten op grens 6.

---

## 8. Wat dit document niet zegt

De meting waar par. 0 op rust heeft een blinde vlek die in het register zelf
staat: de lezer van `scripts/objectmodel.js` kijkt alleen in `server/kern`,
`server/bedrijf`, `server/school` en `server/papieren`. **Een planner die in een
route woont, is voor deze meter onzichtbaar** — dat is geen nul maar een gat.

De lus-as is lexicaal over gedefinieerde symboolnamen en dus een ONDERgrens,
graad `vermoed`. Daarom hangt de conclusie van par. 2 aan de vorm-as en niet aan
de lus.

En de meting zegt dat planning geen OBJECT is. Zij zegt niet dat er niet gepland
wordt, en al helemaal niet dat het niet beter kan — dat is de vraag van een
ketenproef, en die is voor deze laag nog niet gelopen.
