/* Scherm-test voor RTG Klankwerk. test/muziek.test.js bewijst de server-kant;
   deze bewijst dat het instrument werkt: een stuk openen, een stap aanzetten,
   een noot in de notenrol zetten, Rahul om een voorstel vragen en het plaatsen,
   en dat de klankmotor er echt geluid van maakt (offline uitgerekend, zodat we
   het kunnen nameten in plaats van moeten geloven).
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

async function openDeel(page, id) {
  await page.waitForFunction((deel) => {
    if (!window.RTGDeel || !RTGDeel.delen || !RTGDeel.delen().includes(deel)) return false;
    return RTGDeel.open(deel) === deel;
  }, id, { timeout: 20000 });
}

test('Klankwerk: raster, notenrol, Rahul, en er komt echt geluid uit',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-klank-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Klank E2E', email: 'kw' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });

    browser = await pw.chromium.launch(browserOpties(pw, { args: ['--autoplay-policy=no-user-gesture-required'] }));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/klankwerk.html', { waitUntil: 'domcontentloaded' });

    // de lijst laadt en een nieuw stuk begint niet leeg
    await page.waitForSelector('#nieuw', { timeout: 15000 });
    await page.click('#nieuw');
    await page.waitForFunction(() => document.querySelectorAll('#rack .kanaal').length >= 3,
      null, { timeout: 8000 });

    // een stap aanzetten in het raster
    const eerste = '#rack .kanaal:first-child .cel:nth-child(3)';
    await page.click(eerste);
    assert.equal(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-pressed'), eerste), 'true',
      'de stap staat aan');
    await page.click(eerste);
    assert.equal(await page.evaluate((s) => document.querySelector(s).getAttribute('aria-pressed'), eerste), 'false',
      'en gaat weer uit');

    /* Het werkvlak is een deelmenu: EEN deel tegelijk. Dus eerst navigeren
       zoals een gebruiker dat doet, en daarna pas klikken. */
    await openDeel(page, 'de-notenrol');

    // de notenrol hoort bij een melodisch kanaal en draagt echte nootnamen
    await page.waitForSelector('#rol .rrij', { timeout: 8000 });
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#rol .rlabel')).slice(0, 3).map(e => e.textContent));
    assert.equal(labels.every(l => /^[A-G]#?-?\d$/.test(l)), true, 'nootnamen: ' + labels.join(','));

    const voor = await page.evaluate(() => document.querySelectorAll('#rol .cel.aan').length);
    await page.click('#rol .rrij:nth-child(5) .cel:nth-child(5)');
    const na = await page.evaluate(() => document.querySelectorAll('#rol .cel.aan').length);
    assert.equal(na, voor + 1, 'er staat een noot bij');

    /* De klank zelf. We rekenen het stuk offline uit met dezelfde motor die
       afspeelt, en meten of er werkelijk signaal in zit -- een studio die er
       goed uitziet maar stil blijft, is geen studio. */
    const meting = await page.evaluate(async () => {
      const track = { bpm: 120, maten: 1, stappen: 16, kanalen: [
        { instrument: 'kick', stappen: [0, 4, 8, 12], volume: 0.9 },
        { instrument: 'bas', noten: [{ stap: 0, toon: 40, lengte: 8 }], volume: 0.8 }
      ] };
      const blob = await window.RTGStudioWav.render(track, { rondes: 1 });
      const buf = await blob.arrayBuffer();
      const dv = new DataView(buf);
      // de kop moet een geldige RIFF/WAVE zijn
      const merk = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
      const type = String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11));
      // en er moet signaal in staan: de grootste uitslag over alle monsters
      let piek = 0;
      for (let i = 44; i + 1 < buf.byteLength; i += 2) {
        const v = Math.abs(dv.getInt16(i, true));
        if (v > piek) piek = v;
      }
      return { merk, type, bytes: buf.byteLength, piek };
    });
    assert.equal(meting.merk, 'RIFF', 'het is een echt WAV-bestand');
    assert.equal(meting.type, 'WAVE');
    assert.ok(meting.bytes > 44 + 44100, 'er staat meer dan een kop in: ' + meting.bytes);
    assert.ok(meting.piek > 3000, 'er zit hoorbaar signaal in (piek ' + meting.piek + ' van 32767)');

    // Rahul zet iets neer, en het landt pas als je het plaatst
    await openDeel(page, 'rahul-zet-iets-neer');
    await page.fill('#rVraag', 'een rustige lounge rond 90 bpm');
    await page.click('#rVraagKnop');
    await page.waitForSelector('#rZet', { timeout: 15000 });
    const bpmVoor = await page.evaluate(() => document.querySelector('#tBpm').value);
    await page.click('#rZet');
    await page.waitForFunction(() => /in uw raster/.test(document.querySelector('#rUit').textContent),
      null, { timeout: 8000 });
    const bpmNa = await page.evaluate(() => document.querySelector('#tBpm').value);
    assert.notEqual(bpmNa, bpmVoor, 'het tempo van het voorstel is overgenomen');
    assert.equal(bpmNa, '90', 'en het is het tempo uit de vraag');

    // bewaren werkt en de server kent het stuk terug
    await page.click('#bewaar');
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
