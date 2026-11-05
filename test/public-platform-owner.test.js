'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const hosts = [
  ['index.html', './public/shared/interface/world-desktop-copy.js'],
  ['explore/index.html', '../public/shared/interface/world-desktop-copy.js'],
  ...['business-lite', 'business-pass', 'community', 'lifestyle-pass', 'rtg-pass']
    .map(naam => ['public/site/passen/' + naam + '.html', '../../shared/interface/world-desktop-copy.js']),
  ['public/site/techniek/techniek.html', '../../shared/interface/world-desktop-copy.js'],
  ...['foundationos', 'livingos', 'travelos', 'workos']
    .map(naam => ['public/site/werelden/' + naam + '.html', '../../shared/interface/world-desktop-copy.js'])
];

test('alle publieke platformhosts verklaren de gedeelde kopietaal statisch vóór hun verbruiker', () => {
  for (const [bestand, bron] of hosts) {
    const html = fs.readFileSync(bestand, 'utf8');
    const eigenaar = html.indexOf('src="' + bron + '"');
    const detailTag = html.match(/<script[^>]+src="[^"]*platform-detail\.js"/);
    const shellTag = html.match(/<script[^>]+src="[^"]*platform-shell\.js"/);
    const detail = detailTag ? html.indexOf(detailTag[0]) : -1;
    const shell = shellTag ? html.indexOf(shellTag[0]) : -1;
    const verbruiker = detail >= 0 ? detail : shell;
    assert.ok(eigenaar >= 0, bestand + ': gedeelde kopietaal ontbreekt');
    assert.ok(verbruiker >= 0 && eigenaar < verbruiker, bestand + ': eigenaar moet vóór de verbruiker staan');
  }
});

test('publieke platformowners gebruiken native media/ankers en geen runtime-scriptloader', () => {
  const elementen = fs.readFileSync('public/site/platform-elements.js', 'utf8');
  const detail = fs.readFileSync('public/site/platform-detail.js', 'utf8');
  assert.match(elementen, /document\.createElement\('img'\)/);
  assert.match(elementen, /secure=document\.createElement\('a'\)/);
  assert.doesNotMatch(elementen, /createElement\('script'\)/);
  assert.doesNotMatch(detail, /createElement\('script'\)/);
  assert.match(detail, /setAttribute\('href',url\)/);
});
