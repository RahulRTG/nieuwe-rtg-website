'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('Bestanden bewaart zichtbaarheid als toestand en niet als inline presentatie', () => {
  const html = lees('public/apps/bestanden.html');
  const gedrag = lees('public/apps/bestanden/app/01-overzicht.js') + '\n' +
    lees('public/apps/bestanden/paneel.js');
  assert.doesNotMatch(html, /\sstyle=/);
  for (const id of ['gedeeldKop', 'officeKop', 'bkKijk', 'bkVersieWrap', 'bkHerstel']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*class="[^"]*h-weg|class="[^"]*h-weg[^"]*"[^>]*id="' + id + '"'));
    assert.doesNotMatch(gedrag, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
});

test('Clips gebruikt de centrale presentatierollen voor alle vaste actierijen', () => {
  const html = lees('public/apps/clips.html');
  const markup = html.slice(0, html.lastIndexOf('<script'));
  assert.doesNotMatch(markup, /<[a-z][^>]*\sstyle=/i);
  assert.match(html, /\/ds\/componenten\/presentatierol\.css/);
  assert.equal((html.match(/class="ds-presentatie-actierij"/g) || []).length, 2);
  assert.equal((html.match(/class="ds-presentatie-keuzerij(?: h-mt50)?"/g) || []).length, 3);
});
