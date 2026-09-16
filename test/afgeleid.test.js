'use strict';
/* ============================================================================
   HET CONTRACT VAN GENERATOR-EIGENAARSCHAP, ACHT EIGENSCHAPPEN.

   Elk artefact dat repo-waarheid claimt en niet door een mens is geschreven,
   heeft PRECIES EEN machinaal vindbare generator-eigenaar. AFGELEID.json legt
   dat per wortelartefact vast; dit bestand handhaaft het.

   De marker `loopt achter` zet dit bestand in npm run registerklopt.
   ============================================================================ */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { meet, samenvatting, scriptVanOpdracht } = require('../scripts/afgeleid.js');
const { ONVERKLAARDE_BOTSING, EIGENAAR } = require('../scripts/lib/registereigenaar.js');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AFGELEID.json'), 'utf8'));

const STANDEN = ['BRON', 'AFGELEID', 'FRAGMENTEN', 'MOMENTOPNAME', 'ONBESLIST'];
const moetEigenaar = (r) => ['AFGELEID', 'FRAGMENTEN', 'MOMENTOPNAME'].includes(r.soort);

test('1. precies EEN canonieke eigenaar per afgeleid artefact', () => {
  const zonder = REGISTER.artefacten.filter(r => moetEigenaar(r) && !r.eigenaar);
  for (const r of zonder) {
    assert.ok(Object.prototype.hasOwnProperty.call(ONVERKLAARDE_BOTSING, r.naam),
      r.naam + ' is ' + r.soort + ' zonder canonieke eigenaar en staat niet in ONVERKLAARDE_BOTSING. ' +
      'Gemeten schrijvers: ' + (r.schrijvers.join(', ') || 'geen') + '. Verklaar de eigenaar in ' +
      'EIGENAAR (scripts/lib/registereigenaar.js) of zet de botsing op de schuldlijst.');
  }
  /* EN DE OMGEKEERDE KANT: een artefact met meerdere gemeten schrijvers en
     zonder verklaring hoort nooit stil een van de twee te krijgen. */
  for (const r of REGISTER.artefacten) {
    if (r.schrijvers.length > 1 && r.eigenaar) {
      const e = EIGENAAR[r.naam];
      assert.ok(e && (e.waarom || e.schrijver),
        r.naam + ' heeft ' + r.schrijvers.length + ' schrijvers en toch een eigenaar, zonder verklaring');
    }
  }
});

test('2. een verklaarde of gemeten eigenaar bestaat als bestand', () => {
  for (const r of REGISTER.artefacten) {
    if (!r.eigenaar) continue;
    assert.ok(fs.existsSync(path.join(WORTEL, r.eigenaar)),
      r.naam + ' wijst naar eigenaar ' + r.eigenaar + ' en dat bestand bestaat niet. ' +
      'Een hernoemde of verdwenen generator hoort HIER te zakken en niet pas bij de volgende merge.');
  }
});

test('3. de eigenaar schrijft aantoonbaar, of de verklaring zegt waarom niet', () => {
  for (const r of REGISTER.artefacten) {
    if (!moetEigenaar(r) || !r.eigenaar) continue;
    const gemeten = r.schrijvers.includes(r.eigenaar);
    if (gemeten) continue;
    const e = EIGENAAR[r.naam];
    const uitMerkteken = r.graad === 'merkteken';
    const uitVersheid = r.graad === 'versheid';
    assert.ok((e && String(e.waarom || '').length > 20) || uitMerkteken || uitVersheid,
      r.naam + ': eigenaar ' + r.eigenaar + ' is niet gemeten als schrijver (graad ' + r.graad +
      ') en er staat geen verklaring bij. De detectie is een ondergrens, dus dat MAG -- maar dan ' +
      'met een reden in EIGENAAR.');
  }
});

test('4. een vervallen stand bestaat niet: elke soort komt uit de gesloten lijst', () => {
  for (const r of REGISTER.artefacten) {
    assert.ok(STANDEN.includes(r.soort), r.naam + ' draagt een onbekende stand: ' + r.soort);
  }
  /* ONBESLIST is een EIGEN stand en nooit stil een van de andere twee. Zou de
     classificatie hem ooit wegwerken, dan valt hij naar nul terwijl er niets is
     verklaard -- en dan is de tand die een verdwenen generator moet vangen weg. */
  assert.ok(REGISTER.gemeten.onbeslist > 0,
    'onbeslist op nul terwijl er 91 handgeschreven documenten in de wortel staan, ' +
    'is geen dekking maar een classificatie die alles ergens in duwt');
});

test('5. dubbele schrijvers zonder verklaring staan op de schuldlijst', () => {
  const dubbel = REGISTER.artefacten.filter(r => r.schrijvers.length > 1);
  for (const r of dubbel) {
    const verklaard = EIGENAAR[r.naam] && String(EIGENAAR[r.naam].waarom || '').length > 20;
    const bekend = Object.prototype.hasOwnProperty.call(ONVERKLAARDE_BOTSING, r.naam);
    assert.ok(verklaard || bekend,
      r.naam + ' heeft ' + r.schrijvers.length + ' gemeten schrijvers (' + r.schrijvers.join(', ') +
      ') zonder verklaring en zonder plek op de schuldlijst');
  }
});

test('6. het register loopt achter op de bron noch op zichzelf', () => {
  const vers = samenvatting(meet());
  for (const sleutel of Object.keys(vers)) {
    assert.equal(REGISTER.gemeten[sleutel], vers[sleutel],
      'AFGELEID.json loopt achter op "' + sleutel + '" (' + REGISTER.gemeten[sleutel] +
      ' vastgelegd, ' + vers[sleutel] + ' gemeten) -- draai npm run afgeleid:vast');
  }
  assert.equal(REGISTER.artefacten.length, vers.artefacten);
});

test('7. de grendelregel is GEMETEN en nergens als eis verkleed', () => {
  /* BEWIJSMACHINE.md par. 6a.2 heeft dit besluit openstaan: een deel van de
     generatoren hoort juist NIET te grendelen (worktree-lokale uitvoer). Dit
     register levert het getal waarop dat besluit genomen kan worden en neemt het
     niet -- er is dus met opzet geen toets die een hoog getal eist. Wat er wel
     hoort te staan is dat het getal er IS en per artefact te herleiden. */
  assert.equal(typeof REGISTER.gemeten.afgeleidGrendelt, 'number');
  const metEigenaar = REGISTER.artefacten.filter(r => r.soort === 'AFGELEID' && r.eigenaar);
  for (const r of metEigenaar) {
    assert.ok(r.grendelt === true || r.grendelt === false,
      r.naam + ': grendelt hoort waar of onwaar te zijn en niet ' + r.grendelt);
  }
});

test('8. de verklaring komt uit een begrensde vorm en niet uit commentaar', () => {
  /* De classificatie mag alleen leunen op: het EIGENAAR-object, de
     opdrachtenlijst in scripts/versheid.js, de gemeten schrijvers, en het
     merkteken in het artefact zelf. Een vrije commentaarconventie ("// eigenaar:
     x") zou betekenen dat de verklaring niet toetsbaar is. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/afgeleid.js'), 'utf8');
  for (const verboden of ['@eigenaar', '@generator', '// eigenaar:', '/* eigenaar:']) {
    assert.ok(!bron.includes(verboden),
      'de classificatie leest een commentaarconventie (' + verboden + '); ' +
      'dat is geen begrensde toetsbare vorm');
  }
  /* En de brug van opdracht naar script hoort te weigeren in plaats van te
     raden: een opdracht die nergens heen wijst, levert GEEN eigenaar. */
  assert.equal(scriptVanOpdracht('npm run bestaat-niet-xyz'), null);
  assert.equal(scriptVanOpdracht('doe iets zonder script'), null);
  assert.equal(scriptVanOpdracht('npm run afgeleid:vast'), 'scripts/afgeleid.js');
});
