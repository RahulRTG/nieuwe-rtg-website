/* Wat vóór en na het spraakmodel zeker moet zijn (public/shared/toestel/spraak.js,
   TOESTEL.md par. 11). Het model zelf wordt hier niet gedraaid -- dat staat met
   opzet niet in de repo en wordt gemeten door scripts/spraakproef.js -- maar
   een verkeerd spectrogram of een verkeerde tokenvertaling maakt van een goed
   model een leugenaar, en die twee zijn gewone rekenkunde.
   Draai los: node --test test/toestel-spraak.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/shared/toestel/spraak.js');

function maakWav(monsters, hz, kanalen) {
  const n = monsters.length, b = Buffer.alloc(44 + n * 2 * kanalen);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * kanalen, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(kanalen, 22);
  b.writeUInt32LE(hz, 24); b.writeUInt32LE(hz * 2 * kanalen, 28); b.writeUInt16LE(2 * kanalen, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2 * kanalen, 40);
  monsters.forEach((m, i) => { for (let k = 0; k < kanalen; k++) b.writeInt16LE(Math.round(m * 32767), 44 + (i * kanalen + k) * 2); });
  return new Uint8Array(b);
}
const toon = (hz, sec, rate) => Array.from({ length: Math.round(sec * rate) }, (_, i) => 0.5 * Math.sin(2 * Math.PI * hz * i / rate));

test('1. een WAV wordt gelezen als getallen tussen -1 en 1, stereo wordt gemiddeld', () => {
  const w = S.wav(maakWav([0, 0.5, -0.5, 1], 44100, 2));
  assert.equal(w.hz, 44100);
  assert.equal(w.monsters.length, 4);
  assert.ok(Math.abs(w.monsters[1] - 0.5) < 1e-3 && Math.abs(w.monsters[2] + 0.5) < 1e-3);
  assert.throws(() => S.wav(new Uint8Array(Buffer.from('geen wav, echt niet, maar wel lang genoeg'))), /geen WAV/);
});

test('2. herbemonsteren naar 16 kHz houdt de lengte in tijd gelijk', () => {
  const uit = S.herbemonster(Float32Array.from(toon(440, 1, 48000)), 48000);
  assert.equal(uit.length, 16000);
  assert.equal(S.herbemonster(new Float32Array(5), 16000).length, 5);
});

test('3. de melfilters: 80 driehoeken over 201 bakken, niets negatiefs, en elke band raakt iets', () => {
  const F = S.melFilters();
  assert.equal(F.length, 80 * 201);
  for (let b = 0; b < 80; b++) {
    let som = 0;
    for (let k = 0; k < 201; k++) { assert.ok(F[b * 201 + k] >= 0); som += F[b * 201 + k]; }
    assert.ok(som > 0, 'band ' + b + ' is leeg');
  }
});

test('4. een toon van 1000 Hz licht op in de band van 1000 Hz, en stilte is vlak', () => {
  const mel = S.logMel(Float32Array.from(toon(1000, 1, 16000)));
  assert.equal(mel.length, 80 * 3000);
  // band per frame 50 (midden van de toon): de sterkste band hoort bij 1000 Hz
  let beste = -1, top = -Infinity;
  for (let b = 0; b < 80; b++) if (mel[b * 3000 + 50] > top) { top = mel[b * 3000 + 50]; beste = b; }
  /* Slaney: 1000 Hz is 15 mel, 8000 Hz 45,25 mel; band b heeft zijn top op
     45,25 * (b + 1) / 81 mel, dus band 26 ligt op 15,08 mel -- ongeveer 1006 Hz. */
  assert.equal(beste, 26, 'de sterkste band hoort 26 te zijn (top rond 1006 Hz), niet ' + beste);
  // na de toon (frame 200) is alles de vloer: acht decaden onder de top
  assert.ok(Math.abs(mel[beste * 3000 + 2000] - (top - 2)) < 1e-6, 'de vloer ligt precies 8 log-eenheden (2 na schalen) onder de top');
  /* Het Hann-venster: een toon TUSSEN twee bakken (1020 Hz) lekt zonder venster
     tot ver weg boven de vloer; met Hann zakt de lekkage op band 60 (rond 4 kHz)
     tot onder de vloer. */
  const tussen = S.logMel(Float32Array.from(toon(1020, 1, 16000)));
  let t2 = -Infinity;
  for (let b = 0; b < 80; b++) t2 = Math.max(t2, tussen[b * 3000 + 50]);
  assert.ok(Math.abs(tussen[60 * 3000 + 50] - (t2 - 2)) < 1e-6, 'zonder venster lekt een toon over het hele spectrum');
  const stil = S.logMel(new Float32Array(16000));
  assert.ok(stil.every((x) => x === stil[0]), 'stilte is overal gelijk');
});

test('4b. het spectrogram is dat van de WhisperFeatureExtractor zelf, en niet ons idee ervan', () => {
  /* Een onafhankelijke referentie: test/fixtures/whisper-mel-toon.json komt
     uit transformers (numpy-pad, andere FFT) en niet uit deze code. Op de
     JFK-opname was het grootste verschil 1,2e-7 over alle 240.000 waarden
     (TOESTEL.md par. 11); hier staat een toon, zodat de toets geen opname nodig
     heeft. Vensters 0 en 1 houden de gespiegelde rand vast, 99-102 het einde
     van het geluid, 2999 de vloer. */
  const ref = require('./fixtures/whisper-mel-toon.json');
  const mel = S.logMel(Float32Array.from(toon(1000, 1, 16000)));
  let max = 0;
  ref.waarden.forEach((rij, b) => rij.forEach((w, j) => { max = Math.max(max, Math.abs(mel[b * 3000 + ref.vensters[j]] - w)); }));
  assert.ok(max < 1e-5, 'grootste afwijking van de referentie: ' + max);
});

test('5. tokens worden tekst op byte-niveau, speciale tokens vallen weg', () => {
  const vocab = { 'And': 0, 'Ġso': 1, 'Ġcaf': 2, 'Ã©': 3, '.': 4, '€': 5, '<|endoftext|>': S.EOT, '<|notimestamps|>': 50363 };
  assert.equal(S.tekst([0, 1, 2, 3, 4, S.EOT, 50363], vocab), 'And so café.');
  assert.equal(S.tekst([0, 5, 4], vocab), 'And.', 'een teken buiten de bytetabel wordt geen NUL-byte');
});

test('6. de taal komt uit het tokenbestand, en een onbekende taal is een weigering en geen Engels', () => {
  const sp = { '<|startoftranscript|>': 50258, '<|nl|>': 50271, '<|en|>': 50259, '<|transcribe|>': 50359, '<|notimestamps|>': 50363 };
  assert.deepEqual(S.prompt(sp, 'nl'), [50258, 50271, 50359, 50363]);
  assert.throws(() => S.prompt(sp, 'xx'), /kent de taal xx niet/);
});

test('7. de cel stopt een lus en zegt het, en knipt geen gewone herhaling af', () => {
  /* De ECHTE cel.js, in een vm zonder browser: alleen zijn lusdetector wordt
     aangeroepen. Aanleiding: whisper-tiny schoot op de Nederlandse proefset twee
     keer in een lus tot het plafond (TOESTEL.md par. 13). */
  const vm = require('vm');
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'shared', 'toestel', 'cel.js'), 'utf8');
  const ctx = { parent: { postMessage() {} }, addEventListener() {}, performance: { now: () => 0 } };
  ctx.self = ctx;
  vm.runInNewContext(bron, ctx);
  const h = ctx.RTGCelHerhaalt;
  assert.equal(typeof h, 'function');
  assert.equal(h([5, 7, 8, 7, 8, 7, 8, 7, 8]), 2, 'vier keer hetzelfde paar is een lus van twee');
  assert.equal(h([5, 7, 8, 7, 8, 7, 8]), 0, 'drie keer is nog geen lus');
  assert.equal(h([1, 1, 1]), 0, '"ja ja ja" mag blijven staan');
  assert.equal(h([9, 1, 1, 1, 1]), 1);
  assert.equal(h([1, 2, 3, 4, 5, 6]), 0);
  const blok = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  assert.equal(h([0].concat(blok, blok, blok, blok)), 12, 'ook een lange zin die rondgaat');
});
