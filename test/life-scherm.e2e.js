/* Schermtoets voor apps/life.html. De belofte van dit scherm is dat je NIET
   hoeft te weten welke app je moet openen: een doel dat je in Doelen zet en een
   afspraak die je bij de salon maakt, staan hier vanzelf.

   En de belofte die er nog meer toe doet: wat niet gemeten wordt, staat er als
   niet gemeten. Dat wordt hier op het scherm zelf nagekeken, want een motor die
   het netjes teruggeeft en een scherm dat er alsnog een nul van maakt, is voor
   een lezer hetzelfde probleem.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('RTG Life: een doel uit Doelen staat er, en wat niet gemeten wordt zegt dat',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lifescherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Life Lid', email: 'lifescherm@x.nl', phone: '0612345855',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    // een doel via de API, precies zoals Doelen dat doet
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then(r => r.json());
    await api('doelen/maak', { titel: '10 kilometer hardlopen', reden: 'ik wil het kunnen',
      eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) });
    const id = (await api('doelen', {})).doelen[0].id;
    await api('doelen/meet', { id, waarde: 4 });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/life.html', { waitUntil: 'load' });
    await page.waitForFunction(() => {
      const e = document.getElementById('signalen');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, null, { timeout: 15000 });

    /* 1. de kernbelofte: geen verzonnen cijfers. Slaap, beweging en voeding
       staan er MET hun reden en zonder getal. */
    const signalen = await page.textContent('#signalen');
    for (const naam of ['Slaap', 'Beweging', 'Voeding']) {
      assert.ok(signalen.includes(naam), naam + ' staat op het scherm');
    }
    const aantalNietGemeten = (signalen.match(/niet gemeten/g) || []).length;
    assert.ok(aantalNietGemeten >= 3, 'de drie bronloze signalen zeggen zelf dat ze niet gemeten zijn');
    assert.ok(!/\b0\b/.test(await page.evaluate(() => {
      // alleen de waardekolom van de ongemeten regels: daar hoort geen cijfer te staan
      return [...document.querySelectorAll('#signalen .sig.leeg .waarde')].map(e => e.textContent).join(' ');
    })), 'in de waardekolom van een ongemeten signaal staat geen nul');

    /* 2. het doel uit Doelen staat hier, zonder dat het lid Doelen heeft
       geopend in deze sessie. */
    await openDeel(page, 'Waar u naartoe werkt');
    const doelen = await page.textContent('#doelen');
    assert.match(doelen, /10 kilometer hardlopen/);
    assert.match(doelen, /volgende stap/i, 'met de eerstvolgende stap uit de doelenmotor');

    /* 3. bovenaan staat waar vandaag de aandacht heen gaat, en dat is een van de
       eerlijke uitkomsten en geen verzonnen urgentie. */
    const winst = await page.textContent('#winst');
    assert.ok(/eerstvolgende stap|rustig|rust|vandaag|morgen/i.test(winst),
      'de kop bovenaan is een van de bekende uitkomsten: ' + winst.slice(0, 80));

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
