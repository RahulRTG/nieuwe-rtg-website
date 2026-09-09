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
