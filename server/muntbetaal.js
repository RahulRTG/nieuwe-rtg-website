/* Munt-ontvangst achter een naad (server/muntbetaal.js).

   RTG kan cryptomunten ontvangen voor zijn eigen diensten. Twee bewuste keuzes
   houden dit legaal en veilig (zie docs/de-lijn.md):

   1. RTG is GEEN crypto-wisselkantoor. We accepteren munten voor onze eigen
      abonnementen/diensten en zetten ze meteen om naar euro's via een
      vergunninghoudende aanbieder. We bewaren zelf geen crypto, houden geen
      sleutels en bieden geen wisseldienst aan derden. Daarmee blijven we een
      handelaar die crypto accepteert, geen crypto-dienstverlener (CASP) onder
      MiCA. Laat uw eigen compliance/DNB de actuele eisen (Wwft/KYC, fiscaal)
      bevestigen voordat dit live gaat.
   2. De custody, de on-chain afhandeling en de euro-conversie liggen bij die
      aanbieder, niet bij ons. Eigen wallets of sleutels rollen is precies de
      fout die de-lijn.md verbiedt.

   De INTERFACE is van ons: een ontvangstverzoek maken, de gelockte koers, de
   idempotentie en de webhook-verificatie. Zonder MUNT_PROVIDER_KEY draait alles
   in demo (geen echte munten, een vaste demokoers), zodat lokaal en in demo
   alles werkt zonder configuratie. Acceptatie staat standaard UIT en gaat pas
   aan met MUNT_AAN=1, zodat niemand per ongeluk live crypto aanzet. */
const crypto = require('crypto');

const PROVIDER_KEY = process.env.MUNT_PROVIDER_KEY || '';
const WEBHOOK_SECRET = process.env.MUNT_WEBHOOK_SECRET || '';
const AAN = process.env.MUNT_AAN === '1';
const AANBIEDER = PROVIDER_KEY ? 'provider' : 'demo';

/* Ondersteunde munten met hun aantal decimalen. Configureerbaar via
   MUNT_MUNTEN (kommagescheiden), anders een verstandige standaard. */
const DECIMALEN = { btc: 8, eth: 8, usdc: 2, usdt: 2 };
const MUNTEN = (process.env.MUNT_MUNTEN || 'btc,eth,usdc')
  .split(',').map(s => s.trim().toLowerCase()).filter(m => m in DECIMALEN);

/* Demokoersen: euro-CENTEN per 1 hele munt. In productie levert de aanbieder een
   live, korte tijd gelockte koers; hier houden we vaste getallen zodat tests en
   demo deterministisch zijn. Nooit voor echte waardering gebruiken. */
const DEMO_KOERS = { btc: 6000000, eth: 300000, usdc: 92, usdt: 92 };

function magMunt(munt) { return MUNTEN.includes(String(munt || '').toLowerCase()); }

// Euro-centen per 1 hele munt (de gelockte koers op dit moment).
function koersCenten(munt) {
  munt = String(munt || '').toLowerCase();
  return DEMO_KOERS[munt] || 0;
}

/* Reken een euro-bedrag (in centen) om naar een muntbedrag, als string met het
   juiste aantal decimalen (zodat er geen drijvende-komma-ruis in het te betalen
   bedrag sluipt). */
function naarMunt(euroCenten, munt) {
  const k = koersCenten(munt);
  if (!k) return '0';
  const dec = DECIMALEN[munt] || 8;
  return (euroCenten / k).toFixed(dec);
}

/* Idempotentie-opslag, net als in betaal.js: standaard in het geheugen, maar een
   aanroeper kan een persistente store injecteren zodat een herhaald verzoek na
   een herstart hetzelfde adres teruggeeft (nooit twee adressen voor hetzelfde
   verzoek). */
const geheugen = new Map();
let haalOp = (k) => geheugen.get(k);
let bewaar = (k, v) => { geheugen.set(k, v); };
function koppelStore(store) {
  if (store && typeof store.get === 'function') haalOp = store.get;
  if (store && typeof store.set === 'function') bewaar = store.set;
}

/* Maak (of hervind) een ontvangstverzoek: een adres waarop de klant zijn munten
   stuurt, met het exacte muntbedrag en de gelockte koers. Idempotent op sleutel.
   In productie zou hier een adres van de aanbieder komen, met auto-conversie naar
   euro's ingesteld; in demo genereren we een pseudo-adres. */
async function maakOntvangst(opdracht) {
  const { euroCenten, munt, referentie, idempotentieSleutel, vervalMin = 30 } = opdracht || {};
  if (!AAN) throw new Error('Munt-ontvangst staat uit (zet MUNT_AAN=1 om te accepteren).');
  if (!magMunt(munt)) throw new Error('Deze munt wordt niet geaccepteerd.');
  if (!Number.isFinite(euroCenten) || euroCenten <= 0) throw new Error('Bedrag moet een positief bedrag in centen zijn.');

  const sleutel = 'munt:' + (idempotentieSleutel || referentie || crypto.randomUUID());
  const bestaand = haalOp(sleutel);
  if (bestaand) return Object.assign({}, bestaand, { herhaald: true });

  const m = String(munt).toLowerCase();
  const koers = koersCenten(m);
  const bedragMunt = naarMunt(euroCenten, m);
  const vervalt = new Date(Date.now() + vervalMin * 60000).toISOString();

  let res;
  if (PROVIDER_KEY) {
    // In productie: adres opvragen bij de vergunninghoudende aanbieder, met
    // auto-conversie naar euro ingesteld. Achter de naad; live gaan raakt de
    // rest van de code niet.
    throw new Error('Munt-aanbieder is geconfigureerd maar de live-koppeling is nog niet aangezet.');
  } else {
    res = {
      id: 'muntdemo_' + crypto.randomBytes(8).toString('hex'),
      aanbieder: 'demo', munt: m, adres: 'demo-' + m + '-' + crypto.randomBytes(10).toString('hex'),
      bedragMunt, koersCenten: koers, euroCenten: Math.round(euroCenten),
      referentie: referentie || null, status: 'wacht', vervalt
    };
  }
  bewaar(sleutel, res);
  return res;
}

/* Verifieer een inkomende aanbieder-webhook (munten ontvangen + omgezet naar
   euro). Zelfde patroon als betaal.js: met secret een HMAC-controle over de ruwe
   body in constante tijd; zonder secret (lokaal) alleen parsen. In productie
   altijd een secret zetten. */
function verifieerWebhook(ruweBody, handtekening) {
  const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
  if (WEBHOOK_SECRET) {
    const verwacht = crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
    const gegeven = Buffer.from(String(handtekening || ''), 'utf8');
    const goed = gegeven.length === verwacht.length &&
      crypto.timingSafeEqual(Buffer.from(verwacht, 'utf8'), gegeven);
    if (!goed) throw new Error('Ongeldige munt-webhook-handtekening.');
  }
  return JSON.parse(buf.toString('utf8'));
}

// Hulp om in demo/tests een geldige handtekening te maken.
function tekenDemo(ruweBody) {
  const buf = Buffer.isBuffer(ruweBody) ? ruweBody : Buffer.from(String(ruweBody));
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(buf).digest('hex');
}

module.exports = {
  AAN, AANBIEDER, MUNTEN, DECIMALEN, magMunt, koersCenten, naarMunt,
  maakOntvangst, verifieerWebhook, tekenDemo, koppelStore, WEBHOOK_SECRET
};
