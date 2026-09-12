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
const { spawnSync } = require('child_process');
const { bouw, tekst, BRONNEN, VELDEN, soortVerschil } = require('../scripts/menselijkeuitvoering');
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

test('7. HET REGISTER BEVAT GEEN NIEUWE WAARHEID -- weggooien en opnieuw maken geeft hetzelfde', () => {
  /* Dit is het dragende ontwerpprincipe en niet een variant op toets 1. Toets 1
     vergelijkt met een hercompilatie IN DIT PROCES; deze gooit het bestand
     werkelijk weg en laat de generator als LOSS PROCES opnieuw beginnen. Zit er
     ergens een waarheid in die alleen in het bestand zelf woont -- een met de
     hand bijgeschreven regel, een veld dat uit een vorige ronde bleef staan --
     dan komt hij hier niet terug.
     MUTATIE: laat de generator het bestaande bestand inlezen en samenvoegen. */
  const voor = fs.readFileSync(OP_SCHIJF, 'utf8');
  try {
    fs.unlinkSync(OP_SCHIJF);
    const r = spawnSync('node', ['scripts/menselijkeuitvoering.js'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, 'de generator kwam er niet uit zonder bestaand bestand: ' +
      (r.stderr || '').slice(0, 300));
    assert.equal(fs.readFileSync(OP_SCHIJF, 'utf8'), voor,
      'het opnieuw gemaakte register wijkt af van het weggegooide. Er zit dus waarheid in het ' +
      'BESTAND die niet uit de bronnen komt -- precies wat een projectie niet mag hebben.');
  } finally { if (!fs.existsSync(OP_SCHIJF)) fs.writeFileSync(OP_SCHIJF, voor); }
});

test('8. elk gevraagd veld noemt zijn probe, of zegt dat er geen is', () => {
  /* De regel is: geen veld toevoegen omdat het mooi klinkt. Elk veld noemt dus
     WIE hem levert; kan niemand hem leveren, dan staat dat er met de reden en
     blijft hij leeg in plaats van geraden.
     MUTATIE: zet VELDEN.architectuurkeuzes op 'stuurspoor'. */
  const zonderProbe = [];
  for (const [veld, herkomst] of Object.entries(VELDEN)) {
    assert.ok(herkomst && herkomst.length > 15, veld + ' noemt geen herkomst');
    if (/^GEEN PROBE/.test(herkomst)) zonderProbe.push(veld);
  }
  /* Een veld zonder probe MOET in elke rij als niet-gemeten staan; zou het een
     waarde dragen, dan komt die ergens anders vandaan dan uit een meting. */
  for (const veld of zonderProbe) {
    for (const s of P.scenarios) {
      if (s.keten === 'ONBEPAALD') continue;
      const v = s[veld];
      assert.ok(v && v.gemeten === false, s.scenario + ': `' + veld + '` heeft geen probe maar ' +
        'draagt toch een uitslag: ' + JSON.stringify(v));
      assert.ok(v.reden, s.scenario + ': `' + veld + '` is niet gemeten zonder reden');
    }
  }
  assert.ok(zonderProbe.length, 'geen enkel veld staat als onmeetbaar te boek; dat is ' +
    'onwaarschijnlijk en maakt van deze toets een formaliteit');
});

test('9. AANGEBODEN en GEBRUIKT blijven twee beweringen, en `null` is geen `false`', () => {
  /* De kern van fase 7. Context die AANKOMT is iets anders dan context die de
     resolver GEBRUIKT, en allebei zijn iets anders dan een resolver die nooit
     heeft gedraaid -- dan heeft NIEMAND GEKEKEN, en dat is `null`.
     MUTATIE: maak van `gebruikt: null` een `false` in scripts/menstaalproef.js. */
  let aangeboden = 0, gebruikt = 0, niemandKeek = 0;
  for (const s of P.scenarios) {
    if (s.keten === 'ONBEPAALD') continue;
    assert.ok(s.context, s.scenario + ' draagt geen contextuitslag');
    assert.ok(['PASS', 'NOT_RUN', 'OVERGESLAGEN'].includes(s.context.aangeboden),
      s.scenario + ': onbekende contextstand ' + s.context.aangeboden);
    if (s.context.aangeboden === 'PASS') aangeboden++;
    if (s.context.gebruikt === true) gebruikt++;
    if (s.context.gebruikt === null) niemandKeek++;
    /* GEBRUIKT ZONDER AANGEBODEN KAN NIET. Staat dat er toch, dan komt de
       bewering ergens anders vandaan dan uit deze keten. */
    if (s.context.gebruikt === true)
      assert.equal(s.context.aangeboden, 'PASS',
        s.scenario + ': de context is GEBRUIKT terwijl er niets is gesaneerd');
  }
  assert.equal(P.telling.contextAangeboden, aangeboden);
  assert.equal(P.telling.contextGebruikt, gebruikt);
  assert.equal(P.telling.contextNiemandKeek, niemandKeek);
  assert.ok(niemandKeek > 0, 'geen enkele rij staat op `niemand keek`; dan is `null` stil een ' +
    '`false` geworden en leest een ongemeten resolver als een resolver die de context negeerde');
});

test('10. de gevolgfase draagt een detail dat ECHT uit gevolg.js komt', () => {
  /* Hier zat de fout die dit register aan het licht bracht: het merk droeg
     `{ graad }` en kern/stuur/gevolg.js geeft geen `graad` terug -- dat veld was
     sinds de bouw leeg, en een leeg detail leest als een gemeten fase.
     MUTATIE: zet in lusstap.js het detail terug op `{ graad: gevolg.graad }`. */
  const metGevolg = P.scenarios.filter((s) => s.keten !== 'ONBEPAALD' &&
    s.keten.CONSEQUENCE_EVALUATED === 'PASS');
  assert.ok(metGevolg.length, 'geen enkele rij bereikte de gevolgfase; dan meet deze toets niets');
  for (const s of metGevolg) {
    assert.ok(s.gevolg, s.scenario + ': de gevolgfase liep maar draagt geen detail');
    assert.equal(typeof s.gevolg.stappen, 'number', s.scenario + ': geen aantal stappen');
    /* `onbekend` en `gemeten` worden NOOIT opgeteld: "niet gemeten wat deze stap
       aanraakt" is iets anders dan "deze stap raakt niets aan". */
    for (const veld of ['gemeten', 'geenEffect', 'onbekend'])
      assert.equal(typeof s.gevolg[veld], 'number', s.scenario + ': ' + veld + ' ontbreekt');
    assert.equal(s.gevolg.gemeten + s.gevolg.geenEffect + s.gevolg.onbekend, s.gevolg.stappen,
      s.scenario + ': de drie graden tellen niet op tot het aantal stappen');
  }
  /* En er is er minstens EEN waarbij het gevolg ONBEKEND is. Staat die er niet,
     dan is dat goed nieuws of een meter die niet kijkt -- en dat verschil hoort
     hoorbaar te zijn. */
  assert.ok(metGevolg.some((s) => s.gevolg.onbekend > 0),
    'geen enkele stap heeft een onbekend gevolg; controleer of het detail echt uit gevolg.js komt');
});
