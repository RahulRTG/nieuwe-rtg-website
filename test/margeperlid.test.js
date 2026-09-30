/* DE MARGE PER LID -- server/kern/bedrijfsmaat/stand-marge.js (besluit C15).

   Zes beweringen, en alle zes kunnen ze zakken:
   1. per pas: bijdrage min kosten, gedeeld door ALLE leden van die pas (ook wie
      niets gebruikte);
   2. een lid met een andere pas telt bij zijn eigen pas, een zaak of gezin nergens;
   3. onder tien leden geen getal, en een enkele kleine pas trekt de kleinste
      zichtbare mee dicht (secundaire onderdrukking);
   4. een contractuele pas met een lid zonder contract krijgt geen getal;
   5. verbruik zonder tarief laat de hele maat zwijgen, met de soort erbij;
   6. een eerdere maand krijgt geen getal: de bijdrage is een stand van vandaag.

   Draai: node --test test/margeperlid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MARGE = require('../server/kern/bedrijfsmaat/stand-marge');

const NU = '2026-09-29T10:00:00.000Z';
const maat = (id, def, uitkomst, dektNiet) => Object.assign({ id, definitie: def, dektNiet }, uitkomst);
const ontleed = (d) => { const i = d.indexOf(':'); return { soort: d.slice(0, i), id: d.slice(i + 1) }; };

function kosten({ dragers, afstemming }) {
  return () => ({ ontleed, afstemming: () => afstemming || [],
    alleDragers: () => dragers.map(([drager, centen]) => ({ drager, centen })),
    kijk: (m, d) => { const r = dragers.find(x => x[0] === d); return r && r[2] ? { pas: r[2] } : {}; } });
}
const omzet = (rijen) => () => rijen;
const rij = (pas, aantal, maandOmzet, extra) => Object.assign({ pas, pasNaam: pas, aantal, maandOmzet, opMaat: false }, extra || {});
const reken = (o) => MARGE(Object.assign({ m: '2026-09', peilmoment: NU, maat }, o));
const pas = (uit, p) => uit.perPas.find(x => x.pas === p);

test('1. bijdrage min kosten, gedeeld door alle leden van de pas', () => {
  const uit = reken({
    kosten: kosten({ dragers: [['lid:a', 3000, 'rtg'], ['lid:b', 1000, 'rtg']] }),
    omzetPerPas: omzet([rij('gratis', 20, 0), rij('rtg', 20, 1300)]) });
  assert.equal(uit.stand, 'PER_PAS');
  const r = pas(uit, 'rtg');
  assert.equal(r.stand, 'TOONBAAR');
  /* 130000 cent bijdrage - 4000 kosten = 126000, over twintig leden en niet over de twee die iets gebruikten */
  assert.equal(r.waarde, 6300);
  assert.equal(r.n, 20);
  assert.equal(pas(uit, 'gratis').waarde, 0, 'de gratis pas kost hier niets en draagt niets');
  assert.equal(uit.graad, 'vermoed');
});

test('2. de pas uit de meting telt, guest is gratis, en een zaak of gezin nergens', () => {
  const uit = reken({
    kosten: kosten({ dragers: [['lid:a', 2000, 'guest'], ['zaak:X', 99999, 'zaak'], ['gezin:G', 5000], ['lid:c', 700, 'rtg']] }),
    omzetPerPas: omzet([rij('gratis', 10, 0), rij('rtg', 10, 650)]) });
  assert.equal(pas(uit, 'gratis').kostenCenten, 2000);
  assert.equal(pas(uit, 'gratis').waarde, -200);
  assert.equal(pas(uit, 'rtg').kostenCenten, 700);
  /* een trede die de ladder kent maar kern/passen.js niet, belandt niet stil bij RTG Pass */
  const lite = reken({ kosten: kosten({ dragers: [['lid:l', 900, 'business-lite']] }),
    omzetPerPas: omzet([rij('rtg', 10, 650), rij('business-lite', 10, 1500)]) });
  assert.equal(pas(lite, 'rtg').kostenCenten, 0);
  assert.equal(pas(lite, 'business-lite').kostenCenten, 900);
});

test('3. onder tien geen getal, en een enkele kleine pas trekt de kleinste zichtbare mee', () => {
  const uit = reken({ kosten: kosten({ dragers: [] }),
    omzetPerPas: omzet([rij('gratis', 40, 0), rij('rtg', 12, 780), rij('lifestyle', 3, 600)]) });
  const klein = pas(uit, 'lifestyle');
  assert.equal(klein.stand, 'TE_KLEINE_GROEP');
  assert.equal(klein.waarde, null);
  assert.equal(klein.n, undefined, 'geen aantal');
  assert.equal(pas(uit, 'rtg').stand, 'TE_KLEINE_GROEP', 'secundaire onderdrukking: anders is lifestyle terug te rekenen');
  assert.equal(pas(uit, 'gratis').stand, 'TOONBAAR');
});

test('4. een contractuele pas met een lid zonder contract krijgt geen getal', () => {
  const uit = reken({ kosten: kosten({ dragers: [] }),
    omzetPerPas: omzet([rij('rtg', 30, 1950), rij('business', 11, 50000, { opMaat: true, zonderContract: 1 }),
      rij('lifestyle', 15, 30000, { opMaat: true, zonderContract: 0 })]) });
  assert.equal(pas(uit, 'business').stand, 'NIET_UIT_TE_REKENEN');
  assert.match(pas(uit, 'business').waarom, /zonder lopend contract/);
  assert.equal(pas(uit, 'lifestyle').stand, 'TOONBAAR', 'een contractuele pas waar elk lid een contract heeft, rekent wel');
  assert.equal(pas(uit, 'lifestyle').waarde, 200000);
});

test('5. verbruik zonder tarief laat de maat zwijgen, met de soort erbij', () => {
  const uit = reken({ kosten: kosten({ dragers: [['lid:a', 100, 'rtg']],
    afstemming: [{ soort: 'ai', aantal: 5, gerekendCenten: null }, { soort: 'sms', aantal: 0, gerekendCenten: null }] }),
  omzetPerPas: omzet([rij('rtg', 20, 1300)]) });
  assert.equal(uit.stand, 'NIET_UIT_TE_REKENEN');
  assert.deepEqual(uit.zonderTarief, ['ai']);
  assert.equal(uit.perPas, undefined);
});

test('6. een eerdere maand en een ontbrekende laag geven geen getal maar een reden', () => {
  const k = kosten({ dragers: [] }), o = omzet([rij('rtg', 20, 1300)]);
  const oud = reken({ m: '2026-08', kosten: k, omzetPerPas: o });
  assert.equal(oud.stand, 'NIET_UIT_TE_REKENEN');
  assert.match(oud.waarom, /stand van vandaag/);
  assert.equal(reken({ kosten: () => null, omzetPerPas: o }).stand, 'NIET_UIT_TE_REKENEN');
  /* een register dat afkapte, levert geen noemer */
  const kap = reken({ kosten: k, omzetPerPas: () => null });
  assert.equal(kap.stand, 'NIET_UIT_TE_REKENEN');
  assert.match(kap.waarom, /niet alle leden/);
});
