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
const fs = require('fs');
const path = require('path');
const state = require('../state');
const ledger = require('./ledger');
const opslag = require('../opslag');
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
  if (cap && !ledger.actief() && st.arr.length > cap) {
    const weg = st.arr.slice(cap);
    if (bewaarStaart(naam, weg)) { st.arr.length = cap; txBouw(naam); }
  }
}
/* HIER VERDWEEN BOEKING 50.001. Zonder grootboek (de json- en geheugen-standen)
   was dit de enige plek waar de staart uit het RAM ging: `st.arr.length = cap`,
   geen regel in de log, geen kopie ergens. De grens zelf is terecht -- een
   ongebonden collectie loopt in die standen op den duur tegen de maximale
   stringlengte aan -- maar een bevestigde boeking hoort niet weg te vallen
   omdat er een nieuwere bij kwam.
   De staart gaat daarom eerst duurzaam (fsync) naar dezelfde archiefmap die
   archief.js gebruikt en die de backup al meeneemt. Lukt dat schrijven niet,
   dan kappen we NIET: liever een te grote collectie dan een boeking die
   nergens meer staat. Faalt het bij volle schijf, dan zou elke volgende
   boeking het opnieuw proberen, dus geldt er een minuut rust tussen pogingen. */
let kapPauzeTot = 0;
function bewaarStaart(naam, weg) {
  if (Date.now() < kapPauzeTot) return false;
  try {
    const map = path.join(opslag.DATA_DIR, 'archief');
    fs.mkdirSync(map, { recursive: true, mode: 0o700 });
    const fd = fs.openSync(path.join(map, naam + '-afgekapt.jsonl'), 'a', 0o600);
    try { fs.writeSync(fd, weg.map(t => JSON.stringify(t)).join('\n') + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    console.warn('[tx] ' + naam + ': ' + weg.length + ' item(s) buiten de grens weggeschreven naar archief/' +
      naam + '-afgekapt.jsonl en uit het werkgeheugen gehaald.');
    return true;
  } catch (e) {
    kapPauzeTot = Date.now() + 60000;
    console.error('[tx] ' + naam + ': de af te kappen staart kon niet weggeschreven worden (' +
      e.message + '); niets gekapt, de collectie blijft groter dan de grens.');
    return false;
  }
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
// De grens op de levende boekingen-collectie. Instelbaar zoals TX_RAM_* en
// TX_KAP; de standaard blijft 50000. Wat erbuiten valt gaat naar het archief
// (zie bewaarStaart), of naar het grootboek als dat actief is.
const BOEK_CAP = Math.max(1, Number(process.env.TX_BOEKINGEN_CAP || 50000));
const boekingenVoegToe = b => txVoegToe('boekingen', b, { cap: BOEK_CAP });

module.exports = {
  wire, initLedger: ledger.initLedger, initLedgerSqlite: ledger.initLedgerSqlite,
  afrondLedger: ledger.afrondLedger, vensterTopUp: ledger.vensterTopUp,
  orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe,
  txStaartNa, txVerwijder,
  txLedgerActief: ledger.txLedgerActief, txLedgerVanKlant: ledger.txLedgerVanKlant,
  txLedgerVanZaak: ledger.txLedgerVanZaak, txLedgerTel: ledger.txLedgerTel,
  txLedgerAantal: ledger.txLedgerAantal, txVeegNu: ledger.txVeegNu,
  checkpointGrootboek: ledger.checkpointGrootboek
};
