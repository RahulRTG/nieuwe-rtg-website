# RTG Isolatiemodus — het beveiligingscontract per drager

*Stand: 1 september 2026. Dit document beschrijft wat er **staat**, wat een
**besluit vraagt** en wat **ontbreekt** — zoals `PLATFORM.md` en `EXECUTIE.md`,
zodat niemand die drie voor elkaar aanziet.*

De definitie waar alles aan hangt:

> **Isolatie is geen functie die functies uitschakelt. Het is een per-drager
> veiligheidscontract dat beschikbare effecten verkleint, nooit stilzwijgend
> zwakker kan worden, en waarvan iedere geclaimde grens een expliciete
> bewijsgraad heeft.**

Dat is bewust geen kopie van Apple's Lockdown Mode. Apple beschermt een toestel
en een OS. RTG heeft daarnaast identiteiten, bedrijven, AI-agenten, gereedschap,
financiële handelingen, integraties en multi-tenant data — en zijn AI kan
handelen. De vraag is hier dus niet "welke webtechnieken zetten we uit" maar
"welke **effecten** blijven bereikbaar, voor welke **drager**, en wie kan dat
weer verzwakken".

## 1. De fundering die er al lag

Dit is geen greenfield. Vóór dit werk stond er al:

| Onderdeel | Waar | Wat het doet |
|---|---|---|
| Vijf standen | `kern/incidentcontrole.js` | `normaal`, `waakzaam`, `beperkt`, `beschermd`, `isolatie` — met opzet géén ladder |
| Eén centraal profiel | `kern/beschermstand.js` | bevriest per **categorie** over 204 functies, met drie fail-fasts bij het laden. Nul verspreide `if (isolatie)` |
| De veilige noodstand | `kern/incidentcontrole-bescherm.js` | de enige stand die géén schakelaar omzet, met een bewijszegel over de hashketen |
| AI closed-by-default | `kern/stuur/beleid.js` | `lezen` / `klein` / `voorstel`; alles wat niet genoemd is, is verboden |
| SSRF-afweer | `kern/ssrf.js` | voor doelen die een *client* aanlevert |
| Schaduwdraaien | `kern/stuur/schaduw.js` | je kunt niet afdwingen wat nooit in de schaduw heeft gelopen |

**Het gat zat niet in de functies maar in de as.** Alle vijf standen zijn
huis-breed en operator-gedreven: één veld,
`db.data.techniek.incidentcontrole.modus`. RTG kon niet zeggen *"dit ene lid
staat in isolatie"*.

## 2. De ordening — een paar, geen getal

`kern/incidentcontrole.js` zegt met zoveel woorden dat de vijf standen geen
ladder zijn: `beschermd` staat er dwars op. Zolang dat vijf tekenreeksen zijn,
kan niemand die zin afdwingen — en dan schrijft iemand op een dag `max(niveau)`,
slaat `beschermd` over omdat `isolatie` hoger klinkt, en maakt precies de keuze
die `BESTUUR.md` grens 6.10 wil voorkomen.

`kern/isolatie/ordening.js` maakt er daarom een **paar** van:

```
trede       normaal < waakzaam < beperkt < isolatie   (een echte ladder)
beschermd   waar of niet                              (een eigenschap)
```

Vergelijken levert dan vier uitkomsten en geen drie: `strenger`, `zwakker`,
`gelijk`, **`onvergelijkbaar`**. Wie die vierde niet apart afhandelt, heeft in de
praktijk `zwakker` gekozen zonder het op te schrijven — daarom telt een niet te
ordenen overgang als een **verlaging**, met `zeker: false` erbij zodat zichtbaar
is dat er een indeling ontbreekt.

Samenvoegen over dragers is een **join per component** en geen maximum over een
getal: de hoogste bekende trede, `beschermd` waar zodra één drager hem draagt.

**Twee invullingen die uit de code komen en niet uit de naam**, en allebei zijn
ze eerst fout gegaan:

- **`beschermd` krijgt trede `normaal`.** De eerste versie gaf hem er geen —
  "want hij zegt niets over de ladder". Dat leek eerlijk en was fout: het maakte
  de overgang `normaal → beschermd` onvergelijkbaar, en dus telde het **aanzetten**
  van de veilige noodstand als een verlaging die een ceremonie vroeg. Precies de
  drempel voor de veilige keuze die grens 6.10 verbiedt. `incidentcontrole-bescherm.js`
  zet geen enkele schakelaar om, dus op de ladder staat hij op normaal; zijn hele
  strengheid zit in de eigenschap ernaast.
- **`isolatie` draagt de eigenschap ook.** Wat isolatie sluit is een
  bovenverzameling van wat de beschermstand sluit. Daarmee is `isolatie >
  beschermd` nu **afgeleid** in plaats van beweerd — en is de tegenspraak weg die
  hier eerder stond: `incidentcontrole-bescherm.js` weigert te beschermen tijdens
  isolatie met de reden *"beschermen is dan een stap terug"*, en die zin volgt nu
  uit de vorm.

Wat hierdoor **niet** verandert: `beschermd` en `beperkt` blijven onvergelijkbaar.
De een bevriest zes categorieën, de ander zet genoemde functies uit. Dat is de
botsing waar het altijd om ging.

## 3. De vier invarianten

`test/seclock.test.js`. Alle vier zijn ze **zien zakken** (LAT.md regel 2); de
mutaties staan in de kop van dat bestand.

**SEC-LOCK-001 — geen verlaging zonder ceremonie.** Elke overgang naar een
zwakkere óf niet te ordenen stand telt als verlaging. De enige verlagende
handeling (`herstel`) staat achter `eigenaarAlleen`, een getypte bevestiging en
een verplichte reden, en de toets leest dat uit de **bron**.

**SEC-LOCK-002 — de AI kan de beveiliging niet opheffen.** Geen beveiligingspad
is AI-bereikbaar. Twee keer gemeten, met opzet: één keer tegen
`EXECUTION_MAP.json` (4643 rijen — een bouwartefact dat een commit kan
achterlopen) en één keer rechtstreeks tegen de regexen in `beleid.js`, zodat een
nieuwe regel meteen zakt en niet pas na `npm run executionmap`.

**SEC-LOCK-003 — een kind neutraliseert zijn ouder niet.** Over alle 25 paren
standen: geen drager-stand kan de beperking van een hogere drager opheffen. Huis
in isolatie + sessie op normaal blijft isolatie. Dit volgt uit de join en is dus
geen tweede regel maar een controle op de eerste.

**SEC-LOCK-004 — onbekend is niet normaal.** Hier stond
`if (!MODI.includes(s.modus)) s.modus = 'normaal'`, en dat is een **fail-open**:
een beschadigd of gemanipuleerd veld zette het platform stilzwijgend in de
zwakste stand, precies op het moment dat er iets aan de hand was. Terugvallen op
`isolatie` zou het huis platleggen op grond van een tikfout — de knop die volgens
grens 6.10 niet gebruikt wordt. Het valt daarom terug op **`beschermd`**: de
enige stand die geen schakelaar omzet, het lezen laat doorlopen en toch de zes
bevoorrechte categorieën bevriest. Met een kritieke melding en zichtbaar in het
antwoord van de server (`standOnbepaald`), niet alleen in een logregel.

## 4. De meting — `ISOLATIEPROEF.json`

`npm run isolatieproef`. **Er staat met opzet geen samengesteld cijfer boven.**
"93% minder aanvalsoppervlak" is fictie zodra teller en noemer uit verschillende
inventarissen komen — exact de fout die `MUTATIEINVENTARIS.json` moest
repareren. Vijf uitslagen, en de vijfde is de belangrijkste:

`BEWEZEN_GEBLOKKEERD` · `BEWEZEN_TOEGESTAAN` · `ONBESLIST` ·
`NIET_TOEPASSELIJK` · **`ONBEPAALD_INFRA`**

Een applicatietoets die vaststelt dat een parser geen HTTP-client importeert,
heeft **niet** bewezen dat die parser geen internet heeft — alleen dat de code er
niet om vraagt. Dat verschil is het verschil tussen een veiligheidsclaim en een
veiligheidsgevoel.

De eerste ronde (1 september 2026):

| Noemer | Gevonden | Geblokkeerd | Onbeslist | Onbepaald-infra |
|---|---:|---:|---:|---:|
| HTTP-paden | 4643 | 1148 | 69 | 0 |
| Functies in de catalogus | 204 | 56 | 0 | 0 |
| Uitgaande bestemmingen | 43 | 0 | 0 | 43 |
| Bestandsverwerkers | 45 | 0 | 0 | 45 |
| AI-bereik (lid, onder `beschermd`) | 120 | 28 | 0 | 0 |
| Onder `isolatie` (leesset) | 4643 | 3702 | 0 | 0 |
| Schaduw: onenigheden | 4643 | 900 strenger | 40 losser | 2453 zonder profiel |
| Effectdekking | 4643 | 369 verklaard · 150 afgeleid | 1671 vermoed | 2453 onbekend |
| Dragers | 6 | 5 met bron | 1 zonder | 0 |

Drie dingen die deze ronde meteen opleverde:

1. **De blinde vlek is 69 paden.** `houdtTegen()` geeft `null` zodra er geen
   functie in de catalogus achter een pad hangt — er valt dan niets in te delen,
   en tegenhouden op grond van niets is raden. Verdedigbaar, maar die paden
   passeren de beschermstand ongemerkt. Ze staan met naam in het register: een
   blinde vlek die je niet kunt opnoemen, is er geen die je kunt sluiten.
2. **De 69 blinde paden zijn nagelopen**, en het effectmodel zag er 46 tussen die
   de beveiliging kunnen verzwakken — allemaal `/api/techniek/*`. Die zijn
   eigenaar-only en bewust buiten de functieschakelaars (`routes/techniek/controle.js`):
   dat is de hand die repareert, en die mag tijdens een incident niet vastzitten.
   De meter meldt ze daarom apart als *bij ontwerp*, met **0 in de werklijst** —
   een meter die een alarm slaat dat een verklaring heeft, wordt uitgezet. Wat de
   observatie wél waard blijft: de beschermstand heeft geen grip op de eigen
   console van de eigenaar, en daar hangt punt 7 hierboven aan.
3. **Nul procesisolatie.** 45 bestandsverwerkers draaien in het hoofdproces van
   de server, zonder eigen geheugen-, CPU- of tijdgrens.

De acht open punten staan vooraan in het register, niet in een voetnoot.

## 5. De laag zelf

`server/kern/isolatie/` — zeven bestanden, elk met één taak.

| Bestand | Wat het doet |
|---|---|
| `ordening.js` | wat is strenger dan wat, en wanneer is dat niet te zeggen |
| `dragers.js` | de zes dragers, wie welke stand mag zetten |
| `effectwoorden.js` | de dertien effecten, en verder niets |
| `effecten.js` | wat een handeling **doet** — in de schaduw |
| `effectregister.js` · `effectcollecties.js` | de uitspraken: per pad en per collectie |
| `standsluiting.js` | wat een stand dichtzet |
| `proefmeting.js` | de enige lezer van `IDEMPROEF.json` in deze laag |
| `leesset.js` | wat er onder `isolatie` overblijft, en waarom dat gemeten is |
| `besluit.js` | het verklaarde besluit: waarom niet, en van wie |
| `ontsluiting.js` | verlagen als protocol |
| `opslag.js` | de enige deur naar `db.data` |
| `index.js` | de enige plek waar een stand verandert |

**`index.js` is de handhaving zelf, niet de ordening.** `zet()` weigert
structureel elke verlaging — niet met een controle die je kunt vergeten mee te
nemen, maar omdat er geen andere weg naar beneden is dan een voltooide ceremonie.
Dat is SEC-LOCK-001 in code in plaats van in een document.

**De stand van het huis wordt gelezen en niet bezeten.** Hij woont in
`kern/incidentcontrole.js`, waar hij altijd al woonde. Hem hierheen kopiëren zou
twee waarheden maken over dezelfde stand.

### De ceremonie

Het verzoek verlaagt niets. Het verzamelt bewijs; pas de laatste geautoriseerde
commit levert een nieuwe stand op — en die schrijft hem niet weg maar geeft hem
terug. Zonder die scheiding ontstaan half-afgemaakte beveiligingstransities: een
ceremonie die halverwege afbreekt en een stand achterlaat die niemand koos.

De eisen volgen uit de overgang en uit de drager, en `onvergelijkbaar` telt als
de zwaarste verlaging — een overgang die niemand heeft ingedeeld krijgt niet het
voordeel van de twijfel:

| Drager | Eisen voor `isolatie → normaal` |
|---|---|
| huis · organisatie | reden, passkey, apparaat, tweede paar ogen |
| identiteit | reden, passkey, apparaat, wachttijd (10 min) |
| sessie · apparaat | reden, passkey, apparaat |

**Het huis heeft er nu ook een.** Het liep achter op zijn eigen dragers: `herstel`
verlaagt de stand van het hele platform en vroeg alleen om eigenaar-only, een
getypte zin en een reden. Die zin is nu de rem tegen een misklik; de grens is de
ceremonie.

**Waarom het huis géén wachttijd heeft, tegen de verwachting in.** De eerste
opzet gaf het de langste — een uur — want het raakt iedereen. Dat is de verkeerde
redenering en ze is duur: een wachttijd op het *herstel* van het platform is een
zelf toegebrachte storing, en wie na een vals alarm een uur moet wachten, zet de
isolatiestand de volgende keer niet aan. Waar een wachttijd vóór is — een echte
eigenaar tijd geven om te merken dat iemand anders zijn beveiliging openzet —
doet een **tweede mens** beter en meteen. Het huis en de organisatie ruilen de
klok dus in voor vier ogen; de dragers eronder hebben geen tweede mens en houden
de klok.

**En waar die tweede mens niet bestaat.** In een opstelling met één eigenaar is
vier ogen nooit te halen, en dan is het platform na een incident *onherstelbaar*
— geen strenge beveiliging maar een storing die je zelf inbouwt. Zo'n eis wordt
bovendien altijd omzeild: iemand maakt een tweede account om zichzelf goed te
keuren, en dan is het principe een formaliteit mét een extra sleutel die
rondslingert. Dus: bestaat er een tweede bevoegde mens, dan is hij verplicht;
bestaat hij aantoonbaar niet, dan gaat het door als **noodontsluiting** — gemerkt,
gemeld, en blijvend in het spoor. De waarde zit daar niet in het tegenhouden maar
in het niet kunnen verbergen. Het is geen keuze van de aanvrager: hij levert het
gegeven niet, de laag erboven telt het.

Het tweede paar ogen is aantoonbaar een **ander** paar; zonder die regel voert
dezelfde mens de vier-ogencontrole twee keer uit. **Verstrengen kent geen
ceremonie** — dat is de andere helft van SEC-LOCK-001, en geen vergetelheid.

`passkey` en `apparaat` worden hier **afgetekend** en niet uitgevoerd: het bewijs
komt van `server/webauthn/`. Een ceremoniemodule die zelf mag besluiten dat er is
ingelogd, is geen ceremonie.

### Het effectmodel — in de schaduw

Dertien platform-effecten (`GELD_BEWEGEN`, `BEVEILIGING_VERZWAKKEN`,
`VERTROUWENSRELATIE_AANGAAN`, …). Ze gaan over "mag deze aanroep, en doet hij
het?" en nooit over "wat voor zaak is dit" — dat laatste is de `Asset`-fout, en
die is hier al een keer gemaakt (`OS.md` par. 4).

**Hij handhaaft niets, en dat is het ontwerp.** `CONTROLPLANE.md`: een nieuwe
handhavingsregel loopt eerst mee zonder te blokkeren. Hij rekent mee naast de
beschermstand en meldt waar de twee het **oneens** zijn — 900 keer strenger, 40
keer losser, 2453 paden zonder profiel. Die drie worden nooit opgeteld: ze vragen
om drie verschillende dingen.

Een pad zonder profiel geeft **nooit** een lege lijst terug. Leeg leest als "dit
doet niets", en dat is de gevaarlijkste zin in een beveiligingslaag.

#### De derde bron: gemeten collecties

Het model had 2513 paden zonder profiel, en de voor de hand liggende reactie —
meer verklaringen schrijven — betekent 4643 paden één voor één nakijken. Zo'n
register loopt vol met gissingen.

De uitweg is een **kleinere noemer**. `IDEMPROEF.json` heeft per route gemeten
welke **collecties** bewogen, en dat zijn er 236 — een lijst die een mens wél kan
nalopen. De afleiding wordt: *route → (gemeten schrijfactie) → collectie →
(register) → effect*, en alleen de laatste pijl is mensenwerk. 85 van de 236 zijn
ingedeeld: geld, identiteit, rechten, blijvende koppelingen en de beveiliging
zelf — wat een hoog belang draagt en waarover geen redelijke discussie bestaat.

**Vier graden**, en de volgorde is een rangorde van bewijs: `verklaard` (een
patroon met een grond) → `afgeleid` (een gemeten schrijfactie in een ingedeelde
collectie) → `vermoed` (de categorie van de functie) → `onbekend`. Dat `afgeleid`
boven `vermoed` staat is één keer duur geweest: `/api/adres/zoek` viel dicht met
de reden `IDENTITEIT_WIJZIGEN` omdat zijn functie in "Toegang en identiteit"
zit. Een categorie zegt waar iets *woont*, een meting wat het *doet*.

**De twee bronnen worden opgeteld, niet gerangschikt — en dat is een besluit uit
een meting.** Over de 31 paden waar allebei iets zeggen, overlappen er 26 en
staan er 5 zonder overlap. Die vijf spreken elkaar níét tegen: `/api/member/ai/tegoed`
roept een model aan (dat ziet de verklaring aan de naam) én beweegt tegoed (dat
ziet de proef in de collectie). Ze zien met opzet verschillende dingen — de proef
kijkt in de opslag en zegt zelf dat zij bestanden en uitgaande aanroepen niet
ziet; de verklaring leest de naam en kent geen collecties. Elkaars blinde vlek.
Wie er één de ander laat overschrijven, gooit telkens een van beide effecten weg.

#### Waarom het model tóch niet uit de schaduw komt

| | was | nu |
|---|---:|---:|
| verklaard | 282 | **369** |
| afgeleid | — | **150** |
| vermoed | 1794 | 1671 |
| **onbekend** | **2513** | **2453** |

De dekking bewoog nauwelijks, en dat is de bevinding. **Zelfs als alle 236
collecties waren ingedeeld, blijven 2217 paden onbekend** — want een pad waar de
proef nooit met succes langskwam, raakt géén collectie, hoeveel namen er ook in
het register staan.

> **De blokkade is de proef, niet het register.** Dat is nu een getal in plaats
> van een gevoel, en het verandert wat er hierna moet gebeuren: niet vijftig
> regels erbij, maar `IDEMPROEF.json` verder laten reiken. Met 2453 van 4643
> paden zonder profiel zou het model over meer dan de helft van het huis moeten
> raden — en raden in de gesloten richting legt het platform plat, raden in de
> open richting beschermt niets. `magHandhaven: false` staat daarom in het
> register mét die reden.

**Wat het wél opleverde:** de werklijst van blinde vlekken ging van 0 naar 4.
`/api/privacy/delete` heeft geen functie in de catalogus — dus de beschermstand
bevriest hem niet tijdens een incident — terwijl de gemeten collecties laten zien
dat hij rechten, identiteit, andermans gegevens, koppelingen én de beveiliging
raakt. Of dat een gat is of een bewuste keuze (een AVG-verzoek mag je niet zomaar
blokkeren) is een besluit van de eigenaar; het staat in het register en is niet
stil rechtgetrokken.

### Wat `isolatie` overlaat — en waarom dat gemeten is

`beschermd` bevriest zes categorieën. `isolatie` moet strenger zijn, maar de voor
de hand liggende regel — *alleen GET* — zet in dit huis alles dicht: er zijn 3728
schrijfroutes tegenover 35 GET-routes, dus het **lezen loopt hier ook over POST**.
Die regel zou een lid uitloggen in plaats van beschermen.

De regel is daarom omgekeerd: **een pad moet zijn lezerschap verdienen.** Drie
voorwaarden, alle drie:

1. **Gemeten geen effect.** `IDEMPROEF.json` draaide een kale oproep tegen de
   draaiende server en keek daarna in de opslag. Een pad dat werkelijk werk deed
   (2xx) en geen enkele collectie bewoog, is een lezer — gemeten, niet gevonden.
   Dat zijn er **1236**.
2. **Het effectmodel ziet er niets geslotens in.** Die meting noemt haar eigen
   blinde vlek: `nietGemeten: bestand,externe-aanroep`. `/api/agenda/ai` bewoog
   geen collectie en roept wél een model aan — dat kost geld en verlaat het huis.
   De twee bronnen moeten het eens zijn; één ervan zou onvoldoende zijn.
3. **De beschermstand laat het door**, want isolatie draagt die eigenschap ook.

**Veroudering maakt dit register strenger en nooit losser**, en dat is waarom een
bouwartefact hier wél de autoriteit mag zijn terwijl `kern/stuur/plan.js` dat
uitdrukkelijk verbiedt. Daar is de kaart een lijst van wat *mag*: loopt zij
achter, dan staat er iets open dat dicht hoorde. Hier is de meting een lijst van
wat *bewezen onschadelijk* is: loopt zij achter, dan is een nieuw pad simpelweg
niet bewezen en gaat het dicht.

Het resultaat, over 4643 rol-paden: `beschermd` laat er **3495** door, `isolatie`
nog **941**.

**Wat dat kost, en dat hoort er even groot bij te staan.** 3074 paden zijn nooit
met succes gemeten — de proef kwam er niet bij: geen wereld, geen object, geen
rol. Die gaan onder isolatie dicht, en een deel ervan zijn onschuldige lezers.
Isolatie is dus botter dan hij hoeft te zijn, en dat wordt minder naarmate
`IDEMPROEF.json` verder komt — niet naarmate deze module slimmer wordt.

> **Twee fouten die de eerste versie hier maakte.** Hij liet ook `vermoed`
> blokkeren, en toen viel `/api/adres/zoek` dicht met de reden
> `IDENTITEIT_WIJZIGEN` — want zijn functie zit in de categorie "Toegang en
> identiteit". Een adres opzoeken wijzigt geen identiteit: een categorie zegt
> waar iets *woont*, een gemeten kale oproep zegt wat het *doet*, en waar die
> botsen wint de meting. En de AI-blinde vlek die hij claimde te dekken, dekte
> hij niet: het effectmodel had geen regel voor een pad dat een model aanroept.

### Het isolatiefilter

`kern/stuur/isolatiefilter.js`. Wat de beschermstand zou tegenhouden, staat niet
in de lijst waaruit de AI kiest — dezelfde vorm als de bewijspoort in `beleid.js`.
Voor een lid in de beschermstand: **120 → 92** paden, en voor een leverancier
**53 → 32**.

Twee dingen die het meteen goed moest doen. Het is per constructie een
**versmalling**: wie er ooit iets aan toevoegt, heeft van een beveiligingsfilter
een tweede allowlist gemaakt. En het weegt lezers als `GET` — de eerste versie
versneed 42 paden waaronder `/api/bank/afschrift`, en een filter dat een lid zijn
eigen afschrift ontneemt breekt de belofte dat het lezen doorloopt.

### De cockpit

`/apps/isolatie.html`, achter `techAuth` + `eigenaarAlleen`, met een **proef** die
niets uitvoert: wie besluit een klant dicht te zetten, hoort eerst te zien wat
die klant dat kost. Dat is de reden dat het besluit verklaard is en geen boolean.

### Het scherm van het lid

`/apps/mijn-isolatie.html` (Instellingen → Accountbescherming), achter de gewone
ledenpoort. Een aparte pagina en niet dezelfde met een vlag erbij: het kantoor
doet *containment* — bij een verdenking iemand dichtzetten — en dit is het
omgekeerde, een mens die zelf denkt dat er iets mis is. Andere handeling, andere
toon ("je/jij"), andere bevoegdheid.

**De enige regel die daar echt telt: de sleutel komt uit de sessie en nooit uit
het verzoek.** Zou een lid zijn eigen sleutel mogen meesturen, dan kan hij de
sessie van iemand anders in isolatie zetten — een aardig klinkende functie die in
werkelijkheid een uitlogknop voor willekeurige leden is. Een lid zet alleen zijn
eigen `identiteit`, `sessie` en `apparaat`; `organisatie` en `huis` niet.

Verlagen loopt ook voor een lid langs de ceremonie, en dat is met opzet niet
lichter gemaakt: juist bij een lid is het scenario dat zij moet vangen — iemand
heeft de sessie overgenomen en zet de bescherming weer uit — het meest
waarschijnlijk.

De tegel heet **Accountbescherming** en niet "Bescherming": `RTG Veilig` staat
ernaast en gaat over de veiligheid van een *mens* (stil alarm, codewoord). Twee
tegels die allebei "bescherming" heten, laten een lid op het verkeerde moment op
de verkeerde drukken.

## 5b. Wat hierna komt

1. ~~SEC-LOCK-invarianten~~ · 2. ~~Eerlijke `ISOLATIEPROEF.json`~~ ·
   3. ~~Drager-model~~ · 4. ~~Ontsluitceremonie~~ · 5. ~~`isolatie` echt strenger
   dan `beschermd`~~ · 6. ~~Een ceremonie voor het huis~~ · 7. ~~Het scherm van
   het lid~~ — **staan**
8. ~~De derde bron onder het effectmodel~~ — **staat**, met een gemeten
   blokkade: het model komt niet uit de schaduw tot de proef verder reikt.
9. **De proef verder laten reiken** — eerste ronde gedaan, zie hieronder. Elk
   pad dat `IDEMPROEF.json` erbij meet, maakt isolatie minder bot én brengt het
   effectmodel dichter bij handhaven.
10. **Invariant op onvertrouwde invoer** — *onvertrouwde inhoud kan de beschikbare
   capabilities nooit vergroten.* Voor een platform waarvan de AI kan handelen is
   dit de verdediging tegen indirecte prompt-injectie.
11. **Uitrolbewijs** voor egress, parsers en netwerksegmentatie — de 88 regels die
   `ONBEPAALD_INFRA` dragen.
12. **Adaptieve escalatie** — pas hierna. `VERTROUWEN.json` staat op 0 bewezen en
   4180 verzwakt: een risicomotor die daarop stuurt, stuurt op niets.

## 5c. De proef verder laten reiken — eerste ronde

`IDEMPROEF.json` bepaalt allebei de dingen die deze laag beperken: wat er onder
`isolatie` open blijft (de leesset) en hoeveel het effectmodel weet. 3074 paden
waren nooit met succes gemeten. Twee ronden later: **+53 gemeten, +44 bewezen
lezers, +40 met een gemeten collectie, en 0 regressies.**

Wat er is toegevoegd, en waarom die drie:

- **Een leerling in de klas.** De proef bouwde een school, een leraar en een klas,
  maar geen kind. Voor de halve schooladministratie — absentie, rapporten,
  documenten, bijdragen, berichten aan het gezin — is een klas zonder leerling
  een lege huls. Aanmelden én plaatsen, twee routes, want dat zijn het in het
  echt ook.
- **`personeelToken` doorgeven.** Het werd gebouwd en nergens gebruikt. Achttien
  schoolroutes gaven "Onbekende school of verkeerd personeel-token" terwijl de
  leraar gewoon bestond: `server/school/poorten.js` kent drie deuren en het lijf
  droeg er twee.
- **Twee interne genres erbij** (`gemeente`, `luchthaven`), op precies het besluit
  dat voor `rijk` en `ov` al genomen was: een intern genre wordt niet aangevraagd
  maar door RTG zelf aangesloten.

### Drie dingen die deze ronde blootlegde

**Een toevoeging kan de meting verslechteren, en dat ziet er van buiten uit als
vooruitgang.** Het `/api/gemeente/`-voorvoegsel legde de rol onvoorwaardelijk op,
en onder dat pad wonen vijftien routes voor een **burger** naast acht voor de
gemeente. Vijf routes gingen van gemeten naar ongemeten. Het voorvoegsel-mechanisme
kent nu `alleenRol`: de overname geldt alleen waar de route zelf al die soort
actor verwachtte.

**Dezelfde fout stond er al.** `/api/overheid/` is óók gemengd — 33 member-routes
naast 64 van het rijk — en die 33 gaven allemaal 401 "Niet ingelogd als lid". Ze
stonden in de kolom `ongemeten` om een reden die niets met de route te maken had,
en dat was niet te zien: een 401 ziet eruit als een route die nu eenmaal een
andere sleutel wil. `test/idemwereld.test.js` toets 4 houdt dat nu vast.

**Een diagnose die de verkeerde regel aanwijst, is duurder dan geen diagnose.**
De marechaussee kwam niet klaar, en de melding zei "aansluiten gaf 200" — want
`gemist` zoekt de laatste aanroep van een pad, en drie genres deelden die route.
Met een merk per voorwerp gaf hij meteen het echte antwoord: **403, "Voor werk in
dit genre is een eigen RTG-account met een vastgestelde identiteit nodig"** —
`kern/persoonseis.js` met reikwijdte `werk`. Acht routes onder `/api/kmar/`
blijven daarom ongemeten, en dat is de eerlijke uitslag: een proefronde die een
identiteit vaststelt die niemand heeft gezien, verzint precies het bewijs waar
die eis voor is. Dezelfde grens houdt `beveiliging` (status `bewijs`) en de
Kiwa-vergunning van `mob` dicht.

> **De invariant die deze ronde opleverde:** wordt een voorwerp gebouwd, dan moet
> het ook ergens worden **doorgegeven** — `gemist` controleerde alleen het eerste.
> Dat is de stilste manier waarop deze proef onderrapporteert: geen fout, geen
> lege sleutel, geen melding, alleen een kolom `ongemeten` die groter is dan hij
> hoeft te zijn. En die kolom bepaalt wat er onder isolatie dichtgaat.

## 6. Twee grenzen die niet mogen sneuvelen

**Een uitzondering is een verzwakking.** `beschermstand-lijst.js` heeft een
gesloten uitzonderingslijst, en dat is goed. Maar een uitzondering *toevoegen*
hoort dezelfde ceremonie te vragen als een verlaging — anders staat de achterdeur
open: isolatie blijft aan, en elke functie krijgt een uitzondering. De
isolatieproef telt ze daarom apart.

**Meet ook wat er nog wél kan.** Een isolatiestand die niemand durft aan te
zetten, beschermt niets. Naast de veiligheidsboekhouding hoort een lijst kritieke
gebruikersverhalen met per stuk: werkt, werkt beperkt, of werkt niet. Dat is
vandaag `ONGEMETEN` en het staat als schuld in het register — Apple's Lockdown
Mode schakelt het toestel ook niet uit.
