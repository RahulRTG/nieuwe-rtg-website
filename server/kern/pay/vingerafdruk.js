/* Vingerafdruk over ALLE saldi (niet alleen de som). Twee grootboeken kunnen
   dezelfde som hebben terwijl losse rekeningen tegen elkaar wegvallen (A staat
   +100 te hoog, B -100 te laag -> som blijft 0). Deze afdruk vangt zulke
   per-rekening-drift die de som mist.

   BYTE-VOOR-BYTE identiek aan motor/src/pay.rs::vingerafdruk() zodat de
   schaduw-drift-detector de JS-waarheid en de Rust-motor kan vergelijken:
   FNV-1a (64-bit) over rekeningen met saldo != 0, gesorteerd op de rauwe UTF-8-
   bytes van de sleutel, elk als `sleutel 0x1f <decimaal saldo> 0x0a`. i64-saldi,
   dus we rekenen met BigInt (de afdruk wordt zelden berekend: alleen op een
   statusbord-poll, niet op het geld-pad). */
'use strict';

const OFFSET = 0xcbf29ce484222325n; // FNV-offset-basis
const PRIME = 0x100000001b3n;       // FNV-prime
const MASK = 0xffffffffffffffffn;   // 64-bit wrap

function vingerafdruk(saldi) {
  // Alleen niet-nul rekeningen; sorteer op rauwe bytes (matcht Rust str-Ord).
  const rekeningen = [];
  for (const rek in saldi) {
    if (!Object.prototype.hasOwnProperty.call(saldi, rek)) continue;
    const c = Math.round(Number(saldi[rek]) || 0);
    if (c !== 0) rekeningen.push([rek, c]);
  }
  rekeningen.sort((a, b) => Buffer.compare(Buffer.from(a[0], 'utf8'), Buffer.from(b[0], 'utf8')));

  let h = OFFSET;
  const eet = (buf) => {
    for (let i = 0; i < buf.length; i++) {
      h ^= BigInt(buf[i]);
      h = (h * PRIME) & MASK;
    }
  };
  for (const [rek, c] of rekeningen) {
    eet(Buffer.from(rek, 'utf8'));
    eet(Buffer.from([0x1f]));
    eet(Buffer.from(String(c), 'utf8')); // decimaal, met '-' bij negatief
    eet(Buffer.from([0x0a]));
  }
  return h.toString(16).padStart(16, '0');
}

module.exports = { vingerafdruk };
