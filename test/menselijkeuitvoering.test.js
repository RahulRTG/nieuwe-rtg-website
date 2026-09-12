/* DE MENSELIJKE UITVOERING ALS PROJECTIE (scripts/menselijkeuitvoering.js).

   MENSELIJKE_UITVOERING.json is afgeleid bewijs en geen documentatie. Dat is
   niet aan het bestand te zien -- JSON ziet er hetzelfde uit of iemand hem heeft
   gegenereerd of met de hand heeft bijgewerkt -- en daarom staat het hier.
   Dezelfde drie handhavingen als test/executionmap.test.js, en ze zakken alle
   drie.

   De vierde die makkelijk vergeten wordt: `onbekend` staat er per rij MET reden.
   Een register dat een kolom invult omdat hij nu eenmaal bestaat, verzint hem --
   en juist bij deze keten is de verleiding groot, want een lege lijst onbekenden
   leest als een keten die overal bewijs voor heeft. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { bouw, tekst, BRONNEN, soortVerschil } = require('../scripts/menselijkeuitvoering');
const { FASEN } = require('../server/kern/stuur/spoor');

const WORTEL = path.join(__dirname, '..');
const OP_SCHIJF = path.join(WORTEL, 'MENSELIJKE_UITVOERING.json');
const P = bouw();

test('0. de projectie draait en levert scenario\'s op', () => {
  assert.ok(!P.fout, P.fout);
  assert.ok(P.telling.scenarios >= 25, 'te weinig scenarios: ' + P.telling.scenarios);
});

test('1. HET BESTAND OP SCHIJF IS GELIJK AAN WAT DE BRONNEN OPLEVEREN', () => {
  /* MUTATIE: verander een getal in MENSELIJKE_UITVOERING.json met de hand. */
  const opSchijf = fs.existsSync(OP_SCHIJF) ? fs.readFileSync(OP_SCHIJF, 'utf8') : null;
  assert.ok(opSchijf !== null,
    'MENSELIJKE_UITVOERING.json bestaat niet -- draai: npm run menselijkeuitvoering');
  assert.equal(opSchijf, tekst(P),
    'MENSELIJKE_UITVOERING.json is niet gelijk aan de hercompilatie. Of hij is met de hand ' +
    'gewijzigd, of de generator doet iets anders zonder dat een bron veranderde. ' +
    'Draai: npm run menselijkeuitvoering');
});

test('2. elke bron draagt zijn echte vingerafdruk, zodat "ongewijzigd" narekenbaar is', () => {
  for (const b of BRONNEN) {
    const afdruk = P.bronnen[b];
    assert.ok(afdruk, 'bron zonder vingerafdruk: ' + b);
    const echt = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(WORTEL, b))).digest('hex').slice(0, 16);
    assert.equal(afdruk, echt, 'de vingerafdruk van ' + b + ' klopt niet met het bestand');
  }
});

test('3. HIJ MEET NIETS ZELF -- geen server, geen browser, geen zin', () => {
  /* De hele waarde van deze laag is dat zij REGISTERS NAAST ELKAAR LEGT. Zou zij
     zelf meten, dan is er een tweede meting van dezelfde keten en is de vraag
     welke van de twee geldt -- precies de dubbeling waar SEMANTIEK.json op telt.
     MUTATIE: laat de generator scripts/lib/wegwerpserver.js laden. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/menselijkeuitvoering.js'), 'utf8');
  for (const verboden of ['wegwerpserver', 'browser.js', 'playwright', 'fetch('])
    assert.doesNotMatch(bron, new RegExp(verboden.replace(/[.(]/g, '\\$&')),
      'de projectie meet zelf (' + verboden + '); dan is er een tweede meting van dezelfde keten');
});

test('4. een leeftijdsverschil wordt NOOIT bij een tegenspraak opgeteld', () => {
  /* CODE.md par. 0.9: een verschil tussen twee registers van VERSCHILLENDE
     leeftijd is een leeftijdsverschil en geen tegenspraak. Die twee samenvoegen
     maakt van een oude meting een fout.
     MUTATIE: duw leeftijdsverschillen in de tegenspraaklijst. */
  /* HET ONDERSCHEID ZELF, op invoer die het geval afdwingt. Vandaag is er nul
     leeftijdsverschil in de echte data, en dan is elke mutatie op de LIJSTEN
     hieronder een no-op -- die zou dus niets bewijzen. Op de functie wel. */
  assert.equal(soortVerschil('aaaa1111', 'aaaa1111'), 'tegenspraak',
    'twee bronnen van dezelfde commit die iets anders zeggen, spreken elkaar tegen');
  assert.equal(soortVerschil('aaaa1111', 'bbbb2222'), 'leeftijdsverschil',
    'twee bronnen van verschillende commits zeggen niet iets anders, ze zijn iets ouder');
  assert.equal(soortVerschil(null, 'bbbb2222'), 'onbekend',
    'een bron zonder stempel levert geen beschuldiging op');
  assert.equal(soortVerschil('aaaa1111', null), 'onbekend');

  assert.ok(Array.isArray(P.tegenspraken) && Array.isArray(P.leeftijdsverschillen));
  assert.equal(P.telling.tegenspraken, P.tegenspraken.length);
  assert.equal(P.telling.leeftijdsverschillen, P.leeftijdsverschillen.length);
  const inTegenspraak = new Set(P.tegenspraken.map((t) => t.scenario + '|' + t.veld));
  for (const l of P.leeftijdsverschillen)
    assert.ok(!inTegenspraak.has(l.scenario + '|' + l.veld),
      l.scenario + ' staat in allebei de lijsten');
  /* En de lezer ziet of hij naar een momentopname kijkt of niet. */
  assert.equal(typeof P.eenLeeftijd, 'boolean');
  assert.ok(Object.keys(P.gemetenOp).length >= 2, 'er staat niet bij waarop elke bron is gemeten');
});

test('5. elke rij zegt wat zij NIET weet, met een reden', () => {
  /* Een lege onbekendenlijst leest als een keten die overal bewijs voor heeft.
     Twee dingen gelden voor ELKE rij en horen er dus altijd in te staan: het
     ongemeten contractveld, en dat de interpretatie gescript is.
     MUTATIE: haal de regel weg die `de interpretatie zelf` toevoegt. */
  for (const s of P.scenarios) {
    assert.ok(Array.isArray(s.onbekend) && s.onbekend.length,
      s.scenario + ' zegt nergens wat er niet van bekend is');
    for (const o of s.onbekend) {
      assert.ok(o.wat && o.waarom, s.scenario + ': een onbekende zonder reden -- ' + JSON.stringify(o));
      assert.ok(o.waarom.length > 25, s.scenario + ': de reden bij `' + o.wat + '` is te kort om iets te zeggen');
    }
    const watten = s.onbekend.map((o) => o.wat);
    if (s.keten !== 'ONBEPAALD')
      assert.ok(watten.includes('de interpretatie zelf'),
        s.scenario + ' zegt niet dat de interpretatie op de deterministische rail is gescript');
  }
});

test('6. `bewijs` verwijst naar een mutatie die iemand heeft zien zakken, nooit naar een spoor-id', () => {
  /* Een spoor-id is verzoekgebonden en weg na de aanroep (kern/stuur/spoor.js);
     ernaar verwijzen levert een bewijsstuk op dat niemand kan openen.
     MUTATIE: zet een trace-id in bewijsVan(). */
  let metBewijs = 0;
  for (const s of P.scenarios) {
    if (s.keten === 'ONBEPAALD') continue;
    assert.ok(Array.isArray(s.bewijs));
    if (s.bewijs.length) metBewijs++;
    for (const b of s.bewijs) {
      assert.doesNotMatch(b, /trace:|[0-9a-f]{8}-[0-9a-f]{4}-/,
        s.scenario + ': een spoor-id als bewijs -- die bestaat na de aanroep niet meer: ' + b);
      assert.match(b, /^[A-Z_]+: mutatie /, s.scenario + ': onherkenbaar bewijsstuk: ' + b);
      const fase = b.split(':')[0];
      assert.ok(FASEN.includes(fase), s.scenario + ': `' + fase + '` is geen fase uit spoor.js');
      /* En het bewijs hoort bij een schakel die in DEZE rij ook echt liep --
         anders wordt bewijs van een andere zin geleend. */
      assert.notEqual(s.keten[fase], 'OVERGESLAGEN',
        s.scenario + ': bewijs voor ' + fase + ' terwijl die fase hier is overgeslagen');
    }
  }
  assert.ok(metBewijs > 0, 'geen enkele rij draagt bewijs; dan is de join met MENSMUTATIE.json ' +
    'stil leeg -- draai: npm run mensmutatie');
});
