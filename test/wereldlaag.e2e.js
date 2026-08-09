/* Scherm-test voor RTG Wereld. test/wereldlaag.test.js bewijst de server-kant; deze
   bewijst dat de APP het doet, en vooral dat de NAAD werkt.

   Waarom dit een eigen scherm-toets verdient: het hele ontwerp staat of valt bij
   twee dingen die je alleen in een browser ziet. Ten eerste dat de gesloten
   wereld ook op het scherm gesloten IS -- een knop die er klikbaar uitziet en
   pas bij de server een 403 oplevert, is precies de fout die je krijgt zodra het
   scherm zijn eigen rechtenlijstje bijhoudt. Ten tweede dat "Bericht" je echt in
   de APARTE berichten-app zet, in het juiste gesprek. Dat is de belofte "twee
   apps, één beweging", en een belofte in tekst is een belofte in code.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, elevateTier } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('RTG Wereld: de schakelaar, de ene feed, en de sprong naar de berichten-app',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wereld-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const maak = async (n, tier) => {
      const t = Date.now() + '' + n;
      const d = await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'e' + t + '@v.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
      if (tier && tier !== 'rtg') {
        const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).token;
        await elevateTier(base, d.token, tier, office);
      }
      return d.token;
    };
    // A is een gratis lid, B een Lifestyle-lid; ze zijn verbonden
    const a = await maak(1, 'rtg'), b = await maak(2, 'lifestyle');
    const mijA = await api(base, '/api/member/connections', {}, a);
    const mijB = await api(base, '/api/member/connections', {}, b);
    await api(base, '/api/member/connect', { key: mijB.me }, a);
    await api(base, '/api/member/connect/respond', { key: mijA.me, action: 'accept' }, b);
    // B plaatst iets in De Salon; dat hoort in de wereldfeed van A te komen
    await api(base, '/api/salon/plaats', { tekst: 'De boot vertrekt om negen uur' }, b);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, a);
    await page.goto(base + '/apps/wereld.html', { waitUntil: 'load' });

    // 1. de vijf werelden staan er, en Business is voor de gratis pas DICHT --
    //    zichtbaar, want wegstoppen wat je niet hebt is oneerlijk naar beide kanten
    await page.waitForSelector('#werelden button', { timeout: 15000 });
    const werelden = await page.evaluate(() => [...document.querySelectorAll('#werelden button')]
      .map(b => ({ naam: b.textContent, dicht: b.disabled })));
    assert.equal(werelden.length, 5, 'er horen vijf werelden te staan: ' + JSON.stringify(werelden));
    const bus = werelden.find(w => w.naam === 'Business');
    assert.ok(bus, 'Business staat niet in de rij');
    assert.equal(bus.dicht, true, 'Business hoort dicht te zijn voor een gratis pas');
    assert.equal(werelden.find(w => w.naam === 'Lifestyle').dicht, false, 'Lifestyle hoort open te staan');

    // 2. de ene feed toont de Salon-post van B, met zijn bron erbij
    await page.waitForSelector('.kaart', { timeout: 15000 });
    const feed = await page.evaluate(() => document.getElementById('feed').textContent);
    assert.ok(/boot vertrekt/.test(feed), 'de Salon-post staat niet in de wereldfeed: ' + feed.slice(0, 160));
    assert.ok(/DE SALON|De Salon/.test(feed), 'de bron staat niet op de kaart');

    // 3. schakelen verandert de wereld zonder de app te verlaten
    await page.click('#werelden button:nth-child(2)');           // Lifestyle
    await page.waitForFunction(() =>
      document.querySelector('#werelden button:nth-child(2)').getAttribute('aria-current') === 'true',
      null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => location.pathname), '/apps/wereld.html',
      'schakelen hoort je niet naar een andere app te sturen');

    // 4. DE NAAD: "Bericht" brengt je in de APARTE berichten-app, in het gesprek
    //    met de auteur -- en de URL draagt een codenaam, nooit een sleutel
    await page.click('.kaart [data-chat]');
    await page.waitForURL(/\/apps\/comm\.html\?met=/, { timeout: 15000 });
    const url = await page.evaluate(() => location.href);
    assert.ok(!url.includes(mijB.me), 'er staat een sleutel in de URL naar de berichten-app');
    await page.waitForSelector('.bubbels', { timeout: 15000 });
    assert.equal(await page.evaluate(() => location.pathname), '/apps/comm.html',
      'we zijn niet in de berichten-app beland');
    // het onderwerp staat als verwijzing klaar in het veld
    assert.match(await page.evaluate(() => document.getElementById('veld').value), /^rtg:\/\/salon\//,
      'de verwijzing naar de post staat niet klaar in het invoerveld');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
