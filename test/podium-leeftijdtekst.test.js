/* Podium: wat er over leeftijd staat, klopt met de zones.

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). De kop van
   kern/podium/index.js, het commentaar in opzet/kernlaag5.js en de catalogusregel
   die een lid leest, zeiden "strikt 18+" en "Je eigen live-kanaal (18+)". Sinds
   de zones (kern/podium/zones.js) is alleen de zone 'beperkt' 18+; de zones in de
   gedeelde lijst vragen een lid. Een tekst die meer belooft dan de code doet, is
   een onwaarheid (waarheidsgetrouw).

   Draai los: node --test test/podium-leeftijdtekst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ZONES } = require('../server/kern/podium/zones');
const lees = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('alleen de zone beperkt is 18+, en geen tekst noemt het hele Podium 18+', () => {
  const achttien = Object.keys(ZONES).filter((z) => (ZONES[z].kijken || {}).minLeeftijd >= 18);
  assert.deepEqual(achttien, ['beperkt'], 'de code: alleen beperkt');
  const rij = require('../server/kern/appcatalogus-rijen/deel1b.js');
  const tekst = JSON.stringify(rij);
  const podium = (tekst.match(/\["podium","Podium"[^\]]*\]/) || [''])[0];
  assert.ok(podium, 'de catalogusregel van podium bestaat');
  assert.doesNotMatch(podium, /\(18\+\)/, 'de catalogus noemt het hele Podium 18+');
  assert.doesNotMatch(lees('server/kern/podium/index.js').slice(0, 1500), /Strikt 18\+/, 'de kop van de kern noemt het hele Podium 18+');
  assert.doesNotMatch(lees('server/opzet/kernlaag5.js'), /Podium[^*]*Strikt 18\+/, 'het opzetcommentaar noemt het hele Podium 18+');
});
