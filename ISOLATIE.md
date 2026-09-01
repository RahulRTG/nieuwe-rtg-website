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
| Schaduw: onenigheden | 4643 | 865 strenger | 16 losser | 2567 zonder profiel |
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
| `effecten.js` | wat een handeling **doet**, en wat een stand sluit — in de schaduw |
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
| organisatie | reden, passkey, apparaat, wachttijd (30 min), tweede paar ogen |
| identiteit | reden, passkey, apparaat, wachttijd (10 min) |
| sessie · apparaat | reden, passkey, apparaat |

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
beschermstand en meldt waar de twee het **oneens** zijn — 865 keer strenger, 16
keer losser, 2567 paden zonder profiel. Die drie worden nooit opgeteld: ze vragen
om drie verschillende dingen.

Een pad zonder profiel geeft **nooit** een lege lijst terug. Leeg leest als "dit
doet niets", en dat is de gevaarlijkste zin in een beveiligingslaag.

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

Het is de eigenaar-console en niet het scherm van een lid. Een lid dat zijn eigen
isolatie aanzet is een echte en goede functie, maar hij vraagt zijn eigen weg —
ledenpoort, eigen scherm, eigen toon — en is dus geen parameter aan deze route.
Hij staat als schuld en niet als een half werkende knop.

## 5b. Wat hierna komt

1. ~~SEC-LOCK-invarianten~~ · 2. ~~Eerlijke `ISOLATIEPROEF.json`~~ ·
   3. ~~Drager-model~~ · 4. ~~Ontsluitceremonie~~ — **staan**
5. **Het effectmodel uit de schaduw halen.** 2567 paden zonder profiel is de
   prijs; die moet omlaag voordat afdwingen iets anders is dan gokken.
6. **`isolatie` per drager echt strenger maken dan `beschermd`.** Vandaag houden
   ze even veel tegen — het huis isoleert door elke functieschakelaar om te
   zetten, en een schakelaar is huis-breed. Dat staat als `nietGebouwd` in het
   antwoord en niet als een stilte.
7. **Een ceremonie voor het huis.** De vier dragers eronder hebben er een; het
   huis heeft een getypte zin. Dat het huis achterloopt op zijn eigen dragers is
   de scherpste openstaande schuld.
8. **Invariant op onvertrouwde invoer** — *onvertrouwde inhoud kan de beschikbare
   capabilities nooit vergroten.* Voor een platform waarvan de AI kan handelen is
   dit de verdediging tegen indirecte prompt-injectie.
9. **Uitrolbewijs** voor egress, parsers en netwerksegmentatie — de 88 regels die
   `ONBEPAALD_INFRA` dragen.
10. **Adaptieve escalatie** — pas hierna. `VERTROUWEN.json` staat op 0 bewezen en
   4180 verzwakt: een risicomotor die daarop stuurt, stuurt op niets.

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
