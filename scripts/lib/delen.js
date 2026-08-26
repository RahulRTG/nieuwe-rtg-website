'use strict';

/* DE VERDELING OVER DELEN -- een regel, op een plek.

   De unit-suite en de schermtoetsen worden allebei over vier runners verdeeld.
   Twee kopieen van diezelfde verdeling lopen vroeg of laat uiteen (LAT.md regel
   4), en de manier waarop ze uiteenlopen is de gevaarlijkste die er is: een
   bestand dat in geen enkel deel valt wordt stil niet getoetst, en alle delen
   melden groen.

   Daarom staat de regel hier, en toetst test/delen.test.js precies dat: de vier
   delen samen zijn de hele lijst, ze overlappen nergens, en de verdeling hangt
   alleen van de VOLGORDE af en niet van de inhoud.

   OM EN OM, NIET IN BLOKKEN. Een blok uit een gesorteerde lijst zet alle
   bestanden die met dezelfde letter beginnen bij elkaar, en dat zijn in deze
   suite vaak varianten van dezelfde zware toets (horecascherm, horecaschermen,
   ...). Om en om spreidt die buren over de delen. */

function ontleedDeel(waarde) {
  const m = /^(\d+)\/(\d+)$/.exec(String(waarde || ''));
  if (!m) return null;
  const nr = Number(m[1]), totaal = Number(m[2]);
  if (nr < 1 || totaal < 1 || nr > totaal) return null;
  return { nr, totaal };
}

function verdeel(lijst, deel) {
  if (!deel) return lijst.slice();
  return lijst.filter((_, i) => i % deel.totaal === deel.nr - 1);
}

module.exports = { ontleedDeel, verdeel };
