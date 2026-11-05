/* Gerichte ontwikkelcontrole van twee herstelpaden. De pagina's en geslaagde
   antwoorden komen van de lokale testserver; fouten worden in de browser
   geïnjecteerd. Dit is geen volledige scherm- of menselijke kwalificatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, zaak, ghost, vloot, eerste, tweede;

async function post(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  const data = await r.json();
  assert.equal(r.status, 200, pad + ': ' + JSON.stringify(data));
  return data;
}
async function open(token = zaak) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(t => {
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_sup_token', t);
  }, token);
  const page = await ctx.newPage(), fouten = [];
  letOpFouten(page, fouten, { eigenZeef: true });
  return { ctx, page, fouten };
}
const antwoord = (route, status, body) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body)
});

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'MKKX' });
  zaak = (await post('/api/supplier/login', {
    code: 'MKKX', staffId: roster.staff.find(s => s.role === 'manager').id, pin: '1234'
  })).token;
  assert.ok(zaak);
  ghost = await post('/api/supplier/ghost', {}, zaak);
  for (const naam of ['Eerste herstelwagen', 'Tweede herstelwagen']) {
    const asset = (await post('/api/supplier/mob/voertuig', {
      categorie: 'taxi', naam, loc: { lat: 38.909, lng: 1.433 }, energieNiveau: 80
    }, zaak)).asset;
    assert.ok(asset && asset.id);
    if (!eerste) eerste = asset; else tweede = asset;
  }
  vloot = await post('/api/supplier/mob/vloot', {}, zaak);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('Ghost: anoniem en 401 vragen zaak-inlog; 403 toont de toegangsreden', { skip }, async () => {
  for (const code of [null, 401, 403]) {
    const { ctx, page, fouten } = await open(code === null ? null : zaak);
    try {
      let aanvragen = 0;
      await page.route('**/api/supplier/ghost', route => {
        aanvragen++;
        return antwoord(route, code, { error: 'De persoonscontrole staat deze toegang niet toe.' });
      });
      await page.goto(srv.base + '/apps/ghost.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(code === 403 ? '#vStatus:not([hidden]) #ghostZaak:not([hidden])' : '#vPoort:not([hidden])');
      assert.equal(await page.locator('#vGhost').isHidden(), true);
      assert.equal(await page.locator('#ghostHerstel').isHidden(), true);
      if (code === 403) {
        assert.equal(await page.locator('#vPoort').isHidden(), true);
        assert.match(await page.textContent('#vStatusTitel'), /Geen toegang/);
        assert.match(await page.textContent('#vStatusTekst'), /persoonscontrole/);
        assert.equal(await page.locator('#ghostZaak').getAttribute('href'), '/apps/leverancier.html');
      } else assert.match(await page.textContent('#vPoort'), /inlog van uw zaak/);
      assert.equal(aanvragen, code === null ? 0 : 1);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});

test('Ghost: netwerk- en serverfouten tonen herstel; opnieuw proberen laadt echte voorspelling', { skip }, async () => {
  for (const defect of ['netwerk', 500, 503, 429, 'onvolledig', 'geen-json']) {
    const { ctx, page, fouten } = await open();
    try {
      let herstel = false;
      const aanvragen = [];
      await page.route('**/api/supplier/ghost', route => {
        aanvragen.push({ methode: route.request().method(), auth: route.request().headers().authorization, body: route.request().postData() });
        if (herstel) return antwoord(route, 200, ghost);
        if (defect === 'netwerk') return route.abort('failed');
        if (defect === 'geen-json') return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Niet beschikbaar</h1>' });
        return antwoord(route, typeof defect === 'number' ? defect : 200, { error: 'Tijdelijk niet beschikbaar.' });
      });
      await page.goto(srv.base + '/apps/ghost.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#ghostHerstel:not([hidden]):not([disabled])');
      assert.equal(await page.locator('#vPoort').isHidden(), true, String(defect) + ' is geen inlogprobleem');
      assert.equal(await page.locator('#vGhost').isHidden(), true);
      assert.equal(await page.locator('#ghostZaak').isHidden(), true);
      assert.match(await page.textContent('#vStatusTekst'), /probeer|Probeer/);
      assert.doesNotMatch(await page.locator('#vStatus').innerText(), /Rustig rijden|undefined|NaN/);
      assert.deepEqual(fouten, []);
      herstel = true;
      await page.locator('#ghostHerstel').click();
      await page.waitForSelector('#vGhost:not([hidden]) #uren [data-uur]');
      assert.equal(await page.locator('#vStatus').isHidden(), true);
      assert.equal(await page.locator('#uren [data-uur]').count(), ghost.uurbeeld.length);
      assert.match(await page.textContent('#bouwstenen'), /weerbeeld \(demo\)/);
      assert.deepEqual(aanvragen, [1, 2].map(() => ({ methode: 'POST', auth: 'Bearer ' + zaak, body: '{}' })));
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});

test('Voertuig: gekozen wagen blijft na Ververs geselecteerd, ook zonder aanvankelijk id', { skip }, async () => {
  for (const zoek of ['', '?voertuig=' + encodeURIComponent(eerste.id)]) {
    const { ctx, page, fouten } = await open();
    try {
      await page.goto(srv.base + '/apps/voertuig.html' + zoek, { waitUntil: 'domcontentloaded' });
      await page.locator('#vloot [data-voertuig="' + tweede.id + '"]').click();
      await page.locator('#ververs').click();
      await page.waitForFunction(() => document.querySelector('#melding').textContent === 'Bijgewerkt.');
      assert.equal(await page.locator('#vNaam').textContent(), tweede.naam);
      assert.equal(new URL(page.url()).searchParams.get('voertuig'), tweede.id);
      assert.equal(await page.locator('#vloot [data-voertuig="' + tweede.id + '"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#vloot [aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('#geen').isHidden(), true);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});

test('Voertuig: de eerste lading blokkeert Ververs tot het antwoord is verwerkt', { skip }, async () => {
  const { ctx, page, fouten } = await open();
  let vrijgeven;
  const wachten = new Promise(resolve => { vrijgeven = resolve; });
  let aanvragen = 0;
  try {
    await page.route('**/api/supplier/mob/vloot', async route => {
      aanvragen++;
      await wachten;
      return antwoord(route, 200, vloot);
    });
    await page.goto(srv.base + '/apps/voertuig.html?voertuig=' + encodeURIComponent(eerste.id), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ververs:disabled');
    await page.evaluate(() => document.querySelector('#ververs').click());
    assert.equal(await page.locator('#ververs').isDisabled(), true);
    vrijgeven();
    await page.waitForSelector('#dit:not([hidden])');
    await page.waitForSelector('#ververs:not([disabled])');
    assert.equal(aanvragen, 1, 'geen tweede lading naast de nog lopende eerste');
    assert.equal(await page.textContent('#vNaam'), eerste.naam);
    assert.deepEqual(fouten, []);
  } finally { vrijgeven(); await ctx.close(); }
});

test('Voertuig: mislukte verversing meldt geen succes en herstelt dezelfde keuze', { skip }, async () => {
  const { ctx, page, fouten } = await open();
  try {
    let defect = null;
    await page.route('**/api/supplier/mob/vloot', route => {
      if (defect === 'netwerk') return route.abort('failed');
      if (defect === 'onvolledig') return antwoord(route, 200, {});
      if (defect === 'verdwenen') return antwoord(route, 200, { ...vloot, assets: vloot.assets.filter(a => a.id !== tweede.id) });
      return antwoord(route, defect || 200, defect ? { error: 'De vloot is tijdelijk niet beschikbaar.' } : vloot);
    });
    await page.goto(srv.base + '/apps/voertuig.html?voertuig=' + encodeURIComponent(eerste.id), { waitUntil: 'domcontentloaded' });
    await page.locator('#vloot [data-voertuig="' + tweede.id + '"]').click();
    for (const fout of [503, 'netwerk', 'onvolledig', 'verdwenen']) {
      defect = fout;
      await page.locator('#ververs').click();
      await page.waitForFunction(() => document.querySelector('#melding').textContent.startsWith('Verversen mislukt.'));
      assert.equal(await page.locator('#dit').isHidden(), true, 'een oude voertuigstand blijft niet als actueel staan');
      assert.equal(await page.locator('#geen').isHidden(), false);
      assert.doesNotMatch(await page.textContent('#melding'), /Bijgewerkt\./);
      assert.equal(new URL(page.url()).searchParams.get('voertuig'), tweede.id);
      if (fout === 'verdwenen') assert.match(await page.textContent('#geenTekst'), /welke van de twee zegt dit scherm bewust niet/);
      assert.deepEqual(fouten, []);
      defect = null;
      await page.locator('#ververs').click();
      await page.waitForFunction(() => document.querySelector('#melding').textContent === 'Bijgewerkt.');
      assert.equal(await page.locator('#vNaam').textContent(), tweede.naam);
      assert.equal(await page.locator('#dit').isHidden(), false);
      assert.equal(await page.locator('#vloot [data-voertuig="' + tweede.id + '"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(fouten, []);
    }
  } finally { await ctx.close(); }
});
