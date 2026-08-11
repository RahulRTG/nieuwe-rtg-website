/* Scherm-test voor stap 7 uit WERKRUIMTE.md: objecten slepen tussen apps.

   Wat hier bewezen wordt is niet dat er iets beweegt, maar de twee regels die
   dit een operating environment maken in plaats van een desktop met vensters:

     1. EEN SLEEP IS EEN VOORSTEL. Loslaten doet niets; er verschijnt een vraag,
        en pas als een mens bevestigt gebeurt er iets. Annuleren laat de wereld
        precies zoals hij was.
     2. ZWIJGEN IS NEE. Een surface die de soort niet kent, antwoordt niet en is
        dus geen doelwit -- ook niet als je er middenop loslaat.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
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

test('Werkruimte: een object slepen is een voorstel, en pas een mens voert het uit',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-obj-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Sleep Echt', email: 'sl' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-03-03', tier: 'rtg' });
    assert.ok(reg.token);

    const tel = async () => ((await api(base, '/api/agenda/mijn-lijst', {}, reg.token)).items || []).length;
    assert.equal(await tel(), 0, 'de agenda begint leeg');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtg-surface[data-id="agenda"]', { timeout: 15000 });
    /* EEN DERDE SURFACE die de soort NIET kent. Zonder hem is "zwijgen is nee"
       niet te toetsen: met alleen een verzender en een ontvanger licht de
       ontvanger sowieso als enige op, ook als de schil iedereen zou aanwijzen.
       Gemerkt met de mutatie die elke surface ja liet zeggen -- die kwam er
       eerst gewoon doorheen. */
    await page.evaluate(() => RTGSchil.open('office',
      { naam: 'Documenten', url: '/apps/office.html', kort: 'Documenten' }));
    // de surfaces moeten geladen zijn voordat ze op berichten kunnen antwoorden
    await page.waitForTimeout(4000);

    /* Het object komt uit Reizen. We bootsen het OPPAKKEN na op de manier
       waarop de app het stuurt -- via postMessage uit het reizen-frame -- want
       een echte muissleep binnen een iframe is in een toets niet betrouwbaar te
       sturen. Alles daarna is de echte weg: de schil vraagt rond, de agenda
       antwoordt, en het voorstel verschijnt. */
    const morgen = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const reisFrame = page.frames().find(f => f.url().indexOf('/apps/reizen.html') >= 0);
    assert.ok(reisFrame, 'de reizen-surface hoort een eigen frame te zijn');
    /* Sturen VANUIT het frame, niet vanaf de pagina: de schil kijkt naar
       event.source om te weten WELKE surface iets aanbiedt. Een bericht uit het
       topvenster is geen surface en hoort genegeerd te worden -- en dat deed hij
       ook, waardoor deze toets eerst terecht omviel. */
    const pak = async () => reisFrame.evaluate((datum) => {
      window.parent.postMessage({ rtg: 'sleep-start', object: {
        soort: 'reis', id: 'RTG-R-TEST', label: 'Weekend naar Milaan',
        velden: { datum } } }, location.origin);
    }, morgen);

    await pak();
    // de agenda hoort te antwoorden dat hij er iets mee kan
    await page.waitForSelector('.rtg-surface[data-id="agenda"][data-kan-vangen]', { timeout: 8000 });
    const kanVangen = await page.evaluate(() =>
      [...document.querySelectorAll('.rtg-surface[data-kan-vangen]')].map(e => e.dataset.id));
    assert.deepEqual(kanVangen, ['agenda'],
      'alleen de agenda kent de soort "reis"; de rest hoort te zwijgen, en zwijgen is nee');

    // loslaten boven de agenda -> een voorstel, en nog GEEN afspraak
    const doos = await page.evaluate(() => {
      const r = document.querySelector('.rtg-surface[data-id="agenda"]').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(doos.x, doos.y);
    await page.mouse.up();
    await page.waitForSelector('.rtg-voorstel[data-aan]', { timeout: 8000 });
    const tekst = await page.textContent('.rtg-voorstel .wat');
    assert.match(tekst, /Weekend naar Milaan/, 'het voorstel hoort te zeggen WELK object het betreft');
    assert.match(tekst, /agenda/i, 'en wat ermee gaat gebeuren');
    assert.equal(await tel(), 0, 'tot hier is er nog niets gebeurd -- een sleep is een voorstel');

    // annuleren laat de wereld zoals hij was
    await page.click('.rtg-voorstel [data-doe="nee"]');
    /* state:'hidden' -- het voorstel BLIJFT als leeg element staan en gaat op
       display:none. Zonder dit wacht Playwright op "zichtbaar" en valt hij om
       op precies het gedrag dat we willen. */
    await page.waitForSelector('.rtg-voorstel[data-aan]', { state: 'hidden', timeout: 5000 });
    assert.equal(await tel(), 0, 'annuleren hoort niets te doen');

    // en nu wel bevestigen
    await pak();
    await page.waitForSelector('.rtg-surface[data-id="agenda"][data-kan-vangen]', { timeout: 8000 });
    await page.mouse.move(doos.x, doos.y);
    await page.mouse.up();
    await page.waitForSelector('.rtg-voorstel[data-aan]', { timeout: 8000 });
    await page.click('.rtg-voorstel [data-doe="ja"]');
    await page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
    // de agenda voert het uit met zijn eigen sessie; dat kost een serverrondje
    let items = [];
    for (let i = 0; i < 20 && !items.length; i++) {
      items = (await api(base, '/api/agenda/mijn-lijst', {}, reg.token)).items || [];
      if (!items.length) await new Promise(r => setTimeout(r, 400));
    }
    assert.equal(items.length, 1, 'na bevestigen hoort er precies EEN afspraak te staan');
    assert.equal(items[0].titel, 'Weekend naar Milaan');
    assert.equal(items[0].datum, morgen, 'met de datum die de verzender al op zijn scherm had staan');

    assert.deepEqual(fouten, [], 'de werkruimte hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
