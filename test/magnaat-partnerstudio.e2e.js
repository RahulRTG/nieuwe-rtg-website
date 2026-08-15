/* De Magnaat Partnerstudio in een echte browser.

   De kernproeven bewijzen de publicatie- en vier-ogenregels. Deze schermproef
   bewijst de ontbrekende gebruikersweg: een manager van een officiële partner
   opent zijn eigen digitale tweeling en neemt uitsluitend veilige publieke
   profielvelden over. Prijzen en klantgegevens mogen daarbij niet meekomen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}

const pw = laadBrowser();

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: res.status, body: await res.json() };
}

test('Magnaat Partnerstudio: een officiële partner bouwt zonder geld of klantdata',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-partnerstudio-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
  let browser;
  try {
    const rooster = await post(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const manager = (rooster.body.staff || []).find(x => x.role === 'manager');
    assert.ok(manager, 'de officiële demo-partner heeft een manager');
    const login = await post(base, '/api/supplier/login',
      { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
    assert.equal(login.status, 200);
    assert.ok(login.body.token, 'de manager ontvangt zijn eigen zaak-token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(token => {
      localStorage.setItem('rtg_sup_token', token);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.body.token);
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/magnaat-partnerstudio.html', { waitUntil: 'load' });
    await page.waitForSelector('#kpis .kpi:nth-child(5)', { timeout: 15000 });
    assert.equal(new URL(page.url()).pathname, '/apps/magnaat-partnerstudio.html',
      'de ingelogde partner blijft in zijn Partnerstudio');
    assert.match(await page.textContent('#heroName'), /Sal de Mar/i,
      'de tweeling hoort bij het bedrijf uit de eigen sessie');
    assert.match(await page.textContent('.rail-foot'), /geen geld, klantdossiers of productieacties/i,
      'de permanente simulatiegrens staat zichtbaar in het scherm');
    assert.match(await page.textContent('.guard'), /nul schrijfpaden naar orders, Pay of klantdata/i,
      'het scherm noemt ook de technisch afgedwongen air gap');

    const antwoord = page.waitForResponse(res =>
      res.url().endsWith('/api/supplier/magnaat/studio/importeer') && res.request().method() === 'POST',
    { timeout: 15000 });
    await page.click('#importProfile');
    const response = await antwoord;
    assert.equal(response.status(), 200, 'veilig importeren slaagt via de echte partnerroute');
    const data = await response.json();
    assert.equal(data.overgenomen.aanbod, 5, 'de vijf publieke menunamen worden trainingsaanbod');
    assert.equal(data.overgenomen.locaties, 0, 'zonder publieke ruimtes wordt geen locatie verzonnen');
    assert.ok(data.tweeling.aanbod.every(x => x.bevatPrijs === false &&
      !Object.hasOwn(x, 'price') && !Object.hasOwn(x, 'prijs')),
    'de digitale tweeling bevat aantoonbaar geen productieprijzen');

    await page.waitForSelector('#model.aan', { timeout: 5000 });
    await page.waitForFunction(() => /prijzen en klantdata zijn uitgesloten/i.test(
      document.getElementById('toast')?.textContent || ''), null, { timeout: 5000 });
    const model = await page.textContent('#modelLists');
    assert.match(model, /Gazpacho de sandia/i, 'het veilige trainingsaanbod verschijnt in de UI');
    assert.match(model, /zonder prijs/i, 'de UI zegt expliciet dat een prijs ontbreekt');
    assert.deepEqual(fouten, [], 'de Partnerstudio hoort zonder pagina- of consolefouten te werken');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stop(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
