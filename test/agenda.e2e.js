/* Scherm-test voor RTG Agenda: het maandraster, Rahul die in gewone taal
   plant, een afspraak met het paneel, uitnodigen op codenaam en het
   ja-zeggen door de ander, en de ICS-export. Echte namen horen nergens in
   beeld te komen; codenamen wel.
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

test('Agenda: maandraster, Rahul plant, uitnodigen op codenaam, ja zeggen en ICS',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-agenda-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const regA = await api(base, '/api/auth/register', { name: 'Planner Echt', email: 'aa' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1984-02-02', tier: 'rtg' });
    const regB = await api(base, '/api/auth/register', { name: 'Gast Echt', email: 'ab' + t + '@e.test',
      phone: '07' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1992-06-06', tier: 'rtg' });
    const stB = await api(base, '/api/state', {}, regB.token);
    const codeB = stB.state.user.codename;
    const morgen = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const als = async (token) => {
      await page.goto(base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tok) => {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      await page.goto(base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.mgrid', { timeout: 15000 });
    };

    /* ---- A: Rahul plant in gewone taal ---- */
    await als(regA.token);
    await page.fill('#rahulIn', 'proeverij morgen om 15:00');
    await page.click('#rahulBtn');
    await page.waitForFunction(() => /Ingepland/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.waitForFunction(() => /proeverij/i.test(document.querySelector('#kal').textContent),
      null, { timeout: 8000 });

    /* ---- A: het paneel, met herhaling en plek ---- */
    await page.click('#nieuwBtn');
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.fill('#afTitel', 'Padel');
    await page.fill('#afDatum', morgen);
    await page.fill('#afTijd', '09:30');
    await page.fill('#afPlek', 'Baan 2');
    await page.selectOption('#afHerhaal', 'week');
    await page.click('#afBewaar');
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.waitForFunction(() => /Padel/.test(document.querySelector('#kal').textContent),
      null, { timeout: 8000 });

    /* ---- A: uitnodigen op codenaam ---- */
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#kal .chip')).find(c => /Padel/.test(c.textContent)).click();
    });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.fill('#afCode', codeB);
    await page.click('#afNodig');
    await page.waitForFunction(() => /Uitgenodigd/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.click('#afDicht');

    /* ---- B: ziet de uitnodiging en zegt ja ---- */
    await als(regB.token);
    await page.waitForFunction(() => /Padel/.test(document.querySelector('#kal').textContent),
      null, { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#kal .chip')).find(c => /Padel/.test(c.textContent)).click();
    });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    const uitTekst = await page.evaluate(() => document.querySelector('#uitnodigingTekst').textContent);
    assert.ok(/Uitnodiging van/.test(uitTekst), 'B ziet van wie de uitnodiging komt: ' + uitTekst);
    assert.ok(!/Planner Echt/.test(uitTekst), 'en dat is een codenaam, geen echte naam');
    await page.click('#afJa');
    await page.waitForFunction(() => /u komt/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    /* ---- A: ziet de stand per deelnemer, en exporteert ICS ---- */
    await als(regA.token);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#kal .chip')).find(c => /Padel/.test(c.textContent)).click();
    });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    await page.waitForFunction(() => /komt(?! niet)/.test(document.querySelector('#afDeelnemers').textContent),
      null, { timeout: 8000 });
    await page.click('#afDicht');
    await page.click('#icsBtn');
    await page.waitForFunction(() => /rtg-agenda\.ics/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    const heleTekst = await page.evaluate(() => document.body.textContent);
    assert.ok(!/Gast Echt/.test(heleTekst), 'geen echte naam op het scherm van A');
    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
