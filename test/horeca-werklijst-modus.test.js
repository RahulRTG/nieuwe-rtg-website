/* DE WERKLIJST VIEL OM ZONDER MODUS, EN WERKTE MET ROMMEL.

   In server/kern/horeca/werklijst.js stond:

     const modus = MODI[String((opties && opties.modus) || 'alles')] ? String(opties.modus) : 'alles';

   De VRAAG valt terug op 'alles', de TOEWIJZING niet. Zonder `modus` in het lijf
   werd de vraag dus `MODI['alles']` -- waar -- en de toewijzing
   `String(undefined)`, oftewel de tekst 'undefined'. Een regel later gaf
   `MODI['undefined'].soorten` een TypeError, en de route een 500.

   HET GEWONE GEVAL WAS HET KAPOTTE GEVAL. Een PDA die de servicelijst opvraagt
   zonder modus -- de eerste opdracht van elk PDA-scherm -- kreeg een 500. Wie er
   ROMMEL in stopte kreeg juist een net antwoord: `String({})` is geen modus, dus
   viel hij keurig terug op 'alles'. Precies omgekeerd aan wat je zou verwachten,
   en de reden dat dit zo lang kon blijven staan: de invoerproef meldde hem als
   "status 500 op rommelinvoer", terwijl het echte probleem het LEGE lijf was.

   Draai los: node --test test/horeca-werklijst-modus.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/* Een lege verzoeklaag, dezelfde snit als in test/horeca-werklijst.test.js:
   deze toets gaat over de MODUS-lens en niet over wat erin komt. */
const maak = () => require(path.join(__dirname, '..', 'server', 'kern', 'horeca', 'werklijst'))({
  horeca: { H: () => ({ rekeningen: {}, bonnen: {}, instel: {}, wachtrij: [] }) },
  schoon: (v, n) => String(v == null ? '' : v).slice(0, n),
  verzoeklaag: { SOORTEN: {}, wachtrij: () => ({ verzoeken: [] }) }
});
const leegHuis = { rekeningen: {}, bonnen: {}, instel: {}, wachtrij: [] };

test('zonder modus valt hij terug op "alles" in plaats van om te vallen', () => {
  /* Mutatie nagetrokken: de oude regel terugzetten laat deze toets zakken met
     "Cannot read properties of undefined (reading \'soorten\')" -- exact de
     TypeError uit het serverlogboek. */
  const w = maak();
  const zonderOpties = w.werklijst(leegHuis, 'ZAAK', {});
  assert.equal(zonderOpties.modus, 'alles', 'een leeg lijf geeft de volledige lijst');
  const zonderDerde = w.werklijst(leegHuis, 'ZAAK');
  assert.equal(zonderDerde.modus, 'alles', 'en helemaal geen opties ook');
});

test('een ONBEKENDE modus valt ook terug, en een bekende blijft staan', () => {
  /* De tegenproef: als alles altijd op "alles" uitkwam, zou de toets hierboven
     ook slagen met een kapotte lens. */
  const w = maak();
  assert.equal(w.werklijst(leegHuis, 'ZAAK', { modus: 'bestaat-niet' }).modus, 'alles');
  assert.equal(w.werklijst(leegHuis, 'ZAAK', { modus: { a: 1 } }).modus, 'alles',
    'ook rommel die geen tekenreeks is');
  assert.equal(w.werklijst(leegHuis, 'ZAAK', { modus: 'runner' }).modus, 'runner',
    'en een bekende modus wordt gewoon gebruikt');
});
