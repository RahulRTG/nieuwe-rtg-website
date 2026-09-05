/* Het Werk OS-scherm in een echte browser: /apps/werk.html.

   Drie beweringen die van buiten NIET te zien zijn aan een groene API-toets:

   1. ZONDER SLEUTEL STAAT ER EEN INLOGKAART, geen leeg scherm en geen
      omleiding die kwijtraakt waar je heen wilde (dezelfde regel als
      TAKEN 5.5). De kaart legt bovendien uit dat een werkruimtesleutel iets
      anders is dan een RTG-pas.
   2. HET STARTSCHERM VOLGT DE ROLLEN EN LIEGT NIET: wat geen bron heeft staat
      er als NIET GEMETEN met de reden erbij, en de snelle acties komen van de
      server.
   3. DE EIGENAAR KOMT BINNEN ZONDER TOKEN OVER TE TYPEN. Wie als RTG-lid is
      ingelogd en de eigenaar IS, opent deze pagina en staat meteen in zijn
      eigen werkruimte -- dat was de melding die dit bestand uitbreidde: "ik
      zie geen werkplek in mijn account".
   4. DE WEIGERINGEN VAN DE SERVER KOMEN OP HET SCHERM. Een taak die nog wacht
      gaat niet af, en het scherm zegt waarop hij wacht. Dat is de hele waarde
      van die weigering: een gebruiker die hem niet ziet, klikt gewoon door.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, volgVerzoeken, wachtOpRust, wachtTot, wachtOpTekst, wachtOpZichtbaar, bankDeur } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkscherm-'));

test('het Werk OS toont zonder sleutel een inlogkaart, en daarbinnen een startscherm dat niet liegt',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, body) => fetch(base + '/api/bedrijf' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const w = await api('/werkruimte/maak', { naam: 'Toetsbedrijf', land: 'NL' });
    const lid = await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Pia' });
    await api('/lid/besluit', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: lid.lidId, akkoord: true });
    await api('/lid/rollen', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: lid.lidId,
      rollen: ['projectleider'] });
    const S = { werkruimte: w.werkruimte, lidToken: lid.lidToken };
    const p = await api('/project/maak', Object.assign({ naam: 'Uitrol Utrecht', werkvorm: 'stadsuitrol' }, S));
    const eerst = await api('/taak/maak', Object.assign({ titel: 'Vergunning aanvragen', projectId: p.project.id, wie: 'Pia' }, S));
    const later = await api('/taak/maak', Object.assign({ titel: 'Opening plannen', projectId: p.project.id, wie: 'Pia' }, S));
    await api('/taak/wacht-op', Object.assign({ taakId: later.taak.id, wachtOpId: eerst.taak.id }, S));

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- zonder sleutel: een kaart, geen leeg scherm ---- */
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.removeItem('rtg_werk_sessie'); });
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await wachtOpZichtbaar(page, '#inlog');
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      kaart: !document.getElementById('inlog').hidden,
      inhoud: !document.getElementById('inhoud').hidden,
      tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/werk.html', 'de pagina stuurt niemand weg');
    assert.equal(uit.kaart, true, 'de inlogkaart staat open');
    assert.equal(uit.inhoud, false, 'en de inhoud is dicht');
    assert.match(uit.tekst, /persoonlijke werksleutel|lid-token/i, 'de kaart legt uit wat er nodig is');
    assert.match(uit.tekst, /eigen omgeving|via RTG verbonden/i, 'en hoe RTG-leden en externe medewerkers binnenkomen');

    /* ---- een verkeerde sleutel opent niets ---- */
    await page.fill('#iWerkruimte', w.werkruimte);
    await page.fill('#iToken', 'raden-maar');
    await page.click('#inlogGa');
    await wachtOpTekst(page, /token|werkruimte/i, { in: '#melding' });
    const naFout = await page.evaluate(() => ({ inhoud: !document.getElementById('inhoud').hidden,
      melding: document.getElementById('melding').textContent }));
    assert.equal(naFout.inhoud, false, 'met een verkeerd token blijft de deur dicht');
    assert.match(naFout.melding, /token|werkruimte/i, 'en het scherm zegt waarom: ' + naFout.melding);

    /* ---- met de sleutel: het startscherm ---- */
    await page.fill('#iWerkruimte', w.werkruimte);
    await page.fill('#iToken', lid.lidToken);
    await page.click('#inlogGa');
    await wachtOpTekst(page, /Uitrol Utrecht/);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Pia/, 'het startscherm noemt wie er kijkt');
    assert.match(tekst, /projectleider/, 'met zijn rol');
    assert.match(tekst, /Uitrol Utrecht/, 'en het lopende project');

    const niet = await page.evaluate(() => document.getElementById('wNiet').innerText.replace(/\s+/g, ' '));
    assert.match(niet, /berichten|documenten|agenda/i, 'blokken zonder bron staan als niet gemeten');
    assert.match(niet, /nog geen bron/i, 'met de reden erbij');
    assert.ok(!/\b0\b/.test(niet.replace(/\d+ dag/g, '')), 'en niet als een nul: ' + niet.slice(0, 160));

    const acties = await page.evaluate(() => document.getElementById('wActies').innerText);
    assert.match(acties, /Nieuwe taak/, 'de snelle acties volgen de rechten van een projectleider');
    assert.ok(!/Verlof beoordelen/.test(acties), 'en tonen niets waar hij geen recht op heeft');

    /* ---- de directe projectendeur opent hetzelfde bestaande paneel ---- */
    await page.goto(base + '/apps/werk.html#projecten', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('#rtg-vandaag-luxe[data-modus="surface"][data-surface="projecten"]',
        { state: 'attached', timeout: 15000 });
    } catch (e) {
      const stand = await page.evaluate(() => ({ hash: location.hash, body: document.body.outerHTML.slice(0, 400),
        luxe: document.body.getAttribute('data-rtg-vandaag-luxe'),
        surface: document.body.getAttribute('data-rtg-vandaag-surface'),
        titel: document.body.getAttribute('data-rtg-vandaag-surface-title'),
        api: !!window.RTGVandaagLuxe, fout: String(window.__rtgFout || '') }));
      throw new Error('de projectensurface verscheen niet: ' + JSON.stringify(stand) + '\n' + e.message);
    }
    const luxeMaat = await page.$eval('#rtg-vandaag-luxe', el => {
      const r = el.getBoundingClientRect();
      const shell = document.querySelector('.wk-shell').getBoundingClientRect();
      const voorgrond = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { hoogte: r.height, breedte: r.width, onder: r.bottom, shellBoven: shell.top,
        display: getComputedStyle(el).display, voorgrond: !!voorgrond && el.contains(voorgrond) };
    });
    assert.ok(luxeMaat.hoogte > 0 && luxeMaat.breedte > 0 && luxeMaat.display !== 'none',
      'de compacte wereldkop heeft een zichtbare maat: ' + JSON.stringify(luxeMaat));
    assert.ok(luxeMaat.onder <= luxeMaat.shellBoven + 1,
      'de projectenschil begint onder de compacte wereldkop: ' + JSON.stringify(luxeMaat));
    assert.equal(luxeMaat.voorgrond, true,
      'de compacte wereldkop ligt op zijn middelpunt werkelijk op de voorgrond');
    await wachtOpTekst(page, /Vergunning aanvragen/);
    tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(await page.textContent('#rtg-vandaag-luxe-kop'), /Projecten en taken/,
      'de compacte wereldkop noemt het werkelijk geopende paneel');
    assert.match(tekst, /Vergunning aanvragen/, 'de taken staan in de modulelijst');
    assert.match(tekst, /wacht/, 'en een geblokkeerde taak is als zodanig gemerkt');

    const geweigerd = await page.evaluate(async (s) => {
      const r = await fetch('/api/bedrijf/taak/kolom', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ kolom: 'klaar' }, s)) });
      return { status: r.status, body: await r.json() };
    }, Object.assign({ taakId: later.taak.id }, S));
    assert.equal(geweigerd.status, 409, 'een taak die nog wacht gaat niet af');
    assert.match(geweigerd.body.error, /Vergunning aanvragen/, 'en de weigering noemt waarop hij wacht');

    /* In een werkruimte-iframe blijft de Edge-schil eigenaar van de chrome. */
    await page.goto(base + '/apps/werk.html?embed=1#projecten', { waitUntil: 'domcontentloaded' });
    await wachtOpTekst(page, /Vergunning aanvragen/);
    assert.equal(await page.$('#rtg-vandaag-luxe'), null,
      'de ingebedde projectendeur tekent geen tweede wereldkop');

    /* ---- uitloggen sluit de inhoud weer ---- */
    await page.goto(base + '/apps/werk.html#projecten', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-rtg-edge-2-rendered="true"]', { timeout: 15000 });
    await page.click('.rtg-edge-2-context-button');
    await page.click('#inlogUit');
    await wachtOpZichtbaar(page, '#inhoud', { weg: true });
    const naUit = await page.evaluate(() => !document.getElementById('inhoud').hidden);
    assert.equal(naUit, false, 'na uitloggen is de inhoud weer dicht');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de eigenaar staat meteen in zijn eigen werkruimte, zonder een token over te typen',
  { skip: geenBrowser(pw) }, async () => {
  const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkeig-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP2 } });
  let browser;
  try {
    const inlog = await fetch(base + '/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' }) })
      .then(r => r.json());
    assert.ok(inlog.token, 'de eigenaar kan inloggen: ' + JSON.stringify(inlog).slice(0, 120));

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_werk_sessie');
      localStorage.setItem('rtg_member_token', t);
    }, inlog.token);
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await wachtOpZichtbaar(page, '#inhoud');
    const stand = await page.evaluate(() => ({ kaart: !document.getElementById('inlog').hidden,
      inhoud: !document.getElementById('inhoud').hidden,
      tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(stand.kaart, false, 'de inlogkaart blijft dicht: er was al een weg naar binnen');
    assert.equal(stand.inhoud, true, 'en de werkplek staat open');
    assert.match(stand.tekst, /Rahul Travel Group/, 'in zijn eigen werkruimte');
    assert.match(stand.tekst, /directie/, 'met de directie-rol');

    /* En hij is te VINDEN: een tegel op de HOMESCREEN. Dat was de tweede helft
       van de melding -- een app die alleen bestaat als je het adres kent,
       bestaat voor een gebruiker niet.

       Die eis stond hier eerst op het bureaublad (/apps/index.html), de
       scrollende pagina met alle apps in secties. Dat was een tweede
       beginscherm naast het springboard en is weg; het pad brengt je nu naar
       de homescreen. De eis verhuisde mee, en dat is geen formaliteit: bij die
       verhuizing bleek de Werk OS-tegel NERGENS meer te staan -- geen enkele
       pagina linkte er nog naartoe. Deze toets is wat dat aan het licht bracht.

       We kijken daarom naar het scherm en niet naar de bron: een sleutel in
       LINKS zetten is niet genoeg, hij moet ook in de indeling van een map
       staan, anders tekent het springboard hem nooit.

       DE TEGEL HEET NIET MEER "WERK OS". Er stonden twee tegels met hetzelfde
       koffertje naast elkaar -- "Werk OS" (de werkplek-app) en "Mijn
       werkplekken" (de kiezer) -- en erger: twee inlogs. Die zijn samengevoegd
       tot een deur: Mijn werkplekken. Deze toets zocht daarna nog op de oude
       naam en stond sindsdien rood, wat pas opviel toen hij weer werd
       gedraaid. De EIS is niet veranderd -- de werkplek moet vindbaar zijn op
       de homescreen -- alleen de naam waaronder je hem vindt.

       EN NIET MEER IN WELKE MAP. Deze toets opende "Het Huis" en keek daarin;
       toen de vier mappen er acht werden verhuisden Mijn werkplekken en RTG
       Office naar de map Werk, en stond hij weer rood om een indeling en niet
       om de eis. De eis is: vindbaar op de homescreen, in EEN van de mappen.
       We lopen ze daarom allemaal af. Een indeling mag schuiven; een app die
       nergens meer staat mag niet.

       EN NIET MEER OP DE NAAM. Dit is de DERDE keer dat deze toets op een
       hernoeming zakt: eerst "Werk OS" -> "Mijn werkplekken", nu "RTG Office"
       -> "Documenten". Dat is geen toeval maar beleid -- de tegels heten
       bewust functies en geen producten ("Video" en niet "Clips", zie LINKS in
       app-main-24.js) -- en een toets die het etiket vastpint, staat rood bij
       elke ronde die dat beleid uitvoert. Hij leest nu `data-sleutel`, de
       naam die het springboard zelf gebruikt om de app te vinden
       (`link:office`, `os:werk`). Die verandert alleen als de app echt een
       andere app wordt. De zichtbare namen gaan wel mee in de foutmelding,
       want daarmee zoek je hem terug op het scherm. */
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    /* De werktafel is er pas als de schil zijn wereldbank heeft opgebouwd; dat
       is wat de lus hieronder nodig heeft. */
    await wachtTot(page, () => !!document.querySelector('#rtgCommand, .cmd-bank, #osZoek'),
      null, { wat: 'de werktafel van RTG Command' });
    /* EN NIET MEER DOOR DE MAPPEN OF DE WERELDSTAND.

       Deze lus opende eerst elke tegel en las het mappenscherm; dat scherm
       verdween toen een wereld een APP werd (PLATFORM.md par. 0). Daarna liep
       hij de wereldstand af met RTGWereld.zoom() -- de kring om de klok. Ook
       die is weg: de klok is van het beginscherm af en de werktafel is het
       geworden (WERELD.md), en shared/wereld.js bestaat niet meer.

       DE EIS IS NOG STEEDS DEZELFDE, en dat is waarom deze toets blijft
       bestaan in plaats van mee te verdwijnen: de werkplek en RTG Office
       moeten vanaf het beginscherm te VINDEN zijn. Wat verandert is telkens
       waar je kijkt.

       Nu is dat Spotlight, en niet bij gebrek aan beter: de `items` van een
       wereld bestaan sinds openMap (app-main-26b.js) nog uitsluitend zodat
       deze index ze indexeert. Wat Spotlight niet kent, kan een lid niet meer
       vinden zonder het adres te weten -- precies de melding waar deze toets
       uit voortkwam.

       De weg erheen is de weg van een lid: de bank van de werktafel, de deur
       naar het bedieningspaneel, en daar Zoeken. Nog steeds op data-sleutel en
       niet op naam; de zichtbare namen gaan alleen mee in de foutmelding. */
    /* De intake staat buiten deze toets: een account waarvan de overeenkomst
       nog niet getekend is krijgt #onbGate over het scherm, en daar mag de
       werktafel niet overheen (shared/command.js). Mocken op `klaar` is wat de
       rest van de suite hier ook doet. */
    await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('app')?.classList.contains('active'),
      null, { timeout: 30000 });
    await bankDeur(page, 'Instellingen', { timeout: 20000 });
    await page.waitForSelector('#osCcScrim.open', { timeout: 10000 });
    await page.click('#osCcZoek');
    await page.waitForSelector('#osZoekScrim.open', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('#osZoekLijst button[data-sleutel]').length > 5,
      null, { timeout: 10000 });
    const tegels = await page.evaluate(() =>
      [...document.querySelectorAll('#osZoekLijst button[data-sleutel]')]
        .map(b => ({ sleutel: b.dataset.sleutel || '', naam: b.textContent.trim() })));
    assert.ok(tegels.length, 'Spotlight hoort de onderdelen van de werelden te indexeren');
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await wachtTot(page, () => {
      const i = document.getElementById('inlog'), c = document.getElementById('inhoud');
      return !!i && !!c && (!i.hidden || !c.hidden);
    }, null, { wat: 'de werkplek die kiest tussen deur en inhoud' });

    // en de werkplek staat ook gewoon in de app-bibliotheek
    const inBieb = await page.evaluate(async () => {
      const r = await fetch('/api/gids/app', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pad: '/apps/werk.html' }) });
      return r.status;
    });
    assert.equal(inBieb, 200, 'de app-gids kent de werkplek');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP2, { recursive: true, force: true }); } catch (e) {}
  }
});

test('de handelingen staan op het scherm, en een weigering komt voluit in beeld',
  { skip: geenBrowser(pw) }, async () => {
  const TMP3 = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkactie-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP3 } });
  let browser;
  try {
    const inlog = await fetch(base + '/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' }) })
      .then(r => r.json());
    assert.ok(inlog.token, 'de eigenaar kan inloggen');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await volgVerzoeken(page);

    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_werk_sessie');
      localStorage.setItem('rtg_member_token', t);
    }, inlog.token);
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await wachtOpZichtbaar(page, '#inhoud');
    await page.waitForSelector('body[data-rtg-edge-2-rendered="true"]', { timeout: 15000 });
    await page.click('.rtg-edge-2-context-button');
    await page.click('[data-wk="projecten"]');
    await page.click('.rtg-edge-2-context-close');
    await wachtOpZichtbaar(page, '#a_h0_naam');
    await wachtOpRust(page);

    /* VULLEN, NAKIJKEN, DAN PAS KLIKKEN. Het handelingenpaneel tekent zichzelf
       na elk antwoord opnieuw, en een hertekening wist wat er net is ingetypt.
       Wie daartussen klikt, stuurt lege velden mee -- de server weigert dan om
       een andere reden dan de toets denkt te meten. Zo viel deze toets een op de
       drie rondes om nadat de vaste wachttijden eruit waren; die dekten het toe. */
    const vulEnDoe = async (velden, knop) => {
      for (let poging = 0; poging < 3; poging++) {
        for (const [sel, waarde] of velden) {
          const veld = page.locator(sel);
          const tag = await veld.evaluate((e) => e.tagName);
          if (tag === 'SELECT') await veld.selectOption(waarde);
          else await veld.fill(waarde);
        }
        const blijftStaan = await page.evaluate((v) => v.every(([sel, waarde]) => {
          const el = document.querySelector(sel);
          return !!el && el.value === waarde;
        }), velden);
        if (blijftStaan) { await page.click(knop); return wachtOpRust(page); }
      }
      throw new Error('de velden voor ' + knop + ' bleven niet staan: het paneel hertekende steeds opnieuw');
    };

    /* ---- een project maken vanaf het scherm ---- */
    await vulEnDoe([['#a_h0_naam', 'Uitrol Den Haag'], ['#a_h0_werkvorm', 'stadsuitrol']], '[data-doe="0"]');
    await wachtOpTekst(page, /Uitrol Den Haag/);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Uitrol Den Haag/, 'het project staat na de handeling in de lijst');
    assert.match(tekst, /nog geen taken/, 'en zonder taken staat er geen percentage');

    /* ---- een besluit sluiten zonder stemmen: de weigering hoort VOLUIT op
       het scherm te komen, niet als een rood kruisje ---- */
    await page.selectOption('#mKeuze', 'besluit');
    await wachtOpZichtbaar(page, '#a_h0_titel');
    await vulEnDoe([['#a_h0_titel', 'Kantoor sluiten op vrijdag'],
      ['#a_h0_onderbouwing', 'Bijna niemand komt naar kantoor op vrijdag.']], '[data-doe="0"]');
    await wachtOpTekst(page, /Kantoor sluiten op vrijdag/);
    tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Kantoor sluiten op vrijdag/, 'het voorstel staat in de lijst');
    assert.match(tekst, /advies/, 'en het staat op advies');

    const besluitId = await page.evaluate(async (s) => {
      const r = await fetch('/api/bedrijf/besluiten', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      const d = await r.json();
      return (d.besluiten.find(b => b.titel === 'Kantoor sluiten op vrijdag') || {}).id;
    }, await page.evaluate(() => JSON.parse(localStorage.getItem('rtg_werk_sessie'))));
    assert.ok(besluitId, 'het besluit is te vinden');

    // stemronde openen (handeling 2), daarna sluiten zonder stemmen (handeling 4)
    await vulEnDoe([['#a_h2_besluitId', besluitId]], '[data-doe="2"]');
    await wachtOpZichtbaar(page, '#a_h4_besluitId');
    await vulEnDoe([['#a_h4_besluitId', besluitId],
      ['#a_h4_evalueerOp', new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)]], '[data-doe="4"]');
    await wachtOpTekst(page, /niet gestemd|geen besluit/i, { in: '#melding' });
    const melding = await page.evaluate(() => document.getElementById('melding').textContent);
    assert.match(melding, /niet gestemd|geen besluit/i,
      'de weigering van de server komt voluit in beeld: ' + melding);
    assert.match(melding, /automaat neemt het hier niet over/i,
      'inclusief de zin die uitlegt waarom -- die zin is het halve product');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP3, { recursive: true, force: true }); } catch (e) {}
  }
});
