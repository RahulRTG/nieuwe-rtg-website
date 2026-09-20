'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const widget = require('../scripts/world-widgets');
const identity = require('../public/shared/rtg-world-identity');
test('widget catalog stays derived, covers the approved atlas and points only to existing app routes', () => {
  assert.equal(fs.readFileSync(widget.DOEL, 'utf8'), widget.bouw());
  const apps = widget.gegevens();
  assert.ok(apps.length >= Object.values(identity.MANIFEST).flat().length - identity.REDIRECTS.length);
  assert.equal(new Set(apps.map(a => a.id)).size, apps.length);
  for (const app of apps) {
    assert.ok(fs.existsSync(path.join(__dirname, '../public', app.url.split(/[?#]/)[0])), app.url);
    assert.ok(identity.VALUES.includes(app.world), app.url);
    assert.equal(app.maturity, 'L0', 'catalog availability does not imply native domain integration');
  }
  for (const url of Object.keys(require('../scripts/world-widget-design.json'))) assert.ok(apps.some(a => a.url === url), url);
});
