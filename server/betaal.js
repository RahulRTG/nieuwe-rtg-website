/* Betaal-abstractie: één naad waarachter de echte provider zit.

   - Stripe, Mollie en Adyen zijn verwisselbare rails. Stripe en Adyen gebruiken
     ondertekende gebeurtenissen; bij de klassieke Mollie-webhook halen we de
     betaling met onze eigen API-sleutel terug. Altijd is de provider -- nooit
     de browser -- de bron voor "betaald".
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
const sandbox = require('./betaal-sandbox');

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
  catch (e) { /* kan niet starten: rail blijft uit, tenzij demo bewust aanstaat */ }
}
/* Geen sleutel mag nooit stil hetzelfde betekenen als "de betaling is gelukt".
   De demo-provider draait daarom alleen wanneer de installatie hem bewust heeft
   aangezet. RTG_DEMO is de volledige trainingsinstallatie; met
   STRIPE_DEMO_BEWUST=1 kan een aparte, niet-live omgeving alleen de betaalnaad
   demonstreren. Zonder een van beide staat de rail UIT en krijgt de aanroeper
   een zichtbare fout in plaats van fictief geld. */
const DEMO_BETALEN = process.env.RTG_DEMO === '1' || process.env.STRIPE_DEMO_BEWUST === '1';
const aanbieder = () => stripe ? 'stripe' : (regie.connectAan ? 'stripe-connect-sandbox' : (DEMO_BETALEN ? 'demo' : 'uit'));

function eisBetaalrail() {
  if (!stripe && !DEMO_BETALEN) {
    const e = new Error('Geen betaalprovider actief. Stel Stripe in of zet de demo-betaalstand bewust aan.');
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
const voorkeur = String(process.env.PAYMENT_PROVIDER || '').toLowerCase();
const AANBIEDER = BETALEN_UIT ? 'uit'
  : voorkeur === 'mollie' && mollie ? 'mollie'
  : voorkeur === 'adyen' && adyen ? 'adyen'
  : voorkeur === 'stripe' && stripe ? 'stripe'
  : stripe ? 'stripe' : mollie ? 'mollie' : adyen ? 'adyen'
  : DEMO_BETALEN ? 'demo' : 'uit';

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
  env: process.env, uit: BETALEN_UIT });
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
    res = { id: 'demo_uit_' + crypto.randomBytes(8).toString('hex'), status: 'ingepland', aanbieder: 'demo', bedrag: Math.round(bedrag), valuta, referentie, iban };
  } else {
    eisBetaalrail();
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
  if (BETALEN_UIT)
    throw new Error('Betaalwebhook geweigerd: betalen staat bewust uitgeschakeld.');
  const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
  if (stripe && WEBHOOK_SECRET) {
    return stripe.webhooks.constructEvent(buf, handtekening, WEBHOOK_SECRET);
  }
  /* ZONDER SECRET IN PRODUCTIE: WEIGEREN.

     Hier stond alleen een waarschuwing in het commentaar hierboven ("zet in
     productie altijd een secret"). Dat is precies het soort belofte waar niets
     van afhangt: zonder secret viel de code door naar JSON.parse en gaf de
     webhook een onondertekend bericht terug als geverifieerde waarheid. Wie het
     adres kent, kan dan zelf "betaald" roepen.

     De poortwacht-ronde vond dit doordat /api/betaal/webhook anoniem 200 gaf.
     Buiten productie blijft de doorval bestaan -- daar draait alles op
     demo-geld en zou een verplicht secret elke lokale start blokkeren. */
  if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production')
    throw new Error('Webhook geweigerd: er is geen webhook-secret ingesteld, dus dit bericht is niet te vertrouwen.');
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

module.exports = { AANBIEDER, BETALEN_AAN: !BETALEN_UIT && AANBIEDER !== 'uit',
  maakBetaling, haalBetaling, maakTerugbetaling, maakUitbetaling,
  verifieerWebhook, koppelStore, tekenDemo, mogelijkheden, kiesAanbieder,
  CONNECT_SANDBOX: sandbox.CONNECT, SEPA_SANDBOX: sandbox.SEPA,
  zetSandbox: (kanaal, aan) => regie.zet(kanaal, aan), sandboxStand: regie.stand,
  WEBHOOK_SECRET, MOLLIE_AAN: !!mollie, ADYEN_AAN: !!adyen,
  adyenMerchantAccount: adyen && adyen.merchantAccount,
  adyenHandmatigeCapture: !!(adyen && adyen.handmatigeCapture),
  verifieerAdyenMelding: (item) => !!(adyen && adyen.verifieerMelding(item)) };
