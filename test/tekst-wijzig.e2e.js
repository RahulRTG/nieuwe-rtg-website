/* TYPEN EN KLIKKEN IN EEN ECHTE BROWSER -- en de meting van eind tot eind
   (EDGE.md par. 14.7; de meting is wat de eigenaar vroeg op 12 oktober 2026).

   Een lid maakt in de Rahul-tab een Rome-concept en past het twee keer aan: een
   keer met het veld op de kaart, een keer met "Maak er N dagen van" tegen Rahul.
   Daarna moet:
     - er EEN kaart zijn, die beide wijzigingen toont (dezelfde versieteller);
     - de regel van Rahul na typen precies zo luiden als na klikken;
     - er voor geen van beide een model zijn geroepen;
     - de Ibiza-aanvraag onveranderd zijn.

   DE METING loopt van de handeling van het lid (de toets Tab na het veld, of
   Enter na de zin) tot het moment dat de nieuwe waarde ZICHTBAAR is op de kaart
   -- niet tot het antwoord van de server. Dat is de kaart van de Edge in de
   Rahul-tab; een eigen plek in de werkruimte bestaat nog niet (dat is de
   volgende stap), dus "zichtbaar in de werkruimte" wordt hier niet gemeten en
   ook niet beweerd. Drie keer per weg, mediaan in de uitvoer.

   MUTATIES, nagetrokken (12 oktober 2026): laat helpers.werk de bestaande kaart
   niet bijwerken (er komen twee kaarten, zakt), en haal de wijzighaak uit de
   route (de dagen blijven staan, zakt).

   Schrijft een schermafdruk naar RTG_DEMO_SCHERM als die is gezet. Draait alleen
   waar Playwright beschikbaar is; anders overgeslagen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

function nepModel() {
  return new Promise((resolve) => {
    const verzoeken = [];
    const srv = http.createServer((req, res) => {
      const brok = [];
      req.on('data', (c) => brok.push(c));
      req.on('end', () => {
        verzoeken.push(Buffer.concat(brok).toString());
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Genoteerd.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 2 } }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, verzoeken, base: 'http://127.0.0.1:' + srv.address().port }));
  });
}
const post = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const mediaan = (l) => l.slice().sort((a, b) => a - b)[Math.floor(l.length / 2)];

test('typen en klikken wijzigen hetzelfde concept op dezelfde kaart; gemeten van handeling tot zichtbaar',
  { skip: geenBrowser(pw) }, async () => {
  const model = await nepModel();
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tekst-e2e-')),
    LOCAL_AI_URL: model.base, LOCAL_AI_MODEL: 'proefmodel', RTG_EXTERNE_AI_UIT: '1' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Typer Proef', email: 'typere2e' + Date.now() + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', phone: '0612345603', tier: 'rtg', pasApp: 'rtg' });
    const token = reg.body.token;
    const st = await post(srv.base, '/api/onboarding/status', {}, token);
    await post(srv.base, '/api/onboarding/teken', { naam: 'Typer Proef', akkoord: true, contractVersion: st.body.contract.versie }, token);
    const reizen = (await post(srv.base, '/api/reisbureau', {}, token)).body.reizen;
    const ibiza = reizen.find((r) => /ibiza/i.test(r.bestemming)) || reizen[0];
    const ref = (await post(srv.base, '/api/reisbureau/boek', { tripId: ibiza.id, personen: 6, vertrek: '2026-11-03' }, token)).body.aanvraag.ref;
    const ibizaVoor = JSON.stringify((await post(srv.base, '/api/reisbureau/mijn', {}, token)).body.aanvragen);

    await page.addInitScript((t) => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const rij = page.locator('.aanvraag[data-ref="' + ref + '"]');
    await rij.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGRahulTabHelpers && !!window.RTGEdgeConceptwerk, null, { timeout: 20000 });
    await rij.locator('h3').click();
    const tab = page.locator('.rtg-rahul-tab').first();
    await tab.waitFor({ timeout: 20000 });
    await tab.click();
    const veld = page.locator('.rtg-rahul-page input[aria-label="Vraag Rahul"]');
    await veld.waitFor({ state: 'visible', timeout: 10000 });
    await veld.fill('Ik wil met zes vrienden vier dagen naar Rome, maximaal 800 euro per persoon.');
    await veld.press('Enter');
    const kaart = page.locator('.rtg-rahul-page .rtg-conceptwerk');
    await kaart.waitFor({ timeout: 20000 });
    const voorModel = model.verzoeken.length;
    if (process.env.RTG_DEBUG) console.log('MAAT', JSON.stringify(await page.evaluate(() => {
      const i = document.querySelector('.rtg-conceptwerk input[name="bestemming"]'), l = i.parentElement, g = l.parentElement;
      const cs = getComputedStyle(i), regels = [];
      for (const sh of document.styleSheets) { let r; try { r = sh.cssRules; } catch (e) { continue; }
        (function loop(rs) { for (const x of rs) { if (x.cssRules && !x.selectorText) loop(x.cssRules); else if (x.selectorText) { try { if (i.matches(x.selectorText) && /width|radius/.test(x.style.cssText)) regels.push(x.selectorText.slice(0, 90) + ' :: ' + x.style.cssText.slice(0, 120)); } catch (e) {} } } })(r); }
      return { input: i.getBoundingClientRect().width, label: l.getBoundingClientRect().width, grid: g.getBoundingClientRect().width, w: cs.width, minw: cs.minWidth, regels };
    })));

    const klik = [], typ = [];
    let versie = 1;
    for (let i = 0; i < 3; i++) {
      // klikken: het veld Reizigers
      const n = String(8 + i);
      await kaart.locator('input[name="reizigers"]').fill(n);
      const t0 = Date.now();
      await kaart.locator('input[name="reizigers"]').press('Tab');
      versie += 1;
      await page.waitForFunction((v) => document.querySelector('.rtg-conceptwerk').getAttribute('data-versie') === String(v), versie, { timeout: 10000 });
      klik.push(Date.now() - t0);
      // typen: dezelfde soort wijziging, in woorden
      const d = 5 + i;
      await veld.fill('Maak er ' + d + ' dagen van');
      const t1 = Date.now();
      await veld.press('Enter');
      versie += 1;
      await page.waitForFunction((a) => {
        const k = document.querySelector('.rtg-conceptwerk');
        return k.getAttribute('data-versie') === String(a.v) && k.querySelector('input[name="dagen"]').value === String(a.d);
      }, { v: versie, d }, { timeout: 10000 });
      typ.push(Date.now() - t1);
    }
    console.log('# van handeling tot zichtbaar op de kaart: klikken ' + klik.join('/') + ' ms (mediaan ' + mediaan(klik) +
      '), typen ' + typ.join('/') + ' ms (mediaan ' + mediaan(typ) + ')');

    assert.equal(await page.locator('.rtg-conceptwerk').count(), 1, 'een kaart, ook na zes wijzigingen');
    assert.equal(await kaart.locator('input[name="reizigers"]').inputValue(), '10');
    assert.equal(await kaart.locator('input[name="dagen"]').inputValue(), '7');
    assert.equal(await kaart.locator('.rahul').textContent(),
      'Rahul · Concept bijgewerkt. U plant een reis naar Rome voor 10 personen, 7 dagen, met een maximaal groepsbudget van € 8.000. Er is niets ingediend of geboekt.',
      'na typen dezelfde regel als na klikken');
    assert.equal(model.verzoeken.length, voorModel, 'geen enkele wijziging riep een model aan');
    if (process.env.RTG_DEMO_SCHERM) await page.screenshot({ path: process.env.RTG_DEMO_SCHERM, fullPage: false });
    assert.equal(JSON.stringify((await post(srv.base, '/api/reisbureau/mijn', {}, token)).body.aanvragen), ibizaVoor,
      'de Ibiza-aanvraag is byte voor byte gelijk');
    for (const ms of klik.concat(typ)) assert.ok(ms < 3000, 'een wijziging hoort binnen drie seconden zichtbaar te zijn: ' + ms + ' ms');
    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    await browser.close();
    await stop(srv);
    model.srv.close();
  }
});
