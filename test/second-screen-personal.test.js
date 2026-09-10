'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const JS = lees('public/shared/interface/second-screen-personal.js');
const CSS = lees('public/shared/interface/second-screen-personal.css');
const MODULES = lees('public/shared/interface/second-screen-modules.js');
const TRAVEL = lees('public/shared/interface/modules/travel.js');
const EMPTY = lees('public/shared/interface/workspace-empty.js');
const LEEG = lees('public/shared/leeg.js');
const UI = lees('public/shared/rtg-ui.css');
const COMM = lees('public/apps/comm.html');
const REISRAHUL = lees('public/apps/reizen-performance-rahul.js');
const HTML = lees('public/apps/app.html');
const SW = lees('public/sw.js');
const SMART = lees('public/shared/rtg-edge-smart-menu.js');
const EDGE_COMMAND = lees('public/shared/rtg-edge-command.js');

test('Uw ruimte gebruikt de bestaande profiel-, inbox- en Rahul-bronnen', () => {
  assert.match(MODULES, /request\('\/api\/auth\/me'/);
  assert.match(MODULES, /request\('\/api\/comm\/inbox'/);
  assert.match(JS, /\.cmd-console \[data-open="ai"\]/);
  assert.match(JS, /\[data-cmd="settings"\]/);
  assert.match(JS, /Ruimteweergave/);
  assert.match(JS, /Gegevens meenemen/);
  assert.match(JS, /view\.hidden = !view\.hidden/);
  assert.doesNotMatch(JS, /cloneNode/);
  assert.match(SMART, /<span>Uw ruimte<\/span>/);
  assert.match(SMART, /__rtgSecondScreen\.setState\('panel'\)/);
  assert.match(EDGE_COMMAND, /bankOpen\(\) && !secondOpen\(\)/,
    'de slimme hamburger sluit Uw ruimte niet meteen opnieuw');
  assert.doesNotMatch(JS, /fetch\(|XMLHttpRequest|localStorage/);
});

test('de persoonlijke voorzijde heeft vier echte snelle deuren', () => {
  for (const tekst of ['Uw ruimte', 'Open Rahul', 'Pas mijn ruimte aan', 'Profiel', 'Privacy', 'Meldingen', 'Weergave']) {
    assert.ok(JS.includes(tekst), tekst);
  }
  assert.match(JS, /\/apps\/ik\.html#persoonlijk/);
  assert.match(JS, /\/apps\/juridisch\/privacy\.html/);
  assert.match(JS, /\/apps\/comm\.html/);
  assert.match(MODULES, /Geen actie nodig\. Rahul houdt de rest in de gaten\./);
});

test('lege informatie is één familie en opent meteen de juiste invullaag', () => {
  assert.match(LEEG, /rtg-leeg-vlak--actie/);
  assert.match(LEEG, /data-rtg-leeg-doel/);
  assert.match(UI, /\.rtg-leeg-vlak--actie::after/);
  assert.match(EMPTY, /RTGLeeg\.vlak/);
  assert.match(MODULES, /\/apps\/comm\.html#nieuw/);
  assert.match(TRAVEL, /\/apps\/reizen\.html#rahul/);
  assert.match(COMM, /actie: \{ tekst: 'Begin een gesprek', doel: '#nieuwBtn' \}/);
  assert.match(COMM, /\.then\(openLegeActie\)/);
  assert.match(REISRAHUL, /eersteBlad === 'rahul'[\s\S]*#rahulVraag/);
  assert.match(JS, /profiel\.getAttribute\('href'\) !== '\/apps\/ik\.html#persoonlijk'/);
  assert.match(JS, /profiel\.textContent !== 'Aanvullen'/,
    'de mutatiekijker mag zijn eigen profieltekst niet eindeloos opnieuw schrijven');
});

test('het nieuwe vlak en de ene Edge-balk laden ook offline', () => {
  for (const bestand of ['second-screen-personal.css', 'second-screen-personal.js', 'workspace-empty.js']) {
    assert.ok(HTML.includes('/shared/interface/' + bestand), bestand + ' staat op het scherm');
    assert.ok(SW.includes('/shared/interface/' + bestand), bestand + ' staat in de offline schil');
  }
  assert.match(CSS, /body\[data-rtg-personal-surface\] \.rtg-edge-bottom/);
  assert.match(CSS, /rtg-edge-appslot\{[^}]*pointer-events:none/,
    'het decoratieve UW RUIMTE-vlak mag bediening van het scherm niet onderscheppen');
  assert.match(CSS, /\.rtg-edge-appslot::before\{content:"UW RUIMTE"/);
  assert.match(CSS, /\.rtg-edge-ai\{display:flex!important/);
});
