/* De RTG ID-ballotage in haar echte browserstand: op een telefoon blijft de
   vraag boven de Edge-onderrand; op een breed scherm gebruikt identiteit links
   en gesprek rechts de ruimte. De proef vult uitsluitend twee niet-persoonlijke
   voorbeeldzinnen in en maakt geen account aan. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser
} = require('./helper');

const pw = laadPlaywright();
const ROOT = path.join(__dirname, '..');
const APPS = path.join(ROOT, 'public', 'apps');
const WERELDEN = new Set(['living', 'travel', 'work', 'foundation']);
const leesPad = (bestand) => fs.readFileSync(bestand, 'utf8');
const lees = (bestand) => leesPad(path.join(ROOT, bestand));

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
    const bron = leesPad(bestand);
    const omleiding = omleidingVan(bron);
    if (omleiding) { omleidingen.push([bestand, omleiding]); continue; }
    if (/\bdata-rtg-projectie\b/i.test(bodyVan(bron))) { projecties.push(bestand); continue; }

    zelfstandig.push(bestand);
    const relatief = path.relative(ROOT, bestand);
    assert.ok(WERELDEN.has(wereldVan(bron)), relatief + ' mist een geldige wereldkleur');
    const tag = basisTag(bron);
    assert.ok(tag, relatief + ' mist de centrale basislaag voor Edge');
    assert.ok(/\bdefer\b/i.test(tag) || bron.indexOf(tag) > bron.search(/<body\b/i),
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
    const doelbron = leesPad(doelbestand);
    assert.ok(WERELDEN.has(wereldVan(doelbron)), doelpad + ' mist een geldige wereldkleur');
    assert.ok(basisTag(doelbron), doelpad + ' erft de centrale Edge niet');
  }

  assert.equal(zelfstandig.length + omleidingen.length + projecties.length, alle.length);
});

test('de universele laadketen bouwt exact een Edge-casco', () => {
  const basis = lees('public/shared/basis.js');
  const randen = lees('public/shared/randen.js');
  const systeem = lees('public/shared/rtg-edge-system.js');
  const bibliotheek = lees('public/shared/rtg-edge-library.js');

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

const VORM = lees('public/apps/app-main/app-main-04aaaa.js') +
  lees('public/apps/app-main/app-main-04aaaaa.js');
const INHOUD = lees('public/apps/app-main/app-main-04b.js');
const GEDRAG = lees('public/apps/app-main/app-main-05.js');
const EDGE = lees('public/shared/rtg-edge-library.js');

test('RTG ID gebruikt op breed en klein scherm dezelfde Edge-insets', () => {
  assert.match(VORM, /#gate:has\(\.ag-doos\.ag-ballotage\)/);
  assert.match(VORM, /var\(--edge-top,44px\)/);
  assert.match(VORM, /var\(--edge-bottom,48px\)/);
  assert.match(VORM, /grid-template-columns:minmax\(20rem,1fr\) minmax\(27rem,\.88fr\)/);
  assert.match(VORM, /@media \(max-width:899px\)/);
  assert.match(VORM, /--klokschaal:\.42/);
});

test('het officiële RTG-woordmerk ligt zonder eigen kleurvlak in de Edge-balk', () => {
  assert.match(EDGE, /rtg-edge-mark-lockup/);
  assert.match(EDGE, /Rahul Travel Group/);
  assert.match(EDGE, /Experience the elite class/);
  assert.match(VORM, /\.rtg-edge-mark-lockup strong/);
  assert.match(VORM, /\.rtg-edge-top\{[^}]*background:var\(--edge-bar-bg\)!important/);
  assert.match(VORM, /\.rtg-edge-mark\{[^}]*background:transparent!important/);
  assert.match(VORM, /\.rtg-edge-mark-lockup strong\{[^}]*background:transparent!important/);
  assert.match(VORM, /color:#d8bd6b/);
});

test('de ballotage gebruikt geen tweede functierail of Command-laag', () => {
  assert.match(VORM, /\.rtg-edge-side\{[^}]*transform:translateX\(-101%\)!important;visibility:hidden/);
  assert.match(VORM, /#rtgCommand \.cmd-bank/);
  assert.match(VORM, /#rtgCommand \.cmd-balk\{display:none!important/);
});

test('de ballotage geeft de vraag prioriteit en behoudt Rahuls signatuur', () => {
  assert.match(VORM, /\.ag-doos\.ag-ballotage \.ag-zin/);
  assert.match(VORM, /text-align:left/);
  assert.match(VORM, /\.ag-doos\.ag-ballotage \.ag-mond/);
  assert.doesNotMatch(VORM, /\.ag-doos\.ag-ballotage \.ag-mond\{[^}]*display:none/);
  assert.match(VORM, /#f4ede1/);
  assert.match(VORM, /\.rtg-id-story h1/);
  assert.match(INHOUD, /Uw toegang begint met een gesprek/);
  assert.match(INHOUD, /ag-id-privacy/);
});

test('de vier stappen zijn ook voor hulptechnologie betekenisvol', () => {
  assert.match(INHOUD, /id="agStappen" role="status" aria-live="polite"/);
  assert.match(GEDRAG, /T\('ag\.stap','Stap'\)/);
  assert.match(GEDRAG, /T\('ag\.van','van'\)/);
  assert.match(GEDRAG, /removeAttribute\('aria-label'\)/);
});

test('RTG ID vormt op telefoon en bureau een familie met de ene Edge',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-id-vorm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const maat of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport: maat });
      await context.addInitScript(() => {
        try { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      });
      const page = await context.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(srv.base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#agAnders', { state: 'visible', timeout: 15000 });
      await page.click('#agAnders');
      await page.waitForSelector('#agIn', { state: 'visible' });
      await page.fill('#agIn', 'ik wil me aanmelden');
      await page.click('#agGo');
      await page.waitForFunction(() => /Hoe gaat het vandaag/i.test(document.getElementById('agZin')?.textContent || ''));
      await page.fill('#agIn', 'goed');
      await page.click('#agGo');
      await page.waitForSelector('.ag-doos.ag-ballotage', { state: 'visible' });
      await page.waitForSelector('body[data-rtg-edge-2-rendered="true"]', { timeout: 15000 });

      const stand = await page.evaluate(() => {
        const rect = (el) => {
          const r = el && el.getBoundingClientRect();
          return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            width: r.width, height: r.height } : null;
        };
        const top = document.querySelector('.rtg-edge-top');
        const onder = document.querySelector('.rtg-edge-bottom');
        const vraag = document.getElementById('agZin');
        const rij = document.querySelector('.ag-doos.ag-ballotage .ag-rij');
        const stappen = document.getElementById('agStappen');
        const klok = document.querySelector('#gate>.os-lock .rtg-ring');
        const merk = document.querySelector('.rtg-edge-mark-lockup');
        const merkLink = document.querySelector('.rtg-edge-mark');
        const merkWoord = document.querySelector('.rtg-edge-mark-lockup strong');
        const verhaal = document.querySelector('.rtg-id-story');
        const verhaalKop = document.querySelector('.rtg-id-story h1');
        const intro = document.querySelector('.ag-doos.ag-ballotage .ag-intro');
        const kaart = document.querySelector('.ag-doos.ag-ballotage');
        const rail = document.querySelector('.rtg-edge-side');
        const commandBank = document.querySelector('#rtgCommand .cmd-bank');
        const commandBar = document.querySelector('#rtgCommand .cmd-balk');
        return {
          top: rect(top), onder: rect(onder), vraag: rect(vraag), rij: rect(rij),
          stappen: rect(stappen), klok: rect(klok),
          merk: rect(merk), merkTekst: merk && merk.textContent.replace(/\s+/g, ' ').trim(),
          verhaal: rect(verhaal), verhaalKop: rect(verhaalKop), kaart: rect(kaart),
          merkVlak: merkLink && getComputedStyle(merkLink).backgroundColor,
          woordVlak: merkWoord && getComputedStyle(merkWoord).backgroundColor,
          kaartKleur: kaart && getComputedStyle(kaart).backgroundColor,
          vraagKleur: vraag && getComputedStyle(vraag).backgroundColor,
          introKleur: intro && getComputedStyle(intro).backgroundColor,
          rijKleur: rij && getComputedStyle(rij).backgroundColor,
          railZichtbaar: rail && getComputedStyle(rail).visibility !== 'hidden',
          commandZichtbaar: [commandBank, commandBar].some(el => el && getComputedStyle(el).display !== 'none'),
          bovenkleur: top && getComputedStyle(top).backgroundColor,
          onderkleur: onder && getComputedStyle(onder).backgroundColor,
          label: stappen && stappen.getAttribute('aria-label'),
          randen: document.querySelectorAll('.rtg-edge-chrome').length
        };
      });

      assert.equal(stand.randen, 1, maat.width + ': precies een Edge-casco');
      assert.equal(stand.bovenkleur, stand.onderkleur, maat.width + ': boven en onder delen LivingOS-kleur');
      assert.equal(stand.label, 'Stap 1 van 4', maat.width + ': voortgang heeft betekenis');
      assert.ok(stand.merk && /Rahul Travel Group/i.test(stand.merkTekst),
        maat.width + ': het officiële woordmerk staat in de Edge-link');
      assert.equal(stand.merkVlak, 'rgba(0, 0, 0, 0)', maat.width + ': logo heeft geen eigen kleurvlak');
      assert.equal(stand.woordVlak, 'rgba(0, 0, 0, 0)', maat.width + ': woordmerk erft de balkkleur');
      assert.ok(stand.verhaal && stand.kaart && /244, 237, 225/.test(stand.kaartKleur),
        maat.width + ': verhaal en ivoorkleurige ballotagekaart staan in beeld');
      assert.equal(stand.vraagKleur, stand.kaartKleur,
        maat.width + ': achter de vraag ligt exact hetzelfde ivoor als op de kaart');
      assert.equal(stand.introKleur, stand.kaartKleur,
        maat.width + ': de vraagzone vormt geen lichter tekstvak');
      assert.equal(stand.rijKleur, 'rgba(0, 0, 0, 0)',
        maat.width + ': ook het antwoordveld voegt geen tweede vulkleur toe');
      assert.equal(stand.railZichtbaar, false, maat.width + ': geen tweede functierail tijdens RTG ID');
      assert.equal(stand.commandZichtbaar, false, maat.width + ': geen oude Command-laag tijdens RTG ID');
      assert.ok(stand.vraag && stand.rij && stand.stappen && stand.klok, maat.width + ': alle onderdelen staan in beeld');
      assert.ok(stand.vraag.top > stand.top.bottom - 1, maat.width + ': de vraag blijft onder Edge');
      assert.ok(stand.vraag.bottom <= stand.rij.top + 1, maat.width + ': de handeling volgt de vraag');
      assert.ok(stand.rij.bottom <= stand.stappen.top + 1, maat.width + ': voortgang volgt de handeling');
      assert.ok(stand.stappen.bottom < stand.onder.top + 1, maat.width + ': voortgang blijft boven Edge');
      if (maat.width < 900) {
        assert.ok(stand.vraag.left >= 12 && stand.vraag.right <= maat.width - 12,
          'telefoon: de vraag blijft binnen het leesvlak');
      } else {
        assert.ok(stand.klok.right < stand.vraag.left,
          'bureau: identiteit staat links en het gesprek rechts');
        const optischeTekstas = stand.verhaalKop.left + stand.verhaalKop.width * .43;
        assert.ok(Math.abs((stand.klok.left + stand.klok.right) / 2 - optischeTekstas) < 16,
        'bureau: de klok staat op het optische midden van de tekst (' +
          ((stand.klok.left + stand.klok.right) / 2).toFixed(1) + ' tegenover ' +
          optischeTekstas.toFixed(1) + ')');
      }
      assert.deepEqual(fouten, [], maat.width + ': geen paginof beloftefouten');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
