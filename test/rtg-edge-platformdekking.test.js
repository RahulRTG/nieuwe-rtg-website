'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const APPS = path.join(ROOT, 'public', 'apps');
const WERELDEN = new Set(['living', 'travel', 'work', 'foundation']);

function lees(bestand) {
  return fs.readFileSync(bestand, 'utf8');
}

function paginas(map) {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? paginas(path.join(map, item.name))
      : item.name.endsWith('.html') ? [path.join(map, item.name)] : []);
}

function bodyVan(bron) {
  return (bron.match(/<body\b[^>]*>/i) || [''])[0];
}

function wereldVan(bron) {
  const match = bodyVan(bron).match(/\bdata-rtg-world=["']([^"']+)/i);
  return match && match[1];
}

function omleidingVan(bron) {
  const meta = bron.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"';>]+)/i);
  return meta && meta[1].trim();
}

function basisTag(bron) {
  return (bron.match(/<script\b[^>]*src=["'][^"']*\/shared\/basis(?:\.min)?\.js[^"']*["'][^>]*>/i) || [])[0];
}

test('alle zelfstandige appschermen erven de ene wereldkleurige Edge', () => {
  const alle = paginas(APPS);
  const zelfstandig = [];
  const omleidingen = [];
  const projecties = [];

  for (const bestand of alle) {
    const bron = lees(bestand);
    const omleiding = omleidingVan(bron);
    if (omleiding) {
      omleidingen.push([bestand, omleiding]);
      continue;
    }
    if (/\bdata-rtg-projectie\b/i.test(bodyVan(bron))) {
      projecties.push(bestand);
      continue;
    }

    zelfstandig.push(bestand);
    const relatief = path.relative(ROOT, bestand);
    assert.ok(WERELDEN.has(wereldVan(bron)), relatief + ' mist een geldige wereldkleur');
    const tag = basisTag(bron);
    assert.ok(tag, relatief + ' mist de centrale basislaag voor Edge');
    const naBody = bron.indexOf(tag) > bron.search(/<body\b/i);
    assert.ok(/\bdefer\b/i.test(tag) || naBody,
      relatief + ' start basis.js voordat body en wereldidentiteit bestaan');
    assert.doesNotMatch(bron,
      /\/shared\/rtg-edge-2-(?:loader|context|reveal)\.js|\/shared\/rtg-edge-2\.js|\/shared\/rtg-edge-2\.css/,
      relatief + ' mag geen tweede, plaatselijke Edge-laadketen maken');
  }

  assert.ok(zelfstandig.length > 250,
    'de platformregel moet aantoonbaar de volledige verzameling van 250+ schermen dekken');
  assert.equal(projecties.length, 1, 'alleen het gedeelde televisiescherm is bewust chromeloos');
  assert.equal(path.relative(ROOT, projecties[0]), 'public/apps/spelscherm.html');

  for (const [bestand, doel] of omleidingen) {
    const doelpad = doel.split(/[?#]/)[0];
    assert.ok(doelpad.startsWith('/apps/'), path.relative(ROOT, bestand) + ' leidt niet naar een eigen app');
    const doelbestand = path.join(ROOT, 'public', doelpad.replace(/^\//, ''));
    assert.ok(fs.existsSync(doelbestand), path.relative(ROOT, bestand) + ' leidt naar een ontbrekend scherm');
    const doelbron = lees(doelbestand);
    assert.ok(WERELDEN.has(wereldVan(doelbron)), doelpad + ' mist een geldige wereldkleur');
    assert.ok(basisTag(doelbron), doelpad + ' erft de centrale Edge niet');
  }

  assert.equal(zelfstandig.length + omleidingen.length + projecties.length, alle.length);
});

test('de universele laadketen bouwt exact een Edge-casco', () => {
  const basis = lees(path.join(ROOT, 'public', 'shared', 'basis.js'));
  const randen = lees(path.join(ROOT, 'public', 'shared', 'randen.js'));
  const systeem = lees(path.join(ROOT, 'public', 'shared', 'rtg-edge-system.js'));
  const bibliotheek = lees(path.join(ROOT, 'public', 'shared', 'rtg-edge-library.js'));

  assert.match(basis, /\['living', 'travel', 'work', 'foundation'\]/);
  assert.match(basis, /s\.src = '\/shared\/randen\.js'/);
  assert.match(randen, /function startPlatformEdge\(\)/);
  assert.match(randen, /d\.body\.dataset\.rtgWorld/);
  assert.match(randen, /w\.RTGEdge\.start\(\{ world: wereld/);
  assert.equal((systeem.match(/className = 'rtg-edge-chrome'/g) || []).length, 1);
  assert.equal((systeem.match(/\/shared\/rtg-edge-2-loader\.js/g) || []).length, 1);
  for (const deel of ['rtg-edge-top', 'rtg-edge-side', 'rtg-edge-bottom']) {
    assert.equal((bibliotheek.match(new RegExp('class="' + deel + '"', 'g')) || []).length, 1, deel);
  }
});
