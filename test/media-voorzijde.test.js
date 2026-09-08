'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('LivingOS Media heeft de drie goedgekeurde ervaringen in de warme Heritage-stijl', () => {
  const html = lees('public/apps/media.html');
  assert.match(html, /rtg-media-experience/);
  assert.match(html, /\/shared\/rtg-media-2026\.css/);
  assert.match(html, /Minder zoeken\.<br>Meer beleven\./);
  assert.match(html, /Uw bibliotheek|Bibliotheek/);
  assert.match(html, /data-media-voor="wereld"/);
  assert.match(html, /data-media-voor="ontdek"/);
  assert.match(html, /data-media-voor="bieb"/);
  assert.match(html, /href="\/apps\/podium\.html"/);
});

test('de voordeur hergebruikt de echte catalogus, bibliotheek, studio en kamers', () => {
  const html = lees('public/apps/media.html');
  const wereld = lees('public/apps/media/wereld.js');
  const speler = lees('public/apps/media/speler.js');
  const blad = lees('public/apps/media/blad.js');
  const voorzijde = lees('public/apps/media/voorzijde.js');
  assert.match(wereld, /api\('wereld'/);
  assert.match(wereld, /api\('bewaar'/);
  assert.match(speler, /RTGOndertitelband\.zet/);
  assert.match(speler, /RTGMediaLijst\.inLijst\(huidig\.id\)/);
  assert.match(speler, /RTGMediaSamen\.start\(huidig\.id\)/);
  assert.match(blad, /api\('bieb'/);
  assert.match(voorzijde, /nieuwKnop/);
  assert.match(voorzijde, /biebKnop/);
  assert.match(voorzijde, /\/apps\/podium\.html/);
  assert.match(html, /\/apps\/media\/voorzijde\.js/);
});

test('de Media-voordeur legt de aanbeveling eerlijk uit', () => {
  const html = lees('public/apps/media.html');
  assert.match(html, /Geen verborgen kijkprofiel/);
  assert.match(html, /makers die u volgt en voorkeuren die u zelf geeft/);
  assert.doesNotMatch(html, /oneindige feed|automatisch abonnement|universeel abonnement/i);
});

test('de nieuwe Media-laag blijft klein en de systeemradius blijft centraal', () => {
  const css = lees('public/shared/rtg-media-2026.css');
  const js = lees('public/apps/media/voorzijde.js');
  const adapter = lees('public/shared/rtg-heritage-adapters.css');
  assert.ok(Buffer.byteLength(css) < 10 * 1024, 'Media CSS hoort onder 10 KiB te blijven');
  assert.ok(Buffer.byteLength(js) < 5 * 1024, 'voordeur-JS hoort onder 5 KiB te blijven');
  assert.match(adapter, /rtg-media-experience \.media-mobile-nav/);
  assert.doesNotMatch(css, /border-radius:var\(--rtg-radius-system\)/);
});
