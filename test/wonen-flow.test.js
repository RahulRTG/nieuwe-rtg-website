'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Wonen vormt één herkenbare LivingOS-flow met drie echte schermen', () => {
  const schermen = ['wonen', 'onderhoud', 'woningdossier'];
  for (const naam of schermen) {
    const html = lees(`public/apps/${naam}.html`);
    assert.match(html, /data-rtg-world="living"/);
    assert.match(html, /data-rtg-layout="standard"/, 'de bestaande workspace-ingang blijft actief');
    assert.match(html, /\/ds\/rtg-ds\.css/);
    assert.match(html, /\/ds\/shell\.js/);
    assert.match(html, /class="ds-scherm"/);
    assert.doesNotMatch(html, /<style\b|\sstyle=/);
    const bladen = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"/g)].map(m => m[1]).sort();
    assert.deepEqual(bladen, ['/ds/rtg-ds.css', '/fonts/fonts.css'],
      'gebaren en werkruimte behouden hun eigenaar met canonieke presentatie');
    assert.match(html, /\/apps\/wonen\.js/);
    for (const route of schermen) assert.match(html, new RegExp(`/apps/${route}\\.html`));
  }
});

test('Wonen behoudt de gedeelde bediening tot de DS-vervanging compleet is', () => {
  for (const naam of ['wonen', 'onderhoud', 'woningdossier']) {
    const html = lees(`public/apps/${naam}.html`);
    for (const script of ['metgezel', 'schermbeeld', 'bediening', 'randen', 'rtg-world-desktop', 'ios']) {
      assert.ok(html.includes('/shared/' + script + '.js'), script + ' blijft beschikbaar');
    }
  }
  assert.equal(fs.existsSync(path.join(root, 'public/shared/rtg-wonen-2026.css')), false,
    'de exclusieve vervangen stijl blijft niet achter');
});

test('Wonen gebruikt de bestaande woning en kluis en verzint geen uitvoering', () => {
  const client = lees('public/apps/wonen.js');
  assert.match(client, /api\('\/api\/home'\)/);
  assert.match(client, /api\('\/api\/bestanden\/mijn'\)/);
  assert.match(client, /api\('\/api\/bestanden\/upload'/);
  assert.match(client, /api\('\/api\/home\/onderhoud\/meld'/);
  assert.match(client, /We tonen geen voorbeeldstoring als echte afspraak/);
  assert.doesNotMatch(client, /vakman\s*:/i,
    'de client mag geen toegewezen vakman fabriceren');
  assert.ok(Buffer.byteLength(client) < 10 * 1024,
    'de gedeelde Wonen-interactielaag blijft onder 10 KiB');
});

test('alle Wonen-routes horen bij LIFE en hebben eigen uitleg', () => {
  const routes = require('../server/kern/wereldroutes');
  const gids = require('../server/kern/appgids');
  for (const route of ['/apps/wonen.html', '/apps/onderhoud.html', '/apps/woningdossier.html']) {
    assert.equal(routes.wereldVanRoute(route), 'LIFE', route);
    assert.equal(gids.gidsVan(route).algemeen, undefined, route + ' gebruikt geen terugvaluitleg');
  }
});
