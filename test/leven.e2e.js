/* Schermtoets voor het levens-command-center (LEVEN.md par. 1.5).

   Deze toets bewaakt EEN ding, en dat is de zwaarste regel van dit scherm:
   fasen zonder aanwijzing komen NIET in beeld, ook niet grijs. Wie geen
   studie, geen kinderen of geen pensioen heeft, mist niets (par. 1.1); een
   grijze fase leest als een gemiste stap en maakt van de levenslijn stilletjes
   een voortgangsbalk over iemands leven.

   Daarnaast: geen enkel patroon dat om terugkomen vraagt (par. 2.9), en geen
   getal dat mensen vergelijkt (par. 2.4). Die zijn hier op de GERENDERDE
   tekst gemeten en niet op de bron, want een verbod dat je op de broncode
   toetst overleeft geen herschrijving.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
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

test('het levens-command-center: geen lege fasen, geen balk, geen aansporing',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leven-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Leven Echt', email: 'le' + t + '@e.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123',
        geboortedatum: '1994-05-05', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'registreren hoort een token te geven');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/leven.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lv-staat', { timeout: 15000 });

    const beeld = await page.evaluate(() => ({
      staat: (document.querySelector('.lv-staat') || {}).textContent || '',
      getekend: [...document.querySelectorAll('.lv-fase')].map((x) => x.dataset.staat),
      balk: !!document.querySelector('progress, [role="progressbar"]'),
      tekst: (document.getElementById('inhoud').innerText || '').toLowerCase()
    }));

    /* De server kent tien fasen; een vers lid heeft er hooguit een paar met
       een aanwijzing. Wat hier telt is dat er GEEN nvt op het scherm staat. */
    const lijn = await (await fetch(base + '/api/leven/lijn', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: '{}'
    })).json();
    const nvt = (lijn.fasen || []).filter((f) => f.staat === 'nvt').length;
    assert.ok(nvt > 0, 'een vers lid hoort fasen zonder aanwijzing te hebben, anders meet deze toets niets');
    assert.equal(beeld.getekend.filter((s) => s === 'nvt').length, 0,
      'een fase zonder aanwijzing hoort NIET op het scherm te staan (LEVEN.md par. 1.1)');
    assert.equal(beeld.getekend.length, (lijn.fasen || []).length - nvt,
      'precies de fasen met een aanwijzing, niet meer en niet minder');

    assert.ok(beeld.staat.length > 0, 'het scherm zegt in een regel hoe het ervoor staat');
    assert.equal(beeld.balk, false, 'geen voortgangsbalk over een leven');

    /* par. 2.9 en 2.4, op de getoonde tekst. "van de 10" vangt de teller die
       een levenslijn ongemerkt in een score verandert. */
    for (const woord of ['streak', 'op rij', 'dagdoel', 'badge', 'punten', 'score',
      'van de 10', '% voltooid', 'beter dan']) {
      assert.equal(beeld.tekst.includes(woord), false,
        'het scherm hoort geen "' + woord + '" te tonen (LEVEN.md par. 2.4 en 2.9)');
    }

    /* De mentor antwoordt met zijn verantwoording eronder (par. 2.10). */
    await page.fill('#lvMentorIn', 'Hoe sta ik ervoor?');
    await page.click('#lvMentorForm button[type="submit"]');
    await page.waitForFunction(() => {
      const el = document.getElementById('lvMentorUit');
      return el && !el.hidden && !/ogenblik/i.test(el.textContent);
    }, { timeout: 15000 });
    const mentor = await page.evaluate(() => ({
      tekst: document.getElementById('lvMentorUit').innerText,
      gegevens: [...document.querySelectorAll('#lvMentorUit .lv-geg li')].length
    }));
    assert.ok(mentor.gegevens > 0, 'een antwoord komt met de gebruikte gegevens erbij');
    for (const zin of ['niets voor jou', 'niet geschikt', 'kans is klein', 'haalbaar']) {
      assert.equal(mentor.tekst.toLowerCase().includes(zin), false,
        'de mentor opent en raadt nooit af (LEVEN.md par. 2.2): "' + zin + '"');
    }

    const echteFouten = fouten.filter((f) => !/favicon/i.test(f));
    assert.deepEqual(echteFouten, [], 'het scherm hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
