# REV-AI-CREDIT-001: AI-tegoed zonder bewezen betaling

**Classificatie:** financieel en beveiligingsrisico

**Blokkeert:** publieke verkoop van AI-bundels
**Scope van Revenue Catalog Contract v1:** vastleggen, niet herstellen

## Bevinding

`POST /api/member/ai/bundel` berekent de prijs server-side en roept daarna
rechtstreeks `tegoed.koopBundel()` aan. `koopBundel()` verhoogt `bijgekocht`,
schrijft de bundel in de tegoedrij en bewaart. In deze keten is geen bewezen
payment authorization, settlement, payer, ledgerreferentie of idempotente
billing-event-identiteit vereist.

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

## Grens van deze PR

De cataloguspilot blijft altijd `READ_ONLY` en `purchasable: false`. De projectie
initieert geen betaling, kent geen tegoed toe, activeert geen abonnement en
verleent geen entitlement. De bestaande route wordt in deze PR niet gewijzigd,
zodat een kleine catalogus-PR geen ongevraagde betaalarchitectuur introduceert.

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
