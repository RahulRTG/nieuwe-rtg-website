/* ============================================================================
   DE OVERHEIDSSCHERMEN: DE BURGER EN DE AMBTENAAR.

   Acht schermen uit de lijst van TAKEN 4.9, en ze vallen in twee soorten die
   precies tegenover elkaar staan:

   DE BURGERKANT (gemeente, overheid) is voor het lid zelf. Die opent met een
   gewone ledensessie en toont de loketten: melden, burgerzaken, vergunningen,
   de berichtenbox.

   DE AMBTENARENKANT (gemeenteloket, rijksloket, rechtbank, belastingkantoor,
   marechaussee) is voor wie ACHTER het loket zit. Daar zijn de dossiers van
   burgers, en dat is het gevoeligste wat dit huis kent: een gemeenteambtenaar
   ziet adressen, een inspecteur ziet inkomens, een griffier ziet zaken.

   DE BEWERING DIE ERTOE DOET: een gewoon lid met een gewone ledensessie komt
   daar NIET in. Niet met een leeg scherm dat toevallig niets laadt, maar met
   een eerlijke vraag om de medewerkersinlog -- en zonder ook maar een naam,
   adres of dossiernummer van iemand anders op het scherm.

   Dat onderscheid is met een half regeltje om te draaien en het is van buiten
   onzichtbaar: een loket dat zijn gegevens toont ziet er precies zo uit als een
   loket dat correct werkt, tot je kijkt wie er voor staat.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, volgVerzoeken, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-overheid-'));

/* De loketten waar een ambtenaar achter zit, met de rol die ze vragen. */
const ACHTER_HET_LOKET = [
  { app: 'gemeenteloket', rol: /gemeente-?medewerker|medewerker van de gemeente/i },
  { app: 'rijksloket', rol: /rijksambtenaar|medewerker van het rijk/i },
  { app: 'rechtbank', rol: /rechtspraak|griffie|rechter/i },
  { app: 'belastingkantoor', rol: /belastingdienst|inspecteur/i },
  { app: 'marechaussee', rol: /marechaussee|brigade/i }
];

/* Wat er nooit op zo'n scherm hoort te staan zonder ambtenarensessie: gegevens
   die aan een persoon hangen. Een BSN is het scherpst -- negen cijfers achter
   elkaar -- maar ook een IBAN of een postcode-met-huisnummer hoort hier niet. */
const PERSOONSGEGEVEN = [
  [/\b\d{9}\b/, 'iets dat op een BSN lijkt'],
  [/\bNL\d{2}[A-Z]{4}\d{10}\b/, 'een IBAN'],
  [/\b\d{4}\s?[A-Z]{2}\s+\d{1,4}\b/, 'een postcode met huisnummer']
];

async function toon(page, base, app, token) {
  const pad = '/apps/' + app + '.html';
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => {
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t); else localStorage.removeItem('rtg_member_token');
    // met opzet GEEN ambtenarensessie
    localStorage.removeItem('rtg_office_token');
    localStorage.removeItem('rtg_gem_token');
    localStorage.removeItem('rtg_rijk_token');
  }, token || null);
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  await wachtOpRust(page);
  return page.evaluate(() => ({
    pad: location.pathname,
    tekst: document.body.innerText.replace(/\s+/g, ' ')
  }));
}

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Burger', email: 'bg' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1975-07-07', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

test('achter het loket komt een gewoon lid niet: vijf ambtenarenschermen vragen om de medewerkersinlog',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const l of ACHTER_HET_LOKET) {
      const r = await toon(page, base, l.app, token);
      if (r.pad !== '/apps/' + l.app + '.html') { stuk.push(l.app + ': stuurt weg naar ' + r.pad); continue; }

      /* 1. Het scherm zegt WIE het bedient. Zonder die zin weet een lid niet of
         hij op de verkeerde plek is of dat er iets stuk is. */
      if (!l.rol.test(r.tekst)) stuk.push(l.app + ': noemt niet voor welke rol dit loket is -- ' + r.tekst.slice(0, 120));

      /* 2. Er is een weg naar binnen voor wie er wel hoort. */
      if (!/log in|inloggen|aanmelden|pincode/i.test(r.tekst)) {
        stuk.push(l.app + ': geen zichtbare medewerkersinlog -- ' + r.tekst.slice(0, 120));
      }

      /* 3. EN GEEN GEGEVENS VAN IEMAND. Dit is de bewering waar het om gaat. */
      for (const [patroon, wat] of PERSOONSGEGEVEN) {
        const m = r.tekst.match(patroon);
        if (m) stuk.push(l.app + ': toont ' + wat + ' ("' + m[0] + '") zonder ambtenarensessie');
      }

      /* 4. Een dicht loket mag niet leeg zijn: dood is stiller dan stuk. */
      if (r.tekst.trim().length < 80) stuk.push(l.app + ': bijna leeg (' + r.tekst.trim().length + ' tekens)');
    }
    assert.deepEqual(stuk, [], 'de vijf loketten houden de deur dicht:\n  ' + stuk.join('\n  '));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('de burgerkant staat wel open: de loketten van de gemeente en het rijk',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await nieuwLid(base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);

    /* Zonder deze helft bewijst de vorige toets niets: een app die voor iedereen
       dicht zit houdt ook een ambtenaar buiten, en dan is de poort geen poort
       maar een muur. */
    const gem = await toon(page, base, 'gemeente', token);
    assert.match(gem.tekst, /melden|burgerzaken|vergunning/i,
      'de gemeente toont haar loketten aan een inwoner: ' + gem.tekst.slice(0, 200));

    const rijk = await toon(page, base, 'overheid', token);
    assert.match(rijk.tekst, /berichtenbox|belasting|rdw/i,
      'en het rijk zijn onderdelen: ' + rijk.tekst.slice(0, 200));

    /* De gemeentelijke PDA is de derde soort: het veldapparaat van een
       handhaver. Die hoort zich ook als zodanig te melden. */
    const pda = await toon(page, base, 'gemeentepda', token);
    assert.equal(pda.pad, '/apps/gemeentepda.html', 'de gemeente-PDA blijft op zijn eigen adres');
    assert.ok(pda.tekst.trim().length > 60, 'en zegt iets: ' + pda.tekst.slice(0, 140));

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
