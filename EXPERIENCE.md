# RTG Experience Platform

Status: werkende platformkern, vastgelegd op 29 augustus 2026. Dit document is
het uitvoercontract naast de wereldindeling in `WERELDEN.md` en de economische
grenzen in `CONTROLPLANE.md`.

## De twee platformregels

> Worlds orchestrate. Domains own. Policies authorize. Runtimes execute.
> Evidence proves.

> The Experience Plane never becomes a second system of record.

Een wereld bezit dus geen agenda-afspraak, betaling, reis of leerdoel. Zij
ontvangt een projection met stabiele object references en stuurt een intentie
naar de Action Broker. Alleen het autoritatieve domein schrijft het object.

## Vier planes, met echte eigenaars

| plane | bezit | huidige implementatie |
|---|---|---|
| Experience | world, context, projection, surface, resume | `server/kern/experience/` en `public/shared/experience-*` |
| Control | authority, policy decision, attention, intent registry, broker | `contexts.js`, `attention.js`, `intent-registry.js`, `broker.js` |
| Execution | domeinwaarheid en economische waarheid | onder meer `kern/agenda.js` en `kern/economie/runtime/` |
| Evidence | facts, hashes, audit, reconciliation, recovery | Experience evidence v2 en Economic Proof |

De vier World Manifests zijn geen losse apps. `living`, `work`, `travel` en
`foundation` voldoen aan één versioned World Contract; mental model, density,
navigation en governance verschillen per manifest.

## De werkende gebruikersketen

De vier canonieke homes laden dezelfde kernel:

1. de server leidt de principal en toegestane context af;
2. de wereld ontvangt een read-only projection met provenance, freshness en
   completeness;
3. de browser toont alleen gekwalificeerde AttentionItems en geregistreerde
   intents;
4. een actie maakt eerst een preview met exacte consequentie, policy snapshot
   en vervaltijd;
5. alleen expliciete menselijke bevestiging mag uitvoeren;
6. de Action Broker controleert context, authority, policy, idempotency en
   runtime opnieuw;
7. het domein schrijft één object;
8. preview, actor-evidence en idempotency-resultaat finaliseren samen;
9. de gebruiker ziet blijvend of zijn action-evidenceketen verifieerbaar is.

Tap, Search en Rahul mogen andere invoervormen zijn, maar produceren dezelfde
geregistreerde intentie. Rahul heeft geen rechtstreekse runtime-ingang.

## Wat nu werkelijk geregistreerd is

| intent | runtime | gevolg | bevestiging |
|---|---|---|---|
| `attention.acknowledge@1` | Experience Attention | experience state | verplicht |
| `schedule.item.create@1` | Agenda | domain truth | verplicht |

Dit is bewust een kleine, volledig bewezen registry. Een capability is pas
gemigreerd wanneer zij hetzelfde pad voor context, policy, idempotency,
evidence, foutinjectie en herstel doorloopt. Een knop die rechtstreeks een
endpoint aanroept telt niet als gemigreerd.

## Economische golden path

Een betaalde abonnementsbijdrage loopt al door de Economic Runtime:

`economic intent → allocation 70/20/10 → claims → double-entry ledger →`
`settlement/reconciliation → Economic Proof`

LivingOS projecteert uitsluitend proofs van de server-afgeleide principal. Het
scherm toont de drie allocaties en zegt `PROVEN`, `NOT_RECONCILED`, `DISPUTED`
of `FAILED`; het maakt van een interne aanname nooit een groen bewijs.

Dit is de eerste productiecel, niet de claim dat alle commerce-, payroll-,
travel- en refundpaden al op de universele runtime zitten.

## Harde invarianten

- Een expliciet onbekend context-ID valt dicht; er is geen stille fallback.
- Context-ID's zijn opaque en blijven gelijk wanneer een codenaam verandert.
- Een preview is actor-gebonden, vijf minuten geldig en niet overdraagbaar.
- Een idempotency key replayt exact hetzelfde resultaat en weigert hergebruik
  voor een andere fingerprint.
- Een preview maakt nog geen domeinwaarheid.
- De agenda gebruikt de preview als interne bron-idempotentiesleutel. Een crash
  na de domeinschrijving levert bij retry hetzelfde object, nooit een dubbel.
- Action evidence v2 vormt per opaque actor een eigen hashketen. Veranderen of
  verwijderen van een record maakt de integriteitsuitspraak rood.
- Evidence wordt niet stil uit een globale ringbuffer verwijderd.
- FoundationOS verbiedt human-worth scoring en engagement optimization in zijn
  manifest; LivingOS draagt een utility-first recommendation policy.

## Bewijs en kwaliteit

De kern wordt bewaakt door:

- unitproeven op contract, manifests, contexts, projections en broker;
- echte HTTP-proeven op auth, contextisolatie, preview, confirmation,
  idempotency, domain truth en evidence;
- foutinjecties op runtimefalen, verlopen preview, gestolen preview,
  evidence-manipulatie en crash tussen domeinschrijving en finalization;
- een mobiele browser-golden-path voor Economic Proof en action proof wanneer
  een browserdriver in de testomgeving beschikbaar is;
- de bestaande repositorypoorten voor routes, pagina's, grenzen,
  toegankelijkheid en bestandsgrootte.

## De resterende migratiegrens

De platformkern is echt; de volledige capabilitycatalogus is nog niet volledig
gemigreerd. De volgende volgorde houdt het systeem werkbaar:

1. geldscheppende en extern communicerende acties;
2. boekingen, mobiliteit, hospitality en commerce;
3. WorkOS-mutaties met organisatie-authority;
4. Foundation-supportacties met de strengere governance;
5. overige persoonlijke utilities.

Per intent zijn minimaal nodig: schema, owner runtime, authority, versioned
policy, consequence, confirmation, idempotency, evidence, compensation/recovery,
projectie en een negatieve autorisatietoets. Pas daarna verdwijnt de oude
rechtstreekse schrijfroute.
