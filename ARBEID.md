# RTG Arbeid — het Work Kernel-voorstel, gemeten

Een richtingsdocument zoals `PLANNING.md` en `ECONOMIE.md`: per onderdeel staat
erbij of het **staat**, **een stap weg** is, **een besluit vraagt**, **jaren weg**
is of **botst** met een grens die dit huis al heeft, zodat niemand die vijf voor
elkaar aanziet.

Het voorstel in één zin: *bouw geen 150 recruitmentfeatures maar een RTG Work
Kernel van vijftien primitives (Identity, Organization, Capability, Opportunity,
Evidence, Consent, Authority, Relationship, Work, Agreement, Event, Policy,
Workflow, Agent, Audit), en laat Talent & Hiring daarop de eerste volledige
verticale implementatie worden.* Daaronder hangen 48 genummerde onderdelen (103
tot en met 150) en een openingszin die het hele voorstel draagt: *niet "je bent
ongeschikt", maar "voor deze opportunity ontbreekt één aantoonbare vaardigheid,
en dit zijn de routes om die te verkrijgen".*

De aanleiding was een vergelijking met een wervingsbureau (vier pagina's van een
bureau dat vrouwelijk talent in SaaS en tech plaatst). Wat zo'n bureau verkoopt is
*wij vinden talent voor je*; een ATS verkoopt *wij beheren je sollicitanten*; een
HR-suite *wij beheren je werknemers*. Het voorstel wil iets breders: *RTG begrijpt
welke arbeid nodig is, welke vaardigheden er zijn, welke ontbreken, hoe ze
ontwikkeld of gevonden kunnen worden, en hoe een kans aantoonbaar werk wordt.*
Die richting is goed. Dit document gaat over de VORM.

Gemeten op 23 september 2026: acht lezers over acht clusters, elk gevolgd door
een tweede lezer die de eerste probeerde te weerleggen. Samen weerlegden die
tweede lezers 86 beweringen van de eersten. Wat hieronder staat is wat overbleef.

---

## 0. De meting die vooraf gaat

**Dit huis kreeg deze belofte al minstens acht keer.** `Asset`, `Koopbaar`,
`Career`, `Moment`, `Manier`, de planningsgrond uit `PLANNING.md`, de
ontdekkingslaag uit `CONNECT.md` en de Representation Engine uit
`REPRESENTATIE.md` waren allemaal *één kern, veel composities*, en geen van de
acht overleefde als OBJECT. `DEVELOPERCLOUD.md` par. 2 zegt waarom: *een universeel objectmodel moet worden GEVONDEN in de
domeinen, niet eroverheen verklaard.*

De vorm-as is daarom eerst gemeten, met de lezer van `scripts/objectmodel.js`
(dezelfde als bij alle voorgangers; een tweede parser maakt de vergelijking
waardeloos) over twee domeinlijsten, want `scripts/carrierevorm.js` sloeg op een
versmalling om van 0 naar 8.

| Lijst | Domeinen | Velden | In álle domeinen | In de helft | In precies één |
|---|---|---|---|---|---|
| ruim (met de wervingsroutes) | 18 | 309 | **0** | 0 | **88,3%** |
| smal | 8 | 143 | **0** | 0 | **95,8%** |
| mutatie: alleen `bedrijf` + `kern/tenant` | 2 | 126 | 7 | — | — |

De mutatie bewoog, dus de meter kan uitslaan. Het sterkste paar van het hele
werkdomein is `bedrijf` ↔ `kern/tenant` met zeven velden; het tweede is
`bedrijf` ↔ `kern/concern` met vier. Platformbreed ligt het aandeel
domeineigen velden rond 71%: **de werkdomeinen zijn MÍNDER verwant dan een
willekeurige doorsnede van dit huis.**

Een tweede as, de werkwoorden (met `werkwoorden()` uit `scripts/namensvorm.js`
over de zes composities die het voorstel noemt: hiring, planning, talent,
opleiding, vertegenwoordiging en workforce), gaf **0 van 7 werkwoorden in alle
zes** — op naam niet en ook niet met synoniemen erbij (gemiddeld 2,3 van de 7 op
naam en 3,8 met synoniemen). Alleen vertegenwoordiging had ze allemaal, en dat
is tautologisch, want het vocabulaire komt daarvandaan.

**Graad: `vermoed`.** Beide metingen zijn ad hoc gedraaid en staan niet als
register in de repo. `INTELLIGENTIE.md` INT-02 noemt als meter voor precies deze
vraag een script `wereldmodel.js`, en dat bestaat niet. Wie deze conclusie wil
laten gelden als regel, moet de meting eerst vastleggen (zie par. 7, stap 9).

Wat de uitslag draagt is niet alleen het getal maar het precedent:
`REPRESENTATIE.md` par. 4 punt 57 beantwoordde een bijna woordelijk gelijk voorstel
(*"Bouw geen TalentManagerEngine. Bouw een Representation Engine"*, kop van
`scripts/namensvorm.js`) met **als verklaring wel, als engine niet**.

---

## 1. De eerste zin van het voorstel staat al

*"Niet: je bent ongeschikt. Maar: hier ontbreekt één aantoonbare vaardigheid, en
dit zijn de routes."* Dat is in dit huis geen wens maar een grens met een motor
eronder:

- `LEVEN.md` par. 2.2: *er bestaat geen "dit is niets voor jou"; een talentsignaal
  is een uitnodiging, nooit een poort.*
- `FOUNDATION.md` par. 5.3: een eligibility-motor mag alleen **toevoegen**.
- `server/kern/knelpunt/index.js`: *een knelpunt is een eigenschap van een
  randvoorwaarde, nooit van een mens*, en er gaat nooit een weg uit de lijst.
- `server/kern/knelpunt/aanvoer-opleiding.js` levert leerpaden bij een
  randvoorwaarde, en `ADAMPROEF.json` schakel 12 sluit: werk én opleiding vanuit
  één doel.
- `server/kern/concern/scope.js` kent de stand `bijna` met reden *kwalificatie*:
  je mag dit bijna, en dit is wat ontbreekt.

Wat ontbreekt is de naad tussen die motor en een concrete vacature:

- `vacature.vaardigheden` (vrije tekst, maximaal twaalf) **valt weg** in
  `server/kern/knelpunt/aanvoer-werk.js`: het `wat` van een vondst noemt functie,
  bedrijf, plaats, uren en minimumleeftijd, maar niet wat de vacature vraagt. Op het
  zakelijk kansenbord staan partnervacatures met `skills: []`.
- `server/kern/persoonseis.js` zegt bij `ontbreekt` wél wát het stuk is (*een VOG
  voor het werken met kinderen, met nummer en afgiftedatum*), maar niet hoe je het
  krijgt. Voor een VOG of een BIG-registratie is dat een procedure en geen leerpad,
  en dat verschil hoort er hardop bij.
- De koppeling vacature → beroep → leerpad bestaat (`tekorten()` in
  `server/kern/stadsweefsel/kansen.js`, met opzet een domme woordvergelijking: *een
  AI die functietitels interpreteert, geeft een lijst die niemand kan narekenen*),
  maar alleen achter de kantoordeur (`server/routes/kantoren/weefsel2.js`). Voor een
  werkgever of een werkzoekende bestaat hij niet.

**Stand: een stap weg.**

---

## 2. De vorm die overleeft

Een Work Kernel als OBJECTMODEL is door de meting niet gerechtvaardigd. Er komt
**geen `work_items`-tabel, geen `capabilities`-tabel en geen `opportunities`-tabel.**

Wat overleeft is de vorm die dit huis bij elk van die voorgangers koos:

1. een **verklaring** per compositie van wat hij aan de grens levert, in de vorm
   van `server/kern/namens/projectie.js`: vaste veldnamen, *wat gedeeld wordt is de
   TAAL en niet de machine*, geen require naar elkaar, geen opslag;
2. boven een **projectie met etiketten** (`server/kern/levensgraaf/graaf.js`), die
   rekent en niets bezit.

Van de vijftien primitives zijn er negen **platformvermogen dat al draait**. Die
bouw je niet opnieuw; een Work-compositie VERWIJST ernaar. Vijf zijn
**domeinvermogen**, waar een gedeeld type de `Asset`-fout is. Eén heeft het huis
zelf al op jaren weg gezet.

| Primitive | Bestaat als | Stand |
|---|---|---|
| Identity | identiteitskluis met codenaam (`server/accounts/kluis.js`), `req.envelop.actor` met een identiteitsoordeel (`server/opzet/envelop.js`), `principalRef` | staat |
| Organization | `org` is de tenant (`server/kern/tenant/register.js`: *er komt geen vijfde betekenis bij*), plus de zes begrippen van `CONCERN.md` | staat — maar de hele wervingsketen hangt aan de LEVERANCIERSCODE, en die is volgens `TENANT.md` *nooit een identiteit* |
| Evidence | de bewijsgraad (onbekend, vermoed, gemeten, bewezen), het carrièreledger, `kern/vakbewijs.js`, de bewezen rol van Métier | staat — de bewijsgraad staat identiek in **zes** modules; dat is een dubbeling, dus hier is samenvoegen de reparatie |
| Consent | het Consent Center (`server/kern/consent.js` + `server/kern/consent-register.js`) | staat — met een gat precies in Hiring, par. 4 punt 7 |
| Authority | `server/kern/namens/versmalling.js` (*effectief = gevraagd ∩ gever ∩ beleid ∩ context*), `server/kern/stuur/mandaat.js`, `server/kern/vertegenwoordiging/`, de tekenbevoegdheid van het concern | staat |
| Event | de eventenvelop (`server/kern/envelop.js`, acht velden, nooit WAT) en de gebeurtenislaag van het Werk OS (`server/bedrijf/gebeurtenis.js`) | staat — een schemaregister niet |
| Policy | `server/kern/commercie/besluit.js` + schaduw, `server/bedrijf/regels.js` + `regelpoort.js`, `server/kern/stuur/beleid.js` | staat |
| Agent | `server/kern/agent.js`, de mandaatpoort op `stuurRoep`, de loopbaancoach in `server/kern/metier/ai.js` | staat |
| Audit | het inzagejournaal met `noteerVast`, het werkruimtejournaal, `server/lib/keten.js` + `keten-anker.js` | staat — met twee fail-open plekken in Hiring, par. 4 |
| **Capability** | vier betekenissen al (platformvermogen in `OS.md`, functieschakelaar, capaciteit per trede, begrensd recht in `req.envelop`) | **botst** — voor menselijke skills koos `HDI.md` par. 2 `vaardigheid`, en dat woord staat al op minstens vijf plekken met dezelfde betekenis |
| **Opportunity** | vijf vormen: vacature, Opportunity Deck, knelpuntvondst, stadsweefsel-kansen, creator-oproep (`server/kern/samenwerking.js`) | **botst** — `AANVOERVORM.json` zegt: geen gedeelde vorm, een projectie met vijf verplichte etiketten |
| **Relationship** | minstens zes modules met `relatie` in een eigen betekenis | **botst** — zie par. 3, want dáár zit de vondst |
| **Work** | taak, project, dienst, vervoersopdracht, klus, vacature, elk in zijn domein; `server/kern/werkcommand/register.js` als werkruimteregister dat geen tabel verplaatst | **botst** — `PLANVORM.json`: <!--getal:planvorm.inAlle-->0<!--/getal--> velden in alle plandomeinen |
| **Agreement** | `server/kern/commercie/contract.js`, `server/kern/payroll/contracten.js`, `server/bedrijf/contract.js` | **botst** — `AFSPRAAK.md` par. 2.1 verbiedt een supertabel; wat gedeeld mag worden is het tekenprotocol |
| Workflow | in- en uitdienst, voornemen, documentwerkstroom, draaiboeken, de wervingsstroom, elk in zijn domein | **jaren weg** — `REPRESENTATIE.md` par. 4 zet de universele hoofdloop en saga-orkestratie daar, en `KETENVORM.json` meet <!--getal:ketenvorm.actorenGedeeld-->0<!--/getal--> van <!--getal:ketenvorm.actorenTotaal-->33<!--/getal--> actoren gedeeld |

Twee dingen die bij het lezen van die tabel stil fout gaan. De WorkOS-manifesten
noemen `organization` en `work_item` als objecten, maar dat zijn **labels zonder
implementatie**: `server/kern/experience/objectrefs.js` kent geen van beide, en
`server/kern/experience/contexts.js` geeft WorkOS één context zonder binding. De
Experience Kernel draagt de principes, maar is voor WorkOS nog geen gastheer.

De toetsvraag bij elk nieuw stuk blijft die van `PLANNING.md`: **rekent dit, of
bezit dit?** Wat bezit, hoort in het domein.

---

## 3. De echte vondst: drie werkrelaties die elkaar niet lezen

Een kernel eroverheen zou precies verbergen wat de meting vond. Het ontbrekende
stuk voor Talent & Hiring is geen primitive maar een **naad**.

| Model | Waar | Wie leest het |
|---|---|---|
| `staffId` aan een ZAAK | `server/routes/supplier/werving/uitnodiging-claim.js` (aanname) | de werving eindigt hier, en `server/kern/payroll/contracten.js` rekent erop — heel `kern/payroll` noemt `employment` nul keer |
| `employment` aan een ENTITEIT | `server/kern/concern/employment.js` | alleen `server/kern/concern/uitnodiging.js` en `server/routes/concern/mensen.js` maken er een aan |
| het werkruimteLID | `server/bedrijf/indienst.js` | het Werk OS |

Dit is de vorm van de twee ritwerelden (`db.data.rides` naast
`db.data.mobOpdrachten`, nul verwijzingen in beide richtingen), en het antwoord
daar is het antwoord hier: **de eigenaar besluit welk model de waarheid is**, en er
komt een brug die één kant op loopt (`server/kern/mobiliteit/appbrug.js`). Twee
lijsten die elkaar bijwerken hebben geen waarheid meer.

### De keten zoals hij vandaag loopt

1. **Vacature** — `/api/supplier/vacature`, alleen voor de manager, maximaal 40
   per zaak. Daarnaast bestaat een tweede vacatureopslag zonder sollicitatieweg: het
   zakelijk kansenbord (`server/routes/zakelijk/prikbord.js`, soort `vacature` en
   `opdracht`).
2. **Vindbaarheid** — `openVacatures()` in `server/kern/werk.js` voedt vijf
   ingangen. De payroll-kansen dragen **geen vacature-id** en zijn dus doodlopend.
3. **Interesse** — het anonieme Opportunity Deck bestaat alleen voor
   RTFoundation-profielen. Een werkgever die *wederzijds* zet, stuurt geen melding.
4. **Sollicitatie** — drie routes naar `db.data.applications[zaak]`, stil afgekapt
   op 100. De werkgever ziet er 30.
5. **Besluit** — `/api/supplier/apply/decide`, met bezorging via
   `server/kern/ontvanger.js`.
6. **In dienst** — alleen met een lidsleutel. Een Foundation-profiel krijgt een
   kassacode en een wervingslink die de werkgever met de hand moet doorgeven. Het
   resultaat is altijd zaakpersoneel en **nooit** een concern-dienstverband: hier
   breekt de keten in twee werelden.
7. **Loopbaanregel** — het carrièreledger schrijft met opzet niets vanzelf
   (`CARRIERE.md` par. 6d). De bewezen rol van Métier leest alleen OPGESLAGEN
   accountrollen, terwijl de personeelsrol inmiddels wordt AFGELEID. Een nieuwe
   aanname krijgt daardoor waarschijnlijk geen bewezen rol (gelezen, niet beproefd).

`ADAMPROEF.json` (stempel 13 september 2026) sluit de schakels 5 tot en met 11,
van vacature openzetten tot en met aangenomen. **De wervingshelft van een gouden
keten is dus al gelopen.** Wat ontbreekt is alles erna: aanname → `staffId` of
`employment` → contract → loon. Die proef verlengen maakt de naad uit deze
paragraaf zichtbaar, en dat is de voorwaarde voor het besluit.

### De weigering die al in de code staat

`server/kern/wereld/lijsten.js` haalde `werving.suite` (ATS, interviews,
assessments, contracten) uitdrukkelijk uit de rechtenlijst:

> Een half aangezette wervingslaag is gevaarlijker dan een afwezige: iemand gaat
> er sollicitanten in bewaren en denkt dat er een proces omheen staat.

**Talent & Hiring als eerste volledige verticaal is daarom eerst een besluit over
die weigering**, en pas daarna bouwwerk. Wie de verticaal bouwt zonder die zin te
lezen, bouwt precies het halve proces waar hij voor waarschuwt.

---

## 4. Wat de meting onderweg vond

Een inventaris die alleen bevestigt wat er staat, heeft niets bewezen. Deze ronde
vond fouten in de bestaande wervings- en werklaag die geen toets zag. Per punt de
graad: **gemeten** is met een proef op de echte module nagedraaid, **gelezen** is
uit de code afgeleid en niet beproefd.

1. **De Foundation-herkomst lekt via een ONTBREKEND veld** (gemeten).
   `werkgeverSollicitatie()` in `server/kern/werk.js` is een weglaatlijst over drie
   velden (`viaRTF`, `key`, `rtf`). Gedraaid op de rijvormen uit de bron houdt een
   ledenrij `codename` en `vacatureId`, en een Foundation-rij heeft ze allebei niet.
   De werkgever leest de herkomst dus af aan wat er ONTBREEKT. `scripts/adamproef.js`
   schakel 8 (*lekt herkomst: false*) zoekt naar precies die drie veldnamen en is
   daardoor blind. Een proef met een geldige uitslag die het verkeerde experiment
   draait (`BEWIJSMACHINE.md` par. 6a). De route staat in productie dicht via
   `server/middleware/foundation-productiepoort.js`, dus dit is niet live, maar het
   is precies het lek dat de vrijgave moet tegenhouden. Reparatie: een POSITIEVE
   veldlijst met één veldset voor lid, Foundation-profiel en anoniem
   (AI-CONTEXT-01, doorgetrokken naar een projectie voor een derde), plus een toets
   die zakt zodra de sleutelsets verschillen.
2. **Wie "open voor werk" aanzet, wordt gezien door wie hij wil verlaten**
   (gelezen). `/api/supplier/payroll/openvoorwerk` in `server/routes/payroll.js`
   schrijft *zette "open voor werk" aan* in het activiteitenlog van de HUIDIGE zaak.
   MN-02.
3. **Een cijfer op een mens als sorteersleutel** (gelezen). `kandidatenVoor()` in
   `server/kern/payroll.js` sorteert mensen op een score, met een punt extra voor
   wie minder dan acht uur per week werkt (`rustig`), en toont voornaam plus score
   aan het kantoor. CAR-05, `HDI.md` par. 5.4, INT-04. Daarnaast belooft
   `public/apps/personeel-hrmijn.js` *passende bedrijven vinden jou*, terwijl geen
   enkele werkgeverroute `kandidatenVoor` leest.
4. **"Geen verborgen matchscore" boven een verzonnen matchscore** (gelezen).
   `public/apps/foundation/werk.html` belooft in zijn kop *geen verborgen
   matchscore*, en rekent daarna per vacature een *praktische match* uit die begint
   op 72 bij nul overlap, nooit onder de 68 komt, punten geeft voor wat de WERKGEVER
   publiceert (salaris, uren, werkvorm), en waarop het scherm sorteert. Het getal is
   zichtbaar, dus niet verborgen, maar de basis van 72 is door niemand gemeten. Er
   staat een getal waar er geen is, voor een doelgroep vanaf zestien jaar.
5. **De rustregel van de beveiligingsplanner houdt op bij middernacht** (gemeten).
   `planAuto()` in `server/kern/beveiliging/rooster/aanvragen.js` toetst rust alleen
   binnen dezelfde kalenderdatum. Een stubproef op de echte module zette een bewaker
   na zijn nachtdienst (23:00–07:00) om 07:00 op de dagdienst, terwijl een collega
   vrij was. `zetDienst()` in `planning.js` belooft in zijn commentaar rust en toetst
   alleen een dubbele shift. Daarbij draagt een dienst die de machine plaatste geen
   `door`, dus achteraf is niet te zien of een mens of de automaat inplande.
6. **De identiteitsinzage van een werkgever logt fail-open** (gelezen).
   `server/kern/payroll/identiteit.js` schrijft zijn journaalregel in een lege
   `catch` (*het journaal mag de inzage niet blokkeren*). `STILSPOOR.json` telt die
   plek al. Dat is precies de vorm die `MENSNETWERK.md` besluit 5 voor de ledenbalie
   dichtzette: geen aantoonbaar journaal, geen inzage. En de naamvrijgave van Métier
   (`server/kern/metier/bewijs.js`) logt in een eigen ringbuffer en niet in het
   centrale journaal.
7. **Hiring staat niet in het Consent Center** (gelezen). Het openen van een
   anonieme talentmatch en het delen van naam, contact en cv via een sollicitatie
   staan in geen van beide lijsten van `server/kern/consent-register.js`.
   `test/consent-dekking.test.js` kan dat niet zien: hij scant alleen `server/kern`
   en kent één vorm. Dezelfde faalvorm als het voorwaardenakkoord in `AFSPRAAK.md`
   par. 7.1.
8. **Twee open deuren in de sollicitatiestroom** (gelezen). `/api/supplier/apply`
   is zonder sessie, heeft geen eigen snelheidsrem, en een vloed duwt echte
   sollicitaties stil voorbij de afkap van 100. `/api/rtf/vacatures` heeft geen
   authenticatie en neemt de leeftijd uit het verzoek.
9. **Een reparatieknop die klantdata kan legen zonder terugweg** (gelezen).
   `server/kern/zelfzorg/repareren.js` zet de collecties `orders` en `boekingen` bij
   een verkeerd type terug op leeg, zonder de oude waarde te bewaren, terwijl de kop
   belooft dat de kapotte waarde als bewijsstuk meegaat. `BESTUUR.md` 6.5.
10. **De guardrail voor voorspellingen gaat in productie nooit open** (gelezen).
    `legVoorspellingVast` in `server/kern/kosten/vooruitblik.js` heeft buiten de
    toets geen aanroeper. De trefzekerheid blijft dus altijd *niet gemeten*, en de
    band die er pas na drie gemeten maanden mag komen, komt nooit.
11. **Een ongeijkt samengesteld zekerheidscijfer stuurt gedrag** (gelezen).
    `server/kern/voorspel/rekenen.js` bepaalt sortering en de drempel van een
    seintje met een formule die nooit tegen de uitkomst is gehouden. INT-04.
12. **De AI-kostenmeter boekt het verkeerde model** (gelezen). `server/ai.js`
    boekt de GEVRAAGDE Claude-naam tegen Claude-tarieven, ook als een andere
    aanbieder antwoordde. Cache-leestokens tellen als volle invoer en
    cache-schrijftokens ontbreken. En omdat de meter de bron weggooit, telt lokaal
    verbruik mee voor de verbruiksgrens, die dan ook het lokale model dichtzet.
13. **De contextuele Edge-balk filtert verboden acties stil weg** (gelezen).
    `public/shared/rtg-adaptive-edge-core.js` laat een verboden actie weg in plaats
    van haar met reden te tonen, en `test/rtg-adaptive-edge.test.js` legt dat vast.
    `GRAMMATICA.md`: *verhinderd is niet uitgeschakeld*. Voorstel 117 en 120 bouwen
    precies op dit patroon.

Punten 1 tot en met 5 raakten een mens, en **zijn gerepareerd (23 september
2026)**: `werkgeverSollicitatie` is een positieve lijst (`WERKGEVER_VELDEN` in
`server/kern/werk.js`) en een Foundation-sollicitatie draagt `vacatureId` net als
een ledenrij, met `test/werkgeversollicitatie.test.js` en een Adamproef-schakel 8
die nu de sleutelset toetst (op de oude code zakt hij: *geen vacatureId, anders
dan een lid*); de schakelaar "open voor werk" schrijft niet meer in het zaaklog;
payroll geeft kandidaten redenen in woorden in plaats van een score, zonder
sortering en zonder afkap op mensen; `foundation/werk.html` toont geen percentage
meer; en de rustregel staat in `server/kern/beveiliging/rooster/rust.js` (elf uur,
over de datumgrens), de automaat plant er nooit tegenin, een mens krijgt de
botsing als waarschuwing, en elke dienst draagt `door`
(`test/bevrust.test.js`). Of een MENS ook geweigerd moet worden bij te weinig
rust, is een besluit en geen reparatie: **het blijft een waarschuwing**, zo is
besloten op 23 september 2026.

**Punten 6 tot en met 13 zijn op dezelfde dag gerepareerd.** De
identiteitsinzage van een werkgever gaat via `inzagelog.noteerVast()` en weigert
met 503 als het spoor niet vaststaat -- geen gegevens, geen bericht, geen verzoek
(`test/identiteit-opvraag.test.js`, ook onder een vastlegger die faalt); de
naamvrijgave van Métier schrijft in het centrale journaal en weigert op dezelfde
grond. Sollicitatie en anonieme werkinteresse staan in `NIET_GEDEKT` (nu in
`server/kern/consent-register-grens.js`), en `test/consent-dekking.test.js` scant
voortaan ook `server/routes` op de OVERDRACHTSvorm. `/api/supplier/apply` heeft
een eigen rem per afzender en per zaak (`sollrem.js`, tien per uur, alleen
opgeslagen sollicitaties tellen); `/api/rtf/vacatures` blijft met opzet open en
zegt waarom (dezelfde openbare lijst als de vacaturepagina, de leeftijd filtert
alleen en de sollicitatieroute leest hem uit het profiel). De reparatieknop maakt
een collectie van een ander domein niet meer leeg maar geeft een advies met ernst
`hoog`. De onderhoudsronde roept `vooruitblikVastleggen` aan, dus de
trefzekerheid gaat meten. De voorspeller draagt geen `zekerheid` meer maar een
`opbouw` (bezoeken, rijp, vast uur, vaste dag) en sorteert op een regel in
woorden: vaste boeking, wat nu aan de beurt is, meeste bezoeken, rijpste ritme.
De AI-kostenmeter boekt het model dat ANTWOORDDE (een onbekend model telt tegen
het duurste tarief), weegt cachetokens zoals de dagmeter, telt OpenAI-cache niet
meer dubbel, en meldt alleen extern verbruik aan de kostenhaak; een dichte
verbruiksgrens sluit extern en laat het eigen model antwoorden
(`test/aikosten-bron.test.js`). En de Edge-balk toont een verboden actie met
haar reden -- zonder opgegeven reden staat er dat hij ontbreekt, er wordt er geen
verzonnen. Elke nieuwe toets is op de oude code gedraaid en zakte daar.

---

## 5. Namen die al bezet zijn

Gemeten, niet aangenomen. Dit huis is hier vaker op gestruikeld dan op wat ook.

| Voorgestelde naam | Bezet door | Gevolg |
|---|---|---|
| Kernel | Experience Kernel v1 (`server/kern/experience/`), Representation Kernel (`CARRIERE.md`), Safety kernel (`CONTROLPLANE.md`), Trust Kernel (`RUNTIME.md`, half) | een vijfde kernel is de `VERMOGENS`-botsing op de naam van een laag |
| Capability | platformvermogen (`OS.md`), functieschakelaar, capaciteit per trede, begrensd recht in `req.envelop` | menselijke skills heten `vaardigheid` (`HDI.md` par. 2) — en ook die naam is een dubbeling over vijf plekken, met twee beroepsprofielen die elk een eigen zoeker hebben |
| Opportunity | Opportunity OS (vacatureinvoer), Opportunity Deck (Foundation), `HDI.md` laag 6, een navigatieslot | geen vijfde |
| compiler | de plancompiler (`server/kern/stuur/plan.js`), de Assessment Compiler van School (`server/kern/toetsbouw.js`) | voorstel 103 wordt geen derde compiler |
| Fairness Engine | `server/kern/toetsbouw.js` — en die meet het INSTRUMENT, precies de goede vorm voor 111 | aansluiten, geen tweede |
| talentpool, talent, markt, kansen | `werving.talentpool`, de Talent Exchange, de Marktplaats, drie betekenissen van `kansen` | voorstel 104 en 105 kiezen een vrije naam |
| scenario, simulatie, vooruitblik, voorspelling | `server/kern/fiscaal/scenario.js` *is* "de scenario-engine" voor personeelskosten; vier simulatiemodules; `vooruitblik` betekent prognose én voorvertoning | voorstel 107 sluit aan op de bestaande scenario-engine |
| agent | de AI-bedrijfsagent (`server/kern/agent.js`) én, in `MENSNETWERK.md`, de menselijke gemachtigde | in Hiring blijft *agent* de AI; de mens heet vertegenwoordiger |
| envelop | twee keer in code: de gebeurtenisenvelop (`server/kern/envelop.js`) en de requestenvelop (`server/opzet/envelop.js`) | geen derde |
| budget, onderbreker, wachter, canary, rem, noodrem | vier betekenissen van budget; een circuit breaker heeft hier al drie Nederlandse namen | voorstel 124 en 125 hergebruiken ze |
| geheugen, herkomst, uitgang, herstel, migratie, overname, schaduw, federatie, firewall, duurzaam, Edge, gateway, router, benchmark | allemaal bezet, de meeste meervoudig | zie de tabellen in par. 6 |

`resource`, `embedding`, `relationship`, `rekenspoor` en `datacontract` zijn
lexicaal vrij. Maar `PLANNING.md` par. 5 zegt waarom `resource` hier juist
gevaarlijk is: **een mens is geen resource.**

---

## 6. Per onderdeel

De stand staat vooraan. Botsen betekent niet dat het idee vervalt, maar dat de
voorgestelde VORM vervalt; de kolom ernaast noemt de vorm die wel overleeft.

### 6.1 Talent en opleiding

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 0 | een ontbrekende vaardigheid is een uitnodiging met routes | een stap weg | par. 1. Zet `vacature.vaardigheden` in het `wat` van de werkvondst (zichtbaar, nooit toegepast), en geef `persoonseis` en `scope.bijna` een weg om het stuk te halen |
| 103 | skills-to-training compiler | besluit | de schakels liggen er los (kansen, Beroepen-Bibliotheek, vakbewijs, carrièreledger). Er is geen gedeelde vaardighedenlijst: vrije tekst op negen plekken. Eerst `tekorten()` per zaak aan de werkgever geven (deterministisch, geen mens erin); dan het besluit over een lijst die de negen plekken opneemt en geen tiende wordt. *Inzetbaar* wordt nooit een label op een mens |
| 104 | interne talentmarkt | besluit | een markt over zaken heen bestaat al in `server/kern/payroll.js`, en die botst: par. 4 punt 2 en 3, en de kansen dragen geen vacature-id. Eerst repareren; daarna besluit de eigenaar over een vacaturebereik "alleen de eigen entiteit" en over wie een interne kandidaatstelling te zien krijgt (MN-02) |
| 105 | tijdelijke capability pools | botst | een *capacity requirement* als object dat met uitwisselbare mensen gevuld wordt botst met `PLANNING.md` par. 2 en 5. De vorm die overleeft staat al: `server/kern/rtfos/uitwisseling.js` (uitlenen met toestemming en einddatum) en `rtfos/vrijwilligers.js` (FILTEREN op beschikbaarheid, taal en VOG, nooit rangschikken) |
| 111 | eerlijkheid meten zonder mensenscores | een stap weg | de meetvorm staat (tellen zonder te lezen, K=5, `DOELGROEPBEREIK.json`). Voor de sollicitatiestroom ontbreekt een teller per uitsluitende REGEL (minimumleeftijd, 16+, cv verplicht, dubbel, productiepoort). Eerst de score uit `kandidatenVoor` halen, anders is een eerlijkheidsmeter zelf niet eerlijk |
| 140 | consentbrug tussen werelden | besluit | delen per feit staat (carrièreledger met deelcode, RTG iD, Métier-naamvrijgave). De bron uit het voorbeeld (taalvaardigheden uit TravelOS) bestaat niet en zou uit reisgedrag afgeleid moeten worden. Vandaag kan: het lid zet het feit zelf in zijn ledger en deelt het. *Passport* heet al `paspoort` (207 bestanden) |
| 141 | Foundation-afscherming | een stap weg | par. 4 punt 1. Positieve veldlijst, één veldset, en een toets op gelijke sleutelsets. Daarna pas de herkomst naar de Foundation-kant verhuizen |

### 6.2 Planning en voorspellen

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 106 | constraint solver naast AI | jaren weg | afgedwongen afwezig: `server/kern/ai/router.js` zet `optimalisatie` in zijn gatenlijst en `test/ai-router.test.js` zakt als die leeg raakt. De vorm *deterministisch rekenen, mens kiest* staat al als haalbaarheidsmotor (`server/kern/knelpunt/index.js`). Eerst par. 4 punt 5, dan verzuim, persoonseis en contracturen laten lezen (`PLANNING.md` par. 7). De objective is **aanspraak** (minste uren), nooit geschiktheid |
| 107 | what-if met promotie naar echte werkobjecten | jaren weg | `server/kern/fiscaal/scenario.js` rekent personeelskosten door en weigert met opzet om een scenario door te voeren: *wie het scenario kiest, doorloopt de gewone wegen*. Het horecarooster kan *open tot 04:00* niet uitdrukken (drie vaste shiftnamen); het festivalrooster wel. Promotie wordt KLAARZETTEN in de gewone routes, niet in één klap aanmaken |
| 108 | vraagvoorspelling met vangrails | een stap weg | twee voorspellers draaien zonder bereik of onzekerheid; de vangrailvorm staat in `server/kern/kosten/vooruitblik.js` maar zijn meetlus draait niet (par. 4 punt 10). De MEP-voorspelling rekent met een verzonnen seizoenstemperatuur en wist zichzelf na een dag |
| 109 | driftdetectie | een stap weg | `trefzekerheid()` middelt over 24 maanden en is een kalibratiegemiddelde, geen driftmeter. Een venster over de laatste drie afgesloten perioden erbij; valt de band weg, dan luid en met de reden (`PROOF.md` par. 9). Geen hertrainknop: er is geen model |
| 110 | herkomst van een optimalisatie | een stap weg | de vorm staat in payroll: versie op de run (`server/kern/payroll/regelpakket.js`) en vier vragen per bedrag (`server/kern/payroll/dossier.js`). Eerst `door` op een dienst, dan de gebruikte regel en versie in het domein. Geen kopie van verzuim of contract in een snapshot |

### 6.3 Interface

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 112 | toegankelijk vanaf de bouw | een stap weg | de poorten draaien in CI op nul, en de Heritage-laag moet reduced-motion en forced-colors dragen. Wat ontbreekt: een eerste meting met een échte gebruiker van een schermlezer en schakelbediening, en het besluit uit `TAKEN.md` 4.31 over spraakbesturing (die draait op de Web Speech API, die drie documenten uitsluiten) |
| 113 | prestatiebudgetten als CI-regel | een stap weg | de prestatieratel meet wekelijks en niet per PR; keuringsregel 13 zondert bundels uit, en `public/apps/app-main.js` groeide ongemerkt. Begin met bundelgrootte (deterministisch) als ratel omlaag. Een absolute ms-drempel op CI knippert (`PRESTATIES.md`); alleen een verhouding binnen dezelfde run past |
| 114 | energiebewust | een stap weg | het woord *energie* is bewust geweigerd zolang er niets gemeten wordt; het gaat dus over proxy's. `LUSSEN.json` indexeert al 80 clientwekkers; een as *pauzeert bij verborgen scherm* erbij, en de eigen EventSource-stromen naast `RTGRealtime` tellen |
| 115 | beperkte server-driven presentatie | een stap weg | Workspace Blueprints met validator staan, maar de bevoegdheidstoets in de browser is fail-open (geen aanroeper geeft een permission-functie mee). Eén serverroute die per actie *beschikbaar* of *verhinderd met reden* levert, en die de validator voedt |
| 116 | één design runtime als schil | een stap weg | RTG Adaptive Edge heeft de decks, een identiteitsslot en een voortgangsslot — met nul producenten. Voeden, niet bouwen. Deze laag heeft al zes systeemnamen; er komt geen zevende |
| 117 | contextuele Edge-balk | een stap weg | `RTGAdaptief.declareer` bestaat en verschijnt al in dock, orb en Edge. Niet bouwen op de registerlaan van de Edge zolang die verboden acties wegfiltert (par. 4 punt 13) |
| 118 | voorspelde handeling, nooit de beslissing | besluit | *de orb stelt voor en beslist nooit* staat in code. Voorspellen zonder te leren kan nu (de volgende stap uit de toestand van het object); leren uit gedrag vraagt eerst een besluit over gebruikstellingen per codenaam (`GRAMMATICA.md`) |
| 119 | zero-navigation workflows | botst | *na goedkeuring ontstaat alles* botst op drie plekken: één goedkeuring is één pad met één lijf (`server/kern/stuur/goedkeuring.js`), de mandaatpoort geeft 428 op elk voorstel zonder mens, en wat een tweede persoon bereikt bevestigt een mens (`FABRIC.md` par. 5). Wat overleeft: één review via `plan`, een bevestiging per stap met effect, en een bon per handeling |
| 120 | door de AI samengestelde taakinterface | een stap weg | het besluit is al genomen (`ADAPTIEF.md`, 2 september 2026), onder de voorwaarde van een meter voor handelingen zonder vorm, en die meter bestaat niet. De knop *Maak je ruimte* gooit de vraag vandaag weg. Eerst de meter, dan de validator niet-inert, dan één gereedschap |

### 6.4 Agents

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 121 | getypeerde tools per domeinhandeling | botst | de waarborgen staan voor élke route tegelijk op één knooppunt (`stuurToets`, goedkeuring, bon, spoor, gevolgcontract, `INVOERPROEF.json`). Tools per domeinhandeling zijn een tweede routelijst (`server/kern/stuur/resolver.js`). Een getypeerde invoer mag, als PROJECTIE uit de route, nooit met de hand. Een id uit het model is een bewering (`server/kern/stuur/menscontext-ref.js`) |
| 122 | eigen rechten per agent | botst | een agent heeft geen eigen rechten (`FABRIC.md` grens 1); wat overleeft is een agent als MANDAAT over de rechten van wie hem iets vraagt. Een mandaat verlenen kan vandaag niet: `MANDAATPROEF.json` noemt vier besluiten |
| 123 | sandboxing | besluit | de agent heeft geen bestandssysteem en geen netwerk behalve de interne lus, draagt het token van de gebruiker, en elk toolantwoord is onvertrouwd per kanaal. Er is geen parser die de AI voedt. Het besluit is `RTG_HERKOMST_AFDWINGEN` per wereld, met een gemeten prijs (`INTELLIGENTIE.md`) |
| 124 | budget per run | een stap weg | het stappenbudget telt MODELBEURTEN, niet tool-aanroepen; er is geen klok per run. Drie tellers per run erbij, eerst in de schaduw. Geen geldlimiet als ruimte: de AI beweegt geen geld |
| 125 | onderbrekers | een stap weg | vier bestaan er (storingswachter, canary, de onderbreker van de eigen modelserver, toezicht). Die van de modelserver degradeert naar EXTERN en niet naar uit. `server/kern/command/toezicht.js` staat op leeg-is-open en telt cumulatief; eerst omdraaien, dan pas aansluiten |
| 126 | geheugen met reikwijdtes | besluit | het fluistergeheugen heeft al drie sleutelruimtes per hoedanigheid, met een gedeelde terugval per bedrijfsaccount, zonder bewaartermijn en zonder toets. Het Mensmodel is een eigenaarsbesluit (INT-03) |
| 127 | herkomst van geheugen | besluit | de etiketten bestaan op vier plekken (`graaf.js`, `carriereledger/regels.js`, `kern/invoer.js`, `bedrijf/kennis.js`); geen nieuwe vorm. Een modelsamenvatting is hoogstens kandidaat en promoveert pas via een mens |

### 6.5 Privacy en gegevens

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 128 | vergeten als infrastructuur | een stap weg (database), besluit (back-ups) | `wisLid()` draait. De gaten zitten in afgeleide staat: de ervaringslaag bewaart onder een ongezouten hash van een op te sommen sleutel, de idempotentiekas houdt antwoorden 24 uur vast, en het lid krijgt geen wisbewijs terwijl de tenantlaag dat wel geeft. Back-ups zijn WORM en 30 dagen; de enige passende vorm is een wislijst zonder namen die na elk herstel opnieuw wordt toegepast |
| 129 | levenscyclus van embeddings | besluit | er bestaan geen embeddings. Een bewaarde embedding past niet in de gegevenskaart, waar *afgeleid* "nergens bewaard" betekent. Of persoonsgegevens überhaupt ge-embed worden, hangt aan het Mensmodel-besluit |
| 139 | datacontracten tussen werelden | botst | werelden bezitten geen data (*Worlds orchestrate. Domains own.*). Het contract hoort tussen DOMEINEN. Het bestaande equivalent van *IdentityVerified mag, niet het hele profiel* is doelbinding per gegevenssoort (`server/kern/identiteit/doelpoort.js`), in de schaduw en met nul productie-aanroepers. Eerst aansluiten |
| 142 | clean rooms | botst | het huis maakt koppelen op persoonsniveau met opzet onmogelijk (onkoppelbare pseudoniemen per partner, aliassen per studie). Wat overleeft is *tellen zonder lezen*, maar de drempel voor kleine aantallen staat los op drie plekken en ontbreekt in het stadsweefsel en in de projectcijfers van het gemeenteportaal. Eén gedeelde telprimitief |
| 143 | gefedereerde analyse | jaren weg | er zijn geen regionale datasets; de landdrager uit `SOEVEREIN.md` komt eerst en is zelf een besluit. De bewering in `OS.md` dat regio en jurisdictie per klant al in het datamodel staan, is niet teruggevonden |

### 6.6 AI-infrastructuur

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 130 | hybride AI met een router | besluit | de keten draait (eigen modelserver vooraan, dan extern), maar de uitwijk wordt door CAPACITEIT gestuurd en niet door beleid. Het besluit is per werksoort of uitwijk naar buiten mag. Een router op prijs of regio staat in `ECONOMIE.md` par. 9 op jaren weg, na een kwaliteitsmaat |
| 131 | speculatieve reads | een stap weg | parallel uitvoeren wat het model in één beurt vroeg kan. Echt speculeren niet: elke read kost het lid een verzoek, en elk toolantwoord is onvertrouwd en kan schrijvers sluiten |
| 132 | semantische cache | besluit | exacte caches per tenant bestaan (keukencoach). Begin met exacte treffers met de hoedanigheid in de sleutel (AI-CONTEXT-02), eerst in de schaduw met een eigen teller |
| 133 | kleine gespecialiseerde modellen | botst | taaldetectie, routing, intentie en PII zijn hier met opzet REGELS. De ladder die overleeft staat in `server/kern/agenda.js`: eerst de parser, dan een klein model. Het *korte* model op de Claude-weg is vandaag een Sonnet |
| 134 | distillatie | jaren weg | niets, en geen kwaliteitsmaat die een kleiner model zou kunnen tegenhouden. Datarechten eerst |
| 135 | doorlopende modelbenchmarks | een stap weg | `scripts/railvergelijk.js` staat, maar de tweede rail is nooit gedraaid. Eerst par. 4 punt 12, anders meet de benchmark het verkeerde model. Geen samengesteld cijfer; kwaliteit blijft een menselijk oordeel |
| 136 | hardware-abstractie | staat | één contract, vier adapters. Wel: de maatwoorden zijn Claude-modelnamen (99 in `server/`), en de andere adapters raden de grootte met een regex. Vervang de naam door een rol |
| 137 | kosten per functie | een stap weg | per drager, per soort, per maand staat. Tel per functie op huisniveau en per wereld, nooit per lid (`server/kern/kosten/meter.js`: geen gedragslogboek). Eerst de telfouten uit par. 4 punt 12. *0,0018 euro* zonder tarief en graad mag nooit op een scherm |
| 138 | koolstof- en rekentelemetrie | een stap weg | duur per route en tokens per bron bestaan. Koolstof alleen als toerekening uit de nota, graad `vermoed`. *Duurzaam* is bezet door opslagduurzaamheid |

### 6.7 Enterprise en bedrijfsvoering

| # | Voorstel | Stand | Wat er is, en de kleinste stap |
|---|---|---|---|
| 144 | open standaarden aan de grens | een stap weg | OIDC, SAML, SCIM en WebAuthn staan en zijn beproefd. Uitgaand ontbreekt: ondertekende gebeurtenissen voor het Werk OS, in de vorm van `server/school/webhook.js` (alleen ids, nooit inhoud) |
| 145 | migratiemotor | een stap weg | bestaat als *overname* (`server/kern/command/overname.js`: droogloop, zegel, terug per partij), met sollicitatie en vacature al als soort. Mensen komen nooit rauw binnen maar via bulkuitnodiging, SCIM en dubbelendetectie. Besluit: hoe geïmporteerde historie een bron krijgt |
| 146 | parallelle migratie | besluit | het patroon staat intern (schaduwgrootboek, `server/kern/commercie/schaduw.js`: rijp is een voorwaarde, een mens op naam trekt, terug mag altijd). Per soort besluiten welke kant tijdens de parallelle periode de waarheid is |
| 147 | uitstapbaarheid | een stap weg | de werkruimte-uitgang staat en is beproefd. Concern en payroll hebben er geen, en het meegenomen journaal heeft geen keten. De uitstaptoets van `CARRIERE.md` als keuringsregel: elke collectie in een opslagcontract heeft een uitvoerweg |
| 148 | rampstand-UX | een stap weg | `/apps/mijn-isolatie.html` toont al wat er per stand nog werkt. Bij een huisbrede stand staat er alleen één zin, en de lijst moet uit de HANDHAVENDE laag komen (`ISOLATIE.md` par. 8) |
| 149 | zelfherstel waar veilig | een stap weg | de grens staat in code. In productie draait één server onder Docker-herstart; de failoverproef ging over het lokale pad. Eerst par. 4 punt 9 |
| 150 | Work Kernel | botst | par. 0, 2 en 3 |

---

## 7. De volgorde

Niet op aantrekkelijkheid, maar op wat een mens vandaag raakt en wat de volgende
stap mogelijk maakt.

| # | Stap | Soort | Waarom nu |
|---|---|---|---|
| 1 | Par. 4 punt 1: positieve veldlijst in `werkgeverSollicitatie`, plus de toets op gelijke sleutelsets, plus schakel 8 van de Adamproef die op de sleutelSET toetst en niet op drie namen | bouwen | een lek dat de proef niet ziet, vóór de Foundation-vrijgave |
| 2 | Par. 4 punt 2, 3 en 4: de schakelaar uit het zaaklog, de score uit `kandidatenVoor`, het getal van 72 uit `werk.html` (toon de overlap als redenen) | bouwen | een cijfer op een mens, en een belofte die de pagina zelf breekt |
| 3 | Par. 4 punt 5: rust over de datumgrens, en `door` op een dienst | bouwen | een bewaker na zijn nachtdienst om 07:00 op de dagdienst |
| 4 | Par. 4 punt 6 en 7: `noteerVast` in de identiteitsinzage, Hiring in het consentregister | bouwen | dezelfde vorm als besluit 5 uit `MENSNETWERK.md` |
| 5 | De Adamproef verlengen voorbij *aangenomen*: aanname → werkrelatie → contract → loon | meten | maakt de naad uit par. 3 zichtbaar |
| 6 | **Welk werkrelatiemodel is de waarheid**, met een brug die één kant op loopt | besluit | zonder dat besluit heeft elke verticaal drie mogelijke eindpunten |
| 7 | **Wordt de weigering van `werving.suite` opgeheven**, en zo ja, met welk volledig proces | besluit | voorwaarde voor Talent & Hiring als verticaal |
| 8 | Par. 1: vaardigheden van de vacature in de werkvondst, de weg naar een ontbrekend stuk bij `persoonseis`, en `tekorten()` per zaak voor de werkgever | bouwen | maakt de openingszin van het voorstel waar met wat er al ligt |
| 9 | **Welk profiel is de bron van vaardigheden** (Métier of het professionele profiel van Zakelijk); daarna pas een gedeelde lijst. De vormmeting van par. 0 vastleggen als register met een ratel | besluit + meten | voorwaarde voor voorstel 103 |

### 7a. De besluiten van 23 september 2026

De eigenaar heeft drie van de vier besluiten uit deze tabel genomen, en de volgorde
van het werk erna.

1. **Stap 6 -- `employment` aan een ENTITEIT is de waarheid.** Een aanname via de
   werving hoort voortaan ook een dienstverband bij de entiteit te maken, en
   `staffId` aan een zaak wordt daarvan afgeleid. De brug loopt een kant op, in de
   vorm van `server/kern/mobiliteit/appbrug.js`. Het werkruimtelid blijft een
   productinstantie en geen juridische relatie (`TENANT.md`). Wat dit kost staat
   er eerlijk bij: `kern/payroll` noemt `employment` vandaag nul keer, dus de
   loonkant moet om.
2. **Stap 7 -- de keten wordt rond gemaakt.** De weigering van `werving.suite` in
   `server/kern/wereld/lijsten.js` blijft staan zolang de keten van vacature tot
   loon niet rond is. Dat is geen "blijft dicht" maar de opdracht: het doel is de
   hele keten, en de suite gaat pas open als een geheel. Een half proces opent hij
   nooit.
3. **Stap 9 -- Métier is de bron van vaardigheden.** Het loopbaanprofiel bestaat
   voor elke mens, ook zonder bedrijf, en heeft al een naamvrijgave per werkgever.
   Het professionele profiel van Zakelijk gaat eruit lezen; er komt een gedeelde
   lijst die de negen plekken opneemt en geen tiende wordt.
4. **Eerstvolgende stap: de Adamproef verlengen** (stap 5) voorbij *aangenomen*,
   naar werkrelatie, contract en loon. Dat is meten en geen bouwen, en het maakt
   besluit 1 hard: waar de keten breekt, staat dan in een register in plaats van
   in deze paragraaf.

De rest van par. 6 wacht op deze negen. De solver (106), de what-if-promotie
(107), het geheugen (126, 127, 129) en de agents met eigen reikwijdte (122, 124)
wachten bovendien op besluiten die elders al openstaan: de mandaatbesluiten uit
`MANDAATPROEF.json`, INT-03, en `RTG_HERKOMST_AFDWINGEN`.

---

## 8. De grenzen die dit voorstel raakt

Geen nieuwe; allemaal bestaande, die hier voor het eerst op arbeid worden
toegepast.

1. **Er komt geen cijfer op een mens**, ook niet intern als sorteersleutel
   (CAR-05, `HDI.md` par. 5.4, INT-04). Vaardigheidsbalkjes, *100% personal fit* en
   een matchpercentage zijn allemaal zo'n cijfer. Wat een vacature eist is
   zichtbaar; RTG past het nooit toe op een mens (`server/kern/knelpunt/aanvoer-werk.js`).
   `test/cijferopmens.test.js` bewaakt Métier, werving, concern, payroll en het Werk
   OS vandaag níét, en dat hoort te veranderen vóór er een talentmeter komt.
2. **Een mens is geen resource** (`PLANNING.md` par. 5). Een tijdelijke pool vult
   een behoefte met mensen die per stuk toestemming geven, met een einddatum.
3. **Er wordt niet geworven op geslacht, leeftijd of een afgeleide situatie.**
   `CARRIERE.md` noemt een zoekopdracht daarop letterlijk het product dat niet mag
   bestaan. De wervingscode heeft geen veld voor geslacht, en dat blijft zo.
4. **Kennis uit hoedanigheid A wordt nooit stil gebruikt in hoedanigheid B**
   (MN-02). Wie gaat kijken, wordt niet gezien door wie hij wil verlaten; een
   Foundation-herkomst wordt nooit een verborgen wervingssignaal.
5. **Alleen toevoegen** (`FOUNDATION.md` par. 5.3). Een vondst is geen recht
   (`MAATSTAF.md` par. 7i), en een ontbrekende vaardigheid sluit geen weg af.
6. **Wat een tweede persoon bereikt, bevestigt een mens** (`FABRIC.md` par. 5,
   `LIFE.md`). Een uitnodiging voor een gesprek, een publicatie en een interne
   kandidaatstelling zijn altijd een voorstel.
7. **Rekent, of bezit?** De Work-laag rekent. Wat bezit, blijft in het domein.

---

## 9. Wat dit document niet zegt

De inventaris is door lezers gemaakt en door tweede lezers aangevochten. Dat is
geen proef. Wat er in par. 4 *gelezen* heet, is niet beproefd, en de standen in
par. 6 zijn oordelen met bewijs, geen meetuitslagen.

De vormmeting van par. 0 staat niet als register in de repo en heeft daarom graad
`vermoed`. Ze leest, net als `scripts/objectmodel.js`, alleen wat die lezer kan
zien; een vorm die in een route woont is voor haar onzichtbaar, en dat is een gat
en geen nul.

En de meting zegt dat arbeid geen OBJECT is. Ze zegt niet dat RTG arbeid niet kan
begrijpen, en al helemaal niet dat de positionering uit het voorstel verkeerd is.
*Van kans naar aantoonbaar werk* is precies wat de Adamproef al voor de helft
loopt. De vraag is niet of die keten er komt, maar of hij eindigt bij één
werkrelatie of bij drie.
