/* WAAROM DEZE TOETSEN ER ZIJN.

   De dekkingsmeting over de hele suite liet in server/lib/rtgjson.js een reeks
   takken zien die geen enkele toets raakte: de diepte-grens via opties (en de
   val terug op de standaard), elke soort fout in de parser met zijn eigen
   melding (verkeerd sleutelwoord, ontbrekende ":", ontbrekende "," of "}",
   onafgesloten string NA een escape, elke losse escape-soort, elk ongeldig
   getal), de witruimte op elke plek waar de grammatica die toestaat, het
   "constructor"-schild in al zijn varianten, en de niet-BigInt-fout in
   stringify die ongewijzigd door moet. test/rtgjson.test.js bewijst het grote
   contract (spec-randgevallen, fuzz, schilden, end-to-end); deze toetsen
   leggen per tak vast wat er geaccepteerd, geweigerd of teruggegeven hoort te
   worden, zodat een stille wijziging in een van die takken zakt.

   Elke weigering wordt gecontroleerd op .rtgjson === true en op de MELDING:
   de body-parser vertaalt zo'n fout naar een 400, en een fout die de
   verkeerde tak neemt (bijvoorbeeld "onverwacht einde" waar "verwachtte ':'"
   hoort) is precies wat je hier wilt zien zakken.

   Draai los: node --test test/rtgjson-takken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const rtgjson = require('../server/lib/rtgjson');

// hulp: weigert met een rtgjson-fout waarvan de melding bij het patroon past
function weigert(tekst, patroon, opties) {
  assert.throws(() => rtgjson.parse(tekst, opties), (e) => {
    assert.equal(e.rtgjson, true, 'hoort een rtgjson-fout te zijn: ' + JSON.stringify(tekst));
    assert.match(e.message, patroon, 'verkeerde melding voor ' + JSON.stringify(tekst));
    return true;
  });
}

test('1. de diepte-grens: opties.maxDiepte telt, en zonder opties geldt 64', () => {
  assert.equal(rtgjson.MAX_DIEPTE, 64);
  /* De diepte telt vanaf de wortel (diepte 0), zoals toets 4 van
     rtgjson.test.js vastlegt: '[[[1]]]' mag bij maxDiepte 3, want het blad
     staat op diepte 3. 65 geneste lijsten zetten de binnenste dus op diepte
     64 (mag), 66 op diepte 65 (niet). */
  // zonder opties, met een leeg opties-object en met null: allemaal de standaard
  const opGrens = '['.repeat(65) + ']'.repeat(65);
  const erover = '['.repeat(66) + ']'.repeat(66);
  for (const opties of [undefined, null, {}]) {
    assert.doesNotThrow(() => rtgjson.parse(opGrens, opties), 'diepte 64 mag');
    weigert(erover, /te diep genest \(meer dan 64 niveaus\)/, opties);
  }
  // een eigen grens werkt in beide richtingen, ook voor objecten
  assert.deepEqual(rtgjson.parse('{"a":{"b":1}}', { maxDiepte: 2 }), { a: { b: 1 } });
  weigert('{"a":{"b":{"c":1}}}', /te diep genest \(meer dan 2 niveaus\)/, { maxDiepte: 2 });
  // een ruimere grens dan de standaard laat ook echt meer door
  const diep = '['.repeat(100) + ']'.repeat(100);
  assert.doesNotThrow(() => rtgjson.parse(diep, { maxDiepte: 200 }));
  // ook een blad (geen container) telt als niveau
  weigert('[[1]]', /te diep/, { maxDiepte: 1 });
  assert.deepEqual(rtgjson.parse('[1]', { maxDiepte: 1 }), [1]);
});

test('2. de sleutelwoorden: alleen precies true, false en null', () => {
  assert.equal(rtgjson.parse('true'), true);
  assert.equal(rtgjson.parse('false'), false);
  assert.equal(rtgjson.parse('null'), null);
  assert.deepEqual(rtgjson.parse('[true,false,null]'), [true, false, null]);
  weigert('tru', /verwachtte "true"/);
  weigert('trUe', /verwachtte "true"/);
  weigert('fals', /verwachtte "false"/);
  weigert('fAlse', /verwachtte "false"/);
  weigert('nul', /verwachtte "null"/);
  weigert('nill', /verwachtte "null"/);
  // een woord dat klopt maar doorloopt is inhoud na het einde
  weigert('truex', /onverwachte inhoud na het einde/);
  weigert('[nullx]', /verwachtte "," of "\]" in de lijst/);
});

test('3. de eerste tekenkeuze: alles wat geen waarde begint is een nette fout', () => {
  weigert('', /onverwacht einde/);
  weigert(' \t\r\n', /onverwacht einde/);
  for (const c of ['}', ']', ',', ':', 'x', 'T', '+', '.', "'", 'u', '\u00a0']) {
    weigert(c, /onverwacht teken/);
  }
  // de positie staat in de melding
  weigert('   x', /onverwacht teken "x" \(positie 3\)/);
  // geen string: parse maakt er eerst een string van
  assert.equal(rtgjson.parse(12), 12);
  assert.equal(rtgjson.parse(true), true);
  assert.equal(rtgjson.parse(null), null, 'String(null) is "null"');
  weigert(undefined, /onverwacht teken "u"/);
});

test('4. objecten: lege vorm, witruimte op elke toegestane plek, en elke fout eigen', () => {
  assert.deepEqual(rtgjson.parse('{}'), {});
  assert.deepEqual(rtgjson.parse('{ \n\t\r }'), {});
  assert.deepEqual(rtgjson.parse('\r\n{\t"a"\n:\r1 ,\t"b" : [ ] , "c":{ } }\n'), { a: 1, b: [], c: {} });
  // sleutel moet een string zijn
  weigert('{a:1}', /objectsleutel moet een string zijn/);
  weigert('{1:1}', /objectsleutel moet een string zijn/);
  weigert('{"a":1,}', /objectsleutel moet een string zijn/, undefined); // komma voor sluiting
  weigert('{,}', /objectsleutel moet een string zijn/);
  weigert('{', /objectsleutel moet een string zijn/);
  // ":" ontbreekt of is iets anders
  weigert('{"a"}', /verwachtte ":" na de sleutel/);
  weigert('{"a" 1}', /verwachtte ":" na de sleutel/);
  weigert('{"a"=1}', /verwachtte ":" na de sleutel/);
  weigert('{"a"', /verwachtte ":" na de sleutel/);
  // waarde ontbreekt
  weigert('{"a":}', /onverwacht teken "}"/);
  weigert('{"a":', /onverwacht einde/);
  // na een waarde alleen "," of "}"
  weigert('{"a":1 "b":2}', /verwachtte "," of "}" in het object/);
  weigert('{"a":1]', /verwachtte "," of "}" in het object/);
  weigert('{"a":1', /verwachtte "," of "}" in het object/);
  weigert('{"a":1;"b":2}', /verwachtte "," of "}" in het object/);
  // een object met veel sleutels komt volledig en in volgorde terug
  const veel = {};
  for (let k = 0; k < 50; k++) veel['k' + k] = k;
  const terug = rtgjson.parse(JSON.stringify(veel));
  assert.deepEqual(terug, veel);
  assert.deepEqual(Object.keys(terug), Object.keys(veel));
});

test('5. het schild: __proto__ in elke spelling weg, constructor-met-prototype weg, de rest blijft', () => {
  // via een escape gespeld is het nog steeds __proto__ en wordt het niet gebouwd
  const via = rtgjson.parse('{"\\u005f_proto__":{"besmet":1},"a":1}');
  assert.equal(Object.getPrototypeOf(via), Object.prototype, 'prototype niet vervangen');
  assert.ok(!Object.prototype.hasOwnProperty.call(via, '__proto__'));
  assert.equal(via.besmet, undefined);
  assert.equal(via.a, 1);
  // __proto__ met een scalaire waarde of een lijst: evengoed weg
  for (const w of ['1', 'null', '[1]', '"x"']) {
    const g = rtgjson.parse('{"__proto__":' + w + '}');
    assert.deepEqual(Object.keys(g), [], '__proto__ met ' + w + ' hoort niet gebouwd te worden');
    assert.equal(Object.getPrototypeOf(g), Object.prototype);
  }
  // genest: ook op diepte geen __proto__
  const genest = rtgjson.parse('{"x":{"__proto__":{"besmet":1}},"y":[{"__proto__":{"besmet":2}}]}');
  assert.equal(genest.x.besmet, undefined);
  assert.equal(genest.y[0].besmet, undefined);
  assert.equal({}.besmet, undefined, 'het wereldwijde prototype is schoon');

  // constructor als gewone waarde blijft gewoon staan
  assert.deepEqual(rtgjson.parse('{"constructor":1}'), { constructor: 1 });
  assert.deepEqual(rtgjson.parse('{"constructor":"x"}'), { constructor: 'x' });
  assert.deepEqual(rtgjson.parse('{"constructor":null}'), { constructor: null });
  assert.deepEqual(rtgjson.parse('{"constructor":false}'), { constructor: false });
  assert.deepEqual(rtgjson.parse('{"constructor":{"naam":"x"}}'), { constructor: { naam: 'x' } });
  // een LIJST onder constructor heeft geen prototype-veld in de zin van het schild
  assert.deepEqual(rtgjson.parse('{"constructor":[1,2]}'), { constructor: [1, 2] });
  // maar een constructor-object met een prototype-veld wordt geweerd, welke waarde ook
  for (const w of ['{"prototype":{"besmet":1}}', '{"prototype":null}', '{"prototype":1,"ander":2}']) {
    const g = rtgjson.parse('{"constructor":' + w + ',"a":1}');
    assert.ok(!Object.prototype.hasOwnProperty.call(g, 'constructor'), 'constructor met prototype hoort weg: ' + w);
    assert.equal(g.a, 1);
  }
  // een prototype-sleutel op een ANDERE plek is geen gevaar en blijft
  assert.deepEqual(rtgjson.parse('{"prototype":{"x":1}}'), { prototype: { x: 1 } });
  assert.deepEqual(rtgjson.parse('{"ander":{"prototype":1}}'), { ander: { prototype: 1 } });
});

test('6. lijsten: lege vorm, witruimte, en elke fout eigen', () => {
  assert.deepEqual(rtgjson.parse('[]'), []);
  assert.deepEqual(rtgjson.parse('[ \t\n\r ]'), []);
  assert.deepEqual(rtgjson.parse('[ 1 ,\n2\t, "drie" ,{} ,[ ] ]'), [1, 2, 'drie', {}, []]);
  weigert('[1,]', /onverwacht teken "\]"/);
  weigert('[,1]', /onverwacht teken ","/);
  weigert('[', /onverwacht einde/);
  weigert('[1', /verwachtte "," of "\]" in de lijst/);
  weigert('[1 2]', /verwachtte "," of "\]" in de lijst/);
  weigert('[1}', /verwachtte "," of "\]" in de lijst/);
  weigert('[1:2]', /verwachtte "," of "\]" in de lijst/);
  weigert('[1,', /onverwacht einde/);
});

test('7. strings: elke escape-soort, en onafgesloten na een escape is ook een fout', () => {
  const ESC = [
    ['"\\""', '"'], ['"\\\\"', '\\'], ['"\\/"', '/'],
    ['"\\n"', '\n'], ['"\\t"', '\t'], ['"\\r"', '\r'], ['"\\b"', '\b'], ['"\\f"', '\f'],
    ['"\\u0041"', 'A'], ['"\\u00e9"', '\u00e9'], ['"\\u00E9"', '\u00e9'], ['"\\uABCD"', '\uabcd'],
    ['"\\u0000"', '\u0000']
  ];
  for (const [bron, verwacht] of ESC) {
    assert.equal(rtgjson.parse(bron), verwacht, 'escape ' + bron);
    assert.equal(rtgjson.parse(bron), JSON.parse(bron), 'zelfde als de spec: ' + bron);
  }
  // escapes midden in tekst, achter elkaar, en met gewone tekst ertussen
  assert.equal(rtgjson.parse('"a\\nb\\tc\\"d\\\\e\\/f\\u0041g"'), 'a\nb\tc"d\\e/fAg');
  assert.equal(rtgjson.parse('"\\n\\n\\n"'), '\n\n\n');
  // een los surrogaat via escape komt los terug (zoals de spec het toestaat)
  assert.equal(rtgjson.parse('"\\ud800"'), String.fromCharCode(0xd800));
  // rauwe niet-ASCII en DEL zijn gewoon toegestaan, alleen < 0x20 niet
  assert.equal(rtgjson.parse('"\u007f\u00e9\u20ac"'), '\u007f\u00e9\u20ac');
  for (const code of [0x00, 0x01, 0x09, 0x0a, 0x0d, 0x1f]) {
    weigert('"a' + String.fromCharCode(code) + 'b"', /onge-escaped stuurteken in string/);
  }
  // ongeldige escapes
  for (const e of ['x', 'a', 'U', '0', "'", ' ']) {
    weigert('"\\' + e + '"', /ongeldige escape/);
  }
  weigert('"\\', /ongeldige escape/); // backslash als laatste teken
  for (const hex of ['12g4', '12', 'zzzz', '+123', ' 123']) {
    weigert('"\\u' + hex + '"', /ongeldige \\u-escape/);
  }
  weigert('"\\u12"', /ongeldige \\u-escape/);
  // onafgesloten: zonder en mét eerdere escape
  weigert('"open', /string niet afgesloten/);
  weigert('"', /string niet afgesloten/);
  weigert('"a\\nb', /string niet afgesloten/);
  weigert('"a\\u0041', /string niet afgesloten/);
  weigert('{"sleutel', /string niet afgesloten/);
  // een sleutel met escapes wordt net zo gedecodeerd
  assert.deepEqual(rtgjson.parse('{"a\\nb":1,"\\u0041":2}'), { 'a\nb': 1, A: 2 });
});

test('8. getallen: elke vorm die de spec toelaat, en elke vorm die hij weigert', () => {
  const GOED = ['0', '-0', '7', '-7', '10', '1234567890', '0.5', '-0.5', '12.375',
    '1e3', '1E3', '1e+3', '1e-3', '1E-3', '-1.5e+2', '0e0', '0.0e-0', '2.5E10'];
  for (const g of GOED) {
    const uit = rtgjson.parse(g);
    assert.ok(Object.is(uit, JSON.parse(g)), 'getal ' + g + ' hoort ' + JSON.parse(g) + ' te zijn, kreeg ' + uit);
  }
  assert.ok(Object.is(rtgjson.parse('-0'), -0), '-0 blijft -0');
  assert.deepEqual(rtgjson.parse('[0,-1,2.5,3e2]'), [0, -1, 2.5, 300]);
  // ongeldig: elke tak van de getal-grammatica
  for (const r of ['-', '-a', '--1', '-.5', '1.', '1.e3', '1.a', '1e', '1E', '1e+', '1e-', '1ea', '-1e']) {
    weigert(r, /ongeldig getal/);
  }
  // een voorloopnul gevolgd door cijfers: 0 is af, de rest is inhoud na het einde
  weigert('01', /onverwachte inhoud na het einde/);
  weigert('-01', /onverwachte inhoud na het einde/);
  weigert('[01]', /verwachtte "," of "\]" in de lijst/);
  // hex, plus en spaties binnen een getal horen er niet bij
  weigert('0x10', /onverwachte inhoud na het einde/);
  weigert('+1', /onverwacht teken "\+"/);
  weigert('1 2', /onverwachte inhoud na het einde/);
  // getal aan het einde van een object of lijst, zonder witruimte
  assert.deepEqual(rtgjson.parse('{"a":-0.5e-1}'), { a: -0.05 });
  assert.deepEqual(rtgjson.parse('[1e2]'), [100]);
});

test('9. na de waarde: alleen witruimte, anders een fout met positie', () => {
  assert.equal(rtgjson.parse(' 1 \n\t\r'), 1);
  assert.deepEqual(rtgjson.parse('{"a":1}\n'), { a: 1 });
  weigert('1 x', /onverwachte inhoud na het einde \(positie 2\)/);
  weigert('{}{}', /onverwachte inhoud na het einde \(positie 2\)/);
  weigert('[] ]', /onverwachte inhoud na het einde/);
  weigert('"a""b"', /onverwachte inhoud na het einde/);
  weigert('null,', /onverwachte inhoud na het einde/);
});

test('10. stringify: een gewone fout gaat ONVERANDERD door, alleen BigInt wordt vertaald', () => {
  // een kringverwijzing is een TypeError zonder BigInt: die mag niet als rtgjson-fout vermomd worden
  const kring = {}; kring.zelf = kring;
  assert.throws(() => rtgjson.stringify(kring), (e) => {
    assert.ok(e instanceof TypeError, 'de oorspronkelijke TypeError komt door');
    assert.notEqual(e.rtgjson, true, 'geen rtgjson-fout: het is geen BigInt');
    return true;
  });
  // een toJSON die zelf gooit: precies die fout komt terug
  const eigen = new RangeError('kapot in toJSON');
  assert.throws(() => rtgjson.stringify({ toJSON() { throw eigen; } }), (e) => e === eigen);
  // een TypeError uit toJSON die toevallig "BigInt" noemt wordt WEL vertaald (de motor kijkt naar de melding)
  assert.throws(() => rtgjson.stringify({ toJSON() { throw new TypeError('geen BigInt hier'); } }),
    (e) => e.rtgjson === true && /BigInt hoort niet in JSON/.test(e.message));
  // een TypeError zonder melding is geen BigInt en komt ongewijzigd door
  const leeg = new TypeError('');
  assert.throws(() => rtgjson.stringify({ toJSON() { throw leeg; } }), (e) => e === leeg && e.rtgjson !== true);
  // een niet-Error (gegooide string) gaat ook ongewijzigd door
  assert.throws(() => rtgjson.stringify({ toJSON() { throw 'tekst'; } }), (e) => e === 'tekst');
  // BigInt in een lijst: nette fout zonder positie
  assert.throws(() => rtgjson.stringify([1, 2n]), (e) => {
    assert.equal(e.rtgjson, true);
    assert.equal(e.message, 'BigInt hoort niet in JSON');
    return true;
  });
  // en gewone waarden komen gewoon door de eigen parser terug
  const w = { a: [1, 'b', null, { c: true }] };
  assert.deepEqual(rtgjson.parse(rtgjson.stringify(w)), w);
});
