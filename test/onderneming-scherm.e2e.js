/* Schermtoets voor /apps/onderneming.html: de schil van het Ondernemers-OS.

   Waarom dit er als BROWSERtoets naast de API-toetsen staat: een scherm dat
   200 geeft en netjes rendert kan nog steeds dood zijn (zie de kop van
   test/leven.e2e.js). Deze toets loopt de weg af die een echte ondernemer
   loopt -- beginnen zonder iets, cijfers invullen, het oordeel zien -- en
   controleert dat wat de server zegt ook op het scherm belandt.

   De belangrijkste bewering staat onderaan: een plan dat de stress test
   afkeurt, mag niet stilzwijgend vastgelegd worden. Dat is precies het soort
   grendel dat in een frontend sneuvelt zonder dat een servertoets het merkt.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen met reden.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const skip = geenBrowser(pw);

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })).json();
}

/* Zet een ingelogd lid neer, open het scherm, geef de pagina terug. */
async function open(opts) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ond-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const reg = await post(base, '/api/auth/register', {
    name: 'Aisha', email: 'aisha.scherm@example.com', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg'
  });
  assert.ok(reg.token, 'registratie geeft een sessietoken');

  const browser = await pw.chromium.launch(browserOpties(pw));
  const page = await browser.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.addInitScript((tok) => {
    localStorage.setItem('rtg_member_token', tok);
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, reg.token);
  await page.goto(base + '/apps/onderneming.html', { waitUntil: 'domcontentloaded' });
  return { page, browser, child, base, token: reg.token, fouten,
    op: async () => { try { await browser.close(); } catch (e) {}
      try { child.kill('SIGKILL'); } catch (e) {}
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} } };
}

/* De velden van het intakeformulier invullen. */
async function vul(page, waarden) {
  for (const [id, v] of Object.entries(waarden)) {
    const sel = '#f_' + id;
    const tag = await page.$eval(sel, el => el.tagName);
    if (tag === 'SELECT') await page.selectOption(sel, String(v));
    else await page.fill(sel, String(v));
  }
}

const GOED = { branche: 'zzp', plaats: 'Haarlem', verkoopmodel: 'abonnement',
  prijs: 120, kostprijs: 30, verwachtPerMaand: 60, vasteLasten: 1800,
  urenPerWeek: 32, ervaringJaren: 8, startkapitaal: 15000,
  wat: 'Ramen wassen bij bedrijven', doelgroep: 'Kantoren in het centrum',
  onderscheid: 'Vaste ploeg, avondwerk, geen onderaannemers' };

test('het scherm begint bij "ik denk erover na" en maakt een onderneming aan',
  { skip }, async () => {
  const t = await open();
  try {
    await t.page.waitForSelector('#nieuwKnop', { timeout: 15000 });
    const tekst = await t.page.textContent('#hoofd');
    assert.ok(tekst.includes('Ik denk erover na'), 'de ideefase is het beginpunt van het scherm');

    await t.page.fill('#nieuwNaam', 'Iets met ramen wassen');
    await t.page.click('#nieuwKnop');
    await t.page.waitForSelector('#bewaarKnop', { timeout: 15000 });

    const na = await t.page.textContent('#hoofd');
    assert.ok(na.includes('verkent een idee'), 'de groet van de ideefase staat er');
    assert.ok(na.includes('Vandaag belangrijk'), 'en de actielijst');
    assert.deepEqual(t.fouten, [], 'zonder JS-fouten');
  } finally { await t.op(); }
});

test('een idee toont geen verzonnen cijfers, maar wel waarom er niets staat',
  { skip }, async () => {
  const t = await open();
  try {
    await t.page.waitForSelector('#nieuwKnop', { timeout: 15000 });
    await t.page.fill('#nieuwNaam', 'Proef');
    await t.page.click('#nieuwKnop');
    await t.page.waitForSelector('#bewaarKnop', { timeout: 15000 });

    const tekst = await t.page.textContent('#hoofd');
    assert.ok(tekst.includes('Niet gemeten'), 'het scherm zegt zelf wat het niet weet');
    assert.equal(await t.page.$$eval('.cijfer', els => els.length), 0,
      'en zet er geen enkel cijfer neer, ook geen nul');
    assert.deepEqual(t.fouten, []);
  } finally { await t.op(); }
});

test('cijfers invullen levert de scenario-tabel en het oordeel van de stress test',
  { skip }, async () => {
  const t = await open();
  try {
    await t.page.waitForSelector('#nieuwKnop', { timeout: 15000 });
    await t.page.fill('#nieuwNaam', 'Glasheldere Ramen');
    await t.page.click('#nieuwKnop');
    await t.page.waitForSelector('#bewaarKnop', { timeout: 15000 });

    await vul(t.page, GOED);
    await t.page.click('#bewaarKnop');
    await t.page.waitForSelector('table.mnd', { timeout: 15000 });

    const tekst = await t.page.textContent('#hoofd');
    assert.ok(tekst.includes('Basisscenario') && tekst.includes('Slecht scenario'),
      'de drie scenario\'s staan in de tabel');
    assert.ok(tekst.includes('ga door'), 'een gezond plan krijgt het oordeel "ga door"');
    assert.ok(tekst.includes('opgegeven'), 'en de herkomst van de aannames staat erbij');
    assert.deepEqual(t.fouten, []);
  } finally { await t.op(); }
});

test('de hele weg: rechtsvorm kiezen, de lijst zien, afvinken en de zaak aanvragen',
  { skip }, async () => {
  const t = await open();
  try {
    await t.page.waitForSelector('#nieuwKnop', { timeout: 15000 });
    await t.page.fill('#nieuwNaam', 'Glasheldere Ramen');
    await t.page.click('#nieuwKnop');
    await t.page.waitForSelector('#bewaarKnop', { timeout: 15000 });

    // zonder rechtsvorm staat er geen lijst maar een vraag
    assert.ok((await t.page.textContent('#hoofd')).includes('Welke rechtsvorm wordt het'),
      'de helft van de stappen hangt van die keuze af, dus komt er geen halve lijst');

    await vul(t.page, GOED);
    await t.page.click('#bewaarKnop');
    await t.page.waitForSelector('table.mnd', { timeout: 15000 });

    await t.page.selectOption('#rvKies', 'eenmanszaak');
    await t.page.waitForSelector('.oprVink', { timeout: 15000 });
    const stappen = await t.page.$$eval('.oprVink', els => els.length);
    assert.ok(stappen > 3, 'de lijst staat er nu wel, met stappen uit drie bronnen');

    const tekst = await t.page.textContent('#hoofd');
    assert.ok(tekst.includes('geen juridisch volledige checklist'),
      'en zegt zelf dat hij niet volledig is');

    await t.page.click('.oprVink');
    await t.page.waitForFunction(() => document.querySelector('#hoofd').textContent.includes('1 van de'),
      null, { timeout: 15000 });

    // het plan vastleggen en inschrijven, dan pas kan de zaak worden aangevraagd
    await t.page.click('#planKnop');
    await t.page.waitForTimeout(1500);
    await post(t.base, '/api/onderneming/ingeschreven', { id: (await post(t.base, '/api/onderneming/mijn', {}, t.token)).ondernemingen[0].id, kvk: '12345678' }, t.token);
    await t.page.reload({ waitUntil: 'domcontentloaded' });
    await t.page.waitForSelector('#aanvKnop', { timeout: 15000 });

    await t.page.fill('#aanvNaam', 'Aisha');
    await t.page.fill('#aanvContact', 'aisha@example.com');
    await t.page.click('#aanvKnop');
    await t.page.waitForFunction(() => document.querySelector('#hoofd').textContent.includes('Stand van uw aanvraag'),
      null, { timeout: 15000 });

    // en de kern van de zaak: er is GEEN supplier aangemaakt
    const ond = (await post(t.base, '/api/onderneming/mijn', {}, t.token)).ondernemingen[0];
    assert.equal(ond.zaak, null, 'de aanvraag ligt bij een mens; er is niets zelf aangemaakt');
    assert.deepEqual(t.fouten, []);
  } finally { await t.op(); }
});

/* DE BELANGRIJKSTE. Een frontend die de 409 negeert en gewoon nog een keer
   verstuurt, zou dit advies stilzwijgend wegpoetsen. */
test('een afgeraden plan wordt niet stilzwijgend vastgelegd', { skip }, async () => {
  const t = await open();
  try {
    await t.page.waitForSelector('#nieuwKnop', { timeout: 15000 });
    await t.page.fill('#nieuwNaam', 'Verliesgevend');
    await t.page.click('#nieuwKnop');
    await t.page.waitForSelector('#bewaarKnop', { timeout: 15000 });

    // prijs onder de kostprijs: blokkerend
    await vul(t.page, Object.assign({}, GOED, { prijs: 25 }));
    await t.page.click('#bewaarKnop');
    await t.page.waitForSelector('table.mnd', { timeout: 15000 });

    const tekst = await t.page.textContent('#hoofd');
    assert.ok(tekst.includes('niet starten'), 'het scherm toont het afradende oordeel');
    assert.ok(tekst.includes('onder uw kostprijs'), 'met de reden erbij');

    // de bevestiging wegklikken: er mag dan niets worden vastgelegd
    t.page.on('dialog', d => d.dismiss());
    await t.page.click('#planKnop');
    await t.page.waitForTimeout(1200);

    const ond = (await post(t.base, '/api/onderneming/mijn', {}, t.token)).ondernemingen[0];
    assert.equal(ond.fase, 'idee', 'weigeren betekent weigeren: de fase is niet verschoven');
    assert.equal(ond.feiten.plan, false, 'en er is geen plan vastgelegd');
    assert.deepEqual(t.fouten, []);
  } finally { await t.op(); }
});
