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
async function zoekInHeelRtg(browser, base, tok, termen, gezin) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"klaar":true}' }));
  await ctx.addInitScript(([t, g]) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      if (g) localStorage.setItem('rtf_sessie', JSON.stringify(g)); } catch (e) {}
  }, [tok, gezin || null]);
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

/* De eigenaar van de testomgeving draagt de kantoorrol in zijn sleutelbos
   (kantoorAlsPersoon in ./helper.js start daar zijn kantoorsessie mee). */
async function kantoorLid(post) {
  const r = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  const tok = r.data && r.data.token;
  assert.ok(tok, 'geen eigenaar in de testomgeving');
  const rollen = ((await post('/api/account/rollen', {}, tok)).data || {}).rollen || [];
  assert.ok(rollen.some((x) => x.rol === 'kantoor'), 'de eigenaar draagt geen kantoorrol: ' + JSON.stringify(rollen).slice(0, 160));
  return tok;
}

/* DE SCHERMEN VAN EEN WERKROL DIE GEEN WERELDTEGEL ZIJN (19 oktober 2026). De
   kassa, de backoffice en de werkplek stonden in de catalogus zonder ingang in de
   gids; de server eist een zaak-, kantoor- of werkruimtesessie. Met hun ingang
   (app-main-23c.js) filtert dezelfde poort ze. */
test('Heel RTG: een lid vindt de kassa, de backoffice en de werkplek niet; een zaakmanager vindt de kassa, een kantoormens de backoffice',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heelrtg-werkrol-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = maakPost(base);
    const A = await lid(post, 'hrw');
    const Z = await zaakLid(post, 'KIKUNOI');
    const K = await kantoorLid(post);
    browser = await pw.chromium.launch(browserOpties(pw, {}));
    const a = await zoekInHeelRtg(browser, base, A, ['kassa', 'backoffice', 'campus', 'horeca']);
    assert.ok(!a.uit.kassa.includes('kassa'), 'een lid ziet de kassa: ' + a.uit.kassa.join(','));
    assert.ok(!a.uit.backoffice.includes('backoffice'), 'een lid ziet de backoffice: ' + a.uit.backoffice.join(','));
    assert.ok(!a.uit.campus.includes('werkplek'), 'een lid ziet de werkplek: ' + a.uit.campus.join(','));
    assert.ok(!a.uit.horeca.some((x) => /^horeca-/.test(x)), 'een lid ziet de horecaschermen van een zaak: ' + a.uit.horeca.join(','));
    assert.deepEqual(a.fouten, [], 'paginafouten bij het lid');
    const z = await zoekInHeelRtg(browser, base, Z, ['kassa', 'backoffice']);
    assert.ok(z.uit.kassa.includes('kassa'), 'een zaakmanager vindt de kassa niet: ' + z.uit.kassa.join(','));
    assert.ok(!z.uit.backoffice.includes('backoffice'), 'een zaakmanager ziet de backoffice: ' + z.uit.backoffice.join(','));
    const k = await zoekInHeelRtg(browser, base, K, ['backoffice']);
    assert.ok(k.uit.backoffice.includes('backoffice'), 'een kantoormens vindt de backoffice niet: ' + k.uit.backoffice.join(','));
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

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

/* DE GEZINSROL (19 oktober 2026). De schermen van de RTFoundation die op een
   gezinsprofielsessie draaien (ze laden apps/foundation/sessie.js), opent de
   server alleen met die sessie (rtf.verifieerProfiel achter gezinsPoort,
   rtfPoort, rtfSpeler). Heel RTG toont ze een lid zonder sessie niet; de deur
   (index.html, inloggen met de gezinscode) blijft staan. Met een sessie die de
   server uitgaf -- een gezin, een profiel, gekozen langs /api/foundation --
   staan ze er wel. */
test('Heel RTG: zonder gezinssessie geen Zakgeld, wel de deur van de RTFoundation; met een gezinssessie wel Zakgeld',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heelrtg-gezin-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = maakPost(base);
    const A = await lid(post, 'hrg');
    const g = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Zoekgezin', naam: 'Ouder Zoek', pin: '1234' })).data;
    assert.ok(g && g.code && g.token, 'geen gezin: ' + JSON.stringify(g).slice(0, 120));
    const p = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind Zoek', rol: 'kind', groep: 'tiener' })).data;
    const kies = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: p.profiel.id })).data;
    assert.ok(kies && kies.token && kies.profiel, 'geen profielsessie: ' + JSON.stringify(kies).slice(0, 120));
    const sessie = { code: g.code, token: kies.token, gezin: g.gezin || null, profiel: kies.profiel };
    browser = await pw.chromium.launch(browserOpties(pw, {}));
    const zonder = await zoekInHeelRtg(browser, base, A, ['zakgeld', 'rtfoundation', 'registreren']);
    assert.ok(!zonder.uit.zakgeld.includes('foundation-zakgeld'), 'een lid zonder gezinssessie ziet Zakgeld: ' + zonder.uit.zakgeld.join(','));
    assert.ok(zonder.uit.rtfoundation.includes('foundation-index'), 'de deur van de RTFoundation is weg: ' + zonder.uit.rtfoundation.join(','));
    assert.ok(zonder.uit.registreren.includes('foundation-registreren'), 'een gezin aanmaken is weg: ' + zonder.uit.registreren.join(','));
    assert.deepEqual(zonder.fouten, [], 'paginafouten zonder sessie');
    const met = await zoekInHeelRtg(browser, base, A, ['zakgeld'], sessie);
    assert.ok(met.uit.zakgeld.includes('foundation-zakgeld'), 'met een gezinssessie vindt het lid Zakgeld niet: ' + met.uit.zakgeld.join(','));
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
