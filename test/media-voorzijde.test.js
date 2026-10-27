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
  assert.match(wereld, /api\('\/api\/mediaos\/wereld'/);
  assert.match(wereld, /api\('\/api\/mediaos\/bewaar'/);
  assert.match(speler, /RTGOndertitelband\.zet/);
  assert.match(speler, /RTGMediaLijst\.inLijst\(huidig\.id\)/);
  assert.match(speler, /RTGMediaSamen\.start\(huidig\.id\)/);
  assert.match(blad, /api\('\/api\/mediaos\/bieb'/);
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

test('de releasecontrole is een toegankelijke laag met focusherstel', () => {
  const html = lees('public/apps/media.html');
  const studio = lees('public/apps/media/studio.js');
  assert.match(html, /id="mediaRechten" role="dialog" aria-modal="true"/);
  assert.match(html, /aria-controls="mediaRechten" aria-expanded="false"/);
  assert.match(html, /id="rechtenSluit"[^>]*aria-label="Sluit releasecontrole"/);
  assert.match(studio, /setAttribute\('aria-expanded','true'\)/);
  assert.match(studio, /setAttribute\('aria-expanded','false'\)/);
  assert.match(studio, /rechtenHerkomst\.focus\(\)/);
  assert.match(studio, /e\.key==='Escape'/);
});

test('de Media-detailroutes verklaren hun dialoog en contextbediening', () => {
  const html = lees('public/apps/media.html');
  const wereld = lees('public/apps/media/wereld.js');
  const blad = lees('public/apps/media/blad.js');
  const studio = lees('public/apps/media/studio.js');
  assert.match(html, /id="lade" role="dialog" aria-label="Details" aria-modal="true" aria-hidden="true"/);
  assert.match(html, /id="lijstKnop"[^>]*aria-haspopup="dialog"[^>]*aria-controls="lade"[^>]*data-contextactie/);
  assert.match(wereld, /alles\.setAttribute\('aria-haspopup', 'dialog'\)/);
  assert.match(wereld, /alles\.setAttribute\('data-contextactie', ''\)/);
  assert.match(wereld, /speel\.setAttribute\('data-contextactie', ''\)/);
  assert.match(html, /id="nieuwKnop"[^>]*data-contextactie[^>]*aria-controls="mediaStudio"[^>]*aria-expanded="false"/);
  assert.match(studio, /studioKnoppen\(\)\.forEach\(function\(b\)\{b\.setAttribute\('aria-expanded','true'\)\}\)/);
  assert.match(studio, /studioHerkomst\.focus\(\)/);
  assert.match(blad, /lade\.setAttribute\('aria-hidden', 'false'\)/);
  assert.match(blad, /lade\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(blad, /herkomst\.focus\(\)/);
  assert.doesNotMatch(blad, /(?:inLijst|deel|samen|kopieer)\.setAttribute\('data-contextactie'/);
});

test('de nieuwe Media-laag blijft klein en de systeemradius blijft centraal', () => {
  const css = lees('public/shared/rtg-media-2026.css');
  const js = lees('public/apps/media/voorzijde.js');
  const ervaringen = lees('public/shared/rtg-heritage-experiences.css');
  assert.ok(Buffer.byteLength(css) < 10 * 1024, 'Media CSS hoort onder 10 KiB te blijven');
  assert.ok(Buffer.byteLength(js) < 5 * 1024, 'voordeur-JS hoort onder 5 KiB te blijven');
  assert.match(ervaringen, /rtg-media-experience \.media-mobile-nav/);
  assert.doesNotMatch(css, /border-radius:var\(--rtg-radius-system\)/);
});
