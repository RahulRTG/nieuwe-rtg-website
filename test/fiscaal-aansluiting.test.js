/* DE AFSLUITING VAN EEN PERIODE: hoeveel van dit geld is bewezen.

   De controles bestonden al maar stonden elk in hun eigen module. Vijf
   beweringen over het optellen ervan:

   1. ALLES BEWEZEN IS 100% EN `af`. Twee onafhankelijke wegen komen op
      hetzelfde bedrag uit.
   2. GEEN AANGIFTE IS NIET NUL. Die centen zijn ONTBREKEND en niet bewezen --
      de gevaarlijkste categorie, want ontbrekende dekking ziet er in elk
      dashboard uit als nul.
   3. EEN AFWIJKENDE AANGIFTE maakt het VERSCHIL een uitzondering en de rest
      bewezen -- niet het hele bedrag rood.
   4. EEN FACTUUR ZONDER REGELS wordt gemeld en is niet fout maar ONBEKEND.
   5. DE PERCENTAGES TELLEN OP TOT HONDERD, en elke cent telt maar een keer.

   Draai los: node --experimental-sqlite --test test/fiscaal-aansluiting.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakAansluiting } = require('../server/kern/fiscaal/aansluiting');
const { maakBtwAangifte } = require('../server/kern/fiscaal/btwaangifte');

const ZAAK = { code: 'KIKUNOI', name: 'Kikunoi', settings: { land: 'NL' } };

function factuur(nummer, datum, regels) {
  const btwBedrag = regels.reduce((x, r) => {
    const c = Math.round(r.incl * 100);
    return x + c - Math.round(c / (1 + r.btw / 100));
  }, 0) / 100;
  return { nummer, datum, verkoper: { code: 'KIKUNOI', naam: 'Kikunoi' }, regels, btwBedrag };
}

function opzet(facturen) {
  const db = { data: { facturen: facturen || [] } };
  let n = 0;
  const nu = () => '2026-10-05T09:0' + (n++ % 10) + ':00.000Z';
  const { btwAangifte } = maakBtwAangifte({ db, save: () => {}, crypto, nu });
  const { aansluiting } = maakAansluiting({ db, btwAangifte, payrollOS: null });
  return { db, btwAangifte, aansluiting };
}

test('alles bewezen is honderd procent, en de periode is af', () => {
  const k = opzet([factuur('F-1', '2026-07-05', [{ incl: 121, btw: 21 }])]);
  k.btwAangifte.maak(ZAAK, '2026K3', 'Beheer');

  const s = k.aansluiting.sluiting(ZAAK, '2026K3');
  assert.equal(s.dekking.uitzonderingCenten, 0);
  assert.equal(s.dekking.ontbrekendCenten, 0);
  assert.equal(s.dekking.bewezenPct, 100);
  assert.equal(s.af, true);

  const btw = s.controles.find(c => c.sleutel === 'btw.aangifte');
  assert.equal(btw.stand, 'sluit_aan');
  assert.equal(s.controles.find(c => c.sleutel === 'register.regels-tegen-koppen').stand, 'sluit_aan');
  /* En de zin eronder belooft niet te veel: dekking is geen correctheid. */
  assert.match(s.let, /dekking, geen correctheid/i);
});

test('geen aangifte is niet nul maar ontbrekend', () => {
  const k = opzet([factuur('F-1', '2026-07-05', [{ incl: 121, btw: 21 }])]);
  const s = k.aansluiting.sluiting(ZAAK, '2026K3');

  const btw = s.controles.find(c => c.sleutel === 'btw.aangifte');
  assert.equal(btw.stand, 'niet_uitgevoerd');
  assert.equal(s.dekking.ontbrekendCenten, 2100, 'de btw van die factuur staat onder geen enkele controle');
  assert.equal(s.dekking.bewezenCenten, 0, 'en telt dus niet als bewezen');
  assert.equal(s.af, false);
  assert.equal(s.dekking.ontbrekendPct, 100);
});

test('een afwijkende aangifte maakt het verschil een uitzondering, niet alles', () => {
  const k = opzet([factuur('F-1', '2026-07-05', [{ incl: 1210, btw: 21 }])]);
  const a = k.btwAangifte.maak(ZAAK, '2026K3', 'Beheer').aangifte;
  assert.equal(a.verschuldigdCenten, 21000);

  // er komt na het opmaken een factuur bij: het register loopt voor op de aangifte
  k.db.data.facturen.push(factuur('F-2', '2026-08-01', [{ incl: 121, btw: 21 }]));
  const s = k.aansluiting.sluiting(ZAAK, '2026K3');

  const btw = s.controles.find(c => c.sleutel === 'btw.aangifte');
  assert.equal(btw.stand, 'wijkt_af');
  assert.equal(btw.verschilCenten, 2100);
  assert.equal(s.dekking.uitzonderingCenten, 2100, 'alleen het verschil is uitzondering');
  assert.equal(s.dekking.bewezenCenten, 21000, 'de rest blijft bewezen');
  assert.equal(s.af, false);
});

test('een factuur zonder regels is niet fout maar onbekend', () => {
  const zonder = { nummer: 'F-LEEG', datum: '2026-07-09',
    verkoper: { code: 'KIKUNOI', naam: 'Kikunoi' }, regels: [], btwBedrag: 0 };
  const k = opzet([factuur('F-1', '2026-07-05', [{ incl: 121, btw: 21 }]), zonder]);
  const s = k.aansluiting.sluiting(ZAAK, '2026K3');

  const c = s.controles.find(x => x.sleutel === 'register.zonder-regels');
  assert.ok(c, 'hij wordt gemeld en niet stilzwijgend overgeslagen');
  assert.equal(c.aantal, 1);
  assert.deepEqual(c.nummers, ['F-LEEG']);
  assert.match(c.let, /geen enkele controle/i);
  /* De aangifte weigert op zo'n register -- dus die controle staat op
     niet_uitgevoerd, en de centen zijn ontbrekend in plaats van bewezen. */
  assert.equal(s.controles.find(x => x.sleutel === 'btw.aangifte').stand, 'niet_uitgevoerd');
  assert.equal(s.af, false);
});

test('de percentages tellen op tot honderd en elke cent telt maar een keer', () => {
  const k = opzet([factuur('F-1', '2026-07-05', [{ incl: 1210, btw: 21 }])]);
  k.btwAangifte.maak(ZAAK, '2026K3', 'Beheer');
  k.db.data.facturen.push(factuur('F-2', '2026-08-01', [{ incl: 121, btw: 21 }]));

  const d = k.aansluiting.sluiting(ZAAK, '2026K3').dekking;
  assert.equal(d.bewezenCenten + d.uitzonderingCenten + d.ontbrekendCenten, d.totaalCenten);
  assert.equal(Math.round(d.bewezenPct + d.uitzonderingPct + d.ontbrekendPct), 100);
  /* Twee controles lopen over dezelfde omzet (het register met zichzelf en het
     register tegen de aangifte). Zou elk zijn centen apart optellen, dan was
     het totaal het dubbele van wat er is gefactureerd. */
  assert.equal(d.totaalCenten, 23100, 'de gefactureerde btw, en niet het dubbele');
});
