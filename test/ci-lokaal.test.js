/* ============================================================================
   DE LOKALE KETEN -- draait hier wat de CI straks draait?

   Deze toetsen bewaken twee dingen die uit elkaar kunnen lopen zonder dat
   iemand het merkt: de AFLEIDING (leest scripts/lib/werkstroom.js de
   werkstromen goed genoeg om ze na te spelen) en de KOPPELING (draait de
   gewone ronde die afleiding uberhaupt aan). Elke bewering hieronder is met
   een mutatie zien zakken -- eerst het verboden geval, dan het toegestane.
   ========================================================================== */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const W = require('../scripts/lib/werkstroom');
const lokaal = require('../scripts/ci-lokaal');

test('de ontleder leest een werkstroom: jobs, stappen, blokschalen en regelnummers', () => {
  const doc = W.ontleed([
    'name: Proef',
    'on:',
    '  pull_request:',
    'jobs:',
    '  keuren:',
    '    name: De keuring',
    '    services:',
    '      postgres:',
    '        image: postgres:16-alpine',
    '    steps:',
    '      - uses: actions/checkout@abc # v7',
    '      - name: Twee dingen',
    '        run: |',
    '          npm run check',
    '          node scripts/ast-scan.js',
    '        env:',
    '          RTG_IETS: "1"'
  ].join('\n'));

  assert.equal(doc.name, 'Proef');
  assert.deepEqual(Object.keys(doc.on), ['pull_request']);
  assert.deepEqual(Object.keys(doc.jobs), ['keuren']);
  assert.equal(doc.jobs.keuren.services.postgres.image, 'postgres:16-alpine');
  assert.equal(doc.jobs.keuren.steps.length, 2);
  /* Het commentaar achter de sha hoort er niet meer aan te zitten, de sha wel. */
  assert.equal(doc.jobs.keuren.steps[0].uses, 'actions/checkout@abc');
  assert.equal(doc.jobs.keuren.steps[1].run, 'npm run check\nnode scripts/ast-scan.js');
  assert.equal(doc.jobs.keuren.steps[1].env.RTG_IETS, '1');
  /* Het regelnummer is wat een melding bruikbaar maakt: de stap begint op 12. */
  assert.equal(doc.jobs.keuren.steps[1].__regel, 12);
});

test('een poort verstopt zich niet achter shell: if/then, een pijp of een heredoc', () => {
  const uit = W.opdrachtenUit([
    'set -o pipefail',
    'uitslag=0',
    'npm run e2e -- --deel=1/4 2>&1 | tee /tmp/e2e.log || uitslag=$?',
    'if [ "$uitslag" -ne 0 ]; then node scripts/gezakte-toetsen.js /tmp/e2e.log; fi',
    'cat <<EINDE',
    'node scripts/dit-is-tekst.js',
    'EINDE',
    'exit "$uitslag"'
  ].join('\n')).map(o => o.opdracht);

  assert.ok(uit.includes('npm run e2e -- --deel=1/4 2>&1'), uit.join(' | '));
  assert.ok(uit.includes('node scripts/gezakte-toetsen.js /tmp/e2e.log'), uit.join(' | '));
  /* De tekst van een heredoc is INVOER en geen opdracht. Zonder die grens leest
     de meter een issue-bericht regel voor regel als shell. */
  assert.ok(!uit.some(o => o.includes('dit-is-tekst')), uit.join(' | '));
});

test('een string over meerdere regels blijft EEN opdracht', () => {
  const uit = W.opdrachtenUit([
    'KLASSE="$(node -e \'',
    '  const t = process.argv[1];',
    '  console.log(t ? "ok" : "mens");',
    '\' "$TITEL")"'
  ].join('\n'));
  assert.equal(uit.length, 1);
  assert.match(uit[0].opdracht, /^KLASSE=/);
});

test('`|| true` maakt een poort informatief: de keten zakt er zelf niet op', () => {
  const uit = W.opdrachtenUit('npm audit || true');
  assert.equal(uit[0].informatief, true);
  assert.equal(W.opdrachtenUit('npm audit --audit-level=high')[0].informatief, false);
});

/* DE FAIL-CLOSED KANT. Wat de meter niet kent, hoort ONBEKEND te heten en
   gemeld te worden -- niet stil te verdwijnen. Zonder deze eigenschap zou een
   nieuwe poort in de keten lokaal kunnen ontbreken zonder dat iets zakt, en dat
   is precies de drift waar dit hele bestand tegen is. */
test('wat de meter niet herkent heet onbekend en niet inrichting', () => {
  assert.equal(W.soortVan('npm ci'), 'inrichting');
  assert.equal(W.soortVan('sudo apt-get install -y libxml2-utils'), 'inrichting');
  assert.equal(W.soortVan('npm run check'), 'toets');
  assert.equal(W.soortVan('node scripts/ladder.js'), 'toets');
  assert.equal(W.soortVan('kwispel --hard'), 'onbekend');
});

test('het doel is de eenheid: drie scherven en de hele suite wijzen naar EEN script', () => {
  const s = { test: 'node scripts/test-runner.js', 'test:deel': 'node scripts/test-runner.js',
    'overleving:controle': 'node scripts/overleving.js --controle', secrets: 'node scripts/geheimen.js' };
  assert.equal(W.doelVan('npm test', s).doel, 'scripts/test-runner.js');
  assert.equal(W.doelVan('npm run test:deel -- --deel=2/4 --zonder-ijkingen', s).doel, 'scripts/test-runner.js');
  assert.equal(W.doelVan('npm run overleving:controle', s).doel, 'scripts/overleving.js');
  assert.equal(W.doelVan('npm run secrets', s).doel, 'scripts/geheimen.js');
  /* Wat geen eigen script is, houdt zijn eigen naam -- `npm audit` is een poort. */
  assert.equal(W.doelVan('npm audit --audit-level=high', s).doel, 'npm audit');
});

test('een poort die hier niet kan draaien, draagt altijd de reden', () => {
  const grond = { soort: 'toets', doel: 'scripts/check.js', opdracht: 'npm run check',
    artefact: false, geheim: false, ketenwaarde: false };
  assert.equal(W.oordeel(grond).lokaal, true);
  assert.equal(W.oordeel({ ...grond, artefact: true }).soortReden, 'artefact');
  assert.equal(W.oordeel({ ...grond, geheim: true }).soortReden, 'geheim');
  assert.equal(W.oordeel({ ...grond, ketenwaarde: true }).soortReden, 'ketenwaarde');
  assert.equal(W.oordeel({ ...grond, opdracht: 'node scripts/toetsduur.js $gevonden' }).soortReden, 'variabele');
  /* En het geval dat een DEFECT is in plaats van een eigenschap. */
  const weg = W.oordeel({ ...grond, doel: 'scripts/bestaat-niet-echt.js' });
  assert.equal(weg.soortReden, 'doel-weg');
  for (const geval of [{ artefact: true }, { geheim: true }, { ketenwaarde: true }])
    assert.ok(W.oordeel({ ...grond, ...geval }).reden, 'een reden mag nooit leeg zijn');
});

/* ============================================================================
   DE ZELFIJKING -- komt een NIEUWE poort er vanzelf bij?

   Dit is de bewering waar het hele bestand op staat: er is geen lijst die
   iemand moet bijwerken. De toets zet daarom een werkstroom neer die hier
   nergens genoemd wordt, en eist dat hij in het plan verschijnt.
   ========================================================================== */
test('een poort die morgen aan de keten wordt toegevoegd, staat morgen in de lokale ronde', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkstroom-'));
  try {
    fs.writeFileSync(path.join(map, 'nieuw.yml'), [
      'name: Iets nieuws',
      'on:',
      '  pull_request:',
      'jobs:',
      '  nieuw:',
      '    steps:',
      '      - run: npm ci',
      '      - name: De nieuwe poort',
      '        run: node scripts/wetten.js --controle'
    ].join('\n') + '\n');

    const rijen = lokaal.plan({ map, gedekt: new Set() });
    const nieuw = rijen.find(r => r.gat.werkstroom === 'nieuw.yml');
    assert.ok(nieuw, 'de nieuwe poort hoort in het plan te staan zonder dat er ergens een lijst is bijgewerkt');
    assert.equal(nieuw.stand, 'draait');
    assert.equal(nieuw.opdracht, 'node scripts/wetten.js --controle');
    /* En `npm ci` is inrichting: die hoort er juist NIET in te staan. */
    assert.equal(rijen.filter(r => r.gat.werkstroom === 'nieuw.yml').length, 1);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

/* ============================================================================
   DE KOPPELING -- draait de gewone ronde de afleiding aan?

   Zonder deze stap is scripts/ci-lokaal.js een script dat je met de hand moet
   aanroepen, en dan is het net zo vergeetbaar als de lijst die het vervangt.
   ========================================================================== */
test('de Slotsuite draait de poorten van de keten mee', () => {
  assert.equal(lokaal.slotsuiteRoeptOns(), true);
  /* En de toets kan zakken: zonder die stap in de lagen is het antwoord nee. */
  assert.equal(lokaal.slotsuiteRoeptOns([{ stappen: [['huisregels', ['node', ['scripts/check.js']]]] }]), false);
});

test('de gewone ronde kent haar eigen doelen, zodat de keten ze niet dubbel draait', () => {
  const doelen = lokaal.gewoneRonde();
  for (const doel of ['scripts/check.js', 'scripts/test-runner.js', 'scripts/a11y.js', 'scripts/build.js'])
    assert.ok(doelen.has(doel), doel + ' hoort in de gewone ronde te zitten');
});

test('een opdracht wordt uitgevoerd zonder de shell-omleidingen als argument', () => {
  assert.deepEqual(lokaal.woorden('npm run e2e -- --deel=1/4 2>&1'), ['npm', 'run', 'e2e', '--', '--deel=1/4']);
  assert.deepEqual(lokaal.woorden('git diff --exit-code -- public server scripts'),
    ['git', 'diff', '--exit-code', '--', 'public', 'server', 'scripts']);
});

/* ============================================================================
   DE ECHTE WERKSTROMEN
   ========================================================================== */
test('elke opdracht in de echte keten is herkend, en elk doel bestaat', () => {
  const onbekend = W.poorten().filter(g => g.soort === 'onbekend');
  assert.deepEqual(onbekend.map(g => g.werkstroom + ':' + g.regel + ' ' + g.opdracht), []);
  const weg = W.poorten().filter(g => g.soort === 'toets' && W.oordeel(g).soortReden === 'doel-weg');
  assert.deepEqual(weg.map(g => g.werkstroom + ':' + g.regel + ' ' + g.doel), []);
});

test('elke poort van de merge-keten draait hier of zegt waarom niet', () => {
  const poorten = W.poorten().filter(g => g.soort === 'toets' && (g.aanleiding || []).includes('pull_request'));
  assert.ok(poorten.length > 20, 'de merge-keten hoort tientallen poorten te hebben, niet ' + poorten.length);
  for (const gat of poorten) {
    const o = W.oordeel(gat);
    if (!o.lokaal) assert.ok(o.reden && o.reden.length > 10,
      gat.werkstroom + ':' + gat.regel + ' (' + gat.opdracht + ') kan hier niet draaien en zegt niet waarom');
  }
});
