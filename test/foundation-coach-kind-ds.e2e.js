/* Echte accountgebonden gezinssessies en HTTP-readbacks. Geen positieve stubs.
   DS-matrix is ontwikkelbewijs; geen menselijke of medische kwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard, laadPlaywright, browserOpties, geenBrowser, keurLidGoed, letOpFouten } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { land, matrix } = require('./lib/foundation-coach-browser');
const { post, context, paneel, klikAntwoord, coach, jongDagboek, eigenDagboek } = require('./lib/foundation-kind-browser');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, tmp, ouder;
const kinderen = {};
const schermen = {
  gevoel: '/apps/foundation/gevoel.html',
  pesten: '/apps/foundation/pesten.html',
  opvoeden: '/apps/foundation/opvoeden.html',
  mediawijs: '/apps/foundation/mediawijs.html'
};
test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-kind-ds-'));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_DEMO: '1', RTG_KLOK: '2026-10-31T12:00:00Z',
    SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', RTG_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  const account = await registreerGratis(srv.base); assert.ok(account, 'echte ouderregistratie');
  await keurLidGoed(srv.base, account.token, account.codenaam, '1985-05-05');
  ouder = await post(srv.base, '/api/rtf/eigen-gezin/maak', { gezinsnaam: 'DS Kinderproef', naam: 'Moeder',
    bevoegdGezin: true, privacyAkkoord: true }, account.token);
  assert.ok(ouder.profiel.beheerder); assert.match(ouder.token, /^GZ\.[0-9A-F]{32}$/);
  for (const [leeftijd, jaar, groep] of [[15, 2011, 'tiener'], [16, 2010, 'jong'], [10, 2016, 'kind']]) {
    const k = await post(srv.base, '/api/rtf/eigen-gezin/kind', { naam: 'Kind ' + leeftijd, geboortedatum: jaar + '-01-01' }, account.token);
    const s = await post(srv.base, '/api/rtf/eigen-gezin/sessie', { profielId: k.profiel.id }, account.token);
    assert.equal(s.profiel.id, k.profiel.id); assert.equal(s.profiel.groep, groep);
    assert.equal(s.profiel.leeftijdBevestigd, true); assert.equal(s.code, ouder.code); assert.match(s.token, /^GZ\.[0-9A-F]{32}$/);
    kinderen[leeftijd] = s;
  }
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => {
  try { if (browser) await browser.close(); } finally {
    if (srv) await stopHard(srv.child);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
});
async function bezoek(sessie, scherm, werk, metMatrix = true) {
  const route = scherm.split('/').at(-1).replace(/\.html$/, '');
  const ctx = await context(browser, sessie);
  try {
    const page = await ctx.newPage(), fouten = []; letOpFouten(page, fouten);
    await land(page, route, srv.base); if (metMatrix) await matrix(page, route);
    await werk(page); assert.deepEqual(fouten, [], 'geen JavaScript-fouten');
  } finally { await ctx.close(); }
}
test('Foundation DS gevoel: kind 15, coach, expliciete oudertoestemming, privé dagboek en wissen', { skip, timeout: 120000 }, async () => {
  await bezoek(kinderen[15], schermen.gevoel, async page => {
    await coach(page, 'gevoel', kinderen[15]);
    await jongDagboek(page, srv.base, kinderen[15], ouder);
    await paneel(page, '#ademknop', 'Ademen'); await page.locator('#ademknop').click();
    assert.equal(await page.locator('#bol').textContent(), 'in');
    assert.equal(await page.locator('#ademknop').textContent(), 'Stop maar');
    await page.locator('#ademknop').click(); assert.equal(await page.locator('#bol').textContent(), 'klaar?');
    await land(page, 'gevoel', srv.base);
    assert.equal(await page.locator('#dagboekStrook .kop').count(), 0);
    assert.equal(await page.locator('#chat .ik').count(), 0, 'coachgesprek niet teruggezet na herladen');
  });
});
test('Foundation DS gevoel: vanaf 16 eigen toestemming en native bevestiging bij wissen', { skip, timeout: 60000 }, async () => {
  await bezoek(kinderen[16], schermen.gevoel, page => eigenDagboek(page, srv.base, kinderen[16]), false);
});
test('Foundation DS pesten: kind 10, coach en echt hulpbericht in de ouderinbox', { skip, timeout: 120000 }, async () => {
  await bezoek(kinderen[10], schermen.pesten, async page => {
    await coach(page, 'pesten', kinderen[10]);
    await paneel(page, '#tekst', 'Ik wil het mijn gezin vertellen');
    const tekst = 'Ik wil samen praten over wat er in de groep gebeurt.'; await page.locator('#tekst').fill(tekst);
    const r = await klikAntwoord(page, '#praat', '/api/foundation/gezin/bericht');
    assert.equal(r.body.ok, true); assert.equal(r.body.bericht.van, kinderen[10].profiel.id);
    await page.locator('#ok').waitFor({ state: 'visible' }); assert.equal(await page.locator('#tekst').inputValue(), '');
    const inbox = await fetch(srv.base + '/api/foundation/gezin/' + ouder.code + '/berichten', { headers: { Authorization: 'Bearer ' + ouder.token } });
    assert.equal(inbox.status, 200);
    const berichten = (await inbox.json()).berichten.filter(b => b.id === r.body.bericht.id);
    assert.equal(berichten.length, 1); assert.equal(berichten[0].tekst, tekst);
    assert.equal(berichten[0].van, kinderen[10].profiel.id); assert.equal(berichten[0].soort, 'hulp');
    await paneel(page, '.telefoon', 'De Kindertelefoon'); assert.match(await page.locator('.telefoon').textContent(), /0800-0432/);
  });
});
test('Foundation DS opvoeden: oudercoach en alle zes concrete onderwerpen', { skip, timeout: 120000 }, async () => {
  await bezoek(ouder, schermen.opvoeden, async page => {
    await coach(page, 'opvoeden', ouder);
    const onderwerpen = { Driftbuien: 'Blijf zelf rustig', Schermtijd: 'Maak duidelijke afspraken',
      'Huiswerk en motivatie': 'Klein en vast', 'Ruzie tussen kinderen': 'Wees scheidsrechter, geen rechter',
      Slapen: 'Een vast ritueel', 'Praten over gevoelens': 'Vraag open' };
    assert.equal(await page.locator('#onderwerpen button').count(), 6);
    for (const [naam, tip] of Object.entries(onderwerpen)) {
      await page.getByRole('button', { name: naam, exact: true }).click();
      assert.equal(await page.locator('#tips .tipk b').first().textContent(), tip);
      assert.ok(await page.locator('#tips .tipk').count() >= 2);
    }
  });
});
test('Foundation DS mediawijs: tienercoach, lokale keuze, volgende situatie en reset', { skip, timeout: 120000 }, async () => {
  await bezoek(kinderen[15], schermen.mediawijs, async page => {
    await coach(page, 'mediawijs', kinderen[15]); await paneel(page, '#opties', 'Situaties');
    const situatie = await page.locator('#situatie p').textContent(); assert.ok(situatie);
    assert.equal(await page.locator('#opties button').count(), 3); await page.locator('#opties button').first().click();
    assert.equal(await page.locator('#opties button:disabled').count(), 3);
    assert.match(await page.locator('#stand').textContent(), /^1 van de 8 gedaan, [012] van de 2 punten$/);
    assert.ok(await page.locator('#uitleg').isVisible()); assert.match(await page.locator('#regel').textContent(), /^Onthoud:/);
    await page.locator('#verder').click(); assert.notEqual(await page.locator('#situatie p').textContent(), situatie);
    assert.equal(await page.locator('#opties button:enabled').count(), 3); assert.equal(await page.locator('#uitleg').isVisible(), false);
    assert.match(await page.locator('#stand').textContent(), /^1 van de 8 gedaan/);
    await land(page, 'mediawijs', srv.base); await paneel(page, '#opties', 'Situaties');
    assert.equal(await page.locator('#stand').textContent(), ''); assert.equal(await page.locator('#opties button:enabled').count(), 3);
    assert.equal(await page.locator('#chat .ik').count(), 0);
  });
});
test('Foundation DS mediawijs: kind 10 krijgt de echte leeftijdsweigering', { skip, timeout: 60000 }, async () => {
  const ctx = await context(browser, kinderen[10]);
  try {
    const page = await ctx.newPage(), coachVerzoeken = [];
    page.on('request', r => { if (new URL(r.url()).pathname === '/api/foundation/hulp/ai') coachVerzoeken.push(r.url()); });
    const deur = page.waitForResponse(r => new URL(r.url()).pathname === '/api/rtf/toegang' && r.request().postDataJSON()?.appId === 'rtf-mediawijs');
    const document = await page.goto(srv.base + schermen.mediawijs, { waitUntil: 'load' }); assert.equal(document.status(), 200);
    const r = await deur; assert.equal(r.status(), 403); const d = await r.json(); assert.equal(d.toegestaan, false);
    await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready' && document.body.dataset.rtgDesktopAccess === 'locked');
    await page.locator('#rtf-toegang-slot [data-rtf-wissel]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.wd-shell > #rtf-toegang-slot[role="alert"]').isVisible(), true);
    assert.equal(await page.locator('.wd-page').evaluate(e => e.hidden && e.inert), true);
    assert.equal(await page.locator('#vraag').isVisible(), false);
    assert.match(await page.locator('#rtf-toegang-slot').textContent(), /Deze ruimte blijft nog dicht/);
    await page.locator('#rtf-toegang-slot [data-rtf-wissel]').focus();
    assert.equal(await page.locator('#rtf-toegang-slot').evaluate(e => e.contains(document.activeElement)), true);
    assert.deepEqual(coachVerzoeken, []);
  } finally { await ctx.close(); }
});
