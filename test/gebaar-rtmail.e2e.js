/* DE VEEG OVER POST, TEGEN EEN ECHTE SERVER.

   Dit is het gebaar dat een lid al kent van buiten dit huis: opzij is weg, de
   andere kant is markeren. Juist daarom moet hij hier kloppen -- een veeg die op
   post iets anders doet dan overal, is verwarrender dan geen veeg.

   Wat hier gemeten wordt is niet de laag (dat doet gebaar.e2e.js) maar de
   BELOFTE met een server erachter: het bericht gaat echt naar het archief, de
   weg terug haalt het er echt uit, en een server die weigert krijgt de regel
   terug op het scherm. Bovendien: een volle veeg mag het bericht NIET openen --
   de regel is hier een <button> die bij een tik het bericht toont, en dat is
   precies de botsing waar een veeg over een knop op stuk gaat.

   Zelfde regel als bij de kluis: GEEN vaste wachttijden, er wordt gepold tot de
   server het zegt. Wat de laag belooft is dat het GEBEURT, niet wanneer.

   Draai: node --test test/gebaar-rtmail.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

async function wachtTot(lees, klopt, wat, grens = 8000) {
  const eind = Date.now() + grens;
  let laatst;
  while (Date.now() < eind) {
    laatst = await lees();
    if (klopt(laatst)) return laatst;
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.fail(wat + ' -- na ' + grens + 'ms stond er: ' + JSON.stringify(laatst));
}

async function veegDoor(page, doos) {
  const y = doos.y + doos.height / 2;
  const x0 = doos.x + doos.width * 0.8;
  const px = -(doos.width * 0.62 + 90);
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 22; i++) await page.mouse.move(x0 + (px * i) / 22, y);
  await page.mouse.up();
}

test('een veeg bergt post op, de weg terug haalt hem terug, en een weigering ook',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-post-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Post ' + t, email: 'p' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const api = (pad, body) => fetch(base + '/api/member/rtmail/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then((r) => r.json());

    /* In welke map ligt dit onderwerp volgens de SERVER? Niet volgens het
       scherm -- dat is precies het verschil dat optimistisch bijwerken kan
       verbergen. */
    const mapVan = async (onderwerp) => {
      for (const map of ['in', 'archief', 'prullenbak']) {
        const d = await api('vak', { map });
        if ((d.berichten || []).some((m) => m.onderwerp === onderwerp)) return map;
      }
      return null;
    };

    const start = await api('vak', { map: 'in' });
    const post = (start.berichten || [])[0];
    assert.ok(post && post.onderwerp, 'een vers lid hoort welkomstpost in zijn postvak te hebben');
    const onderwerp = post.onderwerp;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: BROWSER });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/rtmail.html', { waitUntil: 'load' });
    await page.waitForSelector('#main .rij[data-i].gb-rij', { timeout: 20000 });

    // 1. doorvegen bergt het bericht ECHT op, en opent het NIET
    const rij = page.locator('#main .rij[data-i]').first();
    await veegDoor(page, await rij.boundingBox());
    await wachtTot(() => mapVan(onderwerp), (m) => m === 'archief',
      'doorvegen hoort het bericht bij de server in het archief te zetten');
    assert.equal(await page.locator('#terug').count(), 0,
      'een veeg over een regel die zelf een knop is, mag het bericht niet openen');
    /* De melding zegt EERST wat er gebeurd is en dan welk bericht. Andersom werd
       hij op een telefoon afgekapt tot het onderwerp, met een knop Terugdraaien
       ernaast en geen woord over wat je terugdraait. */
    const melding = await page.locator('.gb-terug').textContent();
    assert.match(melding, /^\s*Opgeborgen/, 'de melding hoort te beginnen met wat er gebeurd is');
    assert.match(melding, new RegExp(onderwerp.slice(0, 8), 'i'),
      'de melding hoort ook te zeggen WELK bericht er weg is');

    // 2. de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => mapVan(onderwerp), (m) => m === 'in',
      'Terugdraaien hoort het bericht terug in het postvak te zetten');

    // 3. de andere kant draagt de acties die niets verplaatsen
    await page.waitForSelector('#main .rij[data-i].gb-rij');
    const weer = page.locator('#main .rij[data-i]').first();
    const d2 = await weer.boundingBox();
    await page.mouse.move(d2.x + d2.width * 0.15, d2.y + d2.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) await page.mouse.move(d2.x + d2.width * 0.15 + i * 11, d2.y + d2.height / 2);
    assert.deepEqual(await page.evaluate(() =>
      [...document.querySelectorAll('#main .gb-lade .gb-doe > span')].map((s) => s.textContent)),
      ['Ster', 'Sluimeren tot morgen', 'Overnemen'],
      'naar rechts horen de acties te liggen die het bericht laten staan waar het ligt');
    await page.mouse.up();
    await page.keyboard.press('Escape');

    // 4. wat de server weigert, komt TERUG op het scherm en verandert daar niets
    await page.route('**/api/member/rtmail/verplaats', (r) => r.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'De post is even niet bereikbaar.' })
    }));
    await page.waitForSelector('#main .rij[data-i].gb-rij');
    const derde = page.locator('#main .rij[data-i]').first();
    await veegDoor(page, await derde.boundingBox());
    await page.waitForFunction(() => {
      const m = document.querySelector('.gb-terug');
      return m && /niet bereikbaar/i.test(m.textContent);
    }, null, { timeout: 8000 });
    await page.waitForFunction((o) => [...document.querySelectorAll('#main .rij .nm')]
      .some((n) => n.textContent.trim() === o), onderwerp, { timeout: 8000 });
    assert.equal(await mapVan(onderwerp), 'in',
      'een geweigerde veeg mag bij de server niets veranderd hebben');
    await page.unroute('**/api/member/rtmail/verplaats');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
