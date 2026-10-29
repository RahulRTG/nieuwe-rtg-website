'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Assets houdt het intrekken van een zojuist gemaakte aanvraag in de bedieningsroute', () => {
  const assets = lees('public/apps/app-main/app-main-32a.js');
  assert.match(assets, /class="mo-code js-asintrek"[^>]+data-contextactie/);
});

test('FocusUI houdt dynamische kaartkoppen in de bedieningsroute', () => {
  const focus = lees('public/shared/focus.js');
  assert.match(focus, /kop\.setAttribute\('data-contextactie', ''\)/);
  assert.match(focus, /kop\.setAttribute\('aria-label', n \+ ' in- of uitklappen'\)/);
});

test('Salon houdt beide pinveiligheidsacties afzonderlijk in de bedieningsroute', () => {
  const salon = lees('public/apps/app-main/app-main-09a.js');
  assert.match(salon, /id="scPinNieuw" data-contextactie/);
  assert.match(salon, /id="scPinNood" class="gevaar" data-contextactie/);
});

test('Ter plaatse houdt prijsvarianten stabiel en bedient live-acties voor Stop', () => {
  const tickets = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main', 'app-main-13.js'), 'utf8');
  const live = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main', 'app-main-34b.js'), 'utf8');
  assert.match(tickets, /id="tkKoop" aria-label=/,
    'de ticketprijs mag dezelfde koophandeling geen tweede identiteit geven');
  assert.match(live, /id="liveTaxi" data-hoofdactie/,
    'de eenmalige taxi-opener moet voor een afsluitende live-actie worden geraakt');
  for (const id of ['liveHier', 'liveSim', 'liveShare']) {
    assert.match(live, new RegExp('id="' + id + '" data-contextactie'), id + ' blijft in de actieve live-route');
  }
});
