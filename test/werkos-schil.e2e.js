/* De vaste WerkOS-schil moet op elke breedte dezelfde drie bedieningslagen
   houden. Deze componenttoets gebruikt het echte gedeelde script, maar een
   klein tabmodel: zo bewaken we navigatie en maatvoering zonder inlogdata. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { letOpFouten } = require('./helper');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();
const script = path.join(__dirname, '..', 'public', 'shared', 'werkos.js');

const basisStijl = `
  :root{--rtg-bg:#0c0c0b;--rtg-grond:#0c0c0b;--rtg-txt:#f2efe9;--rtg-muted:#aaa59d;--rtg-soft:#6f6a63;--rtg-line:#302e2a;--rtg-goud:#b7a35c;--gold-rand:#7d7040;--gold-tekst:#c8b978;--gold-basis:#857007}
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--rtg-bg);color:var(--rtg-txt);font-family:Arial,sans-serif}
  #app{min-height:100vh}.topbar{height:auto;min-height:64px;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--rtg-line)}
  .content{min-height:calc(100vh - 64px);padding:24px}.view{display:none}.view.active{display:block}.host{display:block}.tabbar{display:flex}.extra{display:none}
`;

async function tabSchil(page) {
  await page.setContent(`<!doctype html><html><head><style>${basisStijl}</style></head><body>
    <div id="app" class="active"><header class="topbar"><span class="host">RTG Werkplek</span><span>Medewerker</span></header>
      <main class="content"><section class="view active" data-view="home"><h1>Werktafel</h1></section>
        <section class="view" data-view="orders"><h1>Orders</h1></section><section class="view" data-view="audit"><h1>Audit</h1></section></main>
      <nav class="tabbar" id="tabbar"><button class="active" data-tab="home"><svg viewBox="0 0 24 24"><path d="M3 12h18"/></svg>Home</button>
        <button data-tab="orders"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>Orders</button>
        <button data-tab="taken"><svg viewBox="0 0 24 24"><path d="M4 8h16"/></svg>Taken</button>
        <button data-tab="team"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/></svg>Team</button>
        <button data-tab="hulp"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>Hulp</button>
        <button data-tab="meer"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1"/></svg>Meer</button></nav>
    </div><div class="extra" id="extra"><button data-goto2="audit"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5z"/></svg>Audit</button></div>
  </body></html>`);
  await page.addScriptTag({ path: script });
  await page.evaluate(() => {
    const open = tab => {
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
      document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === (tab === 'audit' ? 'meer' : tab)));
    };
    document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => open(b.dataset.tab)));
    document.querySelector('[data-goto2="audit"]').addEventListener('click', () => open('audit'));
    WerkOS.koppel({ thuisTab:'home', dock:['orders','taken','team','hulp','meer'], verberg:['meer'], extra:{ houder:'#extra', knop:'button' } });
  });
  await page.waitForSelector('.wos-rail', { state:'visible' });
}

test('WerkOS: boven-, linker- en onderbalk werken op desktop en mobiel',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const browser = await pw.chromium.launch({ args:['--no-sandbox'] });
  try {
    for (const viewport of [{ width:1280, height:720 }, { width:320, height:700 }]) {
      const page = await browser.newPage({ viewport });
      const fouten = []; letOpFouten(page, fouten);
      await tabSchil(page);
      for (const selector of ['.wos-rail', '.wos-top-context', '.wos-dock'])
        assert.equal(await page.locator(selector).isVisible(), true, selector + ' is zichtbaar');

      await page.click('.wos-rail button[data-tab="audit"]');
      await page.waitForSelector('.view[data-view="audit"].active');
      assert.equal(await page.textContent('.wos-top-huidig b'), 'Audit');
      assert.equal(await page.getAttribute('.wos-rail button[data-tab="audit"]', 'aria-current'), 'page');

      const vak = await page.locator('.wos-dock').boundingBox();
      assert.ok(vak && vak.x >= 0 && vak.x + vak.width <= viewport.width + 1, 'de onderbalk blijft binnen het scherm');
      assert.equal(await page.locator('.wos-dock button:last-child').isVisible(), true, 'Command Center blijft bereikbaar');
      if (viewport.width <= 620) {
        const rail = await page.locator('.wos-rail').boundingBox();
        assert.ok(rail && Math.abs(rail.width - 50) < 1, 'de mobiele rail is compact en bedekt de inhoud niet');
        const context = await page.locator('.wos-top-context').boundingBox();
        const host = await page.locator('.topbar .host').boundingBox();
        assert.ok(context && host && context.y + context.height <= host.y + 1, 'de mobiele bovenbalk bedekt de appkop niet');
        assert.ok(context.x < 70 && context.x + context.width <= viewport.width, 'de mobiele bovenbalk benut de volle werkbreedte');
      }

      await page.click('.wos-top-context button:last-child');
      await page.waitForSelector('.wos-zoek.open');
      assert.equal(await page.locator('.wos-zoek input').evaluate(e => e === document.activeElement), true, 'zoeken krijgt focus');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.wos-zoek').isVisible(), false, 'Escape sluit Command Center');
      assert.deepEqual(fouten, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('WerkOS: backofficepanelen bedienen dezelfde schil op mobiel',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const browser = await pw.chromium.launch({ args:['--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:320, height:700 } });
  const fouten = []; letOpFouten(page, fouten);
  try {
    await page.setContent(`<!doctype html><html><head><style>${basisStijl}header{min-height:64px;padding:14px 20px}.wrap{display:flex;justify-content:space-between}#app{padding:20px}.panel{min-height:540px;border-bottom:1px solid #302e2a}</style></head><body>
      <header><div class="wrap"><b>RTG Backoffice</b><span>Live</span></div></header><main id="app" class="on"><section class="panel"><h2>Actiecentrum</h2></section><section class="panel"><h2>Vakbewijzen</h2></section></main></body></html>`);
    await page.addScriptTag({ path: script });
    await page.evaluate(() => {
      window.RTGGlyf = { svg:() => { const n=document.createElementNS('http://www.w3.org/2000/svg','svg'); n.setAttribute('viewBox','0 0 24 24'); return n; }, svgHTML:() => '<svg viewBox="0 0 24 24"></svg>' };
      const panelen = [...document.querySelectorAll('.panel')];
      WerkOS.bord({ apps:[{ naam:'Actiecentrum', glyf:'paneel', el:panelen[0] }, { naam:'Vakbewijzen', glyf:'paneel', el:panelen[1] }] });
    });
    await page.click('.wos-rail button[aria-label="Vakbewijzen"]');
    assert.equal(await page.textContent('.wos-top-huidig b'), 'Vakbewijzen');
    assert.equal(await page.locator('.wos-rail button[aria-label="Vakbewijzen"]').evaluate(e => e.classList.contains('actief')), true);
    await page.click('.wos-top-context button:last-child');
    assert.equal(await page.locator('.wos-bord').isVisible(), true);
    assert.equal(await page.locator('.wos-bord-sluit').evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.wos-bord').isVisible(), false);
    assert.deepEqual(fouten, []);
  } finally { await page.close(); await browser.close(); }
});
