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
  assert.match(HTML, /Vier werelden\.<br>Één samenhangend geheel\./);
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

test('de voordeur presenteert RTG eerst als B2B2C-platform', () => {
  assert.match(HTML, /B2B2C-platform/);
  assert.match(HTML, /organisaties, partners en mensen/);
  assert.match(HTML, /data-scene="Organisatie, partner en gebruiker"/);
  assert.match(HTML, /data-app-truth-screen="organisatie"/);
  assert.match(HTML, /data-app-truth-screen="partner"/);
  assert.match(HTML, /data-app-truth-screen="gebruiker"/);
  assert.match(HTML, /ECHTE APP-SCHERMEN/);
  assert.match(HTML, /data-app-path="\/apps\/partner-worden\.html"/);
  assert.doesNotMatch(HTML, /<iframe\b/i,
    'de www probeert de app niet door de framebeveiliging heen in te bedden');
});

test('Experience 2.0 gebruikt één interface voor drie kanten van het platform', () => {
  assert.match(HTML, /data-role-select="organisatie"/);
  assert.match(HTML, /data-role-select="partner"/);
  assert.match(HTML, /data-role-select="gebruiker"/);
  assert.equal((HTML.match(/class="scene platform-section role-experience/g) || []).length, 1);
});

test('de productstage toont alleen beelden uit de gecontroleerde appwaarheid', () => {
  const truth = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/site/website-truth.json'), 'utf8'));
  for (const screen of truth.platform) {
    assert.match(HTML, new RegExp('data-stage-screen="' + screen.id + '"'));
    assert.match(HTML, new RegExp(screen.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(HTML, /<iframe/i);
});

test('oorzaak en gevolg hebben vijf concrete stappen', () => {
  assert.equal((HTML.match(/data-flow-step="[0-4]"/g) || []).length, 5);
  assert.match(HTML, /GEBRUIKER[\s\S]*PARTNER[\s\S]*WORKOS[\s\S]*BETALING[\s\S]*ORGANISATIE/);
});

test('zoeken, graph en Explore zijn bedienbaar zonder zware bibliotheek', () => {
  assert.match(HTML, /id="commandDialog"/);
  assert.match(HTML, /data-graph-topic="restaurant"/);
  assert.match(HTML, /data-explore-world="work"/);
  assert.doesNotMatch(HTML, /three\.js|webgl|gsap/i);
});

test('de zelfstandige Explore-route leest dezelfde appwaarheid', () => {
  const explore = fs.readFileSync(path.join(ROOT, 'explore/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(ROOT, 'public/site/explore.js'), 'utf8');
  assert.match(explore, /Vier werelden/);
  assert.match(script, /website-truth\.json/);
  assert.match(script, /world\.tools/);
});

test('de vier wereldkaarten en inloggen wijzen naar de echte app', () => {
  const verwacht = {
    living: '/apps/rtg.html',
    travel: '/apps/reizen.html',
    work: '/apps/kantoor.html',
    foundation: '/apps/foundation/os-publiek.html'
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
    assert.match(wereldHtml, /href="\.\/world\.css\?v=[A-Za-z0-9._-]+"/,
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
    assert.match(pasHtml, /href="\.\.\/werelden\/world\.css\?v=[A-Za-z0-9._-]+"/,
      pas + ' gebruikt het gedeelde verhaalontwerp');
    assert.match(pasHtml, /href="\.\/pass\.css\?v=[A-Za-z0-9._-]+"/,
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

test('het dagdeel wisselt de hero; iedere wereld behoudt haar eigen context', () => {
  const dagdelen = ['ochtend', 'middag', 'avond', 'nacht'];
  const sleutels = ['hero', 'living', 'travel', 'work', 'foundation'];
  for (const sleutel of sleutels) {
    const paden = dagdelen.map(dagdeel => start.beeldsetVoorDagdeel(dagdeel)[sleutel]);
    assert.equal(new Set(paden).size, sleutel === 'hero' ? 4 : 1, sleutel + ' heeft een eigen beeldcontext');
    for (const padVanBeeld of paden) {
      assert.ok(fs.existsSync(path.join(ROOT, 'public', padVanBeeld)), padVanBeeld + ' bestaat');
    }
  }
});

test('redactionele beelden zijn uniek en komen overeen met hun herkomstregister', () => {
  const map = path.join(ROOT, 'public/images/editorial');
  const herkomst = JSON.parse(fs.readFileSync(path.join(map, 'PROVENANCE.json'), 'utf8'));
  const gezien = new Map();
  for (const beeld of herkomst) {
    assert.equal(path.basename(beeld.path), beeld.path);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(map, beeld.path))).digest('hex');
    assert.equal(hash, beeld.sha256, beeld.path + ' heeft de geregistreerde bytes');
    assert.ok(!gezien.has(hash), beeld.path + ' is geen kopie van ' + gezien.get(hash));
    gezien.set(hash, beeld.path);
    assert.ok(beeld.prompt && beeld.illustrative === true, beeld.path + ' heeft expliciete generatieherkomst');
  }
  assert.deepEqual(fs.readdirSync(map).filter(naam => naam.endsWith('.webp')).sort(),
    herkomst.map(beeld => beeld.path).sort(), 'ieder redactioneel beeld is geregistreerd');
});

test('alle landingsbeelden hebben aantoonbare lokale herkomst', () => {
  const dagdelen = ['ochtend', 'middag', 'avond', 'nacht'];
  const herkomst = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/images/editorial/PROVENANCE.json'), 'utf8'));

  for (const dagdeel of dagdelen) {
    const set = start.beeldsetVoorDagdeel(dagdeel);
    const naam = path.basename(set.hero);
    const rij = herkomst.find(item => item.path === naam);
    assert.ok(rij, naam + ' staat in het herkomstregister');
    const inhoud = fs.readFileSync(path.join(ROOT, 'public', set.hero));
    assert.equal(crypto.createHash('sha256').update(inhoud).digest('hex'), rij.sha256,
      naam + ' is byte voor byte het geregistreerde beeld');

    for (const rol of ['living', 'travel', 'work', 'foundation']) {
      const beeld = herkomst.find(item => item.path === path.basename(set[rol]));
      assert.ok(beeld, rol + ' heeft generatieherkomst');
      assert.equal(beeld.tool, 'built-in image_gen');
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public', set[rol]))).digest('hex'), beeld.sha256);
    }
  }
});
