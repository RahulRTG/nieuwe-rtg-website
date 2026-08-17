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
LOCAL_AI_REASONING=none
LOCAL_AI_REASONING_TOOLS=none
RTG_EXTERNE_AI_UIT=1
```

De provider accepteert standaard alleen loopback. `LOCAL_AI_LAN_TOESTAAN=1`
is een bewuste uitzondering voor een private IP- of hostnaam op het eigen
netwerk; een publieke host wordt ook met die schakelaar geweigerd. De status
onderscheidt daarom `op-dit-apparaat` van `eigen-netwerk`.
`LOCAL_AI_TOOLS=0` voorkomt dat een tekstmodel ten onrechte tool-calling claimt.
Zonder `LOCAL_AI_MODEL_VISION` slaat de keten lokaal beeld over; de afbeelding
wordt nooit stil weggegooid terwijl het model doet alsof het die zag.

Voer na configuratie uit:

```bash
npm run ai:lokaal:check
```

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

`scripts/mac/ollama-kompas.sh` maakt de lokale route reproduceerbaar. De
standaard is `qwen3.5:4b` onder de naam `rtg-kompas`: compact genoeg voor een
Apple Silicon Mac met 8 GB, maar met tekst, beeld en tool-calling in één model.
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
