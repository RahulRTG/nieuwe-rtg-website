const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wortel = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(wortel, p), 'utf8');

test('Decision Room heeft vier echte, responsive werkstanden', () => {
  const html = lees('public/apps/decision-room.html');
  for (const stand of ['agenda', 'afweging', 'besluit', 'archief']) {
    assert.match(html, new RegExp('data-dr-paneel="' + stand + '"'));
    assert.match(html, new RegExp('data-dr-open="' + stand + '"'));
  }
  assert.match(html, /rtg-decision-room-2026\.css/);
  assert.match(lees('public/shared/rtg-decision-room-2026.css'), /@media\(max-width:720px\)/);
});

test('de besluitintake is een herkenbare en heropenbare dialoog', () => {
  const html = lees('public/apps/decision-room.html');
  const agenda = lees('public/apps/decision-room-agenda.js');
  assert.match(html, /id="drIntake" role="dialog" aria-modal="true" aria-labelledby="drIntakeTitel"/);
  assert.match(html, /data-dr-nieuw aria-haspopup="dialog" aria-controls="drIntake"/);
  assert.match(agenda, /data-dr-nieuw aria-haspopup="dialog" aria-controls="drIntake"/);
});

test('Decision Room leest echte RTG One-data en bewaart de menselijke grens', () => {
  const controller = lees('public/apps/decision-room.js');
  const afweging = lees('public/apps/decision-room-afweging.js');
  const besluit = lees('public/apps/decision-room-besluit.js');
  assert.match(controller, /api\('\/api\/rtgone\/state'/);
  assert.match(controller, /api\('\/api\/rtgone\/goedkeuring\/beslis'/);
  assert.match(afweging, /x\.bronMailId/);
  assert.match(afweging, /x\.documentId/);
  assert.match(besluit, /Rahul kan voorbereiden, nooit bevestigen/);
  assert.doesNotMatch(controller + afweging + besluit, /Nieuwe vloot|Project Meridian|Ibiza/);
});

test('WorkOS, RTG One en RTDocs openen dezelfde Decision Room', () => {
  assert.match(lees('public/apps/kantoor.html'), /href="\/apps\/decision-room\.html"/);
  assert.match(lees('public/apps/rtgone-voorzijde.js'), /\/apps\/decision-room\.html\?id=/);
  assert.match(lees('public/apps/office/voorzijde.js'), /\/apps\/decision-room\.html\?/);
  assert.match(lees('public/apps/office/voorzijde-besluit.js'), /data-rtd-room=/);
});
