# RTG Ondernemerslus

*De lus die begint voordat iemand ondernemer is, en pas ophoudt als hij zijn
bedrijf overdraagt.*

Dit is een **richtingsdocument**, zoals `PLATFORM.md`, `ECONOMIE.md`, `HDI.md`
en `TRAVELCOMMERCE.md`: per onderdeel staat er of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is — zodat niemand die vier voor
elkaar aanziet. Wat hier staat is geen bouwopdracht maar een richting met een
meting eronder.

De kernregel:

> **De gebruiker hoeft steeds minder van ondernemen te weten, terwijl RTG steeds
> meer van de onderneming begrijpt.**

En de regel die daar direct onder hangt, want zonder haar is de eerste een
verkoopzin:

> **RTG maakt ondernemen niet makkelijker te documenteren. RTG verwijdert
> systematisch de vermijdbare fouten uit ondernemen.**

---

## 0. Wat er al staat, en waarom dit document geen nieuwe laag voorstelt

De grootste fout die hier te maken valt, is een `Entrepreneur Engine v2` naast
`kern/onderneming/`, `kern/concern/`, `kern/payroll/`, `routes/staff/`,
`kern/agent.js` en `kern/voorspel/`. Die fout heeft in dit huis een naam
(lat-regel 4: twee waarheden over hetzelfde) en een prijs die al een keer is
betaald — `kern/onderneming/index.js` bestaat juist omdat een bedrijf hier in
twee gedaanten leefde.

De inventaris is daarom het eerste hoofdstuk en niet het laatste:

| Station van de lus | Wat er staat | Waar |
|---|---|---|
| Ontdekken, leren | beroepenbieb, leerstof, knelpuntmotor met aanvoer | `kern/knelpunt/`, `kern/beroepenbieb/` |
| Starten | intake, kans, simulatie, stress, plan, rechtsvorm, oprichting, fase | `kern/onderneming/` (45 modules) |
| Toelating | vergunningbewijs voor 8 gereguleerde genres, besluit door een mens | `kern/aanmeldingen/bewijs.js` |
| Eerste klant | eersteklant, pijplijn, offertebouw, klussen, relaties | `kern/onderneming/` |
| Bedienen | de hele partner-app: kassa, agenda, voorraad, HACCP, vloot | `routes/supplier/` (992 routes) |
| Geld | kas, debiteuren, crediteuren, belastingreservering, facturatie, btw | `kern/onderneming/`, `kern/fiscaal/` |
| Werkgever | klok, rooster, verlof, verzuim zonder medische reden, vertrouwenspersoon | `routes/staff/`, `kern/payroll/` |
| Structureren | concern, entiteit, vestiging, merk, registratie, readiness, discovery | `kern/concern/` (53 routes) |
| Delegeren | machtiging mens-namens-mens, negen bevoegdheden met een grond | `kern/vertegenwoordiging/` |
| Besturen | voornemen, simulatie, transactie met terugweg, incident | `kern/command/` |
| Overdragen | overname, fusie, eigendomsverandering | `kern/concern/` |

Daar bovenop ligt al een bewijsruggengraat die dit document niet hoeft uit te
vinden: **`ONDERNEMERBEWIJS.json`** legt per ondernemer-capability twaalf
bewijslagen naast elkaar (bereikbaar, begrijpelijk, bedienbaar, voltooibaar,
waarheidsgetrouw, persistent, bevoegd, herstelbaar, uitlegbaar, omkeerbaar,
auditbaar, autonoom veilig). Zijn uitslag is streng en stuurt de hele
volgorde hieronder: **197 capabilities, 0 verkoopbaar**, en van de 20 verklaarde
ketens sluiten er **4**.

Het werk is dus aansluiten en bewijzen, niet bouwen.

---

## 1. De meting die het ontwerp stuurt

De dragende bewering van de opzet is dat die stations *"geen losse producten meer
zijn maar stations van dezelfde lus, waarbij RTG de context door alle fases heen
draagt"*. Dat is precies de vorm waarin `Asset`, `Koopbaar`, `Career`, `Moment`
en `Manier` hier alle vijf al sneuvelden, dus is het **gemeten** in plaats van
verklaard: `npm run ondernemerslus` → `ONDERNEMERSLUS.json`.

**Maar het is een andere vraag dan die vijf, en daarom een andere meter.** Die
vroegen of domeinen een *vorm* delen (dezelfde velden). Een lus hoeft dat niet: een
intake lijkt niet op een salarisrun en dat hoeft ook niet. Wat een lus tot lus
maakt is dat station 11 nog weet over welk bedrijf station 2 het had. Een
vormmeter kan dat niet zien; deze meter leent `objectmodel.js` dus met opzet
**niet** — die zou de verkeerde vraag heel nauwkeurig beantwoorden.

Drie assen, drie graden, nooit opgeteld:

| As | Wat | Bron | Graad |
|---|---|---|---|
| Deur | welke sessie opent dit station | `IDEMPROEF.json` | gemeten |
| Onderwerp | wie kent het ondernemingsobject | lexicaal | vermoed (ondergrens) |
| Proef | is dit station ooit als keten gelopen | `ONDERNEMERBEWIJS.json` | overgenomen |

### De uitslag

- **<!--getal:lus.stations-->12<!--/getal--> stations**, waarvan
  <!--getal:lus.stationsMetRoute-->11<!--/getal--> met routes.
- **3 rollen** dragen de lus (`member`, `office`, `supplier`) met
  <!--getal:lus.deurwissels-->8<!--/getal--> **deurwissels**.
- **`zaakZietOnderneming` = <!--getal:lus.zaakZietOnderneming-->0<!--/getal-->.**
- **<!--getal:lus.ketensZonderProef-->4<!--/getal--> van de 7 ketens** van de lus
  zijn nooit als keten gelopen.
- **1 station zonder enkele route**: *Proberen*.

### Wat die vier getallen betekenen

**1. De lus loopt één kant op.** `kern/onderneming` kent de zaak — hij heeft
`vanZaak` en `/api/onderneming/koppel`. Het omgekeerde is nul: geen enkel bestand
onder `routes/supplier/` of `routes/staff/` noemt de ondernemingscollectie **of
roept een toegang aan die het object teruggeeft** (`ondernemingVanZaak` voorop).
Die tweede helft telt sinds 14 september mee — zonder haar mat de meter juist de
vorm niet die de brug hoort te hebben; zie het kader hieronder. De
werkvloer weet niet dat hij een onderneming heeft. Dat is dezelfde vorm die
`scripts/ritmigratie.js` in de twee ritwerelden vond, en de reparatie daar
(`kern/mobiliteit/appbrug.js`) is hier het model — inclusief de regel die daar
geleerd is: **de brug loopt één kant op, want twee lijsten die elkaar bijwerken
hebben geen waarheid meer.**

**2. Acht deurwissels zijn geen defect.** Een kantoorbesluit *hoort* een andere
deur te hebben dan een ledenscherm; daarom staat er bij `deurwissels` met opzet
**geen ratel**. Wat het getal wel zegt is waar de context moet worden
doorgegeven in plaats van opnieuw opgebouwd. En de mens zelf is al één:
`kern/eenaccount.js` is de sleutelbos — elke rol is een *koppeling* aan het ene
account, nooit een tweede account. De continuïteit heeft dus al een huis. Het is
de **onderneming** die niet meereist, niet de mens.

**3. `Proberen` bestaat niet.** Er is geen enkele route waarmee iemand een idee
toetst zonder eerst iets op te richten. Dat is de gemeten vorm van Fase 0
hieronder — geen gevoel maar een leeg station.

**4. Vier ongelopen ketens**, met naam: `idee-inschrijving` (*"de hele
verkenningslaag van Ondernemers-OS is ongemeten"*), `offerte-factuur`,
`medewerker-dienst` en `tweede-vestiging`.

> **De meter kan zelf blind worden, en dat is twee keer gebeurd.** De eerste
> versie gooide bij een onleesbaar patroon, maar bij een *hernoemde* collectie
> las hij gewoon de nieuwe naam en meldde `0 kenners` — de duurste bevinding die
> hij kan doen, terwijl er niets aan de hand was. Er staat nu een ijking naast
> (`routes/member/onderneming.js` moet de collectie noemen) en drie
> besturingsproeven in `test/ondernemerslus.test.js`. *Een instrument dat niet
> kan uitslaan is geen instrument; een instrument dat zijn eigen blindheid als
> uitslag rapporteert is erger.*
>
> **De tweede blindheid zat in de proxy zelf, en die is verraderlijker.** De
> onderwerp-as telde alleen de COLLECTIENAAM — en dat is precies de vorm die een
> goede brug *niet* heeft: een route onder `routes/supplier/` hoort het object via
> `kern/onderneming` op te vragen en de collectie juist met rust te laten. De
> meter zou dus `0` zijn blijven melden terwijl de brug er lag. Hij telt nu ook de
> **toegangen**, afgeleid uit `kern/onderneming/index.js` zodat de lijst niet
> achterloopt. Twee dingen daarbij niet wegpoetsen. De verbreding tilde het totaal
> van 5 naar <!--getal:lus.kennersTotaal-->16<!--/getal--> kenners terwijl
> `zaakZietOnderneming` **op 0 bleef** — gemeten vóór er een letter aan de brug
> was geschreven, want een meter die zijn eigen ratel betaalt is geen meter. En de
> besturingsproef staat **apart per helft** (toets 6 op de collectie, toets 7 op de
> toegangen): haal de verbreding eruit en alleen 7 zakt. Eén gedeelde proef zou
> groen blijven terwijl precies de helft stilvalt waar het kopgetal vandaan moet
> komen.

---

## 2. Vijf namen die al bezet zijn

Dit huis betaalt voor naamsbotsingen (`VERMOGENS` op twee plekken met nul
gedeelde leden, `moment` zesvoudig, `Pulse`, `kluis`). Vandaar de check vooraf.

**`twin` is bezet, en vierdubbel.** `kern/bureau/twin.js` is de digitale
tweeling van een **woning**; `kern/levensdossier/velden.js` draagt `twin` als
veld met eigenaar `bureau`; `command/simulatie.js` heet in `KANTOORMACHT.md`
letterlijk de digitale tweeling; en — het scherpst — **`magnaat-partnerstudio`
bouwt al een speelbare digitale tweeling van een echt bedrijf**
(`kern/magnaat-partnerstudio-bedrijf.js`, met `B.tweeling(supplier)`). Een
"Business Twin" zou dus de vijfde betekenis van hetzelfde woord zijn, náást een
bestaande bedrijfstweeling. Wat er in plaats daarvan moet gebeuren, staat in
par. 4.

**`invariant` is bezet, en dat is goed nieuws.** Het woord staat in 22 bestanden
en op de belangrijkste plekken betekent het al precies wat de opzet bedoelt:
`kern/commercie/subsidie.js` en `vergoeding.js` dragen een invariant die geen
functie kan verzetten en waar een toets op een opgeslagen rij op afketst. Dit is
geen botsing maar een **precedent** — de Business Invariant is een uitbreiding
van een bestaand mechanisme en geen nieuw begrip.

**`fase` draagt al twee betekenissen** (`kern/onderneming/fase.js` = levensfase
van een bedrijf; `register/fasen.js` = uitrolfase van een functie). Een derde
betekenis erbij maakt "fase 3" onleesbaar. De stations in dit document heten
daarom **station** en nooit fase.

**`doel` draagt er al twee** (een levensdoel, en de AVG-doelbinding) — een
planner-doel heet `streefstand`, zoals `MACHINE.md` al vastlegt.

**`lus` is vrij genoeg** (123 bestanden, maar nergens als kernbegrip van een
laag) en sluit aan op `kern/service/loop.js`, waar hij hetzelfde betekent.

---

## 3. Station 0 — leren ondernemen zonder je nek uit te steken

**Staat: het leermateriaal. Ontbreekt: het experiment.**

De meting zegt het hard: `proberen` is het enige station zonder één route. Wat er
wél is, is meer dan je zou denken — `kern/beroepenbieb`, `kern/leerstof` (twee
miljoen procedureel opgebouwde leerpaden), de knelpuntmotor die zegt wat een weg
blokkeert, en `kern/knelpunt/aanvoer-opleiding.js` die daar echte opleidingen bij
levert.

En er is iets dat makkelijk over het hoofd wordt gezien: **Magnaat is het
leerspel voor ondernemen.** `CREATE.md` par. 9 zegt met zoveel woorden dat
Magnaat een leerspel voor mensen is en níét in de ontwikkelaarsroute hoort. Voor
*ondernemen leren* is het precies de goede plek, en de Partnerstudio bouwt al een
bevroren, speelbare tweeling van een echt bedrijf.

Wat ontbreekt is de brug van spel naar werkelijkheid: een **echt klein
experiment** (één product, twintig mogelijke klanten, een testbudget, dertig
dagen) waarvan de uitkomst bewaard blijft. En daar hangt meteen de scherpste
grens van dit hele station aan:

> **Onder de achttien wordt er niets van bewaard.** `server/kern/spellen/grens.js`
> (`progressieMag` → `volwassen()`) is niet onderhandelbaar: alles wat een
> prestatie bewaart buiten het potje bestaat alleen voor leden die de 18+-poort
> halen. Een scholier van zestien mag hier dus volledig oefenen, en er ontstaat
> geen dossier, geen ranglijst en geen ondernemersprofiel. Wie dat omdraait,
> bouwt precies het product dat `CARRIERE.md` verbiedt: een zoekbare lijst
> minderjarigen met afgeleide eigenschappen.

**Een stap weg:** het experiment als object, op de bestaande verkenningslaag
(`kern/onderneming/intake.js` draagt al *"wat we weten en wat ontbreekt"*).

**Vraagt een besluit:** of een experiment van een 16-jarige na zijn achttiende
mag worden *overgenomen* in zijn ondernemingsdossier. Dat is geen technische
vraag maar een toestemmingsvraag, en hij hoort vóór de bouw beantwoord.

---

## 4. Wat er in plaats van een Business Twin komt

**Vraagt een besluit — en de meting maakt het besluit goedkoper.**

De belofte ("een levende representatie van klanten, aanbod, prijzen, kosten,
personeel, capaciteit, leveranciers, voorraad, locaties, contracten, cash,
belasting, rechten, assets, risico's, verplichtingen en doelen") beschrijft
zeventien dingen die in dit huis allemaal al bestaan, in zeventien domeinen, met
zeventien eigen vormen. Een object dat ze alle zeventien draagt, duwt alles wat ze
onderscheidt naar een `extra`-veld — de `Asset`-fout, woordelijk.

De vorm die overleeft is dezelfde als vier keer eerder: een **projectie**, in de
vorm van `kern/levensgraaf/graaf.js` en `kern/commercie/rechten.js`. Niet een
tweede database naast de domeinen, maar een per aanroep samengestelde
doorsnede waarvan elk etiket zegt wie zijn bron is. `kern/onderneming/dagbeeld.js`
is daar al de helft van, en `kern/onderneming/meter.js` draagt de drie regels die
zo'n projectie eerlijk houden (niet gemeten is niet nul; onder de drempel geen
cijfer; de grondslag gaat mee).

Wat de projectie **niet** mag worden staat in `MACHINE.md` en `INT-04`: er komt
geen samengesteld gezondheidscijfer over het hele bedrijf. Eén getal verbergt
welke bron bewoog.

**Naam:** niet `twin` (vierdubbel bezet). De bestaande naam voor deze doorsnede
is er al — `ondernemingBeeld` — en die hoeft niet vervangen te worden.

---

## 5. Business Invariants — de laag die kan weigeren

**Een stap weg, en het meest waardevolle deel van het hele voorstel.**

Hier zit het scherpste onderscheid van dit document, en het is geen woordenspel:

> **Een bedrijfsregel is pas een invariant als hij kan weigeren.**

Dat is `LAT.md` regel 13 (*een belofte over een spoor is pas een regel als het
spoor kan weigeren*), verplaatst naar het ondernemersdomein. En het legt bloot
dat het meeste van wat de opzet vraagt **al bestaat als signaal en nog niet als
grendel**:

| Regel | Bestaat als | Ontbreekt als |
|---|---|---|
| Btw is niet vrij besteedbaar | `kern/onderneming/belasting.js` toont "zet dit opzij" | niets houdt een uitgave tegen |
| Een contract verloopt | `kern/onderneming/contracten.js` zet de klok | — (tonen is hier het juiste gedrag) |
| Een sollicitant wacht te lang | `kern/onderneming/werving.js` klokt de antwoordtijd | — |
| Marge onder de bodem | `kern/onderneming/offertebouw.js` bouwt de prijs op | geen weigering bij een marge van 3% |
| Geen betaling zonder bevoegdheid | `kern/pay/poort.js`, `kern/waarde/klassen.js` | **staat al als grendel** |
| Geen klantbelofte zonder capaciteit | `kern/onderneming/capaciteit.js` telt | geen koppeling aan bevestigen |
| Geen medewerker zonder geldige arbeidstoestand | `kern/persoonseis.js` **weigert al** (reikwijdte *werk* en *handeling*) | — |
| Geen toegang na een beëindigd contract | `kern/commercie/lidpoort.js` draait in de **schaduw** | houdt vandaag niemand tegen |

Twee dingen die deze tabel laat zien en die de opzet nog niet zei. Ten eerste:
**de helft staat er al**, en de goede helft — namelijk die waar geld en veiligheid
aan hangen. Ten tweede: de weg van signaal naar grendel is in dit huis al
uitgevonden en heet **schaduw** (`kern/commercie/schaduw.js`, `CONTROLPLANE.md`):
een nieuwe handhavingsregel loopt eerst mee zónder te blokkeren, want *je kunt
niet afdwingen wat nooit in de schaduw heeft gelopen*. `kern/commercie/lidpoort.js`
doet dat vandaag, met twee aparte schaduwregels omdat *een afgelopen afspraak
afdwingen* en *elk lid zonder vastgelegde afspraak buitensluiten* twee besluiten
zijn.

Daar hoort één grens bij die niet mag sneuvelen:

> **Een invariant die weigert, zegt altijd hoe het wél kan.** Dat is de vorm van
> `kern/economie/firewall.js` en van `GRAMMATICA.md` (*een verhindering draagt
> altijd een reden*). Een grijze knop zonder uitleg is hier geen veiligheid maar
> een gebrek.

En één die er tegenin gaat: **`ONBEKEND` is geen `WEIGEREN`**
(`CONTROLPLANE.md`). Een invariant die niet kan meten of hij geschonden is, mag
niet blokkeren alsof hij dat wel wist — een storing hoort niet te klinken als een
overtreding.

---

## 6. Founder Dependency — de correctie die dit document moet maken

**Vraagt een besluit, en het antwoord is nee in deze vorm.**

*"47% van betalingen vraagt nog jouw goedkeuring. Jij bent eigenaar van 23
processen."* Het doel erachter is juist en belangrijk: een gezond bedrijf hoort
niet permanent van zijn oprichter af te hangen. Maar in deze vorm is het **een
cijfer op een mens**, en dat is de scherpste grens die dit huis heeft — hij staat
in `KANTOORMACHT.md`, `HDI.md`, `ONTMOETEN.md`, `INT-04`, `LIFE.md` en
`CARRIERE.md` (CAR-05), telkens met dezelfde formulering: *de meeteenheid is
nooit de mens, ook niet intern als sorteersleutel.*

De uitweg is dezelfde als bij het Career Ledger en bij de programmameting van
`CARRIERE.md`: **meet één niveau omhoog, op het proces.**

| Botst | Mag wel |
|---|---|
| "jij bent voor 47% een knelpunt" | "23 processen hebben één goedkeurder" |
| een afhankelijkheidsscore per persoon | een lijst processen zonder tweede tekenbevoegde |
| een ranglijst van managers | "deze zeven processen kunnen binnen bestaand mandaat gedelegeerd worden" |

Het verschil is niet cosmetisch. *Wat een proces nodig heeft* is een feit over de
inrichting van een bedrijf; *hoe afhankelijk iemand is* is een oordeel over een
mens, en het is precies het soort getal dat later in een beoordelingsgesprek
belandt. Dezelfde regel als in `STAGE.md`: **de meeteenheid is de gebeurtenis en
nooit de mens.**

De delegatiekant staat trouwens al, en verrassend volledig:
`kern/vertegenwoordiging/` draagt de machtiging mens-namens-mens met zeven regels
in code (versmallen is een doorsnede, leeg is dicht, de lijst is gesloten op
negen bevoegdheden, verval is berekend, aanvaarden doet de cliënt). Wat er voor
dit station bij moet is geen nieuw model maar een **lezer**: welke processen
zouden binnen een bestaand mandaat passen. En let op de grens die er al staat —
`publiceren` staat bewust **niet** in die negen, dus "een manager mag publiceren"
is een besluit en geen bouwtaak.

---

## 7. De Staff Care Loop

**Een stap weg voor de organisatiekant, en het gat dat ik in par. 3 van de
inventaris noemde.**

Wat er staat is ethisch sterker dan bij de meeste HR-software, en het moet
letterlijk blijven zoals het is:

- **De vertrouwenspersoon** (`routes/staff/dienst-vertrouwen.js`) — apart bestand,
  met in de kop dat wat een medewerker daar schrijft *niet* bij zijn werkgever
  komt: niet in de state, niet in een melding, niet in een overzicht.
- **Fluister voor de vloer** — eigen assistent, eigen geheugen, nooit gedeeld.
- **Ziekmelden zonder reden-veld** (`kern/payroll/verzuim.js`) — er is geen veld
  voor wat iemand heeft, *want een veld dat er is wordt gevuld*, en een
  toelichting levert een harde 422.
- **De werkgever kan alleen dichtzetten** (`kern/lidboard/werkbeleid.js`) — er ís
  geen endpoint om iets open te zetten, en tijdens een pauze binnen het budget
  vervalt het bedrijfsbeleid op de pas van de medewerker.
- **De grens in code** (`kern/zorgniveau.js`) — lifestyle, professioneel,
  klinisch; geen model kan hem wegpraten, en hij is *een vloer en geen filter*.

Het gat zit op twee plekken.

**Persoonlijk: de dagcheck-in hangt aan de verkeerde sessie.**
`kern/gemoed.js` (stemming, geen score, geen streaks, verlaat het account niet)
draait op `auth` — de **leden**sessie. Personeel komt binnen op `supplierAuth`.
Een medewerker die geen RTG-lid is, kan er dus niet bij. Dat is een deur, geen
architectuur: de laag is al privé per sessiesleutel.

**Organisatorisch: er is geen enkel werkdruksignaal.** En dat is precies de helft
die *wel* mag, mits hij de goede kant op gemeten wordt:

> **Persoonlijk welzijn blijft persoonlijk. Een organisatieprobleem wordt een
> organisatiesignaal.**

Nooit: *"deze medewerker voelt zich somber."* Wel: *"de sluitdiensten zijn zes
weken achtereen onevenredig over drie mensen verdeeld."* Dat tweede is te meten
uit gegevens die er al liggen — `db.data.klok`, het weekrooster, verlof — en het
raakt geen enkel gezondheidsgegeven. Vier grenzen erbij:

1. **De meeteenheid is het rooster, niet de mens.** Een teller per persoon mag
   bestaan om een verdeling uit te rekenen en gaat daarna weg; er komt geen
   belastbaarheidsprofiel en geen sorteerbare lijst.
2. **Een signaal gaat over een patroon, nooit over een dag.** Eén late dienst is
   geen bevinding; zes weken scheve verdeling wel.
3. **Wat niet gemeten is, wordt geen getal** — dezelfde regel als in
   `HORECA.md` en `KOSTEN.md`.
4. **Geen escalatie zonder de mens.** De vertrouwenslijn blijft de enige weg naar
   buiten, en die loopt langs RTG en niet langs de werkgever.

---

## 8. Autonomous Backoffice — wat het getal zegt

**Jaren weg, en niet uit voorzichtigheid maar uit rekenkunde.**

*"Vandaag automatisch afgehandeld: 71 zaken. Jouw beslissing nodig: 3."* De
richting is goed en het huis heeft er de vorm al voor: `kern/frictie/motor.js`
rekent per geval uit of iets `hand`, `assist` of `auto` mag, en
`kern/stuur/beleid.js` laat een capability zonder bewijs uit de lijst vallen
waaruit de AI kiest.

Maar de bewijspoort waar dat idee op leunt, houdt vandaag niets tegen, en dat is
gemeten en niet gevoeld:

- `VERTROUWEN.json`: **0 bewezen routes.**
- `ONDERNEMERBEWIJS.json`: **0 van 197** ondernemer-capabilities verkoopbaar; de
  laag `autonoomVeilig` staat op 0 groen en 197 onbekend.
- `INTELLIGENTIE.md` par. 3.5: **91 van de 115 AI-schrijfpaden hebben geen bekende
  terugweg** — de autonomieformule is voor 79% niet uit te rekenen.
- `ONDERNEMERSLUS.json`: 4 van de 7 ketens van de lus zijn nooit gelopen.

Een backoffice die zelfstandig 71 dingen afhandelt boven nul bewezen routes,
handelt niet autonoom maar onbewaakt. De volgorde is daarom omgekeerd aan de
aantrekkelijkheid: **eerst de vier ketens lopen, dan de bewijslagen groen, dan
autonomie** — en `MAGNAATLAB.md` heeft daar de rail al voor
(`server/betaal/synthetisch.js`, een simulatie-adapter die *de rail vervangt en
nooit de poort*).

Wat wél nu kan: **exception-only management** (par. 9 van de opzet) vraagt geen
autonomie. Het is een presentatievraag, en `ONTWERP.md` noemt
uitzonderingsgestuurd ontwerpen al als principe. *"183 salarissen normaal, 2
wijken af"* is te bouwen op bestaande meetwaarden, zolang "normaal" een gemeten
uitspraak is en geen stilzwijgen — *een leeg vak wordt gevuld met iemands eigen
indruk* (`SERVICE.md` par. 12).

---

## 9. One truth, many projections

**Staat, als doctrine — en dat is hier de vondst.**

De opzet stelt voor dat een vestigingsmanager, een CFO, een CEO, een raad en een
eigenaar dezelfde waarheid in verschillende projecties zien, zonder aparte
managementdatabases. Dat is in dit huis geen nieuw idee maar een bestaande regel:
`TRAVELCOMMERCE.md` legt hem al vast — *zes partijen kijken naar dezelfde reis en
geen van hen ziet hetzelfde; er is één werkelijkheid en er zijn zes projecties* —
en `kern/commercie/rechten.js` doet het al (nominaal náást effectief, en met opzet
uitsluitend lezend).

Wat dit document toevoegt is dat de ondernemerskant dezelfde regel krijgt, met de
grens die er in `KANTOORMACHT.md` bij hoort: **de laag die iets toont, meet het
niet** — anders zeggen twee schermen op een dag iets anders over hetzelfde.

---

## 10. World / Future / Counterfactual / Verified

**Staat grotendeels, onder andere namen — en let op de zesde ladder.**

| Voorgesteld | Bestaat als |
|---|---|
| World State | `kern/stuur/gevolg.js` (36 gemeten, 44 geen-effect, 96 onbekend) |
| Future State | `kern/voorspel/`, `kern/kosten/vooruitblik.js` |
| Counterfactual | `kern/command/simulatie.js`, `kern/onderneming/simulatie.js` |
| Verified Action | `kern/command/transactie-poorten.js` (*een controle die niet kon draaien is niet geslaagd*) |

De bewaking die de opzet terecht vraagt — *een model kan denken dat iets gedaan is
terwijl alleen tekst is gegenereerd* — bestaat al en heet `kern/envelop.js` met
`correlatie` en `oorzaak`, plus `HANDELINGPROEF.json` dat meet of een geslaagde
oproep een geketende spoorregel naliet.

**Maar `bedacht → voorgesteld → geautoriseerd → uitgevoerd → bevestigd` mag geen
zesde gezagsladder worden.** `GEZAGSNOEMER.json` telt er al vijf met 21 treden op
vier noemertreden, en `EXECUTIE.md` par. 4 heeft die vraag al een keer beslist:
*wat de machine mag is een vraag, hoe ver hij mag gaan is een tweede.* Deze vijf
woorden beschrijven de **levensloop van één handeling** en niet het gezag erover
— dat is een andere as, en zo hoort hij ook te heten, anders staat er over een
half jaar een zesde vocabulaire waarin `uitgevoerd` iets anders betekent dan in de
vijf die er al zijn.

---

## 11. Rahul als orkestrator

**Staat in de schaduw.** `kern/ai/router.js` kiest al tussen vijf technieken in
volgorde — regels, algoritme, optimalisatie, voorspelling, ai — met een register
van motoren die aantoonbaar bestaan, en een uitslag die altijd een techniek én een
reden draagt. Hij beslist vandaag met opzet niets: hij *meet* hoe vaak een
goedkopere techniek het gedekt zou hebben, want een matig regelantwoord dat een
goed modelantwoord verdringt merkt niemand.

De vondst die dat opende staat er hardop bij: **de volgorde staat vandaag
omgekeerd** — `demoantwoorden.js` levert al regelantwoorden maar staat in
`kern/ai.js` ná het model. En de ontbrekende techniek staat er ook: er is **geen
constraint solver**; `kern/agent.js` roostert op weekdagfactoren, en dat is een
heuristiek.

"Geen model gebruiken als normale code betrouwbaarder is" is hier dus geen nieuw
principe maar een bestaande meter die op een besluit wacht.

---

## 12. Confidential computing

**Jaren weg, en het is een hostingbesluit en geen bouwtaak.**

De richting past bij dit huis (`RTG_EXTERNE_AI_UIT=1` sluit externe modellen hard
af; `CODE.md` besluit dat een bronfragment alleen naar een lokaal model gaat; de
identiteitskluis staat los van de operationele data). Maar attestation vraagt een
omgeving die RTG vandaag niet kiest, en zonder die keuze is elke belofte erover
een verkoopzin. Het hoort daarom in dit document te staan als wat het is: een
**besluit van de eigenaar over waar dit draait**, met als eerlijke tussenstand dat
de gevoeligste context vandaag al niet naar buiten gaat.

---

## 13. De grenzen die niet mogen sneuvelen

1. **De meeteenheid is nooit de mens.** Geen Founder Dependency per persoon, geen
   belastbaarheidsprofiel, geen ranglijst van managers of medewerkers — ook niet
   intern als sorteersleutel.
2. **Een bedrijfsregel is pas een invariant als hij kan weigeren**, en een
   weigering zegt altijd hoe het wél kan. `ONBEKEND` weigert niet.
3. **Persoonlijk welzijn blijft persoonlijk; een organisatieprobleem wordt een
   organisatiesignaal.** De werkgever leest nooit een gemoedstoestand.
4. **Onder de achttien wordt er niets bewaard.** Leren ondernemen mag volledig;
   een dossier ontstaat niet.
5. **De projectie is nooit een bron.** Wie het bedrijfsbeeld met de hand kan
   bijwerken, heeft een tweede waarheid gemaakt.
6. **Geen samengesteld gezondheidscijfer** over een bedrijf of een mens. Elk getal
   draagt zijn opbouw, en niet gemeten is niet nul.
7. **Geld verlaat het huis nooit vanzelf**, en een pas toekennen blijft mensenwerk
   — `magAutomatischToekennen` geeft voor geen enkele pas `true`, en dat verandert
   geen enkel station van deze lus.
8. **De brug loopt één kant op.** Twee lijsten die elkaar bijwerken hebben geen
   waarheid meer.

---

## 14. Volgorde

Niet op aantrekkelijkheid maar op wat de volgende stap mogelijk maakt. De eerste
twee kosten samen weinig en maken de rest meetbaar.

| # | Stap | Waarom nu | Kost |
|---|---|---|---|
| 1 | De dagcheck-in ook op de personeelssessie | een deur, geen architectuur; sluit het grootste gat in par. 7 | klein |
| 2 | `zaakZietOnderneming` van 0 naar 1 | zonder de terugverwijzing is elke volgende station-overgang handwerk | klein |
| 3 | De keten `idee-inschrijving` lopen | de hele verkenningslaag is ongemeten; dit is station 1 t/m 3 | middel |
| 4 | Het werkdruksignaal op rooster en klok | raakt geen gezondheidsgegeven, en is de helft die wél mag | middel |
| 5 | Twee invarianten uit par. 5 in de **schaduw** zetten | je kunt niet afdwingen wat nooit in de schaduw liep | middel |
| 6 | Station *Proberen* als experiment-object | vraagt eerst het besluit uit par. 3 | groot |
| 7 | De processenlezer op `vertegenwoordiging` | par. 6, en alleen in de procesvorm | groot |

Wat er **niet** in staat: een Business Twin, een autonome backoffice en een
Economic Graph. Die eerste is par. 4 (een projectie, geen object), de tweede
wacht op een gemeten getal dat vandaag nul is, en de derde bestaat al half onder
drie andere namen (`kern/geldgraaf/`, `kern/concern/graaf.js`,
`kern/levensgraaf/`) — die drie horen eerst naast elkaar gelegd te worden vóór er
een vierde bij komt. Dat is een eigen meting en geen bijzin.

---

*Gemeten op 14 september 2026. De getallen in par. 1 komen uit
`ONDERNEMERSLUS.json` (`npm run ondernemerslus`), die in par. 0 en 8 uit
`ONDERNEMERBEWIJS.json` en `VERTROUWEN.json`. Wie ze citeert, leest eerst hun
stempel.*
