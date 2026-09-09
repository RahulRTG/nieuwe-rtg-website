const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wortel = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(wortel, p), 'utf8');

test('Project Room heeft uitvoering, dossier en menselijke oplevering', () => {
  const html = lees('public/apps/project-room.html');
  for (const stand of ['uitvoering', 'dossier', 'oplevering']) {
    assert.match(html, new RegExp('data-pr-paneel="' + stand + '"'));
    assert.match(html, new RegExp('data-pr-open="' + stand + '"'));
  }
  assert.match(html, /rtg-project-room-2026\.css/);
  assert.match(lees('public/shared/rtg-project-room-2026.css'), /@media\(max-width:760px\)/);
});

test('Project Room gebruikt echte RTG One-projecten en geen presentatiedata', () => {
  const controller = lees('public/apps/project-room.js');
  const uitvoering = lees('public/apps/project-room-uitvoering.js');
  const dossier = lees('public/apps/project-room-dossier.js');
  const oplevering = lees('public/apps/project-room-oplevering.js');
  assert.match(controller, /api\('state'/);
  assert.match(controller, /api\('project\/taak'/);
  assert.match(controller, /api\('project\/bewijs'/);
  assert.match(controller, /api\('project\/oplever'/);
  assert.match(dossier, /staat\.intenties/);
  assert.match(oplevering, /een resultaat op zichzelf/);
  assert.doesNotMatch(controller + uitvoering + dossier + oplevering, /Meridian|Noor Koster|Rotterdam/);
});

test('WorkOS en Decision Room voeren naar de Project Room', () => {
  assert.match(lees('public/apps/kantoor.html'), /href="\/apps\/project-room\.html"/);
  assert.match(lees('public/apps/decision-room-besluit.js'), /\/apps\/project-room\.html\?project=/);
});
