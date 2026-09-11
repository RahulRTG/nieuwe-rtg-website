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

test('Uw ruimte laat de werelden en de systeemdeur in de bank staan', () => {
  /* Op een telefoon is Uw ruimte de bank. De eerste versie van de persoonlijke
     laag zette de module Werelden en de voet op display:none, en daarmee waren
     de vier huizen en de deur naar het bedieningspaneel op een telefoon nergens
     meer te bereiken (WERELD.md; test/appmenu.e2e.js zakte er vijf keer op).
     Wat hier vaststaat: die twee regels komen niet terug, de werelden staan
     vast (pinned) en de composer weigert ze te verbergen of te verschuiven --
     met de reden in de samenstel-lijst, want een grijze knop zonder uitleg
     bestaat hier niet (GRAMMATICA.md). */
  assert.doesNotMatch(CSS, /\[data-rtg-module="navigation"\]\{display:none\}/,
    'de module Werelden mag in Uw ruimte niet verborgen worden');
  assert.doesNotMatch(CSS, /\.cmd-bankvoet\{display:none\}/,
    'de voet van de bank (met de deur naar het bedieningspaneel) mag niet verborgen worden');
  assert.match(CSS, /\[data-deur="rahul"\]\{display:none\}/,
    'de tweede Rahul-deur in de voet wordt weggedrukt, want Uw ruimte heeft "Open Rahul" al');
  assert.match(MODULES, /id: 'navigation'[^\n]*pinned: true/, 'de module Werelden staat vast');
  const SDK = lees('public/shared/interface/module-sdk.js');
  assert.match(SDK, /pinned: m\.pinned === true/, 'het manifest kent het veld pinned');
  const COMPOSER = lees('public/shared/interface/workspace-composer.js');
  assert.match(COMPOSER, /if \(aan && vast\(id\)\) return;/, 'een vaste module is niet te verbergen');
  assert.match(COMPOSER, /if \(vast\(id\) \|\| vast\(layout\.order\[j\]\)\) return;/, 'en niet te verplaatsen');
  assert.match(COMPOSER, /staat vast: de werelden horen bovenaan de bank/, 'de samenstel-lijst draagt de reden');
  const HOST = lees('public/shared/interface/workspace-module-host.js');
  assert.match(HOST, /if \(!m\.pinned\) \[\['Omhoog', 'up'\]/, 'een vaste module krijgt geen omhoog/omlaag/verberg-knoppen');
  const COMMAND = lees('public/shared/command.js');
  assert.match(COMMAND, /sleutel:'rahul'/, 'de Rahul-deur draagt zijn sleutel');
  const BANK = lees('public/shared/command/bank.js');
  assert.match(BANK, /b\.dataset\.deur=String\(x\.sleutel\)/, 'en de bank zet die op de knop');
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
  assert.match(UI, /\.rtg-leeg-vlak--actie \.rtg-leeg-actie\{[\s\S]*?color:inherit/,
    'de invulhandeling moet de leesbare inkt van haar vlak erven');
  assert.match(EMPTY, /RTGLeeg\.vlak/);
  assert.match(MODULES, /\/apps\/comm\.html#nieuw/);
  assert.match(TRAVEL, /\/apps\/reizen\.html#rahul/);
  assert.match(COMM, /actie: \{ tekst: 'Begin een gesprek', doel: '#nieuwBtn' \}/);
  assert.match(COMM, /\.then\(openLegeActie\)/);
  assert.match(REISRAHUL, /eersteBlad === 'rahul'[\s\S]*#rahulVraag/);
  assert.match(JS, /profiel\.getAttribute\('href'\) !== '\/apps\/ik\.html#persoonlijk'/,
    'de mutatiekijker mag zijn eigen profiel-href niet eindeloos opnieuw schrijven');
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
