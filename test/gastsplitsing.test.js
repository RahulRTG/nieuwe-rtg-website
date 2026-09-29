/* DE GAST IS TWEE MENSEN -- de meter van stap 5 (SAMENLEVING.md par. 12).

   scripts/gastsplitsing.js loopt elke toets op `tier === 'guest'` in server/ na
   en zet naast elkaar wat de CODE doet (onderscheidt hij bezoeker en gratis
   account, weigert hij, of vertakt hij) en wat de WEIGERING zegt dat er nodig
   is. Dit bestand bewaakt het instrument en houdt het register vast.

   De bevinding die telt heet `account-belofte`: de tekst zegt dat een account
   of profiel volstaat, terwijl de code ook het gratis account weigert. Dat
   getal mag alleen DALEN (toets 5) -- een nieuwe deur die een gratis account een
   weg belooft die er niet is, zakt hier.

   Draai los: node --test test/gastsplitsing.test.js
   De meting zelf: npm run gastsplitsing */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const G = require('../scripts/gastsplitsing');

test('1. een pas-eis wint van het woord account, en elke soort heeft een eigen bak', () => {
  assert.equal(G.indeling('Installeren is voor betalende leden. Maak eerst een account.'), 'pas-eis');
  assert.equal(G.indeling('Reserveren kan alleen met een lidmaatschap.'), 'pas-eis');
  assert.equal(G.indeling('Melden kan met een RTG-profiel; meekijken mag altijd.'), 'account-belofte');
  assert.equal(G.indeling('Dit hoort bij een account; als gast is er niets om te bewaren.'), 'account-belofte');
  assert.equal(G.indeling('RTG Bank is voor leden.'), 'leden');
  assert.equal(G.indeling(null), 'zonder-tekst');
});

test('2. de plek die het onderscheid AL maakt, wordt als zodanig herkend', () => {
  /* geenGast() in server/server.js is de canonieke vorm (guest EN geen account),
     en /api/reserveer maakt het onderscheid via idGeverifieerd() -- een poort
     die een bezoeker niet kan halen. Ziet de meter die niet, dan telt hij goed
     geregelde deuren als tegenspraak of als pas-eis. */
  const s = G.meet();
  const soortVan = (bestand, stukje) => {
    const bron = fs.readFileSync(path.join(WORTEL, bestand), 'utf8').split('\n');
    const regel = bron.findIndex(r => r.includes(stukje)) + 1;
    assert.ok(regel > 0, stukje + ' staat in ' + bestand);
    const p = s.plekken.find(x => x.plek === bestand + ':' + regel);
    assert.ok(p, 'de meter ziet ' + bestand + ':' + regel);
    return p.soort;
  };
  assert.equal(soortVan('server/server.js', "tier === 'guest' && !req.session.account"), 'onderscheidt');
  assert.equal(soortVan('server/routes/member/handel/uitjes.js', "tier === 'guest' && !idGeverifieerd"), 'onderscheidt');
});

test('3. de meter ziet alle schrijfwijzen, ook de omgekeerde', () => {
  const s = G.meet();
  assert.ok(s.gemeten.plekken >= 100, 'er zijn toetsen op de gast gevonden (' + s.gemeten.plekken + ')');
  assert.ok(s.plekken.some(p => p.plek.startsWith('server/routes/samen.js:')),
    "`tier !== 'guest'` (routes/samen.js) wordt ook gezien");
  for (const p of s.plekken) {
    if (p.soort === 'vertakt' || p.soort === 'onderscheidt') assert.equal(p.zegt, null, p.plek + ' draagt geen weigertekst');
  }
});

test('4. GASTSPLITSING.json loopt niet achter op een verse meting', () => {
  const pad = path.join(WORTEL, 'GASTSPLITSING.json');
  assert.ok(fs.existsSync(pad), 'GASTSPLITSING.json bestaat -- draai: npm run gastsplitsing:vast');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const vers = G.meet();
  assert.deepEqual(vers.gemeten, vast.gemeten,
    'GASTSPLITSING.json loopt achter (' + JSON.stringify(vast.gemeten) + ' vastgelegd, ' +
    JSON.stringify(vers.gemeten) + ' gemeten) -- draai: npm run gastsplitsing:vast');
  assert.deepEqual(vers.tegenspraak.map(p => p.plek), vast.tegenspraak.map(p => p.plek),
    'GASTSPLITSING.json loopt achter op de tegenspraken -- draai: npm run gastsplitsing:vast');
});
