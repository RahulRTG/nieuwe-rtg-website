const test = require('node:test');
const assert = require('node:assert/strict');
const { losseActions } = require('../scripts/ci-keten');

test('de CI-keten weigert tags en accepteert alleen lokale acties of 40-hex SHA', () => {
  const sha = 'a'.repeat(40);
  const tekst = [
    '  - uses: actions/checkout@v7',
    `  - uses: actions/checkout@${sha} # v7`,
    '  - uses: ./eigen-action'
  ].join('\n');
  assert.deepEqual(losseActions(tekst, 'ci.yml'), ['ci.yml:1 actions/checkout@v7']);
});

/* DE DRIE REGELS DIE ER OP 31 AUGUSTUS 2026 BIJ KWAMEN. Elke toets hieronder
   is ZIEN ZAKKEN met de echte werkstromen ernaast: eerst het verboden geval
   (moet melden), dan het toegestane (moet zwijgen). Een keuring waarvan
   niemand de rode kant heeft gezien, is geen keuring -- LAT.md regel 11. */
const { checkoutMetCredential, overgetypteRuntime,
  installatieBuitenLockfile, controleer } = require('../scripts/ci-keten');
const path = require('node:path');

test('een checkout zonder persist-credentials: false wordt gemeld', () => {
  const sha = 'a'.repeat(40);
  const kaal = [
    `      - uses: actions/checkout@${sha} # v7`,
    '      - uses: actions/setup-node@' + 'b'.repeat(40),
    '        with:',
    '          persist-credentials: false'   // hoort NIET bij de checkout
  ].join('\n');
  assert.deepEqual(checkoutMetCredential(kaal, 'ci.yml'),
    ['ci.yml:1 checkout zonder persist-credentials: false']);

  const goed = [
    `      - uses: actions/checkout@${sha} # v7`,
    '        with:',
    '          persist-credentials: false',
    '          fetch-depth: 0'
  ].join('\n');
  assert.deepEqual(checkoutMetCredential(goed, 'ci.yml'), []);
});

/* DE OPMAAK MAG DE KEURING NIET UITZETTEN. Een stap die met `- name:` opent
   heeft geen streepje voor zijn `uses:`; de eerste versie van deze regel eiste
   dat streepje wel en miste daardoor precies een checkout in dit huis -- die
   van takken.yml, het enige bestand dat werkelijk push-recht vraagt. */
test('een checkout onder een `- name:` telt net zo hard mee', () => {
  const sha = 'a'.repeat(40);
  const kaal = [
    '      - name: De repo',
    `        uses: actions/checkout@${sha} # v7`,
    '        with:',
    '          fetch-depth: 0'
  ].join('\n');
  assert.deepEqual(checkoutMetCredential(kaal, 'takken.yml'),
    ['takken.yml:2 checkout zonder persist-credentials: false']);

  const goed = [
    '      - name: De repo',
    `        uses: actions/checkout@${sha} # v7`,
    '        with:',
    '          fetch-depth: 0',
    '          persist-credentials: false'
  ].join('\n');
  assert.deepEqual(checkoutMetCredential(goed, 'takken.yml'), []);

  /* En het blok houdt nog steeds op bij de volgende stap: een
     persist-credentials van de BUURSTAP redt deze checkout niet. */
  const buurman = [
    '      - name: De repo',
    `        uses: actions/checkout@${sha} # v7`,
    '      - name: Nog een checkout',
    `        uses: actions/checkout@${sha} # v7`,
    '        with:',
    '          persist-credentials: false'
  ].join('\n');
  assert.deepEqual(checkoutMetCredential(buurman, 'takken.yml'),
    ['takken.yml:2 checkout zonder persist-credentials: false']);
});

test('een overgetypte node-versie wordt gemeld, een matrix niet', () => {
  assert.deepEqual(overgetypteRuntime("          node-version: '26'", 'ci.yml').length, 1);
  assert.deepEqual(overgetypteRuntime("          node-version-file: '.nvmrc'", 'ci.yml'), []);
  assert.deepEqual(overgetypteRuntime('          node-version: ${{ matrix.node }}', 'ci.yml'), []);
});

test('een installatie buiten de lockfile om wordt gemeld, npm ci niet', () => {
  assert.equal(installatieBuitenLockfile('          npm i --no-save playwright@^1.49.0', 'ci.yml').length, 1);
  assert.equal(installatieBuitenLockfile('      - run: npm ci', 'ci.yml').length, 0);
  assert.equal(installatieBuitenLockfile('          npx playwright install chromium', 'ci.yml').length, 0);
  /* Commentaar is geschiedenis en geen commando: deze bestanden leggen juist
     vast welke fout er ooit stond, en daar mag de keuring niet op zakken. */
  assert.equal(installatieBuitenLockfile('      # hier stond `npm i --no-save playwright`', 'ci.yml').length, 0);
});

test('de echte werkstromen voldoen aan alle vier de regels', () => {
  const map = path.join(__dirname, '..', '.github', 'workflows');
  assert.deepEqual(controleer(map), []);
});

test('handmatige full-run en beschermd eindoordeel zijn fail-closed bedraad', () => {
  const fs = require('node:fs');
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ci.yml'), 'utf8');
  const blok = naam => {
    const m = workflow.match(new RegExp('^  ' + naam + ':\\n([\\s\\S]*?)(?=^  [a-zA-Z][\\w-]*:|$(?![\\s\\S]))', 'm'));
    assert.ok(m, 'workflowjob bestaat: ' + naam);
    return m[0];
  };
  assert.match(workflow, /workflow_dispatch:\n\s+inputs:\n\s+verwachte_commit:[\s\S]*?required: true/);
  const preflight = blok('preflight');
  assert.match(preflight, /ref:\s*\$\{\{ github\.sha \}\}/);
  assert.match(preflight, /RTG_EXPECTED_COMMIT:\s*\$\{\{ inputs\.verwachte_commit \}\}/);
  assert.ok(preflight.indexOf('evidence-control.js bind-source') < preflight.indexOf('evidence:plan'),
    'de bronbinding hoort vóór het bewijsplan te staan');
  assert.match(preflight, /RTG_FORCE_FULL:[^\n]*schedule[^\n]*workflow_dispatch[^\n]*'1'/,
    'schedule en manual moeten beide aantoonbaar full afdwingen');

  const oordeel = blok('test');
  assert.match(oordeel, /needs:\s*\[[^\]]*keuringen[^\]]*\]/);
  assert.match(oordeel, /needs:\s*\[[^\]]*schermen-oordeel[^\]]*\]/);
  assert.match(oordeel, /--keuringen=\$\{\{ needs\.keuringen\.result \}\}/,
    'alleen wachten is niet genoeg: het resultaat moet door de poort worden beoordeeld');
  assert.match(oordeel, /--schermen=\$\{\{ needs\.schermen-oordeel\.result \}\}/,
    'de volledige schermsuite moet door dezelfde beschermde poort worden beoordeeld');
  const publiceren = blok('evidence-publish');
  assert.match(publiceren, /workflow_dispatch[\s\S]*github\.ref == 'refs\/heads\/main'[\s\S]*mode == 'full'/,
    'alleen een handmatige full-run op main mag een vertrouwd bewijsboek publiceren');
});

test('volledige bewijsconsumenten hangen niet transitief aan de overgeslagen incrementele route', () => {
  const fs = require('node:fs');
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ci.yml'), 'utf8');
  function afhankelijkheden(tekst, doel, gezien = new Set()) {
    if (gezien.has(doel)) return gezien;
    gezien.add(doel);
    const blok = tekst.match(new RegExp('^  ' + doel + ':\\n([\\s\\S]*?)(?=^  [a-zA-Z][\\w-]*:|$(?![\\s\\S]))', 'm'));
    assert.ok(blok, 'workflowjob bestaat: ' + doel);
    const needs = blok[1].match(/^    needs: (.+)$/m)?.[1];
    for (const naam of (needs || '').replace(/[\[\]]/g, '').split(/[,\s]+/).filter(Boolean))
      afhankelijkheden(tekst, naam, gezien);
    return gezien;
  }
  for (const job of ['dekking', 'evidence-publish']) {
    const needs = afhankelijkheden(workflow, job);
    assert.ok(needs.has('test-volledig'), job + ' vereist de volledige suite');
    assert.ok(!needs.has('incremental'), job + ' mag niet worden overgeslagen door de alternatieve route');
  }
  const oudeFout = workflow.replace('needs: [preflight, test-volledig, schermen-oordeel]',
    'needs: [preflight, test, test-volledig, schermen-oordeel]');
  assert.notEqual(oudeFout, workflow, 'negatieve controle wijzigt de echte afhankelijkheid');
  assert.ok(afhankelijkheden(oudeFout, 'dekking').has('incremental'), 'oude transitieve skip wordt gedetecteerd');
});
