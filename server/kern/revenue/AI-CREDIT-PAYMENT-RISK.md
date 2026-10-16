# REV-AI-CREDIT-001: AI-tegoed zonder bewezen betaling

**Classificatie:** financieel en beveiligingsrisico

**Blokkeert:** publieke verkoop van AI-bundels
**Stand op de afgeschermde integratiewerkboom:** directe toekenning fail-closed;
de publieke aankoopketen blijft geblokkeerd

## Bevinding

`POST /api/member/ai/bundel` berekende de prijs server-side en riep daarna
rechtstreeks `tegoed.koopBundel()` aan. `koopBundel()` verhoogde `bijgekocht`
zonder payment authorization, settlement, payer, ledgerreferentie of
idempotente billing-event-identiteit.

De directe grant is op de integratiewerkboom gesloten. `koopBundel()` kent pas
capaciteit toe wanneer een door de server geinjecteerde verifier exact dezelfde
betaler, productreferentie, prijs, valuta, settlementstand, evidence-id en
ledgerreferentie bevestigt. De evidence-id kan maar aan één toekenning worden
gebonden; herhalen levert dezelfde uitkomst en geen tweede tegoed. Zonder
verifier of passend bewijs retourneert de kern `PAYMENT_EVIDENCE_REQUIRED` of
`PAYMENT_EVIDENCE_INVALID` en blijft het tegoed onveranderd.

Ook de bestaande voorkeur `AUTO_AANVULLEN` veroorzaakt zonder zo'n adapter geen
creditgrant meer. De voorkeur mag worden bewaard, maar de uitvoering stopt met
`betaalbewijs-vereist` tot de betaaladapter is aangesloten.

Bronnen:

- `server/routes/member/aitegoed.js`, de route `/api/member/ai/bundel`;
- `server/kern/commercie/tegoed.js`, functie `koopBundel`;
- `server/kern/commercie/bundelprijs.js`, functie `prijsVan`.

De server-side prijsberekening voorkomt dat de client zelf een bedrag kiest,
maar bewijst niet dat het bedrag is betaald. Een succesvolle HTTP-response kan
daarom niet als financieel bewijs worden gebruikt.

## Impact

Als deze route voor publieke verkoop wordt gebruikt, kan capaciteit worden
toegekend zonder ontvangen geld. Retries en gelijktijdige requests dragen geen
stabiele billing-idempotency key en kunnen daardoor bovendien meer dan één
tegoedeffect veroorzaken.

## Huidige grens

De cataloguspilot blijft `READ_ONLY` en `purchasable: false`. De projectie
initieert geen betaling, kent geen tegoed toe, activeert geen abonnement en
verleent geen entitlement. De route is nog geen kooproute: er is bewust geen
verifier aangesloten en dus kan zij geen capaciteit toekennen.

Dit sluit het acute gratis-creditpad, maar nog niet de productketen. Er bestaat
nog geen gekoppelde payment intent, providerbevestiging, entitlementprojectie,
refund-tegeneffect of reconciliatie voor AI Extra S. Daarom blijft
`REV-AI-CREDIT-001` de publieke verkoop blokkeren.

## Vereist vervolg vóór verkoop

1. Maak een duurzame payment intent met actor, payer, product- en prijsversie.
2. Verleen capaciteit uitsluitend na cryptografisch geverifieerde provider-
   bevestiging of een bewezen interne geldboeking.
3. Gebruik één stabiele idempotency identity voor betaling én tegoedeffect.
4. Leg payment-, entitlement-/credit- en ledgerreferenties aan elkaar vast.
5. Bewijs retry, dubbele callback, timeout, process interruption en concurrency.
6. Reconcile provider settlement, ledger en toegekende capaciteit.
7. Laat refund/correctie een nieuw, traceerbaar tegen-effect maken.

Tot dit bewijs bestaat, blijft AI Extra S alleen zichtbaar als
catalogusproef en niet als koopbaar product.
