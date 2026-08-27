/* DE LETTERS: wat public/fonts/fonts.css moet blijven waarmaken.

   Deze toets bestaat om EEN gemeten fout: Bodoni Moda tekent U+20AC als een
   kale C -- de twee dwarsbalkjes zitten niet in de glief. Op 1,3rem en op 3rem
   staat er hetzelfde, dus het was geen kwestie van formaat. Vier schermen
   zetten bedragen in Bodoni (pay.html het saldo, overheid.html, ov.html,
   commerce.html), en op alle vier stond "C 1.330,00" waar "€ 1.330,00" hoort.

   De reparatie is een @font-face die ALLEEN U+20AC van de familie 'Bodoni Moda'
   uit Inter haalt. Dat werkt op precies twee voorwaarden, en die twee zijn hier
   te toetsen: het blok moet er zijn, en het moet ONDER de andere Bodoni-blokken
   staan -- bij een overlappend bereik wint wat later is verklaard. Iemand die
   fonts.css alfabetiseert of het blok naar boven schuift, breekt vier schermen
   zonder dat er iets zichtbaar misgaat in de code.

   Draai los: node --test test/letters.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/fonts/fonts.css'), 'utf8');

/* Elk @font-face-blok als los stuk tekst, in de volgorde waarin het staat. */
const BLOKKEN = CSS.split('@font-face').slice(1).map((b, i) => ({ nr: i, tekst: b.slice(0, b.indexOf('}') + 1) }));
const familie = (b) => (b.tekst.match(/font-family:\s*'([^']+)'/) || [])[1] || null;
const bereik = (b) => (b.tekst.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
const bron = (b) => (b.tekst.match(/url\(([^)]+)\)/) || [])[1] || '';

test('1. het euroteken van Bodoni komt uit Inter', () => {
  /* Precies dit bereik en niet ruimer: de latin-brok van Bodoni bevat U+20AC
     ook, midden in een lijst van tientallen andere tekens. Een blok dat het
     euroteken meeneemt in een breed bereik zou Bodoni voor die andere tekens
     ook opzijzetten -- dan staat er ineens Inter in een kop. */
  const euro = BLOKKEN.filter(b => familie(b) === 'Bodoni Moda' && /^U\+20AC$/i.test(bereik(b).trim()));
  assert.ok(euro.length >= 1, 'er hoort een @font-face te zijn die alleen U+20AC van Bodoni Moda overneemt');

  for (const b of euro) {
    /* De bron moet een Inter-bestand zijn: hetzelfde bestand dat een van de
       Inter-blokken al noemt. Zo kan hier geen pad in staan dat niet bestaat. */
    const interBronnen = BLOKKEN.filter(x => familie(x) === 'Inter').map(bron);
    assert.ok(interBronnen.includes(bron(b)), 'de glief hoort uit een Inter-bestand te komen, niet uit een nieuw bestand');
  }

  /* Beide letterstanden, want een cursieve kop met een bedrag erin bestaat. */
  const standen = new Set(euro.map(b => (b.tekst.match(/font-style:\s*(\w+)/) || [])[1]));
  assert.ok(standen.has('normal') && standen.has('italic'), 'ook cursief: ' + [...standen].join(','));
});

test('2. het staat ONDER de andere Bodoni-blokken, want later wint', () => {
  const bodoni = BLOKKEN.filter(b => familie(b) === 'Bodoni Moda');
  const euro = bodoni.filter(b => /^U\+20AC$/i.test(bereik(b).trim()));
  const anders = bodoni.filter(b => !/^U\+20AC$/i.test(bereik(b).trim()));
  const eersteEuro = Math.min(...euro.map(b => b.nr));
  const laatsteAndere = Math.max(...anders.map(b => b.nr));
  assert.ok(eersteEuro > laatsteAndere,
    'een euro-blok op regel ' + eersteEuro + ' boven een Bodoni-blok op ' + laatsteAndere + ' doet niets: bij een overlappend bereik wint wat later is verklaard');
});

test('3. het bestand dat de glief levert, bestaat ook echt', () => {
  for (const b of BLOKKEN) {
    const u = bron(b);
    if (!u.startsWith('/fonts/')) continue;
    assert.ok(fs.existsSync(path.join(ROOT, 'public', u)), 'ontbreekt: ' + u);
  }
});

/* Geen enkel lettertype van buiten. De CSP staat het niet toe (font-src 'self'),
   maar een regel die nergens wordt nagekeken is een regel die een keer sneuvelt
   in een bestand dat niemand leest. */
test('4. er wordt niets van een vreemde server gehaald', () => {
  assert.ok(!/url\(\s*['"]?https?:/i.test(CSS), 'een externe font-url hoort hier niet te staan');
  const families = new Set(BLOKKEN.map(familie));
  assert.deepEqual([...families].sort(), ['Bodoni Moda', 'Inter'],
    'twee families, zoals CLAUDE.md zegt -- geen EB Garamond en niets nieuws zonder overleg');
});
