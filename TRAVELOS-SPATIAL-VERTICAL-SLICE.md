# TravelOS Spatial Vertical Slice Passport

Status: implementatievoorstel na repositoryverificatie. Dit document wijzigt geen
productgedrag en is geen toestemming om de slice te bouwen.

## 1. Besluit in één zin

De eerste Spatial-proef wordt **een bestaande catalogusreis aanvragen vanuit de
bestaande native Travel Living Module**, met dezelfde serverroutes, dezelfde
sessie, dezelfde aanvraagbron en dezelfde herstelregels als de huidige
TravelOS Flow.

De gebruiker kan:

1. een echte catalogusreis kiezen;
2. datum en aantal reizigers invullen;
3. de aanvraag controleren;
4. haar expliciet versturen;
5. een bronuitgegeven ontvangstbewijs of een eerlijke onzekere status zien;
6. na antwoordverlies uitsluitend bij de bron controleren;
7. de menselijke beoordeling en bevestigde reis in TravelOS terugzien;
8. zonder verlies terugvallen naar de bestaande Flow.

Dit is de kleinste end-to-enddoorsnede die Flow, Workspace Runtime, de Travel
Living Module, Edge, Rahul en de echte TravelOS-bron met elkaar verbindt. Er
wordt geen vierde host, tweede Travel-backend of tweede navigatiebron gebouwd.

## 2. Waarom juist deze doorsnede

De repository bevat al een echte reisaanvraag met de belangrijke
betrouwbaarheidseigenschappen: controle vóór versturen, expliciete menselijke
actie, bescherming tegen een dubbele open aanvraag, een ontvangstbewijs en
broncontrole bij antwoordverlies. Die stroom is daarom geschikter dan een
nieuwe generieke Spatial-demonstratie.

De eerste slice omvat bewust geen betaling, definitieve boeking, vrije
vensterplaatsing of universele concierge-case. Een reisaanvraag is volgens de
bestaande interface nog geen boeking en geen financiële verplichting. Dat
onderscheid blijft in tekst, gedrag en servercontract gehandhaafd.

## 3. Geverifieerde huidige situatie

| Onderdeel | Stand | Bestaande bron | Betekenis voor de slice |
|---|---|---|---|
| Travel Flow | Geïmplementeerd | `public/apps/reisbureau.html` | Blijft de canonieke eenvoudige presentatie en veilige terugval |
| Aanvraagcontroller | Geïmplementeerd, DOM-gebonden | `public/apps/reisbureau-experience.js` (`RTGTravelExperience`) | Gedrag hergebruiken; eerst een presentatieneutrale kern afgrenzen |
| Catalogus en aanvragen | Geïmplementeerd | `/api/reisbureau`, `/api/reisbureau/mijn`, `/api/reisbureau/boek` | Bestaande serverbron blijft leidend |
| Antwoordverlies | Geïmplementeerd | `RTGTravelExperience.check()` | Nooit blind opnieuw versturen; vergelijken met refs uit de bron |
| Tijdelijke reisintentie | Geïmplementeerd | `public/shared/experience-intent.js` | Alleen na toestemming, per sessie/tab en maximaal twee uur |
| Rahul-reiswens | Geïmplementeerd | `server/kern/fluister/reis/reiswens.js` | Rahul kan een wens structureren, zonder uitvoering |
| Rahul-reisconcept | Geïmplementeerd | `server/kern/fluister/reis/reisconcept.js` | Bewerkbaar 24-uursconcept; geen aanvraag, boeking of betaling |
| Contextbrug | Geïmplementeerd | `server/kern/stuur/menscontext.js`, `menscontext-ref.js`, `menscontext-opzoek.js` | Alleen type/id uit de client; object en toegestane velden komen van de server |
| Edge-blikveld | Geïmplementeerd | `public/shared/edge/blikveld.js#voorRahul` | Context delen zonder tekst uit de interface als waarheid te behandelen |
| Native Travel-module | Gedeeltelijk geïntegreerd | `public/shared/interface/modules/travel.js` | L4, echte dossierdata en chauffeuractie; aanvraagflow ontbreekt |
| Workspace Runtime | Geïmplementeerd | `public/shared/interface/workspace-runtime.js` | Bestaande host voor peek, panel, workspace en focus |
| Modulehost en foutgrens | Geïmplementeerd | `workspace-module-host.js` | Runtime bezit chrome, lifecycle en foutisolatie |
| Action Broker | Geïmplementeerd | `workspace-broker.js` | Declaratie, schema, policy, bevestiging, deduplicatie en audit |
| Serverrechten | Geïmplementeerd | `server/kern/workspace-rechten.js` | `travel.read` en `travel.manage` komen van de sessie en falen dicht |
| Workspace-state | Geïmplementeerd | `workspace-state.js` | Alleen begrensde presentatiestatus; geen tweede domeinbron |
| Continuïteit | Geïmplementeerd | `workspace-continuity.js` | Bewaart compositie, nooit formulierinhoud, tokens of brondata |
| Native host in app | Geïmplementeerd | `public/apps/app.html` | Laadt de Workspace Runtime en bestaande Travel-module |
| Travel-groepsprojectie | Geïmplementeerd buiten de module | `server/kern/reisgezelschap-werkruimte.js` | Waardevol vervolg, geen voorwaarde voor deze eerste slice |
| Echte browserreis | Geïmplementeerd voor Flow | `test/experience-travel.e2e.js` | Bestaand bewijs uitbreiden met native module, niet vervangen |

De contextbrug en het Rahul-concept zijn dus geen ontbrekende infrastructuur.
Een generieke Experience Router, nieuw conceptmodel of nieuwe Spatial Shell zou
duplicatie introduceren.

## 4. Bronwaarheid en eigenaarschap

| Gegeven | Eigenaar | Bewaren | Mag Spatial kopiëren? |
|---|---|---|---|
| Reisaanbod | Reisbureau-API | Bestaande domeinopslag | Alleen actuele presentatieprojectie |
| Aanvraag en status | Reisbureau-API | Bestaande domeinopslag | Nee; opnieuw lezen aan de bron |
| Ontvangstreferentie | Reisbureau-API | Bestaande aanvraag | Alleen tonen en als ref gebruiken |
| Datum en reizigers vóór indienen | `RTGIntent` na toestemming | Tab/sessie, maximaal twee uur | Ja, via hetzelfde bestaande contract |
| Vrije notitie | Actief formulier | Niet in workspace-continuïteit | Nee |
| Rahul-reisconcept | Rahul-servergeheugen | Maximaal 24 uur | Alleen serverprojectie via type/id |
| Actieve surface en paneelvolgorde | Workspace Runtime | Workspace-continuïteit | Ja |
| Niet-opgeslagen formulierstatus | Request-controller in actief paneel | Alleen actieve UI; expliciete afsluitbeveiliging | Niet naar layoutopslag |
| Rechten | Server | Per actuele sessie | Alleen de serveruitspraak presenteren |

De Workspace Runtime wordt daarmee geen database voor reizen. De Flow en de
native module lezen en muteren dezelfde TravelOS-bron.

## 5. Doelarchitectuur binnen wat al bestaat

```text
TravelOS-bronroutes
  /api/reisbureau
  /api/reisbureau/mijn
  /api/reisbureau/boek
          │
          ▼
gedeelde request-controller
  review · expliciet versturen · antwoordverlies · broncontrole
       ┌──────────────────────┴──────────────────────┐
       ▼                                             ▼
Travel Flow                                  Travel Living Module
reisbureau.html                              peek/panel/workspace/focus
       │                                             │
       └──────── dezelfde sessie en refs ────────────┘
                                                     │
                     Workspace Runtime · Broker · serverrechten
                                                     │
                     Edge toont gedeclareerde contextacties
```

De gedeelde controller krijgt geen router, opslag of autorisatielaag. Hij
modelleert alleen het bestaande aanvraaggedrag en ontvangt functies voor
bronverzoeken en presentatieterugkoppeling. Flow en module blijven eigenaar van
hun eigen DOM.

## 6. Universal Panel Contract: bestaande manifest uitbreiden

De slice breidt het manifest met `id: "travel"` uit. Er komt geen tweede
Travel-module en geen nieuw moduleregister.

Voorgestelde acties:

| Actie | Doel | Bevoegdheid | Bevestiging |
|---|---|---|---|
| `travel.request.review` | Lokale samenvatting maken | `travel.manage` | Geen; heeft geen extern gevolg |
| `travel.request.submit` | Bestaande aanvraagroute aanroepen | `travel.manage` | Expliciet in de UI én via Broker-contract |
| `travel.request.check` | Na onzeker antwoord actuele bron lezen | `travel.manage` | Geen; read-only |
| `travel.request.open-flow` | Dezelfde reis in bestaande Flow openen | `travel.read` | Geen |
| `travel.open` | Bestaand reisoverzicht openen | Bestaand contract | Bestaand gedrag |

Een actie draagt alleen IDs en gevalideerde invoer. De server leidt actor en
sessie af. Het manifest declareert de acties; de Broker valideert en
dedupliceert lopend werk; de server blijft beslissen of de mutatie mag.

Voorgestelde module-events zijn uitsluitend feiten, bijvoorbeeld
`travel.request.received` met een aanvraagref en
`travel.request.uncertain` zonder succesclaim. Ze mogen geen notitie, token of
volledig aanvraagobject verspreiden.

## 7. Interactietoestanden

```text
CATALOGUS
   │ kies
   ▼
BEWERKEN ── wijziging ───────────────┐
   │ controleer                     │
   ▼                                │
REVIEW ── terug ────────────────────┘
   │ expliciet versturen
   ├──────────── ontvangstbewijs ─────► ONTVANGEN
   │
   ├──────────── duidelijke weigering ─► BEWERKEN + fout
   │
   └──────────── antwoord onzeker ─────► ONZEKER
                                           │ controleer bij bron
                                           ├─ unieke match ─► ONTVANGEN
                                           └─ geen match ───► ONZEKER
```

`ONZEKER` heeft nooit een automatische retry van de mutatie. Sluiten of naar
Flow gaan bewaart geen succesclaim. Een nieuwe sessie moet opnieuw authenticeren
en actuele status bij de bron lezen.

## 8. Flow, Spatial en Edge

### Flow naar Spatial

Een reis-id kan als objectreferentie worden meegenomen. Datum en reizigers
komen alleen mee via de bestaande toegestane `RTGIntent` of actieve gedeelde
controller binnen hetzelfde document. Vrije tekst komt niet in URL,
workspace-state of layoutopslag.

### Spatial naar Flow

De module gebruikt de bestaande route `/apps/reisbureau.html?reis=<id>`. Als
een concept veilig via `RTGIntent` is bewaard, hervat Flow die beperkte velden.
Zonder toestemming opent Flow de reis en blijft de invoer in het actieve paneel
staan totdat de gebruiker bewust sluit.

### Edge

De Edge verzint geen acties. De gefocuste Travel-module publiceert alleen de
acties die bij haar huidige toestand horen:

- catalogus: open, zoeken of terug naar reisoverzicht;
- bewerken: controleren en Flow openen;
- review: terug en expliciet versturen;
- onzeker: status controleren;
- ontvangen: reisoverzicht openen.

Universele terug/vooruitnavigatie blijft van de bestaande navigatiebron. Een
actief invoerveld, focus of open paneel houdt de Quiet Presence-bescherming.

## 9. Rahul binnen deze slice

Rahul mag:

- de bestaande catalogus en de huidige type/id-context helpen begrijpen;
- een reiswens structureren in het bestaande 24-uursconcept;
- ontbrekende reisgegevens uitleggen;
- de Travel-werkruimte of bestaande Flow openen;
- een samenvatting voorbereiden.

Rahul mag niet:

- een vrij reisconcept stil omzetten in een catalogusaanvraag;
- `travel.request.submit` zonder expliciete gebruikersactie uitvoeren;
- aanvraag-, betaal- of boekingssucces afleiden uit interface-state;
- serverrechten of Trusted Execution omzeilen.

De repository heeft nog geen bewezen semantisch contract dat een willekeurig
Rahul-reisconcept naar een catalogusreis vertaalt. Dat wordt niet in deze slice
gegokt. Een later voorstel kan die overgang apart ontwerpen en toetsen.

## 10. Privacy, autorisatie en herstel

1. `travel.read` en `travel.manage` worden opnieuw door
   `/api/ik/workspace/rechten` geleverd; onbekende rechten blijven geweigerd.
2. De bestaande Travel-routes authenticeren iedere aanvraag opnieuw.
3. Workspace-state en Broker-berichten blijven vrij van tokens, geheimen en
   vrije notities.
4. Het afsluiten van een gewijzigd formulier vraagt om een bewuste keuze: in
   het paneel blijven, de toegestane velden bewaren of zonder bewaren sluiten.
5. Een sessiewissel maakt de actieve controller ongeldig en blokkeert versturen.
6. Een verlopen of ingetrokken sessie opent geen herstelde domeindata.
7. Antwoordverlies resulteert in `ONZEKER`, nooit in een succesmelding.
8. Een fout in Travel blijft binnen de bestaande modulehost-foutgrens.
9. De Flow-route blijft de feature-flag-onafhankelijke terugval.

## 11. Mobiel en toegankelijkheid

Op compact mobiel toont de runtime één taak tegelijk; split view is geen
acceptatie-eis voor deze slice. Dezelfde module kan tussen `panel`, `workspace`
en `focus` wisselen zonder haar actieve controller te vervangen.

Verplicht bewijs:

- volledige toetsenbordvolgorde voor reis, datum, reizigers, review, verzenden
  en broncontrole;
- focus gaat na review naar de expliciete verstuuractie en na terugkeer naar
  het relevante veld;
- statusmeldingen gebruiken een passende live region zonder herhaling;
- 44 × 44 px touch targets voor stap- en primaire acties;
- tekstvergroting tot 200% zonder verborgen primaire actie;
- Edge en mobiel toetsenbord bedekken het actieve veld niet;
- reduced motion houdt iedere toestandsverandering begrijpelijk;
- fout, onzeker en ontvangen zijn niet uitsluitend door kleur te herkennen.

## 12. Prestatiebudget

De bestaande modulebudgetten blijven uitgangspunt: `peekBudgetKb: 40` en
`panelBudgetKb: 150`. Het aanvraagdeel wordt pas geladen wanneer de gebruiker
het paneel opent of een aanvraag start. Peek doet geen catalogusverzoek.

Voor de slice worden vóór implementatie gemeten:

- huidige module- en Flow-bundelgrootte;
- moduleinitialisatie en eerste bruikbare interactie;
- aantal netwerkverzoeken in peek, panel en focus;
- renders bij het wijzigen van reizigers;
- geheugengedrag na sluiten en opnieuw openen;
- gedrag op vertraagd mobiel netwerk.

Een geminimaliseerd paneel voert geen polling uit. Status wordt gelezen na een
expliciete actie, relevante gebeurtenis of bestaande herlaadcyclus.

## 13. Verificatiematrix

| Gebied | Bewijs |
|---|---|
| Gedeelde controller | Unit-tests voor review, duidelijke fout, antwoordverlies, bronmatch en sessiewissel |
| Servercontract | Bestaande `test/experience-travel.test.js` blijft groen |
| Flow-regressie | Bestaande `test/experience-travel.e2e.js` blijft groen |
| Native module | Browsertest in `app.html`: catalogus → review → aanvraag → ontvangst |
| Handoff | Flow → module en module → Flow met toegestane velden, zonder vrije tekst in URL/opslag |
| Herstel | Refresh, verlopen sessie, antwoordverlies en opnieuw controleren |
| Dubbele aanvraag | Bestaande open aanvraag blokkeert een tweede verzending |
| Rechten | `travel.manage=false` verbergt of blokkeert mutatie en server weigert rechtstreeks verzoek |
| Foutisolatie | Geforceerde modulefout laat andere Workspace-modules bruikbaar |
| Edge | Alleen acties van gefocuste Travel-toestand; back/forward blijft routergedrag |
| Rahul | Context type/id; geen stille submit en geen clientvelden als bevoegdheid |
| Toegankelijkheid | Keyboard, focus, live status, touch, 200% tekst en reduced motion |
| Prestatie | Peek/panelbudget, verzoekaantal, sluiting zonder achtergebleven werk |

## 14. Gefaseerde implementatie na goedkeuring

### PR A — gedeelde request-controller

- grens het bestaande betrouwbare gedrag uit `RTGTravelExperience` af;
- laat `reisbureau.html` dezelfde controller gebruiken;
- verander geen route, tekstbetekenis of zichtbaar gedrag;
- voeg gerichte unit-tests toe voor de toestandsmachine en antwoordverlies.

Dit is de kleinste waardevolle eerste implementatie-PR. Hij vermindert
duplicatierisico voordat de module een tweede presentatie krijgt.

### PR B — native aanvraag in bestaande Travel-module

- voeg catalogus, bewerken en review toe aan `modules/travel.js`;
- declareer acties in hetzelfde modulemanifest;
- gebruik bestaande Runtime, Broker en serverrechten;
- behoud de bestaande dossier- en chauffeurfunctie.

### PR C — continuïteit, Edge en Flow-terugval

- verbind gedeclareerde contextacties met de bestaande Edge;
- implementeer de veilige handoff met reis-id en bestaande intentopslag;
- bescherm niet-opgeslagen wijzigingen;
- valideer routewisseling, refresh en sessieverloop.

### PR D — productbewijs

- voeg de native end-to-endreis, toegankelijkheidsproeven en prestatiemeting toe;
- leg voor/na-resultaten vast;
- kwalificeer de slice tegen dit passport.

Iedere PR blijft afzonderlijk terugrolbaar. De volgende begint pas wanneer de
vorige broncontracten en relevante CI groen zijn.

## 15. Beslisgrenzen

Afzonderlijke eigenaarstoestemming is nodig voordat een implementatie:

- bestaande Travel API-contracten verandert;
- vrije Rahul-concepten naar aanvragen omzet;
- nieuwe persistente opslag of datamigraties introduceert;
- betaal- of definitieve boekingshandelingen toevoegt;
- Workspace-rechten of Trusted Execution-grenzen verandert;
- een nieuwe dependency, host, controllerfamilie of module registry toevoegt;
- buiten een feature flag naar productie wordt uitgerold.

## 16. Definition of Done voor de slice

De slice is pas voltooid wanneer:

1. Flow en native Travel-module dezelfde request-controller en TravelOS-bron
   gebruiken;
2. de volledige catalogusreisaanvraag in de native module werkt;
3. expliciete verzending, bronreceipt en onzekere status correct zijn;
4. de Flow-terugval op elk punt bereikbaar en betekenisvol is;
5. Edge alleen gedeclareerde, geldige Travel-acties toont;
6. Rahul voorbereidt maar niet zelfstandig indient;
7. rechten bij herstel en mutatie opnieuw worden gecontroleerd;
8. geen vrije notitie, token of domeinkopie in workspace-continuïteit staat;
9. bestaande Flow-, Rahul-, Edge- en Workspace-tests groen blijven;
10. keyboard-, schermlezer-, mobiel- en reduced-motionbewijs aanwezig is;
11. performancebudgetten op echte metingen zijn beoordeeld;
12. uitschakelen van de slice de bestaande Travel Flow intact laat.

Dit passport maakt de volgende stap uitvoerbaar zonder het Universal Concierge
Network vooruit te lopen. Pas na dit echte, bewezen pad is zichtbaar welke
generieke casecontracten werkelijk ontbreken en welke al door TravelOS worden
gedragen.
