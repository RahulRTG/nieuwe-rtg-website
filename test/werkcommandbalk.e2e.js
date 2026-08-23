/* DE COMMANDOBALK VAN HET WERK OS -- zoekt hij echt, en volgt hij de rechten?

   Hier stond een balk die op een woordmatch een tab opende en daarna zei:
   "Rechten en handelingen volgen uw rol." Het eerste klopte, het tweede was
   tekst zonder dekking -- er werd nergens een recht gelezen.

   Drie beweringen die deze toets vastlegt, en de tweede is de belangrijkste:

   1. De balk zoekt echt: hij vindt werk dat in de werkruimte staat.
   2. HET REGISTER VOLGT DE ROLLEN. Twee mensen in dezelfde werkruimte, met een
      andere rol, krijgen een ander antwoord op dezelfde vraag -- en dat komt
      niet doordat er iets wordt weggefilterd, maar doordat de soort waar je
      het recht voor mist niet in je register zit.
   3. Hij zegt WAAR hij heeft gezocht, in plaats van te doen alsof hij alles zag.
   4. EEN RECHTENWEIGERING LOGT NIEMAND UIT. Dat vond deze toets onderweg: wie
      het recht `cijfer` mist werd bij het laden uitgelogd, omdat de schermlaag
      elke 403 las als "uw sleutel deugt niet".

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');

const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmdbalk-'));

test('de commandobalk zoekt in het register van de rol, en zegt waar hij keek',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const base = srv.base;
  let browser;
  try {
    const api = (pad, body) => fetch(base + '/api/bedrijf' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());

    const w = await api('/werkruimte/maak', { naam: 'Zoekbedrijf' });
    const S = { werkruimte: w.werkruimte, beheerToken: w.beheerToken };

    /* Twee mensen, twee rollen. De projectleider mag projecten en kennis; HR
       mag mensen en kennis, en dus GEEN projecten. Dat verschil is de toets. */
    const pl = await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Pia' });
    await api('/lid/besluit', { ...S, lidId: pl.lidId, akkoord: true });
    await api('/lid/rollen', { ...S, lidId: pl.lidId, rollen: ['projectleider'] });

    const hr = await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Hakim' });
    assert.ok(hr.lidToken, 'Hakim heeft een sleutel: ' + JSON.stringify(hr).slice(0, 120));
    const toe = await api('/lid/besluit', { ...S, lidId: hr.lidId, akkoord: true });
    assert.equal(toe.ok, true, 'Hakim is toegelaten: ' + JSON.stringify(toe).slice(0, 160));
    const rol = await api('/lid/rollen', { ...S, lidId: hr.lidId, rollen: ['hr'] });
    assert.equal(rol.ok, true, 'Hakim heeft de rol hr: ' + JSON.stringify(rol).slice(0, 160));

    await api('/project/maak', { werkruimte: w.werkruimte, lidToken: pl.lidToken,
      naam: 'Zonnepanelen Zaandam', werkvorm: 'stadsuitrol' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const vraag = async (token, tekst) => {
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      await page.fill('#iWerkruimte', w.werkruimte);
      await page.fill('#iToken', token);
      await page.click('#inlogGa');
      await page.waitForTimeout(900);
      /* De balk staat dicht tot je hem opent -- ai-toggle.js zet hem op hidden
         en de tab "Rahul" vouwt hem uit. Dat is het echte pad van een
         gebruiker; hem met de hand zichtbaar maken zou een scherm toetsen dat
         niemand zo te zien krijgt. */
      await page.click('#wkRahulTab');
      await page.waitForTimeout(400);
      await page.fill('#wkRahulInput', tekst);
      await page.click('#wkRahulSend');
      await page.waitForTimeout(900);
      return page.evaluate(() => ({
        tekst: document.getElementById('wkRahulContext').innerText.replace(/\s+/g, ' '),
        ingelogd: document.getElementById('inhoud').hidden === false,
        sessie: localStorage.getItem('rtg_werk_sessie')
      }));
    };

    /* 1 + 3: de projectleider vindt zijn project, en hoort waar er is gezocht. */
    const plUit = await vraag(pl.lidToken, 'zonnepanelen');
    const alsPl = plUit.tekst;
    assert.match(alsPl, /Zonnepanelen Zaandam/, 'de balk vindt echt werk: ' + alsPl);
    assert.match(alsPl, /soort\(en\) waar u recht op heeft/, 'en zegt waar hij keek: ' + alsPl);
    assert.ok(!/Rechten en handelingen volgen uw rol/.test(alsPl),
      'de oude tekst zonder dekking is weg');

    /* 2: dezelfde vraag, andere rol, ander antwoord. HR heeft geen recht op
       projecten, dus dat project zit niet in zijn register -- het wordt niet
       verborgen, het is er niet. */
    const hrUit = await vraag(hr.lidToken, 'zonnepanelen');
    const alsHr = hrUit.tekst;
    /* DEZE ASSERTIE VOND EEN ECHTE FOUT, en daarom staat hij er.

       Wie het recht `cijfer` mist, werd bij het LADEN uitgelogd: het
       startscherm haalt het directiebeeld op, dat vraagt `cijfer`, en de
       schermlaag behandelde ELKE 403 als "uw sleutel deugt niet". Hakim heeft
       de rol hr en dus geen `cijfer` -- zijn sleutel was prima, het scherm zei
       alleen iets anders. Nu blijft hij ingelogd en krijgt hij per module te
       horen wat hij mist. */
    assert.equal(hrUit.ingelogd, true,
      'een rechtenweigering logt niemand uit; sessie=' + hrUit.sessie);
    assert.ok(hrUit.sessie, 'en de sleutel blijft staan');
    assert.ok(!/Zonnepanelen Zaandam/.test(alsHr),
      'HR heeft geen recht op projecten en vindt het dus niet: ' + alsHr);
    assert.match(alsHr, /soort\(en\)/, 'maar krijgt wel te horen waar er is gezocht: ' + alsHr);

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
