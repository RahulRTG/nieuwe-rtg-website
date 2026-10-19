/* HEEL RTG TOONT UIT DE CATALOGUS NIETS WAT DE GIDS VERBERGT (19 oktober 2026).
   Het zoekmenu "Heel RTG" in de rand bouwt zijn lijst uit de widgetcatalogus
   (shared/interface/world-widget-catalog.json). Die kent geen werkrol en geen
   pas, en toonde zo "Tweede scherm" -- een scherm van de zaak (werkrol zaak,
   app-main-23b.js) -- aan elk lid, terwijl de functiegids het verbergt. Nu loopt
   elke catalogustreffer met een ingang in de gids door dezelfde poort als de
   gids (gidsToegang -> itemZichtbaar): een lid typt "scherm" en ziet het tweede
   scherm niet, een lid dat manager van een zaak is wel. Dezelfde poort houdt
   de kantoorschermen en de Lifestyle-apps buiten beeld van een RTG-lid.

   Draait alleen waar Playwright met een passende browser staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadScherm();
const maakPost = (base) => async (pad, lijf, tok) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
async function lid(post, merk) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post('/api/auth/register', { name: 'Zoeker ' + merk, email: merk + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  if (!r.data || !r.data.token) throw new Error('registratie lukte niet (' + r.status + ')');
  return r.data.token;
}
/* Een lid dat manager is van een zaak, langs de echte weg: de demomanager voegt
   hem toe als manager en het lid koppelt die plek aan zijn account (zoals
   zaakMensOpNaam in ./helper.js). /api/account/rollen geeft dan personeel met
   manager, en de ledenapp maakt daar de werkrol zaak van (app-main-24a3.js). */
async function zaakLid(post, code) {
  const tok = await lid(post, 'hrz');
  const ro = await post('/api/supplier/roster', { code });
  const staf = (ro.data && ro.data.staff) || [];
  const man = staf.find((x) => x.role === 'manager') || staf[0];
  const login = await post('/api/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  const m = login.data && login.data.token;
  assert.ok(m, 'geen demomanager voor ' + code);
  const nieuw = await post('/api/supplier/staff/add', { name: 'Zaakmens ' + code, role: 'manager', func: 'Zaal' }, m);
  assert.ok(nieuw.data && nieuw.data.staff, 'toevoegen lukte niet: ' + JSON.stringify(nieuw.data).slice(0, 120));
  const k = await post('/api/account/koppel', { soort: 'personeel', code, staffId: nieuw.data.staff.id, pin: nieuw.data.pin }, tok);
  assert.equal(k.status, 200, 'koppelen lukte niet: ' + JSON.stringify(k.data).slice(0, 120));
  const rollen = ((await post('/api/account/rollen', {}, tok)).data || {}).rollen || [];
  assert.ok(rollen.some((r) => r.rol === 'personeel' && r.manager), 'het account draagt geen managerrol: ' + JSON.stringify(rollen).slice(0, 160));
  return tok;
}

/* Heel RTG openen zoals een lid en zoeken. Geeft per zoekterm de catalogus-apps
   die zichtbaar in de lijst staan. */
async function zoekInHeelRtg(browser, base, tok, termen) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"klaar":true}' }));
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, tok);
  const p = await ctx.newPage();
  const fouten = []; letOpFouten(p, fouten);
  await p.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
  await p.click('.rtg-adaptive-item[aria-label="Alle functies"]');
  await p.click('[data-edge-face="all"]');
  await p.click('[data-edge-smart-search]');
  await p.waitForSelector('[data-catalogus-ready="true"]', { state: 'attached', timeout: 20000 });
  const uit = {};
  for (const t of termen) {
    await p.locator('.rtg-edge-face-all .rtg-edge-find input').fill(t);
    await p.waitForTimeout(300);
    uit[t] = await p.locator('.rtg-edge-face-all a[data-catalog-app]:visible').evaluateAll((as) => as.map((a) => a.dataset.catalogApp));
  }
  await ctx.close();
  return { uit, fouten };
}

test('Heel RTG: een lid vindt het tweede scherm niet, een zaakmanager wel; kantoor- en Lifestyle-apps blijven buiten beeld van een RTG-lid',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heelrtg-poort-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = maakPost(base);
    const A = await lid(post, 'hrl');
    const Z = await zaakLid(post, 'KIKUNOI');
    browser = await pw.chromium.launch(browserOpties(pw, {}));
    const a = await zoekInHeelRtg(browser, base, A, ['scherm', 'rtg one', 'decision', 'cellier', 'agenda']);
    assert.ok(!a.uit.scherm.includes('scherm'), 'een lid ziet "Tweede scherm" in Heel RTG: ' + a.uit.scherm.join(','));
    assert.ok(!a.uit['rtg one'].includes('rtgone'), 'een lid ziet het kantoorscherm RTG One: ' + a.uit['rtg one'].join(','));
    assert.ok(!a.uit.decision.includes('decision-room'), 'een lid ziet de Decision Room: ' + a.uit.decision.join(','));
    assert.ok(!a.uit.cellier.includes('cellier'), 'een RTG-lid ziet de Lifestyle-app Cellier: ' + a.uit.cellier.join(','));
    assert.ok(a.uit.agenda.includes('agenda'), 'de poort is te streng: Agenda is voor iedereen, en het lid vindt hem niet');
    assert.deepEqual(a.fouten, [], 'paginafouten bij het lid');
    const z = await zoekInHeelRtg(browser, base, Z, ['scherm']);
    assert.ok(z.uit.scherm.includes('scherm'), 'een zaakmanager vindt zijn tweede scherm niet: ' + z.uit.scherm.join(','));
    assert.deepEqual(z.fouten, [], 'paginafouten bij de zaakmanager');
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
