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

test('Backoffice, Foundation Agenda en RTG iD delen presentatie en zichtbaarheid', () => {
  for (const bestand of ['public/apps/backoffice.html', 'public/apps/foundation/agenda.html', 'public/apps/rtgid.html']) {
    const html = lees(bestand);
    assert.doesNotMatch(html, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
  const backoffice = ['backoffice-01.js', 'backoffice-03.js', 'backoffice-04.js']
    .map(naam => lees('public/apps/backoffice/' + naam)).join('\n');
  for (const id of ['liveInd', 'tlPager', 'ontLiveScrim']) {
    assert.doesNotMatch(backoffice, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
  const agenda = lees('public/apps/foundation/agenda.html');
  for (const id of ['nieuwKnop', 'afSchool', 'afWeg']) {
    assert.doesNotMatch(agenda, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
  for (const id of ['nieuwKnop', 'afSchool', 'afWeg']) {
    assert.match(agenda, new RegExp('id="' + id + '"[^>]*hidden|hidden[^>]*id="' + id + '"'));
  }
  assert.match(agenda, /function verberg\(el, verborgen\)/,
    'Agenda synchroniseert native hidden met de bestaande visuele hulpklasse');
  assert.match(lees('public/shared/rtg-editorial-v4.css'),
    /daily-action\):not\(\[hidden\]\):not\(\.h-weg\)\{display:inline-flex!important/,
    'Editorial V4 maakt verborgen knoppen niet opnieuw zichtbaar');
  const rtgid = lees('public/apps/rtgid.html');
  for (const id of ['koppelKaart', 'kNamens', 'kMaak']) {
    assert.doesNotMatch(rtgid, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
});

test('Foundation School en Kassa hebben geen vaste inline presentatie', () => {
  for (const bestand of ['public/apps/foundation/school.html', 'public/apps/kassa.html']) {
    const html = lees(bestand);
    assert.doesNotMatch(html, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
});
