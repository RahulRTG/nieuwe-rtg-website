/* ============================================================================
   HET VAKBEWIJS OP HET SCHERM.

   WAAROM DIT BESTAAT. De persoonseis houdt personeel in een kinderopvang, een
   praktijk of een korps tegen tot RTG hun stuk heeft gezien. Zolang dat stuk
   nergens IN te dienen is, is die poort geen beveiliging maar een storing: je
   staat op het rooster en komt er niet in, zonder weg terug. De routes waren er
   eerder dan de schermen, en een route zonder scherm is voor een mens hetzelfde
   als niets (scripts/schermen.js telt daarom apps die geen enkele toets ooit
   heeft geopend).

   WAT ER WORDT VASTGELEGD

   1. Wie in zo'n genre werkt, ZIET wat er van hem gevraagd wordt -- met de
      naam die hij zelf kent ("een Verklaring Omtrent het Gedrag"), niet 'vog'.
   2. Wie er NIET in werkt, ziet niets. Een banner die iedereen om papieren
      vraagt is ruis, en door ruis leren mensen heen klikken.
   3. Er wordt geen document geüpload: dit scherm vraagt om een nummer en een
      datum, niet om een scan.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, wachtOpRust, volgVerzoeken, browserOpties } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* DE BROWSER, EN WAAROM DIT NET ANDERS IS DAN DE ANDERE e2e-BESTANDEN.

   Die doen `require('playwright')` en gebruiken wat ze vinden. Dat gaat mis
   zodra het pakket er WEL is maar de bijbehorende Chromium NIET -- dan lukt de
   require en zakt pas de launch, met "Executable doesn't exist". Dat is geen
   ontbrekende browser maar een versieverschil, en het levert een rode toets op
   die niets over deze code zegt.

   Vandaar: probeer de kandidaten tot er een ECHT start. De eigen driver van dit
   huis (server/lib/browser.js) staat er als laatste bij en die is voor precies
   dit geval gebouwd -- hij draait op elke Chromium-binary die er staat. Vindt
   geen enkele kandidaat een browser, dan slaat de toets over, net als de rest. */
function kandidaten() {
  const uit = [];
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { uit.push(require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright')); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) uit.push(eigen); } catch (e) { /* geen */ }
  return uit;
}
const KANDIDATEN = kandidaten();

async function start() {
  let laatste = null;
  for (const k of KANDIDATEN) {
    try { return await k.chromium.launch(browserOpties(pw)); } catch (e) { laatste = e; }
  }
  throw laatste || new Error('geen browser');
}

async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function open(base, token) {
  const browser = await start();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.addInitScript((tok) => {
    try {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    } catch (e) {}
  }, token);
  const page = await ctx.newPage();
  await volgVerzoeken(page);
  return { browser, page };
}

test('de banner vraagt om het stuk dat het werk vraagt, en alleen daar',
  { skip: KANDIDATEN.length ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const mail = 'vak' + t + '@e.test';
    const reg = (await api(base, '/api/auth/register', { name: 'Vera Vakwerk', email: mail,
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1993-04-04', tier: 'rtg' })).body;
    assert.ok(reg.token, 'registreren hoort een token te geven');

    /* EERST DE TEGENPROEF, en die moet vóór het werk komen: dezelfde mens die
       nog nergens werkt, hoort niets van papieren te zien. Zou deze toets pas
       ná de koppeling draaien, dan bewees hij niets over de lege stand. */
    let page;
    ({ browser, page } = await open(base, reg.token));
    let fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    /* `attached` en niet de standaard `visible`: een LEGE banner is precies wat
       we hier willen zien, en die is per definitie onzichtbaar. Op zichtbaarheid
       wachten zou hier eeuwig duren en dan een timeout opleveren die eruitziet
       als een kapot scherm in plaats van als een goed scherm. */
    await page.waitForSelector('#vakbewijsBanner', { state: 'attached', timeout: 15000 });
    /* De bewering gaat over een LEGE banner; die valt niet af te wachten met
       "verschijnt er iets", dus wachten tot het scherm stil is. */
    await wachtOpRust(page, null, { rondes: 3 });
    const leeg = await page.evaluate(() => {
      const el = document.querySelector('#vakbewijsBanner');
      return el ? el.innerHTML.trim() : 'GEEN ELEMENT';
    });
    assert.equal(leeg, '', 'wie niet in zo\'n genre werkt, hoort hier niets te zien');
    await browser.close(); browser = null;

    // nu komt zij bij de demo-kinderopvang werken (NIDO): VOG-genre
    const roster = (await api(base, '/api/supplier/roster', { code: 'NIDO' })).body;
    const chef = roster.staff.find(x => x.role === 'manager');
    const mgr = (await api(base, '/api/supplier/login', { code: 'NIDO', staffId: chef.id, pin: '1234' })).body.token;
    const inv = (await api(base, '/api/supplier/staff/invite', { name: 'Vera Vakwerk', role: 'staff' }, mgr)).body;
    const join = await api(base, '/api/supplier/staff/join', { bedrijf: roster.supplier.name,
      kassacode: inv.invite.kassacode, login: mail, password: 'geheim123', pin: '4321' });
    assert.equal(join.status, 200, 'de uitnodiging is ingewisseld');

    ({ browser, page } = await open(base, reg.token));
    fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    /* Ook hier `attached`: of de banner op dit moment ZICHTBAAR is hangt af van
       welk tabblad open staat, en dat is niet wat deze toets vraagt. Zij vraagt
       of het scherm het juiste stuk klaarzet voor wie er werkt. */
    await page.waitForSelector('#vakbewijsBanner .vakrij', { state: 'attached', timeout: 15000 });

    const beeld = await page.evaluate(() => {
      const el = document.querySelector('#vakbewijsBanner');
      return { tekst: (el.innerText || ''), rijen: el.querySelectorAll('.vakrij').length,
        knop: !!el.querySelector('[data-vak]'),
        upload: !!el.querySelector('input[type=file]') };
    });

    assert.equal(beeld.rijen, 1, 'een kinderopvang vraagt één stuk van de mens zelf (de VOG)');
    assert.ok(/Verklaring Omtrent het Gedrag/i.test(beeld.tekst),
      'het stuk staat er met de naam die een mens kent, niet als "vog": ' + beeld.tekst);
    assert.ok(/nog niet ingediend/i.test(beeld.tekst), beeld.tekst);
    assert.equal(beeld.knop, true, 'en er is een weg om het in te dienen');
    /* Geen upload: dit scherm legt vast WELK stuk je hebt, niet het document.
       Een tweede paspoort-intake naast de bestaande is precies wat
       kern/gegevenspoort.js verbiedt. */
    assert.equal(beeld.upload, false, 'hier wordt geen document geüpload');

    /* De identiteit heeft zijn eigen banner hierboven en hoort hier niet nog
       een keer gevraagd te worden -- anders doet een mens twee keer hetzelfde. */
    assert.equal(/vastgestelde identiteit/i.test(beeld.tekst), false,
      'de identiteit staat in de verificatiebanner en niet ook hier');

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    /* ---- DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2) ----
       D. RAAK. In app-main-60.js `nodig.delete('identiteit')` weggehaald, zodat
          de identiteit hier NOG een keer wordt gevraagd naast zijn eigen
          banner. -> deze toets zakte op "de identiteit staat in de
          verificatiebanner en niet ook hier" (en op het aantal rijen).
       E. RAAK. De leegte-poort uitgezet (`if (false)`), zodat de banner ook
          verschijnt bij wie nergens in zo'n genre werkt.
          -> deze toets zakte op de TEGENPROEF bovenaan: "wie niet in zo'n genre
             werkt, hoort hier niets te zien". Dat die tegenproef vóór de
             koppeling staat is precies waarom hij dit vangt. */
    if (browser) try { await browser.close(); } catch (e) {}
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('het kantoor ziet de stapel, met de codenaam en niet de echte naam',
  { skip: KANDIDATEN.length ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakkantoor-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now(), mail = 'ok' + t + '@e.test';
    const NAAM = 'Otto Kantoorman';
    const reg = (await api(base, '/api/auth/register', { name: NAAM, email: mail,
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body;

    const roster = (await api(base, '/api/supplier/roster', { code: 'NIDO' })).body;
    const chef = roster.staff.find(x => x.role === 'manager');
    const mgr = (await api(base, '/api/supplier/login', { code: 'NIDO', staffId: chef.id, pin: '1234' })).body.token;
    const inv = (await api(base, '/api/supplier/staff/invite', { name: NAAM, role: 'staff' }, mgr)).body;
    await api(base, '/api/supplier/staff/join', { bedrijf: roster.supplier.name,
      kassacode: inv.invite.kassacode, login: mail, password: 'geheim123', pin: '4321' });
    assert.equal((await api(base, '/api/vakbewijs/zet',
      { wat: 'vog', nummer: 'VOG-9', tot: '2030-01-01' }, reg.token)).status, 200);

    const office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    browser = await start();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_office_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, office);
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/backoffice.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#vakbewijzen .vrow', { state: 'attached', timeout: 15000 });

    const beeld = await page.evaluate(() => {
      const el = document.querySelector('#vakbewijzen');
      return { tekst: el.innerText || '', html: el.innerHTML,
        teken: el.querySelectorAll('[data-teken]').length,
        inzien: el.querySelectorAll('[data-nummer]').length };
    });

    assert.ok(/Verklaring Omtrent het Gedrag/i.test(beeld.tekst),
      'het stuk staat er bij zijn leesbare naam: ' + beeld.tekst);
    assert.equal(beeld.teken, 1, 'en er is precies een knop om op af te tekenen');

    /* HET NUMMER STAAT ER NIET, en dat is sinds de kluis-verhuizing het punt:
       een BIG-registratie staat in een openbaar register, dus een nummer naast
       een codenaam voert die codenaam terug naar een echte naam. Het gaat alleen
       open met een reden, en dan weet de betrokkene het. */
    assert.equal(beeld.html.includes('VOG-9'), false,
      'het documentnummer hoort niet zomaar op het bord te staan: ' + beeld.tekst);
    assert.equal(beeld.inzien, 1, 'er is wel een weg ernaartoe, met een reden');

    /* DE PRIVACYREGEL, en die is het punt van deze toets: de echte naam ligt in
       de kluis en elke blik daarin hoort door het inzagejournaal. Op dit bord
       staat de codenaam. */
    assert.equal(beeld.tekst.includes(NAAM), false,
      'de echte naam hoort hier niet te staan: ' + beeld.tekst);

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
