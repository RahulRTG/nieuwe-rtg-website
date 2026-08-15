'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'public', 'apps');

function scriptTag(pagina, bron) {
  const html = fs.readFileSync(path.join(root, pagina), 'utf8');
  const veilig = bron.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp('<script\\b[^>]*src=["\\\']' + veilig + '["\\\'][^>]*>', 'i'))?.[0] || '';
}

test('de twee grootste browserbundels blokkeren de HTML-parser niet', () => {
  const lid = scriptTag('app.html', '/apps/app-main.js');
  const zaak = scriptTag('leverancier.html', '/apps/leverancier.js');
  assert.match(lid, /\bdefer\b/i, 'app-main.js hoort parallel met de HTML te laden');
  assert.match(zaak, /\bdefer\b/i, 'leverancier.js hoort parallel met de HTML te laden');
});

test('de zware bundels blijven na hun synchrone voorvereisten staan', () => {
  const lid = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  const zaak = fs.readFileSync(path.join(root, 'leverancier.html'), 'utf8');
  assert.ok(lid.indexOf('/shared/wereld.js') < lid.indexOf('/apps/app-main.js'));
  assert.ok(zaak.indexOf('/shared/rahulpoort.js') < zaak.indexOf('/apps/leverancier.js'));
  assert.ok(zaak.indexOf('/shared/uitvoer.js') < zaak.indexOf('/apps/leverancier.js'));
});
