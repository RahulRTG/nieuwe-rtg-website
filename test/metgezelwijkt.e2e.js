/* RAHUL BLIJFT BEREIKBAAR, MAAR LIGT NOOIT BOVEN EEN GEOPEND VENSTER.

   Het blok van de metgezel staat op z-index 9980 en zweeft daarmee boven
   vrijwel elk venster in dit huis (de bladen van Clips staan op 10, de
   onboarding-poort op 130). Die vensters openen onderaan, want dat is de
   telefoonvorm hier, en dus lagen hun onderste knoppen onder de balk van
   Rahul. In Clips was dat letterlijk de knop "Sluit": met een vinger niet te
   raken, en in test/clips-studio.e2e.js dertig seconden lang "intercepts
   pointer events".

   Rahul is inmiddels de centrale Command-tab in de kop. De oude zwevende
   metgezel bestaat bewust niet meer. Deze toets bewaakt dezelfde belofte in
   de nieuwe architectuur: de tab is er, een dialoog ligt erboven en vangt de
   tik, en na sluiten is Rahul direct weer bereikbaar.

   Draai: npm run e2e (of los: node --test test/metgezelwijkt.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const rahulStaat = () => {
  const tab = document.querySelector('.rtg-rahul-tab');
  if (!tab) return 'geen tab';
  return tab.hidden || !tab.getClientRects().length ? 'weg' : 'zichtbaar';
};

test('de metgezel wijkt voor een venster en komt daarna terug',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mgzwijkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Wijklid', email: 'mw' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(lid.token, 'het lid is ingelogd');
    /* Een eigen clip, zodat de feed een kaart heeft met bladen erachter. Zonder
       kaart staat er niets om te openen en toetst de tweede helft niets. */
    const clip = await fetch(base + '/api/clips/maak', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lid.token },
      body: JSON.stringify({ titel: 'Proefclip', duurS: 9, mbGeschat: 1 }) }).then(r => r.json());
    assert.ok(clip.id, 'er staat een kaart in de feed');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    /* Clips, want daar kwam de melding vandaan: een blad dat onderaan opent,
       met zijn sluitknop precies op de plek van de balk. */
    await page.goto(base + '/apps/clips.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('.rtg-rahul-tab'), null, { timeout: 20000 });
    assert.equal(await page.evaluate(rahulStaat), 'zichtbaar', 'in rust is de centrale Rahul-tab bereikbaar');

    /* De enterprise-workspace wordt bewust als kleine vervolgmodule geladen.
       Bewaak dat die opsplitsing niet alleen compileert, maar ook echt landt
       en beide veilige voorbereidingsknoppen blijft bedienen. */
    await page.waitForSelector('.rtg-one [data-one-decision]', { state: 'attached', timeout: 10000 });
    await page.click('.rtg-rahul-tab');

    /* HIER STOND EEN VASTGEPINDE DECORTEKST, en dat is precies waarom deze
       twee regels omvielen. De knop schreef vroeger zelf "5 DOMEINEN
       GESIMULEERD" en "4 voorbereid · 0 uitgevoerd" in het scherm zonder iets
       te simuleren; deze toets pinde die bewering vast en hield haar daarmee in
       leven. De Live Twin haalt de stand nu bij de server: eerst een
       tussenstand, daarna de echte status met het aantal bevestigde bronnen.
       Toevallig zijn dat er ook vijf -- maar nu gemeten in plaats van beweerd.

       Dus toetsen we niet langer de tekst maar de RONDE: de Proof Rail komt
       alleen in de "n CONTROLES"-vorm te staan als de server werkelijk een
       pakket met bronnen heeft geleverd (de beginstand is "2 SERVERBRONNEN").
       Deze toets zakt dus zodra die ronde stilvalt, en niet zodra iemand een
       woord in de koptekst wijzigt. */
    await page.click('[data-build-plan]');
    await page.waitForFunction(
      () => /^\d+ CONTROLES$/.test(((document.querySelector('[data-proof-count]') || {}).textContent || '').trim()),
      null, { timeout: 20000 });
    const bronnen = (await page.textContent('[data-proof-count]')).trim().match(/^(\d+) CONTROLES$/);
    assert.ok(Number(bronnen[1]) >= 1, 'de server heeft minstens een bron bevestigd, dus de ronde is echt gelopen');
    assert.match((await page.textContent('[data-flow-evidence]')).trim(), /^\d+ bevestigd$/,
      'en de Evidence-stap telt diezelfde bevestigde bronnen');
    assert.notEqual((await page.textContent('[data-twin-state]')).trim(), 'BRONNEN CONTROLEREN',
      'de twin blijft niet in de tussenstand hangen');

    /* De tweede knop. Zonder wachtend voorstel voert hij niets uit en zegt dat
       ook -- dat is de grens die deze PR bewaakt. Dus: hij antwoordt zichtbaar,
       en de uitvoeringsstand springt níet op uitgevoerd. */
    const logVoor = await page.evaluate(() => document.querySelector('.rtg-command-log').children.length);
    await page.click('[data-one-decision]');
    await page.waitForFunction(n => document.querySelector('.rtg-command-log').children.length > n,
      logVoor, { timeout: 10000 });
    assert.equal((await page.textContent('[data-decision-state]')).trim(), 'GEEN UITVOERING',
      'zonder wachtend voorstel blijft de uitvoeringsstand leeg');

    await page.click('.rtg-command-close');
    assert.equal(await page.evaluate(rahulStaat), 'zichtbaar', 'na de workspace blijft de tab bereikbaar');

    // het blad openen zoals een lid dat doet
    await page.click('#studioOpen');
    await page.waitForSelector('#studio.open', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('.rtg-rahul-tab').hidden, null, { timeout: 5000 });
    assert.equal(await page.evaluate(rahulStaat), 'weg', 'het geopende venster krijgt voorrang op Rahul');

    /* En de knop die hier het hele geval aanwees: zonder de reparatie zit hij
       onder de balk en meldt Playwright "intercepts pointer events". */
    await page.click('#studioDicht', { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector('#studio').classList.contains('open'), null, { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('.rtg-rahul-tab').hidden, null, { timeout: 5000 });
    assert.equal(await page.evaluate(rahulStaat), 'zichtbaar', 'en daarna is Rahul direct weer bereikbaar');

    /* Twee keer achter elkaar, want een wijk-regel die maar een keer werkt is
       net zo goed stuk -- en dan via een ANDER blad, zodat het niet aan dat
       ene blad ligt. De knop staat op de kaart van de eigen clip. */
    await page.waitForSelector('.clip .laag .knop', { timeout: 20000 });
    await page.locator('.clip .laag .knop', { hasText: 'Bewerken' }).first().click();
    await page.waitForSelector('#knipSheet.open', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('.rtg-rahul-tab').hidden, null, { timeout: 5000 });
    assert.equal(await page.evaluate(rahulStaat), 'weg', 'ook het tweede venster krijgt voorrang');
    await page.click('#knipDicht');
    await page.waitForFunction(() => !document.querySelector('#knipSheet').classList.contains('open'), null, { timeout: 5000 });
    await page.waitForFunction(() => !document.querySelector('.rtg-rahul-tab').hidden, null, { timeout: 5000 });
    assert.equal(await page.evaluate(rahulStaat), 'zichtbaar', 'en hij blijft terugkomen');

    assert.deepEqual(fouten, [], 'geen fout op de pagina');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
