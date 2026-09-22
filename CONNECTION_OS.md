# Connection OS — scope-freeze

Deze specificatie bevriest de productscope van Vonk en Rendez-vous. Nieuwe
datingfuncties worden niet ontworpen zolang de bestaande ketens niet volledig
werken, privacyvast zijn en op het bedoelde kwaliteitsniveau aanvoelen.

## De vijf technische wetten

1. **Capability is geen permission.** Dat een functie technisch bestaat, geeft
   geen product of actor toegang. Productpolicy en actuele toestand beslissen.
2. **Default deny.** Een onbekende capability, actor of productcombinatie is
   dicht. Alleen een expliciete regel kan haar openen.
3. **Privacy vóór projectie.** Een API, Edge, Rahul of scherm krijgt uitsluitend
   de projectie die het voor die handeling mag ontvangen. Verborgen gegevens
   worden niet naar de client gestuurd om daar te worden verstopt.
4. **Consent is runtime state.** Likes, introductie-antwoorden, plaatskeuzes,
   betaalbevestigingen en Arrange It-akkoorden blijven afzonderlijke menselijke
   verklaringen. Een ingetrokken verklaring werkt vanaf de volgende handeling;
   realtime functies moeten later bovendien actieve verbindingen verbreken.
5. **Geen façadefuncties.** Voice, video, media, route, Rendez-vous-chat,
   automatische reservering en Concierge verschijnen nergens voordat de hele
   keten aantoonbaar werkt.

Daarboven geldt één regel voor iedere AI-ingang:

> Rahul krijgt geen privileges die het lid niet heeft.

Rahul is een actor in dezelfde policymatrix. Hij is nooit een alternatieve
route rond toestemming, blokkades, disclosure of producttoegang.

## Fase 0 — vastgelegde baseline

De baseline bestaat uit **58 bestaande integratietests**:

- `test/vonk.test.js`: 26;
- `test/rendezvous.test.js`: 32.

Zij bewijzen onder andere 18+/KYC, eindige selectie, wederzijdse likes,
preference-disclosure, Presence, blinde beschikbaarheid, dubbel akkoord,
betaling/reservering, Encounter, Together, The Table en blokkeren/melden. Deze
tests worden niet vervangen door nieuwe architectuurtests.

### Bestaande gedeelde semantiek

| Regel | Huidige eigenaar |
|---|---|
| echte account + geverifieerde identiteit + 18+ | `server/kern/ontmoetpoort.js` |
| private availability en één gedeelde projectie | `server/kern/beschikbaar.js` |
| eisen aan een geschikte ontmoetingsplek | `server/kern/geschikt.js` |
| productoverschrijdend blokkeren | `server/kern/connection-blocking.js` |
| capability- en productpolicy | `server/kern/connection-policy.json` |

Profielen, matching, Presence, Meet Halfway, Arrange It, The Table en Encounter
blijven bij hun huidige productkern zolang hun semantiek niet werkelijk gelijk
is. Gelijke woorden zijn geen bewijs van gelijke regels.

### Opslag die tijdens de migratie leidend blijft

- Vonk: `db.data.vonk`;
- Rendez-vous: eigen collectie `kern/rendezvous`;
- productoverschrijdende blokkades: `db.data.connectionBlocks`;
- bestaande productspecifieke blokkades blijven gelezen en geschreven voor
  terugwaartse compatibiliteit.

Lezen maakt geen nieuwe opslag. Een gedeelde blokkade wordt pas geschreven
wanneer een lid daadwerkelijk blokkeert.

## Constitution

De machineleesbare matrix staat in
`server/kern/connection-policy.json`. Iedere regel verbindt:

```text
actor × product × capability × toestand → allow/deny + reden
```

De routelaag handhaaft producttoegang, identiteit en leeftijd. De productkern
handhaaft de toestand waarvan hij eigenaar is, zoals een wederzijdse match, een
uitnodiging of twee afzonderlijke akkoorden. `domainState` in het register legt
die tweede poort vast zonder haar te dupliceren.

Niet-gebouwde capabilities staan bewust in het register met
`implemented: false`. Daardoor kunnen code en tests aantonen dat zij bestaan als
toekomstige technische mogelijkheid én vandaag overal dicht zijn.

## Privacyprojecties

- **candidate:** codenaam en uitsluitend profielvelden die voor ontdekking zijn
  vrijgegeven; geen echte naam, adres, volledige beschikbaarheid of verborgen
  voorkeuren.
- **match:** uitsluitend na wederzijdse keuze; nog steeds geen verborgen
  voorkeuren of volledige agenda.
- **own-presence:** alleen de eigen invoer; bij een ander komt uitsluitend stad +
  overlappende periode uit de kern.
- **blind-place-choice:** alleen de eigen keuze totdat beiden kozen.
- **introduction-without-other-answer:** nooit het eerste antwoord van de ander.
- **table-without-guest-list:** uitnodiging zonder namen van andere gasten.
- **meet-plan:** een voorstel, nooit een onbewezen reservering.

### Ronde 2 — Consent & Projection Constitution

De uitvoerbare toestemmingsmachine staat in
`server/kern/connection-consent.js`. Een binding bestaat uit actor,
counterpart, purpose, capability, scope en versie. De enkelzijdige toestanden
zijn `ABSENT`, `ACTIVE`, `REVOKED` en `EXPIRED`; wederzijdse toestemming wordt
geprojecteerd als `NONE`, `A_GRANTED`, `B_GRANTED`, `MUTUAL` of `REVOKED`.
Herroepen is een gebeurtenis in het ledger en werkt bij iedere volgende
controle onmiddellijk. Arrange It gebruikt deze machine zonder een tweede
productopslag te introduceren.

De projectiemachine staat in `server/kern/connection-projection.js`. Zij bouwt
nieuwe objecten uit benoemde allowlists; opslagobjecten worden niet eerst naar
een consumer gestuurd om client-side te worden verborgen. De contracten zijn:

- `VONK_DISCOVERY`, `VONK_MATCH`, `VONK_CONVERSATION`, `VONK_MEET`;
- `RENDEZVOUS_INTRODUCTION`, `RENDEZVOUS_PRESENCE`,
  `RENDEZVOUS_ENCOUNTER`, `RENDEZVOUS_TABLE_MEMBER`,
  `RENDEZVOUS_TOGETHER`;
- gescheiden eigenaar-, kantoor- en veiligheidsprojecties;
- `RAHUL_CONNECTION`, als enige Connection-input voor de koppelaar.

Rahul heeft twee grenzen: de input bestaat uitsluitend uit
`RAHUL_CONNECTION`; gegenereerde tekst passeert daarna een outputcontrole tegen
privéwaarden die niet in die projectie voorkwamen. The Table heeft afzonderlijke
member- en officeprojecties, zodat een gast nooit een gastenlijst ontvangt en
een bevoegde curator uitsluitend codenamen en statussen ziet.

`npm run connection:constitution` draait de bevroren producttests plus de
constitutionele, cross-product-, consent-, projectie- en non-interferencetests.
Alleen na een volledig groene ronde schrijft het script het herleidbare
`CONNECTION_CONSTITUTION.json` met een bronhash en feitelijke aantallen.

### Ronde 3 — Product State & Edge Contract

Ronde 2 is als afzonderlijk herstelpunt vastgelegd in commit `315bfce37`.
Daarboven leiden `connection-state-vonk.js` en
`connection-state-rendezvous.js` actuele productstates af uit de bestaande
productopslag. Discovery, Conversation en Meet worden niet samengevoegd met
Today, Introduction, Arrange It, The Table of Together.

`connection-product-state.js` combineert productstate, actor, productpolicy,
implementatiestatus, consent, blokkade en context. Alleen toegestane waarden
komen als `availableCapabilities` uit de resolver. Een niet-beschikbare
capability is afwezig; er wordt geen `false`-vlag naar de client gestuurd.

De semantische Edge staat in `connection-edge.js`. Hij levert actienamen,
vertaalsleutels, capabilities en intents via de benoemde projecties
`VONK_EDGE` en `RENDEZVOUS_EDGE`. Dit is nadrukkelijk nog geen visueel ontwerp.
Voice, Route en automatische Concierge ontbreken zolang hun capabilities
`implemented: false` zijn.

Iedere Edge-projectie bevat `stateRevision`, `policyVersion`,
`projectionVersion` en `stateContractVersion`. Mutatieroutes herberekenen
altijd eerst de actuele serverstate. Een meegestuurde oude revision krijgt
`STALE_CONNECTION_STATE`; zonder revision kan de client evenmin iets openen,
omdat capability en transition opnieuw server-side worden gecontroleerd.

## Gefixeerde bouwvolgorde

0. baseline bevriezen;
1. Constitution: capabilities, policies, projections, consent en cross-product
   blocking;
2. uitsluitend bewezen gedeelde semantiek uit de producten halen;
3. expliciete server-side projections voor Vonk, Rendez-vous, Rahul en Edge;
4. Edge als projectie van productstate;
5. de bestaande Vonk-keten volledig afmaken;
6. de stille Rendez-vous-experience bouwen zonder Vonk als componentbibliotheek
   te behandelen.

Acceptance blijft bewust eenvoudig:

> **Vonk:** waarom zou ik daarnaast nog een andere datingapp nodig hebben?

> **Rendez-vous:** voelt dit überhaupt nog alsof ik een datingapp gebruik?
