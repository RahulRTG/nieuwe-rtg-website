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

/* Een journaal met alle routes op een na, en wat scripts/dekking.js daarvan
   maakt. Eenmaal gemeten en daarna bewaard: de routekaart starten kost een
   halve minuut en beide journaalmeters hebben aan dezelfde meting genoeg. */
const _gaten = new Map();
function journaalMetGat(weglaten) {
  const n = weglaten || 1;
  if (_gaten.has(n)) return _gaten.get(n);
  const os = require('os');
  const { execFileSync, spawnSync } = require('child_process');
  const kaart = JSON.parse(execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 }));
  const routes = (kaart.routes || []).filter(r => r && r.pad && r.pad.startsWith('/api/'));
  assert.ok(routes.length > 100, 'de routekaart geeft routes (' + routes.length + ')');

  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ijk-journaal-'));
  const bestand = path.join(map, 'journaal.txt');
  try {
    // alles behalve de laatste n; die horen straks als "nooit aangeraakt" te tellen
    const regels = routes.slice(0, routes.length - n).map(r => (r.methode || 'POST').toUpperCase() + ' ' + r.pad);
    fs.writeFileSync(bestand, regels.join('\n') + '\n');
    const r = spawnSync(process.execPath,
      ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'dekking.js'), '--lees', bestand, '--json'],
      { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    let d = null;
    try { d = JSON.parse(r.stdout); } catch (e) { d = null; }
    assert.ok(d, 'dekking.js gaf een leesbaar rapport: ' +
      String(r.stderr || r.stdout || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 240));
    const uit = { nooit: Number(d.nooitAangeraakt), pct: Number(d.pct), totaal: routes.length };
    assert.ok(Number.isFinite(uit.nooit) && Number.isFinite(uit.pct),
      'dekking.js gaf de twee cijfers terug: ' + JSON.stringify(d).slice(0, 160));
    _gaten.set(n, uit);
    return uit;
  } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }
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
  schermenZonderToets: {
    /* De meter achter LAT-regel 2 voor de schermkant: "af" is pas af als een
       toets de hele weg heeft afgelegd. Het journaal komt uit een echte
       e2e-ronde en is hier niet te maken, maar de INVENTARIS wel -- en dat is
       precies de kant waarlangs een nieuw scherm binnenkomt: iemand zet een
       app neer, niemand opent hem, en het getal hoort meteen op te lopen. */
    proef: () => {
      const schermen = require('../scripts/schermen.js');

      /* Eerst de scherpte van de meter zelf: een scherm dat ALLEEN door een
         veegtoets is aangeraakt mag niet als getoetst tellen. Dat is precies
         waar de eerste versie van deze meter op stukliep -- hij gaf 188 van
         188 omdat leven.e2e.js alles even aantikt. */
      const veegJournaal = new Map();
      for (let i = 0; i < 50; i++) veegJournaal.set('/apps/z' + i + '.html', new Set(['leven.e2e.js']));
      veegJournaal.get('/apps/z0.html').add('eigen.e2e.js');
      const vegers = schermen.veegToetsen(veegJournaal, 50);
      assert.ok(vegers.has('leven.e2e.js'), 'een toets die alle schermen aantikt geldt als veegtoets');
      assert.ok(!vegers.has('eigen.e2e.js'), 'een toets die er een aantikt geldt niet als veegtoets');

      /* En dan de inventaris: een NIEUW scherm dat niemand opent hoort meteen
         mee te tellen. Dat is de kant waarlangs dit gat in de praktijk groeit:
         iemand zet een app neer en niemand komt er ooit. */
      const journaal = new Set(schermen.alleSchermen());        // alsof alles geopend is
      const tel = () => schermen.alleSchermen().filter(s => !journaal.has(s)).length;
      const voor = tel();
      assert.equal(voor, 0, 'met een journaal dat alles bevat staat de meter op nul');
      return metTijdelijkBestand('public/apps/zz-ijk-tijdelijk.html',
        '<!doctype html>\n<title>ijk</title>\n', () => tel() - voor);
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
  keuringStuk: {
    /* Een route die een ECHTE naam meestuurt in zijn antwoord. Dat is de
       zwaarste bevinding die de keuring kent, en niet toevallig: dit huis
       draait op codenamen en de echte naam hoort in de kluis. De proef zet
       precies dat neer -- en meet daarmee ook dat de keuring die vorm nog
       herkent. */
    proef: (voor) => metTijdelijkBestand('server/routes/zz-ijk-tijdelijk.js',
      'module.exports = (kern) => {\n' +
      '  const { app } = kern;\n' +
      '  app.post(\'/api/zz-ijk/proef\', (req, res) => res.json({ realName: \'Jan Jansen\' }));\n' +
      '};\n',
      () => norm.meet().keuringStuk - voor.keuringStuk)
  },
  keuringScheef: {
    /* Een tekst die zegt dat een boeking bevestigd is. Dat mag dit huis nooit
       beweren (CLAUDE.md), en de keuring hoort die zin te vinden waar hij ook
       staat. */
    proef: (voor) => metTijdelijkBestand('server/kern/zz-ijk-tijdelijk.js',
      /* De zin moet in een STRING staan en niet in losse HTML-tekst: de keuring
         kijkt naar wat een gebruiker echt te zien krijgt, en dat is tekst
         tussen aanhalingstekens op een regel die geen commentaar is. Een eerste
         poging met een <p> in een htmlbestand sloeg daarom niet aan -- de
         reden hier stond ("zelfde soort bron als keuringStuk") was te vaag om
         dat te zien. */
      '/* tijdelijk ijkbestand */\n' +
      'module.exports = () => ({ melding: \'Uw boeking is bevestigd en staat klaar.\' });\n',
      () => norm.meet().keuringScheef - voor.keuringScheef)
  },
  keuringDubbeling: { reden: 'vraagt dezelfde functienaam in drie kernmodules; dat is een verplaatsing van productcode, geen tijdelijk bestand' },
  keuringDekkingAdvies: { reden: 'zelfde bron als endpointsZonderTest' },
  routesNietSchakelbaar: {
    /* Een route die nergens in het schakelbord staat. Dat is precies wat deze
       meter telt, en het blijkt met een tijdelijk routebestand gewoon te
       voeden -- de reden die hier stond ("die moet je echt monteren") klopte
       niet: server/routes/ wordt automatisch geladen. */
    proef: (voor) => metTijdelijkBestand('server/routes/zz-ijk-tijdelijk.js',
      'module.exports = (kern) => {\n' +
      '  const { app } = kern;\n' +
      '  app.post(\'/api/zz-ijk/proef\', (req, res) => res.json({ ok: true }));\n' +
      '};\n',
      () => norm.meet().routesNietSchakelbaar - voor.routesNietSchakelbaar)
  },
  onbewaakt: { reden: 'komt uit scripts/samenhang.js, die over soorten dingen gaat en niet over een enkel bestand' },
  endpointsNooitAangeraakt: {
    /* HET JOURNAAL MET EEN GAT ERIN. De reden die hier stond ("komt uit het
       routejournaal van een hele testronde") klopte half: het cijfer komt
       daaruit, maar scripts/dekking.js leest met --lees elk journaal dat je
       hem geeft. Dus bouwen we er zelf een: alle routes van de routekaart,
       precies EEN weggelaten. De meter hoort die ene te missen.

       Een kleiner journaal kan niet: dekking.js weigert er zelf een met te
       weinig patronen, met de melding dat dat geen meting is maar een kapotte
       opstelling. Dat is dezelfde LAT-regel 3 die deze ijking bewaakt, en het
       is precies goed dat hij hier in de weg zit. */
    proef: () => journaalMetGat(1).nooit
  },
  dekkingWaargenomenPct: {
    /* HET PERCENTAGE IS GROVER DAN ZIJN BUURMAN, en dat is hier zwart op wit te
       zien: met EEN weggelaten route van ruim tweeduizend rondt hij nog gewoon
       op honderd af. Precies wat de kop van scripts/dekking.js waarschuwt --
       "een afgerond percentage dekt bij 2530 routes tot een stuk of twaalf
       endpoints die nooit zijn aangeraakt". Deze proef laat er daarom vijftig
       weg. Dat hij dan pas uitslaat is geen tekortkoming van de ijking maar de
       eigenschap van de meter, en de reden dat endpointsNooitAangeraakt
       ernaast staat als de scherpe van de twee. */
    proef: () => 100 - journaalMetGat(50).pct
  },
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
    'server/kern/zz-ijk-tijdelijk.js', 'public/apps/zz-ijk-tijdelijk.html']) {
    assert.equal(fs.existsSync(path.join(WORTEL, naam)), false, naam + ' is blijven staan');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'package.json heeft weer nul dependencies');
});

test('elke meter met een norm staat in de registratie', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/norm.js'), 'utf8');
  const sleutels = [...bron.matchAll(/sleutel:\s*'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
  /* Niet elke meter woont in norm.js: wie een journaal nodig heeft (dekking,
     schermen, samenhang) meet in een eigen script met zijn sleutel in een
     METER-constante. Die stonden hier eerst buiten, en juist zo glipt een
     ongeijkte meter erdoor. Zelfde vindwijze als check.js regel 35. */
  for (const b of fs.readdirSync(path.join(WORTEL, 'scripts')).filter(f => f.endsWith('.js') && f !== 'norm.js')) {
    const s = fs.readFileSync(path.join(WORTEL, 'scripts', b), 'utf8');
    for (const m of s.matchAll(/^const METER[A-Z_]*\s*=\s*'([a-zA-Z0-9]+)'/gm)) {
      if (!sleutels.includes(m[1])) sleutels.push(m[1]);
    }
  }
  assert.ok(sleutels.length >= 15, 'de meters zijn gevonden (' + sleutels.length + ')');
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
