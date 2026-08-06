/* Scherm-test voor de hele keten van deze ronde: een LIED laten neerzetten met
   een eigen zin erin, het samen produceren, uitgeven, en het in DE ZAAL horen.

   De zwaarste bewering die hier op het scherm getoetst wordt: de RTG-naam komt
   er niet vanzelf onder. Het lid vraagt hem aan, en tot een mens bij het
   kantoor ja zegt staat er de codenaam van de maker -- ook op de kaart in de
   zaal die iedereen ziet.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
/* WAAROM DE WACHTGRENZEN HIER RUIM STAAN. Deze toets wacht op een TOESTAND en
   niet op een tijd -- waitForFunction op een echte voorwaarde in de pagina, dus
   hij gaat door zodra het klaar is. De grens is alleen het geduld. Hij stond op
   8 en 10 seconden en dat is genoeg als hij alleen draait, maar in de volle
   schermsuite staan er zestig browsers op vier kernen en dan valt hij om op een
   voorwaarde die een seconde later wel klopt. Een krappe grens koopt geen
   snelheid (een geslaagde wacht eindigt meteen), alleen een valse rode toets.
   Nagemeten: los slaagt hij, in de volle suite viel hij om, met deze grenzen
   slaagt hij in beide. */
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
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

/* NAAR HET JUISTE DEEL, ZOALS EEN GEBRUIKER DOET.

   Deze toets viel om nadat het gedeelde deelmenu (shared/deelmenu.js) over alle
   apps was uitgerold. Dat menu knipt een lang scherm in secties en toont er EEN
   tegelijk; wie op een knop in een andere sectie klikt, klikt op een element van
   nul bij nul. Playwright meldde dat als "element is not stable" en daarna "not
   visible", en dat leest als flakiness terwijl er niets flakey aan is: de knop
   staat er gewoon niet.

   Het product is hier niet stuk -- een mens tikt eerst op de menuknop. Deze
   toets deed dat niet, want hij is geschreven toen het scherm nog een lange rol
   was. Dit hulpje doet wat de gebruiker doet, en valt terug op niets-doen als
   het menu er (nog) niet is: dan staat alles gewoon onder elkaar. */
async function naarDeel(page, zoek) {
  /* Wachten tot het menu er IS. Het deelt het scherm pas in nadat de app zijn
     inhoud heeft opgebouwd, dus een aanroep vlak na de navigatie treft nog
     niets -- en dan blijft stilletjes het verkeerde deel open. Dat kostte hier
     een ronde: de eerste versie riep alleen aan en keek niet of het lukte. */
  const gelukt = await page.waitForFunction((z) => {
    if (!window.RTGDeel || !RTGDeel.delen) return false;
    const id = RTGDeel.delen().find(d => d.includes(z));
    if (!id) return false;
    RTGDeel.open(id);
    return id;
  }, zoek, { timeout: 20000 }).then(h => h.jsonValue()).catch(() => null);
  assert.ok(gelukt, 'het deel "' + zoek + '" is te openen (delen: ' +
    JSON.stringify(await page.evaluate(() => window.RTGDeel ? RTGDeel.delen() : 'geen menu')) + ')');
  await page.waitForTimeout(150);
}

test('Van lied naar zaal: zingen, samen maken, uitgeven en horen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaal-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR123' } });
  let browser;
  try {
    const t = Date.now();
    const maak = async (naam, n) => api(base, '/api/auth/register', { name: naam,
      email: 'za' + n + t + '@e.test', phone: '06' + String(t + n).slice(-8),
      password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    const baas = await maak('Zaal Baas', 1);
    const maat = await maak('Zaal Maat', 2);
    const maatCode = (await api(base, '/api/state', {}, maat.token)).state.user.codename;

    browser = await pw.chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, baas.token);
    await page.goto(base + '/apps/klankwerk.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#nieuw', { timeout: 15000 });
    await page.click('#nieuw');
    await page.waitForFunction(() => document.querySelectorAll('#rack .kanaal').length >= 3,
      null, { timeout: 20000 });

    /* ---- een heel lied, met een eigen zin ---- */
    await naarDeel(page, 'rahul-zet-iets-neer');
    await page.fill('#rVraag', 'een warme lounge');
    await page.fill('#rTekst', 'de zon komt op boven de haven');
    await page.click('#rLiedKnop');
    await page.waitForSelector('#rZet', { timeout: 20000 });
    await page.click('#rZet');
    await page.waitForFunction(() => document.querySelectorAll('#secties .deel').length >= 4,
      null, { timeout: 20000 });
    const delen = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#secties .deel .dn')).map(e => e.textContent));
    assert.ok(delen.includes('Refrein'), 'er staat een refrein in de vorm: ' + delen.join(','));

    // de zanglijn krijgt de getypte zin, lettergreep voor lettergreep
    await page.evaluate(() => {
      const t = window.RTGKlankwerk.track();
      const i = t.kanalen.findIndex(k => k.instrument === 'zang');
      window.RTGKlankwerk.raster().kies(i);
    });
    /* De zanglijn woont in de notenrol, weer een ander deel. */
    await naarDeel(page, 'de-notenrol');
    await page.waitForSelector('.lettergrepen .lg input', { timeout: 20000 });
    const grepen = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.lettergrepen .lg input')).map(e => e.value));
    assert.ok(grepen.includes('zon'), 'de getypte woorden staan onder de noten: ' + grepen.slice(0, 8).join(','));
    assert.ok(/geen opname van een zanger/.test(await page.evaluate(() =>
      document.querySelector('.tekstrij .stil').textContent)),
      'en er staat eerlijk bij dat de stem opgewekt is');

    /* ---- samen produceren: op codenaam, nooit op een echte naam ---- */
    await naarDeel(page, 'samen-produceren');
    await page.fill('#mCode', maatCode);
    await page.click('#mNodig');
    await page.waitForFunction((code) => document.querySelector('#makers').textContent.includes(code),
      maatCode, { timeout: 20000 });
    const makers = await page.evaluate(() => document.querySelector('#makers').textContent);
    assert.ok(!/Zaal Maat/.test(makers), 'de echte naam staat er niet bij; die blijft in de kluis');

    /* ---- uitgeven, met de RTG-naam als AANVRAAG ---- */
    await page.check('#tKlaar');
    await naarDeel(page, 'uitgeven');
    await page.click('#bewaar');
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#melding').textContent),
      null, { timeout: 20000 });
    await page.waitForSelector('#uitgaveVlak input', { timeout: 20000 });
    await page.evaluate(() => {
      const knoppen = Array.from(document.querySelectorAll('#uitgaveVlak button'));
      knoppen.find(b => /RTG-naam aanvragen/.test(b.textContent)).click();
    });
    await page.waitForFunction(() => /bij het kantoor/.test(document.querySelector('#uitgaveVlak').textContent),
      null, { timeout: 20000 });

    /* ---- de zaal: wat iedereen ziet staat op de codenaam ---- */
    await page.goto(base + '/apps/zaal.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#zaal .kaart h2', { timeout: 15000 });
    const kaartTekst = await page.evaluate(() => document.querySelector('#zaal .kaart').textContent);
    assert.ok(!/Rahul Travel Group/.test(kaartTekst),
      'zolang het kantoor niet beslist heeft, staat de RTG-naam er NIET onder: ' + kaartTekst.slice(0, 160));
    const credits = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#zaal .credit')).map(e => e.textContent));
    assert.equal(credits.length, 2, 'beide makers staan in de aftiteling: ' + credits.join(' / '));

    // luisteren: er komt geen bestand over de lijn, het toestel rekent het uit
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#zaal .knop')).find(b => b.textContent === 'Luister').click();
    });
    await page.waitForFunction(() => /Speelt/.test(document.querySelector('#melding').textContent),
      null, { timeout: 20000 });

    // "mooi" is een schouderklop, geen score: hij telt op en gaat er weer af
    const mooiKnop = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('#zaal .knop')).find(b => /^Mooi/.test(b.textContent)).textContent);
    assert.ok(/· 0$/.test(await mooiKnop()));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#zaal .knop')).find(b => /^Mooi/.test(b.textContent)).click();
    });
    await page.waitForFunction(() => /u ook/.test(document.querySelector('#zaal').textContent),
      null, { timeout: 20000 });

    // en er staat een bodem onder de lijst, geen oneindige scroll
    const bodem = await page.evaluate(() => document.querySelector('#zaal .bodem').textContent);
    assert.ok(bodem.length > 5, 'de zaal zegt waar hij ophoudt: ' + bodem);

    /* ---- het kantoor beslist, en pas DAN staat de RTG-naam eronder ---- */
    const kantoor = await api(base, '/api/office/login', { code: 'KANTOOR123' });
    const lijst = await api(base, '/api/office/muziek', {}, kantoor.token);
    assert.equal(lijst.aanvragen.length, 1, 'de aanvraag ligt bij het kantoor');
    await api(base, '/api/office/muziek/beslis', { id: lijst.aanvragen[0].id, ja: true }, kantoor.token);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#zaal .kaart h2', { timeout: 15000 });
    const naTekst = await page.evaluate(() => document.querySelector('#zaal .onder').textContent);
    assert.ok(/Rahul Travel Group/.test(naTekst), 'na het besluit van een mens staat de RTG-naam eronder: ' + naTekst);

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
