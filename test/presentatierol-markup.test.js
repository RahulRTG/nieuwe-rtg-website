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
    lees('public/apps/bestanden/app.js') + '\n' + lees('public/apps/bestanden/paneel.js');
  assert.doesNotMatch(html, /\sstyle=/);
  for (const id of ['gedeeldKop', 'officeKop', 'bkKijk', 'bkVersieWrap', 'bkHerstel']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*hidden|hidden[^>]*id="' + id + '"'));
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
    /\.daily-action\):not\(\[hidden\]\):not\(\.h-weg\):not\(\.rtg-command-form button\)\{display:inline-flex!important/,
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

test('vijf Heritage-werktuigen delen vaste presentatierollen', () => {
  for (const bestand of [
    'public/apps/foundation/overhoren.html',
    'public/apps/gemeente.html',
    'public/apps/rtgkantoor.html',
    'public/apps/sitemaker.html',
    'public/apps/websitestudio.html'
  ]) {
    const html = lees(bestand);
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    assert.doesNotMatch(markup, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
});

test('de laatste tien vaste presentatiestijlen komen uit het Design System', () => {
  const gevallen = [
    ['public/apps/leverancier.html', 'stClock', 'ds-presentatie-gespreksrij'],
    ['public/apps/podium.html', 'kijkerLijst', 'ds-presentatie-noot-op'],
    ['public/apps/pay.html', 'gDemo', 'ds-presentatie-linkknop'],
    ['public/apps/media.html', 'regelaarsRij', 'ds-presentatie-regelaars'],
    ['public/apps/zaal.html', 'stopKnop', 'ds-presentatie-rechts'],
    ['public/apps/lab.html', 'lab3d', 'ds-presentatie-canvas-vol'],
    ['public/apps/handel.html', 'hGenre', 'ds-presentatie-veld-middel'],
    ['public/apps/foundation/beheer.html', 'dlgWisTitel', 'ds-presentatie-waarschuwing'],
    ['public/apps/foundation/index.html', 'pGezinNaam', 'ds-presentatie-gezinsnaam'],
    ['public/apps/foundation/club.html', 'pNaam', 'ds-presentatie-kop-klein']
  ];
  for (const [bestand, anker, rol] of gevallen) {
    const html = lees(bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
    assert.match(html, new RegExp('class="[^"]*' + rol + '[^"]*"'), bestand + ': ' + rol);
    assert.match(html, new RegExp('id="' + anker + '"'), bestand + ': ' + anker);
  }

  const statischePresentatie = [
    /style="display:flex;align-items:center;gap:0\.9rem;"/,
    /style="margin-top:-0\.3rem;"/,
    /style="text-decoration:none;"/,
    /style="display:flex;gap:0\.35rem;flex-wrap:wrap;margin-top:0\.5rem;"/,
    /style="margin-left:auto;"/,
    /style="display:block;width:100%;border-radius:0;touch-action:none;cursor:grab;"/,
    /style="flex:0 1 16rem;"/,
    /style="color:var\(--zacht\);font-size:\.88rem;margin-bottom:1\.25rem;line-height:1\.45;"/,
    /style="font-size:1\.9rem;margin-top:\.4rem;"/,
    /style="font-size:1\.1rem;"/
  ];
  const bron = gevallen.map(([bestand]) => lees(bestand)).join('\n');
  for (const patroon of statischePresentatie) assert.doesNotMatch(bron, patroon);
});
