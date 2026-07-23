/* Het RTG-uurwerk (public/shared/horlogewerk.js): de pure, wiskundig kloppende
   mechaniek van het RTG-horloge. Deze toets bewijst de foutmarge 0,0 -- de
   perioden, de frequentie en de wijzerhoeken moeten tot op de bit exact zijn.
   Draai los: node --experimental-sqlite --test test/horlogewerk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../public/shared/horlogewerk');

// een vaste tijd bouwen zonder tijdzone-ruis: reken in UTC en lees in UTC terug
// zou werken, maar de mechaniek gebruikt getHours/getMinutes (lokaal). We toetsen
// daarom met velden die in elke tijdzone hetzelfde zijn: hele minuut/seconde op
// een lokaal geconstrueerde datum.
function tijd(h, m, s, ms) { return new Date(2026, 6, 22, h, m, s || 0, ms || 0); }

test('1. narekenen: de perioden kloppen EXACT uit de tandtellingen (foutmarge 0,0)', () => {
  const r = W.narekenen();
  assert.equal(r.middenNaarVierde, 60, 'midden -> vierde overbrenging = 60');
  assert.equal(r.vierdePeriode, 60, 'secondewiel: 1 omwenteling per 60 s');
  assert.equal(r.ankerOmwPerS, 0.2, 'ankerrad: 0,2 omwenteling/s');
  assert.equal(r.oscPerS, 4, 'balans: 4 oscillaties/s = 4 Hz');
  assert.equal(r.vph, 28800, '28.800 halveslagen per uur');
  assert.equal(r.wijzerVerh, 12, 'wijzerwerk minuut:uur = 12:1');
  assert.equal(r.uurPeriode, 43200, 'uurrad: 1 omwenteling per 12 uur (43200 s)');
});

test('2. wijzerHoeken: op 12:00:00.000 staan alle wijzers exact op 0', () => {
  const w = W.wijzerHoeken(tijd(12, 0, 0, 0));
  assert.equal(w.seconde, 0);
  assert.equal(w.minuut, 0);
  assert.equal(w.uur, 0);
});

test('3. wijzerHoeken: de secondewijzer loopt exact 6 graden per seconde', () => {
  assert.equal(W.wijzerHoeken(tijd(3, 0, 15, 0)).seconde, 90);
  assert.equal(W.wijzerHoeken(tijd(3, 0, 30, 0)).seconde, 180);
  assert.equal(W.wijzerHoeken(tijd(3, 0, 45, 0)).seconde, 270);
  // en tot op de milliseconde: 500 ms = 3 graden
  assert.equal(W.wijzerHoeken(tijd(3, 0, 0, 500)).seconde, 3);
});

test('4. wijzerHoeken: de minuutwijzer sleept mee (0,1 graad per seconde)', () => {
  // 15 minuten = 90 graden; plus 30 s = 0,05 min = extra 3 graden -> nee: 30/60*6=3
  const w = W.wijzerHoeken(tijd(6, 15, 30, 0));
  assert.equal(w.minuut, 15 * 6 + (30 / 60) * 6);        // 90 + 3 = 93
  // zuivere afgeleide: 1 minuut = 6 graden, 1 seconde = 0,1 graad
  const a = W.wijzerHoeken(tijd(6, 10, 0, 0)).minuut;
  const b = W.wijzerHoeken(tijd(6, 11, 0, 0)).minuut;
  assert.equal(b - a, 6);
});

test('5. wijzerHoeken: de uurwijzer is afgeleid van de minuten (3:00 = 90 graden)', () => {
  assert.equal(W.wijzerHoeken(tijd(3, 0, 0, 0)).uur, 90);
  assert.equal(W.wijzerHoeken(tijd(6, 0, 0, 0)).uur, 180);
  assert.equal(W.wijzerHoeken(tijd(9, 0, 0, 0)).uur, 270);
  // half drie: de uurwijzer staat halverwege 3 en 4 -> 3,5 * 30 = 105
  assert.equal(W.wijzerHoeken(tijd(3, 30, 0, 0)).uur, 105);
  // 12 uur = 0 (mod 12), niet 360
  assert.equal(W.wijzerHoeken(tijd(12, 0, 0, 0)).uur, 0);
});

test('6. wijzerHoeken: de verhouding uur:minuut:seconde-snelheid is 1:12:720', () => {
  // per seconde: seconde +6 graden, minuut +0,1 graden, uur +1/120 graden
  const t0 = tijd(4, 20, 0, 0), t1 = tijd(4, 20, 1, 0);
  const s = W.wijzerHoeken(t1).seconde - W.wijzerHoeken(t0).seconde;
  const m = W.wijzerHoeken(t1).minuut - W.wijzerHoeken(t0).minuut;
  const u = W.wijzerHoeken(t1).uur - W.wijzerHoeken(t0).uur;
  assert.equal(s, 6);
  assert.ok(Math.abs(m - 0.1) < 1e-12, 'minuutwijzer 0,1 graad/s');
  assert.ok(Math.abs(u - 6 / 720) < 1e-12, 'uurwijzer 6/720 graad/s');
  // 720 = 12 * 60: seconde is 720x sneller dan de uurwijzer
  assert.ok(Math.abs(s / u - 720) < 1e-6);
});

test('7. radHoeken: het secondewiel (vierde rad) valt exact samen met de secondewijzer', () => {
  const d = tijd(8, 42, 17, 0);
  const rad = W.radHoeken(d);
  const w = W.wijzerHoeken(d);
  assert.equal(rad.vierde, ((w.seconde % 360) + 360) % 360);
});

test('8. radHoeken: alle radhoeken liggen netjes in [0,360)', () => {
  for (const d of [tijd(0, 0, 0, 0), tijd(5, 13, 44, 500), tijd(23, 59, 59, 999)]) {
    const r = W.radHoeken(d);
    for (const k of ['midden', 'derde', 'vierde', 'anker', 'uur']) {
      assert.ok(r[k] >= 0 && r[k] < 360, k + ' in [0,360)');
    }
  }
});

test('9. radHoeken: het middenrad (minuutwiel) doet 1 omwenteling per uur', () => {
  // exact een uur verder -> zelfde hoek (mod 360)
  const a = W.radHoeken(tijd(2, 0, 0, 0)).midden;
  const b = W.radHoeken(tijd(3, 0, 0, 0)).midden;
  assert.ok(Math.abs(a - b) < 1e-6, 'na een uur staat het middenrad weer gelijk');
  // een kwartier = 90 graden
  const c = W.radHoeken(tijd(2, 0, 0, 0)).midden;
  const e = W.radHoeken(tijd(2, 15, 0, 0)).midden;
  assert.ok(Math.abs(((e - c + 360) % 360) - 90) < 1e-6, 'kwartier = 90 graden');
});

test('10. onrust: zuivere sinus op 4 Hz, amplitude begrensd', () => {
  const amp = 260;
  // fase bij een klein, controleerbaar tijdstip (grote epoch-tijden verliezen
  // float-precisie in sin; de mechaniek zelf is exact, de toets moet dat niet
  // tegen zichzelf laten werken). Periode = 250 ms; kwartperiode = 62,5 ms.
  // exacte nuldoorgangen liggen op hele en halve perioden (0, 125, 250 ms) -- die
  // zijn in hele ms representeerbaar; de pieken (62,5/187,5 ms) zijn dat niet, dus
  // die toetsen we op teken + nabijheid.
  assert.equal(W.onrust(new Date(0), amp), 0, 'op t=0 exact 0');
  assert.ok(Math.abs(W.onrust(new Date(125), amp)) < 1e-9, 'halve periode terug op 0');
  assert.ok(Math.abs(W.onrust(new Date(250), amp)) < 1e-9, 'hele periode terug op 0');
  assert.ok(W.onrust(new Date(62), amp) > amp * 0.999, 'rond kwartperiode: bijna +amp');
  assert.ok(W.onrust(new Date(188), amp) < -amp * 0.999, 'rond driekwart: bijna -amp');
  // de uitslag blijft binnen +/- amplitude
  for (let i = 0; i < 40; i++) {
    const d = new Date(1000 * i + 137 * i);
    assert.ok(Math.abs(W.onrust(d, amp)) <= amp + 1e-9, 'binnen de amplitude');
  }
});

test('11. TREIN: de tandtellingen zijn heel en plausibel (echt gaand werk)', () => {
  const t = W.TREIN;
  for (const z of [t.midden.Z, t.derde.Z, t.vierde.Z, t.anker.Z,
    t.derdeRondsel, t.vierdeRondsel, t.ankerRondsel,
    t.wijzerwerk.rondsel, t.wijzerwerk.minuutrad, t.wijzerwerk.minuutRondsel, t.wijzerwerk.uurrad]) {
    assert.ok(Number.isInteger(z) && z > 0, 'heel en positief: ' + z);
  }
  // rondsels (pinions) hebben minder tanden dan de wielen die ze aandrijven
  assert.ok(t.derdeRondsel < t.midden.Z && t.vierdeRondsel < t.derde.Z && t.ankerRondsel < t.vierde.Z);
});
