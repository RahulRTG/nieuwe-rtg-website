/* Transactie-index (orders/boekingen), in ALLE opslagmodi. De hete leespaden
   zoeken een order/boeking op ref, klant of zaak. Als lineaire scan over de array
   is dat O(N) per verzoek: met honderdduizenden levende tickets blokkeert elke
   aanvraag de event-loop. Deze secundaire indexen maken dat O(1) zonder de arrays
   zelf te veranderen: de waarheid blijft db.data.orders / db.data.boekingen.

   Zelfherstellend: wordt de array vervangen (archief, venster-kap, een Postgres-
   sync die de collectie overschrijft) of muteert iemand hem buiten de helpers om
   (lengte klopt niet meer), dan bouwt de index zichzelf lui opnieuw bij de
   eerstvolgende lezing. De indexsleutels (ref, klant, zaak) veranderen nooit na
   aanmaak; statuswissels muteren het object in-place en zijn dus automatisch
   zichtbaar via de index.

   Het Postgres-grootboek (RAM-venster + gepagineerde historie) staat in ./ledger;
   hier de index en de gemaksnamen waar de app mee leest/schrijft. */
const state = require('../state');
const ledger = require('./ledger');
const db = state.db;

// index injecteert save() (venster-verhuis vraagt een snapshot) door naar het
// grootboek, en levert het RAM-venster aan de veegronde.
function wire(saveFn) { ledger.wire({ txStaartNa, txVerwijder, save: saveFn }); }

const txStaat = { orders: null, boekingen: null };
const txKlantVan = t => t.customerKey || t.customerTier;
function txBouw(naam) {
  const arr = db.data[naam] || [];
  const st = { arr, len: arr.length, byRef: new Map(), byKlant: new Map(), byZaak: new Map() };
  for (const t of arr) {
    if (!t) continue;
    if (t.ref != null && !st.byRef.has(t.ref)) st.byRef.set(t.ref, t); // .find-semantiek: de eerste (nieuwste) wint
    const k = txKlantVan(t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); l.push(t); }
    const z = t.supplierCode; if (z != null) { let l = st.byZaak.get(z); if (!l) st.byZaak.set(z, l = []); l.push(t); }
  }
  txStaat[naam] = st;
  return st;
}
function txZorg(naam) {
  const st = txStaat[naam], arr = db.data[naam];
  if (!st || st.arr !== arr || st.len !== (arr ? arr.length : 0)) return txBouw(naam);
  return st;
}
// Nieuw ticket vooraan (nieuwste eerst), incrementeel in de index. Met
// achteraan:true blijft de oude push-volgorde van die ene kassaroute intact.
function txVoegToe(naam, t, opties) {
  const st = txZorg(naam);
  const achteraan = !!(opties && opties.achteraan);
  if (achteraan) st.arr.push(t); else st.arr.unshift(t);
  st.len++;
  if (t.ref != null && (achteraan ? !st.byRef.has(t.ref) : true)) st.byRef.set(t.ref, t);
  const k = txKlantVan(t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); if (achteraan) l.push(t); else l.unshift(t); }
  const z = t.supplierCode; if (z != null) { let l = st.byZaak.get(z); if (!l) st.byZaak.set(z, l = []); if (achteraan) l.push(t); else l.unshift(t); }
  // Nieuw item ook meteen (best-effort) naar het grootboek als dat actief is;
  // de veegronde is het vangnet voor gemiste schrijfacties en statuswissels.
  if (ledger.actief()) ledger.zet(naam, t);
  // Begrensde collecties (boekingen): pas kappen als de grens echt overschreden
  // is, in plaats van bij elke toevoeging een kopie te slicen zoals voorheen.
  // Met een actief grootboek kapt de veegronde (die de staart eerst veilig
  // wegschrijft) -- dan verdwijnt er niets meer stilletjes.
  const cap = opties && opties.cap;
  if (cap && !ledger.actief() && st.arr.length > cap) { st.arr.length = cap; txBouw(naam); }
}
// De staart voorbij `max` (voor het RAM-venster van Fase B: eerst veilig naar
// het grootboek, daarna pas verwijderen). Verwijderen gaat op identiteit, zodat
// nieuwe toevoegingen tussendoor niets verschuiven.
function txStaartNa(naam, max) { txZorg(naam); return (db.data[naam] || []).slice(max); }
function txVerwijder(naam, items) {
  if (!items || !items.length) return;
  const weg = new Set(items);
  db.data[naam] = (db.data[naam] || []).filter(t => !weg.has(t));
  txBouw(naam);
}
const txMetRef = (naam, ref) => txZorg(naam).byRef.get(ref);
const txVanKlant = (naam, key) => txZorg(naam).byKlant.get(key) || [];
const txVanZaak = (naam, code) => txZorg(naam).byZaak.get(code) || [];
// De gemaksnamen waar de routes en kern-modules mee lezen/schrijven.
const orderMetRef = ref => txMetRef('orders', ref);
const ordersVanKlant = key => txVanKlant('orders', key);
const ordersVanZaak = code => txVanZaak('orders', code);
const ordersVoegToe = (o, opties) => txVoegToe('orders', o, opties);
const boekingMetRef = ref => txMetRef('boekingen', ref);
const boekingenVanKlant = key => txVanKlant('boekingen', key);
const boekingenVanZaak = code => txVanZaak('boekingen', code);
const boekingenVoegToe = b => txVoegToe('boekingen', b, { cap: 50000 });

module.exports = {
  wire, initLedger: ledger.initLedger, vensterTopUp: ledger.vensterTopUp,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txStaartNa, txVerwijder,
  txLedgerActief: ledger.txLedgerActief, txLedgerVanKlant: ledger.txLedgerVanKlant,
  txLedgerVanZaak: ledger.txLedgerVanZaak, txLedgerTel: ledger.txLedgerTel,
  txLedgerAantal: ledger.txLedgerAantal, txVeegNu: ledger.txVeegNu
};
