/* De ijking van de meters: regel 10 van LAT.md, met een handhaver.

   "Een meter die je niet hebt zien uitslaan, meet niets." Dat stond
   opgeschreven, en op een dag bleken zeven meters te liegen -- geen van
   allen in de RTG-code zelf, allemaal in de instrumenten die moesten
   bewijzen dat de code deugde. Een kapotte toets zakt en dat merk je; een
   kapotte meter geeft een getal, en getallen ogen als feiten.

   Wat hier gebeurt: elke meter uit scripts/norm.js krijgt een bekend-FOUTE
   invoer, en moet die zien. Niet "hij draait" maar "hij slaat uit". Wat we
   in het klein doen is precies wat LAT-regel 2 in het groot eist: de
   bewering natrekken met een mutatie.

   En voor de meters die je niet in een toets kunt voeden (de prestatiecijfers
   komen van een echte beproeving van een half uur op een echte machine)
   staat er een REDEN in plaats van een proef. Die reden is geen vrijbrief:
   scripts/check.js regel 35 eist dat elke meter hier voorkomt, en de
   NORM-meter `metersOngeijkt` telt de redenen en mag alleen omlaag. Zo kan
   een nieuwe meter niet ongemerkt ongeijkt meeliften, en wordt het gat
   kleiner in plaats van vergeten.

   Draai los: node --experimental-sqlite --test test/meterijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const norm = require('../scripts/norm.js');

/* Een proef doet drie dingen: iets kapots neerzetten, meten, opruimen. Het
   opruimen staat in een finally, want een ijking die rommel achterlaat is
   erger dan geen ijking. */
function metTijdelijkBestand(relPad, inhoud, doe) {
  const vol = path.join(WORTEL, relPad);
  assert.equal(fs.existsSync(vol), false, 'de ijking overschrijft nooit een bestaand bestand: ' + relPad);
  fs.writeFileSync(vol, inhoud);
  try { return doe(); } finally { try { fs.unlinkSync(vol); } catch (e) {} }
}

/* De registratie. Elke meter uit scripts/norm.js staat hier, met OF een
   proef die hem laat uitslaan, OF een reden waarom dat in een toets niet
   kan. scripts/check.js regel 35 bewaakt dat die lijst compleet blijft. */
const IJKINGEN = {
  testbestanden: {
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.test.js',
      "const test = require('node:test');\ntest('ijk', () => {});\n",
      () => norm.meet().testbestanden - voor.testbestanden)
  },
  e2eBestanden: {
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.e2e.js',
      "const test = require('node:test');\ntest('ijk', () => {});\n",
      () => norm.meet().e2eBestanden - voor.e2eBestanden)
  },
  zelfpoortendeToetsen: {
    // een toets die zichzelf overslaat MOET meetellen; de vorm met een
    // ternair, want juist die vorm werd hier ooit verkeerd geteld
    proef: (voor) => metTijdelijkBestand('test/zz-ijk-tijdelijk.test.js',
      "const test = require('node:test');\nconst aan = false;\n" +
      "test('ijk', { skip: aan ? false : 'geen dienst' }, () => {});\n",
      () => norm.meet().zelfpoortendeToetsen - voor.zelfpoortendeToetsen)
  },
  keuringOmvang: {
    // een productbestand vlak onder de 10 kB-grens hoort opgemerkt te worden
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk.js',
      '/* ijkbestand */\n' + 'const x = "' + 'y'.repeat(9900) + '";\nmodule.exports = { x };\n',
      () => norm.meet().keuringOmvang - voor.keuringOmvang)
  },
  dependencies: {
    /* De enige meter waarvan de bron een bestand is dat we ook echt even
       veranderen. Terugzetten gebeurt uit de tekst die we vooraf lazen, niet
       uit een herbouwd object: dan blijft de opmaak exact zoals hij was. */
    proef: (voor) => {
      const p = path.join(WORTEL, 'package.json');
      const oud = fs.readFileSync(p, 'utf8');
      try {
        const j = JSON.parse(oud);
        j.dependencies = Object.assign({}, j.dependencies, { 'zz-ijk-tijdelijk': '^1.0.0' });
        fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
        return norm.meet().dependencies - voor.dependencies;
      } finally { fs.writeFileSync(p, oud); }
    }
  },
  metersOngeijkt: {
    /* De meter die de ongeijkte meters telt, moet zelf uitslaan -- anders
       bewaakt een ongeijkte meter het ijken. Hij krijgt twee verzonnen
       registraties: in de ene draagt een ECHTE metersleutel een reden, in de
       andere dezelfde sleutel een proef. Het verschil hoort exact 1 te zijn.
       Geen norm.meet() nodig, en dat is geen luiheid: telOngeijkt() neemt zijn
       bron als invoer juist zodat deze ijking kan bestaan. */
    proef: () => {
      const bouw = (regel) => 'const IJKINGEN = {\n  ' + regel + '\n};\n';
      const met = norm.telOngeijkt(bouw("p99Ms: { reden: 'prestatiecijfer uit een echte beproeving' }"));
      const zonder = norm.telOngeijkt(bouw('p99Ms: { proef: 1 }'));
      assert.equal(met, 1, 'een verzonnen registratie met een reden telt er precies een');
      assert.equal(zonder, 0, 'dezelfde registratie met een proef telt er nul');
      /* En een sleutel die GEEN meter is telt niet mee, hoe hard hij ook
         "reden" roept: anders zou de meter zijn eigen commentaar meetellen. */
      assert.equal(norm.telOngeijkt(bouw("zzGeenMeter: { reden: 'lang genoeg om een reden te lijken' }")), 0,
        'een sleutel die in norm.js geen meter is, telt niet mee');
      return met - zonder;
    }
  },

  /* Hieronder: meters die je in een toets niet eerlijk kunt voeden. De reden
     staat erbij en telt mee in `metersOngeijkt`, die alleen omlaag mag. */
  endpointsZonderTest: { reden: 'vraagt een nieuwe route EN het uitblijven van een toets erop; dat is een repo-brede staat, geen invoer die je in een toets neerzet' },
  dekkingPct: { reden: 'zelfde bron als endpointsZonderTest' },
  keuringStuk: { reden: 'een "stuk"-bevinding vraagt een echte kapotte belofte (een env-variabele die nergens gelezen wordt); dat raakt bestanden buiten deze toets' },
  keuringScheef: { reden: 'zelfde soort bron als keuringStuk' },
  keuringDubbeling: { reden: 'vraagt dezelfde functienaam in drie kernmodules; dat is een verplaatsing van productcode, geen tijdelijk bestand' },
  keuringDekkingAdvies: { reden: 'zelfde bron als endpointsZonderTest' },
  routesNietSchakelbaar: { reden: 'vraagt een nieuwe route die niet in de boardroom staat; die moet je echt monteren' },
  onbewaakt: { reden: 'komt uit scripts/samenhang.js, die over soorten dingen gaat en niet over een enkel bestand' },
  endpointsNooitAangeraakt: { reden: 'komt uit het routejournaal van een hele testronde' },
  dekkingWaargenomenPct: { reden: 'komt uit het routejournaal van een hele testronde' },
  p99Ms: { reden: 'prestatiecijfer uit een echte beproeving op een echte machine' },
  doorvoerPerSec: { reden: 'prestatiecijfer uit een echte beproeving' },
  eventLoopP99Ms: { reden: 'prestatiecijfer uit een echte beproeving' },
  herstelSeconden: { reden: 'prestatiecijfer uit een echte beproeving' },
  verhalenSlaagPctStorm: { reden: 'prestatiecijfer uit een echte beproeving' },
  geheugenHellingMBPerMin: { reden: 'prestatiecijfer uit een echte beproeving' }
};

test('elke geijkte meter slaat echt uit op een bekend-foute invoer', () => {
  const voor = norm.meet();
  const geijkt = Object.keys(IJKINGEN).filter(k => IJKINGEN[k].proef);
  assert.ok(geijkt.length >= 5, 'er zijn ijkingen om te draaien (' + geijkt.length + ')');

  for (const sleutel of geijkt) {
    const verschil = IJKINGEN[sleutel].proef(voor);
    assert.ok(verschil > 0,
      'meter "' + sleutel + '" zag de bekend-foute invoer NIET (verschil ' + verschil + '). ' +
      'Een meter die niet uitslaat op iets wat fout is, meet niets.');
  }
});

test('de ijking ruimt zichzelf op: geen enkel spoor blijft achter', () => {
  for (const naam of ['test/zz-ijk-tijdelijk.test.js', 'test/zz-ijk-tijdelijk.e2e.js',
    'server/kern/zz-ijk-tijdelijk.js']) {
    assert.equal(fs.existsSync(path.join(WORTEL, naam)), false, naam + ' is blijven staan');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'package.json heeft weer nul dependencies');
});

test('elke meter uit scripts/norm.js staat in de registratie', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/norm.js'), 'utf8');
  const sleutels = [...bron.matchAll(/sleutel:\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
  assert.ok(sleutels.length >= 15, 'de meters zijn gevonden in norm.js (' + sleutels.length + ')');
  const ontbreekt = sleutels.filter(s => !IJKINGEN[s]);
  assert.deepEqual(ontbreekt, [],
    'deze meters hebben geen ijking en geen reden: ' + ontbreekt.join(', ') +
    '. Voeg een proef toe, of een reden waarom die niet kan.');
});

test('elke registratie heeft OF een proef OF een reden, nooit allebei leeg', () => {
  for (const [sleutel, ijk] of Object.entries(IJKINGEN)) {
    assert.ok(ijk.proef || ijk.reden, 'meter "' + sleutel + '" heeft niets');
    assert.ok(!(ijk.proef && ijk.reden), 'meter "' + sleutel + '" heeft er twee; kies');
    if (ijk.reden) assert.ok(ijk.reden.length > 25,
      'de reden bij "' + sleutel + '" is te kort om iets uit te leggen');
  }
});

module.exports = { IJKINGEN };
