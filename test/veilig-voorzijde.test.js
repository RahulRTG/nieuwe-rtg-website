'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('RTG Veilig draagt de goedgekeurde LivingOS-voordeur', () => {
  const html = lees('public/apps/veilig.html');
  assert.match(html, /rtg-safe-experience/);
  assert.match(html, /\/shared\/rtg-veilig-2026\.css/);
  assert.match(html, /Rust omdat de juiste mensen weten wanneer ze nodig zijn/);
  for (const id of ['vandaag', 'wacht', 'kring', 'vitaal', 'meer']) assert.match(html, new RegExp('data-veilig-nav="' + id + '"'));
  assert.match(html, /data-veilig-open="codewoord"/);
  assert.match(html, /data-veilig-open="rust"/);
});

test('Vandaag leest het ene volledige veiligheidsbeeld en schrijft nergens een tweede waarheid', () => {
  const js = lees('public/apps/veilig/vandaag.js');
  assert.match(js, /api\('\/api\/veiligheid'\)/);
  assert.match(js, /wachten\.lopend/);
  assert.match(js, /x\.codewoord/);
  assert.match(js, /x\.rust/);
  assert.match(js, /x\.kring/);
  assert.doesNotMatch(js, /localStorage|indexedDB/);
});

test('de kernfuncties en eerlijke veiligheidsgrens blijven bereikbaar', () => {
  const html = lees('public/apps/veilig.html');
  const vandaag = lees('public/apps/veilig/vandaag.js');
  const scripts = ['wacht.js', 'codewoord.js', 'vitaal.js', 'rust.js'];
  for (const script of scripts) assert.match(html, new RegExp('/apps/veilig/' + script.replace('.', '\\.')));
  assert.match(vandaag, /wacht\/checkin/);
  assert.match(lees('public/shared/veiligheid.js'), /RTG is geen alarmcentrale/);
  assert.match(lees('public/apps/veilig/codewoord.js'), /codewoord\/proef/);
});

test('de nieuwe Veilig-lagen blijven klein en gebruiken de centrale systeemradius', () => {
  const css = lees('public/shared/rtg-veilig-2026.css');
  const vandaag = lees('public/apps/veilig/vandaag.js');
  const voorzijde = lees('public/apps/veilig/voorzijde.js');
  const ervaringen = lees('public/shared/rtg-heritage-experiences.css');
  assert.ok(Buffer.byteLength(css) < 10 * 1024);
  assert.ok(Buffer.byteLength(vandaag) < 7 * 1024);
  assert.ok(Buffer.byteLength(voorzijde) < 5 * 1024);
  assert.match(ervaringen, /rtg-safe-experience \.veilig-nav/);
  assert.doesNotMatch(css, /border-radius:var\(--rtg-radius-system\)/);
});
