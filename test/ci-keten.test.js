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
