/* HET SEMANTISCH REGISTER -- en of hij werkelijk iets onderscheidt.

   scripts/semantiek.js beantwoordt de vraag uit BEWIJSMACHINE.md par. 3: hoe vaak
   betekent een woord in dit huis twee dingen? De aanleiding was een enkele vondst
   (twee constanten VERMOGENS met nul gedeelde leden), en de vraag daarna is of
   dat een incident was of een patroon -- want een register voor een incident is
   een la, en een register voor tachtig gevallen is infrastructuur.

   Deze meter kan op twee manieren liegen, en ze wijzen tegengesteld:

     TE HOOG   door PAREN te tellen in plaats van woorden. Dat deed hij ook
               echt: `CATEGORIEEN` in negen domeinen levert 36 paren, en de
               eerste versie meldde 1258 "botsingen" waar het er 77 woorden zijn.
     TE LAAG   door twee betekenissen voor een te houden, of door een gesplitste
               module (staffseed.js + staffseed2.js) als twee domeinen te lezen
               en zo een VALSE botsing te melden.

   Daarom toetst dit bestand allebei die kanten, plus de tegenproef die de hele
   uitkomst draagt: twee identieke catalogi mogen NOOIT als botsing tellen.

   Draai los: node --test test/semantiek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../scripts/semantiek');

const WORTEL = path.join(__dirname, '..');
const cat = (bestand, naam, leden) => ({
  bestand, naam, leden,
  domein: bestand.replace(/^server\//, '').replace(/\.js$/, '').split('/').slice(0, 2).join('/')
});

test('1. de eenheid is het WOORD en niet het paar', () => {
  /* De fout die deze meter zelf maakte. Drie domeinen met drie verschillende
     betekenissen zijn DRIE paren maar EEN woord. Wie paren telt, krijgt een
     getal dat kwadratisch groeit met de generiekheid van een woord. */
  const r = S.analyse([
    cat('server/kern/a/x.js', 'SOORTEN', ['appel', 'peer', 'kers']),
    cat('server/kern/b/x.js', 'SOORTEN', ['rood', 'groen', 'blauw']),
    cat('server/kern/c/x.js', 'SOORTEN', ['maandag', 'dinsdag', 'woensdag'])
  ]);
  assert.equal(r.woordenMetMeerBetekenissen, 1, 'een woord');
  assert.equal(r.top[0].betekenissen, 3, 'met drie betekenissen');
  assert.equal(r.top[0].domeinen, 3);
  assert.equal(r.betekenissenTotaal, 3, 'en niet drie PAREN');
});

test('2. gelijkende catalogi klonteren tot EEN betekenis', () => {
  /* Drie domeinen waarvan er twee hetzelfde bedoelen: dat zijn twee
     betekenissen, geen drie. Zonder clustering telt elke afwijking als een
     nieuw begrip en wordt het getal betekenisloos. */
  const r = S.analyse([
    cat('server/kern/a/x.js', 'STANDEN', ['open', 'dicht', 'bezig', 'klaar']),
    cat('server/kern/b/x.js', 'STANDEN', ['open', 'dicht', 'bezig', 'klaar']),
    cat('server/kern/c/x.js', 'STANDEN', ['rood', 'geel', 'groen', 'zwart'])
  ]);
  assert.equal(r.top[0].betekenissen, 2, 'twee identieke plus een afwijkende = twee betekenissen');
});

test('3. een GESPLITSTE module is een domein en botst niet met zichzelf', () => {
  /* staffseed.js en staffseed2.js zijn een module die over de 10 kB ging. Wie
     ze als twee domeinen leest, VERZINT een botsing -- en dat is precies het
     getal waar dit script over gaat. */
  assert.equal(S.domeinVan('server/kern/staffseed.js'), S.domeinVan('server/kern/staffseed2.js'),
    'staffseed.js en staffseed2.js horen tot hetzelfde domein');
  assert.equal(S.domeinVan('server/seed/genres-lijst-a.js'), S.domeinVan('server/seed/genres-lijst-b.js'),
    'en de letter-splitsing ook');
  assert.notEqual(S.domeinVan('server/kern/pay/x.js'), S.domeinVan('server/kern/waarde/x.js'),
    'maar twee echte domeinen blijven twee -- anders verbergt de normalisatie alles');

  const r = S.analyse([
    { bestand: 'server/kern/staffseed.js', naam: 'STAFF_SEED', leden: ['a', 'b', 'c'], domein: 'kern/staffseed' },
    { bestand: 'server/kern/staffseed2.js', naam: 'STAFF_SEED', leden: ['x', 'y', 'z'], domein: 'kern/staffseed' }
  ]);
  assert.equal(r.namenInMeerDomeinen, 0, 'een domein, dus geen botsing');
  assert.equal(r.woordenMetMeerBetekenissen, 0);
});

test('4. EEN betekenis op twee plekken is een DUBBELING, geen botsing', () => {
  /* De tegenovergestelde bevinding, met de tegenovergestelde reparatie:
     botsing -> hernoemen, dubbeling -> samenvoegen (LAT-regel 4). Een meter die
     ze op een hoop gooit, geeft een getal waar niemand iets mee kan. */
  const r = S.analyse([
    cat('server/kern/a/x.js', 'ERNST', ['hoog', 'midden', 'laag']),
    cat('server/kern/b/x.js', 'ERNST', ['hoog', 'midden', 'laag'])
  ]);
  assert.equal(r.woordenMetMeerBetekenissen, 0, 'een betekenis');
  assert.equal(r.dubbelingen, 1, 'maar wel op twee plekken');
  assert.equal(r.top[0].soort, 'dubbeling');
  assert.equal(r.top[0].hoogsteOverlap, 1);
});

test('5. DE TEGENPROEF: identieke catalogi worden NOOIT als botsing gemeld', () => {
  /* Zonder deze zou "77 woorden botsen" ook groen blijven bij een meter die
     alles een botsing noemt. LAT-regel 9. */
  const zelfde = ['een', 'twee', 'drie', 'vier', 'vijf'];
  const r = S.analyse([
    cat('server/kern/a/x.js', 'LIJST', zelfde.slice()),
    cat('server/kern/b/x.js', 'LIJST', zelfde.slice()),
    cat('server/kern/c/x.js', 'LIJST', zelfde.slice())
  ]);
  assert.equal(r.woordenMetMeerBetekenissen, 0, 'drie keer hetzelfde is een betekenis');
  assert.equal(r.top[0].betekenissen, 1);
});

test('6. en de andere kant op: totaal losse catalogi WORDEN gemeld', () => {
  const r = S.analyse([
    cat('server/kern/a/x.js', 'VERMOGENS', ['SEPA_UIT', 'KLANTGELD', 'WALLET_SALDO']),
    cat('server/kern/b/x.js', 'VERMOGENS', ['bereikbaar', 'binnenkomen', 'betalen'])
  ]);
  assert.equal(r.woordenMetMeerBetekenissen, 1);
  assert.equal(r.top[0].betekenissen, 2);
  assert.equal(r.top[0].soort, 'botsing');
  assert.equal(r.top[0].hoogsteOverlap, 0, 'nul gedeelde leden');
  assert.equal(r.top[0].waar.length, 2, 'en beide plekken staan erbij');
});

test('7. de echte meting draait, en klopt met wat er is vastgelegd', () => {
  const r = S.meet();
  assert.ok(r.catalogi >= 200, 'er zijn catalogi gevonden (' + r.catalogi + ')');
  assert.ok(r.verschillendeNamen >= 100, 'en verschillende namen (' + r.verschillendeNamen + ')');

  const pad = path.join(WORTEL, 'SEMANTIEK.json');
  assert.ok(fs.existsSync(pad), 'SEMANTIEK.json bestaat -- draai: npm run semantiek:vast');
  const vast = JSON.parse(fs.readFileSync(pad, 'utf8'));
  for (const sleutel of ['catalogi', 'verschillendeNamen', 'namenInMeerDomeinen',
    'woordenMetMeerBetekenissen', 'betekenissenTotaal', 'ergsteWoord', 'ergsteAantal', 'dubbelingen']) {
    assert.deepEqual(r[sleutel], vast[sleutel],
      'SEMANTIEK.json loopt achter op "' + sleutel + '" (' + vast[sleutel] + ' vastgelegd, ' +
      r[sleutel] + ' gemeten) -- draai: npm run semantiek:vast');
  }
});

test('8. de uitkomst die BEWIJSMACHINE.md par. 3 draagt, staat er ook echt', () => {
  /* LAT-regel 6. Kantelt een van deze, dan hoort dit te zakken en niet het
     document stil onwaar te worden. */
  const r = S.meet();
  assert.ok(r.woordenMetMeerBetekenissen >= 40,
    'par. 3 zegt dat dit een patroon is en geen incident; gemeten: ' +
    r.woordenMetMeerBetekenissen + ' woorden');
  assert.ok(r.ergsteAantal >= 10,
    'par. 3 noemt een woord met tientallen betekenissen; gemeten: ' +
    r.ergsteWoord + ' met ' + r.ergsteAantal);
  assert.ok(r.dubbelingen > 0,
    'par. 3 zegt dat de meter OOK de omgekeerde fout vindt (een betekenis, twee ' +
    'plekken); gemeten: ' + r.dubbelingen);
});
