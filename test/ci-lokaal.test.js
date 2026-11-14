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

test('artifact dependency starts after download and never leaks into another job', () => {
  const gates = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'jobs:', '  first:', '    steps:',
    '      - run: node scripts/document-fitness.js',
    '      - uses: actions/download-artifact@fixture',
    '      - run: node scripts/check.js',
    '  second:', '    steps:', '      - run: node scripts/check.js'
  ].join('\n')).filter(g => g.soort === 'toets');
  assert.deepEqual(gates.map(g => g.artefact), [false, true, false]);
  assert.equal(W.oordeel(gates[0]).lokaal, true);
  assert.equal(W.oordeel(gates[1]).soortReden, 'artefact');
  assert.equal(W.oordeel(gates[2]).lokaal, true);
});

test('onopgeloste stapcontext draait lokaal niet met een verzonnen lege waarde', () => {
  const gates = W.poortenVan('fixture.yml', [
    'on:', '  workflow_dispatch:', 'jobs:', '  bewijs:', '    steps:',
    '      - name: Alleen handmatig binden',
    "        if: github.event_name == 'workflow_dispatch'",
    '        env:', '          RTG_EXPECTED_COMMIT: ${{ inputs.verwachte_commit }}',
    '        run: node scripts/evidence-control.js bind-source'
  ].join('\n')).filter(g => g.soort === 'toets');
  assert.equal(gates.length, 1);
  assert.equal(gates[0].voorwaarde, "github.event_name == 'workflow_dispatch'");
  assert.equal(W.oordeel(gates[0]).soortReden, 'ketenwaarde');
  assert.deepEqual(W.stapOmgeving(gates[0]), {});
});

test('een geheim blijft een geheim en wordt niet als gewone ketenwaarde afgezwakt', () => {
  const gate = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'jobs:', '  bewijs:', '    steps:',
    '      - env:', '          TOKEN: ${{ secrets.DEPLOY_TOKEN }}',
    '        run: node scripts/check.js'
  ].join('\n')).find(g => g.soort === 'toets');
  assert.equal(gate.geheim, true);
  assert.equal(W.oordeel(gate).soortReden, 'geheim');
});

test('uitvoer van een voorafgaande action is geen lokaal bestaand bewijsstuk', () => {
  const gates = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'jobs:', '  analyse:', '    steps:',
    '      - uses: voorbeeld/analyse@vast',
    '        with:', '          output: analyse-resultaten',
    '      - run: node scripts/check.js --dir=analyse-resultaten',
    '      - run: node scripts/document-fitness.js'
  ].join('\n')).filter(g => g.soort === 'toets');
  assert.equal(gates[0].actieUitvoer, 'analyse-resultaten');
  assert.equal(W.oordeel(gates[0]).soortReden, 'actie-uitvoer');
  assert.equal(gates[1].actieUitvoer, null);
  assert.equal(W.oordeel(gates[1]).lokaal, true);
});

test('een matrixherleiding laat geen onopgeloste stapomgeving vallen', t => {
  for (const waarde of ['${{ inputs.candidate }}', '${{ matrix.variant }}', '${{ secrets.TOKEN }}', 'vast']) {
    const gates = W.poortenVan('fixture.yml', [
      'on:', '  pull_request:', 'jobs:', '  bewijs:', '    steps:',
      '      - run: node scripts/check.js --deel=${{ matrix.scherf }}/4',
      '        env:', '          RTG_PROEF: ' + waarde
    ].join('\n'));
    const stub = t.mock.method(W, 'poorten', () => gates);
    try {
      const [rij] = lokaal.plan({ gedekt: new Set() });
      assert.equal(rij.stand, waarde === 'vast' ? 'draait' : 'niet-lokaal', waarde);
      assert.equal(rij.herleid, waarde === 'vast', waarde);
      if (waarde === 'vast') assert.deepEqual(rij.omgeving, { RTG_PROEF: 'vast' });
      else assert.match(rij.opdracht, /matrix\.scherf/);
    } finally { stub.mock.restore(); }
  }
});

test('overgeerfde keteninvoer blokkeert herleiding totdat de stap haar concreet overschrijft', t => {
  for (const stapWaarde of [null, 'vast']) {
    const [gat] = W.poortenVan('fixture.yml', [
      'on:', '  pull_request:', 'env:',
      '  RTG_PROEF: ${{ inputs.workflow }}', '  WORKFLOW_ONLY: workflow',
      'jobs:', '  bewijs:', '    env:',
      '      RTG_PROEF: ${{ inputs.job }}', '      JOB_ONLY: job',
      '    steps:', '      - run: node scripts/check.js --deel=${{ matrix.scherf }}/4',
      ...(stapWaarde ? ['        env:', '          RTG_PROEF: ' + stapWaarde] : [])
    ].join('\n'));
    assert.equal(gat.env.RTG_PROEF, stapWaarde || '${{ inputs.job }}');
    assert.equal(gat.env.WORKFLOW_ONLY, 'workflow');
    assert.equal(gat.env.JOB_ONLY, 'job');
    const stub = t.mock.method(W, 'poorten', () => [gat]);
    try {
      const [rij] = lokaal.plan({ gedekt: new Set() });
      assert.equal(rij.stand, stapWaarde ? 'draait' : 'niet-lokaal');
      assert.equal(rij.herleid, !!stapWaarde);
      assert.equal(rij.omgeving.RTG_PROEF, stapWaarde || undefined);
    } finally { stub.mock.restore(); }
  }
});

test('infrastructuur uit werkstroom en job bereikt de voorzieningen van de stap', () => {
  const [gat] = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'env:', '  DATABASE_URL: postgres://localhost/workflow',
    'jobs:', '  bewijs:', '    env:', '      REDIS_URL: redis://localhost:6379',
    '    steps:', '      - run: node scripts/check.js',
    '        env:', '          DATABASE_URL: postgres://localhost/stap'
  ].join('\n'));
  assert.deepEqual(gat.voorzieningen, ['postgres', 'redis']);
  assert.deepEqual(W.stapOmgeving(gat), {
    DATABASE_URL: 'postgres://localhost/stap', REDIS_URL: 'redis://localhost:6379'
  });
});

test('actionuitvoer herkent een pad en geen toevallig stuk van een ander argument', () => {
  for (const [opdracht, verwacht] of [
    ['node scripts/check.js', false],
    ['node scripts/check.js --dir=checker', false],
    ['node scripts/check.js --dir=other/check', false],
    ['node scripts/check.js --dir=check', true],
    ['node scripts/check.js --dir="./check/rapport.json"', true]
  ]) {
    const [gat] = W.poortenVan('fixture.yml', [
      'on:', '  pull_request:', 'jobs:', '  bewijs:', '    steps:',
      '      - uses: voorbeeld/analyse@vast', '        with:', '          output: check',
      '      - run: ' + opdracht
    ].join('\n'));
    assert.equal(W.oordeel(gat).lokaal, !verwacht, opdracht);
  }
});

test('actionuitvoer in de stapomgeving blijft een ontbrekende invoer', () => {
  const [gat] = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'jobs:', '  bewijs:', '    steps:',
    '      - uses: voorbeeld/analyse@vast', '        with:', '          output: rapport[1]',
    '      - run: node scripts/check.js',
    '        env:', '          RESULTS_DIR: ./rapport[1]/uitvoer.json'
  ].join('\n'));
  assert.equal(W.oordeel(gat).soortReden, 'actie-uitvoer');
});

test('actionuitvoer geldt alleen na de producerende stap en binnen dezelfde job', () => {
  const gates = W.poortenVan('fixture.yml', [
    'on:', '  pull_request:', 'jobs:', '  eerste:', '    steps:',
    '      - run: node scripts/check.js --dir=rapport',
    '      - uses: voorbeeld/analyse@vast', '        with:', '          output: rapport',
    '      - run: node scripts/check.js --dir=rapport/uitvoer.json',
    '  tweede:', '    steps:', '      - run: node scripts/check.js --dir=rapport'
  ].join('\n'));
  assert.deepEqual(gates.map(g => W.oordeel(g).lokaal), [true, false, true]);
});

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

test('een Bash-array aanvullen is inrichting en maskeert geen volgende poort', () => {
  const uit = W.opdrachtenUit('registers+=("$naam")\nnode scripts/check.js\nkwispel --hard');
  assert.deepEqual(uit.map(x => W.soortVan(x.opdracht)), ['inrichting', 'toets', 'onbekend']);
  assert.equal(W.soortVan('registers+broken'), 'onbekend');
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
  assert.equal(W.oordeel({ ...grond, actieUitvoer: 'analyse-resultaten' }).soortReden, 'actie-uitvoer');
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

/* ============================================================================
   HET OORDEEL HEEFT DRIE UITKOMSTEN, EN DE DERDE IS DE REDEN DAT HIJ ER IS.

   Op 15 september 2026 las een lezer van deze uitvoer "geen poort gezakt" als
   bewijs, terwijl er een stapel poorten niet had gedraaid. De uitvoer zei het
   goede ("niet gedraaid: N -- en dat is geen groen") en de exitcode zei het
   tegenovergestelde. Dezelfde fout maakte de keten die dag met een GEANNULEERDE
   run: nul gezakte jobs, en dus "niets rood".

   Afwezigheid van falen is geen bewijs. Niet gemeten is geen goede uitslag
   (LAT.md regel 12), en een poort bewijst alleen zijn eigen bereik (regel 17).
   ========================================================================== */
test('een gezakte poort wint van alles: de stand is GEZAKT', () => {
  assert.equal(lokaal.oordeelVan(1, 0, 0), 'GEZAKT');
  assert.equal(lokaal.oordeelVan(1, 9, 9), 'GEZAKT', 'ook als er van alles niet draaide');
});

test('niets gezakt maar niet alles gedraaid is ONBEWEZEN -- niet groen en niet rood', () => {
  assert.equal(lokaal.oordeelVan(0, 1, 0), 'ONBEWEZEN');
  assert.equal(lokaal.oordeelVan(0, 33, 0), 'ONBEWEZEN');
});

/* Een poort die alleen bij GitHub bestaat, is hier net zo goed geen uitspraak.
   Zou die niet meetellen, dan heet een lokale ronde "bewezen" terwijl de helft
   van de keten er niet in zat. */
test('een poort die alleen in de keten draait telt ook als ONBEWEZEN', () => {
  assert.equal(lokaal.oordeelVan(0, 0, 1), 'ONBEWEZEN');
});

test('BEWEZEN is alleen BEWEZEN als er niets ontbreekt en niets viel', () => {
  assert.equal(lokaal.oordeelVan(0, 0, 0), 'BEWEZEN');
});
