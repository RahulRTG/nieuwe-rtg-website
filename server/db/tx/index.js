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
   hier de index zelf. De gemaksnamen waar de app mee leest en schrijft -- welke
   collecties er zijn en wat hun grens is -- staan in ./namen.js: dit bestand
   ging met de vijfde collectie over de 10 kB-grens van de keuring, en dat is de
   naad waarop het rustig kan. Hier staat HOE de index werkt, daar WELKE namen
   dit huis erdoorheen stuurt. */
const fs = require('fs');
const path = require('path');
const state = require('../state');
const ledger = require('./ledger');
const opslag = require('../opslag');
const db = state.db;

// index injecteert save() (venster-verhuis vraagt een snapshot) door naar het
// grootboek, en levert het RAM-venster aan de veegronde.
function wire(saveFn) { ledger.wire({ txStaartNa, txVerwijder, save: saveFn }); }

/* De klantsleutel komt uit ./collecties, en dat is geen omweg maar de reparatie
   van een duplicaat: hier stond `const txKlantVan = t => t.customerKey ||
   t.customerTier;` en in ledger.js stond exact dezelfde regel nog een keer.
   Zolang alleen orders en boekingen meededen viel dat niet op -- die dragen
   allebei customerKey. Een directe betaling draagt `key`, en dan wijst de ene
   kopie een klant aan waar de andere er geen ziet: de RAM-index vindt de
   betaling wel en het grootboek niet, of andersom. */
const { NAMEN, klantVan: txKlantVan, sleutelVan: txSleutelVan } = require('./collecties');
const txStaat = Object.fromEntries(NAMEN.map(n => [n, null]));
function txBouw(naam) {
  const arr = db.data[naam] || [];
  const st = { arr, len: arr.length, byRef: new Map(), byKlant: new Map(), byZaak: new Map() };
  for (const t of arr) {
    if (!t) continue;
    const s0 = txSleutelVan(naam, t);
    if (s0 != null && !st.byRef.has(s0)) st.byRef.set(s0, t); // .find-semantiek: de eerste (nieuwste) wint
    const k = txKlantVan(naam, t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); l.push(t); }
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
  /* EERST ZORGEN DAT DE COLLECTIE BESTAAT, en dat is geen overbodige regel.

     txBouw begint met `db.data[naam] || []`. Bestaat de collectie nog niet --
     een VERSE database, of een stand waarin nog nooit iets van dit soort is
     gemaakt -- dan is die `[]` een LOSSE array die nergens aan hangt. Het item
     wordt er netjes in gezet, txVoegToe geeft geen fout, en bij de volgende
     lezing ziet txZorg dat `st.arr !== db.data[naam]` en bouwt hij opnieuw op
     de echte (nog steeds afwezige) collectie. Het item is dan weg. Gemeten:
     zonder deze regel is `db.data.payBoekingen` na een toevoeging nog steeds
     `undefined`.

     Elke bestaande aanroeper ontliep dat toevallig -- directpay heeft een eigen
     ensure(), pay heeft grootboek(), en orders en boekingen bestaan al door de
     seed. Toevallig is geen bescherming: de volgende collectie die erbij komt
     heeft dat toeval niet, en de fout maakt geen enkel geluid. Repareer de
     oorzaak, niet het symptoom (LAT.md regel 1). */
  if (!Array.isArray(db.data[naam])) db.data[naam] = [];
  const st = txZorg(naam);
  const achteraan = !!(opties && opties.achteraan);
  if (achteraan) st.arr.push(t); else st.arr.unshift(t);
  st.len++;
  const sl = txSleutelVan(naam, t);
  if (sl != null && (achteraan ? !st.byRef.has(sl) : true)) st.byRef.set(sl, t);
  const k = txKlantVan(naam, t); if (k != null) { let l = st.byKlant.get(k); if (!l) st.byKlant.set(k, l = []); if (achteraan) l.push(t); else l.unshift(t); }
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
/* De gemaksnamen per collectie (welke naam, welke grens) staan in ./namen.js.
   Hierboven staat HOE de index werkt; daar staat WELKE collecties dit huis
   erdoorheen stuurt -- de kant die verandert als er een collectie bij komt. */
const namen = require('./namen')({ txMetRef, txVanKlant, txVanZaak, txVoegToe });

module.exports = {
  wire, initLedger: ledger.initLedger, initLedgerSqlite: ledger.initLedgerSqlite,
  afrondLedger: ledger.afrondLedger, vensterTopUp: ledger.vensterTopUp,
  ...namen,
  txStaartNa, txVerwijder,
  txLedgerActief: ledger.txLedgerActief, txLedgerVanKlant: ledger.txLedgerVanKlant,
  txLedgerVanZaak: ledger.txLedgerVanZaak, txLedgerTel: ledger.txLedgerTel,
  txLedgerAantal: ledger.txLedgerAantal, txVeegNu: ledger.txVeegNu,
  checkpointGrootboek: ledger.checkpointGrootboek
};
