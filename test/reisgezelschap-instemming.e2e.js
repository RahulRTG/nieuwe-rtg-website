/* ============================================================================
   INSTEMMEN IN EEN ECHTE BROWSER -- vijf mensen, ieder apart, op een versie.

   Stap 4 van "Five People. Five Private Contexts. One Shared Outcome". De
   reiziger legt via het scherm een optie voor; vijf deelnemers drukken ieder in
   hun eigen browsercontext op "IK STEM IN" -- vier na elkaar en de vijfde pas
   nadat de reiziger de optie veranderde. Die vijfde klikt dan op een scherm dat
   de oude versie toont, en de server weigert: er wordt niet ingestemd op iets
   wat iemand niet zag. Daarna een nieuwe versie, en vijf klikken tegelijk.
   Overgeslagen zonder browser. Draai: node --test test/reisgezelschap-instemming.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisinstem-e2e-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, REIS;
let A, B, C, D, G, E, F;
const opties = {};

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6) + Math.random().toString(36).slice(2, 5);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01' });
  assert.equal(r.status, 200, naam + ': ' + JSON.stringify(r.body));
  const lid = { naam, token: r.body.token, codenaam: r.body.state.user.codename };
  await api('/api/reis/gezelschap/kring', {}, lid.token);
  return lid;
}
async function doeMee(lid, rol) {
  const uit = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: lid.codenaam, rol }, A.token);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: uit.body.lid.id, ja: true }, lid.token)).status, 200);
  return uit.body.lid.id;
}
const beeld = async (wie) => {
  const r = await api('/api/reis/gezelschap/opties', { reis: REIS }, wie.token);
  assert.equal(r.status, 200, wie.naam + ': ' + JSON.stringify(r.body));
  return r.body;
};
const gedeeld = (b) => JSON.stringify(Object.assign({}, b.groep, { voortgang: undefined }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  A = await nieuwLid('Anna'); B = await nieuwLid('Bram'); C = await nieuwLid('Cees');
  D = await nieuwLid('Dirk'); G = await nieuwLid('Gijs'); E = await nieuwLid('Eva'); F = await nieuwLid('Frits');
  assert.equal(new Set([A, B, C, D, G, E, F].map(x => x.codenaam)).size, 7, 'twee leden delen een codenaam');
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }
  ] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code: zet.body.link.split('code=')[1] }, A.token)).status, 200);
  REIS = (await api('/api/reis/reizen', {}, A.token)).body.reizen[0].id;
  for (const x of [B, C, D, G]) x.uitnodiging = await doeMee(x, 'reisgenoot');
  E.uitnodiging = await doeMee(E, 'meekijker');
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });




test('vijf mensen stemmen apart in op een vaste versie', { skip: geenBrowser(pw) }, async () => {
  const leden = { Anna: A, Bram: B, Cees: C, Dirk: D, Gijs: G };
  for (const [naam, wie] of Object.entries(leden)) {
    assert.equal((await api('/api/reis/gezelschap/opgave/zet', { reis: REIS, opgave: { plafond: 150000 } }, wie.token)).status, 200, naam);
  }
  const z = await api('/api/reis/gezelschap/opties/zet', { reis: REIS,
    optie: { titel: 'Villa aan zee', prijsPP: 110000, van: dag(60), tot: dag(64) } }, A.token);
  const villa = z.body.optie.id;
  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  try {
    const p = {};
    for (const [naam, wie] of Object.entries(leden)) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage(); letOpFouten(page, fouten);
      await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, wie.token);
      await page.goto(base + '/apps/reizen.html#samen', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector('#samenBesluit[data-kenmerk]', { state: 'attached', timeout: 30000 });
      p[naam] = page;
    }
    const stand = (page) => page.evaluate(() => { const v = document.querySelector('#voorleggingInhoud'); return { versie: v.dataset.versie, stand: v.dataset.stand, tekst: v.innerText }; });
    const knop = (page, tekst) => page.locator('#voorleggingKnoppen button', { hasText: tekst });

    // een reisgenoot ziet geen knop om voor te leggen
    assert.equal(await p.Bram.locator('#besluitOpties button', { hasText: 'LEG VOOR' }).count(), 0);
    await p.Anna.locator('[data-optie="' + villa + '"] button', { hasText: 'LEG VOOR AAN DE GROEP' }).click();
    await p.Anna.waitForFunction(() => document.querySelector('#voorleggingInhoud').dataset.versie === '1', null, { timeout: 15000 });
    for (const page of Object.values(p)) await page.evaluate(() => window.RTGSamenBesluit.ververs());

    for (const naam of ['Anna', 'Bram', 'Cees', 'Dirk']) {
      await knop(p[naam], 'IK STEM IN').click();
      await p[naam].waitForFunction(() => /U stemde in/.test(document.querySelector('#besluitUitleg').innerText), null, { timeout: 15000 });
    }
    await p.Anna.evaluate(() => window.RTGSamenBesluit.ververs());
    assert.match((await stand(p.Anna)).tekst, /4 van 5 stemden in/);

    // de reiziger verandert de villa; Gijs heeft nog versie 1 op zijn scherm
    assert.equal((await api('/api/reis/gezelschap/opties/zet', { reis: REIS, id: villa,
      optie: { titel: 'Villa aan zee', prijsPP: 105000, van: dag(60), tot: dag(64) } }, A.token)).status, 200);
    const weiger = p.Gijs.waitForResponse(r => /\/api\/reis\/gezelschap\/instem$/.test(r.url()));
    await knop(p.Gijs, 'IK STEM IN').click();
    assert.equal((await weiger).status(), 409, 'instemmen op een versie die niet meer bestaat');
    await p.Gijs.waitForFunction(() => document.querySelector('#voorleggingInhoud').dataset.stand === 'vervallen', null, { timeout: 15000 });
    assert.match((await stand(p.Gijs)).tekst, /Vervallen: De optie is veranderd/);

    // versie 2, en vijf klikken tegelijk
    await p.Anna.evaluate(() => window.RTGSamenBesluit.ververs());
    await p.Anna.locator('[data-optie="' + villa + '"] button', { hasText: 'LEG VOOR AAN DE GROEP' }).click();
    await p.Anna.waitForFunction(() => document.querySelector('#voorleggingInhoud').dataset.versie === '2', null, { timeout: 15000 });
    for (const page of Object.values(p)) await page.evaluate(() => window.RTGSamenBesluit.ververs());
    for (const page of Object.values(p)) assert.equal((await stand(page)).versie, '2');
    await Promise.all(Object.values(p).map(page => knop(page, 'IK STEM IN').click()));
    for (const [naam, page] of Object.entries(p)) {
      await page.waitForFunction(() => /U stemde in|Iedereen stemde in/.test(document.querySelector('#besluitUitleg').innerText), null, { timeout: 15000 });
      await page.evaluate(() => window.RTGSamenBesluit.ververs());
      const s = await stand(page);
      assert.equal(s.stand, 'aangenomen', naam + ' ziet geen besluit');
      assert.match(await page.evaluate(() => document.querySelector('#besluitUitleg').innerText), /er is nog niets geboekt of betaald/);
      const rail = await page.evaluate(() => (window.RTGAdaptief.context().rail || []).map(x => x.sleutel + ':' + x.tekst));
      assert.ok(rail.some(x => /^voorstel:Versie 2/.test(x)), naam + ': de Edge kent het voorstel niet: ' + rail.join(' | '));
    }
  } finally {
    await browser.close().catch(() => {});
  }
  const echt = fouten.filter(f => !/404|409|Failed to load resource|net::ERR_FAILED/.test(String(f)));
  assert.deepEqual(echt, [], 'fouten in de browser: ' + echt.join(' | '));
});
