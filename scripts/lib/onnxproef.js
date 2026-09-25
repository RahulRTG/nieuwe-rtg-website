/* Een ONNX-proefmodel van 80 bytes, met de hand in protobuf gezet: c = a * b
   over float[3]. Er is hier geen onnx-pakket (nul afhankelijkheden, en het
   netwerkbeleid laat de modelbron niet toe), en een proefmodel hoort bovendien
   te bestaan zonder dat iemand iets hoeft te downloaden.

   Het bewijst dat de UITVOERDER werkt (ONNX Runtime in de afgesloten cel), en
   niets over de kwaliteit van een echt model: daarvoor is een proefset nodig
   (TOESTEL.md par. 9.2). */
'use strict';

function varint(n) { const o = []; do { let b = n & 127; n = Math.floor(n / 128); if (n) b |= 128; o.push(b); } while (n); return o; }
function veld(nr, type, inhoud) {
  const kop = varint(nr << 3 | type);
  return type === 2 ? kop.concat(varint(inhoud.length), inhoud) : kop.concat(varint(inhoud));
}
const tekst = (t) => [...Buffer.from(t, 'utf8')];

function vermenigvuldigModel() {
  const tensorType = veld(1, 2, veld(1, 0, 1).concat(veld(2, 2, veld(1, 2, veld(1, 0, 3))))); // float[3]
  const waarde = (n) => veld(1, 2, tekst(n)).concat(veld(2, 2, tensorType));
  const knoop = veld(1, 2, tekst('a')).concat(veld(1, 2, tekst('b')), veld(2, 2, tekst('c')), veld(4, 2, tekst('Mul')));
  const graaf = veld(1, 2, knoop).concat(veld(2, 2, tekst('g')), veld(11, 2, waarde('a')), veld(11, 2, waarde('b')),
    veld(12, 2, waarde('c')));
  const opset = veld(1, 2, []).concat(veld(2, 0, 13));
  return Buffer.from(veld(1, 0, 8).concat(veld(7, 2, graaf), veld(8, 2, opset)));
}

module.exports = { vermenigvuldigModel };
