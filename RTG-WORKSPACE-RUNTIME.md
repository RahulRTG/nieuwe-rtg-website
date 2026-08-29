# RTG Adaptive Workspace

## Productgrens

De RTG Workspace Runtime is het productfundament. De Dynamic Layer, Second
Screen en Focus View zijn presentatievormen van die runtime. Een module bouwt
nooit zelf een tweede shell, identiteit, permissielaag of globale navigatie.

Voor authenticatie draait de aparte **RTG Access Experience**. Die geeft
inloggen, aanmelden, passkeys, herstel, uitnodigingen en operationele poorten
dezelfde RTG ID-signatuur en ontwerpregels, maar bezit bewust geen token,
authenticatielogica of transport. Na succesvolle identiteit neemt de Workspace
Runtime de sessie over. Zo voelt de toegang als hetzelfde product zonder een
pre-auth scherm toegang tot de ingelogde runtime te geven.

```text
RTG Platform
|
+-- RTG Access Experience
|   +-- RTG ID-signatuur
|   +-- Login, registratie en herstel
|   `-- Passkey en operationele toegang
|
+-- RTG Workspace Runtime
|   +-- Identity en Session Runtime
|   +-- Policy en Permission Engine
|   +-- State Engine
|   +-- Context Engine
|   +-- Event Fabric
|   +-- Action Broker
|   +-- Module Runtime
|   +-- Navigation Runtime
|   `-- Workspace Orchestrator
|
+-- RTG Experience Layer
|   +-- Dynamic Layer
|   +-- Second Screen
|   +-- Focus View
|   +-- Command Surface
|   `-- Notifications
|
+-- RTG Module Platform
|   +-- Module Registry en SDK
|   +-- Capability en Permission Registry
|   +-- Event Registry
|   `-- Action Registry
|
+-- RTG Design System
|   +-- Tokens en Components
|   +-- Motion en Accessibility
|   `-- Responsive Rules
|
`-- Living Modules
```

## Volledige platformdekking

De Module Registry krijgt haar wereldcatalogus uit dezelfde `MAPPEN`-bron als
het bestaande beginscherm. Dit is dus geen tweede handmatige navigatielijst.
De gegenereerde catalogus omvat:

| context | functies |
|---|---:|
| LivingOS | 50 |
| WorkOS | 13 |
| TravelOS | 11 |
| FoundationOS | 2 |
| Instellingen en RTG Core | 6 |
| **Totaal** | **82** |

Iedere functie krijgt een canonieke capability, eigenaarcontext, doeladres en
migratieniveau. Bekend zijn in de registry betekent niet dat een oude functie
ten onrechte een native module wordt genoemd: L0 blijft L0 totdat die functie
werkelijk de bijbehorende runtimegrenzen gebruikt. `npm run workspace:worlds`
genereert het browsercatalogus; de build en `workspace:check` weigeren drift ten
opzichte van `MAPPEN`.

Naast deze 82 zichtbare functies kent de server momenteel 204 afzonderlijke
functieschakelaars. `server/kern/workspace-platform.js` geeft iedere schakelaar
een uniforme `service.<id>`-capability en houdt de bestaande server feature gate
leidend. De browser krijgt die interne routeprefixen niet. Living Modules
verklaren met `services` welke servercapabilities zij gebruiken; de contracttest
weigert een claim die niet in het serverregister bestaat. Een nieuwe
serverfunctie telt automatisch mee, zonder handmatig getal in productcode.

## Verplichte runtimegrenzen

Iedere nieuwe Living Module:

- heeft een stabiel id, semantische versie en minimale runtimeversie;
- verklaart alle vier surfaces of motiveert welke niet bestaan;
- verklaart capabilities, permissions, events, actions en invocations vooraf;
- gebruikt alleen het eigen module-statevak;
- vraagt alleen RTG API-paden op via `context.request`;
- communiceert met andere modules via events en actions;
- tekent geen eigen hostchrome en schrijft geen globale CSS;
- bevat performancebudgetten en een migratieniveau;
- voert muterend domeinwerk uitsluitend uit via de Action Broker.

Directe module-imports, eigen authenticatie, globale state-mutatie, vrije
window-events en willekeurige netwerktoegang zijn geen ondersteunde route.

## Modulecontract

```js
defineRTGModule({
  id: 'rtg.example',
  name: 'Example',
  version: '1.0.0',
  runtime: { minVersion: '0.1.0' },
  maturity: 'L3',
  states: ['peek', 'panel', 'workspace', 'focus'],
  surfaces: { peek: true, panel: true, workspace: true, focus: true },
  capabilities: ['example.read'],
  services: ['bestaande-serverfunctie'],
  permissions: ['example.read'],
  events: { publishes: ['example.item.changed'], subscribes: [] },
  actions: ['example.item.update'],
  state: { persistence: 'workspace', schema: 'example.state.v1' },
  performance: { peekBudgetKb: 40, panelBudgetKb: 180 },
  create(context) {
    return { mount() {}, render() {}, destroy() {} };
  }
});
```

Gebruik voor nieuwe code `npm run workspace:module -- rtg.example "Example"`.
De generator maakt het contract en registreert het script tussen de vaste
catalogusmarkeringen. `npm run workspace:check` blokkeert afwijkende modules.

## State

De State Engine kent vijf technische scopes, waarvan de eerste vier het
platformmodel vormen:

```text
global     thema, taal, device
user       rechten, voorkeuren, opgeslagen workspaces
session    online, authenticatie, actief device
workspace  layout, actieve module, surface, context
module     eigen draft, filters, scroll- en domeincontext
```

Modules mogen alleen hun eigen `module`-vak schrijven. Workspacecompositie
reist via het account tussen apparaten. Brondata en gevoelige inhoud blijven
bij het eigenaar-domein.

## Events en actions

Een event zegt wat is gebeurd en voert niets uit. De Event Fabric levert steeds
een envelop met `event`, `version`, `source`, `timestamp`, `workspaceId`,
`actorId` en `payload`. Namen volgen `domain.entity.event`.

Een action vraagt om werk. De Action Broker controleert registratie, invoker,
inputschema, userpermission, tenantpolicy, offlinebeleid, bevestiging,
deduplicatie en audit voordat `run` wordt aangeroepen. Muterende brokeractions
krijgen een begrensd accountauditspoor; het domeinaudit blijft altijd leidend.

## Orchestration

De Workspace Orchestrator is de enige laag die een module contextueel kan
vergroten, onderbreken of laten overnemen. Regels hebben een naam en prioriteit.
Een critical `safety.incident.started` mag Safety in Focus zetten, Messages
onderbreken en Travel naar Panel verplaatsen. De module doet dat nooit zelf.

Workspace Blueprints zijn declaratieve voorstellen. De validator controleert
modulebeschikbaarheid, userpermission, tenantbeleid, surface en device voordat
de layout wordt toegepast. AI produceert dus een voorstel, geen vrije UI-code.

## Migratie

```text
L0  Legacy App
L1  Wrapped Module
L2  Integrated Module
L3  Living Module
L4  Native Intelligent Module
```

De legacy-adapter houdt id, plaats en voorkeuren stabiel. Een team kan daardoor
per module migreren zonder big-bang rewrite. De app-shell toont op dit moment
Messages, Travel en Safety als de eerste L4-keten; andere apps kunnen via L0 tot
L3 uniform deelnemen en later onder hetzelfde id worden vervangen.

## Golden flow

```text
Messages herkent chauffeurcontext
-> messages.driver-details.detected
-> Orchestrator maakt Travel relevant
-> gebruiker kiest Toevoegen aan rit
-> Action Broker controleert en bevestigt
-> travel.driver.attached
-> Safety biedt ritmonitoring aan
-> gebruiker bevestigt afzonderlijk
-> server-side wacht start
-> safety.trip-monitoring.started
```

De tweede bevestiging is een veiligheidsgrens: een chatzin start nooit stil een
server-side alarmproces.
