const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('de vier werelden gebruiken dezelfde verdiepende stijl op hun echte routes', () => {
  const routes = {
    'public/apps/agenda.html': 'rtg-living-flow',
    'public/apps/attenties.html': 'rtg-living-flow',
    'public/apps/vluchten.html': 'rtg-travel-flow',
    'public/apps/rit.html': 'rtg-travel-flow',
    'public/apps/rtgone.html': 'rtg-work-flow',
    'public/apps/foundation/agenda.html': 'rtg-school-flow',
    'public/apps/foundation/leren.html': 'rtg-school-flow',
    'public/apps/foundation/mail.html': 'rtg-school-flow'
  };
  for (const [route, klasse] of Object.entries(routes)) {
    const html = lees(route);
    const stijl = route === 'public/apps/agenda.html' ? 'rtg-daily-rooms.css' : 'rtg-deep-flows-2026.css';
    assert.ok(html.includes('/shared/' + stijl), route + ' laadt zijn huidige gedeelde stijl');
    assert.match(html, new RegExp(`class="[^"]*${klasse}`));
  }
});

test('LivingOS en TravelOS houden de vervolgstappen onder de duim', () => {
  const agenda = lees('public/apps/agenda.html');
  assert.match(agenda, /\/shared\/randen\.js/);
  assert.doesNotMatch(agenda, /class="rtg-deep-nav"/, 'Agenda krijgt geen tweede navigatie naast de Edge');
  const sprongen = JSON.parse(lees('public/shared/sprongindex.json'));
  assert.ok(JSON.stringify(sprongen).includes('"url":"/apps/attenties.html"'),
    'Attenties blijft via het centrale navigatieregister bereikbaar');
  assert.match(lees('public/shared/rtg-edge-2-loader.js'), /pad === '\/apps\/agenda\.html'\) hoofdactie\('Nieuwe afspraak'/);

  const vlucht = lees('public/apps/vluchten.html');
  assert.match(vlucht, /view=mijn/);
  assert.match(vlucht, /href="\/apps\/rit\.html"/);

  const rit = lees('public/apps/rit.html');
  assert.match(rit, /href="\/apps\/comm\.html"/);
  assert.match(rit, /href="\/apps\/navigatie\.html"/);
});

test('WorkOS opent werkdag, besluit en overdracht direct in de bestaande commandolaag', () => {
  const kantoor = lees('public/apps/kantoor.html');
  assert.match(kantoor, /\/apps\/rtgone\.html\?view=decisions/);
  assert.match(kantoor, /\/apps\/rtgone\.html\?view=handover/);

  const one = lees('public/apps/rtgone.html');
  assert.match(one, /\['today','decisions','handover'\]\.includes\(START_VIEW\)/);
  assert.match(one, /endpoint:'goedkeuring'/);
  assert.match(one, /endpoint:'overdracht'/);
});

test('FoundationOS verbindt schooldag, huiswerkhulp en bericht zonder de toegangspoort te omzeilen', () => {
  const agenda = lees('public/apps/foundation/agenda.html');
  const leren = lees('public/apps/foundation/leren.html') + lees('public/apps/foundation/leren-groei.js');
  const mail = lees('public/apps/foundation/mail.html');
  for (const html of [agenda, leren, mail]) {
    assert.match(html, /href="agenda\.html"/);
    assert.match(html, /href="leren\.html"/);
    assert.match(html, /href="mail\.html"/);
  }
  assert.match(agenda, /Sessie\.eisProfiel\(\)/);
  assert.match(mail, /Sessie\.eisFamilie\(\)/);
  assert.match(leren, /RTGSchoolSession\.zet/);
});
