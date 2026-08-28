'use strict';
/* DE CACHENAAM VAN DE SERVICEWERKER, uit de INHOUD van de schil.

   Een geinstalleerde app ruimt oude caches alleen op bij `activate`, en dan
   alleen die met een ANDERE naam. Blijft de naam staan terwijl de schil
   verandert, dan houdt een toestel zijn oude schil -- zonder foutmelding, en
   zonder dat iemand het op een bureaublad-browser ziet. Een naam die je met de
   hand bijwerkt, is een naam die je vergeet.

   Draaien:  node scripts/swcache.js            (meldt of hij klopt; exit 1 zo niet)
             node scripts/swcache.js --schrijf  (zet hem goed) */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const SW = path.join(WORTEL, 'public', 'sw.js');

/* De afdruk komt uit ./lib/swvingerafdruk.js, want hij werd ook door
   scripts/build.js gerekend -- en die twee waren het niet eens. Zie de kop
   daar voor de drie verschillen en wat ze kostten. */
const { schilVan, cachenaamVoor } = require('./lib/swvingerafdruk');

const tekst = fs.readFileSync(SW, 'utf8');
const schil = schilVan(tekst);
if (!schil || !schil.length) {
  console.error('[swcache] de SHELL-lijst in public/sw.js is niet te lezen');
  process.exit(1);
}
const uit = cachenaamVoor(tekst, path.join(WORTEL, 'public'));
const hoort = uit && uit.nieuw;
const staat = uit && uit.huidig;

if (staat === hoort) {
  console.log('[swcache] klopt: ' + staat + ' (' + schil.length + ' schilbestanden)');
  process.exit(0);
}
if (!process.argv.includes('--schrijf')) {
  console.error('[swcache] de cachenaam loopt achter op de schil: ' + staat + ' -> ' + hoort +
    '\n           draai: node scripts/swcache.js --schrijf');
  process.exit(1);
}
fs.writeFileSync(SW, tekst.replace(/const CACHE = '[^']+'/, "const CACHE = '" + hoort + "'"));
console.log('[swcache] bijgewerkt: ' + staat + ' -> ' + hoort);
