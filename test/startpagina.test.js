/* De losse GitHub Pages-voordeur: merk, routes en dagdeelbeelden.

   Deze pagina draait niet via de productieserver: index.html in de
   repositoryroot wordt rechtstreeks door GitHub Pages bediend. Daarom toetst
   dit bestand de echte bron en zijn relatieve assets. Een absolute /images-link
   kan lokaal goed lijken en op een projectsite toch 404 geven. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const start = require('../public/site/start/start.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('de nieuwe voordeur draagt het RTG-merk en niet het vervangen scherm', () => {
  assert.match(HTML, /data-page="rtg-landing"/);
  assert.match(HTML, /Vier werelden\.<br>Één visie\./);
  assert.ok((HTML.match(/EXPERIENCE THE ELITE CLASS/g) || []).length >= 2,
    'de exacte slogan staat in de kop én de voet');
  assert.doesNotMatch(HTML, /Uw RTG-omgeving begint|Geen voorbeelddata|Nog geen eigen informatie/,
    'de oude witte onboarding is volledig vervangen');
  assert.match(HTML, /name="rtg-api-base" content="https:\/\/app\.rahultravelgroup\.com"/,
    'GitHub Pages houdt dezelfde publieke basis voor de taalrail');
  assert.match(HTML, /\.\/public\/shared\/i18n\.js/,
    'de wereldwijde taalkeuze blijft aan dezelfde taalrail hangen');
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'public/site/start/start.js'), 'utf8'),
    /api\/pasprijzen/, 'de statische Pages-voordeur doet geen geblokkeerde cross-origin prijsaanvraag');
  assert.match(fs.readFileSync(path.join(ROOT, 'public/site/start/start.js'), 'utf8'),
    /__rahulTabStandaard\s*=\s*true/,
    'de openbare pagina laadt niet stil de ingelogde commandtab vanaf een fout rootpad');
});

test('de vier wereldkaarten en inloggen wijzen naar de echte app', () => {
  const verwacht = {
    living: '/apps/rtg.html',
    travel: '/apps/reizen.html',
    work: '/apps/kantoor.html',
    foundation: '/apps/foundation/index.html'
  };
  for (const [wereld, doel] of Object.entries(verwacht)) {
    const patroon = new RegExp('data-app-path="' + doel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '" href="https://app\\.rahultravelgroup\\.com' + doel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '" data-world="' + wereld + '"');
    assert.match(HTML, patroon, wereld + ' opent zijn canonieke app-route');
  }
  assert.match(HTML, /data-app-path="\/apps\/app\.html" href="https:\/\/app\.rahultravelgroup\.com\/apps\/app\.html">Inloggen/);
});

test('iedere wereld heeft vanaf de startpagina een eigen verhaalpagina', () => {
  const werelden = {
    livingos: '/apps/rtg.html',
    travelos: '/apps/reizen.html',
    workos: '/apps/kantoor.html',
    foundationos: '/apps/foundation/index.html'
  };

  for (const [wereld, appPad] of Object.entries(werelden)) {
    const relatiefPad = './public/site/werelden/' + wereld + '.html';
    assert.match(HTML, new RegExp('href="' + relatiefPad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'),
      wereld + ' is vanaf zijn detailblok bereikbaar');

    const bestand = path.join(ROOT, 'public/site/werelden', wereld + '.html');
    assert.ok(fs.existsSync(bestand), relatiefPad + ' bestaat');
    const wereldHtml = fs.readFileSync(bestand, 'utf8');
    assert.match(wereldHtml, /href="\.\.\/start\/start-base\.css"/,
      wereld + ' gebruikt de gedeelde merkbasis');
    assert.match(wereldHtml, /href="\.\/world\.css\?v=\d+"/,
      wereld + ' gebruikt het gedeelde wereldontwerp');
    assert.match(wereldHtml, /href="\.\.\/\.\.\/\.\.\/#werelden"/,
      wereld + ' wijst terug naar het wereldenoverzicht');
    assert.ok(wereldHtml.includes('https://app.rahultravelgroup.com' + appPad),
      wereld + ' opent zijn canonieke app-route');
  }
});

test('iedere pas heeft vanaf de startpagina een eigen verhaalpagina', () => {
  const passen = {
    community: '/apps/app.html?pas=guest',
    'rtg-pass': '/apps/app.html?pas=rtg',
    'business-lite': '/apps/kantoor.html',
    'business-pass': '/apps/app.html?pas=business',
    'lifestyle-pass': '/apps/app.html?pas=lifestyle'
  };

  for (const [pas, appPad] of Object.entries(passen)) {
    const relatiefPad = './public/site/passen/' + pas + '.html';
    assert.ok(HTML.includes('href="' + relatiefPad + '"'),
      pas + ' is vanaf zijn prijskaart bereikbaar');

    const bestand = path.join(ROOT, 'public/site/passen', pas + '.html');
    assert.ok(fs.existsSync(bestand), relatiefPad + ' bestaat');
    const pasHtml = fs.readFileSync(bestand, 'utf8');
    assert.match(pasHtml, /href="\.\.\/start\/start-base\.css"/,
      pas + ' gebruikt de gedeelde merkbasis');
    assert.match(pasHtml, /href="\.\.\/werelden\/world\.css\?v=\d+"/,
      pas + ' gebruikt het gedeelde verhaalontwerp');
    assert.match(pasHtml, /href="\.\/pass\.css\?v=\d+"/,
      pas + ' gebruikt het gedeelde pasontwerp');
    assert.match(pasHtml, /href="\.\.\/\.\.\/\.\.\/#passen"/,
      pas + ' wijst terug naar het passenoverzicht');
    assert.ok(pasHtml.includes('https://app.rahultravelgroup.com' + appPad),
      pas + ' opent zijn passende RTG-ingang');
  }
});

test('alle lokale HTML- en stylesheetassets zijn projectpad-relatief en bestaan', () => {
  const lokaal = [...HTML.matchAll(/(?:src|href)="(\.\/public\/[^"?#]+)["?#]/g)].map(m => m[1]);
  assert.ok(lokaal.length >= 6, 'de landing noemt zijn lokale bladen, scripts en icoon');
  for (const url of lokaal) {
    assert.ok(fs.existsSync(path.join(ROOT, url.slice(2))), url + ' bestaat');
  }

  for (const cssRelatief of [
    'public/site/start/start-base.css',
    'public/site/start/start-layout.css',
    'public/site/start/start-responsive.css',
    'public/site/werelden/world.css',
    'public/site/passen/pass.css'
  ]) {
    const bestand = path.join(ROOT, cssRelatief);
    const css = fs.readFileSync(bestand, 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      assert.ok(!match[1].startsWith('/'), cssRelatief + ' gebruikt geen root-absoluut assetpad');
      assert.ok(fs.existsSync(path.resolve(path.dirname(bestand), match[1])),
        cssRelatief + ': ' + match[1] + ' bestaat');
    }
  }
});

test('de lokale klok kiest ochtend, middag, avond en nacht op vaste grenzen', () => {
  assert.equal(start.dagdeelVoorUur(4.99), 'nacht');
  assert.equal(start.dagdeelVoorUur(5), 'ochtend');
  assert.equal(start.dagdeelVoorUur(11.99), 'ochtend');
  assert.equal(start.dagdeelVoorUur(12), 'middag');
  assert.equal(start.dagdeelVoorUur(17.99), 'middag');
  assert.equal(start.dagdeelVoorUur(18), 'avond');
  assert.equal(start.dagdeelVoorUur(22.99), 'avond');
  assert.equal(start.dagdeelVoorUur(23), 'nacht');
});

test('ieder dagdeel wisselt de hero én alle vier kaartfoto’s echt', () => {
  const dagdelen = ['ochtend', 'middag', 'avond', 'nacht'];
  const sleutels = ['hero', 'living', 'travel', 'work', 'foundation'];
  for (const sleutel of sleutels) {
    const paden = dagdelen.map(dagdeel => start.beeldsetVoorDagdeel(dagdeel)[sleutel]);
    assert.equal(new Set(paden).size, 4, sleutel + ' gebruikt vier verschillende beeldbestanden');
    for (const padVanBeeld of paden) {
      assert.ok(fs.existsSync(path.join(ROOT, 'public', padVanBeeld)), padVanBeeld + ' bestaat');
    }
  }
});

test('alle landingsbeelden hebben aantoonbare lokale herkomst', () => {
  const dagdelen = ['ochtend', 'middag', 'avond', 'nacht'];
  const herkomstPad = path.join(ROOT, 'public/images/start/dagdelen/HERKOMST.json');
  const herkomst = JSON.parse(fs.readFileSync(herkomstPad, 'utf8'));
  assert.match(herkomst.generator, /OpenAI ImageGen/);
  assert.equal(herkomst.bestanden.length, 4);

  for (const dagdeel of dagdelen) {
    const set = start.beeldsetVoorDagdeel(dagdeel);
    const naam = path.basename(set.hero);
    const rij = herkomst.bestanden.find(item => item.bestand === naam && item.dagdeel === dagdeel);
    assert.ok(rij, naam + ' staat met het juiste dagdeel in het herkomstregister');
    const inhoud = fs.readFileSync(path.join(ROOT, 'public', set.hero));
    assert.equal(crypto.createHash('sha256').update(inhoud).digest('hex'), rij.sha256,
      naam + ' is byte voor byte het geregistreerde beeld');

    for (const rol of ['living', 'travel', 'work', 'foundation']) {
      assert.match(set[rol], /^campagne\//,
        dagdeel + ' ' + rol + ' gebruikt alleen de bestaande RTG-campagnebank met generatieherkomst');
    }
  }
});
