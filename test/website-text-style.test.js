'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TALEN } = require('../server/talen');

const ROOT = path.join(__dirname, '..');
const WEBSITE_FILES = [
  'index.html',
  'public/site/start/experience-core.js',
  'public/site/start/experience-discovery.js',
  'public/site/start/experience.js',
  'public/site/start/experience.css',
  'public/site/werelden/world.css',
  ...fs.readdirSync(path.join(ROOT, 'public/site/werelden'))
    .filter(name => name.endsWith('.html'))
    .map(name => 'public/site/werelden/' + name),
  ...fs.readdirSync(path.join(ROOT, 'public/site/passen'))
    .filter(name => name.endsWith('.html'))
    .map(name => 'public/site/passen/' + name)
];

const VREEMDE_TEKENS = /[\u2014\u2013↗→←·“”‘’…◌◷⌁↳↓]/u;

test('publieke webteksten bevatten geen AI-labels of decoratieve schrijftekens', () => {
  for (const file of WEBSITE_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /\bAI\b/, file + ' noemt AI in de publieke tekst');
    assert.doesNotMatch(source, VREEMDE_TEKENS, file + ' bevat een ongewenst schrijfteken');
  }
});

test('dezelfde gewone schrijfstijl geldt voor alle 114 vertaaltalen', () => {
  assert.equal(TALEN.length, 114);
  for (const file of ['server/translate.js', 'server/translate/batch-model.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(source, /plain, natural language/);
    assert.match(source, /do not add em dashes, decorative arrows, bullets, emoji or smart quotation marks/i);
  }
});

test('de taalkiezer gebruikt gewone tekst en is op alle verhaalpagina\'s bereikbaar', () => {
  for (const file of ['public/shared/i18n.js', 'public/shared/i18n/i18n-01.js', 'public/shared/i18n/i18n-03.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /rtg-lang-ai|rtg-lang-rahul|Rahul switches|Let Rahul choose|&middot;|&mdash;|&hellip;|&rsquo;|ICOON\.spark|rtg-lang-mond/);
  }
  for (const file of WEBSITE_FILES.filter(name => /public\/site\/(?:werelden|passen)\/.*\.html$/.test(name))) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(source, /data-language-picker/, file + ' mist de taalknop');
  }
});

test('de meegeleverde offline vertalingen bevatten de ongewenste tekens niet', () => {
  const dir = path.join(ROOT, 'public/shared/taalschil');
  for (const name of fs.readdirSync(dir).filter(file => file.endsWith('.json'))) {
    const source = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.doesNotMatch(source, VREEMDE_TEKENS, name + ' bevat een ongewenst schrijfteken');
  }
});
