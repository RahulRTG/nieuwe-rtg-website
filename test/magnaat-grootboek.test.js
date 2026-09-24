/* Het Magnaat-grootboek (ronde A2.0, MAGNAAT.md): de boekhoudautoriteit als
   eigen laag onder de economische motor.

   Wat hier vastligt, en wat test/magnaat-economische-motor.test.js niet al doet:
     1. het grootboek kent geen domein -- geen Oefenkantoor, geen markt, geen
        bedrijf, geen spel -- en laadt niets buiten zichzelf en de opslag
     2. de motor heeft geen eigen boekhouding meer: hij verhoogt geen volgnummer,
        vult geen journaal aan en zet geen saldo, dat doet alleen het grootboek.
        Zo kan er geen tweede boekhoudwaarheid ontstaan.
     3. het grootboek werkt zonder de motor: een consument die niets van
        dagen of bedrijven weet, kan boeken, bevestigen, herstellen en
        verifieren
   De gelijkwaardigheid met A1 (alle 267 gouden stappen) bewijst toets 1 van
   test/magnaat-economische-motor.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');
const { maakGrootboek, geheugenJournaal } = require('../server/kern/magnaat-grootboek');

const WORTEL = path.join(__dirname, '..');
const GROOTBOEK = path.join(WORTEL, 'server/kern/magnaat-grootboek');
const MOTOR = path.join(WORTEL, 'server/kern/magnaat-economische-motor');
const code = (map) => fs.readdirSync(map).filter(n => n.endsWith('.js'))
  .map(n => [n, zonderCommentaar(fs.readFileSync(path.join(map, n), 'utf8'))]);

test('1. het grootboek kent geen domein en laadt niets buiten zichzelf en de opslag', () => {
  const VERBODEN = [/oefen/i, /praktijk/i, /missie/i, /economenlab/i, /academy/i, /spelvorm/i, /markt/i,
    /bedrij/i, /profiel/i, /schok/i, /restaurant/i, /toerist/i, /kavel/i, /vestiging/i, /['"]rtg['"]/i];
  const TOEGESTAAN = /^(\.\/[a-z-]+|\.\.\/eigencollectie)$/;
  const bestanden = code(GROOTBOEK);
  assert.ok(bestanden.length >= 4, 'het grootboek is gevonden');
  for (const [n, c] of bestanden) {
    for (const re of VERBODEN) assert.doesNotMatch(c, re, n + ' kent ' + re);
    for (const [, dep] of c.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      assert.match(dep, TOEGESTAAN, n + ' laadt ' + dep + ': het grootboek hangt alleen aan zichzelf en de opslagdeclaratie');
    }
  }
});

test('2. de motor boekt nergens buiten het grootboek om', () => {
  const EIGEN_BOEKHOUDING = [
    [/\.boekVolgorde\s*(\+\+|\+=|-=)/, 'een eigen volgnummer'],
    [/vulJournaalAan|\.neemOver\s*\(\s*m\.wereld/, 'het journaal rechtstreeks aanvullen'],
    [/\.saldo\s*[-+]?=(?!=)/, 'een saldo zetten'],
    [/\.laatstToegepast\s*=(?!=)/, 'de projectie verzetten'],
    [/function\s+(boek|bevestig|herstelProjectie|saldiNa)\s*\(/, 'een tweede boekfunctie']
  ];
  for (const [n, c] of code(MOTOR)) {
    for (const [re, wat] of EIGEN_BOEKHOUDING) assert.doesNotMatch(c, re, n + ' doet zelf: ' + wat);
  }
});

function consument() {
  const opslag = geheugenJournaal();
  const gb = maakGrootboek({
    wereld: 'proef', opslag, soorten: { STORTING: 'STORTING' },
    versies: { regel: 'r1', motor: 'm1' }, periode: (p) => ({ nummer: p.periode, datum: 'P' + p.periode })
  });
  const p = { periode: 3, boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0,
    totalen: { debet: 0, credit: 0, aantal: 0 }, recent: [], vandaag: null, wachtend: [], integriteit: null };
  const storting = (sleutel, bedrag) => gb.boek(p, sleutel, 'STORTING', 'Storting', [
    gb.regel('a.kas', 'a', 'Kas', 'actief', 'debet', bedrag),
    gb.regel('a.inleg', 'a', 'Inleg', 'eigen-vermogen', 'credit', bedrag)
  ]);
  return { gb, p, opslag, storting };
}

test('3. een consument zonder dagen of bedrijven kan boeken, bevestigen, herstellen en verifieren', () => {
  const { gb, p, opslag, storting } = consument();
  const x = gb.metOorzaak('proef', () => storting('s1', 500));
  assert.equal(x.id, 'MJ-0003-00001');
  assert.deepEqual([x.wereld, x.volgnummer, x.soort, x.oorzaak, x.regelVersie, x.motorVersie, x.dag, x.datum],
    ['proef', 1, 'STORTING', 'proef', 'r1', 'm1', 3, 'P3']);
  assert.equal(storting('s1', 999), x, 'dezelfde sleutel is dezelfde gebeurtenis');
  assert.equal(opslag.laatsteVolgnummer('proef'), 0, 'voor bevestigen staat er niets in het bewijs');
  assert.equal(gb.bevestig(p), 1);
  assert.equal(p.rekeningen['a.kas'].saldo, 500);

  assert.throws(() => gb.boek(p, 's2', 'ONBEKEND', 'x', []), /Onbekende economische gebeurtenis/);
  assert.throws(() => gb.boek(p, 's3', 'STORTING', 'scheef', [gb.regel('a.kas', 'a', 'Kas', 'actief', 'debet', 5)]), /Ongebalanceerde/);
  assert.throws(() => gb.boek(p, '', 'STORTING', 'x', []), /idempotentiesleutel/);

  storting('s4', 250); gb.bevestig(p);
  assert.deepEqual(gb.verifieer(p), { ok: true, gebeurtenissen: 2, historieVanaf: 1, bevindingen: [] });

  /* Een projectie die achterloopt (niet weggeschreven) wordt bijgewerkt met
     alleen het ontbrekende stuk; een journaal dat achterloopt houdt het boeken tegen. */
  const oud = { periode: 3, boekVolgorde: 1, rekeningen: { 'a.kas': Object.assign({}, p.rekeningen['a.kas'], { saldo: 500 }), 'a.inleg': Object.assign({}, p.rekeningen['a.inleg'], { saldo: -500 }) },
    laatstToegepast: 1, totalen: { debet: 500, credit: 500, aantal: 1 }, recent: [], vandaag: null, wachtend: [], integriteit: null };
  gb.herstelProjectie(oud);
  assert.equal(oud.rekeningen['a.kas'].saldo, 750);
  assert.equal(oud.laatstToegepast, 2);
  const vooruit = Object.assign({}, oud, { laatstToegepast: 9, boekVolgorde: 9 });
  gb.herstelProjectie(vooruit);
  assert.equal(vooruit.integriteit.stand, 'journaal-achter');
  assert.throws(() => gb.boek(vooruit, 's6', 'STORTING', 'x', [gb.regel('a.kas', 'a', 'Kas', 'actief', 'debet', 1), gb.regel('a.inleg', 'a', 'Inleg', 'eigen-vermogen', 'credit', 1)]), /loopt voor op het journaal/);
});

test('4. twee werelden delen een opslag en nooit een journaal', () => {
  const opslag = geheugenJournaal();
  const maak = (wereld) => maakGrootboek({ wereld, opslag, soorten: { S: 'S' }, versies: { regel: '1', motor: '1' }, periode: () => ({ nummer: 0, datum: 'x' }) });
  const leeg = () => ({ boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0, totalen: { debet: 0, credit: 0, aantal: 0 }, recent: [], vandaag: null, wachtend: [], integriteit: null });
  const a = maak('a'), b = maak('b'), pa = leeg(), pb = leeg();
  const post = (gb, p, sleutel) => gb.boek(p, sleutel, 'S', 'x', [gb.regel('k', 'x', 'k', 'actief', 'debet', 1), gb.regel('e', 'x', 'e', 'eigen-vermogen', 'credit', 1)]);
  post(a, pa, 'zelfde'); a.bevestig(pa);
  post(b, pb, 'zelfde'); b.bevestig(pb);
  assert.equal(opslag.laatsteVolgnummer('a'), 1);
  assert.equal(opslag.laatsteVolgnummer('b'), 1, 'dezelfde sleutel in een andere wereld is een andere gebeurtenis');
  assert.equal(b.gebeurtenissen()[0].wereld, 'b');
});
