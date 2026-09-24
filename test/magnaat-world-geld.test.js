/* Het geld van Magnaat World in ronde A2 (MAGNAAT.md).

   1. De World-scenario's raken alle 27 gebeurtenissen van de geldkaart. Dat
      wordt GEMETEN (./lib/magnaat-geldkaart-dekking.js telt de benen die echt
      liepen), niet beweerd.
   2. World rekent stap voor stap gelijk aan de WORLD ECONOMIC GOLDEN BASELINE
      (test/fixtures/magnaat-world-baseline.json). Vanaf hier mogen A2.2 t/m
      A2.9 de architectuur veranderen, maar de speluitkomst niet.
   3. A2.1 veranderde alleen de precisie: elke spelactie kreeg hetzelfde
      antwoord als ervoor, en geen enkel bedrag schoof verder dan de afronding
      kan verklaren (test/fixtures/magnaat-world-voor-a21.json).
   4. Na elke stap is elk monetair veld een geheel aantal eurocenten -- de lijst
      is dezelfde als die van de omzetting van een oude partij.
   5. Beide kanten van een contractbetaling dragen exact hetzelfde bedrag.
   6. De canonieke geldfunctie op haar grenzen.
   7. Een partij van voor A2.1 wordt een keer omgezet, en nooit twee keer. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const kaart = require('../scripts/lib/magnaatgeldkaart');
const { metDekking } = require('./lib/magnaat-geldkaart-dekking');
const { SCENARIOS, draai, nieuweWereld } = require('./lib/magnaat-world-scenarios');
const C = require('../server/kern/spellen/magnaat/centen');

function vergelijk(ref, naam) {
  const uit = draai(naam).stappen;
  const verwacht = ref.scenarios[naam].stappen;
  assert.equal(uit.length, verwacht.length, naam + ': ander aantal stappen');
  for (let i = 0; i < verwacht.length; i++) {
    if (uit[i].hash === verwacht[i].hash) continue;
    const delen = Object.keys(verwacht[i].delen || {}).filter(k => verwacht[i].delen[k] !== uit[i].delen[k]);
    assert.fail(naam + ' stap ' + verwacht[i].stap + ' (' + verwacht[i].soort + ') wijkt af in: ' + delen.join(', '));
  }
}

test('1. de World-scenario\'s raken alle gebeurtenissen van de geldkaart', () => {
  const telling = metDekking(() => {
    const s = require('./lib/magnaat-world-scenarios');
    for (const naam of Object.keys(s.SCENARIOS)) s.draai(naam);
  });
  const niet = kaart.GEBEURTENISSEN.filter(g => !telling[g.id]).map(g => g.id + ' ' + g.betekenis);
  assert.deepEqual(niet, [], 'gebeurtenissen die geen scenario raakt: ' + niet.join(', '));
});

test('2. World rekent stap voor stap gelijk aan de WORLD ECONOMIC GOLDEN BASELINE', () => {
  const ref = require('./fixtures/magnaat-world-baseline.json');
  assert.equal(ref.regelversie, C.WORLD_REGELVERSIE, 'de baseline hoort bij de regelversie waar World op rekent');
  for (const naam of Object.keys(SCENARIOS)) vergelijk(ref, naam);
});

test('3. A2.1 veranderde alleen de precisie: dezelfde antwoorden, en bedragen binnen de afronding', () => {
  const voor = require('./fixtures/magnaat-world-voor-a21.json');
  for (const naam of Object.keys(SCENARIOS)) {
    const r = draai(naam);
    const oud = voor.scenarios[naam];
    r.stappen.forEach((s, i) => {
      if (s.soort === 'maand' || s.stap === 'start') return;
      assert.equal(s.delen.antwoord, oud.stappen[i].delen.antwoord, naam + ' stap ' + s.stap + ' (' + s.soort + ') kreeg een ander antwoord');
    });
    /* Wat de afronding kan verklaren: het maandresultaat werd voor A2.1 op hele
       euro's afgerond en nu op centen, dus hooguit een euro per maand per
       speler. Een eenheidsfout (een factor honderd) of een vergeten betaling
       valt daar ver buiten. */
    const grens = r.eind.maand * 1;
    for (const h of Object.keys(oud.eind.geld)) {
      const verschil = Math.abs(C.uitCenten(r.eind.geld[h]) - oud.eind.geld[h]);
      assert.ok(verschil <= grens, naam + ': de kas van ' + h + ' schoof ' + verschil.toFixed(2) + ' euro, meer dan ' + grens);
    }
    for (const pot of ['lokaal', 'centraal']) {
      const verschil = Math.abs(C.uitCenten(r.eind.foundation[pot]) - oud.eind.foundation[pot]);
      assert.ok(verschil <= grens, naam + ': de Foundation-pot ' + pot + ' schoof ' + verschil.toFixed(2) + ' euro');
    }
  }
});

test('4. na elke stap is elk monetair veld een geheel aantal eurocenten', () => {
  let velden = 0;
  for (const naam of Object.keys(SCENARIOS)) {
    draai(naam, {
      naElkeStap(w, stap) {
        assert.equal(w.st.eenheid, C.EENHEID);
        C.elkMonetairVeld(w.st, (houder, veld) => {
          velden++;
          assert.ok(Number.isSafeInteger(houder[veld]), naam + ' na ' + JSON.stringify(stap[0] === 'maand' ? stap : stap[1]) + ': ' + veld + ' = ' + houder[veld]);
        });
      }
    });
  }
  assert.ok(velden > 500, 'de toets keek ook echt naar velden (' + velden + ')');
});

test('5. een contractbetaling draagt aan beide kanten exact hetzelfde bedrag', () => {
  const w = nieuweWereld('wereld-a21-contract');
  const z = (h, x) => { const r = w.m.spel.zet(w.potje, h, x); assert.equal(r.status || 200, 200, x.actie + ': ' + r.error); return r; };
  z('a', { actie: 'open', kavel: w.kavel('terrein'), sector: 'logistiek', omvang: 4 });
  for (const zone of ['boulevard', 'centrum']) z('b', { actie: 'open', kavel: w.kavel(zone), sector: 'horeca', omvang: 10 });
  z('c', { actie: 'open', kavel: w.kavel('centrum'), sector: 'retail', omvang: 10 });
  const lev = w.st.vestigingen.a[0].id;
  /* Drie afnemers, bedragen die niet op een ronde cent uitkomen, en een
     leverancier die tekortschiet: het leverdeel is een breuk. */
  const afnemers = [[w.st.vestigingen.b[0].id, 'b', 970, 79192], [w.st.vestigingen.b[1].id, 'b', 1310, 106916], [w.st.vestigingen.c[0].id, 'c', 2110, 172193]];
  for (const [id, h, eenheden, bedrag] of afnemers) {
    const r = z(h, { actie: 'contract-voorstel', mijn: id, hun: lev, soort: 'vervoer', looptijd: 12, eis: 0, boete: 1, vooraf: 0, eenheden, bedrag, exclusief: false });
    z('a', { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' });
  }
  w.st.gerekendTot -= w.st.maandMs;
  w.m.eco.bijrekenen(w.potje);
  const regel = w.st.laatste.a.regels.find(x => x.id === lev);
  assert.ok(regel.levering && regel.levering.deel < 1, 'de leverancier schoot tekort: het leverdeel is een breuk (' + (regel.levering && regel.levering.deel) + ')');
  /* DE TOETS MOET KUNNEN ZAKKEN. Een keer afronden over het totaal geeft hier
     een andere cent dan per contract afronden; zonder dat verschil zou een
     leverancier die zijn omzet over het totaal rondt, toevallig groen staan. */
  const H = require('../server/kern/spellen/magnaat/handel');
  const los = w.st.contracten.map(c => H.afwikkelen(c, { geleverd: c.eenheden * regel.levering.deel, kwaliteit: 0 }).betaling);
  assert.notEqual(C.naarCenten(los.reduce((n, x) => n + x, 0)), los.reduce((n, x) => n + C.naarCenten(x), 0),
    'deze opstelling is niet gevoelig voor de volgorde van afronden; kies andere bedragen');
  const betaald = w.st.contracten.reduce((n, c) => n + c.betaald, 0);
  assert.ok(betaald > 0);
  assert.equal(regel.levering.omzetCenten, betaald, 'de leverancier ontvangt tot op de cent wat de afnemers betalen');
  assert.ok(w.st.contracten.every(c => c.betaald === c.ontvangen));
});

test('6. de canonieke geldfunctie op haar grenzen: een keer, de helft van nul af', () => {
  const gevallen = [
    [0, 0], [0.01, 1], [-0.01, -1], [0.005, 1], [-0.005, -1], [0.0049, 0], [-0.0049, 0],
    [1.005, 101], [1.015, 102], [2.675, 268], [10.01, 1001], [-10.01, -1001],
    [0.1 + 0.2, 30], [12.345, 1235], [-12.345, -1235], [250000, 25000000],
    [90071992547409.91, 9007199254740991]
  ];
  for (const [euro, cent] of gevallen) assert.equal(C.naarCenten(euro), cent, String(euro));
  assert.ok(Object.is(C.naarCenten(-0.004), 0), 'geen -0');
  for (const fout of [NaN, Infinity, -Infinity, '12', null, undefined, 90071992547409.93 * 2]) {
    assert.throws(() => C.naarCenten(fout), /geldbedrag|Te groot/, String(fout));
  }
  /* Rente over meerdere perioden: elke periode wordt een keer afgerond, en de
     som van de afgeronde stukken is wat er van het saldo afgaat. */
  let saldo = C.naarCenten(-1234.56), weg = 0;
  for (let i = 0; i < 24; i++) { const rente = C.naarCenten(C.uitCenten(-saldo) * 0.014); saldo -= rente; weg += rente; }
  assert.equal(saldo, C.naarCenten(-1234.56) - weg);
  assert.ok(Number.isSafeInteger(saldo));
  /* Herhaalde kleine bedragen tellen exact op, waar euro's met drijvende komma
     dat niet doen. */
  let c = 0, e = 0;
  for (let i = 0; i < 1000; i++) { c += C.naarCenten(0.1); e += 0.1; }
  assert.equal(c, 10000);
  assert.notEqual(e, 100, 'de oude manier telt 0,1 duizend keer niet op tot 100');
});

test('7. een partij van voor A2.1 wordt een keer omgezet, en nooit twee keer', () => {
  const st = {
    geld: { a: 1234.567, b: -0.005 }, foundation: { lokaal: 10.5, centraal: 0.1 },
    leningen: [{ restant: 999.994, betaaldRente: 1.005, betaaldAflossing: 0, opbrengst: null }],
    contracten: [{ betaald: 3.3, ontvangen: 3.3, boetes: 0, afkoop: undefined }],
    deelnemingen: [{ ontvangen: -2.675 }], polissen: [{ betaald: 7, uitgekeerd: 0 }]
  };
  assert.equal(C.zorgEenheid(st), true);
  assert.deepEqual(st.geld, { a: 123457, b: -1 });
  assert.deepEqual(st.foundation, { lokaal: 1050, centraal: 10 });
  assert.equal(st.leningen[0].restant, 99999);
  assert.equal(st.leningen[0].betaaldRente, 101);
  assert.equal(st.leningen[0].opbrengst, null, 'een veld dat er niet is, blijft er niet');
  assert.equal(st.deelnemingen[0].ontvangen, -268);
  assert.equal(st.eenheid, C.EENHEID);
  assert.equal(st.regelversie, C.WORLD_REGELVERSIE);
  assert.equal(C.zorgEenheid(st), false, 'een tweede keer verandert niets');
  assert.equal(st.geld.a, 123457);
});
