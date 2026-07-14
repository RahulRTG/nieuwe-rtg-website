/* Betaal-abstractie: één naad waarachter de echte provider zit.

   - Staat STRIPE_SECRET_KEY (en het pakket 'stripe') klaar, dan draaien
     betalingen echt via Stripe: een PaymentIntent met idempotentiesleutel, en
     webhooks die met de Stripe-handtekening worden geverifieerd.
   - Anders draait de demo-provider: dezelfde interface, maar hij "bevestigt"
     direct zonder echt geld. Zo werkt lokaal en in demo alles zonder keys.

   Twee dingen zijn hier bewust productie-hard gemaakt, los van de provider:
   1. Idempotentie, twee keer op "betaal" tikken (of een netwerk-herhaling) mag
      nooit twee keer afschrijven. Dezelfde sleutel geeft hetzelfde resultaat.
   2. Webhook-verificatie, de betaalstatus hoort van de geverifieerde provider
      te komen, niet van de client. Een ongeldige handtekening wordt geweigerd.

   De echte "is betaald"-waarheid hoort uit verifieerWebhook te komen; de client
   mag een betaling starten, maar niet zichzelf als betaald markeren. */
const crypto = require('crypto');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

let stripe = null;
if (STRIPE_KEY) {
  try { stripe = require('stripe')(STRIPE_KEY); }
  catch (e) { /* pakket ontbreekt: val terug op demo */ }
}
const AANBIEDER = stripe ? 'stripe' : 'demo';

/* Idempotentie-opslag. Standaard in het geheugen; een aanroeper kan een
   persistente store injecteren (bijv. gespiegeld in de database), zodat de
   garantie ook een herstart overleeft. */
const geheugen = new Map();
let haalOp = (k) => geheugen.get(k);
let bewaar = (k, v) => { geheugen.set(k, v); };
function koppelStore(store) {
  if (store && typeof store.get === 'function') haalOp = store.get;
  if (store && typeof store.set === 'function') bewaar = store.set;
}

/* Start (of hervind) een betaling. Geeft { id, status, aanbieder, ... } terug.
   Bij Stripe is status doorgaans 'requires_...' tot de webhook 'succeeded' meldt;
   bij de demo is hij meteen 'betaald'. Herhaalde aanroepen met dezelfde
   idempotentieSleutel geven exact hetzelfde resultaat terug (met herhaald:true). */
async function maakBetaling(opdracht) {
  const { bedrag, valuta = 'eur', referentie, idempotentieSleutel, omschrijving } = opdracht || {};
  if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');
  const sleutel = idempotentieSleutel || (referentie ? 'ref:' + referentie : crypto.randomUUID());

  const bestaand = haalOp(sleutel);
  if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

  let res;
  if (stripe) {
    const pi = await stripe.paymentIntents.create(
      { amount: Math.round(bedrag), currency: valuta, description: omschrijving, metadata: { referentie: referentie || '' } },
      { idempotencyKey: sleutel }
    );
    res = { id: pi.id, status: pi.status, clientSecret: pi.client_secret, aanbieder: 'stripe', bedrag: Math.round(bedrag), valuta, referentie };
  } else {
    res = { id: 'demo_' + crypto.randomBytes(8).toString('hex'), status: 'betaald', aanbieder: 'demo', bedrag: Math.round(bedrag), valuta, referentie };
  }
  bewaar(sleutel, res);
  return res;
}

/* Start (of hervind) een uitbetaling naar een externe bankrekening (SEPA).
   Gebruikt voor de vaste 30%-afdracht aan de RTFoundation: RTG ontvangt de
   maandbetaling en betaalt het foundation-deel meteen door naar het IBAN.

   - Zonder IBAN kan er niets weg: status 'te_storten' (gereserveerd, wacht op de
     rekening). Zodra het IBAN bekend is, wordt de afdracht wel ingepland.
   - Met Stripe en een IBAN zou hier een echte payout ontstaan; die staat achter
     dezelfde naad zodat de rest van de code niet verandert als het live gaat.
   - Idempotent op sleutel: dezelfde afdracht wordt nooit twee keer weggezet. */
async function maakUitbetaling(opdracht) {
  const { bedrag, valuta = 'eur', iban, begunstigde, referentie, idempotentieSleutel, omschrijving } = opdracht || {};
  if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');
  const sleutel = 'uit:' + (idempotentieSleutel || referentie || crypto.randomUUID());

  const bestaand = haalOp(sleutel);
  if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

  let res;
  if (!iban) {
    // Geen bestemming bekend: reserveren, niet versturen.
    res = { id: 'wacht_' + crypto.randomBytes(6).toString('hex'), status: 'te_storten', aanbieder: AANBIEDER, bedrag: Math.round(bedrag), valuta, referentie, iban: '' };
  } else if (stripe) {
    // In productie zou hier een Stripe-payout/transfer staan naar de bankrekening
    // van de foundation. Achter de naad, zodat live gaan niets anders raakt.
    const po = await stripe.payouts.create(
      { amount: Math.round(bedrag), currency: valuta, description: omschrijving, metadata: { referentie: referentie || '', iban } },
      { idempotencyKey: sleutel }
    );
    res = { id: po.id, status: po.status || 'ingepland', aanbieder: 'stripe', bedrag: Math.round(bedrag), valuta, referentie, iban };
  } else {
    res = { id: 'demo_uit_' + crypto.randomBytes(8).toString('hex'), status: 'ingepland', aanbieder: 'demo', bedrag: Math.round(bedrag), valuta, referentie, iban };
  }
  bewaar(sleutel, res);
  return res;
}

/* Verifieer een inkomende provider-webhook en geef de gebeurtenis terug.
   - Stripe met secret: officiële handtekeningcontrole (gooit bij twijfel).
   - Demo met secret: HMAC-SHA256 over de ruwe body, constant-tijd vergeleken.
   - Zonder secret (lokaal): body wordt alleen geparsed; NB: zet in productie
     altijd een secret, anders is de webhook niet te vertrouwen. */
function verifieerWebhook(ruweBody, handtekening) {
  const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
  if (stripe && WEBHOOK_SECRET) {
    return stripe.webhooks.constructEvent(buf, handtekening, WEBHOOK_SECRET);
  }
  if (WEBHOOK_SECRET) {
    const verwacht = crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
    const gegeven = Buffer.from(String(handtekening || ''), 'utf8');
    const goed = gegeven.length === verwacht.length &&
      crypto.timingSafeEqual(Buffer.from(verwacht, 'utf8'), gegeven);
    if (!goed) throw new Error('Ongeldige webhook-handtekening.');
  }
  return JSON.parse(buf.toString('utf8'));
}

// Hulp om zelf een geldige demo-handtekening te maken (tests, en de eigen
// interne webhook-doorgifte in demo-stand).
function tekenDemo(ruweBody) {
  const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
}

module.exports = { AANBIEDER, maakBetaling, maakUitbetaling, verifieerWebhook, koppelStore, tekenDemo, WEBHOOK_SECRET };
