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

`kern/veiligheid/ordening.js` maakt er daarom een **paar** van:

```
trede       normaal < waakzaam < beperkt < isolatie   (een echte ladder)
beschermd   waar of niet                              (een eigenschap)
```

De legacy-modus `beschermd` vult alleen de tweede helft in en zegt over zijn
trede **niets**. Vergelijken levert dus vier uitkomsten en geen drie:
`strenger`, `zwakker`, `gelijk`, **`onvergelijkbaar`**. Wie die vierde niet apart
afhandelt, heeft in de praktijk `zwakker` gekozen zonder het op te schrijven —
daarom telt een niet te ordenen overgang als een **verlaging**, met `zeker:
false` erbij zodat zichtbaar is dat er een indeling ontbreekt.

Samenvoegen over dragers is een **join per component** en geen maximum over een
getal: de hoogste bekende trede, `beschermd` waar zodra één drager hem draagt, en
`tredeOnbepaald` blijft zichtbaar als er een onbekende tussen zat.

> **Wat dit blootlegde.** `incidentcontrole-bescherm.js` weigert vandaag te
> beschermen als het platform in isolatie staat, met de reden *"beschermen is dan
> een stap terug"*. Dat behandelt `beschermd` wél als een trede onder `isolatie`,
> en spreekt de kop van `incidentcontrole.js` tegen. Dat is een besluit voor het
> drager-model (§5), niet iets om hier stil recht te trekken.

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
| AI-bereik onder isolatie | — | — | — | `ONBEPAALD` |
| Ontsluiting | 1 handeling | — | `ONBESLIST` | — |

Drie dingen die deze ronde meteen opleverde:

1. **De blinde vlek is 69 paden.** `houdtTegen()` geeft `null` zodra er geen
   functie in de catalogus achter een pad hangt — er valt dan niets in te delen,
   en tegenhouden op grond van niets is raden. Verdedigbaar, maar die paden
   passeren de beschermstand ongemerkt. Ze staan met naam in het register: een
   blinde vlek die je niet kunt opnoemen, is er geen die je kunt sluiten.
2. **Er is geen AI-kolom onder isolatie**, en dat staat er als `ONBEPAALD` met de
   reden. `beleid.js` kent de incidentstand niet; er bestaat geen smallere
   AI-lijst die tijdens een incident geldt. Bevoegd zijn en beschikbaar zijn
   vallen dus nog samen.
3. **Nul procesisolatie.** 45 bestandsverwerkers draaien in het hoofdproces van
   de server, zonder eigen geheugen-, CPU- of tijdgrens.

De acht open punten staan vooraan in het register, niet in een voetnoot.

## 5. Wat hierna komt, in deze volgorde

1. ~~SEC-LOCK-invarianten~~ — **staat**
2. ~~Eerlijke `ISOLATIEPROEF.json`~~ — **staat**
3. **Drager-model** — `huis`, `organisatie`, `identiteit`, `sessie`, `apparaat`,
   `workload`. `beschermstand.houdtTegen(functie)` wordt
   `beschermstand.besluit({ functie, context })` en geeft een **verklaard**
   besluit terug (reden, regel, drager, bewijs) in plaats van een boolean —
   zodat audit, incidentonderzoek, scherm en toets alle vier kunnen uitleggen
   wáárom iets werd tegengehouden. De identiteitskennis blijft in die ene
   context; hij lekt niet de codebasis in. Hier hoort ook het besluit uit §2
   thuis: wordt `beschermd` een echte eigenschap naast de trede, of blijft het
   een vijfde modus?
4. **Capability-model** — een route verklaart welke effecten hij nodig heeft
   (`EXTERN_DELEN`, `BULK_EXPORTEREN`, `IDENTITEIT_WIJZIGEN`, …) en de centrale
   laag beslist. Dat is de enige vorm die bij duizenden routes overeind blijft,
   en hij maakt isolatie **effectgericht**: een nieuw pad met dezelfde strekking
   valt vanzelf onder dezelfde grens. Let op `OS.md`: dit mag alleen over
   platformvermogen gaan en nooit over domeinvermogen — dat is de `Asset`-fout.
5. **Ontsluitceremonie** als protocol, niet als veld. Het verzoek verlaagt nog
   niets; alleen de laatste geautoriseerde commit doet dat. Dat voorkomt
   half-afgemaakte beveiligingstransities.
6. **Invariant op onvertrouwde invoer** — *onvertrouwde inhoud kan de beschikbare
   capabilities nooit vergroten.* Voor een platform waarvan de AI kan handelen is
   dit de verdediging tegen indirecte prompt-injectie: systeembeleid en een
   expliciete menselijke opdracht zijn gezaghebbend, documentinhoud en
   toolresultaten zijn dat nooit.
7. **Uitrolbewijs** voor egress, parsers en netwerksegmentatie — de 88 regels die
   nu `ONBEPAALD_INFRA` dragen.
8. **Adaptieve escalatie** — pas hierna. `VERTROUWEN.json` staat op 0 bewezen en
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
