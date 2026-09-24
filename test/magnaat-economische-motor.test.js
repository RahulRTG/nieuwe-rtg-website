/* De economische motor van Magnaat, losgemaakt uit het Oefenkantoor (ronde A1,
   MAGNAAT.md par. 7). Deze toets bewijst de definition of done:

     - hetzelfde economische gedrag als de oude motor, stap voor stap, tegen de
       gouden referentie die VOOR de verhuizing uit de oude code is geschreven
     - de motor kent het Oefenkantoor niet (gelezen op de bron, zonder
       commentaar) en de afhankelijkheid loopt een kant op
     - het journaal is alleen aanvullen: geen gat, geen dubbel, geen inkorten,
       en een geweigerd besluit laat er niets in achter
     - 10.000+ gebeurtenissen: de projectie klopt, het journaal is volledig, een
       gewone beslissing leest het journaal niet, en een herhaling vanaf een
       bekend volgnummer geeft precies dezelfde saldi
     - herstel: loopt het journaal voor, dan wordt alleen het ontbrekende stuk
       toegepast; loopt het achter, dan weigert de motor te boeken
     - een wereld van voor A1 neemt zijn journaal mee, en het gat van de oude
       grens wordt benoemd in plaats van verzonnen */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');
const { SCENARIOS, draai } = require('./lib/magnaat-economie-scenarios');
const maakOefen = require('../server/kern/magnaat-oefeneconomie');
const { geheugenJournaal } = require('../server/kern/magnaat-economische-motor');

const MAP = path.join(__dirname, '..', 'server/kern/magnaat-economische-motor');
const gouden = require('./fixtures/magnaat-economie-gouden.json');

function economie({ wereld = {}, opslag = geheugenJournaal() } = {}) {
  return { wereld, opslag, ec: maakOefen({ wereldState: () => wereld, save: () => {}, motorklant: { aan: false }, opslag }) };
}

test('1. de nieuwe motor rekent stap voor stap gelijk aan de oude (gouden referentie)', () => {
  for (const naam of Object.keys(SCENARIOS)) {
    const uit = draai(() => economie().ec, naam);
    const ref = gouden.scenarios[naam];
    assert.equal(uit.length, ref.length, naam + ': ander aantal stappen');
    for (let i = 0; i < ref.length; i++) {
      if (uit[i].hash === ref[i].hash) continue;
      const delen = Object.keys(ref[i].delen || {}).filter(k => ref[i].delen[k] !== uit[i].delen[k]);
      assert.fail(naam + ' stap ' + ref[i].stap + ' (' + ref[i].soort + ', dag ' + ref[i].dag + ') wijkt af in: ' + delen.join(', '));
    }
  }
});

test('2. de motor kent het Oefenkantoor niet, en leunt er ook niet op', () => {
  const VERBODEN = [/praktijk/i, /['"]rtg['"]/, /oefen/i, /missie/i, /economenlab/i, /magnaatwereld/i, /spelvorm/i, /functieId/, /\btaak\b/i];
  const TOEGESTAAN = /^(\.\/[a-z-]+|\.\.\/magnaat-motorklant|\.\.\/eigencollectie|\.\.\/\.\.\/lib\/klok)$/;
  const bestanden = fs.readdirSync(MAP).filter(n => n.endsWith('.js'));
  assert.ok(bestanden.length >= 8, 'de motor is gevonden');
  for (const n of bestanden) {
    const code = zonderCommentaar(fs.readFileSync(path.join(MAP, n), 'utf8'));
    for (const re of VERBODEN) assert.doesNotMatch(code, re, n + ' kent ' + re);
    for (const [, dep] of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      assert.match(dep, TOEGESTAAN, n + ' laadt ' + dep + ': de motor hangt alleen aan zichzelf, zijn Rust-client, de opslagdeclaratie en de klok');
    }
  }
});

test('3. het journaal vult alleen aan: geen gat, geen dubbel, geen inkorten, niets herschrijven', () => {
  const code = zonderCommentaar(fs.readFileSync(path.join(MAP, 'journaal-opslag.js'), 'utf8'));
  assert.doesNotMatch(code, /\.splice\(|\.shift\(|\.pop\(|\.length\s*=[^=]|delete\s+b\.gebeurtenissen/, 'geen enkele weg om het journaal korter te maken');
  const { ec, opslag } = economie();
  ec.volgendeDag('s', 'd1');
  const laatste = opslag.laatste('oefenkantoor');
  const g = opslag.lees('oefenkantoor', laatste, laatste)[0];
  const volgende = (n, sleutel) => Object.assign({}, g, { volgnummer: n, sleutel, regels: [], labels: [] });
  assert.throws(() => opslag.voegToe('oefenkantoor', [volgende(laatste + 2, 'gat')]), /volgnummer/);
  assert.throws(() => opslag.voegToe('oefenkantoor', [volgende(laatste, 'dubbel')]), /volgnummer/);
  assert.throws(() => opslag.voegToe('oefenkantoor', [volgende(laatste + 1, g.sleutel)]), /sleutel/);
  assert.throws(() => { g.debet = 1; }, TypeError, 'een geboekte gebeurtenis is bevroren');
  assert.equal(opslag.laatste('oefenkantoor'), laatste, 'een geweigerde aanbieding laat niets achter');
});

test('4. een geweigerd besluit laat niets achter in het bewijs', () => {
  const { ec, opslag } = economie();
  ec.volgendeDag('s', 'd1');
  const voor = opslag.laatste('oefenkantoor');
  assert.equal(ec.beslis('directie', { lening: 5000000 }).status, 400);
  assert.equal(ec.beslis('directie', { prijs: 9999 }).status, 400);
  assert.equal(opslag.laatste('oefenkantoor'), voor);
  assert.equal(ec._state().laatstToegepast, voor);
  assert.ok(ec.beslis('directie', { lening: 200000 }).ok);
  assert.equal(opslag.laatste('oefenkantoor'), voor + 1, 'een geslaagde lening is precies een gebeurtenis');
  const lening = opslag.lees('oefenkantoor', voor + 1, voor + 1)[0];
  assert.equal(lening.soort, 'LENING');
  assert.match(lening.oorzaak, /^besluit:/);

  /* De besluiten van vandaag weigeren allemaal VOORDAT ze boeken; dat bewijst
     de grens dus niet. Deze transactie boekt eerst op de kopie en weigert dan. */
  const { maak } = require('../server/kern/magnaat-economische-motor');
  const wereld = {}, eigen = geheugenJournaal();
  const motor = maak({ wereld: 'proef', profiel: maakOefen.OEFENPROFIEL, wereldState: () => wereld, opslag: eigen, motorklant: { aan: false } });
  motor.overzicht('s');
  const tot = eigen.laatste('proef'), saldoVoor = wereld.economie.rekeningen['bank.kas'].saldo;
  const r = (rekening, kant) => ({ rekening, actor: 'bank', naam: rekening, soort: 'actief', debet: kant === 'd' ? 500 : 0, credit: kant === 'c' ? 500 : 0 });
  const uit = motor.transactie('s', (e) => {
    motor._boek(e, 'proef:half', 'ONBEKEND', 'half besluit', [r('bank.kas', 'd'), r('bank.leningen', 'c')]);
    return { status: 400, error: 'toch niet' };
  });
  assert.equal(uit.status, 400);
  assert.equal(eigen.laatste('proef'), tot, 'de boeking op de weggegooide kopie staat niet in het journaal');
  assert.equal(wereld.economie.rekeningen['bank.kas'].saldo, saldoVoor, 'en niet in de projectie');
});

test('5. 10.000+ gebeurtenissen: projectie klopt, journaal volledig, beslissen leest niet, herhaling gelijk', () => {
  const { ec, opslag } = economie();
  let punt = null;
  for (let d = 1; d <= 700; d++) {
    ec.volgendeDag('s', 'dag-' + d);
    for (const b of Object.values(ec._state().bedrijven)) assert.ok(b.voorraad >= 0, 'voorraad negatief op dag ' + d); // M-004
    if (d === 350) {
      const e = ec._state();
      punt = { bij: e.laatstToegepast, saldi: Object.fromEntries(Object.entries(e.rekeningen).map(([k, r]) => [k, r.saldo])) };
    }
  }
  const e = ec._state();
  assert.ok(e.laatstToegepast > 10000, 'meer dan 10.000 gebeurtenissen (' + e.laatstToegepast + ')');
  const alles = ec._gebeurtenissen();
  assert.equal(alles.length, e.laatstToegepast, 'geen enkele gebeurtenis weggegooid');
  alles.forEach((g, i) => assert.equal(g.volgnummer, i + 1));
  assert.equal(alles[0].sleutel, 'opening:rtg', 'de eerste boeking bestaat nog');
  assert.ok(!('journaal' in e), 'de projectie draagt geen journaal meer');

  const gelezenVoor = opslag.gelezen();
  ec.overzicht('s');
  ec.beslis('directie', { prijs: 110 });
  ec.registreerWerk('m', { id: 't', functieId: 'f', spelvorm: 'controle', punten: 80, stappen: [{ soort: 'keuze' }] });
  ec.kiesSchok('s', 'vraagpiek');
  ec.volgendeDag('s', 'dag-701');
  assert.equal(opslag.gelezen(), gelezenVoor, 'een gewone beslissing leest het journaal niet');

  const nu = ec._state();
  assert.deepEqual(ec.verifieer().bevindingen, [], 'de projectie is precies het journaal');
  const saldiNu = Object.fromEntries(Object.entries(nu.rekeningen).map(([k, r]) => [k, r.saldo]));
  assert.deepEqual(ec.saldiNa(punt.saldi, punt.bij), saldiNu, 'herhaling vanaf volgnummer ' + punt.bij + ' geeft exact de saldi van nu');
});

test('6. herstel: een voorlopend journaal wordt bijgewerkt, een achterlopend houdt de motor tegen', () => {
  const { wereld, ec, opslag } = economie();
  ec.volgendeDag('s', 'd1');
  const projectieVoor = structuredClone(wereld.economie);
  const toegepastVoor = projectieVoor.laatstToegepast;
  ec.volgendeDag('s', 'd2');
  const saldiNa = Object.fromEntries(Object.entries(wereld.economie.rekeningen).map(([k, r]) => [k, r.saldo]));
  const laatste = opslag.laatste('oefenkantoor');
  /* De projectie van na dag 2 ging verloren, het journaal niet. */
  wereld.economie = projectieVoor;
  const gelezenVoor = opslag.gelezen();
  const e = ec._state();
  assert.equal(e.laatstToegepast, laatste);
  assert.deepEqual(Object.fromEntries(Object.entries(e.rekeningen).map(([k, r]) => [k, r.saldo])), saldiNa);
  assert.ok(laatste > toegepastVoor);
  assert.equal(opslag.gelezen() - gelezenVoor, laatste - toegepastVoor, 'alleen het ontbrekende stuk is gelezen');
  assert.deepEqual(ec.verifieer().bevindingen, []);

  /* Andersom: de projectie staat verder dan het bewijs. */
  const ander = economie();
  ander.ec.volgendeDag('s', 'd1');
  const leeg = geheugenJournaal();
  const kapot = economie({ wereld: ander.wereld, opslag: leeg });
  const o = kapot.ec.overzicht('s');
  assert.equal(o.integriteit.stand, 'journaal-achter');
  assert.throws(() => kapot.ec.volgendeDag('s', 'd2'), /loopt voor op het journaal/);
});

test('7. een wereld van voor A1 neemt zijn journaal mee, en het gat van de oude grens wordt benoemd', () => {
  const bron = economie();
  for (let d = 1; d <= 5; d++) bron.ec.volgendeDag('s', 'd' + d);
  const oud = structuredClone(bron.wereld.economie);
  const alle = bron.ec._gebeurtenissen();
  /* Zo zag een oude wereld eruit: journaal nieuwste eerst, ingekort, met de
     idempotentiesleutels naast zich en zonder de velden van de nieuwe motor. */
  const bewaard = alle.slice(-30);
  oud.journaal = bewaard.slice().reverse().map(g => ({
    id: g.id, sleutel: g.sleutel, dag: g.dag, datum: g.datum, omschrijving: g.omschrijving,
    bedrag: g.bedrag, debet: g.debet, credit: g.credit, regels: g.regels, labels: g.labels
  }));
  oud.verwerkteBoekingen = Object.fromEntries(alle.map(g => [g.sleutel, g.id]));
  for (const k of ['laatstToegepast', 'totalen', 'recent', 'vandaag', 'wachtend', 'integriteit']) delete oud[k];
  const wereld = { economie: oud };
  const verder = economie({ wereld });
  const o = verder.ec.overzicht('s');
  assert.equal(o.grootboek.controle.inBalans, true);
  assert.ok(!('journaal' in wereld.economie) && !('verwerkteBoekingen' in wereld.economie));
  const v = verder.ec.verifieer();
  assert.equal(v.historieVanaf, alle.length - 29, 'de historie begint eerlijk waar de oude grens hem liet');
  assert.deepEqual(v.bevindingen, []);
  assert.equal(verder.opslag.ontbrekend('oefenkantoor').tot, alle.length - 30);
  verder.ec.volgendeDag('s', 'd6');
  assert.deepEqual(verder.ec.verifieer().bevindingen, [], 'na de overname loopt het journaal gewoon door');
});

test('8. werk is een economisch commando: de motor kent de activiteit, niet de missie', () => {
  const { maak } = require('../server/kern/magnaat-economische-motor');
  const wereld = {};
  const motor = maak({ wereld: 'proef', profiel: maakOefen.OEFENPROFIEL, wereldState: () => wereld, opslag: geheugenJournaal(), motorklant: { aan: false } });
  assert.equal(motor.verricht('m', { activiteit: 'dansen', kwaliteit: 50 }).status, 400, 'een onbekende activiteit is geen werk');
  assert.equal(motor.verricht('m', { activiteit: 'service', kwaliteit: 101 }).status, 400);
  assert.ok(motor.verricht('m', { activiteit: 'innovatie', kwaliteit: 100, context: { bron: 'spel' } }).ok);
  assert.equal(wereld.economie.werk.innovatie, 100);
  assert.equal(wereld.economie.werk.productiviteit, 60, 'innovatie telt ook als productiviteit -- een regel van de motor');
  const { ec } = economie();
  const uit = ec.registreerWerk('m', { id: 't1', functieId: 'fx', spelvorm: 'puzzel', punten: 100, stappen: [{ soort: 'keuze' }] });
  assert.deepEqual([uit.soort, uit.kwaliteit], ['innovatie', 100], 'het Oefenkantoor vertaalt spelvorm naar activiteit');
});

test('9. dezelfde wereld en dezelfde handelingen geven dezelfde gebeurtenissen, id voor id', () => {
  const a = economie(), b = economie();
  for (const x of [a, b]) {
    x.ec.beslis('directie', { prijs: 120 });
    x.ec.volgendeDag('s', 'd1');
    x.ec.volgendeDag('s', 'd2');
  }
  const vorm = (g) => [g.wereld, g.volgnummer, g.id, g.soort, g.oorzaak, g.sleutel, g.regelVersie, g.motorVersie, g.debet];
  assert.deepEqual(a.ec._gebeurtenissen().map(vorm), b.ec._gebeurtenissen().map(vorm));
  const dag = a.ec._gebeurtenissen().filter(g => g.dag === 1);
  assert.ok(dag.every(g => g.oorzaak === 'commando:d1'), 'elke boeking van de dag draagt het dagcommando als oorzaak');
  assert.ok(dag.some(g => g.soort === 'VERKOOP') && dag.some(g => g.soort === 'LOON'));
});
