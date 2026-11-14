'use strict';
const assert = require('node:assert/strict');

async function post(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const d = await r.json(); assert.equal(r.status, 200, pad + ': ' + JSON.stringify(d)); return d;
}
const identiteit = s => ({ code: s.code, token: s.token });
const dagboek = (base, s, extra = {}) => post(base, '/api/rtf/welzijn/dagboek', { ...identiteit(s), ...extra });

async function context(browser, sessie) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'nl-NL',
    reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(s => {
    localStorage.setItem('rtf_sessie', JSON.stringify({ code: s.code, token: s.token, profiel: s.profiel }));
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, sessie);
  return ctx;
}
async function paneel(page, selector, naam) {
  if (!await page.locator(selector).isVisible()) await page.locator('.rtgdeel-balk').getByRole('button', { name: naam, exact: true }).click();
  await page.locator(selector).waitFor({ state: 'visible' });
}
async function klikAntwoord(page, selector, pad, status = 200, leesBody = true) {
  /* Lees de body zodra het response-event verschijnt. Een geldige mutatie kan
     daarna bewust herladen; wachten tot locator.click ook die navigatie heeft
     afgewacht maakt de oude responsebody in Chromium niet meer beschikbaar. */
  const wacht = page.waitForResponse(r => new URL(r.url()).pathname === pad && r.request().method() === 'POST')
    .then(async r => ({ status: r.status(), body: leesBody ? await r.json() : null, request: r.request().postDataJSON() }));
  await page.locator(selector).click({ noWaitAfter: true });
  const r = await wacht; assert.equal(r.status, status, pad); return { body: r.body, request: r.request };
}
async function coach(page, route, sessie) {
  const namen = { gevoel: 'Praten', pesten: 'Praat met een maatje', opvoeden: 'Vraag het je opvoedcoach', mediawijs: 'Sparren' };
  await paneel(page, '#vraag', namen[route]);
  const vraag = 'Welke eerste stap kan ik zelf doen?'; await page.locator('#vraag').fill(vraag);
  const r = await klikAntwoord(page, '#stuur', '/api/foundation/hulp/ai');
  assert.equal(r.request.kind, route); assert.equal(r.request.code, sessie.code);
  assert.equal(r.request.token, sessie.token); assert.equal(r.request.groep, sessie.profiel.groep);
  assert.deepEqual(r.request.messages.at(-1), { role: 'user', content: vraag });
  assert.equal(typeof r.body.text, 'string'); assert.ok(r.body.text.trim());
  await page.waitForFunction(t => [...document.querySelectorAll('#chat .ai')].some(e => e.textContent === t) && !document.querySelector('#stuur').disabled, r.body.text);
  assert.equal(await page.locator('#chat .ik').last().textContent(), vraag);
}
async function kiesGevoel(page, gevoel) {
  await paneel(page, '#koppen', 'Gevoelens');
  await page.getByRole('button', { name: gevoel, exact: true }).click();
  assert.equal(await page.getByRole('button', { name: gevoel, exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#antwoord li').count(), 3);
}
async function bewaarGevoel(page, gevoel) {
  const r = await klikAntwoord(page, '#bewaarKnop', '/api/rtf/welzijn/stemming');
  assert.equal(r.body.dag.gevoel, gevoel);
  await page.waitForFunction(g => document.querySelector('#bewaarKnop').disabled && document.querySelector('#bewaarKnop').textContent.includes('Vandaag bewaard: ' + g), gevoel);
}
async function jongDagboek(page, base, kind, ouder) {
  assert.deepEqual((await dagboek(base, kind)).stemmingen, []);
  await kiesGevoel(page, 'verdrietig');
  assert.deepEqual((await dagboek(base, kind)).stemmingen, [], 'aantikken bewaart niets');
  const geweigerd = await klikAntwoord(page, '#bewaarKnop', '/api/rtf/welzijn/stemming', 409);
  assert.equal(geweigerd.body.hoe, 'toestemming'); assert.equal(geweigerd.body.zelf, false);
  await page.locator('#toestemRij').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#toestemKnop').isVisible(), false);
  await post(base, '/api/foundation/gezin/toestemming/gezondheid', { ...identiteit(ouder), aan: true });
  await bewaarGevoel(page, 'verdrietig');
  await kiesGevoel(page, 'blij'); await bewaarGevoel(page, 'blij');
  const eigen = await dagboek(base, kind);
  assert.equal(eigen.stemmingen.length, 1); assert.equal(eigen.dagVandaag.gevoel, 'blij');
  assert.equal(await page.locator('#dagboekStrook .kop').count(), 1);
  assert.deepEqual((await dagboek(base, ouder, { profielId: kind.profiel.id })).stemmingen, [], 'oudertoken geeft nooit het kinderboek terug');
  const gewist = await post(base, '/api/foundation/gezin/toestemming/gezondheid', { ...identiteit(ouder), aan: false, bevestig: 'WIS' });
  assert.equal(gewist.gewist, true);
  const na = await dagboek(base, kind); assert.equal(na.toestemming, false); assert.deepEqual(na.stemmingen, []);
}
async function eigenDagboek(page, base, kind) {
  await kiesGevoel(page, 'rustig');
  const geweigerd = await klikAntwoord(page, '#bewaarKnop', '/api/rtf/welzijn/stemming', 409);
  assert.equal(geweigerd.body.zelf, true);
  await page.locator('#toestemKnop').waitFor({ state: 'visible' });
  const opgeslagen = page.waitForResponse(r => r.url().endsWith('/api/rtf/welzijn/stemming') && r.status() === 200);
  const toestemming = await klikAntwoord(page, '#toestemKnop', '/api/rtf/welzijn/toestemming');
  assert.equal(toestemming.body.toestemming, true); assert.equal((await (await opgeslagen).json()).dag.gevoel, 'rustig');
  await page.locator('#toestemIntrek').waitFor({ state: 'attached' });
  await paneel(page, '#toestemIntrek', 'Gevoelens');
  const voor = await dagboek(base, kind); assert.equal(voor.zelfToestemming, true); assert.equal(voor.stemmingen.length, 1);
  page.once('dialog', d => d.accept());
  // Observeer het nieuwe document zelf. Een los domcontentloaded-event kan
  // onder zware parallelle broncontroles precies tussen de antwoord- en
  // eventwacht vallen; deze marker bestaat uitsluitend in het oude document.
  await page.evaluate(() => { window.__rtgVoorDagboekHerlaad = true; });
  /* Deze actie herlaadt bewust zodra de server heeft geantwoord. De duurzame
     readback hieronder is het zakelijke bewijs; de responsebody na navigatie
     proberen te lezen maakt de browserproef onnodig afhankelijk van timing. */
  await klikAntwoord(page, '#toestemIntrek', '/api/rtf/welzijn/toestemming', 200, false);
  await page.waitForFunction(() => !window.__rtgVoorDagboekHerlaad && document.readyState !== 'loading');
  const na = await dagboek(base, kind); assert.equal(na.toestemming, false); assert.deepEqual(na.stemmingen, []);
}
module.exports = { post, identiteit, dagboek, context, paneel, klikAntwoord, coach, kiesGevoel, jongDagboek, eigenDagboek };
