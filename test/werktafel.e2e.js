/* DE WERKTAFEL: wanneer hij er WEL mag staan, en wanneer niet.

   Deze toets bestaat om twee fouten die alleen op een breed venster bestonden,
   en die daarom niemand zag: de app wordt op een telefoon ontwikkeld en op een
   telefoon bekeken.

   1) DE ONDERTEKENING WERD OVERGESLAGEN. Een vers lid moet eerst de RTG-
      lidmaatschaps- en reisovereenkomst tekenen; die staat in #onbGate, modaal
      over de app. shared/command.js keek alleen of #app de klasse `active`
      droeg -- die zet de sessie, niet de intake -- en bouwde zijn werktafel er
      op z-index 210 overheen (#onbGate zit op 130). Zelfde account, zelfde
      token: bij 999px stond je voor de overeenkomst, bij 1001px erachter.

   2) HET BEGINSCHERM BESTOND HIER NIET. bouw() opende zichzelf twee vaste apps
      (Reizen & Veilig en Geld), dus wie op een computer inlogde heeft de klok
      met de werelden eromheen nooit gezien. WERELD.md par. 3: er zijn geen twee
      beginschermen -- op een computer waren het er nul.

   Wat deze toets NIET doet, is meten of de onboarding zelf klopt (daar zijn de
   aanmeldtoetsen voor). Hij meet alleen wie er bovenop mag liggen.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) {}
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
const pw = laadPlaywright();

async function opzet() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werktafel-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const r = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Werktafel Proef', email: 'werktafel' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  });
  const d = await r.json();
  assert.ok(d.token, 'registratie hoort een token te geven, kreeg: ' + JSON.stringify(d).slice(0, 200));
  return { srv, token: d.token, dataDir };
}

/* De stand van het scherm in EEN oogopslag. `bovenop` is de kern van geval 1:
   niet "staat de deur in de DOM" maar "wie raakt de muis in het midden van de
   deur" -- want de bug was juist dat de deur er wel stond en onbereikbaar was. */
const stand = () => {
  const g = document.getElementById('onbGate'), S = document.getElementById('shell');
  const r = g ? g.getBoundingClientRect() : null;
  const midden = r && r.width ? document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)) : null;
  return {
    werktafel: !!document.getElementById('rtgCommand'),
    bladen: document.querySelectorAll('.cmd-pane').length,
    poortOpen: g ? !g.hidden : null,
    poortBovenop: !!(midden && g && g.contains(midden)),
    appActief: !!(document.getElementById('app') || {}).classList?.contains('active'),
    shellZichtbaar: !!(S && getComputedStyle(S).display !== 'none' && S.getBoundingClientRect().width > 0),
    klok: document.querySelectorAll('.os-app').length,
    commandActief: !!(window.RTGCommand && window.RTGCommand.actief()),
    // de lade: `inBeeld` is de echte vraag, want dicht staat hij onder de rand
    // en niet op display:none -- hij schuift, dus meten we waar hij staat
    lade: (() => {
      const bank = document.querySelector('.cmd-bank'); if (!bank) return null;
      const r = bank.getBoundingClientRect();
      return { inBeeld: r.top < window.innerHeight - 40, werelden: document.querySelectorAll('.cmd-nav button[data-url]').length };
    })(),
    greep: !!document.querySelector('.cmd-lade'),
  };
};

test('werktafel: niet over de ondertekening heen, en het beginscherm blijft het beginscherm',
  { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    await page.addInitScript(t => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, token);
    await page.goto(srv.base + '/apps/app.html', { waitUntil: 'load', timeout: 45000 });

    // 1) de intake staat open en hoort BOVENOP te liggen, ook op 1440px
    await page.waitForFunction(() => {
      const g = document.getElementById('onbGate');
      return g && !g.hidden && g.getBoundingClientRect().width > 0;
    }, { timeout: 20000 });
    /* PROBEER ER LANGS TE KOMEN. Zonder deze poging kan de bewering hieronder
       niet zakken: er bouwt uit zichzelf toch niets meer, dus "geen werktafel"
       zou ook groen zijn met de grendel eruit (LAT.md regel 9). Dit is de weg
       die het gat had: een app openen terwijl de overeenkomst nog openstaat. */
    await page.evaluate(() => { try { window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'); } catch (e) {} });
    await page.waitForTimeout(400);
    const dicht = await page.evaluate(stand);
    // op het PAD toetsen: de app draagt een querystring (?pas=rtg) en die hoort er te mogen zijn
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'openen mag ook geen paginasprong worden: /apps/vandaag.html draagt de deur niet, dus dat is de deur omzeilen');
    /* Zonder deze bewering kan de rest niet zakken: is #app niet `active`, dan
       weigert de werktafel sowieso en bewijst "geen werktafel" niets. Precies de
       vorm uit LAT.md regel 9. */
    assert.equal(dicht.appActief, true, 'voorwaarde: de sessie staat, anders toetst de rest hieronder niets');
    assert.equal(dicht.poortOpen, true, 'een vers lid hoort de overeenkomst nog te moeten tekenen');
    assert.equal(dicht.werktafel, false, 'de werktafel mag niet bestaan zolang er niet getekend is');
    assert.equal(dicht.poortBovenop, true, 'de overeenkomst hoort aanklikbaar te zijn en niet overdekt');
    assert.equal(dicht.commandActief, false, 'en een app hoort hier niet als blad te openen');

    // 2) getekend: dan is er een BEGINSCHERM, en nog steeds geen werktafel
    await page.evaluate(() => { document.getElementById('onbGate').hidden = true; });
    await page.waitForTimeout(300);
    const thuis = await page.evaluate(stand);
    assert.equal(thuis.werktafel, false, 'na het tekenen hoort de klok te volgen, niet meteen een werktafel');
    assert.equal(thuis.shellZichtbaar, true, 'het beginscherm hoort op een computer gewoon te staan');
    assert.ok(thuis.klok >= 4, 'met de werelden eromheen, maar er stonden er ' + thuis.klok);
    assert.equal(thuis.commandActief, true, 'en NU opent een app wel als blad');

    // 3) een app openen maakt de werktafel; die neemt het scherm over
    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    const werk = await page.evaluate(stand);
    assert.equal(werk.bladen, 1, 'een geopende app is een blad, en alleen die ene');
    assert.equal(werk.shellZichtbaar, false, 'een werktafel is volledig scherm; de home gaat eronder weg');

    // 4) het laatste blad sluiten brengt je terug thuis, niet in een leeg vlak
    await page.evaluate(() => window.RTGCommand.sluitAlles());
    await page.waitForFunction(() => !document.getElementById('rtgCommand'), { timeout: 10000 });
    const terug = await page.evaluate(stand);
    assert.equal(terug.shellZichtbaar, true, 'na het sluiten van het laatste blad hoort het beginscherm terug te zijn');
    assert.ok(terug.klok >= 4, 'met de werelden er weer omheen, maar er stonden er ' + terug.klok);

    /* 5) EN ANDERSOM. checkOnboarding is asynchroon: de deur kan opengaan NADAT
       de werktafel er al staat. Dan is wegnemen de enige juiste uitkomst -- een
       weigering bij het bouwen alleen zou dit gat open laten. */
    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    await page.evaluate(() => { document.getElementById('onbGate').hidden = false; });
    await page.waitForTimeout(400);
    const opnieuw = await page.evaluate(stand);
    assert.equal(opnieuw.werktafel, false, 'gaat de intake alsnog open, dan hoort de werktafel te wijken');
    assert.equal(opnieuw.poortBovenop, true, 'en ligt de overeenkomst weer bovenop');

    /* 6) EN OP EEN TELEFOON, waar deze werktafel niet bestaat.

       Deze stap staat er omdat een mutatie AFSLOEG: de grendel uit open()
       halen veranderde op 1440px niets, want bouw() weigert daar zelf al via
       mag(). Alleen: onder 1000px komt open() nooit bij bouw() -- daar doet hij
       location.href, en dan is een openstaande intake met een paginasprong te
       passeren. Dat is precies de smalle stand, en dus hoort hij hier gemeten
       te worden en niet alleen op een breed venster. */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const smal = await page.evaluate(stand);
    assert.equal(smal.poortOpen, true, 'voorwaarde: de intake staat nog open, anders toetst het hieronder niets');
    assert.equal(smal.werktafel, false, 'op een telefoon bestaat deze werktafel sowieso niet');
    await page.evaluate(() => { try { window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'); } catch (e) {} });
    await page.waitForTimeout(400);
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'ook op een telefoon mag een openstaande overeenkomst niet met een paginasprong te passeren zijn');

    /* 7) DEZELFDE WERKTAFEL OP EEN TELEFOON, in zijn eigen vorm.

       De bank is hier geen rail maar een lade, en er staat een blad tegelijk in
       beeld. Wat NIET verandert: het beginscherm blijft de klok, een app wordt
       een blad in plaats van een paginasprong, en het laatste blad sluiten
       brengt je thuis. */
    await page.evaluate(() => { document.getElementById('onbGate').hidden = true; });
    await page.waitForTimeout(300);
    const smalThuis = await page.evaluate(stand);
    assert.equal(smalThuis.werktafel, false, 'ook op een telefoon is de klok het beginscherm, niet de werktafel');
    assert.equal(smalThuis.shellZichtbaar, true, 'en die staat er gewoon');

    await page.evaluate(() => window.RTGCommand.open('/apps/vandaag.html', 'Vandaag'));
    await page.waitForSelector('#rtgCommand .cmd-pane', { timeout: 10000 });
    const smalBlad = await page.evaluate(stand);
    assert.equal(new URL(page.url()).pathname, '/apps/app.html',
      'een app hoort op een telefoon nu een BLAD te zijn en geen paginasprong meer');
    assert.equal(smalBlad.bladen, 1, 'en er staat er een');
    assert.equal(smalBlad.greep, true, 'met een greep voor de lade, want de bank is hier geen vaste rail');
    assert.equal(smalBlad.lade.inBeeld, false, 'die lade ligt dicht tot je hem haalt');

    // de lade halen: dezelfde twaalf werelden als in de rail op een computer
    await page.click('.cmd-lade');
    await page.waitForTimeout(450);
    const laOpen = await page.evaluate(stand);
    assert.equal(laOpen.lade.inBeeld, true, 'de greep hoort de lade te openen');
    assert.equal(laOpen.lade.werelden, 12, 'met alle werelden erin, net als de rail; er stonden er ' + laOpen.lade.werelden);
    assert.equal(await page.getAttribute('.cmd-lade', 'aria-expanded'), 'true', 'en dat hoort een schermlezer ook te horen');

    /* Escape sluit hem. Zonder dit is de greep de enige uitweg, en dat is het
       soort scherm waar je op een telefoon in vast komt te zitten. */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    const laDicht = await page.evaluate(stand);
    assert.equal(laDicht.lade.inBeeld, false, 'Escape hoort de lade te sluiten');
    assert.equal(await page.getAttribute('.cmd-lade', 'aria-expanded'), 'false', 'en de stand hoort mee te gaan');

    // en ook hier: het laatste blad dicht = thuis
    await page.evaluate(() => window.RTGCommand.sluitAlles());
    await page.waitForFunction(() => !document.getElementById('rtgCommand'), { timeout: 10000 });
    const smalTerug = await page.evaluate(stand);
    assert.equal(smalTerug.shellZichtbaar, true, 'het laatste blad sluiten hoort ook op een telefoon thuis te brengen');

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);   // stop() wil het KINDPROCES; srv meegeven doet stil niets
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
