/* RTG SCAN AAN DE GEZINSKANT (public/apps/foundation/vrienden.html) -- LINK.md stap 4.

   WAAROM DEZE TOETS BESTAAT. In LINK.md stond bij stap 4 zwart op wit wat er
   NIET was nagelopen: "dat vrienden.html het bedoelingsscherm ook echt toont, is
   hier niet met een browser bevestigd -- de proefopstelling kreeg de gezinssessie
   in deze omgeving niet aan de praat." De server, de poorten en de
   intentie-dekking waren getoetst; het scherm niet. Dit is dat gat.

   De gezinssessie is geen Bearer-token maar een gezinscode met een profieltoken,
   bewaard in localStorage onder `rtf_sessie` (public/apps/foundation/sessie.js).
   Meer heeft de pagina niet nodig: `Sessie.ophalen()` haalt het profiel er zelf
   bij op. Dat is dezelfde weg die een mens loopt als hij zijn gezin kiest.

   ER WORDT HIER NIETS AFGEPLAKT. De leerlingdeur (/api/rtf/toegang) staat gewoon
   open voor een beheerder, dus die draait echt mee. Wie hem hier zou afvangen,
   toetst een scherm dat in het echt achter een dichte deur kan staan.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

async function api(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function nieuwLid(base, naam) {
  const reg = (await api(base, '/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' })).body;
  const st = (await api(base, '/api/state', {}, reg.token)).body;
  return { token: reg.token, codenaam: st.state.user.codename };
}

/* Een gezin dat op zijn eigen vriendenscherm staat, ingelogd zoals de app dat
   zelf doet. De beheerder is bewust geen kindprofiel: een kind van 15 of jonger
   komt bij deze deur helemaal niet langs, en dat is elders getoetst
   (test/linkgezin.test.js). */
async function metGezin(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkgezin-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const g = (await api(base, '/api/foundation/gezin/maak',
      { gezinsnaam: 'Scanhuis', naam: 'Ouder Scanhuis', pin: '1234' })).body;
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((s) => {
      try { localStorage.setItem('rtf_sessie', s); localStorage.setItem('rtg_lang', 'nl'); } catch (e) {}
    }, JSON.stringify({ code: g.code, token: g.token }));
    const pg = await ctx.newPage();
    /* Dit scherm praat met alert(). Zonder afhandelaar blokkeert Playwright de
       dialoog en staat de pagina stil; de tekst wordt opgevangen zodat een toets
       hem kan lezen. */
    const gezegd = [];
    pg.on('dialog', (d) => { gezegd.push(d.message()); d.accept().catch(() => {}); });
    await pg.goto(base + '/apps/foundation/vrienden.html', { waitUntil: 'domcontentloaded' });
    /* Dit scherm is lang en wordt door shared/deelmenu.js in tabbladen geknipt
       (elke .deel-kop wordt een knop, de rest krijgt .rtgdeel-weg). "Toevoegen"
       is dus niet zichtbaar tot een mens erop drukt -- en dat doet deze toets
       ook, want een toets die de tabbalk overslaat meet een scherm dat niemand
       zo ziet. */
    await pg.waitForSelector('.rtgdeel-balk button', { timeout: 15000 });
    await pg.getByRole('button', { name: 'Toevoegen', exact: true }).click();
    await pg.waitForSelector('#pinIn', { state: 'visible', timeout: 15000 });
    await fn({ pg, base, g, gezegd });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

/* De scanoverlay openen en met de hand een code invoeren -- dezelfde weg als in
   test/linkscan.e2e.js aan de ledenkant, en hetzelfde onderdeel
   (shared/scanknop.js). Dat is de weg die een mens neemt als zijn camera het
   niet doet, en het is de enige weg naar de laag die in een toets te lopen is:
   een echte camera is er hier niet. */
async function typ(pg, tekst) {
  await pg.click('#pinScanBtn');
  await pg.waitForSelector('.rtg-scan-ov', { timeout: 5000 });
  await pg.click('.rtg-scan-ov [data-hand]');
  await pg.fill('.rtg-scan-hand input', tekst);
  await pg.click('.rtg-scan-hand button[type=submit]');
}

test('een gezinslid plakt een RTG-code en krijgt eerst de kaart, dan pas het verzoek',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  await metGezin(async ({ pg, base, gezegd }) => {
    const lid = await nieuwLid(base, 'Kaart Lid');
    const pin = (await api(base, '/api/member/pin', {}, lid.token)).body.toon;

    await typ(pg, 'rtg:pin:' + pin);
    await pg.waitForSelector('.rtg-bedoeling', { timeout: 8000 });

    const kaart = await pg.evaluate(() => {
      const el = document.querySelector('.rtg-bedoeling .blad');
      return { tekst: el.innerText, knop: (el.querySelector('button.doen') || {}).textContent };
    });
    /* Hoofdletterongevoelig: .rtg-bedoeling .van zet de codenaam in kapitalen
       (ONTWERP.md), en innerText geeft terug wat er STAAT. */
    assert.match(kaart.tekst, new RegExp(lid.codenaam.split(' ')[0], 'i'), 'van wie de code is');
    assert.ok(!kaart.tekst.includes('Kaart Lid'), 'de echte naam blijft in de kluis');
    assert.ok(kaart.knop, 'een gezinslid mag verbinden, dus er hoort een knop te staan');

    // kijken is geen daad
    assert.equal(((await api(base, '/api/member/connections', {}, lid.token)).body.requests || []).length, 0,
      'de kaart lezen stuurt nog niets');

    await pg.click('.rtg-bedoeling button.doen');
    await pg.waitForTimeout(1200);
    assert.equal(((await api(base, '/api/member/connections', {}, lid.token)).body.requests || []).length, 1,
      'na de druk staat het verzoek er');
    assert.ok(gezegd.some(m => /verstuurd/i.test(m)), 'en het scherm zegt dat ook');

    /* En de rail eronder: lnk() hangt de gezinscode en het profieltoken aan elk
       verzoek, dus een pad buiten /api/rtf/ zou die geloofsbrief aan een vreemde
       deur aanbieden. Het voorvoegsel gaf dat gratis; sinds het pad voluit wordt
       meegegeven, staat het er expliciet.

       ER WORDT GETELD OF HET VERZOEK ÜBERHAUPT UITGING, en niet of het misging.
       Dat laatste stond hier eerst, en het was een kop-of-munt: /api/member/pin
       weigert een gezinssessie toch al met 401, dus `lnk` wierp met en zonder
       rail. Een toets die niet kan zakken, is geen toets (LAT.md regel 9) -- en
       het gaat hier juist om wat er de deur uit gaat. */
    const uitgegaan = [];
    const tel = (r) => { if (r.url().includes('/api/member/pin')) uitgegaan.push(r.url()); };
    pg.on('request', tel);
    await pg.evaluate(() => lnk('/api/member/pin', {}).catch(() => {}));
    await pg.waitForTimeout(600);
    pg.off('request', tel);
    assert.deepEqual(uitgegaan, [], 'de gezinssleutel gaat niet naar een deur van een andere wereld');
  });
});

test('een vraagcode toont de kaart en GEEN knop: een gezinsprofiel heeft geen portemonnee',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  await metGezin(async ({ pg, base }) => {
    const lid = await nieuwLid(base, 'Vraag Lid');
    const cap = (await api(base, '/api/link/cap/maak',
      { handeling: 'geld.ontvangen', centen: 1500, oms: 'lunch' }, lid.token)).body;

    await typ(pg, cap.token);
    await pg.waitForSelector('.rtg-bedoeling', { timeout: 8000 });

    const kaart = await pg.evaluate(() => {
      const el = document.querySelector('.rtg-bedoeling .blad');
      return { tekst: el.innerText, knoppen: el.querySelectorAll('button.doen').length };
    });
    assert.match(kaart.tekst, /15,00/, 'wat er gevraagd wordt staat er wel');
    assert.equal(kaart.knoppen, 0, 'maar een knop die daarna weigert hoort er niet te staan');
  });
});
