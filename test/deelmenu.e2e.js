/* Scherm-test voor het deelmenu (shared/deelmenu.js): een app met veel
   delen wordt een menu met een deel tegelijk, in plaats van een lange rol.

   Het contract, op de eerste pagina die meedoet (rtgschool.html):
   1. de menubalk staat er, met de delen van de pagina als knoppen;
   2. er is EEN deel zichtbaar en de rest is echt weg (niet alleen kleiner);
   3. een klik op een knop wisselt het beeld en zet de hash;
   4. een deep-link (#deel-...) opent dat deel direct;
   5. dit alles zonder paginafouten.
   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('deelmenu: een deel tegelijk, wisselen werkt, deep-link werkt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Menulid', email: 'dm' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtgschool.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/rtgschool.html', { waitUntil: 'domcontentloaded' });

    /* 1. de balk met de delen van deze pagina */
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });
    const knoppen = await page.$$eval('.rtgdeel-balk button', bs => bs.map(b => b.textContent));
    assert.ok(knoppen.length >= 3, 'minstens drie delen in het menu, kreeg: ' + knoppen.join(', '));

    /* 2+3. het eerste deel toont, de rest is weg; wisselen draait dat om */
    await page.evaluate(() => RTGDeel.open('het-paspoort'));
    const voor = await page.evaluate(() => ({
      paspoort: !!document.getElementById('paspoort').offsetParent,
      examen: !!document.getElementById('examenKies').offsetParent
    }));
    assert.equal(voor.paspoort, true, 'het paspoort-deel is zichtbaar');
    assert.equal(voor.examen, false, 'het toetsing-deel is dan echt weg');
    await page.click('.rtgdeel-balk button:nth-child(3)');
    const na = await page.evaluate(() => ({
      paspoort: !!document.getElementById('paspoort').offsetParent,
      examen: !!document.getElementById('examenKies').offsetParent,
      hash: location.hash
    }));
    assert.equal(na.paspoort, false, 'na de wissel is het paspoort weg');
    assert.equal(na.examen, true, 'en staat toetsing in beeld');
    assert.equal(na.hash, '#deel-toetsing-en-advies', 'de hash draagt het deel');

    /* 4. deep-link: de hash opent het deel direct */
    await page.goto(base + '/apps/rtgschool.html#deel-bijles', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });
    const diep = await page.evaluate(() => ({
      bijles: !!document.getElementById('bijlesLog').offsetParent,
      paspoort: !!document.getElementById('paspoort').offsetParent
    }));
    assert.equal(diep.bijles, true, 'de deep-link opent het bijles-deel');
    assert.equal(diep.paspoort, false, 'en de rest blijft weg');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De tweede vorm, en de reden dat de eerste uitrol de helft van de apps
   moest overslaan: een app die zijn scherm pas NA een fetch neerzet, diep
   in main (main > wrap > vPay), met de kopjes als BROER van de kaarten
   (<h3 class="sec">) in plaats van erin. Op pay.html komt dat alle drie
   samen. Zonder de wacht (subtree), de laag-afdaling en de losse-kop-regel
   blijft het menu daar leeg -- alle drie zijn hier met een mutatie
   nagetrokken. */
test('deelmenu: ook een app die zijn scherm pas na een fetch bouwt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Paylid', email: 'pm' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });

    // het menu verschijnt vanzelf zodra de app zijn schermen heeft gezet
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 12000 });
    const knoppen = await page.$$eval('.rtgdeel-balk button', bs => bs.map(b => b.textContent));
    assert.ok(knoppen.length >= 3, 'het menu vindt de delen: ' + knoppen.join(', '));
    const actief = await page.$$eval('.rtgdeel-balk button[aria-current="true"]', bs => bs.length);
    assert.equal(actief, 1, 'precies een deel actief');

    // en wisselen doet echt iets: het tweede deel komt op, het eerste gaat weg
    const eerste = await page.$$eval('.rtgdeel-balk button', bs => bs[0].textContent);
    await page.click('.rtgdeel-balk button:nth-child(2)');
    const na = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.rtgdeel-balk button')];
      return { tweedeAan: b[1].getAttribute('aria-current') === 'true',
        eersteUit: b[0].getAttribute('aria-current') !== 'true' };
    });
    assert.ok(na.tweedeAan && na.eersteUit, 'wisselen werkt (van "' + eerste + '" af)');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
