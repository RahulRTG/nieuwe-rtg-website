/* Betaal-abstractie: één naad waarachter de echte provider zit.

   - Stripe, Mollie en Adyen zijn verwisselbare rails. Stripe en Adyen gebruiken
     ondertekende gebeurtenissen; bij de klassieke Mollie-webhook halen we de
     betaling met onze eigen API-sleutel terug. Altijd is de provider -- nooit
     de browser -- de bron voor "betaald".
   - Alleen Magnaat Test heeft een synthetische provider. Iedere andere
     installatie zonder echte provider weigert fail-closed.

   Twee dingen zijn hier bewust productie-hard gemaakt, los van de provider:
   1. Idempotentie, twee keer op "betaal" tikken (of een netwerk-herhaling) mag
      nooit twee keer afschrijven. Dezelfde sleutel geeft hetzelfde resultaat.
   2. Webhook-verificatie, de betaalstatus hoort van de geverifieerde provider
      te komen, niet van de client. Een ongeldige handtekening wordt geweigerd.

   De echte "is betaald"-waarheid hoort uit verifieerWebhook te komen; de client
   mag een betaling starten, maar niet zichzelf als betaald markeren. */
const crypto = require('crypto');
const sandbox = require('./betaal-sandbox');
const magnaatTest = require('./testomgeving').actief(process.env);

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const MOLLIE_KEY = process.env.MOLLIE_API_KEY || '';
const ADYEN_KEY = process.env.ADYEN_API_KEY || '';
const BETALEN_UIT = process.env.RTG_BETALEN_UIT === '1';
// Bewuste fail-closed bevestiging; dit opent geen uitgaande bankrail.
const UITGAAND_BEWUST_DICHT = process.env.STRIPE_UITGAAND_UIT_BEWUST === '1';
const regie = require('./betaal-regie')({
  connectGeconfigureerd: sandbox.CONNECT,
  sepaGeconfigureerd: sandbox.SEPA
});

let stripe = null;
if (STRIPE_KEY && !BETALEN_UIT) {
  try { stripe = require('./stripe')(STRIPE_KEY); } // eigen dunne client (geen dependency)
  catch (e) { /* kan niet starten: rail blijft fail-closed uit */ }
}
/* Geen sleutel mag nooit stil hetzelfde betekenen als "de betaling is gelukt".
   De synthetische provider draait daarom uitsluitend in de centraal bewaakte
   Magnaat Test-installatie. Een oude losse betaalvlag opent niets meer. */
const DEMO_BETALEN = magnaatTest;
const aanbieder = () => stripe ? 'stripe' : (regie.connectAan ? 'stripe-connect-sandbox' : (DEMO_BETALEN ? 'magnaat-test' : 'uit'));

function eisBetaalrail() {
  if (!stripe && !DEMO_BETALEN) {
    const e = new Error('Geen betaalprovider actief. Stel Stripe in of gebruik de betaaltest uitsluitend in Magnaat Test.');
    e.code = 'BETAALRAIL_UIT';
    throw e;
  }
}
let mollie = null;
if (MOLLIE_KEY && !BETALEN_UIT) {
  try { mollie = require('./mollie')(MOLLIE_KEY); }
  catch (e) { /* configuratiecontrole maakt een echte productiefout zichtbaar */ }
}
let adyen = null;
if (ADYEN_KEY && !BETALEN_UIT) {
  try { adyen = require('./adyen')(ADYEN_KEY); }
  catch (e) { /* configuratiecontrole maakt een echte productiefout zichtbaar */ }
}
/* DE VIERDE RAIL: de simulatiebank van de testhal (./betaal/synthetisch.js).

   MAGNAATLAB.md par. 3: een simulatie-adapter vervangt de RAIL, nooit de POORT.
   kern/pay/poort.js kent geen enkele demo-, test- of spelstand en dat blijft zo;
   de naad waar een vierde provider in past, is deze. Hij weigert zichzelf zodra
   er een echte provider staat, en altijd in productie -- zie de drie grendels
   daar. */
const echteRail = stripe ? 'stripe' : mollie ? 'mollie' : adyen ? 'adyen' : null;
const simulatie = require('./betaal/synthetisch')({ crypto, env: process.env, echteRail });
const SIMULATIE_AAN = simulatie.aan() && !BETALEN_UIT;

const voorkeur = String(process.env.PAYMENT_PROVIDER || '').toLowerCase();
const AANBIEDER = BETALEN_UIT ? 'uit'
  : voorkeur === 'mollie' && mollie ? 'mollie'
  : voorkeur === 'adyen' && adyen ? 'adyen'
  : voorkeur === 'stripe' && stripe ? 'stripe'
  : stripe ? 'stripe' : mollie ? 'mollie' : adyen ? 'adyen'
  /* De simulatiebank gaat VOOR de demo als hij bewust aan staat. Een testhal die
     stilzwijgend de altijd-slaagt-demo krijgt, bewijst dat de zonnige dag werkt
     en verder niets -- en dat is precies de dag waarop niemand een fout maakt. */
  : SIMULATIE_AAN ? 'simulatie'
  : DEMO_BETALEN ? 'magnaat-test' : 'uit';

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

const ontvangst = require('./betaal/ontvangst')({ crypto, stripe, mollie, adyen,
  standaard: AANBIEDER, get: (k) => haalOp(k), set: (k, v) => bewaar(k, v),
  env: process.env, uit: BETALEN_UIT, simulatie: BETALEN_UIT ? null : simulatie });
const {
  maakBetaling: maakProviderBetaling,
  haalBetaling, maakTerugbetaling, mogelijkheden, kiesAanbieder
} = ontvangst;

const maakBetaling = require('./betaal-connect')({
  crypto, sandbox, regie,
  haalOp: (k) => haalOp(k), bewaar: (k, v) => bewaar(k, v),
  maakProviderBetaling
});

/* Start (of hervind) een uitbetaling naar een externe bankrekening (SEPA).
   Gebruikt voor de vaste 30%-afdracht aan de RTFoundation: RTG ontvangt de
   maandbetaling en betaalt het foundation-deel meteen door naar het IBAN.

   - Zonder IBAN kan er niets weg: status 'te_storten' (gereserveerd, wacht op de
     rekening). Zodra het IBAN bekend is, wordt de afdracht wel ingepland.
   - Stripe kan NIET een willekeurig IBAN uit metadata betalen. Een Payout gaat
     naar de externe rekening van het Stripe-account zelf. Daarom staat deze
     uitgang in de echte Stripe-stand veilig dicht tot er een expliciete SEPA-
     rail of gecontroleerd Connected Account is gekoppeld.
   - Idempotent op sleutel: dezelfde afdracht wordt nooit twee keer weggezet. */
async function maakUitbetaling(opdracht) {
  if (BETALEN_UIT)
    throw new Error('Betalen staat bewust uitgeschakeld. Er is niets uitbetaald.');
  const { bedrag, valuta = 'eur', iban, begunstigde, referentie, idempotentieSleutel, omschrijving } = opdracht || {};
  if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');
  const sleutel = 'uit:' + (idempotentieSleutel || referentie || crypto.randomUUID());

  const bestaand = haalOp(sleutel);
  if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

  let res;
  if (!iban) {
    // Geen bestemming bekend: reserveren, niet versturen.
    res = { id: 'wacht_' + crypto.randomBytes(6).toString('hex'), status: 'te_storten', aanbieder: aanbieder(), bedrag: Math.round(bedrag), valuta, referentie, iban: '' };
  } else if (regie.sepaGeconfigureerd && !regie.sepaAan) {
    const e = new Error('SEPA-sandbox is door de Integratiekamer uitgezet.');
    e.code = 'SEPA_SANDBOX_UIT';
    throw e;
  } else if (regie.sepaAan) {
    res = sandbox.sepa({ bedrag, valuta, referentie, iban, begunstigde, omschrijving });
  } else if (stripe) {
    const bevestiging = UITGAAND_BEWUST_DICHT ? ' De installatie staat bewust in deze gesloten stand.' : '';
    const e = new Error('Uitbetaling veilig geblokkeerd: een IBAN in Stripe-metadata is geen echte betaalbestemming. Koppel eerst een gecontroleerde uitbetaalrail.' + bevestiging);
    e.code = 'UITBETAALRAIL_NIET_ACTIEF';
    throw e;
  } else if (DEMO_BETALEN) {
    res = { id: 'magnaat_uit_' + crypto.randomBytes(8).toString('hex'), status: 'ingepland', aanbieder: 'magnaat-test', bedrag: Math.round(bedrag), valuta, referentie, iban };
  } else {
    eisBetaalrail();
  }
  bewaar(sleutel, res);
  return res;
}

/* De webhook van buiten woont in ./betaal/webhook.js -- dat is de kant die
   BINNENKOMT, en die snede houdt dit bestand onder de grens van keuringsregel 13.
   De regel die daar geldt is de belangrijkste van de hele betaalkant en staat er
   uitgeschreven: de client mag een betaling starten, nooit zichzelf betaald
   noemen. */
const { verifieerWebhook, tekenDemo } = require('./betaal/webhook')({
  crypto, stripe, BETALEN_UIT, WEBHOOK_SECRET, env: process.env });

module.exports = { AANBIEDER, BETALEN_AAN: !BETALEN_UIT && AANBIEDER !== 'uit',
  maakBetaling, haalBetaling, maakTerugbetaling, maakUitbetaling,
  verifieerWebhook, koppelStore, tekenDemo, mogelijkheden, kiesAanbieder,
  CONNECT_SANDBOX: sandbox.CONNECT, SEPA_SANDBOX: sandbox.SEPA,
  zetSandbox: (kanaal, aan) => regie.zet(kanaal, aan), sandboxStand: regie.stand,
  WEBHOOK_SECRET, MOLLIE_AAN: !!mollie, ADYEN_AAN: !!adyen,
  SIMULATIE_AAN, simulatieBelet: () => simulatie.belet(),
  adyenMerchantAccount: adyen && adyen.merchantAccount,
  adyenHandmatigeCapture: !!(adyen && adyen.handmatigeCapture),
  verifieerAdyenMelding: (item) => !!(adyen && adyen.verifieerMelding(item)) };
