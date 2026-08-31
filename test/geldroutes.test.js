/* GEEN SLEUTEL IS GEEN VERZOEK -- op de handelingen die geld verplaatsen.

   Overal elders in dit huis is een idem-sleutel een vangnet: is hij er niet, dan
   gebeurt het werk gewoon. De kale ronde van de idemproef mat achttien
   geldroutes waar een woordelijk gelijke herhaling ZONDER sleutel het werk
   opnieuw deed -- /api/bank/overboek boekte twee keer, /api/bank/sepa stuurde
   twee keer het huis uit. Een dubbeltik op een trage verbinding is precies dat
   verzoek, twee keer.

   WAAROM DE GRENS IN server/lib/idem.js ZIT EN NIET IN DE HTTP-POORT. Daar heeft
   hij gestaan, en de toetsen wezen hem terug: server/lib/idem-poort.js draait
   VOOR de bewakers, dus een lid dat de rekening van een ander probeerde kreeg
   400 in plaats van 404 -- en test/geld-rollen.test.js, dat juist die
   eigendomsgrens meet, zag hem niet meer. Een ergonomische regel mag geen
   veiligheidsmeting blind maken.

   In de geldlaag staat de weigering NA de eigenaarscontrole (`if (!eigenaar(...))
   return 404` staat in de kern boven de metIdem-aanroep) en VOOR het werk. Dat is
   de enige plek waar allebei waar is.

   Draai los: node --test test/geldroutes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const maakIdem = require('../server/lib/idem');

function poort() {
  const doos = {};
  return maakIdem({ d: () => doos, save: () => {}, naam: 'proefIdem' });
}

test('zonder sleutel gebeurt het werk gewoon -- dat blijft de regel', async () => {
  let gedaan = 0;
  const uit = await poort()(null, 'afdruk', async () => { gedaan++; return { ok: true }; });
  assert.equal(gedaan, 1);
  assert.deepEqual(uit, { ok: true });
});

test('maar niet als de aanroeper zegt dat het geld verplaatst', async () => {
  let gedaan = 0;
  const uit = await poort()(null, 'afdruk', async () => { gedaan++; return { ok: true }; },
    { geld: 'boekt van de ene rekening naar de andere' });
  assert.equal(gedaan, 0, 'het werk mag niet gebeuren');
  assert.equal(uit.status, 400);
  assert.equal(uit.code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  assert.equal(uit.waarom, 'boekt van de ene rekening naar de andere',
    'de weigering zegt waarom juist deze handeling');
});

test('mét een sleutel doet dezelfde geldhandeling gewoon zijn werk, en eenmaal', async () => {
  const p = poort();
  let gedaan = 0;
  const werk = async () => { gedaan++; return { ok: true, boeking: 'b1' }; };
  const een = await p('overboek:NL1:k1', 'afdruk', werk, { geld: 'boekt' });
  const twee = await p('overboek:NL1:k1', 'afdruk', werk, { geld: 'boekt' });
  assert.equal(gedaan, 1, 'de herhaling doet het werk niet opnieuw');
  assert.equal(een.boeking, 'b1');
  assert.equal(twee.herhaald, true);
});

test('de twaalf geldhandelingen dragen de verklaring werkelijk', () => {
  /* MUTATIEPROEF: haal `{ geld: ... }` weg bij een van deze aanroepen en deze
     toets zakt met de bestandsnaam erbij. Zonder deze toets is de vlag een
     afspraak die niemand handhaaft -- en dat is precies hoe de belofte
     "idempotent op de clearende paden" hier eerder al een keer uit elkaar liep
     (zie de kop van server/kern/bank/overboeken.js). */
  const verwacht = {
    'server/kern/bank/overboeken.js': ["'stort:", "'overboek:", "'sepa:"],
    'server/kern/bank/incasso.js': ["'tkzet:"],
    'server/kern/bank/passen.js': ["'pasbetaal:"],
    'server/kern/bank/walletbrug.js': ["'naarwallet:"],
    'server/kern/bank/zakelijk.js': ["'batch:"],
    'server/kern/pay/verzoeken.js': ["'stuur:", "'klompje:"],
    'server/kern/pay/opladen.js': ["'oplaad:"],
    'server/kern/pay/kassa.js': ["'kas:"],
    'server/kern/pay/tegoed.js': ["'tegoedkoop:"],
  };
  let n = 0;
  for (const [bestand, sleutels] of Object.entries(verwacht)) {
    const tekst = fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');
    for (const s of sleutels) {
      const i = tekst.indexOf('metIdem(idem ? ' + s);
      assert.ok(i > 0, bestand + ': de geldhandeling ' + s + " staat er niet meer zo");
      /* Het blok van deze aanroep loopt tot de volgende metIdem of het einde;
         daarbinnen hoort de verklaring te staan. */
      const volgende = tekst.indexOf('metIdem(idem ?', i + 10);
      const blok = tekst.slice(i, volgende > 0 ? volgende : tekst.length);
      assert.match(blok, /\{ geld: '/,
        bestand + ': ' + s + " verplaatst geld maar verklaart dat niet -- een dubbeltik boekt hier twee keer");
      n++;
    }
  }
  assert.equal(n, 12, 'er horen er twaalf te zijn');
});

test('de weigering is geen 500 en geen stilte', async () => {
  const uit = await poort()(null, 'a', async () => ({ ok: true }), { geld: 'stort geld' });
  assert.ok(uit.error && uit.error.length > 30, 'een weigering zonder uitleg leert niemand iets');
  assert.ok(/idem/i.test(uit.error), 'en hij zegt wat er ontbreekt');
});
