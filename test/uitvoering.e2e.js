/* HET SCHERM VAN DE UITVOERENDE MEDIA -- want een knop die niemand heeft zien
   werken, is geen knop (LAT.md regel 10).

   De serverkant staat in test/uitvoering.test.js. Deze toets doet wat een lid
   doet: de app openen, een partituur kiezen, zeggen hoeveel tijd hij heeft, en
   kijken wat er komt.

   De scherpste assertie is de TWEEDE. Vraagt iemand minder tijd dan het
   onmisbare deel van het werk duurt, dan hoort daar geen rood kruis te komen
   maar een ANTWOORD: dit is wat de kern duurt, korter bestaat er niet. Een
   scherm dat daar een foutmelding van maakt, draait de hele keuze van
   UITVOEREND.md par. 2.3 terug zonder dat de server verandert.

   Draai: npm run e2e (of los: node --experimental-sqlite --test test/uitvoering.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('een lid vraagt om een uitvoering, en leest waaruit hij bestaat',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitve2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) }).then(r => r.json());

    const u = Date.now().toString().slice(-8);
    const lid = await api('/api/auth/register', { name: 'Partituurlid', email: 'ue' + u + '@x.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(lid.token, 'het lid is ingelogd');

    // eigen werk: een uitgegeven stuk (de kern) en een korte video (verdieping)
    const trackId = (await api('/api/muziek/maak', {}, lid.token)).track.id;
    await api('/api/muziek/bewaar', { id: trackId, naam: 'De lange weg', klaar: true }, lid.token);
    const uitgave = (await api('/api/muziek/uitgeven', { id: trackId }, lid.token)).uitgave;
    const clip = (await api('/api/clips/maak', { titel: 'Aanloop', duurS: 20, mbGeschat: 2 }, lid.token)).id;

    const p = (await api('/api/uitvoering/partituur/maak', { naam: 'De lange weg' }, lid.token)).partituur;
    await api('/api/uitvoering/partituur/onderdeel',
      { id: p.id, fragmentId: 'fragment:track:' + uitgave.id + '@0-60', rol: 'kern', naam: 'Het stuk zelf' }, lid.token);
    await api('/api/uitvoering/partituur/onderdeel',
      { id: p.id, fragmentId: 'fragment:clip:' + clip + '@0-10', rol: 'verdieping', naam: 'Aanloop' }, lid.token);
    await api('/api/uitvoering/partituur/zet',
      { id: p.id, toestemming: { inkorten: true }, klaar: true }, lid.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    await page.goto(base + '/apps/uitvoering.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#kiesP option').length > 0
      && document.querySelector('#kiesP option').value !== '', null, { timeout: 20000 });

    // 1) ruim genoeg tijd: de montage komt, met per regel waarom hij er staat
    await page.selectOption('#kiesP', p.id);
    await page.fill('#budget', '75');
    await page.click('#voerKnop');
    await page.waitForSelector('#uitslag .regel', { timeout: 15000 });
    const regels = await page.$$eval('#uitslag ol .regel b', els => els.map(e => e.textContent));
    assert.equal(regels.length, 2, 'de kern plus de verdieping die past');
    assert.ok(regels.includes('Het stuk zelf'), 'het onmisbare deel staat erin');
    const waaroms = await page.$$eval('#uitslag .waarom', els => els.map(e => e.textContent).filter(Boolean));
    assert.equal(waaroms.length, 2, 'elke regel draagt waarom hij er staat');

    // en het BEWIJS staat er even groot bij, niet in de kleine lettertjes
    const bewijs = await page.$eval('#uitslag .bewijs', e => e.textContent);
    assert.match(bewijs, /Waaruit dit bestaat/, 'het bewijsblok staat er');
    assert.match(bewijs, /70s van 70s|70s/, 'met wat u krijgt: ' + bewijs.slice(0, 120));
    assert.match(bewijs, /niets tussengevoegd|gladgestreken/i, 'en de herleidbaarheid staat erbij');

    /* 2) TE WEINIG TIJD. Dit is de assertie waar het om gaat: geen foutmelding
       maar een antwoord, met de werkelijke duur van de kern erin. */
    await page.fill('#budget', '30');
    await page.click('#voerKnop');
    await page.waitForSelector('#uitslag .weiger', { timeout: 15000 });
    const weiger = await page.$eval('#uitslag', e => e.textContent);
    assert.match(weiger, /waarom/i, 'het scherm legt uit in plaats van te klagen');
    assert.match(weiger, /60/, 'en noemt hoe lang het onmisbare deel werkelijk duurt');
    assert.ok(!/undefined|NaN/.test(weiger), 'geen lege plekken in de uitleg');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + JSON.stringify(fouten));
  } finally {
    if (browser) await browser.close();
    await stop({ child });
  }
});
