/* RTG Office, de zip-lezer en de XLSX-lezer langs al hun zijpaden: elke
   weigering van een vreemd bestand (afgekapt, gelogen lengte, onbekende
   inpakmethode, te groot) en elke celsoort en trouwlijstregel van de
   XLSX-lezer krijgt hier een eigen uitspraak.

   Draai los: node --test test/office-zip-xlsx-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { pak, lees, GRENS } = require('../server/kern/office/zip');
const { leesXlsx, MAX_RIJEN, MAX_KOLOMMEN } = require('../server/kern/office/xlsx-lees');
const { kolNaam } = require('../server/kern/office/formuletaal');

// de positie van de centrale map in een zip die pak() maakte
const centraal = z => z.readUInt32LE(z.length - 22 + 16);
const gooitZip = (fn, patroon) => assert.throws(fn, e => e.zipFout === true && patroon.test(e.message));

test('zip: pak neemt Buffer en tekst aan en lees geeft precies dat terug', () => {
  const z = pak({ 'a.txt': 'hallo', 'b.bin': Buffer.from([1, 2, 3]), 'c.txt': 42 });
  const uit = lees(z);
  assert.equal(uit['a.txt'].toString(), 'hallo');
  assert.deepEqual([...uit['b.bin']], [1, 2, 3]);
  assert.equal(uit['c.txt'].toString(), '42');
  assert.deepEqual(pak({ x: 'y' }), pak({ x: 'y' }), 'byte voor byte hetzelfde');
  assert.equal(GRENS.aantal, 400);
});

test('zip: geen buffer, te kort of zonder eindmarkering is geen zip', () => {
  gooitZip(() => lees('tekst'), /geen zip/);
  gooitZip(() => lees(Buffer.alloc(10)), /geen zip/);
  gooitZip(() => lees(Buffer.alloc(100)), /geen zip/);
});

test('zip: meer onderdelen dan de grens wordt geweigerd', () => {
  const z = pak({ a: '1', b: '2' });
  gooitZip(() => lees(z, { aantal: 1 }), /te veel onderdelen/);
});

test('zip: een kapotte inhoudsopgave of lokale kop wordt geweigerd', () => {
  const z = pak({ a: '1' });
  const k1 = Buffer.from(z); k1.writeUInt32LE(0, centraal(z));
  gooitZip(() => lees(k1), /inhoudsopgave/);
  const k2 = Buffer.from(z); k2.writeUInt32LE(0, 0);
  gooitZip(() => lees(k2), /onderdeel van dit bestand is beschadigd/);
});

test('zip: een gelogen ingepakte lengte geeft "afgekapt"', () => {
  const z = Buffer.from(pak({ a: 'abc' }));
  z.writeUInt32LE(1e6, centraal(z) + 20);
  gooitZip(() => lees(z), /afgekapt/);
});

test('zip: te groot per onderdeel en in totaal wordt geweigerd', () => {
  gooitZip(() => lees(pak({ a: 'abcdef' }), { perBestand: 3 }), /te groot/);
  gooitZip(() => lees(pak({ a: 'abcd', b: 'efgh' }), { totaal: 6 }), /uitgepakt te groot/);
  // een gelogen kleine uitgepakte lengte: zlib zelf houdt het plafond
  const z = Buffer.from(pak({ a: 'x'.repeat(5000) }));
  z.writeUInt32LE(1, centraal(z) + 24);
  gooitZip(() => lees(z, { perBestand: 100 }), /niet worden uitgepakt/);
});

test('zip: methode 0 wordt gelezen zoals opgeslagen, een onbekende methode niet', () => {
  const z = Buffer.from(pak({ a: 'hallo' }));
  z.writeUInt16LE(0, centraal(z) + 10);
  assert.deepEqual(lees(z).a, zlib.deflateRawSync(Buffer.from('hallo')), 'opgeslagen bytes komen ongewijzigd terug');
  z.writeUInt16LE(12, centraal(z) + 10);
  gooitZip(() => lees(z), /inpakmethode/);
});

test('zip: een map-onderdeel (naam eindigt op /) wordt overgeslagen', () => {
  const uit = lees(pak({ 'map/': '', 'map/a': 'b' }));
  assert.deepEqual(Object.keys(uit), ['map/a']);
});

// ---------------------------------------------------------------- XLSX

const WB = (bladen) => '<workbook><sheets>' + bladen + '</sheets></workbook>';
const BLAD1 = '<sheet name="Kas" sheetId="1" r:id="rId1"/>';
const blad = cellen => '<worksheet><sheetData><row r="1">' + cellen + '</row></sheetData></worksheet>';
const xlsx = (delen) => pak(Object.assign({ 'xl/workbook.xml': WB(BLAD1) }, delen));

test('xlsx: zonder werkboek, zonder werkblad of met ontbrekend blad wordt geweigerd', () => {
  gooitZip(() => leesXlsx(pak({ 'iets.xml': '<a/>' })), /geen werkboek/);
  gooitZip(() => leesXlsx(pak({ 'xl/workbook.xml': WB('') })), /geen werkblad/);
  gooitZip(() => leesXlsx(pak({ 'xl/workbook.xml': WB(BLAD1) })), /eerste werkblad ontbreekt/);
});

test('xlsx: het blad volgt de relatie, absoluut of met ./ ervoor', () => {
  const rels = t => '<Relationships><Relationship Id="rId9" Target="x"/><Relationship Id="rId1" Target="' + t + '"/></Relationships>';
  const inhoud = blad('<c r="A1"><v>7</v></c>');
  const a = leesXlsx(xlsx({ 'xl/_rels/workbook.xml.rels': rels('/xl/eigen/b.xml'), 'xl/eigen/b.xml': inhoud }));
  assert.equal(a.inhoud.cellen.A1, '7');
  assert.equal(a.naam, 'Kas');
  const b = leesXlsx(xlsx({ 'xl/_rels/workbook.xml.rels': rels('./eigen/c.xml'), 'xl/eigen/c.xml': inhoud }));
  assert.equal(b.inhoud.cellen.A1, '7');
});

test('xlsx: meer werkbladen staan in de trouwlijst, met of zonder naam', () => {
  const s = blad('<c r="A1"><v>1</v></c>');
  const met = leesXlsx(pak({ 'xl/workbook.xml': WB(BLAD1 + '<sheet name="Twee" r:id="rId2"/><sheet r:id="rId3"/>'), 'xl/worksheets/sheet1.xml': s }));
  const t = met.trouw.find(x => /andere werkbladen/.test(x.wat));
  assert.equal(t.aantal, 2);
  assert.match(t.wat, /"Kas"/);
  const zonder = leesXlsx(pak({ 'xl/workbook.xml': WB('<sheet r:id="rId1"/><sheet r:id="rId2"/>'), 'xl/worksheets/sheet1.xml': s }));
  assert.match(zonder.trouw[0].wat, /"het eerste"/);
  assert.equal(zonder.naam, '');
});

test('xlsx: gedeelde teksten, inline tekst, waarheden en entiteiten', () => {
  const r = leesXlsx(xlsx({
    'xl/sharedStrings.xml': '<sst><si><t>Kas</t><rPh><t>KA</t></rPh><t>boek</t></si><si><t>&#65;&#x42;&amp;&#x110000;</t></si></sst>',
    'xl/worksheets/sheet1.xml': blad(
      '<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>9</v></c>' +
      '<c r="D1" t="inlineStr"><is><t>los &lt;x&gt;</t></is></c><c r="E1" t="b"><v>1</v></c><c r="F1" t="b"><v>0</v></c>' +
      '<c r="AA2"><v>3</v></c><c r="Z1"></c><c><v>1</v></c><c r="a1x"><v>1</v></c>'),
  }));
  const c = r.inhoud.cellen;
  assert.equal(c.A1, 'Kasboek', 'fonetische hulptekst valt weg');
  assert.equal(c.B1, 'AB&', 'een onmogelijk codepunt wordt leeg');
  assert.equal(c.C1, undefined, 'een gedeelde tekst die niet bestaat geeft een lege cel');
  assert.equal(c.D1, 'los <x>');
  assert.equal(c.E1, 'WAAR');
  assert.equal(c.F1, 'ONWAAR');
  assert.equal(c.AA2, '3');
  assert.equal(r.inhoud.kolommen, 27);
  assert.equal(r.inhoud.rijen, 20, 'minstens twintig rijen');
  assert.equal(Object.keys(c).length, 6, "lege cel, cel zonder of met ongeldige verwijzing vallen weg");
});

test('xlsx: fonetische hulptekst zonder sluittag beeindigt de tekst', () => {
  const r = leesXlsx(xlsx({
    'xl/sharedStrings.xml': '<sst><si><t>voor</t><rPh><t>x</t></si></sst>',
    'xl/worksheets/sheet1.xml': blad('<c r="A1" t="s"><v>0</v></c>'),
  }));
  assert.equal(r.inhoud.cellen.A1, 'voor');
});

test('xlsx: formules -- goed, onleesbaar, gedeeld en foutwaarde', () => {
  const r = leesXlsx(xlsx({
    'xl/worksheets/sheet1.xml': blad(
      '<c r="A1"><f>SUM(B1:B2)</f><v>3</v></c>' +
      '<c r="A2"><f>VLOOKUP(1,B1:C2,2)</f><v>5</v></c>' +
      '<c r="A3"><f t="shared" si="0"/><v>4</v></c>' +
      '<c r="A4" t="e"><v>#DIV/0!</v></c>'),
  }));
  const c = r.inhoud.cellen;
  assert.equal(c.A1, '=SUM(B1:B2)', 'een goede formule blijft een formule');
  assert.equal(c.A2, '5', 'een formule die niet zeker hetzelfde rekent, wordt de waarde');
  assert.equal(c.A3, '4');
  assert.equal(c.A4, '#DIV/0!');
  const wat = r.trouw.map(t => t.wat);
  assert.ok(wat.some(w => /^formule als waarde overgenomen/.test(w)));
  assert.ok(wat.includes('gedeelde formule als waarde overgenomen'));
  assert.ok(wat.includes('foutwaarde uit het bestand overgenomen als tekst'));
});

test('xlsx: celopmaak uit styles.xml -- datum, procent, geld en vetgedrukte kop', () => {
  const stijl = '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd-mm-yyyy"/><numFmt numFmtId="165" formatCode="[$&#8364;-413] #,##0.00"/>' +
    '<numFmt numFmtId="166" formatCode="0.0%"/><numFmt numFmtId="167"/></numFmts>' +
    '<fonts><font><sz val="11"/></font><font><b/></font></fonts>' +
    '<cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="9"/><xf numFmtId="166"/>' +
    '<xf numFmtId="165"/><xf numFmtId="5"/><xf numFmtId="0" fontId="1"/><xf numFmtId="167"/></cellXfs></styleSheet>';
  const r = leesXlsx(xlsx({
    'xl/styles.xml': stijl,
    'xl/worksheets/sheet1.xml': blad(
      '<c r="A1" s="1"><v>46023</v></c><c r="B1" s="2" t="n"><v>46024.5</v></c><c r="C1" s="3"><v>0.5</v></c>' +
      '<c r="D1" s="4"><v>0.25</v></c><c r="E1" s="5"><v>10</v></c><c r="F1" s="6"><v>11</v></c>' +
      '<c r="G1" s="7" t="inlineStr"><is><t>Kop</t></is></c><c r="H1" s="8"><v>1</v></c><c r="I1" s="1" t="s"><v>0</v></c><c r="J1"><v>2</v></c>'),
    'xl/sharedStrings.xml': '<sst><si><t>geen datum</t></si></sst>',
  }));
  const { cellen, opmaak } = r.inhoud;
  assert.equal(cellen.A1, '2026-01-01', 'datumgetal wordt een ISO-datum');
  assert.equal(cellen.B1, '2026-01-02', 'eigen datumcode, deel van de dag valt weg');
  assert.equal(opmaak.A1, 'datum');
  assert.equal(opmaak.B1, 'datum');
  assert.equal(opmaak.C1, 'procent');
  assert.equal(opmaak.D1, 'procent');
  assert.equal(opmaak.E1, 'geld');
  assert.equal(opmaak.F1, 'geld');
  assert.equal(opmaak.G1, 'kop');
  assert.equal(opmaak.H1, undefined, 'een eigen code zonder herkenbare soort geeft geen opmaak');
  assert.equal(cellen.I1, 'geen datum', 'tekst met datumopmaak blijft tekst');
  assert.equal(opmaak.J1, undefined);
});

test('xlsx: buiten het raster, te lange cellen, samenvoegingen en tekeningen in de trouwlijst', () => {
  const lang = 'x'.repeat(450);
  const r = leesXlsx(xlsx({
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1">' +
      '<c r="A1" t="inlineStr"><is><t>' + lang + '</t></is></c>' +
      '<c r="BI1"><v>1</v></c><c r="A' + (MAX_RIJEN + 1) + '"><v>1</v></c>' +
      '</row></sheetData><mergeCells><mergeCell ref="A1:B1"/></mergeCells><drawing r:id="rId2"/></worksheet>',
  }));
  assert.equal(r.inhoud.cellen.A1.length, 400);
  const wat = Object.fromEntries(r.trouw.map(t => [t.wat, t]));
  const raster = wat['buiten het raster van ' + MAX_RIJEN + ' rijen bij ' + MAX_KOLOMMEN + ' kolommen, weggelaten'];
  assert.equal(raster.aantal, 2);
  assert.deepEqual(raster.cellen, ['BI1', 'A' + (MAX_RIJEN + 1)]);
  assert.ok(wat['cel langer dan 400 tekens, afgekapt']);
  assert.deepEqual(wat['samengevoegde cellen, als losse cellen'].cellen, [], 'zonder cel genoemd');
  assert.ok(wat['grafieken of afbeeldingen, weggelaten']);
});

test('xlsx: boven de 4000 cellen wordt geteld, met hoogstens tien voorbeelden', () => {
  let cellen = '';
  // 40 kolommen x 101 rijen = 4040 cellen binnen het raster
  for (let rij = 1; rij <= 101; rij++) for (let k = 0; k < 40; k++) cellen += '<c r="' + kolNaam(k) + rij + '"><v>1</v></c>';
  const r = leesXlsx(xlsx({ 'xl/worksheets/sheet1.xml': blad(cellen) }));
  const t = r.trouw.find(x => /boven de 4000 cellen/.test(x.wat));
  assert.equal(t.aantal, 40);
  assert.equal(t.cellen.length, 10);
});

test('xlsx: een kop als <cols> wordt niet voor een cel aangezien, en een kop zonder > stopt de lezing', () => {
  const r = leesXlsx(xlsx({ 'xl/worksheets/sheet1.xml': '<worksheet><cols><col min="1"/></cols><sheetData><row><c r="A1"><v>5</v></c><c r="B1"' }));
  assert.deepEqual(r.inhoud.cellen, { A1: '5' });
});
