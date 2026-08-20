/* DE PRE-FLIGHT: GO, REVIEW of BLOCK vóór de klik.

   Zes beweringen, en de belangrijkste is de laatste.

   1. WAT RTG NIET ZELFSTANDIG MAG, is BLOCK -- de zekerheidsklasse
      `voorbehouden` is een grens en geen waarschuwing.
   2. TE WEINIG HANDTEKENINGEN is REVIEW en geen BLOCK: dat is geen fout maar
      werk dat nog moet gebeuren. En de bedrag-drempel telt mee.
   3. EEN LOPENDE PERIODE IS BLOCK, met dezelfde reden die de aangifte straks
      zelf geeft.
   4. VERANDERDE CIJFERS ZIJN BLOCK -- en dit is het geval waar de pre-flight
      voor bestaat: dat hoor je liever voor dan na het invullen van een kenmerk.
   5. ALLE REDENEN KOMEN TERUG, niet alleen de zwaarste: wie het eerste oplost
      hoort niet tegen het tweede aan te lopen.
   6. EEN HANDELING ZONDER DROOGLOOP KRIJGT GEEN GO. Anders wordt "wij hebben
      niets nagekeken" op het scherm hetzelfde als "alles is in orde", en dat
      is precies de schijnzekerheid die deze hele laag moet uitsluiten.

   Draai los: node --experimental-sqlite --test test/fiscaal-preflight.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakPreflight } = require('../server/kern/fiscaal/preflight');
const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');

const ZAAK = { code: 'KIKUNOI', name: 'Kikunoi', settings: { land: 'NL' } };

function factuur(nummer, datum, incl, btw) {
  const c = Math.round(incl * 100);
  return { nummer, datum, verkoper: { code: 'KIKUNOI', naam: 'Kikunoi' },
    regels: [{ incl, btw }], btwBedrag: (c - Math.round(c / (1 + btw / 100))) / 100 };
}

function opzet(facturen, dag) {
  const db = { data: { facturen: facturen || [] } };
  let n = 0;
  const nu = () => (dag || '2026-10-05') + 'T09:0' + (n++ % 10) + ':00.000Z';
  const { btwAangifte } = maakBtwAangifte({ db, save: () => {}, crypto, nu });
  const { preflight } = maakPreflight({ db, btwAangifte });
  return { db, btwAangifte, preflight };
}

test('wat niet vanzelf gaat, is BLOCK zonder mens en REVIEW met mens', () => {
  const k = opzet();
  /* `btw.verzenden` staat als `voorbehouden` in het register: RTG dient nooit
     namens een ondernemer in. De klasse heet PROHIBITED_AUTOMATION -- dat gaat
     over de software, niet over de mens. */
  const vanzelf = k.preflight.keur('btw.verzenden', {});
  assert.equal(vanzelf.uitslag, 'BLOCK');
  const z = vanzelf.stappen.find(s => s.bron === 'zekerheid');
  assert.equal(z.klasse, 'voorbehouden');
  assert.match(z.reden, /belastingplichtige/i);

  /* Met een mens erop is het geen BLOCK maar een REVIEW: dat is het hele punt
     van die klasse. Zonder dat onderscheid blokkeert deze poort ook de
     handelingen die juist wel mogen. */
  const metMens = k.preflight.keur('btw.verzenden', { getekendDoor: ['A. Bakker'] });
  assert.equal(metMens.stappen.find(s => s.bron === 'zekerheid').uitslag, 'REVIEW');
  assert.match(metMens.stappen.find(s => s.bron === 'zekerheid').reden, /nooit vanzelf/i);

  // en vastleggen DAT er is ingediend is gewoon administratie
  assert.equal(zekerheidVan('btw.indienen'), 'bepaald');
});

const zekerheidVan = (s) => require('../server/kern/fiscaal/zekerheid').zekerheid(s).klasse;

test('te weinig handtekeningen is REVIEW, en de bedrag-drempel telt mee', () => {
  const k = opzet();
  const naheffing = { status: 'concept' };

  // onder de drempel: vier ogen, dus twee handtekeningen
  const klein = k.preflight.keur('naheffing.vaststellen',
    { naheffing, bedragCenten: 100000, getekendDoor: ['A. Bakker'] });
  const o1 = klein.stappen.find(s => s.bron === 'ogen');
  assert.equal(o1.uitslag, 'REVIEW', 'een van de twee is er');
  assert.equal(o1.nodig, 2);
  assert.equal(klein.uitslag, 'REVIEW', 'geen BLOCK: dit is werk dat nog moet gebeuren');

  /* Met de tweede handtekening erbij is de OGENPOORT rond -- maar het geheel
     blijft REVIEW, en dat is juist: een naheffing vaststellen is een besluit
     met rechtsgevolg en hoort nooit een stille GO te zijn. Dat verwachtte ik
     eerst anders; de code had gelijk. */
  const rond = k.preflight.keur('naheffing.vaststellen',
    { naheffing, bedragCenten: 100000, getekendDoor: ['A. Bakker', 'M. de Wit'] });
  assert.equal(rond.stappen.find(s => s.bron === 'ogen').uitslag, 'GO', 'de handtekeningen zijn er');
  assert.equal(rond.stappen.find(s => s.bron === 'naheffing').uitslag, 'GO', 'de stand klopt');
  assert.equal(rond.uitslag, 'REVIEW', 'en toch geen stille GO op een besluit met rechtsgevolg');

  // boven de drempel vraagt hij er drie, dus dezelfde twee zijn niet genoeg
  const groot = k.preflight.keur('naheffing.vaststellen',
    { naheffing, bedragCenten: 5000000, getekendDoor: ['A. Bakker', 'M. de Wit'] });
  const o2 = groot.stappen.find(s => s.bron === 'ogen');
  assert.equal(o2.nodig, 3);
  assert.equal(groot.uitslag, 'REVIEW');
  assert.match(o2.grond, /25000 euro/);
});

test('een lopende periode is BLOCK, met de reden die de aangifte zelf geeft', () => {
  const k = opzet([factuur('F-1', '2026-10-02', 121, 21)], '2026-10-05');
  const a = k.btwAangifte.maak(ZAAK, '2026K4', 'Beheer').aangifte;

  const r = k.preflight.keur('btw.indienen', { aangifte: a, vandaag: '2026-10-05', kenmerk: 'BD-1' });
  const d = r.stappen.find(s => s.bron === 'aangifte');
  assert.equal(d.uitslag, 'BLOCK');
  assert.match(d.reden, /periode loopt nog tot en met 2026-12-31/);
});

test('veranderde cijfers zijn BLOCK -- en dat hoor je liever vooraf', () => {
  const k = opzet([factuur('F-1', '2026-07-05', 121, 21)], '2026-10-05');
  const a = k.btwAangifte.maak(ZAAK, '2026K3', 'Beheer').aangifte;

  // eerst is alles in orde: de periode is voorbij en de cijfers staan gelijk
  const voor = k.preflight.keur('btw.indienen', { aangifte: a, vandaag: '2026-10-05', kenmerk: 'BD-1' });
  assert.equal(voor.stappen.find(s => s.bron === 'register').uitslag, 'GO');

  // er komt een factuur bij ná het opmaken
  k.db.data.facturen.push(factuur('F-2', '2026-08-01', 121, 21));
  const na = k.preflight.keur('btw.indienen', { aangifte: a, vandaag: '2026-10-05', kenmerk: 'BD-1' });
  const reg = na.stappen.find(s => s.bron === 'register');
  assert.equal(reg.uitslag, 'BLOCK');
  assert.match(reg.reden, /veranderd sinds het opmaken/i);
  assert.match(reg.reden, /opnieuw op/i);
});

test('alle redenen komen terug, niet alleen de zwaarste', () => {
  const k = opzet();
  /* Twee dingen tegelijk: het is een besluit dat nooit vanzelf gaat, EN er
     ontbreekt een handtekening. Wie alleen de zwaarste te zien krijgt, lost die
     op en loopt daarna tegen de andere aan. */
  const r = k.preflight.keur('naheffing.vaststellen',
    { naheffing: { status: 'concept' }, bedragCenten: 100000, getekendDoor: ['A. Bakker'] });
  assert.equal(r.uitslag, 'REVIEW');
  assert.equal(r.redenen.length, 2, 'twee redenen, niet een: ' + JSON.stringify(r.redenen));
  assert.ok(r.redenen.some(x => /nooit vanzelf/i.test(x)), 'de klasse');
  assert.ok(r.redenen.some(x => /handtekeningen/i.test(x)), 'en de ogen');
});

test('een handeling zonder droogloop krijgt geen GO', () => {
  const k = opzet();
  const r = k.preflight.keur('iets.nieuws', {});
  assert.notEqual(r.uitslag, 'GO', '"niets nagekeken" mag nooit als "alles in orde" lezen');
  const d = r.stappen.find(s => s.bron === 'droogloop');
  assert.equal(d.uitslag, 'REVIEW');
  assert.match(d.reden, /geen droogloop ingericht/i);
  // en de onbekende sleutel valt in het zekerheidsregister op de voorzichtige kant
  assert.equal(r.stappen.find(s => s.bron === 'zekerheid').klasse, 'advies');
});
