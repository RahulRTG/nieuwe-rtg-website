/* DE KERN SAMENSTELLEN -- deel 5f: RTG Festival.

   Een eigen deel en niet een regel in ./kernlaag5.js, om twee redenen. Die
   staat met 9,4 kB tegen de omvangsgrens aan, en belangrijker: deze wereld
   hangt onder EEN naam in de kern en niet als losse functies.

   WAAROM ONDER EEN NAAM. De kern is een zak met ruim negenhonderd namen. Een
   festival levert er zevenendertig, en daar zitten er een paar bij die in zo'n
   zak levensgevaarlijk generiek zijn: `scan`, `bezetting`, `magHier`,
   `instroom`, `offset`. Een Object.assign zou een gelijknamige naam van een
   ander domein stil overschrijven -- precies de stille breuk waar de
   domeingrens (./domeingrens.js) voor is gebouwd, alleen dan een laag eronder,
   waar geen grens meer helpt. Dus: kern.festival, en de router pakt uit wat hij
   nodig heeft.

   Wordt NA kernlaag5 aangeroepen en ver VOOR kernlaag7b (de routers); zie
   server.js. De volgorde binnen de wereld zelf staat in kern/festival/index.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { crypto, db, save, schoon } = hulp;
  /* De kern gaat als FUNCTIE mee en niet als waarde: kern/festival/signalen.js
     leest bevRooster en storingLijst, en die staan er op dit moment wel maar
     een volgende laag kan er nog bij zetten. Een functie leest laat; een waarde
     bevriest wat er nu is (zelfde reden als de Proxy in ./domeingrens.js). */
  kern.festival = require('../kern/festival')({ db, save, crypto, schoon, kern: () => kern });
};
