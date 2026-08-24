/* Het transactie-grootboek op de SQLITE-opslag -- de standaardopslag.

   Het grootboek bestond al, maar alleen voor Postgres ("zonder Postgres is dit
   inert"). Daardoor hield juist de standaardopslag de laatste
   O(alles)-serialisatie in stand: `orders` is EEN kv-rij, dus elke nieuwe order
   liet de hele collectie opnieuw serialiseren en wegschrijven -- gemeten 460 KB
   na 1050 orders, en dat groeit lineair mee.

   Deze toets legt hetzelfde contract vast als test/txledger.pg.test.js, maar dan
   zonder database: venster in het RAM, de rest als geindexeerde rij, verlies-vrij
   vegen, historie voorbij het venster, en statuswissels die doorstromen. Plus de
   claim die de reden van dit werk is: de kv-blob groeit niet meer mee.
   Draai los: node --experimental-sqlite --test test/txledger-sqlite.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

// Eigen proces: de opslagmodules houden hun verbinding en het grootboek in
// modulescope, en dit is de enige toets die dat globale grootboek aanzet.
function rit(env) {
  const uit = execFileSync(process.execPath, ['--experimental-sqlite', path.join(__dirname, 'txledger-sqlite-rit.js')],
    { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 120000 });
  return JSON.parse(uit.trim().split('\n').pop());
}

test('grootboek op sqlite: RAM-venster, verlies-vrij vegen, historie en doorstroom', () => {
  const r = rit({});

  // het venster: het RAM houdt precies TX_RAM_*, de rest leeft in het grootboek
  assert.equal(r.ramOrders, 10, 'orders-venster gekapt op TX_RAM_ORDERS');
  assert.equal(r.ramBoekingen, 8, 'boekingen-venster gekapt op TX_RAM_BOEKINGEN');
  // verlies-vrij: ALLES staat in het grootboek (venster + uitgerolde staart)
  assert.equal(r.ledgerOrders, 30, 'alle 30 orders in het grootboek');
  assert.equal(r.ledgerBoekingen, 15, 'alle 15 boekingen in het grootboek, niets stilletjes weg');
  // historie voorbij het venster, nieuwste eerst, en echt de uit het RAM gerolde
  assert.equal(r.historieN, 20, '20 orders voorbij het venster op te vragen');
  assert.equal(r.historieIsOud, true, 'de historie-pagina bevat alleen items die niet meer in het RAM staan');
  // een statuswissel op een venster-item stroomt via de hete kop door
  assert.equal(r.mutatieStatus, 'terugbetaald', 'statuswissel doorgestroomd naar het grootboek');

  /* DE TWEE GELDCOLLECTIES, sinds vandaag ook in het grootboek. Ze hebben andere
     veldnamen dan een order (key in plaats van customerKey, bedrag in plaats van
     total), en dat is precies waar dit stil fout gaat: de rij wordt gewoon
     geschreven, alleen met een lege klant en een bedrag van 0. Daarom telt hier
     niet alleen HOEVEEL rijen er staan, maar of ze op hun eigen sleutel terug te
     vinden zijn en of het bedrag klopt. */
  assert.equal(r.ramBetalingen, 5, 'betalingen-venster gekapt op TX_RAM_DIRECTBETALINGEN');
  assert.equal(r.ramVerzoeken, 4, 'verzoeken-venster gekapt op TX_RAM_BETAALVERZOEKEN');
  assert.equal(r.ledgerBetalingen, 12, 'alle 12 betalingen in het grootboek, niets stilletjes weg');
  assert.equal(r.ledgerVerzoeken, 6, 'en alle 6 betaalverzoeken');
  assert.equal(r.betalingenVanLid, 12, 'de betalingen zijn terug te vinden op de sleutel van het lid (key)');
  assert.equal(r.verzoekenVanCodenaam, 6, 'en de verzoeken op de codenaam in kleine letters');
  assert.equal(r.betalingBedragOk, true, 'met het echte bedrag in de rij, niet 0');
  assert.equal(r.vensterNogVindbaar, true, 'het venster-item blijft op ref vindbaar');
  // de bestaande index blijft de waarheid voor het venster
  assert.equal(r.opRefUitVenster, true, 'orderMetRef vindt een venster-item');

  // en de reden van dit werk: de kv-rij `orders` bevat alleen nog het venster
  assert.equal(r.blobOrders, 10, 'de kv-blob houdt alleen het venster, niet alle 30');
  assert.ok(r.blobBytesNa < r.blobBytesVoor, 'de kv-rij is kleiner geworden (' + r.blobBytesVoor + ' -> ' + r.blobBytesNa + ' bytes)');
  // het grootboek staat in zijn eigen bestand, niet in store.db
  assert.equal(r.grootboekBestand, true, 'grootboek.db bestaat naast store.db');
  /* Versleuteling-at-rest: de INHOUD is onleesbaar, de SLEUTELKOLOMMEN staan
     bewust wel leesbaar op schijf -- indexeren op onleesbare tekst kan niet, en
     de Postgres-kant doet het al net zo. Privacy zit erin dat `klant` een
     codenaam-sleutel is; echte namen staan in de gescheiden kluis. Deze twee
     beweringen staan er juist samen, zodat die keuze niet stil kan verschuiven. */
  assert.equal(r.inhoudLeesbaar, false, 'met RTG_ENC_KEY is de inhoud van een order niet leesbaar op schijf');
  assert.equal(r.sleutelLeesbaar, true, 'de sleutelkolommen staan bewust leesbaar op schijf (anders geen index)');

  /* ---- RTG Pay in het grootboek, en het venster voorbij een bladzijde
         (TAKEN.md 4.39) ----

     Dezelfde ronde als in test/txledger.pg.test.js, maar op de STANDAARDopslag:
     wat daar de timestamptz bewaakt, bewaakt hier dat de bijvulronde ook in
     sqlite het hele venster terughaalt. */
  assert.equal(r.payLedger, 700, 'alle 700 pay-regels staan in het grootboek');
  assert.equal(r.payTopUp, 700, 'na een verloren blob komt het HELE venster terug, niet de eerste bladzijde van 500');
  assert.equal(r.payNieuwsteEerst, true, 'en in de goede volgorde: nieuwste eerst, ook met een tijdstip in milliseconden');
  assert.equal(r.payTweedeRondeRaakteNiets, true, 'een tweede bijvulronde op een kloppend venster raakt niets aan: geen dubbele regels, geen nieuwe array');
  assert.equal(r.payTweedeRondeLas, 500, 'en hij leest daarvoor EEN bladzijde, niet het hele grootboek');
  /* Het gat aan de ACHTERKANT: de blob draagt de 200 nieuwste, de rest ontbreekt.
     Wat er dan bijkomt is ouder dan wat er staat, en alleen de sortering na het
     samenvoegen zet het venster weer op volgorde. */
  assert.equal(r.payGatAchteraanN, 700, 'ook een gat achteraan wordt helemaal gedicht');
  assert.equal(r.payGatAchteraanOpVolgorde, true, 'en het venster staat daarna op volgorde, nieuwste eerst');
  assert.equal(r.payGatAchteraanEerste, 'PB-SQ699', 'met de allernieuwste vooraan');
});

test('uit te zetten met TX_LEDGER_SQLITE=0: dan blijft alles in de blob', () => {
  const r = rit({ TX_LEDGER_SQLITE: '0' });
  assert.equal(r.actief, false, 'het grootboek is inert');
  assert.equal(r.ramOrders, 30, 'alle orders blijven in het RAM');
  assert.equal(r.blobOrders, 30, 'en dus ook alle 30 in de kv-blob, zoals voorheen');
});
