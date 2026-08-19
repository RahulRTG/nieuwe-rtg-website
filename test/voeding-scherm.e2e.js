/* Schermtoets voor apps/voeding.html.

   Dit scherm belooft vooral iets NIET, en dat is precies wat op het scherm zelf
   nagekeken hoort te worden: een motor die niets telt naast een scherm dat er
   alsnog een cijfer of een waarschuwing bij zet, is voor een lezer hetzelfde
   probleem. De scherpste vorm daarvan staat hieronder: een lid plant iets waar
   zijn eigen allergeen in zit, en er komt GEEN waarschuwing -- want een
   waarschuwing die soms komt, leest als een controle die altijd draait.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Voeding: een plan in je eigen woorden, zonder cijfer en zonder oordeel',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voedscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Voed Lid', email: 'voedscherm@x.nl', phone: '0612345911',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());

    // een allergeen in het zorgprofiel, via de eigen deur van dat profiel
    await api('zorgprofiel/zet', { allergenen: ['noten'], dieet: 'vegetarisch', medisch: '', delen: false });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/voeding.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const e = document.getElementById('week');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, { timeout: 15000 });

    /* 1. de grens staat er op een leeg scherm, met een echte weg ernaartoe. */
    assert.match(await page.textContent('#grens'), /telt uw eten niet/i);
    assert.match(await page.textContent('#grens'), /dietist/i);

    /* 2. de allergenen staan er als geheugensteun, met erbij dat RTG niet nakijkt. */
    await openDeel(page, 'Wat u zelf heeft doorgegeven');
    const geheugen = await page.textContent('#geheugen');
    assert.match(geheugen, /noten/);
    assert.match(geheugen, /vegetarisch/);
    assert.match(geheugen, /kijkt niet na/i);

    /* 3. iets plannen waar het eigen allergeen in zit. Het wordt gewoon bewaard
       en er komt GEEN waarschuwing. */
    await openDeel(page, 'Een maaltijd erbij');
    await page.selectOption('#vWanneer', 'tussendoor');
    await page.locator('#vWat').fill('Handje noten');
    const maak = page.locator('#vMaak');
    await maak.scrollIntoViewIfNeeded();
    await maak.click();
    await page.waitForFunction(() => /Handje noten/.test(document.getElementById('week').textContent),
      { timeout: 10000 });

    const week = await page.textContent('#week');
    assert.ok(!/let op|waarschuw|pas op|bevat noten|allergisch/i.test(week),
      'geen waarschuwing bij het plan: dat zou een controle beweren die er niet is');
    assert.ok(!/kcal|calorie|gram|eiwit|koolhydra/i.test(week), 'en nergens een voedingsgetal');

    /* 4. weghalen werkt, en de dag is daarna weer leeg. Eerst terug naar het
       weekdeel: het deelmenu houdt alles wat niet open staat op display:none,
       en een knop die niet zichtbaar is, is niet te klikken. */
    await openDeel(page, 'Deze week');
    const weg = page.locator('#week [data-weg]').first();
    await weg.scrollIntoViewIfNeeded();
    await weg.click();
    await page.waitForFunction(() => !/Handje noten/.test(document.getElementById('week').textContent),
      { timeout: 10000 });

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
