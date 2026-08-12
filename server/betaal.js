/* Betaal-abstractie: één naad waarachter de echte provider zit.

   - Staat STRIPE_SECRET_KEY klaar, dan draaien betalingen echt via Stripe: een
     PaymentIntent met idempotentiesleutel, en webhooks die met de
     Stripe-handtekening worden geverifieerd. Dat loopt over onze EIGEN dunne
     client (./stripe), niet over het npm-pakket: geen dependency.
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
  try { stripe = require('./stripe')(STRIPE_KEY); } // eigen dunne client (geen dependency)
  catch (e) { /* kan niet starten: val terug op demo */ }
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

/* DE CANONIEKE VORM VAN EEN IDEMPOTENTIESLEUTEL.

   Wet RTG-038 op de geldketen, en hier is de schade het grootst: bij een token
   kost een tweede schrijfwijze toegang, hier kost hij een TWEEDE AFSCHRIJVING.

   De sleutel komt van de client. `idem` reist van de app via
   kern/pay/opladen.js ('pay-oplaad:' + codenaam + ':' + idem) hierheen, en gaat
   dan byte-exact naar twee vergelijkingen: onze eigen haalOp() en de
   idempotencyKey van de betaalprovider. Allebei kijken naar bytes. Dus:

       idem = "abc"      -> afschrijving
       idem = " abc"     -> tweede afschrijving, want andere bytes
       idem = "abc\n"    -> derde

   Een formulierveld dat een spatie meestuurt, een client die na een time-out
   opnieuw probeert met een net iets anders opgebouwde sleutel: dat is precies
   het geval waarvoor idempotentie bestaat, en het werkte niet.

   HIER NORMALISEREN WE, EN WEIGEREN WE NIET. Dat is de andere helft van de wet
   dan bij het sessietoken, en met opzet. Weigeren zou betekenen dat een retry
   met een spatie een FOUT krijgt -- terwijl de bedoeling van die retry juist is
   "doe dit niet nog een keer". Samenvoegen IS hier het gewenste gedrag: twee
   verzoeken die alleen in witruimte verschillen zijn hetzelfde verzoek. Bij een
   token is dat andersom: daar bestaat geen legitieme reden om er een spatie voor
   te zetten, dus daar is hard weigeren juist.

   NFC omdat Unicode twee schrijfwijzen voor hetzelfde teken kent (e + accent is
   dezelfde letter als de samengestelde vorm). Stuurtekens en een lege sleutel
   weigeren we wel: die zijn nooit bedoeld, en een lege sleutel zou stilzwijgend
   een verse willekeurige sleutel worden -- dus een tweede betaling.

   HOOFDLETTERS LATEN WE MET RUST, en dat is een besluit en geen vergeten regel.
   Case-vouwen zou "abc" en "ABC" samenvoegen, en dat is hier de gevaarlijke
   kant op: een sleutel is vaak base64 of hex uit een client, en daar zijn "aB"
   en "Ab" ECHT twee verschillende sleutels. Ze gelijkstellen betekent dat de
   tweede betaling stilzwijgend als herhaling wordt gezien en dus NIET gebeurt --
   geld dat niet aankomt, en niemand ziet een fout. Een dubbele afschrijving valt
   op en is terug te draaien; een betaling die stil verdwijnt niet. Bij twijfel
   dus liever twee sleutels dan een. */
function canoniekeSleutel(waarde) {
  const k = String(waarde == null ? '' : waarde).normalize('NFC').trim();
  if (!k || k.length > 255) return null;
  if (/[\u0000-\u001f\u007f]/.test(k)) return null;
  return k;
}

/* Start (of hervind) een betaling. Geeft { id, status, aanbieder, ... } terug.
   Bij Stripe is status doorgaans 'requires_...' tot de webhook 'succeeded' meldt;
   bij de demo is hij meteen 'betaald'. Herhaalde aanroepen met dezelfde
   idempotentieSleutel geven exact hetzelfde resultaat terug (met herhaald:true). */
async function maakBetaling(opdracht) {
  const { bedrag, valuta = 'eur', referentie, idempotentieSleutel, omschrijving } = opdracht || {};
  if (!Number.isFinite(bedrag) || bedrag <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');
  /* Fail closed: een sleutel die niet tot een canonieke vorm te brengen is,
     mag NOOIT stilzwijgend een verse willekeurige sleutel worden -- dat is
     precies een tweede betaling. */
  const sleutel = canoniekeSleutel(idempotentieSleutel || (referentie ? 'ref:' + referentie : crypto.randomUUID()));
  if (!sleutel) throw new Error('Ongeldige idempotentiesleutel (leeg, te lang of met stuurtekens).');

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
  const kern = canoniekeSleutel(idempotentieSleutel || referentie || crypto.randomUUID());
  if (!kern) throw new Error('Ongeldige idempotentiesleutel (leeg, te lang of met stuurtekens).');
  const sleutel = 'uit:' + kern;

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

module.exports = { AANBIEDER, maakBetaling, maakUitbetaling, verifieerWebhook, koppelStore, tekenDemo, canoniekeSleutel, WEBHOOK_SECRET };
