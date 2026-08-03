/* Scherm-test voor de gedeelde poort (shared/deur.js).

   Veertien apps toonden aan wie er niet in mag precies een zin -- "Alleen
   met de Lifestyle Pass" -- zonder knop, zonder uitleg, zonder weg vooruit.
   Dat leest als een lege app terwijl er een hele app achter zit.

   Wat deze toets vastlegt:
   1. de poort vertelt WAT er achter zit, uit de app-gids die de pagina al
      heeft (dus geen tweede plek met dezelfde waarheid);
   2. hij noemt de ECHTE weg naar binnen, met een werkende link;
   3. en hij belooft NOOIT toegang. Dat is een merkregel (de Lifestyle- en
      Business Pass gaan alleen na menselijke goedkeuring, en de AI mag
      daar niet op vooruitlopen) en hij hoort dus door een machine bewaakt
      te worden, niet alleen door een document.
   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

// wat een poort NOOIT mag zeggen: alles wat klinkt als zelf toegang geven
const BELOFTES = [/u krijgt (?:de |een )?(?:pas|toegang)/i, /wij? (?:geven|verlenen) u toegang/i,
  /toegang aanvragen en direct/i, /meteen toegang/i, /wordt (?:direct|meteen) geopend/i];

test('poort: toont wat erachter zit, de weg naar binnen, en belooft nooit toegang',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    // een gewoon RTG-lid: dat mag bewust NIET in een Lifestyle-app
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Poortlid', email: 'pt' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/cercle.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/cercle.html', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('.rtgdeur', { timeout: 10000 });
    // de gids komt na een verzoek binnen; wacht tot de punten er staan
    await page.waitForFunction(() => document.querySelectorAll('.rtgdeur li').length >= 2, null, { timeout: 10000 });

    const p = await page.evaluate(() => {
      const el = document.querySelector('.rtgdeur');
      return { kop: el.querySelector('h2').textContent.trim(),
        punten: [...el.querySelectorAll('li')].map(l => l.textContent.trim()),
        weg: el.querySelector('.rtgdeur-weg').textContent.trim(),
        links: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')),
        tekst: el.innerText };
    });

    /* 1. wat er achter zit, uit de gids van deze app zelf */
    assert.equal(p.kop, 'Cercle', 'de poort noemt de app bij naam');
    assert.ok(p.punten.length >= 2, 'de poort toont wat je er straks doet, kreeg: ' + p.punten.join(' | '));
    assert.ok(/kring/i.test(p.tekst), 'de inhoud komt van deze app (Cercle gaat over een kring)');

    /* 2. de echte weg naar binnen, met een link die bestaat */
    assert.ok(/uitnodiging|goedkeuring/i.test(p.weg), 'de poort zegt hoe de pas werkt: ' + p.weg);
    assert.ok(p.links.includes('/apps/rtg.html'), 'met een link naar de toegangsregels, kreeg: ' + p.links.join(', '));
    const r = await fetch(base + '/apps/rtg.html');
    assert.equal(r.status, 200, 'en die pagina bestaat echt');

    /* 3. de merkregel: nooit zelf toegang beloven */
    for (const b of BELOFTES) {
      assert.ok(!b.test(p.tekst), 'de poort belooft toegang (' + b + ') in: ' + p.tekst);
    }
    assert.ok(/mensen bij RTG|niet deze app/i.test(p.weg), 'en zegt expliciet waar het besluit valt');

    /* en de oude doodlopende zin is echt weg */
    assert.ok(p.tekst.length > 200, 'de poort is meer dan een zin (' + p.tekst.length + ' tekens)');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De RTFoundation-kant, en de ergste vorm van de oude poort: daar werd je
   zonder een woord naar de voorpagina GEGOOID (location.href = index.html
   in Sessie.eisProfiel). Je verloor dus ook nog waar je heen wilde. Deze
   toets legt vast dat je blijft staan waar je was, met een deur die
   vertelt wat de app is en hoe je binnenkomt. */
test('deur: een RTF-app zonder gezinssessie gooit je niet weg maar legt het uit',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(base + '/apps/foundation/klusjes.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtgdeur', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('.rtgdeur li').length >= 2, null, { timeout: 10000 });

    const p = await page.evaluate(() => {
      const el = document.querySelector('.rtgdeur');
      return { pad: location.pathname, tekst: el.innerText,
        links: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')) };
    });

    // 1. je blijft op de app die je koos -- dit is de kern van de reparatie
    assert.match(p.pad, /klusjes\.html$/, 'je blijft op de app staan, kreeg: ' + p.pad);
    // 2. met de inhoud van DEZE app uit zijn eigen gids
    assert.ok(/klusje|sterren/i.test(p.tekst), 'de deur vertelt over deze app: ' + p.tekst.slice(0, 120));
    // 3. en een weg naar binnen die bestaat
    assert.ok(p.links.some(h => /foundation\/index\.html/.test(h)),
      'met een weg naar het gezin, kreeg: ' + p.links.join(', '));
    const r = await fetch(base + '/apps/foundation/index.html');
    assert.equal(r.status, 200, 'en die pagina bestaat');
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
