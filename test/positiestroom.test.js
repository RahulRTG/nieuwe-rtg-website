/* POSITIESTROOM -- meet hij wat hij zegt te meten, en kan hij zakken?

   De meter is de bron-helft van de grondwetmeter uit NAVIGATIE.md par. 6.4
   (besluit N10). Hij bestaat uit drie dingen die elk kunnen liegen, en elk
   krijgt hier een proef die hem laat zakken:

     - de DETECTOR (de noemer): herkent hij een opgeslagen positie, en laat hij
       een vaste coordinaat of een positie zonder opslag met rust?
     - de BESTURINGSPROEF: staat elk citaat letterlijk in de bron?
     - de TEGENSPRAAK: zakt een voorstel dat de gemeten termijn tegenspreekt?

   Een meter die je nooit hebt zien zakken is geen meter (LAT.md regel 10).

   Draai los: node --test test/positiestroom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../scripts/positiestroom');

const WORTEL = path.join(__dirname, '..');

test('1. de detector herkent een opgeslagen positie van een mens', () => {
  assert.equal(P.schrijftPositie('db.data.x[key] = { lat, lng, at: nu() }; save();'), true,
    'de verkorte vorm { lat, lng } hoort mee te tellen');
  assert.equal(P.schrijftPositie('o.p = { lat: punt.lat, lng: punt.lng }; save();'), true);
  assert.equal(P.schrijftPositie('m.plek = { lat: b.lat, lon: b.lon }; db.data.m.push(m);'), true,
    'lon is ook een lengtegraad');
});

test('2. MUTATIE: de detector laat een vaste plek en een positie zonder opslag met rust', () => {
  assert.equal(P.schrijftPositie("const h = { naam: 'Aeroport', lat: 38.873, lng: 1.373 }; save();"), false,
    'een vaste coordinaat is een plaats of zaad, geen mens');
  assert.equal(P.schrijftPositie('return haversine({ lat, lng }, h);'), false,
    'wie niets opslaat, maakt geen stroom');
  assert.equal(P.schrijftPositie('/* db.data.x = { lat, lng }; save(); */ const a = 1;'), false,
    'een positie in commentaar is geen code');
});

test('3. BESTURINGSPROEF: elk citaat staat letterlijk in de ECHTE bron', () => {
  const uit = P.meet();
  assert.deepEqual(uit.besturing.citaatFouten, [],
    'een citaat dat niet meer in zijn bestand staat, betekent dat een stroom verhuisd of verdwenen is');
  assert.equal(uit.besturing.inOrde, true);
});

test('4. MUTATIE: een citaat dat niet in de bron staat, laat de besturingsproef zakken', () => {
  /* Zonder deze toets bewijst toets 3 alleen dat de lijst toevallig klopt, niet
     dat de meter het zou zien als hij niet klopte. */
  const stroom = P.STROMEN[0];
  const echt = stroom.bron[0].citaat;
  stroom.bron[0].citaat = echt + ' // verzonnen';
  try {
    const uit = P.meet();
    assert.equal(uit.besturing.inOrde, false);
    assert.ok(uit.besturing.citaatFouten.some(c => c.stroom === stroom.naam));
  } finally {
    stroom.bron[0].citaat = echt;
  }
});

test('5. elk kandidaatbestand is verklaard: een stroom of een reden', () => {
  const uit = P.meet();
  assert.deepEqual(uit.onverklaard, [],
    'een bestand dat een positie opslaat zonder stroom of reden in scripts/positiestroom.js -- voeg het toe, ' +
    'met een citaat als het een positie van een mens bewaart');
  assert.ok(uit.gemeten.kandidaten >= 40, 'de detector ziet het huis nog (' + uit.gemeten.kandidaten + ')');
});

test('6. MUTATIE: een verklaring weghalen maakt een kandidaat onverklaard', () => {
  const pad = 'server/kern/ghost.js';
  const bewaard = P.GEEN_STROOM[pad];
  assert.ok(bewaard, pad + ' hoort een verklaring te hebben');
  delete P.GEEN_STROOM[pad];
  try {
    assert.ok(P.meet().onverklaard.includes(pad));
  } finally {
    P.GEEN_STROOM[pad] = bewaard;
  }
});

test('7. MUTATIE: een voorstel dat de gemeten termijn tegenspreekt, zakt', () => {
  assert.match(P.tegenspraak('onbegrensd', { soort: 'beleid', dagen: 90 }), /termijn/);
  assert.match(P.tegenspraak('venster', { soort: 'geen' }), /niets haalt/);
  assert.match(P.tegenspraak('venster', { soort: 'beleid', dagen: 90 }), /langer dan twee dagen/);
  assert.equal(P.tegenspraak('venster', { soort: 'beleid', dagen: 2 }), null);
  assert.equal(P.tegenspraak('verboden', { soort: 'beleid', dagen: 90 }), null,
    'verboden staat los van de termijn: een passagelog is verboden, ook als hij na 90 dagen verdwijnt');
  assert.equal(P.meet().gemeten.tegenspraak, 0, 'en op de echte boom spreekt geen voorstel de meting tegen');
});

test('8. de termijn komt uit het bewaarbeleid en niet uit de lijst', () => {
  /* De scherpste vondst van NAVIGATIE.md par. 6.2 is de passagelog. Die termijn
     staat NIET in de stroom verklaard; hij moet uit bewaarbeleid-operationeel.js
     komen. Verdwijnt hij daar, dan hoort deze toets dat te zien. */
  const b = P.termijnBronnen();
  assert.equal(b.beleid.plaatsLog && b.beleid.plaatsLog.dagen, '90');
  assert.ok(b.veger.has('live'), 'de bewaarveger ruimt db.data.live');
  assert.ok(b.vergeten.has('live') && b.vergeten.has('ontmoetPosities'));
  const rij = P.meet().rijen.find(r => r.naam === 'plaats-passages');
  assert.equal(rij.termijn.soort, 'beleid');
  assert.equal(rij.termijn.dagen, 90);
});

test('9. elke stroom draagt een geldige klasse, een reden en GEEN besluit dat niemand nam', () => {
  const uit = P.meet();
  const doc = fs.readFileSync(path.join(__dirname, '..', 'NAVIGATIE.md'), 'utf8');
  const par150 = doc.slice(doc.indexOf('### 15.0'), doc.indexOf('### 15.1'));
  for (const r of uit.rijen) {
    assert.ok(P.KLASSEN.includes(r.klasse), r.naam + ': onbekende klasse ' + r.klasse);
    assert.ok(r.waarom && r.waarom.length > 30, r.naam + ': de indeling hoort verklaard te zijn');
    /* Een besluit is van de eigenaar (MUTATIECONTRACT.md: een stand wordt nooit
       afgeleid uit bewijs). Het komt alleen uit BESLUITEN, en elk nummer daar
       hoort als besluit in NAVIGATIE.md par. 15.0 te staan. */
    if (r.besluit === null) { assert.equal(r.status, 'voorstel'); }
    else {
      assert.equal(r.status, 'besloten');
      assert.ok(P.KLASSEN.includes(r.besluit.klasse), r.naam + ': besluit naar een onbekende klasse');
      assert.match(r.besluit.datum, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(par150.includes('**' + r.besluit.n + '**'), r.naam + ': ' + r.besluit.n + ' staat niet in NAVIGATIE.md par. 15.0');
      assert.equal(r.besluit.uitgevoerd, r.besluit.klasse === r.klasse,
        r.naam + ': uitgevoerd wordt afgeleid, niet opgegeven');
    }
    if (r.klasse === 'onbekend') assert.ok(r.reden && r.reden.length > 40, r.naam + ': onbekend draagt een reden');
  }
  // een besluit over een stroom die niet bestaat, is een besluit dat nergens landt
  const namen = new Set(P.STROMEN.map(x => x.naam));
  for (const naam of Object.keys(P.BESLUITEN)) assert.ok(namen.has(naam), naam + ': geen stroom met die naam');
});

test('10. de meter telt geen gebruik als schuld (N11)', () => {
  /* Een positie die alleen wordt DOORGEREKEND hoort niet als stroom te bestaan;
     anders beloont deze meter minder GPS, en dat maakt de navigatie slechter. */
  for (const [pad, g] of Object.entries(P.GEEN_STROOM)) {
    assert.ok(['plaats', 'zaad', 'doorgerekend'].includes(g.soort), pad);
    assert.ok(g.reden.length > 10, pad + ': een reden');
  }
  const uit = P.meet();
  /* Wat niet blijft, is geen stroom -- met EEN uitzondering: een stroom die de
     eigenaar heeft laten stoppen (N12) blijft als rij staan, zodat te zien is
     dat het besluit is uitgevoerd. Zo'n rij is geen voorstel en geen schuld. */
  for (const r of uit.rijen.filter(x => x.klasse === 'toegestaan')) {
    assert.ok(r.besluit && r.besluit.klasse === 'toegestaan' && r.besluit.uitgevoerd,
      r.naam + ': wat niet blijft, is geen stroom -- tenzij een besluit hem liet stoppen');
  }
});

test('11. het register POSITIESTROOM.json loopt niet achter op een verse meting', () => {
  /* NAVIGATIE.md par. 6.2 en 6.4 citeren deze getallen, en de ratel in NORM.json
     leest ze. Een verouderd getal ziet er identiek uit aan een vers getal. */
  const vast = JSON.parse(fs.readFileSync(path.join(WORTEL, 'POSITIESTROOM.json'), 'utf8'));
  const vers = P.meet();
  const klopt = (wat, a, b) => assert.deepEqual(a, b,
    'POSITIESTROOM.json loopt achter op de code (' + wat + ') -- draai: npm run positiestroom:vast');
  for (const k of ['kandidaten', 'stromen', 'zonderTermijn', 'nietVergeten', 'nietGedetecteerd', 'besloten'])
    klopt(k, vast.gemeten[k], vers.gemeten[k]);
  klopt('klassen', vast.gemeten.klassen, vers.gemeten.klassen);
  const indeling = (j) => Object.fromEntries(j.rijen.map(r => [r.naam, [r.klasse, r.termijn.soort, r.vergeten]]));
  klopt('indeling per stroom', indeling(vast), indeling(vers));
});
