/* HET DERDE DOMEIN MET EEN VEEG DIE DE SERVER RAAKT, en het eerste waar de twee
   soorten actie NAAST elkaar liggen.

   Archiveren is omkeerbaar: `bewaar {archief:true}` legt de notitie in de la en
   `{archief:false}` haalt hem eruit. Weggooien is dat niet -- de kern gooit hem
   echt uit het bord en neemt een gekoppelde agenda-afspraak mee. Die tweede
   krijgt daarom geen terugdraai-knop maar een borg: vasthouden. Dat is geen
   strengheid maar de enige eerlijke uitkomst, en het is precies wat hier
   gemeten wordt -- want een borg die stiekem toch op een enkele druk afgaat, is
   erger dan geen borg.

   Zelfde regel als bij de kluis en de post: geen vaste wachttijden, er wordt
   gepold tot de server het zegt.

   Draai: node --test test/gebaar-notities.e2e.js  (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();
const BROWSER = process.env.RTG_CHROMIUM || undefined;

async function wachtTot(lees, klopt, wat, grens = 8000) {
  const eind = Date.now() + grens;
  let laatst;
  while (Date.now() < eind) {
    laatst = await lees();
    if (klopt(laatst)) return laatst;
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.fail(wat + ' -- na ' + grens + 'ms stond er: ' + JSON.stringify(laatst));
}

async function veegDoor(page, doos) {
  const y = doos.y + doos.height / 2;
  const x0 = doos.x + doos.width * 0.8;
  const px = -(doos.width * 0.62 + 90);
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 22; i++) await page.mouse.move(x0 + (px * i) / 22, y);
  await page.mouse.up();
}

test('een veeg archiveert een notitie en draait terug; weggooien gaat alleen op vasthouden',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gb-not-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bord ' + t, email: 'b' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'de proef heeft een ingelogd lid nodig');
    const api = (pad, body) => fetch(base + '/api/notities/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then((r) => r.json());
    for (const titel of ['Paklijst Kyoto', 'Voor vertrek']) {
      const r = await api('bewaar', { soort: 'notitie', titel, tekst: 'Adapter, paspoort, regenjas.' });
      assert.ok(!r.error, 'de proef heeft twee notities nodig: ' + r.error);
    }
    /* De stand volgens de SERVER: bestaat de notitie nog, en ligt hij in de la?
       Niet volgens het scherm -- dat is precies het verschil dat optimistisch
       bijwerken kan verbergen. */
    const staatVan = (titel) => api('mijn', {}).then((s) => {
      const n = (s.eigen || []).find((x) => x.titel === titel);
      return n ? { archief: !!n.archief, vast: !!n.vast } : null;
    });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'], executablePath: BROWSER });
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/notities.html', { waitUntil: 'load' });
    await page.waitForSelector('#bord .nkaart.gb-rij', { timeout: 20000 });
    assert.equal(await page.locator('#bord .nkaart').count(), 2, 'beide notities horen op het bord te staan');

    // 1. doorvegen legt de notitie ECHT in de la
    const rij = page.locator('#bord .nkaart').first();
    const titel = (await rij.locator('h3').textContent()).trim();
    await veegDoor(page, await rij.boundingBox());
    await wachtTot(() => staatVan(titel), (s) => s && s.archief,
      'doorvegen hoort ' + titel + ' bij de server te archiveren');
    assert.match(await page.locator('.gb-terug').textContent(), /^\s*Gearchiveerd/,
      'de melding hoort te beginnen met wat er gebeurd is');

    // 2. en de weg terug haalt hem er ook echt uit
    await page.locator('.gb-terug button').click();
    await wachtTot(() => staatVan(titel), (s) => s && !s.archief,
      'Terugdraaien hoort de notitie terug op het bord te zetten');

    // 3. de andere kant pint vast, en dat is ook echt omkeerbaar
    await page.waitForSelector('#bord .nkaart.gb-rij');
    const weer = page.locator('#bord .nkaart').first();
    const titel2 = (await weer.locator('h3').textContent()).trim();
    const d2 = await weer.boundingBox();
    /* NIET DOORVEGEN. Een kaart op het bord is smaller dan een regel in een
       lijst, dus de drempel ligt dichterbij: zestien stapjes van elf pixels
       kwamen erover en pinden de notitie ECHT vast. Daarna hertekent het bord,
       en de toetsaanslag hieronder landde op een kaart die net vervangen was --
       dan vindt de laag geen acties meer en gaat er geen actielade open. Deze
       proef wil de lade ZIEN, niet uitvoeren; dat gebeurt hieronder met de
       toets. */
    await page.mouse.move(d2.x + d2.width * 0.15, d2.y + d2.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(d2.x + d2.width * 0.15 + i * 11, d2.y + d2.height / 2);
    /* De EERSTE actie ligt vast -- dat is degene die een volle veeg uitvoert --
       en wat er verder in de lade past hangt van de breedte van de kaart af. Het
       bord is een raster, dus een kaart is smaller dan het venster en 'Overnemen'
       valt er hier uit. Daarom wordt hier niet op een vaste rij beweerd maar op
       de regel: de eerste klopt, alles wat er staat past HEEL, en wat er niet in
       past staat in de actielade. */
    const lade = await page.evaluate(() =>
      [...document.querySelectorAll('#bord .gb-lade .gb-doe > span')].map((s) => s.textContent));
    assert.equal(lade[0], 'Vastpinnen', 'naar rechts hoort vastpinnen vooraan te liggen');
    assert.ok(await page.evaluate(() => {
      const l = document.querySelector('#bord .gb-lade');
      const r = l.getBoundingClientRect();
      return [...l.querySelectorAll('.gb-doe')].every((e) => e.getBoundingClientRect().right <= r.right + 0.6);
    }), 'geen enkele actie mag over de rand van de lade steken');
    await page.mouse.up();
    await page.keyboard.press('Escape');

    /* 4. WEGGOOIEN GAAT ALLEEN OP VASTHOUDEN. Er is geen route die het terugdraait,
       dus de laag hoort er vanzelf een borg van te maken. Een enkele druk zet hem
       op scherp en doet verder niets; pas de tweede voert uit. */
    await page.waitForSelector('#bord .nkaart.gb-rij');
    await page.locator('#bord .nkaart').first().focus();
    await page.keyboard.press('ContextMenu');
    await page.waitForSelector('.gb-blad', { timeout: 5000 });
    const inBlad = await page.evaluate(() =>
      [...document.querySelectorAll('.gb-blad menu button > span')].map((s) => s.textContent));
    assert.ok(inBlad.some((x) => /Overnemen/.test(x)),
      'wat niet in de lade past, hoort wel in de actielade te staan: ' + JSON.stringify(inBlad));
    const knop = page.locator('.gb-blad menu button', { hasText: 'Weggooien' }).first();
    assert.match(await knop.textContent(), /houd vast/,
      'weggooien kan niet terug, dus hoort hij te zeggen dat je hem vasthoudt');
    await knop.press('Enter');
    await page.waitForTimeout(300);
    assert.ok(await knop.getAttribute('data-scherp') !== null, 'de eerste druk zet hem op scherp');
    assert.ok(await staatVan(titel2), 'de eerste druk mag de notitie nog niet hebben weggegooid');
    assert.equal((await staatVan(titel2)).vast, false,
      'de halve veeg hierboven mag de notitie NIET hebben vastgepind; dan meet die stap de lade en niet de uitvoering');
    await knop.press('Enter');
    await wachtTot(() => staatVan(titel2), (s) => s === null,
      'de tweede druk hoort de notitie echt weg te gooien');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het vegen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
