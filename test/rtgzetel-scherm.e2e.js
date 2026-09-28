'use strict';
/* STAP TWEE OP HET SCHERM: de boardroom toont per kamer DOOR WIE er zit
   (eigen, andere kamer, zonder toewijzing), en nooit wie. Het getal staat al in
   /api/office/beleidsmotor (test/rtgzetel.test.js); dit bewijst dat de eigenaar
   het ook ZIET, want een getal waar een besluit op moet rusten dat alleen in een
   API staat, bestaat voor wie besluit niet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de boardroom toont de kamers naar toewijzing', { timeout: 180000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgzetelscherm-'));
  const CODE = 'KANTOOR-ZETELSCHERM';
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_OWNER_EMAIL: '' } });
  const api = (pad, body, token) => fetch(base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let browser;
  try {
    const eigenaar = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    const u = Date.now().toString().slice(-8);
    const ria = (await api('auth/register', { name: 'Ria Scherm', email: 'rias' + u + '@x.nl', phone: '06' + u,
      password: 'geheim12345', geboortedatum: '1985-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
    const m = await api('office/rtghuis/maak', { beheerder: 'Ria', beheerderLogin: 'rias' + u + '@x.nl' }, eigenaar);
    assert.equal(m.status, 200, JSON.stringify(m.body));
    const pers = (await api('account/rollen', {}, ria)).body.rollen.find(r => r.rol === 'personeel' && r.code === m.body.code);
    const zaak = (await api('account/start', { rol: 'personeel', code: pers.code, staffId: pers.staffId }, ria)).body.token;
    assert.equal((await api('supplier/rtg/afdeling', { staffId: pers.staffId, kamers: ['financien'] }, zaak)).status, 200);
    const kantoor = (await api('account/start', { rol: 'kantoor' }, ria)).body.token;
    const gedeeld = (await api('office/login', { code: CODE })).body.token;
    await api('office/kamer', { id: 'financien' }, kantoor);
    await api('office/kamer', { id: 'financien' }, gedeeld);

    browser = await pw.chromium.launch(browserOpties(pw));
    const p = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const fouten = [];
    letOpFouten(p, fouten);
    await p.addInitScript(t => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_member_token', t); }, eigenaar);
    await p.goto(base + '/apps/boardroom.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#boTabs .tab[data-paneel="tabLeden"]').click();
    await p.locator('#bmDeuren', { hasText: 'Kamers: door wie er zit' }).waitFor({ timeout: 20000 });
    const tekst = (await p.locator('#bmDeuren').textContent()).replace(/\s+/g, ' ');
    assert.match(tekst, /financien · 2 keer/);
    assert.match(tekst, /1 eigen kamer · 0 andere kamer · 1 zonder toewijzing/);
    assert.doesNotMatch(tekst, /Ria|user-\d+/, 'de soort, niet wie');
    assert.deepEqual(fouten, [], 'geen JS-fouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
