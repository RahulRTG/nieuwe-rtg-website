/* RTG Office in en uit, de delen los: elke toets hier komt uit een vondst van
   de tegenlezing van 11 oktober 2026 en houdt die vondst dicht.

   Draai los: node --test test/office-formaten-eenheid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pak, lees } = require('../server/kern/office/zip');
const { leesXlsx } = require('../server/kern/office/xlsx-lees');
const { schrijfXlsx } = require('../server/kern/office/xlsx-schrijf');
const { naarExcel, vanExcel } = require('../server/kern/office/formuletaal');
const { xmlEsc } = require('../server/kern/office/ooxml');

const WERKBOEK = '<workbook><sheets><sheet name="B" sheetId="1" r:id="rId1"/></sheets></workbook>';

test('een werkblad vol cellen zonder sluittag legt de lezer niet stil (was kwadratisch)', () => {
  const blad = '<worksheet><sheetData><row r="1">' + '<c r="A1">'.repeat(300000) + '</row></sheetData></worksheet>';
  const z = pak({ 'xl/workbook.xml': WERKBOEK, 'xl/worksheets/sheet1.xml': blad,
    'xl/sharedStrings.xml': '<sst>' + '<si><t>x'.repeat(150000) + '</sst>' });
  assert.ok(z.length < 20000, 'het aanvalsbestand is klein ingepakt (' + z.length + ' bytes)');
  const t = Date.now();
  leesXlsx(z);
  assert.ok(Date.now() - t < 2000, 'binnen twee seconden gelezen, niet minuten (' + (Date.now() - t) + ' ms)');
});

test('een emoji overleeft de rondreis en verandert geen formule', () => {
  assert.equal(xmlEsc('a\u{1F600}b'), 'a\u{1F600}b');
  assert.equal(xmlEsc('a\u0001\uD800b'), 'ab', 'losse halve tekens en stuurtekens gaan er wel uit');
  const x = schrijfXlsx({ titel: 'Blad \u{1F600}', label: 'Intern', inhoud: { cellen: { A1: '\u{1F600} emoji' } } });
  assert.equal(leesXlsx(x.buffer).inhoud.cellen.A1, '\u{1F600} emoji');
});

test('formules die in Excel anders rekenen gaan niet als formule mee, in beide richtingen', () => {
  for (const f of ['=VERT.ZOEKEN(2;A1:B3;2)', '=VERGELIJKEN(2;A1:A3)', '=A1&" x"', '=TEKST.SAMENVOEGEN(A1;"x")',
    '=SOM.ALS(A1:A3;"a*";B1:B3)', '=AANTAL.ALS(A1:A3;C1)', '=WAARDE("1,5")', '=JAAR(A1)']) {
    assert.ok(naarExcel(f).fout, 'niet zeker hetzelfde: ' + f);
  }
  for (const f of ['VLOOKUP(2,A1:B3,2)', 'MATCH(2,A1:A3)', 'A1&B1', 'SUMIF(A1:A3,"a?",B1:B3)', 'COUNTIF(A1:A3,C1)']) {
    assert.ok(vanExcel(f).fout, 'niet zeker hetzelfde: ' + f);
  }
  assert.deepEqual(naarExcel('=SOM.ALS(A1:A3;">5";B1:B3)'), { formule: 'SUMIF(A1:A3,">5",B1:B3)' });
  assert.deepEqual(naarExcel('=STDEV.S(A1:A4)'), { formule: '_xlfn.STDEV.S(A1:A4)' }, 'Excel kent STDEV.S alleen met voorvoegsel');
  assert.deepEqual(vanExcel('_xlfn.STDEV.S(A1:A4)'), { formule: '=STDEV.S(A1:A4)' });
});

test('een onderdeel dat __proto__ heet, verandert de uitkomst van de lezer niet', () => {
  const z = pak(Object.fromEntries([['__proto__', 'x'], ['a', 'b']]));
  const uit = lees(z);
  assert.equal(Object.getPrototypeOf(uit), null);
  assert.equal(String(uit['__proto__']), 'x', 'gewoon een sleutel');
});
