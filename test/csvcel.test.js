'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const factuur = require('../server/kern/factuur');
const office = require('../server/kern/office/formaten');
const csvcel = require('../server/lib/csvcel');

// Letterlijke uitvoercontracten: Office bewaart tekst, facturen ook getallen.
const gevallen = [
  [null, '', '""'], [undefined, '', '""'], ['', '', '""'],
  [0, '0', '"0"'], [false, 'false', '"false"'], ['Jan', 'Jan', '"Jan"'],
  ['één', 'één', '"één"'], ['a;b', '"a;b"', '"a;b"'],
  ['a,b', '"a,b"', '"a,b"'], ['a"b', '"a""b"', '"a""b"'],
  ['a\nb', '"a\nb"', '"a\nb"'], ['a\rb', 'a\rb', '"a\rb"'],
  ['12,50', '"12,50"', '"12,50"'], ['-12,50', '"-12,50"', '"\'-12,50"'],
  ['-8%', '-8%', '"\'-8%"'], ['+12', '+12', '"\'+12"'],
  ['=1+1', "'=1+1", '"\'=1+1"'], ['+SUM(A1)', "'+SUM(A1)", '"\'+SUM(A1)"'],
  ['-CMD', "'-CMD", '"\'-CMD"'], ['@foo', "'@foo", '"\'@foo"'],
  ['\t=1', "'\t=1", '"\'\t=1"'], ['\r=1', "'\r=1", '"\'\r=1"'],
  ['=HYPERLINK("x")', '"\'=HYPERLINK(""x"")"', '"\'=HYPERLINK(""x"")"']
];

test('factuur CSV behoudt bestaande celbytes, getallen, scheiding en CRLF', () => {
  for (const [invoer, verwacht] of gevallen) assert.equal(factuur.csvCel(invoer), verwacht, JSON.stringify(invoer));
  assert.equal(factuur.csv(gevallen.map(([v]) => [v])), gevallen.map(([,f]) => f + '\r\n').join(''));
  assert.equal(factuur.csv([['a', 'b;c']]), 'a;"b;c"\r\n');
});

test('Office gebruikt de gedeelde celveiligheid via zijn echte exportfunctie', () => {
  const doc = { id: 'bord', titel: 'Uitvoer', soort: 'bord', inhoud: { lijsten: [
    { titel: 'Doen', kaarten: gevallen.map(([v]) => ({ titel: v })) }
  ] } };
  let saves = 0;
  const api = office({ save() { saves++; } }, {
    docMet: id => id === doc.id ? doc : null,
    magLezen: (_doc, key) => key === 'eigenaar', naamVan: key => key
  });
  assert.equal(api.exporteer('vreemde', doc.id, { formaat: 'csv' }).status, 403);
  assert.equal(saves, 0); assert.equal(doc.uitgaand, undefined);
  const r = api.exporteer('eigenaar', doc.id, { formaat: 'csv' });
  assert.equal(r.status, 200);
  const verwacht = ['"lijst","kaart","notitie","label","wie","voor","klaar"',
    ...gevallen.map(([, , v]) => '"Doen",' + v + ',"","","","","nee"')].join('\n');
  assert.equal(Buffer.from(r.bestand, 'base64').toString(), verwacht);
  assert.equal(r.bytes, Buffer.byteLength(verwacht)); assert.equal(saves, 1);
  assert.equal(doc.uitgaand.length, 1); assert.equal(doc.uitgaand[0].door, 'eigenaar');
});

test('de gedeelde helper behoudt getallen uitsluitend op expliciet verzoek', () => {
  assert.equal(csvcel('-12'), "'-12");
  assert.equal(csvcel('-12', { behoudGetallen: true }), '-12');
  assert.equal(csvcel('=1', { behoudGetallen: true }), "'=1");
});
