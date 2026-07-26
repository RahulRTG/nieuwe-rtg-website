/* Scherm-test voor RTF-golf 2: het "Vandaag leren"-blok op de schoolpagina
   (huiswerk en leerstappen direct afvinken) en de schoolpunten die alleen-lezen
   op de gezinsagenda meelezen. Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
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
const plus = n => { const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Vandaag leren op school.html en de schoolpunten alleen-lezen op de gezinsagenda',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfschool2-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  const api = (p, b) => post('/api/foundation' + p, b);
  let browser;
  try {
    /* ---- de keten via de API: school -> leraar -> klas -> gezin -> kind ---- */
    const sch = await api('/school/school/maak', { naam: 'De Startbaan', plaats: 'Delft' });
    const login = await post('/api/office/login', { code: 'RTG-OFFICE' });
    await fetch(base + '/api/office/school/decide', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
      body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
    const p = await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Bram', rol: 'leraar' });
    await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
    const kl = await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Klas 3A' });
    const g = await api('/gezin/maak', { gezinsnaam: 'Fam Scherm', naam: 'Pap', pin: '1234' });
    const kind = await api('/gezin/profiel/maak', { code: g.code, token: g.token,
      naam: 'Roos', rol: 'kind', groep: 'tiener', kleur: '#3A7BD5' });
    const kindToken = (await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id })).token;
    await api('/school/koppel', { code: g.code, token: g.token, klasCode: kl.code, profielId: kind.profiel.id });
    await api('/school/uitnodiging/antwoord', { code: g.code, token: kindToken, klasCode: kl.code, akkoord: true });
    await api('/school/huiswerk/maak', { klasCode: kl.code, leraarToken: p.personeelToken,
      titel: 'Samenvatting maken', vak: 'Biologie', deadline: plus(2) });
    await post('/api/rtf/tiener/toets-maak', { code: g.code, token: kindToken,
      vak: 'Frans', wat: 'unite 4', datum: plus(6) });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    await page.goto(base + '/apps/foundation/school.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: kindToken, profiel: { naam: 'Roos', beheerder: false } });

    /* ---- school.html: het Vandaag leren-blok, met direct afvinken ---- */
    await page.goto(base + '/apps/foundation/school.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Vandaag leren/.test((document.querySelector('#vandaagLeren') || {}).textContent || ''),
      null, { timeout: 15000 });
    const blok = await page.evaluate(() => document.querySelector('#vandaagLeren').textContent);
    assert.ok(/Leren voor Frans/.test(blok), 'de leerstap van de toetsplanner staat in de planning');
    assert.ok(/Samenvatting maken/.test(blok), 'het huiswerk staat op de inleverdag in de planning');
    assert.ok(/Toets Frans/.test(blok), 'de toets zelf staat op zijn dag');
    // de tiener vinkt de leerstap van vandaag af; de rij verdwijnt
    await page.evaluate(() => { document.querySelector('#vandaagLeren [aria-label="Leerstap afvinken"]').click(); });
    await page.waitForFunction(() => {
      const t = (document.querySelector('#vandaagLeren') || {}).textContent || '';
      return t && !/Leren voor Frans.*rustig door/.test(t);
    }, null, { timeout: 8000 });
    // huiswerk afvinken kan hier ook meteen
    await page.waitForSelector('#vandaagLeren [aria-label="Huiswerk afvinken"]', { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#vandaagLeren [aria-label="Huiswerk afvinken"]').click(); });
    await page.waitForFunction(() => !/Samenvatting maken/.test((document.querySelector('#vandaagLeren') || {}).textContent || ''),
      null, { timeout: 8000 });

    /* ---- de gezinsagenda: school leest mee, alleen-lezen ---- */
    await page.goto(base + '/apps/foundation/agenda.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mgrid', { timeout: 15000 });
    await page.evaluate(() => { document.querySelector('[data-zicht="lijst"]').click(); });
    await page.waitForFunction(() => document.querySelector('.litem') &&
      /Toets Frans/.test(document.querySelector('#bord').textContent), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => /van school/.test(document.querySelector('#bord').textContent)),
      'het bronlabel zegt eerlijk waar het punt vandaan komt');
    await page.evaluate(() => {
      const it = [...document.querySelectorAll('.litem')].find(x => /Toets Frans/.test(x.textContent));
      it.click();
    });
    await page.waitForSelector('#afScrim.open', { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.querySelector('#afKop').textContent), 'Van school');
    assert.ok(await page.evaluate(() => document.querySelector('#afSchool').style.display !== 'none'),
      'het paneel legt uit dat dit punt van school komt');
    assert.equal(await page.evaluate(() => document.querySelector('#afBewaar').style.display), 'none',
      'bewaren kan niet: de agenda herschrijft school niet');
    assert.equal(await page.evaluate(() => document.querySelector('#afWeg').style.display), 'none',
      'weghalen kan ook niet');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
