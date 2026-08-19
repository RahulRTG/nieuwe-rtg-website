/* Schermtoets voor apps/life.html. De belofte van dit scherm is dat je NIET
   hoeft te weten welke app je moet openen: een doel dat je in Doelen zet en een
   afspraak die je bij de salon maakt, staan hier vanzelf.

   En de belofte die er nog meer toe doet: wat niet gemeten wordt, staat er als
   niet gemeten. Dat wordt hier op het scherm zelf nagekeken, want een motor die
   het netjes teruggeeft en een scherm dat er alsnog een nul van maakt, is voor
   een lezer hetzelfde probleem.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('RTG Life: een doel uit Doelen staat er, en wat niet gemeten wordt zegt dat',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lifescherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Life Lid', email: 'lifescherm@x.nl', phone: '0612345855',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    // een doel via de API, precies zoals Doelen dat doet
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then(r => r.json());
    await api('doelen/maak', { titel: '10 kilometer hardlopen', reden: 'ik wil het kunnen',
      eenheid: 'km', nulmeting: 2, streef: 10, streefOp: overDagen(60) });
    const id = (await api('doelen', {})).doelen[0].id;
    await api('doelen/meet', { id, waarde: 4 });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/life.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('signalen');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, null, { timeout: 15000 });

    /* 1. de kernbelofte: geen verzonnen cijfers. Slaap, beweging en voeding
       staan er MET hun reden en zonder getal. */
    const signalen = await page.textContent('#signalen');
    for (const naam of ['Slaap', 'Beweging', 'Water']) {
      assert.ok(signalen.includes(naam), naam + ' staat op het scherm');
    }
    const aantalNietGemeten = (signalen.match(/niet gemeten/g) || []).length;
    assert.ok(aantalNietGemeten >= 3, 'de drie nog niet ingevulde signalen zeggen zelf dat ze niet gemeten zijn');
    assert.ok(!/\b0\b/.test(await page.evaluate(() => {
      // alleen de waardekolom van de ongemeten regels: daar hoort geen cijfer te staan
      return [...document.querySelectorAll('#signalen .sig.leeg .waarde')].map(e => e.textContent).join(' ');
    })), 'in de waardekolom van een ongemeten signaal staat geen nul');

    /* 1b. de bron zelf: invullen op dit scherm, en het signaal verandert mee.
       Dit is het verschil tussen een rij die eerlijk leeg is en een rij die
       eerlijk leeg BLIJFT omdat je er niets aan kunt doen. */
    await openDeel(page, 'Vandaag invullen');
    const slaapveld = page.locator('[data-mveld="slaap"]');
    await slaapveld.scrollIntoViewIfNeeded();
    await slaapveld.fill('7');
    const bewaar = page.locator('[data-mzet="slaap"]');
    await bewaar.scrollIntoViewIfNeeded();
    await bewaar.click();
    await page.waitForFunction(() => {
      const e = document.getElementById('signalen');
      return e && /1 nacht/i.test(e.textContent);
    }, null, { timeout: 10000 });
    const naInvullen = await page.textContent('#signalen');
    assert.match(naInvullen, /7/, 'de ingevulde nacht staat als waarde op het scherm');
    assert.match(naInvullen, /over 1 nacht/i,
      'en het scherm zegt hoe weinig het er zijn: een gemiddelde over een nacht is geen weekbeeld');

    /* 1b2. de dagcheck-in, en de grens erop. Eerst een gewone check-in: dan
       staan er praktische dingen. Daarna een notitie waar de grens op aanslaat:
       dan hoort die lijst WEG te zijn en er alleen hulp te staan. Een
       telefoonnummer onder een verder vrolijk lijstje is geen grens. */
    await openDeel(page, 'Hoe zit u erbij');
    const gemiddeld = page.locator('#gemoed [data-stem="gemiddeld"]');
    await gemiddeld.scrollIntoViewIfNeeded();
    await gemiddeld.click();
    /* Wachten op iets dat er ALLEEN NA de klik is. "Rustig ademen" stond er al
       voor de tik (de doe-lijst komt met het eerste beeld mee), dus daarop
       wachten wachtte nergens op -- en de notitie hieronder werd dan ingevuld
       terwijl het blok nog aan het hertekenen was, waarna hij leeg werd
       meegestuurd. De wisknop bestaat pas als er een check-in van vandaag is. */
    await page.waitForSelector('#gWeg', { timeout: 10000 });
    assert.match(await page.textContent('#gemoed'), /rustig ademen/i,
      'een gewone check-in geeft praktische dingen om te doen');

    await page.locator('#gNotitie').fill('ik wil niet meer leven');
    const bewaren = page.locator('#gBewaar');
    await bewaren.scrollIntoViewIfNeeded();
    await bewaren.click();
    await page.waitForFunction(() => /0800-0113/.test(document.getElementById('gemoed').textContent),
      null, { timeout: 10000 });
    const naGrens = await page.textContent('#gemoed');
    assert.ok(!/rustig ademen/i.test(naGrens),
      'bij een crisis staat er GEEN ademhalingsoefening meer op het scherm');
    assert.match(naGrens, /geen hulpverlener/i, 'en RTG zegt zelf dat het dit niet is');

    // opruimen, zodat de rest van de toets een gewoon scherm ziet
    await page.locator('#gWeg').click();
    await page.waitForFunction(() => !/0800-0113/.test(document.getElementById('gemoed').textContent),
      null, { timeout: 10000 });

    /* 1c. een toestel koppelen: de sleutel komt een keer op het scherm, en de
       lijst laat hem daarna niet nog eens zien. */
    await openDeel(page, 'Toestellen');
    await page.locator('#tNaam').fill('Horloge');
    const koppel = page.locator('#tKoppel');
    await koppel.scrollIntoViewIfNeeded();
    await koppel.click();
    await page.waitForFunction(() => {
      const e = document.getElementById('tSleutel');
      return e && /[0-9a-f]{48}/.test(e.textContent);
    }, null, { timeout: 10000 });
    const sleutel = (await page.textContent('#tSleutel')).match(/[0-9a-f]{48}/)[0];
    assert.match(await page.textContent('#tSleutel'), /nooit meer/i,
      'het scherm zegt dat dit het enige moment is');
    assert.match(await page.textContent('#toestellen'), /Horloge/);

    // en het toestel schrijft echt: een meting via zijn eigen deur komt op het scherm
    const gemeten = await fetch(base + '/api/toestel/meting', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rtg-toestel': sleutel },
      body: JSON.stringify({ onderwerp: 'beweging', waarde: 45 })
    }).then(r => r.json());
    assert.equal(gemeten.bron, 'apparaat');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('signalen');
      return e && /uw toestel mat/i.test(e.textContent);
    }, null, { timeout: 15000 });
    assert.ok(!(await page.textContent('#toestellen')).includes(sleutel),
      'na een herlaadbeurt staat de sleutel nergens meer op het scherm');

    /* 1d. de noodkaart. Twee dingen worden hier op het scherm nagekeken: dat er
       niets staat zolang hij uit staat (een grijze voorvertoning leest als
       bijna aan), en dat de allergenen uit het zorgprofiel worden GELEZEN --
       ze worden hier nooit ingetikt, ze komen uit een profiel dat via een
       andere deur is gezet. */
    await api('zorgprofiel/zet', { allergenen: ['penicilline'], dieet: '', medisch: '', delen: false });
    await openDeel(page, 'Als u het zelf niet kunt vertellen');
    await page.waitForSelector('#nBewaar', { timeout: 10000 });
    assert.match(await page.textContent('#nood'), /staat uit/i,
      'een kaart die uit staat toont niets, ook niet half');
    assert.equal(await page.locator('#nood .nkaart').count(), 0);

    /* Een middel in het schema, zodat de kaart ook DAAR iets uit kan lezen. Het
       wordt via de medicatie-deur gezet en nergens op deze pagina ingetikt. */
    await api('medicatie/zet', { naam: 'Metoprolol', sterkte: '50 mg', momenten: '08:00' });

    await page.locator('#nNaam').fill('Mijn zus');
    await page.locator('#nTel').fill('0612345678');
    await page.locator('#nZorg').check();
    await page.locator('#nMeds').check();
    await page.locator('#nAan').check();
    const nBewaar = page.locator('#nBewaar');
    await nBewaar.scrollIntoViewIfNeeded();
    await nBewaar.click();
    await page.waitForSelector('#nood .nkaart', { timeout: 10000 });
    const kaart = await page.textContent('#nood .nkaart');
    assert.match(kaart, /Mijn zus/, 'wie er gebeld moet worden staat op de kaart');
    assert.match(kaart, /penicilline/i,
      'en de allergie uit het zorgprofiel staat erbij, zonder dat hij hier is ingetikt');
    assert.match(kaart, /Metoprolol 50 mg/,
      'en het middel uit het medicatieschema, ook zonder dat het hier is ingetikt');

    /* En de harde kant ervan: haal hem uit het profiel, en hij is ook van de
       kaart. Bij een kopie zou hij hier blijven staan. */
    await api('zorgprofiel/zet', { allergenen: [], dieet: '', medisch: '', delen: false });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openDeel(page, 'Als u het zelf niet kunt vertellen');
    await page.waitForSelector('#nood .nkaart', { timeout: 10000 });
    const naProfiel = await page.textContent('#nood .nkaart');
    assert.ok(!/penicilline/i.test(naProfiel), 'weg uit het profiel is weg van de kaart');
    assert.match(naProfiel, /Mijn zus/, 'en wat van de kaart zelf is, blijft staan');

    /* 1e. het medicatieblok op Life: leesbaar, en zonder opdracht. Het middel
       is via de medicatie-deur gezet en niet op deze pagina; dat is precies de
       belofte van dit scherm. */
    await openDeel(page, 'Vandaag in te nemen');
    await page.waitForFunction(() => /Metoprolol/.test(document.getElementById('medicatie').textContent),
      { timeout: 10000 });
    const medblok = await page.textContent('#medicatie');
    assert.match(medblok, /08:00/, 'met het moment uit het schema');
    assert.ok(!/\bneem\b|moet u innemen/i.test(medblok),
      'Life zegt wat er staat, niet wat u moet innemen: ' + medblok.slice(0, 120));

    /* 1f. de dag. Het medicijn van 08:00 staat op de klok, de gewoonte eronder
       zonder tijd, en elke regel wijst naar de app die hem bezit -- want hier
       valt niets af te vinken, en dat hoort zichtbaar te zijn. */
    await api('gewoonten/maak', { naam: 'Even buiten', waarom: 'hoofd leeg' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openDeel(page, 'Uw dag');
    await page.waitForFunction(() => /Metoprolol/.test(document.getElementById('dag').textContent),
      { timeout: 15000 });
    const dagblok = await page.textContent('#dag');
    assert.match(dagblok, /08:00/, 'het moment uit het schema staat op de klok');
    assert.match(dagblok, /Even buiten/, 'en de gewoonte staat er ook');
    assert.match(dagblok, /zonder vast tijdstip/i,
      'met een kop die zegt dat die geen tijd heeft in plaats van er een te verzinnen');
    assert.equal(await page.locator('#dag .dagrij button').count(), 0,
      'er staat geen enkele afvinkknop op de dag: dit scherm bezit niets');
    assert.ok(await page.locator('#dag .dagrij a[href*="medicijnen"]').count(),
      'de medicijnregel wijst naar Medicijnen');

    /* 2. het doel uit Doelen staat hier, zonder dat het lid Doelen heeft
       geopend in deze sessie. */
    await openDeel(page, 'Waar u naartoe werkt');
    const doelen = await page.textContent('#doelen');
    assert.match(doelen, /10 kilometer hardlopen/);
    assert.match(doelen, /volgende stap/i, 'met de eerstvolgende stap uit de doelenmotor');

    /* 3. bovenaan staat waar vandaag de aandacht heen gaat, en dat is een van de
       eerlijke uitkomsten en geen verzonnen urgentie. */
    const winst = await page.textContent('#winst');
    assert.ok(/eerstvolgende stap|rustig|rust|vandaag|morgen/i.test(winst),
      'de kop bovenaan is een van de bekende uitkomsten: ' + winst.slice(0, 80));

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
