/* ============================================================================
   DE DRIE SCHERMEN VAN DE DOELGROEPEN

   De API-grenzen staan in test/rtfos-doelgroepen.test.js. Dit gaat over wat er
   op het SCHERM verschijnt -- en juist bij deze drie is dat een ander soort
   fout dan een kapotte knop. Een vrijwilligersscherm dat zijn telefoonnummer
   toont, een deelnemersscherm met een interne notitie erop, of een buurt-app
   met een hulpvraag erin ziet er alle drie perfect uit. Ze werken. Ze lekken.

   Daarom leest deze toets bij elk scherm de ZICHTBARE TEKST en het RAUWE
   ANTWOORD. Dat tweede is er niet voor de sier: bij het gemeentescherm bleek
   eerder dat gegevens die wel de deur uit gaan maar niet getekend worden, langs
   een tekstcontrole glippen (zie test/rtfosschermen.e2e.js).

   En er staat een handeling in die alleen op het scherm bestaat: de hulpvrager
   die zijn toestemming intrekt met een knop. Dat is de reden dat dat portaal er
   is; een knop die het niet doet, is erger dan geen knop.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosdoel-'));
const OFFICE_CODE = 'RTFOSDOEL-KEURING';

/* Het decor: een stad met een project, een vrijwilliger met een evaluatie en
   een telefoonnummer, en een hulpvraag met een naam, een nummer en een interne
   notitie. Juist die vijf mogen straks NERGENS op een van de drie schermen
   staan. */
async function decor(base) {
  const token = await kantoorAlsPersoon(base);
  assert.ok(token, 'geen kantoorsessie');
  const post = (pad, body, tok) => fetch(base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  }).then(r => r.json());
  const api = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || token);

  const stad = (await api('stad/maak', { naam: 'Almere' })).stad;
  await api('stad/status', { id: stad.id, status: 'actief' });
  for (const vlag of ['youth_programs', 'volunteer_management', 'individual_cases', 'events']) {
    await api('stad/module', { id: stad.id, vlag, aan: true });
  }
  const reg = await post('/api/auth/register', { name: 'Bestuur Almere', email: 'ba@rtfosdoel.test',
    phone: '0612345695', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.token);
  const bestuur = (await post('/api/account/start', { rol: 'kantoor' }, reg.token)).token;
  const key = (await api('ik', {}, bestuur)).key;
  await api('zetel', { stad: stad.id, key, naam: 'Bestuur Almere', rol: 'stadsbestuur' });

  const project = (await api('project/maak', { stad: stad.id, naam: 'Huiswerkklas Almere Buiten',
    soort: 'jongeren', budget: 900, doelgroep: 'jongeren 12-18' }, bestuur)).project;
  await api('project/status', { id: project.id, status: 'aanvraag' }, bestuur);
  await api('project/status', { id: project.id, status: 'beoordeling' }, bestuur);
  await api('project/status', { id: project.id, status: 'goedgekeurd' });
  await api('project/status', { id: project.id, status: 'actief' });

  const jaar = new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10);
  const v = (await api('vrijwilliger/maak', { stad: stad.id, naam: 'Saskia V.',
    contact: 'saskia@example.org, 0644433322' })).vrijwilliger;
  await api('vrijwilliger/zet', { id: v.id, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  await api('vrijwilliger/koppel', { id: v.id, projectId: project.id });
  await api('vrijwilliger/evaluatie', { id: v.id, tekst: 'te streng tegen de oudste groep' });
  const vcode = (await api('vrijwilliger/code', { id: v.id })).code;

  const c = (await api('casus/maak', { stad: stad.id, soort: 'voedsel', urgentie: 'hoog',
    vraag: 'geen geld voor boodschappen deze week', wijk: 'Almere Buiten',
    contact: 'Peter de Groot, 0699988877' })).casus;
  await api('casus/stap', { id: c.id, soort: 'contact', tekst: 'gebeld, pakket klaargezet voor vrijdag' });
  await api('casus/stap', { id: c.id, soort: 'notitie', tekst: 'vermoeden van schulden, doorvragen bij het volgende gesprek' });
  await api('casus/status', { id: c.id, status: 'intake' });
  await api('casus/status', { id: c.id, status: 'toestemming',
    toestemming: 'naam en telefoon mogen naar de voedselbank voor een pakket' });
  const dcode = (await api('casus/code', { id: c.id })).code;

  const act = (await api('activiteit/maak', { stad: stad.id, naam: 'Buurtmaaltijd Almere',
    soort: 'buurtmaaltijd', capaciteit: 30, wanneer: '2026-12-12', tijd: '18:00', locatie: 'buurthuis' })).activiteit;
  await api('activiteit/open', { id: act.id });

  /* Vier uur die de vrijwilliger zelf doorgeeft. Ze staan hier in het decor
     omdat het bestuursscherm ze moet TONEN met een bevestigknop: een melding
     die de coordinator nergens ziet, is hetzelfde als geen melding. */
  await post('/api/rtfos/portaal/vrijwilliger/uren', { code: vcode, uren: 4, datum: '2026-11-03' });

  return { vcode, dcode, stadNaam: stad.naam, token };
}

// de vijf dingen die op geen van de drie schermen mogen staan
const GEHEIM = ['0644433322', 'saskia@example.org', 'te streng tegen', 'Peter de Groot',
  '0699988877', 'vermoeden van schulden'];

function lekken(tekst) { return GEHEIM.filter(g => tekst.includes(g)); }

async function schermMet(base, pw, pad) {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  const antwoorden = [];
  page.on('response', async res => {
    if (!res.url().includes('/api/rtfos/')) return;
    try { antwoorden.push(await res.text()); } catch (e) { /* afgebroken antwoord */ }
  });
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  return { browser, page, fouten, antwoorden };
}

test('het vrijwilligersscherm toont zijn planning en nergens zijn nummer of een evaluatie',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  let s;
  try {
    const d = await decor(srv.base);
    s = await schermMet(srv.base, pw, '/apps/foundation/os-vrijwilliger.html');

    // eerst een code die niet klopt: het scherm hoort te zeggen wat er mis is
    await s.page.fill('#code', 'RTFX-FOUTCODE');
    await s.page.click('#open');
    await s.page.waitForSelector('.melder.fout', { timeout: 15000 });
    assert.match(await s.page.textContent('.melder.fout'), /begint met RTFV/);

    await s.page.fill('#code', d.vcode);
    await s.page.click('#open');
    await s.page.waitForSelector('#dagen', { timeout: 15000 });
    const tekst = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Saskia V\./i);
    assert.match(tekst, /Huiswerkklas Almere Buiten/, 'zijn project staat niet op het scherm');
    assert.match(tekst, /VOG/, 'de VOG-stand staat niet op het scherm');
    assert.deepEqual(lekken(tekst), [], 'het scherm lekt: ' + lekken(tekst).join(', '));

    // beschikbaarheid aanzetten en bewaren -- dat is waar dit scherm voor is
    await s.page.click('[data-dag="di-a"]');
    await s.page.click('#vBewaar');
    await s.page.waitForSelector('.melder.goed', { timeout: 15000 });
    assert.match(await s.page.textContent('.melder.goed'), /Bijgewerkt/);

    assert.deepEqual(lekken(s.antwoorden.join('\n')), [],
      'het antwoord van de server lekt naar het vrijwilligersscherm');
    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (s && s.browser) await s.browser.close();
    stop(srv && srv.child);
  }
});

test('het deelnemersscherm toont de stand in gewone taal en de knop om in te trekken',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP + '-2', OFFICE_CODE } });
  let s;
  try {
    const d = await decor(srv.base);
    s = await schermMet(srv.base, pw, '/apps/foundation/os-deelnemer.html');

    await s.page.fill('#code', d.dcode);
    await s.page.click('#open');
    await s.page.waitForSelector('#intrek', { timeout: 15000 });
    const tekst = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    // gewone taal, geen ketenwoorden
    assert.match(tekst, /toestemming voor/i, 'zijn toestemming staat niet in beeld');
    assert.match(tekst, /pakket klaargezet/, 'wat er voor hem is gedaan, staat er niet');
    assert.equal(/in_uitvoering|gekoppeld|ontvangen/.test(tekst), false,
      'er staat ketentaal op het scherm van de hulpvrager');
    assert.deepEqual(lekken(tekst), [], 'het scherm lekt: ' + lekken(tekst).join(', '));

    /* DE KNOP DIE DIT PORTAAL BESTAANSRECHT GEEFT. Na het intrekken hoort het
       scherm het te zeggen EN de knop te laten verdwijnen -- een knop die na
       gebruik blijft staan, laat mensen twijfelen of het is gelukt. */
    await s.page.fill('#reden', 'het is opgelost');
    await s.page.click('#intrek');
    await s.page.waitForSelector('.melder.goed', { timeout: 15000 });
    const na = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(na, /ingetrokken/);
    assert.equal(await s.page.$('#intrek'), null, 'de intrekknop staat er na het intrekken nog steeds');

    assert.deepEqual(lekken(s.antwoorden.join('\n')), [],
      'het antwoord van de server lekt naar het deelnemersscherm');
    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (s && s.browser) await s.browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP + '-2', { recursive: true, force: true }); } catch (e) {}
  }
});

test('de buurt-app toont activiteiten en geen enkel gegeven over een mens',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP + '-3', OFFICE_CODE } });
  let s;
  try {
    await decor(srv.base);
    s = await schermMet(srv.base, pw, '/apps/foundation/os-publiek.html');
    await s.page.waitForSelector('[data-stad]', { timeout: 15000 });
    await s.page.click('[data-stad]');
    await s.page.waitForSelector('#uit .kaart', { timeout: 15000 });
    const tekst = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    assert.match(tekst, /RTF Almere/i, 'de stad staat niet in beeld');
    assert.match(tekst, /Buurtmaaltijd Almere/, 'de open activiteit staat niet in beeld');
    assert.match(tekst, /plekken vrij/i, 'er staat niet of er nog plek is');
    assert.match(tekst, /Huiswerkklas Almere Buiten/, 'het lopende project staat niet in beeld');

    assert.deepEqual(lekken(tekst), [], 'de publieke app lekt: ' + lekken(tekst).join(', '));
    assert.equal(/HV-[A-Z0-9]/.test(tekst), false, 'een casus-codenaam stond in de publieke app');
    assert.equal(tekst.includes('geen geld voor boodschappen'), false, 'een hulpvraag stond in de publieke app');
    assert.equal(/€\s?\d/.test(tekst), false, 'er staan bedragen in de publieke app');

    const rauw = s.antwoorden.join('\n');
    assert.ok(rauw.length > 20, 'er is geen antwoord van de publieke routes meegelezen');
    assert.deepEqual(lekken(rauw), [], 'het antwoord aan de buurt lekt');
    assert.equal(/"hulpvragen"|"geholpen"|"deelnemersUniek"/.test(rauw), false,
      'er gaat een teller over hulpvragen naar de publieke app');
    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (s && s.browser) await s.browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP + '-3', { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ---------------------------------------------------------------------------
   DE OVERDRACHT: van het bestuursscherm naar de app van de vrijwilliger.

   De twee kanten zijn hierboven los getoetst, en dat is precies waar dit soort
   dingen stukgaat: de vrijwilligersapp werkt, de code-uitgifte werkt, en er is
   geen knop die ze aan elkaar knoopt. Dan bestaat de app op papier. Deze toets
   loopt de handeling van de coordinator af -- code uitgeven, gemelde uren zien
   staan, uren bevestigen -- op het scherm en niet op de API.
   ------------------------------------------------------------------------- */
test('de coordinator geeft de code uit en bevestigt de gemelde uren, vanaf het bestuursscherm',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP + '-4', OFFICE_CODE } });
  let browser;
  try {
    const d = await decor(srv.base);
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(srv.base + '/apps/foundation/os.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, d.token);
    await page.goto(srv.base + '/apps/foundation/os.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-stad]', { timeout: 15000 });
    await page.click('[data-stad]');
    await page.waitForSelector('[data-tab="vrijwilligers"]', { timeout: 15000 });
    await page.click('[data-tab="vrijwilligers"]');
    await page.waitForSelector('[data-vcode]', { timeout: 15000 });

    // 1. de code uitgeven -- die moet leesbaar op het scherm komen, want hij
    //    wordt persoonlijk overhandigd en niet gemaild
    await page.click('[data-vcode]');
    await page.waitForSelector('.melder.goed', { timeout: 15000 });
    const uitgifte = await page.textContent('.melder.goed');
    assert.match(uitgifte, /RTFV-/, 'de code staat niet op het scherm van de coordinator');
    assert.match(uitgifte, /os-vrijwilliger\.html/, 'er staat niet bij waar de vrijwilliger hem invult');

    // 2. de vier gemelde uren staan in de rij van die vrijwilliger, met de zin
    //    erbij dat ze nog niet meetellen
    const voor = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(voor, /Bevestig 4 uur op 2026-11-03/, 'de gemelde uren staan niet bij de vrijwilliger');
    assert.match(voor, /telt pas mee na uw bevestiging/, 'er staat niet bij dat gemelde uren nog niet meetellen');
    // /i, want de pil met het urentotaal staat in kapitalen op het scherm
    assert.match(voor, /\b0 uur\b/i, 'de gemelde uren tellen al mee voor de bevestiging');

    // 3. bevestigen: de knop verdwijnt en het totaal gaat omhoog
    await page.click('[data-vuren]');
    await page.waitForFunction(() => !document.querySelector('[data-vuren]'), null, { timeout: 15000 });
    const na = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(na, /\b4 uur\b/i, 'de bevestigde uren tellen niet mee in het totaal');
    assert.equal(/telt pas mee na uw bevestiging/.test(na), false, 'de melding blijft staan na bevestigen');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP + '-4', { recursive: true, force: true }); } catch (e) {}
  }
});
