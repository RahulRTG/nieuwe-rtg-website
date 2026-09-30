# Lokale intelligentie

RTG gebruikt de kleinste motor die een taak aantoonbaar goed kan uitvoeren.
Een model is geen standaardroute en nooit een autoriteit. Dit document legt de
grens vast zodat een nieuwe functie niet ongemerkt gebruikersdata naar een
provider stuurt voor werk dat de applicatie zelf kan doen.

## Zonder model

Deze taken blijven in gewone, testbare code en werken offline:

| Taak | Lokale uitvoering |
|---|---|
| Rechten, rollen en privacy | Auth- en bevoegdheidsregels |
| Betalen, boeken, publiceren en toegang | Bestaande workflows plus expliciet menselijk akkoord |
| Rekenen en tellen | Belasting-, btw-, prijs-, datum- en KPI-functies |
| Zoeken, filteren en rangschikken | Indexen, trefwoorden en uitlegbare scores |
| Agenda-invoer | Datum-, weekdag- en tijdparser; alleen onbekende formuleringen mogen naar een model |
| Samenvatten en inkorten | Extractieve selectie uit de brontekst |
| Acties en afspraken aanwijzen | Controleerbare patronen voor wie, wat en wanneer |
| Reactietoon en open vragen | Lokale tellingen en bronzinnen, zonder mensen tegen elkaar af te wegen |
| Office-formules en kwaliteitscontrole | Vaste formulebouwer en structurele controles |
| Gemeentelijke triage | Eenduidige categoriepatronen; alleen `overig` kan een tweede modellezing krijgen |
| Reisadvies uit de catalogus | Uitlegbare lokale score met zichtbare treffers |

De gedeelde primitieve laag staat in `server/lib/lokale-taal.js`. Herkomst staat
in metadata (`bron: lokale-taal` of `lokale-regels`) en wordt niet als technische
rommel in de menselijke tekst geplakt.

## Een lokaal model

Vrij schrijven, open dialoog, genuanceerde vragen, onbekende natuurlijke
opdrachten en beeldduiding hebben wel generatieve of semantische interpretatie
nodig. Geen van die taken vereist technisch een externe provider: een lokale,
OpenAI-compatibele server kan tekst, tool-calling en vision leveren.

```env
LOCAL_AI_URL=http://127.0.0.1:11434
LOCAL_AI_MODEL=<tekstmodel>
LOCAL_AI_MODEL_KORT=<optioneel-kort-model>
LOCAL_AI_MODEL_TOOLS=<optioneel-toolmodel>
LOCAL_AI_MODEL_VISION=<optioneel-visionmodel>
LOCAL_AI_CONTEXT=12288
LOCAL_AI_REASONING=none
LOCAL_AI_REASONING_TOOLS=none
RTG_EXTERNE_AI_UIT=1
```

De provider accepteert standaard alleen loopback. `LOCAL_AI_LAN_TOESTAAN=1`
is een bewuste uitzondering voor een private IP- of hostnaam op het eigen
netwerk; een publieke host wordt ook met die schakelaar geweigerd. De status
onderscheidt daarom `rtg-server` van `eigen-netwerk`. Dat is de server van RTG en nooit het toestel van het lid: `toestel` is gereserveerd voor inferentie in de browser (TOESTEL.md).
`LOCAL_AI_TOOLS=0` voorkomt dat een tekstmodel ten onrechte tool-calling claimt.
Zonder `LOCAL_AI_MODEL_VISION` slaat de keten lokaal beeld over; de afbeelding
wordt nooit stil weggegooid terwijl het model doet alsof het die zag.

Voer na configuratie uit:

```bash
npm run ai:lokaal:check
```

## Het contextvenster: nooit stil afkappen

Een eigen modelserver heeft een venster (Ollama staat standaard op 4096 tokens)
en kapt wat er niet in past STIL af, vanaf het begin. Daar staan juist de
grondwet, de veiligheidsgrenzen en wie Rahul is. Het model antwoordt dan
gewoon, alleen zonder zijn regels, en dat leest als "de lokale AI is dom".

`LOCAL_AI_CONTEXT` verklaart hoe groot het venster is, gelijk aan
`OLLAMA_CONTEXT_LENGTH` en `num_ctx`. Dan gebeuren er twee dingen:

- `server/kern/ai/contextpakket.js` stelt per verzoek een pakket samen dat
  past. Elk blok draagt een soort (grondwet, identiteit, opdracht,
  gereedschap, feiten, gesprek, werk), een bron, een bewijsgraad, een
  prioriteit, en of het verplicht is, mag worden ingekort of mag vervallen.
  De verdeling per soort bestaat uit **plafonds en geen quota**: wat een soort
  niet nodig heeft, wordt niet gevuld. Grondwet, veiligheidsgrenzen en de
  opdracht vallen nooit weg. Eerst wordt ingekort, dan weggelaten, het oudste
  gesprek eerst. De ledenchat (`kern/ai/chatpakket.js`) en de stuurlus
  (`kern/stuur/luspakket.js`) gebruiken hem allebei.
- `server/local-ai.js` weigert een verzoek dat toch niet past met
  `CONTEXT_PAST_NIET`. Het verzoek gaat dan niet de deur uit en de keten wijkt
  uit. Er wordt nooit een afgekapt verzoek verstuurd.

Zonder `LOCAL_AI_CONTEXT` neemt RTG 4096 aan en dwingt het niets af. Deze laag
telt dan alleen hoe vaak een verzoek niet zou passen (`zouNietPassen` op het
luik van de meter). Een grens die nooit heeft meegelopen, dwingen we niet af.

Twee dingen staan in de laag zelf, en niet in dit document:

- **Het levensverhaal van Rahul valt weg, tenzij het lid naar hem vraagt.**
  Dat is het moment waarop hij het volgens zijn karakter mag delen.
- **Oudere stappen van de stuurlus worden ingekort, nooit weggelaten.** Een lus
  die vergeet dat hij een afspraak al had gezet, zet hem nog een keer.

`npm run contextmeting` laat per situatie en venster zien wat er zonder
samensteller zou worden afgekapt en wat er met samensteller gebeurt. De tokens
zijn GESCHAT (tekens gedeeld door drie, graad `vermoed`). De echte telling komt
van de server: `npm run ai:lokaal:check` stuurt een lange tekst met vooraan een
codewoord, vraagt dat terug en legt de telling van de server naast de
schatting. Komt het codewoord niet terug, dan kapt de server af.

## De registerblik: opzoeken in plaats van weten

Een klein model weet niet hoe RTG ervoor staat, en hoeft dat ook niet te weten.
De boardroom-Rahul (`/api/office/boardroom/ai`) krijgt vijf gereedschappen die
RTG's eigen registers LEZEN (`server/kern/registerblik/`), plus een zesde dat de documenten doorzoekt:

| Gereedschap | Leest | Zegt |
|---|---|---|
| `inspecteerRoute` | `EXECUTION_MAP.json`, `VERTROUWEN.json`, `ROUTEBRON.json` | wat de AI met een route mag, of herhalen schade doet, de vervalstaat en waarom, en het bestand |
| `vraagVertrouwenOp` | `VERTROUWEN.json` | de vervalstaat, over alles of per route |
| `vraagBewijsOp` | `BEWIJSSCHULD.json` | wat RTG weet dat het nog niet heeft gemeten, met de sluitweg |
| `vraagProductiestandOp` | `.release/productie-status.json` | de release-uitspraak, doorgegeven en nooit samengesteld |
| `zoekRegister` | `EXECUTION_MAP.json`, `BEWIJSSCHULD.json` | routes en posten bij een woord |
| `zoekKennis` | `KENNISINDEX.json` | de passende stukken uit de documenten, met de registers en bestanden die ze noemen |

De gereedschappen zijn rijk, zodat het redeneerprobleem klein blijft:
`inspecteerRoute` legt zelf drie registers naast elkaar. Elk antwoord noemt
zijn register, hoe oud de meting is en zijn graad. Een meting die ouder is dan
haar houdbaarheid zakt naar `vermoed`: vervallen bewijs is geen bewijs.

**De kennisindex** (`npm run kennisindex`, `KENNISINDEX.json`) knipt de
documenten van dit huis op per kop. Productie krijgt geen enkel `.md` mee, en
de runtime-AI leest alleen registers, dus de index is een register. Er zijn
geen embeddings: een woordindex (BM25) over 162 documenten is uit te leggen en
te beproeven, en een code als `MONEY-012` blijft een heel woord. Afdrukken die
een script uit een register schrijft (`BEWIJS.md`, `FUNCTIES.md`, ...) staan er
met opzet niet in: het register zelf is de bron. Een vondst draagt altijd de
graad `vermoed`, want een document is een bewering. Wat het stuk NOEMT
(registers, bestanden, commando's, datums) staat erbij, zodat Rahul de bewering
aan de huidige werkelijkheid kan toetsen. De index veroudert met de documenten
en niet met de code; hij draagt zijn eigen stempel en de registerblik noemt die
leeftijd bij elke vondst.

Grenzen:

- Er is geen `leesBestand(pad)`. Het model noemt een route of een zoekwoord,
  nooit een bestand. CODE-AI-001 (`test/codegrens.test.js`) houdt dat vast.
- De registerblik deelt geen gereedschap met het stuur. Lezen en uitleggen
  mogen zelfstandig; wijzigen en uitvoeren lopen langs mandaat, beleid en een
  mens.
- Hij staat alleen achter de boardroomdeur. De registers beschrijven hoe RTG
  intern werkt, en dat hoort niet bij een lid of partner.
- Zonder model dat gereedschap kan, valt de boardroom terug op de korte blik,
  en daarna op de regels.

### De staving: staat het antwoord in wat is opgezocht?

Een klein model kan een getal overschrijven, twee tellingen verwisselen of een
route noemen die het nergens zag. `server/kern/stuur/staving.js` legt het
antwoord daarom naast de uitkomsten van de gereedschappen uit diezelfde beurt.

- Het toetst alleen wat deterministisch terug te vinden is: getallen, API-routes
  en registernamen. Dat zijn de ankers van een zin.
- Een anker dat terugkomt, krijgt de graad van de uitkomst waarin het staat. Een
  anker dat nergens staat, krijgt `onbekend`. Dat geldt ook voor een getal dat het
  model zelf uitrekende: geen register draagt dat getal.
- Het antwoord als geheel is nooit harder dan zijn zachtste anker. Een antwoord
  zonder ankers is `onbekend` en wordt dus niet goedgekeurd.
- Er zijn geen nieuwe woorden: alleen de vier graden van het huis
  (`onbekend`, `vermoed`, `gemeten`, `bewezen`).
- De toets beslist niets en houdt niets tegen. De boardroom zet onder het
  antwoord wat niet is teruggevonden, en geeft de volledige staving mee.

Wat hij niet ziet: of een zin zonder anker klopt, en of een gevonden getal in de
juiste betekenis is gebruikt. Een `0` staat vrijwel altijd ergens.

De stuurlus (`kern/stuur/lus.js`) draagt dezelfde staving mee, voor het lid, de
zaak en het personeel. Daar geeft de lus zelf de graad van een uitkomst mee:
- een geslaagde `doe` is een live antwoord van een route uit deze beurt en dus
  `gemeten`, net als de kaart;
- een weigering, een voorstel en een plan zijn `vermoed`, want ze zeggen niets
  over hoe het nu staat;
- de vraag van de mens telt als bron met `onbekend`. Een getal dat het lid zelf
  noemde is geen bewijs, maar ook geen verzinsel van het model.

Een graad in de uitkomst zelf kan de meegegeven graad alleen verlagen. De routes
geven de staving mee als veld `staving`, en de Rahul-tab
(`public/shared/rahul-tab.js`) zet onder het antwoord een regel met wat niet is
teruggevonden. Kwam alles terug, dan staat er niets.

## Externe uitwijk

Externe aanbieders doen alleen mee als hun sleutel expliciet is ingesteld en
`RTG_EXTERNE_AI_UIT` niet aanstaat. De standaardvolgorde is
`local,claude,openai,gemini`. De status-API toont per capability welke routes
mogelijk zijn. Daardoor betekent:

- `lokaal`: alle mogelijke modelverwerking blijft op het eigen apparaat;
- `hybride`: lokaal eerst, maar externe uitwijk is mogelijk;
- `ondersteund`: alleen externe modelproviders;
- `handmatig`: geen model; de lokale kern blijft volledig bruikbaar.

## Menselijke grens

Een model mag voorbereiden, vergelijken of een concept schrijven. Het mag nooit
zelf betaling, publicatie, toegang, definitieve boeking, juridisch besluit of
fiscale beslissing bevestigen. Dat blijft een harde workflowgrens, ongeacht of
het model lokaal of extern draait.

## RTG Kompas op een Mac mini

`scripts/mac/ollama-kompas.sh` maakt de lokale route reproduceerbaar, in twee
profielen:

- **16gb** (standaard): `qwen3.5:4b` als `rtg-kompas` voor korte vragen en beeld,
  plus `qwen3:8b` als `rtg-kompas-brein` voor gesprek en gereedschap. Beide
  blijven tegelijk geladen (`OLLAMA_MAX_LOADED_MODELS=2`), zodat de server niet
  bij elke stap van model hoeft te wisselen. Het venster is 12288 tokens.
- **8gb** (`--profiel=8gb`): alleen `rtg-kompas`, met een venster van 8192.
  Bij 4096 past de ledenprompt van Rahul niet, en dan krijgt het model zijn
  regels niet mee.

Het venster staat op drie plekken gelijk: de server (`OLLAMA_CONTEXT_LENGTH`),
het model (`num_ctx`) en RTG (`LOCAL_AI_CONTEXT`). Het brein wordt uit dezelfde
`Modelfile.rtg-kompas` gebouwd als het kleine model, zodat hun gedragsgrenzen
niet uiteen kunnen lopen. Denken staat in beide profielen uit
(`LOCAL_AI_REASONING_TOOLS=none`), omdat denktokens van hetzelfde
antwoordbudget eten. Zet het pas aan nadat `npm run railvergelijk` op de eigen
machine laat zien dat het helpt.
De installatie bindt uitsluitend aan `127.0.0.1`, schakelt Ollama Cloud dubbel
uit (omgeving én `server.json`), gebruikt Metal, laat maar één verzoek tegelijk
rekenen en haalt het model na drie minuten rust uit het geheugen.

```bash
scripts/mac/ollama-kompas.sh
scripts/mac/ollama-kompas.sh --controle
```

De ingecheckte `Modelfile.rtg-kompas` voegt de gedragsgrens toe. De server blijft
de echte autoriteit: de modeltekst kan nooit zelf de status `lokaal` bepalen,
een recht verlenen of een goedkeuring afronden. De zichtbare Kompas-kaart krijgt
privacyroute en menselijke grens alleen uit `server/ai.js`.

RTG Kompas vat een ingewikkelde situatie waar nuttig samen als **NU**,
**STRAKS** en **LET OP**. Dat is een antwoordvorm, geen verborgen redeneerspoor;
interne modelgedachten worden niet gevraagd, opgeslagen of aan een gebruiker
getoond.
