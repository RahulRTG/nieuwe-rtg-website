/* De RTG-signatuurmond (public/shared/mond.js): het puntenveld dat de lippen
   vormt is een pure functie met diepte (z). Hier los getoetst in Node -- de
   WebGL-render en de 2D-terugval leven alleen in de browser.
   Draai los: node --experimental-sqlite --test test/mond.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const Mond = require('../public/shared/mond');

// een deterministische "random" zodat het veld reproduceerbaar is
function nepRandom(zaad) {
  let s = zaad >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('1. puntenVeld levert een flinke wolk met alle velden', () => {
  const v = Mond.puntenVeld(nepRandom(42));
  assert.ok(v.length > 2000, 'duizenden puntjes: ' + v.length);
  for (const p of v.slice(0, 50)) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), 'x,y,z eindig');
    assert.ok(['b', 'o', 'm'].includes(p.lip), 'geldige lip');
    assert.ok(p.maat > 0, 'maat > 0');
    assert.match(p.kleur, /^#[0-9A-F]{6}$/i, 'hex-kleur');
  }
});

test('2. beide lippen en de middellijn komen voor', () => {
  const v = Mond.puntenVeld(nepRandom(7));
  const soorten = new Set(v.map(p => p.lip));
  assert.ok(soorten.has('b') && soorten.has('o') && soorten.has('m'), 'boven, onder en middellijn');
});

test('3. de diepte (z) bolt naar de kijker: lippen positief, middellijn terug', () => {
  const v = Mond.puntenVeld(nepRandom(9));
  const lip = v.filter(p => p.lip !== 'm');
  const mid = v.filter(p => p.lip === 'm');
  assert.ok(lip.some(p => p.z > 0.05), 'lippen bollen naar voren');
  assert.ok(mid.every(p => p.z < 0), 'de middellijn ligt terug');
  // de z blijft in een net, klein bereik (geen gekke uitschieters)
  assert.ok(v.every(p => p.z >= -0.2 && p.z <= 0.4), 'z binnen bereik');
});

test('4. het kleurenpalet is de signatuur (bordeaux, goud, wit)', () => {
  const v = Mond.puntenVeld(nepRandom(3));
  const kleuren = new Set(v.map(p => p.kleur.toUpperCase()));
  for (const k of kleuren) assert.ok(['#9E1C40', '#C9A24B', '#FFFFFF'].includes(k), 'alleen huiskleuren: ' + k);
  assert.ok(kleuren.has('#9E1C40') && kleuren.has('#C9A24B'), 'bordeaux en goud aanwezig');
});

test('5. reproduceerbaar met dezelfde random-bron', () => {
  const a = Mond.puntenVeld(nepRandom(123));
  const b = Mond.puntenVeld(nepRandom(123));
  assert.equal(a.length, b.length);
  assert.deepEqual(a[0], b[0]);
  assert.deepEqual(a[a.length - 1], b[b.length - 1]);
});

/* ---- de spraakmotor: beweegt de mond als een mond, niet als een scharnier ----
   Deze vijf toetsen leggen vast wat "realistisch" hier betekent, zodat een
   latere verfraaiing het niet stilletjes terugdraait naar een sinus. */

test('6. stil is stil: buiten het praten staat alles op nul', () => {
  for (const t of [0, 500, 5000, 123456]) {
    const s = Mond.mondStand(t, 0);
    assert.deepEqual(s, { kaak: 0, breed: 0, duw: 0, scheef: 0 }, 'in rust op t=' + t);
  }
});

test('7. de mond gaat echt open en valt echt dicht (lettergrepen, geen malen)', () => {
  let open = 0, dicht = 0, max = 0, n = 0;
  for (let t = 0; t < 8000; t += 16) {
    const s = Mond.mondStand(t, 8000);
    n++; max = Math.max(max, s.kaak);
    if (s.kaak > 0.5) open++;
    if (s.kaak < 0.02) dicht++;
  }
  assert.ok(max > 0.8, 'de mond gaat ver genoeg open (max ' + max.toFixed(2) + ')');
  assert.ok(dicht / n > 0.1, 'er zit stilte tussen de lettergrepen (' + Math.round(dicht / n * 100) + '%)');
  assert.ok(open / n > 0.1, 'en hij is ook echt vaak open (' + Math.round(open / n * 100) + '%)');
});

test('8. spreiden en tuiten zijn onafhankelijke standen (ie vs oe)', () => {
  let gespreid = false, getuit = false, duwBijTuit = true;
  for (let t = 0; t < 12000; t += 16) {
    const s = Mond.mondStand(t, 12000);
    if (s.breed > 0.3) gespreid = true;
    if (s.breed < -0.3) { getuit = true; if (s.duw <= 0) duwBijTuit = false; }
  }
  assert.ok(gespreid, 'de mond spreidt (breed > 0)');
  assert.ok(getuit, 'de mond tuit (breed < 0)');
  assert.ok(duwBijTuit, 'tuiten duwt de lippen naar voren');
});

test('9. geen herkenbaar patroon: de stand herhaalt zich niet per seconde', () => {
  const a = [], b = [];
  for (let t = 0; t < 1000; t += 20) { a.push(Mond.mondStand(t, 20000).kaak); b.push(Mond.mondStand(t + 1000, 20000).kaak); }
  const verschil = a.reduce((som, v, i) => som + Math.abs(v - b[i]), 0) / a.length;
  assert.ok(verschil > 0.05, 'een seconde later staat de mond anders (verschil ' + verschil.toFixed(3) + ')');
});

test('10. een zin eindigt gesloten, en alle waarden blijven binnen bereik', () => {
  const eind = Mond.mondStand(5000, 5000);
  assert.equal(eind.kaak, 0, 'aan het eind van de zin is de mond dicht');
  for (let t = 0; t < 20000; t += 7) {
    const s = Mond.mondStand(t, 20000);
    assert.ok(Number.isFinite(s.kaak + s.breed + s.duw + s.scheef), 'geen NaN op t=' + t);
    assert.ok(s.kaak >= 0 && s.kaak <= 1.05, 'kaak binnen bereik: ' + s.kaak);
    assert.ok(s.breed >= -1.05 && s.breed <= 1.05, 'breed binnen bereik: ' + s.breed);
    assert.ok(s.duw >= 0 && s.duw <= 1.05, 'duw binnen bereik: ' + s.duw);
    assert.ok(Math.abs(s.scheef) < 0.25, 'de asymmetrie blijft subtiel: ' + s.scheef);
  }
});
