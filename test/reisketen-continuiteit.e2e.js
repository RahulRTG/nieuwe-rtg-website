/* Echte geïsoleerde browsercontexten delen dezelfde bron/SQLite, niet hun
   geheugen. Offline is Chromium-netwerkuitval; geen API-vervangende bodies. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
let srv, browser, x;
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-continuiteit-'));
test.before(async () => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'echte Chromium verplicht');
  srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
  console.log('TravelOS continuïteit: Chromium ' + browser.version());
});
test.after(async () => { if (browser) await browser.close(); if (srv) await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'allow' });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const fouten = h.letOpFouten(page, []);
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate(({ lid, kantoor }) => {
    localStorage.setItem('rtg_member_token', lid); localStorage.setItem('rtg_office_token', kantoor);
    localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
  }, { lid: x.reiziger.token, kantoor: x.office });
  await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
  const host = page.locator('#kReisContracten');
  await host.getByRole('status').filter({ hasText: 'eigen werkruimte' }).waitFor();
  return { ctx, page, host, fouten };
}
async function start(id) {
  const reis = goed(await x.api('/api/reisbureau/keten/start', { titel: id, bestemming: 'Ibiza', idem: id }, x.reiziger.token), 'aanvraag').reis;
  return goed(await x.api('/api/office/reisbureau/keten/offerte', x.offerte(reis), x.office), 'offerte').reis;
}
function vak(o, reis) { return o.host.locator('section').filter({ has: o.page.getByRole('heading', { name: reis.titel, exact: true }) }); }
async function concept(o, reis, voorwaarden, centen) {
  const v = vak(o, reis); await v.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).click();
  const f = v.locator('form');
  await f.locator('[name="voorwaarden"]').fill(voorwaarden);
  await f.locator('[name="geldigTot"]').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await f.locator('fieldset').first().locator('[name="centen"]').fill(String(centen));
  return f;
}
async function vernieuw(o) {
  await o.host.getByRole('button', { name: 'Reiscontracten vernieuwen', exact: true }).click();
  await o.page.waitForFunction(() => ![...document.querySelectorAll('#kReisContracten button')].find(b => b.textContent === 'Reiscontracten vernieuwen').disabled);
}
const bron = async ref => goed(await x.api('/api/office/reisbureau/keten', { ref }, x.office), 'bron').reizen.find(r => r.ref === ref);
const verzend = f => f.getByRole('button', { name: 'Offerte ter beoordeling aanbieden', exact: true });
test('twee browsercontexten: 409 behoudt concept, toont bronverschil en vereist bewuste herbeoordeling', async () => {
  const reis = await start('Twee-browser-conceptproef');
  const a = await open(), b = await open();
  try {
    const fa = await concept(a, reis, 'Vastgelegde keuze van browser A', 51000);
    const fb = await concept(b, reis, 'Nog niet opgeslagen keuze van browser B', 52000);
    await verzend(fa).click();
    await vak(a, reis).getByText('Offerte 2:', { exact: false }).waitFor();
    const response = b.page.waitForResponse(r => r.url().endsWith('/keten/offerte'));
    await verzend(fb).click(); assert.equal((await response).status(), 409);
    await b.host.getByRole('status').filter({ hasText: 'gewijzigd' }).waitFor();
    assert.equal(await fb.count(), 1, 'het niet opgeslagen concept mag bij 409 niet verdwijnen');
    assert.equal(await fb.locator('[name="voorwaarden"]').inputValue(), 'Nog niet opgeslagen keuze van browser B');
    assert.equal(await verzend(fb).isDisabled(), true, 'oude bron kan niet opnieuw worden aangeboden');
    assert.equal((await bron(reis.ref)).offerte.voorwaarden, 'Vastgelegde keuze van browser A');
    await vernieuw(b);
    const hersteld = vak(b, reis).locator('form');
    assert.match(await vak(b, reis).innerText(), /Vastgelegde keuze van browser A/, 'de nieuwe bron staat naast het ongewijzigde concept');
    assert.equal(await hersteld.locator('[name="voorwaarden"]').inputValue(), 'Nog niet opgeslagen keuze van browser B');
    assert.equal(await hersteld.locator('fieldset').first().locator('[name="centen"]').inputValue(), '52000');
    const oordeel = hersteld.getByRole('checkbox', { name: /actuele bron/ });
    assert.equal(await oordeel.isChecked(), false);
    await verzend(hersteld).click();
    assert.equal((await bron(reis.ref)).offerte.versie, 2, 'geen nieuwe offerte zonder expliciet herbeoordelen');
    await oordeel.check(); await verzend(hersteld).click();
    await vak(b, reis).getByText('Offerte 3:', { exact: false }).waitFor();
    const eind = await bron(reis.ref);
    assert.equal(eind.offerte.voorwaarden, 'Nog niet opgeslagen keuze van browser B');
    assert.equal(eind.offerte.totaalCenten, 82000);
    await concept(b, reis, 'Vertrouwelijk concept vóór sessiewissel', 55000);
    const tab = await b.ctx.newPage(); await tab.goto(srv.base + '/manifest.webmanifest');
    await Promise.all([b.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      tab.evaluate(() => localStorage.removeItem('rtg_office_token'))]);
    await b.page.waitForFunction(() => !document.body.hidden);
    assert.equal((await b.page.locator('body').innerText()).includes('Vertrouwelijk concept vóór sessiewissel'), false);
    assert.equal(await b.page.locator('#kReisContracten form').count(), 0, 'sessiewissel verwijdert het geheugenconcept');
    assert.equal(await a.page.evaluate(() => !!localStorage.getItem('rtg_office_token')), true, 'de andere browsercontext houdt zijn eigen sessie');
    assert.deepEqual([...a.fouten, ...b.fouten], []);
  } finally { await a.ctx.close(); await b.ctx.close(); }
});
test('echt offline aanbod blijft onzeker, bewaart alleen schermconcept en herstelt met één expliciete mutatie', async () => {
  const reis = await start('Offline-offerteproef'), o = await open();
  try {
    const form = await concept(o, reis, 'Alleen geheugen offline concept', 53000);
    await o.ctx.setOffline(true); await verzend(form).click();
    await o.host.getByRole('status').filter({ hasText: /onbekend/ }).waitFor();
    assert.equal(await form.locator('[name="voorwaarden"]').inputValue(), 'Alleen geheugen offline concept');
    assert.equal(await verzend(form).isDisabled(), true);
    assert.equal((await bron(reis.ref)).offerte.versie, 1);
    await vernieuw(o); assert.equal(await verzend(form).isDisabled(), true, 'offline herlezing ontgrendelt geen handeling');
    await o.ctx.setOffline(false);
    assert.equal((await bron(reis.ref)).offerte.versie, 1, 'online-event verstuurt niets automatisch');
    await vernieuw(o);
    const hersteld = vak(o, reis).locator('form');
    assert.equal(await hersteld.locator('[name="voorwaarden"]').inputValue(), 'Alleen geheugen offline concept');
    await hersteld.getByRole('checkbox', { name: /actuele bron/ }).check();
    await verzend(hersteld).click(); await vak(o, reis).getByText('Offerte 2:', { exact: false }).waitFor();
    assert.equal((await bron(reis.ref)).offerte.totaalCenten, 83000);
    const opslag = await o.page.evaluate(async () => ({
      opslag: JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
      caches: (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => r.url)))).flat()
    }));
    assert.equal(opslag.opslag.includes('Alleen geheugen offline concept'), false, 'geen dossierconcept in browseropslag');
    assert.equal(opslag.caches.some(u => new URL(u).pathname.startsWith('/api/')), false, 'geen beschermde API-antwoorden in shellcache');
    assert.deepEqual(o.fouten, []);
  } finally { await o.ctx.close(); }
});
test('netwerkuitval na echte commit: bronherstel herkent het ontvangen aanbod zonder dubbele offerte', async () => {
  const reis = await start('Offline-na-offertecommit'), o = await open();
  try {
    const form = await concept(o, reis, 'Door bron ontvangen vóór verbindingsverlies', 54000);
    let opdrachten = 0;
    await o.page.route('**/api/office/reisbureau/keten/offerte', async route => {
      opdrachten++; const r = await route.fetch(); assert.equal(r.status(), 200);
      await o.ctx.setOffline(true); await route.abort('failed');
    });
    await verzend(form).click();
    await o.host.getByRole('status').filter({ hasText: /onbekend/ }).waitFor();
    assert.equal((await bron(reis.ref)).offerte.versie, 2, 'de echte bron heeft één offerterevisie vastgelegd');
    assert.match(await vak(o, reis).innerText(), /Offerte 1:/, 'geen schijnbevestiging uit alleen de verzonden opdracht');
    await vernieuw(o); assert.equal(await verzend(form).isDisabled(), true);
    await o.ctx.setOffline(false); await vernieuw(o);
    await o.host.getByRole('status').filter({ hasText: 'De actuele bron bevat uw offertegegevens' }).waitFor();
    assert.equal(await vak(o, reis).locator('form').count(), 0, 'ontvangen concept wordt niet opnieuw aangeboden');
    assert.equal((await bron(reis.ref)).offerte.versie, 2); assert.equal(opdrachten, 1);
    assert.deepEqual(o.fouten, []);
  } finally { await o.ctx.close(); }
});
