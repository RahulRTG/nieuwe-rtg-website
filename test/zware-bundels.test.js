'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { blokkeertHtmlParser } = require('../scripts/bundel');

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
  assert.equal(blokkeertHtmlParser(lid), false);
  assert.equal(blokkeertHtmlParser(zaak), false);
});

test('de zware bundels blijven na hun synchrone voorvereisten staan', () => {
  const lid = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  const zaak = fs.readFileSync(path.join(root, 'leverancier.html'), 'utf8');
  /* Hier stond /shared/wereld.js: de levende wereld moest vóór app-main staan
     omdat app-main hem de werelden aanreikte. Die module is weg met de klok, en
     een indexOf() op een bestand dat niet meer bestaat geeft -1 -- dus zou deze
     regel voor eeuwig slagen zonder nog iets te meten (LAT.md regel 2).

     De afhankelijkheid zelf is niet weg maar verhuisd: app-main reikt de
     werelden nu aan de bank van RTG Command aan, mét hun glyf uit RTGGlyf. Dat
     is dezelfde eis aan dezelfde volgorde, alleen aan een ander bestand. Beide
     staan er ook echt, zodat een verdwenen script hier niet stilletjes groen
     wordt. */
  assert.ok(lid.includes('/shared/glyf.js'), 'glyf.js hoort op app.html te staan');
  assert.ok(lid.indexOf('/shared/glyf.js') < lid.indexOf('/apps/app-main.js'));
  assert.ok(zaak.indexOf('/shared/rahulpoort.js') < zaak.indexOf('/apps/leverancier.js'));
  assert.ok(zaak.indexOf('/shared/uitvoer.js') < zaak.indexOf('/apps/leverancier.js'));
});
