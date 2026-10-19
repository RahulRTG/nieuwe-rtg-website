/* EEN GEDEELD TOESTEL: DE GEZINSSESSIE VAN A IS NIET VAN B.

   De gezinssessie (rtf_sessie: code, token, profiel) staat per BROWSER en niet
   per account (opgemerkt bij de controle van de gezinsregel in Heel RTG,
   LivingOS-B, 19 oktober 2026). Het gezinstoken is een eigen sleutel: de
   server vraagt er geen ledentoken bij. Bleef hij na een accountwissel staan,
   dan las en schreef de volgende mens op dat toestel in het gezin van de
   vorige -- het kanaal, de profielen, de kinderen.

   Twee wegen, allebei zoals een mens ze loopt in /apps/app.html:
   1. A opent een gezinsprofiel en logt uit; B logt daarna in.
   2. A opent een gezinsprofiel en laat het toestel open liggen; B logt in.
   In beide gevallen staat er daarna geen gezinssessie meer in de browser, en
   het token van A opent ook rechtstreeks op de server niets meer: de app trekt
   hem in (/api/foundation/gezin/sessie/intrek), zodat een kopie niets waard is.

   Draai los: node --test test/gezinssessie-gedeeld-toestel.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const WW = 'geheim12345';

test('een gezinssessie overleeft geen uitlog en geen accountwissel op hetzelfde toestel', { skip: geenBrowser(pw) }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezin-gedeeld-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dir, RTF_GEZIN_ACCOUNTPLICHT: '1' } });
  let browser = null;
  t.after(async () => { if (browser) await browser.close(); stop(srv.child); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} });

  const post = async (pad, lijf, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  const lid = async (n) => {
    const u = (Date.now() + n).toString().slice(-8) + n;
    const email = 'gedeeld' + u + '@voorbeeld.nl';
    const r = await post('/api/auth/register', { name: 'Gedeeld ' + n, email, phone: '06' + u.slice(0, 8), password: WW, geboortedatum: '1985-05-05', tier: 'guest' });
    assert.equal(r.status, 200, 'registreren ' + n);
    return { email, token: r.data.token };
  };
  /* Zoals Mijn gezin (apps/foundation/eigen-gezin.js): het gezin aan het
     account, en de sessie die het scherm in rtf_sessie zet. */
  const A = await lid(1), B = await lid(2);
  const g = await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'Gezin A', naam: 'Ouder A', bevoegdGezin: true, privacyAkkoord: true }, A.token);
  assert.equal(g.status, 200, 'het gezin van A');
  const sessieVanA = async () => {
    // A logde in de vorige stap uit (dat token is dood): eerst opnieuw binnen
    if ((await post('/api/state', {}, A.token)).status !== 200) A.token = (await post('/api/auth/login', { login: A.email, password: WW })).data.token;
    const s = await post('/api/rtf/eigen-gezin/sessie', {}, A.token);
    assert.equal(s.status, 200, 'A opent zijn profiel');
    return { code: s.data.code, token: s.data.token, gezin: s.data.gezin, profiel: s.data.profiel };
  };
  const leesGezin = (s) => fetch(srv.base + '/api/foundation/gezin/' + encodeURIComponent(s.code) + '/mij',
    { headers: { Authorization: 'Bearer ' + s.token } }).then((r) => r.status);

  browser = await pw.chromium.launch(browserOpties(pw));
  const toestel = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await toestel.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); } catch (e) {} });
  const page = await toestel.newPage();
  const open = async () => { await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' }); };
  const zet = (sleutel, waarde) => page.evaluate(([k, v]) => localStorage.setItem(k, v), [sleutel, waarde]);
  const binnen = () => page.waitForFunction(() => document.getElementById('app') && document.getElementById('app').classList.contains('active'), null, { timeout: 30000 });
  /* B logt in langs het inloggesprek, zoals een mens: andere manier, e-mail, wachtwoord. */
  const logInAlsB = async () => {
    await page.waitForSelector('#agAnders', { timeout: 30000 });
    await page.click('#agAnders');
    await page.waitForSelector('#agIn', { state: 'visible' });
    await page.fill('#agIn', B.email); await page.click('#agGo');
    await page.waitForFunction(() => document.getElementById('agIn').type === 'password', null, { timeout: 15000 });
    await page.fill('#agIn', WW); await page.click('#agGo');
    await binnen();
  };
  /* Wat B in deze browser met het gezin van A kan: de sessie die er staat. */
  const watBZiet = () => page.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem('rtf_sessie') || 'null');
    if (!s || !s.code || !s.token) return { sessie: false, status: null };
    const r = await fetch('/api/foundation/gezin/' + encodeURIComponent(s.code) + '/mij', { headers: { Authorization: 'Bearer ' + s.token } });
    return { sessie: true, status: r.status };
  });
  /* De intrekking vertrekt met keepalive; geef de server een tel. */
  const totDicht = async (s) => { for (let i = 0; i < 40; i++) { const st = await leesGezin(s); if (st !== 200) return st; await new Promise((r) => setTimeout(r, 100)); } return 200; };

  await t.test('1. A logt uit, B logt in: B leest niets in het gezin van A', async () => {
    const s = await sessieVanA();
    assert.equal(await leesGezin(s), 200, 'de sessie van A werkt voor A');
    await open();
    await zet('rtg_member_token', A.token); await zet('rtf_sessie', JSON.stringify(s));
    await open(); await binnen();
    await page.evaluate(() => document.getElementById('logoutBtn').click());
    await page.waitForLoadState('domcontentloaded');
    await logInAlsB();
    const b = await watBZiet();
    assert.equal(b.sessie, false, 'na het uitloggen van A staat zijn gezinssessie nog in de browser (B ziet hem, status ' + b.status + ')');
    assert.notEqual(await totDicht(s), 200, 'het gezinstoken van A opent na zijn uitlog nog steeds zijn gezin');
  });

  await t.test('2. A laat het toestel open liggen, B logt in: B leest niets in het gezin van A', async () => {
    const s = await sessieVanA();
    await page.evaluate(() => { try { localStorage.removeItem('rtg_member_token'); } catch (e) {} });
    await zet('rtf_sessie', JSON.stringify(s));
    await open();
    await logInAlsB();
    const b = await watBZiet();
    assert.equal(b.sessie, false, 'na de inlog van B staat de gezinssessie van A nog in de browser (B ziet hem, status ' + b.status + ')');
    assert.notEqual(await totDicht(s), 200, 'het gezinstoken van A opent na de accountwissel nog steeds zijn gezin');
  });
});
