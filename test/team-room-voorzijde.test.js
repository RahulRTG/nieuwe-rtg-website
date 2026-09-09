'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = lees('public/apps/personeel.html');
const kern = lees('public/apps/personeel.js');
const gedrag = lees('public/apps/personeel-voorzijde.js');
const beeld = lees('public/apps/personeel-voorzijde-weergave.js') + lees('public/apps/personeel-voorzijde-team.js');
const css = lees('public/shared/rtg-team-room-2026.css') + lees('public/shared/rtg-team-room-profiel-2026.css');

test('Team Room draagt het goedgekeurde WorkOS-drieluik', () => {
  assert.match(html, /Team Room rustig werkoverzicht/);
  for (const paneel of ['vandaag', 'team', 'profiel']) assert.match(html, new RegExp('data-trm-paneel="' + paneel + '"'));
  for (const kop of ['Een sterke werkdag begint met rust', 'Team &amp; rooster', 'MEDEWERKER']) assert.match(html, new RegExp(kop));
  for (const bestand of ['rtg-team-room-2026.css', 'rtg-team-room-profiel-2026.css', 'personeel-voorzijde-weergave.js', 'personeel-voorzijde-team.js', 'personeel-voorzijde.js']) {
    assert.equal((html.match(new RegExp('/(?:shared|apps)/' + bestand.replace(/[.]/g, '\\.'), 'g')) || []).length, 1, bestand);
  }
});

test('de rustige voorzijde projecteert uitsluitend bestaande personeelsbronnen', () => {
  for (const bron of ['stand.week', 'stand.state.tickets', 'stand.state.rooms', 'stand.state.orders', 'stand.state.verlof', 'stand.state.klok']) assert.ok(beeld.includes(bron), bron);
  for (const pad of ['/supplier/hr/mijn', '/supplier/hr/overzicht', '/supplier/contracten']) assert.ok(gedrag.includes(pad), pad);
  assert.doesNotMatch(beeld, /Amira El Idrissi|Thomas de Vries|Guest Experience|09:00 \u2013 17:30/);
  assert.match(beeld, /Geen dienst vastgelegd/);
  assert.match(beeld, /Locatie niet vastgelegd/);
});

test('een taak gebruikt dezelfde bestaande personeelshandeling', () => {
  assert.match(gedrag, /\/supplier\/horeca\/missions\/status/);
  assert.match(gedrag, /\/supplier\/ticket\/status/);
  assert.match(kern, /RTGTeamRoomBrug/);
  assert.match(kern, /await refresh\(\)/);
  assert.doesNotMatch(gedrag, /localStorage\.setItem|Math\.random/);
});

test('Team Room blijft warm, menselijk en verbonden met de volledige PDA', () => {
  for (const kleur of ['--trm-nacht:#0d0907', '--trm-goud:#d6a96a', '--trm-wijn:#8d1738', '--trm-groen:#70b782']) assert.ok(css.includes(kleur), kleur);
  assert.match(css, /work-heritage-v2\.jpg/);
  assert.match(css, /\.trm-nav\{position:fixed/);
  assert.match(kern, /Rustig overzicht/);
  for (const tab of ['taken', 'rooster', 'hulp']) assert.match(html, new RegExp('data-trm-diep="' + tab + '"'));
});

test('de nieuwe Team Room-modules blijven klein', () => {
  for (const bestand of ['public/apps/personeel-voorzijde.js', 'public/apps/personeel-voorzijde-weergave.js',
    'public/apps/personeel-voorzijde-team.js', 'public/shared/rtg-team-room-2026.css',
    'public/shared/rtg-team-room-profiel-2026.css']) {
    assert.ok(Buffer.byteLength(lees(bestand)) < 10 * 1024, bestand + ' is te groot');
  }
});
