/* PDF: lezen, en redactie die de passage ECHT uit de bytes haalt.

   De maat die TAKEN 5.9 stelde staat in de derde toets: zoeken op de
   geredigeerde tekst in het RESULTAAT vindt hem niet meer -- niet in de
   tekstlaag en niet in de ruwe bytes. Dat tweede is het hele punt: bijna elke
   "redactie" in het wild tekent een zwarte rechthoek over de letters, en dan
   haalt `strings` ze er zo weer uit.

   Verder wordt hier bewezen wat de laag WEIGERT. Een versleutelde PDF, een
   objectstream en een cross-reference stream worden niet half bewerkt maar
   geweigerd met een reden. Een redactielaag die bij twijfel toch iets
   teruggeeft, geeft een document terug waarvan iemand DENKT dat het schoon is.

   De PDF's in dit bestand worden hier ter plekke gebouwd; er is geen
   testbestand nodig en dus ook geen bestand dat kan verouderen.
   Draai los: node --experimental-sqlite --test test/pdf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const zlib = require('zlib');
const { startServer } = require('./helper');
const pdf = require('../server/kern/pdf');
const { redigeer } = require('../server/kern/pdf-redactie');

/* Een minimale, geldige PDF met een tekstlaag. `comprimeer` zet de
   inhoudsstroom in FlateDecode, zodat beide wegen worden afgelegd. */
function maakPdf(regels, comprimeer) {
  const inhoud = 'BT /F1 12 Tf 72 720 Td\n' +
    regels.map((r, i) => '(' + r.replace(/([()\\])/g, '\\$1') + ') Tj 0 -16 Td').join('\n') + '\nET\n';
  const stroom = comprimeer ? zlib.deflateSync(Buffer.from(inhoud, 'latin1')) : Buffer.from(inhoud, 'latin1');
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Length ' + stroom.length + (comprimeer ? ' /Filter /FlateDecode' : '') + ' >>\nstream\n' +
      stroom.toString('latin1') + '\nendstream\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];
  let uit = '%PDF-1.4\n';
  const pos = [];
  for (const o of objs) { pos.push(uit.length); uit += o; }
  const x = uit.length;
  uit += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
    pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(uit, 'latin1');
}

test('een PDF wordt gelezen: versie, paginas en de tekstlaag', () => {
  const doc = maakPdf(['Rapport over de zaak', 'Getuige: Jan de Vries', 'Datum: 4 augustus'], false);
  const d = pdf.lees(doc);
  assert.equal(d.ok, true);
  assert.equal(d.paginas, 1);
  assert.equal(d.heeftTrailer, true);
  assert.equal(d.wortel, '1 0');

  const t = pdf.tekstVan(doc);
  assert.match(t.tekst, /Getuige: Jan de Vries/);
  assert.equal(t.stukken.length, 3, 'drie getekende regels');

  // en hetzelfde met een ingepakte inhoudsstroom
  const gz = pdf.tekstVan(maakPdf(['Vertrouwelijk: Jan de Vries'], true));
  assert.match(gz.tekst, /Jan de Vries/, 'ook door FlateDecode heen');
});

test('wat de laag niet begrijpt, weigert hij met een reden', () => {
  assert.match(pdf.lees(Buffer.from('dit is geen pdf')).waarom, /geen PDF/i);

  const versleuteld = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /Standard >>\nendobj\ntrailer\n<< /Encrypt 9 0 R /Root 1 0 R >>\n', 'latin1');
  const v = pdf.lees(versleuteld);
  assert.equal(v.ok, false);
  assert.match(v.waarom, /versleuteld/i);

  const objstm = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /ObjStm /N 3 >>\nendobj\n', 'latin1');
  assert.match(pdf.lees(objstm).waarom, /objectstream/i);

  const xrefstm = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /XRef /W [1 2 1] >>\nendobj\n', 'latin1');
  assert.match(pdf.lees(xrefstm).waarom, /cross-reference stream/i);

  // en redigeren doet er dan ook niets mee
  const r = redigeer(versleuteld, ['Jan']);
  assert.equal(r.ok, false, 'een document dat we niet begrijpen wordt niet half bewerkt');
});

test('een geredigeerde passage is UIT de bytes, niet afgedekt', () => {
  for (const comprimeer of [false, true]) {
    const doc = maakPdf(['Rapport over de zaak',
      'Getuige: Jan de Vries, wonende te Breda', 'Conclusie: geen strafbaar feit'], comprimeer);
    assert.match(pdf.tekstVan(doc).tekst, /Jan de Vries/, 'vooraf staat de naam erin');

    const uit = redigeer(doc, ['Jan de Vries']);
    assert.equal(uit.ok, true);
    assert.equal(uit.geraakt, 1, 'een treffer, in een tekenopdracht');

    // 1. weg uit de tekstlaag
    const na = pdf.tekstVan(uit.bestand);
    assert.equal(na.ok, true, 'het resultaat is nog steeds een leesbare PDF');
    assert.ok(na.tekst.indexOf('Jan de Vries') < 0, 'de naam staat niet meer in de tekstlaag');
    assert.match(na.tekst, /wonende te Breda/, 'de rest van de zin staat er nog');
    assert.match(na.tekst, /Conclusie: geen strafbaar feit/, 'en de andere regels ook');

    // 2. weg uit de RUWE bytes -- dit is de bewering die ertoe doet
    assert.ok(uit.bestand.toString('latin1').indexOf('Jan de Vries') < 0,
      'en ook niet meer in de ruwe bytes' + (comprimeer ? ' (ingepakt)' : ''));
    if (comprimeer) {
      // ook niet na uitpakken van elke stream
      const alles = pdf.lees(uit.bestand).objecten
        .map(o => { const st = pdf.streamVan(uit.bestand, o); if (!st) return ''; const p = pdf.pakUit(pdf.kopVan(o.lijf), st.bytes); return p.ok ? p.data.toString('latin1') : ''; })
        .join(' ');
      assert.ok(alles.indexOf('Jan de Vries') < 0, 'ook niet in de uitgepakte stromen');
    }

    // 3. het document blijft een document
    const d = pdf.lees(uit.bestand);
    assert.equal(d.paginas, 1, 'de pagina staat er nog');
    assert.equal(d.wortel, '1 0', 'en de catalogus wijst nog naar het juiste object');
    assert.match(uit.bestand.toString('latin1'), /startxref/, 'met een verse cross-reference tabel');
  }
});

test('wat er niet staat, wordt niet stilletjes gemeld als gelukt', () => {
  const doc = maakPdf(['Niets bijzonders hier'], false);
  const uit = redigeer(doc, ['Jan de Vries']);
  assert.equal(uit.ok, true);
  assert.equal(uit.geraakt, 0);
  assert.equal(uit.onveranderd, true, 'het bestand komt onaangeroerd terug');
  assert.match(uit.waarom, /staat niet in de tekstlaag/i);
  assert.equal(uit.bestand.length, doc.length);

  const leeg = redigeer(doc, []);
  assert.equal(leeg.ok, false);
  assert.match(leeg.waarom, /welke tekst/i);
});

test('tekst in een afbeelding blijft staan, en dat wordt gezegd', () => {
  let doc = maakPdf(['Zichtbare tekst: Jan de Vries'], false).toString('latin1');
  const beeld = '6 0 obj\n<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /Length 8 >>\nstream\nBTJanTj\nendstream\nendobj\n';
  doc = doc.replace('xref\n', beeld + 'xref\n');
  const uit = redigeer(Buffer.from(doc, 'latin1'), ['Jan de Vries']);
  assert.equal(uit.ok, true);
  assert.equal(uit.geraakt, 1, 'de zichtbare tekst is weg');
  assert.equal(uit.afbeeldingen, 1);
  assert.match(uit.let, /tekst die daarin staat is beeld en blijft staan/i,
    'en het antwoord zwijgt daar niet over');
});

/* De knop erop: dezelfde machine, nu via de kluis van een lid. De bewering die
   hier het meest toe doet is de EERLIJKHEID eromheen -- het resultaat is een
   nieuw bestand en het origineel staat er nog, en dat wordt gezegd. */
test('via de kluis: een geredigeerde kopie, en het origineel blijft staan met een waarschuwing', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pdfroute-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  try {
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kluislid', email: 'k' + u + '@x.nl', phone: '06' + u.slice(0, 8),
        password: 'geheim12345', geboortedatum: '1980-02-02', tier: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token, 'het lid is aangemeld');
    const api = (pad, body) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

    const doc = maakPdf(['Dossier 2026-114', 'Melder: Jan de Vries', 'Status: afgehandeld'], true);
    const op = (await api('/api/bestanden/upload', { naam: 'dossier.pdf',
      dataUrl: 'data:application/pdf;base64,' + doc.toString('base64') })).body;
    assert.ok(op.id, 'het bestand staat in de kluis: ' + JSON.stringify(op).slice(0, 120));

    const leeg = await api('/api/bestanden/pdf/redigeer', { id: op.id, woorden: [] });
    assert.equal(leeg.status, 400, 'zonder tekst valt er niets te redigeren');

    const uit = (await api('/api/bestanden/pdf/redigeer', { id: op.id, woorden: ['Jan de Vries'] })).body;
    assert.equal(uit.geraakt, 1);
    assert.match(uit.naam, /geredigeerd/, 'het resultaat is een nieuw bestand');
    assert.match(uit.let, /ORIGINEEL staat nog gewoon in uw kluis/,
      'en het antwoord verzwijgt niet dat het origineel er nog is');
    assert.match(uit.let, /haal het dan zelf weg/i, 'met wie die handeling toekomt');

    // de kopie is echt schoon, en het origineel is echt onaangeroerd
    const kopie = (await api('/api/bestanden/haal', { id: uit.bestand.id })).body;
    const kopieBytes = Buffer.from(String(kopie.dataUrl).split(',')[1], 'base64');
    assert.ok(kopieBytes.toString('latin1').indexOf('Jan de Vries') < 0, 'de kopie draagt de naam niet meer');
    assert.ok(pdf.tekstVan(kopieBytes).tekst.indexOf('Jan de Vries') < 0);

    const orig = (await api('/api/bestanden/haal', { id: op.id })).body;
    const origBytes = Buffer.from(String(orig.dataUrl).split(',')[1], 'base64');
    assert.match(pdf.tekstVan(origBytes).tekst, /Jan de Vries/,
      'het origineel staat er nog mét de naam -- precies zoals het antwoord zegt');

    const geenPdf = (await api('/api/bestanden/upload', { naam: 'notitie.txt',
      dataUrl: 'data:text/plain;base64,' + Buffer.from('gewoon tekst').toString('base64') })).body;
    const fout = await api('/api/bestanden/pdf/redigeer', { id: geenPdf.id, woorden: ['x'] });
    assert.equal(fout.status, 422);
    assert.match(fout.body.error, /geen PDF/i);
  } finally {
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
