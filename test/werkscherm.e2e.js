/* Het Werk OS-scherm in een echte browser: /apps/werk.html.

   Drie beweringen die van buiten NIET te zien zijn aan een groene API-toets:

   1. ZONDER SLEUTEL STAAT ER EEN INLOGKAART, geen leeg scherm en geen
      omleiding die kwijtraakt waar je heen wilde (dezelfde regel als
      TAKEN 5.5). De kaart legt bovendien uit dat een werkruimtesleutel iets
      anders is dan een RTG-pas.
   2. HET STARTSCHERM VOLGT DE ROLLEN EN LIEGT NIET: wat geen bron heeft staat
      er als NIET GEMETEN met de reden erbij, en de snelle acties komen van de
      server.
   3. DE EIGENAAR KOMT BINNEN ZONDER TOKEN OVER TE TYPEN. Wie als RTG-lid is
      ingelogd en de eigenaar IS, opent deze pagina en staat meteen in zijn
      eigen werkruimte -- dat was de melding die dit bestand uitbreidde: "ik
      zie geen werkplek in mijn account".
   4. DE WEIGERINGEN VAN DE SERVER KOMEN OP HET SCHERM. Een taak die nog wacht
      gaat niet af, en het scherm zegt waarop hij wacht. Dat is de hele waarde
      van die weigering: een gebruiker die hem niet ziet, klikt gewoon door.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkscherm-'));

test('het Werk OS toont zonder sleutel een inlogkaart, en daarbinnen een startscherm dat niet liegt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, body) => fetch(base + '/api/bedrijf' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const w = await api('/werkruimte/maak', { naam: 'Toetsbedrijf', land: 'NL' });
    const lid = await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Pia' });
    await api('/lid/besluit', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: lid.lidId, akkoord: true });
    await api('/lid/rollen', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: lid.lidId,
      rollen: ['projectleider'] });
    const S = { werkruimte: w.werkruimte, lidToken: lid.lidToken };
    const p = await api('/project/maak', Object.assign({ naam: 'Uitrol Utrecht', werkvorm: 'stadsuitrol' }, S));
    const eerst = await api('/taak/maak', Object.assign({ titel: 'Vergunning aanvragen', projectId: p.project.id, wie: 'Pia' }, S));
    const later = await api('/taak/maak', Object.assign({ titel: 'Opening plannen', projectId: p.project.id, wie: 'Pia' }, S));
    await api('/taak/wacht-op', Object.assign({ taakId: later.taak.id, wachtOpId: eerst.taak.id }, S));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- zonder sleutel: een kaart, geen leeg scherm ---- */
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      kaart: !document.getElementById('inlog').hidden,
      inhoud: !document.getElementById('inhoud').hidden,
      tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/werk.html', 'de pagina stuurt niemand weg');
    assert.equal(uit.kaart, true, 'de inlogkaart staat open');
    assert.equal(uit.inhoud, false, 'en de inhoud is dicht');
    assert.match(uit.tekst, /eigen sleutel|lid-token/i, 'de kaart legt uit wat er nodig is');
    assert.match(uit.tekst, /geen pas heeft/i, 'en dat een werkruimte iets anders is dan een RTG-pas');

    /* ---- een verkeerde sleutel opent niets ---- */
    await page.fill('#iWerkruimte', w.werkruimte);
    await page.fill('#iToken', 'raden-maar');
    await page.click('#inlogGa');
    await page.waitForTimeout(600);
    const naFout = await page.evaluate(() => ({ inhoud: !document.getElementById('inhoud').hidden,
      melding: document.getElementById('melding').textContent }));
    assert.equal(naFout.inhoud, false, 'met een verkeerd token blijft de deur dicht');
    assert.match(naFout.melding, /token|werkruimte/i, 'en het scherm zegt waarom: ' + naFout.melding);

    /* ---- met de sleutel: het startscherm ---- */
    await page.fill('#iWerkruimte', w.werkruimte);
    await page.fill('#iToken', lid.lidToken);
    await page.click('#inlogGa');
    await page.waitForTimeout(900);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Pia/, 'het startscherm noemt wie er kijkt');
    assert.match(tekst, /projectleider/, 'met zijn rol');
    assert.match(tekst, /Uitrol Utrecht/, 'en het lopende project');

    const niet = await page.evaluate(() => document.getElementById('wNiet').innerText.replace(/\s+/g, ' '));
    assert.match(niet, /berichten|documenten|agenda/i, 'blokken zonder bron staan als niet gemeten');
    assert.match(niet, /nog geen bron/i, 'met de reden erbij');
    assert.ok(!/\b0\b/.test(niet.replace(/\d+ dag/g, '')), 'en niet als een nul: ' + niet.slice(0, 160));

    const acties = await page.evaluate(() => document.getElementById('wActies').innerText);
    assert.match(acties, /Nieuwe taak/, 'de snelle acties volgen de rechten van een projectleider');
    assert.ok(!/Verlof beoordelen/.test(acties), 'en tonen niets waar hij geen recht op heeft');

    /* ---- de weigering van de server komt op het scherm ---- */
    await page.click('#tabModules');
    await page.waitForTimeout(800);
    tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Vergunning aanvragen/, 'de taken staan in de modulelijst');
    assert.match(tekst, /wacht/, 'en een geblokkeerde taak is als zodanig gemerkt');

    const geweigerd = await page.evaluate(async (s) => {
      const r = await fetch('/api/bedrijf/taak/kolom', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ kolom: 'klaar' }, s)) });
      return { status: r.status, body: await r.json() };
    }, Object.assign({ taakId: later.taak.id }, S));
    assert.equal(geweigerd.status, 409, 'een taak die nog wacht gaat niet af');
    assert.match(geweigerd.body.error, /Vergunning aanvragen/, 'en de weigering noemt waarop hij wacht');

    /* ---- uitloggen sluit de inhoud weer ---- */
    await page.click('#inlogUit');
    await page.waitForTimeout(400);
    const naUit = await page.evaluate(() => !document.getElementById('inhoud').hidden);
    assert.equal(naUit, false, 'na uitloggen is de inhoud weer dicht');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de eigenaar staat meteen in zijn eigen werkruimte, zonder een token over te typen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkeig-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2 } });
  let browser;
  try {
    const inlog = await fetch(base + '/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' }) })
      .then(r => r.json());
    assert.ok(inlog.token, 'de eigenaar kan inloggen: ' + JSON.stringify(inlog).slice(0, 120));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_werk_sessie');
      localStorage.setItem('rtg_member_token', t);
    }, inlog.token);
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);

    const stand = await page.evaluate(() => ({ kaart: !document.getElementById('inlog').hidden,
      inhoud: !document.getElementById('inhoud').hidden,
      tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(stand.kaart, false, 'de inlogkaart blijft dicht: er was al een weg naar binnen');
    assert.equal(stand.inhoud, true, 'en de werkplek staat open');
    assert.match(stand.tekst, /Rahul Travel Group/, 'in zijn eigen werkruimte');
    assert.match(stand.tekst, /directie/, 'met de directie-rol');

    /* En hij is te VINDEN: een tegel op het bureaublad. Dat was de tweede
       helft van de melding -- een app die alleen bestaat als je het adres
       kent, bestaat voor een gebruiker niet. */
    await page.goto(base + '/apps/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const tegels = await page.evaluate(() => Array.from(document.querySelectorAll('a.app'))
      .map(a => a.getAttribute('href')));
    assert.ok(tegels.includes('/apps/werk.html'), 'de werkplek heeft een tegel op het bureaublad');
    assert.ok(tegels.includes('/apps/office.html'), 'en RTG Office ook; die had er nooit een');

    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    // en de werkplek staat ook gewoon in de app-bibliotheek
    const inBieb = await page.evaluate(async () => {
      const r = await fetch('/api/gids/app', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad: '/apps/werk.html' }) });
      return r.status;
    });
    assert.equal(inBieb, 200, 'de app-gids kent de werkplek');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});
