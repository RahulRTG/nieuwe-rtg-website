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
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpZichtbaar, wachtOpVerandering, tekstVan, klikEnWacht } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmdbalk-'));

test('de commandobalk zoekt in het register van de rol, en zegt waar hij keek',
  { skip: geenBrowser(pw) }, async () => {
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

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const vraag = async (token, tekst) => {
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
      await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
      /* De inlogkaart STAAT in de HTML, dus dat hij er is zegt niets. Wie te
         vroeg klikt, klikt op een knop waar app.js zijn handler nog niet aan
         heeft gehangen, en dan gebeurt er simpelweg niets. ai-toggle.js draait
         NA app.js en zet de Rahul-balk op hidden -- die dichte balk is dus het
         teken dat de pagescripts geweest zijn en de inlogknop echt werkt. */
      await wachtTot(page, () => {
        const balk = document.querySelector('.wk-rahul');
        const ga = document.getElementById('inlogGa');
        return !!balk && balk.hidden && !!ga && ga.offsetParent !== null;
      }, null, { wat: 'een opgestarte pagina met een bruikbare inlogkaart (Rahul-balk dicht)' });
      await page.fill('#iWerkruimte', w.werkruimte);
      await page.fill('#iToken', token);
      await page.click('#inlogGa');
      /* Inloggen is pas gelukt als de poort #inhoud opent, en dat doet kern.js
         PAS in het antwoord op /mijn-rechten. Deze ene wacht dekt dus zowel de
         server als het scherm; blijft de kaart staan, dan is de inlog geweigerd
         en zegt de wacht dat met de tekst die er wel stond. */
      await wachtOpZichtbaar(page, '#inhoud');
      /* De balk staat dicht tot je hem opent -- ai-toggle.js zet hem op hidden
         en de tab "Rahul" vouwt hem uit. Dat is het echte pad van een
         gebruiker; hem met de hand zichtbaar maken zou een scherm toetsen dat
         niemand zo te zien krijgt. */
      await page.click('#wkRahulTab');
      // open is niet hetzelfde als bruikbaar: de balk krijgt de klasse `page`
      // en pas daarmee is het invoerveld zichtbaar (.wk-main>.wk-rahul staat
      // op display:none). Vullen voor dat moment vult een onzichtbaar veld.
      await wachtOpZichtbaar(page, '#wkRahulInput');
      await page.fill('#wkRahulInput', tekst);
      /* Wat er VOOR de vraag stond, want daar wachten we straks vanaf. Op "de
         tekst is veranderd" alleen wachten zou te vroeg zijn: command.js zet
         binnen een tel 'Even kijken...' neer en bij een zoekopdracht daarna nog
         'Zoeken...'. Het antwoord is pas binnen als geen van die twee
         tussenstanden er meer staat. */
      const voorVraag = await tekstVan(page, '#wkRahulContext');
      await page.click('#wkRahulSend');
      await wachtTot(page, ([s, o]) => {
        const el = document.querySelector(s);
        if (!el) return false;
        const t = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        return !!t && t !== o && !/^(Even kijken|Zoeken)/.test(t);
      }, ['#wkRahulContext', voorVraag],
      { wat: 'een afgerond antwoord van Rahul in #wkRahulContext' });
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

    /* ---- de handelkant: klaarzetten, en pas op de knop uitvoeren ---- */
    const alsPlan = (await vraag(pl.lidToken, 'maak een taak Dakgoot vervangen')).tekst;
    assert.match(alsPlan, /Dakgoot vervangen/, 'de balk stelt een handeling voor: ' + alsPlan);
    assert.match(alsPlan, /Er is nog niets gebeurd/, 'en zegt dat er nog niets is gebeurd');

    /* De taak bestaat pas NA de knop. Dat is het hele verschil tussen
       klaarzetten en doen, en het is van buiten niet te zien aan de tekst. */
    const voorKnop = await api('/taken', { werkruimte: w.werkruimte, lidToken: pl.lidToken });
    assert.ok(!JSON.stringify(voorKnop).includes('Dakgoot'), 'nog geen taak');

    /* Uitvoeren is een verzoek en daarna een hertekening, en dat zijn twee
       momenten. Eerst het antwoord van /handeling/doe, dan het moment waarop
       command.js het VOORSTEL (met de knop erin) door het resultaat vervangt --
       op alleen het antwoord wachten leest nog de oude tekst. */
    const voorDoe = await tekstVan(page, '#wkRahulContext');
    await klikEnWacht(page, '#wkDoe', '/handeling/doe');
    await wachtOpVerandering(page, '#wkRahulContext', voorDoe);
    const naKnop = await page.evaluate(() => document.getElementById('wkRahulContext').innerText.replace(/\s+/g, ' '));
    assert.match(naKnop, /Uitgevoerd/, 'na de knop wel: ' + naKnop);
    assert.match(naKnop, /actiebon/, 'met een actiebon erbij');

    const naLijst = await api('/taken', { werkruimte: w.werkruimte, lidToken: pl.lidToken });
    assert.ok(JSON.stringify(naLijst).includes('Dakgoot vervangen'), 'en de taak staat er echt');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
