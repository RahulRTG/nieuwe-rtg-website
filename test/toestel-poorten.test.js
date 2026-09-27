/* De poorten van de toestelrekenlaag (TOESTEL.md par. 9.1).

   De regel die deze toets moet laten staan, ook na een toekomstige refactor
   die alles "handig" in een score() wil stoppen:

     een kandidaat die bij een eerdere poort is uitgesloten, kan door geen
     enkele latere eigenschap opnieuw kandidaat worden.

   Toets 1 is het scherpe geval: gratis met een privacyfout verliest altijd van
   een cent die alles haalt. Toets 2 is dezelfde regel over duizenden
   willekeurige kandidaten, met het kostenvoordeel altijd bij de afgevallene.
   Draai los: node --test test/toestel-poorten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/shared/toestel/poorten.js');

const CONTRACT = {
  taak: 'spraak.naartekst',
  plaatsen: ['toestel', 'rtg-omgeving'],
  technieken: ['model'],
  kwaliteit: { maat: 'wer', max: 0.2, graad: 'gemeten' },
  last: { startMaxMs: 1500, modelMaxMb: 180 }
};
const CTX = { beleid: { 'spraak.naartekst': true }, huis: {}, lid: {}, toestel: {} };

function goed(id, extra) {
  return Object.assign({ id, plaats: 'toestel', techniek: 'model', beschikbaar: true,
    kwaliteit: { wer: { waarde: 0.1, graad: 'gemeten' } }, last: { startMs: 400, modelMb: 90 }, kosten: 0.01 }, extra);
}

test('1. gratis met een privacyfout verliest altijd van een cent die alles haalt', () => {
  const lek = goed('gratis-maar-extern', { plaats: 'extern', kosten: 0 });
  const net = goed('een-cent', { kosten: 0.01 });
  const u = P.kies(CONTRACT, [lek, net], CTX);
  assert.equal(u.gekozen.id, 'een-cent');
  const weg = u.uitgesloten.find(x => x.id === 'gratis-maar-extern');
  assert.equal(weg.poort, 'privacy');
  assert.match(weg.reden, /niet toe/);
});

test('2. over willekeurige kandidaten wordt een afgevallene nooit gekozen, hoe goedkoop ook', () => {
  let zaad = 7;
  const rnd = () => (zaad = (zaad * 1103515245 + 12345) % 2147483648) / 2147483648;
  const bederf = [
    k => { k.plaats = 'extern'; },
    k => { k.techniek = 'regels'; },
    k => { k.beschikbaar = false; },
    k => { k.kwaliteit = {}; },
    k => { k.kwaliteit.wer = { waarde: 0.9, graad: 'gemeten' }; },
    k => { k.kwaliteit.wer = { waarde: 0.05, graad: 'vermoed' }; },
    k => { k.last.startMs = 9000; },
    k => { k.last.modelMb = 900; }
  ];
  for (let ronde = 0; ronde < 2000; ronde++) {
    const kandidaten = [];
    const n = 2 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const k = goed('k' + i, { kosten: Math.round(rnd() * 100) / 100 });
      k.last = Object.assign({}, k.last); k.kwaliteit = Object.assign({}, k.kwaliteit);
      if (rnd() < 0.6) { bederf[Math.floor(rnd() * bederf.length)](k); k.kosten = 0; k.bedorven = true; }
      kandidaten.push(k);
    }
    const u = P.kies(CONTRACT, kandidaten, CTX);
    const weg = new Set(u.uitgesloten.map(x => x.id));
    for (const k of kandidaten) assert.equal(weg.has(k.id), !!k.bedorven, 'ronde ' + ronde + ': ' + k.id);
    if (u.gekozen) {
      assert.ok(!u.gekozen.bedorven, 'ronde ' + ronde + ': een afgevallene werd gekozen');
      const over = kandidaten.filter(k => !k.bedorven);
      assert.equal(u.gekozen.kosten, Math.min(...over.map(k => k.kosten)), 'de goedkoopste van wie overbleef');
    } else assert.ok(kandidaten.every(k => k.bedorven));
  }
});

test('3. een taak zonder beleid mag niets, ook niet op het toestel', () => {
  const u = P.kies(CONTRACT, [goed('a')], { beleid: {} });
  assert.equal(u.gekozen, null);
  assert.equal(u.uitgesloten[0].poort, 'beleid');
  assert.match(u.reden, /kan hier niet/);
});

test('4. het slot van het lid en van het huis: het strengste wint', () => {
  const server = goed('server', { plaats: 'rtg-omgeving', kosten: 0 });
  const lid = P.kies(CONTRACT, [server], Object.assign({}, CTX, { lid: { alleenToestel: true } }));
  assert.equal(lid.gekozen, null);
  assert.match(lid.uitgesloten[0].reden, /toestel niet verlaat/);
  const extern = goed('extern', { plaats: 'extern' });
  const huis = P.kies(Object.assign({}, CONTRACT, { plaatsen: ['extern'] }), [extern],
    Object.assign({}, CTX, { huis: { externUit: true } }));
  assert.match(huis.uitgesloten[0].reden, /externe verwerking uitgezet/);
});

test('5. kwaliteit die niet gemeten is, is geen kwaliteit', () => {
  const zonder = goed('zonder', { kwaliteit: {} });
  const u = P.kies(CONTRACT, [zonder], CTX);
  assert.equal(u.uitgesloten[0].poort, 'kwaliteit');
  assert.match(u.uitgesloten[0].reden, /niet gemeten/);
  const u2 = P.kies(Object.assign({}, CONTRACT, { kwaliteit: null }), [goed('a')], CTX);
  assert.match(u2.uitgesloten[0].reden, /geen minimumkwaliteit/);
});

test('6. zwaar werk zonder zichtbare batterij valt af; een vertraagd toestel stopt', () => {
  const zwaar = Object.assign({}, CONTRACT, { last: Object.assign({}, CONTRACT.last, { zwaar: true, batterijMin: 0.5 }) });
  assert.match(P.kies(zwaar, [goed('a')], CTX).uitgesloten[0].reden, /batterij is hier niet te zien/);
  const laadt = Object.assign({}, CTX, { toestel: { batterij: { laadt: true } } });
  assert.equal(P.kies(zwaar, [goed('a')], laadt).gekozen.id, 'a');
  const leeg = Object.assign({}, CTX, { toestel: { batterij: { laadt: false, niveau: 0.2 } } });
  assert.match(P.kies(zwaar, [goed('a')], leeg).uitgesloten[0].reden, /te laag/);
  const traag = Object.assign({}, CTX, { toestel: { vertraagd: true } });
  assert.match(P.kies(CONTRACT, [goed('a')], traag).uitgesloten[0].reden, /trager/);
});

test('7. een onbekend bedrag is geen nul, en gelijke bedragen kiezen vast op naam', () => {
  const onbekend = goed('a-onbekend', { kosten: undefined });
  const bekend = goed('z-bekend', { kosten: 0.5 });
  assert.equal(P.kies(CONTRACT, [onbekend, bekend], CTX).gekozen.id, 'z-bekend');
  const x = goed('x', { kosten: 0.1 }), y = goed('y', { kosten: 0.1 });
  assert.equal(P.kies(CONTRACT, [y, x], CTX).gekozen.id, 'x');
  assert.equal(P.kies(CONTRACT, [x, y], CTX).gekozen.id, 'x');
});
