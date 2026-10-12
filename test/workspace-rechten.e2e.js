/* Het Second Screen in een echte browser: het toont een module pas als de
   SERVER de permissie gaf (kern/workspace-rechten.js), en niets daarvoor.

   Drie rondes met hetzelfde lid. Gewoon: het antwoord komt en Travel en RTG
   Veilig verschijnen. Vertraagd en beperkt: zolang het antwoord onderweg is,
   staat geen van beide er, en daarna alleen wat de server toestond. Onbereikbaar:
   dan blijft alles met een eis dicht -- een storing opent niets.
   Overgeslagen zonder browser. Draai: node --test test/workspace-rechten.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rechten Proef', email: 'rechten' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }) }).then(x => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then(x => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Rechten Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200);
  return r.token;
}

test('het Second Screen toont alleen wat de server toestond', { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wsrechten-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const token = await lid(srv.base);
    async function ronde(route) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage(); const fouten = []; letOpFouten(page, fouten);
      await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
      if (route) await page.route('**/api/ik/workspace/rechten', route);
      await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('[data-rtg-module="context"]', { state: 'attached', timeout: 30000 });
      return { ctx, page };
    }
    const aanwezig = (page, id) => page.evaluate((m) => !!document.querySelector('[data-rtg-module="' + m + '"]'), id);

    // 1) gewoon: na het antwoord van de server staan beide er
    const een = await ronde(null);
    await een.page.waitForSelector('[data-rtg-module="safety"]', { state: 'attached', timeout: 20000 });
    assert.equal(await aanwezig(een.page, 'travel'), true, 'Travel na een ja van de server');
    await een.ctx.close();

    // 2) vertraagd en beperkt: niets voor het antwoord, daarna alleen Travel
    let laat;
    const wacht = new Promise((r) => { laat = r; });
    const twee = await ronde(async (r) => { await wacht; await r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ bron: 'server', rechten: { 'travel.read': true, 'travel.manage': true, 'safety.read': false, 'safety.respond': false } }) }); });
    assert.equal(await aanwezig(twee.page, 'travel'), false, 'Travel stond er al voor de server iets zei');
    assert.equal(await aanwezig(twee.page, 'safety'), false, 'RTG Veilig stond er al voor de server iets zei');
    laat();
    await twee.page.waitForSelector('[data-rtg-module="travel"]', { state: 'attached', timeout: 20000 });
    assert.equal(await aanwezig(twee.page, 'safety'), false, 'RTG Veilig verscheen terwijl de server nee zei');
    await twee.ctx.close();

    // 3) onbereikbaar: alles met een eis blijft dicht
    let afgebroken;
    const weg = new Promise((r) => { afgebroken = r; });
    const drie = await ronde(async (r) => { await r.abort(); afgebroken(); });
    await weg;
    // twee frames na de storing: de runtime heeft dan getekend wat hij ging tekenen
    await drie.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await aanwezig(drie.page, 'travel'), false, 'een storing opende Travel');
    assert.equal(await aanwezig(drie.page, 'safety'), false, 'een storing opende RTG Veilig');
    await drie.ctx.close();
  } finally {
    await browser.close().catch(() => {});
    stop(srv.child || srv);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
