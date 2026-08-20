/* ============================================================================
   SUDOKU IN EEN ECHTE BROWSER.

   De serverkant van dit spel is los nagemeten (test/spelsudoku.test.js) en de
   pagina is statisch nagekeken op wat er NIET meer in mag staan. Wat daarmee
   nog niet vaststaat is of de pagina het ook echt DOET: een puzzel opvragen,
   hem tonen, het ingevulde rooster inleveren en de uitslag van de server laten
   zien. Dat is precies het stuk dat bij deze omzetting nieuw geschreven is en
   dus het stuk dat nooit gedraaid heeft.

   Een tikfout in `api('sudoku-klaar')` is aan de serverkant onzichtbaar: alle
   toetsen daar blijven groen terwijl het spel in de app stukzit. Vandaar deze.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sudoku-e2e-'));

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Puzzelaar', email: 'su' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1982-02-02', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

test('een lid opent Sudoku, krijgt een puzzel van de server en lost hem op',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, token);
    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });

    await page.click('[data-spel="sudoku"]');
    await page.waitForFunction(() => document.querySelectorAll('#suGrid button').length === 81, null, { timeout: 15000 });

    // de puzzel komt van de server, en de oplossing zit er niet bij
    const staat = await page.evaluate(() => ({ puzzel: SU.puzzel, klaar: SU.klaar, heeftOp: 'op' in SU }));
    assert.equal(staat.puzzel.length, 81);
    assert.ok(staat.puzzel.some(v => v === 0), 'er zitten gaten in');
    assert.equal(staat.klaar, false, 'de puzzel loopt');
    assert.equal(staat.heeftOp, false, 'de pagina heeft de oplossing niet');

    /* Oplossen zoals een speler dat doet: vakje kiezen, cijfer tikken. De
       laatste tik levert het rooster in -- dat is het pad dat we willen zien
       lopen, niet een rechtstreekse aanroep van de API. */
    await page.evaluate(async () => {
      const g = SU.puzzel.slice();
      const mag = (i, v) => {
        const r = Math.floor(i / 9), k = i % 9;
        for (let j = 0; j < 9; j++) if (g[r * 9 + j] === v || g[j * 9 + k] === v) return false;
        const br = r - r % 3, bk = k - k % 3;
        for (let rr = 0; rr < 3; rr++) for (let kk = 0; kk < 3; kk++) if (g[(br + rr) * 9 + bk + kk] === v) return false;
        return true;
      };
      const zoek = () => {
        const i = g.indexOf(0);
        if (i === -1) return true;
        for (let v = 1; v <= 9; v++) if (mag(i, v)) { g[i] = v; if (zoek()) return true; g[i] = 0; }
        return false;
      };
      zoek();
      for (let i = 0; i < 81; i++) {
        if (SU.puzzel[i]) continue;
        document.querySelector('#suGrid button[data-i="' + i + '"]').click();
        await window.suVul(g[i]);
      }
    });

    await page.waitForFunction(() => /Opgelost in/.test(document.querySelector('#suInfo').textContent), null, { timeout: 15000 });
    const info = await page.evaluate(() => document.querySelector('#suInfo').textContent);
    assert.match(info, /Opgelost in \d+ tellen/, 'de uitslag van de server staat op het scherm: ' + info);
    assert.match(info, /\d+ punten/, 'met de punten die de server rekende: ' + info);

    // en de ranglijst onder vrienden heeft die score meteen te pakken
    await page.waitForFunction(() => /\(jij\)/.test(document.querySelector('#suBordLijst').textContent), null, { timeout: 15000 });
    const bord = await page.evaluate(() => document.querySelector('#suBordLijst').textContent);
    assert.match(bord, /\(jij\)/, 'de eigen score staat op het bord: ' + bord);

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ============================================================================
   DE DAGOPGAVE IN DEZELFDE BROWSER.

   De serverkant staat los nagemeten in test/speldag.test.js. Wat daarmee nog
   niet vaststaat is of de PAGINA de tweede ingang ook echt gebruikt: de
   dagopgave loopt langs `dag-start` en `dag-klaar` en niet langs de gewone
   sudoku-ingangen, en een tikfout daarin is aan de serverkant onzichtbaar --
   alle toetsen daar blijven groen terwijl de dagknop in de app niets doet.

   Er wordt ook gekeken naar wat er NIET op het scherm staat: geen reeks. Dat
   is dezelfde belofte als in de kern, maar een pagina kan hem zelf verzinnen
   uit wat ze weet, en dan is de maatregel in de kern niets waard.
   ========================================================================== */
test('een lid doet de dagopgave, en die loopt langs de dag-ingangen',
  { skip: geenBrowser(pw) }, async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sudokudag-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2 } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    // welke ingangen de pagina werkelijk aanroept; de dagopgave hoort langs
    // dag-start en dag-klaar te gaan en niet langs sudoku-klaar
    const geroepen = [];
    page.on('request', (r) => {
      const m = /\/api\/member\/spel\/([a-z-]+)$/.exec(r.url());
      if (m) geroepen.push(m[1]);
    });

    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, token);
    await page.goto(base + '/apps/spelen.html', { waitUntil: 'domcontentloaded' });

    await page.click('[data-spel="sudoku"]');
    await page.waitForSelector('#suDagKnop', { timeout: 15000 });
    const aanbod = await page.evaluate(() => document.querySelector('#suDag').textContent);
    assert.match(aanbod, /klok begint zodra je start/i, 'kijken kost je geen tijd: ' + aanbod);
    /* En dat is niet alleen wat er STAAT: de pagina hoort de startingang op dit
       moment nog niet geraakt te hebben. Zonder deze regel bewijst de zin
       hierboven niets -- een pagina die stiekem al start toont hem gewoon. */
    assert.equal(geroepen.includes('dag-start'), false,
      'de klok liep al door alleen te kijken: ' + geroepen.join(','));

    await page.click('#suDagKnop');
    await page.waitForFunction(() => SU.dag === true && SU.puzzel && SU.klaar === false, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => document.querySelectorAll('#suNiveau button').length), 0,
      'tijdens de dagopgave valt er geen niveau te kiezen -- hij is voor iedereen dezelfde');

    // oplossen zoals een speler dat doet; de laatste tik levert in
    await page.evaluate(async () => {
      const g = SU.puzzel.slice();
      const mag = (i, v) => {
        const r = Math.floor(i / 9), k = i % 9;
        for (let j = 0; j < 9; j++) if (g[r * 9 + j] === v || g[j * 9 + k] === v) return false;
        const br = r - r % 3, bk = k - k % 3;
        for (let rr = 0; rr < 3; rr++) for (let kk = 0; kk < 3; kk++) if (g[(br + rr) * 9 + bk + kk] === v) return false;
        return true;
      };
      const zoek = () => {
        const i = g.indexOf(0);
        if (i === -1) return true;
        for (let v = 1; v <= 9; v++) if (mag(i, v)) { g[i] = v; if (zoek()) return true; g[i] = 0; }
        return false;
      };
      zoek();
      for (let i = 0; i < 81; i++) {
        if (SU.puzzel[i]) continue;
        document.querySelector('#suGrid button[data-i="' + i + '"]').click();
        await window.suVul(g[i]);
      }
    });

    await page.waitForFunction(() => /dagopgave gedaan/i.test(document.querySelector('#suInfo').textContent), null, { timeout: 15000 });
    const info = await page.evaluate(() => document.querySelector('#suInfo').textContent);
    assert.match(info, /plaats 1 van 1/, 'de plaats in het veld komt van de server: ' + info);

    await page.waitForFunction(() => /vandaag gedaan/i.test(document.querySelector('#suDag').textContent), null, { timeout: 15000 });
    const dagblok = await page.evaluate(() => document.querySelector('#suDag').textContent);
    assert.match(dagblok, /1 speler loste hem vandaag op/, 'en het veld van vandaag staat erbij: ' + dagblok);
    assert.equal(/opnieuw|start de dagopgave/i.test(dagblok), false, 'er staat geen tweede poging aangeboden: ' + dagblok);
    assert.equal(/reeks|op rij|streak|dagen achter/i.test(dagblok), false,
      'de pagina verzint zelf een reeks: ' + dagblok);

    assert.ok(geroepen.includes('dag-start') && geroepen.includes('dag-klaar'),
      'de dagopgave loopt langs zijn eigen ingangen: ' + geroepen.join(','));
    assert.equal(geroepen.filter(a => a === 'sudoku-klaar').length, 0,
      'de dagopgave is langs de gewone sudoku-ingang gegaan: ' + geroepen.join(','));

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});
