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
const { voegSamen, splits } = require('../server/kern/pdf-bouw');

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

/* Een PDF met meer pagina's, elk met een eigen inhoudsstroom en eigen font.
   Dat laatste is niet overdreven: juist doordat elke pagina zijn EIGEN
   objecten heeft, kan een splitsing bewijzen dat wat niet meegaat, ook echt
   niet meegaat. */
function maakPdfN(paginas) {
  const objs = []; const kids = []; let nr = 3;
  for (const regels of paginas) {
    const inhoud = 'BT /F1 12 Tf 72 720 Td\n' +
      regels.map(r => '(' + r.replace(/([()\\])/g, '\\$1') + ') Tj 0 -16 Td').join('\n') + '\nET\n';
    const paginaNr = nr++, stroomNr = nr++, fontNr = nr++;
    kids.push(paginaNr);
    objs.push([paginaNr, paginaNr + ' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ' +
      stroomNr + ' 0 R /Resources << /Font << /F1 ' + fontNr + ' 0 R >> >> >>\nendobj\n']);
    objs.push([stroomNr, stroomNr + ' 0 obj\n<< /Length ' + inhoud.length + ' >>\nstream\n' + inhoud + '\nendstream\nendobj\n']);
    objs.push([fontNr, fontNr + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n']);
  }
  const alles = [[1, '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'],
    [2, '2 0 obj\n<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>\nendobj\n']]
    .concat(objs).sort((a, b) => a[0] - b[0]);
  let uit = '%PDF-1.4\n'; const pos = new Map();
  for (const [n, t] of alles) { pos.set(n, uit.length); uit += t; }
  const x = uit.length; const hoog = alles[alles.length - 1][0];
  let tab = 'xref\n0 ' + (hoog + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= hoog; i++) tab += String(pos.get(i) || 0).padStart(10, '0') + ' 00000 n \n';
  uit += tab + 'trailer\n<< /Size ' + (hoog + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
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

  /* Objectstreams en cross-reference streams stonden hier tot 5 augustus ook
     bij, met als reden dat een halve ontleding erger is dan een weigering. Die
     reden klopt nog steeds -- maar de ontleding is nu heel (kern/pdf-xref.js),
     dus horen ze hier niet meer thuis. Wat er WEL nog staat: een moderne
     kruisverwijzing waar geen enkel object uitkomt, is nog steeds een fout. */
  const leegModern = Buffer.from('%PDF-1.5\n1 0 obj\n<< /Type /XRef /W [1 2 1] >>\nendobj\n', 'latin1');
  const lm = pdf.lees(leegModern);
  assert.equal(lm.ok, true, 'een xref-stream alleen is geen reden meer om te weigeren');
  assert.equal(lm.modern, true);

  // en redigeren doet er dan ook niets mee
  const r = redigeer(versleuteld, ['Jan']);
  assert.equal(r.ok, false, 'een document dat we niet begrijpen wordt niet half bewerkt');
});

/* Een PDF 1.5 met een OBJECTSTREAM en een CROSS-REFERENCE STREAM, met de hand
   gebouwd. Dat is meer werk dan een klassiek bestand, en dat is precies waarom
   het moet: zonder zo'n bestand is "wij lezen moderne PDF's" een bewering
   zonder dekking, en de vorige versie van deze toets bewees alleen dat ze
   GEWEIGERD werden.

   De opbouw volgt de regel die het formaat zelf stelt: een stream kan NIET in
   een objectstream zitten (die draagt alleen woordenboeken), dus de catalogus,
   de paginaboom en de pagina gaan erin, en de inhoudsstroom blijft los. */
function maakPdf15(regels) {
  const zlib = require('node:zlib');
  const stukken = [];
  let uit = '%PDF-1.5\n';
  const plek = {};

  // 4: de inhoudsstroom, los want een stream mag niet in een objectstream
  const inhoud = 'BT /F1 12 Tf 72 720 Td ' + regels.map(r => '(' + r + ') Tj T*').join(' ') + ' ET';
  plek[4] = uit.length;
  uit += '4 0 obj\n<< /Length ' + inhoud.length + ' >>\nstream\n' + inhoud + '\nendstream\nendobj\n';

  // 1, 2, 3 gaan samen in objectstream 5
  const leden = [
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /MediaBox [0 0 595 842] >>']
  ];
  let lijf = '', koppen = [];
  for (const [nr, tekst] of leden) { koppen.push(nr + ' ' + lijf.length); lijf += tekst + ' '; }
  const voor = koppen.join(' ') + '\n';
  const objstm = zlib.deflateSync(Buffer.from(voor + lijf, 'latin1'));
  plek[5] = uit.length;
  uit += '5 0 obj\n<< /Type /ObjStm /N ' + leden.length + ' /First ' + voor.length +
    ' /Length ' + objstm.length + ' /Filter /FlateDecode >>\nstream\n' + objstm.toString('latin1') + '\nendstream\nendobj\n';

  // 6: de cross-reference stream. /W [1 4 2]: soort, plek-of-streamnummer, generatie-of-index
  const rijen = [];
  const rij = (soort, a, b) => {
    const buf = Buffer.alloc(7);
    buf[0] = soort; buf.writeUInt32BE(a, 1); buf.writeUInt16BE(b, 5);
    rijen.push(buf);
  };
  rij(0, 0, 65535);                 // object 0, altijd vrij
  for (const nr of [1, 2, 3]) rij(2, 5, [1, 2, 3].indexOf(nr));   // type 2: in objectstream 5
  rij(1, plek[4], 0);
  rij(1, plek[5], 0);
  const xrefPlek = uit.length;
  rij(1, xrefPlek, 0);
  const tabel = zlib.deflateSync(Buffer.concat(rijen));
  uit += '6 0 obj\n<< /Type /XRef /Size 7 /W [1 4 2] /Root 1 0 R /Length ' + tabel.length +
    ' /Filter /FlateDecode >>\nstream\n' + tabel.toString('latin1') + '\nendstream\nendobj\n';
  uit += 'startxref\n' + xrefPlek + '\n%%EOF\n';
  return Buffer.from(uit, 'latin1');
}

test('een PDF 1.5 met objectstream en xref-stream wordt GELEZEN, niet geweigerd', () => {
  const doc = maakPdf15(['Factuur 2026-08', 'Bedrag: 1250 euro']);
  const d = pdf.lees(doc);
  assert.equal(d.ok, true, 'gelezen: ' + d.waarom);
  assert.equal(d.modern, true, 'hij wordt als modern herkend');
  assert.equal(d.paginas, 1, 'de pagina zit IN de objectstream en wordt toch geteld');
  assert.equal(d.wortel, '1 0', 'de catalogus is gevonden via de xref-stream');
  assert.ok(!d.fouten, 'geen halve ontleding: ' + JSON.stringify(d.fouten));

  const t = pdf.tekstVan(doc);
  assert.ok(t.ok);
  assert.match(t.tekst, /Factuur 2026-08/);
  assert.match(t.tekst, /Bedrag: 1250 euro/);

  /* De zwaarste: perPagina loopt de OBJECTGRAAF af (catalogus -> /Pages ->
     /Kids -> /Contents). Die weg gaat hier dwars door de objectstream heen, dus
     als het uitpakken half is gelukt, valt hij hier om en niet bij tekstVan. */
  const p = pdf.perPagina(doc);
  assert.equal(p.ok, true, p.waarom);
  assert.equal(p.paginas.length, 1);
  assert.match(p.paginas[0].tekst, /Factuur 2026-08/);

  /* En de GRENZEN van de uitgepakte objecten kloppen. Zonder deze assertie
     overleeft de laag een verkeerde plek-berekening gewoon: de regexen die de
     graaf aflopen (/Pages, /Contents) vinden hun match ook als er per ongeluk
     de halve stream omheen staat. Een mutatie op /First beet daardoor niet --
     dit is wat hem laat bijten. */
  const cat = d.objecten.find(o => o.nummer === 1);
  assert.ok(cat, 'de catalogus komt uit de objectstream');
  assert.match(cat.lijf.trim(), /^<< \/Type \/Catalog/, 'zijn lijf begint bij zijn eigen woordenboek: ' + JSON.stringify(cat.lijf.slice(0, 40)));
  assert.ok(!/\/Type \/Pages/.test(cat.lijf), 'en loopt niet door in het volgende object');
  const pag = d.objecten.find(o => o.nummer === 3);
  assert.match(pag.lijf.trim(), /^<< \/Type \/Page /);
});

test('een notitie wordt ACHTER het bestand geschreven; het origineel blijft byte voor byte staan', () => {
  const doc = maakPdf(['Contract tussen partijen', 'Artikel 1: de looptijd is een jaar']);
  const uit = require('../server/kern/pdf-notitie')().annoteer(doc,
    { pagina: 1, tekst: 'Klopt de looptijd wel?', wie: 'Vera', rechthoek: [100, 700, 130, 720] });
  assert.equal(uit.ok, true, uit.waarom);

  /* DE ZWAARSTE BEWERING VAN DEZE LAAG. Wie een opmerking op een contract zet,
     wil dat de rest onaangeraakt blijft -- de handtekening van een ander, de
     opmaak, de metadata. Dat is hier letterlijk te controleren. */
  assert.ok(uit.bestand.length > doc.length, 'er is iets bijgekomen');
  assert.ok(uit.bestand.subarray(0, doc.length).equals(doc),
    'de eerste ' + doc.length + ' bytes zijn nog exact het origineel');

  // en de update is leesbaar: de notitie komt er weer uit
  const na = require('../server/kern/pdf-notitie')().notities(uit.bestand);
  assert.equal(na.aantal, 1);
  assert.equal(na.notities[0].tekst, 'Klopt de looptijd wel?');
  assert.equal(na.notities[0].wie, 'Vera');

  // het document zelf blijft leesbaar, met dezelfde tekst en dezelfde pagina
  const d = pdf.lees(uit.bestand);
  assert.equal(d.ok, true, d.waarom);
  assert.equal(d.paginas, 1);
  assert.match(pdf.tekstVan(uit.bestand).tekst, /Artikel 1: de looptijd/);
  const per = pdf.perPagina(uit.bestand);
  assert.equal(per.ok, true, per.waarom);
  assert.match(per.paginas[0].tekst, /Contract tussen partijen/);

  // de tweede kruisverwijzing wijst met /Prev naar de eerste
  const staart = uit.bestand.toString('latin1').slice(doc.length);
  assert.match(staart, /\/Prev \d+/, 'de nieuwe tabel verwijst terug: ' + staart.slice(-200));
  assert.match(staart, /\/Type \/Annot/);
});

test('een tweede notitie gooit de eerste niet weg', () => {
  const laag = require('../server/kern/pdf-notitie')();
  const doc = maakPdf(['Een blad met ruimte voor twee opmerkingen']);
  const een = laag.annoteer(doc, { pagina: 1, tekst: 'eerste opmerking', wie: 'A' });
  const twee = laag.annoteer(een.bestand, { pagina: 1, tekst: 'tweede opmerking', wie: 'B' });
  assert.equal(twee.ok, true, twee.waarom);
  const na = laag.notities(twee.bestand);
  assert.equal(na.aantal, 2, 'beide notities staan er: ' + JSON.stringify(na.notities));
  assert.deepEqual(na.notities.map(n => n.wie).sort(), ['A', 'B']);
  assert.ok(twee.bestand.subarray(0, een.bestand.length).equals(een.bestand),
    'ook de tweede laag laat alles ervoor met rust');
});

test('een notitie op een pagina die niet bestaat, wordt geweigerd met de reden', () => {
  const laag = require('../server/kern/pdf-notitie')();
  const doc = maakPdf(['Een pagina']);
  const weg = laag.annoteer(doc, { pagina: 9, tekst: 'hallo' });
  assert.equal(weg.ok, false);
  assert.match(weg.waarom, /1 pagina\(s\); pagina 9 bestaat niet/);
  const leeg = laag.annoteer(doc, { pagina: 1, tekst: '   ' });
  assert.equal(leeg.ok, false);
  assert.match(leeg.waarom, /wat moet er in de notitie staan/);
  const geen = laag.annoteer(Buffer.from('geen pdf'), { pagina: 1, tekst: 'x' });
  assert.equal(geen.ok, false);
  assert.match(geen.waarom, /geen PDF/i);
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

    /* samenvoegen en splitsen via dezelfde kluis */
    const p1 = (await api('/api/bestanden/upload', { naam: 'deel-een.pdf',
      dataUrl: 'data:application/pdf;base64,' + maakPdfN([['Deel een']]).toString('base64') })).body;
    const p2 = (await api('/api/bestanden/upload', { naam: 'deel-twee.pdf',
      dataUrl: 'data:application/pdf;base64,' + maakPdfN([['Deel twee'], ['Deel drie']]).toString('base64') })).body;

    const alleen = await api('/api/bestanden/pdf/samenvoegen', { ids: [p1.id] });
    assert.equal(alleen.status, 400, 'samenvoegen vraagt er minstens twee');

    const samen = (await api('/api/bestanden/pdf/samenvoegen', { ids: [p1.id, p2.id] })).body;
    assert.equal(samen.paginas, 3);
    assert.match(samen.naam, /Samengevoegd/);
    const samenBytes = Buffer.from(String((await api('/api/bestanden/haal', { id: samen.bestand.id })).body.dataUrl).split(',')[1], 'base64');
    assert.deepEqual(pdf.perPagina(samenBytes).paginas.map(x => x.tekst), ['Deel een', 'Deel twee', 'Deel drie'],
      'de paginas staan in volgorde en dragen elk hun eigen inhoud');

    const gesplitst = (await api('/api/bestanden/pdf/splitsen', { id: p2.id, van: 2, tot: 2 })).body;
    assert.equal(gesplitst.paginas, 1);
    assert.match(gesplitst.naam, /pagina 2/);
    assert.match(gesplitst.let, /bronbestand blijft staan/i);
    const deelBytes = Buffer.from(String((await api('/api/bestanden/haal', { id: gesplitst.bestand.id })).body.dataUrl).split(',')[1], 'base64');
    assert.deepEqual(pdf.perPagina(deelBytes).paginas.map(x => x.tekst), ['Deel drie']);
    assert.ok(deelBytes.toString('latin1').indexOf('Deel twee') < 0, 'de niet-gekozen pagina reist niet mee');

    const buiten = await api('/api/bestanden/pdf/splitsen', { id: p1.id, van: 5, tot: 5 });
    assert.equal(buiten.status, 422);
    assert.match(buiten.body.error, /pagina 5 bestaat niet/i);

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

test('samenvoegen: de paginas tellen op en elk object houdt zijn eigen inhoud', () => {
  const a = maakPdfN([['Offerte Alpha', 'Bedrag: 12.000']]);
  const b = maakPdfN([['Bijlage Beta een'], ['Bijlage Beta twee']]);
  assert.equal(pdf.lees(a).paginas, 1);
  assert.equal(pdf.lees(b).paginas, 2);

  const uit = voegSamen([a, b]);
  assert.equal(uit.ok, true);
  assert.equal(uit.paginas, 3, 'een plus twee is drie');
  assert.equal(uit.documenten, 2);

  const d = pdf.lees(uit.bestand);
  assert.equal(d.ok, true, 'het resultaat is een leesbare PDF');
  assert.equal(d.paginas, 3, 'en de paginaboom klopt met wat erin zit');
  assert.equal(d.wortel, '1 0', 'met een verse catalogus');

  /* NIET alleen "staat de tekst erin" -- dat blijft namelijk waar als de
     verwijzingen NIET zijn hernummerd; tekstVan veegt gewoon alle stromen op.
     Deze toets liep daar in eerste opzet zelf in: de mutatie die het
     hernummeren uitzette, beet niet. Daarom loopt hij nu de OBJECTGRAAF af:
     per pagina, via /Contents, in de volgorde van de paginaboom. */
  const perPagina = pdf.perPagina(uit.bestand);
  assert.equal(perPagina.ok, true, 'de paginaboom is te volgen vanaf de catalogus');
  assert.equal(perPagina.paginas.length, 3);
  assert.ok(perPagina.paginas.every(p => p.ok), 'elke pagina wijst naar bestaande inhoud: ' +
    JSON.stringify(perPagina.paginas.filter(p => !p.ok)));
  assert.match(perPagina.paginas[0].tekst, /Offerte Alpha/, 'pagina 1 draagt de inhoud van het eerste document');
  assert.match(perPagina.paginas[0].tekst, /Bedrag: 12\.000/);
  assert.match(perPagina.paginas[1].tekst, /Bijlage Beta een/, 'pagina 2 die van het tweede');
  assert.match(perPagina.paginas[2].tekst, /Bijlage Beta twee/, 'en pagina 3 de laatste');
  assert.ok(perPagina.paginas[1].tekst.indexOf('Offerte Alpha') < 0,
    'en geen enkele pagina wijst naar de inhoud van een andere');
  // elke pagina wijst naar de nieuwe boom, niet naar die van zijn oude document
  const rauw = uit.bestand.toString('latin1');
  const ouders = rauw.match(/\/Parent\s+(\d+)\s+0\s+R/g) || [];
  assert.equal(ouders.length, 3, "drie paginas met een ouder");
  assert.ok(ouders.every(o => /\/Parent\s+2\s+0\s+R/.test(o)), 'en alle drie naar de nieuwe paginaboom');
});

test('samenvoegen weigert wat het niet kan of niet mag', () => {
  const a = maakPdfN([['Een']]);
  assert.match(voegSamen([a]).waarom, /minstens twee/i);
  assert.match(voegSamen([]).waarom, /minstens twee/i);

  const versleuteld = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< /Encrypt 9 0 R >>\n', 'latin1');
  const r = voegSamen([a, versleuteld]);
  assert.equal(r.ok, false);
  assert.match(r.waarom, /document 2/, 'de weigering noemt WELK document het is');
  assert.match(r.waarom, /versleuteld/i, 'met de reden van de leeslaag erbij');
});

test('splitsen neemt alleen mee wat bereikbaar is: de rest reist niet stiekem mee', () => {
  const doc = maakPdfN([['Geheim van pagina een'], ['Openbaar pagina twee'], ['Openbaar pagina drie']]);
  assert.match(pdf.tekstVan(doc).tekst, /Geheim van pagina een/, 'vooraf staat alles erin');

  const uit = splits(doc, 2, 3);
  assert.equal(uit.ok, true);
  assert.equal(uit.paginas, 2);
  assert.equal(uit.uitTotaal, 3);

  const d = pdf.lees(uit.bestand);
  assert.equal(d.paginas, 2, "twee paginas in het resultaat");
  const per = pdf.perPagina(uit.bestand);
  assert.equal(per.ok, true);
  assert.deepEqual(per.paginas.map(p => p.tekst), ['Openbaar pagina twee', 'Openbaar pagina drie'],
    'de twee gekozen paginas dragen hun eigen inhoud, in volgorde');
  const t = pdf.tekstVan(uit.bestand).tekst;
  assert.ok(t.indexOf('Geheim van pagina een') < 0, 'de niet-gekozen pagina staat niet in de tekstlaag');

  // DE BEWERING DIE ERTOE DOET: ook niet in de ruwe bytes
  assert.ok(uit.bestand.toString('latin1').indexOf('Geheim van pagina een') < 0,
    'en ook niet in de ruwe bytes -- alles meenemen zou hem gewoon laten meereizen');
  assert.match(uit.let, /precies verkeerd/i);
});

test('splitsen telt zoals een mens telt, en weigert wat niet bestaat', () => {
  const doc = maakPdfN([['Een'], ['Twee'], ['Drie']]);
  const een = splits(doc, 1, 1);
  assert.equal(een.paginas, 1);
  assert.match(pdf.tekstVan(een.bestand).tekst, /Een/, "pagina 1 is de eerste, niet de nulde");
  assert.ok(pdf.tekstVan(een.bestand).tekst.indexOf('Twee') < 0);

  const alles = splits(doc, 1, 99);
  assert.equal(alles.paginas, 3, 'een te hoge bovengrens knipt af op wat er is');
  assert.equal(alles.tot, 3);

  assert.match(splits(doc, 3, 1).waarom, /ligt na de laatste/i);
  assert.match(splits(doc, 9, 9).waarom, /pagina 9 bestaat niet/i);

  const versleuteld = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< /Encrypt 9 0 R >>\n', 'latin1');
  assert.equal(splits(versleuteld, 1, 1).ok, false);
});
