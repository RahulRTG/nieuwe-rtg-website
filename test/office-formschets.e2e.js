/* Scherm-test voor de twee nieuwe officesoorten: het formulier en de schets.

   Wat hier bewezen wordt, door de echte schermen heen:
   - A bouwt een formulier (open vraag + schaal) en deelt het met B als
     meelezer, op codenaam;
   - B ziet geen bouwers-scherm maar een INVULscherm, stuurt in, en het
     scherm zegt daarna eerlijk dat opnieuw insturen vervangt;
   - A ziet de uitslag: een inzending, de tekst, en de codenaam van B --
     nooit de echte naam;
   - een schets wordt met de muis getekend (slepen), krijgt tekst via
     dubbelklik, bewaart vanzelf en staat er na herladen nog.
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

test('Office: formulier bouwen, delen, invullen en de uitslag; schets tekenen en herladen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-formschets-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const regA = await api(base, '/api/auth/register', { name: 'Bouwer E2E', email: 'fa' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1985-03-03', tier: 'rtg' });
    const regB = await api(base, '/api/auth/register', { name: 'Invuller Echt', email: 'fb' + t + '@e.test',
      phone: '07' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1991-09-09', tier: 'rtg' });
    const stB = await api(base, '/api/state', {}, regB.token);
    const codeB = stB.state.user.codename;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    // een pagina, twee stoelen: het token wisselt, zoals twee leden na elkaar
    // op hetzelfde toestel (addInitScript zou bij elke navigatie A terugzetten)
    const als = async (token) => {
      await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((tok) => {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      await page.goto(base + '/apps/office.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#nieuwFormulier', { timeout: 15000 });
    };

    /* ---- A bouwt het formulier ---- */
    await als(regA.token);
    await page.click('#nieuwFormulier');
    await page.waitForSelector('#fWijze', { timeout: 10000 });
    await page.fill('#titel', 'Rondvraag e2e');
    await page.fill('.fvraag .fv-tekst', 'Wat vond u ervan?');
    await page.click('#fErbij');
    await page.waitForFunction(() => document.querySelectorAll('.fvraag').length === 2, null, { timeout: 5000 });
    await page.evaluate(() => {
      const el = document.querySelectorAll('.fvraag')[1];
      el.querySelector('.fv-tekst').value = 'Uw cijfer';
      el.querySelector('.fv-tekst').dispatchEvent(new Event('input', { bubbles: true }));
      el.querySelector('.fv-soort').value = 'schaal';
      el.querySelector('.fv-soort').dispatchEvent(new Event('change', { bubbles: true }));
    });
    // de eerste vraag wordt verplicht: zonder antwoord geen inzending
    await page.evaluate(() => { document.querySelector('.fvraag .fv-plicht').click(); });
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#staat').textContent),
      null, { timeout: 10000 });

    // delen met B, als meelezer -- invullen hoort bij lezen
    await page.click('#officeMeer > summary');
    await page.click('#deelBtn');
    await page.waitForSelector('#deelScrim.open', { timeout: 5000 });
    await page.fill('#deelCode', codeB);
    await page.selectOption('#deelRechten', 'lezen');
    await page.evaluate(() => { document.querySelector('#deelForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await page.waitForFunction(() => /Alleen lezen/.test(document.querySelector('#deelLijst').textContent),
      null, { timeout: 8000 });

    /* ---- B vult in ---- */
    await als(regB.token);
    await page.waitForSelector('#gedeeldDocs .doc', { timeout: 10000 });
    await page.click('#gedeeldDocs .doc');
    await page.waitForSelector('#fStuur', { timeout: 10000 });
    const uitleg = await page.evaluate(() => document.querySelector('#formWrap .fstil').textContent);
    assert.ok(/codenaam/.test(uitleg), 'het scherm zegt eerlijk op welke wijze wordt ingevuld: ' + uitleg);
    // leeg insturen strandt vriendelijk op de verplichte vraag
    await page.click('#fStuur');
    await page.waitForFunction(() => /verplicht/.test(document.querySelector('#melding').textContent),
      null, { timeout: 5000 });
    await page.fill('.fv-antwoord', 'Prachtig verzorgd');
    await page.evaluate(() => { document.querySelector('input[name="fv1"][value="5"]').click(); });
    await page.click('#fStuur');
    await page.waitForFunction(() => /al ingevuld/.test(document.querySelector('#formWrap').textContent),
      null, { timeout: 8000 });

    /* ---- A leest de uitslag ---- */
    await als(regA.token);
    await page.waitForSelector('#mijnDocs .doc', { timeout: 10000 });
    await page.click('#mijnDocs .doc');
    await page.waitForSelector('#fUitslag', { timeout: 10000 });
    await page.click('#fUitslag');
    await page.waitForFunction(() => /1 inzending/.test(document.querySelector('#formWrap').textContent),
      null, { timeout: 8000 });
    const uitslag = await page.evaluate(() => document.querySelector('#formWrap').textContent);
    assert.ok(/Prachtig verzorgd/.test(uitslag), 'het open antwoord staat in de uitslag');
    assert.ok(uitslag.indexOf(codeB) >= 0, 'de codenaam van B staat erbij (wijze: codenaam)');
    assert.ok(!/Invuller Echt/.test(uitslag), 'de echte naam van B staat er NOOIT bij');
    assert.ok(await page.evaluate(() => document.querySelectorAll('#formWrap .fstaaf').length >= 5),
      'de telling staat er ook als balkje, niet alleen als getal');

    /* ---- de schets: slepen, dubbelklikken, herladen ---- */
    await page.click('#editTerug');
    await page.waitForSelector('#nieuwSchets', { timeout: 10000 });
    await page.click('#nieuwSchets');
    await page.waitForSelector('#schetsWrap .sbalk', { timeout: 10000 });
    await page.fill('#titel', 'Schets e2e');
    await page.evaluate(() => {
      document.querySelector('[data-vorm="kader"]').click();
    });
    await page.evaluate(() => {
      const svg = document.querySelector('#schetsWrap svg');
      const r = svg.getBoundingClientRect();
      const ev = (t, x, y) => svg.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1,
        clientX: r.left + x, clientY: r.top + y }));
      ev('pointerdown', 40, 30); ev('pointermove', 160, 90); ev('pointerup', 160, 90);
    });
    await page.waitForFunction(() => document.querySelectorAll("#schetsWrap svg .sv rect").length === 1,
      null, { timeout: 5000 });
    await page.evaluate(() => {
      window.prompt = () => 'Directie';
      document.querySelector('#schetsWrap svg [data-i]')
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#staat').textContent),
      null, { timeout: 10000 });

    // herladen: de vorm en zijn tekst staan er nog, en de drive telt in vormen
    await als(regA.token);
    await page.waitForSelector('#mijnDocs .doc', { timeout: 10000 });
    await page.evaluate(() => {
      const doc = Array.from(document.querySelectorAll('#mijnDocs .doc'))
        .find(d => /Schets e2e/.test(d.textContent));
      doc.click();
    });
    await page.waitForSelector('#schetsWrap svg .sv rect', { timeout: 10000 });
    const na = await page.evaluate(() => ({
      tekst: document.querySelector('#schetsWrap svg text') ? document.querySelector('#schetsWrap svg text').textContent : null,
      voet: document.querySelector('#voetbalk').textContent
    }));
    assert.equal(na.tekst, 'Directie', 'de tekst van de vorm is bewaard');
    assert.equal(na.voet, '1 vorm', 'de voetbalk telt in vormen');

    /* De grepen: een vorm aanklikken geeft vier hoekgrepen, en aan de
       zuidoost-greep trekken maakt hem echt groter. Daarna dupliceren, en
       Ctrl+Z haalt de kopie weer weg. */
    const breedteVoor = await page.evaluate(() => +document.querySelector("#schetsWrap svg .sv rect").getAttribute('width'));
    await page.evaluate(() => {
      const svg = document.querySelector('#schetsWrap svg');
      const g = svg.querySelector('[data-i]');
      const r = g.getBoundingClientRect();
      const ev = (t, x, y, el) => (el || svg).dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
      ev('pointerdown', r.left + 4, r.top + 4, g); ev('pointerup', r.left + 4, r.top + 4);
    });
    await page.waitForFunction(() => document.querySelectorAll('#schetsWrap .sgreep').length === 4,
      null, { timeout: 5000 });
    await page.evaluate(() => {
      const svg = document.querySelector('#schetsWrap svg');
      const greep = svg.querySelector('.sgreep[data-h="zo"]');
      const r = greep.getBoundingClientRect();
      const ev = (t, x, y, el) => (el || svg).dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, clientX: x, clientY: y }));
      ev('pointerdown', r.left + 6, r.top + 6, greep);
      ev('pointermove', r.left + 106, r.top + 66);
      ev('pointerup', r.left + 106, r.top + 66);
    });
    const breedteNa = await page.evaluate(() => +document.querySelector("#schetsWrap svg .sv rect").getAttribute('width'));
    assert.ok(breedteNa > breedteVoor, 'de greep maakt de vorm echt groter: ' + breedteVoor + ' -> ' + breedteNa);
    await page.click('#sDup');
    await page.waitForFunction(() => document.querySelector('#voetbalk').textContent === '2 vormen',
      null, { timeout: 5000 });
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelector('#voetbalk').textContent === '1 vorm',
      null, { timeout: 5000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
