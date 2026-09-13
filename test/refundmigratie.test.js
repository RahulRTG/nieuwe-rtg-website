/* DE MIGRATIEKAART VAN DE BETAALSTAND (scripts/refundmigratie.js).

   De eigenaar heeft besloten dat een terugstorting een TEGENBOEKING is en geen
   wisser. Voor BESTELLINGEN is dat uitgevoerd; rides, tickets en boekingen
   wissen hun betaalstand nog. Deze kaart telt de lezers per collectie, zodat
   die omzetting niet op een gok hoeft te beginnen.

   WAT DEZE TOETS BEWAAKT is niet de migratie maar de KAART. Twee dingen kunnen
   er stil mee misgaan, en allebei sturen ze het werk verkeerd:

     - zij raakt haar eigen werk kwijt. Dat is gebeurd: de collectie van een
       bestand werd gezocht op `\borders\b`, en dat vond `order.paid` niet en
       `ordersVanZaak(...)` evenmin. Twee verklaarde lezers vielen uit de
       telling en werden gemeld als VERDWENEN. Toets 0 houdt dat vast.
     - zij groeit stil. Een nieuwe lezer die niemand indeelt, is precies de
       plek waar de omzetting straks op stukloopt. Toets 4 is daarom een ratel:
       het aantal onverklaarde lezers mag alleen omlaag.

   WAT ZIJ NIET BEWAAKT: of een verklaring KLOPT. Dat is een oordeel op gelezen
   code en geen meting -- dezelfde grens als test/ritmigratie.test.js.

   Draai los: node --test test/refundmigratie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const M = require('../scripts/refundmigratie');

/* DE RATEL. Gemeten op 13 september 2026, nadat de schermen erbij waren gezet
   en de bundels eruit. Hij mag alleen omlaag: elke lezer die iemand indeelt,
   verlaagt hem. Wie hem verhoogt om een toets groen te krijgen, haalt de reden
   weg waarom deze kaart bestaat. */
const ONVERKLAARD_MAX = 36;

test('0. de kaart raakt haar eigen werk niet kwijt', () => {
  const u = M.meet();
  assert.deepEqual(u.verdwenen, [],
    'de kaart verklaart een bestand dat de meter niet meer vindt. Dat is bijna nooit een verwijderd ' +
    'bestand en bijna altijd de TOEWIJZING: controleer scripts/refundmigratie.js (STAM, VENSTER, BUNDELS)');
});

test('1. elke plek in de kaart bestaat ook echt', () => {
  for (const rel of Object.keys(M.LEZERS).concat(Object.keys(M.GEEN_LEZER)))
    assert.ok(fs.existsSync(path.join(WORTEL, rel)), rel + ' bestaat niet');
});

test('2. elke lezer draagt een soort, een collectie, een stand en een reden', () => {
  for (const [rel, l] of Object.entries(M.LEZERS)) {
    assert.ok(['toont', 'telt', 'grendel'].includes(l.soort), rel + ': onbekende soort');
    assert.ok(M.COLLECTIES.includes(l.collectie), rel + ': onbekende collectie');
    assert.ok(['om', 'geen-werk'].includes(l.stand), rel + ': onbekende stand');
    assert.ok(l.wat && l.wat.length > 15, rel + ': zegt niet wat hij leest');
    assert.ok(l.gedaan && l.gedaan.length > 25, rel + ': zegt niet wat ermee gedaan is');
  }
});

test('3. de twee lezers die geld OPTELDEN, lezen de terugstorting nu ook', () => {
  /* Lexicaal, en dat staat er met opzet bij: dit bewijst niet dat het scherm
     het juiste bedrag toont, alleen dat het de stand kan zien. Het gedrag van
     de PROJECTIES eronder staat als storing in scripts/omzetproef.js, tegen een
     echte server, met een mutatie nagetrokken. Deze twee regels zijn stil
     gebroken toen `paid` bij een terugstorting bleef staan, en een stille
     breuk verdient een wachter die hem terugziet. */
  for (const rel of ['public/apps/leverancier/leverancier-58.js', 'public/apps/app-main/app-main-43.js']) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    const somRegels = bron.split('\n').filter(r => /\.paid\b/.test(r) && /filter|reduce/.test(r));
    assert.ok(somRegels.length, rel + ': geen optelling meer gevonden -- is deze regel verplaatst?');
    for (const r of somRegels)
      assert.match(r, /refunded/,
        rel + ': telt geld op uit `paid` zonder `refunded` ernaast -- een teruggestorte bon telt dan mee:\n    ' + r.trim());
  }
});

test('4. de kaart groeit niet stil: onverklaarde lezers mogen alleen omlaag', () => {
  const u = M.meet();
  assert.ok(u.telling.onbekend <= ONVERKLAARD_MAX,
    'er staan ' + u.telling.onbekend + ' onverklaarde lezers in de kaart en de ratel staat op ' +
    ONVERKLAARD_MAX + '. Deel de nieuwe in (scripts/refundmigratie.js) in plaats van de ratel te verhogen.');
});

test('5. de telling spreekt zichzelf niet tegen', () => {
  const u = M.meet();
  assert.equal(u.telling.verklaard + u.telling.onbekend, u.telling.bestanden - Object.keys(M.GEEN_LEZER).length,
    'verklaard + onbekend dekt niet alle gevonden bestanden');
  assert.equal(u.telling.scherp + u.telling.ruim, u.telling.verklaard + u.telling.onbekend,
    'elke rij hoort een bereik te dragen (venster of bestand)');
  assert.equal(u.telling.server + u.telling.scherm, u.telling.verklaard + u.telling.onbekend,
    'elke rij hoort een laag te dragen (server of scherm)');
});
