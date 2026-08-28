/* EEN ITEM VAN EEN COLLECTIE WORDT EEN RIJ IN HET GROOTBOEK, EN TERUG.

   Drie dingen die alle drie over de VERTALING gaan en niet over de opslag:
   ontdubbelen op de sleutel, een item omzetten naar een grootboekrij, en een
   rij weer teruglezen. Ze stonden in ./ledger.js tussen de veeglogica; die kwam
   met de uitleg hieronder over de 10 kB-grens van de keuring, en dit is de
   naad waarop dat rustig kan -- wie hier iets verandert raakt geen enkele
   schrijfronde aan.

   Het versleutelen gebeurt hier, precies EEN keer. Wie een tweede plek maakt
   waar een grootboekrij ontstaat, maakt een tweede plek waar dat vergeten kan
   worden. */
'use strict';

const kluis = require('../../kluis');
const { COLLECTIES, TX_SOORT, klantVan, sleutelVan } = require('./collecties');

/* Ontdubbelen op de SLEUTEL van de collectie, niet op `t.ref`: payBoekingen
   draagt zijn identiteit in `id` en zou hier anders in zijn geheel wegvallen. */
const txDedup = (naam, items) => {
  const gezien = new Set(); const uit = [];
  for (const t of items) { const k = sleutelVan(naam, t); if (k == null || gezien.has(k)) continue; gezien.add(k); uit.push(t); }
  return uit;
};

/* HET TIJDSTIP, EN WAAROM DAT EEN OMWEG NODIG HAD.

   Hier stond `at: t.at || new Date().toISOString()`. Dat klopte zolang elke
   collectie een ISO-tekst droeg -- orders, boekingen, directe betalingen en
   betaalverzoeken doen dat allemaal. Een RTG Pay-boeking niet: die zet
   `at: Date.now()`, dus een GETAL.

   De Postgres-kolom is `timestamptz`. Een getal daarin zetten laat de insert
   struikelen ("invalid input syntax for type timestamp with time zone"), en de
   twee wegen naar het grootboek slikken dat allebei: txLedgerZet vangt de fout
   met de gedachte dat de veegronde het later wel oplost, en de veegronde meldt
   alleen "[tx] veegronde mislukt". Netto zou payBoekingen er in Postgres-stand
   NOOIT in komen, terwijl server/pg/sync.js de collectie wel als herstelbaar
   telt en haar dus achteraan de afsluit-flush zet -- de plek die als eerste
   sneuvelt. Precies de stille vorm waar de kop van collecties.js voor
   waarschuwt, en dan met geld erin.

   Gemeten tegen een echte Postgres, met en zonder deze regel: zonder geeft
   /api/pay/stuur nog steeds 200, klopt het saldo, en staat er daarna geen
   enkele payboeking-rij in tx_ledger. In SQLite is de kolom TEXT en gaat een
   getal er wel in; daar zou dezelfde fout onzichtbaar blijven tot de eerste
   Postgres-deploy. Dus normaliseren op EEN plek, hier, en niet per collectie
   een eigen vorm. `test/pay-grootboek.test.js` houdt het vast, in beide
   standen. */
const tijdstipVan = (t) => {
  const v = t.at;
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  return v || new Date().toISOString();
};

// Een ticket naar een grootboekrij. Hier gebeurt het versleutelen, precies een keer.
const rijVan = (naam, t) => ({
  soort: TX_SOORT[naam], ref: String(sleutelVan(naam, t)), klant: klantVan(naam, t) || null, zaak: t.supplierCode || null,
  paid: !!t.paid, status: t.status || null, totaal: Number(COLLECTIES[naam].totaal(t)) || 0,
  at: tijdstipVan(t), data: kluis.versleutel(JSON.stringify(t))
});
const lees = rijen => rijen.map(d => JSON.parse(kluis.ontsleutel(d)));

module.exports = { txDedup, tijdstipVan, rijVan, lees };
