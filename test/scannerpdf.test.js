/* RTG Scanner: de eigen PDF-bouwer (public/apps/scanner/pdfje.js) is puur
   en draait ook in Node -- dus toetsen we hem zonder browser: een geldige
   PDF-structuur, een beeld per pagina, en een kloppende xref-verwijzing.
   Draai los: node --experimental-sqlite --test test/scannerpdf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maak } = require('../public/apps/scanner/pdfje');

// een minimale geldige JPEG (1x1) -- genoeg voor de structuurtoets
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';

test('1. twee pagina\'s worden een geldige PDF met twee beelden', () => {
  const b64 = maak([{ b64: JPEG, w: 100, h: 140 }, { b64: JPEG, w: 100, h: 140 }]);
  const pdf = Buffer.from(b64, 'base64').toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'), 'begint als een PDF');
  assert.ok(pdf.trimEnd().endsWith('%%EOF'), 'eindigt als een PDF');
  assert.match(pdf, /\/Count 2/, 'twee pagina\'s in de boom');
  assert.equal((pdf.match(/\/DCTDecode/g) || []).length, 2, 'elke pagina draagt zijn eigen JPEG');
  assert.match(pdf, /\/MediaBox \[0 0 100 140\]/, 'de pagina heeft de beeldmaat');
});

test('2. de xref wijst echt naar de xref-tabel', () => {
  const pdf = Buffer.from(maak([{ b64: JPEG, w: 50, h: 50 }]), 'base64');
  const tekst = pdf.toString('latin1');
  const start = Number(tekst.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(tekst.slice(start, start + 4), 'xref', 'startxref klopt op de byte');
  // en elk objectnummer in de tabel wijst naar "<n> 0 obj" (regel 0 van de
  // tabel is de vaste vrije-entry, die slaan we over)
  const regels = tekst.slice(start).split('\n').slice(3, 3 + 5);
  regels.forEach((r, i) => {
    const off = Number(r.slice(0, 10));
    assert.equal(tekst.slice(off, off + String(i + 1).length + 6), (i + 1) + ' 0 obj', 'object ' + (i + 1) + ' staat waar de tabel zegt');
  });
});

test('3. zonder pagina\'s een nette fout, geen lege PDF', () => {
  assert.throws(() => maak([]), /pagina/i);
});
