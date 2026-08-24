/* Integratietest voor het transactie-grootboek (tx_ledger) tegen een ECHTE
   Postgres. Zonder DATABASE_URL skipt hij expliciet (geen valse groen): de
   json/sqlite-suite kan dit pad per definitie niet dekken, dus deze test
   bestaat juist om het Postgres-gedrag niet ongetest te laten.
   Draai lokaal: DATABASE_URL=postgres://... node --experimental-sqlite --test test/txledger.pg.test.js */
/* LET OP -- deze toets vraagt de database VOOR ZICHZELF. Verschillende
   PG-toetsen maken en droppen dezelfde tabellen (kv, tx_ledger, users), en
   `node --test` draait bestanden standaard PARALLEL: dan trekt de een de tabel
   onder de ander weg en zie je "spookfouten" die niets met de code te maken
   hebben. Draai ze daarom serieel via `npm run test:pg` (of geef elke toets een
   eigen database). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const DB = process.env.DATABASE_URL || process.env.PG_URL;

test('grootboek: RAM-venster + verlies-vrij vegen + historie + mutatie-doorstroom',
  { skip: DB ? false : 'DATABASE_URL ontbreekt; deze integratietest vergt een echte Postgres' }, () => {
  const uit = execFileSync(process.execPath, [path.join(__dirname, 'txledger-rit.js')],
    { env: { ...process.env, DATABASE_URL: DB }, encoding: 'utf8', timeout: 120000 });
  const r = JSON.parse(uit.trim().split('\n').pop());

  // het venster: RAM houdt precies TX_RAM_* items, de rest leeft in het grootboek
  assert.equal(r.ramOrders, 10, 'orders-venster gekapt op TX_RAM_ORDERS');
  assert.equal(r.ramBoekingen, 8, 'boekingen-venster gekapt op TX_RAM_BOEKINGEN');
  // verlies-vrij: ALLES staat in het grootboek (venster + uitgerolde staart)
  assert.equal(r.ledgerOrders, 30, 'alle 30 orders in het grootboek');
  assert.equal(r.ledgerBoekingen, 15, 'alle 15 boekingen in het grootboek (niets stilletjes weg)');
  // historie voorbij het venster is gepagineerd leesbaar en betreft juist de oude items
  assert.equal(r.historieN, 20, 'de 20 uitgerolde orders zijn als historie leesbaar');
  assert.equal(r.historieIsOud, true, 'de historie-pagina bevat geen venster-items');
  // een statuswissel op een venster-item stroomt via de veegronde door naar het grootboek
  assert.equal(r.mutatieStatus, 'terugbetaald', 'statuswissel is in het grootboek geland');
  assert.equal(r.vensterNogVindbaar, true, 'het venster-item blijft via de index vindbaar');

  /* ---- RTG Pay in het grootboek, en het venster voorbij een bladzijde
         (TAKEN.md 4.39) ----

     DIT IS DE PLEK WAAR DE TIMESTAMPTZ-VRAAG THUISHOORT. Een pay-boeking draagt
     `at` als GETAL en de kolom is een timestamptz; zonder normalisatie
     struikelt de insert en slikken beide wegen naar het grootboek de fout
     (txLedgerZet vangt hem, de veegronde meldt alleen "veegronde mislukt").
     Netto geeft de app 200, klopt het saldo, en staat er geen rij. Alleen een
     echte Postgres laat dat zien -- de SQLite-kolom is TEXT en neemt een getal
     gewoon aan.

     De asserties staan HIER en niet in een eigen bestand met een eigen skip:
     `zelfpoortendeToetsen` in NORM.json mag alleen omlaag, en deze toets poort
     zichzelf al. */
  assert.equal(r.payLedger, 700, 'alle 700 pay-regels staan in het grootboek');
  assert.equal(r.payTopUp, 700, 'na een verloren blob komt het HELE venster terug, niet de eerste bladzijde van 500');
  assert.equal(r.payNieuwsteEerst, true, 'en in de goede volgorde: nieuwste eerst, ook met een tijdstip in milliseconden');
  assert.equal(r.payTweedeRondeRaakteNiets, true, 'een tweede bijvulronde op een kloppend venster raakt niets aan: geen dubbele regels, geen nieuwe array');
  assert.equal(r.payTijdstipIsBasis, true,
    'en het tijdstip in de timestamptz-kolom is het tijdstip van de boeking, niet een moment van invoegen');
});
