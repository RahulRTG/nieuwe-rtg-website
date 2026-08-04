/* ============================================================================
   DRIE SCHERMEN DIE OVER IDENTITEIT EN RUST GAAN.

   Uit de 104 schermen waar geen enkele toets de weg aflegt (TAKEN 4.9) zijn dit
   er drie waar het duurste misverstand mogelijk is: ze gaan over wie u bent en
   over hoe dit huis met u omgaat. Bij alle drie is de kern iets dat het scherm
   NIET moet doen -- en dat is precies wat een veegtoets nooit ziet.

   RTG iD en PASSKEYS gaan over identiteit. Ze mogen zonder inlog uitleggen wat
   ze zijn (dat hoort ook, anders begrijpt niemand waar hij aan begint), maar ze
   mogen geen persoonlijke gegevens tonen. Een identiteitsscherm dat aan een
   willekeurige bezoeker laat zien welke diensten toegang hebben, is erger dan
   een scherm dat niets doet.

   Bovendien doen ze allebei een harde belofte in hun eigen tekst: bij een
   passkey "verlaat de geheime helft uw apparaat nooit", en RTG iD "deelt nooit
   meer gegevens dan gevraagd". Zulke zinnen horen te blijven staan -- ze zijn
   met een tekstopschoning zo weg, en dan belooft het scherm iets anders dan het
   product doet.

   BALANS is het derde, en het bijzonderste. Dat scherm draagt letterlijk de
   merkregel uit CLAUDE.md ("geen verslavende engagement-patronen") als tekst
   op het scherm: "Geen streaks, geen scores om te halen, geen schuldgevoel; dit
   scherm mag u ook gewoon negeren." Een welzijnsscherm is precies de plek waar
   een streakteller zich later ongemerkt naar binnen werkt -- hij voelt als een
   verbetering. Deze toets legt vast dat de belofte er staat EN dat er geen
   reeks- of scoreteller op het scherm is verschenen.

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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idscherm-'));

async function toon(page, base, scherm, token) {
  await page.goto(base + '/apps/' + scherm + '.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
  }, token || null);
  await page.goto(base + '/apps/' + scherm + '.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

test('RTG iD en passkeys: uitleg voor iedereen, gegevens voor niemand zonder inlog',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- RTG iD, zonder inlog. ---- */
    const id = await toon(page, base, 'rtgid', null);
    assert.ok(id.length > 80, 'het scherm legt uit wat RTG iD is, in plaats van leeg te blijven');
    assert.match(id, /nooit meer gegevens dan gevraagd/i,
      'en het belooft dataminimalisatie in zijn eigen woorden: ' + id.slice(0, 200));
    assert.match(id, /inloggen/i, 'met een weg naar binnen');

    /* De kern: geen gegevens van iemand. Een scherm dat "actieve toegang" als
       KOPJE toont is prima -- als er maar geen rijen onder staan. Daarom kijken
       we naar de dingen die alleen bij een ingelogd iemand kunnen bestaan: een
       codenaam, een lidnummer of een e-mailadres. */
    assert.ok(!/RTG · \d{4} · \d+/.test(id), 'er staat geen lidnummer op: ' + id.slice(0, 200));
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(id), 'en geen e-mailadres: ' + id.slice(0, 200));

    /* ---- PASSKEYS, zonder inlog. ---- */
    const pk = await toon(page, base, 'passkeys', null);
    assert.ok(pk.length > 80, 'ook passkeys legt zichzelf uit');
    assert.match(pk, /geheime helft verlaat/i,
      'en houdt de belofte overeind dat de geheime sleutel het apparaat niet verlaat: ' + pk.slice(0, 220));
    assert.match(pk, /publieke helft/i, 'met de uitleg dat RTG alleen de publieke helft bewaart');
    assert.ok(!/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(pk), 'en er staat geen e-mailadres van iemand op');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('Balans: het welzijnsscherm belooft geen streaks, en heeft ze ook niet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const tekst = await toon(page, base, 'balans', null);
    assert.ok(tekst.length > 80, 'het scherm zegt iets');

    /* ---- DE BELOFTE STAAT ER. Dit is geen opmaakcontrole: het is de merkregel
       uit CLAUDE.md, op het scherm waar hij het hardst nodig is. ---- */
    assert.match(tekst, /geen streaks/i, 'het belooft geen streaks: ' + tekst.slice(0, 240));
    assert.match(tekst, /geen scores/i, 'en geen scores om te halen');
    assert.match(tekst, /schuldgevoel/i, 'en geen schuldgevoel');
    assert.match(tekst, /mag u ook gewoon negeren/i,
      'en zegt met zoveel woorden dat u dit scherm mag negeren -- dat is de hele houding');

    /* ---- EN HIJ WORDT OOK WAARGEMAAKT. Een scherm dat "geen streaks" belooft
       en er een toont, is erger dan een scherm dat er gewoon een toont: het
       eerste liegt erbij. Een streakteller werkt zich hier ongemerkt naar
       binnen omdat hij als een verbetering voelt, dus deze kant hoort vast te
       liggen naast de belofte. ---- */
    const verdacht = tekst.match(/\b(\d+)\s*(dagen op rij|dagen achter elkaar|op rij)\b/i);
    assert.equal(verdacht, null, 'er staat geen reeksteller op het scherm: ' + (verdacht && verdacht[0]));
    assert.ok(!/\bstreak\b/i.test(tekst.replace(/geen streaks/gi, '')),
      'en het woord streak komt alleen voor in de belofte dat ze er niet zijn');
    assert.ok(!/\b\d+\s*punten\b/i.test(tekst), 'en er worden geen punten geteld: ' + tekst.slice(0, 200));

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
