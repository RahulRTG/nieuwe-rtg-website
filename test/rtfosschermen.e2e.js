/* ============================================================================
   DE TWEE SCHERMEN VAN HET FOUNDATION OS

   De API is getoetst in test/rtfos.test.js. Dit gaat over het SCHERM, en dat is
   een ander soort fout: een kloppende server met een liegend scherm ziet er
   perfect uit. Drie dingen die alleen hier te zien zijn:

   1. HET BESTUURSSCHERM TOONT ALLEEN WAT DE SERVER GEEFT. De stadsafdeling komt
      in beeld, de tabbladen openen, en de knoppen van het landelijke toezicht
      (modules, status, limieten, zetels) staan er voor wie landelijk is.

   2. EEN GEWEIGERDE HANDELING LAAT DE ZIN VAN DE SERVER ZIEN. Dit hele systeem
      leunt op die zinnen -- "dit geld is geoormerkt voor X", "u heeft deze
      uitgave zelf aangevraagd". Een scherm dat ze wegvangt in een algemene
      "er ging iets mis" maakt van elke grendel een raadsel. Hier wordt een
      echte grendel geraakt (een stad kan zijn limiet niet verhogen) en de zin
      moet in beeld staan.

   3. HET GEMEENTENPORTAAL BEVAT GEEN PERSOON. Dat is op de server geregeld
      (kern/rtfos/gemeente.js rekent met getelde cijfers), maar het scherm is
      de plek waar een gemeenteambtenaar het werkelijk ziet -- en waar een
      onbedoeld veld het snelst binnensluipt. De tekst van de pagina wordt hier
      op naam, telefoonnummer en casus-codenaam gecontroleerd.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosscherm-'));

// het decor: een stad met een project, een gemeente met een code, en een
// hulpvraag met een naam en een telefoonnummer erin -- juist die laatste moet
// straks NERGENS op het gemeentescherm staan.
async function decor(base, officeCode) {
  const token = await kantoorAlsPersoon(base);
  assert.ok(token, 'geen kantoorsessie');
  const post = (pad, body, tok) => fetch(base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  }).then(r => r.json());
  const api = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || token);

  const stad = (await api('stad/maak', { naam: 'IJmuiden' })).stad;
  await api('stad/status', { id: stad.id, status: 'actief' });
  for (const vlag of ['youth_programs', 'individual_cases', 'municipal_reporting', 'donations']) {
    await api('stad/module', { id: stad.id, vlag, aan: true });
  }

  /* EEN TWEEDE MENS, EN DAT IS GEEN OMSLACHTIGHEID MAAR HET ONTWERP. Wie een
     project indient, keurt het niet zelf goed. Een decor dat met een identiteit
     door de hele keten loopt, kan alleen bestaan als die grendel er niet is --
     dus loopt de projectleider hier de aanvraag en beslist het landelijke
     bestuur. Zo ziet het decor eruit zoals de werkelijkheid eruitziet. */
  const reg = await post('/api/auth/register', { name: 'Leider IJmuiden', email: 'leider.ijmuiden@rtfos.test',
    phone: '0612345670', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: officeCode }, reg.token);
  const leiderToken = (await post('/api/account/start', { rol: 'kantoor' }, reg.token)).token;
  const ikLeider = await api('ik', {}, leiderToken);
  await api('zetel', { stad: stad.id, key: ikLeider.key, naam: 'Leider IJmuiden', rol: 'projectleider' });

  const project = (await api('project/maak', { stad: stad.id, naam: 'Huiswerkklas Zeewijk',
    soort: 'jongeren', budget: 1500, doelgroep: 'jongeren 12-18' })).project;
  await api('project/status', { id: project.id, status: 'aanvraag' }, leiderToken);
  await api('project/status', { id: project.id, status: 'beoordeling' }, leiderToken);
  const goed = await api('project/status', { id: project.id, status: 'goedgekeurd' });
  assert.ok(goed.project, 'het decorproject werd niet goedgekeurd: ' + JSON.stringify(goed).slice(0, 150));
  await api('project/status', { id: project.id, status: 'actief' });
  await api('project/deelnemers', { id: project.id, uniek: 42, herhaald: 15 });
  await api('casus/maak', { stad: stad.id, soort: 'voedsel', urgentie: 'hoog', wijk: 'Zeewijk',
    vraag: 'geen eten in huis', contact: 'Karima el Amrani, 0687654321' });
  const gemeente = (await api('gemeente/maak', { stad: stad.id, naam: 'Gemeente Velsen' })).gemeente;
  await api('gemeente/opdracht', { id: gemeente.id, omschrijving: 'Huiswerkbegeleiding Zeewijk',
    kpi: '40 jongeren begeleiden', bedrag: 15000, deadline: '2027-03-31' });
  return { token, stad, gemeenteCode: gemeente.code };
}

test('het Foundation OS-bestuursscherm toont de stad, de tabbladen en de zin van een grendel',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTFOS-SCHERM' } });
  let browser;
  try {
    const d = await decor(srv.base, 'RTFOS-SCHERM');
    browser = await pw.chromium.launch(browserOpties(pw));
    // de service worker eruit: die haalt schermen vooruit op en zet ze in het
    // schermjournaal alsof deze toets ze heeft afgelegd (zie juridischeschermen.e2e.js)
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(srv.base + '/apps/foundation/os.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, d.token);
    await page.goto(srv.base + '/apps/foundation/os.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-stad]', { timeout: 15000 });

    const kop = await page.evaluate(() => document.body.innerText);
    assert.match(kop, /landelijke RTF-bestuur/, 'het scherm zegt niet wie u bent');
    assert.match(kop, /RTF IJmuiden/, 'de stadsafdeling staat niet in beeld');

    await page.click('[data-stad]');
    await page.waitForSelector('[data-tab="bestuur"]', { timeout: 15000 });
    await page.click('[data-tab="projecten"]');
    await page.waitForSelector('[data-ind]', { timeout: 15000 });
    const projecten = await page.evaluate(() => document.body.innerText);
    assert.match(projecten, /Huiswerkklas Zeewijk/, 'het project staat niet op het scherm');

    /* DE VIER TABBLADEN VAN FASE TWEE. Ze staan hier niet om "het werkt" te
       zeggen maar omdat een tabblad dat een lege dop is, er op een schermfoto
       precies zo uitziet als een tabblad dat werkt. Elk tabblad moet zijn eigen
       formulier tonen -- dat is het bewijs dat de API erachter antwoordde. */
    for (const [tab, merk] of [['subsidies', '#sMaak'], ['voorraad', '#grMaak'],
      ['activiteiten', '#acMaak'], ['berichten', '#brMaak'],
      ['netwerk', '#bdDeel']]) {
      await page.click('[data-tab="' + tab + '"]');
      await page.waitForSelector(merk, { timeout: 15000 });
    }

    /* EEN ECHTE GRENDEL, EN DE ZIN ERBIJ. De landelijke bovengrens voor een
       stadsbestuur is 2.500 euro; een stad kan hem verlagen, niet verhogen. Het
       scherm hoort die zin te tonen en niet weg te vangen. */
    await page.click('[data-tab="bestuur"]');
    await page.waitForSelector('[data-limiet="stadsbestuur"]', { timeout: 15000 });
    await page.fill('#lStad', '99000');
    await page.click('[data-limiet="stadsbestuur"]');
    await page.waitForSelector('.melder.fout', { timeout: 15000 });
    const melding = await page.textContent('.melder.fout');
    assert.match(melding, /verlagen, niet verhogen/,
      'de zin van de server kwam niet in beeld; er stond: ' + melding);

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
  }
});

test('het gemeentenportaal toont cijfers en geen enkele persoon',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP + '-2', OFFICE_CODE: 'RTFOS-SCHERM2' } });
  let browser;
  try {
    const d = await decor(srv.base, 'RTFOS-SCHERM2');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* HET ANTWOORD ZELF, NIET ALLEEN HET SCHERM. Een eerdere versie van deze
       toets keek alleen naar de zichtbare tekst, en een mutatie die de
       hulpvragen WEL meestuurde maar niet toonde sloeg daardoor af (LAT.md
       regel 2, uitkomst AFGESLAGEN). Dat is precies de fout die je wilt vangen:
       gegevens die de deur uit gaan maar toevallig niet getekend worden, staan
       gewoon in het netwerkverkeer van de gemeentelaptop. Daarom wordt hier het
       rauwe antwoord van de portaalroute meegelezen. */
    const antwoorden = [];
    page.on('response', async res => {
      if (!res.url().includes('/api/rtfos/portaal/gemeente')) return;
      try { antwoorden.push(await res.text()); } catch (e) { /* afgebroken antwoord */ }
    });

    await page.goto(srv.base + '/apps/foundation/os-portaal.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
    await page.goto(srv.base + '/apps/foundation/os-portaal.html', { waitUntil: 'domcontentloaded' });

    // eerst een code die niet bestaat: de tekst hoort te zeggen wat er mis is
    await page.fill('#code', 'RTFG-ZZZZZZZ');
    await page.click('#open');
    await page.waitForSelector('.melder', { timeout: 15000 });
    assert.match(await page.textContent('.melder'), /kennen we niet/, 'een onbekende code gaf geen duidelijke zin');

    await page.fill('#code', d.gemeenteCode);
    await page.click('#open');
    await page.waitForSelector('#uit .kaart', { timeout: 15000 });
    const tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    assert.match(tekst, /Gemeente Velsen/i, 'de gemeente staat niet in beeld');
    assert.match(tekst, /Huiswerkbegeleiding Zeewijk/i, 'de opdracht staat niet in beeld');
    assert.match(tekst, /Huiswerkklas Zeewijk/i, 'het project staat niet in het gemeentebeeld');
    assert.match(tekst, /42/, 'het aantal geholpen mensen staat niet in beeld');

    // en nu waar het om gaat: geen persoon, geen nummer, geen casus
    assert.equal(tekst.includes('Karima'), false, 'er stond een naam op het gemeentescherm');
    assert.equal(tekst.includes('0687654321'), false, 'er stond een telefoonnummer op het gemeentescherm');
    assert.equal(tekst.includes('geen eten in huis'), false, 'er stond een hulpvraag op het gemeentescherm');
    assert.equal(/HV-[A-Z0-9]/.test(tekst), false, 'er stond een casus-codenaam op het gemeentescherm');
    // een buurt met een enkele hulpvraag wordt niet apart genoemd
    assert.equal(/Zeewijk\s*\n?\s*1\b/.test(tekst), false, 'een buurt met een enkele hulpvraag stond apart genoemd');

    // en hetzelfde over het antwoord dat werkelijk over de lijn kwam
    assert.ok(antwoorden.length >= 1, 'er is geen antwoord van de portaalroute meegelezen');
    const rauw = antwoorden.join('\n');
    assert.equal(rauw.includes('Karima'), false, 'er stond een naam in het antwoord aan de gemeente');
    assert.equal(rauw.includes('0687654321'), false, 'er stond een telefoonnummer in het antwoord aan de gemeente');
    assert.equal(rauw.includes('geen eten in huis'), false, 'er stond een hulpvraag in het antwoord aan de gemeente');
    assert.equal(/"HV-[A-Z0-9]/.test(rauw), false, 'er stond een casus-codenaam in het antwoord aan de gemeente');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP + '-2', { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
